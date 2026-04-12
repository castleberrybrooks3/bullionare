import "./About.css";
import { useNavigate } from "react-router-dom";

export default function About() {
const navigate = useNavigate();
  return (
    <div className="about-page">
      <div className="about-container">
      <button
  className="back-button"
  onClick={() => navigate(-1)}
>
  ← Back
</button>
        <h1>About Bullionaire</h1>
        <p>
          Bullionaire is a financial intelligence platform built for modern investors designed to help identify high-conviction opportunities using advanced data analysis and real-time market insights. We specialize in simplicity and navigating markets efficiently.
        </p>

        <h2>What Bullionaire Does</h2>

        <p>
        Bullionaire analyzes thousands of stocks across the market to surface opportunities that traditional screening tools often miss. By combining large-scale market data with intelligent filtering, the platform helps investors quickly identify:
        </p>
        <ul>
          <li>Mispriced securities</li>
          <li>Unusual downside risk</li>
          <li>High-probability investment opportunities</li>
          <li>Market inefficiencies across sectors</li>
        </ul>
        <p>
        Instead of manually sorting through thousands of securities, Bullionaire allows investors to focus only on the opportunities that matter most.
        </p>
        <h2>Our Mission</h2>
        <p>
        Modern markets produce an overwhelming amount of data, yet most investors still rely on outdated tools to interpret it.
        </p>
        <p>
        Bullionaire was built to close that gap — bringing institutional-grade analytics to investors through a simple, intuitive platform.
        </p>
        <p>
        Our goal is to make powerful market intelligence accessible without the complexity or cost of traditional financial terminals.
        </p>
        <h2>Founder</h2>
        <p>
        Bullionaire was created by Brooks Castleberry, a finance student at the University of Arkansas focused on building next-generation financial intelligence tools.
        </p>
        <p>
        The platform began as an internal project designed to track large-scale stock data and surface market opportunities more efficiently. As the system evolved, it grew into Bullionaire — a platform built to help investors navigate markets with greater clarity, confidence, and efficiency.
        </p>
        <h2>Vision</h2>
        <p>
        Bullionaire is continuously expanding its data coverage and analytical capabilities. Future development will focus on deeper market analytics, improved visualization tools, and advanced insight generation designed to help investors make more informed decisions.
        </p>
      </div>
    </div>
  );
}