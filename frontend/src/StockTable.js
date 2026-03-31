import React, { useState, useEffect, useMemo, useRef } from "react";
import { AgGridReact } from "ag-grid-react";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";
import { ModuleRegistry, AllCommunityModule } from "ag-grid-community";
import "./StockTable.css";
import { useLocation, useNavigate } from "react-router-dom";
import WatchlistAnalytics from "./components/WatchlistAnalytics";

/* ✅ Correct for your AG Grid version */
ModuleRegistry.registerModules([AllCommunityModule]);

const StockTable = ({ view, selectedSector, showControls = true, showTable = true }) => {
  const [stocks, setStocks] = useState([]);
  const [processedStocks, setProcessedStocks] = useState([]);

  // Debounced search states
  const [typedQuery, setTypedQuery] = useState(""); // updates immediately as user types
  const [searchQuery, setSearchQuery] = useState(""); // updates after debounce

  const [displayedCount, setDisplayedCount] = useState(0);
  const [starModalOpen, setStarModalOpen] = useState(false);
  const [modalTicker, setModalTicker] = useState(null);
  const [modalSelectedLists, setModalSelectedLists] = useState([]);
  const [notification, setNotification] = useState(null);
  const [loading, setLoading] = useState(true);

  const [watchlists, setWatchlists] = useState(() => {
  const saved = localStorage.getItem("watchlists");
  try {
    const parsed = saved ? JSON.parse(saved) : null;
    return parsed && Object.keys(parsed).length ? parsed : { Default: [] };
  } catch {
    return { Default: [] }; // fallback if localStorage is corrupted
  }
});

const [activeList, setActiveList] = useState(() =>
  localStorage.getItem("activeList") || "Default"
);

useEffect(() => {
  localStorage.setItem("activeList", activeList);
}, [activeList]);

  const gridRef = useRef(null);

  const location = useLocation();
  const navigate = useNavigate();
    const params = new URLSearchParams(location.search);

    const tickerFilter = params.get("ticker");
    const tickersParam = params.get("tickers");
    const industry = params.get("industry");   // NEW
    const selectedTickers = tickersParam ? tickersParam.split(",") : null;

  const rangeOnlyColumns = [
    "Current Price",
    "Market Cap",
    "EPS",
    "P/E",
    "Beta",
    "Dividend",
    "Upside",
    "Downside",
  ];

  const fetchStocks = async () => {
  setLoading(true); // start loading
  try {
    const API_BASE =
      process.env.NODE_ENV === "development"
        ? "http://localhost:8000" // local dev
        : "https://bullionare.onrender.com"; // your Render backend
    const res = await fetch(`${API_BASE}/stocks`);
    const data = await res.json();
const cleanData = Array.isArray(data) ? data : [];
setStocks(cleanData);

localStorage.setItem("stocks", JSON.stringify(cleanData));
  } catch (err) {
    console.error(err);
    setStocks([]);
  } finally {
    setLoading(false); // stop loading
  }
};

useEffect(() => {
  if (!showTable) return; // 🔥 ONLY fetch once (bottom table)

  fetchStocks();
}, [showTable]);

  useEffect(() => {
  const handler = setTimeout(() => {
    setSearchQuery(typedQuery); // update actual filter only after 300ms pause
  }, 1000); //

  return () => clearTimeout(handler); // cleanup on new keystroke
}, [typedQuery]);

/* TOP SCROLLBAR SYNC */
useEffect(() => {
  const setupScrollSync = () => {
    const topScroll = document.querySelector(".top-scrollbar");
    const topContent = document.querySelector(".top-scroll-content");
    const gridViewport = document.querySelector(".ag-body-horizontal-scroll-viewport");
    const gridCenter = document.querySelector(".ag-center-cols-container");

    if (!topScroll || !topContent || !gridViewport || !gridCenter) return;

    // Set the fake scrollbar width to match grid content
    topContent.style.width = gridCenter.scrollWidth + "px";

    const syncTop = () => {
      const maxTop = topScroll.scrollWidth - topScroll.clientWidth;
      const maxGrid = gridViewport.scrollWidth - gridViewport.clientWidth;

      const ratio = topScroll.scrollLeft / maxTop;

      gridViewport.scrollLeft = ratio * maxGrid;
    };

    const syncBottom = () => {
      const maxTop = topScroll.scrollWidth - topScroll.clientWidth;
      const maxGrid = gridViewport.scrollWidth - gridViewport.clientWidth;

      const ratio = gridViewport.scrollLeft / maxGrid;

      topScroll.scrollLeft = ratio * maxTop;
    };

    topScroll.addEventListener("scroll", syncTop);
    gridViewport.addEventListener("scroll", syncBottom);
  };

  const timer = setTimeout(setupScrollSync, 200);

  return () => clearTimeout(timer);
}, [processedStocks]);

  useEffect(() => {
    const data = stocks
      .map((s) => ({ ...s, Ticker: s.Ticker?.toString() ?? "" }))
      .filter((s) => {
        const price = Number(s["Current Price"]);
        return !isNaN(price) && price > 0;
      });

    setProcessedStocks(data);
  }, [stocks]);

  const openStarModal = (ticker) => {
  setModalTicker(ticker);

  // Pre-select lists where this ticker is already saved
  const selected = Object.keys(watchlists).filter((listName) =>
    watchlists[listName]?.includes(ticker)
  );
  setModalSelectedLists(selected);

  setStarModalOpen(true);
};

  const cleanNumber = (val) => {
  if (val == null) return null;

  const cleaned = val
    .toString()
    .replace(/[%,$]/g, "")
    .replace(/,/g, "")
    .replace(/N\/A/gi, "")   // FIXED
    .trim();

  const num = Number(cleaned);
  return isNaN(num) ? null : num;
};

  const parseMarketCap = (val) => {
  if (!val) return null;

  if (typeof val === "number") return val;

  const str = val.toString().toUpperCase().trim();

  if (str.endsWith("T")) return parseFloat(str) * 1e12;
  if (str.endsWith("B")) return parseFloat(str) * 1e9;
  if (str.endsWith("M")) return parseFloat(str) * 1e6;

  return parseFloat(str);
};

  const columns = useMemo(() => {
  if (!processedStocks.length) return [];

  const cols = [
    {
  headerName: "★",
  colId: "star",
  field: "star",
  width: 60,
  pinned: "left",
  sortable: false,
  filter: false,
  cellStyle: { textAlign: "center", fontSize: "18px" },
  cellClass: "column-border",
  headerClass: "column-border",

  cellRenderer: (params) => {
    const ticker = params.data?.Ticker;
    if (!ticker) return "☆";

    const inAnyWatchlist = Object.values(watchlists).some(list =>
      list.includes(ticker)
    );

    return (
      <span
        style={{ cursor: "pointer" }}
        onClick={() => {
          const isInActiveList = watchlists[activeList]?.includes(ticker);

          if (view === "Watchlist" && isInActiveList) {
            // REMOVE instantly in Watchlist view
            const updated = { ...watchlists };
            updated[activeList] = updated[activeList].filter(t => t !== ticker);
            setWatchlists(updated);
            localStorage.setItem("watchlists", JSON.stringify(updated));

            setNotification(`${ticker} removed from watchlist`);
            setTimeout(() => setNotification(null), 1500);

            return; // STOP modal from opening
          }

          // OPEN modal for Stocks view or Watchlist tickers not in active list
          setModalTicker(ticker);
          const selected = Object.keys(watchlists).filter(listName =>
            watchlists[listName]?.includes(ticker)
          );
          setModalSelectedLists(selected);
          setStarModalOpen(true);
        }}
      >
        {inAnyWatchlist ? "★" : "☆"}
      </span>
    );
  },

  cellClass: "column-border",
  headerClass: "column-border",
},
    {
      field: "Ticker",
      headerName: "Ticker",
      width: 110,
      pinned: "left",
      sortable: true,
      filter: "agTextColumnFilter",
      filterParams: {
        buttons: ["reset"],
        debounceMs: 200,
        suppressAndOrCondition: true,
      },
      cellClass: "column-border",
      headerClass: "column-border",
    },
  ];

  const sampleRow = processedStocks[0];

  Object.keys(sampleRow).forEach((col) => {
  if (col === "Ticker" || col === "star") return;

  const columnDef = {
  headerName: col,
  field: col,

  valueGetter: (params) => {
    if (col === "Market Cap") {
      return parseMarketCap(params.data["Market Cap"]);
    }
    return params.data[col];
  },

  sortable: true,
  flex: 1,
  minWidth: 130,
  headerClass: "column-border",
  cellClass: "column-border",

  valueFormatter: (params) => {
    const val = params.value;

    if (col === "Market Cap" && val != null) {
      if (val >= 1_000_000_000_000) return (val / 1_000_000_000_000).toFixed(2) + "T";
      if (val >= 1_000_000_000) return (val / 1_000_000_000).toFixed(2) + "B";
      if (val >= 1_000_000) return (val / 1_000_000).toFixed(2) + "M";
      return val;
    }

    if (["Upside %", "Downside %"].includes(col)) {
      return val != null ? `${val.toFixed(2)}%` : "";
    }

    if (["P/E (TTM)", "Mean Target", "Risk-Reward Score"].includes(col)) {
      return val != null ? val.toFixed(2) : "";
    }

    if (col === "Dividend") {
      return val != null ? `${val.toFixed(2)}%` : "";
    }

    return val ?? "";
  }
};

  if (col === "Market Cap") {

  columnDef.filter = "agNumberColumnFilter";

  columnDef.filterParams = {
  filterOptions: ["greaterThan", "lessThan", "inRange"],
  buttons: ["apply", "reset"],
  suppressAndOrCondition: true,

  allowedCharPattern: "\\d\\.MBTmbt",

  numberParser: function(text) {
    if (!text) return null;

    const str = text.toString().replace(/,/g,"").toUpperCase().trim();

    if (str.endsWith("T")) return parseFloat(str) * 1e12;
    if (str.endsWith("B")) return parseFloat(str) * 1e9;
    if (str.endsWith("M")) return parseFloat(str) * 1e6;

    return parseFloat(str);
  }
};

  columnDef.cellClass = "numeric";

} else if (processedStocks.some(row => !isNaN(cleanNumber(row[col])))) {

  columnDef.filter = "agNumberColumnFilter";

  columnDef.filterParams = {
    filterOptions: ["greaterThan", "lessThan", "inRange"],
    suppressAndOrCondition: true,
    buttons: ["apply", "reset"]
  };

  columnDef.cellClass = "numeric";

} else {

  columnDef.filter = "agTextColumnFilter";

  columnDef.filterParams = {
    buttons: ["apply", "reset"],
    suppressAndOrCondition: true
  };

}

  cols.push(columnDef);
});
  return cols;
}, [processedStocks, watchlists, activeList, view]);

  const rowData = useMemo(() => {
  if (!processedStocks.length) return [];
  let base =
    view === "Watchlist"
      ? processedStocks.filter((s) =>
          (watchlists[activeList] ?? []).includes(s.Ticker)
        )
      : processedStocks;

  if (view === "Stocks" && selectedSector) {
    base = base.filter(
      (stock) => stock.Sector?.toLowerCase() === selectedSector.toLowerCase()
    );
  }

  if (selectedTickers) {
  base = base.filter(stock =>
    selectedTickers.includes(stock.Ticker)
  );
} else if (tickerFilter) {
  base = base.filter(
    stock => stock.Ticker?.toUpperCase() === tickerFilter.toUpperCase()
  );
}

return base;
}, [processedStocks, watchlists, view, activeList, selectedSector, tickerFilter, selectedTickers]);

useEffect(() => {
  if (gridRef.current?.api) {
    setDisplayedCount(gridRef.current.api.getDisplayedRowCount());
  }
}, [rowData]);

  const defaultColDef = useMemo(
    () => ({
      resizable: true,
      sortable: true,
      minWidth: 100,
    }),
  );
const clearAllFilters = () => {
  if (!gridRef.current?.api) return;

  gridRef.current.api.setFilterModel(null);
  gridRef.current.api.onFilterChanged();

  setTypedQuery("");
  setSearchQuery("");
};

const exportToCsv = () => {
  if (!gridRef.current?.api) return;

  const now = new Date();

  const readableTimestamp = now.toLocaleString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  const safeTimestamp = now
    .toLocaleString("en-US", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
    .replace(/[/:, ]/g, "-");

  const fileName =
    view === "Watchlist"
      ? `my_watchlist_${safeTimestamp}.csv`
      : `market_analytics_${safeTimestamp}.csv`;

  gridRef.current.api.exportDataAsCsv({
    fileName: fileName,
    prependContent: [
      [{ data: { value: "Bullionaire Analytics Export" } }],
      [{ data: { value: `Generated: ${readableTimestamp}` } }],
      [],
    ],
  });
};
  return (
  <div className="stock-table-container">
  {showControls && (
  <>

    {notification && (
      <div className="notification-toast">
        {notification}
      </div>
    )}

    {view !== "Watchlist" && (
      <div className="dashboard-header">
        <h1 className="dashboard-title">BECOME A BULLIONAIRE</h1>
        <p className="dashboard-subtitle"></p>
      </div>
    )}

    {selectedTickers ? (
  <div style={{ marginBottom: "10px" }}>
    <h2>{industry ? `${industry} Comparison` : "Industry Comparison"}</h2>

    <button
      onClick={() => navigate("/dashboard")}
      style={{
        marginTop: "6px",
        padding: "6px 12px",
        backgroundColor: "#19C37D",
        border: "none",
        borderRadius: "4px",
        cursor: "pointer",
        fontWeight: "bold"
      }}
    >
      Return to Full Market
    </button>
  </div>
) : (
  <h2>{view === "Watchlist" ? "Your Watchlist" : "Market Analytics"}</h2>
)}

{view === "Watchlist" && (
  <div className="watchlist-top-row">
    <div className="watchlist-controls-left">
      <div className="watchlist-controls-row">
        <select
          value={activeList}
          onChange={(e) => setActiveList(e.target.value)}
          style={{ padding: "4px 8px" }}
        >
          {Object.keys(watchlists).map((listName) => (
            <option key={listName} value={listName}>
              {listName}
            </option>
          ))}
        </select>

        <button
          style={{ padding: "4px 8px", backgroundColor: "#19C37D", color: "#fff", border: "none", cursor: "pointer" }}
          onClick={() => {
            const name = prompt("Enter new watchlist name:");
            if (!name || watchlists[name]) return;
            const updated = { ...watchlists, [name]: [] };
            setWatchlists(updated);
            localStorage.setItem("watchlists", JSON.stringify(updated));
            setActiveList(name);
          }}
        >
          New
        </button>

        <button
          style={{ padding: "4px 8px", backgroundColor: "#3b82f6", color: "#fff", border: "none", cursor: "pointer" }}
          onClick={() => {
            if (activeList === "Default") {
              alert("Default watchlist cannot be renamed.");
              return;
            }
            const newName = prompt("Enter new watchlist name:", activeList);
            if (!newName || watchlists[newName]) {
              alert("Invalid or duplicate watchlist name.");
              return;
            }
            const updated = { ...watchlists };
            updated[newName] = updated[activeList];
            delete updated[activeList];
            setWatchlists(updated);
            localStorage.setItem("watchlists", JSON.stringify(updated));
            setActiveList(newName);
          }}
        >
          Rename
        </button>

        <button
          style={{ padding: "4px 8px", backgroundColor: "#ff4d4f", color: "#fff", border: "none", cursor: "pointer" }}
          onClick={() => {
            if (activeList === "Default") {
              alert("Cannot delete the Default watchlist.");
              return;
            }
            const confirmDelete = window.confirm(
              `Are you sure you want to delete the "${activeList}" watchlist?`
            );
            if (!confirmDelete) return;
            const updated = { ...watchlists };
            delete updated[activeList];
            setWatchlists(updated);
            localStorage.setItem("watchlists", JSON.stringify(updated));
            setActiveList("Default");
          }}
        >
          Delete
        </button>

        <button onClick={exportToCsv}>
          Export Watchlist CSV
        </button>
      </div>

      <div className="watchlist-search-row">
        <input
          type="text"
          placeholder="Search ticker..."
          value={typedQuery}
          onChange={(e) => {
            setTypedQuery(e.target.value);
            if (gridRef.current?.api) {
              gridRef.current.api.setGridOption("quickFilterText", e.target.value);
            }
          }}
          className="search-input"
        />
        <button onClick={fetchStocks}>Refresh</button>
        <button onClick={clearAllFilters}>Clear Filters</button>
      </div>
    </div>

    {showTable && (
      <div className="watchlist-analytics-side">
        <WatchlistAnalytics
        activeList={activeList}
        watchlists={watchlists}
        />
      </div>
    )}
  </div>
)}
    {view !== "Watchlist" && (
      <div style={{ marginBottom: "10px", fontSize: "14px", color: "#ffffff" }}>
        Currently showing {displayedCount} tickers
      </div>
    )}

    {view !== "Watchlist" && (
  <div style={{ marginBottom: "15px" }}>
    <input
      type="text"
      placeholder="Search ticker..."
      value={typedQuery}
      onChange={(e) => {
        setTypedQuery(e.target.value);
        if (gridRef.current?.api) {
          gridRef.current.api.setGridOption("quickFilterText", e.target.value);
        }
      }}
      className="search-input"
    />
    <button onClick={fetchStocks} style={{ marginLeft: "10px" }}>Refresh</button>
    <button onClick={clearAllFilters} style={{ marginLeft: "10px" }}>Clear Filters</button>
  </div>
)}
  </>
)}

    {showTable && (
  <>
    {/* Loading / Grid */}
    {loading ? (
      <div className="loading-container">
        <div className="spinner"></div>
        Loading stocks...
      </div>
    ) : (
      <div>
        {/* TOP SCROLLBAR */}
        <div className="top-scrollbar">
          <div className="top-scroll-content"></div>
        </div>

        <div
          className={`ag-theme-alpine ${view === "Watchlist" ? "ag-watchlist" : ""}`}
          style={{ width: "100%", height: "700px" }}
        >
          <AgGridReact
            ref={gridRef}
            suppressFieldDotNotation={true}
            headerHeight={70}
            rowData={rowData}
            columnDefs={columns}
            defaultColDef={defaultColDef}
            immutableData={true}
            getRowId={(params) => `${params.data.Ticker}_${activeList}`}
            suppressScrollOnNewData={true}
            rowBuffer={0}
            animateRows={true}
            rowSelection="multiple"
            rowHeight={30}
            onGridReady={(params) => {
            gridRef.current = params;
            setDisplayedCount(params.api.getDisplayedRowCount());
            }}
            onFirstDataRendered={(params) => setDisplayedCount(params.api.getDisplayedRowCount())}
            onFilterChanged={(params) => setDisplayedCount(params.api.getDisplayedRowCount())}
          />
        </div>

        {starModalOpen && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              width: "100vw",
              height: "100vh",
              backgroundColor: "rgba(0,0,0,0.5)",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              zIndex: 1000,
            }}
          >
            <div style={{ backgroundColor: "#fff", padding: "20px", borderRadius: "8px", width: "300px" }}>
              <h3 style={{ color: "#000" }}>Select Watchlists for {modalTicker}</h3>

              <div style={{ display: "flex", flexDirection: "column", gap: "5px", marginTop: "10px" }}>
                {Object.keys(watchlists).map((listName) => (
                  <label key={listName} style={{ color: "#000" }}>
                    <input
                      type="checkbox"
                      checked={modalSelectedLists.includes(listName)}
                      onChange={(e) => {
                        setModalSelectedLists((prev) => {
                          if (e.target.checked) return [...prev, listName];
                          else return prev.filter((l) => l !== listName);
                        });
                      }}
                    />{" "}
                    {listName}
                  </label>
                ))}
              </div>

              <div style={{ marginTop: "15px", display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button onClick={() => setStarModalOpen(false)} style={{ padding: "4px 8px" }}>Cancel</button>
                <button
                  onClick={() => {
                    const updated = { ...watchlists };
                    Object.keys(updated).forEach((listName) => {
                      if (modalSelectedLists.includes(listName)) {
                        updated[listName] = [...new Set([...(updated[listName] ?? []), modalTicker])];
                      } else {
                        updated[listName] = (updated[listName] ?? []).filter(t => t !== modalTicker);
                      }
                    });
                    setWatchlists(updated);
                    localStorage.setItem("watchlists", JSON.stringify(updated));
                    setStarModalOpen(false);
                    if (gridRef.current?.api) {
                      gridRef.current.api.refreshClientSideRowModel("everything");
                      gridRef.current.api.redrawRows();
                    }
                    setNotification(`${modalTicker} watchlists updated ✓`);
                    setTimeout(() => setNotification(null), 2000);
                  }}
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )}
  </>
    )}
  </div>
);
}

export default StockTable;