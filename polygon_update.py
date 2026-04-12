import os
import time
import json
import sqlite3
import requests
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed

API_KEY = os.getenv("POLYGON_API_KEY", "").strip()
if not API_KEY:
    raise ValueError("POLYGON_API_KEY is missing or empty.")

DB_FILE = "stocks.db"
BASE_URL = "https://api.polygon.io"
MAX_WORKERS = 8

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


# =========================================================
# DB SETUP
# =========================================================

def ensure_tables(conn: sqlite3.Connection):
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


def ensure_ticker_exists(conn: sqlite3.Connection, ticker: str):
    conn.execute(
        'INSERT OR IGNORE INTO stocks ("Ticker") VALUES (?)',
        (ticker,)
    )
    conn.execute(
        'INSERT OR IGNORE INTO stock_details ("Ticker") VALUES (?)',
        (ticker,)
    )


def update_polygon_stock_row(conn: sqlite3.Connection, ticker: str, row: dict):
    conn.execute("""
        UPDATE stocks
        SET
            "Type" = ?,
            "Company Name" = ?,
            "Description" = ?,
            "Current Price" = ?,
            "Previous Close" = ?,
            "Day Open" = ?,
            "Day High" = ?,
            "Day Low" = ?,
            "Day Volume" = ?,
            "Today Change %" = ?,
            "Market Cap" = ?,
            "RSI" = ?,
            "MACD" = ?,
            "MACD Signal" = ?,
            "MACD Histogram" = ?,
            "SMA 20" = ?,
            "Latest Dividend Amount" = ?,
            "Latest Ex-Dividend Date" = ?,
            "Latest Pay Date" = ?,
            "Dividend Frequency" = ?,
            "Latest 10-K Date" = ?,
            "Latest 10-K URL" = ?,
            "Latest 10-Q Date" = ?,
            "Latest 10-Q URL" = ?,
            "Last Updated" = ?
        WHERE "Ticker" = ?
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


def update_stock_details_row(conn: sqlite3.Connection, ticker: str, row: dict):
    conn.execute("""
        UPDATE stock_details
        SET
            "Balance Sheet JSON" = ?,
            "Income Statement JSON" = ?,
            "Cash Flow JSON" = ?,
            "Financials Last Updated" = ?
        WHERE "Ticker" = ?
    """, (
        row.get("Balance Sheet JSON"),
        row.get("Income Statement JSON"),
        row.get("Cash Flow JSON"),
        row.get("Financials Last Updated"),
        ticker
    ))


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
            "Last Updated": datetime.utcnow().isoformat(timespec="seconds"),
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
    balance_sheet = fetch_statement_json("/stocks/financials/v1/balance-sheets", ticker)
    income_statement = fetch_statement_json("/stocks/financials/v1/income-statements", ticker)
    cash_flow = fetch_statement_json("/stocks/financials/v1/cash-flow-statements", ticker)

    if not any([balance_sheet, income_statement, cash_flow]):
        return None

    return {
        "Balance Sheet JSON": balance_sheet,
        "Income Statement JSON": income_statement,
        "Cash Flow JSON": cash_flow,
        "Financials Last Updated": datetime.utcnow().isoformat(timespec="seconds"),
    }


def fetch_ticker_bundle(ticker: str):
    stock_row = {}
    details_row = {}

    reference_data = fetch_reference_data(ticker)
    indicators_data = fetch_indicators_data(ticker)
    dividend_data = fetch_dividend_data(ticker)
    filings_data = fetch_filings_data(ticker)
    statement_data = fetch_statement_data(ticker)

    for block in (reference_data, indicators_data, dividend_data, filings_data):
        if block:
            stock_row.update(block)

    if stock_row:
        stock_row["Last Updated"] = datetime.utcnow().isoformat(timespec="seconds")

    if statement_data:
        details_row.update(statement_data)

    return ticker, stock_row, details_row


# =========================================================
# CLEANUP
# =========================================================

def clean_database(conn: sqlite3.Connection):
    conn.execute("""
        DELETE FROM stock_details
        WHERE "Ticker" NOT IN (SELECT "Ticker" FROM stocks)
    """)

    conn.commit()

    count = conn.execute('SELECT COUNT(*) FROM stocks').fetchone()[0]
    priced = conn.execute('SELECT COUNT(*) FROM stocks WHERE "Current Price" IS NOT NULL').fetchone()[0]

    print(f"Final kept universe: {count} tickers")
    print(f"Tickers with price data: {priced}")


# =========================================================
# MAIN
# =========================================================

def main():
    start_time = time.time()

    conn = sqlite3.connect(DB_FILE)
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA synchronous=NORMAL;")

    ensure_tables(conn)

    tickers = fetch_all_polygon_tickers()
    if not tickers:
        conn.close()
        raise ValueError("No Polygon tickers were fetched.")

    print(f"Found {len(tickers)} Polygon tickers to process")

    for i, ticker in enumerate(tickers, start=1):
        ensure_ticker_exists(conn, ticker)

        if i % 2000 == 0:
            conn.commit()
            print(f"Ensured {i} tickers in DB...")

    conn.commit()

    snapshot_map = fetch_full_market_snapshot()

    snapshot_updates = 0
    for i, ticker in enumerate(tickers, start=1):
        snapshot_data = snapshot_map.get(ticker)
        if snapshot_data:
            current_row = {
                "Type": None,
                "Company Name": None,
                "Description": None,
                "Current Price": snapshot_data.get("Current Price"),
                "Previous Close": snapshot_data.get("Previous Close"),
                "Day Open": snapshot_data.get("Day Open"),
                "Day High": snapshot_data.get("Day High"),
                "Day Low": snapshot_data.get("Day Low"),
                "Day Volume": snapshot_data.get("Day Volume"),
                "Today Change %": snapshot_data.get("Today Change %"),
                "Market Cap": None,
                "RSI": None,
                "MACD": None,
                "MACD Signal": None,
                "MACD Histogram": None,
                "SMA 20": None,
                "Latest Dividend Amount": None,
                "Latest Ex-Dividend Date": None,
                "Latest Pay Date": None,
                "Dividend Frequency": None,
                "Latest 10-K Date": None,
                "Latest 10-K URL": None,
                "Latest 10-Q Date": None,
                "Latest 10-Q URL": None,
                "Last Updated": snapshot_data.get("Last Updated"),
            }

            cursor = conn.execute("""
                SELECT
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
                WHERE "Ticker" = ?
            """, (ticker,))
            existing = cursor.fetchone()

            if existing:
                current_row["Type"] = existing[0]
                current_row["Company Name"] = existing[1]
                current_row["Description"] = existing[2]
                current_row["Market Cap"] = existing[3]
                current_row["RSI"] = existing[4]
                current_row["MACD"] = existing[5]
                current_row["MACD Signal"] = existing[6]
                current_row["MACD Histogram"] = existing[7]
                current_row["SMA 20"] = existing[8]
                current_row["Latest Dividend Amount"] = existing[9]
                current_row["Latest Ex-Dividend Date"] = existing[10]
                current_row["Latest Pay Date"] = existing[11]
                current_row["Dividend Frequency"] = existing[12]
                current_row["Latest 10-K Date"] = existing[13]
                current_row["Latest 10-K URL"] = existing[14]
                current_row["Latest 10-Q Date"] = existing[15]
                current_row["Latest 10-Q URL"] = existing[16]

            update_polygon_stock_row(conn, ticker, current_row)
            snapshot_updates += 1

        if i % 2000 == 0:
            conn.commit()
            print(f"Applied snapshot data through {i} tickers...")

    conn.commit()
    print(f"Snapshot-updated rows: {snapshot_updates}")

    updated_main_rows = 0
    updated_detail_rows = 0

    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        futures = {executor.submit(fetch_ticker_bundle, ticker): ticker for ticker in tickers}

        for i, future in enumerate(as_completed(futures), start=1):
            ticker = futures[future]

            try:
                ticker, stock_row, details_row = future.result()

                if stock_row:
                    cursor = conn.execute("""
                        SELECT
                            "Current Price",
                            "Previous Close",
                            "Day Open",
                            "Day High",
                            "Day Low",
                            "Day Volume",
                            "Today Change %",
                            "Last Updated"
                        FROM stocks
                        WHERE "Ticker" = ?
                    """, (ticker,))
                    existing = cursor.fetchone()

                    if existing:
                        stock_row.setdefault("Current Price", existing[0])
                        stock_row.setdefault("Previous Close", existing[1])
                        stock_row.setdefault("Day Open", existing[2])
                        stock_row.setdefault("Day High", existing[3])
                        stock_row.setdefault("Day Low", existing[4])
                        stock_row.setdefault("Day Volume", existing[5])
                        stock_row.setdefault("Today Change %", existing[6])
                        stock_row["Last Updated"] = datetime.utcnow().isoformat(timespec="seconds")

                    update_polygon_stock_row(conn, ticker, stock_row)
                    updated_main_rows += 1

                if details_row:
                    update_stock_details_row(conn, ticker, details_row)
                    updated_detail_rows += 1

            except Exception as e:
                print(f"[BUNDLE ERROR] {ticker}: {e}")

            if i % 100 == 0:
                conn.commit()
                print(f"Committed through {i} detailed tickers...")

    conn.commit()

    clean_database(conn)
    conn.close()

    elapsed_minutes = (time.time() - start_time) / 60
    print(f"Done. Updated main rows: {updated_main_rows}")
    print(f"Done. Updated detail rows: {updated_detail_rows}")
    print(f"Total runtime: {elapsed_minutes:.2f} minutes")


if __name__ == "__main__":
    main()