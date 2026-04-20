import React, { useState } from "react";
import hiddenPairsTree from "./data/hiddenPairsTree";

const categories = Object.keys(hiddenPairsTree);

export default function HiddenPairs() {
  const [selectedCategory, setSelectedCategory] = useState(null);

  const handlePairClick = (pair) => {
    const tickers = pair.tickers.join(",");
    window.location.assign(`/dashboard?tickers=${tickers}`);
  };

  return (
    <div style={{ color: "white" }}>
      <h1>Convergence Trading or Tax Loss Harvesting</h1>
      <p>Find highly correlated and non-obvious stock relationships</p>

      {!selectedCategory && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: "20px",
            marginTop: "30px"
          }}
        >
          {categories.map((key) => (
            <div
              key={key}
              onClick={() => setSelectedCategory(key)}
              className="hover-glow"
              style={{
                padding: "25px",
                background: "#1a2238",
                borderRadius: "8px",
                textAlign: "center",
                cursor: "pointer",
                fontWeight: "bold",
                border: "1px solid transparent"
              }}
            >
              {hiddenPairsTree[key].name}
            </div>
          ))}
        </div>
      )}

      {selectedCategory && (
        <div style={{ marginTop: "40px" }}>
          <button
            onClick={() => setSelectedCategory(null)}
            style={{
              marginBottom: "20px",
              padding: "8px 12px",
              background: "#1a2238",
              color: "white",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer"
            }}
          >
            ← Back
          </button>

          <h2>{hiddenPairsTree[selectedCategory].name}</h2>

          <div style={{ display: "flex", flexWrap: "wrap" }}>
            {hiddenPairsTree[selectedCategory].pairs.map((pair, i) => (
              <div
                key={i}
                onClick={() => handlePairClick(pair)}
                className="hover-glow"
                style={{
                  padding: "14px 18px",
                  background: "#1a2238",
                  borderRadius: "6px",
                  margin: "8px",
                  cursor: "pointer",
                  minWidth: "180px",
                  border: "1px solid transparent"
                }}
              >
                <div style={{ fontWeight: "bold" }}>
                  {pair.tickers[0]} ↔ {pair.tickers[1]}
                </div>

                <div style={{ fontSize: "12px", opacity: 0.8 }}>
                  Correlation: {(pair.correlation * 100).toFixed(0)}%
                </div>

                <div style={{ fontSize: "11px", opacity: 0.6 }}>
                  {pair.relationship}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}