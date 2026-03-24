import React, { useState } from "react";
import dependencyTree from "./data/macroDependencyTree";

const macroDrivers = Object.keys(dependencyTree);

export default function DependencyMap() {

  const [selectedDriver, setSelectedDriver] = useState(null);
  const [direction, setDirection] = useState(null);
  const [selectedIndustry, setSelectedIndustry] = useState(null);
  const [chain, setChain] = useState([]);

  const currentNode = chain[chain.length - 1];

  const handleTickerClick = (ticker, node) => {
  if (!node?.stocks) return;
  const tickers = node.stocks.join(",");
  window.location.href = `/dashboard?tickers=${tickers}&focus=${ticker}`;
};

  return (
    <div style={{ color: "white" }}>

      <h1>Market Dependency Map</h1>

      <p>Select a macro driver and choose ↑ or ↓ to see market impact.</p>

      {/* DRIVER GRID */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: "20px",
          marginTop: "30px"
        }}
      >
        {macroDrivers.map((driver) => (
          <div
            key={driver}
            onClick={() => {
            setSelectedDriver(driver);
            setDirection(null);
            setChain([]);
            }}
            style={{
              padding: "20px",
              background: selectedDriver === driver ? "#19C37D" : "#1a2238",
              borderRadius: "8px",
              textAlign: "center",
              cursor: "pointer",
              fontWeight: "bold"
            }}
          >
            {driver}
          </div>
        ))}
      </div>

      {/* ARROW SELECTOR */}
      {selectedDriver && (
        <div style={{ marginTop: "40px" }}>

          <h2>{selectedDriver}</h2>

          <button
            onClick={() => setDirection("up")}
            style={{ marginRight: "20px", padding: "10px 20px", fontSize: "20px" }}
          >
            ↑
          </button>

          <button
            onClick={() => setDirection("down")}
            style={{ padding: "10px 20px", fontSize: "20px" }}
          >
            ↓
          </button>

        </div>
      )}

      {direction && (
  <div style={{ marginTop: "40px" }}>
    <h3>
      Simulating: {selectedDriver} {direction === "up" ? "↑" : "↓"}
    </h3>

    {chain.length > 0 && (
  <div style={{ marginTop: "15px", marginBottom: "20px" }}>
    <strong>Impact Chain:</strong>{" "}
    {chain.map((c, i) => (
      <span key={i}>
        {c.name} {c.direction === "up" ? "↑" : "↓"}
        {i < chain.length - 1 && " → "}
      </span>
    ))}
  </div>
)}

    {/* INDUSTRIES */}
    <div style={{ marginTop: "20px" }}>
      {(dependencyTree[selectedDriver]?.[direction] || []).map((item, i) => (
        <div
          key={i}
          onClick={() => {
            setSelectedIndustry(item);
            setChain([item]);
          }}
          style={{
            marginBottom: "10px",
            padding: "10px",
            background: "#1a2238",
            borderRadius: "6px",
            display: "inline-block",
            marginRight: "10px",
            cursor: "pointer"
          }}
        >
          {item.name} {item.direction === "up" ? "↑" : "↓"}
        </div>
      ))}
    </div>

    {/* STEP 3 — STOCK DISPLAY */}
{chain.map((node, idx) => (
  node.stocks && (
    <div key={idx} style={{ marginTop: "30px" }}>

      <h3>{node.name} Stocks</h3>

      <div>
        {node.stocks.map((ticker) => (
          <span
            key={ticker}
            onClick={() => handleTickerClick(ticker, node)}
            style={{
              padding: "8px 12px",
              background: node.direction === "up" ? "#19C37D" : "#E5484D",
              color: "white",
              borderRadius: "6px",
              marginRight: "8px",
              display: "inline-block",
              fontWeight: "bold",
              cursor: "pointer"
            }}
          >
            {ticker}
          </span>
        ))}
      </div>

    </div>
  )
))}
{currentNode?.next && (
  <div style={{ marginTop: "30px" }}>

    <h3>Secondary Effects</h3>

    {currentNode.next.map((effect, i) => (
      <div
        key={i}
        onClick={() => setChain([...chain, effect])}
        style={{
          marginBottom: "10px",
          padding: "10px",
          background: "#1a2238",
          borderRadius: "6px",
          display: "inline-block",
          marginRight: "10px",
          cursor: "pointer"
        }}
      >
        {effect.name} {effect.direction === "up" ? "↑" : "↓"}
      </div>
    ))}

  </div>
)}
        </div>
      )}
    </div>
  );
}
