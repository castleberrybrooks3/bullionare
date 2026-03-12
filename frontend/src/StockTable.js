import React, { useState, useEffect, useMemo, useRef } from "react";
import { AgGridReact } from "ag-grid-react";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";
import { ModuleRegistry, AllCommunityModule } from "ag-grid-community";
import "./StockTable.css";

/* ✅ Correct for your AG Grid version */
ModuleRegistry.registerModules([AllCommunityModule]);

  const StockTable = ({ view, selectedSector }) => {
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

  const gridRef = useRef({ api: null });

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
    setStocks(Array.isArray(data) ? data : []);
  } catch (err) {
    console.error(err);
    setStocks([]);
  } finally {
    setLoading(false); // stop loading
  }
};

  useEffect(() => {
    fetchStocks();
  }, []);

  useEffect(() => {
  const handler = setTimeout(() => {
    setSearchQuery(typedQuery); // update actual filter only after 300ms pause
  }, 1000); //

  return () => clearTimeout(handler); // cleanup on new keystroke
}, [typedQuery]);

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

            if (gridRef.current?.api) {
              gridRef.current.api.refreshClientSideRowModel("everything");
              gridRef.current.api.redrawRows();
            }

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

  return base;
}, [processedStocks, watchlists, view, activeList, selectedSector]);

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
  if (!gridRef.current) return;

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

  gridRef.current.exportDataAsCsv({
    fileName: fileName,
    prependContent: [
      [{ data: { value: "Bullionare Analytics Export" } }],
      [{ data: { value: `Generated: ${readableTimestamp}` } }],
      [],
    ],
  });
};
  return (
  <div className="stock-table-container">

  {notification && (
  <div className="notification-toast">
    {notification}
  </div>
)}

    {view !== "Watchlist" && (
  <div className="dashboard-header">
    <h1 className="dashboard-title">
      BECOME A BULLIONARE
    </h1>
    <p className="dashboard-subtitle"></p>
  </div>
)}

    <h2>{view === "Watchlist" ? "Your Watchlist" : "Market Analytics"}</h2>

      {view === "Watchlist" && (
  <div style={{ marginBottom: "15px", display: "flex", gap: "10px", alignItems: "center" }}>

    {/* Watchlist Selector */}
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

    {/* Create New Watchlist */}
    <button
      style={{
        padding: "4px 8px",
        backgroundColor: "#19C37D",
        color: "#fff",
        border: "none",
        cursor: "pointer",
      }}
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
{/* Rename Watchlist */}
<button
  style={{
    padding: "4px 8px",
    backgroundColor: "#3b82f6",
    color: "#fff",
    border: "none",
    cursor: "pointer",
  }}
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

    updated[newName] = updated[activeList]; // copy tickers
    delete updated[activeList];             // remove old name

    setWatchlists(updated);
    localStorage.setItem("watchlists", JSON.stringify(updated));
    setActiveList(newName);
  }}
>
  Rename
</button>
    {/* Delete Watchlist */}
    <button
      style={{
        padding: "4px 8px",
        backgroundColor: "#ff4d4f",
        color: "#fff",
        border: "none",
        cursor: "pointer",
      }}
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

        // Switch back to Default after deletion
        setActiveList("Default");
      }}
    >
      Delete
    </button>

  </div>
)}

      {view !== "Watchlist" && (
  <div style={{ marginBottom: "10px", fontSize: "14px", color: "#ffffff" }}>
    Currently showing {displayedCount} tickers
  </div>
)}
{view === "Watchlist" && (
  <div style={{ marginBottom: "10px" }}>
    <button onClick={exportToCsv}>
      Export Watchlist CSV
    </button>
  </div>
)}
      <div style={{ marginBottom: "15px" }}>
  <input
    type="text"
    placeholder="Search ticker..."
    value={typedQuery}
    onChange={(e) => setTypedQuery(e.target.value)}
    className="search-input"
  />

  <button onClick={fetchStocks} style={{ marginLeft: "10px" }}>
    Refresh
  </button>

  <button onClick={clearAllFilters} style={{ marginLeft: "10px" }}>
    Clear Filters
  </button>
</div>

{/* Loading / Grid */}
{loading ? (
  <div className="loading-container">
    <div className="spinner"></div>
    Loading stocks...
  </div>
) : (
  <div
    className={`ag-theme-alpine ${view === "Watchlist" ? "ag-watchlist" : ""}`}
    style={{ width: "100%", height: "700px" }}
  >
    <AgGridReact
      ref={gridRef}
      headerHeight={70}
      rowData={rowData}
      columnDefs={columns}
      defaultColDef={defaultColDef}
      immutableData={true}
      getRowId={(params) => params.data.Ticker}
      suppressScrollOnNewData={true}
      rowBuffer={0}
      animateRows={true}
      rowSelection="multiple"
      rowHeight={30}
      onGridReady={(params) => {
        gridRef.current.api = params.api;
        setDisplayedCount(params.api.getDisplayedRowCount());
      }}
      onFirstDataRendered={(params) => {
        setDisplayedCount(params.api.getDisplayedRowCount());
      }}
      onFilterChanged={(params) => {
        setDisplayedCount(params.api.getDisplayedRowCount());
      }}
    />
  </div>
)}
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
    <div
      style={{
        backgroundColor: "#fff",
        padding: "20px",
        borderRadius: "8px",
        width: "300px",
      }}
    >
      <h3 style={{ color: "#000" }}>
        Select Watchlists for {modalTicker}
      </h3>

      <div style={{ display: "flex", flexDirection: "column", gap: "5px", marginTop: "10px" }}>
        {Object.keys(watchlists).map((listName) => (
  <label key={listName} style={{ color: "#000" }}>
    <input
      type="checkbox"
      checked={modalSelectedLists.includes(listName)}
      onChange={(e) => {
        setModalSelectedLists((prev) => {
          if (e.target.checked) {
            return [...prev, listName];
          } else {
            return prev.filter((l) => l !== listName);
          }
        });
      }}
    />{" "}
    {listName}
  </label>
))}
      </div>

      <div style={{ marginTop: "15px", display: "flex", justifyContent: "flex-end", gap: "10px" }}>
        <button
          onClick={() => setStarModalOpen(false)}
          style={{ padding: "4px 8px" }}
        >
          Cancel
        </button>

        <button
  onClick={() => {
    const updated = { ...watchlists }; // clone first
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
  );
};

export default StockTable;