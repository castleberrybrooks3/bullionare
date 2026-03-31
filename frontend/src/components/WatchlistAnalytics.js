import React, { useMemo } from "react";
import { Pie } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";

ChartJS.register(ArcElement, Tooltip, Legend);

export default function WatchlistAnalytics({ activeList, watchlists }) {
  const { chartData, avgBeta } = useMemo(() => {
    const allStocks = JSON.parse(localStorage.getItem("stocks") || "[]");
    const tickers = watchlists?.[activeList] || [];

    const breakdown = {};
    const betaValues = [];

    tickers.forEach((ticker) => {
      const stock = allStocks.find((s) => s.Ticker === ticker);
      if (!stock) return;

      const sector = stock.Sector || "Unknown";
      breakdown[sector] = (breakdown[sector] || 0) + 1;

      const rawBeta = Number(stock.Beta);
if (!Number.isNaN(rawBeta) && rawBeta !== 0) {
  betaValues.push(rawBeta);
}
    });

    const labels = Object.keys(breakdown);
    const counts = Object.values(breakdown);
    const total = counts.reduce((sum, count) => sum + count, 0);

    const chartData =
      total > 0
        ? {
            labels,
            datasets: [
              {
                data: counts.map((count) =>
                  Number(((count / total) * 100).toFixed(1))
                ),
                backgroundColor: [
                  "#4dc9f6",
                  "#f67019",
                  "#f53794",
                  "#537bc4",
                  "#acc236",
                  "#166a8f",
                  "#00a950",
                  "#58595b",
                  "#8549ba",
                  "#e6194b",
                  "#ffe119",
                ],
                borderWidth: 0,
              },
            ],
          }
        : null;

    const avgBeta =
      betaValues.length > 0
        ? betaValues.reduce((sum, value) => sum + value, 0) / betaValues.length
        : null;

    return { chartData, avgBeta };
  }, [activeList, watchlists]);

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        callbacks: {
          label: (context) => `${context.label}: ${context.formattedValue}%`,
        },
      },
    },
    layout: {
      padding: 0,
    },
  };

  const betaDisplay = avgBeta != null ? avgBeta.toFixed(2) : "--";
  const betaPosition =
    avgBeta != null ? Math.max(0, Math.min((avgBeta / 5) * 100, 100)) : 0;

  return (
    <div
  style={{
    width: "650px",
    minWidth: "650px",
    height: "380px",
    minHeight: "380px",
    flexShrink: 0,
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: "20px",
  }}
>
      {/* PIE CHART */}
      <div
        style={{
          flex: "1",
          height: "100%",
          minHeight: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-start",
          paddingTop: "10px",
        }}
      >
        {chartData ? (
          <div
  style={{
    width: "200px",
    height: "200px",
    marginTop: "-200px",
  }}
>
  <Pie data={chartData} options={options} />
</div>
        ) : (
          <div
            style={{
              color: "#94a3b8",
              fontSize: "14px",
              textAlign: "center",
            }}
          >
            No watchlist data yet
          </div>
        )}
      </div>

      {/* BETA / VOLATILITY BAR */}
      <div
        style={{
          width: "260px",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          marginRight: "80px",
          justifyContent: "flex-start",
          paddingTop: "60px",
          paddingLeft: "0px",
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            color: "white",
            fontSize: "14px",
            fontWeight: "600",
            marginBottom: "8px",
            textAlign: "center",
            whiteSpace: "nowrap",
          }}
        >
          Volatility vs. Market
        </div>

        <div
          style={{
            color: "#cbd5e1",
            fontSize: "28px",
            fontWeight: "700",
            textAlign: "center",
            marginBottom: "14px",
          }}
        >
          {betaDisplay}
        </div>

        <div style={{ width: "100%" }}>
          <div style={{ position: "relative", paddingTop: "14px" }}>
            {avgBeta != null && (
              <div
                style={{
                  position: "absolute",
                  left: `${betaPosition}%`,
                  top: 0,
                  transform: "translateX(-50%)",
                  width: "2px",
                  height: "14px",
                  backgroundColor: "#ffffff",
                  borderRadius: "2px",
                  boxShadow: "0 0 6px rgba(255,255,255,0.6)",
                }}
              />
            )}

            <div
              style={{
                width: "100%",
                height: "14px",
                borderRadius: "999px",
                background:
                  "linear-gradient(90deg, #22c55e 0%, #84cc16 20%, #eab308 40%, #f97316 65%, #ef4444 100%)",
                boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.08)",
              }}
            />

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                width: "100%",
                marginTop: "8px",
                fontSize: "12px",
                color: "#94a3b8",
                whiteSpace: "nowrap",
              }}
            >
              <span>0</span>
              <span>1</span>
              <span>2</span>
              <span>3</span>
              <span>4</span>
              <span>5</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}