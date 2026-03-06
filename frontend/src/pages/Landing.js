import { useNavigate } from "react-router-dom";
import "./Landing.css";
import logo from "../assets/logo.png";
import backgroundVideo from "../assets/video/candles.mp4";

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="hero">

      {/* Background Video */}
      <video
        className="background-video"
        autoPlay
        loop
        muted
        playsInline
      >
        <source src={backgroundVideo} type="video/mp4" />
      </video>

      {/* Dark Overlay */}
      <div className="overlay"></div>

      {/* Main Content */}
      <div className="hero-content">

        <img src={logo} alt="Bullionare Logo" className="hero-logo" />
          <h1 className="home-title">BULLIONARE</h1>

        <h2 className="hero-subtitle">
          SEE WHAT OTHERS MISS <span></span>
        </h2>

        <div className="hero-line"></div>

        <button
          className="launch-btn"
          onClick={() => navigate("/dashboard")}
        >
          GO
        </button>

      </div>
    </div>
  );
}