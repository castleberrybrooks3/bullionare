from fastapi import FastAPI, Query, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from db import get_db_connection_dict
import os
import math
import json
import copy
import re
from typing import Optional, List
from pydantic import BaseModel
import requests
from datetime import datetime, timedelta
from concurrent.futures import ThreadPoolExecutor, as_completed
import time
import threading
from collections import defaultdict, deque
import xml.etree.ElementTree as ET
from backend_board_leadership_routes import router as board_leadership_router
from prediction_markets_routes import (
    prediction_market_lifespan,
    router as prediction_markets_router,
)

app = FastAPI(lifespan=prediction_market_lifespan)

app.include_router(board_leadership_router)
app.include_router(prediction_markets_router)

DEFAULT_CORS_ORIGINS = {
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://bullionaireiq.com",
    "https://www.bullionaireiq.com",
}

extra_cors_origins = {
    value.strip().rstrip("/")
    for value in os.getenv("CORS_ALLOWED_ORIGINS", "").split(",")
    if value.strip()
}
origins = sorted(DEFAULT_CORS_ORIGINS | extra_cors_origins)

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
# Compress large HTTP fallback payloads. WebSocket frames are unaffected.
app.add_middleware(GZipMiddleware, minimum_size=1024)

POLYGON_API_KEY = os.getenv("POLYGON_API_KEY", "").strip()
POLYGON_BASE_URL = "https://api.polygon.io"
polygon_session = requests.Session()

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

SEC_CACHE = {}
SEC_CACHE_TTL_SECONDS = 60 * 60 * 24
SEC_CACHE_MAX_ENTRIES = max(
    16, int(os.getenv("SEC_CACHE_MAX_ENTRIES", "64"))
)
# Companyfacts / fresh merged facts / submissions / filing-XBRL payloads can each
# be large Python object graphs. Keep the heavy subset much tighter than the
# overall metadata cache so a broad stock scan cannot crowd out the 2 GB process.
SEC_CACHE_HEAVY_MAX_ENTRIES = max(
    4, int(os.getenv("SEC_CACHE_HEAVY_MAX_ENTRIES", "12"))
)
SEC_CACHE_LOCK = threading.Lock()

# Financials-only freshness cache. This prevents the two Financials-tab SEC
# endpoints from independently repeating the same cold SEC work for one ticker.
# A short TTL still lets a newly filed 10-Q/10-K become visible quickly.
SEC_FINANCIALS_FRESH_CACHE_TTL_SECONDS = max(
    60, int(os.getenv("SEC_FINANCIALS_FRESH_CACHE_TTL_SECONDS", "600"))
)

# Use a fixed striped-lock pool instead of retaining one Lock forever for every
# CIK ever requested. The same CIK always maps to the same stripe; unrelated CIKs
# can very occasionally share a stripe, which only serializes those requests.
SEC_FINANCIALS_CIK_LOCK_STRIPES = max(
    16, int(os.getenv("SEC_FINANCIALS_CIK_LOCK_STRIPES", "128"))
)
SEC_FINANCIALS_CIK_LOCKS = tuple(
    threading.Lock() for _ in range(SEC_FINANCIALS_CIK_LOCK_STRIPES)
)

# Rare SEC successor-registrant events can move a public ticker to a new CIK
# without carrying the predecessor's historical Companyfacts into that new CIK.
# Keep the mapping narrow and evidence-based. The current XOM parent became the
# successor registrant on 2026-07-01; its predecessor retains the long history.
SEC_FINANCIALS_PREDECESSOR_CIKS = {
    "0002115436": ["0000034088"],  # ExxonMobil Holdings Corp <- Exxon Mobil Corp
}

# Classification fallback is intentionally narrow. Fresh production SEC payloads
# receive SIC metadata from the submissions endpoint (see
# get_fresh_companyfacts_for_cik), which is the primary semantic classifier.
# These overrides exist so already-cached pre-metadata Companyfacts fixtures keep
# producing the same business-model classification during offline regression.
SEC_PROFILE_REIT_TICKER_FALLBACKS = {
    "AMT", "CCI", "EQIX", "ESS", "HST", "INVH", "IRM", "SBAC", "SPG", "UDR", "WY",
}
SEC_PROFILE_INSURANCE_TICKER_FALLBACKS = {"AON", "AJG", "CNC", "MRSH", "WTW"}
SEC_PROFILE_OPERATING_TICKER_FALLBACKS = {
    "BEN", "BLK", "COIN", "CPAY", "FANG", "FCX", "FISV", "GE", "HOOD", "ZBRA",
}

# Newly separated registrants can have current quarterly data but no standalone
# 10-K history in Companyfacts yet. Treat that as limited history, not a broken
# Financials engine.
SEC_NEW_REGISTRANT_TICKER_FALLBACKS = {"HONA"}

SMART_MONEY_CACHE = {}
SMART_MONEY_CACHE_LOCK = threading.Lock()
SMART_MONEY_CACHE_TTL_SECONDS = 60 * 30

RATE_LIMIT_STORAGE = defaultdict(deque)
RATE_LIMIT_LOCK = threading.Lock()
RATE_LIMIT_STORAGE_MAX_KEYS = max(
    1000, int(os.getenv("RATE_LIMIT_STORAGE_MAX_KEYS", "5000"))
)
RATE_LIMIT_STORAGE_STALE_SECONDS = max(
    120, int(os.getenv("RATE_LIMIT_STORAGE_STALE_SECONDS", "300"))
)

SPARKLINES_RATE_LIMIT = (180, 60)   # 180 requests per 60 seconds per IP
CHART_RATE_LIMIT = (240, 60)        # 240 requests per 60 seconds per IP
BACKTEST_RATE_LIMIT = (120, 60)  # 120 backtests per minute per IP

CHART_CACHE = {}
CHART_CACHE_LOCK = threading.Lock()
CHART_CACHE_TTL_SECONDS = 60 * 15
CHART_CACHE_MAX_ENTRIES = max(
    32, int(os.getenv("CHART_CACHE_MAX_ENTRIES", "128"))
)

# Shared stock-data guards. These do not change the response contract; they
# prevent every browser from multiplying paid/upstream market-data calls.
LIVE_MARKET_SNAPSHOT_CACHE = {"time": 0.0, "data": None}
LIVE_MARKET_SNAPSHOT_CACHE_LOCK = threading.Lock()
LIVE_MARKET_SNAPSHOT_REFRESH_LOCK = threading.Lock()
LIVE_MARKET_SNAPSHOT_CACHE_TTL_SECONDS = max(
    5, int(os.getenv("LIVE_MARKET_SNAPSHOT_CACHE_TTL_SECONDS", "10"))
)
LIVE_PRICES_RATE_LIMIT = (
    max(30, int(os.getenv("STOCK_LIVE_PRICES_REQUESTS_PER_MINUTE", "120"))),
    60,
)
SPARKLINE_CACHE = {}
SPARKLINE_CACHE_LOCK = threading.Lock()
SPARKLINE_CACHE_TTL_SECONDS = max(
    15, int(os.getenv("SPARKLINE_CACHE_TTL_SECONDS", "60"))
)
SPARKLINE_CACHE_MAX_ENTRIES = max(
    500, int(os.getenv("SPARKLINE_CACHE_MAX_ENTRIES", "5000"))
)
MAX_BACKTEST_POSITIONS = max(
    1, int(os.getenv("MAX_BACKTEST_POSITIONS", "50"))
)

class StrategyPosition(BaseModel):
    ticker: str
    weight: float


class BacktestRequest(BaseModel):
    benchmark: str = "SPY"
    range: str = "1Y"
    positions: List[StrategyPosition]

def get_client_ip(request):
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()

    if request.client and request.client.host:
        return request.client.host

    return "unknown"


SEC_CACHE_HEAVY_PREFIXES = (
    "companyfacts:",
    "fresh_companyfacts:",
    "sec_submissions:",
    "sec_filing_xbrl:",
)


def _cache_entry_time(entry):
    if not isinstance(entry, dict):
        return 0.0
    try:
        return float(entry.get("time") or 0.0)
    except (TypeError, ValueError):
        return 0.0


def _sec_cache_ttl_for_key(cache_key):
    if str(cache_key).startswith("fresh_companyfacts:"):
        return SEC_FINANCIALS_FRESH_CACHE_TTL_SECONDS
    return SEC_CACHE_TTL_SECONDS


def _prune_sec_cache_locked(now=None):
    """Bound SEC object graphs while preserving the existing response contract."""
    current = time.time() if now is None else float(now)

    expired = [
        key
        for key, value in SEC_CACHE.items()
        if current - _cache_entry_time(value) >= _sec_cache_ttl_for_key(key)
    ]
    for key in expired:
        SEC_CACHE.pop(key, None)

    heavy_keys = [
        key
        for key in SEC_CACHE
        if str(key).startswith(SEC_CACHE_HEAVY_PREFIXES)
    ]
    heavy_overflow = len(heavy_keys) - SEC_CACHE_HEAVY_MAX_ENTRIES
    if heavy_overflow > 0:
        heavy_keys.sort(key=lambda key: _cache_entry_time(SEC_CACHE.get(key)))
        for key in heavy_keys[:heavy_overflow]:
            SEC_CACHE.pop(key, None)

    overflow = len(SEC_CACHE) - SEC_CACHE_MAX_ENTRIES
    if overflow > 0:
        oldest = sorted(
            SEC_CACHE,
            key=lambda key: _cache_entry_time(SEC_CACHE.get(key)),
        )
        for key in oldest[:overflow]:
            SEC_CACHE.pop(key, None)


def _store_sec_cache_locked(cache_key, data, now=None):
    timestamp = time.time() if now is None else float(now)
    SEC_CACHE[cache_key] = {
        "time": timestamp,
        "data": data,
    }
    _prune_sec_cache_locked(timestamp)


def _prune_timed_cache_locked(cache, now, ttl_seconds, max_entries):
    expired = [
        key
        for key, value in cache.items()
        if now - _cache_entry_time(value) >= ttl_seconds
    ]
    for key in expired:
        cache.pop(key, None)

    overflow = len(cache) - max_entries
    if overflow > 0:
        oldest = sorted(
            cache,
            key=lambda key: _cache_entry_time(cache.get(key)),
        )
        for key in oldest[:overflow]:
            cache.pop(key, None)

def get_sec_json(url, headers=None, timeout=20):
    try:
        response = requests.get(url, headers=headers or SEC_HEADERS, timeout=timeout)
        response.raise_for_status()
        return response.json()
    except Exception as e:
        print(f"[SEC ERROR] {url} -> {type(e).__name__}: {e}")
        return None


def get_cik_for_ticker(ticker: str):
    cache_key = "sec_company_tickers"
    now = time.time()

    with SEC_CACHE_LOCK:
        cached = SEC_CACHE.get(cache_key)
        if cached and now - cached.get("time", 0) < SEC_CACHE_TTL_SECONDS:
            company_tickers = cached.get("data")
        else:
            company_tickers = None

    if company_tickers is None:
        url = f"{SEC_WWW_URL}/files/company_tickers.json"
        company_tickers = get_sec_json(url, headers=SEC_WWW_HEADERS)

        if company_tickers:
            with SEC_CACHE_LOCK:
                _store_sec_cache_locked(cache_key, company_tickers, now)

    if not company_tickers:
        return None

    clean_ticker = ticker.strip().upper()

    for _, row in company_tickers.items():
        if str(row.get("ticker", "")).upper() == clean_ticker:
            cik = str(row.get("cik_str", "")).zfill(10)
            return cik

    return None



def get_financials_cik_for_ticker(ticker: str):
    clean = str(ticker or "").strip().upper()
    candidates = [clean]
    if "." in clean:
        candidates.append(clean.replace(".", "-"))
    if "-" in clean:
        candidates.append(clean.replace("-", "."))

    seen = set()
    for candidate in candidates:
        if not candidate or candidate in seen:
            continue
        seen.add(candidate)
        cik = get_cik_for_ticker(candidate)
        if cik:
            return cik
    return None


def get_companyfacts_for_cik(cik: str):
    cache_key = f"companyfacts:{cik}"
    now = time.time()

    with SEC_CACHE_LOCK:
        cached = SEC_CACHE.get(cache_key)
        if cached and now - cached.get("time", 0) < SEC_CACHE_TTL_SECONDS:
            return cached.get("data")

    url = f"{SEC_BASE_URL}/api/xbrl/companyfacts/CIK{cik}.json"
    data = get_sec_json(url, headers=SEC_HEADERS)

    if data:
        with SEC_CACHE_LOCK:
            _store_sec_cache_locked(cache_key, data, now)

    return data


def _latest_companyfacts_period_for_forms(companyfacts, allowed_forms):
    allowed = {str(form).upper() for form in allowed_forms}
    latest = None

    for namespace_data in (companyfacts.get("facts", {}) or {}).values():
        for concept_data in (namespace_data or {}).values():
            for rows in ((concept_data or {}).get("units", {}) or {}).values():
                for row in rows or []:
                    form = str(row.get("form") or "").upper()
                    end = row.get("end")
                    if form not in allowed or not end:
                        continue
                    if latest is None or str(end) > str(latest):
                        latest = str(end)

    return latest



def _get_sec_financials_cik_lock(cik):
    clean_cik = str(cik)
    stripe = hash(clean_cik) % len(SEC_FINANCIALS_CIK_LOCKS)
    return SEC_FINANCIALS_CIK_LOCKS[stripe]


def _get_sec_submissions_for_cik(cik):
    """
    SEC submissions are the same file whether we are looking for a 10-K or 10-Q.
    Cache it once per CIK instead of downloading the identical JSON twice.
    """
    cache_key = f"sec_submissions:{cik}"
    now = time.time()

    with SEC_CACHE_LOCK:
        cached = SEC_CACHE.get(cache_key)
        if cached and now - cached.get("time", 0) < SEC_CACHE_TTL_SECONDS:
            return cached.get("data")

    submissions = get_sec_json(
        f"{SEC_BASE_URL}/submissions/CIK{cik}.json",
        headers=SEC_HEADERS,
    )

    if submissions:
        with SEC_CACHE_LOCK:
            _store_sec_cache_locked(cache_key, submissions, now)

    return submissions


def _attach_sec_submission_metadata(companyfacts, submissions, cik=None):
    """Attach non-financial SEC filer metadata used only for semantic profiling."""
    if not companyfacts or not submissions:
        return companyfacts

    merged = copy.deepcopy(companyfacts)
    metadata = dict(merged.get("_bullionaire_sec_metadata") or {})
    metadata.update({
        "cik": str(cik or submissions.get("cik") or "").zfill(10) if (cik or submissions.get("cik")) else None,
        "sic": str(submissions.get("sic") or "").strip() or None,
        "sic_description": submissions.get("sicDescription"),
        "fiscal_year_end": submissions.get("fiscalYearEnd"),
        "entity_type": submissions.get("entityType"),
        "former_names": submissions.get("formerNames") or [],
    })
    merged["_bullionaire_sec_metadata"] = metadata
    return merged



def ensure_financials_sec_metadata(companyfacts, cik):
    """
    Enrich an existing cached Companyfacts payload with the small SEC submissions
    metadata used for business-model classification. This does not redownload the
    large Companyfacts JSON, so old regression fixtures can be upgraded cheaply.
    """
    if not companyfacts:
        return companyfacts

    if companyfacts.get("_bullionaire_sec_metadata"):
        return companyfacts

    submissions = _get_sec_submissions_for_cik(cik)
    if not submissions:
        return companyfacts

    return _attach_sec_submission_metadata(companyfacts, submissions, cik=cik)


def _get_latest_sec_filing_metadata(cik, allowed_forms, submissions=None):
    cache_key = f"sec_latest_filing:{cik}:{','.join(sorted(allowed_forms))}"
    now = time.time()

    with SEC_CACHE_LOCK:
        cached = SEC_CACHE.get(cache_key)
        if cached and now - cached.get("time", 0) < SEC_CACHE_TTL_SECONDS:
            return cached.get("data")

    if submissions is None:
        submissions = _get_sec_submissions_for_cik(cik)

    if not submissions:
        return None

    recent = submissions.get("filings", {}).get("recent", {}) or {}
    forms = recent.get("form", []) or []
    filing_dates = recent.get("filingDate", []) or []
    report_dates = recent.get("reportDate", []) or []
    accessions = recent.get("accessionNumber", []) or []
    primary_documents = recent.get("primaryDocument", []) or []

    allowed = {str(form).upper() for form in allowed_forms}
    candidates = []

    for index, form in enumerate(forms):
        clean_form = str(form or "").upper()
        if clean_form not in allowed:
            continue

        accession = accessions[index] if index < len(accessions) else None
        primary_document = (
            primary_documents[index]
            if index < len(primary_documents)
            else None
        )
        filing_date = (
            filing_dates[index]
            if index < len(filing_dates)
            else None
        )
        report_date = (
            report_dates[index]
            if index < len(report_dates)
            else None
        )

        if not accession:
            continue

        candidates.append({
            "form": clean_form,
            "filing_date": filing_date,
            "report_date": report_date,
            "accession": accession,
            "accession_clean": clean_sec_accession(accession),
            "primary_document": primary_document,
        })

    if not candidates:
        return None

    candidates.sort(
        key=lambda row: (
            str(row.get("report_date") or ""),
            str(row.get("filing_date") or ""),
        ),
        reverse=True,
    )
    latest = candidates[0]

    with SEC_CACHE_LOCK:
        _store_sec_cache_locked(cache_key, latest, now)

    return latest


def _sec_filing_instance_filename(cik, filing):
    accession_clean = filing.get("accession_clean")
    if not accession_clean:
        return None

    cik_path = str(int(cik))
    cache_key = f"sec_filing_instance_name:{cik}:{accession_clean}"
    now = time.time()

    with SEC_CACHE_LOCK:
        cached = SEC_CACHE.get(cache_key)
        if cached and now - cached.get("time", 0) < SEC_CACHE_TTL_SECONDS:
            return cached.get("data")

    index_url = (
        f"{SEC_WWW_URL}/Archives/edgar/data/"
        f"{cik_path}/{accession_clean}/index.json"
    )
    index_json = get_sec_json(index_url, headers=SEC_WWW_HEADERS)

    filename = None

    if index_json:
        items = (
            index_json.get("directory", {}).get("item", [])
            or []
        )

        for item in items:
            name = str(item.get("name") or "")
            if name.lower().endswith("_htm.xml"):
                filename = name
                break

    # SEC extracted-instance filenames conventionally mirror the primary
    # document, e.g. ko-20260703.htm -> ko-20260703_htm.xml.
    if not filename:
        primary = str(filing.get("primary_document") or "").strip()
        if primary.lower().endswith(".htm"):
            filename = primary[:-4] + "_htm.xml"
        elif primary.lower().endswith(".html"):
            filename = primary[:-5] + "_htm.xml"

    with SEC_CACHE_LOCK:
        _store_sec_cache_locked(cache_key, filename, now)

    return filename


def _local_xml_name(tag):
    text = str(tag or "")
    if "}" in text:
        return text.rsplit("}", 1)[-1]
    return text.split(":")[-1]


def _xml_namespace_uri(tag):
    text = str(tag or "")
    if text.startswith("{") and "}" in text:
        return text[1:].split("}", 1)[0]
    return ""


def _companyfacts_namespace_from_uri(uri):
    low = str(uri or "").lower()
    if "us-gaap" in low:
        return "us-gaap"
    if "ifrs" in low:
        return "ifrs-full"
    if "xbrl.sec.gov/dei" in low or "/dei/" in low:
        return "dei"
    return None


def _parse_sec_instance_numeric_value(value_text):
    raw = str(value_text or "").strip().replace(",", "")
    if not raw:
        return None

    # Extracted XBRL instance documents store normalized numeric values.
    if not re.fullmatch(r"[+-]?(?:\d+(?:\.\d*)?|\.\d+)", raw):
        return None

    try:
        if "." not in raw:
            return int(raw)
        value = float(raw)
        if value.is_integer():
            return int(value)
        return value
    except Exception:
        return None


def _load_latest_filing_xbrl_rows(cik, filing):
    accession_clean = filing.get("accession_clean")
    if not accession_clean:
        return None

    instance_name = _sec_filing_instance_filename(cik, filing)
    if not instance_name:
        return None

    cache_key = f"sec_filing_xbrl:{cik}:{accession_clean}:{instance_name}"
    now = time.time()

    with SEC_CACHE_LOCK:
        cached = SEC_CACHE.get(cache_key)
        if cached and now - cached.get("time", 0) < SEC_CACHE_TTL_SECONDS:
            return cached.get("data")

    cik_path = str(int(cik))
    url = (
        f"{SEC_WWW_URL}/Archives/edgar/data/"
        f"{cik_path}/{accession_clean}/{instance_name}"
    )

    try:
        response = requests.get(
            url,
            headers=SEC_WWW_HEADERS,
            timeout=30,
        )
        response.raise_for_status()
        root = ET.fromstring(response.content)
    except Exception as exc:
        print(
            f"[SEC XBRL FALLBACK ERROR] {url} -> "
            f"{type(exc).__name__}: {exc}",
            flush=True,
        )
        return None

    contexts = {}

    for node in root.iter():
        if _local_xml_name(node.tag).lower() != "context":
            continue

        context_id = node.attrib.get("id")
        if not context_id:
            continue

        # Companyfacts is concept-level/consolidated. Do not inject
        # segment-dimensional facts into those same concept series.
        dimensional = any(
            _local_xml_name(child.tag).lower()
            in {"segment", "scenario", "explicitmember", "typedmember"}
            for child in node.iter()
            if child is not node
        )

        start = None
        end = None
        instant = None

        for child in node.iter():
            name = _local_xml_name(child.tag).lower()
            value = (child.text or "").strip()

            if name == "startdate":
                start = value
            elif name == "enddate":
                end = value
            elif name == "instant":
                instant = value

        contexts[context_id] = {
            "start": start,
            "end": end or instant,
            "instant": instant,
            "dimensional": dimensional,
        }

    units = {}

    for node in root.iter():
        if _local_xml_name(node.tag).lower() != "unit":
            continue

        unit_id = node.attrib.get("id")
        if not unit_id:
            continue

        measures = [
            (child.text or "").strip()
            for child in node.iter()
            if _local_xml_name(child.tag).lower() == "measure"
            and (child.text or "").strip()
        ]

        if len(measures) != 1:
            continue

        measure = measures[0]
        local_measure = measure.split(":")[-1]

        if local_measure.upper() == "USD":
            units[unit_id] = "USD"
        elif local_measure.lower() == "shares":
            units[unit_id] = "shares"
        elif local_measure.lower() == "pure":
            units[unit_id] = "pure"
        else:
            # Preserve other ISO currencies for future foreign-filer support.
            units[unit_id] = local_measure.upper()

    facts = {}
    report_year = None

    try:
        if filing.get("report_date"):
            report_year = int(str(filing["report_date"])[:4])
    except Exception:
        report_year = None

    for node in root.iter():
        context_ref = (
            node.attrib.get("contextRef")
            or node.attrib.get("contextref")
        )
        if not context_ref:
            continue

        context = contexts.get(context_ref)
        if not context or context.get("dimensional"):
            continue

        namespace = _companyfacts_namespace_from_uri(
            _xml_namespace_uri(node.tag)
        )
        if not namespace:
            continue

        concept = _local_xml_name(node.tag)
        unit_ref = (
            node.attrib.get("unitRef")
            or node.attrib.get("unitref")
        )
        unit = units.get(unit_ref)
        if not unit:
            continue

        nil_value = False
        for attr_name, attr_value in node.attrib.items():
            if _local_xml_name(attr_name).lower() == "nil":
                if str(attr_value).lower() in {"true", "1"}:
                    nil_value = True
                    break

        if nil_value:
            continue

        value = _parse_sec_instance_numeric_value(
            "".join(node.itertext())
        )
        if value is None:
            continue

        end = context.get("end")
        if not end:
            continue

        row = {
            "val": value,
            "end": end,
            "form": filing.get("form"),
            "filed": filing.get("filing_date"),
            "accn": filing.get("accession"),
            "fy": report_year,
            "fp": None,
            "frame": None,
        }

        if context.get("start"):
            row["start"] = context.get("start")

        concept_data = facts.setdefault(namespace, {}).setdefault(
            concept,
            {"units": {}},
        )
        concept_data["units"].setdefault(unit, []).append(row)

    parsed = {
        "facts": facts,
        "filing": filing,
        "instance_url": url,
    }

    with SEC_CACHE_LOCK:
        _store_sec_cache_locked(cache_key, parsed, now)

    return parsed


def _merge_filing_xbrl_into_companyfacts(companyfacts, parsed):
    if not parsed or not parsed.get("facts"):
        return companyfacts

    merged = copy.deepcopy(companyfacts)
    merged_facts = merged.setdefault("facts", {})

    for namespace, concepts in parsed["facts"].items():
        namespace_target = merged_facts.setdefault(namespace, {})

        for concept, concept_data in concepts.items():
            concept_target = namespace_target.setdefault(
                concept,
                {
                    "label": concept,
                    "description": concept,
                    "units": {},
                },
            )
            unit_target = concept_target.setdefault("units", {})

            for unit, rows in (concept_data.get("units", {}) or {}).items():
                existing_rows = unit_target.setdefault(unit, [])

                existing_keys = {
                    (
                        row.get("accn"),
                        row.get("start"),
                        row.get("end"),
                        row.get("val"),
                    )
                    for row in existing_rows
                }

                for row in rows:
                    key = (
                        row.get("accn"),
                        row.get("start"),
                        row.get("end"),
                        row.get("val"),
                    )
                    if key not in existing_keys:
                        existing_rows.append(row)
                        existing_keys.add(key)

    freshness = merged.setdefault("_bullionaire_sec_freshness", [])
    freshness.append({
        "mode": "direct_filing_xbrl_fallback",
        "form": parsed.get("filing", {}).get("form"),
        "report_date": parsed.get("filing", {}).get("report_date"),
        "filing_date": parsed.get("filing", {}).get("filing_date"),
        "accession": parsed.get("filing", {}).get("accession"),
        "instance_url": parsed.get("instance_url"),
    })

    return merged


def _merge_companyfacts_history(primary, historical, history_cik=None):
    """Merge predecessor Companyfacts history without overwriting current facts."""
    if not primary:
        return historical
    if not historical:
        return primary

    merged = copy.deepcopy(primary)
    merged_facts = merged.setdefault("facts", {})

    for namespace, concepts in (historical.get("facts", {}) or {}).items():
        namespace_target = merged_facts.setdefault(namespace, {})

        for concept, concept_data in (concepts or {}).items():
            concept_target = namespace_target.setdefault(
                concept,
                {
                    "label": concept_data.get("label") or concept,
                    "description": concept_data.get("description") or concept,
                    "units": {},
                },
            )
            unit_target = concept_target.setdefault("units", {})

            for unit, rows in ((concept_data or {}).get("units", {}) or {}).items():
                existing_rows = unit_target.setdefault(unit, [])
                existing_keys = {
                    (
                        row.get("accn"), row.get("start"), row.get("end"),
                        row.get("val"), row.get("form"), row.get("filed"),
                    )
                    for row in existing_rows
                }

                for row in rows or []:
                    key = (
                        row.get("accn"), row.get("start"), row.get("end"),
                        row.get("val"), row.get("form"), row.get("filed"),
                    )
                    if key not in existing_keys:
                        existing_rows.append(row)
                        existing_keys.add(key)

    if history_cik:
        merged.setdefault("_bullionaire_sec_history", []).append({
            "mode": "predecessor_companyfacts_history",
            "predecessor_cik": history_cik,
        })

    return merged


def get_fresh_companyfacts_for_cik(cik: str):
    """
    Financials-only SEC loader.

    Performance rules:
    1) Annual + deep-dive requests for the same ticker share one short-lived
       fully-merged result.
    2) Concurrent requests for the same CIK collapse behind one per-CIK lock.
    3) On a cold ticker, Companyfacts and SEC submissions download in parallel.
    4) The SEC submissions JSON is downloaded only once, then reused to inspect
       both 10-K and 10-Q freshness.
    5) Direct filing XBRL is still used only when Companyfacts is actually stale.
    """
    cache_key = f"fresh_companyfacts:{cik}"
    now = time.time()

    with SEC_CACHE_LOCK:
        cached = SEC_CACHE.get(cache_key)
        if (
            cached
            and now - cached.get("time", 0)
            < SEC_FINANCIALS_FRESH_CACHE_TTL_SECONDS
        ):
            return cached.get("data")

    cik_lock = _get_sec_financials_cik_lock(cik)

    with cik_lock:
        # Another request may have populated the cache while we were waiting.
        now = time.time()
        with SEC_CACHE_LOCK:
            cached = SEC_CACHE.get(cache_key)
            if (
                cached
                and now - cached.get("time", 0)
                < SEC_FINANCIALS_FRESH_CACHE_TTL_SECONDS
            ):
                return cached.get("data")

        # These are independent SEC resources, so fetch them together on the
        # first request for a ticker instead of serially.
        with ThreadPoolExecutor(max_workers=2) as executor:
            companyfacts_future = executor.submit(
                get_companyfacts_for_cik,
                cik,
            )
            submissions_future = executor.submit(
                _get_sec_submissions_for_cik,
                cik,
            )

            companyfacts = companyfacts_future.result()
            submissions = submissions_future.result()

        if not companyfacts:
            return None

        merged = _attach_sec_submission_metadata(companyfacts, submissions, cik=cik)

        # Preserve historical statements across successor-registrant CIK changes.
        # This is intentionally done before freshness overlays so the current CIK
        # remains authoritative for new filings while the predecessor supplies
        # only the missing historical periods.
        for predecessor_cik in SEC_FINANCIALS_PREDECESSOR_CIKS.get(str(cik), []):
            predecessor_facts = get_companyfacts_for_cik(predecessor_cik)
            if predecessor_facts:
                merged = _merge_companyfacts_history(
                    merged,
                    predecessor_facts,
                    history_cik=predecessor_cik,
                )

        filing_groups = [
            {"10-K", "10-K/A"},
            {"10-Q", "10-Q/A"},
        ]

        for allowed_forms in filing_groups:
            filing = _get_latest_sec_filing_metadata(
                cik,
                allowed_forms,
                submissions=submissions,
            )
            if not filing or not filing.get("report_date"):
                continue

            latest_companyfacts_period = _latest_companyfacts_period_for_forms(
                merged,
                allowed_forms,
            )

            if (
                latest_companyfacts_period
                and str(filing["report_date"])
                <= str(latest_companyfacts_period)
            ):
                continue

            parsed = _load_latest_filing_xbrl_rows(cik, filing)
            if not parsed:
                continue

            merged = _merge_filing_xbrl_into_companyfacts(
                merged,
                parsed,
            )

            print(
                "[SEC XBRL FALLBACK] "
                f"CIK {cik}: overlaid {filing.get('form')} "
                f"period {filing.get('report_date')} because Companyfacts "
                f"only reached {latest_companyfacts_period}.",
                flush=True,
            )

        with SEC_CACHE_LOCK:
            _store_sec_cache_locked(cache_key, merged, time.time())

        return merged


def clean_sec_accession(accession_number: str):
    return str(accession_number or "").replace("-", "")


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


def classify_form4_transaction(transaction_code, acquired_disposed_code):
    code = str(transaction_code or "").upper()
    acquired_disposed = str(acquired_disposed_code or "").upper()

    if code == "P":
        return "Buy", "Bullish"

    if code == "S":
        return "Sell", "Bearish"

    if code == "A":
        return "Grant / Award", "Neutral"

    if code == "M":
        return "Option Exercise", "Neutral"

    if code == "F":
        return "Tax Withholding", "Neutral"

    if acquired_disposed == "A":
        return "Acquired", "Neutral"

    if acquired_disposed == "D":
        return "Disposed", "Neutral"

    return code or "Other", "Neutral"

def parse_ownership_transaction_node(tx, ticker, issuer_name, reporting_owner_name, title, filing, url, is_derivative=False):
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

    transaction_code = safe_xml_text(
        tx,
        "./transactionCoding/transactionCode",
        "",
    )

    shares = safe_float(
        safe_xml_text(tx, "./transactionAmounts/transactionShares/value")
    )

    price = safe_float(
        safe_xml_text(tx, "./transactionAmounts/transactionPricePerShare/value")
    )

    acquired_disposed_code = safe_xml_text(
        tx,
        "./transactionAmounts/transactionAcquiredDisposedCode/value",
        "",
    )

    shares_owned_following = safe_float(
        safe_xml_text(tx, "./postTransactionAmounts/sharesOwnedFollowingTransaction/value")
    )

    transaction_type, signal = classify_form4_transaction(
        transaction_code,
        acquired_disposed_code,
    )

    if is_derivative and transaction_type == "Other":
        transaction_type = "Derivative Transaction"

    value = None

    if shares is not None and price is not None:
        value = shares * price

    return {
        "ticker": ticker.upper(),
        "company": issuer_name,
        "insider": reporting_owner_name,
        "title": title,
        "transactionType": transaction_type,
        "transactionCode": transaction_code,
        "securityTitle": security_title,
        "shares": shares,
        "price": price,
        "value": value,
        "date": transaction_date,
        "filingDate": filing.get("filing_date"),
        "reportDate": filing.get("report_date"),
        "sharesOwnedFollowing": shares_owned_following,
        "signal": signal,
        "source": "SEC Form 4",
        "accessionNumber": filing.get("accession_number"),
        "filingUrl": url,
        "isDerivative": is_derivative,
    }


def get_recent_form4_filings_for_ticker(ticker: str, limit: int = 12):
    cik = get_cik_for_ticker(ticker)

    if not cik:
        return None, []

    url = f"{SEC_BASE_URL}/submissions/CIK{cik}.json"
    submissions = get_sec_json(url, headers=SEC_HEADERS)

    if not submissions:
        return cik, []

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

        filer_cik = str(accession).split("-")[0].lstrip("0") or str(int(cik))

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

    return cik, filings


def parse_form4_xml_for_transactions(ticker: str, cik: str, filing: dict):
    accession_clean = filing["accession_clean"]
    filer_cik = filing.get("filer_cik") or str(int(cik))
    primary_document = clean_primary_document_name(filing.get("primary_document"))

    url = (
        f"{SEC_WWW_URL}/Archives/edgar/data/"
        f"{filer_cik}/{accession_clean}/{primary_document}"
    )

    try:
        response = requests.get(url, headers=SEC_WWW_HEADERS, timeout=20)
        response.raise_for_status()
    except Exception as e:
        print(
            f"[FORM 4 FETCH ERROR] {ticker} "
            f"issuer_cik={cik} filer_cik={filing.get('filer_cik')} "
            f"accession={filing.get('accession_number')} "
            f"url={url} -> {type(e).__name__}: {e}"
        )
        return []

    try:
        root = ET.fromstring(response.content)
        root = strip_xml_namespaces(root)
    except Exception as e:
        print(f"[FORM 4 XML ERROR] {ticker} {url} -> {type(e).__name__}: {e}")
        return []

    issuer_name = safe_xml_text(root, "./issuer/issuerName", ticker.upper())
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

    transactions = []

    for tx in root.findall(".//nonDerivativeTransaction"):
        transactions.append(
            parse_ownership_transaction_node(
                tx=tx,
                ticker=ticker,
                issuer_name=issuer_name,
                reporting_owner_name=reporting_owner_name,
                title=title,
                filing=filing,
                url=url,
                is_derivative=False,
            )
        )

    for tx in root.findall(".//derivativeTransaction"):
        transactions.append(
            parse_ownership_transaction_node(
                tx=tx,
                ticker=ticker,
                issuer_name=issuer_name,
                reporting_owner_name=reporting_owner_name,
                title=title,
                filing=filing,
                url=url,
                is_derivative=True,
            )
        )

    if not transactions:
        child_tags = [child.tag for child in list(root)[:12]]

        print(
            f"[FORM 4 DEBUG] No transactions parsed for {ticker} "
            f"accession={filing.get('accession_number')} "
            f"document={primary_document} "
            f"root={root.tag} "
            f"children={child_tags}"
        )

    return transactions

def clean_primary_document_name(primary_document: str):
    if not primary_document:
        return ""

    # SEC sometimes returns viewer paths like:
    # xslF345X06/wk-form4_1774386816.xml
    # The actual archive file is usually just the filename.
    return str(primary_document).split("/")[-1]

def strip_xml_namespaces(root):
    for elem in root.iter():
        if "}" in elem.tag:
            elem.tag = elem.tag.split("}", 1)[1]
    return root

def build_smart_money_summary(transactions):
    bullish_count = sum(1 for row in transactions if row.get("signal") == "Bullish")
    bearish_count = sum(1 for row in transactions if row.get("signal") == "Bearish")

    buy_value = sum(
        float(row.get("value") or 0)
        for row in transactions
        if row.get("signal") == "Bullish"
    )

    sell_value = sum(
        float(row.get("value") or 0)
        for row in transactions
        if row.get("signal") == "Bearish"
    )

    if bullish_count > bearish_count and buy_value >= sell_value:
        signal = "Bullish"
    elif bearish_count > bullish_count and sell_value > buy_value:
        signal = "Bearish"
    else:
        signal = "Neutral"

    return {
        "signal": signal,
        "bullish_count": bullish_count,
        "bearish_count": bearish_count,
        "buy_value": buy_value,
        "sell_value": sell_value,
        "transaction_count": len(transactions),
    }


SEC_ANNUAL_FORMS = {"10-K", "10-K/A", "20-F", "20-F/A", "40-F", "40-F/A"}
# Registration statements for newly public spin-offs/IPO issuers often contain
# audited annual and interim XBRL before the issuer has filed its first 10-K or
# 10-Q. Treat those *statement facts* as historical financial periods; this does
# not make the registration filing itself an annual/quarterly report.
SEC_REGISTRATION_FINANCIAL_FORMS = {
    "10-12B", "10-12B/A", "10-12G", "10-12G/A", "S-1", "S-1/A", "F-1", "F-1/A",
}
SEC_ANNUAL_HISTORY_FORMS = SEC_ANNUAL_FORMS | SEC_REGISTRATION_FINANCIAL_FORMS
SEC_QUARTERLY_FORMS = {
    "10-Q", "10-Q/A", "10-K", "10-K/A", "20-F", "20-F/A", "6-K", "6-K/A",
} | SEC_REGISTRATION_FINANCIAL_FORMS
SEC_PRIMARY_NAMESPACES = ("us-gaap", "ifrs-full")


def get_companyfacts_namespaces(companyfacts):
    facts = companyfacts.get("facts", {}) or {}
    ordered = []
    for namespace in SEC_PRIMARY_NAMESPACES:
        if facts.get(namespace):
            ordered.append(namespace)
    for namespace in facts:
        if namespace not in ordered and facts.get(namespace):
            ordered.append(namespace)
    return ordered


def get_reporting_taxonomy(companyfacts):
    namespaces = get_companyfacts_namespaces(companyfacts)
    if "us-gaap" in namespaces:
        return "us-gaap"
    if "ifrs-full" in namespaces:
        return "ifrs-full"
    return namespaces[0] if namespaces else None


def _currency_unit_candidates(units):
    if not units:
        return []
    preferred = ["USD", "usd"]
    output = []
    for unit in preferred:
        if unit in units and unit not in output:
            output.append(unit)
    for unit in units:
        upper = str(unit).upper()
        if len(upper) == 3 and upper.isalpha() and unit not in output:
            output.append(unit)
    return output


def _find_concept_data(companyfacts, concept, namespaces=None):
    facts = companyfacts.get("facts", {}) or {}
    namespaces = namespaces or get_companyfacts_namespaces(companyfacts)
    for namespace in namespaces:
        concept_data = (facts.get(namespace) or {}).get(concept)
        if concept_data:
            return namespace, concept_data
    return None, None


def pick_monetary_fact(companyfacts, concept_names):
    for concept in concept_names:
        namespace, concept_data = _find_concept_data(companyfacts, concept)
        if not concept_data:
            continue
        units = concept_data.get("units", {}) or {}
        for currency in _currency_unit_candidates(units):
            rows = units.get(currency) or []
            if rows:
                return concept, rows, str(currency).upper(), namespace
    return None, [], None, None


def pick_usd_fact(companyfacts, concept_names):
    concept, rows, _, _ = pick_monetary_fact(companyfacts, concept_names)
    return concept, rows


def pick_shares_fact(companyfacts, concept_names):
    for concept in concept_names:
        namespace, concept_data = _find_concept_data(companyfacts, concept)
        if not concept_data:
            continue
        units = concept_data.get("units", {}) or {}
        share_facts = units.get("shares") or units.get("Shares")
        if share_facts:
            return concept, share_facts
    return None, []


def _fact_row_quality(row):
    """Prefer standardized, consolidated-looking SEC rows for the same period."""
    frame_score = 1 if row.get("frame") else 0
    fp = str(row.get("fp") or "").upper()
    fp_score = 1 if fp in {"FY", "Q1", "Q2", "Q3", "Q4"} else 0
    filed_score = str(row.get("filed") or "")
    accn_score = str(row.get("accn") or "")
    return frame_score, fp_score, filed_score, accn_score


def latest_annual_facts(fact_rows, max_years=5):
    clean = []
    for row in fact_rows or []:
        form = str(row.get("form") or "").upper()
        fp = row.get("fp")
        val = row.get("val")
        filed = row.get("filed")
        start = row.get("start")
        end = row.get("end")
        frame = row.get("frame")

        if form not in SEC_ANNUAL_HISTORY_FORMS:
            continue
        if form.startswith("10-K") and fp not in ("FY", None):
            continue
        if val is None or not end:
            continue

        if start:
            try:
                start_dt = datetime.fromisoformat(start)
                end_dt = datetime.fromisoformat(end)
                days = (end_dt - start_dt).days
                if days < 300 or days > 430:
                    continue
            except Exception:
                continue

        # IMPORTANT: Companyfacts repeats comparative prior-year facts inside later
        # filings. The row's `fy` identifies the filing fiscal year, not always the
        # period represented by this individual fact. Key annual facts by the
        # actual financial-period end date so FY2025 cannot accidentally receive
        # a comparative FY2023 value from a 2025 10-K.
        try:
            year = int(str(end)[:4])
        except Exception:
            continue

        clean.append({
            "year": year,
            "value": val,
            "filed": filed,
            "start": start,
            "end": end,
            "form": form,
            "frame": frame,
            "accn": row.get("accn"),
            "fy": row.get("fy"),
            "fp": fp,
        })

    by_year = {}
    for row in clean:
        year = row["year"]
        existing = by_year.get(year)
        if not existing or _fact_row_quality(row) > _fact_row_quality(existing):
            by_year[year] = row
    return sorted(by_year.values(), key=lambda x: x["year"], reverse=True)[:max_years]


def latest_quarterly_facts(fact_rows, max_quarters=8):
    clean = []
    for row in fact_rows or []:
        form = str(row.get("form") or "").upper()
        val = row.get("val")
        filed = row.get("filed")
        start = row.get("start")
        end = row.get("end")
        frame = row.get("frame")
        fp = row.get("fp")

        if form not in SEC_QUARTERLY_FORMS:
            continue
        if val is None or not start or not end:
            continue
        try:
            start_dt = datetime.fromisoformat(start)
            end_dt = datetime.fromisoformat(end)
            days = (end_dt - start_dt).days
        except Exception:
            continue
        if days < 60 or days > 130:
            continue

        clean.append({
            "period": end,
            "year": int(str(end)[:4]),
            "quarter": fp,
            "value": val,
            "filed": filed,
            "start": start,
            "end": end,
            "form": form,
            "frame": frame,
            "accn": row.get("accn"),
            "fy": row.get("fy"),
        })

    by_period = {}
    for row in clean:
        key = row["end"]
        existing = by_period.get(key)
        if not existing or _fact_row_quality(row) > _fact_row_quality(existing):
            by_period[key] = row
    return sorted(by_period.values(), key=lambda x: x["end"], reverse=True)[:max_quarters]


def latest_instant_facts(fact_rows, max_periods=8):
    clean = []
    for row in fact_rows or []:
        form = str(row.get("form") or "").upper()
        val = row.get("val")
        filed = row.get("filed")
        end = row.get("end")
        frame = row.get("frame")
        fp = row.get("fp")
        if form not in SEC_QUARTERLY_FORMS:
            continue
        if val is None or not end:
            continue
        clean.append({
            "period": end,
            "year": int(str(end)[:4]),
            "quarter": fp,
            "value": val,
            "filed": filed,
            "end": end,
            "form": form,
            "frame": frame,
            "accn": row.get("accn"),
            "fy": row.get("fy"),
        })

    by_period = {}
    for row in clean:
        key = row["end"]
        existing = by_period.get(key)
        if not existing or _fact_row_quality(row) > _fact_row_quality(existing):
            by_period[key] = row
    return sorted(by_period.values(), key=lambda x: x["end"], reverse=True)[:max_periods]


def get_monetary_rows(companyfacts, concept, preferred_currency=None):
    namespace, concept_data = _find_concept_data(companyfacts, concept)
    if not concept_data:
        return [], None, namespace
    units = concept_data.get("units", {}) or {}
    candidates = []
    if preferred_currency:
        candidates.extend([preferred_currency, preferred_currency.lower()])
    candidates.extend(_currency_unit_candidates(units))
    seen = set()
    for currency in candidates:
        if currency in seen:
            continue
        seen.add(currency)
        rows = units.get(currency)
        if rows:
            return rows, str(currency).upper(), namespace
    return [], None, namespace


def get_usd_rows(companyfacts, concept):
    rows, _, _ = get_monetary_rows(companyfacts, concept, preferred_currency="USD")
    return rows


def get_share_rows(companyfacts, concept):
    namespace, concept_data = _find_concept_data(companyfacts, concept)
    if not concept_data:
        return []
    units = concept_data.get("units", {}) or {}
    return units.get("shares") or units.get("Shares") or []



def get_per_share_rows(companyfacts, concept, preferred_currency=None):
    """Return EPS/per-share rows from units such as USD/shares."""
    namespace, concept_data = _find_concept_data(companyfacts, concept)
    if not concept_data:
        return [], None, namespace

    units = concept_data.get("units", {}) or {}
    candidates = []

    for unit, rows in units.items():
        normalized = str(unit or "").lower().replace(" ", "")
        if "/" not in normalized or "share" not in normalized:
            continue

        score = 0
        if preferred_currency and normalized.startswith(str(preferred_currency).lower()):
            score += 10
        if "shares" in normalized:
            score += 2
        candidates.append((score, str(unit), rows))

    if not candidates:
        return [], None, namespace

    candidates.sort(key=lambda item: item[0], reverse=True)
    _, unit, rows = candidates[0]
    return rows or [], unit, namespace


def pick_quarterly_per_share_facts_by_period(
    companyfacts,
    concept_names,
    max_quarters=8,
    preferred_currency=None,
):
    by_period = {}

    for priority, concept in enumerate(concept_names or []):
        raw_rows, unit, namespace = get_per_share_rows(
            companyfacts,
            concept,
            preferred_currency=preferred_currency,
        )
        for row in latest_quarterly_facts(raw_rows, max_quarters=max_quarters):
            period = row.get("period")
            if not period:
                continue
            candidate = dict(row)
            candidate["concept"] = concept
            candidate["concept_priority"] = priority
            candidate["unit"] = unit
            candidate["namespace"] = namespace
            existing = by_period.get(period)
            if existing is None or priority < existing.get("concept_priority", 999):
                by_period[period] = candidate

    return sorted(
        by_period.values(),
        key=lambda row: row.get("period") or "",
        reverse=True,
    )[:max_quarters]


def _preferred_reporting_currency(companyfacts, concept_groups=None):
    currency_counts = {}
    concept_groups = concept_groups or []
    for concepts in concept_groups:
        for concept in concepts:
            _, concept_data = _find_concept_data(companyfacts, concept)
            if not concept_data:
                continue
            for unit, rows in (concept_data.get("units", {}) or {}).items():
                code = str(unit).upper()
                if len(code) == 3 and code.isalpha() and rows:
                    currency_counts[code] = currency_counts.get(code, 0) + len(rows)
    if currency_counts:
        return max(currency_counts, key=currency_counts.get)
    return "USD" if get_reporting_taxonomy(companyfacts) == "us-gaap" else None


def pick_annual_monetary_facts_by_year(companyfacts, concept_names, max_years=6, preferred_currency=None):
    by_year = {}
    concept_by_year = {}
    currency_by_year = {}
    namespace_by_year = {}
    for concept in concept_names:
        rows, currency, namespace = get_monetary_rows(companyfacts, concept, preferred_currency=preferred_currency)
        annual_rows = latest_annual_facts(rows, max_years=max_years)
        for row in annual_rows:
            year = row.get("year")
            if not year or year in by_year:
                continue
            by_year[year] = row
            concept_by_year[year] = concept
            currency_by_year[year] = currency
            namespace_by_year[year] = namespace
    output = []
    for year, row in by_year.items():
        enriched = dict(row)
        enriched["concept"] = concept_by_year.get(year)
        enriched["currency"] = currency_by_year.get(year)
        enriched["namespace"] = namespace_by_year.get(year)
        output.append(enriched)
    return sorted(output, key=lambda x: x["year"], reverse=True)[:max_years]


def pick_annual_usd_fact(companyfacts, concept_names, max_years=5):
    rows = pick_annual_monetary_facts_by_year(companyfacts, concept_names, max_years=max_years, preferred_currency="USD")
    if rows:
        return rows[0].get("concept"), rows
    return None, []


def pick_annual_shares_fact(companyfacts, concept_names, max_years=5):
    rows = pick_annual_shares_facts_by_year(companyfacts, concept_names, max_years=max_years)
    if rows:
        return rows[0].get("concept"), rows
    return None, []


def pick_annual_usd_facts_by_year(companyfacts, concept_names, max_years=6):
    return pick_annual_monetary_facts_by_year(companyfacts, concept_names, max_years=max_years, preferred_currency="USD")


def pick_annual_shares_facts_by_year(companyfacts, concept_names, max_years=6):
    by_year = {}
    concept_by_year = {}
    for concept in concept_names:
        share_facts = get_share_rows(companyfacts, concept)
        annual_rows = latest_annual_facts(share_facts, max_years=max_years)
        for row in annual_rows:
            year = row.get("year")
            if year and year not in by_year:
                by_year[year] = row
                concept_by_year[year] = concept
    output = []
    for year, row in by_year.items():
        enriched = dict(row)
        enriched["concept"] = concept_by_year.get(year)
        output.append(enriched)
    return sorted(output, key=lambda x: x["year"], reverse=True)[:max_years]


def _date_distance_days(left, right):
    if not left or not right:
        return 10 ** 9
    try:
        return abs((datetime.fromisoformat(str(left)[:10]) - datetime.fromisoformat(str(right)[:10])).days)
    except Exception:
        return 10 ** 9


def _annual_candidates_for_concepts(
    companyfacts,
    concept_names,
    preferred_currency=None,
    *,
    instant=False,
    shares=False,
    per_share=False,
):
    """Return all usable annual-history facts without collapsing by calendar year."""
    output = []
    for priority, concept in enumerate(concept_names or []):
        if shares:
            raw_rows = get_share_rows(companyfacts, concept)
            currency = "shares"
            namespace, _ = _find_concept_data(companyfacts, concept)
        elif per_share:
            raw_rows, currency, namespace = get_per_share_rows(
                companyfacts,
                concept,
                preferred_currency=preferred_currency,
            )
        else:
            raw_rows, currency, namespace = get_monetary_rows(
                companyfacts,
                concept,
                preferred_currency=preferred_currency,
            )

        for raw in raw_rows or []:
            form = str(raw.get("form") or "").upper()
            end = raw.get("end")
            value = raw.get("val")
            if form not in SEC_ANNUAL_HISTORY_FORMS or end is None or value is None:
                continue

            if not instant:
                start = raw.get("start")
                if not start:
                    continue
                days = _fact_duration_days(raw)
                if days is None or not (300 <= days <= 430):
                    continue

            row = {
                "value": value,
                "start": raw.get("start"),
                "end": end,
                "period": end,
                "filed": raw.get("filed"),
                "form": form,
                "frame": raw.get("frame"),
                "accn": raw.get("accn"),
                "fy": raw.get("fy"),
                "fp": raw.get("fp"),
                "concept": concept,
                "concept_priority": priority,
                "currency": currency,
                "namespace": namespace,
            }
            output.append(row)
    return output


def _pick_candidate_for_anchor(candidates, anchor_end, *, prefer_largest_positive=False, max_distance_days=7):
    eligible = []
    for row in candidates or []:
        distance = _date_distance_days(row.get("end"), anchor_end)
        if distance <= max_distance_days:
            eligible.append((distance, row))
    if not eligible:
        return None

    min_distance = min(distance for distance, _ in eligible)
    nearest = [row for distance, row in eligible if distance == min_distance]

    # Prefer a standardized frame/consolidated-looking fact. For revenue, a
    # company may expose both component sales and total revenue under different
    # standard concepts; the consolidated total is normally the largest positive
    # same-period value.
    if prefer_largest_positive:
        positives = []
        for row in nearest:
            try:
                value = float(row.get("value"))
            except Exception:
                continue
            if value > 0:
                positives.append(row)
        if positives:
            nearest = positives
            return max(
                nearest,
                key=lambda row: (
                    float(row.get("value") or 0),
                    _fact_row_quality(row),
                    -int(row.get("concept_priority") or 0),
                ),
            )

    return max(
        nearest,
        key=lambda row: (
            _fact_row_quality(row),
            -int(row.get("concept_priority") or 0),
        ),
    )


def _annual_anchor_periods(companyfacts, concept_map, preferred_currency=None, max_periods=6):
    """Find fiscal-year ends from the freshest available core statement facts."""
    period_scores = {}
    for key in ("revenue", "net_income", "operating_income"):
        for row in _annual_candidates_for_concepts(
            companyfacts,
            concept_map.get(key, []),
            preferred_currency=preferred_currency,
            instant=False,
        ):
            end = row.get("end")
            if end:
                period_scores[end] = period_scores.get(end, 0) + 1

    if not period_scores:
        for row in _annual_candidates_for_concepts(
            companyfacts,
            concept_map.get("assets", []),
            preferred_currency=preferred_currency,
            instant=True,
        ):
            end = row.get("end")
            if end:
                period_scores[end] = period_scores.get(end, 0) + 1

    # Do not require the revenue concept itself to be fresh. Utilities, banks and
    # reorganized issuers can change revenue tags while net income/assets remain
    # current; choosing the freshest core period prevents a stale concept from
    # anchoring the whole annual table years in the past.
    return sorted(period_scores, reverse=True)[:max_periods]


def _select_annual_balance_triplet(companyfacts, concept_map, anchor_end, preferred_currency=None):
    """Select a period-coherent GAAP balance equation, including mezzanine equity."""
    asset_candidates = _annual_candidates_for_concepts(
        companyfacts, concept_map.get("assets", []), preferred_currency, instant=True
    )
    liability_candidates = _annual_candidates_for_concepts(
        companyfacts, concept_map.get("liabilities", []), preferred_currency, instant=True
    )
    equity_candidates = _annual_candidates_for_concepts(
        companyfacts, concept_map.get("equity", []), preferred_currency, instant=True
    )
    temporary_equity_candidates = _annual_candidates_for_concepts(
        companyfacts, concept_map.get("temporary_equity", []), preferred_currency, instant=True
    )

    assets_row = _pick_candidate_for_anchor(asset_candidates, anchor_end)
    liabilities_row = _pick_candidate_for_anchor(liability_candidates, anchor_end)
    assets = assets_row.get("value") if assets_row else None
    liabilities = liabilities_row.get("value") if liabilities_row else None

    matching_equity = [
        row for row in equity_candidates
        if _date_distance_days(row.get("end"), anchor_end) <= 7
    ]
    matching_temporary = [
        row for row in temporary_equity_candidates
        if _date_distance_days(row.get("end"), anchor_end) <= 7
    ]

    equity_row = None
    temporary_equity_row = None

    # Solve the reported GAAP balance equation jointly. Temporary/mezzanine
    # equity is presented outside permanent stockholders' equity at some issuers;
    # evaluating the pair prevents both false identity failures and accidental
    # replacement of reported permanent equity with the residual amount.
    if assets is not None and liabilities is not None and matching_equity:
        try:
            a = float(assets)
            l = float(liabilities)
            pair_candidates = []
            temporary_options = [None, *matching_temporary]
            for eq_row in matching_equity:
                eq_value = float(eq_row.get("value"))
                for temp_row in temporary_options:
                    temp_value = float(temp_row.get("value")) if temp_row else 0.0
                    residual = abs(a - l - eq_value - temp_value) / max(abs(a), 1.0)
                    pair_candidates.append((residual, eq_row, temp_row))

            if pair_candidates:
                # Residual dominates. For effectively tied equations, prefer the
                # more consolidated/high-priority standard concepts and better SEC rows.
                residual, equity_row, temporary_equity_row = min(
                    pair_candidates,
                    key=lambda item: (
                        item[0],
                        int(item[1].get("concept_priority") or 0),
                        int(item[2].get("concept_priority") or 0) if item[2] else 10 ** 6
                    ),
                )
        except Exception:
            equity_row = None
            temporary_equity_row = None

    if equity_row is None:
        equity_row = _pick_candidate_for_anchor(equity_candidates, anchor_end)
    if temporary_equity_row is None and matching_temporary:
        # Only attach a reported temporary-equity line if it improves or is
        # needed for the equation; otherwise a disclosed subcomponent can be
        # mistaken for the total and double-counted.
        if assets is not None and liabilities is not None and equity_row is not None:
            try:
                base_residual = abs(float(assets) - float(liabilities) - float(equity_row.get("value")))
                best_temp = min(
                    matching_temporary,
                    key=lambda row: abs(
                        float(assets) - float(liabilities) - float(equity_row.get("value")) - float(row.get("value"))
                    ),
                )
                with_temp_residual = abs(
                    float(assets) - float(liabilities) - float(equity_row.get("value")) - float(best_temp.get("value"))
                )
                if with_temp_residual + max(abs(float(assets)) * 1e-6, 1.0) < base_residual:
                    temporary_equity_row = best_temp
            except Exception:
                temporary_equity_row = _pick_candidate_for_anchor(matching_temporary, anchor_end)
        else:
            temporary_equity_row = _pick_candidate_for_anchor(matching_temporary, anchor_end)

    equity = equity_row.get("value") if equity_row else None
    temporary_equity = temporary_equity_row.get("value") if temporary_equity_row else None
    assets_source = "reported" if assets is not None else None
    liabilities_source = "reported" if liabilities is not None else None
    equity_source = "reported" if equity is not None else None
    temporary_equity_source = "reported" if temporary_equity is not None else None

    # Some issuers tag redeemable NCI / mezzanine equity only with a custom
    # extension concept, so Companyfacts has no standard temporary-equity tag to
    # select. After exact-period Assets/Liabilities and the best permanent-equity
    # concept are established, a modest positive residual is itself the amount
    # presented between liabilities and permanent equity. Preserve permanent
    # equity and classify that residual separately; never force it into ordinary
    # stockholders' equity. The cap prevents a wildly wrong concept selection
    # (for example a 50%+ gap) from being papered over as mezzanine equity.
    if temporary_equity is None and assets is not None and liabilities is not None and equity is not None:
        try:
            residual_amount = float(assets) - float(liabilities) - float(equity)
            residual_ratio = residual_amount / max(abs(float(assets)), 1.0)
            if residual_amount > 0 and 0.001 <= residual_ratio <= 0.20:
                temporary_equity = residual_amount
                temporary_equity_source = "derived_positive_balance_sheet_residual"
        except Exception:
            pass

    # Only derive a missing permanent-equity total after explicitly accounting
    # for reported temporary/mezzanine equity. Do NOT overwrite a reported
    # permanent-equity value merely to force the equation to close.
    if equity is None and assets is not None and liabilities is not None:
        try:
            equity = float(assets) - float(liabilities) - float(temporary_equity or 0)
            equity_source = "derived_assets_minus_liabilities_and_temporary_equity"
        except Exception:
            pass

    if liabilities is None and assets is not None and equity is not None:
        try:
            liabilities = float(assets) - float(equity) - float(temporary_equity or 0)
            liabilities_source = "derived_assets_minus_total_equity_components"
        except Exception:
            pass

    return {
        "assets": assets,
        "assets_row": assets_row,
        "assets_source": assets_source,
        "liabilities": liabilities,
        "liabilities_row": liabilities_row,
        "liabilities_source": liabilities_source,
        "equity": equity,
        "equity_row": equity_row,
        "equity_source": equity_source,
        "temporary_equity": temporary_equity,
        "temporary_equity_row": temporary_equity_row,
        "temporary_equity_source": temporary_equity_source,
    }

def pick_quarterly_revenue_facts_by_period(companyfacts, concept_names, max_quarters=8, preferred_currency=None):
    """Choose consolidated total revenue instead of a component sales concept."""
    candidates_by_period = defaultdict(list)
    for priority, concept in enumerate(concept_names or []):
        rows, currency, namespace = get_monetary_rows(
            companyfacts, concept, preferred_currency=preferred_currency
        )
        for row in latest_quarterly_facts(rows, max_quarters=max_quarters * 2):
            period = row.get("period")
            if not period:
                continue
            enriched = dict(row)
            enriched.update({
                "concept": concept,
                "concept_priority": priority,
                "currency": currency,
                "namespace": namespace,
            })
            candidates_by_period[period].append(enriched)

    output = []
    for period, candidates in candidates_by_period.items():
        positives = []
        for row in candidates:
            try:
                if float(row.get("value")) > 0:
                    positives.append(row)
            except Exception:
                pass
        pool = positives or candidates
        if positives:
            chosen = max(
                pool,
                key=lambda row: (
                    float(row.get("value") or 0),
                    _fact_row_quality(row),
                    -int(row.get("concept_priority") or 0),
                ),
            )
        else:
            chosen = max(
                pool,
                key=lambda row: (_fact_row_quality(row), -int(row.get("concept_priority") or 0)),
            )
        output.append(chosen)
    return sorted(output, key=lambda row: row.get("period") or "", reverse=True)[:max_quarters]


def pick_quarterly_monetary_facts_by_period(companyfacts, concept_names, max_quarters=8, preferred_currency=None):
    by_period = {}
    concept_by_period = {}
    currency_by_period = {}
    namespace_by_period = {}
    for concept in concept_names:
        rows, currency, namespace = get_monetary_rows(companyfacts, concept, preferred_currency=preferred_currency)
        quarterly_rows = latest_quarterly_facts(rows, max_quarters=max_quarters)
        for row in quarterly_rows:
            period = row.get("period")
            if period and period not in by_period:
                by_period[period] = row
                concept_by_period[period] = concept
                currency_by_period[period] = currency
                namespace_by_period[period] = namespace
    output = []
    for period, row in by_period.items():
        enriched = dict(row)
        enriched["concept"] = concept_by_period.get(period)
        enriched["currency"] = currency_by_period.get(period)
        enriched["namespace"] = namespace_by_period.get(period)
        output.append(enriched)
    return sorted(output, key=lambda x: x["period"], reverse=True)[:max_quarters]


def pick_quarterly_usd_facts_by_period(companyfacts, concept_names, max_quarters=8):
    return pick_quarterly_monetary_facts_by_period(companyfacts, concept_names, max_quarters=max_quarters, preferred_currency="USD")


def pick_instant_monetary_facts_by_period(companyfacts, concept_names, max_periods=8, preferred_currency=None):
    by_period = {}
    concept_by_period = {}
    currency_by_period = {}
    namespace_by_period = {}
    for concept in concept_names:
        rows, currency, namespace = get_monetary_rows(companyfacts, concept, preferred_currency=preferred_currency)
        instant_rows = latest_instant_facts(rows, max_periods=max_periods)
        for row in instant_rows:
            period = row.get("period")
            if period and period not in by_period:
                by_period[period] = row
                concept_by_period[period] = concept
                currency_by_period[period] = currency
                namespace_by_period[period] = namespace
    output = []
    for period, row in by_period.items():
        enriched = dict(row)
        enriched["concept"] = concept_by_period.get(period)
        enriched["currency"] = currency_by_period.get(period)
        enriched["namespace"] = namespace_by_period.get(period)
        output.append(enriched)
    return sorted(output, key=lambda x: x["period"], reverse=True)[:max_periods]


def pick_instant_usd_facts_by_period(companyfacts, concept_names, max_periods=8):
    return pick_instant_monetary_facts_by_period(companyfacts, concept_names, max_periods=max_periods, preferred_currency="USD")


def pick_quarterly_shares_by_period(companyfacts, concept_names, max_quarters=8):
    by_period = {}
    concept_by_period = {}
    for concept in concept_names:
        quarterly_rows = latest_quarterly_facts(get_share_rows(companyfacts, concept), max_quarters=max_quarters)
        for row in quarterly_rows:
            period = row.get("period")
            if period and period not in by_period:
                by_period[period] = row
                concept_by_period[period] = concept
    output = []
    for period, row in by_period.items():
        enriched = dict(row)
        enriched["concept"] = concept_by_period.get(period)
        output.append(enriched)
    return sorted(output, key=lambda x: x["period"], reverse=True)[:max_quarters]

def sum_latest_values(rows, count=4):
    values = []

    for row in rows[:count]:
        value = row.get("value")
        if value is None:
            return None
        values.append(float(value))

    if len(values) < count:
        return None

    return sum(values)


def _fact_duration_days(row):
    start = row.get("start")
    end = row.get("end")
    if not start or not end:
        return None
    try:
        return (datetime.fromisoformat(end) - datetime.fromisoformat(start)).days
    except Exception:
        return None


def _calculate_ttm_single_concept(companyfacts, concept, preferred_currency=None):
    rows, currency, namespace = get_monetary_rows(
        companyfacts,
        concept,
        preferred_currency=preferred_currency,
    )
    if not rows:
        return None

    annual_candidates = []
    interim_candidates = []

    for row in rows:
        form = str(row.get("form") or "").upper()
        value = row.get("val")
        end = row.get("end")
        days = _fact_duration_days(row)

        if value is None or not end or days is None:
            continue

        if form in SEC_ANNUAL_HISTORY_FORMS and 300 <= days <= 430:
            annual_candidates.append(row)
        elif form in SEC_QUARTERLY_FORMS and 60 <= days < 300:
            interim_candidates.append(row)

    annual_candidates.sort(
        key=lambda r: (
            str(r.get("end") or ""),
            _fact_row_quality(r),
        ),
        reverse=True,
    )

    if annual_candidates:
        annual_row = annual_candidates[0]
        annual_end = annual_row.get("end")
        try:
            annual_end_dt = datetime.fromisoformat(str(annual_end)[:10])
        except Exception:
            annual_end_dt = None

        if annual_end_dt:
            post_annual = []
            for row in interim_candidates:
                try:
                    end_dt = datetime.fromisoformat(str(row.get("end"))[:10])
                except Exception:
                    continue
                if end_dt > annual_end_dt:
                    post_annual.append(row)

            if post_annual:
                latest_end = max(str(r.get("end") or "") for r in post_annual)
                current_same_end = [
                    r for r in post_annual if str(r.get("end") or "") == latest_end
                ]
                current_same_end.sort(
                    key=lambda r: (
                        _fact_duration_days(r) or 0,
                        _fact_row_quality(r),
                    ),
                    reverse=True,
                )
                current_ytd = current_same_end[0]
                current_days = _fact_duration_days(current_ytd)
                current_end_dt = datetime.fromisoformat(str(current_ytd.get("end"))[:10])

                prior_candidates = []
                for row in interim_candidates:
                    row_days = _fact_duration_days(row)
                    if row_days is None:
                        continue
                    try:
                        row_end_dt = datetime.fromisoformat(str(row.get("end"))[:10])
                    except Exception:
                        continue

                    year_gap_error = abs((current_end_dt - row_end_dt).days - 365)
                    duration_error = abs(row_days - current_days)

                    if year_gap_error <= 45 and duration_error <= 20:
                        prior_candidates.append(
                            (year_gap_error, duration_error, row)
                        )

                if prior_candidates:
                    prior_candidates.sort(
                        key=lambda x: (
                            x[0],
                            x[1],
                            tuple(-ord(ch) for ch in str(x[2].get("filed") or "")),
                        )
                    )
                    # The first two tuple fields already identify the true
                    # comparable YTD. If several duplicate contexts remain,
                    # prefer a standardized frame and latest filing.
                    best_error = prior_candidates[0][:2]
                    tied = [row for gap, dur, row in prior_candidates if (gap, dur) == best_error]
                    prior_ytd = max(tied, key=_fact_row_quality)

                    try:
                        value = (
                            float(annual_row.get("val"))
                            + float(current_ytd.get("val"))
                            - float(prior_ytd.get("val"))
                        )
                        return {
                            "value": value,
                            "concept": concept,
                            "currency": currency,
                            "namespace": namespace,
                            "method": "annual_plus_current_ytd_minus_prior_ytd",
                            "annual_end": annual_end,
                            "annual_value": float(annual_row.get("val")),
                            "current_ytd_end": current_ytd.get("end"),
                            "prior_ytd_end": prior_ytd.get("end"),
                        }
                    except Exception:
                        pass

            else:
                try:
                    return {
                        "value": float(annual_row.get("val")),
                        "concept": concept,
                        "currency": currency,
                        "namespace": namespace,
                        "method": "latest_annual",
                        "annual_end": annual_end,
                        "annual_value": float(annual_row.get("val")),
                        "current_ytd_end": None,
                        "prior_ytd_end": None,
                    }
                except Exception:
                    pass

    # Fallback: four discrete quarters, but only if they are actually consecutive.
    discrete = latest_quarterly_facts(rows, max_quarters=8)
    if len(discrete) >= 4:
        candidate = discrete[:4]
        try:
            dates = [datetime.fromisoformat(str(r["period"])[:10]) for r in candidate]
            gaps = [(dates[i] - dates[i + 1]).days for i in range(3)]
        except Exception:
            gaps = []

        if len(gaps) == 3 and all(70 <= gap <= 120 for gap in gaps):
            try:
                fallback_value = sum(float(r["value"]) for r in candidate)
                return {
                    "value": fallback_value,
                    "concept": concept,
                    "currency": currency,
                    "namespace": namespace,
                    "method": "four_consecutive_discrete_quarters",
                    "annual_end": None,
                    "annual_value": None,
                    "current_ytd_end": candidate[0].get("period"),
                    "prior_ytd_end": None,
                }
            except Exception:
                pass

    return None

def calculate_ttm_monetary_fact(
    companyfacts,
    concept_names,
    preferred_currency=None,
    *,
    selection_mode="priority",
):
    """
    Build accounting-safe TTM values and choose among standard concepts.

    `selection_mode="revenue"` resolves a common SEC semantic trap: an issuer can
    report component sales under a higher-priority standard concept while total
    consolidated revenue is tagged as `Revenues`. In that case, choose the
    largest positive same-freshness TTM candidate rather than the first tag.
    """
    candidates = []
    for priority, concept in enumerate(concept_names or []):
        result = _calculate_ttm_single_concept(
            companyfacts,
            concept,
            preferred_currency=preferred_currency,
        )
        if not result:
            continue
        result = dict(result)
        result["concept_priority"] = priority
        result["effective_end"] = (
            result.get("current_ytd_end")
            or result.get("annual_end")
            or ""
        )
        candidates.append(result)

    if not candidates:
        return None

    latest_end = max(str(row.get("effective_end") or "") for row in candidates)
    fresh_candidates = [
        row for row in candidates
        if _date_distance_days(row.get("effective_end"), latest_end) <= 45
    ] or candidates

    if selection_mode == "revenue":
        positives = []
        for row in fresh_candidates:
            try:
                if float(row.get("value")) > 0:
                    positives.append(row)
            except Exception:
                pass
        pool = positives or fresh_candidates
        if positives:
            return max(
                pool,
                key=lambda row: (
                    float(row.get("value") or 0),
                    -int(row.get("concept_priority") or 0),
                ),
            )

    # Normal metrics preserve semantic concept priority, but require the result
    # to be from the freshest reporting window. This keeps fallback tags from an
    # old taxonomy generation from displacing a current filing.
    return min(
        fresh_candidates,
        key=lambda row: int(row.get("concept_priority") or 0),
    )

def _sum_four_consecutive_quarter_values(rows):
    rows = list(rows or [])
    if len(rows) < 4:
        return None
    candidate = rows[:4]
    try:
        dates = [datetime.fromisoformat(str(row.get("period") or row.get("end"))[:10]) for row in candidate]
        gaps = [(dates[i] - dates[i + 1]).days for i in range(3)]
        if not all(70 <= gap <= 120 for gap in gaps):
            return None
        return sum(float(row.get("value")) for row in candidate)
    except Exception:
        return None


def get_latest_value(rows):
    if not rows:
        return None

    value = rows[0].get("value")
    return value if value is not None else None


def get_latest_period(rows):
    if not rows:
        return None

    return rows[0].get("period") or rows[0].get("end")

def pct_growth(current, previous):
    try:
        current = float(current)
        previous = float(previous)

        if previous == 0:
            return None

        return ((current - previous) / abs(previous)) * 100
    except Exception:
        return None

def cagr(current, previous, years):
    try:
        current = float(current)
        previous = float(previous)

        if current <= 0 or previous <= 0 or years <= 0:
            return None

        return ((current / previous) ** (1 / years) - 1) * 100
    except Exception:
        return None


def get_year_value(yearly, index, key):
    try:
        if len(yearly) <= index:
            return None

        return yearly[index].get(key)
    except Exception:
        return None

def safe_ratio(numerator, denominator):
    try:
        numerator = float(numerator)
        denominator = float(denominator)

        if denominator == 0:
            return None

        return numerator / denominator
    except Exception:
        return None

BANK_SIGNAL_CONCEPTS = {
    "Deposits",
    "DepositsDomestic",
    "LoansAndLeasesReceivableNetReportedAmount",
    "LoansAndLeasesReceivableNetOfUnearnedIncome",
    "LoansAndLeasesReceivableGrossCarryingAmount",
    "FinancingReceivableExcludingAccruedInterestAfterAllowanceForCreditLoss",
    "AllowanceForLoanAndLeaseLosses",
    "FinancingReceivableAllowanceForCreditLosses",
    "ProvisionForCreditLosses",
    "ProvisionForLoanLeaseAndOtherLosses",
    "NoninterestIncome",
    "InterestIncomeExpenseNet",
    "NetInterestIncome",
}

BANK_CONCEPT_MAP = {
    "net_interest_income": [
        "InterestIncomeExpenseNet",
        "InterestIncomeExpenseNonoperatingNet",
        "NetInterestIncome",
        "InterestAndDividendIncomeOperatingNet",
    ],
    "noninterest_income": [
        "NoninterestIncome",
        "NonInterestIncome",
        "NoninterestRevenue",
    ],
    "provision_for_credit_losses": [
        "ProvisionForCreditLosses",
        "ProvisionForLoanLeaseAndOtherLosses",
        "ProvisionForLoanAndLeaseLosses",
    ],
    "deposits": [
        "Deposits",
        "DepositsDomestic",
    ],
    "loans": [
        "LoansAndLeasesReceivableNetReportedAmount",
        "LoansAndLeasesReceivableNetOfUnearnedIncome",
        "LoansAndLeasesReceivableGrossCarryingAmount",
        "FinancingReceivableExcludingAccruedInterestAfterAllowanceForCreditLoss",
    ],
    "allowance_for_credit_losses": [
        "AllowanceForLoanAndLeaseLosses",
        "FinancingReceivableAllowanceForCreditLosses",
        "AllowanceForCreditLossesFinancingReceivables",
    ],
}

INSURANCE_SIGNAL_CONCEPTS = {
    "PremiumsEarnedNet",
    "PremiumsEarned",
    "InsurancePremiumsRevenue",
    "InsuranceRevenue",
    "UnearnedPremiums",
    "DeferredPolicyAcquisitionCosts",
    "PolicyholderBenefitsAndClaimsPayable",
    "PolicyholderBenefitsAndClaimsPayableCurrent",
    "PolicyholderBenefitsAndClaimsPayableNoncurrent",
    "FuturePolicyBenefits",
    "PropertyCasualtyInsuranceClaimsAndClaimsAdjustmentExpense",
    "PropertyCasualtyInsuranceClaimsAndClaimsAdjustmentExpenseReserves",
    "ClaimsAndClaimsAdjustmentExpense",
    "ClaimsAndClaimsAdjustmentExpenseReserves",
}

REAL_ESTATE_SIGNAL_CONCEPTS = {
    "RealEstateInvestmentPropertyNet",
    "RealEstateInvestmentsNet",
    "RealEstateInvestments",
    "InvestmentPropertyNet",
    "OperatingLeasesIncomeStatementLeaseRevenue",
    "RentalIncome",
    "RentalRevenue",
    "RealEstateRevenueNet",
}


def _companyfacts_concept_names(companyfacts):
    names = set()
    for namespace_data in (companyfacts.get("facts", {}) or {}).values():
        names.update((namespace_data or {}).keys())
    return names


def _latest_companyfacts_end_date(companyfacts):
    latest = None
    for namespace_data in (companyfacts.get("facts", {}) or {}).values():
        for concept_data in (namespace_data or {}).values():
            for rows in ((concept_data or {}).get("units", {}) or {}).values():
                for row in rows or []:
                    end = row.get("end")
                    form = str(row.get("form") or "").upper()
                    if not end or form not in (SEC_ANNUAL_HISTORY_FORMS | SEC_QUARTERLY_FORMS):
                        continue
                    if latest is None or str(end) > str(latest):
                        latest = str(end)
    return latest


def _concepts_with_recent_activity(companyfacts, concepts, max_age_days=900):
    latest_end = _latest_companyfacts_end_date(companyfacts)
    if not latest_end:
        return set()
    try:
        anchor = datetime.fromisoformat(str(latest_end)[:10])
    except Exception:
        return set()

    active = set()
    for concept in concepts or []:
        namespace, concept_data = _find_concept_data(companyfacts, concept)
        if not concept_data:
            continue
        found = False
        for rows in ((concept_data.get("units", {}) or {}).values()):
            for row in rows or []:
                form = str(row.get("form") or "").upper()
                if form not in (SEC_ANNUAL_HISTORY_FORMS | SEC_QUARTERLY_FORMS):
                    continue
                end = row.get("end")
                if not end:
                    continue
                try:
                    dt = datetime.fromisoformat(str(end)[:10])
                except Exception:
                    continue
                if -45 <= (anchor - dt).days <= max_age_days:
                    found = True
                    break
            if found:
                break
        if found:
            active.add(concept)
    return active


def _sec_sic(companyfacts):
    metadata = companyfacts.get("_bullionaire_sec_metadata") or {}
    raw = str(metadata.get("sic") or "").strip()
    return raw.zfill(4) if raw.isdigit() else raw


def _profile_from_sec_sic(companyfacts):
    sic = _sec_sic(companyfacts)
    description = str((companyfacts.get("_bullionaire_sec_metadata") or {}).get("sic_description") or "").lower()

    # SIC 6798 is the SEC's REIT classification. Keep it ahead of banking
    # evidence because mortgage/lease receivables can otherwise look bank-like.
    if sic == "6798" or "real estate investment trust" in description:
        return "real_estate_company"

    insurance_sics = {
        "6311", "6321", "6324", "6331", "6351", "6361", "6399", "6411",
    }
    if sic in insurance_sics or "insurance agents" in description or "insurance carriers" in description:
        return "insurance_company"

    bank_sics = {
        "6021", "6022", "6029", "6035", "6036", "6099",
        "6111", "6141", "6153", "6159", "6162", "6199", "6211",
    }
    if sic in bank_sics:
        return "financial_institution"

    return None


def is_insurance_company(companyfacts):
    active = _concepts_with_recent_activity(companyfacts, INSURANCE_SIGNAL_CONCEPTS)
    has_premium = any("Premium" in concept or concept == "InsuranceRevenue" for concept in active)
    has_policy_or_claim_reserve = any(
        token in concept
        for concept in active
        for token in ("Policy", "Claims", "Unearned", "AcquisitionCosts", "FuturePolicyBenefits")
    )
    return len(active) >= 2 and has_premium and has_policy_or_claim_reserve


def is_financial_institution(companyfacts):
    """
    Detect a current bank/broker balance-sheet structure, not merely a historical
    finance-subsidiary concept. This prevents industrials/payment processors from
    being classified as banks because of stale legacy Companyfacts tags.
    """
    active_deposits = _concepts_with_recent_activity(companyfacts, BANK_CONCEPT_MAP["deposits"])
    active_loans = _concepts_with_recent_activity(companyfacts, BANK_CONCEPT_MAP["loans"])
    active_nii = _concepts_with_recent_activity(companyfacts, BANK_CONCEPT_MAP["net_interest_income"])
    active_noninterest = _concepts_with_recent_activity(companyfacts, BANK_CONCEPT_MAP["noninterest_income"])
    active_provision = _concepts_with_recent_activity(companyfacts, BANK_CONCEPT_MAP["provision_for_credit_losses"])

    has_deposits = bool(active_deposits)
    has_loans = bool(active_loans)
    has_nii = bool(active_nii)
    has_noninterest = bool(active_noninterest)
    has_provision = bool(active_provision)

    if has_deposits and (has_loans or has_nii):
        return True
    if has_nii and has_noninterest and (has_loans or has_provision):
        return True
    return False


def is_real_estate_company(companyfacts):
    active = _concepts_with_recent_activity(companyfacts, REAL_ESTATE_SIGNAL_CONCEPTS)
    return len(active) >= 2


def get_financial_analysis_profile(companyfacts, ticker=None):
    clean_ticker = str(ticker or "").upper().strip()

    # A very small set of known public-company edge cases must override broad
    # SIC buckets. Examples: asset managers / exchanges can share financial SICs
    # with banks, while some REITs and managed-care insurers are not cleanly
    # separated by SIC alone.
    if clean_ticker in SEC_PROFILE_REIT_TICKER_FALLBACKS:
        return "real_estate_company"
    if clean_ticker in SEC_PROFILE_INSURANCE_TICKER_FALLBACKS:
        return "insurance_company"
    if clean_ticker in SEC_PROFILE_OPERATING_TICKER_FALLBACKS:
        return "operating_company"

    # For the remaining universe, fresh SEC submissions SIC is authoritative
    # where it cleanly distinguishes banks, insurers and REITs.
    sic_profile = _profile_from_sec_sic(companyfacts)
    if sic_profile:
        return sic_profile

    # If current SEC submissions supplied a SIC and it did not map to one of the
    # special financial profiles above, treat that SIC as a negative classifier.
    # This is the general protection against legacy/subsidiary finance or real-
    # estate tags turning an industrial, processor, miner, etc. into a bank/REIT.
    # Mixed asset managers with insurance subsidiaries therefore remain the safer
    # generic operating profile unless SEC itself classifies the registrant as an
    # insurer.
    if _sec_sic(companyfacts):
        return "operating_company"

    # Legacy fixture fallback when submissions metadata is unavailable.
    # Insurance comes first because its investment portfolio can carry bank-like
    # concepts; real estate comes before bank because mortgage/lease receivables
    # can do the same.
    if is_insurance_company(companyfacts):
        return "insurance_company"
    if is_real_estate_company(companyfacts):
        return "real_estate_company"
    if is_financial_institution(companyfacts):
        return "financial_institution"
    return "operating_company"


def build_bank_financial_health_score(latest, growth):
    score = 50
    positives = []
    warnings = []
    revenue_yoy = growth.get("revenue_yoy")
    revenue_3y = growth.get("revenue_3y_cagr")
    net_income_yoy = growth.get("net_income_yoy")
    roa = latest.get("return_on_assets")
    roe = latest.get("return_on_equity")
    equity_ratio = latest.get("equity_ratio")
    loans_to_deposits = latest.get("loans_to_deposits")

    if revenue_yoy is not None:
        if revenue_yoy >= 8:
            score += 8; positives.append("Net revenue is growing strongly year over year.")
        elif revenue_yoy >= 2:
            score += 4; positives.append("Net revenue is growing year over year.")
        elif revenue_yoy < 0:
            score -= 6; warnings.append("Net revenue declined year over year.")
    if revenue_3y is not None:
        if revenue_3y >= 6:
            score += 7; positives.append("Multi-year revenue growth is healthy.")
        elif revenue_3y < 0:
            score -= 6; warnings.append("Multi-year revenue trend is negative.")
    if net_income_yoy is not None:
        if net_income_yoy >= 10:
            score += 8; positives.append("Net income is growing strongly.")
        elif net_income_yoy < -10:
            score -= 7; warnings.append("Net income declined materially year over year.")
    if roa is not None:
        if roa >= 1.2:
            score += 9; positives.append("Return on assets is strong for a financial institution.")
        elif roa >= 0.8:
            score += 4; positives.append("Return on assets is healthy for a financial institution.")
        elif roa < 0.5:
            score -= 7; warnings.append("Return on assets is weak for a financial institution.")
    if roe is not None:
        if roe >= 15:
            score += 9; positives.append("Return on equity is strong.")
        elif roe >= 10:
            score += 4; positives.append("Return on equity is healthy.")
        elif roe < 8:
            score -= 6; warnings.append("Return on equity is weak.")
    if equity_ratio is not None:
        if equity_ratio >= 7:
            score += 5; positives.append("Equity provides a solid capital cushion relative to assets.")
        elif equity_ratio < 5:
            score -= 7; warnings.append("Equity is thin relative to total assets.")
    if loans_to_deposits is not None:
        if 45 <= loans_to_deposits <= 90:
            score += 5; positives.append("Loan-to-deposit funding is balanced.")
        elif loans_to_deposits > 105:
            score -= 7; warnings.append("Loans exceed deposits by a wide margin.")

    score = max(0, min(95, round(score)))
    label = "Elite" if score >= 90 else "Strong" if score >= 75 else "Solid" if score >= 60 else "Mixed" if score >= 45 else "Weak"
    return {"score": score, "label": label, "positives": positives[:5], "warnings": warnings[:5]}


def safe_pct(numerator, denominator):
    ratio = safe_ratio(numerator, denominator)
    return ratio * 100 if ratio is not None else None



def build_real_estate_financial_health_score(latest, growth):
    """
    Conservative REIT/real-estate health score. It avoids industrial FCF rules and
    uses only broad, comparable standardized facts.
    """
    score = 50
    positives = []
    warnings = []

    revenue_yoy = growth.get("revenue_yoy")
    revenue_cagr = growth.get("revenue_3y_cagr")
    roe = latest.get("return_on_equity")
    equity_ratio = latest.get("equity_ratio")

    if revenue_yoy is not None:
        if revenue_yoy >= 8:
            score += 8
            positives.append("Revenue is growing strongly.")
        elif revenue_yoy >= 2:
            score += 4
            positives.append("Revenue is growing.")
        elif revenue_yoy < 0:
            score -= 6
            warnings.append("Revenue declined year over year.")

    if revenue_cagr is not None:
        if revenue_cagr >= 5:
            score += 7
            positives.append("Multi-year revenue growth is healthy.")
        elif revenue_cagr < 0:
            score -= 6
            warnings.append("Multi-year revenue growth is negative.")

    if equity_ratio is not None:
        if equity_ratio >= 35:
            score += 8
            positives.append("Equity provides a strong asset cushion.")
        elif equity_ratio >= 20:
            score += 4
            positives.append("Equity provides a meaningful asset cushion.")
        elif equity_ratio < 10:
            score -= 6
            warnings.append("Equity is thin relative to total assets.")

    if roe is not None:
        if roe >= 10:
            score += 5
            positives.append("Return on equity is healthy.")
        elif roe < 0:
            score -= 5
            warnings.append("Return on equity is negative.")

    score = max(0, min(95, round(score)))
    label = (
        "Elite" if score >= 90 else
        "Strong" if score >= 75 else
        "Solid" if score >= 60 else
        "Mixed" if score >= 45 else
        "Weak"
    )
    return {
        "score": score,
        "label": label,
        "positives": positives[:5],
        "warnings": warnings[:5],
    }


def build_insurance_financial_health_score(latest, growth):
    """A conservative insurer-quality score that avoids industrial FCF logic."""
    score = 50
    positives = []
    warnings = []

    revenue_yoy = growth.get("revenue_yoy")
    revenue_3y = growth.get("revenue_3y_cagr")
    net_income_yoy = growth.get("net_income_yoy")
    roa = latest.get("return_on_assets")
    roe = latest.get("return_on_equity")
    equity_ratio = latest.get("equity_ratio")

    if revenue_yoy is not None:
        if revenue_yoy >= 8:
            score += 8; positives.append("Insurance revenue is growing strongly year over year.")
        elif revenue_yoy >= 2:
            score += 4; positives.append("Insurance revenue is growing year over year.")
        elif revenue_yoy < 0:
            score -= 6; warnings.append("Insurance revenue declined year over year.")

    if revenue_3y is not None:
        if revenue_3y >= 5:
            score += 7; positives.append("Multi-year revenue growth is healthy.")
        elif revenue_3y < 0:
            score -= 6; warnings.append("Multi-year revenue trend is negative.")

    if net_income_yoy is not None:
        if net_income_yoy >= 10:
            score += 8; positives.append("Net income is growing strongly.")
        elif net_income_yoy < -10:
            score -= 7; warnings.append("Net income declined materially year over year.")

    if roa is not None:
        if roa >= 2.0:
            score += 8; positives.append("Return on assets is strong for an insurer.")
        elif roa >= 1.0:
            score += 4; positives.append("Return on assets is healthy for an insurer.")
        elif roa < 0.3:
            score -= 5; warnings.append("Return on assets is weak for an insurer.")

    if roe is not None:
        if roe >= 15:
            score += 8; positives.append("Return on equity is strong.")
        elif roe >= 9:
            score += 4; positives.append("Return on equity is healthy.")
        elif roe < 5:
            score -= 5; warnings.append("Return on equity is weak.")

    if equity_ratio is not None:
        if equity_ratio >= 10:
            score += 5; positives.append("Equity provides a meaningful capital cushion.")
        elif equity_ratio < 4:
            score -= 5; warnings.append("Equity is thin relative to total assets.")

    score = max(0, min(95, round(score)))
    label = "Elite" if score >= 90 else "Strong" if score >= 75 else "Solid" if score >= 60 else "Mixed" if score >= 45 else "Weak"
    return {
        "score": score,
        "label": label,
        "positives": positives[:5],
        "warnings": warnings[:5],
    }


def build_financial_health_score(latest, growth):
    score = 50
    positives = []
    warnings = []

    revenue_yoy = growth.get("revenue_yoy")
    revenue_3y = growth.get("revenue_3y_cagr")
    net_income_yoy = growth.get("net_income_yoy")
    fcf_yoy = growth.get("free_cash_flow_yoy")

    gross_margin = latest.get("gross_margin")
    operating_margin = latest.get("operating_margin")
    net_margin = latest.get("net_margin")
    fcf_margin = latest.get("fcf_margin")
    fcf_conversion = latest.get("fcf_conversion")
    debt_to_assets = latest.get("debt_to_assets")
    cash_to_debt = latest.get("cash_to_debt")
    liabilities_to_assets = latest.get("liabilities_to_assets")
    roa = latest.get("return_on_assets")
    roe = latest.get("return_on_equity")

    if revenue_yoy is not None:
        if revenue_yoy >= 15:
            score += 10
            positives.append("Revenue is growing rapidly year over year.")
        elif revenue_yoy >= 5:
            score += 6
            positives.append("Revenue is growing at a healthy pace.")
        elif revenue_yoy < 0:
            score -= 8
            warnings.append("Revenue declined year over year.")

    if revenue_3y is not None:
        if revenue_3y >= 12:
            score += 8
            positives.append("Multi-year revenue growth is strong.")
        elif revenue_3y < 0:
            score -= 7
            warnings.append("Multi-year revenue trend is negative.")

    if net_income_yoy is not None:
        if net_income_yoy >= 15:
            score += 8
            positives.append("Net income is growing quickly.")
        elif net_income_yoy < 0:
            score -= 8
            warnings.append("Net income declined year over year.")

    if fcf_yoy is not None:
        if fcf_yoy >= 10:
            score += 7
            positives.append("Free cash flow is expanding.")
        elif fcf_yoy < 0:
            score -= 6
            warnings.append("Free cash flow declined year over year.")

    if gross_margin is not None:
        if gross_margin >= 50:
            score += 7
            positives.append("Gross margins are very strong.")
        elif gross_margin < 20:
            score -= 5
            warnings.append("Gross margins are relatively thin.")

    if operating_margin is not None:
        if operating_margin >= 25:
            score += 7
            positives.append("Operating profitability is strong.")
        elif operating_margin < 8:
            score -= 6
            warnings.append("Operating margin is weak.")

    if net_margin is not None:
        if net_margin >= 20:
            score += 6
            positives.append("Net margin is strong.")
        elif net_margin < 5:
            score -= 5
            warnings.append("Net margin is low.")

    if fcf_margin is not None:
        if fcf_margin >= 15:
            score += 7
            positives.append("Free cash flow margin is strong.")
        elif fcf_margin < 3:
            score -= 6
            warnings.append("Free cash flow margin is low.")

    if fcf_conversion is not None:
        if fcf_conversion >= 80:
            score += 6
            positives.append("Earnings convert well into free cash flow.")
        elif fcf_conversion < 40:
            score -= 6
            warnings.append("Earnings are not converting strongly into free cash flow.")

    if debt_to_assets is not None:
        if debt_to_assets <= 25:
            score += 5
            positives.append("Debt load appears manageable relative to assets.")
        elif debt_to_assets >= 60:
            score -= 8
            warnings.append("Debt is high relative to assets.")

    if cash_to_debt is not None:
        if cash_to_debt >= 1:
            score += 5
            positives.append("Cash covers total debt.")
        elif cash_to_debt < 0.25:
            score -= 5
            warnings.append("Cash coverage of debt is low.")

    if liabilities_to_assets is not None and liabilities_to_assets >= 85:
        score -= 4
        warnings.append("Liabilities are high relative to assets.")

    if roa is not None:
        if roa >= 10:
            score += 5
            positives.append("Return on assets is strong.")
        elif roa < 3:
            score -= 4
            warnings.append("Return on assets is weak.")

    if roe is not None:
        if roe >= 20:
            score += 4
            positives.append("Return on equity is strong.")

    # Avoid implying "perfect company." This score is a financial-quality signal,
    # not a full investment rating. Cap at 95 unless we later include TTM,
    # quarterly trend, valuation, and segment-level data.
    score = max(0, min(95, round(score)))

    if score >= 90:
        label = "Elite"
    elif score >= 75:
        label = "Strong"
    elif score >= 60:
        label = "Solid"
    elif score >= 45:
        label = "Mixed"
    else:
        label = "Weak"

    return {
        "score": score,
        "label": label,
        "positives": positives[:5],
        "warnings": warnings[:5],
    }

def build_sec_financials_payload(ticker, cik, companyfacts):
    taxonomy = get_reporting_taxonomy(companyfacts)
    analysis_profile = get_financial_analysis_profile(companyfacts, ticker=ticker)
    bank_profile = analysis_profile == "financial_institution"
    insurance_profile = analysis_profile == "insurance_company"
    real_estate_profile = analysis_profile == "real_estate_company"
    nonindustrial_profile = bank_profile or insurance_profile or real_estate_profile

    if taxonomy == "ifrs-full":
        concept_map = {
            "revenue": ["Revenue", "RevenueFromContractsWithCustomers"],
            "gross_profit": ["GrossProfit"],
            "cost_of_revenue": ["CostOfSales"],
            "operating_income": ["ProfitLossFromOperatingActivities", "OperatingProfitLoss"],
            "net_income": ["ProfitLoss", "ProfitLossAttributableToOwnersOfParent"],
            "operating_cash_flow": ["CashFlowsFromUsedInOperatingActivities"],
            "capex": ["PurchaseOfPropertyPlantAndEquipment", "PaymentsToAcquirePropertyPlantAndEquipment"],
            "assets": ["Assets"],
            "liabilities": ["Liabilities"],
            "equity": ["Equity", "EquityAttributableToOwnersOfParent"],
            "temporary_equity": [],
            "cash": ["CashAndCashEquivalents"],
            "debt": ["Borrowings", "NoncurrentBorrowings"],
            "current_debt": ["CurrentBorrowings"],
            "long_term_debt": ["NoncurrentBorrowings"],
            "shares": ["WeightedAverageNumberOfSharesOutstanding", "WeightedAverageNumberOfDilutedSharesOutstanding"],
        }
    else:
        concept_map = {
            "revenue": [
                "RevenueFromContractWithCustomerExcludingAssessedTax",
                "RevenueFromContractWithCustomerIncludingAssessedTax",
                "SalesRevenueNet", "SalesRevenueGoodsNet", "SalesRevenueServicesNet",
                "SalesRevenueGoodsGross", "SalesRevenueServicesGross", "NetSales",
                "SalesRevenueGoodsServicesNet", "Revenues", "RevenuesNetOfInterestExpense",
                "PremiumsEarnedNet", "PremiumsEarned", "InsurancePremiumsRevenue",
                "InsuranceRevenue", "OperatingLeasesIncomeStatementLeaseRevenue",
                "RentalIncome", "RentalRevenue", "RealEstateRevenueNet",
            ],
            "gross_profit": ["GrossProfit"],
            "cost_of_revenue": [
                "CostOfRevenue", "CostOfGoodsAndServicesSold", "CostOfGoodsSold",
                "CostOfGoodsAndServiceExcludingDepreciationDepletionAndAmortization",
                "CostOfRevenueExcludingDepreciationDepletionAndAmortization",
                "CostOfGoodsAndServicesSoldDepreciationDepletionAndAmortization",
                "CostOfSales", "CostOfSalesRevenue",
                "CostOfGoodsSoldExcludingDepreciationDepletionAndAmortization",
            ],
            "operating_income": ["OperatingIncomeLoss"],
            "net_income": ["NetIncomeLoss", "ProfitLoss"],
            "operating_cash_flow": ["NetCashProvidedByUsedInOperatingActivities"],
            "capex": ["PaymentsToAcquirePropertyPlantAndEquipment", "PaymentsToAcquirePropertyAndEquipment", "PaymentsToAcquireProductiveAssets"],
            "assets": ["Assets"],
            "liabilities": ["Liabilities"],
            "equity": ["StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest", "StockholdersEquity"],
            "temporary_equity": [
                "TemporaryEquityCarryingAmountIncludingPortionAttributableToNoncontrollingInterests",
                "TemporaryEquityCarryingAmount",
                "RedeemableNoncontrollingInterestEquityCarryingAmount",
                "RedeemableNoncontrollingInterestEquityCommonCarryingAmount",
                "RedeemableNoncontrollingInterestEquityOtherCarryingAmount",
                "RedeemableNoncontrollingInterestEquityPreferredCarryingAmount",
                "RedeemablePreferredStockCarryingAmount",
                "TemporaryEquityCarryingAmountAttributableToParent",
                "TemporaryEquityCarryingAmountAttributableToNoncontrollingInterest",
            ],
            "cash": ["CashAndCashEquivalentsAtCarryingValue", "CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents"],
            "debt": ["LongTermDebtAndFinanceLeaseObligations", "LongTermDebtAndFinanceLeaseObligationsCurrentAndNoncurrent", "LongTermDebt"],
            "current_debt": ["LongTermDebtAndFinanceLeaseObligationsCurrent", "LongTermDebtCurrent", "ShortTermBorrowings", "ShortTermDebt"],
            "long_term_debt": ["LongTermDebtAndFinanceLeaseObligationsNoncurrent", "LongTermDebtNoncurrent", "LongTermDebt"],
            # Prefer annual weighted-average shares for per-share calculations.
            # EntityCommonStockSharesOutstanding is a point-in-time cover-page fact
            # and can be dated after the fiscal year end.
            "shares": ["WeightedAverageNumberOfDilutedSharesOutstanding", "WeightedAverageNumberOfSharesOutstandingBasic", "EntityCommonStockSharesOutstanding"],
        }


    # Additional standardized facts that can materially improve the Financials
    # tab when issuers disclose them. Missing facts remain None; we do not
    # synthesize values simply to fill cards.
    if taxonomy == "ifrs-full":
        concept_map.update({
            "pretax_income": ["ProfitLossBeforeTax"],
            "income_tax_expense": ["IncomeTaxExpenseContinuingOperations", "IncomeTaxExpense"],
            "interest_expense": ["FinanceCosts"],
            "depreciation_amortization": ["DepreciationAndAmortisationExpense", "DepreciationExpense", "AmortisationExpense"],
            "r_and_d": ["ResearchAndDevelopmentExpense"],
            "sga": ["AdministrativeExpense", "SellingAndDistributionExpense"],
            "stock_based_comp": ["ShareBasedPaymentExpense"],
            "eps_basic": ["BasicEarningsLossPerShare"],
            "eps_diluted": ["DilutedEarningsLossPerShare"],
            "current_assets": ["CurrentAssets"],
            "current_liabilities": ["CurrentLiabilities"],
            "accounts_receivable": ["TradeAndOtherCurrentReceivables", "TradeReceivables"],
            "inventory": ["Inventories"],
            "ppe": ["PropertyPlantAndEquipment"],
            "goodwill": ["Goodwill"],
            "intangibles": ["IntangibleAssetsOtherThanGoodwill"],
            "accounts_payable": ["TradeAndOtherCurrentPayables", "TradePayables"],
            "retained_earnings": ["RetainedEarnings"],
            "deferred_revenue": ["ContractLiabilities"],
            "buybacks": ["PaymentsToAcquireOrRedeemEntitysShares"],
            "dividends_paid": ["DividendsPaid"],
            "acquisitions": ["CashFlowsUsedInObtainingControlOfSubsidiariesOrOtherBusinesses"],
        })
    else:
        concept_map.update({
            "pretax_income": [
                "IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest",
                "IncomeLossFromContinuingOperationsBeforeIncomeTaxesMinorityInterestAndIncomeLossFromEquityMethodInvestments",
                "IncomeLossFromContinuingOperationsBeforeIncomeTaxes",
            ],
            "income_tax_expense": ["IncomeTaxExpenseBenefit"],
            "interest_expense": ["InterestExpenseNonOperating", "InterestExpenseDebt", "InterestExpense"],
            "depreciation_amortization": [
                "DepreciationDepletionAndAmortization",
                "DepreciationDepletionAndAmortizationPropertyPlantAndEquipment",
                "Depreciation",
            ],
            "r_and_d": ["ResearchAndDevelopmentExpense"],
            "sga": ["SellingGeneralAndAdministrativeExpense", "GeneralAndAdministrativeExpense", "SellingAndMarketingExpense"],
            "stock_based_comp": ["ShareBasedCompensation", "AllocatedShareBasedCompensationExpense"],
            "eps_basic": ["EarningsPerShareBasic"],
            "eps_diluted": ["EarningsPerShareDiluted"],
            "current_assets": ["AssetsCurrent"],
            "current_liabilities": ["LiabilitiesCurrent"],
            "accounts_receivable": ["AccountsReceivableNetCurrent", "AccountsNotesAndLoansReceivableNetCurrent"],
            "inventory": ["InventoryNet"],
            "ppe": ["PropertyPlantAndEquipmentNet"],
            "goodwill": ["Goodwill"],
            "intangibles": ["FiniteLivedIntangibleAssetsNet", "IndefiniteLivedIntangibleAssetsExcludingGoodwill", "IntangibleAssetsNetExcludingGoodwill"],
            "accounts_payable": ["AccountsPayableCurrent"],
            "retained_earnings": ["RetainedEarningsAccumulatedDeficit"],
            "deferred_revenue": ["ContractWithCustomerLiability", "DeferredRevenue"],
            "buybacks": ["PaymentsForRepurchaseOfCommonStock", "PaymentsForRepurchaseOfEquity"],
            "dividends_paid": ["PaymentsOfDividends", "PaymentsOfDividendsCommonStock"],
            "acquisitions": ["PaymentsToAcquireBusinessesNetOfCashAcquired", "PaymentsToAcquireBusinessesGross"],

            # Insurance-specific standardized facts.
            "insurance_premiums": ["PremiumsEarnedNet", "PremiumsEarned", "InsurancePremiumsRevenue", "InsuranceRevenue"],
            "net_investment_income": ["InvestmentIncomeNet", "InvestmentIncomeInterestAndDividend"],
            "insurance_claims_benefits": [
                "PolicyholderBenefitsAndClaimsExpense",
                "PropertyCasualtyInsuranceClaimsAndClaimsAdjustmentExpense",
                "ClaimsAndClaimsAdjustmentExpense",
                "BenefitsLossesAndExpenses",
            ],
            "policyholder_reserves": [
                "PolicyholderBenefitsAndClaimsPayable",
                "FuturePolicyBenefits",
                "PropertyCasualtyInsuranceClaimsAndClaimsAdjustmentExpenseReserves",
                "ClaimsAndClaimsAdjustmentExpenseReserves",
            ],
            "deferred_policy_acquisition_costs": ["DeferredPolicyAcquisitionCosts"],

            # REIT / real-estate-specific standardized facts.
            "real_estate_investments": [
                "RealEstateInvestmentPropertyNet",
                "RealEstateInvestmentsNet",
                "RealEstateInvestments",
                "InvestmentPropertyNet",
            ],
            "rental_revenue": [
                "OperatingLeasesIncomeStatementLeaseRevenue",
                "RentalIncome",
                "RentalRevenue",
                "RealEstateRevenueNet",
            ],
            "gain_loss_real_estate_sales": ["GainLossOnSaleOfRealEstate", "GainLossOnSaleOfPropertyPlantEquipment"],
        })

    reporting_currency = _preferred_reporting_currency(
        companyfacts,
        [concept_map["revenue"], concept_map["net_income"], concept_map["assets"]],
    ) or "USD"

    picked_sets = defaultdict(set)
    instant_annual_keys = {
        "assets", "liabilities", "equity", "temporary_equity", "cash", "debt",
        "current_debt", "long_term_debt", "current_assets", "current_liabilities",
        "accounts_receivable", "inventory", "ppe", "goodwill", "intangibles",
        "accounts_payable", "retained_earnings", "deferred_revenue",
        "policyholder_reserves", "deferred_policy_acquisition_costs",
        "real_estate_investments",
    }
    per_share_annual_keys = {"eps_basic", "eps_diluted"}
    annual_candidates = {}

    for key, concepts in concept_map.items():
        if key == "shares":
            rows = _annual_candidates_for_concepts(
                companyfacts,
                concepts,
                shares=True,
                instant=False,
            )
        elif key in per_share_annual_keys:
            rows = _annual_candidates_for_concepts(
                companyfacts,
                concepts,
                preferred_currency=reporting_currency,
                per_share=True,
                instant=False,
            )
        else:
            rows = _annual_candidates_for_concepts(
                companyfacts,
                concepts,
                preferred_currency=reporting_currency,
                instant=key in instant_annual_keys,
            )
        annual_candidates[key] = rows

    bank_candidates = {}
    if bank_profile:
        bank_instant_keys = {"deposits", "loans", "allowance_for_credit_losses"}
        for key, concepts in BANK_CONCEPT_MAP.items():
            bank_candidates[key] = _annual_candidates_for_concepts(
                companyfacts,
                concepts,
                preferred_currency=reporting_currency,
                instant=key in bank_instant_keys,
            )

    anchor_periods = _annual_anchor_periods(
        companyfacts,
        concept_map,
        preferred_currency=reporting_currency,
        max_periods=6,
    )

    yearly = []

    for anchor_end in anchor_periods:
        try:
            year = int(str(anchor_end)[:4])
        except Exception:
            continue

        item = {
            "year": year,
            "period_end": anchor_end,
            "reporting_currency": reporting_currency,
        }

        # Select every annual statement item against the same fiscal-year end.
        # Revenue is special: multiple standard tags often represent component
        # sales alongside the consolidated total, so choose the largest positive
        # same-period candidate instead of blindly taking concept priority.
        for key, candidates in annual_candidates.items():
            if key in {"assets", "liabilities", "equity", "temporary_equity"}:
                continue

            match = _pick_candidate_for_anchor(
                candidates,
                anchor_end,
                prefer_largest_positive=(key == "revenue"),
            )

            # Point-in-time common shares are a last-resort fallback when an
            # issuer does not expose annual weighted-average share facts.
            if key == "shares" and match is None:
                instant_share_candidates = _annual_candidates_for_concepts(
                    companyfacts,
                    concept_map["shares"],
                    shares=True,
                    instant=True,
                )
                match = _pick_candidate_for_anchor(instant_share_candidates, anchor_end)

            item[key] = match.get("value") if match else None
            item[f"{key}_frame"] = match.get("frame") if match else None
            item[f"{key}_end"] = match.get("end") if match else None
            item[f"{key}_concept"] = match.get("concept") if match else None
            if match and match.get("concept"):
                picked_sets[key].add(match.get("concept"))

        balance = _select_annual_balance_triplet(
            companyfacts,
            concept_map,
            anchor_end,
            preferred_currency=reporting_currency,
        )
        for key in ("assets", "liabilities", "equity", "temporary_equity"):
            row = balance.get(f"{key}_row")
            item[key] = balance.get(key)
            source = balance.get(f"{key}_source")
            item[f"{key}_end"] = (
                row.get("end") if row and source == "reported"
                else anchor_end if balance.get(key) is not None else None
            )
            item[f"{key}_frame"] = row.get("frame") if row else None
            item[f"{key}_concept"] = (
                row.get("concept") if row and source == "reported"
                else source
            )
            if row and row.get("concept"):
                picked_sets[key].add(row.get("concept"))

        item["liabilities_source"] = balance.get("liabilities_source")
        item["equity_source"] = balance.get("equity_source")
        item["temporary_equity_source"] = balance.get("temporary_equity_source")

        for key, candidates in bank_candidates.items():
            match = _pick_candidate_for_anchor(candidates, anchor_end)
            item[key] = match.get("value") if match else None
            item[f"{key}_end"] = match.get("end") if match else None
            item[f"{key}_concept"] = match.get("concept") if match else None
            if match and match.get("concept"):
                picked_sets[key].add(match.get("concept"))

        revenue = item.get("revenue")
        gross_profit = item.get("gross_profit")
        cost_of_revenue = item.get("cost_of_revenue")
        operating_income = item.get("operating_income")
        net_income = item.get("net_income")
        operating_cash_flow = item.get("operating_cash_flow")
        capex = item.get("capex")
        assets = item.get("assets")
        liabilities = item.get("liabilities")
        equity = item.get("equity")

        # Bank revenue fallback: net interest income + noninterest income.
        if bank_profile and revenue is None:
            nii = item.get("net_interest_income")
            noninterest = item.get("noninterest_income")
            if nii is not None and noninterest is not None:
                revenue = float(nii) + float(noninterest)
                item["revenue"] = revenue
                item["revenue_end"] = anchor_end
                item["revenue_source"] = "net_interest_income_plus_noninterest_income"

        # Industrial revenue fallback from gross profit + cost of revenue. Both
        # components must be from the same anchored annual period.
        if not bank_profile and revenue is None and gross_profit is not None and cost_of_revenue is not None:
            gp_end = item.get("gross_profit_end")
            cor_end = item.get("cost_of_revenue_end")
            same_period = gp_end and cor_end and gp_end == cor_end == anchor_end
            try:
                fallback_revenue = float(gross_profit) + float(cost_of_revenue)
                if (
                    same_period
                    and fallback_revenue > float(gross_profit)
                    and (operating_income is None or fallback_revenue > float(operating_income))
                    and (net_income is None or fallback_revenue > float(net_income))
                ):
                    revenue = fallback_revenue
                    item["revenue"] = revenue
                    item["revenue_end"] = anchor_end
                    item["revenue_source"] = "gross_profit_plus_cost_of_revenue"
                else:
                    item["revenue_source"] = "missing_or_failed_sanity_check"
            except Exception:
                item["revenue_source"] = "fallback_error"
        elif revenue is not None and not item.get("revenue_source"):
            item["revenue_source"] = "reported_total_candidate"

        reported_debt = item.get("debt")
        current_debt = item.get("current_debt")
        long_term_debt = item.get("long_term_debt")
        debt_parts = [float(x) for x in [current_debt, long_term_debt] if x is not None]
        debt = sum(debt_parts) if debt_parts else reported_debt
        item["debt"] = debt
        item["debt_source"] = (
            "current_debt_plus_long_term_debt"
            if debt_parts
            else "reported_debt_or_long_term_debt" if reported_debt is not None else None
        )

        # Traditional industrial FCF/cash-conversion logic is not a primary
        # quality measure for banks, insurers, or REIT-style real-estate firms.
        item["free_cash_flow"] = None if nonindustrial_profile else (
            operating_cash_flow - capex
            if operating_cash_flow is not None and capex is not None
            else None
        )
        item["gross_margin"] = None if nonindustrial_profile else safe_pct(gross_profit, revenue)
        item["operating_margin"] = None if nonindustrial_profile else safe_pct(operating_income, revenue)
        item["net_margin"] = safe_pct(net_income, revenue)
        item["fcf_margin"] = None if nonindustrial_profile else safe_pct(item.get("free_cash_flow"), revenue)
        item["fcf_conversion"] = None if nonindustrial_profile else safe_pct(item.get("free_cash_flow"), net_income)
        item["capex_intensity"] = None if nonindustrial_profile else safe_pct(capex, revenue)
        item["ocf_margin"] = None if nonindustrial_profile else safe_pct(operating_cash_flow, revenue)
        item["income_quality_ratio"] = None if nonindustrial_profile else safe_ratio(operating_cash_flow, net_income)

        item["cash_to_debt"] = None if (bank_profile or insurance_profile) else safe_ratio(item.get("cash"), debt)
        item["net_debt"] = None if (bank_profile or insurance_profile) else (
            debt - item.get("cash") if debt is not None and item.get("cash") is not None else None
        )
        item["net_cash"] = None if (bank_profile or insurance_profile) else (
            item.get("cash") - debt if item.get("cash") is not None and debt is not None else None
        )
        item["debt_to_equity"] = None if (bank_profile or insurance_profile) else safe_ratio(debt, equity)
        item["debt_to_assets"] = None if (bank_profile or insurance_profile) else safe_pct(debt, assets)
        item["cash_to_assets"] = safe_pct(item.get("cash"), assets)
        item["liabilities_to_assets"] = safe_pct(liabilities, assets)
        item["equity_ratio"] = safe_pct(equity, assets)
        item["asset_turnover"] = safe_ratio(revenue, assets)
        item["revenue_per_share"] = safe_ratio(revenue, item.get("shares"))
        item["fcf_per_share"] = None if nonindustrial_profile else safe_ratio(item.get("free_cash_flow"), item.get("shares"))
        item["return_on_assets"] = safe_pct(net_income, assets)
        item["return_on_equity"] = safe_pct(net_income, equity)
        item["book_value_per_share"] = safe_ratio(equity, item.get("shares"))
        item["effective_tax_rate"] = safe_pct(item.get("income_tax_expense"), item.get("pretax_income"))
        item["loans_to_deposits"] = safe_pct(item.get("loans"), item.get("deposits")) if bank_profile else None
        item["allowance_to_loans"] = safe_pct(item.get("allowance_for_credit_losses"), item.get("loans")) if bank_profile else None

        # This is deliberately labeled a proxy. Official NAREIT FFO/AFFO can
        # require issuer-specific adjustments not consistently standardized in
        # Companyfacts.
        item["ffo_proxy"] = (
            float(item.get("net_income"))
            + float(item.get("depreciation_amortization"))
            - float(item.get("gain_loss_real_estate_sales") or 0)
            if real_estate_profile
            and item.get("net_income") is not None
            and item.get("depreciation_amortization") is not None
            else None
        )
        yearly.append(item)

    picked = {key: sorted(values) for key, values in picked_sets.items()}

    latest = yearly[0] if yearly else {}
    previous = yearly[1] if len(yearly) > 1 else {}
    growth = {
        "revenue_yoy": pct_growth(latest.get("revenue"), previous.get("revenue")),
        "gross_profit_yoy": None if nonindustrial_profile else pct_growth(latest.get("gross_profit"), previous.get("gross_profit")),
        "operating_income_yoy": None if nonindustrial_profile else pct_growth(latest.get("operating_income"), previous.get("operating_income")),
        "net_income_yoy": pct_growth(latest.get("net_income"), previous.get("net_income")),
        "operating_cash_flow_yoy": None if nonindustrial_profile else pct_growth(latest.get("operating_cash_flow"), previous.get("operating_cash_flow")),
        "free_cash_flow_yoy": None if nonindustrial_profile else pct_growth(latest.get("free_cash_flow"), previous.get("free_cash_flow")),
    }

    latest_revenue, revenue_3y_ago, revenue_5y_history = get_year_value(yearly,0,"revenue"), get_year_value(yearly,3,"revenue"), get_year_value(yearly,5,"revenue")
    latest_net_income, net_income_3y_ago, net_income_5y_history = get_year_value(yearly,0,"net_income"), get_year_value(yearly,3,"net_income"), get_year_value(yearly,5,"net_income")
    latest_fcf, fcf_3y_ago, fcf_5y_history = get_year_value(yearly,0,"free_cash_flow"), get_year_value(yearly,3,"free_cash_flow"), get_year_value(yearly,5,"free_cash_flow")
    latest_ocf, ocf_3y_ago, ocf_5y_history = get_year_value(yearly,0,"operating_cash_flow"), get_year_value(yearly,3,"operating_cash_flow"), get_year_value(yearly,5,"operating_cash_flow")
    growth.update({
        "revenue_3y_cagr": cagr(latest_revenue, revenue_3y_ago, 3),
        "revenue_5y_cagr": cagr(latest_revenue, revenue_5y_history, 5),
        "revenue_5y_history_cagr": cagr(latest_revenue, revenue_5y_history, 5),
        "net_income_3y_cagr": cagr(latest_net_income, net_income_3y_ago, 3),
        "net_income_5y_cagr": cagr(latest_net_income, net_income_5y_history, 5),
        "net_income_5y_history_cagr": cagr(latest_net_income, net_income_5y_history, 5),
        "free_cash_flow_3y_cagr": None if nonindustrial_profile else cagr(latest_fcf, fcf_3y_ago, 3),
        "free_cash_flow_5y_cagr": None if nonindustrial_profile else cagr(latest_fcf, fcf_5y_history, 5),
        "free_cash_flow_5y_history_cagr": None if nonindustrial_profile else cagr(latest_fcf, fcf_5y_history, 5),
        "operating_cash_flow_3y_cagr": None if nonindustrial_profile else cagr(latest_ocf, ocf_3y_ago, 3),
        "operating_cash_flow_5y_cagr": None if nonindustrial_profile else cagr(latest_ocf, ocf_5y_history, 5),
        "operating_cash_flow_5y_history_cagr": None if nonindustrial_profile else cagr(latest_ocf, ocf_5y_history, 5),
    })

    if bank_profile:
        financial_health = build_bank_financial_health_score(latest, growth)
    elif insurance_profile:
        financial_health = build_insurance_financial_health_score(latest, growth)
    elif real_estate_profile:
        financial_health = build_real_estate_financial_health_score(latest, growth)
    else:
        financial_health = build_financial_health_score(latest, growth)
    coverage_fields = ["revenue", "net_income", "assets", "liabilities", "equity"]
    available_core = sum(1 for field in coverage_fields if latest.get(field) is not None)

    clean_ticker = str(ticker or "").upper().strip()
    if available_core >= 4 and len(yearly) >= 3:
        coverage_status = "full"
    elif available_core >= 2 or yearly:
        coverage_status = "partial"
    elif clean_ticker in SEC_NEW_REGISTRANT_TICKER_FALLBACKS:
        coverage_status = "new_registrant"
    else:
        coverage_status = "unavailable"

    return {
        "ticker": ticker,
        "cik": cik,
        "entity_name": companyfacts.get("entityName"),
        "source": "SEC companyfacts",
        "sec_freshness": companyfacts.get("_bullionaire_sec_freshness", []),
        "sec_history": companyfacts.get("_bullionaire_sec_history", []),
        "sec_metadata": companyfacts.get("_bullionaire_sec_metadata", {}),
        "taxonomy": taxonomy,
        "reporting_currency": reporting_currency,
        "analysis_profile": analysis_profile,
        "coverage_status": coverage_status,
        "concepts_used": picked,
        "annual": yearly,
        "growth": growth,
        "financial_health": financial_health,
        "coverage_inventory": {
            "available_annual_fields": sorted([
                key for key, value in latest.items()
                if value is not None
                and not key.endswith(("_end", "_frame", "_concept", "_source"))
            ]),
            "missing_core_fields": [
                field for field in coverage_fields
                if latest.get(field) is None
            ],
        },
    }
def is_route_rate_limited(request, route_key, limit, window_seconds):
    client_ip = get_client_ip(request)
    key = f"{client_ip}:{route_key}"
    now = time.time()
    window_start = now - window_seconds

    with RATE_LIMIT_LOCK:
        dq = RATE_LIMIT_STORAGE[key]

        while dq and dq[0] < window_start:
            dq.popleft()

        if len(dq) >= limit:
            return True

        dq.append(now)

        if len(RATE_LIMIT_STORAGE) > RATE_LIMIT_STORAGE_MAX_KEYS:
            stale_cutoff = now - RATE_LIMIT_STORAGE_STALE_SECONDS
            stale_keys = [
                storage_key
                for storage_key, timestamps in RATE_LIMIT_STORAGE.items()
                if storage_key != key
                and (not timestamps or timestamps[-1] < stale_cutoff)
            ]
            for storage_key in stale_keys:
                RATE_LIMIT_STORAGE.pop(storage_key, None)

            overflow = len(RATE_LIMIT_STORAGE) - RATE_LIMIT_STORAGE_MAX_KEYS
            if overflow > 0:
                oldest_keys = sorted(
                    (
                        storage_key
                        for storage_key in RATE_LIMIT_STORAGE
                        if storage_key != key
                    ),
                    key=lambda storage_key: (
                        RATE_LIMIT_STORAGE[storage_key][-1]
                        if RATE_LIMIT_STORAGE[storage_key]
                        else 0.0
                    ),
                )
                for storage_key in oldest_keys[:overflow]:
                    RATE_LIMIT_STORAGE.pop(storage_key, None)

    return False
# =========================================================
# DB HELPERS
# =========================================================

def clean_row(row):
    if row is None:
        return None

    if isinstance(row, dict):
        return row

    if hasattr(row, "keys"):
        return {key: row[key] for key in row.keys()}

    return dict(row)


def parse_json_field(value):
    if not value:
        return None
    try:
        return json.loads(value)
    except Exception:
        return None

def add_min_max_filter(where_clauses, params, column_sql, min_val, max_val):
        if min_val is not None:
            where_clauses.append(f"{column_sql} >= %s")
            params.append(min_val)
        if max_val is not None:
            where_clauses.append(f"{column_sql} <= %s")
            params.append(max_val)

def safe_server_error_message():
        return {"error": "Internal server error."}

def get_polygon_json(path: str, params: Optional[dict] = None, timeout: int = 20):
    if not POLYGON_API_KEY:
        return None

    query = dict(params or {})
    query["apiKey"] = POLYGON_API_KEY

    url = f"{POLYGON_BASE_URL}{path}"

    try:
        response = polygon_session.get(url, params=query, timeout=timeout)
        response.raise_for_status()
        return response.json()
    except Exception as e:
        print(f"[POLYGON ERROR] {url} -> {e}")
        return None

def get_live_market_snapshot_cached():
    """Return one shared U.S. stock snapshot for all users for a short TTL."""
    now = time.time()
    with LIVE_MARKET_SNAPSHOT_CACHE_LOCK:
        cached_time = float(LIVE_MARKET_SNAPSHOT_CACHE.get("time") or 0.0)
        cached_data = LIVE_MARKET_SNAPSHOT_CACHE.get("data")
        if cached_data and now - cached_time < LIVE_MARKET_SNAPSHOT_CACHE_TTL_SECONDS:
            return cached_data

    # Serialize refreshes so a traffic burst produces one upstream request,
    # not one full-market snapshot request per browser.
    with LIVE_MARKET_SNAPSHOT_REFRESH_LOCK:
        now = time.time()
        with LIVE_MARKET_SNAPSHOT_CACHE_LOCK:
            cached_time = float(LIVE_MARKET_SNAPSHOT_CACHE.get("time") or 0.0)
            cached_data = LIVE_MARKET_SNAPSHOT_CACHE.get("data")
            if cached_data and now - cached_time < LIVE_MARKET_SNAPSHOT_CACHE_TTL_SECONDS:
                return cached_data

        snapshot = get_polygon_json(
            "/v2/snapshot/locale/us/markets/stocks/tickers",
            {"include_otc": "true"},
            timeout=60,
        )

        if snapshot and snapshot.get("tickers"):
            with LIVE_MARKET_SNAPSHOT_CACHE_LOCK:
                LIVE_MARKET_SNAPSHOT_CACHE["time"] = time.time()
                LIVE_MARKET_SNAPSHOT_CACHE["data"] = snapshot
            return snapshot

        # If the provider has a transient failure, serve the most recent cached
        # snapshot instead of stampeding the provider on every incoming request.
        with LIVE_MARKET_SNAPSHOT_CACHE_LOCK:
            return LIVE_MARKET_SNAPSHOT_CACHE.get("data")


def safe_float(value):
    try:
        if value is None:
            return None
        return float(value)
    except Exception:
        return None


def fetch_intraday_sparkline(ticker: str):
    for days_back in range(0, 5):
        target_date = (datetime.now() - timedelta(days=days_back)).date().isoformat()

        data = get_polygon_json(
            f"/v2/aggs/ticker/{ticker}/range/5/minute/{target_date}/{target_date}",
            {
                "adjusted": "true",
                "sort": "asc",
                "limit": 5000,
            },
            timeout=20,
        )

        if not data or not data.get("results"):
            continue

        bars = data["results"]
        closes = [bar.get("c") for bar in bars if bar.get("c") is not None]

        if not closes:
            continue

        first_close = closes[0]
        last_close = closes[-1]

        change_pct = None
        if first_close not in (None, 0):
            change_pct = ((last_close - first_close) / first_close) * 100

        return {
            "ticker": ticker,
            "points": closes,
            "change_pct": change_pct,
        }

    return {
        "ticker": ticker,
        "points": [],
        "change_pct": None,
    }

def fetch_intraday_sparkline_cached(ticker: str):
    clean_ticker = str(ticker or "").strip().upper()
    now = time.time()

    with SPARKLINE_CACHE_LOCK:
        cached = SPARKLINE_CACHE.get(clean_ticker)
        if cached and now - _cache_entry_time(cached) < SPARKLINE_CACHE_TTL_SECONDS:
            return cached.get("data")
        if cached:
            SPARKLINE_CACHE.pop(clean_ticker, None)

    data = fetch_intraday_sparkline(clean_ticker)
    with SPARKLINE_CACHE_LOCK:
        SPARKLINE_CACHE[clean_ticker] = {"time": now, "data": data}
        _prune_timed_cache_locked(
            SPARKLINE_CACHE,
            now,
            SPARKLINE_CACHE_TTL_SECONDS,
            SPARKLINE_CACHE_MAX_ENTRIES,
        )

    return data


def fetch_chart_data(ticker: str, range_key: str):
    range_map = {
        "1D": {"multiplier": 5, "timespan": "minute", "days": 1},
        "5D": {"multiplier": 30, "timespan": "minute", "days": 5},
        "1M": {"multiplier": 60, "timespan": "minute", "days": 30},
        "6M": {"multiplier": 1, "timespan": "day", "days": 180},
        "1Y": {"multiplier": 1, "timespan": "day", "days": 365},
        "5Y": {"multiplier": 1, "timespan": "week", "days": 365 * 5},
        "Max": {"multiplier": 1, "timespan": "month", "days": 365 * 20},
    }

    config = range_map.get(range_key, range_map["1D"])

    # Special handling for 1D so weekends/market holidays still show
    if range_key == "1D":
        for days_back in range(0, 5):
            target_date = (datetime.now() - timedelta(days=days_back)).date().isoformat()

            data = get_polygon_json(
                f"/v2/aggs/ticker/{ticker}/range/5/minute/{target_date}/{target_date}",
                {
                    "adjusted": "true",
                    "sort": "asc",
                    "limit": 5000,
                },
                timeout=25,
            )

            if not data or not data.get("results"):
                continue

            points = []
            for bar in data["results"]:
                timestamp = bar.get("t")
                open_price = bar.get("o")
                high_price = bar.get("h")
                low_price = bar.get("l")
                close_price = bar.get("c")
                volume = bar.get("v")

                if (
                    timestamp is None
                    or open_price is None
                    or high_price is None
                    or low_price is None
                    or close_price is None
                ):
                    continue

                points.append({
                    "time": timestamp,
                    "open": open_price,
                    "high": high_price,
                    "low": low_price,
                    "close": close_price,
                    "volume": volume,
                })

            if points:
                return {
                    "ticker": ticker,
                    "range": range_key,
                    "points": points,
                }

        return {
            "ticker": ticker,
            "range": range_key,
            "points": [],
        }

    end_date = datetime.now().date()
    start_date = end_date - timedelta(days=config["days"])

    data = get_polygon_json(
        f"/v2/aggs/ticker/{ticker}/range/{config['multiplier']}/{config['timespan']}/{start_date.isoformat()}/{end_date.isoformat()}",
        {
            "adjusted": "true",
            "sort": "asc",
            "limit": 50000,
        },
        timeout=25,
    )

    if not data or not data.get("results"):
        return {
            "ticker": ticker,
            "range": range_key,
            "points": [],
        }

    points = []
    for bar in data["results"]:
        timestamp = bar.get("t")
        open_price = bar.get("o")
        high_price = bar.get("h")
        low_price = bar.get("l")
        close_price = bar.get("c")
        volume = bar.get("v")

        if (
            timestamp is None
            or open_price is None
            or high_price is None
            or low_price is None
            or close_price is None
        ):
            continue

        points.append({
            "time": timestamp,
            "open": open_price,
            "high": high_price,
            "low": low_price,
            "close": close_price,
            "volume": volume,
        })

    return {
        "ticker": ticker,
        "range": range_key,
        "points": points,
    }
def fetch_chart_data_cached(ticker: str, range_key: str):
    cache_key = f"{ticker.upper()}:{range_key}"
    now = time.time()

    with CHART_CACHE_LOCK:
        cached = CHART_CACHE.get(cache_key)

        if cached:
            cached_time = _cache_entry_time(cached)
            cached_data = cached.get("data")

            if cached_data and now - cached_time < CHART_CACHE_TTL_SECONDS:
                return cached_data
            CHART_CACHE.pop(cache_key, None)

    data = fetch_chart_data(ticker.upper(), range_key)

    if data and data.get("points"):
        with CHART_CACHE_LOCK:
            CHART_CACHE[cache_key] = {
                "time": now,
                "data": data,
            }
            _prune_timed_cache_locked(
                CHART_CACHE,
                now,
                CHART_CACHE_TTL_SECONDS,
                CHART_CACHE_MAX_ENTRIES,
            )

    return data

def normalize_chart_points(chart_response):
    points = chart_response.get("points", []) if isinstance(chart_response, dict) else []

    normalized = []

    for point in points:
        timestamp = point.get("time")
        close_price = point.get("close")

        if timestamp is None or close_price is None:
            continue

        normalized.append({
            "time": timestamp,
            "close": float(close_price),
        })

    return normalized


def calculate_max_drawdown(values):
    if not values:
        return 0

    peak = values[0]
    max_drawdown = 0

    for value in values:
        peak = max(peak, value)
        if peak != 0:
            drawdown = ((value - peak) / peak) * 100
            max_drawdown = min(max_drawdown, drawdown)

    return max_drawdown


def calculate_volatility(returns):
    if len(returns) < 2:
        return 0

    avg_return = sum(returns) / len(returns)
    variance = sum((r - avg_return) ** 2 for r in returns) / (len(returns) - 1)

    return math.sqrt(variance) * 100

def _sample_std(values):
    clean = [float(value) for value in values if value is not None and math.isfinite(float(value))]
    if len(clean) < 2:
        return None
    mean_value = sum(clean) / len(clean)
    variance = sum((value - mean_value) ** 2 for value in clean) / (len(clean) - 1)
    return math.sqrt(max(variance, 0.0))


def _safe_ratio(numerator, denominator):
    if numerator is None or denominator is None:
        return None
    if not math.isfinite(float(numerator)) or not math.isfinite(float(denominator)):
        return None
    if abs(float(denominator)) < 1e-12:
        return None
    return float(numerator) / float(denominator)


def calculate_backtest_quant_metrics(
    strategy_returns,
    benchmark_returns,
    max_drawdown,
    range_key,
):
    """
    Calculate standard risk-adjusted portfolio metrics from the same period
    return series used by the Bullionaire strategy backtest.

    Ratios are intentionally marked unavailable for 1D/5D because annualized
    risk ratios are not decision-useful over such short horizons. 1M is
    returned as a limited-sample estimate; 6M+ is treated as the normal view.
    """
    periods_per_year_map = {
        "1D": 252 * 78,       # 5-minute bars
        "5D": 252 * 13,       # 30-minute bars
        "1M": 252 * 6.5,      # hourly market bars
        "6M": 252,
        "1Y": 252,
        "5Y": 52,
    }
    periods_per_year = float(periods_per_year_map.get(range_key, 252))

    paired = [
        (float(strategy_return), float(benchmark_return))
        for strategy_return, benchmark_return in zip(strategy_returns, benchmark_returns)
        if strategy_return is not None
        and benchmark_return is not None
        and math.isfinite(float(strategy_return))
        and math.isfinite(float(benchmark_return))
    ]

    status = (
        "insufficient_history"
        if range_key in {"1D", "5D"}
        else "limited_sample"
        if range_key == "1M"
        else "standard"
    )

    base = {
        "status": status,
        "observations": len(paired),
        "periodsPerYear": periods_per_year,
        "riskFreeRateAnnual": 0.0,
        "annualizedReturn": None,
        "sharpeRatio": None,
        "sortinoRatio": None,
        "calmarRatio": None,
        "alpha": None,
        "beta": None,
        "informationRatio": None,
    }

    # Do not manufacture annualized institutional ratios from one or five days.
    if status == "insufficient_history" or len(paired) < 3:
        return base

    strategy = [row[0] for row in paired]
    benchmark = [row[1] for row in paired]
    n = len(strategy)

    # Zero is used as the default risk-free rate so the backtest remains
    # deterministic and does not depend on a stale external macro quote.
    risk_free_period = 0.0
    excess = [value - risk_free_period for value in strategy]
    mean_excess = sum(excess) / n

    strategy_std = _sample_std(excess)
    sharpe_ratio = (
        (mean_excess / strategy_std) * math.sqrt(periods_per_year)
        if strategy_std is not None and strategy_std > 1e-12
        else None
    )

    downside_squares = [min(0.0, value) ** 2 for value in excess]
    downside_deviation = math.sqrt(sum(downside_squares) / n) if downside_squares else None
    sortino_ratio = (
        (mean_excess / downside_deviation) * math.sqrt(periods_per_year)
        if downside_deviation is not None and downside_deviation > 1e-12
        else None
    )

    growth = 1.0
    geometric_valid = True
    for period_return in strategy:
        if 1.0 + period_return <= 0:
            geometric_valid = False
            break
        growth *= 1.0 + period_return

    if geometric_valid and growth > 0:
        annualized_return = growth ** (periods_per_year / n) - 1.0
    else:
        annualized_return = (sum(strategy) / n) * periods_per_year

    max_drawdown_fraction = abs(float(max_drawdown or 0.0)) / 100.0
    calmar_ratio = _safe_ratio(annualized_return, max_drawdown_fraction)

    mean_strategy = sum(strategy) / n
    mean_benchmark = sum(benchmark) / n
    benchmark_variance = sum((value - mean_benchmark) ** 2 for value in benchmark) / max(n - 1, 1)
    covariance = (
        sum(
            (strategy_value - mean_strategy) * (benchmark_value - mean_benchmark)
            for strategy_value, benchmark_value in paired
        )
        / max(n - 1, 1)
    )
    beta = _safe_ratio(covariance, benchmark_variance)

    alpha = None
    if beta is not None:
        alpha_period = mean_strategy - beta * mean_benchmark
        alpha = alpha_period * periods_per_year * 100.0

    active_returns = [strategy_value - benchmark_value for strategy_value, benchmark_value in paired]
    active_std = _sample_std(active_returns)
    information_ratio = (
        ((sum(active_returns) / n) / active_std) * math.sqrt(periods_per_year)
        if active_std is not None and active_std > 1e-12
        else None
    )

    def finite_or_none(value):
        return float(value) if value is not None and math.isfinite(float(value)) else None

    base.update({
        "annualizedReturn": finite_or_none(annualized_return * 100.0),
        "sharpeRatio": finite_or_none(sharpe_ratio),
        "sortinoRatio": finite_or_none(sortino_ratio),
        "calmarRatio": finite_or_none(calmar_ratio),
        "alpha": finite_or_none(alpha),
        "beta": finite_or_none(beta),
        "informationRatio": finite_or_none(information_ratio),
    })
    return base


def calculate_holding_volatility_from_prices(prices):
    if len(prices) < 3:
        return 0

    returns = []

    for i in range(1, len(prices)):
        previous_price = prices[i - 1]
        current_price = prices[i]

        if previous_price and current_price and previous_price > 0 and current_price > 0:
            returns.append((current_price / previous_price) - 1)

    return calculate_volatility(returns)
# =========================================================
# WHERE CLAUSE BUILDER
# =========================================================

def build_where_clause(
    search: Optional[str] = None,
    sector: Optional[str] = None,
    security_type: Optional[str] = None,
    tickers: Optional[str] = None,

    min_price: Optional[float] = None,
    max_price: Optional[float] = None,

    min_market_cap: Optional[float] = None,
    max_market_cap: Optional[float] = None,

    min_eps: Optional[float] = None,
    max_eps: Optional[float] = None,

min_pe: Optional[float] = None,
max_pe: Optional[float] = None,

min_peg: Optional[float] = None,
max_peg: Optional[float] = None,

min_ps: Optional[float] = None,
max_ps: Optional[float] = None,

min_dividend: Optional[float] = None,
max_dividend: Optional[float] = None,

    min_rsi: Optional[float] = None,
    max_rsi: Optional[float] = None,

    min_macd: Optional[float] = None,
    max_macd: Optional[float] = None,

    min_sma20: Optional[float] = None,
    max_sma20: Optional[float] = None,

    min_beta: Optional[float] = None,
    max_beta: Optional[float] = None,

    min_std_dev: Optional[float] = None,
    max_std_dev: Optional[float] = None,

    min_ebitda: Optional[float] = None,
    max_ebitda: Optional[float] = None,

    min_short_float: Optional[float] = None,
    max_short_float: Optional[float] = None,

    min_gross_profit: Optional[float] = None,
    max_gross_profit: Optional[float] = None,

    min_upside: Optional[float] = None,
    max_upside: Optional[float] = None,

    min_downside: Optional[float] = None,
    max_downside: Optional[float] = None,

    min_mean_target: Optional[float] = None,
    max_mean_target: Optional[float] = None,

    min_analysts: Optional[int] = None,
    max_analysts: Optional[int] = None,

        min_previous_close: Optional[float] = None,
        max_previous_close: Optional[float] = None,

        min_day_open: Optional[float] = None,
        max_day_open: Optional[float] = None,

        min_day_high: Optional[float] = None,
        max_day_high: Optional[float] = None,

        min_day_low: Optional[float] = None,
        max_day_low: Optional[float] = None,

        min_day_volume: Optional[float] = None,
        max_day_volume: Optional[float] = None,

        min_today_change: Optional[float] = None,
        max_today_change: Optional[float] = None,

        min_macd_signal: Optional[float] = None,
        max_macd_signal: Optional[float] = None,

        min_macd_histogram: Optional[float] = None,
        max_macd_histogram: Optional[float] = None,

        min_latest_dividend: Optional[float] = None,
        max_latest_dividend: Optional[float] = None,

        min_dividend_frequency: Optional[float] = None,
        max_dividend_frequency: Optional[float] = None,
):
    where_clauses = []
    params = []

    if search:
        clean_search = search.strip()
        company_search_term = f"%{clean_search}%"
        ticker_search_term = f"{clean_search}%"
        where_clauses.append(
            '(LOWER("Company Name") LIKE LOWER(%s) OR UPPER("Ticker") LIKE UPPER(%s))'
        )
        params.extend([company_search_term, ticker_search_term])

    if sector:
        where_clauses.append('LOWER("Sector") = LOWER(%s)')
        params.append(sector.strip())

    if security_type:
        where_clauses.append('UPPER("Type") = UPPER(%s)')
        params.append(security_type.strip())

    if tickers:
        ticker_list = [t.strip().upper() for t in tickers.split(",") if t.strip()]
        if ticker_list:
            placeholders = ",".join(["%s"] * len(ticker_list))
            where_clauses.append(f'UPPER("Ticker") IN ({placeholders})')
            params.extend(ticker_list)

    add_min_max_filter(where_clauses, params, 'CAST("Current Price" AS REAL)', min_price, max_price)
    add_min_max_filter(where_clauses, params, 'CAST("Market Cap" AS REAL)', min_market_cap, max_market_cap)
    add_min_max_filter(where_clauses, params, 'CAST("EPS (TTM)" AS REAL)', min_eps, max_eps)
    add_min_max_filter(where_clauses, params, 'CAST("P/E (TTM)" AS REAL)', min_pe, max_pe)
    add_min_max_filter(where_clauses, params, 'CAST("PEG Ratio" AS REAL)', min_peg, max_peg)
    add_min_max_filter(where_clauses, params, 'CAST("P/S Ratio" AS REAL)', min_ps, max_ps)
    add_min_max_filter(where_clauses, params, 'CAST("Dividend Yield" AS REAL)', min_dividend, max_dividend)
    add_min_max_filter(where_clauses, params, 'CAST("RSI" AS REAL)', min_rsi, max_rsi)
    add_min_max_filter(where_clauses, params, 'CAST("MACD" AS REAL)', min_macd, max_macd)
    add_min_max_filter(where_clauses, params, 'CAST("SMA 20" AS REAL)', min_sma20, max_sma20)

    add_min_max_filter(where_clauses, params, 'CAST("Beta" AS REAL)', min_beta, max_beta)
    add_min_max_filter(
        where_clauses,
        params,
        'CAST("Standard Deviation (1Y)" AS REAL)',
        min_std_dev,
        max_std_dev,
    )
    add_min_max_filter(where_clauses, params, 'CAST("EBITDA" AS REAL)', min_ebitda, max_ebitda)
    add_min_max_filter(where_clauses, params, 'CAST("Short %% of Float" AS REAL)', min_short_float, max_short_float)
    add_min_max_filter(where_clauses, params, 'CAST("Gross Profit" AS REAL)', min_gross_profit, max_gross_profit)
    add_min_max_filter(where_clauses, params, 'CAST("Analyst Upside" AS REAL)', min_upside, max_upside)
    add_min_max_filter(where_clauses, params, 'CAST("Analyst Downside" AS REAL)', min_downside, max_downside)
    add_min_max_filter(where_clauses, params, 'CAST("Mean Target" AS REAL)', min_mean_target, max_mean_target)
    add_min_max_filter(where_clauses, params, 'CAST("Number of Analysts" AS REAL)', min_analysts, max_analysts)

    add_min_max_filter(where_clauses, params, 'CAST("Previous Close" AS REAL)', min_previous_close, max_previous_close)
    add_min_max_filter(where_clauses, params, 'CAST("Day Open" AS REAL)', min_day_open, max_day_open)
    add_min_max_filter(where_clauses, params, 'CAST("Day High" AS REAL)', min_day_high, max_day_high)
    add_min_max_filter(where_clauses, params, 'CAST("Day Low" AS REAL)', min_day_low, max_day_low)
    add_min_max_filter(where_clauses, params, 'CAST("Day Volume" AS REAL)', min_day_volume, max_day_volume)
    add_min_max_filter(where_clauses, params, 'CAST("Today Change %%" AS REAL)', min_today_change, max_today_change)
    add_min_max_filter(where_clauses, params, 'CAST("MACD Signal" AS REAL)', min_macd_signal, max_macd_signal)
    add_min_max_filter(where_clauses, params, 'CAST("MACD Histogram" AS REAL)', min_macd_histogram, max_macd_histogram)
    add_min_max_filter(where_clauses, params, 'CAST("Latest Dividend Amount" AS REAL)', min_latest_dividend,
                       max_latest_dividend)
    add_min_max_filter(where_clauses, params, 'CAST("Dividend Frequency" AS REAL)', min_dividend_frequency,
                       max_dividend_frequency)

    where_sql = ""
    if where_clauses:
        where_sql = "WHERE " + " AND ".join(where_clauses)

    return where_sql, params


# =========================================================
# COLUMN LISTS
# =========================================================

STOCK_LIST_COLUMNS = """
    "Ticker",
    "Company Name",
    "Description",
    "Type",
    "Sector",
    "Current Price",
    "Previous Close",
    "Day Open",
    "Day High",
    "Day Low",
    "Day Volume",
    "Today Change %%",
    "Market Cap",
"EPS (TTM)",
"P/E (TTM)",
"PEG Ratio",
"P/S Ratio",
"Dividend Yield",
"RSI",
    "MACD",
    "MACD Signal",
    "MACD Histogram",
    "SMA 20",
    "Beta",
    "Standard Deviation (1Y)",
    "EBITDA",
    "Short %% of Float",
    "Gross Profit",
    "Analyst Upside",
    "Analyst Downside",
    "Mean Target",
    "Number of Analysts",
    "Latest Dividend Amount",
    "Latest Ex-Dividend Date",
    "Latest Pay Date",
    "Dividend Frequency",
    "Latest 10-K Date",
    "Latest 10-K URL",
    "Latest 10-Q Date",
    "Latest 10-Q URL",
    "Last Updated"
"""


# =========================================================
# ROUTES
# =========================================================
@app.get("/healthz")
def healthz():
    return {"status": "ok"}


@app.get("/stocks")
def get_stocks(
    page: int = Query(1, ge=1),
    page_size: int = Query(100, ge=1, le=1000),

    search: Optional[str] = None,
    sector: Optional[str] = None,
    security_type: Optional[str] = None,
    tickers: Optional[str] = None,

    min_price: Optional[float] = None,
    max_price: Optional[float] = None,

    min_market_cap: Optional[float] = None,
    max_market_cap: Optional[float] = None,

    min_eps: Optional[float] = None,
    max_eps: Optional[float] = None,

min_pe: Optional[float] = None,
max_pe: Optional[float] = None,

min_peg: Optional[float] = None,
max_peg: Optional[float] = None,

min_ps: Optional[float] = None,
max_ps: Optional[float] = None,

min_dividend: Optional[float] = None,
max_dividend: Optional[float] = None,

    min_rsi: Optional[float] = None,
    max_rsi: Optional[float] = None,

    min_macd: Optional[float] = None,
    max_macd: Optional[float] = None,

    min_sma20: Optional[float] = None,
    max_sma20: Optional[float] = None,

    min_beta: Optional[float] = None,
    max_beta: Optional[float] = None,

    min_std_dev: Optional[float] = None,
    max_std_dev: Optional[float] = None,

    min_ebitda: Optional[float] = None,
    max_ebitda: Optional[float] = None,

    min_short_float: Optional[float] = None,
    max_short_float: Optional[float] = None,

    min_gross_profit: Optional[float] = None,
    max_gross_profit: Optional[float] = None,

    min_upside: Optional[float] = None,
    max_upside: Optional[float] = None,

    min_downside: Optional[float] = None,
    max_downside: Optional[float] = None,

    min_mean_target: Optional[float] = None,
    max_mean_target: Optional[float] = None,

    min_analysts: Optional[int] = None,
    max_analysts: Optional[int] = None,

    min_previous_close: Optional[float] = None,
    max_previous_close: Optional[float] = None,

    min_day_open: Optional[float] = None,
    max_day_open: Optional[float] = None,

    min_day_high: Optional[float] = None,
    max_day_high: Optional[float] = None,

    min_day_low: Optional[float] = None,
    max_day_low: Optional[float] = None,

    min_day_volume: Optional[float] = None,
    max_day_volume: Optional[float] = None,

    min_today_change: Optional[float] = None,
    max_today_change: Optional[float] = None,

    min_macd_signal: Optional[float] = None,
    max_macd_signal: Optional[float] = None,

    min_macd_histogram: Optional[float] = None,
    max_macd_histogram: Optional[float] = None,

    min_latest_dividend: Optional[float] = None,
    max_latest_dividend: Optional[float] = None,

    min_dividend_frequency: Optional[float] = None,
    max_dividend_frequency: Optional[float] = None,

    sort_by: str = Query("Market Cap"),
    sort_order: str = Query("desc"),
):
    conn = None
    try:
        conn = get_db_connection_dict()
        cursor = conn.cursor()

        where_sql, params = build_where_clause(
            search=search,
            sector=sector,
            security_type=security_type,
            tickers=tickers,

            min_price=min_price,
            max_price=max_price,

            min_market_cap=min_market_cap,
            max_market_cap=max_market_cap,

            min_eps=min_eps,
            max_eps=max_eps,

            min_pe=min_pe,
            max_pe=max_pe,

            min_peg=min_peg,
            max_peg=max_peg,

            min_ps=min_ps,
            max_ps=max_ps,

            min_dividend=min_dividend,
            max_dividend=max_dividend,

            min_rsi=min_rsi,
            max_rsi=max_rsi,

            min_macd=min_macd,
            max_macd=max_macd,

            min_sma20=min_sma20,
            max_sma20=max_sma20,

            min_beta=min_beta,
            max_beta=max_beta,

            min_std_dev=min_std_dev,
            max_std_dev=max_std_dev,

            min_ebitda=min_ebitda,
            max_ebitda=max_ebitda,

            min_short_float=min_short_float,
            max_short_float=max_short_float,

            min_gross_profit=min_gross_profit,
            max_gross_profit=max_gross_profit,

            min_upside=min_upside,
            max_upside=max_upside,

            min_downside=min_downside,
            max_downside=max_downside,

            min_mean_target=min_mean_target,
            max_mean_target=max_mean_target,

            min_analysts=min_analysts,
            max_analysts=max_analysts,

            min_previous_close=min_previous_close,
            max_previous_close=max_previous_close,

            min_day_open=min_day_open,
            max_day_open=max_day_open,

            min_day_high=min_day_high,
            max_day_high=max_day_high,

            min_day_low=min_day_low,
            max_day_low=max_day_low,

            min_day_volume=min_day_volume,
            max_day_volume=max_day_volume,

            min_today_change=min_today_change,
            max_today_change=max_today_change,

            min_macd_signal=min_macd_signal,
            max_macd_signal=max_macd_signal,

            min_macd_histogram=min_macd_histogram,
            max_macd_histogram=max_macd_histogram,

            min_latest_dividend=min_latest_dividend,
            max_latest_dividend=max_latest_dividend,

            min_dividend_frequency=min_dividend_frequency,
            max_dividend_frequency=max_dividend_frequency,
        )

        sortable_columns = {
            "Ticker": '"Ticker"',
            "Company Name": '"Company Name"',
            "Type": '"Type"',
            "Sector": '"Sector"',
            "Current Price": 'CAST("Current Price" AS REAL)',
            "Previous Close": 'CAST("Previous Close" AS REAL)',
            "Day Open": 'CAST("Day Open" AS REAL)',
            "Day High": 'CAST("Day High" AS REAL)',
            "Day Low": 'CAST("Day Low" AS REAL)',
            "Day Volume": 'CAST("Day Volume" AS REAL)',
            "Today Change %": 'CAST("Today Change %%" AS REAL)',
            "Market Cap": 'CAST("Market Cap" AS REAL)',
            "EPS (TTM)": 'CAST("EPS (TTM)" AS REAL)',
            "P/E (TTM)": 'CAST("P/E (TTM)" AS REAL)',
            "PEG Ratio": 'CAST("PEG Ratio" AS REAL)',
            "P/S Ratio": 'CAST("P/S Ratio" AS REAL)',
            "Dividend Yield": 'CAST("Dividend Yield" AS REAL)',
            "RSI": 'CAST("RSI" AS REAL)',
            "MACD": 'CAST("MACD" AS REAL)',
            "MACD Signal": 'CAST("MACD Signal" AS REAL)',
            "MACD Histogram": 'CAST("MACD Histogram" AS REAL)',
            "SMA 20": 'CAST("SMA 20" AS REAL)',
            "Beta": 'CAST("Beta" AS REAL)',
            "Standard Deviation (1Y)": 'CAST("Standard Deviation (1Y)" AS REAL)',
            "EBITDA": 'CAST("EBITDA" AS REAL)',
            "Short % of Float": 'CAST("Short %% of Float" AS REAL)',
            "Gross Profit": 'CAST("Gross Profit" AS REAL)',
            "Analyst Upside": 'CAST("Analyst Upside" AS REAL)',
            "Analyst Downside": 'CAST("Analyst Downside" AS REAL)',
            "Mean Target": 'CAST("Mean Target" AS REAL)',
            "Number of Analysts": 'CAST("Number of Analysts" AS REAL)',
            "Latest Dividend Amount": 'CAST("Latest Dividend Amount" AS REAL)',
            "Dividend Frequency": 'CAST("Dividend Frequency" AS REAL)',
            "Last Updated": '"Last Updated"',
        }

        order_sql = sortable_columns.get(sort_by, 'CAST("Market Cap" AS REAL)')
        direction_sql = "DESC" if sort_order.lower() == "desc" else "ASC"

        count_query = f"""
            SELECT COUNT(*) AS total
            FROM stocks
            {where_sql}
        """
        cursor.execute(count_query, params)
        total = cursor.fetchone()["total"]

        offset = (page - 1) * page_size

        search_rank_sql = ""
        search_rank_params = []
        if search and search.strip():
            clean_search = search.strip()
            search_rank_sql = """
                CASE
                    WHEN UPPER("Ticker") = UPPER(%s) THEN 0
                    WHEN UPPER("Ticker") LIKE UPPER(%s) THEN 1
                    WHEN LOWER("Company Name") = LOWER(%s) THEN 2
                    WHEN LOWER("Company Name") LIKE LOWER(%s) THEN 3
                    ELSE 4
                END ASC,
            """
            search_rank_params = [
                clean_search,
                f"{clean_search}%",
                clean_search,
                f"{clean_search}%",
            ]

        data_query = f"""
            SELECT {STOCK_LIST_COLUMNS}
            FROM stocks
            {where_sql}
            ORDER BY
                {search_rank_sql}
                {order_sql} {direction_sql} NULLS LAST,
                "Ticker" ASC
            LIMIT %s OFFSET %s
        """
        cursor.execute(
            data_query,
            params + search_rank_params + [page_size, offset],
        )
        rows = cursor.fetchall()

        total_pages = math.ceil(total / page_size) if total > 0 else 1

        safe_rows = []
        for row in rows:
            safe_rows.append({k: row[k] for k in row.keys()})

        return {
            "rows": safe_rows,
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": total_pages,
            "sort_by": sort_by,
            "sort_order": sort_order,
        }

    except Exception as e:
        print(f"[ERROR] /stocks -> {type(e).__name__}: {e}")
        return safe_server_error_message()

    finally:
        if conn:
            conn.close()

def safe_num(value):
    try:
        if value is None or value == "":
            return None
        return float(value)
    except Exception:
        return None


def median_value(values):
    clean_values = sorted([v for v in values if v is not None])

    if not clean_values:
        return None

    mid = len(clean_values) // 2

    if len(clean_values) % 2 == 1:
        return clean_values[mid]

    return (clean_values[mid - 1] + clean_values[mid]) / 2


def pct_diff(value, benchmark):
    if value is None or benchmark in (None, 0):
        return None

    return ((value - benchmark) / benchmark) * 100


def score_stock_snapshot(stock, peer_stats):
    score = 50

    pe = safe_num(stock.get("P/E (TTM)"))
    peer_pe = peer_stats.get("median_pe")

    beta = safe_num(stock.get("Beta"))
    rsi = safe_num(stock.get("RSI"))
    analyst_upside = safe_num(stock.get("Analyst Upside"))
    short_float = safe_num(stock.get("Short % of Float"))
    today_change = safe_num(stock.get("Today Change %"))

    if pe is not None and peer_pe is not None and pe > 0:
        if pe < peer_pe * 0.8:
            score += 12
        elif pe < peer_pe:
            score += 7
        elif pe > peer_pe * 1.5:
            score -= 12
        elif pe > peer_pe * 1.2:
            score -= 6

    if analyst_upside is not None:
        if analyst_upside >= 20:
            score += 12
        elif analyst_upside >= 10:
            score += 7
        elif analyst_upside <= -10:
            score -= 12
        elif analyst_upside < 0:
            score -= 6

    if rsi is not None:
        if 40 <= rsi <= 60:
            score += 6
        elif 30 <= rsi < 40:
            score += 3
        elif rsi > 75:
            score -= 8
        elif rsi < 25:
            score -= 5

    if beta is not None:
        if beta <= 1.2:
            score += 4
        elif beta > 2:
            score -= 8
        elif beta > 1.5:
            score -= 4

    if short_float is not None:
        if short_float > 20:
            score -= 10
        elif short_float > 10:
            score -= 5

    if today_change is not None:
        if today_change > 3:
            score += 3
        elif today_change < -3:
            score -= 3

    return max(0, min(100, round(score)))


def build_stock_badges(stock, peer_stats):
    badges = []

    pe = safe_num(stock.get("P/E (TTM)"))
    peer_pe = peer_stats.get("median_pe")

    rsi = safe_num(stock.get("RSI"))
    beta = safe_num(stock.get("Beta"))
    analyst_upside = safe_num(stock.get("Analyst Upside"))
    short_float = safe_num(stock.get("Short % of Float"))

    if pe is not None and peer_pe is not None and pe > 0:
        if pe < peer_pe:
            badges.append({
                "label": "Cheaper Than Peer Median",
                "tone": "positive",
                "detail": f"P/E is below peer median of {peer_pe:.2f}."
            })
        elif pe > peer_pe * 1.25:
            badges.append({
                "label": "Premium Valuation",
                "tone": "warning",
                "detail": f"P/E is above peer median of {peer_pe:.2f}."
            })

    if analyst_upside is not None:
        if analyst_upside >= 10:
            badges.append({
                "label": "Positive Analyst Upside",
                "tone": "positive",
                "detail": f"Analyst upside is {analyst_upside:.2f}%."
            })
        elif analyst_upside < 0:
            badges.append({
                "label": "Negative Analyst Implied Return",
                "tone": "negative",
                "detail": f"Analyst upside is {analyst_upside:.2f}%."
            })

    if rsi is not None:
        if rsi >= 70:
            badges.append({
                "label": "Potentially Overbought",
                "tone": "warning",
                "detail": f"RSI is {rsi:.2f}."
            })
        elif rsi <= 30:
            badges.append({
                "label": "Potentially Oversold",
                "tone": "warning",
                "detail": f"RSI is {rsi:.2f}."
            })
        else:
            badges.append({
                "label": "Neutral RSI",
                "tone": "neutral",
                "detail": f"RSI is {rsi:.2f}."
            })

    if beta is not None:
        if beta > 1.5:
            badges.append({
                "label": "High Beta Risk",
                "tone": "warning",
                "detail": f"Beta is {beta:.2f}."
            })
        elif beta < 0.9:
            badges.append({
                "label": "Lower Market Sensitivity",
                "tone": "positive",
                "detail": f"Beta is {beta:.2f}."
            })

    if short_float is not None and short_float > 10:
        badges.append({
            "label": "Elevated Short Interest",
            "tone": "negative",
            "detail": f"Short float is {short_float:.2f}%."
        })

    return badges

def build_sec_deep_dive_payload(ticker, cik, companyfacts):
    analysis_profile = get_financial_analysis_profile(companyfacts, ticker=ticker)
    bank_profile = analysis_profile == "financial_institution"
    insurance_profile = analysis_profile == "insurance_company"
    real_estate_profile = analysis_profile == "real_estate_company"
    nonindustrial_profile = bank_profile or insurance_profile or real_estate_profile
    taxonomy = get_reporting_taxonomy(companyfacts)
    concept_map = {
        "revenue": [
            "RevenueFromContractWithCustomerExcludingAssessedTax",
            "RevenueFromContractWithCustomerIncludingAssessedTax",
            "SalesRevenueNet",
            "SalesRevenueGoodsServicesNet",
            "SalesRevenueNet",
            "NetSales",
            "Revenues",
            "RevenuesNetOfInterestExpense",
            "PremiumsEarnedNet",
            "PremiumsEarned",
            "InsurancePremiumsRevenue",
            "InsuranceRevenue",
            "OperatingLeasesIncomeStatementLeaseRevenue",
            "RentalIncome",
            "RentalRevenue",
            "RealEstateRevenueNet",
        ],
        "remaining_performance_obligations": [
            "RemainingPerformanceObligation",
            "RemainingPerformanceObligationExpectedTimingOfSatisfactionOfPerformanceObligations",
            "RevenueRemainingPerformanceObligation",
            "RevenueFromContractWithCustomerExcludingAssessedTaxRemainingPerformanceObligation",
        ],
        "current_remaining_performance_obligations": [
            "RemainingPerformanceObligationCurrent",
            "RevenueRemainingPerformanceObligationCurrent",
        ],
        "noncurrent_remaining_performance_obligations": [
            "RemainingPerformanceObligationNoncurrent",
            "RevenueRemainingPerformanceObligationNoncurrent",
        ],
        "contract_liabilities": [
            "ContractWithCustomerLiability",
            "ContractWithCustomerLiabilityCurrent",
            "DeferredRevenue",
            "DeferredRevenueCurrent",
        ],
        "deferred_revenue_current": [
            "DeferredRevenueCurrent",
            "ContractWithCustomerLiabilityCurrent",
        ],
        "deferred_revenue_noncurrent": [
            "DeferredRevenueNoncurrent",
            "ContractWithCustomerLiabilityNoncurrent",
        ],
        "gross_profit": ["GrossProfit"],
        "cost_of_revenue": [
            "CostOfRevenue",
            "CostOfGoodsAndServicesSold",
            "CostOfSales",
            "CostOfSalesRevenue",
        ],
        "operating_income": ["OperatingIncomeLoss"],
        "net_income": ["NetIncomeLoss"],
        "operating_cash_flow": ["NetCashProvidedByUsedInOperatingActivities"],
        "capex": [
            "PaymentsToAcquirePropertyPlantAndEquipment",
            "PaymentsToAcquirePropertyAndEquipment",
            "PaymentsToAcquireProductiveAssets",
        ],
        "r_and_d": ["ResearchAndDevelopmentExpense"],
        "sga": [
            "SellingGeneralAndAdministrativeExpense",
            "SellingAndMarketingExpense",
            "GeneralAndAdministrativeExpense",
        ],
        "stock_based_comp": [
            "ShareBasedCompensation",
            "ShareBasedCompensationArrangementByShareBasedPaymentAwardOptionsGrantsInPeriodGross",
            "AllocatedShareBasedCompensationExpense",
        ],
        "buybacks": [
            "PaymentsForRepurchaseOfCommonStock",
            "PaymentsForRepurchaseOfEquity",
            "PaymentsForRepurchaseOfCommonStocks",
        ],
        "dividends_paid": [
            "PaymentsOfDividends",
            "PaymentsOfDividendsCommonStock",
            "PaymentsOfOrdinaryDividends",
        ],
        "assets": ["Assets"],
        "liabilities": ["Liabilities"],
        "equity": [
            "StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest",
            "StockholdersEquity",
        ],
        "temporary_equity": [
            "TemporaryEquityCarryingAmountIncludingPortionAttributableToNoncontrollingInterests",
            "TemporaryEquityCarryingAmount",
            "RedeemableNoncontrollingInterestEquityCarryingAmount",
            "RedeemableNoncontrollingInterestEquityCommonCarryingAmount",
            "RedeemableNoncontrollingInterestEquityOtherCarryingAmount",
            "RedeemableNoncontrollingInterestEquityPreferredCarryingAmount",
            "RedeemablePreferredStockCarryingAmount",
            "TemporaryEquityCarryingAmountAttributableToParent",
            "TemporaryEquityCarryingAmountAttributableToNoncontrollingInterest",
        ],
        "cash": [
            "CashAndCashEquivalentsAtCarryingValue",
            "CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents",
        ],
        "current_assets": ["AssetsCurrent"],
        "current_liabilities": ["LiabilitiesCurrent"],
        "inventory": ["InventoryNet"],
        "debt": [
            "LongTermDebtAndFinanceLeaseObligations",
            "LongTermDebtAndFinanceLeaseObligationsCurrentAndNoncurrent",
            "LongTermDebt",
        ],
        "current_debt": [
            "LongTermDebtAndFinanceLeaseObligationsCurrent",
            "LongTermDebtCurrent",
            "ShortTermBorrowings",
            "ShortTermDebt",
        ],
        "long_term_debt": [
            "LongTermDebtAndFinanceLeaseObligationsNoncurrent",
            "LongTermDebtNoncurrent",
            "LongTermDebt",
        ],
        "net_interest_income": BANK_CONCEPT_MAP["net_interest_income"],
        "noninterest_income": BANK_CONCEPT_MAP["noninterest_income"],
        "provision_for_credit_losses": BANK_CONCEPT_MAP["provision_for_credit_losses"],
        "deposits": BANK_CONCEPT_MAP["deposits"],
        "loans": BANK_CONCEPT_MAP["loans"],
        "allowance_for_credit_losses": BANK_CONCEPT_MAP["allowance_for_credit_losses"],
        "shares": [
            "WeightedAverageNumberOfDilutedSharesOutstanding",
            "WeightedAverageNumberOfSharesOutstandingBasic",
        ],
    }


    if taxonomy == "ifrs-full":
        concept_map.update({
            "pretax_income": ["ProfitLossBeforeTax"],
            "income_tax_expense": ["IncomeTaxExpenseContinuingOperations", "IncomeTaxExpense"],
            "interest_expense": ["FinanceCosts"],
            "depreciation_amortization": ["DepreciationAndAmortisationExpense", "DepreciationExpense", "AmortisationExpense"],
            "accounts_receivable": ["TradeAndOtherCurrentReceivables", "TradeReceivables"],
            "accounts_payable": ["TradeAndOtherCurrentPayables", "TradePayables"],
            "ppe": ["PropertyPlantAndEquipment"],
            "goodwill": ["Goodwill"],
            "intangibles": ["IntangibleAssetsOtherThanGoodwill"],
            "retained_earnings": ["RetainedEarnings"],
            "acquisitions": ["CashFlowsUsedInObtainingControlOfSubsidiariesOrOtherBusinesses"],
            "eps_basic": ["BasicEarningsLossPerShare"],
            "eps_diluted": ["DilutedEarningsLossPerShare"],
        })
    else:
        concept_map.update({
            "pretax_income": [
                "IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest",
                "IncomeLossFromContinuingOperationsBeforeIncomeTaxesMinorityInterestAndIncomeLossFromEquityMethodInvestments",
                "IncomeLossFromContinuingOperationsBeforeIncomeTaxes",
            ],
            "income_tax_expense": ["IncomeTaxExpenseBenefit"],
            "interest_expense": ["InterestExpenseNonOperating", "InterestExpenseDebt", "InterestExpense"],
            "depreciation_amortization": [
                "DepreciationDepletionAndAmortization",
                "DepreciationDepletionAndAmortizationPropertyPlantAndEquipment",
                "Depreciation",
            ],
            "accounts_receivable": ["AccountsReceivableNetCurrent", "AccountsNotesAndLoansReceivableNetCurrent"],
            "accounts_payable": ["AccountsPayableCurrent"],
            "ppe": ["PropertyPlantAndEquipmentNet"],
            "goodwill": ["Goodwill"],
            "intangibles": ["FiniteLivedIntangibleAssetsNet", "IndefiniteLivedIntangibleAssetsExcludingGoodwill", "IntangibleAssetsNetExcludingGoodwill"],
            "retained_earnings": ["RetainedEarningsAccumulatedDeficit"],
            "acquisitions": ["PaymentsToAcquireBusinessesNetOfCashAcquired", "PaymentsToAcquireBusinessesGross"],
            "eps_basic": ["EarningsPerShareBasic"],
            "eps_diluted": ["EarningsPerShareDiluted"],

            "insurance_premiums": ["PremiumsEarnedNet", "PremiumsEarned", "InsurancePremiumsRevenue", "InsuranceRevenue"],
            "net_investment_income": ["InvestmentIncomeNet", "InvestmentIncomeInterestAndDividend"],
            "insurance_claims_benefits": [
                "PolicyholderBenefitsAndClaimsExpense",
                "PropertyCasualtyInsuranceClaimsAndClaimsAdjustmentExpense",
                "ClaimsAndClaimsAdjustmentExpense",
                "BenefitsLossesAndExpenses",
            ],
            "policyholder_reserves": [
                "PolicyholderBenefitsAndClaimsPayable",
                "FuturePolicyBenefits",
                "PropertyCasualtyInsuranceClaimsAndClaimsAdjustmentExpenseReserves",
                "ClaimsAndClaimsAdjustmentExpenseReserves",
            ],
            "deferred_policy_acquisition_costs": ["DeferredPolicyAcquisitionCosts"],

            "real_estate_investments": [
                "RealEstateInvestmentPropertyNet",
                "RealEstateInvestmentsNet",
                "RealEstateInvestments",
                "InvestmentPropertyNet",
            ],
            "rental_revenue": [
                "OperatingLeasesIncomeStatementLeaseRevenue",
                "RentalIncome",
                "RentalRevenue",
                "RealEstateRevenueNet",
            ],
            "gain_loss_real_estate_sales": ["GainLossOnSaleOfRealEstate", "GainLossOnSaleOfPropertyPlantEquipment"],
        })

    reporting_currency = _preferred_reporting_currency(companyfacts, [concept_map["revenue"], concept_map["net_income"], concept_map["assets"]]) or "USD"
    quarterly = {}
    instant = {}
    picked = {}

    flow_keys = [
        "revenue",
        "gross_profit",
        "cost_of_revenue",
        "operating_income",
        "net_income",
        "operating_cash_flow",
        "capex",
        "r_and_d",
        "sga",
        "stock_based_comp",
        "buybacks",
        "dividends_paid",
        "net_interest_income",
        "noninterest_income",
        "provision_for_credit_losses",
        "pretax_income",
        "income_tax_expense",
        "interest_expense",
        "depreciation_amortization",
        "acquisitions",
        "insurance_premiums",
        "net_investment_income",
        "insurance_claims_benefits",
        "rental_revenue",
        "gain_loss_real_estate_sales",
        "eps_basic",
        "eps_diluted",
        "shares",
    ]

    instant_keys = [
        "assets",
        "liabilities",
        "equity",
        "temporary_equity",
        "cash",
        "current_assets",
        "current_liabilities",
        "inventory",
        "debt",
        "current_debt",
        "long_term_debt",
        "remaining_performance_obligations",
        "current_remaining_performance_obligations",
        "noncurrent_remaining_performance_obligations",
        "contract_liabilities",
        "deferred_revenue_current",
        "deferred_revenue_noncurrent",
        "deposits",
        "loans",
        "allowance_for_credit_losses",
        "accounts_receivable",
        "accounts_payable",
        "ppe",
        "goodwill",
        "intangibles",
        "retained_earnings",
        "policyholder_reserves",
        "deferred_policy_acquisition_costs",
        "real_estate_investments",
    ]

    for key in flow_keys:
        if key == "shares":
            rows = pick_quarterly_shares_by_period(companyfacts, concept_map[key], max_quarters=8)
        elif key in {"eps_basic", "eps_diluted"}:
            rows = pick_quarterly_per_share_facts_by_period(
                companyfacts,
                concept_map[key],
                max_quarters=8,
                preferred_currency=reporting_currency,
            )
        elif key == "revenue":
            rows = pick_quarterly_revenue_facts_by_period(
                companyfacts,
                concept_map[key],
                max_quarters=8,
                preferred_currency=reporting_currency,
            )
        else:
            rows = pick_quarterly_monetary_facts_by_period(
                companyfacts,
                concept_map[key],
                max_quarters=8,
                preferred_currency=reporting_currency,
            )

        quarterly[key] = rows
        picked[key] = sorted(list({row.get("concept") for row in rows if row.get("concept")}))

    for key in instant_keys:
        rows = pick_instant_monetary_facts_by_period(companyfacts, concept_map[key], max_periods=8, preferred_currency=reporting_currency)
        instant[key] = rows
        picked[key] = sorted(list({row.get("concept") for row in rows if row.get("concept")}))

    # Banks often tag net interest income and noninterest income separately rather
    # than providing one generic quarterly revenue concept. Build a synthetic
    # quarterly revenue series only when direct revenue is missing for a period.
    if bank_profile:
        revenue_by_period = {row.get("period"): dict(row) for row in quarterly.get("revenue", []) if row.get("period")}
        nii_by_period = {row.get("period"): row for row in quarterly.get("net_interest_income", []) if row.get("period")}
        noninterest_by_period = {row.get("period"): row for row in quarterly.get("noninterest_income", []) if row.get("period")}
        for period in sorted(set(nii_by_period) & set(noninterest_by_period), reverse=True):
            if period in revenue_by_period:
                continue
            nii_row = nii_by_period[period]
            noninterest_row = noninterest_by_period[period]
            try:
                revenue_by_period[period] = {
                    "period": period,
                    "year": int(str(period)[:4]),
                    "quarter": nii_row.get("quarter") or noninterest_row.get("quarter"),
                    "value": float(nii_row.get("value")) + float(noninterest_row.get("value")),
                    "filed": max(str(nii_row.get("filed") or ""), str(noninterest_row.get("filed") or "")),
                    "start": nii_row.get("start") or noninterest_row.get("start"),
                    "end": period,
                    "form": nii_row.get("form") or noninterest_row.get("form"),
                    "frame": nii_row.get("frame") or noninterest_row.get("frame"),
                    "concept": "net_interest_income_plus_noninterest_income",
                    "currency": reporting_currency,
                }
            except Exception:
                pass
        quarterly["revenue"] = sorted(revenue_by_period.values(), key=lambda row: row.get("period") or "", reverse=True)[:8]

    # Build latest quarter row from core earnings concepts. Do not let a later
    # annual balance-sheet instant or an ancillary quarterly disclosure create a
    # fake "latest quarter". This matters for June/May fiscal-year-end companies
    # such as MSFT, PG and NKE, whose newest 10-K balance sheet is later than the
    # most recent standalone 10-Q income-statement quarter.
    core_flow_periods = {
        row.get("period")
        for key in ("revenue", "net_income", "operating_income", "gross_profit")
        for row in (quarterly.get(key, []) or [])
        if row.get("period")
    }
    all_flow_periods = {
        row.get("period")
        for rows in quarterly.values()
        for row in rows
        if row.get("period")
    }
    periods = sorted(core_flow_periods or all_flow_periods, reverse=True)

    latest_period = periods[0] if periods else None
    latest_quarter = {"period": latest_period}

    if latest_period:
        for key, rows in quarterly.items():
            match = next((row for row in rows if row.get("period") == latest_period), None)
            latest_quarter[key] = match.get("value") if match else None
            latest_quarter[f"{key}_concept"] = match.get("concept") if match else None

    # Align balance-sheet values to the same period as the earnings quarter.
    # If an annual 10-K balance sheet is newer than the latest standalone 10-Q,
    # use the matching 10-Q balance sheet rather than mixing periods.
    instant_period_scores = {}
    for key in ("assets", "liabilities", "equity", "cash"):
        for row in instant.get(key, []) or []:
            period = row.get("period") or row.get("end")
            if period:
                instant_period_scores[period] = instant_period_scores.get(period, 0) + 1

    latest_instant_period = None
    if latest_period and instant_period_scores:
        if instant_period_scores.get(latest_period, 0) >= 1:
            latest_instant_period = latest_period
        else:
            eligible = [
                period for period in instant_period_scores
                if str(period) <= str(latest_period)
            ]
            if eligible:
                eligible.sort(
                    key=lambda period: (str(period), instant_period_scores.get(period, 0)),
                    reverse=True,
                )
                latest_instant_period = eligible[0]

    if latest_instant_period is None and instant_period_scores:
        latest_instant_period = max(
            instant_period_scores,
            key=lambda period: (str(period), instant_period_scores.get(period, 0)),
        )

    for key, rows in instant.items():
        match = next(
            (
                row
                for row in rows
                if (row.get("period") or row.get("end")) == latest_instant_period
            ),
            None,
        )
        latest_quarter[key] = match.get("value") if match else None
        latest_quarter[f"{key}_period"] = latest_instant_period if match else None

    if (
        latest_quarter.get("liabilities") is None
        and latest_quarter.get("assets") is not None
        and latest_quarter.get("equity") is not None
    ):
        try:
            latest_quarter["liabilities"] = (
                float(latest_quarter["assets"])
                - float(latest_quarter["equity"])
                - float(latest_quarter.get("temporary_equity") or 0)
            )
            latest_quarter["liabilities_period"] = latest_instant_period
            latest_quarter["liabilities_source"] = "derived_assets_minus_total_equity_components"
        except Exception:
            latest_quarter["liabilities_source"] = None
    else:
        latest_quarter["liabilities_source"] = (
            "reported" if latest_quarter.get("liabilities") is not None else None
        )

    # Preserve reported permanent equity and account separately for temporary /
    # mezzanine equity. A balance sheet can legitimately satisfy
    # Assets = Liabilities + Temporary Equity + Permanent Equity. Only derive
    # permanent equity when it is actually missing.
    if (
        latest_quarter.get("assets") is not None
        and latest_quarter.get("liabilities") is not None
    ):
        try:
            assets_value = float(latest_quarter["assets"])
            liabilities_value = float(latest_quarter["liabilities"])
            temporary_equity_value = float(latest_quarter.get("temporary_equity") or 0)
            equity_value = latest_quarter.get("equity")
            if equity_value is None:
                latest_quarter["equity"] = assets_value - liabilities_value - temporary_equity_value
                latest_quarter["equity_period"] = latest_instant_period
                latest_quarter["equity_source"] = "derived_assets_minus_liabilities_and_temporary_equity"
            else:
                latest_quarter["equity_source"] = "reported"
            if latest_quarter.get("temporary_equity") is not None:
                latest_quarter["temporary_equity_source"] = "reported"
        except Exception:
            pass

    if (
        latest_quarter.get("temporary_equity") is None
        and latest_quarter.get("assets") is not None
        and latest_quarter.get("liabilities") is not None
        and latest_quarter.get("equity") is not None
    ):
        try:
            residual_amount = (
                float(latest_quarter["assets"])
                - float(latest_quarter["liabilities"])
                - float(latest_quarter["equity"])
            )
            residual_ratio = residual_amount / max(abs(float(latest_quarter["assets"])), 1.0)
            if residual_amount > 0 and 0.001 <= residual_ratio <= 0.20:
                latest_quarter["temporary_equity"] = residual_amount
                latest_quarter["temporary_equity_period"] = latest_instant_period
                latest_quarter["temporary_equity_source"] = "derived_positive_balance_sheet_residual"
        except Exception:
            pass

    current_debt = latest_quarter.get("current_debt")
    long_term_debt = latest_quarter.get("long_term_debt")
    reported_debt = latest_quarter.get("debt")

    if current_debt is not None and long_term_debt is not None:
        latest_quarter["debt"] = float(current_debt) + float(long_term_debt)
        latest_quarter["debt_source"] = "current_debt_plus_long_term_debt_same_period"
    elif reported_debt is not None:
        latest_quarter["debt"] = reported_debt
        latest_quarter["debt_source"] = "reported_debt_same_period"
    elif not bank_profile:
        # Preserve useful operating-company coverage when only one debt component
        # is reported at the current balance-sheet date.
        same_period_parts = [
            float(x)
            for x in (current_debt, long_term_debt)
            if x is not None
        ]
        latest_quarter["debt"] = sum(same_period_parts) if same_period_parts else None
        latest_quarter["debt_source"] = (
            "single_reported_debt_component_same_period"
            if same_period_parts
            else None
        )
    else:
        # For banks/broker-dealers, an incomplete debt total is more misleading
        # than a missing value, and traditional debt ratios are not core metrics.
        latest_quarter["debt"] = None
        latest_quarter["debt_source"] = None

    # TTM values.
    ttm = {}
    ttm_methods = {}

    for key in [
        "revenue",
        "gross_profit",
        "operating_income",
        "net_income",
        "operating_cash_flow",
        "capex",
        "r_and_d",
        "sga",
        "stock_based_comp",
        "buybacks",
        "dividends_paid",
        "net_interest_income",
        "noninterest_income",
        "provision_for_credit_losses",
        "pretax_income",
        "income_tax_expense",
        "interest_expense",
        "depreciation_amortization",
        "acquisitions",
        "insurance_premiums",
        "net_investment_income",
        "insurance_claims_benefits",
        "rental_revenue",
        "gain_loss_real_estate_sales",
    ]:
        result = calculate_ttm_monetary_fact(
            companyfacts,
            concept_map.get(key, []),
            preferred_currency=reporting_currency,
            selection_mode="revenue" if key == "revenue" else "priority",
        )
        if result:
            ttm[key] = result.get("value")
            ttm_methods[key] = {
                "method": result.get("method"),
                "concept": result.get("concept"),
                "annual_end": result.get("annual_end"),
                "current_ytd_end": result.get("current_ytd_end"),
                "prior_ytd_end": result.get("prior_ytd_end"),
            }
        else:
            ttm[key] = sum_latest_values(quarterly.get(key, []), 4)
            ttm_methods[key] = {
                "method": "legacy_four_rows_fallback" if ttm[key] is not None else None,
                "concept": None,
                "annual_end": None,
                "current_ytd_end": None,
                "prior_ytd_end": None,
            }

    # Cross-statement semantic guardrail for operating companies. SEC standard
    # concepts can represent either consolidated totals or component lines. When
    # the first valid TTM bridge yields an impossible sign/margin, prefer four
    # consecutive standalone quarters from the already period-aligned series.
    if analysis_profile == "operating_company":
        four_q_revenue = _sum_four_consecutive_quarter_values(quarterly.get("revenue"))
        if (ttm.get("revenue") is None or float(ttm.get("revenue") or 0) <= 0) and four_q_revenue is not None and four_q_revenue > 0:
            ttm["revenue"] = four_q_revenue
            ttm_methods["revenue"] = {
                "method": "four_consecutive_quarters_semantic_fallback",
                "concept": "best_total_revenue_per_period",
                "annual_end": None,
                "current_ytd_end": (quarterly.get("revenue") or [{}])[0].get("period"),
                "prior_ytd_end": None,
            }

        revenue_for_sanity = ttm.get("revenue")
        net_income_for_sanity = ttm.get("net_income")
        if revenue_for_sanity not in (None, 0) and net_income_for_sanity is not None:
            try:
                absurd_margin = abs(float(net_income_for_sanity) / float(revenue_for_sanity)) > 1.50
            except Exception:
                absurd_margin = False
            if absurd_margin:
                repaired = False

                # First try the basic income-statement identity:
                # net income ~= pretax income - income tax expense.
                pretax_value = ttm.get("pretax_income")
                tax_value = ttm.get("income_tax_expense")
                if pretax_value is not None and tax_value is not None:
                    try:
                        derived_net_income = float(pretax_value) - float(tax_value)
                        derived_margin = abs(derived_net_income / float(revenue_for_sanity))
                    except Exception:
                        derived_net_income = None
                        derived_margin = 999.0

                    if derived_net_income is not None and derived_margin <= 1.50:
                        ttm["net_income"] = derived_net_income
                        ttm_methods["net_income"] = {
                            "method": "derived_pretax_minus_income_tax",
                            "concept": "IncomeBeforeTaxMinusIncomeTaxExpense",
                            "annual_end": None,
                            "current_ytd_end": (
                                ttm_methods.get("pretax_income", {}).get("current_ytd_end")
                                or ttm_methods.get("income_tax_expense", {}).get("current_ytd_end")
                            ),
                            "prior_ytd_end": None,
                        }
                        repaired = True

                # Next try four truly discrete quarters.
                if not repaired:
                    four_q_net_income = _sum_four_consecutive_quarter_values(
                        quarterly.get("net_income")
                    )
                    if four_q_net_income is not None:
                        try:
                            candidate_margin = abs(
                                float(four_q_net_income) / float(revenue_for_sanity)
                            )
                        except Exception:
                            candidate_margin = 999.0

                        if candidate_margin <= 1.50:
                            ttm["net_income"] = four_q_net_income
                            ttm_methods["net_income"] = {
                                "method": "four_consecutive_quarters_semantic_fallback",
                                "concept": (quarterly.get("net_income") or [{}])[0].get("concept"),
                                "annual_end": None,
                                "current_ytd_end": (quarterly.get("net_income") or [{}])[0].get("period"),
                                "prior_ytd_end": None,
                            }
                            repaired = True

                # Never publish an accounting result that still implies an
                # obviously impossible consolidated net margin. Missing is safer
                # and transparent until a valid filing bridge becomes available.
                if not repaired:
                    ttm["net_income"] = None
                    ttm_methods["net_income"] = {
                        "method": "rejected_semantic_outlier",
                        "concept": ttm_methods.get("net_income", {}).get("concept"),
                        "annual_end": ttm_methods.get("net_income", {}).get("annual_end"),
                        "current_ytd_end": ttm_methods.get("net_income", {}).get("current_ytd_end"),
                        "prior_ytd_end": ttm_methods.get("net_income", {}).get("prior_ytd_end"),
                    }

        if ttm.get("revenue") not in (None, 0) and ttm.get("gross_profit") is not None:
            try:
                impossible_gp = float(ttm["gross_profit"]) > float(ttm["revenue"]) * 1.20
            except Exception:
                impossible_gp = False
            if impossible_gp:
                four_q_gp = _sum_four_consecutive_quarter_values(quarterly.get("gross_profit"))
                if four_q_gp is not None and four_q_gp <= float(ttm["revenue"]) * 1.20:
                    ttm["gross_profit"] = four_q_gp
                    ttm_methods["gross_profit"] = {
                        "method": "four_consecutive_quarters_semantic_fallback",
                        "concept": (quarterly.get("gross_profit") or [{}])[0].get("concept"),
                        "annual_end": None,
                        "current_ytd_end": (quarterly.get("gross_profit") or [{}])[0].get("period"),
                        "prior_ytd_end": None,
                    }
                else:
                    # Missing is safer than presenting a mathematically impossible
                    # gross-profit line as a consolidated company metric.
                    ttm["gross_profit"] = None
                    ttm_methods["gross_profit"] = {
                        "method": "rejected_semantic_outlier",
                        "concept": ttm_methods.get("gross_profit", {}).get("concept"),
                        "annual_end": ttm_methods.get("gross_profit", {}).get("annual_end"),
                        "current_ytd_end": ttm_methods.get("gross_profit", {}).get("current_ytd_end"),
                        "prior_ytd_end": ttm_methods.get("gross_profit", {}).get("prior_ytd_end"),
                    }

    if bank_profile and ttm.get("revenue") is None and ttm.get("net_interest_income") is not None and ttm.get("noninterest_income") is not None:
        ttm["revenue"] = float(ttm["net_interest_income"]) + float(ttm["noninterest_income"])

    ttm["free_cash_flow"] = (
        None
        if nonindustrial_profile
        else (ttm["operating_cash_flow"] - ttm["capex"]
              if ttm.get("operating_cash_flow") is not None and ttm.get("capex") is not None
              else None)
    )

    # TTM ratios.
    ttm["gross_margin"] = (
        None
        if nonindustrial_profile
        else (
            safe_ratio(ttm.get("gross_profit"), ttm.get("revenue")) * 100
            if safe_ratio(ttm.get("gross_profit"), ttm.get("revenue")) is not None
            else None
        )
    )

    ttm["operating_margin"] = (
        None
        if nonindustrial_profile
        else (
            safe_ratio(ttm.get("operating_income"), ttm.get("revenue")) * 100
            if safe_ratio(ttm.get("operating_income"), ttm.get("revenue")) is not None
            else None
        )
    )

    ttm["net_margin"] = (
        safe_ratio(ttm.get("net_income"), ttm.get("revenue")) * 100
        if safe_ratio(ttm.get("net_income"), ttm.get("revenue")) is not None
        else None
    )

    ttm["fcf_margin"] = (
        safe_ratio(ttm.get("free_cash_flow"), ttm.get("revenue")) * 100
        if safe_ratio(ttm.get("free_cash_flow"), ttm.get("revenue")) is not None
        else None
    )

    ttm["r_and_d_to_revenue"] = (
        safe_ratio(ttm.get("r_and_d"), ttm.get("revenue")) * 100
        if safe_ratio(ttm.get("r_and_d"), ttm.get("revenue")) is not None
        else None
    )

    ttm["sga_to_revenue"] = (
        safe_ratio(ttm.get("sga"), ttm.get("revenue")) * 100
        if safe_ratio(ttm.get("sga"), ttm.get("revenue")) is not None
        else None
    )

    ttm["sbc_to_revenue"] = (
        safe_ratio(ttm.get("stock_based_comp"), ttm.get("revenue")) * 100
        if safe_ratio(ttm.get("stock_based_comp"), ttm.get("revenue")) is not None
        else None
    )

    ttm["buyback_yield_proxy"] = None
    ttm["dividend_payout_to_fcf"] = (
        safe_ratio(ttm.get("dividends_paid"), ttm.get("free_cash_flow")) * 100
        if safe_ratio(ttm.get("dividends_paid"), ttm.get("free_cash_flow")) is not None
        else None
    )

    ttm["effective_tax_rate"] = safe_pct(
        ttm.get("income_tax_expense"),
        ttm.get("pretax_income"),
    )
    ttm["ffo_proxy"] = (
        float(ttm.get("net_income"))
        + float(ttm.get("depreciation_amortization"))
        - float(ttm.get("gain_loss_real_estate_sales") or 0)
        if real_estate_profile
        and ttm.get("net_income") is not None
        and ttm.get("depreciation_amortization") is not None
        else None
    )

    # Latest-quarter YoY comparisons.
    quarterly_growth = {}

    if periods:
        current_period = periods[0]
        try:
            current_dt = datetime.fromisoformat(current_period)
        except Exception:
            current_dt = None

        for key in [
            "revenue", "gross_profit", "operating_income", "net_income",
            "operating_cash_flow", "capex", "r_and_d", "sga", "stock_based_comp",
            "net_interest_income", "noninterest_income", "provision_for_credit_losses",
            "pretax_income", "income_tax_expense", "interest_expense",
            "depreciation_amortization", "insurance_premiums",
            "net_investment_income", "insurance_claims_benefits",
            "rental_revenue", "gain_loss_real_estate_sales",
        ]:
            rows = quarterly.get(key, []) or []
            current_row = next((row for row in rows if row.get("period") == current_period), None)
            prior_row = None
            if current_dt and current_row:
                candidates = []
                for row in rows:
                    period = row.get("period")
                    if not period or period == current_period:
                        continue
                    try:
                        dt = datetime.fromisoformat(period)
                    except Exception:
                        continue
                    day_gap = abs((current_dt - dt).days - 365)
                    if day_gap <= 45:
                        candidates.append((day_gap, row))
                if candidates:
                    candidates.sort(key=lambda x: x[0])
                    prior_row = candidates[0][1]
            quarterly_growth[f"{key}_yoy"] = pct_growth(
                current_row.get("value") if current_row else None,
                prior_row.get("value") if prior_row else None,
            )

    # Balance-sheet ratios using latest instant values.
    assets = latest_quarter.get("assets")
    liabilities = latest_quarter.get("liabilities")
    equity = latest_quarter.get("equity")
    cash = latest_quarter.get("cash")
    debt = latest_quarter.get("debt")
    current_assets = latest_quarter.get("current_assets")
    current_liabilities = latest_quarter.get("current_liabilities")
    inventory = latest_quarter.get("inventory")
    deposits = latest_quarter.get("deposits")
    loans = latest_quarter.get("loans")
    allowance_for_credit_losses = latest_quarter.get("allowance_for_credit_losses")

    rpo = latest_quarter.get("remaining_performance_obligations")
    current_rpo = latest_quarter.get("current_remaining_performance_obligations")
    noncurrent_rpo = latest_quarter.get("noncurrent_remaining_performance_obligations")

    if rpo is None and current_rpo is not None and noncurrent_rpo is not None:
        try:
            rpo = float(current_rpo) + float(noncurrent_rpo)
            latest_quarter["remaining_performance_obligations"] = rpo
        except Exception:
            rpo = None

    deferred_revenue_current = latest_quarter.get("deferred_revenue_current")
    deferred_revenue_noncurrent = latest_quarter.get("deferred_revenue_noncurrent")

    deferred_revenue_total = None
    if deferred_revenue_current is not None and deferred_revenue_noncurrent is not None:
        try:
            deferred_revenue_total = float(deferred_revenue_current) + float(deferred_revenue_noncurrent)
        except Exception:
            deferred_revenue_total = None

    if deferred_revenue_total is None:
        deferred_revenue_total = latest_quarter.get("contract_liabilities")

    revenue_visibility = {
        "latest_period": latest_instant_period,
        "remaining_performance_obligations": rpo,
        "current_remaining_performance_obligations": current_rpo,
        "noncurrent_remaining_performance_obligations": noncurrent_rpo,
        "deferred_revenue_total": deferred_revenue_total,
        "deferred_revenue_current": deferred_revenue_current,
        "deferred_revenue_noncurrent": deferred_revenue_noncurrent,
        "rpo_to_ttm_revenue": (
            safe_ratio(rpo, ttm.get("revenue")) * 100
            if safe_ratio(rpo, ttm.get("revenue")) is not None
            else None
        ),
        "deferred_revenue_to_ttm_revenue": (
            safe_ratio(deferred_revenue_total, ttm.get("revenue")) * 100
            if safe_ratio(deferred_revenue_total, ttm.get("revenue")) is not None
            else None
        ),
    }

    # Publish the already-normalized SEC quarterly series for lightweight charts on
    # the Analysts tab. This adds no upstream requests; the values come from the
    # same period-aligned Companyfacts rows used above for latest-quarter and TTM.
    quarterly_history = []
    quarterly_history_periods = sorted(
        {
            row.get("period")
            for key in ("revenue", "net_income", "eps_diluted", "eps_basic")
            for row in (quarterly.get(key, []) or [])
            if row.get("period")
        },
        reverse=True,
    )[:8]

    for period in quarterly_history_periods:
        history_row = {"period": period}
        quarter_label = None
        year_value = None

        for key in ("revenue", "net_income", "eps_diluted", "eps_basic"):
            source_row = next(
                (
                    row
                    for row in (quarterly.get(key, []) or [])
                    if row.get("period") == period
                ),
                None,
            )
            history_row[key] = source_row.get("value") if source_row else None
            if source_row:
                quarter_label = quarter_label or source_row.get("quarter")
                year_value = year_value or source_row.get("year")

        history_row["quarter"] = quarter_label
        history_row["year"] = year_value
        history_row["profit_margin"] = (
            safe_ratio(history_row.get("net_income"), history_row.get("revenue")) * 100
            if safe_ratio(history_row.get("net_income"), history_row.get("revenue")) is not None
            else None
        )
        quarterly_history.append(history_row)

    balance_sheet = {
        "latest_period": latest_instant_period,
        "assets": assets,
        "liabilities": liabilities,
        "equity": equity,
        "cash": cash,
        "debt": debt,
        "net_debt": (
            debt - cash
            if debt is not None and cash is not None
            else None
        ),
        "net_cash": (
            cash - debt
            if debt is not None and cash is not None
            else None
        ),
        "current_ratio": (
            safe_ratio(current_assets, current_liabilities)
            if safe_ratio(current_assets, current_liabilities) is not None
            else None
        ),
        "quick_ratio": (
            safe_ratio(current_assets - inventory, current_liabilities)
            if current_assets is not None and inventory is not None and safe_ratio(current_assets - inventory, current_liabilities) is not None
            else None
        ),
        "cash_to_debt": (
            safe_ratio(cash, debt)
            if safe_ratio(cash, debt) is not None
            else None
        ),
        "debt_to_assets": (
            safe_ratio(debt, assets) * 100
            if safe_ratio(debt, assets) is not None
            else None
        ),
        "liabilities_to_assets": (
            safe_ratio(liabilities, assets) * 100
            if safe_ratio(liabilities, assets) is not None
            else None
        ),
        "equity_ratio": (
            safe_ratio(equity, assets) * 100
            if safe_ratio(equity, assets) is not None
            else None
        ),
        "deposits": deposits,
        "loans": loans,
        "allowance_for_credit_losses": allowance_for_credit_losses,
        "loans_to_deposits": safe_pct(loans, deposits),
        "allowance_to_loans": safe_pct(allowance_for_credit_losses, loans),
        "accounts_receivable": latest_quarter.get("accounts_receivable"),
        "accounts_payable": latest_quarter.get("accounts_payable"),
        "ppe": latest_quarter.get("ppe"),
        "goodwill": latest_quarter.get("goodwill"),
        "intangibles": latest_quarter.get("intangibles"),
        "retained_earnings": latest_quarter.get("retained_earnings"),
        "policyholder_reserves": latest_quarter.get("policyholder_reserves"),
        "deferred_policy_acquisition_costs": latest_quarter.get("deferred_policy_acquisition_costs"),
        "real_estate_investments": latest_quarter.get("real_estate_investments"),
        "debt_source": latest_quarter.get("debt_source"),
    }

    return {
        "ticker": ticker,
        "cik": cik,
        "entity_name": companyfacts.get("entityName"),
        "source": "SEC companyfacts",
        "sec_freshness": companyfacts.get("_bullionaire_sec_freshness", []),
        "sec_history": companyfacts.get("_bullionaire_sec_history", []),
        "sec_metadata": companyfacts.get("_bullionaire_sec_metadata", {}),
        "taxonomy": taxonomy,
        "reporting_currency": reporting_currency,
        "analysis_profile": analysis_profile,
        "statement_basis": "Quarterly/TTM companyfacts from SEC periodic filings",
        "concepts_used": picked,
        "latest_quarter": latest_quarter,
        "quarterly_history": quarterly_history,
        "ttm": ttm,
        "ttm_methods": ttm_methods,
        "quarterly_growth": quarterly_growth,
        "balance_sheet": balance_sheet,
        "revenue_visibility": revenue_visibility,
        "coverage_inventory": {
            "available_ttm_fields": sorted([
                key for key, value in ttm.items()
                if value is not None
            ]),
            "available_latest_quarter_fields": sorted([
                key for key, value in latest_quarter.items()
                if value is not None
                and not key.endswith(("_period", "_concept", "_source"))
            ]),
            "available_balance_sheet_fields": sorted([
                key for key, value in balance_sheet.items()
                if value is not None
            ]),
        },
    }
@app.get("/stocks/{ticker}/filing-intelligence")
def get_filing_intelligence(ticker: str):
    conn = None

    try:
        clean_ticker = ticker.strip().upper()

        print(f"[FILING API] START {clean_ticker}", flush=True)

        if not clean_ticker:
            raise HTTPException(status_code=400, detail="Ticker is required.")

        conn = get_db_connection_dict()
        cursor = conn.cursor()

        cursor.execute(
            """
            SELECT
                ticker,
                cik,
                entity_name,
                source,
                latest_10k,
                latest_10q,
                revenue_visibility,
                reportable_segments,
                end_markets,
                geography,
                quarterly_breakdown,
                customer_concentration,
                insights,
                raw_payload,
                updated_at
            FROM filing_intelligence
            WHERE UPPER(ticker) = %s
            LIMIT 1
            """,
            (clean_ticker,),
        )

        row = cursor.fetchone()

        if not row:
            return {
                "ticker": clean_ticker,
                "source": "SEC filing text enrichment script",
                "status": "not_enriched_yet",
                "message": "Filing intelligence has not been generated for this ticker yet.",
                "latest_10k": None,
                "latest_10q": None,
                "revenue_visibility": {},
                "reportable_segments": [],
                "end_markets": [],
                "geography": [],
                "quarterly_breakdown": {},
                "customer_concentration": {
                    "customers": [],
                    "number_of_10pct_customers": None,
                    "largest_customer_pct": None,
                    "second_largest_customer_pct": None,
                    "customer_names_disclosed": False,
                    "notes": "Run filing_intelligence_update.py for this ticker to populate filing intelligence.",
                },
                "parser_status": {
                    "reportable_segments_detected": False,
                    "end_markets_detected": False,
                    "geography_detected": False,
                    "customer_concentration_detected": False,
                    "revenue_visibility_detected": False,
                    "warnings": ["Filing intelligence has not been generated yet."],
                },
                "insights": {
                    "summary": [],
                },
            }

        return {
            "ticker": row.get("ticker"),
            "cik": row.get("cik"),
            "entity_name": row.get("entity_name"),
            "source": row.get("source"),
            "latest_10k": row.get("latest_10k") or {},
            "latest_10q": row.get("latest_10q") or {},
            "revenue_visibility": row.get("revenue_visibility") or {},
            "reportable_segments": row.get("reportable_segments") or [],
            "end_markets": row.get("end_markets") or [],
            "geography": row.get("geography") or [],
            "quarterly_breakdown": row.get("quarterly_breakdown") or {},
            "customer_concentration": row.get("customer_concentration") or {},
            "parser_status": (row.get("raw_payload") or {}).get("parser_status") or {},
            "insights": row.get("insights") or {"summary": []},
            "updated_at": str(row.get("updated_at")) if row.get("updated_at") else None,
        }

    except HTTPException:
        raise

    except Exception as e:
        print(
            f"[ERROR] /stocks/{ticker}/filing-intelligence -> {type(e).__name__}: {e}",
            flush=True,
        )
        return {
            "error": "Filing intelligence API failed.",
            "detail": f"{type(e).__name__}: {str(e)}",
        }

    finally:
        if conn:
            conn.close()

@app.get("/stocks/{ticker}/sec-deep-dive")
def get_sec_deep_dive(ticker: str):
    try:
        clean_ticker = ticker.strip().upper()

        if not clean_ticker:
            raise HTTPException(status_code=400, detail="Ticker is required.")

        cik = get_financials_cik_for_ticker(clean_ticker)

        if not cik:
            raise HTTPException(status_code=404, detail="CIK not found for ticker.")

        companyfacts = get_fresh_companyfacts_for_cik(cik)

        if not companyfacts:
            raise HTTPException(status_code=404, detail="SEC companyfacts not found.")

        return build_sec_deep_dive_payload(clean_ticker, cik, companyfacts)

    except HTTPException:
        raise

    except Exception as e:
        print(f"[ERROR] /stocks/{ticker}/sec-deep-dive -> {type(e).__name__}: {e}")
        return safe_server_error_message()

@app.get("/stocks/{ticker}/sec-financials")
def get_sec_financials(ticker: str):
    try:
        clean_ticker = ticker.strip().upper()

        if not clean_ticker:
            raise HTTPException(status_code=400, detail="Ticker is required.")

        cik = get_financials_cik_for_ticker(clean_ticker)

        if not cik:
            raise HTTPException(status_code=404, detail="CIK not found for ticker.")

        companyfacts = get_fresh_companyfacts_for_cik(cik)

        if not companyfacts:
            raise HTTPException(status_code=404, detail="SEC companyfacts not found.")

        return build_sec_financials_payload(clean_ticker, cik, companyfacts)

    except HTTPException:
        raise

    except Exception as e:
        print(f"[ERROR] /stocks/{ticker}/sec-financials -> {type(e).__name__}: {e}")
        return safe_server_error_message()

@app.get("/stocks/{ticker}/analysis")
def get_stock_analysis(ticker: str):
    conn = None

    try:
        clean_ticker = ticker.strip().upper()

        if not clean_ticker:
            raise HTTPException(status_code=400, detail="Ticker is required.")

        conn = get_db_connection_dict()
        cursor = conn.cursor()

        stock_query = f"""
            SELECT {STOCK_LIST_COLUMNS}
            FROM stocks
            WHERE UPPER("Ticker") = %s
            LIMIT 1
        """
        cursor.execute(stock_query, (clean_ticker,))
        stock = cursor.fetchone()

        if not stock:
            raise HTTPException(status_code=404, detail="Stock not found.")

        sector = stock.get("Sector")

        peers = []

        if sector:
            peers_query = f"""
                SELECT {STOCK_LIST_COLUMNS}
                FROM stocks
                WHERE UPPER("Ticker") != %s
                  AND LOWER("Sector") = LOWER(%s)
                ORDER BY CAST("Market Cap" AS REAL) DESC NULLS LAST, "Ticker" ASC
                LIMIT 20
            """
            cursor.execute(peers_query, (clean_ticker, sector))
            peers = cursor.fetchall()

        peer_pe_values = [safe_num(row.get("P/E (TTM)")) for row in peers]
        peer_beta_values = [safe_num(row.get("Beta")) for row in peers]
        peer_rsi_values = [safe_num(row.get("RSI")) for row in peers]
        peer_dividend_values = [safe_num(row.get("Dividend Yield")) for row in peers]
        peer_change_values = [safe_num(row.get("Today Change %")) for row in peers]

        peer_stats = {
            "median_pe": median_value(peer_pe_values),
            "median_beta": median_value(peer_beta_values),
            "median_rsi": median_value(peer_rsi_values),
            "median_dividend_yield": median_value(peer_dividend_values),
            "median_today_change": median_value(peer_change_values),
            "peer_count": len(peers),
        }

        stock_pe = safe_num(stock.get("P/E (TTM)"))
        stock_beta = safe_num(stock.get("Beta"))
        stock_rsi = safe_num(stock.get("RSI"))
        stock_dividend = safe_num(stock.get("Dividend Yield"))
        stock_today_change = safe_num(stock.get("Today Change %"))

        relative = {
            "pe_vs_peer_median_pct": pct_diff(stock_pe, peer_stats["median_pe"]),
            "beta_vs_peer_median_pct": pct_diff(stock_beta, peer_stats["median_beta"]),
            "rsi_vs_peer_median_pct": pct_diff(stock_rsi, peer_stats["median_rsi"]),
            "dividend_vs_peer_median_pct": pct_diff(stock_dividend, peer_stats["median_dividend_yield"]),
            "today_change_vs_peer_median_pct": pct_diff(stock_today_change, peer_stats["median_today_change"]),
        }

        snapshot_score = score_stock_snapshot(stock, peer_stats)
        badges = build_stock_badges(stock, peer_stats)

        enhanced_peers = []

        for peer in peers:
            peer_dict = dict(peer)
            peer_pe = safe_num(peer_dict.get("P/E (TTM)"))
            peer_dict["Peer P/E Difference %"] = pct_diff(peer_pe, peer_stats["median_pe"])
            enhanced_peers.append(peer_dict)

        # The current Yahoo enrichment stores the analyst low/high as percentages
        # versus its pricing basis rather than retaining the raw targetLowPrice /
        # targetHighPrice columns. Reconstruct those dollar targets from the stored
        # basis price so the frontend can render a price-target range today.
        analyst_basis_price = safe_num(stock.get("Current Price"))
        analyst_mean_target = safe_num(stock.get("Mean Target"))
        analyst_upside_pct = safe_num(stock.get("Analyst Upside"))
        analyst_downside_pct = safe_num(stock.get("Analyst Downside"))
        analyst_target_high = (
            analyst_basis_price * (1.0 + analyst_upside_pct / 100.0)
            if analyst_basis_price is not None and analyst_upside_pct is not None
            else None
        )
        analyst_target_low = (
            analyst_basis_price * (1.0 + analyst_downside_pct / 100.0)
            if analyst_basis_price is not None and analyst_downside_pct is not None
            else None
        )

        analyst_targets = {
            "basis_price": analyst_basis_price,
            "low": analyst_target_low,
            "mean": analyst_mean_target,
            "high": analyst_target_high,
            "analyst_count": safe_num(stock.get("Number of Analysts")),
            "range_method": "reconstructed_from_stored_target_percentages",
        }

        # Yahoo consensus EPS history/forward estimates are stored separately so
        # the core stocks row stays compact. Keep this optional: deployments that
        # have not run the EPS backfill yet should still serve stock analysis.
        eps_estimates = {
            "events": [],
            "quarterly_consensus": [],
            "methodology": None,
            "source": None,
            "updated_at": None,
        }
        try:
            cursor.execute(
                "SELECT to_regclass('public.stock_eps_estimates') AS table_name"
            )
            table_check = cursor.fetchone() or {}
            if table_check.get("table_name"):
                cursor.execute(
                    """
                    SELECT earnings_events, quarterly_consensus, methodology, source, updated_at
                    FROM stock_eps_estimates
                    WHERE UPPER(ticker) = %s
                    LIMIT 1
                    """,
                    (clean_ticker,),
                )
                eps_row = cursor.fetchone()
                if eps_row:
                    earnings_events = eps_row.get("earnings_events")
                    quarterly_consensus = eps_row.get("quarterly_consensus")
                    eps_estimates = {
                        "events": (
                            earnings_events
                            if isinstance(earnings_events, list)
                            else parse_json_field(earnings_events) or []
                        ),
                        "quarterly_consensus": (
                            quarterly_consensus
                            if isinstance(quarterly_consensus, list)
                            else parse_json_field(quarterly_consensus) or []
                        ),
                        "methodology": eps_row.get("methodology"),
                        "source": eps_row.get("source"),
                        "updated_at": (
                            eps_row.get("updated_at").isoformat()
                            if hasattr(eps_row.get("updated_at"), "isoformat")
                            else eps_row.get("updated_at")
                        ),
                    }
        except Exception as eps_error:
            print(
                f"[WARN] EPS estimates unavailable for {clean_ticker}: "
                f"{type(eps_error).__name__}: {eps_error}"
            )

        return {
            "ticker": clean_ticker,
            "stock": dict(stock),
            "analyst_targets": analyst_targets,
            "eps_estimates": eps_estimates,
            "peers": enhanced_peers,
            "peer_stats": peer_stats,
            "relative": relative,
            "snapshot_score": snapshot_score,
            "badges": badges,
        }

    except HTTPException:
        raise

    except Exception as e:
        print(f"[ERROR] /stocks/{ticker}/analysis -> {type(e).__name__}: {e}")
        return safe_server_error_message()

    finally:
        if conn:
            conn.close()

@app.get("/stocks/live-prices")
def get_live_prices(request: Request, tickers: str = Query(...)):
    try:
        if is_route_rate_limited(request, "stocks_live_prices", *LIVE_PRICES_RATE_LIMIT):
            return {"error": "Too many requests. Please slow down and try again shortly."}

        ticker_list = [t.strip().upper() for t in tickers.split(",") if t.strip()]
        ticker_list = ticker_list[:100]

        if not ticker_list:
            return {"rows": {}}

        snapshot = get_live_market_snapshot_cached()

        if not snapshot or not snapshot.get("tickers"):
            return {"rows": {}}

        wanted = set(ticker_list)
        rows = {}

        for item in snapshot.get("tickers", []):
            ticker = item.get("ticker")
            if ticker not in wanted:
                continue

            day = item.get("day", {}) or {}
            prev_day = item.get("prevDay", {}) or {}
            min_bar = item.get("min", {}) or {}
            last_trade = item.get("lastTrade", {}) or {}

            current_price = (
                last_trade.get("p")
                or min_bar.get("c")
                or day.get("c")
                or prev_day.get("c")
            )

            rows[ticker] = {
                "Current Price": current_price,
                "Previous Close": prev_day.get("c"),
                "Day Open": day.get("o"),
                "Day High": day.get("h"),
                "Day Low": day.get("l"),
                "Day Volume": day.get("v"),
                "Today Change %": item.get("todaysChangePerc"),
            }

        return {"rows": rows}

    except Exception as e:
        print(f"[ERROR] /stocks/live-prices -> {type(e).__name__}: {e}")
        return safe_server_error_message()

@app.get("/stocks/sparklines")
def get_stock_sparklines(request: Request, tickers: str = Query(...)):
    try:
        if is_route_rate_limited(request, "stocks_sparklines", *SPARKLINES_RATE_LIMIT):
            return {"error": "Too many requests. Please slow down and try again shortly."}

        ticker_list = [t.strip().upper() for t in tickers.split(",") if t.strip()]

        if not ticker_list:
            return {"rows": {}}

        ticker_list = ticker_list[:100]

        rows = {}

        with ThreadPoolExecutor(max_workers=8) as executor:
            futures = {
                executor.submit(fetch_intraday_sparkline_cached, ticker): ticker
                for ticker in ticker_list
            }

            for future in as_completed(futures):
                result = future.result()
                rows[result["ticker"]] = {
                    "points": result["points"],
                    "change_pct": result["change_pct"],
                }

        return {"rows": rows}

    except Exception as e:
        print(f"[ERROR] /stocks/sparklines -> {type(e).__name__}: {e}")
        return safe_server_error_message()

@app.post("/backtest-strategy")
def backtest_strategy(request: Request, payload: BacktestRequest):
    try:
        if is_route_rate_limited(request, "backtest_strategy", *BACKTEST_RATE_LIMIT):
            return {"error": "Too many requests. Please slow down and try again shortly."}

        valid_ranges = {"1D", "5D", "1M", "6M", "1Y", "5Y"}
        range_key = payload.range if payload.range in valid_ranges else "1Y"

        positions = [
            {
                "ticker": p.ticker.strip().upper(),
                "weight": float(p.weight) / 100,
            }
            for p in payload.positions
            if p.ticker and p.ticker.strip() and p.weight != 0
        ]

        if not positions:
            raise HTTPException(status_code=400, detail="At least one strategy position is required.")

        if len(positions) > MAX_BACKTEST_POSITIONS:
            raise HTTPException(
                status_code=400,
                detail=f"A strategy may contain at most {MAX_BACKTEST_POSITIONS} positions.",
            )

        benchmark = payload.benchmark.strip().upper() if payload.benchmark else "SPY"

        tickers_to_fetch = list({p["ticker"] for p in positions} | {benchmark})

        chart_results = {}

        with ThreadPoolExecutor(max_workers=min(8, len(tickers_to_fetch))) as executor:
            futures = {
                executor.submit(fetch_chart_data_cached, ticker, range_key): ticker
                for ticker in tickers_to_fetch
            }

            for future in as_completed(futures):
                ticker = futures[future]
                chart_results[ticker] = normalize_chart_points(future.result())

        benchmark_points = chart_results.get(benchmark, [])

        if len(benchmark_points) < 2:
            raise HTTPException(status_code=400, detail="Not enough benchmark data available.")

        benchmark_points = sorted(benchmark_points, key=lambda p: p["time"])

        if len(benchmark_points) < 2:
            raise HTTPException(status_code=400, detail="Not enough benchmark data available.")

        benchmark_start = benchmark_points[0]["close"]

        position_series = {}

        for position in positions:
            ticker = position["ticker"]
            ticker_points = sorted(chart_results.get(ticker, []), key=lambda p: p["time"])

            if len(ticker_points) < 2:
                continue

            start_price = ticker_points[0]["close"]

            if not start_price:
                continue

            position_series[ticker] = {
                "weight": position["weight"],
                "points": ticker_points,
                "start_price": start_price,
            }

        if not position_series:
            raise HTTPException(status_code=400, detail="Not enough price history for the selected strategy.")

        strategy_points = []
        benchmark_series = []
        strategy_values = []
        strategy_returns = []
        benchmark_returns = []

        previous_strategy_value = None
        previous_benchmark_value = None

        for index, benchmark_point in enumerate(benchmark_points):
            benchmark_price = benchmark_point["close"]

            if not benchmark_start or not benchmark_price:
                continue

            weighted_return = 0

            for ticker, series in position_series.items():
                ticker_points = series["points"]

                # Use the closest matching index instead of requiring exact same timestamp
                ticker_index = min(index, len(ticker_points) - 1)

                current_price = ticker_points[ticker_index]["close"]
                start_price = series["start_price"]
                weight = series["weight"]

                if not start_price or not current_price:
                    continue

                asset_return = (current_price / start_price) - 1

                # Positive weight = long.
                # Negative weight = short.
                weighted_return += weight * asset_return

            strategy_value = 100 * (1 + weighted_return)
            benchmark_value = 100 * (benchmark_price / benchmark_start)

            if (
                previous_strategy_value is not None
                and previous_strategy_value != 0
                and previous_benchmark_value is not None
                and previous_benchmark_value != 0
            ):
                strategy_returns.append((strategy_value / previous_strategy_value) - 1)
                benchmark_returns.append((benchmark_value / previous_benchmark_value) - 1)

            previous_strategy_value = strategy_value
            previous_benchmark_value = benchmark_value

            strategy_values.append(strategy_value)

            strategy_points.append({
                "time": benchmark_point["time"],
                "strategy": strategy_value,
                "benchmark": benchmark_value,
            })

            benchmark_series.append(benchmark_value)

        strategy_return = strategy_points[-1]["strategy"] - 100
        benchmark_return = strategy_points[-1]["benchmark"] - 100
        outperformance = strategy_return - benchmark_return
        max_drawdown = calculate_max_drawdown(strategy_values)
        volatility = calculate_volatility(strategy_returns)
        quant_metrics = calculate_backtest_quant_metrics(
            strategy_returns=strategy_returns,
            benchmark_returns=benchmark_returns,
            max_drawdown=max_drawdown,
            range_key=range_key,
        )

        attribution_rows = []

        for ticker, series in position_series.items():
            ticker_points = series["points"]
            prices = [
                point["close"]
                for point in ticker_points
                if point.get("close") is not None and point.get("close") > 0
            ]

            if len(prices) < 2:
                continue

            start_price = prices[0]
            end_price = prices[-1]

            if not start_price:
                continue

            holding_return = ((end_price / start_price) - 1) * 100
            contribution = series["weight"] * holding_return
            holding_volatility = calculate_holding_volatility_from_prices(prices)

            attribution_rows.append({
                "ticker": ticker,
                "weight": series["weight"] * 100,
                "holdingReturn": holding_return,
                "contribution": contribution,
                "volatility": holding_volatility,
            })

        sorted_by_contribution = sorted(
            attribution_rows,
            key=lambda row: row["contribution"],
            reverse=True
        )

        sorted_by_volatility = sorted(
            attribution_rows,
            key=lambda row: row["volatility"],
            reverse=True
        )

        holding_attribution = {
            "rows": attribution_rows,
            "bestContributor": sorted_by_contribution[0] if sorted_by_contribution else None,
            "worstContributor": sorted_by_contribution[-1] if sorted_by_contribution else None,
            "mostVolatile": sorted_by_volatility[0] if sorted_by_volatility else None,
        }

        return {
            "benchmark": benchmark,
            "range": range_key,
            "positions": positions,
            "strategyReturn": strategy_return,
            "benchmarkReturn": benchmark_return,
            "outperformance": outperformance,
            "maxDrawdown": max_drawdown,
            "volatility": volatility,
            "quantMetrics": quant_metrics,
            "points": strategy_points,
            "holdingAttribution": holding_attribution,
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"[ERROR] /backtest-strategy -> {type(e).__name__}: {e}")
        return safe_server_error_message()

@app.get("/stocks/{ticker}/chart")
def get_stock_chart(request: Request, ticker: str, range: str = Query("1D")):
    try:
        if is_route_rate_limited(request, "stocks_chart", *CHART_RATE_LIMIT):
            return {"error": "Too many requests. Please slow down and try again shortly."}

        return fetch_chart_data_cached(ticker.upper(), range)
    except Exception as e:
        print(f"[ERROR] /stocks/{ticker}/chart -> {type(e).__name__}: {e}")
        return safe_server_error_message()

@app.get("/stocks/{ticker}")
def get_stock_detail(ticker: str):
    conn = None
    try:
        conn = get_db_connection_dict()
        cursor = conn.cursor()

        cursor.execute("""
            SELECT
                s."Ticker",
                s."Company Name",
                s."Description",
                s."Type",
                s."Sector",
                s."Current Price",
                s."Previous Close",
                s."Day Open",
                s."Day High",
                s."Day Low",
                s."Day Volume",
                s."Today Change %%",
                s."Market Cap",
                s."EPS (TTM)",
                s."P/E (TTM)",
                s."Dividend Yield",
                s."RSI",
                s."MACD",
                s."MACD Signal",
                s."MACD Histogram",
                s."SMA 20",
                s."Beta",
                s."EBITDA",
                s."Short %% of Float",
                s."Gross Profit",
                s."Analyst Upside",
                s."Analyst Downside",
                s."Mean Target",
                s."Number of Analysts",
                s."Latest Dividend Amount",
                s."Latest Ex-Dividend Date",
                s."Latest Pay Date",
                s."Dividend Frequency",
                s."Latest 10-K Date",
                s."Latest 10-K URL",
                s."Latest 10-Q Date",
                s."Latest 10-Q URL",
                s."Last Updated",
                d."Financials Last Updated"
            FROM stocks s
            LEFT JOIN stock_details d
                ON s."Ticker" = d."Ticker"
            WHERE s."Ticker" = %s
            LIMIT 1
        """, (ticker.upper(),))

        row = cursor.fetchone()

        if not row:
            raise HTTPException(status_code=404, detail="Ticker not found")

        return clean_row(row)

    except HTTPException:
        raise
    except Exception as e:
        print(f"[ERROR] /stocks/{ticker} -> {type(e).__name__}: {e}")
        return safe_server_error_message()

    finally:
        if conn:
            conn.close()


@app.get("/stocks/{ticker}/financials")
def get_stock_financials(ticker: str):
    conn = None
    try:
        conn = get_db_connection_dict()
        cursor = conn.cursor()

        cursor.execute("""
            SELECT
                d."Ticker",
                d."Balance Sheet JSON",
                d."Income Statement JSON",
                d."Cash Flow JSON",
                d."Financials Last Updated"
            FROM stock_details d
            WHERE d."Ticker" = %s
            LIMIT 1
        """, (ticker.upper(),))

        row = cursor.fetchone()

        if not row:
            raise HTTPException(status_code=404, detail="Ticker not found")

        result = clean_row(row)
        result["Balance Sheet JSON"] = parse_json_field(result.get("Balance Sheet JSON"))
        result["Income Statement JSON"] = parse_json_field(result.get("Income Statement JSON"))
        result["Cash Flow JSON"] = parse_json_field(result.get("Cash Flow JSON"))

        return result

    except HTTPException:
        raise
    except Exception as e:
        print(f"[ERROR] /stocks/{ticker}/financials -> {type(e).__name__}: {e}")
        return safe_server_error_message()

    finally:
        if conn:
            conn.close()


@app.get("/sectors")
def get_sectors():
    conn = None
    try:
        conn = get_db_connection_dict()
        cursor = conn.cursor()

        cursor.execute("""
            SELECT DISTINCT "Sector"
            FROM stocks
            WHERE "Sector" IS NOT NULL
              AND "Sector" <> ''
            ORDER BY "Sector" ASC
        """)

        rows = cursor.fetchall()

        return [
            row["Sector"]
            for row in rows
            if row["Sector"] and str(row["Sector"]).strip()
        ]

    except Exception as e:
        print(f"[ERROR] /sectors -> {type(e).__name__}: {e}")
        return []

    finally:
        if conn:
            conn.close()

@app.get("/security-types")
def get_security_types():
    conn = None
    try:
        conn = get_db_connection_dict()
        cursor = conn.cursor()

        cursor.execute("""
            SELECT DISTINCT "Type"
            FROM stocks
            WHERE "Type" IS NOT NULL
              AND TRIM("Type") != ''
            ORDER BY "Type" ASC
        """)

        rows = cursor.fetchall()
        return [row["Type"] for row in rows]

    except Exception as e:
        print(f"[ERROR] /security-types -> {type(e).__name__}: {e}")
        return safe_server_error_message()

    finally:
        if conn:
            conn.close()


@app.get("/sector-performance")
def get_sector_performance():
    conn = None
    try:
        conn = get_db_connection_dict()
        cursor = conn.cursor()

        cursor.execute("""
            SELECT
                "Sector",
                AVG(CAST("Today Change %" AS REAL)) AS avg_change
            FROM stocks
            WHERE "Sector" IS NOT NULL
              AND TRIM("Sector") != ''
              AND "Today Change %" IS NOT NULL
              AND TRIM(CAST("Today Change %" AS TEXT)) != ''
              AND UPPER("Type") = 'CS'
              AND "Sector" IN (
                  'Basic Materials',
                  'Communication Services',
                  'Consumer Cyclical',
                  'Consumer Defensive',
                  'Energy',
                  'Financial Services',
                  'Healthcare',
                  'Industrials',
                  'Real Estate',
                  'Technology',
                  'Utilities'
              )
            GROUP BY "Sector"
            ORDER BY "Sector" ASC
        """)

        rows = cursor.fetchall()

        return {
            row["Sector"]: row["avg_change"]
            for row in rows
            if row["avg_change"] is not None
        }

    except Exception as e:
        print(f"[ERROR] /sector-performance -> {type(e).__name__}: {e}")
        return safe_server_error_message()

    finally:
        if conn:
            conn.close()

@app.get("/market-outlook-snapshot")
def get_market_outlook_snapshot():
    conn = None

    try:
        snapshot = get_polygon_json(
            "/v2/snapshot/locale/us/markets/stocks/tickers",
            {"include_otc": "false"},
            timeout=60,
        )

        if not snapshot or not snapshot.get("tickers"):
            return {"error": "Snapshot data unavailable."}

        snapshot_items = snapshot.get("tickers", [])

        tickers = [
            item.get("ticker")
            for item in snapshot_items
            if item.get("ticker")
        ]

        ticker_meta = {}

        if tickers:
            conn = get_db_connection_dict()
            cursor = conn.cursor()

            for i in range(0, len(tickers), 1000):
                batch = tickers[i:i + 1000]
                placeholders = ",".join(["%s"] * len(batch))

                cursor.execute(f"""
                    SELECT
                        "Ticker",
                        "Company Name",
                        "Description",
                        "Type",
                        "Sector",
                        "Market Cap"
                    FROM stocks
                    WHERE "Ticker" IN ({placeholders})
                """, batch)

                rows = cursor.fetchall()

                for row in rows:
                    ticker_meta[row["Ticker"]] = {
                        "Company Name": row.get("Company Name"),
                        "Description": row.get("Description"),
                        "Type": row.get("Type"),
                        "Sector": row.get("Sector"),
                        "Market Cap": row.get("Market Cap"),
                    }

        market_rows = []

        for item in snapshot_items:
            ticker = item.get("ticker")
            if not ticker:
                continue

            meta = ticker_meta.get(ticker, {})

            if str(meta.get("Type", "")).upper() != "CS":
                continue

            day = item.get("day", {}) or {}
            prev_day = item.get("prevDay", {}) or {}
            min_bar = item.get("min", {}) or {}
            last_trade = item.get("lastTrade", {}) or {}

            current_price = (
                safe_float(last_trade.get("p"))
                or safe_float(min_bar.get("c"))
                or safe_float(day.get("c"))
                or safe_float(prev_day.get("c"))
            )

            change_pct = safe_float(item.get("todaysChangePerc"))

            if current_price is None or change_pct is None:
                continue

            market_rows.append({
                "Ticker": ticker,
                "Company Name": meta.get("Company Name"),
                "Description": meta.get("Description"),
                "Type": meta.get("Type"),
                "Sector": meta.get("Sector"),
                "Market Cap": meta.get("Market Cap"),
                "Current Price": current_price,
                "Previous Close": safe_float(prev_day.get("c")),
                "Day Open": safe_float(day.get("o")),
                "Day High": safe_float(day.get("h")),
                "Day Low": safe_float(day.get("l")),
                "Day Volume": safe_float(day.get("v")),
                "Today Change %": change_pct,
            })

        gainers = sorted(
            market_rows,
            key=lambda row: row["Today Change %"],
            reverse=True
        )[:10]

        losers = sorted(
            market_rows,
            key=lambda row: row["Today Change %"]
        )[:10]

        gainers_above_5 = sorted(
            [row for row in market_rows if row["Current Price"] >= 5],
            key=lambda row: row["Today Change %"],
            reverse=True
        )[:10]

        losers_above_5 = sorted(
            [row for row in market_rows if row["Current Price"] >= 5],
            key=lambda row: row["Today Change %"]
        )[:10]

        buckets = {
            "<-10%": 0,
            "-10% to -5%": 0,
            "-5% to -2%": 0,
            "-2% to 0%": 0,
            "0%": 0,
            "0% to 2%": 0,
            "2% to 5%": 0,
            "5% to 10%": 0,
            ">10%": 0,
        }

        advancers = 0
        decliners = 0
        unchanged = 0

        for row in market_rows:
            value = row["Today Change %"]

            if value < 0:
                decliners += 1
            elif value > 0:
                advancers += 1
            else:
                unchanged += 1

            if value < -10:
                buckets["<-10%"] += 1
            elif value < -5:
                buckets["-10% to -5%"] += 1
            elif value < -2:
                buckets["-5% to -2%"] += 1
            elif value < 0:
                buckets["-2% to 0%"] += 1
            elif value == 0:
                buckets["0%"] += 1
            elif value <= 2:
                buckets["0% to 2%"] += 1
            elif value <= 5:
                buckets["2% to 5%"] += 1
            elif value <= 10:
                buckets["5% to 10%"] += 1
            else:
                buckets[">10%"] += 1

        summary_tickers = {"SPY", "QQQ", "DIA", "IWM", "IBIT", "USO", "GLD", "VIXY"}
        market_summary = {}

        for item in snapshot_items:
            ticker = item.get("ticker")

            if ticker not in summary_tickers:
                continue

            day = item.get("day", {}) or {}
            prev_day = item.get("prevDay", {}) or {}
            min_bar = item.get("min", {}) or {}
            last_trade = item.get("lastTrade", {}) or {}

            current_price = (
                safe_float(last_trade.get("p"))
                or safe_float(min_bar.get("c"))
                or safe_float(day.get("c"))
                or safe_float(prev_day.get("c"))
            )

            market_summary[ticker] = {
                "price": current_price,
                "change": safe_float(item.get("todaysChangePerc")),
            }

        return {
            "gainers": gainers,
            "losers": losers,
            "gainersAbove5": gainers_above_5,
            "losersAbove5": losers_above_5,
            "breadth": {
                "buckets": buckets,
                "advancers": advancers,
                "decliners": decliners,
                "unchanged": unchanged,
                "total": len(market_rows),
            },
            "marketSummary": market_summary,
            "source": "polygon_snapshot",
        }

    except Exception as e:
        print(f"[ERROR] /market-outlook-snapshot -> {type(e).__name__}: {e}")
        return safe_server_error_message()

    finally:
        if conn:
            conn.close()

@app.get("/market-breadth")
def get_market_breadth():
    conn = None
    try:
        conn = get_db_connection_dict()
        cursor = conn.cursor()

        cursor.execute("""
            SELECT CAST("Today Change %" AS REAL) AS change_pct
            FROM stocks
            WHERE UPPER("Type") = 'CS'
              AND "Today Change %" IS NOT NULL
              AND TRIM(CAST("Today Change %" AS TEXT)) != ''
        """)

        rows = cursor.fetchall()

        changes = [row["change_pct"] for row in rows if row["change_pct"] is not None]

        buckets = {
            "<-10%": 0,
            "-10% to -5%": 0,
            "-5% to -2%": 0,
            "-2% to 0%": 0,
            "0%": 0,
            "0% to 2%": 0,
            "2% to 5%": 0,
            "5% to 10%": 0,
            ">10%": 0,
        }

        advancers = 0
        decliners = 0
        unchanged = 0

        for value in changes:
            if value < 0:
                decliners += 1
            elif value > 0:
                advancers += 1
            else:
                unchanged += 1

            if value < -10:
                buckets["<-10%"] += 1
            elif value < -5:
                buckets["-10% to -5%"] += 1
            elif value < -2:
                buckets["-5% to -2%"] += 1
            elif value < 0:
                buckets["-2% to 0%"] += 1
            elif value == 0:
                buckets["0%"] += 1
            elif value <= 2:
                buckets["0% to 2%"] += 1
            elif value <= 5:
                buckets["2% to 5%"] += 1
            elif value <= 10:
                buckets["5% to 10%"] += 1
            else:
                buckets[">10%"] += 1

        return {
            "buckets": buckets,
            "advancers": advancers,
            "decliners": decliners,
            "unchanged": unchanged,
            "total": len(changes),
        }

    except Exception as e:
        print(f"[ERROR] /market-breadth -> {type(e).__name__}: {e}")
        return safe_server_error_message()

    finally:
        if conn:
            conn.close()

@app.get("/smart-money/market-leaders")
def get_smart_money_market_leaders(
    days: int = Query(90, ge=1, le=365),
    limit: int = Query(8, ge=1, le=25),
):
    conn = get_db_connection_dict()

    try:
        cur = conn.cursor()

        def fetch_leaders(transaction_code):
            cur.execute(
                """
                select
                    upper(ticker) as ticker,
                    max(company) as company,
                    count(*) as transaction_count,
                    sum(coalesce(value, 0)) as total_value,
                    max(transaction_date) as latest_date
                from insider_transactions
                where transaction_code = %s
                  and transaction_date is not null
                  and transaction_date >= current_date - (%s * interval '1 day')
                group by upper(ticker)
                having sum(coalesce(value, 0)) > 0
                order by total_value desc nulls last, transaction_count desc
                limit %s
                """,
                (transaction_code, days, limit),
            )

            rows = cur.fetchall()

            return [
                {
                    "ticker": row["ticker"],
                    "company": row["company"],
                    "transactionCount": int(row["transaction_count"] or 0),
                    "totalValue": float(row["total_value"] or 0),
                    "latestDate": row["latest_date"].isoformat()
                    if row["latest_date"]
                    else None,
                }
                for row in rows
            ]

        return {
            "days": days,
            "buys": fetch_leaders("P"),
            "sells": fetch_leaders("S"),
        }

    finally:
        conn.close()

@app.get("/smart-money/{ticker}")
def get_smart_money_from_database(
    ticker: str,
    limit: int = Query(80, ge=1, le=250),
    signal: str = Query("all"),
):
    clean_ticker = ticker.strip().upper()

    if not clean_ticker:
        raise HTTPException(status_code=400, detail="Ticker is required.")

    clean_signal = signal.strip().lower()

    conn = None

    try:
        conn = get_db_connection_dict()
        cursor = conn.cursor()

        where_clauses = [
            "upper(ticker) = %s",
            "transaction_code in ('P', 'S')"
        ]
        params = [clean_ticker]

        if clean_signal == "bullish":
            where_clauses.append("signal = %s")
            params.append("Bullish")
        elif clean_signal == "bearish":
            where_clauses.append("signal = %s")
            params.append("Bearish")

        params.append(limit)

        cursor.execute(
            f"""
            select
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
                created_at
            from insider_transactions
            where {" and ".join(where_clauses)}
            order by transaction_date desc nulls last, filing_date desc nulls last, created_at desc
            limit %s
            """,
            params,
        )

        rows = cursor.fetchall()

        transactions = []

        for row in rows:
            transactions.append({
                "ticker": row.get("ticker"),
                "company": row.get("company"),
                "insider": row.get("insider"),
                "title": row.get("title"),
                "transactionType": row.get("transaction_type"),
                "transactionCode": row.get("transaction_code"),
                "securityTitle": row.get("security_title"),
                "shares": float(row["shares"]) if row.get("shares") is not None else None,
                "price": float(row["price"]) if row.get("price") is not None else None,
                "value": float(row["value"]) if row.get("value") is not None else None,
                "date": row.get("transaction_date").isoformat() if row.get("transaction_date") else None,
                "filingDate": row.get("filing_date").isoformat() if row.get("filing_date") else None,
                "reportDate": row.get("report_date").isoformat() if row.get("report_date") else None,
                "sharesOwnedFollowing": (
                    float(row["shares_owned_following"])
                    if row.get("shares_owned_following") is not None
                    else None
                ),
                "signal": row.get("signal"),
                "source": row.get("source") or "SEC Form 4",
                "accessionNumber": row.get("accession_number"),
                "filingUrl": row.get("filing_url"),
                "isDerivative": row.get("is_derivative"),
            })

        summary = build_smart_money_summary(transactions)

        return {
            "ticker": clean_ticker,
            "source": "Supabase insider_transactions",
            "summary": summary,
            "transactions": transactions,
            "count": len(transactions),
            "cached": True,
        }

    except Exception as e:
        print(f"[ERROR] /smart-money/{ticker} database route -> {type(e).__name__}: {e}", flush=True)
        return {
            "ticker": clean_ticker,
            "source": "Supabase insider_transactions",
            "summary": build_smart_money_summary([]),
            "transactions": [],
            "count": 0,
            "error": str(e),
        }

    finally:
        if conn:
            conn.close()

@app.get("/market-summary")
def get_market_summary():
    conn = None
    try:
        conn = get_db_connection_dict()
        cursor = conn.cursor()

        cursor.execute("""
            SELECT
                "Ticker",
                CAST("Current Price" AS REAL) AS price,
                CAST("Today Change %" AS REAL) AS change
            FROM stocks
            WHERE "Ticker" IN ('SPY', 'QQQ', 'DIA', 'IWM', 'IBIT', 'USO', 'GLD', 'VIXY')
        """)

        rows = cursor.fetchall()

        return {
            row["Ticker"]: {
                "price": row["price"],
                "change": row["change"]
            }
            for row in rows
        }

    except Exception as e:
        print(f"[ERROR] /market-summary -> {type(e).__name__}: {e}")
        return safe_server_error_message()

    finally:
        if conn:
            conn.close()

def NumberSafe(value):
    try:
        return float(value)
    except Exception:
        return 0.0

@app.get("/hidden-pairs/{ticker}")
def get_hidden_pairs(
    ticker: str,
    match_type: str = "All",
    limit: int = 20,
    stock_limit: int = 10,
    etf_limit: int = 20,
    hedge_limit: int = 10,
):
    ticker = ticker.upper().strip()

    if not ticker:
        return {
            "ticker": "",
            "matches": [],
            "topStocks": [],
            "topEtfs": [],
            "hedgeCandidates": [],
        }

    conn = get_db_connection_dict()

    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                select
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
                from hidden_pair_correlations
                where base_ticker = %s
                order by correlation desc
                limit 150
                """,
                [ticker],
            )

            rows = cur.fetchall()

        if not rows:
            return {
                "ticker": ticker,
                "name": None,
                "type": None,
                "sector": None,
                "lookbackDays": None,
                "updatedAt": None,
                "matches": [],
                "topStocks": [],
                "topEtfs": [],
                "hedgeCandidates": [],
                "message": "No correlation matches found yet.",
            }

        def format_row(row):
            return {
                "ticker": row["match_ticker"],
                "name": row["match_name"],
                "type": row["match_type"],
                "sector": row["match_sector"],
                "correlationDirection": row.get("correlation_direction") or "positive",
                "correlation": float(row["correlation"]) if row["correlation"] is not None else None,
                "relationship": row["relationship"],
            }

        all_matches = [format_row(row) for row in rows]

        positive_matches = [
            match for match in all_matches
            if str(match.get("correlationDirection") or "positive").lower() == "positive"
        ]

        hedge_candidates = [
            match for match in all_matches
            if str(match.get("correlationDirection") or "").lower() == "negative"
        ]

        # Positive matches sorted highest-to-lowest correlation.
        positive_matches = sorted(
            positive_matches,
            key=lambda match: NumberSafe(match.get("correlation")),
            reverse=True,
        )

        # Hedge candidates sorted most negative first.
        hedge_candidates = sorted(
            hedge_candidates,
            key=lambda match: NumberSafe(match.get("correlation")),
        )[:hedge_limit]

        top_stocks = [
            match for match in positive_matches
            if str(match.get("type") or "").lower() == "stock"
        ][:stock_limit]

        top_etfs = [
            match for match in positive_matches
            if str(match.get("type") or "").lower() == "etf"
        ][:etf_limit]

        if match_type and match_type.lower() == "stock":
            visible_matches = top_stocks[:limit]
        elif match_type and match_type.lower() == "etf":
            visible_matches = top_etfs[:limit]
        else:
            visible_matches = positive_matches[:limit]

        first = rows[0]

        return {
            "ticker": first["base_ticker"],
            "name": first.get("base_name"),
            "type": first.get("base_type"),
            "sector": first.get("base_sector"),
            "lookbackDays": first.get("lookback_days"),
            "updatedAt": first.get("updated_at"),
            "matches": visible_matches,
            "topStocks": top_stocks,
            "topEtfs": top_etfs,
            "hedgeCandidates": hedge_candidates,
        }

    finally:
        conn.close()