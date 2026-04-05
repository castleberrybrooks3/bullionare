import requests

API_KEY = "IttvbIrJJFaIyT51FhQbdVWVpwhyE2v1"

ticker = "AAPL"
url = f"https://api.polygon.io/v2/aggs/ticker/{ticker}/prev"

response = requests.get(url, params={"apiKey": API_KEY})
data = response.json()

print(data)