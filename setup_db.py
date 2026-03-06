# setup_db.py
import sqlite3

# Connect to the database (creates stocks.db if it doesn't exist)
conn = sqlite3.connect("stocks.db")
cursor = conn.cursor()

# Create the stocks table
cursor.execute("""
CREATE TABLE IF NOT EXISTS stocks (
    ticker TEXT PRIMARY KEY,
    price REAL
)
""")

# Insert some sample stocks
sample_stocks = [
    ("AAPL", 174.12),
    ("MSFT", 309.45),
    ("GOOG", 136.78),
    ("AMZN", 102.34),
    ("TSLA", 189.50)
]

# Insert or replace to avoid duplicates
cursor.executemany("INSERT OR REPLACE INTO stocks (ticker, price) VALUES (?, ?)", sample_stocks)

conn.commit()
conn.close()

print("Database setup complete with sample stocks.")