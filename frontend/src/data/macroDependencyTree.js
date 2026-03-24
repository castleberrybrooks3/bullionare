const dependencyTree = {

  "Oil Prices": {

up: [

{
name: "Energy Producers",
direction: "up",
stocks: ["XOM","CVX","COP","EOG","OXY"],
next: [
{
name: "Oil Equipment Demand",
direction: "up",
stocks: ["SLB","HAL","BKR"]
}
]
},

{
name: "Oil Services",
direction: "up",
stocks: ["SLB","HAL","BKR"],
next: [
{
name: "Offshore Drilling",
direction: "up",
stocks: ["RIG","VAL"]
}
]
},

{
name: "Refiners",
direction: "up",
stocks: ["VLO","MPC","PSX"],
next: [
{
name: "Crack Spread Expansion",
direction: "up",
stocks: ["VLO","MPC"]
}
]
},

{
name: "Airlines",
direction: "down",
stocks: ["DAL","UAL","AAL","LUV"],
next: [
{
name: "Aircraft Orders",
direction: "down",
stocks: ["BA","GE"]
}
]
},

{
name: "Trucking",
direction: "down",
stocks: ["ODFL","JBHT","KNX","SAIA"],
next: [
{
name: "Freight Demand",
direction: "down",
stocks: ["UPS","FDX"]
}
]
},

{
name: "Shipping",
direction: "down",
stocks: ["ZIM","MATX","DAC"],
next: [
{
name: "Container Rates",
direction: "down",
stocks: ["ZIM","MATX"]
}
]
},

{
name: "Cruise Lines",
direction: "down",
stocks: ["CCL","RCL","NCLH"],
next: [
{
name: "Travel Demand",
direction: "down",
stocks: ["CCL","RCL"]
}
]
},

{
name: "Logistics",
direction: "down",
stocks: ["UPS","FDX","CHRW"],
next: [
{
name: "Freight Brokerage",
direction: "down",
stocks: ["CHRW"]
}
]
},

{
name: "Retail",
direction: "down",
stocks: ["WMT","TGT","COST","AMZN"],
next: [
{
name: "Consumer Spending",
direction: "down",
stocks: ["WMT","TGT"]
}
]
},

{
name: "Auto Manufacturers",
direction: "down",
stocks: ["GM","F","TSLA"],
next: [
{
name: "Auto Parts Suppliers",
direction: "down",
stocks: ["MGA","LEA"]
}
]
},

{
name: "Chemical Companies",
direction: "down",
stocks: ["DOW","LYB","DD"],
next: [
{
name: "Petrochemical Feedstock Costs",
direction: "up"
}
]
}

],

  down: [

{
name: "Energy Producers",
direction: "down",
stocks: ["XOM","CVX","COP","EOG","OXY"],
next: [
{
name: "Oil Equipment Demand",
direction: "down",
stocks: ["SLB","HAL","BKR"],
next: [
{
name: "Offshore Drilling Activity",
direction: "down",
stocks: ["RIG","VAL"],
next: []
}
]
}
]
},

{
name: "Oil Services",
direction: "down",
stocks: ["SLB","HAL","BKR"],
next: [
{
name: "Offshore Drilling",
direction: "down",
stocks: ["RIG","VAL"],
next: [
{
name: "Energy Capital Expenditures",
direction: "down",
stocks: [],
next: []
}
]
}
]
},

{
name: "Refiners",
direction: "down",
stocks: ["VLO","MPC","PSX"],
next: [
{
name: "Crack Spread Compression",
direction: "down",
stocks: ["VLO","MPC"],
next: [
{
name: "Refining Margins",
direction: "down",
stocks: [],
next: []
}
]
}
]
},

{
name: "Airlines",
direction: "up",
stocks: ["DAL","UAL","AAL","LUV"],
next: [
{
name: "Aircraft Orders",
direction: "up",
stocks: ["BA","EADSY"],
next: [
{
name: "Aerospace Manufacturing",
direction: "up",
stocks: ["BA"],
next: []
}
]
}
]
},

{
name: "Trucking",
direction: "up",
stocks: ["ODFL","JBHT","KNX","SAIA"],
next: [
{
name: "Freight Demand",
direction: "up",
stocks: ["UPS","FDX"],
next: [
{
name: "E-commerce Shipping Volume",
direction: "up",
stocks: ["AMZN","UPS","FDX"],
next: []
}
]
}
]
},

{
name: "Shipping",
direction: "up",
stocks: ["ZIM","MATX","DAC"],
next: [
{
name: "Container Rates",
direction: "up",
stocks: ["ZIM","MATX"],
next: [
{
name: "Global Trade Activity",
direction: "up",
stocks: [],
next: []
}
]
}
]
},

{
name: "Cruise Lines",
direction: "up",
stocks: ["CCL","RCL","NCLH"],
next: [
{
name: "Travel Demand",
direction: "up",
stocks: ["CCL","RCL"],
next: [
{
name: "Hospitality Sector",
direction: "up",
stocks: [],
next: []
}
]
}
]
},

{
name: "Logistics",
direction: "up",
stocks: ["UPS","FDX","CHRW"],
next: [
{
name: "Freight Brokerage",
direction: "up",
stocks: ["CHRW"],
next: [
{
name: "Supply Chain Activity",
direction: "up",
stocks: [],
next: []
}
]
}
]
},

{
name: "Retail",
direction: "up",
stocks: ["WMT","TGT","COST","AMZN"],
next: [
{
name: "Consumer Spending",
direction: "up",
stocks: ["WMT","TGT"],
next: [
{
name: "Discretionary Goods",
direction: "up",
stocks: [],
next: []
}
]
}
]
},

{
name: "Auto Manufacturers",
direction: "up",
stocks: ["GM","F","TSLA"],
next: [
{
name: "Auto Parts Suppliers",
direction: "up",
stocks: ["MGA","LEA"],
next: [
{
name: "Vehicle Production",
direction: "up",
stocks: [],
next: []
}
]
}
]
},

{
name: "Chemical Companies",
direction: "up",
stocks: ["DOW","LYB","DD"],
next: [
{
name: "Petrochemical Feedstock Costs",
direction: "down",
stocks: [],
next: [
{
name: "Chemical Margins",
direction: "up",
stocks: [],
next: []
}
]
}
]
}

]
},

"Interest Rates": {

up: [

{
name: "Mortgage Rates",
direction: "up",
stocks: [],
next: [
{
name: "Housing Affordability",
direction: "down",
stocks: [],
next: [
{
name: "Housing Demand",
direction: "down",
stocks: [],
next: [
{
name: "Homebuilders",
direction: "down",
stocks: ["DHI","LEN","PHM","TOL"],
next: []
}
]
}
]
}
]
},

{
name: "Corporate Borrowing Costs",
direction: "up",
stocks: [],
next: [
{
name: "Corporate Investment",
direction: "down",
stocks: [],
next: [
{
name: "Industrial Companies",
direction: "down",
stocks: ["CAT","DE","BA"],
next: []
}
]
}
]
},

{
name: "Tech Stock Valuations",
direction: "down",
stocks: ["AAPL","MSFT","NVDA","GOOGL","AMZN"],
next: [
{
name: "Growth Stock Multiples",
direction: "down",
stocks: ["TSLA","SNOW","PLTR"],
next: []
}
]
},

{
name: "Bank Net Interest Margins",
direction: "up",
stocks: ["JPM","BAC","WFC","C"],
next: [
{
name: "Bank Profitability",
direction: "up",
stocks: ["JPM","BAC","WFC"],
next: []
}
]
},

{
name: "Private Equity Activity",
direction: "down",
stocks: ["BX","KKR","APO"],
next: [
{
name: "Leveraged Buyouts",
direction: "down",
stocks: [],
next: []
}
]
},

{
name: "Auto Loan Rates",
direction: "up",
stocks: [],
next: [
{
name: "Vehicle Affordability",
direction: "down",
stocks: [],
next: [
{
name: "Auto Manufacturers",
direction: "down",
stocks: ["GM","F","TSLA"],
next: []
}
]
}
]
},

{
name: "Commercial Real Estate Financing",
direction: "up",
stocks: [],
next: [
{
name: "Office Property Values",
direction: "down",
stocks: ["BXP","VNO"],
next: []
}
]
},

{
name: "Bond Yields",
direction: "up",
stocks: ["O","AMT","NEE"],
next: [
{
name: "Equity Market Valuations",
direction: "down",
stocks: ["AAPL","MSFT","NVDA","AMZN"],
next: []
}
]
}

],

down: [

{
name: "Mortgage Rates",
direction: "down",
stocks: [],
next: [
{
name: "Housing Affordability",
direction: "up",
stocks: [],
next: [
{
name: "Housing Demand",
direction: "up",
stocks: [],
next: [
{
name: "Homebuilders",
direction: "up",
stocks: ["DHI","LEN","PHM","TOL"],
next: []
}
]
}
]
}
]
},

{
name: "Corporate Borrowing Costs",
direction: "down",
stocks: [],
next: [
{
name: "Corporate Investment",
direction: "up",
stocks: [],
next: [
{
name: "Industrial Companies",
direction: "up",
stocks: ["CAT","DE","BA"],
next: []
}
]
}
]
},

{
name: "Tech Stock Valuations",
direction: "up",
stocks: ["AAPL","MSFT","NVDA","GOOGL","AMZN"],
next: [
{
name: "Growth Stock Multiples",
direction: "up",
stocks: ["TSLA","SNOW","PLTR"],
next: []
}
]
},

{
name: "Bank Net Interest Margins",
direction: "down",
stocks: ["JPM","BAC","WFC","C"],
next: [
{
name: "Bank Profitability",
direction: "down",
stocks: ["JPM","BAC","WFC"],
next: []
}
]
},

{
name: "Private Equity Activity",
direction: "up",
stocks: ["BX","KKR","APO"],
next: [
{
name: "Leveraged Buyouts",
direction: "up",
stocks: [],
next: []
}
]
},

{
name: "Auto Loan Rates",
direction: "down",
stocks: [],
next: [
{
name: "Vehicle Affordability",
direction: "up",
stocks: [],
next: [
{
name: "Auto Manufacturers",
direction: "up",
stocks: ["GM","F","TSLA"],
next: []
}
]
}
]
},

{
name: "Commercial Real Estate Financing",
direction: "down",
stocks: [],
next: [
{
name: "Office Property Values",
direction: "up",
stocks: ["BXP","VNO"],
next: []
}
]
},

{
name: "Bond Yields",
direction: "down",
stocks: ["O","AMT","NEE"],
next: [
{
name: "Equity Market Valuations",
direction: "up",
stocks: ["AAPL","MSFT","NVDA","AMZN"],
next: []
}
]
}

]

},

"Inflation": {

up: [

{
name: "Interest Rates",
direction: "up",
stocks: [],
next: [
{
name: "Borrowing Costs",
direction: "up",
stocks: [],
next: [
{
name: "Economic Growth",
direction: "down",
stocks: ["AAPL","MSFT","NVDA","AMZN"],
next: []
}
]
}
]
},

{
name: "Consumer Purchasing Power",
direction: "down",
stocks: [],
next: [
{
name: "Consumer Spending",
direction: "down",
stocks: [],
next: [
{
name: "Retail",
direction: "down",
stocks: ["WMT","TGT","COST","AMZN"],
next: []
}
]
}
]
},

{
name: "Commodity Prices",
direction: "up",
stocks: ["NEM","GOLD","AEM","FCX","BHP","RIO","DBC"],
next: [
{
name: "Mining Companies",
direction: "up",
stocks: ["FCX","NEM","AA"],
next: []
}
]
},

{
name: "Gold",
direction: "up",
stocks: ["NEM","GOLD","AEM","FCX","BHP","RIO"],
next: [
{
name: "Inflation Hedge Demand",
direction: "up",
stocks: ["NEM","GOLD","AEM","FCX","BHP","RIO"],
next: []
}
]
},

{
name: "Energy Prices",
direction: "up",
stocks: ["XOM","CVX","COP"],
next: [
{
name: "Oil Producers",
direction: "up",
stocks: ["XOM","CVX","EOG"],
next: []
}
]
},

{
name: "Corporate Input Costs",
direction: "up",
stocks: [],
next: [
{
name: "Corporate Profit Margins",
direction: "down",
stocks: [],
next: [
{
name: "Equity Market Earnings",
direction: "down",
stocks: ["AAPL","MSFT","NVDA","AMZN"],
next: []
}
]
}
]
},

{
name: "Wage Inflation",
direction: "up",
stocks: [],
next: [
{
name: "Labor Costs",
direction: "up",
stocks: [],
next: [
{
name: "Restaurant Margins",
direction: "down",
stocks: ["MCD","SBUX","CMG"],
next: []
}
]
}
]
},

{
name: "Bond Yields",
direction: "up",
stocks: ["O","AMT","NEE"],
next: [
{
name: "Bond Prices",
direction: "down",
stocks: ["O","AMT","NEE"],
next: []
}
]
},

{
name: "Defensive Stocks",
direction: "up",
stocks: ["KO","PG","PEP","WMT"],
next: [
{
name: "Consumer Staples Demand",
direction: "up",
stocks: ["KO","PG"],
next: []
}
]
}

],

down: [

{
name: "Interest Rates",
direction: "down",
stocks: [],
next: [
{
name: "Borrowing Costs",
direction: "down",
stocks: [],
next: [
{
name: "Economic Growth",
direction: "up",
stocks: ["AAPL","MSFT","NVDA","AMZN","SPY"],
next: []
}
]
}
]
},

{
name: "Consumer Purchasing Power",
direction: "up",
stocks: [],
next: [
{
name: "Consumer Spending",
direction: "up",
stocks: [],
next: [
{
name: "Retail",
direction: "up",
stocks: ["WMT","TGT","COST","AMZN"],
next: []
}
]
}
]
},

{
name: "Commodity Prices",
direction: "down",
stocks: ["NEM","GOLD","AEM","FCX","BHP","RIO","DBC"],
next: [
{
name: "Mining Companies",
direction: "down",
stocks: ["FCX","NEM","AA"],
next: []
}
]
},

{
name: "Gold",
direction: "down",
stocks: ["NEM","GOLD","AEM","FCX","BHP","RIO"],
next: [
{
name: "Inflation Hedge Demand",
direction: "down",
stocks: ["NEM","GOLD","AEM","FCX","BHP","RIO"],
next: []
}
]
},

{
name: "Energy Prices",
direction: "down",
stocks: ["XOM","CVX","COP"],
next: [
{
name: "Oil Producers",
direction: "down",
stocks: ["XOM","CVX","EOG"],
next: []
}
]
},

{
name: "Corporate Input Costs",
direction: "down",
stocks: [],
next: [
{
name: "Corporate Profit Margins",
direction: "up",
stocks: [],
next: [
{
name: "Equity Market Earnings",
direction: "up",
stocks: ["AAPL","MSFT","NVDA","AMZN"],
next: []
}
]
}
]
},

{
name: "Wage Inflation",
direction: "down",
stocks: [],
next: [
{
name: "Labor Costs",
direction: "down",
stocks: [],
next: [
{
name: "Restaurant Margins",
direction: "up",
stocks: ["MCD","SBUX","CMG"],
next: []
}
]
}
]
},

{
name: "Bond Yields",
direction: "down",
stocks: ["O","AMT","NEE"],
next: [
{
name: "Bond Prices",
direction: "up",
stocks: ["O","AMT","NEE"],
next: []
}
]
},

{
name: "Growth Stocks",
direction: "up",
stocks: ["AAPL","MSFT","NVDA","AMZN"],
next: [
{
name: "Tech Valuations",
direction: "up",
stocks: ["AAPL","MSFT","NVDA","AMZN","META","GOOGL"],
next: []
}
]
}

]

},
"US Dollar": {

up: [

{
name: "US Exports",
direction: "down",
stocks: [],
next: [
{
name: "Industrial Exporters",
direction: "down",
stocks: ["CAT","DE","BA"],
next: []
}
]
},

{
name: "Commodity Prices",
direction: "down",
stocks: ["NEM","GOLD","AEM","FCX","BHP","RIO"],
next: [
{
name: "Mining Companies",
direction: "down",
stocks: ["FCX","NEM","AA"],
next: []
}
]
},

{
name: "Multinational Earnings",
direction: "down",
stocks: ["AAPL","MSFT","KO","PG"],
next: [
{
name: "Foreign Revenue Translation",
direction: "down",
stocks: ["AAPL","MSFT"],
next: []
}
]
},

{
name: "Emerging Market Currencies",
direction: "down",
stocks: ["BABA","TSM","PDD","VALE"],
next: [
{
name: "Emerging Market Equities",
direction: "down",
stocks: ["EEM","VALE","BABA"],
next: []
}
]
},

{
name: "Global Liquidity",
direction: "down",
stocks: [],
next: [
{
name: "Risk Assets",
direction: "down",
stocks: ["AAPL","MSFT","NVDA","AMZN"],
next: []
}
]
},

{
name: "US Import Power",
direction: "up",
stocks: [],
next: [
{
name: "Retail Margins",
direction: "up",
stocks: ["WMT","TGT","COST"],
next: []
}
]
},

{
name: "International Tourism to US",
direction: "down",
stocks: [],
next: [
{
name: "Travel Companies",
direction: "down",
stocks: ["BKNG","EXPE","ABNB"],
next: []
}
]
},

{
name: "Foreign Investment Into US Bonds",
direction: "up",
stocks: ["O","AMT","NEE"],
next: [
{
name: "Treasury Demand",
direction: "up",
stocks: ["O","AMT","NEE"],
next: []
}
]
}

],

down: [

{
name: "US Exports",
direction: "up",
stocks: [],
next: [
{
name: "Industrial Exporters",
direction: "up",
stocks: ["CAT","DE","BA"],
next: []
}
]
},

{
name: "Commodity Prices",
direction: "up",
stocks: ["NEM","GOLD","AEM","FCX","BHP","RIO"],
next: [
{
name: "Mining Companies",
direction: "up",
stocks: ["FCX","NEM","AA"],
next: []
}
]
},

{
name: "Multinational Earnings",
direction: "up",
stocks: ["AAPL","MSFT","KO","PG"],
next: [
{
name: "Foreign Revenue Translation",
direction: "up",
stocks: ["AAPL","MSFT"],
next: []
}
]
},

{
name: "Emerging Market Currencies",
direction: "up",
stocks: ["BABA","TSM","PDD","VALE"],
next: [
{
name: "Emerging Market Equities",
direction: "up",
stocks: ["EEM","VALE","BABA"],
next: []
}
]
},

{
name: "Global Liquidity",
direction: "up",
stocks: [],
next: [
{
name: "Risk Assets",
direction: "up",
stocks: ["AAPL","MSFT","NVDA","AMZN"],
next: []
}
]
},

{
name: "US Import Power",
direction: "down",
stocks: [],
next: [
{
name: "Retail Margins",
direction: "down",
stocks: ["WMT","TGT","COST"],
next: []
}
]
},

{
name: "International Tourism to US",
direction: "up",
stocks: [],
next: [
{
name: "Travel Companies",
direction: "up",
stocks: ["BKNG","EXPE","ABNB"],
next: []
}
]
},

{
name: "Emerging Market Debt Pressure",
direction: "down",
stocks: [],
next: [
{
name: "Emerging Market Bonds",
direction: "up",
stocks: ["C","HSBC","SAN"],
next: []
}
]
}

]

},

"Consumer Spending": {

up: [

{
name: "Retail",
direction: "up",
stocks: ["WMT","TGT","COST","AMZN"],
next: [
{
name: "E-commerce Sales",
direction: "up",
stocks: ["AMZN","SHOP","EBAY"],
next: [
{
name: "Logistics Demand",
direction: "up",
stocks: ["UPS","FDX"],
next: []
}
]
}
]
},

{
name: "Restaurants",
direction: "up",
stocks: ["MCD","SBUX","CMG"],
next: [
{
name: "Food Service Demand",
direction: "up",
stocks: ["MCD","CMG"],
next: []
}
]
},

{
name: "Travel",
direction: "up",
stocks: ["DAL","RCL","CCL"],
next: [
{
name: "Airlines",
direction: "up",
stocks: ["DAL","UAL","AAL"],
next: []
},
{
name: "Hotels",
direction: "up",
stocks: ["MAR","HLT"],
next: []
}
]
},

{
name: "Apparel Sales",
direction: "up",
stocks: ["NKE","LULU","GPS"],
next: [
{
name: "Luxury Goods",
direction: "up",
stocks: ["RL","TPR","TSLA"],
next: []
}
]
},

{
name: "Auto Purchases",
direction: "up",
stocks: ["GM","F","TSLA"],
next: [
{
name: "Auto Parts Suppliers",
direction: "up",
stocks: ["MGA","LEA"],
next: []
}
]
},

{
name: "Home Improvement Spending",
direction: "up",
stocks: ["HD","LOW"],
next: [
{
name: "Construction Materials",
direction: "up",
stocks: ["MLM","VMC"],
next: []
}
]
},

{
name: "Entertainment Spending",
direction: "up",
stocks: ["DIS","NFLX","LYV"],
next: [
{
name: "Streaming Subscriptions",
direction: "up",
stocks: ["NFLX","DIS"],
next: []
}
]
},

{
name: "Advertising Spending",
direction: "up",
stocks: ["GOOGL","META"],
next: [
{
name: "Digital Ad Revenue",
direction: "up",
stocks: ["META","GOOGL"],
next: []
}
]
},

{
name: "Credit Card Usage",
direction: "up",
stocks: ["V","MA","AXP"],
next: [
{
name: "Payment Processing Volume",
direction: "up",
stocks: ["V","MA"],
next: []
}
]
}

],

down: [

{
name: "Retail",
direction: "down",
stocks: ["WMT","TGT","COST","AMZN"],
next: [
{
name: "E-commerce Sales",
direction: "down",
stocks: ["AMZN","SHOP","EBAY"],
next: [
{
name: "Logistics Demand",
direction: "down",
stocks: ["UPS","FDX"],
next: []
}
]
}
]
},

{
name: "Restaurants",
direction: "down",
stocks: ["MCD","SBUX","CMG"],
next: [
{
name: "Food Service Demand",
direction: "down",
stocks: ["MCD","CMG"],
next: []
}
]
},

{
name: "Travel",
direction: "down",
stocks: ["DAL","RCL","CCL"],
next: [
{
name: "Airlines",
direction: "down",
stocks: ["DAL","UAL","AAL"],
next: []
},
{
name: "Hotels",
direction: "down",
stocks: ["MAR","HLT"],
next: []
}
]
},

{
name: "Apparel Sales",
direction: "down",
stocks: ["NKE","LULU","GPS"],
next: [
{
name: "Luxury Goods",
direction: "down",
stocks: ["RL","TPR","TSLA"],
next: []
}
]
},

{
name: "Auto Purchases",
direction: "down",
stocks: ["GM","F","TSLA"],
next: [
{
name: "Auto Parts Suppliers",
direction: "down",
stocks: ["MGA","LEA"],
next: []
}
]
},

{
name: "Home Improvement Spending",
direction: "down",
stocks: ["HD","LOW"],
next: [
{
name: "Construction Materials",
direction: "down",
stocks: ["MLM","VMC"],
next: []
}
]
},

{
name: "Entertainment Spending",
direction: "down",
stocks: ["DIS","NFLX","LYV"],
next: [
{
name: "Streaming Subscriptions",
direction: "down",
stocks: ["NFLX","DIS"],
next: []
}
]
},

{
name: "Advertising Spending",
direction: "down",
stocks: ["GOOGL","META"],
next: [
{
name: "Digital Ad Revenue",
direction: "down",
stocks: ["META","GOOGL"],
next: []
}
]
},

{
name: "Credit Card Usage",
direction: "down",
stocks: ["V","MA","AXP"],
next: [
{
name: "Payment Processing Volume",
direction: "down",
stocks: ["V","MA"],
next: []
}
]
},

{
name: "Defensive Consumer Staples",
direction: "up",
stocks: ["KO","PG","PEP","WMT"],
next: []
}

]

},

"Semiconductors": {

up: [

{
name: "Chip Equipment",
direction: "up",
stocks: ["ASML","LRCX","AMAT"],
next: [
{
name: "Semiconductor Manufacturing Expansion",
direction: "up",
stocks: ["TSM","INTC"],
next: [
{
name: "Global Chip Supply",
direction: "up",
stocks: [],
next: []
}
]
}
]
},

{
name: "AI Infrastructure",
direction: "up",
stocks: ["NVDA","AVGO","AMD"],
next: [
{
name: "Data Center Expansion",
direction: "up",
stocks: ["NVDA","SMCI"],
next: [
{
name: "Cloud Infrastructure",
direction: "up",
stocks: ["MSFT","AMZN","GOOGL"],
next: []
}
]
}
]
},

{
name: "Memory Chips",
direction: "up",
stocks: ["MU","WDC"],
next: [
{
name: "Data Storage Demand",
direction: "up",
stocks: ["MU"],
next: []
}
]
},

{
name: "Consumer Electronics",
direction: "up",
stocks: ["AAPL","SONY"],
next: [
{
name: "Smartphone Production",
direction: "up",
stocks: ["AAPL","QCOM"],
next: [
{
name: "Mobile Chip Demand",
direction: "up",
stocks: ["QCOM","ARM"],
next: []
}
]
}
]
},

{
name: "PC Market",
direction: "up",
stocks: ["HPQ","DELL"],
next: [
{
name: "CPU Demand",
direction: "up",
stocks: ["INTC","AMD"],
next: []
}
]
},

{
name: "Automotive Chips",
direction: "up",
stocks: ["NXPI","ON","TXN"],
next: [
{
name: "Vehicle Production",
direction: "up",
stocks: ["TSLA","GM","F"],
next: []
}
]
},

{
name: "Networking Chips",
direction: "up",
stocks: ["AVGO","MRVL"],
next: [
{
name: "Data Networking Equipment",
direction: "up",
stocks: ["CSCO","ANET"],
next: []
}
]
},

{
name: "GPU Demand",
direction: "up",
stocks: ["NVDA","AMD"],
next: [
{
name: "AI Model Training",
direction: "up",
stocks: ["NVDA"],
next: []
}
]
},

{
name: "Semiconductor Designers",
direction: "up",
stocks: ["NVDA","AMD","QCOM"],
next: [
{
name: "Fabless Chip Industry",
direction: "up",
stocks: ["NVDA","AMD"],
next: []
}
]
}

],

down: [

{
name: "Chip Equipment",
direction: "down",
stocks: ["ASML","LRCX","AMAT"],
next: [
{
name: "Semiconductor Manufacturing Expansion",
direction: "down",
stocks: ["TSM","INTC"],
next: [
{
name: "Global Chip Supply",
direction: "down",
stocks: [],
next: []
}
]
}
]
},

{
name: "AI Infrastructure",
direction: "down",
stocks: ["NVDA","AVGO","AMD"],
next: [
{
name: "Data Center Expansion",
direction: "down",
stocks: ["NVDA","SMCI"],
next: [
{
name: "Cloud Infrastructure",
direction: "down",
stocks: ["MSFT","AMZN","GOOGL"],
next: []
}
]
}
]
},

{
name: "Memory Chips",
direction: "down",
stocks: ["MU","WDC"],
next: [
{
name: "Data Storage Demand",
direction: "down",
stocks: ["MU"],
next: []
}
]
},

{
name: "Consumer Electronics",
direction: "down",
stocks: ["AAPL","SONY"],
next: [
{
name: "Smartphone Production",
direction: "down",
stocks: ["AAPL","QCOM"],
next: [
{
name: "Mobile Chip Demand",
direction: "down",
stocks: ["QCOM","ARM"],
next: []
}
]
}
]
},

{
name: "PC Market",
direction: "down",
stocks: ["HPQ","DELL"],
next: [
{
name: "CPU Demand",
direction: "down",
stocks: ["INTC","AMD"],
next: []
}
]
},

{
name: "Automotive Chips",
direction: "down",
stocks: ["NXPI","ON","TXN"],
next: [
{
name: "Vehicle Production",
direction: "down",
stocks: ["TSLA","GM","F"],
next: []
}
]
},

{
name: "Networking Chips",
direction: "down",
stocks: ["AVGO","MRVL"],
next: [
{
name: "Data Networking Equipment",
direction: "down",
stocks: ["CSCO","ANET"],
next: []
}
]
},

{
name: "GPU Demand",
direction: "down",
stocks: ["NVDA","AMD"],
next: [
{
name: "AI Model Training",
direction: "down",
stocks: ["NVDA"],
next: []
}
]
},

{
name: "Semiconductor Designers",
direction: "down",
stocks: ["NVDA","AMD","QCOM"],
next: [
{
name: "Fabless Chip Industry",
direction: "down",
stocks: ["NVDA","AMD"],
next: []
}
]
}

]

},

"Housing Demand": {

up: [

{
name: "Homebuilders",
direction: "up",
stocks: ["DHI","LEN","PHM","TOL"],
next: [
{
name: "Residential Construction",
direction: "up",
stocks: ["DHI","LEN"],
next: [
{
name: "Construction Employment",
direction: "up",
stocks: [],
next: []
}
]
}
]
},

{
name: "Home Improvement",
direction: "up",
stocks: ["HD","LOW"],
next: [
{
name: "Renovation Spending",
direction: "up",
stocks: ["HD","LOW"],
next: [
{
name: "Building Materials",
direction: "up",
stocks: ["MLM","VMC"],
next: []
}
]
}
]
},

{
name: "Mortgage Lending",
direction: "up",
stocks: ["RKT","UWMC"],
next: [
{
name: "Mortgage Origination Volume",
direction: "up",
stocks: ["RKT"],
next: []
}
]
},

{
name: "Real Estate Brokers",
direction: "up",
stocks: ["Z","RDFN"],
next: [
{
name: "Home Transactions",
direction: "up",
stocks: ["Z","RDFN"],
next: []
}
]
},

{
name: "Furniture Sales",
direction: "up",
stocks: ["RH","WSM"],
next: [
{
name: "Home Furnishings Demand",
direction: "up",
stocks: ["RH","WSM"],
next: []
}
]
},

{
name: "Appliance Sales",
direction: "up",
stocks: ["WHR"],
next: [
{
name: "Home Appliance Demand",
direction: "up",
stocks: ["WHR"],
next: []
}
]
},

{
name: "Building Materials",
direction: "up",
stocks: ["MLM","VMC"],
next: [
{
name: "Cement and Aggregates Demand",
direction: "up",
stocks: ["MLM","VMC"],
next: []
}
]
},

{
name: "Construction Equipment",
direction: "up",
stocks: ["CAT","DE"],
next: [
{
name: "Heavy Machinery Demand",
direction: "up",
stocks: ["CAT"],
next: []
}
]
},

{
name: "Mortgage REITs",
direction: "up",
stocks: ["NLY","AGNC"],
next: [
{
name: "Mortgage Security Demand",
direction: "up",
stocks: ["NLY"],
next: []
}
]
}

],

down: [

{
name: "Homebuilders",
direction: "down",
stocks: ["DHI","LEN","PHM","TOL"],
next: [
{
name: "Residential Construction",
direction: "down",
stocks: ["DHI","LEN"],
next: [
{
name: "Construction Employment",
direction: "down",
stocks: [],
next: []
}
]
}
]
},

{
name: "Home Improvement",
direction: "down",
stocks: ["HD","LOW"],
next: [
{
name: "Renovation Spending",
direction: "down",
stocks: ["HD","LOW"],
next: [
{
name: "Building Materials",
direction: "down",
stocks: ["MLM","VMC"],
next: []
}
]
}
]
},

{
name: "Mortgage Lending",
direction: "down",
stocks: ["RKT","UWMC"],
next: [
{
name: "Mortgage Origination Volume",
direction: "down",
stocks: ["RKT"],
next: []
}
]
},

{
name: "Real Estate Brokers",
direction: "down",
stocks: ["Z","RDFN"],
next: [
{
name: "Home Transactions",
direction: "down",
stocks: ["Z","RDFN"],
next: []
}
]
},

{
name: "Furniture Sales",
direction: "down",
stocks: ["RH","WSM"],
next: [
{
name: "Home Furnishings Demand",
direction: "down",
stocks: ["RH","WSM"],
next: []
}
]
},

{
name: "Appliance Sales",
direction: "down",
stocks: ["WHR"],
next: [
{
name: "Home Appliance Demand",
direction: "down",
stocks: ["WHR"],
next: []
}
]
},

{
name: "Building Materials",
direction: "down",
stocks: ["MLM","VMC"],
next: [
{
name: "Cement and Aggregates Demand",
direction: "down",
stocks: ["MLM","VMC"],
next: []
}
]
},

{
name: "Construction Equipment",
direction: "down",
stocks: ["CAT","DE"],
next: [
{
name: "Heavy Machinery Demand",
direction: "down",
stocks: ["CAT"],
next: []
}
]
},

{
name: "Mortgage REITs",
direction: "down",
stocks: ["NLY","AGNC"],
next: [
{
name: "Mortgage Security Demand",
direction: "down",
stocks: ["NLY"],
next: []
}
]
}

]

},

"Geopolitical Risk": {

up: [

{
name: "Defense Spending",
direction: "up",
stocks: ["LMT","RTX","NOC","GD"],
next: [
{
name: "Weapons Procurement",
direction: "up",
stocks: ["LMT","NOC"],
next: [
{
name: "Defense Manufacturing",
direction: "up",
stocks: ["LMT","GD"],
next: []
}
]
}
]
},

{
name: "Oil Prices",
direction: "up",
stocks: ["XOM","CVX","COP"],
next: [
{
name: "Energy Producers",
direction: "up",
stocks: ["XOM","CVX","EOG"],
next: [
{
name: "Oil Services",
direction: "up",
stocks: ["SLB","HAL"],
next: []
}
]
}
]
},

{
name: "Gold Prices",
direction: "up",
stocks: ["NEM","GOLD","AEM","FCX","BHP","RIO"],
next: [
{
name: "Safe Haven Demand",
direction: "up",
stocks: ["NEM","GOLD","AEM","FCX","BHP","RIO"],
next: []
}
]
},

{
name: "Cybersecurity Demand",
direction: "up",
stocks: ["PANW","CRWD","ZS"],
next: [
{
name: "Government Cyber Defense",
direction: "up",
stocks: ["PANW","CRWD"],
next: []
}
]
},

{
name: "Defense Technology",
direction: "up",
stocks: ["PLTR"],
next: [
{
name: "Military Intelligence Systems",
direction: "up",
stocks: ["PLTR"],
next: []
}
]
},

{
name: "Airlines",
direction: "down",
stocks: ["DAL","UAL","AAL"],
next: [
{
name: "Global Travel Demand",
direction: "down",
stocks: ["DAL","UAL"],
next: [
{
name: "Tourism Sector",
direction: "down",
stocks: ["BKNG","ABNB"],
next: []
}
]
}
]
},

{
name: "Global Trade",
direction: "down",
stocks: [],
next: [
{
name: "Shipping",
direction: "down",
stocks: ["ZIM","MATX","DAC"],
next: [
{
name: "Container Freight Rates",
direction: "down",
stocks: ["ZIM"],
next: []
}
]
}
]
},

{
name: "Emerging Markets",
direction: "down",
stocks: ["BABA","TSM","PDD","VALE"],
next: [
{
name: "Foreign Investment",
direction: "down",
stocks: ["BABA","TSM","PDD","VALE"],
next: []
}
]
},

{
name: "Semiconductor Supply Chains",
direction: "down",
stocks: ["TSM","NVDA"],
next: [
{
name: "Electronics Manufacturing",
direction: "down",
stocks: ["AAPL","SONY"],
next: []
}
]
},

{
name: "Agricultural Commodities",
direction: "up",
stocks: ["MOS","NTR"],
next: [
{
name: "Fertilizer Demand",
direction: "up",
stocks: ["MOS","NTR"],
next: []
}
]
}

],

down: [

{
name: "Defense Spending",
direction: "down",
stocks: ["LMT","RTX","NOC","GD"],
next: [
{
name: "Weapons Procurement",
direction: "down",
stocks: ["LMT","NOC"],
next: []
}
]
},

{
name: "Oil Prices",
direction: "down",
stocks: ["XOM","CVX","COP"],
next: [
{
name: "Energy Producers",
direction: "down",
stocks: ["XOM","CVX","EOG"],
next: []
}
]
},

{
name: "Gold Prices",
direction: "down",
stocks: ["NEM","GOLD","AEM","FCX","BHP","RIO"],
next: [
{
name: "Safe Haven Demand",
direction: "down",
stocks: ["NEM","GOLD","AEM","FCX","BHP","RIO"],
next: []
}
]
},

{
name: "Cybersecurity Demand",
direction: "down",
stocks: ["PANW","CRWD","ZS"],
next: [
{
name: "Government Cyber Defense",
direction: "down",
stocks: ["PANW","CRWD"],
next: []
}
]
},

{
name: "Airlines",
direction: "up",
stocks: ["DAL","UAL","AAL"],
next: [
{
name: "Global Travel Demand",
direction: "up",
stocks: ["DAL","UAL"],
next: [
{
name: "Tourism Sector",
direction: "up",
stocks: ["BKNG","ABNB"],
next: []
}
]
}
]
},

{
name: "Global Trade",
direction: "up",
stocks: [],
next: [
{
name: "Shipping",
direction: "up",
stocks: ["ZIM","MATX","DAC"],
next: [
{
name: "Container Freight Rates",
direction: "up",
stocks: ["ZIM"],
next: []
}
]
}
]
},

{
name: "Emerging Markets",
direction: "up",
stocks: ["BABA","TSM","PDD","VALE"],
next: [
{
name: "Foreign Investment",
direction: "up",
stocks: ["BABA","TSM","PDD","VALE"],
next: []
}
]
},

{
name: "Semiconductor Supply Chains",
direction: "up",
stocks: ["TSM","NVDA"],
next: [
{
name: "Electronics Manufacturing",
direction: "up",
stocks: ["AAPL","SONY"],
next: []
}
]
},

{
name: "Agricultural Commodities",
direction: "down",
stocks: ["MOS","NTR"],
next: [
{
name: "Fertilizer Demand",
direction: "down",
stocks: ["MOS","NTR"],
next: []
}
]
}

]

},

"Labor Market (Payrolls)": {

up: [

{
name: "Consumer Spending",
direction: "up",
stocks: [],
next: [
{
name: "Retail",
direction: "up",
stocks: ["WMT","TGT","COST","AMZN"],
next: []
}
]
},

{
name: "Wage Inflation",
direction: "up",
stocks: [],
next: [
{
name: "Labor Costs",
direction: "up",
stocks: [],
next: [
{
name: "Corporate Profit Margins",
direction: "down",
stocks: ["WMT","TGT","COST","MCD","SBUX","CMG","UPS","FDX"],
next: []
}
]
}
]
},

{
name: "Restaurants",
direction: "up",
stocks: ["MCD","SBUX","CMG"],
next: [
{
name: "Food Service Demand",
direction: "up",
stocks: ["MCD","CMG"],
next: []
}
]
},

{
name: "Housing Demand",
direction: "up",
stocks: [],
next: [
{
name: "Homebuilders",
direction: "up",
stocks: ["DHI","LEN","PHM","TOL"],
next: []
}
]
},

{
name: "Bank Loan Demand",
direction: "up",
stocks: ["JPM","BAC","WFC","C"],
next: [
{
name: "Credit Growth",
direction: "up",
stocks: [],
next: []
}
]
},

{
name: "Small Business Activity",
direction: "up",
stocks: ["SFM","CROX","FND","RH"],
next: [
{
name: "Regional Banks",
direction: "up",
stocks: ["PNC","TFC","RF","FITB"],
next: []
}
]
}

],

down: [

{
name: "Consumer Spending",
direction: "down",
stocks: [],
next: [
{
name: "Retail",
direction: "down",
stocks: ["WMT","TGT","COST","AMZN"],
next: []
}
]
},

{
name: "Wage Growth",
direction: "down",
stocks: [],
next: [
{
name: "Labor Costs",
direction: "down",
stocks: [],
next: [
{
name: "Corporate Profit Margins",
direction: "up",
stocks: ["WMT","TGT","COST","MCD","SBUX","CMG","UPS","FDX"],
next: []
}
]
}
]
},

{
name: "Restaurants",
direction: "down",
stocks: ["MCD","SBUX","CMG"],
next: [
{
name: "Food Service Demand",
direction: "down",
stocks: ["MCD","CMG"],
next: []
}
]
},

{
name: "Housing Demand",
direction: "down",
stocks: [],
next: [
{
name: "Homebuilders",
direction: "down",
stocks: ["DHI","LEN","PHM","TOL"],
next: []
}
]
},

{
name: "Bank Loan Demand",
direction: "down",
stocks: ["JPM","BAC","WFC","C"],
next: [
{
name: "Credit Tightening",
direction: "down",
stocks: [],
next: []
}
]
}

]

},

"Bond Market Stress": {

up: [

{
name: "Bank Stability",
direction: "down",
stocks: ["JPM","BAC","WFC","C"],
next: [
{
name: "Regional Banks",
direction: "down",
stocks: ["PNC","TFC","RF","FITB"],
next: [
{
name: "Credit Availability",
direction: "down",
stocks: [],
next: []
}
]
}
]
},

{
name: "Equity Market Volatility",
direction: "up",
stocks: ["VIRT","MKTX","CBOE"],
next: [
{
name: "Risk Assets",
direction: "down",
stocks: ["AAPL","MSFT","NVDA","AMZN"],
next: []
}
]
},

{
name: "Tech Stocks",
direction: "down",
stocks: ["AAPL","MSFT","NVDA","AMZN"],
next: [
{
name: "Growth Stock Valuations",
direction: "down",
stocks: ["TSLA","PLTR","RBLX","COIN"],
next: []
}
]
},

{
name: "Corporate Borrowing Costs",
direction: "up",
stocks: [],
next: [
{
name: "Corporate Debt Issuance",
direction: "down",
stocks: [],
next: [
{
name: "Business Investment",
direction: "down",
stocks: ["CAT","DE","HON","BA","LMT","UPS","F","GM"],
next: []
}
]
}
]
},

{
name: "Housing Demand",
direction: "down",
stocks: [],
next: [
{
name: "Homebuilders",
direction: "down",
stocks: ["DHI","LEN","PHM","TOL"],
next: []
}
]
},

{
name: "Credit Markets",
direction: "tightening",
stocks: [],
next: [
{
name: "High Yield Bonds",
direction: "down",
stocks: ["F","CCL","UAL","NCLH"],
next: []
}
]
},

{
name: "Liquidity Conditions",
direction: "down",
stocks: ["AAPL","MSFT","NVDA","AMZN","TSLA","PLTR"],
next: [
{
name: "Risk Appetite",
direction: "down",
stocks: [],
next: []
}
]
},

{
name: "Gold",
direction: "up",
stocks: ["NEM","GOLD","AEM","FCX","BHP","RIO"],
next: [
{
name: "Safe Haven Demand",
direction: "up",
stocks: ["NEM","GOLD","AEM","FCX","BHP","RIO"],
next: []
}
]
},

{
name: "Treasury Yields",
direction: "up",
stocks: ["O","AMT","NEE"],
next: [
{
name: "Bond Prices",
direction: "down",
stocks: ["O","AMT","NEE"],
next: []
}
]
}

],

down: [

{
name: "Bank Stability",
direction: "up",
stocks: ["JPM","BAC","WFC","C"],
next: [
{
name: "Regional Banks",
direction: "up",
stocks: ["PNC","TFC","RF","FITB"],
next: [
{
name: "Credit Availability",
direction: "up",
stocks: [],
next: []
}
]
}
]
},

{
name: "Equity Market Volatility",
direction: "down",
stocks: ["VIRT","MKTX","CBOE"],
next: [
{
name: "Risk Assets",
direction: "up",
stocks: ["AAPL","MSFT","NVDA","AMZN"],
next: []
}
]
},

{
name: "Tech Stocks",
direction: "up",
stocks: ["AAPL","MSFT","NVDA","AMZN"],
next: [
{
name: "Growth Stock Valuations",
direction: "up",
stocks: ["TSLA","PLTR","RBLX","COIN"],
next: []
}
]
},

{
name: "Corporate Borrowing Costs",
direction: "down",
stocks: [],
next: [
{
name: "Corporate Debt Issuance",
direction: "up",
stocks: [],
next: [
{
name: "Business Investment",
direction: "up",
stocks: ["CAT","DE","HON","BA","LMT","UPS","F","GM"],
next: []
}
]
}
]
},

{
name: "Housing Demand",
direction: "up",
stocks: [],
next: [
{
name: "Homebuilders",
direction: "up",
stocks: ["DHI","LEN","PHM","TOL"],
next: []
}
]
},

{
name: "Credit Markets",
direction: "easing",
stocks: [],
next: [
{
name: "High Yield Bonds",
direction: "up",
stocks: ["F","CCL","UAL","NCLH"],
next: []
}
]
},

{
name: "Liquidity Conditions",
direction: "up",
stocks: [],
next: [
{
name: "Risk Appetite",
direction: "up",
stocks: ["AAPL","MSFT","NVDA","AMZN","TSLA","PLTR"],
next: []
}
]
},

{
name: "Gold",
direction: "down",
stocks: ["NEM","GOLD","AEM","FCX","BHP","RIO"],
next: [
{
name: "Safe Haven Demand",
direction: "down",
stocks: ["NEM","GOLD","AEM","FCX","BHP","RIO"],
next: []
}
]
},

{
name: "Treasury Yields",
direction: "down",
stocks: ["O","AMT","NEE"],
next: [
{
name: "Bond Prices",
direction: "up",
stocks: ["O","AMT","NEE"],
next: []
}
]
}

]

},

"Central Bank Liquidity": {

up: [

{
name: "Equity Markets",
direction: "up",
stocks: ["AAPL","MSFT","NVDA","AMZN"],
next: [
{
name: "Risk Appetite",
direction: "up",
stocks: [],
next: [
{
name: "Speculative Assets",
direction: "up",
stocks: ["TSLA","PLTR","RBLX","COIN"],
next: []
}
]
}
]
},

{
name: "Tech Stocks",
direction: "up",
stocks: ["AAPL","MSFT","NVDA","GOOGL"],
next: [
{
name: "Growth Stock Valuations",
direction: "up",
stocks: ["TSLA","PLTR","RBLX","COIN"],
next: [
{
name: "Venture Capital Funding",
direction: "up",
stocks: [],
next: []
}
]
}
]
},

{
name: "Cryptocurrency",
direction: "up",
stocks: ["COIN"],
next: [
{
name: "Crypto Trading Volume",
direction: "up",
stocks: ["COIN"],
next: [
{
name: "Blockchain Activity",
direction: "up",
stocks: [],
next: []
}
]
}
]
},

{
name: "Credit Markets",
direction: "up",
stocks: [],
next: [
{
name: "High Yield Bonds",
direction: "up",
stocks: ["F","CCL","UAL","NCLH"],
next: [
{
name: "Corporate Borrowing",
direction: "up",
stocks: [],
next: []
}
]
}
]
},

{
name: "Housing Demand",
direction: "up",
stocks: [],
next: [
{
name: "Homebuilders",
direction: "up",
stocks: ["DHI","LEN","PHM","TOL"],
next: []
}
]
},

{
name: "Small Cap Stocks",
direction: "up",
stocks: ["SFM","CROX","FND","RH"],
next: [
{
name: "Regional Banks",
direction: "up",
stocks: ["PNC","TFC","RF","FITB"],
next: []
}
]
},

{
name: "Private Equity Activity",
direction: "up",
stocks: ["BX","KKR"],
next: [
{
name: "Mergers and Acquisitions",
direction: "up",
stocks: [],
next: []
}
]
},

{
name: "Emerging Markets",
direction: "up",
stocks: ["BABA","TSM","PDD","VALE"],
next: [
{
name: "Global Risk Assets",
direction: "up",
stocks: [],
next: []
}
]
},

{
name: "Commodity Demand",
direction: "up",
stocks: ["FCX","BHP"],
next: [
{
name: "Industrial Metals",
direction: "up",
stocks: ["FCX"],
next: []
}
]
}

],

down: [

{
name: "Equity Markets",
direction: "down",
stocks: ["AAPL","MSFT","NVDA","AMZN"],
next: [
{
name: "Risk Appetite",
direction: "down",
stocks: [],
next: [
{
name: "Speculative Assets",
direction: "down",
stocks: ["TSLA","PLTR","RBLX","COIN"],
next: []
}
]
}
]
},

{
name: "Tech Stocks",
direction: "down",
stocks: ["AAPL","MSFT","NVDA","GOOGL"],
next: [
{
name: "Growth Stock Valuations",
direction: "down",
stocks: ["TSLA","PLTR","RBLX","COIN"],
next: [
{
name: "Venture Capital Funding",
direction: "down",
stocks: [],
next: []
}
]
}
]
},

{
name: "Cryptocurrency",
direction: "down",
stocks: ["COIN"],
next: [
{
name: "Crypto Trading Volume",
direction: "down",
stocks: ["COIN"],
next: [
{
name: "Blockchain Activity",
direction: "down",
stocks: [],
next: []
}
]
}
]
},

{
name: "Credit Markets",
direction: "down",
stocks: [],
next: [
{
name: "High Yield Bonds",
direction: "down",
stocks: ["F","CCL","UAL","NCLH"],
next: [
{
name: "Corporate Borrowing",
direction: "down",
stocks: [],
next: []
}
]
}
]
},

{
name: "Housing Demand",
direction: "down",
stocks: [],
next: [
{
name: "Homebuilders",
direction: "down",
stocks: ["DHI","LEN","PHM","TOL"],
next: []
}
]
},

{
name: "Small Cap Stocks",
direction: "down",
stocks: ["SFM","CROX","FND","RH"],
next: [
{
name: "Regional Banks",
direction: "down",
stocks: ["PNC","TFC","RF","FITB"],
next: []
}
]
},

{
name: "Private Equity Activity",
direction: "down",
stocks: ["BX","KKR"],
next: [
{
name: "Mergers and Acquisitions",
direction: "down",
stocks: [],
next: []
}
]
},

{
name: "Emerging Markets",
direction: "down",
stocks: ["BABA","TSM","PDD","VALE"],
next: [
{
name: "Global Risk Assets",
direction: "down",
stocks: [],
next: []
}
]
},

{
name: "Commodity Demand",
direction: "down",
stocks: ["FCX","BHP"],
next: [
{
name: "Industrial Metals",
direction: "down",
stocks: ["FCX"],
next: []
}
]
}

]

},

"Credit Conditions": {

up: [

{
name: "Corporate Borrowing",
direction: "up",
stocks: [],
next: [
{
name: "Corporate Investment",
direction: "up",
stocks: [],
next: [
{
name: "Economic Growth",
direction: "up",
stocks: ["CAT","DE","HON","BA","LMT","UPS","F","GM"],
next: []
}
]
}
]
},

{
name: "Business Expansion",
direction: "up",
stocks: [],
next: [
{
name: "Hiring Activity",
direction: "up",
stocks: [],
next: [
{
name: "Labor Market Strength",
direction: "up",
stocks: ["DE","CAT","HON","ITW","MMM","PH"],
next: []
}
]
}
]
},

{
name: "Bank Lending",
direction: "up",
stocks: ["JPM","BAC","WFC","C"],
next: [
{
name: "Regional Banks",
direction: "up",
stocks: ["PNC","TFC","RF","FITB"],
next: []
}
]
},

{
name: "Home Buying",
direction: "up",
stocks: [],
next: [
{
name: "Housing Demand",
direction: "up",
stocks: [],
next: [
{
name: "Homebuilders",
direction: "up",
stocks: ["DHI","LEN","PHM","TOL"],
next: []
}
]
}
]
},

{
name: "Consumer Credit",
direction: "up",
stocks: ["AXP","DFS"],
next: [
{
name: "Retail Spending",
direction: "up",
stocks: ["WMT","TGT","COST","AMZN"],
next: []
}
]
},

{
name: "Auto Loans",
direction: "up",
stocks: ["ALLY"],
next: [
{
name: "Auto Sales",
direction: "up",
stocks: ["GM","F","TSLA"],
next: []
}
]
},

{
name: "Commercial Real Estate Lending",
direction: "up",
stocks: [],
next: [
{
name: "Real Estate Development",
direction: "up",
stocks: ["SPG","VNO","WELL","O","AMT"],
next: []
}
]
},

{
name: "Private Equity Activity",
direction: "up",
stocks: ["BX","KKR"],
next: [
{
name: "Mergers and Acquisitions",
direction: "up",
stocks: [],
next: []
}
]
},

{
name: "Credit Spreads",
direction: "down",
stocks: [],
next: [
{
name: "High Yield Bonds",
direction: "up",
stocks: ["F","CCL","UAL","NCLH"],
next: []
}
]
}

],

down: [

{
name: "Corporate Borrowing",
direction: "down",
stocks: [],
next: [
{
name: "Corporate Investment",
direction: "down",
stocks: [],
next: [
{
name: "Economic Growth",
direction: "down",
stocks: ["CAT","DE","HON","BA","LMT","UPS","F","GM"],
next: []
}
]
}
]
},

{
name: "Business Expansion",
direction: "down",
stocks: [],
next: [
{
name: "Hiring Activity",
direction: "down",
stocks: [],
next: [
{
name: "Labor Market Weakness",
direction: "down",
stocks: ["DE","CAT","HON","ITW","MMM","PH"],
next: []
}
]
}
]
},

{
name: "Bank Lending",
direction: "down",
stocks: ["JPM","BAC","WFC","C"],
next: [
{
name: "Regional Banks",
direction: "down",
stocks: ["PNC","TFC","RF","FITB"],
next: []
}
]
},

{
name: "Home Buying",
direction: "down",
stocks: [],
next: [
{
name: "Housing Demand",
direction: "down",
stocks: [],
next: [
{
name: "Homebuilders",
direction: "down",
stocks: ["DHI","LEN","PHM","TOL"],
next: []
}
]
}
]
},

{
name: "Consumer Credit",
direction: "down",
stocks: ["AXP","DFS"],
next: [
{
name: "Retail Spending",
direction: "down",
stocks: ["WMT","TGT","COST","AMZN"],
next: []
}
]
},

{
name: "Auto Loans",
direction: "down",
stocks: ["ALLY"],
next: [
{
name: "Auto Sales",
direction: "down",
stocks: ["GM","F","TSLA"],
next: []
}
]
},

{
name: "Commercial Real Estate Lending",
direction: "down",
stocks: [],
next: [
{
name: "Real Estate Development",
direction: "down",
stocks: ["SPG","VNO","WELL","O","AMT"],
next: []
}
]
},

{
name: "Private Equity Activity",
direction: "down",
stocks: ["BX","KKR"],
next: [
{
name: "Mergers and Acquisitions",
direction: "down",
stocks: [],
next: []
}
]
},

{
name: "Credit Spreads",
direction: "up",
stocks: [],
next: [
{
name: "High Yield Bonds",
direction: "down",
stocks: ["F","CCL","UAL","NCLH"],
next: []
}
]
}

]

}

};

export default dependencyTree;