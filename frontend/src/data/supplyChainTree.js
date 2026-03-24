const supplyChainTree = {
  AAPL: {
  name: "Apple",
  chain: [
    { ticker: "AMAT", name: "Applied Materials", role: "equipment" },
    { ticker: "ASML", name: "ASML", role: "lithography" },
    { ticker: "TSM", name: "TSMC", role: "chipmaker" },
    { ticker: "AAPL", name: "Apple", role: "devices" }
  ]
},
WMT: {
  name: "Walmart",
  chain: [
    { ticker: "PG", name: "Procter & Gamble", role: "consumer staples" },
    { ticker: "KO", name: "Coca-Cola", role: "beverages" },
    { ticker: "PEP", name: "PepsiCo", role: "food & beverages" },
    { ticker: "CL", name: "Colgate-Palmolive", role: "consumer goods" },
    { ticker: "UL", name: "Unilever", role: "consumer goods" },
    { ticker: "WMT", name: "Walmart", role: "retail distribution", terminal: true }
  ]
},
  TSLA: {
  name: "Tesla",
  chain: [
    { ticker: "ALB", name: "Albemarle", role: "lithium", },
    { ticker: "SQM", name: "Sociedad Química y Minera", role: "lithium", },
    { ticker: "CATL", name: "CATL", role: "battery cells" },
    { ticker: "NVDA", name: "NVIDIA", role: "chips" },
    { ticker: "AMD", name: "AMD", role: "chips" },
    { ticker: "AMAT", name: "Applied Materials", role: "equipment" },
    { ticker: "ASML", name: "ASML", role: "lithography" },
    { ticker: "TSLA", name: "Tesla", role: "electric vehicles", terminal: true }
  ]
},
MSFT: {
  name: "Microsoft",
  chain: [
    { ticker: "NVDA", name: "NVIDIA", role: "GPUs" },
    { ticker: "AMD", name: "AMD", role: "CPUs/GPUs" },
    { ticker: "INTC", name: "Intel", role: "processors" },
    { ticker: "DELL", name: "Dell Technologies", role: "servers" },
    { ticker: "HPE", name: "Hewlett Packard Enterprise", role: "servers" },
    { ticker: "ASML", name: "ASML", role: "lithography" },
    { ticker: "AMAT", name: "Applied Materials", role: "equipment" },
    { ticker: "MSFT", name: "Microsoft", role: "software & cloud", terminal: true }
  ]
},
AMZN: {
  name: "Amazon",
  chain: [
    { ticker: "NVDA", name: "NVIDIA", role: "chips" },
    { ticker: "AMD", name: "AMD", role: "processors" },
    { ticker: "INTC", name: "Intel", role: "processors" },
    { ticker: "DELL", name: "Dell Technologies", role: "servers" },
    { ticker: "HPE", name: "Hewlett Packard Enterprise", role: "servers" },
    { ticker: "UPS", name: "United Parcel Service", role: "shipping" },
    { ticker: "FDX", name: "FedEx", role: "shipping" },
    { ticker: "IP", name: "International Paper", role: "packaging" },
    { ticker: "AMZN", name: "Amazon", role: "retail & cloud", terminal: true }
  ]
},
GOOGL: {
  name: "Alphabet (Google)",
  chain: [
    { ticker: "NVDA", name: "NVIDIA", role: "GPUs" },
    { ticker: "AMD", name: "AMD", role: "processors" },
    { ticker: "INTC", name: "Intel", role: "processors" },
    { ticker: "ASML", name: "ASML", role: "lithography" },
    { ticker: "AMAT", name: "Applied Materials", role: "equipment" },
    { ticker: "DELL", name: "Dell Technologies", role: "servers" },
    { ticker: "HPE", name: "Hewlett Packard Enterprise", role: "servers" },
    { ticker: "CSCO", name: "Cisco Systems", role: "networking" },
    { ticker: "GOOGL", name: "Alphabet (Google)", role: "search & cloud", terminal: true }
  ]
},
META: {
  name: "Meta Platforms",
  chain: [
    { ticker: "NVDA", name: "NVIDIA", role: "GPUs" },
    { ticker: "AMD", name: "AMD", role: "processors" },
    { ticker: "INTC", name: "Intel", role: "processors" },
    { ticker: "ASML", name: "ASML", role: "lithography" },
    { ticker: "AMAT", name: "Applied Materials", role: "equipment" },
    { ticker: "DELL", name: "Dell Technologies", role: "servers" },
    { ticker: "HPE", name: "Hewlett Packard Enterprise", role: "servers" },
    { ticker: "CSCO", name: "Cisco Systems", role: "networking" },
    { ticker: "META", name: "Meta Platforms", role: "social media & AI", terminal: true }
  ]
},
ORCL: {
  name: "Oracle",
  chain: [
    { ticker: "NVDA", name: "NVIDIA", role: "GPUs" },
    { ticker: "AMD", name: "AMD", role: "processors" },
    { ticker: "INTC", name: "Intel", role: "processors" },
    { ticker: "ASML", name: "ASML", role: "lithography" },
    { ticker: "AMAT", name: "Applied Materials", role: "equipment" },
    { ticker: "DELL", name: "Dell Technologies", role: "servers" },
    { ticker: "HPE", name: "Hewlett Packard Enterprise", role: "servers" },
    { ticker: "CSCO", name: "Cisco Systems", role: "networking" },
    { ticker: "ORCL", name: "Oracle", role: "database & cloud", terminal: true }
  ]
},
HD: {
  name: "Home Depot",
  chain: [
    { ticker: "MLM", name: "Martin Marietta", role: "aggregates" },
    { ticker: "VMC", name: "Vulcan Materials", role: "aggregates" },
    { ticker: "NUE", name: "Nucor", role: "steel" },
    { ticker: "WY", name: "Weyerhaeuser", role: "lumber" },
    { ticker: "SWK", name: "Stanley Black & Decker", role: "tools" },
    { ticker: "WHR", name: "Whirlpool", role: "appliances" },
    { ticker: "GE", name: "General Electric", role: "appliances" },
    { ticker: "UPS", name: "United Parcel Service", role: "shipping" },
    { ticker: "FDX", name: "FedEx", role: "shipping" },
    { ticker: "HD", name: "Home Depot", role: "retail distribution", terminal: true }
  ]
},
NVDA: {
  name: "NVIDIA",
  chain: [
    { ticker: "TSM", name: "TSMC", role: "foundry" },
    { ticker: "ASML", name: "ASML", role: "lithography" },
    { ticker: "AMAT", name: "Applied Materials", role: "equipment" },
    { ticker: "LRCX", name: "Lam Research", role: "equipment" },
    { ticker: "ASX", name: "ASE Technology", role: "packaging" },
    { ticker: "AMKR", name: "Amkor Technology", role: "packaging" },
    { ticker: "NVDA", name: "NVIDIA", role: "chip design", terminal: true }
  ]
},
PG: {
  name: "Procter & Gamble",
  chain: [
    { ticker: "DOW", name: "Dow Inc.", role: "chemicals" },
    { ticker: "LYB", name: "LyondellBasell", role: "plastics" },
    { ticker: "IP", name: "International Paper", role: "paper" },
    { ticker: "KMB", name: "Kimberly-Clark", role: "paper products" },
    { ticker: "PKG", name: "Packaging Corporation of America", role: "packaging" },
    { ticker: "IFF", name: "International Flavors & Fragrances", role: "ingredients" },
    { ticker: "PG", name: "Procter & Gamble", role: "consumer goods", terminal: true }
  ]
},
JNJ: {
  name: "Johnson & Johnson",
  chain: [
    { ticker: "ABBV", name: "AbbVie", role: "API supplier" },
    { ticker: "BAYRY", name: "Bayer", role: "chemicals" },
    { ticker: "BAX", name: "Baxter International", role: "device components" },
    { ticker: "MDT", name: "Medtronic", role: "medical equipment" },
    { ticker: "PKG", name: "Packaging Corporation of America", role: "packaging" },
    { ticker: "GILD", name: "Gilead Sciences", role: "biologics" },
    { ticker: "JNJ", name: "Johnson & Johnson", role: "pharma & medical devices", terminal: true }
  ]
},
CVS: {
  name: "CVS Health",
  chain: [
    { ticker: "JNJ", name: "Johnson & Johnson", role: "pharma" },
    { ticker: "PFE", name: "Pfizer", role: "pharma" },
    { ticker: "MRK", name: "Merck", role: "pharma" },
    { ticker: "ABBV", name: "AbbVie", role: "pharma" },
    { ticker: "TEVA", name: "Teva Pharmaceutical", role: "generics" },
    { ticker: "PKG", name: "Packaging Corporation of America", role: "packaging" },
    { ticker: "UPS", name: "United Parcel Service", role: "shipping" },
    { ticker: "FDX", name: "FedEx", role: "shipping" },
    { ticker: "CVS", name: "CVS Health", role: "pharmacy & retail", terminal: true }
  ]
},
V: {
  name: "Visa",
  chain: [
    { ticker: "NVDA", name: "NVIDIA", role: "GPUs" },
    { ticker: "AMD", name: "AMD", role: "processors" },
    { ticker: "INTC", name: "Intel", role: "processors" },
    { ticker: "DELL", name: "Dell Technologies", role: "servers" },
    { ticker: "HPE", name: "Hewlett Packard Enterprise", role: "servers" },
    { ticker: "CSCO", name: "Cisco Systems", role: "networking" },
    { ticker: "PANW", name: "Palo Alto Networks", role: "security" },
    { ticker: "V", name: "Visa", role: "payments network", terminal: true }
  ]
},
RTX: {
  name: "RTX Corporation",
  chain: [
    { ticker: "NUE", name: "Nucor", role: "steel" },
    { ticker: "ATI", name: "ATI Inc.", role: "specialty metals" },
    { ticker: "CRS", name: "Carpenter Technology", role: "alloys" },
    { ticker: "TXN", name: "Texas Instruments", role: "semiconductors" },
    { ticker: "ADI", name: "Analog Devices", role: "sensors" },
    { ticker: "AMAT", name: "Applied Materials", role: "equipment" },
    { ticker: "LRCX", name: "Lam Research", role: "equipment" },
    { ticker: "RTX", name: "RTX Corporation", role: "aerospace & defense", terminal: true }
  ]
},
JPM: {
  name: "JPMorgan Chase",
  chain: [
    { ticker: "NVDA", name: "NVIDIA", role: "GPUs" },
    { ticker: "AMD", name: "AMD", role: "processors" },
    { ticker: "INTC", name: "Intel", role: "processors" },
    { ticker: "DELL", name: "Dell Technologies", role: "servers" },
    { ticker: "HPE", name: "Hewlett Packard Enterprise", role: "servers" },
    { ticker: "CSCO", name: "Cisco Systems", role: "networking" },
    { ticker: "PANW", name: "Palo Alto Networks", role: "security" },
    { ticker: "JPM", name: "JPMorgan Chase", role: "financial services", terminal: true }
  ]
},
CVX: {
  name: "Chevron",
  chain: [
    { ticker: "SLB", name: "Schlumberger", role: "oil services" },
    { ticker: "HAL", name: "Halliburton", role: "oil services" },
    { ticker: "BKR", name: "Baker Hughes", role: "oil services" },
    { ticker: "CAT", name: "Caterpillar", role: "machinery" },
    { ticker: "DE", name: "Deere & Co.", role: "equipment" },
    { ticker: "NUE", name: "Nucor", role: "steel" },
    { ticker: "X", name: "U.S. Steel", role: "steel" },
    { ticker: "FLR", name: "Fluor", role: "engineering" },
    { ticker: "CVX", name: "Chevron", role: "oil & gas", terminal: true }
  ]
},
KO: {
  name: "Coca-Cola",
  chain: [
    { ticker: "ADM", name: "Archer Daniels Midland", role: "sweeteners" },
    { ticker: "INGR", name: "Ingredion", role: "ingredients" },
    { ticker: "AA", name: "Alcoa", role: "aluminum" },
    { ticker: "BLL", name: "Ball Corporation", role: "packaging" },
    { ticker: "PKG", name: "Packaging Corporation of America", role: "packaging" },
    { ticker: "ECL", name: "Ecolab", role: "water systems" },
    { ticker: "KO", name: "Coca-Cola", role: "beverages", terminal: true }
  ]
},
CAT: {
  name: "Caterpillar",
  chain: [
    { ticker: "NUE", name: "Nucor", role: "steel" },
    { ticker: "X", name: "U.S. Steel", role: "steel" },
    { ticker: "ATI", name: "ATI Inc.", role: "alloys" },
    { ticker: "CRS", name: "Carpenter Technology", role: "metals" },
    { ticker: "CMI", name: "Cummins", role: "engines" },
    { ticker: "PH", name: "Parker-Hannifin", role: "hydraulics" },
    { ticker: "TXN", name: "Texas Instruments", role: "semiconductors" },
    { ticker: "ADI", name: "Analog Devices", role: "sensors" },
    { ticker: "CAT", name: "Caterpillar", role: "heavy machinery", terminal: true }
  ]
},
CSCO: {
  name: "Cisco Systems",
  chain: [
    { ticker: "TSM", name: "TSMC", role: "foundry" },
    { ticker: "AVGO", name: "Broadcom", role: "network chips" },
    { ticker: "MRVL", name: "Marvell Technology", role: "data chips" },
    { ticker: "INTC", name: "Intel", role: "processors" },
    { ticker: "ASML", name: "ASML", role: "lithography" },
    { ticker: "AMAT", name: "Applied Materials", role: "equipment" },
    { ticker: "LRCX", name: "Lam Research", role: "equipment" },
    { ticker: "JBL", name: "Jabil", role: "electronics manufacturing" },
    { ticker: "FLEX", name: "Flex Ltd.", role: "manufacturing" },
    { ticker: "CSCO", name: "Cisco Systems", role: "networking hardware", terminal: true }
  ]
},
MRK: {
  name: "Merck",
  chain: [
    { ticker: "DD", name: "DuPont", role: "chemicals" },
    { ticker: "DOW", name: "Dow Inc.", role: "chemicals" },
    { ticker: "IFF", name: "International Flavors & Fragrances", role: "ingredients" },
    { ticker: "AMGN", name: "Amgen", role: "biologics" },
    { ticker: "GILD", name: "Gilead Sciences", role: "biologics" },
    { ticker: "PKG", name: "Packaging Corporation of America", role: "packaging" },
    { ticker: "TMO", name: "Thermo Fisher Scientific", role: "lab equipment" },
    { ticker: "MRK", name: "Merck", role: "pharmaceuticals", terminal: true }
  ]
},
UNH: {
  name: "UnitedHealth Group",
  chain: [
    { ticker: "NVDA", name: "NVIDIA", role: "compute" },
    { ticker: "AMD", name: "AMD", role: "processors" },
    { ticker: "INTC", name: "Intel", role: "processors" },
    { ticker: "DELL", name: "Dell Technologies", role: "servers" },
    { ticker: "HPE", name: "Hewlett Packard Enterprise", role: "servers" },
    { ticker: "CSCO", name: "Cisco Systems", role: "networking" },
    { ticker: "ORCL", name: "Oracle", role: "health data systems" },
    { ticker: "PANW", name: "Palo Alto Networks", role: "security" },
    { ticker: "UNH", name: "UnitedHealth Group", role: "healthcare services", terminal: true }
  ]
},
GS: {
  name: "Goldman Sachs",
  chain: [
    { ticker: "NVDA", name: "NVIDIA", role: "compute" },
    { ticker: "AMD", name: "AMD", role: "processors" },
    { ticker: "INTC", name: "Intel", role: "processors" },
    { ticker: "DELL", name: "Dell Technologies", role: "servers" },
    { ticker: "HPE", name: "Hewlett Packard Enterprise", role: "servers" },
    { ticker: "CSCO", name: "Cisco Systems", role: "networking" },
    { ticker: "ORCL", name: "Oracle", role: "data systems" },
    { ticker: "PANW", name: "Palo Alto Networks", role: "security" },
    { ticker: "GS", name: "Goldman Sachs", role: "investment banking", terminal: true }
  ]
},
IBM: {
  name: "IBM",
  chain: [
    { ticker: "TSM", name: "TSMC", role: "foundry" },
    { ticker: "INTC", name: "Intel", role: "processors" },
    { ticker: "AMD", name: "AMD", role: "processors" },
    { ticker: "ASML", name: "ASML", role: "lithography" },
    { ticker: "AMAT", name: "Applied Materials", role: "equipment" },
    { ticker: "LRCX", name: "Lam Research", role: "equipment" },
    { ticker: "DELL", name: "Dell Technologies", role: "servers" },
    { ticker: "HPE", name: "Hewlett Packard Enterprise", role: "servers" },
    { ticker: "CSCO", name: "Cisco Systems", role: "networking" },
    { ticker: "ORCL", name: "Oracle", role: "data systems" },
    { ticker: "IBM", name: "IBM", role: "enterprise tech", terminal: true }
  ]
},
MCD: {
  name: "McDonald's",
  chain: [
    { ticker: "TSN", name: "Tyson Foods", role: "protein" },
    { ticker: "HRL", name: "Hormel Foods", role: "protein" },
    { ticker: "ADM", name: "Archer Daniels Midland", role: "agriculture" },
    { ticker: "BG", name: "Bunge", role: "agriculture" },
    { ticker: "PKG", name: "Packaging Corporation of America", role: "packaging" },
    { ticker: "KO", name: "Coca-Cola", role: "beverages" },
    { ticker: "UPS", name: "United Parcel Service", role: "shipping" },
    { ticker: "FDX", name: "FedEx", role: "shipping" },
    { ticker: "MCD", name: "McDonald's", role: "food service", terminal: true }
  ]
},
VZ: {
  name: "Verizon",
  chain: [
    { ticker: "QCOM", name: "Qualcomm", role: "wireless chips" },
    { ticker: "AVGO", name: "Broadcom", role: "network chips" },
    { ticker: "INTC", name: "Intel", role: "processors" },
    { ticker: "ERIC", name: "Ericsson", role: "network equipment" },
    { ticker: "NOK", name: "Nokia", role: "network equipment" },
    { ticker: "COR", name: "Corning", role: "fiber optics" },
    { ticker: "DELL", name: "Dell Technologies", role: "servers" },
    { ticker: "HPE", name: "Hewlett Packard Enterprise", role: "servers" },
    { ticker: "CSCO", name: "Cisco Systems", role: "networking" },
    { ticker: "VZ", name: "Verizon", role: "telecom services", terminal: true }
  ]
},
AXP: {
  name: "American Express",
  chain: [
    { ticker: "NVDA", name: "NVIDIA", role: "compute" },
    { ticker: "AMD", name: "AMD", role: "processors" },
    { ticker: "INTC", name: "Intel", role: "processors" },
    { ticker: "DELL", name: "Dell Technologies", role: "servers" },
    { ticker: "HPE", name: "Hewlett Packard Enterprise", role: "servers" },
    { ticker: "CSCO", name: "Cisco Systems", role: "networking" },
    { ticker: "ORCL", name: "Oracle", role: "data systems" },
    { ticker: "PANW", name: "Palo Alto Networks", role: "security" },
    { ticker: "AXP", name: "American Express", role: "payments & credit", terminal: true }
  ]
},
AMGN: {
  name: "Amgen",
  chain: [
    { ticker: "TMO", name: "Thermo Fisher Scientific", role: "lab equipment" },
    { ticker: "DHR", name: "Danaher", role: "biotech tools" },
    { ticker: "DD", name: "DuPont", role: "chemicals" },
    { ticker: "DOW", name: "Dow Inc.", role: "chemicals" },
    { ticker: "A", name: "Agilent Technologies", role: "lab systems" },
    { ticker: "PKG", name: "Packaging Corporation of America", role: "packaging" },
    { ticker: "AMGN", name: "Amgen", role: "biologics", terminal: true }
  ]
},
CRM: {
  name: "Salesforce",
  chain: [
    { ticker: "AMZN", name: "Amazon", role: "cloud infrastructure" },
    { ticker: "MSFT", name: "Microsoft", role: "cloud infrastructure" },
    { ticker: "NVDA", name: "NVIDIA", role: "compute" },
    { ticker: "AMD", name: "AMD", role: "processors" },
    { ticker: "INTC", name: "Intel", role: "processors" },
    { ticker: "DELL", name: "Dell Technologies", role: "servers" },
    { ticker: "HPE", name: "Hewlett Packard Enterprise", role: "servers" },
    { ticker: "CSCO", name: "Cisco Systems", role: "networking" },
    { ticker: "ORCL", name: "Oracle", role: "data systems" },
    { ticker: "CRM", name: "Salesforce", role: "cloud software", terminal: true }
  ]
},
DIS: {
  name: "Disney",
  chain: [
    { ticker: "SONY", name: "Sony", role: "cameras & media equipment" },
    { ticker: "AMZN", name: "Amazon", role: "cloud infrastructure" },
    { ticker: "MSFT", name: "Microsoft", role: "cloud infrastructure" },
    { ticker: "NVDA", name: "NVIDIA", role: "compute" },
    { ticker: "AMD", name: "AMD", role: "processors" },
    { ticker: "DELL", name: "Dell Technologies", role: "servers" },
    { ticker: "CSCO", name: "Cisco Systems", role: "networking" },
    { ticker: "CAT", name: "Caterpillar", role: "machinery" },
    { ticker: "NUE", name: "Nucor", role: "steel" },
    { ticker: "DIS", name: "Disney", role: "media & entertainment", terminal: true }
  ]
},
BA: {
  name: "Boeing",
  chain: [
    { ticker: "ATI", name: "ATI Inc.", role: "aerospace metals" },
    { ticker: "CRS", name: "Carpenter Technology", role: "alloys" },
    { ticker: "NUE", name: "Nucor", role: "steel" },
    { ticker: "GE", name: "General Electric", role: "jet engines" },
    { ticker: "HON", name: "Honeywell", role: "avionics" },
    { ticker: "RTX", name: "RTX Corporation", role: "systems" },
    { ticker: "TXN", name: "Texas Instruments", role: "chips" },
    { ticker: "ADI", name: "Analog Devices", role: "sensors" },
    { ticker: "FAST", name: "Fastenal", role: "components" },
    { ticker: "BA", name: "Boeing", role: "aerospace manufacturing", terminal: true }
  ]
},
HON: {
  name: "Honeywell",
  chain: [
    { ticker: "NUE", name: "Nucor", role: "steel" },
    { ticker: "ATI", name: "ATI Inc.", role: "specialty metals" },
    { ticker: "CRS", name: "Carpenter Technology", role: "alloys" },
    { ticker: "TXN", name: "Texas Instruments", role: "chips" },
    { ticker: "ADI", name: "Analog Devices", role: "sensors" },
    { ticker: "PH", name: "Parker-Hannifin", role: "hydraulics" },
    { ticker: "DD", name: "DuPont", role: "chemicals" },
    { ticker: "HON", name: "Honeywell", role: "industrial & aerospace systems", terminal: true }
  ]
},
NKE: {
  name: "Nike",
  chain: [
    { ticker: "DD", name: "DuPont", role: "synthetic materials" },
    { ticker: "LYB", name: "LyondellBasell", role: "plastics" },
    { ticker: "VFC", name: "VF Corporation", role: "apparel manufacturing" },
    { ticker: "PVH", name: "PVH Corp.", role: "apparel manufacturing" },
    { ticker: "PKG", name: "Packaging Corporation of America", role: "packaging" },
    { ticker: "UPS", name: "United Parcel Service", role: "shipping" },
    { ticker: "FDX", name: "FedEx", role: "shipping" },
    { ticker: "NKE", name: "Nike", role: "footwear & apparel", terminal: true }
  ]
},
SHW: {
  name: "Sherwin-Williams",
  chain: [
    { ticker: "DOW", name: "Dow Inc.", role: "chemicals" },
    { ticker: "DD", name: "DuPont", role: "chemicals" },
    { ticker: "LYB", name: "LyondellBasell", role: "petrochemicals" },
    { ticker: "FCX", name: "Freeport-McMoRan", role: "minerals" },
    { ticker: "PKG", name: "Packaging Corporation of America", role: "packaging" },
    { ticker: "ITW", name: "Illinois Tool Works", role: "industrial equipment" },
    { ticker: "SHW", name: "Sherwin-Williams", role: "coatings & paint", terminal: true }
  ]
},
MMM: {
  name: "3M",
  chain: [
    { ticker: "DD", name: "DuPont", role: "chemicals" },
    { ticker: "LYB", name: "LyondellBasell", role: "plastics" },
    { ticker: "FCX", name: "Freeport-McMoRan", role: "minerals" },
    { ticker: "EMN", name: "Eastman Chemical", role: "specialty chemicals" },
    { ticker: "AVY", name: "Avery Dennison", role: "labels & films" },
    { ticker: "TXN", name: "Texas Instruments", role: "chips & sensors" },
    { ticker: "PH", name: "Parker-Hannifin", role: "hydraulics & motion" },
    { ticker: "MMM", name: "3M", role: "diversified industrial products", terminal: true }
  ]
},
AVGO: {
  name: "Broadcom",
  chain: [
    { ticker: "LRCX", name: "Lam Research", role: "semiconductor equipment" },
    { ticker: "ASML", name: "ASML Holding", role: "lithography machines" },
    { ticker: "AMAT", name: "Applied Materials", role: "chip fabrication equipment" },
    { ticker: "TSM", name: "Taiwan Semiconductor Manufacturing Co.", role: "foundry" },
    { ticker: "INTC", name: "Intel", role: "chip design & integration" },
    { ticker: "QCOM", name: "Qualcomm", role: "communications chips" },
    { ticker: "AVGO", name: "Broadcom", role: "semiconductors & infrastructure software", terminal: true }
  ]
},
LLY: {
  name: "Eli Lilly",
  chain: [
    { ticker: "BMRN", name: "BioMarin Pharmaceutical", role: "biotech partnerships & research" },
    { ticker: "GILD", name: "Gilead Sciences", role: "chemical intermediates & API collaboration" },
    { ticker: "REGN", name: "Regeneron Pharmaceuticals", role: "biologic research & development" },
    { ticker: "MCK", name: "McKesson", role: "pharmaceutical distribution" },
    { ticker: "LLY", name: "Eli Lilly", role: "pharmaceuticals & biopharma", terminal: true }
  ]
},
TSM: {
  name: "TSMC",
  chain: [
    { ticker: "LRCX", name: "Lam Research", role: "semiconductor fabrication equipment" },
    { ticker: "ASML", name: "ASML Holding", role: "lithography machines" },
    { ticker: "AMAT", name: "Applied Materials", role: "chip fabrication equipment" },
    { ticker: "SUM", name: "Sumco Corporation", role: "silicon wafers" },
    { ticker: "TOK", name: "Tokyo Electron", role: "semiconductor equipment" },
    { ticker: "AAPL", name: "Apple", role: "major chip customer / integration" },
    { ticker: "NVDA", name: "NVIDIA", role: "major chip customer / GPU designs" },
    { ticker: "TSM", name: "TSMC", role: "semiconductor foundry", terminal: true }
  ]
},
TMO: {
  name: "Thermo Fisher Scientific",
  chain: [
    { ticker: "MERCK", name: "Merck KGaA", role: "lab chemicals & reagents" },
    { ticker: "SART", name: "Sartorius AG", role: "bioprocessing equipment" },
    { ticker: "BMRN", name: "BioMarin Pharmaceutical", role: "biotech partnerships" },
    { ticker: "BDX", name: "Becton Dickinson", role: "medical devices & lab equipment" },
    { ticker: "MCK", name: "McKesson", role: "distribution & logistics" },
    { ticker: "TMO", name: "Thermo Fisher Scientific", role: "life sciences instruments & consumables", terminal: true }
  ]
},
NFLX: {
  name: "Netflix",
  chain: [
    { ticker: "AMZN", name: "Amazon Web Services", role: "cloud infrastructure & hosting" },
    { ticker: "GOOGL", name: "Alphabet / Google Cloud", role: "cloud infrastructure & AI tools" },
    { ticker: "SONY", name: "Sony Pictures Entertainment", role: "content licensing & production" },
    { ticker: "DIS", name: "Disney", role: "content licensing & partnerships" },
    { ticker: "NFLX", name: "Netflix", role: "streaming platform & original content", terminal: true }
  ]
}
};

export default supplyChainTree;