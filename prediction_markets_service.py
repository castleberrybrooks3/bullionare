from __future__ import annotations

import argparse
import json
import os
import shutil
import sys
import tempfile
import time
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Any, Dict, Iterable, Iterator, List, Optional, Sequence, Set, Tuple

import psycopg2.extras
import requests

from db import get_db_connection_dict


SERVICE_VERSION = "manual-current-snapshot-v4.1-atomic-db-retry"

POLYMARKET_GAMMA_URL = "https://gamma-api.polymarket.com"
KALSHI_API_URL = "https://external-api.kalshi.com/trade-api/v2"

REQUEST_TIMEOUT_SECONDS = int(
    os.getenv("PREDICTION_REQUEST_TIMEOUT_SECONDS", "45")
)
REQUEST_RETRY_ATTEMPTS = int(
    os.getenv("PREDICTION_REQUEST_RETRY_ATTEMPTS", "6")
)
DATABASE_BATCH_SIZE = int(
    os.getenv("PREDICTION_DATABASE_BATCH_SIZE", "500")
)
DATABASE_REPLACEMENT_ATTEMPTS = int(
    os.getenv("PREDICTION_DATABASE_REPLACEMENT_ATTEMPTS", "3")
)
POLYMARKET_MARKET_PAGE_SIZE = 100
POLYMARKET_EVENT_PAGE_SIZE = 500
POLYMARKET_TEAM_PAGE_SIZE = 500
KALSHI_EVENT_PAGE_SIZE = 200
KALSHI_TARGET_BATCH_SIZE = 200
CATALOG_REFRESH_LOCK_ID = 51720260722

# The service refuses to replace a healthy snapshot with an obviously empty or
# incomplete download. These defaults are deliberately low enough for testing
# but can be raised in production through environment variables.
MIN_POLYMARKET_MARKETS = int(
    os.getenv("PREDICTION_MIN_POLYMARKET_MARKETS", "1")
)
MIN_KALSHI_MARKETS = int(
    os.getenv("PREDICTION_MIN_KALSHI_MARKETS", "1")
)
MIN_POLYMARKET_TEAM_ENTITIES = int(
    os.getenv("PREDICTION_MIN_POLYMARKET_TEAM_ENTITIES", "100")
)
MIN_POLYMARKET_PARTICIPANT_LINKS = int(
    os.getenv("PREDICTION_MIN_POLYMARKET_PARTICIPANT_LINKS", "200")
)
MIN_POLYMARKET_TWO_PARTICIPANT_SPORTS_EVENTS = int(
    os.getenv(
        "PREDICTION_MIN_POLYMARKET_TWO_PARTICIPANT_SPORTS_EVENTS",
        "100",
    )
)

# Kalshi multivariate/combo events are dynamically generated and can number
# in the hundreds of thousands. They are not required for the Bullionaire
# exact single-event arbitrage engine and are excluded by default to keep the
# current snapshot compact and safe for Supabase.
#
# Explicitly opt in only for a dedicated experiment:
#   PREDICTION_INCLUDE_KALSHI_MULTIVARIATE=true
INCLUDE_KALSHI_MULTIVARIATE = (
    os.getenv(
        "PREDICTION_INCLUDE_KALSHI_MULTIVARIATE",
        "false",
    )
    .strip()
    .lower()
    in {"1", "true", "yes", "on"}
)

POLYMARKET_CURRENT_MARKET_STATUSES = {
    "active",
    "open",
    "unopened",
    "paused",
    "unknown",
}

# Kalshi's REST market lifecycle currently returns these native values for
# markets that have not closed. Filter aliases are accepted defensively too.
KALSHI_CURRENT_MARKET_STATUSES = {
    "initialized",
    "active",
    "inactive",
    "unopened",
    "open",
    "paused",
}

session = requests.Session()
session.headers.update(
    {
        "User-Agent": (
            "BullionaireIQ Manual Current Prediction Market Snapshot"
        ),
        "Accept": "application/json",
    }
)


# ---------------------------------------------------------------------------
# Generic helpers
# ---------------------------------------------------------------------------


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def utc_now_iso() -> str:
    return utc_now().isoformat()


def as_float(value: Any) -> Optional[float]:
    try:
        if value in (None, ""):
            return None
        number = float(value)
    except (TypeError, ValueError):
        return None

    if number != number or number in (float("inf"), float("-inf")):
        return None
    return number


def numeric_24_8(value: Any) -> Optional[str]:
    """Return a value safe for NUMERIC(24, 8), or None if unusable."""
    if value in (None, ""):
        return None

    try:
        number = Decimal(str(value).replace(",", "").strip())
    except (InvalidOperation, ValueError):
        return None

    if not number.is_finite():
        return None

    # NUMERIC(24, 8) allows sixteen digits to the left of the decimal point.
    if abs(number) >= Decimal("10000000000000000"):
        return None

    return format(number, "f")


def normalise_price(value: Any) -> Optional[float]:
    number = as_float(value)
    if number is None:
        return None
    return number / 100 if number > 1 else number


def parse_json_array(value: Any) -> List[Any]:
    if isinstance(value, list):
        return value
    if isinstance(value, tuple):
        return list(value)
    if isinstance(value, str):
        try:
            parsed = json.loads(value)
        except json.JSONDecodeError:
            return []
        return parsed if isinstance(parsed, list) else []
    return []


def json_object(value: Any) -> Dict[str, Any]:
    if isinstance(value, dict):
        return value
    if isinstance(value, str):
        try:
            parsed = json.loads(value)
        except json.JSONDecodeError:
            return {}
        return parsed if isinstance(parsed, dict) else {}
    return {}


def first_non_empty(*values: Any) -> Optional[Any]:
    for value in values:
        if value not in (None, "", [], {}):
            return value
    return None


def native_text(value: Any) -> Optional[str]:
    if value in (None, ""):
        return None
    return str(value)


def chunks(
    values: Sequence[Any],
    size: int,
) -> Iterable[Sequence[Any]]:
    for index in range(0, len(values), size):
        yield values[index:index + size]


def compact_error(exc: BaseException) -> str:
    return f"{type(exc).__name__}: {exc}"


def get_json_with_retry(
    url: str,
    *,
    params: Any = None,
    label: str,
) -> Any:
    last_error: Optional[BaseException] = None

    for attempt in range(1, REQUEST_RETRY_ATTEMPTS + 1):
        try:
            response = session.get(
                url,
                params=params,
                timeout=REQUEST_TIMEOUT_SECONDS,
            )

            if response.status_code == 429 or response.status_code >= 500:
                retry_after = as_float(response.headers.get("Retry-After"))
                wait_seconds = (
                    retry_after
                    if retry_after is not None
                    else min(30, attempt * 3)
                )
                print(
                    f"{label} temporarily unavailable "
                    f"({response.status_code}). Retrying in "
                    f"{wait_seconds:.0f} seconds..."
                )
                time.sleep(wait_seconds)
                continue

            response.raise_for_status()
            return response.json()

        except (requests.RequestException, ValueError) as exc:
            last_error = exc
            if attempt == REQUEST_RETRY_ATTEMPTS:
                break

            wait_seconds = min(30, attempt * 3)
            print(
                f"{label} request attempt {attempt}/"
                f"{REQUEST_RETRY_ATTEMPTS} failed: {exc}. "
                f"Retrying in {wait_seconds} seconds..."
            )
            time.sleep(wait_seconds)

    raise RuntimeError(
        f"{label} failed after {REQUEST_RETRY_ATTEMPTS} attempts: "
        f"{last_error}"
    )


def write_json_line(handle, payload: Dict[str, Any]) -> None:
    handle.write(
        json.dumps(
            payload,
            ensure_ascii=False,
            separators=(",", ":"),
            default=str,
        )
    )
    handle.write("\n")


def read_jsonl_batches(
    path: Path,
    batch_size: int,
) -> Iterator[List[Dict[str, Any]]]:
    batch: List[Dict[str, Any]] = []

    with path.open("r", encoding="utf-8") as handle:
        for line_number, line in enumerate(handle, start=1):
            stripped = line.strip()
            if not stripped:
                continue

            try:
                parsed = json.loads(stripped)
            except json.JSONDecodeError as exc:
                raise RuntimeError(
                    f"Invalid JSON in {path.name} at line {line_number}: {exc}"
                ) from exc

            if not isinstance(parsed, dict):
                raise RuntimeError(
                    f"Expected an object in {path.name} at line {line_number}."
                )

            batch.append(parsed)

            if len(batch) >= batch_size:
                yield batch
                batch = []

    if batch:
        yield batch


def merge_missing_values(
    existing: Dict[str, Any],
    incoming: Dict[str, Any],
) -> Dict[str, Any]:
    """Fill missing event/entity fields without discarding richer data."""
    merged = dict(existing)

    for key, value in incoming.items():
        if key in {"raw_payload", "details", "source_ids"}:
            existing_obj = json_object(merged.get(key))
            incoming_obj = json_object(value)
            merged[key] = {**existing_obj, **incoming_obj}
            continue

        if merged.get(key) in (None, "", [], {}) and value not in (
            None,
            "",
            [],
            {},
        ):
            merged[key] = value

    return merged


# ---------------------------------------------------------------------------
# Local snapshot files
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class SnapshotPaths:
    root: Path
    events: Path
    entities: Path
    links: Path
    markets: Path
    manifest: Path


@dataclass
class SnapshotSummary:
    polymarket_events: int = 0
    polymarket_entities: int = 0
    polymarket_links: int = 0
    polymarket_markets: int = 0
    polymarket_sports_events: int = 0
    polymarket_two_participant_sports_events: int = 0

    kalshi_events: int = 0
    kalshi_entities: int = 0
    kalshi_links: int = 0
    kalshi_markets: int = 0

    @property
    def total_events(self) -> int:
        return self.polymarket_events + self.kalshi_events

    @property
    def total_entities(self) -> int:
        return self.polymarket_entities + self.kalshi_entities

    @property
    def total_links(self) -> int:
        return self.polymarket_links + self.kalshi_links

    @property
    def total_markets(self) -> int:
        return self.polymarket_markets + self.kalshi_markets

    def as_dict(self) -> Dict[str, int]:
        return {
            "polymarket_events": self.polymarket_events,
            "polymarket_entities": self.polymarket_entities,
            "polymarket_links": self.polymarket_links,
            "polymarket_markets": self.polymarket_markets,
            "polymarket_sports_events": self.polymarket_sports_events,
            "polymarket_two_participant_sports_events": (
                self.polymarket_two_participant_sports_events
            ),
            "kalshi_events": self.kalshi_events,
            "kalshi_entities": self.kalshi_entities,
            "kalshi_links": self.kalshi_links,
            "kalshi_markets": self.kalshi_markets,
            "total_events": self.total_events,
            "total_entities": self.total_entities,
            "total_links": self.total_links,
            "total_markets": self.total_markets,
        }


def create_snapshot_paths(root: Path) -> SnapshotPaths:
    root.mkdir(parents=True, exist_ok=True)
    return SnapshotPaths(
        root=root,
        events=root / "events.jsonl",
        entities=root / "entities.jsonl",
        links=root / "event_entities.jsonl",
        markets=root / "markets.jsonl",
        manifest=root / "manifest.json",
    )


# ---------------------------------------------------------------------------
# Polymarket current snapshot download
# ---------------------------------------------------------------------------


def polymarket_market_pages() -> Iterator[Tuple[int, List[Dict[str, Any]]]]:
    cursor: Optional[str] = None
    seen_cursors: Set[str] = set()
    page_number = 0

    while True:
        params: Dict[str, Any] = {
            "closed": "false",
            "limit": POLYMARKET_MARKET_PAGE_SIZE,
            "include_tag": "true",
        }
        if cursor:
            params["after_cursor"] = cursor

        payload = get_json_with_retry(
            f"{POLYMARKET_GAMMA_URL}/markets/keyset",
            params=params,
            label="Polymarket current markets",
        )

        markets = payload.get("markets", []) if isinstance(payload, dict) else []
        if not isinstance(markets, list) or not markets:
            break

        page_number += 1
        yield page_number, [
            row for row in markets if isinstance(row, dict)
        ]

        next_cursor = payload.get("next_cursor")
        if not next_cursor:
            break

        next_cursor = str(next_cursor)
        if next_cursor == cursor or next_cursor in seen_cursors:
            raise RuntimeError(
                "Polymarket returned a repeated market cursor."
            )

        seen_cursors.add(next_cursor)
        cursor = next_cursor
        time.sleep(0.05)


def polymarket_event_pages() -> Iterator[Tuple[int, List[Dict[str, Any]]]]:
    """Yield every current Polymarket event with enriched teams and markets."""
    cursor: Optional[str] = None
    seen_cursors: Set[str] = set()
    page_number = 0

    while True:
        params: Dict[str, Any] = {
            "closed": "false",
            "limit": POLYMARKET_EVENT_PAGE_SIZE,
        }
        if cursor:
            params["after_cursor"] = cursor

        payload = get_json_with_retry(
            f"{POLYMARKET_GAMMA_URL}/events/keyset",
            params=params,
            label="Polymarket current events",
        )

        events = payload.get("events", []) if isinstance(payload, dict) else []
        if not isinstance(events, list) or not events:
            break

        page_number += 1
        yield page_number, [
            row for row in events if isinstance(row, dict)
        ]

        next_cursor = payload.get("next_cursor")
        if not next_cursor:
            break

        next_cursor = str(next_cursor)
        if next_cursor == cursor or next_cursor in seen_cursors:
            raise RuntimeError(
                "Polymarket returned a repeated event cursor."
            )

        seen_cursors.add(next_cursor)
        cursor = next_cursor
        time.sleep(0.05)


def polymarket_current_market(raw: Dict[str, Any]) -> bool:
    if raw.get("id") in (None, ""):
        return False
    if raw.get("closed") is True or raw.get("archived") is True:
        return False

    # The closed=false endpoint is the source of truth. These checks only
    # exclude explicit non-current rows if the API returns one defensively.
    native_status = str(raw.get("status") or "unknown").strip().lower()
    if native_status not in POLYMARKET_CURRENT_MARKET_STATUSES:
        if raw.get("active") is False and raw.get("acceptingOrders") is not True:
            return False

    return True


def polymarket_event_for_market(raw: Dict[str, Any]) -> Dict[str, Any]:
    events = raw.get("events")
    if isinstance(events, list):
        for event in events:
            if isinstance(event, dict) and event.get("id") not in (None, ""):
                return event

    event = raw.get("event")
    if isinstance(event, dict) and event.get("id") not in (None, ""):
        return event

    market_id = str(raw["id"])
    return {
        "id": f"market:{market_id}",
        "title": raw.get("question") or raw.get("title") or market_id,
        "subtitle": None,
        "category": raw.get("category"),
        "startDate": raw.get("startDate"),
        "endDate": raw.get("endDate"),
        "active": raw.get("active"),
        "closed": raw.get("closed"),
        "archived": raw.get("archived"),
        "synthetic": True,
    }


def polymarket_series_id(
    event: Dict[str, Any],
    market: Optional[Dict[str, Any]] = None,
) -> Optional[str]:
    series_rows = event.get("series")
    if isinstance(series_rows, list) and series_rows:
        first = series_rows[0]
        if isinstance(first, dict):
            value = first_non_empty(
                first.get("id"),
                first.get("ticker"),
                first.get("slug"),
            )
            if value not in (None, ""):
                return str(value)

    value = first_non_empty(
        event.get("seriesSlug"),
        event.get("series_slug"),
        (market or {}).get("seriesSlug"),
        (market or {}).get("series_slug"),
    )
    return str(value) if value not in (None, "") else None


def polymarket_event_category(
    event: Dict[str, Any],
    market: Dict[str, Any],
) -> Optional[str]:
    tags = market.get("tags")
    first_tag: Optional[str] = None

    if isinstance(tags, list):
        for tag in tags:
            if isinstance(tag, dict):
                first_tag = native_text(
                    first_non_empty(tag.get("label"), tag.get("slug"))
                )
            elif tag not in (None, ""):
                first_tag = str(tag)
            if first_tag:
                break

    return native_text(
        first_non_empty(
            market.get("category"),
            event.get("category"),
            first_tag,
        )
    )


def polymarket_is_sports_market(
    market: Dict[str, Any],
    event: Dict[str, Any],
) -> bool:
    return first_non_empty(
        market.get("gameId"),
        market.get("teamAID"),
        market.get("teamBID"),
        market.get("homeTeamID"),
        market.get("awayTeamID"),
        market.get("sportsMarketType"),
        event.get("gameId"),
        event.get("teams"),
    ) is not None


def normalise_polymarket_event(
    event: Dict[str, Any],
    market: Dict[str, Any],
) -> Dict[str, Any]:
    event_id = str(event["id"])
    category = polymarket_event_category(event, market)
    sports = polymarket_is_sports_market(market, event)

    native_game_id = first_non_empty(
        event.get("gameId"),
        market.get("gameId"),
    )
    native_game_id = native_text(native_game_id)

    event_raw = dict(event)
    event_raw.pop("markets", None)

    return {
        "venue": "polymarket",
        "external_event_id": event_id,
        "external_series_id": polymarket_series_id(event, market),
        "title": str(
            first_non_empty(
                event.get("title"),
                event.get("question"),
                market.get("question"),
                event_id,
            )
        ),
        "subtitle": native_text(event.get("subtitle")),
        "category": category,
        "event_type": "sports" if sports else category,
        "status": "active",
        "venue_status": str(
            first_non_empty(
                event.get("status"),
                "active" if event.get("active") is True else "unknown",
            )
        ),
        "start_time": first_non_empty(
            event.get("startTime"),
            event.get("eventDate"),
            market.get("eventStartTime"),
            market.get("gameStartTime"),
            event.get("startDate"),
            market.get("startDateIso"),
            market.get("startDate"),
        ),
        "end_time": first_non_empty(
            event.get("endDate"),
            market.get("endDateIso"),
            market.get("endDate"),
        ),
        "close_time": first_non_empty(
            market.get("closedTime"),
            market.get("endDateIso"),
            market.get("endDate"),
        ),
        "settlement_time": None,
        "native_game_id": native_game_id,
        "milestone_id": None,
        "source_id": native_game_id,
        "source_ids": (
            {"polymarket_game_id": native_game_id}
            if native_game_id
            else {}
        ),
        "details": {
            "event_slug": event.get("slug"),
            "series_slug": event.get("seriesSlug"),
            "tags": event.get("tags") or market.get("tags") or [],
            "synthetic": bool(event.get("synthetic")),
        },
        "raw_payload": event_raw,
    }


def normalise_polymarket_outcomes(raw: Dict[str, Any]) -> List[Dict[str, Any]]:
    labels = parse_json_array(raw.get("outcomes"))
    prices = parse_json_array(raw.get("outcomePrices"))
    token_ids = parse_json_array(raw.get("clobTokenIds"))

    outcomes: List[Dict[str, Any]] = []
    maximum = max(len(labels), len(token_ids), len(prices))

    for index in range(maximum):
        label = labels[index] if index < len(labels) else None
        token_id = token_ids[index] if index < len(token_ids) else None
        price = prices[index] if index < len(prices) else None

        if label in (None, "") and token_id in (None, ""):
            continue

        display_label = str(
            first_non_empty(label, f"Outcome {index + 1}")
        )
        key = str(
            first_non_empty(
                token_id,
                f"outcome:{index}:{display_label.strip().lower()}",
            )
        )

        outcomes.append(
            {
                "key": key,
                "label": display_label,
                "index": index,
                "token_id": str(token_id) if token_id not in (None, "") else None,
                "last_price": normalise_price(price),
            }
        )

    return outcomes


def normalise_polymarket_market(
    raw: Dict[str, Any],
    event: Dict[str, Any],
) -> Dict[str, Any]:
    market_id = str(raw["id"])
    event_id = str(event["id"])
    category = polymarket_event_category(event, raw)
    custom_strike = json_object(raw.get("customStrike"))

    return {
        "venue": "polymarket",
        "external_market_id": market_id,
        "external_event_id": event_id,
        "external_series_id": polymarket_series_id(event, raw),
        "event_title": first_non_empty(
            event.get("title"),
            event.get("question"),
        ),
        "market_title": str(
            first_non_empty(
                raw.get("question"),
                raw.get("title"),
                market_id,
            )
        ),
        "market_slug": native_text(raw.get("slug")),
        "category": category,
        "market_type": native_text(
            first_non_empty(
                raw.get("marketType"),
                raw.get("formatType"),
                "binary" if len(parse_json_array(raw.get("outcomes"))) == 2 else None,
            )
        ),
        "sports_market_type": native_text(raw.get("sportsMarketType")),
        "status": "active",
        "venue_status": str(
            first_non_empty(
                raw.get("status"),
                "active" if raw.get("active") is True else "unknown",
            )
        ),
        "resolution_time": first_non_empty(
            raw.get("endDateIso"),
            raw.get("endDate"),
            raw.get("umaEndDateIso"),
        ),
        "event_start_time": first_non_empty(
            raw.get("eventStartTime"),
            raw.get("gameStartTime"),
            event.get("startTime"),
            event.get("eventDate"),
            event.get("startDate"),
            raw.get("startDateIso"),
            raw.get("startDate"),
        ),
        "close_time": first_non_empty(
            raw.get("closedTime"),
            raw.get("endDateIso"),
            raw.get("endDate"),
        ),
        "settlement_time": None,
        "accepting_orders": raw.get("acceptingOrders"),
        "rules_url": native_text(
            first_non_empty(
                raw.get("resolutionSource"),
                event.get("resolutionSource"),
            )
        ),
        "rules_primary": native_text(raw.get("description")),
        "rules_secondary": None,
        "native_condition_id": native_text(raw.get("conditionId")),
        "native_game_id": native_text(
            first_non_empty(raw.get("gameId"), event.get("gameId"))
        ),
        "primary_participant_key": native_text(
            first_non_empty(
                raw.get("primaryParticipantKey"),
                raw.get("groupItemTitle"),
            )
        ),
        "line_value": native_text(
            first_non_empty(
                raw.get("line"),
                raw.get("groupItemThreshold"),
            )
        ),
        "floor_strike": native_text(raw.get("lowerBound")),
        "cap_strike": native_text(raw.get("upperBound")),
        "functional_strike": native_text(raw.get("groupItemRange")),
        "custom_strike": custom_strike,
        "contract_semantics": {
            "sportsMarketType": raw.get("sportsMarketType"),
            "teamAID": raw.get("teamAID"),
            "teamBID": raw.get("teamBID"),
            "homeTeamID": raw.get("homeTeamID"),
            "awayTeamID": raw.get("awayTeamID"),
            "groupItemTitle": raw.get("groupItemTitle"),
            "groupItemThreshold": raw.get("groupItemThreshold"),
            "groupItemRange": raw.get("groupItemRange"),
            "formatType": raw.get("formatType"),
            "marketType": raw.get("marketType"),
            "lowerBound": raw.get("lowerBound"),
            "upperBound": raw.get("upperBound"),
            "negRisk": raw.get("negRisk"),
            "rfqEnabled": raw.get("rfqEnabled"),
            "feeSchedule": raw.get("fee_schedule"),
        },
        "outcomes": normalise_polymarket_outcomes(raw),
        "raw_payload": raw,
        "liquidity": numeric_24_8(
            first_non_empty(raw.get("liquidityNum"), raw.get("liquidity"))
        ),
        "volume_24h": numeric_24_8(raw.get("volume24hr")),
        "total_volume": numeric_24_8(
            first_non_empty(raw.get("volumeNum"), raw.get("volume"))
        ),
        "open_interest": numeric_24_8(
            first_non_empty(raw.get("openInterest"), event.get("openInterest"))
        ),
    }


def polymarket_embedded_teams(
    event: Dict[str, Any],
) -> List[Dict[str, Any]]:
    rows = event.get("teams")
    if not isinstance(rows, list):
        return []
    return [row for row in rows if isinstance(row, dict)]


def normalise_polymarket_team(raw: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    entity_id = first_non_empty(
        raw.get("id"),
        raw.get("teamId"),
        raw.get("team_id"),
    )
    if entity_id in (None, ""):
        return None

    source_ids = json_object(raw.get("source_ids"))
    source_id = first_non_empty(
        raw.get("source_id"),
        raw.get("providerId"),
    )

    return {
        "venue": "polymarket",
        "external_entity_id": str(entity_id),
        "name": str(
            first_non_empty(
                raw.get("name"),
                raw.get("alias"),
                raw.get("abbreviation"),
                entity_id,
            )
        ),
        "entity_type": "sports_team",
        "league": native_text(raw.get("league")),
        "abbreviation": native_text(raw.get("abbreviation")),
        "alias": native_text(raw.get("alias")),
        "source_id": str(source_id) if source_id not in (None, "") else None,
        "source_ids": source_ids,
        "details": {
            "record": raw.get("record"),
            "logo": raw.get("logo"),
        },
        "raw_payload": raw,
    }


def polymarket_team_references(
    event: Dict[str, Any],
    market: Dict[str, Any],
) -> List[Tuple[str, str]]:
    references: List[Tuple[str, str]] = []
    seen: Set[Tuple[str, str]] = set()

    embedded = polymarket_embedded_teams(event)
    for team in embedded:
        entity_id = first_non_empty(
            team.get("id"),
            team.get("teamId"),
            team.get("team_id"),
        )
        if entity_id in (None, ""):
            continue

        ordering = str(team.get("ordering") or "").strip().lower()
        role = ordering if ordering in {"home", "away"} else "participant"
        key = (str(entity_id), role)
        if key not in seen:
            seen.add(key)
            references.append(key)

    if references:
        return references

    field_roles = (
        ("home", first_non_empty(market.get("homeTeamID"), market.get("home_team_id"))),
        ("away", first_non_empty(market.get("awayTeamID"), market.get("away_team_id"))),
        ("participant", market.get("teamAID")),
        ("participant", market.get("teamBID")),
    )

    for role, entity_id in field_roles:
        if entity_id in (None, ""):
            continue
        key = (str(entity_id), role)
        if key not in seen:
            seen.add(key)
            references.append(key)

    return references


def polymarket_event_nested_markets(
    event: Dict[str, Any],
) -> List[Dict[str, Any]]:
    rows = event.get("markets")
    if not isinstance(rows, list):
        return []
    return [row for row in rows if isinstance(row, dict)]


def polymarket_sports_coverage(
    events: Dict[Tuple[str, str], Dict[str, Any]],
    links: Set[Tuple[str, str, str, str]],
) -> Tuple[int, int]:
    sports_event_ids = {
        event_id
        for (venue, event_id), event in events.items()
        if venue == "polymarket"
        and str(event.get("event_type") or "").strip().lower() == "sports"
    }

    linked_entities_by_event: Dict[str, Set[str]] = {}
    for venue, event_id, entity_id, role in links:
        if venue != "polymarket" or event_id not in sports_event_ids:
            continue
        if role not in {"home", "away", "participant", "subject", "unknown"}:
            continue
        linked_entities_by_event.setdefault(event_id, set()).add(entity_id)

    exactly_two = sum(
        len(linked_entities_by_event.get(event_id, set())) == 2
        for event_id in sports_event_ids
    )
    return len(sports_event_ids), exactly_two


def enrich_polymarket_sports_participants(
    *,
    events: Dict[Tuple[str, str], Dict[str, Any]],
    entities: Dict[Tuple[str, str], Dict[str, Any]],
    links: Set[Tuple[str, str, str, str]],
    current_market_ids: Set[str],
) -> Tuple[Set[str], int, int]:
    """Enrich current Polymarket sports events with canonical team links."""
    required_team_ids: Set[str] = set()
    enriched_events = 0

    print(
        "Enriching Polymarket sports participants from current event pages..."
    )

    for page_number, raw_events in polymarket_event_pages():
        page_enriched = 0
        page_links_before = len(links)

        for raw_event in raw_events:
            event_id_value = raw_event.get("id")
            if event_id_value in (None, ""):
                continue
            event_id = str(event_id_value)

            nested_markets = [
                market
                for market in polymarket_event_nested_markets(raw_event)
                if market.get("id") not in (None, "")
                and str(market["id"]) in current_market_ids
                and polymarket_current_market(market)
            ]
            if not nested_markets:
                continue

            sports_markets = [
                market
                for market in nested_markets
                if polymarket_is_sports_market(market, raw_event)
            ]
            if not sports_markets and not polymarket_embedded_teams(raw_event):
                continue

            representative_market = (
                sports_markets[0] if sports_markets else nested_markets[0]
            )
            event_key = ("polymarket", event_id)
            normalised_event = normalise_polymarket_event(
                raw_event,
                representative_market,
            )
            normalised_event["event_type"] = "sports"

            if event_key in events:
                events[event_key] = merge_missing_values(
                    events[event_key],
                    normalised_event,
                )
                # Event pages are richer than market-embedded event fragments.
                events[event_key]["raw_payload"] = normalised_event[
                    "raw_payload"
                ]
                events[event_key]["event_type"] = "sports"
                if normalised_event.get("native_game_id"):
                    events[event_key]["native_game_id"] = normalised_event[
                        "native_game_id"
                    ]
                    events[event_key]["source_id"] = normalised_event[
                        "source_id"
                    ]
                    events[event_key]["source_ids"] = normalised_event[
                        "source_ids"
                    ]
            else:
                events[event_key] = normalised_event

            for embedded_team in polymarket_embedded_teams(raw_event):
                normalised_team = normalise_polymarket_team(embedded_team)
                if not normalised_team:
                    continue
                entity_key = (
                    "polymarket",
                    normalised_team["external_entity_id"],
                )
                if entity_key in entities:
                    entities[entity_key] = merge_missing_values(
                        entities[entity_key],
                        normalised_team,
                    )
                else:
                    entities[entity_key] = normalised_team

            # Prefer event-level enriched teams. Fall back to every current
            # nested sports market so teamAID/teamBID are not missed.
            reference_markets = sports_markets or [representative_market]
            event_references: Set[Tuple[str, str]] = set()
            for market in reference_markets:
                event_references.update(
                    polymarket_team_references(raw_event, market)
                )

            for entity_id, role in event_references:
                required_team_ids.add(entity_id)
                links.add(("polymarket", event_id, entity_id, role))

            page_enriched += 1
            enriched_events += 1

        print(
            f"Polymarket event enrichment page {page_number}: "
            f"{enriched_events} current sports events enriched, "
            f"{len(links) - page_links_before} participant links added "
            f"from this page"
        )

    sports_events, exactly_two = polymarket_sports_coverage(events, links)
    print(
        "Polymarket sports event enrichment pass complete: "
        f"{sports_events} current sports events, "
        f"{exactly_two} currently have exactly two linked participants "
        "before team-directory resolution."
    )
    return required_team_ids, sports_events, exactly_two


def fetch_polymarket_team_directory(
    required_ids: Set[str],
) -> Dict[str, Dict[str, Any]]:
    if not required_ids:
        return {}

    teams: Dict[str, Dict[str, Any]] = {}
    offset = 0
    seen_page_signatures: Set[Tuple[str, ...]] = set()

    print(
        "Downloading the Polymarket team directory to enrich "
        f"{len(required_ids)} referenced current teams..."
    )

    while required_ids - set(teams):
        payload = get_json_with_retry(
            f"{POLYMARKET_GAMMA_URL}/teams",
            params={
                "limit": POLYMARKET_TEAM_PAGE_SIZE,
                "offset": offset,
                "ascending": "true",
            },
            label="Polymarket teams",
        )
        page = payload if isinstance(payload, list) else []
        if not page:
            break

        page_ids = tuple(
            str(row.get("id"))
            for row in page
            if isinstance(row, dict) and row.get("id") not in (None, "")
        )
        if not page_ids:
            break
        if page_ids in seen_page_signatures:
            raise RuntimeError("Polymarket teams pagination repeated a page.")
        seen_page_signatures.add(page_ids)

        for raw in page:
            if not isinstance(raw, dict) or raw.get("id") in (None, ""):
                continue
            team_id = str(raw["id"])
            if team_id in required_ids:
                teams[team_id] = raw

        offset += len(page)
        print(
            f"Polymarket teams scanned: {offset}; "
            f"referenced teams enriched: {len(teams)}/{len(required_ids)}"
        )

        if len(page) < POLYMARKET_TEAM_PAGE_SIZE:
            break
        time.sleep(0.05)

    return teams


def download_polymarket_snapshot(
    market_handle,
) -> Tuple[
    Dict[Tuple[str, str], Dict[str, Any]],
    Dict[Tuple[str, str], Dict[str, Any]],
    Set[Tuple[str, str, str, str]],
    int,
    int,
    int,
]:
    events: Dict[Tuple[str, str], Dict[str, Any]] = {}
    entities: Dict[Tuple[str, str], Dict[str, Any]] = {}
    links: Set[Tuple[str, str, str, str]] = set()
    required_team_ids: Set[str] = set()
    seen_market_ids: Set[str] = set()
    market_count = 0

    print("Downloading every current Polymarket market...")

    for page_number, raw_markets in polymarket_market_pages():
        page_saved = 0

        for raw_market in raw_markets:
            if not polymarket_current_market(raw_market):
                continue

            market_id = str(raw_market["id"])
            if market_id in seen_market_ids:
                continue
            seen_market_ids.add(market_id)

            event = polymarket_event_for_market(raw_market)
            event_id = str(event["id"])
            event_key = ("polymarket", event_id)
            normalised_event = normalise_polymarket_event(event, raw_market)

            if event_key in events:
                events[event_key] = merge_missing_values(
                    events[event_key],
                    normalised_event,
                )
            else:
                events[event_key] = normalised_event

            for embedded_team in polymarket_embedded_teams(event):
                normalised_team = normalise_polymarket_team(embedded_team)
                if normalised_team:
                    entity_key = (
                        "polymarket",
                        normalised_team["external_entity_id"],
                    )
                    if entity_key in entities:
                        entities[entity_key] = merge_missing_values(
                            entities[entity_key],
                            normalised_team,
                        )
                    else:
                        entities[entity_key] = normalised_team

            for entity_id, role in polymarket_team_references(event, raw_market):
                required_team_ids.add(entity_id)
                links.add(("polymarket", event_id, entity_id, role))

            write_json_line(
                market_handle,
                normalise_polymarket_market(raw_market, event),
            )
            market_count += 1
            page_saved += 1

        print(
            f"Polymarket market page {page_number}: "
            f"{market_count} unique current markets "
            f"({page_saved} added from this page)"
        )

    (
        event_team_ids,
        _sports_events_before_resolution,
        _two_participant_before_resolution,
    ) = enrich_polymarket_sports_participants(
        events=events,
        entities=entities,
        links=links,
        current_market_ids=seen_market_ids,
    )
    required_team_ids.update(event_team_ids)

    team_directory = fetch_polymarket_team_directory(required_team_ids)
    for team_id, raw_team in team_directory.items():
        normalised_team = normalise_polymarket_team(raw_team)
        if not normalised_team:
            continue

        entity_key = ("polymarket", team_id)
        if entity_key in entities:
            entities[entity_key] = merge_missing_values(
                entities[entity_key],
                normalised_team,
            )
        else:
            entities[entity_key] = normalised_team

    unresolved_team_ids = {
        entity_id
        for venue, _event_id, entity_id, _role in links
        if venue == "polymarket"
        and (venue, entity_id) not in entities
    }
    if unresolved_team_ids:
        print(
            "Polymarket team warning: "
            f"{len(unresolved_team_ids)} referenced team IDs were not found "
            "in embedded event data or the team directory. Their links will "
            "be excluded from the validated snapshot."
        )

    links = {
        row for row in links
        if (row[0], row[2]) in entities
    }

    sports_events, two_participant_sports_events = (
        polymarket_sports_coverage(events, links)
    )
    print(
        "Polymarket sports enrichment complete: "
        f"{len(entities)} team entities, "
        f"{len(links)} participant links, "
        f"{sports_events} current sports events, "
        f"{two_participant_sports_events} with exactly two linked participants."
    )

    return (
        events,
        entities,
        links,
        market_count,
        sports_events,
        two_participant_sports_events,
    )


# ---------------------------------------------------------------------------
# Kalshi current snapshot download
# ---------------------------------------------------------------------------


def kalshi_event_pages() -> Iterator[
    Tuple[int, List[Dict[str, Any]], List[Dict[str, Any]]]
]:
    cursor: Optional[str] = None
    seen_cursors: Set[str] = set()
    page_number = 0
    minimum_close_timestamp = int(utc_now().timestamp())

    while True:
        params: Dict[str, Any] = {
            "limit": KALSHI_EVENT_PAGE_SIZE,
            "with_nested_markets": "true",
            "with_milestones": "true",
            "min_close_ts": minimum_close_timestamp,
        }
        if cursor:
            params["cursor"] = cursor

        payload = get_json_with_retry(
            f"{KALSHI_API_URL}/events",
            params=params,
            label="Kalshi current events",
        )

        events = payload.get("events", []) if isinstance(payload, dict) else []
        milestones = (
            payload.get("milestones", []) if isinstance(payload, dict) else []
        )

        if not isinstance(events, list) or not events:
            break

        page_number += 1
        yield (
            page_number,
            [row for row in events if isinstance(row, dict)],
            [row for row in milestones if isinstance(row, dict)]
            if isinstance(milestones, list)
            else [],
        )

        next_cursor = payload.get("cursor") or payload.get("next_cursor")
        if not next_cursor:
            break

        next_cursor = str(next_cursor)
        if next_cursor == cursor or next_cursor in seen_cursors:
            raise RuntimeError("Kalshi returned a repeated event cursor.")

        seen_cursors.add(next_cursor)
        cursor = next_cursor
        time.sleep(0.1)


def kalshi_multivariate_event_pages() -> Iterator[
    Tuple[int, List[Dict[str, Any]]]
]:
    cursor: Optional[str] = None
    seen_cursors: Set[str] = set()
    page_number = 0

    while True:
        params: Dict[str, Any] = {
            "limit": KALSHI_EVENT_PAGE_SIZE,
            "with_nested_markets": "true",
        }
        if cursor:
            params["cursor"] = cursor

        payload = get_json_with_retry(
            f"{KALSHI_API_URL}/events/multivariate",
            params=params,
            label="Kalshi multivariate events",
        )
        events = payload.get("events", []) if isinstance(payload, dict) else []
        if not isinstance(events, list) or not events:
            break

        page_number += 1
        yield page_number, [
            row for row in events if isinstance(row, dict)
        ]

        next_cursor = payload.get("cursor") or payload.get("next_cursor")
        if not next_cursor:
            break

        next_cursor = str(next_cursor)
        if next_cursor == cursor or next_cursor in seen_cursors:
            raise RuntimeError(
                "Kalshi returned a repeated multivariate-event cursor."
            )

        seen_cursors.add(next_cursor)
        cursor = next_cursor
        time.sleep(0.1)



def kalshi_current_market(raw: Dict[str, Any]) -> bool:
    ticker = raw.get("ticker")
    if ticker in (None, ""):
        return False

    status = str(raw.get("status") or "").strip().lower()
    if status not in KALSHI_CURRENT_MARKET_STATUSES:
        return False

    close_time = first_non_empty(
        raw.get("close_time"),
        raw.get("latest_expiration_time"),
        raw.get("expiration_time"),
    )

    if close_time not in (None, ""):
        try:
            parsed = datetime.fromisoformat(
                str(close_time).replace("Z", "+00:00")
            )
            if parsed.tzinfo is None:
                parsed = parsed.replace(tzinfo=timezone.utc)
            if parsed <= utc_now() and status not in {"initialized", "unopened"}:
                return False
        except ValueError:
            pass

    return True


def milestone_by_event(
    milestones: Sequence[Dict[str, Any]],
) -> Dict[str, Dict[str, Any]]:
    primary: Dict[str, Dict[str, Any]] = {}
    related: Dict[str, Dict[str, Any]] = {}

    for milestone in milestones:
        for ticker in milestone.get("primary_event_tickers") or []:
            primary[str(ticker)] = milestone
        for ticker in milestone.get("related_event_tickers") or []:
            related.setdefault(str(ticker), milestone)

    return {**related, **primary}


def extract_target_references(
    value: Any,
    *,
    inherited_role: str = "participant",
) -> List[Tuple[str, str]]:
    references: List[Tuple[str, str]] = []

    if isinstance(value, dict):
        for key, child in value.items():
            lowered = str(key).lower()
            role = inherited_role

            if "home" in lowered:
                role = "home"
            elif "away" in lowered:
                role = "away"

            is_target_field = lowered.endswith(
                ("_team_id", "_participant_id", "_target_id")
            )

            if (
                is_target_field
                and isinstance(child, (str, int))
                and str(child).strip()
            ):
                references.append((str(child), role))
            else:
                references.extend(
                    extract_target_references(
                        child,
                        inherited_role=role,
                    )
                )

    elif isinstance(value, list):
        for child in value:
            references.extend(
                extract_target_references(
                    child,
                    inherited_role=inherited_role,
                )
            )

    return references


def fetch_kalshi_structured_targets(
    target_ids: Sequence[str],
) -> Dict[str, Dict[str, Any]]:
    unique_ids = list(
        dict.fromkeys(
            str(value) for value in target_ids if value not in (None, "")
        )
    )
    targets_by_id: Dict[str, Dict[str, Any]] = {}

    for batch_number, batch in enumerate(
        chunks(unique_ids, KALSHI_TARGET_BATCH_SIZE),
        start=1,
    ):
        params: List[Tuple[str, Any]] = [
            ("ids", target_id) for target_id in batch
        ]
        params.append(("page_size", 2000))

        payload = get_json_with_retry(
            f"{KALSHI_API_URL}/structured_targets",
            params=params,
            label="Kalshi structured targets",
        )

        rows = (
            payload.get("structured_targets", [])
            if isinstance(payload, dict)
            else []
        )

        if isinstance(rows, list):
            for raw in rows:
                if isinstance(raw, dict) and raw.get("id") not in (None, ""):
                    targets_by_id[str(raw["id"])] = raw

        print(
            f"Kalshi structured-target batch {batch_number}: "
            f"{len(targets_by_id)} unique targets"
        )
        time.sleep(0.05)

    return targets_by_id


def normalise_kalshi_target(raw: Dict[str, Any]) -> Dict[str, Any]:
    details = json_object(raw.get("details"))
    source_ids = json_object(raw.get("source_ids"))
    league = first_non_empty(
        details.get("league"),
        details.get("competition"),
        details.get("conference"),
        details.get("tour"),
    )

    return {
        "venue": "kalshi",
        "external_entity_id": str(raw["id"]),
        "name": str(first_non_empty(raw.get("name"), raw["id"])),
        "entity_type": native_text(raw.get("type")),
        "league": native_text(league),
        "abbreviation": native_text(
            first_non_empty(
                details.get("abbreviation"),
                details.get("short_name"),
            )
        ),
        "alias": native_text(details.get("alias")),
        "source_id": (
            str(raw["source_id"])
            if raw.get("source_id") not in (None, "")
            else None
        ),
        "source_ids": source_ids,
        "details": details,
        "raw_payload": raw,
    }


def normalise_kalshi_event(
    event: Dict[str, Any],
    milestone: Optional[Dict[str, Any]],
    markets: Sequence[Dict[str, Any]],
) -> Dict[str, Any]:
    milestone = milestone or {}
    details = json_object(milestone.get("details"))
    source_ids = json_object(milestone.get("source_ids"))
    first_market = markets[0] if markets else {}
    event_ticker = str(event["event_ticker"])

    raw_summary = dict(event)
    raw_summary.pop("markets", None)

    market_statuses = sorted(
        {
            str(market.get("status") or "unknown")
            for market in markets
        }
    )

    return {
        "venue": "kalshi",
        "external_event_id": event_ticker,
        "external_series_id": native_text(event.get("series_ticker")),
        "title": str(first_non_empty(event.get("title"), event_ticker)),
        "subtitle": native_text(
            first_non_empty(event.get("sub_title"), event.get("subtitle"))
        ),
        "category": native_text(event.get("category")),
        "event_type": native_text(
            first_non_empty(milestone.get("type"), event.get("category"))
        ),
        "status": "active",
        "venue_status": ",".join(market_statuses) or "unknown",
        "start_time": first_non_empty(
            milestone.get("start_date"),
            event.get("strike_date"),
            first_market.get("occurrence_datetime"),
            first_market.get("open_time"),
        ),
        "end_time": first_non_empty(
            milestone.get("end_date"),
            first_market.get("expected_expiration_time"),
            first_market.get("latest_expiration_time"),
        ),
        "close_time": first_non_empty(
            first_market.get("close_time"),
            first_market.get("latest_expiration_time"),
        ),
        "settlement_time": first_market.get("settlement_ts"),
        "native_game_id": native_text(
            first_non_empty(
                milestone.get("source_id"),
                details.get("game_id"),
                details.get("match_id"),
            )
        ),
        "milestone_id": native_text(milestone.get("id")),
        "source_id": native_text(milestone.get("source_id")),
        "source_ids": source_ids,
        "details": {
            **details,
            "product_metadata": event.get("product_metadata") or {},
            "mutually_exclusive": event.get("mutually_exclusive"),
            "fee_type_override": event.get("fee_type_override"),
            "fee_multiplier_override": event.get("fee_multiplier_override"),
        },
        "raw_payload": {
            **raw_summary,
            "milestone": milestone,
        },
    }


def normalise_kalshi_market(
    raw: Dict[str, Any],
    event: Dict[str, Any],
    milestone: Optional[Dict[str, Any]],
) -> Dict[str, Any]:
    milestone = milestone or {}
    ticker = str(raw["ticker"])

    yes_bid = normalise_price(
        first_non_empty(raw.get("yes_bid_dollars"), raw.get("yes_bid"))
    )
    yes_ask = normalise_price(
        first_non_empty(raw.get("yes_ask_dollars"), raw.get("yes_ask"))
    )
    no_bid = normalise_price(
        first_non_empty(raw.get("no_bid_dollars"), raw.get("no_bid"))
    )
    no_ask = normalise_price(
        first_non_empty(raw.get("no_ask_dollars"), raw.get("no_ask"))
    )

    yes_bid_size = as_float(
        first_non_empty(raw.get("yes_bid_size_fp"), raw.get("yes_bid_size"))
    )
    yes_ask_size = as_float(
        first_non_empty(raw.get("yes_ask_size_fp"), raw.get("yes_ask_size"))
    )
    no_bid_size = as_float(
        first_non_empty(
            raw.get("no_bid_size_fp"),
            raw.get("no_bid_size"),
            raw.get("yes_ask_size_fp"),
            raw.get("yes_ask_size"),
        )
    )
    no_ask_size = as_float(
        first_non_empty(
            raw.get("no_ask_size_fp"),
            raw.get("no_ask_size"),
            raw.get("yes_bid_size_fp"),
            raw.get("yes_bid_size"),
        )
    )

    last_price = normalise_price(
        first_non_empty(raw.get("last_price_dollars"), raw.get("last_price"))
    )

    outcomes = [
        {
            "key": "yes",
            "label": "Yes",
            "index": 0,
            "best_bid": yes_bid,
            "best_ask": yes_ask,
            "bid_size": yes_bid_size,
            "ask_size": yes_ask_size,
            "last_price": last_price,
        },
        {
            "key": "no",
            "label": "No",
            "index": 1,
            "best_bid": no_bid,
            "best_ask": no_ask,
            "bid_size": no_bid_size,
            "ask_size": no_ask_size,
            "last_price": None if last_price is None else 1 - last_price,
        },
    ]

    product_metadata = json_object(event.get("product_metadata"))
    custom_strike = json_object(raw.get("custom_strike"))
    milestone_details = json_object(milestone.get("details"))

    sports_market_type = first_non_empty(
        raw.get("sports_market_type"),
        product_metadata.get("market_type"),
        product_metadata.get("scope"),
    )

    return {
        "venue": "kalshi",
        "external_market_id": ticker,
        "external_event_id": str(event["event_ticker"]),
        "external_series_id": native_text(event.get("series_ticker")),
        "event_title": native_text(event.get("title")),
        "market_title": str(
            first_non_empty(
                raw.get("title"),
                raw.get("subtitle"),
                ticker,
            )
        ),
        "market_slug": ticker,
        "category": native_text(event.get("category")),
        "market_type": native_text(
            first_non_empty(raw.get("market_type"), "binary")
        ),
        "sports_market_type": native_text(sports_market_type),
        "status": "active",
        "venue_status": str(raw.get("status") or "unknown"),
        "resolution_time": first_non_empty(
            raw.get("expected_expiration_time"),
            raw.get("latest_expiration_time"),
            raw.get("expiration_time"),
        ),
        "event_start_time": first_non_empty(
            raw.get("occurrence_datetime"),
            milestone.get("start_date"),
            event.get("strike_date"),
            raw.get("open_time"),
        ),
        "close_time": first_non_empty(
            raw.get("close_time"),
            raw.get("latest_expiration_time"),
        ),
        "settlement_time": raw.get("settlement_ts"),
        "accepting_orders": (
            str(raw.get("status") or "").lower() == "active"
        ),
        "rules_url": None,
        "rules_primary": native_text(raw.get("rules_primary")),
        "rules_secondary": native_text(raw.get("rules_secondary")),
        "native_condition_id": None,
        "native_game_id": native_text(
            first_non_empty(
                milestone.get("source_id"),
                milestone_details.get("game_id"),
                milestone_details.get("match_id"),
            )
        ),
        "primary_participant_key": native_text(
            raw.get("primary_participant_key")
        ),
        "line_value": native_text(
            first_non_empty(raw.get("strike_value"), raw.get("line"))
        ),
        "floor_strike": native_text(raw.get("floor_strike")),
        "cap_strike": native_text(raw.get("cap_strike")),
        "functional_strike": native_text(raw.get("functional_strike")),
        "custom_strike": custom_strike,
        "contract_semantics": {
            "yes_sub_title": raw.get("yes_sub_title"),
            "no_sub_title": raw.get("no_sub_title"),
            "subtitle": raw.get("subtitle"),
            "primary_participant_key": raw.get("primary_participant_key"),
            "functional_strike": raw.get("functional_strike"),
            "custom_strike": custom_strike,
            "floor_strike": raw.get("floor_strike"),
            "cap_strike": raw.get("cap_strike"),
            "product_metadata": product_metadata,
            "mutually_exclusive": event.get("mutually_exclusive"),
            "mve_collection_ticker": raw.get("mve_collection_ticker"),
            "mve_selected_legs": raw.get("mve_selected_legs") or [],
            "price_level_structure": raw.get("price_level_structure"),
            "price_ranges": raw.get("price_ranges") or [],
            "fee_type_override": event.get("fee_type_override"),
            "fee_multiplier_override": event.get("fee_multiplier_override"),
        },
        "outcomes": outcomes,
        "raw_payload": raw,
        "liquidity": numeric_24_8(
            first_non_empty(raw.get("liquidity_dollars"), raw.get("liquidity"))
        ),
        "volume_24h": numeric_24_8(
            first_non_empty(raw.get("volume_24h_fp"), raw.get("volume_24h"))
        ),
        "total_volume": numeric_24_8(
            first_non_empty(raw.get("volume_fp"), raw.get("volume"))
        ),
        "open_interest": numeric_24_8(
            first_non_empty(raw.get("open_interest_fp"), raw.get("open_interest"))
        ),
    }


def download_kalshi_snapshot(
    market_handle,
) -> Tuple[
    Dict[Tuple[str, str], Dict[str, Any]],
    Dict[Tuple[str, str], Dict[str, Any]],
    Set[Tuple[str, str, str, str]],
    int,
]:
    events: Dict[Tuple[str, str], Dict[str, Any]] = {}
    entities: Dict[Tuple[str, str], Dict[str, Any]] = {}
    links: Set[Tuple[str, str, str, str]] = set()
    target_references: Dict[str, Set[Tuple[str, str]]] = {}
    seen_market_ids: Set[str] = set()
    market_count = 0
    global_milestone_lookup: Dict[str, Dict[str, Any]] = {}

    def process_events(
        raw_events: Sequence[Dict[str, Any]],
        milestone_lookup: Dict[str, Dict[str, Any]],
    ) -> int:
        nonlocal market_count
        page_saved = 0

        for event in raw_events:
            ticker_value = event.get("event_ticker")
            if ticker_value in (None, ""):
                continue

            event_ticker = str(ticker_value)
            raw_markets = event.get("markets") or []
            if not isinstance(raw_markets, list):
                continue

            current_markets = [
                market
                for market in raw_markets
                if isinstance(market, dict)
                and kalshi_current_market(market)
            ]
            if not current_markets:
                continue

            milestone = milestone_lookup.get(event_ticker)
            event_key = ("kalshi", event_ticker)
            normalised_event = normalise_kalshi_event(
                event,
                milestone,
                current_markets,
            )

            if event_key in events:
                events[event_key] = merge_missing_values(
                    events[event_key],
                    normalised_event,
                )
            else:
                events[event_key] = normalised_event

            if milestone:
                for entity_id, role in extract_target_references(
                    milestone.get("details") or {}
                ):
                    links.add(("kalshi", event_ticker, entity_id, role))
                    target_references.setdefault(entity_id, set()).add(
                        (event_ticker, role)
                    )

            for raw_market in current_markets:
                market_ticker = str(raw_market["ticker"])
                if market_ticker in seen_market_ids:
                    continue

                seen_market_ids.add(market_ticker)
                write_json_line(
                    market_handle,
                    normalise_kalshi_market(
                        raw_market,
                        event,
                        milestone,
                    ),
                )
                market_count += 1
                page_saved += 1

        return page_saved

    print(
        "Downloading every current standard Kalshi market "
        "(unopened, open, and paused)..."
    )
    for page_number, raw_events, milestones in kalshi_event_pages():
        global_milestone_lookup.update(milestone_by_event(milestones))
        page_saved = process_events(raw_events, global_milestone_lookup)
        print(
            f"Kalshi standard event page {page_number}: "
            f"{len(events)} current events, "
            f"{market_count} unique current markets "
            f"({page_saved} added from this page)"
        )

    if INCLUDE_KALSHI_MULTIVARIATE:
        print(
            "Downloading Kalshi multivariate/combo markets because "
            "PREDICTION_INCLUDE_KALSHI_MULTIVARIATE is enabled..."
        )
        for page_number, raw_events in kalshi_multivariate_event_pages():
            page_saved = process_events(raw_events, {})
            print(
                f"Kalshi multivariate event page {page_number}: "
                f"{len(events)} current events, "
                f"{market_count} unique current markets "
                f"({page_saved} added from this page)"
            )
    else:
        print(
            "Skipping Kalshi multivariate/combo markets. "
            "Standard Kalshi markets across all categories are still included. "
            "Set PREDICTION_INCLUDE_KALSHI_MULTIVARIATE=true only for a "
            "separate combo-market experiment."
        )

    if target_references:
        target_directory = fetch_kalshi_structured_targets(
            sorted(target_references)
        )
        for target_id, raw_target in target_directory.items():
            normalised = normalise_kalshi_target(raw_target)
            entities[("kalshi", target_id)] = normalised

    links = {
        row for row in links
        if (row[0], row[2]) in entities
    }

    return events, entities, links, market_count



# ---------------------------------------------------------------------------
# Download, validate, and persist local snapshot
# ---------------------------------------------------------------------------

def write_dimension_files(
    paths: SnapshotPaths,
    events: Dict[Tuple[str, str], Dict[str, Any]],
    entities: Dict[Tuple[str, str], Dict[str, Any]],
    links: Set[Tuple[str, str, str, str]],
) -> None:
    with paths.events.open("w", encoding="utf-8") as handle:
        for key in sorted(events):
            write_json_line(handle, events[key])

    with paths.entities.open("w", encoding="utf-8") as handle:
        for key in sorted(entities):
            write_json_line(handle, entities[key])

    with paths.links.open("w", encoding="utf-8") as handle:
        for venue, event_id, entity_id, role in sorted(links):
            write_json_line(
                handle,
                {
                    "venue": venue,
                    "external_event_id": event_id,
                    "external_entity_id": entity_id,
                    "role": role,
                },
            )


def validate_snapshot(
    summary: SnapshotSummary,
    paths: SnapshotPaths,
) -> None:
    errors: List[str] = []

    if summary.polymarket_markets < MIN_POLYMARKET_MARKETS:
        errors.append(
            "Polymarket returned only "
            f"{summary.polymarket_markets} current markets; minimum is "
            f"{MIN_POLYMARKET_MARKETS}."
        )

    if summary.kalshi_markets < MIN_KALSHI_MARKETS:
        errors.append(
            "Kalshi returned only "
            f"{summary.kalshi_markets} current markets; minimum is "
            f"{MIN_KALSHI_MARKETS}."
        )

    if summary.polymarket_entities < MIN_POLYMARKET_TEAM_ENTITIES:
        errors.append(
            "Polymarket sports enrichment returned only "
            f"{summary.polymarket_entities} team entities; minimum is "
            f"{MIN_POLYMARKET_TEAM_ENTITIES}."
        )

    if summary.polymarket_links < MIN_POLYMARKET_PARTICIPANT_LINKS:
        errors.append(
            "Polymarket sports enrichment returned only "
            f"{summary.polymarket_links} participant links; minimum is "
            f"{MIN_POLYMARKET_PARTICIPANT_LINKS}."
        )

    if (
        summary.polymarket_two_participant_sports_events
        < MIN_POLYMARKET_TWO_PARTICIPANT_SPORTS_EVENTS
    ):
        errors.append(
            "Polymarket sports enrichment returned only "
            f"{summary.polymarket_two_participant_sports_events} sports "
            "events with exactly two linked participants; minimum is "
            f"{MIN_POLYMARKET_TWO_PARTICIPANT_SPORTS_EVENTS}."
        )

    if summary.total_events <= 0:
        errors.append("No current events were downloaded.")

    if summary.total_markets <= 0:
        errors.append("No current markets were downloaded.")

    for path in (paths.events, paths.entities, paths.links, paths.markets):
        if not path.exists():
            errors.append(f"Missing snapshot file: {path.name}")

    if paths.markets.exists() and paths.markets.stat().st_size == 0:
        errors.append("The markets snapshot file is empty.")

    if errors:
        raise RuntimeError(
            "Snapshot validation failed. Supabase was not touched:\n- "
            + "\n- ".join(errors)
        )


def download_current_snapshot(paths: SnapshotPaths) -> SnapshotSummary:
    summary = SnapshotSummary()
    all_events: Dict[Tuple[str, str], Dict[str, Any]] = {}
    all_entities: Dict[Tuple[str, str], Dict[str, Any]] = {}
    all_links: Set[Tuple[str, str, str, str]] = set()

    with paths.markets.open("w", encoding="utf-8") as market_handle:
        (
            poly_events,
            poly_entities,
            poly_links,
            poly_market_count,
            poly_sports_event_count,
            poly_two_participant_sports_event_count,
        ) = download_polymarket_snapshot(market_handle)

        (
            kalshi_events,
            kalshi_entities,
            kalshi_links,
            kalshi_market_count,
        ) = download_kalshi_snapshot(market_handle)

    all_events.update(poly_events)
    all_events.update(kalshi_events)
    all_entities.update(poly_entities)
    all_entities.update(kalshi_entities)
    all_links.update(poly_links)
    all_links.update(kalshi_links)

    summary.polymarket_events = len(poly_events)
    summary.polymarket_entities = len(poly_entities)
    summary.polymarket_links = len(poly_links)
    summary.polymarket_markets = poly_market_count
    summary.polymarket_sports_events = poly_sports_event_count
    summary.polymarket_two_participant_sports_events = (
        poly_two_participant_sports_event_count
    )

    summary.kalshi_events = len(kalshi_events)
    summary.kalshi_entities = len(kalshi_entities)
    summary.kalshi_links = len(kalshi_links)
    summary.kalshi_markets = kalshi_market_count

    write_dimension_files(
        paths,
        all_events,
        all_entities,
        all_links,
    )

    manifest = {
        "serviceVersion": SERVICE_VERSION,
        "generatedAt": utc_now_iso(),
        "summary": summary.as_dict(),
        "policy": {
            "currentOnly": True,
            "historicalPricesStored": False,
            "quoteSnapshotsStored": False,
            "fullReplacement": True,
            "venues": ["polymarket", "kalshi"],
            "kalshiMultivariateIncluded": INCLUDE_KALSHI_MULTIVARIATE,
        },
    }
    paths.manifest.write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )

    validate_snapshot(summary, paths)
    return summary


# ---------------------------------------------------------------------------
# Transactional database replacement
# ---------------------------------------------------------------------------


@contextmanager
def catalog_refresh_lock():
    conn = get_db_connection_dict()
    conn.autocommit = True
    acquired = False

    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT pg_try_advisory_lock(%s) AS acquired",
                (CATALOG_REFRESH_LOCK_ID,),
            )
            row = cur.fetchone()
            acquired = bool(row and row["acquired"])

        yield acquired

    finally:
        if acquired:
            try:
                with conn.cursor() as cur:
                    cur.execute(
                        "SELECT pg_advisory_unlock(%s)",
                        (CATALOG_REFRESH_LOCK_ID,),
                    )
            except Exception as exc:
                print(
                    "Could not explicitly release the catalog refresh lock: "
                    f"{exc}"
                )
        conn.close()


def ensure_snapshot_schema(cur) -> None:
    expected_tables = {
        "prediction_market_events",
        "prediction_market_entities",
        "prediction_market_event_entities",
        "prediction_market_entity_links",
        "prediction_market_catalog",
        "prediction_market_ingest_runs",
    }

    cur.execute(
        """
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = ANY(%s)
        """,
        (sorted(expected_tables),),
    )

    found = {row["table_name"] for row in cur.fetchall()}
    missing = sorted(expected_tables - found)

    if missing:
        raise RuntimeError(
            "Prediction-market schema is missing: "
            + ", ".join(missing)
            + ". Run prediction_markets_setup.py first."
        )

    cur.execute(
        """
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'prediction_market_catalog'
        """
    )
    catalog_columns = {row["column_name"] for row in cur.fetchall()}

    required_columns = {
        "venue_status",
        "close_time",
        "settlement_time",
        "accepting_orders",
        "open_interest",
    }
    missing_columns = sorted(required_columns - catalog_columns)

    if missing_columns:
        raise RuntimeError(
            "prediction_market_catalog is using the old schema. Missing "
            "columns: "
            + ", ".join(missing_columns)
            + ". Replace and run the new prediction_markets_setup.py first."
        )


def insert_entities(
    cur,
    paths: SnapshotPaths,
) -> Dict[Tuple[str, str], int]:
    entity_ids: Dict[Tuple[str, str], int] = {}

    for batch in read_jsonl_batches(paths.entities, DATABASE_BATCH_SIZE):
        rows = [
            (
                row["venue"],
                row["external_entity_id"],
                row["name"],
                row.get("entity_type"),
                row.get("league"),
                row.get("abbreviation"),
                row.get("alias"),
                row.get("source_id"),
                psycopg2.extras.Json(row.get("source_ids") or {}),
                psycopg2.extras.Json(row.get("details") or {}),
                psycopg2.extras.Json(row.get("raw_payload") or {}),
            )
            for row in batch
        ]

        returned = psycopg2.extras.execute_values(
            cur,
            """
            INSERT INTO public.prediction_market_entities (
                venue,
                external_entity_id,
                name,
                entity_type,
                league,
                abbreviation,
                alias,
                source_id,
                source_ids,
                details,
                raw_payload
            )
            VALUES %s
            RETURNING id, venue, external_entity_id
            """,
            rows,
            page_size=DATABASE_BATCH_SIZE,
            fetch=True,
        )

        for row in returned:
            entity_ids[(row["venue"], str(row["external_entity_id"]))] = row["id"]

    return entity_ids


def insert_events(
    cur,
    paths: SnapshotPaths,
) -> Dict[Tuple[str, str], int]:
    event_ids: Dict[Tuple[str, str], int] = {}

    for batch in read_jsonl_batches(paths.events, DATABASE_BATCH_SIZE):
        rows = [
            (
                row["venue"],
                row["external_event_id"],
                row.get("external_series_id"),
                row["title"],
                row.get("subtitle"),
                row.get("category"),
                row.get("event_type"),
                row.get("status") or "active",
                row.get("venue_status"),
                row.get("start_time"),
                row.get("end_time"),
                row.get("close_time"),
                row.get("settlement_time"),
                row.get("native_game_id"),
                row.get("milestone_id"),
                row.get("source_id"),
                psycopg2.extras.Json(row.get("source_ids") or {}),
                psycopg2.extras.Json(row.get("details") or {}),
                psycopg2.extras.Json(row.get("raw_payload") or {}),
            )
            for row in batch
        ]

        returned = psycopg2.extras.execute_values(
            cur,
            """
            INSERT INTO public.prediction_market_events (
                venue,
                external_event_id,
                external_series_id,
                title,
                subtitle,
                category,
                event_type,
                status,
                venue_status,
                start_time,
                end_time,
                close_time,
                settlement_time,
                native_game_id,
                milestone_id,
                source_id,
                source_ids,
                details,
                raw_payload
            )
            VALUES %s
            RETURNING id, venue, external_event_id
            """,
            rows,
            page_size=DATABASE_BATCH_SIZE,
            fetch=True,
        )

        for row in returned:
            event_ids[(row["venue"], str(row["external_event_id"]))] = row["id"]

    return event_ids


def insert_event_entity_links(
    cur,
    paths: SnapshotPaths,
    event_ids: Dict[Tuple[str, str], int],
    entity_ids: Dict[Tuple[str, str], int],
) -> int:
    inserted = 0

    for batch in read_jsonl_batches(paths.links, DATABASE_BATCH_SIZE):
        rows: List[Tuple[int, int, str]] = []

        for row in batch:
            event_id = event_ids.get(
                (row["venue"], row["external_event_id"])
            )
            entity_id = entity_ids.get(
                (row["venue"], row["external_entity_id"])
            )

            if event_id is None or entity_id is None:
                continue

            rows.append((event_id, entity_id, row.get("role") or "unknown"))

        if not rows:
            continue

        psycopg2.extras.execute_values(
            cur,
            """
            INSERT INTO public.prediction_market_event_entities (
                event_id,
                entity_id,
                role
            )
            VALUES %s
            ON CONFLICT (event_id, entity_id, role) DO NOTHING
            """,
            rows,
            page_size=DATABASE_BATCH_SIZE,
        )
        inserted += len(rows)

    return inserted


def insert_markets(
    cur,
    paths: SnapshotPaths,
    event_ids: Dict[Tuple[str, str], int],
) -> int:
    inserted = 0

    for batch in read_jsonl_batches(paths.markets, DATABASE_BATCH_SIZE):
        rows = []

        for row in batch:
            event_catalog_id = event_ids.get(
                (row["venue"], row["external_event_id"])
            )
            if event_catalog_id is None:
                raise RuntimeError(
                    "Market references a missing event: "
                    f"{row['venue']} {row['external_market_id']} -> "
                    f"{row['external_event_id']}"
                )

            rows.append(
                (
                    row["venue"],
                    event_catalog_id,
                    row["external_market_id"],
                    row.get("external_event_id"),
                    row.get("external_series_id"),
                    row.get("event_title"),
                    row["market_title"],
                    row.get("market_slug"),
                    row.get("category"),
                    row.get("market_type"),
                    row.get("sports_market_type"),
                    row.get("status") or "active",
                    row.get("venue_status"),
                    row.get("resolution_time"),
                    row.get("event_start_time"),
                    row.get("close_time"),
                    row.get("settlement_time"),
                    row.get("accepting_orders"),
                    row.get("rules_url"),
                    row.get("rules_primary"),
                    row.get("rules_secondary"),
                    row.get("native_condition_id"),
                    row.get("native_game_id"),
                    row.get("primary_participant_key"),
                    row.get("line_value"),
                    row.get("floor_strike"),
                    row.get("cap_strike"),
                    row.get("functional_strike"),
                    psycopg2.extras.Json(row.get("custom_strike") or {}),
                    psycopg2.extras.Json(
                        row.get("contract_semantics") or {}
                    ),
                    psycopg2.extras.Json(row.get("outcomes") or []),
                    psycopg2.extras.Json(row.get("raw_payload") or {}),
                    row.get("liquidity"),
                    row.get("volume_24h"),
                    row.get("total_volume"),
                    row.get("open_interest"),
                )
            )

        psycopg2.extras.execute_values(
            cur,
            """
            INSERT INTO public.prediction_market_catalog (
                venue,
                event_catalog_id,
                external_market_id,
                external_event_id,
                external_series_id,
                event_title,
                market_title,
                market_slug,
                category,
                market_type,
                sports_market_type,
                status,
                venue_status,
                resolution_time,
                event_start_time,
                close_time,
                settlement_time,
                accepting_orders,
                rules_url,
                rules_primary,
                rules_secondary,
                native_condition_id,
                native_game_id,
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
                open_interest
            )
            VALUES %s
            """,
            rows,
            page_size=DATABASE_BATCH_SIZE,
        )
        inserted += len(rows)

        if inserted % 5000 < len(rows):
            print(f"Database replacement: {inserted} markets inserted...")

    return inserted


def _replace_database_snapshot_once(
    paths: SnapshotPaths,
    summary: SnapshotSummary,
) -> None:
    """Atomically replace the current snapshot using one database transaction."""
    conn = get_db_connection_dict()
    try:
        with conn.cursor() as cur:
            cur.execute("SET LOCAL statement_timeout = 0")
            cur.execute("SET LOCAL lock_timeout = '60s'")

            # Use a transaction-scoped advisory lock on the SAME connection as
            # the replacement.  This avoids keeping a second idle lock
            # connection alive for the entire large insert.  PostgreSQL releases
            # this lock automatically on commit, rollback, or disconnect.
            cur.execute(
                "SELECT pg_try_advisory_xact_lock(%s) AS acquired",
                (CATALOG_REFRESH_LOCK_ID,),
            )
            row = cur.fetchone()
            acquired = bool(row and row["acquired"])
            if not acquired:
                raise RuntimeError(
                    "Another prediction-market replacement is already running."
                )

            ensure_snapshot_schema(cur)

            cur.execute(
                """
                TRUNCATE TABLE
                    public.prediction_market_entity_links,
                    public.prediction_market_event_entities,
                    public.prediction_market_catalog,
                    public.prediction_market_entities,
                    public.prediction_market_events,
                    public.prediction_market_ingest_runs
                RESTART IDENTITY CASCADE
                """
            )

            entity_ids = insert_entities(cur, paths)
            print(
                f"Database replacement: {len(entity_ids)} entities inserted."
            )

            event_ids = insert_events(cur, paths)
            print(
                f"Database replacement: {len(event_ids)} events inserted."
            )

            relationships_inserted = insert_event_entity_links(
                cur,
                paths,
                event_ids,
                entity_ids,
            )
            print(
                "Database replacement: "
                f"{relationships_inserted} participant links inserted."
            )

            markets_inserted = insert_markets(
                cur,
                paths,
                event_ids,
            )

            if markets_inserted != summary.total_markets:
                raise RuntimeError(
                    "Market insertion count mismatch: expected "
                    f"{summary.total_markets}, inserted "
                    f"{markets_inserted}."
                )

            cur.execute(
                """
                INSERT INTO public.prediction_market_ingest_runs (
                    venue,
                    run_type,
                    status,
                    events_seen,
                    entities_seen,
                    relationships_seen,
                    markets_seen,
                    started_at,
                    finished_at
                )
                VALUES (
                    'combined',
                    'manual_snapshot',
                    'completed',
                    %s,
                    %s,
                    %s,
                    %s,
                    NOW(),
                    NOW()
                )
                """,
                (
                    summary.total_events,
                    summary.total_entities,
                    relationships_inserted,
                    summary.total_markets,
                ),
            )

        conn.commit()

    except Exception:
        # A dead psycopg connection cannot be rolled back explicitly, but
        # PostgreSQL automatically discards its uncommitted transaction.  Do
        # not let a secondary "connection already closed" error hide the real
        # database failure that triggered the retry.
        try:
            if not getattr(conn, "closed", 1):
                conn.rollback()
        except Exception:
            pass
        raise
    finally:
        try:
            conn.close()
        except Exception:
            pass


def replace_database_snapshot(
    paths: SnapshotPaths,
    summary: SnapshotSummary,
) -> None:
    print(
        "Both venue downloads validated. Replacing the Supabase snapshot "
        "inside one atomic transaction..."
    )

    attempts = max(1, DATABASE_REPLACEMENT_ATTEMPTS)

    for attempt in range(1, attempts + 1):
        try:
            if attempt > 1:
                print(
                    "Retrying the SAME validated local snapshot; venue downloads "
                    "will not be repeated."
                )

            _replace_database_snapshot_once(paths, summary)
            print(
                "Supabase replacement committed successfully. The database now "
                "contains only the newly downloaded current snapshot."
            )
            return

        except (psycopg2.InterfaceError, psycopg2.OperationalError) as exc:
            if attempt >= attempts:
                raise

            delay = min(15, 3 * attempt)
            print(
                "Database connection dropped during atomic replacement "
                f"(attempt {attempt}/{attempts}): {type(exc).__name__}: {exc}"
            )
            print(
                "The failed transaction was not committed. Waiting "
                f"{delay}s, then retrying from the preserved local snapshot..."
            )
            time.sleep(delay)


# ---------------------------------------------------------------------------
# Commands
# ---------------------------------------------------------------------------


def print_summary(summary: SnapshotSummary, paths: SnapshotPaths) -> None:
    print("\nCurrent snapshot summary:")
    print(
        "  Polymarket: "
        f"{summary.polymarket_events} events, "
        f"{summary.polymarket_markets} markets, "
        f"{summary.polymarket_entities} entities, "
        f"{summary.polymarket_links} participant links"
    )
    print(
        "  Kalshi: "
        f"{summary.kalshi_events} events, "
        f"{summary.kalshi_markets} markets, "
        f"{summary.kalshi_entities} entities, "
        f"{summary.kalshi_links} participant links"
    )
    print(
        "  Combined: "
        f"{summary.total_events} events, "
        f"{summary.total_markets} markets"
    )
    print(f"  Local snapshot: {paths.root}")


def run_manual_refresh(
    *,
    keep_snapshot: bool,
    requested_directory: Optional[str],
) -> None:
    temporary_directory: Optional[tempfile.TemporaryDirectory[str]] = None

    if requested_directory:
        root = Path(requested_directory).expanduser().resolve()
        if root.exists():
            shutil.rmtree(root)
        root.mkdir(parents=True, exist_ok=True)
    elif keep_snapshot:
        root = (
            Path.cwd()
            / "prediction_market_snapshots"
            / utc_now().strftime("%Y%m%dT%H%M%SZ")
        )
    else:
        temporary_directory = tempfile.TemporaryDirectory(
            prefix="bullionaire_prediction_snapshot_"
        )
        root = Path(temporary_directory.name)

    paths = create_snapshot_paths(root)

    try:
        summary = download_current_snapshot(paths)
        print_summary(summary, paths)
        replace_database_snapshot(paths, summary)

        if keep_snapshot or requested_directory:
            print(f"Local snapshot files retained at: {paths.root}")

    except Exception:
        if temporary_directory is not None:
            # Preserve failed downloads for diagnosis instead of deleting them.
            failed_root = (
                Path.cwd()
                / "prediction_market_failed_snapshots"
                / utc_now().strftime("%Y%m%dT%H%M%SZ")
            )
            failed_root.parent.mkdir(parents=True, exist_ok=True)
            shutil.copytree(paths.root, failed_root, dirs_exist_ok=True)
            print(f"Failed snapshot files preserved at: {failed_root}")
        raise

    finally:
        if temporary_directory is not None:
            temporary_directory.cleanup()


def run_download_only(directory: str) -> None:
    root = Path(directory).expanduser().resolve()
    if root.exists():
        shutil.rmtree(root)
    paths = create_snapshot_paths(root)
    summary = download_current_snapshot(paths)
    print_summary(summary, paths)
    print("Download-only completed. Supabase was not modified.")


def show_database_status() -> None:
    with get_db_connection_dict() as conn:
        with conn.cursor() as cur:
            ensure_snapshot_schema(cur)
            cur.execute(
                """
                SELECT venue, COUNT(*) AS event_count
                FROM public.prediction_market_events
                GROUP BY venue
                ORDER BY venue
                """
            )
            event_counts = {
                row["venue"]: row["event_count"]
                for row in cur.fetchall()
            }

            cur.execute(
                """
                SELECT venue, COUNT(*) AS market_count
                FROM public.prediction_market_catalog
                GROUP BY venue
                ORDER BY venue
                """
            )
            market_counts = {
                row["venue"]: row["market_count"]
                for row in cur.fetchall()
            }

            cur.execute(
                """
                SELECT
                    status,
                    markets_seen,
                    events_seen,
                    entities_seen,
                    relationships_seen,
                    finished_at
                FROM public.prediction_market_ingest_runs
                WHERE venue = 'combined'
                ORDER BY id DESC
                LIMIT 1
                """
            )
            last_run = cur.fetchone()

    print(f"Service version: {SERVICE_VERSION}")
    print("Current Supabase snapshot:")
    for venue in ("polymarket", "kalshi"):
        print(
            f"  {venue}: {event_counts.get(venue, 0)} events, "
            f"{market_counts.get(venue, 0)} markets"
        )

    if last_run:
        print(
            "Last combined refresh: "
            f"{last_run['status']} at {last_run['finished_at']} "
            f"({last_run['markets_seen']} markets)"
        )
    else:
        print("No completed combined snapshot refresh is recorded.")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description=(
            "Download the complete current Polymarket catalog and all "
            "standard current Kalshi markets, then transactionally replace "
            "the Supabase snapshot. Kalshi multivariate combos are opt-in."
        )
    )
    subparsers = parser.add_subparsers(dest="command")

    refresh_parser = subparsers.add_parser(
        "refresh",
        help=(
            "Download both venues, validate them, and completely replace "
            "the current Supabase snapshot."
        ),
    )
    refresh_parser.add_argument(
        "--keep-snapshot",
        action="store_true",
        help="Keep the downloaded JSONL snapshot after a successful refresh.",
    )
    refresh_parser.add_argument(
        "--snapshot-dir",
        help=(
            "Write the local snapshot to this directory. Existing contents "
            "will be replaced."
        ),
    )

    download_parser = subparsers.add_parser(
        "download",
        help="Download and validate both venues without modifying Supabase.",
    )
    download_parser.add_argument(
        "directory",
        help="Directory where the downloaded JSONL snapshot will be written.",
    )

    subparsers.add_parser(
        "status",
        help="Show current prediction-market row counts in Supabase.",
    )

    return parser


def main() -> None:
    print(f"Service version: {SERVICE_VERSION}")
    parser = build_parser()
    args = parser.parse_args()

    if args.command is None:
        parser.print_help()
        print("\nNo refresh was started.")
        return

    if args.command == "refresh":
        run_manual_refresh(
            keep_snapshot=bool(args.keep_snapshot),
            requested_directory=args.snapshot_dir,
        )
        return

    if args.command == "download":
        run_download_only(args.directory)
        return

    if args.command == "status":
        show_database_status()
        return

    raise RuntimeError(f"Unsupported command: {args.command}")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nCancelled. The existing Supabase snapshot was not replaced.")
        sys.exit(130)
    except Exception as exc:
        print(f"\nFAILED: {compact_error(exc)}", file=sys.stderr)
        sys.exit(1)