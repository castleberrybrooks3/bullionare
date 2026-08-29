import React from "react";
import InfoTooltip from "./InfoTooltip";
import { indicatorHelp } from "./indicatorHelp";

const overlayGroups = [
  {
    label: "Smart",
    items: [
      {
        key: "smartLevels",
        label: "Support / Resistance",
        helpKey: "supportResistance",
      },
    ],
  },
  {
    label: "Moving Averages",
    items: [
      { key: "sma20", label: "SMA 20", helpKey: "sma20" },
      { key: "sma50", label: "SMA 50", helpKey: "sma50" },
      { key: "sma100", label: "SMA 100", helpKey: "sma100" },
      { key: "ema21", label: "EMA 21", helpKey: "ema21" },
    ],
  },
  {
    label: "Volatility",
    items: [
      { key: "bollinger", label: "Bollinger Bands", helpKey: "bollinger" },
    ],
  },
  {
    label: "Volume",
    items: [
      { key: "volume", label: "Volume Bars", helpKey: "volumeBars" },
      { key: "vwap", label: "VWAP", helpKey: "vwap" },
    ],
  },
];

export default function TechnicalOverlayControls({
  enabledOverlays,
  setEnabledOverlays,
  tipsEnabled = true,
  onHideAllTips,
}) {
  const toggleOverlay = (key) => {
    setEnabledOverlays((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const clearAll = () => {
    setEnabledOverlays({
  smartLevels: false,
  sma20: false,
  sma50: false,
  sma100: false,
  ema21: false,
  bollinger: false,
  volume: false,
  vwap: false,
});
  };

  return (
    <div
      style={{
        marginBottom: "14px",
        padding: "12px",
        borderRadius: "12px",
        border: "1px solid #1f2937",
        background: "rgba(15, 23, 42, 0.75)",
        display: "flex",
        flexDirection: "column",
        gap: "10px",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "10px",
        }}
      >
        <div style={{ fontWeight: 800, fontSize: "13px", color: "#e5e7eb" }}>
          Technical Overlays
<InfoTooltip
  {...indicatorHelp.supportResistance}
  title="Technical Overlays"
  description="Technical overlays are chart tools placed directly on top of the price chart to help identify trend, momentum, volatility, volume, support, and resistance."
  good="Useful when they confirm the price action and point in the same direction."
  bad="Too many overlays can clutter the chart or create conflicting signals."
  note="Use overlays as context, not as automatic buy or sell signals."
  tipsEnabled={tipsEnabled}
  onHideAllTips={onHideAllTips}
/>
        </div>

        <button
          type="button"
          onClick={clearAll}
          style={{
            padding: "5px 9px",
            borderRadius: "999px",
            border: "1px solid #374151",
            background: "#111827",
            color: "#cbd5e1",
            cursor: "pointer",
            fontSize: "12px",
            fontWeight: 700,
          }}
        >
          Clear
        </button>
      </div>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "12px",
          alignItems: "center",
        }}
      >
        {overlayGroups.map((group) => (
          <div
            key={group.label}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "7px",
              flexWrap: "wrap",
            }}
          >
            <span
              style={{
                color: "#94a3b8",
                fontSize: "12px",
                fontWeight: 700,
                marginRight: "2px",
              }}
            >
              {group.label}:
            </span>

            {group.items.map((item) => {
              const active = !!enabledOverlays[item.key];

              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => toggleOverlay(item.key)}
                  style={{
                    padding: "6px 9px",
                    borderRadius: "999px",
                    border: active ? "1px solid #19C37D" : "1px solid #374151",
                    background: active ? "rgba(25,195,125,0.16)" : "#1f2937",
                    color: active ? "#86efac" : "#e5e7eb",
                    cursor: "pointer",
                    fontSize: "12px",
                    fontWeight: active ? 800 : 600,
                  }}
                >
                  <span style={{ display: "inline-flex", alignItems: "center" }}>
  {item.label}
  <InfoTooltip
    {...indicatorHelp[item.helpKey]}
    tipsEnabled={tipsEnabled}
    onHideAllTips={onHideAllTips}
  />
</span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}