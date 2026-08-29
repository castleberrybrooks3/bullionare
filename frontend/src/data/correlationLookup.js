const correlationLookup = {
  NVDA: {
    ticker: "NVDA",
    name: "NVIDIA",
    mostCorrelated: [
      {
        ticker: "AMD",
        name: "Advanced Micro Devices",
        correlation: 0.93,
        type: "Stock",
        relationship: "AI chip peer / semiconductor cycle"
      },
      {
        ticker: "SMCI",
        name: "Super Micro Computer",
        correlation: 0.92,
        type: "Stock",
        relationship: "AI server infrastructure"
      },
      {
        ticker: "TSM",
        name: "Taiwan Semiconductor",
        correlation: 0.9,
        type: "Stock",
        relationship: "Chip supply chain / foundry dependency"
      },
      {
        ticker: "SMH",
        name: "VanEck Semiconductor ETF",
        correlation: 0.94,
        type: "ETF",
        relationship: "Semiconductor ETF exposure"
      }
    ]
  },

  XOM: {
    ticker: "XOM",
    name: "Exxon Mobil",
    mostCorrelated: [
      {
        ticker: "CVX",
        name: "Chevron",
        correlation: 0.96,
        type: "Stock",
        relationship: "Oil major peer"
      },
      {
        ticker: "COP",
        name: "ConocoPhillips",
        correlation: 0.88,
        type: "Stock",
        relationship: "Oil producer exposure"
      },
      {
        ticker: "XLE",
        name: "Energy Select Sector SPDR ETF",
        correlation: 0.94,
        type: "ETF",
        relationship: "Broad energy sector exposure"
      }
    ]
  },

  JPM: {
    ticker: "JPM",
    name: "JPMorgan Chase",
    mostCorrelated: [
      {
        ticker: "BAC",
        name: "Bank of America",
        correlation: 0.95,
        type: "Stock",
        relationship: "Money center bank peer"
      },
      {
        ticker: "WFC",
        name: "Wells Fargo",
        correlation: 0.87,
        type: "Stock",
        relationship: "Large bank peer"
      },
      {
        ticker: "XLF",
        name: "Financial Select Sector SPDR ETF",
        correlation: 0.91,
        type: "ETF",
        relationship: "Broad financial sector exposure"
      }
    ]
  }
};

export default correlationLookup;