export const indicatorHelp = {

  supportResistance: {
    title: "Support / Resistance",
    description: "Support is an area where buyers have recently stepped in. Resistance is an area where sellers have recently pushed price back down.",
    good: "Holding above support or breaking above resistance is generally constructive.",
    bad: "Breaking below support or repeatedly failing at resistance can be a warning sign.",
    note: "Think of these as zones, not exact penny-perfect prices.",
  },

  sma20: {
    title: "SMA 20",
    description: "The 20-period simple moving average shows the stock’s short-term trend by averaging the last 20 candles.",
    good: "Price above the SMA 20 often means short-term momentum is positive.",
    bad: "Price below the SMA 20 can mean short-term weakness.",
    note: "Best for short-term trend direction, not long-term valuation.",
  },

  sma50: {
    title: "SMA 50",
    description: "The 50-period simple moving average shows the intermediate trend.",
    good: "Price above the SMA 50 usually suggests the medium-term trend is healthy.",
    bad: "Price below the SMA 50 can show weakening momentum.",
    note: "A rising SMA 50 is usually more constructive than a flat or falling one.",
  },

  sma100: {
  title: "SMA 100",
  description:
    "The 100-period simple moving average shows the broader trend by averaging the last 100 candles.",
  good:
    "Price above the SMA 100 generally suggests the broader trend is constructive.",
  bad:
    "Price below the SMA 100 can indicate weaker medium-to-longer-term momentum.",
  note:
    "This is a 100-candle average, so its real-world time span changes with the selected chart interval.",
},

  ema21: {
    title: "EMA 21",
    description: "The 21-period exponential moving average reacts faster to recent price changes than a simple moving average.",
    good: "Price above the EMA 21 can show short-term momentum is improving.",
    bad: "Price below the EMA 21 can show short-term selling pressure.",
    note: "EMA lines react faster than SMA lines because recent prices are weighted more heavily.",
  },

  bollinger: {
    title: "Bollinger Bands",
    description: "Bollinger Bands show a moving average with upper and lower volatility bands around it.",
    good: "A strong stock can ride the upper band during a powerful trend.",
    bad: "Price far above the upper band can be stretched. Price falling below the lower band can show heavy weakness or a potential oversold move.",
    note: "Bands widen when volatility rises and tighten when volatility falls.",
  },

  volumeBars: {
    title: "Volume Bars",
    description: "Volume bars show how many shares traded during each candle.",
    good: "A price move with rising volume is usually more meaningful than a move on weak volume.",
    bad: "A breakout on low volume can be less trustworthy.",
    note: "Volume helps confirm whether buyers or sellers are actually participating.",
  },

  vwap: {
    title: "VWAP",
    description: "VWAP stands for volume-weighted average price. It shows the average price traded, weighted by volume.",
    good: "Price above VWAP often means buyers are in control intraday.",
    bad: "Price below VWAP often means sellers are in control intraday.",
    note: "VWAP is especially useful on shorter timeframes like 1D.",
  },

  rsi14: {
    title: "RSI 14",
    description: "RSI measures momentum on a 0 to 100 scale. It helps show whether a stock may be overbought or oversold.",
    good: "RSI between 50 and 70 often shows healthy bullish momentum.",
    bad: "RSI below 30 can show oversold weakness. RSI above 70 can show the stock is getting stretched.",
    note: "Overbought does not always mean sell. Strong stocks can stay overbought for a while.",
  },

  macdHistogram: {
    title: "MACD Histogram",
    description: "MACD Histogram measures the difference between the MACD line and the signal line. It helps show momentum shifts.",
    good: "A positive and rising MACD histogram usually means bullish momentum is improving.",
    bad: "A negative and falling MACD histogram usually means bearish momentum is increasing.",
    note: "MACD does not mean overvalued. It measures momentum, not valuation.",
  },

  stochastic: {
    title: "Stochastic",
    description: "Stochastic compares the current close to the recent price range. It helps identify overbought or oversold momentum.",
    good: "Moving up from below 20 can show momentum is recovering.",
    bad: "Above 80 can mean the stock is stretched. Below 20 can mean weak or oversold.",
    note: "It works best with trend confirmation, not by itself.",
  },

  cmf: {
    title: "Chaikin Money Flow",
    description: "CMF estimates whether money is flowing into or out of a stock using price and volume.",
    good: "A positive CMF usually suggests accumulation, meaning buyers are supporting the stock.",
    bad: "A negative CMF usually suggests distribution, meaning sellers may be in control.",
    note: "Readings above 0.10 or below -0.10 are usually more meaningful than tiny moves around zero.",
  },

  atr14: {
    title: "ATR 14",
    description: "ATR measures average volatility. It shows how much the stock typically moves, not whether it is bullish or bearish.",
    good: "Higher ATR can create larger trading opportunities if the trend is clear.",
    bad: "Higher ATR also means more risk and wider price swings.",
    note: "ATR is a volatility indicator, not a direction indicator.",
  },

  obv: {
    title: "OBV",
    description: "On-Balance Volume tracks whether volume is flowing with up days or down days.",
    good: "Rising OBV suggests buyers are accumulating shares.",
    bad: "Falling OBV suggests distribution or selling pressure.",
    note: "OBV is most useful when it confirms or disagrees with the price trend.",
  },

  spy: {
    title: "SPY",
    description: "SPY is an ETF that tracks the S&P 500, which represents large-cap U.S. stocks.",
    good: "If a stock is outperforming SPY, it is stronger than the broad market over that selected period.",
    bad: "If a stock is underperforming SPY, it may be lagging the market.",
  },

  qqq: {
    title: "QQQ",
    description: "QQQ is an ETF that tracks the Nasdaq-100, heavily weighted toward large technology and growth companies.",
    good: "Outperforming QQQ is a strong sign for growth or tech-heavy stocks.",
    bad: "Underperforming QQQ can show relative weakness versus growth leaders.",
  },

  dia: {
    title: "DIA",
    description: "DIA is an ETF that tracks the Dow Jones Industrial Average.",
    good: "Useful for comparing a stock against large, established blue-chip companies.",
    bad: "Underperformance versus DIA can show weakness against more mature large-cap stocks.",
  },

  iwm: {
    title: "IWM",
    description: "IWM is an ETF that tracks the Russell 2000, which represents smaller U.S. companies.",
    good: "Outperforming IWM can show strength versus small-cap stocks.",
    bad: "Underperforming IWM can show weakness compared with higher-beta small-cap names.",
  },

  testingResistance: {
    title: "Testing Resistance",
    description: "This means price is trading near a level where sellers have recently appeared.",
    good: "A clean break above resistance can confirm a bullish breakout.",
    bad: "Repeated failure near resistance can show buyers are struggling.",
    note: "A breakout is stronger when confirmed by volume.",
  },

  supportLevel: {
    title: "Support Level",
    description: "Support is a price area where buyers have recently stepped in.",
    good: "Holding support can show demand is still present.",
    bad: "Breaking below support can show the setup is weakening.",
  },

  resistanceLevel: {
    title: "Resistance Level",
    description: "Resistance is a price area where sellers have recently appeared.",
    good: "Breaking above resistance can show momentum is improving.",
    bad: "Failing at resistance can show the stock is struggling to move higher.",
  },
};