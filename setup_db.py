import sqlite3

DB_PATH = "stocks.db"

def main():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS stocks (
        "Ticker" TEXT PRIMARY KEY,

        -- REQUIRED FOR HOVER
        "Company Name" TEXT,
        "Description" TEXT,

        -- Massive / Polygon-owned columns
        "Type" TEXT,
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
        "Dividend Frequency" TEXT,

        "Latest 10-K Date" TEXT,
        "Latest 10-K URL" TEXT,
        "Latest 10-Q Date" TEXT,
        "Latest 10-Q URL" TEXT,

        "Last Updated" TEXT,

        -- Yahoo-owned columns
        "Beta" REAL,
        "EBITDA" REAL,
        "Short % of Float" REAL,
        "Gross Profit" REAL,
        "Analyst Upside" REAL,
        "Analyst Downside" REAL,
        "Mean Target" REAL,
        "Number of Analysts" INTEGER,
        "Sector" TEXT
    )
    """)

    conn.commit()
    conn.close()

    print("Database setup complete.")

if __name__ == "__main__":
    main()