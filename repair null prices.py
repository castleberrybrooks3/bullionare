import sqlite3
import time
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed
from tqdm import tqdm
import yfinance as yf

# ================================
# SETTINGS
# ================================
DB_FILE = "stocks.db"
LOG_FILE = r"C:\Users\Brooks Castleberry\PyCharmMiscProject\hourly_update_log.txt"

max_threads = 6
sleep_between_requests = 0.12
autosave_every = 100
max_retries = 2

# ================================
# LOG FUNCTION
# ================================
def log(msg):
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    with open(LOG_FILE, "a") as f:
        f.write(f"{timestamp} | {msg}\n")
    print(f"{timestamp} | {msg}")

# ================================
# LOAD TICKERS FROM DATABASE
# ================================
conn = sqlite3.connect(DB_FILE, check_same_thread=False)
cursor = conn.cursor()
cursor.execute("SELECT Ticker FROM stock_data")
tickers = [row[0] for row in cursor.fetchall()]
log(f"Tickers loaded: {len(tickers)}")

# ================================
# FETCH PRICE ONLY
# ================================
def fetch_price(ticker):
    for attempt in range(max_retries):
        try:
            stock = yf.Ticker(ticker)
            info = stock.info if stock else {}

            price = info.get("currentPrice") or info.get("regularMarketPrice")

            time.sleep(sleep_between_requests)
            return price, datetime.now().strftime("%Y-%m-%d %H:%M:%S"), ticker

        except Exception:
            log(f"Retrying {ticker} (attempt {attempt + 1})")
            time.sleep(0.3)

    # If fetch fails → keep timestamp but don't erase price
    return None, datetime.now().strftime("%Y-%m-%d %H:%M:%S"), ticker

# ================================
# AUTOSAVE FUNCTION
# ================================
def autosave(batch, total):
    if not batch:
        return total

    cursor.executemany("""
        UPDATE stock_data
        SET
            "Current Price" = COALESCE(?, "Current Price"),
            "Last Updated" = ?
        WHERE Ticker = ?
    """, batch)
    conn.commit()
    total += len(batch)
    log(f"AUTOSAVE ✔ {len(batch)} rows | Total updated: {total}")
    batch.clear()
    return total

# ================================
# RUN ENGINE
# ================================
log("Starting hourly price update...")

batch = []
total_updated = 0

with ThreadPoolExecutor(max_threads) as executor:
    futures = {executor.submit(fetch_price, t): t for t in tickers}
    for future in tqdm(as_completed(futures), total=len(futures)):
        result = future.result()
        batch.append(result)
        if len(batch) >= autosave_every:
            total_updated = autosave(batch, total_updated)

# Final save
total_updated = autosave(batch, total_updated)

conn.close()
log("UPDATE COMPLETE")
log(f"Total rows updated: {total_updated}")