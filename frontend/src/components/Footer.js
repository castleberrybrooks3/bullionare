import React from "react";
import { Link } from "react-router-dom";
import "./Footer.css";

export default function Footer() {
  return (
    <footer className="app-footer">
      <div className="footer-content">
        <div className="footer-left">
          © {new Date().getFullYear()} Bullionaire
        </div>

        <div className="footer-center">
          Bullionaire provides market analytics for informational purposes only.
          Nothing on this platform constitutes investment advice.
          Bullionaire is not a registered investment advisor, broker-dealer, or financial planner. If you would like to get in touch with our team, you can reach us at info@bullionaireiq.com.
        </div>

        <div className="footer-right">
          <Link to="/terms">Terms</Link>
          <Link to="/privacy">Privacy</Link>
        </div>
      </div>
    </footer>
  );
}