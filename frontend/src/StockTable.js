import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { AgGridReact } from "ag-grid-react";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";
import { ModuleRegistry, AllCommunityModule } from "ag-grid-community";
import "./StockTable.css";
import "./Watchlist.css";
import { useLocation, useNavigate } from "react-router-dom";
import WatchlistAnalytics from "./components/WatchlistAnalytics";
import { supabase } from "./lib/supabaseClient";
import StockChartModal from "./components/charts/StockChartModal";

const saveWatchlists = async (updated) => {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const user = session?.user;
if (!user) return;

  const rows = Object.entries(updated).map(([name, tickers]) => ({
    user_id: user.id,
    name,
    tickers,
  }));

  const { error: deleteError } = await supabase
    .from("watchlists")
    .delete()
    .eq("user_id", user.id);

  if (deleteError) {
    console.error("Delete failed:", deleteError);
    return false;
  }

  if (!rows.length) return true;

  const { error: insertError } = await supabase
    .from("watchlists")
    .insert(rows);

  if (insertError) {
    console.error("Insert failed:", insertError);
    return false;
  }

  return true;
};

ModuleRegistry.registerModules([AllCommunityModule]);

const SPARKLINE_STORAGE_KEY = "bullionaire_sparkline_cache_v1";
const SPARKLINE_REFRESH_MS = 2 * 60 * 1000;
const SPARKLINE_STORAGE_LIMIT = 750;

const loadPersistentSparklineCache = () => {
  try {
    const raw = localStorage.getItem(SPARKLINE_STORAGE_KEY);
    if (!raw) return {};

    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (err) {
    console.error("Failed to load cached dashboard graphs", err);
    return {};
  }
};

const persistSparklineCache = (cache) => {
  try {
    const trimmedEntries = Object.entries(cache || {})
      .filter(([, value]) => Array.isArray(value?.points) && value.points.length)
      .sort(
        (a, b) =>
          Number(b[1]?.cached_at || 0) - Number(a[1]?.cached_at || 0)
      )
      .slice(0, SPARKLINE_STORAGE_LIMIT);

    localStorage.setItem(
      SPARKLINE_STORAGE_KEY,
      JSON.stringify(Object.fromEntries(trimmedEntries))
    );
  } catch (err) {
    console.error("Failed to persist dashboard graphs", err);
  }
};

const metricTooltips = {
  "Day Volume": "The number of shares traded during the current trading day.",
  "Market Cap": "The total market value of the company. Calculated as share price times shares outstanding.",
  "EPS (TTM)": "Earnings per share over the trailing twelve months. A profitability measure showing earnings for each share.",
  "P/E (TTM)": "Price-to-earnings ratio over the trailing twelve months. Shows how much investors pay for each dollar of earnings.",
"PEG Ratio": "Growth-adjusted PEG ratio. It compares valuation to expected earnings growth, so it is more forward-looking than a pure trailing metric. Around 1 is often viewed as fair, under 1 may look cheaper relative to growth, and above 2 can look expensive unless growth quality is strong.",
"P/S Ratio": "Trailing twelve-month price-to-sales ratio. It compares the company’s market value to its last 12 months of revenue. Under 1 can look inexpensive, 1-3 is often reasonable, 3-10 is growth-priced, and above 10 can be expensive unless margins and growth are very strong.",
"Beta": "Measures how volatile the stock is compared to the overall market. Above 1 means more volatile than the market.",
"Standard Deviation (1Y)": "Measures the historical variability of the stock over the trailing one-year period using Bullionaire's calculated standard deviation. Higher values indicate greater price volatility.",
  "EBITDA": "Earnings before interest, taxes, depreciation, and amortization. Often used to compare operating performance.",
  "Short % of Float": "The percentage of tradable shares currently sold short. A high value may suggest bearish sentiment or short-squeeze potential.",
  "Gross Profit": "Revenue minus the direct cost of goods sold. Shows how much money remains after production costs.",
  "Dividend Yield": "Annual dividend income as a percentage of the stock price.",
  "Analyst Upside": "The estimated percentage upside from the current price to the average analyst price target.",
  "Analyst Downside": "The estimated percentage downside from the current price to the lower analyst target estimate.",
  "Number of Analysts": "The number of analysts included in the available price target data.",
  "Mean Target": "The average analyst price target for the stock.",
  "RSI": "Relative Strength Index. A momentum indicator where below 30 may suggest oversold and above 70 may suggest overbought.",
  "MACD": "Moving Average Convergence Divergence. A momentum indicator comparing short-term and long-term price trends.",
  "MACD Signal": "A smoothed version of MACD. Traders often watch for MACD crossing above or below this line.",
  "MACD Histogram": "The difference between MACD and the signal line. It helps show whether momentum is strengthening or weakening.",
  "SMA 20": "The stock's average closing price over the last 20 trading days. Used to identify short-term trend direction.",
  "Sector": "The broad industry group the company belongs to.",
  "Latest Dividend Amount": "The most recent dividend payment amount per share.",
  "Latest Ex-Dividend Date": "The date by which an investor must own the stock to receive the latest dividend.",
  "Latest Pay Date": "The date the latest dividend is scheduled to be paid.",
  "Dividend Frequency": "How often the company typically pays dividends.",
  "Latest 10-K Date": "The filing date of the company's latest annual 10-K report.",
  "Latest 10-K URL": "A link to the company's latest annual 10-K filing.",
  "Latest 10-Q Date": "The filing date of the company's latest quarterly 10-Q report.",
  "Latest 10-Q URL": "A link to the company's latest quarterly 10-Q filing.",
  "Last Updated": "The last time this stock's data was updated in Bullionaire.",
};
const typeTooltips = {
  CS: "Common Stock",
  ADRC: "American Depositary Receipt",
  ETF: "Exchange-Traded Fund",
  ETN: "Exchange-Traded Note",
  ETS: "Exchange-Traded Security",
  ETV: "Exchange-Traded Vehicle",
  FUND: "Fund",
  PFD: "Preferred Stock",
  RIGHT: "Stock Purchase Right",
  SP: "Structured Product",
  UNIT: "Unit",
  WARRANT: "Warrant",
};
const StockTable = ({
  view,
  selectedSector,
  showControls = true,
  showTable = true,
}) => {
  const [stocks, setStocks] = useState([]);
  const [processedStocks, setProcessedStocks] = useState([]);

  const [typedQuery, setTypedQuery] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const [selectedType, setSelectedType] = useState("");
  const [securityTypes, setSecurityTypes] = useState([]);

  const [displayedCount, setDisplayedCount] = useState(0);
  const [starModalOpen, setStarModalOpen] = useState(false);
  const [modalTicker, setModalTicker] = useState(null);
  const [modalSelectedLists, setModalSelectedLists] = useState([]);
  const [notification, setNotification] = useState(null);
  const [loading, setLoading] = useState(true);

  const [pageSize] = useState(50);
const [currentPage, setCurrentPage] = useState(1);
const currentPageRef = useRef(1);
const [totalPages, setTotalPages] = useState(1);
const [backendFilterModel, setBackendFilterModel] = useState({});
const [gridFilterModel, setGridFilterModel] = useState({});
const [isBackgroundLoading, setIsBackgroundLoading] = useState(false);
const [pageCache, setPageCache] = useState({});
const activeRequestRef = useRef(0);
const stocksAbortRef = useRef(null);
const isRestoringFilterModelRef = useRef(false);
const [viewMode, setViewMode] = useState("all data");
const [isMobileTableViewport, setIsMobileTableViewport] = useState(() =>
  typeof window !== "undefined"
    ? window.matchMedia("(max-width: 768px)").matches
    : false
);

useEffect(() => {
  if (typeof window === "undefined") return undefined;

  const mediaQuery = window.matchMedia("(max-width: 768px)");

  const syncMobileViewport = (event) => {
    setIsMobileTableViewport(event.matches);
  };

  setIsMobileTableViewport(mediaQuery.matches);
  mediaQuery.addEventListener("change", syncMobileViewport);

  return () => {
    mediaQuery.removeEventListener("change", syncMobileViewport);
  };
}, []);
const [initialSparklineCache] = useState(() => loadPersistentSparklineCache());
const sparklineCacheRef = useRef(initialSparklineCache);
const sparklineInFlightRef = useRef(new Set());
const sparklineDebounceRef = useRef(null);
const sparklineBackgroundTimerRef = useRef(null);
const sparklineBackgroundLoadStartedRef = useRef(false);
const loadingWatchlistsRef = useRef(false);
const livePriceCacheRef = useRef({});
const LIVE_PRICE_CACHE_MS = 2 * 60 * 1000;
const PRELOADED_DASHBOARD_CACHE_MS = 2 * 60 * 1000;

const [chartModalOpen, setChartModalOpen] = useState(false);
const [chartTicker, setChartTicker] = useState(null);
const [chartStockContext, setChartStockContext] = useState(null);

  const [watchlists, setWatchlists] = useState({});
const [watchlistAllocations, setWatchlistAllocations] = useState({});

const [activeList, setActiveList] = useState("Default");

  const gridRef = useRef(null);
const savedHorizontalScrollRef = useRef(0);
const savedTopScrollRef = useRef(0);

const [allocationFloatingStyle, setAllocationFloatingStyle] = useState({
  left: 0,
  width: 135,
});

  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);

  const tickerFilter = params.get("ticker");
  const tickersParam = params.get("tickers");
  const sectorFromUrl = params.get("sector");
  const selectedTickers = tickersParam ? tickersParam.split(",") : null;

  const API_BASE =
  process.env.NODE_ENV === "development"
    ? "http://localhost:8000"
    : process.env.REACT_APP_API_BASE;

  useEffect(() => {
  const fetchSecurityTypes = async () => {
    try {
      const res = await fetch(`${API_BASE}/security-types`);
      const data = await res.json();

      if (Array.isArray(data)) {
        setSecurityTypes(data);
      } else {
        setSecurityTypes([]);
      }
    } catch (err) {
      console.error("Failed to load security types", err);
      setSecurityTypes([]);
    }
  };

  fetchSecurityTypes();
}, [API_BASE]);

  const parseLargeNumber = (val) => {
  if (val == null || val === "") return null;
  if (typeof val === "number") return val;

  const str = val.toString().replace(/,/g, "").toUpperCase().trim();

  if (str.endsWith("T")) return parseFloat(str) * 1e12;
  if (str.endsWith("B")) return parseFloat(str) * 1e9;
  if (str.endsWith("M")) return parseFloat(str) * 1e6;
  if (str.endsWith("K")) return parseFloat(str) * 1e3;

  const parsed = parseFloat(str);
  return Number.isNaN(parsed) ? null : parsed;
};

const formatLargeNumber = (val) => {
  if (val == null || val === "") return "";
  if (typeof val !== "number") return val;

  const absVal = Math.abs(val);

  if (absVal >= 1_000_000_000_000) return (val / 1_000_000_000_000).toFixed(2) + "T";
  if (absVal >= 1_000_000_000) return (val / 1_000_000_000).toFixed(2) + "B";
  if (absVal >= 1_000_000) return (val / 1_000_000).toFixed(2) + "M";
  if (absVal >= 1_000) return (val / 1_000).toFixed(2) + "K";

  return val.toFixed(2);
};

const normalizeDividendYield = (val) => {
  if (val == null || val === "") return null;

  const num = typeof val === "number" ? val : parseFloat(val);
  if (Number.isNaN(num)) return null;

  return num > 10 ? num / 100 : num;
};
const renderSparklineSvg = (points = [], changePct = null) => {
  if (!points.length) return null;

  const width = 110;
  const height = 28;
  const padding = 2;

  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;

  const first = points[0];

  const path = points
    .map((point, index) => {
      const x =
        padding +
        (index / Math.max(points.length - 1, 1)) * (width - padding * 2);
      const y =
        height -
        padding -
        ((point - min) / range) * (height - padding * 2);
      return `${index === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");

  const baselineY =
    height -
    padding -
    ((first - min) / range) * (height - padding * 2);

  const stroke =
    changePct != null && changePct < 0 ? "#dc2626" : "#19C37D";

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <line
        x1={0}
        y1={baselineY}
        x2={width}
        y2={baselineY}
        stroke="#888"
        strokeWidth="1"
        strokeDasharray="3 3"
        opacity="0.5"
      />
      <path
        d={path}
        fill="none"
        stroke={stroke}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

const renderSparklinePlaceholder = () => {
  const width = 110;
  const height = 28;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <line
        x1="6"
        y1="20"
        x2="104"
        y2="8"
        stroke="#19C37D"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.55"
      />
    </svg>
  );
};

const rowData = useMemo(() => {
  if (!processedStocks.length) return [];

  if (view === "Watchlist") {
    return processedStocks.filter((s) =>
      (watchlists[activeList] ?? []).includes(s.Ticker)
    );
  }

  return processedStocks;
}, [processedStocks, watchlists, view, activeList]);

const activeWatchlistTickers = useMemo(() => {
  return watchlists[activeList] ?? [];
}, [watchlists, activeList]);

const watchlistAnalyticsWatchlists = useMemo(() => {
  return { [activeList]: activeWatchlistTickers };
}, [activeList, activeWatchlistTickers]);

const allocationStorageKey = useMemo(() => {
  return `bullionaire_watchlist_allocations_${activeList || "Default"}`;
}, [activeList]);

useEffect(() => {
  if (view !== "Watchlist") return;

  try {
    const saved = localStorage.getItem(allocationStorageKey);
    setWatchlistAllocations(saved ? JSON.parse(saved) : {});
  } catch (err) {
    console.error("Failed to load watchlist allocations", err);
    setWatchlistAllocations({});
  }
}, [allocationStorageKey, view]);

useEffect(() => {
  if (view !== "Watchlist") return;

  try {
    localStorage.setItem(
      allocationStorageKey,
      JSON.stringify(watchlistAllocations)
    );
  } catch (err) {
    console.error("Failed to save watchlist allocations", err);
  }
}, [allocationStorageKey, watchlistAllocations, view]);

const getEqualWeightAllocation = useCallback(() => {
  const tickers = watchlists[activeList] ?? [];
  if (!tickers.length) return 0;
  return Number((100 / tickers.length).toFixed(2));
}, [watchlists, activeList]);

const getAllocationForTicker = useCallback(
  (ticker) => {
    const rawValue = watchlistAllocations[ticker];

    if (rawValue === "" || rawValue == null) {
      return getEqualWeightAllocation();
    }

    const num = Number(rawValue);
    return Number.isNaN(num) ? getEqualWeightAllocation() : num;
  },
  [watchlistAllocations, getEqualWeightAllocation]
);

const saveAllocationForTicker = useCallback((ticker, value) => {
  const cleaned = String(value || "").replace(/[^\d.]/g, "");
  const numericValue = Number(cleaned);

  if (!ticker) return;

  setWatchlistAllocations((prev) => ({
    ...prev,
    [ticker]: Number.isNaN(numericValue) ? "" : cleaned,
  }));
}, []);

const resetAllocationsToEqual = useCallback(() => {
  const tickers = watchlists[activeList] ?? [];
  if (!tickers.length) return;

  const equalWeight = Number((100 / tickers.length).toFixed(2));
  const updated = {};

  tickers.forEach((ticker, index) => {
    if (index === tickers.length - 1) {
      const used = equalWeight * (tickers.length - 1);
      updated[ticker] = Number((100 - used).toFixed(2)).toString();
    } else {
      updated[ticker] = equalWeight.toString();
    }
  });

  setWatchlistAllocations(updated);

  setTimeout(() => {
    if (gridRef.current?.api) {
      gridRef.current.api.refreshCells({ force: true });
    }
  }, 0);
}, [watchlists, activeList]);

const allocationTotal = useMemo(() => {
  if (view !== "Watchlist") return 0;

  const tickers = watchlists[activeList] ?? [];

  return tickers.reduce((sum, ticker) => {
    return sum + getAllocationForTicker(ticker);
  }, 0);
}, [view, watchlists, activeList, getAllocationForTicker]);

const allocationTotalIsValid = Math.abs(allocationTotal - 100) < 0.05;

const updateAllocationFloatingPosition = useCallback(() => {
  if (view !== "Watchlist") return;

  const api = gridRef.current?.api;
  if (!api) return;

  const allocationColumn = api.getColumn("Allocation %");
  if (!allocationColumn) return;

  const left = allocationColumn.getLeft();
  const width = allocationColumn.getActualWidth();

  setAllocationFloatingStyle({
    left,
    width,
  });
}, [view]);

const getVisibleSparklineTickers = useCallback(() => {
  if (!rowData.length) return [];

  // Watchlist gets immediate priority
  if (view === "Watchlist") {
    return rowData
      .map((row) => row.Ticker)
      .filter(Boolean);
  }

  const cachedTickerCount = Object.keys(sparklineCacheRef.current).length;

  // First paint: only load the first 15 rows instantly
  if (cachedTickerCount === 0) {
    return rowData
      .slice(0, 15)
      .map((row) => row.Ticker)
      .filter(Boolean);
  }

  if (!gridRef.current?.api) {
    return rowData
      .slice(0, 25)
      .map((row) => row.Ticker)
      .filter(Boolean);
  }

  const renderedNodes = gridRef.current.api.getRenderedNodes();
  if (!renderedNodes || !renderedNodes.length) {
    return rowData
      .slice(0, 25)
      .map((row) => row.Ticker)
      .filter(Boolean);
  }

  const indexes = renderedNodes
    .map((node) => node.rowIndex)
    .filter((index) => typeof index === "number")
    .sort((a, b) => a - b);

  if (!indexes.length) {
    return rowData
      .slice(0, 25)
      .map((row) => row.Ticker)
      .filter(Boolean);
  }

  const firstVisible = Math.max(0, indexes[0]);
  const lastVisible = Math.min(rowData.length - 1, indexes[indexes.length - 1]);

  const preloadBelow = 12;
  const preloadAbove = 2;

  const start = Math.max(0, firstVisible - preloadAbove);
  const end = Math.min(rowData.length - 1, lastVisible + preloadBelow);

  return rowData
    .slice(start, end + 1)
    .map((row) => row.Ticker)
    .filter(Boolean);
}, [rowData, view]);

const refreshSparklineCells = useCallback((tickers = []) => {
  if (!gridRef.current?.api || !tickers.length) return;

  const rowNodes = tickers
    .map((ticker) => gridRef.current.api.getRowNode(String(ticker)))
    .filter(Boolean);

  if (!rowNodes.length) return;

  gridRef.current.api.refreshCells({
    rowNodes,
    columns: ["Today"],
    force: true,
  });
}, []);

const loadVisibleSparklines = useCallback(async () => {
  if (!showTable) return;
  if (!rowData.length) return;

  const targetTickers = getVisibleSparklineTickers();
  if (!targetTickers.length) return;

  const now = Date.now();
  const cachedTickers = [];
  const tickersToFetch = [];

  targetTickers.forEach((ticker) => {
    const cached = sparklineCacheRef.current[ticker];
    const hasCachedGraph = Array.isArray(cached?.points) && cached.points.length > 0;

    if (hasCachedGraph) {
      cachedTickers.push(ticker);
    }

    const cacheAge = now - Number(cached?.cached_at || 0);
    const needsRefresh = !hasCachedGraph || cacheAge >= SPARKLINE_REFRESH_MS;

    if (needsRefresh && !sparklineInFlightRef.current.has(ticker)) {
      tickersToFetch.push(ticker);
    }
  });

  // Paint anything we already have immediately. This is what makes returning
  // to the dashboard feel instant instead of showing empty placeholders again.
  if (cachedTickers.length) {
    refreshSparklineCells(cachedTickers);
  }

  if (!tickersToFetch.length) return;

  tickersToFetch.forEach((ticker) => sparklineInFlightRef.current.add(ticker));

  try {
    const res = await fetch(
      `${API_BASE}/stocks/sparklines?tickers=${encodeURIComponent(
        tickersToFetch.join(",")
      )}`
    );

    const data = await res.json();
    const newRows = data?.rows || {};
    const cachedAt = Date.now();

    Object.entries(newRows).forEach(([ticker, value]) => {
      if (!Array.isArray(value?.points) || !value.points.length) return;

      sparklineCacheRef.current[ticker] = {
        ...value,
        cached_at: cachedAt,
      };
    });

    persistSparklineCache(sparklineCacheRef.current);
    refreshSparklineCells(Object.keys(newRows));
  } catch (err) {
    console.error("Failed to load visible sparklines", err);
  } finally {
    tickersToFetch.forEach((ticker) => sparklineInFlightRef.current.delete(ticker));
  }
}, [
  API_BASE,
  getVisibleSparklineTickers,
  refreshSparklineCells,
  rowData,
  showTable,
]);

const loadRemainingSparklinesInBackground = useCallback(async () => {
  if (!rowData.length) return;
  if (sparklineBackgroundLoadStartedRef.current) return;

  sparklineBackgroundLoadStartedRef.current = true;

  const allTickers = rowData.map((row) => row.Ticker).filter(Boolean);
  const missingTickers = allTickers.filter((ticker) => {
    const cached = sparklineCacheRef.current[ticker];
    const hasCachedGraph = Array.isArray(cached?.points) && cached.points.length > 0;
    return !hasCachedGraph && !sparklineInFlightRef.current.has(ticker);
  });

  if (!missingTickers.length) return;

  const chunkSize = view === "Watchlist" ? 50 : 20;

  for (let i = 0; i < missingTickers.length; i += chunkSize) {
    const chunk = missingTickers.slice(i, i + chunkSize);
    chunk.forEach((ticker) => sparklineInFlightRef.current.add(ticker));

    try {
      await new Promise((resolve) => setTimeout(resolve, 60));

      const res = await fetch(
        `${API_BASE}/stocks/sparklines?tickers=${encodeURIComponent(
          chunk.join(",")
        )}`
      );

      const data = await res.json();
      const newRows = data?.rows || {};
      const cachedAt = Date.now();

      Object.entries(newRows).forEach(([ticker, value]) => {
        if (!Array.isArray(value?.points) || !value.points.length) return;

        sparklineCacheRef.current[ticker] = {
          ...value,
          cached_at: cachedAt,
        };
      });

      persistSparklineCache(sparklineCacheRef.current);
      refreshSparklineCells(Object.keys(newRows));
    } catch (err) {
      console.error("Failed background sparkline batch", err);
    } finally {
      chunk.forEach((ticker) => sparklineInFlightRef.current.delete(ticker));
    }
  }
}, [API_BASE, refreshSparklineCells, rowData, view]);

const scheduleVisibleSparklineLoad = useCallback(() => {
  if (sparklineDebounceRef.current) {
    clearTimeout(sparklineDebounceRef.current);
  }

  sparklineDebounceRef.current = setTimeout(async () => {
    await loadVisibleSparklines();
  }, 150);
}, [loadVisibleSparklines]);

  const getBackendParamNames = (col) => {
  switch (col) {
    case "Current Price":
      return { min: "min_price", max: "max_price" };
    case "Previous Close":
      return { min: "min_previous_close", max: "max_previous_close" };
    case "Day Open":
      return { min: "min_day_open", max: "max_day_open" };
    case "Day High":
      return { min: "min_day_high", max: "max_day_high" };
    case "Day Low":
      return { min: "min_day_low", max: "max_day_low" };
    case "Day Volume":
      return { min: "min_day_volume", max: "max_day_volume" };
    case "Today Change %":
      return { min: "min_today_change", max: "max_today_change" };
    case "Market Cap":
      return { min: "min_market_cap", max: "max_market_cap" };
    case "EPS (TTM)":
      return { min: "min_eps", max: "max_eps" };
    case "P/E (TTM)":
  return { min: "min_pe", max: "max_pe" };
case "PEG Ratio":
  return { min: "min_peg", max: "max_peg" };
case "P/S Ratio":
  return { min: "min_ps", max: "max_ps" };
case "Dividend Yield":
  return { min: "min_dividend", max: "max_dividend" };
    case "RSI":
      return { min: "min_rsi", max: "max_rsi" };
    case "MACD":
      return { min: "min_macd", max: "max_macd" };
    case "MACD Signal":
      return { min: "min_macd_signal", max: "max_macd_signal" };
    case "MACD Histogram":
      return { min: "min_macd_histogram", max: "max_macd_histogram" };
    case "SMA 20":
      return { min: "min_sma20", max: "max_sma20" };
    case "Beta":
  return { min: "min_beta", max: "max_beta" };
case "Standard Deviation (1Y)":
  return { min: "min_std_dev", max: "max_std_dev" };
case "EBITDA":
  return { min: "min_ebitda", max: "max_ebitda" };
    case "Short % of Float":
      return { min: "min_short_float", max: "max_short_float" };
    case "Gross Profit":
      return { min: "min_gross_profit", max: "max_gross_profit" };
    case "Analyst Upside":
      return { min: "min_upside", max: "max_upside" };
    case "Analyst Downside":
      return { min: "min_downside", max: "max_downside" };
    case "Mean Target":
      return { min: "min_mean_target", max: "max_mean_target" };
    case "Number of Analysts":
      return { min: "min_analysts", max: "max_analysts" };
    case "Latest Dividend Amount":
      return { min: "min_latest_dividend", max: "max_latest_dividend" };
    case "Dividend Frequency":
      return { min: "min_dividend_frequency", max: "max_dividend_frequency" };
    default:
      return null;
  }
};

  const buildBackendFilterParams = (filterModel) => {
    const queryParams = {};

    Object.entries(filterModel || {}).forEach(([col, model]) => {
  const names = getBackendParamNames(col);
  if (!names || !model) return;
  if (model.filterType !== "number") return;

  const normalizeFilterValue = (value) => {
    if (value == null || value === "") return value;
    if (col === "Dividend Yield") return normalizeDividendYield(value);
    return value;
  };

  if (model.type === "greaterThan" || model.type === "greaterThanOrEqual") {
    queryParams[names.min] = normalizeFilterValue(model.filter);
  } else if (model.type === "lessThan" || model.type === "lessThanOrEqual") {
    queryParams[names.max] = normalizeFilterValue(model.filter);
  } else if (model.type === "inRange") {
    if (model.filter != null) queryParams[names.min] = normalizeFilterValue(model.filter);
    if (model.filterTo != null) queryParams[names.max] = normalizeFilterValue(model.filterTo);
  } else if (model.type === "equals") {
    if (model.filter != null) {
      const normalized = normalizeFilterValue(model.filter);
      queryParams[names.min] = normalized;
      queryParams[names.max] = normalized;
    }
  }
});

    return queryParams;
  };
const buildBaseQueryParams = () => {
  const queryParams = new URLSearchParams();
  queryParams.set("page_size", pageSize.toString());

  if (searchQuery?.trim()) {
    queryParams.set("search", searchQuery.trim());
  }

  if (selectedSector) {
    queryParams.set("sector", selectedSector);
  }

  if (selectedType) {
  queryParams.set("security_type", selectedType);
  }

  if (selectedTickers?.length) {
    queryParams.set("tickers", selectedTickers.join(","));
  } else if (tickerFilter) {
    queryParams.set("tickers", tickerFilter.toUpperCase());
  }

  Object.entries(backendFilterModel).forEach(([key, value]) => {
    if (value != null && value !== "") {
      queryParams.set(key, value.toString());
    }
  });

  return queryParams;
};

const getPreloadedDashboardRows = () => {
  try {
    const raw = localStorage.getItem("bullionaire_preloaded_dashboard_rows");
    if (!raw) return null;

    const cached = JSON.parse(raw);

    if (!cached?.time || !cached?.data) return null;

    const isFresh = Date.now() - cached.time < PRELOADED_DASHBOARD_CACHE_MS;
    if (!isFresh) return null;

    const rows = Array.isArray(cached.data?.rows) ? cached.data.rows : [];

    if (!rows.length) return null;

    return {
      rows,
      total: typeof cached.data.total === "number" ? cached.data.total : rows.length,
      totalPages:
        typeof cached.data.total_pages === "number" ? cached.data.total_pages : 1,
    };
  } catch (err) {
    localStorage.removeItem("bullionaire_preloaded_dashboard_rows");
    return null;
  }
};

const saveScrollPosition = () => {
  const topScroll = document.querySelector(".top-scrollbar");
  const gridViewport = document.querySelector(".ag-body-horizontal-scroll-viewport");

  savedTopScrollRef.current = topScroll ? topScroll.scrollLeft : 0;
  savedHorizontalScrollRef.current = gridViewport ? gridViewport.scrollLeft : 0;
};
const restoreScrollPosition = () => {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const topScroll = document.querySelector(".top-scrollbar");
      const gridViewport = document.querySelector(".ag-body-horizontal-scroll-viewport");

      if (gridViewport) {
        gridViewport.scrollLeft = savedHorizontalScrollRef.current;
      }

      if (topScroll) {
        topScroll.scrollLeft = savedTopScrollRef.current;
      }
    });
  });
};

const setCurrentPageTracked = (page) => {
  currentPageRef.current = page;
  setCurrentPage(page);
};

const showRowsForPage = (rows, page) => {
  // A live-price snapshot for an older page may finish after the user has
  // already clicked Next/Previous. Never let that stale async result replace
  // the rows for the page currently on screen.
  if (view !== "Watchlist" && currentPageRef.current !== page) return false;

  // AG Grid can recreate its horizontal viewport when immutable row data is
  // refreshed. Capture both synchronized scrollbars immediately before the
  // update and restore them after layout so snapshots never jump back left.
  saveScrollPosition();
  setStocks(rows);
  restoreScrollPosition();
  return true;
};

const cancelStockRequest = () => {
  if (stocksAbortRef.current) {
    stocksAbortRef.current.abort();
    stocksAbortRef.current = null;
  }
};

const mergeLivePricesIntoRows = async (rows) => {
  if (!Array.isArray(rows) || rows.length === 0) return rows;

  const now = Date.now();

  const tickers = rows
    .map((row) => row.Ticker)
    .filter(Boolean)
    .slice(0, 100);

  if (!tickers.length) return rows;

  const cachedLiveRows = {};
  const missingTickers = [];

  tickers.forEach((ticker) => {
    const cached = livePriceCacheRef.current[ticker];

    if (cached && now - cached.timestamp < LIVE_PRICE_CACHE_MS) {
      cachedLiveRows[ticker] = cached.data;
    } else {
      missingTickers.push(ticker);
    }
  });

  let fetchedLiveRows = {};

  if (missingTickers.length) {
    try {
      const res = await fetch(
        `${API_BASE}/stocks/live-prices?tickers=${encodeURIComponent(
          missingTickers.join(",")
        )}`
      );

      const data = await res.json();
      fetchedLiveRows = data?.rows || {};

      Object.entries(fetchedLiveRows).forEach(([ticker, liveData]) => {
        livePriceCacheRef.current[ticker] = {
          data: liveData,
          timestamp: Date.now(),
        };
      });
    } catch (err) {
      console.error("Failed to load live prices", err);
    }
  }

  const liveRows = {
    ...cachedLiveRows,
    ...fetchedLiveRows,
  };

  return rows.map((row) => {
    const live = liveRows[row.Ticker];
    if (!live) return row;

    return {
      ...row,
      ...live,
    };
  });
};

const fetchStocks = async () => {
  cancelStockRequest();
  setLoading(true);
  saveScrollPosition();

  const controller = new AbortController();
  stocksAbortRef.current = controller;

  try {
if (view === "Watchlist") {
  const tickers = watchlists[activeList] ?? [];

  if (!tickers.length) {
    setStocks([]);
    setDisplayedCount(0);
    setTotalPages(1);
    setPageCache({});
    setIsBackgroundLoading(false);
    setLoading(false);
    return;
  }

  const params = new URLSearchParams();
  params.set("tickers", tickers.join(","));
  params.set("page", "1");
  params.set("page_size", String(Math.max(tickers.length, 100)));

  const res = await fetch(`${API_BASE}/stocks?${params.toString()}`, {
    signal: controller.signal,
  });
  const data = await res.json();

  const rows = Array.isArray(data?.rows) ? data.rows : [];

setStocks(rows);
setDisplayedCount(rows.length);
setLoading(false);

mergeLivePricesIntoRows(rows).then((rowsWithLivePrices) => {
  saveScrollPosition();
  setStocks(rowsWithLivePrices);
  restoreScrollPosition();
});
  setTotalPages(1);
  setPageCache({});
  setIsBackgroundLoading(false);
  setLoading(false);
  return;
}

    const requestId = Date.now();
    activeRequestRef.current = requestId;

    setIsBackgroundLoading(false);

    const baseParams = buildBaseQueryParams();

    const isDefaultDashboardRequest =
      view !== "Watchlist" &&
      !searchQuery?.trim() &&
      !selectedSector &&
      !selectedType &&
      !selectedTickers?.length &&
      !tickerFilter &&
      !tickersParam &&
      Object.keys(backendFilterModel || {}).length === 0;

    if (isDefaultDashboardRequest) {
      const preloaded = getPreloadedDashboardRows();

      if (preloaded?.rows?.length) {
        const initialCache = { 1: preloaded.rows };

        setPageCache(initialCache);
        setStocks(preloaded.rows);
        restoreScrollPosition();
        setDisplayedCount(preloaded.total);
        setTotalPages(preloaded.totalPages);
        setCurrentPageTracked(1);
        setLoading(false);

        mergeLivePricesIntoRows(preloaded.rows).then((rowsWithLivePrices) => {
          setPageCache((prev) => ({ ...prev, 1: rowsWithLivePrices }));
          showRowsForPage(rowsWithLivePrices, 1);
          localStorage.setItem("stocks", JSON.stringify(rowsWithLivePrices));
        });
      }
    }

    // Load page 1 immediately
    const firstParams = new URLSearchParams(baseParams);
    firstParams.set("page", "1");

    const firstRes = await fetch(`${API_BASE}/stocks?${firstParams.toString()}`, {
      signal: controller.signal,
    });
    const firstData = await firstRes.json();

    if (activeRequestRef.current !== requestId) return;

    const firstRows = Array.isArray(firstData?.rows) ? firstData.rows : [];
    const total = typeof firstData?.total === "number" ? firstData.total : 0;
    const pages = typeof firstData?.total_pages === "number" ? firstData.total_pages : 1;

    const initialCache = { 1: firstRows };

setPageCache(initialCache);
showRowsForPage(firstRows, 1);
setDisplayedCount(total);
setTotalPages(pages);
setCurrentPageTracked(1);
localStorage.setItem("stocks", JSON.stringify(firstRows));
setLoading(false);

mergeLivePricesIntoRows(firstRows).then((rowsWithLivePrices) => {
  setPageCache((prev) => ({ ...prev, 1: rowsWithLivePrices }));
  showRowsForPage(rowsWithLivePrices, 1);
  localStorage.setItem("stocks", JSON.stringify(rowsWithLivePrices));
});

    setIsBackgroundLoading(false);

   } catch (err) {
    if (err.name !== "AbortError") {
      console.error(err);
      setStocks([]);
      setPageCache({});
      setIsBackgroundLoading(false);
      setLoading(false);
    }
  }
};

const changePage = async (nextPage) => {
  if (nextPage < 1 || nextPage > totalPages) return;

  setCurrentPageTracked(nextPage);

  if (pageCache[nextPage]) {
  showRowsForPage(pageCache[nextPage], nextPage);
  return;
}

  try {
    setLoading(true);

    const params = buildBaseQueryParams();
    params.set("page", nextPage.toString());

    const res = await fetch(`${API_BASE}/stocks?${params.toString()}`);
    const data = await res.json();

    const rows = Array.isArray(data?.rows) ? data.rows : [];

setPageCache((prev) => ({ ...prev, [nextPage]: rows }));
showRowsForPage(rows, nextPage);
setLoading(false);

mergeLivePricesIntoRows(rows).then((rowsWithLivePrices) => {
  setPageCache((prev) => ({ ...prev, [nextPage]: rowsWithLivePrices }));
  showRowsForPage(rowsWithLivePrices, nextPage);
});
  } catch (err) {
    console.error(`Failed to load page ${nextPage}`, err);
  } finally {
    setLoading(false);
  }
};

  useEffect(() => {
  if (!showTable) return;

  if (view === "Watchlist") {
    fetchStocks();
    return;
  }

  fetchStocks();
}, [
  showTable,
  view,
  pageSize,
  searchQuery,
  selectedSector,
  selectedType,
  tickerFilter,
  tickersParam,
  backendFilterModel,
  activeList,
  watchlists
]);

useEffect(() => {
  setCurrentPageTracked(1);
}, [searchQuery, selectedSector, selectedType, tickerFilter, tickersParam, backendFilterModel, view]);

 useEffect(() => {
  // Watchlist search already uses AG Grid's local quick-filter immediately, so
  // do not trigger an unnecessary backend reload for that view.
  if (view === "Watchlist") return undefined;

  const nextQuery = typedQuery.trim();
  const delay = nextQuery ? 400 : 0;

  const handler = setTimeout(() => {
    setSearchQuery((current) => (current === nextQuery ? current : nextQuery));
  }, delay);

  return () => clearTimeout(handler);
}, [typedQuery, view]);

  useEffect(() => {
    let topScroll = null;
    let gridViewport = null;
    let gridBodyViewport = null;
    let syncTop = null;
    let syncBottom = null;
    let mobileGridScrollListener = null;
    let removeMobileDragListeners = null;

    const clampGridScrollLeft = (value) => {
      if (!gridViewport) return 0;
      const maxGrid = Math.max(
        0,
        gridViewport.scrollWidth - gridViewport.clientWidth
      );
      return Math.max(0, Math.min(maxGrid, value));
    };

    const setupScrollSync = () => {
      topScroll = document.querySelector(".top-scrollbar");
      const topContent = document.querySelector(".top-scroll-content");
      gridViewport = document.querySelector(
        ".ag-body-horizontal-scroll-viewport"
      );
      const gridCenter = document.querySelector(".ag-center-cols-container");

      if (!topScroll || !topContent || !gridViewport || !gridCenter) return;

      topContent.style.width = gridCenter.scrollWidth + "px";

      const isMobile = isMobileTableViewport;

      /*
       * DESKTOP ONLY:
       * Preserve the existing two-way synchronization between Bullionaire's
       * custom top scrollbar and AG Grid's horizontal scrollbar exactly as-is.
       */
      if (!isMobile) {
        syncTop = () => {
          const maxTop = topScroll.scrollWidth - topScroll.clientWidth;
          const maxGrid = gridViewport.scrollWidth - gridViewport.clientWidth;
          const ratio = maxTop > 0 ? topScroll.scrollLeft / maxTop : 0;
          gridViewport.scrollLeft = ratio * maxGrid;
        };

        syncBottom = () => {
          const maxTop = topScroll.scrollWidth - topScroll.clientWidth;
          const maxGrid = gridViewport.scrollWidth - gridViewport.clientWidth;
          const ratio = maxGrid > 0 ? gridViewport.scrollLeft / maxGrid : 0;
          topScroll.scrollLeft = ratio * maxTop;
        };

        topScroll.addEventListener("scroll", syncTop);
        gridViewport.addEventListener("scroll", syncBottom);
        return;
      }

      /*
       * MOBILE ONLY:
       *
       * Use exactly one horizontal scroll authority: AG Grid's own horizontal
       * viewport. Do NOT attach the desktop top<->bottom synchronization on
       * mobile. That synchronization can fire another scroll event after the
       * user's touch has ended and write a slightly different scrollLeft back
       * into the grid, producing the visible drift toward the left.
       *
       * Also keep the saved scroll position updated on every actual grid scroll
       * so an async row/live-price refresh cannot restore an older position.
       */
      mobileGridScrollListener = () => {
        savedHorizontalScrollRef.current = gridViewport.scrollLeft;
        savedTopScrollRef.current = gridViewport.scrollLeft;
      };

      gridViewport.addEventListener("scroll", mobileGridScrollListener, {
        passive: true,
      });

      gridBodyViewport = document.querySelector(
        ".stock-table-container .ag-body-viewport"
      );

      if (!gridBodyViewport) return;

      const previousTouchAction = gridBodyViewport.style.touchAction;
      gridBodyViewport.style.touchAction = "pan-y";

      let touchActive = false;
      let startX = 0;
      let startY = 0;
      let startScrollLeft = 0;
      let axis = null;
      let didDrag = false;
      let suppressClickUntil = 0;

      const resetTouch = () => {
        touchActive = false;
        axis = null;
        didDrag = false;
      };

      const onTouchStart = (event) => {
        if (event.touches.length !== 1) return;

        const target = event.target;
        const interactiveTarget =
          target && typeof target.closest === "function"
            ? target.closest(
                "button, input, select, textarea, a, [role='button']"
              )
            : null;

        if (interactiveTarget) return;

        const touch = event.touches[0];

        touchActive = true;
        startX = touch.clientX;
        startY = touch.clientY;
        startScrollLeft = gridViewport.scrollLeft;
        axis = null;
        didDrag = false;

        // Keep restoration logic anchored to the position the gesture began at.
        savedHorizontalScrollRef.current = startScrollLeft;
      };

      const onTouchMove = (event) => {
        if (!touchActive || event.touches.length !== 1) return;

        const touch = event.touches[0];
        const dx = touch.clientX - startX;
        const dy = touch.clientY - startY;
        const absX = Math.abs(dx);
        const absY = Math.abs(dy);

        if (!axis && (absX > 4 || absY > 4)) {
          // Preserve normal vertical page scrolling unless the gesture is
          // clearly horizontal.
          if (absX > absY * 1.08) {
            axis = "x";
          } else if (absY > absX * 1.08) {
            axis = "y";
          } else {
            return;
          }
        }

        if (axis !== "x") return;

        if (event.cancelable) {
          event.preventDefault();
        }

        didDrag = true;

        const nextScrollLeft = clampGridScrollLeft(startScrollLeft - dx);

        // This is the only mobile code that changes horizontal position while
        // the finger is moving. There is intentionally no momentum/inertia
        // animation after touchend.
        gridViewport.scrollLeft = nextScrollLeft;
        savedHorizontalScrollRef.current = nextScrollLeft;
      };

      const finishTouch = () => {
        if (!touchActive) return;

        if (axis === "x" && didDrag) {
          suppressClickUntil = Date.now() + 300;
          savedHorizontalScrollRef.current = gridViewport.scrollLeft;
        }

        resetTouch();
      };

      const onTouchEnd = () => finishTouch();
      const onTouchCancel = () => finishTouch();

      const onClickCapture = (event) => {
        if (Date.now() < suppressClickUntil) {
          event.preventDefault();
          event.stopPropagation();
        }
      };

      gridBodyViewport.addEventListener("touchstart", onTouchStart, {
        passive: true,
      });
      gridBodyViewport.addEventListener("touchmove", onTouchMove, {
        passive: false,
      });
      gridBodyViewport.addEventListener("touchend", onTouchEnd, {
        passive: true,
      });
      gridBodyViewport.addEventListener("touchcancel", onTouchCancel, {
        passive: true,
      });
      gridBodyViewport.addEventListener("click", onClickCapture, true);

      removeMobileDragListeners = () => {
        gridBodyViewport.removeEventListener("touchstart", onTouchStart);
        gridBodyViewport.removeEventListener("touchmove", onTouchMove);
        gridBodyViewport.removeEventListener("touchend", onTouchEnd);
        gridBodyViewport.removeEventListener("touchcancel", onTouchCancel);
        gridBodyViewport.removeEventListener("click", onClickCapture, true);
        gridBodyViewport.style.touchAction = previousTouchAction;
      };
    };

    const timer = setTimeout(setupScrollSync, 200);

    return () => {
      clearTimeout(timer);

      if (removeMobileDragListeners) {
        removeMobileDragListeners();
      }

      if (topScroll && syncTop) {
        topScroll.removeEventListener("scroll", syncTop);
      }

      if (gridViewport && syncBottom) {
        gridViewport.removeEventListener("scroll", syncBottom);
      }

      if (gridViewport && mobileGridScrollListener) {
        gridViewport.removeEventListener("scroll", mobileGridScrollListener);
      }
    };
  }, [processedStocks, isMobileTableViewport]);

  useEffect(() => {
  const data = stocks
    .map((s) => ({
      ...s,
      Ticker: s.Ticker?.toString() ?? "",
    }))
    .filter((s) => s.Ticker);

  setProcessedStocks(data);
}, [stocks]);

  const openStarModal = (ticker) => {
    setModalTicker(ticker);

    const selected = Object.keys(watchlists).filter((listName) =>
      watchlists[listName]?.includes(ticker)
    );

    setModalSelectedLists(selected);
    setStarModalOpen(true);
  };

  const exportToCsv = () => {
    if (!gridRef.current?.api) return;

    const now = new Date();

    const readableTimestamp = now.toLocaleString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });

    const safeTimestamp = now
      .toLocaleString("en-US", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
      .replace(/[/:, ]/g, "-");

    const fileName =
      view === "Watchlist"
        ? `my_watchlist_${safeTimestamp}.csv`
        : `market_analytics_${safeTimestamp}.csv`;

    gridRef.current.api.exportDataAsCsv({
      fileName,
      prependContent: [
        [{ data: { value: "Bullionaire Analytics Export" } }],
        [{ data: { value: `Generated: ${readableTimestamp}` } }],
        [],
      ],
    });
  };

  const clearAllFilters = () => {
  if (gridRef.current?.api) {
    gridRef.current.api.setFilterModel(null);
    gridRef.current.api.onFilterChanged();
  }

  setTypedQuery("");
  setSearchQuery("");
  setBackendFilterModel({});
  setGridFilterModel({});
  setSelectedType("");
};

const fundamentalsColumns = [
  "Current Price",
  "Market Cap",
  "EPS (TTM)",
  "P/E (TTM)",
  "PEG Ratio",
  "P/S Ratio",
  "EBITDA",
  "Gross Profit",
  "Dividend Yield",
  "Number of Analysts",
  "Mean Target",
  "Analyst Upside",
  "Analyst Downside",
  "Beta",
  "Standard Deviation (1Y)"
];

const technicalsColumns = [
  "Current Price",
  "Previous Close",
  "Day Open",
  "Day High",
  "Day Low",
  "Day Volume",
  "Today Change %",
  "RSI",
  "MACD",
  "MACD Signal",
  "MACD Histogram",
  "SMA 20",
  "Beta",
  "Standard Deviation (1Y)",
];

  const columns = useMemo(() => {
    const cols = [
      {
        headerName: "Save",
        colId: "star",
        field: "star",
        width: 60,
        pinned: isMobileTableViewport ? null : "left",
        sortable: false,
        filter: false,
        cellStyle: { textAlign: "center", fontSize: "18px" },
        cellClass: "column-border",
        headerClass: "column-border",
        cellRenderer: (params) => {
          const ticker = params.data?.Ticker;
          if (!ticker) return "☆";

          const inAnyWatchlist = Object.values(watchlists).some((list) =>
            list.includes(ticker)
          );

          return (
            <span
              style={{ cursor: "pointer" }}
              onClick={async () => {
                const isInActiveList = watchlists[activeList]?.includes(ticker);

                if (view === "Watchlist" && isInActiveList) {
  const updated = { ...watchlists };
  updated[activeList] = updated[activeList].filter((t) => t !== ticker);
  setWatchlists(updated);

  await saveWatchlists(updated);

  setNotification(`${ticker} removed from watchlist`);
  setTimeout(() => setNotification(null), 1500);
  return;
}

                openStarModal(ticker);
              }}
            >
              {inAnyWatchlist ? "★" : "☆"}
            </span>
          );
        },
      },
      {
  field: "Ticker",
  headerName: "Ticker",
  width: 110,
  pinned: "left",
  sortable: true,
  filter: view === "Watchlist" ? "agTextColumnFilter" : false,

  tooltipValueGetter: (params) => {
    const name = params.data?.["Company Name"] || "";
    const description = params.data?.["Description"] || "";

    if (name && description) return `${name}\n\n${description}`;
    if (name) return name;
    if (description) return description;
    return "";
  },

  filterParams: {
    buttons: ["reset"],
    debounceMs: 200,
    suppressAndOrCondition: true,
  },

  cellRenderer: (params) => {
    const ticker = params.value || params.data?.Ticker;
    if (!ticker) return "";

    return (
      <button
        type="button"
        className="ticker-link-button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          navigate(`/stocks/${String(ticker).toUpperCase()}`, { state: { stock: params?.data || null } });
        }}
      >
        {ticker}
      </button>
    );
  },

  cellClass: "column-border",
  headerClass: "column-border",
},
{
  field: "Today",
  headerName: "Today",
  width: 140,
  pinned: isMobileTableViewport ? null : "left",
  sortable: false,
  filter: false,
  suppressMenu: true,
  cellClass: "column-border",
  headerClass: "column-border",
  cellRenderer: (params) => {
    const ticker = params.data?.Ticker;
    const spark = sparklineCacheRef.current[ticker];

    if (!spark || !spark.points?.length) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
        opacity: 0.9,
      }}
    >
      {renderSparklinePlaceholder()}
    </div>
  );
}

    return (
  <div
  onClick={() => {
    setChartTicker(ticker);
setChartStockContext(params?.data || null);
setChartModalOpen(true);
  }}
  style={{
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
    cursor: "pointer",
  }}
  title={`${ticker} intraday`}
>
  {renderSparklineSvg(spark.points, spark.change_pct)}
</div>
);
  },
},
    ];
    if (view === "Watchlist") {
  cols.push({
    headerName: "Allocation %",
colId: "Allocation %",
field: "Allocation %",
width: 135,
pinned: isMobileTableViewport ? null : "left",
sortable: true,
filter: false,
suppressMenu: true,
headerClass: "column-border",
cellClass: "column-border numeric",
    valueGetter: (params) => {
      const ticker = params.data?.Ticker;
      if (!ticker) return null;
      return getAllocationForTicker(ticker);
    },
    cellRenderer: (params) => {
      const ticker = params.data?.Ticker;
      if (!ticker) return "";

      const currentValue = getAllocationForTicker(ticker);

      const commitValue = (rawValue) => {
        saveAllocationForTicker(ticker, rawValue);

        setTimeout(() => {
          if (gridRef.current?.api) {
            gridRef.current.api.refreshCells({
              columns: ["Allocation %"],
              force: false,
            });
          }
        }, 0);
      };

      return (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: "100%",
            gap: "4px",
          }}
        >
          <input
  defaultValue={currentValue.toFixed(2)}
  onBlur={(e) => commitValue(e.target.value)}
  onKeyDown={(e) => {
    e.stopPropagation();

    if (e.key === "Enter") {
      commitValue(e.currentTarget.value);
      e.currentTarget.blur();
    }
  }}
  onClick={(e) => e.stopPropagation()}
  style={{
    width: "62px",
    background: "transparent",
    border: "none",
    color: "inherit",
    borderRadius: "0px",
    padding: "4px 6px",
    textAlign: "right",
    fontSize: "12px",
    fontWeight: 700,
    outline: "none",
  }}
/>

          <span
            style={{
  color: "inherit",
  fontSize: "12px",
  fontWeight: 700,
}}
          >
            %
          </span>
        </div>
      );
    },
  });
}

    const orderedColumns = [
      "Current Price",
      "Type",
      "Previous Close",
      "Day Open",
      "Day High",
      "Day Low",
      "Day Volume",
      "Today Change %",
      "Market Cap",
"EPS (TTM)",
"P/E (TTM)",
"PEG Ratio",
"P/S Ratio",
"Beta",
"Standard Deviation (1Y)",
"EBITDA",
      "Short % of Float",
      "Gross Profit",
      "Dividend Yield",
      "Analyst Upside",
      "Analyst Downside",
      "Number of Analysts",
      "Mean Target",
      "RSI",
      "MACD",
      "MACD Signal",
      "MACD Histogram",
      "SMA 20",
      "Sector",
      "Latest Dividend Amount",
      "Latest Ex-Dividend Date",
      "Latest Pay Date",
      "Dividend Frequency",
      "Latest 10-K Date",
      "Latest 10-K URL",
      "Latest 10-Q Date",
      "Latest 10-Q URL",
      "Last Updated",
    ];

    orderedColumns
  .filter((col) => {
    if (viewMode === "fundamentals") {
      return fundamentalsColumns.includes(col) || col === "Type" || col === "Sector";
    }
    if (viewMode === "technicals") {
      return technicalsColumns.includes(col) || col === "Type" || col === "Sector";
    }
    return true; // "all"
  })
  .forEach((col) => {
      const columnDef = {
  headerName: col === "Standard Deviation (1Y)" ? "1Y Std Dev" : col,
  headerTooltip: metricTooltips[col],
  field: col,
  sortable: true,
  flex: 1,
  minWidth: 130,
  headerClass: "column-border",
  cellClass: "column-border",

  suppressHeaderFilterButton: false,
  suppressHeaderMenuButton: false,

  tooltipValueGetter:
    col === "Type"
      ? (params) => {
          const raw = (params.value || params.data?.["Type"] || "")
            .toString()
            .toUpperCase();

          return typeTooltips[raw] || raw;
        }
      : undefined,

  valueGetter: (params) => {
  if (["Market Cap", "Day Volume", "EBITDA", "Gross Profit"].includes(col)) {
    return parseLargeNumber(params.data[col]);
  }

  if (col === "Dividend Yield") {
    return normalizeDividendYield(params.data[col]);
  }

  return params.data[col];
},

        valueFormatter: (params) => {
          const val = params.value;

          if (val == null || val === "") return "";

          if (["Market Cap", "Day Volume", "EBITDA", "Gross Profit"].includes(col)) {
          return formatLargeNumber(val);
          }

          if (
            [
              "Current Price",
              "Previous Close",
              "Day Open",
              "Day High",
              "Day Low",
              "Latest Dividend Amount",
              "Mean Target",
            ].includes(col)
          ) {
            return typeof val === "number" ? val.toFixed(2) : val;
          }

          if (
  [
  "Today Change %",
  "Dividend Yield",
  "Short % of Float",
  "Analyst Upside",
  "Analyst Downside",
  "Standard Deviation (1Y)",
].includes(col)
) {
  return typeof val === "number" ? `${val.toFixed(2)}%` : val;
}

          if (
  [
    "EPS (TTM)",
    "P/E (TTM)",
    "PEG Ratio",
    "P/S Ratio",
    "RSI",
              "MACD",
              "MACD Signal",
              "MACD Histogram",
              "SMA 20",
              "Beta",
              "Standard Deviation (1Y)",
              "EBITDA",
              "Gross Profit",
            ].includes(col)
          ) {
            return typeof val === "number" ? val.toFixed(2) : val;
          }

          if (col === "Latest 10-K URL" || col === "Latest 10-Q URL") {
            return val ? "View Filing" : "";
          }

          return val;
        },
        cellRenderer:
          col === "Latest 10-K URL" || col === "Latest 10-Q URL"
            ? (params) => {
                const url = params.value;
                if (!url) return "";
                return (
                  <a
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: "#19C37D", textDecoration: "underline" }}
                  >
                    View Filing
                  </a>
                );
              }
            : undefined,
      };
      if (["Today Change %", "Analyst Upside", "Analyst Downside"].includes(col)) {
  columnDef.cellStyle = (params) => {
    const raw = params.value;
    const value =
      typeof raw === "number"
        ? raw
        : raw != null && raw !== ""
        ? parseFloat(raw)
        : null;

    if (value > 0) {
      return { color: "#16a34a", fontWeight: "600" };
    }

    if (value < 0) {
      return { color: "#dc2626", fontWeight: "600" };
    }

    return {};
  };
}

      if (col === "Current Price") {
        columnDef.width = 120;
        columnDef.cellStyle = { fontWeight: "bold" };
      }

      if (["Market Cap", "Day Volume", "EBITDA", "Gross Profit"].includes(col)) {
  columnDef.filter = "agNumberColumnFilter";
  columnDef.filterParams = {
    filterOptions: ["greaterThan", "lessThan", "inRange"],
    buttons: ["apply", "reset"],
    suppressAndOrCondition: true,
    allowedCharPattern: "\\d\\.KMBTkmbt",
    numberParser: (text) => {
      if (!text) return null;
      return parseLargeNumber(text);
    },
  };
  columnDef.cellClass = "numeric";
} else if (
        [
          "Current Price",
          "Previous Close",
          "Day Open",
          "Day High",
          "Day Low",
          "Day Volume",
          "Today Change %",
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
          "Short % of Float",
          "Gross Profit",
          "Analyst Upside",
          "Analyst Downside",
          "Number of Analysts",
          "Mean Target",
          "Latest Dividend Amount",
          "Dividend Frequency",
        ].includes(col)
      ) {
        columnDef.filter = "agNumberColumnFilter";
        columnDef.filterParams = {
          filterOptions: ["greaterThan", "lessThan", "inRange"],
          suppressAndOrCondition: true,
          buttons: ["apply", "reset"],
        };
        columnDef.cellClass = "numeric";
      } else {
  columnDef.filter = view === "Watchlist" ? "agTextColumnFilter" : false;

  if (view === "Watchlist") {
    columnDef.filterParams = {
      buttons: ["apply", "reset"],
      suppressAndOrCondition: true,
    };
  }
}

      cols.push(columnDef);
    });

    return cols;
  }, [
  watchlists,
  activeList,
  view,
  viewMode,
  isMobileTableViewport,
  watchlistAllocations,
  getAllocationForTicker,
  saveAllocationForTicker,
]);

useEffect(() => {
  if (view !== "Watchlist") return;

  const timer = setTimeout(() => {
    updateAllocationFloatingPosition();
  }, 150);

  return () => clearTimeout(timer);
}, [view, rowData, columns, updateAllocationFloatingPosition]);

  useEffect(() => {
    if (view === "Watchlist" && gridRef.current?.api) {
      setDisplayedCount(gridRef.current.api.getDisplayedRowCount());
    }
  }, [rowData, view]);

useEffect(() => {
  if (!showTable) return undefined;

  sparklineBackgroundLoadStartedRef.current = false;

  if (!rowData.length) return undefined;

  // Paint cached graphs first, refresh what is visible, then quietly fill the
  // rest of the current page so a later return to the dashboard is instant.
  scheduleVisibleSparklineLoad();

  sparklineBackgroundTimerRef.current = setTimeout(() => {
    loadRemainingSparklinesInBackground();
  }, 800);

  return () => {
    if (sparklineDebounceRef.current) {
      clearTimeout(sparklineDebounceRef.current);
    }
    if (sparklineBackgroundTimerRef.current) {
      clearTimeout(sparklineBackgroundTimerRef.current);
      sparklineBackgroundTimerRef.current = null;
    }
  };
}, [
  loadRemainingSparklinesInBackground,
  rowData,
  scheduleVisibleSparklineLoad,
  showTable,
]);


  useEffect(() => {
  if (view === "Watchlist") return;
  if (loading) return;
  if (!gridRef.current?.api) return;

  const currentModel = gridRef.current.api.getFilterModel() || {};
  const savedModel = gridFilterModel || {};

  if (JSON.stringify(currentModel) !== JSON.stringify(savedModel)) {
    isRestoringFilterModelRef.current = true;
    gridRef.current.api.setFilterModel(savedModel);
  }
}, [loading, gridFilterModel, view, processedStocks]);

useEffect(() => {
  const loadWatchlists = async () => {
    if (loadingWatchlistsRef.current) return;
    loadingWatchlistsRef.current = true;

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const user = session?.user;
if (!user) return;

      const { data, error } = await supabase
        .from("watchlists")
        .select("*")
        .eq("user_id", user.id);

      if (error) {
        console.error("Error loading watchlists:", error);
        return;
      }

      if (!data || data.length === 0) {
        setWatchlists({ Default: [] });
        return;
      }

      const formatted = {};
      data.forEach((wl) => {
        formatted[wl.name] = wl.tickers;
      });

      setWatchlists(formatted);
    } finally {
      loadingWatchlistsRef.current = false;
    }
  };

  loadWatchlists();
}, []);

    const defaultColDef = useMemo(
    () => ({
      /*
       * Desktop keeps its existing behavior.
       * Mobile headers are fixed: no resizing, no dragging/reordering,
       * no hiding through the UI, and no pin/unpin changes.
       */
      resizable: !isMobileTableViewport,
      sortable: true,
      minWidth: 100,
      suppressMovable: isMobileTableViewport,
      lockVisible: isMobileTableViewport,
      lockPinned: isMobileTableViewport,
    }),
    [isMobileTableViewport]
  );

  const shouldShowWatchlistEmptyLoading =
    view === "Watchlist" && loading && rowData.length === 0;
  const shouldShowFullLoadingOverlay =
    view !== "Watchlist" && loading && rowData.length === 0;
  const shouldShowSmallRefreshNotice = loading && rowData.length > 0;

  return (
    <div className="stock-table-container">
      <style>{`
        /*
         * Keep every scrollbar inside StockTable visually consistent.
         * This also catches AG Grid's pinned-left / spacer scroll areas,
         * which can otherwise fall back to the native white Windows scrollbar.
         */
        .stock-table-container,
        .stock-table-container * {
          scrollbar-color: #19c37d #111827;
          scrollbar-width: thin;
        }

        .stock-table-container *::-webkit-scrollbar {
          width: 9px;
          height: 8px;
          background: #111827;
        }

        .stock-table-container *::-webkit-scrollbar-track {
          background: #111827;
          border-radius: 10px;
        }

        .stock-table-container *::-webkit-scrollbar-thumb {
          background: #19c37d;
          border-radius: 10px;
          border: 1px solid #111827;
        }

        .stock-table-container *::-webkit-scrollbar-thumb:hover {
          background: #22c55e;
        }

        .stock-table-container *::-webkit-scrollbar-corner {
          background: #111827;
        }

        .stock-table-container *::-webkit-scrollbar-button {
          width: 0;
          height: 0;
          display: none;
        }
      `}</style>
      {showControls && (
        <>
          {notification && (
            <div className="notification-toast">
              {notification}
            </div>
          )}

          {view !== "Watchlist" && (
            <div className="dashboard-header">
              <h1 className="dashboard-title">BECOME A BULLIONAIRE</h1>
              <p className="dashboard-subtitle"></p>
            </div>
          )}

{selectedTickers ? (
  <div style={{ marginBottom: "10px" }}>
    <h2>{sectorFromUrl ? `${sectorFromUrl} Comparison` : "Sector Comparison"}</h2>

    <button
      onClick={() => navigate("/dashboard")}
      style={{
        marginTop: "6px",
        padding: "6px 12px",
        backgroundColor: "#19C37D",
        border: "none",
        borderRadius: "4px",
        cursor: "pointer",
        fontWeight: "bold"
      }}
    >
      Return to Full Market
    </button>
  </div>
) : (
  <h2>{view === "Watchlist" ? "Your Watchlist" : "Market Analytics"}</h2>
)}

          {view === "Watchlist" && (
            <div className="watchlist-top-row">
              <div className="watchlist-controls-left">
                <div className="watchlist-controls-row">
                  <select
                    value={activeList}
                    onChange={(e) => setActiveList(e.target.value)}
                    style={{ padding: "4px 8px" }}
                  >
                    {Object.keys(watchlists).map((listName) => (
                      <option key={listName} value={listName}>
                        {listName}
                      </option>
                    ))}
                  </select>

                  <button
                    style={{
                      padding: "4px 8px",
                      backgroundColor: "#19C37D",
                      color: "#fff",
                      border: "none",
                      cursor: "pointer"
                    }}
                    onClick={async () => {
                      const name = prompt("Enter new watchlist name:");
                      if (!name || watchlists[name]) return;
                      const updated = { ...watchlists, [name]: [] };
setWatchlists(updated);

await saveWatchlists(updated);
setActiveList(name);
                    }}
                  >
                    New
                  </button>

                  <button
                    style={{
                      padding: "4px 8px",
                      backgroundColor: "#3b82f6",
                      color: "#fff",
                      border: "none",
                      cursor: "pointer"
                    }}
                    onClick={async () => {
                      if (activeList === "Default") {
                        alert("Default watchlist cannot be renamed.");
                        return;
                      }
                      const newName = prompt("Enter new watchlist name:", activeList);
                      if (!newName || watchlists[newName]) {
                        alert("Invalid or duplicate watchlist name.");
                        return;
                      }
                      const updated = { ...watchlists };
updated[newName] = updated[activeList];
delete updated[activeList];
setWatchlists(updated);

await saveWatchlists(updated);
setActiveList(newName);
                    }}
                  >
                    Rename
                  </button>

                  <button
                    style={{
                      padding: "4px 8px",
                      backgroundColor: "#ff4d4f",
                      color: "#fff",
                      border: "none",
                      cursor: "pointer"
                    }}
                    onClick={async () => {
                      if (activeList === "Default") {
                        alert("Cannot delete the Default watchlist.");
                        return;
                      }
                      const confirmDelete = window.confirm(
                        `Are you sure you want to delete the "${activeList}" watchlist?`
                      );
                      if (!confirmDelete) return;
                      const updated = { ...watchlists };
delete updated[activeList];
setWatchlists(updated);

await saveWatchlists(updated);
setActiveList("Default");
                    }}
                  >
                    Delete
                  </button>

                  <button onClick={exportToCsv}>
                    Export Watchlist CSV
                  </button>
                </div>

                <div className="watchlist-search-row">
                  <input
                    type="text"
                    placeholder="Search company or ticker..."
                    value={typedQuery}
                    onChange={(e) => {
                      setTypedQuery(e.target.value);
                      if (gridRef.current?.api) {
                        gridRef.current.api.setGridOption("quickFilterText", e.target.value);
                      }
                    }}
                    className="search-input"
                  />
                  <button onClick={fetchStocks}>Refresh</button>
                  <button onClick={clearAllFilters}>Clear Filters</button>
                </div>
              </div>

              {showTable && (
                <div className="watchlist-analytics-side">
                  <WatchlistAnalytics
  activeList={activeList}
  watchlists={watchlistAnalyticsWatchlists}
  stocks={rowData}
  allocations={watchlistAllocations}
/>
                </div>
              )}
            </div>
          )}

          {view !== "Watchlist" && totalPages > 0 && (
  <div style={{ marginBottom: "10px", fontSize: "14px", color: "#ffffff" }}>
    {`Currently showing ${displayedCount} tickers • Page ${currentPage} of ${totalPages}`}
  </div>
)}

          {view !== "Watchlist" && (
  <div style={{ marginBottom: "15px", display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
    <input
      type="text"
      placeholder="Search company or ticker..."
      value={typedQuery}
      onChange={(e) => {
        cancelStockRequest();
        setTypedQuery(e.target.value);
      }}
      className="search-input"
    />

    <select
      className="search-input"
      value={selectedType}
      onChange={(e) => setSelectedType(e.target.value)}
    >
      <option value="">All Types</option>
      {securityTypes.map((type) => (
        <option key={type} value={type}>
          {type}
        </option>
      ))}
    </select>

    <div style={{ display: "flex", gap: "6px" }}>
  <button
    className="view-toggle-button"
    onClick={() => setViewMode("all data")}
    style={{
      padding: "6px 10px",
      borderRadius: "6px",
      border: "1px solid #d1d5db",
      cursor: "pointer",
      background: viewMode === "all data" ? "#19C37D" : "#ffffff",
      color: viewMode === "all data" ? "#ffffff" : "#000000"
    }}
  >
    All Data
  </button>

  <button
    className="view-toggle-button"
    onClick={() => setViewMode("fundamentals")}
    style={{
      padding: "6px 10px",
      borderRadius: "6px",
      border: "1px solid #d1d5db",
      cursor: "pointer",
      background: viewMode === "fundamentals" ? "#19C37D" : "#ffffff",
      color: viewMode === "fundamentals" ? "#ffffff" : "#000000"
    }}
  >
    Fundamentals
  </button>

  <button
    className="view-toggle-button"
    onClick={() => setViewMode("technicals")}
    style={{
      padding: "6px 10px",
      borderRadius: "6px",
      border: "1px solid #d1d5db",
      cursor: "pointer",
      background: viewMode === "technicals" ? "#19C37D" : "#ffffff",
      color: viewMode === "technicals" ? "#ffffff" : "#000000"
    }}
  >
    Technicals
  </button>
</div>

    <button onClick={fetchStocks}>Refresh</button>
    <button onClick={clearAllFilters}>Clear Filters</button>
  </div>
)}
        </>
      )}

      {showTable && (
  <div style={{ position: "relative", overflow: "visible" }}>
    {shouldShowFullLoadingOverlay && (
      <div
        className="loading-container"
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 20,
          background: "rgba(0, 0, 0, 0.45)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          transform: "translateY(-70px)"
        }}
      >
        <div className="spinner"></div>
        Loading stocks...
      </div>
    )}

    {shouldShowSmallRefreshNotice && (
      <div
        style={{
          position: "absolute",
          top: "10px",
          right: "14px",
          zIndex: 25,
          background: "rgba(15, 23, 42, 0.92)",
          color: "#cbd5e1",
          border: "1px solid rgba(255, 255, 255, 0.12)",
          borderRadius: "999px",
          padding: "6px 12px",
          fontSize: "12px",
          fontWeight: 700,
          display: "flex",
          alignItems: "center",
          gap: "8px",
        }}
      >
        <span
          style={{
            width: "8px",
            height: "8px",
            borderRadius: "999px",
            background: "#19C37D",
            display: "inline-block",
          }}
        />
        Refreshing data...
      </div>
    )}

    <div className="top-scrollbar">
      <div className="top-scroll-content"></div>
    </div>

    <div
      className={`ag-theme-alpine ${view === "Watchlist" ? "ag-watchlist" : ""}`}
      style={{
        width: "100%",
        height:
          view === "Watchlist"
            ? shouldShowWatchlistEmptyLoading
              ? "260px"
              : `${70 + Math.max(displayedCount || rowData.length, 1) * 30 + 18}px`
            : "700px",
        overflow: "visible",
      }}
    >
<AgGridReact
  ref={gridRef}
  suppressFieldDotNotation={true}
  /*
   * MOBILE ONLY:
   * Make the visible column layout completely fixed. Desktop remains movable.
   */
  suppressMovableColumns={isMobileTableViewport}
  suppressDragLeaveHidesColumns={isMobileTableViewport}
  headerHeight={70}
  rowData={rowData}
  columnDefs={columns}
  defaultColDef={defaultColDef}
  overlayNoRowsTemplate={`
    <div class="bullionaire-no-rows-overlay">
      <div class="bullionaire-no-rows-title">Let’s get rich</div>
      <div class="bullionaire-no-rows-subtitle">Loading market data...</div>
    </div>
  `}
  immutableData={true}
  getRowId={(params) => params.data.Ticker}
  suppressScrollOnNewData={true}
  rowBuffer={0}
  animateRows={true}
  rowSelection="multiple"
  suppressRowClickSelection={true}
  rowHeight={30}
  tooltipShowDelay={0}
  tooltipHideDelay={25000}
  onGridReady={(params) => {
  gridRef.current = params;

  if (view === "Watchlist") {
    setDisplayedCount(params.api.getDisplayedRowCount());

    setTimeout(() => {
      updateAllocationFloatingPosition();
    }, 0);
  } else {
    scheduleVisibleSparklineLoad();
  }
}}
        onFirstDataRendered={(params) => {
  if (view === "Watchlist") {
    setDisplayedCount(params.api.getDisplayedRowCount());
  } else {
    scheduleVisibleSparklineLoad();
  }
}}
        onFilterChanged={(params) => {
  if (isRestoringFilterModelRef.current) {
    isRestoringFilterModelRef.current = false;
    return;
  }

  saveScrollPosition();

  const model = params.api.getFilterModel();
  setGridFilterModel(model);

  if (view === "Watchlist") {
    setDisplayedCount(params.api.getDisplayedRowCount());
    restoreScrollPosition();
    return;
  }

  const backendParams = buildBackendFilterParams(model);
  setBackendFilterModel(backendParams);
  setCurrentPageTracked(1);

  restoreScrollPosition();
  scheduleVisibleSparklineLoad();
}}
onBodyScroll={() => {
  if (view !== "Watchlist") {
    scheduleVisibleSparklineLoad();
  }
}}
onColumnResized={updateAllocationFloatingPosition}
onColumnMoved={updateAllocationFloatingPosition}
onColumnPinned={updateAllocationFloatingPosition}
onDisplayedColumnsChanged={updateAllocationFloatingPosition}
/>
    </div>

    {view === "Watchlist" && (displayedCount > 0 || rowData.length > 0) && (
      <div
        style={{
          marginTop: "8px",
          marginLeft: `${allocationFloatingStyle.left}px`,
          width: `${allocationFloatingStyle.width}px`,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "6px",
        }}
      >
        <div
          style={{
            background: allocationTotalIsValid ? "#22c55e" : "#f97316",
            color: "white",
            borderRadius: "999px",
            padding: "5px 10px",
            fontSize: "11px",
            fontWeight: 800,
            boxShadow: "0 8px 18px rgba(0,0,0,0.28)",
            whiteSpace: "nowrap",
          }}
        >
          Total: {allocationTotal.toFixed(1)}%
        </div>

        <button
          onClick={resetAllocationsToEqual}
          style={{
            background: "#22c55e",
            color: "white",
            border: "none",
            borderRadius: "999px",
            padding: "7px 12px",
            fontSize: "12px",
            fontWeight: 900,
            cursor: "pointer",
            boxShadow: "0 8px 18px rgba(0,0,0,0.35)",
            whiteSpace: "nowrap",
          }}
        >
          Reset Equal
        </button>
      </div>
    )}

    {view !== "Watchlist" && totalPages > 1 && (
      <div
        style={{
          marginTop: "14px",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: "12px",
          color: "white"
        }}
      >
        <button
          onClick={() => changePage(currentPage - 1)}
          disabled={currentPage === 1}
          style={{
            padding: "8px 14px",
            borderRadius: "6px",
            border: "none",
            cursor: currentPage === 1 ? "not-allowed" : "pointer",
            opacity: currentPage === 1 ? 0.5 : 1
          }}
        >
          Previous
        </button>

        <span>
          Page {currentPage} of {totalPages}
        </span>

        <button
          onClick={() => changePage(currentPage + 1)}
          disabled={currentPage === totalPages}
          style={{
            padding: "8px 14px",
            borderRadius: "6px",
            border: "none",
            cursor: currentPage === totalPages ? "not-allowed" : "pointer",
            opacity: currentPage === totalPages ? 0.5 : 1
          }}
        >
          Next
        </button>
      </div>
    )}

    {starModalOpen && (
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100vw",
          height: "100vh",
          backgroundColor: "rgba(0,0,0,0.5)",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          zIndex: 1000,
        }}
      >
        <div style={{ backgroundColor: "#fff", padding: "20px", borderRadius: "8px", width: "300px" }}>
          <h3 style={{ color: "#000" }}>Select Watchlists for {modalTicker}</h3>

          <div style={{ display: "flex", flexDirection: "column", gap: "5px", marginTop: "10px" }}>
            {Object.keys(watchlists).map((listName) => (
              <label key={listName} style={{ color: "#000" }}>
                <input
                  type="checkbox"
                  checked={modalSelectedLists.includes(listName)}
                  onChange={(e) => {
                    setModalSelectedLists((prev) => {
                      if (e.target.checked) return [...prev, listName];
                      return prev.filter((l) => l !== listName);
                    });
                  }}
                />{" "}
                {listName}
              </label>
            ))}
          </div>

          <div style={{ marginTop: "15px", display: "flex", justifyContent: "flex-end", gap: "10px" }}>
            <button onClick={() => setStarModalOpen(false)} style={{ padding: "4px 8px" }}>
              Cancel
            </button>
            <button
              onClick={async () => {
                const updated = { ...watchlists };
                Object.keys(updated).forEach((listName) => {
                  if (modalSelectedLists.includes(listName)) {
                    updated[listName] = [...new Set([...(updated[listName] ?? []), modalTicker])];
                  } else {
                    updated[listName] = (updated[listName] ?? []).filter((t) => t !== modalTicker);
                  }
                });

setWatchlists(updated);

await saveWatchlists(updated);
setStarModalOpen(false);

if (gridRef.current?.api) {
  gridRef.current.api.refreshClientSideRowModel("everything");
  gridRef.current.api.redrawRows();
}

setNotification(`${modalTicker} watchlists updated ✓`);
setTimeout(() => setNotification(null), 2000);
              }}
            >
              Save
            </button>
          </div>
        </div>
      </div>
    )}
  </div>
)}
<StockChartModal
  isOpen={chartModalOpen}
  ticker={chartTicker}
  stockContext={chartStockContext}
  onClose={() => setChartModalOpen(false)}
  API_BASE={API_BASE}
/>
    </div>
  );
};

export default StockTable;