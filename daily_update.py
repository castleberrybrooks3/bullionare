import os
import sqlite3
import time
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed
from tqdm import tqdm
import yfinance as yf

# ================================
# LOCK FILE (Prevents Double Runs)
# ================================
LOCK_FILE = "stocks.lock"

if os.path.exists(LOCK_FILE):
    print("Another instance is already running. Exiting.")
    exit()

with open(LOCK_FILE, "w") as f:
    f.write(str(os.getpid()))

# ================================
# SETTINGS
# ================================
DB_FILE = r"C:\Users\Brooks Castleberry\PyCharmMiscProject\stocks.db"
LOG_FILE = r"C:\Users\Brooks Castleberry\PyCharmMiscProject\hourly_prices_log.txt"

MAX_THREADS = 4
SLEEP_BETWEEN_REQUESTS = 0.5
AUTOSAVE_EVERY = 100
MAX_RETRIES = 3

# ================================
# API TOGGLE (OFF FOR NOW)
# ================================
USE_API = False  # Flip to True when you want to use your API key
API_KEY = "YOUR_API_KEY_HERE"  # Placeholder

# ================================
# LOGGING
# ================================
def log(message):
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    formatted = f"{timestamp} | {message}"
    with open(LOG_FILE, "a", encoding="utf-8") as f:
        f.write(formatted + "\n")
    print(formatted)

# ================================
# FETCH PRICE FUNCTIONS
# ================================
def fetch_price_yfinance(ticker):
    """Fetch latest intraday price using yfinance history (free mode)."""
    for attempt in range(MAX_RETRIES):
        try:
            stock = yf.Ticker(ticker)
            data = stock.history(period="1d", interval="1m")
            if not data.empty:
                price = float(data["Close"].iloc[-1])
            else:
                price = None
            time.sleep(SLEEP_BETWEEN_REQUESTS)
            return price
        except Exception as e:
            log(f"[{ticker}] yfinance attempt {attempt+1} failed: {e}")
            time.sleep(0.5)
    return None

def fetch_price_api(ticker):
    """Fetch latest price using API (placeholder)."""
    log(f"[{ticker}] API fetch mode active (placeholder).")
    return None

def fetch_price(ticker):
    """Wrapper: choose between API or free yfinance."""
    if USE_API:
        return fetch_price_api(ticker)
    else:
        return fetch_price_yfinance(ticker)

# ================================
# AUTOSAVE
# ================================
def autosave(batch, total, conn):
    if not batch:
        return total

    cursor = conn.cursor()
    cursor.executemany("""
        UPDATE stock_data
        SET "Current Price" = COALESCE(?, "Current Price"),
            "Last Updated" = ?
        WHERE Ticker = ?
    """, batch)

    conn.commit()
    total += len(batch)
    log(f"Autosaved {len(batch)} rows | Total updated: {total}")
    batch.clear()
    return total

# ================================
# MAIN
# ================================
def main():
    try:
        log("Hourly price update started")

        conn = sqlite3.connect(DB_FILE, check_same_thread=False)
        cursor = conn.cursor()
        cursor.execute("SELECT Ticker FROM stock_data")
        tickers = [row[0] for row in cursor.fetchall()]
        log(f"Loaded {len(tickers)} tickers")

        batch = []
        total_updated = 0

        with ThreadPoolExecutor(MAX_THREADS) as executor:
            futures = {executor.submit(fetch_price, t): t for t in tickers}
            for future in tqdm(as_completed(futures), total=len(futures)):
                ticker = futures[future]
                price = future.result()
                batch.append((price, datetime.now().strftime("%Y-%m-%d %H:%M:%S"), ticker))

                if len(batch) >= AUTOSAVE_EVERY:
                    total_updated = autosave(batch, total_updated, conn)

        # Final save
        total_updated = autosave(batch, total_updated, conn)
        conn.close()
        log(f"Hourly price update complete | Total rows updated: {total_updated}")

    finally:
        # ================================
        # REMOVE LOCK FILE ON EXIT
        # ================================
        if os.path.exists(LOCK_FILE):
            os.remove(LOCK_FILE)