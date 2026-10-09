#!/usr/bin/env python3
"""
Build monthly point-in-time S&P 500 market-cap rankings.

INPUT
-----
sp500_monthly_membership_pit_final.csv

OUTPUTS
-------
sp500_rank_history.csv
sp500_rank_history_summary.csv
sp500_rank_history_missing.csv
sp500_rank_cache/
    polygon_prices/
    polygon_details/
    sec_companyfacts/

METHODOLOGY
-----------
For each monthly S&P membership snapshot:

1) Point-in-time ticker + CIK come from the already-audited membership file.
2) Price = last valid Polygon daily close on or before snapshot date.
   IMPORTANT: Polygon is queried with adjusted=false.
3) Shares:
   a. SEC EntityCommonStockSharesOutstanding
   b. SEC CommonStockSharesOutstanding
   c. SEC weighted-average basic shares
   d. SEC weighted-average diluted shares
   Only facts with BOTH:
       fact.end   <= snapshot_date
       fact.filed <= snapshot_date
   are eligible, preventing lookahead.
4) For multiple S&P securities sharing the same CIK in the same month
   (for example multiple share classes), Polygon's historical
   share_class_shares_outstanding is preferred when available.
5) market_cap = unadjusted_close * shares_outstanding
6) Rank descending by market cap among tradable/rankable securities.

This script DOES NOT modify Supabase or api.py.
"""

from __future__ import annotations

import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import date, timedelta
import json
import math
import os
from pathlib import Path
import re
import threading
import time
from typing import Dict, Iterable, List, Optional, Tuple
from urllib.parse import quote

import pandas as pd
import requests


POLYGON_BASE_URL = "https://api.polygon.io"
SEC_COMPANYFACTS_BASE = "https://data.sec.gov/api/xbrl/companyfacts"

CACHE_LOCK = threading.Lock()
SEC_RATE_LOCK = threading.Lock()
SEC_LAST_REQUEST_TS = 0.0

# ~5 requests/sec. SEC guideline is no more than 10/sec.
SEC_MIN_INTERVAL_SECONDS = 0.20

PRICE_LOOKBACK_DAYS = 10
MAX_ACCEPTABLE_PRICE_STALENESS_DAYS = 7

# We do not automatically reject stale share counts because share counts are
# disclosed periodically, but we make staleness explicit in the output.
SHARES_WARN_STALE_DAYS = 150
SHARES_POOR_STALE_DAYS = 400

SHARE_CONCEPTS = [
    {
        "taxonomy": "dei",
        "concept": "EntityCommonStockSharesOutstanding",
        "source": "sec_entity_common_stock_shares_outstanding",
        "kind": "instant",
        "priority": 1,
    },
    {
        "taxonomy": "us-gaap",
        "concept": "CommonStockSharesOutstanding",
        "source": "sec_common_stock_shares_outstanding",
        "kind": "instant",
        "priority": 2,
    },
    {
        "taxonomy": "us-gaap",
        "concept": "WeightedAverageNumberOfSharesOutstandingBasic",
        "source": "sec_weighted_average_basic",
        "kind": "duration",
        "priority": 3,
    },
    {
        "taxonomy": "us-gaap",
        "concept": "WeightedAverageNumberOfDilutedSharesOutstanding",
        "source": "sec_weighted_average_diluted",
        "kind": "duration",
        "priority": 4,
    },
]


def normalize_ticker(value) -> str:
    if pd.isna(value):
        return ""
    text = str(value).upper().replace("\xa0", " ").strip()
    match = re.search(r"[A-Z0-9]+(?:[.\-][A-Z0-9]+)*", text)
    return match.group(0) if match else ""


def normalize_cik(value) -> str:
    if pd.isna(value):
        return ""
    text = str(value).strip()
    if text.endswith(".0"):
        text = text[:-2]
    digits = "".join(ch for ch in text if ch.isdigit())
    return digits.zfill(10) if digits else ""


def parse_bool(value, default=True) -> bool:
    if isinstance(value, bool):
        return value
    text = str(value or "").strip().lower()
    if text in {"true", "1", "yes", "y"}:
        return True
    if text in {"false", "0", "no", "n"}:
        return False
    return default


def load_env_value(name: str) -> str:
    value = os.getenv(name, "").strip()
    if value:
        return value

    candidates = [
        Path.cwd() / ".env",
        Path(__file__).resolve().parent / ".env",
    ]

    seen = set()

    for path in candidates:
        try:
            path = path.resolve()
        except Exception:
            continue

        if path in seen or not path.exists():
            continue

        seen.add(path)

        try:
            text = path.read_text(encoding="utf-8", errors="ignore")
        except Exception:
            continue

        pattern = rf"(?m)^\s*{re.escape(name)}\s*=\s*['\"]?([^'\"\r\n#]+)"
        match = re.search(pattern, text)

        if match:
            value = match.group(1).strip()
            if value:
                return value

    return ""


def load_polygon_api_key() -> str:
    key = load_env_value("POLYGON_API_KEY")
    if not key:
        raise RuntimeError(
            "POLYGON_API_KEY was not found in the environment or local .env."
        )
    return key


def load_sec_user_agent() -> str:
    configured = load_env_value("SEC_USER_AGENT")
    if configured:
        return configured

    # Descriptive fallback for SEC automated-access classification.
    return "BullionaireIQ/1.0 info@bullionaireiq.com"


def atomic_write_json(path: Path, data) -> None:
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(
        json.dumps(data, indent=2, sort_keys=True),
        encoding="utf-8",
    )
    tmp.replace(path)


def safe_filename(text: str) -> str:
    return re.sub(r"[^A-Za-z0-9_.-]+", "_", text)


def ensure_cache_dirs(root: Path) -> Dict[str, Path]:
    dirs = {
        "root": root,
        "prices": root / "polygon_prices",
        "details": root / "polygon_details",
        "splits": root / "polygon_splits",
        "sec": root / "sec_companyfacts",
    }

    for path in dirs.values():
        path.mkdir(parents=True, exist_ok=True)

    return dirs


def load_membership(path: Path) -> pd.DataFrame:
    df = pd.read_csv(path, dtype=str).fillna("")

    required = {
        "snapshot_date",
        "ticker",
        "source_ticker",
        "security",
        "cik",
        "tradable_at_snapshot",
    }

    missing = required - set(df.columns)

    if missing:
        raise RuntimeError(
            f"{path.name} is missing columns: {sorted(missing)}"
        )

    df["snapshot_date"] = pd.to_datetime(
        df["snapshot_date"],
        errors="coerce",
    )

    if df["snapshot_date"].isna().any():
        raise RuntimeError("Invalid snapshot_date values found.")

    df["ticker"] = df["ticker"].map(normalize_ticker)
    df["source_ticker"] = df["source_ticker"].map(normalize_ticker)
    df["cik"] = df["cik"].map(normalize_cik)
    df["tradable_at_snapshot"] = df["tradable_at_snapshot"].map(
        lambda x: parse_bool(x, default=True)
    )

    if (df["ticker"] == "").any():
        bad = df[df["ticker"] == ""].head(20)
        raise RuntimeError(
            "Blank/invalid ticker found:\n" + bad.to_string(index=False)
        )

    if df.duplicated(["snapshot_date", "ticker"]).any():
        bad = df[
            df.duplicated(
                ["snapshot_date", "ticker"],
                keep=False,
            )
        ].head(30)

        raise RuntimeError(
            "Duplicate (snapshot_date, ticker) rows found:\n"
            + bad.to_string(index=False)
        )

    return df.sort_values(
        ["snapshot_date", "ticker"]
    ).reset_index(drop=True)


def polygon_get(
    session: requests.Session,
    url: str,
    params: dict,
    attempts: int = 6,
) -> Optional[dict]:
    last_error = None

    for attempt in range(attempts):
        try:
            response = session.get(
                url,
                params=params,
                timeout=45,
            )

            if response.status_code == 429:
                time.sleep(min(12, 1.5 * (2 ** attempt)))
                continue

            if response.status_code in {400, 404, 422}:
                return None

            response.raise_for_status()
            return response.json()

        except requests.RequestException as exc:
            last_error = exc

            if attempt < attempts - 1:
                time.sleep(min(12, 1.5 * (2 ** attempt)))

    if last_error:
        raise last_error

    return None


def ticker_price_window(
    membership_df: pd.DataFrame,
) -> Dict[str, Tuple[str, str]]:
    result = {}

    for ticker, group in membership_df.groupby("ticker"):
        first = group["snapshot_date"].min() - pd.Timedelta(
            days=PRICE_LOOKBACK_DAYS + 2
        )
        last = group["snapshot_date"].max()

        result[ticker] = (
            first.date().isoformat(),
            last.date().isoformat(),
        )

    return result


def fetch_polygon_price_history(
    ticker: str,
    start_date: str,
    end_date: str,
    api_key: str,
    cache_dir: Path,
) -> Tuple[str, List[dict], Optional[str]]:
    cache_path = cache_dir / f"{safe_filename(ticker)}.json"

    if cache_path.exists():
        try:
            cached = json.loads(cache_path.read_text(encoding="utf-8"))

            if (
                cached.get("ticker") == ticker
                and cached.get("start_date") <= start_date
                and cached.get("end_date") >= end_date
                and cached.get("adjusted") is False
            ):
                return ticker, cached.get("bars") or [], None
        except Exception:
            pass

    session = requests.Session()

    try:
        encoded = quote(ticker, safe="")
        url = (
            f"{POLYGON_BASE_URL}/v2/aggs/ticker/"
            f"{encoded}/range/1/day/{start_date}/{end_date}"
        )

        data = polygon_get(
            session=session,
            url=url,
            params={
                "adjusted": "false",
                "sort": "asc",
                "limit": 50000,
                "apiKey": api_key,
            },
        )

        bars = []

        for bar in (data or {}).get("results") or []:
            ts = bar.get("t")
            close = bar.get("c")

            if ts is None or close is None:
                continue

            bar_date = pd.to_datetime(
                int(ts),
                unit="ms",
                utc=True,
            ).date().isoformat()

            try:
                close_value = float(close)
            except Exception:
                continue

            if close_value <= 0:
                continue

            bars.append(
                {
                    "date": bar_date,
                    "close": close_value,
                }
            )

        payload = {
            "ticker": ticker,
            "start_date": start_date,
            "end_date": end_date,
            "adjusted": False,
            "bars": bars,
        }

        atomic_write_json(cache_path, payload)

        return ticker, bars, None

    except Exception as exc:
        return ticker, [], f"{type(exc).__name__}: {exc}"

    finally:
        session.close()


def build_price_lookup(
    membership_df: pd.DataFrame,
    api_key: str,
    cache_dir: Path,
    workers: int,
) -> Tuple[Dict[str, List[dict]], List[dict]]:
    windows = ticker_price_window(membership_df)

    price_data: Dict[str, List[dict]] = {}
    failures = []

    with ThreadPoolExecutor(
        max_workers=max(1, min(workers, 12))
    ) as executor:
        futures = {
            executor.submit(
                fetch_polygon_price_history,
                ticker,
                start,
                end,
                api_key,
                cache_dir,
            ): ticker
            for ticker, (start, end) in windows.items()
        }

        completed = 0

        for future in as_completed(futures):
            ticker, bars, error = future.result()

            price_data[ticker] = bars

            if error:
                failures.append(
                    {
                        "ticker": ticker,
                        "error": error,
                    }
                )

            completed += 1

            if completed % 50 == 0 or completed == len(futures):
                print(
                    f"Polygon price histories: "
                    f"{completed}/{len(futures)}"
                    f" | failed={len(failures)}"
                )

    return price_data, failures


def sec_throttle() -> None:
    global SEC_LAST_REQUEST_TS

    with SEC_RATE_LOCK:
        now = time.monotonic()
        elapsed = now - SEC_LAST_REQUEST_TS
        wait = SEC_MIN_INTERVAL_SECONDS - elapsed

        if wait > 0:
            time.sleep(wait)

        SEC_LAST_REQUEST_TS = time.monotonic()


def fetch_sec_companyfacts(
    cik: str,
    user_agent: str,
    cache_dir: Path,
) -> Tuple[str, Optional[dict], Optional[str]]:
    cik = normalize_cik(cik)

    if not cik:
        return cik, None, "missing_cik"

    cache_path = cache_dir / f"CIK{cik}.json"

    if cache_path.exists():
        try:
            data = json.loads(cache_path.read_text(encoding="utf-8"))
            return cik, data, None
        except Exception:
            pass

    session = requests.Session()
    session.headers.update(
        {
            "User-Agent": user_agent,
            "Accept-Encoding": "gzip, deflate",
            "Accept": "application/json",
        }
    )

    url = f"{SEC_COMPANYFACTS_BASE}/CIK{cik}.json"
    last_error = None

    try:
        for attempt in range(6):
            try:
                sec_throttle()

                response = session.get(
                    url,
                    timeout=45,
                )

                if response.status_code == 404:
                    return cik, None, "404_not_found"

                if response.status_code in {403, 429}:
                    retry_after = response.headers.get("Retry-After")

                    try:
                        sleep_seconds = float(retry_after)
                    except Exception:
                        sleep_seconds = min(20, 2.0 * (2 ** attempt))

                    time.sleep(max(2.0, sleep_seconds))
                    continue

                response.raise_for_status()
                data = response.json()

                atomic_write_json(cache_path, data)

                return cik, data, None

            except requests.RequestException as exc:
                last_error = exc

                if attempt < 5:
                    time.sleep(min(20, 2.0 * (2 ** attempt)))

        if last_error:
            return cik, None, f"{type(last_error).__name__}: {last_error}"

        return cik, None, "unknown_sec_error"

    finally:
        session.close()


def build_sec_lookup(
    membership_df: pd.DataFrame,
    user_agent: str,
    cache_dir: Path,
) -> Tuple[Dict[str, Optional[dict]], List[dict]]:
    ciks = sorted(
        {
            normalize_cik(cik)
            for cik in membership_df["cik"]
            if normalize_cik(cik)
        }
    )

    data_by_cik: Dict[str, Optional[dict]] = {}
    failures = []

    # Deliberately sequential + throttled for SEC fair-access compliance.
    for i, cik in enumerate(ciks, 1):
        cik_key, data, error = fetch_sec_companyfacts(
            cik=cik,
            user_agent=user_agent,
            cache_dir=cache_dir,
        )

        data_by_cik[cik_key] = data

        if error:
            failures.append(
                {
                    "cik": cik_key,
                    "error": error,
                }
            )

        if i % 50 == 0 or i == len(ciks):
            print(
                f"SEC companyfacts: "
                f"{i}/{len(ciks)}"
                f" | failed={len(failures)}"
            )

    return data_by_cik, failures


def facts_for_concept(
    companyfacts: dict,
    taxonomy: str,
    concept: str,
) -> List[dict]:
    concept_obj = (
        (companyfacts or {})
        .get("facts", {})
        .get(taxonomy, {})
        .get(concept, {})
    )

    units = concept_obj.get("units") or {}

    result = []

    for unit_name, rows in units.items():
        if str(unit_name).strip().lower() != "shares":
            continue

        for row in rows or []:
            if not isinstance(row, dict):
                continue

            try:
                value = float(row.get("val"))
            except Exception:
                continue

            if not math.isfinite(value) or value <= 0:
                continue

            end = pd.to_datetime(
                row.get("end"),
                errors="coerce",
            )

            filed = pd.to_datetime(
                row.get("filed"),
                errors="coerce",
            )

            if pd.isna(end) or pd.isna(filed):
                continue

            start = pd.to_datetime(
                row.get("start"),
                errors="coerce",
            )

            result.append(
                {
                    "value": value,
                    "end": end.normalize(),
                    "filed": filed.normalize(),
                    "start": (
                        None
                        if pd.isna(start)
                        else start.normalize()
                    ),
                    "form": str(row.get("form") or ""),
                    "frame": str(row.get("frame") or ""),
                    "accn": str(row.get("accn") or ""),
                }
            )

    return result


def choose_eligible_fact(
    facts: List[dict],
    snapshot_date: pd.Timestamp,
    kind: str,
) -> Optional[dict]:
    eligible = [
        fact
        for fact in facts
        if (
            fact["end"] <= snapshot_date
            and fact["filed"] <= snapshot_date
        )
    ]

    if not eligible:
        return None

    if kind == "instant":
        eligible.sort(
            key=lambda x: (
                x["end"],
                x["filed"],
            ),
            reverse=True,
        )
        return eligible[0]

    # Duration fallback:
    # 1) latest period end
    # 2) shortest period ending on that date (quarter > YTD > annual)
    # 3) latest filing
    def duration_days(fact):
        if fact["start"] is None:
            return 99999
        return max(
            0,
            (fact["end"] - fact["start"]).days,
        )

    latest_end = max(fact["end"] for fact in eligible)

    same_end = [
        fact for fact in eligible
        if fact["end"] == latest_end
    ]

    same_end.sort(
        key=lambda x: (
            duration_days(x),
            -int(x["filed"].timestamp()),
        )
    )

    return same_end[0]


def choose_sec_shares(
    companyfacts: Optional[dict],
    snapshot_date: pd.Timestamp,
) -> Optional[dict]:
    if not companyfacts:
        return None

    for spec in SHARE_CONCEPTS:
        facts = facts_for_concept(
            companyfacts,
            spec["taxonomy"],
            spec["concept"],
        )

        chosen = choose_eligible_fact(
            facts=facts,
            snapshot_date=snapshot_date,
            kind=spec["kind"],
        )

        if chosen:
            return {
                "shares": float(chosen["value"]),
                "source": spec["source"],
                "concept": spec["concept"],
                "end_date": chosen["end"],
                "filed_date": chosen["filed"],
                "form": chosen["form"],
                "frame": chosen["frame"],
                "accn": chosen["accn"],
                "priority": spec["priority"],
            }

    return None


def latest_price_on_or_before(
    bars: List[dict],
    snapshot_date: pd.Timestamp,
) -> Optional[dict]:
    if not bars:
        return None

    target = snapshot_date.date()

    # Bars are normally ascending. Walk backward for the latest usable close.
    for bar in reversed(bars):
        try:
            bar_date = date.fromisoformat(bar["date"])
            close = float(bar["close"])
        except Exception:
            continue

        if bar_date <= target and close > 0:
            staleness = (target - bar_date).days

            return {
                "date": pd.Timestamp(bar_date),
                "close": close,
                "staleness_days": staleness,
            }

    return None

def fetch_polygon_splits_window(
    start_date: str,
    end_date: str,
    api_key: str,
    cache_dir: Path,
) -> List[dict]:
    cache_path = (
        cache_dir
        / f"splits_{start_date}_{end_date}.json"
    )

    if cache_path.exists():
        try:
            return json.loads(
                cache_path.read_text(
                    encoding="utf-8"
                )
            )
        except Exception:
            pass

    session = requests.Session()
    results = []

    try:
        url = (
            f"{POLYGON_BASE_URL}"
            f"/v3/reference/splits"
        )

        params = {
            "execution_date.gte": start_date,
            "execution_date.lte": end_date,
            "sort": "execution_date",
            "order": "asc",
            "limit": 1000,
            "apiKey": api_key,
        }

        while url:
            data = polygon_get(
                session=session,
                url=url,
                params=params,
            )

            if not data:
                break

            results.extend(
                data.get("results") or []
            )

            next_url = data.get("next_url")

            if next_url:
                url = next_url
                params = {
                    "apiKey": api_key,
                }
            else:
                break

        atomic_write_json(
            cache_path,
            results,
        )

        return results

    finally:
        session.close()


def build_split_lookup(
    split_rows: List[dict],
) -> Dict[str, List[dict]]:
    result = {}

    for row in split_rows or []:
        ticker = normalize_ticker(
            row.get("ticker")
        )

        if not ticker:
            continue

        execution_date = pd.to_datetime(
            row.get("execution_date"),
            errors="coerce",
        )

        try:
            split_from = float(
                row.get("split_from")
            )
            split_to = float(
                row.get("split_to")
            )
        except Exception:
            continue

        if (
            pd.isna(execution_date)
            or split_from <= 0
            or split_to <= 0
        ):
            continue

        result.setdefault(
            ticker,
            [],
        ).append({
            "execution_date":
                execution_date.normalize(),
            "split_from": split_from,
            "split_to": split_to,
        })

    return result


def split_factor_between(
    split_rows: List[dict],
    shares_end_date,
    snapshot_date,
) -> float:
    if (
        not split_rows
        or shares_end_date is None
    ):
        return 1.0

    start = pd.Timestamp(
        shares_end_date
    ).normalize()

    end = pd.Timestamp(
        snapshot_date
    ).normalize()

    factor = 1.0

    for row in split_rows:
        execution_date = row[
            "execution_date"
        ]

        if (
            start < execution_date
            and execution_date <= end
        ):
            factor *= (
                float(row["split_to"])
                / float(row["split_from"])
            )

    return factor

def fetch_polygon_details_for_shares(
    ticker: str,
    snapshot_date: pd.Timestamp,
    api_key: str,
    cache_dir: Path,
) -> Optional[dict]:
    date_text = snapshot_date.date().isoformat()

    cache_path = (
        cache_dir
        / f"{safe_filename(ticker)}__{date_text}.json"
    )

    if cache_path.exists():
        try:
            return json.loads(
                cache_path.read_text(encoding="utf-8")
            )
        except Exception:
            pass

    session = requests.Session()

    try:
        encoded = quote(ticker, safe="")
        url = f"{POLYGON_BASE_URL}/v3/reference/tickers/{encoded}"

        data = polygon_get(
            session=session,
            url=url,
            params={
                "date": date_text,
                "apiKey": api_key,
            },
        )

        result = (data or {}).get("results") or {}

        if result:
            atomic_write_json(cache_path, result)

        return result or None

    finally:
        session.close()


def choose_polygon_reference_shares(
    ticker: str,
    snapshot_date: pd.Timestamp,
    api_key: str,
    cache_dir: Path,
) -> Optional[dict]:
    details = fetch_polygon_details_for_shares(
        ticker=ticker,
        snapshot_date=snapshot_date,
        api_key=api_key,
        cache_dir=cache_dir,
    )

    if not details:
        return None

    for field, source in [
        (
            "share_class_shares_outstanding",
            "polygon_share_class_shares_outstanding",
        ),
        (
            "weighted_shares_outstanding",
            "polygon_weighted_shares_outstanding",
        ),
    ]:
        try:
            value = float(details.get(field))
        except Exception:
            continue

        if math.isfinite(value) and value > 0:
            return {
                "shares": value,
                "source": source,
                "concept": field,
                "end_date": snapshot_date,
                "filed_date": snapshot_date,
                "form": "",
                "frame": "",
                "accn": "",
                "priority": 0,
            }

    return None


def duplicate_cik_rows_by_snapshot(
    membership_df: pd.DataFrame,
) -> set:
    result = set()

    valid = membership_df[
        membership_df["cik"].ne("")
    ].copy()

    counts = (
        valid.groupby(["snapshot_date", "cik"])
        .size()
        .rename("count")
        .reset_index()
    )

    multi = counts[counts["count"] > 1]

    for _, row in multi.iterrows():
        snapshot = row["snapshot_date"]
        cik = row["cik"]

        rows = valid[
            (valid["snapshot_date"] == snapshot)
            & (valid["cik"] == cik)
        ]

        for idx in rows.index:
            result.add(int(idx))

    return result


def quality_flag(
    tradable: bool,
    price_info: Optional[dict],
    share_info: Optional[dict],
) -> str:
    if not tradable:
        return "not_tradable"

    if price_info is None and share_info is None:
        return "missing_price_and_shares"

    if price_info is None:
        return "missing_price"

    if share_info is None:
        return "missing_shares"

    if (
        price_info["staleness_days"]
        > MAX_ACCEPTABLE_PRICE_STALENESS_DAYS
    ):
        return "stale_price"

    share_end = share_info.get("end_date")

    if share_end is not None:
        # Shares selected from a historical Polygon details snapshot use the
        # snapshot date itself and therefore have zero staleness here.
        share_staleness = None
    else:
        share_staleness = None

    return "ok"


def format_date(value) -> str:
    if value is None:
        return ""

    try:
        ts = pd.Timestamp(value)
        if pd.isna(ts):
            return ""
        return ts.date().isoformat()
    except Exception:
        return ""


def main() -> int:
    parser = argparse.ArgumentParser()

    parser.add_argument(
        "--input",
        default="sp500_monthly_membership_pit_final.csv",
    )

    parser.add_argument(
        "--output",
        default="sp500_rank_history.csv",
    )

    parser.add_argument(
        "--summary-output",
        default="sp500_rank_history_summary.csv",
    )

    parser.add_argument(
        "--missing-output",
        default="sp500_rank_history_missing.csv",
    )

    parser.add_argument(
        "--cache-dir",
        default="sp500_rank_cache",
    )

    parser.add_argument(
        "--polygon-workers",
        type=int,
        default=8,
    )

    parser.add_argument(
        "--minimum-coverage",
        type=float,
        default=98.0,
    )

    args = parser.parse_args()

    input_path = Path(args.input).resolve()
    output_path = Path(args.output).resolve()
    summary_path = Path(args.summary_output).resolve()
    missing_path = Path(args.missing_output).resolve()
    cache_root = Path(args.cache_dir).resolve()

    if not input_path.exists():
        raise RuntimeError(f"Missing input file: {input_path}")

    polygon_api_key = load_polygon_api_key()
    sec_user_agent = load_sec_user_agent()

    cache_dirs = ensure_cache_dirs(cache_root)

    membership_df = load_membership(input_path)

    print(
        "Membership window         : "
        f"{membership_df['snapshot_date'].min().date()} "
        f"through {membership_df['snapshot_date'].max().date()}"
    )
    print(f"Membership rows           : {len(membership_df)}")
    print(
        f"Unique historical tickers : "
        f"{membership_df['ticker'].nunique()}"
    )
    print(
        f"Unique SEC CIKs           : "
        f"{membership_df.loc[membership_df['cik'].ne(''), 'cik'].nunique()}"
    )

    print()
    print("STEP 1/3 — Polygon unadjusted daily price histories")

    price_data, price_fetch_failures = build_price_lookup(
        membership_df=membership_df,
        api_key=polygon_api_key,
        cache_dir=cache_dirs["prices"],
        workers=args.polygon_workers,
    )

    print()
    print("STEP 2/3 — SEC Company Facts")

    sec_data, sec_fetch_failures = build_sec_lookup(
        membership_df=membership_df,
        user_agent=sec_user_agent,
        cache_dir=cache_dirs["sec"],
    )

    print()
    print()
    print("STEP 2.5/3 — Polygon stock split history")

    split_start = (
            membership_df["snapshot_date"].min()
            - pd.Timedelta(days=365 * 5)
    ).date().isoformat()

    split_end = (
        membership_df["snapshot_date"].max()
    ).date().isoformat()

    split_rows = fetch_polygon_splits_window(
        start_date=split_start,
        end_date=split_end,
        api_key=polygon_api_key,
        cache_dir=cache_dirs["splits"],
    )

    split_lookup = build_split_lookup(
        split_rows
    )

    print(
        f"Split events loaded       : "
        f"{len(split_rows)}"
    )
    print("STEP 3/3 — Build monthly market caps and ranks")

    multi_class_rows = duplicate_cik_rows_by_snapshot(
        membership_df
    )

    last_shares_by_cik = {}
    last_shares_by_ticker = {}

    output_rows = []

    for idx, row in membership_df.iterrows():
        snapshot = row["snapshot_date"].normalize()
        ticker = row["ticker"]
        cik = row["cik"]
        tradable = bool(row["tradable_at_snapshot"])

        price_info = latest_price_on_or_before(
            price_data.get(ticker) or [],
            snapshot,
        )

        # Reject stale prices for ranking.
        price_usable = (
            price_info is not None
            and price_info["staleness_days"]
            <= MAX_ACCEPTABLE_PRICE_STALENESS_DAYS
        )

        sec_share_info = choose_sec_shares(
            sec_data.get(cik),
            snapshot,
        )

        share_info = sec_share_info
        split_factor = 1.0

        # A stock split can occur after the SEC share fact's period end.
        # In that case an unadjusted post-split price multiplied by the
        # stale pre-split share count produces a wildly incorrect market cap.
        #
        # Prefer Polygon's point-in-time share count for those snapshots.
        if (
                share_info is not None
                and share_info.get("end_date") is not None
        ):
            split_factor = split_factor_between(
                split_lookup.get(ticker, []),
                share_info.get("end_date"),
                snapshot,
            )

            if abs(split_factor - 1.0) > 1e-9:
                polygon_split_shares = (
                    choose_polygon_reference_shares(
                        ticker=ticker,
                        snapshot_date=snapshot,
                        api_key=polygon_api_key,
                        cache_dir=cache_dirs["details"],
                    )
                )

                if polygon_split_shares:
                    polygon_split_shares[
                        "source"
                    ] = (
                            polygon_split_shares["source"]
                            + "_split_refresh"
                    )

                    share_info = (
                        polygon_split_shares
                    )

                elif share_info.get("source") in {
                    "sec_entity_common_stock_shares_outstanding",
                    "sec_common_stock_shares_outstanding",
                }:
                    share_info = dict(
                        share_info
                    )

                    share_info["shares"] = (
                            float(share_info["shares"])
                            * split_factor
                    )

                    share_info["source"] = (
                            str(share_info["source"])
                            + "_split_adjusted"
                    )

        # For multiple listed share classes under the same CIK, prefer
        # point-in-time class shares from Polygon when available.
        if idx in multi_class_rows:
            polygon_share_info = choose_polygon_reference_shares(
                ticker=ticker,
                snapshot_date=snapshot,
                api_key=polygon_api_key,
                cache_dir=cache_dirs["details"],
            )

            if polygon_share_info:
                share_info = polygon_share_info

        # SEC missing? Try Polygon historical reference details as fallback.
        if share_info is None:
            share_info = choose_polygon_reference_shares(
                ticker=ticker,
                snapshot_date=snapshot,
                api_key=polygon_api_key,
                cache_dir=cache_dirs["details"],
            )

        # Sanity-check abnormal share-count jumps that are NOT adequately
        # explained by a known stock split. This catches malformed SEC facts
        # such as the historical PKG 1000x share-count error.
        if share_info is not None:
            try:
                current_shares = float(
                    share_info["shares"]
                )
            except Exception:
                current_shares = None

            previous_shares = (
                    last_shares_by_cik.get(cik)
                    or last_shares_by_ticker.get(ticker)
            )

            suspicious_share_count = False

            if (
                    current_shares is not None
                    and current_shares > 0
                    and previous_shares is not None
                    and previous_shares > 0
            ):
                raw_share_ratio = (
                        current_shares
                        / previous_shares
                )

                expected_split_factor = (
                    split_factor
                    if split_factor > 0
                    else 1.0
                )

                normalized_share_ratio = (
                        raw_share_ratio
                        / expected_split_factor
                )

                if (
                        normalized_share_ratio >= 3.0
                        or normalized_share_ratio <= (1.0 / 3.0)
                ):
                    suspicious_share_count = True

            suspicious_tiny_market_cap = False

            if (
                    current_shares is not None
                    and current_shares > 0
                    and price_info is not None
            ):
                implied_market_cap = (
                        float(price_info["close"])
                        * current_shares
                )

                # An S&P 500 constituent with an implied value below $50M
                # is almost certainly a malformed share fact rather than a
                # legitimate monthly market-cap observation.
                if implied_market_cap < 50_000_000:
                    suspicious_tiny_market_cap = True

            if (
                    suspicious_share_count
                    or suspicious_tiny_market_cap
            ):
                polygon_sanity_shares = (
                    choose_polygon_reference_shares(
                        ticker=ticker,
                        snapshot_date=snapshot,
                        api_key=polygon_api_key,
                        cache_dir=cache_dirs["details"],
                    )
                )

                if polygon_sanity_shares:
                    polygon_sanity_shares[
                        "source"
                    ] = (
                            polygon_sanity_shares["source"]
                            + "_sanity_refresh"
                    )

                    share_info = polygon_sanity_shares

            if share_info is not None:
                try:
                    accepted_shares = float(
                        share_info["shares"]
                    )
                except Exception:
                    accepted_shares = None

                if (
                        accepted_shares is not None
                        and accepted_shares > 0
                ):
                    if cik:
                        last_shares_by_cik[
                            cik
                        ] = accepted_shares

                    if ticker:
                        last_shares_by_ticker[
                            ticker
                        ] = accepted_shares

        shares_staleness_days = None

        if (
            share_info
            and share_info.get("end_date") is not None
        ):
            shares_staleness_days = int(
                (
                    snapshot
                    - pd.Timestamp(
                        share_info["end_date"]
                    ).normalize()
                ).days
            )

        market_cap = None

        if (
            tradable
            and price_usable
            and share_info is not None
        ):
            market_cap = (
                float(price_info["close"])
                * float(share_info["shares"])
            )

            if (
                not math.isfinite(market_cap)
                or market_cap <= 0
            ):
                market_cap = None

        qflag = quality_flag(
            tradable=tradable,
            price_info=price_info if price_usable else None,
            share_info=share_info,
        )

        if (
            qflag == "ok"
            and shares_staleness_days is not None
        ):
            if shares_staleness_days > SHARES_POOR_STALE_DAYS:
                qflag = "very_stale_shares"
            elif shares_staleness_days > SHARES_WARN_STALE_DAYS:
                qflag = "stale_shares"

        output_rows.append(
            {
                "snapshot_date": snapshot.date().isoformat(),
                "ticker": ticker,
                "security": row["security"],
                "cik": cik,
                "tradable_at_snapshot": tradable,
                "rank": "",
                "market_cap": market_cap,
                "price": (
                    None
                    if price_info is None
                    else float(price_info["close"])
                ),
                "price_date": (
                    ""
                    if price_info is None
                    else format_date(price_info["date"])
                ),
                "price_staleness_days": (
                    None
                    if price_info is None
                    else int(price_info["staleness_days"])
                ),
                "shares_outstanding": (
                    None
                    if share_info is None
                    else float(share_info["shares"])
                ),
                "shares_end_date": (
                    ""
                    if share_info is None
                    else format_date(
                        share_info.get("end_date")
                    )
                ),
                "shares_filed_date": (
                    ""
                    if share_info is None
                    else format_date(
                        share_info.get("filed_date")
                    )
                ),
                "shares_staleness_days": shares_staleness_days,
                "share_source": (
                    ""
                    if share_info is None
                    else share_info.get("source", "")
                ),
                "share_concept": (
                    ""
                    if share_info is None
                    else share_info.get("concept", "")
                ),
                "quality_flag": qflag,
            }
        )

        if (idx + 1) % 2500 == 0 or (idx + 1) == len(membership_df):
            print(
                f"Calculated rows: "
                f"{idx + 1}/{len(membership_df)}"
            )

    rank_df = pd.DataFrame(output_rows)

    # Assign rank independently for each snapshot.
    for snapshot_text, group in rank_df.groupby(
        "snapshot_date",
        sort=True,
    ):
        eligible = group[
            group["market_cap"].notna()
        ].copy()

        eligible = eligible.sort_values(
            ["market_cap", "ticker"],
            ascending=[False, True],
        )

        for rank_value, row_idx in enumerate(
            eligible.index,
            start=1,
        ):
            rank_df.at[row_idx, "rank"] = rank_value

    rank_df.to_csv(
        output_path,
        index=False,
    )

    summary_rows = []

    for snapshot_text, group in rank_df.groupby(
        "snapshot_date",
        sort=True,
    ):
        members = len(group)
        tradable_count = int(
            group["tradable_at_snapshot"].sum()
        )
        priced_count = int(
            group["price"].notna().sum()
        )
        shares_count = int(
            group["shares_outstanding"].notna().sum()
        )
        ranked_count = int(
            group["market_cap"].notna().sum()
        )

        coverage = (
            100.0 * ranked_count / members
            if members
            else 0.0
        )

        summary_rows.append(
            {
                "snapshot_date": snapshot_text,
                "member_count": members,
                "tradable_count": tradable_count,
                "priced_count": priced_count,
                "shares_count": shares_count,
                "ranked_count": ranked_count,
                "coverage_pct": round(coverage, 4),
                "ok_count": int(
                    group["quality_flag"].eq("ok").sum()
                ),
                "stale_shares_count": int(
                    group["quality_flag"]
                    .isin(
                        [
                            "stale_shares",
                            "very_stale_shares",
                        ]
                    )
                    .sum()
                ),
            }
        )

    summary_df = pd.DataFrame(
        summary_rows
    )

    summary_df.to_csv(
        summary_path,
        index=False,
    )

    missing_df = rank_df[
        rank_df["market_cap"].isna()
        | ~rank_df["quality_flag"].eq("ok")
    ].copy()

    missing_df.to_csv(
        missing_path,
        index=False,
    )

    min_coverage = float(
        summary_df["coverage_pct"].min()
    )

    print()
    print("=" * 82)
    print("S&P 500 MONTHLY MARKET-CAP RANK BUILD COMPLETE")
    print("=" * 82)
    print(f"Rank rows written        : {len(rank_df)}")
    print(f"Snapshot months          : {len(summary_df)}")
    print(f"Minimum monthly coverage : {min_coverage:.2f}%")
    print(f"Polygon fetch failures   : {len(price_fetch_failures)}")
    print(f"SEC fetch failures       : {len(sec_fetch_failures)}")
    print(f"Rank history             : {output_path}")
    print(f"Coverage summary         : {summary_path}")
    print(f"Missing/quality audit    : {missing_path}")
    print(f"Cache directory          : {cache_root}")

    print()
    print("Coverage — first 6 months:")
    print(
        summary_df.head(6).to_string(index=False)
    )

    print()
    print("Coverage — last 6 months:")
    print(
        summary_df.tail(6).to_string(index=False)
    )

    sample_dates = [
        "2021-10-31",
        "2024-12-31",
        "2025-06-30",
        "2026-09-30",
    ]

    for sample_date in sample_dates:
        sample = (
            rank_df[
                rank_df["snapshot_date"].eq(
                    sample_date
                )
                & rank_df["market_cap"].notna()
            ]
            .sort_values(
                "rank",
                key=lambda s: pd.to_numeric(
                    s,
                    errors="coerce",
                ),
            )
            .head(10)
        )

        if sample.empty:
            continue

        print()
        print(
            f"Top 10 — {sample_date}:"
        )
        print(
            sample[
                [
                    "rank",
                    "ticker",
                    "security",
                    "market_cap",
                    "price",
                    "shares_outstanding",
                    "share_source",
                ]
            ].to_string(index=False)
        )

    if min_coverage < float(args.minimum_coverage):
        print()
        print(
            "STOP: monthly rank coverage is below "
            f"{float(args.minimum_coverage):.2f}%."
        )
        print(
            "Send the terminal output plus "
            "sp500_rank_history_missing.csv before Supabase/API work."
        )

    else:
        print()
        print(
            "PASS: monthly ranking coverage meets the configured threshold."
        )
        print(
            "Next step: inspect top-rank sanity, then load the validated "
            "rank history into Supabase."
        )

    return 0


if __name__ == "__main__":
    raise SystemExit(main())