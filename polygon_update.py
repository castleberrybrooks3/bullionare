from dotenv import load_dotenv
import os

load_dotenv()
import traceback
import time
import json
import requests
import psycopg2
from datetime import datetime, UTC
from concurrent.futures import ThreadPoolExecutor, as_completed
from psycopg2.extras import RealDictCursor, execute_values

API_KEY = os.getenv("POLYGON_API_KEY", "").strip()
if not API_KEY:
    raise ValueError("POLYGON_API_KEY is missing or empty.")

DATABASE_URL = os.getenv("DATABASE_URL", "").strip()
if not DATABASE_URL:
    raise ValueError("DATABASE_URL is missing or empty.")

BASE_URL = "https://api.polygon.io"
MAX_WORKERS = 12

USE_FINANCIALS = False

session = requests.Session()


# =========================================================
# HTTP HELPERS
# =========================================================

def get_json(path: str, params: dict | None = None, timeout: int = 30):
    if params is None:
        params = {}

    params = {**params, "apiKey": API_KEY}
    url = f"{BASE_URL}{path}"

    for attempt in range(4):
        try:
            response = session.get(url, params=params, timeout=timeout)
            response.raise_for_status()
            return response.json()

        except requests.HTTPError as e:
            status_code = e.response.status_code if e.response is not None else None

            if status_code in (403, 404):
                print(f"[HTTP {status_code}] {url}")
                return None

            if attempt == 3:
                print(f"[HTTP ERROR] {url}: {e}")
                return None

            time.sleep(1.5 * (attempt + 1))

        except Exception as e:
            if attempt == 3:
                print(f"[REQUEST ERROR] {url}: {e}")
                return None

            time.sleep(1.5 * (attempt + 1))

    return None


def paginate(path: str, params: dict | None = None, results_key: str = "results"):
    current_params = dict(params or {})

    while True:
        data = get_json(path, current_params, timeout=60)
        if not data:
            return

        results = data.get(results_key, [])
        for row in results:
            yield row

        next_url = data.get("next_url")
        if not next_url:
            return

        stripped = next_url.replace(BASE_URL, "")
        if "?" not in stripped:
            return

        next_path, query_string = stripped.split("?", 1)
        path = next_path
        current_params = {}

        for pair in query_string.split("&"):
            if "=" in pair:
                k, v = pair.split("=", 1)
                current_params[k] = v


def get_conn():
    db_url = DATABASE_URL
    if "sslmode=" not in db_url:
        separator = "&" if "?" in db_url else "?"
        db_url = f"{db_url}{separator}sslmode=require"

    conn = psycopg2.connect(
        db_url,
        cursor_factory=RealDictCursor,
        connect_timeout=10,
        keepalives=1,
        keepalives_idle=30,
        keepalives_interval=10,
        keepalives_count=5,
    )
    return conn
def ensure_conn(conn):
    try:
        if conn is None or conn.closed != 0:
            return get_conn()
        return conn
    except Exception:
        try:
            conn.close()
        except Exception:
            pass
        return get_conn()

# =========================================================
# DB SETUP
# =========================================================

def ensure_tables(conn):
    cursor = conn.cursor()

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS stocks (
            "Ticker" TEXT PRIMARY KEY,

            "Type" TEXT,
            "Company Name" TEXT,
            "Description" TEXT,

            "Current Price" REAL,
            "Previous Close" REAL,
            "Day Open" REAL,
            "Day High" REAL,
            "Day Low" REAL,
            "Day Volume" REAL,
            "Today Change %" REAL,
            "Market Cap" REAL,

            "RSI" REAL,
            "MACD" REAL,
            "MACD Signal" REAL,
            "MACD Histogram" REAL,
            "SMA 20" REAL,

            "Latest Dividend Amount" REAL,
            "Latest Ex-Dividend Date" TEXT,
            "Latest Pay Date" TEXT,
            "Dividend Frequency" INTEGER,

            "Latest 10-K Date" TEXT,
            "Latest 10-K URL" TEXT,
            "Latest 10-Q Date" TEXT,
            "Latest 10-Q URL" TEXT,

            "Last Updated" TEXT
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS stock_details (
            "Ticker" TEXT PRIMARY KEY,
            "Balance Sheet JSON" TEXT,
            "Income Statement JSON" TEXT,
            "Cash Flow JSON" TEXT,
            "Financials Last Updated" TEXT,
            FOREIGN KEY ("Ticker") REFERENCES stocks("Ticker")
        )
    """)

    conn.commit()


def ensure_tickers_batch(conn, tickers: list[str]):
    if not tickers:
        return

    cursor = conn.cursor()

    stock_rows = [(ticker,) for ticker in tickers]
    detail_rows = [(ticker,) for ticker in tickers]

    execute_values(
        cursor,
        'INSERT INTO stocks ("Ticker") VALUES %s ON CONFLICT ("Ticker") DO NOTHING',
        stock_rows,
        page_size=1000
    )

    execute_values(
        cursor,
        'INSERT INTO stock_details ("Ticker") VALUES %s ON CONFLICT ("Ticker") DO NOTHING',
        detail_rows,
        page_size=1000
    )


def update_polygon_stock_row(conn, ticker: str, row: dict):
    cursor = conn.cursor()

    cursor.execute("""
        UPDATE stocks
        SET
            "Type" = %s,
            "Company Name" = %s,
            "Description" = %s,
            "Current Price" = %s,
            "Previous Close" = %s,
            "Day Open" = %s,
            "Day High" = %s,
            "Day Low" = %s,
            "Day Volume" = %s,
            "Today Change %%" = %s,
            "Market Cap" = %s,
            "RSI" = %s,
            "MACD" = %s,
            "MACD Signal" = %s,
            "MACD Histogram" = %s,
            "SMA 20" = %s,
            "Latest Dividend Amount" = %s,
            "Latest Ex-Dividend Date" = %s,
            "Latest Pay Date" = %s,
            "Dividend Frequency" = %s,
            "Latest 10-K Date" = %s,
            "Latest 10-K URL" = %s,
            "Latest 10-Q Date" = %s,
            "Latest 10-Q URL" = %s,
            "Last Updated" = %s
        WHERE "Ticker" = %s
    """, (
        row.get("Type"),
        row.get("Company Name"),
        row.get("Description"),
        row.get("Current Price"),
        row.get("Previous Close"),
        row.get("Day Open"),
        row.get("Day High"),
        row.get("Day Low"),
        row.get("Day Volume"),
        row.get("Today Change %"),
        row.get("Market Cap"),
        row.get("RSI"),
        row.get("MACD"),
        row.get("MACD Signal"),
        row.get("MACD Histogram"),
        row.get("SMA 20"),
        row.get("Latest Dividend Amount"),
        row.get("Latest Ex-Dividend Date"),
        row.get("Latest Pay Date"),
        row.get("Dividend Frequency"),
        row.get("Latest 10-K Date"),
        row.get("Latest 10-K URL"),
        row.get("Latest 10-Q Date"),
        row.get("Latest 10-Q URL"),
        row.get("Last Updated"),
        ticker
    ))


def update_stock_details_row(conn, ticker: str, row: dict):
    cursor = conn.cursor()

    cursor.execute("""
        UPDATE stock_details
        SET
            "Balance Sheet JSON" = %s,
            "Income Statement JSON" = %s,
            "Cash Flow JSON" = %s,
            "Financials Last Updated" = %s
        WHERE "Ticker" = %s
    """, (
        row.get("Balance Sheet JSON"),
        row.get("Income Statement JSON"),
        row.get("Cash Flow JSON"),
        row.get("Financials Last Updated"),
        ticker
    ))


def fetch_existing_snapshot_fields(conn, tickers: list[str]):
    if not tickers:
        return {}

    cursor = conn.cursor()
    cursor.execute("""
        SELECT
            "Ticker",
            "Type",
            "Company Name",
            "Description",
            "Market Cap",
            "RSI",
            "MACD",
            "MACD Signal",
            "MACD Histogram",
            "SMA 20",
            "Latest Dividend Amount",
            "Latest Ex-Dividend Date",
            "Latest Pay Date",
            "Dividend Frequency",
            "Latest 10-K Date",
            "Latest 10-K URL",
            "Latest 10-Q Date",
            "Latest 10-Q URL"
        FROM stocks
        WHERE "Ticker" = ANY(%s)
    """, (tickers,))

    rows = cursor.fetchall()
    return {row["Ticker"]: row for row in rows}


def fetch_existing_price_fields(conn, tickers: list[str]):
    if not tickers:
        return {}

    cursor = conn.cursor()

    if len(tickers) == 1:
        cursor.execute("""
            SELECT
                "Ticker",
                "Current Price",
                "Previous Close",
                "Day Open",
                "Day High",
                "Day Low",
                "Day Volume",
                "Today Change %%",
                "Last Updated"
            FROM stocks
            WHERE "Ticker" = %s
        """, (tickers[0],))
    else:
        cursor.execute("""
            SELECT
                "Ticker",
                "Current Price",
                "Previous Close",
                "Day Open",
                "Day High",
                "Day Low",
                "Day Volume",
                "Today Change %%",
                "Last Updated"
            FROM stocks
            WHERE "Ticker" = ANY(%s)
        """, (tickers,))

    rows = cursor.fetchall()
    return {row["Ticker"]: row for row in rows}


def update_snapshot_batch(conn, rows: list[dict]):
    if not rows:
        return

    cursor = conn.cursor()

    values = [
        (
            row["Ticker"],
            row.get("Current Price"),
            row.get("Previous Close"),
            row.get("Day Open"),
            row.get("Day High"),
            row.get("Day Low"),
            row.get("Day Volume"),
            row.get("Today Change %"),
            row.get("Last Updated"),
        )
        for row in rows
    ]

    execute_values(
        cursor,
        """
        UPDATE stocks AS s
        SET
            "Current Price" = v."Current Price",
            "Previous Close" = v."Previous Close",
            "Day Open" = v."Day Open",
            "Day High" = v."Day High",
            "Day Low" = v."Day Low",
            "Day Volume" = v."Day Volume",
            "Today Change %%" = v."Today Change %%",
            "Last Updated" = v."Last Updated"
        FROM (
            VALUES %s
        ) AS v(
            "Ticker",
            "Current Price",
            "Previous Close",
            "Day Open",
            "Day High",
            "Day Low",
            "Day Volume",
            "Today Change %%",
            "Last Updated"
        )
        WHERE s."Ticker" = v."Ticker"
        """,
        values,
        page_size=1000
    )


def update_main_rows_batch(conn, rows: list[tuple[str, dict]]):
    if not rows:
        return

    cursor = conn.cursor()

    values = [
        (
            ticker,
            row.get("Type"),
            row.get("Company Name"),
            row.get("Description"),
            row.get("Current Price"),
            row.get("Previous Close"),
            row.get("Day Open"),
            row.get("Day High"),
            row.get("Day Low"),
            row.get("Day Volume"),
            row.get("Today Change %"),
            row.get("Market Cap"),
            row.get("RSI"),
            row.get("MACD"),
            row.get("MACD Signal"),
            row.get("MACD Histogram"),
            row.get("SMA 20"),
            row.get("Latest Dividend Amount"),
            row.get("Latest Ex-Dividend Date"),
            row.get("Latest Pay Date"),
            row.get("Dividend Frequency"),
            row.get("Latest 10-K Date"),
            row.get("Latest 10-K URL"),
            row.get("Latest 10-Q Date"),
            row.get("Latest 10-Q URL"),
            row.get("Last Updated"),
        )
        for ticker, row in rows
    ]

    execute_values(
        cursor,
        """
        UPDATE stocks AS s
        SET
            "Type" = v."Type",
            "Company Name" = v."Company Name",
            "Description" = v."Description",
            "Current Price" = v."Current Price",
            "Previous Close" = v."Previous Close",
            "Day Open" = v."Day Open",
            "Day High" = v."Day High",
            "Day Low" = v."Day Low",
            "Day Volume" = v."Day Volume",
            "Today Change %%" = v."Today Change %%",
            "Market Cap" = v."Market Cap",
            "RSI" = v."RSI",
            "MACD" = v."MACD",
            "MACD Signal" = v."MACD Signal",
            "MACD Histogram" = v."MACD Histogram",
            "SMA 20" = v."SMA 20",
            "Latest Dividend Amount" = v."Latest Dividend Amount",
            "Latest Ex-Dividend Date" = v."Latest Ex-Dividend Date",
            "Latest Pay Date" = v."Latest Pay Date",
            "Dividend Frequency" = v."Dividend Frequency",
            "Latest 10-K Date" = v."Latest 10-K Date",
            "Latest 10-K URL" = v."Latest 10-K URL",
            "Latest 10-Q Date" = v."Latest 10-Q Date",
            "Latest 10-Q URL" = v."Latest 10-Q URL",
            "Last Updated" = v."Last Updated"
        FROM (
            VALUES %s
        ) AS v(
            "Ticker",
            "Type",
            "Company Name",
            "Description",
            "Current Price",
            "Previous Close",
            "Day Open",
            "Day High",
            "Day Low",
            "Day Volume",
            "Today Change %%",
            "Market Cap",
            "RSI",
            "MACD",
            "MACD Signal",
            "MACD Histogram",
            "SMA 20",
            "Latest Dividend Amount",
            "Latest Ex-Dividend Date",
            "Latest Pay Date",
            "Dividend Frequency",
            "Latest 10-K Date",
            "Latest 10-K URL",
            "Latest 10-Q Date",
            "Latest 10-Q URL",
            "Last Updated"
        )
        WHERE s."Ticker" = v."Ticker"
        """,
        values,
        page_size=250
    )


def update_detail_rows_batch(conn, rows: list[tuple[str, dict]]):
    if not rows:
        return

    cursor = conn.cursor()

    values = [
        (
            ticker,
            row.get("Balance Sheet JSON"),
            row.get("Income Statement JSON"),
            row.get("Cash Flow JSON"),
            row.get("Financials Last Updated"),
        )
        for ticker, row in rows
    ]

    execute_values(
        cursor,
        """
        UPDATE stock_details AS d
        SET
            "Balance Sheet JSON" = v."Balance Sheet JSON",
            "Income Statement JSON" = v."Income Statement JSON",
            "Cash Flow JSON" = v."Cash Flow JSON",
            "Financials Last Updated" = v."Financials Last Updated"
        FROM (
            VALUES %s
        ) AS v(
            "Ticker",
            "Balance Sheet JSON",
            "Income Statement JSON",
            "Cash Flow JSON",
            "Financials Last Updated"
        )
        WHERE d."Ticker" = v."Ticker"
        """,
        values,
        page_size=250
    )


# =========================================================
# POLYGON FETCHERS
# =========================================================

def fetch_all_polygon_tickers():
    tickers = []
    type_counts = {}

    for row in paginate(
        "/v3/reference/tickers",
        params={
            "market": "stocks",
            "locale": "us",
            "active": "true",
            "limit": 1000
        },
        results_key="results"
    ):
        ticker = row.get("ticker")
        ttype = row.get("type") or "UNKNOWN"

        if ticker:
            tickers.append(ticker)
            type_counts[ttype] = type_counts.get(ttype, 0) + 1

    tickers = sorted(set(tickers))
    print(f"Total Polygon tickers fetched: {len(tickers)}")
    print("Ticker type counts:")
    for k in sorted(type_counts):
        print(f"  {k}: {type_counts[k]}")
    return tickers


def fetch_full_market_snapshot():
    data = get_json(
        "/v2/snapshot/locale/us/markets/stocks/tickers",
        {"include_otc": "true"},
        timeout=120
    )

    if not data:
        return {}

    snapshot_map = {}

    for row in data.get("tickers", []):
        ticker = row.get("ticker")
        if not ticker:
            continue

        day = row.get("day", {}) or {}
        prev_day = row.get("prevDay", {}) or {}
        min_bar = row.get("min", {}) or {}
        last_trade = row.get("lastTrade", {}) or {}

        current_price = (
            last_trade.get("p")
            or min_bar.get("c")
            or day.get("c")
            or prev_day.get("c")
        )

        snapshot_map[ticker] = {
            "Current Price": current_price,
            "Previous Close": prev_day.get("c"),
            "Day Open": day.get("o"),
            "Day High": day.get("h"),
            "Day Low": day.get("l"),
            "Day Volume": day.get("v"),
            "Today Change %": row.get("todaysChangePerc"),
            "Last Updated": datetime.now(UTC).isoformat(timespec="seconds"),
        }

    print(f"Snapshot rows fetched: {len(snapshot_map)}")
    return snapshot_map


def fetch_reference_data(ticker: str):
    data = get_json(f"/v3/reference/tickers/{ticker}")
    if not data:
        return None

    result = data.get("results", {}) or {}
    if not result:
        return None

    description = (
        result.get("description")
        or result.get("sic_description")
        or result.get("name")
    )

    return {
        "Type": result.get("type"),
        "Company Name": result.get("name"),
        "Description": description,
        "Market Cap": result.get("market_cap"),
    }


def fetch_indicator_value(path: str, ticker: str, extra_params: dict | None = None):
    params = {
        "timespan": "day",
        "series_type": "close",
        "order": "desc",
        "limit": 1,
    }

    if extra_params:
        params.update(extra_params)

    data = get_json(path.format(ticker=ticker), params)
    if not data:
        return None

    results = data.get("results", {}) or {}
    values = results.get("values", []) or []
    if not values:
        return None

    return values[0]


def fetch_indicators_data(ticker: str):
    rsi = fetch_indicator_value(
        "/v1/indicators/rsi/{ticker}",
        ticker,
        {"window": 14}
    )

    sma = fetch_indicator_value(
        "/v1/indicators/sma/{ticker}",
        ticker,
        {"window": 20}
    )

    macd = fetch_indicator_value(
        "/v1/indicators/macd/{ticker}",
        ticker,
        {
            "short_window": 12,
            "long_window": 26,
            "signal_window": 9
        }
    )

    return {
        "RSI": rsi.get("value") if rsi else None,
        "SMA 20": sma.get("value") if sma else None,
        "MACD": macd.get("value") if macd else None,
        "MACD Signal": macd.get("signal") if macd else None,
        "MACD Histogram": macd.get("histogram") if macd else None,
    }


def fetch_dividend_data(ticker: str):
    data = get_json("/stocks/v1/dividends", {
        "ticker": ticker,
        "sort": "ex_dividend_date.desc",
        "limit": 1
    })

    if not data:
        return None

    results = data.get("results", [])
    if not results:
        return None

    row = results[0]
    return {
        "Latest Dividend Amount": row.get("cash_amount"),
        "Latest Ex-Dividend Date": row.get("ex_dividend_date"),
        "Latest Pay Date": row.get("pay_date"),
        "Dividend Frequency": row.get("frequency"),
    }


def fetch_filings_data(ticker: str):
    data = get_json("/stocks/filings/vX/index", {
        "ticker": ticker,
        "form_type.any_of": "10-K,10-Q",
        "sort": "filing_date.desc",
        "limit": 20
    })

    if not data:
        return None

    latest_10k = None
    latest_10q = None

    for row in data.get("results", []):
        form_type = row.get("form_type")

        if form_type == "10-K" and latest_10k is None:
            latest_10k = row
        elif form_type == "10-Q" and latest_10q is None:
            latest_10q = row

        if latest_10k and latest_10q:
            break

    return {
        "Latest 10-K Date": latest_10k.get("filing_date") if latest_10k else None,
        "Latest 10-K URL": latest_10k.get("filing_url") if latest_10k else None,
        "Latest 10-Q Date": latest_10q.get("filing_date") if latest_10q else None,
        "Latest 10-Q URL": latest_10q.get("filing_url") if latest_10q else None,
    }


def fetch_statement_json(path: str, ticker: str):
    data = get_json(path, {
        "ticker": ticker,
        "limit": 1
    }, timeout=45)

    if not data:
        return None

    results = data.get("results", [])
    if not results:
        return None

    return json.dumps(results[0], separators=(",", ":"), ensure_ascii=False)


def fetch_statement_data(ticker: str):
    if not USE_FINANCIALS:
        return None

    balance_sheet = fetch_statement_json("/stocks/financials/v1/balance-sheets", ticker)
    income_statement = fetch_statement_json("/stocks/financials/v1/income-statements", ticker)
    cash_flow = fetch_statement_json("/stocks/financials/v1/cash-flow-statements", ticker)

    if not any([balance_sheet, income_statement, cash_flow]):
        return None

    return {
        "Balance Sheet JSON": balance_sheet,
        "Income Statement JSON": income_statement,
        "Cash Flow JSON": cash_flow,
        "Financials Last Updated": datetime.now(UTC).isoformat(timespec="seconds"),
    }


def fetch_ticker_bundle(ticker: str):
    stock_row = {}
    details_row = {}

    reference_data = fetch_reference_data(ticker)
    indicators_data = fetch_indicators_data(ticker)
    dividend_data = fetch_dividend_data(ticker)
    filings_data = fetch_filings_data(ticker)
    statement_data = fetch_statement_data(ticker) if USE_FINANCIALS else None

    for block in (reference_data, indicators_data, dividend_data, filings_data):
        if block:
            stock_row.update(block)

    if stock_row:
        stock_row["Last Updated"] = datetime.now(UTC).isoformat(timespec="seconds")

    if statement_data:
        details_row.update(statement_data)

    return ticker, stock_row, details_row


# =========================================================
# CLEANUP
# =========================================================

def clean_database(conn):
    cursor = conn.cursor()

    cursor.execute("""
        DELETE FROM stock_details
        WHERE "Ticker" NOT IN (SELECT "Ticker" FROM stocks)
    """)

    conn.commit()

    cursor.execute('SELECT COUNT(*) AS count FROM stocks')
    count = cursor.fetchone()["count"]

    cursor.execute('SELECT COUNT(*) AS count FROM stocks WHERE "Current Price" IS NOT NULL')
    priced = cursor.fetchone()["count"]

    print(f"Final kept universe: {count} tickers")
    print(f"Tickers with price data: {priced}")


# =========================================================
# MAIN
# =========================================================

def main():
    start_time = time.time()

    conn = get_conn()
    conn = ensure_conn(conn)
    ensure_tables(conn)

    tickers = fetch_all_polygon_tickers()
    if not tickers:
        conn.close()
        raise ValueError("No Polygon tickers were fetched.")

    print(f"Found {len(tickers)} Polygon tickers to process")

    # -----------------------------------------------------
    # Batch ensure ticker universe exists
    # -----------------------------------------------------
    for i in range(0, len(tickers), 1000):
        conn = ensure_conn(conn)
        batch = tickers[i:i + 1000]
        ensure_tickers_batch(conn, batch)
        conn.commit()

        if i == 0:
            for j, ticker in enumerate(batch[:5], start=1):
                print(f"Inserted ticker {j}: {ticker}")

        print(f"Ensured {min(i + 1000, len(tickers))} tickers in DB...")

    # -----------------------------------------------------
    # Snapshot phase
    # -----------------------------------------------------
    snapshot_map = fetch_full_market_snapshot()

    snapshot_updates = 0

    for i in range(0, len(tickers), 1000):
        conn = ensure_conn(conn)
        batch = tickers[i:i + 1000]
        existing_map = fetch_existing_snapshot_fields(conn, batch)
        snapshot_batch = []

        for ticker in batch:
            snapshot_data = snapshot_map.get(ticker)
            if not snapshot_data:
                continue

            existing = existing_map.get(ticker)

            current_row = {
                "Ticker": ticker,
                "Current Price": snapshot_data.get("Current Price"),
                "Previous Close": snapshot_data.get("Previous Close"),
                "Day Open": snapshot_data.get("Day Open"),
                "Day High": snapshot_data.get("Day High"),
                "Day Low": snapshot_data.get("Day Low"),
                "Day Volume": snapshot_data.get("Day Volume"),
                "Today Change %": snapshot_data.get("Today Change %"),
                "Last Updated": snapshot_data.get("Last Updated"),
            }

            if existing:
                pass

            snapshot_batch.append(current_row)
            snapshot_updates += 1

        update_snapshot_batch(conn, snapshot_batch)
        conn.commit()
        print(f"Applied snapshot data through {min(i + 1000, len(tickers))} tickers...")

    print(f"Snapshot-updated rows: {snapshot_updates}")

    # -----------------------------------------------------
    # Detailed enrichment phase
    # -----------------------------------------------------
    updated_main_rows = 0
    updated_detail_rows = 0

    conn = ensure_conn(conn)
    price_cache = {}

    for i in range(0, len(tickers), 1000):
        batch = tickers[i:i + 1000]
        fetched = fetch_existing_price_fields(conn, batch)
        price_cache.update(fetched)

    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        futures = {executor.submit(fetch_ticker_bundle, ticker): ticker for ticker in tickers}

        main_row_buffer = []
        detail_row_buffer = []

        for i, future in enumerate(as_completed(futures), start=1):
            fallback_ticker = futures[future]

            try:
                ticker, stock_row, details_row = future.result()

                if stock_row:
                    existing = price_cache.get(ticker)

                    if existing:
                        stock_row.setdefault("Current Price", existing["Current Price"])
                        stock_row.setdefault("Previous Close", existing["Previous Close"])
                        stock_row.setdefault("Day Open", existing["Day Open"])
                        stock_row.setdefault("Day High", existing["Day High"])
                        stock_row.setdefault("Day Low", existing["Day Low"])
                        stock_row.setdefault("Day Volume", existing["Day Volume"])
                        stock_row.setdefault("Today Change %", existing["Today Change %"])
                        stock_row["Last Updated"] = datetime.now(UTC).isoformat(timespec="seconds")

                    main_row_buffer.append((ticker, stock_row))
                    updated_main_rows += 1

                if details_row:
                    detail_row_buffer.append((ticker, details_row))
                    updated_detail_rows += 1

            except Exception as e:
                print(f"[BUNDLE ERROR] {fallback_ticker}: {type(e).__name__}: {e}")
                traceback.print_exc()

            # ✅ THIS BLOCK MUST BE OUTSIDE THE EXCEPT
            if i % 250 == 0:
                conn = ensure_conn(conn)
                update_main_rows_batch(conn, main_row_buffer)
                update_detail_rows_batch(conn, detail_row_buffer)
                conn.commit()

                main_row_buffer = []
                detail_row_buffer = []

                print(f"Committed through {i} detailed tickers...")
        conn = ensure_conn(conn)
        update_main_rows_batch(conn, main_row_buffer)
        update_detail_rows_batch(conn, detail_row_buffer)
        conn.commit()

    # -----------------------------------------------------
    # Cleanup
    # -----------------------------------------------------
    conn = ensure_conn(conn)
    clean_database(conn)
    conn.close()

    elapsed_minutes = (time.time() - start_time) / 60
    print(f"Done. Updated main rows: {updated_main_rows}")
    print(f"Done. Updated detail rows: {updated_detail_rows}")
    print(f"Total runtime: {elapsed_minutes:.2f} minutes")


if __name__ == "__main__":
    main()