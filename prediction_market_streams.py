"""
Bullionaire Prediction Terminal — real-time market stream layer.

Version: live-streams-v3.8-retired-runtime-release

Purpose
-------
Maintain live Polymarket and Kalshi order books in memory for the exact
cross-venue pairs produced by prediction_market_engine.py. This module does
not write WebSocket ticks to PostgreSQL and does not modify the validated
matching or fee engine.

Required packages
-----------------
    pip install "websockets>=12,<16" "cryptography>=42,<46"

Environment variables
---------------------
    DATABASE_URL                    Used by prediction_market_engine.py
    KALSHI_API_KEY_ID               Kalshi API key ID
    KALSHI_PRIVATE_KEY_PATH         Path to Kalshi RSA private key file
    KALSHI_PRIVATE_KEY_PEM          Alternative: PEM contents directly
    KALSHI_WS_ENV                   production (default) or demo

Useful commands
---------------
    python prediction_market_streams.py self-test
    python prediction_market_streams.py manifest --market-group all
    python prediction_market_streams.py smoke --market-group all --seconds 30
    python prediction_market_streams.py run --market-group all

Design notes
------------
* Polymarket's public market channel is subscribed by token/asset ID.
* Kalshi's authenticated orderbook_delta channel is subscribed by market ticker.
* Full books are held in memory; no per-tick database writes occur.
* Reconnects use capped exponential backoff with jitter.
* Kalshi sequence gaps force a reconnect so a fresh snapshot is obtained.
* The manager can run Polymarket by itself when Kalshi credentials are absent,
  but cross-venue terminal results are only complete when both venues are live.
"""

from __future__ import annotations

import argparse
import asyncio
import base64
import inspect
import json
import logging
import os
import random
import signal
import time
from collections import defaultdict
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Any, Dict, Iterable, List, Literal, Mapping, Optional, Sequence, Set, Tuple
from dotenv import load_dotenv

load_dotenv(
    Path(__file__).resolve().with_name(".env"),
    override=False,
)

try:
    import websockets
    from websockets.exceptions import ConnectionClosed
except ImportError as exc:  # pragma: no cover - dependency guidance
    raise RuntimeError(
        'Missing dependency "websockets". Run: '
        'pip install "websockets>=12,<16" "cryptography>=42,<46"'
    ) from exc

try:
    from cryptography.hazmat.backends import default_backend
    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.primitives.asymmetric import padding, rsa
except ImportError as exc:  # pragma: no cover - dependency guidance
    raise RuntimeError(
        'Missing dependency "cryptography". Run: '
        'pip install "websockets>=12,<16" "cryptography>=42,<46"'
    ) from exc

STREAMS_VERSION = "live-streams-v3.8-retired-runtime-release"
POLYMARKET_MARKET_WS_URL = (
    "wss://ws-subscriptions-clob.polymarket.com/ws/market"
)
KALSHI_PRODUCTION_WS_URL = (
    "wss://external-api-ws.kalshi.com/trade-api/ws/v2"
)
KALSHI_DEMO_WS_URL = (
    "wss://external-api-ws.demo.kalshi.co/trade-api/ws/v2"
)
KALSHI_WS_SIGN_PATH = "/trade-api/ws/v2"

POLYMARKET_BATCH_SIZE = int(
    os.getenv("POLYMARKET_WS_BATCH_SIZE", "250")
)
KALSHI_BATCH_SIZE = int(
    os.getenv("KALSHI_WS_BATCH_SIZE", "200")
)
MAX_RECONNECT_SECONDS = float(
    os.getenv("PREDICTION_WS_MAX_RECONNECT_SECONDS", "60")
)
INITIAL_SNAPSHOT_TIMEOUT_SECONDS = float(
    os.getenv("PREDICTION_INITIAL_SNAPSHOT_TIMEOUT_SECONDS", "30")
)
KALSHI_SNAPSHOT_RECOVERY_AFTER_SECONDS = max(
    3.0,
    float(os.getenv("KALSHI_SNAPSHOT_RECOVERY_AFTER_SECONDS", "8")),
)
KALSHI_SNAPSHOT_RECOVERY_INTERVAL_SECONDS = max(
    3.0,
    float(os.getenv("KALSHI_SNAPSHOT_RECOVERY_INTERVAL_SECONDS", "10")),
)
KALSHI_SNAPSHOT_FORCE_RECONNECT_SECONDS = max(
    INITIAL_SNAPSHOT_TIMEOUT_SECONDS * 2.0,
    float(os.getenv("KALSHI_SNAPSHOT_FORCE_RECONNECT_SECONDS", "75")),
)
KALSHI_SNAPSHOT_REQUEST_CHUNK_SIZE = max(
    1,
    int(os.getenv("KALSHI_SNAPSHOT_REQUEST_CHUNK_SIZE", "50")),
)

# Keep WebSocket receive buffers bounded. The previous 20,000-frame/message
# queue could retain far more burst traffic than this process needs. A bounded
# queue creates backpressure instead of allowing transient venue bursts to turn
# into avoidable RAM spikes.
WS_MAX_QUEUE = max(
    16,
    int(os.getenv("PREDICTION_WS_MAX_QUEUE", "512")),
)
WS_MAX_SIZE_BYTES = max(
    1_048_576,
    int(os.getenv("PREDICTION_WS_MAX_SIZE_BYTES", str(8 * 1024 * 1024))),
)

# Quantities smaller than this are numerical residue, not executable
# contracts. This threshold remains far below any meaningful displayed
# contract size and still preserves legitimate micro-depth such as 0.00002.
BOOK_SIZE_EPSILON = Decimal("0.000000001")

LOGGER = logging.getLogger("prediction_market_streams")


class StreamConfigurationError(RuntimeError):
    """Raised when required stream configuration is missing or invalid."""


class SequenceGapError(RuntimeError):
    """Raised when a Kalshi subscription sequence is discontinuous."""


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def iso_now() -> str:
    return utc_now().isoformat()


def age_seconds(value: Optional[str]) -> Optional[float]:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(value)
    except (TypeError, ValueError):
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return max(0.0, (utc_now() - parsed).total_seconds())


def decimal_or_none(value: Any) -> Optional[Decimal]:
    if value in (None, ""):
        return None
    try:
        return Decimal(str(value))
    except (InvalidOperation, ValueError, TypeError):
        return None


def float_or_none(value: Any) -> Optional[float]:
    parsed = decimal_or_none(value)
    return None if parsed is None else float(parsed)


def positive_float(value: Any) -> float:
    parsed = float_or_none(value)
    if parsed is None or parsed <= 0:
        return 0.0
    return parsed


def book_size_or_none(
    value: Any,
) -> Optional[float]:
    """
    Normalize venue size values without allowing floating-point dust to
    masquerade as executable liquidity.
    """
    parsed = decimal_or_none(value)

    if parsed is None:
        return None

    if parsed <= BOOK_SIZE_EPSILON:
        return 0.0

    return float(parsed)


def has_executable_size(
    value: Any,
) -> bool:
    parsed = decimal_or_none(value)

    return bool(
        parsed is not None
        and parsed > BOOK_SIZE_EPSILON
    )


def clamp_probability(value: Optional[float]) -> Optional[float]:
    if value is None:
        return None
    return min(1.0, max(0.0, value))


def batches(values: Sequence[str], size: int) -> Iterable[List[str]]:
    if size <= 0:
        raise ValueError("batch size must be positive")
    for index in range(0, len(values), size):
        yield list(values[index:index + size])


def best_bid(levels: Mapping[float, float]) -> Tuple[Optional[float], Optional[float]]:
    positive = [
        (price, size)
        for price, size in levels.items()
        if has_executable_size(size)
    ]
    if not positive:
        return None, None
    price, size = max(positive, key=lambda row: row[0])
    return price, size


def best_ask(levels: Mapping[float, float]) -> Tuple[Optional[float], Optional[float]]:
    positive = [
        (price, size)
        for price, size in levels.items()
        if has_executable_size(size)
    ]
    if not positive:
        return None, None
    price, size = min(positive, key=lambda row: row[0])
    return price, size


def normalize_levels(
    rows: Any,
    *,
    dict_price_key: str = "price",
    dict_size_key: str = "size",
) -> Dict[float, float]:
    result: Dict[float, float] = {}
    if not isinstance(rows, list):
        return result
    for row in rows:
        price: Optional[float]
        size: Optional[float]
        if isinstance(row, dict):
            price = float_or_none(row.get(dict_price_key))
            size = float_or_none(row.get(dict_size_key))
        elif isinstance(row, (list, tuple)) and len(row) >= 2:
            price = float_or_none(row[0])
            size = float_or_none(row[1])
        else:
            continue
        normalized_size = book_size_or_none(size)

        if (
            price is None
            or normalized_size is None
            or not has_executable_size(normalized_size)
        ):
            continue

        result[price] = normalized_size
    return result




def sorted_ask_levels(levels: Mapping[float, float]) -> List[Dict[str, float]]:
    """Return positive ask levels in executable price order."""
    rows = [
        {"price": float(price), "size": float(size)}
        for price, size in levels.items()
        if has_executable_size(size)
    ]
    rows.sort(key=lambda row: row["price"])
    return rows


def complement_bid_ask_levels(levels: Mapping[float, float]) -> List[Dict[str, float]]:
    """Convert Kalshi opposite-side bids into this side's executable asks."""
    rows = []
    for bid_price, size in levels.items():
        if not has_executable_size(size):
            continue
        ask_price = clamp_probability(1.0 - float(bid_price))
        if ask_price is None:
            continue
        rows.append({"price": float(ask_price), "size": float(size)})
    rows.sort(key=lambda row: row["price"])
    return rows


def websocket_connect(url: str, headers: Optional[Mapping[str, str]] = None):
    """Return a websockets connect context compatible with v12-v15."""
    kwargs: Dict[str, Any] = {
        "ping_interval": 20,
        "ping_timeout": 20,
        "close_timeout": 10,
        "max_queue": WS_MAX_QUEUE,
        "max_size": WS_MAX_SIZE_BYTES,
    }
    if headers:
        parameters = inspect.signature(websockets.connect).parameters
        header_name = (
            "additional_headers"
            if "additional_headers" in parameters
            else "extra_headers"
        )
        kwargs[header_name] = dict(headers)
    return websockets.connect(url, **kwargs)


@dataclass(frozen=True)
class PairSubscription:
    id: str
    market_group: str
    event_title: str
    contract_title: str
    event_key: str
    contract_key: str
    pair_relationship: str
    side_mapping: str
    polymarket_market_id: str
    polymarket_event_id: str
    polymarket_yes_asset_id: str
    polymarket_no_asset_id: str
    kalshi_market_ticker: str
    kalshi_event_ticker: str


@dataclass(frozen=True)
class StreamManifest:
    engine_version: str
    streams_version: str
    generated_at: str
    snapshot_marker: Any
    market_group: str
    pairs: Tuple[PairSubscription, ...]
    polymarket_asset_ids: Tuple[str, ...]
    kalshi_market_tickers: Tuple[str, ...]

    def summary(self) -> Dict[str, Any]:
        groups: Dict[str, int] = defaultdict(int)
        relationships: Dict[str, int] = defaultdict(int)
        for pair in self.pairs:
            groups[pair.market_group] += 1
            relationships[pair.pair_relationship] += 1
        return {
            "engineVersion": self.engine_version,
            "streamsVersion": self.streams_version,
            "generatedAt": self.generated_at,
            "snapshotMarker": self.snapshot_marker,
            "marketGroup": self.market_group,
            "pairs": len(self.pairs),
            "pairsByGroup": dict(sorted(groups.items())),
            "pairsByRelationship": dict(sorted(relationships.items())),
            "polymarketAssetIds": len(self.polymarket_asset_ids),
            "kalshiMarketTickers": len(self.kalshi_market_tickers),
            "polymarketConnections": (
                len(self.polymarket_asset_ids) + POLYMARKET_BATCH_SIZE - 1
            ) // POLYMARKET_BATCH_SIZE,
            "kalshiConnections": (
                len(self.kalshi_market_tickers) + KALSHI_BATCH_SIZE - 1
            ) // KALSHI_BATCH_SIZE,
        }


def build_stream_manifest(
    market_group: Literal["all", "sports", "macro", "weather"] = "all",
    *,
    pair_limit: Optional[int] = None,
    context: Optional[Any] = None,
) -> StreamManifest:
    # Lazy import keeps parser/self-tests usable without opening the database.
    from prediction_market_engine import ENGINE_VERSION, build_exact_pair_context

    if context is None:
        context = build_exact_pair_context(market_group)
    pairs: List[PairSubscription] = []

    for poly_contract, kalshi_contract in context.exact_pairs:
        poly_market = context.markets[poly_contract.market_id]
        kalshi_market = context.markets[kalshi_contract.market_id]
        pair_group = str(poly_contract.market_group or "unknown")
        pair_id = (
            f"{pair_group}-{poly_market.id}-{kalshi_market.id}-"
            f"{poly_contract.contract_identity}"
        )
        yes_asset = str(poly_contract.yes_key or "")
        no_asset = str(poly_contract.no_key or "")
        ticker = str(kalshi_market.external_market_id or "")
        if not yes_asset or not no_asset or not ticker:
            continue
        pairs.append(
            PairSubscription(
                id=pair_id,
                market_group=pair_group,
                event_title=str(poly_contract.event_title or ""),
                contract_title=str(poly_contract.contract_title or ""),
                event_key=str(poly_contract.event_identity or ""),
                contract_key=str(poly_contract.contract_identity or ""),
                pair_relationship=str(poly_contract.pair_relationship or "direct"),
                side_mapping=(
                    "Polymarket YES ↔ Kalshi NO"
                    if str(poly_contract.pair_relationship) == "complement"
                    else "Polymarket YES ↔ Kalshi YES"
                ),
                polymarket_market_id=str(poly_market.external_market_id or ""),
                polymarket_event_id=str(poly_market.external_event_id or ""),
                polymarket_yes_asset_id=yes_asset,
                polymarket_no_asset_id=no_asset,
                kalshi_market_ticker=ticker,
                kalshi_event_ticker=str(kalshi_market.external_event_id or ""),
            )
        )

    pairs.sort(key=lambda row: (row.market_group, row.event_title, row.contract_title, row.id))
    if pair_limit is not None:
        if pair_limit <= 0:
            raise ValueError("pair_limit must be positive")
        pairs = pairs[:pair_limit]

    asset_ids = tuple(
        dict.fromkeys(
            asset
            for pair in pairs
            for asset in (
                pair.polymarket_yes_asset_id,
                pair.polymarket_no_asset_id,
            )
            if asset
        )
    )
    tickers = tuple(
        dict.fromkeys(
            pair.kalshi_market_ticker for pair in pairs if pair.kalshi_market_ticker
        )
    )

    return StreamManifest(
        engine_version=ENGINE_VERSION,
        streams_version=STREAMS_VERSION,
        generated_at=iso_now(),
        snapshot_marker=context.snapshot_marker,
        market_group=market_group,
        pairs=tuple(pairs),
        polymarket_asset_ids=asset_ids,
        kalshi_market_tickers=tickers,
    )


@dataclass
class TokenBook:
    venue: str
    instrument_id: str
    bids: Dict[float, float] = field(default_factory=dict)
    asks: Dict[float, float] = field(default_factory=dict)
    best_bid: Optional[float] = None
    best_bid_size: Optional[float] = None
    best_ask: Optional[float] = None
    best_ask_size: Optional[float] = None
    last_trade: Optional[float] = None
    last_trade_size: Optional[float] = None
    market_id: Optional[str] = None
    sequence: Optional[int] = None
    source_timestamp: Optional[str] = None
    received_at: Optional[str] = None
    last_book_change_at: Optional[str] = None
    last_connected_at: Optional[str] = None
    last_disconnected_at: Optional[str] = None
    assigned: bool = False
    connected: bool = False
    initialized: bool = False
    resyncing: bool = False
    sequence_valid: bool = True
    market_status: str = "unknown"
    unavailable_reason: Optional[str] = "not_subscribed"
    stale: bool = True
    message_count: int = 0

    def refresh_top(self) -> None:
        self.best_bid, self.best_bid_size = best_bid(self.bids)
        self.best_ask, self.best_ask_size = best_ask(self.asks)

    def touch(
        self,
        source_timestamp: Any = None,
        *,
        snapshot: bool = False,
        book_changed: bool = True,
    ) -> None:
        now = iso_now()
        self.source_timestamp = (
            None if source_timestamp in (None, "") else str(source_timestamp)
        )
        self.received_at = now
        if book_changed:
            self.last_book_change_at = now
        if snapshot:
            self.initialized = True
            self.resyncing = False
            self.sequence_valid = True
        self.message_count += 1


@dataclass
class KalshiBinaryBook:
    venue: str
    instrument_id: str
    yes_bids: Dict[float, float] = field(default_factory=dict)
    no_bids: Dict[float, float] = field(default_factory=dict)
    yes_bid: Optional[float] = None
    yes_bid_size: Optional[float] = None
    yes_ask: Optional[float] = None
    yes_ask_size: Optional[float] = None
    no_bid: Optional[float] = None
    no_bid_size: Optional[float] = None
    no_ask: Optional[float] = None
    no_ask_size: Optional[float] = None
    last_yes_trade: Optional[float] = None
    last_trade_size: Optional[float] = None
    volume: Optional[float] = None
    open_interest: Optional[float] = None
    market_id: Optional[str] = None
    sequence: Optional[int] = None
    source_timestamp: Optional[str] = None
    received_at: Optional[str] = None
    last_book_change_at: Optional[str] = None
    last_connected_at: Optional[str] = None
    last_disconnected_at: Optional[str] = None
    assigned: bool = False
    connected: bool = False
    initialized: bool = False
    resyncing: bool = False
    sequence_valid: bool = True
    market_status: str = "unknown"
    unavailable_reason: Optional[str] = "not_subscribed"
    stale: bool = True
    message_count: int = 0

    def refresh_top(self) -> None:
        self.yes_bid, self.yes_bid_size = best_bid(self.yes_bids)
        self.no_bid, self.no_bid_size = best_bid(self.no_bids)
        self.yes_ask = (
            None if self.no_bid is None else clamp_probability(1.0 - self.no_bid)
        )
        self.yes_ask_size = self.no_bid_size
        self.no_ask = (
            None if self.yes_bid is None else clamp_probability(1.0 - self.yes_bid)
        )
        self.no_ask_size = self.yes_bid_size

    def touch(
        self,
        source_timestamp: Any = None,
        *,
        snapshot: bool = False,
        book_changed: bool = True,
    ) -> None:
        now = iso_now()
        self.source_timestamp = (
            None if source_timestamp in (None, "") else str(source_timestamp)
        )
        self.received_at = now
        if book_changed:
            self.last_book_change_at = now
        if snapshot:
            self.initialized = True
            self.resyncing = False
            self.sequence_valid = True
        self.message_count += 1


class LiveBookStore:
    """In-memory normalized state for every instrument in the manifest."""

    TERMINAL_MARKET_STATUSES = {"closed", "resolved", "settled"}

    def __init__(self, manifest: StreamManifest):
        self.manifest = manifest
        self.polymarket: Dict[str, TokenBook] = {
            asset_id: TokenBook(
                venue="polymarket",
                instrument_id=asset_id,
            )
            for asset_id in manifest.polymarket_asset_ids
        }
        self.kalshi: Dict[str, KalshiBinaryBook] = {
            ticker: KalshiBinaryBook(
                venue="kalshi",
                instrument_id=ticker,
            )
            for ticker in manifest.kalshi_market_tickers
        }
        self.venue_connected: Dict[str, bool] = {
            "polymarket": False,
            "kalshi": False,
        }
        self.connection_counts: Dict[str, int] = defaultdict(int)
        self.last_message_at: Dict[str, Optional[str]] = {
            "polymarket": None,
            "kalshi": None,
        }
        self.errors: Dict[str, str] = {}
        self.batch_members: Dict[Tuple[str, str], Tuple[str, ...]] = {}
        self.connected_batches: Dict[str, Set[str]] = defaultdict(set)
        self.revision: int = 0
        # pricing_revision changes only when executable price/depth/health can change.
        # Trade-only telemetry must not force a full reprice of every matched pair.
        self.pricing_revision: int = 0
        self._started_at = iso_now()

        # Incremental terminal pricing: map each live instrument to only the
        # matched pair(s) whose executable economics can change when that
        # instrument updates. The shared terminal publisher consumes this set
        # every cycle, so a single book tick no longer forces all matched pairs
        # to be snapshotted and repriced.
        self._pairs_by_id: Dict[str, PairSubscription] = {
            pair.id: pair for pair in manifest.pairs
        }
        self._pair_ids_by_polymarket_asset: Dict[str, Set[str]] = defaultdict(set)
        self._pair_ids_by_kalshi_ticker: Dict[str, Set[str]] = defaultdict(set)
        for pair in manifest.pairs:
            self._pair_ids_by_polymarket_asset[
                pair.polymarket_yes_asset_id
            ].add(pair.id)
            self._pair_ids_by_polymarket_asset[
                pair.polymarket_no_asset_id
            ].add(pair.id)
            self._pair_ids_by_kalshi_ticker[
                pair.kalshi_market_ticker
            ].add(pair.id)

        # The first publisher pass must establish a complete baseline.
        self._dirty_pair_ids: Set[str] = set(self._pairs_by_id)

    def release_memory(self) -> None:
        """Drop heavy live-book references after this store is retired."""
        self.polymarket.clear()
        self.kalshi.clear()
        self.errors.clear()
        self.batch_members.clear()
        self.connected_batches.clear()
        self._pairs_by_id.clear()
        self._pair_ids_by_polymarket_asset.clear()
        self._pair_ids_by_kalshi_ticker.clear()
        self._dirty_pair_ids.clear()
        self.manifest = None  # type: ignore[assignment]

    def _bump_revision(self, *, pricing: bool = True) -> None:
        self.revision += 1
        if pricing:
            self.pricing_revision += 1

    def _mark_pair_ids_dirty(self, pair_ids: Iterable[str]) -> None:
        self._dirty_pair_ids.update(
            pair_id
            for pair_id in pair_ids
            if pair_id in self._pairs_by_id
        )

    def _mark_instrument_dirty(self, venue: str, instrument_id: str) -> None:
        clean_id = str(instrument_id or "")
        if not clean_id:
            return
        if venue == "polymarket":
            self._mark_pair_ids_dirty(
                self._pair_ids_by_polymarket_asset.get(clean_id, ())
            )
        elif venue == "kalshi":
            self._mark_pair_ids_dirty(
                self._pair_ids_by_kalshi_ticker.get(clean_id, ())
            )

    def _mark_batch_dirty(self, venue: str, batch_id: str) -> None:
        for instrument_id in self.batch_members.get((venue, batch_id), ()):
            self._mark_instrument_dirty(venue, instrument_id)

    def mark_all_pairs_dirty(self) -> None:
        self._dirty_pair_ids.update(self._pairs_by_id)

    def consume_dirty_pairs(
        self,
        *,
        force_all: bool = False,
    ) -> Tuple[PairSubscription, ...]:
        """Atomically consume the currently dirty matched pairs.

        WebSocket mutation and the publisher run on the same asyncio event-loop
        thread, so a plain set swap is sufficient here. Any tick arriving while
        pricing runs in a worker thread marks the pair dirty again for the next
        publication cycle instead of being lost.
        """
        if force_all:
            pair_ids = set(self._pairs_by_id)
            self._dirty_pair_ids.clear()
        else:
            pair_ids = self._dirty_pair_ids
            self._dirty_pair_ids = set()

        if not pair_ids:
            return ()

        return tuple(
            pair
            for pair in self.manifest.pairs
            if pair.id in pair_ids
        )

    def _collection(self, venue: str) -> Dict[str, Any]:
        if venue == "polymarket":
            return self.polymarket
        if venue == "kalshi":
            return self.kalshi
        raise ValueError(f"Unsupported venue: {venue}")

    def register_batch(
        self,
        venue: str,
        batch_id: str,
        instrument_ids: Sequence[str],
    ) -> None:
        members = tuple(dict.fromkeys(str(value) for value in instrument_ids if value))
        self.batch_members[(venue, batch_id)] = members
        collection = self._collection(venue)
        for instrument_id in members:
            book = collection.get(instrument_id)
            if book is None:
                book = (
                    TokenBook(venue=venue, instrument_id=instrument_id)
                    if venue == "polymarket"
                    else KalshiBinaryBook(venue=venue, instrument_id=instrument_id)
                )
                collection[instrument_id] = book
            book.assigned = True
            if not book.connected and not book.initialized:
                book.unavailable_reason = "initializing"
            self._refresh_book_health(book)

    def set_batch_connected(
        self,
        venue: str,
        batch_id: str,
        connected: bool,
    ) -> None:
        members = self.batch_members.get((venue, batch_id), ())
        collection = self._collection(venue)
        now = iso_now()

        if connected:
            self.connected_batches[venue].add(batch_id)
        else:
            self.connected_batches[venue].discard(batch_id)

        self.connection_counts[venue] = len(self.connected_batches[venue])
        self.venue_connected[venue] = self.connection_counts[venue] > 0

        for instrument_id in members:
            book = collection[instrument_id]
            book.connected = connected
            if connected:
                book.last_connected_at = now
                if book.initialized:
                    book.resyncing = True
                    book.sequence_valid = False
                    book.unavailable_reason = "resynchronizing"
                else:
                    book.unavailable_reason = "initializing"
            else:
                book.last_disconnected_at = now
                book.resyncing = book.initialized
                book.unavailable_reason = "venue_disconnected"
            self._refresh_book_health(book)

        self._mark_batch_dirty(venue, batch_id)
        self._bump_revision()

    def mark_batch_resyncing(
        self,
        venue: str,
        batch_id: str,
        reason: str = "resynchronizing",
    ) -> None:
        members = self.batch_members.get((venue, batch_id), ())
        collection = self._collection(venue)
        for instrument_id in members:
            book = collection[instrument_id]
            book.resyncing = True
            book.sequence_valid = False
            book.unavailable_reason = reason
            self._refresh_book_health(book)
        self._mark_batch_dirty(venue, batch_id)
        self._bump_revision()

    def record_error(self, key: str, error: BaseException | str) -> None:
        value = str(error)
        if self.errors.get(key) != value:
            self.errors[key] = value
            self.mark_all_pairs_dirty()
            self._bump_revision()

    def clear_error(self, key: str) -> None:
        if key in self.errors:
            self.errors.pop(key, None)
            self.mark_all_pairs_dirty()
            self._bump_revision()

    def _poly_book(self, asset_id: str) -> TokenBook:
        book = self.polymarket.get(asset_id)
        if book is None:
            book = TokenBook(venue="polymarket", instrument_id=asset_id)
            self.polymarket[asset_id] = book
        return book

    def _kalshi_book(self, ticker: str) -> KalshiBinaryBook:
        book = self.kalshi.get(ticker)
        if book is None:
            book = KalshiBinaryBook(venue="kalshi", instrument_id=ticker)
            self.kalshi[ticker] = book
        return book

    def _refresh_book_health(self, book: Any) -> None:
        if not book.assigned:
            book.stale = True
            book.unavailable_reason = "not_subscribed"
            return
        if not book.connected:
            book.stale = True
            book.unavailable_reason = "venue_disconnected"
            return
        if book.market_status in self.TERMINAL_MARKET_STATUSES:
            book.stale = True
            book.unavailable_reason = f"market_{book.market_status}"
            return
        connection_age = age_seconds(book.last_connected_at)
        if book.resyncing or not book.sequence_valid:
            book.stale = True
            if (
                connection_age is not None
                and connection_age > INITIAL_SNAPSHOT_TIMEOUT_SECONDS
            ):
                book.unavailable_reason = "resync_failed"
            elif book.unavailable_reason not in {"sequence_gap", "resynchronizing"}:
                book.unavailable_reason = "resynchronizing"
            return
        if not book.initialized:
            book.stale = True
            if (
                connection_age is not None
                and connection_age > INITIAL_SNAPSHOT_TIMEOUT_SECONDS
            ):
                book.unavailable_reason = "snapshot_unavailable"
            else:
                book.unavailable_reason = "initializing"
            return
        book.stale = False
        book.unavailable_reason = None

    def refresh_health(self) -> None:
        """Recompute health without expiring healthy books merely for being quiet."""
        for book in self.polymarket.values():
            self._refresh_book_health(book)
        for book in self.kalshi.values():
            self._refresh_book_health(book)

    def apply_polymarket(self, payload: Mapping[str, Any]) -> None:
        event_type = str(payload.get("event_type") or payload.get("type") or "")
        source_timestamp = payload.get("timestamp")
        pricing_changed = event_type != "last_trade_price"
        dirty_assets: Set[str] = set()

        if event_type == "book":
            asset_id = str(payload.get("asset_id") or "")
            if not asset_id:
                return
            book = self._poly_book(asset_id)
            dirty_assets.add(asset_id)
            book.market_id = str(payload.get("market") or "") or book.market_id
            book.bids = normalize_levels(payload.get("bids"))
            book.asks = normalize_levels(payload.get("asks"))
            book.refresh_top()
            book.touch(source_timestamp, snapshot=True)
            self._refresh_book_health(book)

        elif event_type == "price_change":
            changes = payload.get("price_changes")
            if not isinstance(changes, list):
                return
            for change in changes:
                if not isinstance(change, dict):
                    continue
                asset_id = str(change.get("asset_id") or "")
                if not asset_id:
                    continue
                book = self._poly_book(asset_id)
                dirty_assets.add(asset_id)
                book.market_id = str(payload.get("market") or "") or book.market_id
                price = float_or_none(change.get("price"))
                size = float_or_none(change.get("size"))
                side = str(change.get("side") or "").upper()
                if price is not None and size is not None:
                    target = book.bids if side == "BUY" else book.asks
                    if size <= 0:
                        target.pop(price, None)
                    else:
                        target[price] = size
                supplied_bid = float_or_none(change.get("best_bid"))
                supplied_ask = float_or_none(change.get("best_ask"))
                book.refresh_top()
                if supplied_bid is not None:
                    book.best_bid = supplied_bid
                if supplied_ask is not None:
                    book.best_ask = supplied_ask
                book.touch(source_timestamp)
                self._refresh_book_health(book)

        elif event_type == "best_bid_ask":
            asset_id = str(payload.get("asset_id") or "")
            if not asset_id:
                return
            book = self._poly_book(asset_id)
            dirty_assets.add(asset_id)
            book.market_id = str(payload.get("market") or "") or book.market_id
            book.best_bid = float_or_none(payload.get("best_bid"))
            book.best_ask = float_or_none(payload.get("best_ask"))
            book.touch(source_timestamp, book_changed=False)
            self._refresh_book_health(book)

        elif event_type == "last_trade_price":
            asset_id = str(payload.get("asset_id") or "")
            if not asset_id:
                return
            book = self._poly_book(asset_id)
            book.market_id = str(payload.get("market") or "") or book.market_id
            book.last_trade = float_or_none(payload.get("price"))
            book.last_trade_size = float_or_none(payload.get("size"))
            book.touch(source_timestamp, book_changed=False)
            self._refresh_book_health(book)

        elif event_type == "market_resolved":
            assets = payload.get("assets_ids") or payload.get("token_ids") or []
            if isinstance(assets, list):
                for asset in assets:
                    asset_id = str(asset)
                    book = self._poly_book(asset_id)
                    dirty_assets.add(asset_id)
                    book.market_status = "resolved"
                    book.touch(source_timestamp, book_changed=False)
                    self._refresh_book_health(book)
        else:
            return

        self.last_message_at["polymarket"] = iso_now()
        if pricing_changed:
            for asset_id in dirty_assets:
                self._mark_instrument_dirty("polymarket", asset_id)
        self._bump_revision(pricing=pricing_changed)

    def apply_kalshi(self, payload: Mapping[str, Any]) -> None:
        event_type = str(payload.get("type") or "")
        pricing_changed = event_type != "trade"
        msg = payload.get("msg")
        if not isinstance(msg, dict):
            return
        ticker = str(msg.get("market_ticker") or msg.get("ticker") or "")
        if not ticker:
            return
        book = self._kalshi_book(ticker)
        book.market_id = str(msg.get("market_id") or "") or book.market_id
        sequence = payload.get("seq")
        if isinstance(sequence, int):
            book.sequence = sequence

        market_status = str(msg.get("status") or "").strip().lower()
        if market_status:
            book.market_status = market_status

        if event_type == "orderbook_snapshot":
            yes_rows = msg.get("yes_dollars_fp") or msg.get("yes") or []
            no_rows = msg.get("no_dollars_fp") or msg.get("no") or []
            book.yes_bids = normalize_levels(yes_rows)
            book.no_bids = normalize_levels(no_rows)
            book.refresh_top()
            book.touch(msg.get("ts_ms") or msg.get("ts"), snapshot=True)
            self._refresh_book_health(book)

        elif event_type == "orderbook_delta":
            price = float_or_none(
                msg.get("price_dollars")
                or msg.get("price")
            )
            delta = decimal_or_none(
                msg.get("delta_fp")
                or msg.get("delta")
            )
            side = str(
                msg.get("side")
                or ""
            ).lower()

            if (
                price is None
                or delta is None
                or side not in {"yes", "no"}
            ):
                return

            target = (
                book.yes_bids
                if side == "yes"
                else book.no_bids
            )

            current = (
                decimal_or_none(
                    target.get(price, 0.0)
                )
                or Decimal("0")
            )

            updated = current + delta

            if updated <= BOOK_SIZE_EPSILON:
                target.pop(price, None)
            else:
                target[price] = float(updated)

            book.refresh_top()
            book.touch(msg.get("ts_ms") or msg.get("ts"))
            self._refresh_book_health(book)

        elif event_type == "ticker":
            yes_bid = float_or_none(msg.get("yes_bid_dollars"))
            yes_ask = float_or_none(msg.get("yes_ask_dollars"))
            yes_bid_size = book_size_or_none(
                msg.get("yes_bid_size_fp")
            )
            yes_ask_size = book_size_or_none(
                msg.get("yes_ask_size_fp")
            )
            if yes_bid is not None:
                book.yes_bid = yes_bid
                book.yes_bid_size = yes_bid_size
                book.no_ask = clamp_probability(1.0 - yes_bid)
                book.no_ask_size = yes_bid_size
            if yes_ask is not None:
                book.yes_ask = yes_ask
                book.yes_ask_size = yes_ask_size
                book.no_bid = clamp_probability(1.0 - yes_ask)
                book.no_bid_size = yes_ask_size
            book.last_yes_trade = float_or_none(msg.get("price_dollars"))
            book.volume = float_or_none(msg.get("volume_fp"))
            book.open_interest = float_or_none(msg.get("open_interest_fp"))
            book.touch(
                msg.get("ts_ms") or msg.get("time") or msg.get("ts"),
                book_changed=False,
            )
            self._refresh_book_health(book)

        elif event_type == "trade":
            book.last_yes_trade = float_or_none(msg.get("yes_price_dollars"))
            book.last_trade_size = float_or_none(msg.get("count_fp"))
            book.touch(
                msg.get("ts_ms") or msg.get("ts"),
                book_changed=False,
            )
            self._refresh_book_health(book)
        else:
            return

        self.last_message_at["kalshi"] = iso_now()
        if pricing_changed:
            self._mark_instrument_dirty("kalshi", ticker)
        self._bump_revision(pricing=pricing_changed)

    @staticmethod
    def _base_book_state(book: Optional[Any]) -> Tuple[str, Optional[str]]:
        if book is None:
            return "unavailable", "not_subscribed"
        if book.stale:
            return "unavailable", book.unavailable_reason or "unavailable"
        return "ready", None

    @classmethod
    def _side_state(
        cls,
        book: Optional[Any],
        ask: Optional[float],
        size: Optional[float],
    ) -> Dict[str, Any]:
        status, reason = cls._base_book_state(book)
        if status != "ready":
            return {
                "status": status,
                "reason": reason,
                "executable": False,
            }
        if ask is None:
            return {
                "status": "unavailable",
                "reason": "missing_ask",
                "executable": False,
            }
        if not has_executable_size(size):
            return {
                "status": "unavailable",
                "reason": "zero_depth",
                "executable": False,
            }
        return {
            "status": "ready",
            "reason": None,
            "executable": True,
        }

    @staticmethod
    def _token_quote(book: Optional[TokenBook]) -> Dict[str, Any]:
        if book is None:
            return {
                "bestBid": None,
                "bestBidSize": None,
                "bestAsk": None,
                "bestAskSize": None,
                "askLevels": [],
                "lastTrade": None,
                "receivedAt": None,
                "sourceTimestamp": None,
                "initialized": False,
                "connected": False,
                "resyncing": False,
                "sequenceValid": False,
                "marketStatus": "unknown",
                "unavailableReason": "not_subscribed",
                "stale": True,
            }
        return {
            "bestBid": book.best_bid,
            "bestBidSize": book.best_bid_size,
            "bestAsk": book.best_ask,
            "bestAskSize": book.best_ask_size,
            "askLevels": sorted_ask_levels(book.asks),
            "lastTrade": book.last_trade,
            "lastTradeSize": book.last_trade_size,
            "receivedAt": book.received_at,
            "sourceTimestamp": book.source_timestamp,
            "lastBookChangeAt": book.last_book_change_at,
            "initialized": book.initialized,
            "connected": book.connected,
            "resyncing": book.resyncing,
            "sequenceValid": book.sequence_valid,
            "marketStatus": book.market_status,
            "unavailableReason": book.unavailable_reason,
            "stale": book.stale,
        }

    @staticmethod
    def _kalshi_quote(book: Optional[KalshiBinaryBook]) -> Dict[str, Any]:
        if book is None:
            return {
                "yesBid": None,
                "yesBidSize": None,
                "yesAsk": None,
                "yesAskSize": None,
                "yesAskLevels": [],
                "noBid": None,
                "noBidSize": None,
                "noAsk": None,
                "noAskSize": None,
                "noAskLevels": [],
                "lastYesTrade": None,
                "volume": None,
                "openInterest": None,
                "receivedAt": None,
                "sourceTimestamp": None,
                "initialized": False,
                "connected": False,
                "resyncing": False,
                "sequenceValid": False,
                "marketStatus": "unknown",
                "unavailableReason": "not_subscribed",
                "stale": True,
            }
        return {
            "yesBid": book.yes_bid,
            "yesBidSize": book.yes_bid_size,
            "yesAsk": book.yes_ask,
            "yesAskSize": book.yes_ask_size,
            "yesAskLevels": complement_bid_ask_levels(book.no_bids),
            "noBid": book.no_bid,
            "noBidSize": book.no_bid_size,
            "noAsk": book.no_ask,
            "noAskSize": book.no_ask_size,
            "noAskLevels": complement_bid_ask_levels(book.yes_bids),
            "lastYesTrade": book.last_yes_trade,
            "lastTradeSize": book.last_trade_size,
            "volume": book.volume,
            "openInterest": book.open_interest,
            "receivedAt": book.received_at,
            "sourceTimestamp": book.source_timestamp,
            "lastBookChangeAt": book.last_book_change_at,
            "initialized": book.initialized,
            "connected": book.connected,
            "resyncing": book.resyncing,
            "sequenceValid": book.sequence_valid,
            "marketStatus": book.market_status,
            "unavailableReason": book.unavailable_reason,
            "stale": book.stale,
        }

    @classmethod
    def _route_state(
        cls,
        *,
        key: str,
        description: str,
        polymarket_side: str,
        polymarket_book: Optional[TokenBook],
        kalshi_side: str,
        kalshi_book: Optional[KalshiBinaryBook],
    ) -> Dict[str, Any]:
        poly_ask = polymarket_book.best_ask if polymarket_book else None
        poly_size = polymarket_book.best_ask_size if polymarket_book else None
        kalshi_ask = (
            kalshi_book.yes_ask
            if kalshi_side == "yes" and kalshi_book
            else kalshi_book.no_ask
            if kalshi_book
            else None
        )
        kalshi_size = (
            kalshi_book.yes_ask_size
            if kalshi_side == "yes" and kalshi_book
            else kalshi_book.no_ask_size
            if kalshi_book
            else None
        )
        poly_state = cls._side_state(polymarket_book, poly_ask, poly_size)
        kalshi_state = cls._side_state(kalshi_book, kalshi_ask, kalshi_size)
        executable = bool(poly_state["executable"] and kalshi_state["executable"])
        reasons = [
            value
            for value in (poly_state.get("reason"), kalshi_state.get("reason"))
            if value
        ]
        executable_contracts = (
            min(float(poly_size), float(kalshi_size))
            if executable and poly_size is not None and kalshi_size is not None
            else 0.0
        )
        return {
            "key": key,
            "description": description,
            "status": "ready" if executable else "unavailable",
            "reason": None if executable else (reasons[0] if reasons else "unavailable"),
            "reasons": list(dict.fromkeys(reasons)),
            "executable": executable,
            "executableContracts": executable_contracts,
            "polymarket": {
                "side": polymarket_side,
                "ask": poly_ask,
                "askSize": poly_size,
                **poly_state,
            },
            "kalshi": {
                "side": kalshi_side,
                "ask": kalshi_ask,
                "askSize": kalshi_size,
                **kalshi_state,
            },
        }

    def pair_snapshot(
        self,
        pair: PairSubscription,
        *,
        refresh_health: bool = True,
    ) -> Dict[str, Any]:
        if refresh_health:
            self.refresh_health()
        poly_yes_book = self.polymarket.get(pair.polymarket_yes_asset_id)
        poly_no_book = self.polymarket.get(pair.polymarket_no_asset_id)
        kalshi_book = self.kalshi.get(pair.kalshi_market_ticker)
        poly_yes = self._token_quote(poly_yes_book)
        poly_no = self._token_quote(poly_no_book)
        kalshi = self._kalshi_quote(kalshi_book)

        if pair.pair_relationship == "complement":
            route_specs = (
                (
                    "polymarket_yes_kalshi_yes",
                    "Buy Polymarket YES + Kalshi YES",
                    "yes",
                    poly_yes_book,
                    "yes",
                ),
                (
                    "polymarket_no_kalshi_no",
                    "Buy Polymarket NO + Kalshi NO",
                    "no",
                    poly_no_book,
                    "no",
                ),
            )
        else:
            route_specs = (
                (
                    "polymarket_yes_kalshi_no",
                    "Buy Polymarket YES + Kalshi NO",
                    "yes",
                    poly_yes_book,
                    "no",
                ),
                (
                    "polymarket_no_kalshi_yes",
                    "Buy Polymarket NO + Kalshi YES",
                    "no",
                    poly_no_book,
                    "yes",
                ),
            )

        route_states = [
            self._route_state(
                key=key,
                description=description,
                polymarket_side=poly_side,
                polymarket_book=poly_book,
                kalshi_side=kalshi_side,
                kalshi_book=kalshi_book,
            )
            for key, description, poly_side, poly_book, kalshi_side in route_specs
        ]
        ready_routes = sum(int(route["executable"]) for route in route_states)
        pair_status = (
            "ready"
            if ready_routes == 2
            else "partially_ready"
            if ready_routes == 1
            else "unavailable"
        )

        return {
            **asdict(pair),
            "polymarket": {
                "marketId": pair.polymarket_market_id,
                "yesAssetId": pair.polymarket_yes_asset_id,
                "noAssetId": pair.polymarket_no_asset_id,
                "yes": poly_yes,
                "no": poly_no,
            },
            "kalshi": {
                "marketTicker": pair.kalshi_market_ticker,
                **kalshi,
            },
            "routeStates": route_states,
            "readyRouteCount": ready_routes,
            "pairStatus": pair_status,
            "anyRouteReady": ready_routes > 0,
            # Compatibility only. The engine will stop depending on this in the
            # next stage; for now it means both routes are fully executable.
            "liveComplete": ready_routes == 2,
        }

    def pair_snapshots(
        self,
        pairs: Optional[Sequence[PairSubscription]] = None,
        *,
        refresh_health: bool = True,
    ) -> List[Dict[str, Any]]:
        if refresh_health:
            self.refresh_health()
        selected_pairs = self.manifest.pairs if pairs is None else pairs
        return [
            self.pair_snapshot(pair, refresh_health=False)
            for pair in selected_pairs
        ]

    def status(
        self,
        *,
        snapshots: Optional[Sequence[Dict[str, Any]]] = None,
    ) -> Dict[str, Any]:
        # The shared terminal publisher already captured every pair. Reuse that
        # same immutable capture when supplied instead of rebuilding all pair
        # snapshots a second time in the same publication cycle.
        if snapshots is None:
            self.refresh_health()
            snapshot_rows: Sequence[Dict[str, Any]] = [
                self.pair_snapshot(pair, refresh_health=False)
                for pair in self.manifest.pairs
            ]
        else:
            snapshot_rows = snapshots

        fully_ready_pairs = sum(row["readyRouteCount"] == 2 for row in snapshot_rows)
        partially_ready_pairs = sum(row["readyRouteCount"] == 1 for row in snapshot_rows)
        unavailable_pairs = sum(row["readyRouteCount"] == 0 for row in snapshot_rows)
        ready_routes = sum(row["readyRouteCount"] for row in snapshot_rows)
        route_reason_counts: Dict[str, int] = defaultdict(int)
        for snapshot in snapshot_rows:
            for route in snapshot["routeStates"]:
                if route["reason"]:
                    route_reason_counts[str(route["reason"])] += 1

        poly_initialized = sum(book.initialized for book in self.polymarket.values())
        poly_ready = sum(not book.stale for book in self.polymarket.values())
        kalshi_initialized = sum(book.initialized for book in self.kalshi.values())
        kalshi_ready = sum(not book.stale for book in self.kalshi.values())

        return {
            "streamsVersion": STREAMS_VERSION,
            "engineVersion": self.manifest.engine_version,
            "startedAt": self._started_at,
            "generatedAt": iso_now(),
            "revision": self.revision,
            "pricingRevision": self.pricing_revision,
            "venueConnected": dict(self.venue_connected),
            "connectionCounts": dict(self.connection_counts),
            "lastMessageAt": dict(self.last_message_at),
            "errors": dict(self.errors),
            "websocketBuffer": {
                "maxQueue": WS_MAX_QUEUE,
                "maxSizeBytes": WS_MAX_SIZE_BYTES,
            },
            "manifest": self.manifest.summary(),
            "polymarketBooks": len(self.polymarket),
            "polymarketExpectedBooks": len(self.manifest.polymarket_asset_ids),
            "polymarketInitializedBooks": poly_initialized,
            "polymarketReadyBooks": poly_ready,
            "polymarketFreshBooks": poly_ready,
            "kalshiBooks": len(self.kalshi),
            "kalshiExpectedBooks": len(self.manifest.kalshi_market_tickers),
            "kalshiInitializedBooks": kalshi_initialized,
            "kalshiReadyBooks": kalshi_ready,
            "kalshiFreshBooks": kalshi_ready,
            "totalRoutes": len(self.manifest.pairs) * 2,
            "readyRoutes": ready_routes,
            "fullyReadyPairs": fully_ready_pairs,
            "partiallyReadyPairs": partially_ready_pairs,
            "unavailablePairs": unavailable_pairs,
            "routeUnavailableReasons": dict(sorted(route_reason_counts.items())),
            "liveCompletePairs": fully_ready_pairs,
        }


class BaseReconnectStream:
    def __init__(
        self,
        venue: str,
        store: LiveBookStore,
        batch_id: str,
        instrument_ids: Sequence[str],
    ):
        self.venue = venue
        self.store = store
        self.batch_id = batch_id
        self.instrument_ids = list(instrument_ids)
        self.stop_event = asyncio.Event()
        self.error_key = f"{venue}:{batch_id}"
        self.store.register_batch(venue, batch_id, self.instrument_ids)

    async def stop(self) -> None:
        self.stop_event.set()

    async def run_forever(self) -> None:
        attempt = 0
        while not self.stop_event.is_set():
            try:
                await self.run_once()
                attempt = 0
            except asyncio.CancelledError:
                raise
            except Exception as exc:  # noqa: BLE001 - stream must self-heal
                self.store.record_error(self.error_key, exc)
                self.store.mark_batch_resyncing(
                    self.venue,
                    self.batch_id,
                    "resynchronizing",
                )
                attempt += 1
                delay = min(
                    MAX_RECONNECT_SECONDS,
                    (2 ** min(attempt, 6)) + random.random(),
                )
                LOGGER.warning(
                    "%s stream %s failed (%s). Reconnecting in %.1fs.",
                    self.venue,
                    self.batch_id,
                    exc,
                    delay,
                )
                try:
                    await asyncio.wait_for(self.stop_event.wait(), timeout=delay)
                except asyncio.TimeoutError:
                    pass

    async def run_once(self) -> None:
        raise NotImplementedError


class PolymarketBatchStream(BaseReconnectStream):
    def __init__(
        self,
        store: LiveBookStore,
        asset_ids: Sequence[str],
        batch_number: int,
    ):
        self.asset_ids = list(asset_ids)
        self.batch_number = batch_number
        super().__init__(
            "polymarket",
            store,
            f"batch-{batch_number}",
            self.asset_ids,
        )

    async def _heartbeat(self, websocket: Any) -> None:
        while not self.stop_event.is_set():
            await asyncio.sleep(10)
            await websocket.send("PING")

    async def run_once(self) -> None:
        async with websocket_connect(POLYMARKET_MARKET_WS_URL) as websocket:
            self.store.set_batch_connected(self.venue, self.batch_id, True)
            self.store.clear_error(self.error_key)
            LOGGER.info(
                "Polymarket batch %d connected with %d assets.",
                self.batch_number,
                len(self.asset_ids),
            )
            heartbeat = asyncio.create_task(self._heartbeat(websocket))
            try:
                await websocket.send(
                    json.dumps(
                        {
                            "assets_ids": self.asset_ids,
                            "type": "market",
                            "custom_feature_enabled": True,
                        }
                    )
                )
                async for raw_message in websocket:
                    if self.stop_event.is_set():
                        break
                    if raw_message in {"PONG", "PING"}:
                        if raw_message == "PING":
                            await websocket.send("PONG")
                        continue
                    try:
                        decoded = json.loads(raw_message)
                    except (json.JSONDecodeError, TypeError):
                        continue
                    messages = decoded if isinstance(decoded, list) else [decoded]
                    for message in messages:
                        if isinstance(message, dict):
                            self.store.apply_polymarket(message)
            finally:
                heartbeat.cancel()
                await asyncio.gather(heartbeat, return_exceptions=True)
                self.store.set_batch_connected(self.venue, self.batch_id, False)


class KalshiCredentials:
    def __init__(
        self,
        api_key_id: str,
        private_key: rsa.RSAPrivateKey,
        environment: str,
    ):
        self.api_key_id = api_key_id
        self.private_key = private_key
        self.environment = environment

    @property
    def websocket_url(self) -> str:
        return (
            KALSHI_DEMO_WS_URL
            if self.environment == "demo"
            else KALSHI_PRODUCTION_WS_URL
        )

    def headers(self) -> Dict[str, str]:
        timestamp = str(int(time.time() * 1000))
        message = f"{timestamp}GET{KALSHI_WS_SIGN_PATH}".encode("utf-8")
        signature = self.private_key.sign(
            message,
            padding.PSS(
                mgf=padding.MGF1(hashes.SHA256()),
                salt_length=padding.PSS.DIGEST_LENGTH,
            ),
            hashes.SHA256(),
        )
        return {
            "KALSHI-ACCESS-KEY": self.api_key_id,
            "KALSHI-ACCESS-SIGNATURE": base64.b64encode(signature).decode("utf-8"),
            "KALSHI-ACCESS-TIMESTAMP": timestamp,
        }

    @classmethod
    def from_environment(cls, *, required: bool = True) -> Optional["KalshiCredentials"]:
        api_key_id = os.getenv("KALSHI_API_KEY_ID", "").strip()
        key_path = os.getenv("KALSHI_PRIVATE_KEY_PATH", "").strip()
        key_pem = os.getenv("KALSHI_PRIVATE_KEY_PEM", "").strip()
        environment = os.getenv("KALSHI_WS_ENV", "production").strip().lower()
        if environment not in {"production", "demo"}:
            raise StreamConfigurationError(
                "KALSHI_WS_ENV must be 'production' or 'demo'."
            )
        if not api_key_id or (not key_path and not key_pem):
            if required:
                raise StreamConfigurationError(
                    "Kalshi WebSocket credentials are missing. Set "
                    "KALSHI_API_KEY_ID and KALSHI_PRIVATE_KEY_PATH "
                    "(or KALSHI_PRIVATE_KEY_PEM)."
                )
            return None
        if key_path:
            path = Path(key_path).expanduser().resolve()
            if not path.exists():
                raise StreamConfigurationError(
                    f"Kalshi private key file not found: {path}"
                )
            pem_bytes = path.read_bytes()
        else:
            pem_bytes = key_pem.replace("\\n", "\n").encode("utf-8")
        private_key = serialization.load_pem_private_key(
            pem_bytes,
            password=None,
            backend=default_backend(),
        )
        if not isinstance(private_key, rsa.RSAPrivateKey):
            raise StreamConfigurationError("Kalshi private key must be an RSA key.")
        return cls(api_key_id, private_key, environment)


class KalshiBatchStream(BaseReconnectStream):
    def __init__(
        self,
        store: LiveBookStore,
        market_tickers: Sequence[str],
        credentials: KalshiCredentials,
        batch_number: int,
    ):
        self.market_tickers = list(market_tickers)
        self.credentials = credentials
        self.batch_number = batch_number
        self._request_id = batch_number * 1000
        self._last_sequence_by_sid: Dict[int, int] = {}
        self._subscription_sid: Optional[int] = None
        self._snapshot_request_ids: Set[int] = set()
        super().__init__(
            "kalshi",
            store,
            f"batch-{batch_number}",
            self.market_tickers,
        )

    def next_id(self) -> int:
        self._request_id += 1
        return self._request_id

    def check_sequence(self, payload: Mapping[str, Any]) -> None:
        event_type = str(payload.get("type") or "")
        if event_type not in {"orderbook_snapshot", "orderbook_delta"}:
            return
        sid = payload.get("sid")
        seq = payload.get("seq")
        if not isinstance(sid, int) or not isinstance(seq, int):
            return
        if self._subscription_sid is None:
            self._subscription_sid = sid
        previous = self._last_sequence_by_sid.get(sid)
        if event_type == "orderbook_snapshot" or previous is None:
            self._last_sequence_by_sid[sid] = seq
            return
        if seq != previous + 1:
            self.store.mark_batch_resyncing(
                self.venue,
                self.batch_id,
                "sequence_gap",
            )
            raise SequenceGapError(
                f"Kalshi sequence gap on sid {sid}: "
                f"expected {previous + 1}, received {seq}"
            )
        self._last_sequence_by_sid[sid] = seq

    def _capture_subscription_sid(self, payload: Mapping[str, Any]) -> None:
        if str(payload.get("type") or "") != "subscribed":
            return
        msg = payload.get("msg")
        if not isinstance(msg, dict):
            return
        if str(msg.get("channel") or "") != "orderbook_delta":
            return
        sid = msg.get("sid")
        if isinstance(sid, int):
            self._subscription_sid = sid

    def _snapshot_recovery_tickers(self) -> List[str]:
        result: List[str] = []
        for ticker in self.market_tickers:
            book = self.store.kalshi.get(ticker)
            if book is None or not book.connected:
                continue
            connection_age = age_seconds(book.last_connected_at)
            if (
                connection_age is None
                or connection_age < KALSHI_SNAPSHOT_RECOVERY_AFTER_SECONDS
            ):
                continue
            if not book.initialized or book.resyncing or not book.sequence_valid:
                result.append(ticker)
        return result

    async def _request_fresh_snapshots(
        self,
        websocket: Any,
        market_tickers: Sequence[str],
    ) -> None:
        sid = self._subscription_sid
        if not isinstance(sid, int) or not market_tickers:
            return

        for ticker_batch in batches(
            list(dict.fromkeys(market_tickers)),
            KALSHI_SNAPSHOT_REQUEST_CHUNK_SIZE,
        ):
            request_id = self.next_id()
            self._snapshot_request_ids.add(request_id)
            # Keep diagnostic bookkeeping bounded during long-running sessions.
            if len(self._snapshot_request_ids) > 512:
                self._snapshot_request_ids.clear()
                self._snapshot_request_ids.add(request_id)
            await websocket.send(
                json.dumps(
                    {
                        "id": request_id,
                        "cmd": "update_subscription",
                        "params": {
                            "sids": [sid],
                            "market_tickers": ticker_batch,
                            "action": "get_snapshot",
                        },
                    }
                )
            )

    async def _snapshot_recovery_loop(self, websocket: Any) -> None:
        while not self.stop_event.is_set():
            await asyncio.sleep(KALSHI_SNAPSHOT_RECOVERY_INTERVAL_SECONDS)
            recovery_tickers = self._snapshot_recovery_tickers()
            if not recovery_tickers:
                continue

            LOGGER.warning(
                "Kalshi batch %d requesting fresh snapshots for %d/%d markets.",
                self.batch_number,
                len(recovery_tickers),
                len(self.market_tickers),
            )
            try:
                await self._request_fresh_snapshots(websocket, recovery_tickers)
            except asyncio.CancelledError:
                raise
            except Exception as exc:  # noqa: BLE001 - force a clean socket rebuild
                LOGGER.warning(
                    "Kalshi batch %d snapshot recovery send failed (%s); reconnecting.",
                    self.batch_number,
                    exc,
                )
                await websocket.close(
                    code=1012,
                    reason="Bullionaire snapshot recovery send failed",
                )
                return

            oldest_age = max(
                (
                    age_seconds(self.store.kalshi[ticker].last_connected_at) or 0.0
                    for ticker in recovery_tickers
                    if ticker in self.store.kalshi
                ),
                default=0.0,
            )
            if oldest_age >= KALSHI_SNAPSHOT_FORCE_RECONNECT_SECONDS:
                LOGGER.warning(
                    "Kalshi batch %d still has %d unrecovered books after %.1fs; "
                    "forcing a clean reconnect/resubscribe.",
                    self.batch_number,
                    len(recovery_tickers),
                    oldest_age,
                )
                await websocket.close(
                    code=1012,
                    reason="Bullionaire snapshot recovery",
                )
                return

    async def subscribe(self, websocket: Any) -> None:
        await websocket.send(
            json.dumps(
                {
                    "id": self.next_id(),
                    "cmd": "subscribe",
                    "params": {
                        "channels": ["orderbook_delta"],
                        "market_tickers": self.market_tickers,

                        # Bullionaire currently maintains Kalshi's legacy
                        # two-sided orderbook convention:
                        #
                        # YES levels are YES prices.
                        # NO levels are NO prices.
                        #
                        # Be explicit so a Kalshi default change cannot
                        # silently change our price interpretation.
                        "use_yes_price": False,
                    },
                }
            )
        )

    async def run_once(self) -> None:
        self._last_sequence_by_sid.clear()
        self._subscription_sid = None
        self._snapshot_request_ids.clear()
        headers = self.credentials.headers()
        async with websocket_connect(
            self.credentials.websocket_url,
            headers,
        ) as websocket:
            self.store.set_batch_connected(self.venue, self.batch_id, True)
            self.store.clear_error(self.error_key)
            LOGGER.info(
                "Kalshi batch %d connected with %d markets.",
                self.batch_number,
                len(self.market_tickers),
            )
            recovery_task: Optional[asyncio.Task[Any]] = None
            try:
                await self.subscribe(websocket)
                recovery_task = asyncio.create_task(
                    self._snapshot_recovery_loop(websocket),
                    name=f"kalshi-snapshot-recovery-{self.batch_number}",
                )
                async for raw_message in websocket:
                    if self.stop_event.is_set():
                        break
                    try:
                        message = json.loads(raw_message)
                    except (json.JSONDecodeError, TypeError):
                        continue
                    if not isinstance(message, dict):
                        continue

                    self._capture_subscription_sid(message)

                    message_type = str(message.get("type") or "")
                    message_id = message.get("id")
                    if message_type == "error":
                        # Snapshot-refresh errors are recoverable. Initial
                        # subscription/transport errors still rebuild the batch.
                        if (
                            isinstance(message_id, int)
                            and message_id in self._snapshot_request_ids
                        ):
                            self._snapshot_request_ids.discard(message_id)
                            LOGGER.warning(
                                "Kalshi batch %d snapshot refresh request failed: %s",
                                self.batch_number,
                                message.get("msg"),
                            )
                            continue
                        raise RuntimeError(
                            f"Kalshi WebSocket error: {message.get('msg')}"
                        )
                    if message_type == "ok" and isinstance(message_id, int):
                        self._snapshot_request_ids.discard(message_id)

                    self.check_sequence(message)
                    self.store.apply_kalshi(message)
            finally:
                if recovery_task is not None:
                    recovery_task.cancel()
                    await asyncio.gather(recovery_task, return_exceptions=True)
                self.store.set_batch_connected(self.venue, self.batch_id, False)


class PredictionMarketStreamManager:
    def __init__(
        self,
        manifest: StreamManifest,
        *,
        enable_polymarket: bool = True,
        enable_kalshi: bool = True,
        require_kalshi_credentials: bool = False,
    ):
        self.manifest = manifest
        self.store = LiveBookStore(manifest)
        self.enable_polymarket = enable_polymarket
        self.enable_kalshi = enable_kalshi
        self.require_kalshi_credentials = require_kalshi_credentials
        self.streams: List[BaseReconnectStream] = []
        self.tasks: List[asyncio.Task[Any]] = []
        self._build_streams()

    def _build_streams(self) -> None:
        if self.enable_polymarket:
            for number, asset_batch in enumerate(
                batches(list(self.manifest.polymarket_asset_ids), POLYMARKET_BATCH_SIZE),
                start=1,
            ):
                self.streams.append(
                    PolymarketBatchStream(self.store, asset_batch, number)
                )

        if self.enable_kalshi:
            credentials = KalshiCredentials.from_environment(
                required=self.require_kalshi_credentials
            )
            if credentials is None:
                LOGGER.warning(
                    "Kalshi credentials are absent; running Polymarket-only. "
                    "Kalshi routes will report venue_disconnected until credentials are configured."
                )
                self.store.record_error(
                    "kalshi",
                    "Credentials absent; Kalshi stream disabled.",
                )
            else:
                for number, ticker_batch in enumerate(
                    batches(list(self.manifest.kalshi_market_tickers), KALSHI_BATCH_SIZE),
                    start=1,
                ):
                    self.streams.append(
                        KalshiBatchStream(
                            self.store,
                            ticker_batch,
                            credentials,
                            number,
                        )
                    )

    async def start(self) -> None:
        if self.tasks:
            return
        self.tasks = [
            asyncio.create_task(stream.run_forever(), name=f"{stream.venue}-stream-{i}")
            for i, stream in enumerate(self.streams, start=1)
        ]

    async def stop(self) -> None:
        for stream in self.streams:
            await stream.stop()
        for task in self.tasks:
            task.cancel()
        if self.tasks:
            await asyncio.gather(*self.tasks, return_exceptions=True)
        self.tasks.clear()

        # A stopped manager is never restarted. Sever the old full-book graph
        # immediately so a hot reload does not depend on allocator timing.
        self.streams.clear()
        self.store.release_memory()
        self.manifest = None  # type: ignore[assignment]

    async def run_until_stopped(self) -> None:
        await self.start()
        stop_event = asyncio.Event()
        loop = asyncio.get_running_loop()
        for signal_name in (signal.SIGINT, signal.SIGTERM):
            try:
                loop.add_signal_handler(signal_name, stop_event.set)
            except (NotImplementedError, RuntimeError):
                pass
        try:
            while not stop_event.is_set():
                await asyncio.sleep(5)
                LOGGER.info("Stream status: %s", json.dumps(self.store.status()))
        finally:
            await self.stop()


def self_test() -> Dict[str, Any]:
    pair = PairSubscription(
        id="test-pair",
        market_group="sports",
        event_title="Test A vs. Test B",
        contract_title="Test A to win",
        event_key="test-event",
        contract_key="test-contract",
        pair_relationship="direct",
        side_mapping="Polymarket YES ↔ Kalshi YES",
        polymarket_market_id="condition-1",
        polymarket_event_id="event-1",
        polymarket_yes_asset_id="poly-yes",
        polymarket_no_asset_id="poly-no",
        kalshi_market_ticker="KXTEST",
        kalshi_event_ticker="KXTESTEVENT",
    )
    dummy_manifest = StreamManifest(
        engine_version="test",
        streams_version=STREAMS_VERSION,
        generated_at=iso_now(),
        snapshot_marker=None,
        market_group="all",
        pairs=(pair,),
        polymarket_asset_ids=("poly-yes", "poly-no"),
        kalshi_market_tickers=("KXTEST",),
    )
    store = LiveBookStore(dummy_manifest)
    store.register_batch("polymarket", "batch-1", ("poly-yes", "poly-no"))
    store.register_batch("kalshi", "batch-1", ("KXTEST",))
    store.set_batch_connected("polymarket", "batch-1", True)
    store.set_batch_connected("kalshi", "batch-1", True)

    initial_dirty = store.consume_dirty_pairs()
    assert [item.id for item in initial_dirty] == ["test-pair"]

    for asset_id, bid, ask in (
        ("poly-yes", "0.48", "0.51"),
        ("poly-no", "0.47", "0.52"),
    ):
        store.apply_polymarket(
            {
                "event_type": "book",
                "market": "condition-1",
                "asset_id": asset_id,
                "timestamp": "1000",
                "bids": [{"price": bid, "size": "50"}],
                "asks": [{"price": ask, "size": "40"}],
            }
        )

    store.apply_kalshi(
        {
            "type": "orderbook_snapshot",
            "sid": 1,
            "seq": 1,
            "msg": {
                "market_ticker": "KXTEST",
                "yes_dollars_fp": [["0.45", "20"], ["0.46", "30"]],
                "no_dollars_fp": [["0.50", "15"], ["0.51", "25"]],
            },
        }
    )

    poly = store.polymarket["poly-yes"]
    kalshi = store.kalshi["KXTEST"]
    assert poly.best_bid == 0.48
    assert poly.best_ask == 0.51
    assert kalshi.yes_bid == 0.46
    assert kalshi.yes_ask == 0.49
    assert kalshi.no_bid == 0.51
    assert kalshi.no_ask == 0.54

    store.apply_kalshi(
        {
            "type": "orderbook_delta",
            "sid": 1,
            "seq": 2,
            "msg": {
                "market_ticker": "KXTEST",
                "side": "no",
                "price_dollars": "0.52",
                "delta_fp": "10",
            },
        }
    )
    assert kalshi.no_bid == 0.52
    assert kalshi.yes_ask == 0.48

    # Reproduce the exact binary-float failure seen in production:
    # 20 - 19.9 - 0.1 can leave microscopic positive residue when
    # accumulated as floats. The exhausted level must be removed.
    for sequence, delta_value in (
        (3, "20"),
        (4, "-19.9"),
        (5, "-0.1"),
    ):
        store.apply_kalshi(
            {
                "type": "orderbook_delta",
                "sid": 1,
                "seq": sequence,
                "msg": {
                    "market_ticker": "KXTEST",
                    "side": "yes",
                    "price_dollars": "0.44",
                    "delta_fp": delta_value,
                },
            }
        )

    assert 0.44 not in kalshi.yes_bids
    assert not has_executable_size(
        7.771561172376096e-16
    )
    assert has_executable_size(0.00002)

    first_snapshot = store.pair_snapshot(pair)
    assert first_snapshot["readyRouteCount"] == 2
    assert first_snapshot["liveComplete"] is True
    assert first_snapshot["polymarket"]["yes"]["askLevels"] == [
        {"price": 0.51, "size": 40.0}
    ]
    assert first_snapshot["kalshi"]["yesAskLevels"] == [
        {"price": 0.48, "size": 10.0},
        {"price": 0.49, "size": 25.0},
        {"price": 0.5, "size": 15.0},
    ]

    # A quiet book remains valid. Message age alone must not invalidate it.
    poly.received_at = "2020-01-01T00:00:00+00:00"
    store.refresh_health()
    assert poly.stale is False

    # Disconnecting only the Polymarket batch makes the routes unavailable for
    # an explicit reason instead of producing a vague incomplete state.
    store.set_batch_connected("polymarket", "batch-1", False)
    disconnected = store.pair_snapshot(pair)
    assert disconnected["readyRouteCount"] == 0
    assert all(
        "venue_disconnected" in route["reasons"]
        for route in disconnected["routeStates"]
    )

    # A reconnect requires fresh snapshots before the books become ready again.
    store.set_batch_connected("polymarket", "batch-1", True)
    reconnecting = store.pair_snapshot(pair)
    assert reconnecting["readyRouteCount"] == 0
    assert all(
        "resynchronizing" in route["reasons"]
        for route in reconnecting["routeStates"]
    )

    for asset_id, bid, ask in (
        ("poly-yes", "0.48", "0.51"),
        ("poly-no", "0.47", "0.52"),
    ):
        store.apply_polymarket(
            {
                "event_type": "book",
                "market": "condition-1",
                "asset_id": asset_id,
                "timestamp": "2000",
                "bids": [{"price": bid, "size": "50"}],
                "asks": [{"price": ask, "size": "40"}],
            }
        )

    recovered = store.pair_snapshot(pair)
    assert recovered["readyRouteCount"] == 2

    # A connected instrument that never receives its first snapshot must not
    # remain in the temporary initializing state forever.
    timeout_store = LiveBookStore(dummy_manifest)
    timeout_store.register_batch("polymarket", "batch-1", ("poly-yes", "poly-no"))
    timeout_store.register_batch("kalshi", "batch-1", ("KXTEST",))
    timeout_store.set_batch_connected("polymarket", "batch-1", True)
    timeout_store.set_batch_connected("kalshi", "batch-1", True)
    timed_out_at = datetime.fromtimestamp(
        time.time() - INITIAL_SNAPSHOT_TIMEOUT_SECONDS - 1.0,
        tz=timezone.utc,
    ).isoformat()
    for timeout_book in (
        *timeout_store.polymarket.values(),
        *timeout_store.kalshi.values(),
    ):
        timeout_book.last_connected_at = timed_out_at
    timed_out_snapshot = timeout_store.pair_snapshot(pair)
    assert timed_out_snapshot["readyRouteCount"] == 0
    assert all(
        "snapshot_unavailable" in route["reasons"]
        for route in timed_out_snapshot["routeStates"]
    )

    # Clear the book/connectivity changes accumulated above. A pure trade
    # telemetry update must neither advance pricing_revision nor dirty a pair.
    dirty_before_trade = store.consume_dirty_pairs()
    assert [item.id for item in dirty_before_trade] == ["test-pair"]

    pricing_revision_before_trade = store.pricing_revision
    store.apply_polymarket(
        {
            "event_type": "last_trade_price",
            "asset_id": "poly-yes",
            "price": "0.50",
            "size": "1",
        }
    )
    store.apply_kalshi(
        {
            "type": "trade",
            "msg": {
                "market_ticker": "KXTEST",
                "yes_price_dollars": "0.50",
                "count_fp": "1",
            },
        }
    )
    assert store.pricing_revision == pricing_revision_before_trade
    assert store.consume_dirty_pairs() == ()

    # A single executable-book update dirties exactly the affected matched pair.
    store.apply_polymarket(
        {
            "event_type": "best_bid_ask",
            "asset_id": "poly-yes",
            "best_bid": "0.49",
            "best_ask": "0.50",
        }
    )
    incremental_dirty = store.consume_dirty_pairs()
    assert [item.id for item in incremental_dirty] == ["test-pair"]

    return {
        "streamsVersion": STREAMS_VERSION,
        "status": "passed",
        "quietBookRemainsReady": True,
        "disconnectReasonVerified": True,
        "reconnectRequiresSnapshot": True,
        "initialSnapshotTimeoutVerified": True,
        "kalshiFloatDustRemoved": True,
        "tinyValidDepthPreserved": True,
        "tradeOnlyDoesNotReprice": True,
        "incrementalDirtyPairTracking": True,
        "readyRouteCount": recovered["readyRouteCount"],
        "polymarketBestBid": poly.best_bid,
        "polymarketBestAsk": poly.best_ask,
        "kalshiYesBid": kalshi.yes_bid,
        "kalshiYesAsk": kalshi.yes_ask,
        "kalshiNoBid": kalshi.no_bid,
        "kalshiNoAsk": kalshi.no_ask,
    }


async def smoke_run(args: argparse.Namespace) -> None:
    manifest = build_stream_manifest(
        args.market_group,
        pair_limit=args.pair_limit,
    )
    manager = PredictionMarketStreamManager(
        manifest,
        enable_polymarket=not args.no_polymarket,
        enable_kalshi=not args.no_kalshi,
        require_kalshi_credentials=args.require_kalshi,
    )
    await manager.start()
    try:
        await asyncio.sleep(args.seconds)
        print(json.dumps(manager.store.status(), indent=2, default=str))
        snapshots = manager.store.pair_snapshots()
        ready_rows = [row for row in snapshots if row["anyRouteReady"]]
        print(
            json.dumps(
                {
                    "pairsWithReadyRoute": len(ready_rows),
                    "fullyReadyPairs": sum(
                        row["readyRouteCount"] == 2
                        for row in snapshots
                    ),
                    "samples": ready_rows[:3],
                },
                indent=2,
                default=str,
            )
        )
    finally:
        await manager.stop()


async def run_service(args: argparse.Namespace) -> None:
    manifest = build_stream_manifest(
        args.market_group,
        pair_limit=args.pair_limit,
    )
    print(json.dumps(manifest.summary(), indent=2, default=str))
    manager = PredictionMarketStreamManager(
        manifest,
        enable_polymarket=not args.no_polymarket,
        enable_kalshi=not args.no_kalshi,
        require_kalshi_credentials=args.require_kalshi,
    )
    await manager.run_until_stopped()


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Bullionaire real-time prediction-market stream layer."
    )
    parser.add_argument(
        "--log-level",
        default=os.getenv("PREDICTION_STREAM_LOG_LEVEL", "INFO"),
        choices=["DEBUG", "INFO", "WARNING", "ERROR"],
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    subparsers.add_parser("self-test")

    manifest_parser = subparsers.add_parser("manifest")
    manifest_parser.add_argument(
        "--market-group",
        default="all",
        choices=["all", "sports", "macro", "weather"],
    )
    manifest_parser.add_argument("--pair-limit", type=int)
    manifest_parser.add_argument(
        "--full",
        action="store_true",
        help="Print every pair rather than only the summary.",
    )

    for command in ("smoke", "run"):
        command_parser = subparsers.add_parser(command)
        command_parser.add_argument(
            "--market-group",
            default="all",
            choices=["all", "sports", "macro", "weather"],
        )
        command_parser.add_argument("--pair-limit", type=int)
        command_parser.add_argument("--no-polymarket", action="store_true")
        command_parser.add_argument("--no-kalshi", action="store_true")
        command_parser.add_argument(
            "--require-kalshi",
            action="store_true",
            help="Fail instead of running Polymarket-only when Kalshi credentials are absent.",
        )
        if command == "smoke":
            command_parser.add_argument("--seconds", type=int, default=30)

    return parser


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()
    logging.basicConfig(
        level=getattr(logging, args.log_level),
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )

    if args.command == "self-test":
        print(json.dumps(self_test(), indent=2))
        return

    if args.command == "manifest":
        manifest = build_stream_manifest(
            args.market_group,
            pair_limit=args.pair_limit,
        )
        payload: Dict[str, Any] = manifest.summary()
        if args.full:
            payload["pairRows"] = [asdict(pair) for pair in manifest.pairs]
        print(json.dumps(payload, indent=2, default=str))
        return

    if args.command == "smoke":
        if args.seconds <= 0:
            parser.error("--seconds must be positive")
        asyncio.run(smoke_run(args))
        return

    if args.command == "run":
        asyncio.run(run_service(args))
        return

    parser.error(f"Unsupported command: {args.command}")


if __name__ == "__main__":
    main()