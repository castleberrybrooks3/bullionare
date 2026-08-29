const toNumber = (value) => {
  if (value == null || value === "") return null;

  const cleaned =
    typeof value === "string"
      ? value.replace(/[$,%]/g, "").replace(/,/g, "")
      : value;

  const num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
};

const pickNumber = (obj, keys = []) => {
  if (!obj) return null;

  for (const key of keys) {
    const value = toNumber(obj[key]);
    if (value != null) return value;
  }

  return null;
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const getSector = (stock = {}) => {
  return (
    stock.sector ||
    stock.Sector ||
    stock.gics_sector ||
    stock.gicsSector ||
    stock.industry_sector ||
    ""
  )
    .toString()
    .toLowerCase();
};

const getSectorPeBands = (sector = "") => {
  if (
    sector.includes("technology") ||
    sector.includes("communication") ||
    sector.includes("software") ||
    sector.includes("semiconductor")
  ) {
    return {
      veryCheap: 18,
      cheap: 28,
      fair: 45,
      elevated: 65,
      expensive: 90,
    };
  }

  if (
    sector.includes("health") ||
    sector.includes("consumer cyclical") ||
    sector.includes("consumer discretionary")
  ) {
    return {
      veryCheap: 15,
      cheap: 25,
      fair: 38,
      elevated: 55,
      expensive: 75,
    };
  }

  if (
    sector.includes("industrials") ||
    sector.includes("financial") ||
    sector.includes("basic materials")
  ) {
    return {
      veryCheap: 12,
      cheap: 18,
      fair: 28,
      elevated: 40,
      expensive: 60,
    };
  }

  if (
    sector.includes("consumer defensive") ||
    sector.includes("consumer staples") ||
    sector.includes("utilities") ||
    sector.includes("real estate")
  ) {
    return {
      veryCheap: 10,
      cheap: 16,
      fair: 25,
      elevated: 35,
      expensive: 50,
    };
  }

  if (sector.includes("energy")) {
    return {
      veryCheap: 8,
      cheap: 12,
      fair: 20,
      elevated: 30,
      expensive: 45,
    };
  }

  return {
    veryCheap: 12,
    cheap: 20,
    fair: 32,
    elevated: 48,
    expensive: 70,
  };
};

// This is the key missing-data fix.
// It makes available categories stronger when other categories are missing.
const scaledDeltaScore = ({ components = [], dividendBonus = 0 }) => {
  const availableComponents = components.filter((component) => component.available);

  if (!availableComponents.length) {
    return {
      score: 50,
      usedWeight: 0,
      totalPossibleWeight: 50,
      rawDelta: 0,
      scaledDelta: 0,
    };
  }

  const usedWeight = availableComponents.reduce(
    (sum, component) => sum + component.maxAbs,
    0
  );

  const rawDelta = availableComponents.reduce(
    (sum, component) => sum + component.delta,
    0
  );

  // Normal total possible points:
  // P/E 13 + EPS 7 + Gross Profit 5 + Growth 10 + Analyst 15 = 50
  const totalPossibleWeight = components.reduce(
    (sum, component) => sum + component.maxAbs,
    0
  );

  // If only some categories are available, stretch those categories
  // across the full 50-point scoring range.
  const scaledDelta =
    usedWeight > 0 ? (rawDelta / usedWeight) * totalPossibleWeight : 0;

  const score = clamp(Math.round(50 + scaledDelta + dividendBonus), 15, 96);

  return {
    score,
    usedWeight,
    totalPossibleWeight,
    rawDelta,
    scaledDelta,
  };
};

export const buildValueGrowthSetup = (stock = {}) => {
  if (!stock) {
    return {
      score: null,
      label: "No Fundamental Data",
      summary: "No dashboard or stock-analysis fundamental data is available yet.",
      positives: [],
      warnings: [],
      componentScores: {},
      metrics: {},
    };
  }

  const sector = getSector(stock);
  const peBands = getSectorPeBands(sector);

  const pe = pickNumber(stock, [
  "P/E (TTM)",
  "P/E",
  "pe",
  "p_e",
  "pe_ratio",
  "trailing_pe",
  "price_earnings",
  "priceEarnings",
  "price_to_earnings",
  "trailingPE",
  "Trailing P/E",
]);

  const eps = pickNumber(stock, [
  "EPS (TTM)",
  "EPS",
  "eps",
  "diluted_eps",
  "earnings_per_share",
  "epsDiluted",
  "Diluted EPS",
]);

  const dividendYield = pickNumber(stock, [
  "Dividend Yield",
  "dividend_yield",
  "dividendYield",
  "yield",
]);

  const revenueGrowth = pickNumber(stock, [
    "revenue_growth",
    "revenue_growth_yoy",
    "revenueYoY",
    "revenue_yoy",
    "sales_growth",
    "revenueGrowth",
    "Revenue YoY",
  ]);

  const netIncomeGrowth = pickNumber(stock, [
    "net_income_growth",
    "net_income_growth_yoy",
    "netIncomeYoY",
    "earnings_growth",
    "eps_growth",
    "netIncomeGrowth",
    "Net Income YoY",
  ]);

  const analystTarget = pickNumber(stock, [
  "Mean Target",
  "Analyst Target",
  "Average Analyst Target",
  "analyst_target",
  "analystTarget",
  "target_price",
  "price_target",
  "avg_price_target",
  "analystPriceTarget",
]);

  const analystDownside = pickNumber(stock, [
  "Analyst Downside",
  "analyst_downside",
  "analystDownside",
  "downside",
]);

  const analystCount = pickNumber(stock, [
  "Number of Analysts",
  "Analyst Count",
  "analyst_count",
  "analystCount",
  "num_analysts",
  "analysts",
  "analystRatings",
]);

  const price = pickNumber(stock, [
  "Current Price",
  "Price",
  "price",
  "last_price",
  "current_price",
  "close",
  "regularMarketPrice",
]);

  const beta = pickNumber(stock, [
  "Beta",
  "beta",
]);

  const positives = [];
  const warnings = [];

  let peDelta = 0;
  let epsDelta = 0;
  let growthDelta = 0;
  let analystDelta = 0;
  let dividendBonus = 0;

  let hasPe = false;
  let hasEps = false;
  let hasGrowth = false;
  let hasAnalystSetup = false;

  // -----------------------------
  // P/E: +/- 13 possible points
  // Missing P/E does not penalize.
  // -----------------------------
  if (pe != null && pe > 0) {
    hasPe = true;

    const sectorLabel = sector ? ` for its sector` : "";

    if (pe <= peBands.veryCheap) {
      peDelta = 13;
      positives.push(`P/E is very attractive${sectorLabel} at ${pe.toFixed(1)}.`);
    } else if (pe <= peBands.cheap) {
      peDelta = 9;
      positives.push(`P/E is attractive${sectorLabel} at ${pe.toFixed(1)}.`);
    } else if (pe <= peBands.fair) {
      peDelta = 4;
      positives.push(`P/E is reasonable${sectorLabel} at ${pe.toFixed(1)}.`);
    } else if (pe <= peBands.elevated) {
      peDelta = 0;
      positives.push(`P/E is elevated at ${pe.toFixed(1)}, but still tolerable for this sector.`);
    } else if (pe <= peBands.expensive) {
      peDelta = -7;
      warnings.push(`P/E is high${sectorLabel} at ${pe.toFixed(1)}.`);
    } else {
      peDelta = -13;
      warnings.push(`P/E is extremely high${sectorLabel} at ${pe.toFixed(1)}.`);
    }
  } else {
    positives.push("P/E is unavailable, so it is excluded from the Entry Setup score.");
  }

  // -----------------------------
  // EPS: +/- 7 possible points
  // Missing EPS does not penalize.
  // -----------------------------
  if (eps != null) {
    hasEps = true;

    if (eps > 20) {
      epsDelta = 7;
      positives.push(`EPS is very strong at ${eps.toFixed(2)}.`);
    } else if (eps > 10) {
      epsDelta = 5;
      positives.push(`EPS is strong at ${eps.toFixed(2)}.`);
    } else if (eps > 5) {
      epsDelta = 3;
      positives.push(`EPS is solid at ${eps.toFixed(2)}.`);
    } else if (eps > 0) {
      epsDelta = 1;
      positives.push(`EPS is positive at ${eps.toFixed(2)}.`);
    } else {
      epsDelta = -3;
      warnings.push("EPS is negative, which is a small profitability warning.");
    }
  } else {
    positives.push("EPS is unavailable, so it is excluded from the Entry Setup score.");
  }

  // -----------------------------
  // Dividend: +0 to +4 bonus only
  // No dividend never hurts.
  // -----------------------------
  if (dividendYield != null && dividendYield > 0) {
    if (dividendYield >= 5) {
      dividendBonus = 4;
      positives.push(`Dividend yield adds the full bonus at ${dividendYield.toFixed(2)}%.`);
    } else if (dividendYield >= 2) {
      dividendBonus = 3;
      positives.push(`Dividend yield adds a solid bonus at ${dividendYield.toFixed(2)}%.`);
    } else {
      dividendBonus = 1;
      positives.push(`Dividend yield adds a small bonus at ${dividendYield.toFixed(2)}%.`);
    }
  }

  // -----------------------------
  // Growth: +/- 10 possible points
  // Uses average of revenue growth and net income growth when available.
  // Missing growth does not penalize.
  // -----------------------------
  const growthDeltas = [];

  if (revenueGrowth != null) {
    if (revenueGrowth >= 50) {
      growthDeltas.push(10);
      positives.push(`Revenue growth is massive at ${revenueGrowth.toFixed(1)}%.`);
    } else if (revenueGrowth >= 30) {
      growthDeltas.push(7);
      positives.push(`Revenue growth is strong at ${revenueGrowth.toFixed(1)}%.`);
    } else if (revenueGrowth >= 15) {
      growthDeltas.push(3);
      positives.push(`Revenue growth is positive at ${revenueGrowth.toFixed(1)}%.`);
    } else if (revenueGrowth >= 0) {
      growthDeltas.push(0);
    } else {
      growthDeltas.push(-6);
      warnings.push(`Revenue growth is negative at ${revenueGrowth.toFixed(1)}%.`);
    }
  }

  if (netIncomeGrowth != null) {
    if (netIncomeGrowth >= 50) {
      growthDeltas.push(10);
      positives.push(`Net income growth is massive at ${netIncomeGrowth.toFixed(1)}%.`);
    } else if (netIncomeGrowth >= 30) {
      growthDeltas.push(7);
      positives.push(`Net income growth is strong at ${netIncomeGrowth.toFixed(1)}%.`);
    } else if (netIncomeGrowth >= 15) {
      growthDeltas.push(3);
      positives.push(`Net income growth is positive at ${netIncomeGrowth.toFixed(1)}%.`);
    } else if (netIncomeGrowth >= 0) {
      growthDeltas.push(0);
    } else {
      growthDeltas.push(-6);
      warnings.push(`Net income growth is negative at ${netIncomeGrowth.toFixed(1)}%.`);
    }
  }

  if (growthDeltas.length) {
    hasGrowth = true;
    growthDelta = Math.round(
      growthDeltas.reduce((sum, value) => sum + value, 0) / growthDeltas.length
    );
  } else {
    positives.push("Growth data is unavailable, so it is excluded from the Entry Setup score.");
  }

  // -----------------------------
  // Analyst setup: +/- 15 possible points
  // ONLY analyst target downside/upside counts.
  // Requires more than 10 analysts.
  // If not more than 10 analysts, analyst category is excluded and redistributed.
  // -----------------------------
  let targetUpside = null;

  const hasCredibleAnalystCoverage =
    analystCount != null && analystCount > 10;

  if (analystCount != null) {
    if (analystCount > 20) {
      positives.push(`${analystCount.toFixed(0)} analysts cover the stock, giving the target strong credibility.`);
    } else if (analystCount > 10) {
      positives.push(`${analystCount.toFixed(0)} analysts cover the stock, enough to count analyst target downside/upside.`);
    } else {
      positives.push("Analyst coverage is 10 or below, so analyst target downside/upside is excluded from the Entry Setup score.");
    }
  } else {
    positives.push("Analyst count is unavailable, so analyst target downside/upside is excluded from the Entry Setup score.");
  }

  if (analystDownside != null) {
  targetUpside = analystDownside;
} else if (
  price != null &&
  price > 0 &&
  analystTarget != null &&
  analystTarget > 0
) {
  targetUpside = ((analystTarget - price) / price) * 100;
}

  if (
  targetUpside != null &&
  hasCredibleAnalystCoverage
) {
  hasAnalystSetup = true;

  if (targetUpside >= 20) {
    analystDelta = 20;
    positives.push(`Analyst target upside is extremely strong at ${targetUpside.toFixed(1)}%, giving the full analyst score.`);
  } else if (targetUpside >= 10) {
    analystDelta = 16;
    positives.push(`Analyst target upside is very strong at ${targetUpside.toFixed(1)}%, giving a huge analyst boost.`);
  } else if (targetUpside >= 0) {
    analystDelta = 8;
    positives.push(`Analyst target is above the current price by ${targetUpside.toFixed(1)}%, which is a solid analyst setup.`);
  } else if (targetUpside >= -10) {
    analystDelta = 1;
    positives.push(`Analyst target is only ${Math.abs(targetUpside).toFixed(1)}% below current price, which still gets a small positive analyst score.`);
  } else if (targetUpside >= -20) {
    analystDelta = -4;
    warnings.push(`Analyst target implies small downside at ${targetUpside.toFixed(1)}%.`);
  } else if (targetUpside >= -30) {
    analystDelta = -9;
    warnings.push(`Analyst target implies decent downside at ${targetUpside.toFixed(1)}%.`);
  } else if (targetUpside >= -40) {
    analystDelta = -14;
    warnings.push(`Analyst target implies major downside at ${targetUpside.toFixed(1)}%.`);
  } else {
    analystDelta = -20;
    warnings.push(`Analyst target implies severe downside at ${targetUpside.toFixed(1)}%, giving the full analyst penalty.`);
  }
} else if (targetUpside != null && !hasCredibleAnalystCoverage) {
    positives.push(
      `Analyst target implies ${targetUpside.toFixed(1)}% upside/downside, but analyst coverage is not above 10, so this category is excluded.`
    );
  } else {
    positives.push("Analyst target downside/upside is unavailable, so it is excluded from the Entry Setup score.");
  }

  if (beta != null && beta > 2) {
    warnings.push(`Beta is high at ${beta.toFixed(2)}, so volatility risk is elevated.`);
  }

  const scoreResult = scaledDeltaScore({
  components: [
    {
      key: "P/E",
      delta: peDelta,
      maxAbs: 13,
      available: hasPe,
    },
    {
      key: "EPS",
      delta: epsDelta,
      maxAbs: 7,
      available: hasEps,
    },
    {
      key: "Growth",
      delta: growthDelta,
      maxAbs: 10,
      available: hasGrowth,
    },
    {
      key: "Analyst Setup",
      delta: analystDelta,
      maxAbs: 20,
      available: hasAnalystSetup,
    },
  ],
  dividendBonus,
});

  const score = clamp(scoreResult.score, 15, 96);

  let label = "Neutral Fundamentals";

if (score >= 85) label = "Elite Fundamentals";
else if (score >= 72) label = "Strong Fundamentals";
else if (score >= 60) label = "Decent Fundamentals";
else if (score >= 50) label = "Neutral Fundamentals";
else if (score >= 35) label = "Weak Fundamentals";
else label = "Poor Fundamentals";

  const summary =
    label === "Elite Fundamentals"
      ? "Fundamentals are exceptionally strong because valuation, growth, EPS, gross profit, and/or analyst target setup are heavily supporting the entry."
      : label === "Strong Fundamentals"
      ? "Fundamentals strongly support the entry because the available valuation, EPS, gross profit, growth, and/or analyst target data is attractive."
      : label === "Decent Fundamentals"
      ? "Fundamentals are decent, but not strong enough to make the entry obvious by themselves."
      : label === "Weak Fundamentals"
      ? "Fundamentals are not strongly supporting the entry right now because valuation, analyst downside, EPS, growth, or gross profit is working against it."
      : "Fundamentals are mixed, with no clear advantage or major warning from the available valuation, earnings, analyst target, and growth data.";

  return {
    score,
    label,
    summary,
    positives: positives.slice(0, 5),
    warnings: warnings.slice(0, 5),
    componentScores: {
  baseScore: 50,
  peDelta,
  epsDelta,
  growthDelta,
  analystDelta,
  dividendBonus,
  rawDelta: scoreResult.rawDelta,
  scaledDelta: scoreResult.scaledDelta,
  usedWeight: scoreResult.usedWeight,
  totalPossibleWeight: scoreResult.totalPossibleWeight,
  hasPe,
  hasEps,
  hasGrowth,
  hasAnalystSetup,
},
    metrics: {
      sector,
      pe,
      eps,
      dividendYield,
      revenueGrowth,
      netIncomeGrowth,
      analystTarget,
      analystDownside,
      analystCount,
      price,
      targetUpside,
      beta,
    },
  };
};

export const combineEntryAndValueGrowthSetup = (
  technicalSummary,
  valueGrowthSetup
) => {
  if (!technicalSummary) return technicalSummary;

  const technicalEntryScore = technicalSummary.entryScore;

  const hasFundamentalScore =
    valueGrowthSetup?.score != null &&
    Number.isFinite(Number(valueGrowthSetup.score));

  if (technicalEntryScore == null || !hasFundamentalScore) {
    return {
      ...technicalSummary,
      entrySummary: `${
        technicalSummary.entrySummary || ""
      } Fundamental context was not available, so this entry score is based mostly on chart timing.`,
    };
  }

  const combinedEntryScore = clamp(
    Math.round(technicalEntryScore * 0.1 + valueGrowthSetup.score * 0.9),
    15,
    96
  );

  let combinedEntryLabel = "Neutral Entry";

if (combinedEntryScore >= 85) {
  combinedEntryLabel = "Elite Entry";
} else if (combinedEntryScore >= 72) {
  combinedEntryLabel = "Attractive Entry";
} else if (combinedEntryScore >= 60) {
  combinedEntryLabel = "Decent Entry";
} else if (combinedEntryScore >= 50) {
  combinedEntryLabel = "Neutral Entry";
} else if (combinedEntryScore >= 35) {
  combinedEntryLabel = "Risky Entry";
} else {
  combinedEntryLabel = "Poor Entry";
}

  const combinedEntrySummary =
  `${valueGrowthSetup.summary || ""} ${technicalSummary.entrySummary || ""}`.trim();

return {
  ...technicalSummary,

  entryScore: combinedEntryScore,
  entryLabel: combinedEntryLabel,
  entrySummary: combinedEntrySummary,

  technicalEntryScore,
  valueGrowthScore: valueGrowthSetup.score,
  valueGrowthLabel: valueGrowthSetup.label,
  valueGrowthComponentScores: valueGrowthSetup.componentScores,
  valueGrowthMetrics: valueGrowthSetup.metrics,

  entryPositives: [
    ...(technicalSummary.entryPositives || []),
    ...(valueGrowthSetup.positives || []),
  ].slice(0, 6),

  entryWarnings: [
    ...(technicalSummary.entryWarnings || []),
    ...(valueGrowthSetup.warnings || []),
  ].slice(0, 6),
};
};