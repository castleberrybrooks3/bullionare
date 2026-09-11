const supplyChainTree = {
AAPL: {
  name: "Apple",
  root: "aapl",
  nodes: [
    // UPSTREAM LAYER 1 — PUBLICLY TRADED SUPPLIERS / ENABLERS
    { id: "asml", ticker: "ASML", name: "ASML", role: "EUV lithography supplier to leading-edge foundries used in Apple's silicon supply chain" },
    { id: "amat", ticker: "AMAT", name: "Applied Materials", role: "semiconductor process-equipment supplier to advanced foundries and chip manufacturers" },
    { id: "lrcx", ticker: "LRCX", name: "Lam Research", role: "etch and deposition equipment supplier to advanced semiconductor manufacturers" },
    { id: "klac", ticker: "KLAC", name: "KLA", role: "inspection and process-control equipment supplier to advanced semiconductor manufacturers" },

    // UPSTREAM LAYER 2 — PUBLICLY TRADED DIRECT SUPPLIERS / PARTNERS
    { id: "tsm", ticker: "TSM", name: "TSMC", role: "leading-edge foundry manufacturing Apple-designed silicon" },
    { id: "avgo", ticker: "AVGO", name: "Broadcom", role: "Apple supplier for custom silicon and wireless/connectivity components" },
    { id: "glw", ticker: "GLW", name: "Corning", role: "cover-glass partner for iPhone and Apple Watch" },
    { id: "cohr", ticker: "COHR", name: "Coherent", role: "VCSEL laser supplier for Face ID and other optical sensing" },
    { id: "amkr", ticker: "AMKR", name: "Amkor Technology", role: "semiconductor packaging and test partner; Apple is a major direct customer" },
    { id: "crus", ticker: "CRUS", name: "Cirrus Logic", role: "audio and mixed-signal semiconductor supplier with heavy Apple exposure" },
    { id: "mp", ticker: "MP", name: "MP Materials", role: "long-term supplier of U.S.-made rare-earth magnets for Apple products" },
    { id: "txn", ticker: "TXN", name: "Texas Instruments", role: "analog semiconductor manufacturing partner in Apple's U.S. supply chain" },

    // CENTER
    { id: "aapl", ticker: "AAPL", name: "Apple", role: "hardware, silicon, software, and services platform" },

    // DOWNSTREAM — PUBLICLY TRADED CUSTOMERS / CHANNELS / COUNTERPARTIES
    { id: "vz", ticker: "VZ", name: "Verizon", role: "major U.S. carrier channel selling and activating Apple devices" },
    { id: "att", ticker: "T", name: "AT&T", role: "major U.S. carrier channel selling and activating Apple devices" },
    { id: "tmus", ticker: "TMUS", name: "T-Mobile US", role: "major U.S. carrier channel selling and activating Apple devices" },
    { id: "bby", ticker: "BBY", name: "Best Buy", role: "major third-party U.S. retail channel for Apple products" },
    { id: "amzn", ticker: "AMZN", name: "Amazon", role: "major online retail channel for Apple products" }
  ],

  edges: [
    // UPSTREAM LAYER 1 → LAYER 2
    { source: "asml", target: "tsm" },
    { source: "amat", target: "tsm" },
    { source: "lrcx", target: "tsm" },
    { source: "klac", target: "tsm" },

    // UPSTREAM LAYER 2 → CENTER
    { source: "tsm", target: "aapl" },
    { source: "avgo", target: "aapl" },
    { source: "glw", target: "aapl" },
    { source: "cohr", target: "aapl" },
    { source: "amkr", target: "aapl" },
    { source: "crus", target: "aapl" },
    { source: "mp", target: "aapl" },
    { source: "txn", target: "aapl" },

    // CENTER → DOWNSTREAM
    { source: "aapl", target: "vz" },
    { source: "aapl", target: "att" },
    { source: "aapl", target: "tmus" },
    { source: "aapl", target: "bby" },
    { source: "aapl", target: "amzn" }
  ]
},
WMT: {
  name: "Walmart",
  root: "wmt",
  nodes: [
    // UPSTREAM — PUBLICLY TRADED DIRECT SUPPLIERS / PARTNERS
    { id: "pg", ticker: "PG", name: "Procter & Gamble", role: "major branded consumer-products supplier to Walmart" },
    { id: "pep", ticker: "PEP", name: "PepsiCo", role: "major beverage and snack supplier to Walmart" },
    { id: "ko", ticker: "KO", name: "Coca-Cola", role: "major beverage supplier to Walmart" },
    { id: "kmb", ticker: "KMB", name: "Kimberly-Clark", role: "major consumer-products supplier; Walmart represented about 16% of 2025 continuing-operations sales" },
    { id: "clx", ticker: "CLX", name: "Clorox", role: "major consumer-products supplier; Walmart represented about 26% of fiscal 2026 sales" },
    { id: "tsn", ticker: "TSN", name: "Tyson Foods", role: "large U.S. food and protein supplier serving Walmart's grocery channel" },
    { id: "sym", ticker: "SYM", name: "Symbotic", role: "warehouse-automation partner deployed across Walmart distribution operations" },
    { id: "jbht", ticker: "JBHT", name: "J.B. Hunt", role: "public freight and intermodal partner with a long-term Walmart relationship" },

    // CENTER
    { id: "wmt", ticker: "WMT", name: "Walmart", role: "global omnichannel retailer, marketplace, logistics operator, and warehouse-club business" },

    // DOWNSTREAM — PUBLICLY TRADED CUSTOMERS / CHANNELS / COUNTERPARTIES
    { id: "musa", ticker: "MUSA", name: "Murphy USA", role: "public retail/fuel partner with a large store base historically located near Walmart properties" },
    { id: "dis", ticker: "DIS", name: "Disney", role: "public media partner participating in Walmart's retail-media and commerce ecosystem" },
    { id: "cmcsa", ticker: "CMCSA", name: "Comcast", role: "public media/streaming partner in Walmart's broader membership and advertising ecosystem" }
  ],

  edges: [
    // UPSTREAM → CENTER
    { source: "pg", target: "wmt" },
    { source: "pep", target: "wmt" },
    { source: "ko", target: "wmt" },
    { source: "kmb", target: "wmt" },
    { source: "clx", target: "wmt" },
    { source: "tsn", target: "wmt" },
    { source: "sym", target: "wmt" },
    { source: "jbht", target: "wmt" },

    // CENTER → DOWNSTREAM
    { source: "wmt", target: "musa" },
    { source: "wmt", target: "dis" },
    { source: "wmt", target: "cmcsa" }
  ]
},
TSLA: {
  name: "Tesla",
  root: "tsla",
  nodes: [
    // UPSTREAM LAYER 1 — PUBLICLY TRADED SUPPLIERS / ENABLERS
    { id: "asml", ticker: "ASML", name: "ASML", role: "lithography equipment supplier to advanced foundries producing Tesla-related semiconductors" },
    { id: "alb", ticker: "ALB", name: "Albemarle", role: "public lithium producer supplying the EV-battery materials ecosystem" },
    { id: "sqm", ticker: "SQM", name: "SQM", role: "public lithium producer supplying the global battery-materials ecosystem" },

    // UPSTREAM LAYER 2 — PUBLICLY TRADED DIRECT SUPPLIERS / PARTNERS
    { id: "tsm", ticker: "TSM", name: "TSMC", role: "advanced semiconductor foundry used for Tesla-designed AI/vehicle chips" },
    { id: "samsung", ticker: "005930.KS", name: "Samsung Electronics", role: "semiconductor foundry and electronics supplier with a large Tesla AI-chip manufacturing agreement" },
    { id: "pana", ticker: "6752.T", name: "Panasonic Holdings", role: "long-standing Tesla lithium-ion battery-cell partner" },
    { id: "catl", ticker: "300750.SZ", name: "CATL", role: "battery-cell supplier to Tesla, including LFP products" },
    { id: "lges", ticker: "373220.KS", name: "LG Energy Solution", role: "battery-cell supplier to Tesla" },
    { id: "nvda", ticker: "NVDA", name: "NVIDIA", role: "AI training compute supplier used in Tesla's AI infrastructure" },
    { id: "on", ticker: "ON", name: "onsemi", role: "power-semiconductor supplier to the EV ecosystem, including silicon-carbide power devices" },
    { id: "stm", ticker: "STM", name: "STMicroelectronics", role: "power and automotive semiconductor supplier" },

    // CENTER
    { id: "tsla", ticker: "TSLA", name: "Tesla", role: "electric vehicles, energy storage, charging, AI software, and vertically integrated manufacturing" },

    // DOWNSTREAM — PUBLICLY TRADED CUSTOMERS / CHANNELS / COUNTERPARTIES
    { id: "f", ticker: "F", name: "Ford", role: "automaker with access to Tesla's Supercharger/NACS charging ecosystem" },
    { id: "gm", ticker: "GM", name: "General Motors", role: "automaker with access to Tesla's Supercharger/NACS charging ecosystem" },
    { id: "rivn", ticker: "RIVN", name: "Rivian", role: "automaker using Tesla's North American charging standard and Supercharger access" },
    { id: "hmc", ticker: "HMC", name: "Honda Motor", role: "automaker adopting NACS/Supercharger compatibility in North America" },
    { id: "tm", ticker: "TM", name: "Toyota Motor", role: "automaker adopting NACS/Supercharger compatibility in North America" },
    { id: "vwagy", ticker: "VOW.DE", name: "Volkswagen", role: "automaker adopting NACS/Supercharger compatibility in North America" }
  ],

  edges: [
    // UPSTREAM LAYER 1 → LAYER 2
    { source: "asml", target: "tsm" },
    { source: "asml", target: "samsung" },

    // UPSTREAM LAYER 2 → CENTER
    { source: "tsm", target: "tsla" },
    { source: "samsung", target: "tsla" },
    { source: "pana", target: "tsla" },
    { source: "catl", target: "tsla" },
    { source: "lges", target: "tsla" },
    { source: "nvda", target: "tsla" },
    { source: "on", target: "tsla" },
    { source: "stm", target: "tsla" },

    // CENTER → DOWNSTREAM
    { source: "tsla", target: "f" },
    { source: "tsla", target: "gm" },
    { source: "tsla", target: "rivn" },
    { source: "tsla", target: "hmc" },
    { source: "tsla", target: "tm" },
    { source: "tsla", target: "vwagy" }
  ]
},
MSFT: {
  name: "Microsoft",
  root: "msft",
  nodes: [
    // UPSTREAM LAYER 1 — PUBLICLY TRADED SUPPLIERS / ENABLERS
    { id: "asml", ticker: "ASML", name: "ASML", role: "lithography equipment supplier to the advanced foundry ecosystem behind Microsoft AI silicon suppliers" },
    { id: "tsm", ticker: "TSM", name: "TSMC", role: "foundry manufacturing advanced processors used by major Microsoft compute suppliers" },

    // UPSTREAM LAYER 2 — PUBLICLY TRADED DIRECT SUPPLIERS / PARTNERS
    { id: "nvda", ticker: "NVDA", name: "NVIDIA", role: "major AI GPU and accelerated-computing supplier to Azure" },
    { id: "amd", ticker: "AMD", name: "AMD", role: "EPYC CPU and Instinct accelerator supplier to Azure" },
    { id: "intc", ticker: "INTC", name: "Intel", role: "Xeon and PC processor supplier across Microsoft's cloud and device ecosystem" },
    { id: "qcom", ticker: "QCOM", name: "Qualcomm", role: "Snapdragon processor supplier for Windows on Arm and Copilot+ PCs" },
    { id: "ceg", ticker: "CEG", name: "Constellation Energy", role: "long-term power partner supporting Microsoft's data-center electricity needs" },

    // CENTER
    { id: "msft", ticker: "MSFT", name: "Microsoft", role: "Azure cloud, AI, Microsoft 365, Windows, gaming, security, and enterprise software" },

    // DOWNSTREAM — PUBLICLY TRADED CUSTOMERS / CHANNELS / COUNTERPARTIES
    { id: "dell", ticker: "DELL", name: "Dell Technologies", role: "major Windows PC OEM and Microsoft enterprise ecosystem partner" },
    { id: "hpq", ticker: "HPQ", name: "HP Inc.", role: "major Windows PC OEM" },
    { id: "lnvgy", ticker: "0992.HK", name: "Lenovo Group", role: "major Windows PC OEM and enterprise device partner" },
    { id: "sap", ticker: "SAP", name: "SAP", role: "major enterprise software partner with extensive Azure integrations" },
    { id: "acn", ticker: "ACN", name: "Accenture", role: "major systems-integration and Microsoft cloud implementation partner" },
    { id: "crm", ticker: "CRM", name: "Salesforce", role: "enterprise software company with Microsoft interoperability and data integrations" }
  ],

  edges: [
    // UPSTREAM LAYER 1 → LAYER 2
    { source: "asml", target: "tsm" },
    { source: "tsm", target: "nvda" },
    { source: "tsm", target: "amd" },

    // UPSTREAM LAYER 2 → CENTER
    { source: "nvda", target: "msft" },
    { source: "amd", target: "msft" },
    { source: "intc", target: "msft" },
    { source: "qcom", target: "msft" },
    { source: "ceg", target: "msft" },

    // CENTER → DOWNSTREAM
    { source: "msft", target: "dell" },
    { source: "msft", target: "hpq" },
    { source: "msft", target: "lnvgy" },
    { source: "msft", target: "sap" },
    { source: "msft", target: "acn" },
    { source: "msft", target: "crm" }
  ]
},
AMZN: {
  name: "Amazon",
  root: "amzn",
  nodes: [
    // UPSTREAM LAYER 1 — PUBLICLY TRADED SUPPLIERS / ENABLERS
    { id: "asml", ticker: "ASML", name: "ASML", role: "lithography-equipment supplier to foundries producing chips used in AWS infrastructure" },
    { id: "tsm", ticker: "TSM", name: "TSMC", role: "foundry manufacturing advanced processors used by several AWS compute suppliers" },

    // UPSTREAM LAYER 2 — PUBLICLY TRADED DIRECT SUPPLIERS / PARTNERS
    { id: "nvda", ticker: "NVDA", name: "NVIDIA", role: "major AWS GPU, CPU, networking, and accelerated-computing partner" },
    { id: "amd", ticker: "AMD", name: "AMD", role: "EPYC CPU and accelerator supplier used in AWS" },
    { id: "qcom", ticker: "QCOM", name: "Qualcomm", role: "long-term AI data-center chip partner for AWS" },
    { id: "tln", ticker: "TLN", name: "Talen Energy", role: "public power producer with a major Amazon/AWS data-center energy relationship" },
    { id: "fdx", ticker: "FDX", name: "FedEx", role: "public transportation and delivery partner used in parts of Amazon's logistics network" },
    { id: "aapl", ticker: "AAPL", name: "Apple", role: "major branded merchandise supplier sold through Amazon's retail channel" },

    // CENTER
    { id: "amzn", ticker: "AMZN", name: "Amazon", role: "e-commerce marketplace, AWS cloud, logistics network, advertising, and subscription platform" },

    // DOWNSTREAM — PUBLICLY TRADED CUSTOMERS / CHANNELS / COUNTERPARTIES
    { id: "nflx", ticker: "NFLX", name: "Netflix", role: "major AWS customer" },
    { id: "pfe", ticker: "PFE", name: "Pfizer", role: "enterprise AWS customer" },
    { id: "bmwyy", ticker: "BMW.DE", name: "BMW", role: "enterprise AWS customer using cloud and automotive data services" },
    { id: "addyy", ticker: "ADS.DE", name: "adidas", role: "enterprise AWS customer" },
    { id: "rivn", ticker: "RIVN", name: "Rivian", role: "AWS customer and strategic automotive partner" }
  ],

  edges: [
    // UPSTREAM LAYER 1 → LAYER 2
    { source: "asml", target: "tsm" },
    { source: "tsm", target: "nvda" },
    { source: "tsm", target: "amd" },
    { source: "tsm", target: "qcom" },

    // UPSTREAM LAYER 2 → CENTER
    { source: "nvda", target: "amzn" },
    { source: "amd", target: "amzn" },
    { source: "qcom", target: "amzn" },
    { source: "tln", target: "amzn" },
    { source: "fdx", target: "amzn" },
    { source: "aapl", target: "amzn" },

    // CENTER → DOWNSTREAM
    { source: "amzn", target: "nflx" },
    { source: "amzn", target: "pfe" },
    { source: "amzn", target: "bmwyy" },
    { source: "amzn", target: "addyy" },
    { source: "amzn", target: "rivn" }
  ]
},
GOOGL: {
  name: "Alphabet (Google)",
  root: "googl",
  nodes: [
    // UPSTREAM LAYER 1 — PUBLICLY TRADED SUPPLIERS / ENABLERS
    { id: "asml", ticker: "ASML", name: "ASML", role: "advanced lithography supplier to foundries producing Google and partner AI silicon" },
    { id: "tsm", ticker: "TSM", name: "TSMC", role: "foundry partner used in the advanced semiconductor ecosystem supporting Google AI infrastructure" },

    // UPSTREAM LAYER 2 — PUBLICLY TRADED DIRECT SUPPLIERS / PARTNERS
    { id: "avgo", ticker: "AVGO", name: "Broadcom", role: "long-term custom TPU and networking-silicon partner for Google" },
    { id: "nvda", ticker: "NVDA", name: "NVIDIA", role: "GPU and AI infrastructure partner for Google Cloud" },
    { id: "cohr", ticker: "COHR", name: "Coherent", role: "optical-component supplier to hyperscale data-center infrastructure" },
    { id: "lite", ticker: "LITE", name: "Lumentum", role: "optical networking component supplier to hyperscale data-center infrastructure" },
    { id: "eqix", ticker: "EQIX", name: "Equinix", role: "public colocation and interconnection infrastructure provider used by cloud ecosystems" },
    { id: "nee", ticker: "NEE", name: "NextEra Energy", role: "large U.S. power and renewable-energy counterparty for data-center expansion" },

    // CENTER
    { id: "googl", ticker: "GOOGL", name: "Alphabet (Google)", role: "Search, advertising, YouTube, Google Cloud, Gemini AI, Android, and devices" },

    // DOWNSTREAM — PUBLICLY TRADED CUSTOMERS / CHANNELS / COUNTERPARTIES
    { id: "aapl", ticker: "AAPL", name: "Apple", role: "major search-distribution partner for Google services" },
    { id: "db", ticker: "DB", name: "Deutsche Bank", role: "Google Cloud enterprise customer" },
    { id: "cme", ticker: "CME", name: "CME Group", role: "Google Cloud strategic customer and data/cloud partner" },
    { id: "f", ticker: "F", name: "Ford", role: "Google Cloud and Android Automotive enterprise partner" },
    { id: "shop", ticker: "SHOP", name: "Shopify", role: "Google Cloud customer and commerce ecosystem partner" }
  ],

  edges: [
    // UPSTREAM LAYER 1 → LAYER 2
    { source: "asml", target: "tsm" },
    { source: "tsm", target: "avgo" },
    { source: "tsm", target: "nvda" },

    // UPSTREAM LAYER 2 → CENTER
    { source: "avgo", target: "googl" },
    { source: "nvda", target: "googl" },
    { source: "cohr", target: "googl" },
    { source: "lite", target: "googl" },
    { source: "eqix", target: "googl" },
    { source: "nee", target: "googl" },

    // CENTER → DOWNSTREAM
    { source: "googl", target: "aapl" },
    { source: "googl", target: "db" },
    { source: "googl", target: "cme" },
    { source: "googl", target: "f" },
    { source: "googl", target: "shop" }
  ]
},
META: {
  name: "Meta Platforms",
  root: "meta",
  nodes: [
    // UPSTREAM LAYER 1 — PUBLICLY TRADED SUPPLIERS / ENABLERS
    { id: "asml", ticker: "ASML", name: "ASML", role: "lithography supplier to foundries producing advanced AI and networking silicon" },
    { id: "tsm", ticker: "TSM", name: "TSMC", role: "foundry supporting advanced AI and networking chips used across Meta infrastructure" },

    // UPSTREAM LAYER 2 — PUBLICLY TRADED DIRECT SUPPLIERS / PARTNERS
    { id: "nvda", ticker: "NVDA", name: "NVIDIA", role: "strategic AI infrastructure supplier for Meta's large-scale training and inference buildout" },
    { id: "avgo", ticker: "AVGO", name: "Broadcom", role: "custom silicon and networking partner in hyperscale AI infrastructure" },
    { id: "anet", ticker: "ANET", name: "Arista Networks", role: "high-speed data-center networking supplier" },
    { id: "vrt", ticker: "VRT", name: "Vertiv", role: "power and cooling infrastructure supplier to large AI data centers" },
    { id: "glw", ticker: "GLW", name: "Corning", role: "fiber and optical connectivity supplier to hyperscale networks" },
    { id: "cohr", ticker: "COHR", name: "Coherent", role: "optical components supplier for AI data-center interconnects" },

    // CENTER
    { id: "meta", ticker: "META", name: "Meta Platforms", role: "Facebook, Instagram, WhatsApp, Messenger, AI, and advertising platform" },

    // DOWNSTREAM — PUBLICLY TRADED CUSTOMERS / CHANNELS / COUNTERPARTIES
    { id: "aapl", ticker: "AAPL", name: "Apple", role: "iOS distribution platform for Meta applications" },
    { id: "googl", ticker: "GOOGL", name: "Alphabet", role: "Android and Google Play distribution platform for Meta applications" },
    { id: "shop", ticker: "SHOP", name: "Shopify", role: "commerce integration partner connecting merchants with Meta platforms" }
  ],

  edges: [
    // UPSTREAM LAYER 1 → LAYER 2
    { source: "asml", target: "tsm" },
    { source: "tsm", target: "nvda" },
    { source: "tsm", target: "avgo" },

    // UPSTREAM LAYER 2 → CENTER
    { source: "nvda", target: "meta" },
    { source: "avgo", target: "meta" },
    { source: "anet", target: "meta" },
    { source: "vrt", target: "meta" },
    { source: "glw", target: "meta" },
    { source: "cohr", target: "meta" },

    // CENTER → DOWNSTREAM
    { source: "meta", target: "aapl" },
    { source: "meta", target: "googl" },
    { source: "meta", target: "shop" }
  ]
},
ORCL: {
  name: "Oracle",
  root: "orcl",
  nodes: [
    // UPSTREAM LAYER 1 — PUBLICLY TRADED SUPPLIERS / ENABLERS
    { id: "asml", ticker: "ASML", name: "ASML", role: "lithography-equipment supplier to foundries producing chips used in OCI" },
    { id: "tsm", ticker: "TSM", name: "TSMC", role: "foundry manufacturing advanced processors used by Oracle cloud compute suppliers" },

    // UPSTREAM LAYER 2 — PUBLICLY TRADED DIRECT SUPPLIERS / PARTNERS
    { id: "nvda", ticker: "NVDA", name: "NVIDIA", role: "major OCI AI accelerator and networking supplier" },
    { id: "amd", ticker: "AMD", name: "AMD", role: "EPYC CPU and Instinct accelerator supplier to OCI" },
    { id: "intc", ticker: "INTC", name: "Intel", role: "Xeon processor supplier for enterprise and cloud systems" },
    { id: "vrt", ticker: "VRT", name: "Vertiv", role: "data-center power and cooling infrastructure supplier" },
    { id: "anet", ticker: "ANET", name: "Arista Networks", role: "high-bandwidth data-center networking supplier" },
    { id: "dlr", ticker: "DLR", name: "Digital Realty", role: "public data-center and colocation infrastructure partner" },

    // CENTER
    { id: "orcl", ticker: "ORCL", name: "Oracle", role: "database, OCI cloud, Fusion SaaS, applications, and engineered systems" },

    // DOWNSTREAM — PUBLICLY TRADED CUSTOMERS / CHANNELS / COUNTERPARTIES
    { id: "msft", ticker: "MSFT", name: "Microsoft", role: "multicloud/database partner through Oracle Database@Azure" },
    { id: "amzn", ticker: "AMZN", name: "Amazon", role: "multicloud/database partner through Oracle Database@AWS" },
    { id: "googl", ticker: "GOOGL", name: "Alphabet", role: "multicloud/database partner through Oracle Database@Google Cloud" },
    { id: "acn", ticker: "ACN", name: "Accenture", role: "major Oracle implementation and transformation partner" },
    { id: "ctsh", ticker: "CTSH", name: "Cognizant", role: "Oracle implementation and systems-integration partner" },
    { id: "dxc", ticker: "DXC", name: "DXC Technology", role: "Oracle implementation and managed-services partner" }
  ],

  edges: [
    // UPSTREAM LAYER 1 → LAYER 2
    { source: "asml", target: "tsm" },
    { source: "tsm", target: "nvda" },
    { source: "tsm", target: "amd" },

    // UPSTREAM LAYER 2 → CENTER
    { source: "nvda", target: "orcl" },
    { source: "amd", target: "orcl" },
    { source: "intc", target: "orcl" },
    { source: "vrt", target: "orcl" },
    { source: "anet", target: "orcl" },
    { source: "dlr", target: "orcl" },

    // CENTER → DOWNSTREAM
    { source: "orcl", target: "msft" },
    { source: "orcl", target: "amzn" },
    { source: "orcl", target: "googl" },
    { source: "orcl", target: "acn" },
    { source: "orcl", target: "ctsh" },
    { source: "orcl", target: "dxc" }
  ]
},
HD: {
  name: "Home Depot",
  root: "hd",
  nodes: [
    // UPSTREAM — PUBLICLY TRADED DIRECT SUPPLIERS / PARTNERS
    { id: "swk", ticker: "SWK", name: "Stanley Black & Decker", role: "major tools and outdoor-products supplier; Home Depot is a major customer" },
    { id: "mas", ticker: "MAS", name: "Masco", role: "major plumbing and home-products supplier with significant Home Depot exposure" },
    { id: "smg", ticker: "SMG", name: "Scotts Miracle-Gro", role: "lawn and garden supplier; Home Depot is one of its largest customers" },
    { id: "jeld", ticker: "JELD", name: "JELD-WEN", role: "windows and doors supplier with significant Home Depot channel exposure" },
    { id: "whr", ticker: "WHR", name: "Whirlpool", role: "major appliance supplier sold through Home Depot" },
    { id: "mhk", ticker: "MHK", name: "Mohawk Industries", role: "flooring supplier serving Home Depot and other large home-improvement retailers" },
    { id: "shw", ticker: "SHW", name: "Sherwin-Williams", role: "coatings supplier with products sold through large retail and professional channels" },
    { id: "oc", ticker: "OC", name: "Owens Corning", role: "building-materials supplier serving roofing and insulation demand" },

    // CENTER
    { id: "hd", ticker: "HD", name: "Home Depot", role: "home-improvement retailer, specialty-trade distributor, services platform, and omnichannel fulfillment network" },

    // DOWNSTREAM — PUBLICLY TRADED CUSTOMERS / CHANNELS / COUNTERPARTIES
    { id: "dhi", ticker: "DHI", name: "D.R. Horton", role: "public homebuilder representing downstream professional construction demand" },
    { id: "len", ticker: "LEN", name: "Lennar", role: "public homebuilder representing downstream professional construction demand" },
    { id: "phm", ticker: "PHM", name: "PulteGroup", role: "public homebuilder representing downstream professional construction demand" },
    { id: "invh", ticker: "INVH", name: "Invitation Homes", role: "public property operator representing repair and maintenance demand" },
    { id: "mar", ticker: "MAR", name: "Marriott International", role: "public hospitality operator representing renovation and maintenance demand" }
  ],

  edges: [
    // UPSTREAM → CENTER
    { source: "swk", target: "hd" },
    { source: "mas", target: "hd" },
    { source: "smg", target: "hd" },
    { source: "jeld", target: "hd" },
    { source: "whr", target: "hd" },
    { source: "mhk", target: "hd" },
    { source: "shw", target: "hd" },
    { source: "oc", target: "hd" },

    // CENTER → DOWNSTREAM
    { source: "hd", target: "dhi" },
    { source: "hd", target: "len" },
    { source: "hd", target: "phm" },
    { source: "hd", target: "invh" },
    { source: "hd", target: "mar" }
  ]
},
NVDA: {
  name: "NVIDIA",
  root: "nvda",
  nodes: [
    // UPSTREAM LAYER 1 — PUBLICLY TRADED SUPPLIERS / ENABLERS
    { id: "asml", ticker: "ASML", name: "ASML", role: "EUV lithography systems used by NVIDIA's leading-edge foundry partners" },
    { id: "snps", ticker: "SNPS", name: "Synopsys", role: "EDA and verification software used across advanced semiconductor design" },
    { id: "cdns", ticker: "CDNS", name: "Cadence", role: "EDA, verification, and 3D-IC design software used across advanced semiconductor design" },

    // UPSTREAM LAYER 2 — PUBLICLY TRADED DIRECT SUPPLIERS / PARTNERS
    { id: "tsm", ticker: "TSM", name: "TSMC", role: "semiconductor-wafer foundry and advanced-packaging partner used by NVIDIA" },
    { id: "samsung", ticker: "005930.KS", name: "Samsung Electronics", role: "semiconductor foundry and memory supplier used by NVIDIA" },
    { id: "skhynix", ticker: "000660.KS", name: "SK hynix", role: "HBM and memory supplier to NVIDIA" },
    { id: "mu", ticker: "MU", name: "Micron", role: "HBM and memory supplier to NVIDIA" },
    { id: "foxconn", ticker: "2317.TW", name: "Hon Hai / Foxconn", role: "contract manufacturer performing assembly, testing, and packaging for NVIDIA products" },
    { id: "wistron", ticker: "3231.TW", name: "Wistron", role: "contract manufacturer producing NVIDIA AI systems and performing final-product assembly" },
    { id: "fabrinet", ticker: "FN", name: "Fabrinet", role: "contract manufacturer performing assembly, testing, and packaging for NVIDIA final products" },

    // CENTER
    { id: "nvda", ticker: "NVDA", name: "NVIDIA", role: "GPU, CPU, networking, AI systems, and CUDA software platform" },

    // DOWNSTREAM — PUBLICLY TRADED CUSTOMERS / CHANNELS / COUNTERPARTIES
    { id: "msft", ticker: "MSFT", name: "Microsoft", role: "Azure and AI infrastructure customer deploying NVIDIA platforms" },
    { id: "amzn", ticker: "AMZN", name: "Amazon", role: "AWS customer deploying NVIDIA GPU, CPU, networking, and AI infrastructure" },
    { id: "googl", ticker: "GOOGL", name: "Alphabet", role: "Google Cloud customer and AI-infrastructure partner" },
    { id: "orcl", ticker: "ORCL", name: "Oracle", role: "OCI customer deploying NVIDIA AI infrastructure" },
    { id: "meta", ticker: "META", name: "Meta", role: "hyperscale AI customer deploying NVIDIA Blackwell and Rubin platforms" },
    { id: "crwv", ticker: "CRWV", name: "CoreWeave", role: "cloud partner deploying multiple generations of NVIDIA AI infrastructure" }
  ],

  edges: [
    // UPSTREAM LAYER 1 → LAYER 2
    { source: "asml", target: "tsm" },
    { source: "asml", target: "samsung" },
    { source: "snps", target: "tsm" },
    { source: "snps", target: "samsung" },
    { source: "cdns", target: "tsm" },
    { source: "cdns", target: "samsung" },

    // UPSTREAM LAYER 2 → CENTER
    { source: "tsm", target: "nvda" },
    { source: "samsung", target: "nvda" },
    { source: "skhynix", target: "nvda" },
    { source: "mu", target: "nvda" },
    { source: "foxconn", target: "nvda" },
    { source: "wistron", target: "nvda" },
    { source: "fabrinet", target: "nvda" },

    // CENTER → DOWNSTREAM
    { source: "nvda", target: "msft" },
    { source: "nvda", target: "amzn" },
    { source: "nvda", target: "googl" },
    { source: "nvda", target: "orcl" },
    { source: "nvda", target: "meta" },
    { source: "nvda", target: "crwv" }
  ]
},
PG: {
  name: "Procter & Gamble",
  root: "pg",
  nodes: [
    // UPSTREAM — PUBLICLY TRADED DIRECT SUPPLIERS / PARTNERS
    { id: "iff", ticker: "IFF", name: "International Flavors & Fragrances", role: "P&G supplier recognized for enzymes, fragrance, and bioscience inputs" },
    { id: "crwd", ticker: "CRWD", name: "CrowdStrike", role: "P&G external business partner supporting cybersecurity" },
    { id: "jll", ticker: "JLL", name: "Jones Lang LaSalle", role: "P&G facilities-management supplier and recognized business partner" },
    { id: "expd", ticker: "EXPD", name: "Expeditors International", role: "P&G logistics and freight partner" },
    { id: "amkby", ticker: "AMKBY", name: "A.P. Moller - Maersk", role: "P&G strategic ocean, air, customs, warehousing, and local-transport logistics partner" },
    { id: "snDR", ticker: "SNDR", name: "Schneider National", role: "public North American trucking carrier recognized in P&G's carrier network" },
    { id: "jbht", ticker: "JBHT", name: "J.B. Hunt", role: "public transportation partner recognized in P&G's logistics network" },
    { id: "nippon", ticker: "4114.T", name: "Nippon Shokubai", role: "supplier of superabsorbent polymer used in P&G baby-care products" },

    // CENTER
    { id: "pg", ticker: "PG", name: "Procter & Gamble", role: "global consumer-products manufacturer across beauty, grooming, health care, fabric/home care, and family care" },

    // DOWNSTREAM — PUBLICLY TRADED CUSTOMERS / CHANNELS / COUNTERPARTIES
    { id: "wmt", ticker: "WMT", name: "Walmart", role: "P&G's largest customer and a major global retail channel" },
    { id: "cost", ticker: "COST", name: "Costco Wholesale", role: "major warehouse-club retail channel for P&G products" },
    { id: "tgt", ticker: "TGT", name: "Target", role: "major mass-merchandise retail channel for P&G products" },
    { id: "kr", ticker: "KR", name: "Kroger", role: "major grocery and pharmacy retail channel for P&G products" },
    { id: "amzn", ticker: "AMZN", name: "Amazon", role: "major e-commerce retail channel for P&G products" },
    { id: "cvs", ticker: "CVS", name: "CVS Health", role: "major pharmacy and health-and-beauty retail channel for P&G products" }
  ],

  edges: [
    // UPSTREAM → CENTER
    { source: "iff", target: "pg" },
    { source: "crwd", target: "pg" },
    { source: "jll", target: "pg" },
    { source: "expd", target: "pg" },
    { source: "amkby", target: "pg" },
    { source: "snDR", target: "pg" },
    { source: "jbht", target: "pg" },
    { source: "nippon", target: "pg" },

    // CENTER → DOWNSTREAM
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
    // UPSTREAM — PUBLICLY TRADED DIRECT SUPPLIERS / PARTNERS
    { id: "tmo", ticker: "TMO", name: "Thermo Fisher Scientific", role: "life-science instruments, reagents, and bioprocessing supplier serving large biopharma manufacturers" },
    { id: "dhr", ticker: "DHR", name: "Danaher", role: "life-science and bioprocessing equipment supplier serving pharmaceutical manufacturing" },
    { id: "wst", ticker: "WST", name: "West Pharmaceutical Services", role: "injectable-drug containment and delivery-system supplier to the pharmaceutical industry" },
    { id: "glw", ticker: "GLW", name: "Corning", role: "glass and life-science materials supplier used across pharmaceutical and medical manufacturing" },
    { id: "bdx", ticker: "BDX", name: "Becton, Dickinson", role: "medical-device and drug-delivery technology supplier in the healthcare manufacturing ecosystem" },

    // CENTER
    { id: "jnj", ticker: "JNJ", name: "Johnson & Johnson", role: "innovative medicine and MedTech manufacturer with global regulated supply chains" },

    // DOWNSTREAM — PUBLICLY TRADED CUSTOMERS / CHANNELS / COUNTERPARTIES
    { id: "mck", ticker: "MCK", name: "McKesson", role: "authorized pharmaceutical wholesaler/distributor for J&J medicines" },
    { id: "cor", ticker: "COR", name: "Cencora", role: "authorized pharmaceutical wholesaler/distributor for J&J medicines" },
    { id: "cah", ticker: "CAH", name: "Cardinal Health", role: "authorized pharmaceutical wholesaler/distributor for J&J medicines" },
    { id: "hsic", ticker: "HSIC", name: "Henry Schein", role: "authorized distributor in medical and healthcare channels" },
    { id: "cvs", ticker: "CVS", name: "CVS Health", role: "major U.S. pharmacy channel for J&J medicines and health products" },
    { id: "hca", ticker: "HCA", name: "HCA Healthcare", role: "large hospital system and institutional end-market for medicines and MedTech products" }
  ],

  edges: [
    // UPSTREAM → CENTER
    { source: "tmo", target: "jnj" },
    { source: "dhr", target: "jnj" },
    { source: "wst", target: "jnj" },
    { source: "glw", target: "jnj" },
    { source: "bdx", target: "jnj" },

    // CENTER → DOWNSTREAM
    { source: "jnj", target: "mck" },
    { source: "jnj", target: "cor" },
    { source: "jnj", target: "cah" },
    { source: "jnj", target: "hsic" },
    { source: "jnj", target: "cvs" },
    { source: "jnj", target: "hca" }
  ]
},
CVS: {
  name: "CVS Health",
  root: "cvs",
  nodes: [
    // UPSTREAM LAYER 1 — PUBLICLY TRADED SUPPLIERS / ENABLERS
    { id: "pfe", ticker: "PFE", name: "Pfizer", role: "branded pharmaceutical manufacturer whose products flow through U.S. drug-distribution channels" },
    { id: "mrk", ticker: "MRK", name: "Merck", role: "branded pharmaceutical manufacturer supplying U.S. pharmacy channels" },
    { id: "jnj", ticker: "JNJ", name: "Johnson & Johnson", role: "pharmaceutical manufacturer supplying U.S. pharmacy channels" },
    { id: "lly", ticker: "LLY", name: "Eli Lilly", role: "pharmaceutical manufacturer supplying high-value diabetes, obesity, and specialty medicines" },
    { id: "abbv", ticker: "ABBV", name: "AbbVie", role: "specialty pharmaceutical manufacturer supplying U.S. pharmacy channels" },
    { id: "teva", ticker: "TEVA", name: "Teva Pharmaceutical", role: "large generic-drug manufacturer supplying U.S. pharmacy channels" },
    { id: "vtrs", ticker: "VTRS", name: "Viatris", role: "generic and biosimilar manufacturer supplying U.S. pharmacy channels" },

    // UPSTREAM LAYER 2 — PUBLICLY TRADED DIRECT SUPPLIERS / PARTNERS
    { id: "mck", ticker: "MCK", name: "McKesson", role: "major pharmaceutical distributor to CVS under a long-term distribution relationship" },
    { id: "cah", ticker: "CAH", name: "Cardinal Health", role: "major pharmaceutical wholesaler and CVS sourcing/distribution partner through Red Oak Sourcing" },
    { id: "cor", ticker: "COR", name: "Cencora", role: "large pharmaceutical wholesaler participating in U.S. retail and specialty distribution" },

    // CENTER
    { id: "cvs", ticker: "CVS", name: "CVS Health", role: "integrated health company spanning Aetna insurance, Caremark PBM, retail pharmacy, specialty pharmacy, and care delivery" },

    // DOWNSTREAM — PUBLICLY TRADED CUSTOMERS / CHANNELS / COUNTERPARTIES
    { id: "hca", ticker: "HCA", name: "HCA Healthcare", role: "public hospital/provider counterparty in the broader payer, pharmacy, and care ecosystem" },
    { id: "thc", ticker: "THC", name: "Tenet Healthcare", role: "public hospital/provider counterparty in the broader payer and care ecosystem" },
    { id: "unh", ticker: "UNH", name: "UnitedHealth Group", role: "public health-benefits and PBM competitor/counterparty in U.S. healthcare distribution" }
  ],

  edges: [
    // UPSTREAM LAYER 1 → LAYER 2
    { source: "pfe", target: "mck" },
    { source: "mrk", target: "cah" },
    { source: "jnj", target: "cor" },
    { source: "lly", target: "mck" },
    { source: "abbv", target: "cah" },
    { source: "teva", target: "mck" },
    { source: "vtrs", target: "cor" },

    // UPSTREAM LAYER 2 → CENTER
    { source: "mck", target: "cvs" },
    { source: "cah", target: "cvs" },
    { source: "cor", target: "cvs" },

    // CENTER → DOWNSTREAM
    { source: "cvs", target: "hca" },
    { source: "cvs", target: "thc" },
    { source: "cvs", target: "unh" }
  ]
},
V: {
  name: "Visa",
  root: "v",
  nodes: [
    // UPSTREAM LAYER 1 — PUBLICLY TRADED SUPPLIERS / ENABLERS
    { id: "fi", ticker: "FI", name: "Fiserv", role: "merchant-acquiring, issuer-processing, and payment-technology participant connected to Visa" },
    { id: "fis", ticker: "FIS", name: "FIS", role: "issuer, banking, and payment-processing technology provider connected to global card networks" },
    { id: "gpn", ticker: "GPN", name: "Global Payments", role: "merchant-acquiring and payment-processing company connected to Visa" },
    { id: "pypl", ticker: "PYPL", name: "PayPal", role: "digital-wallet and payments company using Visa credentials and network services" },
    { id: "sq", ticker: "XYZ", name: "Block", role: "Square/Cash App parent and payment ecosystem participant using card-network rails" },

    // UPSTREAM LAYER 2 — PUBLICLY TRADED DIRECT SUPPLIERS / PARTNERS
    { id: "jpm", ticker: "JPM", name: "JPMorgan Chase", role: "major Visa issuer and financial-institution client" },
    { id: "bac", ticker: "BAC", name: "Bank of America", role: "major Visa issuer and financial-institution client" },
    { id: "citi", ticker: "C", name: "Citigroup", role: "major Visa issuer and financial-institution client" },
    { id: "wfc", ticker: "WFC", name: "Wells Fargo", role: "major Visa issuer and financial-institution client" },
    { id: "cof", ticker: "COF", name: "Capital One", role: "major U.S. card issuer using Visa network products" },
    { id: "usb", ticker: "USB", name: "U.S. Bancorp", role: "major issuer and acquiring-bank participant" },

    // CENTER
    { id: "v", ticker: "V", name: "Visa", role: "global payments network and value-added services platform" },

    // DOWNSTREAM — PUBLICLY TRADED CUSTOMERS / CHANNELS / COUNTERPARTIES
    { id: "amzn", ticker: "AMZN", name: "Amazon", role: "large global merchant accepting Visa credentials" },
    { id: "wmt", ticker: "WMT", name: "Walmart", role: "large global merchant accepting Visa credentials" },
    { id: "shop", ticker: "SHOP", name: "Shopify", role: "commerce platform supporting merchants that accept Visa" },
    { id: "uber", ticker: "UBER", name: "Uber", role: "large digital merchant/platform accepting Visa payments" },
    { id: "abnb", ticker: "ABNB", name: "Airbnb", role: "large travel marketplace accepting Visa payments" }
  ],

  edges: [
    // UPSTREAM LAYER 1 → LAYER 2
    { source: "fi", target: "jpm" },
    { source: "fis", target: "bac" },
    { source: "gpn", target: "wfc" },
    { source: "pypl", target: "cof" },
    { source: "sq", target: "usb" },

    // UPSTREAM LAYER 2 → CENTER
    { source: "jpm", target: "v" },
    { source: "bac", target: "v" },
    { source: "citi", target: "v" },
    { source: "wfc", target: "v" },
    { source: "cof", target: "v" },
    { source: "usb", target: "v" },

    // CENTER → DOWNSTREAM
    { source: "v", target: "amzn" },
    { source: "v", target: "wmt" },
    { source: "v", target: "shop" },
    { source: "v", target: "uber" },
    { source: "v", target: "abnb" }
  ]
},
RTX: {
  name: "RTX",
  root: "rtx",
  nodes: [
    // UPSTREAM LAYER 1 — PUBLICLY TRADED SUPPLIERS / ENABLERS
    { id: "ati", ticker: "ATI", name: "ATI", role: "specialty titanium, nickel, and superalloy producer serving aerospace manufacturing" },
    { id: "crs", ticker: "CRS", name: "Carpenter Technology", role: "specialty-alloy producer serving aerospace component manufacturing" },
    { id: "aa", ticker: "AA", name: "Alcoa", role: "aluminum producer serving aerospace structures and component supply chains" },
    { id: "hxl", ticker: "HXL", name: "Hexcel", role: "advanced composite-material supplier to aerospace manufacturers" },

    // UPSTREAM LAYER 2 — PUBLICLY TRADED DIRECT SUPPLIERS / PARTNERS
    { id: "hwm", ticker: "HWM", name: "Howmet Aerospace", role: "aerospace castings, forgings, fasteners, and engineered component supplier" },
    { id: "ph", ticker: "PH", name: "Parker-Hannifin", role: "aerospace motion, fuel, hydraulic, and control-system supplier" },
    { id: "etn", ticker: "ETN", name: "Eaton", role: "aerospace electrical, hydraulic, and power-management supplier" },
    { id: "txn", ticker: "TXN", name: "Texas Instruments", role: "analog semiconductor supplier used across aerospace electronics" },
    { id: "adi", ticker: "ADI", name: "Analog Devices", role: "high-performance analog and signal-processing supplier to aerospace electronics" },
    { id: "aph", ticker: "APH", name: "Amphenol", role: "aerospace connectors and interconnect systems supplier" },

    // CENTER
    { id: "rtx", ticker: "RTX", name: "RTX", role: "aerospace and defense company spanning Pratt & Whitney, Collins Aerospace, and Raytheon" },

    // DOWNSTREAM — PUBLICLY TRADED CUSTOMERS / CHANNELS / COUNTERPARTIES
    { id: "eadsy", ticker: "EADSY", name: "Airbus", role: "major commercial aerospace customer of Pratt & Whitney and Collins Aerospace; Airbus was RTX's largest commercial customer in 2025" },
    { id: "ba", ticker: "BA", name: "Boeing", role: "major commercial aerospace customer and platform partner" },
    { id: "lmt", ticker: "LMT", name: "Lockheed Martin", role: "major defense-prime customer and partner" },
    { id: "noc", ticker: "NOC", name: "Northrop Grumman", role: "major defense-prime customer and partner" },
    { id: "dal", ticker: "DAL", name: "Delta Air Lines", role: "airline operator purchasing and servicing RTX-powered aircraft and systems" },
    { id: "ual", ticker: "UAL", name: "United Airlines", role: "airline operator purchasing and servicing RTX-powered aircraft and systems" }
  ],

  edges: [
    // UPSTREAM LAYER 1 → LAYER 2
    { source: "ati", target: "hwm" },
    { source: "crs", target: "hwm" },
    { source: "aa", target: "ph" },
    { source: "hxl", target: "ph" },

    // UPSTREAM LAYER 2 → CENTER
    { source: "hwm", target: "rtx" },
    { source: "ph", target: "rtx" },
    { source: "etn", target: "rtx" },
    { source: "txn", target: "rtx" },
    { source: "adi", target: "rtx" },
    { source: "aph", target: "rtx" },

    // CENTER → DOWNSTREAM
    { source: "rtx", target: "eadsy" },
    { source: "rtx", target: "ba" },
    { source: "rtx", target: "lmt" },
    { source: "rtx", target: "noc" },
    { source: "rtx", target: "dal" },
    { source: "rtx", target: "ual" }
  ]
},
JPM: {
  name: "JPMorgan Chase",
  root: "jpm",
  nodes: [
    // UPSTREAM — PUBLICLY TRADED DIRECT SUPPLIERS / PARTNERS
    { id: "spgi", ticker: "SPGI", name: "S&P Global", role: "market data, ratings, index, and reference-data provider to capital-markets institutions" },
    { id: "mco", ticker: "MCO", name: "Moody's", role: "credit-ratings and risk-data provider to major banks" },
    { id: "msci", ticker: "MSCI", name: "MSCI", role: "index, portfolio, and risk-data provider to institutional finance" },
    { id: "fds", ticker: "FDS", name: "FactSet", role: "market-data and analytics provider to institutional finance" },
    { id: "msft", ticker: "MSFT", name: "Microsoft", role: "cloud, productivity, security, and enterprise-technology provider" },
    { id: "amzn", ticker: "AMZN", name: "Amazon", role: "AWS cloud and technology provider used across financial-services workloads" },
    { id: "cme", ticker: "CME", name: "CME Group", role: "derivatives exchange and clearing infrastructure used by the bank's markets businesses" },
    { id: "ice", ticker: "ICE", name: "Intercontinental Exchange", role: "exchange, clearing, and market-data infrastructure used by capital-markets businesses" },

    // CENTER
    { id: "jpm", ticker: "JPM", name: "JPMorgan Chase", role: "global banking, payments, markets, asset-management, and wealth-management platform" },

    // DOWNSTREAM — PUBLICLY TRADED CUSTOMERS / CHANNELS / COUNTERPARTIES
    { id: "amznc", ticker: "AMZN", name: "Amazon", role: "co-brand credit-card and payments partner through the Amazon/Chase relationship" },
    { id: "ual", ticker: "UAL", name: "United Airlines", role: "co-brand credit-card and loyalty partner" },
    { id: "mar", ticker: "MAR", name: "Marriott International", role: "co-brand credit-card and loyalty partner" },
    { id: "hyatt", ticker: "H", name: "Hyatt Hotels", role: "co-brand credit-card and loyalty partner" },
    { id: "dash", ticker: "DASH", name: "DoorDash", role: "co-brand and card-benefit partner" }
  ],

  edges: [
    // UPSTREAM → CENTER
    { source: "spgi", target: "jpm" },
    { source: "mco", target: "jpm" },
    { source: "msci", target: "jpm" },
    { source: "fds", target: "jpm" },
    { source: "msft", target: "jpm" },
    { source: "amzn", target: "jpm" },
    { source: "cme", target: "jpm" },
    { source: "ice", target: "jpm" },

    // CENTER → DOWNSTREAM
    { source: "jpm", target: "amznc" },
    { source: "jpm", target: "ual" },
    { source: "jpm", target: "mar" },
    { source: "jpm", target: "hyatt" },
    { source: "jpm", target: "dash" }
  ]
},
CVX: {
  name: "Chevron",
  root: "cvx",
  nodes: [
    // UPSTREAM — PUBLICLY TRADED DIRECT SUPPLIERS / PARTNERS
    { id: "slb", ticker: "SLB", name: "SLB", role: "oilfield services, drilling, completion, and reservoir-technology supplier" },
    { id: "hal", ticker: "HAL", name: "Halliburton", role: "oilfield services and completion supplier" },
    { id: "bkr", ticker: "BKR", name: "Baker Hughes", role: "oilfield equipment, services, and energy-technology supplier" },
    { id: "nov", ticker: "NOV", name: "NOV", role: "drilling, production, and oilfield equipment supplier" },
    { id: "ts", ticker: "TS", name: "Tenaris", role: "steel tubular and pipe supplier to oil and gas operations" },
    { id: "fti", ticker: "FTI", name: "TechnipFMC", role: "subsea production systems and project-services supplier" },
    { id: "emr", ticker: "EMR", name: "Emerson Electric", role: "process automation and industrial-control supplier" },
    { id: "hon", ticker: "HON", name: "Honeywell", role: "process automation, refining technology, and industrial-controls supplier" },

    // CENTER
    { id: "cvx", ticker: "CVX", name: "Chevron", role: "integrated energy company spanning upstream production, refining, chemicals, trading, and fuels" },

    // DOWNSTREAM — PUBLICLY TRADED CUSTOMERS / CHANNELS / COUNTERPARTIES
    { id: "ual", ticker: "UAL", name: "United Airlines", role: "public aviation-fuel end-market exposure; not represented as an exclusive direct customer" },
    { id: "dal", ticker: "DAL", name: "Delta Air Lines", role: "public aviation-fuel end-market exposure; not represented as an exclusive direct customer" },
    { id: "lyb", ticker: "LYB", name: "LyondellBasell", role: "public petrochemical end-market exposed to refinery and feedstock flows" },
    { id: "mpc", ticker: "MPC", name: "Marathon Petroleum", role: "public refining and product-market counterparty within U.S. energy markets" },
    { id: "vlo", ticker: "VLO", name: "Valero Energy", role: "public refining and product-market counterparty within U.S. energy markets" }
  ],

  edges: [
    // UPSTREAM → CENTER
    { source: "slb", target: "cvx" },
    { source: "hal", target: "cvx" },
    { source: "bkr", target: "cvx" },
    { source: "nov", target: "cvx" },
    { source: "ts", target: "cvx" },
    { source: "fti", target: "cvx" },
    { source: "emr", target: "cvx" },
    { source: "hon", target: "cvx" },

    // CENTER → DOWNSTREAM
    { source: "cvx", target: "ual" },
    { source: "cvx", target: "dal" },
    { source: "cvx", target: "lyb" },
    { source: "cvx", target: "mpc" },
    { source: "cvx", target: "vlo" }
  ]
},
KO: {
  name: "Coca-Cola",
  root: "ko",
  nodes: [
    // UPSTREAM — PUBLICLY TRADED DIRECT SUPPLIERS / PARTNERS
    { id: "adm", ticker: "ADM", name: "Archer-Daniels-Midland", role: "sweetener and agricultural-ingredient supplier to the beverage industry" },
    { id: "bg", ticker: "BG", name: "Bunge Global", role: "sugar and agricultural-commodity supplier to global food and beverage markets" },
    { id: "ingr", ticker: "INGR", name: "Ingredion", role: "sweetener and starch supplier to beverage manufacturers" },
    { id: "lin", ticker: "LIN", name: "Linde", role: "industrial-gas supplier, including food-and-beverage-grade carbon dioxide" },
    { id: "apd", ticker: "APD", name: "Air Products", role: "industrial-gas supplier serving food and beverage manufacturing" },
    { id: "ball", ticker: "BALL", name: "Ball", role: "aluminum beverage-can manufacturer serving global beverage systems" },
    { id: "cck", ticker: "CCK", name: "Crown Holdings", role: "metal beverage-can and packaging supplier" },
    { id: "oi", ticker: "OI", name: "O-I Glass", role: "glass-bottle manufacturer serving beverage companies" },

    // CENTER
    { id: "ko", ticker: "KO", name: "Coca-Cola", role: "global beverage company supplying concentrates, syrups, brands, and finished beverages through a bottling system" },

    // DOWNSTREAM — PUBLICLY TRADED CUSTOMERS / CHANNELS / COUNTERPARTIES
    { id: "ccep", ticker: "CCEP", name: "Coca-Cola Europacific Partners", role: "major publicly traded Coca-Cola bottler" },
    { id: "kof", ticker: "KOF", name: "Coca-Cola FEMSA", role: "major publicly traded Coca-Cola bottler" },
    { id: "cchgy", ticker: "CCHGY", name: "Coca-Cola HBC", role: "major publicly traded Coca-Cola bottler" },
    { id: "coke", ticker: "COKE", name: "Coca-Cola Consolidated", role: "largest U.S. Coca-Cola bottler" }
  ],

  edges: [
    // UPSTREAM → CENTER
    { source: "adm", target: "ko" },
    { source: "bg", target: "ko" },
    { source: "ingr", target: "ko" },
    { source: "lin", target: "ko" },
    { source: "apd", target: "ko" },
    { source: "ball", target: "ko" },
    { source: "cck", target: "ko" },
    { source: "oi", target: "ko" },

    // CENTER → DOWNSTREAM
    { source: "ko", target: "ccep" },
    { source: "ko", target: "kof" },
    { source: "ko", target: "cchgy" },
    { source: "ko", target: "coke" }
  ]
},
CAT: {
  name: "Caterpillar",
  root: "cat",
  nodes: [
    // UPSTREAM — PUBLICLY TRADED DIRECT SUPPLIERS / PARTNERS
    { id: "nue", ticker: "NUE", name: "Nucor", role: "major steel producer serving heavy-equipment manufacturing markets" },
    { id: "stld", ticker: "STLD", name: "Steel Dynamics", role: "steel producer serving industrial and heavy-equipment manufacturing" },
    { id: "mt", ticker: "MT", name: "ArcelorMittal", role: "global steel producer serving machinery and industrial supply chains" },
    { id: "dnsoy", ticker: "6902.T", name: "DENSO", role: "public automotive and industrial components manufacturer recognized in Caterpillar's supplier ecosystem" },
    { id: "cmi", ticker: "CMI", name: "Cummins", role: "engine and power-system supplier/partner across heavy-duty equipment markets" },
    { id: "bwa", ticker: "BWA", name: "BorgWarner", role: "drivetrain and powertrain component supplier to industrial and vehicle markets" },
    { id: "ph", ticker: "PH", name: "Parker-Hannifin", role: "hydraulic and motion-control supplier to heavy-equipment markets" },
    { id: "etn", ticker: "ETN", name: "Eaton", role: "hydraulic, electrical, and power-management supplier to industrial equipment" },

    // CENTER
    { id: "cat", ticker: "CAT", name: "Caterpillar", role: "heavy-equipment, engines, energy, mining, construction, and dealer-network manufacturer" },

    // DOWNSTREAM — PUBLICLY TRADED CUSTOMERS / CHANNELS / COUNTERPARTIES
    { id: "uri", ticker: "URI", name: "United Rentals", role: "major equipment-rental buyer and downstream construction-demand channel" },
    { id: "bhp", ticker: "BHP", name: "BHP", role: "major mining customer operating Caterpillar equipment fleets" },
    { id: "rio", ticker: "RIO", name: "Rio Tinto", role: "major mining customer and autonomous-haulage partner" },
    { id: "fcx", ticker: "FCX", name: "Freeport-McMoRan", role: "large mining operator and heavy-equipment demand source" },
    { id: "xom", ticker: "XOM", name: "Exxon Mobil", role: "large energy end-market for engines, turbines, and heavy equipment" },
    { id: "cvx", ticker: "CVX", name: "Chevron", role: "large energy end-market for engines and heavy equipment" }
  ],

  edges: [
    // UPSTREAM → CENTER
    { source: "nue", target: "cat" },
    { source: "stld", target: "cat" },
    { source: "mt", target: "cat" },
    { source: "dnsoy", target: "cat" },
    { source: "cmi", target: "cat" },
    { source: "bwa", target: "cat" },
    { source: "ph", target: "cat" },
    { source: "etn", target: "cat" },

    // CENTER → DOWNSTREAM
    { source: "cat", target: "uri" },
    { source: "cat", target: "bhp" },
    { source: "cat", target: "rio" },
    { source: "cat", target: "fcx" },
    { source: "cat", target: "xom" },
    { source: "cat", target: "cvx" }
  ]
},
CSCO: {
  name: "Cisco",
  root: "csco",
  nodes: [
    // UPSTREAM LAYER 1 — PUBLICLY TRADED SUPPLIERS / ENABLERS
    { id: "asml", ticker: "ASML", name: "ASML", role: "advanced lithography supplier to foundries manufacturing networking and compute silicon" },
    { id: "snps", ticker: "SNPS", name: "Synopsys", role: "EDA software provider used across semiconductor suppliers in Cisco's chip ecosystem" },
    { id: "cdns", ticker: "CDNS", name: "Cadence", role: "EDA software provider used across semiconductor suppliers in Cisco's chip ecosystem" },
    { id: "amat", ticker: "AMAT", name: "Applied Materials", role: "process-equipment supplier to semiconductor foundries" },

    // UPSTREAM LAYER 2 — PUBLICLY TRADED DIRECT SUPPLIERS / PARTNERS
    { id: "tsm", ticker: "TSM", name: "TSMC", role: "foundry manufacturing advanced networking and compute silicon used across Cisco's ecosystem" },
    { id: "avgo", ticker: "AVGO", name: "Broadcom", role: "merchant networking-silicon and connectivity supplier" },
    { id: "mrvl", ticker: "MRVL", name: "Marvell Technology", role: "networking and infrastructure-silicon supplier" },
    { id: "mu", ticker: "MU", name: "Micron", role: "memory supplier to networking and compute equipment manufacturers" },
    { id: "jbl", ticker: "JBL", name: "Jabil", role: "electronics manufacturing-services provider serving networking equipment" },
    { id: "flex", ticker: "FLEX", name: "Flex", role: "electronics manufacturing-services provider serving networking and communications equipment" },
    { id: "cls", ticker: "CLS", name: "Celestica", role: "electronics manufacturing and supply-chain partner serving networking equipment" },
    { id: "ttmi", ticker: "TTMI", name: "TTM Technologies", role: "printed-circuit-board and interconnect supplier" },

    // CENTER
    { id: "csco", ticker: "CSCO", name: "Cisco", role: "networking infrastructure, security, observability, and collaboration platform" },

    // DOWNSTREAM — PUBLICLY TRADED CUSTOMERS / CHANNELS / COUNTERPARTIES
    { id: "cdw", ticker: "CDW", name: "CDW", role: "major reseller and enterprise distribution channel for Cisco products" },
    { id: "snx", ticker: "SNX", name: "TD SYNNEX", role: "major global technology distributor carrying Cisco products" },
    { id: "arw", ticker: "ARW", name: "Arrow Electronics", role: "technology distribution and supply-chain channel" },
    { id: "acn", ticker: "ACN", name: "Accenture", role: "systems-integration partner deploying Cisco technology" },
    { id: "vz", ticker: "VZ", name: "Verizon", role: "major service-provider customer and networking partner" },
    { id: "att", ticker: "T", name: "AT&T", role: "major service-provider customer and networking partner" }
  ],

  edges: [
    // UPSTREAM LAYER 1 → LAYER 2
    { source: "asml", target: "tsm" },
    { source: "snps", target: "tsm" },
    { source: "cdns", target: "tsm" },
    { source: "amat", target: "tsm" },

    // UPSTREAM LAYER 2 → CENTER
    { source: "tsm", target: "csco" },
    { source: "avgo", target: "csco" },
    { source: "mrvl", target: "csco" },
    { source: "mu", target: "csco" },
    { source: "jbl", target: "csco" },
    { source: "flex", target: "csco" },
    { source: "cls", target: "csco" },
    { source: "ttmi", target: "csco" },

    // CENTER → DOWNSTREAM
    { source: "csco", target: "cdw" },
    { source: "csco", target: "snx" },
    { source: "csco", target: "arw" },
    { source: "csco", target: "acn" },
    { source: "csco", target: "vz" },
    { source: "csco", target: "att" }
  ]
},
MRK: {
  name: "Merck",
  root: "mrk",
  nodes: [
    // UPSTREAM — PUBLICLY TRADED DIRECT SUPPLIERS / PARTNERS
    { id: "tmo", ticker: "TMO", name: "Thermo Fisher Scientific", role: "life-science instruments, reagents, and bioprocessing supplier to large biopharma manufacturers" },
    { id: "dhr", ticker: "DHR", name: "Danaher", role: "bioprocessing and life-science technology supplier to pharmaceutical manufacturing" },
    { id: "agilent", ticker: "A", name: "Agilent Technologies", role: "analytical instruments and laboratory technology supplier to pharmaceutical R&D" },
    { id: "wat", ticker: "WAT", name: "Waters", role: "chromatography and analytical-instrument supplier to pharmaceutical laboratories" },
    { id: "azn", ticker: "AZN", name: "AstraZeneca", role: "public pharmaceutical partner in oncology and combination-therapy development" },
    { id: "esaly", ticker: "4523.T", name: "Eisai", role: "public pharmaceutical partner on oncology products including Lenvima/Keytruda combinations" },
    { id: "dsnky", ticker: "4568.T", name: "Daiichi Sankyo", role: "public oncology collaboration partner with Merck" },

    // CENTER
    { id: "mrk", ticker: "MRK", name: "Merck", role: "global pharmaceutical and animal-health manufacturer" },

    // DOWNSTREAM — PUBLICLY TRADED CUSTOMERS / CHANNELS / COUNTERPARTIES
    { id: "mck", ticker: "MCK", name: "McKesson", role: "authorized pharmaceutical wholesaler/distributor for Merck products" },
    { id: "cor", ticker: "COR", name: "Cencora", role: "authorized pharmaceutical wholesaler/distributor for Merck products" },
    { id: "cah", ticker: "CAH", name: "Cardinal Health", role: "authorized pharmaceutical wholesaler/distributor for Merck products" },
    { id: "hsic", ticker: "HSIC", name: "Henry Schein", role: "authorized healthcare distributor for selected Merck products" },
    { id: "cvs", ticker: "CVS", name: "CVS Health", role: "major U.S. pharmacy channel for Merck medicines" },
    { id: "hca", ticker: "HCA", name: "HCA Healthcare", role: "large institutional healthcare end-market for Merck medicines" }
  ],

  edges: [
    // UPSTREAM → CENTER
    { source: "tmo", target: "mrk" },
    { source: "dhr", target: "mrk" },
    { source: "agilent", target: "mrk" },
    { source: "wat", target: "mrk" },
    { source: "azn", target: "mrk" },
    { source: "esaly", target: "mrk" },
    { source: "dsnky", target: "mrk" },

    // CENTER → DOWNSTREAM
    { source: "mrk", target: "mck" },
    { source: "mrk", target: "cor" },
    { source: "mrk", target: "cah" },
    { source: "mrk", target: "hsic" },
    { source: "mrk", target: "cvs" },
    { source: "mrk", target: "hca" }
  ]
},
UNH: {
  name: "UnitedHealth Group",
  root: "unh",
  nodes: [
    // UPSTREAM LAYER 1 — PUBLICLY TRADED SUPPLIERS / ENABLERS
    { id: "pfe", ticker: "PFE", name: "Pfizer", role: "pharmaceutical manufacturer whose products flow through U.S. pharmacy-benefit channels" },
    { id: "mrk", ticker: "MRK", name: "Merck", role: "pharmaceutical manufacturer whose products flow through U.S. pharmacy-benefit channels" },
    { id: "lly", ticker: "LLY", name: "Eli Lilly", role: "pharmaceutical manufacturer with high-value diabetes, obesity, and specialty products" },
    { id: "nvo", ticker: "NVO", name: "Novo Nordisk", role: "pharmaceutical manufacturer with major diabetes and obesity products" },
    { id: "abbv", ticker: "ABBV", name: "AbbVie", role: "specialty pharmaceutical manufacturer" },
    { id: "bmy", ticker: "BMY", name: "Bristol Myers Squibb", role: "oncology and specialty pharmaceutical manufacturer" },
    { id: "teva", ticker: "TEVA", name: "Teva Pharmaceutical", role: "large generic-drug manufacturer" },
    { id: "vtrs", ticker: "VTRS", name: "Viatris", role: "generic and biosimilar drug manufacturer" },

    // UPSTREAM LAYER 2 — PUBLICLY TRADED DIRECT SUPPLIERS / PARTNERS
    { id: "mck", ticker: "MCK", name: "McKesson", role: "large drug distributor serving pharmacy and provider networks" },
    { id: "cor", ticker: "COR", name: "Cencora", role: "large specialty and pharmaceutical distributor" },
    { id: "cah", ticker: "CAH", name: "Cardinal Health", role: "large hospital and pharmacy distributor" },
    { id: "hca", ticker: "HCA", name: "HCA Healthcare", role: "large provider network counterparty in commercial and Medicare care markets" },
    { id: "thc", ticker: "THC", name: "Tenet Healthcare", role: "public hospital and ambulatory-care provider" },
    { id: "cvs", ticker: "CVS", name: "CVS Health", role: "large pharmacy and healthcare counterparty in the U.S. benefit ecosystem" },

    // CENTER
    { id: "unh", ticker: "UNH", name: "UnitedHealth Group", role: "health benefits, Optum health services, pharmacy benefits, care delivery, and data/technology platform" },

    // DOWNSTREAM — PUBLICLY TRADED CUSTOMERS / CHANNELS / COUNTERPARTIES
    { id: "ci", ticker: "CI", name: "The Cigna Group", role: "public health-benefits and PBM counterparty in U.S. healthcare markets" },
    { id: "hum", ticker: "HUM", name: "Humana", role: "public Medicare and health-benefits counterparty in U.S. healthcare markets" }
  ],

  edges: [
    // UPSTREAM LAYER 1 → LAYER 2
    { source: "pfe", target: "mck" },
    { source: "mrk", target: "cah" },
    { source: "lly", target: "mck" },
    { source: "nvo", target: "cor" },
    { source: "abbv", target: "cah" },
    { source: "bmy", target: "cor" },
    { source: "teva", target: "mck" },
    { source: "vtrs", target: "cor" },

    // UPSTREAM LAYER 2 → CENTER
    { source: "mck", target: "unh" },
    { source: "cor", target: "unh" },
    { source: "cah", target: "unh" },
    { source: "hca", target: "unh" },
    { source: "thc", target: "unh" },
    { source: "cvs", target: "unh" },

    // CENTER → DOWNSTREAM
    { source: "unh", target: "ci" },
    { source: "unh", target: "hum" }
  ]
},
GS: {
  name: "Goldman Sachs",
  root: "gs",
  nodes: [
    // UPSTREAM — PUBLICLY TRADED DIRECT SUPPLIERS / PARTNERS
    { id: "spgi", ticker: "SPGI", name: "S&P Global", role: "ratings, indices, market data, and analytics provider used across capital markets" },
    { id: "mco", ticker: "MCO", name: "Moody's", role: "credit-ratings and risk-data provider used across capital markets" },
    { id: "msci", ticker: "MSCI", name: "MSCI", role: "index, portfolio, and risk-data provider" },
    { id: "fds", ticker: "FDS", name: "FactSet", role: "market-data and analytics provider to institutional financial firms" },
    { id: "cme", ticker: "CME", name: "CME Group", role: "derivatives exchange and clearing infrastructure" },
    { id: "ice", ticker: "ICE", name: "Intercontinental Exchange", role: "exchange, clearing, and market-data infrastructure" },
    { id: "cboe", ticker: "CBOE", name: "Cboe Global Markets", role: "options and securities exchange infrastructure" },
    { id: "eqix", ticker: "EQIX", name: "Equinix", role: "colocation and interconnection infrastructure supporting low-latency financial systems" },

    // CENTER
    { id: "gs", ticker: "GS", name: "Goldman Sachs", role: "investment banking, markets, asset management, wealth management, and financing platform" },

    // DOWNSTREAM — PUBLICLY TRADED CUSTOMERS / CHANNELS / COUNTERPARTIES
    { id: "nvda", ticker: "NVDA", name: "NVIDIA", role: "public company participating with Goldman in AI-infrastructure financing initiatives" },
    { id: "blk", ticker: "BLK", name: "BlackRock", role: "public asset manager participating in large infrastructure and capital-markets transactions" },
    { id: "bx", ticker: "BX", name: "Blackstone", role: "public alternative-asset manager and frequent capital-markets counterparty" },
    { id: "apo", ticker: "APO", name: "Apollo Global Management", role: "public alternative-asset manager and financing counterparty" },
    { id: "kkr", ticker: "KKR", name: "KKR", role: "public alternative-asset manager and capital-markets counterparty" },
    { id: "bam", ticker: "BAM", name: "Brookfield Asset Management", role: "public infrastructure and alternative-asset manager" }
  ],

  edges: [
    // UPSTREAM → CENTER
    { source: "spgi", target: "gs" },
    { source: "mco", target: "gs" },
    { source: "msci", target: "gs" },
    { source: "fds", target: "gs" },
    { source: "cme", target: "gs" },
    { source: "ice", target: "gs" },
    { source: "cboe", target: "gs" },
    { source: "eqix", target: "gs" },

    // CENTER → DOWNSTREAM
    { source: "gs", target: "nvda" },
    { source: "gs", target: "blk" },
    { source: "gs", target: "bx" },
    { source: "gs", target: "apo" },
    { source: "gs", target: "kkr" },
    { source: "gs", target: "bam" }
  ]
},
IBM: {
  name: "IBM",
  root: "ibm",
  nodes: [
    // UPSTREAM LAYER 1 — PUBLICLY TRADED SUPPLIERS / ENABLERS
    { id: "asml", ticker: "ASML", name: "ASML", role: "lithography supplier to foundries producing advanced processors used in IBM systems and partner platforms" },
    { id: "tsm", ticker: "TSM", name: "TSMC", role: "foundry supporting advanced processors used by IBM technology partners" },

    // UPSTREAM LAYER 2 — PUBLICLY TRADED DIRECT SUPPLIERS / PARTNERS
    { id: "samsung", ticker: "005930.KS", name: "Samsung Electronics", role: "semiconductor manufacturing and strategic technology partner" },
    { id: "nvda", ticker: "NVDA", name: "NVIDIA", role: "AI accelerator and software ecosystem partner" },
    { id: "avgo", ticker: "AVGO", name: "Broadcom", role: "semiconductor and enterprise software ecosystem partner" },
    { id: "mu", ticker: "MU", name: "Micron", role: "memory supplier to enterprise hardware ecosystems" },
    { id: "amzn", ticker: "AMZN", name: "Amazon", role: "AWS strategic cloud partner" },
    { id: "msft", ticker: "MSFT", name: "Microsoft", role: "Azure and enterprise software strategic partner" },
    { id: "orcl", ticker: "ORCL", name: "Oracle", role: "enterprise platform and consulting ecosystem partner" },
    { id: "sap", ticker: "SAP", name: "SAP", role: "enterprise software and consulting ecosystem partner" },

    // CENTER
    { id: "ibm", ticker: "IBM", name: "IBM", role: "hybrid cloud, AI software, consulting, mainframes, and enterprise infrastructure" },

    // DOWNSTREAM — PUBLICLY TRADED CUSTOMERS / CHANNELS / COUNTERPARTIES
    { id: "crm", ticker: "CRM", name: "Salesforce", role: "enterprise platform IBM Consulting implements for customers" },
    { id: "now", ticker: "NOW", name: "ServiceNow", role: "workflow platform partner delivered through IBM Consulting" },
    { id: "adbe", ticker: "ADBE", name: "Adobe", role: "digital-experience technology partner" },
    { id: "panw", ticker: "PANW", name: "Palo Alto Networks", role: "cybersecurity technology partner" }
  ],

  edges: [
    // UPSTREAM LAYER 1 → LAYER 2
    { source: "asml", target: "tsm" },
    { source: "tsm", target: "nvda" },
    { source: "tsm", target: "avgo" },

    // UPSTREAM LAYER 2 → CENTER
    { source: "samsung", target: "ibm" },
    { source: "nvda", target: "ibm" },
    { source: "avgo", target: "ibm" },
    { source: "mu", target: "ibm" },
    { source: "amzn", target: "ibm" },
    { source: "msft", target: "ibm" },
    { source: "orcl", target: "ibm" },
    { source: "sap", target: "ibm" },

    // CENTER → DOWNSTREAM
    { source: "ibm", target: "crm" },
    { source: "ibm", target: "now" },
    { source: "ibm", target: "adbe" },
    { source: "ibm", target: "panw" }
  ]
},
MCD: {
  name: "McDonald's",
  root: "mcd",
  nodes: [
    // UPSTREAM — PUBLICLY TRADED DIRECT SUPPLIERS / PARTNERS
    { id: "tsn", ticker: "TSN", name: "Tyson Foods", role: "major public poultry supplier to McDonald's in North America" },
    { id: "lw", ticker: "LW", name: "Lamb Weston", role: "major public potato and fries supplier with material McDonald's exposure" },
    { id: "ko", ticker: "KO", name: "Coca-Cola", role: "long-standing beverage-system supplier and strategic partner" },
    { id: "googl", ticker: "GOOGL", name: "Alphabet", role: "Google Cloud technology partner for restaurant and digital infrastructure" },

    // CENTER
    { id: "mcd", ticker: "MCD", name: "McDonald's", role: "global quick-service restaurant franchisor, operator, supplier manager, and digital ordering platform" },

    // DOWNSTREAM — PUBLICLY TRADED CUSTOMERS / CHANNELS / COUNTERPARTIES
    { id: "arco", ticker: "ARCO", name: "Arcos Dorados", role: "public master franchisee operating McDonald's restaurants across Latin America and the Caribbean" },
    { id: "uber", ticker: "UBER", name: "Uber", role: "delivery-platform partner through Uber Eats" },
    { id: "dash", ticker: "DASH", name: "DoorDash", role: "delivery-platform partner" }
  ],

  edges: [
    // UPSTREAM → CENTER
    { source: "tsn", target: "mcd" },
    { source: "lw", target: "mcd" },
    { source: "ko", target: "mcd" },
    { source: "googl", target: "mcd" },

    // CENTER → DOWNSTREAM
    { source: "mcd", target: "arco" },
    { source: "mcd", target: "uber" },
    { source: "mcd", target: "dash" }
  ]
},
VZ: {
  name: "Verizon",
  root: "vz",
  nodes: [
    // UPSTREAM — PUBLICLY TRADED DIRECT SUPPLIERS / PARTNERS
    { id: "eric", ticker: "ERIC", name: "Ericsson", role: "major 5G radio-access-network and telecom-equipment supplier to Verizon" },
    { id: "nok", ticker: "NOK", name: "Nokia", role: "major network-equipment and private-wireless technology supplier" },
    { id: "samsung", ticker: "005930.KS", name: "Samsung Electronics", role: "network-equipment and device supplier to Verizon" },
    { id: "qcom", ticker: "QCOM", name: "Qualcomm", role: "device and wireless-chip ecosystem partner supporting Verizon-compatible devices" },
    { id: "amt", ticker: "AMT", name: "American Tower", role: "wireless-tower infrastructure provider serving Verizon" },
    { id: "sbac", ticker: "SBAC", name: "SBA Communications", role: "wireless-tower infrastructure provider serving major U.S. carriers" },
    { id: "glw", ticker: "GLW", name: "Corning", role: "fiber-optic cable and connectivity supplier to Verizon's broadband network" },
    { id: "csco", ticker: "CSCO", name: "Cisco", role: "network routing, security, and enterprise infrastructure supplier" },

    // CENTER
    { id: "vz", ticker: "VZ", name: "Verizon", role: "wireless, fiber broadband, enterprise connectivity, and communications network operator" },

    // DOWNSTREAM — PUBLICLY TRADED CUSTOMERS / CHANNELS / COUNTERPARTIES
    { id: "chtr", ticker: "CHTR", name: "Charter Communications", role: "wholesale/MVNO partner using Verizon's network for Spectrum Mobile" },
    { id: "cmcsa", ticker: "CMCSA", name: "Comcast", role: "wholesale/MVNO partner using Verizon's network for Xfinity Mobile" },
    { id: "asts", ticker: "ASTS", name: "AST SpaceMobile", role: "satellite-to-device connectivity partner in Verizon's network ecosystem" }
  ],

  edges: [
    // UPSTREAM → CENTER
    { source: "eric", target: "vz" },
    { source: "nok", target: "vz" },
    { source: "samsung", target: "vz" },
    { source: "qcom", target: "vz" },
    { source: "amt", target: "vz" },
    { source: "sbac", target: "vz" },
    { source: "glw", target: "vz" },
    { source: "csco", target: "vz" },

    // CENTER → DOWNSTREAM
    { source: "vz", target: "chtr" },
    { source: "vz", target: "cmcsa" },
    { source: "vz", target: "asts" }
  ]
},
AXP: {
  name: "American Express",
  root: "axp",
  nodes: [
    // UPSTREAM — PUBLICLY TRADED DIRECT SUPPLIERS / PARTNERS
    { id: "fis", ticker: "FIS", name: "FIS", role: "banking and payment-processing technology provider" },
    { id: "fi", ticker: "FI", name: "Fiserv", role: "merchant-acquiring and payment-processing technology provider" },
    { id: "gpn", ticker: "GPN", name: "Global Payments", role: "merchant-acquiring and payment-processing company" },
    { id: "pypl", ticker: "PYPL", name: "PayPal", role: "digital-payments ecosystem partner" },
    { id: "shop", ticker: "SHOP", name: "Shopify", role: "commerce-platform partner supporting merchant acceptance" },
    { id: "msft", ticker: "MSFT", name: "Microsoft", role: "enterprise cloud and productivity technology provider" },
    { id: "amzn", ticker: "AMZN", name: "Amazon", role: "AWS cloud provider and major merchant partner" },

    // CENTER
    { id: "axp", ticker: "AXP", name: "American Express", role: "global payments, card issuing, merchant acquiring, travel, and premium financial-services platform" },

    // DOWNSTREAM — PUBLICLY TRADED CUSTOMERS / CHANNELS / COUNTERPARTIES
    { id: "dal", ticker: "DAL", name: "Delta Air Lines", role: "major co-brand card and loyalty partner" },
    { id: "mar", ticker: "MAR", name: "Marriott International", role: "major co-brand card and loyalty partner" },
    { id: "hlt", ticker: "HLT", name: "Hilton Worldwide", role: "major co-brand card and loyalty partner" },
    { id: "icagy", ticker: "ICAGY", name: "International Airlines Group", role: "British Airways parent and co-brand/loyalty partner" },
    { id: "coin", ticker: "COIN", name: "Coinbase", role: "public fintech/card partnership counterparty" },
    { id: "gbtg", ticker: "GBTG", name: "American Express Global Business Travel", role: "public travel-management company using the American Express brand under commercial agreements" }
  ],

  edges: [
    // UPSTREAM → CENTER
    { source: "fis", target: "axp" },
    { source: "fi", target: "axp" },
    { source: "gpn", target: "axp" },
    { source: "pypl", target: "axp" },
    { source: "shop", target: "axp" },
    { source: "msft", target: "axp" },
    { source: "amzn", target: "axp" },

    // CENTER → DOWNSTREAM
    { source: "axp", target: "dal" },
    { source: "axp", target: "mar" },
    { source: "axp", target: "hlt" },
    { source: "axp", target: "icagy" },
    { source: "axp", target: "coin" },
    { source: "axp", target: "gbtg" }
  ]
},
AMGN: {
  name: "Amgen",
  root: "amgn",
  nodes: [
    // UPSTREAM — PUBLICLY TRADED DIRECT SUPPLIERS / PARTNERS
    { id: "tmo", ticker: "TMO", name: "Thermo Fisher Scientific", role: "bioprocessing, analytical, and life-science supplier to biopharmaceutical manufacturing" },
    { id: "wst", ticker: "WST", name: "West Pharmaceutical Services", role: "injectable-drug containment and delivery-system supplier to biopharma manufacturers" },
    { id: "bdx", ticker: "BDX", name: "Becton, Dickinson", role: "drug-delivery device and medical-technology supplier" },
    { id: "azn", ticker: "AZN", name: "AstraZeneca", role: "public collaboration partner with Amgen on selected respiratory and biologic programs" },

    // CENTER
    { id: "amgn", ticker: "AMGN", name: "Amgen", role: "global biotechnology company focused on biologic medicines" },

    // DOWNSTREAM — PUBLICLY TRADED CUSTOMERS / CHANNELS / COUNTERPARTIES
    { id: "mck", ticker: "MCK", name: "McKesson", role: "major U.S. pharmaceutical wholesaler distributing Amgen products" },
    { id: "cor", ticker: "COR", name: "Cencora", role: "major specialty pharmaceutical distributor" },
    { id: "cah", ticker: "CAH", name: "Cardinal Health", role: "major pharmaceutical wholesaler" },
    { id: "cvs", ticker: "CVS", name: "CVS Health", role: "major pharmacy and specialty-pharmacy channel" },
    { id: "ci", ticker: "CI", name: "The Cigna Group", role: "major payer/PBM counterparty through Evernorth/Express Scripts" },
    { id: "unh", ticker: "UNH", name: "UnitedHealth Group", role: "major payer/PBM counterparty through Optum Rx" }
  ],

  edges: [
    // UPSTREAM → CENTER
    { source: "tmo", target: "amgn" },
    { source: "wst", target: "amgn" },
    { source: "bdx", target: "amgn" },
    { source: "azn", target: "amgn" },

    // CENTER → DOWNSTREAM
    { source: "amgn", target: "mck" },
    { source: "amgn", target: "cor" },
    { source: "amgn", target: "cah" },
    { source: "amgn", target: "cvs" },
    { source: "amgn", target: "ci" },
    { source: "amgn", target: "unh" }
  ]
},
CRM: {
  name: "Salesforce",
  root: "crm",
  nodes: [
    // UPSTREAM LAYER 1 — PUBLICLY TRADED SUPPLIERS / ENABLERS
    { id: "nvda", ticker: "NVDA", name: "NVIDIA", role: "AI infrastructure supplier underpinning public-cloud capacity used by Salesforce" },
    { id: "tsm", ticker: "TSM", name: "TSMC", role: "foundry manufacturing advanced processors used by Salesforce cloud partners" },

    // UPSTREAM LAYER 2 — PUBLICLY TRADED DIRECT SUPPLIERS / PARTNERS
    { id: "amzn", ticker: "AMZN", name: "Amazon", role: "AWS cloud infrastructure and strategic platform partner" },
    { id: "msft", ticker: "MSFT", name: "Microsoft", role: "Azure and enterprise-interoperability partner" },
    { id: "googl", ticker: "GOOGL", name: "Alphabet", role: "Google Cloud strategic infrastructure and data partner" },
    { id: "snow", ticker: "SNOW", name: "Snowflake", role: "data-cloud integration and enterprise-data partner" },
    { id: "wday", ticker: "WDAY", name: "Workday", role: "enterprise application and data integration partner" },

    // CENTER
    { id: "crm", ticker: "CRM", name: "Salesforce", role: "enterprise CRM, data cloud, AI, application platform, and ecosystem" },

    // DOWNSTREAM — PUBLICLY TRADED CUSTOMERS / CHANNELS / COUNTERPARTIES
    { id: "acn", ticker: "ACN", name: "Accenture", role: "major Salesforce systems-integration and implementation partner" },
    { id: "ibm", ticker: "IBM", name: "IBM", role: "major Salesforce consulting and implementation partner" },
    { id: "ctsh", ticker: "CTSH", name: "Cognizant", role: "Salesforce systems-integration partner" },
    { id: "infy", ticker: "INFY", name: "Infosys", role: "Salesforce consulting and implementation partner" },
    { id: "wit", ticker: "WIT", name: "Wipro", role: "Salesforce consulting and implementation partner" }
  ],

  edges: [
    // UPSTREAM LAYER 1 → LAYER 2
    { source: "tsm", target: "nvda" },
    { source: "nvda", target: "amzn" },
    { source: "nvda", target: "msft" },
    { source: "nvda", target: "googl" },

    // UPSTREAM LAYER 2 → CENTER
    { source: "amzn", target: "crm" },
    { source: "msft", target: "crm" },
    { source: "googl", target: "crm" },
    { source: "snow", target: "crm" },
    { source: "wday", target: "crm" },

    // CENTER → DOWNSTREAM
    { source: "crm", target: "acn" },
    { source: "crm", target: "ibm" },
    { source: "crm", target: "ctsh" },
    { source: "crm", target: "infy" },
    { source: "crm", target: "wit" }
  ]
},
DIS: {
  name: "Disney",
  root: "dis",
  nodes: [
    // UPSTREAM — PUBLICLY TRADED DIRECT SUPPLIERS / PARTNERS
    { id: "amzn", ticker: "AMZN", name: "Amazon", role: "AWS technology provider used across media and streaming workloads" },
    { id: "googl", ticker: "GOOGL", name: "Alphabet", role: "technology, advertising, and platform-distribution partner" },
    { id: "msft", ticker: "MSFT", name: "Microsoft", role: "enterprise cloud and productivity technology provider" },
    { id: "adsk", ticker: "ADSK", name: "Autodesk", role: "media-production and design-software supplier used across entertainment workflows" },
    { id: "dlb", ticker: "DLB", name: "Dolby Laboratories", role: "audio and imaging technology partner across theatrical and streaming distribution" },
    { id: "tko", ticker: "TKO", name: "TKO Group", role: "sports-rights and content counterparty through UFC/WWE-related programming ecosystems" },

    // CENTER
    { id: "dis", ticker: "DIS", name: "Disney", role: "global entertainment company spanning streaming, studios, sports, television, consumer products, and experiences" },

    // DOWNSTREAM — PUBLICLY TRADED CUSTOMERS / CHANNELS / COUNTERPARTIES
    { id: "chtr", ticker: "CHTR", name: "Charter Communications", role: "major pay-TV distribution partner" },
    { id: "cmcsa", ticker: "CMCSA", name: "Comcast", role: "major pay-TV and media-distribution partner" },
    { id: "aapl", ticker: "AAPL", name: "Apple", role: "device/app-store distribution platform for Disney streaming services" },
    { id: "roku", ticker: "ROKU", name: "Roku", role: "connected-TV distribution platform for Disney streaming services" },
    { id: "wmt", ticker: "WMT", name: "Walmart", role: "major retail channel for Disney consumer products and licensing" },
    { id: "bkng", ticker: "BKNG", name: "Booking Holdings", role: "large travel-distribution ecosystem exposed to Disney destination demand" }
  ],

  edges: [
    // UPSTREAM → CENTER
    { source: "amzn", target: "dis" },
    { source: "googl", target: "dis" },
    { source: "msft", target: "dis" },
    { source: "adsk", target: "dis" },
    { source: "dlb", target: "dis" },
    { source: "tko", target: "dis" },

    // CENTER → DOWNSTREAM
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
    // UPSTREAM — PUBLICLY TRADED DIRECT SUPPLIERS / PARTNERS
    { id: "ati", ticker: "ATI", name: "ATI", role: "titanium and specialty-alloy supplier to aerospace manufacturers" },
    { id: "crs", ticker: "CRS", name: "Carpenter Technology", role: "specialty-alloy supplier to aerospace manufacturing" },
    { id: "hwm", ticker: "HWM", name: "Howmet Aerospace", role: "aerospace castings, forgings, fasteners, and engineered component supplier" },
    { id: "ge", ticker: "GE", name: "GE Aerospace", role: "jet-engine supplier for Boeing commercial aircraft programs" },
    { id: "rtx", ticker: "RTX", name: "RTX", role: "Pratt & Whitney engine and Collins Aerospace systems supplier across Boeing programs" },
    { id: "hon", ticker: "HON", name: "Honeywell", role: "APU, avionics, flight-control, and aerospace-systems supplier" },
    { id: "tdg", ticker: "TDG", name: "TransDigm", role: "engineered aerospace component supplier" },
    { id: "ph", ticker: "PH", name: "Parker-Hannifin", role: "hydraulic, fuel, and motion-control systems supplier" },

    // CENTER
    { id: "ba", ticker: "BA", name: "Boeing", role: "commercial aircraft, defense, space, and services manufacturer" },

    // DOWNSTREAM — PUBLICLY TRADED CUSTOMERS / CHANNELS / COUNTERPARTIES
    { id: "ual", ticker: "UAL", name: "United Airlines", role: "major Boeing airline customer and fleet operator" },
    { id: "aal", ticker: "AAL", name: "American Airlines", role: "major Boeing airline customer and fleet operator" },
    { id: "luv", ticker: "LUV", name: "Southwest Airlines", role: "major Boeing 737 customer and operator" },
    { id: "fdx", ticker: "FDX", name: "FedEx", role: "major Boeing cargo-aircraft customer/operator" },
    { id: "ups", ticker: "UPS", name: "UPS", role: "major Boeing cargo-aircraft customer/operator" },
    { id: "aer", ticker: "AER", name: "AerCap", role: "major public aircraft lessor and Boeing customer" }
  ],

  edges: [
    // UPSTREAM → CENTER
    { source: "ati", target: "ba" },
    { source: "crs", target: "ba" },
    { source: "hwm", target: "ba" },
    { source: "ge", target: "ba" },
    { source: "rtx", target: "ba" },
    { source: "hon", target: "ba" },
    { source: "tdg", target: "ba" },
    { source: "ph", target: "ba" },

    // CENTER → DOWNSTREAM
    { source: "ba", target: "ual" },
    { source: "ba", target: "aal" },
    { source: "ba", target: "luv" },
    { source: "ba", target: "fdx" },
    { source: "ba", target: "ups" },
    { source: "ba", target: "aer" }
  ]
},
HON: {
  name: "Honeywell",
  root: "hon",
  nodes: [
    // UPSTREAM LAYER 1 — PUBLICLY TRADED SUPPLIERS / ENABLERS
    { id: "ati", ticker: "ATI", name: "ATI", role: "specialty-alloy producer serving aerospace and industrial manufacturing" },
    { id: "crs", ticker: "CRS", name: "Carpenter Technology", role: "specialty-alloy producer serving aerospace and industrial component manufacturing" },
    { id: "hwm", ticker: "HWM", name: "Howmet Aerospace", role: "aerospace castings and engineered components supplier" },
    { id: "nue", ticker: "NUE", name: "Nucor", role: "steel producer serving industrial and building-system supply chains" },
    { id: "dow", ticker: "DOW", name: "Dow", role: "specialty chemical and polymer supplier to industrial manufacturing" },
    { id: "dd", ticker: "DD", name: "DuPont", role: "specialty materials supplier to industrial and electronics manufacturing" },
    { id: "lin", ticker: "LIN", name: "Linde", role: "industrial-gas supplier to manufacturing and process industries" },
    { id: "apd", ticker: "APD", name: "Air Products", role: "industrial-gas supplier to manufacturing and process industries" },

    // UPSTREAM LAYER 2 — PUBLICLY TRADED DIRECT SUPPLIERS / PARTNERS
    { id: "txn", ticker: "TXN", name: "Texas Instruments", role: "analog semiconductor supplier used in industrial and aerospace electronics" },
    { id: "adi", ticker: "ADI", name: "Analog Devices", role: "analog, sensing, and signal-processing supplier used in industrial controls" },
    { id: "aph", ticker: "APH", name: "Amphenol", role: "connectors and interconnect systems supplier across aerospace and industrial markets" },

    // CENTER
    { id: "hon", ticker: "HON", name: "Honeywell", role: "aerospace, building automation, industrial process technology, energy solutions, and advanced materials company" },

    // DOWNSTREAM — PUBLICLY TRADED CUSTOMERS / CHANNELS / COUNTERPARTIES
    { id: "ba", ticker: "BA", name: "Boeing", role: "major aerospace OEM customer and platform partner" },
    { id: "rtx", ticker: "RTX", name: "RTX", role: "major aerospace and defense customer/partner" },
    { id: "eadsy", ticker: "EADSY", name: "Airbus", role: "major commercial aerospace customer" },
    { id: "cbre", ticker: "CBRE", name: "CBRE Group", role: "building-services and automation ecosystem customer/partner" },
    { id: "carr", ticker: "CARR", name: "Carrier Global", role: "building-controls and HVAC ecosystem counterparty" },
    { id: "cvx", ticker: "CVX", name: "Chevron", role: "industrial-process and refining-technology customer/end market" },
    { id: "xom", ticker: "XOM", name: "Exxon Mobil", role: "industrial-process and refining-technology customer/end market" }
  ],

  edges: [
    // UPSTREAM LAYER 1 → LAYER 2
    { source: "ati", target: "aph" },
    { source: "crs", target: "aph" },
    { source: "hwm", target: "aph" },
    { source: "dow", target: "txn" },
    { source: "dd", target: "adi" },
    { source: "lin", target: "aph" },
    { source: "apd", target: "aph" },

    // UPSTREAM LAYER 2 → CENTER
    { source: "txn", target: "hon" },
    { source: "adi", target: "hon" },
    { source: "aph", target: "hon" },

    // CENTER → DOWNSTREAM
    { source: "hon", target: "ba" },
    { source: "hon", target: "rtx" },
    { source: "hon", target: "eadsy" },
    { source: "hon", target: "cbre" },
    { source: "hon", target: "carr" },
    { source: "hon", target: "cvx" },
    { source: "hon", target: "xom" }
  ]
},
NKE: {
  name: "Nike",
  root: "nke",
  nodes: [
    // UPSTREAM LAYER 1 — PUBLICLY TRADED SUPPLIERS / ENABLERS
    { id: "dow", ticker: "DOW", name: "Dow", role: "public producer of polymer and chemical inputs used across synthetic footwear and apparel materials" },
    { id: "hun", ticker: "HUN", name: "Huntsman", role: "polyurethane and specialty-chemical producer serving footwear and textile materials" },
    { id: "basfy", ticker: "BAS.DE", name: "BASF", role: "TPU, performance-foam, and chemical-material supplier to footwear and apparel markets" },
    { id: "fenc", ticker: "1402.TW", name: "Far Eastern New Century", role: "public polyester, recycled-fiber, and textile-material producer serving global apparel brands" },
    { id: "avy", ticker: "AVY", name: "Avery Dennison", role: "labels, trims, and materials supplier to global apparel supply chains" },

    // UPSTREAM LAYER 2 — PUBLICLY TRADED DIRECT SUPPLIERS / PARTNERS
    { id: "fengtay", ticker: "9910.TW", name: "Feng Tay Enterprises", role: "public footwear manufacturer with long-term Nike manufacturing contracts" },
    { id: "pouchen", ticker: "9904.TW", name: "Pou Chen", role: "public footwear manufacturer operating major contract-production capacity for global athletic brands" },
    { id: "shenzhou", ticker: "2313.HK", name: "Shenzhou International", role: "public apparel manufacturer serving major global sportswear brands" },
    { id: "eclat", ticker: "1476.TW", name: "Eclat Textile", role: "public performance-fabric and apparel manufacturer serving global athletic brands" },

    // CENTER
    { id: "nke", ticker: "NKE", name: "Nike", role: "global athletic footwear, apparel, equipment, and digital-commerce brand" },

    // DOWNSTREAM — PUBLICLY TRADED CUSTOMERS / CHANNELS / COUNTERPARTIES
    { id: "dks", ticker: "DKS", name: "Dick's Sporting Goods", role: "major U.S. wholesale retail partner for Nike products" },
    { id: "jd", ticker: "JD.L", name: "JD Sports Fashion", role: "major global athletic-footwear and apparel retail partner" },
    { id: "amzn", ticker: "AMZN", name: "Amazon", role: "renewed direct U.S. retail channel for Nike products" },
    { id: "m", ticker: "M", name: "Macy's", role: "public department-store retail channel for Nike products" }
  ],

  edges: [
    // UPSTREAM LAYER 1 → LAYER 2
    { source: "dow", target: "fengtay" },
    { source: "hun", target: "fengtay" },
    { source: "basfy", target: "pouchen" },
    { source: "fenc", target: "shenzhou" },
    { source: "fenc", target: "eclat" },
    { source: "avy", target: "shenzhou" },

    // UPSTREAM LAYER 2 → CENTER
    { source: "fengtay", target: "nke" },
    { source: "pouchen", target: "nke" },
    { source: "shenzhou", target: "nke" },
    { source: "eclat", target: "nke" },

    // CENTER → DOWNSTREAM
    { source: "nke", target: "dks" },
    { source: "nke", target: "jd" },
    { source: "nke", target: "amzn" },
    { source: "nke", target: "m" }
  ]
},
SHW: {
  name: "Sherwin-Williams",
  root: "shw",
  nodes: [
    // UPSTREAM — PUBLICLY TRADED DIRECT SUPPLIERS / PARTNERS
    { id: "cc", ticker: "CC", name: "Chemours", role: "titanium-dioxide and specialty-chemicals producer serving coatings markets" },
    { id: "trox", ticker: "TROX", name: "Tronox", role: "titanium-dioxide pigment producer serving coatings manufacturers" },
    { id: "kro", ticker: "KRO", name: "Kronos Worldwide", role: "titanium-dioxide pigment producer serving coatings manufacturers" },
    { id: "dow", ticker: "DOW", name: "Dow", role: "resins, solvents, and chemical inputs supplier to coatings markets" },
    { id: "lyb", ticker: "LYB", name: "LyondellBasell", role: "petrochemical and resin producer serving coatings and packaging markets" },
    { id: "emn", ticker: "EMN", name: "Eastman Chemical", role: "specialty additives, solvents, and resin inputs supplier" },
    { id: "ce", ticker: "CE", name: "Celanese", role: "specialty-materials and polymer supplier to coatings markets" },
    { id: "cck", ticker: "CCK", name: "Crown Holdings", role: "metal packaging producer serving paint and coatings packaging markets" },

    // CENTER
    { id: "shw", ticker: "SHW", name: "Sherwin-Williams", role: "paint, coatings, finishes, and related products manufacturer and retailer" },

    // DOWNSTREAM — PUBLICLY TRADED CUSTOMERS / CHANNELS / COUNTERPARTIES
    { id: "low", ticker: "LOW", name: "Lowe's", role: "major retail partner for Sherwin-Williams-branded coatings" },
    { id: "gm", ticker: "GM", name: "General Motors", role: "large automotive coatings end market" },
    { id: "f", ticker: "F", name: "Ford", role: "large automotive coatings end market" },
    { id: "ba", ticker: "BA", name: "Boeing", role: "large aerospace coatings end market" },
    { id: "cat", ticker: "CAT", name: "Caterpillar", role: "large industrial coatings end market" },
    { id: "dhi", ticker: "DHI", name: "D.R. Horton", role: "public residential-construction demand exposure for architectural coatings" }
  ],

  edges: [
    // UPSTREAM → CENTER
    { source: "cc", target: "shw" },
    { source: "trox", target: "shw" },
    { source: "kro", target: "shw" },
    { source: "dow", target: "shw" },
    { source: "lyb", target: "shw" },
    { source: "emn", target: "shw" },
    { source: "ce", target: "shw" },
    { source: "cck", target: "shw" },

    // CENTER → DOWNSTREAM
    { source: "shw", target: "low" },
    { source: "shw", target: "gm" },
    { source: "shw", target: "f" },
    { source: "shw", target: "ba" },
    { source: "shw", target: "cat" },
    { source: "shw", target: "dhi" }
  ]
},
MMM: {
  name: "3M",
  root: "mmm",
  nodes: [
    // UPSTREAM — PUBLICLY TRADED DIRECT SUPPLIERS / PARTNERS
    { id: "fcx", ticker: "FCX", name: "Freeport-McMoRan", role: "copper and mineral producer supplying industrial materials markets" },
    { id: "dow", ticker: "DOW", name: "Dow", role: "polymers, silicones, solvents, and specialty-chemical producer" },
    { id: "dd", ticker: "DD", name: "DuPont", role: "specialty materials and electronic-materials producer" },
    { id: "lyb", ticker: "LYB", name: "LyondellBasell", role: "polypropylene and polyethylene resin producer" },
    { id: "emn", ticker: "EMN", name: "Eastman Chemical", role: "specialty chemicals, films, and adhesive-resin producer" },
    { id: "lin", ticker: "LIN", name: "Linde", role: "industrial and specialty-gas supplier" },
    { id: "avy", ticker: "AVY", name: "Avery Dennison", role: "pressure-sensitive materials and label-stock producer" },
    { id: "see", ticker: "SEE", name: "Sealed Air", role: "protective-packaging materials producer" },

    // CENTER
    { id: "mmm", ticker: "MMM", name: "3M", role: "specialty materials, adhesives, industrial, safety, transportation, electronics, and consumer products company" },

    // DOWNSTREAM — PUBLICLY TRADED CUSTOMERS / CHANNELS / COUNTERPARTIES
    { id: "ba", ticker: "BA", name: "Boeing", role: "aerospace end market for 3M adhesives, sealants, films, and specialty materials" },
    { id: "cat", ticker: "CAT", name: "Caterpillar", role: "industrial end market for 3M abrasives, adhesives, and maintenance products" },
    { id: "etn", ticker: "ETN", name: "Eaton", role: "electrical and industrial end market for 3M insulation and specialty materials" },
    { id: "tsla", ticker: "TSLA", name: "Tesla", role: "automotive end market for adhesives and specialty materials" },
    { id: "aapl", ticker: "AAPL", name: "Apple", role: "electronics end market for optical films and specialty materials" },
    { id: "tsm", ticker: "TSM", name: "TSMC", role: "semiconductor-manufacturing end market for polishing and specialty materials" }
  ],

  edges: [
    // UPSTREAM → CENTER
    { source: "fcx", target: "mmm" },
    { source: "dow", target: "mmm" },
    { source: "dd", target: "mmm" },
    { source: "lyb", target: "mmm" },
    { source: "emn", target: "mmm" },
    { source: "lin", target: "mmm" },
    { source: "avy", target: "mmm" },
    { source: "see", target: "mmm" },

    // CENTER → DOWNSTREAM
    { source: "mmm", target: "ba" },
    { source: "mmm", target: "cat" },
    { source: "mmm", target: "etn" },
    { source: "mmm", target: "tsla" },
    { source: "mmm", target: "aapl" },
    { source: "mmm", target: "tsm" }
  ]
},
AVGO: {
  name: "Broadcom",
  root: "avgo",
  nodes: [
    // UPSTREAM LAYER 1 — PUBLICLY TRADED SUPPLIERS / ENABLERS
    { id: "asml", ticker: "ASML", name: "ASML", role: "advanced lithography supplier to semiconductor foundries used by Broadcom" },
    { id: "snps", ticker: "SNPS", name: "Synopsys", role: "EDA and verification software supplier to advanced semiconductor design" },
    { id: "cdns", ticker: "CDNS", name: "Cadence", role: "EDA and verification software supplier to advanced semiconductor design" },
    { id: "amat", ticker: "AMAT", name: "Applied Materials", role: "semiconductor process-equipment supplier" },
    { id: "lrcx", ticker: "LRCX", name: "Lam Research", role: "etch and deposition equipment supplier" },
    { id: "klac", ticker: "KLAC", name: "KLA", role: "inspection and process-control equipment supplier" },

    // UPSTREAM LAYER 2 — PUBLICLY TRADED DIRECT SUPPLIERS / PARTNERS
    { id: "tsm", ticker: "TSM", name: "TSMC", role: "primary outsourced foundry manufacturing advanced Broadcom semiconductor products" },
    { id: "asx", ticker: "ASX", name: "ASE Technology", role: "outsourced semiconductor assembly and test partner" },
    { id: "amkr", ticker: "AMKR", name: "Amkor Technology", role: "outsourced semiconductor packaging and test partner" },
    { id: "foxconn", ticker: "2317.TW", name: "Hon Hai / Foxconn", role: "electronics manufacturing and systems partner" },

    // CENTER
    { id: "avgo", ticker: "AVGO", name: "Broadcom", role: "semiconductor, networking, custom accelerator, connectivity, and infrastructure software company" },

    // DOWNSTREAM — PUBLICLY TRADED CUSTOMERS / CHANNELS / COUNTERPARTIES
    { id: "googl", ticker: "GOOGL", name: "Alphabet", role: "major custom-AI-accelerator and networking customer/partner" },
    { id: "meta", ticker: "META", name: "Meta", role: "hyperscale AI networking and custom-silicon customer/partner" },
    { id: "aapl", ticker: "AAPL", name: "Apple", role: "major wireless and custom-silicon customer" },
    { id: "csco", ticker: "CSCO", name: "Cisco", role: "major networking-silicon customer" },
    { id: "dell", ticker: "DELL", name: "Dell Technologies", role: "enterprise infrastructure customer/channel" },
    { id: "hpe", ticker: "HPE", name: "HPE", role: "enterprise infrastructure customer/channel" }
  ],

  edges: [
    // UPSTREAM LAYER 1 → LAYER 2
    { source: "asml", target: "tsm" },
    { source: "snps", target: "tsm" },
    { source: "cdns", target: "tsm" },
    { source: "amat", target: "tsm" },
    { source: "lrcx", target: "tsm" },
    { source: "klac", target: "tsm" },

    // UPSTREAM LAYER 2 → CENTER
    { source: "tsm", target: "avgo" },
    { source: "asx", target: "avgo" },
    { source: "amkr", target: "avgo" },
    { source: "foxconn", target: "avgo" },

    // CENTER → DOWNSTREAM
    { source: "avgo", target: "googl" },
    { source: "avgo", target: "meta" },
    { source: "avgo", target: "aapl" },
    { source: "avgo", target: "csco" },
    { source: "avgo", target: "dell" },
    { source: "avgo", target: "hpe" }
  ]
},
LLY: {
  name: "Eli Lilly",
  root: "lly",
  nodes: [
    // UPSTREAM — PUBLICLY TRADED DIRECT SUPPLIERS / PARTNERS
    { id: "lin", ticker: "LIN", name: "Linde", role: "industrial and specialty-gas supplier to pharmaceutical manufacturing" },
    { id: "apd", ticker: "APD", name: "Air Products", role: "industrial and specialty-gas supplier to pharmaceutical manufacturing" },
    { id: "dd", ticker: "DD", name: "DuPont", role: "specialty materials and filtration inputs used in regulated manufacturing" },
    { id: "tmo", ticker: "TMO", name: "Thermo Fisher Scientific", role: "bioprocessing, analytical, and life-science supplier to pharmaceutical manufacturers" },
    { id: "wst", ticker: "WST", name: "West Pharmaceutical Services", role: "injectable-drug containment and delivery-system supplier" },
    { id: "stvn", ticker: "STVN", name: "Stevanato Group", role: "drug-container, syringe, and delivery-system supplier to injectable-medicine manufacturers" },
    { id: "bdx", ticker: "BDX", name: "Becton, Dickinson", role: "drug-delivery and medical-device supplier" },

    // CENTER
    { id: "lly", ticker: "LLY", name: "Eli Lilly", role: "global pharmaceutical manufacturer focused on diabetes, obesity, oncology, immunology, neuroscience, and other medicines" },

    // DOWNSTREAM — PUBLICLY TRADED CUSTOMERS / CHANNELS / COUNTERPARTIES
    { id: "mck", ticker: "MCK", name: "McKesson", role: "major U.S. pharmaceutical wholesaler distributing Lilly products" },
    { id: "cor", ticker: "COR", name: "Cencora", role: "major U.S. pharmaceutical wholesaler and specialty distributor" },
    { id: "cah", ticker: "CAH", name: "Cardinal Health", role: "major U.S. pharmaceutical wholesaler" },
    { id: "cvs", ticker: "CVS", name: "CVS Health", role: "major retail and specialty pharmacy channel" },
    { id: "unh", ticker: "UNH", name: "UnitedHealth Group", role: "major payer/PBM counterparty through Optum Rx" },
    { id: "ci", ticker: "CI", name: "The Cigna Group", role: "major payer/PBM counterparty through Express Scripts" }
  ],

  edges: [
    // UPSTREAM → CENTER
    { source: "lin", target: "lly" },
    { source: "apd", target: "lly" },
    { source: "dd", target: "lly" },
    { source: "tmo", target: "lly" },
    { source: "wst", target: "lly" },
    { source: "stvn", target: "lly" },
    { source: "bdx", target: "lly" },

    // CENTER → DOWNSTREAM
    { source: "lly", target: "mck" },
    { source: "lly", target: "cor" },
    { source: "lly", target: "cah" },
    { source: "lly", target: "cvs" },
    { source: "lly", target: "unh" },
    { source: "lly", target: "ci" }
  ]
},
TSM: {
  name: "TSMC",
  root: "tsm",
  nodes: [
    // UPSTREAM — PUBLICLY TRADED DIRECT SUPPLIERS / PARTNERS
    { id: "asml", ticker: "ASML", name: "ASML", role: "EUV and DUV lithography equipment supplier" },
    { id: "amat", ticker: "AMAT", name: "Applied Materials", role: "deposition, etch, and process-equipment supplier" },
    { id: "lrcx", ticker: "LRCX", name: "Lam Research", role: "etch and deposition equipment supplier" },
    { id: "klac", ticker: "KLAC", name: "KLA", role: "inspection and process-control equipment supplier" },
    { id: "shecy", ticker: "SHECY", name: "Shin-Etsu Chemical", role: "silicon wafer and semiconductor-material supplier" },
    { id: "sumco", ticker: "3436.T", name: "SUMCO", role: "silicon wafer supplier" },
    { id: "lin", ticker: "LIN", name: "Linde", role: "ultra-high-purity industrial gas supplier" },
    { id: "apd", ticker: "APD", name: "Air Products", role: "specialty and industrial gas supplier" },

    // CENTER
    { id: "tsm", ticker: "TSM", name: "TSMC", role: "leading pure-play semiconductor foundry and advanced-packaging company" },

    // DOWNSTREAM — PUBLICLY TRADED CUSTOMERS / CHANNELS / COUNTERPARTIES
    { id: "aapl", ticker: "AAPL", name: "Apple", role: "major fabless semiconductor customer" },
    { id: "nvda", ticker: "NVDA", name: "NVIDIA", role: "major advanced-node and packaging customer" },
    { id: "amd", ticker: "AMD", name: "AMD", role: "major advanced-node foundry customer" },
    { id: "qcom", ticker: "QCOM", name: "Qualcomm", role: "major mobile and connectivity semiconductor customer" },
    { id: "avgo", ticker: "AVGO", name: "Broadcom", role: "major networking and custom-silicon foundry customer" },
    { id: "intc", ticker: "INTC", name: "Intel", role: "foundry/customer relationship for selected advanced semiconductor products" },
    { id: "nxpi", ticker: "NXPI", name: "NXP Semiconductors", role: "public semiconductor customer" },
    { id: "sony", ticker: "SONY", name: "Sony", role: "image-sensor and semiconductor customer/partner" }
  ],

  edges: [
    // UPSTREAM → CENTER
    { source: "asml", target: "tsm" },
    { source: "amat", target: "tsm" },
    { source: "lrcx", target: "tsm" },
    { source: "klac", target: "tsm" },
    { source: "shecy", target: "tsm" },
    { source: "sumco", target: "tsm" },
    { source: "lin", target: "tsm" },
    { source: "apd", target: "tsm" },

    // CENTER → DOWNSTREAM
    { source: "tsm", target: "aapl" },
    { source: "tsm", target: "nvda" },
    { source: "tsm", target: "amd" },
    { source: "tsm", target: "qcom" },
    { source: "tsm", target: "avgo" },
    { source: "tsm", target: "intc" },
    { source: "tsm", target: "nxpi" },
    { source: "tsm", target: "sony" }
  ]
},
TMO: {
  name: "Thermo Fisher Scientific",
  root: "tmo",
  nodes: [
    // UPSTREAM — PUBLICLY TRADED DIRECT SUPPLIERS / PARTNERS
    { id: "dow", ticker: "DOW", name: "Dow", role: "chemical and polymer producer serving laboratory and life-science materials markets" },
    { id: "dd", ticker: "DD", name: "DuPont", role: "specialty-materials and filtration supplier to life-science manufacturing" },
    { id: "hon", ticker: "HON", name: "Honeywell", role: "specialty chemicals, sensors, and industrial technologies used in laboratory/manufacturing environments" },
    { id: "apd", ticker: "APD", name: "Air Products", role: "industrial and specialty-gas supplier to laboratories and biopharma manufacturing" },
    { id: "lin", ticker: "LIN", name: "Linde", role: "industrial and specialty-gas supplier to laboratories and biopharma manufacturing" },
    { id: "glw", ticker: "GLW", name: "Corning", role: "laboratory glass, cell-culture, and life-science consumables supplier" },
    { id: "txn", ticker: "TXN", name: "Texas Instruments", role: "analog semiconductor supplier used in analytical instrumentation" },
    { id: "aph", ticker: "APH", name: "Amphenol", role: "connectors and interconnect supplier used in instrumentation" },

    // CENTER
    { id: "tmo", ticker: "TMO", name: "Thermo Fisher Scientific", role: "life-science tools, analytical instruments, diagnostics, bioproduction, and contract-development/manufacturing company" },

    // DOWNSTREAM — PUBLICLY TRADED CUSTOMERS / CHANNELS / COUNTERPARTIES
    { id: "mrna", ticker: "MRNA", name: "Moderna", role: "public biotechnology end-market/customer for life-science and manufacturing services" },
    { id: "pfe", ticker: "PFE", name: "Pfizer", role: "public pharmaceutical end-market/customer" },
    { id: "mrk", ticker: "MRK", name: "Merck", role: "public pharmaceutical end-market/customer" },
    { id: "lly", ticker: "LLY", name: "Eli Lilly", role: "public pharmaceutical end-market/customer" },
    { id: "amgn", ticker: "AMGN", name: "Amgen", role: "public biotechnology end-market/customer" },
    { id: "dgx", ticker: "DGX", name: "Quest Diagnostics", role: "public diagnostics end-market/customer" },
    { id: "lh", ticker: "LH", name: "Labcorp", role: "public diagnostics and laboratory end-market/customer" }
  ],

  edges: [
    // UPSTREAM → CENTER
    { source: "dow", target: "tmo" },
    { source: "dd", target: "tmo" },
    { source: "hon", target: "tmo" },
    { source: "apd", target: "tmo" },
    { source: "lin", target: "tmo" },
    { source: "glw", target: "tmo" },
    { source: "txn", target: "tmo" },
    { source: "aph", target: "tmo" },

    // CENTER → DOWNSTREAM
    { source: "tmo", target: "mrna" },
    { source: "tmo", target: "pfe" },
    { source: "tmo", target: "mrk" },
    { source: "tmo", target: "lly" },
    { source: "tmo", target: "amgn" },
    { source: "tmo", target: "dgx" },
    { source: "tmo", target: "lh" }
  ]
},
NFLX: {
  name: "Netflix",
  root: "nflx",
  nodes: [
    // UPSTREAM LAYER 1 — PUBLICLY TRADED SUPPLIERS / ENABLERS
    { id: "tsm", ticker: "TSM", name: "TSMC", role: "foundry producing processors used in cloud and streaming infrastructure" },
    { id: "nvda", ticker: "NVDA", name: "NVIDIA", role: "accelerated-computing supplier to cloud infrastructure used for media and AI workloads" },

    // UPSTREAM LAYER 2 — PUBLICLY TRADED DIRECT SUPPLIERS / PARTNERS
    { id: "amzn", ticker: "AMZN", name: "Amazon", role: "AWS cloud infrastructure provider to Netflix" },
    { id: "eqix", ticker: "EQIX", name: "Equinix", role: "colocation and internet-exchange infrastructure supporting Open Connect peering" },
    { id: "sanm", ticker: "SANM", name: "Sanmina", role: "manufacturer of Netflix Open Connect Appliance hardware" },
    { id: "snow", ticker: "SNOW", name: "Snowflake", role: "data-cloud and analytics platform used in Netflix's data ecosystem" },

    // CENTER
    { id: "nflx", ticker: "NFLX", name: "Netflix", role: "global subscription streaming, advertising, games, and content platform" },

    // DOWNSTREAM — PUBLICLY TRADED CUSTOMERS / CHANNELS / COUNTERPARTIES
    { id: "aapl", ticker: "AAPL", name: "Apple", role: "iPhone, iPad, Apple TV, and App Store distribution platform" },
    { id: "googl", ticker: "GOOGL", name: "Alphabet", role: "Android, Google TV, and Google Play distribution platform" },
    { id: "cmcsa", ticker: "CMCSA", name: "Comcast", role: "ISP and platform distribution partner" },
    { id: "chtr", ticker: "CHTR", name: "Charter Communications", role: "ISP and platform distribution partner" },
    { id: "vz", ticker: "VZ", name: "Verizon", role: "ISP/mobile distribution and bundle partner" },
    { id: "tmus", ticker: "TMUS", name: "T-Mobile US", role: "wireless bundle and distribution partner" }
  ],

  edges: [
    // UPSTREAM LAYER 1 → LAYER 2
    { source: "tsm", target: "amzn" },
    { source: "nvda", target: "amzn" },

    // UPSTREAM LAYER 2 → CENTER
    { source: "amzn", target: "nflx" },
    { source: "eqix", target: "nflx" },
    { source: "sanm", target: "nflx" },
    { source: "snow", target: "nflx" },

    // CENTER → DOWNSTREAM
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