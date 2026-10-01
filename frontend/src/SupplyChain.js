import React, { useMemo, useState } from "react";
import supplyChainTree from "./data/supplyChainTree";
import ReactFlow, {
  Background,
  Controls,
  MarkerType,
  Panel,
} from "reactflow";
import "reactflow/dist/style.css";
import "./SupplyChain.css";

const companies = Object.keys(supplyChainTree);

const NODE_WIDTH = 220;
const NODE_GAP_X = 140;
const NODE_GAP_Y = 14;

const SECURITY_TYPES = {
  US_PUBLIC: "us-public",
  ADR: "adr",
  INTERNATIONAL_US_LISTED: "international-us-listed",
  OTC_FOREIGN: "otc-foreign",
  NON_PUBLIC: "non-public",
};

const SECURITY_META = {
  [SECURITY_TYPES.US_PUBLIC]: {
    label: "U.S. public company",
    color: "#4ADE80",
    clickable: true,
  },
  [SECURITY_TYPES.ADR]: {
    label: "ADR / ADS",
    color: "#60A5FA",
    clickable: true,
  },
  [SECURITY_TYPES.INTERNATIONAL_US_LISTED]: {
    label: "International public — U.S.-listed ordinary shares",
    color: "#C084FC",
    clickable: true,
  },
  [SECURITY_TYPES.OTC_FOREIGN]: {
    label: "Foreign OTC public security",
    color: "#F59E0B",
    clickable: true,
  },
  [SECURITY_TYPES.NON_PUBLIC]: {
    label: "Private / subsidiary / product / process",
    color: "#94A3B8",
    clickable: false,
  },
};

// ADR / ADS securities currently used anywhere in supplyChainTree.
const ADR_TICKERS = new Set([
  "ADDYY", "ADYEY", "ARM", "ASX", "AZN", "BHP", "BMWYY", "BP",
  "EADSY", "ERIC", "ERJ", "FUJHY", "FUJIY", "IFNNY", "KOF",
  "MRAAY", "NOK", "PCRFY", "RIO", "SAP", "SBGSY", "SNY", "SONY",
  "TSM", "UMC", "VALE",
]);

// Foreign-incorporated companies whose ordinary shares trade directly in the U.S.
const INTERNATIONAL_US_LISTED_TICKERS = new Set([
  "ACN", "ASML", "CB", "CCEP", "ETN", "FLEX", "FN", "GFS", "ICHR",
  "LIN", "RNW", "SLB", "SPOT", "STX", "TT",
]);

// Foreign ordinary shares that are OTC-traded rather than ADRs.
const OTC_FOREIGN_TICKERS = new Set(["FXCOF"]);

// These names use a parent-company ticker in the data, but the node itself is
// a division, subsidiary, brand, product, or operating unit rather than the
// separately listed company. They stay visible but are intentionally not clickable.
const NON_PUBLIC_TICKER_NODE_NAMES = new Set([
  "Amazon Web Services",
  "Microsoft Azure",
  "Google Cloud",
  "Oracle Cloud Infrastructure",
  "Comcast Xfinity",
  "Walmart Pharmacy",
  "Kroger Pharmacy",
  "Panasonic Energy",
]);

// Known ticker/entity mismatches in the current tree. Blocking them here prevents
// a click from routing to the wrong security until the underlying data is corrected.
const BLOCKED_TICKER_ENTITY_PAIRS = new Set([
  "FUJHY|Fujitsu",
  "FXCOF|Foxconn Technology Group",
]);

function getSecurityType(node) {
  if (!node?.ticker) return SECURITY_TYPES.NON_PUBLIC;

  // Optional explicit metadata in supplyChainTree always wins.
  if (node.securityType && SECURITY_META[node.securityType]) {
    return node.securityType;
  }
  if (node.isPublicCompany === false) {
    return SECURITY_TYPES.NON_PUBLIC;
  }

  const ticker = String(node.ticker).trim().toUpperCase();
  const name = String(node.name || "").trim();
  const pairKey = `${ticker}|${name}`;

  if (
    NON_PUBLIC_TICKER_NODE_NAMES.has(name) ||
    BLOCKED_TICKER_ENTITY_PAIRS.has(pairKey)
  ) {
    return SECURITY_TYPES.NON_PUBLIC;
  }

  if (ADR_TICKERS.has(ticker)) return SECURITY_TYPES.ADR;
  if (INTERNATIONAL_US_LISTED_TICKERS.has(ticker)) {
    return SECURITY_TYPES.INTERNATIONAL_US_LISTED;
  }
  if (OTC_FOREIGN_TICKERS.has(ticker)) return SECURITY_TYPES.OTC_FOREIGN;

  // Every other ticker-bearing company node in the current 100-company tree
  // is treated as a U.S. public company.
  return SECURITY_TYPES.US_PUBLIC;
}

function getSecurityMeta(node) {
  return SECURITY_META[getSecurityType(node)] || SECURITY_META[SECURITY_TYPES.NON_PUBLIC];
}

const LEGEND_ITEMS = [
  SECURITY_META[SECURITY_TYPES.US_PUBLIC],
  SECURITY_META[SECURITY_TYPES.ADR],
  SECURITY_META[SECURITY_TYPES.INTERNATIONAL_US_LISTED],
  SECURITY_META[SECURITY_TYPES.OTC_FOREIGN],
  SECURITY_META[SECURITY_TYPES.NON_PUBLIC],
];

const nodeBaseStyle = {
  background: "#1a2238",
  color: "white",
  border: "1px solid transparent",
  borderRadius: "12px",
  padding: "10px 14px",
  width: NODE_WIDTH,
  boxSizing: "border-box",
  textAlign: "center",
  boxShadow: "0 4px 14px rgba(0,0,0,0.25)",
  cursor: "default",
  transition: "all 0.2s ease",
};

const rootNodeStyle = {
  ...nodeBaseStyle,
  background: "#19C37D",
  border: "1px solid #19C37D",
  color: "white",
  fontWeight: "bold",
  boxShadow: "0 0 20px rgba(25,195,125,0.25)",
};

function buildGraphFromNodesEdges(data) {
  const rawNodes = Array.isArray(data?.nodes) ? data.nodes : [];
  const rawEdges = Array.isArray(data?.edges) ? data.edges : [];
  const rootId = data?.root || null;

  const incomingCount = {};
  const outgoingCount = {};
  const adjacency = {};
  const indegree = {};

  rawNodes.forEach((node) => {
    incomingCount[node.id] = 0;
    outgoingCount[node.id] = 0;
    adjacency[node.id] = [];
    indegree[node.id] = 0;
  });

  rawEdges.forEach((edge) => {
    if (edge.source in outgoingCount) outgoingCount[edge.source] += 1;
    if (edge.target in incomingCount) incomingCount[edge.target] += 1;
    if (edge.source in adjacency) adjacency[edge.source].push(edge.target);
    if (edge.target in indegree) indegree[edge.target] += 1;
  });

  const layers = {};
  const queue = [];

  if (rootId && rawNodes.some((n) => n.id === rootId)) {
    layers[rootId] = 0;
    queue.push(rootId);

    while (queue.length > 0) {
      const current = queue.shift();
      const nextNodes = adjacency[current] || [];
      nextNodes.forEach((nextId) => {
        if (!(nextId in layers)) {
          layers[nextId] = layers[current] + 1;
          queue.push(nextId);
        }
      });
    }

    const reverseAdjacency = {};
    rawNodes.forEach((node) => {
      reverseAdjacency[node.id] = [];
    });
    rawEdges.forEach((edge) => {
      if (reverseAdjacency[edge.target]) {
        reverseAdjacency[edge.target].push(edge.source);
      }
    });

    const reverseQueue = [rootId];
    while (reverseQueue.length > 0) {
      const current = reverseQueue.shift();
      const prevNodes = reverseAdjacency[current] || [];
      prevNodes.forEach((prevId) => {
        if (!(prevId in layers)) {
          layers[prevId] = layers[current] - 1;
          reverseQueue.push(prevId);
        }
      });
    }
  } else {
    const topoQueue = rawNodes
      .filter((node) => indegree[node.id] === 0)
      .map((node) => node.id);

    topoQueue.forEach((id) => {
      layers[id] = 0;
    });

    while (topoQueue.length > 0) {
      const current = topoQueue.shift();
      (adjacency[current] || []).forEach((nextId) => {
        layers[nextId] = Math.max(
          layers[nextId] ?? Number.NEGATIVE_INFINITY,
          (layers[current] ?? 0) + 1
        );
        indegree[nextId] -= 1;
        if (indegree[nextId] === 0) topoQueue.push(nextId);
      });
    }

    rawNodes.forEach((node) => {
      if (!(node.id in layers)) layers[node.id] = 0;
    });
  }

  const columns = {};
  rawNodes.forEach((node) => {
    const layer = layers[node.id] ?? 0;
    if (!columns[layer]) columns[layer] = [];
    columns[layer].push(node);
  });

  const sortedLayers = Object.keys(columns)
    .map(Number)
    .sort((a, b) => a - b);

  const xSpacing = NODE_WIDTH + NODE_GAP_X;

/*
  Estimate the rendered height of each node.

  The boxes all use the same fixed width, so the main reason their
  heights differ is text wrapping. We intentionally estimate a little
  conservatively so neighboring nodes always retain a small gap.
*/
const estimateNodeHeight = (node) => {
  const name = String(node?.name || node?.ticker || node?.id || "");
  const role = String(node?.role || "");
  const ticker = String(node?.ticker || "");

  // Approximate usable text width inside a 220px box.
  const charsPerLine = 27;

  const nameLines = Math.max(1, Math.ceil(name.length / charsPerLine));
  const roleLines = role
    ? Math.max(1, Math.ceil(role.length / charsPerLine))
    : 0;
  const tickerLines = ticker ? 1 : 0;

  const paddingHeight = 20;
  const nameHeight = nameLines * 18;
  const roleHeight = roleLines * 16;
  const tickerHeight = tickerLines * 14;

  const internalMargins =
    (roleLines ? 4 : 0) +
    (tickerLines ? 4 : 0);

  return Math.max(
    76,
    paddingHeight +
      nameHeight +
      roleHeight +
      tickerHeight +
      internalMargins
  );
};

const flowNodes = [];

sortedLayers.forEach((layer) => {
  const nodesInLayer = columns[layer];

  const nodeHeights = nodesInLayer.map(estimateNodeHeight);

  const totalHeight =
    nodeHeights.reduce((sum, height) => sum + height, 0) +
    Math.max(0, nodesInLayer.length - 1) * NODE_GAP_Y;

  let currentY = -totalHeight / 2;

  nodesInLayer.forEach((node, index) => {
    const isRoot = node.id === rootId;
    const estimatedHeight = nodeHeights[index];
    const security = getSecurityMeta(node);
    const isClickable = Boolean(node.ticker && security.clickable);

    flowNodes.push({
      id: node.id,
      position: {
        x: (layer - sortedLayers[0]) * xSpacing,
        y: currentY,
      },
      data: {
        ticker: node.ticker,
        securityType: getSecurityType(node),
        isClickable,
        label: (
          <div>
            <div style={{ fontWeight: "bold", fontSize: "15px" }}>
              {node.name || node.ticker || node.id}
            </div>
            <div style={{ fontSize: "12px", opacity: 0.8, marginTop: 4 }}>
              {node.role || ""}
            </div>
            {node.ticker && (
              <div
                style={{
                  display: "inline-block",
                  fontSize: "11px",
                  fontWeight: "800",
                  color: security.color,
                  background: "rgba(2, 6, 23, 0.72)",
                  border: `1px solid ${security.color}55`,
                  borderRadius: "999px",
                  padding: "2px 7px",
                  marginTop: 6,
                  opacity: 1,
                }}
              >
                {node.ticker}
              </div>
            )}
          </div>
        ),
      },
      style: {
        ...(isRoot ? rootNodeStyle : nodeBaseStyle),
        cursor: isClickable ? "pointer" : "default",
      },
      sourcePosition: "right",
      targetPosition: "left",
    });

    currentY += estimatedHeight + NODE_GAP_Y;
  });
});

  const flowEdges = rawEdges.map((edge, index) => ({
    id: edge.id || `${edge.source}-${edge.target}-${index}`,
    source: edge.source,
    target: edge.target,
    animated: false,
    markerEnd: { type: MarkerType.ArrowClosed },
    style: { strokeWidth: 2 },
  }));

  return { nodes: flowNodes, edges: flowEdges };
}

function convertChainToGraph(data) {
  const chain = Array.isArray(data?.chain) ? data.chain : [];
  const nodes = chain.map((node, index) => ({
    id: `${node.ticker || node.name || "node"}-${index}`,
    ticker: node.ticker,
    name: node.name || node.ticker,
    role: node.role,
    securityType: node.securityType,
    isPublicCompany: node.isPublicCompany,
  }));

  const edges = [];
  for (let i = 0; i < nodes.length - 1; i += 1) {
    edges.push({
      source: nodes[i].id,
      target: nodes[i + 1].id,
    });
  }

  const rootNode = nodes.find((n) => n.ticker === chain[chain.length - 1]?.ticker);

  return {
    name: data?.name,
    root: rootNode?.id || nodes[nodes.length - 1]?.id || null,
    nodes,
    edges,
  };
}

function convertUpstreamCenterDownstreamToGraph(data) {
  const upstream = Array.isArray(data?.upstream) ? data.upstream : [];
  const downstream = Array.isArray(data?.downstream) ? data.downstream : [];
  const center = data?.center || null;

  const centerId = center?.ticker || "center-node";

  const nodes = [
    ...upstream.map((node, index) => ({
      id: `up-${node.ticker || index}`,
      ticker: node.ticker,
      name: node.name || node.ticker,
      role: node.role,
      securityType: node.securityType,
      isPublicCompany: node.isPublicCompany,
    })),
    ...(center
      ? [
          {
            id: centerId,
            ticker: center.ticker,
            name: center.name || center.ticker,
            role: center.role,
            securityType: center.securityType,
            isPublicCompany: center.isPublicCompany,
          },
        ]
      : []),
    ...downstream.map((node, index) => ({
      id: `down-${node.ticker || index}`,
      ticker: node.ticker,
      name: node.name || node.ticker,
      role: node.role,
      securityType: node.securityType,
      isPublicCompany: node.isPublicCompany,
    })),
  ];

  const edges = [
    ...upstream.map((node, index) => ({
      source: `up-${node.ticker || index}`,
      target: centerId,
    })),
    ...downstream.map((node, index) => ({
      source: centerId,
      target: `down-${node.ticker || index}`,
    })),
  ];

  return {
    name: data?.name,
    root: centerId,
    nodes,
    edges,
  };
}

function normalizeToGraph(data) {
  if (!data) return { nodes: [], edges: [], root: null, name: "" };

  if (Array.isArray(data.nodes) && Array.isArray(data.edges)) {
    return data;
  }

  if (data.center || data.upstream || data.downstream) {
    return convertUpstreamCenterDownstreamToGraph(data);
  }

  if (Array.isArray(data.chain)) {
    return convertChainToGraph(data);
  }

  return { nodes: [], edges: [], root: null, name: data?.name || "" };
}

export default function SupplyChain({ onBuildStrategy }) {
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [legendOpen, setLegendOpen] = useState(true);

  const handleTickerClick = (ticker) => {
    if (!ticker) return;
    window.location.href = `/dashboard?tickers=${ticker}`;
  };

  const handleBuildSupplyChainStrategy = () => {
    if (!selectedCompany || !selectedData || !onBuildStrategy) return;

    const normalized = normalizeToGraph(selectedData);
    const allTickers = (normalized.nodes || [])
      .filter((node) => getSecurityMeta(node).clickable)
      .map((node) => node.ticker)
      .filter(Boolean)
      .map((ticker) => String(ticker).trim().toUpperCase());

    const uniqueTickers = [...new Set(allTickers)];

    if (!uniqueTickers.length) return;

    const rootTicker = String(selectedCompany).trim().toUpperCase();

    let positions = [];

    if (uniqueTickers.includes(rootTicker) && uniqueTickers.length > 1) {
      const satelliteTickers = uniqueTickers.filter((ticker) => ticker !== rootTicker);
      const satelliteWeight = 65 / satelliteTickers.length;

      positions = [
        { ticker: rootTicker, weight: 35 },
        ...satelliteTickers.map((ticker, index) => {
          const isLast = index === satelliteTickers.length - 1;
          const roundedWeight = Number(satelliteWeight.toFixed(2));
          const usedWeight = isLast
            ? Number((65 - roundedWeight * (satelliteTickers.length - 1)).toFixed(2))
            : roundedWeight;

          return {
            ticker,
            weight: usedWeight,
          };
        }),
      ];
    } else {
      const equalWeight = 100 / uniqueTickers.length;
      const roundedWeight = Number(equalWeight.toFixed(2));

      positions = uniqueTickers.map((ticker, index) => {
        const isLast = index === uniqueTickers.length - 1;
        const usedWeight = isLast
          ? Number((100 - roundedWeight * (uniqueTickers.length - 1)).toFixed(2))
          : roundedWeight;

        return {
          ticker,
          weight: usedWeight,
        };
      });
    }

    onBuildStrategy({
      name: `${selectedData?.name || selectedCompany} Supply Chain Basket`,
      mode: "portfolio",
      source: "Supply Chain",
      notes: `Generated from Supply Chain map for ${selectedData?.name || selectedCompany}.`,
      positions,
    });
  };

  const filteredCompanies = companies.filter((ticker) => {
    const companyName = supplyChainTree[ticker]?.name || ticker;
    return (
      companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ticker.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  const selectedData = selectedCompany ? supplyChainTree[selectedCompany] : null;

  const graphData = useMemo(() => {
    if (!selectedData) return { nodes: [], edges: [] };
    const normalized = normalizeToGraph(selectedData);
    return buildGraphFromNodesEdges(normalized);
  }, [selectedData]);

  const selectedRootSecurity = useMemo(() => {
    if (!selectedData) return SECURITY_META[SECURITY_TYPES.NON_PUBLIC];
    const normalized = normalizeToGraph(selectedData);
    const rootNode = (normalized.nodes || []).find(
      (node) => node.id === normalized.root
    );
    return getSecurityMeta(rootNode);
  }, [selectedData]);


  return (
    <div className="supply-chain-page" style={{ color: "white", padding: "20px" }}>
      <h1>DOW & Mega Cap Supply Chains</h1>

      {!selectedCompany ? (
        <>
          <p>Select a company to explore its supply chain</p>

          <input
            className="supply-chain-search-input"
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
              outline: "none",
            }}
          />

          <div
            className="supply-chain-company-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: "20px",
              marginTop: "30px",
            }}
          >
            {filteredCompanies.map((ticker) => (
              <div
  key={ticker}
  onClick={() => setSelectedCompany(ticker)}
  className="hover-glow supply-chain-company-card"
  style={{
    padding: "20px",
    background: "#1a2238",
    borderRadius: "8px",
    textAlign: "center",
    cursor: "pointer",
    fontWeight: "bold",
    border: "1px solid transparent",
  }}
>
                {supplyChainTree[ticker].name || ticker}
              </div>
            ))}

            {filteredCompanies.length === 0 && (
              <div
                style={{
                  gridColumn: "1 / -1",
                  textAlign: "center",
                  opacity: 0.5,
                }}
              >
                No companies found
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="supply-chain-selected-view" style={{ marginTop: "30px" }}>
          <button
            className="supply-chain-back-button"
            onClick={() => setSelectedCompany(null)}
            style={{
              marginBottom: "20px",
              padding: "10px 16px",
              borderRadius: "6px",
              border: "none",
              background: "#1a2238",
              color: "white",
              cursor: "pointer",
              fontWeight: "bold",
            }}
          >
            ← Back to Companies
          </button>

          <h1
            className="supply-chain-selected-title"
            style={{
              fontSize: "52px",
              fontWeight: "700",
              textAlign: "center",
              marginBottom: "8px",
            }}
          >
            {selectedData?.name || selectedCompany}
          </h1>

           <div
            className="supply-chain-selected-ticker"
            style={{
              textAlign: "center",
              color: selectedRootSecurity.color,
              fontWeight: "800",
              marginBottom: "20px",
            }}
          >
            {selectedCompany}
          </div>

          <div className="supply-chain-strategy-actions" style={{ textAlign: "center", marginBottom: "20px" }}>
            <button
              className="supply-chain-build-button"
              onClick={handleBuildSupplyChainStrategy}
              style={{
                padding: "10px 16px",
                background: "#19C37D",
                color: "#001f3f",
                border: "none",
                borderRadius: "8px",
                fontWeight: "800",
                cursor: "pointer"
              }}
            >
              Build Supply Chain Strategy
            </button>
          </div>

          <div
            className="supply-chain-flow-container"
            style={{
              height: "75vh",
              width: "100%",
              background: "#0f172a",
              borderRadius: "14px",
              overflow: "hidden",
              border: "1px solid #1f2937",
            }}
          >
            <ReactFlow
  nodes={graphData.nodes}
  edges={graphData.edges}
  fitView
  fitViewOptions={{ padding: 0.02 }}
  proOptions={{ hideAttribution: true }}

  nodesDraggable={false}
  nodesConnectable={false}
  elementsSelectable={false}

  zoomOnScroll={false}
  zoomOnPinch={true}
  zoomOnDoubleClick={false}
  panOnDrag={true}
  panOnScroll={true}

  minZoom={0.4}
  maxZoom={1.0}
  preventScrolling={false}
  onNodeClick={(_, node) => {
    if (node?.data?.isClickable && node?.data?.ticker) {
      handleTickerClick(node.data.ticker);
    }
  }}
>
  <Background />
  <Controls showInteractive={false} />

  <Panel position="bottom-right" style={{ margin: 14 }}>
    <div
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
      style={{
        width: legendOpen ? "310px" : "150px",
        background: "rgba(10, 15, 30, 0.96)",
        border: "1px solid #334155",
        borderRadius: "10px",
        boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
        overflow: "hidden",
      }}
    >
      <button
        type="button"
        onClick={() => setLegendOpen((open) => !open)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "12px",
          padding: "9px 11px",
          border: "none",
          background: "transparent",
          color: "white",
          cursor: "pointer",
          fontWeight: "800",
          fontSize: "12px",
          textAlign: "left",
        }}
        aria-expanded={legendOpen}
      >
        <span>Node Legend</span>
        <span style={{ opacity: 0.75 }}>{legendOpen ? "−" : "+"}</span>
      </button>

      {legendOpen && (
        <div
          style={{
            borderTop: "1px solid #263244",
            padding: "8px 11px 10px",
          }}
        >
          {LEGEND_ITEMS.map((item) => (
            <div
              key={item.label}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "9px",
                margin: "7px 0",
              }}
            >
              <span
                style={{
                  width: "12px",
                  height: "12px",
                  borderRadius: "3px",
                  background: item.color,
                  flex: "0 0 12px",
                  boxShadow: `0 0 8px ${item.color}55`,
                }}
              />
              <span
                style={{
                  color: "#E5E7EB",
                  fontSize: "11px",
                  lineHeight: 1.25,
                }}
              >
                {item.label}
                {!item.clickable && (
                  <span style={{ color: "#94A3B8" }}> — not clickable</span>
                )}
              </span>
            </div>
          ))}

          <div
            style={{
              marginTop: "8px",
              paddingTop: "8px",
              borderTop: "1px solid #263244",
              color: "#94A3B8",
              fontSize: "10px",
              lineHeight: 1.35,
            }}
          >
            Colored ticker pills identify security type. Only publicly traded
            company nodes can open the stock dashboard.
          </div>
        </div>
      )}
    </div>
  </Panel>
</ReactFlow>
          </div>
        </div>
      )}
    </div>
  );
}