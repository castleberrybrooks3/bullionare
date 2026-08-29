import React from "react";
import InfoTooltip from "./InfoTooltip";
import { indicatorHelp } from "./indicatorHelp";

export default function MomentumPanel({
  technicalSummary,
  tipsEnabled = true,
  onHideAllTips,
}) {
  if (!technicalSummary) return null;

  const metrics = [
    {
      label: "RSI 14",
      helpKey: "rsi14",
      value:
        technicalSummary.rsi14 != null
          ? technicalSummary.rsi14.toFixed(1)
          : "N/A",
      status:
        technicalSummary.rsi14 == null
          ? "Neutral"
          : technicalSummary.rsi14 >= 70
          ? "Overbought"
          : technicalSummary.rsi14 <= 30
          ? "Oversold"
          : technicalSummary.rsi14 >= 50
          ? "Constructive"
          : "Weak",
    },
    {
      label: "MACD Histogram",
      helpKey: "macdHistogram",
      value:
        technicalSummary.macdHistogram != null
          ? technicalSummary.macdHistogram.toFixed(2)
          : "N/A",
      status:
        technicalSummary.macdHistogram == null
          ? "Neutral"
          : technicalSummary.macdHistogram > 0
          ? "Positive"
          : "Negative",
    },
    {
      label: "Stochastic",
      helpKey: "stochastic",
      value:
        technicalSummary.stochastic14 != null
          ? technicalSummary.stochastic14.toFixed(1)
          : "N/A",
      status:
        technicalSummary.stochastic14 == null
          ? "Neutral"
          : technicalSummary.stochastic14 >= 80
          ? "Extended"
          : technicalSummary.stochastic14 <= 20
          ? "Oversold"
          : "Normal",
    },
    {
      label: "Chaikin Money Flow",
      helpKey: "cmf",
      value:
        technicalSummary.cmf20 != null
          ? technicalSummary.cmf20.toFixed(2)
          : "N/A",
      status:
        technicalSummary.cmf20 == null
          ? "Neutral"
          : technicalSummary.cmf20 > 0.05
          ? "Accumulation"
          : technicalSummary.cmf20 < -0.05
          ? "Distribution"
          : "Neutral",
    },
    {
      label: "ATR 14",
      helpKey: "atr14",
      value:
        technicalSummary.atr14 != null
          ? technicalSummary.atr14.toFixed(2)
          : "N/A",
      status: "Volatility",
    },
    {
      label: "OBV",
      helpKey: "obv",
      value:
        technicalSummary.obv != null
          ? compactNumber(technicalSummary.obv)
          : "N/A",
      status: "Volume Trend",
    },
  ];

  return (
    <div
      style={{
        marginBottom: "14px",
        padding: "14px",
        borderRadius: "12px",
        border: "1px solid #1f2937",
        background: "rgba(15, 23, 42, 0.82)",
      }}
    >
      <div
        style={{
          fontWeight: 900,
          color: "#e5e7eb",
          fontSize: "14px",
          marginBottom: "12px",
        }}
      >
        Momentum & Volume Dashboard
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(6, minmax(120px, 1fr))",
          gap: "10px",
        }}
      >
        {metrics.map((metric) => {
          const bullish =
            metric.status === "Positive" ||
            metric.status === "Constructive" ||
            metric.status === "Oversold" ||
            metric.status === "Accumulation";

          const bearish =
            metric.status === "Negative" ||
            metric.status === "Weak" ||
            metric.status === "Overbought" ||
            metric.status === "Distribution";

          const color = bullish ? "#86efac" : bearish ? "#fca5a5" : "#e5e7eb";
          const border = bullish
            ? "rgba(25,195,125,0.45)"
            : bearish
            ? "rgba(220,38,38,0.45)"
            : "#374151";

          const background = bullish
            ? "rgba(25,195,125,0.10)"
            : bearish
            ? "rgba(220,38,38,0.10)"
            : "#111827";

          return (
            <div
              key={metric.label}
              style={{
                padding: "12px",
                borderRadius: "12px",
                border: `1px solid ${border}`,
                background,
              }}
            >
              <div
                style={{
                  color: "#94a3b8",
                  fontSize: "11px",
                  fontWeight: 900,
                  marginBottom: "6px",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                }}
              >
                <span style={{ display: "inline-flex", alignItems: "center" }}>
  {metric.label}
  <InfoTooltip
    {...indicatorHelp[metric.helpKey]}
    tipsEnabled={tipsEnabled}
    onHideAllTips={onHideAllTips}
  />
</span>
              </div>

              <div
                style={{
                  color,
                  fontSize: "20px",
                  fontWeight: 900,
                  lineHeight: 1,
                }}
              >
                {metric.value}
              </div>

              <div
                style={{
                  color,
                  fontSize: "12px",
                  fontWeight: 800,
                  marginTop: "7px",
                }}
              >
                {metric.status}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function compactNumber(value) {
  const num = Number(value);

  if (!Number.isFinite(num)) return "N/A";

  const abs = Math.abs(num);

  if (abs >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(num / 1_000).toFixed(1)}K`;

  return num.toFixed(0);
}