#!/usr/bin/env python3
"""
Audit and correct point-in-time ticker + CIK identity for every monthly
S&P 500 membership security.

This is the final identity-cleanup step before historical market-cap ranking.

Input:
    sp500_monthly_membership_final.csv

Outputs:
    sp500_monthly_membership_pit.csv
    sp500_pit_identity_changes.csv
    sp500_pit_identity_unresolved.csv
    sp500_polygon_pit_reference_cache.json

Why this exists:
    A current ticker can be incorrectly projected backward in time even when
    index membership itself is correct. Examples include:
        FB   -> META
        ABC  -> COR
        FLT  -> CPAY
        NLOK -> GEN
        PEAK -> DOC
        BK   -> BNY
        MMC  -> MRSH

    The Polygon /v3/reference/tickers endpoint supports a historical `date`
    and returns the ticker, CIK and share-class FIGI valid at that point in time.

The script:
    * Resolves the actual point-in-time ticker.
    * Resolves the point-in-time SEC CIK.
    * Preserves multi-share-class identity where possible.
    * Flags whether the security was active/tradable on the snapshot date.
    * Uses a cache so reruns do not repeat completed Polygon requests.
    * Uses recursive interval sampling, so it does NOT make 30,000 API calls.
    * Includes two verified corporate-successor bridges where both ticker
      and legal registrant changed:
          WRK  -> SW   (Smurfit Westrock, July 2024)
          PARA -> PSKY (Paramount Skydance, August 2025)

It does NOT modify Supabase and does NOT modify api.py.
"""

from __future__ import annotations

import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
import json
import os
from pathlib import Path
import re
import threading
import time
from typing import Dict, List, Optional, Tuple

import pandas as pd
import requests


POLYGON_BASE_URL = "https://api.polygon.io"

CACHE_LOCK = threading.Lock()

EXPECTED_COLUMNS = [
    "snapshot_date",
    "ticker",
    "source_ticker",
    "security",
    "resolution_status",
    "identity_key",
    "cik",
    "polygon_name",
]


# Verified continuity bridges where the S&P index slot continued through a
# transaction but the successor security had BOTH a different ticker and a
# different SEC registrant/CIK.
#
# effective_date means the new security begins trading on/after that date.
SUCCESSOR_BRIDGES = {
    "SW": {
        "effective_date": "2024-07-08",
        "prior_ticker": "WRK",
        "prior_cik": "0001732845",
        "reason": (
            "Smurfit Westrock began NYSE trading as SW on 2024-07-08 "
            "after the WestRock/Smurfit Kappa combination."
        ),
    },
    "PSKY": {
        "effective_date": "2025-08-07",
        "prior_ticker": "PARA",
        "prior_cik": "0000813828",
        "reason": (
            "Paramount Skydance Class B began trading as PSKY on 2025-08-07 "
            "following the Paramount/Skydance transaction."
        ),
    },
}


def normalize_ticker(value) -> str:
    if pd.isna(value):
        return ""

    text = str(value).upper().replace("\xa0", " ").strip()

    match = re.search(
        r"[A-Z0-9]+(?:[.\-][A-Z0-9]+)*",
        text,
    )

    return match.group(0) if match else ""


def normalize_cik(value) -> str:
    if pd.isna(value):
        return ""

    text = str(value).strip()

    if text.endswith(".0"):
        text = text[:-2]

    digits = "".join(
        ch for ch in text
        if ch.isdigit()
    )

    return digits.zfill(10) if digits else ""


def extract_share_class_figi(identity_key) -> str:
    text = str(identity_key or "").strip()

    if text.startswith("share_class_figi:"):
        return text.split(":", 1)[1].strip()

    return ""


def load_api_key() -> str:
    key = os.getenv(
        "POLYGON_API_KEY",
        "",
    ).strip()

    if key:
        return key

    candidates = [
        Path.cwd() / ".env",
        Path(__file__).resolve().parent / ".env",
    ]

    seen = set()

    for path in candidates:
        path = path.resolve()

        if path in seen or not path.exists():
            continue

        seen.add(path)

        try:
            text = path.read_text(
                encoding="utf-8",
                errors="ignore",
            )
        except Exception:
            continue

        match = re.search(
            r"(?m)^\s*POLYGON_API_KEY\s*=\s*['\"]?([^'\"\r\n#]+)",
            text,
        )

        if match:
            key = match.group(1).strip()

            if key:
                return key

    raise RuntimeError(
        "POLYGON_API_KEY was not found in the environment or local .env."
    )


def load_membership(path: Path) -> pd.DataFrame:
    df = pd.read_csv(
        path,
        dtype=str,
    ).fillna("")

    # Tolerate a headerless CSV copy.
    if "snapshot_date" not in df.columns:
        df = pd.read_csv(
            path,
            dtype=str,
            header=None,
            names=EXPECTED_COLUMNS,
        ).fillna("")

    required = {
        "snapshot_date",
        "ticker",
        "source_ticker",
        "security",
        "resolution_status",
        "identity_key",
        "cik",
    }

    missing = required - set(df.columns)

    if missing:
        raise RuntimeError(
            f"{path.name} is missing columns: {sorted(missing)}"
        )

    if "polygon_name" not in df.columns:
        df["polygon_name"] = ""

    df["snapshot_date"] = pd.to_datetime(
        df["snapshot_date"],
        errors="coerce",
    )

    if df["snapshot_date"].isna().any():
        bad = df[
            df["snapshot_date"].isna()
        ].head(10)

        raise RuntimeError(
            "Invalid snapshot dates found:\n"
            + bad.to_string(index=False)
        )

    df["ticker"] = df["ticker"].map(
        normalize_ticker
    )

    df["source_ticker"] = (
        df["source_ticker"]
        .map(normalize_ticker)
    )

    df["cik"] = df["cik"].map(
        normalize_cik
    )

    duplicate_count = int(
        df.duplicated(
            subset=[
                "snapshot_date",
                "ticker",
            ]
        ).sum()
    )

    if duplicate_count:
        raise RuntimeError(
            f"Input contains {duplicate_count} duplicate "
            "(snapshot_date, ticker) rows."
        )

    return (
        df.sort_values(
            [
                "source_ticker",
                "security",
                "snapshot_date",
            ]
        )
        .reset_index(drop=True)
    )


def load_cache(path: Path) -> dict:
    if not path.exists():
        return {
            "requests": {},
        }

    try:
        data = json.loads(
            path.read_text(
                encoding="utf-8",
            )
        )
    except Exception:
        return {
            "requests": {},
        }

    data.setdefault(
        "requests",
        {},
    )

    return data


def save_cache(
    path: Path,
    cache: dict,
) -> None:
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
    params: dict,
    attempts: int = 6,
) -> Optional[dict]:
    url = (
        f"{POLYGON_BASE_URL}"
        "/v3/reference/tickers"
    )

    request_params = dict(params)
    request_params["apiKey"] = api_key

    last_error = None

    for attempt in range(attempts):
        try:
            response = session.get(
                url,
                params=request_params,
                timeout=30,
            )

            if response.status_code == 429:
                time.sleep(
                    min(
                        10,
                        1.0 * (2 ** attempt),
                    )
                )
                continue

            if response.status_code in {
                400,
                404,
                422,
            }:
                return None

            response.raise_for_status()

            return response.json()

        except requests.RequestException as exc:
            last_error = exc

            if attempt < attempts - 1:
                time.sleep(
                    min(
                        10,
                        1.0 * (2 ** attempt),
                    )
                )

    if last_error:
        raise last_error

    return None


def cached_reference_query(
    session: requests.Session,
    api_key: str,
    cache: dict,
    cache_path: Path,
    *,
    date_text: str,
    ticker: str = "",
    cik: str = "",
    active: bool = True,
) -> List[dict]:
    ticker = normalize_ticker(
        ticker
    )

    cik = normalize_cik(
        cik
    )

    if not ticker and not cik:
        return []

    cache_key = "|".join(
        [
            date_text,
            ticker,
            cik,
            "active" if active else "inactive",
        ]
    )

    with CACHE_LOCK:
        if cache_key in cache["requests"]:
            return (
                cache["requests"][
                    cache_key
                ]
                or []
            )

    params = {
        "date": date_text,
        "market": "stocks",
        "active": (
            "true"
            if active
            else "false"
        ),
        "limit": 100,
        "order": "asc",
        "sort": "ticker",
    }

    if ticker:
        params["ticker"] = ticker

    if cik:
        params["cik"] = cik

    data = polygon_get(
        session=session,
        api_key=api_key,
        params=params,
    )

    results = (
        (data or {}).get("results")
        or []
    )

    with CACHE_LOCK:
        cache["requests"][
            cache_key
        ] = results

        request_count = len(
            cache["requests"]
        )

    # Periodic disk checkpoint.
    if (
        request_count % 100 == 0
    ):
        save_cache(
            cache_path,
            cache,
        )

    return results


def candidate_signature(
    candidate: Optional[dict],
) -> Optional[Tuple[str, str, str, bool]]:
    if not candidate:
        return None

    return (
        normalize_ticker(
            candidate.get("ticker")
        ),
        normalize_cik(
            candidate.get("cik")
        ),
        str(
            candidate.get(
                "share_class_figi"
            )
            or ""
        ).strip(),
        bool(
            candidate.get(
                "_tradable_at_snapshot"
            )
        ),
    )


def choose_candidate(
    results: List[dict],
    *,
    target_figi: str = "",
    target_cik: str = "",
    preferred_tickers: Optional[List[str]] = None,
) -> Optional[dict]:
    if not results:
        return None

    preferred_tickers = [
        normalize_ticker(x)
        for x in (
            preferred_tickers or []
        )
        if normalize_ticker(x)
    ]

    if target_figi:
        matches = [
            row
            for row in results
            if str(
                row.get(
                    "share_class_figi"
                )
                or ""
            ).strip()
            == target_figi
        ]

        if len(matches) == 1:
            return matches[0]

    for preferred in preferred_tickers:
        matches = [
            row
            for row in results
            if normalize_ticker(
                row.get("ticker")
            )
            == preferred
        ]

        if len(matches) == 1:
            return matches[0]

    clean_target_cik = normalize_cik(
        target_cik
    )

    if clean_target_cik:
        matches = [
            row
            for row in results
            if normalize_cik(
                row.get("cik")
            )
            == clean_target_cik
        ]

        if len(matches) == 1:
            return matches[0]

    if len(results) == 1:
        return results[0]

    return None


def bridge_for_row(
    row: pd.Series,
) -> Optional[dict]:
    source = normalize_ticker(
        row.get("source_ticker")
    )

    bridge = SUCCESSOR_BRIDGES.get(
        source
    )

    if not bridge:
        return None

    snapshot = pd.Timestamp(
        row["snapshot_date"]
    ).normalize()

    effective = pd.Timestamp(
        bridge["effective_date"]
    ).normalize()

    if snapshot >= effective:
        return None

    return bridge


def resolve_one_row(
    row: pd.Series,
    api_key: str,
    cache: dict,
    cache_path: Path,
) -> Optional[dict]:
    snapshot = pd.Timestamp(
        row["snapshot_date"]
    ).normalize()

    date_text = (
        snapshot
        .date()
        .isoformat()
    )

    existing_ticker = normalize_ticker(
        row.get("ticker")
    )

    source_ticker = normalize_ticker(
        row.get("source_ticker")
    )

    current_cik = normalize_cik(
        row.get("cik")
    )

    target_figi = extract_share_class_figi(
        row.get("identity_key")
    )

    session = requests.Session()

    try:
        # -----------------------------------------------------
        # 1) Exact ticker lookup as of the snapshot date.
        #
        # If the symbol stayed the same but the legal registrant
        # changed (e.g. a holding-company reorganization), this
        # gives us the correct historical CIK.
        # -----------------------------------------------------
        for ticker in dict.fromkeys(
            [
                existing_ticker,
                source_ticker,
            ]
        ):
            if not ticker:
                continue

            results = cached_reference_query(
                session=session,
                api_key=api_key,
                cache=cache,
                cache_path=cache_path,
                date_text=date_text,
                ticker=ticker,
                active=True,
            )

            chosen = choose_candidate(
                results,
                target_figi=target_figi,
                target_cik=current_cik,
                preferred_tickers=[
                    ticker,
                ],
            )

            if chosen:
                chosen = dict(
                    chosen
                )

                chosen[
                    "_resolution_method"
                ] = (
                    "active_ticker_date"
                )

                chosen[
                    "_tradable_at_snapshot"
                ] = True

                return chosen

        # -----------------------------------------------------
        # 2) CIK lookup as of the snapshot date.
        #
        # This catches normal ticker-only changes where the SEC
        # registrant stayed the same:
        # FB->META, ABC->COR, FLT->CPAY, NLOK->GEN, etc.
        # -----------------------------------------------------
        if current_cik:
            results = cached_reference_query(
                session=session,
                api_key=api_key,
                cache=cache,
                cache_path=cache_path,
                date_text=date_text,
                cik=current_cik,
                active=True,
            )

            chosen = choose_candidate(
                results,
                target_figi=target_figi,
                target_cik=current_cik,
                preferred_tickers=[
                    existing_ticker,
                    source_ticker,
                ],
            )

            if chosen:
                chosen = dict(
                    chosen
                )

                chosen[
                    "_resolution_method"
                ] = (
                    "active_cik_date"
                )

                chosen[
                    "_tradable_at_snapshot"
                ] = True

                return chosen

        # -----------------------------------------------------
        # 3) Verified corporate-successor bridge.
        #
        # Used only when BOTH ticker and CIK changed.
        # -----------------------------------------------------
        bridge = bridge_for_row(
            row
        )

        if bridge:
            bridge_ticker = normalize_ticker(
                bridge["prior_ticker"]
            )

            bridge_cik = normalize_cik(
                bridge["prior_cik"]
            )

            results = cached_reference_query(
                session=session,
                api_key=api_key,
                cache=cache,
                cache_path=cache_path,
                date_text=date_text,
                ticker=bridge_ticker,
                active=True,
            )

            chosen = choose_candidate(
                results,
                target_cik=bridge_cik,
                preferred_tickers=[
                    bridge_ticker,
                ],
            )

            if chosen:
                chosen = dict(
                    chosen
                )

                chosen[
                    "_resolution_method"
                ] = (
                    "verified_successor_bridge"
                )

                chosen[
                    "_tradable_at_snapshot"
                ] = True

                chosen[
                    "_bridge_reason"
                ] = bridge["reason"]

                return chosen

        # -----------------------------------------------------
        # 4) Inactive/delisted exact ticker fallback.
        #
        # This preserves cases where the S&P change date lags the
        # final tradable date. These rows remain valid membership
        # history, but later ranking code must NOT select them when
        # there is no usable market price.
        # -----------------------------------------------------
        for ticker in dict.fromkeys(
            [
                existing_ticker,
                source_ticker,
            ]
        ):
            if not ticker:
                continue

            results = cached_reference_query(
                session=session,
                api_key=api_key,
                cache=cache,
                cache_path=cache_path,
                date_text=date_text,
                ticker=ticker,
                active=False,
            )

            chosen = choose_candidate(
                results,
                target_figi=target_figi,
                target_cik=current_cik,
                preferred_tickers=[
                    ticker,
                ],
            )

            if chosen:
                chosen = dict(
                    chosen
                )

                chosen[
                    "_resolution_method"
                ] = (
                    "inactive_ticker_date"
                )

                chosen[
                    "_tradable_at_snapshot"
                ] = False

                return chosen

        return None

    finally:
        session.close()


def logical_group_key(
    row: pd.Series,
) -> str:
    source = normalize_ticker(
        row.get("source_ticker")
    )

    security = str(
        row.get("security")
        or ""
    ).strip()

    return (
        f"{source}|{security}"
    )


def audit_group(
    group_df: pd.DataFrame,
    api_key: str,
    cache: dict,
    cache_path: Path,
) -> Tuple[Dict[int, Optional[dict]], int]:
    """
    Resolve only enough dates to identify stable historical identity segments.

    Ticker/CIK changes are monotonic corporate events. We therefore sample
    endpoints + midpoint. If all three resolve to the same identity, the whole
    interval can safely use that identity. When they differ, recurse.

    This reduces ~30,000 row lookups to a few thousand API/cache lookups.
    """
    rows = (
        group_df
        .sort_values(
            "snapshot_date"
        )
    )

    indices = list(
        rows.index
    )

    memo: Dict[
        int,
        Optional[dict],
    ] = {}

    output: Dict[
        int,
        Optional[dict],
    ] = {}

    direct_resolutions = 0

    def direct_resolve(
        pos: int,
    ) -> Optional[dict]:
        nonlocal direct_resolutions

        idx = indices[pos]

        if idx in memo:
            return memo[idx]

        result = resolve_one_row(
            rows.loc[idx],
            api_key=api_key,
            cache=cache,
            cache_path=cache_path,
        )

        memo[idx] = result
        direct_resolutions += 1

        return result

    def fill_segment(
        lo: int,
        hi: int,
        result: dict,
    ) -> None:
        for pos in range(
            lo,
            hi + 1,
        ):
            idx = indices[pos]

            filled = dict(
                result
            )

            if idx not in memo:
                filled[
                    "_resolution_method"
                ] = (
                    "stable_segment_fill:"
                    + str(
                        result.get(
                            "_resolution_method"
                        )
                        or ""
                    )
                )

            output[idx] = filled

    def recurse(
        lo: int,
        hi: int,
    ) -> None:
        if lo > hi:
            return

        if lo == hi:
            idx = indices[lo]
            output[idx] = (
                direct_resolve(
                    lo
                )
            )
            return

        mid = (
            lo + hi
        ) // 2

        sample_positions = {
            lo,
            mid,
            hi,
        }

        # On long intervals, also sample quarter points. This gives
        # extra protection against any unusual identity changes.
        if hi - lo >= 8:
            sample_positions.add(
                lo + (
                    hi - lo
                ) // 4
            )

            sample_positions.add(
                lo + 3 * (
                    hi - lo
                ) // 4
            )

        sample_positions = sorted(
            sample_positions
        )

        sample_results = [
            direct_resolve(
                pos
            )
            for pos in sample_positions
        ]

        signatures = [
            candidate_signature(
                result
            )
            for result in sample_results
        ]

        if (
            all(
                sig is not None
                for sig in signatures
            )
            and len(
                set(signatures)
            )
            == 1
        ):
            fill_segment(
                lo,
                hi,
                sample_results[0],
            )
            return

        if hi - lo == 1:
            for pos in (
                lo,
                hi,
            ):
                idx = indices[pos]
                output[idx] = (
                    direct_resolve(
                        pos
                    )
                )
            return

        recurse(
            lo,
            mid,
        )

        recurse(
            mid + 1,
            hi,
        )

    recurse(
        0,
        len(indices) - 1,
    )

    return (
        output,
        direct_resolutions,
    )


def audit_group_worker(
    group_key: str,
    group_df: pd.DataFrame,
    api_key: str,
    cache: dict,
    cache_path: Path,
):
    resolved, direct_count = audit_group(
        group_df=group_df,
        api_key=api_key,
        cache=cache,
        cache_path=cache_path,
    )

    return (
        group_key,
        resolved,
        direct_count,
    )


def main() -> int:
    parser = argparse.ArgumentParser()

    parser.add_argument(
        "--input",
        default=(
            "sp500_monthly_membership_final.csv"
        ),
    )

    parser.add_argument(
        "--output",
        default=(
            "sp500_monthly_membership_pit.csv"
        ),
    )

    parser.add_argument(
        "--changes-output",
        default=(
            "sp500_pit_identity_changes.csv"
        ),
    )

    parser.add_argument(
        "--unresolved-output",
        default=(
            "sp500_pit_identity_unresolved.csv"
        ),
    )

    parser.add_argument(
        "--cache",
        default=(
            "sp500_polygon_pit_reference_cache.json"
        ),
    )

    parser.add_argument(
        "--workers",
        type=int,
        default=8,
    )

    args = parser.parse_args()

    input_path = Path(
        args.input
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

    cache_path = Path(
        args.cache
    ).resolve()

    if not input_path.exists():
        raise RuntimeError(
            f"Missing input file: {input_path}"
        )

    api_key = load_api_key()

    df = load_membership(
        input_path
    )

    df["_group_key"] = df.apply(
        logical_group_key,
        axis=1,
    )

    cache = load_cache(
        cache_path
    )

    grouped = [
        (
            group_key,
            group_df.copy(),
        )
        for group_key, group_df
        in df.groupby(
            "_group_key",
            sort=True,
        )
    ]

    print(
        "Membership window         : "
        f"{df['snapshot_date'].min().date()} "
        f"through "
        f"{df['snapshot_date'].max().date()}"
    )

    print(
        f"Membership rows           : "
        f"{len(df)}"
    )

    print(
        f"Logical security groups   : "
        f"{len(grouped)}"
    )

    workers = max(
        1,
        min(
            int(args.workers),
            12,
        ),
    )

    all_results: Dict[
        int,
        Optional[dict],
    ] = {}

    total_direct = 0
    completed = 0
    failed_groups = 0

    with ThreadPoolExecutor(
        max_workers=workers
    ) as executor:
        futures = {
            executor.submit(
                audit_group_worker,
                group_key,
                group_df,
                api_key,
                cache,
                cache_path,
            ): group_key
            for (
                group_key,
                group_df,
            )
            in grouped
        }

        for future in as_completed(
            futures
        ):
            group_key = futures[
                future
            ]

            try:
                (
                    _,
                    resolved,
                    direct_count,
                ) = future.result()

                all_results.update(
                    resolved
                )

                total_direct += (
                    direct_count
                )

            except Exception as exc:
                failed_groups += 1

                print(
                    "[WARN] Group failed: "
                    f"{group_key}: "
                    f"{type(exc).__name__}: "
                    f"{exc}"
                )

            completed += 1

            if (
                completed % 50 == 0
                or completed
                == len(grouped)
            ):
                save_cache(
                    cache_path,
                    cache,
                )

                print(
                    f"Audited groups: "
                    f"{completed}/"
                    f"{len(grouped)}"
                    f" | failed="
                    f"{failed_groups}"
                    f" | direct date "
                    f"resolutions="
                    f"{total_direct}"
                )

    save_cache(
        cache_path,
        cache,
    )

    output_rows = []
    unresolved_rows = []
    change_rows = []

    for idx, row in df.iterrows():
        result = all_results.get(
            idx
        )

        original_ticker = (
            normalize_ticker(
                row["ticker"]
            )
        )

        original_cik = (
            normalize_cik(
                row["cik"]
            )
        )

        snapshot_text = (
            row["snapshot_date"]
            .date()
            .isoformat()
        )

        if not result:
            unresolved_rows.append(
                {
                    "snapshot_date": (
                        snapshot_text
                    ),
                    "ticker": (
                        original_ticker
                    ),
                    "source_ticker": (
                        row["source_ticker"]
                    ),
                    "security": (
                        row["security"]
                    ),
                    "cik": (
                        original_cik
                    ),
                    "identity_key": (
                        row["identity_key"]
                    ),
                }
            )

            final_ticker = (
                original_ticker
            )

            final_cik = (
                original_cik
            )

            final_figi = (
                extract_share_class_figi(
                    row["identity_key"]
                )
            )

            method = "unresolved"
            tradable = ""

            polygon_name = (
                row["polygon_name"]
            )

        else:
            final_ticker = (
                normalize_ticker(
                    result.get("ticker")
                )
            )

            final_cik = (
                normalize_cik(
                    result.get("cik")
                )
            )

            final_figi = str(
                result.get(
                    "share_class_figi"
                )
                or ""
            ).strip()

            method = str(
                result.get(
                    "_resolution_method"
                )
                or ""
            )

            tradable = bool(
                result.get(
                    "_tradable_at_snapshot"
                )
            )

            polygon_name = str(
                result.get("name")
                or row[
                    "polygon_name"
                ]
                or ""
            ).strip()

        output_rows.append(
            {
                "snapshot_date": (
                    snapshot_text
                ),
                "ticker": (
                    final_ticker
                ),
                "source_ticker": (
                    row[
                        "source_ticker"
                    ]
                ),
                "security": (
                    row["security"]
                ),
                "cik": (
                    final_cik
                ),
                "share_class_figi": (
                    final_figi
                ),
                "tradable_at_snapshot": (
                    tradable
                ),
                "pit_resolution_method": (
                    method
                ),
                "polygon_name": (
                    polygon_name
                ),
                "original_ticker": (
                    original_ticker
                ),
                "original_cik": (
                    original_cik
                ),
            }
        )

        if (
            final_ticker
            != original_ticker
            or final_cik
            != original_cik
        ):
            change_rows.append(
                {
                    "snapshot_date": (
                        snapshot_text
                    ),
                    "security": (
                        row["security"]
                    ),
                    "original_ticker": (
                        original_ticker
                    ),
                    "final_ticker": (
                        final_ticker
                    ),
                    "original_cik": (
                        original_cik
                    ),
                    "final_cik": (
                        final_cik
                    ),
                    "method": method,
                }
            )

    output_df = pd.DataFrame(
        output_rows
    )

    changes_df = pd.DataFrame(
        change_rows
    )

    unresolved_df = pd.DataFrame(
        unresolved_rows
    )

    # Final structural checks.
    duplicate_mask = (
        output_df.duplicated(
            subset=[
                "snapshot_date",
                "ticker",
            ],
            keep=False,
        )
    )

    duplicates = output_df[
        duplicate_mask
    ].copy()

    if not duplicates.empty:
        duplicate_path = (
            unresolved_output_path
            .with_name(
                "sp500_pit_identity_duplicates.csv"
            )
        )

        duplicates.to_csv(
            duplicate_path,
            index=False,
        )

        raise RuntimeError(
            "Point-in-time audit created duplicate "
            "(snapshot_date, ticker) rows. "
            f"Review {duplicate_path.name}."
        )

    output_df.to_csv(
        output_path,
        index=False,
    )

    changes_df.to_csv(
        changes_output_path,
        index=False,
    )

    unresolved_df.to_csv(
        unresolved_output_path,
        index=False,
    )

    print()
    print("=" * 78)
    print(
        "POINT-IN-TIME IDENTITY AUDIT COMPLETE"
    )
    print("=" * 78)

    print(
        f"Rows written             : "
        f"{len(output_df)}"
    )

    print(
        f"Ticker/CIK corrections   : "
        f"{len(changes_df)}"
    )

    print(
        f"Unresolved rows          : "
        f"{len(unresolved_df)}"
    )

    print(
        f"Direct date resolutions  : "
        f"{total_direct}"
    )

    print(
        f"Final PIT membership     : "
        f"{output_path}"
    )

    print(
        f"Correction audit         : "
        f"{changes_output_path}"
    )

    print(
        f"Unresolved audit         : "
        f"{unresolved_output_path}"
    )

    print(
        f"Polygon reference cache  : "
        f"{cache_path}"
    )

    if not changes_df.empty:
        print()
        print(
            "Sample point-in-time corrections:"
        )

        print(
            changes_df[
                [
                    "snapshot_date",
                    "original_ticker",
                    "final_ticker",
                    "original_cik",
                    "final_cik",
                    "security",
                ]
            ]
            .drop_duplicates()
            .head(40)
            .to_string(index=False)
        )

    if not unresolved_df.empty:
        print()
        print(
            "STOP: unresolved point-in-time identities remain."
        )
        print(
            "Send sp500_pit_identity_unresolved.csv "
            "before market-cap ranking."
        )
    else:
        print()
        print(
            "PASS: all monthly rows have point-in-time ticker/CIK identity."
        )
        print(
            "Next step: historical price + SEC shares -> market-cap ranks."
        )

    return 0


if __name__ == "__main__":
    raise SystemExit(main())