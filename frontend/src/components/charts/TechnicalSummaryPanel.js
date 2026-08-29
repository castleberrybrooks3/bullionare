import React from "react";
import InfoTooltip from "./InfoTooltip";
import { indicatorHelp } from "./indicatorHelp";

export default function TechnicalSummaryPanel({
  technicalSummary,
  tipsEnabled = true,
  onHideAllTips,
}) {
  if (!technicalSummary || technicalSummary.score == null) return null;

  return (
    <div
      style={{
        marginBottom: "14px",
        padding: "14px",
        borderRadius: "12px",
        border: "1px solid #1f2937",
        background: "rgba(15, 23, 42, 0.82)",
        display: "grid",
        gridTemplateColumns: "240px 1fr",
        gap: "16px",
        alignItems: "start",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        <ScoreCard
          title="Technical Setup"
          label={technicalSummary.signal}
          score={technicalSummary.score}
          description="Momentum health"
        />

        <ScoreCard
  title="Entry Setup"
  label={technicalSummary.entryLabel}
  score={technicalSummary.entryScore}
  description="90% fundamentals / 10% timing"
/>
      </div>

      <div>
        <div
          style={{
            display: "flex",
            gap: "10px",
            flexWrap: "wrap",
            marginBottom: "10px",
          }}
        >
          <div style={pillStyle}>
            RSI
<InfoTooltip
  {...indicatorHelp.rsi14}
  tipsEnabled={tipsEnabled}
  onHideAllTips={onHideAllTips}
/>
:{" "}
            <strong>
              {technicalSummary.rsi14 != null
                ? technicalSummary.rsi14.toFixed(1)
                : "N/A"}
            </strong>
          </div>

          <div style={pillStyle}>
            MACD
<InfoTooltip
  {...indicatorHelp.macdHistogram}
  tipsEnabled={tipsEnabled}
  onHideAllTips={onHideAllTips}
/>
:{" "}
            <strong>
              {technicalSummary.macdHistogram != null
                ? technicalSummary.macdHistogram.toFixed(2)
                : "N/A"}
            </strong>
          </div>

          <div style={pillStyle}>
            Stoch
<InfoTooltip
  {...indicatorHelp.stochastic}
  tipsEnabled={tipsEnabled}
  onHideAllTips={onHideAllTips}
/>
:{" "}
            <strong>
              {technicalSummary.stochastic14 != null
                ? technicalSummary.stochastic14.toFixed(1)
                : "N/A"}
            </strong>
          </div>

          <div style={pillStyle}>
            CMF
<InfoTooltip
  {...indicatorHelp.cmf}
  tipsEnabled={tipsEnabled}
  onHideAllTips={onHideAllTips}
/>
:{" "}
            <strong>
              {technicalSummary.cmf20 != null
                ? technicalSummary.cmf20.toFixed(2)
                : "N/A"}
            </strong>
          </div>

          <div style={pillStyle}>
            Support
<InfoTooltip
  {...indicatorHelp.supportLevel}
  tipsEnabled={tipsEnabled}
  onHideAllTips={onHideAllTips}
/>
:{" "}
            <strong>
              {technicalSummary.support != null
                ? `$${technicalSummary.support.toFixed(2)}`
                : "N/A"}
            </strong>
          </div>

          <div style={pillStyle}>
            Resistance
<InfoTooltip
  {...indicatorHelp.resistanceLevel}
  tipsEnabled={tipsEnabled}
  onHideAllTips={onHideAllTips}
/>
:{" "}
            <strong>
              {technicalSummary.resistance != null
                ? `$${technicalSummary.resistance.toFixed(2)}`
                : "N/A"}
            </strong>
          </div>

          <div style={pillStyle}>
  {technicalSummary.breakoutStatus}
  <InfoTooltip
    {...indicatorHelp.testingResistance}
    tipsEnabled={tipsEnabled}
    onHideAllTips={onHideAllTips}
  />
</div>
        </div>

        <p
          style={{
            margin: "0 0 10px 0",
            color: "#d1d5db",
            fontSize: "13px",
            lineHeight: 1.5,
            fontWeight: 600,
          }}
        >
          <strong style={{ color: "#e5e7eb" }}>Technical Setup:</strong>{" "}
          {technicalSummary.summary}
        </p>

        <p
          style={{
            margin: "0 0 12px 0",
            color: "#cbd5e1",
            fontSize: "13px",
            lineHeight: 1.5,
            fontWeight: 600,
          }}
        >
          <strong style={{ color: "#e5e7eb" }}>Entry Setup:</strong>{" "}
          {technicalSummary.entrySummary}
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "12px",
          }}
        >
          <div>
            <div style={miniHeaderStyle}>Bullish Evidence</div>
            {technicalSummary.positives?.length ? (
              technicalSummary.positives.map((item, index) => (
                <div key={index} style={positiveItemStyle}>
                  ✓ {item}
                </div>
              ))
            ) : (
              <div style={mutedItemStyle}>No strong bullish evidence yet.</div>
            )}
          </div>

          <div>
            <div style={miniHeaderStyle}>Risk / Weakness</div>
            {technicalSummary.warnings?.length ? (
              technicalSummary.warnings.map((item, index) => (
                <div key={index} style={warningItemStyle}>
                  ⚠ {item}
                </div>
              ))
            ) : (
              <div style={mutedItemStyle}>No major warning signs detected.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ScoreCard({ title, label, score, description }) {
  const safeScore = score ?? 0;

  const isEntryCard = title === "Entry Setup";

let accentColor = "#facc15";
let softBackground = "rgba(250,204,21,0.12)";

if (isEntryCard) {
  if (safeScore >= 72) {
    accentColor = "#19C37D";
    softBackground = "rgba(25,195,125,0.12)";
  } else if (safeScore >= 50) {
    accentColor = "#facc15";
    softBackground = "rgba(250,204,21,0.12)";
  } else {
    accentColor = "#dc2626";
    softBackground = "rgba(220,38,38,0.12)";
  }
} else {
  const isCautionLabel =
    label === "Getting Stretched" ||
    label === "Weak Setup";

  const isGreen = safeScore >= 78 && !isCautionLabel;
  const isRed = safeScore < 55 || label === "Weak Setup";

  accentColor = isGreen ? "#19C37D" : isRed ? "#dc2626" : "#facc15";

  softBackground = isGreen
    ? "rgba(25,195,125,0.12)"
    : isRed
    ? "rgba(220,38,38,0.12)"
    : "rgba(250,204,21,0.12)";
}

  return (
    <div
      style={{
        padding: "12px",
        borderRadius: "12px",
        border: `1px solid ${accentColor}`,
        background: softBackground,
      }}
    >
      <div
        style={{
          fontSize: "12px",
          color: "#94a3b8",
          fontWeight: 800,
          marginBottom: "4px",
        }}
      >
        {title}
      </div>

      <div
        style={{
          fontSize: "11px",
          color: "#9ca3af",
          fontWeight: 700,
          marginBottom: "8px",
        }}
      >
        {description}
      </div>

      <div
        style={{
          fontSize: "22px",
          fontWeight: 900,
          color: accentColor,
          lineHeight: 1.05,
        }}
      >
        {label}
      </div>

      <div
        style={{
          marginTop: "8px",
          fontSize: "14px",
          color: "#e5e7eb",
          fontWeight: 800,
        }}
      >
        {safeScore}/100
      </div>

      <div
        style={{
          marginTop: "10px",
          height: "8px",
          borderRadius: "999px",
          background: "#111827",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${safeScore}%`,
            height: "100%",
            background: accentColor,
            borderRadius: "999px",
          }}
        />
      </div>
    </div>
  );
}

const pillStyle = {
  padding: "6px 9px",
  borderRadius: "999px",
  background: "#111827",
  border: "1px solid #374151",
  color: "#e5e7eb",
  fontSize: "12px",
  fontWeight: 700,
};

const miniHeaderStyle = {
  color: "#94a3b8",
  fontSize: "12px",
  fontWeight: 900,
  marginBottom: "6px",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

const positiveItemStyle = {
  color: "#86efac",
  fontSize: "12px",
  fontWeight: 700,
  marginBottom: "5px",
};

const warningItemStyle = {
  color: "#fca5a5",
  fontSize: "12px",
  fontWeight: 700,
  marginBottom: "5px",
};

const mutedItemStyle = {
  color: "#9ca3af",
  fontSize: "12px",
  fontWeight: 600,
};