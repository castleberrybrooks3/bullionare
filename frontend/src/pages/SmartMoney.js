import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import "./SmartMoney.css";

const smartMoneyBubbles = [
  {
    title: "Recent Insider Transactions",
    status: "Live",
    description:
      "Search tickers and track recent SEC Form 4 insider buys, sells, grants, and ownership changes.",
    path: "/smart-money/insider-transactions",
    tone: "live",
  },
  {
  title: "Board & Leadership Intelligence",
  status: "Coming Soon",
  description:
    "Search a company to view executives, board members, prior company experience, governance risk, and leadership track records.",
  path: "/smart-money/founder-led",
  tone: "founder",
},
  {
    title: "Institutional Accumulation",
    status: "Coming Soon",
    description:
      "Track 13F ownership trends, major fund additions, reductions, and ownership concentration.",
    path: "/smart-money/institutional-accumulation",
    tone: "institutional",
  },
  {
    title: "Political Trade Watchlist",
    status: "Coming Soon",
    description:
      "Monitor politician disclosures and highlight trades connected to macro themes or industries.",
    path: "/smart-money/political-trades",
    tone: "political",
  },
  {
    title: "Executive Turnover Alerts",
    status: "Coming Soon",
    description:
      "Surface CEO, CFO, board, and senior leadership changes that may affect investor confidence.",
    path: "/smart-money/executive-turnover",
    tone: "turnover",
  },
];

export default function SmartMoney() {
  const navigate = useNavigate();
  const location = useLocation();

  const showDashboardBack = location.pathname === "/smart-money";

  return (
    <div className="smart-money-page smart-money-hub-page">
      <section className="smart-money-bubble-stage full-bubble-stage">
  {showDashboardBack && (
    <button
      type="button"
      className="smart-money-dashboard-back-btn"
      onClick={() => navigate("/dashboard")}
    >
      ← Dashboard
    </button>
  )}

  <div className="smart-money-bubble-orbit">
          {smartMoneyBubbles.map((bubble, index) => (
            <button
              key={bubble.path}
              type="button"
              className={`smart-money-bubble smart-money-bubble-${
                index + 1
              } ${bubble.tone}`}
              onClick={() => navigate(bubble.path)}
            >
              <span className="smart-money-bubble-status">{bubble.status}</span>

              <strong>{bubble.title}</strong>

              <p>{bubble.description}</p>

              <small>Open module →</small>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}