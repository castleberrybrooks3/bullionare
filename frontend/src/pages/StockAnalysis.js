import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import Navbar from "../components/Navbar";
import dependencyTree from "../data/macroDependencyTree";
import { buildReverseMacroMap } from "../data/buildReverseMacroMap";
import { summarizeTickerMacroExposure } from "../data/macroLookupHelpers";
import supplyChainTree from "../data/supplyChainTree";
import smartMoneyTransactions from "../data/smartMoneyData";
import "./StockAnalysis.css";

const API_BASE =
  process.env.NODE_ENV === "development"
    ? "http://localhost:8000"
    : process.env.REACT_APP_API_BASE;

const ranges = ["1D", "5D", "1M", "6M", "1Y", "5Y", "Max"];

const STOCK_ANALYSIS_CLIENT_CACHE = new Map();
const STOCK_CHART_CLIENT_CACHE = new Map();
const SEC_FINANCIALS_CLIENT_CACHE = new Map();
const SEC_DEEP_DIVE_CLIENT_CACHE = new Map();
const FILING_INTELLIGENCE_CLIENT_CACHE = new Map();
const LIVE_QUOTE_CLIENT_CACHE = new Map();

const STOCK_ANALYSIS_CLIENT_TTL_MS = 5 * 60 * 1000;
const STOCK_CHART_CLIENT_TTL_MS = 15 * 60 * 1000;
const SEC_CLIENT_TTL_MS = 10 * 60 * 1000;
const LIVE_QUOTE_CLIENT_TTL_MS = 15 * 1000;
const STOCK_BACKGROUND_PRELOAD_DELAY_MS = 700;
const STOCK_BACKGROUND_IDLE_TIMEOUT_MS = 1800;
const STOCK_BACKGROUND_STAGE_GAP_MS = 180;

const SEC_FINANCIALS_INFLIGHT = new Map();
const SEC_DEEP_DIVE_INFLIGHT = new Map();
const FILING_INTELLIGENCE_INFLIGHT = new Map();

function readClientCache(cache, key, ttlMs) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.cachedAt > ttlMs) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function writeClientCache(cache, key, data) {
  if (!key || data === null || data === undefined) return;
  cache.set(key, { data, cachedAt: Date.now() });
}

async function getCachedApiResource({ cache, inflight, key, ttlMs, url, fallbackMessage }) {
  const cached = readClientCache(cache, key, ttlMs);
  if (cached) return cached;

  const existing = inflight.get(key);
  if (existing) return existing;

  const request = (async () => {
    const res = await fetch(url);
    const data = await res.json();
    if (!res.ok || data?.error) {
      throw new Error(data?.error || fallbackMessage);
    }
    writeClientCache(cache, key, data);
    return data;
  })();

  inflight.set(key, request);
  try {
    return await request;
  } finally {
    if (inflight.get(key) === request) inflight.delete(key);
  }
}

function sleepMs(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function makeSeedAnalysis(ticker, stock) {
  if (!stock) return null;
  return {
    ticker,
    stock,
    peers: [],
    peer_stats: {},
    relative: {},
    snapshot_score: null,
    badges: [],
  };
}

const analysisTabs = [
  "Overview",
  "Thesis",
  "Financials",
  "Analysts",
  "Smart Money",
  "Technicals",
  "Risk Radar",
  "What Moves It",
  "Dependency Map",
  "Supply Chain",
  "Peers",
  "Compare",
  "Filings",
];

function formatValue(value, suffix = "") {
  if (value === null || value === undefined || value === "") return "--";

  const num = Number(value);

  if (!Number.isNaN(num)) {
    return `${num.toLocaleString(undefined, {
      maximumFractionDigits: 2,
    })}${suffix}`;
  }

  return `${value}${suffix}`;
}

function formatPercent(value) {
  if (value === null || value === undefined || value === "") return "--";

  const num = Number(value);
  if (Number.isNaN(num)) return value;

  return `${num > 0 ? "+" : ""}${num.toFixed(2)}%`;
}

function formatSignedPercent(value) {
  if (value === null || value === undefined || value === "") return "--";

  const num = Number(value);
  if (Number.isNaN(num)) return "--";

  return `${num > 0 ? "+" : ""}${num.toFixed(2)}%`;
}

function formatDividendYield(value) {
  if (value === null || value === undefined || value === "") return "--";

  const num = Number(value);
  if (Number.isNaN(num)) return "--";

  // Handles cases where the DB accidentally stores basis-point-like values.
  // Example: 98 should display as 0.98%, not 98%.
  if (num > 20) {
    return `${(num / 100).toFixed(2)}%`;
  }

  return `${num.toFixed(2)}%`;
}

function getScoreLabel(score) {
  const safeScore = Number(score ?? 0);

  if (safeScore >= 80) return "Strong";
  if (safeScore >= 65) return "Constructive";
  if (safeScore >= 50) return "Neutral";
  if (safeScore >= 35) return "Weak";
  return "High Risk";
}

function MetricCard({ label, value, suffix }) {
  return (
    <div className="stock-analysis-card">
      <div className="stock-analysis-card-label">{label}</div>
      <div className="stock-analysis-card-value">
        {formatValue(value, suffix)}
      </div>
    </div>
  );
}

function RawMetricCard({ label, value }) {
  return (
    <div className="stock-analysis-card">
      <div className="stock-analysis-card-label">{label}</div>
      <div className="stock-analysis-card-value">{value}</div>
    </div>
  );
}

function currencyPrefix(currency = "USD") {
  const code = String(currency || "USD").toUpperCase();
  const prefixes = {
    USD: "$",
    EUR: "€",
    GBP: "£",
    JPY: "¥",
    CNY: "CN¥",
    TWD: "NT$",
    CAD: "C$",
    AUD: "A$",
    HKD: "HK$",
    CHF: "CHF ",
    KRW: "₩",
    INR: "₹",
  };
  return prefixes[code] || `${code} `;
}

function formatLargeMoney(value, currency = "USD") {
  if (value === null || value === undefined || value === "") return "--";
  const num = Number(value);
  if (Number.isNaN(num)) return "--";
  const prefix = currencyPrefix(currency);
  const abs = Math.abs(num);
  if (abs >= 1_000_000_000_000) return `${prefix}${(num / 1_000_000_000_000).toFixed(2)}T`;
  if (abs >= 1_000_000_000) return `${prefix}${(num / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `${prefix}${(num / 1_000_000).toFixed(2)}M`;
  return `${prefix}${num.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function formatLargeNumber(value) {
  if (value === null || value === undefined || value === "") return "--";

  const num = Number(value);
  if (Number.isNaN(num)) return "--";

  const abs = Math.abs(num);

  if (abs >= 1_000_000_000) {
    return `${(num / 1_000_000_000).toFixed(2)}B`;
  }

  if (abs >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(2)}M`;
  }

  return num.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function formatRatio(value) {
  if (value === null || value === undefined || value === "") return "--";

  const num = Number(value);
  if (Number.isNaN(num)) return "--";

  return num.toFixed(2);
}

function formatDate(value) {
  if (!value) return "--";

  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatFiscalYear(row) {
  if (!row?.year) return "--";
  return `FY${row.year}`;
}

function formatConceptList(value) {
  if (!value) return "--";

  if (Array.isArray(value)) {
    return value.length ? value.join(", ") : "--";
  }

  return String(value);
}

function cleanSourceText(value) {
  if (!value) return "--";
  return String(value).replaceAll("_", " ");
}

function numericOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function formatAnalystPrice(value) {
  const num = numericOrNull(value);
  if (num === null) return "--";
  return `$${num.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatQuarterLabel(row) {
  if (!row) return "--";
  const quarter = row.quarter ? String(row.quarter).toUpperCase() : null;
  const year = row.year ? String(row.year).slice(-2) : null;
  if (quarter && year) return `${quarter} FY${year}`;
  if (quarter) return quarter;
  if (row.period) {
    const date = new Date(`${row.period}T00:00:00`);
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleDateString(undefined, { month: "short", year: "2-digit" });
    }
  }
  return "--";
}

function resolveAnalystTargets(stock, livePrice, backendTargets) {
  const current =
    numericOrNull(livePrice) ?? numericOrNull(stock?.["Current Price"]);
  const basis =
    numericOrNull(backendTargets?.basis_price) ??
    numericOrNull(stock?.["Current Price"]);
  const mean =
    numericOrNull(backendTargets?.mean) ?? numericOrNull(stock?.["Mean Target"]);

  let low = numericOrNull(backendTargets?.low);
  let high = numericOrNull(backendTargets?.high);

  const downside = numericOrNull(stock?.["Analyst Downside"]);
  const upside = numericOrNull(stock?.["Analyst Upside"]);

  if (low === null && basis !== null && downside !== null) {
    low = basis * (1 + downside / 100);
  }

  if (high === null && basis !== null && upside !== null) {
    high = basis * (1 + upside / 100);
  }

  if (low !== null && high !== null && low > high) {
    [low, high] = [high, low];
  }

  return {
    current,
    basis,
    low,
    mean,
    high,
    analystCount:
      numericOrNull(backendTargets?.analyst_count) ??
      numericOrNull(stock?.["Number of Analysts"]),
  };
}

function targetReturnPercent(target, current) {
  const t = numericOrNull(target);
  const c = numericOrNull(current);
  if (t === null || c === null || c <= 0) return null;
  return ((t - c) / c) * 100;
}

function AnalystTargetRangeCard({ stock, livePrice, analystTargets }) {
  const model = resolveAnalystTargets(stock, livePrice, analystTargets);
  const values = [model.low, model.current, model.mean, model.high].filter(
    (value) => value !== null
  );

  const cardStyle = {
    border: "1px solid rgba(148, 163, 184, 0.22)",
    borderRadius: 14,
    padding: "18px 18px 16px",
    background: "rgba(255,255,255,0.02)",
    minWidth: 0,
  };

  if (!values.length) {
    return (
      <div style={cardStyle}>
        <div className="stock-analysis-card-label">Analyst Price Targets</div>
        <h3 style={{ margin: "6px 0 8px" }}>Price target range unavailable</h3>
        <p style={{ margin: 0, opacity: 0.72 }}>
          Bullionaire does not currently have enough analyst target data for this ticker.
        </p>
      </div>
    );
  }

  const domainMin = Math.min(...values);
  const domainMax = Math.max(...values);
  const padding = Math.max((domainMax - domainMin) * 0.12, domainMax * 0.025, 1);
  const min = Math.max(0, domainMin - padding);
  const max = domainMax + padding;
  const width = 720;
  const height = 250;
  const left = 54;
  const right = width - 54;
  const axisY = 126;
  const scaleX = (value) =>
    left + ((value - min) / Math.max(max - min, 1)) * (right - left);

  const marker = (value, label, color, yOffset, filled = true) => {
    if (value === null) return null;
    const x = scaleX(value);
    const y = axisY;
    return (
      <g key={label}>
        <line
          x1={x}
          y1={axisY - 8}
          x2={x}
          y2={axisY + yOffset * 0.62}
          stroke={color}
          strokeWidth="1.5"
          opacity="0.78"
        />
        <circle
          cx={x}
          cy={y}
          r={filled ? 7 : 6}
          fill={filled ? color : "#0f172a"}
          stroke={color}
          strokeWidth="3"
        />
        <rect
          x={Math.max(4, Math.min(width - 136, x - 66))}
          y={axisY + yOffset - 28}
          width="132"
          height="48"
          rx="8"
          fill="rgba(15, 23, 42, 0.94)"
          stroke={color}
          strokeWidth="1.2"
        />
        <text
          x={Math.max(70, Math.min(width - 70, x))}
          y={axisY + yOffset - 10}
          textAnchor="middle"
          fill="#f8fafc"
          fontSize="16"
          fontWeight="800"
        >
          {formatAnalystPrice(value)}
        </text>
        <text
          x={Math.max(70, Math.min(width - 70, x))}
          y={axisY + yOffset + 8}
          textAnchor="middle"
          fill="#cbd5e1"
          fontSize="12"
        >
          {label}
        </text>
      </g>
    );
  };

  const avgReturn = targetReturnPercent(model.mean, model.current);

  return (
    <div style={cardStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
        <div>
          <div className="stock-analysis-card-label">Analyst Price Targets</div>
          <h3 style={{ margin: "6px 0 4px" }}>Low · Current · Average · High</h3>
        </div>
        <div style={{ textAlign: "right" }}>
          <strong>{model.analystCount ? `${Math.round(model.analystCount)} analysts` : "Analyst consensus"}</strong>
          <div style={{ fontSize: 12, opacity: 0.7 }}>12-month price targets</div>
        </div>
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        style={{ width: "100%", height: "auto", marginTop: 8, overflow: "visible" }}
        role="img"
        aria-label="Analyst price target range"
      >
        <line
          x1={model.low !== null ? scaleX(model.low) : left}
          y1={axisY}
          x2={model.high !== null ? scaleX(model.high) : right}
          y2={axisY}
          stroke="#64748b"
          strokeWidth="8"
          strokeLinecap="round"
          opacity="0.5"
        />
        {marker(model.mean, "Average", "#3b82f6", -66, true)}
        {marker(model.current, "Current · live", "#f8fafc", 70, false)}

        {model.low !== null && (
          <g>
            <circle cx={scaleX(model.low)} cy={axisY} r="6" fill="#64748b" />
            <text x={scaleX(model.low)} y={axisY + 32} textAnchor="middle" fill="#cbd5e1" fontSize="14" fontWeight="700">
              {formatAnalystPrice(model.low)}
            </text>
            <text x={scaleX(model.low)} y={axisY + 50} textAnchor="middle" fill="#94a3b8" fontSize="12">Low</text>
          </g>
        )}
        {model.high !== null && (
          <g>
            <circle cx={scaleX(model.high)} cy={axisY} r="6" fill="#64748b" />
            <text x={scaleX(model.high)} y={axisY + 32} textAnchor="middle" fill="#cbd5e1" fontSize="14" fontWeight="700">
              {formatAnalystPrice(model.high)}
            </text>
            <text x={scaleX(model.high)} y={axisY + 50} textAnchor="middle" fill="#94a3b8" fontSize="12">High</text>
          </g>
        )}
      </svg>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(135px, 1fr))",
          gap: 10,
          marginTop: 4,
        }}
      >
        {[
          ["Low vs. live", targetReturnPercent(model.low, model.current)],
          ["Average vs. live", avgReturn],
          ["High vs. live", targetReturnPercent(model.high, model.current)],
        ].map(([label, value]) => (
          <div key={label} style={{ borderTop: "1px solid rgba(148,163,184,.16)", paddingTop: 10 }}>
            <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".06em", opacity: 0.62 }}>{label}</div>
            <strong style={{ color: value !== null && value >= 0 ? "#22c55e" : "#ef4444" }}>
              {value === null ? "--" : `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`}
            </strong>
          </div>
        ))}
      </div>

      <p style={{ margin: "12px 0 0", fontSize: 12, opacity: 0.62, lineHeight: 1.45 }}>
        The Current marker reflects Bullionaire&apos;s live market snapshot. Low, average, and high targets reflect the latest analyst consensus values stored by Bullionaire.
      </p>
    </div>
  );
}

function AnalystForecastFan({ stock, livePrice, analystTargets, historyPoints }) {
  const model = resolveAnalystTargets(stock, livePrice, analystTargets);
  // The Analysts view receives the dedicated 1Y chart series. Keep the full
  // trailing-year history instead of trimming it to the most recent ~90 bars.
  const history = (Array.isArray(historyPoints) ? historyPoints : [])
    .filter((point) => numericOrNull(point?.close) !== null);

  const targetValues = [model.low, model.mean, model.high, model.current].filter(
    (value) => value !== null
  );
  const historyValues = history.map((point) => Number(point.close));
  const allValues = [...historyValues, ...targetValues];

  const cardStyle = {
    border: "1px solid rgba(148, 163, 184, 0.22)",
    borderRadius: 14,
    padding: "18px 18px 16px",
    background: "rgba(255,255,255,0.02)",
    minWidth: 0,
  };

  if (model.current === null || !targetValues.length) {
    return (
      <div style={cardStyle}>
        <div className="stock-analysis-card-label">12-Month Target Range</div>
        <h3 style={{ margin: "6px 0 8px" }}>Forecast range unavailable</h3>
        <p style={{ margin: 0, opacity: 0.72 }}>
          A live price and at least one analyst target are required for this chart.
        </p>
      </div>
    );
  }

  const width = 780;
  const height = 330;
  const top = 28;
  const bottom = 284;
  const historyStartX = 34;
  const currentX = 476;
  const forecastX = 706;
  const minValue = Math.min(...allValues);
  const maxValue = Math.max(...allValues);
  const pad = Math.max((maxValue - minValue) * 0.12, maxValue * 0.025, 1);
  const yMin = Math.max(0, minValue - pad);
  const yMax = maxValue + pad;
  const getY = (value) =>
    bottom - ((value - yMin) / Math.max(yMax - yMin, 1)) * (bottom - top);
  const getHistoryX = (index) =>
    historyStartX +
    (index / Math.max(history.length - 1, 1)) * (currentX - historyStartX);

  const historyPath = history
    .map((point, index) => `${index === 0 ? "M" : "L"} ${getHistoryX(index)} ${getY(Number(point.close))}`)
    .join(" ");

  const currentY = getY(model.current);
  const lowY = model.low !== null ? getY(model.low) : currentY;
  const highY = model.high !== null ? getY(model.high) : currentY;
  const meanY = model.mean !== null ? getY(model.mean) : currentY;
  const fanPoints = `${currentX},${currentY} ${forecastX},${highY} ${forecastX},${lowY}`;

  const targetColor = (value) =>
    numericOrNull(value) !== null && Number(value) < model.current ? "#ef4444" : "#22c55e";

  const labelRows = [
    { key: "High", value: model.high, y: highY },
    { key: "Average", value: model.mean, y: meanY },
    { key: "Low", value: model.low, y: lowY },
  ]
    .filter((row) => row.value !== null)
    .map((row) => ({ ...row, color: targetColor(row.value) }));

  return (
    <div style={cardStyle}>
      <div className="stock-analysis-card-label">12-Month Analyst Outlook</div>
      <h3 style={{ margin: "6px 0 4px" }}>1-Year Price History & Analyst Targets</h3>
      <p style={{ margin: "0 0 8px", fontSize: 12, opacity: 0.68, lineHeight: 1.45 }}>
        The blue line shows the stock&apos;s trailing 12-month price history. The white dotted line marks the current live price. Analyst targets above the live price are shown in green; targets below it are shown in red.
      </p>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        style={{ width: "100%", height: "auto", display: "block" }}
        role="img"
        aria-label="Historical price and analyst forecast range"
      >
        <defs>
          <clipPath id={`analyst-green-${String(stock?.Ticker || "stock").replace(/[^a-zA-Z0-9]/g, "")}`}>
            <rect x="0" y="0" width={width} height={Math.max(currentY, 0)} />
          </clipPath>
          <clipPath id={`analyst-red-${String(stock?.Ticker || "stock").replace(/[^a-zA-Z0-9]/g, "")}`}>
            <rect x="0" y={currentY} width={width} height={Math.max(height - currentY, 0)} />
          </clipPath>
        </defs>

        {[0, 1, 2, 3, 4].map((index) => {
          const value = yMin + ((yMax - yMin) * index) / 4;
          const y = getY(value);
          return (
            <g key={index}>
              <line x1="34" y1={y} x2="744" y2={y} stroke="#475569" strokeDasharray="4 5" opacity="0.22" />
              <text x="742" y={y - 5} textAnchor="end" fill="#94a3b8" fontSize="11">{formatAnalystPrice(value)}</text>
            </g>
          );
        })}

        {model.low !== null && model.high !== null && (
          <>
            <polygon
              points={fanPoints}
              fill="#22c55e"
              opacity="0.18"
              clipPath={`url(#analyst-green-${String(stock?.Ticker || "stock").replace(/[^a-zA-Z0-9]/g, "")})`}
            />
            <polygon
              points={fanPoints}
              fill="#ef4444"
              opacity="0.20"
              clipPath={`url(#analyst-red-${String(stock?.Ticker || "stock").replace(/[^a-zA-Z0-9]/g, "")})`}
            />
          </>
        )}

        {historyPath && (
          <path
            d={historyPath}
            fill="none"
            stroke="#3b82f6"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        <line x1={currentX} y1={top} x2={currentX} y2={bottom} stroke="#94a3b8" strokeDasharray="4 5" opacity="0.45" />
        <line
          x1={historyStartX}
          y1={currentY}
          x2="744"
          y2={currentY}
          stroke="#ffffff"
          strokeWidth="1.6"
          strokeDasharray="5 6"
          opacity="0.82"
        />
        <text x="42" y={currentY - 7} fill="#f8fafc" fontSize="11" fontWeight="800">
          LIVE {formatAnalystPrice(model.current)}
        </text>

        <text x={historyStartX} y={height - 16} textAnchor="start" fill="#94a3b8" fontSize="11">1 YEAR AGO</text>
        <text x={currentX} y={height - 16} textAnchor="middle" fill="#94a3b8" fontSize="11">TODAY</text>
        <text x={forecastX} y={height - 16} textAnchor="middle" fill="#94a3b8" fontSize="11">12-MONTH TARGETS</text>

        {model.low !== null && <line x1={currentX} y1={currentY} x2={forecastX} y2={lowY} stroke={targetColor(model.low)} strokeWidth="1.9" strokeDasharray="5 5" opacity="0.92" />}
        {model.high !== null && <line x1={currentX} y1={currentY} x2={forecastX} y2={highY} stroke={targetColor(model.high)} strokeWidth="1.9" strokeDasharray="5 5" opacity="0.92" />}
        {model.mean !== null && <line x1={currentX} y1={currentY} x2={forecastX} y2={meanY} stroke={targetColor(model.mean)} strokeWidth="3" />}

        <circle cx={currentX} cy={currentY} r="6" fill="#3b82f6" stroke="#ffffff" strokeWidth="2" />
        <rect x={currentX - 82} y={currentY + 10} width="164" height="28" rx="6" fill="rgba(37,99,235,.92)" />
        <text x={currentX} y={currentY + 29} textAnchor="middle" fill="#fff" fontSize="12" fontWeight="800">
          Current {formatAnalystPrice(model.current)}
        </text>

        {labelRows.map((row) => {
          const pct = targetReturnPercent(row.value, model.current);
          const labelTextColor = row.color === "#ef4444" ? "#fff" : "#052e16";
          return (
            <g key={row.key}>
              <rect x={forecastX - 2} y={row.y - 15} width="72" height="30" rx="5" fill={row.color} opacity="0.92" />
              <text x={forecastX + 34} y={row.y - 1} textAnchor="middle" fill={labelTextColor} fontSize="11" fontWeight="900">{row.key}</text>
              <text x={forecastX + 34} y={row.y + 11} textAnchor="middle" fill={labelTextColor} fontSize="10" fontWeight="800">
                {pct === null ? "--" : `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function QuarterlyEpsChart({ quarterlyHistory, epsEstimates }) {
  const yahooEvents = Array.isArray(epsEstimates?.events) ? epsEstimates.events : [];
  const yahooConsensus = Array.isArray(epsEstimates?.quarterly_consensus)
    ? epsEstimates.quarterly_consensus
    : [];
  const yahooMethodology = String(
    epsEstimates?.methodology ||
      yahooEvents.find((row) => row?.methodology)?.methodology ||
      ""
  ).toLowerCase();
  const methodologyLabel =
    yahooMethodology === "gaap"
      ? "GAAP"
      : yahooMethodology === "nongaap"
      ? "Normalized"
      : "Yahoo";

  const parseDateMs = (value) => {
    if (!value) return null;
    const parsed = new Date(`${String(value).slice(0, 10)}T12:00:00`);
    return Number.isNaN(parsed.getTime()) ? null : parsed.getTime();
  };

  const eventRows = yahooEvents
    .map((row) => ({
      ...row,
      period: row.date || row.period || null,
      actual: numericOrNull(row.eps_actual ?? row.actual),
      estimate: numericOrNull(row.eps_estimate ?? row.estimate),
      dateMs: parseDateMs(row.date || row.period),
      label: row.label || null,
      isFuture:
        row.is_future === true ||
        (numericOrNull(row.eps_actual ?? row.actual) === null &&
          parseDateMs(row.date || row.period) !== null &&
          parseDateMs(row.date || row.period) > Date.now()),
    }))
    .filter((row) => row.actual !== null || row.estimate !== null)
    .sort((a, b) => (a.dateMs ?? 0) - (b.dateMs ?? 0));

  const historicalEvents = eventRows.filter((row) => !row.isFuture && row.actual !== null).slice(-4);

  // Yahoo exposes the upcoming earnings event and the forward consensus table
  // separately. The dated event corresponds to the current/upcoming quarter, so
  // do not also render Yahoo's 0q/current-quarter consensus as a second bubble.
  const upcomingEvent =
    eventRows.find((row) => row.isFuture && row.estimate !== null) || null;

  const forwardConsensusRows = yahooConsensus
    .map((row, index) => {
      const rawPeriodKey = String(row.period_key ?? row.period ?? row.label ?? "");
      const periodKey = rawPeriodKey.toLowerCase().replace(/\s+/g, "");
      const estimate = numericOrNull(row.avg ?? row.eps_estimate ?? row.estimate);
      const isQuarter =
        periodKey.includes("q") || periodKey.includes("quarter") || periodKey === "0" || periodKey === "1";
      if (!isQuarter || estimate === null) return null;

      const isCurrentQuarter =
        periodKey === "0q" ||
        periodKey === "0" ||
        periodKey.includes("currentqtr") ||
        periodKey.includes("currentquarter");
      const isNextQuarter =
        periodKey === "+1q" ||
        periodKey === "1q" ||
        periodKey === "1" ||
        periodKey.includes("nextqtr") ||
        periodKey.includes("nextquarter");

      let label = row.label || null;
      if (isCurrentQuarter) label = "Current Qtr";
      else if (isNextQuarter) label = "Next Qtr";
      else if (!label) label = `Forward Q${index + 1}`;

      return {
        ...row,
        period: null,
        actual: null,
        estimate,
        label,
        consensusKind: isCurrentQuarter ? "current" : isNextQuarter ? "next" : "other",
        isFuture: true,
        dateMs: Number.MAX_SAFE_INTEGER - 10 + index,
      };
    })
    .filter(Boolean);

  const currentConsensus =
    forwardConsensusRows.find((row) => row.consensusKind === "current") || null;
  const nextConsensus =
    forwardConsensusRows.find((row) => row.consensusKind === "next") || null;
  const otherConsensus =
    forwardConsensusRows.find((row) => row.consensusKind === "other") || null;

  // Show exactly one forward quarter. Prefer Yahoo's dated upcoming earnings
  // event, then current-quarter consensus. Only fall back to another quarterly
  // consensus when Yahoo does not provide either of those.
  const forwardEstimate =
    upcomingEvent ||
    (currentConsensus ? { ...currentConsensus, label: "Upcoming Qtr" } : null) ||
    nextConsensus ||
    otherConsensus ||
    null;

  const futureRows = forwardEstimate ? [forwardEstimate] : [];
  const yahooRows = [...historicalEvents, ...futureRows];

  const secRows = (Array.isArray(quarterlyHistory) ? quarterlyHistory : [])
    .map((row) => ({
      ...row,
      actual: numericOrNull(row.eps_diluted) ?? numericOrNull(row.eps_basic),
      estimate: numericOrNull(row.eps_estimate),
      label: null,
      isFuture: false,
    }))
    .filter((row) => row.actual !== null || row.estimate !== null)
    .slice(0, 5)
    .reverse();

  const rows = yahooRows.length ? yahooRows : secRows;

  const cardStyle = {
    border: "1px solid rgba(148, 163, 184, 0.22)",
    borderRadius: 14,
    padding: "18px 18px 16px",
    background: "rgba(255,255,255,0.02)",
    minWidth: 0,
  };

  if (!rows.length) {
    return (
      <div style={cardStyle}>
        <div className="stock-analysis-card-label">Earnings Per Share</div>
        <h3 style={{ margin: "6px 0 8px" }}>Quarterly EPS history unavailable</h3>
        <p style={{ margin: 0, opacity: 0.7 }}>No reported or consensus EPS series was available for this issuer.</p>
      </div>
    );
  }

  const width = 700;
  const height = 300;
  const left = 52;
  const right = 676;
  const top = 42;
  const bottom = 232;
  const values = rows.flatMap((row) => [row.actual, row.estimate]).filter((value) => value !== null);
  const minValue = Math.min(0, ...values);
  const maxValue = Math.max(...values);
  const padding = Math.max((maxValue - minValue) * 0.12, 0.1);
  const yMin = minValue - padding;
  const yMax = maxValue + padding;
  const getY = (value) => bottom - ((value - yMin) / Math.max(yMax - yMin, 0.01)) * (bottom - top);
  const getX = (index) => left + (index / Math.max(rows.length - 1, 1)) * (right - left);
  const actualPoints = rows
    .map((row, index) =>
      row.actual === null ? null : { x: getX(index), y: getY(row.actual) }
    )
    .filter(Boolean);
  const actualPath = actualPoints
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");
  const hasEstimates = rows.some((row) => row.estimate !== null);

  const displayRowLabel = (row) => {
    if (row.label) return row.label;
    if (row.quarter || row.year) return formatQuarterLabel(row);
    if (row.period) {
      const parsed = new Date(`${String(row.period).slice(0, 10)}T12:00:00`);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed.toLocaleDateString(undefined, { month: "short", day: "numeric" });
      }
    }
    return formatQuarterLabel(row);
  };

  return (
    <div style={cardStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div className="stock-analysis-card-label">Earnings Per Share</div>
          <h3 style={{ margin: "6px 0 4px" }}>
            {hasEstimates
              ? `${methodologyLabel} Quarterly EPS: Actual vs. Consensus`
              : `${methodologyLabel} Quarterly EPS Results`}
          </h3>
        </div>
        <div style={{ fontSize: 12, opacity: 0.68 }}>
          <span style={{ color: "#22c55e", fontWeight: 800 }}>● Actual</span>
          {hasEstimates ? <span style={{ marginLeft: 12 }}>○ Analyst Estimate</span> : null}
        </div>
      </div>

      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto", display: "block" }}>
        {[0, 1, 2, 3, 4].map((index) => {
          const value = yMin + ((yMax - yMin) * index) / 4;
          const y = getY(value);
          return (
            <g key={index}>
              <line x1={left} y1={y} x2={right} y2={y} stroke="#64748b" strokeDasharray="4 5" opacity="0.2" />
              <text x={left - 8} y={y + 4} textAnchor="end" fill="#94a3b8" fontSize="11">{value.toFixed(2)}</text>
            </g>
          );
        })}

        {actualPath && <path d={actualPath} fill="none" stroke="#22c55e" strokeWidth="2" opacity="0.4" />}

        {rows.map((row, index) => {
          const x = getX(index);
          const beat = row.actual !== null && row.estimate !== null ? row.actual - row.estimate : null;
          const beatPct =
            beat !== null && row.estimate !== 0
              ? (beat / Math.abs(row.estimate)) * 100
              : null;
          const actualColor = beat !== null && beat < 0 ? "#ef4444" : "#22c55e";
          const isLastColumn = index === rows.length - 1;
          const estimateLabelX = isLastColumn ? x - 14 : x + 15;
          const estimateLabelY = isLastColumn
            ? getY(row.estimate) + 20
            : getY(row.estimate) + 4;
          const estimateLabelAnchor = isLastColumn ? "end" : "start";
          return (
            <g key={`${row.period || row.label || "eps"}-${index}`}>
              {row.estimate !== null && (
                <>
                  <circle cx={x} cy={getY(row.estimate)} r="10" fill="transparent" stroke="#cbd5e1" strokeWidth="3" />
                  <text
                    x={estimateLabelX}
                    y={estimateLabelY}
                    textAnchor={estimateLabelAnchor}
                    fill="#cbd5e1"
                    fontSize="10"
                    fontWeight="800"
                  >
                    {row.estimate.toFixed(2)}
                  </text>
                </>
              )}
              {row.actual !== null && (
                <>
                  <circle cx={x} cy={getY(row.actual)} r="8" fill={actualColor} />
                  <text
                    x={x}
                    y={getY(row.actual) + (beat !== null && beat < 0 ? 22 : -14)}
                    textAnchor="middle"
                    fontSize="11"
                    fontWeight="800"
                  >
                    <tspan fill="#f8fafc">{row.actual.toFixed(2)}</tspan>
                    {beatPct !== null && (
                      <tspan dx="6" fill={beatPct >= 0 ? "#22c55e" : "#ef4444"}>
                        {beatPct >= 0 ? "+" : ""}{beatPct.toFixed(1)}%
                      </tspan>
                    )}
                  </text>
                </>
              )}
              <text x={x} y={bottom + 28} textAnchor="middle" fill="#94a3b8" fontSize="11">{displayRowLabel(row)}</text>
              {beat !== null && <text x={x} y={bottom + 48} textAnchor="middle" fill={beat >= 0 ? "#22c55e" : "#ef4444"} fontSize="11" fontWeight="800">{beat >= 0 ? "Beat" : "Miss"} {beat >= 0 ? "+" : ""}{beat.toFixed(2)}</text>}
              {row.actual === null && row.estimate !== null && <text x={x} y={bottom + 48} textAnchor="middle" fill="#94a3b8" fontSize="11" fontWeight="700">Estimate</text>}
            </g>
          );
        })}
      </svg>

      <p style={{ margin: "4px 0 0", fontSize: 12, opacity: 0.62, lineHeight: 1.45 }}>
        Values mirror Yahoo Finance&apos;s earnings chart using Yahoo&apos;s selected {methodologyLabel} methodology for this ticker. Hollow circles show Yahoo&apos;s analyst estimates; filled circles show Yahoo&apos;s reported EPS. The chart shows only the next upcoming quarter estimate until results are reported.
      </p>
    </div>
  );
}

function RevenueEarningsChart({ quarterlyHistory, reportingCurrency = "USD" }) {
  const rows = (Array.isArray(quarterlyHistory) ? quarterlyHistory : [])
    .map((row) => ({
      ...row,
      revenue: numericOrNull(row.revenue),
      earnings: numericOrNull(row.net_income),
      margin:
        numericOrNull(row.profit_margin) ??
        (numericOrNull(row.revenue) && numericOrNull(row.net_income) !== null
          ? (numericOrNull(row.net_income) / numericOrNull(row.revenue)) * 100
          : null),
    }))
    .filter((row) => row.revenue !== null || row.earnings !== null)
    .slice(0, 4)
    .reverse();

  const cardStyle = {
    border: "1px solid rgba(148, 163, 184, 0.22)",
    borderRadius: 14,
    padding: "18px 18px 16px",
    background: "rgba(255,255,255,0.02)",
    minWidth: 0,
  };

  if (!rows.length) {
    return (
      <div style={cardStyle}>
        <div className="stock-analysis-card-label">Revenue vs. Earnings</div>
        <h3 style={{ margin: "6px 0 8px" }}>Quarterly financial history unavailable</h3>
        <p style={{ margin: 0, opacity: 0.7 }}>No period-aligned SEC revenue or net-income series was available.</p>
      </div>
    );
  }

  const width = 700;
  const height = 300;
  const left = 52;
  const right = 650;
  const top = 50;
  const bottom = 230;
  const groupWidth = (right - left) / rows.length;
  const barWidth = Math.min(34, groupWidth * 0.26);
  const financialValues = rows.flatMap((row) => [row.revenue, row.earnings]).filter((value) => value !== null);
  const minValue = Math.min(0, ...financialValues);
  const maxValue = Math.max(0, ...financialValues);
  const valueSpan = Math.max(maxValue - minValue, 1);
  const getY = (value) => bottom - ((value - minValue) / valueSpan) * (bottom - top);
  const zeroY = getY(0);

  const margins = rows.map((row) => row.margin).filter((value) => value !== null);
  const marginMin = margins.length ? Math.min(0, ...margins) : 0;
  const marginMax = margins.length ? Math.max(10, ...margins) : 10;
  const marginSpan = Math.max(marginMax - marginMin, 1);
  const getMarginY = (value) => bottom - ((value - marginMin) / marginSpan) * (bottom - top);
  const marginPoints = rows
    .map((row, index) => {
      if (row.margin === null) return null;
      const x = left + groupWidth * index + groupWidth / 2;
      return { x, y: getMarginY(row.margin) };
    })
    .filter(Boolean);
  const marginPath = marginPoints
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");

  const compact = (value) => formatLargeMoney(value, reportingCurrency);

  return (
    <div style={cardStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div className="stock-analysis-card-label">Revenue vs. Earnings</div>
          <h3 style={{ margin: "6px 0 4px" }}>Quarterly operating scale & profitability</h3>
        </div>
        <div style={{ fontSize: 12, opacity: 0.72 }}>
          <span style={{ color: "#3b82f6", fontWeight: 800 }}>■ Revenue</span>
          <span style={{ color: "#facc15", fontWeight: 800, marginLeft: 10 }}>■ Net Income</span>
          <span style={{ color: "#22c55e", fontWeight: 800, marginLeft: 10 }}>— Margin</span>
        </div>
      </div>

      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto", display: "block" }}>
        {[0, 1, 2, 3, 4].map((index) => {
          const value = minValue + (valueSpan * index) / 4;
          const y = getY(value);
          return (
            <g key={index}>
              <line x1={left} y1={y} x2={right} y2={y} stroke="#64748b" strokeDasharray="4 5" opacity="0.18" />
              <text x={left - 8} y={y + 4} textAnchor="end" fill="#94a3b8" fontSize="10">{compact(value)}</text>
            </g>
          );
        })}

        <line x1={left} y1={zeroY} x2={right} y2={zeroY} stroke="#64748b" opacity="0.38" />

        {rows.map((row, index) => {
          const centerX = left + groupWidth * index + groupWidth / 2;
          const renderBar = (value, x, fill) => {
            if (value === null) return null;
            const y = getY(value);
            const yTop = Math.min(y, zeroY);
            const barHeight = Math.max(2, Math.abs(zeroY - y));
            return <rect x={x} y={yTop} width={barWidth} height={barHeight} rx="5" fill={fill} opacity="0.9" />;
          };
          return (
            <g key={`${row.period}-${index}`}>
              {renderBar(row.revenue, centerX - barWidth - 4, "#3b82f6")}
              {renderBar(row.earnings, centerX + 4, "#facc15")}
              <text x={centerX} y={bottom + 28} textAnchor="middle" fill="#94a3b8" fontSize="11">{formatQuarterLabel(row)}</text>
              {row.margin !== null && <text x={centerX} y={getMarginY(row.margin) - 10} textAnchor="middle" fill="#22c55e" fontSize="10" fontWeight="800">{row.margin.toFixed(1)}%</text>}
            </g>
          );
        })}

        {marginPath && <path d={marginPath} fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />}
        {rows.map((row, index) => {
          if (row.margin === null) return null;
          const x = left + groupWidth * index + groupWidth / 2;
          return <circle key={`m-${row.period}`} cx={x} cy={getMarginY(row.margin)} r="4" fill="#0f172a" stroke="#22c55e" strokeWidth="2" />;
        })}
      </svg>

      <p style={{ margin: "4px 0 0", fontSize: 12, opacity: 0.62 }}>
        Revenue and net income are normalized from SEC Companyfacts. Margin is net income divided by revenue for the same quarter.
      </p>
    </div>
  );
}

function AnalystSummaryCard({ label, value, tone = "neutral" }) {
  const color = tone === "positive" ? "#22c55e" : tone === "negative" ? "#ef4444" : "inherit";
  return (
    <div className="stock-analysis-card" style={{ minHeight: 92 }}>
      <div className="stock-analysis-card-label">{label}</div>
      <div className="stock-analysis-card-value" style={{ color }}>{value}</div>
    </div>
  );
}

function AnalystsDashboard({
  stock,
  livePrice,
  analystTargets,
  historyPoints,
  quarterlyHistory,
  epsEstimates,
  reportingCurrency,
}) {
  const model = resolveAnalystTargets(stock, livePrice, analystTargets);
  const upside = targetReturnPercent(model.high, model.current);
  const downside = targetReturnPercent(model.low, model.current);

  return (
    <section className="stock-analysis-section stock-analysis-analysts-dashboard">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "end", gap: 14, flexWrap: "wrap", marginBottom: 16 }}>
        <div>
          <div className="stock-analysis-card-label">Analyst Outlook</div>
          <h2 style={{ margin: "5px 0 0" }}>Price Targets, Forecast Range & Earnings Outlook</h2>
        </div>
        <div style={{ fontSize: 12, opacity: 0.68 }}>
          Current price reflects Bullionaire&apos;s live market snapshot.
        </div>
      </div>

      <div className="stock-analysis-grid" style={{ marginBottom: 16 }}>
        <AnalystSummaryCard
          label="Total Analysts"
          value={model.analystCount === null ? "--" : Math.round(model.analystCount).toLocaleString()}
        />
        <AnalystSummaryCard
          label="Analyst Upside"
          value={upside === null ? "--" : `${upside >= 0 ? "+" : ""}${upside.toFixed(2)}%`}
          tone={upside !== null && upside >= 0 ? "positive" : "negative"}
        />
        <AnalystSummaryCard
          label="Analyst Downside"
          value={downside === null ? "--" : `${downside >= 0 ? "+" : ""}${downside.toFixed(2)}%`}
          tone={downside !== null && downside >= 0 ? "positive" : "negative"}
        />
        <AnalystSummaryCard
          label="Average Target"
          value={formatAnalystPrice(model.mean)}
          tone="neutral"
        />
      </div>

      <div
  className="stock-analysis-analysts-grid"
  style={{
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))",
    gap: 16,
  }}
>
        <AnalystTargetRangeCard stock={stock} livePrice={livePrice} analystTargets={analystTargets} />
        <AnalystForecastFan stock={stock} livePrice={livePrice} analystTargets={analystTargets} historyPoints={historyPoints} />
      </div>

      <div
  className="stock-analysis-analysts-grid"
  style={{
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))",
    gap: 16,
    marginTop: 16,
  }}
>
        <QuarterlyEpsChart quarterlyHistory={quarterlyHistory} epsEstimates={epsEstimates} />
        <RevenueEarningsChart quarterlyHistory={quarterlyHistory} reportingCurrency={reportingCurrency} />
      </div>
    </section>
  );
}

function SimpleChart({ points }) {
  const chartPoints = useMemo(() => {
    if (!Array.isArray(points)) return [];
    return points.filter((p) => p.close !== null && p.close !== undefined);
  }, [points]);

  if (!chartPoints.length) {
    return (
      <div className="stock-analysis-empty">
        No chart data available for this range.
      </div>
    );
  }

  const width = 900;
  const height = 300;
  const pad = 28;

  const closes = chartPoints.map((p) => Number(p.close));
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const range = max - min || 1;

  const getX = (index) =>
    pad + (index / Math.max(chartPoints.length - 1, 1)) * (width - pad * 2);

  const getY = (price) =>
    height - pad - ((price - min) / range) * (height - pad * 2);

  const path = chartPoints
    .map((point, index) => {
      const x = getX(index);
      const y = getY(Number(point.close));
      return `${index === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");

  const first = closes[0];
  const last = closes[closes.length - 1];
  const isUp = last >= first;

  return (
    <svg
      className="stock-analysis-chart"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
    >
      <line
        x1={pad}
        y1={getY(first)}
        x2={width - pad}
        y2={getY(first)}
        stroke="#64748b"
        strokeDasharray="4 4"
        opacity="0.6"
      />

      <path
        d={path}
        fill="none"
        stroke={isUp ? "#19C37D" : "#dc2626"}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <text x={width - pad + 6} y={getY(last) + 4} fill="#e5e7eb" fontSize="13">
        {last.toFixed(2)}
      </text>
    </svg>
  );
}

function SnapshotScore({ score }) {
  const safeScore = Number(score ?? 0);

  return (
    <div className="stock-analysis-score-card">
      <div>
        <div className="stock-analysis-card-label">
          Bullionaire Snapshot Score
        </div>
        <div className="stock-analysis-score-label">
          {getScoreLabel(safeScore)}
        </div>
      </div>

      <div className="stock-analysis-score-circle">{safeScore}</div>
    </div>
  );
}

function BadgeList({ badges }) {
  if (!Array.isArray(badges) || !badges.length) return null;

  return (
    <div className="stock-analysis-badges">
      {badges.map((badge, index) => (
        <div
          key={`${badge.label}-${index}`}
          className={`stock-analysis-badge ${badge.tone || "neutral"}`}
          title={badge.detail || ""}
        >
          {badge.label}
        </div>
      ))}
    </div>
  );
}

function ComparisonCard({
  label,
  stockValue,
  peerValue,
  difference,
  suffix = "",
}) {
  return (
    <div className="stock-analysis-comparison-card">
      <div className="stock-analysis-card-label">{label}</div>

      <div className="stock-analysis-comparison-row">
        <span>Stock</span>
        <strong>{formatValue(stockValue, suffix)}</strong>
      </div>

      <div className="stock-analysis-comparison-row">
        <span>Peer Median</span>
        <strong>{formatValue(peerValue, suffix)}</strong>
      </div>

      <div className="stock-analysis-comparison-diff">
        {formatSignedPercent(difference)} vs peer median
      </div>
    </div>
  );
}

function TabButton({ tab, activeTab, setActiveTab }) {
  const handleClick = (e) => {
    setActiveTab(tab);

    if (window.matchMedia("(max-width: 768px)").matches) {
      e.currentTarget.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center",
      });
    }
  };

  return (
    <button
      type="button"
      className={activeTab === tab ? "stock-analysis-tab active" : "stock-analysis-tab"}
      onClick={handleClick}
    >
      {tab}
    </button>
  );
}

function GrowthPlaceholder() {
  return (
    <div className="stock-analysis-growth-placeholder">
      <div className="stock-analysis-card-label">Growth Data Coming Soon</div>
      <h3>Historical and projected growth rates will live here.</h3>
      <p>
        This section is ready for revenue growth, EPS growth, EBITDA growth,
        free cash flow growth, and forward analyst growth estimates once your
        Yahoo enrichment script pulls deeper financial history.
      </p>

      <div className="stock-analysis-grid">
        <MetricCard label="Revenue Growth YoY" value="Coming soon" />
        <MetricCard label="EPS Growth YoY" value="Coming soon" />
        <MetricCard label="3Y Revenue CAGR" value="Coming soon" />
        <MetricCard label="Projected EPS Growth" value="Coming soon" />
      </div>
    </div>
  );
}


const FinancialsAccordionContext = React.createContext({
  command: null,
});

function FinancialsAccordion({ children }) {
  const [command, setCommand] = useState(null);

  const issueCommand = (type) => {
    setCommand((current) => ({
      type,
      id: (current?.id || 0) + 1,
    }));
  };

  return (
    <FinancialsAccordionContext.Provider value={{ command }}>
      <div
        className="stock-analysis-section"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
          paddingTop: 14,
          paddingBottom: 14,
        }}
      >
        <div>
          <div className="stock-analysis-card-label">Financials Navigation</div>
          <strong>Open only the sections you want to inspect.</strong>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => issueCommand("expand")}
            style={{
              border: "1px solid rgba(148, 163, 184, 0.35)",
              background: "transparent",
              color: "inherit",
              borderRadius: 8,
              padding: "8px 12px",
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            Expand All
          </button>

          <button
            type="button"
            onClick={() => issueCommand("collapse")}
            style={{
              border: "1px solid rgba(148, 163, 184, 0.35)",
              background: "transparent",
              color: "inherit",
              borderRadius: 8,
              padding: "8px 12px",
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            Collapse All
          </button>
        </div>
      </div>

      {children}
    </FinancialsAccordionContext.Provider>
  );
}


const FINANCIAL_SECTION_COLORS = {
  health: "#22c55e",
  source: "#64748b",
  growth: "#3b82f6",
  quality: "#10b981",
  balance: "#06b6d4",
  annual: "#f59e0b",
  history: "#8b5cf6",
  ttm: "#6366f1",
  quarter: "#0ea5e9",
  visibility: "#f59e0b",
  filing: "#a855f7",
  segments: "#8b5cf6",
  markets: "#ec4899",
  geography: "#06b6d4",
  customers: "#f97316",
  valuation: "#FFFF00",
};

function FinancialSectionIcon({ name = "chart", color = "#64748b" }) {
  const common = {
    width: 18,
    height: 18,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.9,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": "true",
  };

  const paths = {
    health: (
      <>
        <path d="M20.8 5.8a5.3 5.3 0 0 0-7.5 0L12 7.1l-1.3-1.3a5.3 5.3 0 0 0-7.5 7.5L12 22l8.8-8.7a5.3 5.3 0 0 0 0-7.5Z" />
        <path d="M7.5 13h2.2l1.2-2.4 2 4 1.2-2.1h2.4" />
      </>
    ),
    source: (
      <>
        <ellipse cx="12" cy="5" rx="8" ry="3" />
        <path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5" />
        <path d="M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" />
      </>
    ),
    growth: (
      <>
        <path d="M4 18V6" />
        <path d="M4 18h16" />
        <path d="m7 14 4-4 3 2 5-6" />
        <path d="M16 6h3v3" />
      </>
    ),
    quality: (
      <>
        <circle cx="12" cy="12" r="8" />
        <path d="M12 7v10" />
        <path d="M15 9.5c0-1.1-1.3-2-3-2s-3 .9-3 2 1.3 2 3 2 3 .9 3 2-1.3 2-3 2-3-.9-3-2" />
      </>
    ),
    balance: (
      <>
        <path d="M12 3v18" />
        <path d="M5 6h14" />
        <path d="m7 6-3 6h6L7 6Z" />
        <path d="m17 6-3 6h6l-3-6Z" />
        <path d="M8 21h8" />
      </>
    ),
    calendar: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M7 3v4M17 3v4M3 10h18" />
      </>
    ),
    history: (
      <>
        <path d="M3 12a9 9 0 1 0 3-6.7" />
        <path d="M3 4v5h5" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    quarter: (
      <>
        <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
      </>
    ),
    visibility: (
      <>
        <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
        <circle cx="12" cy="12" r="2.5" />
      </>
    ),
    filing: (
      <>
        <path d="M6 3h9l3 3v15H6z" />
        <path d="M14 3v4h4M9 11h6M9 15h6" />
      </>
    ),
    segments: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </>
    ),
    geography: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3c2.4 2.5 3.5 5.5 3.5 9S14.4 18.5 12 21M12 3C9.6 5.5 8.5 8.5 8.5 12S9.6 18.5 12 21" />
      </>
    ),
    customers: (
      <>
        <circle cx="9" cy="8" r="3" />
        <circle cx="17" cy="9" r="2.2" />
        <path d="M3 20c.5-4 2.6-6 6-6s5.5 2 6 6" />
        <path d="M14 15c3.5-.6 6 1.1 7 4" />
      </>
    ),
    valuation: (
      <>
        <path d="M4 19h16" />
        <path d="M6 16V9M12 16V5M18 16v-4" />
        <path d="M5 6h3M16 8h4" />
      </>
    ),
  };

  return (
    <span
      style={{
        width: 34,
        height: 34,
        flex: "0 0 auto",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 10,
        color,
        background: `${color}14`,
        border: `1px solid ${color}32`,
      }}
    >
      <svg {...common}>{paths[name] || paths.growth}</svg>
    </span>
  );
}

function CollapsibleSection({
  title,
  children,
  defaultOpen = false,
  hidden = false,
  className = "stock-analysis-sec-subsection",
  headingLevel = 3,
  accent = "#64748b",
  badge = null,
  summary = null,
  icon = "growth",
}) {
  const { command } = React.useContext(FinancialsAccordionContext);
  const [open, setOpen] = useState(defaultOpen);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    if (command?.type === "expand") {
      setOpen(true);
    } else if (command?.type === "collapse") {
      setOpen(false);
    }
  }, [command]);

  if (hidden) return null;

  const emphasized = open || hovered;

  return (
    <div
      className={className}
      style={{
        position: "relative",
        overflow: "hidden",
        border: `1px solid ${emphasized ? `${accent}58` : "rgba(148, 163, 184, 0.18)"}`,
        borderRadius: 13,
        padding: "13px 15px 13px 18px",
        marginBottom: 10,
        background: open
          ? `linear-gradient(90deg, ${accent}14 0%, rgba(15, 23, 42, 0.26) 42%, rgba(15, 23, 42, 0.18) 100%)`
          : hovered
          ? `linear-gradient(90deg, ${accent}0c 0%, rgba(15, 23, 42, 0.22) 45%, rgba(15, 23, 42, 0.18) 100%)`
          : "rgba(15, 23, 42, 0.18)",
        transform: hovered && !open ? "translateY(-1px)" : "translateY(0)",
        boxShadow: open ? `0 0 0 1px ${accent}0b inset` : "none",
        transition:
          "border-color 180ms ease, background 180ms ease, transform 180ms ease, box-shadow 180ms ease",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: 4,
          background: accent,
          opacity: open ? 1 : hovered ? 0.9 : 0.66,
          boxShadow: open ? `0 0 18px ${accent}55` : "none",
          transition: "opacity 180ms ease, box-shadow 180ms ease",
        }}
      />

      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onFocus={() => setHovered(true)}
        onBlur={() => setHovered(false)}
        aria-expanded={open}
        style={{
          width: "100%",
          minHeight: 42,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          border: 0,
          background: "transparent",
          color: "inherit",
          padding: 0,
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <span
          style={{
            minWidth: 0,
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <FinancialSectionIcon name={icon} color={accent} />

          <span
            role="heading"
            aria-level={headingLevel}
            style={{
              minWidth: 0,
              fontSize: headingLevel === 2 ? "1.22rem" : "1.04rem",
              lineHeight: 1.3,
              fontWeight: 800,
            }}
          >
            {title}
          </span>
        </span>

        <span
          style={{
            minWidth: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          {summary && (
            <span
              style={{
                color: "rgba(203, 213, 225, 0.78)",
                fontSize: "0.83rem",
                fontWeight: 650,
                whiteSpace: "nowrap",
              }}
            >
              {summary}
            </span>
          )}

          {badge && (
            <span
              style={{
                padding: "5px 8px",
                borderRadius: 999,
                border: `1px solid ${accent}3f`,
                background: `${accent}13`,
                color: accent,
                fontSize: "0.68rem",
                fontWeight: 900,
                letterSpacing: "0.08em",
                lineHeight: 1,
                whiteSpace: "nowrap",
              }}
            >
              {badge}
            </span>
          )}

          <span
            aria-hidden="true"
            style={{
              flex: "0 0 auto",
              width: 32,
              height: 32,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              border: `1px solid ${emphasized ? `${accent}55` : "rgba(148, 163, 184, 0.24)"}`,
              borderRadius: 9,
              background: emphasized ? `${accent}13` : "rgba(15, 23, 42, 0.46)",
              color: emphasized ? accent : "rgba(226, 232, 240, 0.82)",
              transition:
                "border-color 180ms ease, background 180ms ease, color 180ms ease",
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                transform: open ? "rotate(90deg)" : "rotate(0deg)",
                transition: "transform 200ms ease",
              }}
            >
              <path d="m9 18 6-6-6-6" />
            </svg>
          </span>
        </span>
      </button>

      {open && (
        <div
          style={{
            marginTop: 15,
            paddingTop: 15,
            borderTop: `1px solid ${accent}22`,
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}

function hasPresentValue(object, keys) {
  return keys.some((key) => {
    const value = object?.[key];
    return value !== null && value !== undefined && value !== "";
  });
}

function FinancialHealthCard({ health }) {
  if (!health) return null;

  const healthScore = Number(health.score);
  const healthAccent =
    !Number.isNaN(healthScore) && healthScore >= 75
      ? "#22c55e"
      : !Number.isNaN(healthScore) && healthScore >= 50
      ? "#f59e0b"
      : "#ef4444";

  return (
    <CollapsibleSection
      title="Financial Health"
      accent={healthAccent}
      badge={String(health.label || "Unrated").toUpperCase()}
      summary={
        health.score !== null && health.score !== undefined
          ? `${health.score} / 100`
          : null
      }
      icon="health"
    >
      <div className="stock-analysis-financial-health-card">
        <div>
          <div className="stock-analysis-card-label">Financial Statement Health</div>
          <h3>{health.label || "Unrated"} Financial Quality</h3>

          <p>
            This score measures financial statement strength only: growth, margins,
            cash flow quality, leverage, balance sheet strength, and profitability.
            It does not include valuation, beta, technical risk, or market sentiment.
          </p>
        </div>

        <div className="stock-analysis-health-score">
          <strong>{health.score ?? "--"}</strong>
          <span>/ 100</span>
        </div>

        <div className="stock-analysis-health-lists">
          <div>
            <h4>Strengths</h4>
            {health.positives?.length ? (
              <ul>
                {health.positives.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            ) : (
              <p>No major strengths detected yet.</p>
            )}
          </div>

          <div>
            <h4>Watch Items</h4>
            {health.warnings?.length ? (
              <ul>
                {health.warnings.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            ) : (
              <p>No major financial warnings detected.</p>
            )}
          </div>
        </div>
      </div>
    </CollapsibleSection>
  );
}


function SecFinancialsPanel({ data, loading, error }) {
  if (loading) {
    return (
      <div className="stock-analysis-sec-empty">
        Loading SEC financials...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="stock-analysis-sec-empty">
        <h3>SEC Financials Not Available</h3>
        <p>{error || "No SEC financial statement data found for this ticker."}</p>
      </div>
    );
  }

  const annual = Array.isArray(data.annual) ? data.annual : [];
  const latest = annual[0] || {};
  const growth = data.growth || {};
  const health = data.financial_health;
  const reportingCurrency = data.reporting_currency || "USD";
  const isFinancialInstitution = data.analysis_profile === "financial_institution";
  const coverageStatus = data.coverage_status || (annual.length ? "partial" : "unavailable");

  const hasGrowth = hasPresentValue(growth, [
    "revenue_yoy",
    "revenue_3y_cagr",
    "revenue_5y_history_cagr",
    "net_income_yoy",
    "net_income_3y_cagr",
    "net_income_5y_history_cagr",
    "free_cash_flow_yoy",
    "free_cash_flow_3y_cagr",
    "free_cash_flow_5y_history_cagr",
    "operating_cash_flow_yoy",
    "operating_cash_flow_3y_cagr",
    "operating_cash_flow_5y_history_cagr",
  ]);

  const hasProfitability = hasPresentValue(
    latest,
    isFinancialInstitution
      ? [
          "net_margin",
          "return_on_assets",
          "return_on_equity",
          "equity_ratio",
          "loans_to_deposits",
          "allowance_to_loans",
          "book_value_per_share",
        ]
      : [
          "gross_margin",
          "operating_margin",
          "net_margin",
          "fcf_margin",
          "ocf_margin",
          "fcf_conversion",
          "income_quality_ratio",
          "capex_intensity",
          "return_on_assets",
          "return_on_equity",
          "asset_turnover",
        ]
  );

  const hasBalanceSheetStrength = hasPresentValue(
    latest,
    isFinancialInstitution
      ? [
          "assets",
          "liabilities",
          "equity",
          "deposits",
          "loans",
          "allowance_for_credit_losses",
          "loans_to_deposits",
          "equity_ratio",
        ]
      : [
          "cash",
          "debt",
          "net_debt",
          "net_cash",
          "cash_to_debt",
          "cash_to_assets",
          "debt_to_equity",
          "debt_to_assets",
          "liabilities_to_assets",
          "equity_ratio",
        ]
  );

  const hasLatestAnnual = hasPresentValue(latest, [
    "revenue",
    "gross_profit",
    "operating_income",
    "net_income",
    "net_interest_income",
    "noninterest_income",
    "provision_for_credit_losses",
    "operating_cash_flow",
    "capex",
    "free_cash_flow",
    "revenue_per_share",
    "fcf_per_share",
    "shares",
    "assets",
    "liabilities",
    "equity",
    "deposits",
    "loans",
  ]);

  return (
    <div className="stock-analysis-sec-financials">
      <div className="stock-analysis-sec-header">
        <div>
          <div className="stock-analysis-card-label">SEC Companyfacts</div>
          <h3>{data.entity_name || data.ticker} Financial Intelligence</h3>
          <p>
            Annual values are pulled from SEC XBRL data and normalized by Bullionaire.
            {isFinancialInstitution
              ? " Financial institutions use bank-appropriate profitability, capital and funding metrics instead of industrial-company FCF/leverage rules."
              : " Operating companies are converted into growth, quality, profitability, leverage and cash-flow metrics."}
          </p>
        </div>

        <div className="stock-analysis-sec-cik">
          <span>CIK</span>
          <strong>{data.cik || "--"}</strong>
        </div>
      </div>

      <FinancialHealthCard health={health} />

      <CollapsibleSection
        title="SEC Data Source"
        accent={FINANCIAL_SECTION_COLORS.source}
        badge="SOURCE"
        summary={`${reportingCurrency} · ${formatFiscalYear(latest)}`}
        icon="source"
      >
        <div className="stock-analysis-grid">
          <MetricCard
            label="Statement Basis"
            value={data.taxonomy === "ifrs-full" ? "SEC IFRS periodic filings" : "SEC 10-K / FY"}
          />
          <MetricCard
            label="Coverage"
            value={
              coverageStatus === "full"
                ? "Full core annual coverage"
                : coverageStatus === "partial"
                ? "Partial core annual coverage"
                : "Unavailable"
            }
          />
          <MetricCard label="Reporting Currency" value={reportingCurrency} />
          <MetricCard label="Latest Fiscal Year" value={formatFiscalYear(latest)} />
          <MetricCard
            label="Latest Period End"
            value={formatDate(
              latest.revenue_end ||
                latest.net_income_end ||
                latest.operating_cash_flow_end ||
                latest.assets_end
            )}
          />
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title="Growth Dashboard"
        hidden={!hasGrowth}
        accent={FINANCIAL_SECTION_COLORS.growth}
        badge="GROWTH"
        summary={
          growth.revenue_yoy !== null && growth.revenue_yoy !== undefined
            ? `Revenue ${formatSignedPercent(growth.revenue_yoy)} YoY`
            : null
        }
        icon="growth"
      >
        <div className="stock-analysis-grid">
          <MetricCard label="Revenue YoY" value={formatSignedPercent(growth.revenue_yoy)} />
          <MetricCard label="Revenue 3Y CAGR" value={formatSignedPercent(growth.revenue_3y_cagr)} />
          <MetricCard label="Revenue 5Y History CAGR" value={formatSignedPercent(growth.revenue_5y_history_cagr)} />

          <MetricCard label="Net Income YoY" value={formatSignedPercent(growth.net_income_yoy)} />
          <MetricCard label="Net Income 3Y CAGR" value={formatSignedPercent(growth.net_income_3y_cagr)} />
          <MetricCard label="Net Income 5Y History CAGR" value={formatSignedPercent(growth.net_income_5y_history_cagr)} />

          {!isFinancialInstitution && (
            <>
              <MetricCard label="FCF YoY" value={formatSignedPercent(growth.free_cash_flow_yoy)} />
              <MetricCard label="FCF 3Y CAGR" value={formatSignedPercent(growth.free_cash_flow_3y_cagr)} />
              <MetricCard label="FCF 5Y History CAGR" value={formatSignedPercent(growth.free_cash_flow_5y_history_cagr)} />
              <MetricCard label="Operating Cash Flow YoY" value={formatSignedPercent(growth.operating_cash_flow_yoy)} />
              <MetricCard label="OCF 3Y CAGR" value={formatSignedPercent(growth.operating_cash_flow_3y_cagr)} />
              <MetricCard label="OCF 5Y History CAGR" value={formatSignedPercent(growth.operating_cash_flow_5y_history_cagr)} />
            </>
          )}
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title={
          isFinancialInstitution
            ? "Bank Profitability & Capital Quality"
            : "Profitability & Cash Flow Quality"
        }
        hidden={!hasProfitability}
        accent={FINANCIAL_SECTION_COLORS.quality}
        badge="QUALITY"
        summary={
          latest.net_margin !== null && latest.net_margin !== undefined
            ? `Net Margin ${formatPercent(latest.net_margin)}`
            : latest.return_on_equity !== null && latest.return_on_equity !== undefined
            ? `ROE ${formatPercent(latest.return_on_equity)}`
            : null
        }
        icon="quality"
      >
        <div className="stock-analysis-grid">
          {isFinancialInstitution ? (
            <>
              <MetricCard label="Net Margin" value={formatPercent(latest.net_margin)} />
              <MetricCard label="Return on Assets" value={formatPercent(latest.return_on_assets)} />
              <MetricCard label="Return on Equity" value={formatPercent(latest.return_on_equity)} />
              <MetricCard label="Equity / Assets" value={formatPercent(latest.equity_ratio)} />
              <MetricCard label="Loans / Deposits" value={formatPercent(latest.loans_to_deposits)} />
              <MetricCard label="Allowance / Loans" value={formatPercent(latest.allowance_to_loans)} />
              <MetricCard
                label="Book Value / Share"
                value={formatLargeMoney(latest.book_value_per_share, reportingCurrency)}
              />
            </>
          ) : (
            <>
              <MetricCard label="Gross Margin" value={formatPercent(latest.gross_margin)} />
              <MetricCard label="Operating Margin" value={formatPercent(latest.operating_margin)} />
              <MetricCard label="Net Margin" value={formatPercent(latest.net_margin)} />
              <MetricCard label="FCF Margin" value={formatPercent(latest.fcf_margin)} />
              <MetricCard label="OCF Margin" value={formatPercent(latest.ocf_margin)} />
              <MetricCard label="FCF Conversion" value={formatPercent(latest.fcf_conversion)} />
              <MetricCard label="Income Quality Ratio" value={formatRatio(latest.income_quality_ratio)} />
              <MetricCard label="CapEx Intensity" value={formatPercent(latest.capex_intensity)} />
              <MetricCard label="ROA" value={formatPercent(latest.return_on_assets)} />
              <MetricCard label="ROE" value={formatPercent(latest.return_on_equity)} />
              <MetricCard label="Asset Turnover" value={formatRatio(latest.asset_turnover)} />
            </>
          )}
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title={isFinancialInstitution ? "Balance Sheet & Funding" : "Balance Sheet Strength"}
        hidden={!hasBalanceSheetStrength}
        accent={FINANCIAL_SECTION_COLORS.balance}
        badge={isFinancialInstitution ? "FUNDING" : "BALANCE SHEET"}
        summary={
          isFinancialInstitution
            ? latest.equity_ratio !== null && latest.equity_ratio !== undefined
              ? `Equity / Assets ${formatPercent(latest.equity_ratio)}`
              : null
            : latest.net_cash !== null && latest.net_cash !== undefined
            ? `Net Cash ${formatLargeMoney(latest.net_cash, reportingCurrency)}`
            : latest.cash !== null && latest.cash !== undefined
            ? `Cash ${formatLargeMoney(latest.cash, reportingCurrency)}`
            : null
        }
        icon="balance"
      >
        <div className="stock-analysis-grid">
          {isFinancialInstitution ? (
            <>
              <MetricCard label="Assets" value={formatLargeMoney(latest.assets, reportingCurrency)} />
              <MetricCard label="Liabilities" value={formatLargeMoney(latest.liabilities, reportingCurrency)} />
              <MetricCard label="Equity" value={formatLargeMoney(latest.equity, reportingCurrency)} />
              <MetricCard label="Deposits" value={formatLargeMoney(latest.deposits, reportingCurrency)} />
              <MetricCard label="Loans" value={formatLargeMoney(latest.loans, reportingCurrency)} />
              <MetricCard
                label="Allowance for Credit Losses"
                value={formatLargeMoney(latest.allowance_for_credit_losses, reportingCurrency)}
              />
              <MetricCard label="Loans / Deposits" value={formatPercent(latest.loans_to_deposits)} />
              <MetricCard label="Equity / Assets" value={formatPercent(latest.equity_ratio)} />
            </>
          ) : (
            <>
              <MetricCard label="Cash" value={formatLargeMoney(latest.cash, reportingCurrency)} />
              <MetricCard label="Debt" value={formatLargeMoney(latest.debt, reportingCurrency)} />
              <MetricCard label="Net Debt" value={formatLargeMoney(latest.net_debt, reportingCurrency)} />
              <MetricCard label="Net Cash" value={formatLargeMoney(latest.net_cash, reportingCurrency)} />
              <MetricCard label="Cash / Debt" value={formatRatio(latest.cash_to_debt)} />
              <MetricCard label="Cash / Assets" value={formatPercent(latest.cash_to_assets)} />
              <MetricCard label="Debt / Equity" value={formatRatio(latest.debt_to_equity)} />
              <MetricCard label="Debt / Assets" value={formatPercent(latest.debt_to_assets)} />
              <MetricCard label="Liabilities / Assets" value={formatPercent(latest.liabilities_to_assets)} />
              <MetricCard label="Equity Ratio" value={formatPercent(latest.equity_ratio)} />
            </>
          )}
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title="Latest Annual Financials"
        hidden={!hasLatestAnnual}
        accent={FINANCIAL_SECTION_COLORS.annual}
        badge="ANNUAL"
        summary={
          latest.revenue !== null && latest.revenue !== undefined
            ? `${formatFiscalYear(latest)} · Revenue ${formatLargeMoney(latest.revenue, reportingCurrency)}`
            : formatFiscalYear(latest)
        }
        icon="calendar"
      >
        <div className="stock-analysis-grid">
          <MetricCard label="Revenue" value={formatLargeMoney(latest.revenue, reportingCurrency)} />
          <MetricCard label="Gross Profit" value={formatLargeMoney(latest.gross_profit, reportingCurrency)} />
          <MetricCard label="Operating Income" value={formatLargeMoney(latest.operating_income, reportingCurrency)} />
          <MetricCard label="Net Income" value={formatLargeMoney(latest.net_income, reportingCurrency)} />

          {isFinancialInstitution && (
            <>
              <MetricCard label="Net Interest Income" value={formatLargeMoney(latest.net_interest_income, reportingCurrency)} />
              <MetricCard label="Noninterest Income" value={formatLargeMoney(latest.noninterest_income, reportingCurrency)} />
              <MetricCard
                label="Provision for Credit Losses"
                value={formatLargeMoney(latest.provision_for_credit_losses, reportingCurrency)}
              />
              <MetricCard label="Deposits" value={formatLargeMoney(latest.deposits, reportingCurrency)} />
              <MetricCard label="Loans" value={formatLargeMoney(latest.loans, reportingCurrency)} />
            </>
          )}

          {!isFinancialInstitution && (
            <>
              <MetricCard
                label="Operating Cash Flow"
                value={formatLargeMoney(latest.operating_cash_flow, reportingCurrency)}
              />
              <MetricCard label="CapEx" value={formatLargeMoney(latest.capex, reportingCurrency)} />
              <MetricCard label="Free Cash Flow" value={formatLargeMoney(latest.free_cash_flow, reportingCurrency)} />
            </>
          )}

          <MetricCard label="Revenue / Share" value={formatLargeMoney(latest.revenue_per_share, reportingCurrency)} />
          <MetricCard label="FCF / Share" value={formatLargeMoney(latest.fcf_per_share, reportingCurrency)} />
          <MetricCard label="Shares Diluted" value={formatLargeNumber(latest.shares)} />
          <MetricCard label="Assets" value={formatLargeMoney(latest.assets, reportingCurrency)} />
          <MetricCard label="Liabilities" value={formatLargeMoney(latest.liabilities, reportingCurrency)} />
          <MetricCard label="Equity" value={formatLargeMoney(latest.equity, reportingCurrency)} />
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title="6-Year Annual Financials"
        hidden={!annual.length}
        accent={FINANCIAL_SECTION_COLORS.history}
        badge="HISTORY"
        summary={annual.length ? `${annual.length} fiscal years` : null}
        icon="history"
      >
        <div className="stock-analysis-table-wrap">
          <table className="stock-analysis-table">
            <thead>
              <tr>
                <th>FY</th>
                <th>Period End</th>
                <th>Revenue</th>
                <th>Net Income</th>
                <th>FCF</th>
                <th>Gross Margin</th>
                <th>Operating Margin</th>
                <th>FCF Margin</th>
                <th>OCF Margin</th>
                <th>CapEx Intensity</th>
                <th>FCF Conversion</th>
                <th>ROA</th>
                <th>ROE</th>
                <th>Cash / Debt</th>
                <th>Debt / Assets</th>
                <th>Net Cash</th>
              </tr>
            </thead>

            <tbody>
              {annual.map((row) => (
                <tr key={row.year}>
                  <td>{formatFiscalYear(row)}</td>
                  <td>{formatDate(row.revenue_end || row.net_income_end || row.assets_end)}</td>
                  <td>{formatLargeMoney(row.revenue, reportingCurrency)}</td>
                  <td>{formatLargeMoney(row.net_income, reportingCurrency)}</td>
                  <td>{formatLargeMoney(row.free_cash_flow, reportingCurrency)}</td>
                  <td>{formatPercent(row.gross_margin)}</td>
                  <td>{formatPercent(row.operating_margin)}</td>
                  <td>{formatPercent(row.fcf_margin)}</td>
                  <td>{formatPercent(row.ocf_margin)}</td>
                  <td>{formatPercent(row.capex_intensity)}</td>
                  <td>{formatPercent(row.fcf_conversion)}</td>
                  <td>{formatPercent(row.return_on_assets)}</td>
                  <td>{formatPercent(row.return_on_equity)}</td>
                  <td>{formatRatio(row.cash_to_debt)}</td>
                  <td>{formatPercent(row.debt_to_assets)}</td>
                  <td>{formatLargeMoney(row.net_cash, reportingCurrency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CollapsibleSection>

      <div className="stock-analysis-sec-note">
        SEC annual data is based on reported 10-K/FY companyfacts.
        {latest.revenue_source && (
          <> Revenue source: {latest.revenue_source.replaceAll("_", " ")}.</>
        )}
      </div>
    </div>
  );
}


function BreakdownTable({
  title,
  rows,
  valueLabel = "Revenue",
  reportingCurrency = "USD",
  accent = FINANCIAL_SECTION_COLORS.segments,
  badge = "BREAKDOWN",
  icon = "segments",
}) {
  if (!Array.isArray(rows) || !rows.length) return null;

  return (
    <CollapsibleSection
      title={title}
      accent={accent}
      badge={badge}
      summary={`${rows.length} ${rows.length === 1 ? "item" : "items"}`}
      icon={icon}
    >
      <div className="stock-analysis-table-wrap">
        <table className="stock-analysis-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>{valueLabel}</th>
              <th>Prior Period</th>
              <th>YoY Growth</th>
              <th>Mix</th>
            </tr>
          </thead>

          <tbody>
            {rows.map((row, index) => (
              <tr key={`${title}-${row.name}-${index}`}>
                <td>{row.name}</td>
                <td>{formatLargeMoney(row.revenue, reportingCurrency)}</td>
                <td>{formatLargeMoney(row.prior_period_revenue, reportingCurrency)}</td>
                <td>{formatSignedPercent(row.yoy_growth)}</td>
                <td>{formatPercent(row.mix_pct)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </CollapsibleSection>
  );
}

function FilingIntelligencePanel({ data, loading, error, reportingCurrency = "USD" }) {
  if (loading) {
    return (
      <div className="stock-analysis-sec-empty">
        Loading SEC filing intelligence...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="stock-analysis-sec-empty">
        <h3>Filing Intelligence Not Available</h3>
        <p>{error || "No filing-level intelligence was detected for this ticker."}</p>
      </div>
    );
  }

  const customerConcentration = data.customer_concentration || {};
  const insights = data.insights || {};
  const summary = Array.isArray(insights.summary) ? insights.summary : [];
  const customers = Array.isArray(customerConcentration.customers)
    ? customerConcentration.customers
    : [];

  const hasCustomerConcentration =
    customers.length > 0 ||
    Number(customerConcentration.number_of_10pct_customers || 0) > 0 ||
    customerConcentration.largest_customer_pct !== null &&
      customerConcentration.largest_customer_pct !== undefined ||
    customerConcentration.second_largest_customer_pct !== null &&
      customerConcentration.second_largest_customer_pct !== undefined;

  return (
    <div className="stock-analysis-sec-deep-dive">
      <div className="stock-analysis-sec-header">
        <div>
          <div className="stock-analysis-card-label">SEC Filing Intelligence</div>
          <h3>{data.entity_name || data.ticker} Business Breakdown</h3>
          <p>
            This section reads the company&apos;s actual SEC filing text to pull
            revenue visibility, reportable segments, end markets, geographic
            exposure, and customer concentration when those disclosures are available.
          </p>
        </div>

        <div className="stock-analysis-sec-cik">
          <span>Latest Periodic Filing</span>
          <strong>
            {formatDate(
              data.latest_10q?.filing_date ||
                data.latest_10k?.filing_date
            )}
          </strong>
        </div>
      </div>

      <CollapsibleSection
        title="Bullionaire Filing Read"
        hidden={!summary.length}
        accent={FINANCIAL_SECTION_COLORS.filing}
        badge="FILING READ"
        summary={`${summary.length} ${summary.length === 1 ? "insight" : "insights"}`}
        icon="filing"
      >
        <div className="stock-analysis-filing-read">
          {summary.map((item, index) => (
            <div key={index} className="stock-analysis-filing-read-item">
              {item}
            </div>
          ))}
        </div>
      </CollapsibleSection>

      <BreakdownTable
        title="Reportable Segment Revenue — Annual"
        rows={data.reportable_segments}
        reportingCurrency={reportingCurrency}
        accent={FINANCIAL_SECTION_COLORS.segments}
        badge="SEGMENTS"
        icon="segments"
      />

      <BreakdownTable
        title="End Market Revenue — Annual"
        rows={data.end_markets}
        reportingCurrency={reportingCurrency}
        accent={FINANCIAL_SECTION_COLORS.markets}
        badge="END MARKETS"
        icon="growth"
      />

      <BreakdownTable
        title="Geographic Revenue Exposure"
        rows={data.geography}
        reportingCurrency={reportingCurrency}
        accent={FINANCIAL_SECTION_COLORS.geography}
        badge="GEOGRAPHY"
        icon="geography"
      />

      <CollapsibleSection
        title="Customer Concentration"
        hidden={!hasCustomerConcentration}
        accent={FINANCIAL_SECTION_COLORS.customers}
        badge="CUSTOMERS"
        summary={
          customerConcentration.largest_customer_pct !== null &&
          customerConcentration.largest_customer_pct !== undefined
            ? `Largest ${formatPercent(customerConcentration.largest_customer_pct)}`
            : customers.length
            ? `${customers.length} disclosed`
            : null
        }
        icon="customers"
      >
        <div className="stock-analysis-grid">
          <MetricCard
            label="Largest Customer Revenue Exposure"
            value={formatPercent(customerConcentration.largest_customer_pct)}
          />
          <MetricCard
            label="Second Customer Revenue Exposure"
            value={formatPercent(customerConcentration.second_largest_customer_pct)}
          />
          <MetricCard
            label="Customers Above 10% of Revenue"
            value={customerConcentration.number_of_10pct_customers}
          />
        </div>

        {customers.length > 0 && (
          <div className="stock-analysis-table-wrap" style={{ marginTop: 16 }}>
            <table className="stock-analysis-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Revenue Concentration</th>
                </tr>
              </thead>

              <tbody>
                {customers.map((customer, index) => (
                  <tr key={`${customer.name}-${index}`}>
                    <td>{customer.name}</td>
                    <td>{formatPercent(customer.revenue_pct)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {customerConcentration.notes && (
          <div className="stock-analysis-sec-note">
            {customerConcentration.notes}
          </div>
        )}
      </CollapsibleSection>

      <div className="stock-analysis-sec-note">
        Filing intelligence is extracted conservatively from SEC filings. Sections
        that have no reliable disclosure are hidden instead of showing empty cards.
      </div>
    </div>
  );
}


function SecDeepDivePanel({ data, loading, error }) {
  if (loading) {
    return (
      <div className="stock-analysis-sec-empty">
        Loading SEC deep dive...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="stock-analysis-sec-empty">
        <h3>SEC Deep Dive Not Available</h3>
        <p>{error || "No quarterly or TTM SEC data found for this ticker."}</p>
      </div>
    );
  }

  const ttm = data.ttm || {};
  const latestQuarter = data.latest_quarter || {};
  const qGrowth = data.quarterly_growth || {};
  const balanceSheet = data.balance_sheet || {};
  const revenueVisibility = data.revenue_visibility || {};
  const reportingCurrency = data.reporting_currency || "USD";
  const isFinancialInstitution = data.analysis_profile === "financial_institution";

  const latestQuarterFcf =
    latestQuarter.operating_cash_flow !== null &&
    latestQuarter.operating_cash_flow !== undefined &&
    latestQuarter.capex !== null &&
    latestQuarter.capex !== undefined
      ? Number(latestQuarter.operating_cash_flow) - Number(latestQuarter.capex)
      : null;

  const hasTtm = hasPresentValue(ttm, [
    "revenue",
    "gross_profit",
    "operating_income",
    "net_income",
    "net_interest_income",
    "noninterest_income",
    "provision_for_credit_losses",
    "operating_cash_flow",
    "capex",
    "free_cash_flow",
    "buybacks",
    "dividends_paid",
  ]);

  const hasTtmMargins = hasPresentValue(ttm, [
    "gross_margin",
    "operating_margin",
    "net_margin",
    "fcf_margin",
    "r_and_d_to_revenue",
    "sga_to_revenue",
    "sbc_to_revenue",
    "dividend_payout_to_fcf",
  ]);

  const hasLatestQuarter = hasPresentValue(latestQuarter, [
    "period",
    "revenue",
    "gross_profit",
    "operating_income",
    "net_income",
    "net_interest_income",
    "noninterest_income",
    "provision_for_credit_losses",
    "operating_cash_flow",
    "capex",
    "r_and_d",
    "sga",
    "stock_based_comp",
    "buybacks",
  ]);

  const hasQuarterGrowth = hasPresentValue(qGrowth, [
    "revenue_yoy",
    "gross_profit_yoy",
    "operating_income_yoy",
    "net_income_yoy",
    "operating_cash_flow_yoy",
    "capex_yoy",
    "r_and_d_yoy",
    "sga_yoy",
    "stock_based_comp_yoy",
  ]);

  const hasBalanceSheet = hasPresentValue(balanceSheet, [
    "latest_period",
    "current_ratio",
    "quick_ratio",
    "cash",
    "debt",
    "net_cash",
    "net_debt",
    "cash_to_debt",
    "debt_to_assets",
    "liabilities_to_assets",
    "equity_ratio",
    "deposits",
    "loans",
    "allowance_for_credit_losses",
    "loans_to_deposits",
    "allowance_to_loans",
  ]);

  const hasRevenueVisibility = hasPresentValue(revenueVisibility, [
    "remaining_performance_obligations",
    "current_remaining_performance_obligations",
    "noncurrent_remaining_performance_obligations",
    "deferred_revenue_total",
    "rpo_to_ttm_revenue",
    "deferred_revenue_to_ttm_revenue",
  ]);

  return (
    <div className="stock-analysis-sec-deep-dive">
      <div className="stock-analysis-sec-header">
        <div>
          <div className="stock-analysis-card-label">SEC Deep Dive</div>
          <h3>{data.entity_name || data.ticker} TTM & Quarterly Intelligence</h3>
          <p>
            This section uses SEC companyfacts from quarterly and annual filings to
            build trailing twelve-month metrics, latest-quarter trends, expense
            intensity, shareholder returns, and liquidity ratios.
          </p>
        </div>

        <div className="stock-analysis-sec-cik">
          <span>Latest Quarter</span>
          <strong>{formatDate(latestQuarter.period)}</strong>
        </div>
      </div>

      <CollapsibleSection
        title={isFinancialInstitution ? "TTM Bank Earnings" : "TTM Financials"}
        hidden={!hasTtm}
        accent={FINANCIAL_SECTION_COLORS.ttm}
        badge="TTM"
        summary={
          ttm.revenue !== null && ttm.revenue !== undefined
            ? `Revenue ${formatLargeMoney(ttm.revenue, reportingCurrency)}`
            : null
        }
        icon="quarter"
      >
        <div className="stock-analysis-grid">
          <MetricCard label="TTM Revenue" value={formatLargeMoney(ttm.revenue, reportingCurrency)} />
          <MetricCard label="TTM Gross Profit" value={formatLargeMoney(ttm.gross_profit, reportingCurrency)} />
          <MetricCard label="TTM Operating Income" value={formatLargeMoney(ttm.operating_income, reportingCurrency)} />
          <MetricCard label="TTM Net Income" value={formatLargeMoney(ttm.net_income, reportingCurrency)} />

          {isFinancialInstitution && (
            <>
              <MetricCard label="TTM Net Interest Income" value={formatLargeMoney(ttm.net_interest_income, reportingCurrency)} />
              <MetricCard label="TTM Noninterest Income" value={formatLargeMoney(ttm.noninterest_income, reportingCurrency)} />
              <MetricCard
                label="TTM Provision for Credit Losses"
                value={formatLargeMoney(ttm.provision_for_credit_losses, reportingCurrency)}
              />
            </>
          )}

          {!isFinancialInstitution && (
            <>
              <MetricCard label="TTM Operating Cash Flow" value={formatLargeMoney(ttm.operating_cash_flow, reportingCurrency)} />
              <MetricCard label="TTM CapEx" value={formatLargeMoney(ttm.capex, reportingCurrency)} />
              <MetricCard label="TTM Free Cash Flow" value={formatLargeMoney(ttm.free_cash_flow, reportingCurrency)} />
            </>
          )}

          <MetricCard label="TTM Buybacks" value={formatLargeMoney(ttm.buybacks, reportingCurrency)} />
          <MetricCard label="TTM Dividends Paid" value={formatLargeMoney(ttm.dividends_paid, reportingCurrency)} />
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title="TTM Margins & Expense Intensity"
        hidden={isFinancialInstitution || !hasTtmMargins}
        accent={FINANCIAL_SECTION_COLORS.quality}
        badge="MARGINS"
        summary={
          ttm.net_margin !== null && ttm.net_margin !== undefined
            ? `Net Margin ${formatPercent(ttm.net_margin)}`
            : null
        }
        icon="quality"
      >
        <div className="stock-analysis-grid">
          <MetricCard label="TTM Gross Margin" value={formatPercent(ttm.gross_margin)} />
          <MetricCard label="TTM Operating Margin" value={formatPercent(ttm.operating_margin)} />
          <MetricCard label="TTM Net Margin" value={formatPercent(ttm.net_margin)} />
          <MetricCard label="TTM FCF Margin" value={formatPercent(ttm.fcf_margin)} />
          <MetricCard label="R&D / Revenue" value={formatPercent(ttm.r_and_d_to_revenue)} />
          <MetricCard label="SG&A / Revenue" value={formatPercent(ttm.sga_to_revenue)} />
          <MetricCard label="SBC / Revenue" value={formatPercent(ttm.sbc_to_revenue)} />
          <MetricCard label="Dividends / FCF" value={formatPercent(ttm.dividend_payout_to_fcf)} />
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title="Latest Quarter Snapshot"
        hidden={!hasLatestQuarter}
        accent={FINANCIAL_SECTION_COLORS.quarter}
        badge="QUARTER"
        summary={
          latestQuarter.revenue !== null && latestQuarter.revenue !== undefined
            ? `Revenue ${formatLargeMoney(latestQuarter.revenue, reportingCurrency)}`
            : formatDate(latestQuarter.period)
        }
        icon="quarter"
      >
        <div className="stock-analysis-grid">
          <MetricCard label="Quarter End" value={formatDate(latestQuarter.period)} />
          <MetricCard label="Quarter Revenue" value={formatLargeMoney(latestQuarter.revenue, reportingCurrency)} />
          <MetricCard label="Quarter Gross Profit" value={formatLargeMoney(latestQuarter.gross_profit, reportingCurrency)} />
          <MetricCard label="Quarter Operating Income" value={formatLargeMoney(latestQuarter.operating_income, reportingCurrency)} />
          <MetricCard label="Quarter Net Income" value={formatLargeMoney(latestQuarter.net_income, reportingCurrency)} />

          {isFinancialInstitution && (
            <>
              <MetricCard label="Quarter Net Interest Income" value={formatLargeMoney(latestQuarter.net_interest_income, reportingCurrency)} />
              <MetricCard label="Quarter Noninterest Income" value={formatLargeMoney(latestQuarter.noninterest_income, reportingCurrency)} />
              <MetricCard
                label="Quarter Provision for Credit Losses"
                value={formatLargeMoney(latestQuarter.provision_for_credit_losses, reportingCurrency)}
              />
            </>
          )}

          <MetricCard label="Quarter OCF" value={formatLargeMoney(latestQuarter.operating_cash_flow, reportingCurrency)} />
          <MetricCard label="Quarter CapEx" value={formatLargeMoney(latestQuarter.capex, reportingCurrency)} />
          <MetricCard label="Quarter FCF" value={formatLargeMoney(latestQuarterFcf, reportingCurrency)} />
          <MetricCard label="Quarter R&D" value={formatLargeMoney(latestQuarter.r_and_d, reportingCurrency)} />
          <MetricCard label="Quarter SG&A" value={formatLargeMoney(latestQuarter.sga, reportingCurrency)} />
          <MetricCard label="Quarter SBC" value={formatLargeMoney(latestQuarter.stock_based_comp, reportingCurrency)} />
          <MetricCard label="Quarter Buybacks" value={formatLargeMoney(latestQuarter.buybacks, reportingCurrency)} />
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title="Latest Quarter YoY Growth"
        hidden={!hasQuarterGrowth}
        accent={FINANCIAL_SECTION_COLORS.growth}
        badge="YOY"
        summary={
          qGrowth.revenue_yoy !== null && qGrowth.revenue_yoy !== undefined
            ? `Revenue ${formatSignedPercent(qGrowth.revenue_yoy)}`
            : null
        }
        icon="growth"
      >
        <div className="stock-analysis-grid">
          <MetricCard label="Revenue YoY" value={formatSignedPercent(qGrowth.revenue_yoy)} />
          <MetricCard label="Gross Profit YoY" value={formatSignedPercent(qGrowth.gross_profit_yoy)} />
          <MetricCard label="Operating Income YoY" value={formatSignedPercent(qGrowth.operating_income_yoy)} />
          <MetricCard label="Net Income YoY" value={formatSignedPercent(qGrowth.net_income_yoy)} />
          <MetricCard label="Operating Cash Flow YoY" value={formatSignedPercent(qGrowth.operating_cash_flow_yoy)} />
          <MetricCard label="CapEx YoY" value={formatSignedPercent(qGrowth.capex_yoy)} />
          <MetricCard label="R&D YoY" value={formatSignedPercent(qGrowth.r_and_d_yoy)} />
          <MetricCard label="SG&A YoY" value={formatSignedPercent(qGrowth.sga_yoy)} />
          <MetricCard label="SBC YoY" value={formatSignedPercent(qGrowth.stock_based_comp_yoy)} />
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title={isFinancialInstitution ? "Capital, Loans & Deposits" : "Liquidity & Balance Sheet"}
        hidden={!hasBalanceSheet}
        accent={FINANCIAL_SECTION_COLORS.balance}
        badge={isFinancialInstitution ? "CAPITAL" : "LIQUIDITY"}
        summary={
          isFinancialInstitution
            ? balanceSheet.loans_to_deposits !== null &&
              balanceSheet.loans_to_deposits !== undefined
              ? `Loans / Deposits ${formatPercent(balanceSheet.loans_to_deposits)}`
              : null
            : balanceSheet.net_cash !== null && balanceSheet.net_cash !== undefined
            ? `Net Cash ${formatLargeMoney(balanceSheet.net_cash, reportingCurrency)}`
            : null
        }
        icon="balance"
      >
        <div className="stock-analysis-grid">
          <MetricCard label="Balance Sheet Date" value={formatDate(balanceSheet.latest_period)} />
          <MetricCard label="Current Ratio" value={formatRatio(balanceSheet.current_ratio)} />
          <MetricCard label="Quick Ratio" value={formatRatio(balanceSheet.quick_ratio)} />
          <MetricCard label="Cash" value={formatLargeMoney(balanceSheet.cash, reportingCurrency)} />
          <MetricCard label="Debt" value={formatLargeMoney(balanceSheet.debt, reportingCurrency)} />
          <MetricCard label="Net Cash" value={formatLargeMoney(balanceSheet.net_cash, reportingCurrency)} />
          <MetricCard label="Net Debt" value={formatLargeMoney(balanceSheet.net_debt, reportingCurrency)} />
          <MetricCard label="Cash / Debt" value={formatRatio(balanceSheet.cash_to_debt)} />
          <MetricCard label="Debt / Assets" value={formatPercent(balanceSheet.debt_to_assets)} />
          <MetricCard label="Liabilities / Assets" value={formatPercent(balanceSheet.liabilities_to_assets)} />
          <MetricCard label="Equity Ratio" value={formatPercent(balanceSheet.equity_ratio)} />

          {isFinancialInstitution && (
            <>
              <MetricCard label="Deposits" value={formatLargeMoney(balanceSheet.deposits, reportingCurrency)} />
              <MetricCard label="Loans" value={formatLargeMoney(balanceSheet.loans, reportingCurrency)} />
              <MetricCard
                label="Allowance for Credit Losses"
                value={formatLargeMoney(balanceSheet.allowance_for_credit_losses, reportingCurrency)}
              />
              <MetricCard label="Loans / Deposits" value={formatPercent(balanceSheet.loans_to_deposits)} />
              <MetricCard label="Allowance / Loans" value={formatPercent(balanceSheet.allowance_to_loans)} />
            </>
          )}
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title="Revenue Visibility & Contract Backlog"
        hidden={isFinancialInstitution || !hasRevenueVisibility}
        accent={FINANCIAL_SECTION_COLORS.visibility}
        badge="VISIBILITY"
        summary={
          revenueVisibility.remaining_performance_obligations !== null &&
          revenueVisibility.remaining_performance_obligations !== undefined
            ? `RPO ${formatLargeMoney(
                revenueVisibility.remaining_performance_obligations,
                reportingCurrency
              )}`
            : revenueVisibility.deferred_revenue_total !== null &&
              revenueVisibility.deferred_revenue_total !== undefined
            ? `Deferred ${formatLargeMoney(
                revenueVisibility.deferred_revenue_total,
                reportingCurrency
              )}`
            : null
        }
        icon="visibility"
      >
        <div className="stock-analysis-grid">
          <MetricCard
            label="Remaining Performance Obligations"
            value={formatLargeMoney(revenueVisibility.remaining_performance_obligations, reportingCurrency)}
          />
          <MetricCard
            label="Current RPO"
            value={formatLargeMoney(revenueVisibility.current_remaining_performance_obligations, reportingCurrency)}
          />
          <MetricCard
            label="Noncurrent RPO"
            value={formatLargeMoney(revenueVisibility.noncurrent_remaining_performance_obligations, reportingCurrency)}
          />
          <MetricCard
            label="Deferred Revenue"
            value={formatLargeMoney(revenueVisibility.deferred_revenue_total, reportingCurrency)}
          />
          <MetricCard
            label="RPO / TTM Revenue"
            value={formatPercent(revenueVisibility.rpo_to_ttm_revenue)}
          />
          <MetricCard
            label="Deferred Revenue / TTM Revenue"
            value={formatPercent(revenueVisibility.deferred_revenue_to_ttm_revenue)}
          />
        </div>

        <div className="stock-analysis-sec-note">
          RPO and deferred revenue are useful for subscription, software,
          cloud, defense, industrial backlog, and long-term contract businesses.
        </div>
      </CollapsibleSection>

      <div className="stock-analysis-sec-note">
        SEC Deep Dive is based on quarterly and TTM companyfacts. Sections with no
        reliable values are hidden automatically.
      </div>
    </div>
  );
}

function DependencyExposureTab({ ticker }) {
  const exposures = useMemo(() => {
    const reverseMacroMap = buildReverseMacroMap();
    const rawExposures = reverseMacroMap[ticker] || [];

    const bestByScenario = {};

    rawExposures.forEach((entry) => {
      const key = `${entry.macro}__${entry.macroDirection}__${entry.finalDirection}`;
      const existing = bestByScenario[key];

      if (!existing) {
        bestByScenario[key] = entry;
        return;
      }

      const existingConfidence = existing.confidence ?? -1;
      const newConfidence = entry.confidence ?? -1;

      if (newConfidence > existingConfidence) {
        bestByScenario[key] = entry;
        return;
      }

      if (newConfidence === existingConfidence) {
        const existingMagnitude = existing.magnitude ?? -1;
        const newMagnitude = entry.magnitude ?? -1;

        if (newMagnitude > existingMagnitude) {
          bestByScenario[key] = entry;
        }
      }
    });

    return summarizeTickerMacroExposure(Object.values(bestByScenario));
  }, [ticker]);

  const macroCount = Object.keys(dependencyTree || {}).length;

  return (
    <section className="stock-analysis-section">
      <h2>Dependency Map Exposure</h2>

      <p className="stock-analysis-muted">
        This shows how {ticker} is affected across Bullionaire&apos;s macro
        dependency map. It scans {macroCount} macro drivers and pulls scenarios
        where this ticker appears in the impact chain.
      </p>

      {!exposures.length ? (
        <div className="stock-analysis-empty stock-analysis-curation-empty">
  <h3>Dependency Map Not Yet Curated</h3>
  <p>
    {ticker} has not been mapped into Bullionaire&apos;s macro dependency tree
    yet. Once this ticker is added to a macro scenario, this tab will show
    what happens to the company under oil, rates, inflation, credit, dollar,
    consumer spending, and other macro cases.
  </p>
</div>
      ) : (
        <div className="stock-analysis-macro-grid">
          {exposures.map((entry, index) => (
            <div
              key={`${entry.macro}-${entry.macroDirection}-${entry.finalDirection}-${index}`}
              className="stock-analysis-macro-card"
            >
              <div className="stock-analysis-macro-top">
                <div>
                  <div className="stock-analysis-card-label">Macro Scenario</div>
                  <h3>
                    {entry.macro} {entry.macroDirection === "up" ? "↑" : "↓"}
                  </h3>
                </div>

                <div
                  className={
                    entry.finalDirection === "up"
                      ? "stock-analysis-impact positive"
                      : "stock-analysis-impact negative"
                  }
                >
                  {entry.finalDirection === "up" ? "Positive ↑" : "Negative ↓"}
                </div>
              </div>

              <div className="stock-analysis-macro-meta">
                Confidence: {entry.confidence}/10
              </div>

              <p>{entry.why}</p>

              <div className="stock-analysis-path">
                <strong>Path:</strong> {entry.pathText}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function getSupplyChainSummary(ticker) {
  const data = supplyChainTree?.[ticker];

  if (!data) {
    return {
      found: false,
      name: ticker,
      suppliers: [],
      customers: [],
      related: [],
    };
  }

  const nodes = Array.isArray(data.nodes) ? data.nodes : [];
  const edges = Array.isArray(data.edges) ? data.edges : [];
  const rootId = data.root;

  const nodeById = {};
  nodes.forEach((node) => {
    nodeById[node.id] = node;
  });

  const suppliers = edges
    .filter((edge) => edge.target === rootId)
    .map((edge) => nodeById[edge.source])
    .filter(Boolean);

  const customers = edges
    .filter((edge) => edge.source === rootId)
    .map((edge) => nodeById[edge.target])
    .filter(Boolean);

  const related = nodes
    .filter((node) => node.ticker && node.id !== rootId)
    .map((node) => ({
      ticker: node.ticker,
      name: node.name,
      role: node.role,
    }));

  return {
    found: true,
    name: data.name || ticker,
    suppliers,
    customers,
    related,
  };
}

function SupplyChainTab({ ticker, navigate }) {
  const summary = useMemo(() => getSupplyChainSummary(ticker), [ticker]);

  return (
    <section className="stock-analysis-section">
      <h2>Supply Chain</h2>

      {!summary.found ? (
        <div className="stock-analysis-empty stock-analysis-curation-empty">
  <h3>Supply Chain Not Yet Curated</h3>
  <p>
    Bullionaire has not built a company-specific supply chain map for {ticker}
    yet. The stock page still includes market data, valuation, analysts,
    technicals, peers, and filings, but supplier/customer intelligence is not
    available for this ticker yet.
  </p>
</div>
      ) : (
        <>
          <p className="stock-analysis-muted">
            Curated Bullionaire supply chain map for {summary.name}. This pulls
            directly from the same data used in your Supply Chain tab.
          </p>

          <div className="stock-analysis-supply-grid">
            <div className="stock-analysis-supply-card">
              <h3>Biggest Suppliers / Upstream Dependencies</h3>

              {summary.suppliers.length ? (
                summary.suppliers.map((node) => (
                  <div key={node.id} className="stock-analysis-supply-row">
                    <button
                      type="button"
                      onClick={() =>
                        node.ticker && navigate(`/stocks/${String(node.ticker).toUpperCase()}`)
                      }
                    >
                      {node.ticker || node.name}
                    </button>
                    <div>
                      <strong>{node.name}</strong>
                      <p>{node.role || "Supplier / upstream dependency"}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="stock-analysis-empty small">
                  No direct upstream suppliers listed.
                </div>
              )}
            </div>

            <div className="stock-analysis-supply-card">
              <h3>Customers / Demand Drivers</h3>

              {summary.customers.length ? (
                summary.customers.map((node) => (
                  <div key={node.id} className="stock-analysis-supply-row">
                    <button
                      type="button"
                      onClick={() =>
                        node.ticker && navigate(`/stocks/${String(node.ticker).toUpperCase()}`)
                      }
                    >
                      {node.ticker || node.name}
                    </button>
                    <div>
                      <strong>{node.name}</strong>
                      <p>{node.role || "Customer / downstream demand driver"}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="stock-analysis-empty small">
                  No direct downstream demand drivers listed.
                </div>
              )}
            </div>
          </div>

          <div className="stock-analysis-section nested">
            <h3>All Related Supply Chain Companies</h3>

            <div className="stock-analysis-table-wrap">
              <table className="stock-analysis-table">
                <thead>
                  <tr>
                    <th>Ticker</th>
                    <th>Company</th>
                    <th>Role</th>
                  </tr>
                </thead>

                <tbody>
                  {summary.related.map((node, index) => (
                    <tr key={`${node.ticker}-${index}`}>
                      <td>
                        <button
                          className="stock-analysis-peer-link"
                          onClick={() =>
                            node.ticker &&
                            navigate(`/stocks/${String(node.ticker).toUpperCase()}`)
                          }
                        >
                          {node.ticker || "--"}
                        </button>
                      </td>
                      <td>{node.name || "--"}</td>
                      <td>{node.role || "--"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

function CoveragePill({ item }) {
  return (
    <div className={`stock-analysis-coverage-pill ${item.tone}`}>
      <div>
        <span>{item.label}</span>
        <strong>{item.status}</strong>
      </div>
    </div>
  );
}

function IntelligenceCoverage({ items, scoreLabel }) {
  const strongCount = items.filter((item) => item.tone === "strong").length;
  const partialCount = items.filter((item) => item.tone === "partial").length;

  let coverageTitle = "Basic Market Coverage";
  let coverageTone = "basic";

  if (strongCount >= 5) {
    coverageTitle = "Full Bullionaire Coverage";
    coverageTone = "full";
  } else if (strongCount >= 3 || partialCount >= 2) {
    coverageTitle = "Partial Bullionaire Coverage";
    coverageTone = "partial";
  }

  return (
    <section className="stock-analysis-section stock-analysis-coverage-section">
      <div className="stock-analysis-coverage-header">
        <div>
          <div className="stock-analysis-card-label">
            Bullionaire Intelligence Coverage
          </div>

          <h2>{coverageTitle}</h2>

          <p>
            This shows how much proprietary Bullionaire intelligence is available
            for this ticker. Some stocks have full supply chain and dependency
            map coverage, while others currently have basic market data only.
          </p>
        </div>

        <div className={`stock-analysis-coverage-badge ${coverageTone}`}>
          {scoreLabel}
        </div>
      </div>

      <div className="stock-analysis-coverage-grid">
        {items.map((item) => (
          <CoveragePill key={item.label} item={item} />
        ))}
      </div>
    </section>
  );
}

function toNumber(value) {
  const num = Number(value);
  return Number.isNaN(num) ? null : num;
}

function getTechnicalRead(stock) {
  const rsi = toNumber(stock?.RSI);
  const macd = toNumber(stock?.MACD);
  const signal = toNumber(stock?.["MACD Signal"]);
  const price = toNumber(stock?.["Current Price"]);
  const sma20 = toNumber(stock?.["SMA 20"]);

  const notes = [];

  if (rsi !== null) {
    if (rsi >= 70) notes.push("RSI suggests the stock may be overbought.");
    else if (rsi <= 30) notes.push("RSI suggests the stock may be oversold.");
    else notes.push("RSI is in a neutral range.");
  }

  if (macd !== null && signal !== null) {
    if (macd > signal) notes.push("MACD is above signal, suggesting positive momentum.");
    else notes.push("MACD is below signal, suggesting weakening momentum.");
  }

  if (price !== null && sma20 !== null) {
    if (price > sma20) notes.push("Price is above the 20-day moving average.");
    else notes.push("Price is below the 20-day moving average.");
  }

  return notes;
}

function getValuationRead(stock, peerStats, relative) {
  const pe = toNumber(stock?.["P/E (TTM)"]);
  const peerPe = toNumber(peerStats?.median_pe);
  const peDiff = toNumber(relative?.pe_vs_peer_median_pct);
  const notes = [];

  if (pe !== null && peerPe !== null) {
    if (peDiff !== null && peDiff > 25) {
      notes.push(`The stock trades at a premium to its peer median P/E of ${peerPe.toFixed(2)}.`);
    } else if (peDiff !== null && peDiff < -15) {
      notes.push(`The stock trades below its peer median P/E of ${peerPe.toFixed(2)}.`);
    } else {
      notes.push(`The stock trades near its peer median P/E of ${peerPe.toFixed(2)}.`);
    }
  }

  return notes;
}

function getSupplyChainHighlights(ticker) {
  const data = supplyChainTree?.[ticker];
  if (!data) return [];

  const nodes = Array.isArray(data.nodes) ? data.nodes : [];
  const edges = Array.isArray(data.edges) ? data.edges : [];
  const rootId = data.root;

  const nodeById = {};
  nodes.forEach((node) => {
    nodeById[node.id] = node;
  });

  return edges
    .filter((edge) => edge.target === rootId)
    .map((edge) => nodeById[edge.source])
    .filter(Boolean)
    .slice(0, 5);
}

function getTopMacroExposures(ticker) {
  const reverseMacroMap = buildReverseMacroMap();
  const rawExposures = reverseMacroMap[ticker] || [];

  const bestByScenario = {};

  rawExposures.forEach((entry) => {
    const key = `${entry.macro}__${entry.macroDirection}__${entry.finalDirection}`;
    const existing = bestByScenario[key];

    if (!existing || (entry.confidence ?? 0) > (existing.confidence ?? 0)) {
      bestByScenario[key] = entry;
    }
  });

  return summarizeTickerMacroExposure(Object.values(bestByScenario)).slice(0, 6);
}

function buildThesis({
  stock,
  peerStats,
  relative,
  snapshotScore,
  dependencyExposureCount,
  hasSupplyChainMap,
}) {
  const ticker = stock?.Ticker;
  const scoreLabel = getScoreLabel(snapshotScore);
  const analystUpside = toNumber(stock?.["Analyst Upside"]);
  const shortFloat = toNumber(stock?.["Short % of Float"]);
  const beta = toNumber(stock?.Beta);

  const valuationNotes = getValuationRead(stock, peerStats, relative);
  const technicalNotes = getTechnicalRead(stock);
  const macroExposures = getTopMacroExposures(ticker);
  const supplyHighlights = getSupplyChainHighlights(ticker);

  const bullCase = [];

  if (analystUpside !== null && analystUpside > 10) {
    bullCase.push(`Analyst targets imply upside of ${analystUpside.toFixed(2)}%.`);
  }

  if (relative?.pe_vs_peer_median_pct !== null && relative?.pe_vs_peer_median_pct < 0) {
    bullCase.push("Peer-relative valuation appears favorable based on available P/E data.");
  }

  if (technicalNotes.some((note) => note.includes("positive momentum") || note.includes("above the 20-day"))) {
    bullCase.push("Technical positioning shows signs of positive momentum.");
  }

  if (hasSupplyChainMap) {
    bullCase.push("Bullionaire has curated supply-chain intelligence for this company.");
  }

  if (!bullCase.length) {
    bullCase.push("The stock has baseline market, peer, analyst, and technical coverage available.");
  }

  const bearCase = [];

  if (analystUpside !== null && analystUpside < 0) {
    bearCase.push(`Analyst targets imply downside of ${Math.abs(analystUpside).toFixed(2)}%.`);
  }

  if (relative?.pe_vs_peer_median_pct !== null && relative?.pe_vs_peer_median_pct > 25) {
    bearCase.push("Peer-relative valuation appears elevated based on available P/E data.");
  }

  if (shortFloat !== null && shortFloat > 10) {
    bearCase.push(`Short interest is elevated at ${shortFloat.toFixed(2)}% of float.`);
  }

  if (beta !== null && beta > 1.5) {
    bearCase.push(`Beta of ${beta.toFixed(2)} suggests above-average market sensitivity.`);
  }

  if (!dependencyExposureCount) {
    bearCase.push("Macro dependency coverage is not yet deeply curated for this ticker.");
  }

  if (!bearCase.length) {
    bearCase.push("No major red flags are being detected from the current available dataset.");
  }

  let verdict = `${scoreLabel} setup based on Bullionaire's current quantitative and curated data.`;

  if (scoreLabel === "Strong") verdict = "Strong setup with favorable signals across available Bullionaire data.";
  if (scoreLabel === "Constructive") verdict = "Constructive setup, but still dependent on valuation, macro, and execution risk.";
  if (scoreLabel === "Neutral") verdict = "Neutral setup where the data does not clearly favor bulls or bears yet.";
  if (scoreLabel === "Weak") verdict = "Weak setup with several caution signals in the available data.";
  if (scoreLabel === "High Risk") verdict = "High-risk setup based on current Bullionaire scoring inputs.";

  return {
    verdict,
    bullCase,
    bearCase,
    valuationNotes,
    technicalNotes,
    macroExposures,
    supplyHighlights,
  };
}

function RiskRadar({ stock, relative, dependencyExposureCount, hasSupplyChainMap }) {
  const valuationRisk =
    toNumber(relative?.pe_vs_peer_median_pct) > 25 ? "High" : "Moderate";

  const beta = toNumber(stock?.Beta);
  const marketRisk = beta !== null && beta > 1.5 ? "High" : "Moderate";

  const rsi = toNumber(stock?.RSI);
  const technicalRisk = rsi !== null && (rsi > 70 || rsi < 30) ? "Elevated" : "Normal";

  const shortFloat = toNumber(stock?.["Short % of Float"]);
  const shortRisk = shortFloat !== null && shortFloat > 10 ? "Elevated" : "Normal";

  const macroRisk = dependencyExposureCount ? "Mapped" : "Limited";
  const supplyRisk = hasSupplyChainMap ? "Mapped" : "Limited";

  const risks = [
    { label: "Valuation Risk", value: valuationRisk },
    { label: "Market/Beta Risk", value: marketRisk },
    { label: "Technical Risk", value: technicalRisk },
    { label: "Short Interest Risk", value: shortRisk },
    { label: "Macro Dependency Risk", value: macroRisk },
    { label: "Supply Chain Risk", value: supplyRisk },
  ];

  return (
    <section className="stock-analysis-section">
      <h2>Risk Radar</h2>

      <p className="stock-analysis-muted">
        This summarizes the biggest risk categories detected from Bullionaire&apos;s
        available valuation, technical, short interest, macro, and supply-chain data.
      </p>

      <div className="stock-analysis-risk-grid">
        {risks.map((risk) => (
          <div key={risk.label} className="stock-analysis-risk-card">
            <div className="stock-analysis-card-label">{risk.label}</div>
            <strong>{risk.value}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}

function ThesisListCard({ title, items, emptyText, tone = "neutral" }) {
  return (
    <div className={`stock-analysis-thesis-list-card ${tone}`}>
      <h4>{title}</h4>

      {items && items.length ? (
        <ul>
          {items.map((item, index) => (
            <li key={index}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="stock-analysis-muted">{emptyText}</p>
      )}
    </div>
  );
}

function ThesisTab({ thesis, stock }) {
  const macroUpside = thesis.macroExposures.filter(
    (entry) => entry.finalDirection === "up"
  );

  const macroDownside = thesis.macroExposures.filter(
    (entry) => entry.finalDirection === "down"
  );

  return (
    <section className="stock-analysis-section">
      <h2>Thesis</h2>

      <div className="stock-analysis-thesis-report">
        <div className="stock-analysis-thesis-hero">
          <div>
            <div className="stock-analysis-card-label">One-Line View</div>
            <h3>{thesis.verdict}</h3>
            <p>
              This report combines peer-relative valuation, analyst data,
              technical indicators, macro dependency mapping, and supply-chain
              intelligence where available.
            </p>
          </div>

          <div className="stock-analysis-thesis-use-case">
            <div className="stock-analysis-card-label">Best Use Case</div>
            <strong>{getBestUseCase(stock, thesis)}</strong>
            <span>Framework classification, not a buy/sell recommendation.</span>
          </div>
        </div>

        <div className="stock-analysis-thesis-columns">
          <ThesisListCard
            title="Bull Case"
            items={thesis.bullCase}
            emptyText="No major bullish signals found in the current dataset."
            tone="positive"
          />

          <ThesisListCard
            title="Bear Case"
            items={thesis.bearCase}
            emptyText="No major bearish signals found in the current dataset."
            tone="negative"
          />
        </div>

        <div className="stock-analysis-thesis-deep-grid">
          <ThesisListCard
            title="Valuation Read"
            items={thesis.valuationNotes}
            emptyText="Not enough peer-relative valuation data yet."
          />

          <ThesisListCard
            title="Technical Read"
            items={thesis.technicalNotes}
            emptyText="Not enough technical data yet."
          />
        </div>

        <div className="stock-analysis-thesis-deep-grid">
          <div className="stock-analysis-thesis-list-card macro">
            <h4>Macro Drivers That Could Help</h4>

            {macroUpside.length ? (
              <div className="stock-analysis-thesis-macro-list">
                {macroUpside.slice(0, 4).map((entry, index) => (
                  <div key={`${entry.macro}-up-${index}`}>
                    <strong>
                      {entry.macro} {entry.macroDirection === "up" ? "↑" : "↓"}
                    </strong>
                    <span>{entry.why}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="stock-analysis-muted">
                No positive macro scenarios are currently mapped for {stock.Ticker}.
              </p>
            )}
          </div>

          <div className="stock-analysis-thesis-list-card macro">
            <h4>Macro Drivers That Could Hurt</h4>

            {macroDownside.length ? (
              <div className="stock-analysis-thesis-macro-list">
                {macroDownside.slice(0, 4).map((entry, index) => (
                  <div key={`${entry.macro}-down-${index}`}>
                    <strong>
                      {entry.macro} {entry.macroDirection === "up" ? "↑" : "↓"}
                    </strong>
                    <span>{entry.why}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="stock-analysis-muted">
                No negative macro scenarios are currently mapped for {stock.Ticker}.
              </p>
            )}
          </div>
        </div>

        <div className="stock-analysis-thesis-list-card supply">
          <h4>Key Supply Chain Watch Items</h4>

          {thesis.supplyHighlights.length ? (
            <div className="stock-analysis-thesis-supply-list">
              {thesis.supplyHighlights.map((node) => (
                <div key={node.id}>
                  <strong>{node.ticker || node.name}</strong>
                  <span>{node.role}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="stock-analysis-muted">
              No curated supply-chain highlights are available for {stock.Ticker} yet.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

function getBestUseCase(stock, thesis) {
  const beta = toNumber(stock?.Beta);
  const dividend = toNumber(stock?.["Dividend Yield"]);
  const analystUpside = toNumber(stock?.["Analyst Upside"]);

  if (dividend !== null && dividend >= 3 && beta !== null && beta < 1.2) {
    return "Dividend / defensive watchlist candidate";
  }

  if (analystUpside !== null && analystUpside >= 15) {
    return "Upside watchlist candidate";
  }

  if (beta !== null && beta > 1.5) {
    return "High-beta tactical candidate";
  }

  if (thesis.supplyHighlights.length || thesis.macroExposures.length) {
    return "Macro and supply-chain research candidate";
  }

  return "Core watchlist candidate";
}

function WhatMovesItTab({ thesis, stock }) {
  return (
    <section className="stock-analysis-section">
      <h2>What Moves {stock.Ticker}?</h2>

      <div className="stock-analysis-moves-grid">
        <div className="stock-analysis-move-card positive">
          <h3>What Could Help</h3>
          <ul>
            {thesis.bullCase.map((item, index) => (
              <li key={index}>{item}</li>
            ))}

            {thesis.macroExposures
              .filter((entry) => entry.finalDirection === "up")
              .slice(0, 4)
              .map((entry, index) => (
                <li key={`macro-up-${index}`}>
                  {entry.macro} {entry.macroDirection === "up" ? "↑" : "↓"} historically maps positive for {stock.Ticker}.
                </li>
              ))}
          </ul>
        </div>

        <div className="stock-analysis-move-card negative">
          <h3>What Could Hurt</h3>
          <ul>
            {thesis.bearCase.map((item, index) => (
              <li key={index}>{item}</li>
            ))}

            {thesis.macroExposures
              .filter((entry) => entry.finalDirection === "down")
              .slice(0, 4)
              .map((entry, index) => (
                <li key={`macro-down-${index}`}>
                  {entry.macro} {entry.macroDirection === "up" ? "↑" : "↓"} historically maps negative for {stock.Ticker}.
                </li>
              ))}
          </ul>
        </div>
      </div>

      {thesis.supplyHighlights.length > 0 && (
        <div className="stock-analysis-section nested">
          <h3>Key Supply Chain Watch Items</h3>

          <div className="stock-analysis-watch-list">
            {thesis.supplyHighlights.map((node) => (
              <div key={node.id}>
                <strong>{node.ticker || node.name}</strong>
                <span>{node.role}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function CompareFoundationTab({ stock, peers, navigate }) {
  const topPeers = peers.slice(0, 8);

  return (
    <section className="stock-analysis-section">
      <h2>Compare {stock.Ticker}</h2>

      <p className="stock-analysis-muted">
        This is the foundation for a future side-by-side comparison page. For now,
        you can instantly open this ticker with one or more major peers in the
        dashboard filter.
      </p>

      <div className="stock-analysis-compare-grid">
        {topPeers.map((peer) => (
          <button
            key={peer.Ticker}
            type="button"
            onClick={() => navigate(`/dashboard?tickers=${stock.Ticker},${peer.Ticker}`)}
          >
            {stock.Ticker} vs {peer.Ticker}
          </button>
        ))}
      </div>
    </section>
  );
}

function getSmartMoneySignalClass(signal) {
  const clean = String(signal || "").toLowerCase();

  if (clean === "bullish") return "positive";
  if (clean === "bearish") return "negative";
  return "neutral";
}

function getTickerSmartMoneySignal(rows) {
  const bullish = rows.filter((row) => row.signal === "Bullish").length;
  const bearish = rows.filter((row) => row.signal === "Bearish").length;

  if (bullish > bearish) return "Bullish";
  if (bearish > bullish) return "Bearish";
  return "Neutral";
}

function StockSmartMoneyPanel({ stock, navigate }) {
  const ticker = String(stock?.Ticker || "").toUpperCase();

  const rows = smartMoneyTransactions.filter(
    (row) => String(row.ticker || "").toUpperCase() === ticker
  );

  const signal = getTickerSmartMoneySignal(rows);

  const buyValue = rows
    .filter((row) => String(row.transactionType || "").toLowerCase().includes("buy"))
    .reduce((sum, row) => sum + Number(row.value || 0), 0);

  const sellValue = rows
    .filter((row) => String(row.transactionType || "").toLowerCase().includes("sell"))
    .reduce((sum, row) => sum + Number(row.value || 0), 0);

  return (
    <section className="stock-analysis-section">
      <div className="stock-analysis-smart-money-header">
        <div>
          <div className="stock-analysis-card-label">Smart Money Signal</div>
          <h2>{ticker} Insider & Ownership Activity</h2>
          <p className="stock-analysis-muted">
            This panel connects the single-stock page to Bullionaire&apos;s Smart
            Money layer. V1 uses seeded demo transactions, and the same structure
            can later be powered by SEC Form 4, 13F, and political disclosure data.
          </p>
        </div>

        <div
          className={`stock-analysis-smart-money-signal ${getSmartMoneySignalClass(
            signal
          )}`}
        >
          <span>Current Signal</span>
          <strong>{signal}</strong>
        </div>
      </div>

      <div className="stock-analysis-grid">
        <RawMetricCard label="Recent Transactions" value={rows.length || "None"} />
        <RawMetricCard label="Insider Buy Value" value={formatLargeMoney(buyValue)} />
        <RawMetricCard label="Insider Sell Value" value={formatLargeMoney(sellValue)} />
        <RawMetricCard
          label="Ownership Context"
          value={rows.length ? "Detected" : "Coming soon"}
        />
      </div>

      <div className="stock-analysis-section nested">
        <div className="stock-analysis-section-top">
          <h3>Recent Smart Money Activity</h3>

          <button
            type="button"
            className="stock-analysis-smart-money-button"
            onClick={() => navigate("/dashboard?tab=SmartMoney")}
          >
            Open Smart Money Dashboard
          </button>
        </div>

        {rows.length ? (
          <div className="stock-analysis-table-wrap">
            <table className="stock-analysis-table">
              <thead>
                <tr>
                  <th>Insider</th>
                  <th>Title</th>
                  <th>Transaction</th>
                  <th>Shares</th>
                  <th>Value</th>
                  <th>Date</th>
                  <th>Signal</th>
                </tr>
              </thead>

              <tbody>
                {rows.map((row, index) => (
                  <tr key={`${row.ticker}-${row.date}-${index}`}>
                    <td>{row.insider}</td>
                    <td>{row.title}</td>
                    <td>{row.transactionType}</td>
                    <td>{formatLargeNumber(row.shares)}</td>
                    <td>{formatLargeMoney(row.value)}</td>
                    <td>{row.date}</td>
                    <td>
                      <span
                        className={`stock-analysis-smart-money-pill ${getSmartMoneySignalClass(
                          row.signal
                        )}`}
                      >
                        {row.signal}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="stock-analysis-sec-empty">
            <h3>No Smart Money Activity Found Yet</h3>
            <p>
              No seeded Smart Money transactions are currently attached to {ticker}.
              This is ready for real Form 4 insider transaction data once the backend
              feed is connected.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

export default function StockAnalysis() {
  const { ticker } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const cleanTicker = String(ticker || "").toUpperCase();
  const navigationStock =
    String(location.state?.stock?.Ticker || "").toUpperCase() === cleanTicker
      ? location.state.stock
      : null;
  const initialCachedAnalysis = readClientCache(
    STOCK_ANALYSIS_CLIENT_CACHE,
    cleanTicker,
    STOCK_ANALYSIS_CLIENT_TTL_MS
  );
  const initialAnalysis =
    initialCachedAnalysis || makeSeedAnalysis(cleanTicker, navigationStock);

  const [analysis, setAnalysis] = useState(initialAnalysis);
  const [chartData, setChartData] = useState([]);
  const [chartRange, setChartRange] = useState("1Y");
  const [activeTab, setActiveTab] = useState("Overview");

  const [secFinancials, setSecFinancials] = useState(null);
  const [secFinancialsLoading, setSecFinancialsLoading] = useState(false);
  const [secFinancialsError, setSecFinancialsError] = useState("");
  const [secDeepDive, setSecDeepDive] = useState(null);
  const [secDeepDiveLoading, setSecDeepDiveLoading] = useState(false);
  const [secDeepDiveError, setSecDeepDiveError] = useState("");
  const [filingIntelligence, setFilingIntelligence] = useState(null);
  const [filingIntelligenceLoading, setFilingIntelligenceLoading] = useState(false);
  const [filingIntelligenceError, setFilingIntelligenceError] = useState("");
  const [liveQuote, setLiveQuote] = useState(() =>
    readClientCache(LIVE_QUOTE_CLIENT_CACHE, cleanTicker, LIVE_QUOTE_CLIENT_TTL_MS)
  );
  const [analystHistory, setAnalystHistory] = useState([]);

  const [loading, setLoading] = useState(!initialAnalysis);
  const [chartLoading, setChartLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const cached = readClientCache(
      STOCK_ANALYSIS_CLIENT_CACHE,
      cleanTicker,
      STOCK_ANALYSIS_CLIENT_TTL_MS
    );
    const routeStock =
      String(location.state?.stock?.Ticker || "").toUpperCase() === cleanTicker
        ? location.state.stock
        : null;

    if (cached) {
      setAnalysis(cached);
      setLoading(false);
      setError("");
      return () => {
        cancelled = true;
      };
    }

    if (routeStock) {
      setAnalysis(makeSeedAnalysis(cleanTicker, routeStock));
      setLoading(false);
    } else {
      setAnalysis(null);
      setLoading(true);
    }
    setError("");

    const loadAnalysis = async () => {
      try {
        const res = await fetch(`${API_BASE}/stocks/${cleanTicker}/analysis`);
        const data = await res.json();
        if (!res.ok || data?.error) {
          throw new Error(data?.error || "Failed to load stock analysis.");
        }
        if (!cancelled) {
          writeClientCache(STOCK_ANALYSIS_CLIENT_CACHE, cleanTicker, data);
          setAnalysis(data);
        }
      } catch (err) {
        console.error("Failed to load stock analysis:", err);
        if (!cancelled && !routeStock) {
          setError("Could not load this stock analysis.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    if (cleanTicker) loadAnalysis();
    return () => {
      cancelled = true;
    };
  }, [cleanTicker]);

  useEffect(() => {
    let active = true;
    let intervalId = null;

    const cachedQuote = readClientCache(
      LIVE_QUOTE_CLIENT_CACHE,
      cleanTicker,
      LIVE_QUOTE_CLIENT_TTL_MS
    );
    if (cachedQuote) setLiveQuote(cachedQuote);
    else if (navigationStock) {
      setLiveQuote({
        "Current Price": navigationStock["Current Price"],
        "Today Change %": navigationStock["Today Change %"],
        "Previous Close": navigationStock["Previous Close"],
        "Day Open": navigationStock["Day Open"],
        "Day High": navigationStock["Day High"],
        "Day Low": navigationStock["Day Low"],
        "Day Volume": navigationStock["Day Volume"],
      });
    } else {
      setLiveQuote(null);
    }

    const loadLiveQuote = async () => {
      if (!cleanTicker || (typeof document !== "undefined" && document.hidden)) return;
      try {
        const res = await fetch(
          `${API_BASE}/stocks/live-prices?tickers=${encodeURIComponent(cleanTicker)}`
        );
        const data = await res.json();
        const quote = data?.rows?.[cleanTicker] || null;
        if (active && quote && numericOrNull(quote["Current Price"]) !== null) {
          writeClientCache(LIVE_QUOTE_CLIENT_CACHE, cleanTicker, quote);
          setLiveQuote(quote);
        }
      } catch (err) {
        console.error("Failed to load live stock snapshot:", err);
      }
    };

    if (!cachedQuote) loadLiveQuote();
    intervalId = window.setInterval(loadLiveQuote, 15000);

    const handleVisibility = () => {
      if (!document.hidden) loadLiveQuote();
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      active = false;
      if (intervalId) window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [cleanTicker]);

  useEffect(() => {
    if (!cleanTicker || activeTab !== "Overview") return undefined;
    let cancelled = false;
    const cacheKey = `${cleanTicker}:${chartRange}`;
    const cached = readClientCache(
      STOCK_CHART_CLIENT_CACHE,
      cacheKey,
      STOCK_CHART_CLIENT_TTL_MS
    );

    if (cached) {
      setChartData(cached);
      setChartLoading(false);
      return undefined;
    }

    const loadChart = async () => {
      try {
        setChartLoading(true);
        const res = await fetch(
          `${API_BASE}/stocks/${cleanTicker}/chart?range=${chartRange}`
        );
        const data = await res.json();
        const points = Array.isArray(data?.points) ? data.points : [];
        if (!cancelled) {
          writeClientCache(STOCK_CHART_CLIENT_CACHE, cacheKey, points);
          setChartData(points);
        }
      } catch (err) {
        console.error("Failed to load chart:", err);
        if (!cancelled) setChartData([]);
      } finally {
        if (!cancelled) setChartLoading(false);
      }
    };

    loadChart();
    return () => {
      cancelled = true;
    };
  }, [cleanTicker, chartRange, activeTab]);

  useEffect(() => {
    if (!cleanTicker || activeTab !== "Analysts") return undefined;
    let cancelled = false;
    const cacheKey = `${cleanTicker}:1Y`;
    const cached = readClientCache(
      STOCK_CHART_CLIENT_CACHE,
      cacheKey,
      STOCK_CHART_CLIENT_TTL_MS
    );

    if (cached) {
      setAnalystHistory(cached);
      return undefined;
    }

    const loadAnalystHistory = async () => {
      try {
        const res = await fetch(`${API_BASE}/stocks/${cleanTicker}/chart?range=1Y`);
        const data = await res.json();
        const points = Array.isArray(data?.points) ? data.points : [];
        if (!cancelled) {
          writeClientCache(STOCK_CHART_CLIENT_CACHE, cacheKey, points);
          setAnalystHistory(points);
        }
      } catch (err) {
        console.error("Failed to load analyst history chart:", err);
        if (!cancelled) setAnalystHistory([]);
      }
    };

    loadAnalystHistory();
    return () => {
      cancelled = true;
    };
  }, [cleanTicker, activeTab]);

  useEffect(() => {
    if (!cleanTicker || loading) return undefined;

    let cancelled = false;
    let delayId = null;
    let idleId = null;

    const warmDeepDive = async () => {
      try {
        setSecDeepDiveLoading(true);
        const data = await getCachedApiResource({
          cache: SEC_DEEP_DIVE_CLIENT_CACHE,
          inflight: SEC_DEEP_DIVE_INFLIGHT,
          key: cleanTicker,
          ttlMs: SEC_CLIENT_TTL_MS,
          url: `${API_BASE}/stocks/${cleanTicker}/sec-deep-dive`,
          fallbackMessage: "Failed to load SEC deep dive.",
        });
        if (!cancelled) {
          setSecDeepDive(data);
          setSecDeepDiveError("");
        }
      } catch (err) {
        console.error("Background SEC deep dive preload failed:", err);
        if (!cancelled) {
          setSecDeepDiveError("SEC quarterly and TTM data are not available for this ticker yet.");
        }
      } finally {
        if (!cancelled) setSecDeepDiveLoading(false);
      }
    };

    const warmSecFinancials = async () => {
      try {
        setSecFinancialsLoading(true);
        const data = await getCachedApiResource({
          cache: SEC_FINANCIALS_CLIENT_CACHE,
          inflight: SEC_FINANCIALS_INFLIGHT,
          key: cleanTicker,
          ttlMs: SEC_CLIENT_TTL_MS,
          url: `${API_BASE}/stocks/${cleanTicker}/sec-financials`,
          fallbackMessage: "Failed to load SEC financials.",
        });
        if (!cancelled) {
          setSecFinancials(data);
          setSecFinancialsError("");
        }
      } catch (err) {
        console.error("Background SEC financials preload failed:", err);
        if (!cancelled) {
          setSecFinancialsError("SEC financials are not available for this ticker yet.");
        }
      } finally {
        if (!cancelled) setSecFinancialsLoading(false);
      }
    };

    const warmFilingIntelligence = async () => {
      try {
        setFilingIntelligenceLoading(true);
        const data = await getCachedApiResource({
          cache: FILING_INTELLIGENCE_CLIENT_CACHE,
          inflight: FILING_INTELLIGENCE_INFLIGHT,
          key: cleanTicker,
          ttlMs: SEC_CLIENT_TTL_MS,
          url: `${API_BASE}/stocks/${cleanTicker}/filing-intelligence`,
          fallbackMessage: "Failed to load filing intelligence.",
        });
        if (!cancelled) {
          setFilingIntelligence(data);
          setFilingIntelligenceError("");
        }
      } catch (err) {
        console.error("Background filing intelligence preload failed:", err);
        if (!cancelled) {
          setFilingIntelligenceError("Filing intelligence is not available for this ticker yet.");
        }
      } finally {
        if (!cancelled) setFilingIntelligenceLoading(false);
      }
    };

    const runBackgroundWarmup = async () => {
      // Deep-dive data powers Analysts as well as Financials, so warm it first.
      await warmDeepDive();
      if (cancelled) return;
      await sleepMs(STOCK_BACKGROUND_STAGE_GAP_MS);
      await warmSecFinancials();
      if (cancelled) return;
      await sleepMs(STOCK_BACKGROUND_STAGE_GAP_MS);
      await warmFilingIntelligence();
    };

    const scheduleWarmup = () => {
      if (typeof window.requestIdleCallback === "function") {
        idleId = window.requestIdleCallback(runBackgroundWarmup, {
          timeout: STOCK_BACKGROUND_IDLE_TIMEOUT_MS,
        });
      } else {
        runBackgroundWarmup();
      }
    };

    delayId = window.setTimeout(scheduleWarmup, STOCK_BACKGROUND_PRELOAD_DELAY_MS);

    return () => {
      cancelled = true;
      if (delayId) window.clearTimeout(delayId);
      if (idleId && typeof window.cancelIdleCallback === "function") {
        window.cancelIdleCallback(idleId);
      }
    };
  }, [cleanTicker, loading]);

  useEffect(() => {
    if (!cleanTicker || !["Financials", "Analysts"].includes(activeTab)) return undefined;
    let cancelled = false;

    const loadSecDeepDive = async () => {
      try {
        setSecDeepDiveLoading(true);
        setSecDeepDiveError("");
        const data = await getCachedApiResource({
          cache: SEC_DEEP_DIVE_CLIENT_CACHE,
          inflight: SEC_DEEP_DIVE_INFLIGHT,
          key: cleanTicker,
          ttlMs: SEC_CLIENT_TTL_MS,
          url: `${API_BASE}/stocks/${cleanTicker}/sec-deep-dive`,
          fallbackMessage: "Failed to load SEC deep dive.",
        });
        if (!cancelled) setSecDeepDive(data);
      } catch (err) {
        console.error("Failed to load SEC deep dive:", err);
        if (!cancelled) {
          setSecDeepDiveError("SEC quarterly and TTM data are not available for this ticker yet.");
        }
      } finally {
        if (!cancelled) setSecDeepDiveLoading(false);
      }
    };

    loadSecDeepDive();
    return () => {
      cancelled = true;
    };
  }, [cleanTicker, activeTab]);

  useEffect(() => {
    if (!cleanTicker || activeTab !== "Financials") return undefined;
    let cancelled = false;

    const loadSecFinancials = async () => {
      try {
        setSecFinancialsLoading(true);
        setSecFinancialsError("");
        const data = await getCachedApiResource({
          cache: SEC_FINANCIALS_CLIENT_CACHE,
          inflight: SEC_FINANCIALS_INFLIGHT,
          key: cleanTicker,
          ttlMs: SEC_CLIENT_TTL_MS,
          url: `${API_BASE}/stocks/${cleanTicker}/sec-financials`,
          fallbackMessage: "Failed to load SEC financials.",
        });
        if (!cancelled) setSecFinancials(data);
      } catch (err) {
        console.error("Failed to load SEC financials:", err);
        if (!cancelled) {
          setSecFinancialsError("SEC financials are not available for this ticker yet.");
        }
      } finally {
        if (!cancelled) setSecFinancialsLoading(false);
      }
    };

    const loadFilingIntelligence = async () => {
      try {
        setFilingIntelligenceLoading(true);
        setFilingIntelligenceError("");
        const data = await getCachedApiResource({
          cache: FILING_INTELLIGENCE_CLIENT_CACHE,
          inflight: FILING_INTELLIGENCE_INFLIGHT,
          key: cleanTicker,
          ttlMs: SEC_CLIENT_TTL_MS,
          url: `${API_BASE}/stocks/${cleanTicker}/filing-intelligence`,
          fallbackMessage: "Failed to load filing intelligence.",
        });
        if (!cancelled) setFilingIntelligence(data);
      } catch (err) {
        console.error("Failed to load filing intelligence:", err);
        if (!cancelled) {
          setFilingIntelligenceError("Filing intelligence is not available for this ticker yet.");
        }
      } finally {
        if (!cancelled) setFilingIntelligenceLoading(false);
      }
    };

    loadSecFinancials();
    loadFilingIntelligence();
    return () => {
      cancelled = true;
    };
  }, [cleanTicker, activeTab]);

  const stock = analysis?.stock;
const peers = analysis?.peers || [];
const peerStats = analysis?.peer_stats || {};
const relative = analysis?.relative || {};
const snapshotScore = analysis?.snapshot_score;
const badges = analysis?.badges || [];

const dependencyExposureCount = useMemo(() => {
  const activeTicker = stock?.Ticker;
  if (!activeTicker) return 0;

  const reverseMacroMap = buildReverseMacroMap();
  const rawExposures = reverseMacroMap[activeTicker] || [];

  const uniqueScenarios = new Set();

  rawExposures.forEach((entry) => {
    uniqueScenarios.add(
      `${entry.macro}__${entry.macroDirection}__${entry.finalDirection}`
    );
  });

  return uniqueScenarios.size;
}, [stock?.Ticker]);

const hasSupplyChainMap = Boolean(stock?.Ticker && supplyChainTree?.[stock.Ticker]);

const hasAnalystData = Boolean(
  stock?.["Mean Target"] ||
    stock?.["Analyst Upside"] ||
    stock?.["Analyst Downside"] ||
    stock?.["Number of Analysts"]
);

const hasTechnicalData = Boolean(
  stock?.RSI ||
    stock?.MACD ||
    stock?.["MACD Signal"] ||
    stock?.["MACD Histogram"] ||
    stock?.["SMA 20"]
);

const coverageItems = [
  {
    label: "Snapshot Score",
    status: snapshotScore !== undefined && snapshotScore !== null ? "Available" : "Limited",
    tone: snapshotScore !== undefined && snapshotScore !== null ? "strong" : "partial",
  },
  {
    label: "Peer Comparison",
    status: peers.length ? `${peers.length} peers` : "Limited",
    tone: peers.length ? "strong" : "partial",
  },
  {
    label: "Analyst Data",
    status: hasAnalystData ? "Available" : "Limited",
    tone: hasAnalystData ? "strong" : "partial",
  },
  {
    label: "Technical Signals",
    status: hasTechnicalData ? "Available" : "Limited",
    tone: hasTechnicalData ? "strong" : "partial",
  },
  {
    label: "Dependency Map",
    status: dependencyExposureCount
      ? `${dependencyExposureCount} scenarios`
      : "Not Yet Curated",
    tone: dependencyExposureCount ? "strong" : "missing",
  },
  {
    label: "Supply Chain",
    status: hasSupplyChainMap ? "Curated Map" : "Not Yet Curated",
    tone: hasSupplyChainMap ? "strong" : "missing",
  },
  {
  label: "SEC Financials",
  status: secFinancials?.coverage_status === "full"
    ? "Full"
    : secFinancials?.coverage_status === "partial"
    ? "Partial"
    : secFinancials
    ? "Limited"
    : "Loading",
  tone: secFinancials?.coverage_status === "full" ? "strong" : secFinancials ? "partial" : "coming",
},
];

const thesis = buildThesis({
  stock,
  peerStats,
  relative,
  snapshotScore,
  dependencyExposureCount,
  hasSupplyChainMap,
});

  if (loading) {
    return (
      <>
        <Navbar />
        <div className="stock-analysis-page">
          <div className="stock-analysis-loading">Loading {cleanTicker}...</div>
        </div>
      </>
    );
  }

  if (error || !stock) {
    return (
      <>
        <Navbar />
        <div className="stock-analysis-page">
          <button
            className="stock-analysis-back-button"
            onClick={() => navigate("/dashboard")}
          >
            ← Back to Dashboard
          </button>

          <div className="stock-analysis-error">
            {error || "No stock data found."}
          </div>
        </div>
      </>
    );
  }

  const displayCurrentPrice =
    numericOrNull(liveQuote?.["Current Price"]) ?? numericOrNull(stock["Current Price"]);
  const todayChange =
    numericOrNull(liveQuote?.["Today Change %"]) ?? stock["Today Change %"];

  return (
    <>
      <Navbar />

      <div className="stock-analysis-page">
        <button
          className="stock-analysis-back-button"
          onClick={() => navigate("/dashboard")}
        >
          ← Back to Dashboard
        </button>

        <section className="stock-analysis-header">
          <div>
            <div className="stock-analysis-kicker">Single Stock Analysis</div>
            <h1>
              {stock.Ticker} — {stock["Company Name"] || "Unknown Company"}
            </h1>

            <div className="stock-analysis-subtitle">
              {stock.Sector || "Unknown Sector"}{" "}
              {stock.Type ? `• ${stock.Type}` : ""}
            </div>
          </div>

          <div className="stock-analysis-price-box">
            <div className="stock-analysis-price">
              ${formatValue(displayCurrentPrice)}
            </div>
            <div style={{ fontSize: 11, opacity: 0.66, marginTop: 2 }}>
              {numericOrNull(liveQuote?.["Current Price"]) !== null
                ? "● Live market snapshot"
                : "Database price fallback"}
            </div>

            <div
              className={
                Number(todayChange) >= 0
                  ? "stock-analysis-change positive"
                  : "stock-analysis-change negative"
              }
            >
              {formatPercent(todayChange)}
            </div>
          </div>
         </section>

        <section className="stock-analysis-section">
          <div className="stock-analysis-advanced-top">
            <SnapshotScore score={snapshotScore} />

            <div className="stock-analysis-thesis-card">
              <div className="stock-analysis-card-label">
                Investment Snapshot
              </div>

              <div className="stock-analysis-thesis-title">
                {getScoreLabel(snapshotScore)} setup based on valuation, analyst
                upside, technicals, and risk signals.
              </div>

              <p>
                This is a quick quantitative snapshot, not a recommendation. It
                compares {stock.Ticker} against sector peers using your available
                Bullionaire data.
              </p>

              <BadgeList badges={badges} />
            </div>
          </div>
        </section>

        <IntelligenceCoverage
          items={coverageItems}
          scoreLabel={getScoreLabel(snapshotScore)}
        />

        <div className="stock-analysis-tabs">
          {analysisTabs.map((tab) => (
            <TabButton
              key={tab}
              tab={tab}
              activeTab={activeTab}
              setActiveTab={setActiveTab}
            />
          ))}
        </div>

        {activeTab === "Thesis" && (
          <ThesisTab thesis={thesis} stock={stock} />
        )}

        {activeTab === "Overview" && (
          <>
            {stock.Description && (
              <section className="stock-analysis-section">
                <h2>Company Description</h2>
                <p className="stock-analysis-description">{stock.Description}</p>
              </section>
            )}

            <section className="stock-analysis-section">
              <div className="stock-analysis-section-top">
                <h2>Price Performance</h2>

                <div className="stock-analysis-range-buttons">
                  {ranges.map((range) => (
                    <button
                      key={range}
                      className={chartRange === range ? "active" : ""}
                      onClick={() => setChartRange(range)}
                    >
                      {range}
                    </button>
                  ))}
                </div>
              </div>

              <div className="stock-analysis-chart-wrap">
                {chartLoading ? (
                  <div className="stock-analysis-empty">Loading chart...</div>
                ) : (
                  <SimpleChart points={chartData} />
                )}
              </div>
            </section>

            <section className="stock-analysis-section">
              <h2>Relative Peer Comparison</h2>

              <div className="stock-analysis-comparison-grid">
                <ComparisonCard
                  label="P/E Ratio"
                  stockValue={stock["P/E (TTM)"]}
                  peerValue={peerStats.median_pe}
                  difference={relative.pe_vs_peer_median_pct}
                />

                <ComparisonCard
                  label="Beta"
                  stockValue={stock.Beta}
                  peerValue={peerStats.median_beta}
                  difference={relative.beta_vs_peer_median_pct}
                />

                <ComparisonCard
                  label="RSI"
                  stockValue={stock.RSI}
                  peerValue={peerStats.median_rsi}
                  difference={relative.rsi_vs_peer_median_pct}
                />

                <ComparisonCard
                  label="Dividend Yield"
                  stockValue={stock["Dividend Yield"]}
                  peerValue={peerStats.median_dividend_yield}
                  difference={relative.dividend_vs_peer_median_pct}
                  suffix="%"
                />
              </div>
            </section>
          </>
        )}

        {activeTab === "Financials" && (
          <FinancialsAccordion key={ticker}>
            <CollapsibleSection
              title="Valuation & Key Statistics"
              className="stock-analysis-section"
              headingLevel={2}
              accent={FINANCIAL_SECTION_COLORS.valuation}
              badge="VALUATION"
              summary={
                stock["P/E (TTM)"] !== null && stock["P/E (TTM)"] !== undefined
                  ? `P/E ${formatValue(stock["P/E (TTM)"])}`
                  : null
              }
              icon="valuation"
            >
              <div className="stock-analysis-grid">
                <RawMetricCard
                  label="Market Cap"
                  value={formatLargeMoney(
                    stock["Market Cap"],
                    stock["Quote Currency"] || "USD"
                  )}
                />
                <MetricCard label="P/E (TTM)" value={stock["P/E (TTM)"]} />
                <MetricCard label="EPS (TTM)" value={stock["EPS (TTM)"]} />
                <RawMetricCard
                  label="Dividend Yield"
                  value={formatDividendYield(stock["Dividend Yield"])}
                />
                <MetricCard label="Beta" value={stock.Beta} />
                <RawMetricCard
                  label="EBITDA"
                  value={formatLargeMoney(
                    stock.EBITDA,
                    stock["Financial Currency"] ||
                      stock["Quote Currency"] ||
                      "USD"
                  )}
                />
                <RawMetricCard
                  label="Gross Profit"
                  value={formatLargeMoney(
                    stock["Gross Profit"],
                    stock["Financial Currency"] ||
                      stock["Quote Currency"] ||
                      "USD"
                  )}
                />
                <MetricCard
                  label="Short % of Float"
                  value={stock["Short % of Float"]}
                  suffix="%"
                />
              </div>
            </CollapsibleSection>

            <section className="stock-analysis-section">
              <SecFinancialsPanel
                data={secFinancials}
                loading={secFinancialsLoading}
                error={secFinancialsError}
              />
            </section>

            <section className="stock-analysis-section">
              <SecDeepDivePanel
                data={secDeepDive}
                loading={secDeepDiveLoading}
                error={secDeepDiveError}
              />
            </section>

            <section className="stock-analysis-section">
              <FilingIntelligencePanel
                data={filingIntelligence}
                loading={filingIntelligenceLoading}
                error={filingIntelligenceError}
                reportingCurrency={
                  secFinancials?.reporting_currency ||
                  stock["Financial Currency"] ||
                  stock["Quote Currency"] ||
                  "USD"
                }
              />
            </section>

            <div
              className="stock-analysis-sec-note"
              style={{
                marginTop: 16,
                padding: "16px 18px",
                border: "1px solid rgba(148, 163, 184, 0.22)",
                borderRadius: 12,
                lineHeight: 1.6,
              }}
            >
              <strong>Data Disclaimer:</strong>{" "}
              Financial information on this page is automatically extracted,
              interpreted, and normalized from SEC filings and related filing data.
              Automated parsing may produce errors involving classification, units,
              timing, period matching, or issuer-specific reporting formats. Data may
              therefore be incomplete, delayed, or inaccurate and may differ from the
              issuer&apos;s original filed statements. Bullionaire does not guarantee
              the accuracy or completeness of this information. Users should verify
              material information against the original SEC filing before making any
              investment or financial decision. Nothing on this page constitutes
              investment, legal, tax, or accounting advice.
            </div>
          </FinancialsAccordion>
        )}

        {activeTab === "Smart Money" && (
  <StockSmartMoneyPanel
    stock={stock}
    navigate={navigate}
  />
)}

        {activeTab === "Analysts" && (
          <AnalystsDashboard
            stock={stock}
            livePrice={displayCurrentPrice}
            analystTargets={analysis?.analyst_targets}
            historyPoints={analystHistory}
            quarterlyHistory={secDeepDive?.quarterly_history || []}
            epsEstimates={analysis?.eps_estimates}
            reportingCurrency={
              secDeepDive?.reporting_currency ||
              secFinancials?.reporting_currency ||
              stock["Financial Currency"] ||
              stock["Quote Currency"] ||
              "USD"
            }
          />
        )}

        {activeTab === "Technicals" && (
          <section className="stock-analysis-section">
            <h2>Technical Snapshot</h2>

            <div className="stock-analysis-grid">
              <MetricCard label="Previous Close" value={stock["Previous Close"]} />
              <MetricCard label="Day Open" value={stock["Day Open"]} />
              <MetricCard label="Day High" value={stock["Day High"]} />
              <MetricCard label="Day Low" value={stock["Day Low"]} />
              <MetricCard label="Day Volume" value={stock["Day Volume"]} />
              <MetricCard label="RSI" value={stock.RSI} />
              <MetricCard label="MACD" value={stock.MACD} />
              <MetricCard label="MACD Signal" value={stock["MACD Signal"]} />
              <MetricCard label="MACD Histogram" value={stock["MACD Histogram"]} />
              <MetricCard label="SMA 20" value={stock["SMA 20"]} />
            </div>
          </section>
        )}

        {activeTab === "Risk Radar" && (
          <RiskRadar
            stock={stock}
            relative={relative}
            dependencyExposureCount={dependencyExposureCount}
            hasSupplyChainMap={hasSupplyChainMap}
          />
        )}

        {activeTab === "What Moves It" && (
          <WhatMovesItTab thesis={thesis} stock={stock} />
        )}

        {activeTab === "Dependency Map" && (
          <DependencyExposureTab ticker={stock.Ticker} />
        )}

        {activeTab === "Supply Chain" && (
          <SupplyChainTab ticker={stock.Ticker} navigate={navigate} />
        )}

        {activeTab === "Peers" && (
          <section className="stock-analysis-section">
            <h2>Industry / Sector Peers</h2>

            <div className="stock-analysis-table-wrap">
              <table className="stock-analysis-table">
                <thead>
                  <tr>
                    <th>Ticker</th>
                    <th>Company</th>
                    <th>Sector</th>
                    <th>Price</th>
                    <th>Market Cap</th>
                    <th>P/E</th>
                    <th>Peer P/E Diff</th>
                    <th>Beta</th>
                    <th>RSI</th>
                    <th>Today</th>
                  </tr>
                </thead>

                <tbody>
                  {peers.length ? (
                    peers.map((peer) => (
                      <tr key={peer.Ticker}>
                        <td>
                          <button
                            className="stock-analysis-peer-link"
                            onClick={() => navigate(`/stocks/${peer.Ticker}`, { state: { stock: peer } })}
                          >
                            {peer.Ticker}
                          </button>
                        </td>
                        <td>{peer["Company Name"] || "--"}</td>
                        <td>{peer.Sector || "--"}</td>
                        <td>{formatValue(peer["Current Price"])}</td>
                        <td>{formatValue(peer["Market Cap"])}</td>
                        <td>{formatValue(peer["P/E (TTM)"])}</td>
                        <td>{formatSignedPercent(peer["Peer P/E Difference %"])}</td>
                        <td>{formatValue(peer.Beta)}</td>
                        <td>{formatValue(peer.RSI)}</td>
                        <td>{formatPercent(peer["Today Change %"])}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="10">No peers found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {activeTab === "Compare" && (
          <CompareFoundationTab
            stock={stock}
            peers={peers}
            navigate={navigate}
          />
        )}

        {activeTab === "Filings" && (
          <section className="stock-analysis-section">
            <h2>Filings</h2>

            <div className="stock-analysis-filings">
              <div>
                <span>Latest 10-K:</span>{" "}
                {stock["Latest 10-K URL"] ? (
                  <a href={stock["Latest 10-K URL"]} target="_blank" rel="noreferrer">
                    {stock["Latest 10-K Date"] || "Open 10-K"}
                  </a>
                ) : (
                  "--"
                )}
              </div>

              <div>
                <span>Latest 10-Q:</span>{" "}
                {stock["Latest 10-Q URL"] ? (
                  <a href={stock["Latest 10-Q URL"]} target="_blank" rel="noreferrer">
                    {stock["Latest 10-Q Date"] || "Open 10-Q"}
                  </a>
                ) : (
                  "--"
                )}
              </div>

              <div>
                <span>Last Updated:</span> {stock["Last Updated"] || "--"}
              </div>
            </div>
          </section>
        )}
      </div>
    </>
  );
}