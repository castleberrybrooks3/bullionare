from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import sqlite3
import os
import math
import time

app = FastAPI()

# Allow frontend origins
origins = [
    "http://localhost:3000",
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

# Database path
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "stocks.db")

# In-memory cache
cache = {
    "data": None,
    "timestamp": 0
}
CACHE_TTL = 60  # seconds

def fetch_stocks_from_db():
    """Query SQLite and return cleaned stock data"""
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        # Fetch only columns your frontend actually needs (faster!)
        cursor.execute("SELECT * FROM stocks")
        rows = cursor.fetchall()
        conn.close()

        result = []
        for row in rows:
            cleaned_row = {}
            for key in row.keys():
                value = row[key]
                if isinstance(value, float) and (math.isinf(value) or math.isnan(value)):
                    value = None
                cleaned_row[key] = value
            result.append(cleaned_row)

        return result
    except Exception as e:
        return {"error": str(e)}

@app.on_event("startup")
def preload_cache():
    """Preload the stock data into memory on server startup"""
    cache["data"] = fetch_stocks_from_db()
    cache["timestamp"] = time.time()
    print(f"[Startup] Cached {len(cache['data'])} stocks")

@app.get("/stocks")
def get_stocks():
    """Return stock data, using cache if fresh"""
    now = time.time()
    if cache["data"] is None or now - cache["timestamp"] > CACHE_TTL:
        cache["data"] = fetch_stocks_from_db()
        cache["timestamp"] = now
    return cache["data"]