from __future__ import annotations

import calendar
import json
import re
import unicodedata
from dataclasses import asdict, dataclass
from datetime import date, timedelta
from decimal import Decimal
from typing import Any, Dict, Iterable, Mapping, Optional, Sequence, Tuple

SETTLEMENT_VERSION = "settlement-verifier-v2.4.0-series-terms-profile-aware"
KALSHI_SERIES_TERMS_PROFILE_VERSION = "kalshi-series-terms-profile-v1"

MONTHS = {
    "january": 1,
    "jan": 1,
    "february": 2,
    "feb": 2,
    "march": 3,
    "mar": 3,
    "april": 4,
    "apr": 4,
    "may": 5,
    "june": 6,
    "jun": 6,
    "july": 7,
    "jul": 7,
    "august": 8,
    "aug": 8,
    "september": 9,
    "sep": 9,
    "sept": 9,
    "october": 10,
    "oct": 10,
    "november": 11,
    "nov": 11,
    "december": 12,
    "dec": 12,
}
MONTH_PATTERN = "|".join(sorted(MONTHS, key=len, reverse=True))


@dataclass(frozen=True)
class SettlementSignature:
    market_group: str
    resolution_window: Optional[str]
    game_scope: Optional[str]
    tie_policy: Optional[str]
    cancellation_policy: Optional[str]
    postponement_policy: Optional[str]
    source_policy: Optional[str]
    evidence: Tuple[str, ...]
    crypto_asset: Optional[str] = None
    crypto_observation: Optional[str] = None
    crypto_reference_source: Optional[str] = None
    crypto_measurement_method: Optional[str] = None
    crypto_boundary_operator: Optional[str] = None
    crypto_threshold: Optional[str] = None
    crypto_measurement_start: Optional[str] = None
    crypto_missing_data_policy: Optional[str] = None
    company_action: Optional[str] = None
    company_subject: Optional[str] = None
    company_target: Optional[str] = None
    company_term: Optional[str] = None
    company_event_date: Optional[str] = None
    company_trigger_policy: Optional[str] = None
    company_participant_scope: Optional[str] = None
    company_term_match_policy: Optional[str] = None
    company_fallback_policy: Optional[str] = None
    company_source_policy: Optional[str] = None
    geopolitics_family: Optional[str] = None
    geopolitics_subject: Optional[str] = None
    geopolitics_target_state: Optional[str] = None
    geopolitics_authority_scope: Optional[str] = None
    geopolitics_trigger_policy: Optional[str] = None
    geopolitics_source_policy: Optional[str] = None
    politics_family: Optional[str] = None
    politics_subject: Optional[str] = None
    politics_candidate: Optional[str] = None
    politics_trigger_policy: Optional[str] = None
    politics_fallback_policy: Optional[str] = None
    politics_source_policy: Optional[str] = None
    election_trigger_policy: Optional[str] = None
    election_fallback_policy: Optional[str] = None
    election_replacement_policy: Optional[str] = None
    election_exception_policy: Optional[str] = None
    election_source_policy: Optional[str] = None
    entertainment_family: Optional[str] = None
    entertainment_subject: Optional[str] = None
    entertainment_content_type: Optional[str] = None
    entertainment_region: Optional[str] = None
    entertainment_rank: Optional[str] = None
    entertainment_observation_date: Optional[str] = None
    entertainment_week_scope: Optional[str] = None
    entertainment_fallback_deadline: Optional[str] = None
    entertainment_fallback_policy: Optional[str] = None
    entertainment_source_policy: Optional[str] = None
    misc_family: Optional[str] = None
    misc_subject: Optional[str] = None
    misc_operator: Optional[str] = None
    misc_threshold: Optional[str] = None
    misc_precision: Optional[str] = None
    misc_trigger_policy: Optional[str] = None
    misc_fallback_policy: Optional[str] = None
    misc_source_policy: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass(frozen=True)
class SettlementDecision:
    status: str
    stream_eligible: bool
    arbitrage_eligible: bool
    reasons: Tuple[str, ...]
    polymarket: SettlementSignature
    kalshi: SettlementSignature

    def to_dict(self) -> Dict[str, Any]:
        return {
            "status": self.status,
            "streamEligible": self.stream_eligible,
            "arbitrageEligible": self.arbitrage_eligible,
            "reasons": list(self.reasons),
            "polymarket": self.polymarket.to_dict(),
            "kalshi": self.kalshi.to_dict(),
            "verifierVersion": SETTLEMENT_VERSION,
        }


def normalize_text(value: Any) -> str:
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
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def _json_object(value: Any) -> Dict[str, Any]:
    if isinstance(value, dict):
        return value
    if isinstance(value, str):
        try:
            parsed = json.loads(value)
        except (TypeError, json.JSONDecodeError):
            return {}
        return parsed if isinstance(parsed, dict) else {}
    return {}


def _selected_text(mapping: Mapping[str, Any], keys: Sequence[str]) -> Iterable[str]:
    for key in keys:
        value = mapping.get(key)
        if value in (None, "", [], {}):
            continue
        if isinstance(value, (dict, list)):
            yield json.dumps(value, ensure_ascii=False, default=str)
        else:
            yield str(value)


_SERIES_TERMS_SECTION_LABELS = (
    ("scope", "scope"),
    ("underlying", "underlying"),
    ("instructions", "instructions"),
    ("source agency", "source_agency"),
    ("type", "type"),
    ("issuance", "issuance"),
    ("payout criterion", "payout_criterion"),
    ("minimum tick", "minimum_tick"),
    ("position accountability level", "position_accountability_level"),
    ("last trading date", "last_trading_date"),
    ("settlement date", "settlement_date"),
    ("expiration date", "expiration_date"),
    ("expiration time", "expiration_time"),
    ("settlement value", "settlement_value"),
    ("expiration value", "expiration_value"),
    ("contingencies", "contingencies"),
    ("appendix", "appendix"),
)


def _series_terms_sections(terms_text: str) -> Dict[str, str]:
    """
    Extract the binding semantic sections from a Kalshi contract-terms PDF.

    The refresh service stores these compact sections on every current Kalshi
    event, so the verifier can reuse authoritative series terms without making
    runtime network calls or duplicating full PDFs in Supabase.
    """
    normalized = normalize_text(terms_text)
    if not normalized:
        return {}

    matches = []
    for label, key in _SERIES_TERMS_SECTION_LABELS:
        match = re.search(rf"\b{re.escape(label)}\s*:", normalized)
        if match:
            matches.append((match.start(), match.end(), key))

    matches.sort(key=lambda item: item[0])
    sections: Dict[str, str] = {}

    for index, (_, end, key) in enumerate(matches):
        next_start = matches[index + 1][0] if index + 1 < len(matches) else len(normalized)
        value = normalized[end:next_start].strip(" |:-")
        if not value:
            continue

        # Payout sections contain most template-specific exceptions, so retain
        # more room there. Other sections are intentionally compact.
        limit = 12000 if key == "payout_criterion" else 5000
        sections[key] = value[:limit]

    return sections


def build_kalshi_series_terms_profile(
    series_info: Mapping[str, Any],
    terms_text: str,
    *,
    terms_sha256: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Build the compact, refresh-time Kalshi series-terms profile.

    This function is deliberately pure and network-free.  The snapshot service
    fetches the official series metadata/PDF, then calls this parser and stores
    the result in prediction_market_events.raw_payload.
    """
    info = dict(series_info or {})
    sources = info.get("settlement_sources")
    if not isinstance(sources, list):
        sources = []

    product_metadata = info.get("product_metadata")
    if not isinstance(product_metadata, dict):
        product_metadata = {}

    terms_url = str(info.get("contract_terms_url") or "").strip() or None
    normalized_terms = normalize_text(terms_text)
    sections = _series_terms_sections(normalized_terms)

    return {
        "profile_version": KALSHI_SERIES_TERMS_PROFILE_VERSION,
        "status": "ready" if normalized_terms else (
            "missing_contract_terms_url" if not terms_url else "empty_terms_text"
        ),
        "series_ticker": str(info.get("ticker") or "").strip() or None,
        "series_title": str(info.get("title") or "").strip() or None,
        "series_category": str(info.get("category") or "").strip() or None,
        "series_last_updated_ts": str(info.get("last_updated_ts") or "").strip() or None,
        "contract_terms_url": terms_url,
        "contract_terms_sha256": str(terms_sha256 or "").strip() or None,
        "settlement_sources": sources,
        "product_metadata": product_metadata,
        "sections": sections,
    }


def kalshi_series_terms_profile(market: Any) -> Dict[str, Any]:
    event = getattr(market, "event", None)
    event_raw = _json_object(getattr(event, "raw", {})) if event else {}
    profile = _json_object(event_raw.get("kalshi_series_terms_profile"))
    if profile.get("profile_version") != KALSHI_SERIES_TERMS_PROFILE_VERSION:
        return {}
    return profile


def kalshi_series_terms_rule_text(market: Any) -> str:
    profile = kalshi_series_terms_profile(market)
    if not profile or profile.get("status") != "ready":
        return ""

    values = [
        profile.get("series_title"),
        profile.get("series_category"),
    ]

    sources = profile.get("settlement_sources")
    if isinstance(sources, list):
        for source in sources:
            if isinstance(source, dict):
                values.extend((source.get("name"), source.get("url")))

    product_metadata = profile.get("product_metadata")
    if isinstance(product_metadata, dict) and product_metadata:
        values.append(json.dumps(product_metadata, ensure_ascii=False, default=str))

    sections = profile.get("sections")
    if isinstance(sections, dict):
        for key in (
            "underlying",
            "instructions",
            "source_agency",
            "issuance",
            "payout_criterion",
            "last_trading_date",
            "expiration_date",
            "expiration_time",
            "expiration_value",
            "contingencies",
        ):
            value = sections.get(key)
            if value:
                values.append(f"{key.replace('_', ' ')}: {value}")

    return normalize_text(" | ".join(str(value) for value in values if value))


def market_rule_text(market: Any) -> str:
    semantics = _json_object(getattr(market, "contract_semantics", {}))
    raw = _json_object(getattr(market, "raw", {}))
    event = getattr(market, "event", None)
    event_raw = _json_object(getattr(event, "raw", {})) if event else {}
    event_details = _json_object(getattr(event, "details", {})) if event else {}

    values = [
        getattr(event, "title", "") if event else "",
        getattr(market, "event_title", ""),
        getattr(market, "market_title", ""),
        getattr(market, "rules_primary", ""),
        getattr(market, "rules_secondary", ""),
        getattr(market, "rules_url", ""),
    ]

    keys = (
        "description",
        "rules",
        "rules_primary",
        "rules_secondary",
        "rulesPrimary",
        "rulesSecondary",
        "question",
        "title",
        "subtitle",
        "yes_sub_title",
        "no_sub_title",
        "resolution_source",
        "resolutionSource",
        "early_close_condition",
    )
    values.extend(_selected_text(semantics, keys))
    values.extend(_selected_text(raw, keys))
    values.extend(_selected_text(event_raw, keys))
    values.extend(_selected_text(event_details, keys))

    # Refresh-time authoritative Kalshi series terms.  This is compact parsed
    # evidence stored in the event raw payload; the verifier never reaches out
    # to the network at runtime.
    series_terms_text = kalshi_series_terms_rule_text(market)
    if series_terms_text:
        values.append(series_terms_text)

    return normalize_text(" | ".join(str(value) for value in values if value))


def _safe_date(year: int, month: int, day: int) -> Optional[date]:
    try:
        return date(year, month, day)
    except ValueError:
        return None


def _explicit_dates(text: str) -> Tuple[date, ...]:
    values = []

    for match in re.finditer(
        rf"\b({MONTH_PATTERN})\s+(\d{{1,2}})(?:st|nd|rd|th)?\s*,?\s*(20\d{{2}})\b",
        text,
    ):
        parsed = _safe_date(
            int(match.group(3)),
            MONTHS[match.group(1)],
            int(match.group(2)),
        )
        if parsed:
            values.append(parsed)

    for match in re.finditer(r"\b(20\d{2})[-/](0?[1-9]|1[0-2])[-/](3[01]|[12]\d|0?[1-9])\b", text):
        parsed = _safe_date(int(match.group(1)), int(match.group(2)), int(match.group(3)))
        if parsed:
            values.append(parsed)

    return tuple(sorted(set(values)))


def sports_resolution_window(text: str, reference_year: Optional[int] = None) -> Optional[str]:
    text = normalize_text(text)
    prioritized = []
    patterns = (
        rf"(?:originally\s+scheduled|scheduled|game\s+on|match\s+on|on)\s+(?:for\s+)?({MONTH_PATTERN})\s+(\d{{1,2}})(?:st|nd|rd|th)?\s*,?\s*(20\d{{2}})",
        r"(?:originally\s+scheduled|scheduled|game\s+on|match\s+on|on)\s+(?:for\s+)?(20\d{2})[-/](0?[1-9]|1[0-2])[-/](3[01]|[12]\d|0?[1-9])",
    )

    for index, pattern in enumerate(patterns):
        for match in re.finditer(pattern, text):
            if index == 0:
                parsed = _safe_date(
                    int(match.group(3)),
                    MONTHS[match.group(1)],
                    int(match.group(2)),
                )
            else:
                parsed = _safe_date(int(match.group(1)), int(match.group(2)), int(match.group(3)))
            if parsed:
                prioritized.append(parsed)

    if reference_year is not None:
        no_year_pattern = rf"(?:originally\s+scheduled|scheduled|game\s+on|match\s+on|on)\s+(?:for\s+)?({MONTH_PATTERN})\s+(\d{{1,2}})(?:st|nd|rd|th)?\b"
        for match in re.finditer(no_year_pattern, text):
            tail = text[match.end(): match.end() + 8]
            if re.match(r"\s*,?\s*20\d{2}", tail):
                continue
            parsed = _safe_date(reference_year, MONTHS[match.group(1)], int(match.group(2)))
            if parsed:
                prioritized.append(parsed)

    unique_prioritized = sorted(set(prioritized))
    if len(unique_prioritized) == 1:
        return unique_prioritized[0].isoformat()
    if len(unique_prioritized) > 1:
        return "ambiguous:" + ",".join(value.isoformat() for value in unique_prioritized)

    dates = _explicit_dates(text)
    if len(dates) == 1:
        return dates[0].isoformat()
    if len(dates) > 1:
        return "ambiguous:" + ",".join(value.isoformat() for value in dates)
    return None


def calendar_resolution_window(text: str) -> Optional[str]:
    text = normalize_text(text)
    before_date = re.search(
        rf"\bbefore\s+({MONTH_PATTERN})\s+(\d{{1,2}})(?:st|nd|rd|th)?\s*,?\s*(20\d{{2}})\b",
        text,
    )
    if before_date:
        parsed = _safe_date(
            int(before_date.group(3)),
            MONTHS[before_date.group(1)],
            int(before_date.group(2)),
        )
        if parsed:
            return f"deadline-{(parsed - timedelta(days=1)).isoformat()}"

    explicit_date = re.search(
        rf"\b(?:by|through|until|on|at)\s+(?:the\s+)?({MONTH_PATTERN})\s+(\d{{1,2}})(?:st|nd|rd|th)?\s*,?\s*(20\d{{2}})\b",
        text,
    )
    if explicit_date:
        parsed = _safe_date(
            int(explicit_date.group(3)),
            MONTHS[explicit_date.group(1)],
            int(explicit_date.group(2)),
        )
        if parsed:
            return f"deadline-{parsed.isoformat()}"

    end_month = re.search(
        rf"\b(?:by|at|through|until)?\s*(?:the\s+)?end\s+of\s+({MONTH_PATTERN})\s+(20\d{{2}})\b",
        text,
    )
    if end_month:
        month = MONTHS[end_month.group(1)]
        year = int(end_month.group(2))
        day = calendar.monthrange(year, month)[1]
        return f"deadline-{year:04d}-{month:02d}-{day:02d}"

    month = re.search(rf"\b({MONTH_PATTERN})\s+(20\d{{2}})\b", text)
    if month:
        number = MONTHS[month.group(1)]
        year = int(month.group(2))
        return f"month-{year:04d}-{number:02d}"

    return None


def election_fallback_deadline(text: str) -> Optional[str]:
    """
    Return only a rule-defined terminal fallback/long-stop deadline.

    Election day, close time, and venue expiration are not settlement cutoffs.
    We accept only dates tied to an unresolved result/winner/nominee condition.
    """
    text = normalize_text(text)
    subject = r"(?:result|results|winner|outcome|nominee|nomination)"
    state = (
        r"(?:isn'?t|is not|aren'?t|are not|hasn'?t been|has not been|"
        r"is|are)?\s*(?:known|announced|declared|determined|confirmed|certified)"
    )
    patterns = (
        rf"{subject}[^.?!]{{0,180}}?{state}[^.?!]{{0,100}}?"
        rf"\bby\s+({MONTH_PATTERN})\s+(\d{{1,2}})(?:st|nd|rd|th)?\s*,?\s*(20\d{{2}})\b",
        rf"(?:if|unless)[^.?!]{{0,220}}?"
        rf"(?:not known|unknown|not announced|not declared|not determined|not confirmed|"
        rf"not certified|no nominee is announced|nominee is not announced)"
        rf"[^.?!]{{0,120}}?\bby\s+({MONTH_PATTERN})\s+(\d{{1,2}})(?:st|nd|rd|th)?\s*,?\s*(20\d{{2}})\b",
    )
    for pattern in patterns:
        match = re.search(pattern, text)
        if not match:
            continue
        parsed = _safe_date(
            int(match.group(3)),
            MONTHS[match.group(1)],
            int(match.group(2)),
        )
        if parsed:
            return f"deadline-{parsed.isoformat()}"
    return None


def election_fallback_policy(text: str) -> Optional[str]:
    """Normalize what happens if an election outcome remains unresolved."""
    text = normalize_text(text)
    context = re.search(
        r"(?:if|unless)[^.?!]{0,360}?"
        r"(?:isn\'?t known|is not known|aren\'?t known|are not known|"
        r"not known|unknown|not announced|not declared|not determined|"
        r"not confirmed|not certified|no nominee is announced|nominee is not announced)"
        r"[^.?!]{0,360}",
        text,
    )
    segment = context.group(0) if context else ""
    if not segment:
        return None
    if re.search(r"\bresolve(?:s|d)?\s+(?:to\s+)?[\"']?other[\"']?\b", segment):
        return "other_bucket"
    if re.search(r"\b(?:all\s+markets?\s+)?resolve(?:s|d)?\s+(?:to\s+)?[\"']?no[\"']?\b", segment):
        return "selected_candidate_no"
    if re.search(r"\bresolve(?:s|d)?\s+(?:to\s+)?[\"']?yes[\"']?\b", segment):
        return "selected_candidate_yes"
    if re.search(r"\b(?:void|refund)\b", segment):
        return "void_or_refund"
    if re.search(r"\bfair (?:market )?price\b", segment):
        return "fair_price"
    return "described_unknown"


def election_scope(text: str) -> Optional[str]:
    """Identify the proposition being settled, not merely the venue category."""
    text = normalize_text(text)

    # Rule text outranks a misleading child title. This catches a market row
    # whose title says a candidate wins while the governing rules settle a
    # margin-of-victory bracket.
    if re.search(r"\bmargin of victory\b", text):
        return "margin_of_victory"

    if re.search(
        r"\b(?:finish(?:es)?|finishing|receives?)\b[^.?!]{0,100}\b(?:2nd|second)\b|"
        r"\bsecond[- ]most valid votes\b|\bsecond[- ]highest finishing position\b",
        text,
    ):
        return "candidate_rank_2"

    if re.search(
        r"\b(?:finish(?:es)?|finishing|receives?)\b[^.?!]{0,100}\b(?:3rd|third)\b|"
        r"\bthird[- ]most valid votes\b|\bthird[- ]highest finishing position\b",
        text,
    ):
        return "candidate_rank_3"

    if re.search(
        r"\b(?:wins?|won)\s+(?:the\s+)?nomination\b|"
        r"\b(?:republican|democratic|democrat)\s+nominee\b|"
        r"\bnominee\s+for\s+[a-z]{2}-\d{1,2}\b",
        text,
    ):
        return "party_nominee"

    if re.search(
        r"\b(?:greatest|most)\s+number\s+of\s+seats\b|"
        r"\bparty[^.?!]{0,100}\bmost seats\b|"
        r"\bwin(?:s)?\s+the\s+most\s+seats\b",
        text,
    ):
        return "party_most_seats"

    if re.search(
        r"\b(?:win|wins|won)\b[^.?!]{0,120}\belection\b|"
        r"\belection\b[^.?!]{0,120}\b(?:winner|wins|won)\b|"
        r"\bcandidate who wins\b|\bwinner is (?:announced|declared)\b|"
        r"\bbecomes? the next (?:mayor|governor|president)\b",
        text,
    ):
        return "candidate_winner"
    return None


def election_scope_for_market(market: Any, full_text: str) -> Optional[str]:
    """Classify the actual proposition while resisting generic venue boilerplate."""
    primary_text = normalize_text(" ".join(
        str(value or "")
        for value in (
            getattr(market, "event_title", ""),
            getattr(market, "market_title", ""),
            getattr(market, "rules_primary", ""),
        )
    ))
    primary_scope = election_scope(primary_text)
    if primary_scope in {
        "margin_of_victory",
        "candidate_rank_2",
        "candidate_rank_3",
        "party_nominee",
    }:
        return primary_scope

    # Explicit direct-office elections outrank boilerplate paragraphs that also
    # describe unrelated parliamentary/referendum contracts in a venue ruleset.
    if re.search(
        r"\b(presidential|gubernatorial|lieutenant governor|governor election|mayoral)\b",
        primary_text,
    ):
        return "candidate_winner"

    normalized_full = normalize_text(full_text)
    if re.search(r"\bparliamentary(?:/legislative)? elections?\b|\blegislative elections?\b", normalized_full) and re.search(
        r"\bmost seats\b|\bgreatest number of seats\b",
        normalized_full,
    ):
        return "party_most_seats"

    return primary_scope or election_scope(normalized_full)


def election_trigger_policy(text: str, scope: Optional[str]) -> Optional[str]:
    text = normalize_text(text)
    if not scope:
        return None
    if scope == "margin_of_victory":
        return "official_margin_between_top_two"
    if scope in {"candidate_rank_2", "candidate_rank_3"}:
        if re.search(r"\bfirst round\b", text):
            return "first_round_rank_by_votes"
        return "rank_by_certified_result"
    if scope == "party_nominee":
        if re.search(r"\bwins?\s+(?:the\s+)?nomination\b", text):
            return "wins_party_nomination"
        return None
    if scope == "party_most_seats":
        return "most_seats_in_specified_chamber"
    if scope == "candidate_winner":
        if re.search(
            r"\b(?:wins?|winner)[^.?!]{0,220}\b(?:inaugurated|sworn in|takes office)\b|"
            r"\b(?:inaugurated|sworn in|takes office)[^.?!]{0,220}\bwinner\b",
            text,
        ):
            return "winner_plus_office_assumption_or_inauguration"
        if re.search(r"\bbecomes? the next (?:mayor|governor|president)\b[^.?!]{0,100}\bas a result of (?:this|the) election\b", text):
            return "election_result_winner"
        if re.search(
            r"\b(?:candidate|party|coalition)?\s*who wins\b|"
            r"\b(?:has\s+)?won\s+the\b|\bwins?\s+the\b",
            text,
        ):
            return "election_result_winner"
    return None


def election_tie_policy(text: str, scope: Optional[str]) -> Optional[str]:
    text = normalize_text(text)
    if scope in {"candidate_rank_2", "candidate_rank_3"}:
        if re.search(r"\bties?\b[^.?!]{0,180}\balphabetical order\b[^.?!]{0,120}\blast names?\b", text):
            return "alphabetical_last_name"
        if re.search(r"\bexact ties?\b[^.?!]{0,140}\bresolve proportionally\b", text):
            return "proportional_split"
    if scope == "party_most_seats":
        if re.search(r"\btie\b[^.?!]{0,220}\babbreviation\b[^.?!]{0,120}\balphabetical order\b", text):
            return "alphabetical_abbreviation"
        if re.search(
            r"(?:\btie\b|\bsame number of seats\b).{0,420}\bentering government\b.{0,420}\bhigher share of the vote\b",
            text,
        ):
            return "enter_government_then_vote_share"
    return None


def election_replacement_policy(text: str, scope: Optional[str]) -> Optional[str]:
    text = normalize_text(text)
    if scope != "party_nominee":
        return None
    if re.search(
        r"\breplacement of the nominee\b[^.?!]{0,160}\bwill not change\b[^.?!]{0,80}\bresolution\b",
        text,
    ):
        return "original_nomination_winner_fixed"
    return None


def election_exception_policy(text: str) -> Optional[str]:
    text = normalize_text(text)
    if re.search(
        r"\bremains? open until the rescheduled election or two years from the original date\b",
        text,
    ):
        return "rescheduled_election_or_two_year_cap"
    if re.search(
        r"\belection is cancelled or postponed beyond expiration\b[^.?!]{0,120}\ball markets resolve to no\b",
        text,
    ):
        return "cancel_or_postpone_beyond_expiration_no"
    return None


# These Kalshi series were individually audited against their authoritative
# contract_terms_url documents during the 2026-08-15 manual-review cleanup.
# Each listed template contains a material settlement-rule difference from the
# corresponding current Polymarket family, so these pairs must be rejected
# rather than left in manual_review or admitted to arbitrage.
#
# This is intentionally conservative and series-specific. Future/unseen Kalshi
# series are NOT inferred from these entries and will continue through the
# normal settlement-signature path until series-term ingestion is automated.
AUDITED_KALSHI_ELECTION_SERIES_REJECTIONS = {
    # BRPRES.pdf: Polymarket uses a fixed Other deadline; Kalshi uses AP,
    # later inauguration fallback, one-year expiration, and Rulebook payout.
    "KXBRPRES": "election_series_brpres_terminal_policy_mismatch",

    # FRENCHPRES.pdf: Polymarket uses a fixed Other deadline and French
    # government ambiguity fallback; Kalshi uses a different source hierarchy,
    # one-year-after-election expiration, and Rulebook payout contingency.
    "KXFRENCHPRES": "election_series_frenchpres_terminal_policy_mismatch",

    # HOUSEPARTYNOM/HOUSEPARTYNOMINATION templates: both venues key to the
    # first nomination, but Polymarket resolves unresolved nomination to Other
    # at a fixed deadline while Kalshi uses election-day expiration plus its
    # Rulebook contingency process.
    "KXFL19R": "election_series_housepartynom_terminal_policy_mismatch",
    "KXFLPRIMARY": "election_series_housepartynom_terminal_policy_mismatch",
    "KXNHPRIMARY": "election_series_housepartynom_terminal_policy_mismatch",
    "KXMAPRIMARY": "election_series_housepartynom_terminal_policy_mismatch",

    # SEATCOUNT.pdf materially differs on partial elections, by-elections,
    # annulment/nullification, unofficial-results fallback, cancellation, and
    # fair-market-price treatment.
    "KXVAHOUSEDEM": "election_series_seatcount_scope_policy_mismatch",

    # ELECTION.pdf materially differs from the corresponding current
    # Polymarket mayor/governor families on terminal deadlines and exception
    # handling (annulment, postponement, death/incapacitation, disputed claims).
    "KXKRAKOWMAYOR": "election_series_election_exception_policy_mismatch",
    "KXVANCOUVERMAYOR": "election_series_election_exception_policy_mismatch",
    "KXOTTAWAMAYOR": "election_series_election_exception_policy_mismatch",
    "KXTORONTOMAYOR": "election_series_election_exception_policy_mismatch",
    "KXCEARAGOV": "election_series_election_exception_policy_mismatch",
    "KXNANAIMOMAYOR": "election_series_election_exception_policy_mismatch",
    "KXWINNIPEGMAYOR": "election_series_election_exception_policy_mismatch",
}


def audited_kalshi_election_series_rejection(market: Any) -> Optional[str]:
    series = str(getattr(market, "external_series_id", "") or "").strip().upper()
    if not series:
        event = getattr(market, "event", None)
        series = str(getattr(event, "external_series_id", "") or "").strip().upper()
    return AUDITED_KALSHI_ELECTION_SERIES_REJECTIONS.get(series)


# This Kalshi awards series was individually audited against its authoritative
# contract_terms_url during the 2026-08-15 manual-review cleanup.  The current
# Polymarket TIME Person of the Year family resolves No if TIME has not announced
# Person of the Year by 2027-06-30 23:59 ET, while Kalshi TIME.pdf can remain
# unresolved until the sooner of TIME's release or one day and one year after the
# award year ended.  That terminal-window difference is material for arbitrage.
#
# Keep this series-specific: future/unseen awards templates still go through the
# normal signature path until series-term ingestion is automated.
AUDITED_KALSHI_AWARD_SERIES_REJECTIONS = {
    "KXTIME": "award_series_time_terminal_policy_mismatch",
}


def audited_kalshi_award_series_rejection(market: Any) -> Optional[str]:
    series = str(getattr(market, "external_series_id", "") or "").strip().upper()
    if not series:
        event = getattr(market, "event", None)
        series = str(getattr(event, "external_series_id", "") or "").strip().upper()
    return AUDITED_KALSHI_AWARD_SERIES_REJECTIONS.get(series)


# These seven current Kalshi Netflix ranking series were individually audited
# against the authoritative NETFLIXRANK.pdf contract terms during the
# 2026-08-15 manual-review cleanup.  The current Polymarket families use an
# explicit long-stop: if the expected Netflix Top 10 update has not occurred by
# 2026-08-21 23:59 ET, they resolve to Other.  Kalshi NETFLIXRANK instead expires
# at the first 10:00 AM ET following the chart update for the relevant week and
# does not define the same fixed long-stop/Other fallback.  A delayed chart can
# therefore produce different settlement, so these pairs are comparable but
# not safe for cross-venue arbitrage.
#
# Keep this series-specific. Future/unseen Netflix/entertainment templates still
# use the normal settlement-signature path until series-term ingestion is
# automated.
AUDITED_KALSHI_ENTERTAINMENT_SERIES_REJECTIONS = {
    "KXNETFLIXRANKSHOW": "entertainment_series_netflixrank_terminal_policy_mismatch",
    "KXNETFLIXRANKSHOWGLOBAL": "entertainment_series_netflixrank_terminal_policy_mismatch",
    "KXNETFLIXRANKSHOWGLOBAL2": "entertainment_series_netflixrank_terminal_policy_mismatch",
    "KXNETFLIXRANKSHOWRUNNERUP": "entertainment_series_netflixrank_terminal_policy_mismatch",
    "KXNETFLIXRANKMOVIE": "entertainment_series_netflixrank_terminal_policy_mismatch",
    "KXNETFLIXRANKMOVIEGLOBAL": "entertainment_series_netflixrank_terminal_policy_mismatch",
    "KXNETFLIXRANKMOVIEGLOBAL2": "entertainment_series_netflixrank_terminal_policy_mismatch",
}


def audited_kalshi_entertainment_series_rejection(market: Any) -> Optional[str]:
    series = str(getattr(market, "external_series_id", "") or "").strip().upper()
    if not series:
        event = getattr(market, "event", None)
        series = str(getattr(event, "external_series_id", "") or "").strip().upper()
    return AUDITED_KALSHI_ENTERTAINMENT_SERIES_REJECTIONS.get(series)


# This current Kalshi White House Press Secretary series was individually
# audited against its stored market rules and authoritative NEXTPM.pdf terms
# during the 2026-08-15 manual-review cleanup. The current Polymarket family
# resolves on the next person the White House announces as the permanent
# replacement for Karoline Leavitt and explicitly excludes acting/interim
# service. Kalshi instead resolves on the first new person who actually begins
# serving as Press Secretary and explicitly counts acting/interim service.
# Those trigger/scope differences can produce opposite outcomes and are
# therefore material for cross-venue arbitrage.
#
# Keep this series-specific. Future/unseen politics templates still use the
# normal settlement-signature path until series-term ingestion is automated.
AUDITED_KALSHI_POLITICS_SERIES_REJECTIONS = {
    "KXNEXTPRESSEC": "politics_series_nextpressec_trigger_interim_policy_mismatch",
}


def audited_kalshi_politics_series_rejection(market: Any) -> Optional[str]:
    series = str(getattr(market, "external_series_id", "") or "").strip().upper()
    if not series:
        event = getattr(market, "event", None)
        series = str(getattr(event, "external_series_id", "") or "").strip().upper()
    return AUDITED_KALSHI_POLITICS_SERIES_REJECTIONS.get(series)


# Current miscellaneous-series evidence audited on 2026-08-15.
#
# KXISMPMI is not arbitrage-equivalent to the current Polymarket August PMI
# contract because the terminal missing-data policies differ: Polymarket waits
# through the next scheduled report and then substitutes the most recent
# previous month, while Kalshi reaches its own terminal expiration and may use
# its Rulebook if the value cannot be determined.
AUDITED_KALSHI_MISC_SERIES_REJECTIONS = {
    "KXISMPMI": "misc_series_ismpmi_fallback_policy_mismatch",
}


def audited_kalshi_misc_series_rejection(market: Any) -> Optional[str]:
    series = str(getattr(market, "external_series_id", "") or "").strip().upper()
    if not series:
        event = getattr(market, "event", None)
        series = str(getattr(event, "external_series_id", "") or "").strip().upper()
    return AUDITED_KALSHI_MISC_SERIES_REJECTIONS.get(series)


# Current sports-series evidence audited on 2026-08-15.
#
# KXCPLMATCH uses CRICKETGAME.pdf / CRICKETMATCHWIN terms.  Those terms
# define the default scope as the full match (including any required Super
# Over/tiebreaker), split unresolved outcomes 50/50, keep delays open only
# through 48 hours before a 50/50 settlement, and treat a pre-match
# forfeit/disqualification/concession as 50/50.  The current Polymarket CPL
# family instead keeps a postponed/rescheduled fixture open until completion
# and treats a forfeit/walkover that produces an official winner as an
# ordinary win.  The core winner market is comparable, but those exception
# policies prevent guaranteed arbitrage.
#
# These are semantic overrides/exception facts, not a blanket rejection of the
# series.  If a future Polymarket counterpart has matching exception rules, it
# can still pass the normal verifier once those rules are parsed.
AUDITED_KALSHI_SPORTS_SERIES_POLICIES = {
    "KXCPLMATCH": {
        "game_scope": "full_event",
        "tie_policy": "split_50_50",
        "cancellation_policy": "split_50_50",
        "postponement_policy": "wait_up_to_48_hours_then_split_50_50",
        "source_policy": "official_result",
    },
}


def audited_kalshi_sports_semantic_overrides(market: Any) -> Dict[str, str]:
    series = str(getattr(market, "external_series_id", "") or "").strip().upper()
    if not series:
        event = getattr(market, "event", None)
        series = str(getattr(event, "external_series_id", "") or "").strip().upper()
    return dict(AUDITED_KALSHI_SPORTS_SERIES_POLICIES.get(series, {}))


def audited_sports_exception_reasons(poly_market: Any, kalshi_market: Any) -> Tuple[str, ...]:
    """Return audited material exception mismatches for known sports terms.

    Keep this evidence-bound: KXCPLMATCH only receives the extra pre-match
    forfeit reason when the Polymarket rules actually contain the audited
    "forfeit/walkover ... ordinary wins" treatment.
    """
    series = str(getattr(kalshi_market, "external_series_id", "") or "").strip().upper()
    if not series:
        event = getattr(kalshi_market, "event", None)
        series = str(getattr(event, "external_series_id", "") or "").strip().upper()
    if series != "KXCPLMATCH":
        return ()

    poly_text = normalize_text(market_rule_text(poly_market))
    reasons = []
    if (
        ("forfeit/walkover" in poly_text or "forfeit or walkover" in poly_text)
        and "ordinary wins" in poly_text
    ):
        reasons.append("pre_match_forfeit_policy_mismatch")
    return tuple(reasons)


def audited_kalshi_misc_semantic_overrides(
    market: Any,
    family: Optional[str],
) -> Tuple[Optional[str], Optional[str]]:
    """Return audited trigger/source semantics absent from stored market text.

    KXNEWOUTBREAK-P's event-specific rule is "any disease becomes a pandemic
    in 2026" and its binding series terms define WHO as both the underlying
    release authority and Source Agency, with pandemic as a WHO designation.
    Under the verifier's existing policy, contract issuance/open timing is not
    substituted for the semantic calendar-year resolution window.
    """
    if family != "pandemic_any_disease":
        return None, None

    series = str(getattr(market, "external_series_id", "") or "").strip().upper()
    if not series:
        event = getattr(market, "event", None)
        series = str(getattr(event, "external_series_id", "") or "").strip().upper()

    if series == "KXNEWOUTBREAK-P":
        return "who_declares_pandemic", "who_official_announcements"

    return None, None


def election_source_policy(text: str) -> Optional[str]:
    text = normalize_text(text)
    if re.search(r"\ball three sources\b[^.?!]{0,140}\bcall the race\b", text):
        return "three_media_unanimous_then_official"
    if re.search(r"\bconsensus of official (?:republican|democrat|democratic) sources\b", text):
        return "official_party_sources"
    if re.search(r"\bconsensus of credible reporting\b", text) and re.search(
        r"\bofficial results\b|\bofficial information\b", text
    ):
        return "consensus_then_official"
    if re.search(r"\bofficial certification or declaration\b|\bfinal certified outcome\b", text):
        return "official_certification"
    if re.search(r"\baccording to the certified results\b", text):
        return "certified_results"
    if re.search(r"\bconsensus of designated media sources\b|\baccelerated resolution by a consensus of media calls\b", text):
        # The catalog text explicitly defers to full rules, so this is useful
        # evidence but not a complete source policy for strict equivalence.
        return None
    if re.search(r"\bconsensus of credible reporting\b", text):
        return "consensus_reporting"
    return source_policy(text)


def _market_raw_date(market: Any, *keys: str) -> Optional[str]:
    raw = _json_object(getattr(market, "raw", {}))
    for key in keys:
        value = raw.get(key)
        if value in (None, ""):
            continue
        match = re.search(r"\b(20\d{2})-(\d{2})-(\d{2})\b", str(value))
        if match:
            return f"{match.group(1)}-{match.group(2)}-{match.group(3)}"
    return None



def entertainment_family(text: str) -> Optional[str]:
    text = normalize_text(text)
    if "netflix" not in text:
        return None
    if not re.search(r"\btop\s*10\b|\btop\s+(?:global|us|u s|united states)\s+netflix\b|\b#\s*[12]\s+(?:global|us|u s|united states)\s+netflix\b", text):
        return None
    if not re.search(r"\bmovie(?:s)?\b|\b(?:tv\s+)?show(?:s)?\b", text):
        return None
    return "netflix_weekly_ranking"


def _normalize_entertainment_subject(value: str) -> Optional[str]:
    value = normalize_text(value)
    value = re.sub(r"[^a-z0-9]+", " ", value).strip()
    return value or None


def entertainment_subject_for_market(market: Any) -> Optional[str]:
    title = normalize_text(getattr(market, "market_title", ""))
    match = re.search(
        r"^will\s+[\"']?(.+?)[\"']?\s+be\s+(?:the\s+)?(?:#\s*[12]|top)\b",
        title,
    )
    if not match:
        return None
    return _normalize_entertainment_subject(match.group(1))


def entertainment_content_type(text: str) -> Optional[str]:
    text = normalize_text(text)
    if "netflix" not in text:
        return None
    if re.search(r"\bmovie(?:s)?\b", text):
        return "movie"
    if re.search(r"\b(?:tv\s+)?show(?:s)?\b", text):
        return "show"
    return None


def entertainment_region(text: str) -> Optional[str]:
    text = normalize_text(text)
    if re.search(r"\bglobal\b", text):
        return "global"
    if re.search(r"\bunited states\b|\bu\.?s\.?\b|\bus\s+netflix\b", text):
        return "us"
    return None


def entertainment_rank(text: str) -> Optional[str]:
    text = normalize_text(text)
    if re.search(r"\b#\s*2\b|\bsecond[- ]highest\b|\bis\s+#\s*2\b", text):
        return "2"
    if re.search(r"\b#\s*1\b|\bis\s+#\s*1\b|\btop\s+(?:global|us|u s|united states)\s+netflix\b", text):
        return "1"
    return None


def _entertainment_date_match(match: Optional[re.Match[str]]) -> Optional[str]:
    if not match:
        return None
    parsed = _safe_date(int(match.group(3)), MONTHS[match.group(1)], int(match.group(2)))
    return parsed.isoformat() if parsed else None


def entertainment_observation_date(text: str) -> Optional[str]:
    text = normalize_text(text)
    date_tail = rf"(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)?\s*,?\s*({MONTH_PATTERN})\s+(\d{{1,2}})(?:st|nd|rd|th)?\s*,?\s*(20\d{{2}})"

    # Kalshi: "chart published on Aug 18, 2026".
    match = re.search(rf"\bchart\s+published\s+on\s+{date_tail}", text)
    value = _entertainment_date_match(match)
    if value:
        return value

    # Polymarket: "update ... on top10.netflix.com on Tuesday, August 18, 2026".
    match = re.search(rf"\bupdate\b.{{0,260}}?\bon\s+{date_tail}", text)
    value = _entertainment_date_match(match)
    if value:
        return value

    # Conservative fallback for wording such as "published Tuesday, August 18, 2026".
    match = re.search(rf"\b(?:published|publishes|updated|updates)\b.{{0,120}}?{date_tail}", text)
    return _entertainment_date_match(match)


def entertainment_week_scope(text: str) -> Optional[str]:
    text = normalize_text(text)
    if re.search(r"\bprevious week\b[^.]{0,80}\bmonday\s+to\s+sunday\b", text):
        return "previous_week_ending_sunday"
    if re.search(r"\bweek\s+ending\s+the\s+previous\s+sunday\b", text):
        return "previous_week_ending_sunday"
    return None


def entertainment_fallback_deadline(text: str) -> Optional[str]:
    text = normalize_text(text)
    match = re.search(
        rf"\b(?:update|chart)[^.?!]{{0,180}}?(?:does\s+not|doesn'?t|fails\s+to)\s+(?:occur|publish|update)[^.?!]{{0,120}}?\bby\s+({MONTH_PATTERN})\s+(\d{{1,2}})(?:st|nd|rd|th)?\s*,?\s*(20\d{{2}})\b",
        text,
    )
    if not match:
        # Current Polymarket wording: "If the top10.netflix.com update does not occur by ..."
        match = re.search(
            rf"\bupdate\s+does\s+not\s+occur\s+by\s+({MONTH_PATTERN})\s+(\d{{1,2}})(?:st|nd|rd|th)?\s*,?\s*(20\d{{2}})\b",
            text,
        )
    if not match:
        return None
    parsed = _safe_date(int(match.group(3)), MONTHS[match.group(1)], int(match.group(2)))
    return f"deadline-{parsed.isoformat()}" if parsed else None


def entertainment_fallback_policy(text: str) -> Optional[str]:
    text = normalize_text(text)
    if re.search(r"\bupdate\s+does\s+not\s+occur\b[^.?!]{0,180}\bresolve\s+to\s+[\"']?other[\"']?", text):
        return "other_bucket"
    return None


def entertainment_source_policy(text: str) -> Optional[str]:
    text = normalize_text(text)
    if "top10.netflix.com" in text or re.search(r"\bnetflix\s+top\s*10\b", text):
        return "netflix_top10_official"
    return None


def entertainment_tie_policy(text: str) -> Optional[str]:
    text = normalize_text(text)
    if re.search(r"\btie(?:d|s)?\b[^.?!]{0,220}\balphabetical(?:ly)?\b|\balphabetical\s+order\b", text):
        return "alphabetical_title"
    return None


def _misc_month_year(text: str) -> Optional[str]:
    text = normalize_text(text)
    match = re.search(rf"\b({MONTH_PATTERN})\s+(20\d{{2}})\b", text)
    if match:
        return f"{int(match.group(2)):04d}-{MONTHS[match.group(1)]:02d}"
    return None


def _misc_decimal(value: str) -> Optional[str]:
    try:
        number = Decimal(str(value))
    except Exception:
        return None
    normalized = format(number.normalize(), "f")
    return normalized.rstrip("0").rstrip(".") if "." in normalized else normalized


def misc_family_for_market(market: Any, text: str) -> Optional[str]:
    normalized = normalize_text(text)
    title = normalize_text(getattr(market, "market_title", "")).strip(" ?")
    event_title = normalize_text(getattr(market, "event_title", "")).strip(" ?")

    if "ism" in normalized and "manufacturing" in normalized and "pmi" in normalized:
        return "ism_manufacturing_pmi"

    if re.fullmatch(r"(?:new )?pandemic in 20\d{2}", title) or re.fullmatch(
        r"(?:new )?pandemic in 20\d{2}", event_title
    ):
        return "pandemic_any_disease"

    return None


def misc_subject_for_market(market: Any, family: Optional[str]) -> Optional[str]:
    if family == "ism_manufacturing_pmi":
        return "ism_manufacturing_pmi"
    if family == "pandemic_any_disease":
        return "any_disease"
    return None


def misc_operator_threshold(text: str, family: Optional[str]) -> Tuple[Optional[str], Optional[str]]:
    if family != "ism_manufacturing_pmi":
        return None, None
    normalized = normalize_text(text)
    patterns = (
        (r"\bat least\s+(-?\d+(?:\.\d+)?)\b", "gte"),
        (r"\babove\s+(-?\d+(?:\.\d+)?)\b", "gt"),
        (r"\bat most\s+(-?\d+(?:\.\d+)?)\b", "lte"),
        (r"\bbelow\s+(-?\d+(?:\.\d+)?)\b", "lt"),
    )
    for pattern, operator in patterns:
        match = re.search(pattern, normalized)
        if match:
            return operator, _misc_decimal(match.group(1))
    return None, None


def misc_precision_policy(text: str, family: Optional[str]) -> Optional[str]:
    if family != "ism_manufacturing_pmi":
        return None
    normalized = normalize_text(text)
    if re.search(r"\bone decimal (?:place|point)\b|\breported to one decimal point\b", normalized):
        return "one_decimal"
    return None


def misc_trigger_policy(text: str, family: Optional[str]) -> Optional[str]:
    normalized = normalize_text(text)
    if family == "pandemic_any_disease":
        who_named = bool(
            re.search(r"\bworld health organization\b|\bwho\b", normalized)
        )
        explicit_pandemic_designation = bool(
            re.search(
                r"\bdeclare(?:s|d)?\b[^.?!]{0,100}\bpandemic\b|"
                r"\bidentified\b[^.?!]{0,140}\bas\b[^.?!]{0,80}\bpandemic\b",
                normalized,
            )
            or (
                re.search(
                    r"\bidentified\b[^.?!]{0,140}\bas\b[^.?!]{0,80}"
                    r"<epidemic_level>",
                    normalized,
                )
                and re.search(
                    r"<epidemic_level>.{0,420}\bpandemic\b",
                    normalized,
                )
            )
        )
        if who_named and explicit_pandemic_designation:
            return "who_declares_pandemic"
        # "becomes a pandemic" alone does not identify the adjudicating
        # authority, so keep it missing rather than pretending equivalence.
        return None
    return None


def misc_fallback_policy(text: str, family: Optional[str]) -> Optional[str]:
    normalized = normalize_text(text)
    if family == "ism_manufacturing_pmi":
        if (
            re.search(r"\bdoes not release\b|\bnot released\b", normalized)
            and re.search(r"\bnext ism manufacturing pmi report\b", normalized)
            and re.search(r"\bmost recent previous month\b", normalized)
        ):
            return "next_report_then_previous_month"

        # Kalshi ISM template: latest expiration is one month after the report
        # month, with Rulebook payout determination if the value is unavailable.
        if (
            re.search(r"\blatest expiration date\b[^.?!]{0,180}\bone month after\b", normalized)
            and re.search(r"\bdetermine payouts\b.{0,180}\brulebook\b", normalized)
        ):
            return "one_month_then_rulebook"
    return None


def misc_source_policy(text: str, family: Optional[str]) -> Optional[str]:
    normalized = normalize_text(text)
    if family == "ism_manufacturing_pmi":
        if "ism manufacturing pmi report on business" in normalized or re.search(
            r"\bpublished by ism\b", normalized
        ):
            return "ism_report_on_business"
    if family == "pandemic_any_disease":
        if re.search(r"\bofficial announcements from the world health organization\b", normalized):
            return "who_official_announcements"
        if re.search(
            r"\bsource agency\b[^.?!]{0,120}\bworld health organization\b|"
            r"\bsettlement sources?\b[^.?!]{0,120}\bwho\b",
            normalized,
        ):
            return "who_official_announcements"
    return None


def misc_resolution_window(text: str, family: Optional[str]) -> Optional[str]:
    normalized = normalize_text(text)
    if family == "ism_manufacturing_pmi":
        # Prefer the referenced report month/year, not operational release time.
        match = re.search(rf"\bfor\s+({MONTH_PATTERN})\s+(20\d{{2}})\b", normalized)
        if match:
            return f"{int(match.group(2)):04d}-{MONTHS[match.group(1)]:02d}"
        return _misc_month_year(normalized)
    if family == "pandemic_any_disease":
        match = re.search(r"\b(?:pandemic|between january 1,)\b[^.?!]{0,160}\b(20\d{2})\b", normalized)
        if match:
            return match.group(1)
        match = re.search(r"\bin (20\d{2})\b", normalized)
        return match.group(1) if match else None
    return None


def election_operational_deadline(market: Any) -> Optional[str]:
    """
    Operational venue expiry is diagnostic evidence only. It must never be
    substituted for a rule-defined election fallback deadline.
    """
    raw_date = _market_raw_date(
        market,
        "latest_expiration_time",
        "expiration_time",
        "expected_expiration_time",
    )
    if raw_date:
        return raw_date
    value = getattr(market, "close_time", None)
    if value is not None:
        match = re.search(r"\b(20\d{2})-(\d{2})-(\d{2})\b", str(value))
        if match:
            return f"{match.group(1)}-{match.group(2)}-{match.group(3)}"
    return None



def award_scope(text: str) -> Optional[str]:
    """Identify award families that need their own settlement semantics."""
    text = normalize_text(text)
    if re.search(r"\btime(?:'s)?\s+person of the year\b|\btime\s+poty\b", text):
        return "time_person_of_year"
    return None


def award_fallback_deadline(text: str) -> Optional[str]:
    """
    Return only a rule-defined award fallback/long-stop deadline.

    Operational close/expiration timestamps are deliberately not substituted.
    """
    text = normalize_text(text)
    if award_scope(text) != "time_person_of_year":
        return None

    match = re.search(
        rf"(?:not announced|is not announced|isn'?t announced|has not been announced)"
        rf"[^.?!]{{0,120}}?\bby\s+({MONTH_PATTERN})\s+(\d{{1,2}})"
        rf"(?:st|nd|rd|th)?\s*,?\s*(20\d{{2}})\b",
        text,
    )
    if not match:
        return None
    parsed = _safe_date(
        int(match.group(3)),
        MONTHS[match.group(1)],
        int(match.group(2)),
    )
    return f"deadline-{parsed.isoformat()}" if parsed else None


def award_fallback_policy(text: str) -> Optional[str]:
    """Normalize what happens if the award has not been announced by its long-stop."""
    text = normalize_text(text)
    if award_scope(text) != "time_person_of_year":
        return None

    context = re.search(
        r"(?:not announced|is not announced|isn'?t announced|has not been announced)"
        r"[^.?!]{0,220}",
        text,
    )
    segment = context.group(0) if context else ""
    if not segment:
        return None
    if re.search(r'\bresolve(?:s|d)?\s+(?:to\s+)?["\']?no["\']?\b', segment):
        return "resolve_no"
    if re.search(r"\b(?:void|refund)\b", segment):
        return "void_or_refund"
    return "described_unknown"


def award_source_policy(text: str) -> Optional[str]:
    """Normalize explicit award resolution sources without inferring from branding."""
    text = normalize_text(text)
    if award_scope(text) != "time_person_of_year":
        return None

    if (
        re.search(r"\bresolution source\b", text)
        and re.search(r"\btime(?: magazine)? cover(?: or covers)?\b", text)
    ):
        if re.search(r"\bfeature article\b", text):
            return "time_official_cover_or_feature"
        return "time_official_cover"
    return None



def _contract_company_identity(
    contract: Optional[Any],
) -> Tuple[
    Optional[str],
    Optional[str],
    Optional[str],
    Optional[str],
    Optional[str],
]:
    """Parse the engine's conservative company_structured identity.

    Returns: action, subject, target_or_term, cutoff_or_event_date, raw_identity.
    The identity is candidate-discovery evidence only; settlement rule text is
    still parsed independently below before any pair can become arbitrage-safe.
    """
    identity = str(getattr(contract, "contract_identity", "") or "")
    if not identity.startswith("company_structured|"):
        return None, None, None, None, None
    parts = identity.split("|")
    if len(parts) < 5:
        return None, None, None, None, identity
    action = parts[1] or None
    subject = parts[2] or None
    target_or_term = parts[3] or None
    if target_or_term == "none":
        target_or_term = None
    cutoff = parts[4] or None
    return action, subject, target_or_term, cutoff, identity


def company_resolution_window(
    text: str,
    contract: Optional[Any] = None,
) -> Optional[str]:
    action, _, _, identity_window, _ = _contract_company_identity(contract)
    if action == "earnings_mention":
        return None

    # Parse the actual venue rules first. Candidate identity is only a fallback
    # when the rule parser cannot recover a cutoff from the hydrated market.
    parsed = calendar_resolution_window(text)
    if parsed:
        return parsed
    if identity_window and identity_window.startswith("deadline-"):
        return identity_window
    return None


def company_action_from_contract(
    contract: Optional[Any],
    text: str,
) -> Optional[str]:
    action, _, _, _, _ = _contract_company_identity(contract)
    if action:
        return action
    normalized = normalize_text(text)
    if "earnings call" in normalized and re.search(r"\b(?:say|said|mention|mentioned)\b", normalized):
        return "earnings_mention"
    if re.search(r"\bipo\b|\binitial public offering\b", normalized):
        return "ipo"
    if re.search(r"\b(?:acquire|acquisition|buyout)\b", normalized):
        return "acquisition"
    if re.search(r"\b(?:merge|merger|combine|combination)\b", normalized):
        return "combination"
    return None


def company_identity_fields(
    contract: Optional[Any],
) -> Tuple[Optional[str], Optional[str], Optional[str], Optional[str]]:
    action, subject, target_or_term, cutoff_or_date, _ = _contract_company_identity(contract)
    if action == "earnings_mention":
        return subject, None, target_or_term, cutoff_or_date
    return subject, target_or_term, None, None


def company_trigger_policy(text: str, action: Optional[str]) -> Optional[str]:
    normalized = normalize_text(text)
    if action == "ipo":
        if (
            re.search(r"\bshares?\b[^.]{0,160}\blisted\b", normalized)
            and re.search(r"\bopen for trading\b|\bbegin trading\b|\bstarts? trading\b", normalized)
        ):
            return "shares_listed_and_open_for_trading"
        if (
            re.search(r"\bform s-1\b[^.]{0,120}\beffective\b", normalized)
            and re.search(r"\bipo is priced\b|\bipo priced\b", normalized)
            and re.search(r"\bassigned a ticker\b|\bexchange has assigned a ticker\b", normalized)
        ):
            return "s1_effective_or_priced_or_ticker_assigned"
        return None

    if action in {"acquisition", "combination"}:
        if re.search(r"\bdefinitive,? binding agreement\b", normalized):
            return "definitive_binding_control_transfer_agreement_announced"
        if (
            re.search(r"\bofficially announced\b|\bofficial announcement\b", normalized)
            and re.search(r"\b(?:acquired|acquire|acquisition|merged|merge|merger)\b", normalized)
        ):
            return "official_control_transfer_announcement"
        return None

    if action == "earnings_mention":
        if re.search(r"\b(?:said|say|mentioned|mention)\b", normalized) and "earnings call" in normalized:
            return "earnings_call_term_mention"
        return None
    return None


def company_participant_scope(text: str, action: Optional[str]) -> Optional[str]:
    if action != "earnings_mention":
        return None
    normalized = normalize_text(text)
    if re.search(r"\bmentioned by anyone\b|\bsaid by anyone\b", normalized):
        return "anyone"
    if (
        re.search(r"\b(?:company )?representative\b", normalized)
        and re.search(r"\bincluding the operator\b|\boperator of the call\b", normalized)
    ):
        return "company_representative_or_operator"
    return None


def company_term_match_policy(text: str, action: Optional[str]) -> Optional[str]:
    if action != "earnings_mention":
        return None
    normalized = normalize_text(text)
    if (
        re.search(r"\bexact phrase/word\b|\bexact phrase or word\b|\bexact phrase\b", normalized)
        and re.search(r"\bplural\b", normalized)
        and re.search(r"\bpossessive\b", normalized)
    ):
        return "exact_plus_plural_or_possessive"
    if re.search(r"\bexact phrase/word\b|\bexact phrase or word\b|\bexact phrase\b", normalized):
        return "exact_only"
    return None


def company_fallback_policy(text: str, action: Optional[str]) -> Optional[str]:
    if action != "earnings_mention":
        return None
    normalized = normalize_text(text)
    if (
        re.search(r"\b(?:cancelled|canceled|not aired|no qualifying event)\b", normalized)
        and re.search(r"\bno qualifying event\b[^.]{0,160}\bresolve(?:s|d)?\s+(?:to\s+)?[\"']?yes", normalized)
        and re.search(r"\ball other (?:brackets|outcomes)\b[^.]{0,160}\bresolve(?:s|d)?\s+(?:to\s+)?[\"']?no", normalized)
    ):
        return "selected_term_no_if_no_qualifying_event"
    return None


def company_source_policy(text: str, action: Optional[str]) -> Optional[str]:
    normalized = normalize_text(text)
    if action == "earnings_mention":
        if re.search(r"\bvideo\b.{0,260}\bprimarily used\b", normalized) and re.search(r"\btranscripts?\b", normalized):
            return "video_then_transcripts"
        if re.search(r"\bresolution source\b[^.]{0,120}\baudio\b", normalized):
            return "event_audio"
        return None

    if action in {"acquisition", "combination"}:
        if re.search(r"\bconsensus of credible reporting\b", normalized):
            return "official_company_information_or_consensus"
        if re.search(r"\bofficial company channels\b", normalized):
            return "official_company_channels"
        return None

    if action == "ipo":
        if re.search(r"\bconsensus of credible reporting\b", normalized):
            return "official_filings_exchange_or_consensus"
        if (
            re.search(r"\bform s-1\b", normalized)
            and re.search(r"\bsecurities exchange\b|\bexchange\b", normalized)
        ):
            return "official_regulatory_or_exchange_confirmation"
        return None
    return None

def geopolitics_family(text: str) -> Optional[str]:
    normalized = normalize_text(text)
    if re.search(r"\brecogniz(?:e|es|ed|ing)\b", normalized) and re.search(
        r"\bleader of\b", normalized
    ):
        return "leader_recognition"
    return None


def _normalize_geopolitics_entity(value: Any) -> Optional[str]:
    text = normalize_text(value)
    text = re.sub(r"[^a-z0-9]+", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text.replace(" ", "_") if text else None


def geopolitics_recognition_subject(text: str) -> Optional[str]:
    normalized = normalize_text(text)
    match = re.search(
        r"\brecogniz(?:e|es|ed|ing)\s+(.+?)\s+as\s+(?:the\s+)?"
        r"(?:rightful\s+or\s+legitimate\s+)?[\"']?leader of\b",
        normalized,
    )
    if not match:
        return None
    subject = match.group(1)
    # Titles can begin with an actor phrase such as "the united states recognize";
    # the regex begins after the recognition verb, so only the recognized person
    # remains here.
    return _normalize_geopolitics_entity(subject)


def geopolitics_target_state(text: str) -> Optional[str]:
    normalized = normalize_text(text)
    match = re.search(
        r"\bleader of\s+([a-z][a-z ]{1,60}?)(?="
        r"\s+in\s+20\d{2}\b|\s+before\b|\s+by\b|[?\"'|.]|$)",
        normalized,
    )
    return _normalize_geopolitics_entity(match.group(1)) if match else None


def geopolitics_authority_scope(text: str) -> Optional[str]:
    normalized = normalize_text(text)
    if re.search(r"\btrump administration\b", normalized):
        return "trump_administration"
    if re.search(
        r"\bgovernment of the united states\b|\bunited states government\b|\bu\.?s\.? government\b",
        normalized,
    ):
        return "us_government"
    if re.search(
        r"\bunited states\b.{0,100}\brecogniz(?:e|es|ed|ing)\b|"
        r"\bu\.?s\.?\b.{0,100}\brecogniz(?:e|es|ed|ing)\b",
        normalized,
    ):
        return "united_states"
    return None


def geopolitics_recognition_trigger_policy(text: str) -> Optional[str]:
    normalized = normalize_text(text)
    if (
        re.search(r"\bdirect and unqualified\b", normalized)
        and re.search(r"\bofficially recognizes?\b", normalized)
    ):
        return "direct_unqualified_official_recognition"
    if (
        re.search(r"\bofficial action acknowledging\b", normalized)
        and re.search(r"\brightful or legitimate leader\b", normalized)
        and re.search(r"\bmust be explicit\b", normalized)
    ):
        return "explicit_official_legitimacy_recognition"
    if re.search(r"\bofficially recognizes?\b", normalized):
        return "explicit_official_recognition"
    return None


def _normalize_politics_entity(value: Any) -> Optional[str]:
    text = normalize_text(value)
    text = re.sub(r"[^a-z0-9]+", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text.replace(" ", "_") if text else None


def politics_family(text: str) -> Optional[str]:
    normalized = normalize_text(text)
    if re.search(r"\bnext\s+(?:new\s+)?(?:prime minister|president)\s+of\b", normalized):
        return "office_succession"
    if (
        re.search(r"\bminimum wage\b", normalized)
        and re.search(r"\bnew york city\b|\bnyc\b", normalized)
        and re.search(r"\b30\b|\$30", normalized)
    ):
        return "minimum_wage_policy"
    return None


def politics_office_subject(text: str) -> Optional[str]:
    normalized = normalize_text(text)
    match = re.search(
        r"\b(?:next\s+(?:new\s+)?)?(prime minister|president)\s+of\s+"
        r"([a-z][a-z ]{1,60}?)(?=[?.,|]|\s+before\b|\s+by\b|$)",
        normalized,
    )
    if not match:
        return None
    office = _normalize_politics_entity(match.group(1))
    country = _normalize_politics_entity(match.group(2))
    if not office or not country:
        return None
    return f"{office}_of_{country}"


def politics_candidate(text: str) -> Optional[str]:
    normalized = normalize_text(text)
    match = re.search(
        r"\bwill\s+([^|?]{1,100}?)\s+be\s+the\s+next\s+(?:new\s+)?"
        r"(?:prime minister|president)\s+of\b",
        normalized,
    )
    return _normalize_politics_entity(match.group(1)) if match else None


def politics_policy_subject(text: str) -> Optional[str]:
    normalized = normalize_text(text)
    if (
        re.search(r"\bminimum wage\b", normalized)
        and re.search(r"\bnew york city\b|\bnyc\b", normalized)
        and re.search(r"(?:\$\s*)?30(?:\.00)?\b", normalized)
        and re.search(r"\b2030\b", normalized)
    ):
        return "nyc_minimum_wage_30_by_2030"
    return None


def politics_rule_deadline(text: str) -> Optional[str]:
    """Return only a rule-defined politics cutoff, never operational timestamps."""
    normalized = normalize_text(text)

    # "before December 31, 2026, 11:59 PM" means the cutoff occurs on
    # December 31 itself. Do not subtract a day merely because "before" appears.
    timed_before = re.search(
        rf"\bbefore\s+({MONTH_PATTERN})\s+(\d{{1,2}})(?:st|nd|rd|th)?\s*,?\s*"
        rf"(20\d{{2}})\s*,?\s*(?:at\s+)?11:59\s*p\.?m\.?\b",
        normalized,
    )
    if timed_before:
        parsed = _safe_date(
            int(timed_before.group(3)),
            MONTHS[timed_before.group(1)],
            int(timed_before.group(2)),
        )
        if parsed:
            return f"deadline-{parsed.isoformat()}"

    before_date = re.search(
        rf"\bbefore\s+({MONTH_PATTERN})\s+(\d{{1,2}})(?:st|nd|rd|th)?\s*,?\s*(20\d{{2}})\b",
        normalized,
    )
    if before_date:
        parsed = _safe_date(
            int(before_date.group(3)),
            MONTHS[before_date.group(1)],
            int(before_date.group(2)),
        )
        if parsed:
            return f"deadline-{(parsed - timedelta(days=1)).isoformat()}"

    by_date = re.search(
        rf"\bby\s+({MONTH_PATTERN})\s+(\d{{1,2}})(?:st|nd|rd|th)?\s*,?\s*(20\d{{2}})\b",
        normalized,
    )
    if by_date:
        parsed = _safe_date(
            int(by_date.group(3)),
            MONTHS[by_date.group(1)],
            int(by_date.group(2)),
        )
        if parsed:
            return f"deadline-{parsed.isoformat()}"
    return None


def politics_trigger_policy(text: str, family: Optional[str]) -> Optional[str]:
    normalized = normalize_text(text)
    if family == "office_succession":
        if (
            re.search(r"\bformally appointed by the president\b", normalized)
            and re.search(r"\bvote of confidence\b", normalized)
        ):
            return "appointed_and_confidence_noncaretaker"
        if (
            re.search(r"\bofficially sworn in\b", normalized)
            and re.search(r"\binterim or caretaker\b", normalized)
        ):
            return "sworn_in_nonacting"
        if (
            re.search(r"\bformally holds? the position\b", normalized)
            and re.search(r"\bacting, interim|\bacting\b.*\binterim\b", normalized)
        ):
            return "formally_holds_nonacting"
        if re.search(r"\bfirst new person to hold\b", normalized):
            return "first_new_holder_after_issuance"
        return None

    if family == "minimum_wage_policy":
        if (
            re.search(r"\bboth the following occur\b", normalized)
            and re.search(r"\bmamdani wins? the 2025 nyc mayoral election\b", normalized)
            and re.search(r"\bpolicy is enacted\b", normalized)
        ):
            return "mamdani_win_and_policy_enacted"
        if re.search(r"\ba bill establishing a minimum wage\b", normalized) and re.search(
            r"\bbecome law\b|\bhas become law\b", normalized
        ):
            return "bill_becomes_binding_law"
        return None
    return None


def politics_fallback_policy(text: str, family: Optional[str]) -> Optional[str]:
    normalized = normalize_text(text)
    if family == "office_succession" and re.search(
        r"\bif no such (?:prime minister|president) takes office\b", normalized
    ) and re.search(r"\bresolve to [\"']?other[\"']?\b", normalized):
        return "other_bucket"
    if family == "minimum_wage_policy" and re.search(
        r"\bterms are not satisfied\b|\botherwise\b", normalized
    ) and re.search(r"\bresolve to [\"']?no[\"']?\b", normalized):
        return "resolve_no"
    return None


def politics_source_policy(text: str) -> Optional[str]:
    normalized = normalize_text(text)
    if re.search(r"\bofficial information from\b", normalized) and re.search(
        r"\bconsensus of credible reporting\b", normalized
    ):
        return "official_then_consensus"
    if re.search(r"\bresolution source\b", normalized) and re.search(
        r"\bconsensus of credible reporting\b", normalized
    ):
        return "consensus_reporting"
    return None


def _is_soccer(text: str) -> bool:
    normalized = normalize_text(text)

    # Cricket rules frequently contain words such as "penalties" (for
    # example, over-rate penalties).  Do not let that generic token route a
    # cricket full-match winner market through the soccer scope guard.
    if re.search(
        r"\bcricket\b|\binnings?\b|\bsuper over\b|\bduckworth(?:-lewis-?stern)?\b|\bdls\b",
        normalized,
    ):
        return False

    return bool(
        re.search(
            r"\bsoccer\b|\b90 minutes\b|\bstoppage time\b|\bextra time\b|\bpenalt(?:y|ies)\b",
            normalized,
        )
    )

def game_scope(text: str) -> Optional[str]:
    text = normalize_text(text)
    if re.search(
        r"\bfirst 90 minutes\b|\b90 minutes plus stoppage time\b|"
        r"\bdoes not include extra time or penalties\b|\bregulation(?: time)? only\b|"
        r"\bexcluding overtime\b|\bend of regulation\b",
        text,
    ):
        return "regulation_only"

    if re.search(
        r"\bincluding (?:any )?overtime\b|\bincluding extra time\b|"
        r"\bincluding penalties\b|\bextra time and penalties\b|"
        r"\bregardless of (?:the )?match format\b|\bfinal score including\b",
        text,
    ):
        return "full_event_including_overtime"

    if _is_soccer(text):
        return None

    if re.search(r"\bgame winner\b|\bmatch winner\b|\bteam who wins\b|\bfinal score\b", text):
        return "full_event"

    return None


def tie_policy(text: str) -> Optional[str]:
    text = normalize_text(text)
    if re.search(r"\bresolve(?:s|d)?\s+(?:to\s+)?(?:\$?0\.50|50-50|50\/50)\b|\b\$0\.50 for each team\b", text):
        return "split_50_50"
    if re.search(r"\btie market\b[^.]{0,80}\bresolve(?:s|d)?\s+to\s+yes\b", text):
        return "selected_team_no"
    if re.search(r"\bif .* wins?.*yes\b[^.]{0,160}\botherwise.*no\b", text):
        return "selected_team_no"
    if re.search(r"\btie\b[^.]{0,80}\b(?:void|refund)\b", text):
        return "void_or_refund"
    return None


def cancellation_policy(text: str) -> Optional[str]:
    text = normalize_text(text)
    cancellation_context = re.search(
        r"(?:cancel(?:led|ed|lation)|abandon(?:ed|ment))[^.]{0,220}",
        text,
    )
    segment = cancellation_context.group(0) if cancellation_context else ""
    if not segment:
        return None
    if re.search(r"\b(?:fair price|fair market price)\b", segment):
        return "fair_price"
    if re.search(r"\b(?:50-50|50\/50|\$?0\.50)\b", segment):
        return "split_50_50"
    if re.search(r"\bresolve(?:s|d)?\s+(?:to\s+)?[\"\']?no[\"\']?\b", segment):
        return "selected_team_no"
    if re.search(r"\b(?:void|refund)\b", segment):
        return "void_or_refund"
    return "described_unknown"


def postponement_policy(text: str) -> Optional[str]:
    text = normalize_text(text)
    if not re.search(r"\bpostpon(?:ed|ement)\b|\breschedul(?:ed|ing)\b|\bdelay(?:ed)?\b", text):
        return None

    if re.search(r"\bwithin\s+48\s+hours\b", text):
        return "wait_up_to_48_hours"
    if re.search(r"\bwithin\s+2\s+days\b", text):
        return "wait_up_to_2_days"
    if re.search(r"\bover\s+two\s+weeks\b|\bwithin\s+2\s+weeks\b", text):
        return "wait_up_to_2_weeks"
    if re.search(r"\bremains? open until .*completed\b|\buntil the game has been completed\b", text):
        return "wait_until_completed"
    if re.search(r"\bfair (?:market )?price\b", text):
        return "fair_price_after_delay"
    return "described_unknown"

def source_policy(text: str) -> Optional[str]:
    text = normalize_text(text)
    if re.search(r"\bofficial final result\b|\bofficial statistics\b|\bgoverning body\b|\bevent organizers\b", text):
        return "official_result"
    if re.search(r"\bconsensus of credible reporting\b", text):
        return "official_then_consensus"
    return None


def _contract_crypto_identity(contract: Optional[Any]) -> Tuple[Optional[str], Optional[str], Optional[str], Optional[str]]:
    identity = str(getattr(contract, "contract_identity", "") or "")
    if not identity.startswith("crypto_structured|"):
        return None, None, None, None
    parts = identity.split("|")
    if len(parts) < 5:
        return None, None, None, None
    asset = parts[1] or None
    observation = parts[2] or None
    threshold = parts[3] or None
    window = parts[4] or None
    return asset, observation, threshold, window


def _month_date_from_match(month: str, day: str, year: str) -> Optional[str]:
    parsed = _safe_date(int(year), MONTHS[month], int(day))
    return parsed.isoformat() if parsed else None


def crypto_resolution_window(text: str, contract: Optional[Any] = None) -> Optional[str]:
    text = normalize_text(text)

    # Exact midnight on Jan 1 is the instant immediately after the preceding
    # calendar day. This is common in Kalshi year-end path markets.
    midnight_next_year = re.search(
        rf"\bbefore\s+({MONTH_PATTERN})\s+(\d{{1,2}})(?:st|nd|rd|th)?\s*,?\s*(20\d{{2}})\s+at\s+12(?::00)?\s*am\b",
        text,
    )
    if midnight_next_year:
        parsed = _safe_date(
            int(midnight_next_year.group(3)),
            MONTHS[midnight_next_year.group(1)],
            int(midnight_next_year.group(2)),
        )
        if parsed:
            return f"deadline-{(parsed - timedelta(days=1)).isoformat()}"

    # Rules that explicitly run through or until 11:59 PM on a date include
    # that calendar date in the observation period.
    on_1159 = re.search(
        rf"\b(?:through|until|before|by)?[^.?!]{{0,50}}?11:59\s*pm(?:\s+et)?\s+(?:on\s+)?({MONTH_PATTERN})\s+(\d{{1,2}})(?:st|nd|rd|th)?\s*,?\s*(20\d{{2}})\b",
        text,
    )
    if on_1159:
        parsed = _safe_date(int(on_1159.group(3)), MONTHS[on_1159.group(1)], int(on_1159.group(2)))
        if parsed:
            return f"deadline-{parsed.isoformat()}"

    # Polymarket path rules often say "between START and Dec 31, YYYY, 23:59".
    end_of_range = re.search(
        rf"\b(?:and|through|until)\s+({MONTH_PATTERN})\s+(\d{{1,2}})(?:st|nd|rd|th)?\s*,?\s*(20\d{{2}})(?:\s*,?\s*23:59)?\b",
        text,
    )
    if end_of_range:
        parsed = _safe_date(int(end_of_range.group(3)), MONTHS[end_of_range.group(1)], int(end_of_range.group(2)))
        if parsed:
            return f"deadline-{parsed.isoformat()}"

    # Relative-performance contracts may define the whole calendar year.
    year = re.search(r"\b(?:for|in|during)\s+(20\d{2})\b", text)
    if year and re.search(r"\b(outperform|performance|percentage change)\b", text):
        return f"year-{year.group(1)}"

    # Fall back only after the crypto-specific boundary patterns above.
    parsed = calendar_resolution_window(text)
    if parsed:
        return parsed

    _, _, _, identity_window = _contract_crypto_identity(contract)
    return identity_window


def crypto_reference_source(text: str) -> Optional[str]:
    text = normalize_text(text)
    if "tradingview" in text and "binance" in text and ("oanda" in text or "xau/usd" in text):
        return "tradingview:binance_btcusdt+oanda_xauusd"
    if "cf benchmarks" in text and ("ice data" in text or "ice data service" in text):
        return "cf_benchmarks:bitcoin_rti+ice_data:gold"
    if re.search(r"\bcf bitcoin real[- ]time index\b|\bbrti\b", text):
        return "cf_benchmarks:brti"
    if re.search(r"\bcf solana-dollar real time index\b|\bsolusd_rti\b", text):
        return "cf_benchmarks:solusd_rti"
    if "binance" in text:
        if "btc/usdt" in text or "btc_usdt" in text:
            return "binance:btc_usdt"
        if "sol/usdt" in text or "sol_usdt" in text:
            return "binance:sol_usdt"
        if "eth/usdt" in text or "eth_usdt" in text:
            return "binance:eth_usdt"
        return "binance"
    return None


def crypto_measurement_method(text: str) -> Optional[str]:
    text = normalize_text(text)
    if re.search(r"\b12m\b", text) and re.search(r"\b(?:change|percentage change)\b", text):
        return "annual_candle_percentage_change"
    if "trimmed mean" in text:
        return "trimmed_mean_path"
    if "simple average" in text:
        return "simple_average_path"
    if re.search(r"\b1[- ]?minute candle\b|\b1 minute candle\b", text):
        if re.search(r"\bhigh\b", text):
            return "one_minute_candle_high"
        if re.search(r"\blow\b", text):
            return "one_minute_candle_low"
        return "one_minute_candle"
    if re.search(r"\bperformance of bitcoin\b", text) and re.search(r"\bperformance of gold\b", text):
        return "venue_defined_relative_performance"
    return None


def crypto_boundary_operator(text: str) -> Optional[str]:
    text = normalize_text(text)
    if re.search(r"\bequal to or greater than\b|\bgreater than or equal to\b|\bat least\b", text):
        return "gte"
    if re.search(r"\bequal to or lower than\b|\bless than or equal to\b|\bat most\b", text):
        return "lte"
    if re.search(r"\bstrictly exceed\b|\bis above\b|\bbe above\b", text):
        return "gt"
    if re.search(r"\bstrictly less than\b|\bis below\b|\bbe below\b|\bever below\b", text):
        return "lt"
    if re.search(r"\bhigher than\b", text) and re.search(r"\bpercentage change\b|\bperformance\b", text):
        return "gt_relative"
    return None


def crypto_threshold(text: str, contract: Optional[Any] = None) -> Optional[str]:
    text = normalize_text(text)
    patterns = (
        r"\b(?:above|below|greater than|less than)\s*\$?\s*([0-9][0-9,]*(?:\.\d+)?)\b",
        r"\bthreshold(?: value)?\s*(?:of|is|=)?\s*\$?\s*([0-9][0-9,]*(?:\.\d+)?)\b",
    )
    for pattern in patterns:
        match = re.search(pattern, text)
        if match:
            raw = match.group(1).replace(",", "")
            try:
                number = format(Decimal(raw).normalize(), "f")
            except Exception:
                number = raw
            return "0" if number in {"-0", ""} else number
    _, _, identity_threshold, _ = _contract_crypto_identity(contract)
    return identity_threshold


def crypto_measurement_start(text: str) -> Optional[str]:
    text = normalize_text(text)
    month_pattern = rf"({MONTH_PATTERN})\s+(\d{{1,2}})(?:st|nd|rd|th)?\s*,?\s*(20\d{{2}})"
    for prefix in ("between", "starting", "from"):
        match = re.search(rf"\b{prefix}\s+{month_pattern}", text)
        if match:
            return _month_date_from_match(match.group(1), match.group(2), match.group(3))

    numeric = re.search(r"\bstarting\s+(\d{1,2})/(\d{1,2})/(20\d{2})\b", text)
    if numeric:
        parsed = _safe_date(int(numeric.group(3)), int(numeric.group(1)), int(numeric.group(2)))
        if parsed:
            return parsed.isoformat()

    if re.search(r"\b(?:after|from)\s+(?:market\s+)?issuance\b|\bmarket issuance\b", text):
        return "market_issuance"
    return None


def crypto_missing_data_policy(text: str) -> Optional[str]:
    text = normalize_text(text)
    if re.search(r"\b(?:no data|data is unavailable|data unavailable|unavailable or incomplete)[^.?!]{0,120}\bresolve(?:s|d)?\s+to\s+no\b", text):
        return "resolve_no"
    if re.search(r"\b(?:no data|data is unavailable|data unavailable)[^.?!]{0,120}\b(?:void|refund)\b", text):
        return "void_or_refund"
    return None


def crypto_observation_from_contract(contract: Optional[Any], text: str) -> Optional[str]:
    _, observation, _, _ = _contract_crypto_identity(contract)
    if observation:
        return observation
    normalized = normalize_text(text)
    if "outperform" in normalized or "percentage change" in normalized:
        return "relative_performance"
    return None


def crypto_asset_from_contract(contract: Optional[Any], text: str) -> Optional[str]:
    asset, _, _, _ = _contract_crypto_identity(contract)
    if asset:
        return asset
    normalized = normalize_text(text)
    if "bitcoin" in normalized and "gold" in normalized:
        return "bitcoin_vs_gold"
    for token, name in (("bitcoin", "bitcoin"), ("ethereum", "ethereum"), ("solana", "solana"), ("xrp", "xrp"), ("dogecoin", "dogecoin")):
        if re.search(rf"\b{token}\b", normalized):
            return name
    return None


def _date_from_market_resolution(market: Any) -> Optional[str]:
    for attribute in ("resolution_time", "settlement_time"):
        value = getattr(market, attribute, None)
        if value is None:
            continue
        if hasattr(value, "date"):
            try:
                return value.date().isoformat()
            except (AttributeError, ValueError):
                pass
        raw = str(value)
        match = re.search(r"\b(20\d{2})-(\d{2})-(\d{2})\b", raw)
        if match:
            return f"{match.group(1)}-{match.group(2)}-{match.group(3)}"
    return None


def build_signature(market: Any, market_group: str, contract: Optional[Any] = None) -> SettlementSignature:
    text = market_rule_text(market)
    evidence = []
    crypto_asset_value = None
    crypto_observation_value = None
    crypto_reference_source_value = None
    crypto_measurement_method_value = None
    crypto_boundary_operator_value = None
    crypto_threshold_value = None
    crypto_measurement_start_value = None
    crypto_missing_data_policy_value = None
    company_action_value = None
    company_subject_value = None
    company_target_value = None
    company_term_value = None
    company_event_date_value = None
    company_trigger_policy_value = None
    company_participant_scope_value = None
    company_term_match_policy_value = None
    company_fallback_policy_value = None
    company_source_policy_value = None
    geopolitics_family_value = None
    geopolitics_subject_value = None
    geopolitics_target_state_value = None
    geopolitics_authority_scope_value = None
    geopolitics_trigger_policy_value = None
    geopolitics_source_policy_value = None
    politics_family_value = None
    politics_subject_value = None
    politics_candidate_value = None
    politics_trigger_policy_value = None
    politics_fallback_policy_value = None
    politics_source_policy_value = None
    election_trigger_policy_value = None
    election_fallback_policy_value = None
    election_replacement_policy_value = None
    election_exception_policy_value = None
    election_source_policy_value = None
    entertainment_family_value = None
    entertainment_subject_value = None
    entertainment_content_type_value = None
    entertainment_region_value = None
    entertainment_rank_value = None
    entertainment_observation_date_value = None
    entertainment_week_scope_value = None
    entertainment_fallback_deadline_value = None
    entertainment_fallback_policy_value = None
    entertainment_source_policy_value = None
    misc_family_value = None
    misc_subject_value = None
    misc_operator_value = None
    misc_threshold_value = None
    misc_precision_value = None
    misc_trigger_policy_value = None
    misc_fallback_policy_value = None
    misc_source_policy_value = None

    if market_group == "sports":
        fallback_resolution = _date_from_market_resolution(market)
        reference_year = int(fallback_resolution[:4]) if fallback_resolution else None
        resolution = sports_resolution_window(text, reference_year) or fallback_resolution
        scope = game_scope(text)
        if scope is None and not _is_soccer(text):
            scope = "full_event"
        tie = tie_policy(text)
        cancellation = cancellation_policy(text)
        postponement = postponement_policy(text)
        source = source_policy(text)

        # Fill audited series-term semantics that are not present in Kalshi's
        # short per-market text.  These are authoritative term-template facts,
        # not assumptions based on listing/open timestamps.
        sports_overrides = audited_kalshi_sports_semantic_overrides(market)
        if sports_overrides:
            scope = sports_overrides.get("game_scope", scope)
            tie = sports_overrides.get("tie_policy", tie)
            cancellation = sports_overrides.get("cancellation_policy", cancellation)
            postponement = sports_overrides.get("postponement_policy", postponement)
            source = sports_overrides.get("source_policy", source)
    else:
        event_identity = str(getattr(contract, "event_identity", "") or "")
        parts = event_identity.split("|")
        if market_group == "macro" and len(parts) >= 6:
            resolution = parts[4]
            scope = parts[-1] if parts else None
        elif market_group == "weather" and len(parts) >= 7:
            resolution = parts[3]
            scope = parts[-1] if parts else None
        elif market_group == "elections":
            # Election day is not the same thing as the terminal settlement
            # cutoff. Use only an explicit unresolved-result fallback deadline.
            resolution = election_fallback_deadline(text)
            scope = election_scope_for_market(market, text)
            election_trigger_policy_value = election_trigger_policy(text, scope)
            election_fallback_policy_value = election_fallback_policy(text)
            election_replacement_policy_value = election_replacement_policy(text, scope)
            election_exception_policy_value = election_exception_policy(text)
            election_source_policy_value = election_source_policy(text)
        elif market_group == "entertainment" and entertainment_family(text):
            entertainment_family_value = entertainment_family(text)
            entertainment_subject_value = entertainment_subject_for_market(market)
            entertainment_content_type_value = entertainment_content_type(text)
            entertainment_region_value = entertainment_region(text)
            entertainment_rank_value = entertainment_rank(text)
            entertainment_observation_date_value = entertainment_observation_date(text)
            entertainment_week_scope_value = entertainment_week_scope(text)
            entertainment_fallback_deadline_value = entertainment_fallback_deadline(text)
            entertainment_fallback_policy_value = entertainment_fallback_policy(text)
            entertainment_source_policy_value = entertainment_source_policy(text)
            resolution = entertainment_observation_date_value
            if (
                entertainment_content_type_value
                and entertainment_region_value
                and entertainment_rank_value
            ):
                scope = (
                    f"{entertainment_content_type_value}:"
                    f"{entertainment_region_value}:rank{entertainment_rank_value}"
                )
            else:
                scope = entertainment_family_value
        elif market_group == "misc" and misc_family_for_market(market, text):
            misc_family_value = misc_family_for_market(market, text)
            misc_subject_value = misc_subject_for_market(market, misc_family_value)
            misc_operator_value, misc_threshold_value = misc_operator_threshold(
                text, misc_family_value
            )
            misc_precision_value = misc_precision_policy(text, misc_family_value)
            misc_trigger_policy_value = misc_trigger_policy(text, misc_family_value)
            misc_fallback_policy_value = misc_fallback_policy(text, misc_family_value)
            misc_source_policy_value = misc_source_policy(text, misc_family_value)
            audited_trigger, audited_source = audited_kalshi_misc_semantic_overrides(
                market, misc_family_value
            )
            misc_trigger_policy_value = misc_trigger_policy_value or audited_trigger
            misc_source_policy_value = misc_source_policy_value or audited_source
            resolution = misc_resolution_window(text, misc_family_value)
            scope = misc_subject_value or misc_family_value
        elif market_group == "crypto":
            resolution = crypto_resolution_window(text, contract)
            crypto_asset_value = crypto_asset_from_contract(contract, text)
            crypto_observation_value = crypto_observation_from_contract(contract, text)
            crypto_reference_source_value = crypto_reference_source(text)
            crypto_measurement_method_value = crypto_measurement_method(text)
            crypto_boundary_operator_value = crypto_boundary_operator(text)
            crypto_threshold_value = crypto_threshold(text, contract)
            crypto_measurement_start_value = crypto_measurement_start(text)
            crypto_missing_data_policy_value = crypto_missing_data_policy(text)
            scope = crypto_observation_value
        elif market_group == "awards" and award_scope(text):
            resolution = award_fallback_deadline(text)
            scope = award_scope(text)
        elif market_group == "companies":
            company_action_value = company_action_from_contract(contract, text)
            (
                company_subject_value,
                company_target_value,
                company_term_value,
                company_event_date_value,
            ) = company_identity_fields(contract)
            resolution = company_resolution_window(text, contract)
            scope = company_action_value
            company_trigger_policy_value = company_trigger_policy(text, company_action_value)
            company_participant_scope_value = company_participant_scope(text, company_action_value)
            company_term_match_policy_value = company_term_match_policy(text, company_action_value)
            company_fallback_policy_value = company_fallback_policy(text, company_action_value)
            company_source_policy_value = company_source_policy(text, company_action_value)
        elif market_group == "geopolitics":
            resolution = calendar_resolution_window(text)
            geopolitics_family_value = geopolitics_family(text)
            if geopolitics_family_value == "leader_recognition":
                geopolitics_subject_value = geopolitics_recognition_subject(text)
                geopolitics_target_state_value = geopolitics_target_state(text)
                geopolitics_authority_scope_value = geopolitics_authority_scope(text)
                geopolitics_trigger_policy_value = geopolitics_recognition_trigger_policy(text)
                geopolitics_source_policy_value = source_policy(text)
            scope = geopolitics_family_value
        elif market_group == "politics" and politics_family(text):
            politics_family_value = politics_family(text)
            resolution = politics_rule_deadline(text)
            if politics_family_value == "office_succession":
                politics_subject_value = politics_office_subject(text)
                politics_candidate_value = politics_candidate(text)
            elif politics_family_value == "minimum_wage_policy":
                politics_subject_value = politics_policy_subject(text)
            politics_trigger_policy_value = politics_trigger_policy(text, politics_family_value)
            politics_fallback_policy_value = politics_fallback_policy(text, politics_family_value)
            politics_source_policy_value = politics_source_policy(text)
            scope = politics_family_value
        else:
            resolution = calendar_resolution_window(text)
            scope = parts[-1] if parts else None
        if market_group == "elections":
            tie = election_tie_policy(text, scope)
        elif market_group == "entertainment" and entertainment_family_value:
            tie = entertainment_tie_policy(text)
        else:
            tie = None
        cancellation = None
        postponement = None
        if market_group == "elections":
            source = election_source_policy_value
        elif market_group == "entertainment" and entertainment_family_value:
            source = entertainment_source_policy_value
        elif market_group == "awards":
            source = award_source_policy(text)
        elif market_group == "companies":
            source = company_source_policy_value
        elif market_group == "geopolitics":
            source = geopolitics_source_policy_value or source_policy(text)
        elif market_group == "politics" and politics_family_value:
            source = politics_source_policy_value
        else:
            source = source_policy(text)

    if market_group == "elections":
        for label, value in (
            ("election_trigger_policy", election_trigger_policy_value),
            ("election_fallback_policy", election_fallback_policy_value),
            ("election_replacement_policy", election_replacement_policy_value),
            ("election_exception_policy", election_exception_policy_value),
            ("election_source_policy", election_source_policy_value),
        ):
            if value:
                evidence.append(f"{label}={value}")
        operational_deadline = election_operational_deadline(market)
        if operational_deadline:
            evidence.append(f"election_operational_deadline={operational_deadline}")

    if market_group == "entertainment" and entertainment_family_value:
        for label, value in (
            ("entertainment_family", entertainment_family_value),
            ("entertainment_subject", entertainment_subject_value),
            ("entertainment_content_type", entertainment_content_type_value),
            ("entertainment_region", entertainment_region_value),
            ("entertainment_rank", entertainment_rank_value),
            ("entertainment_observation_date", entertainment_observation_date_value),
            ("entertainment_week_scope", entertainment_week_scope_value),
            ("entertainment_fallback_deadline", entertainment_fallback_deadline_value),
            ("entertainment_fallback_policy", entertainment_fallback_policy_value),
            ("entertainment_source_policy", entertainment_source_policy_value),
        ):
            if value:
                evidence.append(f"{label}={value}")

    if market_group == "awards":
        fallback_policy = award_fallback_policy(text)
        if fallback_policy:
            evidence.append(f"award_fallback_policy={fallback_policy}")

    if market_group == "crypto":
        for label, value in (
            ("crypto_asset", crypto_asset_value),
            ("crypto_observation", crypto_observation_value),
            ("crypto_reference_source", crypto_reference_source_value),
            ("crypto_measurement_method", crypto_measurement_method_value),
            ("crypto_boundary_operator", crypto_boundary_operator_value),
            ("crypto_threshold", crypto_threshold_value),
            ("crypto_measurement_start", crypto_measurement_start_value),
            ("crypto_missing_data_policy", crypto_missing_data_policy_value),
        ):
            if value:
                evidence.append(f"{label}={value}")

    if market_group == "companies":
        for label, value in (
            ("company_action", company_action_value),
            ("company_subject", company_subject_value),
            ("company_target", company_target_value),
            ("company_term", company_term_value),
            ("company_event_date", company_event_date_value),
            ("company_trigger_policy", company_trigger_policy_value),
            ("company_participant_scope", company_participant_scope_value),
            ("company_term_match_policy", company_term_match_policy_value),
            ("company_fallback_policy", company_fallback_policy_value),
            ("company_source_policy", company_source_policy_value),
        ):
            if value:
                evidence.append(f"{label}={value}")

    if market_group == "geopolitics":
        for label, value in (
            ("geopolitics_family", geopolitics_family_value),
            ("geopolitics_subject", geopolitics_subject_value),
            ("geopolitics_target_state", geopolitics_target_state_value),
            ("geopolitics_authority_scope", geopolitics_authority_scope_value),
            ("geopolitics_trigger_policy", geopolitics_trigger_policy_value),
            ("geopolitics_source_policy", geopolitics_source_policy_value),
        ):
            if value:
                evidence.append(f"{label}={value}")

    if market_group == "politics" and politics_family_value:
        for label, value in (
            ("politics_family", politics_family_value),
            ("politics_subject", politics_subject_value),
            ("politics_candidate", politics_candidate_value),
            ("politics_trigger_policy", politics_trigger_policy_value),
            ("politics_fallback_policy", politics_fallback_policy_value),
            ("politics_source_policy", politics_source_policy_value),
        ):
            if value:
                evidence.append(f"{label}={value}")

    if market_group == "misc" and misc_family_value:
        for label, value in (
            ("misc_family", misc_family_value),
            ("misc_subject", misc_subject_value),
            ("misc_operator", misc_operator_value),
            ("misc_threshold", misc_threshold_value),
            ("misc_precision", misc_precision_value),
            ("misc_trigger_policy", misc_trigger_policy_value),
            ("misc_fallback_policy", misc_fallback_policy_value),
            ("misc_source_policy", misc_source_policy_value),
        ):
            if value:
                evidence.append(f"{label}={value}")

    for label, value in (
        ("resolution_window", resolution),
        ("game_scope", scope),
        ("tie_policy", tie),
        ("cancellation_policy", cancellation),
        ("postponement_policy", postponement),
        ("source_policy", source),
    ):
        if value:
            evidence.append(f"{label}={value}")

    return SettlementSignature(
        market_group=market_group,
        resolution_window=resolution,
        game_scope=scope,
        tie_policy=tie,
        cancellation_policy=cancellation,
        postponement_policy=postponement,
        source_policy=source,
        evidence=tuple(evidence),
        crypto_asset=crypto_asset_value,
        crypto_observation=crypto_observation_value,
        crypto_reference_source=crypto_reference_source_value,
        crypto_measurement_method=crypto_measurement_method_value,
        crypto_boundary_operator=crypto_boundary_operator_value,
        crypto_threshold=crypto_threshold_value,
        crypto_measurement_start=crypto_measurement_start_value,
        crypto_missing_data_policy=crypto_missing_data_policy_value,
        company_action=company_action_value,
        company_subject=company_subject_value,
        company_target=company_target_value,
        company_term=company_term_value,
        company_event_date=company_event_date_value,
        company_trigger_policy=company_trigger_policy_value,
        company_participant_scope=company_participant_scope_value,
        company_term_match_policy=company_term_match_policy_value,
        company_fallback_policy=company_fallback_policy_value,
        company_source_policy=company_source_policy_value,
        geopolitics_family=geopolitics_family_value,
        geopolitics_subject=geopolitics_subject_value,
        geopolitics_target_state=geopolitics_target_state_value,
        geopolitics_authority_scope=geopolitics_authority_scope_value,
        geopolitics_trigger_policy=geopolitics_trigger_policy_value,
        geopolitics_source_policy=geopolitics_source_policy_value,
        politics_family=politics_family_value,
        politics_subject=politics_subject_value,
        politics_candidate=politics_candidate_value,
        politics_trigger_policy=politics_trigger_policy_value,
        politics_fallback_policy=politics_fallback_policy_value,
        politics_source_policy=politics_source_policy_value,
        election_trigger_policy=election_trigger_policy_value,
        election_fallback_policy=election_fallback_policy_value,
        election_replacement_policy=election_replacement_policy_value,
        election_exception_policy=election_exception_policy_value,
        election_source_policy=election_source_policy_value,
        entertainment_family=entertainment_family_value,
        entertainment_subject=entertainment_subject_value,
        entertainment_content_type=entertainment_content_type_value,
        entertainment_region=entertainment_region_value,
        entertainment_rank=entertainment_rank_value,
        entertainment_observation_date=entertainment_observation_date_value,
        entertainment_week_scope=entertainment_week_scope_value,
        entertainment_fallback_deadline=entertainment_fallback_deadline_value,
        entertainment_fallback_policy=entertainment_fallback_policy_value,
        entertainment_source_policy=entertainment_source_policy_value,
        misc_family=misc_family_value,
        misc_subject=misc_subject_value,
        misc_operator=misc_operator_value,
        misc_threshold=misc_threshold_value,
        misc_precision=misc_precision_value,
        misc_trigger_policy=misc_trigger_policy_value,
        misc_fallback_policy=misc_fallback_policy_value,
        misc_source_policy=misc_source_policy_value,
    )


def _same_or_both_missing(left: Optional[str], right: Optional[str]) -> bool:
    return left == right


def _scope_compatible(left: Optional[str], right: Optional[str]) -> bool:
    if left == right:
        return True
    full_event_scopes = {"full_event", "full_event_including_overtime"}
    return left in full_event_scopes and right in full_event_scopes

def _iso_resolution_date(
    value: Optional[str],
) -> Optional[date]:
    if not value:
        return None

    if value.startswith("ambiguous:"):
        return None

    try:
        return date.fromisoformat(value)
    except ValueError:
        return None


def _sports_resolution_compatible(
    left: Optional[str],
    right: Optional[str],
) -> bool:
    """
    Compare the rule-defined event dates, not market listing or opening times.

    A one-calendar-day difference is tolerated for sports because the same
    event can be described under different venue time zones on opposite sides
    of midnight.

    Larger differences remain a hard settlement mismatch.
    """
    if left == right:
        return True

    left_date = _iso_resolution_date(left)
    right_date = _iso_resolution_date(right)

    if not left_date or not right_date:
        return False

    return abs(
        (left_date - right_date).days
    ) <= 1

def verify_exact_pair(
    polymarket_contract: Any,
    kalshi_contract: Any,
    markets: Mapping[int, Any],
    *,
    require_exception_equivalence: bool = True,
) -> SettlementDecision:
    group = str(getattr(polymarket_contract, "market_group", "") or "")
    poly_market = markets[getattr(polymarket_contract, "market_id")]
    kalshi_market = markets[getattr(kalshi_contract, "market_id")]

    poly = build_signature(poly_market, group, polymarket_contract)
    kalshi = build_signature(kalshi_market, group, kalshi_contract)
    reasons = []

    if getattr(polymarket_contract, "event_identity", None) != getattr(kalshi_contract, "event_identity", None):
        reasons.append("event_identity_mismatch")
    if getattr(polymarket_contract, "contract_identity", None) != getattr(kalshi_contract, "contract_identity", None):
        reasons.append("contract_identity_mismatch")

    if reasons:
        return SettlementDecision("rejected", False, False, tuple(reasons), poly, kalshi)

    if group == "elections":
        audited_series_reason = audited_kalshi_election_series_rejection(kalshi_market)
        if audited_series_reason:
            return SettlementDecision(
                "rejected",
                False,
                False,
                (audited_series_reason,),
                poly,
                kalshi,
            )

        mismatch_reasons = []
        missing_reasons = []

        if not poly.game_scope or not kalshi.game_scope:
            missing_reasons.append("missing_election_scope")
        elif poly.game_scope != kalshi.game_scope:
            mismatch_reasons.append("election_scope_mismatch")

        if not poly.election_trigger_policy or not kalshi.election_trigger_policy:
            missing_reasons.append("missing_election_trigger_policy")
        elif poly.election_trigger_policy != kalshi.election_trigger_policy:
            mismatch_reasons.append("election_trigger_policy_mismatch")

        tie_required = (
            poly.game_scope in {"candidate_rank_2", "candidate_rank_3", "party_most_seats"}
            or kalshi.game_scope in {"candidate_rank_2", "candidate_rank_3", "party_most_seats"}
            or bool(poly.tie_policy)
            or bool(kalshi.tie_policy)
        )
        if tie_required:
            if not poly.tie_policy or not kalshi.tie_policy:
                missing_reasons.append("missing_election_tie_policy")
            elif poly.tie_policy != kalshi.tie_policy:
                mismatch_reasons.append("election_tie_policy_mismatch")

        if not poly.resolution_window or not kalshi.resolution_window:
            missing_reasons.append("missing_election_fallback_deadline")
        elif poly.resolution_window != kalshi.resolution_window:
            mismatch_reasons.append("election_fallback_deadline_mismatch")

        if not poly.election_fallback_policy or not kalshi.election_fallback_policy:
            missing_reasons.append("missing_election_fallback_policy")
        elif poly.election_fallback_policy != kalshi.election_fallback_policy:
            mismatch_reasons.append("election_fallback_policy_mismatch")

        if not poly.election_source_policy or not kalshi.election_source_policy:
            missing_reasons.append("missing_election_source_policy")
        elif poly.election_source_policy != kalshi.election_source_policy:
            mismatch_reasons.append("election_source_policy_mismatch")

        replacement_required = (
            poly.game_scope == "party_nominee"
            or kalshi.game_scope == "party_nominee"
            or bool(poly.election_replacement_policy)
            or bool(kalshi.election_replacement_policy)
        )
        if replacement_required:
            if not poly.election_replacement_policy or not kalshi.election_replacement_policy:
                missing_reasons.append("missing_election_replacement_policy")
            elif poly.election_replacement_policy != kalshi.election_replacement_policy:
                mismatch_reasons.append("election_replacement_policy_mismatch")

        exception_required = bool(poly.election_exception_policy) or bool(kalshi.election_exception_policy)
        if exception_required:
            if not poly.election_exception_policy or not kalshi.election_exception_policy:
                missing_reasons.append("missing_election_exception_policy")
            elif poly.election_exception_policy != kalshi.election_exception_policy:
                mismatch_reasons.append("election_exception_policy_mismatch")

        if mismatch_reasons:
            return SettlementDecision(
                "rejected",
                False,
                False,
                tuple(mismatch_reasons + missing_reasons),
                poly,
                kalshi,
            )
        if missing_reasons:
            return SettlementDecision(
                "manual_review",
                False,
                False,
                tuple(missing_reasons),
                poly,
                kalshi,
            )
        return SettlementDecision(
            "strict_verified",
            True,
            True,
            ("election_settlement_dimensions_match",),
            poly,
            kalshi,
        )

    if group == "entertainment" and (
        poly.entertainment_family or kalshi.entertainment_family
    ):
        audited_series_reason = audited_kalshi_entertainment_series_rejection(kalshi_market)
        if audited_series_reason:
            return SettlementDecision(
                "rejected",
                False,
                False,
                (audited_series_reason,),
                poly,
                kalshi,
            )

        mismatch_reasons = []
        missing_reasons = []

        def compare_entertainment_dimension(
            label: str,
            left: Optional[str],
            right: Optional[str],
            *,
            required: bool = True,
        ) -> None:
            if not left or not right:
                if required:
                    missing_reasons.append(f"missing_entertainment_{label}")
                return
            if left != right:
                mismatch_reasons.append(f"entertainment_{label}_mismatch")

        compare_entertainment_dimension("family", poly.entertainment_family, kalshi.entertainment_family)
        compare_entertainment_dimension("subject", poly.entertainment_subject, kalshi.entertainment_subject)
        compare_entertainment_dimension("content_type", poly.entertainment_content_type, kalshi.entertainment_content_type)
        compare_entertainment_dimension("region", poly.entertainment_region, kalshi.entertainment_region)
        compare_entertainment_dimension("rank", poly.entertainment_rank, kalshi.entertainment_rank)
        compare_entertainment_dimension("observation_date", poly.entertainment_observation_date, kalshi.entertainment_observation_date)
        compare_entertainment_dimension("week_scope", poly.entertainment_week_scope, kalshi.entertainment_week_scope)
        compare_entertainment_dimension("source_policy", poly.entertainment_source_policy, kalshi.entertainment_source_policy)

        # A delayed/missing Netflix chart can change settlement. Require both
        # venues to disclose the same long-stop and fallback behavior before
        # treating the pair as risk-free.
        compare_entertainment_dimension(
            "fallback_deadline",
            poly.entertainment_fallback_deadline,
            kalshi.entertainment_fallback_deadline,
        )
        compare_entertainment_dimension(
            "fallback_policy",
            poly.entertainment_fallback_policy,
            kalshi.entertainment_fallback_policy,
        )

        if poly.tie_policy or kalshi.tie_policy:
            if not poly.tie_policy or not kalshi.tie_policy:
                missing_reasons.append("missing_entertainment_tie_policy")
            elif poly.tie_policy != kalshi.tie_policy:
                mismatch_reasons.append("entertainment_tie_policy_mismatch")

        if mismatch_reasons:
            return SettlementDecision(
                "rejected",
                False,
                False,
                tuple(mismatch_reasons + missing_reasons),
                poly,
                kalshi,
            )
        if missing_reasons:
            return SettlementDecision(
                "manual_review",
                False,
                False,
                tuple(missing_reasons),
                poly,
                kalshi,
            )
        return SettlementDecision(
            "strict_verified",
            True,
            True,
            ("entertainment_all_required_settlement_dimensions_match",),
            poly,
            kalshi,
        )

    if group == "awards" and (
        poly.game_scope == "time_person_of_year"
        or kalshi.game_scope == "time_person_of_year"
    ):
        audited_series_reason = audited_kalshi_award_series_rejection(kalshi_market)
        if audited_series_reason:
            return SettlementDecision(
                "rejected",
                False,
                False,
                (audited_series_reason,),
                poly,
                kalshi,
            )

        poly_text = market_rule_text(poly_market)
        kalshi_text = market_rule_text(kalshi_market)
        poly_fallback_policy = award_fallback_policy(poly_text)
        kalshi_fallback_policy = award_fallback_policy(kalshi_text)

        mismatch_reasons = []
        missing_reasons = []

        if not poly.game_scope or not kalshi.game_scope:
            missing_reasons.append("missing_award_scope")
        elif poly.game_scope != kalshi.game_scope:
            mismatch_reasons.append("award_scope_mismatch")

        for label, left, right in (
            ("fallback_deadline", poly.resolution_window, kalshi.resolution_window),
            ("fallback_policy", poly_fallback_policy, kalshi_fallback_policy),
            ("source_policy", poly.source_policy, kalshi.source_policy),
        ):
            if not left or not right:
                missing_reasons.append(f"missing_award_{label}")
            elif left != right:
                mismatch_reasons.append(f"award_{label}_mismatch")

        if mismatch_reasons:
            return SettlementDecision(
                "rejected",
                False,
                False,
                tuple(mismatch_reasons + missing_reasons),
                poly,
                kalshi,
            )
        if missing_reasons:
            return SettlementDecision(
                "manual_review",
                False,
                False,
                tuple(missing_reasons),
                poly,
                kalshi,
            )
        return SettlementDecision(
            "strict_verified",
            True,
            True,
            ("award_scope_fallback_and_source_match",),
            poly,
            kalshi,
        )

    if group == "crypto":
        mismatch_reasons = []
        missing_reasons = []
        dimensions = (
            ("asset", poly.crypto_asset, kalshi.crypto_asset),
            ("observation", poly.crypto_observation, kalshi.crypto_observation),
            ("resolution_window", poly.resolution_window, kalshi.resolution_window),
            ("reference_source", poly.crypto_reference_source, kalshi.crypto_reference_source),
            ("measurement_method", poly.crypto_measurement_method, kalshi.crypto_measurement_method),
            ("boundary_operator", poly.crypto_boundary_operator, kalshi.crypto_boundary_operator),
            ("threshold", poly.crypto_threshold, kalshi.crypto_threshold),
            ("measurement_start", poly.crypto_measurement_start, kalshi.crypto_measurement_start),
            ("missing_data_policy", poly.crypto_missing_data_policy, kalshi.crypto_missing_data_policy),
        )
        for label, left, right in dimensions:
            if not left or not right:
                missing_reasons.append(f"missing_crypto_{label}")
            elif left != right:
                mismatch_reasons.append(f"crypto_{label}_mismatch")

        if poly.tie_policy or kalshi.tie_policy:
            if not poly.tie_policy or not kalshi.tie_policy:
                missing_reasons.append("missing_crypto_tie_policy")
            elif poly.tie_policy != kalshi.tie_policy:
                mismatch_reasons.append("crypto_tie_policy_mismatch")

        if mismatch_reasons:
            return SettlementDecision(
                "rejected",
                False,
                False,
                tuple(mismatch_reasons + missing_reasons),
                poly,
                kalshi,
            )
        if missing_reasons:
            return SettlementDecision(
                "manual_review",
                False,
                False,
                tuple(missing_reasons),
                poly,
                kalshi,
            )
        return SettlementDecision(
            "strict_verified",
            True,
            True,
            ("crypto_all_required_settlement_dimensions_match",),
            poly,
            kalshi,
        )

    if group == "companies":
        mismatch_reasons = []
        missing_reasons = []

        def compare_company_dimension(label: str, left: Optional[str], right: Optional[str], *, required: bool = True) -> None:
            if not left or not right:
                if required:
                    missing_reasons.append(f"missing_company_{label}")
                return
            if left != right:
                mismatch_reasons.append(f"company_{label}_mismatch")

        compare_company_dimension("action", poly.company_action, kalshi.company_action)
        compare_company_dimension("subject", poly.company_subject, kalshi.company_subject)
        compare_company_dimension("trigger_policy", poly.company_trigger_policy, kalshi.company_trigger_policy)
        compare_company_dimension("source_policy", poly.company_source_policy, kalshi.company_source_policy)

        action = poly.company_action or kalshi.company_action
        if action == "acquisition":
            # Directional acquisitions have an acquirer subject and a target.
            compare_company_dimension("target", poly.company_target, kalshi.company_target)
            compare_company_dimension("resolution_window", poly.resolution_window, kalshi.resolution_window)
        elif action == "combination":
            # Symmetric merger/combination identities encode both companies in
            # company_subject (for example "spacex+tesla"). They intentionally
            # have no separate company_target and must not be penalized for that.
            compare_company_dimension("resolution_window", poly.resolution_window, kalshi.resolution_window)
        elif action == "ipo":
            compare_company_dimension("resolution_window", poly.resolution_window, kalshi.resolution_window)
        elif action == "earnings_mention":
            compare_company_dimension("term", poly.company_term, kalshi.company_term)
            compare_company_dimension("event_date", poly.company_event_date, kalshi.company_event_date)
            compare_company_dimension("participant_scope", poly.company_participant_scope, kalshi.company_participant_scope)
            compare_company_dimension("term_match_policy", poly.company_term_match_policy, kalshi.company_term_match_policy)
            compare_company_dimension("fallback_policy", poly.company_fallback_policy, kalshi.company_fallback_policy)
        elif action:
            missing_reasons.append("missing_company_supported_action_semantics")

        if mismatch_reasons:
            return SettlementDecision(
                "rejected",
                False,
                False,
                tuple(mismatch_reasons + missing_reasons),
                poly,
                kalshi,
            )
        if missing_reasons:
            return SettlementDecision(
                "manual_review",
                False,
                False,
                tuple(missing_reasons),
                poly,
                kalshi,
            )
        return SettlementDecision(
            "strict_verified",
            True,
            True,
            ("company_all_required_settlement_dimensions_match",),
            poly,
            kalshi,
        )

    if group == "geopolitics":
        mismatch_reasons = []
        missing_reasons = []

        def compare_geopolitics_dimension(label: str, left: Optional[str], right: Optional[str]) -> None:
            if not left or not right:
                missing_reasons.append(f"missing_geopolitics_{label}")
                return
            if left != right:
                mismatch_reasons.append(f"geopolitics_{label}_mismatch")

        compare_geopolitics_dimension("family", poly.geopolitics_family, kalshi.geopolitics_family)

        family = poly.geopolitics_family or kalshi.geopolitics_family
        if family == "leader_recognition":
            compare_geopolitics_dimension("subject", poly.geopolitics_subject, kalshi.geopolitics_subject)
            compare_geopolitics_dimension("target_state", poly.geopolitics_target_state, kalshi.geopolitics_target_state)
            compare_geopolitics_dimension("authority_scope", poly.geopolitics_authority_scope, kalshi.geopolitics_authority_scope)
            compare_geopolitics_dimension("trigger_policy", poly.geopolitics_trigger_policy, kalshi.geopolitics_trigger_policy)
            compare_geopolitics_dimension("resolution_window", poly.resolution_window, kalshi.resolution_window)
            compare_geopolitics_dimension("source_policy", poly.geopolitics_source_policy, kalshi.geopolitics_source_policy)
        elif family:
            missing_reasons.append("unsupported_geopolitics_settlement_family")

        if mismatch_reasons:
            return SettlementDecision(
                "rejected",
                False,
                False,
                tuple(mismatch_reasons + missing_reasons),
                poly,
                kalshi,
            )
        if missing_reasons:
            return SettlementDecision(
                "manual_review",
                False,
                False,
                tuple(missing_reasons),
                poly,
                kalshi,
            )
        return SettlementDecision(
            "strict_verified",
            True,
            True,
            ("geopolitics_all_required_settlement_dimensions_match",),
            poly,
            kalshi,
        )

    # Audited series-level policy mismatches must be checked before politics-family
    # parsing. Some valid politics comparisons (for example the current White
    # House Press Secretary series) are intentionally not recognized by the
    # narrow structured family parser, but their authoritative series terms have
    # already been audited and are sufficient for a definitive non-equivalence
    # decision.
    if group == "politics":
        audited_series_reason = audited_kalshi_politics_series_rejection(kalshi_market)
        if audited_series_reason:
            return SettlementDecision(
                "rejected",
                False,
                False,
                (audited_series_reason,),
                poly,
                kalshi,
            )

    if group == "politics" and (poly.politics_family or kalshi.politics_family):
        mismatch_reasons = []
        missing_reasons = []

        def compare_politics_dimension(label: str, left: Optional[str], right: Optional[str]) -> None:
            if not left or not right:
                missing_reasons.append(f"missing_politics_{label}")
                return
            if left != right:
                mismatch_reasons.append(f"politics_{label}_mismatch")

        compare_politics_dimension("family", poly.politics_family, kalshi.politics_family)
        family = poly.politics_family or kalshi.politics_family

        if family == "office_succession":
            compare_politics_dimension("subject", poly.politics_subject, kalshi.politics_subject)
            compare_politics_dimension("candidate", poly.politics_candidate, kalshi.politics_candidate)
            compare_politics_dimension("resolution_window", poly.resolution_window, kalshi.resolution_window)
            compare_politics_dimension("trigger_policy", poly.politics_trigger_policy, kalshi.politics_trigger_policy)
            compare_politics_dimension("fallback_policy", poly.politics_fallback_policy, kalshi.politics_fallback_policy)
            compare_politics_dimension("source_policy", poly.politics_source_policy, kalshi.politics_source_policy)
        elif family == "minimum_wage_policy":
            compare_politics_dimension("subject", poly.politics_subject, kalshi.politics_subject)
            compare_politics_dimension("resolution_window", poly.resolution_window, kalshi.resolution_window)
            compare_politics_dimension("trigger_policy", poly.politics_trigger_policy, kalshi.politics_trigger_policy)
            compare_politics_dimension("fallback_policy", poly.politics_fallback_policy, kalshi.politics_fallback_policy)
            compare_politics_dimension("source_policy", poly.politics_source_policy, kalshi.politics_source_policy)
        elif family:
            missing_reasons.append("unsupported_politics_settlement_family")

        if mismatch_reasons:
            return SettlementDecision(
                "rejected",
                False,
                False,
                tuple(mismatch_reasons + missing_reasons),
                poly,
                kalshi,
            )
        if missing_reasons:
            return SettlementDecision(
                "manual_review",
                False,
                False,
                tuple(missing_reasons),
                poly,
                kalshi,
            )
        return SettlementDecision(
            "strict_verified",
            True,
            True,
            ("politics_all_required_settlement_dimensions_match",),
            poly,
            kalshi,
        )

    if group == "misc":
        audited_series_reason = audited_kalshi_misc_series_rejection(kalshi_market)
        if audited_series_reason:
            return SettlementDecision(
                "rejected",
                False,
                False,
                (audited_series_reason,),
                poly,
                kalshi,
            )

    if group == "misc" and (poly.misc_family or kalshi.misc_family):
        mismatch_reasons = []
        missing_reasons = []

        def compare_misc_dimension(
            label: str,
            left: Optional[str],
            right: Optional[str],
            *,
            required: bool = True,
        ) -> None:
            if not left or not right:
                if required:
                    missing_reasons.append(f"missing_misc_{label}")
                return
            if left != right:
                mismatch_reasons.append(f"misc_{label}_mismatch")

        compare_misc_dimension("family", poly.misc_family, kalshi.misc_family)
        family = poly.misc_family or kalshi.misc_family
        compare_misc_dimension("subject", poly.misc_subject, kalshi.misc_subject)
        compare_misc_dimension(
            "resolution_window", poly.resolution_window, kalshi.resolution_window
        )

        if family == "ism_manufacturing_pmi":
            compare_misc_dimension("operator", poly.misc_operator, kalshi.misc_operator)
            compare_misc_dimension("threshold", poly.misc_threshold, kalshi.misc_threshold)
            compare_misc_dimension("precision", poly.misc_precision, kalshi.misc_precision)
            compare_misc_dimension("source_policy", poly.misc_source_policy, kalshi.misc_source_policy)
            fallback_required = bool(poly.misc_fallback_policy or kalshi.misc_fallback_policy)
            compare_misc_dimension(
                "fallback_policy",
                poly.misc_fallback_policy,
                kalshi.misc_fallback_policy,
                required=fallback_required,
            )
        elif family == "pandemic_any_disease":
            compare_misc_dimension(
                "trigger_policy", poly.misc_trigger_policy, kalshi.misc_trigger_policy
            )
            compare_misc_dimension(
                "source_policy", poly.misc_source_policy, kalshi.misc_source_policy
            )
        elif family:
            missing_reasons.append("unsupported_misc_settlement_family")

        if mismatch_reasons:
            return SettlementDecision(
                "rejected",
                False,
                False,
                tuple(mismatch_reasons + missing_reasons),
                poly,
                kalshi,
            )
        if missing_reasons:
            return SettlementDecision(
                "manual_review",
                False,
                False,
                tuple(missing_reasons),
                poly,
                kalshi,
            )
        return SettlementDecision(
            "strict_verified",
            True,
            True,
            ("misc_all_required_settlement_dimensions_match",),
            poly,
            kalshi,
        )

    if group != "sports":
        if not poly.resolution_window or not kalshi.resolution_window:
            return SettlementDecision(
                "manual_review",
                False,
                False,
                ("missing_resolution_window",),
                poly,
                kalshi,
            )
        if poly.resolution_window != kalshi.resolution_window:
            return SettlementDecision(
                "rejected",
                False,
                False,
                ("resolution_window_mismatch",),
                poly,
                kalshi,
            )
        return SettlementDecision(
            "strict_verified",
            True,
            True,
            ("semantic_identity_and_resolution_window_match",),
            poly,
            kalshi,
        )

    if (
            not poly.resolution_window
            or not kalshi.resolution_window
    ):
        reasons.append(
            "missing_rule_defined_event_date"
        )

    elif (
            poly.resolution_window.startswith(
                "ambiguous:"
            )
            or kalshi.resolution_window.startswith(
        "ambiguous:"
    )
    ):
        reasons.append(
            "ambiguous_rule_defined_event_date"
        )

    elif not _sports_resolution_compatible(
            poly.resolution_window,
            kalshi.resolution_window,
    ):
        reasons.append(
            "rule_defined_event_date_mismatch"
        )

    if not poly.game_scope or not kalshi.game_scope:
        reasons.append("missing_game_scope")
    elif not _scope_compatible(poly.game_scope, kalshi.game_scope):
        reasons.append("game_scope_mismatch")

    if poly.tie_policy and kalshi.tie_policy and poly.tie_policy != kalshi.tie_policy:
        reasons.append("tie_policy_mismatch")

    core_failures = {
        "missing_rule_defined_event_date",
        "ambiguous_rule_defined_event_date",
        "rule_defined_event_date_mismatch",
        "missing_game_scope",
        "game_scope_mismatch",
        "tie_policy_mismatch",
    }
    if core_failures.intersection(reasons):
        status = "manual_review" if any(reason.startswith("missing_") or reason.startswith("ambiguous_") for reason in reasons) else "rejected"
        return SettlementDecision(status, False, False, tuple(reasons), poly, kalshi)

    exception_reasons = []
    for label, left, right in (
        ("cancellation_policy", poly.cancellation_policy, kalshi.cancellation_policy),
        ("postponement_policy", poly.postponement_policy, kalshi.postponement_policy),
    ):
        if not left or not right:
            exception_reasons.append(f"missing_{label}")
        elif not _same_or_both_missing(left, right):
            exception_reasons.append(f"{label}_mismatch")

    for reason in audited_sports_exception_reasons(poly_market, kalshi_market):
        if reason not in exception_reasons:
            exception_reasons.append(reason)

    if exception_reasons and require_exception_equivalence:
        return SettlementDecision(
            "core_verified_exception_risk",
            True,
            False,
            tuple(exception_reasons),
            poly,
            kalshi,
        )

    return SettlementDecision(
        "strict_verified" if not exception_reasons else "core_verified_exception_risk",
        True,
        not exception_reasons,
        tuple(exception_reasons) or ("all_required_settlement_dimensions_match",),
        poly,
        kalshi,
    )


def _self_test() -> None:
    assert calendar_resolution_window("by the end of January 2027") == "deadline-2027-01-31"
    assert calendar_resolution_window("by January 31, 2027") == "deadline-2027-01-31"
    assert calendar_resolution_window("before February 1, 2027") == "deadline-2027-01-31"
    assert calendar_resolution_window("by February 28, 2027") == "deadline-2027-02-28"
    assert game_scope("after 90 minutes plus stoppage time does not include extra time or penalties") == "regulation_only"
    assert game_scope("final score including any overtime periods") == "full_event_including_overtime"
    assert tie_policy("If the game ends in a tie, the market will resolve to $0.50 for each team") == "split_50_50"
    assert cancellation_policy("If the game is cancelled, the market resolves to a fair price") == "fair_price"
    assert _sports_resolution_compatible(
        "2026-08-01",
        "2026-08-01",
    )

    assert _sports_resolution_compatible(
        "2026-07-31",
        "2026-08-01",
    )

    assert not _sports_resolution_compatible(
        "2026-07-25",
        "2026-08-01",
    )

    assert not _sports_resolution_compatible(
        "2027-01-31",
        "2027-02-28",
    )
    assert election_fallback_deadline(
        'If the result of this election is not known by June 30, 2027, 11:59 PM ET, the market will resolve to "Other".'
    ) == "deadline-2027-06-30"
    assert entertainment_family(
        "Netflix Top 10 Global Movie on the chart published on Aug 18, 2026"
    ) == "netflix_weekly_ranking"
    assert entertainment_observation_date(
        "The Netflix Top 10 Global Movie chart published on Aug 18, 2026"
    ) == "2026-08-18"
    assert entertainment_observation_date(
        "Netflix is expected to update its global Top 10 movies list on top10.netflix.com on Tuesday, August 18, 2026, 3:00 PM ET"
    ) == "2026-08-18"
    assert entertainment_week_scope(
        "The chart published on Aug 18, 2026 will be for the week ending the previous Sunday."
    ) == "previous_week_ending_sunday"
    assert entertainment_week_scope(
        "reflecting viewership from the previous week (Monday to Sunday)."
    ) == "previous_week_ending_sunday"
    assert entertainment_fallback_deadline(
        'If the top10.netflix.com update does not occur by August 21, 2026, 11:59 PM ET, this market will resolve to "Other".'
    ) == "deadline-2026-08-21"
    assert entertainment_fallback_policy(
        'If the top10.netflix.com update does not occur by August 21, 2026, 11:59 PM ET, this market will resolve to "Other".'
    ) == "other_bucket"
    assert entertainment_tie_policy(
        "If multiple movies tie for #1, the market resolves according to the movie whose listed title comes first alphabetically."
    ) == "alphabetical_title"
    assert election_fallback_policy(
        'If the result of this election is not known by June 30, 2027, the market will resolve to "Other".'
    ) == "other_bucket"
    assert election_scope(
        "If Alice has won the 2027 presidential election, then the market resolves to Yes."
    ) == "candidate_winner"
    assert election_fallback_deadline(
        "A presidential election is scheduled to take place on October 4, 2026."
    ) is None
    assert election_scope(
        "Will Alice finish 2nd in the first round of the election?"
    ) == "candidate_rank_2"
    assert election_scope(
        "Will Alice be the Republican nominee for FL-06? If Alice wins the nomination, the market resolves Yes."
    ) == "party_nominee"
    assert election_scope(
        "This market resolves according to the margin of victory between the top two candidates."
    ) == "margin_of_victory"
    assert election_tie_policy(
        "If candidates are tied on valid votes, ties will be broken by alphabetical order of the candidates' last names.",
        "candidate_rank_2",
    ) == "alphabetical_last_name"
    assert election_tie_policy(
        "In case of exact ties, markets resolve proportionally (1/number of tied entities).",
        "candidate_rank_2",
    ) == "proportional_split"
    assert election_fallback_deadline(
        'If no nominee is announced by November 3, 2026, 11:59 PM ET, this market will resolve to "Other".'
    ) == "deadline-2026-11-03"
    assert election_replacement_policy(
        "Any replacement of the nominee before election day will not change the resolution of the market.",
        "party_nominee",
    ) == "original_nomination_winner_fixed"

    assert award_scope(
        "Will ChatGPT be TIME Person of the Year 2026?"
    ) == "time_person_of_year"
    assert award_fallback_deadline(
        'If TIME Person of the Year is not announced by June 30, 2027, 11:59 PM ET, this market will resolve to "No".'
    ) == "deadline-2027-06-30"
    assert award_fallback_policy(
        'If TIME Person of the Year is not announced by June 30, 2027, this market will resolve to "No".'
    ) == "resolve_no"
    assert award_source_policy(
        "The resolution source for this market will be the TIME magazine cover or covers announcing the TIME Person of the Year; however, the TIME Person of the Year Feature article may also be used."
    ) == "time_official_cover_or_feature"
    assert award_fallback_deadline(
        "If AI is Time Person of the Year for 2026, then the market resolves to Yes."
    ) is None
    assert award_source_policy(
        "If AI is Time Person of the Year for 2026, then the market resolves to Yes."
    ) is None

    assert politics_family(
        "Will Mart Helme be the next President of Estonia before Jan 1, 2027?"
    ) == "office_succession"
    assert politics_office_subject(
        "Will Mart Helme be the next President of Estonia before Jan 1, 2027?"
    ) == "president_of_estonia"
    assert politics_candidate(
        "Will Mart Helme be the next President of Estonia before Jan 1, 2027?"
    ) == "mart_helme"
    assert politics_rule_deadline(
        "before Jan 1, 2027"
    ) == "deadline-2026-12-31"
    assert politics_rule_deadline(
        "before December 31, 2026, 11:59 PM ET"
    ) == "deadline-2026-12-31"
    assert politics_rule_deadline(
        "by December 31, 2027, 11:59 PM ET"
    ) == "deadline-2027-12-31"
    assert politics_trigger_policy(
        "The individual must be formally appointed by the President of Romania and receive a vote of confidence from Parliament. Any interim or caretaker Prime Minister will not count.",
        "office_succession",
    ) == "appointed_and_confidence_noncaretaker"
    assert politics_trigger_policy(
        "The individual must be officially sworn in as President of Estonia. Any interim or caretaker President will not count.",
        "office_succession",
    ) == "sworn_in_nonacting"
    assert politics_trigger_policy(
        "only a subject who formally holds the position in a permanent, confirmed, elected, or otherwise non-acting and non-temporary capacity; acting, interim, transitional, provisional, caretaker roles do not count",
        "office_succession",
    ) == "formally_holds_nonacting"
    assert politics_trigger_policy(
        "If the first new person to hold Prime Minister of Romania after Issuance is Alice, then the market resolves to Yes.",
        "office_succession",
    ) == "first_new_holder_after_issuance"
    assert politics_trigger_policy(
        "This market will resolve Yes if both the following occur: Mamdani wins the 2025 NYC Mayoral election and a policy is enacted in New York City.",
        "minimum_wage_policy",
    ) == "mamdani_win_and_policy_enacted"
    assert politics_trigger_policy(
        "If a bill establishing a minimum wage of at least $30 per hour for New York City set to go in effect 2030 or earlier has become law in New York City before Jan 1, 2027, then the market resolves to Yes.",
        "minimum_wage_policy",
    ) == "bill_becomes_binding_law"

    assert company_trigger_policy(
        "This market resolves Yes if the shares are listed on a public securities exchange and open for trading by the listed date.",
        "ipo",
    ) == "shares_listed_and_open_for_trading"
    assert company_trigger_policy(
        "An IPO is confirmed if the SEC declares Form S-1 effective OR the IPO is priced OR a securities exchange has assigned a ticker.",
        "ipo",
    ) == "s1_effective_or_priced_or_ticker_assigned"
    assert company_trigger_policy(
        "The announcement must involve a definitive, binding agreement accompanied by public announcement.",
        "acquisition",
    ) == "definitive_binding_control_transfer_agreement_announced"
    assert company_participant_scope(
        "If Amazon is said by any company representative including the operator of the call during the earnings call, the market resolves Yes.",
        "earnings_mention",
    ) == "company_representative_or_operator"
    assert company_source_policy(
        "The resolution source will be audio of the event.",
        "earnings_mention",
    ) == "event_audio"

    assert geopolitics_family(
        "Will the United States recognize Reza Pahlavi as the leader of Iran in 2026?"
    ) == "leader_recognition"
    assert geopolitics_recognition_subject(
        "Will the United States recognize Reza Pahlavi as the leader of Iran in 2026?"
    ) == "reza_pahlavi"
    assert geopolitics_target_state(
        "Will the United States recognize Reza Pahlavi as the leader of Iran in 2026?"
    ) == "iran"
    assert geopolitics_authority_scope(
        "The Trump administration announces that the United States officially recognizes Reza Pahlavi as leader of Iran."
    ) == "trump_administration"
    assert geopolitics_authority_scope(
        "The government of the United States takes official action acknowledging Reza Pahlavi as leader of Iran."
    ) == "us_government"
    assert geopolitics_recognition_trigger_policy(
        "A qualifying statement must be direct and unqualified and officially recognizes Reza Pahlavi as leader of Iran."
    ) == "direct_unqualified_official_recognition"
    assert geopolitics_recognition_trigger_policy(
        "The government takes official action acknowledging Reza Pahlavi specifically as the rightful or legitimate leader of Iran. Recognition must be explicit."
    ) == "explicit_official_legitimacy_recognition"

    assert crypto_reference_source(
        "The resolution source is Binance BTC/USDT with 1 minute candles."
    ) == "binance:btc_usdt"
    assert crypto_reference_source(
        "The market resolves based on the CF Bitcoin Real-Time Index (BRTI)."
    ) == "cf_benchmarks:brti"
    assert crypto_measurement_method(
        "any Binance 1 minute candle has a final High price"
    ) == "one_minute_candle_high"
    assert crypto_measurement_method(
        "using a trimmed mean calculation"
    ) == "trimmed_mean_path"
    assert crypto_boundary_operator(
        "a final High price equal to or greater than the price specified"
    ) == "gte"
    assert crypto_boundary_operator(
        "the spot price is above $199999.99"
    ) == "gt"
    assert crypto_measurement_start(
        "between November 24, 2025, 14:00 and December 31, 2026"
    ) == "2025-11-24"
    assert crypto_measurement_start(
        "starting 10/01/2025 10:00 AM"
    ) == "2025-10-01"
    assert crypto_resolution_window(
        "between November 24, 2025 and December 31, 2026, 23:59 in ET"
    ) == "deadline-2026-12-31"
    assert crypto_resolution_window(
        "before Jan 1, 2027 at 12:00am ET"
    ) == "deadline-2026-12-31"

    assert misc_operator_threshold(
        "If the headline PMI value is at least 59, then the market resolves to Yes.",
        "ism_manufacturing_pmi",
    ) == ("gte", "59")
    assert misc_precision_policy(
        "The PMI is reported to one decimal point.",
        "ism_manufacturing_pmi",
    ) == "one_decimal"
    assert misc_fallback_policy(
        "If ISM does not release the figures, the market may remain open until the next ISM Manufacturing PMI report. If the information is not released by that time, use the most recent previous month.",
        "ism_manufacturing_pmi",
    ) == "next_report_then_previous_month"
    assert misc_trigger_policy(
        "The World Health Organization declares any disease a pandemic.",
        "pandemic_any_disease",
    ) == "who_declares_pandemic"
    assert misc_trigger_policy(
        "If any disease becomes a pandemic in 2026, then the market resolves to Yes.",
        "pandemic_any_disease",
    ) is None

    class _SeriesTestMarket:
        external_series_id = "KXNETFLIXRANKSHOWGLOBAL2"
        event = None

    assert audited_kalshi_entertainment_series_rejection(
        _SeriesTestMarket()
    ) == "entertainment_series_netflixrank_terminal_policy_mismatch"

    class _PoliticsSeriesTestMarket:
        external_series_id = "KXNEXTPRESSEC"
        event = None

    assert audited_kalshi_politics_series_rejection(
        _PoliticsSeriesTestMarket()
    ) == "politics_series_nextpressec_trigger_interim_policy_mismatch"

    class _MiscRejectSeriesTestMarket:
        external_series_id = "KXISMPMI"
        event = None

    assert audited_kalshi_misc_series_rejection(
        _MiscRejectSeriesTestMarket()
    ) == "misc_series_ismpmi_fallback_policy_mismatch"

    class _MiscPandemicSeriesTestMarket:
        external_series_id = "KXNEWOUTBREAK-P"
        event = None

    assert not _is_soccer(
        "Caribbean Premier League cricket match with over-rate penalties and a Super Over"
    )
    assert _is_soccer(
        "Soccer match settled after 90 minutes plus stoppage time and penalties"
    )
    sports_dummy_event = type(
        "SportsDummyEvent",
        (),
        {"external_series_id": "KXCPLMATCH"},
    )()
    sports_dummy_market = type(
        "SportsDummyMarket",
        (),
        {"external_series_id": "KXCPLMATCH", "event": sports_dummy_event},
    )()
    assert audited_kalshi_sports_semantic_overrides(sports_dummy_market)[
        "postponement_policy"
    ] == "wait_up_to_48_hours_then_split_50_50"

    assert audited_kalshi_misc_semantic_overrides(
        _MiscPandemicSeriesTestMarket(),
        "pandemic_any_disease",
    ) == ("who_declares_pandemic", "who_official_announcements")

    print(f"{SETTLEMENT_VERSION}: self-test passed")


if __name__ == "__main__":
    _self_test()