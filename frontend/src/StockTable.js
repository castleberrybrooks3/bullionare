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

  const [watchlists, setWatchlists] = useState(() => {
  const saved = localStorage.getItem("watchlists");
  return saved ? JSON.parse(saved) : { Default: [] };
});

const [activeList, setActiveList] = useState("Default");

  const gridRef = useRef(null);

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

    const suffix = val.slice(-1).toUpperCase();
    let num = parseFloat(val);
    if (isNaN(num)) return null;

    switch (suffix) {
      case "T":
        return num * 1_000_000_000_000;
      case "B":
        return num * 1_000_000_000;
      case "M":
        return num * 1_000_000;
      default:
        return num;
    }
  };

  // === DEFINE COLUMNS HERE AT TOP LEVEL OF COMPONENT ===
  const columnDefsRef = useRef(null);

  const columns = useMemo(() => {
  if (columnDefsRef.current) return columnDefsRef.current;
  if (!processedStocks.length) return [];

  const cols = [
    {
      headerName: "★",
      field: "star",
      width: 60,
      pinned: "left",
      sortable: false,
      filter: false,
      cellStyle: { textAlign: "center", fontSize: "18px" },
      cellRenderer: (params) => {
        const ticker = params.data?.Ticker;
        if (!ticker) return "☆";
        return (
          <span
            onClick={() => openStarModal(ticker)}
            style={{ cursor: "pointer" }}
          >
            {Object.values(watchlists).some((list) => list.includes(ticker))
              ? "★"
              : "☆"}
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
    sortable: true,
    flex: 1,
    minWidth: 110,
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

  // Percent columns
  if (["Upside %", "Downside %"].includes(col)) {
    return val != null ? `${val.toFixed(2)}%` : "";
  }

  // Decimal numeric columns
  if (["P/E (TTM)", "Mean Target", "Risk-Reward Score"].includes(col)) {
    return val != null ? val.toFixed(2) : "";
  }

  // Dividend stays percent
  if (col === "Dividend") {
    return val != null ? `${val.toFixed(2)}%` : "";
  }

  return val ?? "";
}
  };

  if (processedStocks.some((row) => !isNaN(cleanNumber(row[col])))) {
    columnDef.filter = "agNumberColumnFilter";
    columnDef.filterParams = {
      filterOptions: ["greaterThan", "lessThan", "inRange"],
      suppressAndOrCondition: true,
      buttons: ["reset"],
      debounceMs: 200,
    };
    columnDef.cellClass = "numeric";
  } else {
    columnDef.filter = "agTextColumnFilter";
    columnDef.filterParams = {
      buttons: ["reset"],
      debounceMs: 200,
      suppressAndOrCondition: true,
    };
  }

  cols.push(columnDef);
});

  columnDefsRef.current = cols;
  return cols;
}, [processedStocks]);

  const rowData = useMemo(() => {
  let base =
    view === "Watchlist"
      ? processedStocks.filter((s) =>
          watchlists[activeList]?.includes(s.Ticker)
        )
      : processedStocks;

  // Only apply sector filter when viewing Stocks
  if (view === "Stocks" && selectedSector) {
    base = base.filter(
      (stock) => stock.Sector?.toLowerCase() === selectedSector.toLowerCase()
    );
  }

  // Search filter
  if (searchQuery) {
    base = base.filter((stock) =>
      stock.Ticker?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }

  return base;
}, [processedStocks, watchlists, view, searchQuery, activeList, selectedSector]);
  const defaultColDef = useMemo(
    () => ({
      resizable: true,
      sortable: true,
      minWidth: 100,
    }),
  );
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
      New List
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
      Delete List
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
          onChange={(e) => setTypedQuery(e.target.value)} // updates typedQuery immediately
          className="search-input"
        />
        <button onClick={fetchStocks} style={{ marginLeft: "10px" }}>
          Refresh
        </button>
      </div>

      <div
        className={`ag-theme-alpine ${view === "Watchlist" ? "ag-watchlist" : ""}`}
        style={{ width: "100%", height: "700px" }}
      >
        <AgGridReact
            ref={gridRef}
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
  gridRef.current = params.api;
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
      {/* Modal for selecting watchlists when star is clicked */}
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
    const updated = {};

    // Loop through all lists and build fresh arrays
    Object.keys(watchlists).forEach((listName) => {
      if (modalSelectedLists.includes(listName)) {
        // include this ticker
        updated[listName] = [...watchlists[listName], modalTicker].filter(
          (v, i, a) => a.indexOf(v) === i
        ); // remove duplicates just in case
      } else {
        // remove this ticker
        updated[listName] = watchlists[listName].filter((t) => t !== modalTicker);
      }
    });

    setWatchlists(updated);
    localStorage.setItem("watchlists", JSON.stringify(updated));
    setStarModalOpen(false);
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