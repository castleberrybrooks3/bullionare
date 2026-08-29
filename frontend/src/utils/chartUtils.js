export const formatChartTimeLabel = (timestamp, range) => {
  if (timestamp == null) return "";

  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) return "";

  // Intraday: time only
  if (range === "1D") {
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  }

  // 5D + 1M: date AND time
  if (range === "5D" || range === "1M") {
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  // Medium ranges: date
  if (range === "6M" || range === "1Y") {
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  // Long ranges
  if (range === "5Y" || range === "Max") {
    return date.toLocaleDateString("en-US", {
      month: "short",
      year: "numeric",
    });
  }

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

export const getChartPerformance = (points = []) => {
  if (!points.length) return null;

  const first = points[0]?.close;
  const last = points[points.length - 1]?.close;

  if (first == null || last == null) return null;

  const change = last - first;
  const pct = first !== 0 ? (change / first) * 100 : 0;

  return {
    change,
    pct,
    isUp: change >= 0,
  };
};