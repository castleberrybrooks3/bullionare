from pathlib import Path
import shutil
import pandas as pd


FILES = [
    Path("sp500_monthly_membership_pit_final.csv"),
    Path("sp500_rank_history.csv"),
]

META_DATES = {
    "2021-10-31",
    "2021-11-30",
    "2021-12-31",
    "2022-01-31",
}

META_CIK = "0001326801"
CENCORA_CIK = "0001140859"


def normalize_date(series):
    return pd.to_datetime(series, errors="coerce").dt.strftime("%Y-%m-%d")


def main():
    for path in FILES:
        if not path.exists():
            raise RuntimeError(f"Missing required file: {path}")

        backup = path.with_suffix(path.suffix + ".before_identity_fix.bak")

        if not backup.exists():
            shutil.copy2(path, backup)
            print(f"Backup created: {backup}")
        else:
            print(f"Backup already exists: {backup}")

        df = pd.read_csv(path, dtype=str).fillna("")

        required = {"snapshot_date", "ticker", "cik"}
        missing = required - set(df.columns)

        if missing:
            raise RuntimeError(
                f"{path.name} missing required columns: {sorted(missing)}"
            )

        dates = normalize_date(df["snapshot_date"])
        tickers = df["ticker"].str.strip().str.upper()

        # ---------------------------------------------------------
        # META / Facebook
        # Before June 9, 2022 the actual trading ticker was FB.
        # These four monthly rows were incorrectly carrying META.
        # ---------------------------------------------------------
        meta_mask = (
            dates.isin(META_DATES)
            & tickers.isin(["META", "FB"])
        )

        meta_count = int(meta_mask.sum())

        if meta_count != 4:
            raise RuntimeError(
                f"{path.name}: expected exactly 4 Meta rows, "
                f"found {meta_count}. No changes written."
            )

        df.loc[meta_mask, "ticker"] = "FB"
        df.loc[meta_mask, "cik"] = META_CIK

        # ---------------------------------------------------------
        # Cencora
        # COR became the ticker on 2023-08-30, so COR is correct
        # for the 2023-08-31 snapshot. Only the CIK is missing.
        # ---------------------------------------------------------
        cor_mask = (
            dates.eq("2023-08-31")
            & tickers.eq("COR")
        )

        cor_count = int(cor_mask.sum())

        if cor_count != 1:
            raise RuntimeError(
                f"{path.name}: expected exactly 1 COR row on "
                f"2023-08-31, found {cor_count}. No changes written."
            )

        df.loc[cor_mask, "cik"] = CENCORA_CIK

        # Validate repaired rows.
        repaired_meta = df.loc[
            meta_mask,
            ["snapshot_date", "ticker", "cik"]
        ]

        repaired_cor = df.loc[
            cor_mask,
            ["snapshot_date", "ticker", "cik"]
        ]

        if not repaired_meta["ticker"].eq("FB").all():
            raise RuntimeError("Meta ticker repair failed.")

        if not repaired_meta["cik"].eq(META_CIK).all():
            raise RuntimeError("Meta CIK repair failed.")

        if not repaired_cor["cik"].eq(CENCORA_CIK).all():
            raise RuntimeError("Cencora CIK repair failed.")

        df.to_csv(path, index=False)

        print()
        print(f"REPAIRED: {path.name}")
        print(repaired_meta.to_string(index=False))
        print(repaired_cor.to_string(index=False))
        print()

    print("=" * 72)
    print("IDENTITY PATCH COMPLETE")
    print("=" * 72)
    print("Meta historical rows: META -> FB, CIK 0001326801")
    print("Cencora 2023-08-31: COR retained, CIK 0001140859")
    print()
    print("Next command:")
    print("python build_sp500_company_rank_history.py")


if __name__ == "__main__":
    main()