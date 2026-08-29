import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./SmartMoney.css";
import logo from "../assets/logo.png";

const API_BASE =
  process.env.NODE_ENV === "development"
    ? "http://localhost:8000"
    : process.env.REACT_APP_API_BASE || "";

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

const MIN_LOADING_MS = 2 * 1000; // polished minimum loader time
const FINAL_LOADING_PAUSE_MS = 450;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const LOADING_STEPS = [
  {
    title: "Fetching SEC Form 4 filings...",
    detail: "Connecting to the Smart Money engine and locating recent insider filings.",
    short: "Fetching data",
  },
  {
    title: "Parsing insider transactions...",
    detail: "Reading Form 4 transaction codes, shares, prices, and ownership changes.",
    short: "Parsing filings",
  },
  {
    title: "Filtering actionable signals...",
    detail: "Removing neutral grants, awards, option exercises, and tax-withholding rows.",
    short: "Filtering signals",
  },
  {
    title: "Calculating buy and sell pressure...",
    detail: "Summarizing bullish and bearish transaction value.",
    short: "Scoring activity",
  },
  {
    title: "Building transaction layout...",
    detail: "Preparing the insider transaction feed and Smart Money summary.",
    short: "Building layout",
  },
];

function getCacheKey(ticker) {
  return `bullionaire_smart_money_insiders_${ticker}`;
}

function readCachedTicker(ticker) {
  try {
    const raw = localStorage.getItem(getCacheKey(ticker));
    if (!raw) return null;

    const cached = JSON.parse(raw);
    if (!cached?.time || !cached?.data) return null;

    const isFresh = Date.now() - cached.time < CACHE_TTL_MS;
    if (!isFresh) {
      localStorage.removeItem(getCacheKey(ticker));
      return null;
    }

    return cached.data;
  } catch (err) {
    return null;
  }
}

function saveCachedTicker(ticker, data) {
  try {
    localStorage.setItem(
      getCacheKey(ticker),
      JSON.stringify({
        time: Date.now(),
        data,
      })
    );
  } catch (err) {
    console.warn("Could not cache Smart Money data", err);
  }
}

function formatMoney(value) {
  const num = Number(value);

  if (!Number.isFinite(num)) return "--";

  if (Math.abs(num) >= 1_000_000_000) {
    return `$${(num / 1_000_000_000).toFixed(2)}B`;
  }

  if (Math.abs(num) >= 1_000_000) {
    return `$${(num / 1_000_000).toFixed(2)}M`;
  }

  if (Math.abs(num) >= 1_000) {
    return `$${(num / 1_000).toFixed(1)}K`;
  }

  return `$${num.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function formatNumber(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "--";
  return num.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function getSignalClass(signal) {
  const clean = String(signal || "").toLowerCase();

  if (clean === "bullish") return "bullish";
  if (clean === "bearish") return "bearish";
  return "neutral";
}

function normalizeTransactionLabel(label) {
  if (!label) return "--";

  if (label === "Tax Withholding / Disposition") {
    return "Tax Withholding";
  }

  return label;
}

export default function SmartMoneyInsiderTransactions() {
  const navigate = useNavigate();

  const [tickerInput, setTickerInput] = useState("");
  const [activeTicker, setActiveTicker] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [transactions, setTransactions] = useState([]);
  const [signalFilter, setSignalFilter] = useState("all");
  const [loading, setLoading] = useState(false);
  const [sortConfig, setSortConfig] = useState({
  key: "date",
  direction: "desc",
});
  const [marketLeaders, setMarketLeaders] = useState({
  buys: [],
  sells: [],
});
const [leadersLoading, setLeadersLoading] = useState(false);
const [leaderDays, setLeaderDays] = useState(90);
  const [hasSearched, setHasSearched] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [loadedFromCache, setLoadedFromCache] = useState(false);
  const [loadingStepIndex, setLoadingStepIndex] = useState(0);
  const [estimatedSeconds, setEstimatedSeconds] = useState(5);
const [progressPct, setProgressPct] = useState(12);

  const actionableTransactions = useMemo(() => {
    return transactions.filter((row) => {
      return row.signal === "Bullish" || row.signal === "Bearish";
    });
  }, [transactions]);

  const filteredTransactions = useMemo(() => {
    if (signalFilter === "bullish") {
      return actionableTransactions.filter((row) => row.signal === "Bullish");
    }

    if (signalFilter === "bearish") {
      return actionableTransactions.filter((row) => row.signal === "Bearish");
    }

    return actionableTransactions;
  }, [actionableTransactions, signalFilter]);

  const sortedTransactions = useMemo(() => {
  const rows = [...filteredTransactions];

  const getSortValue = (row, key) => {
    if (key === "date") {
      return row.date ? new Date(row.date).getTime() : 0;
    }

    if (key === "value") {
      return Number(row.value || 0);
    }

    if (key === "shares") {
      return Number(row.shares || 0);
    }

    if (key === "price") {
      return Number(row.price || 0);
    }

    if (key === "ownedAfter") {
      return Number(row.sharesOwnedFollowing || 0);
    }

    if (key === "signal") {
      return String(row.signal || "");
    }

    return String(row[key] || "").toLowerCase();
  };

  rows.sort((a, b) => {
    const aValue = getSortValue(a, sortConfig.key);
    const bValue = getSortValue(b, sortConfig.key);

    if (aValue < bValue) {
      return sortConfig.direction === "asc" ? -1 : 1;
    }

    if (aValue > bValue) {
      return sortConfig.direction === "asc" ? 1 : -1;
    }

    return 0;
  });

  return rows;
}, [filteredTransactions, sortConfig]);

const handleSort = (key) => {
  setSortConfig((current) => {
    if (current.key === key) {
      return {
        key,
        direction: current.direction === "asc" ? "desc" : "asc",
      };
    }

    return {
      key,
      direction: key === "date" ? "desc" : "desc",
    };
  });
};

const getSortLabel = (key) => {
  if (sortConfig.key !== key) return "";

  return sortConfig.direction === "asc" ? " ↑" : " ↓";
};

  const summary = useMemo(() => {
    const bullishRows = actionableTransactions.filter(
      (row) => row.signal === "Bullish"
    );

    const bearishRows = actionableTransactions.filter(
      (row) => row.signal === "Bearish"
    );

    const buyValue = bullishRows.reduce(
      (sum, row) => sum + Number(row.value || 0),
      0
    );

    const sellValue = bearishRows.reduce(
      (sum, row) => sum + Number(row.value || 0),
      0
    );

    const signal =
      bullishRows.length > bearishRows.length && buyValue >= sellValue
        ? "Bullish"
        : bearishRows.length > bullishRows.length && sellValue > buyValue
        ? "Bearish"
        : "Mixed";

    const totalActionable = actionableTransactions.length;

let dataDepthLabel = "No recent actionable insider buys/sells found";
let dataDepthClass = "none";

if (totalActionable >= 20) {
  dataDepthLabel = "Strong data depth";
  dataDepthClass = "strong";
} else if (totalActionable >= 10) {
  dataDepthLabel = "Good data depth";
  dataDepthClass = "good";
} else if (totalActionable >= 1) {
  dataDepthLabel = "Limited insider activity";
  dataDepthClass = "limited";
}

return {
  signal,
  bullishCount: bullishRows.length,
  bearishCount: bearishRows.length,
  buyValue,
  sellValue,
  totalActionable,
  dataDepthLabel,
  dataDepthClass,
};
  }, [actionableTransactions]);

useEffect(() => {
  if (!loading) {
    setLoadingStepIndex(0);
    setEstimatedSeconds(5);
    setProgressPct(12);
    return undefined;
  }

  const startedAt = Date.now();

  setLoadingStepIndex(0);
  setEstimatedSeconds(5);
  setProgressPct(12);

  const interval = setInterval(() => {
    const elapsedMs = Date.now() - startedAt;

    const nextStepIndex = Math.min(
      Math.floor(elapsedMs / 800),
      LOADING_STEPS.length - 1
    );

    const remainingSeconds = Math.ceil((MIN_LOADING_MS - elapsedMs) / 1000);

    setLoadingStepIndex(nextStepIndex);
    setEstimatedSeconds(Math.max(1, remainingSeconds));
    setProgressPct(Math.min(94, 12 + elapsedMs / 55));
  }, 250);

  return () => clearInterval(interval);
}, [loading]);

useEffect(() => {
  const loadMarketLeaders = async () => {
    setLeadersLoading(true);

    try {
      const res = await fetch(
        `${API_BASE}/smart-money/market-leaders?days=${leaderDays}&limit=8`
      );

      if (!res.ok) {
        throw new Error(`Market leaders request failed: ${res.status}`);
      }

      const data = await res.json();

      setMarketLeaders({
        buys: Array.isArray(data.buys) ? data.buys : [],
        sells: Array.isArray(data.sells) ? data.sells : [],
      });
    } catch (err) {
      console.error("Failed to load market-wide insider leaders", err);
      setMarketLeaders({
        buys: [],
        sells: [],
      });
    } finally {
      setLeadersLoading(false);
    }
  };

  loadMarketLeaders();
}, [leaderDays]);

const currentLoadingStep =
  LOADING_STEPS[Math.min(loadingStepIndex, LOADING_STEPS.length - 1)];

  const loadTicker = async (ticker, forceRefresh = false) => {
    const cleanTicker = ticker.trim().toUpperCase();

    if (!cleanTicker) return;

    setHasSearched(true);
    setActiveTicker(cleanTicker);
    setErrorMessage("");
    setLoadedFromCache(false);

    if (!forceRefresh) {
      const cached = readCachedTicker(cleanTicker);

      if (cached) {
        const rows = Array.isArray(cached.transactions)
          ? cached.transactions
          : [];

        setTransactions(rows);
        setCompanyName(cached.companyName || rows[0]?.company || cleanTicker);
        setLoadedFromCache(true);
        return;
      }
    }

    const loadStartedAt = Date.now();

setLoading(true);

try {
      const res = await fetch(
  `${API_BASE}/smart-money/${encodeURIComponent(cleanTicker)}?limit=120&signal=all`
);

      if (!res.ok) {
        throw new Error(`Request failed with status ${res.status}`);
      }

      const data = await res.json();

      const rows = Array.isArray(data.transactions) ? data.transactions : [];

      const payload = {
        ticker: cleanTicker,
        companyName: rows[0]?.company || cleanTicker,
        transactions: rows,
        fetchedAt: new Date().toISOString(),
        backendCached: Boolean(data.cached),
      };

      setTransactions(rows);
      setCompanyName(payload.companyName);
      saveCachedTicker(cleanTicker, payload);

      const actionable = rows.filter(
        (row) => row.signal === "Bullish" || row.signal === "Bearish"
      );

      if (!actionable.length) {
        setErrorMessage(
          `No bullish or bearish insider transactions found for ${cleanTicker}. Neutral grants, awards, option exercises, and tax-withholding rows were hidden.`
        );
      }
    } catch (err) {
      console.error("Failed to load insider transactions", err);
      setTransactions([]);
      setCompanyName(cleanTicker);
      setErrorMessage(
        "Could not load insider transaction data. Make sure your backend is running and the /smart-money/{ticker} route is working."
      );
    } finally {
  const elapsedMs = Date.now() - loadStartedAt;
  const remainingMs = Math.max(0, MIN_LOADING_MS - elapsedMs);

  if (remainingMs > 0) {
    await wait(remainingMs);
  }

  setLoadingStepIndex(LOADING_STEPS.length - 1);
  setEstimatedSeconds(1);
  setProgressPct(98);

  await wait(FINAL_LOADING_PAUSE_MS);

  setProgressPct(100);
  setLoading(false);
}
  };

  const handleSearch = (event) => {
    event.preventDefault();
    loadTicker(tickerInput);
  };

  return (
    <div className="insider-terminal-page">
      {loading && (
  <div className="bullionaire-loading-screen">
    <div className="bullionaire-loading-card">
      <div className="bullionaire-loading-logo-wrap">
        <div className="bullionaire-loading-ring"></div>

        <div className="bullionaire-loading-logo">
          <img
  src={logo}
  alt="Bullionaire"
  className="bullionaire-loading-logo-img"
/>
        </div>
      </div>

      <div className="bullionaire-loading-title">BULLIONAIRE</div>

      <div className="bullionaire-loading-step">
        {currentLoadingStep.title}
      </div>

      <div className="bullionaire-loading-subtitle">
        {currentLoadingStep.detail}
      </div>

      <div className="bullionaire-loading-time">
        Estimated time: {estimatedSeconds} second
        {estimatedSeconds === 1 ? "" : "s"}
      </div>

      <div className="bullionaire-loading-progress-track">
        <div
          className="bullionaire-loading-progress-fill"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      <div className="bullionaire-loading-checklist">
        {LOADING_STEPS.map((step, index) => {
          const isComplete = index < loadingStepIndex;
          const isActive = index === loadingStepIndex;

          return (
            <div
              key={step.short}
              className={`bullionaire-loading-check ${
                isComplete ? "complete" : ""
              } ${isActive ? "active" : ""}`}
            >
              <span>{isComplete ? "✓" : isActive ? "•" : ""}</span>
              <p>{step.short}</p>
            </div>
          );
        })}
      </div>
    </div>
  </div>
)}

      <section className="insider-terminal-panel">
        <div className="insider-terminal-top">
          <div>
            <div className="smart-money-kicker">SEC Form 4 Intelligence</div>
            <h1>Recent Insider Transactions</h1>
            <p>
              Search a ticker to view only meaningful bullish and bearish insider
              transactions. Neutral grants, awards, option exercises, and tax
              withholding are hidden by default.
            </p>
          </div>

          <button
  className="smart-money-secondary-btn"
  type="button"
  onClick={() => navigate("/smart-money")}
>
  Back
</button>
        </div>

        <form className="insider-search-bar" onSubmit={handleSearch}>
          <input
            value={tickerInput}
            onChange={(event) =>
              setTickerInput(event.target.value.toUpperCase())
            }
            placeholder="Search ticker..."
            className="insider-search-input"
            autoFocus
          />

          <div className="insider-filter-toggle">
            <button
              type="button"
              className={signalFilter === "all" ? "active" : ""}
              onClick={() => setSignalFilter("all")}
            >
              All
            </button>

            <button
              type="button"
              className={signalFilter === "bullish" ? "active bullish" : ""}
              onClick={() => setSignalFilter("bullish")}
            >
              Bullish
            </button>

            <button
              type="button"
              className={signalFilter === "bearish" ? "active bearish" : ""}
              onClick={() => setSignalFilter("bearish")}
            >
              Bearish
            </button>
          </div>

          <button
            className="insider-search-button"
            type="submit"
            disabled={loading}
          >
            Search
          </button>
        </form>

        {!hasSearched && (
  <div className="insider-market-leaders">
    <div className="insider-market-leaders-top">
      <div>
        <div className="smart-money-kicker">Market-Wide Insider Activity</div>
        <h2>Top Insider Buy & Sell Pressure</h2>
        <p>
          Ranked by total disclosed Form 4 transaction value over the selected time window.
Click any ticker to open its insider transaction feed.
        </p>
      </div>

      <div className="insider-leader-window-toggle">
  {[30, 90, 180, 365].map((days) => (
    <button
      key={days}
      type="button"
      className={leaderDays === days ? "active" : ""}
      onClick={() => setLeaderDays(days)}
      disabled={leadersLoading}
    >
      {days}D
    </button>
  ))}
</div>
    </div>

    <div className="insider-leaderboard-grid">
      <div className="insider-leaderboard-card bullish">
        <div className="insider-leaderboard-header">
          <h3>Most Insider Buying</h3>
          <span>Bullish</span>
        </div>

        <div className="insider-leaderboard-list">
          {marketLeaders.buys.length ? (
            marketLeaders.buys.map((row, index) => (
              <button
                key={`buy-${row.ticker}`}
                type="button"
                className="insider-leaderboard-row"
                onClick={() => {
                  setTickerInput(row.ticker);
                  loadTicker(row.ticker);
                }}
              >
                <strong>#{index + 1}</strong>

                <div>
                  <b>{row.ticker}</b>
                  <small>{row.company || row.ticker}</small>
                </div>

                <span>{formatMoney(row.totalValue)}</span>
              </button>
            ))
          ) : (
            <p className="insider-leaderboard-empty">
              No buy leaders loaded yet. This will fill as the database backfill finishes.
            </p>
          )}
        </div>
      </div>

      <div className="insider-leaderboard-card bearish">
        <div className="insider-leaderboard-header">
          <h3>Most Insider Selling</h3>
          <span>Bearish</span>
        </div>

        <div className="insider-leaderboard-list">
          {marketLeaders.sells.length ? (
            marketLeaders.sells.map((row, index) => (
              <button
                key={`sell-${row.ticker}`}
                type="button"
                className="insider-leaderboard-row"
                onClick={() => {
                  setTickerInput(row.ticker);
                  loadTicker(row.ticker);
                }}
              >
                <strong>#{index + 1}</strong>

                <div>
                  <b>{row.ticker}</b>
                  <small>{row.company || row.ticker}</small>
                </div>

                <span>{formatMoney(row.totalValue)}</span>
              </button>
            ))
          ) : (
            <p className="insider-leaderboard-empty">
              No sell leaders loaded yet. This will fill as the database backfill finishes.
            </p>
          )}
        </div>
      </div>
    </div>
  </div>
)}

        {hasSearched && !loading && (
          <>
            <div className="insider-result-header">
              <div>
                <span>{activeTicker}</span>
                <h2>{companyName || activeTicker}</h2>
                <p>
  Showing {filteredTransactions.length} of {summary.totalActionable} actionable insider buy/sell transactions.
  Data depth: {summary.dataDepthLabel}.
</p>
              </div>

              <div className={`insider-signal-card ${getSignalClass(summary.signal)}`}>
                <span>Net Signal</span>
                <strong>{summary.signal}</strong>
              </div>
            </div>

            {errorMessage && (
              <div className="smart-money-lookup-message">{errorMessage}</div>
            )}

            <div className="insider-context-alert">
  <strong>Important context:</strong> Insider sells are usually less predictive than insider buys.
  Insiders may sell for taxes, diversification, liquidity, estate planning, or scheduled trading plans.
  Insider buys are generally more meaningful because insiders usually buy when they believe the stock is undervalued or future prospects are strong.
</div>


            <div className="insider-stat-grid">
              <div className="insider-stat-card">
                <span>Actionable Rows</span>
                <strong>{summary.totalActionable}</strong>
              </div>

              <div className="insider-stat-card bullish">
                <span>Bullish</span>
                <strong>{summary.bullishCount}</strong>
              </div>

              <div className="insider-stat-card bullish">
                <span>Buy Value</span>
                <strong>{formatMoney(summary.buyValue)}</strong>
              </div>

              <div className="insider-stat-card bearish">
                <span>Sell Value</span>
                <strong>{formatMoney(summary.sellValue)}</strong>
              </div>
            </div>

            <div className="insider-table-card">
              <div className="insider-table-top">
                <div>
                  <div className="smart-money-kicker">Transaction Feed</div>
                  <h2>{activeTicker} Insider Transactions</h2>
                </div>

                <button
                  type="button"
                  className="smart-money-secondary-btn"
                  onClick={() => loadTicker(activeTicker, true)}
                >
                  Refresh
                </button>
              </div>

              <div className="smart-money-table-wrap">
                <table className="smart-money-table insider-clean-table">
                  <thead>
  <tr>
    <th>
      <button
        type="button"
        className="insider-sort-header"
        onClick={() => handleSort("date")}
      >
        Date{getSortLabel("date")}
      </button>
    </th>
    <th>Insider</th>
    <th>Title</th>
    <th>Transaction</th>
    <th>
      <button
        type="button"
        className="insider-sort-header"
        onClick={() => handleSort("shares")}
      >
        Shares{getSortLabel("shares")}
      </button>
    </th>
    <th>
      <button
        type="button"
        className="insider-sort-header"
        onClick={() => handleSort("price")}
      >
        Price{getSortLabel("price")}
      </button>
    </th>
    <th>
      <button
        type="button"
        className="insider-sort-header"
        onClick={() => handleSort("value")}
      >
        Value{getSortLabel("value")}
      </button>
    </th>
    <th>
      <button
        type="button"
        className="insider-sort-header"
        onClick={() => handleSort("ownedAfter")}
      >
        Owned After{getSortLabel("ownedAfter")}
      </button>
    </th>
    <th>
      <button
        type="button"
        className="insider-sort-header"
        onClick={() => handleSort("signal")}
      >
        Signal{getSortLabel("signal")}
      </button>
    </th>
    <th>Filing</th>
  </tr>
</thead>

                  <tbody>
                    {sortedTransactions.length ? (
  sortedTransactions.map((row, index) => (
                        <tr key={`${row.accessionNumber || row.date}-${index}`}>
                          <td>{row.date || "--"}</td>
                          <td>{row.insider || "--"}</td>
                          <td>{row.title || "--"}</td>
                          <td>{normalizeTransactionLabel(row.transactionType)}</td>
                          <td>{formatNumber(row.shares)}</td>
                          <td>
                            {row.price != null
                              ? `$${Number(row.price).toFixed(2)}`
                              : "--"}
                          </td>
                          <td>{formatMoney(row.value)}</td>
                          <td>{formatNumber(row.sharesOwnedFollowing)}</td>
                          <td>
                            <span
                              className={`smart-money-signal-pill ${getSignalClass(
                                row.signal
                              )}`}
                            >
                              {row.signal}
                            </span>
                          </td>
                          <td>
                            {row.filingUrl ? (
                              <a
                                className="smart-money-filing-link"
                                href={row.filingUrl}
                                target="_blank"
                                rel="noreferrer"
                              >
                                View SEC
                              </a>
                            ) : (
                              "--"
                            )}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="10">
                          No bullish or bearish insider transactions found for
                          this filter.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}