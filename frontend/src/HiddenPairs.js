import React, { useMemo, useState } from "react";
import hiddenPairsTree from "./data/hiddenPairsTree";
import tickerNames from "./data/tickerNames";
import "./HiddenPairs.css";

export default function HiddenPairs({ onBuildStrategy }) {
  const [search, setSearch] = useState("");
const [selectedData, setSelectedData] = useState(null);
const [filterType, setFilterType] = useState("All");
const [loading, setLoading] = useState(false);
const [error, setError] = useState("");
const [activeResultsView, setActiveResultsView] = useState("stocks");

const API_BASE =
  process.env.NODE_ENV === "development"
    ? "http://localhost:8000"
    : process.env.REACT_APP_API_BASE;

  const cleanSearch = search.trim().toUpperCase();

const filteredMatches = useMemo(() => {
  if (!selectedData?.matches) return [];

  return selectedData.matches
    .filter((match) => {
      if (filterType === "All") return true;
      return String(match.type).toLowerCase() === filterType.toLowerCase();
    })
    .sort((a, b) => Number(b.correlation || 0) - Number(a.correlation || 0));
}, [selectedData, filterType]);

const topStocks = selectedData?.topStocks || [];
const topEtfs = selectedData?.topEtfs || [];
const hedgeCandidates = selectedData?.hedgeCandidates || [];

const topStock = topStocks[0];
const topEtf = topEtfs[0];

const topMatch =
  filterType === "ETF"
    ? topEtf
    : filterType === "Stock"
    ? topStock
    : topStock || topEtf || filteredMatches[0];

const combinedMatches = [
  ...topStocks.slice(0, 10),
  ...topEtfs.slice(0, 10)
].sort((a, b) => Number(b.correlation || 0) - Number(a.correlation || 0));

const activeResults =
  activeResultsView === "etfs"
    ? topEtfs
    : activeResultsView === "all"
    ? combinedMatches
    : activeResultsView === "hedges"
    ? hedgeCandidates
    : topStocks;

const activeResultsTitle =
  activeResultsView === "etfs"
    ? "Closest ETF Proxies"
    : activeResultsView === "all"
    ? "All Correlated Matches"
    : activeResultsView === "hedges"
    ? "Potential Hedge Candidates"
    : "Closest Stock Relationships";

const getCorrelationStrength = (corr) => {
  const value = Number(corr || 0);

  if (value >= 0.85) return "Very Strong";
  if (value >= 0.7) return "Strong";
  if (value >= 0.5) return "Moderate";
  if (value >= 0.3) return "Weak";
  return "Very Weak";
};

const formatCorrelation = (corr) => {
  if (corr == null) return "N/A";
  return `${(Number(corr) * 100).toFixed(0)}%`;
};

  const [selectedCategory, setSelectedCategory] = useState(null);

  const formatRelationship = (text) => {
  if (!text) return "Related Pair";

  return String(text)
    .split(" ")
    .map((word) => {
      if (word.includes("/")) {
        return word
          .split("/")
          .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
          .join("/");
      }

      if (word.includes("-")) {
        return word
          .split("-")
          .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
          .join("-");
      }

      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
};

const getTickerName = (ticker) => {
  return tickerNames[String(ticker || "").toUpperCase()] || "Company name not available yet";
};

  const handleSubmit = async (e) => {
  e.preventDefault();

  if (!cleanSearch) return;

  setLoading(true);
  setError("");
  setSelectedData(null);

  try {
    const response = await fetch(
  `${API_BASE}/hidden-pairs/${cleanSearch}?match_type=${filterType}&limit=20`
);

    if (!response.ok) {
      throw new Error("Failed to load hidden pairs.");
    }

    const data = await response.json();

    if (!data?.matches?.length) {
      setError(`No correlation matches found for ${cleanSearch} yet.`);
      return;
    }

    setSelectedData(data);
setActiveResultsView("stocks");
  } catch (err) {
    console.error("Hidden pairs search failed:", err);
    setError("Could not load hidden pairs. Try again in a few seconds.");
  } finally {
    setLoading(false);
  }
};

const handleClearSearch = () => {
  setSearch("");
  setSelectedData(null);
  setFilterType("All");
  setActiveResultsView("stocks");
  setError("");
  setLoading(false);
};

  const handleViewPair = (baseTicker, matchTicker) => {
    window.location.assign(`/dashboard?tickers=${baseTicker},${matchTicker}`);
  };

  const handleBuildPairStrategy = (baseTicker, match) => {
    if (!baseTicker || !match?.ticker || !onBuildStrategy) return;

    onBuildStrategy({
      name: `${baseTicker} / ${match.ticker} Pair Trade`,
      mode: "strategy",
      source: "Hidden Pairs",
      notes: `Generated from Hidden Pairs. ${baseTicker} is highly correlated with ${
        match.ticker
      }. Relationship: ${match.relationship || "Highly correlated security"}. Correlation: ${
        match.correlation != null ? `${(match.correlation * 100).toFixed(0)}%` : "N/A"
      }.`,
      positions: [
        { ticker: baseTicker, weight: 50 },
        { ticker: match.ticker, weight: -50 }
      ]
    });
  };

  return (
    <div className="hidden-pairs-page" style={{ color: "white" }}>
      <h1 style={{ marginBottom: "8px" }}>Hidden Pairs</h1>

      <p style={{ opacity: 0.75, maxWidth: "950px", lineHeight: 1.5 }}>
  Find the closest correlation to any holding. Search a stock or ETF you currently own and find
  the most highly correlated securities to compare, hedge, tax-loss harvest, or build a pair trade.
</p>

      <form
        className="hidden-pairs-search-form"
        onSubmit={handleSubmit}
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 150px 120px 100px",
          gap: "12px",
          width: "100%",
          alignItems: "center",
          marginTop: "24px",
          marginBottom: "18px"
        }}
      >
        <input
          className="hidden-pairs-search-input"
          value={search}
          onChange={(e) => {
  setSearch(e.target.value);
  setError("");
}}
          placeholder="Search a stock you own... example: NVDA, XOM, JPM"
          style={{
            padding: "14px 16px",
            borderRadius: "10px",
            border: "1px solid rgba(255,255,255,0.12)",
            background: "#0f172a",
            color: "white",
            outline: "none",
            fontWeight: 800,
            fontSize: "15px"
          }}
        />

        <select
          className="hidden-pairs-filter-select"
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          style={{
            padding: "14px 16px",
            borderRadius: "10px",
            border: "1px solid rgba(255,255,255,0.12)",
            background: "#0f172a",
            color: "white",
            outline: "none",
            fontWeight: 800
          }}
        >
          <option>All</option>
          <option>Stock</option>
          <option>ETF</option>
        </select>

        <button
          className="hidden-pairs-search-button"
          type="submit"
          style={{
            padding: "14px 16px",
            borderRadius: "10px",
            border: "none",
            background: "#19C37D",
            color: "#001f3f",
            fontWeight: 900,
            cursor: "pointer"
          }}
        >
          Search
        </button>

  <button
  className="hidden-pairs-clear-button"
  type="button"
  onClick={handleClearSearch}
  disabled={!search && !selectedData && !error}
  style={{
    padding: "14px 16px",
    borderRadius: "10px",
    border: "1px solid rgba(255,255,255,0.12)",
    background: "#1a2238",
    color: "white",
    fontWeight: 900,
    cursor: !search && !selectedData && !error ? "not-allowed" : "pointer",
    opacity: !search && !selectedData && !error ? 0.45 : 1
  }}
>
  Clear
</button>
</form>

      {loading && (
  <div
    style={{
      marginTop: "14px",
      padding: "14px 16px",
      background: "#111827",
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: "10px",
      opacity: 0.78
    }}
  >
    Loading closest correlations for {cleanSearch}...
  </div>
)}

{error && (
  <div
    style={{
      marginTop: "14px",
      padding: "14px 16px",
      background: "rgba(255,80,80,0.08)",
      border: "1px solid rgba(255,80,80,0.22)",
      borderRadius: "10px",
      color: "#ffb4b4"
    }}
  >
    {error}
  </div>
)}

      {selectedData && (
        <>
          <div
            className="hidden-pairs-result-card"
            style={{
              marginTop: "24px",
              padding: "24px",
              background: "linear-gradient(135deg, #111827, #172033)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: "16px",
              marginBottom: "18px"
            }}
          >
            {topMatch && (
  <div
    className="hidden-pairs-top-grid"
    style={{
      display: "grid",
      gridTemplateColumns: "minmax(0, 1.5fr) minmax(260px, 0.7fr)",
      gap: "18px",
      alignItems: "start"
    }}
  >
    <div>
      <div style={{ fontSize: "13px", opacity: 0.6 }}>Search result</div>

      <h2 className="hidden-pairs-search-result-title" style={{ margin: "6px 0 34px", fontSize: "34px" }}>
        {selectedData.ticker}
        <span className="hidden-pairs-search-result-name" style={{ fontSize: "16px", opacity: 0.65, marginLeft: "10px" }}>
          {selectedData.name}
        </span>
      </h2>

      <div
        className="hidden-pairs-closest-card"
        style={{
  padding: "18px",
  background: "rgba(25,195,125,0.1)",
  border: "1px solid rgba(25,195,125,0.28)",
  borderRadius: "14px",
}}
      >
        <div style={{ fontSize: "13px", opacity: 0.7 }}>Closest relationship</div>

        <div style={{ fontSize: "26px", fontWeight: 900, marginTop: "4px" }}>
          {selectedData.ticker} ↔ {topMatch.ticker}
        </div>

        <div style={{ marginTop: "6px", opacity: 0.8 }}>
          {topMatch.name} · {formatCorrelation(topMatch.correlation)} correlation ·{" "}
          {getCorrelationStrength(topMatch.correlation)} · {topMatch.type}
        </div>

        <div style={{ marginTop: "8px", opacity: 0.7 }}>
          {formatRelationship(topMatch.relationship)}
        </div>

        <div className="hidden-pairs-action-row" style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
          <button
            onClick={() => handleViewPair(selectedData.ticker, topMatch.ticker)}
            style={{
              padding: "10px 14px",
              background: "#0f172a",
              color: "white",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "8px",
              fontWeight: 800,
              cursor: "pointer"
            }}
          >
            View Both
          </button>

          <button
            onClick={() => handleBuildPairStrategy(selectedData.ticker, topMatch)}
            style={{
              padding: "10px 14px",
              background: "#19C37D",
              color: "#001f3f",
              border: "none",
              borderRadius: "8px",
              fontWeight: 900,
              cursor: "pointer"
            }}
          >
            Build Strategy
          </button>
        </div>
      </div>
    </div>

    <div
  className="hidden-pairs-result-group"
  style={{
    padding: "18px",
    background: "rgba(15,23,42,0.72)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: "14px",
    display: "flex",
    flexDirection: "column",
    justifyContent: "flex-start",
    gap: "10px",
    height: "fit-content",
    marginTop: "37px"
  }}
>
      <div style={{ fontSize: "13px", opacity: 0.66, marginBottom: "2px" }}>
        Open result group
      </div>

      <button
        onClick={() => setActiveResultsView("stocks")}
        style={{
          padding: "12px 14px",
          background: activeResultsView === "stocks" ? "#19C37D" : "#1a2238",
          color: activeResultsView === "stocks" ? "#001f3f" : "white",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: "10px",
          fontWeight: 900,
          cursor: "pointer",
          textAlign: "left"
        }}
      >
        Top Stocks
        <span style={{ float: "right", opacity: 0.75 }}>
          {Math.min(topStocks.length, 10)}
        </span>
      </button>

      <button
        onClick={() => setActiveResultsView("etfs")}
        style={{
          padding: "12px 14px",
          background: activeResultsView === "etfs" ? "#19C37D" : "#1a2238",
          color: activeResultsView === "etfs" ? "#001f3f" : "white",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: "10px",
          fontWeight: 900,
          cursor: "pointer",
          textAlign: "left"
        }}
      >
        Top ETFs
        <span style={{ float: "right", opacity: 0.75 }}>
          {Math.min(topEtfs.length, 10)}
        </span>
      </button>

      <button
        onClick={() => setActiveResultsView("all")}
        style={{
          padding: "12px 14px",
          background: activeResultsView === "all" ? "#19C37D" : "#1a2238",
          color: activeResultsView === "all" ? "#001f3f" : "white",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: "10px",
          fontWeight: 900,
          cursor: "pointer",
          textAlign: "left"
        }}
      >
        All Matches
        <span style={{ float: "right", opacity: 0.75 }}>
          {combinedMatches.length}
        </span>
      </button>

      <button
        onClick={() => setActiveResultsView("hedges")}
        style={{
          padding: "12px 14px",
          background: activeResultsView === "hedges" ? "#19C37D" : "#1a2238",
          color: activeResultsView === "hedges" ? "#001f3f" : "white",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: "10px",
          fontWeight: 900,
          cursor: "pointer",
          textAlign: "left"
        }}
      >
        Hedge Candidates
        <span style={{ float: "right", opacity: 0.75 }}>
          {hedgeCandidates.length}
        </span>
      </button>
    </div>
  </div>
)}
          </div>

          {activeResults.length > 0 && (
  <>
    <h3 style={{ marginTop: "26px", marginBottom: "12px" }}>
      {activeResultsTitle}
    </h3>

    {activeResultsView === "hedges" && (
  <p style={{ opacity: 0.65, marginTop: "-4px", marginBottom: "14px", lineHeight: 1.45 }}>
    Hedge candidates are based on historical inverse movement and may not hold in future market conditions.
  </p>
)}

    <div
      className="hidden-pairs-results-grid"
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
        gap: "16px",
        marginTop: "14px"
      }}
    >
      {activeResults
  .slice(0, activeResultsView === "all" ? 20 : 10)
  .map((match) => (
        <div
          key={`${activeResultsView}-${match.ticker}`}
          className="hover-glow hidden-pairs-match-card"
          style={{
            padding: "18px",
            background:
  String(match.type).toLowerCase() === "etf"
    ? "#111827"
    : "#1a2238",
            borderRadius: "14px",
            border: "1px solid rgba(255,255,255,0.08)"
          }}
        >
          <div className="hidden-pairs-match-header" style={{ display: "flex", justifyContent: "space-between", gap: "12px" }}>
            <div>
              <div style={{ fontSize: "22px", fontWeight: 900 }}>
                {selectedData.ticker} ↔ {match.ticker}
              </div>
              <div style={{ fontSize: "13px", opacity: 0.65, marginTop: "4px" }}>
                {match.name}
              </div>
            </div>

            <div
              style={{
                padding: "7px 10px",
                borderRadius: "999px",
                background:
  String(match.type).toLowerCase() === "etf"
    ? "rgba(255,255,255,0.08)"
    : "rgba(25,195,125,0.14)",
color:
  String(match.type).toLowerCase() === "etf"
    ? "white"
    : "#19C37D",
                fontWeight: 900,
                fontSize: "13px",
                height: "fit-content"
              }}
            >
              {activeResultsView === "hedges"
  ? `-${formatCorrelation(Math.abs(match.correlation))}`
  : formatCorrelation(match.correlation)}
            </div>
          </div>

          <div style={{ marginTop: "12px", fontSize: "13px", opacity: 0.72 }}>
            {formatRelationship(match.relationship)}
          </div>

          <div style={{ marginTop: "8px", fontSize: "12px", opacity: 0.62 }}>
            Strength: {getCorrelationStrength(Math.abs(match.correlation))}
{activeResultsView === "hedges" ? " · Inverse Movement" : ` · ${match.type}`}
          </div>

          <div className="hidden-pairs-match-actions" style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
            <button
              onClick={() => handleViewPair(selectedData.ticker, match.ticker)}
              style={{
                flex: 1,
                padding: "10px",
                background: "#0f172a",
                color: "white",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "8px",
                fontWeight: 800,
                cursor: "pointer"
              }}
            >
              View
            </button>

            <button
              onClick={() => handleBuildPairStrategy(selectedData.ticker, match)}
              style={{
                flex: 1,
                padding: "10px",
                background: "#19C37D",
                color: "#001f3f",
                border: "none",
                borderRadius: "8px",
                fontWeight: 900,
                cursor: "pointer"
              }}
            >
              Strategy
            </button>
          </div>
        </div>
      ))}
    </div>
  </>
)}
        </>
      )}

      {/* OLD CURATED HIDDEN PAIRS SECTION */}
      <div style={{ marginTop: "42px" }}>
        <div
          className="hidden-pairs-curated-header"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "16px",
            marginBottom: "18px"
          }}
        >
          <div>
            <h2 style={{ marginBottom: "6px" }}>Explore Curated Hidden Pairs</h2>
            <p style={{ opacity: 0.68, margin: 0, lineHeight: 1.5 }}>
              Browse prebuilt pair ideas by correlation strength, sector, hidden relationships,
              and macro themes.
            </p>
          </div>

          {selectedCategory && (
            <button
              onClick={() => setSelectedCategory(null)}
              style={{
                padding: "9px 13px",
                background: "#1a2238",
                color: "white",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "8px",
                cursor: "pointer",
                fontWeight: 800
              }}
            >
              ← Back to Categories
            </button>
          )}
        </div>

        {!selectedCategory && (
          <div
            className="hidden-pairs-curated-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: "16px",
              marginTop: "20px"
            }}
          >
            {Object.keys(hiddenPairsTree).map((key) => (
              <div
                key={key}
                onClick={() => setSelectedCategory(key)}
                className="hover-glow"
                style={{
                  padding: "22px",
                  background: "#1a2238",
                  borderRadius: "12px",
                  textAlign: "center",
                  cursor: "pointer",
                  fontWeight: "bold",
                  border: "1px solid rgba(255,255,255,0.08)"
                }}
              >
                {hiddenPairsTree[key].name}
              </div>
            ))}
          </div>
        )}

        {selectedCategory && (
          <div style={{ marginTop: "22px" }}>
            <h3 style={{ marginBottom: "14px" }}>
              {hiddenPairsTree[selectedCategory].name}
            </h3>

            <div
              className="hidden-pairs-curated-pairs-grid"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                gap: "16px"
              }}
            >
              {hiddenPairsTree[selectedCategory].pairs.map((pair, i) => {
                const longTicker = pair.tickers?.[0];
                const shortTicker = pair.tickers?.[1];

                return (
                  <div
                    key={`${longTicker}-${shortTicker}-${i}`}
                    onClick={() => handleViewPair(longTicker, shortTicker)}
                    className="hover-glow"
                    style={{
                      padding: "18px",
                      background: "#1a2238",
                      borderRadius: "14px",
                      cursor: "pointer",
                      border: "1px solid rgba(255,255,255,0.08)"
                    }}
                  >
                    <div style={{ fontSize: "21px", fontWeight: 900 }}>
                      {longTicker} ↔ {shortTicker}
                    </div>

                    <div style={{ fontSize: "13px", opacity: 0.78, marginTop: "7px" }}>
                      Use Case: {pair.useCase || "Pair Idea"}
                    </div>

                    <div style={{ fontSize: "13px", opacity: 0.72, marginTop: "7px", fontWeight: 700 }}>
  {formatRelationship(pair.relationship)}
</div>

<div
  style={{
    marginTop: "10px",
    padding: "10px 12px",
    background: "rgba(255,255,255,0.045)",
    border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: "10px",
    fontSize: "12px",
    lineHeight: 1.5,
    opacity: 0.82
  }}
>
  <div>
    <strong>{longTicker}</strong> = {getTickerName(longTicker)}
  </div>
  <div>
    <strong>{shortTicker}</strong> = {getTickerName(shortTicker)}
  </div>
</div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();

                        handleBuildPairStrategy(longTicker, {
                          ticker: shortTicker,
                          correlation: pair.correlation,
                          relationship: pair.relationship,
                          type: "Stock"
                        });
                      }}
                      style={{
                        marginTop: "14px",
                        padding: "10px 12px",
                        background: "#19C37D",
                        color: "#001f3f",
                        border: "none",
                        borderRadius: "8px",
                        fontWeight: 900,
                        cursor: "pointer",
                        width: "100%"
                      }}
                    >
                      Build Pair Strategy
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}