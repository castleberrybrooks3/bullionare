#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Dict, Iterable, List, Optional, Tuple

import psycopg2
import psycopg2.extras
import requests
from bs4 import BeautifulSoup
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL") or os.getenv("SUPABASE_DB_URL")
SEC_USER_AGENT = os.getenv("SEC_USER_AGENT") or "BullionaireIQ info@bullionaireiq.com"

try:
    from db import get_db_connection_dict
except Exception:
    get_db_connection_dict = None

SEC_COMPANY_TICKERS_URL = "https://www.sec.gov/files/company_tickers.json"
SEC_SUBMISSIONS_URL = "https://data.sec.gov/submissions/CIK{cik10}.json"
SEC_ARCHIVE_BASE = "https://www.sec.gov/Archives/edgar/data"

PREFERRED_FORMS = [
    "DEF 14A",
    "DEFA14A",
    "PRE 14A",
    "10-K",
    "10-K/A",
]

REQUEST_DELAY_SECONDS = 0.22

NAME_STOPWORDS = {
    "name",
    "age",
    "director",
    "directors",
    "nominee",
    "nominees",
    "executive",
    "executives",
    "officer",
    "officers",
    "position",
    "title",
    "committee",
    "committees",
    "audit",
    "compensation",
    "governance",
    "corporate",
    "table",
    "proposal",
    "proxy",
    "statement",
    "board",
    "independent",
    "shares",
    "stock",
    "ownership",
    "percent",
    "percentage",
    "total",
    "beneficial",
    "amount",
    "class",
    "common",
    "security",
    "securities",
}

COMMITTEE_KEYWORDS = {
    "Audit": ["audit"],
    "Compensation": ["compensation"],
    "Governance": ["governance", "nominating"],
    "Risk": ["risk"],
    "Finance": ["finance"],
    "Technology": ["technology", "cybersecurity", "cyber"],
    "Executive": ["executive committee"],
}

EXECUTIVE_KEYWORDS = [
    "chief",
    "ceo",
    "cfo",
    "coo",
    "cto",
    "president",
    "executive",
    "officer",
    "general counsel",
    "controller",
    "treasurer",
]

def contains_keyword(text: str, keyword: str) -> bool:
    normalized_text = normalize_ws(text).lower()
    normalized_keyword = normalize_ws(keyword).lower()

    return bool(
        re.search(
            rf"(?<![a-z0-9]){re.escape(normalized_keyword)}(?![a-z0-9])",
            normalized_text,
        )
    )


def contains_any_keyword(text: str, keywords: List[str]) -> bool:
    return any(
        contains_keyword(text, keyword)
        for keyword in keywords
    )

DIRECTOR_KEYWORDS = [
    "director",
    "nominee",
    "chair",
    "board",
]


@dataclass
class FilingRef:
    form: str
    filing_date: str
    accession: str
    primary_doc: str
    filing_url: str
    html_url: str


def require_env() -> None:
    if not DATABASE_URL and get_db_connection_dict is None:
        raise RuntimeError(
            "No database connection found. Set DATABASE_URL/SUPABASE_DB_URL or make sure db.py has get_db_connection_dict."
        )

    if not SEC_USER_AGENT:
        raise RuntimeError("SEC_USER_AGENT is required.")

def get_script_db_connection():
    if get_db_connection_dict is not None:
        return get_db_connection_dict()

    return psycopg2.connect(DATABASE_URL)


def sec_session() -> requests.Session:
    session = requests.Session()
    session.headers.update(
        {
            "User-Agent": SEC_USER_AGENT,
            "Accept-Encoding": "gzip, deflate",
        }
    )
    return session


def normalize_ws(value: Any) -> str:
    if value is None:
        return ""

    text = str(value)
    text = text.replace("\xa0", " ")
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def clean_company_name(value: str) -> str:
    text = normalize_ws(value)
    text = re.sub(r"\s+", " ", text)
    return text


def slugify(value: str) -> str:
    text = normalize_ws(value).lower()
    text = re.sub(r"[^a-z0-9]+", "-", text)
    text = re.sub(r"(^-|-$)+", "", text)
    return text or "unknown"
def normalize_person_name(value: str) -> str:
    text = normalize_ws(value)

    if not text:
        return ""

    # Remove filing-table labels and biography headings that may be
    # attached to the front of a real person's name.
    leading_labels = [
        r"career highlights",
        r"director biography",
        r"director biographies",
        r"executive biography",
        r"executive biographies",
        r"board nominee",
        r"director nominee",
        r"nominee",
        r"chairperson",
        r"chairman",
        r"chairwoman",
        r"lead director",
        r"independent director",
        r"ncgc",
        r"ac",
        r"cc",
    ]

    changed = True

    while changed:
        changed = False

        for label in leading_labels:
            cleaned = re.sub(
                rf"^\s*(?:{label})\s*[:\-–—|]*\s+",
                "",
                text,
                count=1,
                flags=re.IGNORECASE,
            )

            if cleaned != text:
                text = normalize_ws(cleaned)
                changed = True

    # Remove honorifics after filing labels have been stripped.
    text = re.sub(
        r"^(mr|mrs|ms|miss|dr|prof)\.?\s+",
        "",
        text,
        flags=re.IGNORECASE,
    )

    # Remove trailing role labels accidentally attached to a name.
    text = re.sub(
        r"\s+(?:"
        r"chairperson|chairman|chairwoman|"
        r"lead director|independent director|"
        r"director nominee|board nominee"
        r")$",
        "",
        text,
        flags=re.IGNORECASE,
    )

    # Keep legitimate suffixes as part of the canonical name.
    # Do not remove Jr., Sr., II, III, or IV because those may be
    # needed to distinguish people.
    text = text.strip(" ,.;:|–—-")

    return normalize_ws(text)


def only_digits(value: str) -> str:
    return re.sub(r"\D+", "", str(value or ""))


def cik10(value: str | int) -> str:
    return str(only_digits(str(value))).zfill(10)


def accession_no_dashes(accession: str) -> str:
    return normalize_ws(accession).replace("-", "")


def request_json(session: requests.Session, url: str) -> Any:
    time.sleep(REQUEST_DELAY_SECONDS)
    response = session.get(url, timeout=30)
    response.raise_for_status()
    return response.json()


def request_text(session: requests.Session, url: str) -> str:
    time.sleep(REQUEST_DELAY_SECONDS)
    response = session.get(url, timeout=45)
    response.raise_for_status()
    return response.text


def build_ticker_map(session: requests.Session) -> Dict[str, Dict[str, str]]:
    raw = request_json(session, SEC_COMPANY_TICKERS_URL)
    output: Dict[str, Dict[str, str]] = {}

    for item in raw.values():
        ticker = normalize_ws(item.get("ticker", "")).upper()
        if not ticker:
            continue

        output[ticker] = {
            "ticker": ticker,
            "cik": cik10(item.get("cik_str")),
            "company": clean_company_name(item.get("title", "")),
        }

    return output


def get_tickers_from_supabase(table: str, column: str, limit: Optional[int]) -> List[str]:
    safe_table = table.replace('"', "")
    safe_column = column.replace('"', "")

    with get_script_db_connection() as conn:
        with conn.cursor() as cur:
            sql = f"""
                select distinct upper("{safe_column}"::text) as ticker
                from "{safe_table}"
                where "{safe_column}" is not null
                  and trim("{safe_column}"::text) <> ''
                  and upper(coalesce("Type"::text, '')) in ('CS', 'COMMON STOCK', 'STOCK')
                  and upper("{safe_column}"::text) not like '%%.WS'
                  and upper("{safe_column}"::text) not like '%%.U'
                  and upper("{safe_column}"::text) not like '%%.R'
                  and upper("{safe_column}"::text) not like '%%-W'
                  and upper("{safe_column}"::text) not like '%%-U'
                  and upper("{safe_column}"::text) not like '%%-R'
                order by upper("{safe_column}"::text)
            """

            if limit:
                sql += f" limit {int(limit)}"

            cur.execute(sql)
            rows = cur.fetchall()

            tickers = []

            for row in rows:
                if isinstance(row, dict):
                    tickers.append(row.get("ticker"))
                elif hasattr(row, "keys") and "ticker" in row.keys():
                    tickers.append(row["ticker"])
                else:
                    tickers.append(row[0])

            return [
                str(ticker).strip().upper()
                for ticker in tickers
                if ticker
            ]


def find_latest_filing(session: requests.Session, cik: str) -> Optional[FilingRef]:
    data = request_json(session, SEC_SUBMISSIONS_URL.format(cik10=cik10(cik)))

    recent = data.get("filings", {}).get("recent", {})
    forms = recent.get("form", [])
    dates = recent.get("filingDate", [])
    accessions = recent.get("accessionNumber", [])
    primary_docs = recent.get("primaryDocument", [])

    rows = []

    for idx, form in enumerate(forms):
        rows.append(
            {
                "form": normalize_ws(form),
                "filing_date": dates[idx] if idx < len(dates) else "",
                "accession": accessions[idx] if idx < len(accessions) else "",
                "primary_doc": primary_docs[idx] if idx < len(primary_docs) else "",
            }
        )

    chosen = None

    for preferred_form in PREFERRED_FORMS:
        chosen = next((row for row in rows if row["form"] == preferred_form), None)
        if chosen:
            break

    if not chosen:
        return None

    cik_int = str(int(cik))
    accession_clean = accession_no_dashes(chosen["accession"])
    filing_folder = f"{SEC_ARCHIVE_BASE}/{cik_int}/{accession_clean}"
    primary_doc = chosen["primary_doc"] or ""

    if not primary_doc:
        primary_doc = find_primary_doc_from_index(session, cik_int, accession_clean)

    if not primary_doc:
        return None

    html_url = f"{filing_folder}/{primary_doc}"

    return FilingRef(
        form=chosen["form"],
        filing_date=chosen["filing_date"],
        accession=chosen["accession"],
        primary_doc=primary_doc,
        filing_url=filing_folder,
        html_url=html_url,
    )


def find_primary_doc_from_index(
    session: requests.Session,
    cik_int: str,
    accession_clean: str,
) -> str:
    index_url = f"{SEC_ARCHIVE_BASE}/{cik_int}/{accession_clean}/index.json"

    try:
      index = request_json(session, index_url)
    except Exception:
      return ""

    items = index.get("directory", {}).get("item", [])

    html_items = [
        item.get("name", "")
        for item in items
        if str(item.get("name", "")).lower().endswith((".htm", ".html"))
    ]

    for name in html_items:
        if not name.lower().startswith(("xsl", "form")):
            return name

    return html_items[0] if html_items else ""


def soup_from_html(html: str) -> BeautifulSoup:
    soup = BeautifulSoup(html, "html.parser")

    for tag in soup(["script", "style", "noscript"]):
        tag.decompose()

    return soup

def split_person_name_list(value: str) -> List[str]:
    text = normalize_ws(value)

    text = re.sub(
        r"\s+and\s+",
        ", ",
        text,
        flags=re.IGNORECASE,
    )

    candidates = [
        normalize_person_name(item)
        for item in text.split(",")
        if normalize_ws(item)
    ]

    output = []

    for candidate in candidates:
        if not is_probable_name(candidate):
            continue

        if candidate not in output:
            output.append(candidate)

    return output


def extract_board_nominee_names(soup: BeautifulSoup) -> List[str]:
    text = normalize_ws(
        soup.get_text(" ", strip=True)
    )

    patterns = [
        (
            r"The Board has nominated\s+(.{10,500}?)\s+"
            r"to be elected to serve on our Board"
        ),
        (
            r"election to .*? Board of Directors of the "
            r"(?:eight|seven|nine|ten|eleven|twelve|\d+) nominees "
            r"named in the Proxy Statement[:\s]+(.{10,500}?)"
            r"(?:Board Recommends|Proposal|Ratification|$)"
        ),
    ]

    for pattern in patterns:
        match = re.search(
            pattern,
            text,
            flags=re.IGNORECASE,
        )

        if not match:
            continue

        names = split_person_name_list(
            match.group(1)
        )

        if 3 <= len(names) <= 20:
            return names

    return []

def build_missing_board_nominee(
    name: str,
    source_url: str,
) -> Dict[str, Any]:
    return {
        "id": slugify(name),
        "name": name,
        "role": "Board Director",
        "companyRole": "Board Director",
        "outsideRole": None,
        "seatType": "Board Director",

        "isCEO": False,
        "isDirector": True,
        "isFounder": False,
        "isChairman": False,

        "age": None,
        "directorSince": None,
        "joinedCompanyYear": None,
        "roleStartYear": None,

        "ownershipPercent": None,
        "votingPower": None,
        "ownership": {
            "shares": None,
            "percent": None,
            "votingPercent": None,
            "asOfDate": None,
        },

        "influenceScore": None,
        "independent": None,
        "committees": [],

        "careerTimeline": [],
        "education": [],
        "currentBoards": [],
        "formerBoards": [],

        "compensation": {
            "year": None,
            "salary": None,
            "bonus": None,
            "stockAwards": None,
            "optionAwards": None,
            "otherCompensation": None,
            "total": None,
        },

        "biography": "",
        "leadershipSummary": [],

        "history": [
            "Named as a board nominee in the latest available SEC proxy filing."
        ],
        "sourceUrl": source_url,
        "parserConfidence": "proxy_nominee_list",
    }

def infer_target_company_role_from_text(
    soup: BeautifulSoup,
    name: str,
    company: str,
) -> Optional[str]:
    text = normalize_ws(
        soup.get_text(" ", strip=True)
    )

    escaped_name = re.escape(name)

    role_patterns = [
        rf"{escaped_name}\s+CEO,\s*{re.escape(company.split()[0])}",
        rf"{escaped_name}\s+Chief Executive Officer",
        rf"{escaped_name}\s+Board Chair",
        rf"{escaped_name}\s+Chair of the Board",
    ]

    for pattern in role_patterns:
        match = re.search(
            pattern,
            text,
            flags=re.IGNORECASE,
        )

        if not match:
            continue

        matched_text = normalize_ws(
            match.group(0)
        )

        if re.search(
            r"\bCEO\b|Chief Executive Officer",
            matched_text,
            flags=re.IGNORECASE,
        ):
            return "Chief Executive Officer"

        if re.search(
            r"Board Chair|Chair of the Board",
            matched_text,
            flags=re.IGNORECASE,
        ):
            return "Chair of the Board"

    return None

def canonical_person_key(value: str) -> str:
    name = normalize_person_name(value)

    name = re.sub(
        r"[^A-Za-z0-9]+",
        " ",
        name,
    )

    parts = [
        part.lower()
        for part in name.split()
        if part
    ]

    # Ignore middle initials for matching.
    meaningful = [
        part
        for part in parts
        if len(part) > 1
    ]

    if len(meaningful) >= 2:
        return f"{meaningful[0]}-{meaningful[-1]}"

    return "-".join(parts)


def find_existing_person(
    members: List[Dict[str, Any]],
    candidate_name: str,
) -> Optional[Dict[str, Any]]:
    candidate_normalized = normalize_person_name(
        candidate_name
    )

    candidate_slug = slugify(
        candidate_normalized
    )

    candidate_key = canonical_person_key(
        candidate_normalized
    )

    for member in members:
        existing_name = normalize_person_name(
            member.get("name", "")
        )

        if slugify(existing_name) == candidate_slug:
            return member

        if (
            candidate_key
            and canonical_person_key(existing_name)
            == candidate_key
        ):
            return member

    return None

def reconcile_board_nominees(
    members: List[Dict[str, Any]],
    nominee_names: List[str],
    source_url: str,
    soup: BeautifulSoup,
    company: str,
) -> List[Dict[str, Any]]:
    if not nominee_names:
        return members

    for nominee_name in nominee_names:
        clean_name = normalize_person_name(
            nominee_name
        )

        detected_role = infer_target_company_role_from_text(
            soup=soup,
            name=clean_name,
            company=company,
        )

        existing = find_existing_person(
            members,
            clean_name,
        )

        if existing:
            existing["seatType"] = "Board Director"

            if detected_role:
                existing["role"] = detected_role
                existing["companyRole"] = detected_role

            elif not normalize_ws(
                existing.get("companyRole")
                or existing.get("role")
                or ""
            ):
                existing["role"] = "Board Director"
                existing["companyRole"] = "Board Director"

            continue

        new_member = build_missing_board_nominee(
            name=clean_name,
            source_url=source_url,
        )

        if detected_role:
            new_member["role"] = detected_role
            new_member["companyRole"] = detected_role

        members.append(new_member)

    return members

def table_to_rows(table) -> List[List[str]]:
    rows = []

    for tr in table.find_all("tr"):
        cells = tr.find_all(["th", "td"])

        if not cells:
            continue

        values = [
            normalize_ws(cell.get_text(" ", strip=True))
            for cell in cells
        ]

        # Preserve blank cells so each value stays aligned with
        # the correct table header and column position.
        if any(value for value in values):
            rows.append(values)

    return rows

NON_PERSON_PHRASES = {
    # Filing navigation and document structure
    "additional information",
    "annual meeting",
    "annual meeting of stockholders",
    "annual report",
    "business overview",
    "company overview",
    "control number",
    "definitions",
    "effect of abstentions",
    "fiscal year",
    "general information",
    "identification number",
    "information about",
    "management proposals",
    "notice of",
    "other matters",
    "proposal",
    "proposals",
    "proxy statement",
    "registered public accounting firm",
    "report of the audit committee",
    "security ownership",
    "stockholder proposals",
    "shareholder proposals",
    "table of contents",
    "vote required for approval",

    # Governance subjects, not people
    "board assessment",
    "board effectiveness",
    "business practices",
    "compliance and business conduct",
    "diversity equity and inclusion",
    "diversity, equity, and inclusion",
    "emerging technologies",
    "enterprise risk management",
    "erm process",
    "financial expert",
    "financial community",
    "greenhouse gas emissions",
    "human capital management",
    "industry and technical",
    "industry & technical",
    "management proposals",
    "majority vote standard",
    "people and teams",
    "public policy engagement",
    "regulatory legal and risk management",
    "regulatory, legal & risk management",
    "risk oversight",
    "senior leadership and operations experience",
    "simple majority vote standard",
    "stockholder special meeting right",

    # Compensation subjects, not people
    "additional compensation",
    "cash retainers",
    "compensation",
    "compensation discussion and analysis",
    "compensation table",
    "equity award adjustments",
    "employment severance and change in control",
    "employment, severance, and change-in-control arrangements",
    "my psus",
    "non-gaap operating income",
    "pay ratio",
    "pay versus performance",
    "performance metrics",
    "summary compensation table",
    "sy psus",
    "variable cash plan",
    "what we do",
    "what we don't",
    "what we don’t do",

    # Corporate or legal terminology
    "exchange act",
    "internal revenue code",
    "public accounting",
    "related party",
    "related persons",
    "securities exchange act",

    # Existing company-specific exclusions
    "build awesome things",
    "business conduct",
    "data usage",
    "employees",
    "letters to",
    "live in the future",
    "long-term impact",
    "metamates",
    "move fast",
    "platform integrity",
    "results drive",
    "topics covered",
    "youth safety",
}

ORGANIZATION_NAME_TERMS = {
    "accounting firm",
    "asset management",
    "capital management",
    "company",
    "corporation",
    "foundation",
    "holdings",
    "investment management",
    "investments",
    "limited partnership",
    "management llc",
    "partners",
    "pricewaterhousecoopers",
    "registered public accounting",
    "ventures",
}

ORGANIZATION_SUFFIX_PATTERNS = (
    r"\binc\.?$",
    r"\bcorp\.?$",
    r"\bcorporation$",
    r"\bcompany$",
    r"\bco\.?$",
    r"\bllc$",
    r"\bllp$",
    r"\bl\.p\.?$",
    r"\bplc$",
    r"\bfoundation$",
    r"\bholdings$",
    r"\bmanagement$",
    r"\bpartners$",
    r"\bventures$",
)

PERSON_NAME_PARTICLES = {
    "de",
    "del",
    "der",
    "di",
    "du",
    "la",
    "le",
    "van",
    "von",
}

def is_probable_name(value: str) -> bool:
    text = normalize_person_name(value)
    text = normalize_ws(text).strip(" .,:;•●|")

    if not text:
        return False

    if len(text) < 5 or len(text) > 70:
        return False

    if any(char.isdigit() for char in text):
        return False

        # A candidate ending in sentence punctuation is usually a biography
        # fragment, employer name, section heading, or prose extraction.
    if text.endswith((".", ";", ":")):
        return False

        # Commas commonly indicate legal entity suffixes or prose fragments.
    if "," in text:
        comma_lowered = text.lower()

        if any(
                suffix in comma_lowered
                for suffix in [
                    ", inc",
                    ", llc",
                    ", llp",
                    ", l.p",
                    ", corp",
                    ", corporation",
                    ", plc",
                ]
        ):
            return False

    lowered = text.lower()

    invalid_name_prefixes = (
        "career highlights",
        "director biography",
        "director biographies",
        "executive biography",
        "executive biographies",
    )

    if lowered.startswith(invalid_name_prefixes):
        return False

    if any(phrase in lowered for phrase in NON_PERSON_PHRASES):
        return False

    if any(term in lowered for term in ORGANIZATION_NAME_TERMS):
        return False

    if any(
        re.search(pattern, lowered, flags=re.IGNORECASE)
        for pattern in ORGANIZATION_SUFFIX_PATTERNS
    ):
        return False

    role_terms = [
        "ceo",
        "cfo",
        "coo",
        "cto",
        "chief",
        "chair",
        "chairman",
        "chairwoman",
        "committee",
        "director",
        "executive",
        "founder",
        "member",
        "officer",
        "president",
    ]

    if contains_any_keyword(lowered, role_terms):
        return False

    # Reject strings that consist mainly of capitalized section-title words.
    if text.isupper():
        return False

    words = re.findall(
        r"[A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ'.’-]*",
        text,
    )

    if len(words) < 2 or len(words) > 6:
        return False

    if any(word.lower() in NAME_STOPWORDS for word in words):
        return False

    title_words = {
        "mr",
        "mrs",
        "ms",
        "miss",
        "dr",
        "jr",
        "sr",
        "ii",
        "iii",
        "iv",
    }

    meaningful_words = [
        word
        for word in words
        if word.replace(".", "").lower() not in title_words
    ]

    if len(meaningful_words) < 2:
        return False

    # A real name must contain at least two name-looking components.
    name_like_count = 0

    for word in meaningful_words:
        cleaned = word.strip(".'’-")
        lowered_word = cleaned.lower()

        if lowered_word in PERSON_NAME_PARTICLES:
            continue

        if re.fullmatch(r"[A-Z]", cleaned):
            name_like_count += 1
            continue

        if re.fullmatch(
            r"[A-Z][A-Za-zÀ-ÖØ-öø-ÿ'.’-]*",
            cleaned,
        ):
            name_like_count += 1

    if name_like_count < 2:
        return False

    # Reject common two-word filing headings that otherwise look like names.
    heading_words = {
        "additional",
        "annual",
        "business",
        "capital",
        "company",
        "control",
        "corporate",
        "enterprise",
        "equity",
        "financial",
        "fiscal",
        "governance",
        "human",
        "industry",
        "information",
        "management",
        "majority",
        "operating",
        "other",
        "performance",
        "policy",
        "public",
        "registered",
        "regulatory",
        "related",
        "risk",
        "security",
        "senior",
        "simple",
        "special",
        "stockholder",
        "summary",
        "variable",
        "vote",
        "workforce",
    }

    heading_count = sum(
        1
        for word in meaningful_words
        if word.lower().strip(".'’-") in heading_words
    )

    if heading_count >= 2:
        return False

    surname = meaningful_words[-1].strip(".'’-")

    if len(surname) < 2:
        return False

    return True

def parse_int(value: str) -> Optional[int]:
    match = re.search(r"\b(2[5-9]|[3-9][0-9])\b", normalize_ws(value))
    return int(match.group(1)) if match else None


def parse_year(value: str) -> Optional[str]:
    match = re.search(r"\b(19[7-9][0-9]|20[0-3][0-9])\b", normalize_ws(value))
    return match.group(1) if match else None


def parse_percent(value: str) -> Optional[float]:
    text = normalize_ws(value)
    match = re.search(r"([0-9]+(?:\.[0-9]+)?)\s*%", text)

    if not match:
        return None

    parsed = float(match.group(1))

    if parsed < 0 or parsed > 100:
        return None

    return parsed

def parse_money(value: Any) -> Optional[float]:
    text = normalize_ws(value)

    if not text:
        return None

    if text in {"—", "-", "–", "N/A", "n/a"}:
        return None

    negative = text.startswith("(") and text.endswith(")")

    cleaned = re.sub(
        r"[^0-9.]",
        "",
        text,
    )

    if not cleaned:
        return None

    try:
        parsed = float(cleaned)
    except ValueError:
        return None

    return -parsed if negative else parsed


def clean_biography_text(value: str) -> str:
    text = normalize_ws(value)

    text = re.sub(
        r"\b(?:Back to Top|Table of Contents)\b",
        " ",
        text,
        flags=re.IGNORECASE,
    )

    text = re.sub(r"\s+", " ", text)

    return text.strip()


def extract_first_year(value: str) -> Optional[int]:
    year = parse_year(value)

    return int(year) if year else None


def unique_dicts(
    items: List[Dict[str, Any]],
    key_fields: Tuple[str, ...],
) -> List[Dict[str, Any]]:
    output = []
    seen = set()

    for item in items:
        key = tuple(
            normalize_ws(item.get(field, "")).lower()
            for field in key_fields
        )

        if not any(key):
            continue

        if key in seen:
            continue

        seen.add(key)
        output.append(item)

    return output

BIOGRAPHY_KEYWORDS = [
    "joined",
    "served",
    "serves",
    "previously",
    "prior to",
    "before joining",
    "from 19",
    "from 20",
    "since 19",
    "since 20",
    "degree",
    "university",
    "college",
    "board of directors",
    "director of",
    "chief executive officer",
    "chief operating officer",
    "vice president",
]


def score_biography_candidate(
    text: str,
    name: str,
) -> int:
    lowered = text.lower()
    score = 0

    if name.lower() in lowered:
        score += 10

    score += sum(
        2
        for keyword in BIOGRAPHY_KEYWORDS
        if keyword in lowered
    )

    if 250 <= len(text) <= 3000:
        score += 5

    if len(text) > 6000:
        score -= 10

    return score


def extract_member_biography(
    soup: BeautifulSoup,
    name: str,
) -> str:
    candidates = []

    name_pattern = re.compile(
        re.escape(name),
        flags=re.IGNORECASE,
    )

    for text_node in soup.find_all(
        string=name_pattern
    ):
        parent = text_node.parent

        if parent is None:
            continue

        containers = []

        current = parent

        for _ in range(5):
            if current is None:
                break

            containers.append(current)
            current = current.parent

        for container in containers:
            text = clean_biography_text(
                container.get_text(
                    " ",
                    strip=True,
                )
            )

            if len(text) < 120:
                continue

            if len(text) > 7000:
                continue

            candidates.append(text)

    if not candidates:
        document_text = clean_biography_text(
            soup.get_text(
                " ",
                strip=True,
            )
        )

        match = re.search(
            re.escape(name),
            document_text,
            flags=re.IGNORECASE,
        )

        if match:
            start = max(0, match.start() - 300)
            end = min(
                len(document_text),
                match.end() + 2500,
            )

            candidates.append(
                document_text[start:end]
            )

    if not candidates:
        return ""

    candidates.sort(
        key=lambda candidate: score_biography_candidate(
            candidate,
            name,
        ),
        reverse=True,
    )

    best = candidates[0]

    name_match = re.search(
        re.escape(name),
        best,
        flags=re.IGNORECASE,
    )

    if name_match:
        best = best[name_match.start():]

    sentence_end_matches = list(
        re.finditer(
            r"[.!?](?:\s|$)",
            best,
        )
    )

    if sentence_end_matches:
        valid_end = None

        for sentence_end in sentence_end_matches:
            if sentence_end.end() >= 350:
                valid_end = sentence_end.end()

            if sentence_end.end() >= 2200:
                break

        if valid_end:
            best = best[:valid_end]

    return clean_biography_text(best)

DEGREE_PATTERNS = [
    (
        r"(?:holds|received|earned|has)\s+"
        r"(?:an?\s+)?"
        r"(B\.?S\.?|B\.?A\.?|Bachelor(?:'s)?(?: degree)?|"
        r"M\.?B\.?A\.?|M\.?S\.?|M\.?A\.?|"
        r"Master(?:'s)?(?: degree)?|J\.?D\.?|Ph\.?D\.?)"
        r"(?:\s+in\s+([^.;,]+?))?"
        r"\s+from\s+"
        r"([^.;]+)"
    ),
    (
        r"(B\.?S\.?|B\.?A\.?|M\.?B\.?A\.?|M\.?S\.?|"
        r"M\.?A\.?|J\.?D\.?|Ph\.?D\.?)"
        r"(?:\s+in\s+([^.;,]+?))?"
        r"\s+from\s+"
        r"([^.;]+)"
    ),
]


def normalize_degree(value: str) -> str:
    text = normalize_ws(value).replace(".", "")
    lowered = text.lower()

    mappings = {
        "bs": "B.S.",
        "ba": "B.A.",
        "mba": "MBA",
        "ms": "M.S.",
        "ma": "M.A.",
        "jd": "J.D.",
        "phd": "Ph.D.",
        "bachelor": "Bachelor's",
        "bachelors": "Bachelor's",
        "master": "Master's",
        "masters": "Master's",
    }

    return mappings.get(
        lowered,
        normalize_ws(value),
    )


def clean_school_name(value: str) -> str:
    text = normalize_ws(value)

    text = re.split(
        r"\s+(?:and|where|with|before|after)\s+",
        text,
        maxsplit=1,
        flags=re.IGNORECASE,
    )[0]

    text = re.sub(
        r"^(?:the)\s+",
        "",
        text,
        flags=re.IGNORECASE,
    )

    return text.strip(" ,.;")


def extract_education_from_biography(
    biography: str,
    source_url: str,
) -> List[Dict[str, Any]]:
    education = []

    for pattern in DEGREE_PATTERNS:
        for match in re.finditer(
            pattern,
            biography,
            flags=re.IGNORECASE,
        ):
            degree = normalize_degree(
                match.group(1)
            )

            field = normalize_ws(
                match.group(2) or ""
            )

            school = clean_school_name(
                match.group(3)
            )

            if len(school) < 3:
                continue

            education.append(
                {
                    "school": school,
                    "degree": degree,
                    "field": field,
                    "graduationYear": None,
                    "sourceUrl": source_url,
                }
            )

    university_pattern = (
        r"(?:graduated from|attended)\s+"
        r"([^.;]+?(?:University|College|Institute|School))"
    )

    for match in re.finditer(
        university_pattern,
        biography,
        flags=re.IGNORECASE,
    ):
        school = clean_school_name(
            match.group(1)
        )

        education.append(
            {
                "school": school,
                "degree": "",
                "field": "",
                "graduationYear": None,
                "sourceUrl": source_url,
            }
        )

    return unique_dicts(
        education,
        ("school", "degree", "field"),
    )

ROLE_WORDS = (
    r"Chief Executive Officer|Chief Operating Officer|"
    r"Chief Financial Officer|Chief Technology Officer|"
    r"Chief Product Officer|Chief Legal Officer|"
    r"General Counsel|Executive Vice President|"
    r"Senior Vice President|Vice President|"
    r"President|Chairman|Chairwoman|Chair|"
    r"Managing Director|Partner|Director|"
    r"Co-Founder|Founder|Officer"
)


def clean_role_text(value: str) -> str:
    return normalize_ws(value).strip(
        " ,.;:"
    )


def clean_employer_text(value: str) -> str:
    text = normalize_ws(value)

    text = re.split(
        r"\s+(?:where|which|and then|before|after)\s+",
        text,
        maxsplit=1,
        flags=re.IGNORECASE,
    )[0]

    return text.strip(" ,.;:")

def extract_career_from_biography(
    biography: str,
    target_company: str,
    source_url: str,
) -> Tuple[List[Dict[str, Any]], Optional[int]]:
    career = []

    company_short = normalize_ws(
        re.split(
            r",|\bInc\.?\b|\bCorporation\b|\bCorp\.?\b",
            target_company,
            maxsplit=1,
            flags=re.IGNORECASE,
        )[0]
    )

    company_pattern = re.escape(company_short)

    joined_patterns = [
        rf"(?:joined|has been with)\s+{company_pattern}"
        rf"(?:\s+in|\s+since)\s+"
        rf"(?:January|February|March|April|May|June|July|August|"
        rf"September|October|November|December)?\s*"
        rf"(19\d{{2}}|20\d{{2}})",

        rf"(?:joined|has been with)\s+{company_pattern}"
        rf".{{0,30}}?\b(19\d{{2}}|20\d{{2}})\b",
    ]

    joined_year = None

    for pattern in joined_patterns:
        match = re.search(
            pattern,
            biography,
            flags=re.IGNORECASE,
        )

        if match:
            joined_year = int(match.group(1))
            break

    # Example:
    # "has served as Apple's Chief Executive Officer since 2011"
    current_company_pattern = (
        rf"(?:has served|serves|served)\s+as\s+"
        rf"{company_pattern}[’']s\s+"
        rf"([^.;]+?)\s+since\s+"
        rf"(19\d{{2}}|20\d{{2}})"
    )

    for match in re.finditer(
        current_company_pattern,
        biography,
        flags=re.IGNORECASE,
    ):
        role = clean_role_text(match.group(1))
        start_year = int(match.group(2))

        career.append(
            {
                "company": company_short,
                "role": role,
                "startYear": start_year,
                "endYear": None,
                "current": True,
                "description": "",
                "sourceUrl": source_url,
            }
        )

    # Example:
    # "served as Apple's Chief Operating Officer from October 2005"
    company_role_pattern = (
        rf"(?:previously\s+)?served\s+as\s+"
        rf"{company_pattern}[’']s\s+"
        rf"([^.;]+?)\s+from\s+"
        rf"(?:January|February|March|April|May|June|July|August|"
        rf"September|October|November|December)?\s*"
        rf"(19\d{{2}}|20\d{{2}})"
        rf"(?:\s+(?:to|through|-)\s+"
        rf"(?:January|February|March|April|May|June|July|August|"
        rf"September|October|November|December)?\s*"
        rf"(19\d{{2}}|20\d{{2}}))?"
    )

    for match in re.finditer(
        company_role_pattern,
        biography,
        flags=re.IGNORECASE,
    ):
        career.append(
            {
                "company": company_short,
                "role": clean_role_text(match.group(1)),
                "startYear": int(match.group(2)),
                "endYear": int(match.group(3)) if match.group(3) else None,
                "current": False,
                "description": "",
                "sourceUrl": source_url,
            }
        )

    # Example:
    # "From October 2000 to February 2002, Mr. Cook served as Senior Vice President..."
    dated_role_pattern = (
        r"From\s+"
        r"(?:January|February|March|April|May|June|July|August|"
        r"September|October|November|December)?\s*"
        r"(19\d{2}|20\d{2})\s+to\s+"
        r"(?:January|February|March|April|May|June|July|August|"
        r"September|October|November|December)?\s*"
        r"(19\d{2}|20\d{2}),?\s+"
        r"(?:Mr\.?|Ms\.?|Mrs\.?|Dr\.?)?\s*"
        r"[A-Z][A-Za-z'.-]*\s+served\s+as\s+"
        r"([^.;]+)"
    )

    for match in re.finditer(
        dated_role_pattern,
        biography,
        flags=re.IGNORECASE,
    ):
        career.append(
            {
                "company": company_short,
                "role": clean_role_text(match.group(3)),
                "startYear": int(match.group(1)),
                "endYear": int(match.group(2)),
                "current": False,
                "description": "",
                "sourceUrl": source_url,
            }
        )

    # Generic outside-employer history.
    outside_pattern = (
        rf"(?:served|worked|was employed)\s+"
        rf"(?:as\s+)?(?:the\s+)?"
        rf"({ROLE_WORDS})"
        rf"(?:\s+of|\s+at|\s+for)\s+"
        rf"([^.;]+?)"
        rf"(?:\s+from\s+(19\d{{2}}|20\d{{2}})"
        rf"(?:\s+(?:to|through|-)\s+"
        rf"(19\d{{2}}|20\d{{2}}))?)?"
        rf"(?=[.;])"
    )

    for match in re.finditer(
        outside_pattern,
        biography,
        flags=re.IGNORECASE,
    ):
        employer = clean_employer_text(match.group(2))

        if not employer:
            continue

        career.append(
            {
                "company": employer,
                "role": clean_role_text(match.group(1)),
                "startYear": int(match.group(3)) if match.group(3) else None,
                "endYear": int(match.group(4)) if match.group(4) else None,
                "current": False,
                "description": "",
                "sourceUrl": source_url,
            }
        )

    career = unique_dicts(
        career,
        (
            "company",
            "role",
            "startYear",
            "endYear",
        ),
    )

    career.sort(
        key=lambda item: (
            item.get("startYear") is None,
            item.get("startYear") or 9999,
        )
    )

    return career, joined_year

def extract_board_history_from_biography(
            biography: str,
            source_url: str,
    ) -> Tuple[
        List[Dict[str, Any]],
        List[Dict[str, Any]],
    ]:
        current_boards = []
        former_boards = []

        def append_board(
                company: str,
                role: str,
                current: bool,
        ) -> None:
            clean_company = normalize_ws(company).strip(
                " ,.;:"
            )

            if not clean_company:
                return

            if clean_company.lower() in {
                "inc",
                "inc.",
                "corporation",
                "company",
            }:
                return

            current_target = (
                current_boards
                if current
                else former_boards
            )

            current_target.append(
                {
                    "company": clean_company,
                    "role": role,
                    "current": current,
                    "startYear": None,
                    "endYear": None,
                    "sourceUrl": source_url,
                }
            )

        # Non-public boards directly described in the biography.
        directors_match = re.search(
            r"serves on the Board of Directors of\s+"
            r"(.+?)"
            r"(?:,\s+the Board of Trustees|,\s+and on\s+the Leadership Council|[.;])",
            biography,
            flags=re.IGNORECASE,
        )

        if directors_match:
            append_board(
                directors_match.group(1),
                "Director",
                True,
            )

        trustee_match = re.search(
            r"the Board of Trustees of\s+"
            r"(.+?)"
            r"(?:,\s+and on\s+the Leadership Council|[.;])",
            biography,
            flags=re.IGNORECASE,
        )

        if trustee_match:
            append_board(
                trustee_match.group(1),
                "Trustee",
                True,
            )

        council_match = re.search(
            r"Leadership Council for\s+"
            r"(.+?)"
            r"(?:,\s+an?\s+|[.;])",
            biography,
            flags=re.IGNORECASE,
        )

        if council_match:
            append_board(
                council_match.group(1),
                "Leadership Council Member",
                True,
            )

        # Explicit public-board disclosure.
        current_public_match = re.search(
            r"Other Public Company Boards:\s*"
            r"Current:\s*(.+?)"
            r"(?:Within Last Five Years:|20\d{2}\s+Proxy Statement|Table of Contents|$)",
            biography,
            flags=re.IGNORECASE,
        )

        if current_public_match:
            captured = current_public_match.group(1)

            for company in re.split(
                    r"\s*;\s*",
                    captured,
            ):
                append_board(
                    company,
                    "Director",
                    True,
                )

        former_public_match = re.search(
            r"Within Last Five Years:\s*(.+?)"
            r"(?:20\d{2}\s+Proxy Statement|Table of Contents|$)",
            biography,
            flags=re.IGNORECASE,
        )

        if former_public_match:
            captured = former_public_match.group(1)

            for company in re.split(
                    r"\s*;\s*",
                    captured,
            ):
                append_board(
                    company,
                    "Director",
                    False,
                )

        return (
            unique_dicts(
                current_boards,
                ("company", "role"),
            ),
            unique_dicts(
                former_boards,
                ("company", "role"),
            ),
        )


def names_roughly_match(
    candidate: str,
    member_name: str,
) -> bool:
    candidate_key = slugify(
        normalize_person_name(candidate)
    )

    member_key = slugify(
        normalize_person_name(member_name)
    )

    if candidate_key == member_key:
        return True

    candidate_parts = candidate_key.split("-")
    member_parts = member_key.split("-")

    if len(candidate_parts) < 2 or len(member_parts) < 2:
        return False

    return (
        candidate_parts[-1] == member_parts[-1]
        and candidate_parts[0] == member_parts[0]
    )


def extract_ownership_for_member(
    soup: BeautifulSoup,
    member_name: str,
    filing_date: str,
) -> Dict[str, Any]:
    result = {
        "shares": None,
        "percent": None,
        "votingPercent": None,
        "asOfDate": filing_date or None,
    }

    document_text = normalize_ws(
        soup.get_text(
            " ",
            strip=True,
        )
    )

    ownership_section_match = re.search(
        r"Security Ownership of Certain Beneficial Owners and Management"
        r"(.{100,15000}?)"
        r"(?:Equity Compensation Plan Information|General Information)",
        document_text,
        flags=re.IGNORECASE,
    )

    if not ownership_section_match:
        return result

    section_text = ownership_section_match.group(1)

    table_date_match = re.search(
        r"information as of\s+"
        r"([A-Z][a-z]+\s+\d{1,2},\s+20\d{2})",
        section_text,
        flags=re.IGNORECASE,
    )

    if table_date_match:
        try:
            parsed_table_date = datetime.strptime(
                table_date_match.group(1),
                "%B %d, %Y",
            )

            result["asOfDate"] = (
                parsed_table_date
                .date()
                .isoformat()
            )
        except ValueError:
            pass

    escaped_name = re.escape(
        normalize_ws(member_name)
    )

    member_match = re.search(
        rf"{escaped_name}\s+"
        rf"([0-9][0-9,]*)"
        rf"(?:\([0-9]+\))?\s+"
        rf"([0-9]+(?:\.[0-9]+)?%|\*)",
        section_text,
        flags=re.IGNORECASE,
    )

    if not member_match:
        return result

    shares_text = member_match.group(1).replace(
        ",",
        "",
    )

    try:
        result["shares"] = int(shares_text)
    except ValueError:
        result["shares"] = None

    percent_text = member_match.group(2)

    if percent_text != "*":
        parsed_percent = parse_percent(
            percent_text
        )

        result["percent"] = parsed_percent
        result["votingPercent"] = parsed_percent

        return result

    # A star means less than 1%. Calculate the actual percentage
    # when the filing discloses total shares outstanding.
    outstanding_match = re.search(
        r"As of the Table Date,\s+"
        r"([0-9][0-9,]*)\s+shares"
        r".{0,80}?issued and outstanding",
        section_text,
        flags=re.IGNORECASE,
    )

    if (
        outstanding_match
        and result["shares"] is not None
    ):
        outstanding_shares = int(
            outstanding_match.group(1).replace(
                ",",
                "",
            )
        )

        if outstanding_shares > 0:
            calculated_percent = (
                result["shares"]
                / outstanding_shares
            ) * 100

            result["percent"] = round(
                calculated_percent,
                4,
            )

            result["votingPercent"] = round(
                calculated_percent,
                4,
            )

    return result

def find_header_index(
    headers: List[str],
    keywords: List[str],
) -> Optional[int]:
    for index, header in enumerate(headers):
        lowered = normalize_ws(header).lower()

        if any(
            keyword in lowered
            for keyword in keywords
        ):
            return index

    return None


def row_value(
    row: List[str],
    index: Optional[int],
) -> Optional[str]:
    if index is None:
        return None

    if index >= len(row):
        return None

    return row[index]


def extract_compensation_for_member(
    soup: BeautifulSoup,
    member_name: str,
) -> Dict[str, Any]:
    empty = {
        "year": None,
        "salary": None,
        "bonus": None,
        "stockAwards": None,
        "optionAwards": None,
        "otherCompensation": None,
        "total": None,
    }

    document_text = normalize_ws(
        soup.get_text(
            " ",
            strip=True,
        )
    )

    table_match = re.search(
        r"Name and Principal Position"
        r"(.{100,25000}?)"
        r"(?:Grants of Plan-Based Awards|Outstanding Equity Awards)",
        document_text,
        flags=re.IGNORECASE,
    )

    if not table_match:
        return empty

    table_text = table_match.group(1)

    escaped_name = re.escape(
        normalize_ws(member_name)
    )

    row_match = re.search(
        rf"{escaped_name}"
        rf".{{0,160}}?"
        rf"\b(20\d{{2}})\b\s+"
        rf"([0-9][0-9,]*)\s+"
        rf"([0-9][0-9,]*)\s+"
        rf"([0-9][0-9,]*)\s+"
        rf"([0-9][0-9,]*)"
        rf"(?:\s+\([^)]+\))*\s+"
        rf"([0-9][0-9,]*)",
        table_text,
        flags=re.IGNORECASE,
    )

    if not row_match:
        return empty

    def amount(group_number: int) -> Optional[float]:
        value = row_match.group(
            group_number
        )

        return parse_money(value)

    return {
        "year": int(row_match.group(1)),
        "salary": amount(2),
        "stockAwards": amount(3),

        # Apple labels this column Non-Equity Incentive
        # Plan Compensation. The frontend currently calls it Bonus.
        "bonus": amount(4),

        "optionAwards": None,
        "otherCompensation": amount(5),
        "total": amount(6),
    }

def extract_role_start_year(
    biography: str,
    role: str,
) -> Optional[int]:
    role_text = normalize_ws(role).lower()

    patterns = []

    if contains_any_keyword(
        role_text,
        ["ceo", "chief executive officer"],
    ):
        patterns.extend(
            [
                r"(?:became|appointed|named|has served as)\s+"
                r"(?:the\s+)?(?:chief executive officer|CEO)"
                r"(?:\s+in|\s+since)\s+(19\d{2}|20\d{2})",
                r"(?:chief executive officer|CEO)\s+since\s+"
                r"(19\d{2}|20\d{2})",
            ]
        )

    if contains_any_keyword(
        role_text,
        ["chair", "chairman", "chairwoman"],
    ):
        patterns.extend(
            [
                r"(?:became|appointed|named|has served as)\s+"
                r"(?:the\s+)?(?:chairman|chairwoman|chair)"
                r"(?:\s+in|\s+since)\s+(19\d{2}|20\d{2})",
                r"(?:chairman|chairwoman|chair)\s+since\s+"
                r"(19\d{2}|20\d{2})",
            ]
        )

    for pattern in patterns:
        match = re.search(
            pattern,
            biography,
            flags=re.IGNORECASE,
        )

        if match:
            return int(match.group(1))

    return None


def build_leadership_summary(
    member: Dict[str, Any],
    company: str,
) -> List[str]:
    summary = []

    if member.get("isCEO"):
        if member.get("roleStartYear"):
            summary.append(
                f"Has served as CEO since {member['roleStartYear']}."
            )
        else:
            summary.append(
                "Currently serves as Chief Executive Officer."
            )

    if member.get("isChairman"):
        summary.append(
            "Currently serves as board chair."
        )

    if member.get("isDirector"):
        if member.get("directorSince"):
            summary.append(
                f"Has served on the board since {member['directorSince']}."
            )
        else:
            summary.append(
                "Currently serves on the board of directors."
            )

    if member.get("joinedCompanyYear"):
        summary.append(
            f"Joined {company} in {member['joinedCompanyYear']}."
        )

    if member.get("careerTimeline"):
        prior_companies = []

        for item in member["careerTimeline"]:
            employer = normalize_ws(
                item.get("company")
            )

            if not employer:
                continue

            if employer.lower() in company.lower():
                continue

            if employer not in prior_companies:
                prior_companies.append(employer)

        if prior_companies:
            summary.append(
                "Prior experience includes "
                + ", ".join(prior_companies[:4])
                + "."
            )

    if member.get("education"):
        schools = [
            item.get("school")
            for item in member["education"]
            if item.get("school")
        ]

        if schools:
            summary.append(
                "Education includes "
                + ", ".join(schools[:3])
                + "."
            )

    ownership = member.get("ownership") or {}

    if ownership.get("percent") is not None:
        summary.append(
            f"Beneficial ownership disclosed at {ownership['percent']}%."
        )

    return summary

def enrich_members_from_filing(
    soup: BeautifulSoup,
    members: List[Dict[str, Any]],
    company: str,
    ticker: str,
    filing: FilingRef,
) -> List[Dict[str, Any]]:
    for member in members:
        name = normalize_ws(
            member.get("name")
        )

        if not name:
            continue

        biography = extract_member_biography(
            soup,
            name,
        )

        member["biography"] = biography

        education = extract_education_from_biography(
            biography,
            filing.html_url,
        )

        member["education"] = education

        career_timeline, joined_year = (
            extract_career_from_biography(
                biography,
                company,
                filing.html_url,
            )
        )

        member["careerTimeline"] = career_timeline

        member["joinedCompanyYear"] = (
            joined_year
            or member.get("joinedCompanyYear")
        )

        member["roleStartYear"] = (
            extract_role_start_year(
                biography,
                member.get("companyRole")
                or member.get("role")
                or "",
            )
            or member.get("roleStartYear")
        )

        current_boards, former_boards = (
            extract_board_history_from_biography(
                biography,
                filing.html_url,
            )
        )

        member["currentBoards"] = current_boards
        member["formerBoards"] = former_boards

        ownership = extract_ownership_for_member(
            soup,
            name,
            filing.filing_date,
        )

        member["ownership"] = ownership
        member["ownershipPercent"] = ownership.get(
            "percent"
        )
        member["votingPower"] = ownership.get(
            "votingPercent"
        )

        member["compensation"] = (
            extract_compensation_for_member(
                soup,
                name,
            )
        )

        role_text = normalize_ws(
            member.get("companyRole")
            or member.get("role")
            or ""
        )

        member["isCEO"] = contains_any_keyword(
            role_text,
            ["ceo", "chief executive officer"],
        )

        member["isDirector"] = (
            member.get("seatType") == "Board Director"
        )

        member["isFounder"] = contains_keyword(
            role_text,
            "founder",
        )

        member["isChairman"] = contains_any_keyword(
            role_text,
            ["chair", "chairman", "chairwoman"],
        )

        member["leadershipSummary"] = (
            build_leadership_summary(
                member,
                company,
            )
        )

    return members



def extract_committees(text: str) -> List[str]:
    lowered = normalize_ws(text).lower()
    committees = []

    for committee, keywords in COMMITTEE_KEYWORDS.items():
        if any(keyword in lowered for keyword in keywords):
            committees.append(committee)

    return committees


def infer_independence(text: str) -> Optional[bool]:
    lowered = normalize_ws(text).lower()

    if "not independent" in lowered:
        return False

    if "independent" in lowered:
        return True

    return None

COMPANY_NAME_STOPWORDS = {
    "inc",
    "incorporated",
    "corp",
    "corporation",
    "company",
    "companies",
    "co",
    "limited",
    "ltd",
    "plc",
    "holdings",
    "holding",
    "group",
    "class",
    "common",
    "stock",
}


def role_mentions_target_company(
    role: str,
    company: str,
    ticker: str,
) -> bool:
    role_text = normalize_ws(role).lower()

    if not role_text:
        return False

    clean_ticker = normalize_ws(ticker).lower()

    if len(clean_ticker) >= 3:
        if re.search(rf"\b{re.escape(clean_ticker)}\b", role_text):
            return True

    company_words = re.findall(
        r"[A-Za-z0-9]+",
        normalize_ws(company).lower(),
    )

    meaningful_words = [
        word
        for word in company_words
        if word not in COMPANY_NAME_STOPWORDS and len(word) >= 4
    ]

    for word in meaningful_words:
        if re.search(rf"\b{re.escape(word)}\b", role_text):
            return True

    return False

def infer_category(role: str, row_text: str) -> str:
    text = f"{role} {row_text}"

    if contains_any_keyword(
        text,
        DIRECTOR_KEYWORDS,
    ):
        return "Board Director"

    if contains_any_keyword(
        text,
        EXECUTIVE_KEYWORDS,
    ):
        return "Executive"

    return "Leadership"


def infer_role_from_row(row: List[str], name_index: int) -> str:
    candidates = []

    for idx, value in enumerate(row):
        if idx == name_index:
            continue

        lowered = value.lower()

        if any(keyword in lowered for keyword in EXECUTIVE_KEYWORDS + DIRECTOR_KEYWORDS):
            candidates.append(value)

    if candidates:
        return candidates[0][:220]

    if len(row) > name_index + 1:
        return row[name_index + 1][:220]

    return "Board / Executive"


def headers_from_rows(rows: List[List[str]]) -> Tuple[List[str], List[List[str]]]:
    if not rows:
        return [], []

    first = rows[0]
    first_text = " ".join(first).lower()

    header_keywords = [
        "name",
        "age",
        "position",
        "title",
        "director",
        "nominee",
        "principal occupation",
        "committee",
    ]

    if any(keyword in first_text for keyword in header_keywords):
        return first, rows[1:]

    return [], rows


def find_name_index(headers: List[str], row: List[str]) -> int:
    # Only accept explicitly labeled person-name columns.
    for idx, header in enumerate(headers):
        lowered = normalize_ws(header).lower()

        is_name_column = (
            lowered == "name"
            or lowered == "nominee"
            or lowered == "director"
            or "nominee name" in lowered
            or "director name" in lowered
            or "name of nominee" in lowered
            or "name and principal occupation" in lowered
            or "name and principal position" in lowered
        )

        if not is_name_column:
            continue

        if idx >= len(row):
            continue

        candidate = normalize_person_name(row[idx])

        if is_probable_name(candidate):
            return idx

    # Some director tables use a blank first header, but only allow
    # this fallback when the remaining headers prove that this is
    # structurally a director table.
    header_text = " | ".join(
        normalize_ws(header).lower()
        for header in headers
    )

    supports_blank_name_column = (
        "director since" in header_text
        or (
            "age" in header_text
            and (
                "nominee" in header_text
                or "principal occupation" in header_text
                or "independent" in header_text
            )
        )
    )

    if supports_blank_name_column and row:
        candidate = normalize_person_name(row[0])

        if is_probable_name(candidate):
            return 0

    return -1


def make_member_from_row(
    row: List[str],
    headers: List[str],
    source_url: str,
    company: str,
    ticker: str,
) -> Optional[Dict[str, Any]]:
    name_index = find_name_index(headers, row)

    if name_index < 0:
        return None

    name = normalize_person_name(row[name_index])

    if not is_probable_name(name):
        return None

    row_text = " | ".join(row)
    headers_text = " | ".join(headers).lower()

    parsed_role = normalize_ws(
        infer_role_from_row(row, name_index)
    )

    if len(parsed_role) > 180:
        parsed_role = ""

    age = None
    director_since = None
    ownership_percent = None

    committees = extract_committees(row_text)
    independent = infer_independence(row_text)

    for header, value in zip(headers, row):
        lowered = normalize_ws(header).lower()

        if lowered == "age" or " age" in lowered:
            parsed_age = parse_int(value)

            if parsed_age is not None:
                age = parsed_age

        if "director since" in lowered:
            parsed_year = parse_year(value)

            if parsed_year:
                director_since = parsed_year

        elif "since" in lowered and "director" in headers_text:
            parsed_year = parse_year(value)

            if parsed_year:
                director_since = parsed_year

        if (
            "%" in lowered
            or "percent" in lowered
            or "ownership" in lowered
            or "beneficial" in lowered
        ):
            parsed_ownership = parse_percent(value)

            if parsed_ownership is not None:
                ownership_percent = parsed_ownership

        if (
            "position" in lowered
            or "title" in lowered
            or "occupation" in lowered
            or "principal" in lowered
        ):
            possible_role = normalize_ws(value)

            if possible_role and not is_probable_name(possible_role):
                if len(possible_role) <= 180:
                    parsed_role = possible_role

    board_context = (
            director_since is not None
            or "director since" in headers_text
            or "year first elected" in headers_text
            or (
                    "age" in headers_text
                    and (
                            "nominee" in headers_text
                            or "principal occupation" in headers_text
                            or "independent" in headers_text
                    )
            )
    )

    parsed_role_is_valid = is_valid_leadership_role(parsed_role)

    if board_context:
        has_director_evidence = (
            director_since is not None
            or age is not None
            or "nominee" in headers_text
            or "principal occupation" in headers_text
        )

        if not has_director_evidence:
            return None

    company_role = ""
    outside_role = None
    seat_type = "Leadership"

    if board_context:
        seat_type = "Board Director"

        if (
            parsed_role_is_valid
            and role_mentions_target_company(
                parsed_role,
                company,
                ticker,
            )
        ):
            company_role = parsed_role
        else:
            company_role = "Board Director"

            if parsed_role_is_valid:
                outside_role = parsed_role

    else:
        if not parsed_role_is_valid:
            return None

        company_role = parsed_role

        role_text = company_role.lower()

        if any(
            keyword in role_text
            for keyword in EXECUTIVE_KEYWORDS
        ):
            seat_type = "Executive"
        elif any(
            keyword in role_text
            for keyword in DIRECTOR_KEYWORDS
        ):
            seat_type = "Board Director"
        else:
            seat_type = "Leadership"

    history = []

    if age is not None:
        history.append(
            f"Age listed in the filing: {age}."
        )

    if director_since:
        history.append(
            f"Director since {director_since}, according to the filing table."
        )

    if outside_role:
        history.append(
            f"Outside occupation listed in the filing: {outside_role}."
        )

    if committees:
        history.append(
            f"Committee references found: {', '.join(committees)}."
        )

    if ownership_percent is not None:
        history.append(
            f"Beneficial ownership percentage found: {ownership_percent}%."
        )

    history.append(
        "Identified from the company's latest available SEC filing."
    )

    return {
        "id": slugify(name),
        "name": name,
        "role": company_role,
        "companyRole": company_role,
        "outsideRole": outside_role,
        "seatType": seat_type,

        "isCEO": contains_any_keyword(
            company_role,
            ["ceo", "chief executive officer"],
        ),
        "isDirector": seat_type == "Board Director",
        "isFounder": contains_keyword(company_role, "founder"),
        "isChairman": contains_any_keyword(
            company_role,
            ["chair", "chairman", "chairwoman"],
        ),

        "age": age,
        "directorSince": director_since,
        "joinedCompanyYear": None,
        "roleStartYear": None,

        "ownershipPercent": ownership_percent,
        "votingPower": ownership_percent,
        "ownership": {
            "shares": None,
            "percent": ownership_percent,
            "votingPercent": ownership_percent,
            "asOfDate": None,
        },

        "influenceScore": None,
        "independent": independent,
        "committees": committees,

        "careerTimeline": [],
        "education": [],
        "currentBoards": [],
        "formerBoards": [],

        "compensation": {
            "year": None,
            "salary": None,
            "bonus": None,
            "stockAwards": None,
            "optionAwards": None,
            "otherCompensation": None,
            "total": None,
        },

        "biography": "",
        "leadershipSummary": [],

        "history": history,
        "sourceUrl": source_url,
        "parserConfidence": "table_match",
    }

REJECTED_LEADERSHIP_TABLE_PHRASES = {
    "board skills",
    "board skills matrix",
    "director skills",
    "director qualifications",
    "experience matrix",
    "skills and experience",
    "summary compensation table",
    "pay versus performance",
    "beneficial owners",
    "beneficial ownership",
    "security ownership of certain beneficial owners",
    "equity compensation plan",
    "audit fees",
    "auditor fees",
    "stockholder proposals",
    "shareholder proposals",
    "voting standard",
    "vote required",
    "what we do",
    "what we don't",
    "what we don’t do",
}

PERSON_TABLE_HEADER_TERMS = {
    "name",
    "nominee",
    "director name",
    "nominee name",
    "name and principal occupation",
    "name and principal position",
}

DIRECTOR_TABLE_TERMS = {
    "age",
    "director since",
    "year first elected",
    "independent",
    "principal occupation",
}

EXECUTIVE_TABLE_TERMS = {
    "executive officer",
    "principal position",
    "position",
    "title",
}


def table_is_rejected(table_text: str) -> bool:
    lowered = normalize_ws(table_text).lower()

    return any(
        phrase in lowered
        for phrase in REJECTED_LEADERSHIP_TABLE_PHRASES
    )


def table_has_explicit_name_header(headers: List[str]) -> bool:
    for header in headers:
        lowered = normalize_ws(header).lower()

        if lowered in PERSON_TABLE_HEADER_TERMS:
            return True

        if "name" in lowered and len(lowered) <= 60:
            return True

    return False


def table_has_person_structure(headers: List[str]) -> bool:
    lowered_headers = [
        normalize_ws(header).lower()
        for header in headers
    ]

    combined = " | ".join(lowered_headers)

    has_name = table_has_explicit_name_header(headers)

    has_director_structure = (
        "director since" in combined
        or (
            "age" in lowered_headers
            and any(
                term in combined
                for term in [
                    "director",
                    "nominee",
                    "principal occupation",
                ]
            )
        )
    )

    has_executive_structure = (
        has_name
        and any(
            term in combined
            for term in EXECUTIVE_TABLE_TERMS
        )
        and any(
            term in combined
            for term in [
                "executive",
                "officer",
                "principal position",
            ]
        )
    )

    return has_director_structure or has_executive_structure

def extract_members_from_tables(
    soup: BeautifulSoup,
    source_url: str,
    company: str,
    ticker: str,
) -> List[Dict[str, Any]]:
    members = []

    for table in soup.find_all("table"):
        rows = table_to_rows(table)

        if len(rows) < 2:
            continue

        table_text = " ".join(
            " ".join(row)
            for row in rows
        )

        if table_is_rejected(table_text):
            continue

        headers, body_rows = headers_from_rows(rows)

        if not headers:
            continue

        if not table_has_person_structure(headers):
            continue

        for row in body_rows:
            member = make_member_from_row(
                row=row,
                headers=headers,
                source_url=source_url,
                company=company,
                ticker=ticker,
            )

            if member:
                members.append(member)

    return members

def is_valid_leadership_role(role: str) -> bool:
    text = normalize_ws(role)

    if not text:
        return False

    if re.fullmatch(r"\d{1,4}", text):
        return False

    valid_terms = [
        "director",
        "chair",
        "chairman",
        "chairwoman",
        "chief",
        "ceo",
        "cfo",
        "coo",
        "cto",
        "president",
        "officer",
        "founder",
        "general counsel",
        "treasurer",
        "controller",
        "executive",
    ]

    return contains_any_keyword(
        text,
        valid_terms,
    )

def extract_members_from_text_sections(
    soup: BeautifulSoup,
    source_url: str,
) -> List[Dict[str, Any]]:
    text = normalize_ws(
        soup.get_text(" ", strip=True)
    )

    members = []

    patterns = [
        (
            r"([A-Z][A-Za-z'.’-]+"
            r"(?:\s+[A-Z][A-Za-z'.’-]+){1,3}),?\s+"
            r"(?:age\s+)?([3-9][0-9]),?\s+"
            r"([^.;]{10,180})"
        ),
        (
            r"([A-Z][A-Za-z'.’-]+"
            r"(?:\s+[A-Z][A-Za-z'.’-]+){1,3})\s+"
            r"(?:has served|serves|served)\s+as\s+"
            r"([^.]{10,180})"
        ),
    ]

    for pattern in patterns:
        for match in re.finditer(pattern, text):
            name = normalize_person_name(
                match.group(1)
            )

            if not is_probable_name(name):
                continue

            age = None
            role = ""

            if len(match.groups()) >= 3:
                age = parse_int(match.group(2))
                role = normalize_ws(
                    match.group(3)
                )[:220]
            else:
                role = normalize_ws(
                    match.group(2)
                )[:220]

            if not is_valid_leadership_role(role):
                continue

            seat_type = infer_category(role, role)

            member = {
                "id": slugify(name),
                "name": name,
                "role": role,
                "companyRole": role,
                "outsideRole": None,
                "seatType": seat_type,

                "isCEO": contains_any_keyword(
                    role,
                    ["ceo", "chief executive officer"],
                ),
                "isDirector": seat_type == "Board Director",
                "isFounder": contains_keyword(
                    role,
                    "founder",
                ),
                "isChairman": contains_any_keyword(
                    role,
                    ["chair", "chairman", "chairwoman"],
                ),

                "age": age,
                "directorSince": (
                    parse_year(role)
                    if seat_type == "Board Director"
                    else None
                ),
                "joinedCompanyYear": None,
                "roleStartYear": None,

                "ownershipPercent": None,
                "votingPower": None,
                "ownership": {
                    "shares": None,
                    "percent": None,
                    "votingPercent": None,
                    "asOfDate": None,
                },

                "influenceScore": None,
                "independent": infer_independence(role),
                "committees": extract_committees(role),

                "careerTimeline": [],
                "education": [],
                "currentBoards": [],
                "formerBoards": [],

                "compensation": {
                    "year": None,
                    "salary": None,
                    "bonus": None,
                    "stockAwards": None,
                    "optionAwards": None,
                    "otherCompensation": None,
                    "total": None,
                },

                "biography": "",
                "leadershipSummary": [],

                "history": [
                    "Identified from a leadership text section in the latest SEC filing.",
                    f"Parsed role/background: {role}",
                ],
                "sourceUrl": source_url,
                "parserConfidence": "text_section_match",
            }

            members.append(member)

    return members

def member_has_valid_evidence(member: Dict[str, Any]) -> bool:
    name = normalize_person_name(
        member.get("name", "")
    )

    if not is_probable_name(name):
        return False

    confidence = normalize_ws(
        member.get("parserConfidence")
    )

    role = normalize_ws(
        member.get("companyRole")
        or member.get("role")
        or ""
    )

    seat_type = normalize_ws(
        member.get("seatType")
    )

    age = member.get("age")
    director_since = member.get("directorSince")

    if confidence == "proxy_nominee_list":
        return True

    if confidence == "table_match":
        if seat_type == "Board Director":
            return (
                age is not None
                or director_since is not None
                or is_valid_leadership_role(role)
            )

        return is_valid_leadership_role(role)

    if confidence == "text_section_match":
        return is_valid_leadership_role(role)

    return is_valid_leadership_role(role)


def filter_invalid_members(
    members: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    output = []

    for member in members:
        if not member_has_valid_evidence(member):
            continue

        name = normalize_person_name(
            member.get("name", "")
        )

        member["name"] = name
        member["id"] = slugify(name)

        output.append(member)

    return output

def merge_members(
    members: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    merged: Dict[str, Dict[str, Any]] = {}

    for member in members:
        name = normalize_person_name(
            member.get("name", "")
        )

        if not is_probable_name(name):
            continue

        member["name"] = name
        member["id"] = slugify(name)

        key = canonical_person_key(name)

        if key not in merged:
            merged[key] = member
            continue

        existing = merged[key]

        def role_quality(value: Any) -> int:
            role = normalize_ws(value)

            if not role:
                return 0

            score = 0

            if is_valid_leadership_role(role):
                score += 10

            if len(role) <= 100:
                score += 5
            elif len(role) > 180:
                score -= 10

            if any(
                    marker in role.lower()
                    for marker in [
                        "proxy statement",
                        "table of contents",
                        "summary governance",
                        "compensation proposals",
                    ]
            ):
                score -= 20

            return score

        merge_fields = [
            "isCEO",
            "isDirector",
            "isFounder",
            "isChairman",

            "age",
            "directorSince",
            "joinedCompanyYear",
            "roleStartYear",

            "ownershipPercent",
            "votingPower",
            "ownership",

            "independent",
            "sourceUrl",

            "biography",
            "compensation",
        ]

        existing_role = normalize_ws(
            existing.get("companyRole")
            or existing.get("role")
        )

        new_role = normalize_ws(
            member.get("companyRole")
            or member.get("role")
        )

        if role_quality(new_role) > role_quality(
                existing_role
        ):
            existing["role"] = new_role
            existing["companyRole"] = new_role

            if member.get("seatType"):
                existing["seatType"] = member.get(
                    "seatType"
                )

        if (
                not existing.get("outsideRole")
                and member.get("outsideRole")
        ):
            existing["outsideRole"] = member.get(
                "outsideRole"
            )

        for field in merge_fields:
            existing_value = existing.get(field)
            new_value = member.get(field)

            if (
                existing_value is None
                or existing_value == ""
                or existing_value == []
            ):
                if new_value not in (None, "", []):
                    existing[field] = new_value

        existing_committees = set(
            existing.get("committees") or []
        )

        new_committees = set(
            member.get("committees") or []
        )

        existing["committees"] = sorted(
            existing_committees | new_committees
        )

        for list_field in [
            "careerTimeline",
            "education",
            "currentBoards",
            "formerBoards",
            "leadershipSummary",
        ]:
            existing_items = existing.get(list_field) or []
            new_items = member.get(list_field) or []

            if not existing_items and new_items:
                existing[list_field] = new_items

        combined_history = []

        for item in (
            (existing.get("history") or [])
            + (member.get("history") or [])
        ):
            if item and item not in combined_history:
                combined_history.append(item)

        existing["history"] = combined_history[:10]

        if (
            existing.get("parserConfidence") != "table_match"
            and member.get("parserConfidence") == "table_match"
        ):
            existing["parserConfidence"] = "table_match"

    output = list(merged.values())

    for member in output:
        company_role = normalize_ws(
            member.get("companyRole")
            or member.get("role")
            or "Leadership"
        )

        ownership = member.get("ownershipPercent")

        influence_score = estimate_influence(
            company_role,
            ownership,
        )

        member["role"] = company_role
        member["companyRole"] = company_role

        member["votingPower"] = ownership
        member["influenceScore"] = influence_score

        member["influence"] = influence_label(
            company_role,
            influence_score,
        )

        member["level"] = influence_level(
            company_role,
            influence_score,
        )

    output.sort(
        key=lambda item: (
            -float(item.get("influenceScore") or 0),
            item.get("name", ""),
        )
    )

    return output


def estimate_influence(
    role: str,
    ownership: Optional[float],
) -> float:
    text = normalize_ws(role).lower()

    score = 3.0

    if ownership is not None:
        score = max(
            score,
            min(float(ownership), 100.0),
        )

    is_founder = "founder" in text

    is_ceo = (
        "chief executive officer" in text
        or bool(re.search(r"\bceo\b", text))
    )

    is_chair = (
        "chairman" in text
        or "chairwoman" in text
        or bool(re.search(r"\bchair\b", text))
    )

    is_director = (
        "director" in text
        or "board" in text
    )

    if is_founder and is_ceo and is_chair:
        score = max(score, 60.0)

    elif is_founder and is_ceo:
        score = max(score, 50.0)

    elif is_founder and is_chair:
        score = max(score, 45.0)

    elif is_founder:
        score = max(score, 35.0)

    elif is_ceo and is_chair:
        score = max(score, 35.0)

    elif is_ceo:
        score = max(score, 30.0)

    elif is_chair:
        score = max(score, 22.0)

    elif is_director:
        score = max(score, 10.0)

    elif (
        "chief" in text
        or "president" in text
        or "general counsel" in text
        or "treasurer" in text
        or "controller" in text
    ):
        score = max(score, 12.0)

    return round(min(score, 100.0), 2)


def influence_label(
    role: str,
    score: Optional[float],
) -> str:
    text = normalize_ws(role).lower()
    value = float(score or 0)

    if value >= 50:
        return "Controlling Influence"

    if value >= 30:
        return "Highest Influence"

    if value >= 20:
        return "High Influence"

    if "chair" in text:
        return "Board Leadership"

    if "director" in text or "board" in text:
        return "Governance Oversight"

    if any(
        keyword in text
        for keyword in EXECUTIVE_KEYWORDS
    ):
        return "Operating Leadership"

    return "Leadership Influence"

def influence_level(
    role: str,
    score: Optional[float],
) -> int:
    text = normalize_ws(role).lower()
    value = float(score or 0)

    if value >= 50:
        return 1

    if value >= 20:
        return 2

    if (
        value >= 10
        or "director" in text
        or "board" in text
    ):
        return 3

    return 4


def profile_summary(company: str, members: List[Dict[str, Any]], form: str) -> str:
    board_count = count_board_members(members)
    exec_count = count_executives(members)

    if not members:
        return (
            f"No usable board or executive records were confidently extracted from "
            f"the latest {form} filing for {company}. Manual review recommended."
        )

    top = members[0]["name"] if members else "Leadership"

    return (
        f"{company} leadership profile parsed from the latest available {form} filing. "
        f"Found {board_count} board/director records and {exec_count} executive records. "
        f"Highest influence node currently appears to be {top}, based on disclosed ownership/voting data when available and role-based estimates otherwise."
    )


def count_board_members(
    members: List[Dict[str, Any]],
) -> int:
    return sum(
        1
        for member in members
        if (
            member.get("isDirector") is True
            or normalize_ws(
                member.get("seatType")
            ) == "Board Director"
        )
    )


def count_executives(
    members: List[Dict[str, Any]],
) -> int:
    return sum(
        1
        for member in members
        if normalize_ws(
            member.get("seatType")
        ) == "Executive"
    )


def score_profile(
    members: List[Dict[str, Any]],
    filing: Optional[FilingRef],
) -> int:
    if not members:
        return 0

    score = 0
    member_count = len(members)

    if filing and filing.form in {
        "DEF 14A",
        "DEFA14A",
        "PRE 14A",
    }:
        score += 25
    elif filing and filing.form.startswith("10-K"):
        score += 12

    # A normal public-company leadership population is usually not enormous.
    if 5 <= member_count <= 25:
        score += 20
    elif 3 <= member_count <= 35:
        score += 12
    elif member_count > 35:
        score -= 25

    board_members = count_board_members(members)
    executives = count_executives(members)

    if board_members >= 3:
        score += 15

    if executives >= 1:
        score += 10

    valid_name_count = sum(
        1
        for member in members
        if is_probable_name(
            member.get("name", "")
        )
    )

    valid_name_ratio = (
        valid_name_count / member_count
    )

    if valid_name_ratio == 1:
        score += 15
    elif valid_name_ratio >= 0.90:
        score += 8
    else:
        score -= 20

    with_biography = sum(
        1
        for member in members
        if normalize_ws(
            member.get("biography")
        )
    )

    with_ownership = sum(
        1
        for member in members
        if (
            member.get("ownership", {}).get("shares")
            is not None
            or member.get("ownership", {}).get("percent")
            is not None
        )
    )

    with_tenure = sum(
        1
        for member in members
        if (
            member.get("directorSince")
            or member.get("roleStartYear")
            or member.get("joinedCompanyYear")
        )
    )

    score += min(with_biography, 10)
    score += min(with_ownership * 2, 8)
    score += min(with_tenure, 7)

    return max(
        0,
        min(round(score), 100),
    )


def parse_profile_for_ticker(
    session: requests.Session,
    ticker: str,
    ticker_record: Dict[str, str],
    debug_dir: Optional[str] = None,
) -> Dict[str, Any]:
    cik = ticker_record["cik"]
    company = ticker_record["company"]

    filing = find_latest_filing(session, cik)

    if not filing:
        return {
            "ticker": ticker,
            "cik": cik,
            "company": company,
            "governance_summary": f"No SEC proxy or 10-K filing found for {company}.",
            "data_status": "needs_review",
            "data_quality_score": 0,
            "member_count": 0,
            "board_member_count": 0,
            "executive_count": 0,
            "source_form": None,
            "source_filing_date": None,
            "source_accession": None,
            "source_url": None,
            "sec_company_url": f"https://www.sec.gov/edgar/browse/?CIK={int(cik)}",
            "members": [],
            "raw_notes": {"reason": "No preferred filing found."},
        }

    html = request_text(session, filing.html_url)

    if debug_dir:
        os.makedirs(debug_dir, exist_ok=True)
        debug_path = os.path.join(debug_dir, f"{ticker}_{filing.form.replace(' ', '_')}.html")
        with open(debug_path, "w", encoding="utf-8") as file:
            file.write(html)

    soup = soup_from_html(html)

    table_members = extract_members_from_tables(
        soup=soup,
        source_url=filing.html_url,
        company=company,
        ticker=ticker,
    )

    text_members = extract_members_from_text_sections(
        soup,
        filing.html_url,
    )

    nominee_names = extract_board_nominee_names(
        soup
    )

    # Structured SEC tables and the explicit proxy nominee list are
    # authoritative for the actual people roster.
    #
    # Broad filing-text matches are intentionally excluded here because
    # biography headings such as "Career Highlights Mr. Cook" and prior
    # employer titles can otherwise be mistaken for current executives.
    candidate_members = filter_invalid_members(
        table_members
    )

    reconciled_members = reconcile_board_nominees(
        members=candidate_members,
        nominee_names=nominee_names,
        source_url=filing.html_url,
        soup=soup,
        company=company,
    )

    members = merge_members(
        reconciled_members
    )

    members = filter_invalid_members(
        members
    )

    members = enrich_members_from_filing(
        soup=soup,
        members=members,
        company=company,
        ticker=ticker,
        filing=filing,
    )

    members = filter_invalid_members(
        members
    )

    # Re-merge after enrichment so canonical IDs, influence values,
    # role flags, and ordering are recalculated consistently.
    members = merge_members(
        members
    )

    quality_score = score_profile(
        members,
        filing,
    )
    data_status = "ready" if quality_score >= 45 and len(members) >= 3 else "needs_review"

    return {
        "ticker": ticker,
        "cik": cik,
        "company": company,
        "governance_summary": profile_summary(company, members, filing.form),
        "data_status": data_status,
        "data_quality_score": quality_score,
        "member_count": len(members),
        "board_member_count": count_board_members(members),
        "executive_count": count_executives(members),
        "source_form": filing.form,
        "source_filing_date": filing.filing_date,
        "source_accession": filing.accession,
        "source_url": filing.html_url,
        "sec_company_url": f"https://www.sec.gov/edgar/browse/?CIK={int(cik)}",
        "members": members,
        "raw_notes": {
            "primary_doc": filing.primary_doc,
            "filing_folder": filing.filing_url,
            "table_member_count": len(table_members),
            "text_member_count": len(text_members),
            "proxy_nominee_count": len(nominee_names),
            "proxy_nominee_names": nominee_names,

            "biography_count": sum(
                1
                for member in members
                if member.get("biography")
            ),

            "career_timeline_count": sum(
                1
                for member in members
                if member.get("careerTimeline")
            ),

            "education_count": sum(
                1
                for member in members
                if member.get("education")
            ),

            "ownership_count": sum(
                1
                for member in members
                if (
                        member.get("ownership", {}).get("shares")
                        is not None
                        or member.get("ownership", {}).get("percent")
                        is not None
                )
            ),

            "compensation_count": sum(
                1
                for member in members
                if member.get("compensation", {}).get("total")
                is not None
            ),
        },
    }


def upsert_profile(profile: Dict[str, Any]) -> None:
    with get_script_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                insert into public.board_leadership_profiles (
                  ticker,
                  cik,
                  company,
                  governance_summary,
                  data_status,
                  data_quality_score,
                  member_count,
                  board_member_count,
                  executive_count,
                  source_form,
                  source_filing_date,
                  source_accession,
                  source_url,
                  sec_company_url,
                  members,
                  raw_notes,
                  updated_at
                )
                values (
                  %(ticker)s,
                  %(cik)s,
                  %(company)s,
                  %(governance_summary)s,
                  %(data_status)s,
                  %(data_quality_score)s,
                  %(member_count)s,
                  %(board_member_count)s,
                  %(executive_count)s,
                  %(source_form)s,
                  %(source_filing_date)s,
                  %(source_accession)s,
                  %(source_url)s,
                  %(sec_company_url)s,
                  %(members)s::jsonb,
                  %(raw_notes)s::jsonb,
                  now()
                )
                on conflict (ticker)
                do update set
                  cik = excluded.cik,
                  company = excluded.company,
                  governance_summary = excluded.governance_summary,
                  data_status = excluded.data_status,
                  data_quality_score = excluded.data_quality_score,
                  member_count = excluded.member_count,
                  board_member_count = excluded.board_member_count,
                  executive_count = excluded.executive_count,
                  source_form = excluded.source_form,
                  source_filing_date = excluded.source_filing_date,
                  source_accession = excluded.source_accession,
                  source_url = excluded.source_url,
                  sec_company_url = excluded.sec_company_url,
                  members = excluded.members,
                  raw_notes = excluded.raw_notes,
                  updated_at = now()
                """,
                {
                    **profile,
                    "members": json.dumps(profile.get("members") or []),
                    "raw_notes": json.dumps(profile.get("raw_notes") or {}),
                },
            )

        conn.commit()


def parse_ticker_arg(value: Optional[str]) -> List[str]:
    if not value:
        return []

    return [
        item.strip().upper()
        for item in value.split(",")
        if item.strip()
    ]


def run(args: argparse.Namespace) -> None:
    require_env()

    session = sec_session()
    ticker_map = build_ticker_map(session)

    tickers = parse_ticker_arg(args.tickers)

    if args.from_supabase_table:
        db_tickers = get_tickers_from_supabase(
            table=args.from_supabase_table,
            column=args.ticker_column,
            limit=args.limit,
        )
        tickers.extend(db_tickers)

    tickers = list(dict.fromkeys(tickers))

    if args.limit and not args.from_supabase_table:
        tickers = tickers[: args.limit]

    if not tickers:
        print("No tickers supplied, so defaulting to your Supabase stocks table...")

        tickers = get_tickers_from_supabase(
            table="stocks",
            column="Ticker",
            limit=args.limit,
        )

    if not tickers:
        raise RuntimeError(
            'No tickers found in Supabase table "stocks" column "Ticker".'
        )

    print(f"Loaded {len(tickers):,} tickers to process.")

    success_count = 0
    fail_count = 0

    for index, ticker in enumerate(tickers, start=1):
        ticker_record = ticker_map.get(ticker)

        if not ticker_record:
            print(f"[{index}/{len(tickers)}] {ticker}: no SEC ticker mapping found.")
            fail_count += 1
            continue

        try:
            profile = parse_profile_for_ticker(
                session=session,
                ticker=ticker,
                ticker_record=ticker_record,
                debug_dir=args.debug_dir,
            )

            upsert_profile(profile)

            success_count += 1

            print(
                f"[{index}/{len(tickers)}] {ticker}: saved "
                f"{profile['member_count']} members | "
                f"score {profile['data_quality_score']} | "
                f"{profile['data_status']} | "
                f"{profile.get('source_form')}"
            )

        except KeyboardInterrupt:
            raise

        except Exception as exc:
            fail_count += 1
            print(f"[{index}/{len(tickers)}] {ticker}: ERROR {exc}")

            if args.stop_on_error:
                raise

    print("")
    print("Done.")
    print(f"Saved: {success_count:,}")
    print(f"Failed: {fail_count:,}")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Pull board members and executive leadership from SEC filings into Supabase."
    )

    parser.add_argument(
        "--tickers",
        help="Comma-separated tickers to run. Example: --tickers AAPL,MSFT,NVDA,META",
    )

    parser.add_argument(
        "--from-supabase-table",
        help="Optional table to pull tickers from. Example: --from-supabase-table stocks",
    )

    parser.add_argument(
        "--ticker-column",
        default="ticker",
        help="Ticker column name if using --from-supabase-table. Default: ticker",
    )

    parser.add_argument(
        "--limit",
        type=int,
        help="Optional limit on tickers.",
    )

    parser.add_argument(
        "--debug-dir",
        help="Optional folder to save downloaded HTML filings for debugging.",
    )

    parser.add_argument(
        "--stop-on-error",
        action="store_true",
        help="Stop immediately when one ticker fails.",
    )

    return parser


if __name__ == "__main__":
    import traceback

    parser = build_parser()
    cli_args = parser.parse_args()

    try:
        run(cli_args)
    except Exception as error:
        print(f"Fatal error: {type(error).__name__}: {error}", file=sys.stderr)
        traceback.print_exc()
        sys.exit(1)