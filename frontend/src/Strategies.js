import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "./lib/supabaseClient";

const API_BASE =
  process.env.NODE_ENV === "development"
    ? "http://localhost:8000"
    : process.env.REACT_APP_API_BASE;

const RANGES = ["1D", "5D", "1M", "6M", "1Y", "5Y"];

const BENCHMARK_CHART_CACHE = {};
const BENCHMARK_CACHE_TTL_MS = 1000 * 60 * 15;

const DEFAULT_ACTIVE_STRATEGIES = [
  {
    id: "starter-active-energy",
    name: "Energy Long",
    positions: [
      { ticker: "XLE", weight: 50 },
      { ticker: "CVX", weight: 25 },
      { ticker: "COP", weight: 25 },
    ],
  },
  {
    id: "starter-active-tech",
    name: "Mega Cap Tech",
    positions: [
      { ticker: "AAPL", weight: 25 },
      { ticker: "MSFT", weight: 25 },
      { ticker: "NVDA", weight: 25 },
      { ticker: "GOOGL", weight: 25 },
    ],
  },
  {
    id: "starter-active-defense",
    name: "Defense Basket",
    positions: [
      { ticker: "LMT", weight: 35 },
      { ticker: "RTX", weight: 35 },
      { ticker: "NOC", weight: 30 },
    ],
  },
];

const DEFAULT_STRATEGY_BANK = [
  {
    name: "Oil Bull Hedge",
    positions: [
      { ticker: "XLE", weight: 60 },
      { ticker: "USO", weight: 30 },
      { ticker: "DAL", weight: -15 },
      { ticker: "UAL", weight: -15 },
    ],
  },
  {
    name: "AI Momentum",
    positions: [
      { ticker: "NVDA", weight: 40 },
      { ticker: "AMD", weight: 25 },
      { ticker: "MSFT", weight: 20 },
      { ticker: "SMH", weight: 15 },
    ],
  },
  {
    name: "Gold Safety",
    positions: [
      { ticker: "GLD", weight: 55 },
      { ticker: "TLT", weight: 30 },
      { ticker: "SPY", weight: -15 },
    ],
  },
  {
    name: "Rate Cut Play",
    positions: [
      { ticker: "QQQ", weight: 45 },
      { ticker: "XHB", weight: 30 },
      { ticker: "TLT", weight: 25 },
    ],
  },
];

const STRESS_TESTS = [
  {
    id: "oil_spike",
    label: "Oil Spike",
    description:
      "Oil prices jump. Energy, oil services, and producers benefit while airlines, transport, and consumers get hit.",
    dependencyDriver: "Oil Prices",
    defaultShock: -2,
    shocks: {
      // Oil / energy ETFs
      USO: 20,
      BNO: 18,
      UCO: 35,
      SCO: -35,
      XLE: 12,
      VDE: 12,
      IYE: 11,
      OIH: 14,
      XOP: 15,
      AMLP: 8,
      MLPX: 7,

      // Integrated oil majors
      XOM: 10,
      CVX: 10,
      SHEL: 9,
      BP: 9,
      TTE: 9,
      EQNR: 9,

      // E&P / producers
      COP: 10,
      OXY: 12,
      EOG: 11,
      PXD: 11,
      DVN: 12,
      FANG: 12,
      MRO: 12,
      APA: 11,
      HES: 10,
      CTRA: 8,
      CHK: 8,
      EQT: 7,
      AR: 7,
      RRC: 7,
      SM: 10,
      MTDR: 10,
      PR: 10,
      VNOM: 9,

      // Oil services / equipment
      SLB: 12,
      HAL: 12,
      BKR: 10,
      NOV: 10,
      LBRT: 10,
      PTEN: 10,
      HP: 10,
      NBR: 9,
      RES: 8,
      OII: 8,
      FTI: 8,
      DRQ: 8,

      // Refiners
      VLO: 7,
      MPC: 7,
      PSX: 6,
      DK: 6,
      PBF: 7,
      DINO: 6,

      // Airlines / travel hurt by fuel costs
      DAL: -9,
      UAL: -9,
      AAL: -10,
      LUV: -7,
      JBLU: -8,
      ALK: -7,
      SAVE: -10,
      JETS: -9,
      CPA: -6,
      RYAAY: -5,
      LTM: -5,

      // Transportation / shipping / logistics
      IYT: -5,
      FDX: -5,
      UPS: -5,
      XPO: -5,
      JBHT: -5,
      CHRW: -4,
      ODFL: -4,
      SAIA: -4,
      KNX: -4,
      WERN: -4,
      HTLD: -4,
      MRTN: -4,
      SNDR: -4,
      ARCB: -4,
      HUBG: -4,

      // Consumer discretionary hurt by fuel/inflation pressure
      XLY: -4,
      AMZN: -3,
      TSLA: -5,
      HD: -4,
      LOW: -4,
      NKE: -4,
      SBUX: -3,
      MCD: -2,
      BKNG: -3,
      ABNB: -3,
      MAR: -3,
      HLT: -3,
      RCL: -4,
      CCL: -5,
      NCLH: -5,

      // Staples sometimes hold up better
      XLP: 1,
      WMT: 1,
      COST: 1,
      DG: 1,
      DLTR: 1,
    },
  },

  {
    id: "market_crash",
    label: "Market Crash",
    description:
      "Broad risk-off selloff. High beta, crypto, semis, small caps, banks, and cyclicals get hit hardest.",
    dependencyDriver: "Geopolitical Risk / Credit Conditions",
    defaultShock: -20,
    shocks: {
      // Broad market
      SPY: -20,
      VOO: -20,
      IVV: -20,
      VTI: -21,
      QQQ: -25,
      QQQM: -25,
      DIA: -18,
      IWM: -28,
      IJR: -26,
      MDY: -24,
      RSP: -22,

      // Defensive / hedges
      TLT: 8,
      IEF: 5,
      SHY: 2,
      BND: 4,
      AGG: 4,
      GLD: 6,
      IAU: 6,
      SGOL: 6,
      PHYS: 6,
      VIXY: 45,
      VXX: 45,
      UVXY: 70,
      SH: 20,
      PSQ: 25,
      SQQQ: 60,
      SPXU: 55,
      SDS: 40,
      TZA: 70,

      // Mega-cap tech
      AAPL: -22,
      MSFT: -22,
      NVDA: -32,
      AMZN: -26,
      GOOGL: -24,
      GOOG: -24,
      META: -28,
      TSLA: -35,
      NFLX: -25,

      // Semis / high beta tech
      SMH: -30,
      SOXX: -30,
      SOXL: -60,
      SOXS: 60,
      AMD: -34,
      AVGO: -28,
      TSM: -25,
      ASML: -28,
      AMAT: -28,
      LRCX: -28,
      KLAC: -26,
      MU: -32,
      INTC: -25,
      QCOM: -25,
      MRVL: -30,
      ON: -30,
      NXPI: -27,
      MPWR: -30,
      MCHP: -28,
      SWKS: -28,

      // Crypto-linked
      COIN: -40,
      MSTR: -42,
      MARA: -45,
      RIOT: -45,
      CLSK: -45,
      HUT: -42,
      BITF: -42,
      BTDR: -42,
      CORZ: -42,
      WULF: -42,
      CIFR: -42,
      IREN: -42,
      IBIT: -25,
      GBTC: -25,
      BITO: -25,

      // Banks / credit-sensitive
      XLF: -24,
      KRE: -35,
      KBE: -32,
      JPM: -22,
      BAC: -26,
      WFC: -25,
      C: -25,
      GS: -24,
      MS: -24,
      SCHW: -28,
      WAL: -35,
      ZION: -34,
      KEY: -34,
      CMA: -32,
      RF: -32,
      TFC: -30,
      CFG: -32,
      FITB: -30,
      MTB: -28,
      HBAN: -30,

      // Cyclicals / discretionary
      XLY: -28,
      XLI: -23,
      XLB: -22,
      XRT: -30,
      HD: -24,
      LOW: -24,
      NKE: -28,
      SBUX: -25,
      TGT: -28,
      BBY: -30,
      GM: -32,
      F: -32,
      RIVN: -40,
      LCID: -42,
      RCL: -35,
      CCL: -38,
      NCLH: -38,

      // Defensive sectors
      XLP: -8,
      XLU: -9,
      XLV: -10,
      WMT: -6,
      COST: -6,
      PG: -5,
      KO: -5,
      PEP: -5,
      JNJ: -7,
      MRK: -7,
      UNH: -8,
      LLY: -8,
      NEE: -9,
      DUK: -8,
      SO: -8,
    },
  },

  {
    id: "rates_fall",
    label: "Rates Fall",
    description:
      "Interest rates drop. Bonds, growth stocks, housing, REITs, and long-duration assets benefit.",
    dependencyDriver: "Interest Rates / Bond Yields",
    defaultShock: 2,
    shocks: {
      // Bonds
      TLT: 13,
      EDV: 16,
      ZROZ: 18,
      IEF: 7,
      SHY: 2,
      GOVT: 5,
      BND: 5,
      AGG: 5,
      LQD: 6,
      HYG: 4,
      TBT: -22,
      TMV: -35,
      TMF: 35,

      // Growth / tech
      QQQ: 8,
      QQQM: 8,
      XLK: 7,
      VGT: 7,
      ARKK: 12,
      ARKW: 11,
      ARKG: 10,
      IGV: 9,
      CLOU: 9,
      WCLD: 9,
      AAPL: 5,
      MSFT: 5,
      NVDA: 9,
      AMD: 9,
      GOOGL: 5,
      GOOG: 5,
      META: 6,
      AMZN: 6,
      TSLA: 10,
      CRM: 7,
      NOW: 8,
      SNOW: 10,
      DDOG: 10,
      NET: 10,
      MDB: 10,
      CRWD: 9,
      ZS: 9,
      PLTR: 10,

      // Semis
      SMH: 8,
      SOXX: 8,
      SOXL: 18,
      AMD: 9,
      NVDA: 9,
      AVGO: 7,
      MRVL: 8,
      MU: 8,
      ON: 8,
      ASML: 7,
      AMAT: 7,
      LRCX: 7,
      KLAC: 7,

      // Housing / homebuilders
      XHB: 10,
      ITB: 10,
      DHI: 10,
      LEN: 10,
      PHM: 10,
      TOL: 10,
      KBH: 9,
      MDC: 9,
      MTH: 9,
      TMHC: 9,
      NVR: 8,
      LGIH: 8,
      CCS: 8,
      BZH: 8,

      // REITs
      VNQ: 8,
      XLRE: 8,
      IYR: 8,
      SCHH: 8,
      O: 8,
      AMT: 8,
      CCI: 8,
      PLD: 7,
      EQIX: 7,
      DLR: 8,
      SPG: 7,
      VICI: 6,
      PSA: 6,
      EXR: 6,
      AVB: 7,
      EQR: 7,

      // Banks may get hurt by falling yields / spread pressure
      KRE: -5,
      KBE: -4,
      XLF: -2,
      JPM: -2,
      BAC: -3,
      WFC: -3,
      SCHW: -4,
    },
  },

  {
    id: "rates_spike",
    label: "Rates Spike",
    description:
      "Interest rates rise sharply. Bonds, REITs, housing, growth stocks, and high-duration tech weaken.",
    dependencyDriver: "Interest Rates / Bond Yields",
    defaultShock: -4,
    shocks: {
      // Bonds
      TLT: -13,
      EDV: -16,
      ZROZ: -18,
      IEF: -7,
      SHY: -2,
      GOVT: -5,
      BND: -5,
      AGG: -5,
      LQD: -7,
      HYG: -5,
      TBT: 22,
      TMV: 35,
      TMF: -35,

      // Growth / high duration
      QQQ: -9,
      QQQM: -9,
      XLK: -8,
      VGT: -8,
      ARKK: -15,
      ARKW: -14,
      ARKG: -13,
      IGV: -11,
      CLOU: -12,
      WCLD: -12,
      AAPL: -6,
      MSFT: -6,
      NVDA: -11,
      AMD: -11,
      GOOGL: -7,
      GOOG: -7,
      META: -8,
      AMZN: -8,
      TSLA: -14,
      CRM: -9,
      NOW: -10,
      SNOW: -13,
      DDOG: -13,
      NET: -13,
      MDB: -13,
      CRWD: -11,
      ZS: -11,
      PLTR: -12,

      // Semis
      SMH: -10,
      SOXX: -10,
      SOXL: -25,
      AMD: -11,
      NVDA: -11,
      AVGO: -8,
      MRVL: -10,
      MU: -10,
      ON: -10,
      ASML: -9,
      AMAT: -9,
      LRCX: -9,
      KLAC: -8,

      // Housing / homebuilders hurt by mortgage rates
      XHB: -12,
      ITB: -12,
      DHI: -12,
      LEN: -12,
      PHM: -12,
      TOL: -12,
      KBH: -11,
      MTH: -11,
      TMHC: -11,
      NVR: -10,
      LGIH: -10,
      BZH: -10,

      // REITs
      VNQ: -10,
      XLRE: -10,
      IYR: -10,
      SCHH: -10,
      O: -10,
      AMT: -10,
      CCI: -10,
      PLD: -8,
      EQIX: -8,
      DLR: -9,
      SPG: -8,
      VICI: -7,
      PSA: -7,
      EXR: -7,
      AVB: -8,
      EQR: -8,

      // Banks can initially benefit from higher rates, but regionals less clean
      XLF: 3,
      JPM: 4,
      BAC: 4,
      WFC: 4,
      GS: 3,
      MS: 3,
      KRE: 1,
      KBE: 1,

      // Dollar often strengthens with higher US rates
      UUP: 5,
      GLD: -6,
      IAU: -6,
      SLV: -7,
      GDX: -8,
    },
  },

  {
    id: "inflation_spike",
    label: "Inflation Spike",
    description:
      "Inflation re-accelerates. Commodities, energy, and hard assets benefit while bonds, growth, and consumers weaken.",
    dependencyDriver: "Inflation",
    defaultShock: -4,
    shocks: {
      // Energy / commodities
      USO: 12,
      BNO: 10,
      XLE: 9,
      XOP: 10,
      OIH: 10,
      XOM: 8,
      CVX: 8,
      COP: 8,
      OXY: 9,
      EOG: 8,
      DVN: 8,
      FANG: 8,
      SLB: 9,
      HAL: 9,
      BKR: 8,

      // Metals / miners
      GLD: 8,
      IAU: 8,
      SGOL: 8,
      PHYS: 8,
      SLV: 10,
      PSLV: 10,
      GDX: 12,
      GDXJ: 14,
      NEM: 11,
      AEM: 11,
      GOLD: 11,
      KGC: 12,
      AU: 12,
      AG: 13,
      PAAS: 13,
      HL: 13,

      // Materials / agriculture
      XLB: 5,
      FCX: 8,
      SCCO: 8,
      TECK: 7,
      NUE: 5,
      STLD: 5,
      CLF: 6,
      MOS: 8,
      CF: 8,
      NTR: 7,
      ADM: 5,
      BG: 5,
      DE: 4,
      MOO: 5,

      // Bonds hurt
      TLT: -13,
      EDV: -16,
      IEF: -8,
      SHY: -2,
      BND: -6,
      AGG: -6,
      LQD: -8,
      HYG: -5,

      // Growth stocks hurt
      QQQ: -9,
      XLK: -8,
      ARKK: -14,
      SMH: -10,
      NVDA: -11,
      AMD: -11,
      TSLA: -13,
      AMZN: -8,
      META: -8,
      AAPL: -6,
      MSFT: -6,
      GOOGL: -6,

      // Consumer discretionary hurt
      XLY: -8,
      XRT: -9,
      HD: -7,
      LOW: -7,
      NKE: -8,
      SBUX: -7,
      TGT: -8,
      BBY: -9,
      RCL: -9,
      CCL: -10,
      NCLH: -10,

      // Staples may hold up
      XLP: 1,
      WMT: 2,
      COST: 2,
      PG: 1,
      KO: 1,
      PEP: 1,
      CL: 1,
      KMB: 1,
      GIS: 1,
      KR: 2,
    },
  },

  {
    id: "dollar_surge",
    label: "Dollar Surge",
    description:
      "The US dollar strengthens. Multinationals, commodities, gold, emerging markets, and foreign revenue exposure weaken.",
    dependencyDriver: "US Dollar",
    defaultShock: -3,
    shocks: {
      // Dollar ETFs
      UUP: 9,
      USDU: 8,
      FXE: -7,
      FXY: -7,
      FXB: -6,
      FXA: -6,
      FXC: -5,

      // Gold / metals hurt by stronger dollar
      GLD: -8,
      IAU: -8,
      SGOL: -8,
      PHYS: -8,
      SLV: -10,
      PSLV: -10,
      GDX: -12,
      GDXJ: -14,
      NEM: -10,
      AEM: -10,
      GOLD: -10,
      KGC: -11,
      AU: -11,
      PAAS: -12,
      AG: -12,
      HL: -12,

      // Oil / commodities
      USO: -6,
      BNO: -6,
      XLE: -4,
      XOP: -5,
      XOM: -4,
      CVX: -4,
      COP: -4,
      OXY: -5,
      FCX: -8,
      SCCO: -8,
      TECK: -7,
      MOS: -6,
      CF: -6,
      NTR: -6,

      // Emerging markets / China / international
      EEM: -12,
      IEMG: -12,
      VWO: -12,
      FXI: -11,
      KWEB: -12,
      MCHI: -11,
      ASHR: -10,
      EWZ: -11,
      EWW: -9,
      INDA: -8,
      EWY: -9,
      EWT: -9,
      EWG: -7,
      EWJ: -6,
      VGK: -7,
      VEA: -6,

      // Multinationals / tech exporters
      SPY: -3,
      QQQ: -5,
      AAPL: -5,
      MSFT: -4,
      NVDA: -6,
      AMD: -6,
      GOOGL: -4,
      GOOG: -4,
      AMZN: -4,
      META: -4,
      AVGO: -5,
      QCOM: -5,
      TXN: -5,
      CAT: -5,
      DE: -5,
      MMM: -4,
      GE: -4,
      HON: -4,
      NKE: -5,
      SBUX: -4,
      MCD: -3,
      KO: -3,
      PEP: -3,
    },
  },

  {
    id: "credit_tightens",
    label: "Credit Tightens",
    description:
      "Lending conditions worsen. Banks, small caps, cyclicals, REITs, lower-quality debt, and high-beta stocks fall.",
    dependencyDriver: "Credit Conditions",
    defaultShock: -8,
    shocks: {
      // Financials / banks
      XLF: -11,
      KRE: -20,
      KBE: -18,
      IAT: -18,
      JPM: -8,
      BAC: -11,
      WFC: -11,
      C: -11,
      GS: -10,
      MS: -10,
      SCHW: -13,
      WAL: -22,
      ZION: -20,
      KEY: -20,
      CMA: -19,
      RF: -18,
      TFC: -17,
      CFG: -18,
      FITB: -17,
      HBAN: -17,
      MTB: -15,
      FHN: -16,
      PACW: -25,

      // Credit ETFs
      HYG: -9,
      JNK: -9,
      LQD: -6,
      BKLN: -5,
      SRLN: -5,
      ANGL: -7,

      // Small caps / cyclicals
      IWM: -15,
      IJR: -14,
      MDY: -11,
      XLY: -12,
      XLI: -10,
      XLB: -10,
      XRT: -14,
      XHB: -14,
      ITB: -14,
      VNQ: -13,
      XLRE: -13,
      IYR: -13,

      // High-beta / unprofitable growth
      ARKK: -20,
      ARKW: -18,
      ARKG: -17,
      PLTR: -16,
      SNOW: -17,
      DDOG: -17,
      NET: -17,
      MDB: -17,
      ROKU: -18,
      SHOP: -16,
      U: -18,
      AFRM: -22,
      UPST: -25,
      SOFI: -18,
      HOOD: -18,
      CVNA: -22,

      // Crypto-linked
      COIN: -22,
      MSTR: -22,
      MARA: -24,
      RIOT: -24,
      CLSK: -24,
      HUT: -22,
      BITF: -22,
      WULF: -22,
      CIFR: -22,
      IREN: -22,

      // Defensive / safe-haven
      TLT: 6,
      IEF: 4,
      SHY: 2,
      GLD: 4,
      IAU: 4,
      VIXY: 25,
      VXX: 25,
      XLP: -2,
      XLU: -3,
      XLV: -3,
    },
  },

  {
    id: "semiconductor_boom",
    label: "Semiconductor Boom",
    description:
      "Chip demand accelerates. Semis, AI infrastructure, equipment makers, memory, foundries, and power/data-center beneficiaries rally.",
    dependencyDriver: "Semiconductor Demand",
    defaultShock: 2,
    shocks: {
      // Semiconductor ETFs
      SMH: 12,
      SOXX: 12,
      SOXQ: 12,
      XSD: 10,
      SOXL: 30,
      SOXS: -30,

      // AI / GPU / compute leaders
      NVDA: 18,
      AMD: 14,
      AVGO: 12,
      MRVL: 13,
      QCOM: 8,
      INTC: 8,
      ARM: 12,
      MU: 14,
      WDC: 10,
      STX: 9,

      // Foundries / global semis
      TSM: 11,
      ASML: 11,
      UMC: 8,
      GFS: 8,
      TXN: 7,
      ADI: 7,
      NXPI: 8,
      ON: 9,
      MPWR: 10,
      MCHP: 7,
      SWKS: 7,
      QRVO: 7,
      LSCC: 9,
      CRUS: 7,

      // Semi equipment
      AMAT: 12,
      LRCX: 12,
      KLAC: 11,
      TER: 10,
      ACLS: 10,
      AEHR: 10,
      COHU: 9,
      CAMT: 10,
      AMKR: 9,
      FORM: 9,
      ICHR: 9,
      MKSI: 8,
      ENTG: 8,
      ONTO: 9,
      VECO: 8,

      // Data centers / AI power / infrastructure
      VRT: 12,
      ETN: 8,
      PWR: 7,
      FIX: 7,
      DLR: 6,
      EQIX: 6,
      CEG: 7,
      NRG: 6,
      GEV: 7,
      SMCI: 14,
      DELL: 10,
      HPE: 8,
      ANET: 10,
      CSCO: 5,
      NTAP: 6,
      PSTG: 7,

      // Cloud / software beneficiaries
      MSFT: 5,
      GOOGL: 5,
      GOOG: 5,
      AMZN: 5,
      META: 5,
      ORCL: 5,
      CRM: 4,
      SNOW: 6,
      DDOG: 6,
      NET: 6,
      PLTR: 7,

      // Broader growth
      QQQ: 5,
      XLK: 5,
      VGT: 5,
    },
  },

  {
    id: "housing_slump",
    label: "Housing Slump",
    description:
      "Housing demand weakens. Homebuilders, building products, furniture, mortgage lenders, REITs, and consumer durables fall.",
    dependencyDriver: "Housing Demand",
    defaultShock: -3,
    shocks: {
      // Housing ETFs
      XHB: -15,
      ITB: -15,
      PKB: -12,

      // Homebuilders
      DHI: -16,
      LEN: -16,
      PHM: -16,
      TOL: -15,
      KBH: -15,
      NVR: -13,
      MTH: -15,
      TMHC: -15,
      LGIH: -14,
      CCS: -14,
      BZH: -14,
      HOV: -14,
      GRBK: -14,
      DFH: -14,
      MHO: -14,

      // Building products / materials
      BLDR: -14,
      BLD: -12,
      MAS: -10,
      FBIN: -10,
      OC: -10,
      IBP: -10,
      TREX: -11,
      LPX: -10,
      EXP: -9,
      MLM: -8,
      VMC: -8,
      CX: -8,
      JHX: -8,

      // Home improvement / furnishing
      HD: -9,
      LOW: -9,
      FND: -10,
      RH: -14,
      WSM: -11,
      W: -14,
      ETH: -10,
      TPX: -9,
      WHR: -10,
      LEG: -8,

      // Mortgage / title / real estate services
      RKT: -16,
      UWMC: -16,
      TREE: -16,
      RDFN: -18,
      ZG: -15,
      Z: -15,
      OPEN: -20,
      COMP: -18,
      FNF: -9,
      FAF: -9,
      MTG: -10,
      RDN: -10,
      ESNT: -10,
      ACT: -10,

      // REITs
      VNQ: -9,
      XLRE: -9,
      IYR: -9,
      SCHH: -9,
      AVB: -10,
      EQR: -10,
      ESS: -10,
      MAA: -10,
      UDR: -10,
      CPT: -10,
      INVH: -9,
      AMH: -9,
      O: -7,
      SPG: -8,

      // Banks exposed to mortgage / credit
      KRE: -10,
      KBE: -9,
      BAC: -6,
      WFC: -6,
      JPM: -5,
      RF: -7,
      TFC: -7,
      CFG: -7,
    },
  },
];

export default function Strategies() {
  const [range, setRange] = useState("1Y");
  const [benchmark, setBenchmark] = useState("SPY");
  const [positions, setPositions] = useState(DEFAULT_ACTIVE_STRATEGIES[0].positions);
const [activeStrategies, setActiveStrategies] = useState([]);
const [selectedStrategyId, setSelectedStrategyId] = useState(null);
const [selectedStrategyName, setSelectedStrategyName] = useState("");
const [strategyBank, setStrategyBank] = useState([]);
const [userId, setUserId] = useState(null);
const [loadingStrategies, setLoadingStrategies] = useState(true);
const [customStrategyName, setCustomStrategyName] = useState("");
const [customStrategyNotes, setCustomStrategyNotes] = useState("");
const [customStrategyRebalance, setCustomStrategyRebalance] = useState("Never");
const [builderPositions, setBuilderPositions] = useState([
  { ticker: "", weight: 0 },
]);
const [editingStrategyName, setEditingStrategyName] = useState(null);
const [openStrategyMenu, setOpenStrategyMenu] = useState(null);
  const [mode, setMode] = useState("strategy");
  const [backtest, setBacktest] = useState(null);
  const [loading, setLoading] = useState(false);
  const [benchmarkLoading, setBenchmarkLoading] = useState(true);
  const [hoverIndex, setHoverIndex] = useState(null);
  const [spyData, setSpyData] = useState([]);
  const [backtestError, setBacktestError] = useState("");
const [hasRunBacktest, setHasRunBacktest] = useState(false);
const [strategyExplanation, setStrategyExplanation] = useState(null);
const [holdingAttribution, setHoldingAttribution] = useState(null);
const [stressResult, setStressResult] = useState(null);
const [showBullionaireScore, setShowBullionaireScore] = useState(true);
const [showStressDetails, setShowStressDetails] = useState(true);

  useEffect(() => {
  const loadSavedStrategies = async () => {
    try {
      setLoadingStrategies(true);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        console.error("No logged-in user found:", userError);
        setStrategyBank([]);
        return;
      }

      setUserId(user.id);

      const { data, error } = await supabase
        .from("saved_strategies")
        .select("id, name, positions, notes, rebalance, location, created_at, updated_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Failed to load saved strategies:", error);
        setBacktestError("Failed to load saved strategies.");
        return;
      }

      if (data && data.length > 0) {
  const uniqueStrategies = data.filter(
    (strategy, index, self) =>
      index ===
      self.findIndex(
        (s) => s.name.toLowerCase() === strategy.name.toLowerCase()
      )
  );

  const activeFromSupabase = uniqueStrategies
    .filter((strategy) => strategy.location === "active")
    .map((strategy) => ({
      id: strategy.id,
      name: strategy.name,
      positions: strategy.positions,
      location: "active",
    }));

  const bankFromSupabase = uniqueStrategies.filter(
    (strategy) => strategy.location !== "active"
  );

  setActiveStrategies(activeFromSupabase);
setStrategyBank(bankFromSupabase);

if (activeFromSupabase.length > 0) {
  setSelectedStrategyId(activeFromSupabase[0].id);
  setSelectedStrategyName(activeFromSupabase[0].name);
  setPositions(activeFromSupabase[0].positions);
}

return;
}

const seedKey = `bullionaire_starter_strategies_seeded_${user.id}`;
const alreadySeeded = localStorage.getItem(seedKey);

if (alreadySeeded) {
  setStrategyBank([]);
  return;
}

const starterActiveStrategies = DEFAULT_ACTIVE_STRATEGIES.map((strategy) => ({
  user_id: user.id,
  name: strategy.name,
  positions: strategy.positions,
  notes: "Starter active strategy generated by Bullionaire.",
  rebalance: "Never",
  location: "active",
}));

const starterBankStrategies = DEFAULT_STRATEGY_BANK.map((strategy) => ({
  user_id: user.id,
  name: strategy.name,
  positions: strategy.positions,
  notes: "Starter bank strategy generated by Bullionaire.",
  rebalance: "Never",
  location: "bank",
}));

const { data: seededStrategies, error: seedError } = await supabase
  .from("saved_strategies")
  .insert([...starterActiveStrategies, ...starterBankStrategies])
  .select("id, name, positions, notes, rebalance, location, created_at, updated_at");

if (seedError) {
  console.error("Failed to seed starter strategies:", seedError);
  setActiveStrategies([]);
  setStrategyBank([]);
  return;
}

localStorage.setItem(seedKey, "true");

const seededActiveStrategies = (seededStrategies || [])
  .filter((strategy) => strategy.location === "active")
  .map((strategy) => ({
    id: strategy.id,
    name: strategy.name,
    positions: strategy.positions,
    location: "active",
  }));

const seededBankStrategies = (seededStrategies || []).filter(
  (strategy) => strategy.location !== "active"
);

setActiveStrategies(seededActiveStrategies);
setStrategyBank(seededBankStrategies);

if (seededActiveStrategies.length > 0) {
  setSelectedStrategyId(seededActiveStrategies[0].id);
  setSelectedStrategyName(seededActiveStrategies[0].name);
  setPositions(seededActiveStrategies[0].positions);
}
    } catch (err) {
      console.error("Unexpected saved strategy load error:", err);
      setBacktestError("Failed to load saved strategies.");
    } finally {
      setLoadingStrategies(false);
    }
  };

  loadSavedStrategies();
}, []);

  useEffect(() => {
  let cancelled = false;

  const fetchBenchmarkChart = async () => {
    const cleanBenchmark = (benchmark || "SPY").trim().toUpperCase();
    const cacheKey = `${cleanBenchmark}:${range}`;
    const now = Date.now();

    try {
      setBenchmarkLoading(true);

      const memoryCached = BENCHMARK_CHART_CACHE[cacheKey];

      if (
        memoryCached &&
        Array.isArray(memoryCached.data) &&
        now - memoryCached.time < BENCHMARK_CACHE_TTL_MS
      ) {
        setSpyData(memoryCached.data);
        setBenchmarkLoading(false);
        return;
      }

      const localStorageKey = `bullionaire_benchmark_chart_${cacheKey}`;
      const savedCachedRaw = localStorage.getItem(localStorageKey);

      if (savedCachedRaw) {
        try {
          const savedCached = JSON.parse(savedCachedRaw);

          if (
            savedCached &&
            Array.isArray(savedCached.data) &&
            now - savedCached.time < BENCHMARK_CACHE_TTL_MS
          ) {
            BENCHMARK_CHART_CACHE[cacheKey] = savedCached;

            if (!cancelled) {
              setSpyData(savedCached.data);
              setBenchmarkLoading(false);
            }

            return;
          }
        } catch (cacheErr) {
          localStorage.removeItem(localStorageKey);
        }
      }

      const res = await fetch(
        `${API_BASE}/stocks/${cleanBenchmark}/chart?range=${range}`
      );

      const data = await res.json();

      if (!res.ok || data?.error) {
        throw new Error(data?.error || "Failed to load benchmark chart.");
      }

      const parsedData = Array.isArray(data)
        ? data
        : data.points ||
          data.data ||
          data.results ||
          data.chart ||
          data.prices ||
          [];

      if (!cancelled) {
        setSpyData(parsedData);
      }

      const cacheValue = {
        time: Date.now(),
        data: parsedData,
      };

      BENCHMARK_CHART_CACHE[cacheKey] = cacheValue;
      localStorage.setItem(localStorageKey, JSON.stringify(cacheValue));
    } catch (err) {
      console.error("Failed to load benchmark chart", err);

      if (!cancelled) {
        setSpyData([]);
      }
    } finally {
      if (!cancelled) {
        setBenchmarkLoading(false);
      }
    }
  };

  fetchBenchmarkChart();

  return () => {
    cancelled = true;
  };
}, [benchmark, range]);

  const getPrice = (point) => {
  return Number(
    point.close ??
      point.price ??
      point.c ??
      point.value ??
      point.y ??
      point.Close ??
      point["Close"] ??
      point["Current Price"]
  );
};

const getDate = (point) => {
  return (
    point.date ??
    point.time ??
    point.timestamp ??
    point.t ??
    point.datetime ??
    point.label ??
    ""
  );
};

const spyIndexedPoints = useMemo(() => {
  const parsed = spyData
    .map((point) => ({
      time: getDate(point),
      price: getPrice(point),
    }))
    .filter((point) => !Number.isNaN(point.price));

  if (parsed.length < 2) return [];

  return parsed.map((point) => ({
  time: point.time,
  benchmark: point.price,
}));
}, [spyData]);

const backtestPoints = backtest?.points || [];

const points = backtestPoints.length ? backtestPoints : spyIndexedPoints;

const benchmarkStart = points.length ? points[0].benchmark : null;
const benchmarkEnd = points.length ? points[points.length - 1].benchmark : null;
const benchmarkIsPositive =
  benchmarkStart !== null && benchmarkEnd !== null
    ? benchmarkEnd >= benchmarkStart
    : true;

const chartLineColor = benchmarkIsPositive ? "#19C37D" : "#ef4444";

  const strategyReturn = backtest?.strategyReturn ?? 0;
  const benchmarkReturn = backtest?.benchmarkReturn ?? 0;
  const outperformance = backtest?.outperformance ?? 0;
  const maxDrawdown = backtest?.maxDrawdown ?? 0;
  const volatility = backtest?.volatility ?? 0;

   const strategyScore = useMemo(() => {
    if (!backtest) {
      return {
        score: null,
        label: "Run a Backtest",
        description: "Score appears after a strategy is tested.",
      };
    }

    const safeVolatility = Math.max(Math.abs(volatility), 1);

    const validRelativePoints = backtestPoints.filter(
  (point) =>
    typeof point.strategy === "number" &&
    typeof point.benchmark === "number" &&
    !Number.isNaN(point.strategy) &&
    !Number.isNaN(point.benchmark)
);

const periodsAboveBenchmark = validRelativePoints.filter(
  (point) => point.strategy > point.benchmark
).length;

const periodsUnderBenchmark = validRelativePoints.filter(
  (point) => point.strategy < point.benchmark
).length;

const aboveBenchmarkRatio =
  validRelativePoints.length > 0
    ? periodsAboveBenchmark / validRelativePoints.length
    : 0;

const underBenchmarkRatio =
  validRelativePoints.length > 0
    ? periodsUnderBenchmark / validRelativePoints.length
    : 0;

const averageRelativePerformance =
  validRelativePoints.length > 0
    ? validRelativePoints.reduce(
        (sum, point) => sum + (point.strategy - point.benchmark),
        0
      ) / validRelativePoints.length
    : 0;

const timeBenchmarkWeight = 10;

const consistencyBonus = Math.min(
  timeBenchmarkWeight,
  aboveBenchmarkRatio * timeBenchmarkWeight
);

const consistencyPenalty = Math.min(
  timeBenchmarkWeight,
  underBenchmarkRatio * timeBenchmarkWeight
);

const averageUnderperformancePenalty =
  outperformance < 0 && averageRelativePerformance < 0
    ? Math.min(8, Math.abs(averageRelativePerformance) * 0.35)
    : 0;

    const returnScore = Math.max(-20, Math.min(25, strategyReturn * 0.45));

    const outperformanceScore =
  outperformance >= 0
    ? Math.min(24, outperformance * 0.9)
    : Math.max(-25, outperformance * 1.8);

    const drawdownPenalty = Math.min(30, Math.abs(maxDrawdown) * 1.15);
    const volatilityPenalty = Math.min(22, Math.abs(volatility) * 0.65);

    const riskRewardScore = Math.max(
      -12,
      Math.min(18, (strategyReturn / safeVolatility) * 10)
    );

    const inefficientRiskPenalty =
      outperformance < 0 && volatility > Math.abs(benchmarkReturn)
        ? Math.min(18, Math.abs(outperformance) * 0.75)
        : 0;

    const negativeReturnPenalty =
      strategyReturn < 0 ? Math.min(20, Math.abs(strategyReturn) * 0.8) : 0;

    const rawScore =
  50 +
  returnScore +
  outperformanceScore +
  riskRewardScore +
  consistencyBonus -
  drawdownPenalty -
  volatilityPenalty -
  inefficientRiskPenalty -
  negativeReturnPenalty -
  consistencyPenalty -
  averageUnderperformancePenalty;

    const finalScore = Math.round(Math.max(0, Math.min(100, rawScore)));

    let label = "Weak";
    let description = "This strategy needs improvement before it looks attractive.";


    if (finalScore >= 90) {
  label = "Elite";
  description =
    "This strategy shows excellent benchmark-relative performance, strong risk/reward, and consistent outperformance.";
} else if (finalScore >= 78) {
  label = "Strong";
  description =
    "This strategy has a good overall profile, but still needs to be checked for consistency, drawdown, and volatility risk.";
} else if (finalScore >= 62) {
  label = "Aggressive";
  description =
    "This strategy has upside potential, but the score is being held back by risk, volatility, or inconsistent benchmark-relative performance.";
} else if (finalScore >= 45) {
  label = "High Risk";
  description =
    "This strategy may have some upside, but its risk profile, inconsistency, or benchmark underperformance is a major concern.";
}

    if (outperformance < 0) {
  description =
    aboveBenchmarkRatio >= 0.45
      ? "This strategy finished slightly behind the benchmark, but it spent a meaningful amount of time outperforming. The score reflects both the final lag and its benchmark-relative consistency."
      : "This strategy is being penalized because it underperformed the benchmark and spent too much time below it. A strategy can have positive returns and still score poorly if SPY did better with less risk.";
}

    if (strategyReturn < 0) {
      description =
        "This strategy is being penalized heavily because it produced a negative return over the selected period.";
    }

    return {
      score: finalScore,
      label,
      description,
    };
  }, [
    backtest,
    strategyReturn,
    benchmarkReturn,
    outperformance,
    maxDrawdown,
    volatility,
  ]);

  const allValues = points
  .flatMap((p) => [p.strategy, p.benchmark])
  .filter((value) => typeof value === "number" && !Number.isNaN(value));
  const min = allValues.length ? Math.min(...allValues) : 0;
  const max = allValues.length ? Math.max(...allValues) : 100;
  const chartRange = Math.max(max - min, 1);

  const priceTicks = useMemo(() => {
    if (!points.length) return [];

    const tickCount = 5;

    return Array.from({ length: tickCount }, (_, i) => {
      const value = max - (i / (tickCount - 1)) * chartRange;
      const y = ((max - value) / chartRange) * 100;

      return { value, y };
    });
  }, [points.length, max, chartRange]);

  const strategySvgPoints = backtestPoints.length
  ? backtestPoints
      .map((point, index) => {
        const x = (index / Math.max(backtestPoints.length - 1, 1)) * 100;
        const y = 100 - ((point.strategy - min) / chartRange) * 100;
        return `${x},${y}`;
      })
      .join(" ")
  : "";

  const benchmarkSvgPoints = points
  .filter(
    (point) =>
      typeof point.benchmark === "number" &&
      !Number.isNaN(point.benchmark)
  )
  .map((point, index, arr) => {
    const x = (index / Math.max(arr.length - 1, 1)) * 100;
    const y = 100 - ((point.benchmark - min) / chartRange) * 100;
    return `${x},${y}`;
  })
  .join(" ");

  const activePoint =
    hoverIndex !== null && points[hoverIndex]
      ? points[hoverIndex]
      : points[points.length - 1];

  const activeX =
    hoverIndex !== null && points.length > 1
      ? (hoverIndex / Math.max(points.length - 1, 1)) * 100
      : 100;

  const activeTooltipY =
  activePoint && typeof activePoint.strategy === "number"
    ? 100 - ((activePoint.strategy - min) / chartRange) * 100
    : activePoint && typeof activePoint.benchmark === "number"
    ? 100 - ((activePoint.benchmark - min) / chartRange) * 100
    : 50;

  const formatPercent = (value) => {
  if (value === null || value === undefined || Number.isNaN(value)) return "--";
  return `${value >= 0 ? "+" : ""}${Number(value).toFixed(2)}%`;
};

const formatChartValue = (value) => {
  if (value === null || value === undefined || Number.isNaN(value)) return "--";

  if (backtestPoints.length > 0) {
    return `${value - 100 >= 0 ? "+" : ""}${(value - 100).toFixed(2)}%`;
  }

  return Number(value).toFixed(2);
};

  const formatIndexValue = (value) => {
    if (value === null || value === undefined || Number.isNaN(value)) return "--";
    return Number(value).toFixed(2);
  };

  const formatDate = (value) => {
    if (!value) return "";
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return String(value);

    if (range === "1D") {
      return date.toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
      });
    }

    return date.toLocaleDateString([], {
      month: "short",
      day: "numeric",
      year: range === "5Y" ? "numeric" : undefined,
    });
  };

  const getMacroTagsForStrategy = (strategyPositions = []) => {
  const normalizedPositions = strategyPositions.map((position) => ({
    ticker: String(position.ticker || "").toUpperCase(),
    weight: Number(position.weight) || 0,
  }));

  const hasLong = (tickers) =>
    normalizedPositions.some(
      (position) => tickers.includes(position.ticker) && position.weight > 0
    );

  const hasShort = (tickers) =>
    normalizedPositions.some(
      (position) => tickers.includes(position.ticker) && position.weight < 0
    );

  const longWeight = (tickers) =>
    normalizedPositions
      .filter((position) => tickers.includes(position.ticker) && position.weight > 0)
      .reduce((sum, position) => sum + position.weight, 0);

  const shortWeight = (tickers) =>
    Math.abs(
      normalizedPositions
        .filter((position) => tickers.includes(position.ticker) && position.weight < 0)
        .reduce((sum, position) => sum + position.weight, 0)
    );

  const totalLong = normalizedPositions
    .filter((position) => position.weight > 0)
    .reduce((sum, position) => sum + position.weight, 0);

  const totalShort = Math.abs(
    normalizedPositions
      .filter((position) => position.weight < 0)
      .reduce((sum, position) => sum + position.weight, 0)
  );

  const grossExposure = totalLong + totalShort;
  const maxSinglePosition = normalizedPositions.length
    ? Math.max(...normalizedPositions.map((position) => Math.abs(position.weight)))
    : 0;

  const tags = [];

  const energyTickers = ["XLE", "XOM", "CVX", "COP", "OXY", "SLB", "HAL", "USO", "UNG", "BKR"];
  const oilTickers = ["USO", "XLE", "XOM", "CVX", "COP", "OXY", "SLB", "HAL", "BKR"];
  const naturalGasTickers = ["UNG", "LNG", "EQT", "CTRA", "AR"];
  const airlineTickers = ["DAL", "UAL", "AAL", "LUV", "JETS"];
  const truckingTransportTickers = ["IYT", "XLI", "FDX", "UPS", "JBHT", "CHRW", "ODFL"];
  const techTickers = ["AAPL", "MSFT", "NVDA", "AMD", "GOOGL", "META", "AMZN", "QQQ", "SMH", "TSM", "AVGO", "CRM", "ORCL", "ADBE"];
  const semiconductorTickers = ["NVDA", "AMD", "SMH", "TSM", "AVGO", "MU", "INTC", "QCOM", "ASML", "AMAT", "LRCX"];
  const aiTickers = ["NVDA", "AMD", "MSFT", "GOOGL", "META", "AVGO", "SMH"];
  const goldTickers = ["GLD", "IAU", "GDX", "NEM", "AEM", "GOLD"];
  const silverTickers = ["SLV", "SIL", "PAAS", "AG"];
  const bondTickers = ["TLT", "IEF", "SHY", "BND", "AGG", "HYG", "LQD"];
  const rateSensitiveTickers = ["TLT", "IEF", "SHY", "XHB", "VNQ", "XLRE", "KRE", "QQQ", "BND", "AGG"];
  const realEstateTickers = ["VNQ", "XLRE", "O", "AMT", "PLD", "SPG", "EQIX"];
  const homebuilderTickers = ["XHB", "ITB", "DHI", "LEN", "PHM", "TOL", "KBH"];
  const bankTickers = ["XLF", "KRE", "JPM", "BAC", "WFC", "C", "GS", "MS"];
  const regionalBankTickers = ["KRE", "KBE", "SCHW", "WAL", "ZION", "CFG", "KEY"];
  const defenseTickers = ["LMT", "RTX", "NOC", "GD", "HII", "ITA"];
  const cryptoTickers = ["IBIT", "GBTC", "COIN", "MSTR", "BITO", "RIOT", "MARA"];
  const highBetaTickers = ["NVDA", "AMD", "COIN", "MSTR", "TSLA", "PLTR", "SMCI", "ARKK", "RIOT", "MARA"];
  const consumerDiscretionaryTickers = ["XLY", "AMZN", "TSLA", "HD", "LOW", "NKE", "SBUX", "MCD"];
  const consumerStaplesTickers = ["XLP", "WMT", "COST", "PG", "KO", "PEP", "MO", "PM"];
  const healthcareTickers = ["XLV", "UNH", "LLY", "JNJ", "MRK", "ABBV", "PFE", "TMO"];
  const pharmaTickers = ["LLY", "JNJ", "MRK", "ABBV", "PFE", "BMY", "AMGN", "GILD"];
  const biotechTickers = ["XBI", "IBB", "MRNA", "BIIB", "REGN", "VRTX"];
  const industrialTickers = ["XLI", "CAT", "DE", "GE", "HON", "MMM", "ETN"];
  const materialsTickers = ["XLB", "FCX", "NUE", "LIN", "APD", "DOW", "MOS"];
  const copperTickers = ["FCX", "SCCO", "COPX"];
  const agricultureTickers = ["MOO", "DE", "ADM", "MOS", "NTR", "CF"];
  const utilitiesTickers = ["XLU", "NEE", "DUK", "SO", "AEP", "D", "EXC"];
  const dividendTickers = ["SCHD", "VYM", "NOBL", "DVY", "KO", "PG", "PEP", "JNJ"];
  const broadMarketTickers = ["SPY", "VOO", "IVV", "VTI", "DIA", "IWM", "QQQ"];
  const smallCapTickers = ["IWM", "IJR", "VB", "TNA"];
  const volatilityTickers = ["VIXY", "UVXY", "VXX", "SVXY"];
  const inverseTickers = ["SQQQ", "SH", "PSQ", "SDS", "SPXU", "TZA"];
  const leveragedTickers = ["TQQQ", "SQQQ", "UPRO", "SPXL", "SPXS", "TNA", "TZA", "SOXL", "SOXS", "FAS", "FAZ"];

  if (hasLong(oilTickers)) tags.push("Oil Bullish");
  if (hasShort(oilTickers)) tags.push("Oil Bearish");
  if (hasLong(energyTickers)) tags.push("Energy Long");
  if (hasLong(naturalGasTickers)) tags.push("Natural Gas Exposure");

  if (hasShort(airlineTickers)) tags.push("Airlines Short");
  if (hasLong(airlineTickers)) tags.push("Airlines Long");
  if (hasShort(truckingTransportTickers)) tags.push("Transport Short");
  if (hasLong(truckingTransportTickers)) tags.push("Transport Long");

  if (hasLong(techTickers)) tags.push("Tech Heavy");
  if (hasLong(aiTickers)) tags.push("AI Exposure");
  if (hasLong(semiconductorTickers)) tags.push("Semiconductor Exposure");

  if (hasLong(goldTickers)) tags.push("Gold Hedge");
  if (hasLong(silverTickers)) tags.push("Silver Exposure");
  if (hasLong(materialsTickers)) tags.push("Materials Exposure");
  if (hasLong(copperTickers)) tags.push("Copper Exposure");
  if (hasLong(agricultureTickers)) tags.push("Agriculture Exposure");

  if (hasLong(bondTickers)) tags.push("Bond Exposure");
  if (hasLong(rateSensitiveTickers)) tags.push("Rate Sensitive");
  if (hasLong(realEstateTickers)) tags.push("Real Estate Exposure");
  if (hasLong(homebuilderTickers)) tags.push("Housing Sensitive");

  if (hasLong(bankTickers)) tags.push("Financials Exposure");
  if (hasLong(regionalBankTickers)) tags.push("Regional Bank Exposure");

  if (hasLong(defenseTickers)) tags.push("Defense");
  if (hasLong(healthcareTickers)) tags.push("Healthcare Defensive");
  if (hasLong(pharmaTickers)) tags.push("Pharma Exposure");
  if (hasLong(biotechTickers)) tags.push("Biotech Exposure");
  if (hasLong(utilitiesTickers)) tags.push("Utilities Defensive");
  if (hasLong(consumerStaplesTickers)) tags.push("Consumer Staples");
  if (hasLong(consumerDiscretionaryTickers)) tags.push("Consumer Cyclical");

  if (hasLong(industrialTickers)) tags.push("Industrial Exposure");
  if (hasLong(cryptoTickers)) tags.push("Crypto Linked");
  if (hasLong(highBetaTickers)) tags.push("High Beta");
  if (hasLong(dividendTickers)) tags.push("Dividend Tilt");
  if (hasLong(broadMarketTickers)) tags.push("Broad Market Exposure");
  if (hasLong(smallCapTickers)) tags.push("Small Cap Exposure");
  if (hasLong(volatilityTickers)) tags.push("Volatility Hedge");

  if (hasLong(inverseTickers)) tags.push("Inverse Market Exposure");
  if (hasLong(leveragedTickers)) tags.push("Leveraged ETF Exposure");

  if (totalShort > 0) tags.push("Short Exposure");
  if (grossExposure > 100) tags.push("Leveraged");
  if (grossExposure >= 125) tags.push("High Gross Exposure");
  if (maxSinglePosition >= 50) tags.push("Concentrated");
  if (maxSinglePosition >= 75) tags.push("Single-Name Heavy");

  if (longWeight(consumerStaplesTickers) + longWeight(utilitiesTickers) + longWeight(healthcareTickers) >= 50) {
    tags.push("Recession Defense");
  }

  if (longWeight(consumerDiscretionaryTickers) + longWeight(techTickers) + longWeight(smallCapTickers) >= 60) {
    tags.push("Growth Tilt");
  }

  if (shortWeight(consumerDiscretionaryTickers) + shortWeight(airlineTickers) + shortWeight(truckingTransportTickers) > 0) {
    tags.push("Cyclical Short");
  }

  const uniqueTags = [...new Set(tags)];

  return uniqueTags.slice(0, 3);
};

const getRiskWarningsForPositions = (strategyPositions = []) => {
  const normalizedPositions = strategyPositions
    .map((position) => ({
      ticker: String(position.ticker || "").toUpperCase(),
      weight: Number(position.weight) || 0,
    }))
    .filter((position) => position.ticker && position.weight !== 0);

  if (!normalizedPositions.length) return [];

  const totalLong = normalizedPositions
    .filter((position) => position.weight > 0)
    .reduce((sum, position) => sum + position.weight, 0);

  const totalShort = Math.abs(
    normalizedPositions
      .filter((position) => position.weight < 0)
      .reduce((sum, position) => sum + position.weight, 0)
  );

  const grossExposure = totalLong + totalShort;
  const netExposure = totalLong - totalShort;

  const maxPosition = normalizedPositions.reduce(
    (largest, position) =>
      Math.abs(position.weight) > Math.abs(largest.weight) ? position : largest,
    normalizedPositions[0]
  );

  const energyTickers = ["XLE", "XOM", "CVX", "COP", "OXY", "SLB", "HAL", "USO", "UNG", "BKR"];
  const airlineTickers = ["DAL", "UAL", "AAL", "LUV", "JETS"];
  const techTickers = ["AAPL", "MSFT", "NVDA", "AMD", "GOOGL", "META", "AMZN", "QQQ", "SMH", "TSM", "AVGO"];
  const bondTickers = ["TLT", "IEF", "SHY", "BND", "AGG"];
  const goldTickers = ["GLD", "IAU", "GDX", "NEM", "AEM", "GOLD"];
  const cryptoTickers = ["IBIT", "GBTC", "COIN", "MSTR", "BITO", "RIOT", "MARA"];
  const highBetaTickers = ["NVDA", "AMD", "COIN", "MSTR", "TSLA", "PLTR", "SMCI", "ARKK", "RIOT", "MARA"];

  const longWeight = (tickers) =>
    normalizedPositions
      .filter((position) => tickers.includes(position.ticker) && position.weight > 0)
      .reduce((sum, position) => sum + position.weight, 0);

  const shortWeight = (tickers) =>
    Math.abs(
      normalizedPositions
        .filter((position) => tickers.includes(position.ticker) && position.weight < 0)
        .reduce((sum, position) => sum + position.weight, 0)
    );

  const warnings = [];

  if (grossExposure > 100) {
    warnings.push(`This strategy has ${grossExposure.toFixed(0)}% gross exposure.`);
  }

  if (grossExposure >= 130) {
    warnings.push("Gross exposure is high, so gains and losses may be amplified.");
  }

  if (totalShort > 0) {
    warnings.push(`This strategy has ${totalShort.toFixed(0)}% short exposure.`);
  }

  if (Math.abs(maxPosition.weight) >= 50) {
    warnings.push(`This strategy is highly dependent on ${maxPosition.ticker}.`);
  }

  if (Math.abs(maxPosition.weight) >= 75) {
    warnings.push(`${maxPosition.ticker} dominates the strategy, creating single-position concentration risk.`);
  }

  if (normalizedPositions.length <= 2) {
    warnings.push("This strategy is concentrated in very few holdings.");
  }

  if (netExposure > 100) {
    warnings.push(`Net long exposure is ${netExposure.toFixed(0)}%, which is above a fully invested portfolio.`);
  }

  if (netExposure < 0) {
    warnings.push("This strategy is net short and may lose money in a rising market.");
  }

  if (longWeight(energyTickers) >= 40) {
    warnings.push("This strategy may underperform if oil or energy prices fall.");
  }

  if (shortWeight(airlineTickers) > 0) {
    warnings.push("Short airline exposure may lose money if travel demand improves or fuel prices fall.");
  }

  if (longWeight(techTickers) >= 50) {
    warnings.push("This strategy is heavily exposed to technology stocks.");
  }

  if (longWeight(highBetaTickers) >= 40) {
    warnings.push("High-beta exposure may increase volatility during market selloffs.");
  }

  if (longWeight(bondTickers) >= 35) {
    warnings.push("Bond-heavy exposure may be sensitive to interest-rate changes.");
  }

  if (longWeight(goldTickers) >= 35) {
    warnings.push("Gold exposure may underperform when real rates rise or risk appetite improves.");
  }

  if (longWeight(cryptoTickers) >= 25) {
    warnings.push("Crypto-linked exposure can create large swings in strategy performance.");
  }

  return [...new Set(warnings)].slice(0, 4);
};

const explainCurrentStrategy = () => {
  if (strategyExplanation) {
    setStrategyExplanation(null);
    return;
  }

  const normalizedPositions = positions
    .map((position) => ({
      ticker: String(position.ticker || "").toUpperCase(),
      weight: Number(position.weight) || 0,
    }))
    .filter((position) => position.ticker && position.weight !== 0);

  if (!normalizedPositions.length) {
    setBacktestError("Add at least one ticker before explaining a strategy.");
    return;
  }

  const longPositions = normalizedPositions.filter((position) => position.weight > 0);
  const shortPositions = normalizedPositions.filter((position) => position.weight < 0);

  const totalLong = longPositions.reduce((sum, position) => sum + position.weight, 0);
  const totalShort = Math.abs(
    shortPositions.reduce((sum, position) => sum + position.weight, 0)
  );
  const grossExposure = totalLong + totalShort;
  const netExposure = totalLong - totalShort;

  const longText = longPositions.length
    ? longPositions
        .map((position) => `${position.ticker} ${position.weight}%`)
        .join(", ")
    : "no long positions";

  const shortText = shortPositions.length
    ? shortPositions
        .map((position) => `${position.ticker} ${Math.abs(position.weight)}% short`)
        .join(", ")
    : "no short positions";

  const tags = getMacroTagsForStrategy(normalizedPositions);
  const warnings = getRiskWarningsForPositions(normalizedPositions);

  const hasTag = (tag) => tags.includes(tag);

  let thesis = "This is a custom multi-asset strategy built from the selected holdings.";

  if (hasTag("Oil Bullish") && hasTag("Airlines Short")) {
    thesis =
      "This is an oil-price bullish long/short strategy. It benefits from energy strength while shorting airlines, which can be hurt by higher fuel costs.";
  } else if (hasTag("AI Exposure") || hasTag("Semiconductor Exposure")) {
    thesis =
      "This is a growth-oriented technology strategy with meaningful AI and semiconductor exposure. It is designed to benefit from strength in high-growth technology leadership.";
  } else if (hasTag("Gold Hedge")) {
    thesis =
      "This is a defensive hedge strategy with gold exposure. It may benefit when investors seek safety, inflation protection, or protection from market stress.";
  } else if (hasTag("Rate Sensitive") || hasTag("Bond Exposure")) {
    thesis =
      "This is an interest-rate-sensitive strategy. It may benefit when rates fall, but it can struggle if yields rise or rate-cut expectations fade.";
  } else if (hasTag("Defense")) {
    thesis =
      "This is a defense-sector strategy. It is tied to government defense spending, geopolitical risk, and aerospace or military contractor performance.";
  } else if (hasTag("Crypto Linked")) {
    thesis =
      "This is a crypto-linked strategy. It may benefit from strength in Bitcoin or crypto-related equities, but it can experience large swings.";
  } else if (hasTag("Recession Defense")) {
    thesis =
      "This is a defensive strategy tilted toward areas that may hold up better during economic slowdowns.";
  } else if (hasTag("Growth Tilt")) {
    thesis =
      "This is a growth-tilted strategy focused on economically sensitive or high-upside market leadership.";
  }

  const explanation = {
    title: selectedStrategyName || "Custom Strategy",
    thesis,
    longText,
    shortText,
    totalLong,
    totalShort,
    grossExposure,
    netExposure,
    tags,
    warnings,
  };

  setStrategyExplanation(explanation);
  setBacktestError("");
};

  const updatePosition = (index, field, value) => {
  setSelectedStrategyId(null);
  setSelectedStrategyName("Custom / Unsaved Strategy");
  setStrategyExplanation(null);
  setHoldingAttribution(null);
  setStressResult(null);

  setPositions((prev) =>
      prev.map((position, i) =>
        i === index
          ? {
              ...position,
              [field]: field === "weight" ? Number(value) : value.toUpperCase(),
            }
          : position
      )
    );
  };

  const addPosition = () => {
  setSelectedStrategyId(null);
  setSelectedStrategyName("Custom / Unsaved Strategy");
  setPositions((prev) => [...prev, { ticker: "", weight: 0 }]);
  setStrategyExplanation(null);
  setHoldingAttribution(null);
};

  const removePosition = (index) => {
  setSelectedStrategyId(null);
  setSelectedStrategyName("Custom / Unsaved Strategy");
  setPositions((prev) => prev.filter((_, i) => i !== index));
  setStrategyExplanation(null);
  setHoldingAttribution(null);
};

const updateBuilderPosition = (index, field, value) => {
  setBuilderPositions((prev) =>
    prev.map((position, i) =>
      i === index
        ? {
            ...position,
            [field]: field === "weight" ? Number(value) : value.toUpperCase(),
          }
        : position
    )
  );
};

const addBuilderPosition = () => {
  setBuilderPositions((prev) => [...prev, { ticker: "", weight: 0 }]);
};

const removeBuilderPosition = (index) => {
  setBuilderPositions((prev) => prev.filter((_, i) => i !== index));
};

const exposureStats = useMemo(() => {
  const cleanWeights = positions
    .map((p) => Number(p.weight))
    .filter((weight) => !Number.isNaN(weight));

  const longExposure = cleanWeights
    .filter((weight) => weight > 0)
    .reduce((sum, weight) => sum + weight, 0);

  const shortExposure = Math.abs(
    cleanWeights
      .filter((weight) => weight < 0)
      .reduce((sum, weight) => sum + weight, 0)
  );

  const netExposure = longExposure - shortExposure;
  const grossExposure = longExposure + shortExposure;

  return {
    longExposure,
    shortExposure,
    netExposure,
    grossExposure,
  };
}, [positions]);

const riskWarnings = useMemo(() => {
  return getRiskWarningsForPositions(positions);
}, [positions]);

const moveStrategyToBank = async (strategyId) => {
  const strategyToMove = activeStrategies.find((s) => s.id === strategyId);
  if (!strategyToMove) return;

  const { data, error } = await supabase
    .from("saved_strategies")
    .update({
      location: "bank",
      updated_at: new Date().toISOString(),
    })
    .eq("id", strategyId)
    .select("id, name, positions, notes, rebalance, location, created_at, updated_at")
    .single();

  if (error) {
    console.error("Failed to move strategy to bank:", error);
    setBacktestError("Failed to move strategy.");
    return;
  }

  setActiveStrategies((prev) => prev.filter((s) => s.id !== strategyId));

  setStrategyBank((prev) => {
    const alreadyInBank = prev.some((s) => s.id === data.id);
    if (alreadyInBank) return prev;

    return [data, ...prev];
  });
};

const moveStrategyToActive = async (strategyId) => {
  const strategyToMove = strategyBank.find((s) => s.id === strategyId);
  if (!strategyToMove) return;

  const { data, error } = await supabase
    .from("saved_strategies")
    .update({
      location: "active",
      updated_at: new Date().toISOString(),
    })
    .eq("id", strategyId)
    .select("id, name, positions, notes, rebalance, location, created_at, updated_at")
    .single();

  if (error) {
    console.error("Failed to move strategy to active:", error);
    setBacktestError("Failed to move strategy.");
    return;
  }

  setActiveStrategies((prev) => {
    const alreadyActive = prev.some((s) => s.id === data.id);
    if (alreadyActive) return prev;

    return [
      ...prev,
      {
        id: data.id,
        name: data.name,
        positions: data.positions,
        location: "active",
      },
    ];
  });

  setStrategyBank((prev) => prev.filter((s) => s.id !== strategyId));
  setOpenStrategyMenu(null);
};

const deleteStrategyFromBank = async (strategyId) => {
  if (!strategyId || !userId) return;

  const { error } = await supabase
    .from("saved_strategies")
    .delete()
    .eq("id", strategyId)
    .eq("user_id", userId);

  if (error) {
    console.error("Failed to delete strategy:", error);
    setBacktestError("Failed to delete strategy.");
    return;
  }

  setStrategyBank((prev) => prev.filter((s) => s.id !== strategyId));

  if (selectedStrategyId === strategyId) {
    setSelectedStrategyId(null);
    setSelectedStrategyName("Custom / Unsaved Strategy");
    setPositions([{ ticker: "", weight: 0 }]);
    setBacktest(null);
    setHoldingAttribution(null);
    setStrategyExplanation(null);
  }

  setOpenStrategyMenu(null);
};

const deleteStrategyEverywhere = async (strategyId) => {
  if (!strategyId || !userId) return;

  const { error } = await supabase
    .from("saved_strategies")
    .delete()
    .eq("id", strategyId)
    .eq("user_id", userId);

  if (error) {
    console.error("Failed to delete strategy:", error);
    setBacktestError("Failed to delete strategy.");
    return;
  }

  setActiveStrategies((prev) => prev.filter((s) => s.id !== strategyId));
  setStrategyBank((prev) => prev.filter((s) => s.id !== strategyId));

  if (selectedStrategyId === strategyId) {
    const nextActive = activeStrategies.find((s) => s.id !== strategyId);

    if (nextActive) {
      setSelectedStrategyId(nextActive.id);
      setSelectedStrategyName(nextActive.name);
      setPositions(nextActive.positions);
    } else {
      setSelectedStrategyId(null);
      setSelectedStrategyName("Custom / Unsaved Strategy");
      setPositions([{ ticker: "", weight: 0 }]);
      setBacktest(null);
      setHoldingAttribution(null);
      setStrategyExplanation(null);
    }
  }

  setOpenStrategyMenu(null);
};

const editStrategyFromBank = (strategyId) => {
  const strategyToEdit = strategyBank.find((s) => s.id === strategyId);
  if (!strategyToEdit) return;

  setCustomStrategyName(strategyToEdit.name);
setCustomStrategyNotes(strategyToEdit.notes || "");
setCustomStrategyRebalance(strategyToEdit.rebalance || "Never");

setBuilderPositions(
  strategyToEdit.positions.map((p) => ({
    ticker: p.ticker,
    weight: p.weight,
  }))
);

  setEditingStrategyName(strategyId);
  setOpenStrategyMenu(null);
};

const cloneStrategyFromBank = (strategyId) => {
  const strategyToClone = strategyBank.find((s) => s.id === strategyId);
  if (!strategyToClone) return;

  setCustomStrategyName(`${strategyToClone.name} Copy`);
setCustomStrategyNotes(strategyToClone.notes || "");
setCustomStrategyRebalance(strategyToClone.rebalance || "Never");

setBuilderPositions(
  strategyToClone.positions.map((p) => ({
    ticker: p.ticker,
    weight: p.weight,
  }))
);

  setEditingStrategyName(null);
  setOpenStrategyMenu(null);
};

const saveCurrentStrategy = async () => {
  const cleanName = customStrategyName.trim();
  const cleanNotes = customStrategyNotes.trim();
const cleanRebalance = customStrategyRebalance || "Never";

  if (!cleanName) {
    setBacktestError("Name your strategy before saving it.");
    return;
  }

  if (!userId) {
    setBacktestError("You must be logged in to save strategies.");
    return;
  }

  const cleanPositions = builderPositions
    .filter((p) => p.ticker.trim() && Number(p.weight) !== 0)
    .map((p) => ({
      ticker: p.ticker.trim().toUpperCase(),
      weight: Number(p.weight),
    }));

if (!cleanPositions.length) {
  setBacktestError("Add at least one ticker before saving a strategy.");
  return;
}

const duplicateName = strategyBank.some(
  (strategy) =>
    strategy.name.toLowerCase() === cleanName.toLowerCase() &&
    strategy.id !== editingStrategyName
);

const duplicateActiveName = activeStrategies.some(
  (strategy) =>
    strategy.name.toLowerCase() === cleanName.toLowerCase() &&
    strategy.id !== editingStrategyName
);

if (duplicateName || duplicateActiveName) {
  setBacktestError("A strategy with this name already exists. Use Clone or choose a new name.");
  return;
}

if (editingStrategyName) {
    const { data, error } = await supabase
      .from("saved_strategies")
      .update({
  name: cleanName,
  positions: cleanPositions,
  notes: cleanNotes,
  rebalance: cleanRebalance,
  updated_at: new Date().toISOString(),
})
      .eq("id", editingStrategyName)
      .select("id, name, positions, notes, rebalance, location, created_at, updated_at")
      .single();

    if (error) {
      console.error("Failed to update strategy:", error);
      setBacktestError("Failed to update strategy.");
      return;
    }

    setStrategyBank((prev) =>
      prev.map((strategy) => (strategy.id === editingStrategyName ? data : strategy))
    );
  } else {
    const { data, error } = await supabase
      .from("saved_strategies")
      .insert({
  user_id: userId,
  name: cleanName,
  positions: cleanPositions,
  notes: cleanNotes,
  rebalance: cleanRebalance,
  location: "bank",
})
      .select("id, name, positions, notes, rebalance, location, created_at, updated_at")
      .single();

    if (error) {
      console.error("Failed to save strategy:", error);
      setBacktestError("Failed to save strategy.");
      return;
    }

    setStrategyBank((prev) => [data, ...prev]);
  }

  setCustomStrategyName("");
setCustomStrategyNotes("");
setCustomStrategyRebalance("Never");
setBuilderPositions([{ ticker: "", weight: 0 }]);
setEditingStrategyName(null);
setBacktestError("");
};

  const runBacktest = async () => {
    try {
      setLoading(true);
      setHoverIndex(null);
      setBacktestError("");
      setHoldingAttribution(null);

      const cleanPositions = positions
        .filter((p) => p.ticker.trim() && Number(p.weight) !== 0)
        .map((p) => ({
          ticker: p.ticker.trim().toUpperCase(),
          weight: Number(p.weight),
        }));

      if (!cleanPositions.length) {
        setBacktest(null);
        setBacktestError("Add at least one ticker before running a backtest.");
        return;
      }

      if (mode === "portfolio") {
        const grossAllocation = cleanPositions.reduce(
          (sum, p) => sum + Math.abs(Number(p.weight) || 0),
          0
        );

        const roundedGrossAllocation = Math.round(grossAllocation * 100) / 100;

        if (Math.abs(grossAllocation - 100) > 0.01) {
          setBacktest(null);
          setHoldingAttribution(null);
          setHasRunBacktest(false);
          setBacktestError(
            `Portfolio Mode requires 100% total allocation. Current allocation is ${roundedGrossAllocation}%. Adjust weights or switch to Strategy Mode.`
          );
          return;
        }
      }

      const res = await fetch(`${API_BASE}/backtest-strategy`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          benchmark,
          range,
          positions: cleanPositions,
        }),
      });

      const data = await res.json();

      if (!res.ok || data.error || data.detail) {
        const message = data.detail || data.error || "Backtest failed.";
        console.error("Backtest error:", data);
        setBacktest(null);
        setBacktestError(message);
        return;
      }

      setBacktest(data);
      setHoldingAttribution(data.holdingAttribution || null);
      setHasRunBacktest(true);
    } catch (err) {
      console.error("Failed to run backtest", err);
      setBacktest(null);
      setBacktestError("Failed to connect to the backtest server.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
  if (!hasRunBacktest) return;

  const timer = setTimeout(() => {
    runBacktest();
  }, 150);

  return () => clearTimeout(timer);
}, [range]);

  const handleMouseMove = (e) => {
  if (!points.length) return;

  const rect = e.currentTarget.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const chartLeftPadding = 18;
  const chartRightPadding = 64;
  const usableWidth = rect.width - chartLeftPadding - chartRightPadding;
  const adjustedX = x - chartLeftPadding;
  const ratio = adjustedX / usableWidth;
  const index = Math.round(Math.max(0, Math.min(1, ratio)) * (points.length - 1));

  setHoverIndex(Math.max(0, Math.min(index, points.length - 1)));
};

const runStressTest = (stressTest) => {
  const cleanPositions = positions
    .filter((p) => p.ticker.trim() && Number(p.weight) !== 0)
    .map((p) => ({
      ticker: p.ticker.trim().toUpperCase(),
      weight: Number(p.weight),
    }));

  if (!cleanPositions.length) {
    setBacktestError("Add at least one ticker before running a stress test.");
    return;
  }

  const rows = cleanPositions.map((position) => {
    const shock =
      stressTest.shocks[position.ticker] !== undefined
        ? stressTest.shocks[position.ticker]
        : stressTest.defaultShock;

    const impact = (position.weight / 100) * shock;

    return {
      ticker: position.ticker,
      weight: position.weight,
      shock,
      impact,
    };
  });

  const estimatedReturn = rows.reduce((sum, row) => sum + row.impact, 0);

  const bestImpact = [...rows].sort((a, b) => b.impact - a.impact)[0] || null;
  const worstImpact = [...rows].sort((a, b) => a.impact - b.impact)[0] || null;

  setStressResult({
  id: stressTest.id,
  label: stressTest.label,
  description: stressTest.description,
  dependencyDriver: stressTest.dependencyDriver,
  estimatedReturn,
  bestImpact,
  worstImpact,
  rows,
});

  setBacktestError("");
};

const handleStressTestClick = (test) => {
  const isSameTest = stressResult?.id === test.id;

  runStressTest(test);

  setShowStressDetails((prev) => {
    if (isSameTest) return !prev;
    return true;
  });
};

const benchmarkDisplayedReturn =
  backtestPoints.length > 0
    ? benchmarkReturn
    : points.length >= 2
    ? ((points[points.length - 1].benchmark - points[0].benchmark) /
        points[0].benchmark) *
      100
    : 0;

  return (
    <div style={{ color: "white" }}>
      <div style={{ marginBottom: "24px" }}>
        <h1 style={{ fontSize: "32px", marginBottom: "8px" }}>
          Build and Test Your Own Strategies
        </h1>
        <p style={{ color: "#9ca3af", fontSize: "16px" }}>
          Build custom long and short strategies and compare them to the market
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "390px minmax(0, 1fr)",
          gap: "22px",
          alignItems: "start",
        }}
      >
        <div
          style={{
            background: "rgba(255,255,255,0.035)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: "18px",
            padding: "20px",
          }}
        >
          <h2 style={{ marginTop: 0 }}>Strategy Builder</h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "8px",
              marginBottom: "14px",
            }}
          >
            <button
              onClick={() => setMode("portfolio")}
              style={{
                padding: "10px",
                borderRadius: "12px",
                cursor: "pointer",
                fontWeight: 900,
                border:
                  mode === "portfolio"
                    ? "1px solid rgba(25,195,125,0.75)"
                    : "1px solid rgba(255,255,255,0.12)",
                background:
                  mode === "portfolio"
                    ? "rgba(25,195,125,0.18)"
                    : "rgba(255,255,255,0.06)",
                color: mode === "portfolio" ? "#19C37D" : "#e5e7eb",
              }}
            >
              Portfolio Mode
            </button>

            <button
              onClick={() => setMode("strategy")}
              style={{
                padding: "10px",
                borderRadius: "12px",
                cursor: "pointer",
                fontWeight: 900,
                border:
                  mode === "strategy"
                    ? "1px solid rgba(25,195,125,0.75)"
                    : "1px solid rgba(255,255,255,0.12)",
                background:
                  mode === "strategy"
                    ? "rgba(25,195,125,0.18)"
                    : "rgba(255,255,255,0.06)",
                color: mode === "strategy" ? "#19C37D" : "#e5e7eb",
              }}
            >
              Strategy Mode
            </button>
          </div>

          <div
            style={{
              marginBottom: "16px",
              padding: "10px 12px",
              borderRadius: "12px",
              background: "rgba(15,23,42,0.72)",
              border: "1px solid rgba(255,255,255,0.08)",
              color: "#cbd5e1",
              fontSize: "13px",
              fontWeight: 800,
              lineHeight: 1.6,
            }}
          >
            Long: {exposureStats.longExposure.toFixed(0)}% | Short:{" "}
            {exposureStats.shortExposure.toFixed(0)}% | Net:{" "}
            {exposureStats.netExposure.toFixed(0)}%
            <div style={{ color: "#94a3b8", fontSize: "12px", fontWeight: 700 }}>
              {mode === "portfolio"
                ? "Portfolio Mode normalizes long positions to 100% and ignores shorts."
                : "Strategy Mode uses raw exposure and allows shorts or leverage."}
            </div>
          </div>

            {riskWarnings.length > 0 && (
  <div
    style={{
      marginBottom: "16px",
      padding: "10px 12px",
      borderRadius: "12px",
      background: "rgba(245,158,11,0.08)",
      border: "1px solid rgba(245,158,11,0.22)",
    }}
  >
    <div
      style={{
        color: "#facc15",
        fontSize: "12px",
        fontWeight: 950,
        marginBottom: "7px",
        letterSpacing: "0.3px",
        textTransform: "uppercase",
      }}
    >
      Strategy Risk Notes
    </div>

    <div style={{ display: "grid", gap: "6px" }}>
      {riskWarnings.map((warning) => (
        <div
          key={warning}
          style={{
            color: "#fde68a",
            fontSize: "12px",
            fontWeight: 750,
            lineHeight: 1.45,
          }}
        >
          • {warning}
        </div>
      ))}
    </div>
  </div>
)}


<div
  style={{
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
    marginBottom: "14px",
  }}
>
  {activeStrategies.map((strategy) => {
    const isSelected = selectedStrategyId === strategy.id;

    return (
      <div
        key={strategy.id}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          width: "fit-content",
          maxWidth: "100%",
          background: isSelected
            ? "rgba(25,195,125,0.24)"
            : "rgba(25,195,125,0.12)",
          border: isSelected
            ? "1px solid rgba(25,195,125,0.9)"
            : "1px solid rgba(25,195,125,0.35)",
          boxShadow: isSelected
            ? "0 0 18px rgba(25,195,125,0.32)"
            : "none",
          borderRadius: "999px",
          padding: "4px 6px 4px 12px",
        }}
      >
      <button
        onClick={() => {
          setPositions(strategy.positions);
          setSelectedStrategyId(strategy.id);
          setSelectedStrategyName(strategy.name);
          setStrategyExplanation(null);
          setHoldingAttribution(null);
          setStressResult(null);
        }}
        style={{
          background: "transparent",
          color: "#19C37D",
          border: "none",
          cursor: "pointer",
          fontWeight: 800,
          fontSize: "12px",
          padding: "4px 2px",
        }}
      >
        {strategy.name}
      </button>

      {selectedStrategyId === strategy.id && (
        <span
          style={{
            fontSize: "10px",
            fontWeight: 950,
            color: "#001f3f",
            background: "#19C37D",
            borderRadius: "999px",
            padding: "3px 7px",
            letterSpacing: "0.3px",
          }}
        >
          SELECTED
        </span>
      )}

      <button
        onClick={() => moveStrategyToBank(strategy.id)}
        style={{
          width: "22px",
          height: "22px",
          borderRadius: "50%",
          background: "rgba(148,163,184,0.12)",
          color: "#94a3b8",
          border: "1px solid rgba(148,163,184,0.3)",
          cursor: "pointer",
          fontWeight: 900,
        }}
      >
        ×
      </button>
    </div>
    );
  })}
</div>

<label style={{ color: "#94a3b8", fontSize: "13px" }}>Benchmark</label>
          <input
            value={benchmark}
            onChange={(e) => setBenchmark(e.target.value.toUpperCase())}
            style={{
              width: "calc(100% - 20px)",
              marginTop: "6px",
              marginBottom: "16px",
              padding: "10px",
              borderRadius: "10px",
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(15,23,42,0.9)",
              color: "white",
              fontWeight: 800,
            }}
          />

          {positions.map((position, index) => (
            <div
              key={index}
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0, 1fr) 72px 34px",
                gap: "8px",
                marginBottom: "9px",
              }}
            >
              <input
                placeholder="Ticker"
                value={position.ticker}
                onChange={(e) => updatePosition(index, "ticker", e.target.value)}
                style={{
                  minWidth: 0,
                  padding: "10px",
                  borderRadius: "10px",
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: "rgba(15,23,42,0.9)",
                  color: "white",
                  fontWeight: 800,
                }}
              />

              <input
                type="number"
                placeholder="Weight"
                value={position.weight}
                onChange={(e) => updatePosition(index, "weight", e.target.value)}
                style={{
                  padding: "10px",
                  borderRadius: "10px",
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: "rgba(15,23,42,0.9)",
                  color: "white",
                  fontWeight: 800,
                }}
              />

              <button
                onClick={() => removePosition(index)}
                style={{
                  borderRadius: "10px",
                  border: "1px solid rgba(148,163,184,0.3)",
                  background: "rgba(148,163,184,0.12)",
                  color: "#94a3b8",
                  cursor: "pointer",
                  fontWeight: 900,
                }}
              >
                ×
              </button>
            </div>
          ))}

          <button
            onClick={addPosition}
            style={{
              width: "100%",
              marginTop: "8px",
              padding: "10px",
              borderRadius: "12px",
              background: "rgba(255,255,255,0.06)",
              color: "#e5e7eb",
              border: "1px solid rgba(255,255,255,0.12)",
              cursor: "pointer",
              fontWeight: 800,
            }}
          >
            + Add Position
          </button>
{mode === "portfolio" && Math.abs(exposureStats.grossExposure - 100) > 0.01 && (
  <div
    style={{
      background: "rgba(239, 68, 68, 0.12)",
      border: "1px solid rgba(239, 68, 68, 0.35)",
      color: "#fecaca",
      borderRadius: "10px",
      padding: "10px 12px",
      fontSize: "13px",
      fontWeight: 700,
      marginBottom: "10px",
    }}
  >
    Portfolio Mode requires 100% total allocation. Current allocation is{" "}
    {exposureStats.grossExposure.toFixed(2)}%. Adjust weights or switch to
    Strategy Mode.
  </div>
)}
          <button
            onClick={runBacktest}
            disabled={loading}
            style={{
              width: "100%",
              marginTop: "12px",
              padding: "12px",
              borderRadius: "12px",
              background: "#19C37D",
              color: "#001f3f",
              border: "none",
              cursor: "pointer",
              fontWeight: 900,
              fontSize: "15px",
            }}
          >
            {loading ? "Running..." : "Run Backtest"}
          </button>
          <button
  onClick={explainCurrentStrategy}
  style={{
    width: "100%",
    marginTop: "10px",
    padding: "11px",
    borderRadius: "12px",
    background: "rgba(96,165,250,0.13)",
    color: "#93c5fd",
    border: "1px solid rgba(96,165,250,0.32)",
    cursor: "pointer",
    fontWeight: 900,
    fontSize: "14px",
  }}
>
  {strategyExplanation ? "Hide Explanation" : "Explain This Strategy"}
</button>
{strategyExplanation && (
  <div
    style={{
      marginTop: "14px",
      padding: "12px",
      borderRadius: "14px",
      background: "rgba(96,165,250,0.08)",
      border: "1px solid rgba(96,165,250,0.22)",
    }}
  >
    <div
      style={{
        color: "#93c5fd",
        fontSize: "12px",
        fontWeight: 950,
        marginBottom: "7px",
        textTransform: "uppercase",
        letterSpacing: "0.3px",
      }}
    >
      Bullionaire Explanation
    </div>

    <div
      style={{
        color: "#e5e7eb",
        fontSize: "13px",
        fontWeight: 800,
        lineHeight: 1.5,
        marginBottom: "9px",
      }}
    >
      {strategyExplanation.thesis}
    </div>

    <div
      style={{
        color: "#94a3b8",
        fontSize: "12px",
        fontWeight: 750,
        lineHeight: 1.55,
      }}
    >
      <div>
        <strong style={{ color: "#cbd5e1" }}>Long side:</strong>{" "}
        {strategyExplanation.longText}
      </div>
      <div>
        <strong style={{ color: "#cbd5e1" }}>Short side:</strong>{" "}
        {strategyExplanation.shortText}
      </div>
      <div>
        <strong style={{ color: "#cbd5e1" }}>Exposure:</strong>{" "}
        {strategyExplanation.totalLong.toFixed(0)}% long /{" "}
        {strategyExplanation.totalShort.toFixed(0)}% short /{" "}
        {strategyExplanation.grossExposure.toFixed(0)}% gross
      </div>
    </div>

    {strategyExplanation.tags.length > 0 && (
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "6px",
          marginTop: "10px",
        }}
      >
        {strategyExplanation.tags.map((tag) => (
          <span
            key={tag}
            style={{
              padding: "4px 7px",
              borderRadius: "999px",
              background: "rgba(96,165,250,0.12)",
              border: "1px solid rgba(96,165,250,0.28)",
              color: "#93c5fd",
              fontSize: "11px",
              fontWeight: 850,
            }}
          >
            {tag}
          </span>
        ))}
      </div>
    )}

    {strategyExplanation.warnings.length > 0 && (
      <div
        style={{
          marginTop: "10px",
          color: "#fde68a",
          fontSize: "12px",
          fontWeight: 750,
          lineHeight: 1.45,
        }}
      >
        {strategyExplanation.warnings[0]}
      </div>
    )}
  </div>
)}
        </div>

        <div
          style={{
            background: "rgba(255,255,255,0.035)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: "18px",
            padding: "24px",
            boxShadow: "0 0 45px rgba(0,0,0,0.36)",
          }}
        >
          <div>
            <h2 style={{ margin: "0 0 4px 0", fontSize: "26px" }}>
              Strategy vs {benchmark}
            </h2>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "auto auto 1fr",
                alignItems: "center",
                gap: "22px",
                marginTop: "-10px",
              }}
            >
              <p style={{ margin: 0, color: "#9ca3af", fontSize: "16px" }}>
                Price performance over selected range.
              </p>

              <div
                style={{
                  color: benchmarkDisplayedReturn >= 0 ? "#19C37D" : "#ef4444",
                  fontSize: "30px",
                  fontWeight: 950,
                  lineHeight: 1,
                }}
              >
                {formatPercent(benchmarkDisplayedReturn)}
              </div>

              <div
                style={{
                  justifySelf: "center",
                  padding: "18px 32px",
                  borderRadius: "18px",
                  background:
                    outperformance > 0
                      ? "rgba(25,195,125,0.18)"
                      : outperformance < 0
                      ? "rgba(239,68,68,0.18)"
                      : "rgba(148,163,184,0.14)",
                  border:
                    outperformance > 0
                      ? "1px solid rgba(25,195,125,0.45)"
                      : outperformance < 0
                      ? "1px solid rgba(239,68,68,0.45)"
                      : "1px solid rgba(148,163,184,0.35)",
                  fontSize: "20px",
                  fontWeight: 950,
                  color:
                    outperformance > 0
                      ? "#19C37D"
                      : outperformance < 0
                      ? "#ef4444"
                      : "#cbd5f5",
                  whiteSpace: "nowrap",
                  minWidth: "200px",
                  textAlign: "center",
                }}
              >
                {outperformance > 0
                  ? "Outperforming"
                  : outperformance < 0
                  ? "Underperforming"
                  : "In Line"}
              </div>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                flexWrap: "wrap",
                marginTop: "0px",
              }}
            >
              {RANGES.map((r) => (
                <button
                  key={r}
                  onClick={() => setRange(r)}
                  style={{
                    background: range === r ? "#19C37D" : "rgba(255,255,255,0.06)",
                    color: range === r ? "#001f3f" : "#e5e7eb",
                    border: "1px solid rgba(255,255,255,0.12)",
                    borderRadius: "999px",
                    padding: "8px 18px",
                    cursor: "pointer",
                    fontWeight: 800,
                  }}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(5, 1fr)",
              gap: "10px",
              margin: "22px 0",
            }}
          >
            {[
              ["Strategy", strategyReturn],
              [benchmark, benchmarkDisplayedReturn],
              ["Outperformance", outperformance],
              ["Max Drawdown", maxDrawdown],
              ["Volatility", volatility],
            ].map(([label, value]) => (
              <div
                key={label}
                style={{
                  background: "rgba(15,23,42,0.72)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: "14px",
                  padding: "12px",
                }}
              >
                <div style={{ color: "#94a3b8", fontSize: "12px", marginBottom: "6px" }}>
                  {label}
                </div>
                <div
                  style={{
                    color: value >= 0 ? "#19C37D" : "#ef4444",
                    fontSize: "18px",
                    fontWeight: 900,
                  }}
                >
                  {formatPercent(value)}
                </div>
              </div>
            ))}
          </div>

          <div
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setHoverIndex(null)}
            style={{
              height: "360px",
              borderRadius: "14px",
              background:
                "linear-gradient(180deg, rgba(15,23,42,0.95), rgba(3,7,18,0.9))",
              padding: "18px 64px 18px 18px",
              position: "relative",
              overflow: "hidden",
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            {loading ? (
              <div style={{ color: "#9ca3af" }}>Running backtest...</div>
            ) : backtestError ? (
              <div style={{ color: "#ef4444", fontWeight: 800 }}>
                {backtestError}
              </div>
            ) : benchmarkLoading && !benchmarkSvgPoints ? (
              <div
                style={{
                  color: "#9ca3af",
                  fontSize: "15px",
                  fontWeight: 700,
                }}
              >
                Loading {benchmark || "SPY"} benchmark line...
              </div>
            ) : benchmarkSvgPoints ? (
              <>
                <svg
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                  style={{ width: "100%", height: "100%" }}
                >
                  {priceTicks.map((tick) => (
                    <line
                      key={tick.value}
                      x1="0"
                      x2="100"
                      y1={tick.y}
                      y2={tick.y}
                      stroke="rgba(255,255,255,0.08)"
                      strokeWidth="1"
                      vectorEffect="non-scaling-stroke"
                    />
                  ))}

                  <defs>
                    <linearGradient id="benchmarkFill" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor={chartLineColor} stopOpacity="0.28" />
                      <stop offset="100%" stopColor={chartLineColor} stopOpacity="0" />
                    </linearGradient>
                  </defs>

                  <polygon
                    fill="url(#benchmarkFill)"
                    points={`0,100 ${benchmarkSvgPoints} 100,100`}
                  />

                  <polyline
                    fill="none"
                    stroke={chartLineColor}
                    strokeWidth="2.6"
                    points={benchmarkSvgPoints}
                    vectorEffect="non-scaling-stroke"
                  />

                  {strategySvgPoints && (
                    <polyline
                      fill="none"
                      stroke="#60a5fa"
                      strokeWidth="3"
                      strokeDasharray="6 6"
                      style={{ filter: "drop-shadow(0 0 6px rgba(96,165,250,0.5))" }}
                      points={strategySvgPoints}
                      vectorEffect="non-scaling-stroke"
                    />
                  )}

                  {hoverIndex !== null && activePoint && (
                    <line
                      x1={activeX}
                      x2={activeX}
                      y1="0"
                      y2="100"
                      stroke="rgba(255,255,255,0.32)"
                      strokeWidth="1"
                      vectorEffect="non-scaling-stroke"
                    />
                  )}
                </svg>

                {priceTicks.map((tick) => (
                  <div
                    key={tick.value}
                    style={{
                      position: "absolute",
                      right: "16px",
                      top: `${tick.y}%`,
                      marginTop: "18px",
                      transform: "translateY(-50%)",
                      color: "#94a3b8",
                      fontSize: "13px",
                      fontWeight: 700,
                      pointerEvents: "none",
                    }}
                  >
                    {formatChartValue(tick.value)}
                  </div>
                ))}

                {hoverIndex !== null && activePoint && (
                  <div
                    style={{
                      position: "absolute",
                      left: `${Math.min(Math.max(activeX, 12), 78)}%`,
                      top: `${Math.min(Math.max(activeTooltipY, 12), 74)}%`,
                      transform: "translate(12px, -50%)",
                      background: "rgba(2,6,23,0.94)",
                      border: "1px solid rgba(255,255,255,0.14)",
                      borderRadius: "10px",
                      padding: "10px 12px",
                      boxShadow: "0 12px 30px rgba(0,0,0,0.45)",
                      pointerEvents: "none",
                      minWidth: "170px",
                      zIndex: 5,
                    }}
                  >
                    <div style={{ fontSize: "12px", color: "#94a3b8", marginBottom: "6px" }}>
                      {formatDate(activePoint.time)}
                    </div>

                    {activePoint.strategy !== undefined && (
                      <div style={{ fontSize: "14px", fontWeight: 900, color: "#60a5fa" }}>
                        Strategy: {formatChartValue(activePoint.strategy)}
                      </div>
                    )}

                    <div style={{ fontSize: "14px", fontWeight: 900, color: chartLineColor }}>
                      {benchmark}: {formatChartValue(activePoint.benchmark)}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div style={{ color: "#9ca3af" }}>
                Benchmark chart unavailable. Try refreshing or changing the range.
              </div>
            )}
          </div>

          <div
  style={{
    marginTop: "18px",
    padding: "16px",
    borderRadius: "18px",
    background: "rgba(255,255,255,0.035)",
    border: "1px solid rgba(255,255,255,0.08)",
  }}
>
<div
  style={{
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "12px",
  }}
>
  <div>
    <h3 style={{ margin: 0, fontSize: "18px" }}>Stress Tests</h3>

    <p style={{ margin: "6px 0 0", color: "#9ca3af", fontSize: "13px" }}>
      Estimate how your current strategy could react to macro shocks.
    </p>

    <p
      style={{
        margin: "5px 0 0",
        color: "#64748b",
        fontSize: "12px",
        fontWeight: 750,
      }}
    >
      Click a scenario to run it. Click the selected scenario again to show or hide details.
    </p>
  </div>
</div>

  <div
    style={{
      display: "flex",
      flexWrap: "wrap",
      gap: "8px",
      marginTop: "14px",
    }}
  >
    {STRESS_TESTS.map((test) => {
  const isSelectedStressTest = stressResult?.id === test.id;

  return (
    <button
      key={test.id}
      onClick={() => handleStressTestClick(test)}
      title={
        isSelectedStressTest
          ? "Click again to show or hide details"
          : "Run this stress test"
      }
        style={{
  padding: "10px 12px",
  borderRadius: "12px",
  background: isSelectedStressTest
    ? "rgba(96,165,250,0.20)"
    : "rgba(255,255,255,0.06)",
  color: isSelectedStressTest ? "#93c5fd" : "#e5e7eb",
  border: isSelectedStressTest
    ? "1px solid rgba(96,165,250,0.48)"
    : "1px solid rgba(255,255,255,0.12)",
  cursor: "pointer",
  fontWeight: 900,
  boxShadow: isSelectedStressTest
    ? "0 0 16px rgba(96,165,250,0.22)"
    : "none",
}}
      >
        {test.label}
{isSelectedStressTest && (
  <span style={{ marginLeft: "6px", fontSize: "11px", color: "#bfdbfe" }}>
    {showStressDetails ? "▲" : "▼"}
  </span>
)}
      </button>
    );
  })}
  </div>

  {stressResult && showStressDetails && (
  <div
    style={{
      marginTop: "14px",
      padding: "14px",
      borderRadius: "14px",
      background:
        stressResult.estimatedReturn >= 0
          ? "rgba(25,195,125,0.09)"
          : "rgba(239,68,68,0.09)",
      border:
        stressResult.estimatedReturn >= 0
          ? "1px solid rgba(25,195,125,0.22)"
          : "1px solid rgba(239,68,68,0.22)",
    }}
  >
      <div style={{ color: "#e5e7eb", fontWeight: 950 }}>
        {stressResult.label}:{" "}
        <span
          style={{
            color: stressResult.estimatedReturn >= 0 ? "#19C37D" : "#f87171",
          }}
        >
          {formatPercent(stressResult.estimatedReturn)}
        </span>
      </div>

      <div style={{ color: "#9ca3af", fontSize: "13px", marginTop: "4px" }}>
        {stressResult.description}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "10px",
          marginTop: "12px",
        }}
      >
        <div>
          <div style={{ color: "#94a3b8", fontSize: "12px", fontWeight: 850 }}>
            Best Impact
          </div>
          <div style={{ color: "#e5e7eb", fontWeight: 950 }}>
            {stressResult.bestImpact
              ? `${stressResult.bestImpact.ticker} ${formatPercent(
                  stressResult.bestImpact.impact
                )}`
              : "--"}
          </div>
        </div>

        <div>
          <div style={{ color: "#94a3b8", fontSize: "12px", fontWeight: 850 }}>
            Worst Impact
          </div>
          <div style={{ color: "#e5e7eb", fontWeight: 950 }}>
            {stressResult.worstImpact
              ? `${stressResult.worstImpact.ticker} ${formatPercent(
                  stressResult.worstImpact.impact
                )}`
              : "--"}
          </div>
        </div>
      </div>
    </div>
  )}

            {holdingAttribution && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: "10px",
                margin: "18px 0 18px 0",
              }}
            >
              {[
                {
                  label: "Best Contributor",
                  item: holdingAttribution.bestContributor,
                  valueKey: "contribution",
                },
                {
                  label: "Worst Contributor",
                  item: holdingAttribution.worstContributor,
                  valueKey: "contribution",
                },
                {
                  label: "Most Volatile",
                  item: holdingAttribution.mostVolatile,
                  valueKey: "volatility",
                },
              ].map(({ label, item, valueKey }) => (
                <div
                  key={label}
                  style={{
                    background: "rgba(15,23,42,0.72)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: "14px",
                    padding: "12px",
                  }}
                >
                  <div
                    style={{
                      color: "#94a3b8",
                      fontSize: "12px",
                      fontWeight: 850,
                      marginBottom: "6px",
                    }}
                  >
                    {label}
                  </div>

                  <div
                    style={{
                      color: "#e5e7eb",
                      fontSize: "18px",
                      fontWeight: 950,
                      marginBottom: "4px",
                    }}
                  >
                    {item?.ticker || "--"}
                  </div>

                  <div
                    style={{
                      color:
                        valueKey === "volatility"
                          ? "#facc15"
                          : item?.[valueKey] >= 0
                          ? "#19C37D"
                          : "#ef4444",
                      fontSize: "15px",
                      fontWeight: 900,
                    }}
                  >
                    {item ? formatPercent(item[valueKey]) : "--"}
                  </div>

                  {item && (
                    <div
                      style={{
                        color: "#64748b",
                        fontSize: "11px",
                        fontWeight: 750,
                        marginTop: "5px",
                      }}
                    >
                      Weight: {item.weight}% | Return:{" "}
                      {formatPercent(item.holdingReturn)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <div
            style={{
              margin: "22px 0 12px 0",
              padding: "18px",
              borderRadius: "18px",
              background:
                strategyScore.score === null
                  ? "rgba(15,23,42,0.72)"
                  : strategyScore.score >= 72
                  ? "rgba(25,195,125,0.13)"
                  : strategyScore.score >= 58
                  ? "rgba(245,158,11,0.12)"
                  : "rgba(239,68,68,0.11)",
              border:
                strategyScore.score === null
                  ? "1px solid rgba(255,255,255,0.08)"
                  : strategyScore.score >= 72
                  ? "1px solid rgba(25,195,125,0.35)"
                  : strategyScore.score >= 58
                  ? "1px solid rgba(245,158,11,0.35)"
                  : "1px solid rgba(239,68,68,0.32)",
              display: "grid",
              gridTemplateColumns: "160px 1fr",
              gap: "18px",
              alignItems: "center",
            }}
          >
            <div
              style={{
                width: "132px",
                height: "132px",
                borderRadius: "50%",
                display: "grid",
                placeItems: "center",
                background: "rgba(2,6,23,0.78)",
                border: "1px solid rgba(255,255,255,0.1)",
                boxShadow:
                  strategyScore.score !== null
                    ? "0 0 28px rgba(25,195,125,0.16)"
                    : "none",
              }}
            >
              <div style={{ textAlign: "center" }}>
                <div
                  style={{
                    fontSize: "34px",
                    fontWeight: 950,
                    color:
                      strategyScore.score === null
                        ? "#94a3b8"
                        : strategyScore.score >= 72
                        ? "#19C37D"
                        : strategyScore.score >= 58
                        ? "#f59e0b"
                        : "#ef4444",
                    lineHeight: 1,
                  }}
                >
                  {strategyScore.score === null ? "--" : strategyScore.score}
                </div>

                <div
                  style={{
                    color: "#94a3b8",
                    fontSize: "12px",
                    fontWeight: 850,
                    marginTop: "5px",
                  }}
                >
                  / 100
                </div>
              </div>
            </div>

            <div>
  <div
  onClick={() => setShowBullionaireScore((prev) => !prev)}
  style={{
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
    marginBottom: "6px",
    cursor: "pointer",
    userSelect: "none",
  }}
>
    <div
      style={{
        color: "#94a3b8",
        fontSize: "12px",
        fontWeight: 900,
        letterSpacing: "0.4px",
        textTransform: "uppercase",
      }}
    >
      Bullionaire Score
    </div>

    <button
  onClick={(e) => {
    e.stopPropagation();
    setShowBullionaireScore((prev) => !prev);
  }}
      style={{
        padding: "5px 9px",
        borderRadius: "999px",
        border: "1px solid rgba(148,163,184,0.28)",
        background: "rgba(148,163,184,0.10)",
        color: "#94a3b8",
        cursor: "pointer",
        fontSize: "11px",
        fontWeight: 900,
      }}
    >
      {showBullionaireScore ? "Hide" : "Show"}
    </button>
  </div>

              {showBullionaireScore ? (
  <>
    <div
      style={{
        fontSize: "26px",
        fontWeight: 950,
        color:
          strategyScore.score === null
            ? "#e5e7eb"
            : strategyScore.score >= 72
            ? "#19C37D"
            : strategyScore.score >= 58
            ? "#f59e0b"
            : "#ef4444",
        marginBottom: "8px",
      }}
    >
      {strategyScore.label}
    </div>

    <div
      style={{
        color: "#cbd5e1",
        fontSize: "14px",
        lineHeight: 1.55,
        maxWidth: "680px",
      }}
    >
      {strategyScore.description}
    </div>

    <div
      style={{
        display: "flex",
        gap: "8px",
        flexWrap: "wrap",
        marginTop: "14px",
      }}
    >
      {[
        "Return",
        "Outperformance",
        "Time Above Benchmark",
        "Drawdown",
        "Volatility",
        "Risk/Reward",
      ].map((item) => (
        <span
          key={item}
          style={{
            padding: "6px 9px",
            borderRadius: "999px",
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.1)",
            color: "#94a3b8",
            fontSize: "12px",
            fontWeight: 800,
          }}
        >
          {item}
        </span>
      ))}
    </div>
  </>
) : (
  <div
    style={{
      color: "#94a3b8",
      fontSize: "13px",
      fontWeight: 800,
      lineHeight: 1.5,
    }}
  >
    Score details hidden.
  </div>
)}
            </div>
          </div>

          <div
            style={{
              margin: "8px 0 4px 0",
              padding: "9px 12px",
              borderRadius: "12px",
              background: "rgba(15,23,42,0.72)",
              border: "1px solid rgba(255,255,255,0.08)",
              color: "#94a3b8",
              fontSize: "11px",
              fontWeight: 700,
              lineHeight: 1.45,
            }}
          >
            Past performance is not a guarantee of future results. A strategy that looks strong over{" "}
            {range} may perform differently across other time ranges or market conditions.
          </div>
        </div>
      </div>
    </div>

    <div
      style={{
        marginTop: "22px",
        padding: "20px",
        borderRadius: "18px",
        background: "rgba(255,255,255,0.035)",
          border: "1px solid rgba(255,255,255,0.08)",
          width: "100%",
          boxShadow: "0 0 45px rgba(0,0,0,0.24)",
        }}
      >
        <div style={{ fontSize: "20px", fontWeight: 950, marginBottom: "14px" }}>
          Create Your Own Strategies
        </div>
        {editingStrategyName && (
  <div
    style={{
      marginBottom: "12px",
      color: "#94a3b8",
      fontSize: "13px",
      fontWeight: 800,
    }}
  >
    Editing: {strategyBank.find((s) => s.id === editingStrategyName)?.name}
  </div>
)}
        <div
  style={{
    marginBottom: "20px",
    padding: "16px",
    borderRadius: "16px",
    background: "rgba(15,23,42,0.72)",
    border: "1px solid rgba(255,255,255,0.08)",
    maxWidth: "760px",
  }}
>
  <div
    style={{
      display: "grid",
      gridTemplateColumns: "1fr auto",
      gap: "10px",
      marginBottom: "14px",
    }}
  >
    <input
      placeholder="Strategy name"
      value={customStrategyName}
      onChange={(e) => setCustomStrategyName(e.target.value)}
      style={{
        minWidth: 0,
        padding: "12px",
        borderRadius: "12px",
        border: "1px solid rgba(255,255,255,0.12)",
        background: "rgba(15,23,42,0.9)",
        color: "white",
        fontWeight: 800,
      }}
    />

    <button
      onClick={saveCurrentStrategy}
      style={{
        padding: "12px 18px",
        borderRadius: "12px",
        border: "1px solid rgba(25,195,125,0.45)",
        background: "rgba(25,195,125,0.15)",
        color: "#19C37D",
        cursor: "pointer",
        fontWeight: 900,
      }}
    >
      {editingStrategyName ? "Update Strategy" : "Save Strategy"}
    </button>
  </div>

    <div
  style={{
    display: "grid",
    gridTemplateColumns: "1fr 190px",
    gap: "10px",
    marginBottom: "14px",
  }}
>
  <textarea
    placeholder="Why I built this strategy..."
    value={customStrategyNotes}
    onChange={(e) => setCustomStrategyNotes(e.target.value)}
    rows={3}
    style={{
      minWidth: 0,
      resize: "vertical",
      padding: "12px",
      borderRadius: "12px",
      border: "1px solid rgba(255,255,255,0.12)",
      background: "rgba(15,23,42,0.9)",
      color: "white",
      fontWeight: 750,
      fontFamily: "inherit",
      lineHeight: 1.45,
    }}
  />

  <div>
    <label
      style={{
        display: "block",
        color: "#94a3b8",
        fontSize: "12px",
        fontWeight: 850,
        marginBottom: "6px",
      }}
    >
      Rebalance
    </label>

    <select
      value={customStrategyRebalance}
      onChange={(e) => setCustomStrategyRebalance(e.target.value)}
      style={{
        width: "100%",
        padding: "12px",
        borderRadius: "12px",
        border: "1px solid rgba(255,255,255,0.12)",
        background: "rgba(15,23,42,0.9)",
        color: "white",
        fontWeight: 850,
        cursor: "pointer",
      }}
    >
      <option value="Never">Never</option>
      <option value="Monthly">Monthly</option>
      <option value="Quarterly">Quarterly</option>
    </select>

    <div
      style={{
        color: "#64748b",
        fontSize: "11px",
        fontWeight: 700,
        lineHeight: 1.35,
        marginTop: "6px",
      }}
    >
      This is saved as a strategy preference for now.
    </div>
  </div>
</div>

  {builderPositions.map((position, index) => (
    <div
      key={index}
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) 90px 38px",
        gap: "8px",
        marginBottom: "9px",
      }}
    >
      <input
        placeholder="Ticker"
        value={position.ticker}
        onChange={(e) =>
          updateBuilderPosition(index, "ticker", e.target.value)
        }
        style={{
          minWidth: 0,
          padding: "10px",
          borderRadius: "10px",
          border: "1px solid rgba(255,255,255,0.12)",
          background: "rgba(15,23,42,0.9)",
          color: "white",
          fontWeight: 800,
        }}
      />

      <input
        type="number"
        placeholder="Weight"
        value={position.weight}
        onChange={(e) =>
          updateBuilderPosition(index, "weight", e.target.value)
        }
        style={{
          padding: "10px",
          borderRadius: "10px",
          border: "1px solid rgba(255,255,255,0.12)",
          background: "rgba(15,23,42,0.9)",
          color: "white",
          fontWeight: 800,
        }}
      />

      <button
        onClick={() => removeBuilderPosition(index)}
        style={{
          borderRadius: "10px",
          border: "1px solid rgba(148,163,184,0.3)",
          background: "rgba(148,163,184,0.12)",
          color: "#94a3b8",
          cursor: "pointer",
          fontWeight: 900,
        }}
      >
        ×
      </button>
    </div>
  ))}

  <button
    onClick={addBuilderPosition}
    style={{
      width: "100%",
      marginTop: "8px",
      padding: "10px",
      borderRadius: "12px",
      background: "rgba(255,255,255,0.06)",
      color: "#e5e7eb",
      border: "1px solid rgba(255,255,255,0.12)",
      cursor: "pointer",
      fontWeight: 800,
    }}
  >
    + Add Stock to Strategy
  </button>
</div>

{loadingStrategies && (
  <div style={{ color: "#94a3b8", fontSize: "13px", marginBottom: "12px" }}>
    Loading saved strategies...
  </div>
)}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: "12px",
          }}
        >
          {strategyBank.map((strategy) => (
  <div
    key={strategy.id}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr auto",
                gap: "10px",
                alignItems: "center",
                padding: "14px",
                borderRadius: "14px",
                background: "rgba(15,23,42,0.72)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <div>
  <div style={{ color: "white", fontWeight: 900, fontSize: "14px" }}>
    {strategy.name}
  </div>

  <div style={{ color: "#94a3b8", fontSize: "13px", marginTop: "5px" }}>
    {strategy.positions.map((p) => `${p.ticker} ${p.weight}%`).join(" • ")}
  </div>

  <div
  style={{
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
    alignItems: "center",
    marginTop: "8px",
  }}
>
  <span
    style={{
      padding: "4px 7px",
      borderRadius: "999px",
      background: "rgba(25,195,125,0.1)",
      border: "1px solid rgba(25,195,125,0.22)",
      color: "#86efac",
      fontSize: "11px",
      fontWeight: 850,
      lineHeight: 1,
      whiteSpace: "nowrap",
    }}
  >
    Rebalance: {strategy.rebalance || "Never"}
  </span>
</div>

{strategy.notes && (
  <div
    style={{
      marginTop: "9px",
      color: "#cbd5e1",
      fontSize: "12px",
      fontWeight: 700,
      lineHeight: 1.45,
      maxWidth: "520px",
    }}
  >
    “{strategy.notes.length > 130 ? `${strategy.notes.slice(0, 130)}...` : strategy.notes}”
  </div>
)}

  {getMacroTagsForStrategy(strategy.positions).length > 0 && (
    <div
      style={{
        display: "flex",
        gap: "6px",
        flexWrap: "wrap",
        marginTop: "10px",
      }}
    >
      {getMacroTagsForStrategy(strategy.positions).map((tag) => (
        <span
          key={tag}
          style={{
            padding: "4px 7px",
            borderRadius: "999px",
            background: "rgba(96,165,250,0.11)",
            border: "1px solid rgba(96,165,250,0.24)",
            color: "#93c5fd",
            fontSize: "11px",
            fontWeight: 850,
            lineHeight: 1,
            whiteSpace: "nowrap",
          }}
        >
          {tag}
        </span>
      ))}
    </div>
  )}
</div>

                <div style={{ position: "relative", display: "flex", gap: "8px", alignItems: "center" }}>
  <button
    onClick={() => moveStrategyToActive(strategy.id)}
    style={{
      width: "34px",
      height: "34px",
      borderRadius: "10px",
      border: "1px solid rgba(25,195,125,0.45)",
      background: "rgba(25,195,125,0.15)",
      color: "#19C37D",
      cursor: "pointer",
      fontWeight: 950,
      fontSize: "18px",
    }}
  >
    +
  </button>

  <button
    onClick={() =>
      setOpenStrategyMenu(
        openStrategyMenu === strategy.id ? null : strategy.id
      )
    }
    style={{
      width: "34px",
      height: "34px",
      borderRadius: "10px",
      border: "1px solid rgba(148,163,184,0.3)",
      background: "rgba(148,163,184,0.12)",
      color: "#94a3b8",
      cursor: "pointer",
      fontWeight: 950,
      fontSize: "18px",
      lineHeight: 1,
    }}
  >
    ⋯
  </button>

  {openStrategyMenu === strategy.id && (
  <div
    style={{
      position: "absolute",
      top: "42px",
      right: 0,
      zIndex: 20,
      padding: "8px",
      borderRadius: "12px",
      background: "rgba(2,6,23,0.98)",
      border: "1px solid rgba(255,255,255,0.12)",
      boxShadow: "0 14px 30px rgba(0,0,0,0.45)",
      display: "grid",
      gap: "6px",
      minWidth: "110px",
    }}
  >
    <button
      onClick={() => editStrategyFromBank(strategy.id)}
      style={{
        padding: "8px 12px",
        borderRadius: "10px",
        border: "1px solid rgba(148,163,184,0.3)",
        background: "rgba(148,163,184,0.12)",
        color: "#e5e7eb",
        cursor: "pointer",
        fontWeight: 900,
        whiteSpace: "nowrap",
        textAlign: "left",
      }}
    >
      Edit
    </button>

    <button
  onClick={() => cloneStrategyFromBank(strategy.id)}
  style={{
    padding: "8px 12px",
    borderRadius: "10px",
    border: "1px solid rgba(96,165,250,0.35)",
    background: "rgba(96,165,250,0.12)",
    color: "#93c5fd",
    cursor: "pointer",
    fontWeight: 900,
    whiteSpace: "nowrap",
    textAlign: "left",
  }}
>
  Clone
</button>

    <button
      onClick={() => deleteStrategyFromBank(strategy.id)}
      style={{
        padding: "8px 12px",
        borderRadius: "10px",
        border: "1px solid rgba(239,68,68,0.35)",
        background: "rgba(239,68,68,0.12)",
        color: "#fca5a5",
        cursor: "pointer",
        fontWeight: 900,
        whiteSpace: "nowrap",
        textAlign: "left",
      }}
    >
      Delete
    </button>
  </div>
)}
</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}