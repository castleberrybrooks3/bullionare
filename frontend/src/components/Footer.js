import React from "react";
import { Link } from "react-router-dom";
import "./Footer.css";

export default function Footer() {
  return (
    <footer className="app-footer">
      <div className="footer-content">
        <div className="footer-left">
          © {new Date().getFullYear()} Bullionare
        </div>

        <div className="footer-center">
          Bullionare provides market analytics for informational purposes only.
          Nothing on this platform constitutes investment advice.
          Bullionare is not a registered investment advisor, broker-dealer, or financial planner.
        </div>

        <div className="footer-right">
          <Link to="/terms">Terms</Link>
          <Link to="/privacy">Privacy</Link>
        </div>
      </div>
    </footer>
  );
}