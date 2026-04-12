import React, { useMemo, useState } from "react";
import supplyChainTree from "./data/supplyChainTree";
import ReactFlow, {
  Background,
  Controls,
  MarkerType,
} from "reactflow";
import "reactflow/dist/style.css";

const companies = Object.keys(supplyChainTree);

const nodeBaseStyle = {
  background: "#1a2238",
  color: "white",
  border: "1px solid transparent",
  borderRadius: "12px",
  padding: "10px 14px",
  minWidth: 170,
  textAlign: "center",
  boxShadow: "0 4px 14px rgba(0,0,0,0.25)",
  cursor: "pointer",
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

function buildGraphFromNodesEdges(data, onTickerClick) {
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

  const xSpacing = 280;
  const ySpacing = 130;

  const flowNodes = [];
  sortedLayers.forEach((layer) => {
    const nodesInLayer = columns[layer];
    const totalHeight = (nodesInLayer.length - 1) * ySpacing;
    const startY = -totalHeight / 2;

    nodesInLayer.forEach((node, index) => {
      const isRoot = node.id === rootId;
      flowNodes.push({
        id: node.id,
        position: {
          x: (layer - sortedLayers[0]) * xSpacing,
          y: startY + index * ySpacing,
        },
        data: {
  ticker: node.ticker,
  label: (
    <div>
      <div style={{ fontWeight: "bold", fontSize: "15px" }}>
        {node.name || node.ticker || node.id}
      </div>
      <div style={{ fontSize: "12px", opacity: 0.8, marginTop: 4 }}>
        {node.role || ""}
      </div>
      {node.ticker && (
        <div style={{ fontSize: "11px", opacity: 0.6, marginTop: 4 }}>
          {node.ticker}
        </div>
      )}
    </div>
  ),
},
        style: isRoot ? rootNodeStyle : nodeBaseStyle,
        sourcePosition: "right",
        targetPosition: "left",
      });
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
    })),
    ...(center
      ? [
          {
            id: centerId,
            ticker: center.ticker,
            name: center.name || center.ticker,
            role: center.role,
          },
        ]
      : []),
    ...downstream.map((node, index) => ({
      id: `down-${node.ticker || index}`,
      ticker: node.ticker,
      name: node.name || node.ticker,
      role: node.role,
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

export default function SupplyChain() {
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");

  const handleTickerClick = (ticker) => {
    if (!ticker) return;
    window.location.href = `/dashboard?tickers=${ticker}`;
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
    return buildGraphFromNodesEdges(normalized, handleTickerClick);
  }, [selectedData]);

  return (
    <div style={{ color: "white", padding: "20px" }}>
      <h1>DOW & Mega Cap Supply Chains</h1>

      {!selectedCompany ? (
        <>
          <p>Select a company to explore its supply chain</p>

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
              outline: "none",
            }}
          />

          <div
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
  className="hover-glow"
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
        <div style={{ marginTop: "30px" }}>
          <button
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
            style={{
              textAlign: "center",
              opacity: 0.7,
              marginBottom: "20px",
            }}
          >
            {selectedCompany}
          </div>

          <div
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
  fitViewOptions={{ padding: 0.05 }}
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
    if (node?.data?.ticker) {
      handleTickerClick(node.data.ticker);
    }
  }}
>
  <Background />
  <Controls showInteractive={false} />
</ReactFlow>
          </div>
        </div>
      )}
    </div>
  );
}