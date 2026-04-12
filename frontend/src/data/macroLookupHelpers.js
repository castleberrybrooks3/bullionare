export function summarizeTickerMacroExposure(exposures = []) {
  return exposures
    .map((entry) => {
      const pathText = entry.path.map((p) => `${p.name} ${p.direction === "up" ? "↑" : "↓"}`).join(" → ");

      return {
        macro: entry.macro,
        macroDirection: entry.macroDirection,
        finalDirection: entry.finalDirection,
        confidence: entry.confidence ?? 0,
        pathText,
        why:
          entry.whyShort ||
          entry.whyLong ||
          `${entry.macro} ${entry.macroDirection} flows through ${entry.terminalNode} and affects the stock ${entry.finalDirection}.`
      };
    })
    .sort((a, b) => b.confidence - a.confidence);
}