import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import StockTable from "../StockTable";
import DependencyMap from "../DependencyMap";
import "./Dashboard.css";
import SupplyChain from "../SupplyChain";
import HiddenPairs from "../HiddenPairs";
import MarketOutlook from "../MarketOutlook";
import Feedback from "../Feedback";

export default function Dashboard() {
  const [activeMenu, setActiveMenu] = useState("Stocks");
  const [selectedSector, setSelectedSector] = useState(null);
  const [sidebarWidth, setSidebarWidth] = useState(220);
  const [collapsed, setCollapsed] = useState(false);
  const sidebarRef = useRef(null);
  const isResizing = useRef(false);
  const [sectorOpen, setSectorOpen] = useState(false);
  const [sectorPerformance, setSectorPerformance] = useState({});
  const navigate = useNavigate();

  const API_BASE =
  process.env.NODE_ENV === "development"
    ? "http://localhost:8000"
    : process.env.REACT_APP_API_BASE;

  const sectorList = [
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
  ];

  useEffect(() => {
    const fetchSectorPerformance = async () => {
      try {
        const res = await fetch(`${API_BASE}/sector-performance`);
        const data = await res.json();

        if (data && typeof data === "object") {
          setSectorPerformance(data);
        } else {
          setSectorPerformance({});
        }
      } catch (err) {
        console.error("Failed to load sector performance", err);
        setSectorPerformance({});
      }
    };

    fetchSectorPerformance();
  }, [API_BASE]);

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
                  navigate("/dashboard");
                  setActiveMenu("Stocks");
                  setSelectedSector(null);
                  setSectorOpen(false);
                }}
                style={{
                  backgroundColor: activeMenu === "Stocks" ? "#19C37D" : "transparent",
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
                    color: activeMenu === "Stocks" ? "#001f3f" : "#fff",
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
                      fontSize: "30px",
                    }}
                  >
                    {sectorOpen ? "▾" : "▸"}
                  </span>
                )}
              </div>
            </div>

            {sectorOpen && !collapsed && (
              <div className="sector-list">
                {sectorList.map((sector) => {
                  const change = sectorPerformance[sector];
                  const hasValue = typeof change === "number" && !Number.isNaN(change);

                  return (
                    <div
                      key={sector}
                      className="sector-item"
                      onClick={() => {
                        navigate("/dashboard");
                        setActiveMenu("Stocks");
                        setSelectedSector(sector);
                      }}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: "10px",
                      }}
                    >
                      <span>{sector}</span>

                      <span
                        style={{
                          color: !hasValue
                            ? "#9ca3af"
                            : change > 0
                            ? "#16a34a"
                            : change < 0
                            ? "#dc2626"
                            : "#ffffff",
                          fontWeight: 600,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {hasValue ? `${change > 0 ? "+" : ""}${change.toFixed(2)}%` : "--"}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            <div
              className={`sidebar-item ${activeMenu === "MarketOutlook" ? "active" : ""}`}
              onClick={() => {
                navigate("/dashboard");
                setActiveMenu("MarketOutlook");
                setSectorOpen(false);
              }}
            >
              Market Outlook
            </div>

            <div
              className={`sidebar-item ${activeMenu === "DependencyMap" ? "active" : ""}`}
              onClick={() => {
                setActiveMenu("DependencyMap");
                setSectorOpen(false);
              }}
            >
              Dependency Map
            </div>

            <div
              className={`sidebar-item ${activeMenu === "SupplyChain" ? "active" : ""}`}
              onClick={() => {
                setActiveMenu("SupplyChain");
                setSectorOpen(false);
              }}
            >
              Supply Chain
            </div>

            <div
              className={`sidebar-item ${activeMenu === "HiddenPairs" ? "active" : ""}`}
              onClick={() => {
                setActiveMenu("HiddenPairs");
                setSectorOpen(false);
              }}
            >
              Hidden Pairs
            </div>

            <div
              className={`sidebar-item ${activeMenu === "Watchlist" ? "active" : ""}`}
              onClick={() => {
                navigate("/dashboard");
                setActiveMenu("Watchlist");
                setSectorOpen(false);
              }}
            >
              Watchlist
            </div>

            <div
              className={`sidebar-item ${activeMenu === "Feedback" ? "active" : ""}`}
              onClick={() => {
                navigate("/dashboard");
                setActiveMenu("Feedback");
                setSectorOpen(false);
              }}
            >
              Feedback
            </div>
          </nav>

          {!collapsed && <div className="resizer" onMouseDown={startResizing} />}
        </aside>

        <main
          className="main-content"
          style={{ backgroundColor: "#0E1424", padding: "40px" }}
        >
          {activeMenu === "DependencyMap" ? (
            <DependencyMap />
          ) : activeMenu === "SupplyChain" ? (
            <SupplyChain />
          ) : activeMenu === "HiddenPairs" ? (
            <HiddenPairs />
          ) : activeMenu === "MarketOutlook" ? (
            <MarketOutlook />
          ) : activeMenu === "Feedback" ? (
            <Feedback />
          ) : (
            <StockTable
              view={activeMenu}
              selectedSector={selectedSector}
            />
          )}
        </main>
      </div>
    </>
  );
}