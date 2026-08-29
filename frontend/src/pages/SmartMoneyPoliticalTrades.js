import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./SmartMoney.css";

const MOCK_POLITICAL_TRADES = [
  {
    politician: "Representative A",
    party: "House",
    ticker: "NVDA",
    company: "NVIDIA Corp",
    transaction: "Purchase",
    size: "$250K - $500K",
    reportedDate: "2026-05-18",
    sector: "Semiconductors",
    theme: "AI Infrastructure",
    signal: "Bullish",
  },
  {
    politician: "Senator B",
    party: "Senate",
    ticker: "MSFT",
    company: "Microsoft Corp",
    transaction: "Purchase",
    size: "$100K - $250K",
    reportedDate: "2026-05-12",
    sector: "Software",
    theme: "AI / Cloud",
    signal: "Bullish",
  },
  {
    politician: "Representative C",
    party: "House",
    ticker: "XOM",
    company: "Exxon Mobil Corp",
    transaction: "Sale",
    size: "$500K - $1M",
    reportedDate: "2026-05-08",
    sector: "Energy",
    theme: "Oil & Gas",
    signal: "Bearish",
  },
  {
    politician: "Representative D",
    party: "House",
    ticker: "LMT",
    company: "Lockheed Martin Corp",
    transaction: "Purchase",
    size: "$50K - $100K",
    reportedDate: "2026-04-29",
    sector: "Defense",
    theme: "Defense Spending",
    signal: "Bullish",
  },
  {
    politician: "Senator E",
    party: "Senate",
    ticker: "UNH",
    company: "UnitedHealth Group",
    transaction: "Sale",
    size: "$100K - $250K",
    reportedDate: "2026-04-21",
    sector: "Healthcare",
    theme: "Healthcare Policy",
    signal: "Bearish",
  },
];

function getSignalClass(signal) {
  const clean = String(signal || "").toLowerCase();

  if (clean === "bullish") return "bullish";
  if (clean === "bearish") return "bearish";
  return "neutral";
}

export default function SmartMoneyPoliticalTrades() {
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const [signalFilter, setSignalFilter] = useState("all");

  const filteredRows = useMemo(() => {
    const cleanSearch = search.trim().toUpperCase();

    return MOCK_POLITICAL_TRADES.filter((row) => {
      const matchesSearch =
        !cleanSearch ||
        row.ticker.includes(cleanSearch) ||
        row.company.toUpperCase().includes(cleanSearch) ||
        row.politician.toUpperCase().includes(cleanSearch) ||
        row.sector.toUpperCase().includes(cleanSearch) ||
        row.theme.toUpperCase().includes(cleanSearch);

      const matchesSignal =
        signalFilter === "all" ||
        row.signal.toLowerCase() === signalFilter.toLowerCase();

      return matchesSearch && matchesSignal;
    });
  }, [search, signalFilter]);

  const summary = useMemo(() => {
    const bullishCount = MOCK_POLITICAL_TRADES.filter(
      (row) => row.signal === "Bullish"
    ).length;

    const bearishCount = MOCK_POLITICAL_TRADES.filter(
      (row) => row.signal === "Bearish"
    ).length;

    const houseCount = MOCK_POLITICAL_TRADES.filter(
      (row) => row.party === "House"
    ).length;

    const senateCount = MOCK_POLITICAL_TRADES.filter(
      (row) => row.party === "Senate"
    ).length;

    return {
      total: MOCK_POLITICAL_TRADES.length,
      bullishCount,
      bearishCount,
      houseCount,
      senateCount,
    };
  }, []);

  return (
    <div className="political-terminal-page">
      <section className="political-terminal-panel">
        <div className="political-terminal-top">
          <div>
            <div className="smart-money-kicker">Congressional Trading Intelligence</div>
            <h1>Political Trade Watchlist</h1>
            <p>
              Monitor politician disclosures and surface trades connected to
              sectors, macro themes, legislation, and government spending trends.
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

        <div className="political-command-row">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search ticker, politician, sector, or theme..."
            className="political-search-input"
          />

          <div className="political-filter-toggle">
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

          <div className="political-status-pill">Coming Soon: Live Disclosures</div>
        </div>

        <div className="political-stat-grid">
          <div className="political-stat-card">
            <span>Total Tracked Trades</span>
            <strong>{summary.total}</strong>
            <p>Recent mock disclosure rows</p>
          </div>

          <div className="political-stat-card bullish">
            <span>Bullish Trades</span>
            <strong>{summary.bullishCount}</strong>
            <p>Purchases and positive exposure</p>
          </div>

          <div className="political-stat-card bearish">
            <span>Bearish Trades</span>
            <strong>{summary.bearishCount}</strong>
            <p>Sales and reduced exposure</p>
          </div>

          <div className="political-stat-card neutral">
            <span>Chamber Split</span>
            <strong>
              {summary.houseCount} / {summary.senateCount}
            </strong>
            <p>House / Senate disclosure mix</p>
          </div>
        </div>

        <div className="political-theme-grid">
          <div className="political-theme-card">
            <span>Hot Theme</span>
            <strong>AI Infrastructure</strong>
            <p>
              Political activity tied to semiconductors, cloud infrastructure,
              data centers, and defense AI spending.
            </p>
          </div>

          <div className="political-theme-card">
            <span>Policy Watch</span>
            <strong>Defense Spending</strong>
            <p>
              Tracks defense contractors and aerospace names that may be
              sensitive to federal budget cycles.
            </p>
          </div>

          <div className="political-theme-card">
            <span>Risk Watch</span>
            <strong>Healthcare Policy</strong>
            <p>
              Flags healthcare trades that could connect to regulation,
              reimbursement, or congressional policy themes.
            </p>
          </div>
        </div>

        <div className="political-table-card">
          <div className="political-table-top">
            <div>
              <div className="smart-money-kicker">Disclosure Feed</div>
              <h2>Political Trade Watchlist</h2>
              <p>
                Mock layout for now. Later this can connect to Quiver,
                Capitol Trades, or your own disclosure database.
              </p>
            </div>

            <span>Mock Data</span>
          </div>

          <div className="smart-money-table-wrap">
            <table className="smart-money-table political-clean-table">
              <thead>
                <tr>
                  <th>Reported</th>
                  <th>Politician</th>
                  <th>Chamber</th>
                  <th>Ticker</th>
                  <th>Company</th>
                  <th>Trade</th>
                  <th>Size</th>
                  <th>Sector</th>
                  <th>Theme</th>
                  <th>Signal</th>
                </tr>
              </thead>

              <tbody>
                {filteredRows.length ? (
                  filteredRows.map((row, index) => (
                    <tr key={`${row.ticker}-${row.politician}-${index}`}>
                      <td>{row.reportedDate}</td>
                      <td>{row.politician}</td>
                      <td>{row.party}</td>
                      <td>
                        <button
                          type="button"
                          className="ticker-link-button"
                          onClick={() => navigate(`/stocks/${row.ticker}`)}
                        >
                          {row.ticker}
                        </button>
                      </td>
                      <td>{row.company}</td>
                      <td>{row.transaction}</td>
                      <td>{row.size}</td>
                      <td>{row.sector}</td>
                      <td>{row.theme}</td>
                      <td>
                        <span
                          className={`smart-money-signal-pill ${getSignalClass(
                            row.signal
                          )}`}
                        >
                          {row.signal}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="10">No matching political trades found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}