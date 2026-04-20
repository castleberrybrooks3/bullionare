from dotenv import load_dotenv
import os
import time
import math
from concurrent.futures import ThreadPoolExecutor, as_completed
import requests
import yfinance as yf
import psycopg2
from psycopg2.extras import RealDictCursor
import random

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "").strip()
if not DATABASE_URL:
    raise ValueError("DATABASE_URL is missing or empty.")

MAX_WORKERS = 1
SLEEP_BETWEEN_TICKERS = 1.0
SLEEP_BETWEEN_BATCHES = 5.0


# =========================================================
# DB HELPERS
# =========================================================

def get_conn():
    db_url = DATABASE_URL
    if "sslmode=" not in db_url:
        separator = "&" if "?" in db_url else "?"
        db_url = f"{db_url}{separator}sslmode=require"

    conn = psycopg2.connect(
        db_url,
        cursor_factory=RealDictCursor,
        connect_timeout=10
    )
    return conn


def ensure_yahoo_columns(conn):
    cursor = conn.cursor()

    cursor.execute("""
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'stocks'
    """)
    existing_cols = {row["column_name"] for row in cursor.fetchall()}

    needed = {
        "Beta": "REAL",
        "EPS (TTM)": "REAL",
        "P/E (TTM)": "REAL",
        "EBITDA": "REAL",
        "Short % of Float": "REAL",
        "Gross Profit": "REAL",
        "Analyst Upside": "REAL",
        "Analyst Downside": "REAL",
        "Mean Target": "REAL",
        "Number of Analysts": "INTEGER",
        "Sector": "TEXT",
        "Dividend Yield": "REAL",
        "Yahoo Failed": "BOOLEAN DEFAULT FALSE",
        "Yahoo Attempted": "BOOLEAN DEFAULT FALSE",
    }

    for col_name, col_type in needed.items():
        if col_name not in existing_cols:
            cursor.execute(f'ALTER TABLE stocks ADD COLUMN "{col_name}" {col_type}')

    conn.commit()


def fetch_tickers_from_db(conn):
    cursor = conn.cursor()
    cursor.execute("""
        SELECT "Ticker"
        FROM stocks
        WHERE COALESCE("Yahoo Attempted", FALSE) = FALSE
          AND "Ticker" IS NOT NULL
          AND TRIM("Ticker") != ''
        ORDER BY "Ticker" ASC
        LIMIT 300
    """)
    rows = cursor.fetchall()
    return [row["Ticker"] for row in rows]


def update_yahoo_row(conn, ticker, row):
    """
    Only updates Yahoo-owned columns. Nothing else.
    """
    conn.cursor().execute("""
        UPDATE stocks
        SET
            "Beta" = %s,
            "EPS (TTM)" = %s,
            "P/E (TTM)" = %s,
            "EBITDA" = %s,
            "Short %% of Float" = %s,
            "Gross Profit" = %s,
            "Analyst Upside" = %s,
            "Analyst Downside" = %s,
            "Mean Target" = %s,
            "Number of Analysts" = %s,
            "Sector" = %s,
            "Dividend Yield" = %s
        WHERE "Ticker" = %s
    """, (
        row.get("Beta"),
        row.get("EPS (TTM)"),
        row.get("P/E (TTM)"),
        row.get("EBITDA"),
        row.get("Short % of Float"),
        row.get("Gross Profit"),
        row.get("Analyst Upside"),
        row.get("Analyst Downside"),
        row.get("Mean Target"),
        row.get("Number of Analysts"),
        row.get("Sector"),
        row.get("Dividend Yield"),
        ticker
    ))


def mark_yahoo_failed(conn, ticker):
    conn.cursor().execute("""
        UPDATE stocks
        SET "Yahoo Failed" = TRUE
        WHERE "Ticker" = %s
    """, (ticker,))

def mark_yahoo_attempted(conn, ticker):
    conn.cursor().execute("""
        UPDATE stocks
        SET "Yahoo Attempted" = TRUE
        WHERE "Ticker" = %s
    """, (ticker,))
# =========================================================
# YAHOO FETCH LOGIC
# =========================================================

def safe_float(val):
    if val is None:
        return None
    try:
        num = float(val)
        if math.isnan(num) or math.isinf(num):
            return None
        return num
    except Exception:
        return None


def safe_int(val):
    if val is None:
        return None
    try:
        return int(val)
    except Exception:
        return None


def normalize_percent(value):
    """
    Converts percent-like values to a plain percent number if possible.
    Examples:
      0.1234 -> 12.34
      12.34  -> 12.34
    """
    num = safe_float(value)
    if num is None:
        return None

    if -1 <= num <= 1:
        return num * 100

    return num


def normalize_short_float(value):
    return normalize_percent(value)


def get_sector(info):
    sector = info.get("sector")
    if sector:
        return str(sector).strip()

    category = info.get("category")
    if category:
        return str(category).strip()

    return None


def get_beta(info):
    return safe_float(info.get("beta"))


def get_eps_ttm(info):
    candidates = [
        info.get("trailingEps"),
        info.get("epsTrailingTwelveMonths"),
        info.get("currentEps"),
    ]

    for candidate in candidates:
        val = safe_float(candidate)
        if val is not None:
            return val

    return None


def get_pe_ttm(info, eps_ttm=None):
    # First try Yahoo's direct trailing P/E field
    direct_candidates = [
        info.get("trailingPE"),
        info.get("priceToEarnings"),
    ]

    for candidate in direct_candidates:
        val = safe_float(candidate)
        if val is not None and val > 0:
            return val

    # If not available, calculate from current price / EPS
    if eps_ttm is None:
        eps_ttm = get_eps_ttm(info)

    current_price = get_current_price_for_calc(info)

    if current_price is None or eps_ttm is None or eps_ttm <= 0:
        return None

    pe = current_price / eps_ttm
    return round(pe, 6)


def get_ebitda(info):
    return safe_float(info.get("ebitda"))


def get_gross_profit(info):
    return safe_float(info.get("grossProfits"))


def get_short_pct_float(info):
    candidates = [
        info.get("shortPercentOfFloat"),
        info.get("shortRatio"),
    ]

    for candidate in candidates:
        val = normalize_short_float(candidate)
        if val is not None:
            return val

    return None


def get_mean_target(info):
    mean_target = safe_float(info.get("targetMeanPrice"))
    if mean_target is not None:
        return mean_target

    median_target = safe_float(info.get("targetMedianPrice"))
    if median_target is not None:
        return median_target

    return None


def get_target_high(info):
    return safe_float(info.get("targetHighPrice"))


def get_target_low(info):
    return safe_float(info.get("targetLowPrice"))


def get_dividend_yield(info):
    candidates = [
        info.get("dividendYield"),
        info.get("trailingAnnualDividendYield"),
    ]

    for candidate in candidates:
        val = normalize_percent(candidate)
        if val is not None:
            return val

    return None


def get_num_analysts(info):
    return safe_int(info.get("numberOfAnalystOpinions"))


def get_current_price_for_calc(info):
    candidates = [
        info.get("currentPrice"),
        info.get("regularMarketPrice"),
        info.get("previousClose"),
    ]

    for candidate in candidates:
        val = safe_float(candidate)
        if val is not None and val > 0:
            return val

    return None


def calc_upside_downside(current_price, target_high, target_low):
    if current_price is None or current_price <= 0:
        return None, None

    upside = None
    downside = None

    if target_high is not None:
        upside = round(((target_high - current_price) / current_price) * 100, 4)

    if target_low is not None:
        downside = round(((target_low - current_price) / current_price) * 100, 4)

    return upside, downside


def fetch_yahoo_data_for_ticker(ticker):
    try:
        tk = yf.Ticker(ticker)
        info = tk.info or {}

        beta = get_beta(info)
        eps_ttm = get_eps_ttm(info)
        pe_ttm = get_pe_ttm(info, eps_ttm=eps_ttm)
        ebitda = get_ebitda(info)
        gross_profit = get_gross_profit(info)
        short_pct_float = get_short_pct_float(info)
        mean_target = get_mean_target(info)
        target_high = get_target_high(info)
        target_low = get_target_low(info)
        num_analysts = get_num_analysts(info)
        sector = get_sector(info)
        dividend_yield = get_dividend_yield(info)

        current_price = get_current_price_for_calc(info)
        analyst_upside, analyst_downside = calc_upside_downside(current_price, target_high, target_low)

        row = {
            "Beta": beta,
            "EPS (TTM)": eps_ttm,
            "P/E (TTM)": pe_ttm,
            "EBITDA": ebitda,
            "Short % of Float": short_pct_float,
            "Gross Profit": gross_profit,
            "Analyst Upside": analyst_upside,
            "Analyst Downside": analyst_downside,
            "Mean Target": mean_target,
            "Number of Analysts": num_analysts,
            "Sector": sector,
            "Dividend Yield": dividend_yield,
        }

        # Treat all-null rows as failures so they get marked and skipped
        if all(value is None for value in row.values()):
            return ticker, None

        return ticker, row

    except requests.exceptions.RequestException as e:
        print(f"[YAHOO REQUEST ERROR] {ticker}: {e}")
        return ticker, None
    except Exception as e:
        print(f"[YAHOO ERROR] {ticker}: {e}")
        return ticker, None
# =========================================================
# MAIN
# =========================================================
def main():
    start = time.time()

    conn = get_conn()
    ensure_yahoo_columns(conn)

    total_updated = 0

    while True:
        tickers = fetch_tickers_from_db(conn)

        if not tickers:
            print("No more tickers left to process.")
            break

        print(f"Processing batch of {len(tickers)} tickers...")

        updated = 0
        processed = 0

        with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
            futures = {executor.submit(fetch_yahoo_data_for_ticker, ticker): ticker for ticker in tickers}

            for i, future in enumerate(as_completed(futures), start=1):
                ticker = futures[future]

                try:
                    ticker, row = future.result()
                    processed += 1

                    if row:
                        update_yahoo_row(conn, ticker, row)
                        updated += 1
                    else:
                        mark_yahoo_failed(conn, ticker)

                    mark_yahoo_attempted(conn, ticker)

                except Exception as e:
                    print(f"[FUTURE ERROR] {ticker}: {e}")
                    mark_yahoo_failed(conn, ticker)
                    mark_yahoo_attempted(conn, ticker)

                time.sleep(random.uniform(0.8, 1.4))

                if i % 50 == 0:
                    conn.commit()
                    print(f"Committed through {i} tickers...")
                    time.sleep(SLEEP_BETWEEN_BATCHES)

        conn.commit()

        total_updated += updated

        print(f"Batch complete. Updated: {updated}")
        print("Cooling down before next batch...")

        time.sleep(random.uniform(45, 75))

    conn.close()

    elapsed_minutes = (time.time() - start) / 60
    print(f"Done. Total updated: {total_updated}")
    print(f"Total runtime: {elapsed_minutes:.2f} minutes")


if __name__ == "__main__":
    main()