import dependencyTree from "./macroDependencyTree";

function walkNode({
  macro,
  macroDirection,
  node,
  path = [],
  results
}) {
  const currentPath = [
    ...path,
    {
      name: node.name,
      direction: node.direction,
      confidence: node.confidence ?? null,
      magnitude: node.magnitude ?? null,
      speed: node.speed ?? null,
      whyShort: node.whyShort ?? "",
      whyLong: node.whyLong ?? "",
      order: node.order ?? null
    }
  ];

  if (Array.isArray(node.stocks) && node.stocks.length > 0) {
    node.stocks.forEach((ticker) => {
      if (!results[ticker]) results[ticker] = [];

      results[ticker].push({
        macro,
        macroDirection,
        finalDirection: node.direction,
        path: currentPath,
        confidence: node.confidence ?? null,
        magnitude: node.magnitude ?? null,
        speed: node.speed ?? null,
        whyShort: node.whyShort ?? "",
        whyLong: node.whyLong ?? "",
        order: node.order ?? null,
        terminalNode: node.name
      });
    });
  }

  if (Array.isArray(node.next) && node.next.length > 0) {
    node.next.forEach((child) => {
      walkNode({
        macro,
        macroDirection,
        node: child,
        path: currentPath,
        results
      });
    });
  }
}

export function buildReverseMacroMap() {
  const results = {};

  Object.entries(dependencyTree).forEach(([macro, directions]) => {
    ["up", "down"].forEach((macroDirection) => {
      const rootNodes = directions?.[macroDirection] || [];

      rootNodes.forEach((node) => {
        walkNode({
          macro,
          macroDirection,
          node,
          path: [],
          results
        });
      });
    });
  });

  return results;
}