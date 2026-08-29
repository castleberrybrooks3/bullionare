const toNumber = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

export const calculateSMA = (points = [], period = 20) => {
  return points.map((point, index) => {
    if (index < period - 1) return null;

    const slice = points.slice(index - period + 1, index + 1);
    const closes = slice.map((p) => toNumber(p.close)).filter((v) => v != null);

    if (closes.length < period) return null;

    const sum = closes.reduce((acc, value) => acc + value, 0);
    return sum / period;
  });
};

export const calculateEMA = (points = [], period = 21) => {
  const multiplier = 2 / (period + 1);
  let previousEma = null;

  return points.map((point, index) => {
    const close = toNumber(point.close);
    if (close == null) return null;

    if (index < period - 1) return null;

    if (previousEma == null) {
      const slice = points.slice(index - period + 1, index + 1);
      const closes = slice.map((p) => toNumber(p.close)).filter((v) => v != null);

      if (closes.length < period) return null;

      previousEma = closes.reduce((acc, value) => acc + value, 0) / period;
      return previousEma;
    }

    previousEma = close * multiplier + previousEma * (1 - multiplier);
    return previousEma;
  });
};

export const calculateBollingerBands = (points = [], period = 20, standardDeviations = 2) => {
  return points.map((point, index) => {
    if (index < period - 1) {
      return {
        middle: null,
        upper: null,
        lower: null,
      };
    }

    const slice = points.slice(index - period + 1, index + 1);
    const closes = slice.map((p) => toNumber(p.close)).filter((v) => v != null);

    if (closes.length < period) {
      return {
        middle: null,
        upper: null,
        lower: null,
      };
    }

    const mean = closes.reduce((acc, value) => acc + value, 0) / period;

    const variance =
      closes.reduce((acc, value) => acc + Math.pow(value - mean, 2), 0) / period;

    const standardDeviation = Math.sqrt(variance);

    return {
      middle: mean,
      upper: mean + standardDeviation * standardDeviations,
      lower: mean - standardDeviation * standardDeviations,
    };
  });
};

export const calculateVWAP = (points = []) => {
  let cumulativePriceVolume = 0;
  let cumulativeVolume = 0;

  return points.map((point) => {
    const high = toNumber(point.high);
    const low = toNumber(point.low);
    const close = toNumber(point.close);
    const volume = toNumber(point.volume);

    if (high == null || low == null || close == null || volume == null || volume <= 0) {
      return null;
    }

    const typicalPrice = (high + low + close) / 3;

    cumulativePriceVolume += typicalPrice * volume;
    cumulativeVolume += volume;

    if (cumulativeVolume <= 0) return null;

    return cumulativePriceVolume / cumulativeVolume;
  });
};

export const calculateRSI = (points = [], period = 14) => {
  const rsiValues = Array(points.length).fill(null);

  if (points.length < period + 1) return rsiValues;

  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const currentClose = toNumber(points[i]?.close);
    const previousClose = toNumber(points[i - 1]?.close);

    if (currentClose == null || previousClose == null) continue;

    const change = currentClose - previousClose;

    if (change >= 0) gains += change;
    else losses += Math.abs(change);
  }

  let averageGain = gains / period;
  let averageLoss = losses / period;

  rsiValues[period] =
    averageLoss === 0 ? 100 : 100 - 100 / (1 + averageGain / averageLoss);

  for (let i = period + 1; i < points.length; i++) {
    const currentClose = toNumber(points[i]?.close);
    const previousClose = toNumber(points[i - 1]?.close);

    if (currentClose == null || previousClose == null) continue;

    const change = currentClose - previousClose;
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? Math.abs(change) : 0;

    averageGain = (averageGain * (period - 1) + gain) / period;
    averageLoss = (averageLoss * (period - 1) + loss) / period;

    rsiValues[i] =
      averageLoss === 0 ? 100 : 100 - 100 / (1 + averageGain / averageLoss);
  }

  return rsiValues;
};

const calculateEMAFromValues = (values = [], period = 12) => {
  const result = Array(values.length).fill(null);
  const multiplier = 2 / (period + 1);
  let previousEma = null;

  for (let i = 0; i < values.length; i++) {
    const value = toNumber(values[i]);
    if (value == null) continue;

    if (i < period - 1) continue;

    if (previousEma == null) {
      const slice = values.slice(i - period + 1, i + 1);
      const clean = slice.map(toNumber).filter((v) => v != null);

      if (clean.length < period) continue;

      previousEma = clean.reduce((acc, v) => acc + v, 0) / period;
      result[i] = previousEma;
      continue;
    }

    previousEma = value * multiplier + previousEma * (1 - multiplier);
    result[i] = previousEma;
  }

  return result;
};

export const calculateMACD = (
  points = [],
  fastPeriod = 12,
  slowPeriod = 26,
  signalPeriod = 9
) => {
  const closes = points.map((p) => toNumber(p.close));

  const fastEma = calculateEMAFromValues(closes, fastPeriod);
  const slowEma = calculateEMAFromValues(closes, slowPeriod);

  const macdLine = closes.map((_, index) => {
    if (fastEma[index] == null || slowEma[index] == null) return null;
    return fastEma[index] - slowEma[index];
  });

  const signalLine = calculateEMAFromValues(macdLine, signalPeriod);

  const histogram = macdLine.map((value, index) => {
    if (value == null || signalLine[index] == null) return null;
    return value - signalLine[index];
  });

  return {
    macdLine,
    signalLine,
    histogram,
  };
};

export const calculateATR = (points = [], period = 14) => {
  const trueRanges = points.map((point, index) => {
    const high = toNumber(point.high);
    const low = toNumber(point.low);
    const previousClose = index > 0 ? toNumber(points[index - 1]?.close) : null;

    if (high == null || low == null) return null;

    if (previousClose == null) return high - low;

    return Math.max(
      high - low,
      Math.abs(high - previousClose),
      Math.abs(low - previousClose)
    );
  });

  const atrValues = Array(points.length).fill(null);

  for (let i = period - 1; i < trueRanges.length; i++) {
    const slice = trueRanges.slice(i - period + 1, i + 1);
    const clean = slice.filter((v) => v != null);

    if (clean.length < period) continue;

    atrValues[i] = clean.reduce((acc, v) => acc + v, 0) / period;
  }

  return atrValues;
};

export const calculateStochastic = (points = [], period = 14) => {
  return points.map((point, index) => {
    if (index < period - 1) return null;

    const slice = points.slice(index - period + 1, index + 1);

    const highs = slice.map((p) => toNumber(p.high)).filter((v) => v != null);
    const lows = slice.map((p) => toNumber(p.low)).filter((v) => v != null);
    const close = toNumber(point.close);

    if (!highs.length || !lows.length || close == null) return null;

    const highestHigh = Math.max(...highs);
    const lowestLow = Math.min(...lows);

    if (highestHigh === lowestLow) return null;

    return ((close - lowestLow) / (highestHigh - lowestLow)) * 100;
  });
};

export const calculateOBV = (points = []) => {
  let obv = 0;

  return points.map((point, index) => {
    const close = toNumber(point.close);
    const previousClose = index > 0 ? toNumber(points[index - 1]?.close) : null;
    const volume = toNumber(point.volume) || 0;

    if (index === 0 || close == null || previousClose == null) {
      return obv;
    }

    if (close > previousClose) obv += volume;
    else if (close < previousClose) obv -= volume;

    return obv;
  });
};

export const calculateChaikinMoneyFlow = (points = [], period = 20) => {
  return points.map((point, index) => {
    if (index < period - 1) return null;

    const slice = points.slice(index - period + 1, index + 1);

    let moneyFlowVolumeSum = 0;
    let volumeSum = 0;

    slice.forEach((p) => {
      const high = toNumber(p.high);
      const low = toNumber(p.low);
      const close = toNumber(p.close);
      const volume = toNumber(p.volume);

      if (
        high == null ||
        low == null ||
        close == null ||
        volume == null ||
        volume <= 0 ||
        high === low
      ) {
        return;
      }

      const moneyFlowMultiplier = ((close - low) - (high - close)) / (high - low);
      const moneyFlowVolume = moneyFlowMultiplier * volume;

      moneyFlowVolumeSum += moneyFlowVolume;
      volumeSum += volume;
    });

    if (volumeSum === 0) return null;

    return moneyFlowVolumeSum / volumeSum;
  });
};

export const enrichChartPointsWithTechnicals = (points = []) => {
  const sma20 = calculateSMA(points, 20);
  const sma50 = calculateSMA(points, 50);
  const sma100 = calculateSMA(points, 100);
  const sma200 = calculateSMA(points, 200);

  const ema9 = calculateEMA(points, 9);
  const ema21 = calculateEMA(points, 21);

  const bollinger = calculateBollingerBands(points, 20, 2);
  const vwap = calculateVWAP(points);

  const rsi14 = calculateRSI(points, 14);
  const macd = calculateMACD(points, 12, 26, 9);
  const atr14 = calculateATR(points, 14);
  const stochastic14 = calculateStochastic(points, 14);
  const obv = calculateOBV(points);
  const cmf20 = calculateChaikinMoneyFlow(points, 20);

  return points.map((point, index) => ({
    ...point,

    sma20: sma20[index],
    sma50: sma50[index],
    sma100: sma100[index],
    sma200: sma200[index],

    ema9: ema9[index],
    ema21: ema21[index],

    bollingerMiddle: bollinger[index]?.middle ?? null,
    bollingerUpper: bollinger[index]?.upper ?? null,
    bollingerLower: bollinger[index]?.lower ?? null,

    vwap: vwap[index],

    rsi14: rsi14[index],
    macdLine: macd.macdLine[index],
    macdSignal: macd.signalLine[index],
    macdHistogram: macd.histogram[index],

    atr14: atr14[index],
    stochastic14: stochastic14[index],
    obv: obv[index],
    cmf20: cmf20[index],
  }));
};

export const findRecentSupportResistance = (points = [], lookback = 80) => {
  const cleanPoints = points
    .filter((p) => p && p.close != null && p.high != null && p.low != null)
    .slice(-lookback);

  if (cleanPoints.length < 10) {
    return {
      support: null,
      resistance: null,
    };
  }

  const latestClose = Number(cleanPoints[cleanPoints.length - 1].close);

  const swingLows = [];
  const swingHighs = [];

  for (let i = 2; i < cleanPoints.length - 2; i++) {
    const prev2 = cleanPoints[i - 2];
    const prev1 = cleanPoints[i - 1];
    const current = cleanPoints[i];
    const next1 = cleanPoints[i + 1];
    const next2 = cleanPoints[i + 2];

    const currentLow = Number(current.low);
    const currentHigh = Number(current.high);

    if (
      currentLow <= Number(prev2.low) &&
      currentLow <= Number(prev1.low) &&
      currentLow <= Number(next1.low) &&
      currentLow <= Number(next2.low)
    ) {
      swingLows.push(currentLow);
    }

    if (
      currentHigh >= Number(prev2.high) &&
      currentHigh >= Number(prev1.high) &&
      currentHigh >= Number(next1.high) &&
      currentHigh >= Number(next2.high)
    ) {
      swingHighs.push(currentHigh);
    }
  }

  const supportsBelow = swingLows.filter((value) => value < latestClose);
  const resistancesAbove = swingHighs.filter((value) => value > latestClose);

  const support = supportsBelow.length
    ? Math.max(...supportsBelow)
    : Math.min(...cleanPoints.map((p) => Number(p.low)));

  const resistance = resistancesAbove.length
    ? Math.min(...resistancesAbove)
    : Math.max(...cleanPoints.map((p) => Number(p.high)));

  return {
    support: Number.isFinite(support) ? support : null,
    resistance: Number.isFinite(resistance) ? resistance : null,
  };
};

const calculateCompressedSetupScore = (rawDelta, points = []) => {
  // Starts at 50.
  // Positive rawDelta pushes score higher.
  // Negative rawDelta pushes score lower.
  // Math.tanh makes the extremes exponentially harder to reach.
  const compressed = 50 + Math.tanh(rawDelta / 55) * 45;

  let score = Math.round(compressed);

  // Visible score floor.
  score = Math.max(15, score);

  // Visible score ceiling.
  if (score >= 95) {
    const lastTime = Number(points[points.length - 1]?.time) || 0;
    score = lastTime % 2 === 0 ? 95 : 96;
  }

  return score;
};

export const buildTechnicalSummary = (points = []) => {
  const enriched = enrichChartPointsWithTechnicals(points);
  const latest = enriched[enriched.length - 1];

  if (!latest) {
    return {
      score: null,
      signal: "Not enough data",
      support: null,
      resistance: null,
      breakoutStatus: "Not enough chart data.",
      positives: [],
      warnings: [],
      summary: "Not enough chart data to build a technical summary.",
    };
  }

  const latestClose = Number(latest.close);
  const previous = enriched[enriched.length - 2];
  const previousClose = previous ? Number(previous.close) : null;

  const firstClose = Number(enriched[0]?.close);
  const returnPct =
    firstClose && latestClose ? ((latestClose - firstClose) / firstClose) * 100 : null;

  const { support, resistance } = findRecentSupportResistance(enriched);

  let score = 50;

  let trendScore = 0;
  let momentumScore = 0;
  let volumeScore = 0;
  let extensionPenalty = 0;

  const positives = [];
  const warnings = [];
  const extensionWarnings = [];

  // -----------------------------
  // TREND HEALTH
  // -----------------------------
  if (latest.sma20 != null) {
    if (latestClose > latest.sma20) {
      trendScore += 8;
      positives.push("Price is above the 20-period moving average.");
    } else {
      trendScore -= 8;
      warnings.push("Price is below the 20-period moving average.");
    }
  }

  if (latest.sma50 != null) {
    if (latestClose > latest.sma50) {
      trendScore += 10;
      positives.push("Price is above the 50-period moving average.");
    } else {
      trendScore -= 10;
      warnings.push("Price is below the 50-period moving average.");
    }
  }

  if (latest.sma100 != null) {
  if (latestClose > latest.sma100) {
    trendScore += 12;
    positives.push("Price is above the 100-period moving average.");
  } else {
    trendScore -= 12;
    warnings.push("Price is below the 100-period moving average.");
  }
}

  if (latest.sma20 != null && latest.sma50 != null) {
    if (latest.sma20 > latest.sma50) {
      trendScore += 6;
      positives.push("Short-term trend is above the medium-term trend.");
    } else {
      trendScore -= 6;
      warnings.push("Short-term trend is below the medium-term trend.");
    }
  }

  if (latest.sma50 != null && latest.sma100 != null) {
  if (latest.sma50 > latest.sma100) {
    trendScore += 6;
    positives.push("Medium-term trend is above the broader trend.");
  } else {
    trendScore -= 6;
    warnings.push("Medium-term trend is below the broader trend.");
  }
}

  // -----------------------------
  // MOMENTUM
  // -----------------------------
  if (latest.rsi14 != null) {
    if (latest.rsi14 >= 80) {
      extensionPenalty -= 8;
      extensionWarnings.push(
        `RSI is very elevated at ${latest.rsi14.toFixed(1)}, suggesting overextension risk.`
      );
    } else if (latest.rsi14 >= 70) {
      extensionPenalty -= 5;
      extensionWarnings.push(
        `RSI is elevated at ${latest.rsi14.toFixed(1)}, suggesting short-term overbought risk.`
      );
    } else if (latest.rsi14 >= 50 && latest.rsi14 < 70) {
      momentumScore += 5;
      positives.push(`RSI is constructive at ${latest.rsi14.toFixed(1)}.`);
    } else if (latest.rsi14 <= 30) {
      momentumScore -= 2;
      warnings.push(
        `RSI is low at ${latest.rsi14.toFixed(1)}, which may indicate oversold conditions but weak momentum.`
      );
    } else {
      momentumScore -= 3;
      warnings.push(`RSI is weak at ${latest.rsi14.toFixed(1)}.`);
    }
  }

  if (latest.macdLine != null && latest.macdSignal != null) {
    if (latest.macdLine > latest.macdSignal) {
      momentumScore += 7;
      positives.push("MACD is above its signal line.");
    } else {
      momentumScore -= 7;
      warnings.push("MACD is below its signal line.");
    }
  }

  if (latest.macdHistogram != null) {
    if (latest.macdHistogram > 0) {
      momentumScore += 3;
      positives.push("MACD histogram is positive.");
    } else {
      momentumScore -= 3;
      warnings.push("MACD histogram is negative.");
    }
  }

  if (latest.stochastic14 != null) {
    if (latest.stochastic14 >= 85) {
      extensionPenalty -= 4;
      extensionWarnings.push(
        `Stochastic is high at ${latest.stochastic14.toFixed(1)}, so the stock may be short-term extended.`
      );
    } else if (latest.stochastic14 <= 20) {
      warnings.push(
        `Stochastic is low at ${latest.stochastic14.toFixed(1)}, suggesting short-term weakness or possible oversold conditions.`
      );
    }
  }

  // -----------------------------
  // VOLUME / MONEY FLOW
  // -----------------------------
  if (latest.vwap != null) {
    if (latestClose > latest.vwap) {
      volumeScore += 5;
      positives.push("Price is trading above VWAP.");
    } else {
      volumeScore -= 5;
      warnings.push("Price is trading below VWAP.");
    }
  }

  if (latest.cmf20 != null) {
    if (latest.cmf20 > 0.05) {
      volumeScore += 5;
      positives.push("Chaikin Money Flow suggests accumulation.");
    } else if (latest.cmf20 < -0.05) {
      volumeScore -= 5;
      warnings.push("Chaikin Money Flow suggests distribution.");
    }
  }

  if (latest.obv != null && previous?.obv != null) {
    if (latest.obv > previous.obv) {
      volumeScore += 3;
      positives.push("On-balance volume is improving.");
    } else if (latest.obv < previous.obv) {
      volumeScore -= 3;
      warnings.push("On-balance volume is weakening.");
    }
  }

  // -----------------------------
  // EXTENSION RISK
  // -----------------------------
  if (latest.sma50 != null && latest.sma50 !== 0) {
    const distanceFromSma50 = ((latestClose - latest.sma50) / latest.sma50) * 100;

    if (distanceFromSma50 > 25) {
      extensionPenalty -= 6;
      extensionWarnings.push(
        `Price is ${distanceFromSma50.toFixed(1)}% above the 50-period moving average.`
      );
    }
  }

  if (latest.sma100 != null && latest.sma100 !== 0) {
  const distanceFromSma100 =
    ((latestClose - latest.sma100) / latest.sma100) * 100;

  if (distanceFromSma100 > 50) {
    extensionPenalty -= 10;
    extensionWarnings.push(
      `Price is ${distanceFromSma100.toFixed(1)}% above the 100-period moving average.`
    );
  } else if (distanceFromSma100 > 30) {
    extensionPenalty -= 6;
    extensionWarnings.push(
      `Price is ${distanceFromSma100.toFixed(1)}% above the 100-period moving average.`
    );
  }
}

  if (latest.bollingerUpper != null && latest.bollingerLower != null) {
    if (latestClose > latest.bollingerUpper) {
      extensionPenalty -= 5;
      extensionWarnings.push("Price is above the upper Bollinger Band.");
    } else if (latestClose < latest.bollingerLower) {
      warnings.push("Price is below the lower Bollinger Band.");
    } else {
      positives.push("Price is trading inside its Bollinger Band range.");
    }
  }

  if (returnPct != null) {
    if (returnPct > 100) {
      extensionPenalty -= 6;
      extensionWarnings.push(
        `The selected range return is very large at +${returnPct.toFixed(1)}%, so continuation risk is elevated.`
      );
    } else if (returnPct > 50) {
      extensionPenalty -= 3;
      extensionWarnings.push(
        `The selected range return is already strong at +${returnPct.toFixed(1)}%, so the setup may be less early.`
      );
    }
  }

  if (latest.atr14 != null && latestClose) {
    const atrPercent = (latest.atr14 / latestClose) * 100;

    if (atrPercent > 5) {
      warnings.push(
        `ATR is elevated at ${atrPercent.toFixed(1)}% of price, indicating higher volatility.`
      );
    } else if (atrPercent < 2) {
      positives.push(`ATR is controlled at ${atrPercent.toFixed(1)}% of price.`);
    }
  }

  // -----------------------------
  // SUPPORT / RESISTANCE
  // -----------------------------
  let breakoutStatus = "Price is trading between nearby support and resistance.";

  if (resistance != null && latestClose > resistance) {
    trendScore += 7;
    breakoutStatus = "Price is breaking above recent resistance.";
    positives.push("Breakout above recent resistance.");
  } else if (support != null && latestClose < support) {
    trendScore -= 7;
    breakoutStatus = "Price is breaking below recent support.";
    warnings.push("Breakdown below recent support.");
  } else if (resistance != null && latestClose >= resistance * 0.98) {
    breakoutStatus = "Price is testing nearby resistance.";
  } else if (support != null && latestClose <= support * 1.02) {
    breakoutStatus = "Price is near nearby support.";
  }

  if (previousClose != null) {
    if (latestClose > previousClose) {
      momentumScore += 2;
      positives.push("Latest close is above the prior close.");
    } else {
      momentumScore -= 2;
      warnings.push("Latest close is below the prior close.");
    }
  }

  const rawScoreDelta = trendScore + momentumScore + volumeScore + extensionPenalty;

score = calculateCompressedSetupScore(rawScoreDelta, points);

// Entry setup is different from technical strength.
// Technical setup asks: "Is the trend healthy?"
// Entry setup asks: "Is this an attractive area to consider entry?"
let entryScoreDelta = 0;
const entryPositives = [];
const entryWarnings = [];

const aboveSma20 = latest.sma20 != null && latestClose > latest.sma20;
const aboveSma50 = latest.sma50 != null && latestClose > latest.sma50;
const aboveSma100 = latest.sma100 != null && latestClose > latest.sma100;

const distanceFromSma20 =
  latest.sma20 != null && latest.sma20 !== 0
    ? ((latestClose - latest.sma20) / latest.sma20) * 100
    : null;

const distanceFromSma50 =
  latest.sma50 != null && latest.sma50 !== 0
    ? ((latestClose - latest.sma50) / latest.sma50) * 100
    : null;

// Controlled pullback inside a broader uptrend.
if (aboveSma50 && aboveSma100 && distanceFromSma20 != null) {
  if (distanceFromSma20 <= 0 && distanceFromSma20 >= -4) {
    entryScoreDelta += 14;
    entryPositives.push("Price is pulling back near the 20-period average while the broader trend remains intact.");
  } else if (distanceFromSma20 > 0 && distanceFromSma20 <= 4) {
    entryScoreDelta += 8;
    entryPositives.push("Price is close to short-term trend support rather than far above it.");
  } else if (distanceFromSma20 > 8) {
    entryScoreDelta -= 8;
    entryWarnings.push("Price is already well above the 20-period average, so the entry may be less attractive.");
  }
}

// Near the 50-period average can be a stronger buy-the-dip zone if long-term trend is intact.
if (aboveSma100 && distanceFromSma50 != null) {
  if (Math.abs(distanceFromSma50) <= 3) {
    entryScoreDelta += 16;
    entryPositives.push("Price is near the 50-period average, which can be a key pullback zone.");
  } else if (distanceFromSma50 > 12) {
    entryScoreDelta -= 10;
    entryWarnings.push("Price is far above the 50-period average, so the setup may be stretched.");
  } else if (distanceFromSma50 < -8) {
    entryScoreDelta -= 8;
    entryWarnings.push("Price is falling meaningfully below the 50-period average, so the pullback may be turning into weakness.");
  }
}

// Broader trend filter.
if (latest.sma100 != null) {
  if (aboveSma100) {
    entryScoreDelta += 8;
    entryPositives.push(
      "Price remains above the 100-period average, so the broader trend is still intact."
    );
  } else {
    entryScoreDelta -= 16;
    entryWarnings.push(
      "Price is below the 100-period average, so this is not a clean trend-based entry."
    );
  }
}

// Support / resistance context.
if (support != null && resistance != null) {
  const distanceToSupport = ((latestClose - support) / latestClose) * 100;
  const distanceToResistance = ((resistance - latestClose) / latestClose) * 100;

  if (distanceToSupport >= 0 && distanceToSupport <= 3) {
    entryScoreDelta += 10;
    entryPositives.push("Price is close to nearby support.");
  }

  if (distanceToResistance >= 0 && distanceToResistance <= 2) {
    entryScoreDelta -= 6;
    entryWarnings.push("Price is close to nearby resistance, limiting short-term upside.");
  }

  if (distanceToResistance > distanceToSupport * 1.5) {
    entryScoreDelta += 6;
    entryPositives.push("Nearby upside appears larger than nearby downside based on support/resistance.");
  }
}

// Momentum entry context.
if (latest.rsi14 != null) {
  if (latest.rsi14 >= 70) {
    entryScoreDelta -= 12;
    entryWarnings.push("RSI is elevated, so the entry may be chasing short-term strength.");
  } else if (latest.rsi14 >= 45 && latest.rsi14 <= 60) {
    entryScoreDelta += 8;
    entryPositives.push("RSI is in a constructive but not overextended zone.");
  } else if (latest.rsi14 <= 30) {
    entryScoreDelta += 4;
    entryWarnings.push("RSI is oversold, which may create reversal potential but also signals weak momentum.");
  }
}

// Big past move can reduce entry quality even if trend is strong.
if (returnPct != null) {
  if (returnPct > 100) {
    entryScoreDelta -= 16;
    entryWarnings.push("The selected range return is already very large, so the entry may be late.");
  } else if (returnPct > 50) {
    entryScoreDelta -= 10;
    entryWarnings.push("The selected range return is already strong, so the entry may be less early.");
  }
}

let entryScore = calculateCompressedSetupScore(entryScoreDelta, points);

// Entry score should also respect hard visual bounds.
entryScore = Math.max(15, Math.min(96, entryScore));

let entryLabel = "Neutral Entry";

if (entryScore >= 78) {
  entryLabel = "Attractive Entry";
} else if (entryScore >= 65) {
  entryLabel = "Decent Entry";
} else if (entryScore >= 50) {
  entryLabel = "Neutral Entry";
} else if (entryScore >= 35) {
  entryLabel = "Risky Entry";
} else {
  entryLabel = "Poor Entry";
}

let entrySummary =
  entryLabel === "Attractive Entry"
    ? "The entry setup looks attractive because price is near useful support or trend levels without looking overly stretched."
    : entryLabel === "Decent Entry"
    ? "The entry setup is decent, but there are still some risks such as nearby resistance, weaker momentum, or a less ideal pullback."
    : entryLabel === "Neutral Entry"
    ? "The entry setup is neutral. The stock is not clearly at a strong buy zone, but it is also not obviously too stretched or broken."
    : entryLabel === "Risky Entry"
    ? "The entry setup is risky. Price may be too stretched, too close to resistance, or showing weakness that makes timing less attractive."
    : "The entry setup looks poor right now because the chart is either too stretched or the trend structure is too weak.";

const allWarnings = [...extensionWarnings, ...warnings];

const isStrongTrend = trendScore >= 25;
const isPositiveTrend = trendScore >= 12;
const isWeakTrend = trendScore <= -12;
const isVeryExtended = extensionPenalty <= -12;
const isModeratelyExtended = extensionPenalty <= -6;
const isOversold = latest.rsi14 != null && latest.rsi14 <= 30;

// Extension should cap the setup score.
// A stock can have a strong trend and still be a worse entry if it is stretched.
if (isVeryExtended && isStrongTrend) {
  score = Math.min(score, 74);
} else if (isVeryExtended) {
  score = Math.min(score, 70);
} else if (isModeratelyExtended && isPositiveTrend) {
  score = Math.min(score, 76);
} else if (isModeratelyExtended) {
  score = Math.min(score, 72);
}

// Final visible score guardrail.
score = Math.max(15, score);

if (score >= 95) {
  const lastTime = Number(points[points.length - 1]?.time) || 0;
  score = lastTime % 2 === 0 ? 95 : 96;
}

  let signal = "Mixed Setup";

if ((isStrongTrend || isPositiveTrend) && (isVeryExtended || isModeratelyExtended)) {
  signal = "Getting Stretched";
} else if (score >= 78 && isStrongTrend) {
  signal = "Strong Buy Setup";
} else if (score >= 65 && isPositiveTrend) {
  signal = "Healthy Uptrend";
} else if (isWeakTrend && isOversold) {
  signal = "Oversold Watch";
} else if (score < 55 || isWeakTrend) {
  signal = "Weak Setup";
} else {
  signal = "Mixed Setup";
}

  const supportText = support != null ? `$${support.toFixed(2)}` : "unknown support";
  const resistanceText =
    resistance != null ? `$${resistance.toFixed(2)}` : "unknown resistance";

  const summary =
  signal === "Getting Stretched"
    ? `The stock still has a strong trend, but it is starting to look stretched. That means the move may already be crowded or extended, so a new entry could have higher pullback risk. Support is near ${supportText} and resistance is near ${resistanceText}. ${breakoutStatus}`
    : signal === "Strong Buy Setup"
    ? `The chart currently shows one of the cleaner technical setups. Trend, momentum, and volume are mostly confirming each other, with support near ${supportText} and resistance near ${resistanceText}. ${breakoutStatus}`
    : signal === "Healthy Uptrend"
    ? `The chart is in a healthy uptrend, but the setup is not strong enough to be considered a top-tier technical setup. Support is near ${supportText} and resistance is near ${resistanceText}. ${breakoutStatus}`
    : signal === "Oversold Watch"
    ? `The chart is weak, but the stock may be getting oversold. This does not automatically make it bullish, but it may be worth watching for a reversal. Support is near ${supportText} and resistance is near ${resistanceText}. ${breakoutStatus}`
    : signal === "Weak Setup"
    ? `The chart currently looks weak. Price action is below important trend levels or momentum is not confirming. Support is near ${supportText} and resistance is near ${resistanceText}. ${breakoutStatus}`
    : `The chart is giving mixed signals. There is not enough agreement between trend, momentum, volume, and risk to call it a clean bullish or bearish setup. Support is near ${supportText} and resistance is near ${resistanceText}. ${breakoutStatus}`;

  return {
  score,
  signal,
  rawScoreDelta,
  trendScore,
  momentumScore,
  volumeScore,
  extensionPenalty,
  returnPct,

  entryScore,
  entryLabel,
  entrySummary,
  entryPositives: entryPositives.slice(0, 4),
  entryWarnings: entryWarnings.slice(0, 4),

    support,
    resistance,
    breakoutStatus,

    rsi14: latest.rsi14,
    macdLine: latest.macdLine,
    macdSignal: latest.macdSignal,
    macdHistogram: latest.macdHistogram,
    stochastic14: latest.stochastic14,
    atr14: latest.atr14,
    obv: latest.obv,
    cmf20: latest.cmf20,

    positives: positives.slice(0, 5),
    warnings: allWarnings.slice(0, 5),
    summary,
  };
};