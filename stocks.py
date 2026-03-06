import os
import sys
import pandas as pd
import yfinance as yf
import time
import sqlite3
from tqdm import tqdm
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
import random
import traceback
import psutil  # pip install psutil

# ================================
# API TOGGLE (off by default)
# ================================
USE_API = False  # Set to True to use your paid API
API_KEY = "YOUR_API_KEY_HERE"  # Replace with your actual key

# ================================
# LOCK FILE (Prevents Double Runs, Self-Healing)
# ================================
LOCK_FILE = "stocks.lock"


def create_lock():
    if os.path.exists(LOCK_FILE):
        try:
            with open(LOCK_FILE, "r") as f:
                old_pid = int(f.read().strip())
            if psutil.pid_exists(old_pid):
                print(f"Another instance (PID {old_pid}) is still running. Exiting.")
                sys.exit()
            else:
                print(f"Found stale lock file from PID {old_pid}. Overwriting.")
        except Exception:
            print("Lock file exists but cannot read PID. Overwriting.")
    with open(LOCK_FILE, "w") as f:
        f.write(str(os.getpid()))


def remove_lock():
    if os.path.exists(LOCK_FILE):
        os.remove(LOCK_FILE)


# ================================
# LOGGING SETUP
# ================================
LOG_FILE = r"C:\Users\Brooks Castleberry\PyCharmMiscProject\task_log.txt"

# ================================
# TASK SCHEDULER DETECTION & AUTO SETTINGS
# ================================
RUNNING_UNDER_SCHEDULER = False
try:
    session_name = os.environ.get("SESSIONNAME", "")
    if session_name.lower() == "service":
        RUNNING_UNDER_SCHEDULER = True
except:
    pass

if RUNNING_UNDER_SCHEDULER:
    MAX_THREADS = 4
    SLEEP_BETWEEN_REQUESTS = 0.5
    AUTOSAVE_EVERY = 100
    PRINT_TO_CONSOLE = False
else:
    MAX_THREADS = 1
    SLEEP_BETWEEN_REQUESTS = 1
    AUTOSAVE_EVERY = 50
    PRINT_TO_CONSOLE = True


def log(message):
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    formatted = f"{timestamp} | PID {os.getpid()} | {message}"
    with open(LOG_FILE, "a", encoding="utf-8") as f:
        f.write(formatted + "\n")
    if PRINT_TO_CONSOLE:
        print(formatted)


# ================================
# SETTINGS
# ================================
TICKER_FILE = r"C:\Users\Brooks Castleberry\PyCharmMiscProject\tickers.xlsx"
DB_FILE = r"C:\Users\Brooks Castleberry\PyCharmMiscProject\stocks.db"
MAX_RETRIES = 3


# ================================
# FETCH FUNCTION
# ================================
def fetch_stock(ticker):
    for attempt in range(MAX_RETRIES):
        try:
            if USE_API:
                # TODO: Add your API call here using API_KEY
                time.sleep(SLEEP_BETWEEN_REQUESTS + random.uniform(0, 0.5))
                log(f"API mode active but not yet implemented for {ticker}")
                return None
            else:
                stock = yf.Ticker(ticker)

                # Use fast_info FIRST (lighter and less likely to get blocked)
                fast = stock.fast_info

                if not fast or fast.get("last_price") is None:
                    log(f"Likely blocked or invalid ticker: {ticker}")
                    time.sleep(5)
                    continue

                price = fast.get("last_price")
                market_cap = fast.get("market_cap")
                exchange = fast.get("exchange")

                # Only pull full info AFTER validation
                try:
                    info = stock.info
                except Exception:
                    info = {}

                eps = info.get("trailingEps")
                pe = info.get("trailingPE")
                beta = info.get("beta")
                div = info.get("dividendYield")
                sector = info.get("sector") or info.get("industry")
                ebitda = info.get("ebitda")

                low = info.get("targetLowPrice")
                mean = info.get("targetMeanPrice")
                high = info.get("targetHighPrice")

                upside = ((high - price) / price * 100) if price and high else None
                downside = ((low - price) / price * 100) if price and low else None

                time.sleep(SLEEP_BETWEEN_REQUESTS + random.uniform(0, 0.5))

                if (
                        price is None
                        or market_cap is None
                        or market_cap < 10_000_000
                        or sector is None
                        or exchange not in ["NMS", "NYQ", "ASE", "NAS", "NYSE", "NASDAQ"]
                ):
                    log(f"Skipping junk ticker: {ticker}")
                    return None

                return (
                    ticker,
                    price,
                    market_cap,
                    eps,
                    pe,
                    beta,
                    div,
                    sector,
                    exchange,
                    ebitda,
                    upside,
                    downside,
                    mean,
                    datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                )

        except Exception:
            log(f"Retrying {ticker} (attempt {attempt + 1})")
            time.sleep(3)

    return None
# ================================
# SECTOR RANKING ENGINE
# ================================
def compute_sector_score(df):
    df = df.copy()

    # Group by sector
    sector_groups = df.groupby("Sector")

    scores = []

    for sector, group in sector_groups:
        # Normalize metrics 0-1 within sector
        norm = pd.DataFrame(index=group.index)

        # Metrics where higher is better
        for col in ["Upside %", "EPS (TTM)", "Dividend Yield", "Mean Target", "EBITDA"]:
            if col in group:
                min_val = group[col].min()
                max_val = group[col].max()
                norm[col] = (group[col] - min_val) / (max_val - min_val) if max_val != min_val else 0.5

        # Metrics where lower is better
        for col in ["Downside %", "P/E (TTM)", "Beta"]:
            if col in group:
                min_val = group[col].min()
                max_val = group[col].max()
                norm[col] = 1 - ((group[col] - min_val) / (max_val - min_val)) if max_val != min_val else 0.5

        # Weights
        weights = {
            "Upside %": 0.2,
            "Downside %": 0.2,
            "Mean Target": 0.1,
            "EPS (TTM)": 0.15,
            "Dividend Yield": 0.05,
            "P/E (TTM)": 0.15,
            "Beta": 0.05,
            "EBITDA": 0.1
        }

        # Multiply each metric by weight, ignoring missing values
        sector_score = norm.multiply(pd.Series(weights)).sum(axis=1) / norm.notna().multiply(pd.Series(weights)).sum(
            axis=1)

        scores.append(sector_score)

    # Combine all sector scores
    df["Sector Score"] = pd.concat(scores)
    return df


# ================================
# MAIN
# ================================
def main():
    try:
        create_lock()
        log("Task started")

        conn = sqlite3.connect(DB_FILE, check_same_thread=False, timeout=30)
        cursor = conn.cursor()

        # Ensure EBITDA column exists
        try:
            cursor.execute("""
                           ALTER TABLE stock_data
                               ADD COLUMN EBITDA REAL
                           """)
            conn.commit()
            log("EBITDA column added to database.")
        except sqlite3.OperationalError:
            # Column already exists
            pass

        tickers = pd.read_excel(TICKER_FILE).iloc[:, 0].dropna().astype(str).tolist()
        log(f"Total tickers loaded: {len(tickers)}")

        def autosave(batch):
            cursor.executemany("""
                               INSERT INTO stock_data
                               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(Ticker) DO
                               UPDATE SET
                                   "Current Price" = COALESCE (excluded."Current Price", "Current Price"),
                                   "Market Cap" = COALESCE (excluded."Market Cap", "Market Cap"),
                                   "EPS (TTM)" = COALESCE (excluded."EPS (TTM)", "EPS (TTM)"),
                                   "P/E (TTM)" = COALESCE (excluded."P/E (TTM)", "P/E (TTM)"),
                                   Beta = COALESCE (excluded.Beta, Beta),
                                   "Dividend Yield" = COALESCE (excluded."Dividend Yield", "Dividend Yield"),
                                   Sector = COALESCE (excluded.Sector, Sector),
                                   Exchange = COALESCE (excluded.Exchange, Exchange),
                                   EBITDA = COALESCE (excluded.EBITDA, EBITDA),
                                   "Upside %" = COALESCE (excluded."Upside %", "Upside %"),
                                   "Downside %" = COALESCE (excluded."Downside %", "Downside %"),
                                   "Mean Target" = COALESCE (excluded."Mean Target", "Mean Target"),
                                   "Last Updated" = excluded."Last Updated"
                               """, batch)
            conn.commit()
            log(f"Autosaved batch of {len(batch)}")

        log("Starting full scrape...")
        batch = []

        with ThreadPoolExecutor(MAX_THREADS) as executor:
            futures = [executor.submit(fetch_stock, t) for t in tickers]

            for future in tqdm(as_completed(futures), total=len(futures), disable=not PRINT_TO_CONSOLE):
                result = future.result()
                if result:
                    batch.append(result)

                if len(batch) >= AUTOSAVE_EVERY:
                    autosave(batch)
                    batch.clear()

        if batch:
            autosave(batch)

        log("Full scrape complete.")

        # ================================
        # Compute Sector Rankings
        # ================================
        try:
            cursor.execute("ALTER TABLE stock_data ADD COLUMN 'Sector Score' REAL")
            conn.commit()
        except sqlite3.OperationalError:
            # Column already exists
            pass

        log("Computing sector scores...")
        df = pd.read_sql("SELECT * FROM stock_data", conn)
        df = compute_sector_score(df)

        # Update database with sector scores
        for idx, row in df.iterrows():
            cursor.execute("""
                           UPDATE stock_data
                           SET "Sector Score" = ?
                           WHERE Ticker = ?
                           """, (row["Sector Score"], row["Ticker"]))
        conn.commit()
        log("Sector scores updated in database.")

        conn.close()
        log("DATABASE SAFE")
        log("Task completed successfully\n")

    except Exception:
        log("TASK FAILED")
        log(traceback.format_exc())
        raise

    finally:
        remove_lock()


if __name__ == "__main__":
    main()