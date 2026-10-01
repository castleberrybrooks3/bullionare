const supplyChainTree = {
NVDA: {
  name: "NVIDIA",
  root: "nvda",
  nodes: [
    // UPSTREAM LAYER -4 — SEMICONDUCTOR EQUIPMENT
    { id: "asml", ticker: "ASML", name: "ASML", role: "EUV lithography platform used by TSMC for advanced-node wafer production; an upstream equipment dependency behind NVIDIA's leading-edge silicon" },

    // UPSTREAM LAYER -3 — WAFER FOUNDRY / MEMORY
    { id: "tsm", ticker: "TSM", name: "TSMC", role: "named NVIDIA foundry that produces semiconductor wafers for NVIDIA products" },
    { id: "mu", ticker: "MU", name: "Micron", role: "named NVIDIA memory supplier providing DRAM/HBM-class memory used in accelerated-computing platforms" },

    // UPSTREAM LAYER -2 — ADVANCED PACKAGE INTEGRATION
    { id: "nvda_cowos", ticker: null, name: "CoWoS & Advanced Package Integration", role: "advanced packaging stage NVIDIA explicitly says it utilizes; combines leading-edge logic and high-bandwidth memory into accelerator packages" },

    // UPSTREAM LAYER -1 — FINAL ASSEMBLY / TEST / PLATFORM BUILD
    { id: "fn", ticker: "FN", name: "Fabrinet", role: "one of NVIDIA's named independent contract manufacturers used for assembly, testing and packaging of final products" },
    { id: "nvda_final_build", ticker: null, name: "NVIDIA Final Product Build", role: "final assembly, test, configuration and platform integration stage before NVIDIA ships finished products and systems" },

    // EXPANDED DENSITY — VERIFIED UPSTREAM / OPERATING PARTNERS
    { id: "amat", ticker: "AMAT", name: "Applied Materials", role: "wafer-fabrication equipment supplier to leading-edge foundries in NVIDIA’s indirect upstream manufacturing ecosystem" },
    { id: "lrcx", ticker: "LRCX", name: "Lam Research", role: "etch and deposition equipment supplier to advanced foundries supporting NVIDIA chip production" },
    { id: "klac", ticker: "KLAC", name: "KLA", role: "process-control and inspection equipment supplier to leading-edge semiconductor fabs supporting NVIDIA production" },
    { id: "amkr", ticker: "AMKR", name: "Amkor Technology", role: "advanced semiconductor packaging and test partner in NVIDIA’s expanding U.S. manufacturing ecosystem" },
    { id: "cohr", ticker: "COHR", name: "Coherent", role: "optical interconnect and photonics partner supporting next-generation NVIDIA AI infrastructure" },
    { id: "lite", ticker: "LITE", name: "Lumentum", role: "optical communications partner supporting NVIDIA’s high-speed AI networking ecosystem" },
    { id: "glw", ticker: "GLW", name: "Corning", role: "optical fiber and connectivity partner in NVIDIA’s U.S. AI infrastructure supply ecosystem" },
    { id: "nvda_optics_networking", ticker: null, name: "AI Networking & Optical Interconnect Integration", role: "networking and optical-interconnect layer supporting NVIDIA accelerated-computing systems and AI-cluster connectivity" },

    // CENTER
    { id: "nvda", ticker: "NVDA", name: "NVIDIA", role: "designs accelerated-computing GPUs, CPUs, networking silicon, systems and the CUDA software platform" },

    // DOWNSTREAM LAYER +1 — DIRECT HYPERSCALE / AI INFRASTRUCTURE CUSTOMERS
    { id: "amzn", ticker: "AMZN", name: "Amazon Web Services", role: "major NVIDIA cloud infrastructure partner; AWS announced deployment of 2 million additional NVIDIA GPUs beginning in 2026" },
    { id: "msft", ticker: "MSFT", name: "Microsoft Azure", role: "major NVIDIA cloud partner deploying Blackwell and next-generation Vera Rubin systems at hyperscale" },
    { id: "googl", ticker: "GOOGL", name: "Google Cloud", role: "NVIDIA cloud ecosystem partner deploying Vera Rubin and other NVIDIA accelerated-computing infrastructure" },
    { id: "meta", ticker: "META", name: "Meta Platforms", role: "multiyear NVIDIA customer deploying millions of Blackwell and Rubin GPUs plus NVIDIA networking and CPUs" },

    // DOWNSTREAM LAYER +2 — END WORKLOADS
    { id: "nvda_cloud_users", ticker: null, name: "Cloud AI Customers", role: "enterprises, developers and AI labs consuming NVIDIA compute through AWS, Azure and Google Cloud" },
    { id: "meta_ai_users", ticker: null, name: "Meta AI Workloads", role: "ranking, recommendation, generative-AI and inference workloads served from Meta's NVIDIA-powered infrastructure" },

    // EXPANDED DENSITY — VERIFIED DOWNSTREAM / DISTRIBUTION PARTNERS
    { id: "orcl", ticker: "ORCL", name: "Oracle Cloud Infrastructure", role: "major NVIDIA accelerated-computing cloud platform and AI infrastructure adopter" },
    { id: "nvda_system_channel", ticker: null, name: "NVIDIA System & Server Channel", role: "OEM and systems channel integrating NVIDIA accelerated-computing platforms" },
    { id: "dell", ticker: "DELL", name: "Dell Technologies", role: "builds NVIDIA-based AI servers and rack-scale systems for enterprise deployment" },
    { id: "hpe", ticker: "HPE", name: "HPE", role: "integrates NVIDIA accelerators into enterprise AI systems and private-cloud infrastructure" },
    { id: "smci", ticker: "SMCI", name: "Super Micro Computer", role: "high-volume NVIDIA GPU server and rack-scale systems partner" },
    { id: "csco", ticker: "CSCO", name: "Cisco", role: "integrates NVIDIA accelerated computing and networking into enterprise AI infrastructure" },
  ],

  edges: [
    // EQUIPMENT → FOUNDRY
    { source: "asml", target: "tsm" },

    // FOUNDRY / MEMORY → ADVANCED PACKAGING
    { source: "tsm", target: "nvda_cowos" },
    { source: "mu", target: "nvda_cowos" },

    // ADVANCED PACKAGING → FINAL BUILD
    { source: "nvda_cowos", target: "nvda_final_build" },
    { source: "fn", target: "nvda" },

    // FINAL BUILD → NVIDIA
    { source: "nvda_final_build", target: "nvda" },

    // NVIDIA → DIRECT CUSTOMERS / PARTNERS
    { source: "nvda", target: "amzn" },
    { source: "nvda", target: "msft" },
    { source: "nvda", target: "googl" },
    { source: "nvda", target: "meta" },

    // DIRECT CUSTOMERS → END WORKLOADS
    { source: "amzn", target: "nvda_cloud_users" },
    { source: "msft", target: "nvda_cloud_users" },
    { source: "googl", target: "nvda_cloud_users" },
    { source: "meta", target: "meta_ai_users" },

    // EXPANDED DENSITY — VERIFIED RELATIONSHIPS
    { source: "amat", target: "tsm" },
    { source: "lrcx", target: "tsm" },
    { source: "klac", target: "tsm" },
    { source: "amkr", target: "nvda" },
    { source: "cohr", target: "nvda_optics_networking" },
    { source: "lite", target: "nvda_optics_networking" },
    { source: "glw", target: "nvda_optics_networking" },
    { source: "nvda_optics_networking", target: "nvda" },
    { source: "nvda", target: "orcl" },
    { source: "nvda", target: "nvda_system_channel" },
    { source: "nvda_system_channel", target: "dell" },
    { source: "nvda_system_channel", target: "hpe" },
    { source: "nvda_system_channel", target: "smci" },
    { source: "nvda_system_channel", target: "csco" },

  ]
},

AAPL: {
  name: "Apple",
  root: "aapl",
  nodes: [
    // UPSTREAM LAYER -4 — SILICON RAW MATERIALS
    { id: "glw", ticker: "GLW", name: "Corning", role: "Corning's Hemlock Semiconductor supplies U.S.-sourced silicon used in the Apple-directed domestic wafer supply chain" },

    // UPSTREAM LAYER -3 — BARE SILICON WAFERS
    { id: "apple_bare_wafers", ticker: null, name: "U.S. 300mm Bare Silicon Wafers", role: "GlobalWafers America converts U.S.-sourced silicon into 300mm wafers that Apple directs to U.S. chip-manufacturing partners" },

    // UPSTREAM LAYER -2 — CHIP FABRICATION
    { id: "tsm", ticker: "TSM", name: "TSMC", role: "major Apple silicon manufacturing partner; Apple said it is on track to buy well over 100 million advanced chips from TSMC Arizona in 2026" },
    { id: "txn", ticker: "TXN", name: "Texas Instruments", role: "Apple manufacturing partner producing foundational semiconductors for Apple products at U.S. fabs" },

    // UPSTREAM LAYER -1 — PACKAGING / DIRECT COMPONENTS
    { id: "amkr", ticker: "AMKR", name: "Amkor Technology", role: "Apple's first and largest customer at Amkor's Arizona advanced packaging/test facility, which will package Apple silicon made at nearby TSMC" },
    { id: "avgo", ticker: "AVGO", name: "Broadcom", role: "longstanding Apple silicon partner under a new multiyear agreement exceeding $30B for custom silicon and wireless-connectivity components" },
    { id: "cohr", ticker: "COHR", name: "Coherent", role: "longstanding Apple supplier producing VCSEL lasers used in features including Face ID" },
    { id: "mp", ticker: "MP", name: "MP Materials", role: "Apple supplier of U.S.-made rare-earth magnets for devices under Apple's American Manufacturing Program" },

    // EXPANDED DENSITY — VERIFIED UPSTREAM / OPERATING PARTNERS
    { id: "apple_fab_equipment", ticker: null, name: "Semiconductor Fab Equipment Ecosystem", role: "fabrication-tool layer supporting the foundries and chip manufacturers used in Apple’s silicon supply chain" },
    { id: "asml", ticker: "ASML", name: "ASML", role: "EUV lithography equipment supplier to advanced foundries manufacturing leading-edge Apple silicon; indirect upstream exposure" },
    { id: "amat", ticker: "AMAT", name: "Applied Materials", role: "Apple American Manufacturing Program partner and semiconductor manufacturing equipment supplier" },
    { id: "lrcx", ticker: "LRCX", name: "Lam Research", role: "etch and deposition equipment supplier to advanced semiconductor fabs in Apple’s indirect silicon ecosystem" },
    { id: "klac", ticker: "KLAC", name: "KLA", role: "process-control equipment supplier to leading-edge fabs in Apple’s indirect silicon ecosystem" },
    { id: "gfs", ticker: "GFS", name: "GlobalFoundries", role: "Apple American Manufacturing Program partner producing U.S.-made chips and new processes for Apple applications" },
    { id: "crus", ticker: "CRUS", name: "Cirrus Logic", role: "longtime Apple mixed-signal and audio semiconductor supplier; expanding U.S. process collaboration with GlobalFoundries" },
    { id: "apple_component_integration", ticker: null, name: "Apple Component & Silicon Integration", role: "integration layer for connectivity, mixed-signal and specialty semiconductor components before final Apple product build" },

    // CENTER
    { id: "aapl", ticker: "AAPL", name: "Apple", role: "designs and sells iPhone, Mac, iPad, wearables and services while orchestrating a global component and manufacturing network" },

    // DOWNSTREAM LAYER +1 — CARRIER / RETAIL DISTRIBUTION
    { id: "vz", ticker: "VZ", name: "Verizon", role: "major U.S. carrier and retail distribution channel for iPhone and other Apple devices" },
    { id: "t", ticker: "T", name: "AT&T", role: "major U.S. carrier and retail distribution channel for Apple devices" },
    { id: "tmus", ticker: "TMUS", name: "T-Mobile", role: "major U.S. carrier and retail distribution channel for Apple devices" },
    { id: "bby", ticker: "BBY", name: "Best Buy", role: "major U.S. consumer-electronics retail channel for Apple hardware" },

    // DOWNSTREAM LAYER +2 — END USERS
    { id: "apple_end_users", ticker: null, name: "Apple Device & Services Users", role: "consumers and enterprises purchasing Apple hardware and then generating installed-base services demand" },

    // EXPANDED DENSITY — VERIFIED DOWNSTREAM / DISTRIBUTION PARTNERS
    { id: "amzn", ticker: "AMZN", name: "Amazon", role: "major online retail distribution channel for Apple devices and accessories" },
  ],

  edges: [
    // RAW SILICON → BARE WAFERS

    // BARE WAFERS → CHIP FABS
    { source: "apple_bare_wafers", target: "tsm" },
    { source: "apple_bare_wafers", target: "txn" },

    // FABRICATION → PACKAGING / APPLE
    { source: "tsm", target: "amkr" },
    { source: "amkr", target: "aapl" },
    { source: "txn", target: "apple_component_integration" },

    // OTHER DOCUMENTED DIRECT COMPONENT SUPPLIERS
    { source: "avgo", target: "apple_component_integration" },
    { source: "cohr", target: "aapl" },
    { source: "mp", target: "aapl" },

    // APPLE → DISTRIBUTION
    { source: "aapl", target: "vz" },
    { source: "aapl", target: "t" },
    { source: "aapl", target: "tmus" },
    { source: "aapl", target: "bby" },

    // DISTRIBUTION → END USERS
    { source: "vz", target: "apple_end_users" },
    { source: "t", target: "apple_end_users" },
    { source: "tmus", target: "apple_end_users" },
    { source: "bby", target: "apple_end_users" },

    // EXPANDED DENSITY — VERIFIED RELATIONSHIPS
    { source: "asml", target: "apple_fab_equipment" },
    { source: "amat", target: "apple_fab_equipment" },
    { source: "lrcx", target: "apple_fab_equipment" },
    { source: "klac", target: "apple_fab_equipment" },
    { source: "apple_fab_equipment", target: "tsm" },
    { source: "gfs", target: "apple_component_integration" },
    { source: "crus", target: "apple_component_integration" },
    { source: "apple_component_integration", target: "aapl" },
    { source: "glw", target: "aapl" },
    { source: "aapl", target: "amzn" },
    { source: "amzn", target: "apple_end_users" },

  ]
},

GOOGL: {
  name: "Alphabet (Google)",
  root: "googl",
  nodes: [
    // UPSTREAM LAYER -4 — SEMICONDUCTOR EQUIPMENT
    { id: "asml", ticker: "ASML", name: "ASML", role: "advanced lithography equipment used in TSMC's leading-edge foundry network that supports hyperscale AI silicon supply" },

    // UPSTREAM LAYER -3 — EXTERNAL FOUNDRY
    { id: "tsm", ticker: "TSM", name: "TSMC", role: "major external foundry used by Broadcom and NVIDIA; shown as a manufacturing dependency behind Google's custom and merchant AI silicon, not as an asserted exclusive Google-specific foundry contract" },

    // UPSTREAM LAYER -2 — AI SILICON SUPPLIERS
    { id: "avgo", ticker: "AVGO", name: "Broadcom", role: "Google's long-term custom-silicon partner developing and supplying future TPU generations plus networking components for next-generation AI racks through up to 2031" },
    { id: "nvda", ticker: "NVDA", name: "NVIDIA", role: "merchant GPU and accelerated-computing supplier used by Google Cloud alongside Google's internally designed TPUs" },

    // UPSTREAM LAYER -1 — GOOGLE AI COMPUTE INTEGRATION
    { id: "google_tpu_racks", ticker: null, name: "Google TPU & AI Rack Integration", role: "rack-level integration of custom TPUs, networking and memory into Google's hyperscale AI infrastructure" },
    { id: "google_gpu_compute", ticker: null, name: "Google Cloud GPU Compute", role: "NVIDIA-accelerated compute integrated into Google Cloud's AI infrastructure alongside TPU capacity" },

    // EXPANDED DENSITY — VERIFIED UPSTREAM / OPERATING PARTNERS
    { id: "amat", ticker: "AMAT", name: "Applied Materials", role: "wafer-fabrication equipment supplier to advanced foundries in Google’s indirect TPU and accelerator supply chain" },
    { id: "lrcx", ticker: "LRCX", name: "Lam Research", role: "etch and deposition equipment supplier to leading-edge foundries supporting Google accelerator production" },
    { id: "klac", ticker: "KLAC", name: "KLA", role: "process-control equipment supplier to advanced fabs supporting Google’s custom silicon ecosystem" },
    { id: "amd", ticker: "AMD", name: "AMD", role: "EPYC CPU supplier represented in Google Cloud’s current x86 compute portfolio" },
    { id: "intc", ticker: "INTC", name: "Intel", role: "Xeon CPU supplier represented in Google Cloud’s current x86 compute portfolio" },
    { id: "arm", ticker: "ARM", name: "Arm Holdings", role: "CPU architecture and IP foundation used by Google’s custom Axion processor family" },
    { id: "google_axion_compute", ticker: null, name: "Google Axion CPU Infrastructure", role: "Google-designed Arm-based CPU infrastructure for cloud workloads" },
    { id: "xel", ticker: "XEL", name: "Xcel Energy", role: "utility partner supplying Google’s Pine Island, Minnesota data center under a dedicated clean-energy structure" },
    { id: "aes", ticker: "AES", name: "AES", role: "clean-power developer co-located with Google’s Wilbarger County, Texas data center" },

    // CENTER
    { id: "googl", ticker: "GOOGL", name: "Alphabet", role: "operates Google Search, YouTube, Google Cloud, advertising, Android and AI products including Gemini" },

    // DOWNSTREAM LAYER +1 — MAJOR PRODUCT / REVENUE PLATFORMS
    { id: "google_cloud", ticker: null, name: "Google Cloud Platform", role: "enterprise cloud and AI platform distributing TPU, GPU, data and application services" },
    { id: "google_ads_youtube", ticker: null, name: "Google Ads & YouTube", role: "consumer attention and advertising platforms that monetize Search, YouTube and other Google properties" },

    // DOWNSTREAM LAYER +2 — DEMAND
    { id: "google_enterprise_users", ticker: null, name: "Enterprise Cloud & AI Customers", role: "enterprises, developers and AI companies consuming Google Cloud compute, data and AI services" },
    { id: "google_advertisers_users", ticker: null, name: "Advertisers & Consumer Users", role: "advertisers buying reach and users consuming Search, YouTube, Maps and other Google services" },

    // EXPANDED DENSITY — VERIFIED DOWNSTREAM / DISTRIBUTION PARTNERS
    { id: "spot", ticker: "SPOT", name: "Spotify", role: "large Google Cloud customer using the platform for data, infrastructure and global service delivery" },
    { id: "pypl", ticker: "PYPL", name: "PayPal", role: "Google Cloud customer using the platform for a unified AI and data foundation" },
    { id: "tgt", ticker: "TGT", name: "Target", role: "longtime Google Cloud retail customer using cloud, data and AI services across digital operations" },
  ],

  edges: [
    // EQUIPMENT → FOUNDRY
    { source: "asml", target: "tsm" },

    // FOUNDRY → AI SILICON SUPPLIERS
    { source: "tsm", target: "avgo" },
    { source: "tsm", target: "nvda" },

    // SILICON SUPPLIERS → GOOGLE INFRASTRUCTURE
    { source: "avgo", target: "google_tpu_racks" },
    { source: "nvda", target: "google_gpu_compute" },

    // INFRASTRUCTURE → ALPHABET
    { source: "google_tpu_racks", target: "googl" },
    { source: "google_gpu_compute", target: "googl" },

    // ALPHABET → PRODUCT PLATFORMS
    { source: "googl", target: "google_cloud" },
    { source: "googl", target: "google_ads_youtube" },

    // PRODUCT PLATFORMS → DEMAND
    { source: "google_cloud", target: "google_enterprise_users" },
    { source: "google_ads_youtube", target: "google_advertisers_users" },

    // EXPANDED DENSITY — VERIFIED RELATIONSHIPS
    { source: "amat", target: "tsm" },
    { source: "lrcx", target: "tsm" },
    { source: "klac", target: "tsm" },
    { source: "amd", target: "google_gpu_compute" },
    { source: "intc", target: "google_gpu_compute" },
    { source: "arm", target: "google_axion_compute" },
    { source: "google_axion_compute", target: "googl" },
    { source: "xel", target: "googl" },
    { source: "aes", target: "googl" },
    { source: "google_cloud", target: "spot" },
    { source: "google_cloud", target: "pypl" },
    { source: "google_cloud", target: "tgt" },

  ]
},

MSFT: {
  name: "Microsoft",
  root: "msft",
  nodes: [
    // UPSTREAM LAYER -4 — SEMICONDUCTOR EQUIPMENT
    { id: "asml", ticker: "ASML", name: "ASML", role: "advanced lithography equipment used by leading foundries that manufacture high-end accelerator silicon deployed in Azure" },

    // UPSTREAM LAYER -3 — FOUNDRY
    { id: "tsm", ticker: "TSM", name: "TSMC", role: "leading-edge foundry behind major merchant AI accelerators that Microsoft deploys at Azure scale" },

    // UPSTREAM LAYER -2 — ACCELERATOR SILICON
    { id: "nvda", ticker: "NVDA", name: "NVIDIA", role: "strategic Azure AI hardware partner; Microsoft is deploying hundreds of thousands of Blackwell GPUs and next-generation Vera Rubin systems" },
    { id: "amd", ticker: "AMD", name: "AMD", role: "Azure compute supplier providing EPYC CPUs and Instinct accelerators as part of Microsoft's heterogeneous cloud infrastructure" },

    // UPSTREAM LAYER -1 — AZURE DATACENTER INTEGRATION
    { id: "azure_ai_infra", ticker: null, name: "Azure AI Datacenter Integration", role: "Microsoft-designed power, cooling, networking and rack integration that turns accelerator hardware into production Azure AI capacity" },

    // EXPANDED DENSITY — VERIFIED UPSTREAM / OPERATING PARTNERS
    { id: "amat", ticker: "AMAT", name: "Applied Materials", role: "semiconductor fabrication equipment supplier to leading-edge foundries supporting Microsoft’s AI silicon ecosystem" },
    { id: "lrcx", ticker: "LRCX", name: "Lam Research", role: "etch and deposition equipment supplier to advanced foundries supporting Microsoft AI accelerators" },
    { id: "klac", ticker: "KLAC", name: "KLA", role: "process-control equipment supplier to advanced semiconductor fabs in Microsoft’s indirect silicon supply chain" },
    { id: "intc", ticker: "INTC", name: "Intel", role: "CPU supplier for Microsoft’s datacenter and Windows ecosystem" },
    { id: "qcom", ticker: "QCOM", name: "Qualcomm", role: "Snapdragon silicon partner for Windows on Arm and Copilot+ PC devices" },
    { id: "msft_client_silicon", ticker: null, name: "Windows & Client Silicon Ecosystem", role: "processor layer supporting Windows PCs and Microsoft’s client-device ecosystem" },
    { id: "ceg", ticker: "CEG", name: "Constellation Energy", role: "long-term nuclear power partner supporting Microsoft datacenter electricity demand through the Crane Clean Energy Center PPA" },
    { id: "rnw", ticker: "RNW", name: "ReNew Energy Global", role: "renewable-energy partner under a 437.6 MW green-attribute agreement with Microsoft" },

    // CENTER
    { id: "msft", ticker: "MSFT", name: "Microsoft", role: "operates Azure, Microsoft 365, Windows, GitHub, gaming and AI products including Microsoft Foundry and Copilot" },

    // DOWNSTREAM LAYER +1 — DISTRIBUTION PLATFORMS
    { id: "azure_platform", ticker: null, name: "Azure Cloud Platform", role: "cloud distribution layer for enterprise compute, databases, AI and application services" },
    { id: "windows_oem", ticker: null, name: "Windows OEM Channel", role: "Windows licensing and PC ecosystem channel through major hardware manufacturers" },

    // DOWNSTREAM LAYER +2 — MAJOR PARTNERS / OEMS
    { id: "orcl", ticker: "ORCL", name: "Oracle", role: "Oracle Database@Azure multicloud partner serving joint enterprise customers through integrated Azure and OCI services" },
    { id: "dell", ticker: "DELL", name: "Dell Technologies", role: "major Windows PC and enterprise hardware OEM distributing Microsoft software to business and consumer users" },
    { id: "hpq", ticker: "HPQ", name: "HP Inc.", role: "major Windows PC OEM distributing Microsoft software across commercial and consumer devices" },

    // EXPANDED DENSITY — VERIFIED DOWNSTREAM / DISTRIBUTION PARTNERS
    { id: "sap", ticker: "SAP", name: "SAP", role: "major enterprise software workload and cloud ecosystem partner running customer systems on Azure" },
  ],

  edges: [
    // EQUIPMENT → FOUNDRY
    { source: "asml", target: "tsm" },

    // FOUNDRY → ACCELERATOR SILICON
    { source: "tsm", target: "nvda" },
    { source: "tsm", target: "amd" },

    // ACCELERATORS → AZURE INFRASTRUCTURE
    { source: "nvda", target: "azure_ai_infra" },
    { source: "amd", target: "azure_ai_infra" },

    // AZURE INFRASTRUCTURE → MICROSOFT
    { source: "azure_ai_infra", target: "msft" },

    // MICROSOFT → DISTRIBUTION PLATFORMS
    { source: "msft", target: "azure_platform" },
    { source: "msft", target: "windows_oem" },

    // DISTRIBUTION → PARTNERS / OEMS
    { source: "azure_platform", target: "orcl" },
    { source: "windows_oem", target: "dell" },
    { source: "windows_oem", target: "hpq" },

    // EXPANDED DENSITY — VERIFIED RELATIONSHIPS
    { source: "amat", target: "tsm" },
    { source: "lrcx", target: "tsm" },
    { source: "klac", target: "tsm" },
    { source: "intc", target: "msft_client_silicon" },
    { source: "qcom", target: "msft_client_silicon" },
    { source: "msft_client_silicon", target: "msft" },
    { source: "ceg", target: "msft" },
    { source: "rnw", target: "msft" },
    { source: "azure_platform", target: "sap" },

  ]
},

AMZN: {
  name: "Amazon",
  root: "amzn",
  nodes: [
    // UPSTREAM LAYER -4 — SEMICONDUCTOR EQUIPMENT
    { id: "asml", ticker: "ASML", name: "ASML", role: "leading-edge lithography equipment used by foundries producing accelerator silicon deployed in AWS data centers" },

    // UPSTREAM LAYER -3 — FOUNDRY
    { id: "tsm", ticker: "TSM", name: "TSMC", role: "leading-edge foundry behind major merchant AI accelerators used throughout hyperscale cloud infrastructure" },

    // UPSTREAM LAYER -2 — AI ACCELERATOR SUPPLY
    { id: "nvda", ticker: "NVDA", name: "NVIDIA", role: "major AWS accelerated-computing partner; AWS and NVIDIA announced 2 million additional GPUs across AWS infrastructure beginning in 2026" },

    // UPSTREAM LAYER -1 — AWS INFRASTRUCTURE INTEGRATION
    { id: "aws_gpu_fleet", ticker: null, name: "AWS GPU & AI Infrastructure", role: "AWS rack, networking, power and software integration that converts NVIDIA hardware into cloud AI capacity" },

    // EXPANDED DENSITY — VERIFIED UPSTREAM / OPERATING PARTNERS
    { id: "amat", ticker: "AMAT", name: "Applied Materials", role: "wafer-fabrication equipment supplier to advanced foundries in AWS’s indirect accelerator silicon ecosystem" },
    { id: "lrcx", ticker: "LRCX", name: "Lam Research", role: "etch and deposition equipment supplier to leading-edge foundries supporting AWS accelerator supply" },
    { id: "klac", ticker: "KLAC", name: "KLA", role: "process-control equipment supplier to advanced fabs supporting AWS compute silicon" },
    { id: "amd", ticker: "AMD", name: "AMD", role: "EPYC CPU supplier powering current Amazon EC2 compute-optimized instances" },
    { id: "intc", ticker: "INTC", name: "Intel", role: "Xeon CPU supplier powering current Amazon EC2 instance families" },
    { id: "aws_cpu_fleet", ticker: null, name: "AWS x86 CPU Compute Fleet", role: "EC2 CPU infrastructure integrating AMD EPYC and Intel Xeon processors" },

    // CENTER
    { id: "amzn", ticker: "AMZN", name: "Amazon", role: "operates AWS, e-commerce marketplace, fulfillment/logistics, advertising and Prime subscription businesses" },

    // DOWNSTREAM LAYER +1 — CORE DISTRIBUTION PLATFORMS
    { id: "aws_cloud", ticker: null, name: "Amazon Web Services", role: "cloud platform distributing compute, storage, database, networking and AI services to external customers" },
    { id: "amazon_fulfillment", ticker: null, name: "Amazon Marketplace & Fulfillment", role: "retail marketplace, fulfillment centers and delivery network connecting brands and third-party sellers to buyers" },

    // DOWNSTREAM LAYER +2 — DEMAND
    { id: "nflx", ticker: "NFLX", name: "Netflix", role: "large, long-running AWS customer using Amazon cloud infrastructure for global streaming-service workloads" },
    { id: "amazon_retail_users", ticker: null, name: "Consumers & Marketplace Sellers", role: "buyers, brands and third-party merchants generating merchandise, fulfillment, subscription and advertising demand" },

    // EXPANDED DENSITY — VERIFIED DOWNSTREAM / DISTRIBUTION PARTNERS
    { id: "pfe", ticker: "PFE", name: "Pfizer", role: "AWS customer using cloud services to accelerate oncology research, vaccine development and supply-chain workloads" },
    { id: "bmw", ticker: "BMWYY", name: "BMW Group", role: "AWS customer using cloud and AI across connected vehicles and enterprise operations" },
    { id: "adidas", ticker: "ADDYY", name: "adidas", role: "AWS customer that rebuilt core systems on AWS for application scale and real-time services" },
  ],

  edges: [
    // EQUIPMENT → FOUNDRY
    { source: "asml", target: "tsm" },

    // FOUNDRY → NVIDIA
    { source: "tsm", target: "nvda" },

    // NVIDIA → AWS INFRASTRUCTURE
    { source: "nvda", target: "aws_gpu_fleet" },

    // AWS INFRASTRUCTURE → AMAZON
    { source: "aws_gpu_fleet", target: "amzn" },

    // AMAZON → CORE PLATFORMS
    { source: "amzn", target: "aws_cloud" },
    { source: "amzn", target: "amazon_fulfillment" },

    // CORE PLATFORMS → DEMAND
    { source: "aws_cloud", target: "nflx" },
    { source: "amazon_fulfillment", target: "amazon_retail_users" },

    // EXPANDED DENSITY — VERIFIED RELATIONSHIPS
    { source: "amat", target: "tsm" },
    { source: "lrcx", target: "tsm" },
    { source: "klac", target: "tsm" },
    { source: "amd", target: "aws_cpu_fleet" },
    { source: "intc", target: "aws_cpu_fleet" },
    { source: "aws_cpu_fleet", target: "amzn" },
    { source: "aws_cloud", target: "pfe" },
    { source: "aws_cloud", target: "bmw" },
    { source: "aws_cloud", target: "adidas" },

  ]
},

META: {
  name: "Meta Platforms",
  root: "meta",
  nodes: [
    // UPSTREAM LAYER -4 — SEMICONDUCTOR EQUIPMENT
    { id: "asml", ticker: "ASML", name: "ASML", role: "advanced lithography equipment used by leading foundries supplying the accelerator silicon consumed by Meta's AI infrastructure" },

    // UPSTREAM LAYER -3 — FOUNDRY
    { id: "tsm", ticker: "TSM", name: "TSMC", role: "major external foundry used by NVIDIA and Broadcom; an upstream manufacturing dependency behind Meta's merchant and custom AI silicon" },

    // UPSTREAM LAYER -2 — AI SILICON
    { id: "nvda", ticker: "NVDA", name: "NVIDIA", role: "multiyear Meta supplier for millions of Blackwell and Rubin GPUs plus NVIDIA CPUs and Spectrum-X networking" },
    { id: "avgo", ticker: "AVGO", name: "Broadcom", role: "Meta's custom-silicon co-development partner for MTIA accelerators, packaging and networking under a multi-year roadmap through 2029" },
    { id: "amd", ticker: "AMD", name: "AMD", role: "strategic Meta compute supplier under a 2026 multi-generation agreement covering up to 6 GW of Instinct GPUs plus EPYC CPUs" },

    // UPSTREAM LAYER -1 — META AI CLUSTERS
    { id: "meta_gpu_clusters", ticker: null, name: "Meta GPU AI Clusters", role: "hyperscale training and inference clusters integrating NVIDIA and AMD accelerators into Meta data centers" },
    { id: "meta_mtia", ticker: null, name: "Meta MTIA Infrastructure", role: "custom accelerator racks built around Meta Training and Inference Accelerator silicon co-developed with Broadcom" },

    // EXPANDED DENSITY — VERIFIED UPSTREAM / OPERATING PARTNERS
    { id: "amat", ticker: "AMAT", name: "Applied Materials", role: "semiconductor equipment supplier to advanced foundries in Meta’s indirect AI silicon supply chain" },
    { id: "lrcx", ticker: "LRCX", name: "Lam Research", role: "etch and deposition equipment supplier to leading-edge fabs supporting Meta AI silicon" },
    { id: "klac", ticker: "KLAC", name: "KLA", role: "process-control equipment supplier to advanced fabs supporting Meta’s accelerator ecosystem" },
    { id: "arm", ticker: "ARM", name: "Arm Holdings", role: "CPU architecture partner in Meta’s diversified AI and datacenter silicon portfolio" },
    { id: "meta_cpu_compute", ticker: null, name: "Meta CPU Compute Infrastructure", role: "server CPU layer complementing GPU and MTIA accelerator infrastructure" },
    { id: "ceg", ticker: "CEG", name: "Constellation Energy", role: "20-year nuclear energy partner supporting Meta operations through the Clinton Clean Energy Center agreement" },
    { id: "vst", ticker: "VST", name: "Vistra", role: "20-year nuclear energy partner supporting Meta through operating plants and capacity uprates in the PJM region" },
    { id: "oklo", ticker: "OKLO", name: "Oklo", role: "advanced nuclear development partner for up to 1.2 GW of future power capacity supporting Meta operations" },

    // CENTER
    { id: "meta", ticker: "META", name: "Meta Platforms", role: "operates Facebook, Instagram, WhatsApp, Messenger, Threads, Reality Labs and a global advertising platform" },

    // DOWNSTREAM LAYER +1 — PRODUCT PLATFORMS
    { id: "meta_apps", ticker: null, name: "Meta Family of Apps", role: "Facebook, Instagram, WhatsApp, Messenger and Threads distribute Meta's consumer and AI experiences" },
    { id: "meta_ads", ticker: null, name: "Meta Advertising Platform", role: "auction, ranking and measurement systems monetize engagement across Meta's applications" },

    // DOWNSTREAM LAYER +2 — DEMAND
    { id: "meta_users", ticker: null, name: "Consumers & Creators", role: "billions of users and creators generating engagement, content and messaging demand" },
    { id: "meta_advertisers", ticker: null, name: "Advertisers", role: "businesses purchasing performance and brand advertising across Meta's platforms" },

    // EXPANDED DENSITY — VERIFIED DOWNSTREAM / DISTRIBUTION PARTNERS
    { id: "meta_mobile_distribution", ticker: null, name: "Mobile OS & App Distribution", role: "mobile platform layer through which Meta’s consumer apps reach billions of users" },
    { id: "aapl", ticker: "AAPL", name: "Apple", role: "iOS and App Store distribution gatekeeper for Meta’s mobile applications" },
    { id: "googl", ticker: "GOOGL", name: "Alphabet", role: "Android and Google Play distribution ecosystem for Meta’s mobile applications" },
  ],

  edges: [
    // EQUIPMENT → FOUNDRY
    { source: "asml", target: "tsm" },

    // FOUNDRY → SILICON SUPPLIERS
    { source: "tsm", target: "nvda" },
    { source: "tsm", target: "avgo" },
    { source: "tsm", target: "amd" },

    // SILICON → META CLUSTERS
    { source: "nvda", target: "meta_gpu_clusters" },
    { source: "amd", target: "meta_gpu_clusters" },
    { source: "avgo", target: "meta_mtia" },

    // CLUSTERS → META
    { source: "meta_gpu_clusters", target: "meta" },
    { source: "meta_mtia", target: "meta" },

    // META → PRODUCT PLATFORMS
    { source: "meta", target: "meta_apps" },
    { source: "meta", target: "meta_ads" },

    // PRODUCT PLATFORMS → DEMAND
    { source: "meta_apps", target: "meta_users" },
    { source: "meta_ads", target: "meta_advertisers" },

    // EXPANDED DENSITY — VERIFIED RELATIONSHIPS
    { source: "amat", target: "tsm" },
    { source: "lrcx", target: "tsm" },
    { source: "klac", target: "tsm" },
    { source: "arm", target: "meta_cpu_compute" },
    { source: "meta_cpu_compute", target: "meta" },
    { source: "ceg", target: "meta" },
    { source: "vst", target: "meta" },
    { source: "oklo", target: "meta" },
    { source: "meta", target: "meta_mobile_distribution" },
    { source: "meta_mobile_distribution", target: "aapl" },
    { source: "meta_mobile_distribution", target: "googl" },

  ]
},

AVGO: {
  name: "Broadcom",
  root: "avgo",
  nodes: [
    // UPSTREAM LAYER -4 — SEMICONDUCTOR EQUIPMENT
    { id: "asml", ticker: "ASML", name: "ASML", role: "advanced lithography equipment used across leading-edge foundry manufacturing, including the external foundry ecosystem Broadcom depends on" },

    // UPSTREAM LAYER -3 — WAFER FOUNDRY
    { id: "tsm", ticker: "TSM", name: "TSMC", role: "Broadcom-disclosed external foundry used for a majority of front-end wafer manufacturing operations" },

    // UPSTREAM LAYER -2 — WAFER OUTPUT / ASSEMBLY CAPACITY
    { id: "avgo_wafer_output", ticker: null, name: "Broadcom Foundry Wafer Output", role: "fabricated semiconductor wafers produced through Broadcom's outsourced foundry model before assembly and test" },
    { id: "amkr", ticker: "AMKR", name: "Amkor Technology", role: "one of Broadcom's specifically named third-party assembly and test providers" },

    // UPSTREAM LAYER -1 — ASSEMBLY / TEST
    { id: "avgo_assembly_test", ticker: null, name: "Broadcom Assembly & Test", role: "outsourced packaging, assembly and test stage performed by partners including TSMC, ASE, Foxconn, Amkor and SPIL" },

    // EXPANDED DENSITY — VERIFIED UPSTREAM / OPERATING PARTNERS
    { id: "amat", ticker: "AMAT", name: "Applied Materials", role: "wafer-fabrication equipment supplier to TSMC and the advanced foundry ecosystem supporting Broadcom" },
    { id: "lrcx", ticker: "LRCX", name: "Lam Research", role: "etch and deposition equipment supplier to advanced foundries supporting Broadcom wafer production" },
    { id: "klac", ticker: "KLAC", name: "KLA", role: "process-control equipment supplier to leading-edge foundries supporting Broadcom production" },
    { id: "asx", ticker: "ASX", name: "ASE Technology", role: "Broadcom-named third-party contract manufacturer used for a significant portion of assembly and test operations" },
    { id: "fxcof", ticker: "FXCOF", name: "Foxconn Technology Group", role: "Broadcom-named third-party contract manufacturer used in assembly and test operations" },

    // CENTER
    { id: "avgo", ticker: "AVGO", name: "Broadcom", role: "designs and supplies semiconductors, custom AI accelerators, networking silicon and infrastructure software including VMware" },

    // DOWNSTREAM LAYER +1 — DOCUMENTED STRATEGIC SILICON CUSTOMERS
    { id: "googl", ticker: "GOOGL", name: "Google", role: "long-term customer for custom TPUs and networking components for future AI racks through up to 2031" },
    { id: "meta", ticker: "META", name: "Meta Platforms", role: "multi-year custom-silicon customer for MTIA accelerators, packaging and AI networking technology" },
    { id: "aapl", ticker: "AAPL", name: "Apple", role: "longstanding customer under multiyear custom-silicon and wireless-connectivity agreements extending through 2031" },

    // DOWNSTREAM LAYER +2 — END SYSTEMS
    { id: "google_ai_racks", ticker: null, name: "Google AI Racks", role: "Google TPU and networking systems built using Broadcom custom silicon" },
    { id: "meta_ai_racks", ticker: null, name: "Meta MTIA Clusters", role: "Meta custom accelerator and Ethernet infrastructure built with Broadcom technology" },
    { id: "apple_devices", ticker: null, name: "Apple Devices", role: "Apple products incorporating Broadcom custom silicon and connectivity components" }
  ],

  edges: [
    // EQUIPMENT → FOUNDRY
    { source: "asml", target: "tsm" },

    // FOUNDRY → WAFER OUTPUT
    { source: "tsm", target: "avgo_wafer_output" },

    // WAFER OUTPUT / ASSEMBLY PARTNER → ASSEMBLY & TEST
    { source: "avgo_wafer_output", target: "avgo_assembly_test" },
    { source: "amkr", target: "avgo_assembly_test" },

    // ASSEMBLY & TEST → BROADCOM
    { source: "avgo_assembly_test", target: "avgo" },

    // BROADCOM → STRATEGIC CUSTOMERS
    { source: "avgo", target: "googl" },
    { source: "avgo", target: "meta" },
    { source: "avgo", target: "aapl" },

    // CUSTOMERS → END SYSTEMS
    { source: "googl", target: "google_ai_racks" },
    { source: "meta", target: "meta_ai_racks" },
    { source: "aapl", target: "apple_devices" },

    // EXPANDED DENSITY — VERIFIED RELATIONSHIPS
    { source: "amat", target: "tsm" },
    { source: "lrcx", target: "tsm" },
    { source: "klac", target: "tsm" },
    { source: "asx", target: "avgo_assembly_test" },
    { source: "fxcof", target: "avgo_assembly_test" },

  ]
},

TSLA: {
  name: "Tesla",
  root: "tsla",
  nodes: [
    // UPSTREAM LAYER -4 — CELL SUPPLY
    { id: "pana", ticker: "PCRFY", name: "Panasonic Energy", role: "longstanding cylindrical lithium-ion cell manufacturing partner at Gigafactory Nevada; Panasonic's Nevada operation was built around supplying Tesla's EV battery program" },

    // UPSTREAM LAYER -3 — CELL INTEGRATION
    { id: "tesla_cell_integration", ticker: null, name: "Tesla Battery Cell Integration", role: "cell qualification and integration stage combining externally produced and Tesla-produced cells into vehicle and energy-storage architectures" },

    // UPSTREAM LAYER -2 — BATTERY PACK / POWERTRAIN
    { id: "tesla_pack_powertrain", ticker: null, name: "Battery Pack & Powertrain Manufacturing", role: "Tesla's vertically integrated battery-pack, drive-unit and powertrain manufacturing stage" },

    // UPSTREAM LAYER -1 — FINAL PRODUCT ASSEMBLY
    { id: "tesla_final_assembly", ticker: null, name: "Vehicle & Energy Product Assembly", role: "final assembly stage across Tesla factories for vehicles, Megapack, Powerwall and related hardware" },
    { id: "tesla_ai_compute", ticker: null, name: "Tesla Cortex AI Compute", role: "in-house training infrastructure used to develop autonomous-driving and robotics models; expanded at Gigafactory Texas" },

    // EXPANDED DENSITY — VERIFIED UPSTREAM / OPERATING PARTNERS
    { id: "bhp", ticker: "BHP", name: "BHP", role: "nickel supplier under a long-term agreement announced with Tesla for battery raw materials; Tesla’s 2025 10-K does not name current raw-material counterparties" },
    { id: "vale", ticker: "VALE", name: "Vale", role: "Class 1 nickel supplier under a long-term U.S. supply agreement with Tesla; Tesla’s 2025 10-K does not name current raw-material counterparties" },

    // CENTER
    { id: "tsla", ticker: "TSLA", name: "Tesla", role: "designs and manufactures EVs, battery energy-storage systems, charging infrastructure, autonomy software and robots" },

    // DOWNSTREAM LAYER +1 — DELIVERY / DEPLOYMENT
    { id: "tesla_vehicle_delivery", ticker: null, name: "Direct Vehicle Delivery & Service", role: "Tesla-owned sales, delivery and service channel connecting factory output directly to vehicle customers" },
    { id: "tesla_energy_deployment", ticker: null, name: "Tesla Energy Deployment", role: "project deployment and service channel for Megapack, Powerwall and related energy-storage products" },

    // DOWNSTREAM LAYER +2 — END DEMAND
    { id: "tesla_vehicle_users", ticker: null, name: "EV & Fleet Customers", role: "retail and fleet buyers using Tesla vehicles and related charging/software services" },
    { id: "tesla_energy_users", ticker: null, name: "Utility, Commercial & Home Energy Customers", role: "customers deploying Tesla grid-scale and behind-the-meter battery storage" }
  ],

  edges: [
    // CELL SUPPLY → CELL INTEGRATION
    { source: "pana", target: "tesla_cell_integration" },

    // CELL INTEGRATION → PACK / POWERTRAIN
    { source: "tesla_cell_integration", target: "tesla_pack_powertrain" },

    // PACK / POWERTRAIN → FINAL ASSEMBLY
    { source: "tesla_pack_powertrain", target: "tesla_final_assembly" },

    // FINAL ASSEMBLY / AI COMPUTE → TESLA
    { source: "tesla_final_assembly", target: "tsla" },
    { source: "tesla_ai_compute", target: "tsla" },

    // TESLA → DELIVERY / DEPLOYMENT
    { source: "tsla", target: "tesla_vehicle_delivery" },
    { source: "tsla", target: "tesla_energy_deployment" },

    // DELIVERY / DEPLOYMENT → END DEMAND
    { source: "tesla_vehicle_delivery", target: "tesla_vehicle_users" },
    { source: "tesla_energy_deployment", target: "tesla_energy_users" },

    // EXPANDED DENSITY — VERIFIED RELATIONSHIPS
    { source: "bhp", target: "tesla_cell_integration" },
    { source: "vale", target: "tesla_cell_integration" },

  ]
},

MU: {
  name: "Micron Technology",
  root: "mu",
  nodes: [
    // UPSTREAM LAYER -4 — FRONT-END CAPITAL EQUIPMENT
    { id: "lrcx", ticker: "LRCX", name: "Lam Research", role: "Micron-recognized front-end capital-equipment supplier; winner of Micron's 2025 Outstanding Performance in Front End Capital Equipment award" },
    { id: "asml", ticker: "ASML", name: "ASML", role: "critical lithography supplier to Micron; Micron recognized ASML for front-end capital performance in its supplier-award program" },

    // UPSTREAM LAYER -3 — WAFER FABRICATION
    { id: "mu_wafer_fab", ticker: null, name: "Micron Wafer Fabrication", role: "front-end semiconductor manufacturing where deposition, etch, lithography and process-control equipment create DRAM and NAND dies" },

    // UPSTREAM LAYER -2 — HBM / MEMORY PROCESSING
    { id: "mu_memory_process", ticker: null, name: "DRAM, NAND & HBM Processing", role: "memory-die processing and HBM-oriented manufacturing stages that convert fabricated wafers into high-performance memory products" },

    // UPSTREAM LAYER -1 — ASSEMBLY / TEST
    { id: "mu_assembly_test", ticker: null, name: "Micron Assembly & Test", role: "back-end assembly, packaging, stacking and test stage before finished Micron memory products ship to customers" },

    // EXPANDED DENSITY — VERIFIED UPSTREAM / OPERATING PARTNERS
    { id: "amat", ticker: "AMAT", name: "Applied Materials", role: "recognized Micron supplier supporting semiconductor manufacturing and front-end operations" },
    { id: "sbgsy", ticker: "SBGSY", name: "Schneider Electric", role: "recognized Micron facilities and energy-management supplier supporting fab operations" },
    { id: "fujiy", ticker: "FUJIY", name: "Fujifilm", role: "recognized Micron front-end quality supplier through Fujifilm Electronic Materials" },
    { id: "mraay", ticker: "MRAAY", name: "Murata Manufacturing", role: "recognized Micron assembly-and-test quality supplier" },
    { id: "mpwr", ticker: "MPWR", name: "Monolithic Power Systems", role: "recognized Micron semiconductor supplier within assembly-and-test procurement" },

    // CENTER
    { id: "mu", ticker: "MU", name: "Micron Technology", role: "designs and manufactures DRAM, NAND, HBM and storage products used across AI, data center, PC, mobile and automotive markets" },

    // DOWNSTREAM LAYER +1 — DIRECT AI CUSTOMER
    { id: "nvda", ticker: "NVDA", name: "NVIDIA", role: "NVIDIA explicitly identifies Micron as a memory supplier for its accelerated-computing products" },

    // DOWNSTREAM LAYER +2 — NVIDIA HYPERSCALE DEMAND
    { id: "amzn", ticker: "AMZN", name: "Amazon Web Services", role: "hyperscale buyer of NVIDIA accelerated-computing infrastructure containing high-bandwidth memory" },
    { id: "msft", ticker: "MSFT", name: "Microsoft Azure", role: "hyperscale buyer of NVIDIA accelerated-computing infrastructure containing high-bandwidth memory" },
    { id: "meta", ticker: "META", name: "Meta Platforms", role: "large direct deployer of NVIDIA accelerated-computing infrastructure containing high-bandwidth memory" },
    { id: "googl", ticker: "GOOGL", name: "Google Cloud", role: "cloud deployer of NVIDIA accelerated-computing infrastructure containing high-bandwidth memory" }
  ],

  edges: [
    // CAPITAL EQUIPMENT → WAFER FAB
    { source: "lrcx", target: "mu_wafer_fab" },
    { source: "asml", target: "mu_wafer_fab" },

    // WAFER FAB → MEMORY PROCESSING
    { source: "mu_wafer_fab", target: "mu_memory_process" },

    // MEMORY PROCESSING → ASSEMBLY / TEST
    { source: "mu_memory_process", target: "mu_assembly_test" },

    // ASSEMBLY / TEST → MICRON
    { source: "mu_assembly_test", target: "mu" },

    // MICRON → NVIDIA
    { source: "mu", target: "nvda" },

    // NVIDIA → HYPERSCALE DEMAND
    { source: "nvda", target: "amzn" },
    { source: "nvda", target: "msft" },
    { source: "nvda", target: "meta" },
    { source: "nvda", target: "googl" },

    // EXPANDED DENSITY — VERIFIED RELATIONSHIPS
    { source: "amat", target: "mu_wafer_fab" },
    { source: "sbgsy", target: "mu_wafer_fab" },
    { source: "fujiy", target: "mu_wafer_fab" },
    { source: "mraay", target: "mu_assembly_test" },
    { source: "mpwr", target: "mu_assembly_test" },

  ]
},

"BRK.B": {
  name: "Berkshire Hathaway",
  root: "brkb",
  nodes: [
    // UPSTREAM LAYER -4 — PCC SPECIALTY MATERIAL INPUTS
    { id: "pcc_raw_materials", ticker: null, name: "PCC Specialty Alloy Inputs", role: "nickel-, titanium- and cobalt-based alloy inputs used across Berkshire's Precision Castparts aerospace and industrial manufacturing operations" },

    // UPSTREAM LAYER -3 — ALLOY / FORGING PROCESSES
    { id: "pcc_alloy_forging", ticker: null, name: "PCC Alloy, Casting & Forging", role: "Precision Castparts' vertically integrated melting, investment-casting, forging and specialty-alloy manufacturing processes" },

    // UPSTREAM LAYER -2 — PRECISION AEROSPACE COMPONENTS
    { id: "pcc_components", ticker: null, name: "Precision Aerospace Components", role: "investment castings, forgings, fasteners, aerostructures and other critical components produced for aerospace and power applications" },

    // UPSTREAM LAYER -1 — OPERATING SUBSIDIARY
    { id: "pcc", ticker: null, name: "Precision Castparts (Berkshire Subsidiary)", role: "major Berkshire industrial subsidiary supplying complex metal components to global aerospace and power customers" },

    // CENTER
    { id: "brkb", ticker: "BRK.B", name: "Berkshire Hathaway", role: "decentralized holding company owning insurance, BNSF, Berkshire Hathaway Energy and a broad portfolio of manufacturing, service and retail businesses" },

    // DOWNSTREAM LAYER +1 — OPERATING BUSINESS OUTPUT
    { id: "brk_aerospace_channel", ticker: null, name: "PCC Aerospace Customer Channel", role: "Berkshire's aerospace-components revenue channel serving aircraft and engine OEM programs through Precision Castparts" },
    { id: "brk_freight_channel", ticker: null, name: "BNSF Freight Network", role: "Berkshire's railroad network moving consumer, industrial, agricultural and energy freight across North America" },

    // DOWNSTREAM LAYER +2 — MAJOR END MARKETS
    { id: "ba", ticker: "BA", name: "Boeing", role: "major long-running customer/end market for Precision Castparts aerospace components" },
    { id: "ge", ticker: "GE", name: "GE Aerospace", role: "major aerospace-engine end market for Precision Castparts castings and forgings" },
    { id: "rtx", ticker: "RTX", name: "RTX", role: "major aerospace-engine and defense end market for Precision Castparts components" },
    { id: "brk_shippers", ticker: null, name: "Industrial & Consumer Shippers", role: "customers purchasing BNSF rail transportation across merchandise, agricultural, industrial and intermodal categories" }
  ],

  edges: [
    // MATERIALS → PCC MANUFACTURING
    { source: "pcc_raw_materials", target: "pcc_alloy_forging" },
    { source: "pcc_alloy_forging", target: "pcc_components" },
    { source: "pcc_components", target: "pcc" },

    // PCC → BERKSHIRE
    { source: "pcc", target: "brkb" },

    // BERKSHIRE → OPERATING CHANNELS
    { source: "brkb", target: "brk_aerospace_channel" },
    { source: "brkb", target: "brk_freight_channel" },

    // OPERATING CHANNELS → END MARKETS
    { source: "brk_aerospace_channel", target: "ba" },
    { source: "brk_aerospace_channel", target: "ge" },
    { source: "brk_aerospace_channel", target: "rtx" },
    { source: "brk_freight_channel", target: "brk_shippers" }
  ]
},

LLY: {
  name: "Eli Lilly",
  root: "lly",
  nodes: [
    // UPSTREAM LAYER -4 — AI / SCIENTIFIC COMPUTE
    { id: "nvda", ticker: "NVDA", name: "NVIDIA", role: "strategic Lilly AI partner supplying the computing architecture and BioNeMo platform behind Lilly's AI factory and co-innovation lab" },

    // UPSTREAM LAYER -3 — AI FACTORY
    { id: "lilly_ai_factory", ticker: null, name: "Lilly AI Factory / LillyPod", role: "Lilly-owned NVIDIA-powered supercomputing infrastructure used to train biomedical models and support drug discovery, manufacturing and enterprise AI" },

    // UPSTREAM LAYER -2 — DISCOVERY / DEVELOPMENT
    { id: "lilly_discovery", ticker: null, name: "AI-Enabled Drug Discovery & Development", role: "scientific modeling, molecule identification, optimization and validation workflows accelerated by Lilly's AI infrastructure" },
    { id: "lilly_cmo_network", ticker: null, name: "Third-Party Manufacturing Network", role: "unnamed third parties Lilly discloses for selected API manufacturing, filling, finishing, packaging and device/component production" },

    // UPSTREAM LAYER -1 — MANUFACTURING / RELEASE
    { id: "lilly_manufacturing", ticker: null, name: "Lilly Manufacturing & Product Release", role: "Lilly's global formulation, filling, device assembly, packaging and quality-release network for commercial medicines" },

    // CENTER
    { id: "lly", ticker: "LLY", name: "Eli Lilly", role: "researches, develops, manufactures and commercializes medicines across diabetes/obesity, oncology, immunology, neuroscience and other therapeutic areas" },

    // DOWNSTREAM LAYER +1 — U.S. WHOLESALE DISTRIBUTORS
    { id: "mck", ticker: "MCK", name: "McKesson", role: "one of three U.S. wholesale distributors that each represented a significant percentage of Lilly consolidated revenue in 2025" },
    { id: "cor", ticker: "COR", name: "Cencora", role: "one of three major U.S. wholesale distributors handling Lilly medicines" },
    { id: "cah", ticker: "CAH", name: "Cardinal Health", role: "one of three major U.S. wholesale distributors handling Lilly medicines" },

    // DOWNSTREAM LAYER +2 — CARE DELIVERY
    { id: "lilly_care_delivery", ticker: null, name: "Pharmacies, Physicians & Hospitals", role: "care-delivery channels served by wholesalers and direct arrangements before Lilly medicines reach patients" }
  ],

  edges: [
    // NVIDIA → AI FACTORY
    { source: "nvda", target: "lilly_ai_factory" },

    // AI FACTORY → DISCOVERY
    { source: "lilly_ai_factory", target: "lilly_discovery" },

    // DISCOVERY / THIRD-PARTY MANUFACTURING → LILLY MANUFACTURING
    { source: "lilly_discovery", target: "lilly_manufacturing" },
    { source: "lilly_cmo_network", target: "lilly_manufacturing" },

    // MANUFACTURING → LILLY
    { source: "lilly_manufacturing", target: "lly" },

    // LILLY → WHOLESALERS
    { source: "lly", target: "mck" },
    { source: "lly", target: "cor" },
    { source: "lly", target: "cah" },

    // WHOLESALERS → CARE DELIVERY
    { source: "mck", target: "lilly_care_delivery" },
    { source: "cor", target: "lilly_care_delivery" },
    { source: "cah", target: "lilly_care_delivery" }
  ]
},

AMD: {
  name: "Advanced Micro Devices",
  root: "amd",
  nodes: [
    // UPSTREAM LAYER -4 — SEMICONDUCTOR EQUIPMENT
    { id: "asml", ticker: "ASML", name: "ASML", role: "advanced lithography supplier to leading foundries used in AMD's outsourced manufacturing model" },

    // UPSTREAM LAYER -3 — THIRD-PARTY FOUNDRIES
    { id: "tsm", ticker: "TSM", name: "TSMC", role: "AMD's disclosed foundry for HPC, FPGA and adaptive-SoC wafers and other leading-edge products" },
    { id: "gfs", ticker: "GFS", name: "GlobalFoundries", role: "AMD-disclosed foundry for selected HPC wafer production at 12nm and 14nm technology nodes" },
    { id: "umc", ticker: "UMC", name: "United Microelectronics", role: "AMD-disclosed foundry used for selected programmable-logic integrated circuits" },

    // UPSTREAM LAYER -2 — WAFER OUTPUT
    { id: "amd_wafer_supply", ticker: null, name: "AMD Wafer Supply", role: "fabricated CPU, GPU, FPGA and adaptive-computing wafers received from AMD's third-party foundry network" },

    // UPSTREAM LAYER -1 — ASSEMBLY / TEST
    { id: "amd_assembly_test", ticker: null, name: "AMD Outsourced Assembly & Test", role: "back-end packaging, assembly and test stage that converts foundry wafer output into finished AMD processors and accelerators" },

    // EXPANDED DENSITY — VERIFIED UPSTREAM / OPERATING PARTNERS
    { id: "amat", ticker: "AMAT", name: "Applied Materials", role: "wafer-fabrication equipment supplier to advanced foundries in AMD’s indirect manufacturing ecosystem" },
    { id: "lrcx", ticker: "LRCX", name: "Lam Research", role: "etch and deposition equipment supplier to advanced foundries supporting AMD wafer production" },
    { id: "klac", ticker: "KLAC", name: "KLA", role: "process-control equipment supplier to leading-edge foundries supporting AMD production" },
    { id: "asx", ticker: "ASX", name: "ASE Technology", role: "parent of Siliconware Precision Industries, one of AMD’s disclosed assembly-test-mark-packaging providers" },

    // CENTER
    { id: "amd", ticker: "AMD", name: "Advanced Micro Devices", role: "designs CPUs, GPUs, adaptive-computing products and rack-scale AI platforms for data center, client, embedded and gaming markets" },

    // DOWNSTREAM LAYER +1 — STRATEGIC AI CUSTOMER
    { id: "meta", ticker: "META", name: "Meta Platforms", role: "multi-year, multi-generation customer under a 2026 agreement to deploy up to 6 GW of AMD Instinct GPUs plus EPYC CPUs" },

    // DOWNSTREAM LAYER +2 — END WORKLOADS
    { id: "meta_ai_services", ticker: null, name: "Meta AI Services & Workloads", role: "training and inference infrastructure supporting Meta recommendation, advertising and generative-AI services" },

    // EXPANDED DENSITY — VERIFIED DOWNSTREAM / DISTRIBUTION PARTNERS
    { id: "msft", ticker: "MSFT", name: "Microsoft Azure", role: "large cloud deployment platform for AMD EPYC CPUs and Instinct accelerators" },
    { id: "googl", ticker: "GOOGL", name: "Google Cloud", role: "cloud platform offering AMD-powered compute instances" },
    { id: "amzn", ticker: "AMZN", name: "Amazon Web Services", role: "cloud platform offering AMD EPYC-powered EC2 instances" },
    { id: "amd_cloud_users", ticker: null, name: "Cloud & AI Workloads", role: "enterprise and AI workloads consuming AMD-powered cloud infrastructure" },
  ],

  edges: [
    // EQUIPMENT → LEADING-EDGE FOUNDRY
    { source: "asml", target: "tsm" },

    // FOUNDRIES → AMD WAFER SUPPLY
    { source: "tsm", target: "amd_wafer_supply" },
    { source: "gfs", target: "amd_wafer_supply" },
    { source: "umc", target: "amd_wafer_supply" },

    // WAFERS → ASSEMBLY / TEST
    { source: "amd_wafer_supply", target: "amd_assembly_test" },

    // ASSEMBLY / TEST → AMD
    { source: "amd_assembly_test", target: "amd" },

    // AMD → META
    { source: "amd", target: "meta" },

    // META → AI WORKLOADS
    { source: "meta", target: "meta_ai_services" },

    // EXPANDED DENSITY — VERIFIED RELATIONSHIPS
    { source: "amat", target: "tsm" },
    { source: "lrcx", target: "tsm" },
    { source: "klac", target: "tsm" },
    { source: "asx", target: "amd_assembly_test" },
    { source: "amd", target: "msft" },
    { source: "amd", target: "googl" },
    { source: "amd", target: "amzn" },
    { source: "msft", target: "amd_cloud_users" },
    { source: "googl", target: "amd_cloud_users" },
    { source: "amzn", target: "amd_cloud_users" },

  ]
},

JPM: {
  name: "JPMorgan Chase",
  root: "jpm",
  nodes: [
    // UPSTREAM LAYER -4 — PUBLIC CLOUD INFRASTRUCTURE
    { id: "amzn", ticker: "AMZN", name: "Amazon Web Services", role: "strategic cloud collaborator and technology provider used across JPMorgan Chase's multi-cloud modernization; AWS services support large-scale JPMC application observability and infrastructure" },

    // UPSTREAM LAYER -3 — CLOUD FOUNDATION
    { id: "jpm_cloud", ticker: null, name: "JPMC Cloud Foundation", role: "security, container, compute and observability layer supporting modernized JPMorgan Chase applications across cloud environments" },

    // UPSTREAM LAYER -2 — DATA / SOFTWARE PLATFORM
    { id: "jpm_data_platform", ticker: null, name: "JPMC Data & Software Platform", role: "internal data, API and software-engineering layer used by the firm's banking, markets and payments businesses" },

    // UPSTREAM LAYER -1 — TRANSACTION / RISK SYSTEMS
    { id: "jpm_core_systems", ticker: null, name: "Banking, Payments & Risk Systems", role: "mission-critical internal platforms that authorize transactions, manage risk, move money and support client-facing financial products" },
    { id: "visa", ticker: "V", name: "Visa", role: "documented payments-network partner connecting Chase issuing platforms, third-party processors and Paymentech merchants and supporting Visa Direct money movement" },

    // EXPANDED DENSITY — VERIFIED UPSTREAM / OPERATING PARTNERS
    { id: "ma", ticker: "MA", name: "Mastercard", role: "payment-network partner supporting Chase-issued cards and co-brand payment products" },

    // CENTER
    { id: "jpm", ticker: "JPM", name: "JPMorgan Chase", role: "global bank operating consumer banking, commercial banking, markets, asset/wealth management and one of the world's largest payment businesses" },

    // DOWNSTREAM LAYER +1 — CLIENT PLATFORMS
    { id: "jpm_payments", ticker: null, name: "J.P. Morgan Payments", role: "treasury, merchant acquiring, card and money-movement services delivered to corporate, financial-institution and fintech clients" },
    { id: "chase_consumer", ticker: null, name: "Chase Consumer & Small Business", role: "deposit, lending, card and digital-banking channel serving households and small businesses" },

    // DOWNSTREAM LAYER +2 — END CLIENTS
    { id: "jpm_business_clients", ticker: null, name: "Corporate, Merchant & Fintech Clients", role: "businesses using J.P. Morgan for treasury, payments, acquiring, liquidity and money movement" },
    { id: "jpm_consumers", ticker: null, name: "Consumers & Small Businesses", role: "customers using Chase deposits, credit cards, lending, investment and digital-banking products" }
  ],

  edges: [
    // AWS → CLOUD FOUNDATION
    { source: "amzn", target: "jpm_cloud" },

    // CLOUD FOUNDATION → DATA PLATFORM
    { source: "jpm_cloud", target: "jpm_data_platform" },

    // DATA PLATFORM → CORE SYSTEMS
    { source: "jpm_data_platform", target: "jpm_core_systems" },

    // CORE SYSTEMS / PAYMENT RAILS → JPMORGAN CHASE
    { source: "jpm_core_systems", target: "jpm" },
    { source: "visa", target: "jpm" },

    // JPMORGAN CHASE → CLIENT PLATFORMS
    { source: "jpm", target: "jpm_payments" },
    { source: "jpm", target: "chase_consumer" },

    // CLIENT PLATFORMS → END CLIENTS
    { source: "jpm_payments", target: "jpm_business_clients" },
    { source: "chase_consumer", target: "jpm_consumers" },

    // EXPANDED DENSITY — VERIFIED RELATIONSHIPS
    { source: "ma", target: "jpm" },

  ]
},

WMT: {
  name: "Walmart",
  root: "wmt",
  nodes: [
    // UPSTREAM LAYER -4 — PREPAID SUPPLIERS
    { id: "wmt_suppliers", ticker: null, name: "Walmart Prepaid Suppliers", role: "suppliers that arrange inbound transportation and can participate in Walmart's 2026 Prepaid Consolidation program" },

    // UPSTREAM LAYER -3 — APPROVED 3PL CONSOLIDATORS
    { id: "chrw", ticker: "CHRW", name: "C.H. Robinson", role: "one of three Walmart-approved third-party logistics providers in the 2026 Prepaid Consolidation program" },
    { id: "hubg", ticker: "HUBG", name: "Hub Group", role: "one of three participating logistics providers supporting Walmart's national Prepaid Consolidation program" },

    // UPSTREAM LAYER -2 — AUTOMATED CONSOLIDATION CENTER
    { id: "wmt_acc", ticker: null, name: "Walmart Automated Consolidation Center", role: "single national destination where inbound supplier freight is consolidated before allocation across Walmart's regional network" },

    // UPSTREAM LAYER -1 — REGIONAL DISTRIBUTION
    { id: "wmt_rdcs", ticker: null, name: "42 Walmart Regional Distribution Centers", role: "regional distribution layer receiving consolidated inventory and replenishing Walmart stores and fulfillment channels" },

    // EXPANDED DENSITY — VERIFIED UPSTREAM / OPERATING PARTNERS
    { id: "wmt_inbound_merchandise", ticker: null, name: "High-Volume Branded Merchandise Inbound", role: "inbound merchandise layer connecting major branded suppliers into Walmart’s distribution network" },
    { id: "wmt_supplier_distribution", ticker: null, name: "Supplier Freight Allocation & Distribution", role: "general supplier-freight allocation stage moving branded merchandise into Walmart’s regional distribution network without assuming use of a single consolidation route" },
    { id: "pg", ticker: "PG", name: "Procter & Gamble", role: "major Walmart supplier; Walmart represented about 16% of P&G fiscal 2026 sales" },
    { id: "pep", ticker: "PEP", name: "PepsiCo", role: "major Walmart and Sam’s supplier; approximately 14% of PepsiCo 2025 revenue came from Walmart and affiliates" },
    { id: "tsn", ticker: "TSN", name: "Tyson Foods", role: "major food supplier; Walmart represented approximately 18.7% of Tyson fiscal 2025 sales" },
    { id: "cag", ticker: "CAG", name: "Conagra Brands", role: "major packaged-food supplier; Walmart represented approximately 29% of Conagra fiscal 2026 sales" },
    { id: "gis", ticker: "GIS", name: "General Mills", role: "major food supplier; Walmart represented approximately 22% of General Mills fiscal 2026 net sales" },
    { id: "sym", ticker: "SYM", name: "Symbotic", role: "warehouse automation partner supplying systems used to automate Walmart distribution operations" },

    // CENTER
    { id: "wmt", ticker: "WMT", name: "Walmart", role: "global omnichannel retailer operating Walmart stores, Walmart.com, Sam's Club, fulfillment and marketplace businesses" },

    // DOWNSTREAM LAYER +1 — CUSTOMER-FACING CHANNELS
    { id: "wmt_stores_ecom", ticker: null, name: "Walmart Stores & E-Commerce", role: "store, pickup, delivery and Walmart.com channels converting distributed inventory into retail sales" },
    { id: "sams_club", ticker: null, name: "Sam's Club", role: "membership warehouse channel serving consumers and small businesses" },

    // DOWNSTREAM LAYER +2 — END DEMAND
    { id: "wmt_customers", ticker: null, name: "Walmart Retail Customers", role: "households and businesses purchasing grocery, general merchandise and services through Walmart channels" },
    { id: "sams_members", ticker: null, name: "Sam's Club Members", role: "membership customers purchasing warehouse-club merchandise, fuel and services" }
  ],

  edges: [
    // SUPPLIERS → APPROVED 3PL ROUTE
    { source: "wmt_suppliers", target: "chrw" },
    { source: "wmt_suppliers", target: "hubg" },

    // 3PLs → AUTOMATED CONSOLIDATION CENTER
    { source: "chrw", target: "wmt_acc" },
    { source: "hubg", target: "wmt_acc" },

    // CONSOLIDATION → REGIONAL DISTRIBUTION
    { source: "wmt_acc", target: "wmt_rdcs" },

    // REGIONAL DISTRIBUTION → WALMART
    { source: "wmt_rdcs", target: "wmt" },

    // WALMART → CUSTOMER-FACING CHANNELS
    { source: "wmt", target: "wmt_stores_ecom" },
    { source: "wmt", target: "sams_club" },

    // CHANNELS → END DEMAND
    { source: "wmt_stores_ecom", target: "wmt_customers" },
    { source: "sams_club", target: "sams_members" },

    // EXPANDED DENSITY — VERIFIED RELATIONSHIPS
    { source: "pg", target: "wmt_inbound_merchandise" },
    { source: "pep", target: "wmt_inbound_merchandise" },
    { source: "tsn", target: "wmt_inbound_merchandise" },
    { source: "cag", target: "wmt_inbound_merchandise" },
    { source: "gis", target: "wmt_inbound_merchandise" },
    { source: "wmt_inbound_merchandise", target: "wmt_supplier_distribution" },
    { source: "wmt_supplier_distribution", target: "wmt_rdcs" },
    { source: "sym", target: "wmt_rdcs" },

  ]
},

V: {
  name: "Visa",
  root: "visa",
  nodes: [
    // UPSTREAM LAYER -4 — ISSUER / ACQUIRER PARTICIPANT
    { id: "jpm", ticker: "JPM", name: "JPMorgan Chase", role: "documented Visa network partner spanning Chase issuing, Paymentech merchant processing and Visa Direct money-movement services" },

    // UPSTREAM LAYER -3 — TRANSACTION ORIGINATION
    { id: "visa_transaction_input", ticker: null, name: "Visa Transaction Origination", role: "card, credential and merchant transaction messages entering the Visa ecosystem through issuer, acquirer and processor connections" },

    // UPSTREAM LAYER -2 — AUTHORIZATION
    { id: "visa_authorization", ticker: null, name: "Visa Authorization", role: "VisaNet routing and risk controls connect transaction requests to issuers for approval or decline" },

    // UPSTREAM LAYER -1 — CLEARING / SETTLEMENT
    { id: "visa_clearing_settlement", ticker: null, name: "Visa Clearing & Settlement", role: "network processes that exchange transaction information and facilitate settlement among participating financial institutions" },

    // EXPANDED DENSITY — VERIFIED UPSTREAM / OPERATING PARTNERS
    { id: "bac", ticker: "BAC", name: "Bank of America", role: "Visa-listed merchant payment provider and acquiring-bank participant in the Visa acceptance ecosystem" },
    { id: "cof", ticker: "COF", name: "Capital One", role: "Visa-listed merchant payment provider and financial-institution participant in Visa acceptance" },
    { id: "c", ticker: "C", name: "Citigroup", role: "Visa-listed merchant payment provider through Citi Merchant Services" },

    // CENTER
    { id: "visa", ticker: "V", name: "Visa", role: "global payments network connecting consumers, merchants, financial institutions, fintechs and governments through VisaNet and money-movement services" },

    // DOWNSTREAM LAYER +1 — MONEY MOVEMENT / ACCEPTANCE
    { id: "visa_direct", ticker: null, name: "Visa Direct", role: "push-payment and money-movement platform used by banks, fintechs and businesses for domestic and cross-border payouts" },
    { id: "visa_acceptance", ticker: null, name: "Visa Merchant Acceptance", role: "acquirer and processor ecosystem enabling merchants to accept Visa credentials in physical and digital commerce" },

    // DOWNSTREAM LAYER +2 — END USE
    { id: "visa_business_clients", ticker: null, name: "Banks, Fintechs & Business Clients", role: "organizations embedding Visa money-movement and payment capabilities into customer products" },
    { id: "visa_merchants_consumers", ticker: null, name: "Merchants & Consumers", role: "businesses accepting Visa and cardholders using Visa credentials for purchases and transfers" },

    // EXPANDED DENSITY — VERIFIED DOWNSTREAM / DISTRIBUTION PARTNERS
    { id: "wmt", ticker: "WMT", name: "Walmart", role: "representative large merchant acceptance endpoint for Visa transactions; not a customer-concentration claim" },
    { id: "cost", ticker: "COST", name: "Costco", role: "large U.S. merchant acceptance endpoint for Visa credit-card transactions" },
    { id: "amzn", ticker: "AMZN", name: "Amazon", role: "representative large e-commerce merchant acceptance endpoint for Visa transactions" },
    { id: "hd", ticker: "HD", name: "Home Depot", role: "representative large retail merchant acceptance endpoint for Visa transactions" },
    { id: "tgt", ticker: "TGT", name: "Target", role: "representative large retail merchant acceptance endpoint for Visa transactions" },
  ],

  edges: [
    // PARTICIPANT → TRANSACTION INPUT
    { source: "jpm", target: "visa_transaction_input" },

    // TRANSACTION INPUT → AUTHORIZATION
    { source: "visa_transaction_input", target: "visa_authorization" },

    // AUTHORIZATION → CLEARING / SETTLEMENT
    { source: "visa_authorization", target: "visa_clearing_settlement" },

    // CLEARING / SETTLEMENT → VISA
    { source: "visa_clearing_settlement", target: "visa" },

    // VISA → DISTRIBUTION / MONEY MOVEMENT
    { source: "visa", target: "visa_direct" },
    { source: "visa", target: "visa_acceptance" },

    // DISTRIBUTION → END USE
    { source: "visa_direct", target: "visa_business_clients" },
    { source: "visa_acceptance", target: "visa_merchants_consumers" },

    // EXPANDED DENSITY — VERIFIED RELATIONSHIPS
    { source: "bac", target: "visa_transaction_input" },
    { source: "cof", target: "visa_transaction_input" },
    { source: "c", target: "visa_transaction_input" },
    { source: "visa_acceptance", target: "wmt" },
    { source: "visa_acceptance", target: "cost" },
    { source: "visa_acceptance", target: "amzn" },
    { source: "visa_acceptance", target: "hd" },
    { source: "visa_acceptance", target: "tgt" },

  ]
},

XOM: {
  name: "Exxon Mobil",
  root: "xom",
  nodes: [
    // UPSTREAM LAYER -4 — CRUDE MIDSTREAM / MERCHANT SUPPLY
    { id: "paa", ticker: "PAA", name: "Plains All American Pipeline", role: "major crude-oil midstream and merchant counterparty; ExxonMobil and subsidiaries represented about 31% of Plains' 2025 revenue, mostly in crude-oil merchant activities" },

    // UPSTREAM LAYER -3 — CRUDE LOGISTICS
    { id: "xom_crude_logistics", ticker: null, name: "Crude Gathering, Transport & Storage", role: "pipeline, terminal, storage and marine logistics that aggregate crude feedstock and move it toward ExxonMobil refining systems" },

    // UPSTREAM LAYER -2 — REFINING / CONVERSION
    { id: "xom_refining", ticker: null, name: "ExxonMobil Refining & Conversion", role: "integrated refining operations converting crude and other feedstocks into fuels, lubricants and feedstocks for further manufacturing" },

    // UPSTREAM LAYER -1 — PRODUCT SUPPLY
    { id: "xom_product_supply", ticker: null, name: "Fuels & Product Supply", role: "bulk product storage, blending, scheduling and distribution stage connecting refinery output to branded and wholesale channels" },

    // EXPANDED DENSITY — VERIFIED UPSTREAM / OPERATING PARTNERS
    { id: "bkr", ticker: "BKR", name: "Baker Hughes", role: "documented ExxonMobil supplier recognized for turbomachinery predictive-maintenance innovation" },
    { id: "hal", ticker: "HAL", name: "Halliburton", role: "documented ExxonMobil wells supplier recognized in the company’s Supplier Excellence program" },
    { id: "unp", ticker: "UNP", name: "Union Pacific", role: "documented ExxonMobil transportation and logistics supplier recognized in the company’s Supplier Excellence program" },
    { id: "xom_field_services", ticker: null, name: "Upstream Wells & Field Services", role: "field-service layer supporting drilling, completion, rotating equipment and production operations before hydrocarbons enter transport and refining systems" },

    // CENTER
    { id: "xom", ticker: "XOM", name: "Exxon Mobil", role: "integrated energy company spanning upstream production, refining, fuels, lubricants, chemicals and low-carbon businesses" },

    // DOWNSTREAM LAYER +1 — DISTRIBUTION / INDUSTRIAL CHANNELS
    { id: "capl", ticker: "CAPL", name: "CrossAmerica Partners", role: "large independent motor-fuel distributor whose network includes Exxon- and Mobil-branded fuel supply relationships" },
    { id: "xom_chemical_channel", ticker: null, name: "ExxonMobil Chemical & Industrial Sales", role: "sales channel for petrochemical, specialty and industrial products into manufacturing value chains" },

    // DOWNSTREAM LAYER +2 — END MARKETS
    { id: "xom_fuel_sites", ticker: null, name: "Branded Fuel Sites & Drivers", role: "dealer/reseller sites and end motorists purchasing Exxon- and Mobil-branded fuels" },
    { id: "xom_industrial_customers", ticker: null, name: "Industrial & Manufacturing Customers", role: "customers using ExxonMobil chemical, polymer, lubricant and other industrial products" }
  ],

  edges: [
    // MIDSTREAM → CRUDE LOGISTICS
    { source: "paa", target: "xom_crude_logistics" },

    // CRUDE LOGISTICS → REFINING
    { source: "xom_crude_logistics", target: "xom_refining" },

    // REFINING → PRODUCT SUPPLY
    { source: "xom_refining", target: "xom_product_supply" },

    // PRODUCT SUPPLY → EXXONMOBIL
    { source: "xom_product_supply", target: "xom" },

    // EXXONMOBIL → DOWNSTREAM CHANNELS
    { source: "xom", target: "capl" },
    { source: "xom", target: "xom_chemical_channel" },

    // CHANNELS → END MARKETS
    { source: "capl", target: "xom_fuel_sites" },
    { source: "xom_chemical_channel", target: "xom_industrial_customers" },

    // EXPANDED DENSITY — VERIFIED RELATIONSHIPS
    { source: "bkr", target: "xom_field_services" },
    { source: "hal", target: "xom_field_services" },
    { source: "xom_field_services", target: "xom_refining" },
    { source: "unp", target: "xom_crude_logistics" },

  ]
},

JNJ: {
  name: "Johnson & Johnson",
  root: "jnj",
  nodes: [
    // UPSTREAM LAYER -4 — RAW MATERIAL / COMPONENT SUPPLIERS
    { id: "jnj_raw_suppliers", ticker: null, name: "J&J Raw Material & Component Suppliers", role: "large global supplier base providing raw materials, device components and other inputs; J&J does not publicly identify most counterparties by name" },

    // UPSTREAM LAYER -3 — EXTERNAL MANUFACTURING / SERVICES
    { id: "jnj_external_manufacturing", ticker: null, name: "Third-Party Manufacturing & Services", role: "external manufacturing, testing, technology and logistics capacity used alongside Johnson & Johnson's internal network" },

    // UPSTREAM LAYER -2 — INTERNAL MANUFACTURING
    { id: "jnj_internal_manufacturing", ticker: null, name: "J&J Manufacturing Network", role: "global pharmaceutical and MedTech manufacturing network converting materials and components into commercial products" },

    // UPSTREAM LAYER -1 — QUALITY / PRODUCT RELEASE
    { id: "jnj_quality_release", ticker: null, name: "Quality, Regulatory & Product Release", role: "validated testing, quality-control and regulatory-release stage required before J&J products enter commercial distribution" },

    // CENTER
    { id: "jnj", ticker: "JNJ", name: "Johnson & Johnson", role: "global healthcare company focused on Innovative Medicine and MedTech products" },

    // DOWNSTREAM LAYER +1 — AUTHORIZED U.S. DISTRIBUTORS
    { id: "mck", ticker: "MCK", name: "McKesson", role: "current authorized wholesale/specialty distributor for Johnson & Johnson Innovative Medicine products" },
    { id: "cah", ticker: "CAH", name: "Cardinal Health", role: "current authorized wholesale/specialty distributor for Johnson & Johnson Innovative Medicine products" },
    { id: "cor", ticker: "COR", name: "Cencora", role: "current authorized wholesale and specialty distribution group for Johnson & Johnson Innovative Medicine products" },
    { id: "cvs", ticker: "CVS", name: "CVS Health", role: "authorized pharmacy / distribution channel appearing in Johnson & Johnson's current distributor network" },

    // DOWNSTREAM LAYER +2 — CARE DELIVERY
    { id: "jnj_care_delivery", ticker: null, name: "Pharmacies, Providers & Patients", role: "pharmacies, hospitals, physicians and other care settings through which J&J medicines and medical products reach patients" },

    // EXPANDED DENSITY — VERIFIED DOWNSTREAM / DISTRIBUTION PARTNERS
    { id: "hsic", ticker: "HSIC", name: "Henry Schein", role: "authorized specialty distributor for multiple Johnson & Johnson Innovative Medicine products" },
  ],

  edges: [
    // RAW MATERIALS → EXTERNAL MANUFACTURING
    { source: "jnj_raw_suppliers", target: "jnj_external_manufacturing" },

    // EXTERNAL → INTERNAL MANUFACTURING
    { source: "jnj_external_manufacturing", target: "jnj_internal_manufacturing" },

    // MANUFACTURING → QUALITY / RELEASE
    { source: "jnj_internal_manufacturing", target: "jnj_quality_release" },

    // QUALITY / RELEASE → J&J
    { source: "jnj_quality_release", target: "jnj" },

    // J&J → AUTHORIZED DISTRIBUTORS
    { source: "jnj", target: "mck" },
    { source: "jnj", target: "cah" },
    { source: "jnj", target: "cor" },
    { source: "jnj", target: "cvs" },

    // DISTRIBUTORS → CARE DELIVERY
    { source: "mck", target: "jnj_care_delivery" },
    { source: "cah", target: "jnj_care_delivery" },
    { source: "cor", target: "jnj_care_delivery" },
    { source: "cvs", target: "jnj_care_delivery" },

    // EXPANDED DENSITY — VERIFIED RELATIONSHIPS
    { source: "jnj", target: "hsic" },
    { source: "hsic", target: "jnj_care_delivery" },

  ]
},

INTC: {
  name: "Intel",
  root: "intc",
  nodes: [
    // UPSTREAM LAYER -4 — SEMICONDUCTOR EQUIPMENT / PROCESS SUPPLIERS
    { id: "asml", ticker: "ASML", name: "ASML", role: "2026 Intel EPIC Supplier Award recipient and critical lithography-equipment partner supporting Intel's wafer-fab roadmap" },
    { id: "amat", ticker: "AMAT", name: "Applied Materials", role: "2026 Intel EPIC Supplier Award recipient for technology development and major semiconductor-process-equipment supplier" },
    { id: "lrcx", ticker: "LRCX", name: "Lam Research", role: "2026 Intel EPIC Supplier Award recipient and major wafer-fabrication equipment supplier" },
    { id: "klac", ticker: "KLAC", name: "KLA", role: "2026 Intel EPIC Supplier Award recipient for technology development and semiconductor process-control equipment" },

    // UPSTREAM LAYER -3 — WAFER FABRICATION
    { id: "intel_fabs", ticker: null, name: "Intel Wafer Fabs", role: "Intel's internal wafer-fabrication network using lithography, deposition, etch and process-control equipment to manufacture logic silicon" },

    // UPSTREAM LAYER -2 — ADVANCED PACKAGING
    { id: "intel_packaging", ticker: null, name: "Intel Advanced Packaging", role: "advanced package integration stage including chiplet and heterogeneous-integration technologies that combine fabricated dies into finished processors" },

    // UPSTREAM LAYER -1 — PRODUCT VALIDATION
    { id: "intel_validation", ticker: null, name: "Intel Product Test & Validation", role: "electrical test, validation, binning and qualification stage before finished Intel products ship to OEM and data-center customers" },

    // EXPANDED DENSITY — VERIFIED UPSTREAM / OPERATING PARTNERS
    { id: "intel_supporting_suppliers", ticker: null, name: "Intel Supporting Silicon & Manufacturing Suppliers", role: "specialized supplier layer supporting test, power, cleaning, foundry and process technology around Intel products" },
    { id: "form", ticker: "FORM", name: "FormFactor", role: "2026 Intel EPIC supplier award recipient for sort-test development" },
    { id: "ifnny", ticker: "IFNNY", name: "Infineon Technologies", role: "2026 Intel EPIC supplier award recipient for platform power-management solutions" },
    { id: "uctt", ticker: "UCTT", name: "Ultra Clean Holdings", role: "2026 Intel EPIC supplier award recipient for parts-clean cost, quality and delivery" },
    { id: "umc", ticker: "UMC", name: "United Microelectronics", role: "2026 Intel EPIC supplier award recipient for quality management" },
    { id: "veco", ticker: "VECO", name: "Veeco Instruments", role: "2026 Intel EPIC supplier award recipient for anneal technology" },

    // CENTER
    { id: "intc", ticker: "INTC", name: "Intel", role: "designs and manufactures CPUs and other semiconductor products while operating Intel Foundry and advanced packaging businesses" },

    // DOWNSTREAM LAYER +1 — PC OEMS
    { id: "dell", ticker: "DELL", name: "Dell Technologies", role: "current PC OEM selling Dell Pro systems configured with Intel Core and Core Ultra processors" },
    { id: "hpq", ticker: "HPQ", name: "HP Inc.", role: "current PC OEM selling broad commercial and consumer systems built around Intel Core Ultra processors" },

    // DOWNSTREAM LAYER +2 — END DEMAND
    { id: "intel_pc_users", ticker: null, name: "Enterprise, Cloud & Consumer Compute Users", role: "organizations and consumers using Intel-powered PCs and cloud compute delivered through OEM and hyperscale platforms" },

    // EXPANDED DENSITY — VERIFIED DOWNSTREAM / DISTRIBUTION PARTNERS
    { id: "amzn", ticker: "AMZN", name: "Amazon Web Services", role: "cloud platform deploying current Intel Xeon-powered EC2 instance families" },
    { id: "googl", ticker: "GOOGL", name: "Google Cloud", role: "cloud platform offering current Intel-powered Compute Engine VM families" },
    { id: "msft", ticker: "MSFT", name: "Microsoft", role: "major Windows and Azure ecosystem customer for Intel client and datacenter processors" },
  ],

  edges: [
    // EQUIPMENT → INTEL FABS
    { source: "asml", target: "intel_fabs" },
    { source: "amat", target: "intel_fabs" },
    { source: "lrcx", target: "intel_fabs" },
    { source: "klac", target: "intel_fabs" },

    // FABS → ADVANCED PACKAGING
    { source: "intel_fabs", target: "intel_packaging" },

    // PACKAGING → VALIDATION
    { source: "intel_packaging", target: "intel_validation" },

    // VALIDATION → INTEL
    { source: "intel_validation", target: "intc" },

    // INTEL → OEMS
    { source: "intc", target: "dell" },
    { source: "intc", target: "hpq" },

    // OEMS → END DEMAND
    { source: "dell", target: "intel_pc_users" },
    { source: "hpq", target: "intel_pc_users" },

    // EXPANDED DENSITY — VERIFIED RELATIONSHIPS
    { source: "form", target: "intel_supporting_suppliers" },
    { source: "ifnny", target: "intel_supporting_suppliers" },
    { source: "uctt", target: "intel_supporting_suppliers" },
    { source: "umc", target: "intel_supporting_suppliers" },
    { source: "veco", target: "intel_supporting_suppliers" },
    { source: "intel_supporting_suppliers", target: "intel_validation" },
    { source: "intc", target: "amzn" },
    { source: "intc", target: "googl" },
    { source: "intc", target: "msft" },
    { source: "amzn", target: "intel_pc_users" },
    { source: "googl", target: "intel_pc_users" },
    { source: "msft", target: "intel_pc_users" },

  ]
},

MA: {
  name: "Mastercard",
  root: "ma",
  nodes: [
    // UPSTREAM LAYER -4 — ISSUER / ACCOUNT-HOLDER INPUT
    { id: "ma_issuers", ticker: null, name: "Mastercard Issuers", role: "banks and financial institutions that issue Mastercard credentials and originate cardholder transactions into the four-party network" },

    // UPSTREAM LAYER -3 — AUTHORIZATION
    { id: "ma_authorization", ticker: null, name: "Mastercard Authorization", role: "network routing stage that sends transaction requests to issuers for approval and returns authorization responses" },

    // UPSTREAM LAYER -2 — CLEARING
    { id: "ma_clearing", ticker: null, name: "Mastercard Clearing", role: "exchange of financial transaction information between issuers and acquirers after authorized transactions" },

    // UPSTREAM LAYER -1 — SETTLEMENT
    { id: "ma_settlement", ticker: null, name: "Mastercard Settlement", role: "facilitation of funds exchange between issuers and acquirers through settlement banks chosen by Mastercard and its customers" },

    // EXPANDED DENSITY — VERIFIED UPSTREAM / OPERATING PARTNERS
    { id: "c", ticker: "C", name: "Citigroup", role: "current Mastercard issuer and first global issuer announced for new Mastercard In Control capabilities" },
    { id: "cof", ticker: "COF", name: "Capital One", role: "current Mastercard issuer with multiple consumer and business Mastercard products" },
    { id: "jpm", ticker: "JPM", name: "JPMorgan Chase", role: "Mastercard issuer and co-brand partner, including the U.S. Aeroplan Mastercard relationship" },

    // CENTER
    { id: "ma", ticker: "MA", name: "Mastercard", role: "global payments technology network linking issuers, acquirers, account holders and merchants across more than 220 countries and territories" },

    // DOWNSTREAM LAYER +1 — ACQUIRING / MONEY MOVEMENT CHANNELS
    { id: "gpn", ticker: "GPN", name: "Global Payments", role: "payment acquirer/processor featured in Mastercard's current acquiring ecosystem and an early supporter of new Mastercard payment capabilities" },
    { id: "mastercard_move", ticker: null, name: "Mastercard Move", role: "money-movement platform distributed through banks, non-bank financial institutions, aggregators and technology partners" },

    // DOWNSTREAM LAYER +2 — END USE
    { id: "ma_merchants", ticker: null, name: "Merchants", role: "businesses receiving Mastercard transactions through acquiring and processing partners" },
    { id: "ma_move_clients", ticker: null, name: "Banks, Fintechs & Payment Platforms", role: "partners embedding Mastercard Move into payout, transfer and disbursement products" },

    // EXPANDED DENSITY — VERIFIED DOWNSTREAM / DISTRIBUTION PARTNERS
    { id: "adyen", ticker: "ADYEY", name: "Adyen", role: "launch ecosystem partner supporting Mastercard Agent Pay for Machines adoption" },
    { id: "coin", ticker: "COIN", name: "Coinbase", role: "launch ecosystem partner supporting Mastercard Agent Pay for Machines adoption" },
    { id: "net", ticker: "NET", name: "Cloudflare", role: "launch ecosystem partner supporting Mastercard Agent Pay for Machines adoption" },
  ],

  edges: [
    // ISSUERS → AUTHORIZATION
    { source: "ma_issuers", target: "ma_authorization" },

    // AUTHORIZATION → CLEARING
    { source: "ma_authorization", target: "ma_clearing" },

    // CLEARING → SETTLEMENT
    { source: "ma_clearing", target: "ma_settlement" },

    // SETTLEMENT → MASTERCARD
    { source: "ma_settlement", target: "ma" },

    // MASTERCARD → CHANNELS
    { source: "ma", target: "gpn" },
    { source: "ma", target: "mastercard_move" },

    // CHANNELS → END USE
    { source: "gpn", target: "ma_merchants" },
    { source: "mastercard_move", target: "ma_move_clients" },

    // EXPANDED DENSITY — VERIFIED RELATIONSHIPS
    { source: "c", target: "ma_authorization" },
    { source: "cof", target: "ma_authorization" },
    { source: "jpm", target: "ma_authorization" },
    { source: "ma", target: "adyen" },
    { source: "ma", target: "coin" },
    { source: "ma", target: "net" },

  ]
},

ABBV: {
  name: "AbbVie",
  root: "abbv",
  nodes: [
    // UPSTREAM LAYER -4 — RAW MATERIAL / COMPONENT SUPPLIERS
    { id: "abbv_raw_suppliers", ticker: null, name: "AbbVie Raw Material & Component Suppliers", role: "global supplier base providing raw materials, APIs, medical-device components and other manufacturing inputs; most counterparties are not publicly named" },

    // UPSTREAM LAYER -3 — API / PRODUCT MANUFACTURING
    { id: "abbv_api_manufacturing", ticker: null, name: "API & Product Manufacturing", role: "AbbVie and third-party manufacturing stage for active pharmaceutical ingredients and commercial drug product" },

    // UPSTREAM LAYER -2 — FORMULATION / FILL-FINISH
    { id: "abbv_fill_finish", ticker: null, name: "Formulation, Fill-Finish & Device Assembly", role: "formulation, fill, finish and device/component production services that AbbVie performs internally and through third parties" },

    // UPSTREAM LAYER -1 — PACKAGING / LOGISTICS RELEASE
    { id: "abbv_pack_logistics", ticker: null, name: "Packaging, Distribution & Logistics Release", role: "packaging, quality release, transportation and logistics stage connecting finished AbbVie products to commercial distribution" },

    // CENTER
    { id: "abbv", ticker: "ABBV", name: "AbbVie", role: "researches, develops, manufactures and commercializes medicines across immunology, oncology, neuroscience, aesthetics and other therapeutic areas" },

    // DOWNSTREAM LAYER +1 — U.S. WHOLESALE DISTRIBUTORS
    { id: "mck", ticker: "MCK", name: "McKesson", role: "one of three wholesale distributors that accounted for substantially all of AbbVie's U.S. pharmaceutical product sales in 2025" },
    { id: "cah", ticker: "CAH", name: "Cardinal Health", role: "one of three wholesale distributors that accounted for substantially all of AbbVie's U.S. pharmaceutical product sales in 2025" },
    { id: "cor", ticker: "COR", name: "Cencora", role: "one of three wholesale distributors that accounted for substantially all of AbbVie's U.S. pharmaceutical product sales in 2025" },

    // DOWNSTREAM LAYER +2 — CARE DELIVERY
    { id: "abbv_care_delivery", ticker: null, name: "Pharmacies, Physicians & Healthcare Facilities", role: "retail, specialty and provider channels through which AbbVie medicines and devices reach patients" }
  ],

  edges: [
    // RAW MATERIALS → API / PRODUCT MANUFACTURING
    { source: "abbv_raw_suppliers", target: "abbv_api_manufacturing" },

    // MANUFACTURING → FORMULATION / FILL-FINISH
    { source: "abbv_api_manufacturing", target: "abbv_fill_finish" },

    // FILL-FINISH → PACKAGING / LOGISTICS
    { source: "abbv_fill_finish", target: "abbv_pack_logistics" },

    // PACKAGING / LOGISTICS → ABBVIE
    { source: "abbv_pack_logistics", target: "abbv" },

    // ABBVIE → WHOLESALERS
    { source: "abbv", target: "mck" },
    { source: "abbv", target: "cah" },
    { source: "abbv", target: "cor" },

    // WHOLESALERS → CARE DELIVERY
    { source: "mck", target: "abbv_care_delivery" },
    { source: "cah", target: "abbv_care_delivery" },
    { source: "cor", target: "abbv_care_delivery" }
  ]
},

PLTR: {
  name: "Palantir Technologies",
  root: "pltr",
  nodes: [
    // UPSTREAM LAYER -4 — ADVANCED SEMICONDUCTOR EQUIPMENT
    { id: "asml", ticker: "ASML", name: "ASML", role: "EUV lithography equipment used by leading-edge foundries; upstream physical infrastructure behind the accelerators used in hyperscale AI clouds" },

    // UPSTREAM LAYER -3 — ADVANCED WAFER FOUNDRY
    { id: "tsm", ticker: "TSM", name: "TSMC", role: "leading-edge foundry manufacturing NVIDIA accelerator silicon used across major cloud AI infrastructure" },

    // UPSTREAM LAYER -2 — AI ACCELERATOR SILICON
    { id: "nvda", ticker: "NVDA", name: "NVIDIA", role: "AI accelerator and networking supplier broadly deployed by AWS, Azure and Google Cloud, providing compute capacity behind hosted model and AI workloads" },

    // UPSTREAM LAYER -1 — CLOUD / MODEL DELIVERY PARTNERS
    { id: "amzn", ticker: "AMZN", name: "Amazon Web Services", role: "Palantir AIP model-delivery partner through Amazon Bedrock; Palantir documents Claude model availability through Bedrock" },
    { id: "msft", ticker: "MSFT", name: "Microsoft Azure", role: "Palantir AIP model-delivery partner; Palantir documents Anthropic Claude model availability through Microsoft Azure" },
    { id: "googl", ticker: "GOOGL", name: "Google Cloud", role: "Palantir AIP model-delivery partner through Vertex AI; Palantir documents Gemini and Claude availability through Vertex AI" },

    // CENTER
    { id: "pltr", ticker: "PLTR", name: "Palantir Technologies", role: "provides Foundry, Gotham, Apollo and AIP software platforms that integrate enterprise data, models and operational workflows" },

    // DOWNSTREAM LAYER +1 — DEPLOYMENT ENVIRONMENTS
    { id: "pltr_commercial", ticker: null, name: "Commercial AIP & Foundry Deployments", role: "enterprise deployments using Palantir software to connect data, AI models and operational decision workflows" },
    { id: "pltr_government", ticker: null, name: "Government & Defense Deployments", role: "public-sector and defense deployments using Gotham, Foundry, Apollo and AIP in mission and operational environments" },

    // DOWNSTREAM LAYER +2 — OPERATIONAL USERS
    { id: "pltr_users", ticker: null, name: "Frontline Operators, Analysts & Decision Makers", role: "end users who consume Palantir applications, analytics, workflows and AI-assisted decisions inside deployed organizations" },

    // EXPANDED DENSITY — VERIFIED / HIGH-CONFIDENCE COMPANY NODES
    { id: "amat", ticker: "AMAT", name: "Applied Materials", role: "wafer-fabrication equipment supplier to leading-edge foundries supporting the AI accelerator supply chain used by hyperscale clouds that host Palantir workloads" },
    { id: "lrcx", ticker: "LRCX", name: "Lam Research", role: "etch and deposition equipment supplier to advanced foundries in the indirect AI-compute supply chain behind Palantir cloud deployments" },
    { id: "klac", ticker: "KLAC", name: "KLA", role: "process-control and inspection equipment supplier to leading-edge semiconductor fabs supporting cloud AI infrastructure" },
    { id: "amd", ticker: "AMD", name: "AMD", role: "CPU and accelerator supplier broadly deployed in hyperscale cloud infrastructure used to host enterprise AI workloads" },
    { id: "avgo", ticker: "AVGO", name: "Broadcom", role: "custom AI and networking silicon supplier to hyperscale cloud infrastructure, including Google's TPU ecosystem" },
    { id: "intc", ticker: "INTC", name: "Intel", role: "server CPU supplier broadly deployed in Microsoft Azure and other cloud infrastructure used by enterprise software workloads" },
    { id: "rio", ticker: "RIO", name: "Rio Tinto", role: "multi-year Palantir Foundry and AIP customer using the platform across mining and rail operations" },
    { id: "bp", ticker: "BP", name: "BP", role: "longstanding Palantir customer using the platform across energy operations and well-failure management" },
    { id: "tsn", ticker: "TSN", name: "Tyson Foods", role: "Palantir customer using Foundry and AIP for supply-chain planning, code migration and operational workflows" },
    { id: "ual", ticker: "UAL", name: "United Airlines", role: "Palantir customer using operational applications for airline maintenance and disruption reduction" },
    { id: "eadsy", ticker: "EADSY", name: "Airbus", role: "long-term Palantir partner; Skywise uses Palantir technology across aircraft design, production, supply chain and airline operations" },
  ],

  edges: [
    // VERIFIED SUPPLY / ENABLEMENT / DISTRIBUTION RELATIONSHIPS
    { source: "asml", target: "tsm" },
    { source: "tsm", target: "nvda" },
    { source: "nvda", target: "amzn" },
    { source: "nvda", target: "msft" },
    { source: "nvda", target: "googl" },
    { source: "amzn", target: "pltr" },
    { source: "msft", target: "pltr" },
    { source: "googl", target: "pltr" },
    { source: "pltr", target: "pltr_commercial" },
    { source: "pltr", target: "pltr_government" },
    { source: "pltr_commercial", target: "pltr_users" },
    { source: "pltr_government", target: "pltr_users" },

    // EXPANDED DENSITY — VERIFIED / HIGH-CONFIDENCE RELATIONSHIPS
    { source: "amat", target: "tsm" },
    { source: "lrcx", target: "tsm" },
    { source: "klac", target: "tsm" },
    { source: "amd", target: "amzn" },
    { source: "avgo", target: "googl" },
    { source: "intc", target: "msft" },
    { source: "pltr", target: "rio" },
    { source: "pltr", target: "bp" },
    { source: "pltr", target: "tsn" },
    { source: "pltr", target: "ual" },
    { source: "pltr", target: "eadsy" },
    { source: "rio", target: "pltr_users" },
    { source: "bp", target: "pltr_users" },
    { source: "tsn", target: "pltr_users" },
    { source: "ual", target: "pltr_users" },
    { source: "eadsy", target: "pltr_users" },

  ]
},

CSCO: {
  name: "Cisco Systems",
  root: "csco",
  nodes: [
    // UPSTREAM LAYER -4 — SEMICONDUCTOR FAB EQUIPMENT
    { id: "asml", ticker: "ASML", name: "ASML", role: "lithography equipment supplier to leading foundries that fabricate advanced networking, CPU and accelerator silicon used in Cisco's component ecosystem" },

    // UPSTREAM LAYER -3 — WAFER FOUNDRY
    { id: "tsm", ticker: "TSM", name: "TSMC", role: "major foundry behind chips designed by several semiconductor companies that Cisco identifies among its strategic component suppliers" },

    // UPSTREAM LAYER -2 — NAMED COMPONENT SUPPLIERS
    { id: "avgo", ticker: "AVGO", name: "Broadcom", role: "listed by Cisco among suppliers representing the top 80% of fiscal 2024 supply-chain spend; supplies networking and connectivity silicon" },
    { id: "mrvl", ticker: "MRVL", name: "Marvell", role: "listed by Cisco as a major component supplier; provides networking and data-infrastructure silicon" },
    { id: "amd", ticker: "AMD", name: "AMD", role: "listed by Cisco as a major component supplier in its fiscal 2024 supplier disclosure" },
    { id: "nvda", ticker: "NVDA", name: "NVIDIA", role: "listed by Cisco as a major component supplier in its fiscal 2024 supplier disclosure" },
    { id: "cohr", ticker: "COHR", name: "Coherent", role: "listed by Cisco as a major supplier; optical components support high-speed networking systems" },

    // UPSTREAM LAYER -1 — CONTRACT MANUFACTURING / SYSTEM BUILD
    { id: "flex", ticker: "FLEX", name: "Flex", role: "listed by Cisco among its key manufacturing suppliers; manufacturing partners produce finished Cisco products" },
    { id: "jbl", ticker: "JBL", name: "Jabil", role: "listed by Cisco among its key manufacturing suppliers in the disclosed top-spend supplier network" },
    { id: "fn", ticker: "FN", name: "Fabrinet", role: "listed by Cisco among its key manufacturing suppliers; precision manufacturing supports networking and optical hardware" },

    // CENTER
    { id: "csco", ticker: "CSCO", name: "Cisco Systems", role: "designs and sells networking, security, collaboration and observability products while relying heavily on external component and manufacturing partners" },

    // DOWNSTREAM LAYER +1 — SALES / DELIVERY CHANNEL
    { id: "csco_channel", ticker: null, name: "Cisco Partners, Distributors & Authorized Resellers", role: "Cisco's global partner ecosystem and authorized distribution channels configure, resell and deploy Cisco hardware, software and subscriptions" },

    // DOWNSTREAM LAYER +2 — END CUSTOMERS
    { id: "csco_enterprise", ticker: null, name: "Enterprise & Cloud Customers", role: "businesses and cloud operators deploying Cisco networking, security and observability infrastructure" },
    { id: "csco_service_public", ticker: null, name: "Service Providers & Public Sector", role: "telecom, government and education customers operating Cisco network and security infrastructure" },

    // EXPANDED DENSITY — VERIFIED / HIGH-CONFIDENCE COMPANY NODES
    { id: "amat", ticker: "AMAT", name: "Applied Materials", role: "semiconductor fabrication equipment supplier to leading foundries that manufacture networking and compute silicon used in Cisco hardware" },
    { id: "lrcx", ticker: "LRCX", name: "Lam Research", role: "etch and deposition equipment supplier to advanced fabs supporting Cisco's semiconductor supplier ecosystem" },
    { id: "klac", ticker: "KLAC", name: "KLA", role: "process-control equipment supplier to semiconductor fabs supporting Cisco component production" },
    { id: "msft", ticker: "MSFT", name: "Microsoft", role: "Cisco global strategic partner across cloud, collaboration, networking and enterprise infrastructure" },
    { id: "amzn", ticker: "AMZN", name: "Amazon Web Services", role: "Cisco strategic cloud ecosystem partner for networking, security and enterprise cloud deployments" },
    { id: "googl", ticker: "GOOGL", name: "Google Cloud", role: "Cisco strategic cloud partner for networking, security and hybrid-cloud solutions" },
    { id: "ibm", ticker: "IBM", name: "IBM", role: "Cisco global strategic and services ecosystem partner delivering enterprise technology solutions" },
    { id: "acn", ticker: "ACN", name: "Accenture", role: "Cisco global strategic integrator partner delivering networking, security and digital transformation solutions" },
  ],

  edges: [
    // VERIFIED SUPPLY / ENABLEMENT / DISTRIBUTION RELATIONSHIPS
    { source: "asml", target: "tsm" },
    { source: "tsm", target: "avgo" },
    { source: "tsm", target: "mrvl" },
    { source: "tsm", target: "amd" },
    { source: "tsm", target: "nvda" },
    { source: "avgo", target: "flex" },
    { source: "mrvl", target: "jbl" },
    { source: "amd", target: "jbl" },
    { source: "nvda", target: "flex" },
    { source: "cohr", target: "fn" },
    { source: "flex", target: "csco" },
    { source: "jbl", target: "csco" },
    { source: "fn", target: "csco" },
    { source: "csco", target: "csco_channel" },
    { source: "csco_channel", target: "csco_enterprise" },
    { source: "csco_channel", target: "csco_service_public" },

    // EXPANDED DENSITY — VERIFIED / HIGH-CONFIDENCE RELATIONSHIPS
    { source: "amat", target: "tsm" },
    { source: "lrcx", target: "tsm" },
    { source: "klac", target: "tsm" },
    { source: "csco", target: "msft" },
    { source: "csco", target: "amzn" },
    { source: "csco", target: "googl" },
    { source: "csco", target: "ibm" },
    { source: "csco", target: "acn" },
    { source: "msft", target: "csco_enterprise" },
    { source: "amzn", target: "csco_enterprise" },
    { source: "googl", target: "csco_enterprise" },
    { source: "ibm", target: "csco_enterprise" },
    { source: "acn", target: "csco_enterprise" },

  ]
},

ORCL: {
  name: "Oracle",
  root: "orcl",
  nodes: [
    // UPSTREAM LAYER -4 — SEMICONDUCTOR EQUIPMENT
    { id: "asml", ticker: "ASML", name: "ASML", role: "advanced lithography equipment used by leading-edge foundries; upstream manufacturing infrastructure behind OCI accelerator silicon" },

    // UPSTREAM LAYER -3 — LEADING-EDGE FOUNDRY
    { id: "tsm", ticker: "TSM", name: "TSMC", role: "advanced foundry manufacturing leading AI accelerator silicon used in Oracle Cloud Infrastructure compute clusters" },

    // UPSTREAM LAYER -2 — AI / SERVER SILICON
    { id: "nvda", ticker: "NVDA", name: "NVIDIA", role: "strategic OCI accelerator supplier; Oracle deploys NVIDIA GPU systems for AI training, inference and government-region infrastructure" },
    { id: "amd", ticker: "AMD", name: "AMD", role: "CPU and accelerator supplier used in Oracle Cloud Infrastructure compute offerings" },

    // UPSTREAM LAYER -1 — OCI DATA-CENTER INTEGRATION
    { id: "oci_infra", ticker: null, name: "OCI Compute, Networking & Data-Center Infrastructure", role: "Oracle-operated cloud infrastructure integrating accelerator systems, networking, storage, power and data-center capacity into OCI services" },

    // CENTER
    { id: "orcl", ticker: "ORCL", name: "Oracle", role: "provides Oracle Database, enterprise applications and Oracle Cloud Infrastructure, including AI and multicloud database services" },

    // DOWNSTREAM LAYER +1 — HYPERSCALER MULTICLOUD PARTNERS
    { id: "amzn", ticker: "AMZN", name: "Amazon Web Services", role: "hosts Oracle AI Database@AWS and connects AWS services directly with Oracle database infrastructure" },
    { id: "msft", ticker: "MSFT", name: "Microsoft Azure", role: "hosts Oracle AI Database@Azure and integrates Azure application/AI services with Oracle database infrastructure" },
    { id: "googl", ticker: "GOOGL", name: "Google Cloud", role: "hosts Oracle AI Database@Google Cloud and integrates Google Cloud services including Gemini and BigQuery" },

    // DOWNSTREAM LAYER +2 — ENTERPRISE WORKLOADS
    { id: "orcl_enterprise", ticker: null, name: "Enterprise Database & AI Customers", role: "organizations running mission-critical databases, applications, analytics and AI workloads across OCI and Oracle's multicloud deployments" },

    // EXPANDED DENSITY — VERIFIED / HIGH-CONFIDENCE COMPANY NODES
    { id: "amat", ticker: "AMAT", name: "Applied Materials", role: "wafer-fabrication equipment supplier to advanced foundries in OCI's indirect accelerator-silicon supply chain" },
    { id: "lrcx", ticker: "LRCX", name: "Lam Research", role: "etch and deposition equipment supplier to leading-edge foundries supporting OCI accelerator production" },
    { id: "klac", ticker: "KLAC", name: "KLA", role: "process-control equipment supplier to advanced semiconductor fabs supporting OCI compute silicon" },
    { id: "intc", ticker: "INTC", name: "Intel", role: "Xeon CPU supplier represented across Oracle Cloud Infrastructure compute offerings" },
  ],

  edges: [
    // VERIFIED SUPPLY / ENABLEMENT / DISTRIBUTION RELATIONSHIPS
    { source: "asml", target: "tsm" },
    { source: "tsm", target: "nvda" },
    { source: "tsm", target: "amd" },
    { source: "nvda", target: "oci_infra" },
    { source: "amd", target: "oci_infra" },
    { source: "oci_infra", target: "orcl" },
    { source: "orcl", target: "amzn" },
    { source: "orcl", target: "msft" },
    { source: "orcl", target: "googl" },
    { source: "amzn", target: "orcl_enterprise" },
    { source: "msft", target: "orcl_enterprise" },
    { source: "googl", target: "orcl_enterprise" },

    // EXPANDED DENSITY — VERIFIED / HIGH-CONFIDENCE RELATIONSHIPS
    { source: "amat", target: "tsm" },
    { source: "lrcx", target: "tsm" },
    { source: "klac", target: "tsm" },
    { source: "intc", target: "oci_infra" },

  ]
},

COST: {
  name: "Costco Wholesale",
  root: "cost",
  nodes: [
    // UPSTREAM LAYER -4 — COMMODITIES / PRODUCT INPUTS
    { id: "cost_raw", ticker: null, name: "Food, Agricultural & Consumer-Goods Inputs", role: "raw materials and commodity inputs used by the producers of Costco's nationally branded and Kirkland Signature merchandise" },

    // UPSTREAM LAYER -3 — MANUFACTURERS / PRODUCERS
    { id: "cost_mfrs", ticker: null, name: "Brand-Name & Kirkland Manufacturers", role: "Costco buys most merchandise directly from suppliers and maintains direct relationships with many producers of brand-name goods; private-label goods are also purchased or manufactured for Costco" },

    // UPSTREAM LAYER -2 — SUPPLIER-DIRECT FREIGHT
    { id: "cost_inbound", ticker: null, name: "Supplier-Direct Inbound Freight", role: "merchandise moves from suppliers either directly to selling warehouses or into Costco's consolidation network, limiting traditional intermediary distribution steps" },

    // UPSTREAM LAYER -1 — CROSS-DOCK DEPOTS
    { id: "cost_depots", ticker: null, name: "Costco Cross-Docking Depots", role: "consolidation points that receive large supplier shipments and quickly redistribute goods to warehouses, creating freight-volume and handling efficiencies" },

    // CENTER
    { id: "cost", ticker: "COST", name: "Costco Wholesale", role: "membership warehouse and e-commerce retailer built around limited assortments, high volume, rapid inventory turnover and direct supplier purchasing" },

    // DOWNSTREAM LAYER +1 — SALES / FULFILLMENT CHANNELS
    { id: "cost_warehouses", ticker: null, name: "Membership Warehouses & Business Centers", role: "physical warehouse network selling nationally branded and private-label merchandise to members" },
    { id: "cost_ecom", ticker: null, name: "Costco E-Commerce & Logistics", role: "online fulfillment through depots, logistics operations, supplier drop-ship arrangements and other delivery methods" },

    // DOWNSTREAM LAYER +2 — MEMBERS
    { id: "cost_members", ticker: null, name: "Household Members", role: "individual members purchasing food, household, discretionary and service offerings" },
    { id: "cost_business", ticker: null, name: "Business Members", role: "business customers purchasing merchandise for use or resale, including food-service, convenience-store and office needs" },

    // EXPANDED DENSITY — VERIFIED / HIGH-CONFIDENCE COMPANY NODES
    { id: "lcut", ticker: "LCUT", name: "Lifetime Brands", role: "public consumer-goods supplier that disclosed Costco as an 11% customer in 2025" },
    { id: "cent", ticker: "CENT", name: "Central Garden & Pet", role: "public pet and lawn-and-garden supplier identifying Costco as a significant customer and one of its largest pet-supply retail relationships" },
    { id: "nwl", ticker: "NWL", name: "Newell Brands", role: "public consumer-products supplier listing Costco among its top-ten customers in 2025" },
  ],

  edges: [
    // VERIFIED SUPPLY / ENABLEMENT / DISTRIBUTION RELATIONSHIPS
    { source: "cost_raw", target: "cost_mfrs" },
    { source: "cost_mfrs", target: "cost_inbound" },
    { source: "cost_inbound", target: "cost_depots" },
    { source: "cost_depots", target: "cost" },
    { source: "cost", target: "cost_warehouses" },
    { source: "cost", target: "cost_ecom" },
    { source: "cost_warehouses", target: "cost_members" },
    { source: "cost_warehouses", target: "cost_business" },
    { source: "cost_ecom", target: "cost_members" },
    { source: "cost_ecom", target: "cost_business" },

    // EXPANDED DENSITY — VERIFIED / HIGH-CONFIDENCE RELATIONSHIPS
    { source: "cost_raw", target: "lcut" },
    { source: "cost_raw", target: "cent" },
    { source: "cost_raw", target: "nwl" },
    { source: "lcut", target: "cost_inbound" },
    { source: "cent", target: "cost_inbound" },
    { source: "nwl", target: "cost_inbound" },

  ]
},

CVX: {
  name: "Chevron",
  root: "cvx",
  nodes: [
    // UPSTREAM LAYER -4 — EXTERNAL OPERATING INPUTS
    { id: "cvx_inputs", ticker: null, name: "Oilfield Equipment, Materials & Service Inputs", role: "equipment, labor, materials, supplies, fuel, utilities and specialized services required to develop and operate Chevron's upstream assets" },

    // UPSTREAM LAYER -3 — EXPLORATION / DEVELOPMENT
    { id: "cvx_dev", ticker: null, name: "Exploration, Drilling & Field Development", role: "Chevron upstream activity that identifies resources, develops fields and establishes wells and production facilities" },

    // UPSTREAM LAYER -2 — HYDROCARBON PRODUCTION
    { id: "cvx_prod", ticker: null, name: "Crude Oil, Natural Gas & NGL Production", role: "production stage generating Chevron equity crude, natural gas and natural-gas liquids from developed assets" },

    // UPSTREAM LAYER -1 — GATHERING / LNG / TRANSPORT
    { id: "cvx_transport", ticker: null, name: "Gathering, Pipelines, LNG & Marine Transport", role: "processing, liquefaction, pipelines, marine transport, storage and gas marketing infrastructure moving production toward downstream markets" },

    // CENTER
    { id: "cvx", ticker: "CVX", name: "Chevron", role: "integrated energy company spanning upstream production, LNG, refining, fuels marketing, petrochemicals, lubricants and renewable fuels" },

    // DOWNSTREAM LAYER +1 — REFINING / CHEMICALS / MARKETING
    { id: "cvx_refining", ticker: null, name: "Refineries & Renewable Fuel Plants", role: "Chevron downstream facilities convert crude and other feedstocks into gasoline, jet fuel, diesel, lubricants, renewable fuels and other petroleum products" },
    { id: "cvx_chem", ticker: null, name: "Petrochemicals & Specialty Products", role: "chemical, plastics, additives and specialty-product operations converting hydrocarbon feedstocks into industrial materials" },

    // DOWNSTREAM LAYER +2 — DISTRIBUTION / END MARKETS
    { id: "cvx_stations", ticker: null, name: "Chevron, Texaco & Caltex Retail Network", role: "retailers and marketers supplied under Chevron's principal fuel brands; Chevron supplied thousands of branded stations at year-end 2025" },
    { id: "cvx_commercial", ticker: null, name: "Aviation, Industrial & Commercial Customers", role: "airports, transportation operators and industrial buyers purchasing jet fuel, base oils, lubricants, fuels and chemical products" },

    // EXPANDED DENSITY — VERIFIED / HIGH-CONFIDENCE COMPANY NODES
    { id: "slb", ticker: "SLB", name: "SLB", role: "major oilfield technology and services provider participating in Chevron drilling, subsurface and production projects across the upstream industry" },
    { id: "hal", ticker: "HAL", name: "Halliburton", role: "major oilfield services provider supporting drilling, completions and field-development activity used by integrated producers including Chevron" },
    { id: "bkr", ticker: "BKR", name: "Baker Hughes", role: "major energy-technology and oilfield-equipment provider supporting LNG, drilling and production infrastructure used by integrated energy producers" },
  ],

  edges: [
    // VERIFIED SUPPLY / ENABLEMENT / DISTRIBUTION RELATIONSHIPS
    { source: "cvx_inputs", target: "cvx_dev" },
    { source: "cvx_dev", target: "cvx_prod" },
    { source: "cvx_prod", target: "cvx_transport" },
    { source: "cvx_transport", target: "cvx" },
    { source: "cvx", target: "cvx_refining" },
    { source: "cvx", target: "cvx_chem" },
    { source: "cvx_refining", target: "cvx_stations" },
    { source: "cvx_refining", target: "cvx_commercial" },
    { source: "cvx_chem", target: "cvx_commercial" },

    // EXPANDED DENSITY — VERIFIED / HIGH-CONFIDENCE RELATIONSHIPS
    { source: "slb", target: "cvx_dev" },
    { source: "hal", target: "cvx_dev" },
    { source: "bkr", target: "cvx_dev" },

  ]
},

BAC: {
  name: "Bank of America",
  root: "bac",
  nodes: [
    // UPSTREAM LAYER -4 — PHYSICAL DIGITAL INFRASTRUCTURE
    { id: "bac_physical", ticker: null, name: "Power, Telecom & Data-Center Infrastructure", role: "electrical power, internet access, network connectivity and physical infrastructure that Bank of America identifies as dependencies of its information systems and outsourced services" },

    // UPSTREAM LAYER -3 — CLOUD / SOFTWARE / SERVICE PROVIDERS
    { id: "bac_cloud", ticker: null, name: "Cloud, Outsourced Software & Infrastructure Providers", role: "third-party cloud services, software, services and infrastructure on which Bank of America's technology operations depend; the bank notes concentration risk in a small number of providers" },

    // UPSTREAM LAYER -2 — FINANCIAL MARKET INFRASTRUCTURE
    { id: "bac_market_infra", ticker: null, name: "Exchanges, Clearing Houses & Financial Intermediaries", role: "external market and clearing infrastructure Bank of America identifies among third parties essential to trading, funds transfer and other financial operations" },

    // UPSTREAM LAYER -1 — PAYMENT NETWORKS / TRANSACTION INTERFACES
    { id: "v", ticker: "V", name: "Visa", role: "major card-network rail used across consumer payment products issued by Bank of America" },
    { id: "ma", ticker: "MA", name: "Mastercard", role: "major card-network rail used across Bank of America consumer and commercial payment products" },
    { id: "bac_ops", ticker: null, name: "Bank of America Core Processing & Digital Operations", role: "internal banking, payment, trading and digital systems that connect external infrastructure to the firm's products and client channels" },

    // CENTER
    { id: "bac", ticker: "BAC", name: "Bank of America", role: "provides consumer banking, wealth and investment management, global banking and global markets services across physical and digital channels" },

    // DOWNSTREAM LAYER +1 — CLIENT CHANNELS
    { id: "bac_consumer", ticker: null, name: "Consumer Banking & Digital Channels", role: "financial centers, ATMs, online and mobile banking serving consumer and small-business clients" },
    { id: "bac_institutional", ticker: null, name: "Global Banking, Markets & Wealth Platforms", role: "corporate, institutional and wealth-management channels delivering lending, advisory, markets and investment services" },

    // DOWNSTREAM LAYER +2 — END CLIENTS
    { id: "bac_retail_clients", ticker: null, name: "Consumers & Small Businesses", role: "Bank of America's approximately 69 million consumer and small-business clients as reported at year-end 2025" },
    { id: "bac_corp_clients", ticker: null, name: "Corporate, Institutional & Wealth Clients", role: "companies, institutions and wealth clients using Bank of America's banking, markets, advisory and investment services" },

    // EXPANDED DENSITY — VERIFIED / HIGH-CONFIDENCE COMPANY NODES
    { id: "cme", ticker: "CME", name: "CME Group", role: "major derivatives-market infrastructure used by global banks for futures and options trading and risk management" },
    { id: "ice", ticker: "ICE", name: "Intercontinental Exchange", role: "major exchange, clearing and fixed-income market-infrastructure provider used by global banking and markets businesses" },
    { id: "ndaq", ticker: "NDAQ", name: "Nasdaq", role: "major securities-market and market-technology infrastructure provider used by institutional trading businesses" },
  ],

  edges: [
    // VERIFIED SUPPLY / ENABLEMENT / DISTRIBUTION RELATIONSHIPS
    { source: "bac_physical", target: "bac_cloud" },
    { source: "bac_cloud", target: "bac_market_infra" },
    { source: "bac_market_infra", target: "bac_ops" },
    { source: "v", target: "bac_ops" },
    { source: "ma", target: "bac_ops" },
    { source: "bac_ops", target: "bac" },
    { source: "bac", target: "bac_consumer" },
    { source: "bac", target: "bac_institutional" },
    { source: "bac_consumer", target: "bac_retail_clients" },
    { source: "bac_institutional", target: "bac_corp_clients" },

    // EXPANDED DENSITY — VERIFIED / HIGH-CONFIDENCE RELATIONSHIPS
    { source: "cme", target: "bac_ops" },
    { source: "ice", target: "bac_ops" },
    { source: "ndaq", target: "bac_ops" },

  ]
},

LRCX: {
  name: "Lam Research",
  root: "lrcx",
  nodes: [
    // UPSTREAM LAYER -4 — RAW MATERIALS / SPECIALTY INPUTS
    { id: "lrcx_raw", ticker: null, name: "Specialty Metals, Ceramics, Chemicals & Electronic Inputs", role: "upstream material base behind the precision components and subassemblies used in semiconductor wafer-fabrication equipment" },

    // UPSTREAM LAYER -3 — DIRECT COMPONENT / SUBASSEMBLY SUPPLIERS
    { id: "lrcx_suppliers", ticker: null, name: "Lam Direct Suppliers & Subassembly Vendors", role: "supplier network providing components, subassemblies and services; Lam states that some inputs are available only from single or limited sources" },

    // UPSTREAM LAYER -2 — PRECISION MODULE MANUFACTURING
    { id: "lrcx_modules", ticker: null, name: "Process-Chamber & Precision Module Manufacturing", role: "manufacture and integration of the hardware, fluidics, plasma, materials and control modules required for Lam's wafer-processing systems" },

    // UPSTREAM LAYER -1 — SYSTEM INTEGRATION / TEST
    { id: "lrcx_system", ticker: null, name: "Lam System Integration, Calibration & Test", role: "final assembly, software integration, calibration and qualification of etch, deposition, clean and advanced-packaging equipment" },

    // CENTER
    { id: "lrcx", ticker: "LRCX", name: "Lam Research", role: "designs, manufactures, markets, refurbishes and services wafer-fabrication equipment used by memory, foundry and logic semiconductor manufacturers" },

    // DOWNSTREAM LAYER +1 — SIGNIFICANT CUSTOMERS
    { id: "mu", ticker: "MU", name: "Micron", role: "identified by Lam as one of its most significant customers in fiscal 2026" },
    { id: "tsm", ticker: "TSM", name: "TSMC", role: "identified by Lam as one of its most significant customers in fiscal 2026" },
    { id: "lrcx_other_fabs", ticker: null, name: "Other Major Memory & Foundry Customers", role: "other leading memory and semiconductor manufacturers in Lam's disclosed significant-customer group and broader customer base" },

    // DOWNSTREAM LAYER +2 — SEMICONDUCTOR OUTPUT
    { id: "lrcx_chip_output", ticker: null, name: "Memory, Logic & Foundry Wafer Output", role: "customer fabs use Lam equipment across hundreds of wafer-processing steps to manufacture DRAM, NAND, logic and other integrated circuits" },

    // EXPANDED DENSITY — VERIFIED / HIGH-CONFIDENCE COMPANY NODES
    { id: "ichr", ticker: "ICHR", name: "Ichor Holdings", role: "precision gas-delivery and fluid-delivery subsystem supplier; Lam Research is one of Ichor's largest disclosed customers" },
    { id: "uctt", ticker: "UCTT", name: "Ultra Clean Holdings", role: "semiconductor-equipment subsystem and outsourced manufacturing supplier serving major wafer-fabrication equipment companies including Lam" },
    { id: "mksi", ticker: "MKSI", name: "MKS Instruments", role: "process-control, vacuum and power subsystem supplier to semiconductor equipment manufacturers including Lam's market" },
    { id: "aeis", ticker: "AEIS", name: "Advanced Energy", role: "precision power and control subsystem supplier to semiconductor wafer-fabrication equipment manufacturers" },
    { id: "entg", ticker: "ENTG", name: "Entegris", role: "advanced materials, filtration and contamination-control supplier across semiconductor manufacturing and equipment ecosystems" },
  ],

  edges: [
    // VERIFIED SUPPLY / ENABLEMENT / DISTRIBUTION RELATIONSHIPS
    { source: "lrcx_raw", target: "lrcx_suppliers" },
    { source: "lrcx_suppliers", target: "lrcx_modules" },
    { source: "lrcx_modules", target: "lrcx_system" },
    { source: "lrcx_system", target: "lrcx" },
    { source: "lrcx", target: "mu" },
    { source: "lrcx", target: "tsm" },
    { source: "lrcx", target: "lrcx_other_fabs" },
    { source: "mu", target: "lrcx_chip_output" },
    { source: "tsm", target: "lrcx_chip_output" },
    { source: "lrcx_other_fabs", target: "lrcx_chip_output" },

    // EXPANDED DENSITY — VERIFIED / HIGH-CONFIDENCE RELATIONSHIPS
    { source: "lrcx_raw", target: "ichr" },
    { source: "lrcx_raw", target: "uctt" },
    { source: "lrcx_raw", target: "mksi" },
    { source: "lrcx_raw", target: "aeis" },
    { source: "lrcx_raw", target: "entg" },
    { source: "ichr", target: "lrcx_modules" },
    { source: "uctt", target: "lrcx_modules" },
    { source: "mksi", target: "lrcx_modules" },
    { source: "aeis", target: "lrcx_modules" },
    { source: "entg", target: "lrcx_modules" },

  ]
},

AMAT: {
  name: "Applied Materials",
  root: "amat",
  nodes: [
    // UPSTREAM LAYER -4 — CRITICAL MATERIALS / COMMODITIES
    { id: "amat_raw", ticker: null, name: "Metals, Minerals, Electronics & Specialty Material Inputs", role: "upstream materials and commodities required to produce the high-precision mechanical, electrical and process-control components used in Applied Materials equipment" },

    // UPSTREAM LAYER -3 — QUALIFIED PARTS / COMPONENT VENDORS
    { id: "amat_vendors", ticker: null, name: "Applied Qualified Vendors", role: "qualified supplier network providing parts, materials, services and product support; Applied notes that some key parts come from single or limited qualified sources" },

    // UPSTREAM LAYER -2 — CONTRACT MANUFACTURING / SUBASSEMBLIES
    { id: "amat_contract", ticker: null, name: "Contract Manufacturers & Subassembly Partners", role: "external manufacturing partners used by Applied Materials to supply assemblies and production support within its global manufacturing network" },

    // UPSTREAM LAYER -1 — FINAL ASSEMBLY / INTEGRATION / TEST
    { id: "amat_final", ticker: null, name: "Applied System Assembly, Integration & Test", role: "final manufacturing stage integrating precision modules, process chambers, controls and software into customer-configured semiconductor production systems" },

    // CENTER
    { id: "amat", ticker: "AMAT", name: "Applied Materials", role: "supplies materials-engineering equipment, services and software used to manufacture semiconductor chips and advanced displays" },

    // DOWNSTREAM LAYER +1 — FAB CUSTOMERS
    { id: "amat_foundry", ticker: null, name: "Foundry & Logic Manufacturers", role: "semiconductor manufacturers investing in leading-edge patterning, transistor, interconnect, process-control and advanced-packaging capability" },
    { id: "amat_memory", ticker: null, name: "Memory Manufacturers", role: "DRAM and NAND producers purchasing new systems, upgrades, spares and long-term service to expand or optimize wafer fabrication" },

    // DOWNSTREAM LAYER +2 — END SEMICONDUCTOR MARKETS
    { id: "amat_endmarkets", ticker: null, name: "AI, Data Center, Mobile, Auto & Electronics Chips", role: "finished semiconductor output enabled by customers' fabs ultimately serves AI, cloud, mobile, automotive, robotics and other electronics markets" },

    // EXPANDED DENSITY — VERIFIED / HIGH-CONFIDENCE COMPANY NODES
    { id: "ichr", ticker: "ICHR", name: "Ichor Holdings", role: "precision gas-delivery and fluid-delivery subsystem supplier; Applied Materials represented more than 20% of Ichor revenue in 2025" },
    { id: "uctt", ticker: "UCTT", name: "Ultra Clean Holdings", role: "outsourced semiconductor-equipment subsystem and manufacturing supplier serving Applied Materials and other wafer-fab equipment leaders" },
    { id: "mksi", ticker: "MKSI", name: "MKS Instruments", role: "vacuum, power, process-control and photonics subsystem supplier to wafer-fabrication equipment manufacturers" },
    { id: "aeis", ticker: "AEIS", name: "Advanced Energy", role: "precision power-conversion and control supplier used across semiconductor process-equipment platforms" },
    { id: "entg", ticker: "ENTG", name: "Entegris", role: "materials, filtration and contamination-control supplier in advanced semiconductor manufacturing" },
    { id: "tsm", ticker: "TSM", name: "TSMC", role: "major Applied Materials customer and leading-edge foundry investing heavily in wafer-fabrication equipment" },
    { id: "intc", ticker: "INTC", name: "Intel", role: "major semiconductor manufacturer and historically significant Applied Materials customer" },
    { id: "mu", ticker: "MU", name: "Micron", role: "major memory manufacturer purchasing wafer-fabrication equipment across deposition, etch and materials-engineering steps" },
  ],

  edges: [
    // VERIFIED SUPPLY / ENABLEMENT / DISTRIBUTION RELATIONSHIPS
    { source: "amat_raw", target: "amat_vendors" },
    { source: "amat_vendors", target: "amat_contract" },
    { source: "amat_contract", target: "amat_final" },
    { source: "amat_final", target: "amat" },
    { source: "amat", target: "amat_foundry" },
    { source: "amat", target: "amat_memory" },
    { source: "amat_foundry", target: "amat_endmarkets" },
    { source: "amat_memory", target: "amat_endmarkets" },

    // EXPANDED DENSITY — VERIFIED / HIGH-CONFIDENCE RELATIONSHIPS
    { source: "amat_raw", target: "ichr" },
    { source: "amat_raw", target: "uctt" },
    { source: "amat_raw", target: "mksi" },
    { source: "amat_raw", target: "aeis" },
    { source: "amat_raw", target: "entg" },
    { source: "ichr", target: "amat_contract" },
    { source: "uctt", target: "amat_contract" },
    { source: "mksi", target: "amat_contract" },
    { source: "aeis", target: "amat_contract" },
    { source: "entg", target: "amat_contract" },
    { source: "amat", target: "tsm" },
    { source: "amat", target: "intc" },
    { source: "amat", target: "mu" },
    { source: "tsm", target: "amat_endmarkets" },
    { source: "intc", target: "amat_endmarkets" },
    { source: "mu", target: "amat_endmarkets" },

  ]
},

KO: {
  name: "The Coca-Cola Company",
  root: "ko",
  nodes: [
    // UPSTREAM LAYER -4 — AGRICULTURAL / BASE INPUTS
    { id: "ko_raw", ticker: null, name: "Water, Sweeteners & Agricultural Ingredients", role: "water, nutritive and non-nutritive sweeteners, juices and agricultural ingredients forming the raw-material base of Coca-Cola beverages" },

    // UPSTREAM LAYER -3 — PACKAGING / INGREDIENT MATERIALS
    { id: "ko_materials", ticker: null, name: "Flavor, CO2 & Packaging Material Supply", role: "ingredient and packaging ecosystem supporting concentrate production and the broader Coca-Cola system, including CO2, PET, cans, glass and closures" },

    // UPSTREAM LAYER -2 — CONCENTRATE / SYRUP MANUFACTURING
    { id: "ko_concentrate", ticker: null, name: "Coca-Cola Concentrate & Syrup Production", role: "Company-operated concentrate operations manufacture and sell beverage concentrates, syrup and beverage bases to authorized bottling partners" },

    // UPSTREAM LAYER -1 — SYSTEM SUPPLY / QUALITY RELEASE
    { id: "ko_system_supply", ticker: null, name: "Concentrate Supply & System Quality Network", role: "commercial and quality-control stage supplying authorized Coca-Cola bottlers under bottler agreements and product specifications" },

    // CENTER
    { id: "ko", ticker: "KO", name: "The Coca-Cola Company", role: "owns and licenses beverage brands and formulas and operates the concentrate business at the center of a global independent bottling and distribution system" },

    // DOWNSTREAM LAYER +1 — MAJOR INDEPENDENT BOTTLERS
    { id: "kof", ticker: "KOF", name: "Coca-Cola FEMSA", role: "Coca-Cola's largest independent bottling partners by unit-case volume; purchases Coca-Cola concentrate and manufactures, sells and distributes trademark beverages in its territories" },
    { id: "ccep", ticker: "CCEP", name: "Coca-Cola Europacific Partners", role: "one of Coca-Cola's five largest independent bottling partners by 2025 unit-case volume" },
    { id: "coke", ticker: "COKE", name: "Coca-Cola Consolidated", role: "major U.S. Coca-Cola bottler and distributor serving retail and foodservice customers in its franchise territories" },

    // DOWNSTREAM LAYER +2 — RETAIL / FOODSERVICE / CONSUMERS
    { id: "ko_channels", ticker: null, name: "Retailers, Restaurants & Foodservice Channels", role: "customer channels supplied by bottlers with finished packaged and fountain beverages" },
    { id: "ko_consumers", ticker: null, name: "Beverage Consumers", role: "end consumers purchasing Coca-Cola system beverages through retail, foodservice and away-from-home channels" },

    // EXPANDED DENSITY — VERIFIED / HIGH-CONFIDENCE COMPANY NODES
    { id: "mcd", ticker: "MCD", name: "McDonald's", role: "longstanding global fountain-channel partner serving Coca-Cola beverages across restaurant locations" },
    { id: "wmt", ticker: "WMT", name: "Walmart", role: "major global retail channel carrying Coca-Cola system beverages for consumer purchase" },
    { id: "cost", ticker: "COST", name: "Costco Wholesale", role: "large warehouse-club retail channel carrying Coca-Cola beverages in multipack and food-service formats" },
  ],

  edges: [
    // VERIFIED SUPPLY / ENABLEMENT / DISTRIBUTION RELATIONSHIPS
    { source: "ko_raw", target: "ko_materials" },
    { source: "ko_materials", target: "ko_concentrate" },
    { source: "ko_concentrate", target: "ko_system_supply" },
    { source: "ko_system_supply", target: "ko" },
    { source: "ko", target: "kof" },
    { source: "ko", target: "ccep" },
    { source: "ko", target: "coke" },
    { source: "kof", target: "ko_channels" },
    { source: "ccep", target: "ko_channels" },
    { source: "coke", target: "ko_channels" },
    { source: "ko_channels", target: "ko_consumers" },

    // EXPANDED DENSITY — VERIFIED / HIGH-CONFIDENCE RELATIONSHIPS
    { source: "coke", target: "mcd" },
    { source: "coke", target: "wmt" },
    { source: "coke", target: "cost" },
    { source: "mcd", target: "ko_consumers" },
    { source: "wmt", target: "ko_consumers" },
    { source: "cost", target: "ko_consumers" },

  ]
},

CAT: {
  name: "Caterpillar",
  root: "cat",
  nodes: [
    // UPSTREAM LAYER -4 — RAW MATERIALS
    { id: "cat_raw", ticker: null, name: "Steel, Iron & Industrial Raw Materials", role: "unformed steel products and other raw materials sourced domestically and internationally for Caterpillar machines, engines and power-generation equipment" },

    // UPSTREAM LAYER -3 — CASTINGS / FORGINGS / FINISHED PARTS
    { id: "cat_parts", ticker: null, name: "Castings, Forgings & Finished Component Suppliers", role: "supplier base provides rough steel and iron castings and forgings plus ready-to-assemble components made to Caterpillar or supplier-developed specifications" },

    // UPSTREAM LAYER -2 — MACHINING / COMPONENT PRODUCTION
    { id: "cat_machining", ticker: null, name: "Caterpillar Machining & Component Production", role: "Caterpillar facilities cut, form and machine raw and rough parts to final specifications and produce selected components internally" },

    // UPSTREAM LAYER -1 — MACHINE / ENGINE ASSEMBLY
    { id: "cat_assembly", ticker: null, name: "Machine, Engine & Power-System Assembly", role: "final assembly and testing of construction and mining machines, reciprocating engines, power systems and related aftermarket parts" },

    // CENTER
    { id: "cat", ticker: "CAT", name: "Caterpillar", role: "manufactures construction and mining equipment, engines, turbines, locomotives and power systems supported by a global parts and service ecosystem" },

    // DOWNSTREAM LAYER +1 — DEALER / DISTRIBUTOR NETWORK
    { id: "cat_dealers", ticker: null, name: "Independent Caterpillar Dealers", role: "worldwide dealer organization selling and servicing Caterpillar machines and engines across nearly every major market" },
    { id: "cat_direct", ticker: null, name: "Direct Industrial Sales", role: "direct sales channels used for selected products such as turbines and locomotives, supported where needed by independent sales representatives" },

    // DOWNSTREAM LAYER +2 — END USERS
    { id: "cat_endusers", ticker: null, name: "Construction, Mining, Energy & Transport Operators", role: "contractors, miners, energy producers, rail operators and other industrial customers operating Caterpillar equipment and consuming aftermarket parts and service" },

    // EXPANDED DENSITY — VERIFIED / HIGH-CONFIDENCE COMPANY NODES
    { id: "bhp", ticker: "BHP", name: "BHP", role: "major Caterpillar mining customer with a long-term agreement to replace the Escondida haul-truck fleet and deploy autonomy-ready equipment" },
    { id: "nem", ticker: "NEM", name: "Newmont", role: "strategic Caterpillar mining customer collaborating on battery-electric and autonomous mining systems" },
    { id: "rio", ticker: "RIO", name: "Rio Tinto", role: "major mining customer participating in Caterpillar electrification and autonomous-haulage development programs" },
    { id: "fcx", ticker: "FCX", name: "Freeport-McMoRan", role: "mining customer participating in Caterpillar's battery-electric large mining truck Early Learner program" },
  ],

  edges: [
    // VERIFIED SUPPLY / ENABLEMENT / DISTRIBUTION RELATIONSHIPS
    { source: "cat_raw", target: "cat_parts" },
    { source: "cat_parts", target: "cat_machining" },
    { source: "cat_machining", target: "cat_assembly" },
    { source: "cat_assembly", target: "cat" },
    { source: "cat", target: "cat_dealers" },
    { source: "cat", target: "cat_direct" },
    { source: "cat_dealers", target: "cat_endusers" },
    { source: "cat_direct", target: "cat_endusers" },

    // EXPANDED DENSITY — VERIFIED / HIGH-CONFIDENCE RELATIONSHIPS
    { source: "cat", target: "bhp" },
    { source: "cat", target: "nem" },
    { source: "cat", target: "rio" },
    { source: "cat", target: "fcx" },
    { source: "bhp", target: "cat_endusers" },
    { source: "nem", target: "cat_endusers" },
    { source: "rio", target: "cat_endusers" },
    { source: "fcx", target: "cat_endusers" },

  ]
},

MRK: {
  name: "Merck & Co.",
  root: "mrk",
  nodes: [
    // UPSTREAM LAYER -4 — PHARMACEUTICAL RAW INPUTS
    { id: "mrk_raw", ticker: null, name: "Chemical, Biological & Packaging Inputs", role: "raw materials, biological inputs, excipients and packaging components required across Merck's pharmaceutical and vaccine manufacturing network" },

    // UPSTREAM LAYER -3 — API / BIOLOGICS MANUFACTURING
    { id: "mrk_api", ticker: null, name: "API & Biologics Manufacturing", role: "internal and external manufacturing stage producing active pharmaceutical ingredients, vaccine antigens and biological intermediates under regulated quality systems" },

    // UPSTREAM LAYER -2 — FORMULATION / FILL-FINISH
    { id: "mrk_fill", ticker: null, name: "Formulation, Sterile Fill-Finish & Drug Product", role: "conversion of active ingredients and biological intermediates into finished dosage forms, sterile products and vaccines" },

    // UPSTREAM LAYER -1 — PACKAGING / QUALITY RELEASE / LOGISTICS
    { id: "mrk_release", ticker: null, name: "Packaging, Quality Release & Distribution Logistics", role: "regulated packaging, batch release, cold-chain where required and logistics stage connecting finished Merck products to commercial wholesalers and care channels" },

    // CENTER
    { id: "mrk", ticker: "MRK", name: "Merck & Co.", role: "researches, develops, manufactures and markets prescription medicines, vaccines and biologic therapies worldwide" },

    // DOWNSTREAM LAYER +1 — MAJOR U.S. WHOLESALERS
    { id: "mck", ticker: "MCK", name: "McKesson", role: "Merck's largest disclosed accounts-receivable customer at year-end 2025, representing about 22% of total accounts receivable" },
    { id: "cor", ticker: "COR", name: "Cencora", role: "major Merck wholesaler customer, representing about 21% of total accounts receivable at year-end 2025" },
    { id: "cah", ticker: "CAH", name: "Cardinal Health", role: "major Merck wholesaler customer, representing about 13% of total accounts receivable at year-end 2025" },

    // DOWNSTREAM LAYER +2 — CARE DELIVERY
    { id: "mrk_care", ticker: null, name: "Pharmacies, Hospitals, Providers & Government Programs", role: "wholesale and institutional channels through which Merck medicines and vaccines reach prescribers, care facilities, public programs and patients" }
  ],

  edges: [
    // VERIFIED SUPPLY / ENABLEMENT / DISTRIBUTION RELATIONSHIPS
    { source: "mrk_raw", target: "mrk_api" },
    { source: "mrk_api", target: "mrk_fill" },
    { source: "mrk_fill", target: "mrk_release" },
    { source: "mrk_release", target: "mrk" },
    { source: "mrk", target: "mck" },
    { source: "mrk", target: "cor" },
    { source: "mrk", target: "cah" },
    { source: "mck", target: "mrk_care" },
    { source: "cor", target: "mrk_care" },
    { source: "cah", target: "mrk_care" }
  ]
},

DELL: {
  name: "Dell Technologies",
  root: "dell",
  nodes: [
    // UPSTREAM LAYER -4 — ADVANCED LITHOGRAPHY
    { id: "asml", ticker: "ASML", name: "ASML", role: "EUV lithography equipment used in the leading-edge semiconductor manufacturing chain behind many CPUs, GPUs and accelerators integrated into Dell systems" },

    // UPSTREAM LAYER -3 — LEADING-EDGE FOUNDRY
    { id: "tsm", ticker: "TSM", name: "TSMC", role: "foundry manufacturing advanced NVIDIA and AMD silicon used in Dell AI and enterprise-compute systems" },

    // UPSTREAM LAYER -2 — CPU / GPU / ACCELERATOR SILICON
    { id: "nvda", ticker: "NVDA", name: "NVIDIA", role: "core Dell AI Factory technology partner providing Vera CPUs, Rubin/Blackwell accelerators, networking and AI software integrated into Dell PowerEdge and PowerRack systems" },
    { id: "amd", ticker: "AMD", name: "AMD", role: "processor and accelerator supplier used across Dell PowerEdge server configurations" },
    { id: "intc", ticker: "INTC", name: "Intel", role: "processor supplier used across Dell PowerEdge server and client-system portfolios" },

    // UPSTREAM LAYER -1 — DELL SYSTEM INTEGRATION
    { id: "dell_integration", ticker: null, name: "PowerEdge, PowerRack & Storage System Integration", role: "Dell hardware engineering, rack integration, cooling, networking, storage, firmware and validation stage that converts component silicon into deployable enterprise systems" },

    // CENTER
    { id: "dell", ticker: "DELL", name: "Dell Technologies", role: "sells enterprise servers, storage, networking, PCs and integrated AI infrastructure, including the Dell AI Factory portfolio" },

    // DOWNSTREAM LAYER +1 — DEPLOYED INFRASTRUCTURE
    { id: "dell_ai_factory", ticker: null, name: "Dell AI Factory Deployments", role: "integrated on-premises and data-center AI infrastructure; Dell reported more than 5,000 customers deploying its AI Factory by mid-2026" },
    { id: "dell_enterprise", ticker: null, name: "Enterprise Compute & Storage Deployments", role: "PowerEdge, storage, networking and client infrastructure deployed across corporate, public-sector and service-provider environments" },

    // DOWNSTREAM LAYER +2 — END WORKLOADS
    { id: "dell_workloads", ticker: null, name: "Enterprise AI, HPC & Business Workloads", role: "AI training and inference, scientific computing, analytics, databases, virtualization and general enterprise workloads running on Dell infrastructure" },

    // EXPANDED DENSITY — VERIFIED / HIGH-CONFIDENCE COMPANY NODES
    { id: "avgo", ticker: "AVGO", name: "Broadcom", role: "networking and connectivity silicon supplier represented across enterprise server, storage and networking infrastructure" },
    { id: "qcom", ticker: "QCOM", name: "Qualcomm", role: "Snapdragon compute silicon partner in Dell's current AI-PC and commercial client portfolio" },
    { id: "msft", ticker: "MSFT", name: "Microsoft", role: "Windows, Azure and enterprise-software ecosystem partner across Dell client and infrastructure solutions" },
    { id: "googl", ticker: "GOOGL", name: "Google", role: "AI ecosystem partner integrated into Dell's expanding enterprise AI solution portfolio" },
    { id: "now", ticker: "NOW", name: "ServiceNow", role: "enterprise AI ecosystem partner integrated with Dell infrastructure and services offerings" },
    { id: "pltr", ticker: "PLTR", name: "Palantir", role: "enterprise AI software partner included in Dell's expanding AI ecosystem program" },
  ],

  edges: [
    // VERIFIED SUPPLY / ENABLEMENT / DISTRIBUTION RELATIONSHIPS
    { source: "asml", target: "tsm" },
    { source: "tsm", target: "nvda" },
    { source: "tsm", target: "amd" },
    { source: "nvda", target: "dell_integration" },
    { source: "amd", target: "dell_integration" },
    { source: "intc", target: "dell_integration" },
    { source: "dell_integration", target: "dell" },
    { source: "dell", target: "dell_ai_factory" },
    { source: "dell", target: "dell_enterprise" },
    { source: "dell_ai_factory", target: "dell_workloads" },
    { source: "dell_enterprise", target: "dell_workloads" },

    // EXPANDED DENSITY — VERIFIED / HIGH-CONFIDENCE RELATIONSHIPS
    { source: "tsm", target: "avgo" },
    { source: "tsm", target: "qcom" },
    { source: "avgo", target: "dell_integration" },
    { source: "qcom", target: "dell_integration" },
    { source: "dell", target: "msft" },
    { source: "dell", target: "googl" },
    { source: "dell", target: "now" },
    { source: "dell", target: "pltr" },
    { source: "msft", target: "dell_workloads" },
    { source: "googl", target: "dell_workloads" },
    { source: "now", target: "dell_workloads" },
    { source: "pltr", target: "dell_workloads" },

  ]
},

PG: {
  name: "Procter & Gamble",
  root: "pg",
  nodes: [
    // UPSTREAM LAYER -4 — COMMODITY / FEEDSTOCK INPUTS
    { id: "pg_raw", ticker: null, name: "Commodity, Chemical & Agricultural Feedstocks", role: "base inputs behind P&G consumer products plus fuel and natural gas consumed in manufacturing and transportation" },

    // UPSTREAM LAYER -3 — RAW / PACKAGING MATERIAL SUPPLIERS
    { id: "pg_materials", ticker: null, name: "Third-Party Raw & Packaging Material Suppliers", role: "P&G states that almost all raw and packaging materials are purchased from third parties, including some single-source suppliers" },

    // UPSTREAM LAYER -2 — PRODUCT MANUFACTURING
    { id: "pg_mfg", ticker: null, name: "P&G Manufacturing Plants", role: "global production network converting chemical, fiber, paper, packaging and other inputs into branded household, beauty, grooming, health and personal-care products" },

    // UPSTREAM LAYER -1 — FINISHED-GOODS DISTRIBUTION
    { id: "pg_distribution", ticker: null, name: "Finished-Goods Warehousing & Distribution", role: "packaged consumer products move through P&G's distribution and transportation network toward major retailers, wholesalers and e-commerce customers" },

    // CENTER
    { id: "pg", ticker: "PG", name: "Procter & Gamble", role: "global branded consumer-products company spanning beauty, grooming, health care, fabric and home care, and family care" },

    // DOWNSTREAM LAYER +1 — MAJOR RETAIL CUSTOMER
    { id: "wmt", ticker: "WMT", name: "Walmart", role: "P&G's largest disclosed customer; Walmart and its affiliates represented about 16% of P&G fiscal 2026 net sales" },
    { id: "pg_other_retail", ticker: null, name: "Other Retail, Wholesale & E-Commerce Customers", role: "remaining large retailers, wholesalers, clubs, pharmacies and e-commerce channels; no other individual customer exceeded 10% of P&G sales" },

    // DOWNSTREAM LAYER +2 — CONSUMERS
    { id: "pg_consumers", ticker: null, name: "Household Consumers", role: "end users purchasing and consuming P&G's branded household, personal-care, grooming, beauty and health products" },

    // EXPANDED DENSITY — VERIFIED / HIGH-CONFIDENCE COMPANY NODES
    { id: "iff", ticker: "IFF", name: "International Flavors & Fragrances", role: "P&G-recognized external business partner supplying enzymes and bioscience inputs used in fabric-care products" },
    { id: "crwd", ticker: "CRWD", name: "CrowdStrike", role: "P&G 2025 external business partner award recipient supporting global business services and IT" },
    { id: "jll", ticker: "JLL", name: "JLL", role: "P&G 2025 external business partner award recipient supporting global business services and facilities operations" },
    { id: "expd", ticker: "EXPD", name: "Expeditors", role: "P&G-recognized logistics partner supporting transportation and market operations" },
    { id: "amzn", ticker: "AMZN", name: "Amazon", role: "major e-commerce retail channel for P&G household, beauty, grooming and health products" },
    { id: "cost", ticker: "COST", name: "Costco Wholesale", role: "major warehouse-club retail channel carrying a broad assortment of P&G consumer products" },
    { id: "tgt", ticker: "TGT", name: "Target", role: "major U.S. mass-retail channel carrying P&G products across household and personal-care categories" },
  ],

  edges: [
    // VERIFIED SUPPLY / ENABLEMENT / DISTRIBUTION RELATIONSHIPS
    { source: "pg_raw", target: "pg_materials" },
    { source: "pg_materials", target: "pg_mfg" },
    { source: "pg_mfg", target: "pg_distribution" },
    { source: "pg_distribution", target: "pg" },
    { source: "pg", target: "wmt" },
    { source: "pg", target: "pg_other_retail" },
    { source: "wmt", target: "pg_consumers" },
    { source: "pg_other_retail", target: "pg_consumers" },

    // EXPANDED DENSITY — VERIFIED / HIGH-CONFIDENCE RELATIONSHIPS
    { source: "iff", target: "pg_mfg" },
    { source: "crwd", target: "pg" },
    { source: "jll", target: "pg" },
    { source: "expd", target: "pg_distribution" },
    { source: "pg", target: "amzn" },
    { source: "pg", target: "cost" },
    { source: "pg", target: "tgt" },
    { source: "amzn", target: "pg_consumers" },
    { source: "cost", target: "pg_consumers" },
    { source: "tgt", target: "pg_consumers" },

  ]
},

GE: {
  name: "GE Aerospace",
  root: "ge",
  nodes: [
    // UPSTREAM LAYER -4 — AEROSPACE RAW MATERIALS
    { id: "ge_raw", ticker: null, name: "High-Temperature Alloys, Metals & Aerospace Materials", role: "specialty material base required for turbine blades, combustors, structures, rotating parts and other safety-critical aircraft-engine components" },

    // UPSTREAM LAYER -3 — DIRECT AEROSPACE SUPPLIERS
    { id: "ge_suppliers", ticker: null, name: "500+ Direct GE Aerospace Suppliers", role: "GE Aerospace describes a complex, interconnected supply chain with more than 500 direct suppliers supporting commercial and defense engine production" },

    // UPSTREAM LAYER -2 — COMPONENT / MODULE MANUFACTURING
    { id: "ge_components", ticker: null, name: "Engine Component & Module Manufacturing", role: "production of combustors, turbine-center frames, blades, structures and other precision modules across GE facilities and qualified suppliers" },

    // UPSTREAM LAYER -1 — ENGINE ASSEMBLY / TEST
    { id: "ge_engine_build", ticker: null, name: "Engine Assembly, Test & Quality Release", role: "final module integration, engine assembly, testing and release for GE-branded and joint-venture commercial and military propulsion programs" },

    // CENTER
    { id: "ge", ticker: "GE", name: "GE Aerospace", role: "aerospace propulsion, systems and services company with a large installed base of commercial and military aircraft engines" },

    // DOWNSTREAM LAYER +1 — ENGINE PROGRAM / OEM CHANNELS
    { id: "cfm", ticker: null, name: "CFM International", role: "50/50 joint venture between GE Aerospace and Safran Aircraft Engines producing CFM56 and LEAP engines" },
    { id: "ba", ticker: "BA", name: "Boeing", role: "aircraft OEM whose 737 MAX family is powered by CFM LEAP-1B engines" },
    { id: "eadsy", ticker: "EADSY", name: "Airbus", role: "aircraft OEM whose A320neo-family aircraft can be powered by CFM LEAP-1A engines" },

    // DOWNSTREAM LAYER +2 — AIRLINE / DEFENSE OPERATORS
    { id: "ge_operators", ticker: null, name: "Airlines, Lessors & Defense Operators", role: "operators purchasing aircraft and propulsion systems and generating decades of maintenance, repair, overhaul and spare-parts demand" },

    // EXPANDED DENSITY — VERIFIED / HIGH-CONFIDENCE COMPANY NODES
    { id: "hwm", ticker: "HWM", name: "Howmet Aerospace", role: "major aerospace engine-component supplier providing castings, forgings and other highly engineered parts used across commercial engine programs" },
    { id: "ph", ticker: "PH", name: "Parker-Hannifin", role: "aerospace systems and components supplier serving commercial and defense engine and aircraft platforms" },
    { id: "hxl", ticker: "HXL", name: "Hexcel", role: "advanced composite-material supplier to the commercial aerospace industry and engine/airframe supply chain" },
    { id: "dal", ticker: "DAL", name: "Delta Air Lines", role: "major commercial airline operator of aircraft powered by GE Aerospace and CFM engine families" },
    { id: "ual", ticker: "UAL", name: "United Airlines", role: "major airline customer operating GE Aerospace and CFM-powered aircraft and using engine services" },
    { id: "aal", ticker: "AAL", name: "American Airlines", role: "major airline operator of aircraft powered by CFM and GE Aerospace engine families" },
  ],

  edges: [
    // VERIFIED SUPPLY / ENABLEMENT / DISTRIBUTION RELATIONSHIPS
    { source: "ge_raw", target: "ge_suppliers" },
    { source: "ge_suppliers", target: "ge_components" },
    { source: "ge_components", target: "ge_engine_build" },
    { source: "ge_engine_build", target: "ge" },
    { source: "ge", target: "cfm" },
    { source: "ge", target: "ba" },
    { source: "ge", target: "eadsy" },
    { source: "cfm", target: "ge_operators" },
    { source: "ba", target: "ge_operators" },
    { source: "eadsy", target: "ge_operators" },

    // EXPANDED DENSITY — VERIFIED / HIGH-CONFIDENCE RELATIONSHIPS
    { source: "hwm", target: "ge_components" },
    { source: "ph", target: "ge_components" },
    { source: "hxl", target: "ge_components" },
    { source: "ge", target: "dal" },
    { source: "ge", target: "ual" },
    { source: "ge", target: "aal" },
    { source: "dal", target: "ge_operators" },
    { source: "ual", target: "ge_operators" },
    { source: "aal", target: "ge_operators" },

  ]
},

UNH: {
  name: "UnitedHealth Group",
  root: "unh",
  nodes: [
    // UPSTREAM LAYER -4 — PHARMACEUTICAL INPUT BASE
    { id: "unh_pharma_inputs", ticker: null, name: "Pharmaceutical Raw-Material & Manufacturing Base", role: "upstream chemical, biologic and manufacturing inputs supporting the prescription-drug supply consumed across the U.S. pharmacy ecosystem" },

    // UPSTREAM LAYER -3 — DRUG MANUFACTURERS
    { id: "unh_drug_mfrs", ticker: null, name: "Pharmaceutical Manufacturers", role: "manufacturers whose branded and generic medicines are incorporated into formularies and pharmacy benefits; PBM economics include manufacturer rebates and other negotiated terms" },

    // UPSTREAM LAYER -2 — RETAIL / SPECIALTY PHARMACY NETWORK
    { id: "unh_pharmacies", ticker: null, name: "~64,000 Contracted Retail Pharmacies", role: "Optum Rx's contracted retail network, supplemented by home-delivery, specialty, community-health and infusion pharmacy operations" },

    // UPSTREAM LAYER -1 — OPTUM RX PHARMACY CARE
    { id: "optumrx", ticker: null, name: "Optum Rx", role: "UnitedHealth Group's pharmacy-care platform managing formularies, utilization, pharmacy networks, home delivery, specialty pharmacy and prescription-drug spend" },

    // CENTER
    { id: "unh", ticker: "UNH", name: "UnitedHealth Group", role: "health-care enterprise combining UnitedHealthcare benefits with Optum health services, pharmacy care, technology and analytics" },

    // DOWNSTREAM LAYER +1 — PLAN / CARE CHANNELS
    { id: "unh_plans", ticker: null, name: "Employers, Health Plans & Public-Sector Clients", role: "UnitedHealthcare and Optum Rx clients including employer plans, health-benefit providers, unions, purchasing coalitions and public-sector entities" },
    { id: "unh_care", ticker: null, name: "UnitedHealthcare & Optum Care Delivery", role: "insurance, physician, clinic, pharmacy and care-management channels coordinating benefits and patient care" },

    // DOWNSTREAM LAYER +2 — MEMBERS / PATIENTS
    { id: "unh_members", ticker: null, name: "Members, Patients & Consumers", role: "people receiving insurance coverage, pharmacy benefits, clinical care, prescriptions and other UnitedHealth Group services" },

    // EXPANDED DENSITY — VERIFIED / HIGH-CONFIDENCE COMPANY NODES
    { id: "cvs", ticker: "CVS", name: "CVS Health", role: "major U.S. retail-pharmacy operator participating in the national pharmacy ecosystem through which PBM members fill prescriptions" },
    { id: "kr", ticker: "KR", name: "Kroger Pharmacy", role: "large U.S. grocery-pharmacy operator participating in national pharmacy-benefit networks and dispensing prescriptions to covered members" },
    { id: "wmt", ticker: "WMT", name: "Walmart Pharmacy", role: "large national retail-pharmacy channel serving health-plan and pharmacy-benefit members" },
  ],

  edges: [
    // VERIFIED SUPPLY / ENABLEMENT / DISTRIBUTION RELATIONSHIPS
    { source: "unh_pharma_inputs", target: "unh_drug_mfrs" },
    { source: "unh_drug_mfrs", target: "unh_pharmacies" },
    { source: "unh_pharmacies", target: "optumrx" },
    { source: "optumrx", target: "unh" },
    { source: "unh", target: "unh_plans" },
    { source: "unh", target: "unh_care" },
    { source: "unh_plans", target: "unh_members" },
    { source: "unh_care", target: "unh_members" },

    // EXPANDED DENSITY — VERIFIED / HIGH-CONFIDENCE RELATIONSHIPS
    { source: "unh_drug_mfrs", target: "cvs" },
    { source: "unh_drug_mfrs", target: "kr" },
    { source: "unh_drug_mfrs", target: "wmt" },
    { source: "cvs", target: "optumrx" },
    { source: "kr", target: "optumrx" },
    { source: "wmt", target: "optumrx" },

  ]
},

MS: {
  name: "Morgan Stanley",
  root: "ms",
  nodes: [
    // UPSTREAM LAYER -4 — ADVANCED SEMICONDUCTOR EQUIPMENT
    { id: "asml", ticker: "ASML", name: "ASML", role: "advanced lithography supplier upstream of leading-edge processors and accelerators used in hyperscale cloud infrastructure" },

    // UPSTREAM LAYER -3 — LEADING-EDGE FOUNDRY
    { id: "tsm", ticker: "TSM", name: "TSMC", role: "foundry producing advanced accelerator silicon used in large cloud computing environments" },

    // UPSTREAM LAYER -2 — ACCELERATED COMPUTE SILICON
    { id: "nvda", ticker: "NVDA", name: "NVIDIA", role: "major supplier of accelerator systems deployed in Microsoft Azure and other hyperscale clouds supporting data-intensive and AI workloads" },

    // UPSTREAM LAYER -1 — STRATEGIC CLOUD PLATFORM
    { id: "msft", ticker: "MSFT", name: "Microsoft Azure", role: "Morgan Stanley's strategic cloud partner; the firms announced a long-term collaboration to modernize Morgan Stanley's technology environment using Microsoft cloud capabilities" },

    // CENTER
    { id: "ms", ticker: "MS", name: "Morgan Stanley", role: "global financial-services firm spanning Institutional Securities, Wealth Management and Investment Management" },

    // DOWNSTREAM LAYER +1 — ADVISORY / MARKETS PLATFORMS
    { id: "ms_wealth", ticker: null, name: "Wealth Management Advisor Platform", role: "financial advisors and digital channels delivering brokerage, advisory, banking and wealth services to individual and workplace clients" },
    { id: "ms_inst", ticker: null, name: "Institutional Securities & Investment Platforms", role: "investment banking, sales and trading, prime brokerage, research and asset-management platforms serving institutional clients" },

    // DOWNSTREAM LAYER +2 — CLIENTS
    { id: "ms_clients", ticker: null, name: "Individuals, Corporations & Institutional Investors", role: "wealth clients, corporations, governments, asset owners and investment institutions consuming Morgan Stanley financial services" },

    // EXPANDED DENSITY — VERIFIED / HIGH-CONFIDENCE COMPANY NODES
    { id: "cme", ticker: "CME", name: "CME Group", role: "major derivatives exchange and clearing venue used by institutional markets businesses for futures and options execution" },
    { id: "ice", ticker: "ICE", name: "Intercontinental Exchange", role: "major exchange, clearing and fixed-income market-infrastructure provider used by institutional trading businesses" },
    { id: "ndaq", ticker: "NDAQ", name: "Nasdaq", role: "major U.S. equities and market-technology venue used by institutional execution workflows" },
  ],

  edges: [
    // VERIFIED SUPPLY / ENABLEMENT / DISTRIBUTION RELATIONSHIPS
    { source: "asml", target: "tsm" },
    { source: "tsm", target: "nvda" },
    { source: "nvda", target: "msft" },
    { source: "msft", target: "ms" },
    { source: "ms", target: "ms_wealth" },
    { source: "ms", target: "ms_inst" },
    { source: "ms_wealth", target: "ms_clients" },
    { source: "ms_inst", target: "ms_clients" },

    // EXPANDED DENSITY — VERIFIED / HIGH-CONFIDENCE RELATIONSHIPS
    { source: "ms", target: "cme" },
    { source: "ms", target: "ice" },
    { source: "ms", target: "ndaq" },
    { source: "cme", target: "ms_clients" },
    { source: "ice", target: "ms_clients" },
    { source: "ndaq", target: "ms_clients" },

  ]
},

PANW: {
  name: "Palo Alto Networks",
  root: "panw",
  nodes: [
    // UPSTREAM LAYER -4 — ELECTRONICS RAW MATERIALS
    { id: "panw_raw", ticker: null, name: "Semiconductor, Metal & Electronic Raw Materials", role: "upstream materials, including minerals and electronic inputs, behind the components used in Palo Alto Networks hardware appliances" },

    // UPSTREAM LAYER -3 — COMPONENT MANUFACTURERS
    { id: "panw_components", ticker: null, name: "Electronic Component Suppliers", role: "various suppliers provide component parts sourced either directly by Palo Alto Networks or through its manufacturing partners" },

    // UPSTREAM LAYER -2 — COMPONENT PROCUREMENT / SUBASSEMBLIES
    { id: "panw_procurement", ticker: null, name: "Manufacturing Partner Procurement & Subassemblies", role: "manufacturing partners procure components to Palo Alto Networks specifications and prepare assemblies against company demand forecasts" },

    // UPSTREAM LAYER -1 — ELECTRONICS MANUFACTURING SERVICES
    { id: "flex", ticker: "FLEX", name: "Flex", role: "Palo Alto Networks' disclosed EMS provider; Flex procures components and assembles hardware products to Palo Alto Networks design and quality standards in the U.S." },

    // CENTER
    { id: "panw", ticker: "PANW", name: "Palo Alto Networks", role: "cybersecurity platform provider spanning network security, cloud security, security operations and AI security" },

    // DOWNSTREAM LAYER +1 — CLOUD ECOSYSTEM / MARKETPLACES
    { id: "amzn", ticker: "AMZN", name: "Amazon Web Services", role: "one of the four major cloud ecosystems through which Palo Alto Networks supports cloud deployments and marketplace procurement" },
    { id: "msft", ticker: "MSFT", name: "Microsoft Azure", role: "major cloud ecosystem for Palo Alto Networks software firewall and cloud-security deployments" },
    { id: "googl", ticker: "GOOGL", name: "Google Cloud", role: "strategic cloud partner with more than 80 co-engineered integrations and substantial Google Cloud Marketplace bookings" },
    { id: "orcl", ticker: "ORCL", name: "Oracle Cloud Infrastructure", role: "cloud ecosystem partner for Palo Alto Networks security products and marketplace transactions" },

    // DOWNSTREAM LAYER +2 — SECURED ORGANIZATIONS
    { id: "panw_customers", ticker: null, name: "Enterprise, Government & Cloud Customers", role: "organizations buying Palo Alto Networks subscriptions, hardware and cloud-delivered security to protect users, applications, networks, data and AI workloads" },

    // EXPANDED DENSITY — VERIFIED / HIGH-CONFIDENCE COMPANY NODES
    { id: "acn", ticker: "ACN", name: "Accenture", role: "global systems-integration partner delivering Palo Alto Networks security as part of large-scale digital and cloud transformations" },
  ],

  edges: [
    // VERIFIED SUPPLY / ENABLEMENT / DISTRIBUTION RELATIONSHIPS
    { source: "panw_raw", target: "panw_components" },
    { source: "panw_components", target: "panw_procurement" },
    { source: "panw_procurement", target: "flex" },
    { source: "flex", target: "panw" },
    { source: "panw", target: "amzn" },
    { source: "panw", target: "msft" },
    { source: "panw", target: "googl" },
    { source: "panw", target: "orcl" },
    { source: "amzn", target: "panw_customers" },
    { source: "msft", target: "panw_customers" },
    { source: "googl", target: "panw_customers" },
    { source: "orcl", target: "panw_customers" },

    // EXPANDED DENSITY — VERIFIED / HIGH-CONFIDENCE RELATIONSHIPS
    { source: "panw", target: "acn" },
    { source: "acn", target: "panw_customers" },

  ]
},

PM: {
  name: "Philip Morris International",
  root: "pm",
  nodes: [
    // UPSTREAM LAYER -4 — AGRICULTURAL ORIGIN
    { id: "pm_farmers", ticker: null, name: "Tobacco Farmers & Agricultural Inputs", role: "global tobacco-growing base supplying leaf through independent suppliers and direct farmer contracts; PMI also sources agricultural and paper/pulp inputs across its value chain" },

    // UPSTREAM LAYER -3 — LEAF / DIRECT MATERIAL SUPPLIERS
    { id: "pm_leaf", ticker: null, name: "Tobacco Leaf & Direct Material Suppliers", role: "independent tobacco suppliers plus direct-material vendors; PMI's disclosed direct materials include paperboard, acetate tow, fine paper and susceptors" },

    // UPSTREAM LAYER -2 — PACKAGING / FILTER / ELECTRONICS INPUTS
    { id: "pm_materials", ticker: null, name: "Packaging, Filter & Smoke-Free Electronics Inputs", role: "printed paperboard, filter materials, papers, electronics and other components used across combustible and smoke-free product manufacturing" },

    // UPSTREAM LAYER -1 — PMI / CONTRACT MANUFACTURING
    { id: "pm_mfg", ticker: null, name: "PMI Manufacturing Network", role: "PMI factories and manufacturing operations convert tobacco, nicotine, packaging and electronics inputs into cigarettes, heated-tobacco consumables, devices and oral nicotine products" },
    { id: "mo", ticker: "MO", name: "Altria", role: "contract-manufacturing counterparty under PMI's August 2026 arrangement for combustible cigarettes, with first shipments expected in 2027 subject to readiness and approvals" },

    // CENTER
    { id: "pm", ticker: "PM", name: "Philip Morris International", role: "global nicotine company selling smoke-free products and combustible cigarettes across international and U.S. markets" },

    // DOWNSTREAM LAYER +1 — DISTRIBUTION / RETAIL
    { id: "pm_channels", ticker: null, name: "Wholesalers, Distributors & Retail Channels", role: "country-level distribution and retail networks moving PMI cigarettes, heated-tobacco products, nicotine pouches and devices to legal-age consumers" },

    // DOWNSTREAM LAYER +2 — LEGAL-AGE USERS
    { id: "pm_consumers", ticker: null, name: "Legal-Age Nicotine Consumers", role: "adult smokers and adult nicotine users purchasing PMI products in markets where those products are authorized for sale" }
  ],

  edges: [
    // VERIFIED SUPPLY / ENABLEMENT / DISTRIBUTION RELATIONSHIPS
    { source: "pm_farmers", target: "pm_leaf" },
    { source: "pm_leaf", target: "pm_materials" },
    { source: "pm_materials", target: "pm_mfg" },
    { source: "pm_mfg", target: "pm" },
    { source: "mo", target: "pm" },
    { source: "pm", target: "pm_channels" },
    { source: "pm_channels", target: "pm_consumers" }
  ]
},

NFLX: {
  name: "Netflix",
  root: "nflx",
  nodes: [
    // UPSTREAM LAYER -4 — ADVANCED SEMICONDUCTOR EQUIPMENT
    { id: "asml", ticker: "ASML", name: "ASML", role: "advanced lithography equipment upstream of leading processors and accelerators used in cloud infrastructure supporting media production and computing" },

    // UPSTREAM LAYER -3 — LEADING-EDGE FOUNDRY
    { id: "tsm", ticker: "TSM", name: "TSMC", role: "advanced foundry producing accelerator silicon used in major cloud platforms" },

    // UPSTREAM LAYER -2 — GPU / ACCELERATED COMPUTE
    { id: "nvda", ticker: "NVDA", name: "NVIDIA", role: "GPU technology used in AWS accelerated instances that Netflix has used for visual-effects and production workloads" },

    // UPSTREAM LAYER -1 — CLOUD COMPUTE PLATFORM
    { id: "amzn", ticker: "AMZN", name: "Amazon Web Services", role: "core cloud infrastructure provider used by Netflix for compute, storage, data processing and many platform operations" },

    // CENTER
    { id: "nflx", ticker: "NFLX", name: "Netflix", role: "global streaming entertainment service producing, licensing and distributing films, series, games and other entertainment content" },

    // DOWNSTREAM LAYER +1 — CONTENT DELIVERY NETWORK
    { id: "openconnect", ticker: null, name: "Netflix Open Connect", role: "Netflix's purpose-built content delivery network that places content servers close to members and peers directly with ISP networks around the world" },

    // DOWNSTREAM LAYER +2 — ISP / MEMBER DELIVERY
    { id: "nflx_isps", ticker: null, name: "Residential Internet Service Providers", role: "thousands of ISP partners receiving Netflix traffic through direct Open Connect interconnections or local Open Connect appliances" },
    { id: "nflx_members", ticker: null, name: "Netflix Members", role: "end viewers receiving Netflix streams from Open Connect infrastructure through their broadband or mobile internet provider" },

    // EXPANDED DENSITY — VERIFIED / HIGH-CONFIDENCE COMPANY NODES
    { id: "sony", ticker: "SONY", name: "Sony Group", role: "major studio content supplier with a long-term first-pay-window licensing relationship that feeds films into Netflix's catalog" },
    { id: "dis", ticker: "DIS", name: "Disney", role: "major studio content licensor whose selected film and television titles are licensed to Netflix under content agreements" },
    { id: "wbd", ticker: "WBD", name: "Warner Bros. Discovery", role: "major studio content supplier licensing selected film and television programming into Netflix's service" },
    { id: "para", ticker: "PSKY", name: "Paramount Skydance", role: "major film and television studio whose Paramount programming is licensed and distributed through streaming platforms including Netflix" },
    { id: "cmcsa", ticker: "CMCSA", name: "Comcast Xfinity", role: "large U.S. residential broadband provider in the ISP ecosystem through which Netflix Open Connect traffic reaches subscribers" },
    { id: "vz", ticker: "VZ", name: "Verizon", role: "large U.S. ISP/mobile network participating in internet interconnection through which Netflix traffic reaches subscribers" },
    { id: "t", ticker: "T", name: "AT&T", role: "large U.S. broadband and mobile network carrying Netflix traffic to subscribers" },
    { id: "tmus", ticker: "TMUS", name: "T-Mobile", role: "large U.S. mobile and fixed-wireless network carrying Netflix traffic to subscribers" },
    { id: "chtr", ticker: "CHTR", name: "Charter Communications", role: "large U.S. residential broadband provider in the ISP ecosystem through which Netflix Open Connect delivers traffic" },
  ],

  edges: [
    // VERIFIED SUPPLY / ENABLEMENT / DISTRIBUTION RELATIONSHIPS
    { source: "asml", target: "tsm" },
    { source: "tsm", target: "nvda" },
    { source: "nvda", target: "amzn" },
    { source: "amzn", target: "nflx" },
    { source: "nflx", target: "openconnect" },
    { source: "openconnect", target: "nflx_isps" },
    { source: "openconnect", target: "nflx_members" },

    // EXPANDED DENSITY — VERIFIED / HIGH-CONFIDENCE RELATIONSHIPS
    { source: "sony", target: "nflx" },
    { source: "dis", target: "nflx" },
    { source: "wbd", target: "nflx" },
    { source: "para", target: "nflx" },
    { source: "openconnect", target: "vz" },
    { source: "openconnect", target: "t" },
    { source: "openconnect", target: "tmus" },
    { source: "openconnect", target: "cmcsa" },
    { source: "openconnect", target: "chtr" },
    { source: "vz", target: "nflx_members" },
    { source: "t", target: "nflx_members" },
    { source: "tmus", target: "nflx_members" },
    { source: "cmcsa", target: "nflx_members" },
    { source: "chtr", target: "nflx_members" },

  ]
},

HD: {
  name: "The Home Depot",
  root: "hd",
  nodes: [
    // UPSTREAM LAYER -4 — RAW MATERIAL / COMMODITY BASE
    { id: "hd_raw", ticker: null, name: "Lumber, Metals, Resins & Home-Improvement Inputs", role: "commodity and industrial material base behind building materials, appliances, tools, fixtures and home-improvement products sold through Home Depot" },

    // UPSTREAM LAYER -3 — PRODUCT MANUFACTURERS / VENDORS
    { id: "hd_vendors", ticker: null, name: "Home-Improvement Product Vendors", role: "manufacturer and vendor network supplying branded and private-label products across building materials, hardware, appliances, decor, garden and maintenance categories" },

    // UPSTREAM LAYER -2 — INBOUND TRANSPORT / CONSOLIDATION
    { id: "hd_inbound", ticker: null, name: "Inbound Freight & Vendor-to-Network Replenishment", role: "transportation and inventory-replenishment flows moving vendor product into Home Depot's specialized distribution and fulfillment network" },

    // UPSTREAM LAYER -1 — DISTRIBUTION / FULFILLMENT NETWORK
    { id: "hd_dc", ticker: null, name: "RDC, SDC, BDC, FDC & Direct Fulfillment Centers", role: "Home Depot's multiple U.S., Canada and Mexico distribution-center platforms supporting stores, online orders, bulk products and large-item job-site delivery" },

    // CENTER
    { id: "hd", ticker: "HD", name: "The Home Depot", role: "home-improvement retailer operating more than 2,300 stores plus digital, fulfillment, professional-customer and building-products distribution capabilities" },

    // DOWNSTREAM LAYER +1 — CUSTOMER-FACING CHANNELS
    { id: "hd_stores", ticker: null, name: "Home Depot Stores & Interconnected Retail", role: "stores function as selling locations and as pickup, return and delivery-fulfillment nodes; about half of U.S. online orders were fulfilled through a store in fiscal 2025" },
    { id: "hd_pro", ticker: null, name: "Pro / Job-Site Distribution", role: "specialized fulfillment and branch capabilities, including flatbed and job-site delivery, serving professional contractors and larger project demand" },

    // DOWNSTREAM LAYER +2 — END CUSTOMERS
    { id: "hd_diy", ticker: null, name: "DIY Consumers", role: "households purchasing home-improvement, repair, decor, garden and maintenance products in stores and online" },
    { id: "hd_pro_customers", ticker: null, name: "Professional Contractors", role: "pros, tradespeople and project customers purchasing building materials, supplies, fulfillment and job-site delivery" },

    // EXPANDED DENSITY — VERIFIED / HIGH-CONFIDENCE COMPANY NODES
    { id: "cent", ticker: "CENT", name: "Central Garden & Pet", role: "major lawn-and-garden and pet-products supplier; Home Depot represented about 16% of Central's 2025 sales" },
    { id: "nwl", ticker: "NWL", name: "Newell Brands", role: "consumer-products supplier listing Home Depot among its top-ten customers in 2025" },
    { id: "uber", ticker: "UBER", name: "Uber", role: "on-demand delivery partner providing Home Depot product ordering and scheduled or rapid delivery through Uber Eats" },
    { id: "dash", ticker: "DASH", name: "DoorDash", role: "on-demand delivery partner offering Home Depot products through the DoorDash marketplace" },
    { id: "cart", ticker: "CART", name: "Instacart", role: "same-day delivery partner providing Home Depot orders from nearly 2,000 store locations" },
  ],

  edges: [
    // VERIFIED SUPPLY / ENABLEMENT / DISTRIBUTION RELATIONSHIPS
    { source: "hd_raw", target: "hd_vendors" },
    { source: "hd_vendors", target: "hd_inbound" },
    { source: "hd_inbound", target: "hd_dc" },
    { source: "hd_dc", target: "hd" },
    { source: "hd", target: "hd_stores" },
    { source: "hd", target: "hd_pro" },
    { source: "hd_stores", target: "hd_diy" },
    { source: "hd_stores", target: "hd_pro_customers" },
    { source: "hd_pro", target: "hd_pro_customers" },

    // EXPANDED DENSITY — VERIFIED / HIGH-CONFIDENCE RELATIONSHIPS
    { source: "hd_raw", target: "cent" },
    { source: "hd_raw", target: "nwl" },
    { source: "cent", target: "hd_inbound" },
    { source: "nwl", target: "hd_inbound" },
    { source: "hd", target: "uber" },
    { source: "hd", target: "dash" },
    { source: "hd", target: "cart" },
    { source: "uber", target: "hd_diy" },
    { source: "dash", target: "hd_diy" },
    { source: "cart", target: "hd_diy" },
    { source: "uber", target: "hd_pro_customers" },
    { source: "dash", target: "hd_pro_customers" },
    { source: "cart", target: "hd_pro_customers" },

  ]
},

GS: {
  name: "Goldman Sachs",
  root: "gs",
  nodes: [
    // UPSTREAM LAYER -4 — MARKET VENUES / PRIMARY FINANCIAL INPUTS
    { id: "ice", ticker: "ICE", name: "Intercontinental Exchange", role: "major exchange, clearing and market-data infrastructure used across global cash and derivatives markets in which Goldman Sachs operates" },
    { id: "cme", ticker: "CME", name: "CME Group", role: "major futures and derivatives exchange and clearing infrastructure supporting institutional trading and risk-management activity" },

    // UPSTREAM LAYER -3 — CLEARING / SETTLEMENT / REFERENCE INFRASTRUCTURE
    { id: "gs_mktinfra", ticker: null, name: "Clearing, Settlement, Custody & Reference-Data Infrastructure", role: "third-party market utilities, custodians, depositories, payment systems and reference-data services that support transaction processing and asset servicing" },

    // UPSTREAM LAYER -2 — TECHNOLOGY / CONNECTIVITY / CYBERSECURITY
    { id: "gs_tech", ticker: null, name: "Cloud, Hardware, Software & Network Service Providers", role: "external technology providers supply infrastructure, software, connectivity, cybersecurity and operational services used by a globally distributed financial institution" },

    // UPSTREAM LAYER -1 — INTERNAL TRANSACTION / RISK PLATFORM
    { id: "gs_ops", ticker: null, name: "Goldman Sachs Trading, Risk, Data & Operations Platforms", role: "internal systems aggregate market data, client orders, risk, compliance, financing, settlement and portfolio information before services are delivered to clients" },

    // CENTER
    { id: "gs", ticker: "GS", name: "Goldman Sachs", role: "global financial institution providing investment banking, markets, asset management and wealth-management services" },

    // DOWNSTREAM LAYER +1 — CLIENT FRANCHISES
    { id: "gs_gbm", ticker: null, name: "Global Banking & Markets Clients", role: "corporations, financial institutions, governments, sponsors and investors using advisory, underwriting, financing, market-making and execution services" },
    { id: "gs_awm", ticker: null, name: "Asset & Wealth Management Clients", role: "institutions, private wealth clients and third-party investors allocating capital through Goldman Sachs investment and advisory products" },

    // DOWNSTREAM LAYER +2 — CAPITAL / PORTFOLIO OUTCOMES
    { id: "gs_capital", ticker: null, name: "Issuers, Investors & Capital Markets", role: "end markets where financing, securities issuance, liquidity and risk transfer occur" },
    { id: "gs_portfolios", ticker: null, name: "Institutional & Private Portfolios", role: "end portfolios receiving investment management, alternatives, advisory and wealth-management services" },

    // EXPANDED DENSITY — VERIFIED / HIGH-CONFIDENCE COMPANY NODES
    { id: "ndaq", ticker: "NDAQ", name: "Nasdaq", role: "major U.S. equities, options, market-data and market-technology venue supporting institutional trading activity in which Goldman Sachs participates" },
    { id: "cboe", ticker: "CBOE", name: "Cboe Global Markets", role: "major options, equities, futures and volatility-market infrastructure used by institutional trading and risk-management businesses" },
    { id: "aws", ticker: "AMZN", name: "Amazon Web Services", role: "strategic cloud collaborator with Goldman Sachs; the firms jointly launched Goldman Sachs Financial Cloud for Data on AWS" },
  ],

  edges: [
    // VERIFIED / DISCLOSED SUPPLY, ENABLEMENT OR DISTRIBUTION RELATIONSHIPS
    { source: "ice", target: "gs_mktinfra" },
    { source: "cme", target: "gs_mktinfra" },
    { source: "gs_mktinfra", target: "gs_tech" },
    { source: "gs_tech", target: "gs_ops" },
    { source: "gs_ops", target: "gs" },
    { source: "gs", target: "gs_gbm" },
    { source: "gs", target: "gs_awm" },
    { source: "gs_gbm", target: "gs_capital" },
    { source: "gs_awm", target: "gs_portfolios" },

    // EXPANDED DENSITY — VERIFIED / HIGH-CONFIDENCE RELATIONSHIPS
    { source: "ndaq", target: "gs_mktinfra" },
    { source: "cboe", target: "gs_mktinfra" },
    { source: "aws", target: "gs_ops" },

  ]
},

ANET: {
  name: "Arista Networks",
  root: "anet",
  nodes: [
    // UPSTREAM LAYER -4 — SEMICONDUCTOR / COMPONENT INPUT BASE
    { id: "anet_materials", ticker: null, name: "Semiconductor, Optical & Power-Component Inputs", role: "wafer, substrate, optical, memory, power-supply and electronic-component inputs underlying Arista switching and routing systems" },

    // UPSTREAM LAYER -3 — KEY SILICON / COMPONENT SUPPLIERS
    { id: "anet_silicon", ticker: null, name: "Primary Merchant Switching-Silicon Supplier", role: "Arista states that it relies heavily on a single merchant-silicon supplier for switching chips; the supplier is not named in the 2025 10-K" },
    { id: "anet_components", ticker: null, name: "Integrated-Circuit, Optics & Power Suppliers", role: "limited-source and sometimes sole-source suppliers provide key ICs, optical components and power supplies used in Arista systems" },

    // UPSTREAM LAYER -2 — CONTRACT MANUFACTURING
    { id: "anet_cm", ticker: null, name: "Three Primary Contract Manufacturing Partners", role: "three contract manufacturers provided the vast majority of Arista's electronic manufacturing services as of year-end 2025; the filing does not name them" },

    // UPSTREAM LAYER -1 — FULFILLMENT / FINAL CONFIGURATION
    { id: "anet_fulfill", ticker: null, name: "Third-Party Direct Fulfillment Facilities", role: "fulfillment partners receive manufactured systems and perform labeling, final configuration, quality-assurance testing and shipment" },

    // CENTER
    { id: "anet", ticker: "ANET", name: "Arista Networks", role: "designs high-speed Ethernet switching, routing and network software platforms for cloud, AI, service-provider and enterprise networks" },

    // DOWNSTREAM LAYER +1 — SALES CHANNELS / LARGE DEPLOYMENTS
    { id: "anet_channel", ticker: null, name: "Distributors, VARs, Systems Integrators & OEM Partners", role: "Arista sells through its direct sales force and channel partners, including distributors, value-added resellers, systems integrators and OEM partners" },
    { id: "anet_cloud", ticker: null, name: "Cloud & AI Titan Deployments", role: "large cloud and AI customers deploy Arista networking at data-center scale; this customer category represented roughly 48% of 2025 revenue" },

    // DOWNSTREAM LAYER +2 — END CUSTOMERS
    { id: "msft", ticker: "MSFT", name: "Microsoft", role: "historically disclosed major Arista cloud customer; Microsoft represented 20% of Arista revenue in 2024 and remains a core Cloud and AI Titan relationship" },
    { id: "meta", ticker: "META", name: "Meta Platforms", role: "historically disclosed major Arista cloud customer; Meta represented 15% of Arista revenue in 2024 and remains a core Cloud and AI Titan relationship" },
    { id: "anet_enterprise", ticker: null, name: "Enterprise, Provider & Government Networks", role: "financial-services, government, media, healthcare, industrial, service-provider and specialty-AI customers operating Arista networks" },

    // EXPANDED DENSITY — VERIFIED / HIGH-CONFIDENCE COMPANY NODES
    { id: "jbl", ticker: "JBL", name: "Jabil", role: "one of Arista's primary contract manufacturing partners identified in its 2025 Form 10-K" },
    { id: "sanm", ticker: "SANM", name: "Sanmina", role: "one of Arista's primary contract manufacturing partners identified in its 2025 Form 10-K" },
    { id: "flex", ticker: "FLEX", name: "Flex", role: "one of Arista's primary contract manufacturing partners identified in its 2025 Form 10-K" },
    { id: "foxconn", ticker: null, name: "Foxconn / Hon Hai", role: "contract manufacturing partner identified by Arista; provides high-volume electronics manufacturing capacity" },
  ],

  edges: [
    // VERIFIED / DISCLOSED SUPPLY, ENABLEMENT OR DISTRIBUTION RELATIONSHIPS
    { source: "anet_materials", target: "anet_silicon" },
    { source: "anet_materials", target: "anet_components" },
    { source: "anet_silicon", target: "anet_cm" },
    { source: "anet_components", target: "anet_cm" },
    { source: "anet_cm", target: "anet_fulfill" },
    { source: "anet_fulfill", target: "anet" },
    { source: "anet", target: "anet_channel" },
    { source: "anet", target: "anet_cloud" },
    { source: "anet_cloud", target: "msft" },
    { source: "anet_cloud", target: "meta" },
    { source: "anet_channel", target: "anet_enterprise" },

    // EXPANDED DENSITY — VERIFIED / HIGH-CONFIDENCE RELATIONSHIPS
    { source: "anet_silicon", target: "jbl" },
    { source: "anet_components", target: "jbl" },
    { source: "anet_silicon", target: "sanm" },
    { source: "anet_components", target: "sanm" },
    { source: "anet_silicon", target: "flex" },
    { source: "anet_components", target: "flex" },
    { source: "anet_silicon", target: "foxconn" },
    { source: "anet_components", target: "foxconn" },
    { source: "jbl", target: "anet_fulfill" },
    { source: "sanm", target: "anet_fulfill" },
    { source: "flex", target: "anet_fulfill" },
    { source: "foxconn", target: "anet_fulfill" },

  ]
},

SNDK: {
  name: "Sandisk",
  root: "sndk",
  nodes: [
    // UPSTREAM LAYER -4 — SEMICONDUCTOR EQUIPMENT / MATERIALS
    { id: "sndk_fabinputs", ticker: null, name: "Flash-Fab Equipment, Silicon Wafers & Process Materials", role: "semiconductor manufacturing equipment and process materials used by the jointly funded Flash Ventures wafer-fabrication operations in Japan" },

    // UPSTREAM LAYER -3 — FLASH WAFER MANUFACTURING
    { id: "kioxia", ticker: null, name: "Kioxia / Flash Ventures", role: "Sandisk obtains all flash-based memory from joint ventures with Kioxia; the ventures operate across Yokkaichi and Kitakami fabs and supply leading-edge NAND wafers" },

    // UPSTREAM LAYER -2 — CONTROLLERS / MEMORY SUBASSEMBLIES
    { id: "sndk_ctrl", ticker: null, name: "Controller Foundries & Third-Party Controller Suppliers", role: "Sandisk designs many controllers internally but uses third-party foundries and suppliers to manufacture or provide controller silicon combined with NAND flash" },

    // UPSTREAM LAYER -1 — ASSEMBLY / TEST / PACKAGING
    { id: "sndk_penang", ticker: null, name: "Penang Assembly & Test Operations", role: "Sandisk's internal Malaysia facilities perform assembly and test for flash products" },
    { id: "sndk_cm", ticker: null, name: "Contract Manufacturers & SDSS Assembly/Test", role: "external manufacturing partners and the SDSS venture supplement packaging, assembly and test capacity" },

    // CENTER
    { id: "sndk", ticker: "SNDK", name: "Sandisk", role: "develops and sells NAND flash memory, enterprise and client SSDs, embedded flash and removable storage products" },

    // DOWNSTREAM LAYER +1 — SALES / INTEGRATION CHANNELS
    { id: "sndk_oem", ticker: null, name: "OEM & Data-Center Integration Customers", role: "device, server and storage-system manufacturers integrate Sandisk flash and SSD products into computing infrastructure and devices" },
    { id: "sndk_channel", ticker: null, name: "Distributors, Retail & E-Commerce Channels", role: "distribution and retail channels sell branded flash storage products to businesses and consumers" },

    // DOWNSTREAM LAYER +2 — END USE
    { id: "sndk_dc", ticker: null, name: "Cloud & Enterprise Data Centers", role: "AI, cloud and enterprise systems consume high-capacity NAND and SSD storage" },
    { id: "sndk_client", ticker: null, name: "PC, Mobile & Consumer Storage Users", role: "client devices, removable media and consumer-storage products convert NAND output into end-user storage capacity" },

    // EXPANDED DENSITY — VERIFIED / HIGH-CONFIDENCE COMPANY NODES
    { id: "dell", ticker: "DELL", name: "Dell Technologies", role: "OEM channel explicitly cited by Sandisk in describing drives supplied for installation in third-party computer systems" },
    { id: "aapl", ticker: "AAPL", name: "Apple", role: "OEM example explicitly cited in Sandisk support materials describing storage supplied for third-party systems" },
    { id: "cdw", ticker: "CDW", name: "CDW", role: "authorized Sandisk reseller serving commercial and institutional technology buyers" },
    { id: "bby", ticker: "BBY", name: "Best Buy", role: "major consumer-electronics retail channel with Sandisk products and retailer-specific product availability" },
    { id: "amzn", ticker: "AMZN", name: "Amazon", role: "large e-commerce channel for Sandisk retail storage products and an OEM/channel example in Sandisk support materials" },
  ],

  edges: [
    // VERIFIED / DISCLOSED SUPPLY, ENABLEMENT OR DISTRIBUTION RELATIONSHIPS
    { source: "sndk_fabinputs", target: "kioxia" },
    { source: "kioxia", target: "sndk_ctrl" },
    { source: "sndk_ctrl", target: "sndk_penang" },
    { source: "sndk_ctrl", target: "sndk_cm" },
    { source: "sndk_penang", target: "sndk" },
    { source: "sndk_cm", target: "sndk" },
    { source: "sndk", target: "sndk_oem" },
    { source: "sndk", target: "sndk_channel" },
    { source: "sndk_oem", target: "sndk_dc" },
    { source: "sndk_oem", target: "sndk_client" },
    { source: "sndk_channel", target: "sndk_client" },

    // EXPANDED DENSITY — VERIFIED / HIGH-CONFIDENCE RELATIONSHIPS
    { source: "sndk", target: "dell" },
    { source: "sndk", target: "aapl" },
    { source: "sndk", target: "cdw" },
    { source: "sndk", target: "bby" },
    { source: "sndk", target: "amzn" },
    { source: "dell", target: "sndk_dc" },
    { source: "aapl", target: "sndk_client" },
    { source: "cdw", target: "sndk_client" },
    { source: "bby", target: "sndk_client" },
    { source: "amzn", target: "sndk_client" },

  ]
},

CRWD: {
  name: "CrowdStrike",
  root: "crwd",
  nodes: [
    // UPSTREAM LAYER -4 — DATA-CENTER / INTERNET FOUNDATION
    { id: "crwd_physical", ticker: null, name: "Data Centers, Internet Backbone & Network Capacity", role: "physical hosting, global connectivity, power and network infrastructure underpin the public-cloud services used to deliver the Falcon platform" },

    // UPSTREAM LAYER -3 — PUBLIC CLOUD INFRASTRUCTURE
    { id: "aws", ticker: "AMZN", name: "Amazon Web Services", role: "strategic cloud and marketplace partner; CrowdStrike sells Falcon through AWS Marketplace and has expanded security collaboration with AWS" },
    { id: "gcp", ticker: "GOOGL", name: "Google Cloud", role: "cloud and marketplace partner through which CrowdStrike products are distributed and integrated" },
    { id: "azure", ticker: "MSFT", name: "Microsoft Azure", role: "cloud and marketplace ecosystem partner; Microsoft Marketplace distribution begins in CrowdStrike fiscal 2027" },

    // UPSTREAM LAYER -2 — CLOUD COMPUTE / STORAGE / TELEMETRY PIPELINE
    { id: "crwd_cloud", ticker: null, name: "Falcon Cloud-Scale Compute, Storage & Data Pipeline", role: "CrowdStrike's cloud-native platform ingests endpoint, identity, cloud and threat telemetry and processes it at cloud scale" },

    // UPSTREAM LAYER -1 — THREAT INTELLIGENCE / PLATFORM OPERATIONS
    { id: "crwd_intel", ticker: null, name: "Threat Intelligence, Research & Falcon Platform Operations", role: "internal researchers, intelligence analysts, threat hunters and engineering teams continuously update detections, models and cloud modules" },

    // CENTER
    { id: "crwd", ticker: "CRWD", name: "CrowdStrike", role: "operates the cloud-native Falcon cybersecurity platform across endpoint, identity, cloud, SIEM, exposure management and threat intelligence" },

    // DOWNSTREAM LAYER +1 — GO-TO-MARKET ECOSYSTEM
    { id: "crwd_channel", ticker: null, name: "Resellers, Distributors, MSSPs, MSPs & Global System Integrators", role: "CrowdStrike follows a partner-first go-to-market strategy through a global channel ecosystem" },
    { id: "crwd_marketplaces", ticker: null, name: "AWS, Google & Microsoft Marketplaces", role: "cloud marketplaces let customers procure Falcon using existing cloud commercial relationships and committed spend" },

    // DOWNSTREAM LAYER +2 — PROTECTED ORGANIZATIONS
    { id: "crwd_enterprise", ticker: null, name: "Enterprise & SMB Customers", role: "commercial organizations deploy Falcon across endpoints, identities, workloads and security operations" },
    { id: "crwd_public", ticker: null, name: "Government & Public-Sector Customers", role: "public-sector organizations deploy authorized Falcon capabilities for endpoint, cloud and operational-technology protection" },

    // EXPANDED DENSITY — VERIFIED / HIGH-CONFIDENCE COMPANY NODES
    { id: "intc", ticker: "INTC", name: "Intel", role: "strategic technology collaborator with CrowdStrike on hardware-assisted endpoint security and platform integrations" },
    { id: "dell", ticker: "DELL", name: "Dell Technologies", role: "CrowdStrike alliance partner integrating Falcon cybersecurity with Dell commercial and security offerings" },
    { id: "acn", ticker: "ACN", name: "Accenture", role: "CrowdStrike global systems-integration and services partner delivering Falcon deployments and managed security outcomes" },
    { id: "now", ticker: "NOW", name: "ServiceNow", role: "CrowdStrike technology and ecosystem partner connecting security operations and enterprise workflows" },
    { id: "zs", ticker: "ZS", name: "Zscaler", role: "CrowdStrike technology alliance partner across zero-trust, endpoint and cloud-security workflows" },
    { id: "ibm", ticker: "IBM", name: "IBM", role: "enterprise services and security ecosystem partner supporting CrowdStrike deployments for large organizations" },
  ],

  edges: [
    // VERIFIED / DISCLOSED SUPPLY, ENABLEMENT OR DISTRIBUTION RELATIONSHIPS
    { source: "crwd_physical", target: "aws" },
    { source: "crwd_physical", target: "gcp" },
    { source: "crwd_physical", target: "azure" },
    { source: "aws", target: "crwd_cloud" },
    { source: "gcp", target: "crwd_cloud" },
    { source: "azure", target: "crwd_cloud" },
    { source: "crwd_cloud", target: "crwd_intel" },
    { source: "crwd_intel", target: "crwd" },
    { source: "crwd", target: "crwd_channel" },
    { source: "crwd", target: "crwd_marketplaces" },
    { source: "crwd_channel", target: "crwd_enterprise" },
    { source: "crwd_channel", target: "crwd_public" },
    { source: "crwd_marketplaces", target: "crwd_enterprise" },

    // EXPANDED DENSITY — VERIFIED / HIGH-CONFIDENCE RELATIONSHIPS
    { source: "intc", target: "crwd_intel" },
    { source: "crwd", target: "dell" },
    { source: "crwd", target: "acn" },
    { source: "crwd", target: "now" },
    { source: "crwd", target: "zs" },
    { source: "crwd", target: "ibm" },
    { source: "dell", target: "crwd_enterprise" },
    { source: "acn", target: "crwd_enterprise" },
    { source: "now", target: "crwd_enterprise" },
    { source: "zs", target: "crwd_enterprise" },
    { source: "ibm", target: "crwd_enterprise" },

  ]
},

RTX: {
  name: "RTX",
  root: "rtx",
  nodes: [
    // UPSTREAM LAYER -4 — RAW MATERIALS
    { id: "rtx_materials", ticker: null, name: "Specialty Metals, Superalloys, Composites & Electronic Materials", role: "global commodity and specialty-material inputs used in aircraft engines, avionics, sensors, missiles and defense electronics" },

    // UPSTREAM LAYER -3 — SUPPLIER PARTS / SUBSYSTEMS
    { id: "rtx_parts", ticker: null, name: "Supplier-Provided Parts, Components & Subsystems", role: "RTX relies on U.S. and non-U.S. suppliers, including single-source suppliers in some cases, for parts, components and complex subsystems" },

    // UPSTREAM LAYER -2 — CONTRACT MANUFACTURING / PROCESSING
    { id: "rtx_cm", ticker: null, name: "Contract Manufacturing & Specialized Processing", role: "third-party manufacturing, machining, casting, electronics and specialized processing supplement RTX's internal production capabilities" },

    // UPSTREAM LAYER -1 — RTX MANUFACTURING / SYSTEM INTEGRATION
    { id: "rtx_collins", ticker: null, name: "Collins Aerospace Integration", role: "integrates avionics, interiors, actuation, landing, power and mission systems for commercial and defense platforms" },
    { id: "rtx_pratt", ticker: null, name: "Pratt & Whitney Engine Manufacturing", role: "manufactures and services commercial and military aircraft engines, including the GTF family and F135" },
    { id: "rtx_raytheon", ticker: null, name: "Raytheon Defense Systems Integration", role: "integrates missiles, sensors, radars, air-defense and other defense products for government customers" },

    // CENTER
    { id: "rtx", ticker: "RTX", name: "RTX", role: "aerospace and defense company combining Collins Aerospace, Pratt & Whitney and Raytheon businesses" },

    // DOWNSTREAM LAYER +1 — PLATFORM / GOVERNMENT CUSTOMERS
    { id: "airbus", ticker: null, name: "Airbus", role: "Pratt & Whitney's largest commercial customer by sales in 2025; Airbus aircraft platforms use GTF engines and Collins systems" },
    { id: "lmt", ticker: "LMT", name: "Lockheed Martin", role: "F-35 prime contractor; Pratt & Whitney's F135 exclusively powers the F-35 fleet" },
    { id: "rtx_gov", ticker: null, name: "U.S. & Allied Governments", role: "government customers purchase defense systems, military engines and services; U.S. government sales represented a major share of RTX revenue" },

    // DOWNSTREAM LAYER +2 — OPERATORS / MISSIONS
    { id: "rtx_airlines", ticker: null, name: "Airlines, Lessors & Aircraft Operators", role: "commercial operators use aircraft powered or equipped by RTX products and consume aftermarket parts and services" },
    { id: "rtx_defense", ticker: null, name: "Military Operators & Defense Missions", role: "U.S. and allied forces operate aircraft, missiles, radars and defense systems incorporating RTX technology" },

    // EXPANDED DENSITY — VERIFIED / HIGH-CONFIDENCE COMPANY NODES
    { id: "dco", ticker: "DCO", name: "Ducommun", role: "aerospace structures and electronic-systems supplier that disclosed RTX as its largest 2025 customer at 17.9% of revenue" },
    { id: "wwd", ticker: "WWD", name: "Woodward", role: "aerospace controls and components supplier; RTX was a 10%+ customer of Woodward's Aerospace segment in fiscal 2025" },
    { id: "airi", ticker: "AIRI", name: "Air Industries Group", role: "precision aerospace and defense component supplier with significant sales to RTX businesses including Collins Aerospace and Pratt & Whitney" },
    { id: "ba", ticker: "BA", name: "Boeing", role: "major commercial aircraft manufacturer using Collins Aerospace systems and Pratt & Whitney products across aircraft programs" },
    { id: "erj", ticker: "ERJ", name: "Embraer", role: "aircraft OEM whose E-Jets E2 platform is powered by Pratt & Whitney GTF engines" },
  ],

  edges: [
    // VERIFIED / DISCLOSED SUPPLY, ENABLEMENT OR DISTRIBUTION RELATIONSHIPS
    { source: "rtx_materials", target: "rtx_parts" },
    { source: "rtx_parts", target: "rtx_cm" },
    { source: "rtx_cm", target: "rtx_collins" },
    { source: "rtx_cm", target: "rtx_pratt" },
    { source: "rtx_cm", target: "rtx_raytheon" },
    { source: "rtx_collins", target: "rtx" },
    { source: "rtx_pratt", target: "rtx" },
    { source: "rtx_raytheon", target: "rtx" },
    { source: "rtx", target: "airbus" },
    { source: "rtx", target: "lmt" },
    { source: "rtx", target: "rtx_gov" },
    { source: "airbus", target: "rtx_airlines" },
    { source: "lmt", target: "rtx_defense" },
    { source: "rtx_gov", target: "rtx_defense" },

    // EXPANDED DENSITY — VERIFIED / HIGH-CONFIDENCE RELATIONSHIPS
    { source: "dco", target: "rtx_cm" },
    { source: "wwd", target: "rtx_cm" },
    { source: "airi", target: "rtx_cm" },
    { source: "rtx", target: "ba" },
    { source: "rtx", target: "erj" },
    { source: "ba", target: "rtx_airlines" },
    { source: "erj", target: "rtx_airlines" },

  ]
},

GEV: {
  name: "GE Vernova",
  root: "gev",
  nodes: [
    // UPSTREAM LAYER -4 — INDUSTRIAL RAW MATERIALS
    { id: "gev_materials", ticker: null, name: "Steel, Copper, Electrical Steel, Resins & Specialty Metals", role: "material base for gas turbines, generators, transformers, switchgear, wind turbines, motors and grid equipment" },

    // UPSTREAM LAYER -3 — COMPONENT / SUBSYSTEM SUPPLIERS
    { id: "gev_suppliers", ticker: null, name: "Global Component & Equipment Suppliers", role: "GE Vernova purchases roughly $20 billion of materials and components annually from suppliers across more than 100 countries" },

    // UPSTREAM LAYER -2 — FACTORY / BLADE / MODULE MANUFACTURING
    { id: "gev_factories", ticker: null, name: "GE Vernova Global Manufacturing Network", role: "internal plants manufacture and assemble turbine, generator, transformer, switchgear, converter and related energy equipment" },
    { id: "lmwind", ticker: null, name: "LM Wind Power Blade Manufacturing", role: "GE Vernova's blade business designs, produces and tests wind-turbine blades for onshore and offshore wind platforms" },

    // UPSTREAM LAYER -1 — PRODUCT SYSTEM INTEGRATION
    { id: "gev_power", ticker: null, name: "Power Systems Integration", role: "Gas Power, Steam Power, Hydro and Nuclear businesses integrate generation equipment and services" },
    { id: "gev_wind", ticker: null, name: "Wind Systems Integration", role: "Onshore and Offshore Wind businesses integrate turbines, blades, controls and services" },
    { id: "gev_grid", ticker: null, name: "Electrification / Grid Solutions Integration", role: "Grid Solutions and Power Conversion & Storage integrate transformers, switchgear, substations, synchronous condensers and storage systems" },

    // CENTER
    { id: "gev", ticker: "GEV", name: "GE Vernova", role: "energy-technology company supplying power-generation, wind and electrification equipment and services across the global electricity system" },

    // DOWNSTREAM LAYER +1 — ENERGY CUSTOMERS
    { id: "gev_util", ticker: null, name: "Utilities, Grid Operators & Power Producers", role: "electric utilities, independent power producers and transmission operators purchase generation and grid equipment plus long-term services" },
    { id: "gev_dev", ticker: null, name: "Wind / Power Project Developers & Governments", role: "developers and public-sector customers procure generation projects, turbines, grid upgrades and energy infrastructure" },

    // DOWNSTREAM LAYER +2 — ELECTRICITY DEMAND
    { id: "gev_industry", ticker: null, name: "Industrial, Manufacturing & Data-Center Loads", role: "large electricity users depend on generation and grid capacity enabled by GE Vernova equipment" },
    { id: "gev_consumers", ticker: null, name: "Homes, Businesses & Communities", role: "end electricity consumers receive power through utility generation and transmission infrastructure" },

    // EXPANDED DENSITY — VERIFIED / HIGH-CONFIDENCE COMPANY NODES
    { id: "wwd", ticker: "WWD", name: "Woodward", role: "industrial controls and fuel-system supplier; GE Vernova was a 10%+ customer of Woodward's Industrial segment in fiscal 2025" },
    { id: "duk", ticker: "DUK", name: "Duke Energy", role: "major GE Vernova utility customer with a 2025 arrangement covering up to 11 GE Vernova 7HA gas turbines and associated equipment" },
    { id: "d", ticker: "D", name: "Dominion Energy", role: "utility customer operating GE Vernova gas-turbine technology, including the first commercial LM6000VELOX package" },
    { id: "nee", ticker: "NEE", name: "NextEra Energy", role: "utility customer through Florida Power & Light, which operates GE Vernova heavy-duty gas-turbine technology" },
    { id: "aep", ticker: "AEP", name: "American Electric Power", role: "utility collaborating with GE Vernova nuclear technology; AEP selected BWRX-300 technology for potential deployment in Indiana" },
  ],

  edges: [
    // VERIFIED / DISCLOSED SUPPLY, ENABLEMENT OR DISTRIBUTION RELATIONSHIPS
    { source: "gev_materials", target: "gev_suppliers" },
    { source: "gev_suppliers", target: "gev_factories" },
    { source: "gev_suppliers", target: "lmwind" },
    { source: "gev_factories", target: "gev_power" },
    { source: "gev_factories", target: "gev_grid" },
    { source: "lmwind", target: "gev_wind" },
    { source: "gev_power", target: "gev" },
    { source: "gev_wind", target: "gev" },
    { source: "gev_grid", target: "gev" },
    { source: "gev", target: "gev_util" },
    { source: "gev", target: "gev_dev" },
    { source: "gev_util", target: "gev_industry" },
    { source: "gev_util", target: "gev_consumers" },
    { source: "gev_dev", target: "gev_industry" },

    // EXPANDED DENSITY — VERIFIED / HIGH-CONFIDENCE RELATIONSHIPS
    { source: "wwd", target: "gev_suppliers" },
    { source: "gev", target: "duk" },
    { source: "gev", target: "d" },
    { source: "gev", target: "nee" },
    { source: "gev", target: "aep" },
    { source: "duk", target: "gev_consumers" },
    { source: "d", target: "gev_consumers" },
    { source: "nee", target: "gev_consumers" },
    { source: "aep", target: "gev_consumers" },

  ]
},

TXN: {
  name: "Texas Instruments",
  root: "txn",
  nodes: [
    // UPSTREAM LAYER -4 — WAFER / PROCESS MATERIALS
    { id: "txn_materials", ticker: null, name: "Silicon Wafers, Chemicals, Gases & Packaging Materials", role: "global suppliers provide silicon wafers, process chemicals, gases, metals, leadframes, substrates and packaging inputs used in semiconductor production" },

    // UPSTREAM LAYER -3 — WAFER FABRICATION
    { id: "txn_fabs", ticker: null, name: "TI 300mm / 200mm Internal Wafer Fabs", role: "Texas Instruments performs the majority of wafer fabrication internally across its North American, Asian, Japanese and European manufacturing network" },
    { id: "txn_foundry", ticker: null, name: "Selective External Foundry Capacity", role: "outside foundries supplement internal capacity for selected technologies and production needs; TI does not identify a material named foundry in the 2025 10-K" },

    // UPSTREAM LAYER -2 — ASSEMBLY / TEST
    { id: "txn_at", ticker: null, name: "TI Internal Assembly & Test", role: "TI performs the majority of assembly and test internally" },
    { id: "txn_sub", ticker: null, name: "External Assembly / Test Subcontractors", role: "selected subcontractors supplement TI's internal assembly and test capacity" },

    // UPSTREAM LAYER -1 — INVENTORY / ORDER FULFILLMENT
    { id: "txn_fulfill", ticker: null, name: "TI Direct Fulfillment, TI.com & Distribution Inventory", role: "finished analog and embedded chips move through TI's direct fulfillment systems, inventory programs and limited distributor network" },

    // CENTER
    { id: "txn", ticker: "TXN", name: "Texas Instruments", role: "designs and manufactures analog and embedded-processing semiconductors with a highly internalized manufacturing model" },

    // DOWNSTREAM LAYER +1 — CUSTOMER DESIGN-INS
    { id: "txn_industrial", ticker: null, name: "Industrial & Data-Center Equipment Makers", role: "industrial automation, power, factory and data-center manufacturers design TI analog and embedded chips into systems" },
    { id: "txn_auto", ticker: null, name: "Automotive OEMs & Tier Suppliers", role: "vehicle manufacturers and automotive suppliers use TI power, signal-chain, sensing and embedded products" },

    // DOWNSTREAM LAYER +2 — END SYSTEMS
    { id: "txn_systems", ticker: null, name: "Vehicles, Factories, Electronics & Infrastructure", role: "end products convert TI semiconductor content into power management, sensing, control, connectivity and embedded processing functions" },

    // EXPANDED DENSITY — VERIFIED / HIGH-CONFIDENCE COMPANY NODES
    { id: "arw", ticker: "ARW", name: "Arrow Electronics", role: "TI-authorized distributor in all regions except Japan" },
    { id: "digikey", ticker: null, name: "Digi-Key Electronics", role: "TI-authorized global catalog and e-commerce distributor" },
    { id: "mouser", ticker: null, name: "Mouser Electronics", role: "TI-authorized global catalog distributor for semiconductor products" },
    { id: "macnica", ticker: null, name: "Macnica", role: "TI-authorized distribution partner, including the Japanese market" },
  ],

  edges: [
    // VERIFIED / DISCLOSED SUPPLY, ENABLEMENT OR DISTRIBUTION RELATIONSHIPS
    { source: "txn_materials", target: "txn_fabs" },
    { source: "txn_materials", target: "txn_foundry" },
    { source: "txn_fabs", target: "txn_at" },
    { source: "txn_fabs", target: "txn_sub" },
    { source: "txn_foundry", target: "txn_sub" },
    { source: "txn_at", target: "txn_fulfill" },
    { source: "txn_sub", target: "txn_fulfill" },
    { source: "txn_fulfill", target: "txn" },
    { source: "txn", target: "txn_industrial" },
    { source: "txn", target: "txn_auto" },
    { source: "txn_industrial", target: "txn_systems" },
    { source: "txn_auto", target: "txn_systems" },

    // EXPANDED DENSITY — VERIFIED / HIGH-CONFIDENCE RELATIONSHIPS
    { source: "txn", target: "arw" },
    { source: "txn", target: "digikey" },
    { source: "txn", target: "mouser" },
    { source: "txn", target: "macnica" },
    { source: "arw", target: "txn_systems" },
    { source: "digikey", target: "txn_systems" },
    { source: "mouser", target: "txn_systems" },
    { source: "macnica", target: "txn_systems" },

  ]
},

WFC: {
  name: "Wells Fargo",
  root: "wfc",
  nodes: [
    // UPSTREAM LAYER -4 — FINANCIAL / TELECOM INFRASTRUCTURE
    { id: "wfc_base", ticker: null, name: "Internet, Telecom, Market & Payment Infrastructure", role: "external connectivity, exchanges, payment rails and market infrastructure support banking, brokerage, card and treasury activity" },

    // UPSTREAM LAYER -3 — THIRD-PARTY TECHNOLOGY / TRANSACTION PROVIDERS
    { id: "wfc_tech", ticker: null, name: "Hardware, Software, Cloud & Cybersecurity Providers", role: "Wells Fargo relies on third parties and their downstream providers for internet, mobile, hardware, software, cloud and information-security services" },

    // UPSTREAM LAYER -2 — THIRD-PARTY SERVICE INTEGRATION
    { id: "wfc_pay", ticker: null, name: "Payment, Clearing & Settlement Providers", role: "third-party payment, clearing and settlement services facilitate cards, deposits, securities and money movement across Wells Fargo businesses" },
    { id: "wfc_integration", ticker: null, name: "Vendor Connectivity, Data Exchange & Service Integration", role: "integration layers connect external technology, payment and market-service providers into Wells Fargo transaction-processing and risk environments" },

    // UPSTREAM LAYER -1 — WELLS FARGO OPERATING PLATFORMS
    { id: "wfc_ops", ticker: null, name: "Core Banking, Digital, Risk & Operations Platforms", role: "internal systems integrate customer accounts, transaction processing, lending, brokerage, fraud, compliance and risk management" },

    // CENTER
    { id: "wfc", ticker: "WFC", name: "Wells Fargo", role: "U.S. financial-services company providing consumer banking, commercial banking, corporate and investment banking and wealth-management services" },

    // DOWNSTREAM LAYER +1 — FINANCIAL PRODUCTS / CHANNELS
    { id: "wfc_consumer", ticker: null, name: "Consumer Banking & Lending", role: "deposit, card, mortgage, auto and personal banking products distributed through branches and digital channels" },
    { id: "wfc_cib", ticker: null, name: "Commercial / Corporate / Investment Banking", role: "credit, treasury, markets, investment-banking and institutional services for business and institutional clients" },
    { id: "wfc_wealth", ticker: null, name: "Wealth & Investment Management", role: "brokerage, advisory and wealth services delivered to individuals and institutions" },

    // DOWNSTREAM LAYER +2 — CLIENT ECONOMY
    { id: "wfc_households", ticker: null, name: "Households & Individual Investors", role: "end customers using banking, credit, mortgage, brokerage and wealth services" },
    { id: "wfc_business", ticker: null, name: "Businesses, Governments & Institutions", role: "commercial and institutional clients using lending, payments, treasury, capital-markets and advisory services" },

    // EXPANDED DENSITY — VERIFIED / HIGH-CONFIDENCE COMPANY NODES
    { id: "googl", ticker: "GOOGL", name: "Google Cloud", role: "strategic cloud provider to Wells Fargo under an expanded enterprise relationship covering data, AI and cloud modernization" },
    { id: "msft", ticker: "MSFT", name: "Microsoft", role: "enterprise technology and Azure cloud provider used in Wells Fargo's public-cloud and Microsoft 365 modernization" },
    { id: "v", ticker: "V", name: "Visa", role: "major card-network and payment-rail provider supporting Wells Fargo consumer and merchant payment activity" },
    { id: "ma", ticker: "MA", name: "Mastercard", role: "major card-network partner supporting Wells Fargo payments, including current co-brand and card-network programs" },
    { id: "axp", ticker: "AXP", name: "American Express", role: "payment-network infrastructure accepted through Wells Fargo merchant-services processing" },
  ],

  edges: [
    // VERIFIED / DISCLOSED SUPPLY, ENABLEMENT OR DISTRIBUTION RELATIONSHIPS
    { source: "wfc_base", target: "wfc_tech" },
    { source: "wfc_base", target: "wfc_pay" },
    { source: "wfc_tech", target: "wfc_integration" },
    { source: "wfc_pay", target: "wfc_integration" },
    { source: "wfc_integration", target: "wfc_ops" },
    { source: "wfc_ops", target: "wfc" },
    { source: "wfc", target: "wfc_consumer" },
    { source: "wfc", target: "wfc_cib" },
    { source: "wfc", target: "wfc_wealth" },
    { source: "wfc_consumer", target: "wfc_households" },
    { source: "wfc_wealth", target: "wfc_households" },
    { source: "wfc_cib", target: "wfc_business" },

    // EXPANDED DENSITY — VERIFIED / HIGH-CONFIDENCE RELATIONSHIPS
    { source: "googl", target: "wfc_integration" },
    { source: "msft", target: "wfc_integration" },
    { source: "v", target: "wfc_integration" },
    { source: "ma", target: "wfc_integration" },
    { source: "axp", target: "wfc_integration" },

  ]
},

TMO: {
  name: "Thermo Fisher Scientific",
  root: "tmo",
  nodes: [
    // UPSTREAM LAYER -4 — SCIENTIFIC RAW MATERIALS
    { id: "tmo_raw", ticker: null, name: "Chemicals, Biological Inputs, Plastics, Metals & Precision Components", role: "raw and specialty materials used in reagents, consumables, instruments, single-use bioprocessing systems and laboratory products" },

    // UPSTREAM LAYER -3 — COMPONENT / SPECIALTY SUPPLY
    { id: "tmo_components", ticker: null, name: "Instrument Components & Limited-Source Specialty Suppliers", role: "certain regulated or unique components and materials may come from a single or limited number of qualified suppliers" },

    // UPSTREAM LAYER -2 — MANUFACTURING / THIRD-PARTY PRODUCT / PHARMA SERVICES
    { id: "tmo_thirdparty", ticker: null, name: "Third-Party Branded & Private-Label Manufacturers", role: "Fisher Scientific channels products made by Thermo Fisher, third parties for private label and third parties under their own brands" },
    { id: "tmo_mfg", ticker: null, name: "Thermo Fisher Manufacturing Network", role: "internal operations manufacture instruments, reagents, consumables, diagnostics and laboratory equipment" },
    { id: "patheon", ticker: null, name: "Patheon Pharmaceutical Services", role: "Thermo Fisher's pharma-services operations provide development and commercial manufacturing for small- and large-molecule medicines" },

    // UPSTREAM LAYER -1 — GLOBAL COMMERCIAL / SERVICE PLATFORM
    { id: "fisher", ticker: null, name: "Fisher Scientific / E-Commerce / Direct Sales", role: "global direct sales, e-commerce, customer-service and distribution capabilities provide purchasing convenience and supply-chain services" },
    { id: "unity", ticker: null, name: "Unity Lab Services", role: "service organization supports installed scientific instruments, laboratory equipment and customer operations" },
    { id: "tmo_delivery", ticker: null, name: "Thermo Fisher Pharma-Services Delivery Platform", role: "commercial project, quality and supply-chain operations deliver Patheon development and manufacturing programs to pharmaceutical customers" },

    // CENTER
    { id: "tmo", ticker: "TMO", name: "Thermo Fisher Scientific", role: "life-sciences tools, analytical instruments, laboratory products, diagnostics, bioproduction and pharmaceutical-services company" },

    // DOWNSTREAM LAYER +1 — SCIENCE / HEALTHCARE CUSTOMERS
    { id: "tmo_pharma", ticker: null, name: "Pharma & Biotechnology Companies", role: "drug developers use Thermo Fisher research tools, bioproduction products, clinical research and Patheon manufacturing services" },
    { id: "tmo_labs", ticker: null, name: "Hospitals, Clinical Labs, Universities & Government Labs", role: "clinical, academic and government laboratories purchase instruments, reagents, consumables and services" },

    // DOWNSTREAM LAYER +2 — SCIENTIFIC OUTPUT
    { id: "tmo_drugs", ticker: null, name: "Drug Discovery, Clinical Trials & Biologic Production", role: "customers use Thermo Fisher workflows to discover, test and manufacture medicines and vaccines" },
    { id: "tmo_diag", ticker: null, name: "Research, Diagnostics & Industrial Testing", role: "end workflows include genomic research, disease diagnosis, environmental analysis, quality control and materials characterization" },

    // EXPANDED DENSITY — VERIFIED / HIGH-CONFIDENCE COMPANY NODES
    { id: "mrna", ticker: "MRNA", name: "Moderna", role: "long-term Thermo Fisher strategic customer and partner for clinical research and dedicated U.S. mRNA fill-finish manufacturing" },
    { id: "sny", ticker: "SNY", name: "Sanofi", role: "strategic biopharma customer; Thermo Fisher acquired Sanofi's Ridgefield sterile fill-finish site and continues manufacturing Sanofi therapies there" },
    { id: "azn", ticker: "AZN", name: "AstraZeneca", role: "clinical sequencing partner working with Thermo Fisher on NGS-based companion diagnostics for targeted therapies" },
    { id: "amgn", ticker: "AMGN", name: "Amgen", role: "biopharma customer collaborating with Thermo Fisher across analytical instrumentation, informatics and biologics research workflows" },
  ],

  edges: [
    // VERIFIED / DISCLOSED SUPPLY, ENABLEMENT OR DISTRIBUTION RELATIONSHIPS
    { source: "tmo_raw", target: "tmo_components" },
    { source: "tmo_components", target: "tmo_mfg" },
    { source: "tmo_thirdparty", target: "fisher" },
    { source: "tmo_mfg", target: "fisher" },
    { source: "tmo_mfg", target: "unity" },
    { source: "patheon", target: "tmo_delivery" },
    { source: "tmo_delivery", target: "tmo" },
    { source: "fisher", target: "tmo" },
    { source: "unity", target: "tmo" },
    { source: "tmo", target: "tmo_pharma" },
    { source: "tmo", target: "tmo_labs" },
    { source: "tmo_pharma", target: "tmo_drugs" },
    { source: "tmo_labs", target: "tmo_diag" },

    // EXPANDED DENSITY — VERIFIED / HIGH-CONFIDENCE RELATIONSHIPS
    { source: "tmo", target: "mrna" },
    { source: "tmo", target: "sny" },
    { source: "tmo", target: "azn" },
    { source: "tmo", target: "amgn" },
    { source: "mrna", target: "tmo_drugs" },
    { source: "sny", target: "tmo_drugs" },
    { source: "azn", target: "tmo_diag" },
    { source: "amgn", target: "tmo_drugs" },

  ]
},

KLAC: {
  name: "KLA",
  root: "klac",
  nodes: [
    // UPSTREAM LAYER -4 — PRECISION MATERIALS / ELECTRONICS
    { id: "klac_inputs", ticker: null, name: "Precision Optics, Lasers, Electronics & Mechanical Components", role: "specialized optical, laser, detector, computing, motion-control and precision-mechanical inputs used in semiconductor process-control equipment" },

    // UPSTREAM LAYER -3 — SPECIALIZED SUBASSEMBLIES
    { id: "klac_sub", ticker: null, name: "Qualified Subassembly & Component Suppliers", role: "KLA combines internally developed technology with externally sourced precision subsystems and components to build inspection, metrology and process-control tools" },

    // UPSTREAM LAYER -2 — SYSTEM MANUFACTURING / INTEGRATION
    { id: "klac_mfg", ticker: null, name: "KLA Manufacturing & System Integration", role: "KLA assembles, integrates and calibrates complex optical, electron-beam, metrology, inspection and process-control systems" },

    // UPSTREAM LAYER -1 — INSTALLATION / SERVICE READINESS
    { id: "klac_service", ticker: null, name: "Field Installation, Applications & Service Organization", role: "global field teams install systems, qualify applications and support high-uptime process-control tools at customer fabs" },

    // CENTER
    { id: "klac", ticker: "KLAC", name: "KLA", role: "semiconductor process-control company providing inspection, metrology, yield-management and process-enabling systems for wafers, reticles, packaging, substrates and PCBs" },

    // DOWNSTREAM LAYER +1 — SEMICONDUCTOR CUSTOMERS
    { id: "tsm", ticker: "TSM", name: "TSMC", role: "KLA's only customer above 10% of total revenue in fiscal 2026; uses process-control tools across leading-edge wafer manufacturing" },
    { id: "klac_memory", ticker: null, name: "Memory, Foundry / Logic & Advanced-Packaging Manufacturers", role: "semiconductor manufacturers deploy KLA tools to control yield and process complexity in logic, DRAM, NAND and advanced packaging" },

    // DOWNSTREAM LAYER +2 — CHIP / ELECTRONICS OUTPUT
    { id: "klac_chips", ticker: null, name: "AI, Compute, Mobile, Automotive & Memory Chips", role: "yield-control improvements enable high-volume production of advanced semiconductor devices" },
    { id: "klac_boards", ticker: null, name: "IC Packages, Substrates & Printed Circuit Boards", role: "KLA process-control products also support packaging, substrate and PCB manufacturing" }
  ],

  edges: [
    // VERIFIED / DISCLOSED SUPPLY, ENABLEMENT OR DISTRIBUTION RELATIONSHIPS
    { source: "klac_inputs", target: "klac_sub" },
    { source: "klac_sub", target: "klac_mfg" },
    { source: "klac_mfg", target: "klac_service" },
    { source: "klac_service", target: "klac" },
    { source: "klac", target: "tsm" },
    { source: "klac", target: "klac_memory" },
    { source: "tsm", target: "klac_chips" },
    { source: "klac_memory", target: "klac_chips" },
    { source: "klac_memory", target: "klac_boards" }
  ]
},

MRVL: {
  name: "Marvell Technology",
  root: "mrvl",
  nodes: [
    // UPSTREAM LAYER -4 — SEMICONDUCTOR FAB INPUTS
    { id: "mrvl_inputs", ticker: null, name: "Semiconductor Equipment, Wafers, Masks & Process Materials", role: "manufacturing inputs used by external foundries and packaging partners that fabricate Marvell-designed silicon" },

    // UPSTREAM LAYER -3 — WAFER FOUNDRY
    { id: "tsm", ticker: "TSM", name: "TSMC", role: "Marvell's sole-source foundry for all advanced process-node wafers as of its August 2026 quarterly filing" },

    // UPSTREAM LAYER -2 — ASSEMBLY / TEST / ADVANCED PACKAGING
    { id: "mrvl_osat", ticker: null, name: "Third-Party Assembly, Test & Packaging Partners", role: "external subcontractors in Malaysia, Singapore, Taiwan and Canada package and test Marvell semiconductor products" },

    // UPSTREAM LAYER -1 — PRODUCT / FIRMWARE INTEGRATION
    { id: "mrvl_product", ticker: null, name: "Marvell Silicon, Firmware & Reference-System Integration", role: "Marvell combines custom and merchant silicon with firmware, security and system-level design into data-infrastructure products" },

    // CENTER
    { id: "mrvl", ticker: "MRVL", name: "Marvell Technology", role: "fabless semiconductor supplier focused on data-center, custom compute, networking, carrier and storage infrastructure" },

    // DOWNSTREAM LAYER +1 — INFRASTRUCTURE CUSTOMERS
    { id: "mrvl_cloud", ticker: null, name: "Cloud / AI Data-Center Customers", role: "hyperscale and AI infrastructure customers deploy custom compute, interconnect, switching, electro-optics and storage silicon" },
    { id: "mrvl_comm", ticker: null, name: "Carrier, Enterprise & Storage OEM Customers", role: "communications and infrastructure OEMs integrate Marvell networking, storage and connectivity silicon into systems" },

    // DOWNSTREAM LAYER +2 — DIGITAL INFRASTRUCTURE
    { id: "mrvl_ai", ticker: null, name: "AI Clusters & Cloud Services", role: "custom accelerators, interconnect and networking silicon support scale-up and scale-out AI infrastructure" },
    { id: "mrvl_networks", ticker: null, name: "Telecom, Enterprise Networks & Storage Systems", role: "Marvell products move, store and process data across carrier, enterprise and storage infrastructure" },

    // EXPANDED DENSITY — VERIFIED / HIGH-CONFIDENCE COMPANY NODES
    { id: "amzn", ticker: "AMZN", name: "Amazon Web Services", role: "strategic Marvell customer under a five-year multi-generational agreement covering custom AI silicon, optical DSPs, retimers and switching products" },
    { id: "googl", ticker: "GOOGL", name: "Google", role: "commercial custom-silicon customer under Marvell's 2026 agreement to develop and supply data-center semiconductor products" },
    { id: "meta", ticker: "META", name: "Meta Platforms", role: "custom data-center silicon collaborator using Marvell technology in Meta infrastructure programs" },
    { id: "nok", ticker: "NOK", name: "Nokia", role: "strategic telecom customer and collaborator using Marvell silicon in 5G and next-generation network infrastructure" },
  ],

  edges: [
    // VERIFIED / DISCLOSED SUPPLY, ENABLEMENT OR DISTRIBUTION RELATIONSHIPS
    { source: "mrvl_inputs", target: "tsm" },
    { source: "tsm", target: "mrvl_osat" },
    { source: "mrvl_osat", target: "mrvl_product" },
    { source: "mrvl_product", target: "mrvl" },
    { source: "mrvl", target: "mrvl_cloud" },
    { source: "mrvl", target: "mrvl_comm" },
    { source: "mrvl_cloud", target: "mrvl_ai" },
    { source: "mrvl_comm", target: "mrvl_networks" },

    // EXPANDED DENSITY — VERIFIED / HIGH-CONFIDENCE RELATIONSHIPS
    { source: "mrvl", target: "amzn" },
    { source: "mrvl", target: "googl" },
    { source: "mrvl", target: "meta" },
    { source: "mrvl", target: "nok" },
    { source: "amzn", target: "mrvl_ai" },
    { source: "googl", target: "mrvl_ai" },
    { source: "meta", target: "mrvl_ai" },
    { source: "nok", target: "mrvl_networks" },

  ]
},

C: {
  name: "Citigroup",
  root: "c",
  nodes: [
    // UPSTREAM LAYER -4 — GLOBAL FINANCIAL-MARKET INPUTS
    { id: "c_markets", ticker: null, name: "Exchanges, Payment Rails, Correspondent Banks & Market Venues", role: "global market and payment infrastructure supplies liquidity, transaction connectivity and money-movement pathways across Citi's network" },

    // UPSTREAM LAYER -3 — CLEARING / CUSTODY / SETTLEMENT
    { id: "c_infra", ticker: null, name: "Clearing, Settlement, Custody & Securities Infrastructure", role: "third-party market utilities and correspondent networks support securities settlement, cash management, custody and cross-border financial flows" },

    // UPSTREAM LAYER -2 — TECHNOLOGY / DATA / CYBERSECURITY
    { id: "c_tech", ticker: null, name: "Cloud, Data, Software, Hardware & Security Providers", role: "external technology providers support Citi's global transaction, markets, banking, risk and digital infrastructure" },

    // UPSTREAM LAYER -1 — CITI GLOBAL OPERATING PLATFORM
    { id: "c_ops", ticker: null, name: "Citi Payments, Liquidity, Markets & Core Banking Platforms", role: "internal systems integrate 24/7 clearing, instant payments, tokenized services, markets execution, lending and customer information" },

    // CENTER
    { id: "c", ticker: "C", name: "Citigroup", role: "global bank operating Services, Markets, Banking, Wealth and U.S. Personal Banking businesses" },

    // DOWNSTREAM LAYER +1 — BUSINESS LINES
    { id: "c_services", ticker: null, name: "Services — Treasury & Trade Solutions / Securities Services", role: "multinational and investor clients use cross-border payments, liquidity, trade, custody and securities services" },
    { id: "c_markets_clients", ticker: null, name: "Markets & Banking Clients", role: "corporations, financial institutions, governments and investors use trading, underwriting, lending and advisory services" },
    { id: "c_consumer", ticker: null, name: "Wealth & U.S. Personal Banking", role: "individuals use cards, retail banking, lending, investment and wealth-management products" },

    // DOWNSTREAM LAYER +2 — END CLIENTS / FLOWS
    { id: "c_corp", ticker: null, name: "Multinational Corporations & Financial Institutions", role: "global clients route payments, financing, capital-markets and custody activity through Citi" },
    { id: "c_people", ticker: null, name: "Consumers & Wealth Clients", role: "individual customers receive card, banking, lending and investment services" },

    // EXPANDED DENSITY — VERIFIED / HIGH-CONFIDENCE COMPANY NODES
    { id: "ice", ticker: "ICE", name: "Intercontinental Exchange", role: "exchange, clearing, fixed-income and market-data infrastructure used by Citi's institutional markets businesses" },
    { id: "cme", ticker: "CME", name: "CME Group", role: "futures and derivatives exchange and clearing infrastructure used by global markets participants including Citi" },
    { id: "v", ticker: "V", name: "Visa", role: "global card-network and payment-rail infrastructure supporting Citi card and transaction flows" },
    { id: "ma", ticker: "MA", name: "Mastercard", role: "global card-network infrastructure supporting Citi consumer-card and payment products" },
    { id: "googl", ticker: "GOOGL", name: "Google Cloud", role: "major Citi technology partner supporting cloud modernization, data and AI initiatives" },
    { id: "pltr", ticker: "PLTR", name: "Palantir", role: "major Citi Wealth technology partner supporting data, analytics and AI-enabled client experiences" },
  ],

  edges: [
    // VERIFIED / DISCLOSED SUPPLY, ENABLEMENT OR DISTRIBUTION RELATIONSHIPS
    { source: "c_markets", target: "c_infra" },
    { source: "c_infra", target: "c_tech" },
    { source: "c_tech", target: "c_ops" },
    { source: "c_ops", target: "c" },
    { source: "c", target: "c_services" },
    { source: "c", target: "c_markets_clients" },
    { source: "c", target: "c_consumer" },
    { source: "c_services", target: "c_corp" },
    { source: "c_markets_clients", target: "c_corp" },
    { source: "c_consumer", target: "c_people" },

    // EXPANDED DENSITY — VERIFIED / HIGH-CONFIDENCE RELATIONSHIPS
    { source: "ice", target: "c_infra" },
    { source: "cme", target: "c_infra" },
    { source: "v", target: "c_infra" },
    { source: "ma", target: "c_infra" },
    { source: "googl", target: "c_ops" },
    { source: "pltr", target: "c_ops" },

  ]
},

AMGN: {
  name: "Amgen",
  root: "amgn",
  nodes: [
    // UPSTREAM LAYER -4 — BIOPHARMA RAW MATERIALS
    { id: "amgn_raw", ticker: null, name: "Biologic Media, Chemicals, Excipients & Device Components", role: "raw materials, proprietary components, medical-device parts and companion-diagnostic inputs used in drug manufacturing; some are single-source" },

    // UPSTREAM LAYER -3 — BULK DRUG-SUBSTANCE MANUFACTURING
    { id: "amgn_bulk", ticker: null, name: "Amgen Bulk Manufacturing Network", role: "internal U.S. and international facilities produce biologic and small-molecule bulk drug substance" },
    { id: "amgn_cmo", ticker: null, name: "Third-Party Contract Manufacturers", role: "external manufacturers supplement Amgen's commercial and clinical production capacity where additional capability or redundancy is required" },

    // UPSTREAM LAYER -2 — FORMULATION / FILL-FINISH / TABLETING
    { id: "amgn_finish", ticker: null, name: "Formulation, Fill-Finish & Tableting Operations", role: "internal and contracted operations convert bulk drug substance into finished injectable and oral dosage forms" },

    // UPSTREAM LAYER -1 — DEVICE ASSEMBLY / QUALITY RELEASE
    { id: "amgn_device", ticker: null, name: "Final Device Assembly, Packaging & Quality Release", role: "autoinjectors, delivery devices and packaged medicines undergo final assembly, testing, regulated quality control and release" },

    // CENTER
    { id: "amgn", ticker: "AMGN", name: "Amgen", role: "biotechnology company developing and commercializing human therapeutics across inflammation, oncology, cardiovascular, bone health and rare disease" },

    // DOWNSTREAM LAYER +1 — DISTRIBUTION / CARE CHANNEL
    { id: "amgn_dc", ticker: null, name: "Amgen Distribution Centers & Third-Party Distributors", role: "distribution centers in Puerto Rico, Kentucky, California and the Netherlands plus external distributors move commercial products worldwide" },
    { id: "amgn_care", ticker: null, name: "Wholesalers, Specialty Pharmacies & Healthcare Providers", role: "channel partners and care settings dispense or administer Amgen medicines to patients" },

    // DOWNSTREAM LAYER +2 — PATIENT / PAYER OUTCOME
    { id: "amgn_patients", ticker: null, name: "Patients", role: "end users receive Amgen therapies through pharmacies, hospitals, physician offices and specialty-care settings" },
    { id: "amgn_payers", ticker: null, name: "Government & Commercial Payers", role: "coverage and reimbursement from public programs and private insurance strongly influence patient access and product demand" },

    // EXPANDED DENSITY — VERIFIED / HIGH-CONFIDENCE COMPANY NODES
    { id: "mck", ticker: "MCK", name: "McKesson", role: "one of Amgen's three dominant U.S. pharmaceutical wholesalers; each of McKesson, Cencora and Cardinal Health represented more than 10% of 2025 revenue" },
    { id: "cor", ticker: "COR", name: "Cencora", role: "major Amgen U.S. wholesaler distributing medicines into provider, specialty-pharmacy and healthcare channels" },
    { id: "cah", ticker: "CAH", name: "Cardinal Health", role: "major Amgen U.S. pharmaceutical wholesaler and distribution counterparty" },
  ],

  edges: [
    // VERIFIED / DISCLOSED SUPPLY, ENABLEMENT OR DISTRIBUTION RELATIONSHIPS
    { source: "amgn_raw", target: "amgn_bulk" },
    { source: "amgn_raw", target: "amgn_cmo" },
    { source: "amgn_bulk", target: "amgn_finish" },
    { source: "amgn_cmo", target: "amgn_finish" },
    { source: "amgn_finish", target: "amgn_device" },
    { source: "amgn_device", target: "amgn" },
    { source: "amgn", target: "amgn_dc" },
    { source: "amgn_dc", target: "amgn_care" },
    { source: "amgn", target: "amgn_payers" },
    { source: "amgn_payers", target: "amgn_patients" },

    // EXPANDED DENSITY — VERIFIED / HIGH-CONFIDENCE RELATIONSHIPS
    { source: "amgn", target: "mck" },
    { source: "amgn", target: "cor" },
    { source: "amgn", target: "cah" },
    { source: "mck", target: "amgn_patients" },
    { source: "cor", target: "amgn_patients" },
    { source: "cah", target: "amgn_patients" },

  ]
},

QCOM: {
  name: "Qualcomm",
  root: "qcom",
  nodes: [
    // UPSTREAM LAYER -4 — FOUNDRY RAW MATERIAL / EQUIPMENT BASE
    { id: "qcom_inputs", ticker: null, name: "Silicon Wafers, Process Chemicals, Masks & Fab Equipment", role: "raw materials and semiconductor manufacturing infrastructure procured primarily by Qualcomm's external foundry partners" },

    // UPSTREAM LAYER -3 — WAFER FOUNDRIES
    { id: "tsm", ticker: "TSM", name: "TSMC", role: "primary Qualcomm foundry supplier across digital, analog/mixed-signal, RF and power-management integrated circuits" },
    { id: "samsung", ticker: null, name: "Samsung Foundry", role: "primary Qualcomm foundry supplier for selected advanced and specialty semiconductor products" },
    { id: "gf", ticker: "GFS", name: "GlobalFoundries", role: "primary foundry supplier for selected analog, RF and power-management integrated circuits" },

    // UPSTREAM LAYER -2 — ASSEMBLY / TEST
    { id: "ase", ticker: "ASX", name: "ASE Technology", role: "primary semiconductor assembly and test supplier used by Qualcomm under its two-stage manufacturing model" },
    { id: "amkr", ticker: "AMKR", name: "Amkor Technology", role: "primary semiconductor assembly and test supplier for Qualcomm integrated circuits" },
    { id: "qcom_osat", ticker: null, name: "Other Qualified OSAT Partners", role: "Siliconware Precision Industries and STATSChipPAC are also identified by Qualcomm as primary assembly/test suppliers" },

    // UPSTREAM LAYER -1 — QCT / RF FRONT-END PRODUCT INTEGRATION
    { id: "qct", ticker: null, name: "Snapdragon, Modem, Connectivity & RFFE Product Integration", role: "Qualcomm combines fabricated die, packaging, firmware and internally manufactured RF front-end components into platforms shipped to device makers" },

    // CENTER
    { id: "qcom", ticker: "QCOM", name: "Qualcomm", role: "wireless and edge-computing semiconductor and licensing company centered on Snapdragon platforms, modems, connectivity, RF front-end, automotive and IoT" },

    // DOWNSTREAM LAYER +1 — DEVICE / SYSTEM MAKERS
    { id: "aapl", ticker: "AAPL", name: "Apple", role: "uses Qualcomm modem and RF products in certain devices, although Qualcomm expects Apple to increase use of internally designed modems over time" },
    { id: "qcom_oem", ticker: null, name: "Android Handset, Automotive & IoT OEMs", role: "device and system manufacturers integrate Snapdragon, Dragonwing, modem, connectivity and RF products into commercial products" },

    // DOWNSTREAM LAYER +2 — CONNECTED END SYSTEMS
    { id: "qcom_devices", ticker: null, name: "Smartphones, PCs, Vehicles & Edge Devices", role: "Qualcomm silicon provides compute, cellular, Wi-Fi, Bluetooth, positioning, AI and RF functions in connected devices" },

    // EXPANDED DENSITY — VERIFIED / HIGH-CONFIDENCE COMPANY NODES
    { id: "dell", ticker: "DELL", name: "Dell Technologies", role: "Snapdragon X-series PC OEM partner shipping Qualcomm-powered AI PCs and 2026 Googlebook designs" },
    { id: "hpq", ticker: "HPQ", name: "HP Inc.", role: "Snapdragon X-series PC OEM partner shipping Qualcomm-powered Copilot+ PCs and 2026 Googlebook designs" },
    { id: "samsung_oem", ticker: null, name: "Samsung Electronics", role: "long-standing Qualcomm device customer; Snapdragon platforms power current Galaxy smartphones, watches and intelligent-eyewear products" },
  ],

  edges: [
    // VERIFIED / DISCLOSED SUPPLY, ENABLEMENT OR DISTRIBUTION RELATIONSHIPS
    { source: "qcom_inputs", target: "tsm" },
    { source: "qcom_inputs", target: "samsung" },
    { source: "qcom_inputs", target: "gf" },
    { source: "tsm", target: "ase" },
    { source: "tsm", target: "amkr" },
    { source: "samsung", target: "qcom_osat" },
    { source: "gf", target: "qcom_osat" },
    { source: "ase", target: "qct" },
    { source: "amkr", target: "qct" },
    { source: "qcom_osat", target: "qct" },
    { source: "qct", target: "qcom" },
    { source: "qcom", target: "aapl" },
    { source: "qcom", target: "qcom_oem" },
    { source: "aapl", target: "qcom_devices" },
    { source: "qcom_oem", target: "qcom_devices" },

    // EXPANDED DENSITY — VERIFIED / HIGH-CONFIDENCE RELATIONSHIPS
    { source: "qcom", target: "dell" },
    { source: "qcom", target: "hpq" },
    { source: "qcom", target: "samsung_oem" },
    { source: "dell", target: "qcom_devices" },
    { source: "hpq", target: "qcom_devices" },
    { source: "samsung_oem", target: "qcom_devices" },

  ]
},

IBM: {
  name: "IBM",
  root: "ibm",
  nodes: [
    // UPSTREAM LAYER -4 — COMPONENT / RAW-MATERIAL BASE
    { id: "ibm_inputs", ticker: null, name: "Processors, Memory, Storage Components, Networking & Raw Materials", role: "IBM purchases a wide variety of hardware components, supplies, services and raw materials from a global supplier base" },

    // UPSTREAM LAYER -3 — LIMITED-SOURCE PROCESSOR / TECHNOLOGY SUPPLIERS
    { id: "ibm_critical", ticker: null, name: "Critical Server Processor & Hardware Technology Suppliers", role: "IBM states that certain businesses depend on a single or limited number of suppliers, including server-processor technology for certain semiconductors" },

    // UPSTREAM LAYER -2 — SYSTEM / INFRASTRUCTURE INTEGRATION
    { id: "ibm_infra", ticker: null, name: "IBM Server, Storage & Hybrid-Cloud Infrastructure Operations", role: "IBM integrates processors, memory, storage, networking, firmware and systems software into Power, Z, storage and hybrid-cloud infrastructure offerings" },

    // UPSTREAM LAYER -1 — STRATEGIC SOFTWARE / CLOUD ECOSYSTEM
    { id: "aws", ticker: "AMZN", name: "Amazon Web Services", role: "IBM identifies AWS as a strategic partner used in end-to-end hybrid-cloud and enterprise solutions" },
    { id: "msft", ticker: "MSFT", name: "Microsoft", role: "IBM strategic partner spanning cloud, software and enterprise solution delivery" },
    { id: "orcl", ticker: "ORCL", name: "Oracle", role: "IBM strategic partner in enterprise software and hybrid technology ecosystems" },
    { id: "sap", ticker: "SAP", name: "SAP", role: "IBM strategic partner for enterprise application and hybrid-cloud transformation workloads" },

    // CENTER
    { id: "ibm", ticker: "IBM", name: "IBM", role: "provides hybrid-cloud software, infrastructure, consulting and AI solutions to enterprises and governments" },

    // DOWNSTREAM LAYER +1 — CHANNEL / DELIVERY ECOSYSTEM
    { id: "ibm_channel", ticker: null, name: "Distributors, Resellers, ISVs & Service Providers", role: "IBM sells directly and through third-party distributors, resellers, independent software vendors, service providers and ecosystem partners" },
    { id: "ibm_consult", ticker: null, name: "IBM Consulting & Systems Integration", role: "consulting teams integrate IBM and partner technologies into business transformation and managed-service programs" },

    // DOWNSTREAM LAYER +2 — ENTERPRISE WORKLOADS
    { id: "ibm_clients", ticker: null, name: "Enterprise & Government Clients", role: "banks, insurers, governments, industrial firms and other organizations run mission-critical applications, AI and hybrid-cloud workloads on IBM technology" }
  ],

  edges: [
    // VERIFIED / DISCLOSED SUPPLY, ENABLEMENT OR DISTRIBUTION RELATIONSHIPS
    { source: "ibm_inputs", target: "ibm_critical" },
    { source: "ibm_critical", target: "ibm_infra" },
    { source: "ibm_infra", target: "aws" },
    { source: "ibm_infra", target: "msft" },
    { source: "ibm_infra", target: "orcl" },
    { source: "ibm_infra", target: "sap" },
    { source: "aws", target: "ibm" },
    { source: "msft", target: "ibm" },
    { source: "orcl", target: "ibm" },
    { source: "sap", target: "ibm" },
    { source: "ibm", target: "ibm_channel" },
    { source: "ibm", target: "ibm_consult" },
    { source: "ibm_channel", target: "ibm_clients" },
    { source: "ibm_consult", target: "ibm_clients" }
  ]
},

AXP: {
  name: "American Express",
  root: "axp",
  nodes: [
    // UPSTREAM LAYER -4 — COMMERCE / ACCEPTANCE ENDPOINTS
    { id: "axp_pos", ticker: null, name: "Merchant POS, E-Commerce & Travel Commerce Systems", role: "physical and digital merchant systems originate payment requests and transaction data that enter the American Express network" },

    // UPSTREAM LAYER -3 — ACQUIRERS / PROCESSORS / PAYMENT FACILITATORS
    { id: "axp_acq", ticker: null, name: "Third-Party Merchant Acquirers, Processors & Payment Facilitators", role: "external acquiring and processing partners connect merchants to American Express acceptance and can negotiate network commercial terms" },

    // UPSTREAM LAYER -2 — THIRD-PARTY ISSUING / NETWORK PARTNERS
    { id: "axp_banks", ticker: null, name: "Third-Party Banks & Network Partners", role: "banks and institutions in roughly 110 countries and territories issue American Express-branded cards and/or acquire merchants on the network" },

    // UPSTREAM LAYER -1 — AMEX AUTHORIZATION / CLEARING / SETTLEMENT
    { id: "axp_network", ticker: null, name: "American Express Global Payments Network", role: "integrated network authorizes, processes and settles transactions and provides fraud, data, marketing and merchant-services capabilities" },

    // CENTER
    { id: "axp", ticker: "AXP", name: "American Express", role: "integrated global payments company issuing cards, operating a merchant network and providing premium consumer and commercial financial services" },

    // DOWNSTREAM LAYER +1 — CARD / MERCHANT FRANCHISE
    { id: "axp_members", ticker: null, name: "Consumer, SME & Corporate Card Members", role: "cardholders use American Express products for consumer, small-business and corporate spending" },
    { id: "axp_merchants", ticker: null, name: "Merchants & Travel Partners", role: "merchants accept American Express payments and receive settlement, fraud-prevention, data and marketing services" },

    // DOWNSTREAM LAYER +2 — SPENDING / SETTLEMENT ECONOMY
    { id: "axp_spend", ticker: null, name: "Retail, Travel, Dining & B2B Spending", role: "end purchase activity generates billed business, discount revenue, lending balances and network volume" },
    { id: "axp_settle", ticker: null, name: "Merchant Settlement & Working Capital", role: "merchant payments settle through the network after authorized card transactions" },

    // EXPANDED DENSITY — VERIFIED / HIGH-CONFIDENCE COMPANY NODES
    { id: "aapl", ticker: "AAPL", name: "Apple", role: "digital-wallet partner enabling eligible American Express cards and account features through Apple Pay" },
    { id: "pypl", ticker: "PYPL", name: "PayPal", role: "digital-payments partner integrating American Express membership and card benefits into PayPal experiences" },
    { id: "dal", ticker: "DAL", name: "Delta Air Lines", role: "longstanding U.S. co-brand partner for the Delta SkyMiles American Express card portfolio" },
    { id: "hlt", ticker: "HLT", name: "Hilton", role: "exclusive U.S. issuer partnership for Hilton Honors American Express co-brand cards" },
    { id: "mar", ticker: "MAR", name: "Marriott International", role: "travel co-brand partner for Marriott Bonvoy American Express card products" },
  ],

  edges: [
    // VERIFIED / DISCLOSED SUPPLY, ENABLEMENT OR DISTRIBUTION RELATIONSHIPS
    { source: "axp_pos", target: "axp_acq" },
    { source: "axp_acq", target: "axp_banks" },
    { source: "axp_banks", target: "axp_network" },
    { source: "axp_network", target: "axp" },
    { source: "axp", target: "axp_members" },
    { source: "axp", target: "axp_merchants" },
    { source: "axp_members", target: "axp_spend" },
    { source: "axp_merchants", target: "axp_spend" },
    { source: "axp_merchants", target: "axp_settle" },

    // EXPANDED DENSITY — VERIFIED / HIGH-CONFIDENCE RELATIONSHIPS
    { source: "axp", target: "aapl" },
    { source: "axp", target: "pypl" },
    { source: "axp", target: "dal" },
    { source: "axp", target: "hlt" },
    { source: "axp", target: "mar" },
    { source: "aapl", target: "axp_spend" },
    { source: "pypl", target: "axp_spend" },
    { source: "dal", target: "axp_spend" },
    { source: "hlt", target: "axp_spend" },
    { source: "mar", target: "axp_spend" },

  ]
},

APH: {
  name: "Amphenol",
  root: "aph",
  nodes: [
    // UPSTREAM LAYER -4 — RAW MATERIALS
    { id: "aph_raw", ticker: null, name: "Copper, Aluminum, Precious Metals, Plastics & Ceramics", role: "material inputs used in connectors, cables, antennas, sensors, high-speed interconnect and power products" },

    // UPSTREAM LAYER -3 — FORMING / PLATING / MACHINING INPUTS
    { id: "aph_parts", ticker: null, name: "Stamped, Molded, Plated & Machined Component Inputs", role: "internal and external processes convert raw materials into contacts, housings, cable, fiber, antenna and sensor subcomponents" },

    // UPSTREAM LAYER -2 — GLOBAL MANUFACTURING / ASSEMBLY
    { id: "aph_mfg", ticker: null, name: "Amphenol Global Manufacturing Network", role: "vertically integrated facilities in roughly 40 countries perform molding, stamping, plating, CNC machining, extrusion, die casting, cable production, antenna and sensor fabrication and assembly" },

    // UPSTREAM LAYER -1 — ENGINEERING / CUSTOMER-SPECIFIC CONFIGURATION
    { id: "aph_engineering", ticker: null, name: "Design Engineering & Customer-Specific Integration", role: "Amphenol works with customers at the design stage to create qualified interconnect, sensor and antenna solutions tailored to end systems" },

    // CENTER
    { id: "aph", ticker: "APH", name: "Amphenol", role: "global manufacturer of electrical, electronic and fiber-optic connectors, interconnect systems, antennas, sensors and related cable products" },

    // DOWNSTREAM LAYER +1 — SALES / INTEGRATION CHANNEL
    { id: "aph_oem", ticker: null, name: "OEM, EMS & ODM Customers", role: "thousands of original-equipment manufacturers, electronics manufacturing services companies and original-design manufacturers integrate Amphenol products into systems" },
    { id: "aph_dist", ticker: null, name: "Electronics Distributors & Service Providers", role: "global distributor network and communications/web-service providers purchase and deploy Amphenol connectivity products" },

    // DOWNSTREAM LAYER +2 — END MARKETS
    { id: "aph_datacom", ticker: null, name: "IT Datacom / AI Infrastructure", role: "servers, switches, accelerators and data-center systems use high-speed and power interconnects" },
    { id: "aph_auto", ticker: null, name: "Automotive & EV Systems", role: "vehicles use connectors, sensors, antennas, charging and power-management interconnect products" },
    { id: "aph_aero", ticker: null, name: "Aerospace, Defense, Mobile & Industrial Systems", role: "harsh-environment, RF, fiber, sensor and power solutions connect mission-critical and consumer systems" },

    // EXPANDED DENSITY — VERIFIED / HIGH-CONFIDENCE COMPANY NODES
    { id: "arw", ticker: "ARW", name: "Arrow Electronics", role: "authorized Amphenol distribution partner across multiple connector and interconnect product families" },
    { id: "avt", ticker: "AVT", name: "Avnet", role: "authorized Amphenol distribution partner, including major interconnect product lines" },
    { id: "digikey", ticker: null, name: "Digi-Key Electronics", role: "authorized distributor for numerous Amphenol connector, cable and RF product families" },
    { id: "mouser", ticker: null, name: "Mouser Electronics", role: "authorized distributor for numerous Amphenol connector, sensor and RF product families" },
  ],

  edges: [
    // VERIFIED / DISCLOSED SUPPLY, ENABLEMENT OR DISTRIBUTION RELATIONSHIPS
    { source: "aph_raw", target: "aph_parts" },
    { source: "aph_parts", target: "aph_mfg" },
    { source: "aph_mfg", target: "aph_engineering" },
    { source: "aph_engineering", target: "aph" },
    { source: "aph", target: "aph_oem" },
    { source: "aph", target: "aph_dist" },
    { source: "aph_oem", target: "aph_datacom" },
    { source: "aph_oem", target: "aph_auto" },
    { source: "aph_oem", target: "aph_aero" },
    { source: "aph_dist", target: "aph_datacom" },

    // EXPANDED DENSITY — VERIFIED / HIGH-CONFIDENCE RELATIONSHIPS
    { source: "aph", target: "arw" },
    { source: "aph", target: "avt" },
    { source: "aph", target: "digikey" },
    { source: "aph", target: "mouser" },
    { source: "arw", target: "aph_datacom" },
    { source: "avt", target: "aph_aero" },
    { source: "digikey", target: "aph_auto" },
    { source: "mouser", target: "aph_datacom" },

  ]
},

VZ: {
  name: "Verizon",
  root: "vz",
  nodes: [
    // UPSTREAM LAYER -4 — NETWORK PHYSICAL INPUTS
    { id: "vz_inputs", ticker: null, name: "Fiber, Cable, Towers, Radios, Routers, Power & Site Equipment", role: "physical infrastructure inputs used to build wireless, fiber, switching, transport and data-center networks" },

    // UPSTREAM LAYER -3 — NETWORK EQUIPMENT / SOFTWARE SUPPLIERS
    { id: "vz_vendor", ticker: null, name: "Network Equipment, Software & Service Providers", role: "Verizon has multi-year commitments for network equipment, software and services sourced from a variety of suppliers; individual suppliers are not identified as material in the 2025 10-K" },

    // UPSTREAM LAYER -2 — ACCESS / TRANSPORT INFRASTRUCTURE
    { id: "vz_wireless", ticker: null, name: "5G / 4G Radio Access & Core Network", role: "cell sites, spectrum, radio equipment, switching and core-network systems provide nationwide wireless connectivity" },
    { id: "vz_fiber", ticker: null, name: "Fiber Backbone & Fios Access Network", role: "fiber-optic plant, transport and access infrastructure provide broadband, enterprise and backhaul connectivity" },

    // UPSTREAM LAYER -1 — VERIZON NETWORK OPERATIONS
    { id: "vz_ops", ticker: null, name: "Network Operations, Data Centers & Service Platforms", role: "Verizon operates and monitors wireless, fiber, voice, broadband, security and enterprise service platforms across its network footprint" },

    // CENTER
    { id: "vz", ticker: "VZ", name: "Verizon", role: "communications company providing wireless, fiber broadband, fixed wireless access, enterprise networking, voice and managed technology services" },

    // DOWNSTREAM LAYER +1 — SERVICE CHANNELS
    { id: "vz_consumer", ticker: null, name: "Verizon Consumer", role: "wireless, device, Fios and fixed-wireless services delivered to households and individual subscribers" },
    { id: "vz_business", ticker: null, name: "Verizon Business", role: "wireless, networking, security, broadband and communications services delivered to enterprises, small businesses and public-sector customers" },

    // DOWNSTREAM LAYER +2 — CONNECTED USERS
    { id: "vz_people", ticker: null, name: "Consumers & Households", role: "mobile and broadband subscribers consume voice, data, streaming and internet connectivity" },
    { id: "vz_enterprise", ticker: null, name: "Enterprises, Government & Wholesale Customers", role: "business and public-sector users consume managed connectivity, private networking, security and communications services" },

    // EXPANDED DENSITY — VERIFIED / HIGH-CONFIDENCE COMPANY NODES
    { id: "eric", ticker: "ERIC", name: "Ericsson", role: "long-term Verizon radio-access and network technology supplier supporting 5G and next-generation wireless infrastructure" },
    { id: "nok", ticker: "NOK", name: "Nokia", role: "Verizon network technology partner supplying private-5G and next-generation wireless hardware and software" },
    { id: "csco", ticker: "CSCO", name: "Cisco", role: "longstanding Verizon technology partner supplying routing, transport and network infrastructure" },
    { id: "qcom", ticker: "QCOM", name: "Qualcomm", role: "wireless technology partner collaborating with Verizon on 5G Advanced and next-generation device/network capabilities" },
    { id: "samsung", ticker: null, name: "Samsung Electronics", role: "network equipment and wireless-technology partner in Verizon's 5G and next-generation network ecosystem" },
  ],

  edges: [
    // VERIFIED / DISCLOSED SUPPLY, ENABLEMENT OR DISTRIBUTION RELATIONSHIPS
    { source: "vz_inputs", target: "vz_vendor" },
    { source: "vz_vendor", target: "vz_wireless" },
    { source: "vz_vendor", target: "vz_fiber" },
    { source: "vz_wireless", target: "vz_ops" },
    { source: "vz_fiber", target: "vz_ops" },
    { source: "vz_ops", target: "vz" },
    { source: "vz", target: "vz_consumer" },
    { source: "vz", target: "vz_business" },
    { source: "vz_consumer", target: "vz_people" },
    { source: "vz_business", target: "vz_enterprise" },

    // EXPANDED DENSITY — VERIFIED / HIGH-CONFIDENCE RELATIONSHIPS
    { source: "eric", target: "vz_wireless" },
    { source: "nok", target: "vz_wireless" },
    { source: "qcom", target: "vz_wireless" },
    { source: "samsung", target: "vz_wireless" },
    { source: "csco", target: "vz_fiber" },

  ]
},

CRM: {
  name: "Salesforce",
  root: "crm",
  nodes: [
    // UPSTREAM LAYER -4 — PUBLIC-CLOUD PHYSICAL FOUNDATION
    { id: "crm_physical", ticker: null, name: "Data-Center Compute, Storage, Networking & Power", role: "physical cloud infrastructure underlying the public-cloud regions on which Salesforce Hyperforce operates" },

    // UPSTREAM LAYER -3 — HYPERFORCE CLOUD PROVIDERS
    { id: "aws", ticker: "AMZN", name: "Amazon Web Services", role: "primary Hyperforce public-cloud infrastructure provider across Salesforce regions; Salesforce documents Hyperforce running on AWS" },
    { id: "gcp", ticker: "GOOGL", name: "Google Cloud", role: "Salesforce expanded Hyperforce to Google Cloud in 2026; production traffic is live and broader North American availability begins in late 2026" },

    // UPSTREAM LAYER -2 — HYPERFORCE / EDGE INFRASTRUCTURE
    { id: "hyperforce", ticker: null, name: "Salesforce Hyperforce & Edge", role: "Salesforce's public-cloud-native infrastructure architecture provides compute, data residency, security, networking and global application delivery" },

    // UPSTREAM LAYER -1 — DATA / AI / APPLICATION PLATFORM
    { id: "crm_platform", ticker: null, name: "Agentforce 360, Data 360, Customer 360 & Platform Services", role: "Salesforce application, data, integration and AI layers run on Hyperforce and deliver CRM workflows, agents, analytics and automation" },

    // CENTER
    { id: "crm", ticker: "CRM", name: "Salesforce", role: "enterprise cloud software company centered on CRM, Data 360, Agentforce, Slack, Tableau, MuleSoft and industry applications" },

    // DOWNSTREAM LAYER +1 — ECOSYSTEM / IMPLEMENTATION
    { id: "crm_apps", ticker: null, name: "AppExchange ISVs & Technology Partners", role: "independent software vendors extend Salesforce through applications and integrations distributed through the Salesforce ecosystem" },
    { id: "crm_si", ticker: null, name: "Consulting & Systems-Integration Partners", role: "global and regional partners implement, customize and integrate Salesforce for enterprise customers" },

    // DOWNSTREAM LAYER +2 — ENTERPRISE USERS
    { id: "crm_customers", ticker: null, name: "Sales, Service, Marketing, Commerce & IT Organizations", role: "business teams use Salesforce applications and AI agents to manage customers, workflows, data and employee productivity" },
    { id: "crm_agents", ticker: null, name: "Employees, Customers & AI Agents", role: "human users and autonomous agents interact with enterprise data and workflows through deployed Salesforce applications" },

    // EXPANDED DENSITY — VERIFIED / HIGH-CONFIDENCE COMPANY NODES
    { id: "acn", ticker: "ACN", name: "Accenture", role: "Salesforce global transformation partner delivering AI, Data Cloud and CRM implementations" },
    { id: "ibm", ticker: "IBM", name: "IBM", role: "Salesforce consulting and AI transformation partner integrating enterprise technology with Salesforce platforms" },
    { id: "ctsh", ticker: "CTSH", name: "Cognizant", role: "Salesforce consulting and implementation partner helping enterprises build and operate AI-enabled CRM platforms" },
    { id: "deloitte", ticker: null, name: "Deloitte", role: "major Salesforce global consulting partner delivering industry, data and generative-AI transformation programs" },
    { id: "pwc", ticker: null, name: "PwC", role: "Salesforce global consulting partner delivering CRM, AI, data and operating-model transformation" },
  ],

  edges: [
    // VERIFIED / DISCLOSED SUPPLY, ENABLEMENT OR DISTRIBUTION RELATIONSHIPS
    { source: "crm_physical", target: "aws" },
    { source: "crm_physical", target: "gcp" },
    { source: "aws", target: "hyperforce" },
    { source: "gcp", target: "hyperforce" },
    { source: "hyperforce", target: "crm_platform" },
    { source: "crm_platform", target: "crm" },
    { source: "crm", target: "crm_apps" },
    { source: "crm", target: "crm_si" },
    { source: "crm_apps", target: "crm_customers" },
    { source: "crm_si", target: "crm_customers" },
    { source: "crm_apps", target: "crm_agents" },
    { source: "crm_si", target: "crm_agents" },

    // EXPANDED DENSITY — VERIFIED / HIGH-CONFIDENCE RELATIONSHIPS
    { source: "crm", target: "acn" },
    { source: "crm", target: "ibm" },
    { source: "crm", target: "ctsh" },
    { source: "crm", target: "deloitte" },
    { source: "crm", target: "pwc" },
    { source: "acn", target: "crm_customers" },
    { source: "ibm", target: "crm_customers" },
    { source: "ctsh", target: "crm_customers" },
    { source: "deloitte", target: "crm_customers" },
    { source: "pwc", target: "crm_customers" },

  ]
},

ADI: {
  name: "Analog Devices",
  root: "adi",
  nodes: [
    // UPSTREAM LAYER -4 — SEMICONDUCTOR RAW MATERIALS
    { id: "adi_raw", ticker: null, name: "Silicon Wafers, Chemicals, Gases, Precious Metals & Packaging Materials", role: "raw materials used in analog, mixed-signal, DSP, power, MEMS and sensor semiconductor manufacturing" },

    // UPSTREAM LAYER -3 — WAFER FABRICATION
    { id: "adi_internal", ticker: null, name: "ADI Internal Wafer Fabs", role: "Analog Devices fabricates part of its IC volume internally at facilities in Massachusetts, Washington, Oregon and Ireland" },
    { id: "tsm", ticker: "TSM", name: "TSMC", role: "named external wafer foundry used by Analog Devices; the company sources more than half of annual wafer requirements from third-party foundries such as TSMC and others" },

    // UPSTREAM LAYER -2 — ASSEMBLY / SORT / TEST
    { id: "adi_at", ticker: null, name: "ADI Assembly, Wafer Sort & Test Facilities", role: "internal facilities in Asia perform assembly, wafer sort and test for portions of ADI production" },
    { id: "adi_osat", ticker: null, name: "Third-Party Assembly & Test Subcontractors", role: "Analog Devices makes extensive use of external subcontractors for assembly and testing" },

    // UPSTREAM LAYER -1 — INVENTORY / GLOBAL SALES FULFILLMENT
    { id: "adi_fulfill", ticker: null, name: "ADI Finished-Goods Inventory & Distribution Network", role: "finished semiconductors are stocked and shipped through direct sales and distribution channels to a broad industrial and automotive customer base" },

    // CENTER
    { id: "adi", ticker: "ADI", name: "Analog Devices", role: "semiconductor company focused on analog, mixed-signal, power, RF, DSP, MEMS and sensor technologies" },

    // DOWNSTREAM LAYER +1 — DESIGN-IN CUSTOMERS
    { id: "adi_industrial", ticker: null, name: "Industrial, Instrumentation & Communications Customers", role: "equipment makers design ADI signal-chain, power, data-conversion and sensing products into industrial and communications systems" },
    { id: "adi_auto", ticker: null, name: "Automotive OEMs & Tier Suppliers", role: "vehicles use ADI battery-management, audio, sensing, connectivity, power and signal-processing technologies" },

    // DOWNSTREAM LAYER +2 — END SYSTEMS
    { id: "adi_systems", ticker: null, name: "Factories, Vehicles, Healthcare, Communications & Consumer Systems", role: "end equipment converts real-world signals into digital information and control using ADI semiconductor content" },

    // EXPANDED DENSITY — VERIFIED / HIGH-CONFIDENCE COMPANY NODES
    { id: "arw", ticker: "ARW", name: "Arrow Electronics", role: "ADI's strategic global distribution channel partner" },
    { id: "digikey", ticker: null, name: "Digi-Key Electronics", role: "authorized catalog distributor carrying Analog Devices products for design and production customers" },
    { id: "mouser", ticker: null, name: "Mouser Electronics", role: "authorized worldwide distribution partner for Analog Devices' semiconductor portfolio" },
    { id: "farnell", ticker: null, name: "Farnell / Newark / element14", role: "authorized e-commerce distribution channel listed by Analog Devices" },
    { id: "richardson", ticker: null, name: "Richardson RFPD", role: "authorized specialty distributor in Analog Devices' current distribution network" },
  ],

  edges: [
    // VERIFIED / DISCLOSED SUPPLY, ENABLEMENT OR DISTRIBUTION RELATIONSHIPS
    { source: "adi_raw", target: "adi_internal" },
    { source: "adi_raw", target: "tsm" },
    { source: "adi_internal", target: "adi_at" },
    { source: "tsm", target: "adi_osat" },
    { source: "adi_at", target: "adi_fulfill" },
    { source: "adi_osat", target: "adi_fulfill" },
    { source: "adi_fulfill", target: "adi" },
    { source: "adi", target: "adi_industrial" },
    { source: "adi", target: "adi_auto" },
    { source: "adi_industrial", target: "adi_systems" },
    { source: "adi_auto", target: "adi_systems" },

    // EXPANDED DENSITY — VERIFIED / HIGH-CONFIDENCE RELATIONSHIPS
    { source: "adi", target: "arw" },
    { source: "adi", target: "digikey" },
    { source: "adi", target: "mouser" },
    { source: "adi", target: "farnell" },
    { source: "adi", target: "richardson" },
    { source: "arw", target: "adi_systems" },
    { source: "digikey", target: "adi_systems" },
    { source: "mouser", target: "adi_systems" },
    { source: "farnell", target: "adi_systems" },
    { source: "richardson", target: "adi_systems" },

  ]
},

LIN: {
  name: "Linde",
  root: "lin",
  nodes: [
    // UPSTREAM LAYER -4 — FEEDSTOCKS & UTILITIES
    { id: "lin_air", ticker: null, name: "Atmospheric Air", role: "primary feedstock separated into oxygen, nitrogen and argon at Linde air-separation plants" },
    { id: "lin_ng", ticker: null, name: "Natural Gas & Hydrocarbon Feedstocks", role: "feedstock used in hydrogen, synthesis-gas and other industrial-gas production processes" },
    { id: "lin_power", ticker: null, name: "Electricity & Utility Power", role: "major operating input for compression, liquefaction, purification and on-site gas production" },

    // UPSTREAM LAYER -3 — PRIMARY GAS PRODUCTION
    { id: "lin_asu", ticker: null, name: "Air Separation Units", role: "on-site and merchant plants separate atmospheric air into high-purity oxygen, nitrogen and argon" },
    { id: "lin_h2", ticker: null, name: "Hydrogen & Syngas Plants", role: "steam-reforming, electrolysis and related facilities produce hydrogen, carbon monoxide and synthesis gas" },
    { id: "lin_specialty", ticker: null, name: "Specialty Gas Production", role: "specialty and electronic gases are produced, blended and purified for high-specification applications" },

    // UPSTREAM LAYER -2 — PURIFICATION / LIQUEFACTION
    { id: "lin_purify", ticker: null, name: "Purification, Compression & Liquefaction", role: "gas streams are purified, compressed or liquefied to the purity and physical form required by customers" },
    { id: "lin_electronics", ticker: null, name: "Ultra-High-Purity Electronics Gas Systems", role: "specialized purification and delivery systems produce semiconductor-grade atmospheric, process and specialty gases" },

    // UPSTREAM LAYER -1 — DELIVERY INFRASTRUCTURE
    { id: "lin_onsite", ticker: null, name: "On-Site Gas Supply Plants", role: "Linde builds, owns and operates production plants integrated with large customer facilities under long-term supply agreements" },
    { id: "lin_pipeline", ticker: null, name: "Pipeline & Bulk Distribution", role: "pipeline complexes and bulk liquid logistics deliver large-volume industrial gases" },
    { id: "lin_cylinder", ticker: null, name: "Cylinder & Packaged-Gas Network", role: "merchant and cylinder operations distribute lower-volume gases, mixtures and hardgoods" },

    // CENTER
    { id: "lin", ticker: "LIN", name: "Linde", role: "global industrial-gases and engineering company supplying oxygen, nitrogen, argon, hydrogen, specialty gases and related process technologies" },

    // DOWNSTREAM LAYER +1 — CORE END MARKETS
    { id: "lin_semis", ticker: null, name: "Semiconductor & Electronics Manufacturing", role: "advanced fabs consume ultra-high-purity nitrogen, oxygen, argon, hydrogen and specialty process gases" },
    { id: "lin_industrial", ticker: null, name: "Chemicals, Metals & Manufacturing", role: "industrial customers use process gases for refining, chemical production, steelmaking, welding and fabrication" },
    { id: "lin_health", ticker: null, name: "Healthcare & Life Sciences", role: "hospitals, home-care providers and pharmaceutical operations consume medical and specialty gases" },
    { id: "lin_food", ticker: null, name: "Food, Beverage & Environmental Markets", role: "gases support freezing, chilling, carbonation, packaging, water treatment and environmental processes" },

    // DOWNSTREAM LAYER +2 — END PRODUCTS / SERVICES
    { id: "lin_end", ticker: null, name: "Chips, Metals, Chemicals, Medicines & Consumer Goods", role: "customer operations convert Linde gases and engineering services into finished industrial, healthcare and consumer products" },

    // EXPANDED DENSITY — VERIFIED / HIGH-CONFIDENCE COMPANY NODES
    { id: "intc", ticker: "INTC", name: "Intel", role: "major U.S. semiconductor manufacturer operating fabs that require continuous high-purity industrial-gas supply" },
    { id: "gfs", ticker: "GFS", name: "GlobalFoundries", role: "U.S.-listed semiconductor foundry operating large-scale fabs that consume bulk and specialty gases" },
    { id: "tsm", ticker: "TSM", name: "TSMC", role: "advanced foundry operator represented as a semiconductor end market; Linde announced a 2026 Phoenix expansion for an unnamed major semiconductor customer and separately supplies electronics customers globally" },
  ],

  edges: [
    // FEEDSTOCKS → PRODUCTION
    { source: "lin_air", target: "lin_asu" },
    { source: "lin_ng", target: "lin_h2" },
    { source: "lin_power", target: "lin_asu" },
    { source: "lin_power", target: "lin_h2" },
    { source: "lin_power", target: "lin_specialty" },

    // PRODUCTION → PURIFICATION
    { source: "lin_asu", target: "lin_purify" },
    { source: "lin_h2", target: "lin_purify" },
    { source: "lin_specialty", target: "lin_electronics" },

    // PURIFICATION → DELIVERY
    { source: "lin_purify", target: "lin_onsite" },
    { source: "lin_purify", target: "lin_pipeline" },
    { source: "lin_purify", target: "lin_cylinder" },
    { source: "lin_electronics", target: "lin_onsite" },

    // DELIVERY → LINDE
    { source: "lin_onsite", target: "lin" },
    { source: "lin_pipeline", target: "lin" },
    { source: "lin_cylinder", target: "lin" },

    // LINDE → END MARKETS
    { source: "lin", target: "lin_semis" },
    { source: "lin", target: "lin_industrial" },
    { source: "lin", target: "lin_health" },
    { source: "lin", target: "lin_food" },

    // END MARKETS → OUTPUT
    { source: "lin_semis", target: "lin_end" },
    { source: "lin_industrial", target: "lin_end" },
    { source: "lin_health", target: "lin_end" },
    { source: "lin_food", target: "lin_end" },

    // EXPANDED DENSITY — END-MARKET EXAMPLES
    { source: "lin_semis", target: "intc" },
    { source: "lin_semis", target: "gfs" },
    { source: "lin_semis", target: "tsm" },

  ]
},

STX: {
  name: "Seagate Technology",
  root: "stx",
  nodes: [
    // UPSTREAM LAYER -4 — STORAGE MATERIAL INPUTS
    { id: "stx_substrates", ticker: null, name: "Disk Substrates & Magnetic Materials", role: "aluminum or glass substrates and magnetic-film materials form the physical basis of hard-disk media" },
    { id: "stx_magnets", ticker: null, name: "Rare-Earth Magnets & Precision Metals", role: "magnetic and precision-metal inputs support spindle motors, actuators and other electromechanical assemblies" },
    { id: "stx_semis", ticker: null, name: "Semiconductors, PCBs & Electronic Components", role: "controllers, memory, power-management devices and circuit assemblies provide HDD electronics and control functions" },

    // UPSTREAM LAYER -3 — CRITICAL HDD COMPONENTS
    { id: "stx_media", ticker: null, name: "Recording Media Fabrication", role: "thin-film processes create high-density magnetic disks used in Seagate capacity drives" },
    { id: "stx_heads", ticker: null, name: "Recording Heads & Slider Assemblies", role: "precision head technologies write and read data at extremely high areal density" },
    { id: "mrvl", ticker: "MRVL", name: "Marvell Technology", role: "storage-semiconductor company with a long history of HDD controller and read-channel technology used across the disk-drive industry, including collaboration with Seagate" },

    // UPSTREAM LAYER -2 — DRIVE SUBASSEMBLIES
    { id: "stx_hda", ticker: null, name: "Head-Disk Assembly", role: "media, heads, spindle motors and actuators are integrated inside a sealed mechanical assembly" },
    { id: "stx_pcb", ticker: null, name: "Drive Electronics & Firmware", role: "controller silicon, memory, firmware and power electronics are integrated onto HDD control boards" },

    // UPSTREAM LAYER -1 — FINAL ASSEMBLY / TEST
    { id: "stx_final", ticker: null, name: "Seagate HDD Assembly & Test", role: "Seagate manufacturing operations integrate mechanical and electronic subassemblies, load firmware and perform reliability testing" },
    { id: "stx_supply", ticker: null, name: "Global Component & Contract-Supply Network", role: "Seagate uses internal production plus external component suppliers, including some sole- or limited-source providers" },

    // CENTER
    { id: "stx", ticker: "STX", name: "Seagate Technology", role: "designs and manufactures mass-capacity hard disk drives and storage systems used primarily in cloud, enterprise and edge environments" },

    // DOWNSTREAM LAYER +1 — SALES CHANNELS
    { id: "stx_cloud", ticker: null, name: "Hyperscale Cloud & Enterprise Customers", role: "large data-center operators buy high-capacity HDDs for economical exabyte-scale storage" },
    { id: "stx_oem", ticker: null, name: "OEM & Systems Customers", role: "server, storage-appliance and computer manufacturers integrate Seagate drives into finished systems" },
    { id: "stx_channel", ticker: null, name: "Distributors, Resellers & Retail", role: "channel partners distribute enterprise, client and consumer storage products" },

    // DOWNSTREAM LAYER +2 — END WORKLOADS
    { id: "stx_end", ticker: null, name: "Cloud Data, AI Datasets, Enterprise Storage & Backup", role: "end users store rapidly growing data sets, archives, media, backups and AI-related data on HDD-based infrastructure" },

    // EXPANDED DENSITY — VERIFIED / HIGH-CONFIDENCE COMPANY NODES
    { id: "amzn", ticker: "AMZN", name: "Amazon", role: "major hyperscale cloud operator representing the class of customers driving mass-capacity HDD demand" },
    { id: "msft", ticker: "MSFT", name: "Microsoft", role: "major hyperscale cloud operator representing the class of customers driving mass-capacity HDD demand" },
    { id: "googl", ticker: "GOOGL", name: "Alphabet", role: "major hyperscale cloud operator representing the class of customers driving mass-capacity HDD demand" },
    { id: "dell", ticker: "DELL", name: "Dell Technologies", role: "server and storage OEM representing the systems channel that integrates enterprise HDD capacity" },
  ],

  edges: [
    // MATERIALS → COMPONENTS
    { source: "stx_substrates", target: "stx_media" },
    { source: "stx_magnets", target: "stx_heads" },
    { source: "stx_semis", target: "mrvl" },

    // COMPONENTS → SUBASSEMBLIES
    { source: "stx_media", target: "stx_hda" },
    { source: "stx_heads", target: "stx_hda" },
    { source: "mrvl", target: "stx_pcb" },

    // SUBASSEMBLIES → FINAL BUILD
    { source: "stx_hda", target: "stx_final" },
    { source: "stx_pcb", target: "stx_final" },

    // SUPPLY NETWORK → FINAL BUILD
    { source: "stx_supply", target: "stx_final" },

    // FINAL BUILD → SEAGATE
    { source: "stx_final", target: "stx" },

    // SEAGATE → CHANNELS
    { source: "stx", target: "stx_cloud" },
    { source: "stx", target: "stx_oem" },
    { source: "stx", target: "stx_channel" },

    // CHANNELS → END WORKLOADS
    { source: "stx_cloud", target: "stx_end" },
    { source: "stx_oem", target: "stx_end" },
    { source: "stx_channel", target: "stx_end" },

    // EXPANDED DENSITY — CLOUD / OEM ECOSYSTEM
    { source: "stx_cloud", target: "amzn" },
    { source: "stx_cloud", target: "msft" },
    { source: "stx_cloud", target: "googl" },
    { source: "stx_oem", target: "dell" },

  ]
},

DE: {
  name: "Deere & Company",
  root: "de",
  nodes: [
    // UPSTREAM LAYER -4 — INDUSTRIAL MATERIAL INPUTS
    { id: "de_steel", ticker: null, name: "Steel, Castings & Forgings", role: "structural steel, castings and forgings form frames, axles, housings and major load-bearing components" },
    { id: "de_rubber", ticker: null, name: "Tires, Rubber & Polymers", role: "tires, belts, hoses, seals and polymer components support mobility and hydraulic systems" },
    { id: "de_electronics", ticker: null, name: "Semiconductors, Sensors & Electronics", role: "electronic controls, positioning hardware, sensors and computing components enable precision and autonomous functions" },

    // UPSTREAM LAYER -3 — MAJOR COMPONENT SYSTEMS
    { id: "de_powertrain", ticker: null, name: "Engines, Transmissions & Powertrain Components", role: "Deere internal production and outside suppliers provide diesel engines, transmissions and drivetrain assemblies" },
    { id: "de_hydraulics", ticker: null, name: "Hydraulics & Motion-Control Systems", role: "pumps, valves, cylinders and controls convert engine or electric power into machine movement" },
    { id: "de_precision", ticker: null, name: "Precision Agriculture & Automation Hardware", role: "GPS, cameras, displays, sensors and compute systems support guidance, machine automation and data-driven operations" },

    // UPSTREAM LAYER -2 — MACHINE MODULE ASSEMBLY
    { id: "de_modules", ticker: null, name: "Frames, Cabs, Implements & Machine Modules", role: "major fabricated and purchased systems are integrated into tractor, combine, sprayer, construction and turf modules" },
    { id: "de_software", ticker: null, name: "Embedded Software & Deere Technology Stack", role: "machine software integrates controls, guidance, telematics and precision-agriculture functionality" },

    // UPSTREAM LAYER -1 — FINAL MANUFACTURING
    { id: "de_final", ticker: null, name: "John Deere Final Assembly", role: "Deere plants assemble, paint, configure and test complete agricultural, construction, forestry and turf equipment" },
    { id: "de_parts", ticker: null, name: "Parts & Aftermarket Logistics", role: "parts depots and service supply operations support equipment uptime throughout the installed base" },

    // CENTER
    { id: "de", ticker: "DE", name: "Deere & Company", role: "manufactures agricultural, construction, forestry and turf equipment and provides precision technology, parts and financial services" },

    // DOWNSTREAM LAYER +1 — DISTRIBUTION / FINANCING
    { id: "de_dealers", ticker: null, name: "Independent John Deere Dealer Network", role: "authorized dealers sell equipment, provide parts and perform maintenance and repair for customers" },
    { id: "de_finance", ticker: null, name: "John Deere Financial", role: "captive finance operations support equipment purchases, leases and dealer inventory" },

    // DOWNSTREAM LAYER +2 — END MARKETS
    { id: "de_farm", ticker: null, name: "Farmers & Agricultural Contractors", role: "growers use Deere equipment for planting, crop care, harvesting and farm logistics" },
    { id: "de_construction", ticker: null, name: "Construction, Forestry & Infrastructure Operators", role: "contractors and operators use Deere machinery for earthmoving, roadbuilding, forestry and material handling" },
    { id: "de_turf", ticker: null, name: "Turf, Grounds & Property Customers", role: "commercial and residential users operate Deere mowing, utility and grounds-care equipment" },
  ],

  edges: [
    // MATERIALS → COMPONENT SYSTEMS
    { source: "de_steel", target: "de_powertrain" },
    { source: "de_steel", target: "de_hydraulics" },
    { source: "de_rubber", target: "de_powertrain" },
    { source: "de_electronics", target: "de_precision" },

    // COMPONENTS → MACHINE MODULES
    { source: "de_powertrain", target: "de_modules" },
    { source: "de_hydraulics", target: "de_modules" },
    { source: "de_precision", target: "de_software" },

    // MODULES → FINAL MANUFACTURING
    { source: "de_modules", target: "de_final" },
    { source: "de_software", target: "de_final" },

    // FINAL MANUFACTURING → DEERE
    { source: "de_final", target: "de" },

    // AFTERMARKET → DEERE
    { source: "de_parts", target: "de" },

    // DEERE → DISTRIBUTION
    { source: "de", target: "de_dealers" },

    // DEERE → FINANCING
    { source: "de", target: "de_finance" },

    // DISTRIBUTION → END MARKETS
    { source: "de_dealers", target: "de_farm" },
    { source: "de_dealers", target: "de_construction" },
    { source: "de_dealers", target: "de_turf" },

    // FINANCING → END MARKETS
    { source: "de_finance", target: "de_farm" },
    { source: "de_finance", target: "de_construction" },

  ]
},

GILD: {
  name: "Gilead Sciences",
  root: "gild",
  nodes: [
    // UPSTREAM LAYER -4 — PHARMA / BIOLOGIC INPUTS
    { id: "gild_chem", ticker: null, name: "Chemical Reagents & Starting Materials", role: "chemical building blocks, solvents and processing materials feed small-molecule active-pharmaceutical-ingredient production" },
    { id: "gild_bio", ticker: null, name: "Biologic Media, Resins & Single-Use Inputs", role: "cell-culture, purification and sterile-processing inputs support biologic and cell-therapy manufacturing" },
    { id: "gild_packmat", ticker: null, name: "Vials, Bottles, Closures & Packaging Materials", role: "primary and secondary packaging protects finished medicines through distribution" },

    // UPSTREAM LAYER -3 — DRUG SUBSTANCE / API
    { id: "gild_api", ticker: null, name: "Small-Molecule API Manufacturing", role: "internal sites and qualified third parties manufacture active ingredients for antiviral, oncology and inflammation products" },
    { id: "gild_biologic", ticker: null, name: "Biologic & Cell-Therapy Drug Substance", role: "specialized internal and external capacity produces biologic intermediates and cell-therapy materials" },

    // UPSTREAM LAYER -2 — FORMULATION / FILL-FINISH
    { id: "gild_dose", ticker: null, name: "Dosage-Form Manufacturing", role: "drug substance is formulated into tablets, oral dosage forms, injectables and other commercial presentations" },
    { id: "gild_fill", ticker: null, name: "Sterile Fill-Finish & Cell-Therapy Processing", role: "sterile and patient-specific production steps prepare injectable and cell-therapy products for release" },

    // UPSTREAM LAYER -1 — PACKAGING / QUALITY RELEASE
    { id: "gild_release", ticker: null, name: "Packaging, Quality Control & Batch Release", role: "finished medicines are packaged, tested, released and transferred into regional distribution networks" },
    { id: "gild_3p", ticker: null, name: "Qualified Third-Party Manufacturing Network", role: "Gilead uses third-party manufacturers for portions of API, drug product, packaging and related supply-chain activities" },

    // CENTER
    { id: "gild", ticker: "GILD", name: "Gilead Sciences", role: "biopharmaceutical company focused on HIV, viral hepatitis, oncology, cell therapy and inflammatory diseases" },

    // DOWNSTREAM LAYER +1 — U.S. WHOLESALERS
    { id: "mck", ticker: "MCK", name: "McKesson", role: "one of the three wholesalers that historically account for about 90% of Gilead U.S. gross product sales" },
    { id: "cor", ticker: "COR", name: "Cencora", role: "one of the three wholesalers that historically account for about 90% of Gilead U.S. gross product sales" },
    { id: "cah", ticker: "CAH", name: "Cardinal Health", role: "one of the three wholesalers that historically account for about 90% of Gilead U.S. gross product sales" },

    // DOWNSTREAM LAYER +2 — CARE DELIVERY
    { id: "gild_pharmacy", ticker: null, name: "Retail & Specialty Pharmacies", role: "pharmacies dispense Gilead medicines to eligible patients after receiving product through wholesaler and specialty channels" },
    { id: "gild_hospital", ticker: null, name: "Hospitals, Clinics & Treatment Centers", role: "care sites administer oncology, cell-therapy and other Gilead products and manage patient treatment" },
    { id: "gild_patients", ticker: null, name: "Patients", role: "end users receive antiviral, oncology, inflammatory-disease and cell-therapy treatments" },
  ],

  edges: [
    // INPUTS → DRUG SUBSTANCE
    { source: "gild_chem", target: "gild_api" },
    { source: "gild_bio", target: "gild_biologic" },

    // DRUG SUBSTANCE → DOSAGE / FILL
    { source: "gild_api", target: "gild_dose" },
    { source: "gild_biologic", target: "gild_fill" },

    // DOSAGE / FILL → RELEASE
    { source: "gild_dose", target: "gild_release" },
    { source: "gild_fill", target: "gild_release" },

    // PACKAGING INPUTS → RELEASE
    { source: "gild_packmat", target: "gild_release" },

    // THIRD-PARTY NETWORK → RELEASE
    { source: "gild_3p", target: "gild_release" },

    // RELEASE → GILEAD
    { source: "gild_release", target: "gild" },

    // GILEAD → WHOLESALERS
    { source: "gild", target: "mck" },
    { source: "gild", target: "cor" },
    { source: "gild", target: "cah" },

    // WHOLESALERS → CARE DELIVERY
    { source: "mck", target: "gild_pharmacy" },
    { source: "cor", target: "gild_pharmacy" },
    { source: "cah", target: "gild_pharmacy" },
    { source: "mck", target: "gild_hospital" },
    { source: "cor", target: "gild_hospital" },
    { source: "cah", target: "gild_hospital" },

    // CARE DELIVERY → PATIENTS
    { source: "gild_pharmacy", target: "gild_patients" },
    { source: "gild_hospital", target: "gild_patients" },

  ]
},

DIS: {
  name: "The Walt Disney Company",
  root: "dis",
  nodes: [
    // UPSTREAM LAYER -4 — DIGITAL / PRODUCTION INFRASTRUCTURE
    { id: "aws", ticker: "AMZN", name: "Amazon Web Services", role: "Disney-selected preferred public-cloud infrastructure provider supporting enterprise workloads and the global scaling of Disney+" },
    { id: "googl", ticker: "GOOGL", name: "Google Cloud", role: "cloud platform interoperable with Disney advertising and data collaboration workflows, including Disney Clean Room capabilities" },
    { id: "dis_prodtech", ticker: null, name: "Production Hardware, Software & Studio Technology", role: "camera, rendering, editing, visual-effects and broadcast technologies support film, television and sports production" },

    // UPSTREAM LAYER -3 — CONTENT CREATION
    { id: "dis_studios", ticker: null, name: "Disney Studios & Television Production", role: "film and television labels develop, produce and acquire entertainment programming and franchises" },
    { id: "dis_sports", ticker: null, name: "ESPN Sports Production & Rights", role: "live sports rights, production crews and broadcast systems create ESPN programming" },
    { id: "dis_parks_content", ticker: null, name: "Imagineering, Attractions & Guest Experiences", role: "creative, engineering and operating teams design parks, resorts, cruise and consumer experiences" },

    // UPSTREAM LAYER -2 — PLATFORM / MEDIA PROCESSING
    { id: "dis_stream", ticker: null, name: "Disney Streaming Technology", role: "video processing, personalization, identity, advertising and distribution systems operate Disney+, Hulu and ESPN streaming experiences" },
    { id: "dis_broadcast", ticker: null, name: "Linear Networks & Broadcast Operations", role: "network operations schedule, package and transmit entertainment, news and sports programming" },
    { id: "dis_parks_ops", ticker: null, name: "Parks, Resorts & Cruise Operations", role: "physical assets, labor, food, lodging and attraction systems turn Disney intellectual property into destination experiences" },

    // UPSTREAM LAYER -1 — COMMERCIAL PACKAGING
    { id: "dis_release", ticker: null, name: "Content Release, Ad Sales & Rights Management", role: "Disney packages content into theatrical, streaming, television and licensing windows and sells advertising and rights" },
    { id: "dis_dtc", ticker: null, name: "Direct-to-Consumer Product Operations", role: "subscription, billing, customer service and application operations convert content into recurring streaming products" },

    // CENTER
    { id: "dis", ticker: "DIS", name: "The Walt Disney Company", role: "global entertainment company spanning studios, streaming, ESPN, television networks, parks, resorts, cruises and consumer products" },

    // DOWNSTREAM LAYER +1 — DISTRIBUTION CHANNELS
    { id: "roku", ticker: "ROKU", name: "Roku", role: "connected-TV platform distributing Disney streaming applications to household devices" },
    { id: "aapl", ticker: "AAPL", name: "Apple", role: "device and app-distribution ecosystem through which consumers access Disney streaming applications" },
    { id: "cmcsa", ticker: "CMCSA", name: "Comcast", role: "major pay-TV and broadband distribution ecosystem carrying Disney networks and streaming access to U.S. households" },
    { id: "dis_theaters", ticker: null, name: "Theatrical, Pay-TV & Affiliate Distribution", role: "cinemas, television affiliates and other distribution partners deliver Disney content to viewers" },

    // DOWNSTREAM LAYER +2 — AUDIENCES / DEMAND
    { id: "dis_consumers", ticker: null, name: "Streaming Subscribers, Moviegoers & TV Audiences", role: "consumers pay subscriptions, admissions and affiliate-related fees or view advertising-supported programming" },
    { id: "dis_guests", ticker: null, name: "Parks, Resorts & Cruise Guests", role: "families and travelers purchase admissions, lodging, food, merchandise and cruise experiences" },
    { id: "dis_advertisers", ticker: null, name: "Advertisers & Brand Partners", role: "brands buy advertising inventory and sponsorships across Disney television, streaming and digital properties" },
  ],

  edges: [
    // INFRASTRUCTURE → CONTENT / OPERATIONS
    { source: "aws", target: "dis_stream" },
    { source: "googl", target: "dis_stream" },
    { source: "dis_prodtech", target: "dis_studios" },
    { source: "dis_prodtech", target: "dis_sports" },

    // CONTENT → PLATFORM PROCESSING
    { source: "dis_studios", target: "dis_stream" },
    { source: "dis_sports", target: "dis_stream" },
    { source: "dis_sports", target: "dis_broadcast" },
    { source: "dis_parks_content", target: "dis_parks_ops" },

    // PLATFORMS → COMMERCIAL PACKAGING
    { source: "dis_stream", target: "dis_dtc" },
    { source: "dis_broadcast", target: "dis_release" },
    { source: "dis_parks_ops", target: "dis_release" },

    // COMMERCIAL PACKAGING → DISNEY
    { source: "dis_release", target: "dis" },
    { source: "dis_dtc", target: "dis" },

    // DISNEY → DISTRIBUTION
    { source: "dis", target: "roku" },
    { source: "dis", target: "aapl" },
    { source: "dis", target: "cmcsa" },
    { source: "dis", target: "dis_theaters" },

    // DISTRIBUTION → AUDIENCES
    { source: "roku", target: "dis_consumers" },
    { source: "aapl", target: "dis_consumers" },
    { source: "cmcsa", target: "dis_consumers" },
    { source: "dis_theaters", target: "dis_consumers" },

    // DISNEY → PARKS / ADVERTISING DEMAND
    { source: "dis", target: "dis_guests" },
    { source: "dis", target: "dis_advertisers" },

  ]
},

TMUS: {
  name: "T-Mobile US",
  root: "tmus",
  nodes: [
    // UPSTREAM LAYER -4 — NETWORK SILICON / FIBER INPUTS
    { id: "qcom", ticker: "QCOM", name: "Qualcomm", role: "wireless modem and radio technology supplier across the device ecosystem that connects to T-Mobile networks" },
    { id: "intc", ticker: "INTC", name: "Intel", role: "server and network-compute silicon supplier used broadly in cloud-native telecom infrastructure" },
    { id: "glw", ticker: "GLW", name: "Corning", role: "fiber-optic and connectivity supplier to U.S. communications networks, supporting the physical transport layer used by mobile operators" },

    // UPSTREAM LAYER -3 — RAN / NETWORK EQUIPMENT
    { id: "eric", ticker: "ERIC", name: "Ericsson", role: "strategic T-Mobile radio-access-network supplier supporting nationwide 5G and 5G-Advanced deployments" },
    { id: "nok", ticker: "NOK", name: "Nokia", role: "strategic T-Mobile RAN supplier under a multi-year 2025 agreement covering AirScale baseband and radio equipment" },
    { id: "csco", ticker: "CSCO", name: "Cisco", role: "routing, switching, packet-core and network-automation supplier across carrier-grade IP infrastructure" },

    // UPSTREAM LAYER -2 — TOWER / SITE INFRASTRUCTURE
    { id: "amt", ticker: "AMT", name: "American Tower", role: "large U.S. wireless-tower owner providing leased site infrastructure used by mobile operators including T-Mobile" },
    { id: "cci", ticker: "CCI", name: "Crown Castle", role: "U.S. communications-infrastructure provider supplying tower and fiber assets used by wireless carriers" },
    { id: "sbac", ticker: "SBAC", name: "SBA Communications", role: "U.S. tower owner providing leased macro-site infrastructure to wireless network operators" },

    // UPSTREAM LAYER -1 — INTEGRATED NETWORK
    { id: "tmus_ran", ticker: null, name: "T-Mobile 5G / 5G-Advanced RAN", role: "radio, baseband, spectrum and software are integrated across nationwide macro and small-cell sites" },
    { id: "tmus_core", ticker: null, name: "Cloud-Native Core & IP Transport", role: "core-network, routing, security and transport systems authenticate users and move traffic across T-Mobile infrastructure" },
    { id: "tmus_spectrum", ticker: null, name: "Spectrum Portfolio & Network Operations", role: "licensed spectrum and network-operations systems convert physical infrastructure into usable mobile capacity" },

    // CENTER
    { id: "tmus", ticker: "TMUS", name: "T-Mobile US", role: "U.S. wireless operator providing mobile voice/data, fixed wireless broadband and enterprise connectivity services" },

    // DOWNSTREAM LAYER +1 — SERVICE CHANNELS
    { id: "tmus_consumer", ticker: null, name: "Consumer Wireless", role: "postpaid and prepaid smartphone, connected-device and family-plan services" },
    { id: "tmus_fwa", ticker: null, name: "Fixed Wireless Broadband", role: "5G network capacity is packaged into home and small-business internet service" },
    { id: "tmus_business", ticker: null, name: "T-Mobile for Business", role: "enterprise, government and IoT customers purchase mobile and connectivity solutions" },

    // DOWNSTREAM LAYER +2 — END USERS
    { id: "tmus_users", ticker: null, name: "Households, Employees & Connected Devices", role: "people and devices consume voice, messaging, broadband and application data over T-Mobile networks" },
  ],

  edges: [
    // SILICON / FIBER → NETWORK EQUIPMENT
    { source: "qcom", target: "tmus_ran" },
    { source: "intc", target: "tmus_core" },
    { source: "glw", target: "tmus_core" },

    // NETWORK EQUIPMENT → SITE INFRASTRUCTURE
    { source: "eric", target: "tmus_ran" },
    { source: "nok", target: "tmus_ran" },
    { source: "csco", target: "tmus_core" },

    // TOWERS → INTEGRATED NETWORK
    { source: "amt", target: "tmus_ran" },
    { source: "cci", target: "tmus_ran" },
    { source: "sbac", target: "tmus_ran" },

    // INTEGRATED NETWORK → T-MOBILE
    { source: "tmus_ran", target: "tmus" },
    { source: "tmus_core", target: "tmus" },
    { source: "tmus_spectrum", target: "tmus" },

    // T-MOBILE → SERVICES
    { source: "tmus", target: "tmus_consumer" },
    { source: "tmus", target: "tmus_fwa" },
    { source: "tmus", target: "tmus_business" },

    // SERVICES → END USERS
    { source: "tmus_consumer", target: "tmus_users" },
    { source: "tmus_fwa", target: "tmus_users" },
    { source: "tmus_business", target: "tmus_users" },

  ]
},

PEP: {
  name: "PepsiCo",
  root: "pep",
  nodes: [
    // UPSTREAM LAYER -4 — AGRICULTURAL INPUTS
    { id: "pep_potatoes", ticker: null, name: "Potatoes", role: "core agricultural input for Lay’s, Ruffles and other potato-based snack products" },
    { id: "pep_corn", ticker: null, name: "Corn & Grains", role: "corn, oats, wheat and other grains support snack and food portfolios including Doritos, Cheetos and Quaker" },
    { id: "pep_sweeteners", ticker: null, name: "Sugar, Sweeteners, Juice & Flavor Inputs", role: "sweeteners, juices, concentrates and flavor ingredients feed beverage and food manufacturing" },
    { id: "pep_oils", ticker: null, name: "Vegetable Oils & Food Ingredients", role: "oils, seasonings, dairy and other ingredients support snack and food production" },

    // UPSTREAM LAYER -3 — PACKAGING / PROCESS INPUTS
    { id: "pep_pack", ticker: null, name: "Aluminum, PET, Glass, Carton & Flexible Packaging", role: "packaging materials become cans, bottles, cartons, multipacks and snack bags across PepsiCo brands" },
    { id: "ball", ticker: "BALL", name: "Ball Corporation", role: "major producer of aluminum beverage packaging serving global beverage companies; represented as part of PepsiCo’s can-supply ecosystem" },
    { id: "pep_utilities", ticker: null, name: "Water, Energy & Plant Utilities", role: "large food-and-beverage plants require treated water, electricity, fuel, refrigeration and process utilities" },

    // UPSTREAM LAYER -2 — MANUFACTURING
    { id: "pep_bevplants", ticker: null, name: "PepsiCo Beverage Manufacturing", role: "plants mix, fill, package and quality-test beverages, concentrates and syrups" },
    { id: "pep_foodplants", ticker: null, name: "Frito-Lay / Foods Manufacturing", role: "plants wash, cook, season, bake and package snack and food products" },
    { id: "pep_bottlers", ticker: null, name: "Company-Owned & Independent Bottling System", role: "bottlers convert concentrate or beverage inputs into finished packaged products in selected markets" },

    // UPSTREAM LAYER -1 — DISTRIBUTION
    { id: "pep_dsd", ticker: null, name: "Direct-Store-Delivery Network", role: "PepsiCo route systems deliver high-velocity beverages and snacks directly to retail locations" },
    { id: "pep_warehouse", ticker: null, name: "Warehouse & Distributor Network", role: "warehouse delivery, independent distributors and e-commerce fulfillment serve larger and lower-frequency channels" },
    { id: "pep_foodservice", ticker: null, name: "Foodservice Distribution", role: "restaurant, convenience, vending and institutional channels receive beverage and snack products through dedicated systems" },

    // CENTER
    { id: "pep", ticker: "PEP", name: "PepsiCo", role: "global food-and-beverage company operating brands including Pepsi, Gatorade, Lay’s, Doritos, Cheetos and Quaker" },

    // DOWNSTREAM LAYER +1 — RETAIL / CUSTOMER CHANNELS
    { id: "wmt", ticker: "WMT", name: "Walmart", role: "PepsiCo’s largest disclosed customer; Walmart and affiliates represented about 14% of consolidated 2025 net revenue" },
    { id: "pep_grocery", ticker: null, name: "Grocery, Club & Mass Retail", role: "large retailers purchase packaged beverages, snacks and foods for store and e-commerce resale" },
    { id: "pep_cstore", ticker: null, name: "Convenience, Foodservice & Vending", role: "restaurants, convenience stores, stadiums, schools and vending channels distribute PepsiCo products" },

    // DOWNSTREAM LAYER +2 — CONSUMER DEMAND
    { id: "pep_consumers", ticker: null, name: "Consumers", role: "households and on-the-go customers purchase and consume PepsiCo beverages, snacks and foods" },
  ],

  edges: [
    // AGRICULTURE → PACKAGING / PROCESS
    { source: "pep_potatoes", target: "pep_foodplants" },
    { source: "pep_corn", target: "pep_foodplants" },
    { source: "pep_oils", target: "pep_foodplants" },
    { source: "pep_sweeteners", target: "pep_bevplants" },

    // PACKAGING → MANUFACTURING
    { source: "pep_pack", target: "pep_bevplants" },
    { source: "pep_pack", target: "pep_foodplants" },
    { source: "ball", target: "pep_bevplants" },

    // UTILITIES → MANUFACTURING
    { source: "pep_utilities", target: "pep_bevplants" },
    { source: "pep_utilities", target: "pep_foodplants" },

    // MANUFACTURING → DISTRIBUTION
    { source: "pep_bevplants", target: "pep_dsd" },
    { source: "pep_bevplants", target: "pep_bottlers" },
    { source: "pep_foodplants", target: "pep_dsd" },
    { source: "pep_foodplants", target: "pep_warehouse" },
    { source: "pep_bottlers", target: "pep_foodservice" },

    // DISTRIBUTION → PEPSICO
    { source: "pep_dsd", target: "pep" },
    { source: "pep_warehouse", target: "pep" },
    { source: "pep_foodservice", target: "pep" },

    // PEPSICO → RETAIL / CHANNEL
    { source: "pep", target: "wmt" },
    { source: "pep", target: "pep_grocery" },
    { source: "pep", target: "pep_cstore" },

    // CHANNEL → CONSUMERS
    { source: "wmt", target: "pep_consumers" },
    { source: "pep_grocery", target: "pep_consumers" },
    { source: "pep_cstore", target: "pep_consumers" },

  ]
},

ABT: {
  name: "Abbott Laboratories",
  root: "abt",
  nodes: [
    // UPSTREAM LAYER -4 — PRODUCT INPUTS
    { id: "abt_bio", ticker: null, name: "Biological Reagents, Chemicals & Assay Inputs", role: "antibodies, enzymes, reagents and chemical materials support diagnostic assays and pharmaceutical production" },
    { id: "abt_electronics", ticker: null, name: "Sensors, Semiconductors & Electronic Components", role: "electronics, sensors and communications components are incorporated into diagnostic and medical-device platforms" },
    { id: "abt_nutrition", ticker: null, name: "Dairy, Protein, Oils, Vitamins & Nutrition Ingredients", role: "food-grade ingredients feed Abbott pediatric, adult and therapeutic nutrition manufacturing" },
    { id: "abt_medmat", ticker: null, name: "Medical-Grade Metals, Polymers & Packaging", role: "specialty metals, polymers, tubing and sterile packaging support cardiovascular and other device production" },

    // UPSTREAM LAYER -3 — SEGMENT MANUFACTURING
    { id: "abt_diag_mfg", ticker: null, name: "Diagnostics Manufacturing", role: "Abbott produces analyzers, test cartridges, reagents and point-of-care systems for laboratories and care sites" },
    { id: "abt_device_mfg", ticker: null, name: "Medical Device Manufacturing", role: "manufacturing sites build cardiovascular, neuromodulation and diabetes-care products including FreeStyle Libre systems" },
    { id: "abt_nutri_mfg", ticker: null, name: "Nutrition Manufacturing", role: "plants blend, process, package and quality-test infant, adult and therapeutic nutrition products" },
    { id: "abt_pharma_mfg", ticker: null, name: "Established Pharmaceutical Manufacturing", role: "Abbott manufactures branded generic pharmaceutical products for markets outside the United States" },

    // UPSTREAM LAYER -2 — QUALITY / STERILE PROCESSING
    { id: "abt_qc", ticker: null, name: "Quality Control, Calibration & Release", role: "regulated quality systems test products, validate equipment and release finished lots for sale" },
    { id: "abt_sterile", ticker: null, name: "Sterilization & Controlled Manufacturing", role: "sterile and controlled production steps prepare invasive devices, diagnostics and selected pharmaceutical products" },
    { id: "abt_pack", ticker: null, name: "Packaging & Labeling", role: "finished products are labeled and packaged for clinical, retail and institutional channels" },

    // UPSTREAM LAYER -1 — GLOBAL DISTRIBUTION
    { id: "abt_dc", ticker: null, name: "Abbott Distribution Centers & Public Warehouses", role: "Abbott-owned distribution centers and public warehouses fulfill products across its four reporting segments" },
    { id: "abt_3pdist", ticker: null, name: "Third-Party Distributor Network", role: "third-party distributors extend Abbott reach to laboratories, hospitals, retailers and healthcare providers worldwide" },

    // CENTER
    { id: "abt", ticker: "ABT", name: "Abbott Laboratories", role: "diversified healthcare company operating established pharmaceuticals, diagnostics, nutrition and medical-device businesses" },

    // DOWNSTREAM LAYER +1 — CARE / RETAIL CHANNELS
    { id: "abt_hospitals", ticker: null, name: "Hospitals, Labs & Ambulatory Centers", role: "care sites purchase diagnostics, cardiovascular devices and other Abbott products directly or through distributors" },
    { id: "abt_retail", ticker: null, name: "Wholesalers, Pharmacies & Retailers", role: "retail and wholesale channels distribute nutrition, diabetes-care and selected pharmaceutical products" },
    { id: "abt_clinicians", ticker: null, name: "Physicians & Healthcare Professionals", role: "clinicians select, implant, prescribe or recommend Abbott devices, diagnostics and nutrition products" },

    // DOWNSTREAM LAYER +2 — END USERS
    { id: "abt_patients", ticker: null, name: "Patients & Consumers", role: "patients and consumers use Abbott monitoring, diagnostic, nutrition and medical-device products" },
  ],

  edges: [
    // INPUTS → SEGMENT MANUFACTURING
    { source: "abt_bio", target: "abt_diag_mfg" },
    { source: "abt_bio", target: "abt_pharma_mfg" },
    { source: "abt_electronics", target: "abt_device_mfg" },
    { source: "abt_nutrition", target: "abt_nutri_mfg" },
    { source: "abt_medmat", target: "abt_device_mfg" },

    // MANUFACTURING → QUALITY / PACKAGING
    { source: "abt_diag_mfg", target: "abt_qc" },
    { source: "abt_device_mfg", target: "abt_sterile" },
    { source: "abt_nutri_mfg", target: "abt_pack" },
    { source: "abt_pharma_mfg", target: "abt_qc" },

    // STERILE / QC → PACKAGING
    { source: "abt_sterile", target: "abt_pack" },
    { source: "abt_qc", target: "abt_pack" },

    // PACKAGING → DISTRIBUTION
    { source: "abt_pack", target: "abt_dc" },
    { source: "abt_pack", target: "abt_3pdist" },

    // DISTRIBUTION → ABBOTT
    { source: "abt_dc", target: "abt" },
    { source: "abt_3pdist", target: "abt" },

    // ABBOTT → CHANNELS
    { source: "abt", target: "abt_hospitals" },
    { source: "abt", target: "abt_retail" },
    { source: "abt", target: "abt_clinicians" },

    // CHANNELS → END USERS
    { source: "abt_hospitals", target: "abt_patients" },
    { source: "abt_retail", target: "abt_patients" },
    { source: "abt_clinicians", target: "abt_patients" },

  ]
},

T: {
  name: "AT&T",
  root: "t",
  nodes: [
    // UPSTREAM LAYER -4 — FIBER / COMPUTE COMPONENTS
    { id: "glw", ticker: "GLW", name: "Corning", role: "fiber and optical-connectivity supplier participating in AT&T’s open-network and broadband infrastructure ecosystem" },
    { id: "intc", ticker: "INTC", name: "Intel", role: "compute-silicon supplier supporting AT&T Cloud RAN testing and open, software-centric network infrastructure" },
    { id: "dell", ticker: "DELL", name: "Dell Technologies", role: "open-network ecosystem supplier identified by AT&T as part of its multi-vendor Open RAN supplier base" },

    // UPSTREAM LAYER -3 — RADIO / OPEN RAN EQUIPMENT
    { id: "eric", ticker: "ERIC", name: "Ericsson", role: "lead AT&T Open RAN modernization partner under a multiyear agreement with spend that could approach $14 billion over five years" },
    { id: "fujhy", ticker: "FUJHY", name: "Fujitsu", role: "Open RAN radio supplier whose 1Finity radios have been integrated with Ericsson basebands on AT&T’s commercial network" },
    { id: "nok", ticker: "NOK", name: "Nokia", role: "legacy and continuing telecom-equipment vendor in AT&T’s broader multi-vendor network ecosystem" },

    // UPSTREAM LAYER -2 — ACCESS / TRANSPORT BUILD
    { id: "t_ran", ticker: null, name: "AT&T Wireless RAN Modernization", role: "open-capable radios, basebands and Cloud RAN software are deployed across AT&T macro and small-cell sites" },
    { id: "t_fiber", ticker: null, name: "AT&T Fiber Access Network", role: "fiber, passive optical equipment, central-office electronics and field construction create last-mile broadband capacity" },
    { id: "t_core", ticker: null, name: "IP Backbone, Core & Edge Cloud", role: "routing, switching, packet core, security and edge compute move traffic across national infrastructure" },

    // UPSTREAM LAYER -1 — OPERATED NETWORK
    { id: "t_wireless", ticker: null, name: "Nationwide Wireless Network", role: "spectrum, RAN, transport and core infrastructure deliver mobile voice and data coverage" },
    { id: "t_broadband", ticker: null, name: "Fiber Broadband Network", role: "AT&T operates multi-gigabit fiber access and backbone infrastructure for residential and business customers" },
    { id: "t_businessnet", ticker: null, name: "Enterprise Connectivity Platform", role: "managed networking, security, voice and IoT services combine AT&T network assets into business solutions" },

    // CENTER
    { id: "t", ticker: "T", name: "AT&T", role: "U.S. communications company centered on nationwide wireless, fiber broadband and enterprise connectivity services" },

    // DOWNSTREAM LAYER +1 — CUSTOMER SEGMENTS
    { id: "t_consumer", ticker: null, name: "Consumer Mobility", role: "households and individuals purchase postpaid, prepaid and connected-device wireless plans" },
    { id: "t_fibercust", ticker: null, name: "Consumer Fiber", role: "residential customers purchase multi-gigabit broadband and related services" },
    { id: "t_enterprise", ticker: null, name: "Business, Government & Wholesale", role: "enterprises and public-sector organizations buy connectivity, managed networking, IoT and wholesale services" },

    // DOWNSTREAM LAYER +2 — END USE
    { id: "t_end", ticker: null, name: "People, Applications & Connected Devices", role: "end users consume communications, cloud access, streaming, collaboration and machine connectivity over AT&T networks" },
  ],

  edges: [
    // COMPONENTS → EQUIPMENT
    { source: "intc", target: "eric" },
    { source: "dell", target: "t_core" },
    { source: "glw", target: "t_fiber" },

    // EQUIPMENT → ACCESS / TRANSPORT
    { source: "eric", target: "t_ran" },
    { source: "fujhy", target: "t_ran" },
    { source: "nok", target: "t_ran" },

    // ACCESS / TRANSPORT → OPERATED NETWORK
    { source: "t_ran", target: "t_wireless" },
    { source: "t_fiber", target: "t_broadband" },
    { source: "t_core", target: "t_businessnet" },

    // OPERATED NETWORK → AT&T
    { source: "t_wireless", target: "t" },
    { source: "t_broadband", target: "t" },
    { source: "t_businessnet", target: "t" },

    // AT&T → CUSTOMER SEGMENTS
    { source: "t", target: "t_consumer" },
    { source: "t", target: "t_fibercust" },
    { source: "t", target: "t_enterprise" },

    // CUSTOMERS → END USE
    { source: "t_consumer", target: "t_end" },
    { source: "t_fibercust", target: "t_end" },
    { source: "t_enterprise", target: "t_end" },

  ]
},

SCHW: {
  name: "Charles Schwab",
  root: "schw",
  nodes: [
    // UPSTREAM LAYER -4 — MARKET INFRASTRUCTURE
    { id: "ice", ticker: "ICE", name: "Intercontinental Exchange", role: "exchange, market-data and clearing infrastructure provider operating the NYSE and other trading venues used across U.S. capital markets" },
    { id: "ndaq", ticker: "NDAQ", name: "Nasdaq", role: "U.S. exchange and market-data infrastructure supporting equity and options trading accessible to brokerage clients" },
    { id: "cme", ticker: "CME", name: "CME Group", role: "futures and derivatives exchange and clearing infrastructure used by market participants and brokerage clients" },
    { id: "cboe", ticker: "CBOE", name: "Cboe Global Markets", role: "equity, options and derivatives exchange infrastructure supporting execution and market data" },

    // UPSTREAM LAYER -3 — EXECUTION / INTERMEDIARIES
    { id: "schw_mm", ticker: null, name: "Market Makers, Dealers & Liquidity Providers", role: "Schwab relies on market makers and dealers to execute client equity, option and fixed-income transactions" },
    { id: "virt", ticker: "VIRT", name: "Virtu Financial", role: "public market-making and execution firm representative of the electronic liquidity providers used in U.S. brokerage markets" },
    { id: "schw_clearing", ticker: null, name: "Clearing Houses & Custodians", role: "clearing and custody infrastructure settles securities transactions and holds client and firm assets" },

    // UPSTREAM LAYER -2 — BROKERAGE OPERATIONS
    { id: "schw_order", ticker: null, name: "Order Routing & Trade Processing", role: "Schwab systems route client orders to exchanges and market makers, capture executions and manage confirmations" },
    { id: "schw_custody", ticker: null, name: "Custody, Cash & Securities Processing", role: "custody systems safeguard assets, process corporate actions and support cash and securities movements" },
    { id: "schw_advice", ticker: null, name: "Advisory & Portfolio Infrastructure", role: "portfolio, planning and managed-account systems support Schwab wealth and advisory services" },

    // UPSTREAM LAYER -1 — CLIENT PLATFORM
    { id: "schw_digital", ticker: null, name: "Schwab Digital Brokerage Platform", role: "web, mobile, trading and account systems provide retail clients access to markets and financial products" },
    { id: "schw_ria", ticker: null, name: "Schwab Advisor Services Custody Platform", role: "technology and custody services support independent registered investment advisers and their end clients" },
    { id: "schw_workplace", ticker: null, name: "Workplace Financial Services", role: "retirement-plan, stock-plan and workplace financial platforms connect employers and employees to Schwab services" },

    // CENTER
    { id: "schw", ticker: "SCHW", name: "Charles Schwab", role: "financial-services company providing brokerage, banking, custody, advisory and workplace financial services" },

    // DOWNSTREAM LAYER +1 — CLIENT SEGMENTS
    { id: "schw_retail", ticker: null, name: "Retail Investors", role: "individual investors hold cash and securities, trade, save and use advisory products through Schwab accounts" },
    { id: "schw_advisors", ticker: null, name: "Independent RIAs", role: "registered investment advisers custody client assets and operate practices using Schwab Advisor Services" },
    { id: "schw_employees", ticker: null, name: "Workplace Participants", role: "employees use retirement and stock-plan services administered through Schwab workplace platforms" },

    // DOWNSTREAM LAYER +2 — CAPITAL ALLOCATION
    { id: "schw_markets", ticker: null, name: "Stocks, Bonds, ETFs, Funds & Cash Products", role: "client assets are allocated across public markets, investment products and cash or banking solutions" },
  ],

  edges: [
    // MARKET INFRASTRUCTURE → EXECUTION
    { source: "ice", target: "schw_mm" },
    { source: "ndaq", target: "schw_mm" },
    { source: "cme", target: "schw_mm" },
    { source: "cboe", target: "schw_mm" },
    { source: "ice", target: "schw_clearing" },
    { source: "cme", target: "schw_clearing" },
    { source: "virt", target: "schw_order" },

    // EXECUTION → BROKERAGE OPERATIONS
    { source: "schw_mm", target: "schw_order" },
    { source: "schw_clearing", target: "schw_custody" },

    // BROKERAGE OPERATIONS → CLIENT PLATFORM
    { source: "schw_order", target: "schw_digital" },
    { source: "schw_custody", target: "schw_ria" },
    { source: "schw_advice", target: "schw_digital" },
    { source: "schw_advice", target: "schw_ria" },
    { source: "schw_custody", target: "schw_workplace" },

    // CLIENT PLATFORM → SCHWAB
    { source: "schw_digital", target: "schw" },
    { source: "schw_ria", target: "schw" },
    { source: "schw_workplace", target: "schw" },

    // SCHWAB → CLIENTS
    { source: "schw", target: "schw_retail" },
    { source: "schw", target: "schw_advisors" },
    { source: "schw", target: "schw_employees" },

    // CLIENTS → CAPITAL ALLOCATION
    { source: "schw_retail", target: "schw_markets" },
    { source: "schw_advisors", target: "schw_markets" },
    { source: "schw_employees", target: "schw_markets" },

  ]
},

ETN: {
  name: "Eaton",
  root: "etn",
  nodes: [
    // UPSTREAM LAYER -4 — MATERIALS & ELECTRONIC INPUTS
    { id: "etn_copper", ticker: null, name: "Copper & Conductive Materials", role: "copper and conductive metals are fundamental inputs for busway, switchgear, transformers, connectors and power-distribution equipment" },
    { id: "etn_metals", ticker: null, name: "Steel, Aluminum & Specialty Alloys", role: "fabricated metals form enclosures, structural parts, gears, hydraulic components and aerospace hardware" },
    { id: "etn_electronics", ticker: null, name: "Power Semiconductors & Electronic Components", role: "semiconductors, controls, sensors and circuit components enable protection, conversion and digital power-management functions" },
    { id: "etn_polymers", ticker: null, name: "Insulation, Polymers & Engineered Materials", role: "insulating and engineered materials support safe high-voltage operation, sealing and mechanical durability" },

    // UPSTREAM LAYER -3 — COMPONENT MANUFACTURING
    { id: "etn_switchgear", ticker: null, name: "Switchgear, Breakers & Busway Components", role: "electrical protection and distribution components are fabricated for utility, commercial and data-center systems" },
    { id: "etn_powerconv", ticker: null, name: "UPS, Power Conversion & Energy Storage Components", role: "power-electronics assemblies condition and back up electricity for mission-critical infrastructure" },
    { id: "etn_aero_components", ticker: null, name: "Hydraulic, Fuel & Aerospace Components", role: "precision components support aircraft hydraulic, fuel, oxygen, motion-control and conveyance systems" },
    { id: "etn_mobility_components", ticker: null, name: "Vehicle Drivetrain & Electrical Components", role: "transmission, differential, electrical and protection components support commercial and electrified vehicles" },

    // UPSTREAM LAYER -2 — SYSTEM INTEGRATION
    { id: "etn_datacenter_systems", ticker: null, name: "Grid-to-Chip Data Center Power Systems", role: "switchgear, UPS, busway, energy storage, controls and cooling interfaces are integrated for high-density data centers" },
    { id: "etn_grid_systems", ticker: null, name: "Utility & Distributed-Energy Systems", role: "medium-voltage equipment, protection, controls and software are integrated into utility and distributed-energy architectures" },
    { id: "etn_aero_systems", ticker: null, name: "Aircraft Fluid & Motion-Control Systems", role: "hydraulic, fuel, oxygen and actuation components are integrated into aircraft-level systems" },
    { id: "etn_industrial_systems", ticker: null, name: "Industrial Power Management Systems", role: "motor control, automation, safety and electrical-distribution products are integrated for factories and commercial facilities" },

    // UPSTREAM LAYER -1 — DEPLOYMENT / SERVICE
    { id: "etn_projects", ticker: null, name: "Project Engineering & Deployment", role: "Eaton engineers and commissions electrical architectures for data centers, utilities, industrial sites and buildings" },
    { id: "etn_digital", ticker: null, name: "Brightlayer Digital Power Management", role: "software, monitoring and controls add operational intelligence to installed electrical assets" },
    { id: "etn_aftermarket", ticker: null, name: "Aerospace & Industrial Aftermarket", role: "repair, overhaul, spares and field-service channels support installed Eaton equipment" },

    // CENTER
    { id: "etn", ticker: "ETN", name: "Eaton", role: "intelligent power-management company supplying electrical, aerospace, mobility and digital solutions across data centers, utilities, industry and transportation" },

    // DOWNSTREAM LAYER +1 — CORE END MARKETS
    { id: "etn_dc", ticker: null, name: "AI Data Centers & Cloud Infrastructure", role: "operators deploy Eaton power-distribution, backup, controls and cooling-enablement systems from the grid to high-density compute racks" },
    { id: "etn_utilities", ticker: null, name: "Utilities & Energy Infrastructure", role: "grid operators use Eaton equipment for protection, distribution, resilience and distributed-energy integration" },
    { id: "etn_aerospace", ticker: null, name: "Commercial & Defense Aerospace", role: "airframers, airlines and MRO providers use Eaton fluid, motion-control and electrical products" },
    { id: "etn_industry", ticker: null, name: "Industrial, Commercial & Mobility Customers", role: "factories, buildings and vehicle manufacturers use Eaton electrical and mechanical systems" },

    // DOWNSTREAM LAYER +2 — END SYSTEMS
    { id: "etn_ai_end", ticker: null, name: "AI Factories & Digital Infrastructure", role: "Eaton power architectures support deployment and operation of next-generation accelerated-computing facilities" },
    { id: "etn_aircraft_end", ticker: null, name: "Aircraft Fleets & MRO Operations", role: "Eaton aerospace systems remain in service through aircraft operating and maintenance cycles" },
    { id: "etn_grid_end", ticker: null, name: "Resilient Grids, Buildings & Factories", role: "installed systems distribute, protect and manage electricity for end users" },

    // EXPANDED DENSITY — VERIFIED / HIGH-CONFIDENCE COMPANY NODES
    { id: "nvda", ticker: "NVDA", name: "NVIDIA", role: "Eaton collaborates with NVIDIA on grid-to-chip architectures and the Vera Rubin DSX AI Factory reference design" },
    { id: "tt", ticker: "TT", name: "Trane Technologies", role: "Eaton and Trane Technologies announced an integrated power-and-cooling reference design for NVIDIA-aligned AI data centers in 2026" },
    { id: "vsec", ticker: "VSEC", name: "VSE Corporation", role: "VSE Aviation is Eaton Aerospace’s first authorized independent service center in the Americas and also distributes Eaton fuel-pump products" },
  ],

  edges: [
    // MATERIALS → COMPONENTS
    { source: "etn_copper", target: "etn_switchgear" },
    { source: "etn_electronics", target: "etn_powerconv" },
    { source: "etn_metals", target: "etn_aero_components" },
    { source: "etn_polymers", target: "etn_aero_components" },
    { source: "etn_metals", target: "etn_mobility_components" },

    // COMPONENTS → SYSTEMS
    { source: "etn_switchgear", target: "etn_datacenter_systems" },
    { source: "etn_powerconv", target: "etn_datacenter_systems" },
    { source: "etn_switchgear", target: "etn_grid_systems" },
    { source: "etn_aero_components", target: "etn_aero_systems" },
    { source: "etn_mobility_components", target: "etn_industrial_systems" },

    // SYSTEMS → DEPLOYMENT
    { source: "etn_datacenter_systems", target: "etn_projects" },
    { source: "etn_grid_systems", target: "etn_projects" },
    { source: "etn_industrial_systems", target: "etn_digital" },
    { source: "etn_aero_systems", target: "etn_aftermarket" },

    // DEPLOYMENT → EATON
    { source: "etn_projects", target: "etn" },
    { source: "etn_digital", target: "etn" },
    { source: "etn_aftermarket", target: "etn" },

    // EATON → END MARKETS
    { source: "etn", target: "etn_dc" },
    { source: "etn", target: "etn_utilities" },
    { source: "etn", target: "etn_aerospace" },
    { source: "etn", target: "etn_industry" },

    // END MARKETS → END SYSTEMS
    { source: "etn_dc", target: "etn_ai_end" },
    { source: "etn_aerospace", target: "etn_aircraft_end" },
    { source: "etn_utilities", target: "etn_grid_end" },
    { source: "etn_industry", target: "etn_grid_end" },

    // EXPANDED DENSITY — VERIFIED RELATIONSHIPS
    { source: "nvda", target: "etn_dc" },
    { source: "tt", target: "etn_datacenter_systems" },
    { source: "etn_aftermarket", target: "vsec" },

  ]
},

WELL: {
  name: "Welltower",
  root: "well",
  nodes: [
    // UPSTREAM LAYER -4 — CAPITAL / REAL-ESTATE INPUTS
    { id: "well_equity", ticker: null, name: "Equity & Retained Capital", role: "equity capital and retained cash flow provide funding for acquisitions, development and portfolio reinvestment" },
    { id: "well_debt", ticker: null, name: "Debt & Credit Markets", role: "unsecured debt, term loans and revolving credit provide financing flexibility for property investment" },
    { id: "well_land", ticker: null, name: "Land & Property Acquisition Pipeline", role: "existing properties, development sites and portfolio opportunities form the asset-sourcing pipeline" },
    { id: "well_building_inputs", ticker: null, name: "Construction Materials & Building Systems", role: "structural, mechanical, electrical and interior systems support new development and redevelopment projects" },

    // UPSTREAM LAYER -3 — INVESTMENT / DEVELOPMENT
    { id: "well_acquire", ticker: null, name: "Property & Portfolio Acquisitions", role: "Welltower acquires seniors housing, outpatient medical and other healthcare-oriented real estate" },
    { id: "well_develop", ticker: null, name: "Development & Redevelopment", role: "capital projects create new communities and modernize existing properties" },
    { id: "well_capex", ticker: null, name: "Recurring Capital Improvements", role: "renovations, unit turns and building upgrades maintain competitiveness and operating quality" },

    // UPSTREAM LAYER -2 — PROPERTY PLATFORMS
    { id: "well_sho", ticker: null, name: "Seniors Housing Operating Portfolio", role: "communities operated under management arrangements form Welltower’s largest operating segment" },
    { id: "well_triple", ticker: null, name: "Triple-Net Healthcare Portfolio", role: "properties are leased to operators under long-term structures that place many operating obligations with tenants" },
    { id: "well_outpatient", ticker: null, name: "Outpatient Medical Portfolio", role: "medical-office and ambulatory properties serve physician groups, health systems and care providers" },

    // UPSTREAM LAYER -1 — OPERATIONS / ASSET MANAGEMENT
    { id: "well_operator_network", ticker: null, name: "Seniors Housing Operator Network", role: "Welltower relies on a diversified network of operating partners to manage seniors housing properties under management contracts" },
    { id: "well_asset_mgmt", ticker: null, name: "Welltower Asset Management", role: "capital allocation, leasing, portfolio management and operating oversight connect properties to company-level returns" },
    { id: "well_data", ticker: null, name: "Welltower Business System & Data Analytics", role: "data, benchmarking and operating systems support pricing, staffing, capital planning and portfolio optimization" },

    // CENTER
    { id: "well", ticker: "WELL", name: "Welltower", role: "healthcare real-estate company investing primarily in seniors housing, wellness housing and outpatient medical properties" },

    // DOWNSTREAM LAYER +1 — PROPERTY USERS
    { id: "well_residents", ticker: null, name: "Seniors Housing Residents", role: "older adults occupy independent living, assisted living, memory-care and related communities" },
    { id: "well_providers", ticker: null, name: "Physicians, Health Systems & Outpatient Providers", role: "medical tenants use Welltower facilities to deliver ambulatory and specialty care" },
    { id: "well_care_ops", ticker: null, name: "Post-Acute & Long-Term Care Operators", role: "healthcare operators occupy and manage facilities across Welltower’s triple-net and operating relationships" },

    // DOWNSTREAM LAYER +2 — END DEMAND
    { id: "well_families", ticker: null, name: "Older Adults & Families", role: "demographic aging and housing preferences drive demand for seniors housing and wellness-oriented properties" },
    { id: "well_patients", ticker: null, name: "Patients & Care Communities", role: "patients and local communities generate demand for accessible outpatient and post-acute care real estate" },

    // EXPANDED DENSITY — VERIFIED / HIGH-CONFIDENCE OPERATING RELATIONSHIPS
    { id: "well_top_ops", ticker: null, name: "Major Disclosed Operating Relationships", role: "Welltower’s 2025 filings identify Cogir, Care UK, Sunrise, Integra and Oakmont among its largest operating or tenant relationships; represented as one operating-network node rather than separate private-company ticker nodes" },
  ],

  edges: [
    // CAPITAL / REAL ESTATE → INVESTMENT
    { source: "well_equity", target: "well_acquire" },
    { source: "well_debt", target: "well_acquire" },
    { source: "well_land", target: "well_develop" },
    { source: "well_building_inputs", target: "well_develop" },
    { source: "well_equity", target: "well_capex" },

    // INVESTMENT → PROPERTY PLATFORMS
    { source: "well_acquire", target: "well_sho" },
    { source: "well_acquire", target: "well_triple" },
    { source: "well_acquire", target: "well_outpatient" },
    { source: "well_develop", target: "well_sho" },
    { source: "well_capex", target: "well_sho" },
    { source: "well_capex", target: "well_outpatient" },

    // PROPERTY PLATFORMS → OPERATIONS
    { source: "well_sho", target: "well_operator_network" },
    { source: "well_triple", target: "well_asset_mgmt" },
    { source: "well_outpatient", target: "well_asset_mgmt" },
    { source: "well_sho", target: "well_data" },

    // OPERATIONS → WELLTOWER
    { source: "well_operator_network", target: "well" },
    { source: "well_asset_mgmt", target: "well" },
    { source: "well_data", target: "well" },

    // WELLTOWER → PROPERTY USERS
    { source: "well", target: "well_residents" },
    { source: "well", target: "well_providers" },
    { source: "well", target: "well_care_ops" },

    // PROPERTY USERS → END DEMAND
    { source: "well_residents", target: "well_families" },
    { source: "well_providers", target: "well_patients" },
    { source: "well_care_ops", target: "well_patients" },

    // EXPANDED DENSITY — DISCLOSED OPERATING NETWORK
    { source: "well_top_ops", target: "well_operator_network" },

  ]
},

MCD: {
  name: "McDonald's",
  root: "mcd",
  nodes: [
    // UPSTREAM LAYER -4 — AGRICULTURAL INPUTS
    { id: "mcd_potatoes", ticker: null, name: "Potato Farms", role: "potato growers supply raw potatoes that are processed into McDonald’s french fries and hash browns" },
    { id: "mcd_beef", ticker: null, name: "Beef Cattle & Protein Inputs", role: "livestock and protein supply chains provide raw material for burger patties and other menu items" },
    { id: "mcd_poultry", ticker: null, name: "Poultry & Egg Inputs", role: "poultry farms provide chicken and egg inputs used across McDonald’s menu" },
    { id: "mcd_grains_dairy", ticker: null, name: "Grains, Dairy & Beverage Ingredients", role: "wheat, dairy, sweeteners and beverage ingredients feed bakery, cheese, dessert and drink supply chains" },

    // UPSTREAM LAYER -3 — FOOD / BEVERAGE PROCESSING
    { id: "lw", ticker: "LW", name: "Lamb Weston", role: "McDonald’s identifies Lamb Weston as a trusted potato processor that converts farm potatoes into french fries" },
    { id: "mcd_beef_processors", ticker: null, name: "Beef Processing Network", role: "approved processors convert inspected beef into standardized patties for restaurant distribution" },
    { id: "mcd_poultry_processors", ticker: null, name: "Chicken & Protein Processing Network", role: "approved suppliers process chicken and other proteins to McDonald’s specifications" },
    { id: "ko", ticker: "KO", name: "Coca-Cola", role: "long-standing beverage-system supplier supporting fountain drinks and beverage products across McDonald’s restaurants" },

    // UPSTREAM LAYER -2 — PACKAGING / DISTRIBUTION
    { id: "mcd_packaging", ticker: null, name: "Foodservice Packaging", role: "cups, cartons, wrappers, bags and other packaging protect food and support restaurant operations" },
    { id: "mcd_distribution", ticker: null, name: "Distribution Centers", role: "dedicated foodservice distribution centers consolidate products from many suppliers for restaurant delivery" },
    { id: "mcd_coldchain", ticker: null, name: "Refrigerated & Frozen Logistics", role: "temperature-controlled transportation moves proteins, potatoes, dairy and other perishable products safely to restaurants" },

    // UPSTREAM LAYER -1 — RESTAURANT OPERATIONS
    { id: "mcd_franchise_supply", ticker: null, name: "Franchisee Supply & Procurement", role: "approved products flow through McDonald’s supply standards into independently operated franchised restaurants" },
    { id: "mcd_company_ops", ticker: null, name: "Company-Operated Restaurants", role: "McDonald’s directly operated locations procure standardized food, packaging and equipment through the same broader system" },
    { id: "mcd_digital_ops", ticker: null, name: "Digital Ordering & Restaurant Technology", role: "POS, app, loyalty and kitchen technology coordinate ordering, production and fulfillment" },

    // CENTER
    { id: "mcd", ticker: "MCD", name: "McDonald's", role: "global restaurant system built primarily around franchised restaurants, standardized sourcing, branded menu products and digital ordering" },

    // DOWNSTREAM LAYER +1 — SALES / FULFILLMENT CHANNELS
    { id: "mcd_restaurants", ticker: null, name: "Restaurant, Drive-Thru & Pickup", role: "physical restaurants fulfill dine-in, drive-thru, counter and mobile-pickup orders" },
    { id: "uber", ticker: "UBER", name: "Uber", role: "Uber Eats is a long-term McDelivery partner and fulfills delivery orders for participating McDonald’s restaurants" },
    { id: "dash", ticker: "DASH", name: "DoorDash", role: "DoorDash is a long-term McDelivery partner and fulfills delivery orders for participating McDonald’s restaurants" },
    { id: "mcd_app", ticker: null, name: "McDonald’s App & Loyalty", role: "digital ordering and loyalty connect customers directly to participating restaurants and fulfillment options" },

    // DOWNSTREAM LAYER +2 — END CONSUMERS
    { id: "mcd_consumers", ticker: null, name: "Restaurant & Delivery Customers", role: "consumers purchase McDonald’s meals through restaurants, drive-thru, pickup and delivery channels" },
  ],

  edges: [
    // AGRICULTURE → PROCESSING
    { source: "mcd_potatoes", target: "lw" },
    { source: "mcd_beef", target: "mcd_beef_processors" },
    { source: "mcd_poultry", target: "mcd_poultry_processors" },
    { source: "mcd_grains_dairy", target: "ko" },

    // PROCESSING → DISTRIBUTION
    { source: "lw", target: "mcd_distribution" },
    { source: "mcd_beef_processors", target: "mcd_coldchain" },
    { source: "mcd_poultry_processors", target: "mcd_coldchain" },
    { source: "ko", target: "mcd_distribution" },
    { source: "mcd_beef_processors", target: "mcd_packaging" },

    // DISTRIBUTION → RESTAURANT OPERATIONS
    { source: "mcd_distribution", target: "mcd_franchise_supply" },
    { source: "mcd_distribution", target: "mcd_company_ops" },
    { source: "mcd_coldchain", target: "mcd_franchise_supply" },
    { source: "mcd_packaging", target: "mcd_company_ops" },

    // RESTAURANT OPERATIONS → MCDONALD’S
    { source: "mcd_franchise_supply", target: "mcd" },
    { source: "mcd_company_ops", target: "mcd" },
    { source: "mcd_digital_ops", target: "mcd" },

    // MCDONALD’S → FULFILLMENT
    { source: "mcd", target: "mcd_restaurants" },
    { source: "mcd", target: "uber" },
    { source: "mcd", target: "dash" },
    { source: "mcd", target: "mcd_app" },

    // FULFILLMENT → CONSUMERS
    { source: "mcd_restaurants", target: "mcd_consumers" },
    { source: "uber", target: "mcd_consumers" },
    { source: "dash", target: "mcd_consumers" },
    { source: "mcd_app", target: "mcd_consumers" },

  ]
},

BLK: {
  name: "BlackRock",
  root: "blk",
  nodes: [
    // UPSTREAM LAYER -4 — MARKET / TECHNOLOGY INFRASTRUCTURE
    { id: "msft", ticker: "MSFT", name: "Microsoft", role: "strategic BlackRock technology partner; Microsoft Azure hosts Aladdin infrastructure and environments for BlackRock and external Aladdin clients" },
    { id: "amzn", ticker: "AMZN", name: "Amazon", role: "Amazon Web Services is a cloud-hosting platform used for Aladdin infrastructure and external-client environments" },
    { id: "ice", ticker: "ICE", name: "Intercontinental Exchange", role: "exchange, clearing and market-data infrastructure representative of the public-market ecosystem that investment platforms connect to" },
    { id: "ndaq", ticker: "NDAQ", name: "Nasdaq", role: "exchange and market-data infrastructure supporting public-market pricing and execution workflows" },

    // UPSTREAM LAYER -3 — DATA / COMPUTE PLATFORM
    { id: "blk_aladdin_cloud", ticker: null, name: "Aladdin Cloud Infrastructure", role: "cloud compute, storage, databases and resilient environments host Aladdin analytics and operating workflows" },
    { id: "blk_market_data", ticker: null, name: "Market, Reference & Risk Data", role: "pricing, security-master, benchmark and risk inputs feed portfolio analytics and investment processes" },
    { id: "blk_connectivity", ticker: null, name: "Trading & Custody Connectivity", role: "electronic interfaces connect BlackRock systems with brokers, venues, custodians and market infrastructure" },

    // UPSTREAM LAYER -2 — INVESTMENT OPERATING SYSTEM
    { id: "blk_aladdin", ticker: null, name: "Aladdin Investment Platform", role: "portfolio management, risk analytics, trading and operations technology supports BlackRock and external institutional clients" },
    { id: "blk_risk", ticker: null, name: "Risk & Portfolio Analytics", role: "models measure exposures, scenarios, liquidity and portfolio construction across asset classes" },
    { id: "blk_trading", ticker: null, name: "Execution & Investment Operations", role: "order management, trade processing and post-trade workflows connect portfolios to markets" },

    // UPSTREAM LAYER -1 — PRODUCT / MANDATE ASSEMBLY
    { id: "blk_ishares", ticker: null, name: "iShares ETF Platform", role: "portfolio construction, indexing, trading and fund operations create exchange-traded investment products" },
    { id: "blk_active", ticker: null, name: "Active & Index Institutional Mandates", role: "investment teams package public- and private-market strategies for institutional separately managed accounts and pooled vehicles" },
    { id: "blk_aladdin_client", ticker: null, name: "Aladdin Client Solutions", role: "technology, implementation and servicing teams deliver Aladdin capabilities to external financial institutions" },

    // CENTER
    { id: "blk", ticker: "BLK", name: "BlackRock", role: "global asset manager and financial-technology provider offering ETFs, index and active strategies, private markets and the Aladdin platform" },

    // DOWNSTREAM LAYER +1 — CLIENT CHANNELS
    { id: "blk_institutional", ticker: null, name: "Pensions, Insurers & Sovereign Institutions", role: "large asset owners allocate capital to BlackRock mandates, funds and risk-management services" },
    { id: "blk_wealth", ticker: null, name: "Wealth Platforms, Advisors & Brokerage Channels", role: "financial intermediaries distribute iShares and other BlackRock products to end investors" },
    { id: "blk_aladdin_users", ticker: null, name: "Banks, Asset Managers & Other Aladdin Clients", role: "external institutions use Aladdin for investment, risk and operating workflows" },

    // DOWNSTREAM LAYER +2 — BENEFICIARIES / END USERS
    { id: "blk_endinvestors", ticker: null, name: "Retirement Savers & Individual Investors", role: "end investors gain exposure to markets through funds, ETFs, retirement plans and advisory portfolios" },
    { id: "blk_enterprise_users", ticker: null, name: "Institutional Investment Teams", role: "portfolio managers, risk teams, traders and operations staff use Aladdin to manage institutional assets" },
  ],

  edges: [
    // INFRASTRUCTURE → DATA / COMPUTE
    { source: "msft", target: "blk_aladdin_cloud" },
    { source: "amzn", target: "blk_aladdin_cloud" },
    { source: "ice", target: "blk_market_data" },
    { source: "ndaq", target: "blk_market_data" },
    { source: "ice", target: "blk_connectivity" },
    { source: "ndaq", target: "blk_connectivity" },

    // DATA / COMPUTE → OPERATING SYSTEM
    { source: "blk_aladdin_cloud", target: "blk_aladdin" },
    { source: "blk_market_data", target: "blk_risk" },
    { source: "blk_connectivity", target: "blk_trading" },

    // OPERATING SYSTEM → PRODUCTS / MANDATES
    { source: "blk_aladdin", target: "blk_ishares" },
    { source: "blk_risk", target: "blk_active" },
    { source: "blk_trading", target: "blk_ishares" },
    { source: "blk_aladdin", target: "blk_aladdin_client" },

    // PRODUCTS / MANDATES → BLACKROCK
    { source: "blk_ishares", target: "blk" },
    { source: "blk_active", target: "blk" },
    { source: "blk_aladdin_client", target: "blk" },

    // BLACKROCK → CLIENTS
    { source: "blk", target: "blk_institutional" },
    { source: "blk", target: "blk_wealth" },
    { source: "blk", target: "blk_aladdin_users" },

    // CLIENTS → END USERS
    { source: "blk_institutional", target: "blk_endinvestors" },
    { source: "blk_wealth", target: "blk_endinvestors" },
    { source: "blk_aladdin_users", target: "blk_enterprise_users" },

  ]
},

UNP: {
  name: "Union Pacific",
  root: "unp",
  nodes: [
    // UPSTREAM LAYER -4 — RAILROAD INPUTS
    { id: "unp_steel", ticker: null, name: "Rail Steel & Track Materials", role: "rail, tie plates, fasteners and other track materials form the physical guideway for railroad operations" },
    { id: "unp_ties", ticker: null, name: "Ties, Ballast & Right-of-Way Materials", role: "wood or concrete ties, ballast and civil materials support track geometry and load distribution" },
    { id: "unp_fuel", ticker: null, name: "Diesel Fuel, Lubricants & Energy", role: "fuel and energy inputs power locomotives, yards, terminals and support facilities" },
    { id: "unp_electronics", ticker: null, name: "Electronics, Sensors & Communications", role: "signaling, telemetry, communications and monitoring components support safe network operations" },

    // UPSTREAM LAYER -3 — RAIL EQUIPMENT / MAINTENANCE
    { id: "wab", ticker: "WAB", name: "Wabtec", role: "locomotive technology and modernization partner; Union Pacific and Wabtec announced a $1.2 billion fleet-modernization program in 2026" },
    { id: "unp_railcars", ticker: null, name: "Freight Cars & Intermodal Equipment", role: "railcars, containers and chassis provide the physical equipment used to move customer freight" },
    { id: "unp_track_maint", ticker: null, name: "Track & Signal Maintenance Equipment", role: "specialized equipment renews rail, ties, ballast, signals and communications infrastructure" },

    // UPSTREAM LAYER -2 — NETWORK ASSETS
    { id: "unp_locomotives", ticker: null, name: "Locomotive Fleet", role: "road and switching locomotives provide traction across Union Pacific’s western U.S. rail network" },
    { id: "unp_track", ticker: null, name: "Track, Signals & Dispatching", role: "mainline, branch, yard and signaling infrastructure provides network capacity and train control" },
    { id: "unp_terminals", ticker: null, name: "Yards & Intermodal Terminals", role: "classification yards and intermodal facilities consolidate, sort and transfer freight" },

    // UPSTREAM LAYER -1 — TRANSPORT OPERATIONS
    { id: "unp_manifest", ticker: null, name: "Manifest & Industrial Freight Operations", role: "scheduled trains move mixed freight including chemicals, metals, forest products and manufactured goods" },
    { id: "unp_intermodal", ticker: null, name: "Intermodal Operations", role: "container and trailer trains connect ports, inland terminals, truck carriers and distribution networks" },
    { id: "unp_bulk", ticker: null, name: "Bulk & Automotive Operations", role: "dedicated and unit-train networks move grain, energy products, automobiles and other high-volume commodities" },

    // CENTER
    { id: "unp", ticker: "UNP", name: "Union Pacific", role: "Class I freight railroad operating a large western U.S. network serving industrial, bulk, automotive and intermodal markets" },

    // DOWNSTREAM LAYER +1 — CUSTOMER CHANNELS
    { id: "unp_industrial", ticker: null, name: "Industrial & Chemical Shippers", role: "manufacturers and processors use rail for heavy, hazardous or high-volume freight" },
    { id: "unp_agri", ticker: null, name: "Agricultural & Bulk Shippers", role: "grain, fertilizer, food and commodity customers use rail for long-haul bulk transportation" },
    { id: "sndr", ticker: "SNDR", name: "Schneider National", role: "intermodal logistics partner; Union Pacific and Schneider expanded their rail partnership to shift long-haul freight from road to rail" },
    { id: "unp_auto", ticker: null, name: "Automotive & Finished-Vehicle Customers", role: "automakers and distributors use dedicated rail networks for inbound materials and finished vehicles" },

    // DOWNSTREAM LAYER +2 — END MARKETS
    { id: "unp_end", ticker: null, name: "Factories, Distribution Centers, Ports & Consumers", role: "rail shipments feed industrial production, retail distribution and North American trade flows" },
  ],

  edges: [
    // INPUTS → EQUIPMENT
    { source: "unp_steel", target: "unp_track_maint" },
    { source: "unp_ties", target: "unp_track_maint" },
    { source: "unp_fuel", target: "wab" },
    { source: "unp_electronics", target: "wab" },
    { source: "unp_steel", target: "unp_railcars" },

    // EQUIPMENT → NETWORK ASSETS
    { source: "wab", target: "unp_locomotives" },
    { source: "unp_railcars", target: "unp_terminals" },
    { source: "unp_track_maint", target: "unp_track" },

    // NETWORK ASSETS → OPERATIONS
    { source: "unp_locomotives", target: "unp_manifest" },
    { source: "unp_locomotives", target: "unp_intermodal" },
    { source: "unp_locomotives", target: "unp_bulk" },
    { source: "unp_track", target: "unp_manifest" },
    { source: "unp_terminals", target: "unp_intermodal" },

    // OPERATIONS → UNION PACIFIC
    { source: "unp_manifest", target: "unp" },
    { source: "unp_intermodal", target: "unp" },
    { source: "unp_bulk", target: "unp" },

    // UNION PACIFIC → CUSTOMERS
    { source: "unp", target: "unp_industrial" },
    { source: "unp", target: "unp_agri" },
    { source: "unp", target: "sndr" },
    { source: "unp", target: "unp_auto" },

    // CUSTOMERS → END MARKETS
    { source: "unp_industrial", target: "unp_end" },
    { source: "unp_agri", target: "unp_end" },
    { source: "sndr", target: "unp_end" },
    { source: "unp_auto", target: "unp_end" },

  ]
},

WDC: {
  name: "Western Digital",
  root: "wdc",
  nodes: [
    // UPSTREAM LAYER -4 — HDD MATERIAL INPUTS
    { id: "wdc_substrates", ticker: null, name: "Disk Substrates & Magnetic Materials", role: "glass or aluminum substrates and magnetic thin-film materials form the recording media used in hard drives" },
    { id: "wdc_magnets", ticker: null, name: "Rare-Earth Magnets & Precision Metals", role: "magnetic and precision-metal inputs support voice-coil actuators, spindle motors and mechanical assemblies" },
    { id: "wdc_semis", ticker: null, name: "Semiconductors, Memory & Electronic Components", role: "controllers, memory, power-management devices and other electronics provide HDD control and interface functions" },
    { id: "wdc_pcb_materials", ticker: null, name: "PCBs, Connectors & Passive Components", role: "printed-circuit and interconnect components form drive electronics assemblies" },

    // UPSTREAM LAYER -3 — CRITICAL HDD COMPONENTS
    { id: "wdc_media", ticker: null, name: "Recording Media", role: "precision magnetic disks store data at high areal density inside Western Digital drives" },
    { id: "wdc_heads", ticker: null, name: "Recording Heads & Sliders", role: "read/write head assemblies convert electrical signals into magnetic recording and retrieval" },
    { id: "mrvl", ticker: "MRVL", name: "Marvell Technology", role: "longstanding storage-semiconductor technology partner in the HDD ecosystem and a current Western Digital technology partner" },
    { id: "wdc_motors", ticker: null, name: "Spindle Motors & Mechanical Components", role: "precision motors, bearings and actuator parts support platter rotation and head positioning" },

    // UPSTREAM LAYER -2 — DRIVE SUBASSEMBLIES
    { id: "wdc_hda", ticker: null, name: "Head-Disk Assembly", role: "media, heads, motors and actuators are integrated into sealed mechanical assemblies" },
    { id: "wdc_electronics", ticker: null, name: "Drive Electronics & Firmware", role: "controller silicon, memory, firmware and power circuitry manage data transfer and drive operation" },
    { id: "wdc_enclosure", ticker: null, name: "Enterprise Drive Mechanics & Enclosures", role: "precision structural components provide vibration control, sealing and mounting for high-capacity drives" },

    // UPSTREAM LAYER -1 — ASSEMBLY / TEST
    { id: "wdc_internal_assembly", ticker: null, name: "Western Digital In-House Assembly", role: "vertically integrated operations assemble HDD products across major manufacturing sites in Thailand, Malaysia, the Philippines, China and the United States" },
    { id: "wdc_test", ticker: null, name: "Drive Test, Qualification & Reliability", role: "finished drives undergo firmware loading, performance validation and reliability screening before shipment" },
    { id: "wdc_supply", ticker: null, name: "External Component-Supplier Network", role: "Western Digital supplements internal manufacturing with multiple suppliers while retaining some sole- or single-source component dependencies" },

    // CENTER
    { id: "wdc", ticker: "WDC", name: "Western Digital", role: "data-storage company focused on hard disk drives after the February 2025 separation of the flash business into Sandisk" },

    // DOWNSTREAM LAYER +1 — SALES CHANNELS
    { id: "wdc_cloud", ticker: null, name: "Hyperscale Cloud & Neocloud Customers", role: "large data-center operators purchase high-capacity HDDs for exabyte-scale storage and AI-related data growth" },
    { id: "wdc_oem", ticker: null, name: "Computer & Storage OEMs", role: "systems manufacturers integrate Western Digital HDDs into servers, storage appliances and client systems" },
    { id: "wdc_channel", ticker: null, name: "Resellers, Distributors & Retailers", role: "channel partners distribute enterprise, client and consumer HDD products worldwide" },

    // DOWNSTREAM LAYER +2 — END WORKLOADS
    { id: "wdc_data", ticker: null, name: "Cloud Data, AI Datasets & Enterprise Storage", role: "HDD capacity supports durable, economical storage of large datasets, archives, backups and cloud workloads" },
    { id: "wdc_client_end", ticker: null, name: "PC & Consumer Storage Users", role: "client and external-drive products serve desktop, notebook and personal-storage use cases" },

    // EXPANDED DENSITY — END-MARKET / CHANNEL REPRESENTATIVES
    { id: "amzn", ticker: "AMZN", name: "Amazon", role: "hyperscale cloud operator representing the customer class driving large-capacity HDD demand; not asserted here as one of Western Digital’s unnamed top-three customers" },
    { id: "msft", ticker: "MSFT", name: "Microsoft", role: "hyperscale cloud operator representing cloud storage demand; not asserted here as one of Western Digital’s unnamed top-three customers" },
    { id: "dell", ticker: "DELL", name: "Dell Technologies", role: "server and storage OEM representing the systems channel that integrates high-capacity HDDs; included as channel context rather than an asserted named concentration customer" },
    { id: "hpe", ticker: "HPE", name: "HPE", role: "enterprise server and storage OEM representing the systems channel for HDD-based capacity" },
  ],

  edges: [
    // MATERIALS → COMPONENTS
    { source: "wdc_substrates", target: "wdc_media" },
    { source: "wdc_magnets", target: "wdc_heads" },
    { source: "wdc_semis", target: "mrvl" },
    { source: "wdc_pcb_materials", target: "mrvl" },
    { source: "wdc_magnets", target: "wdc_motors" },

    // COMPONENTS → SUBASSEMBLIES
    { source: "wdc_media", target: "wdc_hda" },
    { source: "wdc_heads", target: "wdc_hda" },
    { source: "wdc_motors", target: "wdc_hda" },
    { source: "mrvl", target: "wdc_electronics" },
    { source: "wdc_media", target: "wdc_enclosure" },

    // SUBASSEMBLIES → ASSEMBLY / TEST
    { source: "wdc_hda", target: "wdc_internal_assembly" },
    { source: "wdc_electronics", target: "wdc_internal_assembly" },
    { source: "wdc_enclosure", target: "wdc_internal_assembly" },
    { source: "wdc_hda", target: "wdc_test" },
    { source: "wdc_electronics", target: "wdc_test" },
    { source: "wdc_supply", target: "wdc_internal_assembly" },

    // ASSEMBLY / TEST → WESTERN DIGITAL
    { source: "wdc_internal_assembly", target: "wdc" },
    { source: "wdc_test", target: "wdc" },

    // WESTERN DIGITAL → CHANNELS
    { source: "wdc", target: "wdc_cloud" },
    { source: "wdc", target: "wdc_oem" },
    { source: "wdc", target: "wdc_channel" },

    // CHANNELS → END WORKLOADS
    { source: "wdc_cloud", target: "wdc_data" },
    { source: "wdc_oem", target: "wdc_data" },
    { source: "wdc_channel", target: "wdc_client_end" },

    // EXPANDED DENSITY — END-MARKET REPRESENTATIVES
    { source: "wdc_cloud", target: "amzn" },
    { source: "wdc_cloud", target: "msft" },

    // EXPANDED DENSITY — CHANNEL REPRESENTATIVES
    { source: "wdc_oem", target: "dell" },
    { source: "wdc_oem", target: "hpe" },

  ]
},

PFE: {
  name: "Pfizer",
  root: "pfe",
  nodes: [
    // UPSTREAM LAYER -4 — PHARMACEUTICAL INPUTS
    { id: "pfe_chemicals", ticker: null, name: "Chemical & Biological Raw Materials", role: "starting materials, reagents, cell-culture inputs and other raw materials support small-molecule and biologic production" },
    { id: "pfe_api_inputs", ticker: null, name: "API & Intermediate Inputs", role: "active ingredients and chemical or biological intermediates feed formulation and fill-finish operations" },
    { id: "pfe_components", ticker: null, name: "Vials, Syringes, Stoppers & Device Components", role: "primary packaging and delivery-device components are critical inputs for injectable, vaccine and other products" },
    { id: "pfe_packaging_inputs", ticker: null, name: "Packaging & Label Materials", role: "cartons, labels, inserts and serialization materials support finished-product distribution and regulatory compliance" },

    // UPSTREAM LAYER -3 — DRUG-SUBSTANCE PRODUCTION
    { id: "pfe_smallmol", ticker: null, name: "Small-Molecule Drug Substance", role: "chemical synthesis and purification create active pharmaceutical ingredients for oral and injectable medicines" },
    { id: "pfe_biologics", ticker: null, name: "Biologics & Vaccine Drug Substance", role: "cell culture, fermentation, purification and vaccine production create biological active substances" },
    { id: "pfe_external_mfg", ticker: null, name: "External Manufacturing Network", role: "qualified third-party manufacturers supplement Pfizer’s internal network for selected materials, intermediates and finished products" },

    // UPSTREAM LAYER -2 — FORMULATION / FILL-FINISH
    { id: "pfe_formulation", ticker: null, name: "Formulation & Dosage Manufacturing", role: "drug substances are formulated into tablets, capsules, injectables and other dosage forms" },
    { id: "pfe_fillfinish", ticker: null, name: "Sterile Fill-Finish & Vaccine Packaging", role: "sterile operations fill vials, syringes and other presentations under regulated conditions" },
    { id: "pfe_device", ticker: null, name: "Drug-Device & Packaging Assembly", role: "delivery devices, labels and secondary packaging are integrated into commercial presentations" },

    // UPSTREAM LAYER -1 — QUALITY / RELEASE / LOGISTICS
    { id: "pfe_quality", ticker: null, name: "Quality Control & Batch Release", role: "testing and quality systems confirm identity, purity, potency and regulatory compliance before release" },
    { id: "pfe_coldchain", ticker: null, name: "Cold-Chain & Specialty Logistics", role: "temperature-controlled storage and transportation support vaccines, biologics and other sensitive products" },
    { id: "pfe_distribution_ready", ticker: null, name: "Finished-Goods Distribution Network", role: "released products are staged and shipped to major wholesalers and other healthcare channels" },

    // CENTER
    { id: "pfe", ticker: "PFE", name: "Pfizer", role: "global biopharmaceutical company researching, manufacturing and commercializing vaccines, medicines and specialty therapies" },

    // DOWNSTREAM LAYER +1 — MAJOR U.S. WHOLESALERS
    { id: "mck", ticker: "MCK", name: "McKesson", role: "Pfizer’s largest U.S. wholesaler customer, representing 25% of total company revenue in 2025" },
    { id: "cor", ticker: "COR", name: "Cencora", role: "major U.S. Pfizer wholesaler customer representing 16% of total company revenue in 2025" },
    { id: "cah", ticker: "CAH", name: "Cardinal Health", role: "major U.S. Pfizer wholesaler customer representing 13% of total company revenue in 2025" },

    // DOWNSTREAM LAYER +2 — CARE DELIVERY
    { id: "pfe_pharmacies", ticker: null, name: "Pharmacies & Specialty Pharmacies", role: "wholesalers distribute Pfizer products into retail and specialty pharmacy channels" },
    { id: "pfe_hospitals", ticker: null, name: "Hospitals, Clinics & Physicians", role: "healthcare providers purchase and administer Pfizer medicines and vaccines" },
    { id: "pfe_patients", ticker: null, name: "Patients", role: "patients ultimately receive Pfizer therapies through prescription, hospital, clinic and vaccination channels" },
  ],

  edges: [
    // INPUTS → DRUG SUBSTANCE
    { source: "pfe_chemicals", target: "pfe_smallmol" },
    { source: "pfe_api_inputs", target: "pfe_smallmol" },
    { source: "pfe_chemicals", target: "pfe_biologics" },
    { source: "pfe_components", target: "pfe_external_mfg" },
    { source: "pfe_packaging_inputs", target: "pfe_external_mfg" },

    // DRUG SUBSTANCE → FORMULATION
    { source: "pfe_smallmol", target: "pfe_formulation" },
    { source: "pfe_biologics", target: "pfe_fillfinish" },
    { source: "pfe_external_mfg", target: "pfe_formulation" },
    { source: "pfe_external_mfg", target: "pfe_device" },

    // FORMULATION → QUALITY / LOGISTICS
    { source: "pfe_formulation", target: "pfe_quality" },
    { source: "pfe_fillfinish", target: "pfe_quality" },
    { source: "pfe_fillfinish", target: "pfe_coldchain" },
    { source: "pfe_device", target: "pfe_distribution_ready" },
    { source: "pfe_quality", target: "pfe_distribution_ready" },

    // QUALITY / LOGISTICS → PFIZER
    { source: "pfe_coldchain", target: "pfe" },
    { source: "pfe_distribution_ready", target: "pfe" },
    { source: "pfe_quality", target: "pfe" },

    // PFIZER → WHOLESALERS
    { source: "pfe", target: "mck" },
    { source: "pfe", target: "cor" },
    { source: "pfe", target: "cah" },

    // WHOLESALERS → CARE DELIVERY
    { source: "mck", target: "pfe_pharmacies" },
    { source: "cor", target: "pfe_hospitals" },
    { source: "cah", target: "pfe_hospitals" },

    // CARE DELIVERY → PATIENTS
    { source: "pfe_pharmacies", target: "pfe_patients" },
    { source: "pfe_hospitals", target: "pfe_patients" },

  ]
},

NEE: {
  name: "NextEra Energy",
  root: "nee",
  nodes: [
    // UPSTREAM LAYER -4 — ENERGY-PROJECT INPUTS
    { id: "nee_solar_inputs", ticker: null, name: "Solar Modules, Inverters & Electrical Components", role: "photovoltaic and balance-of-system components are core inputs for utility-scale solar projects" },
    { id: "nee_wind_inputs", ticker: null, name: "Wind Turbines & Major Components", role: "turbines, blades, towers and electrical equipment form utility-scale wind generation assets" },
    { id: "nee_storage_inputs", ticker: null, name: "Battery Cells, Racks & Power Electronics", role: "battery and conversion systems create grid-scale energy-storage capacity" },
    { id: "nee_grid_inputs", ticker: null, name: "Transmission, Substation & Grid Equipment", role: "transformers, breakers, conductors and control systems connect generation and customer load to the power network" },

    // UPSTREAM LAYER -3 — PROJECT DEVELOPMENT
    { id: "nee_sites", ticker: null, name: "Site Control, Land & Interconnection", role: "land rights, transmission access and grid studies establish viable project locations" },
    { id: "nee_permits", ticker: null, name: "Permitting & Engineering", role: "environmental review, system design and permitting move projects toward construction" },
    { id: "nee_contracts", ticker: null, name: "Power Purchase & Customer Contracting", role: "long-term power agreements and utility needs underpin project economics and financing" },

    // UPSTREAM LAYER -2 — CONSTRUCTION / ASSET BUILD
    { id: "nee_solar_build", ticker: null, name: "Solar & Storage Construction", role: "EPC activity integrates modules, inverters, batteries, substations and controls into generation assets" },
    { id: "nee_wind_build", ticker: null, name: "Wind Project Construction", role: "turbines, collection systems and substations are installed into operating wind projects" },
    { id: "nee_grid_build", ticker: null, name: "Transmission & Distribution Buildout", role: "FPL and other NextEra operations invest in grid hardening, transmission, substations and distribution capacity" },

    // UPSTREAM LAYER -1 — OPERATING PLATFORMS
    { id: "nee_fpl", ticker: null, name: "Florida Power & Light", role: "regulated utility platform generates, transmits and distributes electricity to Florida customers" },
    { id: "nee_neer", ticker: null, name: "NextEra Energy Resources", role: "competitive-energy platform develops and operates wind, solar, storage, nuclear and other energy infrastructure" },
    { id: "nee_nuclear", ticker: null, name: "Nuclear Generation Fleet", role: "nuclear assets provide firm, emissions-free power and support long-term contracted electricity demand" },

    // CENTER
    { id: "nee", ticker: "NEE", name: "NextEra Energy", role: "North American energy-infrastructure company owning Florida Power & Light and NextEra Energy Resources" },

    // DOWNSTREAM LAYER +1 — CUSTOMER / PARTNER CHANNELS
    { id: "nee_fpl_customers", ticker: null, name: "Florida Homes & Businesses", role: "FPL supplies regulated electricity to residential, commercial and industrial customers across Florida" },
    { id: "googl", ticker: "GOOGL", name: "Alphabet", role: "Google and NextEra have a strategic energy partnership covering multiple gigawatts of data-center and energy infrastructure plus long-term nuclear and clean-energy agreements" },
    { id: "etr", ticker: "ETR", name: "Entergy", role: "Entergy and NextEra Energy Resources have a joint development agreement for up to 4.5 GW of solar and energy-storage projects" },
    { id: "nee_wholesale", ticker: null, name: "Utilities & Corporate Power Buyers", role: "utilities and large corporate customers contract for electricity, capacity, renewable attributes and energy services" },

    // DOWNSTREAM LAYER +2 — END DEMAND
    { id: "nee_grid_demand", ticker: null, name: "Homes, Businesses & Public Infrastructure", role: "electricity supports household, commercial, industrial and public-sector activity" },
    { id: "nee_ai_demand", ticker: null, name: "Data Centers & AI Infrastructure", role: "rapid data-center construction creates large, long-duration electricity and capacity requirements" },
    { id: "nee_clean_energy", ticker: null, name: "Renewable & Reliability Needs", role: "customers use generation, storage and grid investment to meet growth, affordability and resilience requirements" },
  ],

  edges: [
    // INPUTS → DEVELOPMENT
    { source: "nee_solar_inputs", target: "nee_sites" },
    { source: "nee_wind_inputs", target: "nee_sites" },
    { source: "nee_storage_inputs", target: "nee_permits" },
    { source: "nee_grid_inputs", target: "nee_permits" },
    { source: "nee_grid_inputs", target: "nee_contracts" },

    // DEVELOPMENT → CONSTRUCTION
    { source: "nee_sites", target: "nee_solar_build" },
    { source: "nee_sites", target: "nee_wind_build" },
    { source: "nee_permits", target: "nee_grid_build" },
    { source: "nee_contracts", target: "nee_solar_build" },
    { source: "nee_contracts", target: "nee_wind_build" },

    // CONSTRUCTION → OPERATING PLATFORMS
    { source: "nee_solar_build", target: "nee_neer" },
    { source: "nee_wind_build", target: "nee_neer" },
    { source: "nee_grid_build", target: "nee_fpl" },
    { source: "nee_grid_build", target: "nee_nuclear" },

    // OPERATING PLATFORMS → NEXTERA
    { source: "nee_fpl", target: "nee" },
    { source: "nee_neer", target: "nee" },
    { source: "nee_nuclear", target: "nee" },

    // NEXTERA → CUSTOMERS / PARTNERS
    { source: "nee", target: "nee_fpl_customers" },
    { source: "nee", target: "googl" },
    { source: "nee", target: "etr" },
    { source: "nee", target: "nee_wholesale" },

    // CUSTOMERS → END DEMAND
    { source: "nee_fpl_customers", target: "nee_grid_demand" },
    { source: "googl", target: "nee_ai_demand" },
    { source: "etr", target: "nee_clean_energy" },
    { source: "nee_wholesale", target: "nee_clean_energy" },

  ]
},

DHR: {
  name: "Danaher",
  root: "dhr",
  nodes: [
    // UPSTREAM LAYER -4 — SCIENTIFIC / MANUFACTURING INPUTS
    { id: "dhr_chemicals", ticker: null, name: "Specialty Chemicals & Biological Reagents", role: "chemicals, resins, enzymes, antibodies and other biological inputs feed consumables and diagnostic-test production" },
    { id: "dhr_optics", ticker: null, name: "Optics, Lasers & Precision Components", role: "optical, photonic and precision mechanical components support microscopy, analytical and diagnostic instruments" },
    { id: "dhr_electronics", ticker: null, name: "Semiconductors, Sensors & Electronics", role: "electronic components, detectors and control hardware provide measurement, automation and instrument-control functions" },
    { id: "dhr_plastics", ticker: null, name: "Single-Use Plastics, Membranes & Filtration Media", role: "engineered polymers and filtration media are critical inputs for bioprocessing and laboratory consumables" },

    // UPSTREAM LAYER -3 — OPERATING-COMPANY TECHNOLOGY
    { id: "dhr_cytiva", ticker: null, name: "Cytiva Bioprocessing Technologies", role: "bioreactors, chromatography, filtration and single-use technologies support biologic-drug development and manufacturing" },
    { id: "dhr_pall", ticker: null, name: "Pall Filtration & Separation", role: "filtration, separation and purification technologies serve biopharma and other high-specification applications" },
    { id: "dhr_beckman", ticker: null, name: "Beckman Coulter Platforms", role: "diagnostic analyzers, laboratory automation and life-science instrumentation support clinical and research workflows" },
    { id: "dhr_cepheid", ticker: null, name: "Cepheid Molecular Diagnostics", role: "cartridge-based molecular testing systems provide rapid PCR diagnostics for infectious and other diseases" },

    // UPSTREAM LAYER -2 — PRODUCT MANUFACTURING
    { id: "dhr_bioprocess_mfg", ticker: null, name: "Bioprocess Equipment & Consumables Manufacturing", role: "Danaher businesses manufacture bioreactors, chromatography media, filtration products and related consumables" },
    { id: "dhr_instrument_mfg", ticker: null, name: "Scientific Instrument Manufacturing", role: "analytical, microscopy, flow-cytometry and laboratory instruments are assembled and calibrated" },
    { id: "dhr_dx_mfg", ticker: null, name: "Diagnostic Analyzer & Test Manufacturing", role: "clinical analyzers, assay reagents and molecular-test cartridges are manufactured under regulated quality systems" },

    // UPSTREAM LAYER -1 — COMMERCIAL / SERVICE NETWORK
    { id: "dhr_direct_sales", ticker: null, name: "Direct Sales & Key Accounts", role: "specialized commercial teams sell complex instruments, bioprocess platforms and diagnostics directly to major customers" },
    { id: "dhr_distribution", ticker: null, name: "Distributors & Channel Partners", role: "regional distributors extend product availability across laboratories, healthcare and industrial markets" },
    { id: "dhr_service", ticker: null, name: "Installed-Base Service & Consumables", role: "service contracts, replacement consumables and recurring reagents support customers after instrument placement" },

    // CENTER
    { id: "dhr", ticker: "DHR", name: "Danaher", role: "science and technology company focused on biotechnology, life sciences and diagnostics through operating companies including Cytiva, Beckman Coulter, Cepheid and SCIEX" },

    // DOWNSTREAM LAYER +1 — CUSTOMER SEGMENTS
    { id: "dhr_biopharma", ticker: null, name: "Biopharmaceutical Companies", role: "drug developers use Danaher bioprocessing and analytical technologies from research through commercial manufacturing" },
    { id: "dhr_clinical", ticker: null, name: "Hospitals & Clinical Laboratories", role: "clinical customers use diagnostic analyzers, assays and molecular tests for patient testing" },
    { id: "dhr_research", ticker: null, name: "Academic, Government & Research Laboratories", role: "scientists use microscopy, mass spectrometry, genomics and other analytical tools for discovery research" },
    { id: "dhr_industrial", ticker: null, name: "Industrial & Applied Markets", role: "industrial laboratories use analytical and filtration products for quality, environmental and process applications" },

    // DOWNSTREAM LAYER +2 — END WORKFLOWS
    { id: "dhr_drugs", ticker: null, name: "Biologic Drug Development & Production", role: "customers use Danaher tools to discover, scale and manufacture biologic medicines" },
    { id: "dhr_patient", ticker: null, name: "Clinical Diagnosis & Patient Care", role: "diagnostic results inform treatment, infection control and clinical decision-making" },
    { id: "dhr_science", ticker: null, name: "Scientific Discovery & Quality Control", role: "research and analytical workflows generate data for science, manufacturing and environmental monitoring" },
  ],

  edges: [
    // INPUTS → OPERATING TECHNOLOGIES
    { source: "dhr_chemicals", target: "dhr_cytiva" },
    { source: "dhr_plastics", target: "dhr_cytiva" },
    { source: "dhr_plastics", target: "dhr_pall" },
    { source: "dhr_optics", target: "dhr_beckman" },
    { source: "dhr_electronics", target: "dhr_beckman" },
    { source: "dhr_electronics", target: "dhr_cepheid" },

    // OPERATING TECHNOLOGIES → MANUFACTURING
    { source: "dhr_cytiva", target: "dhr_bioprocess_mfg" },
    { source: "dhr_pall", target: "dhr_bioprocess_mfg" },
    { source: "dhr_beckman", target: "dhr_instrument_mfg" },
    { source: "dhr_beckman", target: "dhr_dx_mfg" },
    { source: "dhr_cepheid", target: "dhr_dx_mfg" },

    // MANUFACTURING → COMMERCIAL / SERVICE
    { source: "dhr_bioprocess_mfg", target: "dhr_direct_sales" },
    { source: "dhr_instrument_mfg", target: "dhr_distribution" },
    { source: "dhr_dx_mfg", target: "dhr_direct_sales" },
    { source: "dhr_bioprocess_mfg", target: "dhr_service" },
    { source: "dhr_dx_mfg", target: "dhr_service" },

    // COMMERCIAL / SERVICE → DANAHER
    { source: "dhr_direct_sales", target: "dhr" },
    { source: "dhr_distribution", target: "dhr" },
    { source: "dhr_service", target: "dhr" },

    // DANAHER → CUSTOMERS
    { source: "dhr", target: "dhr_biopharma" },
    { source: "dhr", target: "dhr_clinical" },
    { source: "dhr", target: "dhr_research" },
    { source: "dhr", target: "dhr_industrial" },

    // CUSTOMERS → END WORKFLOWS
    { source: "dhr_biopharma", target: "dhr_drugs" },
    { source: "dhr_clinical", target: "dhr_patient" },
    { source: "dhr_research", target: "dhr_science" },
    { source: "dhr_industrial", target: "dhr_science" },

  ]
},

BA: {
  name: "Boeing",
  root: "ba",
  nodes: [
    // UPSTREAM LAYER -4 — AEROSPACE MATERIALS
    { id: "hwm", ticker: "HWM", name: "Howmet Aerospace", role: "aerospace supplier of engineered structural, fastening and engine components used across commercial and defense aircraft supply chains" },
    { id: "hxl", ticker: "HXL", name: "Hexcel", role: "advanced-composites producer supplying carbon fiber, prepregs and honeycomb materials used across modern aircraft structures" },
    { id: "ati", ticker: "ATI", name: "ATI Inc.", role: "producer of titanium, nickel-based superalloys and specialty materials used in aerospace structures and engines" },

    // UPSTREAM LAYER -3 — MAJOR SYSTEMS / PROPULSION
    { id: "ge", ticker: "GE", name: "GE Aerospace", role: "commercial-engine supplier whose GE9X powers the Boeing 777X and whose GE-family engines support Boeing aircraft programs" },
    { id: "rtx", ticker: "RTX", name: "RTX", role: "aerospace systems and engine supplier through Collins Aerospace and Pratt & Whitney across Boeing commercial and defense programs" },
    { id: "hon", ticker: "HON", name: "Honeywell", role: "supplier of avionics, auxiliary-power, environmental-control and other aircraft systems across the aerospace industry and Boeing platforms" },
    { id: "ba_spirit", ticker: null, name: "Spirit AeroSystems Operations", role: "former external supplier now inside Boeing after the December 2025 acquisition; produces major fuselage and structural content for 737, 767, 777 and 787 programs" },
    { id: "ba_material_fab", ticker: null, name: "Aerospace Material & Component Fabrication", role: "forgings, composite structures, fasteners and specialty-metal components are converted into production-ready airframe and propulsion content" },

    // UPSTREAM LAYER -2 — AIRFRAME / SYSTEM INTEGRATION
    { id: "ba_fuselage", ticker: null, name: "Fuselage & Major Structures", role: "fuselage sections, wings, empennage structures and aerostructures are produced and joined for each aircraft program" },
    { id: "ba_propulsion", ticker: null, name: "Engines & Propulsion Integration", role: "engines, nacelles, fuel systems and controls are integrated into the airframe" },
    { id: "ba_avionics", ticker: null, name: "Avionics, Electrical & Cabin Systems", role: "flight controls, electrical distribution, avionics, interiors and environmental systems are integrated and tested" },

    // UPSTREAM LAYER -1 — FINAL ASSEMBLY / CERTIFICATION
    { id: "ba_final", ticker: null, name: "Boeing Final Assembly", role: "major structures and systems are joined into completed commercial aircraft at Boeing final-assembly sites" },
    { id: "ba_test", ticker: null, name: "Ground & Flight Test", role: "production aircraft undergo systems checks, ground testing and flight testing before customer acceptance" },
    { id: "ba_delivery", ticker: null, name: "Customer Configuration & Delivery", role: "aircraft are configured, documented and transferred to airline and leasing customers following acceptance" },

    // CENTER
    { id: "ba", ticker: "BA", name: "Boeing", role: "aerospace company producing commercial airplanes, defense and space systems, and global services; Spirit AeroSystems’ Boeing-related operations have been internal since December 2025" },

    // DOWNSTREAM LAYER +1 — AIRLINE / FLEET CUSTOMERS
    { id: "dal", ticker: "DAL", name: "Delta Air Lines", role: "commercial customer; Delta placed a 2026 order for Boeing 787 Dreamliners as part of its widebody fleet strategy" },
    { id: "luv", ticker: "LUV", name: "Southwest Airlines", role: "major all-Boeing 737 operator and launch customer for the 737-7 program" },
    { id: "ba_airlines", ticker: null, name: "Global Airlines & Lessors", role: "airlines and leasing companies purchase and finance Boeing commercial aircraft across 737, 787 and 777 families" },
    { id: "ba_defense_customers", ticker: null, name: "U.S. & Allied Defense Customers", role: "government customers purchase Boeing military aircraft, rotorcraft, weapons, satellites and sustainment services" },

    // DOWNSTREAM LAYER +2 — END USE
    { id: "ba_passengers", ticker: null, name: "Passenger & Cargo Transportation", role: "airlines deploy Boeing aircraft to move passengers and freight across global route networks" },
    { id: "ba_missions", ticker: null, name: "Defense, Space & Security Missions", role: "government operators use Boeing platforms for transport, surveillance, strike, space and other missions" },
    { id: "ba_aftermarket", ticker: null, name: "Fleet Maintenance & Aftermarket Services", role: "operators consume parts, digital services, modifications and maintenance support throughout aircraft life cycles" },
  ],

  edges: [
    // MATERIALS → SYSTEMS / STRUCTURES
    { source: "hwm", target: "ba_material_fab" },
    { source: "hxl", target: "ba_material_fab" },
    { source: "ati", target: "ba_material_fab" },

    // SYSTEMS / STRUCTURES → INTEGRATION
    { source: "ba_material_fab", target: "ba_fuselage" },
    { source: "ba_spirit", target: "ba_fuselage" },
    { source: "ge", target: "ba_propulsion" },
    { source: "rtx", target: "ba_avionics" },
    { source: "hon", target: "ba_avionics" },

    // INTEGRATION → FINAL ASSEMBLY
    { source: "ba_fuselage", target: "ba_final" },
    { source: "ba_propulsion", target: "ba_final" },
    { source: "ba_avionics", target: "ba_final" },
    { source: "ba_final", target: "ba_test" },
    { source: "ba_test", target: "ba_delivery" },

    // FINAL ASSEMBLY → BOEING
    { source: "ba_final", target: "ba" },
    { source: "ba_test", target: "ba" },
    { source: "ba_delivery", target: "ba" },

    // BOEING → CUSTOMERS
    { source: "ba", target: "dal" },
    { source: "ba", target: "luv" },
    { source: "ba", target: "ba_airlines" },
    { source: "ba", target: "ba_defense_customers" },

    // CUSTOMERS → END USE
    { source: "dal", target: "ba_passengers" },
    { source: "luv", target: "ba_passengers" },
    { source: "ba_airlines", target: "ba_passengers" },
    { source: "ba_defense_customers", target: "ba_missions" },
    { source: "ba_airlines", target: "ba_aftermarket" },
    { source: "ba_defense_customers", target: "ba_aftermarket" },

  ]
},

COP: {
  name: "ConocoPhillips",
  root: "cop",
  nodes: [
    // UPSTREAM LAYER -4 — FIELD INPUTS / DEVELOPMENT RESOURCES
    { id: "cop_tubulars", ticker: null, name: "Steel Tubulars & Well Materials", role: "casing, tubing, structural steel and related well-construction materials used across ConocoPhillips drilling and development programs" },
    { id: "cop_drilling_inputs", ticker: null, name: "Drilling, Completion & Production Inputs", role: "drilling fluids, cement, proppant, chemicals and other consumables required to drill, complete and operate wells" },
    { id: "cop_field_equipment", ticker: null, name: "Field Equipment & Services", role: "rig, pressure-pumping, compression, artificial-lift, seismic and other specialized equipment and service capacity supporting upstream operations" },

    // UPSTREAM LAYER -3 — EXPLORATION / WELL CONSTRUCTION
    { id: "cop_exploration", ticker: null, name: "Geoscience & Exploration", role: "subsurface characterization, seismic interpretation and appraisal work used to identify and delineate oil and gas resources" },
    { id: "cop_drilling", ticker: null, name: "Drilling & Well Construction", role: "well-construction stage that drills and cases development and exploration wells across ConocoPhillips assets" },
    { id: "cop_completion", ticker: null, name: "Completion & Production Readiness", role: "completion, stimulation and facility tie-in work that prepares new wells for safe production" },

    // UPSTREAM LAYER -2 — PRODUCTION / FIELD PROCESSING
    { id: "cop_oil_production", ticker: null, name: "Crude Oil Production", role: "field operations producing crude oil and condensate from ConocoPhillips-operated and non-operated assets" },
    { id: "cop_gas_production", ticker: null, name: "Natural Gas Production", role: "field operations producing and conditioning natural gas for gathering, processing and sale" },
    { id: "cop_ngl_processing", ticker: null, name: "NGL & Associated-Gas Processing", role: "separation and processing that converts produced hydrocarbon streams into marketable natural gas liquids and gas" },

    // UPSTREAM LAYER -1 — GATHERING / MARKETING STREAMS
    { id: "cop_crude_marketing", ticker: null, name: "Crude Oil & Condensate Marketing", role: "gathering, transportation scheduling and commercial marketing of crude oil and condensate volumes" },
    { id: "cop_gas_marketing", ticker: null, name: "Natural Gas Marketing", role: "pipeline nomination, balancing and commercial sale of marketable natural gas volumes" },
    { id: "cop_ngl_lng_marketing", ticker: null, name: "NGL & LNG-Linked Marketing", role: "commercial handling of natural-gas-liquids and LNG-linked production exposures before sale to downstream buyers" },

    // CENTER
    { id: "cop", ticker: "COP", name: "ConocoPhillips", role: "independent exploration and production company producing and marketing crude oil, natural gas and natural gas liquids across a global asset portfolio" },

    // DOWNSTREAM LAYER +1 — PRIMARY BUYERS / MARKETS
    { id: "cop_refiners", ticker: null, name: "Refiners & Crude-Oil Buyers", role: "refineries, traders and other buyers purchasing ConocoPhillips crude oil and condensate" },
    { id: "cop_gas_buyers", ticker: null, name: "Utilities, Marketers & Gas Buyers", role: "utilities, pipeline marketers and industrial buyers purchasing natural gas" },
    { id: "cop_lng_ngl_buyers", ticker: null, name: "LNG & NGL Buyers", role: "LNG value-chain participants and petrochemical or fractionation customers purchasing gas-linked and NGL volumes" },

    // DOWNSTREAM LAYER +2 — END-MARKET DEMAND
    { id: "cop_fuels_market", ticker: null, name: "Transportation-Fuel Markets", role: "refined-fuel demand ultimately supported by crude oil sold into refining systems" },
    { id: "cop_power_industry", ticker: null, name: "Power & Industrial Gas Demand", role: "electric generation, heating and industrial applications consuming natural gas" },
    { id: "cop_petrochemicals", ticker: null, name: "Petrochemical & Export Demand", role: "petrochemical feedstock and international energy demand consuming NGL and LNG-linked supply" },
  ],

  edges: [
    // FIELD INPUTS / DEVELOPMENT RESOURCES → EXPLORATION / WELL CONSTRUCTION
    { source: "cop_tubulars", target: "cop_exploration" },
    { source: "cop_drilling_inputs", target: "cop_drilling" },
    { source: "cop_field_equipment", target: "cop_completion" },

    // EXPLORATION / WELL CONSTRUCTION → PRODUCTION / FIELD PROCESSING
    { source: "cop_exploration", target: "cop_oil_production" },
    { source: "cop_drilling", target: "cop_gas_production" },
    { source: "cop_completion", target: "cop_ngl_processing" },

    // PRODUCTION / FIELD PROCESSING → GATHERING / MARKETING STREAMS
    { source: "cop_oil_production", target: "cop_crude_marketing" },
    { source: "cop_gas_production", target: "cop_gas_marketing" },
    { source: "cop_ngl_processing", target: "cop_ngl_lng_marketing" },

    // GATHERING / MARKETING STREAMS → COP
    { source: "cop_crude_marketing", target: "cop" },
    { source: "cop_gas_marketing", target: "cop" },
    { source: "cop_ngl_lng_marketing", target: "cop" },

    // COP → PRIMARY BUYERS / MARKETS
    { source: "cop", target: "cop_refiners" },
    { source: "cop", target: "cop_gas_buyers" },
    { source: "cop", target: "cop_lng_ngl_buyers" },

    // PRIMARY BUYERS / MARKETS → END-MARKET DEMAND
    { source: "cop_refiners", target: "cop_fuels_market" },
    { source: "cop_gas_buyers", target: "cop_power_industry" },
    { source: "cop_lng_ngl_buyers", target: "cop_petrochemicals" },

  ]
},

ISRG: {
  name: "Intuitive Surgical",
  root: "isrg",
  nodes: [
    // UPSTREAM LAYER -4 — COMPONENT / MATERIAL INPUTS
    { id: "isrg_electronics", ticker: null, name: "Electronics & Semiconductor Components", role: "custom and off-the-shelf processors, boards, sensors, connectors and related electronic components used in robotic surgical systems" },
    { id: "isrg_precision_materials", ticker: null, name: "Precision Metals, Polymers & Instrument Materials", role: "specialty metals, polymers and precision parts used in reusable and disposable surgical instruments and accessories" },
    { id: "isrg_optics", ticker: null, name: "Optics & Imaging Components", role: "optical, camera and illumination components used in endoscopes and surgical visualization systems" },

    // UPSTREAM LAYER -3 — SUPPLIER SUBASSEMBLIES
    { id: "isrg_robot_subassemblies", ticker: null, name: "Robotic System Subassemblies", role: "supplier-produced mechanical, electronic and motion-control subassemblies incorporated into da Vinci systems" },
    { id: "isrg_instrument_components", ticker: null, name: "Instrument & Accessory Components", role: "precision components converted into instrument, stapling, energy and accessory subassemblies" },
    { id: "isrg_endoscope_components", ticker: null, name: "Endoscope & Vision Subassemblies", role: "optical and imaging components assembled into endoscope and visualization modules" },

    // UPSTREAM LAYER -2 — MANUFACTURING OPERATIONS
    { id: "isrg_us_manufacturing", ticker: null, name: "U.S. System Manufacturing", role: "Intuitive manufacturing operations, including its Blacksburg, Virginia site, supporting robotic-system production" },
    { id: "isrg_mexicali", ticker: null, name: "Mexicali Instrument & Accessory Manufacturing", role: "significant instrument and accessory manufacturing capacity in Mexicali supporting procedure-volume growth" },
    { id: "isrg_europe_endoscopes", ticker: null, name: "European Endoscope Manufacturing", role: "endoscope manufacturing operations in Europe, including Bulgaria and Germany" },

    // UPSTREAM LAYER -1 — FINAL ASSEMBLY / RELEASE
    { id: "isrg_system_release", ticker: null, name: "Robotic System Assembly & Release", role: "final system integration, calibration, testing and quality release of da Vinci surgical platforms" },
    { id: "isrg_instrument_release", ticker: null, name: "Instrument & Accessory Release", role: "assembly, sterilization or release workflows for instruments and accessories consumed across procedures" },
    { id: "isrg_vision_release", ticker: null, name: "Vision-System & Endoscope Release", role: "final assembly, test and quality-release workflows for surgical visualization products" },

    // CENTER
    { id: "isrg", ticker: "ISRG", name: "Intuitive Surgical", role: "develops, manufactures and commercializes robotic-assisted surgical systems, instruments, accessories and services led by the da Vinci platform" },

    // DOWNSTREAM LAYER +1 — CARE DELIVERY CHANNELS
    { id: "isrg_hospitals", ticker: null, name: "Hospitals & Health Systems", role: "hospital customers purchasing or leasing robotic systems and recurring instruments, accessories and service" },
    { id: "isrg_ascs", ticker: null, name: "Ambulatory Surgery Centers", role: "outpatient surgical facilities deploying Intuitive platforms for eligible procedures" },
    { id: "isrg_service_network", ticker: null, name: "Installed-Base Service & Training", role: "service, technical support and clinical-training infrastructure supporting installed robotic systems" },

    // DOWNSTREAM LAYER +2 — PROCEDURE DEMAND
    { id: "isrg_surgeons", ticker: null, name: "Surgeons & Clinical Teams", role: "trained clinical teams using Intuitive systems, instruments and visualization products during procedures" },
    { id: "isrg_patients", ticker: null, name: "Patients", role: "patients receiving minimally invasive procedures performed with Intuitive surgical systems" },
    { id: "isrg_procedure_growth", ticker: null, name: "Recurring Procedure Ecosystem", role: "procedure growth that drives recurring demand for instruments, accessories, service and replacement systems" },
  ],

  edges: [
    // COMPONENT / MATERIAL INPUTS → SUPPLIER SUBASSEMBLIES
    { source: "isrg_electronics", target: "isrg_robot_subassemblies" },
    { source: "isrg_precision_materials", target: "isrg_instrument_components" },
    { source: "isrg_optics", target: "isrg_endoscope_components" },

    // SUPPLIER SUBASSEMBLIES → MANUFACTURING OPERATIONS
    { source: "isrg_robot_subassemblies", target: "isrg_us_manufacturing" },
    { source: "isrg_instrument_components", target: "isrg_mexicali" },
    { source: "isrg_endoscope_components", target: "isrg_europe_endoscopes" },

    // MANUFACTURING OPERATIONS → FINAL ASSEMBLY / RELEASE
    { source: "isrg_us_manufacturing", target: "isrg_system_release" },
    { source: "isrg_mexicali", target: "isrg_instrument_release" },
    { source: "isrg_europe_endoscopes", target: "isrg_vision_release" },

    // FINAL ASSEMBLY / RELEASE → ISRG
    { source: "isrg_system_release", target: "isrg" },
    { source: "isrg_instrument_release", target: "isrg" },
    { source: "isrg_vision_release", target: "isrg" },

    // ISRG → CARE DELIVERY CHANNELS
    { source: "isrg", target: "isrg_hospitals" },
    { source: "isrg", target: "isrg_ascs" },
    { source: "isrg", target: "isrg_service_network" },

    // CARE DELIVERY CHANNELS → PROCEDURE DEMAND
    { source: "isrg_hospitals", target: "isrg_surgeons" },
    { source: "isrg_ascs", target: "isrg_patients" },
    { source: "isrg_service_network", target: "isrg_procedure_growth" },

  ]
},

TJX: {
  name: "The TJX Companies",
  root: "tjx",
  nodes: [
    // UPSTREAM LAYER -4 — MERCHANDISE SUPPLY
    { id: "tjx_manufacturers", ticker: null, name: "Manufacturers & Brand Vendors", role: "manufacturers and brand owners offering current-season, closeout, overproduced and opportunistic merchandise to TJX buyers" },
    { id: "tjx_retail_sources", ticker: null, name: "Retailers & Excess-Inventory Sources", role: "retailers and other sellers providing cancelled orders, excess inventories and other off-price buying opportunities" },
    { id: "tjx_vendor_network", ticker: null, name: "Global Vendor Network", role: "broad vendor base spanning thousands of merchandise sources across apparel, footwear, home and accessories categories" },

    // UPSTREAM LAYER -3 — OFF-PRICE BUYING / ASSORTMENT
    { id: "tjx_buying_org", ticker: null, name: "Global Buying Organization", role: "TJX merchant teams sourcing opportunistically across vendors, geographies, seasons and product categories" },
    { id: "tjx_merch_planning", ticker: null, name: "Merchandise Planning & Allocation", role: "planning processes that convert opportunistic buys into localized assortments and inventory commitments" },
    { id: "tjx_quality_compliance", ticker: null, name: "Vendor Compliance & Product Quality", role: "quality, compliance and product-safety controls applied before merchandise enters TJX distribution channels" },

    // UPSTREAM LAYER -2 — INBOUND LOGISTICS
    { id: "tjx_ocean_ground", ticker: null, name: "Ocean, Air & Ground Freight", role: "third-party transportation capacity moving imported and domestic merchandise into the TJX distribution network" },
    { id: "tjx_import_customs", ticker: null, name: "Import, Customs & Consolidation", role: "cross-border consolidation, customs clearance and inbound handling supporting TJX global sourcing" },
    { id: "tjx_third_party_warehousing", ticker: null, name: "Third-Party Warehousing & Shipping", role: "external warehouse, shipping and logistics capacity used alongside TJX-owned distribution infrastructure" },

    // UPSTREAM LAYER -1 — DISTRIBUTION / FULFILLMENT
    { id: "tjx_distribution", ticker: null, name: "TJX Distribution Centers", role: "distribution-center network receiving, processing and allocating merchandise to stores across TJX banners" },
    { id: "tjx_ecom_fulfillment", ticker: null, name: "E-Commerce Fulfillment", role: "fulfillment operations supporting TJX digital orders where e-commerce is offered" },
    { id: "tjx_store_replenishment", ticker: null, name: "Store Replenishment & Regional Flow", role: "regional inventory movement from distribution facilities into high-turn off-price store networks" },

    // CENTER
    { id: "tjx", ticker: "TJX", name: "The TJX Companies", role: "operates off-price apparel and home-fashions retail businesses sourcing opportunistically from a large global vendor network" },

    // DOWNSTREAM LAYER +1 — RETAIL BANNERS
    { id: "tjmaxx_marshalls", ticker: null, name: "T.J. Maxx & Marshalls", role: "core apparel and home off-price banners distributing merchandise to U.S. consumers" },
    { id: "homegoods", ticker: null, name: "HomeGoods", role: "home-furnishings and décor banner distributing TJX-sourced merchandise" },
    { id: "tjx_other_banners", ticker: null, name: "Sierra / Winners / HomeSense & Other Banners", role: "additional TJX retail banners serving outdoor, apparel and home customers across multiple markets" },

    // DOWNSTREAM LAYER +2 — CONSUMER DEMAND
    { id: "tjx_store_shoppers", ticker: null, name: "Off-Price Store Shoppers", role: "consumers purchasing branded merchandise through TJX physical stores" },
    { id: "tjx_digital_shoppers", ticker: null, name: "Digital Shoppers", role: "consumers purchasing through TJX-operated e-commerce channels" },
    { id: "tjx_loyal_customers", ticker: null, name: "Repeat / Loyalty Customers", role: "repeat customers whose frequent visits support TJX high-inventory-turn operating model" },
  ],

  edges: [
    // MERCHANDISE SUPPLY → OFF-PRICE BUYING / ASSORTMENT
    { source: "tjx_manufacturers", target: "tjx_buying_org" },
    { source: "tjx_retail_sources", target: "tjx_merch_planning" },
    { source: "tjx_vendor_network", target: "tjx_quality_compliance" },

    // OFF-PRICE BUYING / ASSORTMENT → INBOUND LOGISTICS
    { source: "tjx_buying_org", target: "tjx_ocean_ground" },
    { source: "tjx_merch_planning", target: "tjx_import_customs" },
    { source: "tjx_quality_compliance", target: "tjx_third_party_warehousing" },

    // INBOUND LOGISTICS → DISTRIBUTION / FULFILLMENT
    { source: "tjx_ocean_ground", target: "tjx_distribution" },
    { source: "tjx_import_customs", target: "tjx_ecom_fulfillment" },
    { source: "tjx_third_party_warehousing", target: "tjx_store_replenishment" },

    // DISTRIBUTION / FULFILLMENT → TJX
    { source: "tjx_distribution", target: "tjx" },
    { source: "tjx_ecom_fulfillment", target: "tjx" },
    { source: "tjx_store_replenishment", target: "tjx" },

    // TJX → RETAIL BANNERS
    { source: "tjx", target: "tjmaxx_marshalls" },
    { source: "tjx", target: "homegoods" },
    { source: "tjx", target: "tjx_other_banners" },

    // RETAIL BANNERS → CONSUMER DEMAND
    { source: "tjmaxx_marshalls", target: "tjx_store_shoppers" },
    { source: "homegoods", target: "tjx_digital_shoppers" },
    { source: "tjx_other_banners", target: "tjx_loyal_customers" },

  ]
},

UBER: {
  name: "Uber Technologies",
  root: "uber",
  nodes: [
    // UPSTREAM LAYER -4 — CLOUD / CONNECTIVITY / VEHICLE TECHNOLOGY
    { id: "orcl", ticker: "ORCL", name: "Oracle", role: "strategic cloud infrastructure provider supporting portions of Uber platform workloads and large-scale compute" },
    { id: "googl", ticker: "GOOGL", name: "Alphabet", role: "Google Cloud partner supporting Uber cloud modernization, data and infrastructure workloads" },
    { id: "lcid", ticker: "LCID", name: "Lucid Group", role: "public electric-vehicle partner in Uber autonomous-mobility plans through a 2025 multi-year vehicle agreement" },

    // UPSTREAM LAYER -3 — DIGITAL INFRASTRUCTURE
    { id: "uber_cloud_compute", ticker: null, name: "Uber Cloud Compute & Data Infrastructure", role: "distributed compute, storage, databases and data platforms running Uber marketplace services" },
    { id: "uber_location_routing", ticker: null, name: "Location, Routing & Dispatch Infrastructure", role: "mapping, routing, ETA, geospatial and dispatch systems coordinating real-time marketplace activity" },
    { id: "uber_vehicle_platform", ticker: null, name: "Vehicle & Autonomous-Fleet Integration", role: "vehicle integration, telematics and fleet-management layer supporting human-driven and future autonomous supply" },

    // UPSTREAM LAYER -2 — MARKETPLACE OPERATING SYSTEMS
    { id: "uber_mobility_marketplace", ticker: null, name: "Mobility Marketplace", role: "pricing, matching, dispatch, identity and safety systems connecting riders with driver or fleet supply" },
    { id: "uber_delivery_marketplace", ticker: null, name: "Delivery Marketplace", role: "ordering, merchant integration, courier dispatch and fulfillment systems supporting food, grocery and retail delivery" },
    { id: "uber_freight_marketplace", ticker: null, name: "Freight Marketplace", role: "digital brokerage and logistics systems matching shippers with carrier capacity" },

    // UPSTREAM LAYER -1 — SUPPLY-SIDE NETWORKS
    { id: "uber_drivers_fleets", ticker: null, name: "Drivers & Fleet Operators", role: "independent drivers and fleet operators providing mobility capacity through the Uber platform" },
    { id: "uber_merchants_couriers", ticker: null, name: "Merchants & Couriers", role: "restaurants, grocers, retailers and couriers supplying goods and delivery capacity through Uber" },
    { id: "uber_carriers", ticker: null, name: "Motor Carriers", role: "carrier network supplying truckload and logistics capacity through Uber Freight" },

    // CENTER
    { id: "uber", ticker: "UBER", name: "Uber Technologies", role: "operates technology marketplaces for mobility, delivery and freight by matching supply-side participants with consumers and business customers" },

    // DOWNSTREAM LAYER +1 — UBER SERVICE CHANNELS
    { id: "uber_mobility", ticker: null, name: "Uber Mobility", role: "consumer and business ride-hailing, premium, taxi and related mobility offerings" },
    { id: "uber_delivery", ticker: null, name: "Uber Eats & Delivery", role: "food, grocery, retail and local-delivery offerings" },
    { id: "uber_freight", ticker: null, name: "Uber Freight", role: "managed transportation and digital freight-brokerage offerings" },

    // DOWNSTREAM LAYER +2 — END CUSTOMERS
    { id: "uber_riders", ticker: null, name: "Riders & Business Travelers", role: "individual and enterprise users purchasing mobility through Uber" },
    { id: "uber_eaters", ticker: null, name: "Consumers Ordering Food, Grocery & Retail", role: "customers generating delivery demand across Uber Eats and related offerings" },
    { id: "uber_shippers", ticker: null, name: "Shippers & Logistics Customers", role: "businesses purchasing transportation and managed-logistics services through Uber Freight" },
  ],

  edges: [
    // CLOUD / CONNECTIVITY / VEHICLE TECHNOLOGY → DIGITAL INFRASTRUCTURE
    { source: "orcl", target: "uber_cloud_compute" },
    { source: "googl", target: "uber_location_routing" },
    { source: "lcid", target: "uber_vehicle_platform" },

    // DIGITAL INFRASTRUCTURE → MARKETPLACE OPERATING SYSTEMS
    { source: "uber_cloud_compute", target: "uber_mobility_marketplace" },
    { source: "uber_location_routing", target: "uber_delivery_marketplace" },
    { source: "uber_vehicle_platform", target: "uber_freight_marketplace" },

    // MARKETPLACE OPERATING SYSTEMS → SUPPLY-SIDE NETWORKS
    { source: "uber_mobility_marketplace", target: "uber_drivers_fleets" },
    { source: "uber_delivery_marketplace", target: "uber_merchants_couriers" },
    { source: "uber_freight_marketplace", target: "uber_carriers" },

    // SUPPLY-SIDE NETWORKS → UBER
    { source: "uber_drivers_fleets", target: "uber" },
    { source: "uber_merchants_couriers", target: "uber" },
    { source: "uber_carriers", target: "uber" },

    // UBER → UBER SERVICE CHANNELS
    { source: "uber", target: "uber_mobility" },
    { source: "uber", target: "uber_delivery" },
    { source: "uber", target: "uber_freight" },

    // UBER SERVICE CHANNELS → END CUSTOMERS
    { source: "uber_mobility", target: "uber_riders" },
    { source: "uber_delivery", target: "uber_eaters" },
    { source: "uber_freight", target: "uber_shippers" },

  ]
},

NOW: {
  name: "ServiceNow",
  root: "now",
  nodes: [
    // UPSTREAM LAYER -4 — CLOUD / AI TECHNOLOGY PROVIDERS
    { id: "amzn", ticker: "AMZN", name: "Amazon Web Services", role: "technology and cloud ecosystem provider supporting ServiceNow partner integrations and enterprise deployment patterns" },
    { id: "googl", ticker: "GOOGL", name: "Google Cloud", role: "strategic cloud and AI ecosystem partner for ServiceNow enterprise workflows and infrastructure integrations" },
    { id: "msft", ticker: "MSFT", name: "Microsoft", role: "strategic technology partner integrating Microsoft cloud and productivity services with ServiceNow workflows" },
    { id: "nvda", ticker: "NVDA", name: "NVIDIA", role: "AI infrastructure and model ecosystem partner supporting ServiceNow generative-AI and enterprise-AI capabilities" },

    // UPSTREAM LAYER -3 — COMPUTE / DATA / AI FOUNDATION
    { id: "now_compute", ticker: null, name: "Cloud Compute & Storage Foundation", role: "distributed compute, storage and networking capacity underpinning ServiceNow cloud delivery" },
    { id: "now_data_foundation", ticker: null, name: "Enterprise Data & Integration Layer", role: "data connectivity, CMDB, APIs and integration services connecting customer systems to the Now Platform" },
    { id: "now_ai_foundation", ticker: null, name: "AI & Model Infrastructure", role: "model, accelerator and AI-service foundation supporting Now Assist and agentic workflow capabilities" },

    // UPSTREAM LAYER -2 — SERVICENOW CLOUD OPERATIONS
    { id: "now_datacenters", ticker: null, name: "ServiceNow Cloud Infrastructure", role: "ServiceNow-operated and partner-supported infrastructure delivering secure multi-instance enterprise cloud services" },
    { id: "now_security_ops", ticker: null, name: "Security, Reliability & Platform Operations", role: "security, availability, observability and operational controls supporting production customer instances" },
    { id: "now_partner_integrations", ticker: null, name: "Technology Partner Integrations", role: "certified integrations connecting ServiceNow workflows with enterprise cloud, software and data ecosystems" },

    // UPSTREAM LAYER -1 — NOW PLATFORM LAYERS
    { id: "now_workflow_engine", ticker: null, name: "Workflow & Automation Engine", role: "core workflow, automation and orchestration capabilities used across ServiceNow products" },
    { id: "now_data_cmdb", ticker: null, name: "Data, CMDB & Knowledge Layer", role: "enterprise configuration, service, asset and knowledge data supporting workflow context" },
    { id: "now_ai_experience", ticker: null, name: "AI, Agent & User Experience Layer", role: "AI-assisted interfaces, agents and application experiences layered on the Now Platform" },

    // CENTER
    { id: "now", ticker: "NOW", name: "ServiceNow", role: "provides the Now Platform and subscription cloud software for enterprise workflows, automation, service management and AI-enabled operations" },

    // DOWNSTREAM LAYER +1 — GO-TO-MARKET / DELIVERY
    { id: "now_direct_enterprise", ticker: null, name: "Direct Enterprise Subscriptions", role: "direct subscription relationships with large enterprises and public-sector customers" },
    { id: "now_gsi_channel", ticker: null, name: "Global Systems Integrators", role: "implementation and transformation channel spanning firms such as Accenture, Cognizant and Infosys" },
    { id: "now_msp_resellers", ticker: null, name: "Managed-Service & Resale Partners", role: "partners bundling, reselling, operating or extending ServiceNow solutions for customers" },

    // DOWNSTREAM LAYER +2 — ENTERPRISE WORKFLOWS
    { id: "now_it_workflows", ticker: null, name: "IT & Security Teams", role: "customers using ServiceNow for IT service, operations, asset and security workflows" },
    { id: "now_employee_workflows", ticker: null, name: "Employee & Corporate Functions", role: "HR, finance, legal and workplace teams automating employee-facing workflows" },
    { id: "now_customer_creator", ticker: null, name: "Customer Service & Application Teams", role: "organizations using ServiceNow for customer workflows, low-code development and industry solutions" },
  ],

  edges: [
    // CLOUD / AI TECHNOLOGY PROVIDERS → COMPUTE / DATA / AI FOUNDATION
    { source: "amzn", target: "now_compute" },
    { source: "googl", target: "now_data_foundation" },
    { source: "msft", target: "now_ai_foundation" },
    { source: "nvda", target: "now_compute" },

    // COMPUTE / DATA / AI FOUNDATION → SERVICENOW CLOUD OPERATIONS
    { source: "now_compute", target: "now_datacenters" },
    { source: "now_data_foundation", target: "now_security_ops" },
    { source: "now_ai_foundation", target: "now_partner_integrations" },

    // SERVICENOW CLOUD OPERATIONS → NOW PLATFORM LAYERS
    { source: "now_datacenters", target: "now_workflow_engine" },
    { source: "now_security_ops", target: "now_data_cmdb" },
    { source: "now_partner_integrations", target: "now_ai_experience" },

    // NOW PLATFORM LAYERS → NOW
    { source: "now_workflow_engine", target: "now" },
    { source: "now_data_cmdb", target: "now" },
    { source: "now_ai_experience", target: "now" },

    // NOW → GO-TO-MARKET / DELIVERY
    { source: "now", target: "now_direct_enterprise" },
    { source: "now", target: "now_gsi_channel" },
    { source: "now", target: "now_msp_resellers" },

    // GO-TO-MARKET / DELIVERY → ENTERPRISE WORKFLOWS
    { source: "now_direct_enterprise", target: "now_it_workflows" },
    { source: "now_gsi_channel", target: "now_employee_workflows" },
    { source: "now_msp_resellers", target: "now_customer_creator" },

  ]
},

GLW: {
  name: "Corning",
  root: "glw",
  nodes: [
    // UPSTREAM LAYER -4 — RAW MATERIAL / CHEMICAL INPUTS
    { id: "glw_silica_minerals", ticker: null, name: "Silica, Minerals & Glass Inputs", role: "high-purity mineral and glass-forming inputs used across specialty glass, display and optical-fiber production" },
    { id: "glw_specialty_chemicals", ticker: null, name: "Specialty Chemicals & Coatings", role: "chemical precursors, coatings and process materials supporting glass, ceramic and optical manufacturing" },
    { id: "glw_ceramic_inputs", ticker: null, name: "Ceramic & Catalyst-Substrate Inputs", role: "ceramic raw materials and process inputs used in automotive emissions-control and specialty-material applications" },

    // UPSTREAM LAYER -3 — CORE MATERIAL FORMATION
    { id: "glw_glass_forming", ticker: null, name: "Precision Glass Melting & Forming", role: "Corning proprietary glass compositions and forming processes creating display and specialty-glass substrates" },
    { id: "glw_fiber_preform", ticker: null, name: "Optical-Fiber Preform & Draw", role: "preform production and fiber-draw processes creating high-purity optical fiber" },
    { id: "glw_ceramic_forming", ticker: null, name: "Ceramic Substrate Formation", role: "ceramic extrusion, firing and related processes creating emissions-control and specialty ceramic products" },

    // UPSTREAM LAYER -2 — PRODUCT MANUFACTURING
    { id: "glw_display_specialty", ticker: null, name: "Display & Specialty Glass Manufacturing", role: "finishing, strengthening and converting glass for consumer electronics and display applications" },
    { id: "glw_optical_connectivity", ticker: null, name: "Fiber, Cable & Connectivity Manufacturing", role: "manufacturing of optical fiber, cable, connectors and data-center / telecom connectivity products" },
    { id: "glw_auto_life_science", ticker: null, name: "Automotive & Life-Science Manufacturing", role: "manufacturing of emissions substrates, laboratory vessels and other engineered-material products" },

    // UPSTREAM LAYER -1 — CUSTOMER-SPECIFIC FINISHING / DELIVERY
    { id: "glw_device_glass", ticker: null, name: "Device Glass Finishing & Qualification", role: "finishing and qualification of cover glass and specialty materials for device customers" },
    { id: "glw_ai_connectivity", ticker: null, name: "AI / Data-Center Connectivity Solutions", role: "integrated fiber, cable and connectivity systems configured for hyperscale and AI infrastructure deployments" },
    { id: "glw_industrial_products", ticker: null, name: "Automotive, Display & Laboratory Product Delivery", role: "final product qualification and distribution into automotive, display and life-science channels" },

    // CENTER
    { id: "glw", ticker: "GLW", name: "Corning", role: "manufactures specialty glass, optical communications products, ceramic substrates and life-science materials across multiple advanced-materials businesses" },

    // DOWNSTREAM LAYER +1 — MAJOR CUSTOMER CHANNELS
    { id: "aapl", ticker: "AAPL", name: "Apple", role: "major specialty-glass customer with a long-running U.S. manufacturing relationship for device cover glass" },
    { id: "meta", ticker: "META", name: "Meta Platforms", role: "major optical-connectivity customer under a multi-year agreement supporting AI data-center buildout" },
    { id: "glw_telecom_oem", ticker: null, name: "Telecom, Display, Automotive & Life-Science OEMs", role: "broad customer base purchasing Corning fiber, display substrates, ceramic components and laboratory products" },

    // DOWNSTREAM LAYER +2 — END SYSTEMS
    { id: "glw_devices", ticker: null, name: "Consumer Devices", role: "phones, watches and other electronics incorporating specialty cover glass" },
    { id: "glw_data_centers", ticker: null, name: "AI Data Centers & Telecom Networks", role: "hyperscale, carrier and enterprise networks consuming fiber and connectivity systems" },
    { id: "glw_auto_labs", ticker: null, name: "Vehicles, Displays & Laboratories", role: "automotive emissions systems, display products and laboratory workflows using Corning engineered materials" },
  ],

  edges: [
    // RAW MATERIAL / CHEMICAL INPUTS → CORE MATERIAL FORMATION
    { source: "glw_silica_minerals", target: "glw_glass_forming" },
    { source: "glw_specialty_chemicals", target: "glw_fiber_preform" },
    { source: "glw_ceramic_inputs", target: "glw_ceramic_forming" },

    // CORE MATERIAL FORMATION → PRODUCT MANUFACTURING
    { source: "glw_glass_forming", target: "glw_display_specialty" },
    { source: "glw_fiber_preform", target: "glw_optical_connectivity" },
    { source: "glw_ceramic_forming", target: "glw_auto_life_science" },

    // PRODUCT MANUFACTURING → CUSTOMER-SPECIFIC FINISHING / DELIVERY
    { source: "glw_display_specialty", target: "glw_device_glass" },
    { source: "glw_optical_connectivity", target: "glw_ai_connectivity" },
    { source: "glw_auto_life_science", target: "glw_industrial_products" },

    // CUSTOMER-SPECIFIC FINISHING / DELIVERY → GLW
    { source: "glw_device_glass", target: "glw" },
    { source: "glw_ai_connectivity", target: "glw" },
    { source: "glw_industrial_products", target: "glw" },

    // GLW → MAJOR CUSTOMER CHANNELS
    { source: "glw", target: "aapl" },
    { source: "glw", target: "meta" },
    { source: "glw", target: "glw_telecom_oem" },

    // MAJOR CUSTOMER CHANNELS → END SYSTEMS
    { source: "aapl", target: "glw_devices" },
    { source: "meta", target: "glw_data_centers" },
    { source: "glw_telecom_oem", target: "glw_auto_labs" },

  ]
},

VRTX: {
  name: "Vertex Pharmaceuticals",
  root: "vrtx",
  nodes: [
    // UPSTREAM LAYER -4 — PHARMA / CELL-THERAPY INPUTS
    { id: "vrtx_chem_inputs", ticker: null, name: "Pharmaceutical Raw Materials", role: "chemical starting materials, excipients and other inputs required for Vertex small-molecule drug production" },
    { id: "vrtx_cell_inputs", ticker: null, name: "Cell-Therapy Materials & Reagents", role: "reagents, consumables and biological materials supporting ex-vivo cell-therapy manufacturing workflows" },
    { id: "vrtx_packaging_inputs", ticker: null, name: "Primary Packaging & Cold-Chain Inputs", role: "containers, packaging components and temperature-control materials used in finished-product supply" },

    // UPSTREAM LAYER -3 — DRUG SUBSTANCE / CELL PROCESSING
    { id: "vrtx_api", ticker: null, name: "Small-Molecule API Manufacturing", role: "multi-step drug-substance production converting chemical starting materials into active pharmaceutical ingredients" },
    { id: "vrtx_cell_processing", ticker: null, name: "Cell Collection / Editing / Processing", role: "patient-specific cell-processing and gene-editing workflow supporting CASGEVY supply" },
    { id: "vrtx_intermediates", ticker: null, name: "Formulation & Manufacturing Intermediates", role: "intermediate manufacturing stages preparing active material for final dosage-form or therapy release" },

    // UPSTREAM LAYER -2 — INTERNAL / EXTERNAL MANUFACTURING
    { id: "vrtx_boston_mfg", ticker: null, name: "Vertex Boston Manufacturing", role: "Vertex-owned small-molecule manufacturing capability supporting portions of its commercial and clinical supply" },
    { id: "vrtx_cmo_network", ticker: null, name: "Third-Party Contract Manufacturing", role: "contract manufacturers performing selected drug-substance, drug-product and commercial supply steps" },
    { id: "vrtx_cell_mfg_network", ticker: null, name: "Cell-Therapy Manufacturing Network", role: "specialized manufacturing capacity executing patient-specific cell-processing and release steps" },

    // UPSTREAM LAYER -1 — FINISHING / RELEASE / LOGISTICS
    { id: "vrtx_finished_dose", ticker: null, name: "Finished Dosage & Product Release", role: "final formulation, tableting or dosage production followed by quality-control and batch release" },
    { id: "vrtx_pack_distribution", ticker: null, name: "Packaging, Warehousing & Global Distribution", role: "third-party and internal packaging, warehousing and distribution workflows for commercial medicines" },
    { id: "vrtx_cold_chain", ticker: null, name: "Cell-Therapy Cold Chain & Treatment-Site Logistics", role: "time- and temperature-controlled logistics moving patient material and finished therapy between treatment sites and manufacturing" },

    // CENTER
    { id: "vrtx", ticker: "VRTX", name: "Vertex Pharmaceuticals", role: "develops and commercializes medicines across cystic fibrosis, pain, cell and gene therapy and other serious diseases" },

    // DOWNSTREAM LAYER +1 — DISTRIBUTION / TREATMENT CHANNELS
    { id: "vrtx_specialty_channel", ticker: null, name: "Specialty Pharmacies & Distributors", role: "limited specialty distribution channels supplying Vertex medicines to patients and providers" },
    { id: "vrtx_wholesalers", ticker: null, name: "Major U.S. Wholesalers", role: "large pharmaceutical wholesalers redistributing Vertex medicines to pharmacies, hospitals and other care sites" },
    { id: "vrtx_atcs", ticker: null, name: "Authorized Treatment Centers", role: "qualified treatment centers delivering CASGEVY and managing patient-specific cell-therapy workflows" },

    // DOWNSTREAM LAYER +2 — CARE DELIVERY / PATIENTS
    { id: "vrtx_pharmacies", ticker: null, name: "Retail / Specialty Pharmacies", role: "pharmacies dispensing Vertex small-molecule medicines under prescriptions" },
    { id: "vrtx_hospitals_providers", ticker: null, name: "Hospitals & Specialist Providers", role: "clinical organizations prescribing, administering and monitoring Vertex therapies" },
    { id: "vrtx_patients", ticker: null, name: "Patients", role: "patients receiving Vertex medicines across cystic fibrosis, pain, sickle cell disease, beta thalassemia and other indications" },
  ],

  edges: [
    // PHARMA / CELL-THERAPY INPUTS → DRUG SUBSTANCE / CELL PROCESSING
    { source: "vrtx_chem_inputs", target: "vrtx_api" },
    { source: "vrtx_cell_inputs", target: "vrtx_cell_processing" },
    { source: "vrtx_packaging_inputs", target: "vrtx_intermediates" },

    // DRUG SUBSTANCE / CELL PROCESSING → INTERNAL / EXTERNAL MANUFACTURING
    { source: "vrtx_api", target: "vrtx_boston_mfg" },
    { source: "vrtx_cell_processing", target: "vrtx_cmo_network" },
    { source: "vrtx_intermediates", target: "vrtx_cell_mfg_network" },

    // INTERNAL / EXTERNAL MANUFACTURING → FINISHING / RELEASE / LOGISTICS
    { source: "vrtx_boston_mfg", target: "vrtx_finished_dose" },
    { source: "vrtx_cmo_network", target: "vrtx_pack_distribution" },
    { source: "vrtx_cell_mfg_network", target: "vrtx_cold_chain" },

    // FINISHING / RELEASE / LOGISTICS → VRTX
    { source: "vrtx_finished_dose", target: "vrtx" },
    { source: "vrtx_pack_distribution", target: "vrtx" },
    { source: "vrtx_cold_chain", target: "vrtx" },

    // VRTX → DISTRIBUTION / TREATMENT CHANNELS
    { source: "vrtx", target: "vrtx_specialty_channel" },
    { source: "vrtx", target: "vrtx_wholesalers" },
    { source: "vrtx", target: "vrtx_atcs" },

    // DISTRIBUTION / TREATMENT CHANNELS → CARE DELIVERY / PATIENTS
    { source: "vrtx_specialty_channel", target: "vrtx_pharmacies" },
    { source: "vrtx_wholesalers", target: "vrtx_hospitals_providers" },
    { source: "vrtx_atcs", target: "vrtx_patients" },

  ]
},

CB: {
  name: "Chubb",
  root: "cb",
  nodes: [
    // UPSTREAM LAYER -4 — RISK / CAPITAL INPUTS
    { id: "cb_client_data", ticker: null, name: "Policyholder & Exposure Data", role: "insured asset, operations, claims and exposure information submitted by customers and intermediaries for risk evaluation" },
    { id: "cb_cat_data", ticker: null, name: "Catastrophe, Economic & Claims Data", role: "catastrophe models, loss history, economic data and actuarial information used in pricing and portfolio management" },
    { id: "cb_capital_reinsurance", ticker: null, name: "Capital & Reinsurance Capacity", role: "shareholder capital, investment assets and external reinsurance capacity supporting underwriting limits and risk transfer" },

    // UPSTREAM LAYER -3 — RISK ANALYTICS / UNDERWRITING
    { id: "cb_commercial_underwriting", ticker: null, name: "Commercial Risk Underwriting", role: "risk selection, engineering, pricing and policy structuring for commercial property, casualty and specialty lines" },
    { id: "cb_consumer_underwriting", ticker: null, name: "Consumer Risk Underwriting", role: "pricing and underwriting of high-net-worth personal lines, accident, health and other consumer insurance" },
    { id: "cb_reinsurance_underwriting", ticker: null, name: "Reinsurance Underwriting", role: "portfolio modeling and underwriting of treaty and facultative reinsurance exposures" },

    // UPSTREAM LAYER -2 — INSURANCE PRODUCT PLATFORMS
    { id: "cb_commercial_products", ticker: null, name: "Commercial P&C & Specialty Products", role: "property, casualty, financial lines, marine, cyber and other specialty coverage for businesses" },
    { id: "cb_consumer_products", ticker: null, name: "Consumer Insurance Products", role: "homeowners, auto, valuables, accident, health and related personal insurance products" },
    { id: "cb_reinsurance_products", ticker: null, name: "Reinsurance Products", role: "risk-transfer products sold to other insurers through global reinsurance operations" },

    // UPSTREAM LAYER -1 — REGIONAL / SPECIALTY DISTRIBUTION UNITS
    { id: "cb_na_commercial", ticker: null, name: "North America Commercial Insurance", role: "underwriting and distribution platform serving middle-market, major-account and specialty commercial customers" },
    { id: "cb_na_consumer", ticker: null, name: "North America Consumer Insurance", role: "personal risk and consumer distribution platform serving affluent and other individual customers" },
    { id: "cb_overseas_re", ticker: null, name: "Overseas General & Global Reinsurance", role: "international insurance and reinsurance platform distributing coverage across local and global markets" },

    // CENTER
    { id: "cb", ticker: "CB", name: "Chubb", role: "global property and casualty insurer and reinsurer offering commercial, consumer, specialty and reinsurance products through brokers, agents and other channels" },

    // DOWNSTREAM LAYER +1 — BROKERS / AGENTS / DIRECT CHANNELS
    { id: "mmc", ticker: "MMC", name: "Marsh McLennan", role: "largest identified broker relationship in Chubb disclosures, placing a significant share of Chubb gross written premiums" },
    { id: "cb_broker_network", ticker: null, name: "Independent Brokers & Agents", role: "global insurance intermediaries placing commercial, consumer and specialty risks with Chubb" },
    { id: "cb_direct_partners", ticker: null, name: "Direct, Affinity & Partner Channels", role: "direct and partner-based distribution channels supplementing broker and agency placement" },

    // DOWNSTREAM LAYER +2 — INSURED END MARKETS
    { id: "cb_businesses", ticker: null, name: "Businesses & Institutions", role: "commercial and institutional policyholders purchasing property, casualty and specialty protection" },
    { id: "cb_individuals", ticker: null, name: "Individuals & Families", role: "personal-lines and consumer customers purchasing property, valuables, accident and other coverage" },
    { id: "cb_insurers", ticker: null, name: "Primary Insurers", role: "insurance companies purchasing Chubb reinsurance capacity to manage portfolio risk" },
  ],

  edges: [
    // RISK / CAPITAL INPUTS → RISK ANALYTICS / UNDERWRITING
    { source: "cb_client_data", target: "cb_commercial_underwriting" },
    { source: "cb_cat_data", target: "cb_consumer_underwriting" },
    { source: "cb_capital_reinsurance", target: "cb_reinsurance_underwriting" },

    // RISK ANALYTICS / UNDERWRITING → INSURANCE PRODUCT PLATFORMS
    { source: "cb_commercial_underwriting", target: "cb_commercial_products" },
    { source: "cb_consumer_underwriting", target: "cb_consumer_products" },
    { source: "cb_reinsurance_underwriting", target: "cb_reinsurance_products" },

    // INSURANCE PRODUCT PLATFORMS → REGIONAL / SPECIALTY DISTRIBUTION UNITS
    { source: "cb_commercial_products", target: "cb_na_commercial" },
    { source: "cb_consumer_products", target: "cb_na_consumer" },
    { source: "cb_reinsurance_products", target: "cb_overseas_re" },

    // REGIONAL / SPECIALTY DISTRIBUTION UNITS → CB
    { source: "cb_na_commercial", target: "cb" },
    { source: "cb_na_consumer", target: "cb" },
    { source: "cb_overseas_re", target: "cb" },

    // CB → BROKERS / AGENTS / DIRECT CHANNELS
    { source: "cb", target: "mmc" },
    { source: "cb", target: "cb_broker_network" },
    { source: "cb", target: "cb_direct_partners" },

    // BROKERS / AGENTS / DIRECT CHANNELS → INSURED END MARKETS
    { source: "mmc", target: "cb_businesses" },
    { source: "cb_broker_network", target: "cb_individuals" },
    { source: "cb_direct_partners", target: "cb_individuals" },
    { source: "cb_broker_network", target: "cb_insurers" },

  ]
},

BMY: {
  name: "Bristol Myers Squibb",
  root: "bmy",
  nodes: [
    // UPSTREAM LAYER -4 — PHARMACEUTICAL / BIOLOGIC INPUTS
    { id: "bmy_chemical_inputs", ticker: null, name: "Chemical Starting Materials & Excipients", role: "chemical raw materials and formulation inputs supporting Bristol Myers Squibb small-molecule medicines" },
    { id: "bmy_biologic_inputs", ticker: null, name: "Biologic Media, Reagents & Single-Use Inputs", role: "cell-culture media, reagents and bioprocess consumables supporting biologic drug-substance manufacturing" },
    { id: "bmy_cell_therapy_inputs", ticker: null, name: "Cell-Therapy Starting Materials & Consumables", role: "patient material, reagents and specialized consumables supporting autologous cell-therapy manufacturing" },

    // UPSTREAM LAYER -3 — DRUG SUBSTANCE / CELL PROCESSING
    { id: "bmy_api", ticker: null, name: "API & Small-Molecule Drug Substance", role: "multi-step synthesis and purification producing active ingredients for oral and other small-molecule products" },
    { id: "bmy_biologic_ds", ticker: null, name: "Biologic Drug Substance", role: "cell-culture, harvest and purification operations producing monoclonal antibodies and other biologic drug substances" },
    { id: "bmy_cell_processing", ticker: null, name: "Cell-Therapy Processing", role: "patient-specific cell modification, expansion and testing workflows supporting CAR-T products" },

    // UPSTREAM LAYER -2 — INTERNAL / CONTRACT MANUFACTURING
    { id: "bmy_internal_mfg", ticker: null, name: "BMS Manufacturing Network", role: "company manufacturing sites producing selected drug substance, drug product and cell-therapy supply" },
    { id: "bmy_cmo_network", ticker: null, name: "Third-Party Contract Manufacturing", role: "external manufacturers providing API, drug-substance, drug-product and finished-goods capacity" },
    { id: "bmy_aseptic_fill", ticker: null, name: "Sterile Fill / Finish & Specialized Production", role: "aseptic filling, device, vial and specialized finishing capacity for injectable and biologic therapies" },

    // UPSTREAM LAYER -1 — PACKAGING / RELEASE / DISTRIBUTION
    { id: "bmy_finished_goods", ticker: null, name: "Finished Dosage & Biologic Release", role: "final dosage-form manufacturing, inspection and quality release of commercial medicines" },
    { id: "bmy_packaging", ticker: null, name: "Packaging, Serialization & Cold Chain", role: "packaging, serialization and temperature-controlled handling preparing products for distribution" },
    { id: "bmy_distribution", ticker: null, name: "BMS Distribution Operations", role: "finished-goods warehousing and order fulfillment supplying U.S. wholesalers, specialty channels and international markets" },

    // CENTER
    { id: "bmy", ticker: "BMY", name: "Bristol Myers Squibb", role: "researches, develops, manufactures and commercializes biopharmaceutical medicines across oncology, hematology, immunology, cardiovascular disease and other areas" },

    // DOWNSTREAM LAYER +1 — MAJOR U.S. WHOLESALERS
    { id: "mck", ticker: "MCK", name: "McKesson", role: "major U.S. pharmaceutical wholesaler representing the largest disclosed share of Bristol Myers Squibb U.S. gross revenue" },
    { id: "cor", ticker: "COR", name: "Cencora", role: "major U.S. pharmaceutical wholesaler and distributor for Bristol Myers Squibb medicines" },
    { id: "cah", ticker: "CAH", name: "Cardinal Health", role: "major U.S. pharmaceutical wholesaler and distributor for Bristol Myers Squibb medicines" },

    // DOWNSTREAM LAYER +2 — CARE DELIVERY
    { id: "bmy_specialty_pharmacy", ticker: null, name: "Specialty & Retail Pharmacies", role: "pharmacy channels dispensing oral and specialty Bristol Myers Squibb medicines" },
    { id: "bmy_hospitals", ticker: null, name: "Hospitals, Clinics & Infusion Centers", role: "care sites administering oncology, immunology, cardiovascular and other therapies" },
    { id: "bmy_specialty_treatment", ticker: null, name: "Specialty Treatment & Distribution Sites", role: "specialized treatment, dispensing and distribution sites handling complex Bristol Myers Squibb therapies" },
  ],

  edges: [
    // PHARMACEUTICAL / BIOLOGIC INPUTS → DRUG SUBSTANCE / CELL PROCESSING
    { source: "bmy_chemical_inputs", target: "bmy_api" },
    { source: "bmy_biologic_inputs", target: "bmy_biologic_ds" },
    { source: "bmy_cell_therapy_inputs", target: "bmy_cell_processing" },

    // DRUG SUBSTANCE / CELL PROCESSING → INTERNAL / CONTRACT MANUFACTURING
    { source: "bmy_api", target: "bmy_internal_mfg" },
    { source: "bmy_biologic_ds", target: "bmy_cmo_network" },
    { source: "bmy_cell_processing", target: "bmy_aseptic_fill" },

    // INTERNAL / CONTRACT MANUFACTURING → PACKAGING / RELEASE / DISTRIBUTION
    { source: "bmy_internal_mfg", target: "bmy_finished_goods" },
    { source: "bmy_cmo_network", target: "bmy_packaging" },
    { source: "bmy_aseptic_fill", target: "bmy_distribution" },

    // PACKAGING / RELEASE / DISTRIBUTION → BMY
    { source: "bmy_finished_goods", target: "bmy" },
    { source: "bmy_packaging", target: "bmy" },
    { source: "bmy_distribution", target: "bmy" },

    // BMY → MAJOR U.S. WHOLESALERS
    { source: "bmy", target: "mck" },
    { source: "bmy", target: "cor" },
    { source: "bmy", target: "cah" },

    // MAJOR U.S. WHOLESALERS → CARE DELIVERY
    { source: "mck", target: "bmy_specialty_pharmacy" },
    { source: "cor", target: "bmy_hospitals" },
    { source: "cah", target: "bmy_specialty_treatment" },
    { source: "mck", target: "bmy_hospitals" },
    { source: "mck", target: "bmy_specialty_treatment" },
    { source: "cor", target: "bmy_specialty_pharmacy" },
    { source: "cor", target: "bmy_specialty_treatment" },
    { source: "cah", target: "bmy_specialty_pharmacy" },
    { source: "cah", target: "bmy_hospitals" },

  ]
},

NEM: {
  name: "Newmont",
  root: "nem",
  nodes: [
    // UPSTREAM LAYER -4 — MINE DEVELOPMENT INPUTS
    { id: "nem_exploration", ticker: null, name: "Exploration & Geological Inputs", role: "drilling, geological modeling and assay work used to define ore bodies and support reserve conversion" },
    { id: "nem_mine_consumables", ticker: null, name: "Explosives, Reagents & Mine Consumables", role: "explosives, grinding media, lime, cyanide and other consumables supporting extraction and mineral processing" },
    { id: "nem_mobile_energy", ticker: null, name: "Heavy Equipment, Fuel & Power", role: "mobile mining equipment, maintenance parts, fuel and electricity supporting open-pit and underground operations" },

    // UPSTREAM LAYER -3 — ORE EXTRACTION
    { id: "nem_open_pit", ticker: null, name: "Open-Pit Mining", role: "drill, blast, load and haul operations extracting ore and waste from open-pit deposits" },
    { id: "nem_underground", ticker: null, name: "Underground Mining", role: "development, stoping, haulage and hoisting operations extracting underground ore" },
    { id: "nem_ore_control", ticker: null, name: "Ore Control & Stockpiling", role: "grade control, ore routing and stockpile management directing material to appropriate processing circuits" },

    // UPSTREAM LAYER -2 — MINERAL PROCESSING
    { id: "nem_crush_grind", ticker: null, name: "Crushing & Grinding", role: "comminution circuits reducing run-of-mine ore to sizes suitable for downstream recovery" },
    { id: "nem_leach_recovery", ticker: null, name: "Leach & Gold Recovery", role: "heap-leach or mill recovery circuits producing gold-bearing solution and intermediate gold products" },
    { id: "nem_flotation", ticker: null, name: "Flotation & Concentrate Production", role: "flotation circuits producing copper, gold, silver, lead or zinc-bearing concentrates at applicable operations" },

    // UPSTREAM LAYER -1 — SALEABLE MINE OUTPUT
    { id: "nem_dore", ticker: null, name: "Gold Doré", role: "semi-refined gold-silver bars produced at mine sites and shipped to external refiners" },
    { id: "nem_concentrates", ticker: null, name: "Metal Concentrates", role: "copper and other metal concentrates sold to smelters for further treatment and refining" },
    { id: "nem_site_logistics", ticker: null, name: "Mine-Site Logistics & Export", role: "secure transport, concentrate handling and shipment processes moving saleable products to refiners and smelters" },

    // CENTER
    { id: "nem", ticker: "NEM", name: "Newmont", role: "global mining company producing primarily gold together with copper, silver, lead and zinc from a portfolio of mines and development projects" },

    // DOWNSTREAM LAYER +1 — REFINING / METAL MARKETS
    { id: "nem_refiners", ticker: null, name: "Precious-Metal Refiners", role: "refiners converting Newmont doré into high-purity bullion before commercial settlement or delivery" },
    { id: "nem_banks", ticker: null, name: "Bullion Banks & Metal Buyers", role: "banks, traders and other counterparties purchasing refined gold and other metal output" },
    { id: "nem_smelters", ticker: null, name: "Smelters & Concentrate Buyers", role: "smelters purchasing concentrates and recovering copper, gold, silver and other payable metals" },

    // DOWNSTREAM LAYER +2 — END DEMAND
    { id: "nem_gold_demand", ticker: null, name: "Investment & Jewelry Demand", role: "bullion, investment products and jewelry markets consuming refined gold" },
    { id: "nem_industrial_demand", ticker: null, name: "Electronics & Industrial Demand", role: "industrial applications consuming refined copper, silver and other recovered metals" },
    { id: "nem_global_metal_markets", ticker: null, name: "Global Metal Markets", role: "commodity markets and downstream fabricators allocating refined metals across end uses" },
  ],

  edges: [
    // MINE DEVELOPMENT INPUTS → ORE EXTRACTION
    { source: "nem_exploration", target: "nem_open_pit" },
    { source: "nem_mine_consumables", target: "nem_underground" },
    { source: "nem_mobile_energy", target: "nem_ore_control" },

    // ORE EXTRACTION → MINERAL PROCESSING
    { source: "nem_open_pit", target: "nem_crush_grind" },
    { source: "nem_underground", target: "nem_leach_recovery" },
    { source: "nem_ore_control", target: "nem_flotation" },

    // MINERAL PROCESSING → SALEABLE MINE OUTPUT
    { source: "nem_crush_grind", target: "nem_dore" },
    { source: "nem_leach_recovery", target: "nem_concentrates" },
    { source: "nem_flotation", target: "nem_site_logistics" },

    // SALEABLE MINE OUTPUT → NEM
    { source: "nem_dore", target: "nem" },
    { source: "nem_concentrates", target: "nem" },
    { source: "nem_site_logistics", target: "nem" },

    // NEM → REFINING / METAL MARKETS
    { source: "nem", target: "nem_refiners" },
    { source: "nem", target: "nem_banks" },
    { source: "nem", target: "nem_smelters" },

    // REFINING / METAL MARKETS → END DEMAND
    { source: "nem_refiners", target: "nem_gold_demand" },
    { source: "nem_banks", target: "nem_industrial_demand" },
    { source: "nem_smelters", target: "nem_global_metal_markets" },

  ]
},

FTNT: {
  name: "Fortinet",
  root: "ftnt",
  nodes: [
    // UPSTREAM LAYER -4 — SEMICONDUCTOR / COMPONENT SUPPLIERS
    { id: "tsm", ticker: "TSM", name: "TSMC", role: "foundry used in Fortinet proprietary ASIC supply through its semiconductor manufacturing chain" },
    { id: "intc", ticker: "INTC", name: "Intel", role: "supplier of CPUs and other semiconductor components used in Fortinet appliance platforms" },
    { id: "avgo", ticker: "AVGO", name: "Broadcom", role: "supplier of networking semiconductor components used across Fortinet hardware platforms" },
    { id: "mu", ticker: "MU", name: "Micron", role: "memory supplier represented in Fortinet appliance component sourcing" },

    // UPSTREAM LAYER -3 — COMPUTE / ASIC / MEMORY SUBSYSTEMS
    { id: "ftnt_asic", ticker: null, name: "Fortinet ASIC Supply", role: "custom security-processing silicon fabricated and packaged for use in FortiGate and related hardware" },
    { id: "ftnt_cpu", ticker: null, name: "CPU & General Compute Supply", role: "merchant processors and supporting compute components integrated into Fortinet appliances" },
    { id: "ftnt_network_silicon", ticker: null, name: "Networking Silicon", role: "switching, connectivity and interface components used across secure networking hardware" },
    { id: "ftnt_memory_storage", ticker: null, name: "Memory & Storage Components", role: "DRAM, flash and storage components used in security appliances" },

    // UPSTREAM LAYER -2 — CONTRACT MANUFACTURING
    { id: "ftnt_pcb", ticker: null, name: "PCB Assembly & Component Integration", role: "contract-manufacturing stage populating boards and integrating semiconductors and electronic components" },
    { id: "ftnt_appliance_assembly", ticker: null, name: "Appliance Assembly", role: "outsourced hardware assembly producing FortiGate and other Fortinet physical appliances" },
    { id: "ftnt_test_config", ticker: null, name: "Hardware Test & Configuration", role: "functional test, firmware loading, inspection and product configuration before shipment" },

    // UPSTREAM LAYER -1 — FORTINET PRODUCT / SERVICE DELIVERY
    { id: "ftnt_fortigate", ticker: null, name: "FortiGate Secure Networking Appliances", role: "physical firewall and secure-networking systems combining Fortinet ASICs, hardware and FortiOS software" },
    { id: "ftnt_security_services", ticker: null, name: "FortiGuard Security Services", role: "subscription threat-intelligence, security and update services attached to Fortinet products" },
    { id: "ftnt_cloud_sase", ticker: null, name: "FortiSASE / Cloud Security Services", role: "cloud-delivered security, networking and management services extending Fortinet beyond physical appliances" },

    // CENTER
    { id: "ftnt", ticker: "FTNT", name: "Fortinet", role: "develops and sells secure networking and cybersecurity products including FortiGate appliances, FortiOS software and cloud-delivered security services" },

    // DOWNSTREAM LAYER +1 — DISTRIBUTION / CHANNEL
    { id: "arw", ticker: "ARW", name: "Arrow Electronics", role: "public technology distributor participating in Fortinet two-tier channel distribution" },
    { id: "snx", ticker: "SNX", name: "TD SYNNEX", role: "major public technology distributor carrying Fortinet products through reseller and solution-provider channels" },
    { id: "ftnt_resellers_mssp", ticker: null, name: "Resellers, Integrators & MSSPs", role: "channel partners deploying, integrating and managing Fortinet security products for end customers" },

    // DOWNSTREAM LAYER +2 — END CUSTOMERS
    { id: "ftnt_enterprise_gov", ticker: null, name: "Enterprise & Government Customers", role: "large organizations and public-sector entities deploying Fortinet networking and cybersecurity products" },
    { id: "ftnt_smb", ticker: null, name: "Small & Mid-Sized Businesses", role: "SMB customers purchasing Fortinet through distributors, resellers and managed-service providers" },
    { id: "ftnt_service_providers", ticker: null, name: "Service Providers & Cloud Environments", role: "telecom, hosting and service-provider customers integrating Fortinet security into managed offerings" },
  ],

  edges: [
    // SEMICONDUCTOR / COMPONENT SUPPLIERS → COMPUTE / ASIC / MEMORY SUBSYSTEMS
    { source: "tsm", target: "ftnt_asic" },
    { source: "intc", target: "ftnt_cpu" },
    { source: "avgo", target: "ftnt_network_silicon" },
    { source: "mu", target: "ftnt_memory_storage" },

    // COMPUTE / ASIC / MEMORY SUBSYSTEMS → CONTRACT MANUFACTURING
    { source: "ftnt_asic", target: "ftnt_pcb" },
    { source: "ftnt_cpu", target: "ftnt_appliance_assembly" },
    { source: "ftnt_network_silicon", target: "ftnt_test_config" },
    { source: "ftnt_memory_storage", target: "ftnt_pcb" },

    // CONTRACT MANUFACTURING → FORTINET PRODUCT / SERVICE DELIVERY
    { source: "ftnt_pcb", target: "ftnt_fortigate" },
    { source: "ftnt_appliance_assembly", target: "ftnt_security_services" },
    { source: "ftnt_test_config", target: "ftnt_cloud_sase" },

    // FORTINET PRODUCT / SERVICE DELIVERY → FTNT
    { source: "ftnt_fortigate", target: "ftnt" },
    { source: "ftnt_security_services", target: "ftnt" },
    { source: "ftnt_cloud_sase", target: "ftnt" },

    // FTNT → DISTRIBUTION / CHANNEL
    { source: "ftnt", target: "arw" },
    { source: "ftnt", target: "snx" },
    { source: "ftnt", target: "ftnt_resellers_mssp" },

    // DISTRIBUTION / CHANNEL → END CUSTOMERS
    { source: "arw", target: "ftnt_enterprise_gov" },
    { source: "snx", target: "ftnt_smb" },
    { source: "ftnt_resellers_mssp", target: "ftnt_service_providers" },

  ]
},

PLD: {
  name: "Prologis",
  root: "pld",
  nodes: [
    // UPSTREAM LAYER -4 — CAPITAL / LAND / CONSTRUCTION INPUTS
    { id: "pld_capital", ticker: null, name: "Equity, Debt & Development Capital", role: "capital funding land acquisition, development, redevelopment and ownership of logistics real estate" },
    { id: "pld_land", ticker: null, name: "Land & Site Pipeline", role: "well-located land positions near consumption centers, ports, airports and major transportation corridors" },
    { id: "pld_build_inputs", ticker: null, name: "Construction Materials & Building Systems", role: "steel, concrete, roofing, mechanical, electrical and other inputs required to develop logistics facilities" },

    // UPSTREAM LAYER -3 — DEVELOPMENT / ENTITLEMENT
    { id: "pld_site_acquisition", ticker: null, name: "Site Acquisition & Entitlement", role: "land sourcing, zoning, permitting and entitlement activity preparing sites for logistics development" },
    { id: "pld_construction", ticker: null, name: "Logistics Facility Construction", role: "warehouse, distribution and specialized logistics facility development and redevelopment" },
    { id: "pld_power_infra", ticker: null, name: "Power, Solar & Energy Infrastructure", role: "electrical interconnection, rooftop solar, storage and related energy infrastructure supporting customer sites" },

    // UPSTREAM LAYER -2 — OPERATING ASSET CREATION
    { id: "pld_last_touch", ticker: null, name: "Last-Touch Logistics Facilities", role: "urban infill facilities positioned close to population and consumption centers for rapid distribution" },
    { id: "pld_regional_dc", ticker: null, name: "Regional / National Distribution Centers", role: "large logistics facilities supporting regional replenishment and national distribution networks" },
    { id: "pld_import_gateway", ticker: null, name: "Import / Gateway Logistics Facilities", role: "properties near ports, airports and intermodal nodes handling imported goods and high-throughput logistics" },

    // UPSTREAM LAYER -1 — PORTFOLIO OPERATIONS / CUSTOMER SOLUTIONS
    { id: "pld_leasing", ticker: null, name: "Leasing & Property Operations", role: "leasing, property management and recurring real-estate operations across Prologis logistics properties" },
    { id: "pld_essentials", ticker: null, name: "Prologis Essentials Solutions", role: "customer solutions spanning energy, mobility, operations and other services layered onto logistics real estate" },
    { id: "pld_strategic_capital", ticker: null, name: "Strategic Capital Platform", role: "co-investment and fund structures expanding the scale of Prologis-owned and managed logistics assets" },

    // CENTER
    { id: "pld", ticker: "PLD", name: "Prologis", role: "owns, develops and operates logistics real estate and related customer solutions at critical nodes in global supply chains" },

    // DOWNSTREAM LAYER +1 — MAJOR LOGISTICS CUSTOMERS
    { id: "amzn", ticker: "AMZN", name: "Amazon", role: "major e-commerce and logistics customer leasing Prologis distribution facilities" },
    { id: "hd", ticker: "HD", name: "Home Depot", role: "large retail customer using logistics facilities for inventory distribution and replenishment" },
    { id: "fdx", ticker: "FDX", name: "FedEx", role: "parcel and logistics customer using distribution facilities within the Prologis network" },
    { id: "ups", ticker: "UPS", name: "UPS", role: "parcel and logistics customer using industrial facilities for distribution operations" },
    { id: "wmt", ticker: "WMT", name: "Walmart", role: "large retail and distribution customer represented across Prologis logistics facilities" },

    // DOWNSTREAM LAYER +2 — GOODS FLOW / END MARKETS
    { id: "pld_ecommerce_flow", ticker: null, name: "E-Commerce Fulfillment & Last-Mile Flow", role: "consumer-order fulfillment and final-mile distribution enabled by customer occupancy of logistics facilities" },
    { id: "pld_retail_flow", ticker: null, name: "Retail Replenishment", role: "regional and national inventory flow supplying stores and omnichannel retail networks" },
    { id: "pld_parcel_freight", ticker: null, name: "Parcel, Freight & Third-Party Logistics", role: "parcel sortation, freight movement and 3PL activities operating from Prologis facilities" },
  ],

  edges: [
    // CAPITAL / LAND / CONSTRUCTION INPUTS → DEVELOPMENT / ENTITLEMENT
    { source: "pld_capital", target: "pld_site_acquisition" },
    { source: "pld_land", target: "pld_construction" },
    { source: "pld_build_inputs", target: "pld_power_infra" },

    // DEVELOPMENT / ENTITLEMENT → OPERATING ASSET CREATION
    { source: "pld_site_acquisition", target: "pld_last_touch" },
    { source: "pld_construction", target: "pld_regional_dc" },
    { source: "pld_power_infra", target: "pld_import_gateway" },

    // OPERATING ASSET CREATION → PORTFOLIO OPERATIONS / CUSTOMER SOLUTIONS
    { source: "pld_last_touch", target: "pld_leasing" },
    { source: "pld_regional_dc", target: "pld_essentials" },
    { source: "pld_import_gateway", target: "pld_strategic_capital" },

    // PORTFOLIO OPERATIONS / CUSTOMER SOLUTIONS → PLD
    { source: "pld_leasing", target: "pld" },
    { source: "pld_essentials", target: "pld" },
    { source: "pld_strategic_capital", target: "pld" },

    // PLD → MAJOR LOGISTICS CUSTOMERS
    { source: "pld", target: "amzn" },
    { source: "pld", target: "hd" },
    { source: "pld", target: "fdx" },
    { source: "pld", target: "ups" },
    { source: "pld", target: "wmt" },

    // MAJOR LOGISTICS CUSTOMERS → GOODS FLOW / END MARKETS
    { source: "amzn", target: "pld_ecommerce_flow" },
    { source: "hd", target: "pld_retail_flow" },
    { source: "fdx", target: "pld_parcel_freight" },
    { source: "ups", target: "pld_parcel_freight" },
    { source: "wmt", target: "pld_retail_flow" },

  ]
},

PH: {
  name: "Parker-Hannifin",
  root: "ph",
  nodes: [
    // UPSTREAM LAYER -4 — ENGINEERED MATERIAL INPUTS
    { id: "ph_metals", ticker: null, name: "Metals & Precision Material Inputs", role: "steel, aluminum, specialty alloys and machined-material inputs used across motion-control and aerospace products" },
    { id: "ph_polymers", ticker: null, name: "Polymers, Elastomers & Filter Media", role: "rubber, engineered polymers, sealing compounds and filtration media used in hoses, seals and filtration products" },
    { id: "ph_electronics", ticker: null, name: "Electronics, Sensors & Control Components", role: "electronic, sensor and control components incorporated into electromechanical and aerospace systems" },

    // UPSTREAM LAYER -3 — COMPONENT MANUFACTURING
    { id: "ph_motion_components", ticker: null, name: "Motion-Control Components", role: "valves, pumps, actuators, cylinders and related hydraulic or pneumatic components" },
    { id: "ph_sealing_filter_components", ticker: null, name: "Sealing, Hose & Filtration Components", role: "engineered seals, hoses, tubing, filtration elements and fluid-connectivity components" },
    { id: "ph_aero_components", ticker: null, name: "Aerospace & Electromechanical Components", role: "precision aerospace, fuel, thermal, electromechanical and control components" },

    // UPSTREAM LAYER -2 — TECHNOLOGY SYSTEMS
    { id: "ph_motion_systems", ticker: null, name: "Hydraulic, Pneumatic & Electromechanical Systems", role: "integrated motion-control systems combining valves, actuation, electronics and fluid-power technologies" },
    { id: "ph_process_filtration", ticker: null, name: "Filtration, Process Control & Engineered Materials", role: "integrated filtration and process-control products serving industrial and mobile applications" },
    { id: "ph_aerospace_systems", ticker: null, name: "Aerospace Systems", role: "flight-control, fuel, hydraulic, pneumatic, thermal-management and related aircraft systems" },

    // UPSTREAM LAYER -1 — ASSEMBLY / TEST / APPLICATION ENGINEERING
    { id: "ph_industrial_build", ticker: null, name: "Industrial Product Assembly & Test", role: "manufacturing, assembly and verification of Parker industrial components and systems" },
    { id: "ph_distribution_ready", ticker: null, name: "Configured Distribution Products", role: "standard and configured products prepared for Parker distributors, integrators and aftermarket customers" },
    { id: "ph_aero_build", ticker: null, name: "Aerospace Assembly, Qualification & Support", role: "aerospace-system assembly, certification support, spares and lifecycle service for aircraft programs" },

    // CENTER
    { id: "ph", ticker: "PH", name: "Parker-Hannifin", role: "manufactures motion and control technologies serving industrial, mobile, aerospace, process and aftermarket applications worldwide" },

    // DOWNSTREAM LAYER +1 — CUSTOMER CHANNELS
    { id: "ph_oems", ticker: null, name: "Industrial & Mobile OEMs", role: "original-equipment manufacturers integrating Parker technologies into machinery, vehicles and engineered systems" },
    { id: "ph_distributors", ticker: null, name: "Independent Industrial Distributors", role: "large global distribution network supplying Parker components to local industrial customers" },
    { id: "ph_aero_aftermarket", ticker: null, name: "Aerospace OEM & Aftermarket Customers", role: "aircraft manufacturers, airlines, defense operators and MRO channels purchasing Parker aerospace systems and spares" },

    // DOWNSTREAM LAYER +2 — END APPLICATIONS
    { id: "ph_factory_mobile", ticker: null, name: "Factory Automation & Mobile Equipment", role: "industrial machinery, robotics, construction and off-highway equipment using Parker motion-control technologies" },
    { id: "ph_energy_process", ticker: null, name: "Energy, Process & Climate Applications", role: "energy, filtration, HVAC/refrigeration and process applications using Parker engineered systems" },
    { id: "ph_aircraft", ticker: null, name: "Commercial & Defense Aircraft", role: "aircraft platforms and fleets relying on Parker aerospace systems throughout their operating life" },
  ],

  edges: [
    // ENGINEERED MATERIAL INPUTS → COMPONENT MANUFACTURING
    { source: "ph_metals", target: "ph_motion_components" },
    { source: "ph_polymers", target: "ph_sealing_filter_components" },
    { source: "ph_electronics", target: "ph_aero_components" },

    // COMPONENT MANUFACTURING → TECHNOLOGY SYSTEMS
    { source: "ph_motion_components", target: "ph_motion_systems" },
    { source: "ph_sealing_filter_components", target: "ph_process_filtration" },
    { source: "ph_aero_components", target: "ph_aerospace_systems" },

    // TECHNOLOGY SYSTEMS → ASSEMBLY / TEST / APPLICATION ENGINEERING
    { source: "ph_motion_systems", target: "ph_industrial_build" },
    { source: "ph_process_filtration", target: "ph_distribution_ready" },
    { source: "ph_aerospace_systems", target: "ph_aero_build" },

    // ASSEMBLY / TEST / APPLICATION ENGINEERING → PH
    { source: "ph_industrial_build", target: "ph" },
    { source: "ph_distribution_ready", target: "ph" },
    { source: "ph_aero_build", target: "ph" },

    // PH → CUSTOMER CHANNELS
    { source: "ph", target: "ph_oems" },
    { source: "ph", target: "ph_distributors" },
    { source: "ph", target: "ph_aero_aftermarket" },

    // CUSTOMER CHANNELS → END APPLICATIONS
    { source: "ph_oems", target: "ph_factory_mobile" },
    { source: "ph_distributors", target: "ph_energy_process" },
    { source: "ph_aero_aftermarket", target: "ph_aircraft" },

  ]
},

BKNG: {
  name: "Booking Holdings",
  root: "bkng",
  nodes: [
    // UPSTREAM LAYER -4 — TRAVEL / DINING INVENTORY
    { id: "bkng_accommodations", ticker: null, name: "Hotels, Homes & Accommodation Partners", role: "properties supplying room and alternative-accommodation inventory to Booking Holdings platforms" },
    { id: "bkng_airlines_cars", ticker: null, name: "Airlines, Rental Cars & Ground Transport", role: "travel providers supplying flight, rental-car and ground-transport inventory" },
    { id: "bkng_attractions", ticker: null, name: "Attractions & Travel Experience Providers", role: "experience and activity providers supplying bookable travel inventory" },
    { id: "bkng_restaurants", ticker: null, name: "Restaurant Partners", role: "restaurants supplying reservation inventory through OpenTable" },

    // UPSTREAM LAYER -3 — PARTNER CONNECTIVITY / TRANSACTION INPUTS
    { id: "bkng_inventory_connectivity", ticker: null, name: "Rates, Availability & Partner Connectivity", role: "APIs, extranet tools and connectivity systems ingesting partner prices, inventory and booking conditions" },
    { id: "bkng_payments_risk", ticker: null, name: "Payments, Fraud & Transaction Services", role: "payment facilitation, currency, fraud-management and transaction services supporting merchant and agency bookings" },
    { id: "bkng_search_marketing", ticker: null, name: "Search, Advertising & Demand Acquisition", role: "search, performance marketing, metasearch and brand-marketing inputs acquiring traveler and diner demand" },

    // UPSTREAM LAYER -2 — CONSUMER BRANDS / PLATFORMS
    { id: "booking_com", ticker: null, name: "Booking.com", role: "global accommodation-led travel platform offering lodging plus flights, cars, attractions and related services" },
    { id: "priceline_agoda", ticker: null, name: "Priceline & Agoda", role: "consumer travel brands serving U.S. and Asia-focused accommodation and travel demand" },
    { id: "kayak_opentable", ticker: null, name: "KAYAK & OpenTable", role: "travel metasearch and restaurant-reservation platforms within Booking Holdings" },

    // UPSTREAM LAYER -1 — MONETIZATION / BOOKING FLOWS
    { id: "bkng_merchant", ticker: null, name: "Merchant Booking Flow", role: "Booking Holdings collects consumer payment and remits partner consideration under merchant transactions" },
    { id: "bkng_agency", ticker: null, name: "Agency Booking Flow", role: "travel provider generally collects consumer payment and Booking earns commission on facilitated reservations" },
    { id: "bkng_advertising", ticker: null, name: "Advertising & Referral Flow", role: "advertising, referral and metasearch monetization generated from partner and consumer traffic" },

    // CENTER
    { id: "bkng", ticker: "BKNG", name: "Booking Holdings", role: "operates online travel and restaurant-reservation platforms including Booking.com, Priceline, Agoda, KAYAK and OpenTable" },

    // DOWNSTREAM LAYER +1 — CONSUMER DEMAND CHANNELS
    { id: "bkng_leisure", ticker: null, name: "Leisure Travelers", role: "consumers searching, comparing and booking accommodation, air, car and attraction inventory" },
    { id: "bkng_business", ticker: null, name: "Business Travelers", role: "corporate and individual business travelers booking travel through Booking Holdings platforms" },
    { id: "bkng_diners", ticker: null, name: "Diners", role: "consumers discovering and reserving restaurant tables through OpenTable" },

    // DOWNSTREAM LAYER +2 — COMPLETED SERVICES
    { id: "bkng_stays_trips", ticker: null, name: "Completed Stays & Trips", role: "hotel stays, flights, rental cars and activities delivered by travel-provider partners" },
    { id: "bkng_travel_conversion", ticker: null, name: "Travel Partner Revenue & Repeat Demand", role: "completed reservations generating partner revenue, Booking commissions and future repeat demand" },
    { id: "bkng_dining_visits", ticker: null, name: "Restaurant Reservations & Dining Visits", role: "completed restaurant reservations delivering diners to OpenTable restaurant partners" },
  ],

  edges: [
    // TRAVEL / DINING INVENTORY → PARTNER CONNECTIVITY / TRANSACTION INPUTS
    { source: "bkng_accommodations", target: "bkng_inventory_connectivity" },
    { source: "bkng_airlines_cars", target: "bkng_payments_risk" },
    { source: "bkng_attractions", target: "bkng_search_marketing" },
    { source: "bkng_restaurants", target: "bkng_inventory_connectivity" },

    // PARTNER CONNECTIVITY / TRANSACTION INPUTS → CONSUMER BRANDS / PLATFORMS
    { source: "bkng_inventory_connectivity", target: "booking_com" },
    { source: "bkng_payments_risk", target: "priceline_agoda" },
    { source: "bkng_search_marketing", target: "kayak_opentable" },

    // CONSUMER BRANDS / PLATFORMS → MONETIZATION / BOOKING FLOWS
    { source: "booking_com", target: "bkng_merchant" },
    { source: "priceline_agoda", target: "bkng_agency" },
    { source: "kayak_opentable", target: "bkng_advertising" },

    // MONETIZATION / BOOKING FLOWS → BKNG
    { source: "bkng_merchant", target: "bkng" },
    { source: "bkng_agency", target: "bkng" },
    { source: "bkng_advertising", target: "bkng" },

    // BKNG → CONSUMER DEMAND CHANNELS
    { source: "bkng", target: "bkng_leisure" },
    { source: "bkng", target: "bkng_business" },
    { source: "bkng", target: "bkng_diners" },

    // CONSUMER DEMAND CHANNELS → COMPLETED SERVICES
    { source: "bkng_leisure", target: "bkng_stays_trips" },
    { source: "bkng_business", target: "bkng_travel_conversion" },
    { source: "bkng_diners", target: "bkng_dining_visits" },

  ]
},

COF: {
  name: "Capital One Financial",
  root: "cof",
  nodes: [
    // UPSTREAM LAYER -4 — FUNDING / DATA INPUTS
    { id: "cof_depositors", ticker: null, name: "Consumer & Commercial Deposits", role: "retail and commercial deposits providing a major source of balance-sheet funding" },
    { id: "cof_debt_markets", ticker: null, name: "Wholesale Debt Markets", role: "secured and unsecured debt investors supplying term funding to Capital One" },
    { id: "cof_securitization_investors", ticker: null, name: "Asset-Backed Securitization Investors", role: "investors funding securitization vehicles backed by credit-card and auto receivables" },

    // UPSTREAM LAYER -3 — FUNDING / PAYMENT INFRASTRUCTURE
    { id: "cof_deposit_funding", ticker: null, name: "Deposit Funding Base", role: "operational deposit base funding credit-card, consumer-bank and commercial-bank assets" },
    { id: "cof_wholesale_funding", ticker: null, name: "Debt & Liquidity Funding", role: "capital-markets funding, liquidity reserves and treasury operations supporting lending activity" },
    { id: "cof_abs_funding", ticker: null, name: "Card & Auto Securitization Trusts", role: "securitization structures converting receivable cash flows into market funding" },

    // UPSTREAM LAYER -2 — RISK / BANKING / NETWORK OPERATIONS
    { id: "cof_credit_risk", ticker: null, name: "Credit Underwriting & Risk Analytics", role: "data, models and decision systems underwriting consumer and commercial credit risk" },
    { id: "cof_bank_ops", ticker: null, name: "Core Banking & Lending Operations", role: "account servicing, deposits, payments, auto finance and commercial lending operations" },
    { id: "cof_discover_network", ticker: null, name: "Discover / PULSE / Diners Network Operations", role: "payment-network infrastructure acquired with Discover supporting merchant, issuer and transaction connectivity" },

    // UPSTREAM LAYER -1 — PRODUCT PLATFORMS
    { id: "cof_cards", ticker: null, name: "Credit Card Business", role: "consumer and small-business card portfolios generating purchase volume, interest and fee revenue" },
    { id: "cof_consumer_bank", ticker: null, name: "Consumer Banking & Auto Finance", role: "deposit, digital banking and auto-lending products serving households and dealers" },
    { id: "cof_commercial_network", ticker: null, name: "Commercial Banking & Global Payment Network", role: "commercial lending and payments plus the acquired global Discover payment-network platform" },

    // CENTER
    { id: "cof", ticker: "COF", name: "Capital One Financial", role: "bank holding company providing credit cards, consumer banking, commercial banking and a global payment network following its acquisition of Discover" },

    // DOWNSTREAM LAYER +1 — CUSTOMER / ACCEPTANCE CHANNELS
    { id: "cof_consumers", ticker: null, name: "Cardholders, Depositors & Borrowers", role: "consumer customers using Capital One credit cards, deposits, auto loans and digital banking products" },
    { id: "cof_merchants_fis", ticker: null, name: "Merchants & Financial Institutions", role: "merchant acquirers, merchants, issuers and financial institutions interacting with Capital One payment networks" },
    { id: "cof_commercial_clients", ticker: null, name: "Commercial Clients", role: "companies and institutions using Capital One loans, treasury and commercial banking services" },

    // DOWNSTREAM LAYER +2 — ECONOMIC USE
    { id: "cof_household_spend", ticker: null, name: "Household Spending & Borrowing", role: "purchase transactions, saving and consumer credit activity generated by Capital One customers" },
    { id: "cof_payment_acceptance", ticker: null, name: "Merchant Payment Acceptance", role: "payment authorization, clearing and settlement activity across the Discover/PULSE/Diners network ecosystem" },
    { id: "cof_business_finance", ticker: null, name: "Business Financing & Treasury Activity", role: "working-capital, investment and cash-management needs served through commercial banking" },
  ],

  edges: [
    // FUNDING / DATA INPUTS → FUNDING / PAYMENT INFRASTRUCTURE
    { source: "cof_depositors", target: "cof_deposit_funding" },
    { source: "cof_debt_markets", target: "cof_wholesale_funding" },
    { source: "cof_securitization_investors", target: "cof_abs_funding" },

    // FUNDING / PAYMENT INFRASTRUCTURE → RISK / BANKING / NETWORK OPERATIONS
    { source: "cof_deposit_funding", target: "cof_credit_risk" },
    { source: "cof_wholesale_funding", target: "cof_bank_ops" },
    { source: "cof_abs_funding", target: "cof_discover_network" },

    // RISK / BANKING / NETWORK OPERATIONS → PRODUCT PLATFORMS
    { source: "cof_credit_risk", target: "cof_cards" },
    { source: "cof_bank_ops", target: "cof_consumer_bank" },
    { source: "cof_discover_network", target: "cof_commercial_network" },

    // PRODUCT PLATFORMS → COF
    { source: "cof_cards", target: "cof" },
    { source: "cof_consumer_bank", target: "cof" },
    { source: "cof_commercial_network", target: "cof" },

    // COF → CUSTOMER / ACCEPTANCE CHANNELS
    { source: "cof", target: "cof_consumers" },
    { source: "cof", target: "cof_merchants_fis" },
    { source: "cof", target: "cof_commercial_clients" },

    // CUSTOMER / ACCEPTANCE CHANNELS → ECONOMIC USE
    { source: "cof_consumers", target: "cof_household_spend" },
    { source: "cof_merchants_fis", target: "cof_payment_acceptance" },
    { source: "cof_commercial_clients", target: "cof_business_finance" },

  ]
},

TRV: {
  name: "The Travelers Companies",
  root: "trv",
  nodes: [
    // UPSTREAM LAYER -4 — RISK / CAPITAL INPUTS
    { id: "trv_exposure_data", ticker: null, name: "Customer Exposure & Claims Data", role: "property, operations, payroll, vehicle, claims and other exposure data used to evaluate insurance risk" },
    { id: "trv_cat_models", ticker: null, name: "Catastrophe, Weather & Actuarial Data", role: "catastrophe models, weather information and actuarial experience supporting pricing and accumulation management" },
    { id: "trv_reinsurance_capital", ticker: null, name: "Reinsurance & Investment Capital", role: "external reinsurance protection and internal capital supporting underwriting capacity and balance-sheet resilience" },

    // UPSTREAM LAYER -3 — UNDERWRITING / PRICING
    { id: "trv_business_underwriting", ticker: null, name: "Business Insurance Underwriting", role: "risk selection and pricing for commercial property, casualty, workers compensation and specialty lines" },
    { id: "trv_bond_underwriting", ticker: null, name: "Bond & Specialty Underwriting", role: "underwriting of management liability, surety, professional liability and other specialty risks" },
    { id: "trv_personal_underwriting", ticker: null, name: "Personal Insurance Underwriting", role: "pricing and underwriting of auto, homeowners and other personal insurance products" },

    // UPSTREAM LAYER -2 — INSURANCE PRODUCT PLATFORMS
    { id: "trv_business_products", ticker: null, name: "Business Insurance Products", role: "commercial insurance solutions distributed to small, middle-market and large-account customers" },
    { id: "trv_bond_products", ticker: null, name: "Bond & Specialty Products", role: "surety, management liability and specialty insurance products" },
    { id: "trv_personal_products", ticker: null, name: "Personal Insurance Products", role: "auto, homeowners and related personal property-casualty coverage" },

    // UPSTREAM LAYER -1 — DISTRIBUTION OPERATIONS
    { id: "trv_agent_platform", ticker: null, name: "Independent Agent Distribution", role: "technology, underwriting and service infrastructure supporting local and national independent agents" },
    { id: "trv_broker_platform", ticker: null, name: "Broker / Aggregator Distribution", role: "commercial broker, agency-aggregator and carrier-based agency channels distributing Travelers products" },
    { id: "trv_direct_affinity", ticker: null, name: "Direct, Affinity & Partner Platforms", role: "direct-to-consumer and affinity/partner channels supplementing agent and broker distribution" },

    // CENTER
    { id: "trv", ticker: "TRV", name: "The Travelers Companies", role: "property-casualty insurer offering business insurance, bond and specialty insurance, and personal insurance through independent and direct distribution channels" },

    // DOWNSTREAM LAYER +1 — SALES CHANNELS
    { id: "trv_agents", ticker: null, name: "Independent Agents", role: "local and national agencies placing business and personal insurance with Travelers" },
    { id: "trv_brokers", ticker: null, name: "Insurance Brokers & Aggregators", role: "brokers and agency networks distributing commercial and specialty Travelers policies" },
    { id: "trv_direct", ticker: null, name: "Direct & Affinity Channels", role: "digital, direct and partner-based channels serving selected customer segments" },

    // DOWNSTREAM LAYER +2 — POLICYHOLDERS
    { id: "trv_businesses", ticker: null, name: "Businesses & Institutions", role: "commercial policyholders purchasing property, casualty, workers compensation and specialty protection" },
    { id: "trv_public_entities", ticker: null, name: "Public Entities & Organizations", role: "governmental and institutional customers purchasing specialized insurance and risk solutions" },
    { id: "trv_households", ticker: null, name: "Individuals & Households", role: "personal-lines customers purchasing auto, homeowners and related coverage" },
  ],

  edges: [
    // RISK / CAPITAL INPUTS → UNDERWRITING / PRICING
    { source: "trv_exposure_data", target: "trv_business_underwriting" },
    { source: "trv_cat_models", target: "trv_bond_underwriting" },
    { source: "trv_reinsurance_capital", target: "trv_personal_underwriting" },

    // UNDERWRITING / PRICING → INSURANCE PRODUCT PLATFORMS
    { source: "trv_business_underwriting", target: "trv_business_products" },
    { source: "trv_bond_underwriting", target: "trv_bond_products" },
    { source: "trv_personal_underwriting", target: "trv_personal_products" },

    // INSURANCE PRODUCT PLATFORMS → DISTRIBUTION OPERATIONS
    { source: "trv_business_products", target: "trv_agent_platform" },
    { source: "trv_bond_products", target: "trv_broker_platform" },
    { source: "trv_personal_products", target: "trv_direct_affinity" },

    // DISTRIBUTION OPERATIONS → TRV
    { source: "trv_agent_platform", target: "trv" },
    { source: "trv_broker_platform", target: "trv" },
    { source: "trv_direct_affinity", target: "trv" },

    // TRV → SALES CHANNELS
    { source: "trv", target: "trv_agents" },
    { source: "trv", target: "trv_brokers" },
    { source: "trv", target: "trv_direct" },

    // SALES CHANNELS → POLICYHOLDERS
    { source: "trv_agents", target: "trv_businesses" },
    { source: "trv_brokers", target: "trv_public_entities" },
    { source: "trv_direct", target: "trv_households" },

  ]
},

SHW: {
  name: "Sherwin-Williams",
  root: "shw",
  nodes: [
    // UPSTREAM LAYER -4 — PETROCHEMICAL / MINERAL INPUTS
    { id: "shw_petchem_feedstocks", ticker: null, name: "Petrochemical Feedstocks", role: "propylene and other petrochemical inputs feeding resin, solvent and additive production used in coatings" },
    { id: "shw_pigment_minerals", ticker: null, name: "Pigments & Mineral Inputs", role: "titanium dioxide, color pigments, extenders and mineral inputs providing opacity, color and performance" },
    { id: "shw_packaging_inputs", ticker: null, name: "Metal & Plastic Packaging Inputs", role: "steel, plastic resin and packaging components used to produce paint cans, pails and other containers" },

    // UPSTREAM LAYER -3 — COATING RAW MATERIALS
    { id: "shw_resins_latex", ticker: null, name: "Resins & Latex", role: "binder systems and polymer emulsions providing adhesion, film formation and durability in paint and coatings" },
    { id: "shw_solvents_additives", ticker: null, name: "Solvents & Performance Additives", role: "solvents, dispersants, rheology modifiers and other additives controlling coating application and performance" },
    { id: "shw_colorants", ticker: null, name: "Pigments & Colorants", role: "pigment and tint systems blended into architectural and industrial coating formulations" },

    // UPSTREAM LAYER -2 — MANUFACTURING / FORMULATION
    { id: "shw_arch_mfg", ticker: null, name: "Architectural Paint Manufacturing", role: "batching, mixing and tint-base production for Sherwin-Williams branded architectural coatings" },
    { id: "shw_industrial_mfg", ticker: null, name: "Industrial / Performance Coatings Manufacturing", role: "formulation and manufacturing of automotive, packaging, protective, marine and other performance coatings" },
    { id: "shw_pack_fill", ticker: null, name: "Filling, Packaging & Labeling", role: "filling, packaging, labeling and palletization preparing finished coatings for distribution" },

    // UPSTREAM LAYER -1 — DISTRIBUTION NETWORK
    { id: "shw_paint_stores", ticker: null, name: "Sherwin-Williams Paint Stores Supply Network", role: "company distribution infrastructure replenishing thousands of Sherwin-Williams branded stores" },
    { id: "shw_retail_distribution", ticker: null, name: "Consumer Brands Retail Distribution", role: "distribution of consumer brands to home centers, hardware stores, dealers and other retail customers" },
    { id: "shw_industrial_branches", ticker: null, name: "Performance Coatings Branch / Direct Distribution", role: "branches and direct-sales channels supplying industrial and professional coating customers" },

    // CENTER
    { id: "shw", ticker: "SHW", name: "Sherwin-Williams", role: "manufactures and distributes architectural paint, industrial coatings and related products through company stores, retail partners and direct industrial channels" },

    // DOWNSTREAM LAYER +1 — RETAIL / PROFESSIONAL CHANNELS
    { id: "shw_stores", ticker: null, name: "Sherwin-Williams Stores", role: "company-operated stores selling architectural paint, supplies and services to professionals and DIY customers" },
    { id: "low", ticker: "LOW", name: "Lowe's", role: "major home-center retail partner carrying HGTV Home by Sherwin-Williams and other Sherwin-Williams consumer products" },
    { id: "shw_industrial_customers", ticker: null, name: "Industrial OEMs & Coating Applicators", role: "direct and branch-served customers using performance coatings in manufacturing, packaging, transportation and infrastructure" },

    // DOWNSTREAM LAYER +2 — END USERS
    { id: "shw_contractors", ticker: null, name: "Painting Contractors & Professionals", role: "professional painters and contractors purchasing coatings and supplies for residential and commercial projects" },
    { id: "shw_diy", ticker: null, name: "DIY Consumers", role: "homeowners purchasing paint and related products through Sherwin-Williams and retail channels" },
    { id: "shw_oem_enduse", ticker: null, name: "OEM & Industrial End Markets", role: "manufacturers and asset owners applying protective, packaging, automotive and industrial coatings" },
  ],

  edges: [
    // PETROCHEMICAL / MINERAL INPUTS → COATING RAW MATERIALS
    { source: "shw_petchem_feedstocks", target: "shw_resins_latex" },
    { source: "shw_pigment_minerals", target: "shw_solvents_additives" },
    { source: "shw_packaging_inputs", target: "shw_colorants" },

    // COATING RAW MATERIALS → MANUFACTURING / FORMULATION
    { source: "shw_resins_latex", target: "shw_arch_mfg" },
    { source: "shw_solvents_additives", target: "shw_industrial_mfg" },
    { source: "shw_colorants", target: "shw_pack_fill" },

    // MANUFACTURING / FORMULATION → DISTRIBUTION NETWORK
    { source: "shw_arch_mfg", target: "shw_paint_stores" },
    { source: "shw_industrial_mfg", target: "shw_retail_distribution" },
    { source: "shw_pack_fill", target: "shw_industrial_branches" },

    // DISTRIBUTION NETWORK → SHW
    { source: "shw_paint_stores", target: "shw" },
    { source: "shw_retail_distribution", target: "shw" },
    { source: "shw_industrial_branches", target: "shw" },

    // SHW → RETAIL / PROFESSIONAL CHANNELS
    { source: "shw", target: "shw_stores" },
    { source: "shw", target: "low" },
    { source: "shw", target: "shw_industrial_customers" },

    // RETAIL / PROFESSIONAL CHANNELS → END USERS
    { source: "shw_stores", target: "shw_contractors" },
    { source: "low", target: "shw_diy" },
    { source: "shw_industrial_customers", target: "shw_oem_enduse" },

  ]
},

HON: {
  name: "Honeywell",
  root: "hon",
  nodes: [
    // UPSTREAM LAYER -4 — MATERIAL / ELECTRONIC INPUTS
    { id: "hon_alloys", ticker: null, name: "Nickel, Titanium, Steel & Specialty Alloys", role: "metal inputs used across aerospace engines, mechanical systems, turbomachinery and industrial products" },
    { id: "hon_electronics", ticker: null, name: "Semiconductors, Sensors & Electronic Components", role: "processors, sensors, power electronics and circuit components used in avionics, controls and automation systems" },
    { id: "hon_chem_inputs", ticker: null, name: "Specialty Chemicals & Process Materials", role: "chemical feedstocks and engineered materials supporting energy, sustainability and industrial technology products" },

    // UPSTREAM LAYER -3 — COMPONENT / SUBSYSTEM MANUFACTURING
    { id: "hon_aero_components", ticker: null, name: "Aerospace Components & Turbomachinery", role: "engines, auxiliary power units, mechanical components and aerospace subsystems manufactured for aircraft platforms" },
    { id: "hon_controls", ticker: null, name: "Controls, Sensors & Automation Hardware", role: "controllers, sensors, safety devices and automation hardware used across industrial and building systems" },
    { id: "hon_process_tech", ticker: null, name: "Process & Energy Technology Components", role: "catalysts, process equipment and technology modules used in refining, chemicals and energy applications" },

    // UPSTREAM LAYER -2 — INTEGRATED TECHNOLOGY SYSTEMS
    { id: "hon_aerospace_systems", ticker: null, name: "Aerospace Technologies Systems", role: "avionics, propulsion, flight controls, navigation, connectivity and mechanical systems integrated for aerospace customers" },
    { id: "hon_building_industrial", ticker: null, name: "Building & Industrial Automation Systems", role: "integrated controls, sensing, safety and software platforms for buildings, factories and warehouses" },
    { id: "hon_ess_systems", ticker: null, name: "Energy & Sustainability Solutions", role: "process technologies, advanced materials and energy-transition solutions serving industrial customers" },

    // UPSTREAM LAYER -1 — FINAL INTEGRATION / SUPPORT
    { id: "hon_oem_delivery", ticker: null, name: "OEM Program Integration & Delivery", role: "qualification, certification and production delivery of Honeywell systems into major aerospace and industrial programs" },
    { id: "hon_aftermarket", ticker: null, name: "Aftermarket, Spares & Services", role: "repair, overhaul, spares, software and lifecycle support for installed Honeywell systems" },
    { id: "hon_solution_delivery", ticker: null, name: "Project Engineering & Solution Deployment", role: "engineering, systems integration and field deployment of automation, building and process solutions" },

    // CENTER
    { id: "hon", ticker: "HON", name: "Honeywell", role: "diversified industrial technology company supplying aerospace systems, automation, building technologies and energy / sustainability solutions" },

    // DOWNSTREAM LAYER +1 — MAJOR CUSTOMER CHANNELS
    { id: "ba", ticker: "BA", name: "Boeing", role: "major aerospace OEM customer integrating Honeywell avionics, mechanical and other aircraft systems" },
    { id: "lmt", ticker: "LMT", name: "Lockheed Martin", role: "major defense and aerospace prime served by Honeywell aerospace and mission-system technologies" },
    { id: "ual", ticker: "UAL", name: "United Airlines", role: "commercial airline aftermarket and fleet customer using Honeywell aircraft systems, components and services" },
    { id: "hon_industrial_customers", ticker: null, name: "Industrial & Building Customers", role: "building owners, industrial operators and energy customers deploying Honeywell automation, control and sustainability solutions" },

    // DOWNSTREAM LAYER +2 — OPERATING END MARKETS
    { id: "hon_commercial_aircraft", ticker: null, name: "Commercial Aircraft & Airline Fleets", role: "aircraft platforms and operating fleets consuming Honeywell original-equipment and aftermarket products" },
    { id: "hon_defense_space", ticker: null, name: "Defense & Space Missions", role: "military aircraft, space and mission systems using Honeywell aerospace technologies" },
    { id: "hon_buildings_industry", ticker: null, name: "Buildings, Factories & Energy Facilities", role: "commercial buildings, industrial sites and process facilities deploying Honeywell automation and sustainability technologies" },
  ],

  edges: [
    // MATERIAL / ELECTRONIC INPUTS → COMPONENT / SUBSYSTEM MANUFACTURING
    { source: "hon_alloys", target: "hon_aero_components" },
    { source: "hon_electronics", target: "hon_controls" },
    { source: "hon_chem_inputs", target: "hon_process_tech" },

    // COMPONENT / SUBSYSTEM MANUFACTURING → INTEGRATED TECHNOLOGY SYSTEMS
    { source: "hon_aero_components", target: "hon_aerospace_systems" },
    { source: "hon_controls", target: "hon_building_industrial" },
    { source: "hon_process_tech", target: "hon_ess_systems" },

    // INTEGRATED TECHNOLOGY SYSTEMS → FINAL INTEGRATION / SUPPORT
    { source: "hon_aerospace_systems", target: "hon_oem_delivery" },
    { source: "hon_building_industrial", target: "hon_aftermarket" },
    { source: "hon_ess_systems", target: "hon_solution_delivery" },

    // FINAL INTEGRATION / SUPPORT → HON
    { source: "hon_oem_delivery", target: "hon" },
    { source: "hon_aftermarket", target: "hon" },
    { source: "hon_solution_delivery", target: "hon" },

    // HON → MAJOR CUSTOMER CHANNELS
    { source: "hon", target: "ba" },
    { source: "hon", target: "lmt" },
    { source: "hon", target: "ual" },
    { source: "hon", target: "hon_industrial_customers" },

    // MAJOR CUSTOMER CHANNELS → OPERATING END MARKETS
    { source: "ba", target: "hon_commercial_aircraft" },
    { source: "lmt", target: "hon_defense_space" },
    { source: "ual", target: "hon_commercial_aircraft" },
    { source: "hon_industrial_customers", target: "hon_buildings_industry" },

  ]
},

MMM: {
  name: "3M",
  root: "mmm",
  nodes: [
    // UPSTREAM LAYER -4 — RAW MATERIAL INPUTS
    { id: "mmm_chemicals", ticker: null, name: "Chemicals, Resins & Adhesive Inputs", role: "chemical feedstocks, polymers and resin systems used across 3M adhesives, coatings, films and engineered products" },
    { id: "mmm_minerals_fibers", ticker: null, name: "Minerals, Fibers & Nonwoven Inputs", role: "abrasive minerals, fibers, nonwovens and reinforcement materials used in industrial and safety products" },
    { id: "mmm_film_pack_inputs", ticker: null, name: "Film, Paper & Packaging Inputs", role: "film substrates, paper products and packaging materials supporting converted products and finished-goods delivery" },

    // UPSTREAM LAYER -3 — MATERIAL SCIENCE / CONVERSION
    { id: "mmm_adhesive_coating", ticker: null, name: "Adhesive & Coating Formulation", role: "3M material-science processes producing adhesive, coating and surface-treatment chemistries" },
    { id: "mmm_film_conversion", ticker: null, name: "Film, Abrasive & Nonwoven Conversion", role: "coating, laminating, precision web handling and converting operations creating tapes, abrasives and engineered films" },
    { id: "mmm_component_molding", ticker: null, name: "Molding & Component Fabrication", role: "fabrication of molded, electrical, safety and other engineered components" },

    // UPSTREAM LAYER -2 — PRODUCT MANUFACTURING
    { id: "mmm_safety_industrial", ticker: null, name: "Safety & Industrial Manufacturing", role: "production of tapes, abrasives, personal-safety, electrical and industrial products" },
    { id: "mmm_transport_electronics", ticker: null, name: "Transportation & Electronics Manufacturing", role: "production of materials and components serving electronics, automotive, aerospace and transportation customers" },
    { id: "mmm_consumer_mfg", ticker: null, name: "Consumer Product Manufacturing", role: "production of home-improvement, stationery and consumer products sold under 3M brands" },

    // UPSTREAM LAYER -1 — PACKAGING / REGIONAL FULFILLMENT
    { id: "mmm_industrial_fulfillment", ticker: null, name: "Industrial / OEM Fulfillment", role: "regional inventory and direct fulfillment serving manufacturers and industrial customers" },
    { id: "mmm_distribution_fulfillment", ticker: null, name: "Distributor & Dealer Fulfillment", role: "finished-goods distribution supplying wholesalers, distributors, jobbers and dealers" },
    { id: "mmm_retail_ecom_fulfillment", ticker: null, name: "Retail & E-Commerce Fulfillment", role: "packaging and fulfillment serving physical retailers and digital commerce channels" },

    // CENTER
    { id: "mmm", ticker: "MMM", name: "3M", role: "materials-science and manufacturing company serving industrial, transportation, electronics, safety and consumer markets with a broad portfolio of engineered products" },

    // DOWNSTREAM LAYER +1 — SALES CHANNELS
    { id: "mmm_direct_oem", ticker: null, name: "Direct Industrial & OEM Customers", role: "manufacturers and large enterprises buying 3M products directly for production and operations" },
    { id: "mmm_distributors", ticker: null, name: "Wholesalers, Distributors & Dealers", role: "intermediaries reselling 3M industrial, safety and commercial products to end users" },
    { id: "mmm_retail_ecom", ticker: null, name: "Retail & E-Commerce Channels", role: "retailers and online channels distributing 3M consumer and professional products" },

    // DOWNSTREAM LAYER +2 — END APPLICATIONS
    { id: "mmm_industry", ticker: null, name: "Manufacturing, Electronics & Transportation", role: "factories, electronics production and transportation applications consuming 3M engineered materials" },
    { id: "mmm_safety_construction", ticker: null, name: "Worker Safety & Construction", role: "industrial safety, maintenance, construction and infrastructure applications" },
    { id: "mmm_home_office", ticker: null, name: "Home, Office & Consumer Use", role: "households and offices using tapes, stationery, cleaning and home-improvement products" },
  ],

  edges: [
    // RAW MATERIAL INPUTS → MATERIAL SCIENCE / CONVERSION
    { source: "mmm_chemicals", target: "mmm_adhesive_coating" },
    { source: "mmm_minerals_fibers", target: "mmm_film_conversion" },
    { source: "mmm_film_pack_inputs", target: "mmm_component_molding" },

    // MATERIAL SCIENCE / CONVERSION → PRODUCT MANUFACTURING
    { source: "mmm_adhesive_coating", target: "mmm_safety_industrial" },
    { source: "mmm_film_conversion", target: "mmm_transport_electronics" },
    { source: "mmm_component_molding", target: "mmm_consumer_mfg" },

    // PRODUCT MANUFACTURING → PACKAGING / REGIONAL FULFILLMENT
    { source: "mmm_safety_industrial", target: "mmm_industrial_fulfillment" },
    { source: "mmm_transport_electronics", target: "mmm_distribution_fulfillment" },
    { source: "mmm_consumer_mfg", target: "mmm_retail_ecom_fulfillment" },

    // PACKAGING / REGIONAL FULFILLMENT → MMM
    { source: "mmm_industrial_fulfillment", target: "mmm" },
    { source: "mmm_distribution_fulfillment", target: "mmm" },
    { source: "mmm_retail_ecom_fulfillment", target: "mmm" },

    // MMM → SALES CHANNELS
    { source: "mmm", target: "mmm_direct_oem" },
    { source: "mmm", target: "mmm_distributors" },
    { source: "mmm", target: "mmm_retail_ecom" },

    // SALES CHANNELS → END APPLICATIONS
    { source: "mmm_direct_oem", target: "mmm_industry" },
    { source: "mmm_distributors", target: "mmm_safety_construction" },
    { source: "mmm_retail_ecom", target: "mmm_home_office" },

  ]
},

NKE: {
  name: "NIKE",
  root: "nke",
  nodes: [
    // UPSTREAM LAYER -4 — RAW MATERIAL INPUTS
    { id: "nke_rubber_foam", ticker: null, name: "Rubber, Foams & Polymer Compounds", role: "rubber, plastic compounds, foams and polyurethane materials used in footwear soles, cushioning and structural components" },
    { id: "nke_textiles", ticker: null, name: "Polyester, Nylon & Textile Inputs", role: "synthetic and natural textiles, yarns and fabrics used across footwear uppers and apparel products" },
    { id: "nke_leather_materials", ticker: null, name: "Leather & Specialty Material Inputs", role: "leather, films, coatings and specialty materials used across selected footwear, apparel and equipment products" },

    // UPSTREAM LAYER -3 — TIER-2 MATERIAL / COMPONENT SUPPLY
    { id: "nke_tier2_footwear", ticker: null, name: "Tier-2 Footwear Material Suppliers", role: "strategic material suppliers producing textiles, synthetics, compounds and components for Nike footwear factories" },
    { id: "nke_tier2_apparel", ticker: null, name: "Tier-2 Apparel Material Suppliers", role: "fabric mills and material suppliers producing knit, woven and performance textiles for apparel manufacturers" },
    { id: "nke_air_components", ticker: null, name: "Air-Sole & Cushioning Components", role: "Nike Air Manufacturing Innovation and contract-manufacturing supply producing Air-Sole and cushioning components" },

    // UPSTREAM LAYER -2 — CONTRACT MANUFACTURING
    { id: "nke_footwear_cms", ticker: null, name: "Independent Footwear Contract Manufacturers", role: "independent factories, concentrated in countries including Vietnam, Indonesia and China, manufacturing substantially all Nike footwear" },
    { id: "nke_apparel_cms", ticker: null, name: "Independent Apparel Contract Manufacturers", role: "independent factories manufacturing Nike apparel across a diversified global sourcing network" },
    { id: "nke_equipment_cms", ticker: null, name: "Equipment & Accessory Contract Manufacturers", role: "independent manufacturers producing sports equipment, bags, accessories and other Nike products" },

    // UPSTREAM LAYER -1 — QUALITY / CONSOLIDATION / DISTRIBUTION
    { id: "nke_quality", ticker: null, name: "Nike Quality, Compliance & Product Release", role: "product-quality, sourcing, compliance and release processes governing externally manufactured Nike products" },
    { id: "nke_global_dc", ticker: null, name: "Global Distribution Centers", role: "Nike-operated and third-party distribution infrastructure receiving finished products and allocating inventory by market" },
    { id: "nke_regional_fulfillment", ticker: null, name: "Regional Store / Digital / Wholesale Fulfillment", role: "regional fulfillment supplying Nike Direct channels and wholesale partners" },

    // CENTER
    { id: "nke", ticker: "NKE", name: "NIKE", role: "designs, markets and sells athletic footwear, apparel, equipment and accessories while relying on a global network of independent contract manufacturers" },

    // DOWNSTREAM LAYER +1 — DIRECT / WHOLESALE CHANNELS
    { id: "nke_direct", ticker: null, name: "NIKE Direct", role: "Nike-owned stores and digital commerce channels selling products directly to consumers" },
    { id: "dks", ticker: "DKS", name: "DICK'S Sporting Goods", role: "major U.S. sporting-goods wholesale partner selling Nike footwear, apparel and equipment" },
    { id: "scvl", ticker: "SCVL", name: "Shoe Carnival", role: "public U.S. footwear retailer with significant Nike product sales through its store and digital channels" },

    // DOWNSTREAM LAYER +2 — END DEMAND
    { id: "nke_consumers", ticker: null, name: "Athletes & Consumers", role: "global consumers purchasing Nike and Jordan footwear, apparel and equipment through direct and wholesale channels" },
    { id: "nke_wholesale_shoppers", ticker: null, name: "Wholesale Retail Shoppers", role: "customers purchasing Nike products through sporting-goods and footwear retail partners" },
    { id: "nke_retail_consumers", ticker: null, name: "Footwear Retail Consumers", role: "consumers purchasing Nike footwear through specialty and family-footwear retail channels" },
  ],

  edges: [
    // RAW MATERIAL INPUTS → TIER-2 MATERIAL / COMPONENT SUPPLY
    { source: "nke_rubber_foam", target: "nke_tier2_footwear" },
    { source: "nke_textiles", target: "nke_tier2_apparel" },
    { source: "nke_leather_materials", target: "nke_air_components" },

    // TIER-2 MATERIAL / COMPONENT SUPPLY → CONTRACT MANUFACTURING
    { source: "nke_tier2_footwear", target: "nke_footwear_cms" },
    { source: "nke_tier2_apparel", target: "nke_apparel_cms" },
    { source: "nke_air_components", target: "nke_equipment_cms" },

    // CONTRACT MANUFACTURING → QUALITY / CONSOLIDATION / DISTRIBUTION
    { source: "nke_footwear_cms", target: "nke_quality" },
    { source: "nke_apparel_cms", target: "nke_global_dc" },
    { source: "nke_equipment_cms", target: "nke_regional_fulfillment" },

    // QUALITY / CONSOLIDATION / DISTRIBUTION → NKE
    { source: "nke_quality", target: "nke" },
    { source: "nke_global_dc", target: "nke" },
    { source: "nke_regional_fulfillment", target: "nke" },

    // NKE → DIRECT / WHOLESALE CHANNELS
    { source: "nke", target: "nke_direct" },
    { source: "nke", target: "dks" },
    { source: "nke", target: "scvl" },

    // DIRECT / WHOLESALE CHANNELS → END DEMAND
    { source: "nke_direct", target: "nke_consumers" },
    { source: "dks", target: "nke_wholesale_shoppers" },
    { source: "scvl", target: "nke_retail_consumers" },

  ]
}

};

export default supplyChainTree;