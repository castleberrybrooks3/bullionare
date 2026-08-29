import os
import re
import json
import time
import ctypes
import requests
import psycopg2
from html import unescape
from bs4 import BeautifulSoup, XMLParsedAsHTMLWarning
import warnings
warnings.filterwarnings("ignore", category=XMLParsedAsHTMLWarning)
from datetime import datetime
from db import get_db_connection_dict


# =========================================================
# LONG-RUN / DATABASE RESILIENCE
# =========================================================

_DB_RETRY_DELAYS = (5, 8, 13, 21, 34, 55, 60)


def _db_retry_delay(attempt):
    index = min(max(int(attempt) - 1, 0), len(_DB_RETRY_DELAYS) - 1)
    return _DB_RETRY_DELAYS[index]


def _is_db_connection_error(exc):
    return isinstance(exc, (psycopg2.OperationalError, psycopg2.InterfaceError))


def prevent_windows_idle_sleep():
    """
    Keep Windows from entering idle/system sleep while this long-running job is
    active. The monitor is still allowed to turn off normally.
    """
    if os.name != "nt":
        return False

    ES_CONTINUOUS = 0x80000000
    ES_SYSTEM_REQUIRED = 0x00000001

    try:
        result = ctypes.windll.kernel32.SetThreadExecutionState(
            ES_CONTINUOUS | ES_SYSTEM_REQUIRED
        )
        if result:
            print("[SYSTEM] Idle sleep disabled for this filing-intelligence run.")
            print("[SYSTEM] The display may still turn off normally.")
            return True
    except Exception as exc:
        print(f"[SYSTEM] Could not register keep-awake state: {exc}")

    return False


def restore_windows_sleep_policy():
    if os.name != "nt":
        return

    ES_CONTINUOUS = 0x80000000
    try:
        ctypes.windll.kernel32.SetThreadExecutionState(ES_CONTINUOUS)
        print("[SYSTEM] Normal Windows sleep policy restored.")
    except Exception:
        pass

SEC_BASE_URL = "https://data.sec.gov"
SEC_WWW_URL = "https://www.sec.gov"

SEC_HEADERS = {
    "User-Agent": "BullionaireIQ info@bullionaireiq.com",
    "Accept-Encoding": "gzip, deflate",
    "Host": "data.sec.gov",
}

SEC_WWW_HEADERS = {
    "User-Agent": "BullionaireIQ info@bullionaireiq.com",
    "Accept-Encoding": "gzip, deflate",
    "Host": "www.sec.gov",
}

COMPANY_PARSER_CONFIG = {
    "NVDA": {
        "entity_name": "NVIDIA CORP",
        "reportable_segment_labels": [
            "Compute & Networking",
            "Graphics",
        ],
        "expected_segment_count": 2,
        # Keep the durable annual market-platform layer additive. Compute and
        # Networking are subcomponents of Data Center and must not be summed
        # beside Data Center itself.
        "end_market_labels": [
            "Data Center",
            "Gaming",
            "Professional Visualization",
            "Automotive",
            "OEM and Other",
        ],
        # NVIDIA changed its market-platform presentation in Q1 FY2027.
        # Data Center and Edge Computing are the additive top-level current view;
        # Hyperscale and AI Clouds are Data Center subcomponents and are not
        # mixed into the same top-level list.
        "quarterly_end_market_labels": [
            "Data Center",
            "Edge Computing",
        ],
        "geography_labels": [
            "United States",
            "Taiwan",
            "China including Hong Kong",
            "China (including Hong Kong)",
            "Other",
        ],
    },

    "MSFT": {
        "entity_name": "MICROSOFT CORP",
        "reportable_segment_labels": [
            "Productivity and Business Processes",
            "Intelligent Cloud",
            "More Personal Computing",
        ],
        "end_market_labels": [
            "Server products and cloud services",
            "Microsoft 365 Commercial products and cloud services",
            "XBOX",
            "LinkedIn",
            "Windows and Devices",
            "Search advertising",
            "Microsoft 365 Consumer products and cloud services",
            "Dynamics products and cloud services",
            "Enterprise and partner services",
        ],
        "expected_segment_count": 3,
        "geography_labels": [
            "United States",
            "Other countries",
            "Other Countries",
        ],
        "expected_end_market_count": 9,
        "expected_geography_count": 2,
    },

    "AAPL": {
        "entity_name": "APPLE INC",
        "reportable_segment_labels": [
            "Americas",
            "Europe",
            "Greater China",
            "Japan",
            "Rest of Asia Pacific",
        ],
        "end_market_labels": [
            "iPhone",
            "Mac",
            "iPad",
            "Wearables, Home and Accessories",
            "Services",
        ],
        "geography_labels": [
            "Americas",
            "Europe",
            "Greater China",
            "Japan",
            "Rest of Asia Pacific",
        ],
    },

    "AMZN": {
        "entity_name": "AMAZON.COM, INC.",
        "reportable_segment_labels": [
            "North America",
            "International",
            "AWS",
        ],
        "end_market_labels": [
            "Online stores",
            "Physical stores",
            "Third-party seller services",
            "Advertising services",
            "Subscription services",
            "AWS",
            "Other",
        ],
        "geography_labels": [
            "United States",
            "Germany",
            "United Kingdom",
            "Japan",
            "Rest of world",
        ],
        "expected_segment_count": 3,
    },

    "GOOGL": {
        "entity_name": "ALPHABET INC.",
        "reportable_segment_labels": [
            "Google Services",
            "Google Cloud",
            "Other Bets",
        ],
        "end_market_labels": [
            "Google Search & other",
            "YouTube ads",
            "Google Network",
            "Google subscriptions, platforms, and devices",
            "Google Cloud",
            "Other Bets",
        ],
        "geography_labels": [
            "United States",
            "EMEA",
            "APAC",
            "Other Americas",
        ],
    },

    "META": {
        "entity_name": "META PLATFORMS, INC.",
        "reportable_segment_labels": [
            "Family of Apps",
            "Reality Labs",
        ],
        "end_market_labels": [
            "Advertising",
            "Other revenue",
            "Reality Labs",
        ],
        "geography_labels": [
            "United States and Canada",
            "Europe",
            "Asia-Pacific",
            "Rest of World",
        ],
        "expected_segment_count": 2,
    },

    "TSLA": {
        "entity_name": "TESLA, INC.",
        "reportable_segment_labels": [
            "Automotive",
            "Energy generation and storage",
            "Services and other",
        ],
        "end_market_labels": [
            "Automotive sales",
            "Automotive regulatory credits",
            "Automotive leasing",
            "Energy generation and storage",
            "Services and other",
        ],
        "geography_labels": [
            "United States",
            "China",
            "Other",
        ],
    },

    "ORCL": {
        "entity_name": "ORACLE CORP",
        # Fiscal 2026: three businesses, each comprising one operating segment.
        "reportable_segment_labels": [
            "Cloud and software",
            "Hardware",
            "Services",
        ],
        "expected_segment_count": 3,
        "end_market_labels": [],
        "geography_labels": [
            "Americas",
            "Europe, Middle East and Africa",
            "Europe, Middle East & Africa",
            "EMEA",
            "Asia Pacific",
        ],
        "expected_geography_count": 3,
    },

    "CRM": {
        "entity_name": "SALESFORCE, INC.",
        # Salesforce explicitly reports one operating segment. Do not present
        # revenue types as reportable business segments.
        "reportable_segment_labels": [],
        "single_segment_expected": True,
        # Fiscal 2026 subscription/support service offerings plus professional
        # services form an additive company-level revenue mix.
        "end_market_labels": [
            "Agentforce Sales",
            "Agentforce Service",
            "Agentforce 360 Platform, Slack and Other",
            "Agentforce Marketing and Agentforce Commerce",
            "Agentforce Integration and Agentforce Analytics",
            "Professional services and other",
        ],
        "expected_end_market_count": 6,
        "geography_labels": [
            "Americas",
            "Europe",
            "Asia Pacific",
        ],
        "expected_geography_count": 3,
        "merge_missing_end_markets": True,
    },

    "PG": {
        "entity_name": "PROCTER & GAMBLE CO",
        "reportable_segment_labels": [
            "Beauty",
            "Grooming",
            "Health Care",
            "Fabric & Home Care",
            "Baby, Feminine & Family Care",
        ],
        "expected_segment_count": 5,
        # The SEC segment table presents the five businesses as columns and Net
        # sales as the accounting measure row.
        "forced_segment_metric": "net sales",
        "end_market_labels": [],
        # The filing separately discloses U.S. vs International sales. Keep
        # that disclosure as geography, never as reportable segments.
        "geography_labels": [
            "United States",
            "International",
        ],
        "expected_geography_count": 2,
        # The table contains two accounting sections with identical geography
        # labels (NET SALES and LONG-LIVED ASSETS). Force the revenue section.
        "geography_section_metric": "net sales",
    },

    "MET": {
        "entity_name": "METLIFE INC",
        # MetLife reorganized in Q4 2025 to a single reportable segment.
        "reportable_segment_labels": [],
        "single_segment_expected": True,
        # The current segment note separately provides major product groups for
        # premiums, policy fees and other revenues.
        "end_market_labels": [
            "Life insurance",
            "Accident & health insurance",
            "Annuities",
        ],
        "expected_end_market_count": 3,
        "end_market_scope": "Premiums, policy fees and other revenues",
        "geography_labels": [],
    },

    "NKE": {
        "entity_name": "NIKE, INC.",
        "reportable_segment_labels": [
            "North America",
            "Europe, Middle East & Africa",
            "Greater China",
            "Asia Pacific & Latin America",
            "Converse",
        ],
        "expected_segment_count": 5,
        "sparse_segment_metric": "revenues",
        # NIKE's revenue-disaggregation matrix contains product and channel
        # rows by individual segment. Do not flatten one regional subtable into
        # a fake company-wide end-market mix.
        "end_market_labels": [],
        "geography_labels": [],
    },

    "QCOM": {
        "entity_name": "QUALCOMM INC/DE",
        "reportable_segment_labels": ["QCT", "QTL"],
        "expected_segment_count": 2,
        "merge_missing_segments": True,
        "end_market_labels": [],
        "geography_labels": [],
    },

    "SBUX": {
        "entity_name": "STARBUCKS CORP",
        "reportable_segment_labels": [
            "North America",
            "International",
            "Channel Development",
        ],
        "expected_segment_count": 3,
        "forced_segment_metric": "total net revenues",
        "end_market_labels": [
            "Beverage",
            "Food",
        ],
        "geography_labels": [],
    },

    "PNC": {
        "entity_name": "PNC FINANCIAL SERVICES GROUP, INC.",
        "reportable_segment_labels": [
            "Retail Banking",
            "Corporate & Institutional Banking",
            "Asset Management Group",
        ],
        "expected_segment_count": 3,
        "segment_year_block_metric": "total revenue",
        "segment_mix_denominator": "segment_sum",
        "end_market_labels": [],
        "geography_labels": [],
    },

    "COF": {
        "entity_name": "CAPITAL ONE FINANCIAL CORP",
        "reportable_segment_labels": [
            "Credit Card",
            "Consumer Banking",
            "Commercial Banking",
        ],
        "expected_segment_count": 3,
        # Capital One's 10-K publishes one dedicated annual Business Results
        # table for each major segment. Read the explicit Total net revenue row
        # from those issuer-specific tables rather than the separate contract-
        # revenue disaggregation table, which contains much smaller values.
        "individual_segment_metric": "total net revenue",
        "segment_mix_denominator": "segment_sum",
        "end_market_labels": [],
        "geography_labels": [],
    },

    "ALL": {
        "entity_name": "ALLSTATE CORP",
        "reportable_segment_labels": [
            "Allstate Protection",
            "Run-off Property-Liability",
            "Protection Services",
            "Corporate",
        ],
        "expected_segment_count": 4,
        "named_segment_rows_context": "reportable segments revenue information",
        "named_segment_rows": {
            "Allstate Protection": "Total Allstate Protection",
            "Run-off Property-Liability": "Run-off Property-Liability",
            "Protection Services": "Total Protection Services",
            "Corporate": "Total Corporate",
        },
        "segment_mix_denominator": "segment_sum",
        "end_market_labels": [],
        "geography_labels": [],
    },

    "HIG": {
        "entity_name": "HARTFORD INSURANCE GROUP, INC.",
        "reportable_segment_labels": [
            "Business Insurance",
            "Personal Insurance",
            "Property & Casualty Other Operations",
            "Employee Benefits",
            "Hartford Funds",
        ],
        "expected_segment_count": 5,
        "forced_segment_metric": "total revenues",
        "segment_mix_denominator": "segment_sum",
        "end_market_labels": [],
        "geography_labels": [],
    },

    "FDX": {
        "entity_name": "FEDEX CORP",
        # Fiscal 2026/2025 annual reporting before the June 1, 2026 Freight
        # spin-off used Federal Express and FedEx Freight.
        "reportable_segment_labels": [
            "Federal Express",
            "FedEx Freight",
        ],
        "expected_segment_count": 2,
        "named_segment_rows_context": "revenue by service type",
        "named_segment_rows": {
            "Federal Express": "Total Federal Express segment",
            "FedEx Freight": "FedEx Freight segment",
        },
        "segment_mix_denominator": "segment_sum",
        "end_market_labels": [],
        "geography_labels": [],
    },

    "ETN": {
        "entity_name": "EATON CORP PLC",
        # Annual 2025 structure. 2026 quarterly reporting later combined
        # Vehicle/eMobility into Mobility; generic quarterly output is suppressed.
        "reportable_segment_labels": [
            "Electrical Americas",
            "Electrical Global",
            "Aerospace",
            "Vehicle",
            "eMobility",
        ],
        "expected_segment_count": 5,
        "end_market_labels": [],
        "geography_labels": [],
    },

    "MMM": {
        "entity_name": "3M CO",
        "reportable_segment_labels": [
            "Safety and Industrial",
            "Transportation and Electronics",
            "Consumer",
        ],
        "expected_segment_count": 3,
        "end_market_labels": [],
        "geography_labels": [],
    },

    "EMR": {
        "entity_name": "EMERSON ELECTRIC CO",
        "reportable_segment_labels": [
            "Final Control",
            "Measurement & Analytical",
            "Discrete Automation",
            "Safety & Productivity",
            "Control Systems & Software",
            "Test & Measurement",
        ],
        "expected_segment_count": 6,
        "sparse_segment_metric": "net sales",
        "segment_mix_denominator": "segment_sum",
        "end_market_labels": [],
        "geography_labels": [],
    },

    "DUK": {
        "entity_name": "DUKE ENERGY CORP",
        "reportable_segment_labels": [
            "Electric Utilities and Infrastructure",
            "Gas Utilities and Infrastructure",
        ],
        "expected_segment_count": 2,
        "forced_segment_metric": "unaffiliated revenues",
        "end_market_labels": [],
        "geography_labels": [],
    },

    "AGCO": {
        "entity_name": "AGCO CORP /DE",
        "reportable_segment_labels": [
            "North America",
            "South America",
            "Europe/Middle East",
            "Asia/Pacific/Africa",
        ],
        "expected_segment_count": 4,
        "forced_segment_metric": "net sales",
        "end_market_labels": [
            "Tractors",
            "Replacement parts",
            "Combines, application equipment and other machinery",
        ],
        "expected_end_market_count": 3,
        "end_market_total_column_by_year": True,
        "end_market_total_column_ignore_denominator": True,
        # The four 2025 geographic segments add exactly to consolidated sales.
        "consolidated_revenue_from_segment_sum": True,
        "segment_mix_denominator": "segment_sum",
        "geography_labels": [],
    },

    "ALSN": {
        "entity_name": "ALLISON TRANSMISSION HOLDINGS INC",
        # The 2025 10-K had one operating/reportable segment. These five rows
        # are end-market disaggregation, not reportable segments.
        "reportable_segment_labels": [],
        "single_segment_expected": True,
        "end_market_labels": [
            "North America On-Highway",
            "Outside North America On-Highway",
            "Global Off-Highway",
            "Defense",
            "Service Parts, Support Equipment and Other",
        ],
        "expected_end_market_count": 5,
        "end_market_direct_annual_rows": True,
        "end_market_scale_override": 1_000_000,
        "consolidated_revenue_from_end_market_sum": True,
        "geography_labels": [],
    },

    "AM": {
        "entity_name": "ANTERO MIDSTREAM CORP",
        "reportable_segment_labels": [
            "Gathering and Processing",
            "Water Handling",
        ],
        "expected_segment_count": 2,
        "forced_segment_metric": "total revenues",
        "end_market_labels": [],
        "geography_labels": [],
    },

    "AR": {
        "entity_name": "ANTERO RESOURCES CORP",
        # AR has three real reportable segments, but the equity-method segment
        # does not share a directly comparable revenue measure with E&P and
        # Marketing. Suppress generic metric-row false positives rather than
        # inventing an additive segment-revenue series.
        "reportable_segment_labels": [],
        "end_market_labels": [
            "Natural gas sales",
            "Natural gas liquids sales (ethane)",
            "Natural gas liquids sales (C3+ NGLs)",
            "Oil sales",
            "Marketing",
        ],
        "geography_labels": [],
    },

    "AAMI": {
        "entity_name": "ACADIAN ASSET MANAGEMENT INC",
        "reportable_segment_labels": [],
        "single_segment_expected": True,
        "end_market_labels": [],
        "geography_labels": [],
    },

    "ACIW": {
        "entity_name": "ACI WORLDWIDE, INC.",
        "reportable_segment_labels": [
            "Payment Software",
            "Biller",
        ],
        "expected_segment_count": 2,
        "forced_segment_metric": "total",
        "end_market_labels": [
            "Bill Payments",
            "Merchant Payments",
            "Payments Intelligence",
            "Real-Time Payments",
            "Issuing and Acquiring",
        ],
        "expected_end_market_count": 5,
        "end_market_total_column_by_year": True,
        "end_market_total_column_ignore_denominator": True,
        "geography_labels": [],
    },

    "ACMR": {
        "entity_name": "ACM RESEARCH, INC.",
        "reportable_segment_labels": [],
        "single_segment_expected": True,
        "end_market_labels": [
            "Single Wafer Cleaning, Tahoe and Semi-Critical Cleaning Equipment",
            "ECP (front-end and packaging), Furnace and Other Technologies",
            "Advanced Packaging (excluding ECP), Services & Spares",
        ],
        "expected_end_market_count": 3,
        "end_market_direct_annual_rows": True,
        "end_market_scale_override": 1_000,
        "consolidated_revenue_from_end_market_sum": True,
        "geography_labels": [],
    },

    "AEO": {
        "entity_name": "AMERICAN EAGLE OUTFITTERS INC",
        "reportable_segment_labels": [
            "American Eagle",
            "Aerie",
        ],
        "expected_segment_count": 2,
        "forced_segment_metric": "net revenue",
        "end_market_labels": [],
        "geography_labels": [],
    },

    "AGX": {
        "entity_name": "ARGAN INC",
        "reportable_segment_labels": [
            "Power",
            "Industrial",
            "Teledata",
        ],
        "expected_segment_count": 3,
        "segment_mix_denominator": "segment_sum",
        "annual_category_scale_corrections": {
            "segments": 0.001,
            "geography": 0.001,
        },
        "end_market_labels": [],
        "geography_labels": [
            "United States",
            "Republic of Ireland",
            "United Kingdom",
        ],
        "expected_geography_count": 3,
    },

    "AIN": {
        "entity_name": "ALBANY INTERNATIONAL CORP /DE/",
        "reportable_segment_labels": [
            "Machine Clothing",
            "Albany Engineered Composites",
        ],
        "expected_segment_count": 2,
        "segment_direct_annual_rows": True,
        "end_market_labels": [],
        "geography_labels": [],
    },

    "AN": {
        "entity_name": "AUTONATION, INC.",
        # Three dealership segments use the directly comparable franchised-
        # dealership revenue row. AutoNation Finance is added separately from
        # its explicit interest-fee-income metric.
        "reportable_segment_labels": [
            "Domestic",
            "Import",
            "Premium Luxury",
        ],
        "expected_segment_count": 3,
        "forced_segment_metric": "franchised dealerships",
        "supplemental_segment_metrics": {
            "AutoNation Finance": "interest fee income",
        },
        "supplemental_segment_scale_overrides": {
            "AutoNation Finance": 1_000_000,
        },
        "end_market_labels": [
            "New vehicle",
            "Used vehicle",
            "Parts and service",
            "Finance and insurance, net",
        ],
        "geography_labels": [],
    },

    "LMT": {
        "entity_name": "LOCKHEED MARTIN CORP",
        "reportable_segment_labels": [
            "Aeronautics",
            "Missiles and Fire Control",
            "Rotary and Mission Systems",
            "Space",
        ],
        "end_market_labels": [
            "Products",
            "Services",
        ],
        "geography_labels": [
            "United States",
            "Europe",
            "Asia Pacific",
            "Middle East",
            "Other",
        ],
        "expected_segment_count": 4,
        "expected_geography_count": 5,
        # Lockheed's disaggregation table is wide by business segment:
        # Aeronautics | MFC | RMS | Space | Total.
        # Geographic intelligence must use the final Total column rather than
        # the first segment column.
        "geography_total_column_by_year": True,
        "require_geography_reconciliation": True,
    },

    "AMGN": {
        "entity_name": "AMGEN INC",
        "reportable_segment_labels": [],
        "single_segment_expected": True,
        "end_market_labels": [
            "Prolia",
            "Repatha",
            "Otezla",
            "ENBREL",
            "EVENITY",
            "XGEVA",
            "TEPEZZA (1)",
            "BLINCYTO",
            "Nplate",
            "TEZSPIRE (2)",
            "KYPROLIS",
            "Aranesp",
            "KRYSTEXXA (1)",
            "Vectibix",
            "Other products (3)",
            "Other revenues",
        ],
        "expected_end_market_count": 16,
        # Year-major blocks: U.S. | ROW | Total for each fiscal year.
        "end_market_value_layout": "year_major_total_last",
        "geography_labels": [],
    },

    "GILD": {
        "entity_name": "GILEAD SCIENCES, INC.",
        "reportable_segment_labels": [],
        "single_segment_expected": True,
        "end_market_labels": [
            "Biktarvy",
            "Descovy",
            "Genvoya",
            "Odefsey",
            "Symtuza - Revenue share (1)",
            "Other HIV (2)",
            "Sofosbuvir/Velpatasvir (3)",
            "Vemlidy",
            "Other Liver Disease (4)",
            "Veklury",
            "Tecartus",
            "Yescarta",
            "Trodelvy",
            "AmBisome",
            "Royalty, contract and other revenues",
        ],
        "expected_end_market_count": 15,
        # Year-major blocks: U.S. | Europe | Rest of World | Total.
        "end_market_value_layout": "year_major_total_last",
        "geography_labels": [],
    },

    "LLY": {
        "entity_name": "ELI LILLY AND CO",
        "reportable_segment_labels": [],
        "single_segment_expected": True,
        "end_market_labels": [
            "Mounjaro",
            "Zepbound (1)",
            "Trulicity",
            "Jardiance (2)",
            "Other cardiometabolic health",
            "Verzenio",
            "Other oncology",
            "Taltz",
            "Other immunology",
            "Neuroscience",
        ],
        "expected_end_market_count": 10,
        # Note 2 presents U.S. fiscal years followed by Outside-U.S. fiscal
        # years. Company product revenue is the sum of the two geographic
        # amounts for each fiscal year.
        "end_market_value_layout": "two_geo_year_blocks_sum",
        "geography_labels": [],
    },

    "STT": {
        "entity_name": "STATE STREET CORP",
        "reportable_segment_labels": [
            "Investment Servicing",
            "Investment Management",
        ],
        "expected_segment_count": 2,
        # The 10-K publishes one line-of-business results table for each
        # reportable segment with an explicit Total revenue row. These tables
        # are stated in millions but also contain an Average assets (in billions)
        # row, so use an issuer-specific scale instead of the generic table scale.
        "individual_segment_metric": "total revenue",
        "individual_segment_scale_override": 1_000_000,
        "segment_mix_denominator": "segment_sum",
        "end_market_labels": [
            "Servicing fees",
            "Management fees",
            "Foreign exchange trading services",
            "Securities finance",
            "Software and processing fees",
            "Other fee revenue",
        ],
        "expected_end_market_count": 6,
        # Read these six fee rows from the consolidated annual income statement,
        # where each row is exactly 2025 / 2024 / 2023. Avoid the wider line-of-
        # business matrix, which contains several subcolumns per year.
        "end_market_direct_annual_rows": True,
        "end_market_scale_override": 1_000_000,
        "geography_labels": [],
    },

    "XOM": {
        "entity_name": "EXXON MOBIL CORP",
        "reportable_segment_labels": [
            "Upstream",
            "Energy Products",
            "Chemical Products",
            "Specialty Products",
        ],
        # The four operating businesses are already represented as reportable
        # segments. Do not duplicate them into a second "end markets" panel.
        "end_market_labels": [],
        "expected_segment_count": 4,
        "recover_complete_segments_without_denominator": True,
        "geography_labels": [
            "United States",
            "Non-U.S.",
        ],
        "expected_geography_count": 2,
    },

    "JPM": {
        "entity_name": "JPMORGAN CHASE & CO",
        "reportable_segment_labels": [
            "Consumer & Community Banking",
            "Commercial & Investment Bank",
            "Asset & Wealth Management",
            "Corporate",
        ],
        # Avoid duplicating reportable segment names as end markets. JPM's
        # business-line detail is not consistently presented as a clean,
        # additive revenue table across filings.
        "end_market_labels": [],
        "expected_segment_count": 4,
        "merge_missing_segments": True,
        # Corporate is disclosed in a separate table. Force the actual
        # segment-level Total net revenue row rather than accepting a smaller
        # Corporate sub-line that merely happens to contain the word Corporate.
        "supplemental_segment_metrics": {
            "Corporate": "total net revenue",
        },
        # JPM's consolidated geography table is a wide table with Revenue,
        # Expense, Pretax Income, Net Income and Assets columns for each year.
        # Use the first metric column (Revenue) in each year group.
        "geography_labels": [
            "Europe/Middle East/Africa",
            "Asia-Pacific",
            "Latin America/Caribbean",
            "North America",
        ],
        "expected_geography_count": 4,
        "geography_wide_metric": "Revenue",
        # JPM's business-segment table is presented on a managed basis and sums
        # to $185.581B in 2025 before $(3.134)B of reconciling items. Use the
        # complete segment set itself for segment mix percentages while keeping
        # reported consolidated revenue for geography and other disclosures.
        "segment_mix_denominator": "segment_sum",
        "segment_scope": "Managed basis",
    },

    "GS": {
        "entity_name": "THE GOLDMAN SACHS GROUP, INC.",
        "reportable_segment_labels": [
            "Global Banking & Markets",
            "Asset & Wealth Management",
            "Platform Solutions",
        ],
        "end_market_labels": [
            "Investment banking",
            "FICC",
            "Equities",
            "Investment management",
            "Commissions and fees",
        ],
        "geography_labels": ["Americas", "EMEA", "Asia", "United States", "International"],
    },

    "KO": {
        "entity_name": "COCA COLA CO",
        "reportable_segment_labels": [
            "EMEA",
            "Latin America",
            "North America",
            "Asia Pacific",
            "Bottling Investments",
        ],
        "expected_segment_count": 5,
        "end_market_labels": [
            "Trademark Coca-Cola",
            "Sparkling flavors",
            "Water, sports, coffee and tea",
            "Juice, value-added dairy and plant-based beverages",
        ],
        "geography_labels": ["United States", "International", "North America", "Latin America", "Europe",
                             "Asia Pacific"],
    },

    "WMT": {
        "entity_name": "WALMART INC.",
        "reportable_segment_labels": [
            "Walmart U.S.",
            "Walmart International",
            "Sam's Club U.S.",
        ],
        "expected_segment_count": 3,
        # Show one coherent nested merchandise mix rather than blending Walmart
        # U.S. and Sam's Club category tables. Walmart U.S. is the broadest
        # merchandise disclosure and is explicitly scoped below.
        "end_market_labels": [
            "Grocery",
            "General merchandise",
            "Health and wellness",
            "Other",
        ],
        "expected_end_market_count": 4,
        "geography_labels": [
            "Mexico and Central America",
            "China",
            "Canada",
            "Other",
        ],
        "end_market_scope": "Walmart U.S.",
        "geography_scope": "Walmart International",
        "expected_geography_count": 4,
        "merge_missing_segments": True,
        # The Sam's Club section is sometimes split from the first two segment
        # sections by SEC HTML structure. Pull its explicit Net sales row.
        "supplemental_segment_metrics": {
            "Sam's Club U.S.": "net sales",
        },
    },

    "PLD": {
        "entity_name": "PROLOGIS, INC.",
        "reportable_segment_labels": [],
        "end_market_labels": [],
        "geography_labels": [
            "United States",
            "Other Americas",
            "Europe",
            "Asia",
        ],
        "single_segment_expected": True,
    },

    "TRV": {
        "entity_name": "THE TRAVELERS COMPANIES, INC.",
        "reportable_segment_labels": [
            "Business Insurance",
            "Bond & Specialty Insurance",
            "Personal Insurance",
        ],
        "expected_segment_count": 3,
        "forced_segment_metric": "total segment revenues",
        "end_market_labels": [],
        "geography_labels": [],
    },

    "UNH": {
        "entity_name": "UNITEDHEALTH GROUP INC",
        "reportable_segment_labels": [
            "UnitedHealthcare",
            "Optum Health",
            "Optum Insight",
            "Optum Rx",
        ],
        "non_additive_categories": ["segments"],
        "end_market_labels": [
            "Premiums",
            "Products",
            "Services",
        ],
        "geography_labels": [],
    },
}


CIK_TICKER_FALLBACKS = {
    "BK": "0001390777",  # The Bank of New York Mellon Corporation
}


PREDECESSOR_CIK_FALLBACKS = {
    # Exxon Mobil's July 2026 successor registrant has no standalone 2025 10-K.
    "XOM": "0000034088",
}


DEFAULT_PARSER_CONFIG = {
    "entity_name": None,
    # Generic issuers are discovered from strongly classified SEC tables.
    # Do not seed category extraction with broad words like "United States",
    # "International", "Europe" or "Other" because those labels appear in many
    # unrelated tables and were the root cause of false segment classifications.
    "reportable_segment_labels": [],
    "end_market_labels": [],
    "geography_labels": [],
    "generic_discovery": True,
}


def get_json(url, headers=None, timeout=20):
    response = requests.get(url, headers=headers or SEC_HEADERS, timeout=timeout)
    response.raise_for_status()
    return response.json()


def get_text(url, headers=None, timeout=30):
    response = requests.get(url, headers=headers or SEC_WWW_HEADERS, timeout=timeout)
    response.raise_for_status()
    return response.text


def clean_sec_text(raw_text):
    if not raw_text:
        return ""

    text = raw_text
    text = re.sub(r"(?is)<script.*?>.*?</script>", " ", text)
    text = re.sub(r"(?is)<style.*?>.*?</style>", " ", text)
    text = re.sub(r"(?is)<br\s*/?>", "\n", text)
    text = re.sub(r"(?is)</tr>", "\n", text)
    text = re.sub(r"(?is)</p>", "\n", text)
    text = re.sub(r"(?is)</div>", "\n", text)
    text = re.sub(r"(?is)</td>", " ", text)
    text = re.sub(r"(?is)</th>", " ", text)
    text = re.sub(r"(?is)<[^>]+>", " ", text)
    text = unescape(text)
    text = text.replace("\xa0", " ")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n\s+", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def safe_float(value):
    try:
        if value is None:
            return None

        clean = str(value).strip()
        clean = clean.replace("$", "").replace(",", "").replace(" ", "")

        negative = False
        if clean.startswith("(") and clean.endswith(")"):
            negative = True
            clean = clean[1:-1]

        num = float(clean)
        return -num if negative else num
    except Exception:
        return None


def money_to_number(raw_amount, scale_word=None, default_scale=1_000_000):
    num = safe_float(raw_amount)

    if num is None:
        return None

    scale = default_scale

    if scale_word:
        word = scale_word.lower()
        if "billion" in word:
            scale = 1_000_000_000
        elif "million" in word:
            scale = 1_000_000
        elif "thousand" in word:
            scale = 1_000

    return num * scale


def safe_ratio(numerator, denominator):
    try:
        numerator = float(numerator)
        denominator = float(denominator)

        if denominator == 0:
            return None

        return numerator / denominator
    except Exception:
        return None


def pct_growth(current, previous):
    try:
        current = float(current)
        previous = float(previous)

        if previous == 0:
            return None

        return ((current - previous) / abs(previous)) * 100
    except Exception:
        return None


_COMPANY_TICKERS_CACHE = None


def get_company_tickers():
    global _COMPANY_TICKERS_CACHE

    if _COMPANY_TICKERS_CACHE is None:
        _COMPANY_TICKERS_CACHE = get_json(
            f"{SEC_WWW_URL}/files/company_tickers.json",
            headers=SEC_WWW_HEADERS,
        )

    return _COMPANY_TICKERS_CACHE


def get_cik_for_ticker(ticker):
    company_tickers = get_company_tickers()
    clean_ticker = ticker.strip().upper()

    for _, row in company_tickers.items():
        if str(row.get("ticker", "")).upper() == clean_ticker:
            return str(row.get("cik_str", "")).zfill(10)

    return CIK_TICKER_FALLBACKS.get(clean_ticker)


def get_latest_filing(cik, form_type):
    submissions = get_json(
        f"{SEC_BASE_URL}/submissions/CIK{cik}.json",
        headers=SEC_HEADERS,
    )

    recent = submissions.get("filings", {}).get("recent", {})
    forms = recent.get("form", [])
    accession_numbers = recent.get("accessionNumber", [])
    filing_dates = recent.get("filingDate", [])
    primary_documents = recent.get("primaryDocument", [])

    preferred_forms = [form_type]
    if form_type == "10-K":
        preferred_forms += ["20-F", "40-F"]
    elif form_type == "10-Q":
        preferred_forms += ["6-K"]

    for preferred_form in preferred_forms:
        for index, form in enumerate(forms):
            if form != preferred_form:
                continue

            accession = accession_numbers[index]
            filing_date = filing_dates[index]
            primary_doc = primary_documents[index]

            accession_clean = accession.replace("-", "")
            cik_no_leading = str(int(cik))

            url = (
                f"{SEC_WWW_URL}/Archives/edgar/data/"
                f"{cik_no_leading}/{accession_clean}/{primary_doc}"
            )

            raw_text = get_text(url, headers=SEC_WWW_HEADERS)
            clean_text = clean_sec_text(raw_text)

            return {
                "form": preferred_form,
                "filing_date": filing_date,
                "accession": accession,
                "primary_document": primary_doc,
                "url": url,
                "raw_html": raw_text,
                "clean_text": clean_text,
            }
    return None


def extract_money_phrase(text, patterns, default_scale=1_000_000):
    if not text:
        return None

    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE | re.DOTALL)
        if not match:
            continue

        amount = match.group(1)
        scale_word = match.group(2) if match.lastindex and match.lastindex >= 2 else None
        value = money_to_number(amount, scale_word=scale_word, default_scale=default_scale)

        if value is not None:
            return value

    return None


def extract_percent_phrase(text, patterns):
    if not text:
        return None

    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE | re.DOTALL)
        if match:
            return safe_float(match.group(1))

    return None


def normalize_spaces(value):
    if not value:
        return ""

    return re.sub(r"\s+", " ", str(value)).strip()


def extract_section_between(text, start_patterns, end_patterns=None, max_chars=20000):
    if not text:
        return ""

    for start_pattern in start_patterns:
        start_match = re.search(start_pattern, text, re.IGNORECASE | re.DOTALL)

        if not start_match:
            continue

        start_index = start_match.start()
        section = text[start_index:start_index + max_chars]

        if end_patterns:
            end_indexes = []

            for end_pattern in end_patterns:
                end_match = re.search(end_pattern, section[500:], re.IGNORECASE | re.DOTALL)
                if end_match:
                    end_indexes.append(500 + end_match.start())

            if end_indexes:
                section = section[:min(end_indexes)]

        return section

    return ""


def extract_note_section(text, start_patterns, end_patterns=None, max_chars=60000):
    if not text:
        return ""

    matches = []

    for start_pattern in start_patterns:
        for match in re.finditer(start_pattern, text, re.IGNORECASE | re.DOTALL):
            matches.append(match)

    if not matches:
        return ""

    # Use the last match because SEC filings often mention the note earlier
    # in the business description or table of contents before the real note.
    start_match = sorted(matches, key=lambda m: m.start())[-1]
    start_index = start_match.start()

    section = text[start_index:start_index + max_chars]

    if end_patterns:
        end_indexes = []

        for end_pattern in end_patterns:
            end_match = re.search(end_pattern, section[1000:], re.IGNORECASE | re.DOTALL)
            if end_match:
                end_indexes.append(1000 + end_match.start())

        if end_indexes:
            section = section[:min(end_indexes)]

    return section


def extract_subsection_between(text, start_patterns, end_patterns=None, max_chars=30000):
    if not text:
        return ""

    matches = []

    for start_pattern in start_patterns:
        for match in re.finditer(start_pattern, text, re.IGNORECASE | re.DOTALL):
            matches.append(match)

    if not matches:
        return ""

    start_match = sorted(matches, key=lambda m: m.start())[0]
    start_index = start_match.start()

    section = text[start_index:start_index + max_chars]

    if end_patterns:
        end_indexes = []

        for end_pattern in end_patterns:
            end_match = re.search(end_pattern, section[500:], re.IGNORECASE | re.DOTALL)
            if end_match:
                end_indexes.append(500 + end_match.start())

        if end_indexes:
            section = section[:min(end_indexes)]

    return section



def _semantic_label(value):
    value = normalize_spaces(value).lower()
    value = value.replace("&", " and ")
    value = re.sub(r"\(\s*\d+\s*\)", " ", value)
    value = re.sub(r"[\u2013\u2014\-]+", " ", value)
    value = re.sub(r"[^a-z0-9]+", " ", value)
    return normalize_spaces(value)


def _explicit_table_scale(text):
    """Return an explicitly stated monetary scale, or None if none is stated."""
    low = normalize_spaces(text).lower()
    unit_matches = []
    unit_patterns = (
        (r"\b(?:dollars?\s+)?in\s+thousands?\b", 1_000),
        (r"\b(?:dollars?\s+)?in\s+millions?\b", 1_000_000),
        (r"\b(?:dollars?\s+)?in\s+billions?\b", 1_000_000_000),
        (r"\bthousands\b", 1_000),
        (r"\bmillions\b", 1_000_000),
        (r"\bbillions\b", 1_000_000_000),
    )
    for pattern, scale in unit_patterns:
        match = re.search(pattern, low)
        if match:
            unit_matches.append((match.start(), scale))

    if not unit_matches:
        return None

    unit_matches.sort(key=lambda item: item[0])
    return unit_matches[0][1]


def _infer_table_scale(text):
    return _explicit_table_scale(text) or 1_000_000


def _table_context(table_tag):
    parts = []
    for prev in table_tag.find_all_previous(
        ["p", "div", "span", "h1", "h2", "h3", "h4", "b", "strong"],
        limit=10,
    ):
        value = normalize_spaces(prev.get_text(" ", strip=True))
        if not value or len(value) > 700:
            continue
        if value not in parts:
            parts.append(value)
        if sum(len(x) for x in parts) > 2200:
            break
    parts.reverse()
    return " ".join(parts[-8:])



def extract_html_tables(filing):
    raw_html = (filing or {}).get("raw_html") or ""
    if not raw_html:
        return []

    soup = BeautifulSoup(raw_html, "lxml")
    records = []

    for index, table in enumerate(soup.find_all("table")):
        rows = []
        for tr in table.find_all("tr"):
            cells = [
                normalize_spaces(cell.get_text(" ", strip=True))
                for cell in tr.find_all(["th", "td"], recursive=False)
            ]
            cells = [cell for cell in cells if cell != ""]
            if cells:
                rows.append(cells)

        if not rows:
            continue

        context = _table_context(table)
        table_text = normalize_spaces(table.get_text(" ", strip=True))
        table_scale = _explicit_table_scale(table_text)
        context_scale = _explicit_table_scale(context)

        records.append({
            "index": index,
            "rows": rows,
            "context": context,
            "text": table_text,
            "table_semantic_text": _semantic_label(table_text),
            "semantic_text": _semantic_label(f"{context} {table_text}"),
            # An explicit unit inside the table itself governs the table.
            # Surrounding prose is only a fallback.
            "scale": table_scale or context_scale or 1_000_000,
        })

    return records

CATEGORY_CUES = {
    "segments": [
        "segment information", "reportable segment", "operating segment",
        "business segment", "segment revenue", "segment revenues",
        "net revenues by segment", "revenue by segment",
    ],
    "end_markets": [
        "disaggregated revenue", "disaggregation of revenue",
        "product and service offerings", "product and service",
        "revenue by product", "revenue by category", "net sales by category",
        "net sales by product", "end market", "revenue by market",
    ],
    "geography": [
        "geographic", "geographical", "revenue by country",
        "revenue by region", "customers were located", "customer location",
        "net sales by geographic", "revenue by geographic",
    ],
}


GENERIC_STRONG_CUES = {
    "segments": [
        "reportable segment",
        "reportable segments",
        "operating segment",
        "operating segments",
        "business segment",
        "business segments",
        "segment information",
        "segment revenues",
        "segment revenue",
        "net revenues by segment",
        "revenue by segment",
        "net sales by segment",
    ],
    "end_markets": [
        "disaggregated revenue",
        "disaggregation of revenue",
        "significant product and service offerings",
        "product and service offerings",
        "revenue by product",
        "net sales by product",
        "product sales",
        "sales by product",
        "product category",
        "product categories",
        "sales by product category",
        "revenue by product category",
        "revenue by category",
        "sales to wholesale customers",
        "direct to consumer",
        "net sales by category",
        "revenue by market",
        "end market",
    ],
    "geography": [
        "revenue by geographic",
        "revenues by geographic",
        "net sales by geographic",
        "revenue by country",
        "revenue by region",
        "geographic revenue",
        "geographical revenue",
        "customers were located",
        "customer location",
        "major geographic areas",
    ],
}

GENERIC_GEOGRAPHIC_LABELS = {
    "united states", "u s", "u.s", "us", "international",
    "north america", "south america", "latin america", "americas",
    "europe", "emea", "europe middle east africa",
    "asia", "asia pacific", "apac", "china", "greater china",
    "japan", "canada", "mexico", "middle east", "africa",
    "rest of world", "rest of the world", "other countries",
    "non u s", "non-us", "non u.s", "non-u.s",
}

GENERIC_LOW_INFORMATION_LABELS = {
    "other", "others", "all other", "all others",
    "corporate", "eliminations", "reconciling items",
}



GENERIC_ACCOUNTING_ROW_EXACT = {
    "revenue", "revenues", "net revenue", "net revenues",
    "total revenue", "total revenues",
    "sales", "net sales", "total sales", "total net sales",
    "organic revenue", "organic revenues",
    "segment revenue", "segment revenues",
    "total segment revenue", "total segment revenues",
    "sales and other operating revenue",
    "sales and other operating revenues",
    "sales and other operating revenues before elimination",
    "operating income", "operating loss",
    "income from operations", "loss from operations",
    "net income", "net earnings", "net loss",
    "income before income taxes", "income before taxes",
    "income tax expense", "provision for income taxes",
    "interest income", "interest expense", "net interest income",
    "other income", "other expense", "other income expense",
    "cost of revenue", "cost of revenues", "cost of sales",
    "cost of goods sold",
    "selling general and administrative",
    "selling general administrative",
    "selling general and administrative expenses",
    "research and development",
    "research and development expense",
    "compensation and benefits",
    "information technology",
    "premises",
    "depreciation and amortization",
    "depreciation amortization and accretion",
    "stock based compensation expense",
    "capital expenditures",
    "total assets", "assets",
    "total liabilities", "liabilities",
    "cash and cash equivalents",
    "accounts receivable",
    "loans and leases",
    "debt securities",
    "net investment gains losses",
    "net derivative gains losses",
    "investment hedge adjustments",
    "mrb remeasurement gains losses",
    "intersegment revenue elimination",
    "intersegment product transfers",
    "amounts eliminated in consolidation",
    "third parties",
    "total",
    "subtotal",
    "eliminations",
    "reconciling items",
    "adjusted ebitda",
    "adjusted ebitdac",
    "segment adjusted ebitda",
    "ebit",
    "earnings before interest and taxes",
    "earnings loss before interest and taxes",
    "segment profit",
    "gross margin",
    "gross profit",
    "operating non gaap gross profit",
    "operating non gaap gross margin",
    "revenues before reimbursements",
    "revenue before reimbursements",
    "income from discontinued operations before taxes",
    "net income from discontinued operations",
    "transaction costs",
    "impairment charges",
    "fas cas service cost adjustment",
    "other income net",
    "fuel",
    "personnel",
    "average assets",
    "preferred dividends",
    "adjusted ebita",
}

GENERIC_ACCOUNTING_ROW_TOKENS = (
    "expense", "expenses",
    "gain loss", "gains losses",
    "remeasurement", "hedge adjustment",
    "depreciation", "amortization", "accretion",
    "stock based compensation",
    "weighted average shares",
    "income tax", "tax expense",
    "interest expense", "interest income",
    "cost of ", "costs of ",
    "selling general", "general and administrative",
    "accounts receivable", "accounts payable",
    "cash flow", "cash flows",
    "capital expenditure",
    "total assets", "total liabilities",
    "before elimination", "elimination",
    "intersegment",
    "ebitda", "ebitdac",
    "earnings before interest and taxes",
    "earnings loss before interest and taxes",
    "gross margin", "gross profit",
    "segment profit",
    "service cost adjustment",
    "preferred stock dividend",
    "dividends accumulated",
    "revenues before reimbursement",
    "revenue before reimbursement",
    "discontinued operations",
    "transaction costs",
    "impairment charges",
    "revenue attributed to business activities",
    "revenues attributed to business activities",
    "refinery crude unit inputs",
    "unit inputs",
    "production",
    "includes sales of affiliates",
    "other income net",
)


def _generic_row_is_heading_metric_or_total(name, category=None):
    raw = normalize_spaces(name).strip()
    low = _semantic_label(raw)

    if not low:
        return True

    # Numeric cells and year labels can become the first HTML cell after SEC
    # rowspan/colspan flattening. They are never business categories.
    if re.fullmatch(r"[$()+,\d.%-]+", raw):
        return True
    if re.fullmatch(r"(?:year\s+)?20\d{2}", low):
        return True
    if re.fullmatch(r"fiscal\s+20\d{2}", low):
        return True
    if re.fullmatch(r"20\d{2}\s+(?:vs|versus)\s+20\d{2}", low):
        return True
    if low in {"end market", "end markets", "totals"}:
        return True
    if low.startswith(("year ended", "years ended", "year end", "years end")):
        return True
    if low.startswith((
        "in millions", "in thousands", "in billions",
        "dollars in millions", "dollars in thousands", "dollars in billions",
    )):
        return True
    if "except per share data" in low:
        return True
    if re.match(r"^\d+\s+(?:includes?|excludes?|represents?)\b", low):
        return True

    if low in GENERIC_LOW_INFORMATION_LABELS:
        return True
    if low in GENERIC_ACCOUNTING_ROW_EXACT:
        return True

    if low.startswith(("total ", "subtotal ")):
        return True

    if any(token in low for token in GENERIC_ACCOUNTING_ROW_TOKENS):
        return True

    if category == "segments":
        if low in {
            "reportable segments",
            "nonreportable segments",
            "products",
            "systems",
            "beverage",
            "food",
        }:
            return True

        segment_metric_tokens = (
            "salaries and employee benefits",
            "purchased transportation",
            "rentals and landing fees",
            "maintenance and repairs",
            "business optimization costs",
            "intercompany allocations",
            "segment allocations",
            "average assets",
            "discount and interchange fees",
            "service charges and other customer",
            "revenue reduction from other sources",
            "earned premiums",
            "net income available",
            "net income excluding",
            "net costs for significant litigation",
            "transformation costs",
            "adjusted ebita",
            "preferred dividends",
            "equity in earnings",
            "capital investments",
            "fuel used in electric generation",
            "operation maintenance and other",
            "property and other taxes",
            "direct operating",
            "additions to property and equipment",
            "fixed compensation",
            "variable compensation",
            "other segment items",
            "net income attributable to controlling interests",
        )
        if any(token in low for token in segment_metric_tokens):
            return True

    # Metric rows frequently use these words as the complete role of the row.
    if category == "segments" and low.startswith(("revenue ", "revenues ")):
        return True
    if low.endswith((" revenue", " revenues")) and category == "segments":
        return True
    if low.endswith((" income", " loss", " expense", " expenses")):
        return True

    return False


def _generic_table_looks_like_product_table(record):
    semantic = record.get("semantic_text") or ""
    table_semantic = record.get("table_semantic_text") or ""

    product_cues = (
        "product sales",
        "sales by product",
        "revenue by product",
        "net sales by product",
        "product category",
        "product categories",
        "sales by product category",
        "revenue by product category",
        "sales to wholesale customers",
        "direct to consumer",
        "significant product and service offerings",
        "product and service offerings",
        "disaggregated revenue",
        "disaggregation of revenue",
    )
    return any(_semantic_label(cue) in table_semantic for cue in product_cues) or (
        "product sales" in semantic and "segment revenue" not in table_semantic
    )


def _generic_name_looks_geographic(name):
    low = _semantic_label(name)
    if low in GENERIC_GEOGRAPHIC_LABELS:
        return True

    geographic_tokens = (
        "united states", "u s", "outside the u s", "in the u s",
        "north america", "south america", "latin america",
        "europe", "emea", "asia", "apac", "apjc", "china", "japan", "canada",
        "mexico", "middle east", "africa", "international", "americas",
        "oceania", "caribbean", "other countries", "non u s",
    )
    return any(token in low for token in geographic_tokens)


def _generic_table_has_strong_cue(record, category):
    semantic = record.get("semantic_text") or ""
    table_semantic = record.get("table_semantic_text") or ""

    strong = [
        _semantic_label(cue)
        for cue in GENERIC_STRONG_CUES.get(category, [])
    ]
    if not any(cue in semantic for cue in strong):
        return False

    revenue_tokens = (
        "revenue", "revenues", "net sales", "sales",
        "net operating revenues", "total net revenue",
    )
    if not any(token in semantic for token in revenue_tokens):
        return False

    # A geography table inside a broad "Segment Information and Geographic Data"
    # note should not become a business segment table just because the note title
    # contains the word segment.
    if category == "segments":
        direct_segment_cue = any(cue in table_semantic for cue in strong)
        geo_cues = [
            _semantic_label(cue)
            for cue in GENERIC_STRONG_CUES["geography"]
        ]
        direct_geo_cue = any(cue in table_semantic for cue in geo_cues)

        if direct_geo_cue and not direct_segment_cue:
            return False

        # A product-sales/disaggregated-revenue table can live inside a Segment
        # Information note. It is useful, but it belongs under end markets /
        # products rather than reportable business segments.
        if _generic_table_looks_like_product_table(record) and not direct_segment_cue:
            return False

        # Generic segment discovery is intentionally denominator-gated later.
        # This prevents bank interest-bearing-asset tables and similar
        # accounting schedules from being called reportable segments.

    if category == "end_markets":
        geo_cues = [
            _semantic_label(cue)
            for cue in GENERIC_STRONG_CUES["geography"]
        ]
        if any(cue in table_semantic for cue in geo_cues):
            direct_end_cue = any(cue in table_semantic for cue in strong)
            if not direct_end_cue:
                return False

    return True


def _generic_discovery_rows_are_credible(rows, record, category, total_revenue=None):
    rows = list(rows or [])
    if len(rows) < 2:
        return False

    names = [_semantic_label(row.get("name")) for row in rows]

    if any(_generic_row_is_heading_metric_or_total(name, category) for name in names):
        return False

    meaningful = [
        name for name in names
        if name and name not in GENERIC_LOW_INFORMATION_LABELS
    ]
    if len(meaningful) < 2:
        return False

    ratio = _rows_sum_ratio(rows, total_revenue)

    if category == "segments":
        # Without a denominator there is no safe way to distinguish a segment
        # revenue table from the many other numeric schedules inside a Segment
        # Information note (bank asset yields, insurance investment schedules,
        # etc.). Missing is preferable to a false segment map.
        if not total_revenue:
            return False

        if len(rows) > 12:
            return False

        geo_count = sum(
            1 for row in rows
            if _generic_name_looks_geographic(row.get("name"))
        )
        geo_share = geo_count / max(1, len(rows))

        table_semantic = record.get("table_semantic_text") or ""
        semantic = record.get("semantic_text") or table_semantic

        segment_cues = tuple(
            _semantic_label(cue)
            for cue in (
                "reportable segment",
                "reportable operating segment",
                "operating segment",
                "business segment",
                "segment revenue",
                "segment revenues",
                "revenue by segment",
                "net sales by segment",
            )
        )
        geography_cues = tuple(
            _semantic_label(cue)
            for cue in GENERIC_STRONG_CUES["geography"]
        )

        direct_segment_in_table = any(
            cue in table_semantic for cue in segment_cues
        )
        segment_in_context = any(
            cue in semantic for cue in segment_cues
        )
        geography_in_context = any(
            cue in semantic for cue in geography_cues
        )

        # SEC captions are frequently outside the <table>. Accept an explicit
        # segment caption from local context unless the same local context is
        # clearly identifying the table as a geographic-revenue disclosure.
        explicit_segment_table = (
            direct_segment_in_table
            or (segment_in_context and not geography_in_context)
        )

        # For an unconfigured issuer, a mostly geographic row set is safer as
        # geography than as reportable segments, even if the surrounding note
        # happens to mention "segments".
        if geo_share >= 0.80 and not explicit_segment_table:
            return False

        if _generic_table_looks_like_product_table(record) and not explicit_segment_table:
            return False

        # Generic reportable segments must form a near-company-level additive
        # set. This deliberately rejects partial profit schedules and sub-tables
        # such as CAT/IBM/GE/EQIX unless a dedicated parser is later added.
        if ratio is None or ratio < 0.70 or ratio > 1.12:
            return False

    elif category == "end_markets":
        # Without a configured scope, a tiny partial product/service table is
        # more misleading than useful. Generic mixes should represent a
        # meaningful company-level breakdown.
        if ratio is not None and (ratio < 0.50 or ratio > 1.12):
            return False
        if len(rows) > 20:
            return False

    elif category == "geography":
        geographic_share = sum(
            1 for row in rows
            if _generic_name_looks_geographic(row.get("name"))
        ) / max(1, len(rows))

        if geographic_share < 0.60:
            return False
        if ratio is not None and ratio > 1.12:
            return False
        # Generic geography should be a company-level breakdown, not a
        # segment-only or partial regional schedule.
        if ratio is None or ratio < 0.70:
            return False

    return True


def _sanitize_generic_category_overlap(
    segments,
    end_markets,
    geography,
    total_revenue=None,
):
    """
    Final conservative guard for unconfigured issuers.
    """
    def sanitize(rows, category):
        cleaned = []
        for row in rows or []:
            if _generic_row_is_heading_metric_or_total(row.get("name"), category):
                continue
            if _row_name_is_bad_for_category(row.get("name"), category):
                continue
            cleaned.append(row)
        return cleaned

    segments = sanitize(segments, "segments")
    end_markets = sanitize(end_markets, "end_markets")
    geography = sanitize(geography, "geography")

    def names(rows):
        return {
            _semantic_label(row.get("name"))
            for row in rows
            if row.get("name")
        }

    seg_names = names(segments)
    geo_names = names(geography)
    end_names = names(end_markets)

    if segments:
        if len(segments) < 2:
            segments = []
            seg_names = set()
        else:
            geographic_share = sum(
                1 for row in segments
                if _generic_name_looks_geographic(row.get("name"))
            ) / max(1, len(segments))

            overlap = (
                len(seg_names & geo_names) / max(1, len(seg_names))
                if geo_names else 0.0
            )
            if overlap >= 0.50 and geographic_share >= 0.50:
                segments = []
                seg_names = set()

            ratio = _rows_sum_ratio(segments, total_revenue)
            if ratio is not None and (ratio < 0.70 or ratio > 1.12):
                segments = []
                seg_names = set()

    if end_markets:
        if len(end_markets) < 2:
            end_markets = []
            end_names = set()
        else:
            overlap = (
                len(end_names & seg_names) / max(1, len(end_names))
                if seg_names else 0.0
            )
            if overlap >= 0.80:
                end_markets = []
                end_names = set()

            ratio = _rows_sum_ratio(end_markets, total_revenue)
            if ratio is not None and (ratio < 0.50 or ratio > 1.12):
                end_markets = []
                end_names = set()

    if geography:
        if len(geography) < 2:
            geography = []
        else:
            geo_names_now = names(geography)
            geographic_share = sum(
                1 for row in geography
                if _generic_name_looks_geographic(row.get("name"))
            ) / max(1, len(geography))

            # If the exact same business rows were discovered as both segments
            # and geography (CAT-style cross-classification), business segments
            # win unless the geography rows actually look geographic.
            overlap_with_segments = (
                len(geo_names_now & names(segments)) / max(1, len(geo_names_now))
                if segments else 0.0
            )
            if geographic_share < 0.60:
                geography = []
            elif overlap_with_segments >= 0.50 and geographic_share < 0.80:
                geography = []
            else:
                ratio = _rows_sum_ratio(geography, total_revenue)
                if ratio is None or ratio < 0.70 or ratio > 1.12:
                    geography = []

    return segments, end_markets, geography


CATEGORY_NEGATIVE_CUES = {
    "segments": [
        "consolidated statements of income", "consolidated balance sheets",
        "cash flows", "weighted average shares", "inventory",
        "marketable securities", "accounts receivable",
    ],
    "end_markets": [
        "consolidated balance sheets", "cash flows", "inventory",
        "marketable securities", "long lived assets",
    ],
    "geography": [
        "loans by state", "retained loans", "past due", "charge offs",
        "credit quality", "long lived assets", "property plant and equipment",
    ],
}

def _table_label_hits(record, labels):
    text = record.get("semantic_text") or ""
    hits = []
    for label in labels or []:
        target = _semantic_label(label)
        if target and re.search(rf"\b{re.escape(target)}\b", text):
            hits.append(label)
    return hits



def _table_category_score(record, labels, category):
    semantic = record.get("semantic_text") or ""
    table_semantic = record.get("table_semantic_text") or _semantic_label(record.get("text") or "")
    hits = _table_label_hits(record, labels)

    score = len(hits) * 8
    cues = CATEGORY_CUES.get(category, [])
    negatives = CATEGORY_NEGATIVE_CUES.get(category, [])

    cue_hits = sum(1 for cue in cues if _semantic_label(cue) in semantic)
    negative_hits = sum(1 for cue in negatives if _semantic_label(cue) in semantic)
    score += cue_hits * 4
    score -= negative_hits * 7

    revenue_tokens = (
        "revenue", "revenues", "net sales", "sales",
        "net operating revenues", "total net revenue",
    )
    # SEC often places the disclosure caption in the paragraph immediately
    # before the HTML table, leaving the table itself with only labels/numbers.
    # The record semantic text includes that local context.
    has_table_revenue_language = any(token in semantic for token in revenue_tokens)

    # Every category in this payload is a revenue/sales breakdown. A table that
    # merely happens to contain segment names, countries, or product names is
    # not enough (e.g. assets, capital allocations, stores, loan balances).
    if labels and not has_table_revenue_language:
        score -= 30

    if category == "geography":
        has_geo_language = cue_hits > 0
        if not (has_table_revenue_language and has_geo_language):
            score -= 20

    return score, hits


def _table_year_tokens(record):
    years = []
    for row in (record.get("rows") or [])[:12]:
        for cell in row:
            compact = normalize_spaces(cell).strip()
            for match in re.findall(r"\b(20\d{2})\b", compact):
                years.append(int(match))
    return years


def _header_year_sequence(record):
    """Return the most likely display-order fiscal year sequence for a table."""
    best = []
    for row in (record.get("rows") or [])[:16]:
        row_years = []
        for cell in row:
            row_years.extend(int(y) for y in re.findall(r"\b(20\d{2})\b", normalize_spaces(cell)))
        # SEC tables usually expose 2-4 year headers on one row. Preserve display order.
        if 2 <= len(row_years) <= 8 and len(row_years) > len(best):
            best = row_years
    if best:
        return best
    return _table_year_tokens(record)


def _select_current_prior(values, record, mode="annual"):
    values = [v for v in values if v is not None]
    if not values:
        return None, None
    if len(values) == 1:
        return values[0], None

    years = _header_year_sequence(record)

    # Most SEC row-layout tables have N numeric values matching an N-year header.
    if years:
        # If the year row has more tokens than this metric row, use the first
        # repeated year group whose width matches the row (quarter/YTD tables).
        unique_order = []
        for y in years:
            if y not in unique_order:
                unique_order.append(y)

        candidate_years = None
        if len(years) == len(values):
            candidate_years = years
        elif len(unique_order) == len(values):
            candidate_years = unique_order
        elif len(years) >= len(values) and len(values) in (2, 3, 4):
            # Prefer a contiguous header slice with distinct years.
            for i in range(0, len(years)-len(values)+1):
                chunk = years[i:i+len(values)]
                if len(set(chunk)) == len(values):
                    candidate_years = chunk
                    break

        if candidate_years and len(candidate_years) == len(values):
            latest = max(candidate_years)
            cur_i = max(i for i,y in enumerate(candidate_years) if y == latest)
            prior_years = sorted({y for y in candidate_years if y < latest}, reverse=True)
            prior_i = None
            if prior_years:
                prior_i = max(i for i,y in enumerate(candidate_years) if y == prior_years[0])
            return values[cur_i], values[prior_i] if prior_i is not None else None

    # SEC convention is commonly newest-to-oldest, so this is the conservative
    # fallback only when a reliable header-year mapping cannot be established.
    return values[0], values[1] if len(values) > 1 else None

REVENUE_METRIC_LABELS = (
    "sales and other operating revenue",
    "sales and other operating revenues",
    "revenues and other income",
    "net operating revenues",
    "total net operating revenues",
    "total net revenue",
    "total net revenues",
    "net revenues",
    "net revenue",
    "net sales",
    "total segment revenues",
    "segment revenues",
    "total revenues",
    "total revenue",
    "revenues",
    "revenue",
    "sales",
    "total sales",
)


def _is_revenue_metric_cell(cell):
    low = _semantic_label(cell)
    if not low:
        return False
    return any(
        low == metric or low.startswith(metric + " ")
        for metric in REVENUE_METRIC_LABELS
    )


def _extract_numeric_values(row, scale):
    values = []
    for cell in row:
        value = _numeric_from_cell(cell, scale)
        if value is not None:
            values.append(value)
    return values


def _configured_labels_in_row(row, labels):
    found = []
    for cell in row:
        for label in labels or []:
            if _row_matches_label(cell, label):
                if label not in found:
                    found.append(label)
    return found


def _extract_column_matrix_rows(record, labels, total_revenue=None, mode="annual"):
    """Parse tables where business labels are columns and revenue is a metric row."""
    rows = record.get("rows") or []
    scale = record.get("scale") or 1_000_000
    best = []

    for h_idx, header in enumerate(rows):
        header_labels = _configured_labels_in_row(header, labels)
        if len(header_labels) < 2:
            continue

        for metric_row in rows[h_idx + 1:h_idx + 20]:
            if not any(_is_revenue_metric_cell(cell) for cell in metric_row):
                continue
            values = _extract_numeric_values(metric_row, scale)
            if len(values) < len(header_labels):
                continue

            # Ignore trailing consolidated totals when evenly grouping the segment columns.
            per_label = max(1, len(values) // len(header_labels))
            usable = per_label * len(header_labels)
            groups = [values[i*per_label:(i+1)*per_label] for i in range(len(header_labels))]
            year_seq = _header_year_sequence(record)
            unique_years = []
            for y in year_seq:
                if y not in unique_years:
                    unique_years.append(y)

            candidate=[]
            for label, group in zip(header_labels, groups):
                if not group:
                    continue

                # XOM-style single-year matrices split each segment into U.S. and Non-U.S.
                # subcolumns. In that layout, sum the subcolumns rather than treating the
                # second subcolumn as a prior period.
                if len(unique_years) == 1 and len(group) > 1:
                    current = sum(group)
                    prior = None
                elif len(group) > 1 and len(unique_years) >= 2:
                    # If the same year set repeats for every segment, map this group
                    # against the first per-label year group.
                    group_years = year_seq[:len(group)] if len(year_seq) >= len(group) else unique_years[:len(group)]
                    pseudo = dict(record)
                    pseudo["rows"] = [[str(y) for y in group_years]]
                    current, prior = _select_current_prior(group, pseudo, mode)
                else:
                    current, prior = group[0], None

                if current is None:
                    continue
                if total_revenue and current > total_revenue * 1.30:
                    continue
                ratio=safe_ratio(current,total_revenue)
                candidate.append({
                    "name":label,
                    "revenue":current,
                    "prior_period_revenue":prior,
                    "yoy_growth":pct_growth(current,prior),
                    "mix_pct":ratio*100 if ratio is not None else None,
                    "mode":mode,
                    "source":"sec_html_table_matrix",
                    "table_index":record.get("index"),
                })

            if len(candidate)>len(best):
                best=candidate
    return best



def extract_metric_section_rows_from_filing(
    filing,
    labels,
    category,
    metric_phrase,
    total_revenue=None,
    mode="annual",
):
    """
    Extract configured row labels from one explicit accounting section inside a
    table that may reuse the same labels for another metric.

    P&G is the canonical case:
      NET SALES
        United States
        International
      LONG-LIVED ASSETS
        United States
        International

    Without the metric boundary, the two geography labels are ambiguous.
    """
    if not labels or not metric_phrase:
        return []

    target_metric = _semantic_label(metric_phrase)
    label_order = {_semantic_label(label): i for i, label in enumerate(labels)}
    best = []

    for record in extract_html_tables(filing):
        rows = record.get("rows") or []
        semantic = record.get("semantic_text") or ""
        if target_metric not in semantic:
            continue

        scale = record.get("scale") or 1_000_000
        years = _header_year_sequence(record)
        unique_years = []
        for year in years:
            if year not in unique_years:
                unique_years.append(year)

        for start_idx, row in enumerate(rows):
            if not any(
                _semantic_label(cell) == target_metric
                or _semantic_label(cell).startswith(target_metric + " ")
                for cell in row
            ):
                continue

            found = []
            # Walk only within this accounting section. A new all-caps/known
            # metric heading ends the section.
            for scan_idx in range(start_idx + 1, min(len(rows), start_idx + 14)):
                candidate_row = rows[scan_idx]
                row_text = " ".join(normalize_spaces(cell) for cell in candidate_row if normalize_spaces(cell))
                row_sem = _semantic_label(row_text)

                if scan_idx > start_idx + 1 and any(token in row_sem for token in (
                    "long lived assets",
                    "total assets",
                    "income taxes",
                    "operating income",
                    "segment profit",
                )):
                    break

                matched_label = None
                label_idx = None
                for label in labels:
                    for idx, cell in enumerate(candidate_row):
                        if _row_matches_label(cell, label):
                            matched_label = label
                            label_idx = idx
                            break
                    if matched_label is not None:
                        break

                if matched_label is None:
                    continue

                values = []
                for cell in candidate_row[label_idx + 1:]:
                    value = _numeric_from_cell(cell, scale)
                    if value is not None:
                        values.append(value)

                if not values:
                    continue

                current, prior = _select_current_prior(values, record, mode)
                if current is None:
                    continue
                if total_revenue and current > total_revenue * 1.30:
                    continue

                ratio = safe_ratio(current, total_revenue)
                found.append({
                    "name": matched_label,
                    "revenue": current,
                    "prior_period_revenue": prior,
                    "yoy_growth": pct_growth(current, prior),
                    "mix_pct": ratio * 100 if ratio is not None else None,
                    "mode": mode,
                    "source": "sec_html_metric_section_override",
                    "table_index": record.get("index"),
                })

            deduped = {}
            for item in found:
                deduped[_semantic_label(item["name"])] = item
            candidate = list(deduped.values())
            candidate.sort(key=lambda item: label_order.get(_semantic_label(item["name"]), 999))

            if len(candidate) > len(best):
                best = candidate

    return clean_category_rows(best, category, total_revenue=total_revenue)



def _explicit_metric_numeric_from_cell(cell, scale, dash_as_zero=False):
    raw = normalize_spaces(cell).strip()
    if not raw:
        return None

    if raw in {"—", "–", "-"}:
        return 0.0 if dash_as_zero else None

    if raw in {"$", "N/A", "n/a"} or "%" in raw:
        return None

    compact = raw.replace("$", "").replace(",", "").strip()
    # Reject plain four-digit calendar-year cells, but preserve explicitly
    # formatted financial amounts such as "1,950" million or "$2,025".
    # Once punctuation/currency makes the cell clearly monetary, values in the
    # 1900-2100 numeric range are legitimate data.
    plain_year_candidate = raw.strip().strip("()")
    if (
        re.fullmatch(r"\d{4}", plain_year_candidate)
        and "," not in raw
        and "$" not in raw
        and "." not in raw
    ):
        possible_year = int(plain_year_candidate)
        if 1900 <= possible_year <= 2100:
            return None

    match = re.search(r"\(?-?\d[\d,]*(?:\.\d+)?\)?", raw)
    if not match:
        return None

    value = safe_float(match.group(0))
    if value is None:
        return None
    return value * scale



def extract_configured_segment_row_metric_from_filing(
    filing,
    labels,
    metric_phrase,
    total_revenue=None,
    mode="annual",
):
    """
    Parse a configured row-oriented segment table where a named accounting
    metric appears in the header and reportable segments are rows.

    Capital One is the canonical example. Its annual segment table presents:
      Total Net Revenue Amount | % of Total | Net Income Amount | % of Total
    repeated by year. The first non-percentage amount after each segment label
    is therefore current-year Total Net Revenue.
    """
    if not labels or not metric_phrase:
        return []

    target_metric = _semantic_label(metric_phrase)
    best = []

    for record in extract_html_tables(filing):
        semantic = record.get("semantic_text") or ""
        table_semantic = record.get("table_semantic_text") or ""
        if target_metric not in semantic and target_metric not in table_semantic:
            continue

        hits = _table_label_hits(record, labels)
        if len(hits) < 2:
            continue

        scale = record.get("scale") or 1_000_000
        candidate = []

        for label in labels:
            target_label = _semantic_label(label)
            found = None

            # Prefer an exact row label; fall back to standard configured label
            # matching for SEC footnote suffixes such as Commercial Banking(1).
            for row in record.get("rows") or []:
                label_idx = None
                for idx, cell in enumerate(row):
                    if _semantic_label(cell) == target_label:
                        label_idx = idx
                        break
                if label_idx is None:
                    for idx, cell in enumerate(row):
                        if _row_matches_label(cell, label):
                            label_idx = idx
                            break
                if label_idx is None:
                    continue

                values = []
                for cell in row[label_idx + 1:]:
                    value = _explicit_metric_numeric_from_cell(
                        cell,
                        scale,
                        dash_as_zero=True,
                    )
                    if value is not None:
                        values.append(value)

                if not values:
                    continue

                current = values[0]
                if total_revenue and current > total_revenue * 1.30:
                    continue

                ratio = safe_ratio(current, total_revenue)
                found = {
                    "name": label,
                    "revenue": current,
                    # Prior-year revenue is intentionally left null here rather
                    # than guessing across alternating Amount/%/income groups.
                    "prior_period_revenue": None,
                    "yoy_growth": None,
                    "mix_pct": ratio * 100 if ratio is not None else None,
                    "mode": mode,
                    "source": "sec_html_configured_segment_row_metric",
                    "table_index": record.get("index"),
                }
                break

            if found is not None:
                candidate.append(found)

        if len(candidate) > len(best):
            best = candidate

    return clean_category_rows(best, "segments", total_revenue=total_revenue)


def extract_individual_segment_metric_tables_from_filing(
    filing,
    labels,
    metric_phrase,
    total_revenue=None,
    mode="annual",
    scale_override=None,
):
    """
    Parse issuers that publish one dedicated business-results table per
    reportable segment. Capital One is the canonical example: Credit Card,
    Consumer Banking and Commercial Banking each have their own annual table
    with a 'Total net revenue' row.

    This avoids confusing those tables with the separate revenue-from-contracts
    disaggregation, which uses the same segment labels but much smaller values.
    """
    if not labels or not metric_phrase:
        return []

    target_metric = _semantic_label(metric_phrase)
    results = []

    for label in labels:
        target_label = _semantic_label(label)
        candidates = []

        for record in extract_html_tables(filing):
            semantic = record.get("semantic_text") or ""
            table_semantic = record.get("table_semantic_text") or ""
            combined = f"{semantic} {table_semantic}"

            # Require the segment identity in local table context and the
            # configured accounting metric in the same record.
            if target_label not in combined or target_metric not in combined:
                continue

            # Dedicated business-results tables are preferred over wide tables
            # that mention multiple reportable segment names.
            other_hits = sum(
                1 for other in labels
                if _semantic_label(other) in combined
                and _semantic_label(other) != target_label
            )

            scale = scale_override or record.get("scale") or 1_000_000
            years = _header_year_sequence(record)
            unique_years = []
            for year in years:
                if year not in unique_years:
                    unique_years.append(year)

            for row in record.get("rows") or []:
                metric_idx = None
                exact_metric = False
                for idx, cell in enumerate(row):
                    sem = _semantic_label(cell)
                    if sem == target_metric:
                        metric_idx = idx
                        exact_metric = True
                        break
                    if sem.startswith(target_metric + " "):
                        metric_idx = idx
                        break
                if metric_idx is None:
                    continue

                values = []
                for cell in row[metric_idx + 1:]:
                    value = _explicit_metric_numeric_from_cell(cell, scale)
                    if value is not None:
                        values.append(value)
                if not values:
                    continue

                pseudo = dict(record)
                if unique_years:
                    pseudo["rows"] = [[str(y) for y in unique_years]]
                current, prior = _select_current_prior(values, pseudo, mode)
                if current is None:
                    continue

                # These are explicit issuer-specific segment tables. Do not let
                # a preliminary consolidated-revenue guess reject a valid row;
                # the complete segment set repairs the mix denominator later.
                ratio = safe_ratio(current, total_revenue)
                candidate = {
                    "name": label,
                    "revenue": current,
                    "prior_period_revenue": prior,
                    "yoy_growth": pct_growth(current, prior),
                    "mix_pct": ratio * 100 if ratio is not None else None,
                    "mode": mode,
                    "source": "sec_html_individual_segment_metric_table",
                    "table_index": record.get("index"),
                }

                score = 0
                if exact_metric:
                    score += 100
                if f"{target_label} business results" in combined:
                    score += 200
                elif "business results" in combined:
                    score += 100
                score -= other_hits * 50
                if prior is not None:
                    score += 20

                candidates.append((score, current, candidate))

        if candidates:
            candidates.sort(key=lambda item: (item[0], item[1]), reverse=True)
            results.append(candidates[0][2])

    order = {_semantic_label(label): i for i, label in enumerate(labels)}
    results.sort(key=lambda row: order.get(_semantic_label(row.get("name")), 999))
    return clean_category_rows(results, "segments", total_revenue=total_revenue)


def extract_segment_year_block_metric_from_filing(
    filing,
    labels,
    metric_phrase,
    total_revenue=None,
    mode="annual",
):
    """
    Parse a configured segment table where each segment owns its own repeated
    year block on one metric row.

    PNC is the canonical layout:
      Retail Banking          2025 2024 2023
      C&IB                    2025 2024 2023
      Asset Management Group  2025 2024 2023

    A row such as Total revenue therefore contains:
      [RB2025,RB2024,RB2023,CIB2025,CIB2024,CIB2023,AMG2025,AMG2024,AMG2023]
    """
    if not labels or not metric_phrase:
        return []

    target_metric = _semantic_label(metric_phrase)
    best = []

    for record in extract_html_tables(filing):
        semantic = record.get("semantic_text") or ""
        if "segment" not in semantic:
            continue
        if len(_table_label_hits(record, labels)) < 2:
            continue
        if target_metric not in semantic:
            continue

        scale = record.get("scale") or 1_000_000
        years = _header_year_sequence(record)
        unique_years = []
        for year in years:
            if year not in unique_years:
                unique_years.append(year)

        if len(unique_years) < 2:
            continue

        year_count = len(unique_years)

        for row in record.get("rows") or []:
            metric_idx = None
            for idx, cell in enumerate(row):
                sem = _semantic_label(cell)
                if sem == target_metric or sem.startswith(target_metric + " "):
                    metric_idx = idx
                    break
            if metric_idx is None:
                continue

            values = []
            for cell in row[metric_idx + 1:]:
                value = _explicit_metric_numeric_from_cell(cell, scale)
                if value is not None:
                    values.append(value)

            needed = len(labels) * year_count
            if len(values) < needed:
                continue

            candidate = []
            for i, label in enumerate(labels):
                block = values[i * year_count:(i + 1) * year_count]
                if len(block) < year_count:
                    continue

                year_map = {
                    year: value
                    for year, value in zip(unique_years, block)
                }
                current_year = max(year_map)
                prior_years = sorted(
                    [year for year in year_map if year < current_year],
                    reverse=True,
                )

                current = year_map[current_year]
                prior = year_map[prior_years[0]] if prior_years else None

                if total_revenue and current > total_revenue * 1.30:
                    continue

                ratio = safe_ratio(current, total_revenue)
                candidate.append({
                    "name": label,
                    "revenue": current,
                    "prior_period_revenue": prior,
                    "yoy_growth": pct_growth(current, prior),
                    "mix_pct": ratio * 100 if ratio is not None else None,
                    "mode": mode,
                    "source": "sec_html_segment_year_block_metric",
                    "table_index": record.get("index"),
                })

            if len(candidate) > len(best):
                best = candidate

    return clean_category_rows(best, "segments", total_revenue=total_revenue)


def extract_named_segment_rows_from_filing(
    filing,
    row_mapping,
    context_phrase,
    total_revenue=None,
    mode="annual",
):
    """
    Extract exact configured revenue rows from a known segment-revenue section.

    This is intentionally narrow. It solves row-oriented disclosures where the
    same segment name also appears in unrelated geographic/assets/expense
    tables, e.g. FedEx and Allstate.
    """
    if not row_mapping or not context_phrase:
        return []

    context = _semantic_label(context_phrase)
    results = []

    for record in extract_html_tables(filing):
        semantic = record.get("semantic_text") or ""
        table_semantic = record.get("table_semantic_text") or ""
        if context not in semantic and context not in table_semantic:
            continue

        scale = record.get("scale") or 1_000_000

        for label, row_phrase in row_mapping.items():
            target = _semantic_label(row_phrase)
            best_row = None

            record_rows = record.get("rows") or []

            # First pass: exact semantic row label only.
            candidate_rows = []
            for row in record_rows:
                for idx, cell in enumerate(row):
                    if _semantic_label(cell) == target:
                        candidate_rows.append((row, idx))
                        break

            # Second pass only when no exact row exists.
            if not candidate_rows:
                for row in record_rows:
                    for idx, cell in enumerate(row):
                        cell_sem = _semantic_label(cell)
                        if cell_sem.startswith(target + " "):
                            candidate_rows.append((row, idx))
                            break

            for row, matched_idx in candidate_rows:

                values = []
                for cell in row[matched_idx + 1:]:
                    value = _explicit_metric_numeric_from_cell(
                        cell,
                        scale,
                        dash_as_zero=True,
                    )
                    if value is not None:
                        values.append(value)

                if not values:
                    continue

                current, prior = _select_current_prior(values, record, mode)
                if current is None:
                    continue

                if total_revenue and current > total_revenue * 1.30:
                    continue

                ratio = safe_ratio(current, total_revenue)
                best_row = {
                    "name": label,
                    "revenue": current,
                    "prior_period_revenue": prior,
                    "yoy_growth": pct_growth(current, prior),
                    "mix_pct": ratio * 100 if ratio is not None else None,
                    "mode": mode,
                    "source": "sec_html_named_segment_revenue_row",
                    "table_index": record.get("index"),
                    "allow_small": True,
                }
                break

            if best_row is not None:
                results.append(best_row)

    # Preserve configured order.
    order = {
        _semantic_label(label): i
        for i, label in enumerate(row_mapping.keys())
    }
    results.sort(
        key=lambda row: order.get(_semantic_label(row.get("name")), 999)
    )
    return clean_category_rows(results, "segments", total_revenue=total_revenue)


def extract_sparse_header_metric_matrix_from_filing(
    filing,
    labels,
    metric_phrase,
    total_revenue=None,
    mode="annual",
):
    """
    Parse a segment matrix where configured segment columns are separated by
    subtotal / corporate columns.

    NIKE is the canonical example: North America, EMEA, Greater China and APLA
    are followed by Global Brand Divisions and Total NIKE Brand before Converse.
    Mapping only the configured labels consecutively would therefore assign the
    NIKE Brand subtotal to Converse. This helper maps each configured label to
    its actual header-column position.
    """
    if not labels or not metric_phrase:
        return []

    target_metric = _semantic_label(metric_phrase)
    candidates_by_year = {}
    unlabeled_candidates = []

    for record in extract_html_tables(filing):
        semantic = record.get("semantic_text") or ""
        table_semantic = record.get("table_semantic_text") or ""

        # Configured sparse matrices are already high-confidence. Require the
        # explicit metric and at least two configured headers; do not require
        # the literal word "segment" to survive SEC HTML context flattening.
        if target_metric not in semantic and target_metric not in table_semantic:
            continue
        if len(_table_label_hits(record, labels)) < 2:
            continue

        rows = record.get("rows") or []
        scale = record.get("scale") or 1_000_000

        for h_idx, header in enumerate(rows):
            # Build the logical ordered header columns, excluding year/unit
            # headings. Retain subtotal/corporate headers because their positions
            # matter for sparse mapping even though they are not returned.
            logical_headers = []
            for cell in header:
                raw = normalize_spaces(cell).strip()
                low = _semantic_label(raw)
                if not raw:
                    continue
                if re.fullmatch(r"20\d{2}", low):
                    continue
                if low.startswith(("dollars in ", "in millions", "in thousands", "in billions")):
                    continue
                logical_headers.append(raw)

            matched = {}
            for label in labels:
                for pos, cell in enumerate(logical_headers):
                    if _row_matches_label(cell, label):
                        matched[_semantic_label(label)] = pos
                        break

            if len(matched) < 2:
                continue

            # Infer the year from this header or nearby rows above it.
            year = None
            year_text = " ".join(
                " ".join(row)
                for row in rows[max(0, h_idx - 3): h_idx + 1]
            )
            year_matches = [int(y) for y in re.findall(r"\b(20\d{2})\b", year_text)]
            if year_matches:
                year = max(year_matches)

            for metric_row in rows[h_idx + 1: min(len(rows), h_idx + 16)]:
                metric_idx = None
                for idx, cell in enumerate(metric_row):
                    sem = _semantic_label(cell)
                    if sem == target_metric or sem.startswith(target_metric + " "):
                        metric_idx = idx
                        break
                if metric_idx is None:
                    continue

                values = []
                for cell in metric_row[metric_idx + 1:]:
                    # In an explicit segment metric matrix, small values such as
                    # NIKE's $49M Global Brand Divisions revenue and $2M
                    # Corporate revenue are legitimate amounts, not footnote
                    # references. Preserve them so sparse header alignment does
                    # not shift later columns such as Converse.
                    raw_value = normalize_spaces(cell)
                    if not raw_value or "%" in raw_value or raw_value in {"—", "-", "–", "$", "N/A", "n/a"}:
                        continue
                    compact = raw_value.replace("$", "").replace(",", "").strip()
                    if re.fullmatch(r"\(?\d{4}\)?", compact):
                        possible_year = int(compact.strip("()"))
                        if 1900 <= possible_year <= 2100:
                            continue
                    match = re.search(r"\(?-?\d[\d,]*(?:\.\d+)?\)?", raw_value)
                    if not match:
                        continue
                    parsed = safe_float(match.group(0))
                    if parsed is not None:
                        values.append(parsed * scale)

                if len(values) < len(logical_headers):
                    continue

                # A few SEC tables include trailing consolidated metrics after
                # the logical segment columns. Only the aligned leading group is
                # relevant for header-position mapping.
                values = values[:len(logical_headers)]

                mapped = {}
                for label in labels:
                    pos = matched.get(_semantic_label(label))
                    if pos is None or pos >= len(values):
                        continue
                    value = values[pos]
                    if value is None:
                        continue
                    if total_revenue and value > total_revenue * 1.30:
                        continue
                    mapped[label] = value

                if len(mapped) < 2:
                    continue

                if year is not None:
                    previous = candidates_by_year.get(year)
                    if previous is None or len(mapped) > len(previous):
                        candidates_by_year[year] = mapped
                else:
                    unlabeled_candidates.append(mapped)
                break

    if candidates_by_year:
        years = sorted(candidates_by_year, reverse=True)
        current_map = candidates_by_year[years[0]]
        prior_map = candidates_by_year[years[1]] if len(years) > 1 else {}
    elif unlabeled_candidates:
        current_map = max(unlabeled_candidates, key=len)
        prior_map = {}
    else:
        return []

    result = []
    for label in labels:
        current = current_map.get(label)
        if current is None:
            continue
        prior = prior_map.get(label)
        ratio = safe_ratio(current, total_revenue)
        result.append({
            "name": label,
            "revenue": current,
            "prior_period_revenue": prior,
            "yoy_growth": pct_growth(current, prior),
            "mix_pct": ratio * 100 if ratio is not None else None,
            "mode": mode,
            "source": "sec_html_sparse_header_metric_matrix",
            "table_index": None,
        })

    return clean_category_rows(result, "segments", total_revenue=total_revenue)


def extract_forced_metric_matrix_from_filing(
    filing,
    labels,
    metric_phrase,
    total_revenue=None,
    mode="annual",
    require_segment_context=True,
    scale_override=None,
):
    """
    Parse a high-confidence segment matrix using the configured label order and
    an explicit metric row such as Travelers' 'Total segment revenues'.

    This deliberately bypasses ambiguous header-cell alignment only when the
    company config opts in to a named accounting metric.
    """
    if not labels or not metric_phrase:
        return []

    target_metric = _semantic_label(metric_phrase)
    best = []

    for record in extract_html_tables(filing):
        semantic = record.get("semantic_text") or ""
        # Require at least two configured labels. Most issuers also require
        # local "segment" context, but a few SEC tables lose that literal word
        # during HTML flattening even though the configured labels + metric row
        # uniquely identify the audited segment table (Capital One Table 18.1).
        label_hits = _table_label_hits(record, labels)
        if len(label_hits) < 2:
            continue
        if require_segment_context and "segment" not in semantic:
            continue

        scale = scale_override or record.get("scale") or 1_000_000

        for row in record.get("rows") or []:
            metric_idx = None
            for idx, cell in enumerate(row):
                cell_sem = _semantic_label(cell)
                if cell_sem == target_metric or cell_sem.startswith(target_metric + " "):
                    metric_idx = idx
                    break
            if metric_idx is None:
                continue

            values = []
            for cell in row[metric_idx + 1:]:
                value = _explicit_metric_numeric_from_cell(
                    cell,
                    scale,
                    dash_as_zero=True,
                )
                if value is not None:
                    values.append(value)

            n = len(labels)
            if len(values) < n:
                continue

            # Common SEC layouts:
            #   [seg1, seg2, seg3, total]
            # or repeated year groups:
            #   [seg1, seg2, seg3, total, seg1_prior, ...]
            group_width = n + 1 if len(values) >= n + 1 else n
            current_group = values[:group_width]
            current_values = current_group[:n]

            prior_values = [None] * n
            if len(values) >= group_width * 2:
                prior_group = values[group_width:group_width * 2]
                prior_values = prior_group[:n]

            rows = []
            for label, current, prior in zip(labels, current_values, prior_values):
                if current is None:
                    continue
                ratio = safe_ratio(current, total_revenue)
                rows.append({
                    "name": label,
                    "revenue": current,
                    "prior_period_revenue": prior,
                    "yoy_growth": pct_growth(current, prior),
                    "mix_pct": ratio * 100 if ratio is not None else None,
                    "mode": mode,
                    "source": "sec_html_table_forced_metric_matrix",
                    "table_index": record.get("index"),
                })

            if len(rows) > len(best):
                best = rows

    return clean_category_rows(best, "segments", total_revenue=total_revenue)



def extract_heading_metric_row_from_filing(
    filing,
    label,
    metric_phrase,
    total_revenue=None,
    mode="annual",
    scale_override=None,
):
    """
    Extract a metric that follows a named segment heading.

    Used only for explicit config overrides where SEC HTML splits a disclosure
    across sections/tables, e.g. Walmart Sam's Club U.S. Net sales and
    JPMorgan Corporate Total net revenue.
    """
    target_label = _semantic_label(label)
    target_metric = _semantic_label(metric_phrase)
    candidates = []

    for record in extract_html_tables(filing):
        rows = record.get("rows") or []
        scale = scale_override or record.get("scale") or 1_000_000
        years = _header_year_sequence(record)
        unique_years = []
        for year in years:
            if year not in unique_years:
                unique_years.append(year)

        for row_idx, row in enumerate(rows):
            if not any(_row_matches_label(cell, label) for cell in row):
                continue

            # Search the heading row and the local rows that follow it. Stop
            # before wandering far enough to enter another unrelated section.
            for metric_row in rows[row_idx: min(len(rows), row_idx + 16)]:
                metric_idx = None
                for idx, cell in enumerate(metric_row):
                    sem = _semantic_label(cell)
                    if sem == target_metric or sem.startswith(target_metric + " "):
                        metric_idx = idx
                        break

                if metric_idx is None:
                    continue

                values = []
                for cell in metric_row[metric_idx + 1:]:
                    value = _numeric_from_cell(cell, scale)
                    if value is not None:
                        values.append(value)

                if not values:
                    continue

                # If the row contains multiple column groups (e.g. JPM
                # Corporate + Total), the segment named by the heading is the
                # first year group.
                segment_values = values
                if unique_years and len(values) >= len(unique_years) * 2:
                    segment_values = values[:len(unique_years)]

                pseudo = dict(record)
                if unique_years:
                    pseudo["rows"] = [[str(y) for y in unique_years]]

                current, prior = _select_current_prior(segment_values, pseudo, mode)
                if current is None:
                    continue

                if total_revenue and current > total_revenue * 1.30:
                    continue

                ratio = safe_ratio(current, total_revenue)
                candidate = {
                    "name": label,
                    "revenue": current,
                    "prior_period_revenue": prior,
                    "yoy_growth": pct_growth(current, prior),
                    "mix_pct": ratio * 100 if ratio is not None else None,
                    "mode": mode,
                    "source": "sec_html_heading_metric_override",
                    "table_index": record.get("index"),
                }

                # Exact metric match and useful comparative history are preferred.
                exact_metric = any(
                    _semantic_label(cell) == target_metric
                    for cell in metric_row
                )
                score = (100 if exact_metric else 0) + (20 if prior is not None else 0)
                candidates.append((score, current, candidate))
                break

    if not candidates:
        return None

    # Prefer the best semantic match, then the more material segment value.
    candidates.sort(key=lambda item: (item[0], item[1]), reverse=True)
    return candidates[0][2]


def extract_wide_row_metric_from_filing(
    filing,
    labels,
    category,
    metric_name,
    total_revenue=None,
    mode="annual",
):
    """
    Parse wide disclosures where a table lists several accounting metrics and
    separates years into row blocks.

    JPM's geography note is structured as:
        2025
          EMEA      Revenue Expense Pretax Net income Assets
          APAC      ...
          ...
        2024
          EMEA      Revenue Expense Pretax Net income Assets
          ...
        2023
          ...

    Revenue is therefore the FIRST numeric metric inside each geography row for
    each active year. The adjacent numbers are expenses/profit/assets, not prior
    years.
    """
    if not labels:
        return []

    target_metric = _semantic_label(metric_name)
    best_rows = []
    best_score = -1

    for record in extract_html_tables(filing):
        semantic = record.get("semantic_text") or ""
        hits = _table_label_hits(record, labels)

        if len(hits) < 2:
            continue
        if target_metric not in semantic:
            continue

        rows = record.get("rows") or []
        scale = record.get("scale") or 1_000_000

        # -------------------------------------------------------------
        # Preferred layout: one active-year marker followed by rows for
        # each geography. This matches JPM's SEC geographic table.
        # -------------------------------------------------------------
        values_by_label_year = {
            _semantic_label(label): {}
            for label in labels
        }

        active_year = None
        year_markers = 0

        for row in rows:
            compact_cells = [normalize_spaces(cell).strip() for cell in row if normalize_spaces(cell).strip()]
            row_years = []
            for cell in compact_cells:
                row_years.extend(
                    int(y)
                    for y in re.findall(r"\b(20\d{2})\b", cell)
                )

            # Treat a row as a year section marker only when it is essentially
            # a year heading, not a multi-year header.
            if len(set(row_years)) == 1 and len(compact_cells) <= 3:
                active_year = row_years[0]
                year_markers += 1
                continue

            if active_year is None:
                continue

            for label in labels:
                target = _semantic_label(label)
                label_idx = None
                for idx, cell in enumerate(row):
                    if _row_matches_label(cell, label):
                        label_idx = idx
                        break

                if label_idx is None:
                    continue

                numeric_values = []
                for cell in row[label_idx + 1:]:
                    value = _numeric_from_cell(cell, scale)
                    if value is not None:
                        numeric_values.append(value)

                if not numeric_values:
                    continue

                # Configured metric_name is Revenue for JPM and is the first
                # metric column in each geography row.
                metric_value = numeric_values[0]
                values_by_label_year[target][active_year] = metric_value
                break

        if year_markers >= 2:
            available_years = sorted(
                {
                    year
                    for mapping in values_by_label_year.values()
                    for year in mapping.keys()
                },
                reverse=True,
            )

            if len(available_years) >= 2:
                current_year = available_years[0]
                prior_year = available_years[1]
                candidate = []

                for label in labels:
                    target = _semantic_label(label)
                    mapping = values_by_label_year.get(target) or {}
                    current = mapping.get(current_year)
                    prior = mapping.get(prior_year)

                    if current is None:
                        continue
                    if total_revenue and current > total_revenue * 1.30:
                        continue

                    ratio = safe_ratio(current, total_revenue)
                    candidate.append({
                        "name": label,
                        "revenue": current,
                        "prior_period_revenue": prior,
                        "yoy_growth": pct_growth(current, prior),
                        "mix_pct": ratio * 100 if ratio is not None else None,
                        "mode": mode,
                        "source": "sec_html_year_section_metric_override",
                        "table_index": record.get("index"),
                    })

                score = len(candidate) * 100 + year_markers
                if score > best_score:
                    best_rows = candidate
                    best_score = score
                continue

        # -------------------------------------------------------------
        # Fallback: metric-major matrix, where each row contains all
        # years for Revenue first, then all years for Expense, etc.
        # -------------------------------------------------------------
        years = _header_year_sequence(record)
        unique_years = []
        for year in years:
            if year not in unique_years:
                unique_years.append(year)

        if len(unique_years) < 2:
            continue

        candidate = []

        for label in labels:
            matched_row = None
            label_idx = None

            for row in rows:
                for idx, cell in enumerate(row):
                    if _row_matches_label(cell, label):
                        matched_row = row
                        label_idx = idx
                        break
                if matched_row is not None:
                    break

            if matched_row is None:
                continue

            values = []
            for cell in matched_row[label_idx + 1:]:
                value = _numeric_from_cell(cell, scale)
                if value is not None:
                    values.append(value)

            year_count = len(unique_years)
            if len(values) < year_count:
                continue

            # In a metric-major layout, the first year_count numeric values are
            # the requested first metric (Revenue) across years.
            metric_values = values[:year_count]
            year_value = {
                year: value
                for year, value in zip(unique_years, metric_values)
            }

            current_year = max(year_value)
            prior_years = sorted(
                [year for year in year_value if year < current_year],
                reverse=True,
            )
            current = year_value.get(current_year)
            prior = year_value.get(prior_years[0]) if prior_years else None

            if current is None:
                continue
            if total_revenue and current > total_revenue * 1.30:
                continue

            ratio = safe_ratio(current, total_revenue)
            candidate.append({
                "name": label,
                "revenue": current,
                "prior_period_revenue": prior,
                "yoy_growth": pct_growth(current, prior),
                "mix_pct": ratio * 100 if ratio is not None else None,
                "mode": mode,
                "source": "sec_html_metric_major_override",
                "table_index": record.get("index"),
            })

        score = len(candidate)
        if score > best_score:
            best_rows = candidate
            best_score = score

    order = {_semantic_label(label): i for i, label in enumerate(labels)}
    best_rows.sort(key=lambda row: order.get(_semantic_label(row.get("name")), 999))
    return clean_category_rows(
        best_rows,
        category,
        total_revenue=total_revenue,
    )

def _explicit_data_numeric_from_cell(cell, scale, dash_as_zero=False):
    """
    Parse a numeric value from a cell that is already known to be a DATA cell.

    Unlike _explicit_metric_numeric_from_cell(), this does not reject four-digit
    values that happen to look like calendar years. Revenue amounts such as
    $1,902 million and $2,025 million are legitimate data and must survive once
    the row/column role has already been established.
    """
    raw = normalize_spaces(cell).strip()
    if not raw:
        return None

    if raw in {"—", "–", "-"}:
        return 0.0 if dash_as_zero else None

    if raw in {"$", "N/A", "n/a"} or "%" in raw:
        return None

    match = re.search(r"\(?-?\d[\d,]*(?:\.\d+)?\)?", raw)
    if not match:
        return None

    value = safe_float(match.group(0))
    if value is None:
        return None
    return value * scale


def extract_configured_direct_annual_rows(
    filing,
    labels,
    total_revenue=None,
    scale_override=None,
    category="end_markets",
):
    """
    Extract configured revenue rows from a simple annual table whose numeric
    cells correspond directly to fiscal years (current/prior/prior).

    The table must contain the configured labels, at least two annual header
    years, and no more numeric values on a row than there are header years.
    This deliberately rejects wide business/geography matrices.
    """
    if not labels:
        return []

    best = []
    best_score = -1

    for record in extract_html_tables(filing):
        semantic = record.get("semantic_text") or ""
        if not any(token in semantic for token in ("revenue", "revenues", "sales")):
            continue

        label_hits = _table_label_hits(record, labels)
        if len(label_hits) < min(3, len(labels)):
            continue

        years = []
        for year in _header_year_sequence(record):
            if year not in years:
                years.append(year)
        years = sorted(years, reverse=True)
        if len(years) < 2:
            continue

        scale = scale_override or record.get("scale") or 1_000_000
        candidate = []

        for label in labels:
            found = None
            for row in record.get("rows") or []:
                label_idx = None
                for idx, cell in enumerate(row):
                    if _row_matches_label(cell, label):
                        label_idx = idx
                        break
                if label_idx is None:
                    continue

                values = []
                for cell in row[label_idx + 1:]:
                    value = _explicit_data_numeric_from_cell(
                        cell, scale, dash_as_zero=True
                    )
                    if value is not None:
                        values.append(value)

                if not values or len(values) > len(years):
                    continue

                pseudo = dict(record)
                pseudo["rows"] = [[str(y) for y in years]]
                current, prior = _select_current_prior(values, pseudo, "annual")
                if current is None:
                    continue
                if total_revenue and current > total_revenue * 1.20:
                    continue

                ratio = safe_ratio(current, total_revenue)
                found = {
                    "name": label,
                    "revenue": current,
                    "prior_period_revenue": prior,
                    "yoy_growth": pct_growth(current, prior),
                    "mix_pct": ratio * 100 if ratio is not None else None,
                    "mode": "annual",
                    "source": "sec_html_configured_direct_annual_rows",
                    "table_index": record.get("index"),
                }
                break

            if found is not None:
                candidate.append(found)

        score = len(candidate) * 100
        if len(candidate) == len(labels):
            score += 1000
        if score > best_score:
            best = candidate
            best_score = score

    order = {_semantic_label(label): i for i, label in enumerate(labels)}
    best.sort(key=lambda row: order.get(_semantic_label(row.get("name")), 999))
    return clean_category_rows(best, category, total_revenue=total_revenue)


def extract_configured_multicolumn_end_markets(
    filing,
    labels,
    layout,
    total_revenue=None,
    mode="annual",
):
    """
    Extract configured product/service rows from SEC tables whose numeric
    columns contain geographic or business-unit subcolumns in addition to the
    company total.

    Supported layouts:
      year_major_total_last:
        2025 [geo..., Total], 2024 [geo..., Total], ...
      total_year_block_last:
        businessA [2025,2024,2023], businessB [...], Total [2025,2024,2023]
      two_geo_year_blocks_sum:
        U.S. [2025,2024,2023], Outside-U.S. [2025,2024,2023]

    This deliberately opts in only configured issuers. Generic extraction stays
    conservative.
    """
    if not labels or not layout:
        return []

    best_rows = []
    best_score = -1

    for record in extract_html_tables(filing):
        semantic = record.get("semantic_text") or ""
        if not any(token in semantic for token in ("revenue", "revenues", "sales")):
            continue

        label_hits = _table_label_hits(record, labels)
        if len(label_hits) < min(3, len(labels)):
            continue

        years_raw = _header_year_sequence(record)
        unique_years = []
        for year in years_raw:
            if year not in unique_years:
                unique_years.append(year)
        unique_years = sorted(unique_years, reverse=True)

        if mode == "annual" and len(unique_years) < 2:
            continue

        scale = record.get("scale") or 1_000_000
        candidate = []

        for label in labels:
            target = _semantic_label(label)
            row_values = None

            for row in record.get("rows") or []:
                label_idx = None
                for idx, cell in enumerate(row):
                    if _row_matches_label(cell, label):
                        label_idx = idx
                        break
                if label_idx is None:
                    continue

                values = []
                for cell in row[label_idx + 1:]:
                    value = _explicit_data_numeric_from_cell(
                        cell,
                        scale,
                        dash_as_zero=True,
                    )
                    if value is not None:
                        values.append(value)

                if values:
                    row_values = values
                    break

            if not row_values:
                continue

            current = prior = None
            year_count = len(unique_years)

            if layout == "year_major_total_last":
                # Example GILD:
                # [US25, EU25, ROW25, Total25, US24, EU24, ROW24, Total24, ...]
                if year_count >= 2 and len(row_values) % year_count == 0:
                    group_size = len(row_values) // year_count
                    if group_size >= 2:
                        current = row_values[group_size - 1]
                        prior = row_values[(2 * group_size) - 1]

            elif layout == "total_year_block_last":
                # Example STT:
                # [InvServ25,24,23, InvMgmt25,24,23, Other25,24,23,
                #  Total25,24,23]
                if year_count >= 2 and len(row_values) >= year_count:
                    total_block = row_values[-year_count:]
                    current = total_block[0]
                    prior = total_block[1] if len(total_block) > 1 else None

            elif layout == "two_geo_year_blocks_sum":
                # Example Lilly:
                # [US25,US24,US23, Outside25,Outside24,Outside23]
                if year_count >= 2 and len(row_values) >= year_count * 2:
                    first = row_values[:year_count]
                    second = row_values[year_count:year_count * 2]
                    current = first[0] + second[0]
                    prior = first[1] + second[1] if year_count > 1 else None

            if current is None:
                continue
            if total_revenue and current > total_revenue * 1.20:
                continue

            ratio = safe_ratio(current, total_revenue)
            candidate.append({
                "name": label,
                "revenue": current,
                "prior_period_revenue": prior,
                "yoy_growth": pct_growth(current, prior),
                "mix_pct": ratio * 100 if ratio is not None else None,
                "mode": mode,
                "source": f"sec_html_configured_multicolumn_{layout}",
                "table_index": record.get("index"),
            })

        # Prefer complete configured sets; use accounting plausibility as tie-break.
        row_sum = sum(float(row.get("revenue") or 0) for row in candidate)
        ratio = safe_ratio(row_sum, total_revenue)
        plausibility = 0
        if ratio is not None and 0.45 <= ratio <= 1.10:
            plausibility = 25
        score = len(candidate) * 100 + plausibility
        if score > best_score:
            best_rows = candidate
            best_score = score

    order = {_semantic_label(label): i for i, label in enumerate(labels)}
    best_rows.sort(key=lambda row: order.get(_semantic_label(row.get("name")), 999))
    return clean_category_rows(
        best_rows,
        "end_markets",
        total_revenue=total_revenue,
    )



def extract_total_column_category_by_year(
    filing,
    labels,
    category,
    total_revenue=None,
    mode="annual",
):
    """
    Parse configured rows whose final numeric column is the company-wide Total.

    Supports both:
      * one fiscal year per HTML table; and
      * multiple "Year Ended ... YYYY" sections inside one HTML table.

    AGCO major products and ACI Worldwide primary solution categories are the
    canonical layouts.
    """
    if not labels:
        return []

    values_by_label = {_semantic_label(label): {} for label in labels}
    table_index_by_label_year = {}

    for record in extract_html_tables(filing):
        semantic = record.get("semantic_text") or ""
        if not any(token in semantic for token in ("revenue", "revenues", "sales")):
            continue
        if len(_table_label_hits(record, labels)) < min(2, len(labels)):
            continue

        rows = record.get("rows") or []
        scale = record.get("scale") or 1_000_000

        # Table-local years are safer than context years because neighboring
        # SEC paragraphs frequently mention comparative periods.
        table_years = []
        for year_text in re.findall(r"\b(20\d{2})\b", record.get("text") or ""):
            year = int(year_text)
            if year not in table_years:
                table_years.append(year)

        single_table_year = table_years[0] if len(table_years) == 1 else None

        # Some SEC tables place the fiscal year only in the immediately
        # preceding sentence (AGCO is the canonical example). If the table
        # itself contains no year, use the nearest "year ended ... YYYY"
        # statement from local context rather than scanning all nearby years.
        if single_table_year is None and not table_years:
            context_year_matches = re.findall(
                r"year\s+ended[^.]{0,80}?\b(20\d{2})\b",
                record.get("context") or "",
                re.IGNORECASE,
            )
            if context_year_matches:
                single_table_year = int(context_year_matches[-1])

        active_year = single_table_year

        for row in rows:
            compact = [
                normalize_spaces(cell).strip()
                for cell in row
                if normalize_spaces(cell).strip()
            ]
            row_years = []
            for cell in compact:
                for year_text in re.findall(r"\b(20\d{2})\b", cell):
                    year = int(year_text)
                    if year not in row_years:
                        row_years.append(year)

            # A row containing one fiscal year and no configured category label
            # is a year-section marker.
            contains_label = any(
                any(_row_matches_label(cell, label) for cell in row)
                for label in labels
            )
            if len(row_years) == 1 and not contains_label:
                active_year = row_years[0]
                continue

            if active_year is None:
                continue

            for label in labels:
                target = _semantic_label(label)
                label_idx = None
                for idx, cell in enumerate(row):
                    if _row_matches_label(cell, label):
                        label_idx = idx
                        break
                if label_idx is None:
                    continue

                values = []
                for cell in row[label_idx + 1:]:
                    value = _explicit_data_numeric_from_cell(
                        cell,
                        scale,
                        dash_as_zero=True,
                    )
                    if value is not None:
                        values.append(value)

                if len(values) < 2:
                    continue

                company_total = values[-1]
                if total_revenue and company_total > total_revenue * 1.20:
                    continue

                values_by_label[target][active_year] = company_total
                table_index_by_label_year[(target, active_year)] = record.get("index")
                break

    rows_out = []
    for label in labels:
        target = _semantic_label(label)
        mapping = values_by_label.get(target) or {}
        if not mapping:
            continue

        ordered_years = sorted(mapping, reverse=True)
        current_year = ordered_years[0]
        prior_year = ordered_years[1] if len(ordered_years) > 1 else None
        current = mapping[current_year]
        prior = mapping.get(prior_year) if prior_year is not None else None

        ratio = safe_ratio(current, total_revenue)
        rows_out.append({
            "name": label,
            "revenue": current,
            "prior_period_revenue": prior,
            "yoy_growth": pct_growth(current, prior),
            "mix_pct": ratio * 100 if ratio is not None else None,
            "mode": mode,
            "source": f"sec_html_total_column_{category}_by_year",
            "table_index": table_index_by_label_year.get((target, current_year)),
        })

    return clean_category_rows(rows_out, category, total_revenue=total_revenue)



def extract_total_column_geography_by_year(
    filing,
    labels,
    total_revenue=None,
    mode="annual",
):
    """
    Parse wide geography rows where each row contains multiple business-segment
    columns and a final company Total column. Lockheed Martin is the canonical
    layout.

    Separate fiscal-year table records are combined so current/prior values come
    from the Total column of the corresponding year, never adjacent segment
    columns.
    """
    if not labels:
        return []

    values_by_label = {
        _semantic_label(label): {}
        for label in labels
    }
    table_index_by_label_year = {}

    for record in extract_html_tables(filing):
        semantic = record.get("semantic_text") or ""
        if "geographic" not in semantic and "geographical" not in semantic:
            continue
        if len(_table_label_hits(record, labels)) < min(3, len(labels)):
            continue

        years = []
        for year in _header_year_sequence(record):
            if year not in years:
                years.append(year)

        # Lockheed's annual disaggregation normally places each fiscal year in
        # its own table. Only accept a record when one year can be identified
        # unambiguously.
        if len(years) != 1:
            continue
        year = years[0]
        scale = record.get("scale") or 1_000_000

        for label in labels:
            target = _semantic_label(label)
            for row in record.get("rows") or []:
                label_idx = None
                for idx, cell in enumerate(row):
                    if _row_matches_label(cell, label):
                        label_idx = idx
                        break
                if label_idx is None:
                    continue

                values = []
                for cell in row[label_idx + 1:]:
                    value = _explicit_data_numeric_from_cell(
                        cell,
                        scale,
                        dash_as_zero=True,
                    )
                    if value is not None:
                        values.append(value)

                # Require multiple component columns plus a final total.
                if len(values) < 2:
                    continue

                company_total = values[-1]
                if total_revenue and company_total > total_revenue * 1.20:
                    continue

                values_by_label[target][year] = company_total
                table_index_by_label_year[(target, year)] = record.get("index")
                break

    rows = []
    for label in labels:
        target = _semantic_label(label)
        mapping = values_by_label.get(target) or {}
        if not mapping:
            continue
        ordered_years = sorted(mapping, reverse=True)
        current_year = ordered_years[0]
        prior_year = ordered_years[1] if len(ordered_years) > 1 else None
        current = mapping[current_year]
        prior = mapping.get(prior_year) if prior_year is not None else None
        ratio = safe_ratio(current, total_revenue)
        rows.append({
            "name": label,
            "revenue": current,
            "prior_period_revenue": prior,
            "yoy_growth": pct_growth(current, prior),
            "mix_pct": ratio * 100 if ratio is not None else None,
            "mode": mode,
            "source": "sec_html_total_column_geography_by_year",
            "table_index": table_index_by_label_year.get((target, current_year)),
        })

    return clean_category_rows(rows, "geography", total_revenue=total_revenue)


def _extract_section_rows(record, labels, total_revenue=None, mode="annual"):
    rows = record.get("rows") or []
    scale = record.get("scale") or 1_000_000
    output = []

    label_locations = []
    for idx, row in enumerate(rows):
        matches = _configured_labels_in_row(row, labels)
        if len(matches) == 1:
            # Section layout means the segment name is a heading and the revenue
            # metric lives on a following row. If the label row already carries
            # numeric data, it is a normal row-layout table and must not consume
            # a later consolidated-total row as that segment's revenue.
            numeric_on_label_row = _extract_numeric_values(row, scale)
            if numeric_on_label_row:
                continue
            label_locations.append((idx, matches[0]))

    for pos, (row_idx, label) in enumerate(label_locations):
        next_idx = label_locations[pos + 1][0] if pos + 1 < len(label_locations) else min(len(rows), row_idx + 14)
        best_metric = None

        for candidate_row in rows[row_idx + 1:next_idx]:
            metric_cells = [cell for cell in candidate_row if _is_revenue_metric_cell(cell)]
            if not metric_cells:
                continue
            values = _extract_numeric_values(candidate_row, scale)
            if not values:
                continue
            # Prefer net sales / total revenues over generic revenue.
            rank = max(
                (REVENUE_METRIC_LABELS.index(next(m for m in REVENUE_METRIC_LABELS
                                                  if _semantic_label(cell) == m or _semantic_label(cell).startswith(m + " ")))
                 for cell in metric_cells),
                default=len(REVENUE_METRIC_LABELS),
            )
            best_metric = (rank, values)
            break

        if not best_metric:
            continue

        _, values = best_metric
        current, prior = _select_current_prior(values, record, mode)
        ratio = safe_ratio(current, total_revenue)
        output.append({
            "name": label,
            "revenue": current,
            "prior_period_revenue": prior,
            "yoy_growth": pct_growth(current, prior),
            "mix_pct": ratio * 100 if ratio is not None else None,
            "mode": mode,
            "source": "sec_html_table_section",
            "table_index": record.get("index"),
        })

    return output

def _numeric_from_cell(cell_text, scale):
    value = normalize_spaces(cell_text)
    if not value or "%" in value:
        return None
    if value in {"—", "-", "–", "$", "N/A", "n/a"}:
        return None

    # Ignore year / footnote-only cells.
    compact = value.replace("$", "").replace(",", "").strip()
    if re.fullmatch(r"\(?\d{4}\)?", compact):
        year = int(compact.strip("()"))
        if 1900 <= year <= 2100:
            return None
    if re.fullmatch(r"\(?\d{1,2}\)?", compact):
        # Small standalone integers in SEC tables are commonly footnote
        # references. Dollar amounts this small are not useful for our
        # billion-dollar-company intelligence page.
        return None

    match = re.search(r"\(?-?\d[\d,]*(?:\.\d+)?\)?", value)
    if not match:
        return None

    parsed = safe_float(match.group(0))
    if parsed is None:
        return None
    return parsed * scale


def _row_matches_label(cell, label):
    c = _semantic_label(cell)
    l = _semantic_label(label)
    if not c or not l:
        return False
    return c == l or c.startswith(l + " ")



def _extract_configured_rows_from_table(record, labels, total_revenue=None, mode="annual"):
    output = []
    scale = record.get("scale") or 1_000_000
    table_semantic = record.get("table_semantic_text") or _semantic_label(record.get("text") or "")
    semantic = record.get("semantic_text") or table_semantic

    if not any(token in semantic for token in ("revenue", "revenues", "net sales", "sales")):
        return []

    for label in labels or []:
        best_values = None

        for row in record.get("rows") or []:
            label_index = None
            for idx, cell in enumerate(row):
                if _row_matches_label(cell, label):
                    label_index = idx
                    break
            if label_index is None:
                continue

            values = []
            for cell in row[label_index + 1:]:
                value = _numeric_from_cell(cell, scale)
                if value is not None:
                    values.append(value)

            if values:
                best_values = values
                break

        if not best_values:
            continue

        current, prior = _select_current_prior(best_values, record, mode)
        if current is None:
            continue

        # A single category line materially above consolidated revenue is almost
        # certainly an asset/capital/expense metric captured from the wrong row.
        if total_revenue and current > total_revenue * 1.30:
            continue

        ratio = safe_ratio(current, total_revenue)

        output.append({
            "name": label,
            "revenue": current,
            "prior_period_revenue": prior,
            "yoy_growth": pct_growth(current, prior),
            "mix_pct": ratio * 100 if ratio is not None else None,
            "mode": mode,
            "source": "sec_html_table",
            "table_index": record.get("index"),
        })

    return output

def _discover_rows_from_table(record, category, total_revenue=None, mode="annual", max_rows=30):
    """
    Conservative generic row-layout discovery.

    Only rows that look like category members survive. Accounting metrics,
    totals, year headings, eliminations and numeric labels are discarded before
    candidate scoring.
    """
    rows = []
    scale = record.get("scale") or 1_000_000

    for row in record.get("rows") or []:
        if len(row) < 2:
            continue

        label = normalize_spaces(row[0]).strip(" :;–—-")
        semantic_label = _semantic_label(label)

        if not semantic_label:
            continue
        if _generic_row_is_heading_metric_or_total(label, category):
            continue
        if _row_name_is_bad_for_category(label, category):
            continue
        if category == "end_markets" and _generic_name_looks_geographic(label):
            continue
        if len(label) > 100 or len(label.split()) > 14:
            continue

        values = []
        for cell in row[1:]:
            value = _numeric_from_cell(cell, scale)
            if value is not None:
                values.append(value)

        if not values:
            continue

        current, prior = _select_current_prior(values, record, mode)
        if current is None or current <= 0:
            continue

        # A generic business/category member cannot itself exceed consolidated
        # company revenue by a material amount.
        if total_revenue and current > total_revenue * 1.20:
            continue

        ratio = safe_ratio(current, total_revenue)

        rows.append({
            "name": label,
            "revenue": current,
            "prior_period_revenue": prior,
            "yoy_growth": pct_growth(current, prior),
            "mix_pct": ratio * 100 if ratio is not None else None,
            "mode": mode,
            "source": "sec_html_table_discovery",
            "table_index": record.get("index"),
        })

        if len(rows) >= max_rows:
            break

    return rows



def _rows_sum_ratio(rows, total_revenue):
    if not total_revenue:
        return None
    values = [
        float(row.get("revenue"))
        for row in (rows or [])
        if row.get("revenue") is not None and float(row.get("revenue")) > 0
    ]
    if not values:
        return None
    return sum(values) / float(total_revenue)


def _coherent_candidate_score(
    rows,
    labels,
    category,
    total_revenue,
    table_score,
    layout_priority,
    non_additive=False,
    expected_count=None,
):
    if not rows:
        return -10_000.0

    coverage = len({_semantic_label(row.get("name")) for row in rows if row.get("name")})
    score = float(table_score) + coverage * 34.0 + layout_priority * 4.0

    if labels:
        score += 22.0 * (coverage / max(1, len(labels)))

    if expected_count:
        if coverage >= expected_count:
            score += 28.0
        else:
            score -= 18.0 * (expected_count - coverage)

    ratio = _rows_sum_ratio(rows, total_revenue)

    if ratio is not None and not non_additive:
        if 0.85 <= ratio <= 1.15:
            score += 42.0
        elif 0.60 <= ratio <= 1.25:
            score += 20.0
        elif 0.35 <= ratio <= 1.30:
            score += 4.0
        elif ratio > 1.30:
            score -= 120.0
        elif ratio < 0.15:
            score -= 35.0

    # Geography is particularly vulnerable to matrices where a consolidated
    # total sits beside country labels. Prefer ordinary row tables unless the
    # matrix is itself coherent and near a complete geographic total.
    if category == "geography":
        if any(row.get("source") == "sec_html_table" for row in rows):
            score += 18.0
        if any(row.get("source") == "sec_html_table_matrix" for row in rows):
            if ratio is not None and ratio > 1.15:
                score -= 150.0
            else:
                score -= 10.0

    return score


def extract_category_rows_from_filing(
    filing,
    labels,
    category,
    total_revenue=None,
    mode="annual",
    allow_discovery=False,
    non_additive=False,
    expected_count=None,
    merge_missing=False,
):
    """
    Extract ONE coherent disclosure set instead of cherry-picking the strongest
    row for every label across unrelated SEC tables.

    Each table/layout competes as a complete candidate set. Coverage, semantic
    table quality, and accounting plausibility determine the winner.
    """
    tables = extract_html_tables(filing)
    if not tables:
        return []

    scored = []
    for record in tables:
        table_score, hits = _table_category_score(record, labels, category)
        cue_count = sum(
            1
            for cue in CATEGORY_CUES.get(category, [])
            if _semantic_label(cue) in (record.get("semantic_text") or "")
        )

        if labels:
            min_hits = 2 if len(labels) >= 3 else 1
            if len(hits) < min_hits and not (len(hits) >= 1 and cue_count >= 1):
                continue
            if table_score < 5:
                continue
        elif table_score < 8:
            # Generic discovery uses a stricter semantic classifier than the
            # legacy broad CATEGORY_CUES score. Allow a strongly classified
            # table (e.g. "Product sales by product") to compete even when the
            # older score is below 8.
            if not (
                allow_discovery
                and _generic_table_has_strong_cue(record, category)
            ):
                continue

        scored.append((table_score, record))

    scored.sort(key=lambda item: item[0], reverse=True)

    if labels:
        candidate_sets = []

        for table_score, record in scored[:30]:
            layout_sets = [
                ("row", 4, _extract_configured_rows_from_table(
                    record, labels, total_revenue, mode
                )),
                ("section", 3, _extract_section_rows(
                    record, labels, total_revenue, mode
                )),
                ("matrix", 2, _extract_column_matrix_rows(
                    record, labels, total_revenue, mode
                )),
            ]

            for layout_name, priority, rows in layout_sets:
                cleaned = clean_category_rows(
                    rows,
                    category,
                    total_revenue=total_revenue,
                )
                if not cleaned:
                    continue

                candidate_score = _coherent_candidate_score(
                    cleaned,
                    labels,
                    category,
                    total_revenue,
                    table_score,
                    priority,
                    non_additive=non_additive,
                    expected_count=expected_count,
                )
                candidate_sets.append({
                    "score": candidate_score,
                    "rows": cleaned,
                    "table_score": table_score,
                    "layout": layout_name,
                    "table_index": record.get("index"),
                })

        if not candidate_sets:
            return []

        candidate_sets.sort(key=lambda item: item["score"], reverse=True)
        winner = candidate_sets[0]
        result = list(winner["rows"])

        # JPM-style disclosures can put Corporate in a separate one-label table.
        # Search missing labels independently only after a coherent main set has
        # already won, and accept the supplemental row only if the combined
        # accounting total remains plausible.
        if merge_missing:
            present = {_semantic_label(row.get("name")) for row in result}
            missing = [
                label for label in labels
                if _semantic_label(label) not in present
            ]

            for label in missing:
                choices = []
                target = _semantic_label(label)

                for record in tables:
                    table_score, hits = _table_category_score(record, [label], category)
                    if not hits or table_score < 0:
                        continue

                    layout_sets = [
                        (4, _extract_configured_rows_from_table(
                            record, [label], total_revenue, mode
                        )),
                        (3, _extract_section_rows(
                            record, [label], total_revenue, mode
                        )),
                        (2, _extract_column_matrix_rows(
                            record, [label], total_revenue, mode
                        )),
                    ]

                    for priority, supplemental_rows in layout_sets:
                        cleaned_supplemental = clean_category_rows(
                            supplemental_rows,
                            category,
                            total_revenue=total_revenue,
                        )
                        for row in cleaned_supplemental:
                            if _semantic_label(row.get("name")) != target:
                                continue
                            choices.append((
                                table_score,
                                priority,
                                1 if row.get("prior_period_revenue") is not None else 0,
                                row,
                            ))

                ranked_choices = []
                for table_score, priority, prior_flag, row in choices:
                    trial = result + [row]
                    ratio = _rows_sum_ratio(trial, total_revenue)

                    if ratio is not None and not non_additive and ratio > 1.15:
                        continue

                    # Prefer the supplemental segment that best reconciles the
                    # full configured set to consolidated revenue. This selects
                    # JPM Corporate total net revenue ($7.025B) rather than a
                    # smaller unrelated Corporate line.
                    closure = abs(ratio - 1.0) if ratio is not None else 1.0
                    materiality = (
                        abs(float(row.get("revenue") or 0) / float(total_revenue))
                        if total_revenue
                        else 0.0
                    )
                    ranked_choices.append((
                        closure,
                        -materiality,
                        -table_score,
                        -priority,
                        -prior_flag,
                        row,
                    ))

                ranked_choices.sort(key=lambda item: item[:-1])

                if ranked_choices:
                    row = ranked_choices[0][-1]
                    result.append(row)
                    present.add(target)

        order = {_semantic_label(label): i for i, label in enumerate(labels)}
        result.sort(key=lambda row: order.get(_semantic_label(row.get("name")), 999))
        return result

    if allow_discovery and scored:
        generic_candidates = []

        for table_score, record in scored[:40]:
            if not _generic_table_has_strong_cue(record, category):
                continue

            discovered = clean_category_rows(
                _discover_rows_from_table(
                    record,
                    category,
                    total_revenue=total_revenue,
                    mode=mode,
                ),
                category,
                total_revenue=total_revenue,
            )

            if not _generic_discovery_rows_are_credible(
                discovered,
                record,
                category,
                total_revenue=total_revenue,
            ):
                continue

            candidate_score = _coherent_candidate_score(
                discovered,
                [],
                category,
                total_revenue,
                table_score,
                1,
                non_additive=non_additive,
            )

            generic_candidates.append({
                "score": candidate_score,
                "rows": discovered,
                "table_index": record.get("index"),
            })

        if generic_candidates:
            generic_candidates.sort(
                key=lambda item: item["score"],
                reverse=True,
            )
            return generic_candidates[0]["rows"]

    return []


def infer_total_revenue_from_tables(filing, mode="annual"):
    strict_labels = {
        "total revenue", "total revenues", "net sales", "total net sales",
        "total net revenue", "total net revenues", "net operating revenues",
        "total net operating revenues", "total sales", "consolidated net sales",
        "revenues and other income", "sales and other operating revenue",
        "sales and other operating revenues",
    }

    tables = extract_html_tables(filing)
    candidates = []

    for record in tables:
        scale = record.get("scale") or 1_000_000
        years = _header_year_sequence(record)
        unique = []
        for year in years:
            if year not in unique:
                unique.append(year)

        semantic = record.get("semantic_text") or ""
        statement_bonus = 0
        if any(token in semantic for token in (
            "consolidated statements of income",
            "consolidated statements of operations",
            "consolidated statements of earnings",
            "statements of income",
            "statements of operations",
            "statements of earnings",
        )):
            statement_bonus += 45
        if "segment" in semantic:
            statement_bonus -= 6
        if "cash flows" in semantic or "balance sheet" in semantic:
            statement_bonus -= 35

        for row in record.get("rows") or []:
            label_idx = None
            row_label = None
            for idx, cell in enumerate(row):
                semantic_cell = _semantic_label(cell)
                if semantic_cell in strict_labels:
                    label_idx = idx
                    row_label = semantic_cell
                    break

            if label_idx is None:
                continue

            values = [
                _numeric_from_cell(cell, scale)
                for cell in row[label_idx + 1:]
            ]
            values = [value for value in values if value is not None]
            if not values:
                continue

            if len(unique) == 1 and len(values) > 1:
                current = max(values)
            elif years and len(years) == len(values):
                latest = max(years)
                current = max(
                    value for value, year in zip(values, years)
                    if year == latest
                )
            elif len(unique) >= 2 and len(values) == len(unique):
                latest = max(unique)
                current = values[unique.index(latest)]
            elif years and len(values) > len(unique) >= 2:
                latest = max(unique)
                current_values = []
                for idx, value in enumerate(values):
                    year = years[idx % len(years)] if years else None
                    if year == latest:
                        current_values.append(value)
                current = max(current_values) if current_values else max(values)
            else:
                current, _ = _select_current_prior(values, record, mode)

            if not current or not (100_000_000 < current < 2_000_000_000_000):
                continue

            label_bonus = 0
            if row_label in {
                "net operating revenues",
                "total net operating revenues",
                "net sales",
                "consolidated net sales",
                "total revenues",
                "total revenue",
            }:
                label_bonus += 18

            year_bonus = 8 if years else 0
            index_bonus = max(0, 8 - min(8, (record.get("index") or 0) / 25))

            candidates.append((
                statement_bonus + label_bonus + year_bonus + index_bonus,
                current,
            ))

    if not candidates:
        return None

    candidates.sort(key=lambda item: (item[0], item[1]), reverse=True)
    return candidates[0][1]

def _row_name_is_bad_for_category(name, category):
    low = _semantic_label(name)
    bad_common = [
        "weighted average", "cash and cash equivalents", "marketable securities",
        "total assets", "inventory", "inventories", "property plant equipment",
        "capital expenditures", "depreciation and amortization",
        "operating expenses", "selling general administrative",
        "income before income taxes", "provision for income taxes",
        "net change in operating assets", "accounts receivable",
    ]
    if any(token in low for token in bad_common):
        return True

    if category == "segments" and any(token in low for token in (
        "operating income", "income from operations", "loss from operations",
        "cost of goods sold", "net earnings", "interest expense",
        "gross margin", "gross profit", "segment profit",
        "ebitda", "ebitdac", "service cost adjustment",
        "revenues before reimbursement", "revenue before reimbursement",
        "preferred stock dividend",
    )):
        return True

    if category == "end_markets" and any(token in low for token in (
        "income from discontinued operations",
        "net income from discontinued operations",
        "income before taxes", "income before tax",
        "ebitda", "ebitdac",
        "earnings before interest and taxes",
        "earnings loss before interest and taxes",
        "gross margin", "gross profit",
        "segment profit", "transaction costs", "impairment charges",
        "production", "unit inputs",
        "goods and services transferred at a point in time",
        "goods and services transferred over time",
    )):
        return True

    if category == "geography" and any(token in low for token in (
        "products", "services", "fixed price", "cost reimbursable",
        "retained loans", "past due", "charge offs",
    )):
        return True

    return False



def clean_category_rows(rows, category, total_revenue=None):
    cleaned = []
    seen = set()

    for row in rows or []:
        name = normalize_spaces(row.get("name"))
        revenue = row.get("revenue")
        allow_small = bool(row.get("allow_small"))
        if (
            not name
            or revenue is None
            or (revenue < 50_000_000 and not allow_small)
        ):
            continue
        if _row_name_is_bad_for_category(name, category):
            continue

        if total_revenue and revenue > total_revenue * 1.30:
            continue

        key = _semantic_label(name)
        if key in seen:
            continue
        seen.add(key)

        prior = row.get("prior_period_revenue")
        if (
            prior is not None
            and abs(prior) < 50_000_000
            and not allow_small
        ):
            row["prior_period_revenue"] = None
            row["yoy_growth"] = None

        ratio = safe_ratio(revenue, total_revenue)
        if ratio is not None and 0 <= ratio <= 1.25:
            row["mix_pct"] = ratio * 100
        else:
            row["mix_pct"] = None

        if row.get("yoy_growth") is not None and abs(row["yoy_growth"]) > 500:
            row["prior_period_revenue"] = None
            row["yoy_growth"] = None

        cleaned.append(row)

    return cleaned



def validate_filing_payload(payload, parser_config):
    warnings = []
    failures = []

    categories = {
        "segments": payload.get("reportable_segments") or [],
        "end_markets": payload.get("end_markets") or [],
        "geography": payload.get("geography") or [],
    }

    total_revenue = payload.get("_validation_total_revenue")
    non_additive = set(parser_config.get("non_additive_categories") or [])

    for category, rows in categories.items():
        semantic_names = []
        for row in rows:
            if _row_name_is_bad_for_category(row.get("name"), category):
                failures.append(f"{category}: contaminated row {row.get('name')!r}")

            revenue = row.get("revenue")
            if total_revenue and revenue and revenue > total_revenue * 1.30:
                failures.append(
                    f"{category}: {row.get('name')!r} exceeds 130% of consolidated revenue"
                )

            semantic_names.append(_semantic_label(row.get("name")))

        if len(semantic_names) != len(set(semantic_names)):
            failures.append(f"{category}: duplicate business labels detected")

    expected_segments = parser_config.get("expected_segment_count")
    if expected_segments is None:
        labels = parser_config.get("reportable_segment_labels") or []
        expected_segments = len(labels) if 0 < len(labels) <= 5 else None

    if expected_segments and not parser_config.get("single_segment_expected"):
        actual = len(categories["segments"])
        if actual < expected_segments:
            warnings.append(
                f"Configured reportable segments were not sufficiently detected "
                f"({actual}/{expected_segments})."
            )

    if parser_config.get("generic_discovery"):
        for category, rows in categories.items():
            for row in rows:
                if _generic_row_is_heading_metric_or_total(row.get("name"), category):
                    failures.append(
                        f"{category}: generic accounting/heading row "
                        f"{row.get('name')!r}"
                    )

            if len(rows) == 1:
                failures.append(
                    f"{category}: single-row generic disclosure is not sufficiently reliable"
                )

        seg_names = {
            _semantic_label(row.get("name"))
            for row in categories["segments"]
        }
        geo_names = {
            _semantic_label(row.get("name"))
            for row in categories["geography"]
        }
        if seg_names and geo_names:
            overlap = len(seg_names & geo_names) / max(1, len(seg_names))
            geographic_share = sum(
                1 for row in categories["segments"]
                if _generic_name_looks_geographic(row.get("name"))
            ) / max(1, len(categories["segments"]))
            if overlap >= 0.50 and geographic_share >= 0.50:
                failures.append(
                    "segments: generic segment rows duplicate geographic disclosure"
                )

    expected_end_markets = parser_config.get("expected_end_market_count")
    if expected_end_markets:
        actual = len(categories["end_markets"])
        if actual < expected_end_markets:
            warnings.append(
                f"Configured end markets/products were not sufficiently detected "
                f"({actual}/{expected_end_markets})."
            )

    expected_geography = parser_config.get("expected_geography_count")
    if expected_geography:
        actual = len(categories["geography"])
        if actual < expected_geography:
            warnings.append(
                f"Configured revenue geography was not sufficiently detected "
                f"({actual}/{expected_geography})."
            )

    if (
        parser_config.get("require_geography_reconciliation")
        and categories["geography"]
        and total_revenue
    ):
        geo_ratio = _rows_sum_ratio(categories["geography"], total_revenue)
        if geo_ratio is None or not (0.90 <= geo_ratio <= 1.10):
            failures.append(
                "geography: configured company-total geography does not "
                f"reconcile to consolidated revenue ({(geo_ratio or 0) * 100:.1f}%)."
            )

    for category, rows in categories.items():
        if category in non_additive:
            continue

        mixes = [
            row.get("mix_pct")
            for row in rows
            if row.get("mix_pct") is not None
        ]
        if not mixes:
            continue

        total_mix = sum(mixes)

        if total_mix > 125:
            failures.append(
                f"{category}: additive disclosed mix exceeds 125% ({total_mix:.1f}%)."
            )
        elif total_mix > 112:
            warnings.append(
                f"{category}: summed disclosed mix is unusually high ({total_mix:.1f}%)."
            )

        if (
            category == "segments"
            and expected_segments
            and len(rows) >= expected_segments
            and total_mix < 55
        ):
            warnings.append(
                f"segments: complete configured set covers only {total_mix:.1f}% "
                f"of inferred consolidated revenue; denominator may be wrong."
            )

    quality = "FAIL" if failures else "WARN" if warnings else "PASS"
    return {
        "quality": quality,
        "failures": failures,
        "warnings": warnings,
    }

def extract_money_row_from_section(section, label, max_numbers=6):
    if not section or not label:
        return []

    label_pattern = re.escape(label).replace("\\ ", r"\s+")

    match = re.search(
        rf"{label_pattern}\s+(.*?)(?:\n|$)",
        section,
        re.IGNORECASE,
    )

    if not match:
        # Fallback for cases where line breaks got stripped.
        match = re.search(
            rf"{label_pattern}\s+(.{{0,500}})",
            section,
            re.IGNORECASE | re.DOTALL,
        )

    if not match:
        return []

    row_text = match.group(1)

    raw_numbers = re.findall(
        r"\$?\s*\(?-?\d{1,3}(?:,\d{3})*(?:\.\d+)?\)?",
        row_text,
    )

    values = []

    for raw in raw_numbers:
        value = money_to_number(raw, default_scale=1_000_000)
        if value is not None:
            values.append(value)

    return values[:max_numbers]


def build_breakdown_rows_from_section(section, labels, total_revenue=None, mode="annual"):
    rows = []

    for label in labels:
        nums = extract_money_row_from_section(section, label, max_numbers=6)

        if not nums:
            continue

        current = nums[0]
        prior = nums[1] if len(nums) > 1 else None

        rows.append({
            "name": label,
            "revenue": current,
            "prior_period_revenue": prior,
            "yoy_growth": pct_growth(current, prior),
            "mix_pct": (
                safe_ratio(current, total_revenue) * 100
                if total_revenue is not None and safe_ratio(current, total_revenue) is not None
                else None
            ),
            "mode": mode,
        })

    return rows



BREAKDOWN_LABEL_STOPWORDS = {
    "total", "revenue", "revenues", "net sales", "sales", "segment",
    "segments", "other", "eliminations", "corporate", "consolidated",
    "cost of revenue", "gross profit", "operating income", "net income",
    "assets", "liabilities", "equity", "income", "expense", "expenses",
}


def discover_breakdown_labels_from_section(section, max_labels=20):
    """
    Conservative fallback for issuers that are not in COMPANY_PARSER_CONFIG.

    We only accept row-like lines containing a textual label followed by at least
    two financial-looking values. This is intentionally stricter than a generic
    table scraper because false segment labels are worse than a missing table.
    """
    if not section:
        return []

    labels = []
    seen = set()

    for raw_line in section.splitlines():
        line = normalize_spaces(raw_line)
        if not line or len(line) > 500:
            continue

        # Require at least two values so prose sentences are not treated as table rows.
        values = re.findall(
            r"\$?\s*\(?-?\d{1,3}(?:,\d{3})+(?:\.\d+)?\)?",
            line,
        )
        if len(values) < 2:
            continue

        first_number = re.search(
            r"\$?\s*\(?-?\d{1,3}(?:,\d{3})+(?:\.\d+)?\)?",
            line,
        )
        if not first_number:
            continue

        label = normalize_spaces(line[:first_number.start()]).strip(" :;–—-")
        label = re.sub(r"^[\(\)\[\]\d\s]+", "", label).strip()

        if not (2 <= len(label) <= 80):
            continue
        if len(re.findall(r"[A-Za-z]", label)) < 2:
            continue

        low = label.lower().strip()
        if low in BREAKDOWN_LABEL_STOPWORDS:
            continue
        if any(low.startswith(prefix) for prefix in (
            "year ended", "three months", "six months", "nine months",
            "twelve months", "as of", "for the year",
        )):
            continue

        # Reject narrative-like labels.
        if len(label.split()) > 10:
            continue
        if low in seen:
            continue

        seen.add(low)
        labels.append(label)

        if len(labels) >= max_labels:
            break

    return labels


def build_breakdown_rows_with_discovery(
    section,
    configured_labels,
    total_revenue=None,
    mode="annual",
):
    rows = build_breakdown_rows_from_section(
        section,
        configured_labels or [],
        total_revenue=total_revenue,
        mode=mode,
    )

    # If the configured parser found meaningful rows, trust it. Otherwise try a
    # strict row-discovery fallback so unknown issuers are not limited to the
    # small default label list.
    if len(rows) >= 2:
        return rows

    discovered_labels = discover_breakdown_labels_from_section(section)
    discovered_rows = build_breakdown_rows_from_section(
        section,
        discovered_labels,
        total_revenue=total_revenue,
        mode=mode,
    )

    return discovered_rows if len(discovered_rows) > len(rows) else rows


def clean_breakdown_rows(rows, total_revenue=None, min_revenue=50_000_000):
    cleaned = []

    for row in rows or []:
        revenue = row.get("revenue")
        prior = row.get("prior_period_revenue")
        mix_pct = row.get("mix_pct")

        # Remove missing or tiny false positives.
        if revenue is None or revenue < min_revenue:
            continue

        # Remove negative revenue rows unless intentionally valid later.
        if revenue < 0:
            continue

        # Remove absurd mix percentages caused by bad total revenue.
        if mix_pct is not None and (mix_pct < 0 or mix_pct > 100):
            row["mix_pct"] = None

        # Remove absurd YoY from bad prior-year captures.
        if prior is not None and abs(prior) < 50_000_000:
            row["prior_period_revenue"] = None
            row["yoy_growth"] = None

        cleaned.append(row)

    return cleaned



# Discrete-quarter filing-intelligence tables that have been manually verified.
# All other issuers remain annual-only for filing-intelligence categories because
# many 10-Q tables contain both 3-month and 6/9-month YTD columns.
VERIFIED_QUARTERLY_BREAKDOWN_TICKERS = {
    "NVDA",  # Q1; 3-month and YTD are identical.
    "TRV",   # validated 3-month segment matrix.
    "PG",    # validated 3-month segment net-sales matrix.
    "NKE",   # validated sparse 3-month segment revenue matrix.
}


def _strict_rpo_total(text):
    """
    Return an RPO amount only when the amount is explicitly linked to
    'remaining performance obligations' in the same sentence / clause.

    This avoids grabbing a nearby deferred-revenue balance, backlog subtotal,
    investment amount, or other dollar figure merely because it occurs near an
    RPO heading.
    """
    if not text:
        return None

    normalized = normalize_spaces(text)

    patterns = [
        # "... remaining [unsatisfied] performance obligations ... $2.6 billion"
        r"remaining (?:unsatisfied )?performance obligations"
        r"[^.;]{0,500}?"
        r"(?:was|were|is|are|totaled|totalled|amounted to|were approximately|was approximately)"
        r"\s+\$?\s*([\d.,]+)\s*(billion|million)?",

        # "... aggregate amount ... allocated to remaining performance obligations was $X"
        r"aggregate amount"
        r"[^.;]{0,350}?"
        r"remaining performance obligations"
        r"[^.;]{0,220}?"
        r"(?:was|were|is|are)"
        r"\s+\$?\s*([\d.,]+)\s*(billion|million)?",

        # "had $118 billion of remaining performance obligations"
        r"(?:had|has)\s+\$?\s*([\d.,]+)\s*(billion|million)?"
        r"[^.;]{0,120}?"
        r"remaining performance obligations",

        # "RPO was $358.6 million" / "total RPO ... was $3.7 billion"
        r"(?:total\s+)?\bRPO\b"
        r"[^.;]{0,180}?"
        r"(?:was|were|is|are|totaled|totalled)"
        r"\s+\$?\s*([\d.,]+)\s*(billion|million)?",

        # "had remaining unsatisfied performance obligations (RUPO) of $2.8 billion"
        r"remaining unsatisfied performance obligations"
        r"[^.;]{0,220}?"
        r"(?:of|were|was|totaled|totalled)"
        r"\s+\$?\s*([\d.,]+)\s*(billion|million)?",

        r"\bRUPO\b"
        r"[^.;]{0,160}?"
        r"(?:of|was|were|is|are|totaled|totalled)"
        r"\s+\$?\s*([\d.,]+)\s*(billion|million)?",
    ]

    return extract_money_phrase(normalized, patterns)


def _strict_deferred_revenue_total(text):
    """
    Prefer an explicitly linked deferred-revenue balance over a loose section
    search. Handles current + non-current disclosures without wandering into
    unrelated total-liability amounts.
    """
    normalized = normalize_spaces(text or "")

    pair = re.search(
        r"current and non-current deferred revenue (?:were|was|are|is)"
        r"\s+\$?\s*([\d.,]+)\s*(billion|million)?"
        r"\s+and\s+\$?\s*([\d.,]+)\s*(billion|million)?"
        r"\s*,?\s*respectively",
        normalized,
        re.IGNORECASE,
    )
    if pair:
        first = money_to_number(pair.group(1), pair.group(2))
        second = money_to_number(pair.group(3), pair.group(4))
        if first is not None and second is not None:
            return first + second

    direct = extract_money_phrase(normalized, [
        r"(?:total\s+)?deferred revenue"
        r"[^.;]{0,80}?"
        r"(?:was|were|is|are|totaled|totalled|of)"
        r"\s+\$?\s*([\d.,]+)\s*(billion|million)?",
    ])
    return direct

def extract_revenue_visibility(text, ttm_revenue=None):
    deferred_section = extract_section_between(
        text,
        start_patterns=[
            r"Deferred Revenue",
            r"Revenue Recognition",
            r"Remaining Performance Obligations",
            r"Remaining Unsatisfied Performance Obligations",
        ],
        end_patterns=[
            r"Accounts Receivable",
            r"Inventory",
            r"Debt",
            r"Leases",
            r"Commitments",
        ],
        max_chars=20000,
    )

    # Use the whole filing text because the explicit RPO sentence can sit just
    # outside a generic deferred-revenue section boundary. The extractor itself
    # is deliberately strict about amount-to-RPO linkage.
    rpo_total = _strict_rpo_total(text)

    deferred_revenue_total = _strict_deferred_revenue_total(text)

    total_deferred_nums = extract_money_row_from_section(
        deferred_section,
        "Total deferred revenue",
        max_numbers=4,
    )

    if deferred_revenue_total is None and total_deferred_nums:
        deferred_revenue_total = total_deferred_nums[0]

    if deferred_revenue_total is None:
        deferred_revenue_total = extract_money_phrase(deferred_section, [
            r"deferred revenue[^$]{0,160}\$\s*([\d.,]+)\s*(billion|million)?",
        ])

    rpo_from_deferred = extract_money_phrase(deferred_section, [
        r"\$?\s*([\d.,]+)\s*(billion|million)?\s+from deferred revenue",
    ])

    rpo_unbilled = extract_money_phrase(deferred_section, [
        r"\$?\s*([\d.,]+)\s*(billion|million)?\s+.*?not yet billed",
        r"\$?\s*([\d.,]+)\s*(billion|million)?\s+.*?not yet billed or recognized",
    ])

    rpo_section = extract_section_between(
        text,
        start_patterns=[
            r"Remaining Performance Obligations",
            r"Remaining Unsatisfied Performance Obligations",
        ],
        end_patterns=[
            r"Accounts Receivable",
            r"Cash, Cash Equivalents",
            r"Inventory",
            r"Debt",
            r"Leases",
            r"Commitments",
        ],
        max_chars=6000,
    )

    percent_next_12_months = extract_percent_phrase(
        rpo_section or deferred_section,
        [
            r"approximately\s+(\d{1,3})\s*%\s+.*?next twelve months",
            r"(\d{1,3})\s*%\s+.*?next twelve months",
            r"(\d{1,3})\s*%\s+.*?next 12 months",
        ],
    )

    if (
            deferred_revenue_total is not None
            and rpo_total is not None
            and deferred_revenue_total > rpo_total * 5
    ):
        deferred_revenue_total = None

    if deferred_revenue_total is not None and abs(deferred_revenue_total) < 1_000_000:
        deferred_revenue_total = None

    if rpo_total is not None and percent_next_12_months is None:
        linked_pct = re.search(
            r"(?:recognize|recognized|recognition)[^.]{0,120}?"
            r"(?:approximately\s+|about\s+)?"
            r"(\d{1,3}(?:\.\d+)?)\s*%\s+of\s+"
            r"(?:RUPO|RPO|remaining (?:unsatisfied )?performance obligations)"
            r"[^.]{0,180}?next\s+(?:twelve|12)\s+months",
            text,
            re.IGNORECASE,
        )
        if linked_pct:
            percent_next_12_months = safe_float(linked_pct.group(1))

    if rpo_total is None:
        rpo_from_deferred = None
        rpo_unbilled = None
        percent_next_12_months = None

    return {
        "rpo_total": rpo_total,
        "rpo_from_deferred_revenue": rpo_from_deferred,
        "rpo_unbilled": rpo_unbilled,
        "deferred_revenue_total": deferred_revenue_total,
        "percent_recognized_next_12_months": percent_next_12_months,
        "rpo_to_ttm_revenue": (
            safe_ratio(rpo_total, ttm_revenue) * 100
            if safe_ratio(rpo_total, ttm_revenue) is not None
            else None
        ),
        "deferred_revenue_to_ttm_revenue": (
            safe_ratio(deferred_revenue_total, ttm_revenue) * 100
            if safe_ratio(deferred_revenue_total, ttm_revenue) is not None
            else None
        ),
    }




def extract_customer_concentration(text):
    """
    Extract the most recent revenue/sales customer-concentration disclosure from
    the supplied filing text. Comparative prior-year disclosures are not mixed
    into the same customer list.
    """
    text = normalize_spaces(text or "")

    def payload(rows):
        clean_rows = []
        seen = set()
        for row in rows:
            pct = safe_float(row.get("revenue_pct"))
            if pct is None or pct < 10 or pct > 100:
                continue
            key = (
                normalize_spaces(row.get("name")).lower(),
                float(pct),
            )
            if key in seen:
                continue
            seen.add(key)
            item = dict(row)
            item["revenue_pct"] = float(pct)
            clean_rows.append(item)

        clean_rows.sort(key=lambda row: row["revenue_pct"], reverse=True)
        return {
            "customers": clean_rows,
            "number_of_10pct_customers": len(clean_rows),
            "largest_customer_pct": clean_rows[0]["revenue_pct"] if clean_rows else None,
            "second_largest_customer_pct": clean_rows[1]["revenue_pct"] if len(clean_rows) > 1 else None,
            "customer_names_disclosed": any(row.get("name_disclosed") for row in clean_rows),
            "notes": (
                "Customer concentration detected. Named customers are shown only when "
                "the filing explicitly identifies them."
                if clean_rows
                else "Customer concentration data was not detected."
            ),
        }

    # Exclude accounts-receivable concentration from the candidate text.
    revenue_blocks = []
    for match in re.finditer(
        r"[^.]{0,500}(?:customers?|sales to)[^.]{0,650}?"
        r"(?:total revenue|net operating revenues|net revenues|total sales|consolidated net sales|consolidated sales|net sales|sales)"
        r"[^.]{0,300}\.",
        text,
        re.IGNORECASE,
    ):
        block = normalize_spaces(match.group(0))
        low = block.lower()
        if "accounts receivable" in low or "receivable balance" in low:
            continue
        revenue_blocks.append((match.start(), block))

    search_text = " ".join(block for _, block in revenue_blocks) if revenue_blocks else text

    # Explicit named list with parallel percentages:
    # "Our top three customers, Daimler AG, PACCAR Inc. and Traton SE,
    #  accounted for approximately 18%, 11% and 10%, respectively, of net sales."
    named_list_pattern = re.compile(
        r"(?:our\s+)?top\s+(?P<count>two|three|four|five|six|seven|eight|(?<!\d)[2-8](?!\d))\s+customers"
        r"\s*,\s*(?P<names>.{3,260}?)\s*,?\s*"
        r"(?:accounted\s+for|represented|comprised)"
        r"[^.]{0,120}?"
        r"(?P<pcts>\d{1,3}(?:\.\d+)?\s*%(?:\s*,?\s*(?:and\s+)?\d{1,3}(?:\.\d+)?\s*%){1,7})"
        r"\s*,?\s*respectively"
        r"[^.]{0,120}?(?:net\s+sales|sales|revenues?)",
        re.IGNORECASE,
    )
    named_list = named_list_pattern.search(text)
    if named_list:
        count_map = {
            "two": 2, "three": 3, "four": 4, "five": 5,
            "six": 6, "seven": 7, "eight": 8,
        }
        raw_count = named_list.group("count").lower()
        expected = count_map.get(raw_count)
        if expected is None and raw_count.isdigit():
            expected = int(raw_count)

        names_text = normalize_spaces(named_list.group("names"))
        names_text = re.sub(r"\s+and\s+", ", ", names_text, flags=re.IGNORECASE)
        names = [
            normalize_spaces(name)
            for name in names_text.split(",")
            if normalize_spaces(name)
        ]
        pcts = [
            safe_float(value)
            for value in re.findall(
                r"(\d{1,3}(?:\.\d+)?)\s*%",
                named_list.group("pcts"),
            )
        ]

        if expected and len(names) == expected and len(pcts) == expected:
            return payload([
                {
                    "name": name,
                    "revenue_pct": pct,
                    "name_disclosed": True,
                    "source": "named_customer_list",
                }
                for name, pct in zip(names, pcts)
            ])

    # Highest-confidence current disclosure:
    # "three direct customers represented 21%, 17%, and 16% of total revenue."
    multi_pattern = re.compile(
        r"(?P<count>two|three|four|five|six|seven|eight|(?<!\d)[2-8](?!\d))\s+"
        r"(?:direct\s+)?(?:[A-Za-z][A-Za-z&/\-]*\s+){0,3}?customers[^.]{0,240}?"
        r"(?:represented|accounted\s+for|comprised)[^.]{0,180}?"
        r"(?P<pcts>\d{1,3}(?:\.\d+)?\s*%(?:\s*,?\s*(?:and\s+)?\d{1,3}(?:\.\d+)?\s*%){1,7})"
        r"[^.]{0,140}?(?:(?:total|consolidated)\s+revenues?|net\s+revenues?|sales)",
        re.IGNORECASE,
    )
    match = multi_pattern.search(search_text)
    if match:
        count_map = {
            "two": 2, "three": 3, "four": 4, "five": 5,
            "six": 6, "seven": 7, "eight": 8,
        }
        raw_count = match.group("count").lower()
        expected = count_map.get(raw_count)
        if expected is None and raw_count.isdigit():
            expected = int(raw_count)
        pcts = re.findall(r"(\d{1,3}(?:\.\d+)?)\s*%", match.group("pcts"))

        # If the filing says "top five customers" but supplies three percentages
        # for 2025/2024/2023, those percentages are a time series, not five
        # separate customers.
        if expected and len(pcts) == expected:
            rows = [
                {
                    "name": f"Unnamed Direct Customer {idx + 1}",
                    "revenue_pct": safe_float(pct),
                    "name_disclosed": False,
                    "source": "unnamed_multi_customer_disclosure",
                }
                for idx, pct in enumerate(pcts)
            ]
            return payload(rows)

    # Explicit anonymous SEC labels, restricted to true single-letter/number
    # identifiers so phrases such as "Customer Headquarters" cannot match.
    label_pattern = re.compile(
        r"(Customer\s+(?:[A-Z]|\d+))[^.%]{0,280}?"
        r"(?:represented|accounted\s+for|comprised)[^.%]{0,120}?"
        r"(\d{1,3}(?:\.\d+)?)\s*%\s+of\s+(?:our\s+)?(?:total\s+)?(?:revenue|sales)",
    )
    labeled = list(label_pattern.finditer(search_text))
    if labeled:
        first_pos = labeled[0].start()
        cluster = [
            item for item in labeled
            if item.start() - first_pos <= 1800
        ]
        rows = [
            {
                "name": item.group(1),
                "revenue_pct": safe_float(item.group(2)),
                "name_disclosed": False,
                "source": "customer_label",
            }
            for item in cluster
        ]
        return payload(rows)

    # Named customer concentration, issuer-first form:
    # "Walmart Inc. and its affiliates accounted for consolidated net sales of
    # approximately 16% in 2026..."
    named_customer_first_pattern = re.compile(
        r"(?:our\s+largest\s+customer\s*,?\s*)?"
        r"(?P<name>[A-Z][A-Za-z0-9&.'’\- ]{1,80}?)"
        r"(?:\s+and\s+its\s+affiliates)?"
        r"\s*,?\s*"
        r"(?:accounted\s+for|represented|comprised)"
        r"\s+(?:approximately\s+|about\s+)?"
        r"(?:consolidated\s+|total\s+)?(?:net\s+)?(?:sales|revenue|revenues)"
        r"\s+of\s+(?:approximately\s+|about\s+)?"
        r"(?P<pct>\d{1,3}(?:\.\d+)?)\s*%",
        re.IGNORECASE,
    )
    named_customer_first = named_customer_first_pattern.search(text)
    if named_customer_first:
        name = normalize_spaces(named_customer_first.group("name"))
        # Do not accidentally preserve a leading narrative fragment.
        name = re.sub(
            r"^(?:our\s+largest\s+customer\s+|largest\s+customer\s+)",
            "",
            name,
            flags=re.IGNORECASE,
        )
        return payload([{
            "name": name,
            "revenue_pct": safe_float(named_customer_first.group("pct")),
            "name_disclosed": True,
            "source": "named_sales_customer",
        }])

    # Named customer concentration. The first match in the latest filing text is
    # the current-period disclosure; later matches often describe comparisons.
    named_pattern = re.compile(
        r"(\d{1,3}(?:\.\d+)?)\s*%\s+of\s+(?:our\s+)?(?:\$[\d.]+\s+billion\s+in\s+)?"
        r"(?:total\s+|consolidated\s+)?sales\s+(?:were|was)\s+from\s+"
        r"((?:the\s+)?U\.?S\.?\s+Government|[A-Z][A-Za-z0-9&.'’\- ]{2,80})",
        re.IGNORECASE,
    )
    named_match = named_pattern.search(text)
    if named_match:
        name = re.sub(
            r"^the\s+",
            "",
            normalize_spaces(named_match.group(2)),
            flags=re.IGNORECASE,
        )
        return payload([{
            "name": name,
            "revenue_pct": safe_float(named_match.group(1)),
            "name_disclosed": True,
            "source": "named_sales_customer",
        }])

    # Generic "one customer ... another customer ..." disclosure. Restrict to
    # the first local disclosure cluster to avoid appending prior-year customers.
    generic_pattern = re.compile(
        r"(?:sales\s+to\s+)?(?:one|another|a|the)\s+(?:direct\s+)?customer"
        r"[^.%]{0,240}?(?:represented|accounted\s+for|comprised)"
        r"[^.%]{0,120}?(\d{1,3}(?:\.\d+)?)\s*%\s+of\s+"
        r"(?:our\s+)?(?:total\s+)?(?:revenue|sales)",
        re.IGNORECASE,
    )
    generic_matches = list(generic_pattern.finditer(search_text))
    if generic_matches:
        first_pos = generic_matches[0].start()
        cluster = [
            item for item in generic_matches
            if item.start() - first_pos <= 1200
        ]
        rows = [
            {
                "name": f"Unnamed Direct Customer {idx + 1}",
                "revenue_pct": safe_float(item.group(1)),
                "name_disclosed": False,
                "source": "unnamed_customer_disclosure",
            }
            for idx, item in enumerate(cluster)
        ]
        return payload(rows)

    bottler_pattern = re.compile(
        r"(?:one|a)\s+(?:bottler|customer)[^.]{0,220}?"
        r"(?:accounted\s+for|represented|comprised)\s+"
        r"(\d{1,3}(?:\.\d+)?)\s*%\s+of\s+(?:our\s+)?"
        r"(?:net\s+operating\s+revenues|net\s+revenues|total\s+revenue|sales)",
        re.IGNORECASE,
    )
    bottler = bottler_pattern.search(search_text)
    if bottler:
        return payload([{
            "name": "Unnamed Customer 1",
            "revenue_pct": safe_float(bottler.group(1)),
            "name_disclosed": False,
            "source": "unnamed_customer_disclosure",
        }])

    return payload([])

def build_insights(payload):
    reportable_segments = payload.get("reportable_segments") or []
    end_markets = payload.get("end_markets") or []
    geography = payload.get("geography") or []
    customer_concentration = payload.get("customer_concentration") or {}

    largest_segment = max(reportable_segments, key=lambda x: x.get("revenue") or 0, default=None)
    largest_end_market = max(end_markets, key=lambda x: x.get("revenue") or 0, default=None)
    valid_geography = [
        row for row in geography
        if row.get("revenue") is not None and row.get("revenue") >= 1_000_000_000
    ]

    largest_geo = max(valid_geography, key=lambda x: x.get("revenue") or 0, default=None)

    summary = []

    if largest_segment:
        summary.append(
            f"{largest_segment['name']} is the largest reportable segment at "
            f"{round(largest_segment.get('mix_pct') or 0, 1)}% of analyzed revenue."
        )

    if largest_end_market:
        summary.append(
            f"{largest_end_market['name']} is the largest end market at "
            f"{round(largest_end_market.get('mix_pct') or 0, 1)}% of analyzed revenue."
        )

    if largest_geo:
        summary.append(
            f"{largest_geo['name']} is the largest geographic/customer-headquarters exposure at "
            f"{round(largest_geo.get('mix_pct') or 0, 1)}% of analyzed revenue."
        )

    largest_customer_pct = customer_concentration.get("largest_customer_pct")
    if largest_customer_pct is not None:
        summary.append(
            f"The largest detected customer represents about {largest_customer_pct:.0f}% of revenue."
        )

    return {
        "largest_segment": largest_segment,
        "largest_end_market": largest_end_market,
        "largest_geography": largest_geo,
        "summary": summary,
    }


def debug_label_windows(text, ticker, labels, chars_before=600, chars_after=1600):
    if not text:
        print(f"[DEBUG {ticker}] No text available.")
        return

    print("=" * 80)
    print(f"[DEBUG {ticker}] Label windows")
    print("=" * 80)

    for label in labels:
        label_pattern = re.escape(label).replace("\\ ", r"\s+")
        match = re.search(label_pattern, text, re.IGNORECASE | re.DOTALL)

        if not match:
            print(f"\n[DEBUG {ticker}] Label not found: {label}")
            continue

        start = max(0, match.start() - chars_before)
        end = min(len(text), match.end() + chars_after)

        print(f"\n[DEBUG {ticker}] Window for label: {label}")
        print("-" * 80)
        print(text[start:end])
        print("-" * 80)


def build_payload(ticker):
    clean_ticker = ticker.strip().upper()

    if clean_ticker in COMPANY_PARSER_CONFIG:
        parser_config = COMPANY_PARSER_CONFIG[clean_ticker]
    else:
        parser_config = DEFAULT_PARSER_CONFIG

    cik = get_cik_for_ticker(clean_ticker)

    if not cik:
        raise ValueError(f"Could not find CIK for {clean_ticker}")

    print(f"Ticker: {clean_ticker}")
    print(f"CIK: {cik}")

    latest_10k = get_latest_filing(cik, "10-K")

    # Successor registrants such as XOM may have current 10-Qs on a new CIK while
    # the latest historical 10-K still lives on the predecessor CIK.
    if not latest_10k and clean_ticker in PREDECESSOR_CIK_FALLBACKS:
        predecessor_cik = PREDECESSOR_CIK_FALLBACKS[clean_ticker]
        latest_10k = get_latest_filing(predecessor_cik, "10-K")
        if latest_10k:
            latest_10k["predecessor_cik"] = predecessor_cik

    print(f"10-K: {latest_10k['filing_date'] if latest_10k else 'None'}")

    time.sleep(0.2)

    latest_10q = get_latest_filing(cik, "10-Q")
    print(f"10-Q: {latest_10q['filing_date'] if latest_10q else 'None'}")

    annual_text = latest_10k["clean_text"] if latest_10k else ""
    quarterly_text = latest_10q["clean_text"] if latest_10q else ""

    analysis_text = quarterly_text or annual_text

    msft_annual_segment_note = ""
    msft_quarterly_segment_note = ""

    if clean_ticker == "MSFT":
        msft_annual_segment_note = extract_note_section(
            annual_text,
            start_patterns=[
                r"NOTE\s+\d+\s+[—\-]\s+SEGMENT INFORMATION AND GEOGRAPHIC DATA",
                r"NOTE\s+\d+\s+SEGMENT INFORMATION AND GEOGRAPHIC DATA",
                r"Segment Information and Geographic Data",
            ],
            end_patterns=[
                r"NOTE\s+\d+\s+[—\-]",
                r"ITEM\s+9",
            ],
            max_chars=90000,
        )

        msft_quarterly_segment_note = extract_note_section(
            quarterly_text,
            start_patterns=[
                r"NOTE\s+\d+\s+[—\-]\s+SEGMENT INFORMATION AND GEOGRAPHIC DATA",
                r"NOTE\s+\d+\s+SEGMENT INFORMATION AND GEOGRAPHIC DATA",
                r"Segment Information and Geographic Data",
            ],
            end_patterns=[
                r"NOTE\s+\d+\s+[—\-]",
                r"ITEM\s+2",
            ],
            max_chars=70000,
        )

    DEBUG_TICKERS = set()

    if clean_ticker in DEBUG_TICKERS:
        debug_labels = (
                parser_config.get("reportable_segment_labels", [])
                + parser_config.get("end_market_labels", [])
                + parser_config.get("geography_labels", [])
                + [
                    "revenue",
                    "net sales",
                    "segment",
                    "remaining performance obligations",
                    "deferred revenue",
                ]
        )

        debug_label_windows(
            annual_text,
            clean_ticker,
            debug_labels,
            chars_before=800,
            chars_after=2200,
        )

        debug_label_windows(
            quarterly_text,
            clean_ticker,
            debug_labels,
            chars_before=800,
            chars_after=2200,
        )

    annual_segment_section = extract_section_between(
        annual_text,
        start_patterns=[
            r"Reportable Segments",
            r"Segment Information",
            r"Business Segments",
            r"Segment Results",
            r"Information about our segments",
            r"Results of Operations",
        ],
        end_patterns=[
            r"Revenue by geographic",
            r"Geographic",
            r"Concentration",
            r"Item\s+8",
        ],
        max_chars=30000,
    )

    annual_market_section = extract_section_between(
        annual_text,
        start_patterns=[
            r"Revenue by market",
            r"Revenue by end market",
            r"Revenue by category",
            r"Revenue by product",
            r"Net sales by category",
            r"Net sales by product",
            r"Disaggregated revenue",
            r"Disaggregation of revenue",
        ],
        end_patterns=[
            r"Revenue by geographic",
            r"Geographic",
            r"Accounts Receivable",
            r"Concentration",
        ],
        max_chars=30000,
    )

    annual_geo_section = extract_section_between(
        annual_text,
        start_patterns=[
            r"Revenue by geographic",
            r"Revenue by geography",
            r"geographic region",
            r"customer headquarters",
            r"Net sales by reportable segment",
            r"Net sales by geographic",
            r"Revenue by country",
        ],
        end_patterns=[
            r"Accounts Receivable",
            r"Concentration",
            r"Deferred Revenue",
            r"Remaining Performance Obligations",
        ],
        max_chars=25000,
    )

    quarterly_segment_section = extract_section_between(
        quarterly_text,
        start_patterns=[
            r"Reportable Segments",
            r"Segment Information",
            r"Business Segments",
            r"Segment Results",
            r"Information about our segments",
            r"Results of Operations",
        ],
        end_patterns=[
            r"Revenue by geographic",
            r"Geographic",
            r"Concentration",
            r"Remaining Performance Obligations",
        ],
        max_chars=30000,
    )

    quarterly_market_section = extract_section_between(
        quarterly_text,
        start_patterns=[
            r"Revenue by market",
            r"Revenue by end market",
            r"Revenue by category",
            r"Revenue by product",
            r"Net sales by category",
            r"Net sales by product",
            r"Disaggregated revenue",
            r"Disaggregation of revenue",
        ],
        end_patterns=[
            r"Revenue by geographic",
            r"Geographic",
            r"Accounts Receivable",
            r"Concentration",
        ],
        max_chars=30000,
    )

    quarterly_geo_section = extract_section_between(
        quarterly_text,
        start_patterns=[
            r"Revenue by geographic",
            r"Revenue by geography",
            r"geographic region",
            r"customer headquarters",
            r"Net sales by reportable segment",
            r"Net sales by geographic",
            r"Revenue by country",
        ],
        end_patterns=[
            r"Accounts Receivable",
            r"Concentration",
            r"Deferred Revenue",
            r"Remaining Performance Obligations",
        ],
        max_chars=25000,
    )

    # ---------------------------------------------------------
    # Company-specific section overrides
    # ---------------------------------------------------------

    if clean_ticker == "MSFT":
        msft_annual_segment_table = extract_subsection_between(
            msft_annual_segment_note,
            start_patterns=[
                r"Revenue\s+Operating\s+Income",
                r"Revenue\s+Cost of revenue\s+Gross margin\s+Operating income",
                r"Productivity and Business Processes\s+Intelligent Cloud\s+More Personal Computing",
            ],
            end_patterns=[
                r"Revenue, classified by significant product and service offerings",
                r"Revenue classified by significant product and service offerings",
                r"Geographic Data",
            ],
            max_chars=30000,
        )

        msft_annual_product_table = extract_subsection_between(
            msft_annual_segment_note,
            start_patterns=[
                r"Revenue, classified by significant product and service offerings",
                r"Revenue classified by significant product and service offerings",
                r"significant product and service offerings",
            ],
            end_patterns=[
                r"Revenue, classified by the major geographic areas",
                r"Revenue classified by the major geographic areas",
                r"Geographic Data",
            ],
            max_chars=30000,
        )

        msft_annual_geo_table = extract_subsection_between(
            msft_annual_segment_note,
            start_patterns=[
                r"Revenue, classified by the major geographic areas",
                r"Revenue classified by the major geographic areas",
                r"major geographic areas",
            ],
            end_patterns=[
                r"Property and equipment",
                r"Long-lived assets",
                r"NOTE\s+\d+",
            ],
            max_chars=20000,
        )

        msft_quarterly_segment_table = extract_subsection_between(
            msft_quarterly_segment_note,
            start_patterns=[
                r"Revenue\s+Operating\s+Income",
                r"Revenue\s+Cost of revenue\s+Gross margin\s+Operating income",
                r"Productivity and Business Processes\s+Intelligent Cloud\s+More Personal Computing",
            ],
            end_patterns=[
                r"Revenue, classified by significant product and service offerings",
                r"Revenue classified by significant product and service offerings",
                r"Geographic Data",
            ],
            max_chars=30000,
        )

        msft_quarterly_product_table = extract_subsection_between(
            msft_quarterly_segment_note,
            start_patterns=[
                r"Revenue, classified by significant product and service offerings",
                r"Revenue classified by significant product and service offerings",
                r"significant product and service offerings",
            ],
            end_patterns=[
                r"Revenue, classified by the major geographic areas",
                r"Revenue classified by the major geographic areas",
                r"Geographic Data",
            ],
            max_chars=30000,
        )

        msft_quarterly_geo_table = extract_subsection_between(
            msft_quarterly_segment_note,
            start_patterns=[
                r"Revenue, classified by the major geographic areas",
                r"Revenue classified by the major geographic areas",
                r"major geographic areas",
            ],
            end_patterns=[
                r"Property and equipment",
                r"Long-lived assets",
                r"NOTE\s+\d+",
            ],
            max_chars=20000,
        )

        if msft_annual_segment_table:
            annual_segment_section = msft_annual_segment_table

        if msft_annual_product_table:
            annual_market_section = msft_annual_product_table

        if msft_annual_geo_table:
            annual_geo_section = msft_annual_geo_table

        if msft_quarterly_segment_table:
            quarterly_segment_section = msft_quarterly_segment_table

        if msft_quarterly_product_table:
            quarterly_market_section = msft_quarterly_product_table

        if msft_quarterly_geo_table:
            quarterly_geo_section = msft_quarterly_geo_table

        print("MSFT segment table found:", bool(msft_annual_segment_table))
        print("MSFT product table found:", bool(msft_annual_product_table))
        print("MSFT geo table found:", bool(msft_annual_geo_table))
        print("MSFT quarterly segment table found:", bool(msft_quarterly_segment_table))
        print("MSFT quarterly product table found:", bool(msft_quarterly_product_table))
        print("MSFT quarterly geo table found:", bool(msft_quarterly_geo_table))

        print("MSFT PRODUCT TABLE SAMPLE:")
        print((msft_annual_product_table or "")[:4000])

        print("MSFT SEGMENT TABLE SAMPLE:")
        print((msft_annual_segment_table or "")[:4000])

        print("MSFT GEO TABLE SAMPLE:")
        print((msft_annual_geo_table or "")[:4000])

    # ------------------------------------------------------------------
    # Structured HTML-table extraction
    # ------------------------------------------------------------------
    annual_total_revenue = infer_total_revenue_from_tables(latest_10k, mode="annual")
    quarterly_total_revenue = infer_total_revenue_from_tables(latest_10q, mode="latest_quarter")

    # Text fallback only if the structured tables did not expose a consolidated
    # total. This is used for mix percentages, not for choosing rows.
    if quarterly_total_revenue is None:
        quarterly_total_revenue = extract_money_phrase(quarterly_text, [
            r"Total revenue\s*\$?\s*([\d,]+(?:\.\d+)?)\s*(billion|million)?",
            r"Total revenues\s*\$?\s*([\d,]+(?:\.\d+)?)\s*(billion|million)?",
        ])

    reportable_segment_labels = parser_config.get("reportable_segment_labels", [])
    annual_end_market_labels = parser_config.get(
        "annual_end_market_labels",
        parser_config.get("end_market_labels", []),
    )
    quarterly_end_market_labels = parser_config.get(
        "quarterly_end_market_labels",
        parser_config.get("end_market_labels", []),
    )
    geography_labels = parser_config.get("geography_labels", [])

    non_additive_categories = set(parser_config.get("non_additive_categories") or [])
    expected_segment_count = parser_config.get("expected_segment_count")
    merge_missing_segments = bool(parser_config.get("merge_missing_segments"))
    merge_missing_end_markets = bool(parser_config.get("merge_missing_end_markets"))

    configured_company = clean_ticker in COMPANY_PARSER_CONFIG

    annual_segments = clean_category_rows(
        extract_category_rows_from_filing(
            latest_10k,
            reportable_segment_labels,
            "segments",
            total_revenue=annual_total_revenue,
            mode="annual",
            allow_discovery=not configured_company,
            non_additive="segments" in non_additive_categories,
            expected_count=expected_segment_count,
            merge_missing=merge_missing_segments,
        ),
        "segments",
        total_revenue=annual_total_revenue,
    )

    annual_end_markets = clean_category_rows(
        extract_category_rows_from_filing(
            latest_10k,
            annual_end_market_labels,
            "end_markets",
            total_revenue=annual_total_revenue,
            mode="annual",
            allow_discovery=not configured_company,
            non_additive="end_markets" in non_additive_categories,
            expected_count=parser_config.get("expected_end_market_count"),
            merge_missing=merge_missing_end_markets,
        ),
        "end_markets",
        total_revenue=annual_total_revenue,
    )

    annual_geography_rows = clean_category_rows(
        extract_category_rows_from_filing(
            latest_10k,
            geography_labels,
            "geography",
            total_revenue=annual_total_revenue,
            mode="annual",
            allow_discovery=not configured_company,
            non_additive="geography" in non_additive_categories,
        ),
        "geography",
        total_revenue=annual_total_revenue,
    )

    quarterly_segments = clean_category_rows(
        extract_category_rows_from_filing(
            latest_10q,
            reportable_segment_labels,
            "segments",
            total_revenue=quarterly_total_revenue,
            mode="latest_quarter",
            allow_discovery=not configured_company,
            non_additive="segments" in non_additive_categories,
            expected_count=expected_segment_count,
            merge_missing=merge_missing_segments,
        ),
        "segments",
        total_revenue=quarterly_total_revenue,
    )

    quarterly_end_markets = clean_category_rows(
        extract_category_rows_from_filing(
            latest_10q,
            quarterly_end_market_labels,
            "end_markets",
            total_revenue=quarterly_total_revenue,
            mode="latest_quarter",
            allow_discovery=not configured_company,
            non_additive="end_markets" in non_additive_categories,
            expected_count=parser_config.get("expected_end_market_count"),
            merge_missing=merge_missing_end_markets,
        ),
        "end_markets",
        total_revenue=quarterly_total_revenue,
    )

    quarterly_geography_rows = clean_category_rows(
        extract_category_rows_from_filing(
            latest_10q,
            geography_labels,
            "geography",
            total_revenue=quarterly_total_revenue,
            mode="latest_quarter",
            allow_discovery=not configured_company,
            non_additive="geography" in non_additive_categories,
        ),
        "geography",
        total_revenue=quarterly_total_revenue,
    )

    if parser_config.get("segment_direct_annual_rows"):
        direct_annual_segments = extract_configured_direct_annual_rows(
            latest_10k,
            reportable_segment_labels,
            total_revenue=annual_total_revenue,
            scale_override=parser_config.get("segment_scale_override"),
            category="segments",
        )
        if len(direct_annual_segments) >= (expected_segment_count or len(reportable_segment_labels)):
            annual_segments = direct_annual_segments

    if parser_config.get("geography_direct_annual_rows"):
        direct_annual_geography = extract_configured_direct_annual_rows(
            latest_10k,
            geography_labels,
            total_revenue=annual_total_revenue,
            scale_override=parser_config.get("geography_scale_override"),
            category="geography",
        )
        expected_geo_count = parser_config.get("expected_geography_count") or len(geography_labels)
        if len(direct_annual_geography) >= expected_geo_count:
            annual_geography_rows = direct_annual_geography

    if parser_config.get("end_market_direct_annual_rows"):
        direct_annual_markets = extract_configured_direct_annual_rows(
            latest_10k,
            annual_end_market_labels,
            total_revenue=annual_total_revenue,
            scale_override=parser_config.get("end_market_scale_override"),
        )
        expected_market_count = parser_config.get("expected_end_market_count") or len(annual_end_market_labels)
        if len(direct_annual_markets) >= expected_market_count:
            annual_end_markets = direct_annual_markets

    if parser_config.get("end_market_total_column_by_year"):
        total_column_denominator = (
            None
            if parser_config.get("end_market_total_column_ignore_denominator")
            else annual_total_revenue
        )
        total_column_markets = extract_total_column_category_by_year(
            latest_10k,
            annual_end_market_labels,
            "end_markets",
            total_revenue=total_column_denominator,
            mode="annual",
        )
        expected_market_count = parser_config.get("expected_end_market_count") or len(annual_end_market_labels)
        if len(total_column_markets) >= expected_market_count:
            annual_end_markets = total_column_markets

    end_market_value_layout = parser_config.get("end_market_value_layout")
    if end_market_value_layout:
        multicolumn_annual = extract_configured_multicolumn_end_markets(
            latest_10k,
            annual_end_market_labels,
            end_market_value_layout,
            total_revenue=annual_total_revenue,
            mode="annual",
        )
        expected_market_count = parser_config.get("expected_end_market_count") or len(annual_end_market_labels)
        if len(multicolumn_annual) >= expected_market_count:
            annual_end_markets = multicolumn_annual

    if parser_config.get("geography_total_column_by_year"):
        total_geo_annual = extract_total_column_geography_by_year(
            latest_10k,
            geography_labels,
            total_revenue=annual_total_revenue,
            mode="annual",
        )
        expected_geo_count = parser_config.get("expected_geography_count") or len(geography_labels)
        if len(total_geo_annual) >= expected_geo_count:
            annual_geography_rows = total_geo_annual

    geography_section_metric = parser_config.get("geography_section_metric")
    if geography_section_metric:
        section_geo_annual = extract_metric_section_rows_from_filing(
            latest_10k,
            geography_labels,
            "geography",
            geography_section_metric,
            total_revenue=annual_total_revenue,
            mode="annual",
        )
        if len(section_geo_annual) >= (parser_config.get("expected_geography_count") or 1):
            annual_geography_rows = section_geo_annual

        section_geo_quarterly = extract_metric_section_rows_from_filing(
            latest_10q,
            geography_labels,
            "geography",
            geography_section_metric,
            total_revenue=quarterly_total_revenue,
            mode="latest_quarter",
        )
        if len(section_geo_quarterly) >= (parser_config.get("expected_geography_count") or 1):
            quarterly_geography_rows = section_geo_quarterly

    # High-confidence per-segment overrides for disclosures that SEC HTML
    # separates from the primary coherent segment table.
    supplemental_segment_metrics = parser_config.get("supplemental_segment_metrics") or {}
    supplemental_segment_scale_overrides = (
        parser_config.get("supplemental_segment_scale_overrides") or {}
    )

    for label, metric_phrase in supplemental_segment_metrics.items():
        annual_override = extract_heading_metric_row_from_filing(
            latest_10k,
            label,
            metric_phrase,
            total_revenue=annual_total_revenue,
            mode="annual",
        )
        if annual_override:
            annual_segments = [
                row for row in annual_segments
                if _semantic_label(row.get("name")) != _semantic_label(label)
            ]
            annual_segments.append(annual_override)

        quarterly_override = extract_heading_metric_row_from_filing(
            latest_10q,
            label,
            metric_phrase,
            total_revenue=quarterly_total_revenue,
            mode="latest_quarter",
        )
        if quarterly_override:
            quarterly_segments = [
                row for row in quarterly_segments
                if _semantic_label(row.get("name")) != _semantic_label(label)
            ]
            quarterly_segments.append(quarterly_override)

    if supplemental_segment_metrics:
        segment_order = {
            _semantic_label(label): i
            for i, label in enumerate(reportable_segment_labels)
        }
        annual_segments.sort(
            key=lambda row: segment_order.get(_semantic_label(row.get("name")), 999)
        )
        quarterly_segments.sort(
            key=lambda row: segment_order.get(_semantic_label(row.get("name")), 999)
        )

    # JPM-style wide geography: choose Revenue from each year's metric group,
    # not the next adjacent metric (Expense) as the prior-year value.
    geography_wide_metric = parser_config.get("geography_wide_metric")
    if geography_wide_metric:
        wide_annual_geo = extract_wide_row_metric_from_filing(
            latest_10k,
            geography_labels,
            "geography",
            geography_wide_metric,
            total_revenue=annual_total_revenue,
            mode="annual",
        )
        if len(wide_annual_geo) >= (parser_config.get("expected_geography_count") or 1):
            annual_geography_rows = wide_annual_geo

        wide_quarterly_geo = extract_wide_row_metric_from_filing(
            latest_10q,
            geography_labels,
            "geography",
            geography_wide_metric,
            total_revenue=quarterly_total_revenue,
            mode="latest_quarter",
        )
        if len(wide_quarterly_geo) >= (parser_config.get("expected_geography_count") or 1):
            quarterly_geography_rows = wide_quarterly_geo

    if not configured_company:
        annual_segments, annual_end_markets, annual_geography_rows = (
            _sanitize_generic_category_overlap(
                annual_segments,
                annual_end_markets,
                annual_geography_rows,
                total_revenue=annual_total_revenue,
            )
        )
        quarterly_segments, quarterly_end_markets, quarterly_geography_rows = (
            _sanitize_generic_category_overlap(
                quarterly_segments,
                quarterly_end_markets,
                quarterly_geography_rows,
                total_revenue=quarterly_total_revenue,
            )
        )

    segment_row_metric = parser_config.get("segment_row_metric")
    if segment_row_metric:
        row_metric_annual = extract_configured_segment_row_metric_from_filing(
            latest_10k,
            reportable_segment_labels,
            segment_row_metric,
            total_revenue=annual_total_revenue,
            mode="annual",
        )
        if len(row_metric_annual) >= (expected_segment_count or len(reportable_segment_labels)):
            annual_segments = row_metric_annual

        row_metric_quarterly = extract_configured_segment_row_metric_from_filing(
            latest_10q,
            reportable_segment_labels,
            segment_row_metric,
            total_revenue=quarterly_total_revenue,
            mode="latest_quarter",
        )
        if len(row_metric_quarterly) >= (expected_segment_count or len(reportable_segment_labels)):
            quarterly_segments = row_metric_quarterly

    segment_year_block_metric = parser_config.get("segment_year_block_metric")
    if segment_year_block_metric:
        block_annual = extract_segment_year_block_metric_from_filing(
            latest_10k,
            reportable_segment_labels,
            segment_year_block_metric,
            total_revenue=annual_total_revenue,
            mode="annual",
        )
        if len(block_annual) >= (expected_segment_count or len(reportable_segment_labels)):
            annual_segments = block_annual

        block_quarterly = extract_segment_year_block_metric_from_filing(
            latest_10q,
            reportable_segment_labels,
            segment_year_block_metric,
            total_revenue=quarterly_total_revenue,
            mode="latest_quarter",
        )
        if len(block_quarterly) >= (expected_segment_count or len(reportable_segment_labels)):
            quarterly_segments = block_quarterly

    named_segment_rows = parser_config.get("named_segment_rows") or {}
    named_segment_rows_context = parser_config.get("named_segment_rows_context")
    if named_segment_rows and named_segment_rows_context:
        named_annual = extract_named_segment_rows_from_filing(
            latest_10k,
            named_segment_rows,
            named_segment_rows_context,
            total_revenue=annual_total_revenue,
            mode="annual",
        )
        if len(named_annual) >= (expected_segment_count or len(named_segment_rows)):
            annual_segments = named_annual

        named_quarterly = extract_named_segment_rows_from_filing(
            latest_10q,
            named_segment_rows,
            named_segment_rows_context,
            total_revenue=quarterly_total_revenue,
            mode="latest_quarter",
        )
        if len(named_quarterly) >= (expected_segment_count or len(named_segment_rows)):
            quarterly_segments = named_quarterly

    sparse_segment_metric = parser_config.get("sparse_segment_metric")
    if sparse_segment_metric:
        sparse_annual = extract_sparse_header_metric_matrix_from_filing(
            latest_10k,
            reportable_segment_labels,
            sparse_segment_metric,
            total_revenue=annual_total_revenue,
            mode="annual",
        )
        if len(sparse_annual) >= (expected_segment_count or len(reportable_segment_labels)):
            annual_segments = sparse_annual

        sparse_quarterly = extract_sparse_header_metric_matrix_from_filing(
            latest_10q,
            reportable_segment_labels,
            sparse_segment_metric,
            total_revenue=quarterly_total_revenue,
            mode="latest_quarter",
        )
        if len(sparse_quarterly) >= (expected_segment_count or len(reportable_segment_labels)):
            quarterly_segments = sparse_quarterly

    forced_segment_metric = parser_config.get("forced_segment_metric")

    if forced_segment_metric:
        ignore_forced_denominator = bool(
            parser_config.get("forced_segment_metric_ignore_denominator")
        )
        forced_annual_denominator = (
            None if ignore_forced_denominator else annual_total_revenue
        )
        forced_quarterly_denominator = (
            None if ignore_forced_denominator else quarterly_total_revenue
        )

        ignore_forced_context = bool(
            parser_config.get("forced_segment_metric_ignore_context")
        )

        forced_annual = extract_forced_metric_matrix_from_filing(
            latest_10k,
            reportable_segment_labels,
            forced_segment_metric,
            total_revenue=forced_annual_denominator,
            mode="annual",
            require_segment_context=not ignore_forced_context,
            scale_override=parser_config.get("forced_segment_scale_override"),
        )
        if len(forced_annual) >= (expected_segment_count or len(reportable_segment_labels)):
            annual_segments = forced_annual

        forced_quarterly = extract_forced_metric_matrix_from_filing(
            latest_10q,
            reportable_segment_labels,
            forced_segment_metric,
            total_revenue=forced_quarterly_denominator,
            mode="latest_quarter",
            require_segment_context=not ignore_forced_context,
            scale_override=parser_config.get("forced_segment_scale_override"),
        )
        if len(forced_quarterly) >= (expected_segment_count or len(reportable_segment_labels)):
            quarterly_segments = forced_quarterly

    individual_segment_metric = parser_config.get("individual_segment_metric")
    if individual_segment_metric:
        individual_annual = extract_individual_segment_metric_tables_from_filing(
            latest_10k,
            reportable_segment_labels,
            individual_segment_metric,
            total_revenue=None,
            mode="annual",
            scale_override=parser_config.get("individual_segment_scale_override"),
        )
        if len(individual_annual) >= (expected_segment_count or len(reportable_segment_labels)):
            annual_segments = individual_annual

        # Quarterly filing-intelligence categories remain subject to the
        # verified-quarter whitelist below, so do not infer YTD as a quarter.

    # Re-apply explicit supplemental segments after all structural segment
    # extractors, because a later forced matrix may have replaced the list.
    if supplemental_segment_metrics:
        for label, metric_phrase in supplemental_segment_metrics.items():
            annual_override = extract_heading_metric_row_from_filing(
                latest_10k,
                label,
                metric_phrase,
                total_revenue=annual_total_revenue,
                mode="annual",
                scale_override=supplemental_segment_scale_overrides.get(label),
            )
            if annual_override:
                annual_segments = [
                    row for row in annual_segments
                    if _semantic_label(row.get("name")) != _semantic_label(label)
                ]
                annual_segments.append(annual_override)

        annual_segments.sort(
            key=lambda row: (
                {
                    _semantic_label(name): idx
                    for idx, name in enumerate(
                        list(reportable_segment_labels)
                        + list(supplemental_segment_metrics.keys())
                    )
                }.get(_semantic_label(row.get("name")), 999)
            )
        )

    # A bad consolidated-revenue candidate can itself cause a valid large
    # segment to be filtered out. For opted-in companies such as XOM, recover
    # the complete configured set without that denominator before repairing it.
    if (
        parser_config.get("recover_complete_segments_without_denominator")
        and expected_segment_count
        and len(annual_segments) < expected_segment_count
    ):
        recovered = clean_category_rows(
            extract_category_rows_from_filing(
                latest_10k,
                reportable_segment_labels,
                "segments",
                total_revenue=None,
                mode="annual",
                allow_discovery=False,
                non_additive="segments" in non_additive_categories,
                expected_count=expected_segment_count,
                merge_missing=merge_missing_segments,
            ),
            "segments",
            total_revenue=None,
        )
        if len(recovered) >= expected_segment_count:
            annual_segments = recovered
            if "segments" not in non_additive_categories:
                recovered_sum = sum(float(row.get("revenue") or 0) for row in recovered)
                if recovered_sum > 0:
                    annual_total_revenue = recovered_sum

            # Re-run categories that were previously suppressed by the bad
            # denominator.
            annual_geography_rows = clean_category_rows(
                extract_category_rows_from_filing(
                    latest_10k,
                    geography_labels,
                    "geography",
                    total_revenue=annual_total_revenue,
                    mode="annual",
                    allow_discovery=not configured_company,
                    non_additive="geography" in non_additive_categories,
                ),
                "geography",
                total_revenue=annual_total_revenue,
            )

    if (
        parser_config.get("recover_complete_segments_without_denominator")
        and expected_segment_count
        and len(quarterly_segments) < expected_segment_count
    ):
        recovered = clean_category_rows(
            extract_category_rows_from_filing(
                latest_10q,
                reportable_segment_labels,
                "segments",
                total_revenue=None,
                mode="latest_quarter",
                allow_discovery=False,
                non_additive="segments" in non_additive_categories,
                expected_count=expected_segment_count,
                merge_missing=merge_missing_segments,
            ),
            "segments",
            total_revenue=None,
        )
        if len(recovered) >= expected_segment_count:
            quarterly_segments = recovered
            if "segments" not in non_additive_categories:
                recovered_sum = sum(float(row.get("revenue") or 0) for row in recovered)
                if recovered_sum > 0:
                    quarterly_total_revenue = recovered_sum

            quarterly_geography_rows = clean_category_rows(
                extract_category_rows_from_filing(
                    latest_10q,
                    geography_labels,
                    "geography",
                    total_revenue=quarterly_total_revenue,
                    mode="latest_quarter",
                    allow_discovery=not configured_company,
                    non_additive="geography" in non_additive_categories,
                ),
                "geography",
                total_revenue=quarterly_total_revenue,
            )


    annual_category_scale_corrections = (
        parser_config.get("annual_category_scale_corrections") or {}
    )
    for category_name, rows in (
        ("segments", annual_segments),
        ("end_markets", annual_end_markets),
        ("geography", annual_geography_rows),
    ):
        factor = safe_float(annual_category_scale_corrections.get(category_name))
        if factor is None or factor == 1:
            continue

        for row in rows:
            if row.get("revenue") is not None:
                row["revenue"] = float(row["revenue"]) * factor
            if row.get("prior_period_revenue") is not None:
                row["prior_period_revenue"] = (
                    float(row["prior_period_revenue"]) * factor
                )
            row["yoy_growth"] = pct_growth(
                row.get("revenue"),
                row.get("prior_period_revenue"),
            )
            source = str(row.get("source") or "")
            row["source"] = (
                f"{source}|configured_scale_correction"
                if source
                else "configured_scale_correction"
            )

    if (
        parser_config.get("consolidated_revenue_from_segment_sum")
        and annual_segments
    ):
        trusted_segment_sum = sum(
            float(row.get("revenue") or 0)
            for row in annual_segments
        )
        if trusted_segment_sum > 0:
            annual_total_revenue = trusted_segment_sum

    if (
        parser_config.get("consolidated_revenue_from_end_market_sum")
        and annual_end_markets
    ):
        trusted_market_sum = sum(
            float(row.get("revenue") or 0)
            for row in annual_end_markets
        )
        if trusted_market_sum > 0:
            annual_total_revenue = trusted_market_sum

    # A complete additive segment set is an excellent cross-check on a bad
    # "total revenue" candidate accidentally selected elsewhere in a filing.
    if (
        expected_segment_count
        and "segments" not in non_additive_categories
        and len(annual_segments) >= expected_segment_count
    ):
        segment_sum = sum(
            float(row.get("revenue") or 0)
            for row in annual_segments
        )
        if segment_sum > 0 and (
            annual_total_revenue is None
            or annual_total_revenue > segment_sum * 1.45
            or annual_total_revenue < segment_sum * 0.65
        ):
            annual_total_revenue = segment_sum

    if (
        expected_segment_count
        and "segments" not in non_additive_categories
        and len(quarterly_segments) >= expected_segment_count
    ):
        segment_sum = sum(
            float(row.get("revenue") or 0)
            for row in quarterly_segments
        )
        if segment_sum > 0 and (
            quarterly_total_revenue is None
            or quarterly_total_revenue > segment_sum * 1.45
            or quarterly_total_revenue < segment_sum * 0.65
        ):
            quarterly_total_revenue = segment_sum

    # 10-Q tables frequently contain both discrete-quarter and YTD columns.
    # Generic issuers are always annual-only. Configured issuers are also
    # annual-only unless their quarterly category parsing has been manually
    # validated as discrete-quarter.
    if (
        not configured_company
        or clean_ticker not in VERIFIED_QUARTERLY_BREAKDOWN_TICKERS
    ):
        quarterly_segments = []
        quarterly_end_markets = []
        quarterly_geography_rows = []

    # Recalculate mix percentages after denominator repair. Some banks present
    # reportable segments on a managed basis that is reconciled back to GAAP
    # consolidated revenue separately. For those companies, segment mix should
    # use the complete managed segment total while geography continues to use
    # reported consolidated revenue.
    annual_segment_denominator = annual_total_revenue
    quarterly_segment_denominator = quarterly_total_revenue

    if parser_config.get("segment_mix_denominator") == "segment_sum":
        if annual_segments:
            segment_sum = sum(float(row.get("revenue") or 0) for row in annual_segments)
            if segment_sum > 0:
                annual_segment_denominator = segment_sum
        if quarterly_segments:
            segment_sum = sum(float(row.get("revenue") or 0) for row in quarterly_segments)
            if segment_sum > 0:
                quarterly_segment_denominator = segment_sum

    for rows, denominator in (
        (annual_segments, annual_segment_denominator),
        (annual_end_markets, annual_total_revenue),
        (annual_geography_rows, annual_total_revenue),
        (quarterly_segments, quarterly_segment_denominator),
        (quarterly_end_markets, quarterly_total_revenue),
        (quarterly_geography_rows, quarterly_total_revenue),
    ):
        for row in rows:
            ratio = safe_ratio(row.get("revenue"), denominator)
            row["mix_pct"] = ratio * 100 if ratio is not None else None

    segment_scope = parser_config.get("segment_scope")
    end_market_scope = parser_config.get("end_market_scope")
    geography_scope = parser_config.get("geography_scope")

    if segment_scope:
        for row in annual_segments + quarterly_segments:
            row["scope"] = segment_scope

    if end_market_scope:
        for row in annual_end_markets + quarterly_end_markets:
            row["scope"] = end_market_scope

    if geography_scope:
        for row in annual_geography_rows + quarterly_geography_rows:
            row["scope"] = geography_scope

    # Annual is preferred for durable business-mix intelligence. Quarterly
    # fallback is allowed only for configured issuers whose filing layouts have
    # explicit company-specific rules.
    if configured_company:
        primary_segments = annual_segments or quarterly_segments
        primary_end_markets = annual_end_markets or quarterly_end_markets
        primary_geography_rows = annual_geography_rows or quarterly_geography_rows
    else:
        primary_segments = annual_segments
        primary_end_markets = annual_end_markets
        primary_geography_rows = annual_geography_rows

    # Customer concentration: prefer the latest 10-Q, then fall back to the 10-K.
    customer_concentration = extract_customer_concentration(quarterly_text)
    if not (customer_concentration.get("customers") or []):
        customer_concentration = extract_customer_concentration(annual_text)

    # Revenue visibility may be more current in the 10-Q. If the quarterly
    # filing has no recognized visibility facts, use the annual filing.
    revenue_visibility = extract_revenue_visibility(
        quarterly_text,
        ttm_revenue=None,
    )
    if not any(
        revenue_visibility.get(key) is not None
        for key in ("rpo_total", "deferred_revenue_total", "rpo_from_deferred_revenue")
    ):
        revenue_visibility = extract_revenue_visibility(
            annual_text,
            ttm_revenue=None,
        )

    # The true TTM financial denominator belongs to the core SEC statement
    # engine. This filing parser only has a trustworthy annual denominator.
    revenue_visibility["rpo_to_ttm_revenue"] = None
    revenue_visibility["deferred_revenue_to_ttm_revenue"] = None
    revenue_visibility["rpo_to_latest_annual_revenue"] = (
        safe_ratio(revenue_visibility.get("rpo_total"), annual_total_revenue) * 100
        if safe_ratio(revenue_visibility.get("rpo_total"), annual_total_revenue) is not None
        else None
    )
    revenue_visibility["deferred_revenue_to_latest_annual_revenue"] = (
        safe_ratio(revenue_visibility.get("deferred_revenue_total"), annual_total_revenue) * 100
        if safe_ratio(revenue_visibility.get("deferred_revenue_total"), annual_total_revenue) is not None
        else None
    )
    revenue_visibility["revenue_ratio_basis"] = (
        "latest_annual_revenue" if annual_total_revenue else None
    )

    payload = {
        "ticker": clean_ticker,
        "cik": cik,
        "entity_name": parser_config.get("entity_name") or clean_ticker,
        "source": "SEC filing semantic HTML-table intelligence parser v25",
        "latest_10k": {
            "filing_date": latest_10k.get("filing_date") if latest_10k else None,
            "accession": latest_10k.get("accession") if latest_10k else None,
            "url": latest_10k.get("url") if latest_10k else None,
            "predecessor_cik": latest_10k.get("predecessor_cik") if latest_10k else None,
        },
        "latest_10q": {
            "filing_date": latest_10q.get("filing_date") if latest_10q else None,
            "accession": latest_10q.get("accession") if latest_10q else None,
            "url": latest_10q.get("url") if latest_10q else None,
        },
        "revenue_visibility": revenue_visibility,
        "reportable_segments": primary_segments,
        "end_markets": primary_end_markets,
        "geography": primary_geography_rows,
        "quarterly_breakdown": {
            "reportable_segments": quarterly_segments,
            "end_markets": quarterly_end_markets,
            "geography": quarterly_geography_rows,
        },
        "customer_concentration": customer_concentration,
        "parser_method": "html_table_semantic_v25",
    }

    annual_geo_rows = payload.get("geography") or []
    quarterly_geo_rows = (payload.get("quarterly_breakdown") or {}).get("geography") or []

    annual_geo_total = sum(
        row.get("revenue") or 0
        for row in annual_geo_rows
    )

    if (
        configured_company
        and clean_ticker in VERIFIED_QUARTERLY_BREAKDOWN_TICKERS
        and quarterly_geo_rows
        and (not annual_geo_rows or annual_geo_total < 1_000_000_000)
    ):
        payload["geography"] = quarterly_geo_rows

    revenue_visibility = payload.get("revenue_visibility") or {}
    rpo_total = revenue_visibility.get("rpo_total")
    deferred_revenue_total = revenue_visibility.get("deferred_revenue_total")

    if (
            deferred_revenue_total is not None
            and rpo_total is not None
            and deferred_revenue_total > rpo_total * 5
    ):
        revenue_visibility["deferred_revenue_total"] = None
        revenue_visibility["deferred_revenue_to_ttm_revenue"] = None
        payload["revenue_visibility"] = revenue_visibility

    # Final validation runs after quarterly fallbacks are resolved, so
    # parser_status always agrees with the rows actually returned.
    payload["_validation_total_revenue"] = annual_total_revenue or quarterly_total_revenue
    validation = validate_filing_payload(payload, parser_config)

    payload["parser_status"] = {
        "method": payload.get("parser_method"),
        "quality": validation.get("quality"),
        "reportable_segments_detected": bool(payload.get("reportable_segments")),
        "end_markets_detected": bool(payload.get("end_markets")),
        "geography_detected": bool(payload.get("geography")),
        "customer_concentration_detected": bool(
            (payload.get("customer_concentration") or {}).get("customers")
        ),
        "revenue_visibility_detected": any(
            (payload.get("revenue_visibility") or {}).get(key) is not None
            for key in ("rpo_total", "deferred_revenue_total", "rpo_from_deferred_revenue")
        ),
        "warnings": validation.get("warnings") or [],
        "failures": validation.get("failures") or [],
    }

    if (
        not payload["parser_status"]["reportable_segments_detected"]
        and not parser_config.get("single_segment_expected")
    ):
        payload["parser_status"]["warnings"].append("Reportable segments not detected.")

    payload.pop("_validation_total_revenue", None)
    payload["insights"] = build_insights(payload)
    return payload


def save_payload(payload):
    """
    Persist one ticker. If PostgreSQL/Supabase temporarily drops the connection,
    stay on this ticker and keep retrying instead of recording a false parser
    failure and moving on.
    """
    attempt = 0

    while True:
        conn = None

        try:
            conn = get_db_connection_dict()
            cursor = conn.cursor()

            cursor.execute(
                """
                INSERT INTO filing_intelligence (
                    ticker,
                    cik,
                    entity_name,
                    source,
                    latest_10k,
                    latest_10q,
                    revenue_visibility,
                    reportable_segments,
                    end_markets,
                    geography,
                    quarterly_breakdown,
                    customer_concentration,
                    insights,
                    raw_payload,
                    updated_at
                )
                VALUES (
                    %s, %s, %s, %s,
                    %s::jsonb, %s::jsonb, %s::jsonb, %s::jsonb,
                    %s::jsonb, %s::jsonb, %s::jsonb, %s::jsonb,
                    %s::jsonb, %s::jsonb, NOW()
                )
                ON CONFLICT (ticker)
                DO UPDATE SET
                    cik = EXCLUDED.cik,
                    entity_name = EXCLUDED.entity_name,
                    source = EXCLUDED.source,
                    latest_10k = EXCLUDED.latest_10k,
                    latest_10q = EXCLUDED.latest_10q,
                    revenue_visibility = EXCLUDED.revenue_visibility,
                    reportable_segments = EXCLUDED.reportable_segments,
                    end_markets = EXCLUDED.end_markets,
                    geography = EXCLUDED.geography,
                    quarterly_breakdown = EXCLUDED.quarterly_breakdown,
                    customer_concentration = EXCLUDED.customer_concentration,
                    insights = EXCLUDED.insights,
                    raw_payload = EXCLUDED.raw_payload,
                    updated_at = NOW()
                """,
                (
                    payload.get("ticker"),
                    payload.get("cik"),
                    payload.get("entity_name"),
                    payload.get("source"),
                    json.dumps(payload.get("latest_10k")),
                    json.dumps(payload.get("latest_10q")),
                    json.dumps(payload.get("revenue_visibility")),
                    json.dumps(payload.get("reportable_segments")),
                    json.dumps(payload.get("end_markets")),
                    json.dumps(payload.get("geography")),
                    json.dumps(payload.get("quarterly_breakdown")),
                    json.dumps(payload.get("customer_concentration")),
                    json.dumps(payload.get("insights")),
                    json.dumps(payload),
                ),
            )

            conn.commit()
            print(f"Saved filing intelligence for {payload.get('ticker')}")
            return

        except Exception as exc:
            if not _is_db_connection_error(exc):
                raise

            attempt += 1
            delay = _db_retry_delay(attempt)
            print(
                f"[DB] Connection lost while saving {payload.get('ticker')}: "
                f"{type(exc).__name__}: {exc}"
            )
            print(
                f"[DB] Keeping {payload.get('ticker')} pending and retrying in "
                f"{delay}s (attempt {attempt})..."
            )
            time.sleep(delay)

        finally:
            if conn:
                try:
                    conn.close()
                except Exception:
                    pass


def get_cs_adr_tickers_from_db():
    """
    Production filing-intelligence universe.

    Includes:
      - CS: common stocks
      - every ADR-family security type (ADR, ADRC, ADRP, etc.)

    Tickers come directly from Bullionaire's stocks table and are ordered by
    Market Cap DESC so the most important / most-viewed companies are enriched
    first. Ticker is the deterministic tie-breaker.
    """
    attempt = 0

    while True:
        conn = None

        try:
            conn = get_db_connection_dict()
            cursor = conn.cursor()

            cursor.execute(
                """
                WITH ranked_universe AS (
                    SELECT
                        UPPER(TRIM("Ticker")) AS ticker,
                        UPPER(TRIM("Type")) AS security_type,
                        CAST("Market Cap" AS DOUBLE PRECISION) AS market_cap,
                        ROW_NUMBER() OVER (
                            PARTITION BY UPPER(TRIM("Ticker"))
                            ORDER BY
                                CAST("Market Cap" AS DOUBLE PRECISION) DESC NULLS LAST,
                                UPPER(TRIM("Type")) ASC
                        ) AS row_number
                    FROM stocks
                    WHERE "Ticker" IS NOT NULL
                      AND TRIM("Ticker") <> ''
                      AND (
                            UPPER(TRIM(COALESCE("Type", ''))) = 'CS'
                            OR UPPER(TRIM(COALESCE("Type", ''))) LIKE 'ADR%'
                          )
                )
                SELECT ticker, security_type, market_cap
                FROM ranked_universe
                WHERE row_number = 1
                ORDER BY market_cap DESC NULLS LAST, ticker ASC
                """
            )

            rows = cursor.fetchall()

            tickers = []
            type_counts = {}

            for row in rows:
                ticker = str(row.get("ticker") or "").strip().upper()
                security_type = str(row.get("security_type") or "").strip().upper()

                if not ticker:
                    continue

                tickers.append(ticker)
                type_counts[security_type] = type_counts.get(security_type, 0) + 1

            print("=" * 96)
            print("DATABASE FILING-INTELLIGENCE UNIVERSE")
            print(
                f"Loaded {len(tickers)} unique CS/ADR-family tickers from stocks "
                f"in Market Cap DESC order."
            )
            for security_type in sorted(type_counts):
                print(f"  {security_type}: {type_counts[security_type]}")

            print("Top of processing queue:")
            for row in rows[:15]:
                ticker = str(row.get("ticker") or "").strip().upper()
                market_cap = row.get("market_cap")
                if market_cap is None:
                    print(f"  {ticker:<8} Market Cap: n/a")
                else:
                    try:
                        market_cap = float(market_cap)
                        if market_cap >= 1_000_000_000_000:
                            label = f"${market_cap / 1_000_000_000_000:.2f}T"
                        elif market_cap >= 1_000_000_000:
                            label = f"${market_cap / 1_000_000_000:.2f}B"
                        elif market_cap >= 1_000_000:
                            label = f"${market_cap / 1_000_000:.2f}M"
                        else:
                            label = f"${market_cap:,.0f}"
                        print(f"  {ticker:<8} Market Cap: {label}")
                    except Exception:
                        print(f"  {ticker:<8} Market Cap: {market_cap}")

            print("=" * 96)
            return tickers

        except Exception as exc:
            if not _is_db_connection_error(exc):
                raise

            attempt += 1
            delay = _db_retry_delay(attempt)
            print(
                f"[DB] Could not load filing-intelligence universe: "
                f"{type(exc).__name__}: {exc}"
            )
            print(f"[DB] Retrying database connection in {delay}s (attempt {attempt})...")
            time.sleep(delay)

        finally:
            if conn:
                try:
                    conn.close()
                except Exception:
                    pass


def main():
    use_database_universe = (
        os.getenv("FILING_INTELLIGENCE_DB_CS_ADR", "0").strip().lower()
        in {"1", "true", "yes"}
    )

    if use_database_universe:
        tickers = get_cs_adr_tickers_from_db()
    else:
        tickers_env = os.getenv("TICKERS", "MSFT")
        tickers = [
            ticker.strip().upper()
            for ticker in tickers_env.split(",")
            if ticker.strip()
        ]

    if not tickers:
        raise RuntimeError("No tickers were selected for filing intelligence.")

    dry_run = os.getenv("FILING_INTELLIGENCE_DRY_RUN", "0").strip().lower() in {
        "1", "true", "yes"
    }

    run_results = []

    for ticker in tickers:
        try:
            print("=" * 80)
            print(f"Starting {ticker}")
            payload = build_payload(ticker)

            if not payload:
                raise ValueError(f"build_payload returned None for {ticker}")

            print("Reportable Segments:")
            print(json.dumps(payload.get("reportable_segments"), indent=2))

            print("End Markets:")
            print(json.dumps(payload.get("end_markets"), indent=2))

            print("Geography:")
            print(json.dumps(payload.get("geography"), indent=2))

            print("Revenue Visibility:")
            print(json.dumps(payload.get("revenue_visibility"), indent=2))
            print("Customer Concentration:")
            print(json.dumps(payload.get("customer_concentration"), indent=2))
            print("Parser Status:")
            print(json.dumps(payload.get("parser_status"), indent=2))

            if not dry_run:
                save_payload(payload)
            else:
                print(f"[DRY RUN] Not saving {ticker} to filing_intelligence.")

            status = (payload.get("parser_status") or {}).get("quality") or "WARN"
            run_results.append({
                "ticker": ticker,
                "status": status,
                "segments": len(payload.get("reportable_segments") or []),
                "end_markets": len(payload.get("end_markets") or []),
                "geography": len(payload.get("geography") or []),
                "customers": len((payload.get("customer_concentration") or {}).get("customers") or []),
                "warnings": (payload.get("parser_status") or {}).get("warnings") or [],
                "failures": (payload.get("parser_status") or {}).get("failures") or [],
            })

            print(json.dumps(payload, indent=2)[:5000])
            time.sleep(0.2)

        except Exception as e:
            print(f"Failed {ticker}: {type(e).__name__}: {e}")
            run_results.append({
                "ticker": ticker,
                "status": "FAIL",
                "segments": 0,
                "end_markets": 0,
                "geography": 0,
                "customers": 0,
                "warnings": [],
                "failures": [f"{type(e).__name__}: {e}"],
            })

    print("\n" + "=" * 96)
    print("FILING INTELLIGENCE REGRESSION SUMMARY")
    counts = {
        status: sum(1 for row in run_results if row["status"] == status)
        for status in ("PASS", "WARN", "FAIL")
    }
    for row in run_results:
        print(
            f"[{row['status']:<4}] {row['ticker']:<5} "
            f"segments={row['segments']:<2} products={row['end_markets']:<2} "
            f"geo={row['geography']:<2} customers={row['customers']:<2}"
        )
        for failure in row["failures"]:
            print(f"       FAIL: {failure}")
        for warning in row["warnings"]:
            print(f"       WARN: {warning}")

    print(
        f"SUMMARY: PASS={counts['PASS']} WARN={counts['WARN']} FAIL={counts['FAIL']} "
        f"| MODE={'DRY RUN' if dry_run else 'SAVE'}"
    )
    print("=" * 96)

    with open("filing_intelligence_regression_results.json", "w", encoding="utf-8") as f:
        json.dump(
            {
                "generated_at": datetime.now().isoformat(),
                "dry_run": dry_run,
                "counts": counts,
                "results": run_results,
            },
            f,
            indent=2,
        )


if __name__ == "__main__":
    _keep_awake_registered = prevent_windows_idle_sleep()
    try:
        main()
    finally:
        if _keep_awake_registered:
            restore_windows_sleep_policy()