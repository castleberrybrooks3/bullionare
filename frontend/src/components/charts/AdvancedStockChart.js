import React, { useEffect, useMemo, useRef, useState } from "react";
import { formatChartTimeLabel } from "../../utils/chartUtils";
import {
  enrichChartPointsWithTechnicals,
  findRecentSupportResistance,
} from "../../utils/technicalIndicators";

const toNumber = (value) => {
  if (value == null || value === "") return null;
  const num = Number(String(value).replace(/[$,%]/g, "").replace(/,/g, ""));
  return Number.isFinite(num) ? num : null;
};

const formatPrice = (value) => {
  const num = toNumber(value);
  return num == null ? "--" : num.toFixed(2);
};

const formatVolume = (value) => {
  const num = toNumber(value);
  if (num == null) return "--";
  if (Math.abs(num) >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(2)}B`;
  if (Math.abs(num) >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
  if (Math.abs(num) >= 1_000) return `${(num / 1_000).toFixed(2)}K`;
  return num.toFixed(0);
};

const getDateOnly = (value) => {
  if (!value) return null;

  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString().slice(0, 10);
  } catch {
    return null;
  }
};

const getPointDateOnly = (time) => {
  try {
    const date = new Date(time);
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString().slice(0, 10);
  } catch {
    return null;
  }
};

const findNearestPointIndexByDate = (points, dateString) => {
  if (!dateString || !points.length) return null;

  let bestIndex = null;
  let bestDistance = Infinity;
  const target = new Date(dateString).getTime();

  points.forEach((point, index) => {
    const pointTime = new Date(point.time).getTime();
    if (Number.isNaN(pointTime)) return;

    const distance = Math.abs(pointTime - target);

    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  });

  return bestIndex;
};

export default function AdvancedStockChart({
  points = [],
  chartRange,
  chartType,
  enabledOverlays = {},
  technicalSummary = null,
  ticker = "",
  stockContext = null,
  drawingMode = null,
drawingColor = "#38bdf8",
compareSymbol = null,
  showCompareControls = false,
  API_BASE = "",
  isMobile = false,
}) {
  const [chartHover, setChartHover] = useState(null);
  const [drawings, setDrawings] = useState([]);
  const [pendingDrawingPoint, setPendingDrawingPoint] = useState(null);
  const [activeFreehandPath, setActiveFreehandPath] = useState(null);
  const [eraserMode, setEraserMode] = useState(false);
  const [isErasing, setIsErasing] = useState(false);
  const [comparePoints, setComparePoints] = useState([]);
  const chartWrapRef = useRef(null);
  const svgRef = useRef(null);
  const scrubPointerRef = useRef(null);

  const technicalPoints = useMemo(
    () => enrichChartPointsWithTechnicals(points),
    [points]
  );

  const keyLevels = useMemo(
    () => findRecentSupportResistance(technicalPoints),
    [technicalPoints]
  );

  const showSmartLevels = !!enabledOverlays.smartLevels;

  useEffect(() => {
    setChartHover(null);
    setPendingDrawingPoint(null);
  }, [points, chartRange, chartType]);

  useEffect(() => {
  if (drawingMode !== "pencil") {
    setEraserMode(false);
  }
}, [drawingMode]);

  useEffect(() => {
  const clearDrawings = () => {
    setDrawings([]);
    setPendingDrawingPoint(null);
  };

  window.addEventListener("bullionaire-clear-chart-drawings", clearDrawings);

  return () => {
    window.removeEventListener("bullionaire-clear-chart-drawings", clearDrawings);
  };
}, []);

  useEffect(() => {
    const fetchCompare = async () => {
      if (!API_BASE || !compareSymbol || !chartRange) {
        setComparePoints([]);
        return;
      }

      try {
        const res = await fetch(
          `${API_BASE}/stocks/${compareSymbol}/chart?range=${encodeURIComponent(
            chartRange
          )}`
        );

        const data = await res.json();
        setComparePoints(Array.isArray(data?.points) ? data.points : []);
      } catch (err) {
        console.error("Failed to load compare chart", err);
        setComparePoints([]);
      }
    };

    fetchCompare();
  }, [API_BASE, compareSymbol, chartRange]);

  const hasChartData = points.length > 0;

  const width = isMobile ? 430 : 950;
  const height = isMobile ? 390 : 420;
  const leftPad = isMobile ? 10 : 18;
  const rightPad = 76;
  const topPad = isMobile ? 46 : 58;
const bottomPad = isMobile ? 38 : 42;

  const chartWidth = width - leftPad - rightPad;
  const chartHeight = height - topPad - bottomPad;

  const previousClose =
    toNumber(stockContext?.["Previous Close"]) ??
    toNumber(stockContext?.previousClose) ??
    toNumber(stockContext?.previous_close) ??
    toNumber(points[0]?.open) ??
    toNumber(points[0]?.close);

  const overlayValues = [
    ...technicalPoints.flatMap((p) => [
      enabledOverlays.sma20 ? p.sma20 : null,
      enabledOverlays.sma50 ? p.sma50 : null,
      enabledOverlays.sma100 ? p.sma100 : null,
      enabledOverlays.ema21 ? p.ema21 : null,
      enabledOverlays.bollinger ? p.bollingerUpper : null,
      enabledOverlays.bollinger ? p.bollingerLower : null,
      enabledOverlays.vwap ? p.vwap : null,
    ]),
    showSmartLevels ? keyLevels.support : null,
    showSmartLevels ? keyLevels.resistance : null,
    previousClose,
  ];

  const cleanOverlayValues = overlayValues.filter(
    (value) => value != null && Number.isFinite(Number(value))
  );

  const highs = [
    ...points.map((p) => p.high ?? p.close),
    ...cleanOverlayValues,
  ];

  const lows = [
    ...points.map((p) => p.low ?? p.close),
    ...cleanOverlayValues,
  ];

  const closes = points.map((p) => p.close);

  const max = Math.max(...highs);
  const min = Math.min(...lows);
  const range = max - min || 1;
  const first = closes[0];
  const last = closes[closes.length - 1];

  const selectedRangeChangePct =
    first && first !== 0 ? ((last - first) / first) * 100 : null;

  const getX = (index) =>
    leftPad + (index / Math.max(points.length - 1, 1)) * chartWidth;

  const getY = (price) => topPad + ((max - price) / range) * chartHeight;

  const baselineY = getY(first);
  const previousCloseY = previousClose != null ? getY(previousClose) : null;

  const buildIndicatorPath = (field) => {
    let path = "";

    technicalPoints.forEach((point, index) => {
      const value = point[field];

      if (value == null || !Number.isFinite(Number(value))) return;

      const command = path ? "L" : "M";
      path += `${command} ${getX(index)} ${getY(value)} `;
    });

    return path.trim();
  };

  const maxVolume = Math.max(
    ...points.map((point) => Number(point.volume) || 0),
    1
  );

  const avgVolume =
    points.reduce((sum, point) => sum + (Number(point.volume) || 0), 0) /
    Math.max(points.length, 1);

  const volumeTop = height - bottomPad - 72;
  const volumeHeight = 58;

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

  const priceTickCount = isMobile ? 5 : 6;
  const priceTicks = Array.from({ length: priceTickCount }, (_, i) => {
    const denominator = Math.max(priceTickCount - 1, 1);
    const value = min + ((denominator - i) / denominator) * range;
    return Number(value.toFixed(2));
  });

  const bottomTickPercents = isMobile ? [0, 1 / 3, 2 / 3, 1] : [0, 0.25, 0.5, 0.75, 1];
  const bottomTickIndexes = bottomTickPercents.map((pct) =>
    Math.min(points.length - 1, Math.round((points.length - 1) * pct))
  );

  const rangeBadgeWidth = 106;
const rangeBadgeHeight = 20;

const rangeBadgeCenterX =
  bottomTickIndexes.length > 1
    ? (getX(bottomTickIndexes[0]) + getX(bottomTickIndexes[1])) / 2
    : leftPad + rangeBadgeWidth / 2;

const rangeBadgeX = rangeBadgeCenterX - rangeBadgeWidth / 2;

  const latestTechnicalPoint = technicalPoints[technicalPoints.length - 1] || {};
  const latestVolume = Number(points[points.length - 1]?.volume) || 0;

  const supportZoneSize =
    keyLevels.support != null
      ? Math.max(keyLevels.support * 0.004, range * 0.015)
      : null;

  const resistanceZoneSize =
    keyLevels.resistance != null
      ? Math.max(keyLevels.resistance * 0.004, range * 0.015)
      : null;

  const supportZoneLow =
    keyLevels.support != null && supportZoneSize != null
      ? keyLevels.support - supportZoneSize
      : null;

  const supportZoneHigh =
    keyLevels.support != null && supportZoneSize != null
      ? keyLevels.support + supportZoneSize
      : null;

  const resistanceZoneLow =
    keyLevels.resistance != null && resistanceZoneSize != null
      ? keyLevels.resistance - resistanceZoneSize
      : null;

  const resistanceZoneHigh =
    keyLevels.resistance != null && resistanceZoneSize != null
      ? keyLevels.resistance + resistanceZoneSize
      : null;

  const isTestingResistance =
    keyLevels.resistance != null &&
    Math.abs(last - keyLevels.resistance) / keyLevels.resistance <= 0.015;

  const isTestingSupport =
    keyLevels.support != null &&
    Math.abs(last - keyLevels.support) / keyLevels.support <= 0.015;

  const isBreakingOut =
    keyLevels.resistance != null && last > keyLevels.resistance;

  const isBreakingDown =
    keyLevels.support != null && last < keyLevels.support;

  const isAboveVwap =
    latestTechnicalPoint.vwap != null && last > latestTechnicalPoint.vwap;

  const isAboveSma100 =
  latestTechnicalPoint.sma100 != null && last > latestTechnicalPoint.sma100;

  const isVolumeSpike =
    avgVolume > 0 && latestVolume > avgVolume * 1.6;

  const isOverbought =
    technicalSummary?.rsi14 != null && technicalSummary.rsi14 >= 70;

  const smartLabels = [
    isBreakingOut ? "Breaking Out" : null,
    isBreakingDown ? "Breaking Down" : null,
    isTestingResistance ? "Testing Resistance" : null,
    isTestingSupport ? "Testing Support" : null,
    isAboveVwap ? "Above VWAP" : null,
    isAboveSma100 ? "Above 100 SMA" : null,
    isOverbought ? "Overbought Momentum" : null,
    isVolumeSpike ? "Volume Spike" : null,
  ].filter(Boolean);

  const eventMarkers = useMemo(() => {
    const rawEvents = [
      {
        type: "10-K",
        label: "10-K Filing",
        date:
          stockContext?.["Latest 10-K Date"] ||
          stockContext?.latest_10k_date ||
          stockContext?.latest10KDate,
        color: "#38bdf8",
      },
      {
        type: "10-Q",
        label: "10-Q Filing",
        date:
          stockContext?.["Latest 10-Q Date"] ||
          stockContext?.latest_10q_date ||
          stockContext?.latest10QDate,
        color: "#a78bfa",
      },
      {
        type: "DIV",
        label: "Ex-Dividend",
        date:
          stockContext?.["Latest Ex-Dividend Date"] ||
          stockContext?.latest_ex_dividend_date ||
          stockContext?.latestExDividendDate,
        color: "#facc15",
      },
    ];

    return rawEvents
      .map((event) => {
        const cleanDate = getDateOnly(event.date);
        const index = findNearestPointIndexByDate(points, cleanDate);

        if (index == null) return null;

        return {
          ...event,
          cleanDate,
          index,
          point: points[index],
        };
      })
      .filter(Boolean);
  }, [points, stockContext]);

  const comparePath = useMemo(() => {
    if (!comparePoints.length || !points.length) return "";

    const primaryStart = points[0]?.close;
    const compareStart = comparePoints[0]?.close;

    if (!primaryStart || !compareStart) return "";

    const usableLength = Math.min(points.length, comparePoints.length);

    return comparePoints.slice(0, usableLength)
      .map((point, index) => {
        const normalizedPrice = primaryStart * (point.close / compareStart);
        const command = index === 0 ? "M" : "L";
        return `${command} ${getX(index)} ${getY(normalizedPrice)}`;
      })
      .join(" ");
  }, [comparePoints, points, first, max, min, chartWidth]);

  const getSvgPointFromMouse = (event) => {
  const svg = svgRef.current;
  if (!svg) return null;

  const svgPoint = svg.createSVGPoint();
  svgPoint.x = event.clientX;
  svgPoint.y = event.clientY;

  const screenCtm = svg.getScreenCTM();
  if (!screenCtm) return null;

  const transformedPoint = svgPoint.matrixTransform(screenCtm.inverse());

  return {
    x: Math.max(leftPad, Math.min(width - rightPad, transformedPoint.x)),
    y: Math.max(topPad, Math.min(height - bottomPad, transformedPoint.y)),
  };
};

const setHoverFromPointerEvent = (event) => {
  if (!points.length) return;

  const svgPoint = getSvgPointFromMouse(event);
  if (!svgPoint) return;

  const pct = Math.max(
    0,
    Math.min(1, (svgPoint.x - leftPad) / Math.max(chartWidth, 1))
  );
  const index = Math.max(
    0,
    Math.min(points.length - 1, Math.round(pct * (points.length - 1)))
  );
  const point = points[index];

  setChartHover({
    label: formatChartTimeLabel(point.time, chartRange),
    time: point.time,
    open: point.open,
    high: point.high,
    low: point.low,
    close: point.close,
    volume: point.volume,
    x: getX(index),
    y: getY(point.close),
  });
};

const buildFreehandSvgPath = (freehandPoints = []) => {
  return freehandPoints
    .map((point, index) => {
      const command = index === 0 ? "M" : "L";
      return `${command} ${point.x} ${point.y}`;
    })
    .join(" ");
};

const finishFreehandPath = () => {
  setIsErasing(false);

  if (!activeFreehandPath) return;

  if (activeFreehandPath.points.length > 1) {
    setDrawings((prev) => [...prev, activeFreehandPath]);
  }

  setActiveFreehandPath(null);
};

const erasePencilDrawingAtPoint = (point) => {
  if (!point) return;

  const eraseRadius = 14;

  setDrawings((prev) =>
    prev.filter((drawing) => {
      if (drawing.type !== "pencil") return true;

      const isNearStroke = drawing.points?.some((strokePoint) => {
        const distance = Math.hypot(
          strokePoint.x - point.x,
          strokePoint.y - point.y
        );

        return distance <= eraseRadius;
      });

      return !isNearStroke;
    })
  );
};

const handlePencilMouseDown = (event) => {
  if (drawingMode !== "pencil") return;

  const point = getSvgPointFromMouse(event);
  if (!point) return;

  if (eraserMode) {
  setIsErasing(true);
  erasePencilDrawingAtPoint(point);
  return;
}

  setActiveFreehandPath({
    id: `${Date.now()}-pencil`,
    type: "pencil",
    color: drawingColor,
    points: [point],
  });
};

const handlePencilMouseMove = (event) => {
  if (drawingMode !== "pencil") return;

  const point = getSvgPointFromMouse(event);
  if (!point) return;

  if (eraserMode) {
  if (isErasing) {
    erasePencilDrawingAtPoint(point);
  }
  return;
}

  if (!activeFreehandPath) return;

  setActiveFreehandPath((prev) => {
    if (!prev) return prev;

    const lastPoint = prev.points[prev.points.length - 1];

    const distance = Math.hypot(point.x - lastPoint.x, point.y - lastPoint.y);

    if (distance < 2) return prev;

    return {
      ...prev,
      points: [...prev.points, point],
    };
  });
};

  const handleChartClick = (index) => {
  if (!drawingMode || drawingMode === "pencil") return;

  const point = points[index];

  const drawingPoint = {
    index,
    price: point.close,
    time: point.time,
  };

  if (drawingMode === "horizontal") {
    setDrawings((prev) => [
      ...prev,
      {
  id: `${Date.now()}-${prev.length}`,
  type: "horizontal",
  color: drawingColor,
  start: drawingPoint,
  end: drawingPoint,
},
    ]);

    setPendingDrawingPoint(null);
    return;
  }

  if (!pendingDrawingPoint) {
    setPendingDrawingPoint(drawingPoint);
    return;
  }

  setDrawings((prev) => [
    ...prev,
    {
  id: `${Date.now()}-${prev.length}`,
  type: "trendline",
  color: drawingColor,
  start: pendingDrawingPoint,
  end: drawingPoint,
},
  ]);

  setPendingDrawingPoint(null);
};

  const handleChartPointerDown = (event) => {
    if (drawingMode === "pencil") {
      if (typeof event.currentTarget.setPointerCapture === "function") {
        try {
          event.currentTarget.setPointerCapture(event.pointerId);
        } catch {
          // Pointer capture is optional.
        }
      }
      handlePencilMouseDown(event);
      return;
    }

    if (drawingMode) {
      setHoverFromPointerEvent(event);
      return;
    }

    scrubPointerRef.current = event.pointerId;
    setHoverFromPointerEvent(event);
  };

  const handleChartPointerMove = (event) => {
    if (drawingMode === "pencil") {
      handlePencilMouseMove(event);
      return;
    }

    if (drawingMode) {
      // Keep the desktop hover readout while positioning a drawing.
      if (event.pointerType === "mouse") setHoverFromPointerEvent(event);
      return;
    }

    if (
      event.pointerType === "mouse" ||
      scrubPointerRef.current === event.pointerId
    ) {
      setHoverFromPointerEvent(event);
    }
  };

  const finishChartPointer = (event) => {
    if (drawingMode === "pencil") {
      finishFreehandPath();
    }

    if (scrubPointerRef.current === event.pointerId) {
      scrubPointerRef.current = null;
    }

    if (
      typeof event.currentTarget.releasePointerCapture === "function" &&
      event.currentTarget.hasPointerCapture?.(event.pointerId)
    ) {
      try {
        event.currentTarget.releasePointerCapture(event.pointerId);
      } catch {
        // Browser may have already released it.
      }
    }
  };

  const handleChartPointerLeave = (event) => {
    if (drawingMode === "pencil") {
      finishFreehandPath();
      return;
    }

    // Mouse hover should disappear when the cursor leaves. Touch keeps the last
    // inspected value visible after the finger lifts, which feels much better on mobile.
    if (event.pointerType === "mouse" && scrubPointerRef.current == null) {
      setChartHover(null);
    }
  };

  const hoverChange =
    chartHover?.open && chartHover.open !== 0
      ? ((chartHover.close - chartHover.open) / chartHover.open) * 100
      : null;

  const hoverIsUp =
  chartHover?.close != null && chartHover?.open != null
    ? chartHover.close >= chartHover.open
    : true;

if (!hasChartData) {
  return <div style={{ color: "#9ca3af" }}>No chart data available</div>;
}

return (
    <div
      ref={chartWrapRef}
      style={{ position: "relative", width: "100%", height: "100%" }}
      onPointerLeave={handleChartPointerLeave}
    >
      {chartHover && (
        <div
          style={{
            position: "absolute",
            top: isMobile ? "6px" : "34px",
            left: isMobile ? "8px" : "30px",
            right: isMobile ? "8px" : "auto",
            width: isMobile ? "auto" : "fit-content",
            maxWidth: isMobile ? "none" : "calc(100% - 60px)",
            color: "white",
            zIndex: 20,
            fontSize: isMobile ? "11px" : "12px",
            display: "flex",
            alignItems: "center",
            gap: isMobile ? "8px" : "13px",
            flexWrap: isMobile ? "nowrap" : "wrap",
            overflow: "hidden",
            pointerEvents: "none",
            textShadow: "0 1px 3px rgba(0,0,0,0.85)",
            background: isMobile ? "rgba(15,23,42,0.78)" : "transparent",
            border: isMobile ? "1px solid rgba(148,163,184,0.18)" : "none",
            borderRadius: isMobile ? "8px" : 0,
            padding: isMobile ? "5px 7px" : 0,
          }}
        >
          <strong
            style={{
              color: "#e5e7eb",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {ticker ? `${ticker} • ` : ""}
            {chartHover.label}
          </strong>

          {isMobile ? (
            <span style={{ whiteSpace: "nowrap", fontWeight: 800 }}>
              {formatPrice(chartHover.close)}
            </span>
          ) : (
            <>
              <span>O {formatPrice(chartHover.open)}</span>
              <span>H {formatPrice(chartHover.high)}</span>
              <span>L {formatPrice(chartHover.low)}</span>
              <span>C {formatPrice(chartHover.close)}</span>
              <span>Vol {formatVolume(chartHover.volume)}</span>
            </>
          )}

          {hoverChange != null && (
            <span
              style={{
                color: hoverIsUp ? "#86efac" : "#fca5a5",
                fontWeight: 900,
                whiteSpace: "nowrap",
              }}
            >
              {hoverChange >= 0 ? "+" : ""}
              {hoverChange.toFixed(2)}%
            </span>
          )}
        </div>
      )}



      {drawingMode && (
        <div
          style={{
            position: "absolute",
            right: "12px",
            top: "10px",
            zIndex: 19,
            padding: "7px 10px",
            borderRadius: "999px",
            border: "1px solid rgba(25,195,125,0.45)",
            background: "rgba(25,195,125,0.14)",
            color: "#86efac",
            fontSize: "12px",
            fontWeight: 900,
            pointerEvents: "none",
          }}
        >
          {drawingMode === "pencil"
  ? "Pencil mode: hold and drag"
  : drawingMode === "horizontal"
  ? "Horizontal mode: click one candle"
  : "Trendline mode: click two candles"}
        </div>
      )}

      {drawingMode === "pencil" && (
  <div
    style={{
      position: "absolute",
      right: "12px",
      top: "48px",
      zIndex: 19,
      display: "flex",
      gap: "8px",
      alignItems: "center",
      padding: "7px 10px",
      borderRadius: "999px",
      border: eraserMode
        ? "1px solid #f87171"
        : "1px solid rgba(148,163,184,0.35)",
      background: eraserMode
        ? "rgba(239,68,68,0.16)"
        : "rgba(15,23,42,0.88)",
      color: eraserMode ? "#fca5a5" : "#e5e7eb",
      fontSize: "12px",
      fontWeight: 900,
      boxShadow: "0 12px 24px rgba(0,0,0,0.25)",
    }}
  >
    <button
      type="button"
      onClick={() => {
        setEraserMode((prev) => !prev);
        setActiveFreehandPath(null);
      }}
      style={{
        border: "none",
        background: "transparent",
        color: eraserMode ? "#fca5a5" : "#e5e7eb",
        cursor: "pointer",
        fontWeight: 900,
        fontSize: "12px",
      }}
    >
      ✐ Eraser {eraserMode ? "On" : "Off"}
    </button>
  </div>
)}

      <svg
  ref={svgRef}
  width="100%"
  height="100%"
  viewBox={`0 0 ${width} ${height}`}
  onPointerDown={handleChartPointerDown}
  onPointerMove={handleChartPointerMove}
  onPointerUp={finishChartPointer}
  onPointerCancel={finishChartPointer}
  onPointerLeave={handleChartPointerLeave}
  style={{
  cursor:
    drawingMode === "pencil" && eraserMode
      ? "not-allowed"
      : drawingMode === "pencil"
      ? "crosshair"
      : drawingMode
      ? "crosshair"
      : "default",
  userSelect: "none",
  // Vertical swipes can still scroll the modal/page; horizontal touch stays available
  // to the chart for continuous scrubbing. Drawing modes intentionally own the gesture.
  touchAction: drawingMode ? "none" : "pan-y",
}}
>
        <defs>
          <linearGradient id="bullionaireAreaGreen" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="rgba(25,195,125,0.30)" />
            <stop offset="100%" stopColor="rgba(25,195,125,0.02)" />
          </linearGradient>
          <linearGradient id="bullionaireAreaRed" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="rgba(220,38,38,0.30)" />
            <stop offset="100%" stopColor="rgba(220,38,38,0.02)" />
          </linearGradient>
        </defs>

        <rect x={0} y={0} width={width} height={height} fill="#0b1120" />

        {/* Ultra-light background grid */}
{Array.from({ length: 9 }, (_, i) => {
  const y = topPad + (i / 8) * chartHeight;

  return (
    <line
      key={`soft-grid-y-${i}`}
      x1={leftPad}
      y1={y}
      x2={width - rightPad}
      y2={y}
      stroke="#ffffff"
      strokeWidth="1"
      opacity="0.035"
    />
  );
})}

{Array.from({ length: 13 }, (_, i) => {
  const x = leftPad + (i / 12) * chartWidth;

  return (
    <line
      key={`soft-grid-x-${i}`}
      x1={x}
      y1={topPad}
      x2={x}
      y2={height - bottomPad}
      stroke="#ffffff"
      strokeWidth="1"
      opacity="0.025"
    />
  );
})}

        {priceTicks.map((value, idx) => {
          const y = getY(value);

          return (
            <g key={idx}>
              <line
  x1={leftPad}
  y1={baselineY}
  x2={width - rightPad}
  y2={baselineY}
  stroke="#cbd5e1"
  strokeWidth="1.7"
  strokeDasharray="7 5"
  opacity="0.2"
/>
              <text
                x={width - rightPad + 10}
                y={y + 4}
                fill="#cbd5e1"
                fontSize="12"
                fontWeight="700"
              >
                {value.toFixed(2)}
              </text>
            </g>
          );
        })}

        {enabledOverlays.volume && (
          <g opacity="0.30">
            {points.map((point, index) => {
              const volume = Number(point.volume) || 0;
              const x = getX(index);
              const barWidth = Math.max(2, Math.min(7, (chartWidth / points.length) * 0.55));
              const barHeight = (volume / maxVolume) * volumeHeight;
              const isUp = point.close >= point.open;

              return (
                <rect
                  key={`volume-${index}`}
                  x={x - barWidth / 2}
                  y={volumeTop + volumeHeight - barHeight}
                  width={barWidth}
                  height={Math.max(1, barHeight)}
                  rx="1"
                  fill={isUp ? "#19C37D" : "#dc2626"}
                />
              );
            })}
          </g>
        )}

        <line
          x1={leftPad}
          y1={baselineY}
          x2={width - rightPad}
          y2={baselineY}
          stroke="#9ca3af"
          strokeWidth="1"
          strokeDasharray="4 4"
          opacity="0.35"
        />


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
                fontWeight="700"
              >
                {formatChartTimeLabel(point.time, chartRange)}
              </text>
            </g>
          );
        })}

        {showSmartLevels && supportZoneLow != null && supportZoneHigh != null && (
          <g>
            <rect
              x={leftPad}
              y={getY(supportZoneHigh)}
              width={chartWidth}
              height={Math.max(2, getY(supportZoneLow) - getY(supportZoneHigh))}
              fill="rgba(25,195,125,0.09)"
              stroke="rgba(25,195,125,0.24)"
            />
            <line
              x1={leftPad}
              y1={getY(keyLevels.support)}
              x2={width - rightPad}
              y2={getY(keyLevels.support)}
              stroke="#19C37D"
              strokeWidth="1.5"
              strokeDasharray="7 5"
              opacity="0.9"
            />
            <rect
              x={leftPad + 8}
              y={getY(keyLevels.support) - 12}
              width={148}
              height={22}
              rx={5}
              fill="rgba(25,195,125,0.18)"
              stroke="rgba(25,195,125,0.55)"
            />
            <text
              x={leftPad + 82}
              y={getY(keyLevels.support) + 4}
              fill="#86efac"
              fontSize="12"
              textAnchor="middle"
              fontWeight="bold"
            >
              Support Zone {keyLevels.support.toFixed(2)}
            </text>
          </g>
        )}

        {showSmartLevels && resistanceZoneLow != null && resistanceZoneHigh != null && (
          <g>
            <rect
              x={leftPad}
              y={getY(resistanceZoneHigh)}
              width={chartWidth}
              height={Math.max(2, getY(resistanceZoneLow) - getY(resistanceZoneHigh))}
              fill="rgba(249,115,22,0.08)"
              stroke="rgba(249,115,22,0.25)"
            />
            <line
              x1={leftPad}
              y1={getY(keyLevels.resistance)}
              x2={width - rightPad}
              y2={getY(keyLevels.resistance)}
              stroke="#f97316"
              strokeWidth="1.5"
              strokeDasharray="7 5"
              opacity="0.9"
            />
            <rect
              x={leftPad + 8}
              y={getY(keyLevels.resistance) - 12}
              width={168}
              height={22}
              rx={5}
              fill="rgba(249,115,22,0.16)"
              stroke="rgba(249,115,22,0.55)"
            />
            <text
              x={leftPad + 92}
              y={getY(keyLevels.resistance) + 4}
              fill="#fdba74"
              fontSize="12"
              textAnchor="middle"
              fontWeight="bold"
            >
              Resistance Zone {keyLevels.resistance.toFixed(2)}
            </text>
          </g>
        )}

        {enabledOverlays.bollinger && (
          <>
            <path
              d={buildIndicatorPath("bollingerUpper")}
              fill="none"
              stroke="#a78bfa"
              strokeWidth="1.4"
              strokeDasharray="5 4"
              opacity="0.95"
            />
            <path
              d={buildIndicatorPath("bollingerMiddle")}
              fill="none"
              stroke="#8b5cf6"
              strokeWidth="1.2"
              opacity="0.65"
            />
            <path
              d={buildIndicatorPath("bollingerLower")}
              fill="none"
              stroke="#a78bfa"
              strokeWidth="1.4"
              strokeDasharray="5 4"
              opacity="0.95"
            />
          </>
        )}

        {enabledOverlays.sma20 && (
          <path d={buildIndicatorPath("sma20")} fill="none" stroke="#facc15" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" opacity="0.95" />
        )}

        {enabledOverlays.sma50 && (
          <path d={buildIndicatorPath("sma50")} fill="none" stroke="#38bdf8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" opacity="0.95" />
        )}

        {enabledOverlays.sma100 && (
  <path
    d={buildIndicatorPath("sma100")}
    fill="none"
    stroke="#f97316"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    opacity="0.95"
  />
)}

        {enabledOverlays.ema21 && (
          <path d={buildIndicatorPath("ema21")} fill="none" stroke="#ec4899" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" opacity="0.95" />
        )}

        {enabledOverlays.vwap && (
          <path d={buildIndicatorPath("vwap")} fill="none" stroke="#e879f9" strokeWidth="1.8" strokeDasharray="6 4" strokeLinecap="round" strokeLinejoin="round" opacity="0.95" />
        )}

        {comparePath && (
  <path
    d={comparePath}
    fill="none"
    stroke="#facc15"
    strokeWidth="2"
    strokeDasharray="7 5"
    strokeLinecap="round"
    strokeLinejoin="round"
    opacity="0.92"
  />
)}

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
              fill={last < first ? "url(#bullionaireAreaRed)" : "url(#bullionaireAreaGreen)"}
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

            const candleWidth = Math.max(
              3,
              Math.min(8, (chartWidth / points.length) * 0.65)
            );

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

        {drawings.map((drawing) => {
        if (drawing.type === "pencil") {
  return (
    <path
      key={drawing.id}
      d={buildFreehandSvgPath(drawing.points)}
      fill="none"
      stroke={drawing.color || "#38bdf8"}
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      opacity="0.95"
    />
  );
}
  if (drawing.type === "horizontal") {
    const y = getY(drawing.start.price);

    return (
      <g key={drawing.id}>
        <line
          x1={leftPad}
          y1={y}
          x2={width - rightPad}
          y2={y}
          stroke={drawing.color || "#38bdf8"}
          strokeWidth="2"
          strokeDasharray="6 4"
          opacity="0.95"
        />
        <rect
          x={width - rightPad + 6}
          y={y - 10}
          width={68}
          height={20}
          rx={4}
          fill={drawing.color || "#38bdf8"}
        />
        <text
          x={width - rightPad + 40}
          y={y + 4}
          fill="#111827"
          fontSize="12"
          textAnchor="middle"
          fontWeight="900"
        >
          {drawing.start.price.toFixed(2)}
        </text>
      </g>
    );
  }

  return (
    <g key={drawing.id}>
      <line
        x1={getX(drawing.start.index)}
        y1={getY(drawing.start.price)}
        x2={getX(drawing.end.index)}
        y2={getY(drawing.end.price)}
        stroke={drawing.color || "#38bdf8"}
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.95"
      />
      <circle
        cx={getX(drawing.start.index)}
        cy={getY(drawing.start.price)}
        r="4"
        fill={drawing.color || "#38bdf8"}
      />
      <circle
        cx={getX(drawing.end.index)}
        cy={getY(drawing.end.price)}
        r="4"
        fill={drawing.color || "#38bdf8"}
      />
    </g>
  );
})}

{activeFreehandPath && (
  <path
    d={buildFreehandSvgPath(activeFreehandPath.points)}
    fill="none"
    stroke={activeFreehandPath.color || "#38bdf8"}
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
    opacity="0.95"
  />
)}

        {pendingDrawingPoint && (
  <circle
    cx={getX(pendingDrawingPoint.index)}
    cy={getY(pendingDrawingPoint.price)}
    r="5"
    fill={drawingColor || "#38bdf8"}
    stroke="#111827"
    strokeWidth="2"
  />
)}



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

        {chartHover && (
          <g>
            <rect
              x={width - rightPad + 6}
              y={chartHover.y - 10}
              width={68}
              height={20}
              rx={4}
              fill={hoverIsUp ? "#19C37D" : "#dc2626"}
            />
            <text
              x={width - rightPad + 40}
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

        {points.length > 0 && (!isMobile || !chartHover) && (
          <g>
            <rect
              x={width - rightPad + 6}
              y={getY(last) - 10}
              width={68}
              height={20}
              rx={4}
              fill={last >= first ? "#19C37D" : "#dc2626"}
            />
            <text
              x={width - rightPad + 40}
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

        {selectedRangeChangePct != null && !isMobile && (
  <g>
    <rect
      x={rangeBadgeX}
      y={height - bottomPad + 9}
      width={rangeBadgeWidth}
      height={rangeBadgeHeight}
      rx={5}
      fill={selectedRangeChangePct >= 0 ? "rgba(25,195,125,0.13)" : "rgba(220,38,38,0.13)"}
      stroke={selectedRangeChangePct >= 0 ? "rgba(25,195,125,0.40)" : "rgba(220,38,38,0.40)"}
    />
    <text
      x={rangeBadgeCenterX}
      y={height - bottomPad + 23}
      fill={selectedRangeChangePct >= 0 ? "#86efac" : "#fca5a5"}
      fontSize="12"
      textAnchor="middle"
      fontWeight="900"
    >
      {chartRange}: {selectedRangeChangePct >= 0 ? "+" : ""}
      {selectedRangeChangePct.toFixed(2)}%
    </text>
  </g>
)}

        {chartHover && !isMobile && (
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

        {points.map((point, index) => {
          const x = getX(index);
          const hoverWidth = Math.max(chartWidth / Math.max(points.length, 1), 8);

          return (
            <rect
              key={`hover-${index}`}
              x={x - hoverWidth / 2}
              y={topPad}
              width={hoverWidth}
              height={chartHeight}
              fill="transparent"
              style={{ cursor: drawingMode ? "crosshair" : "default" }}
              onClick={() => handleChartClick(index)}
            />
          );
        })}
      </svg>
    </div>
  );
}