#!/usr/bin/env python3
"""
Pull the current S&P 500 constituent snapshot and the public constituent-change
history from Wikipedia.

Outputs:
    sp500_constituents_snapshot.csv
    sp500_changes_history.csv

Usage:
    python pull_sp500_history.py

Optional:
    python pull_sp500_history.py --output-dir data
"""

from __future__ import annotations

import argparse
from io import StringIO
from pathlib import Path
import sys

import pandas as pd
import requests


CURRENT_COMPONENTS_URL = (
    "https://en.wikipedia.org/wiki/List_of_S%26P_500_companies"
)

HISTORICAL_COMPONENTS_URL = (
    "https://en.wikipedia.org/wiki/Historical_components_of_the_S%26P_500"
)

HEADERS = {
    "User-Agent": (
        "BullionaireIQ/1.0 "
        "(historical S&P 500 research; contact: info@bullionaireiq.com)"
    )
}


def flatten_columns(df: pd.DataFrame) -> pd.DataFrame:
    """Flatten pandas MultiIndex columns created by HTML tables."""
    out = df.copy()

    if isinstance(out.columns, pd.MultiIndex):
        flattened = []

        for col in out.columns:
            parts = []

            for part in col:
                text = str(part).strip()

                if not text or text.startswith("Unnamed:"):
                    continue

                if not parts or parts[-1] != text:
                    parts.append(text)

            flattened.append("_".join(parts))

        out.columns = flattened

    else:
        out.columns = [str(col).strip() for col in out.columns]

    return out


def normalize_symbol(value) -> str:
    if pd.isna(value):
        return ""

    symbol = str(value).strip().upper()
    symbol = symbol.replace("\xa0", "")
    return symbol


def fetch_page_tables(url: str) -> list[pd.DataFrame]:
    response = requests.get(
        url,
        headers=HEADERS,
        timeout=30,
    )
    response.raise_for_status()

    return pd.read_html(StringIO(response.text))


def find_constituent_table(tables: list[pd.DataFrame]) -> pd.DataFrame:
    required = {
        "Symbol",
        "Security",
        "GICS Sector",
        "GICS Sub-Industry",
    }

    for raw in tables:
        df = flatten_columns(raw)

        if required.issubset(set(df.columns)):
            return df.copy()

    raise RuntimeError(
        "Could not locate the current S&P 500 constituent table."
    )


def find_changes_table(tables: list[pd.DataFrame]) -> pd.DataFrame:
    """
    Locate the historical additions/removals table.
    Expected flattened columns are typically similar to:
        Effective Date
        Added_Ticker
        Added_Security
        Removed_Ticker
        Removed_Security
        Reason
        Refs
    """

    for raw in tables:
        df = flatten_columns(raw)

        normalized = {
            str(col).strip().lower().replace(" ", "_"): col
            for col in df.columns
        }

        keys = set(normalized)

        has_date = any(
            key in {"date", "effective_date"}
            or "effective_date" in key
            for key in keys
        )

        has_added = any(
            "added" in key and "ticker" in key
            for key in keys
        )

        has_removed = any(
            "removed" in key and "ticker" in key
            for key in keys
        )

        if has_date and has_added and has_removed:
            return df.copy()

    # Helpful debug output if Wikipedia changes again.
    available = []

    for i, raw in enumerate(tables):
        df = flatten_columns(raw)
        available.append(
            f"table {i}: {list(df.columns)}"
        )

    raise RuntimeError(
        "Could not locate the S&P 500 changes table.\n"
        + "\n".join(available[:10])
    )


def first_matching_column(
    df: pd.DataFrame,
    *needles: str,
) -> str | None:
    for col in df.columns:
        lower = str(col).lower()

        if all(
            needle.lower() in lower
            for needle in needles
        ):
            return col

    return None


def clean_constituents(df: pd.DataFrame) -> pd.DataFrame:
    preferred_columns = [
        "Symbol",
        "Security",
        "GICS Sector",
        "GICS Sub-Industry",
        "Headquarters Location",
        "Date added",
        "CIK",
        "Founded",
    ]

    existing = [
        col
        for col in preferred_columns
        if col in df.columns
    ]

    out = df[existing].copy()

    out["Symbol"] = out["Symbol"].map(
        normalize_symbol
    )

    out["Security"] = (
        out["Security"]
        .astype(str)
        .str.strip()
    )

    if "CIK" in out.columns:

        def clean_cik(value):
            if pd.isna(value):
                return ""

            text = str(value).strip()

            if text.endswith(".0"):
                text = text[:-2]

            digits = "".join(
                ch
                for ch in text
                if ch.isdigit()
            )

            return (
                digits.zfill(10)
                if digits
                else ""
            )

        out["CIK"] = out["CIK"].map(
            clean_cik
        )

    if "Date added" in out.columns:
        parsed = pd.to_datetime(
            out["Date added"],
            errors="coerce",
        )

        out["Date added"] = (
            parsed.dt.strftime("%Y-%m-%d")
        )

        out["Date added"] = (
            out["Date added"]
            .fillna("")
        )

    out = (
        out[
            out["Symbol"].ne("")
        ]
        .drop_duplicates(
            subset=["Symbol"],
            keep="last",
        )
        .sort_values("Symbol")
        .reset_index(drop=True)
    )

    # The S&P 500 currently contains 503 securities
    # representing 500 companies because some companies
    # have multiple share classes.
    if not 495 <= len(out) <= 510:
        raise RuntimeError(
            f"Unexpected constituent count: {len(out)}. "
            "Refusing to write a possibly broken snapshot."
        )

    return out


def clean_changes(df: pd.DataFrame) -> pd.DataFrame:

    date_col = (
        first_matching_column(
            df,
            "effective",
            "date",
        )
        or first_matching_column(
            df,
            "date",
        )
    )

    added_ticker_col = (
        first_matching_column(
            df,
            "added",
            "ticker",
        )
    )

    added_security_col = (
        first_matching_column(
            df,
            "added",
            "security",
        )
    )

    removed_ticker_col = (
        first_matching_column(
            df,
            "removed",
            "ticker",
        )
    )

    removed_security_col = (
        first_matching_column(
            df,
            "removed",
            "security",
        )
    )

    reason_col = first_matching_column(
        df,
        "reason",
    )

    required = {
        "date": date_col,
        "added_ticker": added_ticker_col,
        "removed_ticker": removed_ticker_col,
    }

    missing = [
        name
        for name, col in required.items()
        if col is None
    ]

    if missing:
        raise RuntimeError(
            "Changes table is missing expected columns: "
            + ", ".join(missing)
            + f"\nColumns found: {list(df.columns)}"
        )

    out = pd.DataFrame()

    out["date"] = df[date_col]

    out["added_ticker"] = (
        df[added_ticker_col]
    )

    out["added_security"] = (
        df[added_security_col]
        if added_security_col
        else ""
    )

    out["removed_ticker"] = (
        df[removed_ticker_col]
    )

    out["removed_security"] = (
        df[removed_security_col]
        if removed_security_col
        else ""
    )

    out["reason"] = (
        df[reason_col]
        if reason_col
        else ""
    )

    out["date"] = pd.to_datetime(
        out["date"],
        errors="coerce",
    )

    out = out[
        out["date"].notna()
    ].copy()

    out["date"] = (
        out["date"]
        .dt.strftime("%Y-%m-%d")
    )

    out["added_ticker"] = (
        out["added_ticker"]
        .map(normalize_symbol)
    )

    out["removed_ticker"] = (
        out["removed_ticker"]
        .map(normalize_symbol)
    )

    for col in (
        "added_security",
        "removed_security",
        "reason",
    ):
        out[col] = (
            out[col]
            .fillna("")
            .astype(str)
            .str.strip()
            .replace(
                {
                    "nan": "",
                    "None": "",
                }
            )
        )

    # Some legitimate index events have only an
    # addition or only a removal (for example spin-offs).
    out = out[
        out["added_ticker"].ne("")
        | out["removed_ticker"].ne("")
    ].copy()

    out = (
        out
        .drop_duplicates()
        .sort_values(
            [
                "date",
                "added_ticker",
                "removed_ticker",
            ],
            ascending=[
                False,
                True,
                True,
            ],
        )
        .reset_index(drop=True)
    )

    if out.empty:
        raise RuntimeError(
            "Historical changes table parsed but produced zero rows."
        )

    return out


def main() -> int:

    parser = argparse.ArgumentParser()

    parser.add_argument(
        "--output-dir",
        default=".",
        help=(
            "Directory in which to write the CSV files "
            "(default: current directory)."
        ),
    )

    args = parser.parse_args()

    output_dir = Path(
        args.output_dir
    ).resolve()

    output_dir.mkdir(
        parents=True,
        exist_ok=True,
    )

    constituent_path = (
        output_dir
        / "sp500_constituents_snapshot.csv"
    )

    changes_path = (
        output_dir
        / "sp500_changes_history.csv"
    )

    print(
        "Fetching current S&P 500 constituents from:"
    )
    print(
        f"  {CURRENT_COMPONENTS_URL}"
    )

    current_tables = fetch_page_tables(
        CURRENT_COMPONENTS_URL
    )

    print()
    print(
        "Fetching historical S&P 500 changes from:"
    )
    print(
        f"  {HISTORICAL_COMPONENTS_URL}"
    )

    historical_tables = fetch_page_tables(
        HISTORICAL_COMPONENTS_URL
    )

    constituents_raw = (
        find_constituent_table(
            current_tables
        )
    )

    changes_raw = (
        find_changes_table(
            historical_tables
        )
    )

    constituents = clean_constituents(
        constituents_raw
    )

    changes = clean_changes(
        changes_raw
    )

    constituents.to_csv(
        constituent_path,
        index=False,
    )

    changes.to_csv(
        changes_path,
        index=False,
    )

    print()
    print("=" * 70)
    print("SUCCESS")
    print("=" * 70)

    print(
        f"Current constituent rows : "
        f"{len(constituents)}"
    )

    print(
        f"Historical change rows   : "
        f"{len(changes)}"
    )

    print(
        f"Constituent snapshot     : "
        f"{constituent_path}"
    )

    print(
        f"Change history           : "
        f"{changes_path}"
    )

    if not changes.empty:
        print()
        print(
            "Newest recorded changes:"
        )

        print(
            changes
            .head(10)
            .to_string(index=False)
        )

    return 0


if __name__ == "__main__":

    try:
        raise SystemExit(
            main()
        )

    except requests.RequestException as exc:
        print(
            f"HTTP error: {exc}",
            file=sys.stderr,
        )
        raise SystemExit(1)

    except Exception as exc:
        print(
            f"ERROR: "
            f"{type(exc).__name__}: "
            f"{exc}",
            file=sys.stderr,
        )
        raise SystemExit(1)