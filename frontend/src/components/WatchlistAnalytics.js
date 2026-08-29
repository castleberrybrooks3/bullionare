import React, { useMemo } from "react";
import { Pie } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";

const SECTOR_COLORS = {
  Technology: "#60a5fa",
  Healthcare: "#ef4444",
  "Financial Services": "#22c55e",
  Financials: "#22c55e",
  "Consumer Cyclical": "#fbbf24",
  "Consumer Defensive": "#a78bfa",
  Industrials: "#94a3b8",
  Energy: "#fb923c",
  Utilities: "#22d3ee",
  "Communication Services": "#f472b6",
  Materials: "#a3e635",
  "Basic Materials": "#a3e635",
  "Real Estate": "#34d399",
  Unknown: "#6366f1",
};

const getSectorColor = (sector) => {
  return SECTOR_COLORS[sector] || "#9ca3af";
};

ChartJS.register(ArcElement, Tooltip, Legend);

function WatchlistAnalytics({
  activeList,
  watchlists,
  stocks = [],
  allocations = {},
}) {
  const { chartData, avgBeta, avgStdDev } = useMemo(() => {
    const tickers = watchlists?.[activeList] || [];

    const stockMap = Object.fromEntries(
      stocks.map((stock) => [stock.Ticker, stock])
    );

    const equalWeight = tickers.length > 0 ? 100 / tickers.length : 0;

    const getAllocationForTicker = (ticker) => {
      const rawValue = allocations[ticker];

      if (rawValue === "" || rawValue == null) {
        return Number(equalWeight.toFixed(2));
      }

      const num = Number(rawValue);

      return Number.isNaN(num)
        ? Number(equalWeight.toFixed(2))
        : num;
    };

    const breakdown = {};

    let betaWeightedSum = 0;
    let betaWeightTotal = 0;

    let stdDevWeightedSum = 0;
    let stdDevWeightTotal = 0;

    tickers.forEach((ticker) => {
      const stock = stockMap[ticker];
      if (!stock) return;

      const allocation = getAllocationForTicker(ticker);
      const sector = stock.Sector || "Unknown";

      breakdown[sector] = (breakdown[sector] || 0) + allocation;

      // Allocation-weighted Beta
      const rawBeta = Number(stock.Beta);

      if (!Number.isNaN(rawBeta) && rawBeta !== 0) {
        betaWeightedSum += rawBeta * (allocation / 100);
        betaWeightTotal += allocation / 100;
      }

      // Allocation-weighted 1Y standard deviation
const rawStdDevValue = stock["Standard Deviation (1Y)"];

if (rawStdDevValue !== null && rawStdDevValue !== "") {
  const rawStdDev = Number(rawStdDevValue);

  if (
    Number.isFinite(rawStdDev) &&
    rawStdDev >= 0 &&
    Number.isFinite(allocation) &&
    allocation >= 0
  ) {
    stdDevWeightedSum += rawStdDev * (allocation / 100);
    stdDevWeightTotal += allocation / 100;
  }
}
    });

    const labels = Object.keys(breakdown);
    const values = Object.values(breakdown);

    const chartData =
      values.length > 0
        ? {
            labels,
            datasets: [
              {
                data: values.map((value) =>
                  Number(value.toFixed(1))
                ),
                backgroundColor: labels.map((sector) =>
                  getSectorColor(sector)
                ),
                borderWidth: 0,
              },
            ],
          }
        : null;

    const avgBeta =
      betaWeightTotal > 0
        ? betaWeightedSum / betaWeightTotal
        : null;

    const avgStdDev =
  stdDevWeightTotal > 0
    ? stdDevWeightedSum / stdDevWeightTotal
    : null;

    return {
      chartData,
      avgBeta,
      avgStdDev,
    };
  }, [activeList, watchlists, stocks, allocations]);

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            return `${context.label}: ${context.formattedValue}%`;
          },
        },
      },
    },
    layout: {
      padding: 0,
    },
  };

  const betaDisplay =
    avgBeta != null ? avgBeta.toFixed(2) : "--";

  const stdDevDisplay =
    avgStdDev != null ? `${avgStdDev.toFixed(2)}%` : "--";

  const betaPosition =
    avgBeta != null
      ? Math.max(0, Math.min((avgBeta / 5) * 100, 100))
      : 0;

  return (
    <div
      style={{
        width: "100%",
        maxWidth: "650px",
        minWidth: 0,
        height: "245px",
        minHeight: "245px",
        display: "flex",
        flexWrap: "nowrap",
        flexDirection: "row",
        alignItems: "flex-end",
        justifyContent: "center",
        gap: "20px",
        boxSizing: "border-box",
        marginTop: "-12px",
      }}
    >
      <div
        style={{
          flex: "1 1 220px",
          minWidth: "220px",
          minHeight: 0,
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "center",
          paddingTop: "0px",
        }}
      >
        {chartData ? (
          <div
            style={{
              width: "200px",
              maxWidth: "100%",
              height: "200px",
              marginTop: "0px",
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

      <div
        style={{
          flex: "1 1 260px",
          minWidth: "240px",
          maxWidth: "320px",
          display: "flex",
          flexDirection: "column",
          marginRight: "0px",
          justifyContent: "flex-end",
          paddingTop: "0px",
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
          <div
            style={{
              position: "relative",
              paddingTop: "14px",
            }}
          >
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
                  boxShadow:
                    "0 0 6px rgba(255,255,255,0.6)",
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
                boxShadow:
                  "inset 0 0 0 1px rgba(255,255,255,0.08)",
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

        <div
          style={{
            marginTop: "12px",
            paddingTop: "10px",
            borderTop:
              "1px solid rgba(255,255,255,0.10)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "16px",
          }}
        >
          <div
            style={{
              color: "#cbd5e1",
              fontSize: "13px",
              fontWeight: "600",
              whiteSpace: "nowrap",
            }}
          >
            Avg 1Y Std Dev
          </div>

          <div
            style={{
              color: "#ffffff",
              fontSize: "20px",
              fontWeight: "700",
              whiteSpace: "nowrap",
            }}
          >
            {stdDevDisplay}
          </div>
        </div>
      </div>
    </div>
  );
}

export default React.memo(WatchlistAnalytics);