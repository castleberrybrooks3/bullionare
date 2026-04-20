import "./Navbar.css";
import logo from "../assets/logo.png";
import { supabase } from "../lib/supabaseClient";
import { useNavigate } from "react-router-dom";

export default function Navbar() {
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  return (
    <nav className="navbar">
      <img src={logo} alt="Bullionare Logo" className="navbar-logo" />

      <div className="nav-links">
  <a href="/">Home</a>
  <a href="/dashboard">Dashboard</a>
  <a href="/about">About</a>

  <button className="signout-btn" onClick={handleSignOut}>
    Sign Out
  </button>
</div>
    </nav>
  );
}