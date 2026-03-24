import React, { useState } from "react";
import supplyChainTree from "./data/supplyChainTree";

const companies = Object.keys(supplyChainTree);

export default function SupplyChain() {
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");

  const handleTickerClick = (ticker) => {
    window.location.href = `/dashboard?tickers=${ticker}`;
  };

  // Filter companies based on search input
  const filteredCompanies = companies.filter((ticker) =>
    supplyChainTree[ticker].name
      .toLowerCase()
      .includes(searchTerm.toLowerCase())
  );

  return (
    <div style={{ color: "white" }}>
      <h1>40 DOW & Mega Cap Supply Chains</h1>
      <p>Select a company to explore its supply chain</p>

      {/* SEARCH BAR */}
      <input
        type="text"
        placeholder="Search companies..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        style={{
          padding: "10px 15px",
          width: "100%",
          maxWidth: "400px",
          marginTop: "10px",
          borderRadius: "6px",
          border: "1px solid #555",
          background: "#ffffff",
          color: "black",
          outline: "none"
        }}
      />

      {/* COMPANY GRID */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: "20px",
          marginTop: "30px"
        }}
      >
        {filteredCompanies.map((ticker) => (
          <div
            key={ticker}
            onClick={() => setSelectedCompany(ticker)}
            style={{
              padding: "20px",
              background: "#1a2238",
              borderRadius: "8px",
              textAlign: "center",
              cursor: "pointer",
              fontWeight: "bold"
            }}
          >
            {supplyChainTree[ticker].name || ticker}
          </div>
        ))}
        {filteredCompanies.length === 0 && (
          <div style={{ gridColumn: "1 / -1", textAlign: "center", opacity: 0.5 }}>
            No companies found
          </div>
        )}
      </div>

      {/* SUPPLY CHAIN DISPLAY */}
      {selectedCompany && supplyChainTree[selectedCompany] && (
        <div style={{ marginTop: "40px" }}>
          <h2>{supplyChainTree[selectedCompany].name}</h2>

          <h3>Supply Chain Flow</h3>

          <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap" }}>
            {supplyChainTree[selectedCompany].chain.map((node, i) => (
              <React.Fragment key={i}>
                <div
                  style={{
                    padding: "10px 15px",
                    background:
                      node.ticker === selectedCompany ? "#19C37D" : "#1a2238",
                    borderRadius: "6px",
                    margin: "5px",
                    textAlign: "center",
                    cursor: "pointer"
                  }}
                  onClick={() => handleTickerClick(node.ticker)}
                >
                  <div style={{ fontWeight: "bold" }}>{node.name || node.ticker}</div>
                  <div style={{ fontSize: "12px", opacity: 0.7 }}>
                    {node.role}
                  </div>
                </div>

                {i < supplyChainTree[selectedCompany].chain.length - 1 && (
                  <span style={{ margin: "0 10px" }}>→</span>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}