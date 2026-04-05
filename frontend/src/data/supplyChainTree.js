const supplyChainTree = {
AAPL: {
  name: "Apple",
  root: "aapl",
  nodes: [
    // LAYER 0 — SEMICONDUCTOR EQUIPMENT
    { id: "asml", ticker: "ASML", name: "ASML", role: "EUV lithography machines enabling advanced-node production for Apple silicon at TSMC" },

    // LAYER 1 — SILICON / CORE CHIP INPUTS (MOST IMPORTANT)
    { id: "tsm", ticker: "TSM", name: "TSMC", role: "sole manufacturer of Apple A-series and M-series chips (3nm/5nm nodes)" },
    { id: "avgo", ticker: "AVGO", name: "Broadcom", role: "wireless connectivity chips (WiFi, Bluetooth, RF components)" },
    { id: "qcom", ticker: "QCOM", name: "Qualcomm", role: "baseband modems for iPhone connectivity (transition ongoing)" },
    { id: "crus", ticker: "CRUS", name: "Cirrus Logic", role: "audio chips and signal processing" },
    { id: "txn", ticker: "TXN", name: "Texas Instruments", role: "power management ICs" },
    { id: "nxp", ticker: "NXPI", name: "NXP Semiconductors", role: "NFC chips enabling Apple Pay" },
    { id: "swks", ticker: "SWKS", name: "Skyworks", role: "RF chips for wireless communication" },
    { id: "qrvo", ticker: "QRVO", name: "Qorvo", role: "RF front-end modules" },

    // LAYER 2 — COMPONENTS (DISPLAY / CAMERA / MEMORY / MATERIALS)
    { id: "ssnl", ticker: "SSNLF", name: "Samsung Display", role: "primary OLED display supplier for iPhone" },
    { id: "lgd", ticker: "LPL", name: "LG Display", role: "secondary OLED supplier" },
    { id: "boe", ticker: "BOE", name: "BOE Technology", role: "entry-level OLED panels" },

    { id: "sony", ticker: "SONY", name: "Sony", role: "image sensors for iPhone cameras" },

    { id: "mu", ticker: "MU", name: "Micron", role: "DRAM and NAND flash memory" },
    { id: "ssnl_mem", ticker: "SSNLF", name: "Samsung Electronics", role: "NAND flash storage" },

    { id: "glw", ticker: "GLW", name: "Corning", role: "Ceramic Shield and Gorilla Glass" },

    // LAYER 3 — ASSEMBLY / MANUFACTURING (CRITICAL CHOKEPOINT)
    { id: "fxcn", ticker: "FXCOF", name: "Foxconn", role: "primary iPhone, Mac, and iPad assembler" },
    { id: "peg", ticker: "PEGATRON", name: "Pegatron", role: "secondary iPhone assembler" },
    { id: "lxs", ticker: "LXS", name: "Luxshare", role: "AirPods, Apple Watch, and growing iPhone assembly share" },
    { id: "qn", ticker: "QUANTA", name: "Quanta Computer", role: "MacBook assembly" },

    // CENTER
    { id: "aapl", ticker: "AAPL", name: "Apple", role: "designs hardware, software, chips, and ecosystem; controls full product stack" },

    // LAYER 5 — DISTRIBUTION / VOLUME DRIVERS (CRITICAL)
    { id: "vz", ticker: "VZ", name: "Verizon", role: "major iPhone carrier partner and volume driver" },
    { id: "t", ticker: "T", name: "AT&T", role: "major carrier partner" },
    { id: "tmus", ticker: "TMUS", name: "T-Mobile", role: "major carrier partner" },

    { id: "bb", ticker: "BBY", name: "Best Buy", role: "consumer electronics retail distribution" },
    { id: "amzn_c", ticker: "AMZN", name: "Amazon", role: "online retail distribution channel" },

    // LAYER 6 — ECOSYSTEM / SERVICES (MARGIN ENGINE)
    { id: "googl", ticker: "GOOGL", name: "Google", role: "default search engine (~$18–20B annual payments to Apple)" },
    { id: "dev", ticker: "DEV", name: "Developers", role: "App Store ecosystem generating platform revenue (15–30% take rate)" },
    { id: "subs", ticker: "SUBS", name: "Subscribers", role: "iCloud, Apple Music, TV+, Arcade, Apple Pay users" }
  ],

  edges: [
    // LAYER 0 → LAYER 1
    { source: "asml", target: "tsm" },

    // ALSO CRITICAL DIRECT DEPENDENCY
    { source: "asml", target: "aapl" },

    // LAYER 1 → LAYER 2
    { source: "tsm", target: "ssnl" },
    { source: "avgo", target: "sony" },
    { source: "qcom", target: "mu" },
    { source: "crus", target: "ssnl_mem" },
    { source: "txn", target: "glw" },
    { source: "nxp", target: "sony" },
    { source: "swks", target: "ssnl" },
    { source: "qrvo", target: "lgd" },

    // LAYER 2 → LAYER 3
    { source: "ssnl", target: "fxcn" },
    { source: "lgd", target: "peg" },
    { source: "boe", target: "lxs" },
    { source: "sony", target: "fxcn" },
    { source: "mu", target: "peg" },
    { source: "ssnl_mem", target: "lxs" },
    { source: "glw", target: "fxcn" },

    // LAYER 3 → APPLE
    { source: "fxcn", target: "aapl" },
    { source: "peg", target: "aapl" },
    { source: "lxs", target: "aapl" },
    { source: "qn", target: "aapl" },

    // APPLE → DISTRIBUTION
    { source: "aapl", target: "vz" },
    { source: "aapl", target: "t" },
    { source: "aapl", target: "tmus" },
    { source: "aapl", target: "bb" },
    { source: "aapl", target: "amzn_c" },

    // DISTRIBUTION → ECOSYSTEM
    { source: "vz", target: "subs" },
    { source: "t", target: "subs" },
    { source: "tmus", target: "subs" },

    { source: "bb", target: "dev" },
    { source: "amzn_c", target: "dev" },

    // ECOSYSTEM FEEDBACK LOOP
    { source: "googl", target: "aapl" },
    { source: "dev", target: "aapl" },
    { source: "subs", target: "aapl" }
  ]
},
WMT: {
  name: "Walmart",
  root: "wmt",
  nodes: [
    // LAYER 1 — GLOBAL SUPPLIERS (SIMPLIFIED)
    { id: "pg", ticker: "PG", name: "Procter & Gamble", role: "largest CPG supplier (household, personal care)" },
    { id: "pep", ticker: "PEP", name: "PepsiCo", role: "beverages and snacks (top Walmart partner)" },
    { id: "ko", ticker: "KO", name: "Coca-Cola", role: "beverages and juices" },
    { id: "nestle", ticker: "NSRGY", name: "Nestlé", role: "global food and consumer goods" },

    { id: "tsn", ticker: "TSN", name: "Tyson Foods", role: "largest meat supplier (beef, chicken, pork)" },
    { id: "carg", ticker: "CARG", name: "Cargill", role: "meat processing and agricultural supply" },

    { id: "aapl", ticker: "AAPL", name: "Apple", role: "consumer electronics supplier (iPhone, iPad, AirPods)" },
    { id: "ssnl", ticker: "SSNLF", name: "Samsung", role: "TVs, appliances, electronics" },

    { id: "china", ticker: "CHINA", name: "China Manufacturing", role: "largest sourcing hub for private label and general merchandise" },

    // LAYER 2 — LOGISTICS / INFRASTRUCTURE / TECH
    { id: "msft", ticker: "MSFT", name: "Microsoft", role: "Azure cloud and AI infrastructure for Walmart systems" },
    { id: "orcl", ticker: "ORCL", name: "Oracle", role: "financial systems and data infrastructure" },
    { id: "crm", ticker: "CRM", name: "Salesforce", role: "CRM and digital tools" },
    { id: "ibm", ticker: "IBM", name: "IBM", role: "supply chain and enterprise software (Sterling)" },

    { id: "sym", ticker: "SYM", name: "Symbotic", role: "warehouse automation and robotics (critical partner)" },

    { id: "jbht", ticker: "JBHT", name: "J.B. Hunt", role: "freight and trucking partner" },
    { id: "dhl", ticker: "DHL", name: "DHL", role: "global logistics partner" },
    { id: "xpo", ticker: "XPO", name: "XPO Logistics", role: "transportation and freight services" },

    { id: "murphy", ticker: "MUSA", name: "Murphy USA", role: "fuel stations and logistics partner" },

    // CENTER
    { id: "wmt", ticker: "WMT", name: "Walmart", role: "global retailer, logistics operator, marketplace, and private label platform" },

    // LAYER 5 — DISTRIBUTION NETWORK
    { id: "dc", ticker: "DC", name: "Distribution Centers", role: "6,000+ DCs and fulfillment centers globally" },
    { id: "fleet", ticker: "FLEET", name: "Private Truck Fleet", role: "10,000 tractors and 80,000 trailers" },

    // FINAL 6 — DEMAND
    { id: "consumer", ticker: "CONS", name: "Retail Consumers", role: "255M weekly shoppers; grocery-driven demand" },
    { id: "ecom", ticker: "ECOM", name: "E-Commerce Users", role: "Walmart.com and delivery customers" },
    { id: "sams", ticker: "SAMS", name: "Sam's Club Members", role: "membership warehouse customers" },
    { id: "seller", ticker: "SELL", name: "Marketplace Sellers", role: "third-party sellers" },
    { id: "intl", ticker: "INTL", name: "International Customers", role: "Mexico, China, India markets" },
    { id: "ads", ticker: "ADS", name: "Advertising Clients", role: "Walmart Connect advertisers" }
  ],

  edges: [
    // LAYER 1 → LAYER 2
    { source: "pg", target: "sym" },
    { source: "pep", target: "jbht" },
    { source: "ko", target: "dhl" },
    { source: "nestle", target: "xpo" },

    { source: "tsn", target: "sym" },
    { source: "carg", target: "xpo" },

    { source: "aapl", target: "jbht" },
    { source: "ssnl", target: "dhl" },

    { source: "china", target: "sym" },

    // LAYER 2 → WALMART
    { source: "msft", target: "wmt" },
    { source: "orcl", target: "wmt" },
    { source: "crm", target: "wmt" },
    { source: "ibm", target: "wmt" },
    { source: "sym", target: "wmt" },
    { source: "jbht", target: "wmt" },
    { source: "dhl", target: "wmt" },
    { source: "xpo", target: "wmt" },
    { source: "murphy", target: "wmt" },

    // WALMART → DISTRIBUTION
    { source: "wmt", target: "dc" },
    { source: "wmt", target: "fleet" },

    // DISTRIBUTION → FINAL 6
    { source: "dc", target: "consumer" },
    { source: "fleet", target: "consumer" },

    { source: "dc", target: "ecom" },
    { source: "fleet", target: "ecom" },

    { source: "dc", target: "sams" },
    { source: "dc", target: "seller" },

    { source: "dc", target: "intl" },
    { source: "dc", target: "ads" }
  ]
},
TSLA: {
  name: "Tesla",
  root: "tsla",
  nodes: [
    // LAYER 1 — BATTERY CELLS & CRITICAL MATERIALS (MOST IMPORTANT)
    { id: "pana", ticker: "PCRFY", name: "Panasonic", role: "primary North America battery partner (2170 & 4680 cells)" },
    { id: "catl", ticker: "CATL", name: "CATL", role: "LFP battery supplier for China and energy storage" },
    { id: "lg", ticker: "LGES", name: "LG Energy Solution", role: "high-nickel battery supplier" },
    { id: "byd", ticker: "BYDDY", name: "BYD", role: "Blade LFP battery supplier (China/Europe)" },

    { id: "alb", ticker: "ALB", name: "Albemarle", role: "lithium supplier" },
    { id: "sqm", ticker: "SQM", name: "SQM", role: "lithium supplier (Chile)" },
    { id: "bhp", ticker: "BHP", name: "BHP", role: "nickel supplier" },
    { id: "glenc", ticker: "GLEN", name: "Glencore", role: "cobalt supplier" },

    // LAYER 2 — CHIPS / ELECTRONICS / COMPONENTS
    { id: "tsm", ticker: "TSM", name: "TSMC", role: "manufactures Tesla FSD and Dojo chips (critical dependency)" },
    { id: "nvda", ticker: "NVDA", name: "NVIDIA", role: "AI training GPUs for FSD models" },
    { id: "on", ticker: "ON", name: "ON Semiconductor", role: "SiC power chips for inverters" },
    { id: "wolf", ticker: "WOLF", name: "Wolfspeed", role: "SiC wafers for EV power systems" },
    { id: "stm", ticker: "STM", name: "STMicroelectronics", role: "power electronics and controllers" },

    // LAYER 3 — MANUFACTURING / AUTOMATION (CRITICAL CHOKEPOINT)
    { id: "idra", ticker: "IDRA", name: "IDRA Group", role: "Giga Press machines for large-scale casting" },
    { id: "kuka", ticker: "KUKA", name: "KUKA", role: "factory robotics and automation" },
    { id: "abb", ticker: "ABB", name: "ABB", role: "industrial automation and robotics" },

    { id: "novelis", ticker: "NOVELIS", name: "Novelis", role: "aluminum supply for giga castings" },
    { id: "posco", ticker: "PKX", name: "POSCO", role: "electrical steel for motors and structures" },

    // CENTER
    { id: "tsla", ticker: "TSLA", name: "Tesla", role: "EV manufacturing, energy storage, AI software, and vertically integrated platform" },

    // FINAL 6 — DEMAND DRIVERS (COMPRESSED)
    { id: "consumer", ticker: "CONS", name: "EV Consumers", role: "direct-to-consumer vehicle buyers (no dealerships)" },
    { id: "fleet", ticker: "FLEET", name: "Fleet Buyers", role: "Hertz, Uber drivers, corporate EV fleets" },
    { id: "energy", ticker: "UTIL", name: "Utilities", role: "Megapack grid-scale storage buyers" },
    { id: "home", ticker: "HOME", name: "Homeowners", role: "Powerwall and solar customers" },
    { id: "fsd", ticker: "FSD", name: "FSD Subscribers", role: "high-margin software revenue base" },
    { id: "oem", ticker: "OEM", name: "Other Automakers", role: "Supercharger network users (Ford, GM, etc.)" }
  ],

  edges: [
    // LAYER 1 → LAYER 2
    { source: "pana", target: "tsm" },
    { source: "catl", target: "nvda" },
    { source: "lg", target: "on" },
    { source: "byd", target: "wolf" },

    { source: "alb", target: "tsm" },
    { source: "sqm", target: "nvda" },
    { source: "bhp", target: "on" },
    { source: "glenc", target: "stm" },

    // LAYER 2 → LAYER 3
    { source: "tsm", target: "idra" },
    { source: "nvda", target: "kuka" },
    { source: "on", target: "abb" },
    { source: "wolf", target: "idra" },
    { source: "stm", target: "abb" },

    { source: "idra", target: "novelis" },
    { source: "kuka", target: "posco" },

    // LAYER 3 → TESLA
    { source: "idra", target: "tsla" },
    { source: "kuka", target: "tsla" },
    { source: "abb", target: "tsla" },
    { source: "novelis", target: "tsla" },
    { source: "posco", target: "tsla" },

    // TESLA → FINAL 6
    { source: "tsla", target: "consumer" },
    { source: "tsla", target: "fleet" },
    { source: "tsla", target: "energy" },
    { source: "tsla", target: "home" },
    { source: "tsla", target: "fsd" },
    { source: "tsla", target: "oem" }
  ]
},
MSFT: {
  name: "Microsoft",
  root: "msft",
  nodes: [
    // LAYER 1 — AI / MODEL LAYER (MOST IMPORTANT)
    { id: "openai", ticker: "OPENAI", name: "OpenAI", role: "primary AI model partner powering Copilot and Azure AI (most critical upstream dependency)" },

    // LAYER 2 — SEMICONDUCTORS / AI HARDWARE (PHYSICAL FOUNDATION)
    { id: "nvda", ticker: "NVDA", name: "NVIDIA", role: "primary AI GPU supplier (H100, Blackwell systems)" },
    { id: "amd", ticker: "AMD", name: "AMD", role: "EPYC CPUs and MI300 AI accelerators for Azure" },
    { id: "intc", ticker: "INTC", name: "Intel", role: "Xeon CPUs and foundry partner for custom chips (Maia)" },
    { id: "mu", ticker: "MU", name: "Micron", role: "HBM and DRAM memory for AI infrastructure" },
    { id: "avgo", ticker: "AVGO", name: "Broadcom", role: "networking chips and data center ASICs" },
    { id: "qcom", ticker: "QCOM", name: "Qualcomm", role: "ARM chips for Surface and Copilot+ PCs" },

    // LAYER 3 — DATA CENTER / ENERGY / INFRASTRUCTURE
    { id: "ceg", ticker: "CEG", name: "Constellation Energy", role: "nuclear energy provider (20-year power deal — critical for AI scaling)" },

    { id: "orcl", ticker: "ORCL", name: "Oracle", role: "Oracle Database@Azure integration (hybrid cloud infrastructure)" },
    { id: "sap", ticker: "SAP", name: "SAP", role: "enterprise workloads running on Azure" },
    { id: "crm", ticker: "CRM", name: "Salesforce", role: "data integration and enterprise ecosystem partner" },

    // CENTER
    { id: "msft", ticker: "MSFT", name: "Microsoft", role: "cloud (Azure), AI (Copilot), productivity (M365), gaming, and enterprise software platform" },

    // FINAL 6 — DOWNSTREAM DEMAND DRIVERS
    { id: "cloud", ticker: "CLOUD", name: "Azure Customers", role: "enterprise cloud clients driving Azure revenue growth" },
    { id: "enterprise", ticker: "ENT", name: "Enterprise Software Users", role: "Microsoft 365, Teams, and enterprise productivity users" },
    { id: "gov", ticker: "GOV", name: "Government", role: "DoD and public sector cloud contracts (secure Azure)" },
    { id: "dev", ticker: "DEV", name: "Developers", role: "GitHub ecosystem and Copilot users (100M+ developers)" },
    { id: "gaming", ticker: "GAME", name: "Gaming Users", role: "Xbox, Activision, Game Pass ecosystem" },
    { id: "oem", ticker: "OEM", name: "PC OEMs", role: "Windows licensing via Dell, HP, Lenovo" }
  ],

  edges: [
    // LAYER 1 → LAYER 2
    { source: "openai", target: "nvda" },

    // LAYER 2 → LAYER 3
    { source: "nvda", target: "ceg" },
    { source: "amd", target: "orcl" },
    { source: "intc", target: "sap" },
    { source: "mu", target: "orcl" },
    { source: "avgo", target: "sap" },
    { source: "qcom", target: "crm" },

    // LAYER 3 → MICROSOFT
    { source: "ceg", target: "msft" },
    { source: "orcl", target: "msft" },
    { source: "sap", target: "msft" },
    { source: "crm", target: "msft" },

    // ALSO DIRECT DEPENDENCIES
    { source: "nvda", target: "msft" },
    { source: "amd", target: "msft" },
    { source: "intc", target: "msft" },
    { source: "mu", target: "msft" },

    // MICROSOFT → FINAL 6
    { source: "msft", target: "cloud" },
    { source: "msft", target: "enterprise" },
    { source: "msft", target: "gov" },
    { source: "msft", target: "dev" },
    { source: "msft", target: "gaming" },
    { source: "msft", target: "oem" }
  ]
},
AMZN: {
  name: "Amazon",
  root: "amzn",
  nodes: [
    // LAYER 1 — AI / MODEL LAYER (MOST IMPORTANT)
    { id: "anthropic", ticker: "ANTHROPIC", name: "Anthropic", role: "primary AI partner (Claude models; $8B Amazon investment)" },

    // LAYER 2 — SEMICONDUCTORS / AI HARDWARE
    { id: "nvda", ticker: "NVDA", name: "NVIDIA", role: "primary GPU supplier for AWS AI infrastructure" },
    { id: "amd", ticker: "AMD", name: "AMD", role: "EPYC CPUs and AI accelerators (MI300)" },
    { id: "intc", ticker: "INTC", name: "Intel", role: "Xeon CPUs for AWS compute" },
    { id: "mu", ticker: "MU", name: "Micron", role: "DRAM and HBM memory for servers" },

    // LAYER 3 — ENERGY / INFRASTRUCTURE / CLOUD PARTNERS
    { id: "tln", ticker: "TLN", name: "Talen Energy", role: "nuclear power supplier (largest Amazon energy contract)" },

    { id: "orcl", ticker: "ORCL", name: "Oracle", role: "Oracle Database@AWS hybrid cloud integration" },
    { id: "crm", ticker: "CRM", name: "Salesforce", role: "runs on AWS and marketplace integration" },

    // LAYER 4 — LOGISTICS & SUPPLY INPUTS
    { id: "fdx", ticker: "FDX", name: "FedEx", role: "large-package delivery partner" },

    { id: "aapl", ticker: "AAPL", name: "Apple", role: "largest direct brand supplier via authorized reseller agreement" },
    { id: "brands", ticker: "BRANDS", name: "CPG Brands", role: "P&G, Nike, etc. selling through Amazon marketplace" },

    // CENTER
    { id: "amzn", ticker: "AMZN", name: "Amazon", role: "AWS cloud, e-commerce marketplace, logistics network, advertising, and subscription platform" },

    // LAYER 5 — INTERNAL DISTRIBUTION (MOAT)
    { id: "logistics", ticker: "LOG", name: "Amazon Logistics", role: "in-house delivery network (6.3B parcels/year)" },
    { id: "fc", ticker: "FC", name: "Fulfillment Centers", role: "global warehouse and distribution system" },

    // FINAL 6 — DEMAND DRIVERS
    { id: "aws", ticker: "AMZN", name: "Cloud Customers", role: "enterprise AWS clients (largest profit driver)" },
    { id: "prime", ticker: "AMZN", name: "Prime Subscribers", role: "200M+ global subscription users" },
    { id: "seller", ticker: "SELL", name: "Marketplace Sellers", role: "third-party sellers generating 60%+ of units sold" },
    { id: "ads", ticker: "ADS", name: "Advertising Clients", role: "brands buying ads on Amazon platform" },
    { id: "consumer", ticker: "CONS", name: "Retail Consumers", role: "core e-commerce demand base" },
    { id: "gov", ticker: "GOV", name: "Government", role: "AWS GovCloud and classified contracts" }
  ],

  edges: [
    // LAYER 1 → LAYER 2
    { source: "anthropic", target: "nvda" },

    // LAYER 2 → LAYER 3
    { source: "nvda", target: "tln" },
    { source: "amd", target: "orcl" },
    { source: "intc", target: "crm" },
    { source: "mu", target: "orcl" },

    // LAYER 3 → AMAZON
    { source: "tln", target: "amzn" },
    { source: "orcl", target: "amzn" },
    { source: "crm", target: "amzn" },

    // LAYER 4 → AMAZON
    { source: "fdx", target: "amzn" },
    { source: "aapl", target: "amzn" },
    { source: "brands", target: "amzn" },

    // ALSO DIRECT HARDWARE DEPENDENCY
    { source: "nvda", target: "amzn" },
    { source: "amd", target: "amzn" },
    { source: "intc", target: "amzn" },

    // AMAZON → INTERNAL NETWORK
    { source: "amzn", target: "logistics" },
    { source: "amzn", target: "fc" },

    // INTERNAL → FINAL 6
    { source: "logistics", target: "consumer" },
    { source: "fc", target: "consumer" },

    { source: "fc", target: "prime" },
    { source: "fc", target: "seller" },

    { source: "fc", target: "ads" },
    { source: "fc", target: "aws" },
    { source: "fc", target: "gov" }
  ]
},
GOOGL: {
  name: "Alphabet (Google)",
  root: "googl",
  nodes: [
    // LAYER 1 — AI / SILICON DESIGN (CORE DIFFERENTIATOR)
    { id: "goog_ai", ticker: "GOOG", name: "Google AI (Gemini)", role: "core AI models powering Search, Ads, and Cloud" },

    // LAYER 2 — SEMICONDUCTORS / HARDWARE (PHYSICAL FOUNDATION)
    { id: "avgo", ticker: "AVGO", name: "Broadcom", role: "co-developer of Google TPU chips (critical partner)" },
    { id: "tsm", ticker: "TSM", name: "TSMC", role: "primary manufacturer of Google TPU chips" },
    { id: "nvda", ticker: "NVDA", name: "NVIDIA", role: "GPU supplier for supplemental AI compute" },
    { id: "mu", ticker: "MU", name: "Micron", role: "memory supplier (HBM, DRAM)" },

    { id: "lumentum", ticker: "LITE", name: "Lumentum", role: "optical networking components" },
    { id: "cohr", ticker: "COHR", name: "Coherent", role: "optical systems for data centers" },

    // LAYER 3 — INFRASTRUCTURE / MANUFACTURING / DATA CENTERS
    { id: "flex", ticker: "FLEX", name: "Flex", role: "server and hardware manufacturing (EMS)" },
    { id: "jbl", ticker: "JBL", name: "Jabil", role: "device and infrastructure assembly" },

    { id: "eqix", ticker: "EQIX", name: "Equinix", role: "colocation and interconnection infrastructure" },
    { id: "dlr", ticker: "DLR", name: "Digital Realty", role: "data center infrastructure" },

    { id: "nee", ticker: "NEE", name: "NextEra Energy", role: "renewable energy supplier for data centers" },

    // CENTER
    { id: "googl", ticker: "GOOGL", name: "Alphabet", role: "Search, Ads, YouTube, Google Cloud, AI (Gemini), and devices" },

    // 🔥 FINAL 6 — DEMAND DRIVERS (COMPRESSED)
    { id: "apple", ticker: "AAPL", name: "Apple", role: "default search distribution partner (most important traffic driver)" },
    { id: "ads", ticker: "ADS", name: "Advertisers", role: "companies buying ads (primary revenue engine)" },
    { id: "cloud", ticker: "CLOUD", name: "GCP Customers", role: "enterprise cloud and AI customers" },
    { id: "enterprise", ticker: "ENT", name: "Enterprise AI Users", role: "Gemini + Workspace enterprise adoption" },
    { id: "consumer", ticker: "CONS", name: "Consumers", role: "Search, YouTube, Android users" },
    { id: "retail", ticker: "RETAIL", name: "Retail Channels", role: "Best Buy, Walmart distributing Pixel/Nest devices" }
  ],

  edges: [
    // LAYER 1 → LAYER 2
    { source: "goog_ai", target: "avgo" },

    // LAYER 2 → LAYER 3
    { source: "avgo", target: "flex" },
    { source: "tsm", target: "jbl" },
    { source: "nvda", target: "eqix" },
    { source: "mu", target: "dlr" },

    { source: "lumentum", target: "eqix" },
    { source: "cohr", target: "dlr" },

    // LAYER 3 → GOOGLE
    { source: "flex", target: "googl" },
    { source: "jbl", target: "googl" },
    { source: "eqix", target: "googl" },
    { source: "dlr", target: "googl" },
    { source: "nee", target: "googl" },

    // ALSO DIRECT CHIP DEPENDENCIES
    { source: "avgo", target: "googl" },
    { source: "tsm", target: "googl" },
    { source: "nvda", target: "googl" },

    // GOOGLE → FINAL 6
    { source: "googl", target: "apple" },
    { source: "googl", target: "ads" },
    { source: "googl", target: "cloud" },
    { source: "googl", target: "enterprise" },
    { source: "googl", target: "consumer" },
    { source: "googl", target: "retail" }
  ]
},
META: {
  name: "Meta Platforms",
  root: "meta",
  nodes: [
    // LAYER 1 — AI / COMPUTE FOUNDATION (MOST IMPORTANT)
    { id: "meta_ai", ticker: "AI", name: "Meta AI", role: "ranking, ads targeting, Llama models, and recommendation systems" },

    // LAYER 2 — SEMICONDUCTORS / HARDWARE (BOTTLENECK)
    { id: "nvda", ticker: "NVDA", name: "NVIDIA", role: "primary GPU supplier for AI training and inference (critical dependency)" },
    { id: "amd", ticker: "AMD", name: "AMD", role: "alternative GPUs and CPUs (EPYC)" },
    { id: "intc", ticker: "INTC", name: "Intel", role: "server CPUs" },
    { id: "avgo", ticker: "AVGO", name: "Broadcom", role: "networking chips and ASICs" },
    { id: "mrvl", ticker: "MRVL", name: "Marvell", role: "data center networking silicon" },

    { id: "mu", ticker: "MU", name: "Micron", role: "DRAM / HBM memory for AI workloads" },

    // LAYER 3 — DATA CENTER / INFRASTRUCTURE (CORE COST BASE)
    { id: "dell", ticker: "DELL", name: "Dell", role: "servers and storage systems" },
    { id: "hpe", ticker: "HPE", name: "HPE", role: "enterprise servers and infrastructure" },

    { id: "vrt", ticker: "VRT", name: "Vertiv", role: "power and cooling systems (critical for AI data centers)" },

    { id: "anet", ticker: "ANET", name: "Arista Networks", role: "high-speed data center networking" },
    { id: "csco", ticker: "CSCO", name: "Cisco", role: "networking hardware and backbone infrastructure" },

    { id: "glw", ticker: "GLW", name: "Corning", role: "fiber optics and connectivity" },
    { id: "nee", ticker: "NEE", name: "NextEra Energy", role: "renewable energy supply for data centers" },

    // CENTER
    { id: "meta", ticker: "META", name: "Meta Platforms", role: "Facebook, Instagram, WhatsApp, Messenger, Reality Labs, and global ad platform" },

    // LAYER 5 — DISTRIBUTION (GATEKEEPERS)
    { id: "aapl", ticker: "AAPL", name: "Apple", role: "iOS platform (ATT privacy rules directly impact ad targeting)" },
    { id: "googl", ticker: "GOOGL", name: "Google (Android)", role: "Android OS distribution channel" },

    { id: "vz", ticker: "VZ", name: "Verizon", role: "mobile network delivering Meta apps" },
    { id: "t", ticker: "T", name: "AT&T", role: "wireless connectivity" },
    { id: "tmus", ticker: "TMUS", name: "T-Mobile", role: "mobile distribution" },

    // 🔥 FINAL 6 — DEMAND (REVENUE ENGINE)
    { id: "amzn", ticker: "AMZN", name: "Amazon", role: "major advertiser (performance + retail ads)" },
    { id: "wmt", ticker: "WMT", name: "Walmart", role: "retail advertiser" },
    { id: "pg", ticker: "PG", name: "Procter & Gamble", role: "largest global brand advertiser" },
    { id: "dis", ticker: "DIS", name: "Disney", role: "media and streaming advertising demand" },
    { id: "uber", ticker: "UBER", name: "Uber", role: "app-based performance advertiser" },
    { id: "nflx", ticker: "NFLX", name: "Netflix", role: "content marketing and subscriber acquisition ads" }
  ],

  edges: [
    // LAYER 1 → LAYER 2
    { source: "meta_ai", target: "nvda" },

    // LAYER 2 → LAYER 3
    { source: "nvda", target: "dell" },
    { source: "amd", target: "hpe" },
    { source: "intc", target: "dell" },
    { source: "avgo", target: "anet" },
    { source: "mrvl", target: "csco" },
    { source: "mu", target: "dell" },

    // LAYER 3 → META
    { source: "dell", target: "meta" },
    { source: "hpe", target: "meta" },
    { source: "vrt", target: "meta" },
    { source: "anet", target: "meta" },
    { source: "csco", target: "meta" },
    { source: "glw", target: "meta" },
    { source: "nee", target: "meta" },

    // ALSO DIRECT DEPENDENCIES
    { source: "nvda", target: "meta" },

    // META → DISTRIBUTION
    { source: "meta", target: "aapl" },
    { source: "meta", target: "googl" },
    { source: "meta", target: "vz" },
    { source: "meta", target: "t" },
    { source: "meta", target: "tmus" },

    // DISTRIBUTION → FINAL 6
    { source: "aapl", target: "amzn" },
    { source: "googl", target: "wmt" },

    { source: "vz", target: "pg" },
    { source: "t", target: "dis" },
    { source: "tmus", target: "uber" },

    { source: "aapl", target: "nflx" }
  ]
},
ORCL: {
  name: "Oracle",
  root: "orcl",
  nodes: [
    // LAYER 1 — SEMICONDUCTORS / CORE COMPUTE
    { id: "nvda", ticker: "NVDA", name: "NVIDIA", role: "GPUs for OCI AI training and inference clusters" },
    { id: "amd", ticker: "AMD", name: "AMD", role: "MI300X GPUs and EPYC CPUs for OCI compute" },
    { id: "intc", ticker: "INTC", name: "Intel", role: "Xeon CPUs for enterprise and cloud servers" },
    { id: "avgo", ticker: "AVGO", name: "Broadcom", role: "networking silicon, switch ASICs, and connectivity chips" },
    { id: "mrvl", ticker: "MRVL", name: "Marvell", role: "data center networking and storage silicon" },

    // LAYER 2 — SERVERS / STORAGE / NETWORKING / INFRASTRUCTURE
    { id: "dell", ticker: "DELL", name: "Dell", role: "enterprise and cloud-class server ecosystem" },
    { id: "hpe", ticker: "HPE", name: "HPE", role: "server and infrastructure ecosystem partner" },
    { id: "vrt", ticker: "VRT", name: "Vertiv", role: "power, UPS, and cooling systems for data centers" },
    { id: "anet", ticker: "ANET", name: "Arista Networks", role: "high-bandwidth data center switching" },
    { id: "dlr", ticker: "DLR", name: "Digital Realty", role: "colocation and data center real estate" },
    { id: "nee", ticker: "NEE", name: "NextEra Energy", role: "power and renewable energy support for U.S. data centers" },

    // LAYER 3 — ENTERPRISE / CLOUD ENABLEMENT
    { id: "msft", ticker: "MSFT", name: "Microsoft", role: "Oracle Interconnect for Azure and enterprise productivity tooling" },
    { id: "crm", ticker: "CRM", name: "Salesforce", role: "CRM and enterprise workflow tools used in some Oracle operations" },
    { id: "now", ticker: "NOW", name: "ServiceNow", role: "IT service management and enterprise workflow software" },
    { id: "wday", ticker: "WDAY", name: "Workday", role: "HR and finance systems support" },

    // CENTER
    { id: "orcl", ticker: "ORCL", name: "Oracle", role: "database, OCI cloud, Fusion SaaS, and engineered systems platform" },

    // LAYER 5 — DISTRIBUTION / IMPLEMENTATION PARTNERS
    { id: "acn", ticker: "ACN", name: "Accenture", role: "major Oracle implementation and transformation partner" },
    { id: "dxc", ticker: "DXC", name: "DXC Technology", role: "Oracle implementation and enterprise delivery partner" },
    { id: "ctsh", ticker: "CTSH", name: "Cognizant", role: "systems integration and Oracle deployment partner" },

    // FINAL 6 — DOWNSTREAM DEMAND DRIVERS
    { id: "jpm", ticker: "JPM", name: "JPMorgan Chase", role: "financial services database and enterprise workload customer" },
    { id: "bac", ticker: "BAC", name: "Bank of America", role: "banking and analytics workload customer" },
    { id: "t", ticker: "T", name: "AT&T", role: "telecom database and OSS/BSS customer" },
    { id: "wmt", ticker: "WMT", name: "Walmart", role: "retail ERP, supply chain, and analytics customer" },
    { id: "unh", ticker: "UNH", name: "UnitedHealth", role: "healthcare database and enterprise systems customer" },
    { id: "lmt", ticker: "LMT", name: "Lockheed Martin", role: "defense and secure enterprise systems customer" }
  ],

  edges: [
    // LAYER 1 → LAYER 2
    { source: "nvda", target: "dell" },
    { source: "amd", target: "hpe" },
    { source: "intc", target: "dell" },
    { source: "avgo", target: "anet" },
    { source: "mrvl", target: "vrt" },

    { source: "nvda", target: "dlr" },
    { source: "amd", target: "nee" },

    // LAYER 2 → LAYER 3
    { source: "dell", target: "msft" },
    { source: "hpe", target: "crm" },
    { source: "vrt", target: "now" },
    { source: "anet", target: "msft" },
    { source: "dlr", target: "wday" },
    { source: "nee", target: "msft" },

    // LAYER 3 → ORACLE
    { source: "msft", target: "orcl" },
    { source: "crm", target: "orcl" },
    { source: "now", target: "orcl" },
    { source: "wday", target: "orcl" },

    // ALSO DIRECT CORE INFRA → ORACLE
    { source: "nvda", target: "orcl" },
    { source: "amd", target: "orcl" },
    { source: "intc", target: "orcl" },
    { source: "vrt", target: "orcl" },
    { source: "anet", target: "orcl" },
    { source: "dlr", target: "orcl" },

    // ORACLE → IMPLEMENTATION PARTNERS
    { source: "orcl", target: "acn" },
    { source: "orcl", target: "dxc" },
    { source: "orcl", target: "ctsh" },

    // IMPLEMENTATION PARTNERS → FINAL 6
    { source: "acn", target: "jpm" },
    { source: "dxc", target: "bac" },
    { source: "ctsh", target: "t" },
    { source: "acn", target: "wmt" },
    { source: "dxc", target: "unh" },
    { source: "ctsh", target: "lmt" }
  ]
},
HD: {
  name: "Home Depot",
  root: "hd",
  nodes: [
    // LAYER 1 — PRODUCT MANUFACTURERS (CORE INPUTS)
    { id: "whirlpool", ticker: "WHR", name: "Whirlpool", role: "appliances (washers, refrigerators, etc.)" },
    { id: "swk", ticker: "SWK", name: "Stanley Black & Decker", role: "tools and hardware" },
    { id: "mas", ticker: "MAS", name: "Masco", role: "plumbing, cabinets, building products" },
    { id: "oc", ticker: "OC", name: "Owens Corning", role: "insulation and roofing materials" },
    { id: "shw", ticker: "SHW", name: "Sherwin-Williams", role: "paint and coatings" },
    { id: "mohawk", ticker: "MHK", name: "Mohawk Industries", role: "flooring products" },

    { id: "smg", ticker: "SMG", name: "Scotts Miracle-Gro", role: "lawn and garden products" },
    { id: "ttc", ticker: "TTC", name: "Toro", role: "outdoor equipment" },

    // LAYER 2 — LOGISTICS / TRANSPORTATION
    { id: "ups", ticker: "UPS", name: "UPS", role: "parcel and last-mile delivery" },
    { id: "fdx", ticker: "FDX", name: "FedEx", role: "parcel and freight delivery" },
    { id: "jbht", ticker: "JBHT", name: "J.B. Hunt", role: "truckload and dedicated freight" },
    { id: "xpo", ticker: "XPO", name: "XPO Logistics", role: "LTL and freight services" },

    // LAYER 3 — INFRASTRUCTURE / IT / PAYMENTS
    { id: "pld", ticker: "PLD", name: "Prologis", role: "warehouse and logistics real estate" },
    { id: "orcl", ticker: "ORCL", name: "Oracle", role: "databases and supply chain systems" },
    { id: "msft", ticker: "MSFT", name: "Microsoft", role: "cloud and analytics infrastructure" },
    { id: "crm", ticker: "CRM", name: "Salesforce", role: "customer and operations software" },
    { id: "nee", ticker: "NEE", name: "NextEra Energy", role: "power and energy supply" },
    { id: "visa", ticker: "V", name: "Visa", role: "payment processing network" },

    // CENTER
    { id: "hd", ticker: "HD", name: "Home Depot", role: "retail stores, distribution network, and e-commerce platform" },

    // LAYER 5 — INTERNAL DISTRIBUTION NETWORK (KEY MOAT)
    { id: "dc", ticker: "DC", name: "Distribution Network", role: "RDCs, SDCs, MDOs, DFCs coordinating inventory flow" },

    // 🔥 FINAL 6 — DEMAND DRIVERS
    { id: "dhi", ticker: "DHI", name: "D.R. Horton", role: "largest U.S. homebuilder (materials demand)" },
    { id: "len", ticker: "LEN", name: "Lennar", role: "home construction demand" },
    { id: "phm", ticker: "PHM", name: "PulteGroup", role: "residential construction demand" },
    { id: "invh", ticker: "INVH", name: "Invitation Homes", role: "rental property maintenance demand" },
    { id: "mar", ticker: "MAR", name: "Marriott", role: "hospitality renovation and maintenance demand" },
    { id: "consumer", ticker: "CONS", name: "DIY Consumers", role: "homeowners and retail demand base" }
  ],

  edges: [
    // LAYER 1 → LAYER 2
    { source: "whirlpool", target: "ups" },
    { source: "swk", target: "jbht" },
    { source: "mas", target: "xpo" },
    { source: "oc", target: "jbht" },
    { source: "shw", target: "fdx" },
    { source: "mohawk", target: "xpo" },
    { source: "smg", target: "ups" },
    { source: "ttc", target: "jbht" },

    // LAYER 2 → LAYER 3
    { source: "ups", target: "pld" },
    { source: "fdx", target: "pld" },
    { source: "jbht", target: "pld" },
    { source: "xpo", target: "pld" },

    // LAYER 3 → HOME DEPOT
    { source: "pld", target: "hd" },
    { source: "orcl", target: "hd" },
    { source: "msft", target: "hd" },
    { source: "crm", target: "hd" },
    { source: "nee", target: "hd" },
    { source: "visa", target: "hd" },

    // HOME DEPOT → INTERNAL NETWORK
    { source: "hd", target: "dc" },

    // NETWORK → FINAL 6
    { source: "dc", target: "dhi" },
    { source: "dc", target: "len" },
    { source: "dc", target: "phm" },
    { source: "dc", target: "invh" },
    { source: "dc", target: "mar" },
    { source: "dc", target: "consumer" }
  ]
},
NVDA: {
  name: "NVIDIA",
  root: "nvda",
  nodes: [
    // LAYER 0 — SEMICONDUCTOR EQUIPMENT
    { id: "asml", ticker: "ASML", name: "ASML", role: "EUV lithography machines required for advanced chip manufacturing" },

    // LAYER 1 — DESIGN TOOLS
    { id: "snps", ticker: "SNPS", name: "Synopsys", role: "EDA software for chip design and verification" },
    { id: "cdns", ticker: "CDNS", name: "Cadence", role: "EDA software and chip design tools" },

    // LAYER 2 — FOUNDRY
    { id: "tsm", ticker: "TSM", name: "TSMC", role: "primary foundry and advanced packaging partner for leading-edge GPUs" },

    // LAYER 3 — MEMORY / PACKAGING CONSTRAINT
    { id: "mu", ticker: "MU", name: "Micron", role: "HBM and memory supplier for AI GPUs" },

    // LAYER 4 — SYSTEM COMPONENTS / POWER / NETWORKING
    { id: "avgo", ticker: "AVGO", name: "Broadcom", role: "networking silicon and interconnect ecosystem" },
    { id: "vrt", ticker: "VRT", name: "Vertiv", role: "power and cooling systems for AI racks and data centers" },
    { id: "etn", ticker: "ETN", name: "Eaton", role: "power distribution and electrical infrastructure" },

    // LAYER 5 — OEM / SERVER BUILDERS
    { id: "dell", ticker: "DELL", name: "Dell", role: "GPU server and rack builder" },
    { id: "hpe", ticker: "HPE", name: "HPE", role: "enterprise AI server and infrastructure partner" },
    { id: "smci", ticker: "SMCI", name: "Super Micro", role: "AI server builder and NVIDIA platform partner" },

    // CENTER
    { id: "nvda", ticker: "NVDA", name: "NVIDIA", role: "GPU, AI systems, networking, and CUDA software platform" },

    // FINAL 6 — DOWNSTREAM DEMAND DRIVERS
    { id: "msft", ticker: "MSFT", name: "Microsoft", role: "Azure AI infrastructure customer" },
    { id: "amzn", ticker: "AMZN", name: "Amazon", role: "AWS GPU and AI infrastructure customer" },
    { id: "googl", ticker: "GOOGL", name: "Alphabet", role: "Google Cloud GPU customer" },
    { id: "orcl", ticker: "ORCL", name: "Oracle", role: "OCI GPU cluster customer" },
    { id: "meta", ticker: "META", name: "Meta", role: "massive internal AI training customer" },
    { id: "tsla", ticker: "TSLA", name: "Tesla", role: "AI training and autonomous driving compute customer" }
  ],

  edges: [
    // LAYER 0 → LAYER 2
    { source: "asml", target: "tsm" },

    // LAYER 1 → LAYER 2
    { source: "snps", target: "tsm" },
    { source: "cdns", target: "tsm" },

    // LAYER 2 → LAYER 3
    { source: "tsm", target: "mu" },

    // LAYER 3 → LAYER 4
    { source: "mu", target: "avgo" },
    { source: "mu", target: "vrt" },
    { source: "mu", target: "etn" },

    // LAYER 4 → LAYER 5
    { source: "avgo", target: "dell" },
    { source: "vrt", target: "hpe" },
    { source: "etn", target: "smci" },

    // LAYER 5 → NVIDIA
    { source: "dell", target: "nvda" },
    { source: "hpe", target: "nvda" },
    { source: "smci", target: "nvda" },

    // ALSO CRITICAL DIRECT DEPENDENCIES
    { source: "tsm", target: "nvda" },
    { source: "mu", target: "nvda" },

    // NVIDIA → FINAL 6
    { source: "nvda", target: "msft" },
    { source: "nvda", target: "amzn" },
    { source: "nvda", target: "googl" },
    { source: "nvda", target: "orcl" },
    { source: "nvda", target: "meta" },
    { source: "nvda", target: "tsla" }
  ]
},
HD: {
  name: "Home Depot",
  root: "hd",
  nodes: [
    // LAYER 1 — PRODUCT MANUFACTURERS (CORE INPUTS)
    { id: "whirlpool", ticker: "WHR", name: "Whirlpool", role: "appliances (washers, refrigerators, etc.)" },
    { id: "swk", ticker: "SWK", name: "Stanley Black & Decker", role: "tools and hardware" },
    { id: "mas", ticker: "MAS", name: "Masco", role: "plumbing, cabinets, building products" },
    { id: "oc", ticker: "OC", name: "Owens Corning", role: "insulation and roofing materials" },
    { id: "shw", ticker: "SHW", name: "Sherwin-Williams", role: "paint and coatings" },
    { id: "mohawk", ticker: "MHK", name: "Mohawk Industries", role: "flooring products" },

    { id: "smg", ticker: "SMG", name: "Scotts Miracle-Gro", role: "lawn and garden products" },
    { id: "ttc", ticker: "TTC", name: "Toro", role: "outdoor equipment" },

    // LAYER 2 — LOGISTICS / TRANSPORTATION
    { id: "ups", ticker: "UPS", name: "UPS", role: "parcel and last-mile delivery" },
    { id: "fdx", ticker: "FDX", name: "FedEx", role: "parcel and freight delivery" },
    { id: "jbht", ticker: "JBHT", name: "J.B. Hunt", role: "truckload and dedicated freight" },
    { id: "xpo", ticker: "XPO", name: "XPO Logistics", role: "LTL and freight services" },

    // LAYER 3 — INFRASTRUCTURE / IT / PAYMENTS
    { id: "pld", ticker: "PLD", name: "Prologis", role: "warehouse and logistics real estate" },
    { id: "orcl", ticker: "ORCL", name: "Oracle", role: "databases and supply chain systems" },
    { id: "msft", ticker: "MSFT", name: "Microsoft", role: "cloud and analytics infrastructure" },
    { id: "crm", ticker: "CRM", name: "Salesforce", role: "customer and operations software" },
    { id: "nee", ticker: "NEE", name: "NextEra Energy", role: "power and energy supply" },
    { id: "visa", ticker: "V", name: "Visa", role: "payment processing network" },

    // CENTER
    { id: "hd", ticker: "HD", name: "Home Depot", role: "retail stores, distribution network, and e-commerce platform" },

    // LAYER 5 — INTERNAL DISTRIBUTION NETWORK (KEY MOAT)
    { id: "dc", ticker: "DC", name: "Distribution Network", role: "RDCs, SDCs, MDOs, DFCs coordinating inventory flow" },

    // 🔥 FINAL 6 — DEMAND DRIVERS
    { id: "dhi", ticker: "DHI", name: "D.R. Horton", role: "largest U.S. homebuilder (materials demand)" },
    { id: "len", ticker: "LEN", name: "Lennar", role: "home construction demand" },
    { id: "phm", ticker: "PHM", name: "PulteGroup", role: "residential construction demand" },
    { id: "invh", ticker: "INVH", name: "Invitation Homes", role: "rental property maintenance demand" },
    { id: "mar", ticker: "MAR", name: "Marriott", role: "hospitality renovation and maintenance demand" },
    { id: "consumer", ticker: "CONS", name: "DIY Consumers", role: "homeowners and retail demand base" }
  ],

  edges: [
    // LAYER 1 → LAYER 2
    { source: "whirlpool", target: "ups" },
    { source: "swk", target: "jbht" },
    { source: "mas", target: "xpo" },
    { source: "oc", target: "jbht" },
    { source: "shw", target: "fdx" },
    { source: "mohawk", target: "xpo" },
    { source: "smg", target: "ups" },
    { source: "ttc", target: "jbht" },

    // LAYER 2 → LAYER 3
    { source: "ups", target: "pld" },
    { source: "fdx", target: "pld" },
    { source: "jbht", target: "pld" },
    { source: "xpo", target: "pld" },

    // LAYER 3 → HOME DEPOT
    { source: "pld", target: "hd" },
    { source: "orcl", target: "hd" },
    { source: "msft", target: "hd" },
    { source: "crm", target: "hd" },
    { source: "nee", target: "hd" },
    { source: "visa", target: "hd" },

    // HOME DEPOT → INTERNAL NETWORK
    { source: "hd", target: "dc" },

    // NETWORK → FINAL 6
    { source: "dc", target: "dhi" },
    { source: "dc", target: "len" },
    { source: "dc", target: "phm" },
    { source: "dc", target: "invh" },
    { source: "dc", target: "mar" },
    { source: "dc", target: "consumer" }
  ]
},
PG: {
  name: "Procter & Gamble",
  root: "pg",
  nodes: [
    // LAYER 1 — RAW MATERIALS / CHEMICALS / PACKAGING (CORE INPUTS)
    { id: "dow", ticker: "DOW", name: "Dow", role: "petrochemicals, surfactants, polymers" },
    { id: "dupont", ticker: "DD", name: "DuPont", role: "specialty materials and ingredients" },
    { id: "lyb", ticker: "LYB", name: "LyondellBasell", role: "plastics and petrochemicals" },
    { id: "ip", ticker: "IP", name: "International Paper", role: "pulp, paper, and packaging materials" },
    { id: "bery", ticker: "BERY", name: "Berry Global", role: "plastic packaging and containers" },
    { id: "iff", ticker: "IFF", name: "International Flavors & Fragrances", role: "fragrances and specialty ingredients" },

    // LAYER 2 — LOGISTICS / INDUSTRIAL SYSTEMS
    { id: "ups", ticker: "UPS", name: "UPS", role: "parcel and distribution logistics" },
    { id: "jbht", ticker: "JBHT", name: "J.B. Hunt", role: "truckload and dedicated freight" },
    { id: "chrw", ticker: "CHRW", name: "C.H. Robinson", role: "freight brokerage and 3PL" },

    { id: "rok", ticker: "ROK", name: "Rockwell Automation", role: "factory automation and control systems" },
    { id: "emr", ticker: "EMR", name: "Emerson Electric", role: "process automation and plant systems" },

    // LAYER 3 — DIGITAL / ENERGY / INFRASTRUCTURE
    { id: "sap", ticker: "SAP", name: "SAP", role: "ERP and supply chain planning systems" },
    { id: "orcl", ticker: "ORCL", name: "Oracle", role: "databases and enterprise software" },
    { id: "msft", ticker: "MSFT", name: "Microsoft", role: "cloud, analytics, and AI systems" },

    { id: "nee", ticker: "NEE", name: "NextEra Energy", role: "electricity and renewable energy supply" },

    // CENTER
    { id: "pg", ticker: "PG", name: "Procter & Gamble", role: "global manufacturing, distribution, and 'One Supply Chain' system" },

    // 🔥 FINAL 6 — DOWNSTREAM DEMAND (RETAIL POWER)
    { id: "wmt", ticker: "WMT", name: "Walmart", role: "largest retail customer and distribution partner" },
    { id: "cost", ticker: "COST", name: "Costco", role: "bulk retail distribution channel" },
    { id: "tgt", ticker: "TGT", name: "Target", role: "mass retail and omnichannel distribution" },
    { id: "kr", ticker: "KR", name: "Kroger", role: "grocery distribution and everyday demand" },
    { id: "amzn", ticker: "AMZN", name: "Amazon", role: "e-commerce and digital distribution" },
    { id: "cvs", ticker: "CVS", name: "CVS Health", role: "health, beauty, and personal care distribution" }
  ],

  edges: [
    // LAYER 1 → LAYER 2
    { source: "dow", target: "ups" },
    { source: "dupont", target: "jbht" },
    { source: "lyb", target: "chrw" },
    { source: "ip", target: "ups" },
    { source: "bery", target: "jbht" },
    { source: "iff", target: "chrw" },

    // LAYER 2 → LAYER 3
    { source: "ups", target: "sap" },
    { source: "jbht", target: "orcl" },
    { source: "chrw", target: "msft" },
    { source: "rok", target: "sap" },
    { source: "emr", target: "orcl" },

    // LAYER 3 → P&G
    { source: "sap", target: "pg" },
    { source: "orcl", target: "pg" },
    { source: "msft", target: "pg" },
    { source: "nee", target: "pg" },

    // ALSO DIRECT RAW INPUT DEPENDENCY
    { source: "dow", target: "pg" },
    { source: "lyb", target: "pg" },
    { source: "ip", target: "pg" },
    { source: "bery", target: "pg" },

    // P&G → FINAL 6
    { source: "pg", target: "wmt" },
    { source: "pg", target: "cost" },
    { source: "pg", target: "tgt" },
    { source: "pg", target: "kr" },
    { source: "pg", target: "amzn" },
    { source: "pg", target: "cvs" }
  ]
},
JNJ: {
  name: "Johnson & Johnson",
  root: "jnj",
  nodes: [
    // LAYER 1 — CHEMICALS / BIOLOGICS / COMPONENTS (CORE INPUTS)
    { id: "dow", ticker: "DOW", name: "Dow", role: "polymers, solvents, and chemical inputs" },
    { id: "dupont", ticker: "DD", name: "DuPont", role: "specialty materials and intermediates" },
    { id: "emn", ticker: "EMN", name: "Eastman Chemical", role: "specialty chemicals and polymers" },

    { id: "tmo", ticker: "TMO", name: "Thermo Fisher", role: "biologics manufacturing and lab services" },
    { id: "dhr", ticker: "DHR", name: "Danaher", role: "bioprocessing equipment and consumables" },
    { id: "ctlt", ticker: "CTLT", name: "Catalent", role: "contract drug manufacturing (CDMO)" },

    { id: "wst", ticker: "WST", name: "West Pharmaceutical", role: "injectable packaging components (stoppers, seals)" },
    { id: "glw", ticker: "GLW", name: "Corning", role: "glass vials and pharmaceutical containers" },
    { id: "bery", ticker: "BERY", name: "Berry Global", role: "plastic packaging and medical containers" },

    // LAYER 2 — LOGISTICS / MANUFACTURING SYSTEMS
    { id: "ups", ticker: "UPS", name: "UPS", role: "parcel and healthcare logistics" },
    { id: "fdx", ticker: "FDX", name: "FedEx", role: "temperature-controlled logistics" },
    { id: "jbht", ticker: "JBHT", name: "J.B. Hunt", role: "freight and transportation" },
    { id: "chrw", ticker: "CHRW", name: "C.H. Robinson", role: "3PL and supply chain orchestration" },

    { id: "rok", ticker: "ROK", name: "Rockwell Automation", role: "pharma manufacturing automation" },
    { id: "emr", ticker: "EMR", name: "Emerson Electric", role: "process control systems" },

    // LAYER 3 — DIGITAL / ENERGY / INFRASTRUCTURE
    { id: "sap", ticker: "SAP", name: "SAP", role: "ERP and pharma supply chain planning" },
    { id: "orcl", ticker: "ORCL", name: "Oracle", role: "databases and enterprise systems" },
    { id: "msft", ticker: "MSFT", name: "Microsoft", role: "cloud, analytics, and AI systems" },

    { id: "nee", ticker: "NEE", name: "NextEra Energy", role: "power and renewable energy supply" },

    // CENTER
    { id: "jnj", ticker: "JNJ", name: "Johnson & Johnson", role: "pharma, MedTech, and global healthcare manufacturing network" },

    // LAYER 5 — DISTRIBUTION (CRITICAL CHOKEPOINT)
    { id: "mck", ticker: "MCK", name: "McKesson", role: "largest pharmaceutical distributor" },
    { id: "cor", ticker: "COR", name: "Cencora", role: "drug distribution (formerly AmerisourceBergen)" },
    { id: "cah", ticker: "CAH", name: "Cardinal Health", role: "medical and pharma distribution" },

    // 🔥 FINAL 6 — DEMAND (HEALTHCARE SYSTEM)
    { id: "hca", ticker: "HCA", name: "HCA Healthcare", role: "hospital system demand" },
    { id: "thc", ticker: "THC", name: "Tenet Healthcare", role: "hospital demand" },
    { id: "cvs", ticker: "CVS", name: "CVS Health", role: "pharmacy and retail drug distribution" },
    { id: "wba", ticker: "WBA", name: "Walgreens Boots Alliance", role: "pharmacy distribution" },
    { id: "wmt", ticker: "WMT", name: "Walmart", role: "retail pharmacy and OTC demand" },
    { id: "consumer", ticker: "CONS", name: "Patients / Consumers", role: "end healthcare demand" }
  ],

  edges: [
    // LAYER 1 → LAYER 2
    { source: "dow", target: "ups" },
    { source: "dupont", target: "jbht" },
    { source: "emn", target: "chrw" },

    { source: "tmo", target: "ups" },
    { source: "dhr", target: "fdx" },
    { source: "ctlt", target: "chrw" },

    { source: "wst", target: "ups" },
    { source: "glw", target: "fdx" },
    { source: "bery", target: "jbht" },

    // LAYER 2 → LAYER 3
    { source: "ups", target: "sap" },
    { source: "fdx", target: "orcl" },
    { source: "jbht", target: "msft" },
    { source: "chrw", target: "sap" },
    { source: "rok", target: "orcl" },
    { source: "emr", target: "msft" },

    // LAYER 3 → JNJ
    { source: "sap", target: "jnj" },
    { source: "orcl", target: "jnj" },
    { source: "msft", target: "jnj" },
    { source: "nee", target: "jnj" },

    // ALSO DIRECT CORE INPUTS
    { source: "tmo", target: "jnj" },
    { source: "dhr", target: "jnj" },
    { source: "wst", target: "jnj" },
    { source: "glw", target: "jnj" },

    // JNJ → DISTRIBUTORS (MOST IMPORTANT STEP)
    { source: "jnj", target: "mck" },
    { source: "jnj", target: "cor" },
    { source: "jnj", target: "cah" },

    // DISTRIBUTORS → FINAL 6
    { source: "mck", target: "hca" },
    { source: "cor", target: "thc" },
    { source: "cah", target: "cvs" },
    { source: "mck", target: "wba" },
    { source: "cor", target: "wmt" },
    { source: "cah", target: "consumer" }
  ]
},
CVS: {
  name: "CVS Health",
  root: "cvs",
  nodes: [
    // LAYER 1 — DRUG MANUFACTURERS + CPG (CORE INPUTS)
    { id: "pfe", ticker: "PFE", name: "Pfizer", role: "branded pharmaceuticals" },
    { id: "mrk", ticker: "MRK", name: "Merck", role: "pharmaceuticals and vaccines" },
    { id: "jnj", ticker: "JNJ", name: "Johnson & Johnson", role: "pharma and medical products" },
    { id: "lly", ticker: "LLY", name: "Eli Lilly", role: "diabetes and specialty drugs" },
    { id: "abbv", ticker: "ABBV", name: "AbbVie", role: "immunology and specialty pharma" },

    { id: "vtrs", ticker: "VTRS", name: "Viatris", role: "generic drugs" },
    { id: "teva", ticker: "TEVA", name: "Teva Pharmaceutical", role: "generic and biosimilar drugs" },

    { id: "pg", ticker: "PG", name: "Procter & Gamble", role: "OTC and personal care products" },
    { id: "cl", ticker: "CL", name: "Colgate-Palmolive", role: "consumer health and hygiene products" },
    { id: "kmb", ticker: "KMB", name: "Kimberly-Clark", role: "paper and hygiene products" },

    // LAYER 2 — DISTRIBUTION / LOGISTICS / WHOLESALERS
    { id: "mck", ticker: "MCK", name: "McKesson", role: "pharmaceutical wholesaler" },
    { id: "cah", ticker: "CAH", name: "Cardinal Health", role: "drug and medical distributor" },
    { id: "cor", ticker: "COR", name: "Cencora", role: "pharma distribution" },

    { id: "ups", ticker: "UPS", name: "UPS", role: "parcel and prescription delivery" },
    { id: "fdx", ticker: "FDX", name: "FedEx", role: "logistics and cold-chain delivery" },
    { id: "jbht", ticker: "JBHT", name: "J.B. Hunt", role: "freight transportation" },

    // LAYER 3 — DIGITAL / INFRASTRUCTURE / REAL ESTATE
    { id: "orcl", ticker: "ORCL", name: "Oracle", role: "claims processing and database systems" },
    { id: "sap", ticker: "SAP", name: "SAP", role: "ERP and supply chain planning" },
    { id: "msft", ticker: "MSFT", name: "Microsoft", role: "cloud, analytics, and AI" },

    { id: "pld", ticker: "PLD", name: "Prologis", role: "distribution centers and logistics real estate" },
    { id: "nee", ticker: "NEE", name: "NextEra Energy", role: "power and energy supply" },

    // CENTER — CLOSED LOOP SYSTEM
    { id: "cvs", ticker: "CVS", name: "CVS Health", role: "Aetna (insurance) + Caremark (PBM) + retail pharmacy + clinics" },

    // 🔥 FINAL 6 — DEMAND (MULTI-LAYERED)
    { id: "wmt", ticker: "WMT", name: "Walmart", role: "large employer PBM client" },
    { id: "amzn", ticker: "AMZN", name: "Amazon", role: "corporate PBM client and healthcare competitor" },
    { id: "jpm", ticker: "JPM", name: "JPMorgan", role: "employer healthcare client" },
    { id: "unh", ticker: "UNH", name: "UnitedHealth", role: "payer competitor and ecosystem overlap" },
    { id: "hca", ticker: "HCA", name: "HCA Healthcare", role: "hospital provider network" },
    { id: "consumer", ticker: "CONS", name: "Patients / Consumers", role: "end users of prescriptions and care" }
  ],

  edges: [
    // LAYER 1 → LAYER 2
    { source: "pfe", target: "mck" },
    { source: "mrk", target: "cah" },
    { source: "jnj", target: "cor" },
    { source: "lly", target: "mck" },
    { source: "abbv", target: "cah" },

    { source: "vtrs", target: "cor" },
    { source: "teva", target: "mck" },

    { source: "pg", target: "ups" },
    { source: "cl", target: "fdx" },
    { source: "kmb", target: "jbht" },

    // LAYER 2 → LAYER 3
    { source: "mck", target: "orcl" },
    { source: "cah", target: "sap" },
    { source: "cor", target: "msft" },

    { source: "ups", target: "pld" },
    { source: "fdx", target: "pld" },
    { source: "jbht", target: "pld" },

    // LAYER 3 → CVS
    { source: "orcl", target: "cvs" },
    { source: "sap", target: "cvs" },
    { source: "msft", target: "cvs" },
    { source: "pld", target: "cvs" },
    { source: "nee", target: "cvs" },

    // ALSO DIRECT CORE INPUTS
    { source: "pfe", target: "cvs" },
    { source: "mrk", target: "cvs" },
    { source: "jnj", target: "cvs" },

    // CVS → FINAL 6 (MULTI-DIRECTIONAL SYSTEM)
    { source: "cvs", target: "wmt" },
    { source: "cvs", target: "amzn" },
    { source: "cvs", target: "jpm" },
    { source: "cvs", target: "unh" },
    { source: "cvs", target: "hca" },
    { source: "cvs", target: "consumer" }
  ]
},
V: {
  name: "Visa",
  root: "v",
  nodes: [
    // LAYER 1 — CLOUD / NETWORK / SECURITY (FOUNDATION)
    { id: "msft", ticker: "MSFT", name: "Microsoft", role: "cloud (Azure), analytics, infrastructure" },
    { id: "amzn", ticker: "AMZN", name: "Amazon", role: "AWS cloud services" },

    { id: "eqix", ticker: "EQIX", name: "Equinix", role: "data center colocation and interconnection" },
    { id: "dlr", ticker: "DLR", name: "Digital Realty", role: "data center infrastructure" },

    { id: "csco", ticker: "CSCO", name: "Cisco", role: "networking hardware and routing systems" },
    { id: "anet", ticker: "ANET", name: "Arista Networks", role: "high-speed switching for data centers" },

    { id: "t", ticker: "T", name: "AT&T", role: "telecom network connectivity" },
    { id: "vz", ticker: "VZ", name: "Verizon", role: "telecom infrastructure" },

    { id: "crwd", ticker: "CRWD", name: "CrowdStrike", role: "cybersecurity and threat detection" },
    { id: "panw", ticker: "PANW", name: "Palo Alto Networks", role: "network security and protection" },

    // LAYER 2 — SOFTWARE / DATA / CONSULTING
    { id: "orcl", ticker: "ORCL", name: "Oracle", role: "databases and transaction systems" },
    { id: "sap", ticker: "SAP", name: "SAP", role: "enterprise systems and data management" },
    { id: "crm", ticker: "CRM", name: "Salesforce", role: "client management and CRM systems" },
    { id: "now", ticker: "NOW", name: "ServiceNow", role: "workflow automation and operations" },

    { id: "acn", ticker: "ACN", name: "Accenture", role: "consulting and system integration" },
    { id: "ibm", ticker: "IBM", name: "IBM", role: "consulting and infrastructure services" },

    // CENTER
    { id: "v", ticker: "V", name: "Visa", role: "VisaNet network, payment routing, rules, and value-added services" },

    // LAYER 5 — FINANCIAL NETWORK (CORE CLIENTS)
    { id: "jpm", ticker: "JPM", name: "JPMorgan", role: "largest card issuer (Chase Visa)" },
    { id: "bac", ticker: "BAC", name: "Bank of America", role: "issuer of Visa cards" },
    { id: "wfc", ticker: "WFC", name: "Wells Fargo", role: "issuer of Visa cards" },
    { id: "c", ticker: "C", name: "Citigroup", role: "global Visa issuer" },
    { id: "cof", ticker: "COF", name: "Capital One", role: "credit card issuer" },
    { id: "usb", ticker: "USB", name: "U.S. Bancorp", role: "regional issuer" },

    // 🔥 FINAL 6 — DEMAND (VOLUME ENGINE)
    { id: "fi", ticker: "FI", name: "Fiserv", role: "merchant acquiring and processing" },
    { id: "gpn", ticker: "GPN", name: "Global Payments", role: "merchant processing" },
    { id: "pypl", ticker: "PYPL", name: "PayPal", role: "wallet and payment platform" },
    { id: "sq", ticker: "SQ", name: "Block", role: "Square POS and Cash App cards" },
    { id: "aapl", ticker: "AAPL", name: "Apple", role: "Apple Pay wallet ecosystem" },
    { id: "wmt", ticker: "WMT", name: "Walmart", role: "merchant generating transaction volume" }
  ],

  edges: [
    // LAYER 1 → LAYER 2
    { source: "msft", target: "orcl" },
    { source: "amzn", target: "sap" },

    { source: "eqix", target: "crm" },
    { source: "dlr", target: "now" },

    { source: "csco", target: "acn" },
    { source: "anet", target: "ibm" },

    { source: "t", target: "acn" },
    { source: "vz", target: "ibm" },

    { source: "crwd", target: "orcl" },
    { source: "panw", target: "sap" },

    // LAYER 2 → VISA
    { source: "orcl", target: "v" },
    { source: "sap", target: "v" },
    { source: "crm", target: "v" },
    { source: "now", target: "v" },
    { source: "acn", target: "v" },
    { source: "ibm", target: "v" },

    // ALSO DIRECT INFRA DEPENDENCIES
    { source: "msft", target: "v" },
    { source: "amzn", target: "v" },
    { source: "csco", target: "v" },
    { source: "anet", target: "v" },

    // VISA → ISSUERS (CORE CLIENTS)
    { source: "v", target: "jpm" },
    { source: "v", target: "bac" },
    { source: "v", target: "wfc" },
    { source: "v", target: "c" },
    { source: "v", target: "cof" },
    { source: "v", target: "usb" },

    // ISSUERS → FINAL 6 (FLOW OF TRANSACTIONS)
    { source: "jpm", target: "fi" },
    { source: "bac", target: "gpn" },
    { source: "wfc", target: "pypl" },
    { source: "c", target: "sq" },
    { source: "cof", target: "aapl" },
    { source: "usb", target: "wmt" }
  ]
},
RTX: {
  name: "RTX Corporation",
  root: "rtx",
  nodes: [
    // LAYER 1 — MATERIALS / METALS / COMPOSITES (CORE INPUTS)
    { id: "hwm", ticker: "HWM", name: "Howmet Aerospace", role: "engine components, fasteners, structural parts" },
    { id: "ati", ticker: "ATI", name: "ATI", role: "titanium and specialty alloys" },
    { id: "crs", ticker: "CRS", name: "Carpenter Technology", role: "high-performance alloys" },
    { id: "aa", ticker: "AA", name: "Alcoa", role: "aluminum supply" },
    { id: "hxl", ticker: "HXL", name: "Hexcel", role: "carbon fiber composites" },

    // LAYER 2 — SYSTEMS / ELECTRONICS / SUBCOMPONENTS
    { id: "ph", ticker: "PH", name: "Parker-Hannifin", role: "hydraulics, fuel, motion systems" },
    { id: "etn", ticker: "ETN", name: "Eaton", role: "electrical and fuel systems" },

    { id: "txn", ticker: "TXN", name: "Texas Instruments", role: "analog semiconductors" },
    { id: "adi", ticker: "ADI", name: "Analog Devices", role: "signal processing chips" },
    { id: "mchp", ticker: "MCHP", name: "Microchip", role: "embedded control systems" },

    { id: "tel", ticker: "TEL", name: "TE Connectivity", role: "connectors and interconnects" },
    { id: "aph", ticker: "APH", name: "Amphenol", role: "connectors and cabling systems" },

    // LAYER 3 — INFRASTRUCTURE / MANUFACTURING / IT
    { id: "rok", ticker: "ROK", name: "Rockwell Automation", role: "factory automation systems" },
    { id: "emr", ticker: "EMR", name: "Emerson Electric", role: "process control systems" },

    { id: "sap", ticker: "SAP", name: "SAP", role: "ERP and supply chain planning" },
    { id: "orcl", ticker: "ORCL", name: "Oracle", role: "enterprise databases" },
    { id: "msft", ticker: "MSFT", name: "Microsoft", role: "cloud and analytics" },

    { id: "nee", ticker: "NEE", name: "NextEra Energy", role: "energy and power supply" },

    // CENTER
    { id: "rtx", ticker: "RTX", name: "RTX Corporation", role: "Collins Aerospace + Pratt & Whitney + Raytheon systems" },

    // 🔥 FINAL 6 — DEMAND (DEFENSE + AEROSPACE)
    { id: "dod", ticker: "DOD", name: "U.S. Department of Defense", role: "largest customer (missiles, radar, defense systems)" },
    { id: "lmt", ticker: "LMT", name: "Lockheed Martin", role: "defense platform integrator" },
    { id: "ba", ticker: "BA", name: "Boeing", role: "commercial and defense OEM" },
    { id: "noc", ticker: "NOC", name: "Northrop Grumman", role: "defense systems integrator" },
    { id: "dal", ticker: "DAL", name: "Delta Air Lines", role: "engine and MRO demand" },
    { id: "ual", ticker: "UAL", name: "United Airlines", role: "commercial aviation demand" }
  ],

  edges: [
    // LAYER 1 → LAYER 2
    { source: "hwm", target: "ph" },
    { source: "ati", target: "etn" },
    { source: "crs", target: "ph" },
    { source: "aa", target: "etn" },
    { source: "hxl", target: "ph" },

    // LAYER 2 → LAYER 3
    { source: "ph", target: "rok" },
    { source: "etn", target: "emr" },

    { source: "txn", target: "sap" },
    { source: "adi", target: "orcl" },
    { source: "mchp", target: "msft" },

    { source: "tel", target: "sap" },
    { source: "aph", target: "orcl" },

    // LAYER 3 → RTX
    { source: "rok", target: "rtx" },
    { source: "emr", target: "rtx" },
    { source: "sap", target: "rtx" },
    { source: "orcl", target: "rtx" },
    { source: "msft", target: "rtx" },
    { source: "nee", target: "rtx" },

    // ALSO DIRECT CORE INPUTS
    { source: "hwm", target: "rtx" },
    { source: "txn", target: "rtx" },
    { source: "adi", target: "rtx" },

    // RTX → FINAL 6
    { source: "rtx", target: "dod" },
    { source: "rtx", target: "lmt" },
    { source: "rtx", target: "ba" },
    { source: "rtx", target: "noc" },
    { source: "rtx", target: "dal" },
    { source: "rtx", target: "ual" }
  ]
},
JPM: {
  name: "JPMorgan Chase",
  root: "jpm",
  nodes: [
    // LAYER 1 — CLOUD / DATA / COMPUTE (FOUNDATION)
    { id: "msft", ticker: "MSFT", name: "Microsoft", role: "Azure cloud, analytics, productivity systems" },
    { id: "amzn", ticker: "AMZN", name: "Amazon", role: "AWS cloud infrastructure" },
    { id: "eqix", ticker: "EQIX", name: "Equinix", role: "colocation and interconnection (low-latency trading)" },

    // LAYER 2 — NETWORK / MARKET INFRASTRUCTURE (SIMPLIFIED)
    { id: "csco", ticker: "CSCO", name: "Cisco", role: "networking hardware and routing systems" },
    { id: "anet", ticker: "ANET", name: "Arista Networks", role: "low-latency switching" },
    { id: "cme", ticker: "CME", name: "CME Group", role: "derivatives exchange and clearing" },
    { id: "ice", ticker: "ICE", name: "Intercontinental Exchange", role: "exchange and clearing infrastructure" },
    { id: "v", ticker: "V", name: "Visa", role: "card network infrastructure" },

    // LAYER 3 — SOFTWARE / SECURITY / OPERATIONS (SIMPLIFIED)
    { id: "orcl", ticker: "ORCL", name: "Oracle", role: "databases and transaction systems" },
    { id: "sap", ticker: "SAP", name: "SAP", role: "ERP and financial systems" },
    { id: "crwd", ticker: "CRWD", name: "CrowdStrike", role: "cybersecurity" },
    { id: "acn", ticker: "ACN", name: "Accenture", role: "consulting and systems integration" },

    // CENTER
    { id: "jpm", ticker: "JPM", name: "JPMorgan Chase", role: "consumer banking, investment banking, markets, payments, and asset management" },

    // FINAL 6 — DEMAND (GLOBAL CLIENT BASE)
    { id: "aapl", ticker: "AAPL", name: "Apple", role: "corporate banking, capital markets, payments" },
    { id: "msft_c", ticker: "MSFT", name: "Microsoft (Client)", role: "corporate treasury and capital markets client" },
    { id: "amzn_c", ticker: "AMZN", name: "Amazon (Client)", role: "payments, lending, and treasury services" },
    { id: "xom", ticker: "XOM", name: "ExxonMobil", role: "energy financing and trading client" },
    { id: "wmt", ticker: "WMT", name: "Walmart", role: "payments, treasury, and lending client" },
    { id: "gov", ticker: "GOV", name: "Governments & Institutions", role: "sovereigns, central banks, and institutional clients" }
  ],

  edges: [
    // LAYER 1 → LAYER 2
    { source: "msft", target: "csco" },
    { source: "amzn", target: "anet" },
    { source: "eqix", target: "cme" },
    { source: "eqix", target: "ice" },

    // LAYER 2 → LAYER 3
    { source: "csco", target: "orcl" },
    { source: "anet", target: "sap" },
    { source: "cme", target: "orcl" },
    { source: "ice", target: "sap" },
    { source: "v", target: "crwd" },
    { source: "cme", target: "acn" },

    // LAYER 3 → JPM
    { source: "orcl", target: "jpm" },
    { source: "sap", target: "jpm" },
    { source: "crwd", target: "jpm" },
    { source: "acn", target: "jpm" },

    // ALSO DIRECT HIGH-SIGNAL INFRA
    { source: "cme", target: "jpm" },
    { source: "ice", target: "jpm" },
    { source: "v", target: "jpm" },

    // JPM → FINAL 6
    { source: "jpm", target: "aapl" },
    { source: "jpm", target: "msft_c" },
    { source: "jpm", target: "amzn_c" },
    { source: "jpm", target: "xom" },
    { source: "jpm", target: "wmt" },
    { source: "jpm", target: "gov" }
  ]
},
CVX: {
  name: "Chevron",
  root: "cvx",
  nodes: [
    // LAYER 1 — OILFIELD SERVICES (MOST CRITICAL INPUT)
    { id: "slb", ticker: "SLB", name: "SLB (Schlumberger)", role: "drilling, reservoir, and completion services (largest vendor)" },
    { id: "hal", ticker: "HAL", name: "Halliburton", role: "fracking, cementing, well completions" },
    { id: "bkr", ticker: "BKR", name: "Baker Hughes", role: "drilling, LNG turbomachinery, subsea equipment" },
    { id: "nov", ticker: "NOV", name: "NOV", role: "drilling equipment and rig systems" },

    // LAYER 2 — MATERIALS / INFRASTRUCTURE
    { id: "ts", ticker: "TS", name: "Tenaris", role: "OCTG steel pipe and tubing for wells" },
    { id: "x", ticker: "X", name: "U.S. Steel", role: "steel and tubular goods" },

    { id: "rig", ticker: "RIG", name: "Transocean", role: "offshore drilling rigs" },
    { id: "hp", ticker: "HP", name: "Helmerich & Payne", role: "land drilling rigs (Permian Basin)" },

    { id: "fti", ticker: "FTI", name: "TechnipFMC", role: "subsea systems and offshore infrastructure" },

    { id: "apd", ticker: "APD", name: "Air Products", role: "LNG liquefaction technology" },
    { id: "lin", ticker: "LIN", name: "Linde", role: "LNG processing and industrial gases" },

    // LAYER 3 — PROCESSING / DIGITAL / CONTROL SYSTEMS
    { id: "emr", ticker: "EMR", name: "Emerson Electric", role: "process control systems for refineries and upstream ops" },
    { id: "hon", ticker: "HON", name: "Honeywell", role: "refinery automation and process technology" },
    { id: "cat_sup", ticker: "CAT", name: "Caterpillar", role: "engines and compression systems for oil & gas" },

    { id: "msft", ticker: "MSFT", name: "Microsoft", role: "Azure cloud for data and operations" },
    { id: "amzn", ticker: "AMZN", name: "Amazon", role: "AWS analytics and reservoir modeling" },
    { id: "pltr", ticker: "PLTR", name: "Palantir", role: "data analytics and optimization platform" },

    // CENTER
    { id: "cvx", ticker: "CVX", name: "Chevron", role: "integrated oil & gas company (upstream production + downstream refining + LNG)" },

    // LAYER 5 — TRADERS / INTERMEDIATE BUYERS
    { id: "shell", ticker: "SHEL", name: "Shell Trading", role: "crude trading and refining counterparty" },
    { id: "glenc", ticker: "GLEN", name: "Glencore", role: "commodity trading and crude purchasing" },

    // 🔥 FINAL 6 — DOWNSTREAM DEMAND DRIVERS
    { id: "japan", ticker: "JERA", name: "JERA", role: "largest LNG buyer (Japan utilities)" },
    { id: "kogas", ticker: "KOGAS", name: "KOGAS", role: "Korea LNG imports" },
    { id: "united", ticker: "UAL", name: "United Airlines", role: "jet fuel demand" },
    { id: "delta", ticker: "DAL", name: "Delta Air Lines", role: "aviation fuel demand" },
    { id: "wmt", ticker: "WMT", name: "Walmart", role: "consumer fuel demand proxy (gas stations / logistics)" },
    { id: "lyb", ticker: "LYB", name: "LyondellBasell", role: "petrochemical demand (plastics, chemicals)" }
  ],

  edges: [
    // LAYER 1 → LAYER 2
    { source: "slb", target: "ts" },
    { source: "hal", target: "x" },
    { source: "bkr", target: "rig" },
    { source: "nov", target: "hp" },

    { source: "ts", target: "fti" },
    { source: "x", target: "fti" },

    { source: "rig", target: "apd" },
    { source: "hp", target: "lin" },

    // LAYER 2 → LAYER 3
    { source: "fti", target: "emr" },
    { source: "apd", target: "hon" },
    { source: "lin", target: "cat_sup" },

    { source: "emr", target: "msft" },
    { source: "hon", target: "amzn" },
    { source: "cat_sup", target: "pltr" },

    // LAYER 3 → CHEVRON
    { source: "msft", target: "cvx" },
    { source: "amzn", target: "cvx" },
    { source: "pltr", target: "cvx" },
    { source: "emr", target: "cvx" },
    { source: "hon", target: "cvx" },

    // CHEVRON → TRADERS
    { source: "cvx", target: "shell" },
    { source: "cvx", target: "glenc" },

    // TRADERS → FINAL 6
    { source: "shell", target: "japan" },
    { source: "glenc", target: "kogas" },

    { source: "shell", target: "united" },
    { source: "glenc", target: "delta" },

    { source: "shell", target: "wmt" },
    { source: "glenc", target: "lyb" }
  ]
},
KO: {
  name: "Coca-Cola",
  root: "ko",
  nodes: [
    // LAYER 1 — RAW COMMODITIES (FOUNDATION)
    { id: "adm", ticker: "ADM", name: "Archer-Daniels-Midland", role: "HFCS sweetener supplier (core input)" },
    { id: "bg", ticker: "BG", name: "Bunge", role: "global sugar and agricultural supply" },
    { id: "ingr", ticker: "INGR", name: "Ingredion", role: "sweeteners (HFCS, stevia) and starches" },

    { id: "lin", ticker: "LIN", name: "Linde", role: "CO₂ supply for carbonation" },
    { id: "apd", ticker: "APD", name: "Air Products", role: "industrial gases including CO₂" },

    // LAYER 2 — INGREDIENTS / PACKAGING (CORE COST STRUCTURE)
    { id: "ball", ticker: "BALL", name: "Ball Corporation", role: "aluminum cans (largest packaging supplier)" },
    { id: "cck", ticker: "CCK", name: "Crown Holdings", role: "metal beverage cans and closures" },
    { id: "ard", ticker: "ARD", name: "Ardagh", role: "glass and metal packaging" },

    { id: "oi", ticker: "OI", name: "Owens-Illinois", role: "glass bottle manufacturing" },
    { id: "pkg", ticker: "PKG", name: "Packaging Corp", role: "cartons and secondary packaging" },

    // LAYER 3 — BOTTLING / PRODUCTION SYSTEM (CRITICAL CHOKEPOINT)
    { id: "krones", ticker: "KRONES", name: "Krones", role: "bottling and filling line equipment" },
    { id: "sidel", ticker: "SIDEL", name: "Sidel", role: "PET bottling systems" },

    { id: "msft", ticker: "MSFT", name: "Microsoft", role: "enterprise cloud and digital transformation" },
    { id: "sap", ticker: "SAP", name: "SAP", role: "ERP and supply chain management" },

    // CENTER
    { id: "ko", ticker: "KO", name: "Coca-Cola", role: "concentrate producer, brand owner, and global beverage system operator" },

    // LAYER 5 — BOTTLERS (MOST IMPORTANT NODE)
    { id: "kof", ticker: "KOF", name: "Coca-Cola FEMSA", role: "largest global bottler by volume" },
    { id: "ccep", ticker: "CCEP", name: "Coca-Cola Europacific Partners", role: "Europe, APAC bottler" },
    { id: "coke_hbc", ticker: "CCHGY", name: "Coca-Cola HBC", role: "EMEA bottling partner" },
    { id: "arca", ticker: "AC", name: "Arca Continental", role: "Latin America + U.S. bottler" },
    { id: "coke_con", ticker: "COKE", name: "Coca-Cola Consolidated", role: "largest U.S. bottler" },

    // 🔥 FINAL 6 — DOWNSTREAM DEMAND DRIVERS
    { id: "wmt", ticker: "WMT", name: "Walmart", role: "largest global grocery retail channel" },
    { id: "cost", ticker: "COST", name: "Costco", role: "high-volume bulk beverage sales" },
    { id: "kr", ticker: "KR", name: "Kroger", role: "major U.S. grocery distribution" },
    { id: "mcd", ticker: "MCD", name: "McDonald's", role: "exclusive global fountain partner (highest-margin channel)" },
    { id: "sbux", ticker: "SBUX", name: "Starbucks", role: "away-from-home beverage demand proxy" },
    { id: "amzn", ticker: "AMZN", name: "Amazon", role: "e-commerce beverage distribution channel" }
  ],

  edges: [
    // LAYER 1 → LAYER 2
    { source: "adm", target: "ball" },
    { source: "bg", target: "cck" },
    { source: "ingr", target: "ard" },

    { source: "lin", target: "oi" },
    { source: "apd", target: "pkg" },

    // LAYER 2 → LAYER 3
    { source: "ball", target: "krones" },
    { source: "cck", target: "sidel" },
    { source: "ard", target: "krones" },

    { source: "oi", target: "msft" },
    { source: "pkg", target: "sap" },

    // LAYER 3 → COCA-COLA
    { source: "krones", target: "ko" },
    { source: "sidel", target: "ko" },
    { source: "msft", target: "ko" },
    { source: "sap", target: "ko" },

    // COCA-COLA → BOTTLERS (MOST IMPORTANT STEP)
    { source: "ko", target: "kof" },
    { source: "ko", target: "ccep" },
    { source: "ko", target: "coke_hbc" },
    { source: "ko", target: "arca" },
    { source: "ko", target: "coke_con" },

    // BOTTLERS → FINAL 6
    { source: "kof", target: "wmt" },
    { source: "ccep", target: "cost" },
    { source: "coke_hbc", target: "kr" },
    { source: "arca", target: "mcd" },
    { source: "coke_con", target: "sbux" },
    { source: "kof", target: "amzn" }
  ]
},
CAT: {
  name: "Caterpillar",
  root: "cat",
  nodes: [
    // LAYER 1 — RAW MATERIALS (FOUNDATION)
    { id: "nue", ticker: "NUE", name: "Nucor", role: "primary U.S. steel supplier" },
    { id: "stld", ticker: "STLD", name: "Steel Dynamics", role: "structural and flat-rolled steel" },
    { id: "x", ticker: "X", name: "U.S. Steel", role: "domestic steel production" },
    { id: "mt", ticker: "MT", name: "ArcelorMittal", role: "global steel supply for international plants" },

    // LAYER 2 — COMPONENTS / POWERTRAIN / HYDRAULICS
    { id: "bosh", ticker: "BOSCH", name: "Bosch", role: "fuel injection systems, electronics, engine control units" },
    { id: "dnso", ticker: "6902.T", name: "Denso", role: "fuel systems, sensors, thermal components" },
    { id: "cmi", ticker: "CMI", name: "Cummins", role: "engine components and subsystems" },
    { id: "bw", ticker: "BWA", name: "BorgWarner", role: "turbochargers and emissions systems" },

    { id: "ph", ticker: "PH", name: "Parker Hannifin", role: "hydraulic pumps, valves, cylinders (critical supplier)" },
    { id: "eat", ticker: "ETN", name: "Eaton", role: "hydraulics and power management systems" },

    { id: "brdg", ticker: "BRDG", name: "Bridgestone", role: "off-highway tires for mining trucks" },
    { id: "gt", ticker: "GT", name: "Goodyear", role: "OTR tires" },

    // LAYER 3 — ELECTRONICS / SOFTWARE / DIGITAL
    { id: "txn", ticker: "TXN", name: "Texas Instruments", role: "microcontrollers and embedded chips" },
    { id: "nxp", ticker: "NXPI", name: "NXP", role: "automotive and industrial chips" },
    { id: "trim", ticker: "TRMB", name: "Trimble", role: "GPS, machine control, and MineStar integration" },
    { id: "nvda", ticker: "NVDA", name: "NVIDIA", role: "autonomous mining and AI compute systems" },

    { id: "sap", ticker: "SAP", name: "SAP", role: "ERP and supply chain backbone" },
    { id: "amzn", ticker: "AMZN", name: "Amazon", role: "AWS cloud for Cat Digital and remote monitoring" },
    { id: "msft", ticker: "MSFT", name: "Microsoft", role: "Azure cloud infrastructure" },

    // CENTER
    { id: "cat", ticker: "CAT", name: "Caterpillar", role: "heavy equipment manufacturing (construction, mining, energy, engines)" },

    // LAYER 5 — DEALERS (CRITICAL CHOKEPOINT)
    { id: "dealer", ticker: "DEALER", name: "Dealer Network", role: "160+ global dealers handling sales, inventory, service, and financing" },

    // 🔥 FINAL 6 — DOWNSTREAM (COMPRESSED)
    { id: "uri", ticker: "URI", name: "United Rentals", role: "largest equipment rental buyer (construction demand proxy)" },
    { id: "bhp", ticker: "BHP", name: "BHP", role: "largest global mining operator (iron ore, copper)" },
    { id: "rio", ticker: "RIO", name: "Rio Tinto", role: "mining customer with autonomous fleets" },
    { id: "fcx", ticker: "FCX", name: "Freeport-McMoRan", role: "copper mining demand driver" },
    { id: "xom", ticker: "XOM", name: "ExxonMobil", role: "oil & gas infrastructure and engine demand" },
    { id: "cvx", ticker: "CVX", name: "Chevron", role: "energy infrastructure demand" }
  ],

  edges: [
    // LAYER 1 → LAYER 2
    { source: "nue", target: "bosh" },
    { source: "stld", target: "dnso" },
    { source: "x", target: "cmi" },
    { source: "mt", target: "bw" },

    { source: "bosh", target: "ph" },
    { source: "dnso", target: "eat" },
    { source: "cmi", target: "ph" },
    { source: "bw", target: "eat" },

    { source: "ph", target: "brdg" },
    { source: "eat", target: "gt" },

    // LAYER 2 → LAYER 3
    { source: "brdg", target: "txn" },
    { source: "gt", target: "nxp" },

    { source: "txn", target: "trim" },
    { source: "nxp", target: "nvda" },

    { source: "trim", target: "sap" },
    { source: "nvda", target: "amzn" },

    // LAYER 3 → CAT
    { source: "sap", target: "cat" },
    { source: "amzn", target: "cat" },
    { source: "msft", target: "cat" },
    { source: "trim", target: "cat" },
    { source: "nvda", target: "cat" },

    // CAT → DEALERS
    { source: "cat", target: "dealer" },

    // DEALERS → FINAL 6
    { source: "dealer", target: "uri" },
    { source: "dealer", target: "bhp" },
    { source: "dealer", target: "rio" },
    { source: "dealer", target: "fcx" },
    { source: "dealer", target: "xom" },
    { source: "dealer", target: "cvx" }
  ]
},
CSCO: {
  name: "Cisco",
  root: "csco",
  nodes: [
    // LAYER 0 — SEMICONDUCTOR EQUIPMENT (FOUNDATIONAL)
    { id: "asml", ticker: "ASML", name: "ASML", role: "EUV lithography machines required for advanced semiconductor manufacturing" },

    // LAYER 1 — DESIGN (CRITICAL FOR CUSTOM ASICs)
    { id: "snps", ticker: "SNPS", name: "Synopsys", role: "EDA tools for Cisco ASIC design (routing, switching silicon)" },
    { id: "cdns", ticker: "CDNS", name: "Cadence", role: "EDA tools and chip verification" },

    // LAYER 2 — FOUNDRY / CORE SILICON PRODUCTION
    { id: "tsm", ticker: "TSM", name: "TSMC", role: "primary foundry for Cisco custom ASIC networking chips" },

    // LAYER 3 — SEMICONDUCTORS / CORE COMPONENTS
    { id: "intc", ticker: "INTC", name: "Intel", role: "processors for networking platforms and servers" },
    { id: "mrvl", ticker: "MRVL", name: "Marvell", role: "networking and storage silicon" },
    { id: "avgo", ticker: "AVGO", name: "Broadcom", role: "Ethernet switching and controller silicon" },
    { id: "mu", ticker: "MU", name: "Micron", role: "DRAM and NAND memory" },
    { id: "txn", ticker: "TXN", name: "Texas Instruments", role: "analog and power semiconductors" },
    { id: "mchp", ticker: "MCHP", name: "Microchip", role: "microcontrollers and timing devices" },
    { id: "qcom", ticker: "QCOM", name: "Qualcomm", role: "wireless networking chipsets" },

    // LAYER 4 — MANUFACTURING / HARDWARE BUILD
    { id: "fn", ticker: "FN", name: "Flex", role: "primary EMS partner for Cisco hardware assembly" },
    { id: "jbl", ticker: "JBL", name: "Jabil", role: "PCB assembly and systems integration" },
    { id: "cls", ticker: "CLS", name: "Celestica", role: "contract manufacturing partner" },

    { id: "ttmi", ticker: "TTMI", name: "TTM Technologies", role: "printed circuit boards" },
    { id: "aph", ticker: "APH", name: "Amphenol", role: "connectors and interconnect systems" },
    { id: "glw", ticker: "GLW", name: "Corning", role: "optical fiber and networking components" },

    // LAYER 5 — SOFTWARE / AI / PLATFORM
    { id: "nvda", ticker: "NVDA", name: "NVIDIA", role: "AI compute and networking acceleration" },
    { id: "splk", ticker: "SPLK", name: "Splunk", role: "observability, security, and analytics platform" },

    // CENTER
    { id: "csco", ticker: "CSCO", name: "Cisco", role: "networking infrastructure, security, observability, and collaboration platform" },

    // LAYER 6 — CHANNEL / DISTRIBUTION (CRITICAL BOTTLENECK)
    { id: "cdw", ticker: "CDW", name: "CDW", role: "value-added reseller (VAR)" },
    { id: "snx", ticker: "SNX", name: "TD Synnex", role: "global distributor" },
    { id: "arrow", ticker: "ARW", name: "Arrow Electronics", role: "distribution and supply chain partner" },

    { id: "acn", ticker: "ACN", name: "Accenture", role: "system integrator deploying Cisco solutions" },
    { id: "ibm", ticker: "IBM", name: "IBM", role: "enterprise integrator and consulting partner" },

    // LAYER 7 — END MARKETS / DEMAND DRIVERS
    { id: "amzn_c", ticker: "AMZN", name: "Amazon (AWS)", role: "hyperscaler data center demand" },
    { id: "msft_c", ticker: "MSFT", name: "Microsoft (Azure)", role: "cloud infrastructure demand" },
    { id: "googl", ticker: "GOOGL", name: "Google Cloud", role: "hyperscaler networking demand" },

    { id: "vz", ticker: "VZ", name: "Verizon", role: "telecom infrastructure demand" },
    { id: "t", ticker: "T", name: "AT&T", role: "telecom infrastructure demand" },

    { id: "ent", ticker: "ENT", name: "Enterprise Customers", role: "global enterprise IT demand" }
  ],

  edges: [
    // DESIGN → FOUNDRY
    { source: "snps", target: "tsm" },
    { source: "cdns", target: "tsm" },

    // EQUIPMENT → FOUNDRY (CRITICAL CHOKEPOINT)
    { source: "asml", target: "tsm" },

    // FOUNDRY → CORE SILICON ECOSYSTEM
    { source: "tsm", target: "mrvl" },
    { source: "tsm", target: "avgo" },

    // ALSO DIRECT DEPENDENCY
    { source: "tsm", target: "csco" },

    // SILICON → MANUFACTURING
    { source: "intc", target: "jbl" },
    { source: "mrvl", target: "cls" },
    { source: "avgo", target: "fn" },
    { source: "mu", target: "jbl" },
    { source: "txn", target: "cls" },
    { source: "mchp", target: "fn" },
    { source: "qcom", target: "jbl" },

    // EMS → COMPONENT INTEGRATION
    { source: "fn", target: "ttmi" },
    { source: "jbl", target: "aph" },
    { source: "cls", target: "glw" },

    // HARDWARE → SOFTWARE LAYER
    { source: "ttmi", target: "nvda" },
    { source: "glw", target: "nvda" },
    { source: "aph", target: "splk" },

    // SOFTWARE → CISCO
    { source: "nvda", target: "csco" },
    { source: "splk", target: "csco" },

    // CISCO → CHANNEL
    { source: "csco", target: "cdw" },
    { source: "csco", target: "snx" },
    { source: "csco", target: "arrow" },
    { source: "csco", target: "acn" },
    { source: "csco", target: "ibm" },

    // CHANNEL → END MARKETS
    { source: "cdw", target: "ent" },
    { source: "snx", target: "ent" },
    { source: "arrow", target: "ent" },

    { source: "acn", target: "amzn_c" },
    { source: "ibm", target: "msft_c" },

    { source: "cdw", target: "vz" },
    { source: "snx", target: "t" },
    { source: "arrow", target: "googl" }
  ]
},
MRK: {
  name: "Merck",
  root: "mrk",
  nodes: [
    // LAYER 1 — RAW MATERIALS / BIOLOGICAL INPUTS
    { id: "chem", ticker: "CHEM", name: "Chemical Suppliers", role: "APIs, excipients, and specialty chemicals (global sourcing, India/China exposure)" },
    { id: "bio", ticker: "BIO", name: "Biological Inputs", role: "cell culture media, fermentation inputs for biologics like Keytruda" },

    // LAYER 2 — MANUFACTURING / LAB / CDMO
    { id: "tmo", ticker: "TMO", name: "Thermo Fisher", role: "CDMO (Patheon), lab equipment, reagents, and manufacturing support" },
    { id: "dhr", ticker: "DHR", name: "Danaher", role: "Cytiva bioprocessing systems and biologics manufacturing equipment" },
    { id: "a", ticker: "A", name: "Agilent", role: "analytical instruments for R&D and quality control" },
    { id: "wats", ticker: "WAT", name: "Waters", role: "analytical and testing systems for pharmaceutical production" },

    // LAYER 3 — R&D / PIPELINE INPUTS
    { id: "azn", ticker: "AZN", name: "AstraZeneca", role: "oncology collaboration (Lynparza, Koselugo)" },
    { id: "esai", ticker: "ESALY", name: "Eisai", role: "co-commercialization of Lenvima" },
    { id: "daiichi", ticker: "DSNKY", name: "Daiichi Sankyo", role: "ADC partnership and oncology pipeline development" },

    { id: "sap", ticker: "SAP", name: "SAP", role: "ERP and supply chain planning backbone (SAP Ariba network)" },
    { id: "amzn", ticker: "AMZN", name: "Amazon", role: "AWS cloud infrastructure for research data and manufacturing systems" },
    { id: "msft", ticker: "MSFT", name: "Microsoft", role: "Azure cloud infrastructure and enterprise systems" },

    // CENTER
    { id: "mrk", ticker: "MRK", name: "Merck", role: "pharmaceutical R&D, biologics manufacturing, and global drug commercialization" },

    // LAYER 5 — WHOLESALE DISTRIBUTION (CRITICAL CHOKEPOINT)
    { id: "mck", ticker: "MCK", name: "McKesson", role: "largest U.S. pharmaceutical distributor" },
    { id: "cor", ticker: "COR", name: "Cencora", role: "specialty drug distribution and logistics" },
    { id: "cah", ticker: "CAH", name: "Cardinal Health", role: "hospital and pharmacy drug distribution" },

    // LAYER 6 — ACCESS CONTROL (PBMs / PROVIDERS)
    { id: "unh", ticker: "UNH", name: "UnitedHealth", role: "OptumRx PBM controlling formulary placement and reimbursement" },
    { id: "cvs", ticker: "CVS", name: "CVS Health", role: "Caremark PBM and specialty pharmacy access channel" },
    { id: "ci", ticker: "CI", name: "Cigna", role: "Express Scripts PBM controlling drug access" },

    { id: "hca", ticker: "HCA", name: "HCA Healthcare", role: "hospital system administering oncology drugs (Keytruda, etc.)" },
    { id: "thc", ticker: "THC", name: "Tenet Healthcare", role: "hospital and outpatient care delivery" },

    // LAYER 7 — FINAL DISPENSING / END MARKET
    { id: "wba", ticker: "WBA", name: "Walgreens", role: "retail pharmacy dispensing oral medications" },
    { id: "patient", ticker: "PATIENT", name: "Patients", role: "end recipients of Merck drugs (oncology, vaccines, chronic care)" }
  ],

  edges: [
    // LAYER 1 → LAYER 2
    { source: "chem", target: "tmo" },
    { source: "bio", target: "dhr" },

    { source: "chem", target: "a" },
    { source: "bio", target: "wats" },

    // LAYER 2 → LAYER 3
    { source: "tmo", target: "azn" },
    { source: "dhr", target: "esai" },
    { source: "a", target: "daiichi" },

    { source: "wats", target: "sap" },
    { source: "tmo", target: "amzn" },
    { source: "dhr", target: "msft" },

    // LAYER 3 → MERCK
    { source: "azn", target: "mrk" },
    { source: "esai", target: "mrk" },
    { source: "daiichi", target: "mrk" },
    { source: "sap", target: "mrk" },
    { source: "amzn", target: "mrk" },
    { source: "msft", target: "mrk" },

    // MERCK → WHOLESALERS
    { source: "mrk", target: "mck" },
    { source: "mrk", target: "cor" },
    { source: "mrk", target: "cah" },

    // WHOLESALERS → PBMs / PROVIDERS
    { source: "mck", target: "unh" },
    { source: "cor", target: "cvs" },
    { source: "cah", target: "ci" },

    { source: "mck", target: "hca" },
    { source: "cor", target: "thc" },

    // PBMs / PROVIDERS → FINAL
    { source: "unh", target: "wba" },
    { source: "cvs", target: "wba" },
    { source: "ci", target: "wba" },

    { source: "hca", target: "patient" },
    { source: "thc", target: "patient" },
    { source: "wba", target: "patient" }
  ]
},
UNH: {
  name: "UnitedHealth Group",
  root: "unh",
  nodes: [
    // LAYER 1 — DRUG MANUFACTURERS / CORE MEDICAL INPUTS
    { id: "pfe", ticker: "PFE", name: "Pfizer", role: "branded pharmaceuticals flowing through Optum Rx" },
    { id: "mrk", ticker: "MRK", name: "Merck", role: "branded pharmaceuticals and specialty drugs" },
    { id: "lly", ticker: "LLY", name: "Eli Lilly", role: "high-growth specialty drugs (obesity, diabetes)" },
    { id: "nvo", ticker: "NVO", name: "Novo Nordisk", role: "GLP-1 drugs and metabolic treatments" },
    { id: "abbv", ticker: "ABBV", name: "AbbVie", role: "immunology and specialty biologics" },
    { id: "bmy", ticker: "BMY", name: "Bristol-Myers Squibb", role: "oncology and specialty pharma" },
    { id: "teva", ticker: "TEVA", name: "Teva", role: "generic drug manufacturing" },
    { id: "vtrs", ticker: "VTRS", name: "Viatris", role: "generic and biosimilar drugs" },

    // LAYER 2 — DISTRIBUTION / CARE DELIVERY NETWORK
    { id: "mck", ticker: "MCK", name: "McKesson", role: "drug distribution to pharmacies and provider networks" },
    { id: "cor", ticker: "COR", name: "Cencora", role: "specialty drug distribution and logistics" },
    { id: "cah", ticker: "CAH", name: "Cardinal Health", role: "hospital and pharmacy distribution" },

    { id: "hca", ticker: "HCA", name: "HCA Healthcare", role: "hospital system providing in-network care" },
    { id: "thc", ticker: "THC", name: "Tenet Healthcare", role: "hospital and ambulatory care provider" },

    // LAYER 3 — DATA / CLAIMS / HEALTH INFRASTRUCTURE
    { id: "msft", ticker: "MSFT", name: "Microsoft", role: "Azure cloud infrastructure for healthcare data and operations" },
    { id: "amzn", ticker: "AMZN", name: "Amazon", role: "AWS cloud workloads and analytics" },
    { id: "orcl", ticker: "ORCL", name: "Oracle", role: "Cerner EHR systems feeding clinical data into ecosystem" },
    { id: "crm", ticker: "CRM", name: "Salesforce", role: "CRM and enterprise client management systems" },

    // MOST IMPORTANT INPUT
    { id: "cms", ticker: "CMS", name: "CMS", role: "Medicare/Medicaid reimbursement rates, rules, and funding (largest revenue driver)" },

    // CENTER
    { id: "unh", ticker: "UNH", name: "UnitedHealth Group", role: "payer (insurance) + Optum (care delivery, PBM, data, analytics)" },

    // LAYER 5 — DOWNSTREAM CUSTOMERS / DEMAND
    { id: "emp", ticker: "EMP", name: "Employers", role: "commercial health insurance buyers for employees" },
    { id: "ind", ticker: "IND", name: "Individuals", role: "ACA and direct health plan members" },
    { id: "med", ticker: "MED", name: "Medicare Beneficiaries", role: "Medicare Advantage and Part D members" },
    { id: "medicaid", ticker: "MEDICAID", name: "Medicaid Beneficiaries", role: "state-managed care population" },

    { id: "ci", ticker: "CI", name: "Cigna", role: "payer client of Optum Insight and Optum Rx services" },
    { id: "cvs", ticker: "CVS", name: "CVS Health", role: "payer client / competitor using Optum infrastructure in some areas" }
  ],

  edges: [
    // LAYER 1 → LAYER 2
    { source: "pfe", target: "mck" },
    { source: "mrk", target: "cor" },
    { source: "lly", target: "cah" },
    { source: "nvo", target: "mck" },
    { source: "abbv", target: "cor" },
    { source: "bmy", target: "cah" },
    { source: "teva", target: "mck" },
    { source: "vtrs", target: "cor" },

    { source: "mck", target: "hca" },
    { source: "cor", target: "thc" },
    { source: "cah", target: "hca" },

    // LAYER 2 → LAYER 3
    { source: "hca", target: "msft" },
    { source: "thc", target: "amzn" },

    { source: "msft", target: "orcl" },
    { source: "amzn", target: "crm" },

    // LAYER 3 → UNH
    { source: "msft", target: "unh" },
    { source: "amzn", target: "unh" },
    { source: "orcl", target: "unh" },
    { source: "crm", target: "unh" },

    // CRITICAL DIRECT INPUT
    { source: "cms", target: "unh" },

    // UNH → DOWNSTREAM
    { source: "unh", target: "emp" },
    { source: "unh", target: "ind" },
    { source: "unh", target: "med" },
    { source: "unh", target: "medicaid" },

    { source: "unh", target: "ci" },
    { source: "unh", target: "cvs" }
  ]
},
GS: {
  name: "Goldman Sachs",
  root: "gs",
  nodes: [
    // LAYER 1 — CORE INPUTS (DATA / CAPITAL / REGULATION)
    { id: "spgi", ticker: "SPGI", name: "S&P Global", role: "credit ratings, index data, and market intelligence" },
    { id: "mood", ticker: "MCO", name: "Moody's", role: "credit ratings and risk analytics" },
    { id: "msc", ticker: "MSCI", name: "MSCI", role: "index construction, ESG ratings, and portfolio risk data" },
    { id: "fds", ticker: "FDS", name: "FactSet", role: "portfolio analytics, research data, and institutional analytics tools" },

    { id: "fed", ticker: "FED", name: "Federal Reserve", role: "monetary policy, liquidity, and cost of capital" },
    { id: "repo", ticker: "REPO", name: "Repo / Bond Markets", role: "short-term funding and wholesale capital markets" },

    // LAYER 2 — TECHNOLOGY / TRADING INFRASTRUCTURE
    { id: "amzn", ticker: "AMZN", name: "Amazon", role: "AWS cloud infrastructure for data, analytics, and trading systems" },
    { id: "msft", ticker: "MSFT", name: "Microsoft", role: "Azure cloud and enterprise productivity systems" },
    { id: "avgo", ticker: "AVGO", name: "Broadcom", role: "VMware virtualization and infrastructure stack" },
    { id: "eqix", ticker: "EQIX", name: "Equinix", role: "data center colocation for low-latency trading infrastructure" },

    // LAYER 3 — MARKET STRUCTURE / EXECUTION VENUES
    { id: "ice", ticker: "ICE", name: "Intercontinental Exchange", role: "exchange operator and derivatives marketplace" },
    { id: "cme", ticker: "CME", name: "CME Group", role: "futures and derivatives trading platform" },
    { id: "cboe", ticker: "CBOE", name: "Cboe Global Markets", role: "options and equities trading exchange" },
    { id: "dtcc", ticker: "DTCC", name: "DTCC", role: "post-trade clearing and settlement infrastructure" },

    // CENTER
    { id: "gs", ticker: "GS", name: "Goldman Sachs", role: "investment banking, trading, asset management, and financial intermediation platform" },

    // LAYER 5 — DOWNSTREAM CLIENTS (DEMAND DRIVERS)
    { id: "corp", ticker: "CORP", name: "Corporations", role: "M&A advisory, equity/debt issuance, and financing clients" },
    { id: "inst", ticker: "INST", name: "Institutional Investors", role: "hedge funds, mutual funds, pensions trading and prime brokerage clients" },
    { id: "pe", ticker: "PE", name: "Private Equity Firms", role: "buyout advisory, financing, and capital markets clients" },
    { id: "gov", ticker: "GOV", name: "Governments", role: "sovereign advisory, debt issuance, and infrastructure finance clients" },
    { id: "wealth", ticker: "WEALTH", name: "Wealth Clients", role: "ultra-high-net-worth individuals and family offices" }
  ],

  edges: [
    // LAYER 1 → LAYER 2
    { source: "spgi", target: "amzn" },
    { source: "mood", target: "msft" },
    { source: "msc", target: "amzn" },
    { source: "fds", target: "msft" },

    { source: "fed", target: "avgo" },
    { source: "repo", target: "eqix" },

    // LAYER 2 → LAYER 3
    { source: "amzn", target: "ice" },
    { source: "msft", target: "cme" },
    { source: "avgo", target: "cboe" },
    { source: "eqix", target: "dtcc" },

    // LAYER 3 → GOLDMAN
    { source: "ice", target: "gs" },
    { source: "cme", target: "gs" },
    { source: "cboe", target: "gs" },
    { source: "dtcc", target: "gs" },

    // ALSO CORE DATA / CAPITAL → GOLDMAN (DIRECT DEPENDENCY)
    { source: "spgi", target: "gs" },
    { source: "mood", target: "gs" },
    { source: "msc", target: "gs" },
    { source: "fed", target: "gs" },
    { source: "repo", target: "gs" },

    // GOLDMAN → CLIENTS
    { source: "gs", target: "corp" },
    { source: "gs", target: "inst" },
    { source: "gs", target: "pe" },
    { source: "gs", target: "gov" },
    { source: "gs", target: "wealth" }
  ]
},
IBM: {
  name: "IBM",
  root: "ibm",
  nodes: [
    // LAYER 0 — SEMICONDUCTOR EQUIPMENT
    { id: "asml", ticker: "ASML", name: "ASML", role: "EUV lithography machines enabling advanced-node manufacturing for Samsung Foundry and Rapidus" },

    // LAYER 1 — CHIP / HARDWARE FOUNDATIONAL INPUTS
    { id: "ssnl", ticker: "SSNLF", name: "Samsung Foundry", role: "primary manufacturer for IBM Telum II, Spyre AI accelerators, and Power CPUs" },
    { id: "rapidus", ticker: "RAPIDUS", name: "Rapidus", role: "2nm process development partner for future chip manufacturing" },
    { id: "mu", ticker: "MU", name: "Micron", role: "server and mainframe memory supplier" },
    { id: "stx", ticker: "STX", name: "Seagate", role: "storage components for IBM infrastructure systems" },
    { id: "wdc", ticker: "WDC", name: "Western Digital", role: "disk and flash storage components" },
    { id: "nvda", ticker: "NVDA", name: "NVIDIA", role: "networking and accelerator ecosystem through Mellanox / InfiniBand" },
    { id: "avgo", ticker: "AVGO", name: "Broadcom", role: "networking components and VMware infrastructure layer" },

    // LAYER 2 — PLATFORM / SOFTWARE / CLOUD ECOSYSTEM
    { id: "rht", ticker: "RHT", name: "Red Hat", role: "OpenShift, Linux, and hybrid cloud foundation of IBM's software platform" },
    { id: "hashi", ticker: "HASHI", name: "HashiCorp", role: "infrastructure automation and Terraform tooling" },
    { id: "apptio", ticker: "APPTIO", name: "Apptio", role: "FinOps and technology business management platform" },
    { id: "amzn", ticker: "AMZN", name: "Amazon", role: "AWS infrastructure partner for IBM Consulting and OpenShift deployments" },
    { id: "msft", ticker: "MSFT", name: "Microsoft", role: "Azure strategic cloud partner for consulting and OpenShift deployments" },

    // LAYER 3 — IMPLEMENTATION / ECOSYSTEM DELIVERY
    { id: "orcl", ticker: "ORCL", name: "Oracle", role: "enterprise platform IBM Consulting deploys for clients" },
    { id: "crm", ticker: "CRM", name: "Salesforce", role: "customer platform IBM Consulting implements for enterprises" },
    { id: "sap", ticker: "SAP", name: "SAP", role: "ERP and enterprise transformation platform deployed by IBM Consulting" },
    { id: "now", ticker: "NOW", name: "ServiceNow", role: "workflow automation partner in IBM consulting engagements" },
    { id: "adbe", ticker: "ADBE", name: "Adobe", role: "digital experience platform partner in IBM client implementations" },
    { id: "ey", ticker: "EY", name: "EY", role: "co-delivery partner in IBM's AI supply chain initiative" },

    // CENTER
    { id: "ibm", ticker: "IBM", name: "IBM", role: "hybrid cloud, AI software, consulting, mainframes, and enterprise infrastructure" },

    // LAYER 5 — DOWNSTREAM CUSTOMER VERTICALS / COMMUNITIES
    { id: "banks", ticker: "BANKS", name: "Financial Services", role: "banks, insurers, and capital markets clients running regulated workloads and IBM Z" },
    { id: "gov", ticker: "GOV", name: "Government & Public Sector", role: "federal, defense, and sovereign cloud / consulting customers" },
    { id: "health", ticker: "HEALTH", name: "Healthcare & Life Sciences", role: "hospital, pharma, and insurance customers using data and AI systems" },
    { id: "telco", ticker: "TELCO", name: "Telecommunications", role: "telco customers using hybrid cloud, 5G operations, and AI automation" },
    { id: "ind", ticker: "IND", name: "Industrial & Manufacturing", role: "industrial clients using Maximo, IoT, predictive maintenance, and digital twins" },
    { id: "dev", ticker: "DEV", name: "Developer / Open Source Ecosystem", role: "OpenShift developers, ISVs, resellers, and IBM Partner Plus ecosystem" }
  ],

  edges: [
    // LAYER 0 → LAYER 1
    { source: "asml", target: "ssnl" },
    { source: "asml", target: "rapidus" },

    // ALSO CRITICAL DIRECT DEPENDENCY
    { source: "asml", target: "ibm" },

    // LAYER 1 → LAYER 2
    { source: "ssnl", target: "rht" },
    { source: "rapidus", target: "hashi" },
    { source: "mu", target: "apptio" },
    { source: "stx", target: "amzn" },
    { source: "wdc", target: "msft" },
    { source: "nvda", target: "rht" },
    { source: "avgo", target: "msft" },

    // LAYER 2 → LAYER 3
    { source: "rht", target: "orcl" },
    { source: "hashi", target: "crm" },
    { source: "apptio", target: "sap" },
    { source: "amzn", target: "now" },
    { source: "msft", target: "adbe" },

    { source: "rht", target: "ey" },
    { source: "hashi", target: "ey" },

    // LAYER 3 → IBM
    { source: "orcl", target: "ibm" },
    { source: "crm", target: "ibm" },
    { source: "sap", target: "ibm" },
    { source: "now", target: "ibm" },
    { source: "adbe", target: "ibm" },
    { source: "ey", target: "ibm" },

    // IBM → DOWNSTREAM
    { source: "ibm", target: "banks" },
    { source: "ibm", target: "gov" },
    { source: "ibm", target: "health" },
    { source: "ibm", target: "telco" },
    { source: "ibm", target: "ind" },
    { source: "ibm", target: "dev" }
  ]
},
MCD: {
  name: "McDonald's",
  root: "mcd",
  nodes: [
    // LAYER 1 — RAW FOOD / CORE INPUTS
    { id: "beef", ticker: "BEEF", name: "Beef Supply", role: "raw beef inputs from U.S., Brazil, Argentina, Australia, and Paraguay" },
    { id: "chicken", ticker: "CHICK", name: "Chicken Supply", role: "raw poultry inputs from U.S., Brazil, and Canada" },
    { id: "potato", ticker: "POTATO", name: "Potato Farms", role: "Russet Burbank and Shepody potato supply for fries and hashbrowns" },
    { id: "produce", ticker: "PRODUCE", name: "Produce Farms", role: "lettuce, tomatoes, onions, and apples from local and regional farms" },
    { id: "dairy", ticker: "DAIRY", name: "Dairy Inputs", role: "milk, cheese, and dairy products from regional dairy co-ops and producers" },
    { id: "fish", ticker: "FISH", name: "MSC Fisheries", role: "wild-caught Alaska Pollock and other certified sustainable fish supply" },
    { id: "coffee", ticker: "COFFEE", name: "Coffee Inputs", role: "green coffee sourcing for McCafé beverage production" },

    // LAYER 2 — PROCESSING / FOOD PREP / PACKAGING
    { id: "lopez", ticker: "LOPEZ", name: "Lopez Foods", role: "primary U.S. beef patty supplier" },
    { id: "osi", ticker: "OSI", name: "OSI Group", role: "global beef processor and traceability systems partner" },
    { id: "tyson", ticker: "TSN", name: "Tyson Foods", role: "primary chicken supplier for McNuggets and sandwiches" },
    { id: "cargill", ticker: "CARG", name: "Cargill", role: "poultry processing partner" },
    { id: "lw", ticker: "LW", name: "Lamb Weston", role: "primary fries and hashbrown supplier" },
    { id: "bakery", ticker: "BAKERY", name: "Aspire Bakeries", role: "buns, muffins, bagels, and baked goods supplier" },
    { id: "freshex", ticker: "FRESH", name: "Fresh Express", role: "pre-cut lettuce and salad component supplier" },
    { id: "dfa", ticker: "DFA", name: "Dairy Farmers of America", role: "cheese and dairy processing partner" },
    { id: "gavina", ticker: "GAVINA", name: "Gaviña Gourmet Coffee", role: "McCafé coffee blending and roasting partner" },
    { id: "ko", ticker: "KO", name: "Coca-Cola", role: "exclusive soft drink supplier and juice system partner" },
    { id: "pkg", ticker: "PKG", name: "Packaging Suppliers", role: "food-grade wrappers, cups, bags, and paper packaging" },

    // LAYER 3 — LOGISTICS / TECHNOLOGY / RESTAURANT OPERATIONS
    { id: "mbi", ticker: "MBI", name: "Martin Brower", role: "global cold-chain distribution and restaurant delivery network" },
    { id: "armada", ticker: "ARMADA", name: "Armada", role: "inventory analytics, supply optimization, and distribution support" },
    { id: "googl", ticker: "GOOGL", name: "Google Cloud", role: "restaurant digital platform and core technology infrastructure" },
    { id: "kiosk", ticker: "KIOSK", name: "Kiosk OEMs", role: "self-service ordering hardware in restaurants" },
    { id: "equip", ticker: "EQUIP", name: "Kitchen Equipment Manufacturers", role: "POS, fryer, and restaurant kitchen equipment suppliers" },

    // CENTER
    { id: "mcd", ticker: "MCD", name: "McDonald's", role: "global QSR operator, franchisor, supplier manager, and restaurant standards platform" },

    // LAYER 5 — DOWNSTREAM CHANNELS / CUSTOMERS
    { id: "fran", ticker: "FRAN", name: "Franchisees", role: "primary economic customer base paying royalties and rent to McDonald's" },
    { id: "retail", ticker: "RETAIL", name: "Retail Consumers", role: "dine-in, drive-thru, and carryout end customers" },
    { id: "app", ticker: "APP", name: "Digital App Customers", role: "mobile ordering, loyalty, and personalized digital offer users" },
    { id: "uber", ticker: "UBER", name: "Uber Eats", role: "third-party delivery channel" },
    { id: "dash", ticker: "DASH", name: "DoorDash", role: "third-party delivery channel" },
    { id: "mccafe", ticker: "MCCAFE", name: "McCafé Customers", role: "coffee and beverage-focused customer segment" }
  ],

  edges: [
    // LAYER 1 → LAYER 2
    { source: "beef", target: "lopez" },
    { source: "beef", target: "osi" },
    { source: "chicken", target: "tyson" },
    { source: "chicken", target: "cargill" },
    { source: "potato", target: "lw" },
    { source: "produce", target: "freshex" },
    { source: "dairy", target: "dfa" },
    { source: "fish", target: "pkg" },
    { source: "coffee", target: "gavina" },

    // LAYER 2 → LAYER 3
    { source: "lopez", target: "mbi" },
    { source: "osi", target: "armada" },
    { source: "tyson", target: "mbi" },
    { source: "cargill", target: "armada" },
    { source: "lw", target: "mbi" },
    { source: "bakery", target: "mbi" },
    { source: "freshex", target: "armada" },
    { source: "dfa", target: "mbi" },
    { source: "gavina", target: "armada" },
    { source: "ko", target: "mbi" },
    { source: "pkg", target: "armada" },

    { source: "mbi", target: "googl" },
    { source: "armada", target: "kiosk" },
    { source: "armada", target: "equip" },

    // LAYER 3 → MCDONALD'S
    { source: "googl", target: "mcd" },
    { source: "kiosk", target: "mcd" },
    { source: "equip", target: "mcd" },
    { source: "mbi", target: "mcd" },
    { source: "armada", target: "mcd" },

    // MCDONALD'S → DOWNSTREAM
    { source: "mcd", target: "fran" },
    { source: "mcd", target: "retail" },
    { source: "mcd", target: "app" },
    { source: "mcd", target: "uber" },
    { source: "mcd", target: "dash" },
    { source: "mcd", target: "mccafe" }
  ]
},
VZ: {
  name: "Verizon",
  root: "vz",
  nodes: [
    // LAYER 1 — CORE INPUTS / SPECTRUM / FOUNDATIONAL REQUIREMENTS
    { id: "fcc", ticker: "FCC", name: "FCC", role: "spectrum licensing authority; critical upstream source of low-band, mid-band, and mmWave spectrum" },
    { id: "grid", ticker: "GRID", name: "Grid Utilities", role: "electric power for wireless network, fiber systems, and facilities" },
    { id: "renew", ticker: "RENEW", name: "Renewable Energy PPAs", role: "long-term solar and wind power agreements supporting network operations" },

    // LAYER 2 — NETWORK EQUIPMENT / PHYSICAL INFRASTRUCTURE
    { id: "eric", ticker: "ERIC", name: "Ericsson", role: "primary RAN vendor for low-band, mid-band, mmWave, Cloud RAN, and Massive MIMO" },
    { id: "ssnl", ticker: "SSNLF", name: "Samsung", role: "major RAN vendor and O-RAN radio deployment partner" },
    { id: "nok", ticker: "NOK", name: "Nokia", role: "private 5G and CBRS network equipment supplier" },
    { id: "qcom", ticker: "QCOM", name: "Qualcomm", role: "chipsets powering RAN hardware and wireless systems" },
    { id: "cci", ticker: "CCI", name: "Crown Castle", role: "macro towers, small cells, and fiber infrastructure partner" },
    { id: "sbac", ticker: "SBAC", name: "SBA Communications", role: "tower lease and deployment partner" },
    { id: "amt", ticker: "AMT", name: "American Tower", role: "macro tower hosting partner" },
    { id: "glw", ticker: "GLW", name: "Corning", role: "fiber optic cable supplier" },
    { id: "fybr", ticker: "FYBR", name: "Frontier Communications", role: "fiber footprint expansion adding 30M+ homes and businesses" },

    // LAYER 3 — CLOUD / SOFTWARE / IT / ENTERPRISE SYSTEMS
    { id: "amzn", ticker: "AMZN", name: "Amazon", role: "AWS preferred public cloud provider for business-critical applications" },
    { id: "msft", ticker: "MSFT", name: "Microsoft", role: "Azure enterprise cloud integrations and SD-WAN partnerships" },
    { id: "csco", ticker: "CSCO", name: "Cisco", role: "routing, switching, and enterprise networking systems" },
    { id: "orcl", ticker: "ORCL", name: "Oracle", role: "database and enterprise infrastructure software" },
    { id: "sap", ticker: "SAP", name: "SAP", role: "enterprise software and back-office systems" },
    { id: "crm", ticker: "CRM", name: "Salesforce", role: "enterprise SaaS and customer-facing workflow systems" },
    { id: "ibm", ticker: "IBM", name: "IBM", role: "historical managed services and enterprise infrastructure relationship" },

    // CENTER
    { id: "vz", ticker: "VZ", name: "Verizon", role: "wireless operator, fiber provider, device retailer, and enterprise connectivity platform" },

    // LAYER 5 — DOWNSTREAM CONSUMER / DEVICE / RETAIL CHANNELS
    { id: "aapl", ticker: "AAPL", name: "Apple", role: "largest smartphone ecosystem driving Verizon postpaid upgrades and subscriber activity" },
    { id: "goog", ticker: "GOOGL", name: "Google", role: "Pixel device ecosystem and consumer handset demand channel" },

    // LAYER 5 — DOWNSTREAM BUSINESS / WHOLESALE / VERTICAL DEMAND
    { id: "fdx", ticker: "FDX", name: "FedEx", role: "enterprise logistics / IoT / fleet connectivity demand proxy" },
    { id: "fndl", ticker: "FLUT", name: "FanDuel / Flutter", role: "media, sports betting, and live-event 5G / analytics demand partner" },
    { id: "gov", ticker: "GOV", name: "Government Contracts", role: "federal, state, and local public-sector connectivity customer base" },
    { id: "mvno", ticker: "MVNO", name: "MVNO / Wholesale Partners", role: "resellers, roaming partners, and carrier interconnect customers" }
  ],

  edges: [
    // LAYER 1 → LAYER 2
    { source: "fcc", target: "eric" },
    { source: "fcc", target: "ssnl" },
    { source: "fcc", target: "nok" },
    { source: "grid", target: "cci" },
    { source: "renew", target: "amt" },

    { source: "eric", target: "qcom" },
    { source: "ssnl", target: "qcom" },
    { source: "nok", target: "qcom" },

    { source: "qcom", target: "cci" },
    { source: "cci", target: "glw" },
    { source: "sbac", target: "glw" },
    { source: "amt", target: "fybr" },

    // LAYER 2 → LAYER 3
    { source: "glw", target: "amzn" },
    { source: "fybr", target: "msft" },
    { source: "cci", target: "csco" },
    { source: "sbac", target: "orcl" },
    { source: "amt", target: "sap" },

    { source: "amzn", target: "crm" },
    { source: "msft", target: "ibm" },

    // LAYER 3 → VERIZON
    { source: "amzn", target: "vz" },
    { source: "msft", target: "vz" },
    { source: "csco", target: "vz" },
    { source: "orcl", target: "vz" },
    { source: "sap", target: "vz" },
    { source: "crm", target: "vz" },
    { source: "ibm", target: "vz" },

    // VERIZON → DOWNSTREAM
    { source: "vz", target: "aapl" },
    { source: "vz", target: "goog" },
    { source: "vz", target: "fdx" },
    { source: "vz", target: "fndl" },
    { source: "vz", target: "gov" },
    { source: "vz", target: "mvno" }
  ]
},
AXP: {
  name: "American Express",
  root: "axp",
  nodes: [
    // LAYER 1 — CORE INFRASTRUCTURE / CLOUD
    { id: "amzn", ticker: "AMZN", name: "Amazon", role: "AWS cloud infrastructure, data processing, and transaction scalability" },
    { id: "msft", ticker: "MSFT", name: "Microsoft", role: "enterprise software, security, and data infrastructure" },

    // LAYER 2 — PAYMENT NETWORK / PROCESSING RAILS
    { id: "fis", ticker: "FIS", name: "FIS", role: "core payment processing technology and financial infrastructure" },
    { id: "fi", ticker: "FI", name: "Fiserv", role: "merchant acquiring systems and payment processing infrastructure" },
    { id: "gpn", ticker: "GPN", name: "Global Payments", role: "merchant acquiring and transaction processing services" },

    // LAYER 3 — MERCHANT ACCEPTANCE NETWORK (CRITICAL LAYER)
    { id: "sq", ticker: "SQ", name: "Block (Square)", role: "SMB merchant acceptance and point-of-sale ecosystem" },
    { id: "pypl", ticker: "PYPL", name: "PayPal", role: "digital wallet and online merchant acceptance layer" },
    { id: "shop", ticker: "SHOP", name: "Shopify", role: "e-commerce merchant platform enabling card acceptance" },

    // CENTER
    { id: "axp", ticker: "AXP", name: "American Express", role: "closed-loop payments network, credit issuance, and premium card ecosystem" },

    // LAYER 5 — CARDHOLDER SPEND / DEMAND DRIVERS
    { id: "dal", ticker: "DAL", name: "Delta Air Lines", role: "co-branded card partner and major spend category (travel)" },
    { id: "mar", ticker: "MAR", name: "Marriott", role: "co-branded card partner and travel/hospitality spend driver" },
    { id: "hil", ticker: "HLT", name: "Hilton", role: "co-branded card partner and lodging spend driver" },
    { id: "amzn_c", ticker: "AMZN", name: "Amazon (Merchant)", role: "major online spend destination for cardholders" }
  ],

  edges: [
    // LAYER 1 → LAYER 2
    { source: "amzn", target: "fis" },
    { source: "msft", target: "fi" },

    // LAYER 2 → LAYER 3
    { source: "fis", target: "sq" },
    { source: "fi", target: "pypl" },
    { source: "gpn", target: "shop" },

    // LAYER 3 → AMEX
    { source: "sq", target: "axp" },
    { source: "pypl", target: "axp" },
    { source: "shop", target: "axp" },

    // ALSO CORE INFRA → AMEX (DIRECT DEPENDENCY)
    { source: "amzn", target: "axp" },
    { source: "msft", target: "axp" },

    // AMEX → SPEND / DEMAND
    { source: "axp", target: "dal" },
    { source: "axp", target: "mar" },
    { source: "axp", target: "hil" },
    { source: "axp", target: "amzn_c" }
  ]
},
AMGN: {
  name: "Amgen",
  root: "amgn",
  nodes: [
    // LAYER 1 — AI / CLOUD / COMPUTE
    { id: "amzn", ticker: "AMZN", name: "Amazon", role: "AWS cloud, AI/ML (SageMaker, Bedrock), and digital manufacturing infrastructure" },
    { id: "msft", ticker: "MSFT", name: "Microsoft", role: "Copilot AI deployment across enterprise operations and R&D workflows" },
    { id: "nvda", ticker: "NVDA", name: "NVIDIA", role: "AI supercomputing (BioNeMo, DGX systems) for drug discovery and genomics" },

    // LAYER 2 — DRUG DEVELOPMENT / DATA / COLLABORATION
    { id: "azn", ticker: "AZN", name: "AstraZeneca", role: "co-development and commercialization partner (Tezspire and pipeline biologics)" },

    // LAYER 3 — MANUFACTURING / LAB INPUTS
    { id: "tmo", ticker: "TMO", name: "Thermo Fisher", role: "contract manufacturing (Patheon), lab equipment, reagents, and consumables" },

    // CENTER
    { id: "amgn", ticker: "AMGN", name: "Amgen", role: "biologics drug development, manufacturing, and commercialization" },

    // LAYER 5 — WHOLESALE DISTRIBUTION (CRITICAL CHOKEPOINT)
    { id: "mck", ticker: "MCK", name: "McKesson", role: "largest US pharmaceutical distributor (>10% of Amgen revenue)" },
    { id: "cor", ticker: "COR", name: "Cencora", role: "specialty drug distributor (>10% of Amgen revenue)" },
    { id: "cah", ticker: "CAH", name: "Cardinal Health", role: "hospital and pharmacy distributor (>10% of Amgen revenue)" },

    // LAYER 6 — FORMULARY / ACCESS CONTROL (PBMs)
    { id: "cvs", ticker: "CVS", name: "CVS Health", role: "PBM (Caremark) + specialty pharmacy controlling drug access and pricing tiers" },
    { id: "ci", ticker: "CI", name: "Cigna", role: "PBM (Express Scripts) controlling coverage and reimbursement decisions" },
    { id: "unh", ticker: "UNH", name: "UnitedHealth", role: "PBM (OptumRx) + specialty pharmacy controlling patient access" },

    // LAYER 7 — FINAL DISPENSING
    { id: "wba", ticker: "WBA", name: "Walgreens", role: "specialty pharmacy dispensing biologics to patients" }
  ],

  edges: [
    // LAYER 1 → LAYER 2
    { source: "amzn", target: "azn" },
    { source: "msft", target: "azn" },
    { source: "nvda", target: "azn" },

    // LAYER 2 → LAYER 3
    { source: "azn", target: "tmo" },

    // LAYER 3 → AMGEN
    { source: "tmo", target: "amgn" },

    // ALSO DIRECT CORE TECH → AMGEN
    { source: "amzn", target: "amgn" },
    { source: "msft", target: "amgn" },
    { source: "nvda", target: "amgn" },

    // AMGEN → WHOLESALERS (MOST IMPORTANT STEP)
    { source: "amgn", target: "mck" },
    { source: "amgn", target: "cor" },
    { source: "amgn", target: "cah" },

    // WHOLESALERS → PBMs
    { source: "mck", target: "cvs" },
    { source: "cor", target: "ci" },
    { source: "cah", target: "unh" },

    // PBMs → PHARMACY
    { source: "cvs", target: "wba" },
    { source: "ci", target: "wba" },
    { source: "unh", target: "wba" }
  ]
},
CRM: {
  name: "Salesforce",
  root: "crm",
  nodes: [
    // LAYER 1 — CORE CLOUD INFRASTRUCTURE
    { id: "amzn", ticker: "AMZN", name: "Amazon", role: "primary AWS infrastructure for Hyperforce compute, storage, AI, and hosting" },
    { id: "msft", ticker: "MSFT", name: "Microsoft", role: "Azure infrastructure and zero-copy data integration support" },
    { id: "googl", ticker: "GOOGL", name: "Alphabet", role: "Google Cloud infrastructure and BigQuery zero-copy data integration" },

    // LAYER 2 — AI / DATA / ENTERPRISE PLATFORM INPUTS
    { id: "nvda", ticker: "NVDA", name: "NVIDIA", role: "AI hardware and enterprise AI stack for Agentforce and model workloads" },
    { id: "snow", ticker: "SNOW", name: "Snowflake", role: "zero-copy data cloud integration with Salesforce Data Cloud" },
    { id: "wday", ticker: "WDAY", name: "Workday", role: "enterprise data foundation and AI employee service integration partner" },

    // LAYER 3 — IMPLEMENTATION / DEPLOYMENT CHANNEL
    { id: "acn", ticker: "ACN", name: "Accenture", role: "largest Salesforce implementation and consulting partner" },
    { id: "ibm", ticker: "IBM", name: "IBM", role: "Salesforce consulting, deployment, and enterprise integration partner" },
    { id: "ctsh", ticker: "CTSH", name: "Cognizant", role: "Salesforce implementation and integration services" },
    { id: "infy", ticker: "INFY", name: "Infosys", role: "global Salesforce consulting and deployment partner" },
    { id: "wit", ticker: "WIT", name: "Wipro", role: "Salesforce consulting and transformation partner" },

    // CENTER
    { id: "crm", ticker: "CRM", name: "Salesforce", role: "CRM platform, Data Cloud, Slack, Tableau, MuleSoft, and Agentforce" },

    // LAYER 5 — DOWNSTREAM CUSTOMERS
    { id: "amzn_c", ticker: "AMZN", name: "Amazon (Customer)", role: "enterprise customer using Salesforce across multiple business units" },
    { id: "t", ticker: "T", name: "AT&T", role: "enterprise telecom customer using Salesforce data and CRM tools" },
    { id: "wmt", ticker: "WMT", name: "Walmart", role: "large enterprise customer and major Salesforce client" },
    { id: "dis", ticker: "DIS", name: "Disney", role: "enterprise customer with lower-confidence public confirmation" }
  ],

  edges: [
    // LAYER 1 → LAYER 2
    { source: "amzn", target: "nvda" },
    { source: "msft", target: "snow" },
    { source: "googl", target: "wday" },

    // LAYER 2 → LAYER 3
    { source: "nvda", target: "acn" },
    { source: "snow", target: "ibm" },
    { source: "wday", target: "ctsh" },
    { source: "snow", target: "infy" },
    { source: "nvda", target: "wit" },

    // LAYER 3 → SALESFORCE
    { source: "acn", target: "crm" },
    { source: "ibm", target: "crm" },
    { source: "ctsh", target: "crm" },
    { source: "infy", target: "crm" },
    { source: "wit", target: "crm" },

    // SALESFORCE → DOWNSTREAM
    { source: "crm", target: "amzn_c" },
    { source: "crm", target: "t" },
    { source: "crm", target: "wmt" },
    { source: "crm", target: "dis" }
  ]
},
DIS: {
  name: "Disney",
  root: "dis",
  nodes: [
    // LAYER 1 — CORE INFRASTRUCTURE
    { id: "amzn", ticker: "AMZN", name: "Amazon", role: "AWS cloud infrastructure, storage, analytics, and streaming backbone" },
    { id: "googl", ticker: "GOOGL", name: "Alphabet", role: "Google Cloud advertising data clean room and activation infrastructure" },
    { id: "hpe", ticker: "HPE", name: "Hewlett Packard Enterprise", role: "private cloud and hybrid infrastructure for internal enterprise workloads" },

    // LAYER 2 — ENTERPRISE / PRODUCTION SYSTEMS
    { id: "msft", ticker: "MSFT", name: "Microsoft", role: "Azure media workflows, collaborative editing, archiving, and enterprise software" },
    { id: "ibm", ticker: "IBM", name: "IBM", role: "enterprise IT infrastructure management and outsourcing services" },
    { id: "adsk", ticker: "ADSK", name: "Autodesk", role: "design, animation, VFX, and imagineering software" },
    { id: "dlb", ticker: "DLB", name: "Dolby Laboratories", role: "audio mastering, Dolby Atmos, and studio sound technology" },

    // LAYER 3 — DIRECT BUSINESS INPUTS
    { id: "mat", ticker: "MAT", name: "Mattel", role: "Disney Princess and Toy Story toy licensing / product creation partner" },
    { id: "has", ticker: "HAS", name: "Hasbro", role: "Star Wars and Marvel toy, collectible, and game licensing partner" },
    { id: "tko", ticker: "TKO", name: "TKO Group", role: "WWE and UFC rights/content input for ESPN distribution" },

    // CENTER
    { id: "dis", ticker: "DIS", name: "Disney", role: "entertainment, ESPN, streaming, parks, cruises, and consumer products" },

    // LAYER 5 — DOWNSTREAM MEDIA / PLATFORM DISTRIBUTION
    { id: "chtr", ticker: "CHTR", name: "Charter Communications", role: "Spectrum carriage and Disney network distribution partner" },
    { id: "cmcsa", ticker: "CMCSA", name: "Comcast", role: "Xfinity carriage and Hulu distribution partner" },
    { id: "aapl", ticker: "AAPL", name: "Apple", role: "Apple TV and device ecosystem distribution for Disney+, Hulu, and ESPN+" },
    { id: "roku", ticker: "ROKU", name: "Roku", role: "streaming platform distribution for Disney+, Hulu, and ESPN+" },

    // LAYER 5 — DOWNSTREAM CONSUMER / EXPERIENCE CHANNELS
    { id: "wmt", ticker: "WMT", name: "Walmart", role: "major retail channel for Disney-licensed merchandise" },
    { id: "bkng", ticker: "BKNG", name: "Booking Holdings", role: "indirect booking channel for Disney resorts and vacations" }
  ],

  edges: [
    // LAYER 1 → LAYER 2
    { source: "amzn", target: "msft" },
    { source: "googl", target: "msft" },
    { source: "hpe", target: "ibm" },

    { source: "msft", target: "adsk" },
    { source: "ibm", target: "dlb" },

    // LAYER 2 → LAYER 3
    { source: "adsk", target: "mat" },
    { source: "adsk", target: "has" },
    { source: "dlb", target: "tko" },

    // LAYER 3 → DISNEY
    { source: "mat", target: "dis" },
    { source: "has", target: "dis" },
    { source: "tko", target: "dis" },

    // ALSO IMPORTANT DIRECT INFRA / SYSTEM INPUTS → DISNEY
    { source: "amzn", target: "dis" },
    { source: "googl", target: "dis" },
    { source: "msft", target: "dis" },
    { source: "ibm", target: "dis" },

    // DISNEY → DOWNSTREAM
    { source: "dis", target: "chtr" },
    { source: "dis", target: "cmcsa" },
    { source: "dis", target: "aapl" },
    { source: "dis", target: "roku" },
    { source: "dis", target: "wmt" },
    { source: "dis", target: "bkng" }
  ]
},
BA: {
  name: "Boeing",
  root: "ba",
  nodes: [
    // UPSTREAM — METALS & MATERIALS
    { id: "ati", ticker: "ATI", name: "ATI", role: "titanium alloys and superalloys" },
    { id: "crs", ticker: "CRS", name: "Carpenter Technology", role: "specialty alloys" },
    { id: "hwm", ticker: "HWM", name: "Howmet Aerospace", role: "castings and forgings" },
    { id: "fcx", ticker: "FCX", name: "Freeport-McMoRan", role: "copper for wiring systems" },

    // UPSTREAM — ENGINES & PROPULSION
    { id: "ge", ticker: "GE", name: "GE Aerospace", role: "jet engines (LEAP, GE90, GEnx)" },
    { id: "rtx", ticker: "RTX", name: "RTX Corporation", role: "Pratt & Whitney engines + avionics" },

    // UPSTREAM — AVIONICS & ELECTRONICS
    { id: "hon", ticker: "HON", name: "Honeywell", role: "APUs, avionics, flight systems" },
    { id: "txx", ticker: "TXN", name: "Texas Instruments", role: "semiconductors and control systems" },
    { id: "aph", ticker: "APH", name: "Amphenol", role: "connectors and interconnect systems" },

    // UPSTREAM — STRUCTURES & COMPONENTS
    { id: "tdg", ticker: "TDG", name: "TransDigm", role: "engineered aerospace components" },
    { id: "ph", ticker: "PH", name: "Parker Hannifin", role: "hydraulics, fuel systems" },
    { id: "wwd", ticker: "WWD", name: "Woodward", role: "fuel and combustion systems" },

    // UPSTREAM — COMPOSITES & MATERIALS
    { id: "hxl", ticker: "HXL", name: "Hexcel", role: "carbon fiber composites" },
    { id: "ppg", ticker: "PPG", name: "PPG Industries", role: "coatings, sealants, transparencies" },

    // UPSTREAM — IT SYSTEMS
    { id: "msft", ticker: "MSFT", name: "Microsoft", role: "Azure cloud and digital twin tech" },
    { id: "orcl", ticker: "ORCL", name: "Oracle", role: "ERP and supply chain systems" },

    // CENTER
    { id: "ba", ticker: "BA", name: "Boeing", role: "commercial aircraft, defense, and services" },

    // DOWNSTREAM — FINAL 6 (CLEAN)
    { id: "ual", ticker: "UAL", name: "United Airlines", role: "largest historical Boeing customer" },
    { id: "aal", ticker: "AAL", name: "American Airlines", role: "large Boeing fleet operator" },
    { id: "luv", ticker: "LUV", name: "Southwest Airlines", role: "largest 737 operator" },
    { id: "fdx", ticker: "FDX", name: "FedEx", role: "cargo aircraft operator (767, 777F)" },
    { id: "ups", ticker: "UPS", name: "UPS", role: "cargo aircraft operator (747, 767)" },
    { id: "lhx", ticker: "LHX", name: "L3Harris", role: "defense systems integrator" }
  ],

  edges: [
    // METALS → STRUCTURES
    { source: "ati", target: "tdg" },
    { source: "crs", target: "ph" },
    { source: "hwm", target: "tdg" },
    { source: "fcx", target: "aph" },

    // ENGINES → STRUCTURES
    { source: "ge", target: "tdg" },
    { source: "rtx", target: "ph" },

    // ELECTRONICS → SYSTEMS
    { source: "hon", target: "txx" },
    { source: "txx", target: "aph" },

    // STRUCTURES → COMPOSITES
    { source: "tdg", target: "hxl" },
    { source: "ph", target: "ppg" },
    { source: "wwd", target: "hxl" },

    // COMPOSITES → IT
    { source: "hxl", target: "msft" },
    { source: "ppg", target: "orcl" },

    // IT → BOEING
    { source: "msft", target: "ba" },
    { source: "orcl", target: "ba" },

    // BOEING → CUSTOMERS (FINAL 6)
    { source: "ba", target: "ual" },
    { source: "ba", target: "aal" },
    { source: "ba", target: "luv" },
    { source: "ba", target: "fdx" },
    { source: "ba", target: "ups" },
    { source: "ba", target: "lhx" }
  ]
},
HON: {
  name: "Honeywell",
  root: "hon",
  nodes: [
    // UPSTREAM — SPECIALTY METALS & ALLOYS
    { id: "ati", ticker: "ATI", name: "ATI Inc.", role: "titanium alloys and superalloys" },
    { id: "crs", ticker: "CRS", name: "Carpenter Technology", role: "specialty alloys and metals" },
    { id: "hwm", ticker: "HWM", name: "Howmet Aerospace", role: "aerospace castings and forgings" },
    { id: "nue_up", ticker: "NUE", name: "Nucor", role: "structural steel and industrial metals" },

    // UPSTREAM — CHEMICALS & MATERIALS
    { id: "dow", ticker: "DOW", name: "Dow", role: "polymers and chemical precursors" },
    { id: "dd", ticker: "DD", name: "DuPont", role: "fluoropolymers and specialty chemicals" },
    { id: "lin", ticker: "LIN", name: "Linde", role: "industrial and specialty gases" },
    { id: "apd", ticker: "APD", name: "Air Products", role: "hydrogen and industrial gases" },

    // UPSTREAM — ELECTRONICS
    { id: "txn", ticker: "TXN", name: "Texas Instruments", role: "analog semiconductors and sensors" },
    { id: "adi", ticker: "ADI", name: "Analog Devices", role: "precision sensors and signal processing" },
    { id: "aph", ticker: "APH", name: "Amphenol", role: "connectors and interconnect systems" },

    // UPSTREAM — IT & CLOUD
    { id: "msft", ticker: "MSFT", name: "Microsoft", role: "Azure cloud and Honeywell Forge platform" },
    { id: "orcl", ticker: "ORCL", name: "Oracle", role: "ERP and enterprise systems" },

    // CENTER
    { id: "hon", ticker: "HON", name: "Honeywell", role: "aerospace, automation, and industrial systems" },

    // DOWNSTREAM — AEROSPACE
    { id: "ba", ticker: "BA", name: "Boeing", role: "avionics, APU, propulsion systems" },
    { id: "rtx", ticker: "RTX", name: "RTX Corporation", role: "aerospace systems and components" },

    // DOWNSTREAM — BUILDING SYSTEMS
    { id: "cbre", ticker: "CBRE", name: "CBRE Group", role: "building automation and controls" },
    { id: "carr", ticker: "CARR", name: "Carrier", role: "HVAC and building systems" },

    // DOWNSTREAM — INDUSTRIAL / ENERGY
    { id: "cvx", ticker: "CVX", name: "Chevron", role: "refining and process automation" },
    { id: "xom", ticker: "XOM", name: "ExxonMobil", role: "process technology (UOP)" },
  ],

  edges: [
    // METALS → ELECTRONICS / SYSTEMS
    { source: "ati", target: "txn" },
    { source: "crs", target: "adi" },
    { source: "hwm", target: "aph" },
    { source: "nue_up", target: "aph" },

    // CHEMICALS → ELECTRONICS / SYSTEMS
    { source: "dow", target: "txn" },
    { source: "dd", target: "adi" },
    { source: "lin", target: "aph" },
    { source: "apd", target: "aph" },

    // ELECTRONICS → IT
    { source: "txn", target: "msft" },
    { source: "adi", target: "orcl" },
    { source: "aph", target: "msft" },

    // IT → HONEYWELL
    { source: "msft", target: "hon" },
    { source: "orcl", target: "hon" },

    // HONEYWELL → DOWNSTREAM (CLEAN 6)
{ source: "hon", target: "ba" },
{ source: "hon", target: "rtx" },
{ source: "hon", target: "xom" },
{ source: "hon", target: "cvx" },
{ source: "hon", target: "cbre" },
{ source: "hon", target: "carr" }
  ]
},
NKE: {
  name: "Nike",
  root: "nke",
  nodes: [
    // LAYER 1 — RAW MATERIAL CHEMICALS / INPUTS
    { id: "dow", ticker: "DOW", name: "Dow", role: "chemical inputs for synthetics and foams" },
    { id: "hun", ticker: "HUN", name: "Huntsman", role: "polyurethane systems for midsoles" },
    { id: "basf", ticker: "BASFY", name: "BASF", role: "TPU and performance foams" },

    // LAYER 2 — TEXTILES / MATERIAL PROCESSING
    { id: "toray", ticker: "TORAY", name: "Toray Industries", role: "performance fabrics and fibers" },
    { id: "fenc", ticker: "FENC", name: "Far Eastern New Century", role: "polyester and recycled fabrics" },
    { id: "avy", ticker: "AVY", name: "Avery Dennison", role: "labels, branding, and trims" },

    // LAYER 3 — SPECIALIZED COMPONENTS (UPPERS / FOAM / LEATHER)
    { id: "kuraray", ticker: "KURARAY", name: "Kuraray", role: "synthetic leather and materials" },
    { id: "wwe", ticker: "WWE", name: "Wolverine Worldwide", role: "leather supplier" },

    // LAYER 4 — CONTRACT MANUFACTURING (CRITICAL LAYER)
    { id: "pou", ticker: "POUCHEN", name: "Pou Chen (Yue Yuen)", role: "largest footwear manufacturer" },
    { id: "tae", ticker: "TKG", name: "Tae Kwang", role: "major Nike footwear producer" },
    { id: "shenzhou", ticker: "SHEN", name: "Shenzhou International", role: "apparel manufacturing" },

    // LAYER 5 — LOGISTICS / GLOBAL DISTRIBUTION
    { id: "ups", ticker: "UPS", name: "UPS", role: "global shipping and distribution" },
    { id: "fdx", ticker: "FDX", name: "FedEx", role: "air logistics and delivery" },
    { id: "maersk", ticker: "AMKBY", name: "Maersk", role: "ocean freight and global shipping" },

    // CENTER
    { id: "nke", ticker: "NKE", name: "Nike", role: "design, brand, sourcing, and global distribution network" },

    // LAYER 6 — RETAIL / DISTRIBUTION CHANNELS
    { id: "fl", ticker: "FL", name: "Foot Locker", role: "footwear retail partner" },
    { id: "dks", ticker: "DKS", name: "Dick’s Sporting Goods", role: "sporting goods retailer" },
    { id: "jd", ticker: "JD", name: "JD Sports", role: "global retail partner" },

    { id: "nike_direct", ticker: "DIRECT", name: "Nike Direct", role: "Nike.com, SNKRS, owned retail stores" },

    // FINAL 6 — DEMAND
    { id: "consumer", ticker: "CONS", name: "Consumers", role: "global demand for footwear and apparel" },
    { id: "athletes", ticker: "ATH", name: "Athletes", role: "performance-driven demand and brand influence" },
    { id: "genz", ticker: "GENZ", name: "Gen Z Consumers", role: "trend-driven demand and sneakers culture" },
    { id: "wmt", ticker: "WMT", name: "Walmart", role: "limited distribution and price competition" },
    { id: "tgt", ticker: "TGT", name: "Target", role: "mass retail competition" },
    { id: "amzn", ticker: "AMZN", name: "Amazon", role: "third-party resale and competition channel" }
  ],

  edges: [
    // LAYER 1 → LAYER 2
    { source: "dow", target: "toray" },
    { source: "hun", target: "fenc" },
    { source: "basf", target: "avy" },

    // LAYER 2 → LAYER 3
    { source: "toray", target: "kuraray" },
    { source: "fenc", target: "wwe" },
    { source: "avy", target: "kuraray" },

    // LAYER 3 → LAYER 4
    { source: "kuraray", target: "pou" },
    { source: "wwe", target: "tae" },

    // LAYER 4 → LAYER 5
    { source: "pou", target: "ups" },
    { source: "tae", target: "fdx" },
    { source: "shenzhou", target: "maersk" },

    // LAYER 5 → NIKE
    { source: "ups", target: "nke" },
    { source: "fdx", target: "nke" },
    { source: "maersk", target: "nke" },

    // ALSO DIRECT FACTORY DEPENDENCY
    { source: "pou", target: "nke" },
    { source: "tae", target: "nke" },

    // NIKE → RETAIL CHANNELS
    { source: "nke", target: "fl" },
    { source: "nke", target: "dks" },
    { source: "nke", target: "jd" },
    { source: "nke", target: "nike_direct" },

    // RETAIL → FINAL 6
    { source: "fl", target: "consumer" },
    { source: "dks", target: "athletes" },
    { source: "jd", target: "genz" },
    { source: "nike_direct", target: "consumer" },

    { source: "nike_direct", target: "genz" },

    { source: "fl", target: "wmt" },
    { source: "dks", target: "tgt" },
    { source: "jd", target: "amzn" }
  ]
},
SHW: {
  name: "Sherwin-Williams",
  root: "shw",
  nodes: [
    // UPSTREAM — TiO2 (CRITICAL INPUT)
    { id: "cc", ticker: "CC", name: "Chemours", role: "titanium dioxide pigment (TiO2)" },
    { id: "trox", ticker: "TROX", name: "Tronox", role: "titanium dioxide pigment supplier" },
    { id: "kro", ticker: "KRO", name: "Kronos Worldwide", role: "titanium dioxide pigment supplier" },

    // UPSTREAM — PETROCHEMICALS
    { id: "dow", ticker: "DOW", name: "Dow", role: "acrylic resins, latex, solvents" },
    { id: "lyb", ticker: "LYB", name: "LyondellBasell", role: "propylene & ethylene derivatives" },
    { id: "emn", ticker: "EMN", name: "Eastman Chemical", role: "specialty solvents" },
    { id: "ce", ticker: "CE", name: "Celanese", role: "vinyl acetate, EVA resins" },

    // UPSTREAM — INDUSTRIAL INPUTS
    { id: "lin", ticker: "LIN", name: "Linde", role: "industrial gases" },
    { id: "apd", ticker: "APD", name: "Air Products", role: "specialty gases" },

    // UPSTREAM — PACKAGING
    { id: "cck", ticker: "CCK", name: "Crown Holdings", role: "metal paint cans" },
    { id: "ball", ticker: "BALL", name: "Ball Corporation", role: "metal aerosol packaging" },
    { id: "bery", ticker: "BERY", name: "Berry Global", role: "plastic containers" },

    // CENTER
    { id: "shw", ticker: "SHW", name: "Sherwin-Williams", role: "paints, coatings, and materials" },

    // DOWNSTREAM — CORE 6 (CLEANED)
    { id: "dhi", ticker: "DHI", name: "D.R. Horton", role: "homebuilder demand driver" },
    { id: "len", ticker: "LEN", name: "Lennar", role: "residential construction demand" },
    { id: "low", ticker: "LOW", name: "Lowe's", role: "exclusive national retail partner" },
    { id: "ba", ticker: "BA", name: "Boeing", role: "aerospace coatings" },
    { id: "gm", ticker: "GM", name: "General Motors", role: "automotive finishes" },
    { id: "cat", ticker: "CAT", name: "Caterpillar", role: "industrial coatings" }
  ],

  edges: [
    // TiO2 → PETROCHEMICALS (PIGMENT FEEDS FORMULATION)
    { source: "cc", target: "dow" },
    { source: "trox", target: "lyb" },
    { source: "kro", target: "emn" },

    // PETROCHEMICALS → PACKAGING
    { source: "dow", target: "cck" },
    { source: "lyb", target: "ball" },
    { source: "emn", target: "bery" },
    { source: "ce", target: "bery" },

    // INDUSTRIAL INPUTS → PACKAGING / SYSTEM
    { source: "lin", target: "cck" },
    { source: "apd", target: "ball" },

    // PACKAGING → SHW
    { source: "cck", target: "shw" },
    { source: "ball", target: "shw" },
    { source: "bery", target: "shw" },

    // SHW → DOWNSTREAM
    { source: "shw", target: "dhi" },
    { source: "shw", target: "len" },
    { source: "shw", target: "low" },
    { source: "shw", target: "ba" },
    { source: "shw", target: "gm" },
    { source: "shw", target: "cat" }
  ]
},
MMM: {
  name: "3M",
  root: "mmm",
  nodes: [
    // UPSTREAM — RAW MATERIALS & MINERALS
    { id: "fcx", ticker: "FCX", name: "Freeport-McMoRan", role: "copper, gold, and molybdenum" },
    { id: "dow", ticker: "DOW", name: "Dow Inc.", role: "silicones, specialty polymers, and solvents" },
    { id: "dd", ticker: "DD", name: "DuPont", role: "specialty fluoropolymers, films, and intermediates" },
    { id: "lyb", ticker: "LYB", name: "LyondellBasell", role: "polypropylene and polyethylene resins" },
    { id: "emn", ticker: "EMN", name: "Eastman Chemical", role: "specialty chemicals, acetate, adhesive resins" },
    { id: "lin", ticker: "LIN", name: "Linde", role: "specialty and industrial gases" },

    // UPSTREAM — PACKAGING & INDUSTRIAL COMPONENTS
    { id: "avy", ticker: "AVY", name: "Avery Dennison", role: "pressure-sensitive materials and label stock" },
    { id: "see", ticker: "SEE", name: "Sealed Air", role: "protective packaging materials" },

    // UPSTREAM — IT & CLOUD INFRASTRUCTURE
    { id: "msft", ticker: "MSFT", name: "Microsoft", role: "enterprise software and Azure cloud" },
    { id: "orcl", ticker: "ORCL", name: "Oracle", role: "ERP and supply chain systems" },
    { id: "hon_up", ticker: "HON", name: "Honeywell", role: "industrial automation and process control" },

    // CENTER
    { id: "mmm", ticker: "MMM", name: "3M", role: "specialty materials, adhesives, industrial and consumer products" },

    // DOWNSTREAM — SAFETY & INDUSTRIAL
    { id: "ba", ticker: "BA", name: "Boeing", role: "aerospace adhesives, sealants, films" },
    { id: "cat", ticker: "CAT", name: "Caterpillar", role: "abrasives, adhesives, maintenance products" },
    { id: "etn", ticker: "ETN", name: "Eaton", role: "electrical insulation and specialty materials" },

    // DOWNSTREAM — TRANSPORTATION & ELECTRONICS
    { id: "tsla", ticker: "TSLA", name: "Tesla", role: "EV adhesives and specialty materials" },
    { id: "aapl", ticker: "AAPL", name: "Apple", role: "optical films, display and electronic materials" },
    { id: "tsm", ticker: "TSM", name: "TSMC", role: "semiconductor polishing pads and abrasive materials" },
  ],
  edges: [
    // RAW MATERIALS → PACKAGING / IT
    { source: "fcx", target: "avy" },
    { source: "dow", target: "avy" },
    { source: "dd", target: "see" },
    { source: "lyb", target: "see" },
    { source: "emn", target: "msft" },
    { source: "lin", target: "hon_up" },

    // PACKAGING / INDUSTRIAL COMPONENTS → IT / INFRASTRUCTURE
    { source: "avy", target: "msft" },
    { source: "see", target: "orcl" },

    // IT / INFRASTRUCTURE → 3M
    { source: "msft", target: "mmm" },
    { source: "orcl", target: "mmm" },
    { source: "hon_up", target: "mmm" },

    // 3M → SAFETY & INDUSTRIAL
    { source: "mmm", target: "ba" },
    { source: "mmm", target: "cat" },
    { source: "mmm", target: "etn" },

    // 3M → TRANSPORTATION & ELECTRONICS
    { source: "mmm", target: "tsla" },
    { source: "mmm", target: "aapl" },
    { source: "mmm", target: "tsm" },
  ]
},
AVGO: {
  name: "Broadcom",
  root: "avgo",
  nodes: [
    // UPSTREAM — SEMICONDUCTOR EQUIPMENT (EUV)
    { id: "asml", ticker: "ASML", name: "ASML", role: "EUV lithography machines enabling advanced-node semiconductor manufacturing" },

    // UPSTREAM — EDA & DESIGN (EARLIEST)
    { id: "snps", ticker: "SNPS", name: "Synopsys", role: "EDA software and design optimization" },
    { id: "cdns", ticker: "CDNS", name: "Cadence", role: "EDA design and verification tools" },

    // UPSTREAM — IP LICENSING
    { id: "arm", ticker: "ARM", name: "Arm Holdings", role: "CPU core and interconnect IP" },

    // UPSTREAM — SEMICONDUCTOR EQUIPMENT (TSMC ECOSYSTEM)
    { id: "amat", ticker: "AMAT", name: "Applied Materials", role: "deposition, etch, CMP equipment" },
    { id: "lrcx", ticker: "LRCX", name: "Lam Research", role: "etch and deposition equipment" },
    { id: "klac", ticker: "KLAC", name: "KLA Corporation", role: "inspection and process control" },
    { id: "entg", ticker: "ENTG", name: "Entegris", role: "materials, filtration, EUV chemicals" },

    // UPSTREAM — MEMORY
    { id: "mu", ticker: "MU", name: "Micron", role: "HBM memory supplier" },

    // UPSTREAM — PACKAGING
    { id: "amkr", ticker: "AMKR", name: "Amkor", role: "OSAT packaging partner" },

    // UPSTREAM — CLOUD / IT
    { id: "msft", ticker: "MSFT", name: "Microsoft", role: "Azure cloud and enterprise software" },
    { id: "orcl", ticker: "ORCL", name: "Oracle", role: "ERP and data systems" },

    // CENTER
    { id: "avgo", ticker: "AVGO", name: "Broadcom", role: "semiconductors + enterprise software (VMware)" },

    // DOWNSTREAM — AI / CUSTOM SILICON
    { id: "googl", ticker: "GOOGL", name: "Alphabet / Google", role: "TPU chips (v6, v7)" },
    { id: "meta", ticker: "META", name: "Meta Platforms", role: "MTIA AI accelerator chips" },

    // DOWNSTREAM — NETWORKING / CONNECTIVITY
    { id: "aapl", ticker: "AAPL", name: "Apple", role: "RF, WiFi, Bluetooth chips" },
    { id: "csco", ticker: "CSCO", name: "Cisco", role: "Ethernet switching silicon" },

    // SHARED (SEMICONDUCTOR + VMWARE)
    { id: "dell", ticker: "DELL", name: "Dell", role: "VMware + server infrastructure" },
    { id: "hpe", ticker: "HPE", name: "HPE", role: "VMware + enterprise infrastructure" }
  ],

  edges: [
    // EDA → IP
    { source: "snps", target: "arm" },
    { source: "cdns", target: "arm" },

    // ASML → EQUIPMENT / ADVANCED FAB PROCESS
    { source: "asml", target: "amat" },
    { source: "asml", target: "lrcx" },
    { source: "asml", target: "klac" },
    { source: "asml", target: "entg" },

    // ALSO CRITICAL DIRECT DEPENDENCY
    { source: "asml", target: "avgo" },

    // IP → EQUIPMENT
    { source: "arm", target: "amat" },
    { source: "arm", target: "lrcx" },

    // EQUIPMENT → PACKAGING
    { source: "amat", target: "amkr" },
    { source: "lrcx", target: "amkr" },
    { source: "klac", target: "amkr" },
    { source: "entg", target: "amkr" },

    // MEMORY → PACKAGING
    { source: "mu", target: "amkr" },

    // PACKAGING → CLOUD / IT
    { source: "amkr", target: "msft" },
    { source: "amkr", target: "orcl" },

    // CLOUD / IT → BROADCOM
    { source: "msft", target: "avgo" },
    { source: "orcl", target: "avgo" },

    // BROADCOM → AI CUSTOMERS
    { source: "avgo", target: "googl" },
    { source: "avgo", target: "meta" },

    // BROADCOM → NETWORKING CUSTOMERS
    { source: "avgo", target: "aapl" },
    { source: "avgo", target: "csco" },

    // BROADCOM → SHARED ENTERPRISE CUSTOMERS
    { source: "avgo", target: "dell" },
    { source: "avgo", target: "hpe" }
  ]
},
LLY: {
  name: "Eli Lilly",
  root: "lly",
  nodes: [
    // UPSTREAM — RAW MATERIALS & SPECIALTY CHEMICALS
    { id: "lin", ticker: "LIN", name: "Linde", role: "ultra-pure gases and cryogenic storage" },
    { id: "apd", ticker: "APD", name: "Air Products", role: "specialty gases for sterile manufacturing" },
    { id: "dd", ticker: "DD", name: "DuPont", role: "specialty polymers and filtration materials" },
    { id: "dow", ticker: "DOW", name: "Dow Inc.", role: "chemical intermediates and solvents" },

    // UPSTREAM — LAB EQUIPMENT & CLINICAL RESEARCH
    { id: "tmo", ticker: "TMO", name: "Thermo Fisher", role: "clinical trials, diagnostics, manufacturing support" },

    // UPSTREAM — DRUG DELIVERY DEVICES & PACKAGING
    { id: "wst", ticker: "WST", name: "West Pharmaceutical", role: "closures, stoppers, delivery components" },
    { id: "stvn", ticker: "STVN", name: "Stevanato Group", role: "glass vials, cartridges, EZ-fill packaging" },
    { id: "bdx", ticker: "BDX", name: "Becton Dickinson", role: "syringes, pen needles, injection systems" },

    // UPSTREAM — IT & CLOUD INFRASTRUCTURE
    { id: "msft", ticker: "MSFT", name: "Microsoft", role: "Azure cloud and enterprise software" },
    { id: "orcl", ticker: "ORCL", name: "Oracle", role: "ERP and health data systems" },

    // CENTER
    { id: "lly", ticker: "LLY", name: "Eli Lilly", role: "pharmaceutical manufacturing and biologics" },

    // DOWNSTREAM — DISTRIBUTORS
    { id: "mck", ticker: "MCK", name: "McKesson", role: "primary pharmaceutical distributor" },
    { id: "cor", ticker: "COR", name: "Cencora", role: "pharmaceutical distributor (formerly AmerisourceBergen)" },
    { id: "cah", ticker: "CAH", name: "Cardinal Health", role: "pharmaceutical distributor" }
  ],

  edges: [
    // CHEMICALS → LAB / MANUFACTURING
    { source: "lin", target: "tmo" },
    { source: "apd", target: "tmo" },
    { source: "dd", target: "tmo" },
    { source: "dow", target: "tmo" },

    // LAB / MANUFACTURING → DELIVERY DEVICES
    { source: "tmo", target: "wst" },
    { source: "tmo", target: "stvn" },
    { source: "tmo", target: "bdx" },

    // DELIVERY DEVICES → IT / CLOUD
    { source: "wst", target: "msft" },
    { source: "stvn", target: "orcl" },
    { source: "bdx", target: "msft" },

    // IT / CLOUD → LILLY
    { source: "msft", target: "lly" },
    { source: "orcl", target: "lly" },

    // LILLY → DISTRIBUTORS
    { source: "lly", target: "mck" },
    { source: "lly", target: "cor" },
    { source: "lly", target: "cah" }
  ]
},
TSM: {
  name: "TSMC",
  root: "tsm",
  nodes: [
    // UPSTREAM — SEMICONDUCTOR EQUIPMENT (EUV)
    { id: "asml", ticker: "ASML", name: "ASML", role: "EUV lithography machines for advanced node fabrication" },

    // UPSTREAM — EDA & DESIGN SOFTWARE (EARLIEST STAGE)
    { id: "snps", ticker: "SNPS", name: "Synopsys", role: "EDA software / chip design tools" },
    { id: "cdns", ticker: "CDNS", name: "Cadence", role: "EDA software / chip design tools" },

    // UPSTREAM — SEMICONDUCTOR EQUIPMENT
    { id: "amat", ticker: "AMAT", name: "Applied Materials", role: "CVD, PVD, etch, CMP equipment" },
    { id: "lrcx", ticker: "LRCX", name: "Lam Research", role: "etch and deposition equipment" },
    { id: "klac", ticker: "KLAC", name: "KLA Corporation", role: "inspection and process control" },
    { id: "entg", ticker: "ENTG", name: "Entegris", role: "materials, filtration, specialty chemicals" },
    { id: "ccmp", ticker: "CCMP", name: "CMC Materials", role: "CMP slurries / wafer polishing" },

    // UPSTREAM — SPECIALTY CHEMICALS & MATERIALS
    { id: "dd", ticker: "DD", name: "DuPont", role: "photoresists and specialty chemicals" },
    { id: "lin", ticker: "LIN", name: "Linde", role: "ultra-pure gases" },
    { id: "apd", ticker: "APD", name: "Air Products", role: "specialty gases" },

    // UPSTREAM — PACKAGING & TESTING
    { id: "amkr", ticker: "AMKR", name: "Amkor Technology", role: "OSAT packaging partner" },

    // CENTER
    { id: "tsm", ticker: "TSM", name: "TSMC", role: "semiconductor foundry" },

    // DOWNSTREAM — CUSTOMERS
    { id: "aapl", ticker: "AAPL", name: "Apple", role: "largest customer (A-series, M-series chips)" },
    { id: "nvda", ticker: "NVDA", name: "NVIDIA", role: "GPU dies (Hopper, Blackwell)" },
    { id: "amd", ticker: "AMD", name: "AMD", role: "CPUs, GPUs, data center processors" },
    { id: "qcom", ticker: "QCOM", name: "Qualcomm", role: "Snapdragon chips" },
    { id: "avgo", ticker: "AVGO", name: "Broadcom", role: "networking & AI silicon" },
    { id: "intc", ticker: "INTC", name: "Intel", role: "outsourced advanced node chips" }
  ],

  edges: [
    // EDA → EQUIPMENT (DESIGN ENABLES FABRICATION)
    { source: "snps", target: "amat" },
    { source: "cdns", target: "lrcx" },

    // ASML → EQUIPMENT / ADVANCED FAB PROCESS
    { source: "asml", target: "amat" },
    { source: "asml", target: "lrcx" },
    { source: "asml", target: "klac" },

    // CHEMICALS → EQUIPMENT
    { source: "dd", target: "entg" },
    { source: "lin", target: "entg" },
    { source: "apd", target: "ccmp" },

    // EQUIPMENT → PACKAGING
    { source: "amat", target: "amkr" },
    { source: "lrcx", target: "amkr" },
    { source: "klac", target: "amkr" },
    { source: "entg", target: "amkr" },
    { source: "ccmp", target: "amkr" },

    // PACKAGING → TSMC
    { source: "amkr", target: "tsm" },

    // ALSO CRITICAL DIRECT DEPENDENCY
    { source: "asml", target: "tsm" },

    // TSMC → CUSTOMERS
    { source: "tsm", target: "aapl" },
    { source: "tsm", target: "nvda" },
    { source: "tsm", target: "amd" },
    { source: "tsm", target: "qcom" },
    { source: "tsm", target: "avgo" },
    { source: "tsm", target: "intc" }
  ]
},
TMO: {
  name: "Thermo Fisher Scientific",
  root: "tmo",
  nodes: [
    // UPSTREAM — RAW MATERIALS & CHEMICALS
    { id: "dow", ticker: "DOW", name: "Dow Inc.", role: "bulk plastics and polymers" },
    { id: "dd", ticker: "DD", name: "DuPont", role: "specialty chemicals, membranes, and polymers" },
    { id: "hon", ticker: "HON", name: "Honeywell", role: "specialty gases and chemical intermediates" },
    { id: "apd", ticker: "APD", name: "Air Products & Chemicals", role: "ultra-pure gases" },
    { id: "lin", ticker: "LIN", name: "Linde", role: "industrial and specialty gases" },

    // UPSTREAM — LABWARE & CONSUMABLE COMPONENTS
    { id: "glw", ticker: "GLW", name: "Corning", role: "glass labware, plasticware, filtration products" },

    // UPSTREAM — SEMICONDUCTOR & PRECISION EQUIPMENT COMPONENTS
    { id: "txn", ticker: "TXN", name: "Texas Instruments", role: "analog chips and sensors" },
    { id: "aph", ticker: "APH", name: "Amphenol", role: "precision connectors and electronic components" },
    { id: "a", ticker: "A", name: "Agilent Technologies", role: "components and reference standards" },

    // UPSTREAM — IT & CLOUD INFRASTRUCTURE
    { id: "amzn", ticker: "AMZN", name: "Amazon", role: "AWS cloud infrastructure" },
    { id: "msft", ticker: "MSFT", name: "Microsoft", role: "enterprise software, Azure cloud, and analytics" },
    { id: "snow", ticker: "SNOW", name: "Snowflake", role: "data analytics partnership" },

    // CENTER
    { id: "tmo", ticker: "TMO", name: "Thermo Fisher Scientific", role: "life sciences instruments, reagents, and services" },

    // DOWNSTREAM — PHARMA & BIOTECH
    { id: "mrna", ticker: "MRNA", name: "Moderna", role: "mRNA manufacturing collaboration and CDMO customer" },
    { id: "pfe", ticker: "PFE", name: "Pfizer", role: "diagnostic and manufacturing customer" },
    { id: "mrk", ticker: "MRK", name: "Merck & Co.", role: "pharma customer for instruments, reagents, and supplies" },
    { id: "lly", ticker: "LLY", name: "Eli Lilly", role: "biopharma customer and AI factory design partner" },

    // DOWNSTREAM — DIAGNOSTICS & HEALTHCARE
    { id: "dgx", ticker: "DGX", name: "Quest Diagnostics", role: "clinical lab customer" },
    { id: "lh", ticker: "LH", name: "Laboratory Corporation", role: "clinical lab customer" }
  ],
  edges: [
    // RAW MATERIALS & CHEMICALS → LABWARE / COMPONENTS / CLOUD
    { source: "dow", target: "glw" },
    { source: "dd", target: "glw" },
    { source: "hon", target: "txn" },
    { source: "apd", target: "aph" },
    { source: "lin", target: "a" },

    // LABWARE / COMPONENTS → IT & CLOUD
    { source: "glw", target: "amzn" },
    { source: "txn", target: "msft" },
    { source: "aph", target: "msft" },
    { source: "a", target: "snow" },

    // IT & CLOUD → TMO
    { source: "amzn", target: "tmo" },
    { source: "msft", target: "tmo" },
    { source: "snow", target: "tmo" },

    // TMO → PHARMA & BIOTECH
    { source: "tmo", target: "mrna" },
    { source: "tmo", target: "pfe" },
    { source: "tmo", target: "mrk" },
    { source: "tmo", target: "lly" },

    // TMO → DIAGNOSTICS & HEALTHCARE
    { source: "tmo", target: "dgx" },
    { source: "tmo", target: "lh" }
  ]
},
NFLX: {
  name: "Netflix",
  root: "nflx",
  nodes: [
    // UPSTREAM — CLOUD INFRASTRUCTURE
    { id: "amzn", ticker: "AMZN", name: "Amazon", role: "AWS cloud infrastructure" },

    // UPSTREAM — NETWORK INFRASTRUCTURE & COLOCATION
    { id: "eqix", ticker: "EQIX", name: "Equinix", role: "colocation and IXP peering facilities" },
    { id: "sanm", ticker: "SANM", name: "Sanmina", role: "Open Connect Appliance hardware manufacturer" },

    // UPSTREAM — DATA & ANALYTICS
    { id: "snow", ticker: "SNOW", name: "Snowflake", role: "data warehousing and analytics platform" },

    // CENTER
    { id: "nflx", ticker: "NFLX", name: "Netflix", role: "streaming platform" },

    // DOWNSTREAM — TIER 1 DEVICE & ACCESS PARTNERS
    { id: "aapl", ticker: "AAPL", name: "Apple", role: "iPhone, iPad, Apple TV distribution" },
    { id: "googl", ticker: "GOOGL", name: "Alphabet / Google", role: "Android, Google TV, Google Play billing" },
    { id: "cmcsa", ticker: "CMCSA", name: "Comcast", role: "Xfinity ISP and platform distribution" },
    { id: "chtr", ticker: "CHTR", name: "Charter Communications", role: "Spectrum ISP and platform distribution" },
    { id: "vz", ticker: "VZ", name: "Verizon", role: "ISP/mobile distribution and bundles" },
    { id: "tmus", ticker: "TMUS", name: "T-Mobile", role: "wireless bundle partner" },

  ],
  edges: [
    // CLOUD → NETWORK / ANALYTICS
    { source: "amzn", target: "eqix" },
    { source: "amzn", target: "snow" },

    // NETWORK → NETFLIX
    { source: "eqix", target: "sanm" },
    { source: "sanm", target: "nflx" },

    // ANALYTICS → NETFLIX
    { source: "snow", target: "nflx" },

    // NETFLIX → DEVICE / ACCESS PARTNERS
    { source: "nflx", target: "aapl" },
    { source: "nflx", target: "googl" },
    { source: "nflx", target: "cmcsa" },
    { source: "nflx", target: "chtr" },
    { source: "nflx", target: "vz" },
    { source: "nflx", target: "tmus" }
  ]
}
};

export default supplyChainTree;