import sqlite3
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

import yfinance as yf

DB_FILE = "stocks.db"


def ensure_columns(conn):
    cursor = conn.cursor()
    existing_cols = {row[1] for row in cursor.execute("PRAGMA table_info(stocks)").fetchall()}

    needed_columns = {
        "Company Name": "TEXT",
        "Sector": "TEXT",
        "Industry": "TEXT",
        "EPS (TTM)": "REAL",
        "P/E (TTM)": "REAL",
        "Beta": "REAL",
        "Dividend": "REAL",
        "Description": "TEXT",
        "Type": "TEXT",
        "Exchange": "TEXT",
        "Market Cap": "REAL",
    }

    for col, col_type in needed_columns.items():
        if col not in existing_cols:
            cursor.execute(f'ALTER TABLE stocks ADD COLUMN "{col}" {col_type}')

    conn.commit()


def get_all_tickers(conn):
    cursor = conn.cursor()
    cursor.execute('SELECT "Ticker" FROM stocks WHERE "Ticker" IS NOT NULL AND TRIM("Ticker") != ""')
    return [row[0].strip().upper() for row in cursor.fetchall() if row[0]]


def clean_text(value):
    if value is None:
        return None
    value = str(value).strip()
    return value if value else None


def clean_float(value):
    if value is None:
        return None
    try:
        return float(value)
    except Exception:
        return None


def infer_dividend_percent(info):
    """
    Yahoo often returns dividendYield as a decimal (0.0123 for 1.23%).
    Sometimes ETF fields differ. This keeps it flexible.
    """
    div_yield = info.get("dividendYield")

    if div_yield is not None:
        try:
            div_yield = float(div_yield)
            # convert decimal to percent
            if div_yield <= 1:
                return div_yield * 100
            return div_yield
        except Exception:
            pass

    yield_alt = info.get("yield")
    if yield_alt is not None:
        try:
            yield_alt = float(yield_alt)
            if yield_alt <= 1:
                return yield_alt * 100
            return yield_alt
        except Exception:
            pass

    return None


def infer_type(info):
    quote_type = clean_text(info.get("quoteType"))
    if quote_type:
        return quote_type

    if info.get("fundFamily") or info.get("category"):
        return "ETF"

    return None


def fetch_one(ticker):
    try:
        tk = yf.Ticker(ticker)
        info = tk.info or {}

        company_name = (
            clean_text(info.get("longName"))
            or clean_text(info.get("shortName"))
            or clean_text(info.get("displayName"))
        )

        sector = clean_text(info.get("sector"))
        industry = clean_text(info.get("industry"))

        # ETF-friendly fallbacks
        if not sector and info.get("category"):
            sector = clean_text(info.get("category"))
        if not industry and info.get("fundFamily"):
            industry = clean_text(info.get("fundFamily"))

        eps_ttm = clean_float(info.get("trailingEps"))
        pe_ttm = clean_float(info.get("trailingPE"))
        beta = clean_float(info.get("beta"))
        dividend = clean_float(infer_dividend_percent(info))
        description = clean_text(info.get("longBusinessSummary"))
        exchange = clean_text(info.get("exchange"))
        market_cap = clean_float(info.get("marketCap"))
        security_type = infer_type(info)

        return {
            "Ticker": ticker,
            "Company Name": company_name,
            "Sector": sector,
            "Industry": industry,
            "EPS (TTM)": eps_ttm,
            "P/E (TTM)": pe_ttm,
            "Beta": beta,
            "Dividend": dividend,
            "Description": description,
            "Exchange": exchange,
            "Market Cap": market_cap,
            "Type": security_type,
            "ok": True,
        }

    except Exception as e:
        print(f"[YF ERROR] {ticker}: {e}")
        return {"Ticker": ticker, "ok": False}


def update_row(conn, row):
    cursor = conn.cursor()
    cursor.execute(
        """
        UPDATE stocks
        SET
            "Company Name" = COALESCE(?, "Company Name"),
            "Sector" = COALESCE(?, "Sector"),
            "Industry" = COALESCE(?, "Industry"),
            "EPS (TTM)" = COALESCE(?, "EPS (TTM)"),
            "P/E (TTM)" = COALESCE(?, "P/E (TTM)"),
            "Beta" = COALESCE(?, "Beta"),
            "Dividend" = COALESCE(?, "Dividend"),
            "Description" = COALESCE(?, "Description"),
            "Exchange" = COALESCE(?, "Exchange"),
            "Market Cap" = COALESCE(?, "Market Cap"),
            "Type" = COALESCE(?, "Type")
        WHERE "Ticker" = ?
        """,
        (
            row.get("Company Name"),
            row.get("Sector"),
            row.get("Industry"),
            row.get("EPS (TTM)"),
            row.get("P/E (TTM)"),
            row.get("Beta"),
            row.get("Dividend"),
            row.get("Description"),
            row.get("Exchange"),
            row.get("Market Cap"),
            row.get("Type"),
            row["Ticker"],
        ),
    )


def main():
    start = time.time()

    conn = sqlite3.connect(DB_FILE)
    conn.execute("PRAGMA journal_mode=WAL;")

    ensure_columns(conn)
    tickers = get_all_tickers(conn)

    print(f"Found {len(tickers)} tickers to rebuild")

    updated = 0
    failed = 0

    # start smaller if you want: max_workers=6
    with ThreadPoolExecutor(max_workers=8) as executor:
        futures = {executor.submit(fetch_one, ticker): ticker for ticker in tickers}

        for i, future in enumerate(as_completed(futures), start=1):
            row = future.result()

            if row.get("ok"):
                update_row(conn, row)
                updated += 1
            else:
                failed += 1

            if i % 100 == 0:
                conn.commit()
                print(f"Committed through {i} tickers...")

                # light throttle so Yahoo doesn't get hammered
                time.sleep(0.2)

    conn.commit()
    conn.close()

    mins = (time.time() - start) / 60
    print(f"Done. Updated {updated} tickers.")
    print(f"Failed: {failed}")
    print(f"Runtime: {mins:.2f} minutes")


if __name__ == "__main__":
    main()