from __future__ import annotations

import copy
import hashlib
import io
import json
import os
import re
import sys
import threading
import time
import unicodedata
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from difflib import SequenceMatcher
from dataclasses import dataclass, field, replace
from datetime import date, datetime, timezone
from decimal import (
    Decimal,
    InvalidOperation,
    ROUND_CEILING,
)
from typing import Any, Dict, Iterable, List, Optional, Sequence, Set, Tuple
from urllib.parse import quote

import requests
from pypdf import PdfReader

from db import get_db_connection_dict
from prediction_market_settlement import (
    SETTLEMENT_VERSION,
    build_kalshi_series_terms_profile,
    calendar_resolution_window,
    kalshi_series_terms_profile,
    verify_exact_pair,
)


ENGINE_VERSION = "native-exact-v20.5-positive-edge-depth"

POLYMARKET_CLOB_URL = "https://clob.polymarket.com"
KALSHI_API_URL = "https://external-api.kalshi.com/trade-api/v2"
REQUEST_TIMEOUT_SECONDS = 20
BOOK_BATCH_SIZE = 100
KALSHI_BOOK_WORKERS = 8
CATALOG_QUERY_BATCH_SIZE = 2000
ENGINE_CACHE_SECONDS = int(os.getenv("PREDICTION_ENGINE_CACHE_SECONDS", "300"))
MAX_SPORTS_START_DIFFERENCE_SECONDS = int(
    os.getenv("PREDICTION_MAX_SPORTS_START_DIFFERENCE_SECONDS", "21600")
)
MAX_PAST_SPORTS_EVENT_AGE_SECONDS = int(
    os.getenv("PREDICTION_MAX_PAST_SPORTS_EVENT_AGE_SECONDS", "43200")
)
LIVE_SPORTS_EVENT_WINDOW_SECONDS = int(
    os.getenv(
        "PREDICTION_LIVE_SPORTS_EVENT_WINDOW_SECONDS",
        "21600",
    )
)

KALSHI_STANDARD_TAKER_RATE = Decimal("0.07")
KALSHI_FEE_INCREMENT = Decimal("0.0001")
MAX_DEPTH_BREAKDOWN_ROWS = max(10, int(os.getenv("PREDICTION_DEPTH_BREAKDOWN_MAX_ROWS", "80")))

# Every live matched pair must expose exactly two route outcomes. Executable
# route states describe the economics; unavailable states describe the exact
# reason a required leg cannot currently be crossed.
EXECUTABLE_ROUTE_STATUSES = {
    "net_opportunity",
    "gross_only",
    "no_opportunity",
}

UNAVAILABLE_ROUTE_STATUSES = {
    "missing_polymarket_book",
    "missing_kalshi_book",
    "missing_polymarket_ask",
    "missing_kalshi_ask",
    "zero_polymarket_depth",
    "zero_kalshi_depth",
    "market_suspended",
    "market_closed",
    "venue_disconnected",
    "initializing",
    "snapshot_unavailable",
    "resynchronizing",
    "resync_failed",
    "sequence_invalid",
    "not_subscribed",
    "pair_lookup_missing",
}

ROUTE_STATUS_PRIORITY = {
    "pair_lookup_missing": 0,
    "venue_disconnected": 1,
    "sequence_invalid": 2,
    "resync_failed": 3,
    "resynchronizing": 4,
    "snapshot_unavailable": 5,
    "initializing": 6,
    "not_subscribed": 7,
    "market_closed": 8,
    "market_suspended": 9,
    "missing_polymarket_book": 10,
    "missing_kalshi_book": 11,
    "missing_polymarket_ask": 12,
    "missing_kalshi_ask": 13,
    "zero_polymarket_depth": 14,
    "zero_kalshi_depth": 15,
}

POLYMARKET_FEE_RATE_WORKERS = int(
    os.getenv(
        "PREDICTION_POLYMARKET_FEE_RATE_WORKERS",
        "12",
    )
)

POLYMARKET_FEE_RATE_TOLERANCE = Decimal(
    "0.0000001"
)

SYNTHETIC_MACRO_MAX_SCHEDULE_DIFFERENCE_SECONDS = int(
    os.getenv(
        "PREDICTION_SYNTHETIC_MACRO_MAX_SCHEDULE_DIFFERENCE_SECONDS",
        "129600",
    )
)

SYNTHETIC_MACRO_EXECUTION_BUFFER = float(
    os.getenv(
        "PREDICTION_SYNTHETIC_MACRO_EXECUTION_BUFFER",
        "0.01",
    )
)

# Manual approvals can be added only after both venues' settlement rules have
# been reviewed. Most candidates should be verified automatically from explicit
# inequality language in the Polymarket rules instead.
VERIFIED_SYNTHETIC_MACRO_RANGE_MARKETS: Set[str] = set()

VERIFIED_MACRO_COMPLEMENT_PAIRS: Set[
    Tuple[str, str]
] = set()

session = requests.Session()
session.headers.update(
    {
        "User-Agent": "BullionaireIQ Native Exact Prediction Market Engine",
        "Accept": "application/json",
    }
)

_scan_lock = threading.Lock()
_scan_cache: Dict[str, Any] = {"expires_at": 0.0, "payload": None}

# Settlement terms are fetched lazily ONLY after the normal verifier returns
# manual_review.  All already-definitive pairs follow the exact pre-v20.2.4 path.
AUTO_RESOLVE_MANUAL_SETTLEMENT_TERMS = str(
    os.getenv("PREDICTION_AUTO_RESOLVE_MANUAL_SETTLEMENT_TERMS", "true")
).strip().lower() not in {"0", "false", "no", "off"}

_manual_terms_lock = threading.Lock()
_manual_terms_attempted_series: Set[str] = set()
_manual_terms_failed_urls: Dict[str, str] = {}


def _kalshi_series_ticker_for_market(market: Market) -> Optional[str]:
    value = str(getattr(market, "external_series_id", "") or "").strip().upper()
    if value:
        return value
    event = getattr(market, "event", None)
    value = str(getattr(event, "external_series_id", "") or "").strip().upper()
    return value or None


def _extract_pdf_text_bytes(pdf_bytes: bytes) -> str:
    reader = PdfReader(io.BytesIO(pdf_bytes))
    return "\n".join((page.extract_text() or "") for page in reader.pages)


def _fetch_manual_kalshi_terms_profile(series_ticker: str) -> Dict[str, Any]:
    """Fetch one authoritative Kalshi series profile with no retry crawl."""
    response = session.get(
        f"{KALSHI_API_URL}/series/{series_ticker}",
        timeout=REQUEST_TIMEOUT_SECONDS,
    )
    response.raise_for_status()
    payload = response.json() or {}
    info = payload.get("series") or {}
    if not isinstance(info, dict):
        raise RuntimeError(f"Kalshi series metadata missing for {series_ticker}")

    terms_url = str(info.get("contract_terms_url") or "").strip()
    if not terms_url:
        return build_kalshi_series_terms_profile(info, "")

    failed_reason = _manual_terms_failed_urls.get(terms_url)
    if failed_reason is not None:
        raise RuntimeError(
            "shared contract-terms document already failed in this process: "
            + failed_reason
        )

    terms_response = session.get(terms_url, timeout=REQUEST_TIMEOUT_SECONDS)
    if terms_response.status_code == 404:
        reason = f"404 for {terms_url}"
        _manual_terms_failed_urls[terms_url] = reason
        raise FileNotFoundError(reason)
    terms_response.raise_for_status()

    pdf_bytes = terms_response.content
    terms_text = _extract_pdf_text_bytes(pdf_bytes)
    return build_kalshi_series_terms_profile(
        info,
        terms_text,
        terms_sha256=hashlib.sha256(pdf_bytes).hexdigest(),
    )


def _store_manual_terms_profile(
    markets: Dict[int, Market],
    series_ticker: str,
    profile: Dict[str, Any],
) -> None:
    """Attach the profile to loaded events and cache it on this DB snapshot."""
    touched_event_ids: Set[int] = set()
    for market in markets.values():
        if market.venue != "kalshi":
            continue
        if _kalshi_series_ticker_for_market(market) != series_ticker:
            continue
        if not isinstance(market.event.raw, dict):
            market.event.raw = {}
        market.event.raw["kalshi_series_terms_profile"] = profile
        touched_event_ids.add(market.event.id)

    if not touched_event_ids:
        return

    encoded = json.dumps(profile, ensure_ascii=False, default=str)
    with get_db_connection_dict() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE public.prediction_market_events
                SET raw_payload = jsonb_set(
                    COALESCE(raw_payload, '{}'::jsonb),
                    '{kalshi_series_terms_profile}',
                    %s::jsonb,
                    true
                )
                WHERE id = ANY(%s)
                """,
                (encoded, sorted(touched_event_ids)),
            )
        conn.commit()


def _retry_manual_settlement_with_authoritative_terms(
    decision: Any,
    poly_contract: ExactContract,
    kalshi_contract: ExactContract,
    markets: Dict[int, Market],
) -> Tuple[Any, str]:
    """
    Leave all definitive decisions untouched.  For manual_review only, fetch
    one Kalshi series terms document, cache it, and rerun the same verifier once.
    """
    if decision.status != "manual_review":
        return decision, "not_manual"
    if not AUTO_RESOLVE_MANUAL_SETTLEMENT_TERMS:
        return decision, "disabled"

    kalshi_market = markets[kalshi_contract.market_id]
    existing_profile = kalshi_series_terms_profile(kalshi_market)
    if existing_profile.get("status") == "ready":
        # The authoritative terms were already applied and the pair is still
        # unresolved; do not fetch or loop again.
        return decision, "already_profiled_still_manual"

    series_ticker = _kalshi_series_ticker_for_market(kalshi_market)
    if not series_ticker:
        return decision, "missing_series_ticker"

    with _manual_terms_lock:
        if series_ticker in _manual_terms_attempted_series:
            return decision, "already_attempted"
        _manual_terms_attempted_series.add(series_ticker)

        try:
            print(
                "Settlement manual_review detected; fetching authoritative "
                f"Kalshi terms only for {series_ticker}..."
            )
            profile = _fetch_manual_kalshi_terms_profile(series_ticker)
            _store_manual_terms_profile(markets, series_ticker, profile)
        except Exception as exc:
            print(
                f"Settlement manual terms unavailable for {series_ticker}: "
                f"{type(exc).__name__}: {exc}"
            )
            return decision, "fetch_failed"

    rerun = verify_exact_pair(
        poly_contract,
        kalshi_contract,
        markets,
        require_exception_equivalence=True,
    )
    if rerun.status == "manual_review":
        print(
            f"Settlement terms applied for {series_ticker}, but the pair "
            "remains unresolved and will stay out of the live manifest."
        )
        return rerun, "still_manual"

    print(
        f"Settlement terms resolved {series_ticker}: "
        f"manual_review -> {rerun.status}."
    )
    return rerun, "resolved"


MACRO_CANDIDATE_PATTERN = (
    r"fed|fomc|federal reserve|federal funds|interest rate|"
    r"cpi|consumer price|inflation|unemployment|payroll|jobs report|"
    r"gdp|gross domestic product|pce|personal consumption|recession|"
    r"retail sales|jobless claims|consumer sentiment"
)

WEATHER_CANDIDATE_PATTERN = (
    r"weather|temperature|precipitation|rainfall|snowfall|snow|"
    r"hurricane|tropical storm|tornado|drought|earthquake|"
    r"volcano|volcanic|eruption|sea ice|climate|warming"
)

SPORTS_WINNER_TYPES = {
    "winner",
    "game winner",
    "match winner",
    "fight winner",
    "moneyline",
    "money line",
    "moneyline winner",
    "head to head",
    "h2h",
}

SPORTS_REJECT_TERMS = {
    "spread",
    "handicap",
    "total",
    "over under",
    "player prop",
    "team prop",
    "period",
    "quarter",
    "half",
    "inning",
    "set",
    "map",
    "round",
    "series",
    "tournament",
    "champion",
    "outright",
    "margin",
    "score",
    "win by",
    "wins by",
}

SPORTS_REJECT_MARKET_ID_TERMS = {
    "SPREAD",
    "TOTAL",
    "MARGIN",
    "HANDICAP",
    "PERIOD",
    "QUARTER",
    "HALF",
    "INNING",
    "MAP",
    "ROUND",
}

SPORTS_EVENT_TERMS = (
    "sports",
    "esports",
    "game",
    "match",
    "fight",
    "mma",
    "ufc",
    "boxing",
    "chess",
    "tennis",
    "baseball",
    "basketball",
    "football",
    "hockey",
    "soccer",
    "cricket",
    "golf",
    "racing",
)


# Generic non-sports/non-macro categories use a stricter isolated matcher and
# diagnostics path. Production market_group="all" includes these groups after
# settlement gating, alongside sports, macro, and weather.
GENERIC_MARKET_GROUPS: Tuple[str, ...] = (
    "politics",
    "elections",
    "crypto",
    "technology",
    "entertainment",
    "awards",
    "companies",
    "legal",
    "geopolitics",
    "culture",
    "misc",
)

GENERIC_CATEGORY_ALIASES: Dict[str, str] = {
    "politics": "politics",
    "political": "politics",
    "election": "elections",
    "elections": "elections",
    "crypto": "crypto",
    "cryptocurrency": "crypto",
    "technology": "technology",
    "tech": "technology",
    "entertainment": "entertainment",
    "movies": "entertainment",
    "music": "entertainment",
    "awards": "awards",
    "business": "companies",
    "companies": "companies",
    "company": "companies",
    "legal": "legal",
    "law": "legal",
    "geopolitics": "geopolitics",
    "geopolitical": "geopolitics",
    "culture": "culture",
}

GENERIC_GROUP_PATTERNS: Sequence[Tuple[str, str]] = (
    (
        "elections",
        r"\b(election|elections|electoral|primary|primaries|ballot|"
        r"runoff|nominee|nomination|vote share|popular vote|electoral college)\b",
    ),
    (
        "awards",
        r"\b(oscar|oscars|academy award|grammy|grammys|emmy|emmys|"
        r"golden globe|bafta|nobel|award|awards|best picture|best actor|"
        r"best actress|album of the year|record of the year|person of the year|poty)\b",
    ),
    (
        "crypto",
        r"\b(bitcoin|btc|ethereum|ether|eth|solana|sol|xrp|dogecoin|doge|"
        r"crypto|cryptocurrency|blockchain|stablecoin|token|defi)\b",
    ),
    (
        "legal",
        r"\b(supreme court|scotus|court|lawsuit|trial|verdict|guilty|"
        r"convict|conviction|indict|indictment|sentence|sentencing|appeal|"
        r"legal case|justice department|doj)\b",
    ),
    (
        "geopolitics",
        r"\b(ceasefire|war|invasion|invade|military|troops|nato|sanction|"
        r"sanctions|treaty|peace deal|hostage|ukraine|russia|israel|iran|"
        r"taiwan|gaza|west bank|north korea|south china sea)\b",
    ),
    (
        "technology",
        r"\b(artificial intelligence|ai|openai|chatgpt|anthropic|claude|"
        r"gemini|gpt[- ]?\d|iphone|android|semiconductor|chip|robot|robotaxi|"
        r"software|hardware|technology|tech product)\b",
    ),
    (
        "companies",
        r"\b(company|companies|ceo|chief executive|ipo|initial public offering|"
        r"merger|acquisition|acquire|buyout|bankruptcy|revenue|earnings|"
        r"market cap|valuation|shareholder)\b",
    ),
    (
        "entertainment",
        r"\b(movie|film|box office|television|tv show|series|netflix|"
        r"streaming|album|song|billboard|music|concert|celebrity|actor|actress)\b",
    ),
    (
        "politics",
        r"\b(president|presidency|congress|senate|senator|house of representatives|"
        r"representative|governor|mayor|cabinet|administration|approval rating|"
        r"democrat|republican|gop|white house|parliament|prime minister|"
        r"government|legislation|political)\b",
    ),
    (
        "culture",
        r"\b(culture|religion|pope|vatican|social media|influencer|"
        r"fashion|festival|holiday|word of the year)\b",
    ),
)

GENERIC_TEXT_REPLACEMENTS: Sequence[Tuple[str, str]] = (
    (r"\bu[.]?s[.]?a?\b", "us"),
    (r"\bunited states\b", "us"),
    (r"\bpresidential\b", "president"),
    (r"\belections?\b", "election"),
    (r"\belected\b", "elect"),
    (r"\bwins?\b", "win"),
    (r"\bwinning\b", "win"),
    (r"\b(?:bitcoin|btc)\b", "bitcoin"),
    (r"\b(?:ethereum|ether|eth)\b", "ethereum"),
    (r"\bcryptocurrency\b", "crypto"),
    (r"\bartificial intelligence\b", "ai"),
    (r"\binitial public offering\b", "ipo"),
    (r"\bchief executive officer\b", "ceo"),
    (r"\bsupreme court of the united states\b", "supreme court"),
    (r"\bscotus\b", "supreme court"),
    (r"\b(?:acquisition|acquires?|acquired|buyout)\b", "acquire"),
    (r"\b(?:mergers?|merged|merges)\b", "merge"),
    (r"\b(?:release|releases|released|releasing|launch|launches|launched|launching)\b", "release"),
    (r"\b(?:resignation|resigns?|steps? down|step down)\b", "resign"),
    (r"\b(?:indictment|indicted)\b", "indict"),
    (r"\b(?:conviction|convicted)\b", "convict"),
    (r"\bcease[- ]fire\b", "ceasefire"),
    (r"\b(?:at least|no less than|or more|or above)\b", "at least"),
    (r"\b(?:at most|no more than|or less|or below)\b", "at most"),
    (r"\b(?:above|over|more than|greater than|exceed|exceeds|exceeded)\b", "above"),
    (r"\b(?:below|under|less than)\b", "below"),
)

GENERIC_STOP_WORDS: Set[str] = {
    "a", "an", "and", "are", "as", "at", "be", "been", "before", "by",
    "do", "does", "for", "from", "has", "have", "if", "in", "into",
    "is", "it", "of", "on", "or", "the", "this", "to", "was", "were",
    "will", "with", "within", "would", "yes", "no", "market", "event",
    "contract", "question", "result", "outcome", "end", "ending",
}

GENERIC_ACTION_PATTERNS: Sequence[Tuple[str, str]] = (
    (r"\b(win|elect)\b", "win_or_elect"),
    (r"\bresign\b", "resign"),
    (r"\brelease\b", "release"),
    (r"\bacquire\b", "acquire"),
    (r"\bmerge\b", "merge"),
    (r"\bapprove|approval\b", "approve"),
    (r"\bban|banned\b", "ban"),
    (r"\bindict\b", "indict"),
    (r"\bconvict|guilty\b", "convict"),
    (r"\bsentence|sentencing\b", "sentence"),
    (r"\bceasefire\b", "ceasefire"),
    (r"\binvad(?:e|es|ed|ing)|invasion\b", "invade"),
    (r"\bwithdraw|withdraws|withdrew|withdrawal\b", "withdraw"),
    (r"\bdefault|defaults|defaulted\b", "default"),
    (r"\bbankrupt|bankruptcy\b", "bankruptcy"),
    (r"\bipo\b", "ipo"),
    (r"\bappoint|appointment|nominate|nomination\b", "appoint_or_nominate"),
    (r"\bremove|removed|fire|fired\b", "remove"),
    (r"\bshutdown|shut down\b", "shutdown"),
)

GENERIC_MAX_WORD_FREQUENCY = int(
    os.getenv("PREDICTION_GENERIC_MAX_WORD_FREQUENCY", "600")
)
GENERIC_MAX_INDEX_WORDS = int(
    os.getenv("PREDICTION_GENERIC_MAX_INDEX_WORDS", "6")
)
GENERIC_MIN_SHARED_WORDS = int(
    os.getenv("PREDICTION_GENERIC_MIN_SHARED_WORDS", "2")
)
GENERIC_MIN_JACCARD = float(
    os.getenv("PREDICTION_GENERIC_MIN_JACCARD", "0.68")
)
GENERIC_MIN_CONTAINMENT = float(
    os.getenv("PREDICTION_GENERIC_MIN_CONTAINMENT", "0.78")
)
GENERIC_MIN_SCORE = float(
    os.getenv("PREDICTION_GENERIC_MIN_SCORE", "0.84")
)
GENERIC_UNIQUE_MARGIN = float(
    os.getenv("PREDICTION_GENERIC_UNIQUE_MARGIN", "0.035")
)


@dataclass
class Entity:
    id: int
    venue: str
    external_entity_id: str
    name: str
    entity_type: Optional[str]
    league: Optional[str]
    abbreviation: Optional[str]
    alias: Optional[str]
    source_id: Optional[str]
    source_ids: Dict[str, Any]
    canonical_entity_key: Optional[str]
    canonical_match_method: Optional[str]


@dataclass
class Event:
    id: int
    venue: str
    external_event_id: str
    external_series_id: Optional[str]
    title: str
    category: Optional[str]
    event_type: Optional[str]
    venue_status: Optional[str]
    start_time: Optional[datetime]
    end_time: Optional[datetime]
    close_time: Optional[datetime]
    settlement_time: Optional[datetime]
    native_game_id: Optional[str]
    milestone_id: Optional[str]
    source_id: Optional[str]
    source_ids: Dict[str, Any]
    details: Dict[str, Any]
    raw: Dict[str, Any]
    entities: List[Tuple[Entity, str]] = field(default_factory=list)



@dataclass
class Market:
    id: int
    venue: str
    event: Event
    external_market_id: str
    external_event_id: Optional[str]
    external_series_id: Optional[str]
    event_title: str
    market_title: str
    market_slug: Optional[str]
    category: Optional[str]
    market_type: Optional[str]
    sports_market_type: Optional[str]
    venue_status: Optional[str]
    resolution_time: Optional[datetime]
    event_start_time: Optional[datetime]
    close_time: Optional[datetime]
    settlement_time: Optional[datetime]
    rules_url: Optional[str]
    rules_primary: Optional[str]
    rules_secondary: Optional[str]
    accepting_orders: Optional[bool]
    primary_participant_key: Optional[str]
    line_value: Optional[str]
    floor_strike: Optional[str]
    cap_strike: Optional[str]
    functional_strike: Optional[str]
    custom_strike: Dict[str, Any]
    contract_semantics: Dict[str, Any]
    outcomes: List[Dict[str, Any]]
    raw: Dict[str, Any]
    liquidity: Optional[float]
    volume_24h: Optional[float]
    total_volume: Optional[float]
    open_interest: Optional[float]
    updated_at: Optional[datetime]
    quotes: Dict[str, Dict[str, Any]] = field(default_factory=dict)



@dataclass(frozen=True)
class EventGroup:
    key: str
    venue: str
    event_ids: Tuple[int, ...]
    title: str
    start_time: Optional[datetime]
    entities: Tuple[Entity, Entity]


@dataclass(frozen=True)
class EventMatch:
    polymarket_group_key: str
    kalshi_group_key: str
    participant_map: Tuple[Tuple[int, int], ...]
    match_method: str
    time_difference_seconds: int


@dataclass(frozen=True)
class ExactContract:
    market_id: int
    venue: str
    event_identity: str
    contract_identity: str
    market_group: str
    event_title: str
    contract_title: str
    scheduled_time: Optional[str]
    yes_key: str
    no_key: str
    yes_label: str
    no_label: str
    event_match_method: str
    pair_relationship: str = "direct"
    settlement_status: str = "unverified"
    settlement_stream_eligible: bool = False
    settlement_verified: bool = False
    settlement_signature: Dict[str, Any] = field(
        default_factory=dict,
        compare=False,
    )
    settlement_reasons: Tuple[str, ...] = ()


@dataclass(frozen=True)
class GenericCandidateMatch:
    polymarket_market_id: int
    kalshi_market_id: int
    polymarket_event_id: int
    kalshi_event_id: int
    market_group: str
    contract_identity: str
    score: float
    shared_words: int
    match_method: str


@dataclass(frozen=True)
class SyntheticMacroCandidate:
    event_identity: str
    contract_identity: str
    polymarket_contract: ExactContract
    lower_kalshi_contract: ExactContract
    upper_kalshi_contract: ExactContract
    lower_bound: str
    upper_bound: str
    boundary_mode: str
    verification_method: str


@dataclass
class ExactPairContext:
    events: Dict[int, Event]
    markets: Dict[int, Market]
    markets_by_event: Dict[int, List[Market]]
    venue_counts: Dict[str, int]
    sports_pairs: List[Tuple[ExactContract, ExactContract]]
    macro_pairs: List[Tuple[ExactContract, ExactContract]]
    macro_synthetic_candidates: List[SyntheticMacroCandidate]
    weather_pairs: List[Tuple[ExactContract, ExactContract]]
    generic_pairs: List[Tuple[ExactContract, ExactContract]]
    diagnostics: Dict[str, Any]
    snapshot_marker: Optional[str]

    @property
    def exact_pairs(self) -> List[Tuple[ExactContract, ExactContract]]:
        return [
            *self.sports_pairs,
            *self.macro_pairs,
            *self.weather_pairs,
            *self.generic_pairs,
        ]


@dataclass
class LiveFeePricingContext:
    exact_context: ExactPairContext
    pair_lookup: Dict[
        Tuple[str, str, str],
        Tuple[ExactContract, ExactContract],
    ]
    kalshi_fee_configuration: Dict[str, Any]
    generated_at: str
    polymarket_fee_rates_loaded: int

    @property
    def snapshot_marker(self) -> Optional[str]:
        return self.exact_context.snapshot_marker

    def summary(self) -> Dict[str, Any]:
        return {
            "engineVersion": ENGINE_VERSION,
            "generatedAt": self.generated_at,
            "snapshotMarker": self.snapshot_marker,
            "exactPairs": len(self.pair_lookup),
            "polymarketFeeRatesLoaded": (
                self.polymarket_fee_rates_loaded
            ),
            "kalshiSeriesFeesLoaded": bool(
                self.kalshi_fee_configuration.get(
                    "seriesLoaded"
                )
            ),
            "kalshiEventFeesLoaded": bool(
                self.kalshi_fee_configuration.get(
                    "eventsLoaded"
                )
            ),
        }



def as_json(value: Any, expected_type: type, default: Any) -> Any:
    if isinstance(value, expected_type):
        return value
    if isinstance(value, str):
        try:
            parsed = json.loads(value)
            return parsed if isinstance(parsed, expected_type) else default
        except (TypeError, json.JSONDecodeError):
            return default
    return default


def as_float(value: Any) -> Optional[float]:
    try:
        if value in (None, ""):
            return None
        return float(value)
    except (TypeError, ValueError):
        return None

def first_non_empty(
    *values: Any,
) -> Optional[Any]:
    for value in values:
        if value not in (
            None,
            "",
            [],
            {},
        ):
            return value

    return None

def parse_datetime(value: Any) -> Optional[datetime]:
    if value in (None, ""):
        return None
    if isinstance(value, datetime):
        parsed = value
    elif isinstance(value, date):
        parsed = datetime(value.year, value.month, value.day, tzinfo=timezone.utc)
    else:
        try:
            parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        except ValueError:
            return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed


def iso_value(value: Any) -> Optional[str]:
    parsed = parse_datetime(value)
    return parsed.isoformat() if parsed else None


def latest_iso_value(*values: Any) -> Optional[str]:
    """Return the latest valid timestamp without using scheduled/start time as a fallback."""
    parsed = [parse_datetime(value) for value in values]
    present = [value for value in parsed if value is not None]
    return max(present).isoformat() if present else None


def exact_text(value: Any) -> str:
    raw = (
        str(value or "")
        .replace("≥", ">=")
        .replace("≤", "<=")
        .replace("–", " ")
        .replace("—", " ")
    )
    text = unicodedata.normalize("NFKD", raw)
    text = "".join(char for char in text if not unicodedata.combining(char))
    text = text.lower().replace("&", " and ")
    text = re.sub(r"[^a-z0-9%+.<>=-]+", " ", text)
    return " ".join(text.split())


def exact_code(value: Any) -> str:
    return exact_text(value).replace(" ", "_")


def decimal_text(value: Any) -> Optional[str]:
    if value in (None, ""):
        return None
    try:
        number = Decimal(str(value).replace(",", "").strip())
    except (InvalidOperation, ValueError):
        return None
    normalised = format(number.normalize(), "f")
    return "0" if normalised in {"-0", ""} else normalised


def scalar_values(value: Any) -> Iterable[Tuple[str, str]]:
    def walk(node: Any, path: Tuple[str, ...]) -> Iterable[Tuple[str, str]]:
        if isinstance(node, dict):
            for key, child in node.items():
                yield from walk(child, (*path, exact_code(key)))
        elif isinstance(node, list):
            for child in node:
                yield from walk(child, path)
        elif node not in (None, "", True, False):
            yield ".".join(part for part in path if part), str(node).strip()

    yield from walk(value, ())


def provider_tokens(source_id: Any, source_ids: Dict[str, Any]) -> Set[str]:
    tokens: Set[str] = set()
    if source_id not in (None, ""):
        tokens.add(f"source_id:{exact_code(source_id)}")
    for path, value in scalar_values(source_ids):
        if path and value:
            tokens.add(f"{path}:{exact_code(value)}")
    return tokens


def entity_names(entity: Entity) -> Set[str]:
    return {
        value
        for value in (
            exact_text(entity.name),
            exact_text(entity.alias),
            exact_text(entity.abbreviation),
        )
        if value
    }


def canonical_league(value: Any) -> Optional[str]:
    code = exact_code(value)
    aliases = {
        "pro_baseball": "mlb",
        "major_league_baseball": "mlb",
        "baseball": "mlb",
        "pro_basketball_m": "nba",
        "professional_basketball": "nba",
        "pro_basketball_w": "wnba",
        "pro_football": "nfl",
        "professional_football": "nfl",
        "pro_hockey": "nhl",
        "professional_hockey": "nhl",
        "college_football": "ncaaf",
        "college_basketball_m": "ncaab",
        "college_basketball_w": "ncaawb",
    }
    if not code:
        return None
    return aliases.get(code, code)


def entities_match(left: Entity, right: Entity) -> Optional[str]:
    if left.venue == right.venue:
        return None

    if (
        left.canonical_entity_key
        and right.canonical_entity_key
        and left.canonical_entity_key == right.canonical_entity_key
    ):
        methods = {left.canonical_match_method, right.canonical_match_method}
        return "manual_entity_link" if "manual" in methods else "verified_entity_link"

    # Bare source_id values can belong to different providers. Only compare
    # provider-qualified source_ids across venues.
    left_sources = provider_tokens(None, left.source_ids)
    right_sources = provider_tokens(None, right.source_ids)
    if left_sources & right_sources:
        return "shared_source_id"

    left_league = canonical_league(left.league)
    right_league = canonical_league(right.league)
    if left_league and right_league and left_league != right_league:
        return None

    if entity_names(left) & entity_names(right):
        return "exact_entity_name"
    return None


def event_time(event: Event) -> Optional[datetime]:
    return event.start_time or event.end_time


def market_time(market: Market) -> Optional[datetime]:
    return market.event_start_time or event_time(market.event) or market.resolution_time


def is_sports_event(event: Event) -> bool:
    values = exact_text(
        f"{event.category or ''} {event.event_type or ''} "
        f"{event.title or ''}"
    )
    words = set(values.split())
    return any(term in words for term in SPORTS_EVENT_TERMS)



def distinct_event_entities(event: Event) -> List[Entity]:
    entities: Dict[int, Entity] = {}
    for entity, role in event.entities:
        if role in {"home", "away", "participant", "subject", "unknown"}:
            entities[entity.id] = entity
    return list(entities.values())


def participant_mapping(
    poly_entities: Sequence[Entity],
    kalshi_entities: Sequence[Entity],
) -> Optional[Tuple[Tuple[Tuple[int, int], ...], str]]:
    if len(poly_entities) != 2 or len(kalshi_entities) != 2:
        return None

    possible = []
    for ordered_kalshi in (
        (kalshi_entities[0], kalshi_entities[1]),
        (kalshi_entities[1], kalshi_entities[0]),
    ):
        methods = [
            entities_match(poly_entities[0], ordered_kalshi[0]),
            entities_match(poly_entities[1], ordered_kalshi[1]),
        ]
        if all(methods):
            pairs = tuple(
                sorted(
                    (
                        (poly_entities[0].id, ordered_kalshi[0].id),
                        (poly_entities[1].id, ordered_kalshi[1].id),
                    )
                )
            )
            possible.append((pairs, "+".join(sorted(set(methods)))))

    unique = {pairs: method for pairs, method in possible}
    if len(unique) != 1:
        return None
    pairs, method = next(iter(unique.items()))
    return pairs, method


def entity_index_tokens(entity: Entity) -> Set[str]:
    tokens = {f"name:{name}" for name in entity_names(entity)}
    tokens.update(
        f"provider:{token}"
        for token in provider_tokens(None, entity.source_ids)
    )
    if entity.canonical_entity_key:
        tokens.add(f"canonical:{entity.canonical_entity_key}")
    return tokens


def participant_index_keys(
    entities: Sequence[Entity],
) -> Set[Tuple[str, str]]:
    if len(entities) != 2:
        return set()
    left_tokens = entity_index_tokens(entities[0])
    right_tokens = entity_index_tokens(entities[1])
    return {
        tuple(sorted((left_token, right_token)))
        for left_token in left_tokens
        for right_token in right_tokens
        if left_token != right_token
    }


def native_sports_group_key(event: Event, entities: Sequence[Entity]) -> str:
    if event.venue == "kalshi":
        native_id = event.milestone_id or event.native_game_id
        native_kind = "milestone" if event.milestone_id else "game"
    else:
        native_id = event.native_game_id
        native_kind = "game"

    if native_id in (None, ""):
        native_kind = "event"
        native_id = str(event.id)

    participant_key = ",".join(str(entity.id) for entity in sorted(
        entities,
        key=lambda entity: entity.id,
    ))
    return (
        f"{event.venue}:{native_kind}:{native_id}:"
        f"participants:{participant_key}"
    )


def build_sports_event_groups(
    events: Dict[int, Event],
) -> Tuple[Dict[str, EventGroup], Dict[str, int]]:
    grouped_events: Dict[str, List[Event]] = defaultdict(list)
    group_entities: Dict[str, Tuple[Entity, Entity]] = {}
    venue_rows = Counter()

    for event in events.values():
        if not is_sports_event(event):
            continue
        entities = distinct_event_entities(event)
        if len(entities) != 2:
            continue
        ordered_entities = tuple(sorted(entities, key=lambda entity: entity.id))
        key = native_sports_group_key(event, ordered_entities)
        grouped_events[key].append(event)
        group_entities[key] = ordered_entities
        venue_rows[event.venue] += 1

    groups: Dict[str, EventGroup] = {}
    native_group_counts = Counter(
        rows[0].venue for rows in grouped_events.values()
    )
    stale_group_counts = Counter()
    stale_before = datetime.now(timezone.utc).timestamp() - (
        MAX_PAST_SPORTS_EVENT_AGE_SECONDS
    )
    for key, rows in grouped_events.items():
        times = sorted(
            value
            for value in (event_time(event) for event in rows)
            if value is not None
        )
        titles = [event.title for event in rows if event.title]
        representative_time = times[len(times) // 2] if times else None
        if (
            representative_time
            and representative_time.timestamp() < stale_before
        ):
            stale_group_counts[rows[0].venue] += 1
            continue
        groups[key] = EventGroup(
            key=key,
            venue=rows[0].venue,
            event_ids=tuple(sorted(event.id for event in rows)),
            title=min(titles, key=len) if titles else key,
            start_time=representative_time,
            entities=group_entities[key],
        )

    venue_groups = Counter(group.venue for group in groups.values())
    return groups, {
        "polymarketSportsEventRows": venue_rows["polymarket"],
        "kalshiSportsEventRows": venue_rows["kalshi"],
        "polymarketSportsGroups": venue_groups["polymarket"],
        "kalshiSportsGroups": venue_groups["kalshi"],
        "kalshiEventRowsCollapsedByMilestone": (
            venue_rows["kalshi"] - native_group_counts["kalshi"]
        ),
        "stalePolymarketSportsGroupsExcluded": stale_group_counts[
            "polymarket"
        ],
        "staleKalshiSportsGroupsExcluded": stale_group_counts["kalshi"],
    }


def build_sports_event_matches(
    events: Dict[int, Event],
) -> Tuple[List[EventMatch], Dict[str, int], Dict[str, EventGroup]]:
    groups, group_diagnostics = build_sports_event_groups(events)
    poly_groups = [
        group for group in groups.values() if group.venue == "polymarket"
    ]
    kalshi_groups = [
        group for group in groups.values() if group.venue == "kalshi"
    ]

    kalshi_by_key_and_day: Dict[
        Tuple[Tuple[str, str], int], List[EventGroup]
    ] = (
        defaultdict(list)
    )
    for kalshi_group in kalshi_groups:
        scheduled = kalshi_group.start_time
        if scheduled:
            day = int(scheduled.timestamp() // 86400)
            for key in participant_index_keys(kalshi_group.entities):
                kalshi_by_key_and_day[(key, day)].append(kalshi_group)

    candidates_by_key: Dict[Tuple[str, str], EventMatch] = {}
    for poly_group in poly_groups:
        scheduled = poly_group.start_time
        if not scheduled:
            continue
        day = int(scheduled.timestamp() // 86400)
        possible_kalshi: Dict[str, EventGroup] = {}
        for key in participant_index_keys(poly_group.entities):
            for nearby_day in (day - 1, day, day + 1):
                for group in kalshi_by_key_and_day.get((key, nearby_day), []):
                    possible_kalshi[group.key] = group

        for kalshi_group in possible_kalshi.values():
            if not kalshi_group.start_time:
                continue
            difference = abs(
                (scheduled - kalshi_group.start_time).total_seconds()
            )
            if difference > MAX_SPORTS_START_DIFFERENCE_SECONDS:
                continue
            mapping = participant_mapping(
                poly_group.entities,
                kalshi_group.entities,
            )
            if not mapping:
                continue
            participant_map, method = mapping
            candidates_by_key[(poly_group.key, kalshi_group.key)] = EventMatch(
                polymarket_group_key=poly_group.key,
                kalshi_group_key=kalshi_group.key,
                participant_map=participant_map,
                match_method=method,
                time_difference_seconds=round(difference),
            )

    candidates = list(candidates_by_key.values())
    by_poly: Dict[str, List[EventMatch]] = defaultdict(list)
    by_kalshi: Dict[str, List[EventMatch]] = defaultdict(list)
    for match in candidates:
        by_poly[match.polymarket_group_key].append(match)
        by_kalshi[match.kalshi_group_key].append(match)

    def unique_nearest(rows: Sequence[EventMatch]) -> Optional[EventMatch]:
        if not rows:
            return None
        nearest_difference = min(row.time_difference_seconds for row in rows)
        nearest = [
            row for row in rows
            if row.time_difference_seconds == nearest_difference
        ]
        return nearest[0] if len(nearest) == 1 else None

    best_for_poly = {
        key: unique_nearest(rows) for key, rows in by_poly.items()
    }
    best_for_kalshi = {
        key: unique_nearest(rows) for key, rows in by_kalshi.items()
    }
    unique_matches = [
        match for match in candidates
        if best_for_poly.get(match.polymarket_group_key) == match
        and best_for_kalshi.get(match.kalshi_group_key) == match
    ]
    return unique_matches, {
        **group_diagnostics,
        # Retain these names for the existing diagnostics panel/API clients.
        "polymarketSportsEvents": len(poly_groups),
        "kalshiSportsEvents": len(kalshi_groups),
        "sportsEventCandidates": len(candidates),
        "sportsEventMatches": len(unique_matches),
        "ambiguousSportsEventCandidates": len(candidates) - len(unique_matches),
    }, groups


def outcome_rows(market: Market) -> List[Dict[str, str]]:
    rows = []
    for item in market.outcomes:
        if not isinstance(item, dict):
            continue
        key = str(item.get("key") or "").strip()
        label = str(item.get("label") or "").strip()
        if key and label:
            rows.append({"key": key, "label": label})
    return rows


def yes_no_outcomes(market: Market) -> Optional[Tuple[Dict[str, str], Dict[str, str]]]:
    by_label = {exact_text(row["label"]): row for row in outcome_rows(market)}
    if set(by_label) != {"yes", "no"}:
        return None
    return by_label["yes"], by_label["no"]


def nested_strings(value: Any) -> Iterable[str]:
    if isinstance(value, dict):
        for child in value.values():
            yield from nested_strings(child)
    elif isinstance(value, list):
        for child in value:
            yield from nested_strings(child)
    elif value not in (None, "", True, False):
        yield str(value).strip()


def resolve_entity_reference(
    market: Market,
    entities: Sequence[Entity],
    values: Sequence[Any],
    *,
    allow_mentions: bool,
) -> Optional[Entity]:
    strings = [
        text
        for value in values
        for text in nested_strings(value)
        if text
    ]

    exact_matches = set()
    for entity in entities:
        ids = {entity.external_entity_id}
        ids.update(value for _, value in scalar_values(entity.source_ids))
        if entity.source_id:
            ids.add(entity.source_id)
        names = entity_names(entity)
        for value in strings:
            if value in ids or exact_text(value) in names:
                exact_matches.add(entity.id)

    if len(exact_matches) == 1:
        entity_id = next(iter(exact_matches))
        return next(entity for entity in entities if entity.id == entity_id)
    if exact_matches:
        return None

    if allow_mentions:
        mentioned = set()
        combined = exact_text(" ".join(strings))
        for entity in entities:
            for name in entity_names(entity):
                if len(name) < 3:
                    continue
                if re.search(rf"(?:^|\s){re.escape(name)}(?:$|\s)", combined):
                    mentioned.add(entity.id)
        if len(mentioned) == 1:
            entity_id = next(iter(mentioned))
            return next(entity for entity in entities if entity.id == entity_id)
    return None


def sports_type_values(market: Market) -> Set[str]:
    product_metadata = as_json(
        market.contract_semantics.get("product_metadata"), dict, {}
    )
    values = {
        exact_text(value)
        for value in (
            market.sports_market_type,
            market.market_type,
            market.contract_semantics.get("sportsMarketType"),
            product_metadata.get("market_type"),
            product_metadata.get("scope"),
            product_metadata.get("type"),
        )
        if value not in (None, "")
    }
    return values


def contains_exact_phrase(text: str, phrase: str) -> bool:
    pattern = r"\b" + r"\s+".join(
        re.escape(part) for part in phrase.split()
    ) + r"\b"
    return re.search(pattern, text) is not None


def is_full_game_winner_market(market: Market) -> bool:
    if not is_sports_event(market.event):
        return False
    if len(distinct_event_entities(market.event)) != 2:
        return False

    native_market_id = market.external_market_id.upper()
    if any(
        term in native_market_id
        for term in SPORTS_REJECT_MARKET_ID_TERMS
    ):
        return False

    market_specific_text = exact_text(
        " ".join(
            str(value)
            for value in (
                market.market_title,
                market.contract_semantics.get("yes_sub_title"),
                market.contract_semantics.get("no_sub_title"),
                market.contract_semantics.get("subtitle"),
            )
            if value not in (None, "")
        )
    )
    # A native moneyline/winner family can still contain period or derivative
    # contracts. Reject market-specific prop language before trusting the
    # event-level native type.
    if any(
        contains_exact_phrase(market_specific_text, term)
        for term in SPORTS_REJECT_TERMS
    ):
        return False

    type_values = sports_type_values(market)
    type_words = " ".join(sorted(type_values))
    if any(
        contains_exact_phrase(type_words, term)
        for term in SPORTS_REJECT_TERMS
    ):
        return False
    if type_values & SPORTS_WINNER_TYPES:
        return True

    if re.search(
        r"\b(win|wins|winner|moneyline|beat|defeat)\b",
        market_specific_text,
    ):
        return yes_no_outcomes(market) is not None
    return False


def is_draw_outcome_market(market: Market) -> bool:
    ticker_parts = [
        part for part in re.split(r"[-_]", market.external_market_id.upper())
        if part
    ]
    if ticker_parts and ticker_parts[-1] in {"TIE", "DRAW"}:
        return True

    semantic_values = [
        market.primary_participant_key,
        market.contract_semantics.get("primary_participant_key"),
        market.contract_semantics.get("yes_sub_title"),
        market.contract_semantics.get("subtitle"),
        market.custom_strike,
        market.contract_semantics.get("custom_strike"),
    ]
    exact_semantics = {
        exact_text(text)
        for value in semantic_values
        for text in nested_strings(value)
        if text
    }
    if exact_semantics & {"tie", "draw", "a tie", "a draw"}:
        return True

    title = exact_text(market.market_title)
    return re.search(
        r"\b(?:end|ends|finish|finishes|result|results|be)\s+"
        r"(?:in\s+)?(?:a\s+)?(?:tie|draw)\b",
        title,
    ) is not None


def sports_contracts_for_market(market: Market) -> List[Tuple[int, ExactContract]]:
    if not is_full_game_winner_market(market):
        return []

    entities = distinct_event_entities(market.event)
    outcomes = outcome_rows(market)
    binary = yes_no_outcomes(market)
    scheduled = iso_value(market_time(market))
    event_identity = f"native-sports-event:{market.event.id}"

    if not binary and len(outcomes) == 2:
        resolved = [
            resolve_entity_reference(
                market,
                entities,
                [outcome["label"]],
                allow_mentions=False,
            )
            for outcome in outcomes
        ]
        if not all(resolved) or resolved[0].id == resolved[1].id:
            return []

        contracts = []
        for index, entity in enumerate(resolved):
            yes = outcomes[index]
            no = outcomes[1 - index]
            contracts.append(
                (
                    entity.id,
                    ExactContract(
                        market.id,
                        market.venue,
                        event_identity,
                        f"winner-entity:{entity.id}",
                        "sports",
                        market.event.title,
                        f"{entity.name} to win",
                        scheduled,
                        yes["key"],
                        no["key"],
                        yes["label"],
                        no["label"],
                        "pending_event_pair",
                    ),
                )
            )
        return contracts

    if not binary:
        return []

    # A draw/tie is a third event outcome, not a second contract for either
    # participant. Keep it out of team-winner identities; a later draw matcher
    # can compare it only with an exact draw proposition on the other venue.
    if is_draw_outcome_market(market):
        return []

    yes, no = binary
    subject_values = [
        market.primary_participant_key,
        market.custom_strike,
        market.contract_semantics.get("primary_participant_key"),
        market.contract_semantics.get("custom_strike"),
        market.contract_semantics.get("yes_sub_title"),
        market.contract_semantics.get("subtitle"),
        market.market_title,
    ]
    subject = resolve_entity_reference(
        market,
        entities,
        subject_values,
        allow_mentions=True,
    )
    if not subject:
        return []

    return [
        (
            subject.id,
            ExactContract(
                market.id,
                market.venue,
                event_identity,
                f"winner-entity:{subject.id}",
                "sports",
                market.event.title,
                f"{subject.name} to win",
                scheduled,
                yes["key"],
                no["key"],
                yes["label"],
                no["label"],
                "pending_event_pair",
            ),
        )
    ]


def kalshi_primary_event_ids(
    group: EventGroup,
    markets_by_event: Dict[int, List[Market]],
) -> Tuple[int, ...]:
    primary_tickers: Set[str] = set()
    events_by_id: Dict[int, Event] = {}

    for event_id in group.event_ids:
        event_markets = markets_by_event.get(event_id, [])
        if not event_markets:
            continue
        event = event_markets[0].event
        events_by_id[event_id] = event
        milestone = as_json(event.raw.get("milestone"), dict, {})
        raw_primary = milestone.get("primary_event_tickers") or []
        if isinstance(raw_primary, list):
            primary_tickers.update(
                str(ticker) for ticker in raw_primary
                if ticker not in (None, "")
            )

    return tuple(
        event_id
        for event_id, event in events_by_id.items()
        if event.external_event_id in primary_tickers
    )


def sports_contract_rows_for_events(
    event_ids: Sequence[int],
    markets_by_event: Dict[int, List[Market]],
) -> Dict[int, List[ExactContract]]:
    rows: Dict[int, List[ExactContract]] = defaultdict(list)
    for event_id in event_ids:
        for market in markets_by_event.get(event_id, []):
            for entity_id, contract in sports_contracts_for_market(market):
                rows[entity_id].append(contract)
    return rows


def count_separated_draw_contracts(
    event_ids: Sequence[int],
    markets_by_event: Dict[int, List[Market]],
) -> int:
    return sum(
        1
        for event_id in event_ids
        for market in markets_by_event.get(event_id, [])
        if is_full_game_winner_market(market)
        and is_draw_outcome_market(market)
    )


def build_sports_contract_pairs(
    event_matches: Sequence[EventMatch],
    groups: Dict[str, EventGroup],
    markets_by_event: Dict[int, List[Market]],
) -> Tuple[List[Tuple[ExactContract, ExactContract]], Dict[str, Any]]:
    pairs: List[Tuple[ExactContract, ExactContract]] = []
    market_lookup = {
        market.id: market
        for event_markets in markets_by_event.values()
        for market in event_markets
    }
    poly_eligible = 0
    kalshi_eligible = 0
    polymarket_draws_separated = 0
    kalshi_draws_separated = 0
    ambiguous_contracts = 0
    kalshi_primary_groups = 0
    kalshi_primary_fallback_groups = 0
    kalshi_groups_without_primary_metadata = 0
    kalshi_related_event_rows_excluded = 0
    ambiguous_samples: List[Dict[str, Any]] = []

    for event_match in event_matches:
        poly_group = groups[event_match.polymarket_group_key]
        kalshi_group = groups[event_match.kalshi_group_key]
        poly_rows = sports_contract_rows_for_events(
            poly_group.event_ids,
            markets_by_event,
        )
        poly_eligible += sum(len(rows) for rows in poly_rows.values())
        polymarket_draws_separated += count_separated_draw_contracts(
            poly_group.event_ids,
            markets_by_event,
        )

        primary_event_ids = kalshi_primary_event_ids(
            kalshi_group,
            markets_by_event,
        )
        primary_rows = sports_contract_rows_for_events(
            primary_event_ids,
            markets_by_event,
        )
        if primary_rows:
            kalshi_rows = primary_rows
            selected_kalshi_event_ids = primary_event_ids
            kalshi_primary_groups += 1
            kalshi_related_event_rows_excluded += (
                len(kalshi_group.event_ids) - len(primary_event_ids)
            )
        else:
            selected_kalshi_event_ids = kalshi_group.event_ids
            kalshi_rows = sports_contract_rows_for_events(
                selected_kalshi_event_ids,
                markets_by_event,
            )
            if primary_event_ids:
                kalshi_primary_fallback_groups += 1
            else:
                kalshi_groups_without_primary_metadata += 1
        kalshi_eligible += sum(len(rows) for rows in kalshi_rows.values())
        kalshi_draws_separated += count_separated_draw_contracts(
            selected_kalshi_event_ids,
            markets_by_event,
        )

        for poly_entity_id, kalshi_entity_id in event_match.participant_map:
            poly_contracts = poly_rows.get(poly_entity_id, [])
            kalshi_contracts = kalshi_rows.get(kalshi_entity_id, [])
            if len(poly_contracts) != 1 or len(kalshi_contracts) != 1:
                if poly_contracts and kalshi_contracts:
                    ambiguous_contracts += 1
                    if len(ambiguous_samples) < 10:
                        poly_entity = next(
                            entity for entity in poly_group.entities
                            if entity.id == poly_entity_id
                        )

                        def candidate_details(
                            contracts: Sequence[ExactContract],
                        ) -> List[Dict[str, Any]]:
                            details = []
                            for contract in contracts:
                                market = market_lookup[contract.market_id]
                                details.append(
                                    {
                                        "marketId": market.external_market_id,
                                        "title": market.market_title,
                                        "sportsMarketType": (
                                            market.sports_market_type
                                        ),
                                        "primaryParticipantKey": (
                                            market.primary_participant_key
                                        ),
                                        "nativeTypeValues": sorted(
                                            sports_type_values(market)
                                        ),
                                    }
                                )
                            return details

                        ambiguous_samples.append(
                            {
                                "eventTitle": poly_group.title,
                                "participant": poly_entity.name,
                                "polymarketCandidates": candidate_details(
                                    poly_contracts
                                ),
                                "kalshiCandidates": candidate_details(
                                    kalshi_contracts
                                ),
                            }
                        )
                continue

            poly = poly_contracts[0]
            kalshi = kalshi_contracts[0]
            identity = (
                f"sports:{event_match.polymarket_group_key}:"
                f"{event_match.kalshi_group_key}"
            )
            contract_identity = f"winner:{poly_entity_id}:{kalshi_entity_id}"
            pairs.append(
                (
                    ExactContract(
                        **{
                            **poly.__dict__,
                            "event_identity": identity,
                            "contract_identity": contract_identity,
                            "event_match_method": event_match.match_method,
                        }
                    ),
                    ExactContract(
                        **{
                            **kalshi.__dict__,
                            "event_identity": identity,
                            "contract_identity": contract_identity,
                            "event_match_method": event_match.match_method,
                        }
                    ),
                )
            )

    return pairs, {
        "polymarketSportsContracts": poly_eligible,
        "kalshiSportsContracts": kalshi_eligible,
        "sportsDrawContractsSeparated": (
            polymarket_draws_separated + kalshi_draws_separated
        ),
        "polymarketDrawContractsSeparated": polymarket_draws_separated,
        "kalshiDrawContractsSeparated": kalshi_draws_separated,
        "sportsContractMatches": len(pairs),
        "ambiguousSportsContractIdentities": ambiguous_contracts,
        "kalshiGroupsUsingPrimaryEvents": kalshi_primary_groups,
        "kalshiPrimaryGroupsFallingBackToRelatedEvents": (
            kalshi_primary_fallback_groups
        ),
        "kalshiGroupsWithoutPrimaryEventMetadata": (
            kalshi_groups_without_primary_metadata
        ),
        "kalshiRelatedEventRowsExcluded": kalshi_related_event_rows_excluded,
        "ambiguousSportsContractSamples": ambiguous_samples,
    }


CLOSED_VENUE_STATUS_TERMS = {
    "closed",
    "settled",
    "resolved",
    "finalized",
    "finalised",
    "expired",
    "cancelled",
    "canceled",
}


def selected_mapping_text(
    value: Any,
    keys: Sequence[str],
) -> List[str]:
    mapping = as_json(value, dict, {})
    rows: List[str] = []

    for key in keys:
        child = mapping.get(key)

        if child in (None, "", [], {}):
            continue

        rows.extend(
            text
            for text in nested_strings(child)
            if text
        )

    return rows


def market_semantic_text(
    market: Market,
) -> str:
    """
    Text used to classify a contract's economic or weather proposition.

    Only settlement-relevant descriptive fields are included. Order-book,
    price, volume, and outcome arrays are intentionally excluded so their
    numbers cannot be mistaken for strikes or observation periods.
    """
    values: List[str] = [
        market.event.title,
        market.event_title,
        market.market_title,
        str(
            market.contract_semantics.get(
                "yes_sub_title"
            )
            or ""
        ),
        str(
            market.contract_semantics.get(
                "no_sub_title"
            )
            or ""
        ),
        str(
            market.contract_semantics.get(
                "subtitle"
            )
            or ""
        ),
    ]

    descriptive_keys = (
        "description",
        "rules",
        "rules_primary",
        "rules_secondary",
        "rulesPrimary",
        "rulesSecondary",
        "resolution_source",
        "resolutionSource",
        "question",
        "title",
        "subtitle",
    )

    values.extend(
        selected_mapping_text(
            market.raw,
            descriptive_keys,
        )
    )
    values.extend(
        selected_mapping_text(
            market.event.raw,
            descriptive_keys,
        )
    )
    values.extend(
        selected_mapping_text(
            market.event.details,
            descriptive_keys,
        )
    )

    return exact_text(
        " ".join(
            value
            for value in values
            if value
        )
    )


def market_contract_text(
    market: Market,
) -> str:
    return exact_text(
        " ".join(
            str(value)
            for value in (
                market.contract_semantics.get(
                    "yes_sub_title"
                ),
                market.contract_semantics.get(
                    "subtitle"
                ),
                market.market_title,
            )
            if value not in (None, "")
        )
    )


def market_title_semantic_text(
    market: Market,
) -> str:
    """
    Settlement-facing title text only.

    Raw rules are intentionally excluded here because they frequently mention
    neighboring releases, source-series names, or meeting dates that are not
    the proposition being traded. Those references were causing headline CPI,
    CPI components, Fed period-end levels, and Fed meeting contracts to collapse
    into the same event identity.
    """
    return exact_text(
        " ".join(
            str(value)
            for value in (
                market.event.title,
                market.event_title,
                market.market_title,
                market.contract_semantics.get("yes_sub_title"),
                market.contract_semantics.get("no_sub_title"),
                market.contract_semantics.get("subtitle"),
            )
            if value not in (None, "")
        )
    )


def market_is_open_for_exact_matching(
    market: Market,
    reference_time: Optional[datetime] = None,
) -> bool:
    """
    Exclude stale snapshot rows before semantic matching.

    A venue can leave an internally active row in the snapshot after the
    underlying contract has stopped accepting orders. Sports retains its
    separate live-window behavior; this guard is used by macro and weather.
    """
    now = reference_time or datetime.now(timezone.utc)

    status_text = exact_text(
        f"{market.venue_status or ''} "
        f"{market.event.venue_status or ''}"
    )
    status_words = set(status_text.split())

    if status_words & CLOSED_VENUE_STATUS_TERMS:
        return False

    if market.accepting_orders is False:
        return False

    effective_close = (
        market.close_time
        or market.event.close_time
    )

    if (
        effective_close is not None
        and effective_close <= now
    ):
        return False

    if (
        market.resolution_time is not None
        and market.resolution_time <= now
    ):
        return False

    return True


MONTHS = {
    "jan": 1,
    "january": 1,
    "feb": 2,
    "february": 2,
    "mar": 3,
    "march": 3,
    "apr": 4,
    "april": 4,
    "may": 5,
    "jun": 6,
    "june": 6,
    "jul": 7,
    "july": 7,
    "aug": 8,
    "august": 8,
    "sep": 9,
    "sept": 9,
    "september": 9,
    "oct": 10,
    "october": 10,
    "nov": 11,
    "november": 11,
    "dec": 12,
    "december": 12,
}

METRIC_PATTERNS: Sequence[Tuple[str, str]] = (
    (r"\bcore\s+(?:consumer price index|cpi)\b", "core-cpi"),
    (r"\b(?:consumer price index|cpi)\b", "cpi"),
    (r"\bcore\s+(?:pce|personal consumption expenditures)\b", "core-pce"),
    (r"\b(?:pce|personal consumption expenditures)\b", "pce"),
    (r"\bunemployment(?: rate)?\b", "unemployment"),
    (r"\b(?:nonfarm payrolls?|payrolls?|jobs report)\b", "payrolls"),

    # GDP variants must remain separate.
    (
        r"\bnominal\s+(?:gross domestic product|gdp)\b",
        "nominal-gdp",
    ),
    (
        r"\breal\s+(?:gross domestic product|gdp)\b",
        "real-gdp",
    ),
    (
        r"\b(?:gross domestic product|gdp)\b",
        "gdp-unspecified",
    ),

    (
        r"\bhow many\s+(?:federal reserve|fed|fomc)?\s*"
        r"(?:rate\s+)?cuts?\b|"
        r"\bnumber of\s+(?:fed|fomc)?\s*(?:rate\s+)?cuts?\b",
        "fed-cut-count",
    ),
    (
        r"\b(?:federal reserve|fed|fomc).*(?:rate|target)|"
        r"(?:fed funds|federal funds)\b",
        "fed-rate",
    ),
    (r"\brecession\b", "recession"),
    (r"\binflation\b", "inflation"),
    (r"\bretail sales\b", "retail-sales"),
    (r"\bjobless claims\b", "jobless-claims"),
    (r"\bconsumer sentiment\b", "consumer-sentiment"),
)

GEOGRAPHY_PATTERNS: Sequence[Tuple[str, str]] = (
    (r"(?:\bus\b|\bu[.\s]+s\b|\busa\b|\bunited states\b|\bamerican\b)", "us"),
    (r"(?:\buk\b|\bu[.\s]+k\b|\bunited kingdom\b|\bbritish\b|\bbritain\b|\bengland\b)", "uk"),
    (r"\bcanad(?:a|ian)\b", "canada"),
    (r"\bmexic(?:o|an)\b", "mexico"),
    (r"\bbrazil(?:ian)?\b", "brazil"),
    (r"\bindia(?:n)?\b", "india"),
    (r"\b(?:china|chinese)\b", "china"),
    (r"\bjapan(?:ese)?\b", "japan"),
    (r"\baustralia(?:n)?\b", "australia"),
    (r"\b(?:eurozone|euro area|european|ecb)\b", "eurozone"),
    (r"\b(?:france|french)\b", "france"),
    (r"\bgerman(?:y)?\b", "germany"),
)

KALSHI_US_MACRO_PREFIXES = (
    "KXCPI",
    "KXCPICORE",
    "KXPCE",
    "KXGDP",
    "KXU3",
    "KXUNEMP",
    "KXPAYROLL",
    "KXJOBS",
    "KXFED",
    "KXRATE",
    "KXRECESSION",
    "KXRETAIL",
    "KXJOBLESS",
    "KXSENTIMENT",
)

IMPLICIT_US_MACRO_METRICS = {
    "fed-rate",
    "fed-cut-count",
    "cpi",
    "core-cpi",
    "pce",
    "core-pce",
    "unemployment",
    "payrolls",
    "nominal-gdp",
    "real-gdp",
    "gdp-unspecified",
    "retail-sales",
    "jobless-claims",
    "consumer-sentiment",
}

SCHEDULED_MONTH_MACRO_METRICS = {
    "fed-rate",
    "cpi",
    "core-cpi",
    "pce",
    "core-pce",
    "unemployment",
    "payrolls",
    "retail-sales",
    "jobless-claims",
    "consumer-sentiment",
}


def macro_metric(text: str) -> Optional[str]:
    # Polymarket frequently labels headline CPI as "US Inflation - Annual"
    # without spelling out CPI in the visible title.
    if re.search(
        r"\b(?:annual|yearly)\s+(?:us\s+)?inflation\b|"
        r"\binflation\s+(?:us|u s)\s+(?:annual|yearly)\b",
        text,
    ):
        return "cpi"

    for pattern, metric in METRIC_PATTERNS:
        if re.search(pattern, text):
            return metric
    return None


CPI_COMPONENT_PATTERNS: Sequence[Tuple[str, str]] = (
    (r"\bairline fares?\b", "airline-fares"),
    (r"\b(?:dozen\s+)?eggs?\b", "eggs"),
    (r"\bgasoline\b", "gasoline"),
    (r"\bused cars?(?: and trucks?)?\b", "used-cars-and-trucks"),
    (r"\bnew vehicles?\b", "new-vehicles"),
    (r"\bmotor vehicle insurance\b", "motor-vehicle-insurance"),
    (r"\bowners? equivalent rent\b", "owners-equivalent-rent"),
    (r"\brent of primary residence\b", "rent-primary-residence"),
    (r"\bshelter\b", "shelter"),
    (r"\bfood away from home\b", "food-away-from-home"),
    (r"\bfood at home\b", "food-at-home"),
    (r"\bmedical care\b", "medical-care"),
    (r"\bapparel\b", "apparel"),
    (r"\btransportation services\b", "transportation-services"),
    (r"\benergy services\b", "energy-services"),
)


def macro_measure(
    market: Market,
    text: str,
    metric: str,
) -> Optional[str]:
    """
    Canonical release/series dimension.

    Metric alone is not enough for CPI. "Headline CPI", "airline fares CPI",
    and the price of eggs can all mention CPI in venue rules while resolving
    to entirely different numbers.
    """
    if metric == "core-cpi":
        return "all-items-less-food-and-energy"

    if metric == "cpi":
        for pattern, component in CPI_COMPONENT_PATTERNS:
            if re.search(pattern, text):
                return component

        ticker = market.external_market_id.upper()
        series = str(market.external_series_id or "").upper()

        if (
            ticker.startswith("KXCPI-")
            or series == "KXCPI"
            or re.search(
                r"\bheadline\s+cpi\b|"
                r"\bcpi\s+in\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)|"
                r"\b(?:annual|yearly)\s+(?:us\s+)?inflation\b|"
                r"\binflation\s+(?:us|u s)\s+(?:annual|yearly)\b|"
                r"\bconsumer price index for all urban consumers\s*:\s*all items\b",
                text,
            )
        ):
            return "headline"

        # Unknown CPI components stay out of executable matching rather than
        # being collapsed into headline CPI.
        return None

    if metric == "core-pce":
        return "core"
    if metric == "pce":
        return "headline"
    if metric == "unemployment":
        return "u3"
    if metric in {"real-gdp", "nominal-gdp", "gdp-unspecified"}:
        return "headline"
    if metric == "fed-rate":
        return "target-range"
    if metric == "fed-cut-count":
        return "target-range-cuts"
    return "headline"

def macro_geography(market: Market, text: str, metric: str) -> Optional[str]:
    for pattern, geography in GEOGRAPHY_PATTERNS:
        if re.search(pattern, text):
            return geography
    if metric in {"fed-rate", "fed-cut-count"}:
        return "us"
    if (
        market.venue == "kalshi"
        and market.external_market_id.upper().startswith(KALSHI_US_MACRO_PREFIXES)
    ):
        return "us"
    # These are venue-native U.S. series whose titles commonly omit the
    # country. Generic inflation/recession markets are intentionally excluded.
    if market.venue == "polymarket" and metric in IMPLICIT_US_MACRO_METRICS:
        return "us"
    return None


def macro_reference_time(market: Market) -> Optional[datetime]:
    """
    Reference date used only when a title supplies a month but omits a year.

    Polymarket event_start_time and event.start_time frequently contain market
    creation timestamps rather than economic release times, so they are not
    trusted for Polymarket macro contracts.
    """
    if market.venue == "polymarket":
        return (
            market.resolution_time
            or market.event.end_time
        )

    return (
        market.resolution_time
        or market.event.end_time
        or market.event_start_time
        or market.event.start_time
    )


def macro_scheduled_time(market: Market) -> Optional[datetime]:
    """
    Only use an explicit contract resolution/end time for macro scheduling.
    Never substitute a market creation timestamp.
    """
    return (
        market.resolution_time
        or market.event.end_time
    )


def macro_period(
    text: str,
    market: Optional[Market] = None,
    metric: Optional[str] = None,
) -> Optional[str]:
    quarter = re.search(
        r"\bq([1-4])\s*(20\d{2})\b|\b(20\d{2})\s*q([1-4])\b",
        text,
    )
    if quarter:
        number = quarter.group(1) or quarter.group(4)
        year = quarter.group(2) or quarter.group(3)
        return f"{year}-q{number}"

    month_names = "|".join(sorted(MONTHS, key=len, reverse=True))
    month = re.search(
        rf"\b({month_names})\s+(?:\d{{1,2}}(?:st|nd|rd|th)?\s+)?(20\d{{2}})\b",
        text,
    )
    if month:
        return f"{month.group(2)}-{MONTHS[month.group(1)]:02d}"

    iso_month = re.search(r"\b(20\d{2})[-/](0?[1-9]|1[0-2])\b", text)
    if iso_month:
        return f"{iso_month.group(1)}-{int(iso_month.group(2)):02d}"

    month_only = re.search(rf"\b({month_names})\b", text)
    reference = macro_reference_time(market) if market else None
    if month_only and reference:
        return f"{reference.year}-{MONTHS[month_only.group(1)]:02d}"

    years = sorted(set(re.findall(r"\b20\d{2}\b", text)))
    if len(years) == 1:
        return years[0]

    if reference and metric in SCHEDULED_MONTH_MACRO_METRICS:
        return f"{reference.year}-{reference.month:02d}"
    return None


def macro_scope(
    text: str,
    metric: str,
    market: Optional[Market] = None,
) -> Optional[str]:
    if re.search(
        r"\b(combo|combination|parlay|scenario|economic path)\b|"
        r"\band\s+will\b|"
        r"\bconfirmed\b[^.?!]{0,80}\band\b",
        text,
    ):
        return None

    if metric == "fed-cut-count":
        return "calendar-period-count"

    if metric == "fed-rate":
        month_names = "|".join(
            sorted(MONTHS, key=len, reverse=True)
        )

        # Most specific scopes must be evaluated before the generic word
        # "meeting". Otherwise raw references to an FOMC meeting turn
        # end-of-year levels and "hit before 2027" contracts into meeting
        # decisions.
        if re.search(
            r"\b(?:at|by)\s+(?:the\s+)?end\b|"
            r"\bend of\s+20\d{2}\b",
            text,
        ):
            return "level-at-period-end"

        if re.search(
            r"\b(?:hit|reach|reaches|reached)\b"
            r"[^.?!]{0,64}"
            r"\b(?:before|by|during|in)\b",
            text,
        ):
            return "level-reached-by-deadline"

        cumulative_pattern = (
            rf"\bby\s+(?:the\s+)?"
            rf"(?:{month_names}|20\d{{2}}|next)\b"
            rf"[^.?!]{{0,32}}\bmeeting\b"
        )
        if re.search(cumulative_pattern, text):
            return "cumulative-by-meeting"

        if re.search(
            r"\b(?:hike|raise|increase|cut|lower|decrease)\b"
            r"[^.?!]{0,48}"
            r"\b(?:by|before|during|in)\b",
            text,
        ) and not re.search(
            r"\b(?:after|following|at|during)\b"
            r"[^.?!]{0,40}\bmeeting\b",
            text,
        ):
            return "action-by-deadline"

        if re.search(
            r"\b(?:upper|lower)\s+bound\b|"
            r"\btarget\s+(?:federal funds|fed funds)\s+rate\b",
            text,
        ) and re.search(
            r"\b(?:after|following|at|during)\b"
            r"[^.?!]{0,48}\bmeeting\b|"
            r"\bmeeting\b[^.?!]{0,48}\b(?:after|following)\b",
            text,
        ):
            return "meeting-level"

        if re.search(
            r"\bdecision\b|"
            r"\b(?:cut|hike|hold|unchanged|no change)\b"
            r"[^.?!]{0,48}\bmeeting\b|"
            r"\bfomc\b",
            text,
        ):
            return "meeting-decision"

        return None

    if metric in {
        "cpi",
        "core-cpi",
        "pce",
        "core-pce",
        "inflation",
    }:
        ticker = market.external_market_id.upper() if market else ""
        series = str(market.external_series_id or "").upper() if market else ""

        if re.search(
            r"\b(month over month|month on month|mom)\b",
            text,
        ):
            return "mom-release"

        if re.search(
            r"\b(year over year|year on year|yoy|annual inflation|annual rate)\b|"
            r"\b(?:annual|yearly)\s+(?:us\s+)?inflation\b",
            text,
        ):
            return "yoy-release"

        if ticker.startswith("KXCPICOREYOY") or series == "KXCPICOREYOY":
            return "yoy-release"

        if ticker.startswith("KXCPI-") or series == "KXCPI":
            return "mom-release"

        if re.search(
            r"\bconsumer price index\b",
            text,
        ) and "%" not in text:
            return "index-level-release"

        return "release"

    if metric in {
        "nominal-gdp",
        "real-gdp",
        "gdp-unspecified",
    }:
        if "annualized" in text or "annualised" in text:
            return "annualized-growth"

        if re.search(
            r"\b(year over year|year on year|yoy)\b",
            text,
        ):
            return "yoy-growth"

        if re.search(
            r"\b(quarter over quarter|quarter on quarter|qoq)\b",
            text,
        ):
            return "qoq-growth"

        return "growth"

    if metric == "unemployment":
        return "release-rate"

    if metric in {
        "payrolls",
        "retail-sales",
        "jobless-claims",
        "consumer-sentiment",
    }:
        return "release"

    if metric == "recession":
        return "occurrence"

    return None

def title_numbers(text: str) -> List[str]:
    values = []

    for match in re.finditer(
        r"(?<![a-z0-9])"
        r"(-?\d+(?:\.\d+)?)"
        r"\s*(\+)?\s*"
        r"(%|bps?|basis points?)?",
        text,
    ):
        raw = match.group(1)
        unit = match.group(3) or ""

        if re.fullmatch(r"20\d{2}", raw) and not unit:
            continue

        number = decimal_text(raw)
        if number is None:
            continue

        suffix = (
            "bps"
            if "bp" in unit or "basis" in unit
            else ""
        )
        values.append(f"{number}{suffix}")

    return values

def direction_contract_comparator(text: str) -> str:
    if re.search(
        r"(?:>=|\bat least\b|\bor more\b|\bno less than\b|"
        r"\d+(?:\.\d+)?\s*\+\s*(?:bps?|basis points?))",
        text,
    ):
        return "gte"

    if re.search(
        r"(?:<=|\bat most\b|\bor less\b|\bno more than\b)",
        text,
    ):
        return "lte"

    if re.search(
        r"(?:>|\bmore than\b|\bgreater than\b|\babove\b)",
        text,
    ):
        return "gt"

    if re.search(
        r"(?:<|\bless than\b|\bbelow\b|\bunder\b)",
        text,
    ):
        return "lt"

    return "eq"


def structured_contract_identity(market: Market) -> Optional[str]:
    function = exact_code(market.functional_strike)
    floor = decimal_text(market.floor_strike)
    cap = decimal_text(market.cap_strike)
    line = decimal_text(market.line_value)
    title = exact_text(market.market_title)

    greater = {"greater", "greater_than", "above", "more_than", "gt"}
    greater_equal = {"greater_equal", "greater_than_or_equal", "at_least", "gte"}
    less = {"less", "less_than", "below", "under", "lt"}
    less_equal = {"less_equal", "less_than_or_equal", "at_most", "lte"}
    ranges = {"between", "range", "bounded"}

    if function in greater and (floor or line):
        return f"threshold|gt|{floor or line}"
    if function in greater_equal and (floor or line):
        return f"threshold|gte|{floor or line}"
    if function in less and (cap or line):
        return f"threshold|lt|{cap or line}"
    if function in less_equal and (cap or line):
        return f"threshold|lte|{cap or line}"
    if function in ranges and floor and cap:
        return f"threshold|range|{floor}|{cap}"

    # Kalshi commonly supplies floor/cap values without functional_strike.
    # Infer the comparator from the actual market title before consulting
    # subtitles, which can describe a display bucket rather than the binary
    # proposition.
    if floor is not None and cap is not None:
        if re.search(r"\b(?:between|from)\b|\bto\b", title):
            return f"threshold|range|{floor}|{cap}"

    if floor is not None:
        if re.search(
            r"\b(?:at least|or more|no less than|or above)\b|>=",
            title,
        ):
            return f"threshold|gte|{floor}"
        if re.search(
            r"\b(?:above|over|more than|greater than|exceed|exceeds)\b|>",
            title,
        ):
            return f"threshold|gt|{floor}"

    if cap is not None:
        if re.search(
            r"\b(?:at most|or less|no more than|or below)\b|<=",
            title,
        ):
            return f"threshold|lte|{cap}"
        if re.search(
            r"\b(?:below|under|less than)\b|<",
            title,
        ):
            return f"threshold|lt|{cap}"

    return None


def title_contract_identity(text: str) -> Optional[str]:
    numbers = title_numbers(text)

    # Explicit bounded ranges. This also handles subtitles such as
    # "0.1% to 0.5%" where neither "between" nor "from" is present.
    numeric_range = re.search(
        r"(?<![a-z0-9])"
        r"(-?\d+(?:\.\d+)?)\s*"
        r"(?:%|bps?|basis points?)?\s*"
        r"(?:to|through|and|&|-)\s*"
        r"(-?\d+(?:\.\d+)?)\s*"
        r"(?:%|bps?|basis points?)?",
        text,
    )

    if numeric_range:
        lower = decimal_text(
            numeric_range.group(1)
        )
        upper = decimal_text(
            numeric_range.group(2)
        )

        if lower is not None and upper is not None:
            return (
                f"threshold|range|{lower}|{upper}"
            )

    # No change is its own economic result. Do not normalize Kalshi's
    # "hike by 0bps" into hold until its settlement language is verified.
    if re.search(
        r"\b(no change|unchanged|hold|holds|maintain|maintains)\b",
        text,
    ):
        return "direction|hold|eq|0bps"

    direction_patterns = (
        (
            r"\b(?:cut|cuts|cutting|decrease|decreases|decreased)\b|"
            r"\blower(?:s|ed|ing)?\s+(?:rates?|target)\b",
            "cut",
        ),
        (
            r"\b(?:hike|hikes|hiking|raise|raises|raised|"
            r"increase|increases|increased)\b",
            "hike",
        ),
    )

    for pattern, direction in direction_patterns:
        if not re.search(pattern, text):
            continue

        # A direction magnitude is valid only when tied to basis points.
        # Calendar dates such as "December 31" must never become a 31bp
        # rate move.
        forward = re.search(
            rf"(?:{pattern})"
            r"[^.?!]{0,32}?"
            r"([<>]=?)?\s*"
            r"(-?\d+(?:\.\d+)?)\s*"
            r"(?:bps?|basis points?)\b",
            text,
        )
        reverse = re.search(
            r"([<>]=?)?\s*"
            r"(-?\d+(?:\.\d+)?)\s*"
            r"(?:bps?|basis points?)"
            r"[^.?!]{0,16}?"
            rf"(?:{pattern})",
            text,
        )
        magnitude_match = (
            forward
            or reverse
        )

        if not magnitude_match:
            return (
                f"direction|{direction}|"
                "unspecified"
            )

        operator = (
            magnitude_match.group(1)
            or ""
        )
        magnitude = decimal_text(
            magnitude_match.group(2)
        )

        if magnitude is None:
            return None

        if operator == ">":
            comparator = "gt"
        elif operator == ">=":
            comparator = "gte"
        elif operator == "<":
            comparator = "lt"
        elif operator == "<=":
            comparator = "lte"
        else:
            comparator = (
                direction_contract_comparator(
                    magnitude_match.group(0)
                )
            )

        return (
            f"direction|{direction}|"
            f"{comparator}|{magnitude}bps"
        )

    comparators = (
        (
            r"\b(at least|or higher|or more|no less than|"
            r"or above)\b|>=",
            "gte",
            1,
        ),
        (
            r"\b(at most|or lower|or less|no more than|"
            r"or below)\b|<=",
            "lte",
            1,
        ),
        (
            r"\b(above|over|more than|greater than|exceed|exceeds)\b|>",
            "gt",
            1,
        ),
        (
            r"\b(below|under|less than)\b|<",
            "lt",
            1,
        ),
        (
            r"\b(between|from)\b",
            "range",
            2,
        ),
        (
            r"\b(exactly|equal to|equals)\b",
            "eq",
            1,
        ),
    )

    for pattern, comparator, required in comparators:
        if re.search(pattern, text) and len(numbers) >= required:
            return (
                f"threshold|{comparator}|"
                f"{'|'.join(numbers[:required])}"
            )

    # Mutually exclusive bucket labels frequently omit "exactly", e.g.
    # "Will the upper bound ... be 3.25%?" A single percentage/bps value
    # after the verb "be" is an exact level, not a date or deadline.
    if (
        len(numbers) == 1
        and re.search(
            r"\bbe\s+(?:at\s+)?"
            r"-?\d+(?:\.\d+)?\s*(?:%|bps?|basis points?)",
            text,
        )
    ):
        return f"threshold|eq|{numbers[0]}"

    return None


def macro_count_contract_identity(
    text: str,
) -> Optional[str]:
    if re.search(
        r"\b(?:no|zero)\s+(?:fed\s+)?"
        r"(?:rate\s+)?cuts?\b",
        text,
    ):
        return "threshold|eq|0"

    match = re.search(
        r"\b(\d+)\s+"
        r"(?:or\s+more\s+)?"
        r"(?:fed\s+)?(?:rate\s+)?cuts?\b",
        text,
    )

    if not match:
        return None

    value = decimal_text(
        match.group(1)
    )

    if value is None:
        return None

    comparator = (
        "gte"
        if re.search(
            r"\b\d+\s+or\s+more\b",
            text,
        )
        else "eq"
    )

    return (
        f"threshold|{comparator}|{value}"
    )


def complementary_contract_identity(
    contract_identity: str,
) -> Optional[str]:
    parts = contract_identity.split("|")

    if len(parts) != 3 or parts[0] != "threshold":
        return None

    inverse = {
        "gt": "lte",
        "lte": "gt",
        "gte": "lt",
        "lt": "gte",
    }

    complement_comparator = inverse.get(parts[1])
    if not complement_comparator:
        return None

    return (
        f"threshold|{complement_comparator}|"
        f"{parts[2]}"
    )



def macro_action_deadline_period(
    text: str,
    market: Market,
) -> Optional[str]:
    normalized_window = calendar_resolution_window(text)
    if (
        normalized_window
        and normalized_window.startswith("deadline-")
    ):
        return normalized_window

    month_names = "|".join(
        sorted(
            MONTHS,
            key=len,
            reverse=True,
        )
    )

    explicit_date = re.search(
        rf"\b({month_names})\s+"
        r"(\d{1,2})(?:st|nd|rd|th)?"
        r"\s*,?\s*(20\d{2})\b",
        text,
    )

    if explicit_date:
        return (
            "deadline-"
            f"{explicit_date.group(3)}-"
            f"{MONTHS[explicit_date.group(1)]:02d}-"
            f"{int(explicit_date.group(2)):02d}"
        )

    before_year = re.search(
        r"\bbefore\s+(20\d{2})\b",
        text,
    )

    if before_year:
        return (
            "deadline-"
            f"{int(before_year.group(1)) - 1}"
            "-12-31"
        )

    years = sorted(
        set(
            re.findall(
                r"\b20\d{2}\b",
                text,
            )
        )
    )

    if len(years) == 1:
        return (
            f"deadline-{years[0]}-12-31"
        )

    reference = macro_reference_time(
        market
    )

    if reference:
        return (
            "deadline-"
            f"{reference.year}-12-31"
        )

    return None

def macro_contract_result(
    market: Market,
) -> Tuple[Optional[ExactContract], Optional[str]]:
    title_text = market_title_semantic_text(
        market
    )
    full_text = market_semantic_text(
        market
    )

    metric = macro_metric(
        title_text
    )
    if not metric:
        metric = macro_metric(
            full_text
        )

    if not metric:
        return None, None

    if not market_is_open_for_exact_matching(
        market
    ):
        return None, "notOpen"

    binary = yes_no_outcomes(market)
    if not binary:
        return None, "nonBinary"

    measure = macro_measure(
        market,
        title_text,
        metric,
    )
    geography = macro_geography(
        market,
        title_text,
        metric,
    )
    scope = macro_scope(
        title_text,
        metric,
        market,
    )

    if (
        metric in {
            "nominal-gdp",
            "real-gdp",
            "gdp-unspecified",
        }
        and scope == "growth"
        and (
            "annualized" in full_text
            or "annualised" in full_text
            or market.external_market_id.upper().startswith("KXGDP")
        )
    ):
        scope = "annualized-growth"

    period = macro_period(
        title_text,
        market,
        metric,
    )

    if scope in {
        "action-by-deadline",
        "level-reached-by-deadline",
    }:
        period = (
            macro_action_deadline_period(
                title_text,
                market,
            )
            or period
        )

    contract_text = market_contract_text(
        market
    )
    contract_identity = (
        structured_contract_identity(
            market
        )
    )

    if (
        not contract_identity
        and metric == "fed-cut-count"
    ):
        contract_identity = (
            macro_count_contract_identity(
                contract_text
            )
        )

    if not contract_identity:
        contract_identity = (
            title_contract_identity(
                contract_text
            )
        )

    if not measure:
        return None, "missingMeasure"
    if not geography:
        return None, "missingGeography"
    if not period:
        return None, "missingPeriod"
    if not scope:
        return None, "missingScope"
    if not contract_identity:
        return None, "missingContractIdentity"

    yes, no = binary
    event_identity = (
        f"macro|{geography}|{metric}|{measure}|"
        f"{period}|{scope}"
    )
    return ExactContract(
        market.id,
        market.venue,
        event_identity,
        contract_identity,
        "macro",
        market.event.title,
        market.market_title,
        iso_value(macro_scheduled_time(market)),
        yes["key"],
        no["key"],
        yes["label"],
        no["label"],
        "exact_macro_dimensions_v15",
    ), None


def macro_contract(market: Market) -> Optional[ExactContract]:
    contract, _ = macro_contract_result(market)
    return contract


def parse_threshold_contract_identity(
    contract_identity: str,
) -> Optional[Tuple[str, Tuple[str, ...]]]:
    parts = contract_identity.split("|")
    if len(parts) < 3 or parts[0] != "threshold":
        return None
    return parts[1], tuple(parts[2:])


def decimal_regex(value: str) -> str:
    normalized = decimal_text(value)
    if normalized is None:
        return re.escape(str(value))
    if "." in normalized:
        whole, fraction = normalized.split(".", 1)
        return rf"{re.escape(whole)}\.{re.escape(fraction)}0*"
    return rf"{re.escape(normalized)}(?:\.0+)?"


def polymarket_range_boundary_verification(
    market: Market,
    lower_bound: str,
    upper_bound: str,
) -> Tuple[bool, str]:
    """
    Verify that the Polymarket range is exactly (lower, upper].

    A pair of Kalshi contracts X > lower and X > upper can synthesize only
    this boundary convention. A title that merely says "between" is not enough
    because endpoint treatment can change the payoff at the boundary.
    """
    if market.external_market_id in VERIFIED_SYNTHETIC_MACRO_RANGE_MARKETS:
        return True, "manual-market-rule-verification"

    text = market_semantic_text(market)
    # Preserve Unicode comparison symbols that exact_text otherwise removes.
    operator_text = " ".join(
        [
            market.market_title,
            *selected_mapping_text(
                market.raw,
                (
                    "description",
                    "rules",
                    "rules_primary",
                    "rules_secondary",
                    "rulesPrimary",
                    "rulesSecondary",
                ),
            ),
            *selected_mapping_text(
                market.event.raw,
                (
                    "description",
                    "rules",
                    "rules_primary",
                    "rules_secondary",
                    "rulesPrimary",
                    "rulesSecondary",
                ),
            ),
        ]
    )
    operator_text = exact_text(
        operator_text.replace("≤", " <= ").replace("≥", " >= ")
    )
    text = f"{text} {operator_text}"
    lower = decimal_regex(lower_bound)
    upper = decimal_regex(upper_bound)

    symbolic_patterns = (
        rf"{lower}\s*<\s*[a-z0-9 _%.-]{{0,48}}\s*<=\s*{upper}",
        rf"{upper}\s*>=\s*[a-z0-9 _%.-]{{0,48}}\s*>\s*{lower}",
    )
    prose_patterns = (
        rf"(?:greater than|more than|above)\s*{lower}"
        rf"[^.?!]{{0,120}}"
        rf"(?:less than or equal to|at most|no more than)\s*{upper}",
        rf"(?:greater than|more than|above)\s*{lower}"
        rf"[^.?!]{{0,120}}"
        rf"{upper}\s*(?:or less|or below)",
        rf"{lower}\s*(?:exclusive|not included)"
        rf"[^.?!]{{0,120}}"
        rf"{upper}\s*(?:inclusive|included)",
    )

    if any(re.search(pattern, text) for pattern in symbolic_patterns):
        return True, "explicit-symbolic-gt-lte-boundaries"
    if any(re.search(pattern, text) for pattern in prose_patterns):
        return True, "explicit-prose-gt-lte-boundaries"

    return False, "range-boundary-inclusivity-not-explicit"


def synthetic_macro_schedule_aligned(
    contracts: Sequence[ExactContract],
) -> bool:
    times = [
        parse_datetime(contract.scheduled_time)
        for contract in contracts
    ]
    if any(value is None for value in times):
        return False
    timestamps = [value.timestamp() for value in times if value is not None]
    return (
        max(timestamps) - min(timestamps)
        <= SYNTHETIC_MACRO_MAX_SCHEDULE_DIFFERENCE_SECONDS
    )


def build_macro_synthetic_candidates(
    markets: Dict[int, Market],
) -> Tuple[List[SyntheticMacroCandidate], Dict[str, Any]]:
    contracts: List[ExactContract] = []
    for market in markets.values():
        contract, _ = macro_contract_result(market)
        if contract:
            contracts.append(contract)

    by_event: Dict[str, Dict[str, List[ExactContract]]] = defaultdict(
        lambda: defaultdict(list)
    )
    for contract in contracts:
        by_event[contract.event_identity][contract.venue].append(contract)

    verified: List[SyntheticMacroCandidate] = []
    potential_count = 0
    rejected_boundary = 0
    rejected_schedule = 0
    rejected_ambiguous = 0
    rejected_different_kalshi_events = 0
    samples: List[Dict[str, Any]] = []

    for event_identity, venues in by_event.items():
        polymarket_contracts = venues.get("polymarket", [])
        kalshi_contracts = venues.get("kalshi", [])
        if not polymarket_contracts or not kalshi_contracts:
            continue

        kalshi_gt: Dict[str, List[ExactContract]] = defaultdict(list)
        for contract in kalshi_contracts:
            parsed = parse_threshold_contract_identity(
                contract.contract_identity
            )
            if not parsed:
                continue
            comparator, values = parsed
            if comparator == "gt" and len(values) == 1:
                kalshi_gt[values[0]].append(contract)

        for poly_contract in polymarket_contracts:
            parsed = parse_threshold_contract_identity(
                poly_contract.contract_identity
            )
            if not parsed:
                continue
            comparator, values = parsed
            if comparator != "range" or len(values) != 2:
                continue

            lower_bound, upper_bound = values
            try:
                lower_number = Decimal(lower_bound)
                upper_number = Decimal(upper_bound)
            except InvalidOperation:
                continue
            if lower_number >= upper_number:
                continue

            lower_rows = kalshi_gt.get(lower_bound, [])
            upper_rows = kalshi_gt.get(upper_bound, [])
            if not lower_rows or not upper_rows:
                continue

            potential_count += 1
            compatible_pairs = []
            for lower_contract in lower_rows:
                lower_market = markets[lower_contract.market_id]
                for upper_contract in upper_rows:
                    upper_market = markets[upper_contract.market_id]
                    if (
                        lower_market.external_event_id
                        != upper_market.external_event_id
                    ):
                        continue
                    compatible_pairs.append(
                        (lower_contract, upper_contract)
                    )

            if not compatible_pairs:
                rejected_different_kalshi_events += 1
                continue
            if len(compatible_pairs) != 1:
                rejected_ambiguous += 1
                continue

            lower_contract, upper_contract = compatible_pairs[0]
            aligned = synthetic_macro_schedule_aligned(
                (
                    poly_contract,
                    lower_contract,
                    upper_contract,
                )
            )
            if not aligned:
                rejected_schedule += 1
                continue

            poly_market = markets[poly_contract.market_id]
            boundary_verified, verification_method = (
                polymarket_range_boundary_verification(
                    poly_market,
                    lower_bound,
                    upper_bound,
                )
            )

            sample = {
                "eventIdentity": event_identity,
                "contractIdentity": poly_contract.contract_identity,
                "lowerBound": lower_bound,
                "upperBound": upper_bound,
                "boundaryVerified": boundary_verified,
                "verificationMethod": verification_method,
                "polymarketMarketId": poly_market.external_market_id,
                "polymarketTitle": poly_market.market_title,
                "kalshiLowerMarketId": markets[
                    lower_contract.market_id
                ].external_market_id,
                "kalshiUpperMarketId": markets[
                    upper_contract.market_id
                ].external_market_id,
            }
            if len(samples) < 20:
                samples.append(sample)

            if not boundary_verified:
                rejected_boundary += 1
                continue

            verified.append(
                SyntheticMacroCandidate(
                    event_identity=event_identity,
                    contract_identity=(
                        f"synthetic-range|gt|{lower_bound}|lte|{upper_bound}"
                    ),
                    polymarket_contract=poly_contract,
                    lower_kalshi_contract=lower_contract,
                    upper_kalshi_contract=upper_contract,
                    lower_bound=lower_bound,
                    upper_bound=upper_bound,
                    boundary_mode="gt-lower-lte-upper",
                    verification_method=verification_method,
                )
            )

    return verified, {
        "macroSyntheticRangePotentialCandidates": potential_count,
        "macroSyntheticRangeVerifiedCandidates": len(verified),
        "macroSyntheticRangeRejectedUnverifiedBoundary": rejected_boundary,
        "macroSyntheticRangeRejectedScheduleMismatch": rejected_schedule,
        "macroSyntheticRangeRejectedAmbiguousLadder": rejected_ambiguous,
        "macroSyntheticRangeRejectedDifferentKalshiEvents": (
            rejected_different_kalshi_events
        ),
        "macroSyntheticRangeCandidateSamples": samples,
    }


def safe_macro_complement_pair(
    polymarket_contract: ExactContract,
    kalshi_contract: ExactContract,
) -> bool:
    """
    Auto-verify only release families whose opposite threshold comparators are
    exact logical complements and whose scheduled releases line up.

    Fed level, deadline, and bucket-ladder contracts remain diagnostic-only;
    those need separate synthetic multi-leg pricing.
    """
    if polymarket_contract.event_identity != kalshi_contract.event_identity:
        return False

    parts = polymarket_contract.event_identity.split("|")
    if len(parts) != 6 or parts[0] != "macro":
        return False

    _, geography, metric, measure, period, scope = parts

    safe_families = {
        (
            "us",
            "core-cpi",
            "all-items-less-food-and-energy",
            "yoy-release",
        ),
        (
            "us",
            "unemployment",
            "u3",
            "release-rate",
        ),
    }

    if (
        geography,
        metric,
        measure,
        scope,
    ) not in safe_families:
        return False

    poly_time = parse_datetime(
        polymarket_contract.scheduled_time
    )
    kalshi_time = parse_datetime(
        kalshi_contract.scheduled_time
    )

    if not poly_time or not kalshi_time:
        return False

    return abs(
        (
            poly_time
            - kalshi_time
        ).total_seconds()
    ) <= 36 * 60 * 60


def build_macro_contract_pairs(
        markets: Dict[int, Market],
) -> Tuple[
    List[Tuple[ExactContract, ExactContract]],
    Dict[str, Any],
]:
    contracts: List[ExactContract] = []
    rejection_counts = Counter()
    rejection_samples: Dict[
        str,
        List[Dict[str, Any]],
    ] = defaultdict(list)

    for market in markets.values():
        contract, rejection = macro_contract_result(market)

        if contract:
            contracts.append(contract)
            continue

        if rejection:
            rejection_counts[rejection] += 1

            if len(rejection_samples[rejection]) < 5:
                rejection_samples[rejection].append(
                    {
                        "venue": market.venue,
                        "marketId": market.external_market_id,
                        "eventTitle": market.event.title,
                        "marketTitle": market.market_title,
                        "functionalStrike": market.functional_strike,
                        "floorStrike": market.floor_strike,
                        "capStrike": market.cap_strike,
                        "lineValue": market.line_value,
                    }
                )

    def with_relationship(
            contract: ExactContract,
            relationship: str,
    ) -> ExactContract:
        return ExactContract(
            **{
                **contract.__dict__,
                "pair_relationship": relationship,
            }
        )

    def contract_details(
            contract: ExactContract,
    ) -> Dict[str, Any]:
        market = markets[contract.market_id]

        return {
            "venue": contract.venue,
            "marketId": market.external_market_id,
            "eventTitle": market.event.title,
            "marketTitle": market.market_title,
            "eventIdentity": contract.event_identity,
            "contractIdentity": contract.contract_identity,
            "relationship": contract.pair_relationship,
            "functionalStrike": market.functional_strike,
            "floorStrike": market.floor_strike,
            "capStrike": market.cap_strike,
            "lineValue": market.line_value,
            "scheduledTime": contract.scheduled_time,
        }

    indexed: Dict[
        Tuple[str, str],
        Dict[str, List[ExactContract]],
    ] = defaultdict(lambda: defaultdict(list))

    by_event: Dict[
        str,
        Dict[str, List[ExactContract]],
    ] = defaultdict(lambda: defaultdict(list))

    for contract in contracts:
        indexed[
            (
                contract.event_identity,
                contract.contract_identity,
            )
        ][contract.venue].append(contract)

        by_event[
            contract.event_identity
        ][contract.venue].append(contract)

    direct_pairs: List[
        Tuple[ExactContract, ExactContract]
    ] = []

    verified_complement_pairs: List[
        Tuple[ExactContract, ExactContract]
    ] = []

    used_polymarket_market_ids: Set[int] = set()
    used_kalshi_market_ids: Set[int] = set()

    ambiguous = 0
    direct_samples: List[Dict[str, Any]] = []
    ambiguous_samples: List[Dict[str, Any]] = []

    for (
            event_identity,
            contract_identity,
    ), venues in indexed.items():
        poly = venues.get("polymarket", [])
        kalshi = venues.get("kalshi", [])

        if not poly or not kalshi:
            continue

        if len(poly) == 1 and len(kalshi) == 1:
            poly_contract = with_relationship(
                poly[0],
                "direct",
            )
            kalshi_contract = with_relationship(
                kalshi[0],
                "direct",
            )

            direct_pairs.append(
                (
                    poly_contract,
                    kalshi_contract,
                )
            )

            used_polymarket_market_ids.add(
                poly_contract.market_id
            )
            used_kalshi_market_ids.add(
                kalshi_contract.market_id
            )

            if len(direct_samples) < 10:
                direct_samples.append(
                    {
                        "eventIdentity": event_identity,
                        "contractIdentity": contract_identity,
                        "relationship": "direct",
                        "sideMapping": "YES ↔ YES",
                        "polymarket": contract_details(
                            with_relationship(
                                poly_contract,
                                "direct",
                            )
                        ),
                        "kalshi": contract_details(
                            with_relationship(
                                kalshi_contract,
                                "direct",
                            )
                        ),
                    }
                )

            continue

        ambiguous += 1

        if len(ambiguous_samples) < 10:
            ambiguous_samples.append(
                {
                    "eventIdentity": event_identity,
                    "contractIdentity": contract_identity,
                    "polymarket": [
                        contract_details(row)
                        for row in poly
                    ],
                    "kalshi": [
                        contract_details(row)
                        for row in kalshi
                    ],
                }
            )

    complement_candidate_samples: List[
        Dict[str, Any]
    ] = []

    complement_candidate_count = 0

    for event_identity, venues in by_event.items():
        poly_contracts = venues.get(
            "polymarket",
            [],
        )
        kalshi_contracts = venues.get(
            "kalshi",
            [],
        )

        if not poly_contracts or not kalshi_contracts:
            continue

        poly_by_identity: Dict[
            str,
            List[ExactContract],
        ] = defaultdict(list)

        kalshi_by_identity: Dict[
            str,
            List[ExactContract],
        ] = defaultdict(list)

        for contract in poly_contracts:
            poly_by_identity[
                contract.contract_identity
            ].append(contract)

        for contract in kalshi_contracts:
            kalshi_by_identity[
                contract.contract_identity
            ].append(contract)

        for (
                polymarket_identity,
                poly_rows,
        ) in poly_by_identity.items():
            kalshi_identity = (
                complementary_contract_identity(
                    polymarket_identity
                )
            )

            if not kalshi_identity:
                continue

            kalshi_rows = kalshi_by_identity.get(
                kalshi_identity,
                [],
            )

            if (
                    len(poly_rows) != 1
                    or len(kalshi_rows) != 1
            ):
                continue

            poly_contract = poly_rows[0]
            kalshi_contract = kalshi_rows[0]

            # A directly paired contract must not also be reused as a
            # complement contract.
            if (
                    poly_contract.market_id
                    in used_polymarket_market_ids
                    or kalshi_contract.market_id
                    in used_kalshi_market_ids
            ):
                continue

            complement_candidate_count += 1

            poly_market = markets[
                poly_contract.market_id
            ]
            kalshi_market = markets[
                kalshi_contract.market_id
            ]

            external_pair = (
                poly_market.external_market_id,
                kalshi_market.external_market_id,
            )

            verified = (
                    external_pair
                    in VERIFIED_MACRO_COMPLEMENT_PAIRS
                    or safe_macro_complement_pair(
                        poly_contract,
                        kalshi_contract,
                    )
            )

            if len(complement_candidate_samples) < 10:
                complement_candidate_samples.append(
                    {
                        "eventIdentity": event_identity,
                        "relationship": "complement",
                        "sideMapping": "YES ↔ NO",
                        "verifiedForExecutablePricing": verified,
                        "polymarketIdentity": (
                            polymarket_identity
                        ),
                        "kalshiIdentity": kalshi_identity,
                        "polymarket": contract_details(
                            poly_contract
                        ),
                        "kalshi": contract_details(
                            kalshi_contract
                        ),
                    }
                )

            if not verified:
                continue

            verified_poly = with_relationship(
                poly_contract,
                "complement",
            )
            verified_kalshi = with_relationship(
                kalshi_contract,
                "complement",
            )

            verified_complement_pairs.append(
                (
                    verified_poly,
                    verified_kalshi,
                )
            )

            used_polymarket_market_ids.add(
                verified_poly.market_id
            )
            used_kalshi_market_ids.add(
                verified_kalshi.market_id
            )

    comparable_event_samples: List[
        Dict[str, Any]
    ] = []

    cross_venue_event_identities = 0

    for event_identity, venues in by_event.items():
        poly = venues.get("polymarket", [])
        kalshi = venues.get("kalshi", [])

        if not poly or not kalshi:
            continue

        cross_venue_event_identities += 1

        poly_identities = sorted(
            {
                row.contract_identity
                for row in poly
            }
        )
        kalshi_identities = sorted(
            {
                row.contract_identity
                for row in kalshi
            }
        )

        if len(comparable_event_samples) < 12:
            comparable_event_samples.append(
                {
                    "eventIdentity": event_identity,
                    "sharedContractIdentities": sorted(
                        set(poly_identities)
                        & set(kalshi_identities)
                    ),
                    "polymarketContractIdentities": (
                        poly_identities
                    ),
                    "kalshiContractIdentities": (
                        kalshi_identities
                    ),
                    "polymarketSamples": [
                        contract_details(row)
                        for row in poly[:5]
                    ],
                    "kalshiSamples": [
                        contract_details(row)
                        for row in kalshi[:5]
                    ],
                }
            )

    metric_counts: Dict[str, Counter] = {
        "polymarket": Counter(),
        "kalshi": Counter(),
    }

    for contract in contracts:
        parts = contract.event_identity.split("|")
        metric = (
            parts[2]
            if len(parts) > 2
            else "unknown"
        )
        metric_counts[contract.venue][metric] += 1

    pairs = [
        *direct_pairs,
        *verified_complement_pairs,
    ]

    return pairs, {
        "polymarketMacroContracts": sum(
            contract.venue == "polymarket"
            for contract in contracts
        ),
        "kalshiMacroContracts": sum(
            contract.venue == "kalshi"
            for contract in contracts
        ),
        "macroContractMatches": len(pairs),
        "macroDirectContractMatches": len(
            direct_pairs
        ),
        "macroVerifiedComplementMatches": len(
            verified_complement_pairs
        ),
        "macroComplementCandidates": (
            complement_candidate_count
        ),
        "ambiguousMacroContractIdentities": (
            ambiguous
        ),
        "macroRejectedNotOpen": (
            rejection_counts["notOpen"]
        ),
        "macroRejectedNonBinary": (
            rejection_counts["nonBinary"]
        ),
        "macroRejectedMissingMeasure": (
            rejection_counts["missingMeasure"]
        ),
        "macroRejectedMissingGeography": (
            rejection_counts["missingGeography"]
        ),
        "macroRejectedMissingPeriod": (
            rejection_counts["missingPeriod"]
        ),
        "macroRejectedMissingScope": (
            rejection_counts["missingScope"]
        ),
        "macroRejectedMissingContractIdentity": (
            rejection_counts[
                "missingContractIdentity"
            ]
        ),
        "macroCrossVenueEventIdentities": (
            cross_venue_event_identities
        ),
        "macroContractsByMetric": {
            venue: dict(sorted(counts.items()))
            for venue, counts
            in metric_counts.items()
        },
        "macroExactMatchSamples": (
            direct_samples
        ),
        "macroComplementCandidateSamples": (
            complement_candidate_samples
        ),
        "ambiguousMacroContractSamples": (
            ambiguous_samples
        ),
        "macroComparableEventSamples": (
            comparable_event_samples
        ),
        "macroRejectionSamples": {
            reason: rows
            for reason, rows
            in sorted(rejection_samples.items())
        },
    }

WEATHER_METRIC_PATTERNS: Sequence[
    Tuple[str, str]
] = (
    (
        r"\b(?:highest|maximum|max)\s+temperature\b",
        "daily-high-temperature",
    ),
    (
        r"\b(?:lowest|minimum|min)\s+temperature\b",
        "daily-low-temperature",
    ),
    (
        r"\bprecipitation\b|\brainfall\b",
        "precipitation-total",
    ),
    (
        r"\bmajor\s+atlantic\s+hurricanes?\b|"
        r"\bmajor\s+hurricanes?\b",
        "major-hurricane-count",
    ),
    (
        r"\batlantic\s+hurricanes?\b|"
        r"\bnumber of\s+hurricanes?\b|"
        r"\bhow many\s+hurricanes?\b",
        "hurricane-count",
    ),
    (
        r"\btropical storms?\b",
        "tropical-storm-count",
    ),
    (
        r"\btornado(?:es)?\b",
        "tornado-count",
    ),
    (
        r"\bdrought\b",
        "drought-category",
    ),
    (
        r"\bearthquake\b",
        "earthquake-occurrence",
    ),
    (
        r"\b(?:volcanic|volcano|eruption|erupt)\b",
        "volcanic-eruption",
    ),
    (
        r"\bsea ice\b",
        "sea-ice-minimum",
    ),
    (
        r"\bhottest year\b",
        "hottest-year",
    ),
    (
        r"\bglobal temperature\b|"
        r"\bdegrees? celsius over pre industrial\b",
        "global-temperature-threshold",
    ),
)


WEATHER_LOCATION_ALIASES = {
    "nyc": "new-york-city",
    "new york": "new-york-city",
    "new york city": "new-york-city",
    "the us": "us",
    "u s": "us",
    "u s a": "us",
    "usa": "us",
    "united states": "us",
    "atlantic": "atlantic-basin",
    "the atlantic": "atlantic-basin",
    "arctic": "arctic",
}


def weather_metric(
    market: Market,
    text: str,
) -> Optional[str]:
    series = str(
        market.external_series_id
        or market.event.external_series_id
        or ""
    ).upper()

    series_overrides = (
        (
            "KXHURCTOTMAJ",
            "major-hurricane-count",
        ),
        (
            "KXHURCTOT",
            "hurricane-count",
        ),
        (
            "KXTROPSTORM",
            "tropical-storm-count",
        ),
        (
            "KXTORNADO",
            "tornado-count",
        ),
        (
            "KXDROUGHTLEVEL",
            "drought-category",
        ),
    )

    for prefix, metric in series_overrides:
        if series.startswith(prefix):
            return metric

    for pattern, metric in WEATHER_METRIC_PATTERNS:
        if re.search(pattern, text):
            return metric

    return None


def canonical_weather_location(
    value: Any,
) -> Optional[str]:
    cleaned = exact_text(value)

    if not cleaned:
        return None

    cleaned = re.sub(
        r"^(?:the|city of|state of)\s+",
        "",
        cleaned,
    )
    cleaned = re.sub(
        r"\s+(?:city|state)$",
        "",
        cleaned,
    )

    alias = WEATHER_LOCATION_ALIASES.get(
        cleaned
    )

    if alias:
        return alias

    return exact_code(cleaned)


def weather_location(
    market: Market,
    text: str,
    metric: str,
) -> Optional[str]:
    custom_values = [
        market.custom_strike.get("Geography"),
        market.custom_strike.get("Location"),
        market.contract_semantics.get(
            "custom_strike",
            {},
        ).get("Geography")
        if isinstance(
            market.contract_semantics.get(
                "custom_strike"
            ),
            dict,
        )
        else None,
    ]

    for value in custom_values:
        location = canonical_weather_location(
            value
        )

        if location:
            return location

    fixed_patterns = (
        (
            r"\barctic\s+sea ice\b",
            "arctic",
        ),
        (
            r"\batlantic\s+(?:major\s+)?"
            r"(?:hurricanes?|tropical storms?)\b",
            "atlantic-basin",
        ),
        (
            r"\blandfall\s+in\s+(?:the\s+)?"
            r"(?:us|u s|usa|united states)\b",
            "us",
        ),
        (
            r"\betna\b",
            "etna",
        ),
        (
            r"\bvesuvius\b",
            "vesuvius",
        ),
    )

    for pattern, location in fixed_patterns:
        if re.search(pattern, text):
            return location

    extraction_patterns = (
        r"\b(?:highest|lowest|maximum|minimum|max|min)\s+"
        r"temperature\s+in\s+(.+?)\s+on\b",
        r"\bprecipitation\s+in\s+(.+?)\s+in\b",
        r"\brainfall\s+in\s+(.+?)\s+in\b",
        r"\bearthquake\s+in\s+(.+?)\s+before\b",
        r"\bwill\s+(.+?)\s+have\s+(?:a\s+)?"
        r"(?:maximum\s+)?drought\b",
    )

    for pattern in extraction_patterns:
        match = re.search(pattern, text)

        if not match:
            continue

        candidate = re.sub(
            r"\b(?:be|of|at|with)\b.*$",
            "",
            match.group(1),
        ).strip()

        location = canonical_weather_location(
            candidate
        )

        if location:
            return location

    if metric in {
        "hurricane-count",
        "major-hurricane-count",
        "tropical-storm-count",
    }:
        return "atlantic-basin"

    if metric == "tornado-count":
        if re.search(
            r"\b(?:us|u s|usa|united states)\b",
            text,
        ):
            return "us"

        # Kalshi's native monthly tornado series is U.S.-scoped even when
        # the market title omits the country.
        if (
            market.venue == "kalshi"
            and market.external_series_id
            and str(
                market.external_series_id
            ).upper().startswith("KXTORNADO")
        ):
            return "us"

    if metric == "earthquake-occurrence":
        if re.search(r"\bcalifornia\b", text):
            return "california"

        if re.search(r"\bjapan\b", text):
            return "japan"

        return "global"

    if metric in {
        "hottest-year",
        "global-temperature-threshold",
    }:
        return "global"

    return None


def weather_reference_time(
    market: Market,
) -> Optional[datetime]:
    return (
        market.resolution_time
        or market.close_time
        or market.event.end_time
        or market.event.close_time
    )


def weather_period(
    text: str,
    market: Market,
) -> Optional[str]:
    reference = weather_reference_time(
        market
    )
    month_names = "|".join(
        sorted(
            MONTHS,
            key=len,
            reverse=True,
        )
    )
    day_number = (
        r"(0?[1-9]|[12]\d|3[01])"
        r"(?:st|nd|rd|th)?"
        r"(?!\d)"
    )

    # exact_text normalizes dash characters. It can also remove surrounding
    # punctuation, so accept either an explicit connector or whitespace
    # between the two full month/day expressions.
    range_match = re.search(
        rf"\b({month_names})\s+"
        rf"{day_number}\s*"
        rf"(?:-|to|through)?\s*"
        rf"({month_names})\s+"
        rf"{day_number}"
        r"(?:\s*,?\s*(20\d{2}))?",
        text,
    )

    if range_match:
        year = (
            int(range_match.group(5))
            if range_match.group(5)
            else (
                reference.year
                if reference
                else None
            )
        )

        if year is not None:
            return (
                f"{year}-"
                f"{MONTHS[range_match.group(1)]:02d}-"
                f"{int(range_match.group(2)):02d}"
                ".."
                f"{year}-"
                f"{MONTHS[range_match.group(3)]:02d}-"
                f"{int(range_match.group(4)):02d}"
            )

    month_match = re.search(
        rf"\b({month_names})\s+"
        r"(20\d{2})\b",
        text,
    )

    if month_match:
        return (
            f"{month_match.group(2)}-"
            f"{MONTHS[month_match.group(1)]:02d}"
        )

    day_match = re.search(
        rf"\b({month_names})\s+"
        rf"{day_number}"
        r"(?:\s*,?\s*(20\d{2}))?",
        text,
    )

    if day_match:
        year = (
            int(day_match.group(3))
            if day_match.group(3)
            else (
                reference.year
                if reference
                else None
            )
        )

        if year is not None:
            return (
                f"{year}-"
                f"{MONTHS[day_match.group(1)]:02d}-"
                f"{int(day_match.group(2)):02d}"
            )

    month_only = re.search(
        rf"\b(?:in|during|for)\s+"
        rf"({month_names})\b",
        text,
    )

    if month_only and reference:
        return (
            f"{reference.year}-"
            f"{MONTHS[month_only.group(1)]:02d}"
        )

    before_year = re.search(
        r"\bbefore\s+(20\d{2})\b",
        text,
    )

    if before_year:
        return (
            f"deadline-{int(before_year.group(1)) - 1}"
            "-12-31"
        )

    explicit_years = sorted(
        set(
            re.findall(
                r"\b20\d{2}\b",
                text,
            )
        )
    )

    if len(explicit_years) == 1:
        return explicit_years[0]

    if (
            re.search(
                r"\bthis summer\b",
                text,
            )
            and reference
    ):
        return f"{reference.year}-summer"

    return None


def weather_scope(
        text: str,
        metric: str,
) -> Optional[str]:
    if metric == "daily-high-temperature":
        return "daily-observed-high"

    if metric == "daily-low-temperature":
        return "daily-observed-low"

    if metric == "precipitation-total":
        return "period-total"

    if metric in {
        "hurricane-count",
        "major-hurricane-count",
        "tropical-storm-count",
        "tornado-count",
    }:
        return "period-count"

    if metric == "drought-category":
        return "maximum-category-during-period"

    if metric == "earthquake-occurrence":
        return "occurrence-by-deadline"

    if metric == "volcanic-eruption":
        return "occurrence-during-period"

    if metric == "sea-ice-minimum":
        return "season-minimum-extent"

    if metric == "hottest-year":
        return "calendar-year-record"

    if metric == "global-temperature-threshold":
        return "threshold-crossing-by-deadline"

    return None


def weather_unit(
        text: str,
        metric: str,
) -> Optional[str]:
    if metric in {
        "hurricane-count",
        "major-hurricane-count",
        "tropical-storm-count",
        "tornado-count",
    }:
        return "count"

    if metric == "drought-category":
        return "us-drought-category"

    if metric == "earthquake-occurrence":
        return "moment-magnitude"

    if metric == "volcanic-eruption":
        return "vei"

    if metric == "sea-ice-minimum":
        if re.search(
                r"(?:\d+(?:\.\d+)?\s*m\s+|"
                r"\bmillion\s+)square\s+kilometers?\b",
                text,
        ):
            return "million-square-kilometers"

        return None

    if metric in {
        "daily-high-temperature",
        "daily-low-temperature",
        "global-temperature-threshold",
    }:
        if re.search(
                r"\b(?:fahrenheit|degrees?\s+f)\b|"
                r"-?\d+(?:\.\d+)?\s*f\b",
                text,
        ):
            return "fahrenheit"

        if re.search(
                r"\b(?:celsius|degrees?\s+c)\b|"
                r"-?\d+(?:\.\d+)?\s*c\b",
                text,
        ):
            return "celsius"

        return None

    if metric == "precipitation-total":
        if re.search(
                r"\b(?:inch|inches)\b",
                text,
        ):
            return "inches"

        if re.search(
                r"\d+(?:\.\d+)?\s*mm\b|"
                r"\bmillimeters?\b",
                text,
        ):
            return "millimeters"

        return None

    if metric == "hottest-year":
        return "boolean"

    return None


def weather_observation_source(
        text: str,
) -> str:
    patterns = (
        (
            r"\bnational weather service\b|"
            r"\bnws\b",
            "nws",
        ),
        (
            r"\bnational hurricane center\b|"
            r"\bnhc\b",
            "nhc",
        ),
        (
            r"\bus drought monitor\b|"
            r"\bunited states drought monitor\b",
            "us-drought-monitor",
        ),
        (
            r"\bunited states geological survey\b|"
            r"\busgs\b",
            "usgs",
        ),
        (
            r"\bweather underground\b|"
            r"\bwunderground\b",
            "weather-underground",
        ),
        (
            r"\bnational oceanic and atmospheric administration\b|"
            r"\bnoaa\b",
            "noaa",
        ),
    )

    for pattern, source in patterns:
        if re.search(pattern, text):
            return source

    return "unspecified"


def weather_number(
        value: Any,
) -> Optional[str]:
    return decimal_text(
        str(value)
        .replace("°", "")
        .replace(",", "")
        .strip()
    )


def weather_contract_identity(
        market: Market,
        text: str,
        metric: str,
) -> Optional[str]:
    drought = re.search(
        r"\bat least\s+d(\d+)\b|"
        r"\bd(\d+)\s+or\s+(?:higher|above|more)\b",
        text,
    )

    if drought:
        value = drought.group(1) or drought.group(2)
        return f"threshold|gte|d{value}"

    storm_category = re.search(
        r"\bcategory\s+(\d+)\b",
        text,
    )

    if (
            storm_category
            and re.search(r"\blandfall\b", text)
    ):
        return (
            "storm-category|eq|"
            f"{storm_category.group(1)}"
        )

    vei = re.search(
        r"\bvei\s+(-?\d+(?:\.\d+)?)\s*(\+)?",
        text,
    )

    if vei:
        comparator = (
            "gte"
            if vei.group(2)
            else "eq"
        )
        value = weather_number(
            vei.group(1)
        )
        return (
            f"threshold|{comparator}|{value}"
            if value is not None
            else None
        )

    range_match = re.search(
        r"\bbetween\s+"
        r"(-?\d+(?:\.\d+)?)\s*"
        r"(?:%|mm|inches?|f|c|m)?\s*"
        r"(?:and|&|-|to)\s*"
        r"(-?\d+(?:\.\d+)?)",
        text,
    )

    if range_match:
        lower = weather_number(
            range_match.group(1)
        )
        upper = weather_number(
            range_match.group(2)
        )

        if lower is not None and upper is not None:
            return (
                f"threshold|range|{lower}|{upper}"
            )

    comparator_patterns = (
        (
            r"\b(?:at least|or higher|or more|"
            r"or above|no less than)\s+"
            r"(-?\d+(?:\.\d+)?)|"
            r"(-?\d+(?:\.\d+)?)\s*"
            r"(?:%|mm|inches?|f|c|m)?\s*"
            r"(?:or higher|or more|or above|\+)",
            "gte",
        ),
        (
            r"\b(?:at most|or lower|or less|"
            r"or below|no more than)\s+"
            r"(-?\d+(?:\.\d+)?)|"
            r"(-?\d+(?:\.\d+)?)\s*"
            r"(?:%|mm|inches?|f|c|m)?\s*"
            r"(?:or lower|or less|or below)",
            "lte",
        ),
        (
            r"\b(?:more than|greater than|above|over)\s+"
            r"(-?\d+(?:\.\d+)?)",
            "gt",
        ),
        (
            r"\b(?:less than|below|under)\s+"
            r"(-?\d+(?:\.\d+)?)",
            "lt",
        ),
    )

    for pattern, comparator in comparator_patterns:
        match = re.search(
            pattern,
            text,
        )

        if not match:
            continue

        raw_value = next(
            (
                group
                for group in match.groups()
                if group is not None
            ),
            None,
        )
        value = weather_number(raw_value)

        if value is not None:
            return (
                f"threshold|{comparator}|{value}"
            )

    magnitude = re.search(
        r"\b(?:magnitude\s+)?"
        r"(-?\d+(?:\.\d+)?)\s*"
        r"(?:magnitude\s*)?"
        r"(?:or above|or higher|\+)",
        text,
    )

    if magnitude and metric == "earthquake-occurrence":
        value = weather_number(
            magnitude.group(1)
        )

        if value is not None:
            return f"threshold|gte|{value}"

    exact_temperature = re.search(
        r"\bbe\s+(-?\d+(?:\.\d+)?)\s*"
        r"(?:degrees?\s+)?(?:f|c|fahrenheit|celsius)\b",
        text,
    )

    if exact_temperature:
        value = weather_number(
            exact_temperature.group(1)
        )

        if value is not None:
            return f"threshold|eq|{value}"

    if metric == "hottest-year":
        return "boolean|yes"

    return None

def weather_contract_result(
        market: Market,
) -> Tuple[
    Optional[ExactContract],
    Optional[str],
]:
    combined = market_semantic_text(
        market
    )
    metric = weather_metric(
        market,
        combined,
    )

    if not metric:
        return None, None

    if not market_is_open_for_exact_matching(
            market
    ):
        return None, "notOpen"

    binary = yes_no_outcomes(market)

    if not binary:
        return None, "nonBinary"

    location = weather_location(
        market,
        combined,
        metric,
    )
    period = weather_period(
        combined,
        market,
    )
    scope = weather_scope(
        combined,
        metric,
    )
    unit = weather_unit(
        combined,
        metric,
    )
    source = weather_observation_source(
        combined
    )
    contract_identity = weather_contract_identity(
        market,
        market_contract_text(market),
        metric,
    )

    if not location:
        return None, "missingLocation"

    if not period:
        return None, "missingPeriod"

    if not scope:
        return None, "missingScope"

    if not unit:
        return None, "missingUnit"

    if not contract_identity:
        return None, "missingContractIdentity"

    yes, no = binary

    event_identity = (
        f"weather|{location}|{metric}|"
        f"{period}|{scope}|{unit}|{source}"
    )

    return ExactContract(
        market.id,
        market.venue,
        event_identity,
        contract_identity,
        "weather",
        market.event.title,
        market.market_title,
        iso_value(
            market.resolution_time
            or market.close_time
            or market.event.end_time
        ),
        yes["key"],
        no["key"],
        yes["label"],
        no["label"],
        "exact_weather_dimensions",
    ), None


def build_weather_contract_pairs(
        markets: Dict[int, Market],
) -> Tuple[
    List[Tuple[ExactContract, ExactContract]],
    Dict[str, Any],
]:
    contracts: List[ExactContract] = []
    rejection_counts = Counter()
    rejection_samples: Dict[
        str,
        List[Dict[str, Any]],
    ] = defaultdict(list)

    for market in markets.values():
        contract, rejection = (
            weather_contract_result(market)
        )

        if contract:
            contracts.append(contract)
            continue

        if rejection:
            rejection_counts[rejection] += 1

            if (
                    len(
                        rejection_samples[rejection]
                    )
                    < 5
            ):
                rejection_samples[
                    rejection
                ].append(
                    {
                        "venue": market.venue,
                        "marketId": (
                            market.external_market_id
                        ),
                        "eventTitle": (
                            market.event.title
                        ),
                        "marketTitle": (
                            market.market_title
                        ),
                        "resolutionTime": (
                            iso_value(
                                market.resolution_time
                            )
                        ),
                        "acceptingOrders": (
                            market.accepting_orders
                        ),
                    }
                )

    indexed: Dict[
        Tuple[str, str],
        Dict[str, List[ExactContract]],
    ] = defaultdict(
        lambda: defaultdict(list)
    )

    by_event: Dict[
        str,
        Dict[str, List[ExactContract]],
    ] = defaultdict(
        lambda: defaultdict(list)
    )

    for contract in contracts:
        indexed[
            (
                contract.event_identity,
                contract.contract_identity,
            )
        ][contract.venue].append(contract)

        by_event[
            contract.event_identity
        ][contract.venue].append(contract)

    pairs: List[
        Tuple[ExactContract, ExactContract]
    ] = []
    ambiguous = 0
    direct_samples: List[
        Dict[str, Any]
    ] = []
    ambiguous_samples: List[
        Dict[str, Any]
    ] = []

    def details(
            contract: ExactContract,
    ) -> Dict[str, Any]:
        market = markets[
            contract.market_id
        ]

        return {
            "venue": contract.venue,
            "marketId": (
                market.external_market_id
            ),
            "eventTitle": (
                market.event.title
            ),
            "marketTitle": (
                market.market_title
            ),
            "eventIdentity": (
                contract.event_identity
            ),
            "contractIdentity": (
                contract.contract_identity
            ),
            "scheduledTime": (
                contract.scheduled_time
            ),
        }

    for (
            event_identity,
            contract_identity,
    ), venues in indexed.items():
        poly = venues.get(
            "polymarket",
            [],
        )
        kalshi = venues.get(
            "kalshi",
            [],
        )

        if not poly or not kalshi:
            continue

        if (
                len(poly) == 1
                and len(kalshi) == 1
        ):
            pairs.append(
                (
                    poly[0],
                    kalshi[0],
                )
            )

            if len(direct_samples) < 10:
                direct_samples.append(
                    {
                        "eventIdentity": (
                            event_identity
                        ),
                        "contractIdentity": (
                            contract_identity
                        ),
                        "polymarket": details(
                            poly[0]
                        ),
                        "kalshi": details(
                            kalshi[0]
                        ),
                    }
                )

            continue

        ambiguous += 1

        if len(ambiguous_samples) < 10:
            ambiguous_samples.append(
                {
                    "eventIdentity": (
                        event_identity
                    ),
                    "contractIdentity": (
                        contract_identity
                    ),
                    "polymarket": [
                        details(row)
                        for row in poly
                    ],
                    "kalshi": [
                        details(row)
                        for row in kalshi
                    ],
                }
            )

    comparable_samples: List[
        Dict[str, Any]
    ] = []
    cross_venue_events = 0

    for event_identity, venues in by_event.items():
        poly = venues.get(
            "polymarket",
            [],
        )
        kalshi = venues.get(
            "kalshi",
            [],
        )

        if not poly or not kalshi:
            continue

        cross_venue_events += 1

        poly_identities = sorted(
            {
                row.contract_identity
                for row in poly
            }
        )
        kalshi_identities = sorted(
            {
                row.contract_identity
                for row in kalshi
            }
        )

        if len(comparable_samples) < 12:
            comparable_samples.append(
                {
                    "eventIdentity": (
                        event_identity
                    ),
                    "sharedContractIdentities": (
                        sorted(
                            set(poly_identities)
                            & set(
                                kalshi_identities
                            )
                        )
                    ),
                    "polymarketContractIdentities": (
                        poly_identities
                    ),
                    "kalshiContractIdentities": (
                        kalshi_identities
                    ),
                }
            )

    metric_counts: Dict[
        str,
        Counter,
    ] = {
        "polymarket": Counter(),
        "kalshi": Counter(),
    }

    for contract in contracts:
        parts = (
            contract.event_identity.split(
                "|"
            )
        )
        metric = (
            parts[2]
            if len(parts) > 2
            else "unknown"
        )
        metric_counts[
            contract.venue
        ][metric] += 1

    return pairs, {
        "polymarketWeatherContracts": sum(
            contract.venue == "polymarket"
            for contract in contracts
        ),
        "kalshiWeatherContracts": sum(
            contract.venue == "kalshi"
            for contract in contracts
        ),
        "weatherContractMatches": len(
            pairs
        ),
        "ambiguousWeatherContractIdentities": (
            ambiguous
        ),
        "weatherCrossVenueEventIdentities": (
            cross_venue_events
        ),
        "weatherRejectedNotOpen": (
            rejection_counts["notOpen"]
        ),
        "weatherRejectedNonBinary": (
            rejection_counts["nonBinary"]
        ),
        "weatherRejectedMissingLocation": (
            rejection_counts[
                "missingLocation"
            ]
        ),
        "weatherRejectedMissingPeriod": (
            rejection_counts[
                "missingPeriod"
            ]
        ),
        "weatherRejectedMissingScope": (
            rejection_counts[
                "missingScope"
            ]
        ),
        "weatherRejectedMissingUnit": (
            rejection_counts[
                "missingUnit"
            ]
        ),
        "weatherRejectedMissingContractIdentity": (
            rejection_counts[
                "missingContractIdentity"
            ]
        ),
        "weatherContractsByMetric": {
            venue: dict(
                sorted(
                    counts.items()
                )
            )
            for venue, counts
            in metric_counts.items()
        },
        "weatherExactMatchSamples": (
            direct_samples
        ),
        "ambiguousWeatherContractSamples": (
            ambiguous_samples
        ),
        "weatherComparableEventSamples": (
            comparable_samples
        ),
        "weatherRejectionSamples": {
            reason: rows
            for reason, rows
            in sorted(
                rejection_samples.items()
            )
        },
    }



def generic_title_resolution_hint(value: Any) -> Optional[str]:
    """Return only a rule-like calendar window explicitly present in title text."""
    text = exact_text(value)
    return calendar_resolution_window(text) if text else None


def generic_strip_calendar_phrases(value: str) -> str:
    """
    Remove explicit calendar-window wording from semantic comparison text.

    The canonical window is added back separately by generic_normalize_match_text,
    so equivalent wording such as "by December 31, 2026" and "end of December
    2026" can converge without deleting standalone subject years such as the
    "2028" in "2028 presidential election".
    """
    raw = re.sub(r"(?<=\d),(?=\d{3}\b)", "", str(value or ""))
    text = exact_text(raw)
    month_pattern = (
        r"jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|"
        r"jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|"
        r"oct(?:ober)?|nov(?:ember)?|dec(?:ember)?"
    )
    patterns = (
        rf"\b(?:by|before|through|until|on|at|after)?\s*(?:the\s+)?"
        rf"(?:{month_pattern})\s+\d{{1,2}}(?:st|nd|rd|th)?(?:\s*,?\s*20\d{{2}})?\b",
        rf"\b\d{{1,2}}(?:st|nd|rd|th)?\s+(?:{month_pattern})(?:\s+20\d{{2}})?\b",
        rf"\b(?:by|at|through|until)?\s*(?:the\s+)?end\s+of\s+(?:{month_pattern})\s+20\d{{2}}\b",
        rf"\b(?:in|during|for)?\s*(?:{month_pattern})\s+20\d{{2}}\b",
        r"\b20\d{2}[-/]\d{1,2}[-/]\d{1,2}\b",
    )
    for pattern in patterns:
        text = re.sub(pattern, " ", text)
    return " ".join(text.split())
def generic_normalize_match_text(value: Any) -> str:
    raw = str(value or "")
    resolution_hint = generic_title_resolution_hint(raw)
    text = generic_strip_calendar_phrases(raw)
    for pattern, replacement in GENERIC_TEXT_REPLACEMENTS:
        text = re.sub(pattern, replacement, text)
    text = exact_text(text)
    words = [
        word
        for word in text.split()
        if word not in GENERIC_STOP_WORDS
    ]
    if resolution_hint:
        words.extend(
            word
            for word in exact_text(resolution_hint).split()
            if word not in GENERIC_STOP_WORDS
        )
    return " ".join(words)


def generic_material_numbers(value: Any) -> Tuple[str, ...]:
    text = generic_strip_calendar_phrases(str(value or ""))
    numbers = []
    for raw in re.findall(r"(?<![a-z])(-?\d+(?:\.\d+)?)(?![a-z])", text):
        normalized = decimal_text(raw)
        if normalized is not None:
            numbers.append(normalized)
    return tuple(numbers)


def generic_action_signature(value: Any) -> Tuple[str, ...]:
    text = generic_normalize_match_text(value)
    return tuple(
        sorted(
            action
            for pattern, action in GENERIC_ACTION_PATTERNS
            if re.search(pattern, text)
        )
    )


def generic_negation_signature(value: Any) -> bool:
    text = exact_text(value)
    return re.search(r"\b(no|not|never|without|fail|fails|failed)\b", text) is not None


def generic_group_for_row(row: Dict[str, Any]) -> Optional[str]:
    title_text = exact_text(
        f"{row.get('event_title') or ''} {row.get('market_title') or ''}"
    )
    category_text = exact_text(
        f"{row.get('category') or ''} {row.get('market_type') or ''}"
    )

    # Specialized sports categories must be excluded before title-based generic
    # patterns. Otherwise country/team names such as Iran or Ukraine can make a
    # chess/sports market look geopolitical before the sports guard runs. Use
    # category words only here so entertainment titles containing words like
    # "game" are not excluded merely because of title wording.
    sports_market_type = exact_text(row.get("sports_market_type"))
    category_words = set(category_text.split())
    if sports_market_type or any(term in category_words for term in SPORTS_EVENT_TERMS):
        return None

    # Legislative questions can contain domain words such as crypto, AI, or
    # technology. When the venue itself labels the market Politics and the
    # title is explicitly about legislation becoming law, classify the event
    # by the political action rather than by its subject matter.
    if (
        contains_exact_phrase(category_text, "politics")
        and re.search(
            r"\b(bill|legislation|become law|becomes law|signed into law|"
            r"congress|senate|house of representatives)\b",
            title_text,
        )
    ):
        return "politics"

    # Corporate-event semantics should outrank subject-matter words such as
    # OpenAI/Anthropic. Keep political/geopolitical acquisitions (for example
    # territory questions) out of Companies by respecting explicit venue labels.
    category_is_political = (
        contains_exact_phrase(category_text, "politics")
        or contains_exact_phrase(category_text, "election")
        or contains_exact_phrase(category_text, "geopolitics")
    )
    award_semantics = re.search(
        r"\b(oscar|oscars|academy award|grammy|grammys|emmy|emmys|"
        r"golden globe|bafta|nobel|award|awards|best picture|best actor|"
        r"best actress|album of the year|record of the year|person of the year|poty)\b",
        title_text,
    )
    company_semantics = re.search(
        r"\b(ipo|initial public offering|go public|public offering|"
        r"earnings call|quarterly earnings|market cap|valuation|bankruptcy|"
        r"merger|merge|acquisition|acquire|buyout)\b",
        title_text,
    )
    if company_semantics and not award_semantics and not category_is_political:
        return "companies"

    # Strong title semantics take priority over venue category labels. This is
    # especially important for election markets that one venue labels simply
    # as Politics.
    for group, pattern in GENERIC_GROUP_PATTERNS:
        if re.search(pattern, title_text):
            return group

    for raw_category, group in GENERIC_CATEGORY_ALIASES.items():
        if contains_exact_phrase(category_text, raw_category):
            return group

    # Macro and weather remain specialized families after explicit generic
    # classification. Sports was already excluded above before title patterns.
    if re.search(MACRO_CANDIDATE_PATTERN, title_text):
        return None
    if re.search(WEATHER_CANDIDATE_PATTERN, title_text):
        return None

    return "misc"


def generic_yes_no_outcomes(row: Dict[str, Any]) -> bool:
    outcomes = as_json(row.get("outcomes"), list, [])
    labels = {
        exact_text(item.get("label") or item.get("key"))
        for item in outcomes
        if isinstance(item, dict)
        and (item.get("label") or item.get("key")) not in (None, "")
    }
    return labels == {"yes", "no"}


def generic_row_is_open(row: Dict[str, Any], reference_time: datetime) -> bool:
    if row.get("accepting_orders") is False:
        return False
    status = exact_text(row.get("venue_status"))
    if set(status.split()) & CLOSED_VENUE_STATUS_TERMS:
        return False
    close_time = parse_datetime(row.get("close_time"))
    if close_time is not None and close_time <= reference_time:
        return False
    resolution_time = parse_datetime(row.get("resolution_time"))
    if resolution_time is not None and resolution_time <= reference_time:
        return False
    return True


def generic_structured_contract_identity(row: Dict[str, Any]) -> Optional[str]:
    function = exact_code(row.get("functional_strike"))
    floor = decimal_text(row.get("floor_strike"))
    cap = decimal_text(row.get("cap_strike"))
    line = decimal_text(row.get("line_value"))
    title = exact_text(row.get("market_title"))

    greater = {"greater", "greater_than", "above", "more_than", "gt"}
    greater_equal = {"greater_equal", "greater_than_or_equal", "at_least", "gte"}
    less = {"less", "less_than", "below", "under", "lt"}
    less_equal = {"less_equal", "less_than_or_equal", "at_most", "lte"}
    ranges = {"between", "range", "bounded"}

    if function in greater and (floor or line):
        return f"threshold|gt|{floor or line}"
    if function in greater_equal and (floor or line):
        return f"threshold|gte|{floor or line}"
    if function in less and (cap or line):
        return f"threshold|lt|{cap or line}"
    if function in less_equal and (cap or line):
        return f"threshold|lte|{cap or line}"
    if function in ranges and floor and cap:
        return f"threshold|range|{floor}|{cap}"

    if floor is not None and cap is not None and re.search(r"\b(?:between|from)\b|\bto\b", title):
        return f"threshold|range|{floor}|{cap}"
    if floor is not None:
        if re.search(r"\b(?:at least|or more|no less than|or above)\b|>=", title):
            return f"threshold|gte|{floor}"
        if re.search(r"\b(?:above|over|more than|greater than|exceed|exceeds)\b|>", title):
            return f"threshold|gt|{floor}"
    if cap is not None:
        if re.search(r"\b(?:at most|or less|no more than|or below)\b|<=", title):
            return f"threshold|lte|{cap}"
        if re.search(r"\b(?:below|under|less than)\b|<", title):
            return f"threshold|lt|{cap}"
    return None


def crypto_asset_identity(value: Any) -> Optional[str]:
    text = exact_text(value)
    patterns = (
        (r"\b(bitcoin|btc)\b", "bitcoin"),
        (r"\b(ethereum|ether|eth)\b", "ethereum"),
        (r"\b(solana|sol)\b", "solana"),
        (r"\bxrp\b", "xrp"),
        (r"\b(dogecoin|doge)\b", "dogecoin"),
    )
    matches = [name for pattern, name in patterns if re.search(pattern, text)]
    return matches[0] if len(matches) == 1 else None


def crypto_price_target(value: Any) -> Optional[str]:
    text = exact_text(str(value or "").replace(",", ""))
    patterns = (
        r"\b(?:reach|reaches|reached|hit|hits|cross|crosses|crossed|"
        r"dip to|dips to|fall to|falls to|drop to|drops to|"
        r"above|over|below|under)\s*\$?\s*(\d+(?:\.\d+)?)\s*([kmb])?\b",
        r"\$\s*(\d+(?:\.\d+)?)\s*([kmb])?\b",
    )
    match = None
    for pattern in patterns:
        match = re.search(pattern, text)
        if match:
            break
    if not match:
        return None

    number = Decimal(match.group(1))
    suffix = (match.group(2) or "").lower()
    number *= {
        "": Decimal("1"),
        "k": Decimal("1000"),
        "m": Decimal("1000000"),
        "b": Decimal("1000000000"),
    }[suffix]

    # Candidate discovery only. Kalshi path-high ladders commonly encode the
    # economic barrier one cent below the human round-number proposition, e.g.
    # > 199999.99 versus "reach 200000". Normalize that only for finding a
    # candidate; the settlement verifier still compares the exact operators,
    # feeds, methods, starts, and raw thresholds before admitting anything.
    if number >= Decimal("100") and (number % 1) == Decimal("0.99"):
        number += Decimal("0.01")

    return decimal_text(number)


def crypto_candidate_window(event_title: str, market_title: str) -> Optional[str]:
    combined = f"{event_title} {market_title}"
    window = generic_title_resolution_hint(combined)

    event_text = exact_text(event_title)
    market_text = exact_text(market_title)
    year_match = re.search(r"\b(?:in|during|end of) (20\d{2})\b", event_text)
    semantic_year = int(year_match.group(1)) if year_match else None

    # Candidate discovery only: midnight Jan 1 is the boundary immediately
    # after Dec 31 of the semantic year. Settlement rules, not this helper,
    # decide whether the actual observation windows are equivalent.
    midnight_next_year = re.search(
        r"\bjan(?:uary)? 1,? (20\d{2}) at 12(?:[: ]?00)? ?am et\b",
        market_text,
    )
    if semantic_year and midnight_next_year:
        next_year = int(midnight_next_year.group(1))
        if next_year == semantic_year + 1:
            return f"deadline-{semantic_year}-12-31"

    if semantic_year and re.search(r"\bend of 20\d{2}\b", event_text):
        return f"deadline-{semantic_year}-12-31"

    return window


def crypto_structured_signature(row: Dict[str, Any]) -> Optional[str]:
    event_title = str(row.get("event_title") or "")
    market_title = str(row.get("market_title") or "")
    semantics = as_json(row.get("contract_semantics"), dict, {})
    subtitle = str(
        semantics.get("yes_sub_title")
        or semantics.get("subtitle")
        or ""
    )
    combined = f"{event_title} {market_title} {subtitle}"
    text = exact_text(combined)

    asset = crypto_asset_identity(combined)
    if not asset:
        return None

    # Keep legislation, regulatory, legal, election, ETF, and company-event
    # propositions out of the crypto-price-path matcher.
    if re.search(
        r"\b(bill|law|legislation|regulation|regulatory|ban|unban|etf|"
        r"lawsuit|court|sec|congress|senate|president|election|ipo|"
        r"acquire|merger|bankruptcy)\b",
        text,
    ):
        return None

    window = crypto_candidate_window(event_title, market_title)
    floor = decimal_text(row.get("floor_strike"))
    cap = decimal_text(row.get("cap_strike"))

    point_in_time = bool(re.search(
        r"\b(price at the end|price at end|price on|at the end of|"
        r"closing price|close price)\b",
        text,
    ))
    if point_in_time and floor is not None and cap is not None:
        if not window:
            year_match = re.search(r"\bend of (20\d{2})\b", text)
            if year_match:
                window = f"deadline-{year_match.group(1)}-12-31"
        if window:
            return f"{asset}|point_range|{floor}|{cap}|{window}"

    target = crypto_price_target(market_title)
    if target is None:
        if floor is not None and re.search(r"\b(above|over)\b", text):
            target = floor
            try:
                amount = Decimal(target)
                if amount >= Decimal("100") and (amount % 1) == Decimal("0.99"):
                    target = decimal_text(amount + Decimal("0.01"))
            except InvalidOperation:
                pass
        elif cap is not None and re.search(r"\b(below|under)\b", text):
            target = cap

    if not target or not window:
        return None

    if re.search(
        r"\b(dip to|dips to|how low|fall to|falls to|drop to|drops to)\b",
        text,
    ):
        observation = "path_low"
    elif re.search(
        r"\b(reach|reaches|reached|hit|hits|cross|crosses|crossed|how high)\b",
        text,
    ):
        observation = "path_high"
    elif re.search(r"\bbelow\b.*\bby\b", text):
        observation = "path_low"
    elif re.search(r"\babove\b.*\bby\b", text):
        observation = "path_high"
    else:
        return None

    return f"{asset}|{observation}|{target}|{window}"



def company_normalize_entity(value: Any) -> Optional[str]:
    text = exact_text(value)
    if not text:
        return None
    text = re.sub(
        r"\b(when|what|which|who|will|would|could|does|do|did|is|are|be|"
        r"officially|announce|announced|announcement|before|by|in|during|"
        r"the|their|next|this|year|company|companies)\b",
        " ",
        text,
    )
    text = re.sub(
        r"\b(incorporated|inc|corp|corporation|company|co|plc|llc|ltd|limited)\b",
        " ",
        text,
    )
    text = re.sub(r"[^a-z0-9]+", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    if not text or text in {"ipo", "merger", "acquisition", "earnings", "call"}:
        return None
    return text.replace(" ", "_")


def company_candidate_deadline(row: Dict[str, Any]) -> Optional[str]:
    semantics = as_json(row.get("contract_semantics"), dict, {})
    pieces = [
        row.get("market_title"),
        row.get("event_title"),
        row.get("rules_primary"),
        row.get("rules_secondary"),
        semantics.get("yes_sub_title"),
        semantics.get("no_sub_title"),
        semantics.get("subtitle"),
    ]
    for piece in pieces:
        if piece in (None, ""):
            continue
        parsed = calendar_resolution_window(str(piece))
        if parsed and parsed.startswith("deadline-"):
            return parsed
    return None


def company_ipo_subject(row: Dict[str, Any]) -> Optional[str]:
    values = [str(row.get("event_title") or ""), str(row.get("market_title") or "")]
    patterns = (
        r"\bwhen will\s+(.+?)\s+officially announce an? ipo\b",
        r"\bwill\s+(.+?)\s+ipo\b",
        r"^(.+?)\s+ipo\s+(?:by|before)\b",
        r"^(.+?)\s+ipo\b",
    )
    for value in values:
        text = exact_text(value)
        for pattern in patterns:
            match = re.search(pattern, text)
            if match:
                subject = company_normalize_entity(match.group(1))
                if subject and subject not in {"which", "who"}:
                    return subject
    return None


def company_acquisition_parties(row: Dict[str, Any]) -> Optional[Tuple[str, str]]:
    event_text = exact_text(row.get("event_title"))
    market_text = exact_text(row.get("market_title"))
    patterns = (
        r"\bwill\s+(.+?)\s+acquire\s+(.+?)(?:\s+in\s+20\d{2}|\s+before\b|\s+by\b|$)",
        r"\b(.+?)\s+acquire\s+(.+?)(?:\s+before\b|\s+by\b|$)",
        r"\b(.+?)\s+announce acquisition of\s+(.+?)(?:\s+before\b|\s+by\b|$)",
    )
    for value in (market_text, event_text):
        for pattern in patterns:
            match = re.search(pattern, value)
            if not match:
                continue
            acquirer = company_normalize_entity(match.group(1))
            target = company_normalize_entity(match.group(2))
            if acquirer and target and acquirer != target:
                return acquirer, target
    return None


def company_combination_parties(row: Dict[str, Any]) -> Optional[Tuple[str, str]]:
    values = [exact_text(row.get("event_title")), exact_text(row.get("market_title"))]
    patterns = (
        r"\b(?:when will\s+)?(.+?)\s+and\s+(.+?)\s+(?:merge|merger)\b",
        r"\b(.+?)\s+(?:and|or)\s+(.+?)\s+merger\b",
    )
    for value in values:
        for pattern in patterns:
            match = re.search(pattern, value)
            if not match:
                continue
            left = company_normalize_entity(match.group(1))
            right = company_normalize_entity(match.group(2))
            if left and right and left != right:
                return tuple(sorted((left, right)))
    return None


def company_earnings_issuer(row: Dict[str, Any]) -> Optional[str]:
    values = [exact_text(row.get("event_title")), exact_text(row.get("market_title"))]
    patterns = (
        r"\bwhat will\s+(.+?)\s+say during (?:their|the) next earnings call\b",
        r"\bwill\s+(.+?)\s+say\b.*\bduring earnings call\b",
    )
    for value in values:
        for pattern in patterns:
            match = re.search(pattern, value)
            if match:
                issuer = company_normalize_entity(match.group(1))
                if issuer:
                    return issuer
    return None


def company_earnings_term(row: Dict[str, Any]) -> Optional[str]:
    semantics = as_json(row.get("contract_semantics"), dict, {})
    custom = as_json(semantics.get("custom_strike"), dict, {})
    candidates = (
        custom.get("Word"),
        custom.get("word"),
        semantics.get("groupItemTitle"),
        semantics.get("group_item_title"),
        semantics.get("yes_sub_title"),
        semantics.get("no_sub_title"),
    )
    for value in candidates:
        if value in (None, ""):
            continue
        normalized = exact_text(value)
        if normalized and normalized not in {"yes", "no"}:
            return normalized.replace("|", " ").strip().replace(" ", "_")

    title = str(row.get("market_title") or "")
    quoted = re.search(r'["“”\']([^"“”\']+)["“”\']', title)
    if quoted:
        normalized = exact_text(quoted.group(1))
        if normalized:
            return normalized.replace(" ", "_")
    return None


def company_earnings_event_date(row: Dict[str, Any]) -> Optional[str]:
    rules = exact_text(f"{row.get('rules_primary') or ''} {row.get('rules_secondary') or ''}")
    month_names = "|".join(sorted(MONTHS, key=len, reverse=True))
    match = re.search(
        rf"\b(?:scheduled(?: to take place)?(?: on)?|take place on|on)\s+({month_names})\s+(\d{{1,2}})(?:st|nd|rd|th)?\s*,?\s*(20\d{{2}})\b",
        rules,
    )
    if match:
        return f"{int(match.group(3)):04d}-{MONTHS[match.group(1)]:02d}-{int(match.group(2)):02d}"

    ticker = str(row.get("external_market_id") or "").upper()
    ticker_match = re.search(
        r"-(\d{2})(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)(\d{2})(?:-|$)",
        ticker,
    )
    if ticker_match:
        month = {
            "JAN": 1, "FEB": 2, "MAR": 3, "APR": 4,
            "MAY": 5, "JUN": 6, "JUL": 7, "AUG": 8,
            "SEP": 9, "OCT": 10, "NOV": 11, "DEC": 12,
        }[ticker_match.group(2)]
        return f"20{ticker_match.group(1)}-{month:02d}-{int(ticker_match.group(3)):02d}"
    return None


def company_structured_signature(row: Dict[str, Any]) -> Optional[str]:
    category_text = exact_text(f"{row.get('category') or ''} {row.get('market_type') or ''}")
    title_text = exact_text(f"{row.get('event_title') or ''} {row.get('market_title') or ''}")

    # Never reinterpret explicit politics/election/geopolitical propositions as
    # corporate acquisition questions simply because they contain "acquire".
    if (
        contains_exact_phrase(category_text, "politics")
        or contains_exact_phrase(category_text, "election")
        or contains_exact_phrase(category_text, "geopolitics")
    ):
        return None

    if re.search(r"\bipo\b|\binitial public offering\b", title_text):
        subject = company_ipo_subject(row)
        deadline = company_candidate_deadline(row)
        if subject and deadline:
            return f"ipo|{subject}|none|{deadline}"

    if "earnings call" in title_text and re.search(r"\b(?:say|mention)\b", title_text):
        issuer = company_earnings_issuer(row)
        term = company_earnings_term(row)
        event_date = company_earnings_event_date(row)
        if issuer and term and event_date:
            return f"earnings_mention|{issuer}|{term}|{event_date}"

    if re.search(r"\b(?:merge|merger|combine|combination)\b", title_text):
        parties = company_combination_parties(row)
        if parties:
            deadline = company_candidate_deadline(row)
            if deadline:
                left, right = parties
                return f"combination|{left}+{right}|none|{deadline}"

    parties = company_acquisition_parties(row)
    if parties:
        deadline = company_candidate_deadline(row)
        if deadline:
            acquirer, target = parties
            return f"acquisition|{acquirer}|{target}|{deadline}"

    parties = company_combination_parties(row)
    if parties:
        deadline = company_candidate_deadline(row)
        if deadline:
            left, right = parties
            return f"combination|{left}+{right}|none|{deadline}"

    return None


def _misc_month_year(value: Any) -> Optional[str]:
    text = exact_text(value)
    month_pattern = "|".join(sorted(MONTHS, key=len, reverse=True))
    match = re.search(rf"\b({month_pattern})\s+(20\d{{2}})\b", text)
    if match:
        return f"{int(match.group(2)):04d}-{MONTHS[match.group(1)]:02d}"
    match = re.search(rf"\b({month_pattern})\b", text)
    year = re.search(r"\b(20\d{2})\b", text)
    if match and year:
        return f"{int(year.group(1)):04d}-{MONTHS[match.group(1)]:02d}"
    return None


def _misc_threshold_operator_and_value(row: Dict[str, Any]) -> Optional[Tuple[str, str]]:
    title = exact_text(row.get("market_title"))
    semantics = as_json(row.get("contract_semantics"), dict, {})
    raw_values = [
        title,
        exact_text(semantics.get("groupItemTitle") or semantics.get("group_item_title")),
        exact_text(semantics.get("yes_sub_title")),
    ]
    patterns = (
        (r"\b(?:at least|no less than)\s*(-?\d+(?:\.\d+)?)\b", "gte"),
        (r"\b(?:above|over|greater than|more than)\s*(-?\d+(?:\.\d+)?)\b", "gt"),
        (r"\b(?:at most|no more than)\s*(-?\d+(?:\.\d+)?)\b", "lte"),
        (r"\b(?:below|under|less than)\s*(-?\d+(?:\.\d+)?)\b", "lt"),
        (r"\b(-?\d+(?:\.\d+)?)\s*\+\b", "gte"),
    )
    for value in raw_values:
        if not value:
            continue
        for pattern, operator in patterns:
            match = re.search(pattern, value)
            if match:
                normalized = decimal_text(match.group(1))
                if normalized is not None:
                    return operator, normalized

    floor = decimal_text(row.get("floor_strike"))
    cap = decimal_text(row.get("cap_strike"))
    if floor is not None and cap is None:
        return "gte", floor
    if cap is not None and floor is None:
        return "lte", cap
    return None

def misc_structured_signature(row: Dict[str, Any]) -> Optional[str]:
    event_title = str(row.get("event_title") or "")
    market_title = str(row.get("market_title") or "")
    combined = f"{event_title} {market_title}"
    text = exact_text(combined)

    # Diagnostics-only catch for ISM Manufacturing PMI thresholds. This stays
    # out of the production macro matcher until its delayed-release/fallback
    # semantics have been reviewed across venues.
    if re.search(r"\bism\b", text) and re.search(r"\bmanufacturing\b", text) and re.search(r"\bpmi\b", text):
        period = _misc_month_year(combined)
        threshold = _misc_threshold_operator_and_value(row)
        if period and threshold:
            operator, value = threshold
            return f"ism_manufacturing_pmi|{period}|{operator}|{value}"

    # Generic annual-pandemic proposition only. Disease-specific markets such
    # as Ebola/Hantavirus are deliberately not collapsed into "any disease".
    normalized_event = exact_text(event_title).strip(" ?")
    normalized_market = exact_text(market_title).strip(" ?")
    generic_titles = {normalized_event, normalized_market}
    for candidate in generic_titles:
        match = re.fullmatch(r"(?:new )?pandemic in (20\d{2})", candidate)
        if match:
            return f"pandemic_any_disease|{match.group(1)}"

    return None


def generic_contract_identity_for_row(row: Dict[str, Any]) -> Optional[str]:
    identity = generic_structured_contract_identity(row)
    if identity:
        return identity

    # Election event scope must outrank a misleading child-market title.
    # Polymarket negative-risk event rows can expose candidate-looking child
    # titles even when the parent event resolves a numeric margin-of-victory
    # proposition. Keep those rows out of candidate-winner matching.
    event_text = exact_text(row.get("event_title"))
    if re.search(r"\bmargin of victory\b", event_text):
        return "election_scope|margin_of_victory"

    semantics = as_json(row.get("contract_semantics"), dict, {})
    raw_contract_text = " ".join(
        str(value)
        for value in (
            semantics.get("yes_sub_title"),
            semantics.get("subtitle"),
            row.get("market_title"),
        )
        if value not in (None, "")
    )
    contract_text = exact_text(generic_strip_calendar_phrases(raw_contract_text))
    title_identity = title_contract_identity(contract_text)
    if title_identity and title_identity.startswith("threshold|"):
        return title_identity

    # A numeric/comparator proposition must never silently fall back to a
    # boolean identity. If we cannot prove its threshold semantics, skip it.
    threshold_language = re.search(
        r"\b(above|below|over|under|at least|at most|more than|less than|"
        r"greater than|between|exactly|reach|reaches|reached|hit|hits|"
        r"price of|trade at|trades at)\b|[<>]=?",
        contract_text,
    )
    if threshold_language and re.search(r"\d", contract_text):
        return None

    combined = f"{row.get('event_title') or ''} {row.get('market_title') or ''}"
    actions = generic_action_signature(combined)
    if actions:
        return "boolean|yes|action:" + ",".join(actions)
    return "boolean|yes"


def generic_candidate_text(row: Dict[str, Any]) -> str:
    event_title = str(row.get("event_title") or "")
    market_title = str(row.get("market_title") or "")
    return generic_normalize_match_text(f"{event_title} {market_title}")


def prepare_generic_candidate(
    row: Dict[str, Any],
    selected_groups: Set[str],
    reference_time: datetime,
) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
    if not generic_row_is_open(row, reference_time):
        return None, "notOpen"
    if not generic_yes_no_outcomes(row):
        return None, "nonBinary"

    company_signature = company_structured_signature(row)
    misc_signature = None if company_signature else misc_structured_signature(row)
    group = (
        "companies"
        if company_signature
        else ("misc" if misc_signature else generic_group_for_row(row))
    )
    if group is None:
        return None, "specializedFamily"
    if group not in selected_groups:
        return None, "outsideSelectedGroups"

    crypto_signature = (
        crypto_structured_signature(row)
        if group == "crypto"
        else None
    )
    contract_identity = (
        f"crypto_structured|{crypto_signature}"
        if crypto_signature
        else (
            f"company_structured|{company_signature}"
            if company_signature
            else (
                f"misc_structured|{misc_signature}"
                if misc_signature
                else generic_contract_identity_for_row(row)
            )
        )
    )
    if not contract_identity:
        return None, "missingContractIdentity"

    normalized = generic_candidate_text(row)
    words = set(normalized.split())
    if len(words) < 2:
        return None, "tooFewSemanticWords"

    combined_raw = f"{row.get('event_title') or ''} {row.get('market_title') or ''}"
    return {
        "market_id": int(row["market_id"]),
        "event_id": int(row["event_id"]),
        "venue": str(row["venue"]),
        "group": group,
        "contract_identity": contract_identity,
        "normalized": normalized,
        "words": words,
        "numbers": generic_material_numbers(combined_raw),
        "actions": generic_action_signature(combined_raw),
        "negated": generic_negation_signature(combined_raw),
        "title_resolution_hint": generic_title_resolution_hint(combined_raw),
        "event_title": str(row.get("event_title") or ""),
        "market_title": str(row.get("market_title") or ""),
        "external_market_id": str(row.get("external_market_id") or ""),
        "crypto_signature": crypto_signature,
        "company_signature": company_signature,
        "misc_signature": misc_signature,
    }, None


def generic_pair_score(left: Dict[str, Any], right: Dict[str, Any]) -> Tuple[float, float, float, int]:
    left_words = left["words"]
    right_words = right["words"]
    shared = len(left_words & right_words)
    union = len(left_words | right_words)
    minimum = min(len(left_words), len(right_words))
    jaccard = shared / union if union else 0.0
    containment = shared / minimum if minimum else 0.0
    sequence = SequenceMatcher(
        None,
        left["normalized"],
        right["normalized"],
    ).ratio()
    score = (sequence * 0.45) + (jaccard * 0.35) + (containment * 0.20)
    return round(score, 6), jaccard, containment, shared


def build_generic_candidate_matches(
    cur: Any,
    selected_groups: Set[str],
) -> Tuple[List[GenericCandidateMatch], Dict[str, Any]]:
    reference_time = datetime.now(timezone.utc)
    compact_sql = """
        SELECT
            id AS market_id,
            venue,
            event_catalog_id AS event_id,
            external_market_id,
            event_title,
            market_title,
            category,
            market_type,
            sports_market_type,
            venue_status,
            resolution_time,
            close_time,
            accepting_orders,
            line_value,
            floor_strike,
            cap_strike,
            functional_strike,
            rules_primary,
            rules_secondary,
            contract_semantics,
            outcomes
        FROM public.prediction_market_catalog
        WHERE venue = %s
          AND status = 'active'
    """

    rejection_counts: Counter = Counter()
    eligible_by_venue: Counter = Counter()
    eligible_by_group: Dict[str, Counter] = defaultdict(Counter)

    kalshi_rows: List[Dict[str, Any]] = []
    cur.execute(compact_sql, ("kalshi",))
    while True:
        batch = cur.fetchmany(5000)
        if not batch:
            break
        for raw in batch:
            prepared, reason = prepare_generic_candidate(
                raw, selected_groups, reference_time
            )
            if prepared is not None:
                kalshi_rows.append(prepared)
                eligible_by_venue["kalshi"] += 1
                eligible_by_group[prepared["group"]]["kalshi"] += 1
            elif reason not in {"outsideSelectedGroups", "specializedFamily"}:
                rejection_counts[f"kalshi:{reason}"] += 1

    word_frequency: Counter = Counter()
    exact_index: Dict[Tuple[str, str, str], List[Dict[str, Any]]] = defaultdict(list)
    crypto_index: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
    company_index: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
    misc_index: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
    for row in kalshi_rows:
        for word in row["words"]:
            word_frequency[(row["group"], row["contract_identity"], word)] += 1
        exact_index[(row["group"], row["contract_identity"], row["normalized"])].append(row)
        if row.get("crypto_signature"):
            crypto_index[row["crypto_signature"]].append(row)
        if row.get("company_signature"):
            company_index[row["company_signature"]].append(row)
        if row.get("misc_signature"):
            misc_index[row["misc_signature"]].append(row)

    word_index: Dict[Tuple[str, str, str], List[Dict[str, Any]]] = defaultdict(list)
    for row in kalshi_rows:
        for word in row["words"]:
            frequency = word_frequency[(row["group"], row["contract_identity"], word)]
            if 0 < frequency <= GENERIC_MAX_WORD_FREQUENCY:
                word_index[(row["group"], row["contract_identity"], word)].append(row)

    candidates: List[Tuple[float, int, Dict[str, Any], Dict[str, Any]]] = []
    candidate_pair_count = 0
    poly_scanned = 0
    cur.execute(compact_sql, ("polymarket",))
    while True:
        batch = cur.fetchmany(5000)
        if not batch:
            break
        for raw in batch:
            poly_scanned += 1
            poly, reason = prepare_generic_candidate(
                raw, selected_groups, reference_time
            )
            if poly is None:
                if reason not in {"outsideSelectedGroups", "specializedFamily"}:
                    rejection_counts[f"polymarket:{reason}"] += 1
                continue

            eligible_by_venue["polymarket"] += 1
            eligible_by_group[poly["group"]]["polymarket"] += 1

            if poly.get("crypto_signature"):
                for kalshi in crypto_index.get(poly["crypto_signature"], []):
                    candidate_pair_count += 1
                    candidates.append((
                        1.0,
                        len(poly["words"] & kalshi["words"]),
                        poly,
                        kalshi,
                    ))
                # Structured crypto candidates deliberately bypass generic
                # lexical/number equality. Exact settlement equivalence is
                # still enforced later by prediction_market_settlement.py.
                continue

            if poly.get("company_signature"):
                for kalshi in company_index.get(poly["company_signature"], []):
                    candidate_pair_count += 1
                    candidates.append((
                        1.0,
                        len(poly["words"] & kalshi["words"]),
                        poly,
                        kalshi,
                    ))
                # Same apparent company proposition + normalized cutoff/event
                # is only a candidate. The companies-aware settlement verifier
                # still compares trigger, source, participant, fallback, etc.
                continue

            if poly.get("misc_signature"):
                for kalshi in misc_index.get(poly["misc_signature"], []):
                    candidate_pair_count += 1
                    candidates.append((
                        1.0,
                        len(poly["words"] & kalshi["words"]),
                        poly,
                        kalshi,
                    ))
                # Diagnostics-only structured misc candidates bypass lexical
                # thresholds, but still face the misc-aware settlement gate.
                continue

            exact_rows = exact_index.get(
                (poly["group"], poly["contract_identity"], poly["normalized"]),
                [],
            )
            candidate_counts: Counter = Counter()
            candidate_rows: Dict[int, Dict[str, Any]] = {}
            for row in exact_rows:
                candidate_rows[row["market_id"]] = row
                candidate_counts[row["market_id"]] += GENERIC_MAX_INDEX_WORDS

            rare_words = sorted(
                (
                    word
                    for word in poly["words"]
                    if 0
                    < word_frequency[(poly["group"], poly["contract_identity"], word)]
                    <= GENERIC_MAX_WORD_FREQUENCY
                ),
                key=lambda word: word_frequency[
                    (poly["group"], poly["contract_identity"], word)
                ],
            )[:GENERIC_MAX_INDEX_WORDS]

            for word in rare_words:
                for row in word_index.get(
                    (poly["group"], poly["contract_identity"], word),
                    [],
                ):
                    candidate_rows[row["market_id"]] = row
                    candidate_counts[row["market_id"]] += 1

            for kalshi_id, rare_shared in candidate_counts.items():
                kalshi = candidate_rows[kalshi_id]
                exact_match = poly["normalized"] == kalshi["normalized"]
                if not exact_match and rare_shared < GENERIC_MIN_SHARED_WORDS:
                    continue
                if poly["numbers"] != kalshi["numbers"]:
                    continue
                if poly["negated"] != kalshi["negated"]:
                    continue
                if (
                    poly["title_resolution_hint"] is not None
                    and kalshi["title_resolution_hint"] is not None
                    and poly["title_resolution_hint"] != kalshi["title_resolution_hint"]
                ):
                    continue
                if poly["actions"] != kalshi["actions"]:
                    # An exact normalized proposition may have no action parsing
                    # differences; otherwise action disagreement is a hard reject.
                    if not exact_match:
                        continue

                score, jaccard, containment, shared_words = generic_pair_score(
                    poly, kalshi
                )
                if not exact_match and (
                    shared_words < GENERIC_MIN_SHARED_WORDS
                    or jaccard < GENERIC_MIN_JACCARD
                    or containment < GENERIC_MIN_CONTAINMENT
                    or score < GENERIC_MIN_SCORE
                ):
                    continue

                candidate_pair_count += 1
                candidates.append((
                    1.0 if exact_match else score,
                    shared_words,
                    poly,
                    kalshi,
                ))

    by_poly: Dict[int, List[Tuple[float, int, Dict[str, Any], Dict[str, Any]]]] = defaultdict(list)
    by_kalshi: Dict[int, List[Tuple[float, int, Dict[str, Any], Dict[str, Any]]]] = defaultdict(list)
    for row in candidates:
        by_poly[row[2]["market_id"]].append(row)
        by_kalshi[row[3]["market_id"]].append(row)

    def unique_best(rows: Sequence[Tuple[float, int, Dict[str, Any], Dict[str, Any]]]) -> Optional[Tuple[float, int, Dict[str, Any], Dict[str, Any]]]:
        if not rows:
            return None
        ordered = sorted(rows, key=lambda item: (item[0], item[1]), reverse=True)
        if len(ordered) > 1:
            first = ordered[0]
            second = ordered[1]
            if abs(first[0] - second[0]) < GENERIC_UNIQUE_MARGIN:
                return None
        return ordered[0]

    best_poly = {key: unique_best(rows) for key, rows in by_poly.items()}
    best_kalshi = {key: unique_best(rows) for key, rows in by_kalshi.items()}

    matches: List[GenericCandidateMatch] = []
    samples: List[Dict[str, Any]] = []
    for row in candidates:
        score, shared_words, poly, kalshi = row
        if best_poly.get(poly["market_id"]) != row:
            continue
        if best_kalshi.get(kalshi["market_id"]) != row:
            continue
        match = GenericCandidateMatch(
            polymarket_market_id=poly["market_id"],
            kalshi_market_id=kalshi["market_id"],
            polymarket_event_id=poly["event_id"],
            kalshi_event_id=kalshi["event_id"],
            market_group=poly["group"],
            contract_identity=poly["contract_identity"],
            score=score,
            shared_words=shared_words,
            match_method=(
                "crypto_structured_semantic"
                if poly.get("crypto_signature")
                and poly.get("crypto_signature") == kalshi.get("crypto_signature")
                else (
                    "company_structured_semantic"
                    if poly.get("company_signature")
                    and poly.get("company_signature") == kalshi.get("company_signature")
                    else (
                        "misc_structured_semantic"
                        if poly.get("misc_signature")
                        and poly.get("misc_signature") == kalshi.get("misc_signature")
                        else (
                            "generic_exact_normalized_title"
                            if poly["normalized"] == kalshi["normalized"]
                            else "generic_mutual_unique_semantic"
                        )
                    )
                )
            ),
        )
        matches.append(match)
        if len(samples) < 30:
            samples.append({
                "marketGroup": match.market_group,
                "score": match.score,
                "sharedWords": match.shared_words,
                "contractIdentity": match.contract_identity,
                "polymarketMarketId": poly["external_market_id"],
                "polymarketEventTitle": poly["event_title"],
                "polymarketTitle": poly["market_title"],
                "kalshiMarketId": kalshi["external_market_id"],
                "kalshiEventTitle": kalshi["event_title"],
                "kalshiTitle": kalshi["market_title"],
                "matchMethod": match.match_method,
                "cryptoSignature": poly.get("crypto_signature"),
                "companySignature": poly.get("company_signature"),
                "miscSignature": poly.get("misc_signature"),
            })

    matches_by_group = Counter(match.market_group for match in matches)
    crypto_structured_matches = [
        match for match in matches
        if match.match_method == "crypto_structured_semantic"
    ]
    crypto_structured_samples = [
        sample for sample in samples
        if sample.get("matchMethod") == "crypto_structured_semantic"
    ]
    company_structured_matches = [
        match for match in matches
        if match.match_method == "company_structured_semantic"
    ]
    company_structured_samples = [
        sample for sample in samples
        if sample.get("matchMethod") == "company_structured_semantic"
    ]
    misc_structured_matches = [
        match for match in matches
        if match.match_method == "misc_structured_semantic"
    ]
    misc_structured_samples = [
        sample for sample in samples
        if sample.get("matchMethod") == "misc_structured_semantic"
    ]
    return matches, {
        "genericSelectedGroups": sorted(selected_groups),
        "genericPolymarketEligible": eligible_by_venue["polymarket"],
        "genericKalshiEligible": eligible_by_venue["kalshi"],
        "genericEligibleByGroup": {
            group: dict(sorted(counts.items()))
            for group, counts in sorted(eligible_by_group.items())
        },
        "genericSemanticCandidatePairs": candidate_pair_count,
        "genericMutualUniqueMatches": len(matches),
        "genericMatchesByGroup": dict(sorted(matches_by_group.items())),
        "genericAmbiguousPolymarketMarkets": sum(
            1 for rows in by_poly.values() if rows and unique_best(rows) is None
        ),
        "genericAmbiguousKalshiMarkets": sum(
            1 for rows in by_kalshi.values() if rows and unique_best(rows) is None
        ),
        "genericRejections": dict(sorted(rejection_counts.items())),
        "genericCandidateSamples": samples,
        "genericCryptoStructuredCandidatePairs": sum(
            1
            for row in candidates
            if row[2].get("crypto_signature")
            and row[2].get("crypto_signature") == row[3].get("crypto_signature")
        ),
        "genericCryptoStructuredMatches": len(crypto_structured_matches),
        "genericCryptoStructuredSamples": crypto_structured_samples[:30],
        "genericCompanyStructuredCandidatePairs": sum(
            1
            for row in candidates
            if row[2].get("company_signature")
            and row[2].get("company_signature") == row[3].get("company_signature")
        ),
        "genericCompanyStructuredMatches": len(company_structured_matches),
        "genericCompanyStructuredSamples": company_structured_samples[:30],
        "genericMiscStructuredMatches": len(misc_structured_matches),
        "genericMiscStructuredSamples": misc_structured_samples[:30],
        "genericMatcherMode": "diagnostics_only_until_reviewed",
    }


def build_generic_contract_pairs(
    candidate_matches: Sequence[GenericCandidateMatch],
    markets: Dict[int, Market],
) -> Tuple[List[Tuple[ExactContract, ExactContract]], Dict[str, Any]]:
    pairs: List[Tuple[ExactContract, ExactContract]] = []
    skipped = Counter()
    samples: List[Dict[str, Any]] = []

    for match in candidate_matches:
        poly_market = markets.get(match.polymarket_market_id)
        kalshi_market = markets.get(match.kalshi_market_id)
        if poly_market is None or kalshi_market is None:
            skipped["missingHydratedMarket"] += 1
            continue
        poly_binary = yes_no_outcomes(poly_market)
        kalshi_binary = yes_no_outcomes(kalshi_market)
        if not poly_binary or not kalshi_binary:
            skipped["nonBinaryAfterHydration"] += 1
            continue

        poly_yes, poly_no = poly_binary
        kalshi_yes, kalshi_no = kalshi_binary
        event_identity = (
            f"generic|{match.market_group}|"
            f"{poly_market.external_market_id}|{kalshi_market.external_market_id}"
        )
        scheduled = iso_value(
            poly_market.resolution_time
            or kalshi_market.resolution_time
            or poly_market.close_time
            or kalshi_market.close_time
        )
        poly_contract = ExactContract(
            poly_market.id,
            poly_market.venue,
            event_identity,
            match.contract_identity,
            match.market_group,
            poly_market.event.title,
            poly_market.market_title,
            scheduled,
            poly_yes["key"],
            poly_no["key"],
            poly_yes["label"],
            poly_no["label"],
            match.match_method,
        )
        kalshi_contract = ExactContract(
            kalshi_market.id,
            kalshi_market.venue,
            event_identity,
            match.contract_identity,
            match.market_group,
            kalshi_market.event.title,
            kalshi_market.market_title,
            scheduled,
            kalshi_yes["key"],
            kalshi_no["key"],
            kalshi_yes["label"],
            kalshi_no["label"],
            match.match_method,
        )
        pairs.append((poly_contract, kalshi_contract))
        if len(samples) < 20:
            samples.append({
                "marketGroup": match.market_group,
                "score": match.score,
                "contractIdentity": match.contract_identity,
                "polymarketMarketId": poly_market.external_market_id,
                "polymarketTitle": poly_market.market_title,
                "kalshiMarketId": kalshi_market.external_market_id,
                "kalshiTitle": kalshi_market.market_title,
            })

    return pairs, {
        "genericContractPairsBeforeSettlement": len(pairs),
        "genericHydrationSkips": dict(sorted(skipped.items())),
        "genericHydratedPairSamples": samples,
    }

def load_catalog(
        *,
        include_sports: bool = True,
        include_macro: bool = True,
        include_weather: bool = True,
        include_generic: bool = False,
        generic_groups: Optional[Set[str]] = None,
) -> Tuple[
    Dict[int, Event],
    Dict[int, Market],
    Dict[int, List[Market]],
    Dict[str, int],
    List[GenericCandidateMatch],
    Dict[str, Any],
]:
    if not (
            include_sports
            or include_macro
            or include_weather
            or include_generic
    ):
        raise ValueError(
            "At least one catalog group must be requested."
        )

    print("Loading active native event index.")

    with get_db_connection_dict() as conn:
        with conn.cursor() as cur:
            cur.execute("SET LOCAL statement_timeout = '120s'")

            cur.execute(
                """
                SELECT venue, COUNT(*) AS market_count
                FROM public.prediction_market_catalog
                WHERE status = 'active'
                  AND venue IN ('polymarket', 'kalshi')
                GROUP BY venue
                """
            )
            venue_counts = {"polymarket": 0, "kalshi": 0}
            for row in cur.fetchall():
                venue_counts[row["venue"]] = row["market_count"]

            event_index_rows: List[Dict[str, Any]] = []
            for venue in ("polymarket", "kalshi"):
                cur.execute(
                    """
                    SELECT id, venue, title, category, event_type
                    FROM public.prediction_market_events
                    WHERE venue = %s
                      AND status = 'active'
                    """,
                    (venue,),
                )
                event_index_rows.extend(cur.fetchall())

            sports_event_ids: Set[int] = set()
            macro_event_ids: Set[int] = set()
            weather_event_ids: Set[int] = set()

            for row in event_index_rows:
                classification = exact_text(
                    f"{row['category'] or ''} {row['event_type'] or ''} "
                    f"{row['title'] or ''}"
                )
                classification_words = set(classification.split())

                if include_sports and any(
                        term in classification_words
                        for term in SPORTS_EVENT_TERMS
                ):
                    sports_event_ids.add(row["id"])

                if include_macro and re.search(
                        MACRO_CANDIDATE_PATTERN,
                        classification,
                ):
                    macro_event_ids.add(
                        row["id"]
                    )

                if include_weather and re.search(
                        WEATHER_CANDIDATE_PATTERN,
                        classification,
                ):
                    weather_event_ids.add(
                        row["id"]
                    )

            def integer_batches(
                    values: Sequence[int],
            ) -> Iterable[Sequence[int]]:
                for index in range(
                        0,
                        len(values),
                        CATALOG_QUERY_BATCH_SIZE,
                ):
                    yield values[index:index + CATALOG_QUERY_BATCH_SIZE]

            generic_candidate_matches: List[GenericCandidateMatch] = []
            generic_diagnostics: Dict[str, Any] = {}
            if include_generic:
                selected_generic_groups = set(
                    generic_groups or GENERIC_MARKET_GROUPS
                )
                invalid_groups = selected_generic_groups - set(
                    GENERIC_MARKET_GROUPS
                )
                if invalid_groups:
                    raise ValueError(
                        "Unknown generic market groups: "
                        + ", ".join(sorted(invalid_groups))
                    )
                print(
                    "Building conservative generic cross-venue candidates for: "
                    + ", ".join(sorted(selected_generic_groups))
                )
                (
                    generic_candidate_matches,
                    generic_diagnostics,
                ) = build_generic_candidate_matches(
                    cur,
                    selected_generic_groups,
                )

            generic_event_ids = {
                event_id
                for match in generic_candidate_matches
                for event_id in (
                    match.polymarket_event_id,
                    match.kalshi_event_id,
                )
            }
            candidate_event_ids = sorted(
                sports_event_ids
                | macro_event_ids
                | weather_event_ids
                | generic_event_ids
            )
            print(
                "Native event candidates: "
                f"{len(sports_event_ids)} sports, "
                f"{len(macro_event_ids)} macro, "
                f"{len(weather_event_ids)} weather, "
                f"{len(generic_event_ids)} generic matched-event rows"
            )

            event_rows: List[Dict[str, Any]] = []
            for batch in integer_batches(candidate_event_ids):
                cur.execute(
                    """
                    SELECT
                        id AS event_id,
                        venue AS event_venue,
                        external_event_id AS event_external_id,
                        external_series_id AS event_series_id,
                        title AS native_event_title,
                        category AS event_category,
                        event_type,
                        venue_status AS event_venue_status,
                        start_time,
                        end_time,
                        close_time AS event_close_time,
                        settlement_time AS event_settlement_time,
                        native_game_id AS event_native_game_id,
                        milestone_id,
                        source_id AS event_source_id,
                        source_ids AS event_source_ids,
                        details AS event_details,
                        raw_payload AS event_raw_payload
                    FROM public.prediction_market_events
                    WHERE id = ANY(%s)
                      AND status = 'active'
                    """,
                    (list(batch),),
                )
                event_rows.extend(cur.fetchall())

            market_rows_by_id: Dict[int, Dict[str, Any]] = {}
            market_columns = """
                    SELECT
                        id AS market_id,
                        venue AS market_venue,
                        event_catalog_id AS event_id,
                        external_market_id,
                        external_event_id,
                        external_series_id,
                        event_title AS market_event_title,
                        market_title,
                        market_slug,
                        category AS market_category,
                        market_type,
                        sports_market_type,
                        venue_status AS market_venue_status,
                        resolution_time,
                        event_start_time,
                        close_time AS market_close_time,
                        settlement_time AS market_settlement_time,
                        rules_url,
                        rules_primary,
                        rules_secondary,
                        accepting_orders,
                        primary_participant_key,
                        line_value,
                        floor_strike,
                        cap_strike,
                        functional_strike,
                        custom_strike,
                        contract_semantics,
                        outcomes,
                        raw_payload,
                        liquidity,
                        volume_24h,
                        total_volume,
                        open_interest,
                        updated_at
                    FROM public.prediction_market_catalog
                """

            two_participant_sports_event_ids: List[int] = []
            if include_sports:
                for batch in integer_batches(sorted(sports_event_ids)):
                    cur.execute(
                        """
                        SELECT link.event_id
                        FROM public.prediction_market_event_entities AS link
                        WHERE link.event_id = ANY(%s)
                          AND link.role IN (
                              'home', 'away', 'participant', 'subject', 'unknown'
                          )
                        GROUP BY link.event_id
                        HAVING COUNT(DISTINCT link.entity_id) = 2
                        """,
                        (list(batch),),
                    )
                    two_participant_sports_event_ids.extend(
                        row["event_id"] for row in cur.fetchall()
                    )

                print(
                    "Native two-participant sports events: "
                    f"{len(two_participant_sports_event_ids)}"
                )
                print("Loading full-game sports contract candidates in batches...")

                for batch in integer_batches(
                        sorted(two_participant_sports_event_ids)
                ):
                    cur.execute(
                        market_columns
                        + """
                            WHERE event_catalog_id = ANY(%s)
                              AND status = 'active'
                              AND (
                                  LOWER(COALESCE(sports_market_type, '')) IN (
                                      'winner', 'game winner', 'match winner',
                                      'fight winner', 'moneyline', 'money line',
                                      'moneyline winner', 'head to head', 'h2h'
                                  )
                                  OR LOWER(COALESCE(market_title, '')) ~
                                     '(^|[^a-z])(win|wins|winner|moneyline|beat|defeat)([^a-z]|$)'
                              )
                            """,
                        (list(batch),),
                    )
                    for row in cur.fetchall():
                        market_rows_by_id[row["market_id"]] = row

            if include_macro:
                print(
                    "Loading binary macro contract candidates in batches..."
                )
                for batch in integer_batches(
                        sorted(macro_event_ids)
                ):
                    cur.execute(
                        market_columns
                        + """
                            WHERE event_catalog_id = ANY(%s)
                              AND status = 'active'
                            """,
                        (list(batch),),
                    )
                    for row in cur.fetchall():
                        market_rows_by_id[
                            row["market_id"]
                        ] = row

            if include_weather:
                print(
                    "Loading binary weather contract candidates in batches..."
                )
                for batch in integer_batches(
                        sorted(weather_event_ids)
                ):
                    cur.execute(
                        market_columns
                        + """
                            WHERE event_catalog_id = ANY(%s)
                              AND status = 'active'
                            """,
                        (list(batch),),
                    )
                    for row in cur.fetchall():
                        market_rows_by_id[
                            row["market_id"]
                        ] = row

            if include_generic and generic_candidate_matches:
                generic_market_ids = sorted(
                    {
                        market_id
                        for match in generic_candidate_matches
                        for market_id in (
                            match.polymarket_market_id,
                            match.kalshi_market_id,
                        )
                    }
                )
                print(
                    "Loading full rows for "
                    f"{len(generic_market_ids)} generic candidate markets..."
                )
                for batch in integer_batches(generic_market_ids):
                    cur.execute(
                        market_columns
                        + """
                            WHERE id = ANY(%s)
                              AND status = 'active'
                            """,
                        (list(batch),),
                    )
                    for row in cur.fetchall():
                        market_rows_by_id[row["market_id"]] = row

            market_rows = list(
                market_rows_by_id.values()
            )
            used_sports_event_ids = sorted(
                {
                    row["event_id"]
                    for row in market_rows
                    if row["event_id"] in sports_event_ids
                }
            )

            entity_rows: List[Dict[str, Any]] = []
            if include_sports:
                print("Loading native participant links in batches...")
                for batch in integer_batches(used_sports_event_ids):
                    cur.execute(
                        """
                        SELECT
                            link.event_id,
                            link.role,
                            entity.id AS entity_id,
                            entity.venue,
                            entity.external_entity_id,
                            entity.name,
                            entity.entity_type,
                            entity.league,
                            entity.abbreviation,
                            entity.alias,
                            entity.source_id,
                            entity.source_ids,
                            canonical.canonical_entity_key,
                            canonical.match_method AS canonical_match_method
                        FROM public.prediction_market_event_entities AS link
                        JOIN public.prediction_market_entities AS entity
                          ON entity.id = link.entity_id
                        LEFT JOIN public.prediction_market_entity_links AS canonical
                          ON canonical.entity_id = entity.id
                        WHERE link.event_id = ANY(%s)
                        """,
                        (list(batch),),
                    )
                    entity_rows.extend(cur.fetchall())

    events: Dict[int, Event] = {}
    markets: Dict[int, Market] = {}
    markets_by_event: Dict[int, List[Market]] = defaultdict(list)

    for row in event_rows:
        event = Event(
            id=row["event_id"],
            venue=row["event_venue"],
            external_event_id=str(row["event_external_id"]),
            external_series_id=row["event_series_id"],
            title=row["native_event_title"] or "",
            category=row["event_category"],
            event_type=row["event_type"],
            venue_status=row["event_venue_status"],
            start_time=parse_datetime(row["start_time"]),
            end_time=parse_datetime(row["end_time"]),
            close_time=parse_datetime(row["event_close_time"]),
            settlement_time=parse_datetime(row["event_settlement_time"]),
            native_game_id=row["event_native_game_id"],
            milestone_id=row["milestone_id"],
            source_id=row["event_source_id"],
            source_ids=as_json(row["event_source_ids"], dict, {}),
            details=as_json(row["event_details"], dict, {}),
            raw=as_json(row["event_raw_payload"], dict, {}),
        )
        events[event.id] = event

    for row in market_rows:
        event = events.get(row["event_id"])
        if not event:
            continue

        market = Market(
            id=row["market_id"],
            venue=row["market_venue"],
            event=event,
            external_market_id=str(row["external_market_id"]),
            external_event_id=(
                str(row["external_event_id"])
                if row["external_event_id"]
                else None
            ),
            external_series_id=row["external_series_id"],
            event_title=row["market_event_title"] or event.title,
            market_title=row["market_title"] or "",
            market_slug=row["market_slug"],
            category=row["market_category"],
            market_type=row["market_type"],
            sports_market_type=row["sports_market_type"],
            venue_status=row["market_venue_status"],
            resolution_time=parse_datetime(row["resolution_time"]),
            event_start_time=parse_datetime(row["event_start_time"]),
            close_time=parse_datetime(row["market_close_time"]),
            settlement_time=parse_datetime(row["market_settlement_time"]),
            rules_url=row["rules_url"],
            rules_primary=row["rules_primary"],
            rules_secondary=row["rules_secondary"],
            accepting_orders=row["accepting_orders"],
            primary_participant_key=row["primary_participant_key"],
            line_value=row["line_value"],
            floor_strike=row["floor_strike"],
            cap_strike=row["cap_strike"],
            functional_strike=row["functional_strike"],
            custom_strike=as_json(row["custom_strike"], dict, {}),
            contract_semantics=as_json(row["contract_semantics"], dict, {}),
            outcomes=as_json(row["outcomes"], list, []),
            raw=as_json(row["raw_payload"], dict, {}),
            liquidity=as_float(row["liquidity"]),
            volume_24h=as_float(row["volume_24h"]),
            total_volume=as_float(row["total_volume"]),
            open_interest=as_float(row["open_interest"]),
            updated_at=parse_datetime(row["updated_at"]),
        )
        markets[market.id] = market
        markets_by_event[event.id].append(market)

    entities: Dict[int, Entity] = {}
    seen_event_entities: Set[Tuple[int, int, str]] = set()

    for row in entity_rows:
        entity = entities.get(row["entity_id"])
        if not entity:
            entity = Entity(
                id=row["entity_id"],
                venue=row["venue"],
                external_entity_id=str(row["external_entity_id"]),
                name=row["name"] or "",
                entity_type=row["entity_type"],
                league=row["league"],
                abbreviation=row["abbreviation"],
                alias=row["alias"],
                source_id=row["source_id"],
                source_ids=as_json(row["source_ids"], dict, {}),
                canonical_entity_key=row["canonical_entity_key"],
                canonical_match_method=row["canonical_match_method"],
            )
            entities[entity.id] = entity

        key = (row["event_id"], entity.id, row["role"])
        if key not in seen_event_entities and row["event_id"] in events:
            seen_event_entities.add(key)
            events[row["event_id"]].entities.append((entity, row["role"]))

    print(
        f"Catalog loaded: {len(events)} candidate events, "
        f"{len(markets)} candidate markets, "
        f"{len(entity_rows)} participant links"
    )
    return (
        events,
        markets,
        markets_by_event,
        venue_counts,
        generic_candidate_matches,
        generic_diagnostics,
    )
def prediction_snapshot_marker() -> Optional[str]:
    try:
        with get_db_connection_dict() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT id, finished_at, markets_seen
                    FROM public.prediction_market_ingest_runs
                    WHERE status = 'completed'
                    ORDER BY id DESC
                    LIMIT 1
                    """
                )
                row = cur.fetchone()
    except Exception:
        return None

    if not row:
        return None

    finished = iso_value(row.get("finished_at"))
    return f"{row.get('id')}:{finished}:{row.get('markets_seen')}"


def chunks(values: Sequence[str], size: int) -> Iterable[Sequence[str]]:
    for index in range(0, len(values), size):
        yield values[index:index + size]


def fetch_polymarket_books(token_ids: Sequence[str]) -> Dict[str, Dict[str, Any]]:
    unique_ids = list(dict.fromkeys(token_id for token_id in token_ids if token_id))
    books: Dict[str, Dict[str, Any]] = {}
    for batch in chunks(unique_ids, BOOK_BATCH_SIZE):
        batch_loaded = False
        for attempt in range(1, 4):
            try:
                response = session.post(
                    f"{POLYMARKET_CLOB_URL}/books",
                    json=[{"token_id": token_id} for token_id in batch],
                    timeout=REQUEST_TIMEOUT_SECONDS,
                )
                response.raise_for_status()
                payload = response.json()
                if isinstance(payload, list):
                    for book in payload:
                        if isinstance(book, dict) and book.get("asset_id"):
                            books[str(book["asset_id"])] = book
                    batch_loaded = True
                    break
            except (requests.RequestException, ValueError):
                if attempt < 3:
                    time.sleep(0.4 * attempt)

        if batch_loaded:
            continue

        for token_id in batch:
            try:
                response = session.get(
                    f"{POLYMARKET_CLOB_URL}/book",
                    params={"token_id": token_id},
                    timeout=REQUEST_TIMEOUT_SECONDS,
                )
                response.raise_for_status()
                book = response.json()
                if isinstance(book, dict) and book.get("asset_id"):
                    books[str(book["asset_id"])] = book
            except (requests.RequestException, ValueError):
                continue
    return books


def fetch_polymarket_fee_rates(
        token_ids: Sequence[str],
) -> Dict[str, float]:
    unique_token_ids = list(
        dict.fromkeys(
            str(token_id)
            for token_id in token_ids
            if token_id not in (None, "")
        )
    )

    rates: Dict[str, float] = {}
    rates_lock = threading.Lock()

    def load_token_rate(
            token_id: str,
    ) -> None:
        for attempt in range(1, 4):
            try:
                response = session.get(
                    (
                        f"{POLYMARKET_CLOB_URL}/"
                        f"fee-rate/{token_id}"
                    ),
                    timeout=REQUEST_TIMEOUT_SECONDS,
                )

                if response.status_code == 404:
                    return

                response.raise_for_status()
                payload = response.json()

                base_fee_bps = first_float(
                    payload.get("base_fee")
                    if isinstance(payload, dict)
                    else None
                )

                if (
                        base_fee_bps is None
                        or base_fee_bps < 0
                ):
                    return

                # The API returns basis points.
                # Example: 500 bps = 0.05.
                fee_rate = base_fee_bps / 10000.0

                with rates_lock:
                    rates[token_id] = fee_rate

                return

            except (
                    requests.RequestException,
                    ValueError,
            ):
                if attempt < 3:
                    time.sleep(0.25 * attempt)

    with ThreadPoolExecutor(
            max_workers=POLYMARKET_FEE_RATE_WORKERS
    ) as executor:
        futures = [
            executor.submit(
                load_token_rate,
                token_id,
            )
            for token_id in unique_token_ids
        ]

        for future in as_completed(futures):
            try:
                future.result()
            except Exception:
                continue

    return rates


def best_ask(book: Optional[Dict[str, Any]]) -> Tuple[Optional[float], Optional[float]]:
    levels = []
    for level in (book or {}).get("asks") or []:
        if not isinstance(level, dict):
            continue
        price = as_float(level.get("price"))
        size = as_float(level.get("size"))
        if price is not None and size is not None:
            levels.append((price, size))
    return min(levels, key=lambda row: row[0]) if levels else (None, None)


def best_kalshi_bid(
        payload: Dict[str, Any],
        side: str,
) -> Tuple[Optional[float], Optional[float]]:
    orderbook_fp = as_json(payload.get("orderbook_fp"), dict, {})
    fp_levels = orderbook_fp.get(f"{side}_dollars") or []
    levels: List[Tuple[float, float]] = []
    for level in fp_levels:
        if not isinstance(level, (list, tuple)) or len(level) < 2:
            continue
        price, size = as_float(level[0]), as_float(level[1])
        if price is not None and size is not None:
            levels.append((price, size))

    if not levels:
        legacy = as_json(payload.get("orderbook"), dict, {}).get(side) or []
        for level in legacy:
            if not isinstance(level, (list, tuple)) or len(level) < 2:
                continue
            price, size = as_float(level[0]), as_float(level[1])
            if price is not None and size is not None:
                levels.append((price / 100 if price > 1 else price, size))
    return max(levels, key=lambda row: row[0]) if levels else (None, None)


def fetch_one_kalshi_book(ticker: str) -> Tuple[str, Optional[Dict[str, Any]]]:
    for attempt in range(1, 4):
        try:
            response = requests.get(
                f"{KALSHI_API_URL}/markets/{ticker}/orderbook",
                params={"depth": 5},
                headers=dict(session.headers),
                timeout=REQUEST_TIMEOUT_SECONDS,
            )
            response.raise_for_status()
            payload = response.json()
            if not isinstance(payload, dict):
                return ticker, None

            yes_bid, yes_bid_size = best_kalshi_bid(payload, "yes")
            no_bid, no_bid_size = best_kalshi_bid(payload, "no")
            return ticker, {
                "yes_ask": None if no_bid is None else 1 - no_bid,
                "yes_ask_size": no_bid_size,
                "no_ask": None if yes_bid is None else 1 - yes_bid,
                "no_ask_size": yes_bid_size,
                "fetched_at": datetime.now(timezone.utc).isoformat(),
            }
        except (requests.RequestException, ValueError):
            if attempt == 3:
                return ticker, None
            time.sleep(0.4 * attempt)
    return ticker, None


def fetch_kalshi_books(tickers: Sequence[str]) -> Dict[str, Dict[str, Any]]:
    unique_tickers = list(dict.fromkeys(ticker for ticker in tickers if ticker))
    books: Dict[str, Dict[str, Any]] = {}
    if not unique_tickers:
        return books

    worker_count = min(KALSHI_BOOK_WORKERS, len(unique_tickers))
    with ThreadPoolExecutor(max_workers=worker_count) as executor:
        futures = {
            executor.submit(fetch_one_kalshi_book, ticker): ticker
            for ticker in unique_tickers
        }
        for future in as_completed(futures):
            ticker, book = future.result()
            if book:
                books[ticker] = book
    return books


def market_url(market: Market) -> str:
    if market.venue == "polymarket":
        event_slug = market.event.raw.get("slug")
        slug = event_slug or market.market_slug
        return f"https://polymarket.com/event/{slug}" if slug else "https://polymarket.com"

    # Kalshi's stable public resolver is ticker-based. The previous
    # /markets/{market_ticker} path is not a valid canonical deep link and can
    # land on Kalshi's generic error page. markets_by_ticker resolves the exact
    # contract without requiring Bullionaire to recreate Kalshi's changing slugs.
    ticker = str(market.external_market_id or "").strip()
    if not ticker:
        return "https://kalshi.com/browse"
    return f"https://kalshi.com/markets_by_ticker/{quote(ticker.lower(), safe='-')}"


def first_float(
        *values: Any,
) -> Optional[float]:
    for value in values:
        parsed = as_float(value)

        if parsed is not None:
            return parsed

    return None


def as_bool(value: Any) -> Optional[bool]:
    if isinstance(value, bool):
        return value

    if value in (None, ""):
        return None

    cleaned = str(value).strip().lower()

    if cleaned in {"true", "1", "yes"}:
        return True

    if cleaned in {"false", "0", "no"}:
        return False

    return None


def ceil_decimal(
        value: Decimal,
        increment: Decimal,
) -> Decimal:
    return (
            value / increment
    ).to_integral_value(
        rounding=ROUND_CEILING
    ) * increment


def effective_changes_by_key(
        rows: Sequence[Dict[str, Any]],
        key_name: str,
        reference_time: datetime,
) -> Dict[str, Dict[str, Any]]:
    selected: Dict[
        str,
        Tuple[datetime, Dict[str, Any]],
    ] = {}

    for row in rows:
        if not isinstance(row, dict):
            continue

        key = str(
            row.get(key_name) or ""
        ).strip()

        scheduled = parse_datetime(
            row.get("scheduled_ts")
        )

        if (
                not key
                or scheduled is None
                or scheduled > reference_time
        ):
            continue

        current = selected.get(key)

        if (
                current is None
                or scheduled > current[0]
        ):
            selected[key] = (
                scheduled,
                row,
            )

    return {
        key: row
        for key, (_, row)
        in selected.items()
    }


def fetch_kalshi_fee_configuration(
        reference_time: datetime,
) -> Dict[str, Any]:
    series_rows: List[Dict[str, Any]] = []
    event_rows: List[Dict[str, Any]] = []

    series_loaded = False
    events_loaded = False

    try:
        response = session.get(
            (
                f"{KALSHI_API_URL}/"
                "series/fee_changes"
            ),
            params={
                "show_historical": "true",
            },
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
        response.raise_for_status()

        payload = response.json()

        raw_rows = payload.get(
            "series_fee_change_arr",
            [],
        )

        if isinstance(raw_rows, list):
            series_rows = [
                row
                for row in raw_rows
                if isinstance(row, dict)
            ]

        series_loaded = True

    except (
            requests.RequestException,
            ValueError,
    ) as exc:
        print(
            "Could not load Kalshi series "
            f"fee configuration: {exc}"
        )

    try:
        cursor: Optional[str] = None

        while True:
            params: Dict[str, Any] = {
                "limit": 1000,
            }

            if cursor:
                params["cursor"] = cursor

            response = session.get(
                (
                    f"{KALSHI_API_URL}/"
                    "events/fee_changes"
                ),
                params=params,
                timeout=REQUEST_TIMEOUT_SECONDS,
            )
            response.raise_for_status()

            payload = response.json()

            page_rows = payload.get(
                "event_fee_changes",
                [],
            )

            if isinstance(page_rows, list):
                event_rows.extend(
                    row
                    for row in page_rows
                    if isinstance(row, dict)
                )

            cursor = str(
                payload.get("cursor") or ""
            ).strip() or None

            if not cursor:
                break

        events_loaded = True

    except (
            requests.RequestException,
            ValueError,
    ) as exc:
        print(
            "Could not load Kalshi event "
            f"fee configuration: {exc}"
        )

    return {
        "seriesLoaded": series_loaded,
        "eventsLoaded": events_loaded,
        "series": effective_changes_by_key(
            series_rows,
            "series_ticker",
            reference_time,
        ),
        "events": effective_changes_by_key(
            event_rows,
            "event_ticker",
            reference_time,
        ),
    }


def polymarket_taker_fee_for_quantity(
        market: Market,
        price: float,
        contracts: float,
) -> Tuple[Optional[float], str]:
    if contracts < 0:
        raise ValueError(
            "contracts must be non-negative"
        )

    raw = market.raw

    trading = as_json(
        raw.get("trading"),
        dict,
        {},
    )

    fees_enabled = as_bool(
        first_non_empty(
            raw.get("feesEnabled"),
            trading.get("feesEnabled"),
        )
    )

    fee_schedule = as_json(
        first_non_empty(
            raw.get("feeSchedule"),
            trading.get("feeSchedule"),
        ),
        dict,
        {},
    )

    rate = first_float(
        fee_schedule.get("rate"),
        raw.get("_livePolymarketFeeRate"),
    )

    exponent = first_float(
        fee_schedule.get("exponent")
    )

    if fees_enabled is False:
        return (
            0.0,
            "polymarket-market-fee-schedule-authoritative",
        )

    if rate is None:
        return (
            None,
            "polymarket-fee-metadata-unavailable",
        )

    if rate < 0 or rate > 1:
        return (
            None,
            "polymarket-invalid-fee-rate",
        )

    if (
            exponent is not None
            and abs(exponent - 1.0) > 0.000001
    ):
        return (
            None,
            "polymarket-unsupported-fee-curve",
        )

    fee = (
            contracts
            * rate
            * price
            * (1.0 - price)
    )

    # Polymarket rounds fees to five decimal places.
    return (
        round(fee, 5),
        "polymarket-market-fee-schedule-authoritative",
    )

def polymarket_taker_fee_per_contract(
        market: Market,
        price: float,
) -> Tuple[Optional[float], str]:
    return polymarket_taker_fee_for_quantity(market, price, 1.0)


def kalshi_taker_fee_for_quantity(
        market: Market,
        price: float,
        contracts: float,
        configuration: Dict[str, Any],
) -> Tuple[Optional[float], str]:
    if contracts < 0:
        raise ValueError("contracts must be non-negative")

    if not (
            configuration.get("seriesLoaded")
            and configuration.get("eventsLoaded")
    ):
        return None, "kalshi-fee-metadata-unavailable"

    series_ticker = str(
        first_non_empty(
            market.external_series_id,
            market.event.external_series_id,
        )
        or ""
    ).strip()

    event_ticker = str(
        first_non_empty(
            market.external_event_id,
            market.event.external_event_id,
        )
        or ""
    ).strip()

    series_change = configuration.get(
        "series",
        {},
    ).get(
        series_ticker,
        {},
    )

    event_change = configuration.get(
        "events",
        {},
    ).get(
        event_ticker,
        {},
    )

    series_multiplier = first_float(
        series_change.get("fee_multiplier")
    )

    if series_multiplier is None:
        series_multiplier = 1.0

    series_fee_type = str(
        series_change.get("fee_type")
        or "quadratic"
    ).strip().lower()

    override_multiplier = first_float(
        event_change.get(
            "fee_multiplier_override"
        )
    )

    override_fee_type_raw = event_change.get(
        "fee_type_override"
    )

    fee_multiplier = (
        override_multiplier
        if override_multiplier is not None
        else series_multiplier
    )

    fee_type = (
        str(override_fee_type_raw).strip().lower()
        if override_fee_type_raw not in (None, "")
        else series_fee_type
    )

    # Both of these use the same taker formula when Bullionaire
    # crosses an existing ask. The second type additionally permits
    # maker fees for resting orders, which are not used by this route.
    supported_taker_fee_types = {
        "quadratic",
        "quadratic_with_maker_fees",
    }

    if fee_type not in supported_taker_fee_types:
        return (
            None,
            "kalshi-unsupported-fee-type:"
            f"{fee_type or 'unknown'}",
        )

    decimal_price = Decimal(str(price))
    decimal_contracts = Decimal(str(contracts))

    unrounded_fee = (
            Decimal(str(fee_multiplier))
            * KALSHI_STANDARD_TAKER_RATE
            * decimal_contracts
            * decimal_price
            * (
                    Decimal("1")
                    - decimal_price
            )
    )

    rounded_trade_fee = ceil_decimal(
        unrounded_fee,
        KALSHI_FEE_INCREMENT,
    )

    return (
        float(rounded_trade_fee),
        (
            "kalshi-live-"
            f"{fee_type}-"
            "series-event-fee-configuration"
        ),
    )


def kalshi_taker_fee_per_contract(
        market: Market,
        price: float,
        configuration: Dict[str, Any],
) -> Tuple[Optional[float], str]:
    return kalshi_taker_fee_for_quantity(
        market,
        price,
        1.0,
        configuration,
    )


def rounded_or_none(
        value: Any,
        digits: int = 6,
) -> Optional[float]:
    parsed = as_float(value)
    return None if parsed is None else round(parsed, digits)


def normalize_live_route_reason(
        reason: Any,
        venue: str,
) -> str:
    cleaned = str(reason or "").strip().lower()

    if cleaned == "missing_ask":
        return (
            "missing_polymarket_ask"
            if venue == "polymarket"
            else "missing_kalshi_ask"
        )

    if cleaned == "zero_depth":
        return (
            "zero_polymarket_depth"
            if venue == "polymarket"
            else "zero_kalshi_depth"
        )

    if cleaned in {
        "sequence_gap",
        "sequence_invalid",
    }:
        return "sequence_invalid"

    if cleaned in {
        "market_closed",
        "market_resolved",
        "market_settled",
        "market_finalized",
        "market_finalised",
        "market_expired",
        "market_cancelled",
        "market_canceled",
        "closed",
        "resolved",
        "settled",
        "finalized",
        "finalised",
        "expired",
        "cancelled",
        "canceled",
    }:
        return "market_closed"

    if cleaned in {
        "market_suspended",
        "market_paused",
        "market_inactive",
        "suspended",
        "paused",
        "inactive",
    }:
        return "market_suspended"

    if cleaned in UNAVAILABLE_ROUTE_STATUSES:
        return cleaned

    if not cleaned:
        return (
            "missing_polymarket_book"
            if venue == "polymarket"
            else "missing_kalshi_book"
        )

    # Preserve an exact diagnostic without collapsing it into a generic
    # "incomplete" status. Unknown venue reasons remain visible to callers.
    return f"{venue}_{exact_code(cleaned)}"

def primary_route_reason(
    reasons: Sequence[str],
) -> str:
    unique = list(dict.fromkeys(reason for reason in reasons if reason))
    if not unique:
        return "pair_lookup_missing"
    return min(
        unique,
        key=lambda value: ROUTE_STATUS_PRIORITY.get(value, 999),
    )


def route_leg_state(
    *,
    venue: str,
    side: str,
    price: Optional[float],
    size: Optional[float],
    book_present: bool,
    health: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    health_payload = health if isinstance(health, dict) else {}
    health_status = str(health_payload.get("status") or "").lower()
    health_executable = health_payload.get("executable")
    health_reason = health_payload.get("reason")

    if health_status == "unavailable" or health_executable is False:
        reason = normalize_live_route_reason(health_reason, venue)
        return {
            "venue": venue,
            "side": side,
            "ask": price,
            "askSize": size,
            "status": reason,
            "reason": reason,
            "sourceReason": health_reason,
            "executable": False,
        }

    if not book_present:
        reason = (
            "missing_polymarket_book"
            if venue == "polymarket"
            else "missing_kalshi_book"
        )
        return {
            "venue": venue,
            "side": side,
            "ask": price,
            "askSize": size,
            "status": reason,
            "reason": reason,
            "sourceReason": None,
            "executable": False,
        }

    if price is None:
        reason = (
            "missing_polymarket_ask"
            if venue == "polymarket"
            else "missing_kalshi_ask"
        )
        return {
            "venue": venue,
            "side": side,
            "ask": None,
            "askSize": size,
            "status": reason,
            "reason": reason,
            "sourceReason": None,
            "executable": False,
        }

    if size is None or size <= 0:
        reason = (
            "zero_polymarket_depth"
            if venue == "polymarket"
            else "zero_kalshi_depth"
        )
        return {
            "venue": venue,
            "side": side,
            "ask": price,
            "askSize": size,
            "status": reason,
            "reason": reason,
            "sourceReason": None,
            "executable": False,
        }

    return {
        "venue": venue,
        "side": side,
        "ask": price,
        "askSize": size,
        "status": "ready",
        "reason": None,
        "sourceReason": None,
        "executable": True,
    }


def unavailable_route_payload(
    *,
    key: str,
    description: str,
    polymarket_leg: Dict[str, Any],
    kalshi_leg: Dict[str, Any],
) -> Dict[str, Any]:
    reasons = list(
        dict.fromkeys(
            reason
            for reason in (
                polymarket_leg.get("reason"),
                kalshi_leg.get("reason"),
            )
            if reason
        )
    )
    status = primary_route_reason(reasons)

    return {
        "key": key,
        "description": description,
        "status": status,
        "pricingStatus": status,
        "reason": status,
        "reasons": reasons,
        "executable": False,
        "polymarket": polymarket_leg,
        "kalshi": kalshi_leg,
        "pairedCost": None,
        "grossEdge": None,
        "polymarketEstimatedFeeUsd": None,
        "kalshiEstimatedFeeUsd": None,
        "estimatedFeesUsd": None,
        "netEdge": None,
        "netReturnPercent": None,
        "rawIsGrossArbitrage": False,
        "rawIsNetArbitrage": False,
        "rawIsNetArbitrageAtDisplayedDepth": False,
        "isGrossArbitrage": False,
        "isNetArbitrage": False,
        "isNetArbitrageAtDisplayedDepth": False,
        "feeEstimateComplete": False,
        "feeEstimateMethod": "not-calculated-route-unavailable",
        "feeEstimateCaveat": None,
        "executableContracts": 0.0,
        "executableDepthUsd": 0.0,
        "capitalRequiredUsd": None,
        "grossExecutableProfitUsd": None,
        "estimatedFeesAtDisplayedDepthUsd": None,
        "netExecutableProfitUsd": None,
        "maxPositiveEdgeCapitalUsd": None,
        "maxPositiveEdgeContracts": 0.0,
        "maxPositiveEdgeNetProfitUsd": None,
        "maxPositiveEdgeReturnRate": None,
        "depthBreakdown": [],
        "depthBreakdownTruncated": False,
        "capacityStopReason": None,
        "nextPriceAfterCapacity": None,
    }


def _normalize_depth_levels(
    rows: Any,
    fallback_price: Optional[float] = None,
    fallback_size: Optional[float] = None,
) -> List[Tuple[float, float]]:
    """Normalize a live ask ladder and aggregate duplicate prices."""
    aggregated: Dict[float, float] = {}
    if isinstance(rows, (list, tuple)):
        for row in rows:
            if isinstance(row, dict):
                price = as_float(row.get("price"))
                size = as_float(row.get("size"))
            elif isinstance(row, (list, tuple)) and len(row) >= 2:
                price = as_float(row[0])
                size = as_float(row[1])
            else:
                continue
            if price is None or size is None or size <= 0:
                continue
            if price <= 0 or price >= 1:
                continue
            aggregated[price] = aggregated.get(price, 0.0) + size

    if not aggregated:
        price = as_float(fallback_price)
        size = as_float(fallback_size)
        if price is not None and size is not None and size > 0:
            aggregated[price] = size

    return sorted(aggregated.items(), key=lambda item: item[0])


def positive_net_depth_capacity(
    *,
    polymarket_levels: Any,
    kalshi_levels: Any,
    poly_market: Market,
    kalshi_market: Market,
    kalshi_fee_configuration: Dict[str, Any],
    fallback_poly_price: float,
    fallback_poly_size: Optional[float],
    fallback_kalshi_price: float,
    fallback_kalshi_size: Optional[float],
) -> Dict[str, Any]:
    """Walk both ask books until the next marginal paired fill loses net edge.

    Each accepted row is cumulative. Fees are estimated level-by-level using the
    same authoritative fee functions as top-of-book pricing. We stop before the
    first additional slice whose own after-fee profit is non-positive; this
    avoids using earlier profitable fills to subsidize a later losing fill.
    """
    poly = _normalize_depth_levels(
        polymarket_levels, fallback_poly_price, fallback_poly_size
    )
    kalshi = _normalize_depth_levels(
        kalshi_levels, fallback_kalshi_price, fallback_kalshi_size
    )

    if not poly or not kalshi:
        return {
            "contracts": 0.0,
            "rawCostUsd": 0.0,
            "capitalUsd": None,
            "grossProfitUsd": 0.0,
            "feesUsd": None,
            "netProfitUsd": None,
            "returnRate": None,
            "breakdown": [],
            "breakdownTruncated": False,
            "stopReason": "order_book_depth_unavailable",
            "nextPrice": None,
        }

    i = j = 0
    poly_remaining = poly[0][1]
    kalshi_remaining = kalshi[0][1]
    total_contracts = 0.0
    poly_cost = 0.0
    kalshi_cost = 0.0
    total_fees = 0.0
    total_gross_profit = 0.0
    total_net_profit = 0.0
    breakdown: List[Dict[str, Any]] = []
    breakdown_truncated = False
    next_price: Optional[Dict[str, Any]] = None
    stop_reason: Optional[str] = None
    epsilon = 1e-12

    while i < len(poly) and j < len(kalshi):
        poly_price = float(poly[i][0])
        kalshi_price = float(kalshi[j][0])
        quantity = min(poly_remaining, kalshi_remaining)

        if quantity <= epsilon:
            if poly_remaining <= epsilon:
                i += 1
                if i < len(poly):
                    poly_remaining = poly[i][1]
            if kalshi_remaining <= epsilon:
                j += 1
                if j < len(kalshi):
                    kalshi_remaining = kalshi[j][1]
            continue

        poly_fee, _ = polymarket_taker_fee_for_quantity(
            poly_market, poly_price, quantity
        )
        kalshi_fee, _ = kalshi_taker_fee_for_quantity(
            kalshi_market, kalshi_price, quantity, kalshi_fee_configuration
        )
        if poly_fee is None or kalshi_fee is None:
            stop_reason = "fee_metadata_unavailable"
            break

        slice_fees = float(poly_fee) + float(kalshi_fee)
        slice_raw_cost = quantity * (poly_price + kalshi_price)
        slice_gross_profit = quantity - slice_raw_cost
        slice_net_profit = slice_gross_profit - slice_fees

        if slice_net_profit <= epsilon:
            stop_reason = "net_edge_lost"
            next_price = {
                "polymarketAsk": round(poly_price, 6),
                "kalshiAsk": round(kalshi_price, 6),
                "availableContracts": round(quantity, 8),
                "pairedCost": round(poly_price + kalshi_price, 6),
                "grossEdge": round(1.0 - poly_price - kalshi_price, 6),
                "estimatedFeesUsd": round(slice_fees, 8),
                "marginalNetProfitUsd": round(slice_net_profit, 8),
            }
            break

        total_contracts += quantity
        poly_cost += quantity * poly_price
        kalshi_cost += quantity * kalshi_price
        total_fees += slice_fees
        total_gross_profit += slice_gross_profit
        total_net_profit += slice_net_profit
        raw_cost = poly_cost + kalshi_cost
        capital = raw_cost + total_fees
        return_rate = total_net_profit / capital if capital > 0 else None

        row = {
            "contracts": round(total_contracts, 8),
            "capitalRequiredUsd": round(capital, 8),
            "rawCostUsd": round(raw_cost, 8),
            "polymarketPrice": round(poly_price, 6),
            "kalshiPrice": round(kalshi_price, 6),
            "pairedCost": round(poly_price + kalshi_price, 6),
            "polymarketAveragePrice": round(poly_cost / total_contracts, 6),
            "kalshiAveragePrice": round(kalshi_cost / total_contracts, 6),
            "estimatedFeesUsd": round(total_fees, 8),
            "totalProfitUsd": round(total_net_profit, 8),
            "grossProfitUsd": round(total_gross_profit, 8),
            "netReturnRate": round(return_rate, 10) if return_rate is not None else None,
            "netReturnPercent": round(return_rate * 100.0, 6) if return_rate is not None else None,
        }
        if len(breakdown) < MAX_DEPTH_BREAKDOWN_ROWS:
            breakdown.append(row)
        else:
            breakdown_truncated = True

        poly_remaining -= quantity
        kalshi_remaining -= quantity
        if poly_remaining <= epsilon:
            i += 1
            if i < len(poly):
                poly_remaining = poly[i][1]
        if kalshi_remaining <= epsilon:
            j += 1
            if j < len(kalshi):
                kalshi_remaining = kalshi[j][1]

    if stop_reason is None:
        if i >= len(poly) and j >= len(kalshi):
            stop_reason = "both_books_exhausted"
        elif i >= len(poly):
            stop_reason = "polymarket_depth_exhausted"
        elif j >= len(kalshi):
            stop_reason = "kalshi_depth_exhausted"
        else:
            stop_reason = "depth_complete"

    raw_cost = poly_cost + kalshi_cost
    capital = raw_cost + total_fees if total_contracts > 0 else None
    return_rate = (
        total_net_profit / capital
        if capital is not None and capital > 0
        else None
    )
    return {
        "contracts": total_contracts,
        "rawCostUsd": raw_cost,
        "capitalUsd": capital,
        "grossProfitUsd": total_gross_profit,
        "feesUsd": total_fees if total_contracts > 0 else None,
        "netProfitUsd": total_net_profit if total_contracts > 0 else None,
        "returnRate": return_rate,
        "breakdown": breakdown,
        "breakdownTruncated": breakdown_truncated,
        "stopReason": stop_reason,
        "nextPrice": next_price,
    }


def route_payload(
    key: str,
    description: str,
    poly_price: float,
    poly_size: Optional[float],
    kalshi_price: float,
    kalshi_size: Optional[float],
    poly_market: Market,
    kalshi_market: Market,
    kalshi_fee_configuration: Dict[str, Any],
    *,
    polymarket_side: str = "yes",
    kalshi_side: str = "no",
    settlement_verified: bool = True,
    polymarket_levels: Any = None,
    kalshi_levels: Any = None,
) -> Dict[str, Any]:
    paired_cost = poly_price + kalshi_price
    gross_edge = 1.0 - paired_cost

    polymarket_fee, polymarket_fee_method = (
        polymarket_taker_fee_for_quantity(poly_market, poly_price, 1.0)
    )
    kalshi_fee, kalshi_fee_method = kalshi_taker_fee_for_quantity(
        kalshi_market,
        kalshi_price,
        1.0,
        kalshi_fee_configuration,
    )

    fee_estimate_complete = (
        polymarket_fee is not None and kalshi_fee is not None
    )
    estimated_fees = (
        polymarket_fee + kalshi_fee
        if fee_estimate_complete
        else None
    )
    net_edge = (
        gross_edge - estimated_fees
        if estimated_fees is not None
        else None
    )
    total_estimated_cost = (
        paired_cost + estimated_fees
        if estimated_fees is not None
        else None
    )
    net_return_percent = (
        net_edge / total_estimated_cost * 100.0
        if net_edge is not None
        and total_estimated_cost is not None
        and total_estimated_cost > 0
        else None
    )

    executable_contracts = max(
        0.0,
        min(float(poly_size or 0.0), float(kalshi_size or 0.0)),
    )
    executable_depth_usd = executable_contracts * paired_cost
    gross_profit_at_depth = executable_contracts * gross_edge
    estimated_fees_at_depth: Optional[float] = None
    net_profit_at_depth: Optional[float] = None
    capital_required_usd: Optional[float] = None
    depth_fee_complete = False

    poly_depth_fee, _ = polymarket_taker_fee_for_quantity(
        poly_market,
        poly_price,
        executable_contracts,
    )
    kalshi_depth_fee, _ = kalshi_taker_fee_for_quantity(
        kalshi_market,
        kalshi_price,
        executable_contracts,
        kalshi_fee_configuration,
    )
    depth_fee_complete = (
        poly_depth_fee is not None and kalshi_depth_fee is not None
    )

    if depth_fee_complete:
        estimated_fees_at_depth = poly_depth_fee + kalshi_depth_fee
        net_profit_at_depth = gross_profit_at_depth - estimated_fees_at_depth
        capital_required_usd = executable_depth_usd + estimated_fees_at_depth

    depth_capacity = positive_net_depth_capacity(
        polymarket_levels=polymarket_levels,
        kalshi_levels=kalshi_levels,
        poly_market=poly_market,
        kalshi_market=kalshi_market,
        kalshi_fee_configuration=kalshi_fee_configuration,
        fallback_poly_price=poly_price,
        fallback_poly_size=poly_size,
        fallback_kalshi_price=kalshi_price,
        fallback_kalshi_size=kalshi_size,
    )
    if depth_capacity.get("contracts", 0.0) > 0:
        executable_contracts = float(depth_capacity["contracts"])
        executable_depth_usd = float(depth_capacity["rawCostUsd"])
        gross_profit_at_depth = float(depth_capacity["grossProfitUsd"])
        estimated_fees_at_depth = as_float(depth_capacity.get("feesUsd"))
        net_profit_at_depth = as_float(depth_capacity.get("netProfitUsd"))
        capital_required_usd = as_float(depth_capacity.get("capitalUsd"))
        depth_fee_complete = bool(
            estimated_fees_at_depth is not None and net_profit_at_depth is not None
        )

    raw_is_gross_arbitrage = gross_edge > 0
    raw_is_net_arbitrage = bool(
        fee_estimate_complete
        and net_edge is not None
        and net_edge > 0
    )
    raw_is_net_at_depth = bool(
        depth_fee_complete
        and net_profit_at_depth is not None
        and net_profit_at_depth > 0
    )

    if raw_is_net_at_depth:
        pricing_status = "net_opportunity"
    elif raw_is_gross_arbitrage:
        pricing_status = "gross_only"
    else:
        pricing_status = "no_opportunity"

    fee_estimate_method = (
        f"{polymarket_fee_method}+{kalshi_fee_method}"
        if fee_estimate_complete
        else f"incomplete:{polymarket_fee_method}+{kalshi_fee_method}"
    )

    polymarket_leg = {
        "venue": "polymarket",
        "side": polymarket_side,
        "ask": poly_price,
        "askSize": poly_size,
        "status": "ready",
        "reason": None,
        "sourceReason": None,
        "executable": True,
    }
    kalshi_leg = {
        "venue": "kalshi",
        "side": kalshi_side,
        "ask": kalshi_price,
        "askSize": kalshi_size,
        "status": "ready",
        "reason": None,
        "sourceReason": None,
        "executable": True,
    }

    return {
        "key": key,
        "description": description,
        "status": pricing_status,
        "pricingStatus": pricing_status,
        "reason": None,
        "reasons": [],
        "executable": True,
        "polymarket": polymarket_leg,
        "kalshi": kalshi_leg,
        "pairedCost": round(paired_cost, 6),
        "grossEdge": round(gross_edge, 6),
        "polymarketEstimatedFeeUsd": (
            round(polymarket_fee, 6)
            if polymarket_fee is not None
            else None
        ),
        "kalshiEstimatedFeeUsd": (
            round(kalshi_fee, 6)
            if kalshi_fee is not None
            else None
        ),
        "estimatedFeesUsd": (
            round(estimated_fees, 6)
            if estimated_fees is not None
            else None
        ),
        "netEdge": round(net_edge, 6) if net_edge is not None else None,
        "netReturnPercent": (
            round(net_return_percent, 4)
            if net_return_percent is not None
            else None
        ),
        "rawIsGrossArbitrage": raw_is_gross_arbitrage,
        "rawIsNetArbitrage": raw_is_net_arbitrage,
        "rawIsNetArbitrageAtDisplayedDepth": raw_is_net_at_depth,
        "isGrossArbitrage": bool(
            settlement_verified and raw_is_gross_arbitrage
        ),
        "isNetArbitrage": bool(
            settlement_verified and raw_is_net_arbitrage
        ),
        "isNetArbitrageAtDisplayedDepth": bool(
            settlement_verified and raw_is_net_at_depth
        ),
        "feeEstimateComplete": fee_estimate_complete,
        "feeEstimateMethod": fee_estimate_method,
        "feeEstimateCaveat": (
            "Kalshi trade fee uses the published aggregate fee model and "
            "centicent rounding; account-level rounding fees and rebates "
            "can vary by fill path."
        ),
        "executableContracts": round(executable_contracts, 8),
        "executableDepthUsd": round(executable_depth_usd, 2),
        "capitalRequiredUsd": (
            round(capital_required_usd, 8)
            if capital_required_usd is not None
            else None
        ),
        "grossExecutableProfitUsd": round(gross_profit_at_depth, 8),
        "estimatedFeesAtDisplayedDepthUsd": (
            round(estimated_fees_at_depth, 8)
            if estimated_fees_at_depth is not None
            else None
        ),
        "netExecutableProfitUsd": (
            round(net_profit_at_depth, 8)
            if net_profit_at_depth is not None
            else None
        ),
        "maxPositiveEdgeCapitalUsd": (
            round(as_float(depth_capacity.get("capitalUsd")), 8)
            if as_float(depth_capacity.get("capitalUsd")) is not None
            else None
        ),
        "maxPositiveEdgeContracts": round(
            float(depth_capacity.get("contracts") or 0.0), 8
        ),
        "maxPositiveEdgeNetProfitUsd": (
            round(as_float(depth_capacity.get("netProfitUsd")), 8)
            if as_float(depth_capacity.get("netProfitUsd")) is not None
            else None
        ),
        "maxPositiveEdgeReturnRate": (
            round(as_float(depth_capacity.get("returnRate")), 10)
            if as_float(depth_capacity.get("returnRate")) is not None
            else None
        ),
        "depthBreakdown": (
            depth_capacity.get("breakdown") or []
            if raw_is_net_at_depth
            else []
        ),
        "depthBreakdownTruncated": bool(
            depth_capacity.get("breakdownTruncated") and raw_is_net_at_depth
        ),
        "capacityStopReason": depth_capacity.get("stopReason"),
        "nextPriceAfterCapacity": depth_capacity.get("nextPrice"),
    }


def synthetic_macro_route_payload(
    *,
    key: str,
    description: str,
    guaranteed_payout: float,
    legs: Sequence[Dict[str, Any]],
    kalshi_fee_configuration: Dict[str, Any],
) -> Dict[str, Any]:
    total_cost = sum(float(leg["price"]) for leg in legs)
    gross_edge = guaranteed_payout - total_cost

    per_contract_fees: List[Optional[float]] = []
    fee_methods: List[str] = []
    for leg in legs:
        market = leg["market"]
        price = float(leg["price"])
        if leg["venue"] == "polymarket":
            fee, method = polymarket_taker_fee_for_quantity(
                market,
                price,
                1.0,
            )
        else:
            fee, method = kalshi_taker_fee_for_quantity(
                market,
                price,
                1.0,
                kalshi_fee_configuration,
            )
        per_contract_fees.append(fee)
        fee_methods.append(method)

    fee_estimate_complete = all(
        fee is not None for fee in per_contract_fees
    )
    estimated_fees = (
        sum(float(fee) for fee in per_contract_fees if fee is not None)
        if fee_estimate_complete
        else None
    )
    net_edge = (
        gross_edge - estimated_fees
        if estimated_fees is not None
        else None
    )
    total_capital = (
        total_cost + estimated_fees
        if estimated_fees is not None
        else None
    )
    net_return_percent = (
        net_edge / total_capital * 100.0
        if net_edge is not None
        and total_capital is not None
        and total_capital > 0
        else None
    )

    sizes = [as_float(leg.get("size")) for leg in legs]
    executable_contracts = (
        max(0.0, min(size for size in sizes if size is not None))
        if all(size is not None for size in sizes)
        else None
    )
    executable_depth_usd = None
    estimated_fees_at_depth = None
    net_profit_at_depth = None
    depth_fee_complete = False

    if executable_contracts is not None:
        executable_depth_usd = executable_contracts * total_cost
        depth_fees: List[Optional[float]] = []
        for leg in legs:
            market = leg["market"]
            price = float(leg["price"])
            if leg["venue"] == "polymarket":
                fee, _ = polymarket_taker_fee_for_quantity(
                    market,
                    price,
                    executable_contracts,
                )
            else:
                fee, _ = kalshi_taker_fee_for_quantity(
                    market,
                    price,
                    executable_contracts,
                    kalshi_fee_configuration,
                )
            depth_fees.append(fee)

        depth_fee_complete = all(fee is not None for fee in depth_fees)
        if depth_fee_complete:
            estimated_fees_at_depth = sum(
                float(fee) for fee in depth_fees if fee is not None
            )
            net_profit_at_depth = (
                executable_contracts * gross_edge
                - estimated_fees_at_depth
            )

    fee_method = "+".join(fee_methods)
    if not fee_estimate_complete:
        fee_method = f"incomplete:{fee_method}"

    leg_payload = []
    for leg, fee in zip(legs, per_contract_fees):
        market = leg["market"]
        leg_payload.append(
            {
                "venue": leg["venue"],
                "side": leg["side"],
                "marketId": market.external_market_id,
                "eventId": market.external_event_id,
                "url": market_url(market),
                "price": round(float(leg["price"]), 6),
                "size": leg.get("size"),
                "estimatedFeeUsd": (
                    round(float(fee), 6)
                    if fee is not None
                    else None
                ),
            }
        )

    is_net_arbitrage = bool(
        fee_estimate_complete
        and net_edge is not None
        and net_edge > 0
    )
    is_execution_ready = bool(
        is_net_arbitrage
        and net_edge is not None
        and net_edge >= SYNTHETIC_MACRO_EXECUTION_BUFFER
        and executable_contracts is not None
        and executable_contracts > 0
    )

    return {
        "key": key,
        "description": description,
        "guaranteedPayoutUsd": round(guaranteed_payout, 6),
        "pairedCost": round(total_cost, 6),
        "grossEdge": round(gross_edge, 6),
        "polymarketEstimatedFeeUsd": round(
            sum(
                float(fee)
                for leg, fee in zip(legs, per_contract_fees)
                if leg["venue"] == "polymarket" and fee is not None
            ),
            6,
        ) if fee_estimate_complete else None,
        "kalshiEstimatedFeeUsd": round(
            sum(
                float(fee)
                for leg, fee in zip(legs, per_contract_fees)
                if leg["venue"] == "kalshi" and fee is not None
            ),
            6,
        ) if fee_estimate_complete else None,
        "estimatedFeesUsd": (
            round(estimated_fees, 6)
            if estimated_fees is not None
            else None
        ),
        "netEdge": round(net_edge, 6) if net_edge is not None else None,
        "netReturnPercent": (
            round(net_return_percent, 4)
            if net_return_percent is not None
            else None
        ),
        "isNetArbitrage": is_net_arbitrage,
        "isExecutionReady": is_execution_ready,
        "executionBufferUsdPerSet": SYNTHETIC_MACRO_EXECUTION_BUFFER,
        "executionRisk": "three-leg-non-atomic-legging-risk",
        "feeEstimateComplete": fee_estimate_complete,
        "feeEstimateMethod": fee_method,
        "feeEstimateCaveat": (
            "Three taker legs are priced independently. The payoff is "
            "guaranteed only after every leg fills at the displayed size; "
            "partial fills create directional exposure."
        ),
        "legCount": len(legs),
        "legs": leg_payload,
        "executableContracts": (
            round(executable_contracts, 8)
            if executable_contracts is not None
            else None
        ),
        "executableDepthUsd": (
            round(executable_depth_usd, 2)
            if executable_depth_usd is not None
            else None
        ),
        "estimatedFeesAtDisplayedDepthUsd": (
            round(estimated_fees_at_depth, 8)
            if estimated_fees_at_depth is not None
            else None
        ),
        "netExecutableProfitUsd": (
            round(net_profit_at_depth, 8)
            if net_profit_at_depth is not None
            else None
        ),
        "isNetArbitrageAtDisplayedDepth": bool(
            depth_fee_complete
            and net_profit_at_depth is not None
            and net_profit_at_depth > 0
        ),
    }


def price_synthetic_macro_candidate(
    candidate: SyntheticMacroCandidate,
    markets: Dict[int, Market],
    polymarket_books: Dict[str, Dict[str, Any]],
    kalshi_books: Dict[str, Dict[str, Any]],
    kalshi_fee_configuration: Dict[str, Any],
    failures: Optional[Counter] = None,
) -> Optional[Dict[str, Any]]:
    poly_contract = candidate.polymarket_contract
    lower_contract = candidate.lower_kalshi_contract
    upper_contract = candidate.upper_kalshi_contract

    poly_market = markets[poly_contract.market_id]
    lower_market = markets[lower_contract.market_id]
    upper_market = markets[upper_contract.market_id]

    poly_yes, poly_yes_size = best_ask(
        polymarket_books.get(poly_contract.yes_key)
    )
    poly_no, poly_no_size = best_ask(
        polymarket_books.get(poly_contract.no_key)
    )
    lower_book = kalshi_books.get(lower_market.external_market_id)
    upper_book = kalshi_books.get(upper_market.external_market_id)

    if not lower_book or not upper_book:
        if failures is not None:
            failures["missingSyntheticKalshiBook"] += 1
        return None
    if poly_yes is None or poly_no is None:
        if failures is not None:
            failures["missingSyntheticPolymarketAsk"] += 1
        return None

    lower_yes = as_float(lower_book.get("yes_ask"))
    lower_no = as_float(lower_book.get("no_ask"))
    lower_yes_size = as_float(lower_book.get("yes_ask_size"))
    lower_no_size = as_float(lower_book.get("no_ask_size"))
    upper_yes = as_float(upper_book.get("yes_ask"))
    upper_no = as_float(upper_book.get("no_ask"))
    upper_yes_size = as_float(upper_book.get("yes_ask_size"))
    upper_no_size = as_float(upper_book.get("no_ask_size"))

    if any(
        value is None
        for value in (
            lower_yes,
            lower_no,
            upper_yes,
            upper_no,
        )
    ):
        if failures is not None:
            failures["missingSyntheticKalshiAsk"] += 1
        return None

    route_yes = synthetic_macro_route_payload(
        key="polymarket_yes_kalshi_no_lower_yes_upper",
        description=(
            "Buy YES on Polymarket range + NO on Kalshi lower "
            "threshold + YES on Kalshi upper threshold"
        ),
        guaranteed_payout=1.0,
        legs=(
            {
                "venue": "polymarket",
                "side": "yes",
                "market": poly_market,
                "price": poly_yes,
                "size": poly_yes_size,
            },
            {
                "venue": "kalshi",
                "side": "no",
                "market": lower_market,
                "price": lower_no,
                "size": lower_no_size,
            },
            {
                "venue": "kalshi",
                "side": "yes",
                "market": upper_market,
                "price": upper_yes,
                "size": upper_yes_size,
            },
        ),
        kalshi_fee_configuration=kalshi_fee_configuration,
    )

    route_no = synthetic_macro_route_payload(
        key="polymarket_no_kalshi_yes_lower_no_upper",
        description=(
            "Buy NO on Polymarket range + YES on Kalshi lower "
            "threshold + NO on Kalshi upper threshold"
        ),
        guaranteed_payout=2.0,
        legs=(
            {
                "venue": "polymarket",
                "side": "no",
                "market": poly_market,
                "price": poly_no,
                "size": poly_no_size,
            },
            {
                "venue": "kalshi",
                "side": "yes",
                "market": lower_market,
                "price": lower_yes,
                "size": lower_yes_size,
            },
            {
                "venue": "kalshi",
                "side": "no",
                "market": upper_market,
                "price": upper_no,
                "size": upper_no_size,
            },
        ),
        kalshi_fee_configuration=kalshi_fee_configuration,
    )

    routes = [route_yes, route_no]
    routes.sort(
        key=lambda row: (
            row["feeEstimateComplete"],
            row["netEdge"]
            if row["netEdge"] is not None
            else row["grossEdge"],
        ),
        reverse=True,
    )
    best_route = routes[0]

    scheduled_time = (
        lower_contract.scheduled_time
        or upper_contract.scheduled_time
        or poly_contract.scheduled_time
    )

    return {
        "id": (
            f"macro-synthetic-{poly_market.id}-"
            f"{lower_market.id}-{upper_market.id}"
        ),
        "marketGroup": "macro",
        "eventTitle": poly_contract.event_title,
        "contractTitle": poly_contract.contract_title,
        "scheduledTime": scheduled_time,
        "eventKey": candidate.event_identity,
        "contractKey": candidate.contract_identity,
        "pairRelationship": "synthetic_threshold_ladder",
        "sideMapping": (
            "Polymarket range ↔ two Kalshi threshold contracts"
        ),
        "matchMethod": (
            "exact_macro_dimensions_v16:verified_range_boundaries:"
            "synthetic_threshold_ladder"
        ),
        "boundaryMode": candidate.boundary_mode,
        "verificationMethod": candidate.verification_method,
        "lowerBound": candidate.lower_bound,
        "upperBound": candidate.upper_bound,
        "polymarket": {
            "marketId": poly_market.external_market_id,
            "eventId": poly_market.external_event_id,
            "url": market_url(poly_market),
            "yesLabel": poly_contract.yes_label,
            "noLabel": poly_contract.no_label,
            "yesAsk": round(poly_yes, 6),
            "noAsk": round(poly_no, 6),
            "yesSize": poly_yes_size,
            "noSize": poly_no_size,
            **market_activity_payload(poly_market),
            "bookTimestamp": (
                polymarket_books.get(poly_contract.yes_key) or {}
            ).get("timestamp"),
        },
        "kalshi": {
            "synthetic": True,
            "eventId": lower_market.external_event_id,
            "lowerThreshold": {
                "marketId": lower_market.external_market_id,
                "url": market_url(lower_market),
                "threshold": candidate.lower_bound,
                "yesAsk": round(float(lower_yes), 6),
                "noAsk": round(float(lower_no), 6),
                "yesSize": lower_yes_size,
                "noSize": lower_no_size,
                "bookTimestamp": lower_book.get("fetched_at"),
            },
            "upperThreshold": {
                "marketId": upper_market.external_market_id,
                "url": market_url(upper_market),
                "threshold": candidate.upper_bound,
                "yesAsk": round(float(upper_yes), 6),
                "noAsk": round(float(upper_no), 6),
                "yesSize": upper_yes_size,
                "noSize": upper_no_size,
                "bookTimestamp": upper_book.get("fetched_at"),
            },
        },
        "yesDifference": route_yes["grossEdge"],
        "noDifference": route_no["grossEdge"],
        "routes": routes,
        "bestRoute": best_route,
        "grossEdge": best_route["grossEdge"],
        "bestGrossEdge": best_route["grossEdge"],
        "estimatedFeesUsd": best_route["estimatedFeesUsd"],
        "estimatedFeesAtDisplayedDepthUsd": best_route[
            "estimatedFeesAtDisplayedDepthUsd"
        ],
        "netEdge": best_route["netEdge"],
        "bestNetEdge": best_route["netEdge"],
        "netReturnPercent": best_route["netReturnPercent"],
        "netExecutableProfitUsd": best_route[
            "netExecutableProfitUsd"
        ],
        "isGrossArbitrage": best_route["grossEdge"] > 0,
        "isNetArbitrage": best_route["isNetArbitrage"],
        "isExecutionReady": best_route["isExecutionReady"],
        "executionRisk": best_route["executionRisk"],
        "feeEstimateComplete": best_route["feeEstimateComplete"],
        "feeEstimateMethod": best_route["feeEstimateMethod"],
    }


def event_timing_payload(
    market_group: str,
    scheduled_time: Optional[str],
    reference_time: datetime,
) -> Dict[str, Any]:
    scheduled = parse_datetime(scheduled_time)
    if not scheduled:
        return {
            "eventPhase": "unscheduled",
            "secondsUntilStart": None,
            "eventPhaseSource": "schedule_unavailable",
        }

    seconds_until_start = round(
        (scheduled - reference_time).total_seconds()
    )
    if (
        market_group == "sports"
        and -LIVE_SPORTS_EVENT_WINDOW_SECONDS <= seconds_until_start <= 0
    ):
        phase = "live"
        source = "scheduled_start_plus_active_books"
    elif seconds_until_start > 0:
        phase = "upcoming"
        source = "scheduled_start"
    else:
        phase = "recent"
        source = "scheduled_start"

    return {
        "eventPhase": phase,
        "secondsUntilStart": seconds_until_start,
        "eventPhaseSource": source,
    }


def is_today_for_offset(
    scheduled_time: Optional[str],
    reference_time: datetime,
    timezone_offset_minutes: int,
) -> bool:
    scheduled = parse_datetime(scheduled_time)
    if not scheduled:
        return False
    offset_seconds = timezone_offset_minutes * 60
    scheduled_local = datetime.fromtimestamp(
        scheduled.timestamp() - offset_seconds,
        tz=timezone.utc,
    )
    reference_local = datetime.fromtimestamp(
        reference_time.timestamp() - offset_seconds,
        tz=timezone.utc,
    )
    return scheduled_local.date() == reference_local.date()


def schedule_sort_key(row: Dict[str, Any]) -> Tuple[Any, ...]:
    phase_rank = {
        "live": 0,
        "upcoming": 1,
        "recent": 2,
        "unscheduled": 3,
    }
    seconds = row.get("secondsUntilStart")
    distance = abs(seconds) if isinstance(seconds, (int, float)) else float("inf")
    return (
        phase_rank.get(row.get("eventPhase"), 4),
        distance,
        -float(row.get("bestGrossEdge") or 0),
    )


def market_activity_payload(
    market: Market,
) -> Dict[str, Any]:
    raw = market.raw

    if market.venue == "polymarket":
        return {
            "liquidity": first_float(
                market.liquidity,
                raw.get("liquidityNum"),
                raw.get("liquidity"),
            ),
            "liquidityUnit": "usd",
            "volume24h": first_float(
                market.volume_24h,
                raw.get("volume24hr"),
                raw.get("volume24hrClob"),
            ),
            "lifetimeVolume": first_float(
                market.total_volume,
                raw.get("volumeNum"),
                raw.get("volume"),
            ),
            "openInterest": first_float(
                market.open_interest,
                raw.get("openInterest"),
            ),
            "volumeUnit": "usd",
        }

    if market.venue == "kalshi":
        return {
            "liquidity": first_float(
                market.liquidity,
                raw.get("liquidity_dollars"),
                raw.get("liquidity"),
            ),
            "liquidityUnit": "usd",
            "volume24h": first_float(
                market.volume_24h,
                raw.get("volume_24h_fp"),
                raw.get("volume_24h"),
            ),
            "lifetimeVolume": first_float(
                market.total_volume,
                raw.get("volume_fp"),
                raw.get("volume"),
            ),
            "openInterest": first_float(
                market.open_interest,
                raw.get("open_interest_fp"),
                raw.get("open_interest"),
            ),
            "volumeUnit": "contracts",
        }

    return {
        "liquidity": None,
        "liquidityUnit": None,
        "volume24h": None,
        "lifetimeVolume": None,
        "openInterest": None,
        "volumeUnit": None,
    }

def compact_live_health(value: Any) -> Any:
    """Keep diagnostics in public rows without echoing full order-book ladders."""
    if not isinstance(value, dict):
        return value
    return {
        key: item
        for key, item in value.items()
        if key not in {"askLevels", "yesAskLevels", "noAskLevels"}
    }


def price_pair(
    poly_contract: ExactContract,
    kalshi_contract: ExactContract,
    markets: Dict[int, Market],
    polymarket_books: Dict[str, Dict[str, Any]],
    kalshi_books: Dict[str, Dict[str, Any]],
    kalshi_fee_configuration: Dict[str, Any],
    failures: Optional[Counter] = None,
    *,
    route_health: Optional[Dict[str, Dict[str, Any]]] = None,
    source_snapshot: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Price and account for both executable routes of one exact pair.

    The function always returns a pair row. Missing or non-executable legs are
    represented by precise route statuses instead of causing the entire pair to
    disappear.
    """
    poly_market = markets[poly_contract.market_id]
    kalshi_market = markets[kalshi_contract.market_id]

    poly_yes_book = polymarket_books.get(poly_contract.yes_key)
    poly_no_book = polymarket_books.get(poly_contract.no_key)
    poly_yes, poly_yes_size = best_ask(poly_yes_book)
    poly_no, poly_no_size = best_ask(poly_no_book)

    kalshi_book = kalshi_books.get(kalshi_market.external_market_id)
    kalshi_yes = as_float((kalshi_book or {}).get("yes_ask"))
    kalshi_no = as_float((kalshi_book or {}).get("no_ask"))
    kalshi_yes_size = as_float((kalshi_book or {}).get("yes_ask_size"))
    kalshi_no_size = as_float((kalshi_book or {}).get("no_ask_size"))

    relationship = poly_contract.pair_relationship
    is_complement = relationship == "complement"

    if is_complement:
        equivalent_kalshi_yes = kalshi_no
        equivalent_kalshi_no = kalshi_yes
        route_specs = (
            {
                "key": "polymarket_yes_kalshi_yes",
                "description": (
                    f"Buy {poly_contract.yes_label} on Polymarket + Yes on Kalshi"
                ),
                "polySide": "yes",
                "polyPrice": poly_yes,
                "polySize": poly_yes_size,
                "polyBook": poly_yes_book,
                "polyLevels": (poly_yes_book or {}).get("asks") or [],
                "kalshiSide": "yes",
                "kalshiPrice": kalshi_yes,
                "kalshiSize": kalshi_yes_size,
                "kalshiLevels": (kalshi_book or {}).get("yes_ask_levels") or [],
            },
            {
                "key": "polymarket_no_kalshi_no",
                "description": (
                    f"Buy {poly_contract.no_label} on Polymarket + No on Kalshi"
                ),
                "polySide": "no",
                "polyPrice": poly_no,
                "polySize": poly_no_size,
                "polyBook": poly_no_book,
                "polyLevels": (poly_no_book or {}).get("asks") or [],
                "kalshiSide": "no",
                "kalshiPrice": kalshi_no,
                "kalshiSize": kalshi_no_size,
                "kalshiLevels": (kalshi_book or {}).get("no_ask_levels") or [],
            },
        )
        side_mapping = "Polymarket YES ↔ Kalshi NO"
    else:
        equivalent_kalshi_yes = kalshi_yes
        equivalent_kalshi_no = kalshi_no
        route_specs = (
            {
                "key": "polymarket_yes_kalshi_no",
                "description": (
                    f"Buy {poly_contract.yes_label} on Polymarket + No on Kalshi"
                ),
                "polySide": "yes",
                "polyPrice": poly_yes,
                "polySize": poly_yes_size,
                "polyBook": poly_yes_book,
                "polyLevels": (poly_yes_book or {}).get("asks") or [],
                "kalshiSide": "no",
                "kalshiPrice": kalshi_no,
                "kalshiSize": kalshi_no_size,
                "kalshiLevels": (kalshi_book or {}).get("no_ask_levels") or [],
            },
            {
                "key": "polymarket_no_kalshi_yes",
                "description": (
                    f"Buy {poly_contract.no_label} on Polymarket + Yes on Kalshi"
                ),
                "polySide": "no",
                "polyPrice": poly_no,
                "polySize": poly_no_size,
                "polyBook": poly_no_book,
                "polyLevels": (poly_no_book or {}).get("asks") or [],
                "kalshiSide": "yes",
                "kalshiPrice": kalshi_yes,
                "kalshiSize": kalshi_yes_size,
                "kalshiLevels": (kalshi_book or {}).get("yes_ask_levels") or [],
            },
        )
        side_mapping = "Polymarket YES ↔ Kalshi YES"

    route_health = route_health or {}
    routes: List[Dict[str, Any]] = []

    for spec in route_specs:
        health = route_health.get(spec["key"]) or {}
        poly_health = health.get("polymarket") if isinstance(health, dict) else None
        kalshi_health = health.get("kalshi") if isinstance(health, dict) else None

        # The stream route state is authoritative for the required leg's live
        # price and depth when supplied.
        if isinstance(poly_health, dict):
            stream_price = as_float(poly_health.get("ask"))
            stream_size = as_float(poly_health.get("askSize"))
            if stream_price is not None:
                spec["polyPrice"] = stream_price
            if stream_size is not None or poly_health.get("askSize") is None:
                spec["polySize"] = stream_size

        if isinstance(kalshi_health, dict):
            stream_price = as_float(kalshi_health.get("ask"))
            stream_size = as_float(kalshi_health.get("askSize"))
            if stream_price is not None:
                spec["kalshiPrice"] = stream_price
            if stream_size is not None or kalshi_health.get("askSize") is None:
                spec["kalshiSize"] = stream_size

        polymarket_leg = route_leg_state(
            venue="polymarket",
            side=spec["polySide"],
            price=as_float(spec["polyPrice"]),
            size=as_float(spec["polySize"]),
            book_present=(spec["polyBook"] is not None),
            health=poly_health,
        )
        kalshi_leg = route_leg_state(
            venue="kalshi",
            side=spec["kalshiSide"],
            price=as_float(spec["kalshiPrice"]),
            size=as_float(spec["kalshiSize"]),
            book_present=(kalshi_book is not None),
            health=kalshi_health,
        )

        if not (polymarket_leg["executable"] and kalshi_leg["executable"]):
            route = unavailable_route_payload(
                key=spec["key"],
                description=spec["description"],
                polymarket_leg=polymarket_leg,
                kalshi_leg=kalshi_leg,
            )
            if failures is not None:
                failures[route["status"]] += 1
            routes.append(route)
            continue

        route = route_payload(
            spec["key"],
            spec["description"],
            float(polymarket_leg["ask"]),
            as_float(polymarket_leg["askSize"]),
            float(kalshi_leg["ask"]),
            as_float(kalshi_leg["askSize"]),
            poly_market,
            kalshi_market,
            kalshi_fee_configuration,
            polymarket_side=spec["polySide"],
            kalshi_side=spec["kalshiSide"],
            settlement_verified=poly_contract.settlement_verified,
            polymarket_levels=spec.get("polyLevels"),
            kalshi_levels=spec.get("kalshiLevels"),
        )
        routes.append(route)

    ready_routes = [route for route in routes if route.get("executable") is True]
    ready_route_count = len(ready_routes)
    pair_status = (
        "ready"
        if ready_route_count == 2
        else "partially_ready"
        if ready_route_count == 1
        else "unavailable"
    )

    def best_route_key(route: Dict[str, Any]) -> Tuple[int, float, float]:
        executable_rank = int(route.get("executable") is True)
        net_value = as_float(route.get("netEdge"))
        gross_value = as_float(route.get("grossEdge"))
        return (
            executable_rank,
            net_value if net_value is not None else -999.0,
            gross_value if gross_value is not None else -999.0,
        )

    best_route = max(routes, key=best_route_key)
    executable_gross_edges = [
        float(route["grossEdge"])
        for route in ready_routes
        if route.get("grossEdge") is not None
    ]
    executable_net_edges = [
        float(route["netEdge"])
        for route in ready_routes
        if route.get("netEdge") is not None
    ]
    best_gross_edge = (
        max(executable_gross_edges) if executable_gross_edges else None
    )
    best_net_edge = max(executable_net_edges) if executable_net_edges else None

    raw_is_gross_arbitrage = any(
        route.get("rawIsGrossArbitrage") is True for route in ready_routes
    )
    raw_is_net_arbitrage = any(
        route.get("rawIsNetArbitrage") is True for route in ready_routes
    )
    raw_is_net_arbitrage_at_depth = any(
        route.get("rawIsNetArbitrageAtDisplayedDepth") is True
        for route in ready_routes
    )

    poly_activity = market_activity_payload(poly_market)
    kalshi_activity = market_activity_payload(kalshi_market)
    snapshot_poly = as_json((source_snapshot or {}).get("polymarket"), dict, {})
    snapshot_kalshi = as_json((source_snapshot or {}).get("kalshi"), dict, {})

    yes_difference = (
        poly_yes - equivalent_kalshi_yes
        if poly_yes is not None and equivalent_kalshi_yes is not None
        else None
    )
    no_difference = (
        poly_no - equivalent_kalshi_no
        if poly_no is not None and equivalent_kalshi_no is not None
        else None
    )

    route_status_counts = dict(
        sorted(Counter(str(route.get("status")) for route in routes).items())
    )

    return {
        "id": (
            f"{poly_contract.market_group}-{poly_market.id}-{kalshi_market.id}-"
            f"{relationship}-{poly_contract.contract_identity}"
        ),
        "marketGroup": poly_contract.market_group,
        "eventTitle": poly_contract.event_title,
        "contractTitle": poly_contract.contract_title,
        "scheduledTime": (
            kalshi_contract.scheduled_time
            if poly_contract.market_group == "macro"
            else poly_contract.scheduled_time or kalshi_contract.scheduled_time
        ),
        # These are real contract lifecycle targets used by the frontend for APY.
        # Never substitute scheduledTime/event start for settlement timing.
        "resolutionTime": latest_iso_value(
            getattr(poly_market, "resolution_time", None),
            getattr(kalshi_market, "resolution_time", None),
        ),
        "closeTime": latest_iso_value(
            getattr(poly_market, "close_time", None),
            getattr(kalshi_market, "close_time", None),
        ),
        "settlementTime": latest_iso_value(
            getattr(poly_market, "settlement_time", None),
            getattr(kalshi_market, "settlement_time", None),
        ),
        "eventKey": poly_contract.event_identity,
        "contractKey": poly_contract.contract_identity,
        "pairRelationship": relationship,
        "sideMapping": side_mapping,
        "matchMethod": (
            "native_event_then_exact_contract:"
            f"{poly_contract.event_match_method}:{relationship}"
        ),
        "settlementStreamEligible": poly_contract.settlement_stream_eligible,
        "settlementVerified": poly_contract.settlement_verified,
        "settlementStatus": poly_contract.settlement_status,
        "settlementReasons": list(poly_contract.settlement_reasons),
        "settlementSignature": poly_contract.settlement_signature,
        "pairStatus": pair_status,
        "pricingStatus": best_route.get("status"),
        "readyRouteCount": ready_route_count,
        "accountedRouteCount": len(routes),
        "allRoutesAccounted": len(routes) == 2,
        "anyRouteReady": ready_route_count > 0,
        "routeStatusCounts": route_status_counts,
        "polymarket": {
            "marketId": poly_market.external_market_id,
            "eventId": poly_market.external_event_id,
            "url": market_url(poly_market),
            "yesLabel": poly_contract.yes_label,
            "noLabel": poly_contract.no_label,
            "yesAsk": rounded_or_none(poly_yes),
            "noAsk": rounded_or_none(poly_no),
            "yesSize": poly_yes_size,
            "noSize": poly_no_size,
            "resolutionTime": iso_value(getattr(poly_market, "resolution_time", None)),
            "closeTime": iso_value(getattr(poly_market, "close_time", None)),
            "settlementTime": iso_value(getattr(poly_market, "settlement_time", None)),
            **poly_activity,
            "bookTimestamp": (poly_yes_book or {}).get("timestamp"),
            "yesHealth": compact_live_health(snapshot_poly.get("yes")),
            "noHealth": compact_live_health(snapshot_poly.get("no")),
        },
        "kalshi": {
            "marketId": kalshi_market.external_market_id,
            "marketTicker": kalshi_market.external_market_id,
            "eventId": kalshi_market.external_event_id,
            "eventTicker": kalshi_market.external_event_id,
            "seriesTicker": kalshi_market.external_series_id,
            "url": market_url(kalshi_market),
            "yesLabel": kalshi_contract.yes_label,
            "noLabel": kalshi_contract.no_label,
            "yesAsk": rounded_or_none(kalshi_yes),
            "noAsk": rounded_or_none(kalshi_no),
            "yesSize": kalshi_yes_size,
            "noSize": kalshi_no_size,
            "resolutionTime": iso_value(getattr(kalshi_market, "resolution_time", None)),
            "closeTime": iso_value(getattr(kalshi_market, "close_time", None)),
            "settlementTime": iso_value(getattr(kalshi_market, "settlement_time", None)),
            **kalshi_activity,
            "bookTimestamp": (kalshi_book or {}).get("fetched_at"),
            "health": compact_live_health(snapshot_kalshi) or None,
        },
        "liquidity": {
            "polymarketCatalogLiquidityUsd": poly_activity.get("liquidity"),
            "polymarketVolume24hUsd": poly_activity.get("volume24h"),
            "polymarketLifetimeVolumeUsd": poly_activity.get("lifetimeVolume"),
            "kalshiCatalogLiquidityUsd": kalshi_activity.get("liquidity"),
            "kalshiVolume24hContracts": kalshi_activity.get("volume24h"),
            "kalshiLifetimeVolumeContracts": kalshi_activity.get("lifetimeVolume"),
            "kalshiOpenInterestContracts": kalshi_activity.get("openInterest"),
            "bestRouteExecutableContracts": best_route.get("executableContracts"),
            "bestRouteCapitalRequiredUsd": best_route.get("capitalRequiredUsd"),
            "bestRouteMaxPositiveEdgeCapitalUsd": best_route.get("maxPositiveEdgeCapitalUsd"),
            "bestRouteNetProfitUsd": best_route.get("netExecutableProfitUsd"),
        },
        "yesDifference": rounded_or_none(yes_difference),
        "noDifference": rounded_or_none(no_difference),
        "routes": routes,
        "bestRoute": best_route,
        "grossEdge": best_route.get("grossEdge"),
        "bestGrossEdge": best_gross_edge,
        "estimatedFeesUsd": best_route.get("estimatedFeesUsd"),
        "estimatedFeesAtDisplayedDepthUsd": best_route.get(
            "estimatedFeesAtDisplayedDepthUsd"
        ),
        "netEdge": best_route.get("netEdge"),
        "bestNetEdge": best_net_edge,
        "netReturnPercent": best_route.get("netReturnPercent"),
        "netExecutableProfitUsd": best_route.get("netExecutableProfitUsd"),
        "maxPositiveEdgeCapitalUsd": best_route.get("maxPositiveEdgeCapitalUsd"),
        "maxPositiveEdgeNetProfitUsd": best_route.get("maxPositiveEdgeNetProfitUsd"),
        "maxPositiveEdgeReturnRate": best_route.get("maxPositiveEdgeReturnRate"),
        "rawIsGrossArbitrage": raw_is_gross_arbitrage,
        "rawIsNetArbitrage": raw_is_net_arbitrage,
        "rawIsNetArbitrageAtDisplayedDepth": raw_is_net_arbitrage_at_depth,
        "isGrossArbitrage": bool(
            poly_contract.settlement_verified and raw_is_gross_arbitrage
        ),
        "isNetArbitrage": bool(
            poly_contract.settlement_verified and raw_is_net_arbitrage
        ),
        "feeEstimateComplete": bool(
            ready_routes and all(route.get("feeEstimateComplete") for route in ready_routes)
        ),
        "feeEstimateMethod": best_route.get("feeEstimateMethod"),
        "liveComplete": ready_route_count == 2,
    }

def settlement_gate_pairs(
    pairs: Sequence[Tuple[ExactContract, ExactContract]],
    markets: Dict[int, Market],
    market_group: str,
) -> Tuple[
    List[Tuple[ExactContract, ExactContract]],
    Dict[str, Any],
]:
    """
    Resolve settlement before a matched pair reaches live pricing.

    Strict and core-verified pairs keep their existing behavior. Any matched
    pair with a definitive non-equivalent settlement decision is retained for
    live comparison pricing, while settlement_verified stays False so it can
    never enter guaranteed Gross/Net arbitrage. A still-unresolved manual_review
    remains excluded until the authoritative-terms fallback resolves it. True
    pair-identity conflicts (including a sports rule-defined event-date mismatch)
    remain excluded because they are not the same underlying contract.
    """
    admitted: List[Tuple[ExactContract, ExactContract]] = []
    status_counts = Counter()
    decision_reason_counts = Counter()
    rejected_reason_counts = Counter()
    rejected_samples: List[Dict[str, Any]] = []
    manual_terms_counts = Counter()
    pricing_only_count = 0

    for poly_contract, kalshi_contract in pairs:
        decision = verify_exact_pair(
            poly_contract,
            kalshi_contract,
            markets,
            require_exception_equivalence=True,
        )

        # Final fallback only. Known strict/conditional/rejected decisions do
        # not perform any network/PDF work.
        if decision.status == "manual_review":
            decision, manual_terms_outcome = (
                _retry_manual_settlement_with_authoritative_terms(
                    decision,
                    poly_contract,
                    kalshi_contract,
                    markets,
                )
            )
            manual_terms_counts[manual_terms_outcome] += 1

        status_counts[decision.status] += 1
        decision_reason_counts.update(decision.reasons)

        # Existing stream-eligible decisions are admitted. A definitive
        # non-equivalent settlement decision is also retained for live
        # comparison pricing when the matcher has established a real pair.
        # Identity/date conflicts are different: they indicate that the two
        # contracts are not actually the same underlying event/proposition,
        # so they must not enter the live pair manifest.
        non_pair_rejection_reasons = {
            "event_identity_mismatch",
            "contract_identity_mismatch",
            "rule_defined_event_date_mismatch",
        }
        rejected_but_comparable = bool(
            decision.status == "rejected"
            and not non_pair_rejection_reasons.intersection(decision.reasons)
        )
        pricing_eligible = bool(
            decision.stream_eligible
            or rejected_but_comparable
        )

        if decision.status == "rejected":
            rejected_reason_counts.update(decision.reasons)

        decision_payload = decision.to_dict()
        decision_payload["livePricingEligible"] = pricing_eligible
        decision_payload["arbitrageEligible"] = bool(decision.arbitrage_eligible)

        annotated_poly = replace(
            poly_contract,
            settlement_status=decision.status,
            settlement_stream_eligible=pricing_eligible,
            settlement_verified=decision.arbitrage_eligible,
            settlement_signature=decision_payload,
            settlement_reasons=tuple(decision.reasons),
        )
        annotated_kalshi = replace(
            kalshi_contract,
            settlement_status=decision.status,
            settlement_stream_eligible=pricing_eligible,
            settlement_verified=decision.arbitrage_eligible,
            settlement_signature=decision_payload,
            settlement_reasons=tuple(decision.reasons),
        )

        if pricing_eligible:
            admitted.append((annotated_poly, annotated_kalshi))
            if not decision.arbitrage_eligible:
                pricing_only_count += 1
            continue

        if len(rejected_samples) < 20:
            poly_market = markets[poly_contract.market_id]
            kalshi_market = markets[kalshi_contract.market_id]
            rejected_samples.append(
                {
                    "eventTitle": poly_contract.event_title,
                    "contractTitle": poly_contract.contract_title,
                    "status": decision.status,
                    "reasons": list(decision.reasons),
                    "polymarketMarketId": poly_market.external_market_id,
                    "kalshiMarketId": kalshi_market.external_market_id,
                    "polymarketSignature": decision.polymarket.to_dict(),
                    "kalshiSignature": decision.kalshi.to_dict(),
                }
            )

    return admitted, {
        f"{market_group}SettlementCandidates": len(pairs),
        # Backward-compatible field: now means live-pricing eligible rather
        # than arbitrage eligible.
        f"{market_group}SettlementStreamEligiblePairs": len(admitted),
        f"{market_group}SettlementPricingEligiblePairs": len(admitted),
        f"{market_group}SettlementStrictVerifiedPairs": status_counts["strict_verified"],
        f"{market_group}SettlementConditionalPairs": status_counts[
            "core_verified_exception_risk"
        ],
        f"{market_group}SettlementRejectedPairs": status_counts["rejected"],
        f"{market_group}SettlementManualReviewPairs": status_counts["manual_review"],
        f"{market_group}SettlementExcludedFromPricingPairs": (
            len(pairs) - len(admitted)
        ),
        f"{market_group}SettlementPricingOnlyPairs": pricing_only_count,
        f"{market_group}SettlementStatuses": dict(sorted(status_counts.items())),
        f"{market_group}SettlementDecisionReasons": dict(
            sorted(decision_reason_counts.items())
        ),
        f"{market_group}SettlementRejectedReasons": dict(
            sorted(rejected_reason_counts.items())
        ),
        f"{market_group}SettlementRejectionReasons": dict(
            sorted(rejected_reason_counts.items())
        ),
        f"{market_group}SettlementRejectedSamples": rejected_samples,
        f"{market_group}ManualTermsAutoResolution": dict(
            sorted(manual_terms_counts.items())
        ),
        "settlementVerifierVersion": SETTLEMENT_VERSION,
        "settlementGateMode": "matched-live-pricing-strict-arbitrage",
    }

def build_exact_pair_context(
    market_group: str = "all",
) -> ExactPairContext:
    allowed_groups = {
        "all",
        "sports",
        "macro",
        "weather",
        "generic",
        *GENERIC_MARKET_GROUPS,
    }
    if market_group not in allowed_groups:
        raise ValueError(
            "market_group must be all, sports, macro, weather, generic, or "
            + ", ".join(GENERIC_MARKET_GROUPS)
            + "."
        )

    include_sports = market_group in {
        "all",
        "sports",
    }
    include_macro = market_group in {
        "all",
        "macro",
    }
    include_weather = market_group in {
        "all",
        "weather",
    }

    # Generic groups are now part of the production "all" context. Every
    # semantically matched pair is eligible for live comparison pricing once
    # settlement review reaches a definitive state. Strict settlement
    # equivalence remains a separate requirement for Gross/Net arbitrage.
    include_generic = (
        market_group in {"all", "generic"}
        or market_group in GENERIC_MARKET_GROUPS
    )
    selected_generic_groups: Optional[Set[str]] = None
    if market_group in {"all", "generic"}:
        selected_generic_groups = set(GENERIC_MARKET_GROUPS)
    elif market_group in GENERIC_MARKET_GROUPS:
        selected_generic_groups = {market_group}

    (
        events,
        markets,
        markets_by_event,
        venue_counts,
        generic_candidate_matches,
        generic_load_diagnostics,
    ) = load_catalog(
        include_sports=include_sports,
        include_macro=include_macro,
        include_weather=include_weather,
        include_generic=include_generic,
        generic_groups=selected_generic_groups,
    )

    sports_pairs: List[
        Tuple[ExactContract, ExactContract]
    ] = []
    macro_pairs: List[
        Tuple[ExactContract, ExactContract]
    ] = []
    macro_synthetic_candidates: List[
        SyntheticMacroCandidate
    ] = []
    weather_pairs: List[
        Tuple[ExactContract, ExactContract]
    ] = []
    generic_pairs: List[
        Tuple[ExactContract, ExactContract]
    ] = []
    diagnostics: Dict[str, Any] = dict(generic_load_diagnostics)

    if include_sports:
        sports_event_matches, sports_event_diagnostics, groups = (
            build_sports_event_matches(events)
        )
        sports_pairs, sports_contract_diagnostics = (
            build_sports_contract_pairs(
                sports_event_matches,
                groups,
                markets_by_event,
            )
        )
        diagnostics.update(sports_event_diagnostics)
        diagnostics.update(sports_contract_diagnostics)
        sports_pairs, sports_settlement_diagnostics = settlement_gate_pairs(
            sports_pairs,
            markets,
            "sports",
        )
        diagnostics.update(sports_settlement_diagnostics)
        diagnostics["sportsEventMatchMethods"] = dict(
            sorted(
                Counter(
                    match.match_method
                    for match in sports_event_matches
                ).items()
            )
        )

    if include_macro:
        (
            macro_pairs,
            macro_diagnostics,
        ) = build_macro_contract_pairs(
            markets
        )
        diagnostics.update(
            macro_diagnostics
        )
        macro_pairs, macro_settlement_diagnostics = settlement_gate_pairs(
            macro_pairs,
            markets,
            "macro",
        )
        diagnostics.update(macro_settlement_diagnostics)
        (
            macro_synthetic_candidates,
            macro_synthetic_diagnostics,
        ) = build_macro_synthetic_candidates(
            markets
        )
        diagnostics.update(
            macro_synthetic_diagnostics
        )

    if include_weather:
        (
            weather_pairs,
            weather_diagnostics,
        ) = build_weather_contract_pairs(
            markets
        )
        diagnostics.update(
            weather_diagnostics
        )
        weather_pairs, weather_settlement_diagnostics = settlement_gate_pairs(
            weather_pairs,
            markets,
            "weather",
        )
        diagnostics.update(weather_settlement_diagnostics)

    if include_generic:
        generic_pairs, generic_contract_diagnostics = build_generic_contract_pairs(
            generic_candidate_matches,
            markets,
        )
        diagnostics.update(generic_contract_diagnostics)
        generic_pairs, generic_settlement_diagnostics = settlement_gate_pairs(
            generic_pairs,
            markets,
            "generic",
        )
        diagnostics.update(generic_settlement_diagnostics)
        diagnostics["genericStreamEligibleByGroup"] = dict(
            sorted(
                Counter(
                    poly.market_group
                    for poly, _ in generic_pairs
                ).items()
            )
        )

    diagnostics["candidateEventsLoaded"] = len(events)
    diagnostics["candidateMarketsLoaded"] = len(markets)

    return ExactPairContext(
        events=events,
        markets=markets,
        markets_by_event=markets_by_event,
        venue_counts=venue_counts,
        sports_pairs=sports_pairs,
        macro_pairs=macro_pairs,
        macro_synthetic_candidates=macro_synthetic_candidates,
        weather_pairs=weather_pairs,
        generic_pairs=generic_pairs,
        diagnostics=diagnostics,
        snapshot_marker=prediction_snapshot_marker(),
    )



def build_live_fee_pricing_context(
    exact_context: Optional[ExactPairContext] = None,
    *,
    market_group: str = "all",
    reference_time: Optional[datetime] = None,
) -> LiveFeePricingContext:
    """
    Build reusable fee metadata for WebSocket-priced exact pairs.

    This performs no REST order-book fetches. It loads only Polymarket fee
    rates and Kalshi series/event fee configuration, then reuses the engine's
    authoritative route_payload() and price_pair() calculations.
    """
    context = (
        exact_context
        if exact_context is not None
        else build_exact_pair_context(market_group)
    )
    priced_at = reference_time or datetime.now(timezone.utc)

    pair_lookup: Dict[
        Tuple[str, str, str],
        Tuple[ExactContract, ExactContract],
    ] = {}
    polymarket_token_ids: List[str] = []

    for poly_contract, kalshi_contract in context.exact_pairs:
        poly_market = context.markets[poly_contract.market_id]
        kalshi_market = context.markets[kalshi_contract.market_id]

        lookup_key = (
            str(poly_market.external_market_id),
            str(kalshi_market.external_market_id),
            str(poly_contract.contract_identity),
        )
        pair_lookup[lookup_key] = (
            poly_contract,
            kalshi_contract,
        )

        if poly_contract.yes_key:
            polymarket_token_ids.append(
                str(poly_contract.yes_key)
            )
        if poly_contract.no_key:
            polymarket_token_ids.append(
                str(poly_contract.no_key)
            )

    with ThreadPoolExecutor(max_workers=2) as executor:
        polymarket_fee_future = executor.submit(
            fetch_polymarket_fee_rates,
            polymarket_token_ids,
        )
        kalshi_fee_future = executor.submit(
            fetch_kalshi_fee_configuration,
            priced_at,
        )

        polymarket_fee_rates = (
            polymarket_fee_future.result()
        )
        kalshi_fee_configuration = (
            kalshi_fee_future.result()
        )

    for poly_contract, _ in context.exact_pairs:
        poly_market = context.markets.get(
            poly_contract.market_id
        )
        if poly_market is None:
            continue

        live_rate = first_non_empty(
            polymarket_fee_rates.get(
                str(poly_contract.yes_key)
            ),
            polymarket_fee_rates.get(
                str(poly_contract.no_key)
            ),
        )
        if live_rate is None:
            continue

        poly_market.raw[
            "_livePolymarketFeeRate"
        ] = live_rate

    return LiveFeePricingContext(
        exact_context=context,
        pair_lookup=pair_lookup,
        kalshi_fee_configuration=(
            kalshi_fee_configuration
        ),
        generated_at=priced_at.isoformat(),
        polymarket_fee_rates_loaded=len(
            polymarket_fee_rates
        ),
    )


def _live_polymarket_book(
    asset_id: Any,
    quote: Any,
) -> Dict[str, Any]:
    quote_payload = quote if isinstance(quote, dict) else {}
    price = as_float(quote_payload.get("bestAsk"))
    size = as_float(quote_payload.get("bestAskSize"))

    asks = [
        {"price": as_float(row.get("price")), "size": as_float(row.get("size"))}
        for row in (quote_payload.get("askLevels") or [])
        if isinstance(row, dict)
        and as_float(row.get("price")) is not None
        and as_float(row.get("size")) is not None
        and as_float(row.get("size")) > 0
    ]
    if not asks and price is not None:
        asks.append({"price": price, "size": size})

    return {
        "asset_id": str(asset_id or ""),
        "asks": asks,
        "timestamp": first_non_empty(
            quote_payload.get("sourceTimestamp"),
            quote_payload.get("receivedAt"),
        ),
    }


def pair_lookup_missing_payload(
    snapshot: Dict[str, Any],
) -> Dict[str, Any]:
    relationship = str(
        snapshot.get("pair_relationship")
        or snapshot.get("pairRelationship")
        or "direct"
    )
    route_states = snapshot.get("routeStates")
    if not isinstance(route_states, list) or len(route_states) != 2:
        if relationship == "complement":
            route_keys = (
                ("polymarket_yes_kalshi_yes", "Buy Polymarket YES + Kalshi YES"),
                ("polymarket_no_kalshi_no", "Buy Polymarket NO + Kalshi NO"),
            )
        else:
            route_keys = (
                ("polymarket_yes_kalshi_no", "Buy Polymarket YES + Kalshi NO"),
                ("polymarket_no_kalshi_yes", "Buy Polymarket NO + Kalshi YES"),
            )
        route_states = [
            {"key": key, "description": description}
            for key, description in route_keys
        ]

    routes = []
    for route_state in route_states[:2]:
        key = str(route_state.get("key") or "unknown_route")
        description = str(route_state.get("description") or key)
        poly_source = route_state.get("polymarket") or {}
        kalshi_source = route_state.get("kalshi") or {}
        poly_leg = {
            "venue": "polymarket",
            "side": poly_source.get("side"),
            "ask": as_float(poly_source.get("ask")),
            "askSize": as_float(poly_source.get("askSize")),
            "status": "pair_lookup_missing",
            "reason": "pair_lookup_missing",
            "sourceReason": poly_source.get("reason"),
            "executable": False,
        }
        kalshi_leg = {
            "venue": "kalshi",
            "side": kalshi_source.get("side"),
            "ask": as_float(kalshi_source.get("ask")),
            "askSize": as_float(kalshi_source.get("askSize")),
            "status": "pair_lookup_missing",
            "reason": "pair_lookup_missing",
            "sourceReason": kalshi_source.get("reason"),
            "executable": False,
        }
        routes.append(
            unavailable_route_payload(
                key=key,
                description=description,
                polymarket_leg=poly_leg,
                kalshi_leg=kalshi_leg,
            )
        )

    return {
        "id": str(snapshot.get("id") or "pair_lookup_missing"),
        "marketGroup": snapshot.get("market_group") or snapshot.get("marketGroup"),
        "eventTitle": snapshot.get("event_title") or snapshot.get("eventTitle"),
        "contractTitle": snapshot.get("contract_title") or snapshot.get("contractTitle"),
        "scheduledTime": snapshot.get("scheduled_time") or snapshot.get("scheduledTime"),
        "eventKey": snapshot.get("event_key") or snapshot.get("eventKey"),
        "contractKey": snapshot.get("contract_key") or snapshot.get("contractKey"),
        "pairRelationship": relationship,
        "sideMapping": snapshot.get("side_mapping") or snapshot.get("sideMapping"),
        "matchMethod": None,
        "settlementStreamEligible": False,
        "settlementVerified": False,
        "settlementStatus": "unavailable",
        "settlementReasons": ["pair_lookup_missing"],
        "settlementSignature": {},
        "pairStatus": "unavailable",
        "pricingStatus": "pair_lookup_missing",
        "readyRouteCount": 0,
        "accountedRouteCount": 2,
        "allRoutesAccounted": True,
        "anyRouteReady": False,
        "routeStatusCounts": {"pair_lookup_missing": 2},
        "polymarket": snapshot.get("polymarket") or {},
        "kalshi": snapshot.get("kalshi") or {},
        "liquidity": {},
        "yesDifference": None,
        "noDifference": None,
        "routes": routes,
        "bestRoute": routes[0],
        "grossEdge": None,
        "bestGrossEdge": None,
        "estimatedFeesUsd": None,
        "estimatedFeesAtDisplayedDepthUsd": None,
        "netEdge": None,
        "bestNetEdge": None,
        "netReturnPercent": None,
        "netExecutableProfitUsd": None,
        "rawIsGrossArbitrage": False,
        "rawIsNetArbitrage": False,
        "rawIsNetArbitrageAtDisplayedDepth": False,
        "isGrossArbitrage": False,
        "isNetArbitrage": False,
        "feeEstimateComplete": False,
        "feeEstimateMethod": "pair-lookup-missing",
        "liveComplete": False,
        "pricingSource": "in-memory-websocket-books",
        "pricingError": "pair_lookup_missing",
    }

def price_live_pair_snapshot(
    snapshot: Dict[str, Any],
    pricing_context: LiveFeePricingContext,
) -> Dict[str, Any]:
    """Price one live snapshot without ever dropping an accounted pair."""
    polymarket_payload = as_json(snapshot.get("polymarket"), dict, {})
    kalshi_payload = as_json(snapshot.get("kalshi"), dict, {})

    lookup_key = (
        str(polymarket_payload.get("marketId") or ""),
        str(
            kalshi_payload.get("marketTicker")
            or kalshi_payload.get("marketId")
            or ""
        ),
        str(
            snapshot.get("contract_key")
            or snapshot.get("contractKey")
            or ""
        ),
    )
    pair = pricing_context.pair_lookup.get(lookup_key)
    if pair is None:
        return pair_lookup_missing_payload(snapshot)

    poly_contract, kalshi_contract = pair
    poly_yes_asset_id = str(
        polymarket_payload.get("yesAssetId") or poly_contract.yes_key or ""
    )
    poly_no_asset_id = str(
        polymarket_payload.get("noAssetId") or poly_contract.no_key or ""
    )

    polymarket_books = {
        poly_yes_asset_id: _live_polymarket_book(
            poly_yes_asset_id,
            polymarket_payload.get("yes"),
        ),
        poly_no_asset_id: _live_polymarket_book(
            poly_no_asset_id,
            polymarket_payload.get("no"),
        ),
    }

    kalshi_ticker = str(
        kalshi_payload.get("marketTicker")
        or kalshi_payload.get("marketId")
        or ""
    )
    kalshi_books = {
        kalshi_ticker: {
            "yes_ask": kalshi_payload.get("yesAsk"),
            "yes_ask_size": kalshi_payload.get("yesAskSize"),
            "no_ask": kalshi_payload.get("noAsk"),
            "no_ask_size": kalshi_payload.get("noAskSize"),
            "yes_ask_levels": kalshi_payload.get("yesAskLevels") or [],
            "no_ask_levels": kalshi_payload.get("noAskLevels") or [],
            "fetched_at": first_non_empty(
                kalshi_payload.get("sourceTimestamp"),
                kalshi_payload.get("receivedAt"),
            ),
        }
    }

    route_health = {
        str(route.get("key") or ""): route
        for route in snapshot.get("routeStates", [])
        if isinstance(route, dict) and route.get("key")
    }

    priced = price_pair(
        poly_contract,
        kalshi_contract,
        pricing_context.exact_context.markets,
        polymarket_books,
        kalshi_books,
        pricing_context.kalshi_fee_configuration,
        route_health=route_health,
        source_snapshot=snapshot,
    )

    priced["liveComplete"] = bool(priced.get("readyRouteCount") == 2)
    priced["pricingSource"] = "in-memory-websocket-books"
    priced["feePricingGeneratedAt"] = pricing_context.generated_at
    priced["streamPairStatus"] = snapshot.get("pairStatus")
    priced["streamReadyRouteCount"] = snapshot.get("readyRouteCount")
    priced["streamRouteStates"] = snapshot.get("routeStates") or []

    if kalshi_payload.get("volume") is not None:
        priced["kalshi"]["lifetimeVolume"] = kalshi_payload.get("volume")
        priced["liquidity"]["kalshiLifetimeVolumeContracts"] = (
            kalshi_payload.get("volume")
        )
    if kalshi_payload.get("openInterest") is not None:
        priced["kalshi"]["openInterest"] = kalshi_payload.get("openInterest")
        priced["liquidity"]["kalshiOpenInterestContracts"] = (
            kalshi_payload.get("openInterest")
        )

    return priced

def live_sports_subscription_manifest(
    *,
    lead_seconds: int = 300,
    reference_time: Optional[datetime] = None,
    eligible_only: bool = False,
) -> Dict[str, Any]:
    if lead_seconds < 0:
        raise ValueError("lead_seconds must be non-negative")

    now = reference_time or datetime.now(timezone.utc)
    context = build_exact_pair_context("sports")
    rows: List[Dict[str, Any]] = []

    for poly_contract, kalshi_contract in context.sports_pairs:
        poly_market = context.markets[poly_contract.market_id]
        kalshi_market = context.markets[kalshi_contract.market_id]
        scheduled = parse_datetime(
            poly_contract.scheduled_time
            or kalshi_contract.scheduled_time
        )
        seconds_until_start = (
            round((scheduled - now).total_seconds())
            if scheduled is not None
            else None
        )

        close_times = [
            value
            for value in (
                poly_market.close_time,
                kalshi_market.close_time,
                poly_market.event.close_time,
                kalshi_market.event.close_time,
            )
            if value is not None
        ]
        latest_close = max(close_times) if close_times else None
        definitively_closed = bool(
            latest_close is not None
            and latest_close <= now
            and poly_market.accepting_orders is not True
            and kalshi_market.accepting_orders is not True
        )
        eligible_now = bool(
            scheduled is not None
            and seconds_until_start is not None
            and seconds_until_start <= lead_seconds
            and not definitively_closed
        )

        if eligible_only and not eligible_now:
            continue

        rows.append(
            {
                "id": (
                    f"sports-{poly_market.id}-{kalshi_market.id}-"
                    f"{poly_contract.contract_identity}"
                ),
                "eventKey": poly_contract.event_identity,
                "contractKey": poly_contract.contract_identity,
                "eventTitle": poly_contract.event_title,
                "contractTitle": poly_contract.contract_title,
                "scheduledTime": iso_value(scheduled),
                "secondsUntilStart": seconds_until_start,
                "eligibleNow": eligible_now,
                "pairRelationship": poly_contract.pair_relationship,
                "matchMethod": poly_contract.event_match_method,
                "polymarket": {
                    "marketId": poly_market.external_market_id,
                    "eventId": poly_market.external_event_id,
                    "yesAssetId": poly_contract.yes_key,
                    "noAssetId": poly_contract.no_key,
                    "closeTime": iso_value(poly_market.close_time),
                    "acceptingOrders": poly_market.accepting_orders,
                },
                "kalshi": {
                    "marketTicker": kalshi_market.external_market_id,
                    "eventTicker": kalshi_market.external_event_id,
                    "yesKey": kalshi_contract.yes_key,
                    "noKey": kalshi_contract.no_key,
                    "closeTime": iso_value(kalshi_market.close_time),
                    "acceptingOrders": kalshi_market.accepting_orders,
                },
            }
        )

    rows.sort(
        key=lambda row: (
            row["secondsUntilStart"] is None,
            row["secondsUntilStart"]
            if row["secondsUntilStart"] is not None
            else float("inf"),
            row["eventTitle"],
        )
    )

    return {
        "engineVersion": ENGINE_VERSION,
        "generatedAt": now.isoformat(),
        "snapshotMarker": context.snapshot_marker,
        "leadSeconds": lead_seconds,
        "exactSportsPairs": len(context.sports_pairs),
        "returnedPairs": len(rows),
        "pairs": rows,
        "diagnostics": context.diagnostics,
    }

def run_full_scan() -> Dict[str, Any]:
    started = time.perf_counter()
    scan_reference_time = datetime.now(timezone.utc)
    context = build_exact_pair_context("all")
    loaded_and_matched = time.perf_counter()

    markets = context.markets
    exact_pairs = context.exact_pairs
    synthetic_macro_candidates = context.macro_synthetic_candidates
    token_ids = [
        token
        for poly, _ in exact_pairs
        for token in (poly.yes_key, poly.no_key)
    ]
    token_ids.extend(
        token
        for candidate in synthetic_macro_candidates
        for token in (
            candidate.polymarket_contract.yes_key,
            candidate.polymarket_contract.no_key,
        )
    )
    polymarket_fee_token_ids = list(
        dict.fromkeys(
            [
                poly.yes_key
                for poly, _ in exact_pairs
                if poly.yes_key
            ]
            + [
                candidate.polymarket_contract.yes_key
                for candidate in synthetic_macro_candidates
                if candidate.polymarket_contract.yes_key
            ]
        )
    )
    kalshi_tickers = [
        markets[kalshi.market_id].external_market_id
        for _, kalshi in exact_pairs
    ]
    kalshi_tickers.extend(
        ticker
        for candidate in synthetic_macro_candidates
        for ticker in (
            markets[
                candidate.lower_kalshi_contract.market_id
            ].external_market_id,
            markets[
                candidate.upper_kalshi_contract.market_id
            ].external_market_id,
        )
    )

    def timed_polymarket_books() -> Tuple[Dict[str, Dict[str, Any]], float]:
        book_started = time.perf_counter()
        books = fetch_polymarket_books(token_ids) if token_ids else {}
        return books, time.perf_counter() - book_started

    def timed_kalshi_books() -> Tuple[Dict[str, Dict[str, Any]], float]:
        book_started = time.perf_counter()
        books = fetch_kalshi_books(kalshi_tickers) if kalshi_tickers else {}
        return books, time.perf_counter() - book_started

    def timed_polymarket_fees() -> Tuple[
        Dict[str, float],
        float,
    ]:
        fee_started = time.perf_counter()

        rates = fetch_polymarket_fee_rates(
            polymarket_fee_token_ids
        )

        return (
            rates,
            time.perf_counter() - fee_started,
        )

    def timed_kalshi_fees() -> Tuple[Dict[str, Any], float]:
        fee_started = time.perf_counter()
        configuration = fetch_kalshi_fee_configuration(scan_reference_time)
        return configuration, time.perf_counter() - fee_started

    with ThreadPoolExecutor(
            max_workers=4
    ) as executor:
        polymarket_future = executor.submit(
            timed_polymarket_books
        )

        polymarket_fee_future = executor.submit(
            timed_polymarket_fees
        )

        kalshi_future = executor.submit(
            timed_kalshi_books
        )

        kalshi_fee_future = executor.submit(
            timed_kalshi_fees
        )

        (
            polymarket_books,
            polymarket_book_seconds,
        ) = polymarket_future.result()

        (
            polymarket_fee_rates,
            polymarket_fee_seconds,
        ) = polymarket_fee_future.result()

        (
            kalshi_books,
            kalshi_book_seconds,
        ) = kalshi_future.result()

        (
            kalshi_fee_configuration,
            kalshi_fee_seconds,
        ) = kalshi_fee_future.result()
    polymarket_contracts_for_fee_metadata = [
        poly_contract
        for poly_contract, _ in exact_pairs
    ] + [
        candidate.polymarket_contract
        for candidate in synthetic_macro_candidates
    ]

    for poly_contract in polymarket_contracts_for_fee_metadata:
        live_rate = polymarket_fee_rates.get(
            poly_contract.yes_key
        )

        if live_rate is None:
            continue

        poly_market = markets.get(
            poly_contract.market_id
        )

        if poly_market is None:
            continue

        poly_market.raw[
            "_livePolymarketFeeRate"
        ] = live_rate

    books_loaded = time.perf_counter()
    pricing_failures: Counter = Counter()
    discrepancies: List[Dict[str, Any]] = []

    for poly, kalshi in exact_pairs:
        priced = price_pair(
            poly,
            kalshi,
            markets,
            polymarket_books,
            kalshi_books,
            kalshi_fee_configuration,
            pricing_failures,
        )
        if not priced:
            continue
        priced.update(
            event_timing_payload(
                priced["marketGroup"],
                priced.get("scheduledTime"),
                scan_reference_time,
            )
        )
        discrepancies.append(priced)

    for candidate in synthetic_macro_candidates:
        priced = price_synthetic_macro_candidate(
            candidate,
            markets,
            polymarket_books,
            kalshi_books,
            kalshi_fee_configuration,
            pricing_failures,
        )
        if not priced:
            continue
        priced.update(
            event_timing_payload(
                "macro",
                priced.get("scheduledTime"),
                scan_reference_time,
            )
        )
        discrepancies.append(priced)

    discrepancies.sort(
        key=lambda row: (
            row["feeEstimateComplete"],
            (
                row["bestNetEdge"]
                if row["bestNetEdge"] is not None
                else (
                    row["bestGrossEdge"]
                    if row["bestGrossEdge"] is not None
                    else -999.0
                )
            ),
            max(
                abs(float(row.get("yesDifference") or 0.0)),
                abs(float(row.get("noDifference") or 0.0)),
            ),
        ),
        reverse=True,
    )
    finished = time.perf_counter()

    sports_priced = sum(
        row["marketGroup"] == "sports" for row in discrepancies
    )
    macro_priced = sum(
        row["marketGroup"] == "macro"
        for row in discrepancies
    )
    weather_priced = sum(
        row["marketGroup"] == "weather"
        for row in discrepancies
    )
    generic_priced = sum(
        row["marketGroup"] in GENERIC_MARKET_GROUPS
        for row in discrepancies
    )
    fee_complete_matches = sum(
        bool(row.get("feeEstimateComplete")) for row in discrepancies
    )
    phase_counts = Counter(row["eventPhase"] for row in discrepancies)
    macro_direct_priced = sum(
        row["marketGroup"] == "macro"
        and row.get("pairRelationship") == "direct"
        for row in discrepancies
    )
    macro_complement_priced = sum(
        row["marketGroup"] == "macro"
        and row.get("pairRelationship") == "complement"
        for row in discrepancies
    )
    macro_synthetic_priced = sum(
        row["marketGroup"] == "macro"
        and row.get("pairRelationship") == "synthetic_threshold_ladder"
        for row in discrepancies
    )
    macro_synthetic_gross = sum(
        row.get("pairRelationship") == "synthetic_threshold_ladder"
        and row.get("isGrossArbitrage") is True
        for row in discrepancies
    )
    macro_synthetic_net = sum(
        row.get("pairRelationship") == "synthetic_threshold_ladder"
        and row.get("isNetArbitrage") is True
        for row in discrepancies
    )
    macro_synthetic_execution_ready = sum(
        row.get("pairRelationship") == "synthetic_threshold_ladder"
        and row.get("isExecutionReady") is True
        for row in discrepancies
    )

    gross_arbitrage_by_group = Counter(
        row["marketGroup"]
        for row in discrepancies
        if row.get("isGrossArbitrage") is True
    )

    net_arbitrage_by_group = Counter(
        row["marketGroup"]
        for row in discrepancies
        if row.get("isNetArbitrage") is True
    )

    gross_arbitrage_matches = sum(
        gross_arbitrage_by_group.values()
    )

    net_arbitrage_matches = sum(
        net_arbitrage_by_group.values()
    )

    diagnostics = dict(context.diagnostics)
    diagnostics["pricingFailures"] = dict(sorted(pricing_failures.items()))

    sports_contracts = diagnostics.get("polymarketSportsContracts", 0) + (
        diagnostics.get("kalshiSportsContracts", 0)
    )
    macro_contracts = diagnostics.get(
        "polymarketMacroContracts",
        0,
    ) + diagnostics.get(
        "kalshiMacroContracts",
        0,
    )
    weather_contracts = diagnostics.get(
        "polymarketWeatherContracts",
        0,
    ) + diagnostics.get(
        "kalshiWeatherContracts",
        0,
    )

    return {
        "engineVersion": ENGINE_VERSION,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "snapshotMarker": context.snapshot_marker,
        "cached": False,
        "summary": {
            "polymarketActiveMarkets": context.venue_counts["polymarket"],
            "kalshiActiveMarkets": context.venue_counts["kalshi"],
            "catalogCandidates": len(markets),
            "eligibleContracts": (
                sports_contracts
                + macro_contracts
                + weather_contracts
            ),
            "polymarketSportsEligible": diagnostics.get(
                "polymarketSportsContracts", 0
            ),
            "kalshiSportsEligible": diagnostics.get(
                "kalshiSportsContracts", 0
            ),
            "polymarketMacroEligible": diagnostics.get(
                "polymarketMacroContracts", 0
            ),
            "kalshiMacroEligible": diagnostics.get(
                "kalshiMacroContracts",
                0,
            ),
            "polymarketWeatherEligible": diagnostics.get(
                "polymarketWeatherContracts",
                0,
            ),
            "kalshiWeatherEligible": diagnostics.get(
                "kalshiWeatherContracts",
                0,
            ),
            "exactMatches": len(exact_pairs),
            "syntheticMacroCandidates": len(
                synthetic_macro_candidates
            ),
            "candidateRoutes": (
                len(exact_pairs)
                + len(synthetic_macro_candidates)
            ),
            "pricedMatches": len(discrepancies),
            "sportsMatches": sports_priced,
            "macroMatches": macro_priced,
            "weatherMatches": weather_priced,
            "genericMatches": generic_priced,
            "feeCompleteMatches": fee_complete_matches,
            "feeUnavailableMatches": len(discrepancies) - fee_complete_matches,
            "grossArbitrageMatches": gross_arbitrage_matches,
            "netArbitrageMatches": net_arbitrage_matches,

            "sportsGrossArbitrageMatches": gross_arbitrage_by_group["sports"],
            "sportsNetArbitrageMatches": net_arbitrage_by_group["sports"],

            "macroGrossArbitrageMatches": gross_arbitrage_by_group["macro"],
            "macroNetArbitrageMatches": net_arbitrage_by_group["macro"],
            "weatherGrossArbitrageMatches": gross_arbitrage_by_group["weather"],
            "weatherNetArbitrageMatches": net_arbitrage_by_group["weather"],
            "genericGrossArbitrageMatches": sum(
                gross_arbitrage_by_group[group] for group in GENERIC_MARKET_GROUPS
            ),
            "genericNetArbitrageMatches": sum(
                net_arbitrage_by_group[group] for group in GENERIC_MARKET_GROUPS
            ),
            "macroDirectMatches": macro_direct_priced,
            "macroComplementMatches": macro_complement_priced,
            "macroSyntheticMatches": macro_synthetic_priced,
            "macroSyntheticGrossArbitrageMatches": macro_synthetic_gross,
            "macroSyntheticNetArbitrageMatches": macro_synthetic_net,
            "macroSyntheticExecutionReadyMatches": (
                macro_synthetic_execution_ready
            ),
            "liveMatches": phase_counts["live"],
            "upcomingMatches": phase_counts["upcoming"],
            "recentMatches": phase_counts["recent"],
            "unscheduledMatches": phase_counts["unscheduled"],
            "liveWindowSeconds": LIVE_SPORTS_EVENT_WINDOW_SECONDS,
            "polymarketBooksRequested": len(set(token_ids)),
            "polymarketBooksLoaded": len(polymarket_books),
            "polymarketFeeRatesRequested": len(
                polymarket_fee_token_ids
            ),
            "polymarketFeeRatesLoaded": len(
                polymarket_fee_rates
            ),
            "kalshiBooksRequested": len(set(kalshi_tickers)),
            "kalshiBooksLoaded": len(kalshi_books),
            "scanDurationMs": round((finished - started) * 1000),
            "catalogAndExactMatchMs": round(
                (loaded_and_matched - started) * 1000
            ),
            "quoteLoadMs": 0,
            "polymarketBookLoadMs": round(
                polymarket_book_seconds * 1000
            ),
            "polymarketFeeRateLoadMs": round(
                polymarket_fee_seconds * 1000
            ),
            "kalshiBookLoadMs": round(kalshi_book_seconds * 1000),
            "kalshiFeeConfigLoadMs": round(kalshi_fee_seconds * 1000),
            "pricingMs": round((finished - books_loaded) * 1000),
        },
        "diagnostics": diagnostics,
        "discrepancies": discrepancies,
    }



def cached_full_scan() -> Dict[str, Any]:
    now = time.monotonic()
    cached = _scan_cache.get("payload")
    if cached is not None and now < _scan_cache["expires_at"]:
        payload = copy.deepcopy(cached)
        payload["cached"] = True
        return payload

    with _scan_lock:
        now = time.monotonic()
        cached = _scan_cache.get("payload")
        if cached is not None and now < _scan_cache["expires_at"]:
            payload = copy.deepcopy(cached)
            payload["cached"] = True
            return payload
        payload = run_full_scan()
        _scan_cache["payload"] = copy.deepcopy(payload)
        _scan_cache["expires_at"] = time.monotonic() + ENGINE_CACHE_SECONDS
        return payload

def scan_prediction_market_discrepancies(
    *,
    market_group: str = "all",
    opportunity_type: str = "all",
    min_gross_edge: float = -1.0,
    time_window: str = "all",
    sort_by: str = "time",
    timezone_offset_minutes: int = 0,
    limit: int = 100,
) -> Dict[str, Any]:
    if market_group not in {
        "all",
        "sports",
        "macro",
        "weather",
        "generic",
        *GENERIC_MARKET_GROUPS,
    }:
        raise ValueError(
            "market_group must be all, sports, macro, weather, generic, or "
            + ", ".join(GENERIC_MARKET_GROUPS)
            + "."
        )

    if opportunity_type not in {
        "all",
        "gross",
        "net",
        "watchlist",
    }:
        raise ValueError(
            "opportunity_type must be all, gross, net, or watchlist."
        )

    if time_window not in {
        "all",
        "live",
        "today",
        "upcoming",
    }:
        raise ValueError(
            "time_window must be all, live, today, or upcoming."
        )

    if sort_by not in {"time", "edge"}:
        raise ValueError(
            "sort_by must be time or edge."
        )

    if not -840 <= timezone_offset_minutes <= 840:
        raise ValueError(
            "timezone_offset_minutes must be between -840 and 840."
        )

    payload = cached_full_scan()

    reference_time = (
        parse_datetime(payload["generatedAt"])
        or datetime.now(timezone.utc)
    )

    all_rows = payload["discrepancies"]

    for row in all_rows:
        row["isToday"] = is_today_for_offset(
            row.get("scheduledTime"),
            reference_time,
            timezone_offset_minutes,
        )

        if row.get("pairRelationship") == "synthetic_threshold_ladder":
            if (
                row.get("isNetArbitrage") is True
                and row.get("isExecutionReady") is True
            ):
                row["opportunityStatus"] = (
                    "synthetic_net_arbitrage_execution_ready"
                )
            elif row.get("isNetArbitrage") is True:
                row["opportunityStatus"] = (
                    "synthetic_net_edge_below_execution_buffer"
                )
            elif row.get("isGrossArbitrage") is True:
                row["opportunityStatus"] = (
                    "synthetic_gross_edge_watchlist"
                )
            else:
                row["opportunityStatus"] = "synthetic_comparison_only"
        elif row.get("isNetArbitrage") is True:
            row["opportunityStatus"] = "confirmed_net_arbitrage"
        elif row.get("isGrossArbitrage") is True:
            row["opportunityStatus"] = "gross_edge_watchlist"
        else:
            row["opportunityStatus"] = "comparison_only"

    payload["summary"]["todayMatches"] = sum(
        bool(row["isToday"])
        for row in all_rows
    )

    def in_time_window(row: Dict[str, Any]) -> bool:
        if time_window == "all":
            return True

        if time_window == "today":
            return bool(row["isToday"])

        return row.get("eventPhase") == time_window

    def matches_opportunity_type(
        row: Dict[str, Any],
    ) -> bool:
        if opportunity_type == "all":
            return True

        if opportunity_type == "gross":
            # Includes confirmed net arbitrage because every net
            # arbitrage must also have a positive gross edge.
            return row.get("isGrossArbitrage") is True

        if opportunity_type == "net":
            return row.get("isNetArbitrage") is True

        if opportunity_type == "watchlist":
            return (
                row.get("isGrossArbitrage") is True
                and row.get("isNetArbitrage") is not True
            )

        return False

    filtered = [
        row
        for row in all_rows
        if (
            market_group == "all"
            or row["marketGroup"] == market_group
        )
        and (
            row.get("bestGrossEdge") is not None
            and row["bestGrossEdge"] >= min_gross_edge
        )
        and in_time_window(row)
        and matches_opportunity_type(row)
    ]

    if sort_by == "time":
        filtered.sort(
            key=schedule_sort_key
        )
    else:
        def opportunity_edge(
            row: Dict[str, Any],
        ) -> float:
            if opportunity_type == "net":
                value = row.get("bestNetEdge")
                return (
                    float(value)
                    if value is not None
                    else -999.0
                )

            value = row.get("bestGrossEdge")
            return (
                float(value)
                if value is not None
                else -999.0
            )

        filtered.sort(
            key=lambda row: (
                opportunity_edge(row),
                max(
                    abs(row["yesDifference"]),
                    abs(row["noDifference"]),
                ),
            ),
            reverse=True,
        )

    payload["discrepancies"] = filtered[:limit]
    payload["returnedMatches"] = len(
        payload["discrepancies"]
    )

    payload["filters"] = {
        "marketGroup": market_group,
        "opportunityType": opportunity_type,
        "minGrossEdge": min_gross_edge,
        "timeWindow": time_window,
        "sortBy": sort_by,
        "timezoneOffsetMinutes": timezone_offset_minutes,
        "limit": limit,
    }

    return payload

def macro_diagnostics_payload() -> Dict[str, Any]:
    started = time.perf_counter()
    context = build_exact_pair_context(
        "macro"
    )
    return {
        "engineVersion": ENGINE_VERSION,
        "generatedAt": (
            datetime.now(
                timezone.utc
            ).isoformat()
        ),
        "snapshotMarker": (
            context.snapshot_marker
        ),
        "macroExactPairs": len(
            context.macro_pairs
        ),
        "macroSyntheticCandidates": len(
            context.macro_synthetic_candidates
        ),
        "diagnostics": (
            context.diagnostics
        ),
        "durationMs": round(
            (
                time.perf_counter()
                - started
            )
            * 1000
        ),
    }


def weather_diagnostics_payload() -> Dict[str, Any]:
    started = time.perf_counter()
    context = build_exact_pair_context(
        "weather"
    )
    return {
        "engineVersion": ENGINE_VERSION,
        "generatedAt": (
            datetime.now(
                timezone.utc
            ).isoformat()
        ),
        "snapshotMarker": (
            context.snapshot_marker
        ),
        "weatherExactPairs": len(
            context.weather_pairs
        ),
        "diagnostics": (
            context.diagnostics
        ),
        "durationMs": round(
            (
                time.perf_counter()
                - started
            )
            * 1000
        ),
    }


def generic_diagnostics_payload(
    market_group: str = "generic",
) -> Dict[str, Any]:
    if market_group != "generic" and market_group not in GENERIC_MARKET_GROUPS:
        raise ValueError(
            "generic diagnostics group must be generic or one of: "
            + ", ".join(GENERIC_MARKET_GROUPS)
        )
    started = time.perf_counter()
    context = build_exact_pair_context(market_group)
    pairs_by_group = Counter(
        poly.market_group
        for poly, _ in context.generic_pairs
    )
    pair_samples = []
    for poly, kalshi in context.generic_pairs[:40]:
        poly_market = context.markets[poly.market_id]
        kalshi_market = context.markets[kalshi.market_id]
        pair_samples.append({
            "marketGroup": poly.market_group,
            "settlementStatus": poly.settlement_status,
            "settlementVerified": poly.settlement_verified,
            "contractIdentity": poly.contract_identity,
            "eventIdentity": poly.event_identity,
            "matchMethod": poly.event_match_method,
            "polymarketMarketId": poly_market.external_market_id,
            "polymarketEventTitle": poly_market.event.title,
            "polymarketTitle": poly_market.market_title,
            "kalshiMarketId": kalshi_market.external_market_id,
            "kalshiEventTitle": kalshi_market.event.title,
            "kalshiTitle": kalshi_market.market_title,
            "settlementReasons": list(poly.settlement_reasons),
        })
    return {
        "engineVersion": ENGINE_VERSION,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "snapshotMarker": context.snapshot_marker,
        "requestedGroup": market_group,
        "genericExactPairs": len(context.generic_pairs),
        "pairsByGroup": dict(sorted(pairs_by_group.items())),
        "pairSamples": pair_samples,
        "diagnostics": context.diagnostics,
        "durationMs": round((time.perf_counter() - started) * 1000),
    }


def settlement_diagnostics_payload() -> Dict[str, Any]:
    started = time.perf_counter()
    context = build_exact_pair_context("all")
    keys = (
        "settlementVerifierVersion",
        "settlementGateMode",
        "sportsSettlementCandidates",
        "sportsSettlementStreamEligiblePairs",
        "sportsSettlementStrictVerifiedPairs",
        "sportsSettlementConditionalPairs",
        "sportsSettlementRejectedPairs",
        "sportsSettlementStatuses",
        "sportsSettlementRejectionReasons",
        "sportsSettlementRejectedSamples",
        "macroSettlementCandidates",
        "macroSettlementStrictVerifiedPairs",
        "macroSettlementRejectedPairs",
        "weatherSettlementCandidates",
        "weatherSettlementStrictVerifiedPairs",
        "weatherSettlementRejectedPairs",
    )
    diagnostics = {
        key: context.diagnostics.get(key)
        for key in keys
        if key in context.diagnostics
    }
    return {
        "engineVersion": ENGINE_VERSION,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "snapshotMarker": context.snapshot_marker,
        "streamEligibleExactPairs": len(context.exact_pairs),
        "diagnostics": diagnostics,
        "durationMs": round((time.perf_counter() - started) * 1000),
    }


def route_pricing_self_test() -> Dict[str, Any]:
    dummy_event = type(
        "DummyEvent",
        (),
        {
            "external_series_id": "KXTEST",
            "external_event_id": "KXTEST-EVENT",
            "raw": {},
        },
    )()
    poly_market = type(
        "DummyMarket",
        (),
        {
            "id": 1,
            "venue": "polymarket",
            "event": dummy_event,
            "external_market_id": "poly-market",
            "external_event_id": "poly-event",
            "external_series_id": None,
            "market_slug": None,
            "raw": {"feesEnabled": False},
            "liquidity": 1000.0,
            "volume_24h": 500.0,
            "total_volume": 5000.0,
            "open_interest": None,
            "resolution_time": datetime(2026, 8, 20, 12, 0, tzinfo=timezone.utc),
            "close_time": datetime(2026, 8, 20, 13, 0, tzinfo=timezone.utc),
            "settlement_time": datetime(2026, 8, 20, 14, 0, tzinfo=timezone.utc),
        },
    )()
    kalshi_market = type(
        "DummyMarket",
        (),
        {
            "id": 2,
            "venue": "kalshi",
            "event": dummy_event,
            "external_market_id": "KXTEST-MARKET",
            "external_event_id": "KXTEST-EVENT",
            "external_series_id": "KXTEST",
            "market_slug": None,
            "raw": {},
            "liquidity": 2000.0,
            "volume_24h": 100.0,
            "total_volume": 1000.0,
            "open_interest": 400.0,
            "resolution_time": datetime(2026, 8, 20, 12, 30, tzinfo=timezone.utc),
            "close_time": datetime(2026, 8, 20, 13, 30, tzinfo=timezone.utc),
            "settlement_time": datetime(2026, 8, 20, 15, 0, tzinfo=timezone.utc),
        },
    )()
    poly_contract = ExactContract(
        market_id=1,
        venue="polymarket",
        event_identity="test-event",
        contract_identity="test-contract",
        market_group="sports",
        event_title="Test Event",
        contract_title="Test Contract",
        scheduled_time=None,
        yes_key="poly-yes",
        no_key="poly-no",
        yes_label="Yes",
        no_label="No",
        event_match_method="self_test",
        settlement_status="strict_verified",
        settlement_stream_eligible=True,
        settlement_verified=True,
    )
    kalshi_contract = ExactContract(
        market_id=2,
        venue="kalshi",
        event_identity="test-event",
        contract_identity="test-contract",
        market_group="sports",
        event_title="Test Event",
        contract_title="Test Contract",
        scheduled_time=None,
        yes_key="yes",
        no_key="no",
        yes_label="Yes",
        no_label="No",
        event_match_method="self_test",
        settlement_status="strict_verified",
        settlement_stream_eligible=True,
        settlement_verified=True,
    )
    fee_configuration = {
        "seriesLoaded": True,
        "eventsLoaded": True,
        "series": {},
        "events": {},
    }

    full = price_pair(
        poly_contract,
        kalshi_contract,
        {1: poly_market, 2: kalshi_market},
        {
            "poly-yes": {"asks": [{"price": 0.40, "size": 10.0}]},
            "poly-no": {"asks": [{"price": 0.60, "size": 20.0}]},
        },
        {
            "KXTEST-MARKET": {
                "yes_ask": 0.55,
                "yes_ask_size": 15.0,
                "no_ask": 0.45,
                "no_ask_size": 12.0,
            }
        },
        fee_configuration,
    )
    assert len(full["routes"]) == 2
    assert full["accountedRouteCount"] == 2
    assert full["readyRouteCount"] == 2
    assert full["routes"][0]["status"] == "net_opportunity"
    assert full["routes"][1]["status"] == "no_opportunity"
    assert full["settlementTime"] == "2026-08-20T15:00:00+00:00"
    assert full["polymarket"]["settlementTime"] == "2026-08-20T14:00:00+00:00"
    assert full["kalshi"]["settlementTime"] == "2026-08-20T15:00:00+00:00"

    partial = price_pair(
        poly_contract,
        kalshi_contract,
        {1: poly_market, 2: kalshi_market},
        {
            "poly-yes": {"asks": [{"price": 0.40, "size": 10.0}]},
        },
        {
            "KXTEST-MARKET": {
                "yes_ask": None,
                "yes_ask_size": None,
                "no_ask": 0.45,
                "no_ask_size": 12.0,
            }
        },
        fee_configuration,
    )
    assert partial["pairStatus"] == "partially_ready"
    assert partial["readyRouteCount"] == 1
    assert partial["routes"][0]["executable"] is True
    assert partial["routes"][1]["status"] == "missing_polymarket_book"

    unavailable = price_pair(
        poly_contract,
        kalshi_contract,
        {1: poly_market, 2: kalshi_market},
        {},
        {},
        fee_configuration,
    )
    assert unavailable["pairStatus"] == "unavailable"
    assert unavailable["accountedRouteCount"] == 2
    assert len(unavailable["routes"]) == 2
    assert unavailable["bestGrossEdge"] is None

    zero_depth_health = {
        "polymarket_yes_kalshi_no": {
            "key": "polymarket_yes_kalshi_no",
            "polymarket": {
                "status": "unavailable",
                "reason": "zero_depth",
                "executable": False,
                "ask": 0.40,
                "askSize": 0.0,
            },
            "kalshi": {
                "status": "ready",
                "reason": None,
                "executable": True,
                "ask": 0.45,
                "askSize": 12.0,
            },
        },
        "polymarket_no_kalshi_yes": {
            "key": "polymarket_no_kalshi_yes",
            "polymarket": {
                "status": "ready",
                "reason": None,
                "executable": True,
                "ask": 0.60,
                "askSize": 20.0,
            },
            "kalshi": {
                "status": "unavailable",
                "reason": "missing_ask",
                "executable": False,
                "ask": None,
                "askSize": None,
            },
        },
    }
    health_row = price_pair(
        poly_contract,
        kalshi_contract,
        {1: poly_market, 2: kalshi_market},
        {
            "poly-yes": {"asks": [{"price": 0.40, "size": 10.0}]},
            "poly-no": {"asks": [{"price": 0.60, "size": 20.0}]},
        },
        {
            "KXTEST-MARKET": {
                "yes_ask": 0.55,
                "yes_ask_size": 15.0,
                "no_ask": 0.45,
                "no_ask_size": 12.0,
            }
        },
        fee_configuration,
        route_health=zero_depth_health,
    )
    assert health_row["routes"][0]["status"] == "zero_polymarket_depth"
    assert health_row["routes"][1]["status"] == "missing_kalshi_ask"

    # A positive quantity must never be serialized as zero merely because
    # it is smaller than four decimal places.
    tiny_depth = price_pair(
        poly_contract,
        kalshi_contract,
        {1: poly_market, 2: kalshi_market},
        {
            "poly-yes": {
                "asks": [
                    {
                        "price": 0.40,
                        "size": 0.00003,
                    }
                ]
            },
            "poly-no": {
                "asks": [
                    {
                        "price": 0.60,
                        "size": 20.0,
                    }
                ]
            },
        },
        {
            "KXTEST-MARKET": {
                "yes_ask": 0.55,
                "yes_ask_size": 15.0,
                "no_ask": 0.45,
                "no_ask_size": 0.00002,
            }
        },
        fee_configuration,
    )

    tiny_route = tiny_depth["routes"][0]

    assert tiny_route["executable"] is True
    assert tiny_route["executableContracts"] == 0.00002
    assert tiny_route["grossExecutableProfitUsd"] > 0

    return {
        "engineVersion": ENGINE_VERSION,
        "status": "passed",
        "fullPairStatus": full["pairStatus"],
        "fullRouteStatuses": [route["status"] for route in full["routes"]],
        "partialPairStatus": partial["pairStatus"],
        "partialRouteStatuses": [route["status"] for route in partial["routes"]],
        "unavailablePairStatus": unavailable["pairStatus"],
        "unavailableRouteCount": len(unavailable["routes"]),
        "zeroDepthStatus": health_row["routes"][0]["status"],
        "missingAskStatus": health_row["routes"][1]["status"],
        "volumeFieldsPresent": bool(
            "volume24h" in full["polymarket"]
            and "lifetimeVolume" in full["kalshi"]
            and "liquidity" in full
        ),
        "tinyDepthPreserved": (
            tiny_route["executableContracts"] == 0.00002
        ),
        "lifecycleTimingFieldsPresent": bool(
            full.get("settlementTime")
            and "resolutionTime" in full
            and "closeTime" in full
            and "settlementTime" in full.get("polymarket", {})
            and "settlementTime" in full.get("kalshi", {})
        ),
    }



def main() -> None:
    print(f"Engine version: {ENGINE_VERSION}")
    if len(sys.argv) == 1:
        print("Verification only: no scan was started.")
        print(
            "Run with 'scan', 'settlement-diagnostics', "
            "'macro-diagnostics', 'weather-diagnostics', 'generic-diagnostics', "
            "'live-manifest', or 'route-self-test'."
        )
        return

    command = sys.argv[1].strip().lower()
    if command == "route-self-test":
        print(json.dumps(route_pricing_self_test(), indent=2, default=str))
        return
    if command == "scan":
        print(json.dumps(run_full_scan(), indent=2, default=str))
        return
    if command == "settlement-diagnostics":
        print(
            json.dumps(
                settlement_diagnostics_payload(),
                indent=2,
                default=str,
            )
        )
        return
    if command == "macro-diagnostics":
        print(
            json.dumps(
                macro_diagnostics_payload(),
                indent=2,
                default=str,
            )
        )
        return
    if command == "weather-diagnostics":
        print(
            json.dumps(
                weather_diagnostics_payload(),
                indent=2,
                default=str,
            )
        )
        return
    if command == "generic-diagnostics":
        requested_group = (
            sys.argv[2].strip().lower()
            if len(sys.argv) > 2
            else "generic"
        )
        print(
            json.dumps(
                generic_diagnostics_payload(requested_group),
                indent=2,
                default=str,
            )
        )
        return
    if command == "live-manifest":
        print(
            json.dumps(
                live_sports_subscription_manifest(eligible_only=False),
                indent=2,
                default=str,
            )
        )
        return

    raise SystemExit(
        "Unknown command. Use scan, settlement-diagnostics, "
        "macro-diagnostics, weather-diagnostics, generic-diagnostics, "
        "live-manifest, or route-self-test."
    )


if __name__ == "__main__":
    main()