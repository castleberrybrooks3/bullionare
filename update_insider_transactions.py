import time
import threading
import requests
import xml.etree.ElementTree as ET
from collections import deque
from concurrent.futures import ThreadPoolExecutor, as_completed
from db import get_db_connection_dict

SEC_BASE_URL = "https://data.sec.gov"
SEC_WWW_URL = "https://www.sec.gov"

SEC_HEADERS = {
    "User-Agent": "BullionaireIQ info@bullionaireiq.com",
    "Accept-Encoding": "gzip, deflate",
    "Host": "data.sec.gov",
}

SEC_WWW_HEADERS = {
    "User-Agent": "BullionaireIQ info@bullionaireiq.com",
    "Accept-Encoding": "gzip, deflate",
    "Host": "www.sec.gov",
}

SEC_REQUESTS_PER_SECOND = 7
SEC_REQUEST_LOCK = threading.Lock()
SEC_REQUEST_TIMES = deque()
THREAD_LOCAL = threading.local()


def get_thread_session():
    if not hasattr(THREAD_LOCAL, "session"):
        THREAD_LOCAL.session = requests.Session()
    return THREAD_LOCAL.session


def wait_for_sec_slot():
    while True:
        with SEC_REQUEST_LOCK:
            now = time.time()

            while SEC_REQUEST_TIMES and now - SEC_REQUEST_TIMES[0] >= 1:
                SEC_REQUEST_TIMES.popleft()

            if len(SEC_REQUEST_TIMES) < SEC_REQUESTS_PER_SECOND:
                SEC_REQUEST_TIMES.append(now)
                return

            sleep_for = 1 - (now - SEC_REQUEST_TIMES[0]) + 0.03

        time.sleep(max(sleep_for, 0.03))


def sec_get(url, headers=None, timeout=20):
    wait_for_sec_slot()
    session = get_thread_session()
    return session.get(url, headers=headers, timeout=timeout)


def safe_xml_text(node, path, default=None):
    try:
        found = node.find(path)
        if found is None or found.text is None:
            return default
        return found.text.strip()
    except Exception:
        return default


def safe_float(value):
    try:
        if value is None or value == "":
            return None
        return float(value)
    except Exception:
        return None


def clean_sec_accession(accession_number):
    return str(accession_number or "").replace("-", "")


def clean_primary_document_name(primary_document):
    if not primary_document:
        return ""
    return str(primary_document).split("/")[-1]


def strip_xml_namespaces(root):
    for elem in root.iter():
        if "}" in elem.tag:
            elem.tag = elem.tag.split("}", 1)[1]
    return root


def get_sec_json(url, headers=None, timeout=20):
    try:
        response = sec_get(url, headers=headers or SEC_HEADERS, timeout=timeout)
        response.raise_for_status()
        return response.json()
    except Exception as e:
        print(f"[SEC ERROR] {url} -> {type(e).__name__}: {e}", flush=True)
        return None


def load_ticker_universe(limit=None):
    conn = get_db_connection_dict()

    try:
        cur = conn.cursor()

        sql = """
            select
                upper(trim("Ticker")) as "Ticker",
                max("Market Cap") as market_cap
            from stocks
            where "Ticker" is not null
              and trim("Ticker") <> ''
              and coalesce("Type", '') in ('CS', 'Stock', 'Common Stock')
              and "Market Cap" is not null
            group by upper(trim("Ticker"))
            order by market_cap desc nulls last
        """

        if limit:
            sql += " limit %s"
            cur.execute(sql, (limit,))
        else:
            cur.execute(sql)

        rows = cur.fetchall()
        return [row["Ticker"].strip().upper() for row in rows if row.get("Ticker")]

    finally:
        conn.close()

def get_cik_for_ticker_map():
    url = f"{SEC_WWW_URL}/files/company_tickers.json"
    data = get_sec_json(url, headers=SEC_WWW_HEADERS)

    ticker_to_cik = {}

    if not data:
        return ticker_to_cik

    for _, row in data.items():
        ticker = str(row.get("ticker", "")).upper().strip()
        cik = str(row.get("cik_str", "")).zfill(10)

        if ticker and cik:
            ticker_to_cik[ticker] = cik

    return ticker_to_cik


def get_recent_form4_filings_for_ticker(ticker, cik, limit=40):
    url = f"{SEC_BASE_URL}/submissions/CIK{cik}.json"
    submissions = get_sec_json(url, headers=SEC_HEADERS)

    if not submissions:
        return []

    recent = submissions.get("filings", {}).get("recent", {})

    forms = recent.get("form", [])
    filing_dates = recent.get("filingDate", [])
    report_dates = recent.get("reportDate", [])
    accession_numbers = recent.get("accessionNumber", [])
    primary_documents = recent.get("primaryDocument", [])

    filings = []

    for index, form in enumerate(forms):
        if form != "4":
            continue

        accession = accession_numbers[index] if index < len(accession_numbers) else None
        primary_doc = primary_documents[index] if index < len(primary_documents) else None

        if not accession or not primary_doc:
            continue

        filer_cik = str(int(cik))

        filings.append({
            "ticker": ticker.upper(),
            "issuer_cik": cik,
            "filer_cik": filer_cik,
            "accession_number": accession,
            "accession_clean": clean_sec_accession(accession),
            "primary_document": primary_doc,
            "filing_date": filing_dates[index] if index < len(filing_dates) else None,
            "report_date": report_dates[index] if index < len(report_dates) else None,
        })

        if len(filings) >= limit:
            break

    return filings


def get_archive_index_json(cik_candidate, accession_clean):
    index_url = (
        f"{SEC_WWW_URL}/Archives/edgar/data/"
        f"{cik_candidate}/{accession_clean}/index.json"
    )

    try:
        response = sec_get(index_url, headers=SEC_WWW_HEADERS, timeout=20)
        response.raise_for_status()
        return response.json(), index_url
    except Exception:
        return None, index_url


def find_actual_form4_document_url(ticker, cik, filing):
    accession_clean = filing["accession_clean"]
    primary_document = clean_primary_document_name(filing.get("primary_document"))

    accession_prefix_cik = str(filing.get("accession_number", ""))
    accession_prefix_cik = accession_prefix_cik.split("-")[0].lstrip("0")

    candidate_ciks = []

    # Most important: issuer company CIK
    if cik:
        candidate_ciks.append(str(int(cik)))

    # Backup: accession prefix CIK
    if accession_prefix_cik:
        candidate_ciks.append(accession_prefix_cik)

    # Remove duplicates while preserving order
    candidate_ciks = list(dict.fromkeys(candidate_ciks))

    for cik_candidate in candidate_ciks:
        index_json, index_url = get_archive_index_json(
            cik_candidate=cik_candidate,
            accession_clean=accession_clean,
        )

        if not index_json:
            continue

        items = index_json.get("directory", {}).get("item", [])

        filenames = [
            item.get("name")
            for item in items
            if item.get("name")
        ]

        # 1. Try the primary document from submissions JSON
        if primary_document in filenames:
            return (
                f"{SEC_WWW_URL}/Archives/edgar/data/"
                f"{cik_candidate}/{accession_clean}/{primary_document}"
            )

        # 2. Try likely XML ownership docs
        xml_candidates = [
            name for name in filenames
            if name.lower().endswith(".xml")
            and not name.lower().startswith("primary")
            and not name.lower().startswith("form")
        ]

        # 3. If no clean candidate, take any XML file
        if not xml_candidates:
            xml_candidates = [
                name for name in filenames
                if name.lower().endswith(".xml")
            ]

        if xml_candidates:
            chosen = xml_candidates[0]
            return (
                f"{SEC_WWW_URL}/Archives/edgar/data/"
                f"{cik_candidate}/{accession_clean}/{chosen}"
            )

    # Final fallback: old direct URL attempt
    fallback_cik = str(int(cik))
    return (
        f"{SEC_WWW_URL}/Archives/edgar/data/"
        f"{fallback_cik}/{accession_clean}/{primary_document}"
    )
def normalize_cik(value):
    clean = str(value or "").strip()

    if not clean:
        return ""

    try:
        return str(int(clean))
    except Exception:
        return clean.lstrip("0")

def parse_actionable_form4_transactions(ticker, cik, filing):
    filing_url = find_actual_form4_document_url(ticker, cik, filing)

    try:
        response = sec_get(filing_url, headers=SEC_WWW_HEADERS, timeout=20)
        response.raise_for_status()
    except Exception as e:
        print(
            f"[FORM 4 FETCH ERROR] {ticker} {filing_url} -> "
            f"{type(e).__name__}: {e}",
            flush=True,
        )
        return []

    try:
        root = ET.fromstring(response.content)
        root = strip_xml_namespaces(root)
    except Exception as e:
        print(
            f"[FORM 4 XML ERROR] {ticker} {filing_url} -> "
            f"{type(e).__name__}: {e}",
            flush=True,
        )
        return []

    issuer_name = safe_xml_text(root, "./issuer/issuerName", ticker.upper())

    issuer_cik_from_xml = safe_xml_text(root, "./issuer/issuerCik", "")

    expected_issuer_cik = normalize_cik(cik)
    actual_issuer_cik = normalize_cik(issuer_cik_from_xml)

    if actual_issuer_cik and expected_issuer_cik and actual_issuer_cik != expected_issuer_cik:
        print(
            f"[SKIP WRONG ISSUER] {ticker}: XML issuer CIK {actual_issuer_cik} "
            f"does not match expected ticker CIK {expected_issuer_cik}.",
            flush=True,
        )
        return []

    reporting_owner_name = safe_xml_text(
        root,
        "./reportingOwner/reportingOwnerId/rptOwnerName",
        "Unknown Insider",
    )

    officer_title = safe_xml_text(
        root,
        "./reportingOwner/reportingOwnerRelationship/officerTitle",
        "",
    )

    is_director = safe_xml_text(
        root,
        "./reportingOwner/reportingOwnerRelationship/isDirector",
        "0",
    )

    is_officer = safe_xml_text(
        root,
        "./reportingOwner/reportingOwnerRelationship/isOfficer",
        "0",
    )

    is_ten_percent_owner = safe_xml_text(
        root,
        "./reportingOwner/reportingOwnerRelationship/isTenPercentOwner",
        "0",
    )

    title_parts = []

    if is_director == "1":
        title_parts.append("Director")

    if is_officer == "1":
        title_parts.append(officer_title or "Officer")

    if is_ten_percent_owner == "1":
        title_parts.append("10% Owner")

    title = ", ".join(title_parts) if title_parts else officer_title or "Insider"

    output = []

    transaction_nodes = []

    # Only regular non-derivative insider transactions.
    # This avoids derivative option noise and keeps the dataset focused on real buy/sell activity.
    for tx in root.findall(".//nonDerivativeTransaction"):
        transaction_nodes.append((tx, False))

    for tx, is_derivative in transaction_nodes:
        transaction_code = safe_xml_text(
            tx,
            "./transactionCoding/transactionCode",
            "",
        )
        transaction_code = str(transaction_code or "").upper().strip()

        # Keep pure buy/sell only
        if transaction_code not in ("P", "S"):
            continue

        security_title = safe_xml_text(
            tx,
            "./securityTitle/value",
            "Derivative Security" if is_derivative else "Common Stock",
        )

        transaction_date = safe_xml_text(
            tx,
            "./transactionDate/value",
            filing.get("report_date") or filing.get("filing_date"),
        )

        shares = safe_float(
            safe_xml_text(tx, "./transactionAmounts/transactionShares/value")
        )

        price = safe_float(
            safe_xml_text(tx, "./transactionAmounts/transactionPricePerShare/value")
        )

        shares_owned_following = safe_float(
            safe_xml_text(
                tx,
                "./postTransactionAmounts/sharesOwnedFollowingTransaction/value",
            )
        )

        transaction_type = "Buy" if transaction_code == "P" else "Sell"
        signal = "Bullish" if transaction_code == "P" else "Bearish"

        value = None

        if shares is not None and price is not None:
            value = shares * price

        output.append({
            "ticker": ticker.upper(),
            "company": issuer_name,
            "insider": reporting_owner_name,
            "title": title,
            "transaction_type": transaction_type,
            "transaction_code": transaction_code,
            "security_title": security_title,
            "shares": shares,
            "price": price,
            "value": value,
            "transaction_date": transaction_date,
            "filing_date": filing.get("filing_date"),
            "report_date": filing.get("report_date"),
            "shares_owned_following": shares_owned_following,
            "signal": signal,
            "accession_number": filing.get("accession_number"),
            "filing_url": filing_url,
            "is_derivative": is_derivative,
            "source": "SEC Form 4",
        })

    return output


def save_transactions(rows):
    """
    Append-only insert.

    Existing insider transaction rows are NEVER updated. If the same Form 4
    transaction is encountered again, the existing unique constraint absorbs it
    with DO NOTHING.
    """
    if not rows:
        return 0

    conn = get_db_connection_dict()

    try:
        cur = conn.cursor()
        saved = 0

        for row in rows:
            cur.execute(
                """
                insert into insider_transactions (
                    ticker,
                    company,
                    insider,
                    title,
                    transaction_type,
                    transaction_code,
                    security_title,
                    shares,
                    price,
                    value,
                    transaction_date,
                    filing_date,
                    report_date,
                    shares_owned_following,
                    signal,
                    accession_number,
                    filing_url,
                    is_derivative,
                    source,
                    updated_at
                )
                values (
                    %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                    %s::date, %s::date, %s::date, %s, %s, %s, %s, %s, %s, now()
                )
                on conflict (
                    accession_number,
                    insider,
                    transaction_code,
                    transaction_date,
                    shares,
                    price
                )
                do nothing
                """,
                (
                    row["ticker"],
                    row["company"],
                    row["insider"],
                    row["title"],
                    row["transaction_type"],
                    row["transaction_code"],
                    row["security_title"],
                    row["shares"],
                    row["price"],
                    row["value"],
                    row["transaction_date"],
                    row["filing_date"],
                    row["report_date"],
                    row["shares_owned_following"],
                    row["signal"],
                    row["accession_number"],
                    row["filing_url"],
                    row["is_derivative"],
                    row["source"],
                ),
            )
            saved += max(cur.rowcount or 0, 0)

        conn.commit()
        return saved

    except Exception:
        conn.rollback()
        raise

    finally:
        conn.close()


def _date_text(value):
    if value is None:
        return None
    text = str(value).strip()
    return text[:10] if len(text) >= 10 else text


def load_existing_incremental_state():
    """
    Build a per-ticker high-water mark from data already in Supabase.

    For each ticker we keep:
      * the latest SEC filing_date already stored;
      * the accession numbers already stored on that latest date; and
      * the current actionable-row count.

    Keeping accessions for the cutoff date lets us safely include the cutoff
    date itself (so a second Form 4 filed later the same day is not missed)
    without re-downloading Form 4 XML that is already in the database.
    """
    conn = get_db_connection_dict()

    try:
        cur = conn.cursor()
        cur.execute(
            """
            select
                upper(ticker) as ticker,
                max(filing_date) as latest_filing_date,
                count(*) as row_count
            from insider_transactions
            where transaction_code in ('P', 'S')
            group by upper(ticker)
            """
        )

        state = {}
        for row in cur.fetchall():
            ticker = str(row.get("ticker") or "").strip().upper()
            if not ticker:
                continue
            state[ticker] = {
                "latest_filing_date": _date_text(row.get("latest_filing_date")),
                "latest_accessions": set(),
                "row_count": int(row.get("row_count") or 0),
            }

        cur.execute(
            """
            with latest as (
                select
                    upper(ticker) as ticker,
                    max(filing_date) as latest_filing_date
                from insider_transactions
                where transaction_code in ('P', 'S')
                  and filing_date is not null
                group by upper(ticker)
            )
            select distinct
                upper(it.ticker) as ticker,
                it.accession_number
            from insider_transactions it
            join latest l
              on upper(it.ticker) = l.ticker
             and it.filing_date = l.latest_filing_date
            where it.transaction_code in ('P', 'S')
              and it.accession_number is not null
            """
        )

        for row in cur.fetchall():
            ticker = str(row.get("ticker") or "").strip().upper()
            accession = str(row.get("accession_number") or "").strip()
            if ticker in state and accession:
                state[ticker]["latest_accessions"].add(accession)

        return state

    finally:
        conn.close()


def process_single_ticker(
    ticker,
    cik,
    existing_state=None,
    max_filings_per_ticker=300,
    min_actionable_rows=20,
):
    if not cik:
        return {
            "ticker": ticker,
            "status": "skipped",
            "mode": "n/a",
            "cutoff": None,
            "found": 0,
            "saved": 0,
            "filings_checked": 0,
            "filings_skipped_existing": 0,
            "message": "No SEC CIK found.",
        }

    state = existing_state or {}
    latest_filing_date = _date_text(state.get("latest_filing_date"))
    latest_accessions = set(state.get("latest_accessions") or set())
    incremental_mode = bool(latest_filing_date)

    filings = get_recent_form4_filings_for_ticker(
        ticker=ticker,
        cik=cik,
        limit=max_filings_per_ticker,
    )

    ticker_rows = []
    filings_checked = 0
    filings_skipped_existing = 0

    for filing in filings:
        filing_date = _date_text(filing.get("filing_date"))
        accession = str(filing.get("accession_number") or "").strip()

        if incremental_mode:
            # SEC recent filings are newest-first. Once we cross below the
            # high-water date there is nothing older that needs to be fetched.
            if filing_date and filing_date < latest_filing_date:
                break

            # Same-day overlap is intentional so a later Form 4 filed on the
            # cutoff date is not missed. Known accessions require no XML fetch.
            if (
                filing_date == latest_filing_date
                and accession
                and accession in latest_accessions
            ):
                filings_skipped_existing += 1
                continue

            # In incremental mode, an undated SEC filing cannot safely be
            # classified as newer than the stored high-water mark.
            if not filing_date:
                continue

        filings_checked += 1
        rows = parse_actionable_form4_transactions(ticker, cik, filing)

        if rows:
            ticker_rows.extend(rows)

        # Preserve the original limited backfill behavior only for a ticker
        # that has never been populated before. Existing tickers never stop at
        # 20 rows; every NEW filing since the cutoff is processed.
        if not incremental_mode and len(ticker_rows) >= min_actionable_rows:
            break

    saved = save_transactions(ticker_rows) if ticker_rows else 0

    return {
        "ticker": ticker,
        "status": "done",
        "mode": "incremental" if incremental_mode else "initial_backfill",
        "cutoff": latest_filing_date,
        "found": len(ticker_rows),
        "saved": saved,
        "filings_checked": filings_checked,
        "filings_skipped_existing": filings_skipped_existing,
    }


def format_runtime(seconds):
    seconds = int(seconds)

    hours = seconds // 3600
    minutes = (seconds % 3600) // 60
    secs = seconds % 60

    if hours:
        return f"{hours}h {minutes}m {secs}s"

    if minutes:
        return f"{minutes}m {secs}s"

    return f"{secs}s"

def main(
    limit_tickers=None,
    max_filings_per_ticker=300,
    min_actionable_rows=20,
    max_workers=5,
):
    script_started_at = time.time()
    start_time_label = time.strftime("%Y-%m-%d %I:%M:%S %p")

    print(f"Started incremental insider transaction update at {start_time_label}", flush=True)

    ticker_to_cik = get_cik_for_ticker_map()

    if not ticker_to_cik:
        print("Could not load SEC ticker CIK map.", flush=True)
        return

    TEST_TICKERS = []

    if TEST_TICKERS:
        tickers = [ticker.strip().upper() for ticker in TEST_TICKERS]
    else:
        tickers = load_ticker_universe(limit=limit_tickers)

    existing_state = load_existing_incremental_state()
    incremental_tickers = sum(
        1
        for ticker in tickers
        if (existing_state.get(ticker.strip().upper()) or {}).get("latest_filing_date")
    )
    new_tickers = len(tickers) - incremental_tickers

    print(
        f"Loaded {len(tickers)} common-stock tickers with {max_workers} workers. "
        f"Incremental: {incremental_tickers}; initial backfill: {new_tickers}.",
        flush=True,
    )
    print(
        "Existing insider_transactions rows are append-only: duplicates use DO NOTHING; "
        "no existing rows will be updated.",
        flush=True,
    )

    total_saved = 0
    total_found = 0
    completed = 0

    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = {}

        for ticker in tickers:
            clean_ticker = ticker.strip().upper()
            cik = ticker_to_cik.get(clean_ticker)

            future = executor.submit(
                process_single_ticker,
                clean_ticker,
                cik,
                existing_state.get(clean_ticker),
                max_filings_per_ticker,
                min_actionable_rows,
            )

            futures[future] = clean_ticker

        for future in as_completed(futures):
            completed += 1
            elapsed_seconds = time.time() - script_started_at
            avg_seconds_per_ticker = elapsed_seconds / completed
            remaining_tickers = len(tickers) - completed
            eta_seconds = avg_seconds_per_ticker * remaining_tickers
            ticker = futures[future]

            try:
                result = future.result()

                total_found += result.get("found", 0)
                total_saved += result.get("saved", 0)

                cutoff_text = result.get("cutoff") or "none"

                print(
                    f"[{completed}/{len(tickers)}] {ticker}: "
                    f"mode={result.get('mode')}, cutoff={cutoff_text}, "
                    f"checked {result.get('filings_checked', 0)} new/unseen filings, "
                    f"skipped {result.get('filings_skipped_existing', 0)} already-known cutoff-date filings, "
                    f"found {result.get('found', 0)}, "
                    f"inserted {result.get('saved', 0)}. "
                    f"Avg: {avg_seconds_per_ticker:.1f}s/ticker. "
                    f"ETA: {format_runtime(eta_seconds)}.",
                    flush=True,
                )

            except Exception as e:
                print(
                    f"[{completed}/{len(tickers)}] {ticker}: ERROR "
                    f"{type(e).__name__}: {e}",
                    flush=True,
                )

    finished_at = time.time()
    finish_time_label = time.strftime("%Y-%m-%d %I:%M:%S %p")
    runtime_seconds = finished_at - script_started_at

    print(
        f"Done. Found {total_found} actionable rows in new/unseen filings. "
        f"Inserted {total_saved} new rows. Existing rows were left unchanged.",
        flush=True,
    )

    print(
        f"Finished at {finish_time_label}. Total runtime: {format_runtime(runtime_seconds)}.",
        flush=True,
    )


if __name__ == "__main__":
    main(
        limit_tickers=None,
        max_filings_per_ticker=300,
        min_actionable_rows=20,
        max_workers=5,
    )