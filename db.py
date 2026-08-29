import os
import time

import psycopg2
import psycopg2.extras
from dotenv import load_dotenv


load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "").strip()

if not DATABASE_URL:
    raise ValueError("DATABASE_URL is missing or empty.")

if "sslmode=" not in DATABASE_URL:
    separator = "&" if "?" in DATABASE_URL else "?"
    DATABASE_URL = f"{DATABASE_URL}{separator}sslmode=require"

DB_CONNECT_ATTEMPTS = max(1, int(os.getenv("DB_CONNECT_ATTEMPTS", "5")))
DB_CONNECT_TIMEOUT_SECONDS = max(1, int(os.getenv("DB_CONNECT_TIMEOUT_SECONDS", "15")))


def _connect_with_retry(cursor_factory=None):
    last_error = None

    for attempt in range(1, DB_CONNECT_ATTEMPTS + 1):
        try:
            connect_kwargs = {
                "connect_timeout": DB_CONNECT_TIMEOUT_SECONDS,
                "keepalives": 1,
                "keepalives_idle": 30,
                "keepalives_interval": 10,
                "keepalives_count": 5,
                "application_name": "bullionaire-api",
            }

            if cursor_factory:
                connect_kwargs["cursor_factory"] = cursor_factory

            return psycopg2.connect(DATABASE_URL, **connect_kwargs)

        except psycopg2.OperationalError as exc:
            last_error = exc

            if attempt == DB_CONNECT_ATTEMPTS:
                raise

            wait_seconds = min(15, attempt * 3)
            print(
                f"Database connection attempt {attempt}/{DB_CONNECT_ATTEMPTS} failed. "
                f"Retrying in {wait_seconds} seconds..."
            )
            time.sleep(wait_seconds)

    raise last_error


def get_db_connection():
    return _connect_with_retry()


def get_db_connection_dict():
    return _connect_with_retry(
        cursor_factory=psycopg2.extras.RealDictCursor
    )