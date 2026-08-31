import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import BullionaireLogo from "./assets/bullionaire-logo.png";
import { supabase } from "./lib/supabaseClient";
import "./PredictionMarkets.css";

const API_BASE = (
  process.env.REACT_APP_API_BASE ||
  (process.env.NODE_ENV === "development"
    ? "http://127.0.0.1:8000"
    : "")
).replace(/\/+$/, "");

const API_CONTRACT_VERSION =
  "prediction-terminal-api-v2.1-persistent-catalog";
const PREDICTION_UI_VERSION =
  "prediction-ui-v4.1-persistent-socket-soccer500";

const TERMINAL_LIMIT = 5000;
const HTTP_FALLBACK_INTERVAL_MS = 5000;
const WS_RECONNECT_DELAY_MS = 1500;
const READINESS_INTERVAL_MS = 30000;
const LIST_PAGE_SIZE = 180;

const WS_AUTH_PROTOCOL = "bullionaire-v1";

const getPredictionAccessToken = async (forceRefresh = false) => {
  if (forceRefresh) {
    const { data, error } = await supabase.auth.refreshSession();

    if (error || !data?.session?.access_token) {
      throw new Error("Your Bullionaire session has expired. Please sign in again.");
    }

    return data.session.access_token;
  }

  const { data, error } = await supabase.auth.getSession();

  if (error || !data?.session?.access_token) {
    throw new Error("You must be signed in to use Prediction Markets.");
  }

  return data.session.access_token;
};

const authenticatedFetch = async (url, options = {}, retry = true) => {
  const token = await getPredictionAccessToken(false);
  const headers = new Headers(options.headers || {});
  headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (response.status === 401 && retry) {
    const refreshedToken = await getPredictionAccessToken(true);
    const refreshedHeaders = new Headers(options.headers || {});
    refreshedHeaders.set("Authorization", `Bearer ${refreshedToken}`);

    return fetch(url, {
      ...options,
      headers: refreshedHeaders,
    });
  }

  return response;
};

const VIEW_OPTIONS = [
  { key: "all", label: "All Markets" },
  { key: "gross", label: "Gross Pair" },
  { key: "net", label: "Net Arbitrage" },
];

const CATEGORY_PRIORITY = [
  "sports",
  "companies",
  "economics",
  "politics",
  "elections",
  "culture",
  "media",
  "entertainment",
  "weather",
  "crypto",
  "geopolitics",
  "technology",
  "other",
];

const SPORTS_SUBCATEGORIES = [
  "all",
  "live",
  "Football",
  "Basketball",
  "Baseball",
  "Soccer",
  "Australian Football",
  "Hockey",
  "Tennis",
  "MMA",
  "Cricket",
  "Other",
];

const SOCCER_SERIES_LABELS = {
  KXMLSGAME: "MLS",
  KXENGNLGAME: "English National League",
  KXDFBPOKALGAME: "DFB-Pokal",
  KXSERIEAGAME: "Serie A",
  KXLIGAMXGAME: "Liga MX",
  KXARGNACBGAME: "Argentina Nacional B",
  KXUECLGAME: "Conference League",
  KXEPLGAME: "Premier League",
  KXLALIGAGAME: "La Liga",
  KXEFLCHAMPIONSHIPGAME: "EFL Championship",
  KXEFLCUPGAME: "EFL Cup",
  KXJ2LEAGUEGAME: "J2 League",
  KXUSLGAME: "USL",
  KXEERSTEDIVGAME: "Eerste Divisie",
  KXLIGUE1GAME: "Ligue 1",
  KXLIGUE2GAME: "Ligue 2",
  KXSAUDIPLGAME: "Saudi Pro League",
  KXJLEAGUEGAME: "J League",
  KXSUPERLIGGAME: "Turkish Super Lig",
  KXBRASILEIROGAME: "Brasileirao Serie A",
  KXSERIEBGAME: "Serie B",
  KXECULPGAME: "Ecuador LigaPro",
  KXK2LEAGUEGAME: "K League 2",
  KXNWSLGAME: "NWSL",
  KXLALIGA2GAME: "La Liga 2",
  KXURYPDGAME: "Uruguay Primera Division",
  KXARGPREMDIVGAME: "Argentina Primera Division",
  KXEKSTRAKLASAGAME: "Ekstraklasa",
  KXKLEAGUEGAME: "K League 1",
  KXSRBSLGAME: "Serbian SuperLiga",
  KXALLSVENSKANGAME: "Allsvenskan",
  KXEREDIVISIEGAME: "Eredivisie",
  KXBELGIANPLGAME: "Belgian Pro League",
  KXCHNL1GAME: "Chinese League One",
  KXCLUBFGAME: "Club Friendlies",
  KXSLGREECEGAME: "Greek Super League",
  KXLIGAPORTUGALGAME: "Liga Portugal",
  KXDIMAYORGAME: "Colombia Primera A",
  KXLVAVIRGAME: "Latvian Virsliga",
  KXUELGAME: "Europa League",
  KXISRPLGAME: "Israeli Premier League",
  KXSVNPLGAME: "Slovenian PrvaLiga",
  KXEFLL1GAME: "EFL League One",
  KXHNLGAME: "HNL",
  KXBOLPDIVGAME: "Bolivia Primera Division",
  KXSCOTTISHPREMGAME: "Scottish Premiership",
  KXDENSUPERLIGAGAME: "Danish Superliga",
  KXLEAGUESCUPGAME: "Leagues Cup",
  KXTFF1LIGGAME: "Turkish 1. Lig",
  KXCANPLGAME: "Canadian Premier League",
  KXCZEFLGAME: "Czech First League",
  KXSWISSLEAGUEGAME: "Swiss Super League",
  KXCHNSLGAME: "Chinese Super League",
  KXUAEPLGAME: "UAE Pro League",
  KXCHLLDPGAME: "Chile Primera Division",
  KXBUNDESLIGAGAME: "Bundesliga",
  KXUCLGAME: "Champions League",
  KXBRASILEIROCGAME: "Brasileirao Serie C",
  KXEGYPLGAME: "Egyptian Premier League",
  KXBRASILEIROBGAME: "Brasileirao Serie B",
  KXPERLIGA1GAME: "Peru Liga 1",
  KXCONMEBOLLIBGAME: "Copa Libertadores",
  KXCOPADOBRASILGAME: "Copa do Brasil",
  KXFROPLGAME: "Faroe Islands Premier League",
  KXASEANGAME: "ASEAN",
  KXCONMEBOLSUDGAME: "Copa Sudamericana",
  KXBSNGAME: "Bosnia Premier League",
  KXBUNDESLIGA2GAME: "2. Bundesliga",
  KXVENFUTVEGAME: "Venezuela Primera Division",
};

const SOCCER_LEAGUE_PRIORITY = [
  "Champions League",
  "Premier League",
  "La Liga",
  "Serie A",
  "Bundesliga",
  "Europa League",
  "Ligue 1",
  "MLS",
  "Liga MX",
  "Brasileirao Serie A",
  "Eredivisie",
  "Liga Portugal",
  "Saudi Pro League",
  "EFL Championship",
  "Conference League",
  "Copa Libertadores",
  "NWSL",
  "Scottish Premiership",
  "Turkish Super Lig",
  "Argentina Primera Division",
  "Belgian Pro League",
  "J League",
  "Leagues Cup",
  "DFB-Pokal",
  "EFL Cup",
  "Copa Sudamericana",
  "Copa do Brasil",
];

const MACRO_SUBCATEGORIES = [
  "all",
  "Fed",
  "Rates",
  "Inflation",
  "Jobs",
  "GDP",
  "Recession",
  "Markets",
  "Other",
];

const asNumber = (value) => {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const parseTimestamp = (value) => {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime())
      ? null
      : value;
  }

  const numeric = Number(value);

  if (Number.isFinite(numeric)) {
    let milliseconds;

    if (numeric > 1e17) {
      milliseconds = numeric / 1e6;
    } else if (numeric > 1e14) {
      milliseconds = numeric / 1e3;
    } else if (numeric > 1e11) {
      milliseconds = numeric;
    } else {
      milliseconds = numeric * 1000;
    }

    const parsed = new Date(milliseconds);

    return Number.isNaN(parsed.getTime())
      ? null
      : parsed;
  }

  const parsed = new Date(String(value));

  return Number.isNaN(parsed.getTime())
    ? null
    : parsed;
};

const formatCents = (value) => {
  const number = asNumber(value);
  if (number === null) return "—";

  const cents = number * 100;
  const decimals =
    Math.abs(cents) < 10 ? 1 : 0;

  return `${cents.toFixed(decimals)}¢`;
};

const formatPreciseCents = (value, digits = 2) => {
  const number = asNumber(value);
  if (number === null) return "—";

  return `${(number * 100).toFixed(digits)}¢`;
};

const formatContracts = (value) => {
  const number = asNumber(value);
  if (number === null) return "—";

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 4,
  }).format(number);
};

const formatMoney = (
  value,
  { signed = false } = {}
) => {
  const number = asNumber(value);
  if (number === null) return "—";

  const sign =
    signed && number > 0 ? "+" : "";

  return `${sign}${new Intl.NumberFormat(
    "en-US",
    {
      style: "currency",
      currency: "USD",
      maximumFractionDigits:
        Math.abs(number) < 100 ? 2 : 0,
    }
  ).format(number)}`;
};

const formatPercent = (
  value,
  digits = 2
) => {
  const number = asNumber(value);
  if (number === null) return "—";

  return `${(number * 100).toFixed(
    digits
  )}%`;
};

const formatApy = (value) => {
  const number = asNumber(value);

  if (
    number === null ||
    number < 0
  ) {
    return "—";
  }

  const percentage =
    number * 100;

  if (percentage >= 100000) {
    return `${new Intl.NumberFormat(
      "en-US",
      {
        notation: "compact",
        maximumFractionDigits: 1,
      }
    ).format(percentage)}%`;
  }

  if (percentage >= 1000) {
    return `${percentage.toFixed(0)}%`;
  }

  if (percentage >= 100) {
    return `${percentage.toFixed(1)}%`;
  }

  return `${percentage.toFixed(2)}%`;
};

const annualizeReturnRate = (
  returnRate,
  settlementTarget,
  nowMs
) => {
  const rate = asNumber(returnRate);
  const target = asNumber(settlementTarget);
  const now = asNumber(nowMs);

  if (
    rate === null ||
    rate <= -1 ||
    target === null ||
    now === null ||
    target <= now
  ) {
    return null;
  }

  const secondsRemaining =
    (target - now) / 1000;
  const secondsPerYear =
    365.25 * 24 * 60 * 60;

  const annualized =
    Math.pow(
      1 + rate,
      secondsPerYear /
        secondsRemaining
    ) - 1;

  return Number.isFinite(annualized)
    ? annualized
    : null;
};

const formatDateTime = (
  value,
  fallback = ""
) => {
  const parsed = parseTimestamp(value);

  if (!parsed) return fallback;

  return new Intl.DateTimeFormat(
    "en-US",
    {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }
  ).format(parsed);
};

const titleCase = (value) =>
  String(value || "")
    .replace(/[_-]+/g, " ")
    .replace(
      /\b\w/g,
      (character) =>
        character.toUpperCase()
    );

const normalizeText = (value) =>
  String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .replace(
      /[^a-z0-9]+/g,
      " "
    )
    .trim();

const getSearchText = (item) =>
  normalizeText(
    [
      item?.eventTitle,
      item?.contractTitle,
      item?.eventKey,
      item?.contractKey,
      item?.marketGroup,
      item?.sport,
      item?.sportName,
      item?.league,
      item?.leagueName,
      item?.competition,
      item?.competitionName,
      item?.series,
      item?.seriesTitle,
      item?.seriesTicker,
      item?.eventTicker,
      item?.ticker,
      item?.category,
      item?.subcategory,
      item?.family,
      item?.venue,
      item?.event_title,
      item?.contract_title,
      item?.external_market_id,
      item?.external_event_id,
      item?.subject_key,
      item?.polymarket?.marketId,
      item?.polymarket?.eventId,
      item?.polymarket?.slug,
      item?.polymarket?.eventSlug,
      item?.polymarket?.category,
      item?.polymarket?.subcategory,
      item?.polymarket?.sport,
      item?.polymarket?.league,
      item?.kalshi?.marketId,
      item?.kalshi?.eventId,
      item?.kalshi?.marketTicker,
      item?.kalshi?.eventTicker,
      item?.kalshi?.ticker,
      item?.kalshi?.seriesTicker,
      item?.kalshi?.category,
      item?.kalshi?.subcategory,
      item?.kalshi?.sport,
      item?.kalshi?.league,
    ]
      .filter(Boolean)
      .join(" ")
  );

const getIdentifierText = (item) =>
  [
    item?.eventKey,
    item?.contractKey,
    item?.seriesTicker,
    item?.eventTicker,
    item?.ticker,
    item?.kalshi?.marketId,
    item?.kalshi?.eventId,
    item?.kalshi?.marketTicker,
    item?.kalshi?.eventTicker,
    item?.kalshi?.ticker,
    item?.kalshi?.seriesTicker,
    item?.polymarket?.marketId,
    item?.polymarket?.eventId,
    item?.polymarket?.slug,
  ]
    .filter(Boolean)
    .join(" ")
    .toUpperCase()
    .replace(
      /[^A-Z0-9]+/g,
      ""
    );

const getPrimaryCategory = (item) => {
  const value = String(
    item?.marketGroup ||
      item?.market_group ||
      "other"
  )
    .trim()
    .toLowerCase();

  if (value === "macro") {
    return "economics";
  }

  return value || "other";
};

const getKalshiSeries = (item) => {
  const candidates = [
    item?.kalshi?.seriesTicker,
    item?.kalshi?.marketId,
    item?.kalshi?.eventId,
    item?.kalshi?.marketTicker,
    item?.kalshi?.eventTicker,
    item?.seriesTicker,
    item?.eventTicker,
    item?.ticker,
  ];

  for (const value of candidates) {
    const normalized = String(value || "")
      .trim()
      .toUpperCase();

    if (normalized) {
      return normalized.split("-")[0];
    }
  }

  return "";
};

const inferSportsSubcategory = (
  item
) => {
  const text =
    getSearchText(item);
  const identifier =
    getIdentifierText(item);
  const series =
    getKalshiSeries(item);

  if (
    SOCCER_SERIES_LABELS[series] ||
    /KXSOCCER|KXEPL|KXMLS|KXUCL|KXUEL|KXUECL|KXLALIGA|KXBUNDESLIGA|KXSERIEA|KXLIGUE1|KXLIGAMX|KXCLUBF|KXCONMEBOL|KXCOPA|KXFIFA|KXUEFA|KXWORLDCUP/.test(
      identifier
    ) ||
    /\b(soccer|association football|premier league|champions league|europa league|conference league|major league soccer|mls|epl|ucl|uel|liga mx|la liga|bundesliga|serie a|ligue 1|libertadores|sudamericana|world cup|uefa|fifa|concacaf|j league|k league|nws|usl)\b/.test(
      text
    )
  ) {
    return "Soccer";
  }

  if (
    [
      "KXNFLGAME",
      "KXCFLGAME",
    ].includes(series) ||
    /KXNFL|KXNCAAF|KXCFB|NFLGAME|NCAAFGAME|CFLGAME/.test(
      identifier
    ) ||
    /\b(nfl|cfl|canadian football league|college football|ncaaf|cfb|super bowl|pro football)\b/.test(
      text
    )
  ) {
    return "Football";
  }

  if (
    [
      "KXNBA",
      "KXNBAGAME",
      "KXWNBA",
      "KXWNBAGAME",
    ].includes(series) ||
    /KXNBA|KXWNBA|NBAGAME|WNBAGAME/.test(
      identifier
    ) ||
    /\b(nba|wnba|basketball)\b/.test(
      text
    )
  ) {
    return "Basketball";
  }

  if (
    [
      "KXMLBGAME",
      "KXKBOGAME",
    ].includes(series) ||
    /KXMLB|KXKBO|MLBGAME|KBOGAME/.test(
      identifier
    ) ||
    /\b(mlb|kbo|baseball|world series)\b/.test(
      text
    )
  ) {
    return "Baseball";
  }

  if (
    series === "KXAFLGAME" ||
    /KXAFLGAME/.test(identifier) ||
    /\b(australian football|australian rules|afl)\b/.test(
      text
    )
  ) {
    return "Australian Football";
  }

  if (
    /KXNHL/.test(identifier) ||
    /\b(nhl|hockey|stanley cup)\b/.test(
      text
    )
  ) {
    return "Hockey";
  }

  if (
    /KXTENNIS|KXATP|KXWTA/.test(
      identifier
    ) ||
    /\b(tennis|atp|wta|wimbledon|roland garros|french open|australian open)\b/.test(
      text
    )
  ) {
    return "Tennis";
  }

  if (
    /KXUFC|KXMMA|KXBOXING/.test(
      identifier
    ) ||
    /\b(ufc|mma|boxing|fight night)\b/.test(
      text
    )
  ) {
    return "MMA";
  }

  if (
    /KXCRICKET|KXCPL|KXIPL/.test(
      identifier
    ) ||
    /\b(cricket|ipl|caribbean premier league)\b/.test(
      text
    )
  ) {
    return "Cricket";
  }

  return "Other";
};

const inferSoccerLeague = (item) => {
  const directLeague =
    item?.leagueName ||
    item?.league ||
    item?.competitionName ||
    item?.competition ||
    item?.polymarket?.league ||
    item?.kalshi?.league ||
    "";

  const series =
    getKalshiSeries(item);

  if (SOCCER_SERIES_LABELS[series]) {
    return SOCCER_SERIES_LABELS[series];
  }

  const text =
    getSearchText(item);

  const identifier =
    getIdentifierText(item);

  if (
    /KXEPL/.test(identifier) ||
    /\b(epl|premier league)\b/.test(
      text
    )
  ) {
    return "Premier League";
  }

  if (
    /KXMLS/.test(identifier) ||
    /\b(mls|major league soccer)\b/.test(
      text
    )
  ) {
    return "MLS";
  }

  if (
    /KXUCL/.test(identifier) ||
    /\b(ucl|champions league)\b/.test(
      text
    )
  ) {
    return "Champions League";
  }

  if (
    /KXUEL/.test(identifier) ||
    /\b(uel|europa league)\b/.test(
      text
    )
  ) {
    return "Europa League";
  }

  if (
    /KXLALIGA/.test(
      identifier
    ) ||
    /\b(la liga)\b/.test(text)
  ) {
    return "La Liga";
  }

  if (
    /KXBUNDESLIGA/.test(
      identifier
    ) ||
    /\b(bundesliga)\b/.test(text)
  ) {
    return "Bundesliga";
  }

  if (
    /KXSERIEA/.test(
      identifier
    ) ||
    /\b(serie a)\b/.test(text)
  ) {
    return "Serie A";
  }

  if (
    /KXLIGUE1/.test(
      identifier
    ) ||
    /\b(ligue 1)\b/.test(text)
  ) {
    return "Ligue 1";
  }

  if (
    /KXLIGAMX/.test(
      identifier
    ) ||
    /\b(liga mx)\b/.test(text)
  ) {
    return "Liga MX";
  }

  if (
    /KXWORLDCUP|KXFIFA/.test(
      identifier
    ) ||
    /\b(world cup|fifa)\b/.test(
      text
    )
  ) {
    return "World Cup";
  }

  if (directLeague) {
    return titleCase(
      directLeague
    );
  }

  return "Other";
};

const inferMacroCategory = (item) => {
  const text =
    getSearchText(item);

  if (
    /\b(fed|fomc|federal reserve)\b/.test(
      text
    )
  ) {
    return "Fed";
  }

  if (
    /\b(rate|rates|interest|basis point|bps)\b/.test(
      text
    )
  ) {
    return "Rates";
  }

  if (
    /\b(cpi|pce|inflation|consumer price)\b/.test(
      text
    )
  ) {
    return "Inflation";
  }

  if (
    /\b(job|jobs|payroll|unemployment|claims)\b/.test(
      text
    )
  ) {
    return "Jobs";
  }

  if (
    /\b(gdp|gross domestic product)\b/.test(
      text
    )
  ) {
    return "GDP";
  }

  if (
    /\b(recession)\b/.test(
      text
    )
  ) {
    return "Recession";
  }

  if (
    /\b(s&p|sp500|spx|nasdaq|ndx|gold|wti|crude oil|oil price|treasury yield)\b/.test(
      text
    )
  ) {
    return "Markets";
  }

  return "Other";
};

const getGenericSubcategory = (
  item
) => {
  const value =
    item?.subcategory ||
    item?.family ||
    item?.polymarket?.subcategory ||
    item?.kalshi?.subcategory ||
    "";

  return value
    ? titleCase(value)
    : "All";
};


const isSingleVenueMarket = (item) =>
  String(
    item?.rowType ||
      item?.row_type ||
      ""
  ).toLowerCase() ===
    "single_venue_market" ||
  item?.isArbitragePair === false;

const normalizeFinanceInventoryRow = (
  row,
  requestedGroup
) => {
  const venueName = String(
    row?.venue || ""
  )
    .trim()
    .toLowerCase();

  const yes = row?.yes || {};
  const no = row?.no || {};

  const marketId = String(
    row?.external_market_id ||
      row?.externalMarketId ||
      ""
  );

  const eventId = String(
    row?.external_event_id ||
      row?.externalEventId ||
      ""
  );

  const normalizedVenue = {
    ...(venueName === "kalshi"
      ? row?.kalshi || {}
      : venueName === "polymarket"
        ? row?.polymarket || {}
        : {}),
    marketId,
    eventId,
    marketTicker:
      venueName === "kalshi"
        ? marketId
        : undefined,
    eventTicker:
      venueName === "kalshi"
        ? eventId
        : undefined,
    yesBid:
      asNumber(
        row?.bestYesBid
      ) ??
      asNumber(
        yes?.bestBid
      ),
    yesAsk:
      asNumber(
        row?.bestYesAsk
      ) ??
      asNumber(
        yes?.bestAsk
      ),
    yesSize:
      asNumber(
        yes?.bestAskSize
      ),
    noBid:
      asNumber(
        row?.bestNoBid
      ) ??
      asNumber(
        no?.bestBid
      ),
    noAsk:
      asNumber(
        row?.bestNoAsk
      ) ??
      asNumber(
        no?.bestAsk
      ),
    noSize:
      asNumber(
        no?.bestAskSize
      ),
    yesLabel: "YES",
    noLabel: "NO",
  };

  const marketGroup =
    requestedGroup ===
    "economics"
      ? "economics"
      : requestedGroup ===
          "companies"
        ? "companies"
        : getPrimaryCategory(
            row
          );

  return {
    ...row,
    id:
      row?.id ||
      `finance-${venueName}-${marketId}`,
    rowType:
      "single_venue_market",
    isArbitragePair: false,
    marketGroup,
    family:
      row?.family || "other",
    subcategory:
      row?.family || "other",
    eventTitle:
      row?.event_title ||
      row?.eventTitle ||
      "Untitled market",
    contractTitle:
      row?.contract_title ||
      row?.contractTitle ||
      "",
    eventKey:
      row?.subject_key ||
      row?.event_key ||
      row?.eventKey ||
      eventId,
    contractKey:
      row?.external_market_id ||
      row?.contract_key ||
      row?.contractKey ||
      marketId,
    scheduledTime:
      row?.close_time ||
      row?.closeTime ||
      row?.resolution_time ||
      row?.resolutionTime ||
      null,
    settlementTarget:
      row?.resolution_time ||
      row?.resolutionTime ||
      row?.close_time ||
      row?.closeTime ||
      null,
    closeTime:
      row?.close_time ||
      row?.closeTime ||
      null,
    resolutionTime:
      row?.resolution_time ||
      row?.resolutionTime ||
      null,
    financeVenue: venueName,
    liquidity:
      asNumber(
        row?.liquidity
      ) ?? 0,
    volume24h:
      asNumber(
        row?.volume_24h ??
          row?.volume24h
      ) ?? 0,
    totalVolume:
      asNumber(
        row?.total_volume ??
          row?.totalVolume
      ) ?? 0,
    openInterest:
      asNumber(
        row?.open_interest ??
          row?.openInterest
      ) ?? 0,
    rankScore:
      asNumber(
        row?.rank_score ??
          row?.rankScore
      ) ?? 0,
    ...(venueName === "polymarket"
      ? {
          polymarket:
            normalizedVenue,
        }
      : {}),
    ...(venueName === "kalshi"
      ? {
          kalshi:
            normalizedVenue,
        }
      : {}),
  };
};

const getEventTiming = (item) => {
  if (
    String(
      item?.eventPhase || ""
    ).toLowerCase() === "live"
  ) {
    return {
      phase: "live",
      label: "LIVE",
    };
  }

  const scheduled =
    parseTimestamp(
      item?.scheduledTime
    );

  if (!scheduled) {
    return {
      phase: "unscheduled",
      label: "",
    };
  }

  const difference =
    scheduled.getTime() -
    Date.now();

  if (
    getPrimaryCategory(item) ===
      "sports" &&
    difference <= 0 &&
    difference >=
      -6 * 60 * 60 * 1000
  ) {
    return {
      phase: "live",
      label: "LIVE",
    };
  }

  if (difference > 0) {
    const today =
      scheduled.toDateString() ===
      new Date().toDateString();

    return {
      phase: "upcoming",
      label: today
        ? "Today"
        : "Upcoming",
    };
  }

  return {
    phase: "recent",
    label: "Recent",
  };
};

const routeIsExecutable = (
  route
) =>
  route?.executable === true ||
  [
    "net_opportunity",
    "gross_only",
    "no_opportunity",
  ].includes(
    String(route?.status || "")
  );

const isStrictNetOpportunity = (
  item
) =>
  String(
    item?.opportunityClass || ""
  ) === "strict_net_arbitrage";

const isStrictGrossOpportunity = (
  item
) =>
  [
    "strict_net_arbitrage",
    "strict_gross_discrepancy",
  ].includes(
    String(
      item?.opportunityClass || ""
    )
  );

const getBestRoute = (item) => {
  if (item?.bestRoute) {
    return item.bestRoute;
  }

  const routes =
    Array.isArray(item?.routes)
      ? item.routes
      : [];

  return routes[0] || {};
};

const getRouteLeg = (
  item,
  route,
  venueName
) => {
  const routeLeg =
    route?.[venueName];

  const venue =
    item?.[venueName] || {};

  if (
    routeLeg &&
    typeof routeLeg === "object"
  ) {
    const side = String(
      routeLeg.side || ""
    ).toLowerCase();

    return {
      venueName,
      side,
      price: asNumber(
        routeLeg.ask
      ),
      size: asNumber(
        routeLeg.askSize
      ),
      label:
        side === "no"
          ? venue?.noLabel ||
            "NO"
          : venue?.yesLabel ||
            "YES",
      url: venue?.url || "",
      marketId:
        venue?.marketTicker ||
        venue?.marketId ||
        "",
      eventId:
        venue?.eventTicker ||
        venue?.eventId ||
        "",
    };
  }

  const key = String(
    route?.key || ""
  );

  const side =
    key.includes(
      `${venueName}_no`
    )
      ? "no"
      : "yes";

  return {
    venueName,
    side,
    price: asNumber(
      side === "no"
        ? venue?.noAsk
        : venue?.yesAsk
    ),
    size: asNumber(
      side === "no"
        ? venue?.noSize
        : venue?.yesSize
    ),
    label:
      side === "no"
        ? venue?.noLabel ||
          "NO"
        : venue?.yesLabel ||
          "YES",
    url: venue?.url || "",
    marketId:
      venue?.marketTicker ||
      venue?.marketId ||
      "",
    eventId:
      venue?.eventTicker ||
      venue?.eventId ||
      "",
  };
};

const getRouteForVenueSide = (
  item,
  venueName,
  side
) => {
  const routes =
    Array.isArray(item?.routes)
      ? item.routes
      : [];

  return (
    routes.find((route) => {
      const leg =
        route?.[venueName];

      if (
        leg &&
        typeof leg === "object"
      ) {
        return (
          String(
            leg?.side || ""
          ).toLowerCase() ===
          side
        );
      }

      return String(
        route?.key || ""
      ).includes(
        `${venueName}_${side}`
      );
    }) || null
  );
};

const getVenueSideQuote = (
  item,
  venueName,
  side
) => {
  const venue =
    item?.[venueName] || {};

  const route =
    getRouteForVenueSide(
      item,
      venueName,
      side
    );

  const routeLeg =
    route?.[venueName] &&
    typeof route?.[venueName] ===
      "object"
      ? route[venueName]
      : null;

  const rawAsk =
    asNumber(
      routeLeg?.ask
    ) ??
    asNumber(
      side === "no"
        ? venue?.noAsk
        : venue?.yesAsk
    );

  const size =
    asNumber(
      routeLeg?.askSize
    ) ??
    asNumber(
      side === "no"
        ? venue?.noSize
        : venue?.yesSize
    );

  const feeField =
    venueName ===
    "polymarket"
      ? "polymarketEstimatedFeeUsd"
      : "kalshiEstimatedFeeUsd";

  const fee =
    asNumber(
      route?.[feeField]
    );

  const feeReady =
    Boolean(
      route?.feeEstimateComplete
    ) &&
    fee !== null;

  const effectiveAsk =
    rawAsk !== null &&
    feeReady
      ? rawAsk + fee
      : null;

  return {
    venueName,
    side,
    rawAsk,
    effectiveAsk,
    fee,
    feeReady,
    size,
    url: venue?.url || "",
    marketId:
      venue?.marketTicker ||
      venue?.marketId ||
      "",
    eventId:
      venue?.eventTicker ||
      venue?.eventId ||
      "",
  };
};

const getSideComparison = (
  item,
  side
) => {
  const polymarket =
    getVenueSideQuote(
      item,
      "polymarket",
      side
    );

  const kalshi =
    getVenueSideQuote(
      item,
      "kalshi",
      side
    );

  const complete =
    polymarket.effectiveAsk !==
      null &&
    kalshi.effectiveAsk !== null;

  let best = null;

  if (complete) {
    best =
      polymarket.effectiveAsk <=
      kalshi.effectiveAsk
        ? polymarket
        : kalshi;
  }

  return {
    polymarket,
    kalshi,
    best,
    complete,
  };
};

const getOutcomeLabel = (
  item,
  side
) => {
  const polymarket =
    item?.polymarket || {};

  const kalshi =
    item?.kalshi || {};

  if (side === "no") {
    return (
      polymarket?.noLabel ||
      kalshi?.noLabel ||
      "NO"
    );
  }

  return (
    polymarket?.yesLabel ||
    kalshi?.yesLabel ||
    item?.contractTitle ||
    "YES"
  );
};

const getPricingCompletenessRank = (
  item
) => {
  const yes =
    getSideComparison(
      item,
      "yes"
    );

  const no =
    getSideComparison(
      item,
      "no"
    );

  if (
    yes.complete &&
    no.complete
  ) {
    return 0;
  }

  const quotes = [
    yes.polymarket,
    yes.kalshi,
    no.polymarket,
    no.kalshi,
  ];

  const rawAvailable =
    quotes.filter(
      (quote) =>
        quote?.rawAsk !== null
    ).length;

  return rawAvailable > 0
    ? 1
    : 2;
};

const normalizeOutcomeLabel = (
  value
) =>
  normalizeText(value)
    .replace(
      /\b(to win|winner)\b/g,
      ""
    )
    .replace(/\s+/g, " ")
    .trim();

const getSportsEventGroupKey = (
  item
) => {
  const event = normalizeText(
    item?.eventTitle || ""
  );

  const scheduled =
    parseTimestamp(
      item?.scheduledTime
    )?.getTime();

  const minute =
    Number.isFinite(scheduled)
      ? Math.round(
          scheduled / 60000
        )
      : "na";

  return `${event}|${minute}`;
};

const areMirroredSportsRows = (
  left,
  right
) => {
  if (
    getPrimaryCategory(left) !==
      "sports" ||
    getPrimaryCategory(right) !==
      "sports"
  ) {
    return false;
  }

  if (
    getSportsEventGroupKey(
      left
    ) !==
    getSportsEventGroupKey(
      right
    )
  ) {
    return false;
  }

  const leftYes =
    normalizeOutcomeLabel(
      getOutcomeLabel(
        left,
        "yes"
      )
    );
  const leftNo =
    normalizeOutcomeLabel(
      getOutcomeLabel(
        left,
        "no"
      )
    );
  const rightYes =
    normalizeOutcomeLabel(
      getOutcomeLabel(
        right,
        "yes"
      )
    );
  const rightNo =
    normalizeOutcomeLabel(
      getOutcomeLabel(
        right,
        "no"
      )
    );

  if (
    !leftYes ||
    !leftNo ||
    !rightYes ||
    !rightNo ||
    [
      leftYes,
      leftNo,
      rightYes,
      rightNo,
    ].some((value) =>
      ["yes", "no"].includes(
        value
      )
    )
  ) {
    return false;
  }

  return (
    leftYes === rightNo &&
    leftNo === rightYes
  );
};

const representativeScore = (
  item
) => {
  const opportunityRank =
    isStrictNetOpportunity(item)
      ? 3
      : isStrictGrossOpportunity(
            item
          )
        ? 2
        : 1;

  const completenessRank =
    getPricingCompletenessRank(
      item
    );

  const bestNetProfit =
    asNumber(
      getBestRoute(item)
        ?.netExecutableProfitUsd
    ) ?? -Infinity;

  return {
    opportunityRank,
    completenessRank,
    bestNetProfit,
  };
};

const chooseMirroredRepresentative = (
  left,
  right
) => {
  const leftScore =
    representativeScore(left);
  const rightScore =
    representativeScore(right);

  if (
    leftScore.opportunityRank !==
    rightScore.opportunityRank
  ) {
    return leftScore.opportunityRank >
      rightScore.opportunityRank
      ? left
      : right;
  }

  if (
    leftScore.completenessRank !==
    rightScore.completenessRank
  ) {
    return leftScore.completenessRank <
      rightScore.completenessRank
      ? left
      : right;
  }

  if (
    leftScore.bestNetProfit !==
    rightScore.bestNetProfit
  ) {
    return leftScore.bestNetProfit >
      rightScore.bestNetProfit
      ? left
      : right;
  }

  return String(
    left?.id || ""
  ).localeCompare(
    String(right?.id || "")
  ) <= 0
    ? left
    : right;
};

const collapseMirroredSportsRows = (
  sourceRows,
  pinnedRepresentativeIds
) => {
  const nonSports = [];
  const sportsGroups = new Map();

  sourceRows.forEach((item) => {
    if (
      getPrimaryCategory(item) !==
      "sports"
    ) {
      nonSports.push(item);
      return;
    }

    const key =
      getSportsEventGroupKey(
        item
      );

    const group =
      sportsGroups.get(key) || [];
    group.push(item);
    sportsGroups.set(
      key,
      group
    );
  });

  const sports = [];

  sportsGroups.forEach(
    (group, key) => {
      if (
        group.length === 2 &&
        areMirroredSportsRows(
          group[0],
          group[1]
        )
      ) {
        const pinnedId =
          pinnedRepresentativeIds
            ?.get(key);

        let representative =
          pinnedId
            ? group.find(
                (item) =>
                  String(
                    item?.id || ""
                  ) ===
                  String(pinnedId)
              )
            : null;

        if (!representative) {
          representative =
            chooseMirroredRepresentative(
              group[0],
              group[1]
            );

          if (
            representative?.id &&
            pinnedRepresentativeIds
          ) {
            pinnedRepresentativeIds.set(
              key,
              String(
                representative.id
              )
            );
          }
        }

        sports.push(
          representative
        );
        return;
      }

      sports.push(...group);
    }
  );

  return [
    ...nonSports,
    ...sports,
  ];
};

const isDefinitivelyClosedRow = (
  item
) => {
  const routes =
    Array.isArray(item?.routes)
      ? item.routes
      : [];

  if (!routes.length) {
    return false;
  }

  return routes.every(
    (route) =>
      String(
        route?.status || ""
      ).toLowerCase() ===
      "market_closed"
  );
};

const getSettlementTarget = (
  item
) => {
  const values = [
    item?.settlementTime,
    item?.resolutionTime,
    item?.closeTime,
    item?.polymarket
      ?.settlementTime,
    item?.polymarket
      ?.resolutionTime,
    item?.polymarket
      ?.closeTime,
    item?.kalshi
      ?.settlementTime,
    item?.kalshi
      ?.resolutionTime,
    item?.kalshi
      ?.closeTime,
  ]
    .map(parseTimestamp)
    .filter(Boolean)
    .map((date) =>
      date.getTime()
    )
    .filter(Number.isFinite);

  if (!values.length) {
    return null;
  }

  return Math.max(...values);
};

const getNetMetrics = (
  item,
  nowMs
) => {
  const route =
    getBestRoute(item);

  if (
    !routeIsExecutable(route) ||
    String(route?.status || "") !==
      "net_opportunity"
  ) {
    return {
      route,
      capital: null,
      profit: null,
      returnRate: null,
      apy: null,
      settlementTarget: null,
    };
  }

  const capital =
    asNumber(
      route?.maxPositiveEdgeCapitalUsd
    ) ??
    asNumber(
      route?.capitalRequiredUsd
    ) ??
    asNumber(
      route?.executableDepthUsd
    );

  const profit =
    asNumber(
      route
        ?.maxPositiveEdgeNetProfitUsd
    ) ??
    asNumber(
      route
        ?.netExecutableProfitUsd
    );

  const returnRate =
    asNumber(
      route?.maxPositiveEdgeReturnRate
    ) ??
    (capital !== null &&
    capital > 0 &&
    profit !== null
      ? profit / capital
      : null);

  const settlementTarget =
    getSettlementTarget(item);

  const apy =
    annualizeReturnRate(
      returnRate,
      settlementTarget,
      nowMs
    );

  return {
    route,
    capital,
    profit,
    returnRate,
    apy,
    settlementTarget,
  };
};

const stableAllComparator = (
  left,
  right
) => {
  const leftCompleteness =
    getPricingCompletenessRank(
      left
    );

  const rightCompleteness =
    getPricingCompletenessRank(
      right
    );

  if (
    leftCompleteness !==
    rightCompleteness
  ) {
    return (
      leftCompleteness -
      rightCompleteness
    );
  }

  const leftTiming =
    getEventTiming(left);

  const rightTiming =
    getEventTiming(right);

  if (
    leftTiming.phase === "live" &&
    rightTiming.phase !== "live"
  ) {
    return -1;
  }

  if (
    rightTiming.phase ===
      "live" &&
    leftTiming.phase !== "live"
  ) {
    return 1;
  }

  const leftTime =
    parseTimestamp(
      left?.scheduledTime
    )?.getTime() ?? Infinity;

  const rightTime =
    parseTimestamp(
      right?.scheduledTime
    )?.getTime() ?? Infinity;

  if (leftTime !== rightTime) {
    return leftTime - rightTime;
  }

  return String(
    left?.eventTitle || ""
  ).localeCompare(
    String(
      right?.eventTitle || ""
    )
  );
};


const SOCCER_DISPLAY_LIMIT = 500;

const applySoccerPresentationCap = (
  rows
) => {
  const nonSoccer = [];
  const liveSoccer = [];
  const majorLeagueSoccer = [];
  const otherSoccer = [];

  rows.forEach((item) => {
    const isSoccer =
      getPrimaryCategory(item) ===
        "sports" &&
      inferSportsSubcategory(item) ===
        "Soccer";

    if (!isSoccer) {
      nonSoccer.push(item);
      return;
    }

    const league =
      inferSoccerLeague(item);
    const live =
      getEventTiming(item)
        .phase === "live";
    const majorLeague =
      SOCCER_LEAGUE_PRIORITY.includes(
        league
      );

    // Hard cap soccer at 500 total cards. Within that cap, live markets
    // always get first priority, then protected major leagues, then the
    // best remaining low-priority markets. Each row belongs to one bucket
    // only, so the final soccer count can never exceed SOCCER_DISPLAY_LIMIT.
    if (live) {
      liveSoccer.push(item);
    } else if (majorLeague) {
      majorLeagueSoccer.push(item);
    } else {
      otherSoccer.push(item);
    }
  });

  liveSoccer.sort(
    stableAllComparator
  );
  majorLeagueSoccer.sort(
    stableAllComparator
  );
  otherSoccer.sort(
    stableAllComparator
  );

  const cappedSoccer = [
    ...liveSoccer,
    ...majorLeagueSoccer,
    ...otherSoccer,
  ].slice(0, SOCCER_DISPLAY_LIMIT);

  return [
    ...nonSoccer,
    ...cappedSoccer,
  ];
};

const financeMarketComparator = (
  left,
  right
) => {
  const leftSingle =
    isSingleVenueMarket(left);
  const rightSingle =
    isSingleVenueMarket(right);

  if (
    leftSingle !==
    rightSingle
  ) {
    return leftSingle ? 1 : -1;
  }

  if (
    leftSingle &&
    rightSingle
  ) {
    const leftRank =
      asNumber(
        left?.rankScore
      ) ?? 0;

    const rightRank =
      asNumber(
        right?.rankScore
      ) ?? 0;

    if (
      rightRank !== leftRank
    ) {
      return (
        rightRank - leftRank
      );
    }
  }

  return stableAllComparator(
    left,
    right
  );
};

const netComparator = (
  left,
  right,
  nowMs
) => {
  const leftMetrics =
    getNetMetrics(
      left,
      nowMs
    );

  const rightMetrics =
    getNetMetrics(
      right,
      nowMs
    );

  const leftApy =
    asNumber(leftMetrics.apy) ??
    -Infinity;

  const rightApy =
    asNumber(rightMetrics.apy) ??
    -Infinity;

  if (
    rightApy !== leftApy
  ) {
    return (
      rightApy -
      leftApy
    );
  }

  const leftProfit =
    asNumber(
      leftMetrics.profit
    ) ?? -Infinity;

  const rightProfit =
    asNumber(
      rightMetrics.profit
    ) ?? -Infinity;

  if (
    rightProfit !== leftProfit
  ) {
    return (
      rightProfit -
      leftProfit
    );
  }

  return stableAllComparator(
    left,
    right
  );
};

const buildVenueBuyUrl = (quote) => {
  if (!quote) return "";

  if (quote?.venueName !== "kalshi") {
    return quote?.url || "";
  }

  const ticker = String(
    quote?.marketId || ""
  ).trim();

  if (!ticker) {
    return quote?.url || "";
  }

  const base =
    `https://kalshi.com/markets_by_ticker/${encodeURIComponent(
      ticker.toLowerCase()
    )}`;

  try {
    const url = new URL(base);
    const side = String(
      quote?.side || ""
    ).toLowerCase();

    if (side === "yes" || side === "no") {
      url.searchParams.set(
        "orderSide",
        side
      );
    }

    return url.toString();
  } catch {
    return base;
  }
};


function VenueBuyButton({
  quote,
  label,
  isBest,
}) {
  const destinationUrl =
    buildVenueBuyUrl(quote);

  const className = [
    "pm-buy-button",
    isBest
      ? "pm-buy-button-best"
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  if (!destinationUrl) {
    return (
      <button
        type="button"
        className={className}
        disabled
      >
        {label}
      </button>
    );
  }

  return (
    <a
      className={className}
      href={destinationUrl}
      target="_blank"
      rel="noreferrer"
    >
      {label}
    </a>
  );
}

function OutcomeComparison({
  item,
  side,
  compact = false,
}) {
  const comparison =
    getSideComparison(
      item,
      side
    );

  const label =
    getOutcomeLabel(
      item,
      side
    );

  const renderVenue = (
    quote,
    venueLabel
  ) => {
    const isBest =
      comparison.best
        ?.venueName ===
      quote?.venueName;

    return (
      <div
        className={[
          "pm-venue-option",
          quote?.venueName ===
          "polymarket"
            ? "pm-venue-polymarket"
            : quote?.venueName ===
                "kalshi"
              ? "pm-venue-kalshi"
              : "",
          isBest
            ? "pm-venue-option-best"
            : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <div className="pm-venue-option-heading">
          <span>
            {venueLabel}
          </span>

          {isBest ? (
            <small>
              BEST ODDS
            </small>
          ) : null}
        </div>

        <strong>
          {formatCents(
            quote?.rawAsk
          )}
        </strong>

        <em>
          {quote?.feeReady
            ? `after fees ${formatCents(quote?.effectiveAsk)}`
            : "fee estimate pending"}
        </em>

        {!compact ? (
          <VenueBuyButton
            quote={quote}
            isBest={isBest}
            label={`Buy ${label}`}
          />
        ) : null}
      </div>
    );
  };

  return (
    <div className="pm-outcome-comparison">
      <div className="pm-outcome-heading">
        <div>
          <span>
            {side.toUpperCase()}
          </span>
          <strong>
            {label}
          </strong>
        </div>

        <small>
          {comparison.complete
            ? "AFTER FEES"
            : "LIVE PRICE"}
        </small>
      </div>

      <div className="pm-venue-options">
        {renderVenue(
          comparison.polymarket,
          "Polymarket"
        )}

        {renderVenue(
          comparison.kalshi,
          "Kalshi"
        )}
      </div>
    </div>
  );
}

function EventCardShell({
  item,
  tone = "",
  children,
  onOpen = null,
}) {
  const timing =
    getEventTiming(item);

  const interactive =
    typeof onOpen === "function";

  const handleCardClick =
    (event) => {
      if (!interactive) {
        return;
      }

      const target =
        event?.target;

      if (
        target?.closest?.(
          "a, button, input, select, textarea"
        )
      ) {
        return;
      }

      onOpen();
    };

  return (
    <article
      className={[
        "pm-event-card",
        tone,
      ]
        .filter(Boolean)
        .join(" ")}
      onClick={
        handleCardClick
      }
      style={
        interactive
          ? { cursor: "pointer" }
          : undefined
      }
    >
      <header className="pm-event-card-header">
        <div className="pm-event-tags">
          <span>
            {titleCase(
              getPrimaryCategory(
                item
              )
            )}
          </span>

          {item?.family ? (
            <span>
              {titleCase(
                item.family
              )}
            </span>
          ) : null}

          {timing.label ? (
            <span
              className={
                timing.phase ===
                "live"
                  ? "pm-event-tag-live"
                  : ""
              }
            >
              {timing.label}
            </span>
          ) : null}
        </div>

        <time>
          {formatDateTime(
            item?.scheduledTime
          )}
        </time>
      </header>

      <div className="pm-event-card-title">
        <h3>
          {item?.eventTitle ||
            "Untitled event"}
        </h3>

        {item?.contractTitle ? (
          <p>
            {
              item.contractTitle
            }
          </p>
        ) : null}
      </div>

      {children}
    </article>
  );
}

function BestSideSummary({
  item,
  side,
}) {
  const comparison =
    getSideComparison(
      item,
      side
    );

  const best =
    comparison.best;

  const outcome =
    getOutcomeLabel(
      item,
      side
    );

  const venue =
    best?.venueName ===
    "polymarket"
      ? "Polymarket"
      : best?.venueName ===
        "kalshi"
        ? "Kalshi"
        : "Unavailable";

  return (
    <div className="pm-best-side">
      <div>
        <span>
          BEST{" "}
          {side.toUpperCase()}{" "}
          AFTER FEES
        </span>

        <strong>
          {outcome}
        </strong>
      </div>

      <div
        className={[
          "pm-best-side-result",
          best?.venueName ===
          "polymarket"
            ? "pm-venue-polymarket"
            : best?.venueName ===
                "kalshi"
              ? "pm-venue-kalshi"
              : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <b>{venue}</b>

        <strong>
          {formatCents(
            best?.effectiveAsk
          )}
        </strong>

        <small>
          {comparison.complete
            ? "best executable after-fee price"
            : "fee estimate pending"}
        </small>
      </div>
    </div>
  );
}


function SingleVenueMarketCard({
  item,
}) {
  const venueName =
    String(
      item?.financeVenue || ""
    ).toLowerCase() ||
    (item?.kalshi
      ? "kalshi"
      : item?.polymarket
        ? "polymarket"
        : "");

  const venue =
    item?.[venueName] || {};

  const venueLabel =
    venueName === "polymarket"
      ? "Polymarket"
      : venueName === "kalshi"
        ? "Kalshi"
        : "Single venue";

  const status = String(
    item?.liveStatus || ""
  ).toLowerCase();

  const statusLabel =
    status === "ready"
      ? "LIVE BOOK"
      : status ===
          "partially_ready"
        ? "PARTIAL BOOK"
        : "BOOK UNAVAILABLE";

  const renderSide = (side) => {
    const isNo = side === "no";

    const ask = asNumber(
      isNo
        ? venue?.noAsk
        : venue?.yesAsk
    );

    const bid = asNumber(
      isNo
        ? venue?.noBid
        : venue?.yesBid
    );

    const size = asNumber(
      isNo
        ? venue?.noSize
        : venue?.yesSize
    );

    const quote =
      getVenueSideQuote(
        item,
        venueName,
        side
      );

    const canTrade =
      Boolean(
        buildVenueBuyUrl(quote)
      );

    return (
      <div
        className={[
          "pm-single-side",
          `pm-single-side-${side}`,
        ].join(" ")}
      >
        <div className="pm-single-side-heading">
          <span>
            {side.toUpperCase()}
          </span>

          <small>
            ASK
          </small>
        </div>

        <strong>
          {formatCents(ask)}
        </strong>

        <div className="pm-single-side-book">
          <span>
            Bid{" "}
            <b>
              {formatCents(bid)}
            </b>
          </span>

          <span>
            Depth{" "}
            <b>
              {formatContracts(
                size
              )}
            </b>
          </span>
        </div>

        {canTrade ? (
          <VenueBuyButton
            quote={quote}
            isBest={false}
            label={`Trade ${side.toUpperCase()}`}
          />
        ) : (
          <div className="pm-single-live-note">
            Live executable book
          </div>
        )}
      </div>
    );
  };

  return (
    <EventCardShell
      item={item}
      tone={[
        "pm-event-card-single",
        venueName
          ? `pm-event-card-single-${venueName}`
          : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="pm-single-market-summary">
        <span
          className={[
            "pm-single-venue-badge",
            venueName
              ? `pm-single-venue-${venueName}`
              : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {venueLabel}
        </span>

        <span
          className={[
            "pm-single-book-status",
            status === "ready"
              ? "ready"
              : status ===
                  "partially_ready"
                ? "partial"
                : "unavailable",
          ].join(" ")}
        >
          {statusLabel}
        </span>
      </div>

      <div className="pm-single-price-grid">
        {renderSide("yes")}
        {renderSide("no")}
      </div>

      <div className="pm-single-market-metrics">
        <div>
          <span>24H VOLUME</span>
          <strong>
            {formatMoney(
              item?.volume24h
            )}
          </strong>
        </div>

        <div>
          <span>LIQUIDITY</span>
          <strong>
            {formatMoney(
              item?.liquidity
            )}
          </strong>
        </div>

        <div>
          <span>OPEN INTEREST</span>
          <strong>
            {formatMoney(
              item?.openInterest
            )}
          </strong>
        </div>
      </div>
    </EventCardShell>
  );
}

function AllMarketCard({
  item,
}) {
  return (
    <EventCardShell
      item={item}
    >
      <div className="pm-best-side-stack">
        <BestSideSummary
          item={item}
          side="yes"
        />

        <BestSideSummary
          item={item}
          side="no"
        />
      </div>

      <div className="pm-outcome-stack">
        <OutcomeComparison
          item={item}
          side="yes"
        />

        <OutcomeComparison
          item={item}
          side="no"
        />
      </div>
    </EventCardShell>
  );
}

function GrossPairCard({
  item,
}) {
  return (
    <EventCardShell
      item={item}
      tone="pm-event-card-gross"
    >
      <div className="pm-best-side-stack">
        <BestSideSummary
          item={item}
          side="yes"
        />

        <BestSideSummary
          item={item}
          side="no"
        />
      </div>

      <div className="pm-gross-comparisons">
        <OutcomeComparison
          item={item}
          side="yes"
        />

        <OutcomeComparison
          item={item}
          side="no"
        />
      </div>
    </EventCardShell>
  );
}

const buildExecutionSegments = (route) => {
  const rows = Array.isArray(
    route?.depthBreakdown
  )
    ? route.depthBreakdown
    : [];

  let previousCapital = 0;
  let previousContracts = 0;
  let previousFees = 0;
  let cumulativePolymarketSpend = 0;
  let cumulativeKalshiSpend = 0;

  const accepted = rows
    .map((row, index) => {
      const capital = asNumber(
        row?.capitalRequiredUsd
      );
      const contracts = asNumber(
        row?.contracts
      );
      const fees = asNumber(
        row?.estimatedFeesUsd
      );
      const polymarketPrice =
        asNumber(
          row?.polymarketPrice
        );
      const kalshiPrice =
        asNumber(
          row?.kalshiPrice
        );

      if (
        capital === null ||
        contracts === null ||
        polymarketPrice === null ||
        kalshiPrice === null
      ) {
        return null;
      }

      const sliceContracts =
        Math.max(
          0,
          contracts -
            previousContracts
        );

      const sliceFees =
        fees === null
          ? 0
          : Math.max(
              0,
              fees - previousFees
            );

      const feePerContract =
        sliceContracts > 0
          ? sliceFees /
            sliceContracts
          : 0;

      cumulativePolymarketSpend +=
        sliceContracts *
        polymarketPrice;
      cumulativeKalshiSpend +=
        sliceContracts *
        kalshiPrice;

      const segment = {
        key: `accepted-${index}`,
        accepted: true,
        startCapital:
          previousCapital,
        endCapital: capital,
        capital,
        contracts,
        sliceContracts,
        polymarketPrice,
        kalshiPrice,
        pairedCost:
          polymarketPrice +
          kalshiPrice,
        allInMarginalCost:
          polymarketPrice +
          kalshiPrice +
          feePerContract,
        marginalNetEdge:
          1 -
          polymarketPrice -
          kalshiPrice -
          feePerContract,
        polymarketSpendUsd:
          cumulativePolymarketSpend,
        kalshiSpendUsd:
          cumulativeKalshiSpend,
        estimatedFeesUsd:
          fees,
        payoutUsd: contracts,
        totalProfitUsd:
          asNumber(
            row?.totalProfitUsd
          ),
        netReturnRate:
          asNumber(
            row?.netReturnRate
          ),
      };

      previousCapital = capital;
      previousContracts =
        contracts;
      previousFees =
        fees ?? previousFees;

      return segment;
    })
    .filter(Boolean);

  const next =
    route?.nextPriceAfterCapacity;

  const nextPoly = asNumber(
    next?.polymarketAsk
  );
  const nextKalshi = asNumber(
    next?.kalshiAsk
  );
  const nextContracts = asNumber(
    next?.availableContracts
  );
  const nextFees = asNumber(
    next?.estimatedFeesUsd
  );

  let rejected = null;

  if (
    nextPoly !== null &&
    nextKalshi !== null
  ) {
    const quantity =
      nextContracts !== null &&
      nextContracts > 0
        ? nextContracts
        : Math.max(
            previousContracts * 0.08,
            1
          );

    const feePerContract =
      nextFees !== null &&
      quantity > 0
        ? nextFees / quantity
        : 0;

    const addedCapital =
      quantity *
        (nextPoly +
          nextKalshi) +
      (nextFees || 0);

    rejected = {
      key: "edge-ends",
      accepted: false,
      startCapital:
        previousCapital,
      endCapital:
        previousCapital +
        Math.max(
          addedCapital,
          Math.max(
            previousCapital * 0.08,
            1
          )
        ),
      sliceContracts: quantity,
      polymarketPrice: nextPoly,
      kalshiPrice: nextKalshi,
      pairedCost:
        nextPoly + nextKalshi,
      allInMarginalCost:
        nextPoly +
        nextKalshi +
        feePerContract,
      marginalNetEdge:
        1 -
        nextPoly -
        nextKalshi -
        feePerContract,
    };
  }

  const finalAccepted =
    accepted.length
      ? accepted[
          accepted.length - 1
        ]
      : null;

  return {
    accepted,
    rejected,
    finalAccepted,
    maxExecutableCapital:
      previousCapital,
    maxExecutableContracts:
      previousContracts,
  };
};

function ArbitrageExecutionChart({
  route,
}) {
  const {
    accepted,
    rejected,
    finalAccepted,
    maxExecutableCapital,
    maxExecutableContracts,
  } = buildExecutionSegments(
    route
  );

  if (!accepted.length) {
    return (
      <div
        style={{
          padding: 24,
          border:
            "1px solid rgba(148, 163, 184, 0.16)",
          borderRadius: 14,
          background:
            "rgba(8, 15, 25, 0.55)",
          color:
            "rgba(203, 213, 225, 0.76)",
        }}
      >
        Executable order-book depth is
        not available for this route.
      </div>
    );
  }

  const chartSegments = [
    ...accepted,
    ...(rejected
      ? [rejected]
      : []),
  ];

  const width = 960;
  const height = 430;
  const left = 74;
  const right = 28;
  const top = 32;
  const bottom = 62;
  const plotWidth =
    width - left - right;
  const plotHeight =
    height - top - bottom;

  const displayedMaxCapital =
    Math.max(
      rejected?.endCapital || 0,
      maxExecutableCapital || 0,
      1
    );

  const maximumCents =
    Math.max(
      105,
      ...chartSegments.flatMap(
        (segment) => [
          segment.polymarketPrice *
            100,
          segment.kalshiPrice *
            100,
          segment.allInMarginalCost *
            100,
        ]
      )
    );

  const yMax =
    Math.ceil(
      maximumCents / 5
    ) * 5;

  const xFor = (capital) =>
    left +
    (Math.max(0, capital) /
      displayedMaxCapital) *
      plotWidth;

  const yFor = (price) =>
    top +
    ((yMax -
      Math.max(
        0,
        price * 100
      )) /
      yMax) *
      plotHeight;

  const stepPath = (
    segments,
    field
  ) => {
    if (!segments.length) {
      return "";
    }

    let path = "";

    segments.forEach(
      (segment, index) => {
        const xStart = xFor(
          segment.startCapital
        );
        const xEnd = xFor(
          segment.endCapital
        );
        const yValue = yFor(
          segment[field]
        );

        if (index === 0) {
          path = `M ${xStart} ${yValue} L ${xEnd} ${yValue}`;
          return;
        }

        const previous =
          segments[index - 1];
        const previousY = yFor(
          previous[field]
        );

        path +=
          ` L ${xStart} ${previousY}` +
          ` L ${xStart} ${yValue}` +
          ` L ${xEnd} ${yValue}`;
      }
    );

    return path;
  };

  const acceptedPolyPath =
    stepPath(
      accepted,
      "polymarketPrice"
    );
  const acceptedKalshiPath =
    stepPath(
      accepted,
      "kalshiPrice"
    );
  const acceptedAllInPath =
    stepPath(
      accepted,
      "allInMarginalCost"
    );

  const rejectedPolyPath =
    rejected
      ? stepPath(
          [rejected],
          "polymarketPrice"
        )
      : "";
  const rejectedKalshiPath =
    rejected
      ? stepPath(
          [rejected],
          "kalshiPrice"
        )
      : "";
  const rejectedAllInPath =
    rejected
      ? stepPath(
          [rejected],
          "allInMarginalCost"
        )
      : "";

  const yTicks = [
    0,
    25,
    50,
    75,
    100,
  ].filter(
    (value) => value <= yMax
  );

  const xTicks = [
    0,
    0.25,
    0.5,
    0.75,
    1,
  ].map(
    (ratio) =>
      displayedMaxCapital * ratio
  );

  const edgeEndX = xFor(
    maxExecutableCapital
  );
  const breakEvenY = yFor(1);

  const pointTooltip = (
    segment,
    label,
    value
  ) =>
    `${label}: ${formatPreciseCents(value)} · ` +
    `Capital: ${formatMoney(segment.endCapital)} · ` +
    `Contracts: ${formatContracts(segment.contracts)}`;

  return (
    <div
      style={{
        border:
          "1px solid rgba(148, 163, 184, 0.16)",
        borderRadius: 16,
        background:
          "linear-gradient(180deg, rgba(9,18,30,0.94), rgba(5,12,20,0.94))",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding:
            "18px 18px 6px",
          display: "flex",
          alignItems: "flex-start",
          justifyContent:
            "space-between",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div>
          <strong
            style={{
              display: "block",
              fontSize: "1.05rem",
            }}
          >
            Execution depth
          </strong>
          <small
            style={{
              display: "block",
              marginTop: 4,
              color:
                "rgba(203, 213, 225, 0.7)",
              lineHeight: 1.45,
            }}
          >
            Cumulative capital on the x-axis;
            marginal executable price on the y-axis.
            The bright line is combined cost after estimated fees; the profit zones apply to that combined line.
          </small>
        </div>

        <div
          style={{
            display: "flex",
            gap: 14,
            flexWrap: "wrap",
            fontSize: "0.72rem",
            color:
              "rgba(226, 232, 240, 0.84)",
          }}
        >
          <span>
            <b style={{ color: "#2E5CFF" }}>●</b>{" "}
            Polymarket
          </span>
          <span>
            <b style={{ color: "#34d399" }}>●</b>{" "}
            Kalshi
          </span>
          <span>
            <b style={{ color: "#f8fafc" }}>●</b>{" "}
            Combined after fees
          </span>
        </div>
      </div>

      <div
        style={{
          margin: "8px 18px 2px",
          padding: "10px 12px",
          borderRadius: 10,
          background:
            "rgba(34, 197, 94, 0.06)",
          border:
            "1px solid rgba(34, 197, 94, 0.14)",
          display: "flex",
          justifyContent:
            "space-between",
          gap: 12,
          flexWrap: "wrap",
          fontSize: "0.78rem",
        }}
      >
        <span>
          Positive net edge through{" "}
          <strong>
            {formatMoney(
              maxExecutableCapital
            )}
          </strong>
        </span>
        <span>
          <strong>
            {formatContracts(
              maxExecutableContracts
            )}
          </strong>{" "}
          matched contracts
        </span>
        {rejected ? (
          <span
            style={{
              color:
                "rgba(251, 113, 133, 0.92)",
            }}
          >
            Next available liquidity loses the edge
          </span>
        ) : null}
      </div>

      <div
        style={{
          width: "100%",
          overflowX: "auto",
          padding: "4px 8px 0",
        }}
      >
        <svg
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label="Arbitrage executable capital and price depth chart"
          style={{
            width: "100%",
            minWidth: 720,
            display: "block",
          }}
        >
          <rect
            x={left}
            y={top}
            width={plotWidth}
            height={Math.max(
              0,
              breakEvenY - top
            )}
            fill="rgba(244, 63, 94, 0.035)"
          />
          <rect
            x={left}
            y={breakEvenY}
            width={plotWidth}
            height={Math.max(
              0,
              height - bottom -
                breakEvenY
            )}
            fill="rgba(34, 197, 94, 0.035)"
          />

          <text
            x={left + 12}
            y={top + 18}
            fill="rgba(251, 113, 133, 0.55)"
            fontSize="11"
            fontWeight="700"
          >
            NO ARBITRAGE ZONE
          </text>
          <text
            x={left + 12}
            y={height - bottom - 12}
            fill="rgba(74, 222, 128, 0.58)"
            fontSize="11"
            fontWeight="700"
          >
            POSITIVE NET EDGE ZONE
          </text>

          {yTicks.map((tick) => {
            const y = yFor(
              tick / 100
            );
            return (
              <g key={`y-${tick}`}>
                <line
                  x1={left}
                  x2={width - right}
                  y1={y}
                  y2={y}
                  stroke="rgba(148, 163, 184, 0.14)"
                  strokeWidth="1"
                />
                <text
                  x={left - 12}
                  y={y + 4}
                  textAnchor="end"
                  fill="rgba(203, 213, 225, 0.58)"
                  fontSize="12"
                >
                  {tick}¢
                </text>
              </g>
            );
          })}

          {xTicks.map(
            (tick, index) => {
              const x = xFor(tick);
              return (
                <g
                  key={`x-${index}`}
                >
                  <line
                    x1={x}
                    x2={x}
                    y1={top}
                    y2={
                      height - bottom
                    }
                    stroke="rgba(148, 163, 184, 0.07)"
                    strokeWidth="1"
                  />
                  <text
                    x={x}
                    y={height - 30}
                    textAnchor="middle"
                    fill="rgba(203, 213, 225, 0.58)"
                    fontSize="12"
                  >
                    {formatMoney(tick)}
                  </text>
                </g>
              );
            }
          )}

          <line
            x1={left}
            x2={width - right}
            y1={breakEvenY}
            y2={breakEvenY}
            stroke="rgba(248, 113, 113, 0.78)"
            strokeDasharray="7 7"
            strokeWidth="1.7"
          />
          <text
            x={width - right - 4}
            y={breakEvenY - 8}
            textAnchor="end"
            fill="rgba(248, 113, 113, 0.94)"
            fontSize="12"
            fontWeight="800"
          >
            100¢ BREAK-EVEN
          </text>

          <path
            d={acceptedPolyPath}
            fill="none"
            stroke="#2E5CFF"
            strokeWidth="3"
            strokeLinejoin="round"
          />
          <path
            d={acceptedKalshiPath}
            fill="none"
            stroke="#34d399"
            strokeWidth="3"
            strokeLinejoin="round"
          />
          <path
            d={acceptedAllInPath}
            fill="none"
            stroke="#f8fafc"
            strokeWidth="4"
            strokeLinejoin="round"
          />

          {accepted.map(
            (segment) => {
              const x = xFor(
                segment.endCapital
              );
              return (
                <g key={`points-${segment.key}`}>
                  <circle
                    cx={x}
                    cy={yFor(
                      segment.polymarketPrice
                    )}
                    r="4"
                    fill="#2E5CFF"
                    stroke="#08111d"
                    strokeWidth="2"
                  >
                    <title>
                      {pointTooltip(
                        segment,
                        "Polymarket",
                        segment.polymarketPrice
                      )}
                    </title>
                  </circle>
                  <circle
                    cx={x}
                    cy={yFor(
                      segment.kalshiPrice
                    )}
                    r="4"
                    fill="#34d399"
                    stroke="#08111d"
                    strokeWidth="2"
                  >
                    <title>
                      {pointTooltip(
                        segment,
                        "Kalshi",
                        segment.kalshiPrice
                      )}
                    </title>
                  </circle>
                  <circle
                    cx={x}
                    cy={yFor(
                      segment.allInMarginalCost
                    )}
                    r="5"
                    fill="#f8fafc"
                    stroke="#08111d"
                    strokeWidth="2"
                  >
                    <title>
                      {pointTooltip(
                        segment,
                        "Combined after fees",
                        segment.allInMarginalCost
                      )}
                    </title>
                  </circle>
                </g>
              );
            }
          )}

          {rejected ? (
            <>
              <line
                x1={edgeEndX}
                x2={edgeEndX}
                y1={top}
                y2={height - bottom}
                stroke="#fb7185"
                strokeWidth="2"
                strokeDasharray="6 6"
              />
              <text
                x={Math.min(
                  edgeEndX + 10,
                  width - right - 150
                )}
                y={top + 38}
                fill="#fb7185"
                fontSize="12"
                fontWeight="800"
              >
                MAX EXECUTABLE
              </text>
              <text
                x={Math.min(
                  edgeEndX + 10,
                  width - right - 150
                )}
                y={top + 55}
                fill="rgba(251, 113, 133, 0.82)"
                fontSize="11"
              >
                {formatMoney(
                  maxExecutableCapital
                )}
              </text>

              <path
                d={rejectedPolyPath}
                fill="none"
                stroke="#2E5CFF"
                strokeWidth="2"
                strokeDasharray="5 6"
                opacity="0.55"
              />
              <path
                d={rejectedKalshiPath}
                fill="none"
                stroke="#34d399"
                strokeWidth="2"
                strokeDasharray="5 6"
                opacity="0.55"
              />
              <path
                d={rejectedAllInPath}
                fill="none"
                stroke="#fb7185"
                strokeWidth="3"
                strokeDasharray="5 6"
              />
            </>
          ) : (
            <>
              <line
                x1={edgeEndX}
                x2={edgeEndX}
                y1={top}
                y2={height - bottom}
                stroke="rgba(251, 191, 36, 0.8)"
                strokeWidth="2"
                strokeDasharray="6 6"
              />
              <text
                x={Math.max(
                  left + 10,
                  edgeEndX - 125
                )}
                y={top + 38}
                fill="rgba(251, 191, 36, 0.94)"
                fontSize="12"
                fontWeight="800"
              >
                DISPLAYED DEPTH ENDS
              </text>
            </>
          )}

          <text
            x={18}
            y={top + plotHeight / 2}
            transform={`rotate(-90 18 ${top + plotHeight / 2})`}
            textAnchor="middle"
            fill="rgba(203, 213, 225, 0.58)"
            fontSize="12"
            fontWeight="700"
          >
            MARGINAL PRICE
          </text>
          <text
            x={left + plotWidth / 2}
            y={height - 7}
            textAnchor="middle"
            fill="rgba(203, 213, 225, 0.58)"
            fontSize="12"
            fontWeight="700"
          >
            CUMULATIVE CAPITAL DEPLOYED
          </text>
        </svg>
      </div>

      <div
        style={{
          padding:
            "4px 16px 16px",
          display: "grid",
          gap: 8,
        }}
      >
        {accepted.map(
          (segment, index) => (
            <div
              key={segment.key}
              style={{
                display: "grid",
                gridTemplateColumns:
                  "minmax(150px, 1.25fr) repeat(5, minmax(88px, 1fr))",
                gap: 10,
                alignItems: "center",
                padding: "10px 12px",
                borderRadius: 10,
                background:
                  "rgba(34, 197, 94, 0.055)",
                border:
                  "1px solid rgba(34, 197, 94, 0.12)",
                fontSize: "0.76rem",
                overflowX: "auto",
              }}
            >
              <strong>
                {index === 0
                  ? `$0 → ${formatMoney(segment.endCapital)}`
                  : `${formatMoney(segment.startCapital)} → ${formatMoney(segment.endCapital)}`}
              </strong>
              <span>
                {formatContracts(
                  segment.contracts
                )} contracts
              </span>
              <span>
                Poly {formatCents(segment.polymarketPrice)}
              </span>
              <span>
                Kalshi {formatCents(segment.kalshiPrice)}
              </span>
              <span>
                All-in{" "}
                <strong>
                  {formatPreciseCents(
                    segment.allInMarginalCost
                  )}
                </strong>
              </span>
              <span
                style={{
                  color: "#4ade80",
                  fontWeight: 800,
                }}
              >
                +{(
                  Math.max(
                    0,
                    segment.marginalNetEdge
                  ) * 100
                ).toFixed(2)}¢ NET EDGE
              </span>
            </div>
          )
        )}

        {rejected ? (
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "minmax(190px, 1.5fr) repeat(4, minmax(95px, 1fr))",
              gap: 10,
              alignItems: "center",
              padding: "11px 12px",
              borderRadius: 10,
              background:
                "rgba(244, 63, 94, 0.07)",
              border:
                "1px solid rgba(244, 63, 94, 0.2)",
              fontSize: "0.76rem",
              overflowX: "auto",
            }}
          >
            <strong
              style={{
                color: "#fb7185",
              }}
            >
              NEXT AVAILABLE LIQUIDITY — NO LONGER PROFITABLE
            </strong>
            <span>
              Poly {formatCents(rejected.polymarketPrice)}
            </span>
            <span>
              Kalshi {formatCents(rejected.kalshiPrice)}
            </span>
            <span>
              All-in{" "}
              <strong>
                {formatPreciseCents(
                  rejected.allInMarginalCost
                )}
              </strong>
            </span>
            <span
              style={{
                color: "#fb7185",
                fontWeight: 800,
              }}
            >
              {(
                rejected.marginalNetEdge *
                100
              ).toFixed(2)}¢ MARGINAL NET EDGE
            </span>
          </div>
        ) : null}

        {route?.depthBreakdownTruncated ? (
          <small
            style={{
              color:
                "rgba(203, 213, 225, 0.62)",
            }}
          >
            Intermediate execution rows are capped for display; headline capacity and profit use the full computed order-book depth.
          </small>
        ) : null}
      </div>
    </div>
  );
}

function NetArbitrageDetail({
  item,
  nowMs,
  onBack,
  liveConnected,
  feedAgeLabel,
}) {
  const metrics =
    getNetMetrics(
      item,
      nowMs
    );
  const route =
    metrics.route || {};
  const polyLeg =
    getRouteLeg(
      item,
      route,
      "polymarket"
    );
  const kalshiLeg =
    getRouteLeg(
      item,
      route,
      "kalshi"
    );
  const timing =
    getEventTiming(item);

  const depth =
    buildExecutionSegments(route);
  const firstSegment =
    depth.accepted[0] || null;
  const finalSegment =
    depth.finalAccepted;

  const matchedContracts =
    asNumber(
      route?.maxPositiveEdgeContracts
    ) ??
    finalSegment?.contracts ??
    null;

  const payoutUsd =
    matchedContracts !== null
      ? matchedContracts
      : null;
  const polymarketSpendUsd =
    finalSegment?.polymarketSpendUsd ??
    null;
  const kalshiSpendUsd =
    finalSegment?.kalshiSpendUsd ??
    null;
  const estimatedFeesUsd =
    finalSegment?.estimatedFeesUsd ??
    (metrics.capital !== null &&
    polymarketSpendUsd !== null &&
    kalshiSpendUsd !== null
      ? Math.max(
          0,
          metrics.capital -
            polymarketSpendUsd -
            kalshiSpendUsd
        )
      : null);

  const currentAllIn =
    firstSegment?.allInMarginalCost ??
    null;
  const currentEdge =
    firstSegment?.marginalNetEdge ??
    null;

  const stillNet =
    String(route?.status || "") ===
      "net_opportunity" &&
    routeIsExecutable(route);

  return (
    <section
      className="prediction-markets-page"
      data-ui-version={PREDICTION_UI_VERSION}
    >
      <header className="pm-terminal-header">
        <div className="pm-brand-block">
          <img
            src={BullionaireLogo}
            alt="Bullionaire logo"
            className="pm-brand-logo"
          />
          <div>
            <strong>
              Bullionaire Prediction Markets
            </strong>
            <small>
              Arbitrage execution depth
            </small>
          </div>
        </div>

        <span
          className={[
            "pm-live-badge",
            liveConnected
              ? "connected"
              : "disconnected",
          ].join(" ")}
        >
          <i className="pm-live-dot" />
          {liveConnected
            ? `LIVE · ${feedAgeLabel}`
            : "DEGRADED"}
        </span>
      </header>

      <button
        type="button"
        onClick={onBack}
        style={{
          margin: "4px 0 14px",
          padding: "8px 0",
          border: 0,
          background: "transparent",
          color:
            "rgba(226, 232, 240, 0.82)",
          cursor: "pointer",
          font: "inherit",
          fontWeight: 800,
        }}
      >
        ← Back to arbitrage list
      </button>

      <div
        style={{
          padding: 22,
          border:
            "1px solid rgba(34, 197, 94, 0.2)",
          borderRadius: 16,
          background:
            "linear-gradient(145deg, rgba(7,24,20,0.88), rgba(7,15,25,0.92))",
          marginBottom: 14,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent:
              "space-between",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <div>
            <div
              style={{
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
                marginBottom: 10,
                color:
                  "rgba(203, 213, 225, 0.78)",
                fontSize: "0.8rem",
              }}
            >
              <span>
                {titleCase(
                  getPrimaryCategory(
                    item
                  )
                )}
              </span>
              <span>
                {timing.label ||
                  "Market"}
              </span>
              <span>
                {formatDateTime(
                  item?.scheduledTime
                )}
              </span>
            </div>

            <h2
              style={{
                margin: 0,
                fontSize:
                  "clamp(1.4rem, 3vw, 2.15rem)",
              }}
            >
              {item?.eventTitle ||
                "Prediction market"}
            </h2>
            <p
              style={{
                margin:
                  "8px 0 0",
                color:
                  "rgba(203, 213, 225, 0.8)",
                fontSize: "1rem",
              }}
            >
              {item?.contractTitle}
            </p>
          </div>

          <div
            style={{
              padding: "10px 14px",
              borderRadius: 999,
              background: stillNet
                ? "rgba(34, 197, 94, 0.12)"
                : "rgba(244, 63, 94, 0.1)",
              color: stillNet
                ? "#4ade80"
                : "#fb7185",
              fontWeight: 900,
              letterSpacing:
                "0.04em",
              fontSize: "0.76rem",
            }}
          >
            {stillNet
              ? "NET ARBITRAGE LIVE"
              : "EDGE NO LONGER LIVE"}
          </div>
        </div>

        <div
          style={{
            marginTop: 20,
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 10,
          }}
        >
          <div
            style={{
              padding: "16px 18px",
              borderRadius: 12,
              background:
                "rgba(34, 197, 94, 0.08)",
              border:
                "1px solid rgba(34, 197, 94, 0.18)",
            }}
          >
            <span
              style={{
                display: "block",
                color:
                  "rgba(203, 213, 225, 0.68)",
                fontSize: "0.68rem",
                letterSpacing:
                  "0.055em",
                fontWeight: 800,
              }}
            >
              MAX EXECUTABLE AT POSITIVE NET EDGE
            </span>
            <strong
              style={{
                display: "block",
                marginTop: 5,
                fontSize:
                  "clamp(1.7rem, 3vw, 2.35rem)",
                color: "#f8fafc",
              }}
            >
              {formatMoney(
                metrics.capital
              )}
            </strong>
            <small
              style={{
                display: "block",
                marginTop: 4,
                color:
                  "rgba(203, 213, 225, 0.72)",
              }}
            >
              {formatContracts(
                matchedContracts
              )}{" "}
              matched contracts
            </small>
          </div>

          {[
            [
              "TOTAL PROFIT",
              formatMoney(
                metrics.profit,
                { signed: true }
              ),
            ],
            [
              "NET RETURN",
              formatPercent(
                metrics.returnRate
              ),
            ],
            [
              "CURRENT ALL-IN",
              formatPreciseCents(
                currentAllIn
              ),
            ],
          ].map(
            ([label, value]) => (
              <div
                key={label}
                style={{
                  padding:
                    "16px 14px",
                  borderRadius: 12,
                  background:
                    "rgba(15, 23, 42, 0.5)",
                  border:
                    "1px solid rgba(148, 163, 184, 0.12)",
                }}
              >
                <span
                  style={{
                    display: "block",
                    color:
                      "rgba(203, 213, 225, 0.62)",
                    fontSize: "0.66rem",
                    letterSpacing:
                      "0.055em",
                    fontWeight: 800,
                  }}
                >
                  {label}
                </span>
                <strong
                  style={{
                    display: "block",
                    marginTop: 7,
                    fontSize: "1.15rem",
                    color:
                      label ===
                      "TOTAL PROFIT"
                        ? "#4ade80"
                        : "#f8fafc",
                  }}
                >
                  {value}
                </strong>
              </div>
            )
          )}
        </div>

        <div
          style={{
            marginTop: 14,
            padding: "14px 16px",
            borderRadius: 12,
            background:
              "rgba(2, 8, 23, 0.38)",
            border:
              "1px solid rgba(148, 163, 184, 0.12)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent:
                "space-between",
              gap: 12,
              flexWrap: "wrap",
              marginBottom: 10,
            }}
          >
            <strong>
              Current executable trade
            </strong>
            {currentEdge !== null ? (
              <span
                style={{
                  color:
                    currentEdge > 0
                      ? "#4ade80"
                      : "#fb7185",
                  fontWeight: 900,
                  fontSize: "0.82rem",
                }}
              >
                {currentEdge > 0
                  ? "+"
                  : ""}
                {(
                  currentEdge * 100
                ).toFixed(2)}¢ NET EDGE
              </span>
            ) : null}
          </div>

          <div className="pm-net-legs">
            <div>
              <span>
                POLYMARKET · {polyLeg.side?.toUpperCase()}
              </span>
              <strong>
                {polyLeg.label}
              </strong>
              <b>
                {formatCents(
                  polyLeg.price
                )}
              </b>
            </div>
            <div className="pm-net-plus">
              +
            </div>
            <div>
              <span>
                KALSHI · {kalshiLeg.side?.toUpperCase()}
              </span>
              <strong>
                {kalshiLeg.label}
              </strong>
              <b>
                {formatCents(
                  kalshiLeg.price
                )}
              </b>
            </div>
          </div>

          <div
            style={{
              marginTop: 12,
              textAlign: "center",
              color:
                "rgba(226, 232, 240, 0.84)",
              fontSize: "0.8rem",
            }}
          >
            Combined marginal cost after estimated fees:{" "}
            <strong
              style={{
                color:
                  currentEdge !== null &&
                  currentEdge > 0
                    ? "#4ade80"
                    : "#fb7185",
              }}
            >
              {formatPreciseCents(
                currentAllIn
              )}
            </strong>
          </div>
        </div>

        <div
          style={{
            marginTop: 10,
            color:
              "rgba(203, 213, 225, 0.58)",
            fontSize: "0.7rem",
            lineHeight: 1.45,
          }}
        >
          Annualized equivalent:{" "}
          <strong>
            {formatApy(
              metrics.apy
            )}
          </strong>{" "}
          through the later venue settlement/close. APY is contextual and is not a forecast of a one-year return.
        </div>
      </div>

      {stillNet ? (
        <>
          <ArbitrageExecutionChart
            route={route}
          />

          <div
            style={{
              marginTop: 14,
              padding: 18,
              borderRadius: 16,
              border:
                "1px solid rgba(148, 163, 184, 0.16)",
              background:
                "rgba(8, 15, 25, 0.58)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent:
                  "space-between",
                gap: 12,
                alignItems: "center",
                flexWrap: "wrap",
                marginBottom: 12,
              }}
            >
              <div>
                <strong
                  style={{
                    display: "block",
                    fontSize: "1rem",
                  }}
                >
                  Execution instructions
                </strong>
                <small
                  style={{
                    display: "block",
                    marginTop: 3,
                    color:
                      "rgba(203, 213, 225, 0.68)",
                  }}
                >
                  Match the same contract quantity on both venues. Dollar estimates below use the currently displayed positive-edge depth.
                </small>
              </div>
              <strong
                style={{
                  color: "#4ade80",
                  fontSize: "1.05rem",
                }}
              >
                {formatContracts(
                  matchedContracts
                )}{" "}
                contracts
              </strong>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(180px, 1fr))",
                gap: 9,
              }}
            >
              {[
                [
                  "POLYMARKET LEG",
                  `Buy ${formatContracts(matchedContracts)} ${polyLeg.label}`,
                  `${formatCents(polyLeg.price)} top ask · ${formatMoney(polymarketSpendUsd)} total spend across depth`,
                ],
                [
                  "KALSHI LEG",
                  `Buy ${formatContracts(matchedContracts)} ${kalshiLeg.label}`,
                  `${formatCents(kalshiLeg.price)} top ask · ${formatMoney(kalshiSpendUsd)} total spend across depth`,
                ],
                [
                  "ESTIMATED FEES",
                  formatMoney(
                    estimatedFeesUsd
                  ),
                  "Included in total capital",
                ],
                [
                  "TOTAL CAPITAL",
                  formatMoney(
                    metrics.capital
                  ),
                  "Both legs plus estimated fees",
                ],
                [
                  "PAIRED PAYOUT",
                  formatMoney(
                    payoutUsd
                  ),
                  "Settlement payout for the matched contract quantity",
                ],
                [
                  "EST. NET PROFIT",
                  formatMoney(
                    metrics.profit,
                    { signed: true }
                  ),
                  `${formatPercent(metrics.returnRate)} on deployed capital`,
                ],
              ].map(
                ([label, value, note]) => (
                  <div
                    key={label}
                    style={{
                      padding:
                        "12px 13px",
                      borderRadius: 10,
                      background:
                        "rgba(15, 23, 42, 0.45)",
                      border:
                        "1px solid rgba(148, 163, 184, 0.1)",
                    }}
                  >
                    <span
                      style={{
                        display: "block",
                        color:
                          "rgba(203, 213, 225, 0.58)",
                        fontSize: "0.64rem",
                        letterSpacing:
                          "0.05em",
                        fontWeight: 800,
                      }}
                    >
                      {label}
                    </span>
                    <strong
                      style={{
                        display: "block",
                        marginTop: 5,
                        color:
                          label ===
                          "EST. NET PROFIT"
                            ? "#4ade80"
                            : "#f8fafc",
                      }}
                    >
                      {value}
                    </strong>
                    <small
                      style={{
                        display: "block",
                        marginTop: 4,
                        color:
                          "rgba(203, 213, 225, 0.62)",
                        lineHeight: 1.35,
                      }}
                    >
                      {note}
                    </small>
                  </div>
                )
              )}
            </div>

            <div
              style={{
                marginTop: 12,
                padding: "10px 12px",
                borderRadius: 10,
                background:
                  "rgba(251, 191, 36, 0.055)",
                border:
                  "1px solid rgba(251, 191, 36, 0.13)",
                color:
                  "rgba(226, 232, 240, 0.74)",
                fontSize: "0.72rem",
                lineHeight: 1.45,
              }}
            >
              Execute both legs for the same matched quantity. The displayed profit is only locked if both legs fill at the modeled prices and fees; partial fills or market movement can change the realized return.
            </div>
          </div>
        </>
      ) : (
        <div
          style={{
            padding: 24,
            borderRadius: 14,
            border:
              "1px solid rgba(244, 63, 94, 0.18)",
            background:
              "rgba(244, 63, 94, 0.06)",
            color:
              "rgba(226, 232, 240, 0.82)",
          }}
        >
          This opportunity has moved since
          you opened it. The live feed no
          longer shows positive after-fee
          edge at the current executable
          prices.
        </div>
      )}

      <div
        className="pm-net-buy-grid"
        style={{
          marginTop: 14,
        }}
      >
        <VenueBuyButton
          quote={polyLeg}
          isBest
          label={`Buy ${polyLeg.label} on Polymarket`}
        />
        <VenueBuyButton
          quote={kalshiLeg}
          isBest
          label={`Buy ${kalshiLeg.label} on Kalshi`}
        />
      </div>

      <div
        style={{
          marginTop: 10,
          color:
            "rgba(203, 213, 225, 0.55)",
          fontSize: "0.68rem",
          lineHeight: 1.45,
          textAlign: "center",
        }}
      >
        Live executable order-book prices. Available depth, venue fees, and fills can change before both legs are completed.
      </div>
    </section>
  );
}

function NetArbitrageCard({
  item,
  nowMs,
  onOpen,
}) {
  const metrics =
    getNetMetrics(
      item,
      nowMs
    );

  const route =
    metrics.route;

  const polyLeg =
    getRouteLeg(
      item,
      route,
      "polymarket"
    );

  const kalshiLeg =
    getRouteLeg(
      item,
      route,
      "kalshi"
    );

  return (
    <EventCardShell
      item={item}
      tone="pm-event-card-net"
      onOpen={onOpen}
    >
      <div className="pm-net-legs">
        <div>
          <span>
            POLYMARKET ·{" "}
            {polyLeg.side?.toUpperCase()}
          </span>

          <strong>
            {polyLeg.label}
          </strong>

          <b>
            {formatCents(
              polyLeg.price
            )}
          </b>
        </div>

        <div className="pm-net-plus">
          +
        </div>

        <div>
          <span>
            KALSHI ·{" "}
            {kalshiLeg.side?.toUpperCase()}
          </span>

          <strong>
            {kalshiLeg.label}
          </strong>

          <b>
            {formatCents(
              kalshiLeg.price
            )}
          </b>
        </div>
      </div>

      <div className="pm-net-metrics">
        <div
          title="Maximum capital that can be deployed through the current displayed books while each additional paired fill still has positive estimated net edge."
        >
          <span>
            EXECUTABLE CAPITAL
          </span>

          <strong>
            {formatMoney(
              metrics.capital
            )}
          </strong>
        </div>

        <div>
          <span>
            TOTAL PROFIT
          </span>

          <strong>
            {formatMoney(
              metrics.profit,
              { signed: true }
            )}
          </strong>
        </div>

        <div>
          <span>
            NET RETURN
          </span>

          <strong>
            {formatPercent(
              metrics.returnRate
            )}
          </strong>
        </div>

        <div
          className="pm-net-apy"
          title="Annualized compounded yield using the current net return and the time until the later venue settlement/close."
        >
          <span>
            ANNUALIZED APY
          </span>

          <strong>
            {formatApy(
              metrics.apy
            )}
          </strong>
        </div>
      </div>

      {Array.isArray(
        route?.depthBreakdown
      ) &&
      route.depthBreakdown.length ? (
        <button
          type="button"
          onClick={onOpen}
          style={{
            width: "100%",
            marginTop: 10,
            padding: "10px 12px",
            display: "flex",
            alignItems: "center",
            justifyContent:
              "space-between",
            gap: 10,
            border:
              "1px solid rgba(34, 197, 94, 0.24)",
            borderRadius: 10,
            background:
              "rgba(34, 197, 94, 0.07)",
            color: "inherit",
            cursor: "pointer",
            font: "inherit",
            fontWeight: 800,
          }}
        >
          <span>
            Open execution depth chart
          </span>
          <span aria-hidden="true">
            ›
          </span>
        </button>
      ) : null}

      <div className="pm-net-buy-grid">
        <VenueBuyButton
          quote={polyLeg}
          isBest
          label={`Buy ${polyLeg.label} on Polymarket`}
        />

        <VenueBuyButton
          quote={kalshiLeg}
          isBest
          label={`Buy ${kalshiLeg.label} on Kalshi`}
        />
      </div>
    </EventCardShell>
  );
}

function ScrollableNav({
  className,
  ariaLabel,
  children,
}) {
  const navRef = useRef(null);

  const [
    scrollState,
    setScrollState,
  ] = useState({
    canScrollLeft: false,
    canScrollRight: false,
  });

  const updateScrollState =
    useCallback(() => {
      const nav = navRef.current;

      if (!nav) {
        return;
      }

      const maxScrollLeft =
        Math.max(
          0,
          nav.scrollWidth -
            nav.clientWidth
        );

      const nextState = {
        canScrollLeft:
          nav.scrollLeft > 2,
        canScrollRight:
          maxScrollLeft > 2 &&
          nav.scrollLeft <
            maxScrollLeft - 2,
      };

      setScrollState(
        (current) =>
          current.canScrollLeft ===
            nextState.canScrollLeft &&
          current.canScrollRight ===
            nextState.canScrollRight
            ? current
            : nextState
      );
    }, []);

  useEffect(() => {
    updateScrollState();
  });

  useEffect(() => {
    const nav = navRef.current;

    if (!nav) {
      return undefined;
    }

    const handleScroll = () => {
      updateScrollState();
    };

    const handleResize = () => {
      updateScrollState();
    };

    const handleWheel = (event) => {
      const maxScrollLeft =
        Math.max(
          0,
          nav.scrollWidth -
            nav.clientWidth
        );

      if (maxScrollLeft <= 2) {
        return;
      }

      const delta =
        Math.abs(event.deltaX) >
        Math.abs(event.deltaY)
          ? event.deltaX
          : event.deltaY;

      if (!delta) {
        return;
      }

      const atStart =
        nav.scrollLeft <= 2;
      const atEnd =
        nav.scrollLeft >=
        maxScrollLeft - 2;

      if (
        (delta < 0 && atStart) ||
        (delta > 0 && atEnd)
      ) {
        return;
      }

      event.preventDefault();
      nav.scrollLeft += delta;
    };

    nav.addEventListener(
      "scroll",
      handleScroll,
      { passive: true }
    );

    nav.addEventListener(
      "wheel",
      handleWheel,
      { passive: false }
    );

    window.addEventListener(
      "resize",
      handleResize
    );

    return () => {
      nav.removeEventListener(
        "scroll",
        handleScroll
      );

      nav.removeEventListener(
        "wheel",
        handleWheel
      );

      window.removeEventListener(
        "resize",
        handleResize
      );
    };
  }, [updateScrollState]);

  const scrollNav = (direction) => {
    const nav = navRef.current;

    if (!nav) {
      return;
    }

    const navButtons = Array.from(
      nav.children
    ).filter(
      (child) =>
        child.tagName === "BUTTON"
    );

    const averageButtonWidth =
      navButtons.length > 0
        ? navButtons.reduce(
            (sum, button) =>
              sum +
              button.getBoundingClientRect()
                .width,
            0
          ) / navButtons.length
        : 120;

    const navStyles =
      window.getComputedStyle(nav);

    const navGap =
      Number.parseFloat(
        navStyles.columnGap ||
          navStyles.gap
      ) || 8;

    const boxWidth =
      averageButtonWidth + navGap;

    const currentScrollDistance =
      Math.max(
        220,
        nav.clientWidth * 0.6
      );

    const scrollDistance =
      Math.max(
        boxWidth,
        currentScrollDistance -
          boxWidth * 1
      );

    nav.scrollBy({
      left:
        direction * scrollDistance,
      behavior: "smooth",
    });
  };

  const arrowStyle = {
    position: "absolute",
    top: "50%",
    transform: "translateY(-50%)",
    zIndex: 8,
    width: "30px",
    height: "30px",
    display: "grid",
    placeItems: "center",
    padding: 0,
    border:
      "1px solid rgba(141, 166, 207, 0.28)",
    borderRadius: "999px",
    color: "#e6eefb",
    background:
      "rgba(10, 20, 36, 0.94)",
    boxShadow:
      "0 4px 14px rgba(0, 0, 0, 0.32)",
    cursor: "pointer",
    fontSize: "24px",
    lineHeight: 1,
  };

  return (
    <div
      style={{
        position: "relative",
        minWidth: 0,
      }}
    >
      <nav
        ref={navRef}
        className={className}
        aria-label={ariaLabel}
      >
        {children}
      </nav>

      {scrollState.canScrollLeft ? (
        <button
          type="button"
          aria-label={`Scroll ${ariaLabel} left`}
          title="Scroll left"
          onClick={() =>
            scrollNav(-1)
          }
          style={{
            ...arrowStyle,
            left: "8px",
          }}
        >
          <span
            aria-hidden="true"
            style={{
              display: "block",
              lineHeight: 1,
              transform:
                "translateY(-4px)",
            }}
          >
            ‹
          </span>
        </button>
      ) : null}

      {scrollState.canScrollRight ? (
        <button
          type="button"
          aria-label={`Scroll ${ariaLabel} right`}
          title="Scroll right"
          onClick={() =>
            scrollNav(1)
          }
          style={{
            ...arrowStyle,
            right: "8px",
          }}
        >
          <span
            aria-hidden="true"
            style={{
              display: "block",
              lineHeight: 1,
              transform:
                "translateY(-4px)",
            }}
          >
            ›
          </span>
        </button>
      ) : null}
    </div>
  );
}

function PredictionMarkets() {
  const [
    payload,
    setPayload,
  ] = useState(null);

  const [
    readiness,
    setReadiness,
  ] = useState(null);

  const [
    isLoading,
    setIsLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState("");

  const [
    browserFeed,
    setBrowserFeed,
  ] = useState(
    "connecting"
  );

  const [
    lastFeedAt,
    setLastFeedAt,
  ] = useState(null);

  const [
    isRefreshing,
    setIsRefreshing,
  ] = useState(false);

  const
    mirroredRepresentativeIdsRef =
      useRef(new Map());

  const [
    primaryCategory,
    setPrimaryCategory,
  ] = useState("all");

  const [
    subcategory,
    setSubcategory,
  ] = useState("all");

  const [
    soccerLeague,
    setSoccerLeague,
  ] = useState("all");

  const [
    viewFilter,
    setViewFilter,
  ] = useState("all");

  const [
    searchText,
    setSearchText,
  ] = useState("");

  const [
    visibleLimit,
    setVisibleLimit,
  ] = useState(
    LIST_PAGE_SIZE
  );

  const [
    selectedNetOpportunityId,
    setSelectedNetOpportunityId,
  ] = useState(null);

  const [
    nowMs,
    setNowMs,
  ] = useState(
    Date.now()
  );

  // Keep one process-wide browser WebSocket for the lifetime of this page.
  // Category and subcategory changes are client-side filters only; they must
  // never tear down the live feed or flash CONNECTING again.
  const backendMarketGroup = "all";

  const requestedMarketGroupRef =
    useRef("all");

  const hasEverOpenedSocketRef =
    useRef(false);

  useEffect(() => {
    const timer =
      window.setInterval(
        () =>
          setNowMs(
            Date.now()
          ),
        1000
      );

    return () =>
      window.clearInterval(
        timer
      );
  }, []);

  const terminalQuery =
    useMemo(
      () =>
        new URLSearchParams({
          market_group: "all",
          opportunity_type:
            "all",
          live_only: "false",
          executable_only:
            "false",
          min_gross_edge:
            "-1",
          min_net_edge:
            "-1",
          min_executable_contracts:
            "0.0001",
          min_net_profit_usd:
            "-1000000",
          sort_by: "event",
          limit: String(
            TERMINAL_LIMIT
          ),
        }).toString(),
      []
    );

  const applyPayload =
    useCallback((body) => {
      const bodyMarketGroup =
        String(
          body?.marketGroup ||
            body?.filters
              ?.marketGroup ||
            "all"
        ).toLowerCase();

      if (
        bodyMarketGroup !==
        requestedMarketGroupRef
          .current
      ) {
        return;
      }

      setLastFeedAt(
        Date.now()
      );

      if (
        body?.apiContractVersion &&
        body.apiContractVersion !==
          API_CONTRACT_VERSION
      ) {
        throw new Error(
          `Unsupported API contract ${body.apiContractVersion}. Expected ${API_CONTRACT_VERSION}.`
        );
      }

      setPayload(body);
      setError("");
    }, []);

  const loadReadiness =
    useCallback(async () => {
      try {
        const response =
          await authenticatedFetch(
            `${API_BASE}/api/prediction-markets/terminal/readiness`,
            {
              headers: {
                Accept:
                  "application/json",
              },
            }
          );

        const body =
          await response
            .json()
            .catch(
              () => ({})
            );

        setReadiness(
          response.ok
            ? body
            : {
                ...body,
                ready: false,
                alive: response.status !== 0,
                reasons: [
                  body?.detail ||
                    `readiness_http_${response.status}`,
                ],
              }
        );
      } catch {
        setReadiness({
          ready: false,
          alive: false,
          reasons: [
            "unreachable",
          ],
        });
      }
    }, []);

  const loadTerminal =
    useCallback(async () => {
      try {
        const response =
          await authenticatedFetch(
            `${API_BASE}/api/prediction-markets/terminal/overview?${terminalQuery}`,
            {
              cache: "no-store",
              headers: {
                Accept:
                  "application/json",
              },
            }
          );

        const body =
          await response
            .json()
            .catch(
              () => ({})
            );

        if (!response.ok) {
          throw new Error(
            body?.detail ||
              "Could not load the live prediction terminal."
          );
        }

        applyPayload(body);
      } catch (
        loadError
      ) {
        setError(
          loadError?.message ||
            "Could not load the live prediction terminal."
        );
      } finally {
        setIsLoading(false);
      }
    }, [
      terminalQuery,
      applyPayload,
    ]);

  // The browser WebSocket must not depend on render-time callbacks.  Keep the
  // newest callback bodies in refs so changing categories can never tear down
  // the socket effect.
  const applyPayloadRef =
    useRef(applyPayload);
  const loadTerminalRef =
    useRef(loadTerminal);

  useEffect(() => {
    applyPayloadRef.current =
      applyPayload;
  }, [applyPayload]);

  useEffect(() => {
    loadTerminalRef.current =
      loadTerminal;
  }, [loadTerminal]);

  const handleManualRefresh =
    useCallback(async () => {
      setIsRefreshing(true);
      mirroredRepresentativeIdsRef
        .current
        .clear();

      try {
        await Promise.all([
          loadTerminal(),
          loadReadiness(),
        ]);
      } finally {
        setIsRefreshing(false);
      }
    }, [
      loadTerminal,
      loadReadiness,
    ]);

  useEffect(() => {
    loadTerminal();
    loadReadiness();

    const readinessTimer =
      window.setInterval(
        loadReadiness,
        READINESS_INTERVAL_MS
      );

    return () =>
      window.clearInterval(
        readinessTimer
      );
  }, [
    loadTerminal,
    loadReadiness,
  ]);

  useEffect(() => {
    let cancelled = false;
    let socket = null;
    let socketOpen = false;
    let reconnectTimer = null;

    const websocketBase =
      API_BASE
        ? API_BASE.replace(
            /^http/i,
            "ws"
          )
        : `${
            window.location.protocol ===
            "https:"
              ? "wss:"
              : "ws:"
          }//${window.location.host}`;

    const connect = async () => {
      if (cancelled) {
        return;
      }

      if (
        !hasEverOpenedSocketRef
          .current
      ) {
        setBrowserFeed(
          "connecting"
        );
      }

      let accessToken;
      try {
        accessToken = await getPredictionAccessToken(false);
      } catch (authError) {
        if (cancelled) {
          return;
        }

        setBrowserFeed(
          "fallback"
        );
        setError(
          authError?.message ||
            "You must be signed in to use Prediction Markets."
        );
        reconnectTimer =
          window.setTimeout(
            connect,
            WS_RECONNECT_DELAY_MS * 2
          );
        return;
      }

      if (cancelled) {
        return;
      }

      socket =
        new WebSocket(
          `${websocketBase}/api/prediction-markets/terminal/ws?${terminalQuery}`,
          [WS_AUTH_PROTOCOL, accessToken]
        );

      socket.onopen = () => {
        socketOpen = true;
        hasEverOpenedSocketRef
          .current = true;
        setBrowserFeed(
          "live"
        );
        setLastFeedAt(
          Date.now()
        );
        setError("");
      };

      socket.onmessage = (
        event
      ) => {
        setLastFeedAt(
          Date.now()
        );

        try {
          const message =
            JSON.parse(
              event.data
            );

          if (
            [
              "terminal_overview",
              "finance_overview",
            ].includes(
              message?.type
            ) &&
            message?.payload
          ) {
            applyPayloadRef.current(
              message.payload
            );
            setIsLoading(
              false
            );
          } else if (
            message?.type ===
            "error"
          ) {
            setError(
              message?.detail ||
                "The browser feed reported an error."
            );
          }
        } catch (
          messageError
        ) {
          setError(
            messageError?.message ||
              "The browser feed returned invalid data."
          );
        }
      };

      socket.onerror =
        () => socket?.close();

      socket.onclose = () => {
        socketOpen = false;

        if (cancelled) {
          return;
        }

        setBrowserFeed(
          "fallback"
        );

        reconnectTimer =
          window.setTimeout(
            connect,
            WS_RECONNECT_DELAY_MS
          );
      };
    };

    connect();

    const fallbackTimer =
      window.setInterval(
        () => {
          if (
            !socketOpen &&
            document.visibilityState ===
              "visible"
          ) {
            loadTerminalRef.current();
          }
        },
        HTTP_FALLBACK_INTERVAL_MS
      );

    return () => {
      cancelled = true;
      socketOpen = false;

      if (reconnectTimer) {
        window.clearTimeout(
          reconnectTimer
        );
      }

      window.clearInterval(
        fallbackTimer
      );

      socket?.close();
    };
  }, [terminalQuery]);

  const payloadMarketGroup =
    String(
      payload?.marketGroup ||
        payload?.filters
          ?.marketGroup ||
        "all"
    ).toLowerCase();

  const payloadMatchesBackendMarketGroup =
    Boolean(payload) &&
    payloadMarketGroup ===
      backendMarketGroup;

  const rows =
    useMemo(() => {
      if (
        !payloadMatchesBackendMarketGroup
      ) {
        return [];
      }

      const matchedRows =
        Array.isArray(
          payload?.opportunities
        )
          ? payload.opportunities
          : [];

      const singleVenueRows =
        Array.isArray(
          payload?.financeInventory
        )
          ? payload.financeInventory.map(
              (row) => {
                const rawGroup =
                  String(
                    row?.market_group ||
                      row?.marketGroup ||
                      ""
                  ).toLowerCase();

                const financeGroup =
                  rawGroup === "macro" ||
                  rawGroup === "economics"
                    ? "economics"
                    : "companies";

                return normalizeFinanceInventoryRow(
                  row,
                  financeGroup
                );
              }
            )
          : [];

      return [
        ...matchedRows,
        ...singleVenueRows,
      ];
    }, [
      payload,
      payloadMatchesBackendMarketGroup,
    ]);

  const displayRows =
    useMemo(() => {
      const activeRows =
        collapseMirroredSportsRows(
          rows,
          mirroredRepresentativeIdsRef
            .current
        ).filter(
          (item) =>
            !isDefinitivelyClosedRow(
              item
            )
        );

      return applySoccerPresentationCap(
        activeRows
      );
    }, [rows]);

  const selectedNetItem =
    useMemo(
      () =>
        selectedNetOpportunityId
          ? displayRows.find(
              (item) =>
                String(
                  item?.id || ""
                ) ===
                String(
                  selectedNetOpportunityId
                )
            ) || null
          : null,
      [
        displayRows,
        selectedNetOpportunityId,
      ]
    );

  const manifestSummary =
    payload?.streamStatus
      ?.manifest || {};

  const categoryOptions =
    useMemo(() => {
      const groups = new Set();

      const pairGroups =
        manifestSummary
          ?.pairsByGroup || {};

      Object.keys(
        pairGroups
      ).forEach((value) => {
        const normalized =
          value === "macro"
            ? "economics"
            : String(
                value || ""
              ).toLowerCase();

        if (normalized) {
          groups.add(normalized);
        }
      });

      const financeGroups =
        manifestSummary
          ?.financeInventoryByGroup ||
        {};

      if (
        Number(
          financeGroups
            ?.companies || 0
        ) > 0
      ) {
        groups.add("companies");
      }

      if (
        Number(
          financeGroups?.macro || 0
        ) > 0
      ) {
        groups.add("economics");
      }

      if (!groups.size) {
        displayRows.forEach(
          (item) => {
            const category =
              getPrimaryCategory(
                item
              );

            if (category) {
              groups.add(category);
            }
          }
        );
      }

      const ordered = [
        ...groups,
      ];

      ordered.sort(
        (left, right) => {
          const leftIndex =
            CATEGORY_PRIORITY.indexOf(
              left
            );

          const rightIndex =
            CATEGORY_PRIORITY.indexOf(
              right
            );

          if (
            leftIndex !== -1 ||
            rightIndex !== -1
          ) {
            if (
              leftIndex === -1
            ) {
              return 1;
            }

            if (
              rightIndex === -1
            ) {
              return -1;
            }

            return (
              leftIndex -
              rightIndex
            );
          }

          return left.localeCompare(
            right
          );
        }
      );

      return [
        "all",
        "live",
        ...ordered,
      ];
    }, [
      payload,
      displayRows,
    ]);

  const categoryCounts =
    useMemo(() => {
      const counts = {
        all: displayRows.length,
        live: 0,
      };

      displayRows.forEach(
        (item) => {
          if (
            getEventTiming(item)
              .phase === "live"
          ) {
            counts.live += 1;
          }

          const category =
            getPrimaryCategory(
              item
            );

          if (
            !category ||
            category === "all" ||
            category === "live"
          ) {
            return;
          }

          counts[category] =
            (counts[category] ||
              0) + 1;
        }
      );

      return counts;
    }, [displayRows]);

  const categoryRows =
    useMemo(() => {
      if (
        primaryCategory ===
        "all"
      ) {
        return displayRows;
      }

      if (
        primaryCategory ===
        "live"
      ) {
        return displayRows.filter(
          (item) =>
            getEventTiming(item)
              .phase === "live"
        );
      }

      return displayRows.filter(
        (item) =>
          getPrimaryCategory(
            item
          ) ===
          primaryCategory
      );
    }, [
      displayRows,
      primaryCategory,
    ]);

  const subcategoryOptions =
    useMemo(() => {
      if (
        primaryCategory ===
        "sports"
      ) {
        return SPORTS_SUBCATEGORIES.filter(
          (option) => {
            if (
              option === "all"
            ) {
              return true;
            }

            if (
              option === "live"
            ) {
              return categoryRows.some(
                (item) =>
                  getEventTiming(
                    item
                  ).phase ===
                  "live"
              );
            }

            return categoryRows.some(
              (item) =>
                inferSportsSubcategory(
                  item
                ) === option
            );
          }
        );
      }

      if (
        primaryCategory ===
        "economics"
      ) {
        return MACRO_SUBCATEGORIES.filter(
          (option) => {
            if (
              option === "all"
            ) {
              return true;
            }

            return categoryRows.some(
              (item) =>
                inferMacroCategory(
                  item
                ) === option
            );
          }
        );
      }

      if (
        primaryCategory ===
          "all" ||
        primaryCategory ===
          "live"
      ) {
        return ["all"];
      }

      const generic = [
        ...new Set(
          categoryRows
            .map(
              getGenericSubcategory
            )
            .filter(
              (value) =>
                value &&
                value !== "All"
            )
        ),
      ].sort();

      return [
        "all",
        ...generic,
      ];
    }, [
      primaryCategory,
      categoryRows,
    ]);

  const subcategoryCount =
    useCallback(
      (option) => {
        if (
          option === "all"
        ) {
          return categoryRows.length;
        }

        if (
          primaryCategory ===
          "sports"
        ) {
          if (
            option === "live"
          ) {
            return categoryRows.filter(
              (item) =>
                getEventTiming(
                  item
                ).phase ===
                "live"
            ).length;
          }

          const matchingRows =
            categoryRows.filter(
              (item) =>
                inferSportsSubcategory(
                  item
                ) === option
            );

          return option === "Soccer"
            ? Math.min(
                matchingRows.length,
                SOCCER_DISPLAY_LIMIT
              )
            : matchingRows.length;
        }

        if (
          primaryCategory ===
          "economics"
        ) {
          return categoryRows.filter(
            (item) =>
              inferMacroCategory(
                item
              ) === option
          ).length;
        }

        return categoryRows.filter(
          (item) =>
            getGenericSubcategory(
              item
            ) === option
        ).length;
      },
      [
        categoryRows,
        primaryCategory,
      ]
    );

  const afterSubcategoryRows =
    useMemo(() => {
      if (
        subcategory === "all"
      ) {
        return categoryRows;
      }

      if (
        primaryCategory ===
        "sports"
      ) {
        if (
          subcategory === "live"
        ) {
          return categoryRows.filter(
            (item) =>
              getEventTiming(
                item
              ).phase ===
              "live"
          );
        }

        const matchingRows =
          categoryRows.filter(
            (item) =>
              inferSportsSubcategory(
                item
              ) ===
              subcategory
          );

        return subcategory === "Soccer"
          ? matchingRows.slice(
              0,
              SOCCER_DISPLAY_LIMIT
            )
          : matchingRows;
      }

      if (
        primaryCategory ===
        "economics"
      ) {
        return categoryRows.filter(
          (item) =>
            inferMacroCategory(
              item
            ) ===
            subcategory
        );
      }

      return categoryRows.filter(
        (item) =>
          getGenericSubcategory(
            item
          ) ===
          subcategory
      );
    }, [
      categoryRows,
      primaryCategory,
      subcategory,
    ]);

  const soccerLeagueOptions =
    useMemo(() => {
      if (
        primaryCategory !==
          "sports" ||
        subcategory !==
          "Soccer"
      ) {
        return ["all"];
      }

      const values = [
        ...new Set(
          afterSubcategoryRows
            .map(
              inferSoccerLeague
            )
            .filter(Boolean)
        ),
      ].sort((left, right) => {
        const leftIndex =
          SOCCER_LEAGUE_PRIORITY.indexOf(
            left
          );
        const rightIndex =
          SOCCER_LEAGUE_PRIORITY.indexOf(
            right
          );

        if (
          leftIndex !== -1 ||
          rightIndex !== -1
        ) {
          if (leftIndex === -1) {
            return 1;
          }

          if (rightIndex === -1) {
            return -1;
          }

          return (
            leftIndex -
            rightIndex
          );
        }

        return left.localeCompare(
          right
        );
      });

      return [
        "all",
        ...values,
      ];
    }, [
      primaryCategory,
      subcategory,
      afterSubcategoryRows,
    ]);

  const soccerLeagueCount =
    useCallback(
      (league) => {
        if (
          league === "all"
        ) {
          return afterSubcategoryRows.length;
        }

        return afterSubcategoryRows.filter(
          (item) =>
            inferSoccerLeague(
              item
            ) === league
        ).length;
      },
      [afterSubcategoryRows]
    );

  const categoryFilteredRows =
    useMemo(() => {
      if (
        primaryCategory ===
          "sports" &&
        subcategory ===
          "Soccer" &&
        soccerLeague !== "all"
      ) {
        return afterSubcategoryRows.filter(
          (item) =>
            inferSoccerLeague(
              item
            ) ===
            soccerLeague
        );
      }

      return afterSubcategoryRows;
    }, [
      primaryCategory,
      subcategory,
      soccerLeague,
      afterSubcategoryRows,
    ]);

  const normalizedSearch =
    normalizeText(
      searchText
    );

  const searchMode =
    Boolean(
      normalizedSearch
    );

  const filteredRows =
    useMemo(() => {
      let next =
        searchMode
          ? displayRows.filter((item) =>
              getSearchText(
                item
              ).includes(
                normalizedSearch
              )
            )
          : categoryFilteredRows;

      if (!searchMode) {
        if (
          viewFilter === "gross"
        ) {
          next = next.filter(
            isStrictGrossOpportunity
          );
        } else if (
          viewFilter === "net"
        ) {
          next = next.filter(
            isStrictNetOpportunity
          );
        }
      }

      const sorted =
        [...next];

      if (
        viewFilter === "net" &&
        !searchMode
      ) {
        sorted.sort(
          (left, right) =>
            netComparator(
              left,
              right,
              nowMs
            )
        );
      } else if (
        !searchMode &&
        [
          "companies",
          "economics",
        ].includes(
          primaryCategory
        )
      ) {
        sorted.sort(
          financeMarketComparator
        );
      } else {
        sorted.sort(
          stableAllComparator
        );
      }

      return sorted;
    }, [
      searchMode,
      displayRows,
      normalizedSearch,
      categoryFilteredRows,
      viewFilter,
      primaryCategory,
      nowMs,
    ]);

  const viewCounts =
    useMemo(
      () => ({
        all:
          categoryFilteredRows.length,
        gross:
          categoryFilteredRows.filter(
            isStrictGrossOpportunity
          ).length,
        net:
          categoryFilteredRows.filter(
            isStrictNetOpportunity
          ).length,
      }),
      [categoryFilteredRows]
    );

  useEffect(() => {
    setVisibleLimit(
      LIST_PAGE_SIZE
    );
  }, [
    primaryCategory,
    subcategory,
    soccerLeague,
    viewFilter,
    searchText,
  ]);

  useEffect(() => {
    setSubcategory("all");
    setSoccerLeague("all");
  }, [primaryCategory]);

  useEffect(() => {
    if (
      subcategory !== "Soccer"
    ) {
      setSoccerLeague("all");
    }
  }, [subcategory]);

  const totalStrictNet =
    useMemo(
      () =>
        displayRows.filter(
          isStrictNetOpportunity
        ).length,
      [displayRows]
    );

  const totalStrictGross =
    useMemo(
      () =>
        displayRows.filter(
          isStrictGrossOpportunity
        ).length,
      [displayRows]
    );

  const venueConnected =
    payload?.streamStatus
      ?.venueConnected || {};

  const bothConnected =
    Boolean(
      venueConnected
        ?.polymarket &&
        venueConnected
          ?.kalshi
    );

  const ready =
    readiness?.ready !==
      false &&
    !readiness
      ?.restartRequired;

  const liveConnected =
    bothConnected &&
    ready &&
    browserFeed === "live";

  const visibleRows =
    filteredRows.slice(
      0,
      visibleLimit
    );

  const feedAgeSeconds =
    lastFeedAt
      ? Math.max(
          0,
          Math.floor(
            (nowMs - lastFeedAt) /
              1000
          )
        )
      : null;

  const feedAgeLabel =
    feedAgeSeconds === null
      ? "waiting"
      : feedAgeSeconds < 2
        ? "now"
        : feedAgeSeconds < 60
          ? `${feedAgeSeconds}s ago`
          : `${Math.floor(
              feedAgeSeconds / 60
            )}m ago`;

  const displayMode =
    searchMode
      ? "all"
      : viewFilter;

  const openNetOpportunity =
    useCallback((item) => {
      const id = String(
        item?.id || ""
      );

      if (!id) {
        return;
      }

      setSelectedNetOpportunityId(
        id
      );
      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    }, []);

  const closeNetOpportunity =
    useCallback(() => {
      setSelectedNetOpportunityId(
        null
      );
      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    }, []);

  if (
    selectedNetOpportunityId &&
    selectedNetItem
  ) {
    return (
      <NetArbitrageDetail
        item={selectedNetItem}
        nowMs={nowMs}
        onBack={
          closeNetOpportunity
        }
        liveConnected={
          liveConnected
        }
        feedAgeLabel={
          feedAgeLabel
        }
      />
    );
  }

  const handleCategoryChange =
    (category) => {
      setPrimaryCategory(
        category
      );
      setSubcategory(
        "all"
      );
      setSoccerLeague(
        "all"
      );

      if (
        category ===
          "companies" ||
        category ===
          "economics"
      ) {
        setViewFilter("all");
      }
    };

  return (
    <section className="prediction-markets-page">
      <header className="pm-terminal-header">
        <div className="pm-brand-block">
          <img
            src={BullionaireLogo}
            alt="Bullionaire logo"
            className="pm-brand-logo"
          />

          <div>
            <strong>
              Bullionaire
              Prediction Markets
            </strong>

            <small>
              Polymarket × Kalshi ·
              live markets &
              executable comparisons
            </small>
          </div>
        </div>

        <div className="pm-terminal-header-actions">
          <span
            className={[
              "pm-live-badge",
              liveConnected
                ? "connected"
                : "disconnected",
            ].join(" ")}
          >
            <i className="pm-live-dot" />

            {liveConnected
              ? `LIVE · ${feedAgeLabel}`
              : browserFeed ===
                  "connecting"
                ? "CONNECTING"
                : "DEGRADED"}
          </span>

          <button
            type="button"
            className="pm-header-refresh"
            onClick={
              handleManualRefresh
            }
            disabled={
              isRefreshing
            }
          >
            {isRefreshing
              ? "Refreshing…"
              : "Refresh"}
          </button>
        </div>
      </header>

      <div className="pm-terminal-stats">
        <span>
          <strong>
            {displayRows.length}
          </strong>{" "}
          current markets
        </span>

        <span className="pm-stat-gross">
          <strong>
            {totalStrictGross}
          </strong>{" "}
          verified gross edges
        </span>

        <span className="pm-stat-net">
          <strong>
            {totalStrictNet}
          </strong>{" "}
          verified net arbitrages
        </span>
      </div>

      <ScrollableNav
        className="pm-category-nav"
        ariaLabel="Prediction market categories"
      >
        {categoryOptions.map(
          (category) => (
            <button
              key={category}
              type="button"
              className={
                primaryCategory ===
                category
                  ? "active"
                  : ""
              }
              onClick={() =>
                handleCategoryChange(
                  category
                )
              }
            >
              <span>
                {category ===
                "all"
                  ? "All"
                  : category ===
                      "live"
                    ? "Live"
                    : titleCase(
                        category
                      )}
              </span>

              <small>
                {categoryCounts[
                  category
                ] || 0}
              </small>
            </button>
          )
        )}
      </ScrollableNav>

      {subcategoryOptions.length >
      1 ? (
        <ScrollableNav
          className="pm-subcategory-nav"
          ariaLabel="Prediction market subcategories"
        >
          {subcategoryOptions.map(
            (option) => (
              <button
                key={option}
                type="button"
                className={
                  subcategory ===
                  option
                    ? "active"
                    : ""
                }
                onClick={() =>
                  setSubcategory(
                    option
                  )
                }
              >
                {option ===
                "all"
                  ? "All"
                  : option ===
                      "live"
                    ? "Live Sports"
                    : titleCase(
                        option
                      )}

                <small>
                  {subcategoryCount(
                    option
                  )}
                </small>
              </button>
            )
          )}
        </ScrollableNav>
      ) : null}

      {primaryCategory ===
        "sports" &&
      subcategory ===
        "Soccer" &&
      soccerLeagueOptions.length >
        1 ? (
        <ScrollableNav
          className="pm-subcategory-nav pm-soccer-league-nav"
          ariaLabel="Soccer leagues"
        >
          {soccerLeagueOptions.map(
            (league) => (
              <button
                key={league}
                type="button"
                className={
                  soccerLeague ===
                  league
                    ? "active"
                    : ""
                }
                onClick={() =>
                  setSoccerLeague(
                    league
                  )
                }
              >
                {league ===
                "all"
                  ? "All Soccer"
                  : league}

                <small>
                  {soccerLeagueCount(
                    league
                  )}
                </small>
              </button>
            )
          )}
        </ScrollableNav>
      ) : null}

      <div className="pm-control-bar">
        <div className="pm-view-filter">
          {VIEW_OPTIONS.map(
            (view) => (
              <button
                key={view.key}
                type="button"
                className={
                  viewFilter ===
                  view.key
                    ? "active"
                    : ""
                }
                onClick={() =>
                  setViewFilter(
                    view.key
                  )
                }
              >
                {view.label}

                <small>
                  {viewCounts[
                    view.key
                  ]}
                </small>
              </button>
            )
          )}
        </div>

        <label className="pm-market-search">
          <span>⌕</span>

          <input
            type="search"
            value={searchText}
            onChange={(event) =>
              setSearchText(
                event.target.value
              )
            }
            placeholder="Search any event, team or topic…"
          />
        </label>
      </div>

      {!ready ? (
        <div className="pm-system-warning">
          <strong>
            Live status
          </strong>

          <span>
            {readiness?.restartRequired
              ? "The backend snapshot changed and the prediction terminal must be restarted."
              : "The live terminal is still initializing."}
          </span>
        </div>
      ) : null}

      {error ? (
        <div className="pm-system-warning pm-system-error">
          <strong>
            Connection
          </strong>

          <span>
            {error}
          </span>
        </div>
      ) : null}

      {searchMode ? (
        <div className="pm-search-context">
          Search filters the
          currently loaded market
          set. Single-venue finance
          markets show one live
          book; matched rows retain
          the two-venue comparison.
        </div>
      ) : null}

      <div className="pm-results-header">
        <div>
          <strong>
            {searchMode
              ? "Search Results"
              : VIEW_OPTIONS.find(
                  (view) =>
                    view.key ===
                    viewFilter
                )?.label}
          </strong>

          <span>
            {
              filteredRows.length
            }{" "}
            current markets
          </span>
        </div>

        <small>
          {browserFeed === "live"
            ? `LIVE FEED · ${feedAgeLabel}`
            : "HTTP FALLBACK"}
        </small>
      </div>

      {!payloadMatchesBackendMarketGroup &&
      isLoading ? (
        <div className="pm-empty-state">
          Loading prediction
          markets…
        </div>
      ) : !visibleRows.length ? (
        <div className="pm-empty-state">
          No markets match the
          current filters.
        </div>
      ) : (
        <div className="pm-event-grid">
          {visibleRows.map(
            (item) => {
              if (
                isSingleVenueMarket(
                  item
                )
              ) {
                return (
                  <SingleVenueMarketCard
                    key={item?.id}
                    item={item}
                  />
                );
              }

              if (
                displayMode ===
                "net"
              ) {
                return (
                  <NetArbitrageCard
                    key={
                      item?.id
                    }
                    item={item}
                    nowMs={
                      nowMs
                    }
                    onOpen={() =>
                      openNetOpportunity(
                        item
                      )
                    }
                  />
                );
              }

              if (
                displayMode ===
                "gross"
              ) {
                return (
                  <GrossPairCard
                    key={
                      item?.id
                    }
                    item={item}
                  />
                );
              }

              return (
                <AllMarketCard
                  key={item?.id}
                  item={item}
                />
              );
            }
          )}
        </div>
      )}

      {visibleLimit <
      filteredRows.length ? (
        <div className="pm-load-more">
          <button
            type="button"
            onClick={() =>
              setVisibleLimit(
                (value) =>
                  value +
                  LIST_PAGE_SIZE
              )
            }
          >
            Show{" "}
            {Math.min(
              LIST_PAGE_SIZE,
              filteredRows.length -
                visibleLimit
            )}{" "}
            more
          </button>
        </div>
      ) : null}

      <footer className="pm-page-footnote">
        Prices are live
        executable asks and can
        change before execution.
        Single-venue cards show
        the book for that venue
        only and never imply an
        arbitrage match.
        Green-highlighted Buy
        buttons on matched rows
        indicate the better
        after-fee price only when
        both venue fee estimates
        are available. Net
        Arbitrage contains only
        backend-classified strict
        settlement opportunities.
      </footer>
    </section>
  );
}

export default PredictionMarkets;