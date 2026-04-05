const dependencyTree = {

  "Oil Prices": {
    up: [
      {
        name: "Energy Producers",
        direction: "up",
        magnitude: 9,
        speed: "immediate",
        confidence: 9,
        order: 1,
        whyShort: "Higher oil prices increase realized selling prices.",
        whyLong:
          "When oil prices rise, upstream energy producers usually benefit quickly because they can sell production at higher realized prices, which tends to improve revenue, cash flow, and margins.",
        stocks: ["XOM", "CVX", "COP", "EOG", "OXY"],
        next: [
          {
            name: "Oil Equipment Demand",
            direction: "up",
            magnitude: 7,
            speed: "delayed",
            confidence: 8,
            order: 2,
            whyShort: "Producers increase drilling and service spending.",
            whyLong:
              "As higher oil prices improve producer profitability, exploration and production companies often raise capital spending on drilling, completions, and maintenance, which increases demand for oilfield service and equipment providers.",
            stocks: ["SLB", "HAL", "BKR"]
          }
        ]
      },

      {
        name: "Oil Services",
        direction: "up",
        magnitude: 7,
        speed: "delayed",
        confidence: 8,
        order: 1,
        whyShort: "Higher producer spending lifts service demand.",
        whyLong:
          "When oil prices remain elevated, producers often expand drilling and field activity, which increases demand for oilfield services, equipment, and well support.",
        stocks: ["SLB", "HAL", "BKR"],
        next: [
          {
            name: "Offshore Drilling",
            direction: "up",
            magnitude: 6,
            speed: "structural",
            confidence: 7,
            order: 2,
            whyShort: "Longer-cycle offshore projects become more attractive.",
            whyLong:
              "Sustained higher oil prices can improve the economics of offshore projects, encouraging producers to approve or expand longer-cycle drilling programs.",
            stocks: ["RIG", "VAL"]
          }
        ]
      },

      {
        name: "Refiners",
        direction: "up",
        magnitude: 6,
        speed: "fast",
        confidence: 6,
        order: 1,
        whyShort: "Refining margins can improve if product prices outpace crude.",
        whyLong:
          "Refiners do not always benefit from higher oil prices, but they can when refined product prices rise faster than crude input costs, expanding crack spreads.",
        stocks: ["VLO", "MPC", "PSX"],
        next: [
          {
            name: "Crack Spread Expansion",
            direction: "up",
            magnitude: 7,
            speed: "fast",
            confidence: 6,
            order: 2,
            whyShort: "Product pricing outpaces crude costs.",
            whyLong:
              "If gasoline, diesel, and other refined products rise more than crude oil, refinery margins can expand and support earnings.",
            stocks: ["VLO", "MPC"]
          }
        ]
      },

      {
        name: "Airlines",
        direction: "down",
        magnitude: 9,
        speed: "immediate",
        confidence: 9,
        order: 1,
        whyShort: "Jet fuel costs rise and pressure margins.",
        whyLong:
          "Airlines are highly sensitive to fuel prices because jet fuel is a major operating expense. Higher oil prices usually raise costs quickly and can compress margins.",
        stocks: ["DAL", "UAL", "AAL", "LUV"],
        next: [
          {
            name: "Aircraft Orders",
            direction: "down",
            magnitude: 4,
            speed: "delayed",
            confidence: 5,
            order: 2,
            whyShort: "Margin pressure can reduce fleet expansion appetite.",
            whyLong:
              "If higher fuel costs materially weaken airline profitability, some carriers may become more cautious with fleet growth and aircraft purchasing decisions.",
            stocks: ["BA", "EADSY"]
          }
        ]
      },

{
  name: "Trucking",
  direction: "down",
  magnitude: 7,
  speed: "immediate",
  confidence: 9,
  order: 1,
  whyShort: "Higher diesel costs pressure trucking margins.",
  whyLong:
    "Trucking companies are highly exposed to diesel prices. When oil prices rise, fuel costs usually increase quickly, which can compress margins unless those costs are fully passed through to customers.",
  stocks: ["ODFL", "JBHT", "KNX", "SAIA"],
  next: [
    {
      name: "Freight Demand",
      direction: "down",
      magnitude: 5,
      speed: "fast",
      confidence: 7,
      order: 2,
      whyShort: "Higher transport costs can weaken shipping demand.",
      whyLong:
        "As fuel and transportation costs rise, some freight demand can soften and shipping volumes may come under pressure, especially in cost-sensitive end markets.",
      stocks: ["UPS", "FDX"]
    }
  ]
},

{
  name: "Shipping",
  direction: "down",
  magnitude: 6,
  speed: "fast",
  confidence: 7,
  order: 1,
  whyShort: "Higher bunker fuel costs pressure shipping profitability.",
  whyLong:
    "Shipping companies are affected by rising fuel costs because marine fuel is a meaningful operating expense. If higher fuel expenses are not fully offset by pricing, margins can come under pressure.",
  stocks: ["ZIM", "MATX", "DAC","SBLK"],
  next: [
    {
      name: "Container Rates",
      direction: "down",
      magnitude: 4,
      speed: "delayed",
      confidence: 5,
      order: 2,
      whyShort: "Higher costs can weaken shipping economics and rate support.",
      whyLong:
        "Higher oil prices can pressure shipping economics and contribute to weaker trade activity over time, which may reduce support for container rates depending on broader demand conditions.",
      stocks: ["ZIM", "MATX"]
    }
  ]
},

{
  name: "Cruise Lines",
  direction: "down",
  magnitude: 8,
  speed: "immediate",
  confidence: 8,
  order: 1,
  whyShort: "Fuel costs rise and pressure cruise operator margins.",
  whyLong:
    "Cruise lines are sensitive to fuel prices because marine fuel is a major operating cost. Higher oil prices can quickly pressure profitability unless companies offset the impact through pricing or hedging.",
  stocks: ["CCL", "RCL", "NCLH"],
  next: [
    {
      name: "Travel Demand",
      direction: "down",
      magnitude: 4,
      speed: "delayed",
      confidence: 6,
      order: 2,
      whyShort: "Higher trip costs can weigh on discretionary travel demand.",
      whyLong:
        "As fuel costs rise, ticket prices and total travel expenses can increase, which may reduce discretionary travel demand over time, especially for price-sensitive consumers.",
      stocks: ["CCL", "RCL"]
    }
  ]
},

{
  name: "Logistics",
  direction: "down",
  magnitude: 6,
  speed: "immediate",
  confidence: 8,
  order: 1,
  whyShort: "Transportation and fuel costs pressure logistics margins.",
  whyLong:
    "Logistics providers face rising transportation and fuel expenses when oil prices increase. If those costs are not fully passed on, profitability can weaken quickly.",
  stocks: ["UPS", "FDX", "EXPD"],
  next: [
    {
      name: "Freight Brokerage",
      direction: "down",
      magnitude: 5,
      speed: "fast",
      confidence: 7,
      order: 2,
      whyShort: "Higher transport costs can weaken brokerage spreads.",
      whyLong:
        "Freight brokers can see weaker spreads and softer demand when fuel and transportation costs rise, especially if customers resist higher pricing.",
      stocks: ["CHRW","RXO"]
    }
  ]
},

{
  name: "Retail",
  direction: "down",
  magnitude: 5,
  speed: "delayed",
  confidence: 7,
  order: 1,
  whyShort: "Freight and input costs rise, pressuring retail margins.",
  whyLong:
    "Retailers are affected by higher oil prices through increased transportation, shipping, packaging, and operating costs. Those pressures can compress margins, especially if consumer demand is too weak to support price increases.",
  stocks: ["WMT", "TGT", "COST", "AMZN"],
  next: [
    {
      name: "Consumer Spending",
      direction: "down",
      magnitude: 4,
      speed: "delayed",
      confidence: 6,
      order: 2,
      whyShort: "Higher energy costs can reduce consumer purchasing power.",
      whyLong:
        "When households spend more on gas and energy, they may have less disposable income for retail purchases, which can weigh on consumer spending over time.",
      stocks: ["WMT", "TGT"]
    }
  ]
},

{
  name: "Auto Manufacturers",
  direction: "down",
  magnitude: 5,
  speed: "delayed",
  confidence: 6,
  order: 1,
  whyShort: "Higher energy and transport costs can pressure auto demand and margins.",
  whyLong:
    "Auto manufacturers can be hurt by higher oil prices through rising supply chain and shipping costs, as well as weaker consumer affordability and demand for new vehicles.",
  stocks: ["GM", "F", "TSLA"],
  next: [
    {
      name: "Auto Parts Suppliers",
      direction: "down",
      magnitude: 5,
      speed: "delayed",
      confidence: 6,
      order: 2,
      whyShort: "Lower auto production and tighter margins pressure suppliers.",
      whyLong:
        "If automakers face weaker demand or margin pressure from higher costs, parts suppliers can also be affected through reduced production volumes and pricing pressure.",
      stocks: ["MGA", "LEA","APTV"]
    }
  ]
},

{
  name: "Chemical Companies",
  direction: "down",
  magnitude: 7,
  speed: "fast",
  confidence: 8,
  order: 1,
  whyShort: "Hydrocarbon-based input costs rise and pressure chemical margins.",
  whyLong:
    "Chemical companies often rely on oil- and gas-linked feedstocks. When oil prices rise, input costs can increase and margins may be pressured unless those costs are passed through to customers.",
  stocks: ["DOW", "LYB", "OLN","WLK"],
  next: [
    {
      name: "Petrochemical Feedstock Costs",
      direction: "up",
      magnitude: 8,
      speed: "immediate",
      confidence: 9,
      order: 2,
      whyShort: "Oil-linked feedstock costs rise quickly.",
      whyLong:
        "Many petrochemical feedstocks are directly or indirectly tied to oil prices, so rising crude often leads to higher raw material costs for chemical producers.",
      stocks: []
    }
  ]
}
],

  down: [

  {
    name: "Energy Producers",
    direction: "down",
    magnitude: 9,
    speed: "immediate",
    confidence: 9,
    order: 1,
    whyShort: "Lower oil prices reduce realized selling prices and cash flow.",
    whyLong:
      "When oil prices fall, upstream energy producers usually feel the impact quickly because they sell production at lower realized prices, which can reduce revenue, cash flow, and margins.",
    stocks: ["XOM", "CVX", "COP", "EOG", "OXY"],
    next: [
      {
        name: "Oil Equipment Demand",
        direction: "down",
        magnitude: 7,
        speed: "delayed",
        confidence: 8,
        order: 2,
        whyShort: "Lower producer profits reduce drilling and service spending.",
        whyLong:
          "As lower oil prices weaken producer profitability, exploration and production companies often cut capital spending on drilling, completions, and maintenance, reducing demand for oilfield service and equipment providers.",
        stocks: ["SLB", "HAL", "BKR"],
        next: [
          {
            name: "Offshore Drilling Activity",
            direction: "down",
            magnitude: 6,
            speed: "structural",
            confidence: 7,
            order: 3,
            whyShort: "Longer-cycle offshore projects become less attractive.",
            whyLong:
              "Sustained lower oil prices can reduce the economics of offshore projects, causing producers to delay or cancel longer-cycle drilling activity.",
            stocks: ["RIG", "VAL"],
            next: []
          }
        ]
      }
    ]
  },

  {
    name: "Oil Services",
    direction: "down",
    magnitude: 7,
    speed: "delayed",
    confidence: 8,
    order: 1,
    whyShort: "Lower producer spending reduces service demand.",
    whyLong:
      "When oil prices fall and producers cut drilling activity, demand for oilfield services, equipment, and support work tends to weaken.",
    stocks: ["SLB", "HAL", "BKR"],
    next: [
      {
        name: "Offshore Drilling",
        direction: "down",
        magnitude: 6,
        speed: "structural",
        confidence: 7,
        order: 2,
        whyShort: "Offshore activity weakens as project economics worsen.",
        whyLong:
          "Lower oil prices can make offshore projects less economical, reducing demand for offshore drilling rigs and related services.",
        stocks: ["RIG", "VAL"],
        next: [
          {
            name: "Energy Capital Expenditures",
            direction: "down",
            magnitude: 7,
            speed: "delayed",
            confidence: 8,
            order: 3,
            whyShort: "Lower oil prices reduce industry capex plans.",
            whyLong:
              "As returns decline, energy companies often become more cautious and reduce capital expenditures across drilling and development programs.",
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
    magnitude: 5,
    speed: "fast",
    confidence: 5,
    order: 1,
    whyShort: "Refiner performance can weaken if product prices fall faster than crude.",
    whyLong:
      "Refiners do not always move directly with oil prices. In some cases, falling oil can pressure refining profitability if refined product prices weaken more than crude inputs, compressing crack spreads.",
    stocks: ["VLO", "MPC", "PSX"],
    next: [
      {
        name: "Crack Spread Compression",
        direction: "down",
        magnitude: 6,
        speed: "fast",
        confidence: 6,
        order: 2,
        whyShort: "Product prices weaken relative to crude.",
        whyLong:
          "If gasoline, diesel, and other refined product prices fall faster than crude oil, crack spreads can compress and hurt refinery earnings.",
        stocks: ["VLO", "MPC"],
        next: [
          {
            name: "Refining Margins",
            direction: "down",
            magnitude: 7,
            speed: "fast",
            confidence: 7,
            order: 3,
            whyShort: "Compressed crack spreads reduce profitability.",
            whyLong:
              "When crack spreads narrow, refiners earn less on each barrel processed, which reduces refining margins and earnings power.",
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
    magnitude: 9,
    speed: "immediate",
    confidence: 9,
    order: 1,
    whyShort: "Lower jet fuel costs improve airline margins.",
    whyLong:
      "Airlines are highly sensitive to fuel prices because jet fuel is a major operating expense. Lower oil prices usually reduce costs quickly and can expand margins.",
    stocks: ["DAL", "UAL", "AAL", "LUV"],
    next: [
      {
        name: "Aircraft Orders",
        direction: "up",
        magnitude: 4,
        speed: "delayed",
        confidence: 5,
        order: 2,
        whyShort: "Stronger profitability can support fleet expansion.",
        whyLong:
          "If lower fuel costs improve airline profitability, carriers may become more willing to expand fleets or follow through on aircraft purchasing plans.",
        stocks: ["BA", "EADSY"],
        next: [
          {
            name: "Aerospace Manufacturing",
            direction: "up",
            magnitude: 4,
            speed: "structural",
            confidence: 5,
            order: 3,
            whyShort: "More aircraft demand can support manufacturing activity.",
            whyLong:
              "Higher aircraft demand can eventually benefit aerospace manufacturing through stronger order books and production schedules.",
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
    magnitude: 7,
    speed: "immediate",
    confidence: 9,
    order: 1,
    whyShort: "Lower diesel costs improve trucking margins.",
    whyLong:
      "Trucking companies are highly exposed to diesel prices. When oil prices fall, fuel costs usually decline quickly, which can improve margins if pricing remains stable.",
    stocks: ["ODFL", "JBHT", "KNX", "SAIA"],
    next: [
      {
        name: "Freight Demand",
        direction: "up",
        magnitude: 5,
        speed: "fast",
        confidence: 7,
        order: 2,
        whyShort: "Lower transport costs can support shipping demand.",
        whyLong:
          "As fuel and transportation costs fall, shipping becomes cheaper and some freight demand may improve, especially in cost-sensitive markets.",
        stocks: ["UPS", "FDX"],
        next: [
          {
            name: "E-commerce Shipping Volume",
            direction: "up",
            magnitude: 4,
            speed: "delayed",
            confidence: 6,
            order: 3,
            whyShort: "Cheaper logistics can support parcel and fulfillment activity.",
            whyLong:
              "Lower transportation costs can improve fulfillment economics and support parcel shipping activity over time, especially if broader consumer demand is stable.",
            stocks: ["AMZN", "UPS", "FDX"],
            next: []
          }
        ]
      }
    ]
  },

  {
    name: "Shipping",
    direction: "up",
    magnitude: 6,
    speed: "fast",
    confidence: 7,
    order: 1,
    whyShort: "Lower bunker fuel costs improve shipping profitability.",
    whyLong:
      "Shipping companies can benefit from lower oil prices because marine fuel is a meaningful operating cost. If fuel expenses fall and pricing holds up, margins can improve.",
    stocks: ["ZIM", "MATX", "DAC","SBLK"],
    next: [
      {
        name: "Container Rates",
        direction: "up",
        magnitude: 4,
        speed: "delayed",
        confidence: 5,
        order: 2,
        whyShort: "Better shipping economics can support container markets.",
        whyLong:
          "Lower fuel costs can improve shipping economics and support activity, though container rates also depend heavily on trade demand and capacity conditions.",
        stocks: ["ZIM", "MATX"],
        next: [
          {
            name: "Global Trade Activity",
            direction: "up",
            magnitude: 4,
            speed: "structural",
            confidence: 5,
            order: 3,
            whyShort: "Lower transport costs can support trade flows.",
            whyLong:
              "Cheaper energy and shipping costs can modestly support global trade activity over time by reducing transportation friction.",
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
    magnitude: 8,
    speed: "immediate",
    confidence: 8,
    order: 1,
    whyShort: "Lower fuel costs improve cruise operator margins.",
    whyLong:
      "Cruise lines are sensitive to fuel prices because marine fuel is a major operating cost. Lower oil prices can quickly improve profitability unless offset by weaker travel demand.",
    stocks: ["CCL", "RCL", "NCLH"],
    next: [
      {
        name: "Travel Demand",
        direction: "up",
        magnitude: 4,
        speed: "delayed",
        confidence: 6,
        order: 2,
        whyShort: "Lower trip costs can support discretionary travel demand.",
        whyLong:
          "As fuel costs fall, total travel expenses may ease, which can help support discretionary travel demand over time.",
        stocks: ["CCL", "RCL"],
        next: [
          {
            name: "Hospitality Sector",
            direction: "up",
            magnitude: 4,
            speed: "delayed",
            confidence: 5,
            order: 3,
            whyShort: "Stronger travel demand can benefit hospitality activity.",
            whyLong:
              "If lower travel costs support vacation demand, hotels and related hospitality businesses may also benefit over time.",
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
    magnitude: 6,
    speed: "immediate",
    confidence: 8,
    order: 1,
    whyShort: "Lower transportation and fuel costs improve logistics margins.",
    whyLong:
      "Logistics providers can benefit from falling oil prices through lower transportation and fuel expenses, especially when customer pricing does not fall as quickly.",
    stocks: ["UPS", "FDX", "CHRW"],
    next: [
      {
        name: "Freight Brokerage",
        direction: "up",
        magnitude: 5,
        speed: "fast",
        confidence: 7,
        order: 2,
        whyShort: "Lower transport costs can improve brokerage spreads.",
        whyLong:
          "Freight brokers may see better spreads and improved activity when transportation costs decline and pricing conditions stabilize.",
        stocks: ["CHRW"],
        next: [
          {
            name: "Supply Chain Activity",
            direction: "up",
            magnitude: 4,
            speed: "delayed",
            confidence: 5,
            order: 3,
            whyShort: "Cheaper freight can support broader supply chain throughput.",
            whyLong:
              "Lower logistics costs can modestly improve supply chain activity over time by making shipments and distribution more economical.",
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
    magnitude: 5,
    speed: "delayed",
    confidence: 7,
    order: 1,
    whyShort: "Lower freight and energy costs can support retail margins and demand.",
    whyLong:
      "Retailers can benefit from falling oil prices through lower transportation, shipping, packaging, and operating costs. Consumers may also have more disposable income when gas prices fall.",
    stocks: ["WMT", "TGT", "COST", "AMZN"],
    next: [
      {
        name: "Consumer Spending",
        direction: "up",
        magnitude: 5,
        speed: "delayed",
        confidence: 7,
        order: 2,
        whyShort: "Lower energy costs leave households with more spending power.",
        whyLong:
          "When households spend less on gas and energy, they may have more disposable income available for other purchases, supporting consumer spending.",
        stocks: ["WMT", "TGT"],
        next: [
          {
            name: "Discretionary Goods",
            direction: "up",
            magnitude: 4,
            speed: "delayed",
            confidence: 6,
            order: 3,
            whyShort: "More disposable income can support discretionary purchases.",
            whyLong:
              "As energy costs ease, some consumers may shift more spending toward discretionary categories over time.",
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
    magnitude: 5,
    speed: "delayed",
    confidence: 6,
    order: 1,
    whyShort: "Lower energy and transport costs can support auto demand and margins.",
    whyLong:
      "Auto manufacturers can benefit from lower oil prices through reduced supply chain and shipping costs, along with improved consumer affordability and demand conditions.",
    stocks: ["GM", "F", "TSLA"],
    next: [
      {
        name: "Auto Parts Suppliers",
        direction: "up",
        magnitude: 5,
        speed: "delayed",
        confidence: 6,
        order: 2,
        whyShort: "Stronger vehicle production can benefit suppliers.",
        whyLong:
          "If automakers see better demand and production conditions, parts suppliers can benefit through higher volumes and improved operating leverage.",
        stocks: ["MGA", "LEA","APTV"],
        next: [
          {
            name: "Vehicle Production",
            direction: "up",
            magnitude: 5,
            speed: "delayed",
            confidence: 6,
            order: 3,
            whyShort: "Improved demand and lower costs can support production.",
            whyLong:
              "Lower energy-related costs and healthier consumer conditions can support vehicle production plans over time.",
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
    magnitude: 7,
    speed: "fast",
    confidence: 8,
    order: 1,
    whyShort: "Lower hydrocarbon-based input costs can improve chemical margins.",
    whyLong:
      "Chemical companies often rely on oil- and gas-linked feedstocks. When oil prices fall, input costs can decline and margins may improve if selling prices hold up reasonably well.",
    stocks: ["DOW", "LYB", "OLN","WLK"],
    next: [
      {
        name: "Petrochemical Feedstock Costs",
        direction: "down",
        magnitude: 8,
        speed: "immediate",
        confidence: 9,
        order: 2,
        whyShort: "Oil-linked feedstock costs fall quickly.",
        whyLong:
          "Many petrochemical feedstocks are directly or indirectly tied to oil prices, so falling crude often leads to lower raw material costs for chemical producers.",
        stocks: [],
        next: [
          {
            name: "Chemical Margins",
            direction: "up",
            magnitude: 7,
            speed: "fast",
            confidence: 8,
            order: 3,
            whyShort: "Lower input costs can expand profitability.",
            whyLong:
              "When feedstock costs fall faster than product prices, chemical producers can see margin expansion and improved earnings.",
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
      magnitude: 9,
      speed: "immediate",
      confidence: 9,
      order: 1,
      whyShort: "Higher policy and market rates push mortgage borrowing costs higher.",
      whyLong:
        "When interest rates rise, mortgage rates usually move up quickly as financing costs increase across the housing market.",
      stocks: [],
      next: [
        {
          name: "Housing Affordability",
          direction: "down",
          magnitude: 9,
          speed: "immediate",
          confidence: 9,
          order: 2,
          whyShort: "Higher monthly payments reduce affordability.",
          whyLong:
            "As mortgage rates rise, monthly payments increase for the same home price, which reduces affordability for buyers.",
          stocks: [],
          next: [
            {
              name: "Housing Demand",
              direction: "down",
              magnitude: 8,
              speed: "fast",
              confidence: 9,
              order: 3,
              whyShort: "Less affordable homes reduce buyer demand.",
              whyLong:
                "When affordability worsens, fewer buyers can qualify or are willing to purchase homes, which weakens housing demand.",
              stocks: [],
              next: [
                {
                  name: "Homebuilders",
                  direction: "down",
                  magnitude: 8,
                  speed: "fast",
                  confidence: 8,
                  order: 4,
                  whyShort: "Lower housing demand pressures builder sales and margins.",
                  whyLong:
                    "Homebuilders are highly sensitive to mortgage-driven affordability. Higher rates usually weaken order growth, pricing power, and new home demand.",
                  stocks: ["DHI", "LEN", "PHM", "TOL"],
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
      magnitude: 8,
      speed: "immediate",
      confidence: 9,
      order: 1,
      whyShort: "Higher interest rates raise business financing costs.",
      whyLong:
        "As rates move higher, debt financing becomes more expensive for companies, especially for refinancing, expansion, and new projects.",
      stocks: [],
      next: [
        {
          name: "Corporate Investment",
          direction: "down",
          magnitude: 7,
          speed: "delayed",
          confidence: 8,
          order: 2,
          whyShort: "More expensive financing discourages investment.",
          whyLong:
            "Higher borrowing costs make projects less attractive and can cause firms to delay capital expenditures and expansion plans.",
          stocks: [],
          next: [
            {
              name: "Industrial Companies",
              direction: "down",
              magnitude: 6,
              speed: "delayed",
              confidence: 7,
              order: 3,
              whyShort: "Lower capex demand can pressure industrial activity.",
              whyLong:
                "Industrial firms can be hurt when business investment slows because demand for equipment, machinery, and related services softens.",
              stocks: ["CAT", "DE", "HON"],
              next: []
            }
          ]
        }
      ]
    },

    {
      name: "Tech Stock Valuations",
      direction: "down",
      magnitude: 8,
      speed: "immediate",
      confidence: 9,
      order: 1,
      whyShort: "Higher discount rates reduce the present value of future earnings.",
      whyLong:
        "Growth and tech stocks are especially rate-sensitive because more of their valuation depends on future cash flows, which are worth less when discount rates rise.",
      stocks: ["AAPL", "MSFT", "NVDA", "GOOGL", "AMZN"],
      next: [
        {
          name: "Growth Stock Multiples",
          direction: "down",
          magnitude: 8,
          speed: "immediate",
          confidence: 9,
          order: 2,
          whyShort: "Higher rates compress valuation multiples.",
          whyLong:
            "Higher interest rates often lead investors to pay lower earnings and revenue multiples for long-duration growth assets.",
          stocks: ["DDOG", "CRWD", "SNOW", "PLTR"],
          next: []
        }
      ]
    },

    {
      name: "Bank Net Interest Margins",
      direction: "up",
      magnitude: 6,
      speed: "fast",
      confidence: 7,
      order: 1,
      whyShort: "Banks can earn more on loans as rates rise.",
      whyLong:
        "Rising rates can improve bank net interest margins when asset yields reprice faster than funding costs, though the benefit depends on deposit competition and credit conditions.",
      stocks: ["JPM", "BAC", "WFC", "C"],
      next: [
        {
          name: "Bank Profitability",
          direction: "up",
          magnitude: 5,
          speed: "fast",
          confidence: 6,
          order: 2,
          whyShort: "Wider margins can support earnings.",
          whyLong:
            "If higher net interest margins outweigh deposit pressure and credit losses, bank profitability can improve.",
          stocks: ["JPM", "BAC", "WFC"],
          next: []
        }
      ]
    },

    {
      name: "Private Equity Activity",
      direction: "down",
      magnitude: 7,
      speed: "delayed",
      confidence: 8,
      order: 1,
      whyShort: "Higher financing costs reduce deal activity.",
      whyLong:
        "Private equity depends heavily on leverage. When rates rise, deal financing becomes more expensive and transaction activity often slows.",
      stocks: ["BX", "KKR", "APO"],
      next: [
        {
          name: "Leveraged Buyouts",
          direction: "down",
          magnitude: 8,
          speed: "delayed",
          confidence: 8,
          order: 2,
          whyShort: "More expensive debt reduces LBO attractiveness.",
          whyLong:
            "Because leveraged buyouts rely on debt-funded returns, rising rates can sharply reduce the economics of new transactions.",
          stocks: [],
          next: []
        }
      ]
    },

    {
      name: "Auto Loan Rates",
      direction: "up",
      magnitude: 7,
      speed: "immediate",
      confidence: 9,
      order: 1,
      whyShort: "Higher rates raise monthly financing costs for vehicles.",
      whyLong:
        "As rates rise, auto loans become more expensive, increasing monthly payments and reducing affordability for consumers.",
      stocks: [],
      next: [
        {
          name: "Vehicle Affordability",
          direction: "down",
          magnitude: 7,
          speed: "immediate",
          confidence: 9,
          order: 2,
          whyShort: "Higher payments reduce consumer affordability.",
          whyLong:
            "More expensive vehicle financing makes it harder for households to purchase new cars, especially in price-sensitive segments.",
          stocks: [],
          next: [
            {
              name: "Auto Manufacturers",
              direction: "down",
              magnitude: 6,
              speed: "fast",
              confidence: 8,
              order: 3,
              whyShort: "Lower affordability can reduce auto demand.",
              whyLong:
                "Automakers can be hurt when rising auto loan rates reduce consumer demand and put pressure on sales volumes.",
              stocks: ["GM", "F", "TSLA"],
              next: []
            }
          ]
        }
      ]
    },

    {
      name: "Commercial Real Estate Financing",
      direction: "up",
      magnitude: 8,
      speed: "fast",
      confidence: 8,
      order: 1,
      whyShort: "Higher rates increase CRE financing costs.",
      whyLong:
        "Commercial real estate is highly financing-sensitive. When rates rise, refinancing and new project economics become more difficult.",
      stocks: [],
      next: [
        {
          name: "Office Property Values",
          direction: "down",
          magnitude: 7,
          speed: "delayed",
          confidence: 8,
          order: 2,
          whyShort: "Higher financing costs and cap rates pressure values.",
          whyLong:
            "As financing becomes more expensive and required returns rise, office property values can decline, especially in already weak markets.",
          stocks: ["BXP", "VNO"],
          next: []
        }
      ]
    },

    {
      name: "Bond Yields",
      direction: "up",
      magnitude: 8,
      speed: "immediate",
      confidence: 9,
      order: 1,
      whyShort: "Higher interest rates push market yields upward.",
      whyLong:
        "When interest rates rise, bond yields typically move higher across the curve, increasing the opportunity cost of equities and pressuring valuations.",
      stocks: ["O", "AMT", "NEE"],
      next: [
        {
          name: "Equity Market Valuations",
          direction: "down",
          magnitude: 7,
          speed: "immediate",
          confidence: 9,
          order: 2,
          whyShort: "Higher yields make equities less attractive on a relative basis.",
          whyLong:
            "As bond yields rise, investors often demand lower equity valuations, especially in long-duration sectors where future cash flows matter most.",
          stocks: ["AAPL", "MSFT", "NVDA", "AMZN"],
          next: []
        }
      ]
    }
  ],

down: [

  {
    name: "Mortgage Rates",
    direction: "down",
    magnitude: 9,
    speed: "immediate",
    confidence: 9,
    order: 1,
    whyShort: "Lower interest rates reduce mortgage borrowing costs.",
    whyLong:
      "When interest rates fall, mortgage rates usually move lower quickly, reducing financing costs across the housing market.",
    stocks: [],
    next: [
      {
        name: "Housing Affordability",
        direction: "up",
        magnitude: 9,
        speed: "immediate",
        confidence: 9,
        order: 2,
        whyShort: "Lower monthly payments improve affordability.",
        whyLong:
          "As mortgage rates decline, monthly payments fall for the same home price, making homes more affordable for buyers.",
        stocks: [],
        next: [
          {
            name: "Housing Demand",
            direction: "up",
            magnitude: 8,
            speed: "fast",
            confidence: 9,
            order: 3,
            whyShort: "Better affordability increases buyer demand.",
            whyLong:
              "When affordability improves, more buyers can qualify or become willing to purchase homes, which supports housing demand.",
            stocks: [],
            next: [
              {
                name: "Homebuilders",
                direction: "up",
                magnitude: 8,
                speed: "fast",
                confidence: 8,
                order: 4,
                whyShort: "Stronger housing demand supports builder sales and margins.",
                whyLong:
                  "Homebuilders are highly sensitive to mortgage-driven affordability. Lower rates usually support order growth, pricing power, and new home demand.",
                stocks: ["DHI", "LEN", "PHM", "TOL"],
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
    magnitude: 8,
    speed: "immediate",
    confidence: 9,
    order: 1,
    whyShort: "Lower interest rates reduce business financing costs.",
    whyLong:
      "As rates move lower, debt financing becomes cheaper for companies, which can support refinancing, expansion, and new projects.",
    stocks: [],
    next: [
      {
        name: "Corporate Investment",
        direction: "up",
        magnitude: 7,
        speed: "delayed",
        confidence: 8,
        order: 2,
        whyShort: "Cheaper financing encourages investment.",
        whyLong:
          "Lower borrowing costs make more projects attractive and can encourage firms to increase capital expenditures and expansion plans.",
        stocks: [],
        next: [
          {
            name: "Industrial Companies",
            direction: "up",
            magnitude: 6,
            speed: "delayed",
            confidence: 7,
            order: 3,
            whyShort: "Higher capex demand can support industrial activity.",
            whyLong:
              "Industrial firms can benefit when business investment strengthens because demand for equipment, machinery, and related services improves.",
            stocks: ["CAT", "DE", "HON"],
            next: []
          }
        ]
      }
    ]
  },

  {
    name: "Tech Stock Valuations",
    direction: "up",
    magnitude: 8,
    speed: "immediate",
    confidence: 9,
    order: 1,
    whyShort: "Lower discount rates lift the present value of future earnings.",
    whyLong:
      "Growth and tech stocks are especially rate-sensitive because more of their valuation depends on future cash flows, which become more valuable when discount rates fall.",
    stocks: ["AAPL", "MSFT", "NVDA", "ADBE", "AMZN"],
    next: [
      {
        name: "Growth Stock Multiples",
        direction: "up",
        magnitude: 8,
        speed: "immediate",
        confidence: 9,
        order: 2,
        whyShort: "Lower rates support higher valuation multiples.",
        whyLong:
          "Falling interest rates often lead investors to pay higher earnings and revenue multiples for long-duration growth assets.",
        stocks: ["DDOG", "CRWD", "SNOW", "PLTR"],
        next: []
      }
    ]
  },

  {
    name: "Bank Net Interest Margins",
    direction: "down",
    magnitude: 5,
    speed: "fast",
    confidence: 6,
    order: 1,
    whyShort: "Lower rates can compress loan yields and pressure margins.",
    whyLong:
      "Falling rates can reduce bank net interest margins if asset yields decline faster than funding costs. The impact varies depending on deposit pricing, loan mix, and funding structure.",
    stocks: ["JPM", "BAC", "WFC", "C"],
    next: [
      {
        name: "Bank Profitability",
        direction: "down",
        magnitude: 4,
        speed: "fast",
        confidence: 5,
        order: 2,
        whyShort: "Narrower margins can weigh on earnings.",
        whyLong:
          "If lower net interest margins are not offset by stronger loan growth or lower credit losses, bank profitability can come under pressure.",
        stocks: ["JPM", "BAC", "WFC"],
        next: []
      }
    ]
  },

  {
    name: "Private Equity Activity",
    direction: "up",
    magnitude: 7,
    speed: "delayed",
    confidence: 8,
    order: 1,
    whyShort: "Lower financing costs support deal activity.",
    whyLong:
      "Private equity depends heavily on leverage. When rates fall, deal financing becomes cheaper and transaction activity often improves.",
    stocks: ["BX", "KKR", "APO"],
    next: [
      {
        name: "Leveraged Buyouts",
        direction: "up",
        magnitude: 8,
        speed: "delayed",
        confidence: 8,
        order: 2,
        whyShort: "Cheaper debt improves LBO economics.",
        whyLong:
          "Because leveraged buyouts rely on debt-funded returns, falling rates can significantly improve the attractiveness of new transactions.",
        stocks: [],
        next: []
      }
    ]
  },

  {
    name: "Auto Loan Rates",
    direction: "down",
    magnitude: 7,
    speed: "immediate",
    confidence: 9,
    order: 1,
    whyShort: "Lower rates reduce monthly financing costs for vehicles.",
    whyLong:
      "As rates fall, auto loans become cheaper, lowering monthly payments and improving affordability for consumers.",
    stocks: [],
    next: [
      {
        name: "Vehicle Affordability",
        direction: "up",
        magnitude: 7,
        speed: "immediate",
        confidence: 9,
        order: 2,
        whyShort: "Lower payments improve consumer affordability.",
        whyLong:
          "Cheaper vehicle financing makes it easier for households to purchase new cars, especially in price-sensitive segments.",
        stocks: [],
        next: [
          {
            name: "Auto Manufacturers",
            direction: "up",
            magnitude: 6,
            speed: "fast",
            confidence: 8,
            order: 3,
            whyShort: "Better affordability can support auto demand.",
            whyLong:
              "Automakers can benefit when lower auto loan rates support consumer demand and improve sales volumes.",
            stocks: ["GM", "F", "TSLA"],
            next: []
          }
        ]
      }
    ]
  },

  {
    name: "Commercial Real Estate Financing",
    direction: "down",
    magnitude: 8,
    speed: "fast",
    confidence: 8,
    order: 1,
    whyShort: "Lower rates reduce CRE financing costs.",
    whyLong:
      "Commercial real estate is highly financing-sensitive. When rates fall, refinancing and new project economics become easier to support.",
    stocks: [],
    next: [
      {
        name: "Office Property Values",
        direction: "up",
        magnitude: 6,
        speed: "delayed",
        confidence: 7,
        order: 2,
        whyShort: "Lower financing costs and cap rates can support values.",
        whyLong:
          "As financing becomes cheaper and required returns fall, office property values can improve, though the effect may be limited in structurally weak office markets.",
        stocks: ["BXP", "VNO"],
        next: []
      }
    ]
  },

  {
    name: "Bond Yields",
    direction: "down",
    magnitude: 8,
    speed: "immediate",
    confidence: 9,
    order: 1,
    whyShort: "Lower interest rates push market yields downward.",
    whyLong:
      "When interest rates fall, bond yields typically move lower across the curve, reducing the opportunity cost of equities and supporting valuations.",
    stocks: ["O", "AMT", "NEE"],
    next: [
      {
        name: "Equity Market Valuations",
        direction: "up",
        magnitude: 7,
        speed: "immediate",
        confidence: 9,
        order: 2,
        whyShort: "Lower yields make equities more attractive on a relative basis.",
        whyLong:
          "As bond yields fall, investors often accept higher equity valuations, especially in long-duration sectors where future cash flows matter most.",
        stocks: ["AAPL", "MSFT", "NVDA", "AMZN"],
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
      magnitude: 8,
      speed: "fast",
      confidence: 8,
      order: 1,
      whyShort: "Higher inflation often leads to tighter monetary policy and higher rates.",
      whyLong:
        "When inflation rises, central banks often respond by tightening policy or keeping rates higher for longer, which pushes interest rates upward across the economy.",
      stocks: [],
      next: [
        {
          name: "Borrowing Costs",
          direction: "up",
          magnitude: 8,
          speed: "fast",
          confidence: 9,
          order: 2,
          whyShort: "Higher rates make loans and financing more expensive.",
          whyLong:
            "As interest rates move higher, borrowing costs rise for households and businesses, which can weigh on investment and spending activity.",
          stocks: [],
          next: [
            {
              name: "Economic Growth",
              direction: "down",
              magnitude: 7,
              speed: "delayed",
              confidence: 8,
              order: 3,
              whyShort: "More expensive credit can slow economic activity.",
              whyLong:
                "Higher borrowing costs tend to reduce business investment, consumer spending, and housing activity, which can slow overall economic growth.",
              stocks: ["AAPL", "MSFT", "NVDA", "AMZN"],
              next: []
            }
          ]
        }
      ]
    },

    {
      name: "Consumer Purchasing Power",
      direction: "down",
      magnitude: 8,
      speed: "fast",
      confidence: 9,
      order: 1,
      whyShort: "Higher prices reduce what household income can buy.",
      whyLong:
        "When inflation rises faster than wages, consumers lose real purchasing power, leaving less income available for discretionary spending.",
      stocks: [],
      next: [
        {
          name: "Consumer Spending",
          direction: "down",
          magnitude: 7,
          speed: "delayed",
          confidence: 8,
          order: 2,
          whyShort: "Weaker purchasing power can reduce spending.",
          whyLong:
            "As essentials become more expensive, households often cut back on discretionary purchases, which can weigh on overall consumer spending.",
          stocks: [],
          next: [
            {
              name: "Retail",
              direction: "down",
              magnitude: 6,
              speed: "delayed",
              confidence: 8,
              order: 3,
              whyShort: "Reduced discretionary spending can pressure retailers.",
              whyLong:
                "Retailers can be hurt when consumers become more price-sensitive and reduce non-essential purchases because of inflation pressure.",
              stocks: ["WMT", "TGT", "COST", "AMZN"],
              next: []
            }
          ]
        }
      ]
    },

    {
      name: "Commodity Prices",
      direction: "up",
      magnitude: 7,
      speed: "fast",
      confidence: 8,
      order: 1,
      whyShort: "Inflationary environments often lift hard-asset prices.",
      whyLong:
        "Inflation often coincides with stronger pricing in commodities, especially when supply constraints, currency effects, or real-asset demand are present.",
      stocks: ["DBC", "FCX", "SCCO", "BHP", "RIO", "NEM"],
      next: [
        {
          name: "Mining Companies",
          direction: "up",
          magnitude: 6,
          speed: "fast",
          confidence: 7,
          order: 2,
          whyShort: "Higher commodity prices can support miner revenues.",
          whyLong:
            "Mining companies often benefit when the prices of the metals and materials they produce rise faster than their cost base.",
          stocks: ["FCX", "NEM", "AA"],
          next: []
        }
      ]
    },

    {
      name: "Gold",
      direction: "up",
      magnitude: 6,
      speed: "fast",
      confidence: 7,
      order: 1,
      whyShort: "Investors often buy gold as an inflation hedge.",
      whyLong:
        "Gold can benefit during inflationary periods because investors often view it as a store of value when fiat purchasing power is being eroded.",
      stocks: ["GLD", "NEM", "GOLD", "AEM"],
      next: [
        {
          name: "Inflation Hedge Demand",
          direction: "up",
          magnitude: 7,
          speed: "fast",
          confidence: 8,
          order: 2,
          whyShort: "Rising inflation increases demand for hard-asset hedges.",
          whyLong:
            "As inflation concerns rise, investors may allocate more capital toward gold and related assets as a hedge against currency debasement and real-value erosion.",
          stocks: ["GLD", "GDX", "NEM", "GOLD"],
          next: []
        }
      ]
    },

    {
      name: "Energy Prices",
      direction: "up",
      magnitude: 8,
      speed: "fast",
      confidence: 8,
      order: 1,
      whyShort: "Inflationary pressures often coincide with higher energy costs.",
      whyLong:
        "Energy is a major inflation component, and inflationary environments often include or reinforce higher oil, fuel, and power prices.",
      stocks: ["XOM", "CVX", "COP"],
      next: [
        {
          name: "Oil Producers",
          direction: "up",
          magnitude: 8,
          speed: "immediate",
          confidence: 8,
          order: 2,
          whyShort: "Higher energy prices support producer revenues and cash flow.",
          whyLong:
            "Oil producers can benefit when energy prices rise because they sell production at stronger realized prices, supporting earnings and cash generation.",
          stocks: ["XOM", "CVX", "EOG"],
          next: []
        }
      ]
    },

    {
      name: "Corporate Input Costs",
      direction: "up",
      magnitude: 8,
      speed: "fast",
      confidence: 9,
      order: 1,
      whyShort: "Inflation raises raw material, freight, and operating costs.",
      whyLong:
        "As inflation rises, businesses often face higher costs across materials, transportation, utilities, and other inputs, pressuring operating performance.",
      stocks: [],
      next: [
        {
          name: "Corporate Profit Margins",
          direction: "down",
          magnitude: 7,
          speed: "delayed",
          confidence: 8,
          order: 2,
          whyShort: "Higher costs can compress margins if not passed through.",
          whyLong:
            "If companies cannot fully pass rising input costs on to customers, profit margins often come under pressure.",
          stocks: [],
          next: [
            {
              name: "Equity Market Earnings",
              direction: "down",
              magnitude: 7,
              speed: "delayed",
              confidence: 8,
              order: 3,
              whyShort: "Margin pressure can reduce earnings growth.",
              whyLong:
                "As profit margins narrow, corporate earnings can weaken, which often weighs on equity market expectations and valuations.",
              stocks: ["AAPL", "MSFT", "NVDA", "AMZN"],
              next: []
            }
          ]
        }
      ]
    },

    {
      name: "Wage Inflation",
      direction: "up",
      magnitude: 7,
      speed: "delayed",
      confidence: 8,
      order: 1,
      whyShort: "Inflation can contribute to rising wage demands.",
      whyLong:
        "As living costs rise, workers often demand higher wages, which can create wage inflation and reinforce broader inflation pressure.",
      stocks: [],
      next: [
        {
          name: "Labor Costs",
          direction: "up",
          magnitude: 7,
          speed: "delayed",
          confidence: 9,
          order: 2,
          whyShort: "Higher wages increase labor expense for employers.",
          whyLong:
            "When wages rise, labor-intensive businesses face higher operating costs, which can pressure margins if pricing power is limited.",
          stocks: [],
          next: [
            {
              name: "Restaurant Margins",
              direction: "down",
              magnitude: 6,
              speed: "delayed",
              confidence: 8,
              order: 3,
              whyShort: "Labor-heavy restaurant models are vulnerable to wage pressure.",
              whyLong:
                "Restaurants are especially sensitive to wage inflation because labor is a major cost line, and higher staffing costs can compress margins.",
              stocks: ["MCD", "SBUX", "CMG"],
              next: []
            }
          ]
        }
      ]
    },

    {
      name: "Bond Yields",
      direction: "up",
      magnitude: 7,
      speed: "fast",
      confidence: 8,
      order: 1,
      whyShort: "Higher inflation often pushes yields upward.",
      whyLong:
        "When inflation rises, bond investors demand higher yields to compensate for lost purchasing power and the risk of tighter monetary policy.",
      stocks: ["O", "AMT", "NEE","TLT", "IEF"],
      next: [
        {
          name: "Bond Prices",
          direction: "down",
          magnitude: 8,
          speed: "immediate",
          confidence: 9,
          order: 2,
          whyShort: "Higher yields mechanically push bond prices lower.",
          whyLong:
            "Bond prices and yields move inversely, so rising yields usually cause existing bonds and other rate-sensitive assets to decline in value.",
          stocks: ["O", "AMT", "NEE"],
          next: []
        }
      ]
    },

    {
      name: "Defensive Stocks",
      direction: "up",
      magnitude: 5,
      speed: "fast",
      confidence: 6,
      order: 1,
      whyShort: "Investors may rotate toward defensive names during inflation stress.",
      whyLong:
        "In inflationary periods, investors sometimes favor defensive businesses with steadier demand and stronger pricing resilience, especially in staples.",
      stocks: ["KO", "PG", "PEP", "WMT"],
      next: [
        {
          name: "Consumer Staples Demand",
          direction: "up",
          magnitude: 5,
          speed: "fast",
          confidence: 7,
          order: 2,
          whyShort: "Staples demand tends to hold up better than discretionary demand.",
          whyLong:
            "Consumers usually continue buying everyday essentials even during inflationary pressure, which can support staples demand relative to more discretionary categories.",
          stocks: ["KO", "PG"],
          next: []
        }
      ]
    }

  ],

down: [

  {
    name: "Interest Rates",
    direction: "down",
    magnitude: 8,
    speed: "fast",
    confidence: 8,
    order: 1,
    whyShort: "Lower inflation can reduce pressure for tight monetary policy.",
    whyLong:
      "When inflation declines, central banks often have less reason to keep policy restrictive, which can lead to lower interest rates across the economy.",
    stocks: [],
    next: [
      {
        name: "Borrowing Costs",
        direction: "down",
        magnitude: 8,
        speed: "fast",
        confidence: 9,
        order: 2,
        whyShort: "Lower rates reduce financing costs for households and businesses.",
        whyLong:
          "As interest rates move lower, borrowing becomes cheaper, which can support spending, investment, and credit formation.",
        stocks: [],
        next: [
          {
            name: "Economic Growth",
            direction: "up",
            magnitude: 7,
            speed: "delayed",
            confidence: 8,
            order: 3,
            whyShort: "Cheaper credit can support economic activity.",
            whyLong:
              "Lower borrowing costs tend to support business investment, consumer spending, housing activity, and broader economic growth over time.",
            stocks: ["AAPL", "MSFT", "NVDA", "AMZN", "SPY"],
            next: []
          }
        ]
      }
    ]
  },

  {
    name: "Consumer Purchasing Power",
    direction: "up",
    magnitude: 8,
    speed: "fast",
    confidence: 9,
    order: 1,
    whyShort: "Lower inflation means household income buys more.",
    whyLong:
      "When inflation cools, consumers keep more real purchasing power because prices are not rising as quickly relative to income.",
    stocks: [],
    next: [
      {
        name: "Consumer Spending",
        direction: "up",
        magnitude: 7,
        speed: "delayed",
        confidence: 8,
        order: 2,
        whyShort: "Improved purchasing power can support spending.",
        whyLong:
          "As essentials become less inflationary, households often have more flexibility to spend on discretionary and everyday goods.",
        stocks: [],
        next: [
          {
            name: "Retail",
            direction: "up",
            magnitude: 6,
            speed: "delayed",
            confidence: 8,
            order: 3,
            whyShort: "Healthier spending can support retailers.",
            whyLong:
              "Retailers can benefit when consumers become less price-constrained and are more willing to make discretionary purchases.",
            stocks: ["WMT", "TGT", "COST", "AMZN"],
            next: []
          }
        ]
      }
    ]
  },

  {
    name: "Commodity Prices",
    direction: "down",
    magnitude: 7,
    speed: "fast",
    confidence: 8,
    order: 1,
    whyShort: "Cooling inflation often coincides with softer commodity pricing.",
    whyLong:
      "When inflation eases, commodity prices often soften as demand cools, supply normalizes, or inflation expectations fall.",
    stocks: ["NEM", "GOLD", "AEM", "FCX", "BHP", "RIO", "DBC"],
    next: [
      {
        name: "Mining Companies",
        direction: "down",
        magnitude: 6,
        speed: "fast",
        confidence: 7,
        order: 2,
        whyShort: "Lower commodity prices can pressure mining revenues.",
        whyLong:
          "Mining companies often face weaker revenues and earnings when the prices of the metals and materials they produce decline.",
        stocks: ["FCX", "NEM", "AA"],
        next: []
      }
    ]
  },

  {
    name: "Gold",
    direction: "down",
    magnitude: 5,
    speed: "fast",
    confidence: 6,
    order: 1,
    whyShort: "Lower inflation can reduce demand for gold as an inflation hedge.",
    whyLong:
      "Gold may weaken when inflation declines because investors often feel less need to hold it as a hedge against purchasing power erosion, though real rates and the dollar also matter.",
    stocks: ["NEM", "GOLD", "AEM", "FCX", "BHP", "RIO"],
    next: [
      {
        name: "Inflation Hedge Demand",
        direction: "down",
        magnitude: 6,
        speed: "fast",
        confidence: 7,
        order: 2,
        whyShort: "Cooling inflation reduces demand for hedge assets.",
        whyLong:
          "As inflation concerns fade, investors may reduce allocations to assets perceived as inflation hedges, including gold-related names.",
        stocks: ["NEM", "GOLD", "AEM", "FCX", "BHP", "RIO"],
        next: []
      }
    ]
  },

  {
    name: "Energy Prices",
    direction: "down",
    magnitude: 8,
    speed: "fast",
    confidence: 8,
    order: 1,
    whyShort: "Cooling inflation often includes lower energy costs.",
    whyLong:
      "Energy is a major inflation component, so lower inflation often coincides with or is helped by softer oil, fuel, and power prices.",
    stocks: ["XOM", "CVX", "COP"],
    next: [
      {
        name: "Oil Producers",
        direction: "down",
        magnitude: 8,
        speed: "immediate",
        confidence: 8,
        order: 2,
        whyShort: "Lower energy prices reduce producer revenues and cash flow.",
        whyLong:
          "Oil producers can be hurt when energy prices fall because they sell production at weaker realized prices, which pressures earnings and cash generation.",
        stocks: ["XOM", "CVX", "EOG"],
        next: []
      }
    ]
  },

  {
    name: "Corporate Input Costs",
    direction: "down",
    magnitude: 8,
    speed: "fast",
    confidence: 9,
    order: 1,
    whyShort: "Cooling inflation reduces raw material, freight, and operating cost pressure.",
    whyLong:
      "As inflation eases, businesses often face less pressure from materials, transportation, utilities, and other input costs.",
    stocks: [],
    next: [
      {
        name: "Corporate Profit Margins",
        direction: "up",
        magnitude: 7,
        speed: "delayed",
        confidence: 8,
        order: 2,
        whyShort: "Lower costs can help margins recover.",
        whyLong:
          "If cost pressures ease while pricing remains relatively stable, corporate profit margins can improve.",
        stocks: [],
        next: [
          {
            name: "Equity Market Earnings",
            direction: "up",
            magnitude: 7,
            speed: "delayed",
            confidence: 8,
            order: 3,
            whyShort: "Margin improvement can support earnings growth.",
            whyLong:
              "As corporate margins recover, earnings can strengthen, which often supports equity market expectations and performance.",
            stocks: ["AAPL", "MSFT", "NVDA", "AMZN"],
            next: []
          }
        ]
      }
    ]
  },

  {
    name: "Wage Inflation",
    direction: "down",
    magnitude: 7,
    speed: "delayed",
    confidence: 8,
    order: 1,
    whyShort: "Lower inflation can ease upward wage pressure.",
    whyLong:
      "As living-cost pressure cools, wage growth often moderates as well, especially in labor-sensitive industries.",
    stocks: [],
    next: [
      {
        name: "Labor Costs",
        direction: "down",
        magnitude: 7,
        speed: "delayed",
        confidence: 9,
        order: 2,
        whyShort: "Slower wage growth reduces labor cost pressure.",
        whyLong:
          "When wage inflation cools, labor-intensive businesses may see some relief in operating expenses.",
        stocks: [],
        next: [
          {
            name: "Restaurant Margins",
            direction: "up",
            magnitude: 6,
            speed: "delayed",
            confidence: 8,
            order: 3,
            whyShort: "Lower labor pressure can support restaurant profitability.",
            whyLong:
              "Restaurants are especially sensitive to wage costs, so easing labor inflation can help margins recover.",
            stocks: ["MCD", "SBUX", "CMG"],
            next: []
          }
        ]
      }
    ]
  },

  {
    name: "Bond Yields",
    direction: "down",
    magnitude: 7,
    speed: "fast",
    confidence: 8,
    order: 1,
    whyShort: "Lower inflation often reduces pressure on bond yields.",
    whyLong:
      "When inflation cools, bond investors usually demand less inflation compensation, which can help yields move lower.",
    stocks: ["O", "AMT", "NEE","TLT", "IEF"],
    next: [
      {
        name: "Bond Prices",
        direction: "up",
        magnitude: 8,
        speed: "immediate",
        confidence: 9,
        order: 2,
        whyShort: "Lower yields mechanically lift bond prices.",
        whyLong:
          "Bond prices and yields move inversely, so falling yields usually increase the value of existing bonds and other rate-sensitive assets.",
        stocks: ["O", "AMT", "NEE"],
        next: []
      }
    ]
  },

  {
    name: "Growth Stocks",
    direction: "up",
    magnitude: 7,
    speed: "fast",
    confidence: 8,
    order: 1,
    whyShort: "Cooling inflation can support duration-sensitive growth assets.",
    whyLong:
      "When inflation falls, rates and yields often ease as well, which tends to support long-duration growth stocks whose valuations depend heavily on future cash flows.",
    stocks: ["AAPL", "MSFT", "NVDA", "AMZN"],
    next: [
      {
        name: "Tech Valuations",
        direction: "up",
        magnitude: 8,
        speed: "fast",
        confidence: 8,
        order: 2,
        whyShort: "Lower inflation and yields can support higher valuation multiples.",
        whyLong:
          "As inflation pressure fades and discount rates ease, investors often become more willing to pay higher multiples for technology and growth companies.",
        stocks: ["AAPL", "MSFT", "NVDA", "AMZN", "META", "GOOGL","ADBE"],
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
      magnitude: 7,
      speed: "delayed",
      confidence: 8,
      order: 1,
      whyShort: "A stronger dollar makes US goods more expensive abroad.",
      whyLong:
        "When the US dollar rises, American exports become less price-competitive in foreign markets, which can reduce export demand over time.",
      stocks: [],
      next: [
        {
          name: "Industrial Exporters",
          direction: "down",
          magnitude: 6,
          speed: "delayed",
          confidence: 8,
          order: 2,
          whyShort: "Export-oriented industrial firms can face weaker foreign demand.",
          whyLong:
            "Industrial exporters can be pressured when a stronger dollar makes their products more expensive overseas and reduces international competitiveness.",
          stocks: ["CAT", "DE", "BA"],
          next: []
        }
      ]
    },

    {
      name: "Commodity Prices",
      direction: "down",
      magnitude: 7,
      speed: "fast",
      confidence: 8,
      order: 1,
      whyShort: "A stronger dollar often pressures dollar-denominated commodity prices.",
      whyLong:
        "Many commodities are priced in US dollars, so a stronger dollar can make them more expensive in foreign currency terms and weigh on global demand and pricing.",
      stocks: ["FCX", "SCCO", "NEM", "BHP", "RIO"],
      next: [
        {
          name: "Mining Companies",
          direction: "down",
          magnitude: 6,
          speed: "fast",
          confidence: 7,
          order: 2,
          whyShort: "Lower commodity prices can pressure miners.",
          whyLong:
            "Mining companies are sensitive to the prices of the metals and materials they produce, so dollar-driven commodity weakness can hurt revenues and margins.",
          stocks: ["FCX", "NEM", "AA","SCCO"],
          next: []
        }
      ]
    },

    {
      name: "Multinational Earnings",
      direction: "down",
      magnitude: 7,
      speed: "fast",
      confidence: 8,
      order: 1,
      whyShort: "A stronger dollar reduces the value of foreign earnings when translated back to USD.",
      whyLong:
        "Large multinational companies often generate significant overseas revenue. When the dollar strengthens, those foreign sales translate into fewer US dollars in reported results.",
      stocks: ["AAPL", "MSFT", "KO", "PG"],
      next: [
        {
          name: "Foreign Revenue Translation",
          direction: "down",
          magnitude: 7,
          speed: "fast",
          confidence: 9,
          order: 2,
          whyShort: "Translation effects reduce reported dollar revenue.",
          whyLong:
            "Even if underlying sales are stable abroad, a stronger dollar can reduce reported revenue and earnings through currency translation effects.",
          stocks: ["AAPL", "MSFT"],
          next: []
        }
      ]
    },

    {
      name: "Emerging Market Currencies",
      direction: "down",
      magnitude: 8,
      speed: "fast",
      confidence: 8,
      order: 1,
      whyShort: "A stronger dollar often pressures emerging market currencies.",
      whyLong:
        "Many emerging markets are sensitive to dollar strength because of capital flows, dollar-denominated debt, and trade financing pressures.",
      stocks: ["EEM", "VWO", "CEW"],
      next: [
        {
          name: "Emerging Market Equities",
          direction: "down",
          magnitude: 7,
          speed: "fast",
          confidence: 8,
          order: 2,
          whyShort: "Currency weakness and capital outflows can pressure EM stocks.",
          whyLong:
            "Emerging market equities often struggle when local currencies weaken and global capital becomes more cautious in a strong-dollar environment.",
          stocks: ["EEM", "VWO", "FXI","INDA"],
          next: []
        }
      ]
    },

    {
      name: "Global Liquidity",
      direction: "down",
      magnitude: 7,
      speed: "fast",
      confidence: 7,
      order: 1,
      whyShort: "A stronger dollar can tighten global financial conditions.",
      whyLong:
        "Dollar strength often acts like a tightening force globally by increasing the burden of dollar funding and reducing ease of capital flows outside the US.",
      stocks: [],
      next: [
        {
          name: "Risk Assets",
          direction: "down",
          magnitude: 7,
          speed: "fast",
          confidence: 7,
          order: 2,
          whyShort: "Tighter liquidity can pressure equities and other risk assets.",
          whyLong:
            "As global liquidity tightens, investors often become less willing to hold risk assets, which can weigh on equities and speculative assets.",
          stocks: ["AAPL", "MSFT", "NVDA", "AMZN"],
          next: []
        }
      ]
    },

    {
      name: "US Import Power",
      direction: "up",
      magnitude: 6,
      speed: "fast",
      confidence: 8,
      order: 1,
      whyShort: "A stronger dollar makes foreign goods cheaper for US buyers.",
      whyLong:
        "When the dollar rises, imported goods become cheaper in US dollar terms, which can improve purchasing power for import-heavy businesses and consumers.",
      stocks: [],
      next: [
        {
          name: "Retail Margins",
          direction: "up",
          magnitude: 5,
          speed: "delayed",
          confidence: 7,
          order: 2,
          whyShort: "Cheaper imports can support retailer margins.",
          whyLong:
            "Retailers that rely on imported merchandise can benefit when a stronger dollar lowers sourcing costs and supports gross margins.",
          stocks: ["WMT", "TGT", "COST"],
          next: []
        }
      ]
    },

    {
      name: "International Tourism to US",
      direction: "down",
      magnitude: 5,
      speed: "delayed",
      confidence: 7,
      order: 1,
      whyShort: "A stronger dollar makes US travel more expensive for foreign visitors.",
      whyLong:
        "When the dollar rises, hotels, flights, and spending in the US become more expensive in foreign currency terms, which can reduce inbound tourism demand.",
      stocks: [],
      next: [
        {
          name: "Travel Companies",
          direction: "down",
          magnitude: 4,
          speed: "delayed",
          confidence: 6,
          order: 2,
          whyShort: "Weaker inbound tourism can pressure travel demand.",
          whyLong:
            "Travel platforms and accommodation-related businesses can be affected if international tourism to the US weakens in a strong-dollar environment.",
          stocks: ["BKNG", "EXPE", "ABNB"],
          next: []
        }
      ]
    },

    {
      name: "Foreign Investment Into US Bonds",
      direction: "up",
      magnitude: 5,
      speed: "fast",
      confidence: 6,
      order: 1,
      whyShort: "A stronger dollar can make US bonds more attractive to foreign investors.",
      whyLong:
        "Dollar strength can reinforce demand for US fixed income when investors seek currency stability, safety, or attractive relative yields.",
      stocks: ["O", "AMT", "NEE"],
      next: [
        {
          name: "Treasury Demand",
          direction: "up",
          magnitude: 5,
          speed: "fast",
          confidence: 6,
          order: 2,
          whyShort: "Foreign capital can support Treasury demand.",
          whyLong:
            "As foreign investors allocate more toward dollar-denominated debt, Treasury demand can increase, though rate differentials and hedging costs still matter.",
          stocks: ["TLT", "IEF", "SHY"],
          next: []
        }
      ]
    }

  ],

down: [

  {
    name: "US Exports",
    direction: "up",
    magnitude: 7,
    speed: "delayed",
    confidence: 8,
    order: 1,
    whyShort: "A weaker dollar makes US goods more competitive abroad.",
    whyLong:
      "When the US dollar falls, American exports become cheaper in foreign currency terms, which can improve export demand over time.",
    stocks: [],
    next: [
      {
        name: "Industrial Exporters",
        direction: "up",
        magnitude: 6,
        speed: "delayed",
        confidence: 8,
        order: 2,
        whyShort: "Export-oriented industrial firms can benefit from stronger foreign demand.",
        whyLong:
          "Industrial exporters can benefit when a weaker dollar improves international competitiveness and supports overseas order growth.",
        stocks: ["CAT", "DE", "BA"],
        next: []
      }
    ]
  },

  {
    name: "Commodity Prices",
    direction: "up",
    magnitude: 7,
    speed: "fast",
    confidence: 8,
    order: 1,
    whyShort: "A weaker dollar often supports dollar-denominated commodity prices.",
    whyLong:
      "Many commodities are priced in US dollars, so a weaker dollar can make them cheaper in foreign currency terms and support global demand and pricing.",
    stocks: ["FCX", "NEM", "AA", "BHP", "RIO", "SCCO"],
    next: [
      {
        name: "Mining Companies",
        direction: "up",
        magnitude: 6,
        speed: "fast",
        confidence: 7,
        order: 2,
        whyShort: "Higher commodity prices can support miners.",
        whyLong:
          "Mining companies are sensitive to the prices of the metals and materials they produce, so dollar-driven commodity strength can help revenues and margins.",
        stocks: ["FCX", "NEM", "AA", "SCCO"],
        next: []
      }
    ]
  },

  {
    name: "Multinational Earnings",
    direction: "up",
    magnitude: 7,
    speed: "fast",
    confidence: 8,
    order: 1,
    whyShort: "A weaker dollar boosts the value of foreign earnings when translated back to USD.",
    whyLong:
      "Large multinational companies often generate significant overseas revenue. When the dollar weakens, those foreign sales translate into more US dollars in reported results.",
    stocks: ["AAPL", "MSFT", "KO", "PG", "PEP", "MCD"],
    next: [
      {
        name: "Foreign Revenue Translation",
        direction: "up",
        magnitude: 7,
        speed: "fast",
        confidence: 9,
        order: 2,
        whyShort: "Translation effects lift reported dollar revenue.",
        whyLong:
          "Even if underlying sales are unchanged abroad, a weaker dollar can increase reported revenue and earnings through currency translation effects.",
        stocks: ["AAPL", "MSFT", "KO", "PG"],
        next: []
      }
    ]
  },

  {
    name: "Emerging Market Currencies",
    direction: "up",
    magnitude: 8,
    speed: "fast",
    confidence: 8,
    order: 1,
    whyShort: "A weaker dollar often relieves pressure on emerging market currencies.",
    whyLong:
      "Many emerging markets benefit when the dollar weakens because dollar funding pressure falls, capital flows stabilize, and external financing conditions improve.",
    stocks: ["EEM", "VWO", "TSM", "VALE", "PDD"],
    next: [
      {
        name: "Emerging Market Equities",
        direction: "up",
        magnitude: 7,
        speed: "fast",
        confidence: 8,
        order: 2,
        whyShort: "Currency strength and better capital flows can support EM stocks.",
        whyLong:
          "Emerging market equities often perform better when local currencies firm and global capital becomes more willing to flow into riskier international markets.",
        stocks: ["EEM", "VWO", "VALE", "TSM", "PDD"],
        next: []
      }
    ]
  },

  {
    name: "Global Liquidity",
    direction: "up",
    magnitude: 7,
    speed: "fast",
    confidence: 7,
    order: 1,
    whyShort: "A weaker dollar can loosen global financial conditions.",
    whyLong:
      "Dollar weakness often acts as a relief valve globally by reducing the burden of dollar funding and making capital flows easier outside the US.",
    stocks: [],
    next: [
      {
        name: "Risk Assets",
        direction: "up",
        magnitude: 7,
        speed: "fast",
        confidence: 7,
        order: 2,
        whyShort: "Easier liquidity can support equities and other risk assets.",
        whyLong:
          "As global liquidity improves, investors often become more willing to hold risk assets, which can support equities and speculative assets.",
        stocks: ["AAPL", "MSFT", "NVDA", "AMZN", "TSLA", "QQQ"],
        next: []
      }
    ]
  },

  {
    name: "US Import Power",
    direction: "down",
    magnitude: 6,
    speed: "fast",
    confidence: 8,
    order: 1,
    whyShort: "A weaker dollar makes foreign goods more expensive for US buyers.",
    whyLong:
      "When the dollar falls, imported goods become more expensive in US dollar terms, which can reduce purchasing power for import-heavy businesses and consumers.",
    stocks: [],
    next: [
      {
        name: "Retail Margins",
        direction: "down",
        magnitude: 5,
        speed: "delayed",
        confidence: 7,
        order: 2,
        whyShort: "More expensive imports can pressure retailer margins.",
        whyLong:
          "Retailers that rely heavily on imported merchandise can see sourcing costs rise when the dollar weakens, which can weigh on gross margins.",
        stocks: ["WMT", "TGT", "COST", "DG"],
        next: []
      }
    ]
  },

  {
    name: "International Tourism to US",
    direction: "up",
    magnitude: 5,
    speed: "delayed",
    confidence: 7,
    order: 1,
    whyShort: "A weaker dollar makes US travel cheaper for foreign visitors.",
    whyLong:
      "When the dollar falls, hotels, flights, and spending in the US become cheaper in foreign currency terms, which can support inbound tourism demand.",
    stocks: [],
    next: [
      {
        name: "Travel Companies",
        direction: "up",
        magnitude: 4,
        speed: "delayed",
        confidence: 6,
        order: 2,
        whyShort: "Stronger inbound tourism can support travel demand.",
        whyLong:
          "Travel platforms and accommodation-related businesses can benefit if international tourism to the US strengthens in a weaker-dollar environment.",
        stocks: ["BKNG", "EXPE", "ABNB", "MAR", "HLT"],
        next: []
      }
    ]
  },

  {
    name: "Emerging Market Debt Pressure",
    direction: "down",
    magnitude: 8,
    speed: "fast",
    confidence: 8,
    order: 1,
    whyShort: "A weaker dollar reduces pressure on dollar-denominated EM debt.",
    whyLong:
      "Many emerging markets carry debt linked to the US dollar. When the dollar weakens, debt servicing pressure often eases and external financing conditions improve.",
    stocks: [],
    next: [
      {
        name: "Emerging Market Bonds",
        direction: "up",
        magnitude: 6,
        speed: "fast",
        confidence: 7,
        order: 2,
        whyShort: "Lower dollar stress can support EM debt performance.",
        whyLong:
          "As debt pressure eases and capital flows improve, emerging market bond performance can strengthen, especially in countries with significant dollar exposure.",
        stocks: ["EMB", "PCY", "VWOB"],
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
      magnitude: 8,
      speed: "fast",
      confidence: 9,
      order: 1,
      whyShort: "Higher spending directly lifts retail sales volumes.",
      whyLong:
        "When consumer spending increases, retail companies benefit from higher transaction volume, improved same-store sales, and stronger overall demand.",
      stocks: ["WMT", "TGT", "COST", "AMZN"],
      next: [
        {
          name: "E-commerce Sales",
          direction: "up",
          magnitude: 8,
          speed: "fast",
          confidence: 9,
          order: 2,
          whyShort: "Online spending rises alongside total retail demand.",
          whyLong:
            "As consumer spending increases, a growing share flows through online channels, boosting e-commerce platforms and digital retail ecosystems.",
          stocks: ["AMZN", "SHOP", "EBAY"],
          next: [
            {
              name: "Logistics Demand",
              direction: "up",
              magnitude: 7,
              speed: "fast",
              confidence: 8,
              order: 3,
              whyShort: "Higher e-commerce volume increases shipping demand.",
              whyLong:
                "More online purchases require fulfillment, warehousing, and last-mile delivery, driving higher demand for logistics providers.",
              stocks: ["UPS", "FDX", "EXPD"],
              next: []
            }
          ]
        }
      ]
    },

    {
      name: "Restaurants",
      direction: "up",
      magnitude: 7,
      speed: "fast",
      confidence: 9,
      order: 1,
      whyShort: "Higher discretionary spending boosts dining activity.",
      whyLong:
        "Restaurants benefit when consumers have more disposable income and are more willing to spend on dining and food services.",
      stocks: ["MCD", "SBUX", "CMG", "YUM"],
      next: [
        {
          name: "Food Service Demand",
          direction: "up",
          magnitude: 7,
          speed: "fast",
          confidence: 9,
          order: 2,
          whyShort: "Increased dining frequency drives demand.",
          whyLong:
            "Higher spending leads to increased traffic and ticket size across quick service and fast casual restaurants.",
          stocks: ["MCD", "CMG", "YUM"],
          next: []
        }
      ]
    },

    {
      name: "Travel",
      direction: "up",
      magnitude: 8,
      speed: "fast",
      confidence: 8,
      order: 1,
      whyShort: "Higher discretionary income supports travel demand.",
      whyLong:
        "When consumers feel financially strong, they are more likely to spend on travel, vacations, and experiences.",
      stocks: ["DAL", "RCL", "CCL", "BKNG"],
      next: [
        {
          name: "Airlines",
          direction: "up",
          magnitude: 7,
          speed: "fast",
          confidence: 8,
          order: 2,
          whyShort: "Higher travel demand increases passenger volumes.",
          whyLong:
            "Airlines benefit from increased ticket demand and load factors when consumer travel spending rises.",
          stocks: ["DAL", "UAL", "AAL"],
          next: []
        },
        {
          name: "Hotels",
          direction: "up",
          magnitude: 7,
          speed: "fast",
          confidence: 8,
          order: 2,
          whyShort: "Higher travel demand supports occupancy and pricing.",
          whyLong:
            "Hotel operators benefit from increased occupancy rates and pricing power when travel demand is strong.",
          stocks: ["MAR", "HLT"],
          next: []
        }
      ]
    },

    {
      name: "Apparel Sales",
      direction: "up",
      magnitude: 7,
      speed: "fast",
      confidence: 8,
      order: 1,
      whyShort: "Higher discretionary spending supports apparel demand.",
      whyLong:
        "Consumers tend to spend more on clothing and lifestyle products when disposable income rises.",
      stocks: ["NKE", "LULU", "GPS", "ROST"],
      next: [
        {
          name: "Luxury Goods",
          direction: "up",
          magnitude: 6,
          speed: "fast",
          confidence: 7,
          order: 2,
          whyShort: "Higher-end discretionary spending increases.",
          whyLong:
            "Luxury goods demand often rises alongside strong consumer confidence and higher discretionary income.",
          stocks: ["RL", "TPR", "LVMUY"],
          next: []
        }
      ]
    },

    {
      name: "Auto Purchases",
      direction: "up",
      magnitude: 7,
      speed: "delayed",
      confidence: 8,
      order: 1,
      whyShort: "Higher income and confidence support vehicle purchases.",
      whyLong:
        "Auto demand is sensitive to consumer confidence and financial conditions, and tends to rise when spending power improves.",
      stocks: ["GM", "F", "TSLA"],
      next: [
        {
          name: "Auto Parts Suppliers",
          direction: "up",
          magnitude: 7,
          speed: "delayed",
          confidence: 8,
          order: 2,
          whyShort: "Higher production supports suppliers.",
          whyLong:
            "As automakers increase production to meet demand, parts suppliers benefit from higher volumes.",
          stocks: ["MGA", "LEA", "APTV"],
          next: []
        }
      ]
    },

    {
      name: "Home Improvement Spending",
      direction: "up",
      magnitude: 6,
      speed: "delayed",
      confidence: 7,
      order: 1,
      whyShort: "Higher discretionary income supports home projects.",
      whyLong:
        "Consumers tend to invest more in home improvement and renovation projects when spending capacity is strong.",
      stocks: ["HD", "LOW"],
      next: [
        {
          name: "Construction Materials",
          direction: "up",
          magnitude: 6,
          speed: "delayed",
          confidence: 7,
          order: 2,
          whyShort: "More projects increase material demand.",
          whyLong:
            "Higher home improvement activity drives demand for aggregates, cement, and building materials.",
          stocks: ["MLM", "VMC"],
          next: []
        }
      ]
    },

    {
      name: "Entertainment Spending",
      direction: "up",
      magnitude: 7,
      speed: "fast",
      confidence: 8,
      order: 1,
      whyShort: "Higher discretionary income boosts entertainment demand.",
      whyLong:
        "Consumers spend more on entertainment, media, and live events when financial conditions are strong.",
      stocks: ["DIS", "NFLX", "LYV"],
      next: [
        {
          name: "Streaming Subscriptions",
          direction: "up",
          magnitude: 6,
          speed: "fast",
          confidence: 7,
          order: 2,
          whyShort: "More spending supports subscription growth.",
          whyLong:
            "Streaming platforms benefit from increased willingness to pay for digital entertainment services.",
          stocks: ["NFLX", "DIS"],
          next: []
        }
      ]
    },

    {
      name: "Advertising Spending",
      direction: "up",
      magnitude: 7,
      speed: "fast",
      confidence: 8,
      order: 1,
      whyShort: "Higher economic activity increases marketing budgets.",
      whyLong:
        "Companies tend to increase advertising spend when consumer demand is strong to capture market share.",
      stocks: ["GOOGL", "META"],
      next: [
        {
          name: "Digital Ad Revenue",
          direction: "up",
          magnitude: 8,
          speed: "fast",
          confidence: 9,
          order: 2,
          whyShort: "Higher ad budgets boost platform revenue.",
          whyLong:
            "Digital advertising platforms benefit directly from increased ad spending and higher engagement.",
          stocks: ["META", "GOOGL"],
          next: []
        }
      ]
    },

    {
      name: "Credit Card Usage",
      direction: "up",
      magnitude: 8,
      speed: "immediate",
      confidence: 9,
      order: 1,
      whyShort: "Higher spending increases transaction volume.",
      whyLong:
        "As consumer spending rises, credit and debit card usage increases, driving higher payment volumes.",
      stocks: ["V", "MA", "AXP"],
      next: [
        {
          name: "Payment Processing Volume",
          direction: "up",
          magnitude: 8,
          speed: "immediate",
          confidence: 9,
          order: 2,
          whyShort: "Higher transactions drive network volume.",
          whyLong:
            "Payment networks benefit directly from increased transaction volume as consumers spend more across categories.",
          stocks: ["V", "MA"],
          next: []
        }
      ]
    }

  ],

down: [

  {
    name: "Retail",
    direction: "down",
    magnitude: 8,
    speed: "fast",
    confidence: 9,
    order: 1,
    whyShort: "Lower consumer spending reduces retail sales volumes.",
    whyLong:
      "When consumer spending weakens, retail companies usually see lower transaction volume, softer same-store sales, and weaker overall demand.",
    stocks: ["WMT", "TGT", "COST", "AMZN"],
    next: [
      {
        name: "E-commerce Sales",
        direction: "down",
        magnitude: 8,
        speed: "fast",
        confidence: 9,
        order: 2,
        whyShort: "Online spending falls alongside total retail demand.",
        whyLong:
          "As consumer spending weakens, online purchases also tend to slow, pressuring e-commerce platforms and digital retail ecosystems.",
        stocks: ["AMZN", "SHOP", "EBAY"],
        next: [
          {
            name: "Logistics Demand",
            direction: "down",
            magnitude: 7,
            speed: "fast",
            confidence: 8,
            order: 3,
            whyShort: "Lower e-commerce volume reduces shipping demand.",
            whyLong:
              "Fewer online purchases mean less fulfillment, warehousing, and last-mile delivery activity, which reduces demand for logistics providers.",
            stocks: ["UPS", "FDX", "EXPD"],
            next: []
          }
        ]
      }
    ]
  },

  {
    name: "Restaurants",
    direction: "down",
    magnitude: 7,
    speed: "fast",
    confidence: 9,
    order: 1,
    whyShort: "Weaker discretionary spending hurts dining activity.",
    whyLong:
      "Restaurants are often pressured when consumers have less disposable income and become less willing to spend on dining and food services.",
    stocks: ["MCD", "SBUX", "CMG", "YUM"],
    next: [
      {
        name: "Food Service Demand",
        direction: "down",
        magnitude: 7,
        speed: "fast",
        confidence: 9,
        order: 2,
        whyShort: "Lower dining frequency reduces demand.",
        whyLong:
          "Weaker spending usually leads to lower traffic and softer ticket sizes across quick service and fast casual restaurants.",
        stocks: ["MCD", "CMG", "YUM"],
        next: []
      }
    ]
  },

  {
    name: "Travel",
    direction: "down",
    magnitude: 8,
    speed: "fast",
    confidence: 8,
    order: 1,
    whyShort: "Weaker discretionary income reduces travel demand.",
    whyLong:
      "When consumers feel financially constrained, they often cut back on travel, vacations, and experience-based spending.",
    stocks: ["DAL", "RCL", "CCL", "BKNG"],
    next: [
      {
        name: "Airlines",
        direction: "down",
        magnitude: 7,
        speed: "fast",
        confidence: 8,
        order: 2,
        whyShort: "Lower travel demand reduces passenger volumes.",
        whyLong:
          "Airlines are pressured when consumer travel spending falls because ticket demand and load factors usually weaken.",
        stocks: ["DAL", "UAL", "AAL"],
        next: []
      },
      {
        name: "Hotels",
        direction: "down",
        magnitude: 7,
        speed: "fast",
        confidence: 8,
        order: 2,
        whyShort: "Lower travel demand hurts occupancy and pricing.",
        whyLong:
          "Hotel operators tend to face weaker occupancy rates and less pricing power when travel demand softens.",
        stocks: ["MAR", "HLT"],
        next: []
      }
    ]
  },

  {
    name: "Apparel Sales",
    direction: "down",
    magnitude: 7,
    speed: "fast",
    confidence: 8,
    order: 1,
    whyShort: "Weaker discretionary spending pressures apparel demand.",
    whyLong:
      "Consumers usually reduce spending on clothing and lifestyle products when disposable income tightens.",
    stocks: ["NKE", "LULU", "GPS", "ROST"],
    next: [
      {
        name: "Luxury Goods",
        direction: "down",
        magnitude: 6,
        speed: "fast",
        confidence: 7,
        order: 2,
        whyShort: "Higher-end discretionary spending weakens.",
        whyLong:
          "Luxury goods demand often softens when consumer confidence falls and households become more cautious with discretionary spending.",
        stocks: ["RL", "TPR", "LVMUY"],
        next: []
      }
    ]
  },

  {
    name: "Auto Purchases",
    direction: "down",
    magnitude: 7,
    speed: "delayed",
    confidence: 8,
    order: 1,
    whyShort: "Weaker income and confidence reduce vehicle purchases.",
    whyLong:
      "Auto demand is sensitive to consumer confidence and financial conditions, and tends to weaken when spending power deteriorates.",
    stocks: ["GM", "F", "TSLA"],
    next: [
      {
        name: "Auto Parts Suppliers",
        direction: "down",
        magnitude: 7,
        speed: "delayed",
        confidence: 8,
        order: 2,
        whyShort: "Lower production pressures suppliers.",
        whyLong:
          "As automakers reduce production in response to softer demand, parts suppliers usually face lower volumes as well.",
        stocks: ["MGA", "LEA", "APTV"],
        next: []
      }
    ]
  },

  {
    name: "Home Improvement Spending",
    direction: "down",
    magnitude: 6,
    speed: "delayed",
    confidence: 7,
    order: 1,
    whyShort: "Weaker discretionary income reduces home project spending.",
    whyLong:
      "Consumers often postpone renovation and home improvement projects when spending capacity becomes more constrained.",
    stocks: ["HD", "LOW"],
    next: [
      {
        name: "Construction Materials",
        direction: "down",
        magnitude: 6,
        speed: "delayed",
        confidence: 7,
        order: 2,
        whyShort: "Fewer projects reduce material demand.",
        whyLong:
          "Lower home improvement activity reduces demand for aggregates, cement, and building materials.",
        stocks: ["MLM", "VMC"],
        next: []
      }
    ]
  },

  {
    name: "Entertainment Spending",
    direction: "down",
    magnitude: 7,
    speed: "fast",
    confidence: 8,
    order: 1,
    whyShort: "Weaker discretionary income hurts entertainment demand.",
    whyLong:
      "Consumers tend to reduce spending on entertainment, media, and live events when financial conditions worsen.",
    stocks: ["DIS", "NFLX", "LYV"],
    next: [
      {
        name: "Streaming Subscriptions",
        direction: "down",
        magnitude: 6,
        speed: "fast",
        confidence: 7,
        order: 2,
        whyShort: "Consumers become less willing to pay for subscriptions.",
        whyLong:
          "Streaming platforms can face slower growth or higher churn when households look to cut recurring discretionary expenses.",
        stocks: ["NFLX", "DIS"],
        next: []
      }
    ]
  },

  {
    name: "Advertising Spending",
    direction: "down",
    magnitude: 7,
    speed: "fast",
    confidence: 8,
    order: 1,
    whyShort: "Weaker consumer demand leads companies to cut marketing budgets.",
    whyLong:
      "When end demand softens, companies often pull back on advertising spend, especially performance and discretionary branding budgets.",
    stocks: ["GOOGL", "META"],
    next: [
      {
        name: "Digital Ad Revenue",
        direction: "down",
        magnitude: 8,
        speed: "fast",
        confidence: 9,
        order: 2,
        whyShort: "Lower ad budgets reduce platform revenue.",
        whyLong:
          "Digital advertising platforms are directly exposed to changes in ad spending and usually see weaker revenue growth when advertising budgets shrink.",
        stocks: ["META", "GOOGL"],
        next: []
      }
    ]
  },

  {
    name: "Credit Card Usage",
    direction: "down",
    magnitude: 8,
    speed: "immediate",
    confidence: 9,
    order: 1,
    whyShort: "Lower spending reduces transaction volume.",
    whyLong:
      "As consumer spending falls, credit and debit card usage also tends to decline, reducing payment volumes across the network.",
    stocks: ["V", "MA", "AXP"],
    next: [
      {
        name: "Payment Processing Volume",
        direction: "down",
        magnitude: 8,
        speed: "immediate",
        confidence: 9,
        order: 2,
        whyShort: "Lower transactions reduce network volume.",
        whyLong:
          "Payment networks are directly tied to consumer transaction activity, so weaker spending usually means lower processed volume.",
        stocks: ["V", "MA"],
        next: []
      }
    ]
  },

  {
    name: "Defensive Consumer Staples",
    direction: "up",
    magnitude: 5,
    speed: "fast",
    confidence: 7,
    order: 1,
    whyShort: "Consumers rotate toward essentials when discretionary spending weakens.",
    whyLong:
      "When consumer spending softens, staples and household essentials often hold up better than discretionary categories because they remain necessary purchases.",
    stocks: ["KO", "PG", "PEP", "WMT", "COST"],
    next: []
  }

]

},

"Semiconductor Demand": {
  up: [

    {
      name: "Chip Equipment",
      direction: "up",
      magnitude: 9,
      speed: "fast",
      confidence: 9,
      order: 1,
      whyShort: "Higher chip demand drives equipment orders.",
      whyLong:
        "As semiconductor demand rises, foundries and manufacturers invest in new fabrication capacity, increasing demand for semiconductor equipment.",
      stocks: ["ASML", "LRCX", "AMAT", "KLAC"],
      next: [
        {
          name: "Semiconductor Manufacturing Expansion",
          direction: "up",
          magnitude: 9,
          speed: "delayed",
          confidence: 9,
          order: 2,
          whyShort: "Capex increases to expand production capacity.",
          whyLong:
            "Rising demand leads chip manufacturers to expand fabs and invest heavily in production capacity to meet future demand.",
          stocks: ["TSM", "INTC", "GFS"],
          next: [
            {
              name: "Global Chip Supply",
              direction: "up",
              magnitude: 8,
              speed: "delayed",
              confidence: 9,
              order: 3,
              whyShort: "More fabs increase total supply.",
              whyLong:
                "As manufacturing capacity expands, overall semiconductor supply increases, though often with a lag due to build timelines.",
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
      magnitude: 10,
      speed: "fast",
      confidence: 9,
      order: 1,
      whyShort: "AI demand drives high-performance chip usage.",
      whyLong:
        "Artificial intelligence workloads require massive compute power, driving demand for GPUs, accelerators, and specialized semiconductors.",
      stocks: ["NVDA", "AVGO", "AMD"],
      next: [
        {
          name: "Data Center Expansion",
          direction: "up",
          magnitude: 9,
          speed: "fast",
          confidence: 9,
          order: 2,
          whyShort: "AI workloads require more data center capacity.",
          whyLong:
            "AI training and inference require large-scale data centers, driving infrastructure expansion globally.",
          stocks: ["NVDA", "SMCI", "DELL"],
          next: [
            {
              name: "Cloud Infrastructure",
              direction: "up",
              magnitude: 9,
              speed: "fast",
              confidence: 9,
              order: 3,
              whyShort: "Cloud providers scale infrastructure to meet demand.",
              whyLong:
                "Cloud platforms expand infrastructure to support AI workloads, enterprise demand, and data processing needs.",
              stocks: ["MSFT", "AMZN", "GOOGL"],
              next: []
            }
          ]
        }
      ]
    },

    {
      name: "Memory Chips",
      direction: "up",
      magnitude: 8,
      speed: "fast",
      confidence: 8,
      order: 1,
      whyShort: "Higher data usage drives memory demand.",
      whyLong:
        "AI, cloud, and consumer devices all require large amounts of memory, increasing demand for DRAM and NAND.",
      stocks: ["MU", "WDC", "STX"],
      next: [
        {
          name: "Data Storage Demand",
          direction: "up",
          magnitude: 8,
          speed: "fast",
          confidence: 8,
          order: 2,
          whyShort: "More data requires more storage capacity.",
          whyLong:
            "As data generation increases, demand for storage infrastructure grows across enterprise and consumer applications.",
          stocks: ["MU", "STX", "WDC"],
          next: []
        }
      ]
    },

    {
      name: "Consumer Electronics",
      direction: "up",
      magnitude: 7,
      speed: "fast",
      confidence: 8,
      order: 1,
      whyShort: "Higher device demand drives chip consumption.",
      whyLong:
        "Consumer electronics like smartphones, gaming consoles, and wearables require semiconductors, so higher demand increases chip usage.",
      stocks: ["AAPL", "SONY"],
      next: [
        {
          name: "Smartphone Production",
          direction: "up",
          magnitude: 7,
          speed: "fast",
          confidence: 8,
          order: 2,
          whyShort: "More devices increase production volume.",
          whyLong:
            "Smartphone manufacturers increase production when demand rises, which boosts semiconductor demand.",
          stocks: ["AAPL", "QCOM"],
          next: [
            {
              name: "Mobile Chip Demand",
              direction: "up",
              magnitude: 8,
              speed: "fast",
              confidence: 8,
              order: 3,
              whyShort: "Higher production drives chip demand.",
              whyLong:
                "Mobile processors, modems, and SoCs are required for each device, increasing demand for chip designers.",
              stocks: ["QCOM", "ARM", "MEDIATEK"],
              next: []
            }
          ]
        }
      ]
    },

    {
      name: "PC Market",
      direction: "up",
      magnitude: 6,
      speed: "fast",
      confidence: 7,
      order: 1,
      whyShort: "Higher PC demand increases chip usage.",
      whyLong:
        "Growth in PC shipments drives demand for CPUs, GPUs, and supporting components.",
      stocks: ["HPQ", "DELL"],
      next: [
        {
          name: "CPU Demand",
          direction: "up",
          magnitude: 7,
          speed: "fast",
          confidence: 8,
          order: 2,
          whyShort: "More PCs require more processors.",
          whyLong:
            "CPU demand scales with PC production, benefiting processor manufacturers.",
          stocks: ["INTC", "AMD"],
          next: []
        }
      ]
    },

    {
      name: "Automotive Chips",
      direction: "up",
      magnitude: 7,
      speed: "delayed",
      confidence: 8,
      order: 1,
      whyShort: "Modern vehicles require increasing chip content.",
      whyLong:
        "Vehicles are becoming more software-driven, increasing semiconductor demand per vehicle across EVs and traditional autos.",
      stocks: ["NXPI", "ON", "TXN", "STM"],
      next: [
        {
          name: "Vehicle Production",
          direction: "up",
          magnitude: 6,
          speed: "delayed",
          confidence: 7,
          order: 2,
          whyShort: "More vehicles increase chip demand.",
          whyLong:
            "As vehicle production rises, total semiconductor demand in automotive applications also increases.",
          stocks: ["TSLA", "GM", "F"],
          next: []
        }
      ]
    },

    {
      name: "Networking Chips",
      direction: "up",
      magnitude: 8,
      speed: "fast",
      confidence: 8,
      order: 1,
      whyShort: "Higher data traffic increases networking demand.",
      whyLong:
        "Growth in cloud, AI, and internet usage increases demand for networking chips and connectivity hardware.",
      stocks: ["AVGO", "MRVL"],
      next: [
        {
          name: "Data Networking Equipment",
          direction: "up",
          magnitude: 8,
          speed: "fast",
          confidence: 8,
          order: 2,
          whyShort: "More traffic requires more infrastructure.",
          whyLong:
            "Networking equipment providers benefit from increased demand for switches, routers, and data infrastructure.",
          stocks: ["CSCO", "ANET"],
          next: []
        }
      ]
    },

    {
      name: "GPU Demand",
      direction: "up",
      magnitude: 10,
      speed: "fast",
      confidence: 9,
      order: 1,
      whyShort: "AI and compute workloads drive GPU demand.",
      whyLong:
        "GPUs are critical for AI training and high-performance computing, making them one of the strongest drivers of semiconductor demand.",
      stocks: ["NVDA", "AMD"],
      next: [
        {
          name: "AI Model Training",
          direction: "up",
          magnitude: 10,
          speed: "fast",
          confidence: 9,
          order: 2,
          whyShort: "AI training requires massive compute power.",
          whyLong:
            "Large-scale AI models require extensive GPU clusters, increasing demand for high-end chips.",
          stocks: ["NVDA"],
          next: []
        }
      ]
    },

    {
      name: "Semiconductor Designers",
      direction: "up",
      magnitude: 9,
      speed: "fast",
      confidence: 9,
      order: 1,
      whyShort: "Higher demand increases chip design activity.",
      whyLong:
        "As semiconductor demand rises, fabless chip designers benefit from increased orders and product demand.",
      stocks: ["NVDA", "AMD", "QCOM", "AVGO"],
      next: [
        {
          name: "Fabless Chip Industry",
          direction: "up",
          magnitude: 9,
          speed: "fast",
          confidence: 9,
          order: 2,
          whyShort: "Fabless model scales with demand growth.",
          whyLong:
            "Fabless companies leverage foundries to scale production efficiently, benefiting from strong demand cycles.",
          stocks: ["NVDA", "AMD", "QCOM"],
          next: []
        }
      ]
    }

  ],

down: [

  {
    name: "Chip Equipment",
    direction: "down",
    magnitude: 9,
    speed: "fast",
    confidence: 9,
    order: 1,
    whyShort: "Lower chip demand reduces equipment orders.",
    whyLong:
      "As semiconductor demand weakens, foundries and manufacturers pull back on fabrication capacity expansion, which reduces demand for semiconductor equipment.",
    stocks: ["ASML", "LRCX", "AMAT", "KLAC"],
    next: [
      {
        name: "Semiconductor Manufacturing Expansion",
        direction: "down",
        magnitude: 9,
        speed: "delayed",
        confidence: 9,
        order: 2,
        whyShort: "Lower demand reduces fab expansion plans.",
        whyLong:
          "When demand softens, chip manufacturers often delay or reduce capacity expansion and fab investment plans.",
        stocks: ["TSM", "INTC", "GFS"],
        next: [
          {
            name: "Global Chip Supply",
            direction: "down",
            magnitude: 8,
            speed: "delayed",
            confidence: 9,
            order: 3,
            whyShort: "Less capex eventually limits total supply growth.",
            whyLong:
              "As manufacturing expansion slows, future semiconductor supply growth also weakens, though the effect appears with a lag.",
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
    magnitude: 10,
    speed: "fast",
    confidence: 9,
    order: 1,
    whyShort: "Lower AI demand reduces high-performance chip usage.",
    whyLong:
      "Artificial intelligence workloads are a major source of demand for GPUs, accelerators, and advanced semiconductors. If AI-related demand weakens, AI infrastructure spending slows quickly.",
    stocks: ["NVDA", "AVGO", "AMD"],
    next: [
      {
        name: "Data Center Expansion",
        direction: "down",
        magnitude: 9,
        speed: "fast",
        confidence: 9,
        order: 2,
        whyShort: "Lower AI workloads reduce data center buildout.",
        whyLong:
          "If AI demand slows, hyperscalers and enterprises may reduce the pace of data center expansion and related infrastructure spending.",
        stocks: ["NVDA", "SMCI", "DELL"],
        next: [
          {
            name: "Cloud Infrastructure",
            direction: "down",
            magnitude: 8,
            speed: "fast",
            confidence: 8,
            order: 3,
            whyShort: "Lower demand reduces cloud infrastructure scaling.",
            whyLong:
              "Cloud providers may slow infrastructure expansion when AI and compute demand growth weakens, reducing capex intensity.",
            stocks: ["MSFT", "AMZN", "GOOGL"],
            next: []
          }
        ]
      }
    ]
  },

  {
    name: "Memory Chips",
    direction: "down",
    magnitude: 8,
    speed: "fast",
    confidence: 8,
    order: 1,
    whyShort: "Lower compute and device demand reduces memory demand.",
    whyLong:
      "AI, cloud, enterprise, and consumer devices all require large amounts of memory. If semiconductor demand weakens, DRAM and NAND demand usually softens as well.",
    stocks: ["MU", "WDC", "STX"],
    next: [
      {
        name: "Data Storage Demand",
        direction: "down",
        magnitude: 8,
        speed: "fast",
        confidence: 8,
        order: 2,
        whyShort: "Less data growth reduces storage demand.",
        whyLong:
          "As data generation and infrastructure growth slow, storage demand usually weakens across enterprise and consumer applications.",
        stocks: ["MU", "STX", "WDC"],
        next: []
      }
    ]
  },

  {
    name: "Consumer Electronics",
    direction: "down",
    magnitude: 7,
    speed: "fast",
    confidence: 8,
    order: 1,
    whyShort: "Lower device demand reduces chip consumption.",
    whyLong:
      "Consumer electronics such as smartphones, gaming consoles, and wearables require semiconductors, so weaker end-market demand reduces chip usage.",
    stocks: ["AAPL", "SONY"],
    next: [
      {
        name: "Smartphone Production",
        direction: "down",
        magnitude: 7,
        speed: "fast",
        confidence: 8,
        order: 2,
        whyShort: "Lower device demand reduces production volume.",
        whyLong:
          "Smartphone manufacturers typically reduce production when demand softens, which lowers semiconductor demand throughout the mobile supply chain.",
        stocks: ["AAPL", "QCOM"],
        next: [
          {
            name: "Mobile Chip Demand",
            direction: "down",
            magnitude: 8,
            speed: "fast",
            confidence: 8,
            order: 3,
            whyShort: "Lower production reduces demand for mobile chips.",
            whyLong:
              "Mobile processors, modems, and SoCs are tied closely to device production, so weaker smartphone demand pressures chip designers.",
            stocks: ["QCOM", "ARM", "MEDIATEK"],
            next: []
          }
        ]
      }
    ]
  },

  {
    name: "PC Market",
    direction: "down",
    magnitude: 6,
    speed: "fast",
    confidence: 7,
    order: 1,
    whyShort: "Lower PC demand reduces chip usage.",
    whyLong:
      "Weakness in PC shipments reduces demand for CPUs, GPUs, and related components across the PC ecosystem.",
    stocks: ["HPQ", "DELL"],
    next: [
      {
        name: "CPU Demand",
        direction: "down",
        magnitude: 7,
        speed: "fast",
        confidence: 8,
        order: 2,
        whyShort: "Fewer PCs require fewer processors.",
        whyLong:
          "CPU demand is closely linked to PC production, so lower shipment volumes pressure processor manufacturers.",
        stocks: ["INTC", "AMD"],
        next: []
      }
    ]
  },

  {
    name: "Automotive Chips",
    direction: "down",
    magnitude: 7,
    speed: "delayed",
    confidence: 8,
    order: 1,
    whyShort: "Lower vehicle-related chip demand pressures auto semis.",
    whyLong:
      "Modern vehicles use a growing number of semiconductors, so weaker semiconductor demand in automotive applications reduces order volume for auto chip suppliers.",
    stocks: ["NXPI", "ON", "TXN", "STM"],
    next: [
      {
        name: "Vehicle Production",
        direction: "down",
        magnitude: 6,
        speed: "delayed",
        confidence: 7,
        order: 2,
        whyShort: "Lower auto demand reduces production and chip needs.",
        whyLong:
          "If vehicle production softens, total semiconductor demand in automotive applications also tends to decline.",
        stocks: ["TSLA", "GM", "F"],
        next: []
      }
    ]
  },

  {
    name: "Networking Chips",
    direction: "down",
    magnitude: 8,
    speed: "fast",
    confidence: 8,
    order: 1,
    whyShort: "Lower data traffic and infrastructure demand reduce networking chip usage.",
    whyLong:
      "When cloud, AI, and digital infrastructure demand slows, networking chip demand usually weakens as well.",
    stocks: ["AVGO", "MRVL"],
    next: [
      {
        name: "Data Networking Equipment",
        direction: "down",
        magnitude: 8,
        speed: "fast",
        confidence: 8,
        order: 2,
        whyShort: "Lower infrastructure demand reduces networking equipment orders.",
        whyLong:
          "Networking equipment providers face weaker demand for switches, routers, and connectivity hardware when data infrastructure growth slows.",
        stocks: ["CSCO", "ANET"],
        next: []
      }
    ]
  },

  {
    name: "GPU Demand",
    direction: "down",
    magnitude: 10,
    speed: "fast",
    confidence: 9,
    order: 1,
    whyShort: "Weaker AI and compute demand reduces GPU usage.",
    whyLong:
      "GPUs are critical for AI training and high-performance computing, so lower semiconductor demand in those workloads can sharply reduce GPU demand.",
    stocks: ["NVDA", "AMD"],
    next: [
      {
        name: "AI Model Training",
        direction: "down",
        magnitude: 10,
        speed: "fast",
        confidence: 9,
        order: 2,
        whyShort: "Lower training activity reduces high-end compute demand.",
        whyLong:
          "If fewer large-scale AI models are trained or deployment slows, demand for GPU clusters and advanced compute chips also weakens.",
        stocks: ["NVDA"],
        next: []
      }
    ]
  },

  {
    name: "Semiconductor Designers",
    direction: "down",
    magnitude: 9,
    speed: "fast",
    confidence: 9,
    order: 1,
    whyShort: "Lower semiconductor demand pressures chip designers.",
    whyLong:
      "Fabless chip designers depend on strong end-market demand, so lower semiconductor demand usually translates into weaker orders and revenue pressure.",
    stocks: ["NVDA", "AMD", "QCOM", "AVGO"],
    next: [
      {
        name: "Fabless Chip Industry",
        direction: "down",
        magnitude: 9,
        speed: "fast",
        confidence: 9,
        order: 2,
        whyShort: "Fabless demand slows with weaker end markets.",
        whyLong:
          "Fabless semiconductor companies are highly exposed to swings in end-market demand, so a slowdown typically pressures the broader industry.",
        stocks: ["NVDA", "AMD", "QCOM"],
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
      magnitude: 9,
      speed: "fast",
      confidence: 9,
      order: 1,
      whyShort: "Higher housing demand increases home sales and pricing power.",
      whyLong:
        "When housing demand rises, homebuilders benefit from increased orders, stronger pricing, and improved backlog visibility.",
      stocks: ["DHI", "LEN", "PHM", "TOL", "KBH"],
      next: [
        {
          name: "Residential Construction",
          direction: "up",
          magnitude: 9,
          speed: "fast",
          confidence: 9,
          order: 2,
          whyShort: "Builders increase construction activity to meet demand.",
          whyLong:
            "As demand rises, homebuilders ramp up new housing starts and construction activity to meet buyer demand.",
          stocks: ["DHI", "LEN", "PHM", "TOL", "KBH"],
          next: [
            {
              name: "Construction Employment",
              direction: "up",
              magnitude: 7,
              speed: "delayed",
              confidence: 8,
              order: 3,
              whyShort: "More construction activity increases labor demand.",
              whyLong:
                "Higher construction activity leads to increased hiring across construction and related trades.",
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
      magnitude: 7,
      speed: "delayed",
      confidence: 8,
      order: 1,
      whyShort: "More homeownership drives renovation activity.",
      whyLong:
        "New homeowners often invest in upgrades, repairs, and renovations, increasing demand for home improvement retailers.",
      stocks: ["HD", "LOW", "FND"],
      next: [
        {
          name: "Renovation Spending",
          direction: "up",
          magnitude: 7,
          speed: "delayed",
          confidence: 8,
          order: 2,
          whyShort: "Home purchases trigger renovation activity.",
          whyLong:
            "Home transactions often lead to remodeling, upgrades, and maintenance spending, driving renovation demand.",
          stocks: ["HD", "LOW", "FND"],
          next: [
            {
              name: "Building Materials",
              direction: "up",
              magnitude: 7,
              speed: "delayed",
              confidence: 8,
              order: 3,
              whyShort: "More renovation drives materials demand.",
              whyLong:
                "Increased renovation activity boosts demand for materials like cement, aggregates, and other construction inputs.",
              stocks: ["MLM", "VMC", "EXP"],
              next: []
            }
          ]
        }
      ]
    },

    {
      name: "Mortgage Lending",
      direction: "up",
      magnitude: 8,
      speed: "fast",
      confidence: 9,
      order: 1,
      whyShort: "Higher home demand increases loan activity.",
      whyLong:
        "As more homes are purchased, demand for mortgages rises, increasing lending activity and originations.",
      stocks: ["RKT", "UWMC", "PFSI"],
      next: [
        {
          name: "Mortgage Origination Volume",
          direction: "up",
          magnitude: 9,
          speed: "fast",
          confidence: 9,
          order: 2,
          whyShort: "More transactions increase loan volume.",
          whyLong:
            "Higher housing demand directly translates into increased mortgage origination volume across lenders.",
          stocks: ["RKT", "UWMC", "PFSI"],
          next: []
        }
      ]
    },

    {
      name: "Real Estate Brokers",
      direction: "up",
      magnitude: 8,
      speed: "fast",
      confidence: 9,
      order: 1,
      whyShort: "More housing demand increases transaction activity.",
      whyLong:
        "Real estate brokers benefit from higher home transaction volume as demand increases.",
      stocks: ["Z", "RDFN", "EXPI", "CSGP"],
      next: [
        {
          name: "Home Transactions",
          direction: "up",
          magnitude: 9,
          speed: "fast",
          confidence: 9,
          order: 2,
          whyShort: "More buyers and sellers increase transaction volume.",
          whyLong:
            "Housing demand directly drives higher transaction activity across the real estate market.",
          stocks: ["Z", "RDFN", "EXPI", "CSGP"],
          next: []
        }
      ]
    },

    {
      name: "Furniture Sales",
      direction: "up",
      magnitude: 7,
      speed: "delayed",
      confidence: 8,
      order: 1,
      whyShort: "New homeowners purchase furniture after moving.",
      whyLong:
        "Home purchases often trigger furniture spending as buyers furnish and upgrade their living spaces.",
      stocks: ["RH", "WSM", "SNBR", "ETD"],
      next: [
        {
          name: "Home Furnishings Demand",
          direction: "up",
          magnitude: 7,
          speed: "delayed",
          confidence: 8,
          order: 2,
          whyShort: "Move-ins drive furnishing demand.",
          whyLong:
            "Household formation and home turnover increase demand for furnishings and home goods.",
          stocks: ["RH", "WSM", "SNBR", "ETD"],
          next: []
        }
      ]
    },

    {
      name: "Appliance Sales",
      direction: "up",
      magnitude: 7,
      speed: "delayed",
      confidence: 8,
      order: 1,
      whyShort: "New homes drive appliance purchases.",
      whyLong:
        "New homebuyers typically purchase appliances when moving in or upgrading their homes.",
      stocks: ["WHR", "HD", "LOW"],
      next: [
        {
          name: "Home Appliance Demand",
          direction: "up",
          magnitude: 7,
          speed: "delayed",
          confidence: 8,
          order: 2,
          whyShort: "New households increase appliance demand.",
          whyLong:
            "Household formation and home turnover increase demand for appliances and home equipment.",
          stocks: ["WHR", "HD","SN","LOW"],
          next: []
        }
      ]
    },

    {
      name: "Building Materials",
      direction: "up",
      magnitude: 8,
      speed: "fast",
      confidence: 9,
      order: 1,
      whyShort: "Construction activity drives material demand.",
      whyLong:
        "Higher housing demand increases construction and renovation activity, boosting demand for materials like cement and aggregates.",
      stocks: ["MLM", "VMC", "EXP"],
      next: [
        {
          name: "Cement and Aggregates Demand",
          direction: "up",
          magnitude: 8,
          speed: "fast",
          confidence: 9,
          order: 2,
          whyShort: "More construction increases material usage.",
          whyLong:
            "As housing construction rises, demand for cement, aggregates, and infrastructure inputs increases.",
          stocks: ["MLM", "VMC", "EXP"],
          next: []
        }
      ]
    },

    {
      name: "Construction Equipment",
      direction: "up",
      magnitude: 6,
      speed: "delayed",
      confidence: 7,
      order: 1,
      whyShort: "More construction activity increases equipment demand.",
      whyLong:
        "Higher construction activity leads to increased demand for heavy machinery and construction equipment.",
      stocks: ["CAT", "DE", "CNH"],
      next: [
        {
          name: "Heavy Machinery Demand",
          direction: "up",
          magnitude: 6,
          speed: "delayed",
          confidence: 7,
          order: 2,
          whyShort: "Higher project volume drives machinery usage.",
          whyLong:
            "As construction projects increase, demand for heavy equipment rises across the industry.",
          stocks: ["CAT", "DE", "CNH"],
          next: []
        }
      ]
    }

  ],

  down: [

  {
    name: "Homebuilders",
    direction: "down",
    magnitude: 9,
    speed: "fast",
    confidence: 9,
    order: 1,
    whyShort: "Lower housing demand reduces orders and pricing power.",
    whyLong:
      "When housing demand weakens, homebuilders typically face fewer new orders, rising cancellations, and weaker pricing, which pressures revenue and margins.",
    stocks: ["DHI", "LEN", "PHM", "TOL", "KBH", "MTH", "MDC", "TMHC", "BZH", "CCS"],
    next: [
      {
        name: "Residential Construction",
        direction: "down",
        magnitude: 9,
        speed: "fast",
        confidence: 9,
        order: 2,
        whyShort: "Builders slow construction activity.",
        whyLong:
          "As demand falls, homebuilders reduce new housing starts and construction activity to avoid excess inventory.",
        stocks: ["DHI", "LEN", "PHM", "TOL", "KBH", "MTH", "TMHC", "CCS"],
        next: [
          {
            name: "Construction Employment",
            direction: "down",
            magnitude: 7,
            speed: "delayed",
            confidence: 8,
            order: 3,
            whyShort: "Less construction reduces labor demand.",
            whyLong:
              "Lower construction activity leads to reduced hiring and labor demand across construction and related trades.",
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
    magnitude: 7,
    speed: "delayed",
    confidence: 8,
    order: 1,
    whyShort: "Fewer home purchases reduce renovation activity.",
    whyLong:
      "When housing demand weakens, fewer new homeowners means less spending on upgrades, repairs, and renovation projects.",
    stocks: ["HD", "LOW", "FND", "BLDR", "MAS", "PGTI"],
    next: [
      {
        name: "Renovation Spending",
        direction: "down",
        magnitude: 7,
        speed: "delayed",
        confidence: 8,
        order: 2,
        whyShort: "Lower turnover reduces remodeling demand.",
        whyLong:
          "Fewer home transactions typically lead to lower renovation and remodeling activity.",
        stocks: ["HD", "LOW", "FND", "MAS", "BLDR"],
        next: [
          {
            name: "Building Materials",
            direction: "down",
            magnitude: 7,
            speed: "delayed",
            confidence: 8,
            order: 3,
            whyShort: "Less renovation reduces material demand.",
            whyLong:
              "Lower renovation activity reduces demand for materials like cement, aggregates, and construction inputs.",
            stocks: ["MLM", "VMC", "EXP", "SUM", "BCC", "UFPI"],
            next: []
          }
        ]
      }
    ]
  },

  {
    name: "Mortgage Lending",
    direction: "down",
    magnitude: 8,
    speed: "fast",
    confidence: 9,
    order: 1,
    whyShort: "Lower home demand reduces loan activity.",
    whyLong:
      "As fewer homes are purchased, demand for mortgages declines, reducing lending activity.",
    stocks: ["RKT", "UWMC", "PFSI", "FOA"],
    next: [
      {
        name: "Mortgage Origination Volume",
        direction: "down",
        magnitude: 9,
        speed: "fast",
        confidence: 9,
        order: 2,
        whyShort: "Fewer transactions reduce loan volume.",
        whyLong:
          "Lower housing demand directly leads to fewer mortgage originations and reduced loan volume.",
        stocks: ["RKT", "UWMC", "PFSI", "FOA"],
        next: []
      }
    ]
  },

  {
    name: "Real Estate Brokers",
    direction: "down",
    magnitude: 8,
    speed: "fast",
    confidence: 9,
    order: 1,
    whyShort: "Lower demand reduces transaction activity.",
    whyLong:
      "Real estate brokers are highly dependent on transaction volume, which falls when housing demand weakens.",
    stocks: ["Z", "RDFN", "EXPI", "CSGP"],
    next: [
      {
        name: "Home Transactions",
        direction: "down",
        magnitude: 9,
        speed: "fast",
        confidence: 9,
        order: 2,
        whyShort: "Fewer buyers and sellers reduce transactions.",
        whyLong:
          "Lower housing demand directly translates into reduced home transaction activity across the market.",
        stocks: ["Z", "RDFN", "EXPI", "CSGP"],
        next: []
      }
    ]
  },

  {
    name: "Furniture Sales",
    direction: "down",
    magnitude: 7,
    speed: "delayed",
    confidence: 8,
    order: 1,
    whyShort: "Fewer home purchases reduce furniture demand.",
    whyLong:
      "Furniture purchases are closely tied to home turnover, so lower housing demand reduces furnishing activity.",
    stocks: ["RH", "WSM", "SNBR", "ETD", "LZB", "LOVE"],
    next: [
      {
        name: "Home Furnishings Demand",
        direction: "down",
        magnitude: 7,
        speed: "delayed",
        confidence: 8,
        order: 2,
        whyShort: "Fewer move-ins reduce demand.",
        whyLong:
          "Household formation and relocation slow when housing demand weakens, reducing furnishing demand.",
        stocks: ["RH", "WSM", "SNBR", "ETD", "LZB", "LOVE"],
        next: []
      }
    ]
  },

  {
    name: "Appliance Sales",
    direction: "down",
    magnitude: 7,
    speed: "delayed",
    confidence: 8,
    order: 1,
    whyShort: "Fewer home purchases reduce appliance demand.",
    whyLong:
      "Appliance purchases are often tied to home purchases and renovations, so demand declines when housing slows.",
    stocks: ["WHR", "BBY", "LOW", "HD"],
    next: [
      {
        name: "Home Appliance Demand",
        direction: "down",
        magnitude: 7,
        speed: "delayed",
        confidence: 8,
        order: 2,
        whyShort: "Lower household formation reduces demand.",
        whyLong:
          "Reduced housing turnover leads to fewer appliance purchases across households.",
        stocks: ["WHR", "SN", "LOW", "HD"],
        next: []
      }
    ]
  },

  {
    name: "Building Materials",
    direction: "down",
    magnitude: 8,
    speed: "fast",
    confidence: 9,
    order: 1,
    whyShort: "Lower construction reduces material demand.",
    whyLong:
      "Weaker housing demand leads to lower construction and renovation activity, reducing demand for materials.",
    stocks: ["MLM", "VMC", "EXP", "SUM", "BCC", "UFPI", "SSD"],
    next: [
      {
        name: "Cement and Aggregates Demand",
        direction: "down",
        magnitude: 8,
        speed: "fast",
        confidence: 9,
        order: 2,
        whyShort: "Fewer projects reduce material usage.",
        whyLong:
          "Construction slowdowns directly reduce demand for cement, aggregates, and related materials.",
        stocks: ["MLM", "VMC", "EXP", "SUM"],
        next: []
      }
    ]
  },

  {
    name: "Construction Equipment",
    direction: "down",
    magnitude: 6,
    speed: "delayed",
    confidence: 7,
    order: 1,
    whyShort: "Lower construction activity reduces equipment demand.",
    whyLong:
      "When fewer construction projects are initiated, demand for heavy machinery and equipment declines.",
    stocks: ["CAT", "DE", "CNH", "PCAR", "OSK", "TEX"],
    next: [
      {
        name: "Heavy Machinery Demand",
        direction: "down",
        magnitude: 6,
        speed: "delayed",
        confidence: 7,
        order: 2,
        whyShort: "Lower project volume reduces equipment usage.",
        whyLong:
          "Reduced construction activity leads to lower demand for heavy machinery across the sector.",
        stocks: ["CAT", "DE", "CNH", "OSK", "TEX"],
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
      magnitude: 9,
      speed: "fast",
      confidence: 9,
      order: 1,
      whyShort: "Rising geopolitical tensions increase military budgets.",
      whyLong:
        "Heightened geopolitical risk drives governments to increase defense spending, boosting demand for military equipment and services.",
      stocks: ["LMT","RTX","NOC","GD","BA"],
      next: [
        {
          name: "Weapons Procurement",
          direction: "up",
          magnitude: 9,
          speed: "fast",
          confidence: 9,
          order: 2,
          whyShort: "Governments accelerate weapons purchasing.",
          whyLong:
            "Increased defense budgets translate into higher procurement of advanced weapons systems, missiles, and aircraft.",
          stocks: ["LMT","NOC","RTX","GD"],
          next: [
            {
              name: "Defense Manufacturing",
              direction: "up",
              magnitude: 8,
              speed: "delayed",
              confidence: 8,
              order: 3,
              whyShort: "Higher procurement increases production demand.",
              whyLong:
                "Defense contractors ramp up manufacturing to fulfill government contracts for weapons systems and equipment.",
              stocks: ["LMT","GD","RTX"],
              next: []
            }
          ]
        }
      ]
    },

    {
      name: "Oil Prices",
      direction: "up",
      magnitude: 9,
      speed: "fast",
      confidence: 9,
      order: 1,
      whyShort: "Geopolitical instability disrupts supply.",
      whyLong:
        "Conflicts and geopolitical tensions threaten oil supply routes and production, driving oil prices higher.",
      stocks: ["XOM","CVX","COP","EOG"],
      next: [
        {
          name: "Energy Producers",
          direction: "up",
          magnitude: 9,
          speed: "fast",
          confidence: 9,
          order: 2,
          whyShort: "Higher oil prices increase producer profitability.",
          whyLong:
            "Oil and gas producers benefit directly from higher commodity prices through increased revenue and margins.",
          stocks: ["XOM","CVX","EOG","PXD"],
          next: [
            {
              name: "Oil Services",
              direction: "up",
              magnitude: 7,
              speed: "delayed",
              confidence: 8,
              order: 3,
              whyShort: "Higher prices increase drilling activity.",
              whyLong:
                "Sustained higher oil prices incentivize exploration and production, increasing demand for oilfield services.",
              stocks: ["SLB","HAL","BKR"],
              next: []
            }
          ]
        }
      ]
    },

    {
      name: "Gold Prices",
      direction: "up",
      magnitude: 8,
      speed: "fast",
      confidence: 9,
      order: 1,
      whyShort: "Investors seek safe havens during instability.",
      whyLong:
        "Geopolitical uncertainty drives capital into gold as a store of value, increasing prices and benefiting gold producers.",
      stocks: ["NEM","GOLD","AEM","FNV"],
      next: [
        {
          name: "Safe Haven Demand",
          direction: "up",
          magnitude: 8,
          speed: "fast",
          confidence: 9,
          order: 2,
          whyShort: "Risk aversion increases demand for gold.",
          whyLong:
            "Investors shift toward safe assets during periods of uncertainty, boosting demand for gold and related equities.",
          stocks: ["NEM","GOLD","AEM","FNV"],
          next: []
        }
      ]
    },

    {
      name: "Cybersecurity Demand",
      direction: "up",
      magnitude: 8,
      speed: "fast",
      confidence: 9,
      order: 1,
      whyShort: "Cyber threats increase during geopolitical conflict.",
      whyLong:
        "Nation-state cyber activity rises during geopolitical tensions, increasing demand for cybersecurity solutions.",
      stocks: ["PANW","CRWD","ZS","FTNT"],
      next: [
        {
          name: "Government Cyber Defense",
          direction: "up",
          magnitude: 8,
          speed: "fast",
          confidence: 9,
          order: 2,
          whyShort: "Governments increase cyber defense spending.",
          whyLong:
            "Governments invest heavily in cybersecurity infrastructure to defend against escalating cyber threats.",
          stocks: ["PANW","CRWD","FTNT"],
          next: []
        }
      ]
    },

    {
      name: "Defense Technology",
      direction: "up",
      magnitude: 7,
      speed: "fast",
      confidence: 8,
      order: 1,
      whyShort: "Modern warfare increases reliance on data and AI.",
      whyLong:
        "Advanced defense technologies such as AI, data analytics, and surveillance systems become critical during geopolitical conflict.",
      stocks: ["PLTR","KTOS","AVAV"],
      next: [
        {
          name: "Military Intelligence Systems",
          direction: "up",
          magnitude: 7,
          speed: "fast",
          confidence: 8,
          order: 2,
          whyShort: "Demand rises for intelligence and surveillance systems.",
          whyLong:
            "Governments deploy advanced intelligence platforms for surveillance, targeting, and battlefield decision-making.",
          stocks: ["PLTR","KTOS","AVAV"],
          next: []
        }
      ]
    },
    {
  name: "Airlines",
  direction: "down",
  magnitude: 8,
  speed: "fast",
  confidence: 9,
  order: 1,
  whyShort: "Geopolitical tensions reduce travel demand and increase fuel volatility.",
  whyLong:
    "Conflict and instability reduce consumer and business travel while increasing fuel uncertainty, which pressures airline margins and demand.",
  stocks: ["DAL","UAL","AAL","LUV"],
  next: [
    {
      name: "Global Travel Demand",
      direction: "down",
      magnitude: 9,
      speed: "fast",
      confidence: 9,
      order: 2,
      whyShort: "Safety concerns reduce travel activity.",
      whyLong:
        "Geopolitical instability leads to reduced international travel and lower discretionary travel spending.",
      stocks: ["DAL","UAL","LUV"],
      next: [
        {
          name: "Tourism Sector",
          direction: "down",
          magnitude: 7,
          speed: "delayed",
          confidence: 8,
          order: 3,
          whyShort: "Lower travel reduces tourism demand.",
          whyLong:
            "Reduced travel activity leads to lower demand for hotels, booking platforms, and vacation rentals.",
          stocks: ["BKNG","ABNB","EXPE"],
          next: []
        }
      ]
    }
  ]
},

{
  name: "Semiconductor Supply Chains",
  direction: "down",
  magnitude: 9,
  speed: "fast",
  confidence: 9,
  order: 1,
  whyShort: "Geopolitical conflict disrupts chip production and logistics.",
  whyLong:
    "Tensions involving key regions like Taiwan or China can disrupt semiconductor manufacturing and global supply chains.",
  stocks: ["TSM","NVDA","ASML"],
  next: [
    {
      name: "Electronics Manufacturing",
      direction: "down",
      magnitude: 8,
      speed: "fast",
      confidence: 9,
      order: 2,
      whyShort: "Supply disruptions reduce production capacity.",
      whyLong:
        "Electronics manufacturers face production bottlenecks when chip supply becomes constrained.",
      stocks: ["AAPL","SONY","DELL"],
      next: []
    }
  ]
},

{
  name: "Consumer Discretionary Spending",
  direction: "down",
  magnitude: 8,
  speed: "fast",
  confidence: 8,
  order: 1,
  whyShort: "Uncertainty reduces discretionary spending.",
  whyLong:
    "Geopolitical risk weakens consumer confidence, leading households to delay non-essential purchases.",
  stocks: ["AMZN","TSLA","NKE","SBUX"],
  next: [
    {
      name: "Consumer Confidence",
      direction: "down",
      magnitude: 8,
      speed: "fast",
      confidence: 8,
      order: 2,
      whyShort: "Higher uncertainty makes consumers more cautious.",
      whyLong:
        "As uncertainty rises, consumers reduce spending and increase savings, pressuring discretionary sectors.",
      stocks: ["AMZN","TSLA","NKE","SBUX"],
      next: []
    }
  ]
},

    {
      name: "Agricultural Commodities",
      direction: "up",
      magnitude: 7,
      speed: "delayed",
      confidence: 8,
      order: 1,
      whyShort: "Supply disruptions increase agricultural prices.",
      whyLong:
        "Geopolitical conflicts can disrupt global food supply chains, increasing agricultural commodity prices and input demand.",
      stocks: ["MOS","NTR","CF"],
      next: [
        {
          name: "Fertilizer Demand",
          direction: "up",
          magnitude: 7,
          speed: "delayed",
          confidence: 8,
          order: 2,
          whyShort: "Higher crop prices increase fertilizer usage.",
          whyLong:
            "Farmers increase fertilizer usage to maximize yields when crop prices rise due to supply constraints.",
          stocks: ["MOS","NTR","CF"],
          next: []
        }
      ]
    }

  ],

down: [

  {
    name: "Defense Spending",
    direction: "down",
    magnitude: 9,
    speed: "fast",
    confidence: 9,
    order: 1,
    whyShort: "Reduced geopolitical tensions decrease military budgets.",
    whyLong:
      "When geopolitical risk declines, governments scale back defense spending, reducing demand for military equipment and services.",
    stocks: ["LMT","RTX","NOC","GD","BA"],
    next: [
      {
        name: "Weapons Procurement",
        direction: "down",
        magnitude: 9,
        speed: "fast",
        confidence: 9,
        order: 2,
        whyShort: "Lower budgets reduce weapons purchasing.",
        whyLong:
          "Reduced defense spending leads to fewer procurement contracts for advanced weapons systems and equipment.",
        stocks: ["LMT","NOC","RTX","GD"],
        next: [
          {
            name: "Defense Manufacturing",
            direction: "down",
            magnitude: 8,
            speed: "delayed",
            confidence: 8,
            order: 3,
            whyShort: "Lower procurement reduces production demand.",
            whyLong:
              "Defense contractors reduce manufacturing output as new contract flow slows.",
            stocks: ["LMT","GD","RTX"],
            next: []
          }
        ]
      }
    ]
  },

  {
    name: "Oil Prices",
    direction: "down",
    magnitude: 9,
    speed: "fast",
    confidence: 9,
    order: 1,
    whyShort: "Reduced geopolitical risk stabilizes supply.",
    whyLong:
      "When geopolitical tensions ease, oil supply becomes more stable, putting downward pressure on prices.",
    stocks: ["XOM","CVX","COP","EOG"],
    next: [
      {
        name: "Energy Producers",
        direction: "down",
        magnitude: 9,
        speed: "fast",
        confidence: 9,
        order: 2,
        whyShort: "Lower oil prices reduce profitability.",
        whyLong:
          "Oil and gas producers experience lower revenues and margins when commodity prices decline.",
        stocks: ["XOM","CVX","EOG","PXD"],
        next: [
          {
            name: "Oil Services",
            direction: "down",
            magnitude: 7,
            speed: "delayed",
            confidence: 8,
            order: 3,
            whyShort: "Lower prices reduce drilling activity.",
            whyLong:
              "Sustained lower oil prices reduce incentives for exploration and production, decreasing demand for oilfield services.",
            stocks: ["SLB","HAL","BKR"],
            next: []
          }
        ]
      }
    ]
  },

  {
    name: "Gold Prices",
    direction: "down",
    magnitude: 8,
    speed: "fast",
    confidence: 9,
    order: 1,
    whyShort: "Lower uncertainty reduces safe-haven demand.",
    whyLong:
      "As geopolitical risk declines, investors shift away from gold into risk assets, reducing gold prices.",
    stocks: ["NEM","GOLD","AEM","FNV"],
    next: [
      {
        name: "Safe Haven Demand",
        direction: "down",
        magnitude: 8,
        speed: "fast",
        confidence: 9,
        order: 2,
        whyShort: "Reduced risk lowers demand for gold.",
        whyLong:
          "Investor demand for safe-haven assets declines as global stability improves.",
        stocks: ["NEM","GOLD","AEM","FNV"],
        next: []
      }
    ]
  },

  {
    name: "Cybersecurity Demand",
    direction: "down",
    magnitude: 8,
    speed: "fast",
    confidence: 9,
    order: 1,
    whyShort: "Fewer cyber threats reduce demand for security solutions.",
    whyLong:
      "As geopolitical tensions ease, nation-state cyber activity declines, reducing urgency for cybersecurity spending.",
    stocks: ["PANW","CRWD","ZS","FTNT"],
    next: [
      {
        name: "Government Cyber Defense",
        direction: "down",
        magnitude: 8,
        speed: "fast",
        confidence: 9,
        order: 2,
        whyShort: "Lower threat levels reduce government spending.",
        whyLong:
          "Governments scale back cybersecurity investment when perceived threats decline.",
        stocks: ["PANW","CRWD","FTNT"],
        next: []
      }
    ]
  },

  {
    name: "Airlines",
    direction: "up",
    magnitude: 8,
    speed: "fast",
    confidence: 9,
    order: 1,
    whyShort: "Lower geopolitical risk improves travel conditions.",
    whyLong:
      "Reduced geopolitical tensions increase travel demand and lower fuel volatility, benefiting airline profitability.",
    stocks: ["DAL","UAL","AAL","LUV"],
    next: [
      {
        name: "Global Travel Demand",
        direction: "up",
        magnitude: 9,
        speed: "fast",
        confidence: 9,
        order: 2,
        whyShort: "Stability encourages travel activity.",
        whyLong:
          "Consumers and businesses increase travel as uncertainty declines.",
        stocks: ["DAL","UAL","LUV"],
        next: [
          {
            name: "Tourism Sector",
            direction: "up",
            magnitude: 7,
            speed: "delayed",
            confidence: 8,
            order: 3,
            whyShort: "Higher travel boosts tourism demand.",
            whyLong:
              "Increased travel leads to higher demand for hotels, booking platforms, and vacation rentals.",
            stocks: ["BKNG","ABNB","EXPE"],
            next: []
          }
        ]
      }
    ]
  },

  {
    name: "Global Trade",
    direction: "up",
    magnitude: 9,
    speed: "fast",
    confidence: 9,
    order: 1,
    whyShort: "Reduced tensions improve trade flows.",
    whyLong:
      "Lower geopolitical risk facilitates global trade, reduces tariffs, and stabilizes supply chains.",
    stocks: ["ZIM","MATX","DAC","SBLK"],
    next: [
      {
        name: "Shipping",
        direction: "up",
        magnitude: 9,
        speed: "fast",
        confidence: 9,
        order: 2,
        whyShort: "Higher trade increases shipping demand.",
        whyLong:
          "Improved global trade leads to increased shipping volumes and freight demand.",
        stocks: ["ZIM","MATX","DAC","SBLK"],
        next: [
          {
            name: "Container Freight Rates",
            direction: "up",
            magnitude: 8,
            speed: "fast",
            confidence: 8,
            order: 3,
            whyShort: "Higher demand increases freight pricing.",
            whyLong:
              "Increased shipping demand drives higher container freight rates.",
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
    magnitude: 8,
    speed: "fast",
    confidence: 8,
    order: 1,
    whyShort: "Lower risk attracts capital to emerging markets.",
    whyLong:
      "As geopolitical tensions ease, investors increase exposure to emerging markets, boosting equities and currencies.",
    stocks: ["BABA","TSM","PDD","VALE"],
    next: [
      {
        name: "Foreign Investment",
        direction: "up",
        magnitude: 8,
        speed: "fast",
        confidence: 8,
        order: 2,
        whyShort: "Stability increases capital inflows.",
        whyLong:
          "Global investors increase allocations to emerging markets as risk declines.",
        stocks: ["BABA","TSM","PDD","VALE"],
        next: []
      }
    ]
  },

  {
    name: "Semiconductor Supply Chains",
    direction: "up",
    magnitude: 9,
    speed: "fast",
    confidence: 9,
    order: 1,
    whyShort: "Stability improves production and logistics.",
    whyLong:
      "Reduced geopolitical tensions stabilize semiconductor supply chains and improve production reliability.",
    stocks: ["TSM","NVDA","ASML"],
    next: [
      {
        name: "Electronics Manufacturing",
        direction: "up",
        magnitude: 8,
        speed: "fast",
        confidence: 9,
        order: 2,
        whyShort: "Improved supply increases production capacity.",
        whyLong:
          "Electronics manufacturers benefit from stable chip supply and improved production efficiency.",
        stocks: ["AAPL","SONY","DELL"],
        next: []
      }
    ]
  },

  {
    name: "Agricultural Commodities",
    direction: "down",
    magnitude: 7,
    speed: "delayed",
    confidence: 8,
    order: 1,
    whyShort: "Stability reduces supply shocks and prices.",
    whyLong:
      "Reduced geopolitical disruptions stabilize global food supply chains, lowering agricultural commodity prices.",
    stocks: ["MOS","NTR","CF"],
    next: [
      {
        name: "Fertilizer Demand",
        direction: "down",
        magnitude: 7,
        speed: "delayed",
        confidence: 8,
        order: 2,
        whyShort: "Lower crop prices reduce input demand.",
        whyLong:
          "When crop prices fall, farmers reduce fertilizer usage, lowering demand.",
        stocks: ["MOS","NTR","CF"],
        next: []
      }
    ]
  }

]

},

"Wages": {

  up: [

    {
      name: "Consumer Spending",
      direction: "up",
      magnitude: 8,
      speed: "fast",
      confidence: 9,
      order: 1,
      whyShort: "Higher wages increase household purchasing power.",
      whyLong:
        "When wages rise, consumers generally have more disposable income, which supports higher spending across retail and discretionary categories.",
      stocks: [],
      next: [
        {
          name: "Retail",
          direction: "up",
          magnitude: 8,
          speed: "fast",
          confidence: 8,
          order: 2,
          whyShort: "Higher incomes support stronger retail demand.",
          whyLong:
            "Rising wages typically translate into stronger consumer traffic and spending, benefiting broadline retailers and e-commerce platforms.",
          stocks: ["WMT","TGT","COST","AMZN"],
          next: []
        }
      ]
    },

    {
      name: "Wage Inflation",
      direction: "up",
      magnitude: 9,
      speed: "fast",
      confidence: 9,
      order: 1,
      whyShort: "Higher wages increase employer labor expense.",
      whyLong:
        "As wage inflation rises, companies with large hourly workforces and limited operating leverage face higher labor costs, which can pressure margins if pricing does not fully offset the increase.",
      stocks: [],
      next: [
        {
          name: "Labor Costs",
          direction: "up",
          magnitude: 9,
          speed: "fast",
          confidence: 9,
          order: 2,
          whyShort: "Employers face higher payroll expense.",
          whyLong:
            "Labor-intensive businesses are directly exposed to wage inflation through higher payroll, benefits, and staffing costs.",
          stocks: [],
          next: [
            {
              name: "Corporate Profit Margins",
              direction: "down",
              magnitude: 8,
              speed: "delayed",
              confidence: 8,
              order: 3,
              whyShort: "Rising labor expense compresses margins.",
              whyLong:
                "If wage growth outpaces productivity gains or pricing power, corporate profit margins tend to compress, especially in retail, restaurants, and logistics.",
              stocks: ["WMT","TGT","DG","MCD","SBUX","UPS","FDX"],
              next: []
            }
          ]
        }
      ]
    },

    {
      name: "Restaurants",
      direction: "up",
      magnitude: 7,
      speed: "fast",
      confidence: 7,
      order: 1,
      whyShort: "Higher wages support dining demand.",
      whyLong:
        "Rising wages can increase discretionary spending on food away from home, supporting traffic and sales across restaurant chains, though labor inflation can partially offset the benefit.",
      stocks: ["MCD","SBUX","CMG","YUM"],
      next: [
        {
          name: "Food Service Demand",
          direction: "up",
          magnitude: 7,
          speed: "fast",
          confidence: 7,
          order: 2,
          whyShort: "Higher incomes support restaurant spending.",
          whyLong:
            "As disposable income rises, consumers are generally more willing to spend on quick service, coffee, and dining occasions.",
          stocks: ["MCD","CMG","SBUX","YUM"],
          next: []
        }
      ]
    },

    {
      name: "Housing Demand",
      direction: "up",
      magnitude: 7,
      speed: "delayed",
      confidence: 7,
      order: 1,
      whyShort: "Higher wages improve affordability and household formation.",
      whyLong:
        "Wage growth can improve purchasing power and support household formation, which can help housing demand over time, especially if interest rates are not offsetting the effect.",
      stocks: [],
      next: [
        {
          name: "Homebuilders",
          direction: "up",
          magnitude: 7,
          speed: "delayed",
          confidence: 7,
          order: 2,
          whyShort: "Better affordability supports home demand.",
          whyLong:
            "When wages rise enough to improve affordability, homebuilders can benefit from stronger buyer demand and healthier order trends.",
          stocks: ["DHI","LEN","PHM","TOL","KBH"],
          next: []
        }
      ]
    },

    {
      name: "Bank Loan Demand",
      direction: "up",
      magnitude: 7,
      speed: "delayed",
      confidence: 8,
      order: 1,
      whyShort: "Higher wages support borrowing capacity and activity.",
      whyLong:
        "Rising wages can improve household and business confidence, supporting demand for mortgages, auto loans, credit cards, and business lending.",
      stocks: ["JPM","BAC","WFC","USB"],
      next: [
        {
          name: "Credit Growth",
          direction: "up",
          magnitude: 7,
          speed: "delayed",
          confidence: 8,
          order: 2,
          whyShort: "Stronger incomes support loan growth.",
          whyLong:
            "As incomes rise, banks and lenders can see stronger loan balances and improved credit demand across consumer and commercial categories.",
          stocks: ["JPM","BAC","WFC","COF"],
          next: []
        }
      ]
    },
    {
  name: "Discount Retail",
  direction: "down",
  magnitude: 6,
  speed: "fast",
  confidence: 8,
  order: 1,
  whyShort: "Higher wages reduce trade-down behavior.",
  whyLong:
    "When wages rise, consumers are generally less pressured to prioritize only the lowest-cost options, which can reduce the relative advantage of discount and trade-down retailers.",
  stocks: ["DG","DLTR","BIG","OLLI"],
  next: [
    {
      name: "Trade-Down Spending",
      direction: "down",
      magnitude: 6,
      speed: "fast",
      confidence: 8,
      order: 2,
      whyShort: "Stronger incomes reduce value-seeking behavior.",
      whyLong:
        "As household income improves, consumers often shift some spending away from extreme value channels toward broader retail and discretionary categories.",
      stocks: ["DG","DLTR","OLLI"],
      next: []
    }
  ]
},

{
  name: "Rate-Cut Sensitive Defensives",
  direction: "down",
  magnitude: 6,
  speed: "fast",
  confidence: 7,
  order: 1,
  whyShort: "Higher wages can reinforce inflation and keep rates higher.",
  whyLong:
    "If wage growth remains strong, inflation pressure can stay elevated, which may reduce the relative appeal of rate-sensitive defensive equities such as utilities and REIT-like yield vehicles.",
  stocks: ["NEE","DUK","SO","PLD"],
  next: [
    {
      name: "Defensive Yield Assets",
      direction: "down",
      magnitude: 6,
      speed: "fast",
      confidence: 7,
      order: 2,
      whyShort: "Higher rate pressure weighs on defensive yield names.",
      whyLong:
        "When markets expect stronger wage-driven inflation and a firmer rate backdrop, defensive yield-oriented equities can face valuation pressure.",
      stocks: ["NEE","DUK","SO","PLD"],
      next: []
    }
  ]
},

    {
      name: "Small Business Activity",
      direction: "up",
      magnitude: 7,
      speed: "delayed",
      confidence: 8,
      order: 1,
      whyShort: "Higher wages can support local demand and business formation.",
      whyLong:
        "Stronger wage income can support small-business sales, payroll activity, and business formation, particularly in local services and consumer-facing categories.",
      stocks: ["INTU","PAYX","ADP","GPN"],
      next: [
        {
          name: "Regional Banks",
          direction: "up",
          magnitude: 7,
          speed: "delayed",
          confidence: 8,
          order: 2,
          whyShort: "Small business activity supports local loan demand.",
          whyLong:
            "Regional banks often benefit from stronger small-business formation and activity through commercial lending, deposits, and treasury relationships.",
          stocks: ["PNC","TFC","RF","FITB","HBAN"],
          next: []
        }
      ]
    }

  ],

down: [

  {
    name: "Consumer Spending",
    direction: "down",
    magnitude: 8,
    speed: "fast",
    confidence: 9,
    order: 1,
    whyShort: "Lower wages reduce household purchasing power.",
    whyLong:
      "When wage growth weakens or wages decline, consumers generally have less disposable income, which pressures spending across retail and discretionary categories.",
    stocks: [],
    next: [
      {
        name: "Retail",
        direction: "down",
        magnitude: 8,
        speed: "fast",
        confidence: 8,
        order: 2,
        whyShort: "Lower incomes reduce retail demand.",
        whyLong:
          "Weaker wage growth tends to reduce store traffic, basket size, and discretionary purchases, pressuring retailers and e-commerce platforms.",
        stocks: ["WMT","TGT","COST","AMZN"],
        next: []
      }
    ]
  },

  {
    name: "Wage Growth",
    direction: "down",
    magnitude: 9,
    speed: "fast",
    confidence: 9,
    order: 1,
    whyShort: "Slower wage growth reduces employer labor pressure.",
    whyLong:
      "When wage growth slows, employers face less payroll inflation, which can ease cost pressure across labor-intensive industries.",
    stocks: [],
    next: [
      {
        name: "Labor Costs",
        direction: "down",
        magnitude: 9,
        speed: "fast",
        confidence: 9,
        order: 2,
        whyShort: "Slower wage growth reduces payroll expense.",
        whyLong:
          "Companies with large hourly workforces benefit from slower wage growth through reduced labor cost pressure and improved expense control.",
        stocks: [],
        next: [
          {
            name: "Corporate Profit Margins",
            direction: "up",
            magnitude: 7,
            speed: "delayed",
            confidence: 8,
            order: 3,
            whyShort: "Lower labor costs can support margins.",
            whyLong:
              "If wage pressure eases, labor-intensive businesses can see margin expansion, especially if revenues remain relatively stable.",
            stocks: ["WMT","TGT","DG","MCD","SBUX","UPS","FDX"],
            next: []
          }
        ]
      }
    ]
  },
  {
  name: "Corporate Profit Margins",
  direction: "up",
  magnitude: 7,
  speed: "delayed",
  confidence: 8,
  order: 1,
  whyShort: "Lower wage pressure reduces labor expense.",
  whyLong:
    "When wage growth slows, labor-intensive companies can benefit from easing payroll pressure, which can help stabilize or expand operating margins if revenues hold up reasonably well.",
  stocks: ["WMT","TGT","DG","UPS","FDX"],
  next: [
    {
      name: "Labor-Intensive Employers",
      direction: "up",
      magnitude: 7,
      speed: "delayed",
      confidence: 8,
      order: 2,
      whyShort: "Lower wage inflation improves cost structure.",
      whyLong:
        "Businesses with large employee bases often benefit when wage inflation cools, because labor is one of their biggest recurring operating costs.",
      stocks: ["WMT","DG","UPS","FDX"],
      next: []
    }
  ]
},

{
  name: "Discount Retail",
  direction: "up",
  magnitude: 6,
  speed: "fast",
  confidence: 8,
  order: 1,
  whyShort: "Weaker wage growth pushes consumers toward value options.",
  whyLong:
    "When wage growth weakens, households often become more price-sensitive and shift spending toward discount and value-oriented retailers.",
  stocks: ["WMT","COST","DG","DLTR"],
  next: [
    {
      name: "Trade-Down Spending",
      direction: "up",
      magnitude: 7,
      speed: "fast",
      confidence: 8,
      order: 2,
      whyShort: "Consumers shift toward lower-cost purchases.",
      whyLong:
        "Consumers facing weaker income growth often trade down from premium brands and discretionary purchases toward essentials and lower-price retail channels.",
      stocks: ["WMT","COST","DG","DLTR"],
      next: []
    }
  ]
},

{
  name: "Rate-Cut Sensitive Equities",
  direction: "up",
  magnitude: 6,
  speed: "fast",
  confidence: 7,
  order: 1,
  whyShort: "Weaker wage growth can reduce inflation pressure and support lower rates.",
  whyLong:
    "If wage growth slows, inflation pressure may ease, which can improve the outlook for interest rates and support rate-sensitive defensive equities.",
  stocks: ["NEE","DUK","SO","PLD"],
  next: [
    {
      name: "Defensive Yield Assets",
      direction: "up",
      magnitude: 6,
      speed: "fast",
      confidence: 7,
      order: 2,
      whyShort: "Lower rate pressure supports defensive valuation multiples.",
      whyLong:
        "Utilities and other defensive yield-oriented equities can benefit when markets expect less inflation pressure and a more supportive rate environment.",
      stocks: ["NEE","DUK","SO","PLD"],
      next: []
    }
  ]
},

  {
    name: "Restaurants",
    direction: "down",
    magnitude: 7,
    speed: "fast",
    confidence: 7,
    order: 1,
    whyShort: "Weaker wages reduce dining demand.",
    whyLong:
      "When wage growth slows, consumers often cut back on discretionary food-away-from-home spending, which pressures restaurant traffic and sales.",
    stocks: ["MCD","SBUX","CMG","YUM"],
    next: [
      {
        name: "Food Service Demand",
        direction: "down",
        magnitude: 7,
        speed: "fast",
        confidence: 7,
        order: 2,
        whyShort: "Lower incomes reduce restaurant spending.",
        whyLong:
          "Weaker household income growth tends to reduce visits to restaurants, coffee chains, and other food service providers.",
        stocks: ["MCD","CMG","SBUX","YUM"],
        next: []
      }
    ]
  },

  {
    name: "Housing Demand",
    direction: "down",
    magnitude: 7,
    speed: "delayed",
    confidence: 7,
    order: 1,
    whyShort: "Weaker wages reduce affordability and household formation.",
    whyLong:
      "If wages weaken, household purchasing power and affordability tend to fall, which can pressure housing demand over time.",
    stocks: [],
    next: [
      {
        name: "Homebuilders",
        direction: "down",
        magnitude: 7,
        speed: "delayed",
        confidence: 7,
        order: 2,
        whyShort: "Lower affordability pressures new home demand.",
        whyLong:
          "Homebuilders can face weaker order growth and softer demand when wage growth no longer supports affordability.",
        stocks: ["DHI","LEN","PHM","TOL","KBH"],
        next: []
      }
    ]
  },

  {
    name: "Bank Loan Demand",
    direction: "down",
    magnitude: 7,
    speed: "delayed",
    confidence: 8,
    order: 1,
    whyShort: "Weaker wages reduce borrowing capacity and confidence.",
    whyLong:
      "When wage growth slows, consumers and businesses often become more cautious, which can reduce demand for mortgages, credit cards, auto loans, and other lending products.",
    stocks: ["JPM","BAC","WFC","USB"],
    next: [
      {
        name: "Credit Growth",
        direction: "down",
        magnitude: 7,
        speed: "delayed",
        confidence: 8,
        order: 2,
        whyShort: "Weaker incomes pressure loan growth.",
        whyLong:
          "Banks and lenders often see slower balance growth when weaker income trends reduce borrowing demand and economic activity.",
        stocks: ["JPM","BAC","WFC","COF"],
        next: []
      }
    ]
  }

]

},

"Bond Market Stress (Bond Yields)": {

  up: [

    {
      name: "Bank Stability",
      direction: "down",
      magnitude: 9,
      speed: "fast",
      confidence: 9,
      order: 1,
      whyShort: "Bond market stress weakens confidence in bank balance sheets.",
      whyLong:
        "When bond market stress rises, unrealized losses on securities portfolios, funding concerns, and deposit sensitivity can pressure perceived bank stability, especially across institutions with balance-sheet duration exposure.",
      stocks: ["JPM","BAC","WFC","USB"],
      next: [
        {
          name: "Regional Banks",
          direction: "down",
          magnitude: 9,
          speed: "fast",
          confidence: 9,
          order: 2,
          whyShort: "Regional banks are more exposed to funding and confidence pressure.",
          whyLong:
            "Regional banks are often more vulnerable to funding stress, deposit outflows, and tighter confidence conditions when bond markets become unstable.",
          stocks: ["PNC","TFC","RF","FITB","HBAN"],
          next: [
            {
              name: "Credit Availability",
              direction: "down",
              magnitude: 8,
              speed: "delayed",
              confidence: 9,
              order: 3,
              whyShort: "Bank stress reduces willingness and capacity to lend.",
              whyLong:
                "As banking conditions tighten, credit availability typically falls because lenders become more conservative and preserve liquidity and capital.",
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
      magnitude: 9,
      speed: "fast",
      confidence: 9,
      order: 1,
      whyShort: "Bond stress increases uncertainty and cross-asset volatility.",
      whyLong:
        "Bond market stress often spills into equities through rate repricing, liquidity stress, and shifting risk expectations, which increases overall market volatility.",
      stocks: ["VIRT","MKTX","CBOE","SCHW"],
      next: [
        {
          name: "Risk Assets",
          direction: "down",
          magnitude: 8,
          speed: "fast",
          confidence: 9,
          order: 2,
          whyShort: "Higher volatility pressures risk asset valuations.",
          whyLong:
            "As volatility rises and financial conditions tighten, investors tend to reduce exposure to richly valued and risk-sensitive assets.",
          stocks: ["AAPL","MSFT","NVDA","AMZN","TSLA"],
          next: []
        }
      ]
    },

    {
      name: "Tech Stocks",
      direction: "down",
      magnitude: 8,
      speed: "fast",
      confidence: 9,
      order: 1,
      whyShort: "Higher discount rates pressure long-duration equities.",
      whyLong:
        "Bond market stress often pushes yields and discount-rate uncertainty higher, which weighs disproportionately on large-cap technology and other long-duration growth stocks.",
      stocks: ["AAPL","MSFT","NVDA","AMZN","TSLA"],
      next: [
        {
          name: "Growth Stock Valuations",
          direction: "down",
          magnitude: 9,
          speed: "fast",
          confidence: 9,
          order: 2,
          whyShort: "Higher rates compress high-multiple growth valuations.",
          whyLong:
            "Growth stocks with elevated valuation multiples are especially sensitive to higher discount rates and tighter liquidity conditions.",
          stocks: ["TSLA","PLTR","RBLX","COIN","SNOW"],
          next: []
        }
      ]
    },

    {
      name: "Corporate Borrowing Costs",
      direction: "up",
      magnitude: 9,
      speed: "fast",
      confidence: 9,
      order: 1,
      whyShort: "Bond stress raises financing costs for companies.",
      whyLong:
        "As bond market stress intensifies, credit spreads and benchmark yields often rise, increasing borrowing costs across the corporate sector.",
      stocks: [],
      next: [
        {
          name: "Corporate Debt Issuance",
          direction: "down",
          magnitude: 8,
          speed: "fast",
          confidence: 8,
          order: 2,
          whyShort: "Higher yields reduce appetite for new issuance.",
          whyLong:
            "When borrowing costs rise and markets become less stable, companies often delay or reduce debt issuance.",
          stocks: [],
          next: [
            {
              name: "Business Investment",
              direction: "down",
              magnitude: 8,
              speed: "delayed",
              confidence: 8,
              order: 3,
              whyShort: "Higher financing costs reduce capital spending.",
              whyLong:
                "As financing becomes more expensive and less available, companies tend to slow capital expenditure, fleet upgrades, and expansion plans.",
              stocks: ["CAT","DE","HON","ETN","PCAR"],
              next: []
            }
          ]
        }
      ]
    },

    {
      name: "Housing Demand",
      direction: "down",
      magnitude: 8,
      speed: "fast",
      confidence: 9,
      order: 1,
      whyShort: "Bond stress raises mortgage rates and hurts affordability.",
      whyLong:
        "Bond market stress can push mortgage rates higher and tighten financing conditions, which reduces affordability and pressures housing demand.",
      stocks: [],
      next: [
        {
          name: "Homebuilders",
          direction: "down",
          magnitude: 8,
          speed: "fast",
          confidence: 8,
          order: 2,
          whyShort: "Higher mortgage rates weaken new-home demand.",
          whyLong:
            "Homebuilders tend to face weaker orders and softer housing demand when financing costs rise and affordability deteriorates.",
          stocks: ["DHI","LEN","PHM","TOL","KBH"],
          next: []
        }
      ]
    },

    {
      name: "Credit Markets",
      direction: "tightening",
      magnitude: 9,
      speed: "fast",
      confidence: 9,
      order: 1,
      whyShort: "Bond stress leads lenders and investors to become more restrictive.",
      whyLong:
        "When bond markets are under stress, credit spreads widen, risk tolerance falls, and financing conditions tighten across public and private credit markets.",
      stocks: [],
      next: [
        {
          name: "High Yield Bonds",
          direction: "down",
          magnitude: 8,
          speed: "fast",
          confidence: 8,
          order: 2,
          whyShort: "Riskier issuers are hit hardest when spreads widen.",
          whyLong:
            "Lower-quality borrowers are more exposed to refinancing risk and spread widening during periods of bond market stress.",
          stocks: ["CCL","UAL","NCLH","RCL","F"],
          next: []
        }
      ]
    },

    {
      name: "Liquidity Conditions",
      direction: "down",
      magnitude: 9,
      speed: "fast",
      confidence: 9,
      order: 1,
      whyShort: "Bond stress drains liquidity from financial markets.",
      whyLong:
        "Periods of bond market stress often reduce market depth, tighten financial conditions, and make investors less willing to fund speculative or duration-sensitive assets.",
      stocks: ["AAPL","MSFT","NVDA","AMZN","TSLA","PLTR"],
      next: [
        {
          name: "Risk Appetite",
          direction: "down",
          magnitude: 9,
          speed: "fast",
          confidence: 9,
          order: 2,
          whyShort: "Lower liquidity reduces investor willingness to hold risk.",
          whyLong:
            "As liquidity weakens, investors generally rotate away from speculative and risk-sensitive exposures toward safer assets and cash-like positioning.",
          stocks: [],
          next: []
        }
      ]
    },

    {
      name: "Gold",
      direction: "up",
      magnitude: 7,
      speed: "fast",
      confidence: 8,
      order: 1,
      whyShort: "Bond stress can increase demand for safe-haven assets.",
      whyLong:
        "When bond market stress reflects broader financial instability, investors may rotate toward safe-haven assets such as gold, benefiting gold-linked equities.",
      stocks: ["NEM","GOLD","AEM","FNV"],
      next: [
        {
          name: "Safe Haven Demand",
          direction: "up",
          magnitude: 8,
          speed: "fast",
          confidence: 8,
          order: 2,
          whyShort: "Financial stress increases demand for defensive stores of value.",
          whyLong:
            "Periods of financial instability often push investors toward perceived stores of value and defensive hard-asset exposure.",
          stocks: ["NEM","GOLD","AEM","FNV"],
          next: []
        }
      ]
    },

  ],

down: [

  {
    name: "Bank Stability",
    direction: "up",
    magnitude: 9,
    speed: "fast",
    confidence: 9,
    order: 1,
    whyShort: "Lower bond market stress improves confidence in bank balance sheets.",
    whyLong:
      "When bond market stress eases, pressure on securities portfolios, funding conditions, and deposit stability tends to improve, supporting large-bank balance sheet confidence.",
    stocks: ["JPM","BAC","WFC","USB"],
    next: [
      {
        name: "Regional Banks",
        direction: "up",
        magnitude: 9,
        speed: "fast",
        confidence: 9,
        order: 2,
        whyShort: "Improved funding conditions support regional banks.",
        whyLong:
          "Regional banks typically benefit disproportionately when bond market stress fades, as deposit confidence, funding access, and perceived balance-sheet risk improve.",
        stocks: ["PNC","TFC","RF","FITB","HBAN"],
        next: [
          {
            name: "Credit Availability",
            direction: "up",
            magnitude: 8,
            speed: "delayed",
            confidence: 9,
            order: 3,
            whyShort: "Healthier banks are more willing to lend.",
            whyLong:
              "As banking stress fades and balance sheets stabilize, lenders generally become more willing to extend credit across consumer and commercial markets.",
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
    magnitude: 9,
    speed: "fast",
    confidence: 9,
    order: 1,
    whyShort: "Lower bond stress reduces cross-asset uncertainty.",
    whyLong:
      "When bond markets stabilize, rate volatility, liquidity concerns, and financial uncertainty tend to ease, reducing overall equity market volatility.",
    stocks: ["VIRT","MKTX","CBOE","SCHW"],
    next: [
      {
        name: "Risk Assets",
        direction: "up",
        magnitude: 8,
        speed: "fast",
        confidence: 9,
        order: 2,
        whyShort: "Lower volatility supports risk-taking.",
        whyLong:
          "As volatility falls and financial conditions improve, investors typically become more willing to own richly valued and risk-sensitive assets.",
        stocks: ["AAPL","MSFT","NVDA","AMZN","TSLA"],
        next: []
      }
    ]
  },

  {
    name: "Tech Stocks",
    direction: "up",
    magnitude: 8,
    speed: "fast",
    confidence: 9,
    order: 1,
    whyShort: "Lower rate stress supports long-duration equities.",
    whyLong:
      "When bond market stress declines, discount-rate uncertainty usually falls as well, which is supportive for large-cap technology and other long-duration growth stocks.",
    stocks: ["AAPL","MSFT","NVDA","AMZN","TSLA"],
    next: [
      {
        name: "Growth Stock Valuations",
        direction: "up",
        magnitude: 9,
        speed: "fast",
        confidence: 9,
        order: 2,
        whyShort: "Lower discount-rate pressure supports high multiples.",
        whyLong:
          "Growth stocks with elevated valuation multiples tend to perform better when yields stabilize and liquidity conditions improve.",
        stocks: ["TSLA","PLTR","RBLX","COIN","SNOW"],
        next: []
      }
    ]
  },

  {
    name: "Corporate Borrowing Costs",
    direction: "down",
    magnitude: 9,
    speed: "fast",
    confidence: 9,
    order: 1,
    whyShort: "Lower bond stress reduces financing costs.",
    whyLong:
      "As bond market stress fades, benchmark yields and credit spreads often normalize, reducing borrowing costs across the corporate sector.",
    stocks: [],
    next: [
      {
        name: "Corporate Debt Issuance",
        direction: "up",
        magnitude: 8,
        speed: "fast",
        confidence: 8,
        order: 2,
        whyShort: "Lower yields support new issuance.",
        whyLong:
          "When financing costs fall and markets stabilize, companies are generally more willing to issue debt to refinance obligations or fund growth.",
        stocks: [],
        next: [
          {
            name: "Business Investment",
            direction: "up",
            magnitude: 8,
            speed: "delayed",
            confidence: 8,
            order: 3,
            whyShort: "Cheaper capital supports capex.",
            whyLong:
              "As financing becomes cheaper and more available, companies often increase capital expenditure, equipment purchases, and expansion plans.",
            stocks: ["CAT","DE","HON","ETN","PCAR"],
            next: []
          }
        ]
      }
    ]
  },

  {
    name: "Housing Demand",
    direction: "up",
    magnitude: 8,
    speed: "fast",
    confidence: 9,
    order: 1,
    whyShort: "Lower bond stress can improve mortgage conditions.",
    whyLong:
      "As bond market stress eases, mortgage rates and financing conditions often improve, which can support affordability and housing demand.",
    stocks: [],
    next: [
      {
        name: "Homebuilders",
        direction: "up",
        magnitude: 8,
        speed: "fast",
        confidence: 8,
        order: 2,
        whyShort: "Better financing supports home demand.",
        whyLong:
          "Homebuilders typically benefit when financing conditions improve and mortgage-related affordability pressure eases.",
        stocks: ["DHI","LEN","PHM","TOL","KBH"],
        next: []
      }
    ]
  },

  {
    name: "Credit Markets",
    direction: "easing",
    magnitude: 9,
    speed: "fast",
    confidence: 9,
    order: 1,
    whyShort: "Lower bond stress improves credit conditions.",
    whyLong:
      "As bond market stress declines, credit spreads narrow, refinancing conditions improve, and financing becomes more available across public and private credit markets.",
    stocks: [],
    next: [
      {
        name: "High Yield Bonds",
        direction: "up",
        magnitude: 8,
        speed: "fast",
        confidence: 8,
        order: 2,
        whyShort: "Lower spreads help riskier borrowers.",
        whyLong:
          "Lower-quality issuers tend to benefit when credit markets ease because refinancing risk falls and access to capital improves.",
        stocks: ["CCL","UAL","NCLH","RCL","F"],
        next: []
      }
    ]
  },

  {
    name: "Liquidity Conditions",
    direction: "up",
    magnitude: 9,
    speed: "fast",
    confidence: 9,
    order: 1,
    whyShort: "Lower bond stress improves market liquidity.",
    whyLong:
      "When bond markets stabilize, financial conditions loosen, market depth improves, and investors become more willing to fund risk assets.",
    stocks: [],
    next: [
      {
        name: "Risk Appetite",
        direction: "up",
        magnitude: 9,
        speed: "fast",
        confidence: 9,
        order: 2,
        whyShort: "Better liquidity supports risk-taking.",
        whyLong:
          "As liquidity improves, investors generally rotate back into speculative and risk-sensitive assets, supporting broader market participation.",
        stocks: ["AAPL","MSFT","NVDA","AMZN","TSLA","PLTR"],
        next: []
      }
    ]
  },

  {
    name: "Gold",
    direction: "down",
    magnitude: 7,
    speed: "fast",
    confidence: 8,
    order: 1,
    whyShort: "Lower financial stress reduces safe-haven demand.",
    whyLong:
      "When bond market stress fades and financial conditions stabilize, investors often reduce exposure to safe-haven assets such as gold.",
    stocks: ["NEM","GOLD","AEM","FNV"],
    next: [
      {
        name: "Safe Haven Demand",
        direction: "down",
        magnitude: 8,
        speed: "fast",
        confidence: 8,
        order: 2,
        whyShort: "Lower stress reduces demand for defensive hard assets.",
        whyLong:
          "As market stability improves, investor demand for defensive stores of value usually weakens.",
        stocks: ["NEM","GOLD","AEM","FNV"],
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
      magnitude: 9,
      speed: "fast",
      confidence: 9,
      order: 1,
      whyShort: "More liquidity supports equity valuations.",
      whyLong:
        "When central bank liquidity expands, financial conditions loosen and excess capital tends to flow into equities, supporting market multiples and broad risk asset performance.",
      stocks: ["AAPL","MSFT","NVDA","AMZN","META"],
      next: [
        {
          name: "Risk Appetite",
          direction: "up",
          magnitude: 9,
          speed: "fast",
          confidence: 9,
          order: 2,
          whyShort: "Looser financial conditions increase investor risk-taking.",
          whyLong:
            "Higher liquidity reduces funding stress and encourages investors to move out along the risk curve into higher-beta and more speculative assets.",
          stocks: [],
          next: [
            {
              name: "Speculative Assets",
              direction: "up",
              magnitude: 8,
              speed: "fast",
              confidence: 8,
              order: 3,
              whyShort: "Higher liquidity favors high-beta speculative names.",
              whyLong:
                "Speculative and sentiment-driven equities tend to outperform when liquidity is abundant and investors are more willing to tolerate valuation risk.",
              stocks: ["TSLA","PLTR","RBLX","COIN","SOFI"],
              next: []
            }
          ]
        }
      ]
    },

    {
      name: "Tech Stocks",
      direction: "up",
      magnitude: 9,
      speed: "fast",
      confidence: 9,
      order: 1,
      whyShort: "Liquidity expansion supports long-duration growth equities.",
      whyLong:
        "Large-cap technology and growth stocks tend to benefit when central bank liquidity expands because lower funding stress and easier financial conditions support higher valuation multiples.",
      stocks: ["AAPL","MSFT","NVDA","GOOGL","META"],
      next: [
        {
          name: "Growth Stock Valuations",
          direction: "up",
          magnitude: 9,
          speed: "fast",
          confidence: 9,
          order: 2,
          whyShort: "Lower discount-rate pressure supports high multiples.",
          whyLong:
            "Growth stocks are especially sensitive to financial conditions, and greater liquidity tends to support elevated valuations across long-duration assets.",
          stocks: ["TSLA","PLTR","RBLX","COIN","SNOW"],
          next: [
            {
              name: "Venture Capital Funding",
              direction: "up",
              magnitude: 7,
              speed: "delayed",
              confidence: 7,
              order: 3,
              whyShort: "Easy liquidity improves private-market funding conditions.",
              whyLong:
                "When liquidity is plentiful and public-market valuations are strong, venture capital funding conditions often improve as risk tolerance expands across private markets.",
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
      magnitude: 8,
      speed: "fast",
      confidence: 8,
      order: 1,
      whyShort: "More liquidity supports crypto demand and speculation.",
      whyLong:
        "Crypto assets and crypto-linked equities often benefit when central bank liquidity rises, as looser monetary conditions tend to favor speculative and alternative assets.",
      stocks: ["COIN","MSTR","HOOD"],
      next: [
        {
          name: "Crypto Trading Volume",
          direction: "up",
          magnitude: 8,
          speed: "fast",
          confidence: 8,
          order: 2,
          whyShort: "Improved risk sentiment boosts crypto trading activity.",
          whyLong:
            "As liquidity rises and speculative appetite strengthens, trading volumes across digital asset platforms typically increase.",
          stocks: ["COIN","HOOD"],
          next: [
            {
              name: "Blockchain Activity",
              direction: "up",
              magnitude: 7,
              speed: "delayed",
              confidence: 7,
              order: 3,
              whyShort: "Higher trading and asset prices increase ecosystem usage.",
              whyLong:
                "Improved crypto market conditions often support greater network participation, trading activity, and broader blockchain ecosystem engagement.",
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
      magnitude: 8,
      speed: "fast",
      confidence: 9,
      order: 1,
      whyShort: "More liquidity supports credit availability and spread compression.",
      whyLong:
        "Central bank liquidity tends to ease financial conditions, narrow credit spreads, and improve access to financing across leveraged and lower-quality borrowers.",
      stocks: [],
      next: [
        {
          name: "High Yield Bonds",
          direction: "up",
          magnitude: 8,
          speed: "fast",
          confidence: 8,
          order: 2,
          whyShort: "Looser liquidity helps lower-quality borrowers.",
          whyLong:
            "Riskier issuers tend to benefit when credit markets are supported by easier liquidity and improved refinancing conditions.",
          stocks: ["F","CCL","UAL","NCLH","RCL"],
          next: [
            {
              name: "Corporate Borrowing",
              direction: "up",
              magnitude: 8,
              speed: "delayed",
              confidence: 8,
              order: 3,
              whyShort: "Easier conditions encourage more borrowing.",
              whyLong:
                "When central bank liquidity is supportive, companies are generally more willing and able to issue debt to refinance obligations and fund expansion.",
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
      magnitude: 7,
      speed: "delayed",
      confidence: 8,
      order: 1,
      whyShort: "Easier liquidity can improve mortgage and financing conditions.",
      whyLong:
        "As liquidity expands and financial conditions loosen, mortgage markets and housing affordability can improve enough to support housing demand.",
      stocks: [],
      next: [
        {
          name: "Homebuilders",
          direction: "up",
          magnitude: 8,
          speed: "delayed",
          confidence: 8,
          order: 2,
          whyShort: "Improved financing supports new-home demand.",
          whyLong:
            "Homebuilders tend to benefit when financing conditions ease and buyer demand improves due to better affordability and credit availability.",
          stocks: ["DHI","LEN","PHM","TOL","KBH"],
          next: []
        }
      ]
    },

    {
      name: "Small Cap Stocks",
      direction: "up",
      magnitude: 8,
      speed: "fast",
      confidence: 8,
      order: 1,
      whyShort: "Small caps benefit disproportionately from easier liquidity.",
      whyLong:
        "Smaller companies are generally more sensitive to financial conditions, so rising central bank liquidity often supports small-cap performance through improved risk appetite and financing conditions.",
      stocks: ["IOT","APP","RKLB","SOFI","AFRM"],
      next: [
        {
          name: "Regional Banks",
          direction: "up",
          magnitude: 7,
          speed: "delayed",
          confidence: 8,
          order: 2,
          whyShort: "Easier liquidity improves local banking conditions.",
          whyLong:
            "Regional banks often benefit when liquidity expands because funding conditions improve and local credit activity becomes more supportive.",
          stocks: ["PNC","TFC","RF","FITB","HBAN"],
          next: []
        }
      ]
    },
    {
  name: "Cash Yield Assets",
  direction: "down",
  magnitude: 8,
  speed: "fast",
  confidence: 9,
  order: 1,
  whyShort: "Lower rates reduce returns on cash and short-duration assets.",
  whyLong:
    "When central bank liquidity increases, short-term interest rates tend to fall, making cash and money market instruments less attractive and leading to capital rotation into risk assets.",
  stocks: ["SCHW","BLK","MS","GS"],
  next: [
    {
      name: "Money Market Flows",
      direction: "down",
      magnitude: 8,
      speed: "fast",
      confidence: 9,
      order: 2,
      whyShort: "Lower yields reduce demand for cash-like instruments.",
      whyLong:
        "As yields decline, investors pull capital out of money market funds and short-duration assets in search of higher returns.",
      stocks: ["SCHW","BLK","MS"],
      next: []
    }
  ]
},
{
  name: "Consumer Staples",
  direction: "down",
  magnitude: 6,
  speed: "fast",
  confidence: 8,
  order: 1,
  whyShort: "Investors rotate away from defensive sectors in risk-on environments.",
  whyLong:
    "When liquidity expands and risk appetite increases, capital tends to rotate out of defensive sectors like consumer staples and into higher-growth and cyclical opportunities.",
  stocks: ["PG","KO","PEP","WMT","COST"],
  next: [
    {
      name: "Defensive Positioning",
      direction: "down",
      magnitude: 6,
      speed: "fast",
      confidence: 8,
      order: 2,
      whyShort: "Risk-on sentiment reduces demand for safety.",
      whyLong:
        "As investors become more comfortable taking risk, demand for stable, low-volatility companies declines relative to growth and speculative assets.",
      stocks: ["PG","KO","PEP"],
      next: []
    }
  ]
},
{
  name: "Market Volatility",
  direction: "down",
  magnitude: 8,
  speed: "fast",
  confidence: 9,
  order: 1,
  whyShort: "Higher liquidity suppresses volatility.",
  whyLong:
    "Central bank liquidity tends to stabilize financial conditions, reduce uncertainty, and compress volatility across equity and credit markets.",
  stocks: ["VIRT","CBOE","MKTX"],
  next: [
    {
      name: "Volatility Trading Demand",
      direction: "down",
      magnitude: 7,
      speed: "fast",
      confidence: 8,
      order: 2,
      whyShort: "Lower volatility reduces demand for hedging.",
      whyLong:
        "When markets are stable and liquidity is abundant, demand for volatility hedging and trading activity typically declines.",
      stocks: ["CBOE","VIRT"],
      next: []
    }
  ]
},

    {
      name: "Private Equity Activity",
      direction: "up",
      magnitude: 7,
      speed: "delayed",
      confidence: 8,
      order: 1,
      whyShort: "Abundant liquidity supports dealmaking and financing.",
      whyLong:
        "Private equity firms benefit when liquidity is plentiful because debt financing becomes more available and asset prices are supported across private and public markets.",
      stocks: ["BX","KKR","APO"],
      next: [
        {
          name: "Mergers and Acquisitions",
          direction: "up",
          magnitude: 7,
          speed: "delayed",
          confidence: 8,
          order: 2,
          whyShort: "Easier financing supports acquisition activity.",
          whyLong:
            "When capital is cheap and liquidity is abundant, M&A activity often rises because buyers can finance transactions more easily.",
          stocks: [],
          next: []
        }
      ]
    },

    {
      name: "Emerging Markets",
      direction: "up",
      magnitude: 7,
      speed: "fast",
      confidence: 8,
      order: 1,
      whyShort: "Global liquidity expansion supports international risk assets.",
      whyLong:
        "Emerging markets often benefit when major central banks add liquidity, as capital flows outward into higher-beta global assets and risk appetite improves.",
      stocks: ["BABA","TSM","PDD","VALE","MELI"],
      next: [
        {
          name: "Global Risk Assets",
          direction: "up",
          magnitude: 7,
          speed: "fast",
          confidence: 8,
          order: 2,
          whyShort: "More liquidity lifts higher-beta global assets.",
          whyLong:
            "When central bank liquidity expands, investors often increase exposure to international and emerging-market risk assets.",
          stocks: [],
          next: []
        }
      ]
    },

    {
      name: "Commodity Demand",
      direction: "up",
      magnitude: 7,
      speed: "delayed",
      confidence: 7,
      order: 1,
      whyShort: "Liquidity expansion can support cyclical demand and reflation trades.",
      whyLong:
        "Greater central bank liquidity can support economic activity expectations, reflation trades, and demand for industrial commodities and resource-linked equities.",
      stocks: ["FCX","BHP","RIO","SCCO"],
      next: [
        {
          name: "Industrial Metals",
          direction: "up",
          magnitude: 7,
          speed: "delayed",
          confidence: 7,
          order: 2,
          whyShort: "Improved growth expectations support metals demand.",
          whyLong:
            "Industrial metals often benefit when liquidity expansion improves expectations for manufacturing, construction, and global growth.",
          stocks: ["FCX","SCCO","RIO"],
          next: []
        }
      ]
    }

  ],

down: [

  {
    name: "Equity Markets",
    direction: "down",
    magnitude: 9,
    speed: "fast",
    confidence: 9,
    order: 1,
    whyShort: "Lower central bank liquidity pressures equity valuations.",
    whyLong:
      "When central bank liquidity is withdrawn, financial conditions tighten and capital becomes less supportive for equities, which typically pressures broad market valuations and reduces risk-taking.",
    stocks: ["AAPL","MSFT","NVDA","AMZN","META"],
    next: [
      {
        name: "Risk Appetite",
        direction: "down",
        magnitude: 9,
        speed: "fast",
        confidence: 9,
        order: 2,
        whyShort: "Tighter liquidity reduces investor willingness to own risk.",
        whyLong:
          "As liquidity falls, investors tend to move up the quality spectrum and reduce exposure to higher-beta and more speculative assets.",
        stocks: [],
        next: [
          {
            name: "Speculative Assets",
            direction: "down",
            magnitude: 8,
            speed: "fast",
            confidence: 8,
            order: 3,
            whyShort: "Speculative assets are hit hardest when liquidity contracts.",
            whyLong:
              "High-beta and sentiment-driven equities tend to underperform when liquidity tightens and markets become less tolerant of valuation risk.",
            stocks: ["TSLA","PLTR","RBLX","COIN","SOFI"],
            next: []
          }
        ]
      }
    ]
  },

  {
    name: "Tech Stocks",
    direction: "down",
    magnitude: 9,
    speed: "fast",
    confidence: 9,
    order: 1,
    whyShort: "Lower liquidity pressures long-duration growth equities.",
    whyLong:
      "Large-cap technology and growth stocks tend to be sensitive to financial conditions, so tighter liquidity and less supportive markets often pressure their valuation multiples.",
    stocks: ["AAPL","MSFT","NVDA","GOOGL","META"],
    next: [
      {
        name: "Growth Stock Valuations",
        direction: "down",
        magnitude: 9,
        speed: "fast",
        confidence: 9,
        order: 2,
        whyShort: "Tighter liquidity compresses high-growth multiples.",
        whyLong:
          "Growth stocks often depend on abundant liquidity and supportive valuation conditions, so tightening tends to weigh heavily on high-multiple names.",
        stocks: ["TSLA","PLTR","RBLX","COIN","SNOW"],
        next: [
          {
            name: "Venture Capital Funding",
            direction: "down",
            magnitude: 7,
            speed: "delayed",
            confidence: 7,
            order: 3,
            whyShort: "Private-market funding weakens as liquidity contracts.",
            whyLong:
              "When public-market conditions worsen and liquidity becomes scarcer, venture funding usually slows as investors become more selective and risk-averse.",
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
    magnitude: 8,
    speed: "fast",
    confidence: 8,
    order: 1,
    whyShort: "Lower liquidity reduces demand for crypto and speculative assets.",
    whyLong:
      "Crypto assets and crypto-linked equities often weaken when central bank liquidity contracts because tighter monetary conditions reduce speculative demand and risk tolerance.",
    stocks: ["COIN","MSTR","HOOD"],
    next: [
      {
        name: "Crypto Trading Volume",
        direction: "down",
        magnitude: 8,
        speed: "fast",
        confidence: 8,
        order: 2,
        whyShort: "Weaker sentiment reduces crypto trading activity.",
        whyLong:
          "As liquidity tightens and speculative appetite fades, trading activity across digital asset platforms typically declines.",
        stocks: ["COIN","HOOD"],
        next: [
          {
            name: "Blockchain Activity",
            direction: "down",
            magnitude: 7,
            speed: "delayed",
            confidence: 7,
            order: 3,
            whyShort: "Weaker trading and prices reduce ecosystem activity.",
            whyLong:
              "Softer crypto market conditions often lead to lower participation, weaker network usage, and reduced activity across the broader blockchain ecosystem.",
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
    magnitude: 8,
    speed: "fast",
    confidence: 9,
    order: 1,
    whyShort: "Lower liquidity tightens credit conditions and weakens financing.",
    whyLong:
      "When central bank liquidity is withdrawn, credit spreads can widen and financing becomes less available, which pressures leveraged and lower-quality borrowers.",
    stocks: [],
    next: [
      {
        name: "High Yield Bonds",
        direction: "down",
        magnitude: 8,
        speed: "fast",
        confidence: 8,
        order: 2,
        whyShort: "Riskier borrowers are hit harder when liquidity fades.",
        whyLong:
          "Lower-quality issuers tend to suffer more when credit markets weaken because refinancing risk rises and access to capital becomes less reliable.",
        stocks: ["F","CCL","UAL","NCLH","RCL"],
        next: [
          {
            name: "Corporate Borrowing",
            direction: "down",
            magnitude: 8,
            speed: "delayed",
            confidence: 8,
            order: 3,
            whyShort: "Tighter conditions reduce borrowing activity.",
            whyLong:
              "When liquidity becomes less supportive, companies often reduce debt issuance and borrowing activity because funding becomes more expensive and less available.",
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
    magnitude: 8,
    speed: "delayed",
    confidence: 8,
    order: 1,
    whyShort: "Tighter liquidity can weaken mortgage and financing conditions.",
    whyLong:
      "As central bank liquidity contracts, financial conditions often tighten enough to reduce affordability and weaken demand across housing markets.",
    stocks: [],
    next: [
      {
        name: "Homebuilders",
        direction: "down",
        magnitude: 8,
        speed: "delayed",
        confidence: 8,
        order: 2,
        whyShort: "Weaker financing pressures new-home demand.",
        whyLong:
          "Homebuilders tend to face softer orders and weaker demand when mortgage conditions worsen and housing affordability becomes more constrained.",
        stocks: ["DHI","LEN","PHM","TOL","KBH"],
        next: []
      }
    ]
  },

  {
    name: "Small Cap Stocks",
    direction: "down",
    magnitude: 8,
    speed: "fast",
    confidence: 8,
    order: 1,
    whyShort: "Small caps are more exposed to tighter liquidity and financing conditions.",
    whyLong:
      "Smaller companies are generally more sensitive to financial conditions, so shrinking central bank liquidity often pressures small-cap performance through weaker risk appetite and harder financing conditions.",
    stocks: ["IOT","APP","RKLB","SOFI","AFRM"],
    next: [
      {
        name: "Regional Banks",
        direction: "down",
        magnitude: 7,
        speed: "delayed",
        confidence: 8,
        order: 2,
        whyShort: "Tighter liquidity weakens local banking conditions.",
        whyLong:
          "Regional banks can struggle when liquidity contracts because funding becomes less supportive and local credit conditions tighten.",
        stocks: ["PNC","TFC","RF","FITB","HBAN"],
        next: []
      }
    ]
  },

  {
    name: "Private Equity Activity",
    direction: "down",
    magnitude: 7,
    speed: "delayed",
    confidence: 8,
    order: 1,
    whyShort: "Lower liquidity reduces deal financing and transaction activity.",
    whyLong:
      "Private equity firms tend to face a weaker deal environment when liquidity contracts because debt financing becomes less abundant and asset valuations become less supportive.",
    stocks: ["BX","KKR","APO"],
    next: [
      {
        name: "Mergers and Acquisitions",
        direction: "down",
        magnitude: 7,
        speed: "delayed",
        confidence: 8,
        order: 2,
        whyShort: "Tighter financing reduces acquisition activity.",
        whyLong:
          "When capital is less available and funding costs rise, M&A activity often slows as buyers become more selective and financing becomes harder to obtain.",
        stocks: [],
        next: []
      }
    ]
  },

  {
    name: "Emerging Markets",
    direction: "down",
    magnitude: 7,
    speed: "fast",
    confidence: 8,
    order: 1,
    whyShort: "Lower global liquidity pressures higher-beta international assets.",
    whyLong:
      "Emerging markets often weaken when major central banks withdraw liquidity because capital tends to flow back toward safer assets and away from higher-risk global markets.",
    stocks: ["BABA","TSM","PDD","VALE","MELI"],
    next: [
      {
        name: "Global Risk Assets",
        direction: "down",
        magnitude: 7,
        speed: "fast",
        confidence: 8,
        order: 2,
        whyShort: "Tighter liquidity reduces demand for global risk assets.",
        whyLong:
          "When liquidity contracts, investors often reduce exposure to international and emerging-market assets as part of a broader risk reduction process.",
        stocks: [],
        next: []
      }
    ]
  },
  {
  name: "Large Banks",
  direction: "up",
  magnitude: 7,
  speed: "delayed",
  confidence: 8,
  order: 1,
  whyShort: "Higher rates can improve bank net interest margins.",
  whyLong:
    "When liquidity is withdrawn and rates rise, large banks can benefit from higher net interest margins as loan yields adjust faster than deposit costs.",
  stocks: ["JPM","BAC","WFC","USB","MS"],
  next: [
    {
      name: "Net Interest Margins",
      direction: "up",
      magnitude: 8,
      speed: "delayed",
      confidence: 8,
      order: 2,
      whyShort: "Higher rates expand lending spreads.",
      whyLong:
        "Banks can earn a wider spread between what they pay on deposits and what they earn on loans when rates rise in a tightening environment.",
      stocks: ["JPM","BAC","WFC","USB"],
      next: []
    }
  ]
},
{
  name: "Cash Yield Assets",
  direction: "up",
  magnitude: 7,
  speed: "fast",
  confidence: 9,
  order: 1,
  whyShort: "Higher rates increase returns on cash and short-duration assets.",
  whyLong:
    "As central bank liquidity declines and rates rise, investors earn higher yields on cash, money market funds, and short-duration instruments, attracting flows.",
  stocks: ["SCHW","BLK","MS","GS"],
  next: [
    {
      name: "Money Market Flows",
      direction: "up",
      magnitude: 8,
      speed: "fast",
      confidence: 9,
      order: 2,
      whyShort: "Investors shift toward higher-yielding safe assets.",
      whyLong:
        "Higher short-term yields drive capital into money market funds and cash-like instruments as investors prioritize safety and yield.",
      stocks: ["SCHW","BLK","MS"],
      next: []
    }
  ]
},
{
  name: "Consumer Staples",
  direction: "up",
  magnitude: 6,
  speed: "fast",
  confidence: 8,
  order: 1,
  whyShort: "Investors rotate into defensive sectors during tightening.",
  whyLong:
    "When liquidity tightens and risk assets weaken, investors often rotate into defensive sectors like consumer staples that offer stable earnings and lower volatility.",
  stocks: ["PG","KO","PEP","WMT","COST"],
  next: [
    {
      name: "Defensive Positioning",
      direction: "up",
      magnitude: 6,
      speed: "fast",
      confidence: 8,
      order: 2,
      whyShort: "Risk-off sentiment favors stable companies.",
      whyLong:
        "Stable, cash-generating companies tend to outperform in tightening environments as investors reduce exposure to cyclical and high-beta assets.",
      stocks: ["PG","KO","PEP"],
      next: []
    }
  ]
},

  {
    name: "Commodity Demand",
    direction: "down",
    magnitude: 7,
    speed: "delayed",
    confidence: 7,
    order: 1,
    whyShort: "Lower liquidity weakens cyclical demand and reflation trades.",
    whyLong:
      "When central bank liquidity contracts, economic expectations and reflation trades can soften, which often pressures industrial commodities and resource-linked equities.",
    stocks: ["FCX","BHP","RIO","SCCO"],
    next: [
      {
        name: "Industrial Metals",
        direction: "down",
        magnitude: 7,
        speed: "delayed",
        confidence: 7,
        order: 2,
        whyShort: "Softer growth expectations reduce metals demand.",
        whyLong:
          "Industrial metals often weaken when tighter liquidity reduces expectations for manufacturing, construction, and global growth.",
        stocks: ["FCX","SCCO","RIO"],
        next: []
      }
    ]
  }

]
},

"Credit Conditions (Difficulty of Borrowing)": {

  down: [

    {
      name: "Corporate Borrowing",
      direction: "up",
      magnitude: 8,
      speed: "fast",
      confidence: 9,
      order: 1,
      whyShort: "Easier credit conditions improve access to financing.",
      whyLong:
        "When credit conditions ease, companies can borrow more easily and at lower cost, which supports refinancing, expansion, and new investment activity.",
      stocks: [],
      next: [
        {
          name: "Corporate Investment",
          direction: "up",
          magnitude: 8,
          speed: "delayed",
          confidence: 8,
          order: 2,
          whyShort: "Cheaper financing supports business investment.",
          whyLong:
            "As borrowing becomes easier and financing costs decline, companies are more likely to increase capital expenditure, expansion projects, and equipment spending.",
          stocks: [],
          next: [
            {
              name: "Economic Growth",
              direction: "up",
              magnitude: 8,
              speed: "delayed",
              confidence: 8,
              order: 3,
              whyShort: "Higher investment supports cyclical growth.",
              whyLong:
                "Improved corporate investment tends to support industrial activity, transportation demand, and broader economic growth across cyclical sectors.",
              stocks: ["CAT","DE","HON","ETN","PCAR"],
              next: []
            }
          ]
        }
      ]
    },

    {
      name: "Business Expansion",
      direction: "up",
      magnitude: 7,
      speed: "delayed",
      confidence: 8,
      order: 1,
      whyShort: "Easier credit supports expansion plans.",
      whyLong:
        "When credit conditions improve, businesses have more flexibility to expand operations, open locations, purchase equipment, and pursue growth initiatives.",
      stocks: [],
      next: [
        {
          name: "Hiring Activity",
          direction: "up",
          magnitude: 7,
          speed: "delayed",
          confidence: 8,
          order: 2,
          whyShort: "Expansion plans increase labor demand.",
          whyLong:
            "As companies expand and invest more aggressively, hiring activity tends to improve across cyclical and industrial sectors.",
          stocks: [],
          next: [
            {
              name: "Labor Market Strength",
              direction: "up",
              magnitude: 7,
              speed: "delayed",
              confidence: 7,
              order: 3,
              whyShort: "Stronger hiring supports labor market conditions.",
              whyLong:
                "Improved business expansion and hiring demand usually lead to stronger labor market conditions, especially in industrial and economically sensitive sectors.",
              stocks: ["CAT","DE","HON","ITW","PH"],
              next: []
            }
          ]
        }
      ]
    },

    {
      name: "Bank Lending",
      direction: "up",
      magnitude: 8,
      speed: "fast",
      confidence: 9,
      order: 1,
      whyShort: "Easier credit conditions support loan growth.",
      whyLong:
        "When credit conditions loosen, banks are generally more willing to lend and borrowers are more willing to take on financing, supporting overall lending activity.",
      stocks: ["JPM","BAC","WFC","USB"],
      next: [
        {
          name: "Regional Banks",
          direction: "up",
          magnitude: 8,
          speed: "fast",
          confidence: 8,
          order: 2,
          whyShort: "Improved credit conditions support regional bank activity.",
          whyLong:
            "Regional banks often benefit when lending conditions improve because local commercial and consumer loan growth tends to accelerate.",
          stocks: ["PNC","TFC","RF","FITB","HBAN"],
          next: []
        }
      ]
    },

    {
      name: "Home Buying",
      direction: "up",
      magnitude: 8,
      speed: "delayed",
      confidence: 8,
      order: 1,
      whyShort: "Easier credit improves mortgage accessibility.",
      whyLong:
        "As credit conditions improve, mortgage availability and borrower confidence tend to rise, supporting home buying activity.",
      stocks: [],
      next: [
        {
          name: "Housing Demand",
          direction: "up",
          magnitude: 8,
          speed: "delayed",
          confidence: 8,
          order: 2,
          whyShort: "Improved financing supports housing demand.",
          whyLong:
            "Easier access to credit can support housing demand by making mortgages more available and financing conditions more favorable.",
          stocks: [],
          next: [
            {
              name: "Homebuilders",
              direction: "up",
              magnitude: 8,
              speed: "delayed",
              confidence: 8,
              order: 3,
              whyShort: "Better mortgage conditions support new-home demand.",
              whyLong:
                "Homebuilders typically benefit when financing conditions improve and more buyers can qualify for home purchases.",
              stocks: ["DHI","LEN","PHM","TOL","KBH"],
              next: []
            }
          ]
        }
      ]
    },

    {
      name: "Consumer Credit",
      direction: "up",
      magnitude: 8,
      speed: "fast",
      confidence: 8,
      order: 1,
      whyShort: "Easier credit supports consumer borrowing.",
      whyLong:
        "When credit conditions loosen, consumers gain greater access to credit cards and financing products, which can support spending activity.",
      stocks: ["AXP","DFS","SYF","COF"],
      next: [
        {
          name: "Retail Spending",
          direction: "up",
          magnitude: 7,
          speed: "fast",
          confidence: 8,
          order: 2,
          whyShort: "More available credit supports purchases.",
          whyLong:
            "Greater consumer credit availability tends to support retail spending, especially in discretionary and financed purchases.",
          stocks: ["WMT","TGT","COST","AMZN"],
          next: []
        }
      ]
    },

    {
      name: "Auto Loans",
      direction: "up",
      magnitude: 7,
      speed: "fast",
      confidence: 8,
      order: 1,
      whyShort: "Easier financing supports vehicle affordability.",
      whyLong:
        "Looser credit conditions help support auto financing availability, which can improve affordability and support vehicle purchases.",
      stocks: ["ALLY","COF"],
      next: [
        {
          name: "Auto Sales",
          direction: "up",
          magnitude: 7,
          speed: "fast",
          confidence: 8,
          order: 2,
          whyShort: "Better financing supports vehicle demand.",
          whyLong:
            "As auto loan conditions improve, consumers are more likely to finance vehicle purchases, supporting sales across the auto sector.",
          stocks: ["GM","F","TSLA"],
          next: []
        }
      ]
    },

    {
      name: "Commercial Real Estate Lending",
      direction: "up",
      magnitude: 7,
      speed: "delayed",
      confidence: 7,
      order: 1,
      whyShort: "Easier credit supports CRE financing activity.",
      whyLong:
        "When credit conditions loosen, commercial real estate borrowers generally have better access to financing for acquisitions, redevelopment, and new projects.",
      stocks: [],
      next: [
        {
          name: "Real Estate Development",
          direction: "up",
          magnitude: 7,
          speed: "delayed",
          confidence: 7,
          order: 2,
          whyShort: "Better financing supports property development and transactions.",
          whyLong:
            "Improved CRE lending conditions can support development activity, transactions, and property market recovery, especially in more capital-intensive segments.",
          stocks: ["CBRE","JLL","SPG","VNO","BXP"],
          next: []
        }
      ]
    },

    {
      name: "Private Equity Activity",
      direction: "up",
      magnitude: 7,
      speed: "delayed",
      confidence: 8,
      order: 1,
      whyShort: "Easier credit supports leveraged dealmaking.",
      whyLong:
        "Private equity activity generally benefits from looser credit conditions because debt financing becomes more available and acquisition financing becomes easier to structure.",
      stocks: ["BX","KKR","APO"],
      next: [
        {
          name: "Mergers and Acquisitions",
          direction: "up",
          magnitude: 7,
          speed: "delayed",
          confidence: 8,
          order: 2,
          whyShort: "Cheaper and more available financing supports M&A.",
          whyLong:
            "When debt markets are open and financing is easier to obtain, merger and acquisition activity often rises across both private and public markets.",
          stocks: [],
          next: []
        }
      ]
    },

    {
      name: "Credit Spreads",
      direction: "down",
      magnitude: 9,
      speed: "fast",
      confidence: 9,
      order: 1,
      whyShort: "Easier credit conditions narrow spreads.",
      whyLong:
        "As credit conditions improve, investors demand less compensation for credit risk, which tends to narrow corporate and high-yield credit spreads.",
      stocks: [],
      next: [
        {
          name: "High Yield Bonds",
          direction: "up",
          magnitude: 8,
          speed: "fast",
          confidence: 8,
          order: 2,
          whyShort: "Narrower spreads support riskier credit.",
          whyLong:
            "High-yield borrowers tend to benefit when credit spreads compress because financing becomes more accessible and refinancing risk declines.",
          stocks: ["F","CCL","UAL","NCLH","RCL"],
          next: []
        }
      ]
    }

  ],

up: [

  {
    name: "Corporate Borrowing",
    direction: "down",
    magnitude: 8,
    speed: "fast",
    confidence: 9,
    order: 1,
    whyShort: "Tighter credit conditions reduce access to financing.",
    whyLong:
      "When credit conditions tighten, companies face higher borrowing costs and reduced access to capital, which tends to slow refinancing activity and limit new borrowing.",
    stocks: [],
    next: [
      {
        name: "Corporate Investment",
        direction: "down",
        magnitude: 8,
        speed: "delayed",
        confidence: 8,
        order: 2,
        whyShort: "Less financing reduces business investment.",
        whyLong:
          "As financing becomes more restrictive, companies often reduce capital expenditure, expansion projects, and equipment purchases.",
        stocks: [],
        next: [
          {
            name: "Economic Growth",
            direction: "down",
            magnitude: 8,
            speed: "delayed",
            confidence: 8,
            order: 3,
            whyShort: "Lower investment pressures cyclical growth.",
            whyLong:
              "Reduced corporate investment tends to weaken industrial activity, transportation demand, and broader economic growth across cyclical sectors.",
            stocks: ["CAT","DE","HON","ETN","PCAR"],
            next: []
          }
        ]
      }
    ]
  },

  {
    name: "Business Expansion",
    direction: "down",
    magnitude: 7,
    speed: "delayed",
    confidence: 8,
    order: 1,
    whyShort: "Tighter credit reduces expansion plans.",
    whyLong:
      "When credit conditions worsen, businesses have less flexibility to expand operations, open locations, purchase equipment, or pursue new growth initiatives.",
    stocks: [],
    next: [
      {
        name: "Hiring Activity",
        direction: "down",
        magnitude: 7,
        speed: "delayed",
        confidence: 8,
        order: 2,
        whyShort: "Less expansion reduces labor demand.",
        whyLong:
          "As businesses slow growth plans and investment, hiring activity typically weakens across economically sensitive sectors.",
        stocks: [],
        next: [
          {
            name: "Labor Market Weakness",
            direction: "down",
            magnitude: 7,
            speed: "delayed",
            confidence: 7,
            order: 3,
            whyShort: "Weaker hiring pressures labor market conditions.",
            whyLong:
              "Reduced expansion and softer hiring demand usually weaken labor market conditions, especially in cyclical and industrial segments.",
            stocks: ["CAT","DE","HON","ITW","PH"],
            next: []
          }
        ]
      }
    ]
  },

  {
    name: "Bank Lending",
    direction: "down",
    magnitude: 8,
    speed: "fast",
    confidence: 9,
    order: 1,
    whyShort: "Tighter credit conditions restrict loan growth.",
    whyLong:
      "When credit conditions tighten, banks tend to become more selective and borrowers often face stricter lending standards, reducing overall lending activity.",
    stocks: ["JPM","BAC","WFC","USB"],
    next: [
      {
        name: "Regional Banks",
        direction: "down",
        magnitude: 8,
        speed: "fast",
        confidence: 8,
        order: 2,
        whyShort: "Regional banks are especially exposed to tighter lending conditions.",
        whyLong:
          "Regional banks often face more pressure when credit conditions worsen because local commercial and consumer lending activity tends to slow materially.",
        stocks: ["PNC","TFC","RF","FITB","HBAN"],
        next: []
      }
    ]
  },

  {
    name: "Home Buying",
    direction: "down",
    magnitude: 8,
    speed: "delayed",
    confidence: 8,
    order: 1,
    whyShort: "Tighter credit reduces mortgage accessibility.",
    whyLong:
      "As credit conditions tighten, mortgage availability and borrower confidence tend to weaken, reducing home buying activity.",
    stocks: [],
    next: [
      {
        name: "Housing Demand",
        direction: "down",
        magnitude: 8,
        speed: "delayed",
        confidence: 8,
        order: 2,
        whyShort: "Restrictive financing weakens housing demand.",
        whyLong:
          "Tighter access to credit can pressure housing demand by making mortgages harder to obtain and financing conditions less favorable.",
        stocks: [],
        next: [
          {
            name: "Homebuilders",
            direction: "down",
            magnitude: 8,
            speed: "delayed",
            confidence: 8,
            order: 3,
            whyShort: "Worse mortgage conditions pressure new-home demand.",
            whyLong:
              "Homebuilders typically face weaker orders when financing conditions deteriorate and fewer buyers can qualify for home purchases.",
            stocks: ["DHI","LEN","PHM","TOL","KBH"],
            next: []
          }
        ]
      }
    ]
  },

  {
    name: "Consumer Credit",
    direction: "down",
    magnitude: 8,
    speed: "fast",
    confidence: 8,
    order: 1,
    whyShort: "Tighter credit reduces consumer borrowing capacity.",
    whyLong:
      "When credit conditions tighten, consumers have less access to credit cards and financing products, which can pressure spending activity.",
    stocks: ["AXP","DFS","SYF","COF"],
    next: [
      {
        name: "Retail Spending",
        direction: "down",
        magnitude: 7,
        speed: "fast",
        confidence: 8,
        order: 2,
        whyShort: "Less available credit pressures purchases.",
        whyLong:
          "Reduced consumer credit availability tends to weigh on retail spending, especially in discretionary and financed purchases.",
        stocks: ["WMT","TGT","COST","AMZN"],
        next: []
      }
    ]
  },

  {
    name: "Auto Loans",
    direction: "down",
    magnitude: 7,
    speed: "fast",
    confidence: 8,
    order: 1,
    whyShort: "Tighter financing reduces vehicle affordability.",
    whyLong:
      "Restrictive credit conditions can reduce auto financing availability, worsening affordability and pressuring vehicle purchases.",
    stocks: ["ALLY","COF"],
    next: [
      {
        name: "Auto Sales",
        direction: "down",
        magnitude: 7,
        speed: "fast",
        confidence: 8,
        order: 2,
        whyShort: "Worse financing reduces vehicle demand.",
        whyLong:
          "As auto loan conditions worsen, consumers are less able or willing to finance vehicle purchases, reducing sales across the auto sector.",
        stocks: ["GM","F","TSLA"],
        next: []
      }
    ]
  },

  {
    name: "Commercial Real Estate Lending",
    direction: "down",
    magnitude: 7,
    speed: "delayed",
    confidence: 7,
    order: 1,
    whyShort: "Tighter credit reduces CRE financing activity.",
    whyLong:
      "When credit conditions tighten, commercial real estate borrowers generally have less access to financing for acquisitions, redevelopment, and new projects.",
    stocks: [],
    next: [
      {
        name: "Real Estate Development",
        direction: "down",
        magnitude: 7,
        speed: "delayed",
        confidence: 7,
        order: 2,
        whyShort: "Worse financing pressures development and transactions.",
        whyLong:
          "Restrictive CRE lending conditions can reduce development activity, transactions, and property market recovery, especially in more capital-intensive segments.",
        stocks: ["CBRE","JLL","SPG","VNO","BXP"],
        next: []
      }
    ]
  },

  {
    name: "Private Equity Activity",
    direction: "down",
    magnitude: 7,
    speed: "delayed",
    confidence: 8,
    order: 1,
    whyShort: "Tighter credit reduces leveraged dealmaking.",
    whyLong:
      "Private equity activity generally weakens when credit conditions tighten because debt financing becomes less available and acquisition financing is harder to structure.",
    stocks: ["BX","KKR","APO"],
    next: [
      {
        name: "Mergers and Acquisitions",
        direction: "down",
        magnitude: 7,
        speed: "delayed",
        confidence: 8,
        order: 2,
        whyShort: "Harder financing pressures M&A activity.",
        whyLong:
          "When debt markets are restrictive and financing is harder to obtain, merger and acquisition activity often slows across both private and public markets.",
        stocks: [],
        next: []
      }
    ]
  },

  {
    name: "Credit Spreads",
    direction: "up",
    magnitude: 9,
    speed: "fast",
    confidence: 9,
    order: 1,
    whyShort: "Tighter credit conditions widen spreads.",
    whyLong:
      "As credit conditions worsen, investors demand more compensation for credit risk, which tends to widen corporate and high-yield credit spreads.",
    stocks: [],
    next: [
      {
        name: "High Yield Bonds",
        direction: "down",
        magnitude: 8,
        speed: "fast",
        confidence: 8,
        order: 2,
        whyShort: "Wider spreads pressure riskier credit.",
        whyLong:
          "High-yield borrowers tend to struggle when credit spreads widen because financing becomes less accessible and refinancing risk rises.",
        stocks: ["F","CCL","UAL","NCLH","RCL"],
        next: []
      }
    ]
  }

]

}

};

export default dependencyTree;