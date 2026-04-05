import React, { useState } from "react";
import dependencyTree from "./data/macroDependencyTree";

const macroDrivers = Object.keys(dependencyTree);

export default function DependencyMap() {
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [direction, setDirection] = useState(null);
  const [chain, setChain] = useState([]);
  const [showWhyIndex, setShowWhyIndex] = useState(null);

  const currentNode = chain[chain.length - 1];

  const handleTickerClick = (ticker, node) => {
    if (!node?.stocks) return;
    const tickers = node.stocks.join(",");
    window.location.href = `/dashboard?tickers=${tickers}&focus=${ticker}`;
  };

  const renderNodeCard = (node, clickable = false, onClick = null, idx = null) => (
    <div
      key={idx ?? node.name}
      onClick={onClick || undefined}
      style={{
  padding: "14px",
  background: "#1a2238",
  borderRadius: "8px",
  display: "block",
  width: "100%",
  cursor: clickable ? "pointer" : "default",
  boxSizing: "border-box"
}}
    >
      <div style={{ fontWeight: "bold", marginBottom: "8px" }}>
        {node.name} {node.direction === "up" ? "↑" : "↓"}
      </div>

      {node.magnitude != null && (
        <div style={{ fontSize: "14px", marginBottom: "4px" }}>
          Magnitude: {node.magnitude}/10
        </div>
      )}

      {node.speed && (
        <div style={{ fontSize: "14px", marginBottom: "4px" }}>
          Speed: {node.speed}
        </div>
      )}

      {node.confidence != null && (
        <div style={{ fontSize: "14px", marginBottom: "4px" }}>
          Confidence: {node.confidence}/10
        </div>
      )}

      {node.whyShort && (
        <div style={{ fontSize: "14px", marginTop: "8px", opacity: 0.9 }}>
          Why: {node.whyShort}
        </div>
      )}
    </div>
  );

  return (
    <div style={{ color: "white" }}>
      <h1>Market Dependency Map</h1>
      <p>Select a macro driver and choose ↑ or ↓ to see market impact.</p>

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
              setShowWhyIndex(null);
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

      {selectedDriver && (
        <div style={{ marginTop: "40px" }}>
          <h2>{selectedDriver}</h2>

          <button
            onClick={() => {
              setDirection("up");
              setChain([]);
              setShowWhyIndex(null);
            }}
            style={{ marginRight: "20px", padding: "10px 20px", fontSize: "20px" }}
          >
            ↑
          </button>

          <button
            onClick={() => {
              setDirection("down");
              setChain([]);
              setShowWhyIndex(null);
            }}
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

          <div
  style={{
    marginTop: "20px",
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: "20px"
  }}
>
            {(dependencyTree[selectedDriver]?.[direction] || []).map((item, i) =>
            renderNodeCard(
            item,
            true,
            () => {
             setChain([item]);
            setShowWhyIndex(null);
            },
            i
            )
            )}
            </div>

          {chain.map((node, idx) => (
            <div key={idx} style={{ marginTop: "30px" }}>
              <h3>{node.name}</h3>

              <div style={{ marginBottom: "12px", lineHeight: "1.8" }}>
                <div>Direction: {node.direction === "up" ? "Up ↑" : "Down ↓"}</div>
                {node.magnitude != null && <div>Magnitude: {node.magnitude}/10</div>}
                {node.speed && <div>Speed: {node.speed}</div>}
                {node.confidence != null && <div>Confidence: {node.confidence}/10</div>}
                {node.mechanism && <div>Mechanism: {node.mechanism}</div>}
                {node.order != null && <div>Order: {node.order}</div>}
                {node.whyShort && <div>Why: {node.whyShort}</div>}

                {node.whyLong && (
                  <div style={{ marginTop: "10px" }}>
                    <button
                      onClick={() =>
                        setShowWhyIndex(showWhyIndex === idx ? null : idx)
                      }
                      style={{
                        padding: "6px 12px",
                        borderRadius: "6px",
                        border: "none",
                        cursor: "pointer"
                      }}
                    >
                      {showWhyIndex === idx ? "Hide Why" : "Show Why"}
                    </button>

                    {showWhyIndex === idx && (
                      <div
                        style={{
                          marginTop: "10px",
                          padding: "12px",
                          background: "#24304d",
                          borderRadius: "8px"
                        }}
                      >
                        {node.whyLong}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {node.stocks && node.stocks.length > 0 && (
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
              )}
            </div>
          ))}

          {currentNode?.next && currentNode.next.length > 0 && (
  <div style={{ marginTop: "30px" }}>
    <h3>Secondary Effects</h3>

    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
        gap: "20px"
      }}
    >
      {currentNode.next.map((effect, i) =>
        renderNodeCard(
          effect,
          true,
          () => setChain([...chain, effect]),
          i
        )
      )}
    </div>
  </div>
)}
        </div>
      )}
    </div>
  );
}
