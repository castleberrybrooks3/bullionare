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
import ctypes
import json
from datetime import datetime, timezone


load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "").strip()
if not DATABASE_URL:
    raise ValueError("DATABASE_URL is missing or empty.")

MAX_WORKERS = 1
SLEEP_BETWEEN_TICKERS = 1.0
SLEEP_BETWEEN_BATCHES = 5.0


# =========================================================
# WINDOWS POWER / LONG-RUN GUARDS
# =========================================================

ES_CONTINUOUS = 0x80000000
ES_SYSTEM_REQUIRED = 0x00000001


def prevent_system_sleep():
    """Keep Windows awake while allowing the display itself to turn off."""
    if os.name != "nt":
        return
    try:
        result = ctypes.windll.kernel32.SetThreadExecutionState(
            ES_CONTINUOUS | ES_SYSTEM_REQUIRED
        )
        if not result:
            print("[POWER] Warning: could not register the keep-awake request.")
        else:
            print("[POWER] System sleep prevention enabled; display may still turn off.")
    except Exception as exc:
        print(f"[POWER] Warning: keep-awake request failed: {exc}")


def restore_system_sleep():
    """Release the Windows keep-awake request when the script exits."""
    if os.name != "nt":
        return
    try:
        ctypes.windll.kernel32.SetThreadExecutionState(ES_CONTINUOUS)
        print("[POWER] Normal Windows sleep behavior restored.")
    except Exception:
        pass


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
        connect_timeout=10,
        keepalives=1,
        keepalives_idle=30,
        keepalives_interval=10,
        keepalives_count=5,
    )

    return conn

def reconnect_db(conn):
    """Reconnect forever with capped backoff so transient network loss never kills the run."""
    try:
        if conn is not None:
            conn.close()
    except Exception:
        pass

    delay = 5

    while True:
        print(f"[DB] Reconnecting to database... next attempt now (backoff {delay}s on failure)")
        try:
            new_conn = get_conn()
            with new_conn.cursor() as cursor:
                cursor.execute("SELECT 1")
                cursor.fetchone()
            print("[DB] Reconnected successfully.")
            return new_conn
        except (psycopg2.OperationalError, psycopg2.InterfaceError) as exc:
            print(f"[DB] Database/network still unavailable: {exc}")
            print(f"[DB] Pausing {delay}s; no ticker will be skipped.")
            time.sleep(delay)
            delay = min(60, int(delay * 1.5) + 1)


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
        "PEG Ratio": "REAL",
        "P/S Ratio": "REAL",
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


def ensure_eps_estimates_table(conn):
    """Store Yahoo's own EPS chart data separately from the wide stocks table."""
    cursor = conn.cursor()
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS stock_eps_estimates (
            ticker TEXT PRIMARY KEY,
            earnings_events JSONB NOT NULL DEFAULT '[]'::jsonb,
            quarterly_consensus JSONB NOT NULL DEFAULT '[]'::jsonb,
            methodology TEXT,
            source TEXT NOT NULL DEFAULT 'Yahoo Finance Earnings Chart',
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """
    )
    cursor.execute(
        "ALTER TABLE stock_eps_estimates ADD COLUMN IF NOT EXISTS methodology TEXT"
    )
    cursor.execute(
        "CREATE INDEX IF NOT EXISTS idx_stock_eps_estimates_updated_at "
        "ON stock_eps_estimates (updated_at DESC)"
    )
    conn.commit()


def fetch_eps_tickers_from_db(conn):
    """Prioritize analyst-covered operating companies by market cap."""
    cursor = conn.cursor()
    cursor.execute(
        """
        SELECT "Ticker"
        FROM stocks
        WHERE "Ticker" IS NOT NULL
          AND TRIM("Ticker") <> ''
          AND (
                UPPER(TRIM(COALESCE("Type", ''))) = 'CS'
                OR UPPER(TRIM(COALESCE("Type", ''))) LIKE 'ADR%'
              )
          AND COALESCE("Number of Analysts", 0) > 0
        ORDER BY CAST("Market Cap" AS DOUBLE PRECISION) DESC NULLS LAST,
                 "Ticker" ASC
        """
    )
    return [row["Ticker"] for row in cursor.fetchall()]


def fetch_tickers_from_db(conn):
    cursor = conn.cursor()
    cursor.execute("""
        SELECT "Ticker"
        FROM stocks
        WHERE "Ticker" IS NOT NULL
          AND TRIM("Ticker") != ''
        ORDER BY "Ticker" ASC
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
            "PEG Ratio" = %s,
            "P/S Ratio" = %s,
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
        row.get("PEG Ratio"),
        row.get("P/S Ratio"),
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

def get_peg_ratio(info):
    candidates = [
        info.get("trailingPegRatio"),
        info.get("pegRatio"),
    ]

    for candidate in candidates:
        val = safe_float(candidate)
        if val is not None and val > 0:
            return val

    return None


def get_ps_ratio(info):
    candidates = [
        info.get("priceToSalesTrailing12Months"),
        info.get("priceToSales"),
    ]

    for candidate in candidates:
        val = safe_float(candidate)
        if val is not None and val > 0:
            return val

    return None


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
        peg_ratio = get_peg_ratio(info)
        ps_ratio = get_ps_ratio(info)
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
            "PEG Ratio": peg_ratio,
            "P/S Ratio": ps_ratio,
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
# EPS ESTIMATE ENRICHMENT
# =========================================================

def _series_value(row, names):
    for name in names:
        try:
            if name in row.index:
                value = row[name]
            else:
                value = row.get(name)
        except Exception:
            value = None
        if value is not None:
            parsed = safe_float(value)
            if parsed is not None:
                return parsed
    return None


def _date_to_iso(value):
    if value is None:
        return None

    if isinstance(value, dict):
        value = value.get("raw") if value.get("raw") is not None else value.get("fmt")

    try:
        if isinstance(value, (int, float)):
            timestamp = float(value)
            if timestamp > 10_000_000_000:
                timestamp /= 1000.0
            return datetime.fromtimestamp(timestamp, tz=timezone.utc).date().isoformat()
    except Exception:
        pass

    try:
        if hasattr(value, "to_pydatetime"):
            value = value.to_pydatetime()
        if hasattr(value, "date"):
            return value.date().isoformat()
    except Exception:
        pass

    text = str(value).strip()
    if not text:
        return None
    try:
        parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
        return parsed.date().isoformat()
    except Exception:
        return text[:10] if len(text) >= 10 else None


def fetch_eps_estimates_for_ticker(ticker):
    """Mirror Yahoo's earnings chart exactly, including its chosen methodology."""
    try:
        tk = yf.Ticker(ticker)

        # yfinance's Analysis scraper uses Yahoo's authenticated quoteSummary
        # endpoint. The `earnings` module is the same Yahoo payload that contains
        # earningsChart plus defaultMethodology (gaap or nongaap).
        raw = tk._analysis._fetch(["earnings"])
        earnings = (raw or {}).get("quoteSummary", {}).get("result", [{}])[0].get("earnings") or {}
        chart = earnings.get("earningsChart") or {}
        methodology = str(earnings.get("defaultMethodology") or "").strip().lower() or None

        events = []
        for row in chart.get("quarterly") or []:
            actual = safe_float(row.get("actual"))
            estimate = safe_float(row.get("estimate"))
            if actual is None and estimate is None:
                continue

            reported_date = _date_to_iso(row.get("reportedDate"))
            period_end_date = _date_to_iso(row.get("periodEndDate"))
            fallback_date = row.get("date")

            events.append(
                {
                    "date": reported_date or period_end_date or fallback_date,
                    "eps_estimate": estimate,
                    "eps_actual": actual,
                    "surprise_pct": safe_float(row.get("surprisePct")),
                    "eps_difference": safe_float(row.get("difference")),
                    "is_future": False,
                    "methodology": methodology,
                    "fiscal_quarter": row.get("fiscalQuarter"),
                    "calendar_quarter": row.get("calendarQuarter"),
                    "period_end_date": period_end_date,
                }
            )

        # Yahoo's earningsChart already supplies the one upcoming-quarter estimate
        # that belongs to the same methodology as the historical points above.
        current_estimate = safe_float(chart.get("currentQuarterEstimate"))
        if current_estimate is not None:
            earnings_dates = chart.get("earningsDate") or []
            next_date = _date_to_iso(earnings_dates[0]) if earnings_dates else None
            events.append(
                {
                    "date": next_date,
                    "eps_estimate": current_estimate,
                    "eps_actual": None,
                    "surprise_pct": None,
                    "eps_difference": None,
                    "is_future": True,
                    "methodology": methodology,
                    "fiscal_quarter": chart.get("currentFiscalQuarter"),
                    "calendar_quarter": chart.get("currentCalendarQuarter"),
                    "period_end_date": _date_to_iso(chart.get("currentPeriodEndDate")),
                    "label": None,
                }
            )

        events.sort(key=lambda row: (row.get("is_future") is True, row.get("date") or ""))

        return ticker, {
            "events": events,
            # Keep the existing column for backward compatibility, but do not mix
            # a second Yahoo estimate feed into this chart anymore.
            "quarterly_consensus": [],
            "methodology": methodology,
        }

    except requests.exceptions.RequestException as exc:
        print(f"[YAHOO EPS REQUEST ERROR] {ticker}: {exc}")
        return ticker, None
    except Exception as exc:
        print(f"[YAHOO EPS ERROR] {ticker}: {exc}")
        return ticker, None


def save_eps_estimates(conn, ticker, payload):
    conn.cursor().execute(
        """
        INSERT INTO stock_eps_estimates (
            ticker, earnings_events, quarterly_consensus, methodology, source, updated_at
        )
        VALUES (%s, %s::jsonb, %s::jsonb, %s, 'Yahoo Finance Earnings Chart', NOW())
        ON CONFLICT (ticker)
        DO UPDATE SET
            earnings_events = EXCLUDED.earnings_events,
            quarterly_consensus = EXCLUDED.quarterly_consensus,
            methodology = EXCLUDED.methodology,
            source = EXCLUDED.source,
            updated_at = NOW()
        """,
        (
            ticker,
            json.dumps(payload.get("events") or []),
            json.dumps(payload.get("quarterly_consensus") or []),
            payload.get("methodology"),
        ),
    )


def run_eps_estimate_backfill(conn):
    ensure_eps_estimates_table(conn)
    tickers = fetch_eps_tickers_from_db(conn)
    print(f"[EPS] Found {len(tickers)} analyst-covered CS/ADR tickers to process.")
    print("[EPS] Processing order: Market Cap DESC.")

    updated = 0
    no_data = 0
    failed = 0
    batch_size = 250

    for batch_start in range(0, len(tickers), batch_size):
        batch = tickers[batch_start:batch_start + batch_size]
        print(
            f"[EPS] Processing {batch_start + 1}-{batch_start + len(batch)} "
            f"of {len(tickers)}..."
        )

        with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
            futures = {
                executor.submit(fetch_eps_estimates_for_ticker, ticker): ticker
                for ticker in batch
            }

            for i, future in enumerate(as_completed(futures), start=1):
                ticker = futures[future]
                try:
                    _, payload = future.result()
                    if payload is None:
                        failed += 1
                        continue

                    has_data = bool(payload.get("events") or payload.get("quarterly_consensus"))
                    if not has_data:
                        no_data += 1
                        continue

                    while True:
                        try:
                            if conn is None or conn.closed:
                                conn = reconnect_db(conn)
                            save_eps_estimates(conn, ticker, payload)
                            conn.commit()
                            break
                        except (psycopg2.OperationalError, psycopg2.InterfaceError) as db_error:
                            print(f"[DB CONNECTION ERROR][EPS] {ticker}: {db_error}")
                            try:
                                if conn is not None and not conn.closed:
                                    conn.rollback()
                            except Exception:
                                pass
                            conn = reconnect_db(conn)

                    updated += 1
                except Exception as exc:
                    print(f"[EPS ERROR] {ticker}: {exc}")
                    failed += 1

                time.sleep(random.uniform(0.65, 1.05))

                if i % 50 == 0:
                    print(
                        f"[EPS] Batch progress {i}/{len(batch)} | "
                        f"updated={updated} no_data={no_data} failed={failed}"
                    )

        if batch_start + batch_size < len(tickers):
            time.sleep(random.uniform(20, 35))

    print()
    print("Yahoo EPS estimate enrichment complete.")
    print(f"Updated: {updated}")
    print(f"No estimate data: {no_data}")
    print(f"Failed: {failed}")
    return conn


# =========================================================
# MAIN
# =========================================================
def main():
    start = time.time()

    conn = get_conn()
    ensure_yahoo_columns(conn)

    eps_only = os.getenv("YAHOO_EPS_ONLY", "0").strip().lower() in {"1", "true", "yes"}
    if eps_only:
        try:
            conn = run_eps_estimate_backfill(conn)
        finally:
            try:
                if conn and not conn.closed:
                    conn.close()
            except Exception:
                pass
        return

    # Get EVERY ticker once at the beginning of this run
    all_tickers = fetch_tickers_from_db(conn)

    print(f"Found {len(all_tickers)} total tickers to process.")

    total_updated = 0
    total_failed = 0

    BATCH_SIZE = 300

    for batch_start in range(0, len(all_tickers), BATCH_SIZE):
        tickers = all_tickers[batch_start:batch_start + BATCH_SIZE]

        print(
            f"Processing batch "
            f"{batch_start + 1}-{batch_start + len(tickers)} "
            f"of {len(all_tickers)} tickers..."
        )

        updated = 0
        failed = 0

        with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
            futures = {
                executor.submit(fetch_yahoo_data_for_ticker, ticker): ticker
                for ticker in tickers
            }

            for i, future in enumerate(as_completed(futures), start=1):
                ticker = futures[future]

                try:
                    ticker, row = future.result()

                    # ---------------------------------------------------------
                    # SAVE RESULT TO DATABASE
                    # ---------------------------------------------------------
                    # Never skip a ticker because the laptop/network/database was
                    # temporarily unavailable. Stay on this exact save until the
                    # connection recovers. Non-connection SQL errors still raise.
                    while True:
                        try:
                            if conn is None or conn.closed:
                                conn = reconnect_db(conn)

                            if row:
                                update_yahoo_row(conn, ticker, row)

                                conn.cursor().execute("""
                                    UPDATE stocks
                                    SET
                                        "Yahoo Attempted" = TRUE,
                                        "Yahoo Failed" = FALSE
                                    WHERE "Ticker" = %s
                                """, (ticker,))

                            else:
                                mark_yahoo_failed(conn, ticker)
                                mark_yahoo_attempted(conn, ticker)

                            conn.commit()
                            break

                        except (psycopg2.OperationalError, psycopg2.InterfaceError) as db_error:
                            print(f"[DB CONNECTION ERROR] {ticker}: {db_error}")
                            try:
                                if conn is not None and not conn.closed:
                                    conn.rollback()
                            except Exception:
                                pass
                            conn = reconnect_db(conn)

                    if row:
                        updated += 1
                    else:
                        failed += 1

                except Exception as e:
                    print(f"[ERROR] {ticker}: {e}")
                    failed += 1

                time.sleep(random.uniform(0.8, 1.4))

                if i % 50 == 0:
                    try:
                        conn.commit()

                    except (psycopg2.OperationalError, psycopg2.InterfaceError) as e:
                        print(f"[DB COMMIT ERROR] {e}")
                        conn = reconnect_db(conn)

                    print(
                        f"Committed {i}/{len(tickers)} "
                        f"in current batch..."
                    )

                    time.sleep(SLEEP_BETWEEN_BATCHES)

        total_updated += updated
        total_failed += failed

        print(
            f"Batch complete. Updated: {updated}, Failed: {failed}"
        )

        # Only cool down if another batch remains
        if batch_start + BATCH_SIZE < len(all_tickers):
            print("Cooling down before next batch...")
            time.sleep(random.uniform(45, 75))

    conn.close()

    elapsed_minutes = (time.time() - start) / 60

    print()
    print("Yahoo enrichment complete.")
    print(f"Total tickers: {len(all_tickers)}")
    print(f"Total updated: {total_updated}")
    print(f"Total failed: {total_failed}")
    print(f"Total runtime: {elapsed_minutes:.2f} minutes")


if __name__ == "__main__":
    prevent_system_sleep()
    try:
        main()
    finally:
        restore_system_sleep()
