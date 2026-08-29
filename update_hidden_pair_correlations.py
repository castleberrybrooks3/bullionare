import os
import pandas as pd
import psycopg2
from psycopg2.extras import execute_values
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "").strip()

LOOKBACK_DAYS = 252
STOCK_MATCHES_PER_TICKER = 20
ETF_MATCHES_PER_TICKER = 20
MIN_OBSERVATIONS = 60
MIN_CORRELATION = 0.0
HEDGE_MATCHES_PER_TICKER = 10
MIN_NEGATIVE_CORRELATION = -0.20


def get_connection():
    if not DATABASE_URL:
        raise ValueError("DATABASE_URL is missing")

    db_url = DATABASE_URL
    if "sslmode=" not in db_url:
        separator = "&" if "?" in db_url else "?"
        db_url = f"{db_url}{separator}sslmode=require"

    return psycopg2.connect(db_url)


def load_price_history(conn):
    query = """
        select
            ticker,
            date,
            close,
            name,
            type,
            sector
        from historical_prices
        where close is not null
          and date >= current_date - (%s * interval '1 day')
    """

    df = pd.read_sql(query, conn, params=(LOOKBACK_DAYS + 30,))
    df["ticker"] = df["ticker"].str.upper().str.strip()
    df["date"] = pd.to_datetime(df["date"])
    df["close"] = pd.to_numeric(df["close"], errors="coerce")

    return df.dropna(subset=["ticker", "date", "close"])


def calculate_returns(price_df):
    prices = (
        price_df
        .sort_values(["ticker", "date"])
        .pivot_table(index="date", columns="ticker", values="close", aggfunc="last")
        .tail(LOOKBACK_DAYS)
    )

    returns = prices.pct_change(fill_method=None).dropna(how="all")
    returns = returns.dropna(axis=1, thresh=MIN_OBSERVATIONS)

    return returns


def build_metadata(price_df):
    metadata = (
        price_df
        .sort_values("date")
        .groupby("ticker")
        .tail(1)
        .set_index("ticker")[["name", "type", "sector"]]
        .to_dict("index")
    )

    return metadata

def normalize_security_type(security_type):
    value = str(security_type or "").upper().strip()

    if value == "CS":
        return "Stock"

    if value == "ETF":
        return "ETF"

    return security_type

def clean_text(value):
    return str(value or "").strip()


def is_bad_stock_proxy(name, ticker):
    """
    Excludes securities that may be labeled CS/Common Stock in the raw database
    but are not useful operating-company stock matches.
    """
    name_upper = clean_text(name).upper()
    ticker_upper = clean_text(ticker).upper()

    bad_name_terms = [
        " ETF",
        " ETN",
        " FUND",
        " TRUST",
        " INCOME",
        " BOND",
        " TREASURY",
        " PREFERRED",
        " PREFERENCE",
        " NOTE",
        " NOTES",
        " DEBENTURE",
        " CLOSED-END",
        " CLOSED END",
        " MUNICIPAL",
        " BUFFER",
        " LEVERAGED",
        " 2X",
        " 3X",
        " ULTRA",
        " SHORT",
        " INVERSE",
        " DAILY",
        " STRATEGY",
        " STRATEGIC TOTAL RETURN",
        " TARGET",
        " OPTION",
        " OPTIONS",
        " COVERED CALL",
        " YIELD",
    ]

    bad_ticker_suffixes = [
        "W",     # warrants sometimes end in W
        "WS",    # warrants
        "U",     # units
        "R",     # rights
        "P",     # preferred-ish suffix in some datasets
    ]

    if any(term in name_upper for term in bad_name_terms):
        return True

    # Avoid over-filtering normal tickers like LOW, NOW, etc.
    if len(ticker_upper) >= 5 and any(ticker_upper.endswith(suffix) for suffix in bad_ticker_suffixes):
        return True

    return False


def is_usable_stock_match(match_meta, match_ticker):
    match_type = normalize_security_type(match_meta.get("type"))

    if match_type != "Stock":
        return False

    name = match_meta.get("name")

    if is_bad_stock_proxy(name, match_ticker):
        return False

    return True


def is_structured_or_inverse_etf(name, sector):
    name_upper = clean_text(name).upper()
    sector_upper = clean_text(sector).upper()

    bad_terms = [
        "INVERSE",
        "SHORT",
        "ULTRASHORT",
        "BEAR",
        "2X",
        "3X",
        "LEVERAGED",
        "DAILY",
        "DIREXION",
        "TRADR",
        "PROSHARES ULTRA",
        "PROSHARES SHORT",
        "ULTRAPRO",
        "DEFINED OUTCOME",
        "BUFFER",
        "PREMIUM INCOME",
        "DERIVATIVE INCOME",
        "COVERED CALL",
        "OPTION",
        "OPTIONS",
    ]

    return any(term in name_upper or term in sector_upper for term in bad_terms)


def is_usable_etf_match(match_meta):
    match_type = normalize_security_type(match_meta.get("type"))

    if match_type != "ETF":
        return False

    name = match_meta.get("name")
    sector = match_meta.get("sector")

    if is_structured_or_inverse_etf(name, sector):
        return False

    return True


def is_usable_hedge_etf_match(match_meta):
    match_type = normalize_security_type(match_meta.get("type"))
    return match_type == "ETF"


def correlation_quality(correlation):
    try:
        corr = float(correlation)
    except Exception:
        return "Unknown"

    if corr >= 0.85:
        return "Very Strong"
    if corr >= 0.70:
        return "Strong"
    if corr >= 0.50:
        return "Moderate"
    if corr >= 0.30:
        return "Weak"
    return "Very Weak"


def infer_match_use_case(match_type, correlation):
    quality = correlation_quality(correlation)

    if match_type == "ETF":
        if quality in ("Very Strong", "Strong"):
            return "Potential ETF proxy, hedge, or benchmark comparison"
        return "Broad basket comparison or loose ETF proxy"

    if match_type == "Stock":
        if quality in ("Very Strong", "Strong"):
            return "Potential pair trade or relative-value comparison"
        if quality == "Moderate":
            return "Comparable stock relationship, but not a tight hedge"
        return "Loose historical relationship"

    return "Historical correlation comparison"

def infer_relationship(base_meta, match_meta):
    base_sector = base_meta.get("sector")
    match_sector = match_meta.get("sector")
    base_type = normalize_security_type(base_meta.get("type"))
    match_type = normalize_security_type(match_meta.get("type"))

    if base_type == "ETF" and match_type == "ETF":
        return "ETF Pair / Similar Basket"

    if match_type == "ETF":
        return "ETF Proxy / Basket Exposure"

    if base_sector and match_sector and base_sector == match_sector:
        return f"{base_sector} Peer"

    return "High Historical Correlation"

def calculate_top_correlations(returns, metadata):
    MIN_PAIR_OBSERVATIONS = 120

    corr_matrix = returns.corr(min_periods=MIN_PAIR_OBSERVATIONS)
    rows = []

    # Count how many overlapping daily return observations each pair has.
    overlap_matrix = returns.notna().astype(int).T.dot(returns.notna().astype(int))

    for base_ticker in corr_matrix.columns:
        correlations = corr_matrix[base_ticker].drop(labels=[base_ticker], errors="ignore")
        correlations = correlations.dropna()

        # Keep positive relationships only, then rank the best stocks and ETFs separately.
        correlations = correlations[correlations > MIN_CORRELATION]
        correlations = correlations.sort_values(ascending=False)

        base_meta = metadata.get(base_ticker, {})
        base_type = normalize_security_type(base_meta.get("type"))

        stock_rows = []
        etf_rows = []
        hedge_rows = []

        for match_ticker, corr in correlations.items():
            match_meta = metadata.get(match_ticker, {})

            if is_usable_stock_match(match_meta, match_ticker):
                bucket = "Stock"
            elif is_usable_etf_match(match_meta):
                bucket = "ETF"
            else:
                continue

            overlap_days = int(overlap_matrix.loc[base_ticker, match_ticker])

            row = {
                "base_ticker": base_ticker,
                "match_ticker": match_ticker,
                "base_name": base_meta.get("name"),
                "match_name": match_meta.get("name"),
                "base_type": base_type,
                "match_type": bucket,
                "base_sector": base_meta.get("sector"),
                "match_sector": match_meta.get("sector"),
                "correlation": float(corr),
                "correlation_direction": "positive",
                "lookback_days": LOOKBACK_DAYS,
                "overlap_days": overlap_days,
                "relationship": infer_relationship(base_meta, match_meta),
                "correlation_quality": correlation_quality(corr),
                "use_case": infer_match_use_case(bucket, corr),
            }

            if bucket == "Stock":
                stock_rows.append(row)
            elif bucket == "ETF":
                etf_rows.append(row)

        negative_correlations = corr_matrix[base_ticker].drop(labels=[base_ticker], errors="ignore")
        negative_correlations = negative_correlations.dropna()
        negative_correlations = negative_correlations[negative_correlations <= MIN_NEGATIVE_CORRELATION]
        negative_correlations = negative_correlations.sort_values(ascending=True)

        for match_ticker, corr in negative_correlations.items():
            match_meta = metadata.get(match_ticker, {})

            if is_usable_hedge_etf_match(match_meta):
                bucket = "ETF"
            elif is_usable_stock_match(match_meta, match_ticker):
                bucket = "Stock"
            else:
                continue

            row = {
                "base_ticker": base_ticker,
                "match_ticker": match_ticker,
                "base_name": base_meta.get("name"),
                "match_name": match_meta.get("name"),
                "base_type": base_type,
                "match_type": bucket,
                "base_sector": base_meta.get("sector"),
                "match_sector": match_meta.get("sector"),
                "correlation": float(corr),
                "lookback_days": LOOKBACK_DAYS,
                "overlap_days": int(overlap_matrix.loc[base_ticker, match_ticker]),
                "relationship": "Potential Hedge Candidate",
                "correlation_quality": correlation_quality(abs(corr)),
                "use_case": "Potential Hedge",
                "correlation_direction": "negative",
            }

            hedge_rows.append(row)

        rows.extend(stock_rows[:STOCK_MATCHES_PER_TICKER])
        rows.extend(etf_rows[:ETF_MATCHES_PER_TICKER])
        rows.extend(hedge_rows[:HEDGE_MATCHES_PER_TICKER])

    return rows

def save_results(conn, rows):
    if not rows:
        print("No correlation rows generated. Skipping database update.")
        return

    insert_query = """
        insert into hidden_pair_correlations (
            base_ticker,
            match_ticker,
            base_name,
            match_name,
            base_type,
            match_type,
            base_sector,
            match_sector,
            correlation,
            correlation_direction,
            lookback_days,
            relationship,
            updated_at
        )
        values %s
    """

    values = [
        (
            r["base_ticker"],
            r["match_ticker"],
            r["base_name"],
            r["match_name"],
            r["base_type"],
            r["match_type"],
            r["base_sector"],
            r["match_sector"],
            r["correlation"],
            r.get("correlation_direction", "positive"),
            r["lookback_days"],
            r["relationship"],
            pd.Timestamp.now("UTC").to_pydatetime(),
        )
        for r in rows
    ]

    with conn.cursor() as cur:
        cur.execute("truncate table hidden_pair_correlations;")
        execute_values(cur, insert_query, values)

    conn.commit()


def main():
    conn = get_connection()

    try:
        print("Loading historical prices...")
        price_df = load_price_history(conn)

        print(f"Loaded {len(price_df):,} price rows")

        print("Calculating returns...")
        returns = calculate_returns(price_df)

        print(f"Calculating correlations across {len(returns.columns):,} securities...")

        metadata = build_metadata(price_df)
        rows = calculate_top_correlations(returns, metadata)

        print(f"Saving {len(rows):,} hidden-pair correlation rows...")
        save_results(conn, rows)

        print("Hidden pair correlations updated successfully.")

    finally:
        conn.close()


if __name__ == "__main__":
    main()