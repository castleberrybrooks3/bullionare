#!/usr/bin/env python3
"""
Finalize the small set of verified S&P 500 point-in-time ticker/CIK overrides.

Input:
    sp500_monthly_membership_resolved.csv

Outputs:
    sp500_monthly_membership_final.csv
    sp500_ticker_manual_overrides.csv

This does NOT call Polygon, does NOT modify Supabase, and does NOT modify api.py.
"""

from __future__ import annotations

from pathlib import Path

import pandas as pd


INPUT_FILE = "sp500_monthly_membership_resolved.csv"
OUTPUT_FILE = "sp500_monthly_membership_final.csv"
AUDIT_FILE = "sp500_ticker_manual_overrides.csv"


def normalize_ticker(value) -> str:
    if pd.isna(value):
        return ""
    return str(value).strip().upper()


def normalize_cik(value) -> str:
    if pd.isna(value):
        return ""
    text = str(value).strip()
    digits = "".join(ch for ch in text if ch.isdigit())
    return digits.zfill(10) if digits else ""


def main() -> int:
    input_path = Path(INPUT_FILE).resolve()
    output_path = Path(OUTPUT_FILE).resolve()
    audit_path = Path(AUDIT_FILE).resolve()

    if not input_path.exists():
        raise RuntimeError(
            f"Missing input file: {input_path}"
        )

    df = pd.read_csv(
        input_path,
        dtype=str,
    ).fillna("")

    required = {
        "snapshot_date",
        "ticker",
        "source_ticker",
        "security",
        "resolution_status",
        "cik",
    }

    missing = required - set(df.columns)

    if missing:
        raise RuntimeError(
            f"{input_path.name} is missing columns: "
            f"{sorted(missing)}"
        )

    df["snapshot_date"] = pd.to_datetime(
        df["snapshot_date"],
        errors="coerce",
    )

    if df["snapshot_date"].isna().any():
        raise RuntimeError(
            "Invalid snapshot_date values found."
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

    audit_rows = []

    unresolved_before = (
        df["resolution_status"]
        .eq("unresolved")
    )

    before_count = int(
        unresolved_before.sum()
    )

    print(
        f"Unresolved rows before overrides: "
        f"{before_count}"
    )

    # ---------------------------------------------------------
    # 1) TWITTER
    #
    # Twitter remained TWTR until the Musk acquisition closed
    # on 2022-10-27.
    #
    # SEC CIK: 0001418091
    # ---------------------------------------------------------
    mask = (
        df["resolution_status"].eq("unresolved")
        & df["source_ticker"].eq("TWTR")
        & (
            df["snapshot_date"]
            <= pd.Timestamp("2022-10-31")
        )
    )

    for idx in df.index[mask]:
        audit_rows.append(
            {
                "snapshot_date": (
                    df.at[idx, "snapshot_date"]
                    .date()
                    .isoformat()
                ),
                "source_ticker": "TWTR",
                "final_ticker": "TWTR",
                "final_cik": "0001418091",
                "reason": (
                    "Verified historical Twitter ticker; "
                    "company remained TWTR through acquisition."
                ),
            }
        )

        df.at[idx, "ticker"] = "TWTR"
        df.at[idx, "cik"] = "0001418091"
        df.at[
            idx,
            "resolution_status",
        ] = "manual_verified"

        if "identity_key" in df.columns:
            df.at[
                idx,
                "identity_key",
            ] = "manual_cik:0001418091"

        if "polygon_name" in df.columns:
            df.at[
                idx,
                "polygon_name",
            ] = "Twitter, Inc."

    # ---------------------------------------------------------
    # 2) WILLIS TOWERS WATSON
    #
    # WLTW -> WTW became effective at market open
    # on 2022-01-10.
    #
    # SEC CIK: 0001140536
    # ---------------------------------------------------------
    mask = (
        df["resolution_status"].eq("unresolved")
        & df["source_ticker"].eq("WLTW")
        & (
            df["snapshot_date"]
            < pd.Timestamp("2022-01-10")
        )
    )

    for idx in df.index[mask]:
        audit_rows.append(
            {
                "snapshot_date": (
                    df.at[idx, "snapshot_date"]
                    .date()
                    .isoformat()
                ),
                "source_ticker": "WLTW",
                "final_ticker": "WLTW",
                "final_cik": "0001140536",
                "reason": (
                    "Verified historical ticker; WLTW changed "
                    "to WTW at market open on 2022-01-10."
                ),
            }
        )

        df.at[idx, "ticker"] = "WLTW"
        df.at[idx, "cik"] = "0001140536"
        df.at[
            idx,
            "resolution_status",
        ] = "manual_verified"

        if "identity_key" in df.columns:
            df.at[
                idx,
                "identity_key",
            ] = "manual_cik:0001140536"

        if "polygon_name" in df.columns:
            df.at[
                idx,
                "polygon_name",
            ] = "Willis Towers Watson Public Limited Company"

    # ---------------------------------------------------------
    # 3) BUNGE
    #
    # Ticker stayed BG across the 2023 redomestication.
    #
    # Before 2023-11-01:
    #   Bunge Limited
    #   CIK 0001144519
    #
    # On/after 2023-11-01:
    #   Bunge Global SA
    #   CIK 0001996862
    #
    # This point-in-time CIK split matters later when we pull
    # SEC historical share facts.
    # ---------------------------------------------------------
    mask = (
        df["resolution_status"].eq("unresolved")
        & df["source_ticker"].eq("BG")
    )

    for idx in df.index[mask]:
        snapshot = df.at[
            idx,
            "snapshot_date",
        ]

        if snapshot < pd.Timestamp(
            "2023-11-01"
        ):
            cik = "0001144519"
            company_name = "Bunge Limited"
            reason = (
                "BG ticker unchanged; pre-redomestication "
                "Bunge Limited SEC identity."
            )
        else:
            cik = "0001996862"
            company_name = "Bunge Global SA"
            reason = (
                "BG ticker unchanged; post-redomestication "
                "Bunge Global SA SEC identity."
            )

        audit_rows.append(
            {
                "snapshot_date": (
                    snapshot
                    .date()
                    .isoformat()
                ),
                "source_ticker": "BG",
                "final_ticker": "BG",
                "final_cik": cik,
                "reason": reason,
            }
        )

        df.at[idx, "ticker"] = "BG"
        df.at[idx, "cik"] = cik
        df.at[
            idx,
            "resolution_status",
        ] = "manual_verified"

        if "identity_key" in df.columns:
            df.at[
                idx,
                "identity_key",
            ] = f"manual_cik:{cik}"

        if "polygon_name" in df.columns:
            df.at[
                idx,
                "polygon_name",
            ] = company_name

    # ---------------------------------------------------------
    # FINAL VALIDATION
    # ---------------------------------------------------------
    unresolved_after = df[
        df["resolution_status"]
        .eq("unresolved")
    ].copy()

    if not unresolved_after.empty:
        print()
        print(
            "Remaining unresolved rows:"
        )
        print(
            unresolved_after[
                [
                    "snapshot_date",
                    "source_ticker",
                    "security",
                ]
            ]
            .to_string(index=False)
        )

        raise RuntimeError(
            f"{len(unresolved_after)} unresolved rows remain. "
            "No final file was written."
        )

    duplicate_mask = df.duplicated(
        subset=[
            "snapshot_date",
            "ticker",
        ],
        keep=False,
    )

    duplicates = df[
        duplicate_mask
    ].copy()

    if not duplicates.empty:
        print()
        print(
            "Duplicate rows after manual overrides:"
        )
        print(
            duplicates[
                [
                    "snapshot_date",
                    "ticker",
                    "source_ticker",
                    "security",
                ]
            ]
            .to_string(index=False)
        )

        raise RuntimeError(
            f"{len(duplicates)} duplicate "
            "(snapshot_date, ticker) rows remain."
        )

    # Preserve ISO date text.
    df["snapshot_date"] = (
        df["snapshot_date"]
        .dt.strftime("%Y-%m-%d")
    )

    audit_df = pd.DataFrame(
        audit_rows
    )

    # Sanity check: based on the unresolved report supplied,
    # exactly 59 rows should be manually resolved.
    if len(audit_df) != before_count:
        raise RuntimeError(
            "Override count does not match unresolved count. "
            f"Before={before_count}, overridden={len(audit_df)}"
        )

    df.to_csv(
        output_path,
        index=False,
    )

    audit_df.to_csv(
        audit_path,
        index=False,
    )

    print()
    print("=" * 72)
    print("FINAL TICKER RESOLUTION PASS")
    print("=" * 72)
    print(
        f"Rows in final membership : "
        f"{len(df)}"
    )
    print(
        f"Manual overrides applied : "
        f"{len(audit_df)}"
    )
    print(
        "Unresolved rows remaining: 0"
    )
    print(
        f"Final membership         : "
        f"{output_path}"
    )
    print(
        f"Manual override audit    : "
        f"{audit_path}"
    )

    print()
    print("Overrides by ticker:")

    print(
        audit_df.groupby(
            "source_ticker"
        )
        .size()
        .rename("rows")
        .to_string()
    )

    return 0


if __name__ == "__main__":
    raise SystemExit(main())