#!/usr/bin/env python3
"""
Patch the final four unresolved Paramount historical identity rows.

Input:
    sp500_monthly_membership_pit.csv

Outputs:
    sp500_monthly_membership_pit_final.csv
    sp500_pit_paramount_patch_audit.csv

Verified history:
    ViacomCBS / Paramount Class B traded as VIAC before 2022-02-17.
    Beginning at market open 2022-02-17, Class B traded as PARA.
    SEC CIK remained 0000813828.

This script does not call Polygon and does not modify Supabase or api.py.
"""

from pathlib import Path
import pandas as pd


INPUT_FILE = "sp500_monthly_membership_pit.csv"
OUTPUT_FILE = "sp500_monthly_membership_pit_final.csv"
AUDIT_FILE = "sp500_pit_paramount_patch_audit.csv"


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
        "cik",
        "share_class_figi",
        "pit_resolution_method",
    }

    missing = required - set(df.columns)

    if missing:
        raise RuntimeError(
            f"{input_path.name} is missing columns: {sorted(missing)}"
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

    unresolved_before = (
        df["pit_resolution_method"]
        .eq("unresolved")
    )

    before_count = int(
        unresolved_before.sum()
    )

    print(
        f"Unresolved PIT rows before patch: {before_count}"
    )

    target_mask = (
        df["pit_resolution_method"].eq("unresolved")
        & df["source_ticker"].eq("PSKY")
        & (
            df["snapshot_date"]
            < pd.Timestamp("2022-02-17")
        )
    )

    target_count = int(
        target_mask.sum()
    )

    if target_count != 4:
        raise RuntimeError(
            "Expected exactly 4 unresolved pre-2022-02-17 PSKY rows, "
            f"found {target_count}. No output written."
        )

    audit_rows = []

    for idx in df.index[target_mask]:
        snapshot = df.at[
            idx,
            "snapshot_date",
        ]

        audit_rows.append(
            {
                "snapshot_date": snapshot.date().isoformat(),
                "original_ticker": df.at[idx, "ticker"],
                "final_ticker": "VIAC",
                "original_cik": df.at[idx, "cik"],
                "final_cik": "0000813828",
                "security": df.at[idx, "security"],
                "reason": (
                    "Verified Paramount/ViacomCBS Class B history: "
                    "VIAC before 2022-02-17; PARA beginning 2022-02-17."
                ),
            }
        )

        df.at[idx, "ticker"] = "VIAC"
        df.at[idx, "cik"] = "0000813828"

        # The PSKY FIGI belongs to the successor security and should not be
        # carried backward to the old VIAC security.
        df.at[idx, "share_class_figi"] = ""

        df.at[
            idx,
            "pit_resolution_method",
        ] = "manual_verified_viac"

        if "polygon_name" in df.columns:
            df.at[
                idx,
                "polygon_name",
            ] = "ViacomCBS Inc."

        if "tradable_at_snapshot" in df.columns:
            df.at[
                idx,
                "tradable_at_snapshot",
            ] = "True"

    unresolved_after = df[
        df["pit_resolution_method"]
        .eq("unresolved")
    ].copy()

    if not unresolved_after.empty:
        print()
        print(
            "Remaining unresolved PIT rows:"
        )
        print(
            unresolved_after[
                [
                    "snapshot_date",
                    "ticker",
                    "source_ticker",
                    "security",
                    "cik",
                ]
            ]
            .to_string(index=False)
        )

        raise RuntimeError(
            f"{len(unresolved_after)} unresolved PIT rows remain. "
            "No final output written."
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
            "Duplicate rows after Paramount patch:"
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

    if len(df) != 30195:
        raise RuntimeError(
            f"Unexpected final row count: {len(df)}. Expected 30195."
        )

    df["snapshot_date"] = (
        df["snapshot_date"]
        .dt.strftime("%Y-%m-%d")
    )

    audit_df = pd.DataFrame(
        audit_rows
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
    print("=" * 76)
    print("FINAL POINT-IN-TIME IDENTITY PASS")
    print("=" * 76)
    print(
        f"Rows in final PIT file    : {len(df)}"
    )
    print(
        f"Paramount rows patched    : {len(audit_df)}"
    )
    print(
        "Unresolved PIT rows       : 0"
    )
    print(
        f"Final PIT membership      : {output_path}"
    )
    print(
        f"Patch audit               : {audit_path}"
    )

    print()
    print("Patched rows:")
    print(
        audit_df[
            [
                "snapshot_date",
                "original_ticker",
                "final_ticker",
                "final_cik",
            ]
        ]
        .to_string(index=False)
    )

    return 0


if __name__ == "__main__":
    raise SystemExit(main())