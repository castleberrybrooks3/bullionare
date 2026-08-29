import React from "react";
import InfoTooltip from "./InfoTooltip";
import { indicatorHelp } from "./indicatorHelp";

const ranges = ["1D", "5D", "1M", "6M", "1Y", "5Y", "Max"];
const chartTypes = ["candles", "line", "mountain"];

export default function ChartControls({
  chartRange,
  setChartRange,
  chartType,
  setChartType,
  chartPerformance,
  selectedRangePopup,
  setSelectedRangePopup,
  showTechnicalPanel,
  setShowTechnicalPanel,
  showTechnicalSummary,
  setShowTechnicalSummary,
  showMomentumPanel,
  setShowMomentumPanel,
  compareSymbol,
  setCompareSymbol,
  showCompareControls,
  setShowCompareControls,
  drawingMode,
setDrawingMode,
drawingColor,
setDrawingColor,
showDrawControls,
setShowDrawControls,
tipsEnabled = true,
onHideAllTips,
}) {
  return (
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
        {ranges.map((range) => {
  const isSelected = chartRange === range;

  const showPopup =
  selectedRangePopup?.range === range &&
  !showTechnicalPanel &&
  !showTechnicalSummary &&
  !showMomentumPanel &&
  !showCompareControls &&
  !showDrawControls &&
  !compareSymbol &&
  !drawingMode;

  const selectedIsNegative =
    isSelected && chartPerformance && chartPerformance.pct < 0;

  const selectedIsPositive =
    isSelected && chartPerformance && chartPerformance.pct >= 0;

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
}}
        style={{
  padding: "7px 11px",
  borderRadius: "999px",
  border: selectedIsNegative
    ? "1px solid #dc2626"
    : selectedIsPositive
    ? "1px solid #19C37D"
    : "1px solid #374151",
  background: selectedIsNegative
    ? "rgba(220,38,38,0.16)"
    : selectedIsPositive
    ? "rgba(25,195,125,0.16)"
    : "#1f2937",
  color: selectedIsNegative
    ? "#fca5a5"
    : selectedIsPositive
    ? "#86efac"
    : "white",
  cursor: "pointer",
  fontWeight: isSelected ? "700" : "500",
  fontSize: "13px",
}}
      >
        {range}
      </button>

      {showPopup && (
        <div
          style={{
            position: "absolute",
            top: "38px",
            left: "50%",
            transform: "translateX(-50%)",
            padding: "5px 9px",
            borderRadius: "999px",
            background: selectedRangePopup.isUp
              ? "rgba(25,195,125,0.18)"
              : "rgba(220,38,38,0.18)",
            border: selectedRangePopup.isUp
              ? "1px solid rgba(25,195,125,0.45)"
              : "1px solid rgba(220,38,38,0.45)",
            color: selectedRangePopup.isUp ? "#86efac" : "#fca5a5",
            fontWeight: "800",
            fontSize: "12px",
            whiteSpace: "nowrap",
            zIndex: 50,
            pointerEvents: "none",
            boxShadow: "0 10px 24px rgba(0,0,0,0.25)",
          }}
        >
          {selectedRangePopup.isUp ? "+" : ""}
          {selectedRangePopup.pct.toFixed(2)}%
        </div>
      )}
    </div>
  );
})}

<button
  type="button"
  onClick={() => {
  setShowTechnicalPanel((prev) => {
    const next = !prev;

    setShowTechnicalSummary(false);
    setShowMomentumPanel(false);
    setShowCompareControls(false);
    setShowDrawControls(false);
    setDrawingMode(null);

    return next;
  });
}}
  style={{
    padding: "7px 11px",
    borderRadius: "999px",
    border: showTechnicalPanel ? "1px solid #19C37D" : "1px solid #374151",
    background: showTechnicalPanel ? "rgba(25,195,125,0.16)" : "#1f2937",
    color: showTechnicalPanel ? "#86efac" : "white",
    cursor: "pointer",
    fontWeight: showTechnicalPanel ? "700" : "500",
    fontSize: "13px",
  }}
>
  Technicals
</button>
<button
  type="button"
  onClick={() => {
  setShowTechnicalSummary((prev) => {
    const next = !prev;

    setShowTechnicalPanel(false);
    setShowMomentumPanel(false);
    setShowCompareControls(false);
    setShowDrawControls(false);
    setDrawingMode(null);

    return next;
  });
}}
  style={{
    padding: "7px 11px",
    borderRadius: "999px",
    border: showTechnicalSummary ? "1px solid #19C37D" : "1px solid #374151",
    background: showTechnicalSummary ? "rgba(25,195,125,0.16)" : "#1f2937",
    color: showTechnicalSummary ? "#86efac" : "white",
    cursor: "pointer",
    fontWeight: showTechnicalSummary ? "700" : "500",
    fontSize: "13px",
  }}
>
  Summary
</button>
<button
  type="button"
  onClick={() => {
  setShowMomentumPanel((prev) => {
    const next = !prev;

    setShowTechnicalPanel(false);
    setShowTechnicalSummary(false);
    setShowCompareControls(false);
    setShowDrawControls(false);
    setDrawingMode(null);

    return next;
  });
}}
  style={{
    padding: "7px 11px",
    borderRadius: "999px",
    border: showMomentumPanel ? "1px solid #19C37D" : "1px solid #374151",
    background: showMomentumPanel ? "rgba(25,195,125,0.16)" : "#1f2937",
    color: showMomentumPanel ? "#86efac" : "white",
    cursor: "pointer",
    fontWeight: showMomentumPanel ? "700" : "500",
    fontSize: "13px",
  }}
>
  Momentum
</button>
<button
  type="button"
  onClick={() => {
  setShowCompareControls((prev) => {
    const next = !prev;

    setShowTechnicalPanel(false);
    setShowTechnicalSummary(false);
    setShowMomentumPanel(false);
    setShowDrawControls(false);
    setDrawingMode(null);

    return next;
  });
}}
  style={{
    padding: "7px 11px",
    borderRadius: "999px",
    border: showCompareControls ? "1px solid #19C37D" : "1px solid #374151",
    background: showCompareControls ? "rgba(25,195,125,0.16)" : "#1f2937",
    color: showCompareControls ? "#86efac" : "white",
    cursor: "pointer",
    fontWeight: showCompareControls ? "700" : "500",
    fontSize: "13px",
  }}
>
  Compare
</button>
<button
  type="button"
  onClick={() => {
  setShowDrawControls((prev) => {
    const next = !prev;

    setShowTechnicalPanel(false);
    setShowTechnicalSummary(false);
    setShowMomentumPanel(false);
    setShowCompareControls(false);

    if (!next) {
      setDrawingMode(null);
    }

    return next;
  });
}}
  style={{
    padding: "7px 11px",
    borderRadius: "999px",
    border:
      showDrawControls || drawingMode
        ? "1px solid #19C37D"
        : "1px solid #374151",
    background:
      showDrawControls || drawingMode
        ? "rgba(25,195,125,0.16)"
        : "#1f2937",
    color: showDrawControls || drawingMode ? "#86efac" : "white",
    cursor: "pointer",
    fontWeight: showDrawControls || drawingMode ? "700" : "500",
    fontSize: "13px",
  }}
>
  Draw
</button>
</div>

      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
        {chartTypes.map((type) => {
          const isSelected = chartType === type;

          return (
            <button
              key={type}
              onClick={() => setChartType(type)}
              style={{
  padding: "7px 11px",
  borderRadius: "999px",
  border: isSelected ? "1px solid #19C37D" : "1px solid #374151",
  background: isSelected ? "rgba(25,195,125,0.16)" : "#1f2937",
  color: isSelected ? "#86efac" : "white",
  cursor: "pointer",
  fontWeight: isSelected ? "700" : "500",
  fontSize: "13px",
  textTransform: "capitalize",
}}
            >
              {type}
            </button>
          );
        })}
      </div>
      {showCompareControls && (
  <div
    style={{
      width: "100%",
      display: "flex",
      gap: "8px",
      flexWrap: "wrap",
      marginTop: "16px",
      padding: "10px",
      borderRadius: "12px",
      border: "1px solid #1f2937",
      background: "rgba(15, 23, 42, 0.75)",
    }}
  >
    {["SPY", "QQQ", "DIA", "IWM"].map((symbol) => {
      const isSelected = compareSymbol === symbol;

      return (
        <button
          key={symbol}
          type="button"
          onClick={() => setCompareSymbol(isSelected ? null : symbol)}
          style={{
            padding: "7px 11px",
            borderRadius: "999px",
            border: isSelected ? "1px solid #19C37D" : "1px solid #374151",
            background: isSelected ? "rgba(25,195,125,0.16)" : "#1f2937",
            color: isSelected ? "#86efac" : "white",
            cursor: "pointer",
            fontWeight: isSelected ? "800" : "600",
            fontSize: "13px",
          }}
        >
          <span style={{ display: "inline-flex", alignItems: "center" }}>
  {symbol}
  <InfoTooltip
    {...indicatorHelp[symbol.toLowerCase()]}
    tipsEnabled={tipsEnabled}
    onHideAllTips={onHideAllTips}
  />
</span>
        </button>
      );
    })}

    <button
      type="button"
      onClick={() => setCompareSymbol(null)}
      style={{
        padding: "7px 11px",
        borderRadius: "999px",
        border: "1px solid #374151",
        background: "#111827",
        color: "#cbd5e1",
        cursor: "pointer",
        fontWeight: "700",
        fontSize: "13px",
      }}
    >
      Clear
    </button>
  </div>
)}
{showDrawControls && (
  <div
    style={{
      width: "100%",
      display: "flex",
      gap: "8px",
      flexWrap: "wrap",
      marginTop: "16px",
      padding: "10px",
      borderRadius: "12px",
      border: "1px solid #1f2937",
      background: "rgba(15, 23, 42, 0.75)",
    }}
  >
  <div
  style={{
    display: "flex",
    alignItems: "center",
    gap: "8px",
    marginRight: "8px",
  }}
>
  <span
    style={{
      color: "#94a3b8",
      fontSize: "12px",
      fontWeight: 800,
    }}
  >
    Color
  </span>

  {[
    { label: "Blue", value: "#38bdf8" },
    { label: "Green", value: "#19C37D" },
    { label: "Yellow", value: "#facc15" },
    { label: "Red", value: "#ef4444" },
    { label: "Purple", value: "#a78bfa" },
    { label: "White", value: "#e5e7eb" },
  ].map((color) => {
    const isSelected = drawingColor === color.value;

    return (
      <button
        key={color.value}
        type="button"
        title={color.label}
        onClick={() => setDrawingColor(color.value)}
        style={{
          width: "22px",
          height: "22px",
          borderRadius: "999px",
          border: isSelected ? "2px solid white" : "1px solid #475569",
          background: color.value,
          cursor: "pointer",
          boxShadow: isSelected ? "0 0 0 2px rgba(56,189,248,0.35)" : "none",
        }}
      />
    );
  })}
</div>
    <button
      type="button"
      onClick={() => {
        setDrawingMode((prev) => (prev === "trendline" ? null : "trendline"));
      }}
      style={{
        padding: "7px 11px",
        borderRadius: "999px",
        border:
          drawingMode === "trendline"
            ? "1px solid #19C37D"
            : "1px solid #374151",
        background:
          drawingMode === "trendline"
            ? "rgba(25,195,125,0.16)"
            : "#1f2937",
        color: drawingMode === "trendline" ? "#86efac" : "white",
        cursor: "pointer",
        fontWeight: drawingMode === "trendline" ? "800" : "600",
        fontSize: "13px",
      }}
    >
      Trendline
    </button>

    <button
  type="button"
  onClick={() => {
    setDrawingMode((prev) => (prev === "pencil" ? null : "pencil"));
  }}
  style={{
    padding: "7px 11px",
    borderRadius: "999px",
    border:
      drawingMode === "pencil"
        ? "1px solid #19C37D"
        : "1px solid #374151",
    background:
      drawingMode === "pencil"
        ? "rgba(25,195,125,0.16)"
        : "#1f2937",
    color: drawingMode === "pencil" ? "#86efac" : "white",
    cursor: "pointer",
    fontWeight: drawingMode === "pencil" ? "800" : "600",
    fontSize: "13px",
  }}
>
  ✎ Pencil
</button>

    <button
      type="button"
      onClick={() => {
        setDrawingMode((prev) => (prev === "horizontal" ? null : "horizontal"));
      }}
      style={{
        padding: "7px 11px",
        borderRadius: "999px",
        border:
          drawingMode === "horizontal"
            ? "1px solid #19C37D"
            : "1px solid #374151",
        background:
          drawingMode === "horizontal"
            ? "rgba(25,195,125,0.16)"
            : "#1f2937",
        color: drawingMode === "horizontal" ? "#86efac" : "white",
        cursor: "pointer",
        fontWeight: drawingMode === "horizontal" ? "800" : "600",
        fontSize: "13px",
      }}
    >
      Horizontal Level
    </button>

    <button
      type="button"
      onClick={() => {
        window.dispatchEvent(new CustomEvent("bullionaire-clear-chart-drawings"));
        setDrawingMode(null);
      }}
      style={{
        padding: "7px 11px",
        borderRadius: "999px",
        border: "1px solid #374151",
        background: "#111827",
        color: "#cbd5e1",
        cursor: "pointer",
        fontWeight: "700",
        fontSize: "13px",
      }}
    >
      Clear
    </button>
  </div>
)}
    </div>
  );
}