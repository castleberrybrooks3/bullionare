#!/usr/bin/env python3
from __future__ import annotations

import shutil
from pathlib import Path

import pandas as pd


RANK_FILE = Path("sp500_rank_history.csv")
CLEAN_BACKUP = Path("sp500_rank_history.pre_continuity_fix.csv")
PRE_FINAL_COPY = Path("sp500_rank_history.pre_final_split_fix.csv")
AUDIT_FILE = Path("sp500_verified_stock_split_fix_audit.csv")

# These are the exact monthly rows where the historical share count remained on
# the pre-split basis even though the snapshot price was already post-split.
# Only actual stock splits are included here. Spin-offs/distributions such as
# GE/GEHC, GE/GEV, MMM/SOLV, LH/FTRE and FTV/RAL are intentionally excluded.
VERIFIED_FIXES = {
    ("APH",  "2026-09-30"): 2.0,
    ("BKNG", "2026-04-30"): 25.0,
    ("CRWD", "2026-07-31"): 4.0,
    ("CVNA", "2026-05-31"): 5.0,
    ("CVNA", "2026-06-30"): 5.0,
    ("CVNA", "2026-07-31"): 5.0,
    ("KLAC", "2026-06-30"): 10.0,
    ("KLAC", "2026-07-31"): 10.0,
    ("MNST", "2026-08-31"): 2.0,
    ("MNST", "2026-09-30"): 2.0,
    ("NFLX", "2025-11-30"): 10.0,
    ("NOW",  "2025-12-31"): 5.0,
    ("NOW",  "2026-01-31"): 5.0,
    ("ODFL", "2024-03-31"): 2.0,
    ("ORLY", "2025-06-30"): 15.0,
    ("ORLY", "2025-07-31"): 15.0,
    ("TECH", "2022-11-30"): 4.0,
    ("TPL",  "2025-12-31"): 3.0,
    ("TPL",  "2026-01-31"): 3.0,
}


def main():
    if not CLEAN_BACKUP.exists():
        raise RuntimeError(
            "Missing sp500_rank_history.pre_continuity_fix.csv. "
            "That clean backup is required."
        )

    if RANK_FILE.exists() and not PRE_FINAL_COPY.exists():
        shutil.copy2(RANK_FILE, PRE_FINAL_COPY)

    # Always start from the clean build that existed before the broad
    # continuity correction, so this script is safe to rerun.
    shutil.copy2(CLEAN_BACKUP, RANK_FILE)

    df = pd.read_csv(RANK_FILE)

    required = {
        "snapshot_date",
        "ticker",
        "price",
        "shares_outstanding",
        "market_cap",
        "share_source",
        "rank",
    }
    missing = required - set(df.columns)
    if missing:
        raise RuntimeError(
            f"{RANK_FILE.name} missing columns: {sorted(missing)}"
        )

    df["snapshot_date"] = pd.to_datetime(
        df["snapshot_date"],
        errors="coerce",
    )
    df["ticker"] = (
        df["ticker"]
        .astype(str)
        .str.strip()
        .str.upper()
    )
    df["price"] = pd.to_numeric(
        df["price"],
        errors="coerce",
    )
    df["shares_outstanding"] = pd.to_numeric(
        df["shares_outstanding"],
        errors="coerce",
    )
    df["market_cap"] = pd.to_numeric(
        df["market_cap"],
        errors="coerce",
    )

    audit = []

    for (ticker, snapshot_text), factor in VERIFIED_FIXES.items():
        snapshot = pd.Timestamp(snapshot_text)

        mask = (
            df["ticker"].eq(ticker)
            & df["snapshot_date"].eq(snapshot)
        )

        matches = df.index[mask].tolist()

        if len(matches) != 1:
            raise RuntimeError(
                f"Expected exactly 1 row for {ticker} {snapshot_text}; "
                f"found {len(matches)}."
            )

        idx = matches[0]

        old_shares = df.at[idx, "shares_outstanding"]
        price = df.at[idx, "price"]
        old_cap = df.at[idx, "market_cap"]
        old_source = str(df.at[idx, "share_source"] or "")

        if pd.isna(old_shares) or float(old_shares) <= 0:
            raise RuntimeError(
                f"Invalid shares for {ticker} {snapshot_text}: {old_shares}"
            )

        if pd.isna(price) or float(price) <= 0:
            raise RuntimeError(
                f"Invalid price for {ticker} {snapshot_text}: {price}"
            )

        new_shares = float(old_shares) * float(factor)
        new_cap = float(price) * new_shares

        df.at[idx, "shares_outstanding"] = new_shares
        df.at[idx, "market_cap"] = new_cap
        df.at[idx, "share_source"] = (
            old_source + "_verified_stock_split_fix"
        ).strip("_")

        audit.append(
            {
                "snapshot_date": snapshot_text,
                "ticker": ticker,
                "factor": factor,
                "old_shares": old_shares,
                "new_shares": new_shares,
                "price": price,
                "old_market_cap": old_cap,
                "new_market_cap": new_cap,
                "old_share_source": old_source,
                "new_share_source": df.at[idx, "share_source"],
            }
        )

    # Re-rank every monthly security snapshot after the verified corrections.
    df["rank"] = pd.NA

    for snapshot, group in df.groupby(
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
            df.at[row_idx, "rank"] = rank_value

    df["rank"] = pd.to_numeric(
        df["rank"],
        errors="coerce",
    ).astype("Int64")

    df["snapshot_date"] = (
        df["snapshot_date"]
        .dt.strftime("%Y-%m-%d")
    )

    df.to_csv(
        RANK_FILE,
        index=False,
    )

    audit_df = pd.DataFrame(audit)
    audit_df.to_csv(
        AUDIT_FILE,
        index=False,
    )

    print("=" * 78)
    print("S&P 500 VERIFIED STOCK-SPLIT FIX COMPLETE")
    print("=" * 78)
    print(f"Rows in rank history        : {len(df)}")
    print(f"Verified rows corrected     : {len(audit_df)}")
    print(f"Corrected rank history      : {RANK_FILE.resolve()}")
    print(f"Correction audit            : {AUDIT_FILE.resolve()}")
    print()
    print("Verified corrections:")
    print(
        audit_df[
            [
                "snapshot_date",
                "ticker",
                "factor",
                "old_market_cap",
                "new_market_cap",
            ]
        ].to_string(index=False)
    )


if __name__ == "__main__":
    main()