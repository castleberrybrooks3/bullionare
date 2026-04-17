from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from db import get_db_connection_dict
import os
import math
import json
from typing import Optional
import requests
from datetime import datetime, timedelta
from concurrent.futures import ThreadPoolExecutor, as_completed

app = FastAPI()

origins = [
    "http://localhost:3000",
    "https://bullionaireiq.com",
    "https://bullionareiq.com",
    "https://www.bullionareiq.com"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

POLYGON_API_KEY = os.getenv("POLYGON_API_KEY", "").strip()
POLYGON_BASE_URL = "https://api.polygon.io"
polygon_session = requests.Session()


# =========================================================
# DB HELPERS
# =========================================================

def clean_row(row):
    if row is None:
        return None

    if isinstance(row, dict):
        return row

    if hasattr(row, "keys"):
        return {key: row[key] for key in row.keys()}

    return dict(row)


def parse_json_field(value):
    if not value:
        return None
    try:
        return json.loads(value)
    except Exception:
        return None


def add_min_max_filter(where_clauses, params, column_sql, min_val, max_val):
    if min_val is not None:
        where_clauses.append(f"{column_sql} >= %s")
        params.append(min_val)
    if max_val is not None:
        where_clauses.append(f"{column_sql} <= %s")
        params.append(max_val)

def get_polygon_json(path: str, params: Optional[dict] = None, timeout: int = 20):
    if not POLYGON_API_KEY:
        return None

    query = dict(params or {})
    query["apiKey"] = POLYGON_API_KEY

    url = f"{POLYGON_BASE_URL}{path}"

    try:
        response = polygon_session.get(url, params=query, timeout=timeout)
        response.raise_for_status()
        return response.json()
    except Exception as e:
        print(f"[POLYGON ERROR] {url} -> {e}")
        return None


def fetch_intraday_sparkline(ticker: str):
    for days_back in range(0, 5):
        target_date = (datetime.now() - timedelta(days=days_back)).date().isoformat()

        data = get_polygon_json(
            f"/v2/aggs/ticker/{ticker}/range/5/minute/{target_date}/{target_date}",
            {
                "adjusted": "true",
                "sort": "asc",
                "limit": 5000,
            },
            timeout=20,
        )

        if not data or not data.get("results"):
            continue

        bars = data["results"]
        closes = [bar.get("c") for bar in bars if bar.get("c") is not None]

        if not closes:
            continue

        first_close = closes[0]
        last_close = closes[-1]

        change_pct = None
        if first_close not in (None, 0):
            change_pct = ((last_close - first_close) / first_close) * 100

        return {
            "ticker": ticker,
            "points": closes,
            "change_pct": change_pct,
        }

    return {
        "ticker": ticker,
        "points": [],
        "change_pct": None,
    }
def fetch_chart_data(ticker: str, range_key: str):
    range_map = {
        "1D": {"multiplier": 5, "timespan": "minute", "days": 1},
        "5D": {"multiplier": 30, "timespan": "minute", "days": 5},
        "1M": {"multiplier": 1, "timespan": "day", "days": 30},
        "6M": {"multiplier": 1, "timespan": "day", "days": 180},
        "1Y": {"multiplier": 1, "timespan": "day", "days": 365},
        "5Y": {"multiplier": 1, "timespan": "week", "days": 365 * 5},
        "Max": {"multiplier": 1, "timespan": "month", "days": 365 * 20},
    }

    config = range_map.get(range_key, range_map["1D"])

    # Special handling for 1D so weekends/market holidays still show
    if range_key == "1D":
        for days_back in range(0, 5):
            target_date = (datetime.now() - timedelta(days=days_back)).date().isoformat()

            data = get_polygon_json(
                f"/v2/aggs/ticker/{ticker}/range/5/minute/{target_date}/{target_date}",
                {
                    "adjusted": "true",
                    "sort": "asc",
                    "limit": 5000,
                },
                timeout=25,
            )

            if not data or not data.get("results"):
                continue

            points = []
            for bar in data["results"]:
                timestamp = bar.get("t")
                open_price = bar.get("o")
                high_price = bar.get("h")
                low_price = bar.get("l")
                close_price = bar.get("c")
                volume = bar.get("v")

                if (
                    timestamp is None
                    or open_price is None
                    or high_price is None
                    or low_price is None
                    or close_price is None
                ):
                    continue

                points.append({
                    "time": timestamp,
                    "open": open_price,
                    "high": high_price,
                    "low": low_price,
                    "close": close_price,
                    "volume": volume,
                })

            if points:
                return {
                    "ticker": ticker,
                    "range": range_key,
                    "points": points,
                }

        return {
            "ticker": ticker,
            "range": range_key,
            "points": [],
        }

    end_date = datetime.now().date()
    start_date = end_date - timedelta(days=config["days"])

    data = get_polygon_json(
        f"/v2/aggs/ticker/{ticker}/range/{config['multiplier']}/{config['timespan']}/{start_date.isoformat()}/{end_date.isoformat()}",
        {
            "adjusted": "true",
            "sort": "asc",
            "limit": 50000,
        },
        timeout=25,
    )

    if not data or not data.get("results"):
        return {
            "ticker": ticker,
            "range": range_key,
            "points": [],
        }

    points = []
    for bar in data["results"]:
        timestamp = bar.get("t")
        open_price = bar.get("o")
        high_price = bar.get("h")
        low_price = bar.get("l")
        close_price = bar.get("c")
        volume = bar.get("v")

        if (
            timestamp is None
            or open_price is None
            or high_price is None
            or low_price is None
            or close_price is None
        ):
            continue

        points.append({
            "time": timestamp,
            "open": open_price,
            "high": high_price,
            "low": low_price,
            "close": close_price,
            "volume": volume,
        })

    return {
        "ticker": ticker,
        "range": range_key,
        "points": points,
    }
# =========================================================
# WHERE CLAUSE BUILDER
# =========================================================

def build_where_clause(
    search: Optional[str] = None,
    sector: Optional[str] = None,
    security_type: Optional[str] = None,
    tickers: Optional[str] = None,

    min_price: Optional[float] = None,
    max_price: Optional[float] = None,

    min_market_cap: Optional[float] = None,
    max_market_cap: Optional[float] = None,

    min_eps: Optional[float] = None,
    max_eps: Optional[float] = None,

    min_pe: Optional[float] = None,
    max_pe: Optional[float] = None,

    min_dividend: Optional[float] = None,
    max_dividend: Optional[float] = None,

    min_rsi: Optional[float] = None,
    max_rsi: Optional[float] = None,

    min_macd: Optional[float] = None,
    max_macd: Optional[float] = None,

    min_sma20: Optional[float] = None,
    max_sma20: Optional[float] = None,

    min_beta: Optional[float] = None,
    max_beta: Optional[float] = None,

    min_ebitda: Optional[float] = None,
    max_ebitda: Optional[float] = None,

    min_short_float: Optional[float] = None,
    max_short_float: Optional[float] = None,

    min_gross_profit: Optional[float] = None,
    max_gross_profit: Optional[float] = None,

    min_upside: Optional[float] = None,
    max_upside: Optional[float] = None,

    min_downside: Optional[float] = None,
    max_downside: Optional[float] = None,

    min_mean_target: Optional[float] = None,
    max_mean_target: Optional[float] = None,

    min_analysts: Optional[int] = None,
    max_analysts: Optional[int] = None,

        min_previous_close: Optional[float] = None,
        max_previous_close: Optional[float] = None,

        min_day_open: Optional[float] = None,
        max_day_open: Optional[float] = None,

        min_day_high: Optional[float] = None,
        max_day_high: Optional[float] = None,

        min_day_low: Optional[float] = None,
        max_day_low: Optional[float] = None,

        min_day_volume: Optional[float] = None,
        max_day_volume: Optional[float] = None,

        min_today_change: Optional[float] = None,
        max_today_change: Optional[float] = None,

        min_macd_signal: Optional[float] = None,
        max_macd_signal: Optional[float] = None,

        min_macd_histogram: Optional[float] = None,
        max_macd_histogram: Optional[float] = None,

        min_latest_dividend: Optional[float] = None,
        max_latest_dividend: Optional[float] = None,

        min_dividend_frequency: Optional[float] = None,
        max_dividend_frequency: Optional[float] = None,
):
    where_clauses = []
    params = []

    if search:
        search_term = f"%{search.strip()}%"
        where_clauses.append('(LOWER("Company Name") LIKE LOWER(%s) OR UPPER("Ticker") LIKE UPPER(%s))')
        params.extend([search_term, search_term])

    if sector:
        where_clauses.append('LOWER("Sector") = LOWER(%s)')
        params.append(sector.strip())

    if security_type:
        where_clauses.append('UPPER("Type") = UPPER(%s)')
        params.append(security_type.strip())

    if tickers:
        ticker_list = [t.strip().upper() for t in tickers.split(",") if t.strip()]
        if ticker_list:
            placeholders = ",".join(["%s"] * len(ticker_list))
            where_clauses.append(f'UPPER("Ticker") IN ({placeholders})')
            params.extend(ticker_list)

    add_min_max_filter(where_clauses, params, 'CAST("Current Price" AS REAL)', min_price, max_price)
    add_min_max_filter(where_clauses, params, 'CAST("Market Cap" AS REAL)', min_market_cap, max_market_cap)
    add_min_max_filter(where_clauses, params, 'CAST("EPS (TTM)" AS REAL)', min_eps, max_eps)
    add_min_max_filter(where_clauses, params, 'CAST("P/E (TTM)" AS REAL)', min_pe, max_pe)
    add_min_max_filter(where_clauses, params, 'CAST("Dividend Yield" AS REAL)', min_dividend, max_dividend)
    add_min_max_filter(where_clauses, params, 'CAST("RSI" AS REAL)', min_rsi, max_rsi)
    add_min_max_filter(where_clauses, params, 'CAST("MACD" AS REAL)', min_macd, max_macd)
    add_min_max_filter(where_clauses, params, 'CAST("SMA 20" AS REAL)', min_sma20, max_sma20)

    add_min_max_filter(where_clauses, params, 'CAST("Beta" AS REAL)', min_beta, max_beta)
    add_min_max_filter(where_clauses, params, 'CAST("EBITDA" AS REAL)', min_ebitda, max_ebitda)
    add_min_max_filter(where_clauses, params, 'CAST("Short %% of Float" AS REAL)', min_short_float, max_short_float)
    add_min_max_filter(where_clauses, params, 'CAST("Gross Profit" AS REAL)', min_gross_profit, max_gross_profit)
    add_min_max_filter(where_clauses, params, 'CAST("Analyst Upside" AS REAL)', min_upside, max_upside)
    add_min_max_filter(where_clauses, params, 'CAST("Analyst Downside" AS REAL)', min_downside, max_downside)
    add_min_max_filter(where_clauses, params, 'CAST("Mean Target" AS REAL)', min_mean_target, max_mean_target)
    add_min_max_filter(where_clauses, params, 'CAST("Number of Analysts" AS REAL)', min_analysts, max_analysts)

    add_min_max_filter(where_clauses, params, 'CAST("Previous Close" AS REAL)', min_previous_close, max_previous_close)
    add_min_max_filter(where_clauses, params, 'CAST("Day Open" AS REAL)', min_day_open, max_day_open)
    add_min_max_filter(where_clauses, params, 'CAST("Day High" AS REAL)', min_day_high, max_day_high)
    add_min_max_filter(where_clauses, params, 'CAST("Day Low" AS REAL)', min_day_low, max_day_low)
    add_min_max_filter(where_clauses, params, 'CAST("Day Volume" AS REAL)', min_day_volume, max_day_volume)
    add_min_max_filter(where_clauses, params, 'CAST("Today Change %%" AS REAL)', min_today_change, max_today_change)
    add_min_max_filter(where_clauses, params, 'CAST("MACD Signal" AS REAL)', min_macd_signal, max_macd_signal)
    add_min_max_filter(where_clauses, params, 'CAST("MACD Histogram" AS REAL)', min_macd_histogram, max_macd_histogram)
    add_min_max_filter(where_clauses, params, 'CAST("Latest Dividend Amount" AS REAL)', min_latest_dividend,
                       max_latest_dividend)
    add_min_max_filter(where_clauses, params, 'CAST("Dividend Frequency" AS REAL)', min_dividend_frequency,
                       max_dividend_frequency)

    where_sql = ""
    if where_clauses:
        where_sql = "WHERE " + " AND ".join(where_clauses)

    return where_sql, params


# =========================================================
# COLUMN LISTS
# =========================================================

STOCK_LIST_COLUMNS = """
    "Ticker",
    "Company Name",
    "Description",
    "Type",
    "Sector",
    "Current Price",
    "Previous Close",
    "Day Open",
    "Day High",
    "Day Low",
    "Day Volume",
    "Today Change %%",
    "Market Cap",
    "EPS (TTM)",
    "P/E (TTM)",
    "Dividend Yield",
    "RSI",
    "MACD",
    "MACD Signal",
    "MACD Histogram",
    "SMA 20",
    "Beta",
    "EBITDA",
    "Short %% of Float",
    "Gross Profit",
    "Analyst Upside",
    "Analyst Downside",
    "Mean Target",
    "Number of Analysts",
    "Latest Dividend Amount",
    "Latest Ex-Dividend Date",
    "Latest Pay Date",
    "Dividend Frequency",
    "Latest 10-K Date",
    "Latest 10-K URL",
    "Latest 10-Q Date",
    "Latest 10-Q URL",
    "Last Updated"
"""


# =========================================================
# ROUTES
# =========================================================
@app.get("/stocks")
def get_stocks(
    page: int = Query(1, ge=1),
    page_size: int = Query(100, ge=1, le=1000),

    search: Optional[str] = None,
    sector: Optional[str] = None,
    security_type: Optional[str] = None,
    tickers: Optional[str] = None,

    min_price: Optional[float] = None,
    max_price: Optional[float] = None,

    min_market_cap: Optional[float] = None,
    max_market_cap: Optional[float] = None,

    min_eps: Optional[float] = None,
    max_eps: Optional[float] = None,

    min_pe: Optional[float] = None,
    max_pe: Optional[float] = None,

    min_dividend: Optional[float] = None,
    max_dividend: Optional[float] = None,

    min_rsi: Optional[float] = None,
    max_rsi: Optional[float] = None,

    min_macd: Optional[float] = None,
    max_macd: Optional[float] = None,

    min_sma20: Optional[float] = None,
    max_sma20: Optional[float] = None,

    min_beta: Optional[float] = None,
    max_beta: Optional[float] = None,

    min_ebitda: Optional[float] = None,
    max_ebitda: Optional[float] = None,

    min_short_float: Optional[float] = None,
    max_short_float: Optional[float] = None,

    min_gross_profit: Optional[float] = None,
    max_gross_profit: Optional[float] = None,

    min_upside: Optional[float] = None,
    max_upside: Optional[float] = None,

    min_downside: Optional[float] = None,
    max_downside: Optional[float] = None,

    min_mean_target: Optional[float] = None,
    max_mean_target: Optional[float] = None,

    min_analysts: Optional[int] = None,
    max_analysts: Optional[int] = None,

    min_previous_close: Optional[float] = None,
    max_previous_close: Optional[float] = None,

    min_day_open: Optional[float] = None,
    max_day_open: Optional[float] = None,

    min_day_high: Optional[float] = None,
    max_day_high: Optional[float] = None,

    min_day_low: Optional[float] = None,
    max_day_low: Optional[float] = None,

    min_day_volume: Optional[float] = None,
    max_day_volume: Optional[float] = None,

    min_today_change: Optional[float] = None,
    max_today_change: Optional[float] = None,

    min_macd_signal: Optional[float] = None,
    max_macd_signal: Optional[float] = None,

    min_macd_histogram: Optional[float] = None,
    max_macd_histogram: Optional[float] = None,

    min_latest_dividend: Optional[float] = None,
    max_latest_dividend: Optional[float] = None,

    min_dividend_frequency: Optional[float] = None,
    max_dividend_frequency: Optional[float] = None,

    sort_by: str = Query("Market Cap"),
    sort_order: str = Query("desc"),
):
    try:
        conn = get_db_connection_dict()
        cursor = conn.cursor()

        where_sql, params = build_where_clause(
            search=search,
            sector=sector,
            security_type=security_type,
            tickers=tickers,

            min_price=min_price,
            max_price=max_price,

            min_market_cap=min_market_cap,
            max_market_cap=max_market_cap,

            min_eps=min_eps,
            max_eps=max_eps,

            min_pe=min_pe,
            max_pe=max_pe,

            min_dividend=min_dividend,
            max_dividend=max_dividend,

            min_rsi=min_rsi,
            max_rsi=max_rsi,

            min_macd=min_macd,
            max_macd=max_macd,

            min_sma20=min_sma20,
            max_sma20=max_sma20,

            min_beta=min_beta,
            max_beta=max_beta,

            min_ebitda=min_ebitda,
            max_ebitda=max_ebitda,

            min_short_float=min_short_float,
            max_short_float=max_short_float,

            min_gross_profit=min_gross_profit,
            max_gross_profit=max_gross_profit,

            min_upside=min_upside,
            max_upside=max_upside,

            min_downside=min_downside,
            max_downside=max_downside,

            min_mean_target=min_mean_target,
            max_mean_target=max_mean_target,

            min_analysts=min_analysts,
            max_analysts=max_analysts,

            min_previous_close=min_previous_close,
            max_previous_close=max_previous_close,

            min_day_open=min_day_open,
            max_day_open=max_day_open,

            min_day_high=min_day_high,
            max_day_high=max_day_high,

            min_day_low=min_day_low,
            max_day_low=max_day_low,

            min_day_volume=min_day_volume,
            max_day_volume=max_day_volume,

            min_today_change=min_today_change,
            max_today_change=max_today_change,

            min_macd_signal=min_macd_signal,
            max_macd_signal=max_macd_signal,

            min_macd_histogram=min_macd_histogram,
            max_macd_histogram=max_macd_histogram,

            min_latest_dividend=min_latest_dividend,
            max_latest_dividend=max_latest_dividend,

            min_dividend_frequency=min_dividend_frequency,
            max_dividend_frequency=max_dividend_frequency,
        )

        sortable_columns = {
            "Ticker": '"Ticker"',
            "Company Name": '"Company Name"',
            "Type": '"Type"',
            "Sector": '"Sector"',
            "Current Price": 'CAST("Current Price" AS REAL)',
            "Previous Close": 'CAST("Previous Close" AS REAL)',
            "Day Open": 'CAST("Day Open" AS REAL)',
            "Day High": 'CAST("Day High" AS REAL)',
            "Day Low": 'CAST("Day Low" AS REAL)',
            "Day Volume": 'CAST("Day Volume" AS REAL)',
            "Today Change %": 'CAST("Today Change %%" AS REAL)',
            "Market Cap": 'CAST("Market Cap" AS REAL)',
            "EPS (TTM)": 'CAST("EPS (TTM)" AS REAL)',
            "P/E (TTM)": 'CAST("P/E (TTM)" AS REAL)',
            "Dividend Yield": 'CAST("Dividend Yield" AS REAL)',
            "RSI": 'CAST("RSI" AS REAL)',
            "MACD": 'CAST("MACD" AS REAL)',
            "MACD Signal": 'CAST("MACD Signal" AS REAL)',
            "MACD Histogram": 'CAST("MACD Histogram" AS REAL)',
            "SMA 20": 'CAST("SMA 20" AS REAL)',
            "Beta": 'CAST("Beta" AS REAL)',
            "EBITDA": 'CAST("EBITDA" AS REAL)',
            "Short % of Float": 'CAST("Short %% of Float" AS REAL)',
            "Gross Profit": 'CAST("Gross Profit" AS REAL)',
            "Analyst Upside": 'CAST("Analyst Upside" AS REAL)',
            "Analyst Downside": 'CAST("Analyst Downside" AS REAL)',
            "Mean Target": 'CAST("Mean Target" AS REAL)',
            "Number of Analysts": 'CAST("Number of Analysts" AS REAL)',
            "Latest Dividend Amount": 'CAST("Latest Dividend Amount" AS REAL)',
            "Dividend Frequency": 'CAST("Dividend Frequency" AS REAL)',
            "Last Updated": '"Last Updated"',
        }

        order_sql = sortable_columns.get(sort_by, 'CAST("Market Cap" AS REAL)')
        direction_sql = "DESC" if sort_order.lower() == "desc" else "ASC"

        count_query = f"""
            SELECT COUNT(*) AS total
            FROM stocks
            {where_sql}
        """
        cursor.execute(count_query, params)
        total = cursor.fetchone()["total"]

        offset = (page - 1) * page_size

        data_query = f"""
            SELECT {STOCK_LIST_COLUMNS}
            FROM stocks
            {where_sql}
            ORDER BY {order_sql} {direction_sql} NULLS LAST, "Ticker" ASC
            LIMIT %s OFFSET %s
        """
        cursor.execute(data_query, params + [page_size, offset])
        rows = cursor.fetchall()

        total_pages = math.ceil(total / page_size) if total > 0 else 1

        safe_rows = []
        for row in rows:
            safe_rows.append({k: row[k] for k in row.keys()})

        conn.close()

        return {
            "rows": safe_rows,
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": total_pages,
            "sort_by": sort_by,
            "sort_order": sort_order,
        }

    except Exception as e:
        return {"error": str(e)}
@app.get("/stocks/sparklines")
def get_stock_sparklines(tickers: str = Query(...)):
    ticker_list = [t.strip().upper() for t in tickers.split(",") if t.strip()]

    if not ticker_list:
        return {"rows": {}}

    ticker_list = ticker_list[:100]

    rows = {}

    with ThreadPoolExecutor(max_workers=8) as executor:
        futures = {
            executor.submit(fetch_intraday_sparkline, ticker): ticker
            for ticker in ticker_list
        }

        for future in as_completed(futures):
            result = future.result()
            rows[result["ticker"]] = {
                "points": result["points"],
                "change_pct": result["change_pct"],
            }

    return {"rows": rows}

@app.get("/stocks/{ticker}/chart")
def get_stock_chart(ticker: str, range: str = Query("1D")):
    return fetch_chart_data(ticker.upper(), range)

@app.get("/stocks/{ticker}")
def get_stock_detail(ticker: str):
    try:
        conn = get_db_connection_dict()
        cursor = conn.cursor()

        cursor.execute("""
            SELECT
                s."Ticker",
                s."Company Name",
                s."Description",
                s."Type",
                s."Sector",
                s."Current Price",
                s."Previous Close",
                s."Day Open",
                s."Day High",
                s."Day Low",
                s."Day Volume",
                s."Today Change %%",
                s."Market Cap",
                s."EPS (TTM)",
                s."P/E (TTM)",
                s."Dividend Yield",
                s."RSI",
                s."MACD",
                s."MACD Signal",
                s."MACD Histogram",
                s."SMA 20",
                s."Beta",
                s."EBITDA",
                s."Short %% of Float",
                s."Gross Profit",
                s."Analyst Upside",
                s."Analyst Downside",
                s."Mean Target",
                s."Number of Analysts",
                s."Latest Dividend Amount",
                s."Latest Ex-Dividend Date",
                s."Latest Pay Date",
                s."Dividend Frequency",
                s."Latest 10-K Date",
                s."Latest 10-K URL",
                s."Latest 10-Q Date",
                s."Latest 10-Q URL",
                s."Last Updated",
                d."Financials Last Updated"
            FROM stocks s
            LEFT JOIN stock_details d
                ON s."Ticker" = d."Ticker"
            WHERE s."Ticker" = %s
            LIMIT 1
        """, (ticker.upper(),))

        row = cursor.fetchone()
        conn.close()

        if not row:
            raise HTTPException(status_code=404, detail="Ticker not found")

        return clean_row(row)

    except HTTPException:
        raise
    except Exception as e:
        return {"error": str(e)}


@app.get("/stocks/{ticker}/financials")
def get_stock_financials(ticker: str):
    try:
        conn = get_db_connection_dict()
        cursor = conn.cursor()

        cursor.execute("""
            SELECT
                d."Ticker",
                d."Balance Sheet JSON",
                d."Income Statement JSON",
                d."Cash Flow JSON",
                d."Financials Last Updated"
            FROM stock_details d
            WHERE d."Ticker" = %s
            LIMIT 1
        """, (ticker.upper(),))

        row = cursor.fetchone()
        conn.close()

        if not row:
            raise HTTPException(status_code=404, detail="Ticker not found")

        result = clean_row(row)
        result["Balance Sheet JSON"] = parse_json_field(result.get("Balance Sheet JSON"))
        result["Income Statement JSON"] = parse_json_field(result.get("Income Statement JSON"))
        result["Cash Flow JSON"] = parse_json_field(result.get("Cash Flow JSON"))

        return result

    except HTTPException:
        raise
    except Exception as e:
        return {"error": str(e)}


@app.get("/sectors")
def get_sectors():
    try:
        conn = get_db_connection_dict()
        cursor = conn.cursor()

        cursor.execute("""
            SELECT DISTINCT "Sector"
            FROM stocks
            WHERE "Sector" IS NOT NULL
              AND TRIM("Sector") != ''
            ORDER BY "Sector" ASC
        """)

        rows = cursor.fetchall()
        conn.close()

        return [row["Sector"] for row in rows]

    except Exception as e:
        return {"error": str(e)}


@app.get("/security-types")
def get_security_types():
    try:
        conn = get_db_connection_dict()
        cursor = conn.cursor()

        cursor.execute("""
            SELECT DISTINCT "Type"
            FROM stocks
            WHERE "Type" IS NOT NULL
              AND TRIM("Type") != ''
            ORDER BY "Type" ASC
        """)

        rows = cursor.fetchall()
        conn.close()

        return [row["Type"] for row in rows]

    except Exception as e:
        return {"error": str(e)}


@app.get("/sector-performance")
def get_sector_performance():
    try:
        conn = get_db_connection_dict()
        cursor = conn.cursor()

        cursor.execute("""
            SELECT
                "Sector",
                AVG(CAST("Today Change %" AS REAL)) AS avg_change
            FROM stocks
            WHERE "Sector" IS NOT NULL
              AND TRIM("Sector") != ''
              AND "Today Change %" IS NOT NULL
              AND TRIM(CAST("Today Change %" AS TEXT)) != ''
              AND UPPER("Type") = 'CS'
              AND "Sector" IN (
                  'Basic Materials',
                  'Communication Services',
                  'Consumer Cyclical',
                  'Consumer Defensive',
                  'Energy',
                  'Financial Services',
                  'Healthcare',
                  'Industrials',
                  'Real Estate',
                  'Technology',
                  'Utilities'
              )
            GROUP BY "Sector"
            ORDER BY "Sector" ASC
        """)

        rows = cursor.fetchall()
        conn.close()

        return {
            row["Sector"]: row["avg_change"]
            for row in rows
            if row["avg_change"] is not None
        }

    except Exception as e:
        return {"error": str(e)}

@app.get("/market-breadth")
def get_market_breadth():
    try:
        conn = get_db_connection_dict()
        cursor = conn.cursor()

        cursor.execute("""
            SELECT CAST("Today Change %" AS REAL) AS change_pct
            FROM stocks
            WHERE UPPER("Type") = 'CS'
              AND "Today Change %" IS NOT NULL
              AND TRIM(CAST("Today Change %" AS TEXT)) != ''
        """)

        rows = cursor.fetchall()
        conn.close()

        changes = [row["change_pct"] for row in rows if row["change_pct"] is not None]

        buckets = {
            "<-10%": 0,
            "-10% to -5%": 0,
            "-5% to -2%": 0,
            "-2% to 0%": 0,
            "0%": 0,
            "0% to 2%": 0,
            "2% to 5%": 0,
            "5% to 10%": 0,
            ">10%": 0,
        }

        advancers = 0
        decliners = 0
        unchanged = 0

        for value in changes:
            if value < 0:
                decliners += 1
            elif value > 0:
                advancers += 1
            else:
                unchanged += 1

            if value < -10:
                buckets["<-10%"] += 1
            elif value < -5:
                buckets["-10% to -5%"] += 1
            elif value < -2:
                buckets["-5% to -2%"] += 1
            elif value < 0:
                buckets["-2% to 0%"] += 1
            elif value == 0:
                buckets["0%"] += 1
            elif value <= 2:
                buckets["0% to 2%"] += 1
            elif value <= 5:
                buckets["2% to 5%"] += 1
            elif value <= 10:
                buckets["5% to 10%"] += 1
            else:
                buckets[">10%"] += 1

        return {
            "buckets": buckets,
            "advancers": advancers,
            "decliners": decliners,
            "unchanged": unchanged,
            "total": len(changes),
        }

    except Exception as e:
        return {"error": str(e)}

@app.get("/market-summary")
def get_market_summary():
    try:
        conn = get_db_connection_dict()
        cursor = conn.cursor()

        cursor.execute("""
            SELECT
                "Ticker",
                CAST("Current Price" AS REAL) AS price,
                CAST("Today Change %" AS REAL) AS change
            FROM stocks
            WHERE "Ticker" IN ('SPY', 'QQQ', 'DIA', 'IBIT', 'USO', 'GLD', 'VIXY')
        """)

        rows = cursor.fetchall()
        conn.close()

        return {
            row["Ticker"]: {
                "price": row["price"],
                "change": row["change"]
            }
            for row in rows
        }

    except Exception as e:
        return {"error": str(e)}