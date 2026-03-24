import React, { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import StockTable from "../StockTable";
import DependencyMap from "../DependencyMap";
import "./Dashboard.css";
import SupplyChain from "../SupplyChain";
import HiddenPairs from "../HiddenPairs";

export default function Dashboard() {
  const [activeMenu, setActiveMenu] = useState("Stocks");
  const [selectedSector, setSelectedSector] = useState(null);
  const [sidebarWidth, setSidebarWidth] = useState(220);
  const [collapsed, setCollapsed] = useState(false);
  const sidebarRef = useRef(null);
  const isResizing = useRef(false);
  const [sectorOpen, setSectorOpen] = useState(false);
  const navigate = useNavigate();

  const startResizing = (e) => {
    isResizing.current = true;
    document.addEventListener("mousemove", resizeSidebar);
    document.addEventListener("mouseup", stopResizing);
  };

  const resizeSidebar = (e) => {
    if (!isResizing.current) return;
    let newWidth = e.clientX;
    if (newWidth < 60) newWidth = 60;
    if (newWidth > 400) newWidth = 400;
    setSidebarWidth(newWidth);
  };

  const stopResizing = () => {
    isResizing.current = false;
    document.removeEventListener("mousemove", resizeSidebar);
    document.removeEventListener("mouseup", stopResizing);
  };

  return (
    <>
      <Navbar />
      <div className="dashboard">
        {/* Sidebar */}
        <aside
          className={`sidebar ${collapsed ? "collapsed" : ""}`}
          style={{ width: collapsed ? 60 : sidebarWidth }}
          ref={sidebarRef}
        >
          <div className="sidebar-top">
            <h2 className="sidebar-title">{collapsed ? "M" : "Market Lens"}</h2>
            <button
              className="collapse-btn"
              onClick={() => setCollapsed(!collapsed)}
            >
              {collapsed ? "➡" : "⬅"}
            </button>
          </div>

          <nav className="sidebar-nav">

  <div className="sidebar-main-container">
  <div
    className={`sidebar-main ${activeMenu === "Stocks" ? "active" : ""}`}
    onClick={() => {
    navigate("/dashboard"); // clears ?tickers
    setActiveMenu("Stocks");
    setSelectedSector(null);
    setSectorOpen(false);
    }}
    style={{
      backgroundColor: activeMenu === "Stocks" ? "#19C37D" : "transparent", // green bubble
      cursor: "pointer",
      padding: "8px 12px",
      borderRadius: "4px",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      width: "100%",
      boxSizing: "border-box",
    }}
  >
    <span
      style={{
        color: activeMenu === "Stocks" ? "#001f3f" : "#fff", // navy when active, light by default
        fontWeight: "bold",
      }}
    >
      Stocks
    </span>

    {!collapsed && (
      <span
  className="dropdown-arrow"
  onClick={(e) => {
    e.stopPropagation();
    setSectorOpen(!sectorOpen);
  }}
  style={{
    cursor: "pointer",
    fontSize: "30px"   // increase size
  }}
>
  {sectorOpen ? "▾" : "▸"}
</span>
    )}
  </div>
</div>

  {/* SECTOR DROPDOWN */}
  {sectorOpen && !collapsed && (
    <div className="sector-list">
      {[
        "Basic Materials",
        "Communication Services",
        "Consumer Cyclical",
        "Consumer Defensive",
        "Energy",
        "Financial Services",
        "Healthcare",
        "Industrials",
        "Real Estate",
        "Technology",
        "Utilities",
      ].map((sector) => (
        <div
          key={sector}
          className="sector-item"
          onClick={() => {
          navigate("/dashboard"); // clears ticker filter
          setActiveMenu("Stocks");
          setSelectedSector(sector);
        }}
        >
          {sector}
        </div>
      ))}
    </div>
  )}

  {/* WATCHLIST */}
  <div
    className={`sidebar-item ${activeMenu === "Watchlist" ? "active" : ""}`}
    onClick={() => {
    navigate("/dashboard");
    setActiveMenu("Watchlist");
    }}
  >
    Watchlist
  </div>

    {/* DEPENDENCY MAP */}
    <div
        className={`sidebar-item ${activeMenu === "DependencyMap" ? "active" : ""}`}
        onClick={() => setActiveMenu("DependencyMap")}
    >
        Dependency Map
    </div>
    <div
  className={`sidebar-item ${activeMenu === "SupplyChain" ? "active" : ""}`}
  onClick={() => setActiveMenu("SupplyChain")}
>
  Supply Chain
</div>
<div
  className={`sidebar-item ${activeMenu === "HiddenPairs" ? "active" : ""}`}
  onClick={() => setActiveMenu("HiddenPairs")}
>
  Hidden Pairs
</div>
</nav>

          {!collapsed && <div className="resizer" onMouseDown={startResizing} />}
        </aside>

        {/* Main Content */}
        <main
          className="main-content"
          style={{ backgroundColor: "#0E1424", padding: "40px" }}
        >
          {/* ✅ ONLY CHANGE IS HERE */}
          {activeMenu === "DependencyMap" ? (
  <DependencyMap />
) : activeMenu === "SupplyChain" ? (
  <SupplyChain />
  ) : activeMenu === "HiddenPairs" ? (
  <HiddenPairs />
) : (
  <StockTable view={activeMenu} selectedSector={selectedSector} />
)}
        </main>
      </div>
    </>
  );
}