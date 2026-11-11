import React, { useEffect, useMemo, useRef, useState } from "react";
import "./SmartMoneyEventModes.css";
import { useNavigate } from "react-router-dom";
import "./SmartMoney.css";
import logo from "../assets/logo.png";

const API_BASE =
  process.env.NODE_ENV === "development"
    ? "http://localhost:8000"
    : process.env.REACT_APP_API_BASE || "";

const CACHE_TTL_MS = 5 * 60 * 1000; // Data is refreshed by the importer, not by this page.

const MIN_LOADING_MS = 2 * 1000; // polished minimum loader time
const FINAL_LOADING_PAUSE_MS = 450;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const LOADING_STEPS = [
  {
    title: "Loading SEC Form 4 events...",
    detail: "Querying Bullionaire’s stored SEC-derived transaction history.",
    short: "Fetching data",
  },
  {
    title: "Grouping reported transaction lots...",
    detail: "Combining price lots within each disclosed filing and trade event.",
    short: "Parsing filings",
  },
  {
    title: "Filtering actionable signals...",
    detail: "Removing neutral grants, awards, option exercises, and tax-withholding rows.",
    short: "Filtering signals",
  },
  {
    title: "Ranking insider events...",
    detail: "Sorting by recency or fully disclosed event value across stored history.",
    short: "Scoring activity",
  },
  {
    title: "Building transaction layout...",
    detail: "Preparing the insider transaction feed and Smart Money summary.",
    short: "Building layout",
  },
];

function getCacheKey(ticker, mode, days, page, signal) {
  return `bullionaire_smart_money_events_v4_${ticker}_${mode}_${days ?? "all"}_${page}_${signal}`;
}

function readCachedTicker(cacheKey) {
  try {
    const raw = localStorage.getItem(cacheKey);
    if (!raw) return null;

    const cached = JSON.parse(raw);
    if (!cached?.time || !cached?.data) return null;

    const isFresh = Date.now() - cached.time < CACHE_TTL_MS;
    if (!isFresh) {
      localStorage.removeItem(cacheKey);
      return null;
    }

    return cached.data;
  } catch (err) {
    return null;
  }
}

function saveCachedTicker(cacheKey, data) {
  try {
    localStorage.setItem(
      cacheKey,
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
  if (value === null || value === undefined || value === "") return "--";
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
  if (value === null || value === undefined || value === "") return "--";
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
  const [eventMode, setEventMode] = useState("recent");
  const [eventDays, setEventDays] = useState(null); // null = all stored dates
  const [eventPage, setEventPage] = useState(1);
  const [eventMeta, setEventMeta] = useState({ totalEvents: 0, hasMore: false });
  const [eventsUpdating, setEventsUpdating] = useState(false);
  const requestSequence = useRef(0);
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

  const loadTicker = async (
    ticker,
    { forceRefresh = false, mode = eventMode, days = eventDays,
      page = eventPage, signal = signalFilter, quiet = false } = {}
  ) => {
    const cleanTicker = String(ticker || "").trim().toUpperCase();
    if (!cleanTicker) return;

    const requestId = ++requestSequence.current;
    setHasSearched(true);
    setActiveTicker(cleanTicker);
    setErrorMessage("");
    setLoadedFromCache(false);
    setEventMode(mode);
    setEventDays(days);
    setEventPage(page);
    setSignalFilter(signal);
    setSortConfig({ key: mode === "largest" ? "value" : "date", direction: "desc" });

    const key = getCacheKey(cleanTicker, mode, days, page, signal);
    const applyPayload = (payload, fromCache) => {
      if (requestId !== requestSequence.current) return;
      const rows = Array.isArray(payload.transactions) ? payload.transactions : [];
      setTransactions(rows);
      setCompanyName(payload.companyName || rows[0]?.company || cleanTicker);
      setEventMeta({
        totalEvents: Number(payload.totalEvents || 0),
        hasMore: Boolean(payload.hasMore),
      });
      setLoadedFromCache(fromCache);
      if (!rows.length) {
        setErrorMessage(`No ${mode === "largest" ? "fully priced" : "reported"} ${signal === "all" ? "purchase/sale" : signal} events found for ${cleanTicker} in the selected period.`);
      }
    };

    if (!forceRefresh) {
      const cached = readCachedTicker(key);
      if (cached) {
        applyPayload(cached, true);
        setLoading(false);
        setEventsUpdating(false);
        return;
      }
    }

    const startedAt = Date.now();
    if (quiet) {
      setEventsUpdating(true);
    } else {
      setLoading(true);
    }
    try {
      const params = new URLSearchParams({ mode, signal, page: String(page) });
      if (mode === "largest" && days !== null) params.set("days", String(days));
      const res = await fetch(
        `${API_BASE}/smart-money/events/${encodeURIComponent(cleanTicker)}?${params.toString()}`
      );
      if (!res.ok) throw new Error(`Grouped events API returned ${res.status}`);
      const data = await res.json();
      if (requestId !== requestSequence.current) return;

      const rows = Array.isArray(data.transactions) ? data.transactions : [];
      const payload = {
        companyName: rows[0]?.company || cleanTicker,
        transactions: rows,
        totalEvents: data.totalEvents,
        hasMore: data.hasMore,
        fetchedAt: new Date().toISOString(),
      };
      applyPayload(payload, false);
      saveCachedTicker(key, payload);
    } catch (error) {
      if (requestId !== requestSequence.current) return;
      console.error("Failed to load grouped SEC insider events", error);
      setTransactions([]);
      setCompanyName(cleanTicker);
      setEventMeta({ totalEvents: 0, hasMore: false });
      setErrorMessage("Could not load grouped insider events. Ensure the new /smart-money/events/{ticker} backend route is installed and the API is running.");
    } finally {
      if (requestId === requestSequence.current) {
        if (!quiet) {
          const elapsed = Date.now() - startedAt;
          if (elapsed < MIN_LOADING_MS) await wait(MIN_LOADING_MS - elapsed);
          setLoadingStepIndex(LOADING_STEPS.length - 1);
          setProgressPct(98);
          await wait(FINAL_LOADING_PAUSE_MS);
          setProgressPct(100);
          setLoading(false);
        }
        setEventsUpdating(false);
      }
    }
  };

  const chooseMode = (nextMode) => {
    loadTicker(activeTicker, { mode: nextMode, page: 1, quiet: true });
  };
  const chooseWindow = (value) => {
    const nextDays = value === "all" ? null : Number(value);
    loadTicker(activeTicker, { mode: "largest", days: nextDays, page: 1, quiet: true });
  };
  const chooseSignal = (nextSignal) => {
    setSignalFilter(nextSignal);
    if (activeTicker) loadTicker(activeTicker, { signal: nextSignal, page: 1, quiet: true });
  };
  const choosePage = (nextPage) => {
    if (nextPage < 1 || eventsUpdating) return;
    loadTicker(activeTicker, { page: nextPage, quiet: true });
  };

  const handleSearch = (event) => {
    event.preventDefault();
    loadTicker(tickerInput, { page: 1 });
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
            <h1>Insider Transactions</h1>
            <p>
              Search a ticker to compare the most recent and largest reported Form 4 purchases and sales.
              Neutral grants, option exercises, and other non-P/S codes are excluded from this feed.
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
              onClick={() => chooseSignal("all")}
            >
              All
            </button>

            <button
              type="button"
              className={signalFilter === "bullish" ? "active bullish" : ""}
              onClick={() => chooseSignal("bullish")}
            >
              Buys
            </button>

            <button
              type="button"
              className={signalFilter === "bearish" ? "active bearish" : ""}
              onClick={() => chooseSignal("bearish")}
            >
              Sells
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

        {hasSearched && (
          <div className="insider-event-controls">
            <div className="insider-event-controls-heading">
              <strong>Transaction ranking</strong>
              <span>Top 50 grouped events per page · all raw lots remain stored in Supabase</span>
            </div>
            <div className="insider-event-controls-row">
              <div className="insider-event-toggle" role="group" aria-label="Insider event ranking">
                <button type="button" className={eventMode === "recent" ? "active" : ""}
                  disabled={loading || eventsUpdating} onClick={() => chooseMode("recent")}>Most Recent 50</button>
                <button type="button" className={eventMode === "largest" ? "active" : ""}
                  disabled={loading || eventsUpdating} onClick={() => chooseMode("largest")}>Largest 50</button>
              </div>
              {eventMode === "largest" && (
                <label className="insider-event-days">Time period
                  <select value={eventDays === null ? "all" : String(eventDays)}
                    disabled={loading || eventsUpdating} onChange={(event) => chooseWindow(event.target.value)}>
                    <option value="all">All stored dates</option>
                    <option value="30">30 days</option>
                    <option value="90">90 days</option>
                    <option value="180">180 days</option>
                    <option value="365">365 days</option>
                  </select>
                </label>
              )}
              {eventsUpdating && <span className="insider-event-updating" role="status">Updating results…</span>}
            </div>
            <p className="insider-event-context">
              Ranked across the entire stored dataset before selecting 50 events. Lots in the same filing,
              insider, security class, trade date and transaction code are combined. A reported sale may be
              scheduled, tax-related or shared across beneficial owners; no motive is assumed.
            </p>
          </div>
        )}

        {!hasSearched && (
  <div className="insider-market-leaders">
    <div className="insider-market-leaders-top">
      <div>
        <div className="smart-money-kicker">Market-Wide Insider Activity</div>
        <h2>Top Reported Insider Purchases & Sales</h2>
        <p>
          Ranked by total disclosed Form 4 transaction value over the selected time window.
          Related beneficial-owner filings can overlap; totals are reported values, not necessarily distinct economic sales.
          Click any ticker to inspect its grouped event feed.
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

        {hasSearched && !loading && !eventsUpdating && (
          <>
            <div className="insider-result-header">
              <div>
                <span>{activeTicker}</span>
                <h2>{companyName || activeTicker}</h2>
                <p>
  Showing {filteredTransactions.length} grouped events on page {eventPage} of {Math.max(1, Math.ceil(eventMeta.totalEvents / 50))}.
  {" "}{eventMeta.totalEvents.toLocaleString()} events match the selected server-side ranking and filters.
</p>
              </div>

              <div className={`insider-signal-card ${getSignalClass(summary.signal)}`}>
                <span>Page Balance</span>
                <strong>{summary.signal === "Bullish" ? "Buying Leads" : summary.signal === "Bearish" ? "Selling Leads" : "Mixed"}</strong>
              </div>
            </div>

            {errorMessage && (
              <div className="smart-money-lookup-message">{errorMessage}</div>
            )}

            <div className="insider-stat-grid">
              <div className="insider-stat-card">
                <span>Events Shown</span>
                <strong>{summary.totalActionable}</strong>
              </div>

              <div className="insider-stat-card bullish">
                <span>Bullish</span>
                <strong>{summary.bullishCount}</strong>
              </div>

              <div className="insider-stat-card bullish">
                <span>Shown Buy Value</span>
                <strong>{formatMoney(summary.buyValue)}</strong>
              </div>

              <div className="insider-stat-card bearish">
                <span>Shown Sell Value</span>
                <strong>{formatMoney(summary.sellValue)}</strong>
              </div>
            </div>

            <div className="insider-table-card">
              <div className="insider-table-top">
                <div>
                  <div className="smart-money-kicker">Transaction Feed</div>
                  <h2>{activeTicker} {eventMode === "largest" ? "Largest" : "Most Recent"} Insider Events</h2>
                </div>

                <button
                  type="button"
                  className="smart-money-secondary-btn"
                  onClick={() => loadTicker(activeTicker, { forceRefresh: true, quiet: true })}
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
    <th>Security</th>
    <th>Lots</th>
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
    <th>Filing context</th>
    <th>Filing</th>
  </tr>
</thead>

                  <tbody>
                    {sortedTransactions.length ? (
  sortedTransactions.map((row, index) => (
                        <tr key={`${row.accessionNumber || row.date}-${index}`}>
                          <td>{row.date || "--"}</td>
                          <td>{row.insider || "--"}</td>
                          <td>{row.securityTitle || "--"}</td>
                          <td>{formatNumber(row.reportedLots || 1)}</td>
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
                              {row.signal === "Bullish" ? "Purchase" : row.signal === "Bearish" ? "Sale" : row.signal}
                            </span>
                          </td>
                          <td>
                            <div className="insider-audit-context">
                              {row.secAuditStatus === "MATCHED" ? (
                                <span title="SEC issuer, transaction codes, lot counts, dates, security titles, shares and prices matched stored rows when last audited">SEC details matched</span>
                              ) : row.secAuditStatus ? (
                                <span className="insider-audit-review" title={`SEC filing audit: ${row.secAuditStatus}`}>Review required</span>
                              ) : (
                                <span title="No per-filing SEC reconciliation yet">Not yet audited</span>
                              )}
                              {row.filingMentions10b5One && (
                                <span title="Rule 10b5-1 referenced in the filing; not necessarily every sale in the filing">10b5-1 referenced</span>
                              )}
                              {row.filingMentionsTaxWithholding && (
                                <span title="Tax withholding referenced in the filing; not proof this specific lot was tax-related">Tax reference</span>
                              )}
                            </div>
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
                        <td colSpan="13">
                          No bullish or bearish insider transactions found for
                          this filter.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="insider-event-pagination">
                <button type="button" className="smart-money-secondary-btn"
                  disabled={eventPage <= 1 || eventsUpdating || loading}
                  onClick={() => choosePage(eventPage - 1)}>Previous 50</button>
                <span>Page {eventPage} of {Math.max(1, Math.ceil(eventMeta.totalEvents / 50))}</span>
                <button type="button" className="smart-money-secondary-btn"
                  disabled={!eventMeta.hasMore || eventsUpdating || loading}
                  onClick={() => choosePage(eventPage + 1)}>Next 50</button>
              </div>
              <p className="insider-event-footnote">
                Prices are weighted across disclosed lots. “--” means not reliably disclosed.
                Column-heading sorting only reorders the current 50; the Recent/Largest ranking comes from the server.
                Related SEC filings can describe overlapping beneficial ownership and should not automatically be summed as separate economic sales.
              </p>
            </div>
          </>
        )}
      </section>
    </div>
  );
}