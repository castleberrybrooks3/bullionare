import React from "react";

export default function ChartPerformanceBadge({ chartPerformance }) {
  if (!chartPerformance) return null;

  return (
    <div
      style={{
        fontSize: "14px",
        color: chartPerformance.isUp ? "#86efac" : "#fca5a5",
        fontWeight: "700",
      }}
    >
      {chartPerformance.isUp ? "+" : ""}
      {chartPerformance.pct.toFixed(2)}%
    </div>
  );
}