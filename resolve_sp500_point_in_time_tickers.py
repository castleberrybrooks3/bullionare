#!/usr/bin/env python3
"""
Resolve point-in-time ticker symbols for reconstructed monthly S&P 500 membership
using Polygon ticker details + ticker-change events.

Inputs:
    sp500_constituents_snapshot.csv
    sp500_changes_history.csv
    sp500_monthly_membership.csv

Outputs:
    sp500_monthly_membership_resolved.csv
    sp500_ticker_resolution_changes.csv
    sp500_ticker_resolution_unresolved.csv
    sp500_polygon_ticker_event_cache.json

The script DOES NOT modify Supabase or api.py.

Polygon API key lookup order:
    1) POLYGON_API_KEY environment variable
    2) local .env file in the current directory
    3) local .env file beside this script
"""

from __future__ import annotations

import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import date, timedelta
import json
import os
from pathlib import Path
import re
import threading
import time
from typing import Dict, List, Optional, Set, Tuple

import pandas as pd
import requests


POLYGON_BASE_URL = "https://api.polygon.io"

CURRENT_COLUMNS = [
    "Symbol",
    "Security",
    "GICS Sector",
    "GICS Sub-Industry",
    "Headquarters Location",
    "Date added",
    "CIK",
    "Founded",
]

CACHE_LOCK = threading.Lock()


def normalize_symbol(value) -> str:
    """
    Normalize ticker text from Wikipedia/CSV sources before sending it to Polygon.

    Examples cleaned safely:
        "JCP |"     -> "JCP"
        "BRK.B"     -> "BRK.B"
        "BF.B[1]"   -> "BF.B"
        " META "    -> "META"

    Returns an empty string when the value still does not look like a ticker.
    """
    if pd.isna(value):
        return ""

    symbol = str(value).upper().replace("\xa0", " ").strip()

    # Remove common Wikipedia/reference debris.
    symbol = re.sub(r"\[[^\]]*\]", "", symbol)
    symbol = symbol.replace("|", " ")
    symbol = symbol.replace("†", " ").replace("‡", " ")
    symbol = symbol.strip()

    # Keep only the first ticker-looking token.
    match = re.search(r"[A-Z0-9]+(?:[.\-][A-Z0-9]+)*", symbol)
    if not match:
        return ""

    symbol = match.group(0).strip(" .-")

    # Reject clearly invalid leftovers.
    if not re.fullmatch(r"[A-Z0-9]+(?:[.\-][A-Z0-9]+)*", symbol):
        return ""

    return symbol


def normalize_cik(value) -> str:
    if pd.isna(value):
        return ""
    text = str(value).strip()
    if text.endswith(".0"):
        text = text[:-2]
    digits = "".join(ch for ch in text if ch.isdigit())
    return digits.zfill(10) if digits else ""


def load_api_key() -> str:
    key = os.getenv("POLYGON_API_KEY", "").strip()
    if key:
        return key

    candidates = [
        Path.cwd() / ".env",
        Path(__file__).resolve().parent / ".env",
    ]

    seen = set()

    for env_path in candidates:
        env_path = env_path.resolve()

        if env_path in seen or not env_path.exists():
            continue

        seen.add(env_path)

        try:
            text = env_path.read_text(encoding="utf-8", errors="ignore")
        except Exception:
            continue

        match = re.search(
            r"(?m)^\s*POLYGON_API_KEY\s*=\s*['\"]?([^'\"\r\n#]+)",
            text,
        )

        if match:
            value = match.group(1).strip()
            if value:
                return value

    raise RuntimeError(
        "POLYGON_API_KEY was not found. "
        "Set it in your environment or local .env file. "
        "Do not paste the API key into this script."
    )


def load_current_constituents(path: Path) -> pd.DataFrame:
    df = pd.read_csv(path, dtype=str).fillna("")

    if "Symbol" not in df.columns:
        df = pd.read_csv(
            path,
            dtype=str,
            header=None,
            names=CURRENT_COLUMNS,
        ).fillna("")

    if "Symbol" not in df.columns:
        raise RuntimeError(
            f"{path.name} does not contain a Symbol column."
        )

    if "Security" not in df.columns:
        df["Security"] = ""

    if "CIK" not in df.columns:
        df["CIK"] = ""

    df["Symbol"] = df["Symbol"].map(normalize_symbol)
    df["CIK"] = df["CIK"].map(normalize_cik)

    df = (
        df[df["Symbol"].ne("")]
        .drop_duplicates(subset=["Symbol"], keep="last")
        .reset_index(drop=True)
    )

    return df


def load_changes(path: Path) -> pd.DataFrame:
    df = pd.read_csv(path, dtype=str).fillna("")

    required = {"date", "added_ticker", "removed_ticker"}
    missing = required - set(df.columns)

    if missing:
        raise RuntimeError(
            f"{path.name} is missing columns: {sorted(missing)}"
        )

    df["date"] = pd.to_datetime(
        df["date"],
        errors="coerce",
    )

    if df["date"].isna().any():
        raise RuntimeError(
            f"{path.name} contains invalid dates."
        )

    df["added_ticker"] = df["added_ticker"].map(normalize_symbol)
    df["removed_ticker"] = df["removed_ticker"].map(normalize_symbol)

    return df


def load_membership(path: Path) -> pd.DataFrame:
    df = pd.read_csv(path, dtype=str).fillna("")

    required = {"snapshot_date", "ticker", "security"}
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
        raise RuntimeError(
            f"{path.name} contains invalid snapshot dates."
        )

    df["ticker"] = df["ticker"].map(normalize_symbol)

    duplicate_count = int(
        df.duplicated(
            subset=["snapshot_date", "ticker"]
        ).sum()
    )

    if duplicate_count:
        raise RuntimeError(
            f"{path.name} contains {duplicate_count} duplicate "
            "(snapshot_date, ticker) rows."
        )

    return df


def load_cache(path: Path) -> dict:
    if not path.exists():
        return {
            "details": {},
            "events": {},
            "cik_date": {},
        }

    try:
        data = json.loads(
            path.read_text(
                encoding="utf-8",
            )
        )
    except Exception:
        return {
            "details": {},
            "events": {},
            "cik_date": {},
        }

    data.setdefault("details", {})
    data.setdefault("events", {})
    data.setdefault("cik_date", {})

    return data


def save_cache(path: Path, cache: dict) -> None:
    with CACHE_LOCK:
        path.write_text(
            json.dumps(
                cache,
                indent=2,
                sort_keys=True,
            ),
            encoding="utf-8",
        )


def polygon_get(
    session: requests.Session,
    api_key: str,
    path: str,
    params: Optional[dict] = None,
    attempts: int = 5,
) -> Optional[dict]:
    params = dict(params or {})
    params["apiKey"] = api_key

    url = (
        path
        if str(path).startswith("http")
        else f"{POLYGON_BASE_URL}{path}"
    )

    last_error = None

    for attempt in range(attempts):
        try:
            response = session.get(
                url,
                params=params,
                timeout=30,
            )

            if response.status_code == 429:
                sleep_seconds = min(
                    8,
                    1.0 * (2 ** attempt),
                )
                time.sleep(sleep_seconds)
                continue

            if response.status_code in {400, 404, 422}:
                # Historical/reference sources can contain obsolete or malformed
                # symbols. Treat those as an unavailable lookup rather than
                # aborting the entire ticker-resolution run.
                return None

            response.raise_for_status()
            return response.json()

        except requests.RequestException as exc:
            last_error = exc

            if attempt < attempts - 1:
                time.sleep(
                    min(
                        8,
                        1.0 * (2 ** attempt),
                    )
                )

    if last_error:
        raise last_error

    return None


def ticker_candidates(ticker: str) -> List[str]:
    clean = normalize_symbol(ticker)

    candidates = [clean]

    if "." in clean:
        candidates.append(
            clean.replace(".", "-")
        )

    if "-" in clean:
        candidates.append(
            clean.replace("-", ".")
        )

    output = []
    seen = set()

    for item in candidates:
        if item and item not in seen:
            seen.add(item)
            output.append(item)

    return output


def fetch_ticker_details(
    session: requests.Session,
    api_key: str,
    ticker: str,
    date_text: str,
    cache: dict,
) -> Optional[dict]:
    cache_key = (
        f"{normalize_symbol(ticker)}|{date_text}"
    )

    with CACHE_LOCK:
        if cache_key in cache["details"]:
            return cache["details"][cache_key]

    result = None

    for candidate in ticker_candidates(ticker):
        data = polygon_get(
            session=session,
            api_key=api_key,
            path=(
                f"/v3/reference/tickers/"
                f"{candidate}"
            ),
            params={
                "date": date_text,
            },
        )

        candidate_result = (
            (data or {}).get("results")
        )

        if candidate_result:
            result = candidate_result
            break

    with CACHE_LOCK:
        cache["details"][cache_key] = result

    return result


def identity_key_from_details(
    details: dict,
) -> Tuple[Optional[str], Optional[str]]:
    # Share-class FIGI is the most specific identity for S&P constituents.
    # This prevents legitimate multi-class names (GOOG/GOOGL, FOX/FOXA, etc.)
    # from collapsing into one company-level identity.
    share_class = str(
        details.get("share_class_figi") or ""
    ).strip()

    if share_class:
        return (
            f"share_class_figi:{share_class}",
            share_class,
        )

    composite = str(
        details.get("composite_figi") or ""
    ).strip()

    if composite:
        return (
            f"composite_figi:{composite}",
            composite,
        )

    cik = normalize_cik(
        details.get("cik")
    )

    if cik:
        # CIK is company-level rather than share-class-level.
        # Use only as a last fallback when FIGI is unavailable.
        return (
            f"cik:{cik}:{normalize_symbol(details.get('ticker'))}",
            normalize_symbol(details.get("ticker")),
        )

    ticker = normalize_symbol(
        details.get("ticker")
    )

    if ticker:
        return (
            f"ticker:{ticker}",
            ticker,
        )

    return None, None


def fetch_ticker_events(
    session: requests.Session,
    api_key: str,
    event_identifier: str,
    identity_key: str,
    cache: dict,
) -> dict:
    with CACHE_LOCK:
        if identity_key in cache["events"]:
            cached = cache["events"][identity_key]
            return cached or {}

    data = polygon_get(
        session=session,
        api_key=api_key,
        path=(
            f"/vX/reference/tickers/"
            f"{event_identifier}/events"
        ),
        params={
            "types": "ticker_change",
        },
    )

    result = (
        (data or {}).get("results")
        or {}
    )

    with CACHE_LOCK:
        cache["events"][identity_key] = result

    return result



def fetch_tickers_by_cik_date(
    session: requests.Session,
    api_key: str,
    cik: str,
    date_text: str,
    cache: dict,
) -> List[dict]:
    """
    Point-in-time Polygon reference lookup for all stock tickers tied to one CIK.
    Used only for the small number of duplicate ticker collisions.
    """
    clean_cik = normalize_cik(cik)

    if not clean_cik:
        return []

    cache_key = f"{clean_cik}|{date_text}"

    with CACHE_LOCK:
        if cache_key in cache["cik_date"]:
            return cache["cik_date"][cache_key] or []

    data = polygon_get(
        session=session,
        api_key=api_key,
        path="/v3/reference/tickers",
        params={
            "cik": clean_cik,
            "date": date_text,
            "market": "stocks",
            "active": "true",
            "limit": 100,
        },
    )

    results = (
        (data or {}).get("results")
        or []
    )

    with CACHE_LOCK:
        cache["cik_date"][cache_key] = results

    return results


def same_polygon_identity(
    candidate: dict,
    identity: dict,
) -> bool:
    """
    Match the same listed security/share class.
    """
    wanted_share = str(
        identity.get("share_class_figi")
        or ""
    ).strip()

    wanted_composite = str(
        identity.get("composite_figi")
        or ""
    ).strip()

    candidate_share = str(
        candidate.get("share_class_figi")
        or ""
    ).strip()

    candidate_composite = str(
        candidate.get("composite_figi")
        or ""
    ).strip()

    if wanted_share and candidate_share:
        return wanted_share == candidate_share

    if wanted_composite and candidate_composite:
        return wanted_composite == candidate_composite

    return False


def repair_duplicate_tickers(
    resolved_df: pd.DataFrame,
    identities: Dict[str, dict],
    api_key: str,
    cache: dict,
) -> Tuple[pd.DataFrame, pd.DataFrame]:
    """
    Repair duplicate (snapshot_date, ticker) collisions using targeted
    point-in-time Polygon reference lookups.

    We do NOT drop rows. If a collision cannot be repaired cleanly, the caller
    stops and writes an audit file for inspection.
    """
    repaired = resolved_df.copy()

    duplicate_mask = repaired.duplicated(
        subset=["snapshot_date", "ticker"],
        keep=False,
    )

    collisions = repaired[
        duplicate_mask
    ].copy()

    if collisions.empty:
        return repaired, pd.DataFrame()

    audit_rows = []
    session = requests.Session()

    try:
        for idx, row in collisions.iterrows():
            snapshot_date = str(
                row["snapshot_date"]
            )

            source_ticker = normalize_symbol(
                row["source_ticker"]
            )

            initial_ticker = normalize_symbol(
                row["ticker"]
            )

            identity_key = str(
                row.get("identity_key")
                or ""
            ).strip()

            identity = identities.get(
                identity_key,
                {},
            )

            cik = normalize_cik(
                identity.get("cik")
                or row.get("cik")
            )

            repaired_ticker = None
            repair_method = ""
            candidates_seen = []

            # First try the original source ticker itself at the snapshot date.
            # This is often the cleanest repair when a current ticker was
            # incorrectly projected backward.
            if source_ticker:
                source_details = fetch_ticker_details(
                    session=session,
                    api_key=api_key,
                    ticker=source_ticker,
                    date_text=snapshot_date,
                    cache=cache,
                )

                if source_details:
                    source_live_ticker = normalize_symbol(
                        source_details.get("ticker")
                    )

                    if source_live_ticker:
                        candidates_seen.append(
                            source_live_ticker
                        )

                    source_identity_key, _ = (
                        identity_key_from_details(
                            source_details
                        )
                    )

                    if (
                        identity_key
                        and source_identity_key
                        == identity_key
                    ):
                        repaired_ticker = (
                            source_live_ticker
                            or source_ticker
                        )
                        repair_method = (
                            "source_ticker_verified_at_snapshot"
                        )

            # If the source ticker is not enough, query all point-in-time
            # securities for the company's CIK and match the exact FIGI.
            if not repaired_ticker and cik:
                point_in_time = fetch_tickers_by_cik_date(
                    session=session,
                    api_key=api_key,
                    cik=cik,
                    date_text=snapshot_date,
                    cache=cache,
                )

                for item in point_in_time:
                    t = normalize_symbol(
                        item.get("ticker")
                    )
                    if t:
                        candidates_seen.append(t)

                exact = [
                    item
                    for item in point_in_time
                    if same_polygon_identity(
                        item,
                        identity,
                    )
                ]

                if len(exact) == 1:
                    repaired_ticker = normalize_symbol(
                        exact[0].get("ticker")
                    )
                    repair_method = (
                        "cik_date_figi_match"
                    )

                elif len(point_in_time) == 1:
                    repaired_ticker = normalize_symbol(
                        point_in_time[0].get("ticker")
                    )
                    repair_method = (
                        "cik_date_single_result"
                    )

            if repaired_ticker:
                repaired.at[
                    idx,
                    "ticker",
                ] = repaired_ticker

                repaired.at[
                    idx,
                    "resolution_status",
                ] = "collision_repaired"

            audit_rows.append(
                {
                    "snapshot_date": snapshot_date,
                    "source_ticker": source_ticker,
                    "initial_resolved_ticker": initial_ticker,
                    "repaired_ticker": repaired_ticker or "",
                    "repair_method": repair_method,
                    "identity_key": identity_key,
                    "cik": cik,
                    "point_in_time_candidates": "|".join(
                        sorted(
                            {
                                t
                                for t in candidates_seen
                                if t
                            }
                        )
                    ),
                }
            )

    finally:
        session.close()

    return repaired, pd.DataFrame(audit_rows)


def build_anchor_requests(
    current_df: pd.DataFrame,
    changes_df: pd.DataFrame,
    membership_df: pd.DataFrame,
) -> List[Tuple[str, str, str]]:
    """
    Each request is:
        ticker, date_text, anchor_source
    """
    requests_out = []

    current_anchor_date = max(
        date.today(),
        membership_df["snapshot_date"].max().date(),
    ).isoformat()

    for _, row in current_df.iterrows():
        ticker = normalize_symbol(
            row.get("Symbol")
        )

        if ticker:
            requests_out.append(
                (
                    ticker,
                    current_anchor_date,
                    "current_constituent",
                )
            )

    earliest_snapshot = membership_df["snapshot_date"].min().normalize()

    # We only need constituent-change anchors that can affect the requested
    # five-year membership window. Polygon ticker-event history for each resolved
    # identity can still contain older ticker changes automatically.
    relevant_changes = changes_df[
        changes_df["date"] >= earliest_snapshot
    ]

    for _, row in relevant_changes.iterrows():
        event_date = row["date"].date()

        added = normalize_symbol(
            row.get("added_ticker")
        )

        removed = normalize_symbol(
            row.get("removed_ticker")
        )

        if added:
            requests_out.append(
                (
                    added,
                    event_date.isoformat(),
                    "sp500_addition",
                )
            )

        if removed:
            prior_date = (
                event_date
                - timedelta(days=1)
            ).isoformat()

            requests_out.append(
                (
                    removed,
                    prior_date,
                    "sp500_removal",
                )
            )

    # Also anchor every symbol that actually appears in the monthly
    # membership file. Use the latest month where that symbol appears.
    latest_by_ticker = (
        membership_df
        .groupby("ticker")["snapshot_date"]
        .max()
    )

    for ticker, last_seen in latest_by_ticker.items():
        clean = normalize_symbol(ticker)

        if clean:
            requests_out.append(
                (
                    clean,
                    last_seen.date().isoformat(),
                    "monthly_membership",
                )
            )

    unique = []
    seen = set()

    for ticker, date_text, source in requests_out:
        key = (
            ticker,
            date_text,
        )

        if key in seen:
            continue

        seen.add(key)
        unique.append(
            (
                ticker,
                date_text,
                source,
            )
        )

    return unique


def resolve_anchor(
    anchor,
    api_key,
    cache,
):
    ticker, date_text, source = anchor

    session = requests.Session()

    try:
        details = fetch_ticker_details(
            session=session,
            api_key=api_key,
            ticker=ticker,
            date_text=date_text,
            cache=cache,
        )
    finally:
        session.close()

    return {
        "ticker": ticker,
        "date": date_text,
        "source": source,
        "details": details,
    }


def resolve_events(
    identity_key,
    event_identifier,
    api_key,
    cache,
):
    session = requests.Session()

    try:
        events = fetch_ticker_events(
            session=session,
            api_key=api_key,
            event_identifier=event_identifier,
            identity_key=identity_key,
            cache=cache,
        )
    finally:
        session.close()

    return (
        identity_key,
        events,
    )


def clean_event_list(
    result: dict,
    anchor_tickers: Set[str],
) -> List[dict]:
    events = []

    for event in (
        result.get("events")
        or []
    ):
        if (
            str(event.get("type") or "")
            != "ticker_change"
        ):
            continue

        ticker_change = (
            event.get("ticker_change")
            or {}
        )

        ticker = normalize_symbol(
            ticker_change.get("ticker")
        )

        date_text = str(
            event.get("date")
            or ""
        ).strip()

        parsed_date = pd.to_datetime(
            date_text,
            errors="coerce",
        )

        if (
            ticker
            and not pd.isna(parsed_date)
        ):
            events.append(
                {
                    "date": parsed_date.normalize(),
                    "ticker": ticker,
                }
            )

    events.sort(
        key=lambda row: row["date"]
    )

    # If Polygon returns no ticker-change events, the anchor itself
    # is still a valid alias for this identity.
    if not events:
        for anchor_ticker in sorted(anchor_tickers):
            events.append(
                {
                    "date": pd.Timestamp("1900-01-01"),
                    "ticker": anchor_ticker,
                }
            )
            break

    return events


def ticker_at_date(
    events: List[dict],
    snapshot_date: pd.Timestamp,
) -> Optional[str]:
    chosen = None

    for event in events:
        if event["date"] <= snapshot_date:
            chosen = event["ticker"]
        else:
            break

    if chosen:
        return chosen

    # Some entities have incomplete event history. If there is only one
    # known symbol, use it; otherwise do not guess.
    unique_tickers = {
        row["ticker"]
        for row in events
    }

    if len(unique_tickers) == 1:
        return next(iter(unique_tickers))

    return None


def main() -> int:
    parser = argparse.ArgumentParser()

    parser.add_argument(
        "--constituents",
        default="sp500_constituents_snapshot.csv",
    )

    parser.add_argument(
        "--changes",
        default="sp500_changes_history.csv",
    )

    parser.add_argument(
        "--membership",
        default="sp500_monthly_membership.csv",
    )

    parser.add_argument(
        "--output",
        default="sp500_monthly_membership_resolved.csv",
    )

    parser.add_argument(
        "--changes-output",
        default="sp500_ticker_resolution_changes.csv",
    )

    parser.add_argument(
        "--unresolved-output",
        default="sp500_ticker_resolution_unresolved.csv",
    )

    parser.add_argument(
        "--collision-output",
        default="sp500_ticker_collision_audit.csv",
    )

    parser.add_argument(
        "--cache",
        default="sp500_polygon_ticker_event_cache.json",
    )

    parser.add_argument(
        "--workers",
        type=int,
        default=8,
    )

    args = parser.parse_args()

    constituents_path = Path(
        args.constituents
    ).resolve()

    changes_path = Path(
        args.changes
    ).resolve()

    membership_path = Path(
        args.membership
    ).resolve()

    output_path = Path(
        args.output
    ).resolve()

    changes_output_path = Path(
        args.changes_output
    ).resolve()

    unresolved_output_path = Path(
        args.unresolved_output
    ).resolve()

    collision_output_path = Path(
        args.collision_output
    ).resolve()

    cache_path = Path(
        args.cache
    ).resolve()

    for path in (
        constituents_path,
        changes_path,
        membership_path,
    ):
        if not path.exists():
            raise RuntimeError(
                f"Missing file: {path}"
            )

    api_key = load_api_key()

    current_df = load_current_constituents(
        constituents_path
    )

    changes_df = load_changes(
        changes_path
    )

    membership_df = load_membership(
        membership_path
    )

    cache = load_cache(
        cache_path
    )

    anchors = build_anchor_requests(
        current_df=current_df,
        changes_df=changes_df,
        membership_df=membership_df,
    )

    print(
        "Membership window         : "
        f"{membership_df['snapshot_date'].min().date()} "
        f"through {membership_df['snapshot_date'].max().date()}"
    )

    print(
        f"Anchor requests to resolve: "
        f"{len(anchors)}"
    )

    workers = max(
        1,
        min(
            int(args.workers),
            16,
        ),
    )

    anchor_results = []

    with ThreadPoolExecutor(
        max_workers=workers
    ) as executor:
        future_map = {
            executor.submit(
                resolve_anchor,
                anchor,
                api_key,
                cache,
            ): anchor
            for anchor in anchors
        }

        completed = 0

        failed_anchors = 0

        for future in as_completed(
            future_map
        ):
            anchor = future_map[future]

            try:
                result = future.result()
                anchor_results.append(
                    result
                )
            except Exception as exc:
                failed_anchors += 1
                print(
                    "[WARN] Anchor lookup failed "
                    f"{anchor[0]} @ {anchor[1]}: "
                    f"{type(exc).__name__}: {exc}"
                )

            completed += 1

            if (
                completed % 100 == 0
                or completed == len(anchors)
            ):
                save_cache(
                    cache_path,
                    cache,
                )

                print(
                    f"Resolved anchor details: "
                    f"{completed}/{len(anchors)}"
                    f" | failed={failed_anchors}"
                )

    save_cache(
        cache_path,
        cache,
    )

    identities: Dict[str, dict] = {}
    alias_to_identities: Dict[str, Set[str]] = {}

    for row in anchor_results:
        details = row.get("details")

        if not details:
            continue

        identity_key, event_identifier = (
            identity_key_from_details(
                details
            )
        )

        if not identity_key or not event_identifier:
            continue

        identity = identities.setdefault(
            identity_key,
            {
                "event_identifier": event_identifier,
                "anchors": set(),
                "cik": normalize_cik(
                    details.get("cik")
                ),
                "share_class_figi": str(
                    details.get("share_class_figi")
                    or ""
                ).strip(),
                "composite_figi": str(
                    details.get("composite_figi")
                    or ""
                ).strip(),
                "name": str(
                    details.get("name")
                    or ""
                ).strip(),
            },
        )

        input_ticker = normalize_symbol(
            row.get("ticker")
        )

        details_ticker = normalize_symbol(
            details.get("ticker")
        )

        for alias in (
            input_ticker,
            details_ticker,
        ):
            if alias:
                identity["anchors"].add(
                    alias
                )
                alias_to_identities.setdefault(
                    alias,
                    set(),
                ).add(
                    identity_key
                )

    print(
        f"Unique Polygon identities: "
        f"{len(identities)}"
    )

    event_futures = {}

    with ThreadPoolExecutor(
        max_workers=workers
    ) as executor:
        for identity_key, identity in identities.items():
            future = executor.submit(
                resolve_events,
                identity_key,
                identity["event_identifier"],
                api_key,
                cache,
            )

            event_futures[future] = (
                identity_key
            )

        completed = 0

        failed_events = 0

        for future in as_completed(
            event_futures
        ):
            expected_identity_key = event_futures[future]

            try:
                identity_key, event_result = (
                    future.result()
                )
            except Exception as exc:
                failed_events += 1
                identity_key = expected_identity_key
                event_result = {}

                print(
                    "[WARN] Ticker-event lookup failed "
                    f"{identity_key}: "
                    f"{type(exc).__name__}: {exc}"
                )

            identity = identities[
                identity_key
            ]

            identity["events"] = (
                clean_event_list(
                    event_result,
                    identity["anchors"],
                )
            )

            for event in identity["events"]:
                alias = normalize_symbol(
                    event["ticker"]
                )

                if alias:
                    alias_to_identities.setdefault(
                        alias,
                        set(),
                    ).add(
                        identity_key
                    )

            completed += 1

            if (
                completed % 100 == 0
                or completed == len(identities)
            ):
                save_cache(
                    cache_path,
                    cache,
                )

                print(
                    f"Resolved ticker events: "
                    f"{completed}/{len(identities)}"
                    f" | failed={failed_events}"
                )

    save_cache(
        cache_path,
        cache,
    )

    current_identity_by_ticker = {}

    current_tickers = set(
        current_df["Symbol"]
        .map(normalize_symbol)
    )

    for ticker in current_tickers:
        candidates = list(
            alias_to_identities.get(
                ticker,
                set(),
            )
        )

        if len(candidates) == 1:
            current_identity_by_ticker[
                ticker
            ] = candidates[0]

    resolved_rows = []
    unresolved_rows = []

    for _, row in membership_df.iterrows():
        snapshot_date = row[
            "snapshot_date"
        ].normalize()

        source_ticker = normalize_symbol(
            row["ticker"]
        )

        candidate_ids = set(
            alias_to_identities.get(
                source_ticker,
                set(),
            )
        )

        # If this is a ticker from the current S&P baseline,
        # prefer the identity represented by that current ticker.
        preferred = (
            current_identity_by_ticker.get(
                source_ticker
            )
        )

        if preferred:
            candidate_ids = {
                preferred
            }

        resolved_ticker = None
        chosen_identity = None
        status = None

        if len(candidate_ids) == 1:
            chosen_identity = next(
                iter(candidate_ids)
            )

            resolved_ticker = (
                ticker_at_date(
                    identities[
                        chosen_identity
                    ]["events"],
                    snapshot_date,
                )
            )

            if resolved_ticker:
                status = (
                    "changed"
                    if resolved_ticker
                    != source_ticker
                    else "unchanged_verified"
                )

        elif len(candidate_ids) > 1:
            # Prefer an identity whose timeline says this exact source
            # ticker was active on the snapshot date.
            exact_matches = []

            for identity_key in candidate_ids:
                active_ticker = (
                    ticker_at_date(
                        identities[
                            identity_key
                        ]["events"],
                        snapshot_date,
                    )
                )

                if active_ticker == source_ticker:
                    exact_matches.append(
                        identity_key
                    )

            if len(exact_matches) == 1:
                chosen_identity = (
                    exact_matches[0]
                )

                resolved_ticker = (
                    source_ticker
                )

                status = (
                    "unchanged_verified"
                )

        if not resolved_ticker:
            # Do not invent a replacement. Keep the original ticker in
            # the output but flag the row for review before market-cap work.
            resolved_ticker = (
                source_ticker
            )

            status = (
                "unresolved"
            )

            unresolved_rows.append(
                {
                    "snapshot_date": (
                        snapshot_date
                        .date()
                        .isoformat()
                    ),
                    "source_ticker": source_ticker,
                    "security": row["security"],
                    "candidate_identity_count": len(
                        candidate_ids
                    ),
                }
            )

        identity = (
            identities.get(
                chosen_identity,
                {},
            )
            if chosen_identity
            else {}
        )

        resolved_rows.append(
            {
                "snapshot_date": (
                    snapshot_date
                    .date()
                    .isoformat()
                ),
                "ticker": resolved_ticker,
                "source_ticker": source_ticker,
                "security": row["security"],
                "resolution_status": status,
                "identity_key": (
                    chosen_identity
                    or ""
                ),
                "cik": (
                    identity.get("cik")
                    or ""
                ),
                "polygon_name": (
                    identity.get("name")
                    or ""
                ),
            }
        )

    resolved_df = pd.DataFrame(
        resolved_rows
    )

    duplicate_mask = (
        resolved_df.duplicated(
            subset=[
                "snapshot_date",
                "ticker",
            ],
            keep=False,
        )
    )

    initial_duplicate_rows = (
        resolved_df[
            duplicate_mask
        ]
        .copy()
    )

    if not initial_duplicate_rows.empty:
        print()
        print(
            "Duplicate ticker collisions found: "
            f"{len(initial_duplicate_rows)} rows"
        )
        print(
            "Running targeted point-in-time "
            "CIK/date collision repair..."
        )

        resolved_df, collision_audit_df = (
            repair_duplicate_tickers(
                resolved_df=resolved_df,
                identities=identities,
                api_key=api_key,
                cache=cache,
            )
        )

        collision_audit_df.to_csv(
            collision_output_path,
            index=False,
        )

        save_cache(
            cache_path,
            cache,
        )

    else:
        collision_audit_df = pd.DataFrame()
        collision_audit_df.to_csv(
            collision_output_path,
            index=False,
        )

    remaining_duplicate_mask = (
        resolved_df.duplicated(
            subset=[
                "snapshot_date",
                "ticker",
            ],
            keep=False,
        )
    )

    remaining_duplicate_rows = (
        resolved_df[
            remaining_duplicate_mask
        ]
        .copy()
    )

    if not remaining_duplicate_rows.empty:
        remaining_duplicate_rows.to_csv(
            unresolved_output_path,
            index=False,
        )

        raise RuntimeError(
            "Point-in-time collision repair still left "
            f"{len(remaining_duplicate_rows)} duplicate rows. "
            f"Review {collision_output_path.name} and "
            f"{unresolved_output_path.name}."
        )

    resolved_df.to_csv(
        output_path,
        index=False,
    )

    changed_df = (
        resolved_df[
            resolved_df[
                "resolution_status"
            ].isin(
                [
                    "changed",
                    "collision_repaired",
                ]
            )
        ]
        .copy()
    )

    changed_df.to_csv(
        changes_output_path,
        index=False,
    )

    unresolved_df = pd.DataFrame(
        unresolved_rows
    )

    unresolved_df.to_csv(
        unresolved_output_path,
        index=False,
    )

    month_counts_before = (
        membership_df
        .groupby("snapshot_date")
        .size()
    )

    month_counts_after = (
        resolved_df
        .groupby("snapshot_date")
        .size()
    )

    if not (
        month_counts_before.values
        == month_counts_after.values
    ).all():
        raise RuntimeError(
            "Monthly row counts changed during ticker resolution."
        )

    print()
    print("=" * 76)
    print("TICKER RESOLUTION COMPLETE")
    print("=" * 76)

    print(
        f"Membership rows          : "
        f"{len(resolved_df)}"
    )

    print(
        f"Ticker replacements      : "
        f"{len(changed_df)}"
    )

    print(
        f"Unresolved rows          : "
        f"{len(unresolved_df)}"
    )

    print(
        f"Resolved membership      : "
        f"{output_path}"
    )

    print(
        f"Changed ticker rows      : "
        f"{changes_output_path}"
    )

    print(
        f"Unresolved report        : "
        f"{unresolved_output_path}"
    )

    print(
        f"Collision audit          : "
        f"{collision_output_path}"
    )

    print(
        f"Polygon cache            : "
        f"{cache_path}"
    )

    if not changed_df.empty:
        print()
        print("Sample ticker replacements:")

        sample = (
            changed_df[
                [
                    "snapshot_date",
                    "source_ticker",
                    "ticker",
                    "security",
                ]
            ]
            .drop_duplicates()
            .head(30)
        )

        print(
            sample.to_string(
                index=False
            )
        )

    print()

    if len(unresolved_df):
        print(
            "STOP: unresolved ticker rows remain. "
            "Send the terminal output and unresolved CSV "
            "before calculating historical market caps."
        )
    else:
        print(
            "PASS: every monthly membership row has a "
            "point-in-time ticker resolution."
        )

    return 0


if __name__ == "__main__":
    raise SystemExit(main())