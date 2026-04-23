import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { AgGridReact } from "ag-grid-react";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";
import { ModuleRegistry, AllCommunityModule } from "ag-grid-community";
import "./StockTable.css";
import { useLocation, useNavigate } from "react-router-dom";
import WatchlistAnalytics from "./components/WatchlistAnalytics";
import { supabase } from "./lib/supabaseClient";

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

  const [pageSize] = useState(100);
const [currentPage, setCurrentPage] = useState(1);
const [totalPages, setTotalPages] = useState(1);
const [backendFilterModel, setBackendFilterModel] = useState({});
const [gridFilterModel, setGridFilterModel] = useState({});
const [isBackgroundLoading, setIsBackgroundLoading] = useState(false);
const [pageCache, setPageCache] = useState({});
const activeRequestRef = useRef(0);
const stocksAbortRef = useRef(null);
const isRestoringFilterModelRef = useRef(false);
const [viewMode, setViewMode] = useState("all data");
const [sparklines, setSparklines] = useState({});
const sparklineCacheRef = useRef({});
const sparklineRequestIdRef = useRef(0);
const sparklineDebounceRef = useRef(null);
const sparklineBackgroundLoadStartedRef = useRef(false);
const loadingWatchlistsRef = useRef(false);

const [chartModalOpen, setChartModalOpen] = useState(false);
const [chartTicker, setChartTicker] = useState(null);
const [chartRange, setChartRange] = useState("1D");
const [chartType, setChartType] = useState("candles");
const [chartData, setChartData] = useState([]);
const [chartLoading, setChartLoading] = useState(false);
const [chartHover, setChartHover] = useState(null);
const [selectedRangePopup, setSelectedRangePopup] = useState(null);

  const [watchlists, setWatchlists] = useState({});

  const [activeList, setActiveList] = useState("Default");

  const gridRef = useRef(null);
  const savedHorizontalScrollRef = useRef(0);
  const savedTopScrollRef = useRef(0);

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

const formatChartTimeLabel = (timestamp, range) => {
  const date = new Date(timestamp);

  if (range === "1D" || range === "5D") {
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  }

  if (range === "1M" || range === "6M" || range === "1Y") {
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  }

  return date.toLocaleDateString("en-US", {
    month: "short",
    year: "2-digit",
  });
};

const getChartPerformance = (points = []) => {
  if (!points.length) return null;

  const first = points[0]?.close;
  const last = points[points.length - 1]?.close;

  if (first == null || last == null) return null;

  const change = last - first;
  const pct = first !== 0 ? (change / first) * 100 : 0;

  return {
    change,
    pct,
    isUp: change >= 0,
  };
};

const renderLargeChartSvg = (points = []) => {
  if (!points.length) {
    return <div style={{ color: "#9ca3af" }}>No chart data available</div>;
  }

  const width = 950;
  const height = 420;
  const leftPad = 18;
  const rightPad = 64;
  const topPad = 18;
  const bottomPad = 38;

  const chartWidth = width - leftPad - rightPad;
  const chartHeight = height - topPad - bottomPad;

  const highs = points.map((p) => p.high ?? p.close);
  const lows = points.map((p) => p.low ?? p.close);
  const opens = points.map((p) => p.open ?? p.close);
  const closes = points.map((p) => p.close);

  const max = Math.max(...highs);
  const min = Math.min(...lows);
  const range = max - min || 1;
  const first = closes[0];
  const last = closes[closes.length - 1];

  const getX = (index) =>
    leftPad + (index / Math.max(points.length - 1, 1)) * chartWidth;

  const getY = (price) =>
    topPad + ((max - price) / range) * chartHeight;

  const baselineY = getY(first);

  const linePath = points
  .map((point, index) => {
    const x = getX(index);
    const y = getY(point.close);
    return `${index === 0 ? "M" : "L"} ${x} ${y}`;
  })
  .join(" ");

const areaPath = `
  ${linePath}
  L ${getX(points.length - 1)} ${height - bottomPad}
  L ${getX(0)} ${height - bottomPad}
  Z
`;

const priceTicks = Array.from({ length: 5 }, (_, i) => {
    const value = min + ((4 - i) / 4) * range;
    return Number(value.toFixed(2));
  });

  const bottomTickIndexes = [0, 0.25, 0.5, 0.75, 1].map((pct) =>
    Math.min(points.length - 1, Math.round((points.length - 1) * pct))
  );

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      {chartHover && (
        <div
          style={{
            position: "absolute",
            top: "12px",
            left: "12px",
            background: "rgba(17, 24, 39, 0.92)",
            border: "1px solid #374151",
            borderRadius: "8px",
            padding: "10px 12px",
            color: "white",
            zIndex: 5,
            fontSize: "13px",
            lineHeight: "1.5",
            pointerEvents: "none",
          }}
        >
          <div><strong>{chartHover.label}</strong></div>
          <div>Open: {chartHover.open.toFixed(2)}</div>
          <div>High: {chartHover.high.toFixed(2)}</div>
          <div>Low: {chartHover.low.toFixed(2)}</div>
          <div>Close: {chartHover.close.toFixed(2)}</div>
        </div>
      )}

      <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`}>
  {/* baseline */}
  <line
    x1={leftPad}
    y1={baselineY}
    x2={width - rightPad}
    y2={baselineY}
    stroke="#9ca3af"
    strokeWidth="1"
    strokeDasharray="4 4"
    opacity="0.45"
  />

  {/* horizontal price grid + right labels */}
  {priceTicks.map((value, idx) => {
    const y = getY(value);
    return (
      <g key={idx}>
        <line
          x1={leftPad}
          y1={y}
          x2={width - rightPad}
          y2={y}
          stroke="#334155"
          strokeWidth="1"
          opacity="0.5"
        />
        <text
          x={width - rightPad + 8}
          y={y + 4}
          fill="#cbd5e1"
          fontSize="12"
        >
          {value.toFixed(2)}
        </text>
      </g>
    );
  })}

  {/* bottom timestamps */}
  {bottomTickIndexes.map((pointIndex, idx) => {
    const point = points[pointIndex];
    const x = getX(pointIndex);
    return (
      <g key={idx}>
        <line
          x1={x}
          y1={height - bottomPad}
          x2={x}
          y2={height - bottomPad + 4}
          stroke="#64748b"
          strokeWidth="1"
        />
        <text
          x={x}
          y={height - 10}
          textAnchor="middle"
          fill="#cbd5e1"
          fontSize="12"
        >
          {formatChartTimeLabel(point.time, chartRange)}
        </text>
      </g>
    );
  })}

  {/* chart */}
  {chartType === "line" ? (
    <path
      d={linePath}
      fill="none"
      stroke={last < first ? "#dc2626" : "#19C37D"}
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ) : chartType === "mountain" ? (
    <>
      <path
        d={areaPath}
        fill={last < first ? "rgba(220, 38, 38, 0.18)" : "rgba(25, 195, 125, 0.18)"}
        stroke="none"
      />
      <path
        d={linePath}
        fill="none"
        stroke={last < first ? "#dc2626" : "#19C37D"}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  ) : (
    points.map((point, index) => {
      const x = getX(index);
      const openY = getY(point.open);
      const highY = getY(point.high);
      const lowY = getY(point.low);
      const closeY = getY(point.close);

      const candleWidth = Math.max(3, Math.min(8, chartWidth / points.length * 0.65));
      const isUp = point.close >= point.open;
      const color = isUp ? "#19C37D" : "#dc2626";
      const bodyY = Math.min(openY, closeY);
      const bodyHeight = Math.max(1.5, Math.abs(closeY - openY));

      return (
        <g key={index}>
          <line
            x1={x}
            y1={highY}
            x2={x}
            y2={lowY}
            stroke={color}
            strokeWidth="1.5"
          />
          <rect
            x={x - candleWidth / 2}
            y={bodyY}
            width={candleWidth}
            height={bodyHeight}
            fill={color}
            rx="1"
          />
        </g>
      );
    })
  )}

  {/* crosshair */}
  {chartHover && (
    <>
      <line
        x1={chartHover.x}
        y1={topPad}
        x2={chartHover.x}
        y2={height - bottomPad}
        stroke="#94a3b8"
        strokeWidth="1"
        strokeDasharray="4 4"
        opacity="0.8"
      />
      <line
        x1={leftPad}
        y1={chartHover.y}
        x2={width - rightPad}
        y2={chartHover.y}
        stroke="#94a3b8"
        strokeWidth="1"
        strokeDasharray="4 4"
        opacity="0.8"
      />
    </>
  )}

  {/* hover price label on right */}
  {chartHover && (
    <g>
      <rect
        x={width - rightPad + 6}
        y={chartHover.y - 10}
        width={60}
        height={20}
        rx={4}
        fill="#2563eb"
      />
      <text
        x={width - rightPad + 36}
        y={chartHover.y + 4}
        fill="white"
        fontSize="12"
        textAnchor="middle"
        fontWeight="bold"
      >
        {chartHover.close.toFixed(2)}
      </text>
    </g>
  )}

  {/* current price label on right */}
  {points.length > 0 && (
    <g>
      <rect
        x={width - rightPad + 6}
        y={getY(last) - 10}
        width={60}
        height={20}
        rx={4}
        fill={last >= first ? "#19C37D" : "#dc2626"}
      />
      <text
        x={width - rightPad + 36}
        y={getY(last) + 4}
        fill="white"
        fontSize="12"
        textAnchor="middle"
        fontWeight="bold"
      >
        {last.toFixed(2)}
      </text>
    </g>
  )}

  {/* hover date label on bottom */}
  {chartHover && (
    <g>
      <rect
        x={chartHover.x - 50}
        y={height - bottomPad + 6}
        width={100}
        height={22}
        rx={4}
        fill="#475569"
      />
      <text
        x={chartHover.x}
        y={height - bottomPad + 21}
        fill="white"
        fontSize="12"
        textAnchor="middle"
        fontWeight="bold"
      >
        {chartHover.label}
      </text>
    </g>
  )}

  {/* hover zones */}
  {points.map((point, index) => {
    const x = getX(index);
    return (
      <rect
        key={index}
        x={x - Math.max(chartWidth / Math.max(points.length, 1) / 2, 4)}
        y={topPad}
        width={Math.max(chartWidth / Math.max(points.length, 1), 8)}
        height={chartHeight}
        fill="transparent"
        onMouseEnter={() =>
          setChartHover({
            label: formatChartTimeLabel(point.time, chartRange),
            time: point.time,
            open: point.open,
            high: point.high,
            low: point.low,
            close: point.close,
            x: getX(index),
            y: getY(point.close),
          })
        }
        onMouseLeave={() => setChartHover(null)}
      />
    );
  })}
</svg>
    </div>
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

const loadVisibleSparklines = useCallback(async () => {
  if (!showTable) return;
  if (!rowData.length) return;

  const targetTickers = getVisibleSparklineTickers();
  if (!targetTickers.length) return;

  const cachedRows = {};
  const missingTickers = [];

  targetTickers.forEach((ticker) => {
    if (sparklineCacheRef.current[ticker]) {
      cachedRows[ticker] = sparklineCacheRef.current[ticker];
    } else {
      missingTickers.push(ticker);
    }
  });

  if (Object.keys(cachedRows).length) {
    setSparklines((prev) => ({
      ...prev,
      ...cachedRows,
    }));
  }

  if (!missingTickers.length) return;

  const requestId = ++sparklineRequestIdRef.current;

  try {
    const res = await fetch(
      `${API_BASE}/stocks/sparklines?tickers=${encodeURIComponent(
        missingTickers.join(",")
      )}`
    );

    const data = await res.json();

    if (sparklineRequestIdRef.current !== requestId) return;

    const newRows = data?.rows || {};

    Object.entries(newRows).forEach(([ticker, value]) => {
      sparklineCacheRef.current[ticker] = value;
    });

    setSparklines((prev) => ({
      ...prev,
      ...cachedRows,
      ...newRows,
    }));
  } catch (err) {
    console.error("Failed to load visible sparklines", err);
  }
}, [API_BASE, getVisibleSparklineTickers, rowData, showTable, view]);

const loadRemainingSparklinesInBackground = useCallback(async () => {
  if (!rowData.length) return;

  if (sparklineBackgroundLoadStartedRef.current) return;
  sparklineBackgroundLoadStartedRef.current = true;

  const allTickers = rowData.map((row) => row.Ticker).filter(Boolean);
  const missingTickers = allTickers.filter(
    (ticker) => !sparklineCacheRef.current[ticker]
  );

  if (!missingTickers.length) return;

  const chunkSize = view === "Watchlist" ? 50 : 20;

  for (let i = 0; i < missingTickers.length; i += chunkSize) {
    const chunk = missingTickers.slice(i, i + chunkSize);

    try {
      await new Promise((resolve) => setTimeout(resolve, 60));

      const res = await fetch(
        `${API_BASE}/stocks/sparklines?tickers=${encodeURIComponent(
          chunk.join(",")
        )}`
      );

      const data = await res.json();
      const newRows = data?.rows || {};

      Object.entries(newRows).forEach(([ticker, value]) => {
        sparklineCacheRef.current[ticker] = value;
      });

      setSparklines((prev) => ({
        ...prev,
        ...newRows,
      }));
    } catch (err) {
      console.error("Failed background sparkline batch", err);
    }
  }
}, [API_BASE, rowData, view]);

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

const cancelStockRequest = () => {
  if (stocksAbortRef.current) {
    stocksAbortRef.current.abort();
    stocksAbortRef.current = null;
  }
};

const fetchStocks = async () => {
  cancelStockRequest();
  setLoading(true);
  saveScrollPosition();

  const controller = new AbortController();
  stocksAbortRef.current = controller;

  try {
if (view === "Watchlist") {
  const localStocks = JSON.parse(localStorage.getItem("stocks") || "[]");
  const safeStocks = Array.isArray(localStocks) ? localStocks : [];

  setStocks(safeStocks);
  setDisplayedCount(
    safeStocks.filter((s) => (watchlists[activeList] ?? []).includes(s.Ticker)).length
  );
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
    setStocks(firstRows);
    restoreScrollPosition();
    setDisplayedCount(total);
    setTotalPages(pages);
    setCurrentPage(1);
    localStorage.setItem("stocks", JSON.stringify(firstRows));
    setLoading(false);

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

  setCurrentPage(nextPage);

  if (pageCache[nextPage]) {
  saveScrollPosition();
  setStocks(pageCache[nextPage]);
  restoreScrollPosition();
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
setStocks(rows);
restoreScrollPosition();
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
  if (!showTable) return;
  if (view !== "Watchlist") return;

  const localStocks = JSON.parse(localStorage.getItem("stocks") || "[]");
  const safeStocks = Array.isArray(localStocks) ? localStocks : [];

  setStocks(safeStocks);
  setDisplayedCount(
    safeStocks.filter((s) => activeWatchlistTickers.includes(s.Ticker)).length
  );
  setTotalPages(1);
  setPageCache({});
  setIsBackgroundLoading(false);
  setLoading(false);
}, [showTable, view, activeList]);

useEffect(() => {
  setCurrentPage(1);
}, [searchQuery, selectedSector, selectedType, tickerFilter, tickersParam, backendFilterModel, view]);

 useEffect(() => {
  const handler = setTimeout(() => {
    setSearchQuery(typedQuery);
  }, 650);

  return () => clearTimeout(handler);
}, [typedQuery]);

  useEffect(() => {
    const setupScrollSync = () => {
      const topScroll = document.querySelector(".top-scrollbar");
      const topContent = document.querySelector(".top-scroll-content");
      const gridViewport = document.querySelector(".ag-body-horizontal-scroll-viewport");
      const gridCenter = document.querySelector(".ag-center-cols-container");

      if (!topScroll || !topContent || !gridViewport || !gridCenter) return;

      topContent.style.width = gridCenter.scrollWidth + "px";

      const syncTop = () => {
        const maxTop = topScroll.scrollWidth - topScroll.clientWidth;
        const maxGrid = gridViewport.scrollWidth - gridViewport.clientWidth;
        const ratio = maxTop > 0 ? topScroll.scrollLeft / maxTop : 0;
        gridViewport.scrollLeft = ratio * maxGrid;
      };

      const syncBottom = () => {
        const maxTop = topScroll.scrollWidth - topScroll.clientWidth;
        const maxGrid = gridViewport.scrollWidth - gridViewport.clientWidth;
        const ratio = maxGrid > 0 ? gridViewport.scrollLeft / maxGrid : 0;
        topScroll.scrollLeft = ratio * maxTop;
      };

      topScroll.addEventListener("scroll", syncTop);
      gridViewport.addEventListener("scroll", syncBottom);
    };

    const timer = setTimeout(setupScrollSync, 200);
    return () => clearTimeout(timer);
  }, [processedStocks]);

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
  "EBITDA",
  "Gross Profit",
  "Dividend Yield",
  "Number of Analysts",
  "Mean Target",
  "Analyst Upside",
  "Analyst Downside",
  "Beta"
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
];

  const columns = useMemo(() => {
    const cols = [
      {
        headerName: "★",
        colId: "star",
        field: "star",
        width: 60,
        pinned: "left",
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
  cellClass: "column-border",
  headerClass: "column-border",
},
{
  field: "Today",
  headerName: "Today",
  width: 140,
  pinned: "left",
  sortable: false,
  filter: false,
  suppressMenu: true,
  cellClass: "column-border",
  headerClass: "column-border",
  cellRenderer: (params) => {
    const ticker = params.data?.Ticker;
    const spark = sparklines[ticker];

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
  setChartRange("1D");
  setChartType("candles");
  setChartHover(null);
  setSelectedRangePopup(null);
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
      "Beta",
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
        headerName: col,
        field: col,
        sortable: true,
        flex: 1,
        minWidth: 130,
        headerClass: "column-border",
        cellClass: "column-border",
        valueGetter: (params) => {
  if (["Market Cap", "Day Volume", "EBITDA", "Gross Profit"].includes(col)) {
    return parseLargeNumber(params.data[col]);
  }

  if (col === "Dividend Yield") {
    return normalizeDividendYield(params.data[col]);
  }

  return params.data[col];
},
        tooltipValueGetter:
          col === "Type"
            ? (params) => {
                const raw = (params.data?.["Type"] || "").toString().toUpperCase();
                if (raw === "CS") return "Stock";
                if (raw === "ETF") return "ETF";
                if (raw === "ETP") return "ETP";
                if (raw === "ADRC") return "ADR";
                if (raw === "PFD") return "Preferred Stock";
                return raw || "";
              }
            : undefined,
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
  ].includes(col)
) {
  return typeof val === "number" ? `${val.toFixed(2)}%` : val;
}

          if (
            [
              "EPS (TTM)",
              "P/E (TTM)",
              "RSI",
              "MACD",
              "MACD Signal",
              "MACD Histogram",
              "SMA 20",
              "Beta",
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
          "Dividend Yield",
          "RSI",
          "MACD",
          "MACD Signal",
          "MACD Histogram",
          "SMA 20",
          "Beta",
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
  }, [watchlists, activeList, view, viewMode, sparklines]);

  useEffect(() => {
  restoreScrollPosition();
}, [processedStocks]);

  useEffect(() => {
    if (view === "Watchlist" && gridRef.current?.api) {
      setDisplayedCount(gridRef.current.api.getDisplayedRowCount());
    }
  }, [rowData, view]);

useEffect(() => {
  if (!showTable) return;

  if (!rowData.length) {
    setSparklines({});
    sparklineCacheRef.current = {};
    sparklineBackgroundLoadStartedRef.current = false;
    return;
  }

  scheduleVisibleSparklineLoad();

  return () => {
    if (sparklineDebounceRef.current) {
      clearTimeout(sparklineDebounceRef.current);
    }
  };
}, [rowData, showTable, view, scheduleVisibleSparklineLoad]);

useEffect(() => {
  if (view === "Watchlist") return;

  setSparklines({});
  sparklineCacheRef.current = {};
  sparklineBackgroundLoadStartedRef.current = false;
}, [searchQuery, selectedSector, selectedType, tickerFilter, tickersParam, backendFilterModel, view]);

useEffect(() => {
  if (!chartModalOpen || !chartTicker) return;

  const fetchChart = async () => {
    try {
      setChartLoading(true);
      setChartHover(null);
      setSelectedRangePopup(null);

      const res = await fetch(
        `${API_BASE}/stocks/${chartTicker}/chart?range=${encodeURIComponent(chartRange)}`
      );
      const data = await res.json();

      setChartData(Array.isArray(data?.points) ? data.points : []);
    } catch (err) {
      console.error("Failed to load chart", err);
      setChartData([]);
    } finally {
      setChartLoading(false);
    }
  };

  fetchChart();
}, [chartModalOpen, chartTicker, chartRange, API_BASE]);

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
      resizable: true,
      sortable: true,
      minWidth: 100,
    }),
    []
  );

  const chartPerformance = getChartPerformance(chartData);

  return (
    <div className="stock-table-container">
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
  <div style={{ position: "relative" }}>
    {loading && (
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
          flexDirection: "column"
        }}
      >
        <div className="spinner"></div>
        Loading stocks...
      </div>
    )}

    <div className="top-scrollbar">
      <div className="top-scroll-content"></div>
    </div>

    <div
      className={`ag-theme-alpine ${view === "Watchlist" ? "ag-watchlist" : ""}`}
      style={{ width: "100%", height: "700px" }}
    >
<AgGridReact
  ref={gridRef}
  suppressFieldDotNotation={true}
  headerHeight={70}
  rowData={rowData}
  columnDefs={columns}
  defaultColDef={defaultColDef}
  immutableData={true}
  getRowId={(params) => params.data.Ticker}
  suppressScrollOnNewData={true}
  rowBuffer={0}
  animateRows={true}
  rowSelection="multiple"
  rowHeight={30}
  tooltipShowDelay={0}
  tooltipHideDelay={25000}
  onGridReady={(params) => {
  gridRef.current = params;

  if (view === "Watchlist") {
    setDisplayedCount(params.api.getDisplayedRowCount());
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
  setCurrentPage(1);

  restoreScrollPosition();
  scheduleVisibleSparklineLoad();
}}
onBodyScroll={() => {
  if (view !== "Watchlist") {
    scheduleVisibleSparklineLoad();
  }
}}
/>
    </div>

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
{chartModalOpen && (
  <div
    style={{
      position: "fixed",
      inset: 0,
      backgroundColor: "rgba(0, 0, 0, 0.65)",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      zIndex: 2000,
      padding: "20px",
    }}
    onClick={() => setChartModalOpen(false)}
  >
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        width: "90%",
        maxWidth: "1100px",
        height: "75vh",
        background: "#111827",
        borderRadius: "14px",
        padding: "20px",
        boxSizing: "border-box",
        color: "white",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "16px",
        }}
      >
        <h2 style={{ margin: 0 }}>{chartTicker} Chart</h2>

        <button
          onClick={() => setChartModalOpen(false)}
          style={{
            padding: "8px 12px",
            borderRadius: "6px",
            border: "none",
            background: "#1f2937",
            color: "white",
            cursor: "pointer",
            fontWeight: "bold",
          }}
        >
          Close
        </button>
      </div>

      <div
  style={{
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
    marginBottom: "16px",
    flexWrap: "wrap",
  }}
>
  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
    {["1D", "5D", "1M", "6M", "1Y", "5Y", "Max"].map((range) => {
  const isSelected = chartRange === range;

  return (
    <div
      key={range}
      style={{
        position: "relative",
        display: "inline-flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      <button
        onClick={() => {
          setChartRange(range);

          if (chartPerformance) {
            setSelectedRangePopup({
              range,
              pct: chartPerformance.pct,
              isUp: chartPerformance.pct >= 0,
            });
          }
        }}
        style={{
          padding: "6px 10px",
          borderRadius: "6px",
          cursor: "pointer",
          border: "none",
          background: isSelected ? "#19C37D" : "#1f2937",
          color: "white",
          fontWeight: isSelected ? "bold" : "normal",
        }}
      >
        {range}
      </button>

      {selectedRangePopup?.range === range && isSelected && (
        <div
          style={{
            position: "absolute",
            top: "110%",
            marginTop: "6px",
            background: "#111827",
            border: "1px solid #374151",
            borderRadius: "8px",
            padding: "6px 10px",
            fontSize: "12px",
            fontWeight: "bold",
            color: selectedRangePopup.isUp ? "#19C37D" : "#dc2626",
            whiteSpace: "nowrap",
            zIndex: 10,
          }}
        >
          {selectedRangePopup.pct >= 0 ? "+" : ""}
          {selectedRangePopup.pct.toFixed(2)}%
        </div>
      )}
    </div>
  );
})}
  </div>

  {chartPerformance && (
    <div
      style={{
        padding: "6px 12px",
        borderRadius: "8px",
        background: "#0f172a",
        color: chartPerformance.isUp ? "#19C37D" : "#dc2626",
        fontWeight: "bold",
        border: "1px solid #1f2937",
        whiteSpace: "nowrap",
      }}
    >
      {chartPerformance.change >= 0 ? "+" : ""}
      {chartPerformance.change.toFixed(2)} (
      {chartPerformance.pct >= 0 ? "+" : ""}
      {chartPerformance.pct.toFixed(2)}%)
    </div>
  )}

  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
  <button
    onClick={() => setChartType("mountain")}
    style={{
      padding: "6px 10px",
      borderRadius: "6px",
      cursor: "pointer",
      border: "none",
      background: chartType === "mountain" ? "#19C37D" : "#1f2937",
      color: "white",
      fontWeight: chartType === "mountain" ? "bold" : "normal",
    }}
  >
    Mountain
  </button>

  <button
    onClick={() => setChartType("line")}
    style={{
      padding: "6px 10px",
      borderRadius: "6px",
      cursor: "pointer",
      border: "none",
      background: chartType === "line" ? "#19C37D" : "#1f2937",
      color: "white",
      fontWeight: chartType === "line" ? "bold" : "normal",
    }}
  >
    Line
  </button>

  <button
    onClick={() => setChartType("candles")}
    style={{
      padding: "6px 10px",
      borderRadius: "6px",
      cursor: "pointer",
      border: "none",
      background: chartType === "candles" ? "#19C37D" : "#1f2937",
      color: "white",
      fontWeight: chartType === "candles" ? "bold" : "normal",
    }}
  >
    Candles
  </button>
</div>
</div>

      <div
  style={{
    flex: 1,
    background: "#0f172a",
    borderRadius: "10px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#9ca3af",
    fontSize: "18px",
    border: "1px solid #1f2937",
    padding: "12px",
    boxSizing: "border-box",
  }}
>
  {chartLoading ? (
    <div>Loading chart for {chartTicker}...</div>
  ) : (
    renderLargeChartSvg(chartData)
  )}
</div>
    </div>
  </div>
)}
    </div>
  );
};

export default StockTable;