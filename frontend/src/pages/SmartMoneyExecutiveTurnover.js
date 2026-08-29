import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./SmartMoney.css";

const MOCK_TURNOVER_ALERTS = [
  {
    ticker: "SBUX",
    company: "Starbucks Corp",
    executive: "CEO Transition",
    role: "Chief Executive Officer",
    event: "New CEO Appointed",
    date: "2026-05-20",
    severity: "High",
    signal: "Watch",
    reason: "Leadership transition may shift strategy, cost structure, or growth priorities.",
  },
  {
    ticker: "DIS",
    company: "Walt Disney Co",
    executive: "Succession Planning",
    role: "Chief Executive Officer",
    event: "CEO Succession Watch",
    date: "2026-05-12",
    severity: "Medium",
    signal: "Neutral",
    reason: "Large-cap leadership continuity and succession planning remain important.",
  },
  {
    ticker: "BA",
    company: "Boeing Co",
    executive: "Senior Leadership",
    role: "Operations / Safety Leadership",
    event: "Leadership Restructuring",
    date: "2026-04-30",
    severity: "High",
    signal: "Risk",
    reason: "Operational leadership changes can matter when execution risk is already elevated.",
  },
  {
    ticker: "INTC",
    company: "Intel Corp",
    executive: "Executive Team",
    role: "Technology / Product Leadership",
    event: "Strategy Leadership Shift",
    date: "2026-04-18",
    severity: "Medium",
    signal: "Watch",
    reason: "Turnaround names are sensitive to leadership credibility and execution timelines.",
  },
  {
    ticker: "NKE",
    company: "Nike Inc",
    executive: "Management Team",
    role: "Growth / Brand Leadership",
    event: "Executive Departure",
    date: "2026-04-05",
    severity: "Medium",
    signal: "Watch",
    reason: "Consumer brands can react strongly to leadership changes in brand, product, or sales.",
  },
];

function getSignalClass(value) {
  const clean = String(value || "").toLowerCase();

  if (clean.includes("positive") || clean.includes("low")) return "bullish";
  if (clean.includes("risk") || clean.includes("high")) return "bearish";
  return "neutral";
}

export default function SmartMoneyExecutiveTurnover() {
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const [severityFilter, setSeverityFilter] = useState("all");

  const filteredRows = useMemo(() => {
    const cleanSearch = search.trim().toUpperCase();

    return MOCK_TURNOVER_ALERTS.filter((row) => {
      const matchesSearch =
        !cleanSearch ||
        row.ticker.includes(cleanSearch) ||
        row.company.toUpperCase().includes(cleanSearch) ||
        row.event.toUpperCase().includes(cleanSearch) ||
        row.role.toUpperCase().includes(cleanSearch);

      const matchesSeverity =
        severityFilter === "all" ||
        row.severity.toLowerCase() === severityFilter.toLowerCase();

      return matchesSearch && matchesSeverity;
    });
  }, [search, severityFilter]);

  const summary = useMemo(() => {
    const highRisk = MOCK_TURNOVER_ALERTS.filter(
      (row) => row.severity === "High"
    ).length;

    const mediumRisk = MOCK_TURNOVER_ALERTS.filter(
      (row) => row.severity === "Medium"
    ).length;

    const watchCount = MOCK_TURNOVER_ALERTS.filter(
      (row) => row.signal === "Watch"
    ).length;

    return {
      total: MOCK_TURNOVER_ALERTS.length,
      highRisk,
      mediumRisk,
      watchCount,
    };
  }, []);

  return (
    <div className="turnover-terminal-page">
      <section className="turnover-terminal-panel">
        <div className="turnover-terminal-top">
          <div>
            <div className="smart-money-kicker">Leadership Change Intelligence</div>
            <h1>Executive Turnover Alerts</h1>
            <p>
              Surface CEO, CFO, board, and senior leadership changes that may
              affect investor confidence, execution risk, or strategic direction.
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

        <div className="turnover-command-row">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search ticker, company, role, or event..."
            className="turnover-search-input"
          />

          <div className="turnover-filter-toggle">
            <button
              type="button"
              className={severityFilter === "all" ? "active" : ""}
              onClick={() => setSeverityFilter("all")}
            >
              All
            </button>

            <button
              type="button"
              className={severityFilter === "high" ? "active high" : ""}
              onClick={() => setSeverityFilter("high")}
            >
              High
            </button>

            <button
              type="button"
              className={severityFilter === "medium" ? "active medium" : ""}
              onClick={() => setSeverityFilter("medium")}
            >
              Medium
            </button>
          </div>

          <div className="turnover-status-pill">Coming Soon: Live Alerts</div>
        </div>

        <div className="turnover-stat-grid">
          <div className="turnover-stat-card">
            <span>Total Alerts</span>
            <strong>{summary.total}</strong>
            <p>Mock leadership-change events being tracked.</p>
          </div>

          <div className="turnover-stat-card bearish">
            <span>High Severity</span>
            <strong>{summary.highRisk}</strong>
            <p>Leadership events with higher potential market impact.</p>
          </div>

          <div className="turnover-stat-card neutral">
            <span>Medium Severity</span>
            <strong>{summary.mediumRisk}</strong>
            <p>Events worth monitoring but not necessarily negative.</p>
          </div>

          <div className="turnover-stat-card neutral">
            <span>Watchlist Signals</span>
            <strong>{summary.watchCount}</strong>
            <p>Names where leadership change deserves follow-up.</p>
          </div>
        </div>

        <div className="turnover-framework-grid">
          <div className="turnover-framework-card">
            <span>Alert Type</span>
            <strong>CEO / CFO Changes</strong>
            <p>
              Flags executive changes that can reset investor expectations,
              guidance credibility, and capital allocation strategy.
            </p>
          </div>

          <div className="turnover-framework-card">
            <span>Alert Type</span>
            <strong>Board Changes</strong>
            <p>
              Tracks board refreshes, activist pressure, governance changes,
              and strategic oversight shifts.
            </p>
          </div>

          <div className="turnover-framework-card">
            <span>Alert Type</span>
            <strong>Execution Risk</strong>
            <p>
              Highlights leadership changes at companies already facing weak
              margins, declining growth, or operational pressure.
            </p>
          </div>
        </div>

        <div className="turnover-table-card">
          <div className="turnover-table-top">
            <div>
              <div className="smart-money-kicker">Leadership Alert Feed</div>
              <h2>Executive Turnover Watchlist</h2>
              <p>
                Mock layout for now. Later this can connect to SEC 8-K filings,
                press releases, company news, and insider activity.
              </p>
            </div>

            <span>Mock Data</span>
          </div>

          <div className="smart-money-table-wrap">
            <table className="smart-money-table turnover-clean-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Ticker</th>
                  <th>Company</th>
                  <th>Executive</th>
                  <th>Role</th>
                  <th>Event</th>
                  <th>Severity</th>
                  <th>Signal</th>
                  <th>Why It Matters</th>
                </tr>
              </thead>

              <tbody>
                {filteredRows.length ? (
                  filteredRows.map((row, index) => (
                    <tr key={`${row.ticker}-${row.event}-${index}`}>
                      <td>{row.date}</td>
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
                      <td>{row.executive}</td>
                      <td>{row.role}</td>
                      <td>{row.event}</td>
                      <td>
                        <span
                          className={`smart-money-signal-pill ${getSignalClass(
                            row.severity
                          )}`}
                        >
                          {row.severity}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`smart-money-signal-pill ${getSignalClass(
                            row.signal
                          )}`}
                        >
                          {row.signal}
                        </span>
                      </td>
                      <td>{row.reason}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="9">No matching executive turnover alerts found.</td>
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