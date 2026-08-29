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
          Bullionaire is a financial intelligence platform designed to help modern
          investors understand markets faster, uncover opportunities, and make
          more informed decisions. The platform brings together large-scale market
          data, financial analysis, and real-time intelligence in a simple,
          intuitive experience.
        </p>

        <h2>What Bullionaire Does</h2>

        <p>
          Bullionaire analyzes thousands of securities and market data points to
          surface information that can be difficult or time-consuming to identify
          with traditional investing tools. By combining financial data,
          quantitative analysis, market intelligence, and advanced screening,
          Bullionaire helps investors identify:
        </p>

        <ul>
          <li>Potentially mispriced securities</li>
          <li>Unusual risks and market movements</li>
          <li>Attractive investment opportunities</li>
          <li>Market inefficiencies across companies, sectors, and asset classes</li>
        </ul>

        <p>
          Instead of forcing investors to sort through thousands of securities,
          filings, data points, and disconnected research tools, Bullionaire
          organizes the most important information into one platform so users can
          focus on the opportunities that matter most.
        </p>

        <h2>Our Mission</h2>

        <p>
          Modern financial markets generate an enormous amount of information,
          yet accessing and interpreting that information is often expensive,
          fragmented, or unnecessarily complicated.
        </p>

        <p>
          Bullionaire was built to close that gap by making powerful financial
          intelligence more accessible, understandable, and efficient.
        </p>

        <p>
          Our mission is to give investors access to sophisticated market
          analytics without the complexity or cost traditionally associated with
          institutional financial platforms.
        </p>

        <h2>Founder</h2>

        <p>
          Bullionaire was created by a finance student with a focus on investing,
          financial markets, data analysis, and building next-generation
          financial technology.
        </p>

        <p>
          The platform began as an internal project designed to analyze large
          amounts of stock market data and identify investment opportunities more
          efficiently. Over time, the project expanded into Bullionaire: a
          broader financial intelligence platform built to help investors
          research companies, analyze markets, and discover opportunities with
          greater clarity and efficiency.
        </p>

        <h2>Vision</h2>

        <p>
          Bullionaire is continuously expanding its market coverage, data
          infrastructure, and analytical capabilities. The long-term vision is
          to build a comprehensive financial intelligence platform that brings
          together company research, market analytics, advanced screening,
          prediction markets, financial filings, and other forms of investment
          intelligence in one place.
        </p>

        <p>
          As the platform evolves, Bullionaire will continue developing tools
          designed to make sophisticated financial analysis faster, simpler, and
          more accessible to investors.
        </p>
      </div>
    </div>
  );
}