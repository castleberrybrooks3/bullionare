from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import sqlite3
import os
import math

app = FastAPI()

# Allow frontend on localhost for dev AND production front end
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

@app.get("/stocks")
def get_stocks():
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM stocks")
        rows = cursor.fetchall()

        result = []
        for row in rows:
            cleaned_row = {}
            for key in row.keys():
                value = row[key]
                # Handle NaN and inf
                if isinstance(value, float) and (math.isinf(value) or math.isnan(value)):
                    value = None

                # Keep same keys for frontend
                cleaned_row[key] = value

            result.append(cleaned_row)

        conn.close()
        return result

    except Exception as e:
        return {"error": str(e)}