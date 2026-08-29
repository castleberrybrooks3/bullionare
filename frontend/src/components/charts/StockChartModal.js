import React, { useEffect, useState } from "react";
import AdvancedStockChart from "./AdvancedStockChart";
import ChartControls from "./ChartControls";
import ChartPerformanceBadge from "./ChartPerformanceBadge";
import { getChartPerformance } from "../../utils/chartUtils";
import TechnicalOverlayControls from "./TechnicalOverlayControls";
import { buildTechnicalSummary } from "../../utils/technicalIndicators";
import TechnicalSummaryPanel from "./TechnicalSummaryPanel";
import MomentumPanel from "./MomentumPanel";
import {
  buildValueGrowthSetup,
  combineEntryAndValueGrowthSetup,
} from "../../utils/fundamentalSetup";

const chartClientCache = new Map();
const CHART_CLIENT_CACHE_MAX_ENTRIES = 24;

const getChartCacheKey = (ticker, range) =>
  `${String(ticker || "").toUpperCase()}:${String(range || "1D")}`;

const rememberChart = (ticker, range, points) => {
  if (!Array.isArray(points) || !points.length) return;

  const key = getChartCacheKey(ticker, range);

  // Reinsert to keep this Map in simple least-recently-used order.
  if (chartClientCache.has(key)) {
    chartClientCache.delete(key);
  }

  chartClientCache.set(key, {
    points,
    cachedAt: Date.now(),
  });

  while (chartClientCache.size > CHART_CLIENT_CACHE_MAX_ENTRIES) {
    const oldestKey = chartClientCache.keys().next().value;
    chartClientCache.delete(oldestKey);
  }
};

export default function StockChartModal({
  isOpen,
  ticker,
  stockContext,
  onClose,
  API_BASE,
}) {
  const [chartRange, setChartRange] = useState("1D");
  const [chartType, setChartType] = useState("mountain");
  const [chartData, setChartData] = useState([]);
  const [chartLoading, setChartLoading] = useState(false);
  const [selectedRangePopup, setSelectedRangePopup] = useState(null);
  const [lastClickedRange, setLastClickedRange] = useState(null);
  const [showTechnicalPanel, setShowTechnicalPanel] = useState(false);
  const [showTechnicalSummary, setShowTechnicalSummary] = useState(false);
  const [showMomentumPanel, setShowMomentumPanel] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [tipsEnabled, setTipsEnabled] = useState(true);

  const [enabledOverlays, setEnabledOverlays] = useState({
  smartLevels: false,
  sma20: false,
  sma50: false,
  sma100: false,
  ema21: false,
  bollinger: false,
  volume: true,
  vwap: false,
});

  const chartPerformance = getChartPerformance(chartData);
  const baseTechnicalSummary = buildTechnicalSummary(chartData);
const valueGrowthSetup = buildValueGrowthSetup(stockContext);
const technicalSummary = combineEntryAndValueGrowthSetup(
  baseTechnicalSummary,
  valueGrowthSetup
);

  useEffect(() => {
    if (!isOpen || !ticker) return undefined;

    const controller = new AbortController();
    const cacheKey = getChartCacheKey(ticker, chartRange);
    const cached = chartClientCache.get(cacheKey);
    const cachedPoints = Array.isArray(cached?.points) ? cached.points : [];
    const hadCachedChart = cachedPoints.length > 0;

    if (hadCachedChart) {
      // Show the previous fully rendered chart immediately, then refresh it.
      setChartData(cachedPoints);
    } else {
      setChartData([]);
    }

    const fetchChart = async () => {
      try {
        setChartLoading(true);
        setSelectedRangePopup(null);

        const res = await fetch(
          `${API_BASE}/stocks/${ticker}/chart?range=${encodeURIComponent(
            chartRange
          )}`,
          { signal: controller.signal }
        );

        const data = await res.json();
        const freshPoints = Array.isArray(data?.points) ? data.points : [];

        if (freshPoints.length) {
          setChartData(freshPoints);
          rememberChart(ticker, chartRange, freshPoints);
        } else if (!hadCachedChart) {
          setChartData([]);
        }
      } catch (err) {
        if (err.name === "AbortError") return;

        console.error("Failed to load chart", err);
        if (!hadCachedChart) {
          setChartData([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setChartLoading(false);
        }
      }
    };

    fetchChart();

    return () => controller.abort();
  }, [isOpen, ticker, chartRange, API_BASE]);

  useEffect(() => {
  if (!lastClickedRange) return;
  if (chartLoading) return;
  if (!chartPerformance) return;

  setSelectedRangePopup({
    range: lastClickedRange,
    pct: chartPerformance.pct,
    isUp: chartPerformance.pct >= 0,
    createdAt: Date.now(),
  });

  const timer = setTimeout(() => {
    setSelectedRangePopup(null);
    setLastClickedRange(null);
  }, 1400);

  return () => clearTimeout(timer);
}, [lastClickedRange, chartLoading, chartPerformance, setSelectedRangePopup]);

const [drawingMode, setDrawingMode] = useState(null);
const [drawingColor, setDrawingColor] = useState("#38bdf8"); // default blue
const [compareSymbol, setCompareSymbol] = useState(null);
const [showCompareControls, setShowCompareControls] = useState(false);
const [showDrawControls, setShowDrawControls] = useState(false);

  useEffect(() => {
  if (isOpen) {
    setChartRange("1D");
    setChartType("mountain");
    setSelectedRangePopup(null);
    setLastClickedRange("1D");
    setShowTechnicalPanel(false);
    setShowTechnicalSummary(false);
    setShowMomentumPanel(false);
    setIsMaximized(false);
    setCompareSymbol(null);
setShowCompareControls(false);
setShowDrawControls(false);
setDrawingMode(null);
    return;
  }

  setChartRange("1D");
  setChartType("mountain");
  setChartData([]);
  setSelectedRangePopup(null);
  setLastClickedRange(null);
  setShowTechnicalPanel(false);
  setShowTechnicalSummary(false);
  setShowMomentumPanel(false);
  setIsMaximized(false);
  setCompareSymbol(null);
setShowCompareControls(false);
setShowDrawControls(false);
setDrawingMode(null);
}, [isOpen]);

  if (!isOpen) return null;

  return (
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
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
  width: isMaximized ? "100vw" : "90%",
  maxWidth: isMaximized ? "100vw" : "1100px",
  height: isMaximized ? "100vh" : "75vh",
  background: "#111827",
  borderRadius: isMaximized ? "0px" : "14px",
  padding: isMaximized ? "18px" : "20px",
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
          <div>
            <h2 style={{ margin: 0 }}>{ticker} Chart</h2>
            <ChartPerformanceBadge chartPerformance={chartPerformance} />
          </div>

          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
  <button
    onClick={() => setIsMaximized((prev) => !prev)}
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
    {isMaximized ? "Minimize" : "Maximize"}
  </button>

  <button
    onClick={onClose}
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
        </div>

<ChartControls
  chartRange={chartRange}
  setChartRange={(range) => {
    setLastClickedRange(range);
    setChartRange(range);
  }}
  chartType={chartType}
  setChartType={setChartType}
  chartPerformance={chartPerformance}
  selectedRangePopup={selectedRangePopup}
  setSelectedRangePopup={setSelectedRangePopup}
  showTechnicalPanel={showTechnicalPanel}
  setShowTechnicalPanel={setShowTechnicalPanel}
  showTechnicalSummary={showTechnicalSummary}
  setShowTechnicalSummary={setShowTechnicalSummary}
  showMomentumPanel={showMomentumPanel}
  setShowMomentumPanel={setShowMomentumPanel}
  compareSymbol={compareSymbol}
  setCompareSymbol={setCompareSymbol}
  showCompareControls={showCompareControls}
  setShowCompareControls={setShowCompareControls}
  drawingMode={drawingMode}
  setDrawingMode={setDrawingMode}
  drawingColor={drawingColor}
setDrawingColor={setDrawingColor}
  showDrawControls={showDrawControls}
setShowDrawControls={setShowDrawControls}
tipsEnabled={tipsEnabled}
onHideAllTips={() => setTipsEnabled(false)}
/>
{showTechnicalPanel && (
  <TechnicalOverlayControls
  enabledOverlays={enabledOverlays}
  setEnabledOverlays={setEnabledOverlays}
  tipsEnabled={tipsEnabled}
  onHideAllTips={() => setTipsEnabled(false)}
/>
)}

{showTechnicalSummary && (
  <TechnicalSummaryPanel
  technicalSummary={technicalSummary}
  tipsEnabled={tipsEnabled}
  onHideAllTips={() => setTipsEnabled(false)}
/>
)}
{showMomentumPanel && (
  <MomentumPanel
  technicalSummary={technicalSummary}
  tipsEnabled={tipsEnabled}
  onHideAllTips={() => setTipsEnabled(false)}
/>
)}

        <div
          style={{
            flex: 1,
            border: "1px solid #1f2937",
            borderRadius: "12px",
            overflow: "hidden",
            background: "#0b1120",
            minHeight: 0,
            position: "relative",
          }}
        >
          {chartLoading && !chartData.length ? (
            <div
              style={{
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#9ca3af",
              }}
            >
              Loading chart...
            </div>
          ) : (
            <>
              <AdvancedStockChart
                points={chartData}
                chartRange={chartRange}
                chartType={chartType}
                enabledOverlays={enabledOverlays}
                technicalSummary={technicalSummary}
                ticker={ticker}
                stockContext={stockContext}
                drawingMode={drawingMode}
                drawingColor={drawingColor}
                compareSymbol={compareSymbol}
                showCompareControls={showCompareControls}
                API_BASE={API_BASE}
              />

              {chartLoading && chartData.length > 0 && (
                <div
                  style={{
                    position: "absolute",
                    top: "12px",
                    right: "12px",
                    zIndex: 45,
                    padding: "6px 10px",
                    borderRadius: "999px",
                    border: "1px solid rgba(148, 163, 184, 0.35)",
                    background: "rgba(15, 23, 42, 0.88)",
                    color: "#cbd5e1",
                    fontSize: "11px",
                    fontWeight: 800,
                  }}
                >
                  Refreshing chart...
                </div>
              )}

              {!tipsEnabled && (
                <button
                  type="button"
                  onClick={() => setTipsEnabled(true)}
                  style={{
                    position: "absolute",
                    right: "12px",
                    bottom: "12px",
                    zIndex: 40,
                    padding: "7px 10px",
                    borderRadius: "999px",
                    border: "1px solid rgba(167,139,250,0.65)",
                    background: "rgba(88,28,135,0.88)",
                    color: "#ddd6fe",
                    fontSize: "12px",
                    fontWeight: 900,
                    cursor: "pointer",
                    boxShadow: "0 12px 26px rgba(0,0,0,0.35)",
                  }}
                >
                  Show Tips
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}