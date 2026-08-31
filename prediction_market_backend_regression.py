from __future__ import annotations

import argparse
import inspect
import json
import os
import time
import traceback
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter
from pathlib import Path
from typing import Any, Callable, Dict, Iterable, Mapping, Optional, Sequence

from prediction_market_engine import (
    ENGINE_VERSION,
    EXECUTABLE_ROUTE_STATUSES,
    GENERIC_MARKET_GROUPS,
    UNAVAILABLE_ROUTE_STATUSES,
    build_exact_pair_context,
    route_pricing_self_test,
)
from prediction_market_settlement import (
    SETTLEMENT_VERSION,
    _sports_resolution_compatible,
    calendar_resolution_window,
    cancellation_policy,
    game_scope,
    postponement_policy,
    tie_policy,
)
from prediction_market_streams import (
    STREAMS_VERSION,
    build_stream_manifest,
    self_test as stream_self_test,
)
from prediction_markets_routes import (
    GENERIC_ROUTE_STATUSES,
    TERMINAL_API_CONTRACT_VERSION,
    TERMINAL_ROUTE_STATUSES,
    routes_self_test,
)


REGRESSION_VERSION = "prediction-backend-regression-v4.8-zero-epoch-delta-verified"
DEFAULT_API_URL = "http://127.0.0.1:8000"
DEFAULT_REPORT = "prediction_market_backend_regression_report.json"
LIVE_BEARER_TOKEN = ""

PAIR_STATUSES = {"ready", "partially_ready", "unavailable"}
OPPORTUNITY_CLASSES = {
    "strict_net_arbitrage",
    "strict_gross_discrepancy",
    "strict_comparison_only",
    "conditional_net_opportunity",
    "conditional_gross_discrepancy",
    "conditional_comparison_only",
    "comparison_price_gap",
    "comparison_only",
    "unavailable",
}

TOP_LEVEL_KEYS = {
    "apiContractVersion",
    "engineVersion",
    "settlementVersion",
    "streamsVersion",
    "generatedAt",
    "pricingMode",
    "feeAware",
    "transport",
    "marketGroup",
    "terminalRevision",
    "catalogEpoch",
    "streamStatus",
    "filters",
    "catalogRows",
    "matchedRowsBeforeLimit",
    "returnedRows",
    "opportunities",
    "financeInventory",
}

ROW_KEYS = {
    "id",
    "marketGroup",
    "eventTitle",
    "contractTitle",
    "pairRelationship",
    "settlementStatus",
    "settlementVerified",
    "opportunityClass",
    "pairStatus",
    "pricingStatus",
    "readyRouteCount",
    "accountedRouteCount",
    "allRoutesAccounted",
    "anyRouteReady",
    "routes",
    "polymarket",
    "kalshi",
}

ROUTE_KEYS = {
    "key",
    "status",
    "executable",
    "polymarket",
    "kalshi",
    "depthAvailable",
}

LEG_KEYS = {
    "side",
    "status",
    "executable",
}


COVERAGE_KEYS = {
    "manifestPairs",
    "streamSnapshotPairs",
    "evaluatedPairs",
    "feeContextPairs",
    "expectedRoutes",
    "accountedRoutes",
    "malformedRouteRows",
    "genericRouteStatuses",
    "unknownRouteStatuses",
    "pairLookupMissingRoutes",
    "pricingExceptionRoutes",
    "manifestEqualsSnapshots",
    "manifestEqualsEvaluated",
    "allRoutesAccounted",
    "routeStatusCounts",
    "pairStatusCounts",
}


class ApiNotReadyError(AssertionError):
    pass


def require(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def require_keys(mapping: Mapping[str, Any], keys: Iterable[str], label: str) -> None:
    missing = sorted(set(keys) - set(mapping))
    require(not missing, f"{label} missing keys: {missing}")


def as_float(value: Any) -> Optional[float]:
    try:
        if value in (None, ""):
            return None
        return float(value)
    except (TypeError, ValueError):
        return None


def http_json(
    base_url: str,
    path: str,
    *,
    timeout: float = 30.0,
    allow_http_error: bool = False,
) -> Dict[str, Any]:
    url = f"{base_url.rstrip('/')}{path}"
    headers = {"Accept": "application/json"}
    if LIVE_BEARER_TOKEN:
        headers["Authorization"] = f"Bearer {LIVE_BEARER_TOKEN}"

    request = urllib.request.Request(
        url,
        headers=headers,
        method="GET",
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        if exc.code == 401:
            raise AssertionError(
                f"GET {url} returned 401. Supply a valid Bullionaire Supabase "
                "access token with --bearer-token or the "
                "PREDICTION_REGRESSION_BEARER_TOKEN environment variable."
            ) from exc
        if allow_http_error:
            try:
                payload = json.loads(body)
            except json.JSONDecodeError as json_exc:
                raise AssertionError(
                    f"GET {url} returned {exc.code} with non-JSON body: {body}"
                ) from json_exc
        else:
            raise AssertionError(f"GET {url} returned {exc.code}: {body}") from exc
    except urllib.error.URLError as exc:
        raise ApiNotReadyError(f"GET {url} failed: {exc.reason}") from exc

    require(isinstance(payload, dict), f"GET {url} did not return an object")
    return payload


def expect_http_unauthorized(base_url: str, path: str) -> None:
    url = f"{base_url.rstrip('/')}{path}"
    request = urllib.request.Request(
        url,
        headers={"Accept": "application/json"},
        method="GET",
    )
    try:
        with urllib.request.urlopen(request, timeout=30.0) as response:
            body = response.read().decode("utf-8", errors="replace")
            raise AssertionError(
                f"Unauthenticated GET {url} unexpectedly returned "
                f"{response.status}: {body[:300]}"
            )
    except urllib.error.HTTPError as exc:
        if exc.code != 401:
            body = exc.read().decode("utf-8", errors="replace")
            raise AssertionError(
                f"Unauthenticated GET {url} should return 401, "
                f"got {exc.code}: {body[:300]}"
            ) from exc


def wait_for_readiness(
    base_url: str,
    *,
    startup_timeout_seconds: int,
    poll_seconds: float = 2.0,
) -> Dict[str, Any]:
    deadline = time.monotonic() + startup_timeout_seconds
    last_payload: Optional[Dict[str, Any]] = None
    last_error: Optional[str] = None

    while time.monotonic() < deadline:
        try:
            last_payload = http_json(
                base_url,
                "/api/prediction-markets/terminal/readiness",
                timeout=30.0,
                allow_http_error=True,
            )
            if last_payload.get("ready") is True:
                return last_payload
            last_error = str(last_payload.get("reasons") or "not_ready")
        except Exception as exc:  # noqa: BLE001 - startup polling reports last state
            last_error = f"{type(exc).__name__}: {exc}"
        time.sleep(poll_seconds)

    raise ApiNotReadyError(
        "terminal did not become ready within "
        f"{startup_timeout_seconds}s; last diagnostic: {last_error}; "
        f"last payload: {last_payload}"
    )


def parser_checks() -> None:
    require(
        calendar_resolution_window("by the end of January 2027")
        == "deadline-2027-01-31",
        "end-of-month normalization failed",
    )
    require(
        calendar_resolution_window("by January 31, 2027")
        == "deadline-2027-01-31",
        "explicit deadline normalization failed",
    )
    require(
        calendar_resolution_window("before February 1, 2027")
        == "deadline-2027-01-31",
        "exclusive deadline normalization failed",
    )
    require(
        calendar_resolution_window("by January 31, 2027")
        != calendar_resolution_window("by February 28, 2027"),
        "different macro deadlines were treated as equal",
    )

    for left, right in (
        ("2026-08-31", "2026-09-01"),
        ("2026-12-31", "2027-01-01"),
        ("2027-02-28", "2027-03-01"),
        ("2028-02-29", "2028-03-01"),
    ):
        require(
            _sports_resolution_compatible(left, right),
            f"valid year-round sports boundary rejected: {left} / {right}",
        )

    for left, right in (
        ("2026-07-25", "2026-08-01"),
        ("2027-01-31", "2027-02-28"),
        ("2028-02-28", "2028-03-01"),
    ):
        require(
            not _sports_resolution_compatible(left, right),
            f"different sports dates treated as equal: {left} / {right}",
        )

    require(
        game_scope(
            "after 90 minutes plus stoppage time does not include "
            "extra time or penalties"
        )
        == "regulation_only",
        "regulation-only scope detection failed",
    )
    require(
        game_scope("final score including any overtime periods")
        == "full_event_including_overtime",
        "overtime scope detection failed",
    )
    require(
        tie_policy(
            "If the game ends in a tie, the market resolves to $0.50 "
            "for each team"
        )
        == "split_50_50",
        "tie policy detection failed",
    )
    require(
        cancellation_policy(
            "If the game is cancelled, the market resolves to a fair price"
        )
        == "fair_price",
        "cancellation policy detection failed",
    )
    require(
        postponement_policy(
            "If the game is postponed, this market will remain open until "
            "the game has been completed"
        )
        == "wait_until_completed",
        "postponement policy detection failed",
    )


def component_self_tests(state: Dict[str, Any]) -> None:
    engine_result = route_pricing_self_test()
    stream_result = stream_self_test()
    routes_result = routes_self_test()

    state["componentSelfTests"] = {
        "engine": engine_result,
        "streams": stream_result,
        "routes": routes_result,
    }

    require(engine_result.get("status") == "passed", "engine route self-test failed")
    require(stream_result.get("status") == "passed", "stream self-test failed")
    require(routes_result.get("status") == "passed", "routes self-test failed")

    require(
        engine_result.get("partialPairStatus") == "partially_ready",
        "engine did not preserve a partially ready pair",
    )
    require(
        engine_result.get("unavailableRouteCount") == 2,
        "engine did not account for both unavailable routes",
    )
    require(
        engine_result.get("zeroDepthStatus") == "zero_polymarket_depth",
        "engine zero-depth reason is not venue-specific",
    )
    require(
        engine_result.get("missingAskStatus") == "missing_kalshi_ask",
        "engine missing-ask reason is not venue-specific",
    )
    require(
        engine_result.get("tinyDepthPreserved") is True,
        "engine rounded positive executable depth down to zero",
    )
    require(
        engine_result.get("lifecycleTimingFieldsPresent") is True,
        "engine did not expose contract lifecycle timing for APY",
    )
    require(
        stream_result.get("tradeOnlyDoesNotReprice") is True,
        "trade-only telemetry still triggers global repricing",
    )
    require(
        stream_result.get("quietBookRemainsReady") is True,
        "quiet initialized stream book became stale",
    )
    require(
        stream_result.get("reconnectRequiresSnapshot") is True,
        "reconnect did not require a fresh snapshot",
    )
    require(
        stream_result.get("initialSnapshotTimeoutVerified") is True,
        "initial snapshot timeout was not verified",
    )
    require(
        stream_result.get("kalshiFloatDustRemoved") is True,
        "Kalshi float residue was not removed",
    )
    require(
        stream_result.get("tinyValidDepthPreserved") is True,
        "legitimate micro-depth was removed by the dust threshold",
    )
    require(
        routes_result.get("allRowsPreserved") is True,
        "routes layer did not preserve all rows",
    )
    require(
        routes_result.get("partialPairPreserved") is True,
        "routes layer dropped a partially ready pair",
    )
    require(
        routes_result.get("unavailablePairPreserved") is True,
        "routes layer dropped an unavailable pair",
    )
    require(
        routes_result.get("rejectedComparisonPreserved") is True,
        "routes layer dropped a rejected-but-comparable pair",
    )
    require(
        routes_result.get("rejectedComparisonExcludedFromGross") is True,
        "rejected settlement pair leaked into gross arbitrage filtering",
    )
    require(
        routes_result.get("authorizationHeaderParsing") is True,
        "prediction API authorization header parsing failed",
    )
    require(
        routes_result.get("browserProjectionCompact") is True,
        "browser projection still leaks full terminal rows",
    )
    require(
        routes_result.get("browserDepthOnDemand") is True,
        "browser depth is not one-row-on-demand",
    )
    require(
        routes_result.get("browserRevisionCatchupUsesMergedDelta") is True,
        "browser revision catch-up still falls back to repeated full snapshots",
    )
    require(
        routes_result.get("browserZeroCatalogEpochCatchup") is True,
        "browser delta catch-up failed for initial catalog epoch 0",
    )


def context_checks(state: Dict[str, Any]) -> None:
    # Regression compatibility should be behavior/contract based. Engine and
    # stream implementation version strings may advance without invalidating
    # the API contract, so avoid hard-coding a specific implementation version.
    require(bool(ENGINE_VERSION), "engine version is empty")
    require(bool(STREAMS_VERSION), "streams version is empty")
    require(
        TERMINAL_API_CONTRACT_VERSION
        == "prediction-terminal-api-v2.3-lean-delta",
        f"unexpected API contract version: {TERMINAL_API_CONTRACT_VERSION}",
    )
    require(
        SETTLEMENT_VERSION.startswith("settlement-verifier-v2"),
        SETTLEMENT_VERSION,
    )

    context = build_exact_pair_context("all")
    state["context"] = context

    require(len(context.exact_pairs) > 0, "no exact pairs were built")
    require(
        len(context.exact_pairs)
        == len(context.sports_pairs)
        + len(context.macro_pairs)
        + len(context.weather_pairs)
        + len(context.generic_pairs),
        "exact pair group counts do not reconcile",
    )

    unique_keys = set()
    allowed_settlement_statuses = {
        "strict_verified",
        "core_verified_exception_risk",
        "rejected",
    }

    for poly, kalshi in context.exact_pairs:
        require(poly.venue == "polymarket", "pair left side is not Polymarket")
        require(kalshi.venue == "kalshi", "pair right side is not Kalshi")
        require(poly.market_group == kalshi.market_group, "market group mismatch")
        require(poly.event_identity == kalshi.event_identity, "event identity mismatch")
        require(
            poly.contract_identity == kalshi.contract_identity,
            "contract identity mismatch",
        )
        require(
            poly.settlement_status in allowed_settlement_statuses,
            f"unapproved settlement status: {poly.settlement_status}",
        )
        require(
            poly.settlement_status == kalshi.settlement_status,
            "pair settlement statuses disagree",
        )
        require(
            poly.settlement_stream_eligible and kalshi.settlement_stream_eligible,
            "non-stream-eligible pair reached the exact context",
        )
        require(
            poly.settlement_verified == kalshi.settlement_verified,
            "pair settlement verification flags disagree",
        )
        require(
            poly.settlement_verified
            == (poly.settlement_status == "strict_verified"),
            "settlementVerified does not match settlementStatus",
        )

        key = (
            poly.market_group,
            poly.market_id,
            kalshi.market_id,
            poly.contract_identity,
        )
        require(key not in unique_keys, f"duplicate exact pair: {key}")
        unique_keys.add(key)

    diagnostics = context.diagnostics
    for group in ("sports", "macro", "weather", "generic"):
        candidates = int(diagnostics.get(f"{group}SettlementCandidates", 0))
        eligible = int(
            diagnostics.get(f"{group}SettlementStreamEligiblePairs", 0)
        )
        excluded = int(
            diagnostics.get(f"{group}SettlementExcludedFromPricingPairs", 0)
        )
        statuses = diagnostics.get(f"{group}SettlementStatuses", {})
        require(
            candidates == sum(int(value) for value in statuses.values()),
            f"{group} status totals do not reconcile",
        )
        require(
            candidates == eligible + excluded,
            f"{group} live-pricing admission totals do not reconcile",
        )

    # Sports may apply a deliberate post-settlement runtime cap (currently
    # soccer-only). Settlement diagnostics describe the pre-runtime-prune
    # eligible set, so use the post-prune sports count when it is present.
    expected_sports_runtime = int(
        diagnostics.get(
            "sportsPairsAfterFinancePriorityPrune",
            diagnostics.get("sportsSettlementStreamEligiblePairs", 0),
        )
    )
    expected_exact = expected_sports_runtime + sum(
        int(diagnostics.get(f"{group}SettlementStreamEligiblePairs", 0))
        for group in ("macro", "weather", "generic")
    )
    require(
        len(context.exact_pairs) == expected_exact,
        "runtime exact-pair count differs from post-settlement admitted counts",
    )
    if "soccerRuntimePairLimit" in diagnostics:
        require(
            int(diagnostics.get("soccerPairsAfterPriorityPrune", 0))
            <= int(diagnostics.get("soccerRuntimePairLimit", 0)),
            "soccer runtime hard cap was exceeded",
        )
        require(
            diagnostics.get("soccerCapTouchesOnlySoccer") is True,
            "soccer runtime cap touched non-soccer sports",
        )

    admitted_external = set()
    for poly, kalshi in context.exact_pairs:
        poly_market = context.markets[poly.market_id]
        kalshi_market = context.markets[kalshi.market_id]
        admitted_external.add(
            (
                str(poly_market.external_market_id),
                str(kalshi_market.external_market_id),
            )
        )

    for sample in diagnostics.get("sportsSettlementRejectedSamples", []):
        rejected_key = (
            str(sample.get("polymarketMarketId") or ""),
            str(sample.get("kalshiMarketId") or ""),
        )
        require(
            rejected_key not in admitted_external,
            f"rejected sports pair entered context: {rejected_key}",
        )


def manifest_checks(state: Dict[str, Any]) -> None:
    context = state["context"]
    parameters = inspect.signature(build_stream_manifest).parameters
    manifest = (
        build_stream_manifest("all", context=context)
        if "context" in parameters
        else build_stream_manifest("all")
    )
    state["manifest"] = manifest

    require(manifest.engine_version == ENGINE_VERSION, "manifest engine mismatch")
    require(manifest.streams_version == STREAMS_VERSION, "manifest version mismatch")
    require(
        str(manifest.snapshot_marker) == str(context.snapshot_marker),
        "manifest and engine snapshots differ",
    )
    require(
        len(manifest.pairs) == len(context.exact_pairs),
        "manifest did not include every exact pair",
    )

    pair_ids = [pair.id for pair in manifest.pairs]
    require(len(pair_ids) == len(set(pair_ids)), "duplicate manifest pair IDs")
    require(bool(manifest.polymarket_asset_ids), "no Polymarket assets in manifest")
    require(bool(manifest.kalshi_market_tickers), "no Kalshi tickers in manifest")

    expected_inventory = tuple(getattr(context, "finance_inventory", ()) or ())
    manifest_inventory = tuple(getattr(manifest, "inventory", ()) or ())
    require(
        len(manifest_inventory) == len(expected_inventory),
        "manifest finance inventory does not match engine context",
    )
    inventory_ids = [str(item.id) for item in manifest_inventory]
    require(len(inventory_ids) == len(set(inventory_ids)), "duplicate finance inventory IDs")
    for item in manifest_inventory:
        require(item.venue in {"polymarket", "kalshi"}, f"unknown finance venue: {item.venue}")
        require(item.market_group in {"companies", "macro"}, f"unknown finance group: {item.market_group}")

    for pair in manifest.pairs:
        require(bool(pair.polymarket_yes_asset_id), f"missing YES asset: {pair.id}")
        require(bool(pair.polymarket_no_asset_id), f"missing NO asset: {pair.id}")
        require(bool(pair.kalshi_market_ticker), f"missing Kalshi ticker: {pair.id}")


def expected_opportunity_class(row: Mapping[str, Any]) -> str:
    statuses = {
        str(route.get("status") or "")
        for route in row.get("routes", [])
        if isinstance(route, Mapping)
    }
    verified = bool(row.get("settlementVerified"))
    settlement_status = str(row.get("settlementStatus") or "")
    has_gross = bool(statuses & {"gross_only", "net_opportunity"})
    has_net = "net_opportunity" in statuses
    has_executable = bool(statuses & EXECUTABLE_ROUTE_STATUSES)

    if verified:
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

    if settlement_status == "rejected":
        if has_gross:
            return "comparison_price_gap"
        if has_executable:
            return "comparison_only"
        return "unavailable"

    return "unavailable"


def route_invariant_checks(row: Mapping[str, Any], route: Mapping[str, Any]) -> None:
    row_label = f"{row.get('eventTitle')} | {row.get('contractTitle')}"
    route_label = f"{row_label} | {route.get('key')}"

    require_keys(route, ROUTE_KEYS, route_label)
    require("depthBreakdown" not in route, f"browser route leaked depthBreakdown: {route_label}")
    require("description" not in route, f"browser route leaked repeated description: {route_label}")
    require(isinstance(route.get("depthAvailable"), bool), f"depthAvailable is not boolean: {route_label}")

    status = str(route.get("status") or "").strip().lower()
    require(status not in GENERIC_ROUTE_STATUSES, f"generic route status: {route_label}")
    require(status in TERMINAL_ROUTE_STATUSES, f"unknown route status {status}: {route_label}")
    if route.get("pricingStatus") is not None:
        require(
            route.get("pricingStatus") == status,
            f"pricingStatus disagrees with status: {route_label}",
        )

    executable = route.get("executable") is True
    poly_leg = route.get("polymarket") or {}
    kalshi_leg = route.get("kalshi") or {}
    require_keys(poly_leg, LEG_KEYS, f"{route_label} Polymarket leg")
    require_keys(kalshi_leg, LEG_KEYS, f"{route_label} Kalshi leg")

    if status in EXECUTABLE_ROUTE_STATUSES:
        require(executable, f"executable status marked unavailable: {route_label}")
        require(poly_leg.get("executable") is True, f"Polymarket leg not executable: {route_label}")
        require(kalshi_leg.get("executable") is True, f"Kalshi leg not executable: {route_label}")
        require(as_float(poly_leg.get("ask")) is not None, f"missing Polymarket ask: {route_label}")
        require(as_float(kalshi_leg.get("ask")) is not None, f"missing Kalshi ask: {route_label}")
        require((as_float(poly_leg.get("askSize")) or 0.0) > 0, f"zero Polymarket depth: {route_label}")
        require((as_float(kalshi_leg.get("askSize")) or 0.0) > 0, f"zero Kalshi depth: {route_label}")
    else:
        require(status in UNAVAILABLE_ROUTE_STATUSES, f"invalid unavailable status: {route_label}")
        require(not executable, f"unavailable route marked executable: {route_label}")


def row_invariant_checks(row: Mapping[str, Any]) -> None:
    label = f"{row.get('eventTitle')} | {row.get('contractTitle')}"
    require_keys(row, ROW_KEYS, label)
    require("settlementSignature" not in row, f"browser row leaked settlement signature: {label}")
    require("bestRoute" not in row, f"browser row duplicated bestRoute: {label}")

    routes = row.get("routes")
    require(isinstance(routes, list), f"routes is not a list: {label}")
    require(len(routes) == 2, f"row does not have exactly two routes: {label}")
    require(row.get("accountedRouteCount") == 2, f"accountedRouteCount is not two: {label}")
    require(row.get("allRoutesAccounted") is True, f"allRoutesAccounted is false: {label}")

    route_keys = [str(route.get("key") or "") for route in routes]
    require(all(route_keys), f"route key missing: {label}")
    require(len(set(route_keys)) == 2, f"duplicate route keys: {label}")
    require(
        str(row.get("bestRouteKey") or "") in set(route_keys),
        f"bestRouteKey is not one of the two routes: {label}",
    )

    for route in routes:
        require(isinstance(route, Mapping), f"route is not an object: {label}")
        route_invariant_checks(row, route)

    executable_count = sum(route.get("executable") is True for route in routes)
    require(row.get("readyRouteCount") == executable_count, f"readyRouteCount mismatch: {label}")
    require(row.get("anyRouteReady") is (executable_count > 0), f"anyRouteReady mismatch: {label}")

    expected_pair_status = (
        "ready" if executable_count == 2 else "partially_ready" if executable_count == 1 else "unavailable"
    )
    require(row.get("pairStatus") in PAIR_STATUSES, f"unknown pair status: {label}")
    require(row.get("pairStatus") == expected_pair_status, f"pairStatus mismatch: {label}")

    expected_class = expected_opportunity_class(row)
    require(expected_class in OPPORTUNITY_CLASSES, f"unexpected opportunity class: {label}")
    require(row.get("opportunityClass") == expected_class, f"opportunityClass mismatch: {label}")

    encoded_size = len(json.dumps(row, separators=(",", ":"), default=str).encode("utf-8"))
    require(encoded_size < 20_000, f"browser row unexpectedly large ({encoded_size} bytes): {label}")



def terminal_overview(
    api_url: str,
    opportunity_type: str,
    *,
    live_only: bool = False,
    executable_only: bool = False,
    min_gross_edge: float = -1.0,
    min_net_edge: float = -1.0,
    min_executable_contracts: float = 0.0001,
    min_net_profit_usd: float = -1_000_000.0,
    limit: int = 5000,
) -> Dict[str, Any]:
    return http_json(
        api_url,
        (
            "/api/prediction-markets/terminal/overview"
            "?market_group=all"
            f"&opportunity_type={opportunity_type}"
            f"&live_only={'true' if live_only else 'false'}"
            f"&executable_only={'true' if executable_only else 'false'}"
            f"&min_gross_edge={min_gross_edge}"
            f"&min_net_edge={min_net_edge}"
            f"&min_executable_contracts={min_executable_contracts}"
            f"&min_net_profit_usd={min_net_profit_usd}"
            "&sort_by=net_profit"
            f"&limit={limit}"
        ),
        timeout=60.0,
    )


def live_api_checks(
    state: Dict[str, Any],
    api_url: str,
    startup_timeout_seconds: int,
) -> None:
    require(
        bool(LIVE_BEARER_TOKEN),
        "authenticated live regression requires --bearer-token or "
        "PREDICTION_REGRESSION_BEARER_TOKEN",
    )
    expect_http_unauthorized(
        api_url,
        "/api/prediction-markets/terminal/overview",
    )

    readiness = wait_for_readiness(
        api_url,
        startup_timeout_seconds=startup_timeout_seconds,
    )
    # /terminal/health intentionally returns 503 during cold startup. Check it
    # only after readiness succeeds so --startup-timeout actually does its job.
    health = http_json(api_url, "/api/prediction-markets/terminal/health")
    status = http_json(api_url, "/api/prediction-markets/terminal/status", timeout=60.0)
    overview = terminal_overview(api_url, "all")

    state["health"] = health
    state["readiness"] = readiness
    state["status"] = status
    state["overview"] = overview

    require(health.get("alive") is True, "health endpoint is not alive")
    require(
        health.get("apiContractVersion") == TERMINAL_API_CONTRACT_VERSION,
        "health API contract version mismatch",
    )
    require(readiness.get("ready") is True, f"terminal is not ready: {readiness.get('reasons')}")
    require(readiness.get("restartRequired") is False, "backend reports restart required")

    required_readiness_checks = {
        "streamManagerLoaded",
        "feeContextLoaded",
        "polymarketConnected",
        "kalshiConnected",
        "allStreamBatchesConnected",
        "streamErrorsClear",
        "allManifestPairsAssigned",
        "allFinanceInventoryAssigned",
        "manifestEqualsStreamSnapshots",
        "manifestEqualsApiRows",
        "feeContextAligned",
        "allRoutesAccounted",
        "exactlyTwoRoutesPerRow",
        "routeStatusesDefinitive",
        "noPairLookupFailures",
        "noPricingExceptions",
        "versionsAligned",
        "snapshotCurrent",
    }
    readiness_checks = readiness.get("checks") or {}
    require_keys(readiness_checks, required_readiness_checks, "readiness checks")
    for name in required_readiness_checks:
        require(readiness_checks.get(name) is True, f"readiness check failed: {name}")

    require(not readiness.get("reasons"), f"readiness reasons present: {readiness.get('reasons')}")
    require(not readiness.get("streamErrors"), f"readiness stream errors: {readiness.get('streamErrors')}")
    require(not status.get("errors"), f"stream errors present: {status.get('errors')}")

    require_keys(overview, TOP_LEVEL_KEYS, "terminal overview")
    require(overview.get("apiContractVersion") == TERMINAL_API_CONTRACT_VERSION, "overview API version mismatch")
    require(overview.get("engineVersion") == ENGINE_VERSION, "overview engine version mismatch")
    require(overview.get("settlementVersion") == SETTLEMENT_VERSION, "overview settlement version mismatch")
    require(overview.get("streamsVersion") == STREAMS_VERSION, "overview streams version mismatch")
    require(overview.get("pricingMode") == "live-fee-aware-route-accounted", "wrong pricing mode")
    require(overview.get("feeAware") is True, "overview is not fee-aware")
    require(overview.get("transport") == "lean-delta-websocket", "browser transport is not compact delta")
    require(isinstance(overview.get("terminalRevision"), int), "overview terminalRevision missing")
    require(isinstance(overview.get("catalogEpoch"), int), "overview catalogEpoch missing")

    coverage = status.get("coverage") or {}
    require_keys(coverage, COVERAGE_KEYS, "terminal status coverage")

    manifest = state["manifest"]
    expected_pairs = len(manifest.pairs)
    expected_routes = expected_pairs * 2

    require(coverage.get("manifestPairs") == expected_pairs, "coverage manifest count mismatch")
    require(coverage.get("streamSnapshotPairs") == expected_pairs, "stream snapshot count mismatch")
    require(coverage.get("evaluatedPairs") == expected_pairs, "evaluated pair count mismatch")
    require(coverage.get("feeContextPairs") == expected_pairs, "fee-context pair count mismatch")
    require(coverage.get("expectedRoutes") == expected_routes, "expected route count mismatch")
    require(coverage.get("accountedRoutes") == expected_routes, "accounted route count mismatch")
    require(coverage.get("manifestEqualsSnapshots") is True, "manifest does not equal snapshots")
    require(coverage.get("manifestEqualsEvaluated") is True, "manifest does not equal evaluated rows")
    require(coverage.get("allRoutesAccounted") is True, "not all routes are accounted")
    require(coverage.get("malformedRouteRows") == 0, "malformed route rows present")
    require(coverage.get("genericRouteStatuses") == 0, "generic route statuses present")
    require(coverage.get("unknownRouteStatuses") == 0, "unknown route statuses present")
    require(coverage.get("pairLookupMissingRoutes") == 0, "pair lookup failures present")
    require(coverage.get("pricingExceptionRoutes") == 0, "pricing exceptions present")

    require(overview.get("catalogRows") == expected_pairs, "catalogRows does not equal manifest")
    require(overview.get("matchedRowsBeforeLimit") == expected_pairs, "All Markets filtered out rows")
    require(overview.get("returnedRows") == expected_pairs, "All Markets did not return every pair")
    require(len(overview.get("opportunities") or []) == expected_pairs, "opportunity length mismatch")
    expected_inventory = len(tuple(getattr(manifest, "inventory", ()) or ()))
    finance_inventory = overview.get("financeInventory") or []
    require(
        len(finance_inventory) == expected_inventory,
        "All Markets finance inventory count differs from stream manifest",
    )
    finance_ids = [str(row.get("id") or "") for row in finance_inventory if isinstance(row, Mapping)]
    require(len(finance_ids) == expected_inventory, "finance inventory contains malformed rows")
    require(all(finance_ids), "finance inventory row is missing its ID")
    require(len(finance_ids) == len(set(finance_ids)), "duplicate finance inventory API row IDs")
    require((overview.get("filters") or {}).get("limitApplied") is False, "stable All Markets was truncated")

    rows = overview.get("opportunities") or []
    row_ids = [str(row.get("id") or "") for row in rows]
    require(all(row_ids), "an API row is missing its ID")
    require(len(row_ids) == len(set(row_ids)), "duplicate API row IDs")

    for row in rows:
        require(isinstance(row, Mapping), "API opportunity row is not an object")
        row_invariant_checks(row)

    # Full depth must be one-row-on-demand only. Verify the compact catalog has no
    # depth ladders, then fetch one detail row if a net opportunity is available.
    require(
        "depthBreakdown" not in json.dumps(rows, separators=(",", ":"), default=str),
        "compact overview leaked depthBreakdown data",
    )
    detail_candidate = next(
        (
            row
            for row in rows
            if any(
                route.get("status") == "net_opportunity"
                and route.get("depthAvailable") is True
                for route in row.get("routes", [])
            )
        ),
        None,
    )
    if detail_candidate is not None:
        detail_id = urllib.parse.quote(str(detail_candidate.get("id") or ""), safe="")
        detail = http_json(
            api_url,
            f"/api/prediction-markets/terminal/detail/{detail_id}",
            timeout=30.0,
        )
        detail_item = detail.get("item") or {}
        require(
            str(detail_item.get("id") or "") == str(detail_candidate.get("id") or ""),
            "detail endpoint returned the wrong row",
        )
        require(
            any(route.get("depthBreakdown") for route in detail_item.get("routes", [])),
            "detail endpoint did not return execution depth",
        )

    route_status_counts = Counter(
        str(route.get("status") or "")
        for row in rows
        for route in row.get("routes", [])
    )
    require(
        dict(sorted(route_status_counts.items())) == coverage.get("routeStatusCounts"),
        "coverage route-status counts do not match rows",
    )

    pair_status_counts = Counter(str(row.get("pairStatus") or "") for row in rows)
    require(
        dict(sorted(pair_status_counts.items())) == coverage.get("pairStatusCounts"),
        "coverage pair-status counts do not match rows",
    )

    stream_status = status
    require((stream_status.get("manifest") or {}).get("pairs") == expected_pairs, "stream manifest count mismatch")
    require(stream_status.get("totalRoutes") == expected_routes, "stream total route count mismatch")
    require(
        int(stream_status.get("readyRoutes") or 0)
        + sum(
            int(value)
            for value in (stream_status.get("routeUnavailableReasons") or {}).values()
        )
        == expected_routes,
        "stream ready and unavailable routes do not reconcile",
    )

    fee_pricing = status.get("feePricing") or {}
    require(fee_pricing.get("engineVersion") == ENGINE_VERSION, "fee context engine mismatch")
    require(fee_pricing.get("exactPairs") == expected_pairs, "fee context exact-pair count mismatch")
    require(
        str((stream_status.get("manifest") or {}).get("snapshotMarker"))
        == str(fee_pricing.get("snapshotMarker")),
        "stream and fee contexts use different snapshots",
    )

    # Filter behavior is checked against the complete All Markets payload.
    expected_live_rows = sum(bool(row.get("anyRouteReady")) for row in rows)
    live_payload = terminal_overview(api_url, "all", live_only=True)
    require(live_payload.get("returnedRows") == expected_live_rows, "live_only count mismatch")

    executable_payload = terminal_overview(api_url, "all", executable_only=True)
    require(executable_payload.get("returnedRows") == expected_live_rows, "executable_only count mismatch")

    gross_payload = terminal_overview(api_url, "gross", min_gross_edge=0.0)
    for row in gross_payload.get("opportunities", []):
        require(
            any(
                route.get("status") in {"gross_only", "net_opportunity"}
                and (as_float(route.get("grossEdge")) or 0.0) > 0
                for route in row.get("routes", [])
            ),
            "gross filter returned a row without a positive executable gross route",
        )

    strict_net_payload = terminal_overview(api_url, "strict_net")
    for row in strict_net_payload.get("opportunities", []):
        require(row.get("settlementVerified") is True, "strict_net returned an unverified row")
        require(
            any(route.get("status") == "net_opportunity" for route in row.get("routes", [])),
            "strict_net returned a row without a net route",
        )

    conditional_net_payload = terminal_overview(api_url, "conditional_net")
    for row in conditional_net_payload.get("opportunities", []):
        require(row.get("settlementVerified") is False, "conditional_net returned a strict row")
        require(row.get("opportunityClass") == "conditional_net_opportunity", "conditional_net class mismatch")
        require(
            any(route.get("status") == "net_opportunity" for route in row.get("routes", [])),
            "conditional_net returned a row without a net route",
        )


def run_check(
    name: str,
    callback: Callable[[], None],
    records: list[Dict[str, Any]],
) -> None:
    print(f"\n[RUN] {name}")
    started = time.perf_counter()
    try:
        callback()
    except Exception as exc:  # noqa: BLE001 - regression runner reports all checks
        records.append(
            {
                "name": name,
                "status": "failed",
                "durationMs": round((time.perf_counter() - started) * 1000),
                "error": f"{type(exc).__name__}: {exc}",
                "traceback": traceback.format_exc(),
            }
        )
        print(f"[FAIL] {name}: {exc}")
    else:
        records.append(
            {
                "name": name,
                "status": "passed",
                "durationMs": round((time.perf_counter() - started) * 1000),
            }
        )
        print(f"[PASS] {name}")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--api-url", default=DEFAULT_API_URL)
    parser.add_argument("--offline", action="store_true")
    parser.add_argument("--startup-timeout", type=int, default=240)
    parser.add_argument("--report", default=DEFAULT_REPORT)
    parser.add_argument(
        "--bearer-token",
        default=os.getenv("PREDICTION_REGRESSION_BEARER_TOKEN", "").strip(),
        help=(
            "Supabase access token for authenticated live API checks. "
            "Prefer the PREDICTION_REGRESSION_BEARER_TOKEN environment variable "
            "so the token is not stored in shell history."
        ),
    )
    args = parser.parse_args()

    global LIVE_BEARER_TOKEN
    LIVE_BEARER_TOKEN = str(args.bearer_token or "").strip()

    print(f"Regression version: {REGRESSION_VERSION}")
    print(f"Engine version: {ENGINE_VERSION}")
    print(f"Settlement version: {SETTLEMENT_VERSION}")
    print(f"Streams version: {STREAMS_VERSION}")
    print(f"API contract version: {TERMINAL_API_CONTRACT_VERSION}")

    state: Dict[str, Any] = {}
    records: list[Dict[str, Any]] = []

    run_check("settlement normalizers", parser_checks, records)
    run_check("component route-accounting self-tests", lambda: component_self_tests(state), records)
    run_check("exact-pair context", lambda: context_checks(state), records)
    run_check("stream manifest", lambda: manifest_checks(state), records)

    if not args.offline:
        run_check(
            "live full-manifest API accounting",
            lambda: live_api_checks(state, args.api_url, args.startup_timeout),
            records,
        )

    context = state.get("context")
    manifest = state.get("manifest")
    overview = state.get("overview")
    readiness = state.get("readiness")
    successful = all(record["status"] == "passed" for record in records)

    report = {
        "regressionVersion": REGRESSION_VERSION,
        "engineVersion": ENGINE_VERSION,
        "settlementVersion": SETTLEMENT_VERSION,
        "streamsVersion": STREAMS_VERSION,
        "apiContractVersion": TERMINAL_API_CONTRACT_VERSION,
        "offline": args.offline,
        "successful": successful,
        "records": records,
        "componentSelfTests": state.get("componentSelfTests"),
        "context": None
        if context is None
        else {
            "snapshotMarker": context.snapshot_marker,
            "exactPairs": len(context.exact_pairs),
            "sportsPairs": len(context.sports_pairs),
            "macroPairs": len(context.macro_pairs),
            "weatherPairs": len(context.weather_pairs),
            "genericPairs": len(context.generic_pairs),
            "genericPairsByGroup": dict(
                sorted(
                    Counter(poly.market_group for poly, _ in context.generic_pairs).items()
                )
            ),
            "sportsStatuses": context.diagnostics.get("sportsSettlementStatuses", {}),
            "macroStatuses": context.diagnostics.get("macroSettlementStatuses", {}),
            "weatherStatuses": context.diagnostics.get("weatherSettlementStatuses", {}),
            "genericStatuses": context.diagnostics.get("genericSettlementStatuses", {}),
        },
        "manifest": None if manifest is None else manifest.summary(),
        "readiness": readiness,
        "api": None
        if overview is None
        else {
            "catalogRows": overview.get("catalogRows"),
            "returnedRows": overview.get("returnedRows"),
            "matchedRowsBeforeLimit": overview.get("matchedRowsBeforeLimit"),
            "pricingMode": overview.get("pricingMode"),
            "coverage": overview.get("coverage"),
        },
    }

    report_path = Path(args.report)
    report_path.write_text(
        json.dumps(report, indent=2, default=str),
        encoding="utf-8",
    )
    print(f"\nCreated {report_path}")
    print("BACKEND REGRESSION: PASS" if successful else "BACKEND REGRESSION: FAIL")
    return 0 if successful else 1


if __name__ == "__main__":
    raise SystemExit(main())