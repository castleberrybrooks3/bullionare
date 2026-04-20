from dotenv import load_dotenv
import os
import time
import requests
from datetime import datetime, UTC

from psycopg2.extras import RealDictCursor, execute_values
from db import get_db_connection_dict

load_dotenv()

API_KEY = os.getenv("POLYGON_API_KEY", "").strip()
if not API_KEY:
    raise ValueError("POLYGON_API_KEY is missing or empty.")

BASE_URL = "https://api.polygon.io"
SNAPSHOT_TIMEOUT = 120
BATCH_SIZE = 1000

session = requests.Session()


def get_json(path: str, params: dict | None = None, timeout: int = 30):
    if params is None:
        params = {}

    params = {**params, "apiKey": API_KEY}
    url = f"{BASE_URL}{path}"

    for attempt in range(4):
        try:
            response = session.get(url, params=params, timeout=timeout)
            response.raise_for_status()
            return response.json()

        except requests.HTTPError as e:
            status_code = e.response.status_code if e.response is not None else None

            if attempt == 3:
                raise RuntimeError(f"HTTP error {status_code} for {url}: {e}") from e

            time.sleep(1.5 * (attempt + 1))

        except Exception as e:
            if attempt == 3:
                raise RuntimeError(f"Request error for {url}: {e}") from e

            time.sleep(1.5 * (attempt + 1))

    return None


def fetch_full_market_snapshot():
    data = get_json(
        "/v2/snapshot/locale/us/markets/stocks/tickers",
        {"include_otc": "true"},
        timeout=SNAPSHOT_TIMEOUT,
    )

    if not data:
        return []

    timestamp = datetime.now(UTC).isoformat(timespec="seconds")
    rows = []

    for row in data.get("tickers", []):
        ticker = row.get("ticker")
        if not ticker:
            continue

        day = row.get("day", {}) or {}
        prev_day = row.get("prevDay", {}) or {}
        min_bar = row.get("min", {}) or {}
        last_trade = row.get("lastTrade", {}) or {}

        current_price = (
            last_trade.get("p")
            or min_bar.get("c")
            or day.get("c")
            or prev_day.get("c")
        )

        rows.append(
            {
                "Ticker": ticker,
                "Current Price": current_price,
                "Previous Close": prev_day.get("c"),
                "Day Open": day.get("o"),
                "Day High": day.get("h"),
                "Day Low": day.get("l"),
                "Day Volume": day.get("v"),
                "Today Change %": row.get("todaysChangePerc"),
                "Last Updated": timestamp,
            }
        )

    return rows


def ensure_tickers_exist(conn, tickers: list[str]):
    if not tickers:
        return

    with conn.cursor() as cursor:
        values = [(ticker,) for ticker in tickers]
        execute_values(
            cursor,
            """
            INSERT INTO stocks ("Ticker")
            VALUES %s
            ON CONFLICT ("Ticker") DO NOTHING
            """,
            values,
            page_size=1000,
        )


def update_snapshot_batch(conn, rows: list[dict]):
    if not rows:
        return 0

    values = [
        (
            row["Ticker"],
            row.get("Current Price"),
            row.get("Previous Close"),
            row.get("Day Open"),
            row.get("Day High"),
            row.get("Day Low"),
            row.get("Day Volume"),
            row.get("Today Change %"),
            row.get("Last Updated"),
        )
        for row in rows
    ]

    with conn.cursor() as cursor:
        execute_values(
            cursor,
            """
            UPDATE stocks AS s
            SET
                "Current Price" = v."Current Price",
                "Previous Close" = v."Previous Close",
                "Day Open" = v."Day Open",
                "Day High" = v."Day High",
                "Day Low" = v."Day Low",
                "Day Volume" = v."Day Volume",
                "Today Change %%" = v."Today Change %%",
                "Last Updated" = v."Last Updated"
            FROM (
                VALUES %s
            ) AS v(
                "Ticker",
                "Current Price",
                "Previous Close",
                "Day Open",
                "Day High",
                "Day Low",
                "Day Volume",
                "Today Change %%",
                "Last Updated"
            )
            WHERE s."Ticker" = v."Ticker"
            """,
            values,
            page_size=1000,
        )

    return len(rows)


def main():
    start_time = time.time()

    print("Fetching Polygon full market snapshot...")
    snapshot_rows = fetch_full_market_snapshot()

    if not snapshot_rows:
        raise RuntimeError("No snapshot data returned from Polygon.")

    print(f"Snapshot rows fetched: {len(snapshot_rows)}")

    conn = get_db_connection_dict()
    total_updated = 0

    try:
        all_tickers = [row["Ticker"] for row in snapshot_rows]

        print("Ensuring all snapshot tickers exist in database...")
        ensure_tickers_exist(conn, all_tickers)
        conn.commit()

        for i in range(0, len(snapshot_rows), BATCH_SIZE):
            batch = snapshot_rows[i:i + BATCH_SIZE]
            updated_count = update_snapshot_batch(conn, batch)
            conn.commit()

            total_updated += updated_count
            print(f"Updated {min(i + BATCH_SIZE, len(snapshot_rows))} / {len(snapshot_rows)} rows...")

    finally:
        conn.close()

    elapsed_seconds = time.time() - start_time
    elapsed_minutes = elapsed_seconds / 60

    print(f"Done. Updated rows: {total_updated}")
    print(f"Total runtime: {elapsed_minutes:.2f} minutes")


if __name__ == "__main__":
    main()