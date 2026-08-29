import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./SmartMoney.css";

const MOCK_ACCUMULATION = [
  {
    ticker: "NVDA",
    company: "NVIDIA Corp",
    signal: "Strong Accumulation",
    netChange: "$18.4B",
    fundsAdding: 842,
    fundsReducing: 391,
    topBuyer: "Vanguard Group",
    concentration: "High",
  },
  {
    ticker: "MSFT",
    company: "Microsoft Corp",
    signal: "Accumulation",
    netChange: "$12.7B",
    fundsAdding: 731,
    fundsReducing: 428,
    topBuyer: "BlackRock",
    concentration: "Moderate",
  },
  {
    ticker: "AMZN",
    company: "Amazon.com Inc",
    signal: "Accumulation",
    netChange: "$9.9B",
    fundsAdding: 604,
    fundsReducing: 377,
    topBuyer: "State Street",
    concentration: "Moderate",
  },
  {
    ticker: "TSLA",
    company: "Tesla Inc",
    signal: "Distribution",
    netChange: "-$4.2B",
    fundsAdding: 291,
    fundsReducing: 512,
    topBuyer: "ARK Investment",
    concentration: "High",
  },
];

function getSignalClass(signal) {
  const clean = String(signal || "").toLowerCase();

  if (clean.includes("strong") || clean === "accumulation") return "bullish";
  if (clean.includes("distribution")) return "bearish";
  return "neutral";
}

export default function SmartMoneyInstitutionalAccumulation() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");

  const filteredRows = useMemo(() => {
    const clean = search.trim().toUpperCase();

    if (!clean) return MOCK_ACCUMULATION;

    return MOCK_ACCUMULATION.filter((row) => {
      return (
        row.ticker.includes(clean) ||
        row.company.toUpperCase().includes(clean)
      );
    });
  }, [search]);

  return (
    <div className="institutional-terminal-page">
      <section className="institutional-terminal-panel">
        <div className="institutional-terminal-top">
          <div>
            <div className="smart-money-kicker">13F Smart Money Tracker</div>
            <h1>Institutional Accumulation</h1>
            <p>
              Track where major funds appear to be adding, reducing, or
              concentrating exposure based on institutional ownership trends.
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

        <div className="institutional-command-row">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search ticker or company..."
            className="institutional-search-input"
          />

          <div className="institutional-status-pill">Coming Soon: Live 13F Data</div>
        </div>

        <div className="institutional-hero-grid">
          <div className="institutional-hero-card bullish">
            <span>Most Important Signal</span>
            <strong>Net Institutional Buying</strong>
            <p>
              Highlights companies where fund ownership appears to be rising
              across large institutional holders.
            </p>
          </div>

          <div className="institutional-hero-card neutral">
            <span>Data Source Roadmap</span>
            <strong>13F Filings</strong>
            <p>
              Later this page can connect to 13F filings, top holders, fund
              additions, reductions, and concentration changes.
            </p>
          </div>

          <div className="institutional-hero-card bearish">
            <span>Risk Signal</span>
            <strong>Distribution</strong>
            <p>
              Flags names where more funds are reducing exposure than adding,
              especially when dollar value is meaningful.
            </p>
          </div>
        </div>

        <div className="institutional-table-card">
          <div className="institutional-table-top">
            <div>
              <div className="smart-money-kicker">Market-Wide Fund Flow</div>
              <h2>Accumulation Watchlist</h2>
            </div>

            <span>Mock Layout</span>
          </div>

          <div className="smart-money-table-wrap">
            <table className="smart-money-table institutional-clean-table">
              <thead>
                <tr>
                  <th>Ticker</th>
                  <th>Company</th>
                  <th>Signal</th>
                  <th>Net Change</th>
                  <th>Funds Adding</th>
                  <th>Funds Reducing</th>
                  <th>Top Buyer</th>
                  <th>Concentration</th>
                </tr>
              </thead>

              <tbody>
                {filteredRows.map((row) => (
                  <tr key={row.ticker}>
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
                    <td>
                      <span
                        className={`smart-money-signal-pill ${getSignalClass(
                          row.signal
                        )}`}
                      >
                        {row.signal}
                      </span>
                    </td>
                    <td>{row.netChange}</td>
                    <td>{row.fundsAdding}</td>
                    <td>{row.fundsReducing}</td>
                    <td>{row.topBuyer}</td>
                    <td>{row.concentration}</td>
                  </tr>
                ))}

                {!filteredRows.length && (
                  <tr>
                    <td colSpan="8">No matching institutions found.</td>
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