import React, { useEffect, useState } from "react";

export default function MarketOutlook() {
  const [gainers, setGainers] = useState([]);
  const [losers, setLosers] = useState([]);
  const [gainersAbove5, setGainersAbove5] = useState([]);
  const [losersAbove5, setLosersAbove5] = useState([]);
  const [breadth, setBreadth] = useState(null);
  const [marketSummary, setMarketSummary] = useState({});
  const [loading, setLoading] = useState(true);

  const API_BASE =
  process.env.NODE_ENV === "development"
    ? "http://localhost:8000"
    : process.env.REACT_APP_API_BASE;

  useEffect(() => {
    const fetchOutlookData = async () => {
      try {
        const [
          gainersRes,
          losersRes,
          gainersAbove5Res,
          losersAbove5Res,
          breadthRes,
          summaryRes
        ] = await Promise.all([
          fetch(
            `${API_BASE}/stocks?page=1&page_size=10&security_type=CS&sort_by=Today%20Change%20%25&sort_order=desc`
          ),
          fetch(
            `${API_BASE}/stocks?page=1&page_size=10&security_type=CS&sort_by=Today%20Change%20%25&sort_order=asc&min_price=0.12`
          ),
          fetch(
            `${API_BASE}/stocks?page=1&page_size=10&security_type=CS&sort_by=Today%20Change%20%25&sort_order=desc&min_price=5`
          ),
          fetch(
            `${API_BASE}/stocks?page=1&page_size=10&security_type=CS&sort_by=Today%20Change%20%25&sort_order=asc&min_price=5`
          ),
          fetch(`${API_BASE}/market-breadth`),
          fetch(`${API_BASE}/market-summary`)
        ]);

        const gainersData = await gainersRes.json();
        const losersData = await losersRes.json();
        const gainersAbove5Data = await gainersAbove5Res.json();
        const losersAbove5Data = await losersAbove5Res.json();
        const breadthData = await breadthRes.json();
        const summaryData = await summaryRes.json();

        setGainers(Array.isArray(gainersData?.rows) ? gainersData.rows : []);
        setLosers(Array.isArray(losersData?.rows) ? losersData.rows : []);
        setGainersAbove5(
          Array.isArray(gainersAbove5Data?.rows) ? gainersAbove5Data.rows : []
        );
        setLosersAbove5(
          Array.isArray(losersAbove5Data?.rows) ? losersAbove5Data.rows : []
        );
        setBreadth(breadthData && !breadthData.error ? breadthData : null);
        setMarketSummary(summaryData && !summaryData.error ? summaryData : {});
      } catch (err) {
        console.error("Failed to load market outlook", err);
        setGainers([]);
        setLosers([]);
        setGainersAbove5([]);
        setLosersAbove5([]);
        setBreadth(null);
        setMarketSummary({});
      } finally {
        setLoading(false);
      }
    };

    fetchOutlookData();
  }, [API_BASE]);

  const formatPercent = (value) => {
    const num = typeof value === "number" ? value : parseFloat(value);
    if (Number.isNaN(num)) return "--";
    return `${num > 0 ? "+" : ""}${num.toFixed(2)}%`;
  };

  const formatPrice = (value) => {
    const num = typeof value === "number" ? value : parseFloat(value);
    if (Number.isNaN(num)) return "--";
    return `$${num.toFixed(2)}`;
  };

  const goToDashboardTickers = (tickerString, focusTicker = null) => {
    if (!tickerString) return;

    let url = `/dashboard?tickers=${tickerString}`;
    if (focusTicker) {
      url += `&focus=${focusTicker}`;
    }

    window.location.href = url;
  };

  const goToTickerList = (stocks) => {
    const tickers = stocks
      .map((stock) => stock?.Ticker)
      .filter(Boolean)
      .join(",");

    if (!tickers) return;

    window.location.href = `/dashboard?tickers=${tickers}`;
  };

  const bucketOrder = [
    "<-10%",
    "-10% to -5%",
    "-5% to -2%",
    "-2% to 0%",
    "0%",
    "0% to 2%",
    "2% to 5%",
    "5% to 10%",
    ">10%",
  ];

  const getBarColor = (label) => {
    if (label === "0%") return "#9f9fc4";
    if (label.includes("-") || label.startsWith("<")) return "#ff4d6d";
    return "#10c389";
  };

  const maxBucketValue = breadth
    ? Math.max(...bucketOrder.map((label) => breadth.buckets?.[label] || 0), 1)
    : 1;

  return (
    <div style={{ color: "white" }}>
      <h1 style={{ marginBottom: "8px" }}>Market Outlook</h1>

      <div
        style={{
          display: "flex",
          gap: "18px",
          flexWrap: "wrap",
          marginBottom: "24px",
        }}
      >
        {[
          { label: "S&P 500", ticker: "SPY", title: "S&P 500 ETF" },
          { label: "NASDAQ", ticker: "QQQ", title: "Nasdaq 100 ETF" },
          { label: "DOW", ticker: "DIA", title: "Dow Jones ETF" },
          { label: "BTC", ticker: "IBIT", title: "Bitcoin ETF (BlackRock)" },
          { label: "OIL", ticker: "USO", title: "Oil ETF" },
          { label: "GOLD", ticker: "GLD", title: "Gold ETF" },
          { label: "VIX", ticker: "VIXY", title: "Volatility ETF" },
        ].map(({ label, ticker, title }) => {
          const data = marketSummary[ticker];
          const rawChange = data?.change;
          const change =
            typeof rawChange === "number" ? rawChange : parseFloat(rawChange);
          const hasChange = !Number.isNaN(change);

          const color = hasChange
            ? change > 0
              ? "#10c389"
              : change < 0
              ? "#ff4d6d"
              : "#9ca3af"
            : "#9ca3af";

          return (
            <div
              key={ticker}
              title={title}
              onClick={() => goToDashboardTickers(ticker, ticker)}
              style={{
                background: "#111827",
                border: "1px solid #1f2937",
                borderRadius: "10px",
                padding: "10px 14px",
                minWidth: "110px",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#1a2236";
                e.currentTarget.style.transform = "translateY(-2px)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "#111827";
                e.currentTarget.style.transform = "translateY(0px)";
              }}
            >
              <div style={{ fontSize: "12px", color: "#9ca3af" }}>{label}</div>

              <div style={{ fontWeight: 700 }}>
                {data?.price != null ? `$${Number(data.price).toFixed(2)}` : "--"}
              </div>

              <div style={{ color, fontSize: "13px", fontWeight: 600 }}>
                {hasChange ? `${change > 0 ? "+" : ""}${change.toFixed(2)}%` : "--"}
              </div>
            </div>
          );
        })}
      </div>

      {loading ? (
        <div style={{ color: "#9ca3af" }}>Loading market outlook...</div>
      ) : (
        <>
          <div
            style={{
              background: "#111827",
              border: "1px solid #1f2937",
              borderRadius: "12px",
              padding: "24px",
              marginBottom: "24px",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "20px",
              }}
            >
              <h2 style={{ margin: 0 }}>Decliners & Advancers</h2>
              <div style={{ color: "#cbd5e1", fontSize: "15px" }}>
                Total: {breadth?.total?.toLocaleString() || 0}
              </div>
            </div>

            {breadth && (
              <>
                <div
                  style={{
                    height: "260px",
                    display: "flex",
                    alignItems: "flex-end",
                    justifyContent: "space-between",
                    gap: "14px",
                    borderBottom: "1px solid #374151",
                    paddingBottom: "12px",
                  }}
                >
                  {bucketOrder.map((label) => {
                    const count = breadth.buckets?.[label] || 0;
                    const height = `${Math.max((count / maxBucketValue) * 210, 18)}px`;

                    return (
                      <div
                        key={label}
                        style={{
                          flex: 1,
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          justifyContent: "flex-end",
                          minWidth: 0,
                        }}
                      >
                        <div
                          style={{
                            color: getBarColor(label),
                            fontWeight: 700,
                            fontSize: "14px",
                            marginBottom: "8px",
                          }}
                        >
                          {count.toLocaleString()}
                        </div>

                        <div
                          style={{
                            width: "24px",
                            height,
                            borderRadius: "4px 4px 0 0",
                            background: getBarColor(label),
                          }}
                        />

                        <div
                          style={{
                            marginTop: "8px",
                            color: "#9ca3af",
                            fontSize: "13px",
                            textAlign: "center",
                            lineHeight: "1.2",
                          }}
                        >
                          {label}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr auto 1fr",
                    alignItems: "center",
                    gap: "12px",
                    marginTop: "18px",
                  }}
                >
                  <div>
                    <div
                      style={{
                        height: "10px",
                        background: "#ff4d6d",
                        borderRadius: "999px",
                        width: `${breadth.total ? (breadth.decliners / breadth.total) * 100 : 0}%`,
                      }}
                    />
                    <div style={{ color: "#ff4d6d", marginTop: "8px", fontWeight: 600 }}>
                      Decliners {breadth.decliners.toLocaleString()}
                    </div>
                  </div>

                  <div style={{ color: "#9f9fc4", fontWeight: 600 }}>
                    Unchanged {breadth.unchanged.toLocaleString()}
                  </div>

                  <div style={{ textAlign: "right" }}>
                    <div
                      style={{
                        height: "10px",
                        background: "#10c389",
                        borderRadius: "999px",
                        width: `${breadth.total ? (breadth.advancers / breadth.total) * 100 : 0}%`,
                        marginLeft: "auto",
                      }}
                    />
                    <div style={{ color: "#10c389", marginTop: "8px", fontWeight: 600 }}>
                      Advancers {breadth.advancers.toLocaleString()}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "20px",
              marginBottom: "24px",
            }}
          >
            <div
              style={{
                background: "#111827",
                border: "1px solid #1f2937",
                borderRadius: "12px",
                padding: "20px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: "16px",
                }}
              >
                <h2 style={{ margin: 0, color: "#10c389" }}>Top Gainers Above $5</h2>

                <button
                  onClick={() => goToTickerList(gainersAbove5)}
                  style={{
                    background: "#10c389",
                    color: "white",
                    border: "none",
                    borderRadius: "8px",
                    padding: "8px 12px",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  View All on Dashboard
                </button>
              </div>

              {gainersAbove5.map((stock) => (
                <div
                  key={stock.Ticker}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "80px 1fr 95px 85px",
                    gap: "10px",
                    padding: "10px 0",
                    borderBottom: "1px solid #1f2937",
                    alignItems: "center",
                  }}
                >
                  <strong>{stock.Ticker}</strong>
                  <span style={{ color: "#9ca3af" }}>{stock["Company Name"] || "--"}</span>
                  <span>{formatPrice(stock["Current Price"])}</span>
                  <span style={{ color: "#10c389", fontWeight: 700 }}>
                    {formatPercent(stock["Today Change %"])}
                  </span>
                </div>
              ))}
            </div>

            <div
              style={{
                background: "#111827",
                border: "1px solid #1f2937",
                borderRadius: "12px",
                padding: "20px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: "16px",
                }}
              >
                <h2 style={{ margin: 0, color: "#ff4d6d" }}>Top Losers Above $5</h2>

                <button
                  onClick={() => goToTickerList(losersAbove5)}
                  style={{
                    background: "#ff4d6d",
                    color: "white",
                    border: "none",
                    borderRadius: "8px",
                    padding: "8px 12px",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  View All on Dashboard
                </button>
              </div>

              {losersAbove5.map((stock) => (
                <div
                  key={stock.Ticker}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "80px 1fr 95px 85px",
                    gap: "10px",
                    padding: "10px 0",
                    borderBottom: "1px solid #1f2937",
                    alignItems: "center",
                  }}
                >
                  <strong>{stock.Ticker}</strong>
                  <span style={{ color: "#9ca3af" }}>{stock["Company Name"] || "--"}</span>
                  <span>{formatPrice(stock["Current Price"])}</span>
                  <span style={{ color: "#ff4d6d", fontWeight: 700 }}>
                    {formatPercent(stock["Today Change %"])}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "20px",
            }}
          >
            <div
              style={{
                background: "#111827",
                border: "1px solid #1f2937",
                borderRadius: "12px",
                padding: "20px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: "16px",
                }}
              >
                <h2 style={{ margin: 0, color: "#10c389" }}>Top Gainers</h2>

                <button
                  onClick={() => goToTickerList(gainers)}
                  style={{
                    background: "#10c389",
                    color: "white",
                    border: "none",
                    borderRadius: "8px",
                    padding: "8px 12px",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  View All on Dashboard
                </button>
              </div>

              {gainers.map((stock) => (
                <div
                  key={stock.Ticker}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "80px 1fr 95px 85px",
                    gap: "10px",
                    padding: "10px 0",
                    borderBottom: "1px solid #1f2937",
                    alignItems: "center",
                  }}
                >
                  <strong>{stock.Ticker}</strong>
                  <span style={{ color: "#9ca3af" }}>{stock["Company Name"] || "--"}</span>
                  <span>{formatPrice(stock["Current Price"])}</span>
                  <span style={{ color: "#10c389", fontWeight: 700 }}>
                    {formatPercent(stock["Today Change %"])}
                  </span>
                </div>
              ))}
            </div>

            <div
              style={{
                background: "#111827",
                border: "1px solid #1f2937",
                borderRadius: "12px",
                padding: "20px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: "16px",
                }}
              >
                <h2 style={{ margin: 0, color: "#ff4d6d" }}>Top Losers</h2>

                <button
                  onClick={() => goToTickerList(losers)}
                  style={{
                    background: "#ff4d6d",
                    color: "white",
                    border: "none",
                    borderRadius: "8px",
                    padding: "8px 12px",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  View All on Dashboard
                </button>
              </div>

              {losers.map((stock) => (
                <div
                  key={stock.Ticker}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "80px 1fr 95px 85px",
                    gap: "10px",
                    padding: "10px 0",
                    borderBottom: "1px solid #1f2937",
                    alignItems: "center",
                  }}
                >
                  <strong>{stock.Ticker}</strong>
                  <span style={{ color: "#9ca3af" }}>{stock["Company Name"] || "--"}</span>
                  <span>{formatPrice(stock["Current Price"])}</span>
                  <span style={{ color: "#ff4d6d", fontWeight: 700 }}>
                    {formatPercent(stock["Today Change %"])}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}