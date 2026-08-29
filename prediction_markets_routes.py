from __future__ import annotations

import asyncio
import base64
import hashlib
import json
import logging
import os
import time
from collections import Counter, deque
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Any, Dict, Iterable, List, Literal, Mapping, Optional, Sequence, Set, Tuple

import requests

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Query,
    Request,
    WebSocket,
    WebSocketDisconnect,
)
from fastapi.responses import JSONResponse

from prediction_market_engine import (
    ENGINE_VERSION,
    EXECUTABLE_ROUTE_STATUSES,
    UNAVAILABLE_ROUTE_STATUSES,
    LiveFeePricingContext,
    build_exact_pair_context,
    build_live_fee_pricing_context,
    prediction_snapshot_marker,
    price_live_pair_snapshot,
    scan_prediction_market_discrepancies,
)
from prediction_market_settlement import SETTLEMENT_VERSION
from prediction_market_streams import (
    STREAMS_VERSION,
    PredictionMarketStreamManager,
    build_stream_manifest,
)


LOGGER = logging.getLogger("prediction_markets_routes")

TERMINAL_API_CONTRACT_VERSION = (
    "prediction-terminal-api-v2-route-accounted"
)

# These values describe economic outcomes for executable routes. Every other
# valid route status must be a precise unavailable reason from the engine.
TERMINAL_ROUTE_STATUSES: Set[str] = {
    *EXECUTABLE_ROUTE_STATUSES,
    *UNAVAILABLE_ROUTE_STATUSES,
}

GENERIC_ROUTE_STATUSES = {
    "",
    "ready",
    "unavailable",
    "incomplete",
    "unknown",
    "none",
}

TERMINAL_OPPORTUNITY_TYPES = {
    "all",
    "gross",
    "net",
    "strict_gross",
    "strict_net",
    "conditional_gross",
    "conditional_net",
}

_stream_manager: Optional[PredictionMarketStreamManager] = None
_live_fee_context: Optional[LiveFeePricingContext] = None
_stream_start_error: Optional[str] = None
_terminal_started_at: Optional[str] = None
_terminal_ready_at: Optional[str] = None
_initial_traffic_ready: bool = False

# One process-wide terminal publisher prices the complete manifest once and
# shares the resulting immutable snapshot with every HTTP/WebSocket client.
# Browser count must never multiply engine pricing work.
_terminal_state: Optional[Dict[str, Any]] = None
_terminal_state_signature_value: Optional[str] = None
_terminal_state_revision: int = 0
_terminal_state_error: Optional[str] = None
_terminal_publisher_task: Optional[asyncio.Task[Any]] = None
_terminal_state_condition = asyncio.Condition()
_terminal_payload_cache: Dict[Tuple[Any, ...], Tuple[int, Dict[str, Any]]] = {}
_terminal_ws_message_cache: Dict[Tuple[Any, ...], Tuple[int, str]] = {}
_snapshot_marker_cache_value: Optional[str] = None
_snapshot_marker_cache_error: Optional[str] = None
_snapshot_marker_cache_at: float = 0.0
_snapshot_marker_cache_lock = asyncio.Lock()
TERMINAL_PAYLOAD_CACHE_MAX_ENTRIES = max(
    8,
    int(os.getenv("PREDICTION_TERMINAL_PAYLOAD_CACHE_MAX_ENTRIES", "8")),
)


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def env_flag(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def env_float(name: str, default: float) -> float:
    raw = os.getenv(name)
    if raw in (None, ""):
        return default
    try:
        return float(raw)
    except (TypeError, ValueError):
        return default


def env_int(name: str, default: int) -> int:
    raw = os.getenv(name)
    if raw in (None, ""):
        return default
    try:
        return int(raw)
    except (TypeError, ValueError):
        return default


# ---------------------------------------------------------------------------
# Bullionaire user authentication
# ---------------------------------------------------------------------------
# The React route guard is only a UX boundary. The actual prediction-market
# API must independently verify the Supabase access token on every new user
# session. We validate tokens against Supabase Auth's /auth/v1/user endpoint,
# then cache a successful verification for a short bounded interval so normal
# readiness polling and reconnects do not put Supabase Auth in the hot path.
PREDICTION_REQUIRE_USER_AUTH = env_flag(
    "PREDICTION_REQUIRE_USER_AUTH",
    True,
)
SUPABASE_URL = os.getenv("SUPABASE_URL", "").strip().rstrip("/")
SUPABASE_PUBLIC_KEY = (
    os.getenv("SUPABASE_PUBLISHABLE_KEY", "").strip()
    or os.getenv("SUPABASE_ANON_KEY", "").strip()
)
AUTH_VERIFY_TIMEOUT_SECONDS = max(
    3.0,
    env_float("PREDICTION_AUTH_VERIFY_TIMEOUT_SECONDS", 10.0),
)
AUTH_CACHE_TTL_SECONDS = max(
    5,
    env_int("PREDICTION_AUTH_CACHE_SECONDS", 120),
)
AUTH_CACHE_MAX_ENTRIES = max(
    128,
    env_int("PREDICTION_AUTH_CACHE_MAX_ENTRIES", 4096),
)
WS_AUTH_PROTOCOL = "bullionaire-v1"
_auth_cache: Dict[str, Tuple[float, Dict[str, Any]]] = {}
_auth_cache_lock = asyncio.Lock()

# Cost/abuse guards. With one Uvicorn worker these in-memory limits are
# authoritative for the launch architecture and do not add Redis complexity.
PREDICTION_HTTP_REQUESTS_PER_MINUTE = max(
    30, env_int("PREDICTION_HTTP_REQUESTS_PER_MINUTE", 180)
)
PREDICTION_WS_MAX_CONNECTIONS_PER_USER = max(
    1, env_int("PREDICTION_WS_MAX_CONNECTIONS_PER_USER", 3)
)
_prediction_http_buckets: Dict[str, Any] = {}
_prediction_http_rate_lock = asyncio.Lock()
_prediction_ws_user_counts: Dict[str, int] = {}
_prediction_ws_user_lock = asyncio.Lock()


class PredictionAuthError(RuntimeError):
    def __init__(self, status_code: int, detail: str):
        super().__init__(detail)
        self.status_code = status_code
        self.detail = detail


def _validate_auth_configuration() -> None:
    if not PREDICTION_REQUIRE_USER_AUTH:
        LOGGER.warning(
            "Prediction-market user authentication is DISABLED. "
            "Do not deploy this setting publicly."
        )
        return

    missing = []
    if not SUPABASE_URL:
        missing.append("SUPABASE_URL")
    if not SUPABASE_PUBLIC_KEY:
        missing.append("SUPABASE_PUBLISHABLE_KEY or SUPABASE_ANON_KEY")
    if missing:
        raise RuntimeError(
            "Prediction-market API authentication is enabled but missing: "
            + ", ".join(missing)
        )


def _bearer_from_authorization_header(value: Optional[str]) -> Optional[str]:
    raw = str(value or "").strip()
    if not raw:
        return None
    scheme, separator, token = raw.partition(" ")
    if not separator or scheme.lower() != "bearer":
        return None
    token = token.strip()
    return token or None


def _jwt_expiry_unverified(token: str) -> Optional[float]:
    """Read exp only to cap an already-verified cache entry; never for trust."""
    try:
        payload_segment = token.split(".", 2)[1]
        padding = "=" * (-len(payload_segment) % 4)
        payload = json.loads(
            base64.urlsafe_b64decode(payload_segment + padding).decode("utf-8")
        )
        exp = payload.get("exp")
        return float(exp) if exp is not None else None
    except Exception:  # noqa: BLE001 - malformed tokens are rejected by Auth
        return None


def _verify_supabase_token_sync(token: str) -> Dict[str, Any]:
    try:
        response = requests.get(
            f"{SUPABASE_URL}/auth/v1/user",
            headers={
                "apikey": SUPABASE_PUBLIC_KEY,
                "Authorization": f"Bearer {token}",
                "Accept": "application/json",
            },
            timeout=AUTH_VERIFY_TIMEOUT_SECONDS,
        )
    except requests.RequestException as exc:
        raise PredictionAuthError(
            503,
            "Authentication service is temporarily unavailable.",
        ) from exc

    if response.status_code in {401, 403}:
        raise PredictionAuthError(401, "Authentication required.")
    if response.status_code >= 500:
        raise PredictionAuthError(
            503,
            "Authentication service is temporarily unavailable.",
        )
    if response.status_code != 200:
        raise PredictionAuthError(401, "Authentication required.")

    try:
        user = response.json()
    except ValueError as exc:
        raise PredictionAuthError(
            503,
            "Authentication service returned an invalid response.",
        ) from exc

    user_id = str(user.get("id") or "").strip() if isinstance(user, dict) else ""
    if not user_id:
        raise PredictionAuthError(401, "Authentication required.")

    return {
        "id": user_id,
        "email": user.get("email") if isinstance(user, dict) else None,
        "role": user.get("role") if isinstance(user, dict) else None,
    }


async def verify_prediction_access_token(token: str) -> Dict[str, Any]:
    if not PREDICTION_REQUIRE_USER_AUTH:
        return {"id": "auth-disabled", "role": "development"}

    if not token:
        raise PredictionAuthError(401, "Authentication required.")

    cache_key = hashlib.sha256(token.encode("utf-8")).hexdigest()
    now = time.time()

    async with _auth_cache_lock:
        cached = _auth_cache.get(cache_key)
        if cached is not None and cached[0] > now:
            return cached[1]
        if cached is not None:
            _auth_cache.pop(cache_key, None)

    user = await asyncio.to_thread(_verify_supabase_token_sync, token)

    cache_until = now + AUTH_CACHE_TTL_SECONDS
    token_expiry = _jwt_expiry_unverified(token)
    if token_expiry is not None:
        # Never retain an authentication decision after the JWT's own expiry.
        cache_until = min(cache_until, token_expiry - 5.0)
    if cache_until <= now:
        raise PredictionAuthError(401, "Authentication required.")

    async with _auth_cache_lock:
        if len(_auth_cache) >= AUTH_CACHE_MAX_ENTRIES:
            # First discard expired entries. If the cache is still at the
            # bound, clear it rather than allowing unbounded per-user growth.
            expired = [key for key, value in _auth_cache.items() if value[0] <= now]
            for key in expired:
                _auth_cache.pop(key, None)
            if len(_auth_cache) >= AUTH_CACHE_MAX_ENTRIES:
                _auth_cache.clear()
        _auth_cache[cache_key] = (cache_until, user)

    return user


def _prediction_client_ip(request: Request) -> str:
    forwarded_for = str(request.headers.get("x-forwarded-for") or "").strip()
    if forwarded_for:
        return forwarded_for.split(",", 1)[0].strip() or "unknown"
    if request.client and request.client.host:
        return str(request.client.host)
    return "unknown"


async def _enforce_prediction_http_rate_limit(
    request: Request,
    user: Mapping[str, Any],
) -> None:
    user_id = str(user.get("id") or "unknown")
    key = f"{user_id}:{_prediction_client_ip(request)}"
    now = time.monotonic()
    cutoff = now - 60.0

    async with _prediction_http_rate_lock:
        bucket = _prediction_http_buckets.get(key)
        if bucket is None:
            bucket = deque()
            _prediction_http_buckets[key] = bucket
        while bucket and bucket[0] < cutoff:
            bucket.popleft()
        if len(bucket) >= PREDICTION_HTTP_REQUESTS_PER_MINUTE:
            raise HTTPException(
                status_code=429,
                detail="Too many Prediction Markets requests. Please retry shortly.",
                headers={"Retry-After": "60"},
            )
        bucket.append(now)

        # Keep unique-client attack traffic from growing memory without bound.
        if len(_prediction_http_buckets) > 10_000:
            stale_keys = [
                bucket_key
                for bucket_key, timestamps in _prediction_http_buckets.items()
                if not timestamps or timestamps[-1] < cutoff
            ]
            for bucket_key in stale_keys:
                _prediction_http_buckets.pop(bucket_key, None)
            if len(_prediction_http_buckets) > 10_000:
                _prediction_http_buckets.clear()


async def _acquire_prediction_ws_slot(user_id: str) -> bool:
    async with _prediction_ws_user_lock:
        current = int(_prediction_ws_user_counts.get(user_id, 0))
        if current >= PREDICTION_WS_MAX_CONNECTIONS_PER_USER:
            return False
        _prediction_ws_user_counts[user_id] = current + 1
        return True


async def _release_prediction_ws_slot(user_id: Optional[str]) -> None:
    if not user_id:
        return
    async with _prediction_ws_user_lock:
        current = int(_prediction_ws_user_counts.get(user_id, 0))
        if current <= 1:
            _prediction_ws_user_counts.pop(user_id, None)
        else:
            _prediction_ws_user_counts[user_id] = current - 1


async def require_prediction_user(request: Request) -> Dict[str, Any]:
    if not PREDICTION_REQUIRE_USER_AUTH:
        user = {"id": "auth-disabled", "role": "development"}
        await _enforce_prediction_http_rate_limit(request, user)
        return user

    token = _bearer_from_authorization_header(request.headers.get("authorization"))
    if not token:
        raise HTTPException(status_code=401, detail="Authentication required.")

    try:
        user = await verify_prediction_access_token(token)
    except PredictionAuthError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc

    await _enforce_prediction_http_rate_limit(request, user)
    return user


def _websocket_protocols(websocket: WebSocket) -> List[str]:
    raw = str(websocket.headers.get("sec-websocket-protocol") or "")
    return [item.strip() for item in raw.split(",") if item.strip()]


def _websocket_access_token(websocket: WebSocket) -> Optional[str]:
    protocols = _websocket_protocols(websocket)
    if WS_AUTH_PROTOCOL not in protocols:
        return None
    for protocol in protocols:
        if protocol != WS_AUTH_PROTOCOL:
            return protocol
    return None


DEFAULT_BROWSER_ORIGINS = {
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://bullionaireiq.com",
    "https://www.bullionaireiq.com",
}


def allowed_browser_origins() -> Set[str]:
    extra = os.getenv("CORS_ALLOWED_ORIGINS", "")
    return {
        origin.strip().rstrip("/")
        for origin in [*DEFAULT_BROWSER_ORIGINS, *extra.split(",")]
        if origin.strip()
    }


def websocket_origin_allowed(websocket: WebSocket) -> bool:
    origin = str(websocket.headers.get("origin") or "").strip().rstrip("/")
    # Non-browser/internal clients may omit Origin. Browser clients must match.
    return not origin or origin in allowed_browser_origins()


@asynccontextmanager
async def prediction_market_lifespan(_app):
    """Start one singleton stream/pricing stack and one shared terminal publisher."""
    global _stream_manager
    global _live_fee_context
    global _stream_start_error
    global _terminal_started_at
    global _terminal_ready_at
    global _initial_traffic_ready
    global _terminal_state
    global _terminal_state_signature_value
    global _terminal_state_revision
    global _terminal_state_error
    global _terminal_publisher_task
    global _snapshot_marker_cache_value
    global _snapshot_marker_cache_error
    global _snapshot_marker_cache_at

    manager: Optional[PredictionMarketStreamManager] = None

    _stream_manager = None
    _live_fee_context = None
    _stream_start_error = None
    _terminal_started_at = utc_now_iso()
    _terminal_ready_at = None
    _initial_traffic_ready = False
    _terminal_state = None
    _terminal_state_signature_value = None
    _terminal_state_revision = 0
    _terminal_state_error = None
    _terminal_payload_cache.clear()
    _terminal_ws_message_cache.clear()
    _snapshot_marker_cache_value = None
    _snapshot_marker_cache_error = None
    _snapshot_marker_cache_at = 0.0

    try:
        _validate_auth_configuration()

        exact_context = await asyncio.to_thread(
            build_exact_pair_context,
            "all",
        )
        manifest = build_stream_manifest(
            "all",
            context=exact_context,
        )

        manager = PredictionMarketStreamManager(
            manifest,
            enable_polymarket=True,
            enable_kalshi=True,
            require_kalshi_credentials=env_flag(
                "PREDICTION_REQUIRE_KALSHI_STREAMS",
                True,
            ),
        )
        await manager.start()

        fee_context = await asyncio.to_thread(
            build_live_fee_pricing_context,
            exact_context,
        )

        _stream_manager = manager
        _live_fee_context = fee_context

        # Pricing is process-wide, not per browser. The first successful
        # publication marks this process ready for public traffic.
        _terminal_publisher_task = asyncio.create_task(
            _terminal_publisher_loop(manager, fee_context),
            name="prediction-terminal-publisher",
        )

        LOGGER.info(
            "Prediction-market streams started: %s",
            manifest.summary(),
        )
        LOGGER.info(
            "Prediction-market live fee context loaded: %s",
            fee_context.summary(),
        )

    except Exception as exc:  # noqa: BLE001 - keep the rest of the API online
        _stream_manager = None
        _live_fee_context = None
        _terminal_ready_at = None
        _initial_traffic_ready = False
        _terminal_state = None
        _stream_start_error = f"{type(exc).__name__}: {exc}"
        LOGGER.exception("Prediction-market terminal startup failed.")

        if manager is not None:
            await manager.stop()
            manager = None

    try:
        yield
    finally:
        if _terminal_publisher_task is not None:
            _terminal_publisher_task.cancel()
            await asyncio.gather(_terminal_publisher_task, return_exceptions=True)
            _terminal_publisher_task = None
        if manager is not None:
            await manager.stop()
        _stream_manager = None
        _live_fee_context = None
        _terminal_ready_at = None
        _initial_traffic_ready = False
        _terminal_state = None
        _terminal_payload_cache.clear()
        _terminal_ws_message_cache.clear()


router = APIRouter(
    prefix="/api/prediction-markets",
    tags=["Prediction Markets"],
)


def get_stream_manager() -> PredictionMarketStreamManager:
    if _stream_manager is None:
        detail = "The real-time prediction-market stream is not available."
        if _stream_start_error:
            detail += f" Startup diagnostic: {_stream_start_error}"
        raise HTTPException(status_code=503, detail=detail)
    return _stream_manager


def get_live_fee_context() -> LiveFeePricingContext:
    if _live_fee_context is None:
        detail = "The live prediction-market fee context is not available."
        if _stream_start_error:
            detail += f" Startup diagnostic: {_stream_start_error}"
        raise HTTPException(status_code=503, detail=detail)
    return _live_fee_context


def get_terminal_state() -> Dict[str, Any]:
    if _terminal_state is None:
        detail = "The shared prediction-market terminal snapshot is not ready."
        if _terminal_state_error:
            detail += f" Publisher diagnostic: {_terminal_state_error}"
        if _stream_start_error:
            detail += f" Startup diagnostic: {_stream_start_error}"
        raise HTTPException(status_code=503, detail=detail)
    return _terminal_state


def terminal_version_payload() -> Dict[str, str]:
    return {
        "apiContractVersion": TERMINAL_API_CONTRACT_VERSION,
        "engineVersion": ENGINE_VERSION,
        "settlementVersion": SETTLEMENT_VERSION,
        "streamsVersion": STREAMS_VERSION,
    }


def _as_float(value: Any) -> Optional[float]:
    try:
        if value in (None, ""):
            return None
        return float(value)
    except (TypeError, ValueError):
        return None


def _snapshot_identity(snapshot: Dict[str, Any]) -> Tuple[str, str, str, str]:
    polymarket = snapshot.get("polymarket") or {}
    kalshi = snapshot.get("kalshi") or {}
    return (
        str(snapshot.get("market_group") or snapshot.get("marketGroup") or ""),
        str(polymarket.get("marketId") or ""),
        str(kalshi.get("marketTicker") or kalshi.get("marketId") or ""),
        str(snapshot.get("contract_key") or snapshot.get("contractKey") or ""),
    )


def _row_identity(row: Dict[str, Any]) -> Tuple[str, str, str, str]:
    polymarket = row.get("polymarket") or {}
    kalshi = row.get("kalshi") or {}
    return (
        str(row.get("marketGroup") or ""),
        str(polymarket.get("marketId") or ""),
        str(kalshi.get("marketId") or kalshi.get("marketTicker") or ""),
        str(row.get("contractKey") or ""),
    )


def _manifest_identity(pair: Any) -> Tuple[str, str, str, str]:
    return (
        str(pair.market_group or ""),
        str(pair.polymarket_market_id or ""),
        str(pair.kalshi_market_ticker or ""),
        str(pair.contract_key or ""),
    )


def _pricing_exception_payload(
    snapshot: Dict[str, Any],
    exc: BaseException,
) -> Dict[str, Any]:
    """Keep a failed pair visible and make readiness fail loudly."""
    diagnostic = f"{type(exc).__name__}: {exc}"
    relationship = str(
        snapshot.get("pair_relationship")
        or snapshot.get("pairRelationship")
        or "direct"
    )
    if relationship == "complement":
        route_specs = (
            ("polymarket_yes_kalshi_yes", "Buy Polymarket YES + Kalshi YES"),
            ("polymarket_no_kalshi_no", "Buy Polymarket NO + Kalshi NO"),
        )
    else:
        route_specs = (
            ("polymarket_yes_kalshi_no", "Buy Polymarket YES + Kalshi NO"),
            ("polymarket_no_kalshi_yes", "Buy Polymarket NO + Kalshi YES"),
        )

    routes = []
    for key, description in route_specs:
        routes.append(
            {
                "key": key,
                "description": description,
                "status": "pricing_exception",
                "pricingStatus": "pricing_exception",
                "reason": "pricing_exception",
                "reasons": ["pricing_exception"],
                "diagnostic": diagnostic,
                "executable": False,
                "polymarket": {
                    "venue": "polymarket",
                    "side": None,
                    "ask": None,
                    "askSize": None,
                    "status": "pricing_exception",
                    "reason": "pricing_exception",
                    "executable": False,
                },
                "kalshi": {
                    "venue": "kalshi",
                    "side": None,
                    "ask": None,
                    "askSize": None,
                    "status": "pricing_exception",
                    "reason": "pricing_exception",
                    "executable": False,
                },
                "grossEdge": None,
                "netEdge": None,
                "feeEstimateComplete": False,
                "executableContracts": 0.0,
                "capitalRequiredUsd": None,
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
        )

    return {
        "id": str(snapshot.get("id") or "pricing_exception"),
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
        "settlementReasons": ["pricing_exception"],
        "settlementSignature": {},
        "pairStatus": "unavailable",
        "pricingStatus": "pricing_exception",
        "readyRouteCount": 0,
        "accountedRouteCount": 2,
        "allRoutesAccounted": True,
        "anyRouteReady": False,
        "routeStatusCounts": {"pricing_exception": 2},
        "polymarket": snapshot.get("polymarket") or {},
        "kalshi": snapshot.get("kalshi") or {},
        "liquidity": {},
        "routes": routes,
        "bestRoute": routes[0],
        "bestGrossEdge": None,
        "bestNetEdge": None,
        "rawIsGrossArbitrage": False,
        "rawIsNetArbitrage": False,
        "rawIsNetArbitrageAtDisplayedDepth": False,
        "feeEstimateComplete": False,
        "liveComplete": False,
        "pricingSource": "in-memory-websocket-books",
        "pricingError": diagnostic,
    }


def _price_terminal_snapshots(
    snapshots: Sequence[Dict[str, Any]],
    fee_context: LiveFeePricingContext,
) -> List[Dict[str, Any]]:
    """Price immutable stream snapshots without touching the live book store."""
    rows: List[Dict[str, Any]] = []

    for snapshot in snapshots:
        try:
            row = price_live_pair_snapshot(snapshot, fee_context)
        except Exception as exc:  # noqa: BLE001 - preserve pair and fail readiness
            LOGGER.exception(
                "Live pair pricing failed for %s.",
                snapshot.get("id"),
            )
            row = _pricing_exception_payload(snapshot, exc)

        row["opportunityClass"] = classify_terminal_opportunity(row)
        rows.append(row)

    return rows


def _evaluate_terminal_rows(
    manager: PredictionMarketStreamManager,
    fee_context: LiveFeePricingContext,
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    """Compatibility helper for tests/diagnostics outside the shared publisher."""
    snapshots = manager.store.pair_snapshots()
    return snapshots, _price_terminal_snapshots(snapshots, fee_context)


def _terminal_state_signature(state: Dict[str, Any]) -> str:
    """Hash only meaningful live state; generated timestamps don't cause pushes."""
    status = state.get("streamStatus") or {}
    coverage = state.get("coverage") or {}
    signature_payload = {
        "venueConnected": status.get("venueConnected"),
        "connectionCounts": status.get("connectionCounts"),
        "errors": status.get("errors"),
        "pairStatusCounts": coverage.get("pairStatusCounts"),
        "routeStatusCounts": coverage.get("routeStatusCounts"),
        "rows": state.get("rows") or [],
    }
    encoded = json.dumps(
        signature_payload,
        sort_keys=True,
        separators=(",", ":"),
        default=str,
    ).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


async def _build_shared_terminal_state(
    manager: PredictionMarketStreamManager,
    fee_context: LiveFeePricingContext,
) -> Dict[str, Any]:
    """Capture books once, then price that immutable capture off the event loop."""
    snapshots = manager.store.pair_snapshots()
    source_revision = manager.store.pricing_revision
    status = manager.store.status(snapshots=snapshots)
    rows = await asyncio.to_thread(
        _price_terminal_snapshots,
        snapshots,
        fee_context,
    )
    coverage = _coverage_audit(manager, fee_context, snapshots, rows)
    return {
        "generatedAt": status["generatedAt"],
        "sourceRevision": source_revision,
        "streamStatus": status,
        "feePricing": fee_context.summary(),
        "coverage": coverage,
        "rows": rows,
    }


async def _terminal_publisher_loop(
    manager: PredictionMarketStreamManager,
    fee_context: LiveFeePricingContext,
) -> None:
    """Price the complete manifest once per process and notify all clients."""
    global _terminal_state
    global _terminal_state_signature_value
    global _terminal_state_revision
    global _terminal_state_error
    global _terminal_ready_at
    global _initial_traffic_ready

    interval = max(
        0.25,
        env_float("PREDICTION_TERMINAL_REPRICE_INTERVAL_SECONDS", 0.5),
    )
    heartbeat_seconds = max(
        5.0,
        env_float("PREDICTION_TERMINAL_HEARTBEAT_SECONDS", 15.0),
    )
    loop = asyncio.get_running_loop()
    last_refresh_time = 0.0
    last_priced_store_revision = -1

    while True:
        try:
            now = loop.time()
            store_revision = manager.store.pricing_revision
            refresh_due = now - last_refresh_time >= heartbeat_seconds

            # Only executable-book/health changes advance pricing_revision.
            # Periodically rebuild for time-based health transitions, but do not
            # publish a new full catalog unless the meaningful signature changed.
            if (
                _terminal_state is not None
                and store_revision == last_priced_store_revision
                and not refresh_due
            ):
                await asyncio.sleep(interval)
                continue

            state = await _build_shared_terminal_state(manager, fee_context)
            signature = _terminal_state_signature(state)
            last_refresh_time = loop.time()
            publish = bool(
                _terminal_state is None
                or signature != _terminal_state_signature_value
            )
            last_priced_store_revision = int(state.get("sourceRevision") or 0)

            if publish:
                _terminal_state = state
                _terminal_state_signature_value = signature
                _terminal_state_revision += 1
                _terminal_payload_cache.clear()
                _terminal_ws_message_cache.clear()
                _terminal_state_error = None
                # Initial public-traffic readiness is latched only after every
                # expected venue WebSocket batch is connected and a shared
                # terminal state has been published. After that first successful
                # warm-up, transient venue disconnects are surfaced through the
                # readiness/status payload instead of triggering Render restart
                # loops.
                stream_status = state.get("streamStatus") or {}
                manifest_summary = stream_status.get("manifest") or {}
                connection_counts = stream_status.get("connectionCounts") or {}
                venue_connected = stream_status.get("venueConnected") or {}
                expected_poly = int(manifest_summary.get("polymarketConnections") or 0)
                expected_kalshi = int(manifest_summary.get("kalshiConnections") or 0)
                actual_poly = int(connection_counts.get("polymarket") or 0)
                actual_kalshi = int(connection_counts.get("kalshi") or 0)
                poly_initialized = int(
                    stream_status.get("polymarketInitializedBooks") or 0
                )
                kalshi_initialized = int(
                    stream_status.get("kalshiInitializedBooks") or 0
                )
                initially_warm = bool(
                    venue_connected.get("polymarket")
                    and venue_connected.get("kalshi")
                    and expected_poly > 0
                    and expected_kalshi > 0
                    and actual_poly == expected_poly
                    and actual_kalshi == expected_kalshi
                    and poly_initialized > 0
                    and kalshi_initialized > 0
                )
                if initially_warm and not _initial_traffic_ready:
                    _initial_traffic_ready = True
                    if _terminal_ready_at is None:
                        _terminal_ready_at = utc_now_iso()

                async with _terminal_state_condition:
                    _terminal_state_condition.notify_all()

        except asyncio.CancelledError:
            raise
        except Exception as exc:  # noqa: BLE001 - publisher must self-heal
            _terminal_state_error = f"{type(exc).__name__}: {exc}"
            LOGGER.exception("Shared prediction-market terminal publication failed.")

        await asyncio.sleep(interval)


async def _wait_for_terminal_revision(
    previous_revision: int,
    *,
    timeout: float = 15.0,
) -> int:
    """Sleep without polling until the shared publisher has a newer snapshot."""
    async with _terminal_state_condition:
        if _terminal_state_revision != previous_revision:
            return _terminal_state_revision
        try:
            await asyncio.wait_for(
                _terminal_state_condition.wait_for(
                    lambda: _terminal_state_revision != previous_revision
                ),
                timeout=timeout,
            )
        except asyncio.TimeoutError:
            pass
    return _terminal_state_revision


def _stream_assignment_audit(
    manager: PredictionMarketStreamManager,
) -> Dict[str, Any]:
    assigned_polymarket_assets: Set[str] = set()
    assigned_kalshi_tickers: Set[str] = set()

    for stream in manager.streams:
        for asset_id in getattr(stream, "asset_ids", []) or []:
            assigned_polymarket_assets.add(str(asset_id))
        for ticker in getattr(stream, "market_tickers", []) or []:
            assigned_kalshi_tickers.add(str(ticker))

    assigned_pair_identities: Set[Tuple[str, str, str, str]] = set()
    unassigned_pair_identities: List[Tuple[str, str, str, str]] = []

    for pair in manager.manifest.pairs:
        assigned = bool(
            pair.polymarket_yes_asset_id in assigned_polymarket_assets
            and pair.polymarket_no_asset_id in assigned_polymarket_assets
            and pair.kalshi_market_ticker in assigned_kalshi_tickers
        )
        identity = _manifest_identity(pair)
        if assigned:
            assigned_pair_identities.add(identity)
        else:
            unassigned_pair_identities.append(identity)

    return {
        "assignedPolymarketAssets": len(assigned_polymarket_assets),
        "expectedPolymarketAssets": len(manager.manifest.polymarket_asset_ids),
        "assignedKalshiTickers": len(assigned_kalshi_tickers),
        "expectedKalshiTickers": len(manager.manifest.kalshi_market_tickers),
        "assignedPairs": len(assigned_pair_identities),
        "unassignedPairs": len(unassigned_pair_identities),
        "unassignedPairSamples": [list(value) for value in unassigned_pair_identities[:10]],
    }


def _coverage_audit(
    manager: PredictionMarketStreamManager,
    fee_context: LiveFeePricingContext,
    snapshots: Sequence[Dict[str, Any]],
    rows: Sequence[Dict[str, Any]],
) -> Dict[str, Any]:
    manifest_identities = {_manifest_identity(pair) for pair in manager.manifest.pairs}
    snapshot_identities = {_snapshot_identity(snapshot) for snapshot in snapshots}
    row_identities = {_row_identity(row) for row in rows}

    route_status_counts: Counter[str] = Counter()
    pair_status_counts: Counter[str] = Counter()
    accounted_routes = 0
    malformed_route_rows = 0
    generic_route_statuses = 0
    unknown_route_statuses = 0
    pair_lookup_missing_routes = 0
    pricing_exception_routes = 0

    for row in rows:
        pair_status_counts[str(row.get("pairStatus") or "unknown")] += 1
        routes = row.get("routes")
        if not isinstance(routes, list) or len(routes) != 2:
            malformed_route_rows += 1
            continue

        accounted_routes += len(routes)
        for route in routes:
            status = str(route.get("status") or "").strip().lower()
            route_status_counts[status or "missing_status"] += 1
            if status in GENERIC_ROUTE_STATUSES:
                generic_route_statuses += 1
            if status not in TERMINAL_ROUTE_STATUSES:
                unknown_route_statuses += 1
            if status == "pair_lookup_missing":
                pair_lookup_missing_routes += 1
            if status == "pricing_exception":
                pricing_exception_routes += 1

    expected_routes = len(manifest_identities) * 2

    return {
        "manifestPairs": len(manifest_identities),
        "streamSnapshotPairs": len(snapshot_identities),
        "evaluatedPairs": len(row_identities),
        "feeContextPairs": len(fee_context.pair_lookup),
        "expectedRoutes": expected_routes,
        "accountedRoutes": accounted_routes,
        "malformedRouteRows": malformed_route_rows,
        "genericRouteStatuses": generic_route_statuses,
        "unknownRouteStatuses": unknown_route_statuses,
        "pairLookupMissingRoutes": pair_lookup_missing_routes,
        "pricingExceptionRoutes": pricing_exception_routes,
        "manifestEqualsSnapshots": manifest_identities == snapshot_identities,
        "manifestEqualsEvaluated": manifest_identities == row_identities,
        "allRoutesAccounted": accounted_routes == expected_routes,
        "routeStatusCounts": dict(sorted(route_status_counts.items())),
        "pairStatusCounts": dict(sorted(pair_status_counts.items())),
        "missingSnapshotPairSamples": [
            list(value) for value in sorted(manifest_identities - snapshot_identities)[:10]
        ],
        "extraSnapshotPairSamples": [
            list(value) for value in sorted(snapshot_identities - manifest_identities)[:10]
        ],
        "missingEvaluatedPairSamples": [
            list(value) for value in sorted(manifest_identities - row_identities)[:10]
        ],
        "extraEvaluatedPairSamples": [
            list(value) for value in sorted(row_identities - manifest_identities)[:10]
        ],
    }


async def _cached_database_snapshot_marker() -> Tuple[Optional[str], Optional[str]]:
    """Bound readiness DB traffic regardless of connected browser count."""
    global _snapshot_marker_cache_value
    global _snapshot_marker_cache_error
    global _snapshot_marker_cache_at

    ttl = max(1.0, env_float("PREDICTION_READINESS_DB_CACHE_SECONDS", 10.0))
    loop = asyncio.get_running_loop()
    now = loop.time()
    if _snapshot_marker_cache_at and now - _snapshot_marker_cache_at < ttl:
        return _snapshot_marker_cache_value, _snapshot_marker_cache_error

    async with _snapshot_marker_cache_lock:
        now = loop.time()
        if _snapshot_marker_cache_at and now - _snapshot_marker_cache_at < ttl:
            return _snapshot_marker_cache_value, _snapshot_marker_cache_error
        try:
            value = await asyncio.to_thread(prediction_snapshot_marker)
            _snapshot_marker_cache_value = (
                str(value) if value is not None else None
            )
            _snapshot_marker_cache_error = None
        except Exception as exc:  # noqa: BLE001
            _snapshot_marker_cache_value = None
            _snapshot_marker_cache_error = f"{type(exc).__name__}: {exc}"
        _snapshot_marker_cache_at = loop.time()
        return _snapshot_marker_cache_value, _snapshot_marker_cache_error


async def build_terminal_readiness_payload() -> Dict[str, Any]:
    """Return strict process readiness based on complete pair accounting."""
    reasons: List[str] = []
    warnings: List[str] = []
    manager = _stream_manager
    fee_context = _live_fee_context

    manager_loaded = manager is not None
    fee_context_loaded = fee_context is not None
    status: Dict[str, Any] = manager.store.status() if manager is not None else {}

    venue_connected = (status.get("venueConnected") or {}) if status else {}
    connection_counts = (status.get("connectionCounts") or {}) if status else {}
    manifest_summary = (status.get("manifest") or {}) if status else {}
    stream_errors = (status.get("errors") or {}) if status else {}

    polymarket_connected = bool(venue_connected.get("polymarket"))
    kalshi_connected = bool(venue_connected.get("kalshi"))
    expected_poly_connections = int(manifest_summary.get("polymarketConnections") or 0)
    expected_kalshi_connections = int(manifest_summary.get("kalshiConnections") or 0)
    actual_poly_connections = int(connection_counts.get("polymarket") or 0)
    actual_kalshi_connections = int(connection_counts.get("kalshi") or 0)
    all_stream_batches_connected = bool(
        expected_poly_connections > 0
        and expected_kalshi_connections > 0
        and actual_poly_connections == expected_poly_connections
        and actual_kalshi_connections == expected_kalshi_connections
    )

    assignment: Dict[str, Any] = {}
    coverage: Dict[str, Any] = {}

    if manager is not None and fee_context is not None:
        assignment = _stream_assignment_audit(manager)
        state = _terminal_state
        if state is not None:
            coverage = dict(state.get("coverage") or {})

    loaded_snapshot = fee_context.snapshot_marker if fee_context is not None else None
    database_snapshot, snapshot_lookup_error = (
        await _cached_database_snapshot_marker()
    )

    snapshot_current = bool(
        loaded_snapshot is not None
        and database_snapshot is not None
        and str(loaded_snapshot) == str(database_snapshot)
    )

    versions_aligned = bool(
        status
        and status.get("engineVersion") == ENGINE_VERSION
        and manifest_summary.get("engineVersion") == ENGINE_VERSION
        and status.get("streamsVersion") == STREAMS_VERSION
        and manifest_summary.get("streamsVersion") == STREAMS_VERSION
    )

    if not manager_loaded:
        reasons.append("stream_manager_not_loaded")
    if not fee_context_loaded:
        reasons.append("fee_context_not_loaded")
    if not polymarket_connected:
        reasons.append("polymarket_not_connected")
    if not kalshi_connected:
        reasons.append("kalshi_not_connected")
    # A single reconnecting stream batch must not turn the entire terminal
    # unavailable after the process has completed one full warm-up. The routes
    # assigned to that batch already carry precise unavailable reasons.
    if not all_stream_batches_connected:
        warnings.append("not_all_stream_batches_connected")
    if stream_errors:
        warnings.append("stream_errors_present")
    if assignment and assignment.get("unassignedPairs"):
        reasons.append("manifest_pairs_not_fully_assigned_to_streams")
    if coverage:
        if not coverage.get("manifestEqualsSnapshots"):
            reasons.append("manifest_stream_snapshot_mismatch")
        if not coverage.get("manifestEqualsEvaluated"):
            reasons.append("manifest_api_row_mismatch")
        if coverage.get("feeContextPairs") != coverage.get("manifestPairs"):
            reasons.append("stream_fee_pair_count_mismatch")
        if not coverage.get("allRoutesAccounted"):
            reasons.append("not_all_routes_accounted")
        if coverage.get("malformedRouteRows"):
            reasons.append("rows_without_exactly_two_routes")
        if coverage.get("genericRouteStatuses"):
            reasons.append("generic_route_statuses_present")
        if coverage.get("unknownRouteStatuses"):
            reasons.append("unknown_route_statuses_present")
        if coverage.get("pairLookupMissingRoutes"):
            reasons.append("pair_lookup_missing")
        if coverage.get("pricingExceptionRoutes"):
            reasons.append("pricing_exceptions_present")
    if not versions_aligned:
        reasons.append("runtime_version_mismatch")
    if snapshot_lookup_error:
        reasons.append("database_snapshot_check_failed")
    elif not snapshot_current:
        reasons.append("database_snapshot_changed_restart_required")
    if _stream_start_error:
        reasons.append("terminal_startup_error")
    if _terminal_state is None:
        reasons.append("terminal_snapshot_not_published")
    if _terminal_state_error:
        reasons.append("terminal_publisher_error")
    if not _initial_traffic_ready:
        reasons.append("initial_full_stream_warmup_incomplete")

    # Preserve order while removing duplicates.
    reasons = list(dict.fromkeys(reasons))
    warnings = list(dict.fromkeys(warnings))
    ready = not reasons

    return {
        **terminal_version_payload(),
        "status": "ready" if ready else "not_ready",
        "ready": ready,
        "alive": True,
        "startedAt": _terminal_started_at,
        "readyAt": _terminal_ready_at,
        "startupError": _stream_start_error,
        "publisherError": _terminal_state_error,
        "terminalRevision": _terminal_state_revision,
        "restartRequired": bool(
            loaded_snapshot is not None
            and database_snapshot is not None
            and not snapshot_current
        ),
        "reasons": reasons,
        "warnings": warnings,
        "recovering": bool(warnings),
        "fullStreamCoverage": bool(
            all_stream_batches_connected and not stream_errors
        ),
        "checks": {
            "streamManagerLoaded": manager_loaded,
            "feeContextLoaded": fee_context_loaded,
            "polymarketConnected": polymarket_connected,
            "kalshiConnected": kalshi_connected,
            "allStreamBatchesConnected": all_stream_batches_connected,
            "streamErrorsClear": not bool(stream_errors),
            "initialTrafficReady": _initial_traffic_ready,
            "allManifestPairsAssigned": bool(
                assignment and assignment.get("unassignedPairs") == 0
            ),
            "manifestEqualsStreamSnapshots": bool(
                coverage and coverage.get("manifestEqualsSnapshots")
            ),
            "manifestEqualsApiRows": bool(
                coverage and coverage.get("manifestEqualsEvaluated")
            ),
            "feeContextAligned": bool(
                coverage
                and coverage.get("feeContextPairs") == coverage.get("manifestPairs")
            ),
            "allRoutesAccounted": bool(
                coverage and coverage.get("allRoutesAccounted")
            ),
            "exactlyTwoRoutesPerRow": bool(
                coverage and coverage.get("malformedRouteRows") == 0
            ),
            "routeStatusesDefinitive": bool(
                coverage
                and coverage.get("genericRouteStatuses") == 0
                and coverage.get("unknownRouteStatuses") == 0
            ),
            "noPairLookupFailures": bool(
                coverage and coverage.get("pairLookupMissingRoutes") == 0
            ),
            "noPricingExceptions": bool(
                coverage and coverage.get("pricingExceptionRoutes") == 0
            ),
            "versionsAligned": versions_aligned,
            "snapshotCurrent": snapshot_current,
        },
        "snapshots": {
            "loaded": loaded_snapshot,
            "database": database_snapshot,
            "lookupError": snapshot_lookup_error,
        },
        "connections": {
            "expectedPolymarket": expected_poly_connections,
            "actualPolymarket": actual_poly_connections,
            "expectedKalshi": expected_kalshi_connections,
            "actualKalshi": actual_kalshi_connections,
        },
        "assignment": assignment,
        "coverage": coverage,
        "venueConnected": venue_connected,
        "streamErrors": stream_errors,
    }


def _route_statuses(row: Dict[str, Any]) -> List[str]:
    routes = row.get("routes")
    if not isinstance(routes, list):
        return []
    return [str(route.get("status") or "") for route in routes if isinstance(route, dict)]


def classify_terminal_opportunity(row: Dict[str, Any]) -> str:
    statuses = set(_route_statuses(row))
    settlement_verified = bool(row.get("settlementVerified"))
    settlement_status = str(row.get("settlementStatus") or "")
    has_gross = bool(statuses & {"gross_only", "net_opportunity"})
    has_net = "net_opportunity" in statuses
    has_executable = bool(statuses & EXECUTABLE_ROUTE_STATUSES)

    if settlement_verified:
        if has_net:
            return "strict_net_arbitrage"
        if has_gross:
            return "strict_gross_discrepancy"
        if has_executable:
            return "strict_comparison_only"
        return "unavailable"

    if settlement_status == "core_verified_exception_risk":
        if has_net:
            return "conditional_net_opportunity"
        if has_gross:
            return "conditional_gross_discrepancy"
        if has_executable:
            return "conditional_comparison_only"
        return "unavailable"

    # A definitively non-equivalent pair can still be priced live for side-by-
    # side comparison, but any raw price gap is never represented as arbitrage.
    if settlement_status == "rejected":
        if has_gross:
            return "comparison_price_gap"
        if has_executable:
            return "comparison_only"
        return "unavailable"

    return "unavailable"


def matches_terminal_opportunity_type(
    row: Dict[str, Any],
    opportunity_type: str,
) -> bool:
    statuses = set(_route_statuses(row))
    settlement_verified = bool(row.get("settlementVerified"))
    settlement_status = str(row.get("settlementStatus") or "")
    has_gross = bool(statuses & {"gross_only", "net_opportunity"})
    has_net = "net_opportunity" in statuses
    conditional = settlement_status == "core_verified_exception_risk"

    if opportunity_type == "all":
        return True
    # Public Gross/Net views are arbitrage views: settlement equivalence is
    # mandatory. Non-equivalent matched pairs remain fully live in All.
    if opportunity_type == "gross":
        return settlement_verified and has_gross
    if opportunity_type == "net":
        return settlement_verified and has_net
    if opportunity_type == "strict_gross":
        return settlement_verified and has_gross
    if opportunity_type == "strict_net":
        return settlement_verified and has_net
    if opportunity_type == "conditional_gross":
        return conditional and has_gross
    if opportunity_type == "conditional_net":
        return conditional and has_net
    return False


def _route_passes_thresholds(
    route: Dict[str, Any],
    *,
    min_gross_edge: float,
    min_net_edge: float,
    min_executable_contracts: float,
    min_net_profit_usd: float,
) -> bool:
    if route.get("executable") is not True:
        return False

    executable_contracts = _as_float(route.get("executableContracts"))
    if executable_contracts is None or executable_contracts < min_executable_contracts:
        return False

    if min_gross_edge > -1.0:
        gross_edge = _as_float(route.get("grossEdge"))
        if gross_edge is None or gross_edge < min_gross_edge:
            return False

    if min_net_edge > -1.0:
        net_edge = _as_float(route.get("netEdge"))
        if net_edge is None or net_edge < min_net_edge:
            return False

    if min_net_profit_usd > -1_000_000.0:
        net_profit = _as_float(route.get("netExecutableProfitUsd"))
        if net_profit is None or net_profit < min_net_profit_usd:
            return False

    return True


def _filter_terminal_rows(
    rows: Sequence[Dict[str, Any]],
    *,
    market_group: str,
    opportunity_type: str,
    live_only: bool,
    executable_only: bool,
    min_gross_edge: float,
    min_net_edge: float,
    min_executable_contracts: float,
    min_net_profit_usd: float,
) -> List[Dict[str, Any]]:
    filtered: List[Dict[str, Any]] = []

    thresholds_active = bool(
        min_gross_edge > -1.0
        or min_net_edge > -1.0
        or min_net_profit_usd > -1_000_000.0
        or min_executable_contracts > 0.0001
    )

    for row in rows:
        if market_group != "all" and row.get("marketGroup") != market_group:
            continue
        if not matches_terminal_opportunity_type(row, opportunity_type):
            continue

        routes = row.get("routes") if isinstance(row.get("routes"), list) else []
        any_executable = any(route.get("executable") is True for route in routes)

        # "Live" now means at least one independently evaluated route is
        # executable. It does not require all four asks across the pair.
        if live_only and not any_executable:
            continue

        if executable_only or thresholds_active:
            if not any(
                _route_passes_thresholds(
                    route,
                    min_gross_edge=min_gross_edge,
                    min_net_edge=min_net_edge,
                    min_executable_contracts=min_executable_contracts,
                    min_net_profit_usd=min_net_profit_usd,
                )
                for route in routes
            ):
                continue

        filtered.append(row)

    return filtered


def _sort_terminal_rows(rows: List[Dict[str, Any]], sort_by: str) -> None:
    if sort_by == "edge":
        rows.sort(
            key=lambda row: (
                _as_float(row.get("bestNetEdge"))
                if _as_float(row.get("bestNetEdge")) is not None
                else float("-inf"),
                _as_float(row.get("bestGrossEdge"))
                if _as_float(row.get("bestGrossEdge")) is not None
                else float("-inf"),
                int(bool(row.get("anyRouteReady"))),
            ),
            reverse=True,
        )
    elif sort_by == "net_profit":
        rows.sort(
            key=lambda row: (
                max(
                    (
                        _as_float(route.get("netExecutableProfitUsd"))
                        for route in row.get("routes", [])
                        if isinstance(route, dict)
                        and _as_float(route.get("netExecutableProfitUsd")) is not None
                    ),
                    default=float("-inf"),
                ),
                int(bool(row.get("anyRouteReady"))),
            ),
            reverse=True,
        )
    else:
        rows.sort(
            key=lambda row: (
                str(row.get("eventTitle") or ""),
                str(row.get("contractTitle") or ""),
            )
        )


def run_scan(
    *,
    market_group: str,
    opportunity_type: str,
    min_gross_edge: float,
    time_window: str,
    sort_by: str,
    timezone_offset_minutes: int,
    limit: int,
):
    try:
        return scan_prediction_market_discrepancies(
            market_group=market_group,
            opportunity_type=opportunity_type,
            min_gross_edge=min_gross_edge,
            time_window=time_window,
            sort_by=sort_by,
            timezone_offset_minutes=timezone_offset_minutes,
            limit=limit,
        )
    except Exception as exc:
        LOGGER.exception("Prediction-market engine scan failed.")
        raise HTTPException(
            status_code=503,
            detail="The prediction-market comparison engine is temporarily unavailable.",
        ) from exc


@router.get("/summary")
def get_prediction_market_summary(
    timezone_offset_minutes: int = Query(0, ge=-840, le=840),
    _user: Dict[str, Any] = Depends(require_prediction_user),
):
    payload = run_scan(
        market_group="all",
        opportunity_type="all",
        min_gross_edge=-1.0,
        time_window="all",
        sort_by="time",
        timezone_offset_minutes=timezone_offset_minutes,
        limit=1,
    )
    return {
        **payload["summary"],
        "generatedAt": payload["generatedAt"],
        "cached": payload["cached"],
    }


@router.get("/discrepancies")
def get_prediction_market_discrepancies(
    market_group: str = Query("all"),
    opportunity_type: Literal["all", "gross", "net", "watchlist"] = Query("all"),
    min_gross_edge: float = Query(-1.0, ge=-1.0, le=1.0),
    time_window: Literal["all", "live", "today", "upcoming"] = Query("all"),
    sort_by: Literal["time", "edge"] = Query("time"),
    timezone_offset_minutes: int = Query(0, ge=-840, le=840),
    limit: int = Query(100, ge=1, le=1000),
    _user: Dict[str, Any] = Depends(require_prediction_user),
):
    return run_scan(
        market_group=market_group,
        opportunity_type=opportunity_type,
        min_gross_edge=min_gross_edge,
        time_window=time_window,
        sort_by=sort_by,
        timezone_offset_minutes=timezone_offset_minutes,
        limit=limit,
    )


@router.get("/terminal/health")
async def get_terminal_health():
    # Render/public traffic should not be routed to a cold process. Once the
    # first shared snapshot exists, transient venue issues are represented in
    # the terminal data/readiness endpoint rather than causing platform restarts.
    ready_for_traffic = bool(
        _initial_traffic_ready
        and _stream_start_error is None
        and _stream_manager is not None
        and _live_fee_context is not None
        and _terminal_state is not None
    )
    payload = {
        **terminal_version_payload(),
        "status": "ready" if ready_for_traffic else "starting",
        "alive": True,
        "readyForTraffic": ready_for_traffic,
        "startedAt": _terminal_started_at,
        "readyAt": _terminal_ready_at,
        "startupError": _stream_start_error,
        "publisherError": _terminal_state_error,
        "terminalRevision": _terminal_state_revision,
    }
    return JSONResponse(
        status_code=200 if ready_for_traffic else 503,
        content=payload,
    )


@router.get("/terminal/readiness")
async def get_terminal_readiness(
    _user: Dict[str, Any] = Depends(require_prediction_user),
):
    payload = await build_terminal_readiness_payload()
    return JSONResponse(
        status_code=200 if payload["ready"] else 503,
        content=payload,
    )


@router.get("/terminal/status")
async def get_terminal_status(
    _user: Dict[str, Any] = Depends(require_prediction_user),
):
    manager = get_stream_manager()
    fee_context = get_live_fee_context()
    state = get_terminal_state()
    assignment = _stream_assignment_audit(manager)
    return {
        **terminal_version_payload(),
        **(state.get("streamStatus") or {}),
        "feePricing": state.get("feePricing") or fee_context.summary(),
        "assignment": assignment,
        "coverage": state.get("coverage") or {},
        "terminalRevision": _terminal_state_revision,
        "publisherError": _terminal_state_error,
    }


def _terminal_payload_cache_key(
    *,
    market_group: str,
    opportunity_type: str,
    live_only: bool,
    executable_only: bool,
    min_gross_edge: float,
    min_net_edge: float,
    min_executable_contracts: float,
    min_net_profit_usd: float,
    sort_by: str,
    limit: int,
) -> Tuple[Any, ...]:
    return (
        market_group,
        opportunity_type,
        bool(live_only),
        bool(executable_only),
        float(min_gross_edge),
        float(min_net_edge),
        float(min_executable_contracts),
        float(min_net_profit_usd),
        sort_by,
        int(limit),
    )


def build_terminal_overview_payload(
    *,
    market_group: str = "all",
    opportunity_type: str = "all",
    live_only: bool = False,
    executable_only: bool = False,
    min_gross_edge: float = -1.0,
    min_net_edge: float = -1.0,
    min_executable_contracts: float = 0.0001,
    min_net_profit_usd: float = -1_000_000.0,
    sort_by: str = "edge",
    limit: int = 2000,
) -> Dict[str, Any]:
    """Filter one process-wide priced snapshot; never reprice per request/user."""
    state = get_terminal_state()
    revision = _terminal_state_revision
    cache_key = _terminal_payload_cache_key(
        market_group=market_group,
        opportunity_type=opportunity_type,
        live_only=live_only,
        executable_only=executable_only,
        min_gross_edge=min_gross_edge,
        min_net_edge=min_net_edge,
        min_executable_contracts=min_executable_contracts,
        min_net_profit_usd=min_net_profit_usd,
        sort_by=sort_by,
        limit=limit,
    )
    cached = _terminal_payload_cache.get(cache_key)
    if cached is not None and cached[0] == revision:
        return cached[1]

    all_rows = list(state.get("rows") or [])
    rows = _filter_terminal_rows(
        all_rows,
        market_group=market_group,
        opportunity_type=opportunity_type,
        live_only=live_only,
        executable_only=executable_only,
        min_gross_edge=min_gross_edge,
        min_net_edge=min_net_edge,
        min_executable_contracts=min_executable_contracts,
        min_net_profit_usd=min_net_profit_usd,
    )
    _sort_terminal_rows(rows, sort_by)

    # Stable All Markets mode must never truncate the manifest because the
    # browser uses it as the catalog of every matched contract in this process.
    stable_catalog_mode = bool(
        market_group == "all"
        and opportunity_type == "all"
        and not live_only
        and not executable_only
        and min_gross_edge <= -1.0
        and min_net_edge <= -1.0
        and min_net_profit_usd <= -1_000_000.0
        and min_executable_contracts <= 0.0001
    )
    returned = rows if stable_catalog_mode else rows[:limit]

    payload = {
        **terminal_version_payload(),
        "generatedAt": state.get("generatedAt") or utc_now_iso(),
        "pricingMode": "live-fee-aware-route-accounted",
        "feeAware": True,
        "transport": "server-websocket-ready",
        "streamStatus": state.get("streamStatus") or {},
        "feePricing": state.get("feePricing") or {},
        "coverage": state.get("coverage") or {},
        "filters": {
            "marketGroup": market_group,
            "opportunityType": opportunity_type,
            "liveOnly": live_only,
            "executableOnly": executable_only,
            "minGrossEdge": min_gross_edge,
            "minNetEdge": min_net_edge,
            "minExecutableContracts": min_executable_contracts,
            "minNetProfitUsd": min_net_profit_usd,
            "sortBy": sort_by,
            "requestedLimit": limit,
            "limitApplied": not stable_catalog_mode,
        },
        "catalogRows": len(all_rows),
        "matchedRowsBeforeLimit": len(rows),
        "returnedRows": len(returned),
        "opportunities": returned,
    }
    if len(_terminal_payload_cache) >= TERMINAL_PAYLOAD_CACHE_MAX_ENTRIES:
        _terminal_payload_cache.clear()
    _terminal_payload_cache[cache_key] = (revision, payload)
    return payload


def build_terminal_websocket_message(**params: Any) -> str:
    """Serialize each query/revision once, then reuse the exact text for all clients."""
    revision = _terminal_state_revision
    cache_key = _terminal_payload_cache_key(**params)
    cached = _terminal_ws_message_cache.get(cache_key)
    if cached is not None and cached[0] == revision:
        return cached[1]

    payload = build_terminal_overview_payload(**params)
    message = json.dumps(
        {"type": "terminal_overview", "payload": payload},
        separators=(",", ":"),
        default=str,
    )
    if len(_terminal_ws_message_cache) >= TERMINAL_PAYLOAD_CACHE_MAX_ENTRIES:
        _terminal_ws_message_cache.clear()
    _terminal_ws_message_cache[cache_key] = (revision, message)
    return message


@router.get("/terminal/overview")
async def get_terminal_overview(
    market_group: str = Query("all"),
    opportunity_type: Literal[
        "all",
        "gross",
        "net",
        "strict_gross",
        "strict_net",
        "conditional_gross",
        "conditional_net",
    ] = Query("all"),
    live_only: bool = Query(False),
    executable_only: bool = Query(False),
    min_gross_edge: float = Query(-1.0, ge=-1.0, le=1.0),
    min_net_edge: float = Query(-1.0, ge=-1.0, le=1.0),
    min_executable_contracts: float = Query(0.0001, ge=0.0),
    min_net_profit_usd: float = Query(-1_000_000.0),
    sort_by: Literal["edge", "net_profit", "event"] = Query("edge"),
    limit: int = Query(2000, ge=1, le=5000),
    _user: Dict[str, Any] = Depends(require_prediction_user),
):
    return build_terminal_overview_payload(
        market_group=market_group,
        opportunity_type=opportunity_type,
        live_only=live_only,
        executable_only=executable_only,
        min_gross_edge=min_gross_edge,
        min_net_edge=min_net_edge,
        min_executable_contracts=min_executable_contracts,
        min_net_profit_usd=min_net_profit_usd,
        sort_by=sort_by,
        limit=limit,
    )


def _query_bool(websocket: WebSocket, name: str, default: bool) -> bool:
    value = websocket.query_params.get(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _query_float(websocket: WebSocket, name: str, default: float) -> float:
    value = websocket.query_params.get(name)
    if value in (None, ""):
        return default
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _query_int(websocket: WebSocket, name: str, default: int) -> int:
    value = websocket.query_params.get(name)
    if value in (None, ""):
        return default
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


@router.websocket("/terminal/ws")
async def terminal_websocket(websocket: WebSocket):
    """Push consolidated route-accounted snapshots to an authenticated browser."""
    if not websocket_origin_allowed(websocket):
        await websocket.close(code=1008)
        return

    protocols = _websocket_protocols(websocket)
    selected_subprotocol: Optional[str] = None
    websocket_user_id: Optional[str] = None
    websocket_slot_acquired = False

    if PREDICTION_REQUIRE_USER_AUTH:
        token = _websocket_access_token(websocket)
        if not token:
            await websocket.close(code=1008)
            return
        try:
            user = await verify_prediction_access_token(token)
        except PredictionAuthError:
            await websocket.close(code=1008)
            return

        websocket_user_id = str(user.get("id") or "").strip()
        if not websocket_user_id or not await _acquire_prediction_ws_slot(websocket_user_id):
            await websocket.close(code=1008)
            return
        websocket_slot_acquired = True
        selected_subprotocol = WS_AUTH_PROTOCOL
    elif WS_AUTH_PROTOCOL in protocols:
        selected_subprotocol = WS_AUTH_PROTOCOL

    await websocket.accept(subprotocol=selected_subprotocol)

    market_group = websocket.query_params.get("market_group", "all")
    if market_group not in {"all", "sports", "macro", "weather"}:
        market_group = "all"

    opportunity_type = websocket.query_params.get("opportunity_type", "all")
    if opportunity_type not in TERMINAL_OPPORTUNITY_TYPES:
        opportunity_type = "all"

    sort_by = websocket.query_params.get("sort_by", "net_profit")
    if sort_by not in {"edge", "net_profit", "event"}:
        sort_by = "net_profit"

    params = {
        "market_group": market_group,
        "opportunity_type": opportunity_type,
        "live_only": _query_bool(websocket, "live_only", False),
        "executable_only": _query_bool(websocket, "executable_only", False),
        "min_gross_edge": max(
            -1.0,
            min(1.0, _query_float(websocket, "min_gross_edge", -1.0)),
        ),
        "min_net_edge": max(
            -1.0,
            min(1.0, _query_float(websocket, "min_net_edge", -1.0)),
        ),
        "min_executable_contracts": max(
            0.0,
            _query_float(websocket, "min_executable_contracts", 0.0001),
        ),
        "min_net_profit_usd": _query_float(
            websocket,
            "min_net_profit_usd",
            -1_000_000.0,
        ),
        "sort_by": sort_by,
        "limit": max(1, min(5000, _query_int(websocket, "limit", 2000))),
    }

    last_revision = -1

    try:
        while True:
            # Wait for the singleton publisher. No browser performs engine
            # pricing and no browser polls the live books independently.
            current_revision = await _wait_for_terminal_revision(
                last_revision,
                timeout=15.0,
            )
            if current_revision == last_revision:
                await websocket.send_text(
                    json.dumps(
                        {
                            "type": "heartbeat",
                            "terminalRevision": current_revision,
                        },
                        separators=(",", ":"),
                    )
                )
                continue

            await websocket.send_text(
                build_terminal_websocket_message(**params)
            )
            last_revision = current_revision

    except WebSocketDisconnect:
        return
    except Exception as exc:  # noqa: BLE001
        LOGGER.exception("Prediction-market browser WebSocket failed.")
        try:
            await websocket.send_json({"type": "error", "detail": str(exc)})
        except Exception:  # noqa: BLE001
            pass
        try:
            await websocket.close(code=1011)
        except Exception:  # noqa: BLE001
            pass
    finally:
        if websocket_slot_acquired:
            await _release_prediction_ws_slot(websocket_user_id)


def routes_self_test() -> Dict[str, Any]:
    """Pure filtering/classification test; no database or live streams needed."""
    ready_net = {
        "marketGroup": "misc",
        "settlementVerified": True,
        "settlementStatus": "strict_verified",
        "anyRouteReady": True,
        "routes": [
            {
                "status": "net_opportunity",
                "executable": True,
                "grossEdge": 0.04,
                "netEdge": 0.02,
                "executableContracts": 10.0,
                "netExecutableProfitUsd": 0.2,
            },
            {
                "status": "no_opportunity",
                "executable": True,
                "grossEdge": -0.02,
                "netEdge": -0.03,
                "executableContracts": 5.0,
                "netExecutableProfitUsd": -0.15,
            },
        ],
    }
    partial = {
        "marketGroup": "sports",
        "settlementVerified": False,
        "settlementStatus": "core_verified_exception_risk",
        "anyRouteReady": True,
        "routes": [
            {
                "status": "gross_only",
                "executable": True,
                "grossEdge": 0.01,
                "netEdge": -0.005,
                "executableContracts": 4.0,
                "netExecutableProfitUsd": -0.02,
            },
            {
                "status": "missing_kalshi_ask",
                "executable": False,
                "grossEdge": None,
                "netEdge": None,
                "executableContracts": 0.0,
                "netExecutableProfitUsd": None,
            },
        ],
    }
    rejected_comparison = {
        "marketGroup": "companies",
        "settlementVerified": False,
        "settlementStatus": "rejected",
        "anyRouteReady": True,
        "routes": [
            {
                "status": "net_opportunity",
                "executable": True,
                "grossEdge": 0.03,
                "netEdge": 0.01,
                "executableContracts": 3.0,
                "netExecutableProfitUsd": 0.03,
            },
            {
                "status": "no_opportunity",
                "executable": True,
                "grossEdge": -0.03,
                "netEdge": -0.04,
                "executableContracts": 3.0,
                "netExecutableProfitUsd": -0.12,
            },
        ],
    }
    unavailable = {
        "marketGroup": "macro",
        "settlementVerified": True,
        "settlementStatus": "strict_verified",
        "anyRouteReady": False,
        "routes": [
            {"status": "snapshot_unavailable", "executable": False},
            {"status": "missing_polymarket_ask", "executable": False},
        ],
    }

    rows = [ready_net, partial, rejected_comparison, unavailable]
    kwargs = dict(
        market_group="all",
        live_only=False,
        executable_only=False,
        min_gross_edge=-1.0,
        min_net_edge=-1.0,
        min_executable_contracts=0.0001,
        min_net_profit_usd=-1_000_000.0,
    )
    all_rows = _filter_terminal_rows(rows, opportunity_type="all", **kwargs)
    gross_rows = _filter_terminal_rows(rows, opportunity_type="gross", **kwargs)
    strict_net_rows = _filter_terminal_rows(
        rows, opportunity_type="strict_net", **kwargs
    )
    conditional_gross_rows = _filter_terminal_rows(
        rows, opportunity_type="conditional_gross", **kwargs
    )

    # Regression: a partially available route can legitimately have one numeric
    # net profit and one None. Net-profit sorting must ignore missing values
    # instead of comparing float to None.
    net_profit_sorted_rows = list(all_rows)
    _sort_terminal_rows(net_profit_sorted_rows, "net_profit")

    assert len(all_rows) == 4
    assert len(gross_rows) == 1
    assert len(strict_net_rows) == 1
    assert len(conditional_gross_rows) == 1
    assert rejected_comparison in all_rows
    assert rejected_comparison not in gross_rows
    assert classify_terminal_opportunity(ready_net) == "strict_net_arbitrage"
    assert classify_terminal_opportunity(partial) == "conditional_gross_discrepancy"
    assert (
        classify_terminal_opportunity(rejected_comparison)
        == "comparison_price_gap"
    )
    assert classify_terminal_opportunity(unavailable) == "unavailable"

    authorization_header_parsing = (
        _bearer_from_authorization_header("Bearer test-token") == "test-token"
        and _bearer_from_authorization_header("Basic test-token") is None
        and _bearer_from_authorization_header("") is None
    )

    return {
        "apiContractVersion": TERMINAL_API_CONTRACT_VERSION,
        "engineVersion": ENGINE_VERSION,
        "streamsVersion": STREAMS_VERSION,
        "status": "passed",
        "allRowsPreserved": len(all_rows) == 4,
        "grossFilterRows": len(gross_rows),
        "strictNetFilterRows": len(strict_net_rows),
        "conditionalGrossFilterRows": len(conditional_gross_rows),
        "rejectedComparisonPreserved": rejected_comparison in all_rows,
        "rejectedComparisonExcludedFromGross": (
            rejected_comparison not in gross_rows
        ),
        "partialPairPreserved": partial in all_rows,
        "unavailablePairPreserved": unavailable in all_rows,
        "netProfitSortNoneSafe": len(net_profit_sorted_rows) == len(all_rows),
        "authorizationHeaderParsing": authorization_header_parsing,
    }


if __name__ == "__main__":
    print(json.dumps(routes_self_test(), indent=2))
