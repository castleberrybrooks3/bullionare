import os
import time
import math
import statistics
import requests
import psycopg2
from psycopg2.extras import execute_values
from datetime import datetime, timedelta
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "").strip()
POLYGON_API_KEY = os.getenv("POLYGON_API_KEY", "").strip()
print(f"Polygon key loaded: {bool(POLYGON_API_KEY)} | length={len(POLYGON_API_KEY)}")

LOOKBACK_DAYS = 400
SLEEP_SECONDS = 0.15


def get_connection():
    if not DATABASE_URL:
        raise ValueError("DATABASE_URL is missing")

    db_url = DATABASE_URL
    if "sslmode=" not in db_url:
        separator = "&" if "?" in db_url else "?"
        db_url = f"{db_url}{separator}sslmode=require"

    return psycopg2.connect(db_url)

def ensure_standard_deviation_column(conn):
    """
    Ensures the stocks table has a column for trailing 1-year
    annualized standard deviation of daily returns.
    """
    with conn.cursor() as cur:
        cur.execute("""
            ALTER TABLE stocks
            ADD COLUMN IF NOT EXISTS "Standard Deviation (1Y)" REAL
        """)

    conn.commit()


def get_universe(conn):
    """
    Load every Common Stock and ETF from the stocks table
    that has a current price.

    No arbitrary ticker-count cap.
    """

    query = """
        SELECT
            "Ticker" AS ticker,
            "Company Name" AS name,
            "Type" AS type,
            "Sector" AS sector
        FROM stocks
        WHERE "Ticker" IS NOT NULL
          AND TRIM("Ticker") != ''
          AND "Current Price" IS NOT NULL
          AND "Type" IN ('CS', 'ETF')
        ORDER BY
          CASE
            WHEN "Ticker" IN (
              'AAPL', 'MSFT', 'NVDA', 'AMZN', 'GOOGL', 'GOOG', 'META', 'AVGO', 'TSLA',
              'JPM', 'WMT', 'LLY', 'V', 'MA', 'UNH', 'XOM', 'COST', 'HD',
              'PG', 'JNJ', 'BAC', 'NFLX', 'KO', 'PEP', 'CVX', 'ABBV', 'MRK',
              'AMD', 'CRM', 'ADBE', 'ORCL', 'INTC', 'QCOM', 'TXN', 'NOW',
              'SPY', 'QQQ', 'VOO', 'VTI', 'DIA', 'IWM', 'XLK', 'XLF', 'XLE', 'XLV',
              'XLY', 'XLP', 'XLI', 'XLU', 'XLRE', 'SMH', 'SOXX'
            )
            THEN 0
            ELSE 1
          END,
          "Day Volume" DESC NULLS LAST
    """

    with conn.cursor() as cur:
        cur.execute(query)
        rows = cur.fetchall()

    universe = []

    for row in rows:
        ticker, name, security_type, sector = row

        if ticker:
            universe.append({
                "ticker": str(ticker).upper().strip(),
                "name": name,
                "type": security_type,
                "sector": sector,
            })

    return universe


def fetch_polygon_daily_prices(ticker):
    if not POLYGON_API_KEY:
        raise ValueError("POLYGON_API_KEY is missing")

    end_date = datetime.utcnow().date()
    start_date = end_date - timedelta(days=LOOKBACK_DAYS)

    url = (
        f"https://api.polygon.io/v2/aggs/ticker/{ticker}/range/1/day/"
        f"{start_date.isoformat()}/{end_date.isoformat()}"
    )

    params = {
        "adjusted": "true",
        "sort": "asc",
        "limit": 5000,
        "apiKey": POLYGON_API_KEY,
    }

    try:
        response = requests.get(url, params=params, timeout=25)
        response.raise_for_status()
        data = response.json()
    except Exception as e:
        print(f"[PRICE ERROR] {ticker}: {e}")
        return []

    results = data.get("results") or []

    rows = []

    for bar in results:
        timestamp = bar.get("t")
        close = bar.get("c")

        if timestamp is None or close is None:
            continue

        date = datetime.utcfromtimestamp(timestamp / 1000).date()

        rows.append({
            "ticker": ticker,
            "date": date,
            "close": close,
        })

    return rows

def calculate_standard_deviation_1y(price_rows):
    """
    Annualized standard deviation of daily percentage returns.

    Rules:
    - If 253+ valid closing prices exist, use the latest 253 closes
      to produce exactly 252 daily returns.
    - If fewer than 253 closes exist, use all available history.
    - Require at least 20 daily returns.
    - Returned as a percentage:
        24.75 means 24.75%
    """

    if not price_rows:
        return None

    sorted_rows = sorted(price_rows, key=lambda row: row["date"])

    closes = []

    for row in sorted_rows:
        try:
            close = float(row["close"])

            if close > 0:
                closes.append(close)

        except (TypeError, ValueError):
            continue

    # Maximum of 253 closing prices = 252 daily returns
    if len(closes) > 253:
        closes = closes[-253:]

    if len(closes) < 21:
        return None

    daily_returns = []

    for i in range(1, len(closes)):
        previous_close = closes[i - 1]
        current_close = closes[i]

        if previous_close <= 0:
            continue

        daily_return = (current_close / previous_close) - 1
        daily_returns.append(daily_return)

    # Require at least 20 trading-day returns
    if len(daily_returns) < 20:
        return None

    daily_std_dev = statistics.stdev(daily_returns)

    annualized_std_dev = (
        daily_std_dev
        * math.sqrt(252)
        * 100
    )

    return round(annualized_std_dev, 4)

def save_standard_deviation(conn, ticker, standard_deviation):
    with conn.cursor() as cur:
        cur.execute("""
            UPDATE stocks
            SET "Standard Deviation (1Y)" = %s
            WHERE "Ticker" = %s
        """, (
            standard_deviation,
            ticker,
        ))

    conn.commit()

def save_prices(conn, ticker_meta, price_rows):
    if not price_rows:
        return 0

    values = [
        (
            row["ticker"],
            row["date"],
            row["close"],
            ticker_meta.get("name"),
            ticker_meta.get("type"),
            ticker_meta.get("sector"),
        )
        for row in price_rows
    ]

    query = """
        insert into historical_prices (
            ticker,
            date,
            close,
            name,
            type,
            sector
        )
        values %s
        on conflict (ticker, date)
        do update set
            close = excluded.close,
            name = excluded.name,
            type = excluded.type,
            sector = excluded.sector,
            updated_at = now()
    """

    with conn.cursor() as cur:
        execute_values(cur, query, values)

    conn.commit()
    return len(values)

def main():
    conn = get_connection()

    try:
        ensure_standard_deviation_column(conn)

        universe = get_universe(conn)
        print(f"Loaded {len(universe):,} tickers from stocks table.")

        for i, item in enumerate(universe, start=1):
            ticker = item["ticker"]

            print(f"[{i}/{len(universe)}] Fetching {ticker}...")
            prices = fetch_polygon_daily_prices(ticker)

            standard_deviation = calculate_standard_deviation_1y(prices)

            try:
                saved = save_prices(conn, item, prices)

                save_standard_deviation(
                    conn,
                    ticker,
                    standard_deviation,
                )

            except psycopg2.OperationalError as e:
                print(f"[DB CONNECTION LOST] {ticker}: {e}")
                print("Reconnecting and retrying once...")

                try:
                    conn.close()
                except Exception:
                    pass

                conn = get_connection()
                saved = save_prices(conn, item, prices)

            std_display = (
                f"{standard_deviation:.2f}%"
                if standard_deviation is not None
                else "N/A"
            )

            print(
                f"Saved {saved:,} rows for {ticker} | "
                f"1Y Std Dev: {std_display}"
            )

            time.sleep(SLEEP_SECONDS)

    finally:
        conn.close()


if __name__ == "__main__":
    main()