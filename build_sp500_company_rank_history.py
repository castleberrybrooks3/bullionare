#!/usr/bin/env python3
"""
Derive monthly S&P 500 COMPANY-level market-cap rankings from the validated
security-level rank history.

INPUT
-----
sp500_rank_history.csv

OUTPUTS
-------
sp500_company_rank_history.csv
sp500_company_rank_summary.csv
sp500_multiclass_company_audit.csv

METHOD
------
For each snapshot:
  1) Group rows by point-in-time SEC CIK.
  2) Sum market cap across all S&P-listed securities for that CIK.
  3) Rank each CIK/company once by the summed market cap.
  4) Pick one representative tradable ticker for future backtesting:
       - the class with the largest individual market cap
       - ticker alphabetical as deterministic tiebreaker
  5) Preserve all member tickers in `member_tickers`.

This prevents a company such as Alphabet from being counted twice in a
"Top N companies by market cap" strategy.

This script does not call Polygon or SEC and does not modify Supabase/api.py.
"""

from __future__ import annotations

import argparse
from pathlib import Path
import math
import re

import pandas as pd


REQUIRED_COLUMNS = {
    "snapshot_date",
    "ticker",
    "security",
    "cik",
    "tradable_at_snapshot",
    "rank",
    "market_cap",
    "price",
    "price_date",
    "shares_outstanding",
    "share_source",
    "quality_flag",
}


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


def load_rank_history(path: Path) -> pd.DataFrame:
    df = pd.read_csv(path, dtype=str).fillna("")

    missing = REQUIRED_COLUMNS - set(df.columns)
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
    df["cik"] = df["cik"].map(normalize_cik)
    df["tradable_at_snapshot"] = df["tradable_at_snapshot"].map(
        lambda value: parse_bool(value, default=True)
    )

    for column in [
        "rank",
        "market_cap",
        "price",
        "shares_outstanding",
    ]:
        df[column] = pd.to_numeric(
            df[column],
            errors="coerce",
        )

    blank_cik = df[df["cik"].eq("")]

    if not blank_cik.empty:
        print()
        print("Rows with missing CIK:")
        print(
            blank_cik[
                ["snapshot_date", "ticker", "security"]
            ]
            .head(30)
            .to_string(index=False)
        )
        raise RuntimeError(
            f"{len(blank_cik)} rows have no CIK. "
            "Company-level grouping would be ambiguous."
        )

    duplicates = df[
        df.duplicated(
            subset=["snapshot_date", "ticker"],
            keep=False,
        )
    ]

    if not duplicates.empty:
        raise RuntimeError(
            "Security rank input contains duplicate "
            "(snapshot_date, ticker) rows."
        )

    return (
        df.sort_values(
            ["snapshot_date", "cik", "ticker"]
        )
        .reset_index(drop=True)
    )


def choose_representative(group: pd.DataFrame) -> pd.Series:
    candidates = group[
        group["tradable_at_snapshot"]
    ].copy()

    if candidates.empty:
        candidates = group.copy()

    with_cap = candidates[
        candidates["market_cap"].notna()
    ].copy()

    if not with_cap.empty:
        candidates = with_cap

    candidates = candidates.sort_values(
        ["market_cap", "ticker"],
        ascending=[False, True],
        na_position="last",
    )

    return candidates.iloc[0]


def aggregate_quality(
    group: pd.DataFrame,
    all_classes_rankable: bool,
) -> str:
    if not all_classes_rankable:
        if group["market_cap"].notna().any():
            return "partial_class_market_cap"
        return "missing_market_cap"

    flags = {
        str(value).strip()
        for value in group["quality_flag"]
        if str(value).strip()
    }

    if not flags or flags == {"ok"}:
        return "ok"

    if "very_stale_shares" in flags:
        return "very_stale_shares"

    if "stale_shares" in flags:
        return "stale_shares"

    return "mixed:" + "|".join(sorted(flags))


def build_company_rows(
    security_df: pd.DataFrame,
) -> tuple[pd.DataFrame, pd.DataFrame]:
    company_rows = []
    multiclass_rows = []

    grouped = security_df.groupby(
        ["snapshot_date", "cik"],
        sort=True,
    )

    for (snapshot_date, cik), group in grouped:
        group = group.copy()
        representative = choose_representative(group)

        tickers = sorted(
            {
                normalize_ticker(ticker)
                for ticker in group["ticker"]
                if normalize_ticker(ticker)
            }
        )

        class_count = len(group)

        rankable_mask = (
            group["tradable_at_snapshot"]
            & group["market_cap"].notna()
        )

        rankable_class_count = int(rankable_mask.sum())
        all_classes_rankable = (
            rankable_class_count == class_count
        )

        company_market_cap = None

        if all_classes_rankable:
            company_market_cap = float(
                group["market_cap"].sum()
            )

            if (
                not math.isfinite(company_market_cap)
                or company_market_cap <= 0
            ):
                company_market_cap = None

        security_ranks = group["rank"].dropna()

        min_security_rank = (
            None
            if security_ranks.empty
            else int(security_ranks.min())
        )

        max_security_rank = (
            None
            if security_ranks.empty
            else int(security_ranks.max())
        )

        representative_market_cap = (
            None
            if pd.isna(
                representative["market_cap"]
            )
            else float(
                representative["market_cap"]
            )
        )

        row = {
            "snapshot_date": snapshot_date.date().isoformat(),
            "company_rank": "",
            "cik": cik,
            "company_name": str(
                representative["security"]
            ).strip(),
            "company_market_cap": company_market_cap,
            "representative_ticker": normalize_ticker(
                representative["ticker"]
            ),
            "representative_security": str(
                representative["security"]
            ).strip(),
            "representative_class_market_cap": (
                representative_market_cap
            ),
            "representative_price": (
                None
                if pd.isna(representative["price"])
                else float(representative["price"])
            ),
            "representative_price_date": str(
                representative["price_date"]
            ).strip(),
            "member_tickers": "|".join(tickers),
            "class_count": class_count,
            "rankable_class_count": rankable_class_count,
            "min_security_rank": min_security_rank,
            "max_security_rank": max_security_rank,
            "quality_flag": aggregate_quality(
                group,
                all_classes_rankable,
            ),
            "aggregation_method": (
                "sum_sp500_constituent_share_classes"
            ),
        }

        company_rows.append(row)

        if class_count > 1:
            class_details = []

            for _, class_row in (
                group.sort_values("ticker").iterrows()
            ):
                market_cap_value = (
                    ""
                    if pd.isna(class_row["market_cap"])
                    else f"{float(class_row['market_cap']):.6f}"
                )

                class_details.append(
                    f"{class_row['ticker']}:{market_cap_value}"
                )

            multiclass_rows.append(
                {
                    "snapshot_date": (
                        snapshot_date.date().isoformat()
                    ),
                    "cik": cik,
                    "company_name": row["company_name"],
                    "member_tickers": row["member_tickers"],
                    "class_count": class_count,
                    "representative_ticker": (
                        row["representative_ticker"]
                    ),
                    "company_market_cap": (
                        company_market_cap
                    ),
                    "class_market_caps": "|".join(
                        class_details
                    ),
                    "quality_flag": row["quality_flag"],
                }
            )

    return (
        pd.DataFrame(company_rows),
        pd.DataFrame(multiclass_rows),
    )


def assign_company_ranks(
    company_df: pd.DataFrame,
) -> pd.DataFrame:
    result = company_df.copy()

    for snapshot_date, group in result.groupby(
        "snapshot_date",
        sort=True,
    ):
        eligible = group[
            group["company_market_cap"].notna()
        ].copy()

        eligible = eligible.sort_values(
            ["company_market_cap", "cik"],
            ascending=[False, True],
        )

        for rank_value, row_index in enumerate(
            eligible.index,
            start=1,
        ):
            result.at[
                row_index,
                "company_rank",
            ] = rank_value

    return result


def build_summary(
    security_df: pd.DataFrame,
    company_df: pd.DataFrame,
    multiclass_df: pd.DataFrame,
) -> pd.DataFrame:
    summary_rows = []

    security_groups = {
        snapshot.date().isoformat(): group
        for snapshot, group
        in security_df.groupby(
            "snapshot_date",
            sort=True,
        )
    }

    multiclass_groups = {
        snapshot: group
        for snapshot, group
        in multiclass_df.groupby(
            "snapshot_date",
            sort=True,
        )
    }

    for snapshot_date, group in company_df.groupby(
        "snapshot_date",
        sort=True,
    ):
        security_group = security_groups[
            snapshot_date
        ]

        company_count = len(group)

        ranked_company_count = int(
            group["company_market_cap"]
            .notna()
            .sum()
        )

        coverage = (
            100.0
            * ranked_company_count
            / company_count
            if company_count
            else 0.0
        )

        multi_group = multiclass_groups.get(
            snapshot_date
        )

        multiclass_count = (
            0
            if multi_group is None
            else len(multi_group)
        )

        summary_rows.append(
            {
                "snapshot_date": snapshot_date,
                "security_count": len(security_group),
                "company_count": company_count,
                "multiclass_company_count": (
                    multiclass_count
                ),
                "ranked_company_count": (
                    ranked_company_count
                ),
                "coverage_pct": round(
                    coverage,
                    4,
                ),
                "security_minus_company_count": (
                    len(security_group)
                    - company_count
                ),
            }
        )

    return pd.DataFrame(summary_rows)


def main() -> int:
    parser = argparse.ArgumentParser()

    parser.add_argument(
        "--input",
        default="sp500_rank_history.csv",
    )

    parser.add_argument(
        "--output",
        default="sp500_company_rank_history.csv",
    )

    parser.add_argument(
        "--summary-output",
        default="sp500_company_rank_summary.csv",
    )

    parser.add_argument(
        "--multiclass-output",
        default="sp500_multiclass_company_audit.csv",
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
    multiclass_path = Path(
        args.multiclass_output
    ).resolve()

    if not input_path.exists():
        raise RuntimeError(
            f"Missing input file: {input_path}"
        )

    security_df = load_rank_history(
        input_path
    )

    print(
        "Security rank window      : "
        f"{security_df['snapshot_date'].min().date()} "
        f"through "
        f"{security_df['snapshot_date'].max().date()}"
    )

    print(
        f"Security rows             : "
        f"{len(security_df)}"
    )

    print(
        f"Snapshot months           : "
        f"{security_df['snapshot_date'].nunique()}"
    )

    company_df, multiclass_df = build_company_rows(
        security_df
    )

    company_df = assign_company_ranks(
        company_df
    )

    summary_df = build_summary(
        security_df=security_df,
        company_df=company_df,
        multiclass_df=multiclass_df,
    )

    company_df["company_rank_num"] = pd.to_numeric(
        company_df["company_rank"],
        errors="coerce",
    )

    company_df = company_df.sort_values(
        [
            "snapshot_date",
            "company_rank_num",
            "representative_ticker",
        ],
        na_position="last",
    ).drop(
        columns=["company_rank_num"]
    )

    company_df.to_csv(
        output_path,
        index=False,
    )

    summary_df.to_csv(
        summary_path,
        index=False,
    )

    multiclass_df.to_csv(
        multiclass_path,
        index=False,
    )

    min_coverage = float(
        summary_df["coverage_pct"].min()
    )

    print()
    print("=" * 82)
    print(
        "S&P 500 COMPANY-LEVEL "
        "MARKET-CAP RANK BUILD COMPLETE"
    )
    print("=" * 82)

    print(
        f"Company rows written      : "
        f"{len(company_df)}"
    )

    print(
        f"Snapshot months           : "
        f"{len(summary_df)}"
    )

    print(
        f"Multi-class company rows  : "
        f"{len(multiclass_df)}"
    )

    print(
        f"Minimum monthly coverage  : "
        f"{min_coverage:.2f}%"
    )

    print(
        f"Company rank history      : "
        f"{output_path}"
    )

    print(
        f"Company summary           : "
        f"{summary_path}"
    )

    print(
        f"Multi-class audit         : "
        f"{multiclass_path}"
    )

    print()
    print("Coverage — first 6 months:")
    print(
        summary_df.head(6)
        .to_string(index=False)
    )

    print()
    print("Coverage — last 6 months:")
    print(
        summary_df.tail(6)
        .to_string(index=False)
    )

    sample_dates = [
        "2021-10-31",
        "2024-12-31",
        "2025-06-30",
        "2026-09-30",
    ]

    for sample_date in sample_dates:
        sample = (
            company_df[
                company_df["snapshot_date"].eq(
                    sample_date
                )
                & company_df[
                    "company_market_cap"
                ].notna()
            ]
            .copy()
        )

        sample["rank_num"] = pd.to_numeric(
            sample["company_rank"],
            errors="coerce",
        )

        sample = (
            sample.sort_values("rank_num")
            .head(10)
        )

        if sample.empty:
            continue

        print()
        print(
            f"Top 10 companies — "
            f"{sample_date}:"
        )

        print(
            sample[
                [
                    "company_rank",
                    "representative_ticker",
                    "company_name",
                    "company_market_cap",
                    "member_tickers",
                    "class_count",
                ]
            ]
            .to_string(index=False)
        )

    alphabet_samples = (
        company_df[
            company_df["cik"].eq(
                "0001652044"
            )
        ][
            [
                "snapshot_date",
                "company_rank",
                "company_market_cap",
                "representative_ticker",
                "member_tickers",
                "class_count",
            ]
        ]
        .head(8)
    )

    if not alphabet_samples.empty:
        print()
        print("Alphabet grouping check:")
        print(
            alphabet_samples.to_string(
                index=False
            )
        )

    if (
        min_coverage
        < float(args.minimum_coverage)
    ):
        print()
        print(
            "STOP: company-level "
            "coverage is below "
            f"{float(args.minimum_coverage):.2f}%."
        )
        print(
            "Send the terminal output "
            "and company summary before "
            "Supabase work."
        )
    else:
        print()
        print(
            "PASS: company-level rankings "
            "meet the configured coverage threshold."
        )
        print(
            "Next step: validate the Top-10 "
            "company ranks, then create Supabase tables."
        )

    return 0


if __name__ == "__main__":
    raise SystemExit(main())