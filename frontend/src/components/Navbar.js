import "./Navbar.css";
import logo from "../assets/logo.png";

export default function Navbar() {
  return (
    <nav className="navbar">
      <img src={logo} alt="Bullionare Logo" className="navbar-logo" />

      <div className="nav-links">
        <a href="/">Home</a>
        <a href="/dashboard">Dashboard</a>
      </div>
    </nav>
  );
}