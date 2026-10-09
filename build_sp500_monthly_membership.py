#!/usr/bin/env python3
"""
Build point-in-time monthly S&P 500 membership snapshots by walking backward
from the current constituent snapshot using the historical additions/removals file.

Inputs (same folder by default):
    sp500_constituents_snapshot.csv
    sp500_changes_history.csv

Outputs:
    sp500_monthly_membership.csv
    sp500_monthly_membership_summary.csv

Default date window:
    First month-end on/after five years ago
    through the most recently completed month-end.

Example on 2026-10-06:
    2021-10-31 through 2026-09-30
"""

from __future__ import annotations

import argparse
from pathlib import Path
from typing import Dict, List, Set

import pandas as pd


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


# Wikipedia's S&P constituent-change table does not always include ticker-only
# changes when the company remains in the index. Add verified cases here so the
# backward reconstruction uses the ticker that actually existed at the time.
#
# EchoStar changed SATS -> ECHO effective 2026-06-24.
MANUAL_TICKER_EVENTS = [
    {
        "date": "2026-06-24",
        "added_ticker": "ECHO",
        "added_security": "EchoStar",
        "removed_ticker": "SATS",
        "removed_security": "EchoStar",
        "reason": "Ticker-only change: SATS -> ECHO",
        "source": "manual_verified_ticker_change",
    },
]


def normalize_symbol(value) -> str:
    if pd.isna(value):
        return ""
    return str(value).strip().upper().replace("\xa0", "")


def load_current_constituents(path: Path) -> pd.DataFrame:
    """
    Load the current constituent file.

    The pull script writes a normal header row. This loader is also tolerant of
    a headerless copy, which makes it safer if the CSV was opened/re-saved by hand.
    """
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

    df["Symbol"] = df["Symbol"].map(normalize_symbol)
    df["Security"] = df["Security"].astype(str).str.strip()

    df = (
        df[df["Symbol"].ne("")]
        .drop_duplicates(subset=["Symbol"], keep="last")
        .reset_index(drop=True)
    )

    if not 495 <= len(df) <= 510:
        raise RuntimeError(
            f"Unexpected current constituent count: {len(df)}. "
            "Expected roughly 500 securities."
        )

    return df


def load_changes(path: Path) -> pd.DataFrame:
    required = {
        "date",
        "added_ticker",
        "removed_ticker",
    }

    df = pd.read_csv(path, dtype=str).fillna("")

    missing = required - set(df.columns)
    if missing:
        raise RuntimeError(
            f"{path.name} is missing columns: {sorted(missing)}"
        )

    for optional in (
        "added_security",
        "removed_security",
        "reason",
    ):
        if optional not in df.columns:
            df[optional] = ""

    df["date"] = pd.to_datetime(
        df["date"],
        errors="coerce",
    )

    if df["date"].isna().any():
        bad_rows = df[df["date"].isna()].head(10)
        raise RuntimeError(
            "Some S&P change rows contain invalid dates:\n"
            + bad_rows.to_string(index=False)
        )

    df["added_ticker"] = df["added_ticker"].map(normalize_symbol)
    df["removed_ticker"] = df["removed_ticker"].map(normalize_symbol)
    df["source"] = "wikipedia_sp500_changes"

    manual = pd.DataFrame(MANUAL_TICKER_EVENTS)
    manual["date"] = pd.to_datetime(manual["date"])
    manual["added_ticker"] = manual["added_ticker"].map(normalize_symbol)
    manual["removed_ticker"] = manual["removed_ticker"].map(normalize_symbol)

    combined = pd.concat(
        [df, manual],
        ignore_index=True,
        sort=False,
    )

    combined = (
        combined
        .drop_duplicates(
            subset=[
                "date",
                "added_ticker",
                "removed_ticker",
            ],
            keep="last",
        )
        .sort_values(
            ["date", "added_ticker", "removed_ticker"],
            ascending=[False, True, True],
        )
        .reset_index(drop=True)
    )

    return combined


def default_snapshot_window():
    today = pd.Timestamp.today().normalize()

    # Most recently completed calendar month.
    end = today.replace(day=1) - pd.Timedelta(days=1)

    # First month-end on or after the date five years ago.
    five_year_cutoff = today - pd.DateOffset(years=5)
    start = five_year_cutoff + pd.offsets.MonthEnd(0)

    return start.normalize(), end.normalize()


def build_name_map(
    current_df: pd.DataFrame,
    changes_df: pd.DataFrame,
) -> Dict[str, str]:
    names: Dict[str, str] = {}

    for _, row in current_df.iterrows():
        ticker = normalize_symbol(row.get("Symbol"))
        name = str(row.get("Security") or "").strip()
        if ticker and name:
            names[ticker] = name

    for _, row in changes_df.iterrows():
        added = normalize_symbol(row.get("added_ticker"))
        added_name = str(row.get("added_security") or "").strip()

        removed = normalize_symbol(row.get("removed_ticker"))
        removed_name = str(row.get("removed_security") or "").strip()

        if added and added_name:
            names[added] = added_name

        if removed and removed_name:
            names[removed] = removed_name

    return names


def audit_backward_events(
    current_members: Set[str],
    changes_df: pd.DataFrame,
    earliest_snapshot: pd.Timestamp,
) -> None:
    """
    Walk backward once and make sure every event can actually be undone.

    This catches missing ticker-only changes such as the SATS -> ECHO issue:
    if a historical event says SATS was added, but SATS is not in the later
    membership set, then some later rename/removal is missing.
    """
    members = set(current_members)
    errors: List[str] = []

    relevant = changes_df[
        changes_df["date"] > earliest_snapshot
    ].sort_values(
        ["date", "added_ticker", "removed_ticker"],
        ascending=[False, True, True],
    )

    for _, row in relevant.iterrows():
        date_text = row["date"].date().isoformat()
        added = normalize_symbol(row.get("added_ticker"))
        removed = normalize_symbol(row.get("removed_ticker"))

        if added and added not in members:
            errors.append(
                f"{date_text}: cannot undo addition of {added}; "
                f"{added} is not in the later membership set."
            )

        if removed and removed in members:
            errors.append(
                f"{date_text}: cannot restore removed ticker {removed}; "
                f"{removed} is already present in the later membership set."
            )

        if added:
            members.discard(added)

        if removed:
            members.add(removed)

    if errors:
        preview = "\n".join(errors[:20])
        raise RuntimeError(
            "Historical membership audit found inconsistent events.\n"
            "This usually means a ticker-only rename is missing.\n\n"
            + preview
        )


def membership_as_of(
    current_members: Set[str],
    changes_df: pd.DataFrame,
    snapshot_date: pd.Timestamp,
) -> Set[str]:
    """
    Start with today's membership and undo every effective change that happened
    after the requested snapshot date.
    """
    members = set(current_members)

    later_changes = changes_df[
        changes_df["date"] > snapshot_date
    ].sort_values(
        ["date", "added_ticker", "removed_ticker"],
        ascending=[False, True, True],
    )

    for _, row in later_changes.iterrows():
        added = normalize_symbol(row.get("added_ticker"))
        removed = normalize_symbol(row.get("removed_ticker"))

        # Walking backward:
        #   an addition is undone by removing it
        #   a removal is undone by restoring it
        if added:
            members.discard(added)

        if removed:
            members.add(removed)

    return members


def main() -> int:
    default_start, default_end = default_snapshot_window()

    parser = argparse.ArgumentParser()

    parser.add_argument(
        "--constituents",
        default="sp500_constituents_snapshot.csv",
        help="Current S&P 500 constituent snapshot CSV.",
    )

    parser.add_argument(
        "--changes",
        default="sp500_changes_history.csv",
        help="Historical S&P 500 additions/removals CSV.",
    )

    parser.add_argument(
        "--output",
        default="sp500_monthly_membership.csv",
        help="Detailed monthly membership output CSV.",
    )

    parser.add_argument(
        "--summary-output",
        default="sp500_monthly_membership_summary.csv",
        help="Monthly validation summary output CSV.",
    )

    parser.add_argument(
        "--start",
        default=default_start.date().isoformat(),
        help=(
            "First snapshot month-end, YYYY-MM-DD. "
            f"Default: {default_start.date().isoformat()}"
        ),
    )

    parser.add_argument(
        "--end",
        default=default_end.date().isoformat(),
        help=(
            "Last snapshot month-end, YYYY-MM-DD. "
            f"Default: {default_end.date().isoformat()}"
        ),
    )

    args = parser.parse_args()

    constituents_path = Path(args.constituents).resolve()
    changes_path = Path(args.changes).resolve()
    output_path = Path(args.output).resolve()
    summary_path = Path(args.summary_output).resolve()

    if not constituents_path.exists():
        raise RuntimeError(
            f"Missing file: {constituents_path}"
        )

    if not changes_path.exists():
        raise RuntimeError(
            f"Missing file: {changes_path}"
        )

    current_df = load_current_constituents(
        constituents_path
    )

    changes_df = load_changes(
        changes_path
    )

    current_members = set(
        current_df["Symbol"].tolist()
    )

    name_map = build_name_map(
        current_df,
        changes_df,
    )

    start = pd.Timestamp(args.start).normalize()
    end = pd.Timestamp(args.end).normalize()

    if start > end:
        raise RuntimeError(
            "--start must be on or before --end."
        )

    # Normalize any supplied dates to calendar month-end.
    start = start + pd.offsets.MonthEnd(0)
    end = end + pd.offsets.MonthEnd(0)

    snapshot_dates = pd.date_range(
        start=start,
        end=end,
        freq="ME",
    )

    if len(snapshot_dates) == 0:
        raise RuntimeError(
            "No monthly snapshot dates were generated."
        )

    audit_backward_events(
        current_members=current_members,
        changes_df=changes_df,
        earliest_snapshot=snapshot_dates[0],
    )

    output_rows = []
    summary_rows = []

    for snapshot_date in snapshot_dates:
        members = membership_as_of(
            current_members=current_members,
            changes_df=changes_df,
            snapshot_date=snapshot_date,
        )

        count = len(members)

        if not 495 <= count <= 510:
            raise RuntimeError(
                f"{snapshot_date.date()}: reconstructed "
                f"{count} securities, which is outside the "
                "expected S&P 500 range."
            )

        for ticker in sorted(members):
            output_rows.append(
                {
                    "snapshot_date": snapshot_date.date().isoformat(),
                    "ticker": ticker,
                    "security": name_map.get(ticker, ""),
                }
            )

        summary_rows.append(
            {
                "snapshot_date": snapshot_date.date().isoformat(),
                "security_count": count,
            }
        )

    output_df = pd.DataFrame(output_rows)
    summary_df = pd.DataFrame(summary_rows)

    duplicate_count = int(
        output_df.duplicated(
            subset=["snapshot_date", "ticker"]
        ).sum()
    )

    if duplicate_count:
        raise RuntimeError(
            f"Generated {duplicate_count} duplicate "
            "(snapshot_date, ticker) rows."
        )

    output_df.to_csv(
        output_path,
        index=False,
    )

    summary_df.to_csv(
        summary_path,
        index=False,
    )

    print()
    print("=" * 72)
    print("SUCCESS")
    print("=" * 72)
    print(
        f"Current securities        : {len(current_members)}"
    )
    print(
        f"Snapshot months           : {len(snapshot_dates)}"
    )
    print(
        f"First snapshot            : {snapshot_dates[0].date()}"
    )
    print(
        f"Last snapshot             : {snapshot_dates[-1].date()}"
    )
    print(
        f"Membership rows written   : {len(output_df)}"
    )
    print(
        f"Detailed output           : {output_path}"
    )
    print(
        f"Summary output            : {summary_path}"
    )

    print()
    print("Monthly security-count range:")
    print(
        f"  min = {summary_df['security_count'].min()}"
    )
    print(
        f"  max = {summary_df['security_count'].max()}"
    )

    print()
    print("First 6 snapshots:")
    print(
        summary_df
        .head(6)
        .to_string(index=False)
    )

    print()
    print("Last 6 snapshots:")
    print(
        summary_df
        .tail(6)
        .to_string(index=False)
    )

    print()
    print(
        "NOTE: This file reconstructs point-in-time INDEX MEMBERSHIP. "
        "Before historical Polygon price pulls, we will separately resolve "
        "ticker-only renames for companies that stayed in the index."
    )

    return 0


if __name__ == "__main__":
    raise SystemExit(main())