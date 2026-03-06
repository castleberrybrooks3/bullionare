import pandas as pd
import sqlite3

# Load Excel file
df = pd.read_excel("stock_data.xlsx")

# Connect to SQLite
conn = sqlite3.connect("stocks.db")

# Replace entire stocks table with full dataset
df.to_sql("stocks", conn, if_exists="replace", index=False)

conn.close()

print("Migration complete. Database now contains full dataset.")