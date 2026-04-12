import React, { useState, useMemo } from "react";
import dependencyTree from "./data/macroDependencyTree";
import { buildReverseMacroMap } from "./data/buildReverseMacroMap";
import { summarizeTickerMacroExposure } from "./data/macroLookupHelpers";

const macroDrivers = Object.keys(dependencyTree);
const macroDriverDescriptions = {
  "Interest Rates": "Benchmark borrowing costs that affect lending, spending, and asset valuations.",
  "Bond Yields": "Interest rates on bonds that influence borrowing costs and investor risk appetite.",
  "Inflation": "The pace at which prices for goods and services are rising across the economy.",
  "Oil Prices": "The cost of crude oil that impacts energy, transportation, and input costs.",
  "US Dollar": "The strength of the dollar relative to other currencies, affecting trade and earnings.",
  "Credit Conditions": "How easy or difficult it is for businesses and consumers to borrow money.",
  "Consumer Spending": "The level of household spending that drives demand across much of the economy.",
  "Wages": "The level and growth of worker pay across the economy.",
  "Economic Growth": "The overall pace of business activity, expansion, and output in the economy.",
  "Housing Demand": "The strength of homebuying demand, construction activity, and housing-related trends.",
  "Semiconductor Demand": "Demand for chips used across consumer electronics, AI, autos, and industrial markets.",
  "Geopolitical Risk": "Political and global conflict risks that can disrupt trade, markets, and supply chains.",
  "Central Bank Liquidity": "The amount of money and financial support central banks are providing to markets."
};

const speedDescriptions = {
  Immediate: "Today / same trading day",
  Fast: "Usually within days to around 2 weeks",
  Delayed: "Usually several weeks to a few months"
};

export default function DependencyMap() {
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [direction, setDirection] = useState(null);
  const [chain, setChain] = useState([]);
  const [showWhyIndex, setShowWhyIndex] = useState(null);
  const [hoveredDriver, setHoveredDriver] = useState(null);
  const [tickerQuery, setTickerQuery] = useState("");

  const currentNode = chain[chain.length - 1];

  const reverseMacroMap = useMemo(() => buildReverseMacroMap(), []);
  const normalizedTickerQuery = tickerQuery.trim().toUpperCase();

  const tickerExposures = useMemo(() => {
    if (!normalizedTickerQuery) return [];

    const rawExposures = reverseMacroMap[normalizedTickerQuery] || [];

    const bestByScenario = {};

    rawExposures.forEach((entry) => {
      const key = `${entry.macro}__${entry.macroDirection}__${entry.finalDirection}`;
      const existing = bestByScenario[key];

      if (!existing) {
        bestByScenario[key] = entry;
        return;
      }

      const existingConfidence = existing.confidence ?? -1;
      const newConfidence = entry.confidence ?? -1;

      if (newConfidence > existingConfidence) {
        bestByScenario[key] = entry;
        return;
      }

      if (newConfidence === existingConfidence) {
        const existingMagnitude = existing.magnitude ?? -1;
        const newMagnitude = entry.magnitude ?? -1;

        if (newMagnitude > existingMagnitude) {
          bestByScenario[key] = entry;
          return;
        }

        if (newMagnitude === existingMagnitude) {
          const existingPathLength = existing.path?.length ?? 0;
          const newPathLength = entry.path?.length ?? 0;

          if (newPathLength > existingPathLength) {
            bestByScenario[key] = entry;
          }
        }
      }
    });

    return summarizeTickerMacroExposure(Object.values(bestByScenario));
  }, [normalizedTickerQuery, reverseMacroMap]);

  const handleTickerClick = (ticker, node) => {
    if (!node?.stocks) return;
    const tickers = node.stocks.join(",");
    window.location.href = `/dashboard?tickers=${tickers}&focus=${ticker}`;
  };

  const renderNodeCard = (node, clickable = false, onClick = null, idx = null) => (
    <div
  key={idx ?? node.name}
  onClick={onClick || undefined}
  className={clickable ? "hover-glow" : ""}
  style={{
    padding: "14px",
    background: "#1a2238",
    borderRadius: "8px",
    display: "block",
    width: "100%",
    cursor: clickable ? "pointer" : "default",
    boxSizing: "border-box",
    border: "1px solid transparent"
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

      <div style={{ marginTop: "24px", marginBottom: "10px" }}>
        <h2 style={{ marginBottom: "10px" }}>Search a Stock</h2>
        <input
          type="text"
          placeholder="Enter ticker (e.g. NVDA)"
          value={tickerQuery}
          onChange={(e) => setTickerQuery(e.target.value)}
          style={{
            padding: "10px 12px",
            width: "280px",
            borderRadius: "8px",
            border: "1px solid #3b4a6b",
            background: "#1a2238",
            color: "white",
            outline: "none",
            fontSize: "14px"
          }}
        />
      </div>

      {normalizedTickerQuery && (
        <div style={{ marginTop: "16px", marginBottom: "30px" }}>
          <h3 style={{ marginBottom: "12px" }}>
            Macro Exposure for {normalizedTickerQuery}
          </h3>

          {tickerExposures.length === 0 ? (
            <div
              style={{
                padding: "14px",
                background: "#1a2238",
                borderRadius: "8px",
                display: "inline-block"
              }}
            >
              No macro exposures found for this ticker yet.
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                gap: "16px"
              }}
            >
              {tickerExposures.map((entry, idx) => (
                <div
  key={`${entry.macro}-${entry.macroDirection}-${entry.finalDirection}-${idx}`}
  className="hover-glow"
  style={{
    background: "#1a2238",
    border: "1px solid transparent",
                    padding: "16px",
                    boxSizing: "border-box"
                  }}
                >
                  <div style={{ fontWeight: "bold", marginBottom: "8px", fontSize: "16px" }}>
                    {entry.macro} {entry.macroDirection === "up" ? "↑" : "↓"}
                  </div>

                  <div style={{ marginBottom: "6px" }}>
                    <strong>Effect on {normalizedTickerQuery}:</strong>{" "}
                    <span style={{ color: entry.finalDirection === "up" ? "#19C37D" : "#E5484D" }}>
                      {entry.finalDirection === "up" ? "Positive ↑" : "Negative ↓"}
                    </span>
                  </div>

                  <div style={{ marginBottom: "6px" }}>
                    <strong>Confidence:</strong> {entry.confidence}/10
                  </div>

                  <div style={{ marginBottom: "10px", lineHeight: "1.5" }}>
                    <strong>Why:</strong> {entry.why}
                  </div>

                  <div style={{ lineHeight: "1.5" }}>
                    <strong>Path:</strong> {entry.pathText}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: "20px",
          marginTop: "30px",
          overflow: "visible"
        }}
      >
        {macroDrivers.map((driver) => (
<div
  key={driver}
  className="hover-glow"
  onMouseEnter={() => setHoveredDriver(driver)}
  onMouseLeave={() => setHoveredDriver(null)}
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
              fontWeight: "bold",
              position: "relative",
              border: "1px solid transparent",
              overflow: "visible"
            }}
          >
            {driver}

            {hoveredDriver === driver && macroDriverDescriptions[driver] && (
              <div
                style={{
                  position: "absolute",
                  bottom: "calc(100% + 8px)",
                  left: "50%",
                  transform: "translateX(-50%)",
                  background: "#24304d",
                  color: "white",
                  padding: "10px 12px",
                  borderRadius: "8px",
                  fontSize: "13px",
                  fontWeight: "normal",
                  lineHeight: "1.4",
                  width: "220px",
                  zIndex: 1000,
                  boxShadow: "0 6px 18px rgba(0,0,0,0.35)",
                  pointerEvents: "none"
                }}
              >
                {macroDriverDescriptions[driver]}
              </div>
            )}
          </div>
        ))}
      </div>

      {selectedDriver && (
        <div style={{ marginTop: "40px" }}>
          <h2>{selectedDriver}</h2>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: "24px",
              flexWrap: "wrap"
            }}
          >
            <div>
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

            <div
              style={{
                minWidth: "260px",
                maxWidth: "320px",
                background: "#1a2238",
                borderRadius: "8px",
                padding: "14px 16px",
                boxSizing: "border-box"
              }}
            >
              <div style={{ fontWeight: "bold", marginBottom: "10px" }}>
                Speed Key
              </div>

              <div style={{ fontSize: "14px", lineHeight: "1.8" }}>
                <div><strong>Immediate:</strong> {speedDescriptions.Immediate}</div>
                <div><strong>Fast:</strong> {speedDescriptions.Fast}</div>
                <div><strong>Delayed:</strong> {speedDescriptions.Delayed}</div>
              </div>
            </div>
          </div>
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
  className="hover-glow"
  style={{
    padding: "8px 12px",
    border: "1px solid transparent",
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
