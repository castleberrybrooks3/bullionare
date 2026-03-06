from polygon import RESTClient
import yfinance as yf

API_KEY = "texjTGAEpFdfZD_IgtB7iOqglkNLjbF0"

polygon_client = RESTClient(API_KEY)

ticker = "AAPL"

# Polygon test
snap = polygon_client.get_snapshot_ticker("stocks", ticker)

price = None
if snap and snap.ticker and snap.ticker.last_trade:
    price = snap.ticker.last_trade.p

print("Polygon price:", price)

# Yahoo test
info = yf.Ticker(ticker).info

print("Yahoo target mean:", info.get("targetMeanPrice"))
print("Yahoo beta:", info.get("beta"))