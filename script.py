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
    MAX_THREADS = 4
    SLEEP_BETWEEN_REQUESTS = 0.8
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
                info = stock.info
                if not info or "quoteType" not in info:
                    log(f"Yahoo BLOCK → cooling... ({ticker})")
                    time.sleep(10)
                    continue

                fast = stock.fast_info

                price = info.get("currentPrice") or fast.get("last_price")
                market_cap = info.get("marketCap") or fast.get("market_cap")
                eps = info.get("trailingEps")
                pe = info.get("trailingPE")
                beta = info.get("beta")
                div = info.get("dividendYield")
                sector = info.get("sector") or info.get("industry")
                exchange = info.get("exchange") or fast.get("exchange")
                ebitda = info.get("ebitda")  # <-- Added EBITDA here

                low = info.get("targetLowPrice")
                mean = info.get("targetMeanPrice")
                high = info.get("targetHighPrice")

                upside = ((high - price) / price * 100) if price and high else None
                downside = ((low - price) / price * 100) if price and low else None
                score = (upside / beta) if upside and beta and beta != 0 else None

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
                    ebitda,  # <-- Added EBITDA here
                    upside,
                    downside,
                    mean,
                    score,
                    datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                )

        except Exception:
            log(f"Retrying {ticker} (attempt {attempt + 1})")
            time.sleep(3)
    return None

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
                INSERT INTO stock_data VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(Ticker) DO UPDATE SET
                    "Current Price" = COALESCE(excluded."Current Price", "Current Price"),
                    "Market Cap" = COALESCE(excluded."Market Cap", "Market Cap"),
                    "EPS (TTM)" = COALESCE(excluded."EPS (TTM)", "EPS (TTM)"),
                    "P/E (TTM)" = COALESCE(excluded."P/E (TTM)", "P/E (TTM)"),
                    Beta = COALESCE(excluded.Beta, Beta),
                    "Dividend Yield" = COALESCE(excluded."Dividend Yield", "Dividend Yield"),
                    Sector = COALESCE(excluded.Sector, Sector),
                    Exchange = COALESCE(excluded.Exchange, Exchange),
                    EBITDA = COALESCE(excluded.EBITDA, EBITDA),
                    "Upside %" = COALESCE(excluded."Upside %", "Upside %"),
                    "Downside %" = COALESCE(excluded."Downside %", "Downside %"),
                    "Mean Target" = COALESCE(excluded."Mean Target", "Mean Target"),
                    "Risk-Reward Score" = COALESCE(excluded."Risk-Reward Score", "Risk-Reward Score"),
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
        conn.close()
        log("DATABASE SAFE")
        log("Task completed successfully\n")

    except Exception:
        log("TASK FAILED")
        log(traceback.format_exc())
        raise

    finally:
        remove_lock()