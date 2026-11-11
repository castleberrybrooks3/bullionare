"""Bullionaire SEC Form 4 merged importer Rev11 (2026-10-24).

Combines the original importer's simple non-derivative P/S discovery with
Rev10's issuer and share-class safeguards, SEC history, SEC lot reconciliation,
receipts, checkpoints and retry records. One-time historical reconciliation
ALWAYS rechecks processed receipts against SEC XML. Ordinary daily incremental
runs trust only the validated receipts and use a seven-day overlap.

Install as insider_transactions_incremental.py (same existing database schema).
Do not run simultaneously with any legacy Form 4 import job.

IMPORTANT: Target >=95% source-verified precision/coverage; never claim it
without independent measured SEC-vs-DB audit. Known source amendments (4/A),
ambiguous classes, CIK history changes and internally contradictory trades are
quarantined, not invented. Set INSIDER_VERIFY_EXISTING=1 during the one-time
full historical audit to examine receipts created by earlier importers. After
that, set it to 0 for daily 7-day incremental updates.
"""

import os
import html
import re
import time
import threading
from collections import deque
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal, InvalidOperation
from xml.etree import ElementTree as ET

import requests
from db import get_db_connection_dict

SEC_DATA = "https://data.sec.gov"
SEC_WWW = "https://www.sec.gov"
USER_AGENT = "BullionaireIQ info@bullionaireiq.com"
HEADERS = {"User-Agent": USER_AGENT, "Accept-Encoding": "gzip, deflate"}
SEC_RATE = 6  # Process-wide; leave room for other Bullionaire SEC requests.
SEC_RETRIES = 4
SEC_LOCK = threading.Lock()
SEC_TIMES = deque()
THREAD_LOCAL = threading.local()
REQUEST_COUNT = 0


# SECURITY POLICY: No fallback from an ambiguous or missing security title.
# Whitelisted issuer classes require an exact named class or a verified plain
# security-title distinction. A mapping only permits a scan; it never permits
# a non-common, derivative, preferred, debt or warrant transaction.
# SEC issuer CIKs are stable identities; do not choose a ticker by row order.
# Common stock mappings below use issuer class labels; ambiguous/no-class
# strings fail closed and remain available for audit.
SHARE_CLASS_TICKERS = {
    # SEC filing confirmed Class B is PSKY; Class A is privately held.
    "2041610": {"B": "PSKY"},
    # Clearwater Analytics public Class A, private B.
    "1866368": {"A": "CWAN"},
    # Listed Class A shares verified in issuer annual/quarterly SEC filings.
    # Each company's other, private/unlisted classes remain BLOCKED.
    "1561550": {"A": "DDOG"},   # Datadog
    "1477333": {"A": "NET"},    # Cloudflare
    "1559720": {"A": "ABNB"},   # Airbnb
    "1751008": {"A": "APP"},    # AppLovin
    "1048286": {"A": "MAR"},    # Marriott International
    "1156375": {"A": "CME"},    # CME Group
    "1783879": {"A": "HOOD"},   # Robinhood
    "1467373": {"A": "ACN"},    # Accenture
    # SEC/issuer-confirmed publicly listed share classes. Unlisted classes
    # remain excluded by the existing strict class router.
    "1571996": {"C": "DELL"},    # Dell: listed Class C; A/B private
    "1321655": {"A": "PLTR"},    # Palantir: listed A; B/F private
    "1403161": {"A": "V"},       # Visa: listed A
    "1141391": {"A": "MA"},      # Mastercard: listed A; B unlisted
    "1535527": {"A": "CRWD"},    # CrowdStrike: listed A
    "1181412": {"A": "SPCX"},    # SpaceX: listed A; B private
    # Global Business Travel Group public Class A.
    "1820872": {"A": "GBTG"},
    # Clearway Energy shares have separately listed Class A and Class C.
    "1567683": {"A": "CWEN.A", "C": "CWEN"},
    # Liberty Broadband pre-Aug-2026 merger classes.
    "1611983": {"A": "LBRDA", "C": "LBRDK"},
    # Meta 2025 Form 10-K: publicly listed Class A is META; Class B is private.
    "1326801": {"A": "META"},
    # Everpure/Pure Storage public Class A: PSTG through Apr 16, P from Apr 17.
    # Explicit class A is needed; generic named-class validation otherwise
    # rejects all valid P/PSTG insider transactions.
    "1474432": {"A": "P"},
    "105016": {"B": "WSO.B"},  # Watsco also has unlettered WSO common
    "798941": {"A": "FCNCA", "B": "FCNCB"},  # FCNCB is OTC Class B
    "1652044": {"A": "GOOGL", "C": "GOOG"},
    "1067983": {"A": "BRK.A", "B": "BRK.B"},
    "1336917": {"A": "UAA", "C": "UA"},
    "1564708": {"A": "NWSA", "B": "NWS"},
    "1754301": {"A": "FOXA", "B": "FOX"},
    "1560385": {"A": "FWONA", "B": "FWONB", "C": "FWONK"},
    "920760": {"A": "LEN", "B": "LEN.B"},
    "14693": {"A": "BF.A", "B": "BF.B"},
    "67887": {"A": "MOG.A", "B": "MOG.B"},
    "12208": {"A": "BIO", "B": "BIO.B"},
    "2078416": {"A": "LLYVA", "B": "LLYVB", "C": "LLYVK"},
    "24545": {"A": "TAP.A", "B": "TAP"},
    "1617640": {"A": "ZG", "C": "Z"},
    "1012019": {"A": "RUSHA", "B": "RUSHB"},
    "43920": {"A": "GEF", "B": "GEF.B"},
    "1570585": {"A": "LBTYA", "B": "LBTYB", "C": "LBTYK"},
    "1958140": {"A": "BATRA", "B": "BATRB", "C": "BATRK"},
    "729580": {"A": "BELFA", "B": "BELFB"},
    "107140": {"A": "WLY", "B": "WLYB"},
    "1712184": {"A": "LILA", "B": "LILAB", "C": "LILAK"},
    "1726173": {"A": "BH.A", "B": "BH"},
    "88948": {"A": "SENEA", "B": "SENEB"},
    "2057463": {"A": "GLIBA", "B": "GLIBB", "C": "GLIBK"},
    "55135": {"A": "KELYA", "B": "KELYB"},
    "800457": {"A": "DGICA", "B": "DGICB"},
    "25475": {"A": "CRD.A", "B": "CRD.B"},
    "1687187": {"A": "METC", "B": "METCB"},
    "716634": {"A": "RDI", "B": "RDIB"},
    "1041657": {"A": "UONE", "D": "UONEK"},
    "8063": {"A": "ATRO", "B": "ATROB"},
    "887733": {"A": "CENTA"},  # CENT common non-voting is special title
    "46619": {"A": "HEI.A"},
    "4457": {},   # unlettered common vs Series N non-voting
    "63754": {},  # MKC.V voting and MKC non-voting
    "43196": {"A": "GTN.A"},
    "216085": {"A": "HVT.A"},
    "1437107": {},  # WBD Series A common is a distinct named series
    # Verified 2026 issuer/security structures. Never route private/unlisted
    # classes into the public common ticker just because the CIK matches.
    "845877": {"A": "AGM.A", "C": "AGM"},
    "2042460": {"A": "HAVA"},       # HAVAR is a right; HAVAU a unit
    "2088325": {"A": "OIM"},        # OIMAU is a unit; OIMAW a warrant
    "1991261": {"A": "RNTZ"},       # former ticker SKK
    "1998560": {"A": "AXNX"},       # former ticker MIMI
}

# Some classes are not described with the literal word 'Class'. Route them
# ONLY when the exact Form 4 text distinguishes the instrument.
NONCLASS_COMMON_ROUTING = {
    "105016": {"plain": "WSO"},
    "46619": {"plain": "HEI"},
    "4457": {"plain": "UHAL", "series_n": "UHAL.B"},
    "63754": {"plain": "MKC.V", "non_voting": "MKC"},
    "887733": {"plain": "CENT"},
    "43196": {"plain": "GTN"},
    "216085": {"plain": "HVT"},
    "1437107": {"series_a": "WBD"},
}

# Explicit issuer-CIK -> primary PUBLIC common ticker. The SEC directory
# lists debt, preferred, warrants, ETF notes and OTC siblings; none proves an
# additional public common class. Unless another verified share class exists,
# strict Form 4 security-title validation remains mandatory for every row.
COMMON_ONLY_MULTI_SECURITY_ISSUERS = {
    "34088": "XOM", "2115436": "XOM", "19617": "JPM",
    "1341439": "ORCL", "70858": "BAC", "895421": "MS",
    "1000275": "RY", "886982": "GS", "72971": "WFC",
    "1326380": "GME",
}

# Some multi-security issuers contain genuine share classes where the Form 4
# title is insufficiently differentiated. Route only recognized class names.
# These companies are NOT assigned arbitrary default symbols.

# Keep explicit class alias lists for DB receipts and one-issuer deduplication.
# The issuer's SEC symbols may use a hyphen while the database uses a dot.
SHARE_CLASS_ALIASES = {}
for _issuer, _classes in SHARE_CLASS_TICKERS.items():
    _aliases = set(_classes.values())
    _aliases.update(NONCLASS_COMMON_ROUTING.get(_issuer, {}).values())
    if len(_aliases) > 1:
        SHARE_CLASS_ALIASES[_issuer] = tuple(sorted(_aliases))

# Verified SAME-security ticker changes; map by the ACTUAL transaction date.
# These pairs are NOT different classes of common stock. Group their SEC scans
# and receipts by CIK to avoid duplicate downloads/inserts. Dates are the
# effective first trading day under the NEW ticker (NASDAQ/issuer notices).
VERIFIED_TICKER_RENAMES = {
    '1856437': (date(2026, 6, 2), 'VSCO', 'VSXY'), # Same Victoria's Secret common shares, unchanged CUSIP.
    '102109': (date(2026, 10, 19), 'UUU', 'DCM'),
    '1390777': (date(2026, 5, 21), 'BK', 'BNY'),
    '1409970': (date(2026, 6, 22), 'LC', 'HAPN'),
    '1800227': (date(2026, 6, 4), 'IAC', 'PPLI'),
    '836690': (date(2026, 8, 18), 'ISSC', 'IA'),
    # Source-backed same-security historical ticker changes, trading effective dates.
    '1636639': (date(2026, 5, 12), 'FIHL', 'PLGO'),
    '866829': (date(2026, 9, 2), 'HLX', 'HOS'),
    '1495932': (date(2026, 5, 8), 'EXPI', 'AGNT'),
    '890564': (date(2026, 4, 24), 'ASGN', 'EFOR'),
    '1643615': (date(2026, 5, 4), 'MEG', 'ONT'),
    '895447': (date(2026, 6, 12), 'SCVL', 'SHOE'),
    '1047340': (date(2026, 6, 29), 'FDP', 'DMC'),
    '1799191': (date(2026, 8, 3), 'TOI', 'STLN'),
    '1130713': (date(2026, 8, 17), 'BBBY', 'NXH'),
    # Everpure, Inc.: same Class A stock, unchanged CUSIP. Effective Apr 17.
    '1474432': (date(2026, 4, 17), 'PSTG', 'P'),
    # Equity Residential/Vivmark: same common beneficial shares, now VMRK.
    # Merger closing and first VMRK trading day Aug 18; SEC issuer 906107.
    '906107': (date(2026, 8, 18), 'EQR', 'VMRK'),
    '1662774': (date(2026, 10, 12), 'QNCX', 'IRLA'),
    '1879403': (date(2026, 10, 19), 'LRHC', 'SRTM'),
    '1991261': (date(2026, 10, 13), 'SKK', 'RNTZ'),
    '1998560': (date(2026, 10, 13), 'MIMI', 'AXNX'),
}
for _issuer, (_effective, _old, _new) in VERIFIED_TICKER_RENAMES.items():
    SHARE_CLASS_ALIASES[_issuer] = tuple(sorted({_old, _new}))

# Manually confirmed SEC CIKs for formerly/currently listed shares no longer
# returned under these tickers by the current-only SEC company_tickers.json.
# There is NO name-based fuzzy automatic mapping (dangerous for mergers).
SEC_CIK_VERIFIED_HISTORY = {
    # CIKs verified against 2025-2026 SEC registrant filings, not fuzzy names.
    'FDXF': '2082247',    # FedEx Freight; FDXFW when-issued handled separately
    'PSKY': '2041610',    # Paramount Skydance public Class B
    'QRVO': '1604778',
    'MASI': '937556',
    'CRNX': '1658247',
    'JHG': '1274173',
    'CWAN': '1866368',
    'TMHC': '1562476',
    'TERN': '1831363',
    'APLS': '1492422',
    'LBRDA': '1611983',
    'LBRDK': '1611983',
    'GBTG': '1820872',
    'CWEN.A': '1567683',
    'CWEN': '1567683',
    'FOLD': '1178879',
    'VSCO': '1856437',
    'VSXY': '1856437',
    'TPH': '1561680',
    'CPRX': '1369568',
    'NSA': '1618563',
    'DBRG': '1679688',
    'MCW': '1853513',
    'LC': '1409970',
    'ACLX': '1786205',
    'SLNO': '1484565',
    'BK': '1390777',      # now BNY
    'EA': '712515',       # acquired and delisted Aug 2026
    'WBD': '1437107',     # delisted Oct 2026
    'CTRA': '858470',
    'AVB': '915912',
    'EQR': '906107',
    'PSTG': '1474432',    # company now Everpure, Inc.
    'P': '1474432',       # Everpure formerly PSTG, effective Apr 17 2026
    'VMRK': '906107',     # Vivmark, formerly EQR, effective Aug 18 2026
    'WBS': '801337',
    'BLD': '1633931',
    'APGE': '1974640',
    'GTLS': '892553',
    'NUVL': '1861560',
}


# SEC verified registrants: 2026 issuer 8-K/10-Q, corporate action notices,
# or SEC issuer primary submissions. Unlike name-only discovery candidates,
# these are permitted to map historical stock symbols (with verified dates).
SEC_CIK_VERIFIED_HISTORY['FIHL'] = '1636639'
SEC_CIK_VERIFIED_HISTORY['HLX'] = '866829'
SEC_CIK_VERIFIED_HISTORY['SKYT'] = '1819974'
SEC_CIK_VERIFIED_HISTORY['EXPI'] = '1495932'
SEC_CIK_VERIFIED_HISTORY['ASGN'] = '890564'
SEC_CIK_VERIFIED_HISTORY['MEG'] = '1643615'
SEC_CIK_VERIFIED_HISTORY['SCVL'] = '895447'
SEC_CIK_VERIFIED_HISTORY['FDP'] = '1047340'
SEC_CIK_VERIFIED_HISTORY['TOI'] = '1799191'
SEC_CIK_VERIFIED_HISTORY['IAC'] = '1800227'
SEC_CIK_VERIFIED_HISTORY['FBRX'] = '1419041'
SEC_CIK_VERIFIED_HISTORY['NFBK'] = '1493225'
SEC_CIK_VERIFIED_HISTORY['BBBY'] = '1130713'
SEC_CIK_VERIFIED_HISTORY['CSGS'] = '1005757'
SEC_CIK_VERIFIED_HISTORY['DHIL'] = '909108'
SEC_CIK_VERIFIED_HISTORY['ISSC'] = '836690'
SEC_CIK_VERIFIED_HISTORY['PLGO'] = '1636639'
SEC_CIK_VERIFIED_HISTORY['HOS'] = '866829'
SEC_CIK_VERIFIED_HISTORY['AGNT'] = '1495932'
SEC_CIK_VERIFIED_HISTORY['EFOR'] = '890564'
SEC_CIK_VERIFIED_HISTORY['ONT'] = '1643615'
SEC_CIK_VERIFIED_HISTORY['SHOE'] = '895447'
SEC_CIK_VERIFIED_HISTORY['DMC'] = '1047340'
SEC_CIK_VERIFIED_HISTORY['STLN'] = '1799191'
SEC_CIK_VERIFIED_HISTORY['NXH'] = '1130713'

# Name-only discoveries from the SEC historical filer-name index. NOT verified.
# Each is checked against the current SEC submissions identity, and rejected
# on ambiguity/collisions, BEFORE its CIK is used for an issuer scan.
# The twelve multi-CIK and nineteen no-match entries are deliberately excluded.
SEC_CIK_NAME_CANDIDATES = {
    'ORLA': ('1680056', 'Orla Mining Ltd.'),
    'ATAI': ('2081043', 'AtaiBeckley Inc. Common Stock'),
    'DAWN': ('1845337', 'Day One Biopharmaceuticals, Inc. Common Stock'),
    'SEM': ('1320414', 'SELECT MEDICAL HOLDINGS CORP'),
    'THR': ('1489096', 'THERMON GROUP HOLDINGS, INC.'),
    'STEL': ('1473844', 'Stellar Bancorp, Inc.'),
    'BLFS': ('834365', 'BioLife Solutions Inc.'),
    'SEMR': ('1831840', 'SEMrush Holdings, Inc.'),
    'FIHL': ('1636639', 'Fidelis Insurance Holdings Limited'),
    'VRE': ('924901', 'Veris Residential, Inc.'),
    'SILA': ('1567925', 'Sila Realty Trust, Inc.'),
    'KW': ('1408100', 'KENNEDY-WILSON HOLDINGS, INC.'),
    'HLX': ('866829', 'Helix Energy Solutions Group, Inc.'),
    'SKYT': ('1819974', 'SkyWater Technology, Inc. Common Stock'),
    'KALV': ('1348911', 'KalVista Pharmaceuticals, Inc. Common Stock'),
    'OLPX': ('1868726', 'Olaplex Holdings, Inc. Common Stock'),
    'LEG': ('58492', 'Leggett & Platt, Inc.'),
    'PRA': ('1127703', 'ProAssurance Corporation'),
    'TWO': ('1465740', 'Two Harbors Investment Corp.'),
    'AVNS': ('1606498', 'Avanos Medical, Inc.'),
    'EXPI': ('1495932', 'eXp World Holdings, Inc. Common Stock'),
    'EEX': ('1579214', 'Emerald Holding, Inc.'),
    'WSR': ('1175535', 'Whitestone REIT'),
    'SNCY': ('1743907', 'Sun Country Airlines Holdings, Inc. Common Stock'),
    'TBPH': ('1583107', 'Theravance Biopharma, Inc.'),
    'TALK': ('1803901', 'Talkspace, Inc. Common Stock'),
    'HTBK': ('1053352', 'Heritage Commerce Corp'),
    'CTLP': ('896429', 'Cantaloupe, Inc. Common Stock'),
    'ESPR': ('1434868', 'Esperion Therapeutics, Inc.'),
    'ASGN': ('890564', 'ASGN Incorporated'),
    'XOMA': ('791908', 'XOMA Royalty Corporation Common Stock'),
    'PKST': ('1600626', 'Peakstone Realty Trust'),
    'STKL': ('351834', 'SunOpta, Inc.'),
    'MEG': ('1643615', 'Montrose Environmental Group, Inc.'),
    'GDEN': ('1071255', 'Golden Entertainment, Inc. Common Stock'),
    'EHAB': ('1803737', 'Enhabit, Inc.'),
    'AMWD': ('794619', 'American Woodmark Corp'),
    'ODV': ('1431852', 'Osisko Development Corp.'),
    'UDMY': ('1607939', 'Udemy, Inc. Common Stock'),
    'FFIC': ('923139', 'Flushing Financial Corp'),
    'CAEP': ('2034268', 'Cantor Equity Partners III, Inc. Class A Ordinary Shares'),
    'XWIN': ('1473334', 'XMAX, Inc. Common Stock'),
    'ANSC': ('1854149', 'Agriculture & Natural Solutions Acquisition Corporation Class A Ordinary Shares'),
    'SCVL': ('895447', 'Shoe Carnival Inc'),
    'CVGW': ('1133470', 'Calavo Growers Inc'),
    'CCRN': ('1141103', 'Cross Country Healthcare Inc'),
    'CGCT': ('2049662', 'Cartesian Growth Corporation III Class A Ordinary Shares'),
    'WILC': ('1030997', 'G Willi-Food International Ltd'),
    'TBRG': ('1169445', 'TruBridge, Inc. Common Stock'),
    'MBAV': ('2016072', 'M3-Brigade Acquisition V Corp. Class A Ordinary shares'),
    'BBCQ': ('2088295', 'Bleichroeder Acquisition Corp. II Class A Ordinary Shares'),
    'SLP': ('1023459', 'Simulations Plus, Inc.'),
    'LPRO': ('1806201', 'Open Lending Corporation Common Stock'),
    'SSSS': ('1509470', 'SuRo Capital Corp. Common Stock'),
    'CEPT': ('2034269', 'Cantor Equity Partners II, Inc. Class A Ordinary Share'),
    'LNKB': ('1756701', 'LINKBANCORP, Inc. Common Stock'),
    'LOKV': ('2048951', 'Live Oak Acquisition Corp. V Class A Ordinary Shares'),
    'WLAC': ('2032379', 'Willow Lane Acquisition Corp. Class A Ordinary Shares'),
    'CMII': ('2088805', 'Columbus Circle Capital Corp II Class A Ordinary Shares'),
    'KFS': ('1072627', 'Kingsway Financial Services, Inc.'),
    'RMAX': ('1581091', 'RE/MAX HOLDINGS, INC.'),
    'AACB': ('2034334', 'Artius II Acquisition Inc. Class A Ordinary Shares'),
    'SBXD': ('2015947', 'SilverBox Corp IV'),
    'JAB': ('2128739', 'JAB Acquisition Corp I Class A Ordinary Shares'),
    'MPX': ('1129155', 'Marine Products Corp.'),
    'SVAC': ('2074850', 'Spring Valley Acquisition Corp. III Class A Ordinary Shares'),
    'APAD': ('1956439', 'A Paradise Acquisition Corp. Class A Ordinary Shares'),
    'BRR': ('2076163', 'ProCap Financial, Inc. Common Stock'),
    'NHIC': ('2043699', 'NewHold Investment Corp III Class A Ordinary shares'),
    'EWCZ': ('1856236', 'European Wax Center, Inc. Class A Common Stock'),
    'RAAQ': ('2052161', 'Real Asset Acquisition Corp. Class A Ordinary Share'),
    'ETHM': ('2028699', 'Dynamix Corporation Class A Ordinary Shares'),
    'HVII': ('1846416', 'Hennessy Capital Investment Corp. VII Ordinary Shares'),
    'ALOT': ('8146', 'AstroNova, Inc. Common Stock'),
    'LEGT': ('2002038', 'Legato Merger Corp. III'),
    'VACI': ('2080023', 'Viking Acquisition Corp. I'),
    'IPOD': ('2041047', 'Dune Acquisition Corporation II Class A Ordinary Shares'),
    'MLAC': ('2029492', 'Mountain Lake Acquisition Corp. Class A Ordinary Shares'),
    'BCAR': ('2065779', 'D. Boral ARC Acquisition I Corp. Class A Ordinary Shares'),
    'MDV': ('1645873', 'Modiv Industrial, Inc.'),
    'DOMO': ('1505952', 'Domo, Inc. Class B Common Stock'),
    'KORE': ('1855457', 'KORE Group Holdings, Inc.'),
    'GIG': ('2023730', 'GigCapital7 Corp. Class A Ordinary Share'),
    'GRAF': ('1897463', 'Graf Global Corp.'),
    'ASRT': ('1808665', 'Assertio Holdings, Inc. Common Stock'),
    'NCSM': ('1692427', 'NCS Multistage Holdings, Inc.'),
    'IPCX': ('2012318', 'Inflection Point Acquisition Corp. III Class A Ordinary Shares'),
    'LIXT': ('1335105', 'Lixte Biotechnology Holdings, Inc. Common Stock'),
    'WALD': ('1840199', 'Waldencast plc Class A Ordinary Share'),
    'PCSC': ('2017526', 'Perceptive Capital Solutions Corp Class A Ordinary Shares'),
    'FONR': ('355019', 'Fonar Corporation'),
    'ALTS': ('862861', 'ALT5 Sigma Corporation Common Stock'),
    'YOOV': ('2001794', 'Concorde International Group Ltd Class A Ordinary Shares'),
    'MRCC': ('1512931', 'Monroe Capital Corporation'),
    'COEP': ('1759186', 'Coeptis Therapeutics Holdings Inc. Common Stock'),
    'SPKL': ('1884046', 'Spark I Acquisition Corp. Class A Ordinary Share'),
    'JFB': ('2024306', 'JFB Construction Holdings Class A Common Stock'),
    'FGMC': ('1906364', 'FG Merger II Corp. Common stock'),
    'AGH': ('2009312', 'Aureus Greenway Holdings Inc. Common Stock'),
    'ZBAI': ('1755058', 'ATIF Holdings Limited Ordinary Shares'),
    'SGMO': ('1001233', 'Sangamo Therapeutics, Inc. Common Stock'),
    'FSEA': ('1943802', 'First Seacoast Bancorp, Inc. Common Stock'),
    'STSS': ('1737995', 'Sharps Technology Inc. Common Stock'),
    'SKBL': ('2031009', 'Skyline Builders Group Holding Limited Class A Ordinary Shares'),
    'NSTS': ('1881592', 'NSTS Bancorp, Inc. Common Stock'),
    'KVAC': ('1889983', 'Keen Vision Acquisition Corporation Ordinary Shares'),
    'UHG': ('1830188', 'United Homes Group, Inc Class A Common Stock'),
    'FORA': ('1829280', 'Forian Inc. Common Stock'),
    'SUUN': ('2011053', 'PowerBank Corporation Common Stock'),
    'ZTEK': ('1904501', 'Zentek Ltd. Common Stock'),
    'OTH': ('2067767', 'Off The Hook YS Inc.'),
    'GAMB': ('1839799', 'Gambling.com Group Limited Ordinary Shares'),
    'KZR': ('1645666', 'Kezar Life Sciences, Inc. Common Stock'),
    'ALCY': ('1901336', 'Alchemy Investments Acquisition Corp 1 Class A Ordinary Shares'),
    'COLA': ('1381526', 'Columbus Acquisition Corp Ordinary Shares'),
    'ESHA': ('1918661', 'ESH Acquisition Corp. Class A Common Stock'),
    'ATLN': ('1605888', 'Atlantic International Corp. Common Stock'),
    'VBIX': ('797542', 'Viewbix Inc. Common Stock'),
    'EKSO': ('1549084', 'Ekso Bionics Holdings, Inc. Common Stock'),
    'FGNX': ('1591890', 'FG Nexus Inc. Common Stock'),
    'LPSN': ('1102993', 'LivePerson Inc'),
    'IPEX': ('2028355', 'Inflection Point Acquisition Corp. V Class A Ordinary Shares'),
    'AIXC': ('1460702', 'AIxCrypto Holdings, Inc. Common Stock'),
    'HSPT': ('2032950', 'Horizon Space Acquisition II Corp. Ordinary share'),
    'BTM': ('1901799', 'Bitcoin Depot Inc. Class A Common Stock'),
    'ABVE': ('1979484', 'Above Food Ingredients Inc. Common Stock'),
    'EVTV': ('1563568', 'Azio AI Holdings, Inc. Common Stock'),
    'ANY': ('1591956', 'Sphere 3D Corp. Common Shares'),
    'FARM': ('1305458', 'Farmer Bros Co'),
    'ELSE': ('351789', 'Electro-Sensors Inc'),
    'HOTH': ('1711786', 'Hoth Therapeutics, Inc. Common Stock'),
    'VYNE': ('1566044', 'VYNE Therapeutics Inc. Common Stock'),
    'PSTV': ('1095981', 'PLUS THERAPEUTICS, Inc. Common Stock'),
    'MIGI': ('1218683', 'Big Digital Energy, Inc. Common Stock'),
    'AGAE': ('1708341', 'Allied Gaming & Entertainment Inc. Common Stock'),
    'HKIT': ('1742341', 'Hitek Global Inc. Class A Ordinary Share'),
    'AIHS': ('1711012', 'Senmiao Technology Limited Common Stock'),
    'LGCB': ('1969401', 'Linkage Global Inc Class A Ordinary Shares'),
    'MAXN': ('1796898', 'Maxeon Solar Technologies, Ltd. Ordinary Shares'),
    'SNSE': ('1829802', 'Sensei Biotherapeutics, Inc. Common Stock'),
    'ZGM': ('2011458', 'Zenta Group Company Limited Class A Ordinary Shares'),
    'MSW': ('1956166', 'Ming Shing Group Holdings Limited Ordinary Shares'),
    'IINN': ('1837493', 'Inspira Technologies Oxy B.H.N. Ltd. Ordinary Shares'),
    'HWH': ('1897245', 'HWH International Inc. Common Stock'),
    'RAY': ('1948443', 'Raytech Holding Limited Ordinary Shares'),
    'TBH': ('1903595', 'Brag House Holdings, Inc. Common Stock'),
    'SELX': ('1990950', 'Semilux International Ltd. Ordinary Shares'),
    'NVNI': ('1965143', 'Nvni Group Limited Ordinary Shares'),
    'HCWC': ('1948864', 'Healthy Choice Wellness Corp.'),
    'LSH': ('1996192', 'Lakeside Holding Limited Common Stock'),
    'UBXG': ('1888525', 'U-BX Technology Ltd. Class A Ordinary Shares'),
    'RVYL': ('1419275', 'Ryvyl Inc. Common Stock'),
    'GWH': ('1819438', 'ESS Tech, Inc.'),
    'DEVS': ('1854480', 'DevvStream Corp. Common Stock'),
    'ATON': ('1095435', 'AlphaTON Capital Corp. Common Stock'),
    'MVO': ('1371782', 'MV Oil Trust'),
    'BGI': ('1179821', 'Birks Group Inc'),
    'REE': ('1843588', 'REE Automotive Ltd. Class A Ordinary Shares'),
    'WGRX': ('2030763', 'Wellgistics Health, Inc. Common Stock'),
    'FTRK': ('2027262', 'FAST TRACK GROUP Ordinary shares'),
    'ORGN': ('1802457', 'Origin Materials, Inc. Common Stock'),
    'APM': ('1734005', 'Aptorum Group Limited Class A Ordinary Shares'),
    'GOCO': ('1808220', 'GoHealth, Inc. Class A Common Stock'),
    'PHGE': ('1739174', 'BiomX Inc.'),
    'RITR': ('1951229', 'Reitar Logtech Holdings Limited Ordinary shares'),
    'UGRO': ('1706524', 'urban-gro, Inc. Common Stock'),
    'SNBR': ('827187', 'Sleep Number Corporation Common Stock'),
    'WAI': ('1938865', 'Top KingWin Ltd Class A Ordinary Shares'),
    'SBLX': ('1086745', 'StableX Technologies, Inc. Common Stock'),
    'YYGH': ('1985337', 'YY Group Holding Limited Class A Ordinary Shares'),
    'GLMD': ('1595353', 'Galmed Pharmaceuticals Ltd.'),
    'KWM': ('2000756', 'K Wave Media, Ltd. Ordinary Shares'),
    'ALBT': ('1630212', 'Avalon GloboCare Corp. Common Stock'),
    'TIVC': ('1787740', 'Tivic Health Systems, Inc. Common Stock'),
    'NOTV': ('720154', 'Inotiv, Inc. Common Stock'),
    'BTAI': ('1720893', 'BioXcel Therapeutics, Inc. Common Stock'),
    'LESL': ('1821806', "Leslie's, Inc. Common Stock"),
    'ORIS': ('1964664', 'Oriental Rise Holdings Limited Ordinary Shares'),
    'LMFA': ('1640384', 'LM Funding America, Inc. Common Stock'),
    'CYCN': ('1755237', 'Cyclerion Therapeutics, Inc. Common Stock'),
    'SOPA': ('1817511', 'Society Pass Incorporated Common Stock'),
    'BTOG': ('1735556', 'Bit Origin Limited Class A Ordinary Shares'),
    'SNYR': ('1562733', 'Synergy CHC Corp. Common Stock'),
    'GV': ('1892274', 'Visionary Holdings Inc. Common Shares'),
    'WTO': ('1789299', 'UTime Limited Class A Ordinary Shares'),
    'BNRG': ('1901215', 'Brenmiller Energy Ltd Ordinary Shares'),
    'VTAK': ('1716621', 'Catheter Precision, Inc.'),
    'PTNM': ('2046573', 'Pitanium Limited Class A Ordinary shares'),
    'NUTR': ('2006468', 'Nusatrip Incorporated Common Stock'),
    'EMPG': ('2005569', 'Empro Group Inc. Ordinary shares'),
    'ADIGW': ('2105139', 'ADI Global Distribution Inc.'),
    'MAMK': ('2008007', 'MaxsMaking Inc. Class A Ordinary Shares'),
    'PLTS': ('2053033', 'Platinum Analytics Cayman Limited Class A Ordinary Shares'),
    'TCGL': ('2047190', 'TechCreate Group Ltd.'),
    'QMMM': ('1971542', 'QMMM Holdings Limited Class A Ordinary Shares'),
    'FDXW': ('1048911', 'FedEx Corporation'),
    'REZIW': ('1740332', 'Resideo Technologies, Inc.'),
    'SDM': ('2014955', 'Smart Digital Group Limited Ordinary Shares'),
    'SFPT': ('1653827', 'Safepoint Holdings, Inc.'),
    'JMG': ('2049717', 'JM Group Limited'),
}


def historical_ticker_for_trade(issuer_cik, transaction_date, resolved_ticker):
    """Use the share's trading symbol *as of* its reported trade date."""
    pair = VERIFIED_TICKER_RENAMES.get(cik_norm(issuer_cik))
    if pair is None:
        return resolved_ticker
    effective, old, new = pair
    if str(resolved_ticker).upper() not in (old, new):
        raise ValueError(f'Historical ticker conflicts with issuer class for {issuer_cik}: {resolved_ticker}')
    return old if date_only(transaction_date) < effective else new

XOM_PREDECESSOR_CIK = "0000034088"
XOM_PREDECESSOR_CHECKPOINT = "XOM_PREDECESSOR"
XOM_PREDECESSOR_LAST_TRADE_DATE = date(2026, 7, 1)

class ExcludedNonCommonSecurity(Exception):
    """Filing transaction is explicitly NOT the requested common security."""


def normalized_security_title(title):
    return re.sub(r"[^a-z0-9]+", " ", str(title or "").lower()).strip()


def security_title_is_common(title):
    """Accept only explicit public common equity: stock, ordinary shares, or common units.

    Positive match is mandatory even for a single-symbol issuer. Non-common
    security keywords take precedence, including embedded words in titles.
    """
    clean = normalized_security_title(title)
    if not clean or re.search(
        r"\b(?:preferred|preference|pref|warrants?|options?|rights?|"
        r"restricted|restricted stock units?|rsus?|depositary|depository|"
        r"notes?|debentures?|bonds?|convertible notes?|phantom)\b", clean
    ):
        return False
    return bool(re.search(
        r"\b(?:common\s+(?:stock|shares?|units?)|"
        r"ordinary\s+shares?|american\s+depositary\s+shares?)\b", clean
    ))


def trade_ticker_for_security(issuer_cik, security_title, fallback_ticker):
    """Resolve each Form 4 security-title deterministically or raise.

    No implicit common-stock labels, first-symbol wins, or class A/B guesses.
    Ambiguous securities block the entire filing, not just the affected row.
    """
    issuer = cik_norm(issuer_cik)
    normalized = normalized_security_title(security_title)
    # Real filings sometimes abbreviate or mistype the security description.
    # Only these issuer+EXACT-title pairs are permitted to bypass normal title
    # vocabulary rules. This is more complete than Rev10 but far safer than
    # the original importer's unconditional acceptance of any P or S.
    verified_title_routes = {
        "1045810": {"common": "NVDA"},
        "80661": {"common": "PGR"},
        "104169": {"common": "WMT"},  # SEC forms abbreviate public common stock
        "1652044": {"class c capital stock": "GOOG"},
        "76334": {"comon stock": "PH", "commmon stock": "PH"},
    }
    exact_route = verified_title_routes.get(issuer, {}).get(normalized)
    if exact_route is not None:
        # Route to the SEC-confirmed publicly traded security, not whichever
        # requested ticker happened to start the issuer scan.
        return exact_route
    if not security_title_is_common(security_title):
        # A missing or unknown title must be reviewed, not silently labelled.
        if not normalized or not re.search(r"\b(?:preferred|warrants?|rights?|"
                                        r"notes?|bonds?|options?|restricted|"
                                        r"depositary|depository)\b", normalized):
            raise ValueError(
                f"Missing/ambiguous public common security title for issuer {issuer}: "
                f"{security_title!r}"
            )
        raise ExcludedNonCommonSecurity(
            f"issuer={issuer} security_title={security_title!r}")

    classes = SHARE_CLASS_TICKERS.get(issuer)
    special = NONCLASS_COMMON_ROUTING.get(issuer, {})
    if classes is not None:
        # Warner Bros Discovery's publicly traded series is expressly named
        # Series A Common Stock. Do not map any other series to WBD.
        if issuer == '1437107' and re.search(r'\bseries a common stock\b', normalized):
            return special['series_a']
        # Series N non-voting is different from the plain U-Haul common.
        if issuer == "4457" and re.search(r"\bseries n\b", normalized):
            return special["series_n"]
        detected_classes = set(re.findall(r"\bclass\s+([a-z])\b", normalized))
        if len(detected_classes) > 1:
            raise ValueError(f"Multiple share classes in one security title: {security_title!r}")
        found = next(iter(detected_classes), None)
        if found:
            chosen = classes.get(found.upper())
            if chosen:
                return chosen
            raise ValueError(f"Unlisted class {found} for issuer {issuer}: {security_title!r}")
        if issuer == "63754" and re.search(r"\bnon\s+voting\b", normalized):
            return special["non_voting"]
        if issuer == "4457" and re.search(r"\bnon\s+voting\b", normalized):
            # Only *Series N* non-voting gets UHAL.B; other series may exist.
            raise ValueError(f"Unverified non-voting series for UHAL: {security_title!r}")
        # 'Common Stock' with no class can be routed ONLY for a confirmed
        # issuer whose shares use an explicitly unlettered public class.
        if "plain" in special and not re.search(r"\b(?:series|non\s+voting)\b", normalized):
            return special["plain"]
        raise ValueError(f"Unclassified common security for issuer {issuer}: {security_title!r}")

    primary = COMMON_ONLY_MULTI_SECURITY_ISSUERS.get(issuer)
    if primary and primary.replace(".", "-") != str(fallback_ticker).upper().replace(".", "-"):
        raise ValueError(f"Incorrect primary ticker {fallback_ticker} for issuer {issuer}: expected {primary}")
    # An explicit lettered class may not be the publicly traded one.
    if re.search(r"\bclass\s+[a-z]\b", normalized):
        # GME's public class is A, supported by its SEC listed description.
        if issuer == "1326380" and re.search(r"\bclass\s+a\b", normalized):
            return "GME"
        raise ValueError(f"Unverified named share class for issuer {issuer}: {security_title!r}")
    # Series, voting distinctions or other security classes require explicit
    # mapping; do not assume a plain ticker can absorb them.
    if re.search(r"\b(?:series\s+[a-z]|non\s+voting|voting\s+common)\b", normalized):
        raise ValueError(f"Unverified voting/series distinction for issuer {issuer}: {security_title!r}")
    return primary or fallback_ticker


def env_int(name, default, low=0, high=100000):
    value = int(os.environ.get(name, str(default)))
    if not low <= value <= high:
        raise ValueError(f"{name} must be between {low} and {high}")
    return value


def env_bool(name, default=False):
    return os.environ.get(name, "1" if default else "0").strip().lower() in ("1", "true", "yes")


def sec_session():
    if not hasattr(THREAD_LOCAL, "session"):
        THREAD_LOCAL.session = requests.Session()
    return THREAD_LOCAL.session


def rate_limit():
    global REQUEST_COUNT
    while True:
        with SEC_LOCK:
            now = time.monotonic()
            while SEC_TIMES and now - SEC_TIMES[0] >= 1:
                SEC_TIMES.popleft()
            if len(SEC_TIMES) < SEC_RATE:
                SEC_TIMES.append(now)
                REQUEST_COUNT += 1
                return
            wait = max(0.03, 1 - (now - SEC_TIMES[0]) + 0.01)
        time.sleep(wait)


def fetch(url, timeout=25):
    """A 404 can be a candidate miss; throttling/network errors retry."""
    for attempt in range(SEC_RETRIES):
        rate_limit()
        try:
            response = sec_session().get(url, headers=HEADERS, timeout=timeout)
            if response.status_code in (403, 429, 500, 502, 503, 504):
                if attempt < SEC_RETRIES - 1:
                    retry_after = response.headers.get("Retry-After")
                    try:
                        delay = max(1, min(45, float(retry_after)))
                    except (ValueError, TypeError):
                        delay = min(20, 2 ** (attempt + 1))
                    response.close()
                    time.sleep(delay)
                    continue
            return response
        except (requests.Timeout, requests.ConnectionError):
            if attempt == SEC_RETRIES - 1:
                raise
            time.sleep(min(20, 2 ** (attempt + 1)))
    raise RuntimeError(f"Exhausted SEC retries: {url}")


def sec_json(url):
    response = fetch(url)
    response.raise_for_status()
    return response.json()


def txt(node, path, default=""):
    item = node.find(path) if node is not None else None
    return item.text.strip() if item is not None and item.text is not None else default


def dec(value):
    if value is None or not str(value).strip():
        return None
    try:
        result = Decimal(str(value).replace(",", ""))
        return result if result.is_finite() else None
    except InvalidOperation:
        return None


def date_only(value):
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    return date.fromisoformat(str(value)[:10])


def cik_norm(value):
    return str(int(str(value)))


def accession_clean(accession):
    return str(accession).replace("-", "")


# `stocks.Type = CS` is NOT reliable for Bullionaire: SEC-listed notes and
# preferred depositary shares are also tagged CS in the existing database.
# Prefer explicit issuer class mappings, then screen security names. The Form 4
# parser remains the final source-of-truth for each transaction, not the name.
VERIFIED_COMMON_TICKERS = frozenset(
    t for classes in SHARE_CLASS_TICKERS.values() for t in classes.values()
) | frozenset(
    t for classes in NONCLASS_COMMON_ROUTING.values() for t in classes.values()
)

NONCOMMON_STOCK_NAME = re.compile(
    r"\b(?:depositary|depository|notes?|debentures?|bonds?|warrants?|"
    r"subscription rights?|senior unsecured|subordinated debt|"
    r"trust preferred|exchange traded notes?)\b|"
    r"\b(?:preferred|preference)\s+(?:stock|shares?|securities|units?|equity)\b|"
    r"\b(?:rights?|when[ -]issued)\b|"
    r"\bunits?\s+(?:consisting|each containing)\b",
    re.IGNORECASE,
)

def is_common_stock_listing(ticker, stock_type, security_name, market_cap=None):
    """True for plausible ordinary shares, never for named debt/preferred.

    A null market cap is not grounds to discard a genuine Class B/OTC common
    stock. Conversely, Type CS is not proof of a common-stock security.
    """
    symbol = str(ticker or "").strip().upper()
    name = str(security_name or "").strip()
    if not symbol:
        return False
    # The temporary FedEx Freight when-issued symbol is the same security
    # as FDXF, not an independent issuer/class. Do not scan it separately.
    if symbol == 'FDXFW':
        return False
    # Contradictory instrument names override ALL ticker/type whitelists.
    if NONCOMMON_STOCK_NAME.search(name):
        return False
    # Standalone SPAC units include warrants; they aren't common shares.
    # Preserve LP common units (e.g. EPD) by exempting those explicitly named.
    if re.search(r'\bunits?\b', name, re.I) and not re.search(
        r'\b(?:common|ordinary)\s+units?\b', name, re.I
    ):
        return False
    if symbol in VERIFIED_COMMON_TICKERS:
        return True
    if str(stock_type or "").strip().lower() not in ("cs", "stock", "common stock"):
        return False
    # A bare symbol without any supporting description or market cap is not
    # adequate to infer a valid tradable ordinary common share.
    return bool(name) or market_cap is not None


def db_stock_classification(limit=0):
    """Return valid tickers and a diagnostic sample of excluded instruments.

    This makes filtering transparent and keeps the same SQL table/column names
    already confirmed in the user's Supabase stocks table.
    """
    conn = get_db_connection_dict()
    try:
        cur = conn.cursor()
        cur.execute("""
            SELECT upper(trim("Ticker")) AS ticker,
                   "Type" AS stock_type,
                   "Company Name" AS security_name,
                   "Market Cap" AS market_cap
            FROM public.stocks
            WHERE "Ticker" IS NOT NULL AND trim("Ticker") <> ''
            ORDER BY "Market Cap" DESC NULLS LAST
        """)
        rows = cur.fetchall()
    finally:
        conn.close()

    selected, excluded = {}, []
    for row in rows:
        ticker = str(row['ticker']).upper()
        name = row['security_name'] or ''
        if is_common_stock_listing(ticker, row['stock_type'], name, row['market_cap']):
            if ticker not in selected:
                selected[ticker] = row['market_cap']
        else:
            excluded.append((ticker, name))
    common = list(selected)
    return (common[:limit] if limit else common), excluded


def ticker_universe(limit=0):
    return db_stock_classification(limit)[0]


def print_coverage_report(ciks):
    """Report the REAL Bullionaire universe; make zero SEC Form 4 requests."""
    common, excluded = db_stock_classification()
    by_cik = {}
    missing = []
    for symbol in common:
        cik = ciks.get(symbol) or ciks.get(symbol.replace('.', '-'))
        if cik:
            by_cik.setdefault(cik_norm(cik), set()).add(symbol)
        else:
            missing.append(symbol)
    explicit = set(SHARE_CLASS_TICKERS) | set(SHARE_CLASS_ALIASES)
    sec_siblings = {}
    for symbol, cik in ciks.items():
        sec_siblings.setdefault(cik_norm(cik), set()).add(symbol)
    ambiguous = {}
    single_common = 0
    for group, tickers in by_cik.items():
        if group in explicit:
            continue
        if group in COMMON_ONLY_MULTI_SECURITY_ISSUERS:
            continue
        if len(sec_siblings.get(group, set())) <= 1:
            continue
        if len(tickers) == 1:
            single_common += 1
        else:
            ambiguous[group] = tickers
    print(f'[DB COVERAGE] common_candidates={len(common)}; '
          f'excluded_noncommon_or_unverified={len(excluded)}; '
          f'no_SEC_CIK={len(missing)}; '
          f'actual_unmapped_multiclass_issuers={len(ambiguous)}; '
          f'actual_unmapped_multiclass_symbols={sum(map(len, ambiguous.values()))}; '
          f'single_common_multiproduct_issuers={single_common}', flush=True)
    for issuer, tickers in sorted(ambiguous.items()):
        print(f'[NEEDS SHARE CLASS MAP] CIK={issuer} DB={",".join(sorted(tickers))} '
              f'SEC={",".join(sorted(sec_siblings[issuer]))}', flush=True)
    print('[NO SEC CIK] ' + ','.join(missing), flush=True)
    print('[NONCOMMON FILTER SAMPLE] ' + ' | '.join(
        f'{ticker}: {name[:75]}' for ticker, name in excluded[:30]
    ), flush=True)



def _normalized_sec_identity(value):
    """Compare corporate legal names, stripping SEC/listing share descriptors."""
    value = html.unescape(str(value or '')).upper().replace('&', ' AND ')
    value = re.sub(
        r'\s+(?:(?:CLASS|SERIES)\s+[A-Z0-9]+\s+)?'
        r'(?:COMMON STOCK|ORDINARY SHARES?|COMMON SHARES?)\s*$',
        '', value,
    )
    for before, after in (
        ('INCORPORATED', 'INC'), ('CORPORATION', 'CORP'),
        ('LIMITED', 'LTD'), ('COMPANY', 'CO'),
    ):
        value = re.sub(r'\b' + before + r'\b', after, value)
    return ' '.join(re.findall(r'[A-Z0-9]+', value))


def _verify_sec_name_candidate(ticker, cik, db_name):
    """SEC live identity check; no candidate accepted from a name match alone."""
    record = sec_json(f'{SEC_DATA}/submissions/CIK{str(int(cik)).zfill(10)}.json')
    returned = record.get('cik')
    if returned is None or cik_norm(returned) != cik_norm(cik):
        return False, 'SEC CIK identity did not match'
    if not (record.get('filings') or {}).get('recent', {}).get('form'):
        return False, 'No issuer filing history in SEC submissions record'
    actual = _normalized_sec_identity(record.get('name'))
    requested = _normalized_sec_identity(db_name)
    listed = {str(t).strip().upper().replace('-', '.') for t in (record.get('tickers') or [])}
    # Exact SEC-listed ticker also independently corroborates the security.
    # Former legal names alone cannot approve an identity after a takeover.
    if not ((requested and actual and requested == actual) or ticker in listed):
        return False, f'Name/ticker does not match current SEC issuer {record.get("name")!r}'
    return True, 'Verified against SEC submissions issuer identity'


def _recover_named_sec_ciks(mapping):
    """Validate historical names in this EXISTING importer, without helper scripts.

    Limits requests to candidates genuinely missing from SEC current ticker data.
    Every acceptance verifies SEC issuer CIK, legal name/ticker, filing history,
    and checks other eligible DB common stocks already mapped to that issuer.
    Failed requests and shared-CIK ambiguities stay UNMAPPED for safety.
    """
    eligible = set(ticker_universe(0))
    by_issuer = {}
    for symbol in eligible:
        issuer = mapping.get(symbol) or mapping.get(symbol.replace('.', '-'))
        if issuer:
            by_issuer.setdefault(cik_norm(issuer), set()).add(symbol)
    # Targeted tests should not trigger 200 unrelated SEC profile requests.
    # Full database runs and coverage-only reports validate the entire set.
    scoped = {t.strip().upper() for t in os.environ.get('INSIDER_TICKERS', '').split(',') if t.strip()}
    if env_bool('INSIDER_COVERAGE_ONLY', False):
        scoped = set()
    requested = [(t, cik, name) for t, (cik, name) in SEC_CIK_NAME_CANDIDATES.items()
                 if t in eligible and t not in mapping and (not scoped or t in scoped)]
    if not requested:
        return

    # Parallel I/O shares the SEC_RATE process-wide throttling already used by
    # the importer, rather than exceeding SEC fair-access limits.
    results = {}
    def check(item):
        ticker, issuer, name = item
        try:
            verified, reason = _verify_sec_name_candidate(ticker, issuer, name)
            return ticker, issuer, verified, reason
        except Exception as exc:
            return ticker, issuer, False, f'{type(exc).__name__}: {exc}'

    with ThreadPoolExecutor(max_workers=4) as pool:
        for ticker, cik, passed, why in pool.map(check, requested):
            results[ticker] = (cik, passed, why)

    accepted, rejected = 0, []
    for ticker, cik, _ in requested:
        _, passed, why = results[ticker]
        group = cik_norm(cik)
        siblings = by_issuer.get(group, set()) - {ticker}
        if passed and siblings:
            passed = False
            why = 'CIK already assigned to another eligible common ticker: ' + ','.join(sorted(siblings))
        if passed:
            mapping[ticker] = str(int(cik)).zfill(10)
            by_issuer.setdefault(group, set()).add(ticker)
            accepted += 1
        else:
            rejected.append((ticker, why))
    print(f'[HISTORICAL CIK RECOVERY] candidates={len(requested)} '
          f'verified={accepted} require_review={len(rejected)} '
          f'preexisting_or_out_of_scope={len(SEC_CIK_NAME_CANDIDATES)-len(requested)}', flush=True)
    for ticker, reason in rejected[:35]:
        print(f'[CIK REVIEW] {ticker}: {reason}', flush=True)
    if len(rejected) > 35:
        print(f'[CIK REVIEW] {len(rejected)-35} further unverified candidates remain excluded', flush=True)

def ticker_to_cik():
    contents = sec_json(f"{SEC_WWW}/files/company_tickers.json")
    mapping = {}
    for r in contents.values():
        ticker = str(r.get("ticker", "")).upper().strip()
        if ticker and r.get("cik_str") is not None:
            mapping[ticker] = str(int(r["cik_str"])).zfill(10)
    for ticker, issuer in SEC_CIK_VERIFIED_HISTORY.items():
        verified = str(int(issuer)).zfill(10)
        existing = mapping.get(ticker)
        if existing is None:
            mapping[ticker] = verified
        elif cik_norm(existing) != cik_norm(verified):
            # A symbol could have been reused for an unrelated registrant.
            # Never override current SEC symbol identity with historical data.
            print(f'[HISTORICAL CIK COLLISION] {ticker}: current={existing} '
                  f'former={verified}; manual review required', flush=True)
    _recover_named_sec_ciks(mapping)
    return mapping


def load_states():
    """Read small per-ticker metadata once, including old legacy transaction cutoffs."""
    conn = get_db_connection_dict()
    try:
        cur = conn.cursor()
        cur.execute('''
            SELECT ticker, issuer_cik, last_success_at, resume_from FROM insider_sync_checkpoints
        ''')
        checkpoints = {r["ticker"].upper(): r for r in cur.fetchall()}
        cur.execute('''
            SELECT upper(ticker) AS ticker, max(filing_date) AS last_legacy_filing
            FROM insider_transactions
            WHERE filing_date IS NOT NULL AND transaction_code IN ('P','S')
            GROUP BY upper(ticker)
        ''')
        legacy = {r["ticker"].upper(): r["last_legacy_filing"] for r in cur.fetchall()}
        return checkpoints, legacy
    finally:
        conn.close()


def unresolved_issuer_ciks():
    """Return issuers with prior open filing-level errors for retry on later days.

    Even if an unresolved filing is older than the 7-day rolling window, it
    must never disappear simply because a different run advanced a checkpoint.
    """
    conn = get_db_connection_dict()
    try:
        cur = conn.cursor()
        cur.execute("""
            SELECT DISTINCT issuer_cik
            FROM public.insider_form4_ingestion_issues
            WHERE status = 'OPEN'
        """)
        return {cik_norm(r["issuer_cik"]) for r in cur.fetchall() if r["issuer_cik"]}
    finally:
        conn.close()


def submission_rows(ticker, cik, arrays):
    forms = arrays.get("form") or []
    dates = arrays.get("filingDate") or []
    accessions = arrays.get("accessionNumber") or []
    primaries = arrays.get("primaryDocument") or []
    reports = arrays.get("reportDate") or []
    out = []
    for i, form in enumerate(forms):
        if form not in ("4", "4/A"):
            continue
        accession = accessions[i] if i < len(accessions) else ""
        primary = primaries[i] if i < len(primaries) else ""
        filed = dates[i] if i < len(dates) else ""
        if not accession or not primary or not filed:
            raise ValueError(f"SEC returned incomplete Form 4 filing metadata for {ticker} index {i}")
        out.append({
            "ticker": ticker,
            "cik": cik,
            "form": form,
            "accession": str(accession),
            "primary": str(primary),
            "filing_date": date_only(filed),
            "report_date": reports[i] if i < len(reports) else None,
        })
    return out


def filings_since(ticker, cik, from_date):
    """SEC submits newest first. Include archived index pages only if necessary."""
    listing = sec_json(f"{SEC_DATA}/submissions/CIK{cik}.json")
    filings_obj = listing.get("filings") or {}
    recent = filings_obj.get("recent") or {}
    output = submission_rows(ticker, cik, recent)

    # SEC older submissions are split into files. Do not fetch them during
    # ordinary daily updates when recent metadata already covers the cutoff.
    recent_dates = [date_only(v) for v in recent.get("filingDate", []) if v]
    earliest_recent = min(recent_dates) if recent_dates else None
    if earliest_recent is None or earliest_recent > from_date:
        for meta in filings_obj.get("files") or []:
            name = meta.get("name")
            if not name:
                continue
            filing_to = meta.get("filingTo")
            filing_from = meta.get("filingFrom")
            if filing_to and date_only(filing_to) < from_date:
                continue
            if filing_from and date_only(filing_from) > date.today():
                continue
            pages = sec_json(f"{SEC_DATA}/submissions/{name}")
            output.extend(submission_rows(ticker, cik, pages))

    unique = {f["accession"]: f for f in output if f["filing_date"] >= from_date}
    return sorted(unique.values(), key=lambda f: (f["filing_date"], f["accession"]))


def parse_ownership_xml(blob):
    root = ET.fromstring(blob)
    for item in root.iter():
        if "}" in item.tag:
            item.tag = item.tag.split("}", 1)[1]
    if root.tag != "ownershipDocument" or root.find("issuer") is None:
        raise ValueError("Document is not SEC ownershipDocument XML")
    return root


def ownership_doc(ticker, filing):
    """Fast direct XML, then index fallback, checking issuer and filer CIK roots."""
    issuer_cik = cik_norm(filing["cik"])
    acc = accession_clean(filing["accession"])
    primary = filing["primary"].strip().lstrip("/")
    candidate_ciks = [issuer_cik]
    # In some ownership submissions the accession prefix identifies the
    # reporting owner/filer. Their archive directory can differ from issuer CIK.
    accession_prefix = filing["accession"].split("-")[0]
    if accession_prefix.isdigit():
        filing_cik = cik_norm(accession_prefix)
        if filing_cik not in candidate_ciks:
            candidate_ciks.append(filing_cik)
    attempted = set()

    def try_xml(url):
        if url in attempted:
            return None
        attempted.add(url)
        try:
            response = fetch(url)
            if response.status_code == 404:
                return None
            response.raise_for_status()
            return parse_ownership_xml(response.content), url
        except (requests.RequestException, ET.ParseError, ValueError):
            return None

    # Try both direct paths before downloading any extra index files.
    for root_cik in candidate_ciks:
        base = f"{SEC_WWW}/Archives/edgar/data/{root_cik}/{acc}/"
        if primary.lower().endswith(".xml"):
            candidates = [base + primary]
            if "/" in primary:
                candidates.append(base + primary.split("/")[-1])
            for u in candidates:
                got = try_xml(u)
                if got:
                    return got

    # If primary wasn't ownership XML (e.g. HTML), discover ownership XML.
    for root_cik in candidate_ciks:
        base = f"{SEC_WWW}/Archives/edgar/data/{root_cik}/{acc}/"
        try:
            index = sec_json(base + "index.json")
        except requests.HTTPError as error:
            if error.response is not None and error.response.status_code == 404:
                continue
            raise
        names = [str(i.get("name")) for i in index.get("directory", {}).get("item", [])
                 if i.get("name") and str(i.get("name")).lower().endswith(".xml")]
        names.sort(key=lambda n: (
            "ownership" not in n.lower() and "form4" not in n.lower(),
            "primary" in n.lower(), "schema" in n.lower(), n.lower()
        ))
        for name in names:
            got = try_xml(base + name)
            if got:
                return got
    raise RuntimeError(f"No parseable Form 4 ownership XML for {ticker}, {filing['accession']}")


class UnrelatedIssuerForm4(Exception):
    """A valid Form 4 surfaced under a reporting owner's CIK, not this issuer's."""


def parse_trades(ticker, filing, root, filing_url):
    xml_cik = txt(root, "./issuer/issuerCik")
    if not xml_cik:
        raise ValueError(f"Missing Form 4 issuer CIK for {ticker}: {filing['accession']}")
    if cik_norm(xml_cik) != cik_norm(filing["cik"]):
        # SEC submissions can include Form 4s filed by a company acting as a
        # reporting owner of OTHER issuers. Never attribute those trades to the
        # reporting owner's ticker. This valid-but-unrelated accession will be
        # saved as a zero-actionable-row receipt so future runs skip its XML.
        raise UnrelatedIssuerForm4(
            f"Form 4 is for a different issuer: {ticker} CIK {filing['cik']}, XML issuer CIK {xml_cik}"
        )
    company = txt(root, "./issuer/issuerName", ticker)
    # SEC-verified SLBT related-party share transfer.
    # The filing's price field contains the aggregate payment,
    # not a per-share price. Beneficial ownership was unchanged.
    if filing["accession"] == "0001104659-26-112844":
        print(
            "[SKIP RELATED-PARTY TRANSFER] SLBT "
            "0001104659-26-112844",
            flush=True,
        )
        return []
    # QUCY/MYNZ Form 4 was superseded by Form 4/A 0002105585-26-000005.
    # The corrected 685,000 shares at $1.51 were reconciled in Supabase.
    # Do not resurrect the original fictitious $258B transaction on recheck.
    if filing["accession"] == "0002105585-26-000003":
        print(
            "[SKIP SUPERSEDED SEC FORM 4] QUCY "
            "0002105585-26-000003; amended filing must be reviewed separately",
            flush=True,
        )
        return []

    owners = root.findall("./reportingOwner")
    if not owners:
        raise ValueError(f"No reporting owner in {filing['accession']}")
    owner_names = [txt(owner, "./reportingOwnerId/rptOwnerName") for owner in owners]
    if not all(owner_names):
        raise ValueError(f"Missing owner identity for {filing['accession']}")
    # If jointly filed, attribute a row to the named joint filers rather than
    # incorrectly claiming the FIRST person alone executed the reported trade.
    insider_name = " / ".join(dict.fromkeys(owner_names))
    titles = []
    for owner in owners:
        rel = owner.find("./reportingOwnerRelationship")
        parts = []
        if txt(rel, "./isDirector") == "1":
            parts.append("Director")
        if txt(rel, "./isOfficer") == "1":
            parts.append(txt(rel, "./officerTitle") or "Officer")
        if txt(rel, "./isTenPercentOwner") == "1":
            parts.append("10% Owner")
        titles.append(", ".join(parts) if parts else "Insider")
    title = " / ".join(dict.fromkeys(titles))

    rows = []
    for tx in root.findall(".//nonDerivativeTransaction"):
        # Same straightforward P/S candidate selection as the original importer.
        # The remaining gates validate issuer CIK, A/D consistency, share class,
        # dates, shares and price. Rejected filings stay retryable and visible.
        code = txt(tx, "./transactionCoding/transactionCode").upper()
        if code not in ("P", "S"):
            continue
        acquired = txt(tx, "./transactionAmounts/transactionAcquiredDisposedCode/value").upper()
        if acquired != ("A" if code == "P" else "D"):
            # An inconsistent transaction is not a trustworthy buy/sell.
            raise ValueError(f"Unexpected {code}/{acquired} acquisition code: {filing['accession']}")
        txdate_text = txt(tx, "./transactionDate/value")
        shares = dec(txt(tx, "./transactionAmounts/transactionShares/value"))
        price = dec(txt(tx, "./transactionAmounts/transactionPricePerShare/value"))
        if not txdate_text or shares is None or shares <= 0:
            raise ValueError(f"Missing date or shares in {code} trade: {filing['accession']}")
        transdate = date_only(txdate_text)
        if price is None or price <= 0:
            # No verifiable consideration: a P/S code alone cannot establish
            # an actionable economic buy or sell. Hold for SEC review.
            raise ValueError(
                f"Missing, zero or negative execution price requires SEC review: "
                f"{filing['accession']}"
            )
        if shares * price > Decimal("50000000000"):
            raise ValueError(
                f"Implausibly large transaction value requires "
                f"manual SEC review: {filing['accession']}"
            )
        owned = dec(txt(tx, "./postTransactionAmounts/sharesOwnedFollowingTransaction/value"))
        # Strict policy: missing Form 4 securityTitle always causes a review.
        security_title = txt(tx, "./securityTitle/value", "")
        try:
            assigned_ticker = historical_ticker_for_trade(
                filing['cik'], transdate,
                trade_ticker_for_security(filing["cik"], security_title, ticker)
            )
        except ExcludedNonCommonSecurity as excluded:
            # Explicitly non-common securities never appear as ordinary
            # stock insider buys/sells. This filing can still be checkpointed
            # after all its common-stock rows are processed.
            print(f"[SKIP NON-COMMON] {ticker} {filing['accession']}: {excluded}", flush=True)
            continue
        # SEC Form 4 occasionally puts total consideration, or the wrong
        # decimal scale, in transactionPricePerShare. Do not turn these into
        # giant bullish/bearish signals. Berkshire Class A is the separately
        # recognized high-priced public share class; other exceptions require
        # independent SEC verification, not a blanket decimal adjustment.
        if price > Decimal("10000") and assigned_ticker != "BRK.A":
            raise ValueError(
                f"Implausible per-share price requires manual SEC review "
                f"(ticker={assigned_ticker}, price={price}, "
                f"accession={filing['accession']})"
            )
        rows.append({
            "ticker": assigned_ticker, "company": company, "insider": insider_name,
            "title": title, "transaction_type": "Buy" if code == "P" else "Sell",
            "transaction_code": code,
            "security_title": security_title,
            "shares": shares, "price": price,
            "value": shares * price if price is not None else None,
            "transaction_date": transdate,
            "filing_date": filing["filing_date"],
            "report_date": date_only(filing["report_date"]) if filing.get("report_date") else None,
            "shares_owned_following": owned,
            "signal": "Bullish" if code == "P" else "Bearish",
            "accession_number": filing["accession"], "filing_url": filing_url,
            "is_derivative": False, "source": "SEC Form 4",
        })
    return rows


def existing_accessions(ticker, candidates, issuer_cik=None):
    if not candidates:
        return set()
    # CRITICAL CORRECTNESS RULE: a legacy insider_transactions row is NOT a
    # processing receipt. The older importer stopped after a small number of
    # trades and could leave other P/S lots (including purchases) uncollected.
    # Only a durable receipt written after the FULL Form 4 was parsed proves that
    # an accession is complete. Economic-lot reconciliation prevents inserting
    # extra copies of rows already present in a legacy import.
    aliases = list(SHARE_CLASS_ALIASES.get(cik_norm(issuer_cik), (ticker,))) if issuer_cik else [ticker]
    conn = get_db_connection_dict()
    try:
        cur = conn.cursor()
        cur.execute('''
            SELECT accession_number
            FROM insider_form4_processed
            WHERE upper(ticker) = ANY(%s) AND accession_number = ANY(%s)
        ''', (aliases, candidates))
        return {str(r["accession_number"]) for r in cur.fetchall()}
    finally:
        conn.close()


# Economic lot identity: do not include insider display name or officer title.
# Historical importers used different naming conventions for jointly reporting
# owners; otherwise the same SEC lot can be inserted twice with a new name.
# Count each SEC lot (rather than making a set), since separate execution rows
# may occasionally have identical date/share/price combinations.
def economic_lot_key(row):
    def n(value):
        if value is None or str(value).strip() == "":
            return None
        return Decimal(str(value)).normalize()
    security = re.sub(r"\s+", " ", str(row.get("security_title") or "")).strip().casefold()
    return (
        str(row.get("accession_number") or ""),
        str(row.get("ticker") or "").upper(),
        str(row.get("transaction_code") or "").upper(),
        str(row.get("transaction_date") or "")[:10],
        security,
        n(row.get("shares")), n(row.get("price")),
    )


def missing_economic_lots(source_rows, existing_rows):
    """Return only SEC lots not already represented in DB, independent of owner spelling.

    Raises rather than checkpointing a filing with more existing economic lots than
    the actual SEC filing: those excess rows require a targeted cleanup/audit.
    """
    from collections import Counter
    required = Counter(economic_lot_key(r) for r in source_rows)
    present = Counter(economic_lot_key(r) for r in existing_rows)
    accession = str(source_rows[0].get("accession_number")) if source_rows else "unknown"
    excess = {key: n for key, n in present.items() if n > required.get(key, 0)}
    if excess:
        raise ValueError(
            f"DB already has excess/unrecognized lots for accession {accession}: "
            f"{sum(excess.values())} rows; run SEC accuracy audit before checkpointing"
        )
    kept = Counter()
    missing = []
    for row in source_rows:
        key = economic_lot_key(row)
        if kept[key] < max(0, required[key] - present[key]):
            missing.append(row)
            kept[key] += 1
    return missing


TX_COLUMNS = [
    "ticker", "company", "insider", "title", "transaction_type", "transaction_code",
    "security_title", "shares", "price", "value", "transaction_date", "filing_date",
    "report_date", "shares_owned_following", "signal", "accession_number", "filing_url",
    "is_derivative", "source"
]


def persist_ticker(ticker, cik, successes, resume_from, last_success_at=None, failures=()):
    """Atomic save of transactions + filing receipts + optional checkpoint.

    Partial SEC failure: write successfully parsed filings/receipts so they won't
    be re-downloaded; don't advance the ticker checkpoint. On next run it retries
    the failed filing while skipping committed successes.
    """
    conn = get_db_connection_dict()
    try:
        cur = conn.cursor()
        # SERIALIZE writes for this issuer across concurrent instances of THIS
        # importer. Since the obsolete natural-key unique index was removed,
        # otherwise two simultaneous runs could both read an absent SEC lot and
        # both insert it. A transaction-scoped advisory lock lasts until commit
        # or rollback; the existing read/compare/insert/verify sequence remains
        # completely atomic. One lock per issuer is faster than one per filing.
        # Do not run the deprecated separate Form 4 importer concurrently: it
        # does not acquire this advisory lock.
        cur.execute(
            "SELECT pg_advisory_xact_lock(%s::integer, hashtext(%s))",
            (41724026, cik_norm(cik)),
        )
        # Reconcile by the SEC economic lot, NOT by legacy insider-name strings.
        # Keep all SEC lots at their proper multiplicity; don't add an existing
        # lot again merely because older code formatted its reporting owners
        # differently. All comparisons and inserts share one DB transaction.
        rows = []
        accessions = [filing["accession"] for filing, _ in successes]
        # SEC accessions may be present under an OTHER issuer when its reporting
        # owner is another public company (e.g. BX is a filer of LGN and FOA).
        # DB lots for unrelated issuer tickers MUST NEVER make a BX import fail.
        # Include every explicitly validated class and historical same-security
        # alias, plus the exact assigned tickers found in parsed SEC rows.
        issuer_tickers = {str(ticker).upper()}
        issuer_tickers.update(
            str(t).upper() for t in SHARE_CLASS_ALIASES.get(cik_norm(cik), ())
        )
        issuer_tickers.update(
            str(row["ticker"]).upper()
            for _, source_rows in successes
            for row in source_rows
            if row.get("ticker")
        )
        db_by_accession = {}
        for start in range(0, len(accessions), 200):
            part = accessions[start:start+200]
            if not part:
                continue
            cur.execute('''
                SELECT accession_number, ticker, transaction_code,
                       transaction_date, security_title, shares, price
                FROM public.insider_transactions
                WHERE accession_number = ANY(%s)
                  AND upper(ticker) = ANY(%s)
                  AND transaction_code IN ('P','S')
            ''', (part, sorted(issuer_tickers)))
            for existing in cur.fetchall():
                db_by_accession.setdefault(str(existing["accession_number"]), []).append(existing)
        for filing, source_rows in successes:
            accession = str(filing["accession"])
            if not source_rows and db_by_accession.get(accession):
                raise ValueError(f"Existing DB lots for zero-trade/unrelated SEC filing {accession}; manual audit required")
            rows.extend(missing_economic_lots(source_rows, db_by_accession.get(accession, [])))
        inserted = 0
        if rows:
            values = [tuple(r.get(k) for k in TX_COLUMNS) + (datetime.now(timezone.utc),)
                      for r in rows]
            columns = """ticker, company, insider, title, transaction_type,
                transaction_code, security_title, shares, price, value,
                transaction_date, filing_date, report_date, shares_owned_following,
                signal, accession_number, filing_url, is_derivative, source, updated_at"""
            for start in range(0, len(values), 250):
                batch = values[start:start+250]
                markers = ",".join(["(" + ",".join(["%s"] * 20) + ")"] * len(batch))
                parameters = tuple(x for row in batch for x in row)
                cur.execute(
                    f"INSERT INTO insider_transactions ({columns}) VALUES {markers} "
                    "ON CONFLICT DO NOTHING RETURNING id",
                    parameters,
                )
                inserted += len(cur.fetchall())
        # Verify final stored SEC-lot multiplicities *before* writing durable
        # processing receipts. This catches missing or excess rows regardless
        # of database constraints and preserves repeated, numerically identical
        # SEC execution lots at the correct multiplicity. Fail closed on error.
        if successes:
            from collections import Counter
            for start in range(0, len(accessions), 200):
                batch_accessions = accessions[start:start+200]
                if not batch_accessions:
                    continue
                cur.execute('''
                    SELECT accession_number, ticker, transaction_code,
                           transaction_date, security_title, shares, price
                    FROM public.insider_transactions
                    WHERE accession_number = ANY(%s)
                      AND upper(ticker) = ANY(%s)
                      AND transaction_code IN ('P','S')
                ''', (batch_accessions, sorted(issuer_tickers)))
                final_rows = {}
                for stored in cur.fetchall():
                    final_rows.setdefault(str(stored["accession_number"]), []).append(stored)
                for filing, source in successes:
                    acc = str(filing["accession"])
                    if acc not in batch_accessions:
                        continue
                    intended = Counter(economic_lot_key(r) for r in source)
                    actual = Counter(economic_lot_key(r) for r in final_rows.get(acc, []))
                    if intended != actual:
                        raise ValueError(
                            f"Post-insert SEC lot mismatch for accession {acc}; "
                            "refusing to checkpoint. Investigate uniqueness/schema."
                        )
        if successes:
            receipt_vals = [(ticker, cik, f["accession"], f["filing_date"], len(data))
                            for f, data in successes]
            for start in range(0, len(receipt_vals), 500):
                batch = receipt_vals[start:start+500]
                markers = ",".join(["(%s,%s,%s,%s,%s)"] * len(batch))
                parameters = tuple(x for row in batch for x in row)
                cur.execute(
                    "INSERT INTO insider_form4_processed "
                    "(ticker, issuer_cik, accession_number, filing_date, actionable_rows) "
                    f"VALUES {markers} ON CONFLICT (ticker, accession_number) DO NOTHING",
                    parameters,
                )
        # Make unresolved parse/fetch errors durable. Some failed filings have
        # ZERO stored transactions and would otherwise be invisible to audits.
        for accession, issue in failures:
            cur.execute('''
                INSERT INTO public.insider_form4_ingestion_issues
                    (issuer_cik, issuer_ticker, accession_number, issue_text,
                     status, first_seen_at, last_seen_at, resolved_at)
                VALUES (%s,%s,%s,%s,'OPEN',now(),now(),NULL)
                ON CONFLICT (issuer_cik, accession_number) DO UPDATE SET
                    issuer_ticker = EXCLUDED.issuer_ticker,
                    issue_text = EXCLUDED.issue_text,
                    status = 'OPEN', last_seen_at = now(), resolved_at = NULL
            ''', (cik_norm(cik), ticker, accession, issue[:2000]))
        for filing, _ in successes:
            cur.execute('''
                UPDATE public.insider_form4_ingestion_issues
                   SET status = 'RESOLVED', last_seen_at = now(), resolved_at = now()
                 WHERE issuer_cik = %s AND accession_number = %s
                   AND status = 'OPEN'
            ''', (cik_norm(cik), filing["accession"]))
        # Persist the initial scan floor even if a newly seeded ticker partly
        # failed. Without this, rows inserted from newer successes could make
        # a later rerun skip a failed older filing permanently.
        cur.execute('''
            INSERT INTO insider_sync_checkpoints
                (ticker, issuer_cik, resume_from, last_success_at, updated_at)
            VALUES (%s, %s, %s, %s, now())
            ON CONFLICT (ticker) DO UPDATE SET
                issuer_cik = EXCLUDED.issuer_cik,
                resume_from = CASE
                    WHEN insider_sync_checkpoints.last_success_at IS NULL
                    THEN least(insider_sync_checkpoints.resume_from, EXCLUDED.resume_from)
                    ELSE insider_sync_checkpoints.resume_from
                END,
                last_success_at = CASE
                    WHEN EXCLUDED.last_success_at IS NULL
                    THEN insider_sync_checkpoints.last_success_at
                    WHEN insider_sync_checkpoints.last_success_at IS NULL
                    THEN EXCLUDED.last_success_at
                    ELSE greatest(insider_sync_checkpoints.last_success_at, EXCLUDED.last_success_at)
                END,
                updated_at = now()
        ''', (ticker, cik, resume_from, last_success_at))
        conn.commit()
        return inserted
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def process_ticker(ticker, cik, checkpoint, legacy_filing_date, config,
                   state_ticker=None, last_trade_date=None):
    # State can belong to a *predecessor registrant* while inserted rows must
    # continue to use the public stock ticker, not an invented stock symbol.
    # This prevents successor and predecessor CIK checkpoints from overwriting
    # one another, and keeps the per-accession receipt optimization.
    state_ticker = state_ticker or ticker
    dry_run = config["dry_run"]
    if not cik:
        return {"status": "no_cik", "ticker": ticker, "new_filings": 0,
                "inserted": 0, "trades": 0, "known": 0, "failed": 0}
    if checkpoint and cik_norm(checkpoint["issuer_cik"]) != cik_norm(cik):
        raise ValueError(f"{state_ticker}: SEC CIK changed since last sync; manual review required")

    scan_started_at = datetime.now(timezone.utc)
    overlap = timedelta(days=config["overlap_days"])
    initial_floor = scan_started_at.date() - timedelta(days=config["first_lookback_days"])
    if checkpoint and checkpoint.get("last_success_at"):
        # A successfully synchronized issuer ALWAYS resumes from its actual
        # last successful run, with the requested overlap. No annual re-fetch.
        cutoff = date_only(checkpoint["last_success_at"]) - overlap
        mode = "incremental"
    elif checkpoint and checkpoint.get("resume_from"):
        # Retry an interrupted initial scan without accidentally repeating a
        # stale 5-year setting inherited from an earlier failed attempt.
        cutoff = max(date_only(checkpoint["resume_from"]), initial_floor)
        mode = "retry_incomplete_initial"
    elif legacy_filing_date:
        # Legacy rows without a verified processing receipt do not establish
        # full SEC filing coverage. Seed ONE year and reconcile exact lots.
        # The year is processed only once: success creates a checkpoint.
        cutoff = initial_floor
        mode = "legacy_first_year"
    else:
        cutoff = initial_floor
        mode = "first_load"
    # Opt-in ONE-TIME backfill / reconciliation of the older importer. Ordinary
    # daily runs retain their small overlap; prior fully processed receipts are
    # still trusted and their XML is not downloaded again.
    if config["reconcile_days"]:
        reconcile_floor = scan_started_at.date() - timedelta(days=config["reconcile_days"])
        cutoff = min(cutoff, reconcile_floor)
        mode += "+reconcile"
    if cik_norm(cik) in config.get("unresolved_issuers", set()):
        # Retry open SEC issues even when their filing dates have moved beyond
        # the normal 7-day overlap. Filing receipts avoid downloading successes.
        cutoff = min(cutoff, scan_started_at.date() - timedelta(days=365))
        mode += "+retry_open_issues"
    print(f"[SCAN] {state_ticker} -> {ticker} CIK={cik} mode={mode} cutoff={cutoff}", flush=True)

    filings = filings_since(ticker, cik, cutoff)
    # IMPORTANT: do not discard a PREDECESSOR filing merely because its filing
    # date is after legal succession. A late Form 4 may report an earlier trade.
    # We instead validate the actual reported transaction date below.
    known = (set() if config["force_recheck"] else
             existing_accessions(state_ticker, [f["accession"] for f in filings], cik))
    fresh = [f for f in filings if f["accession"] not in known or f.get("form") == "4/A"]
    successes = []
    failed = []
    skipped_other_issuer = 0
    raw_ps_candidates = 0
    for filing in fresh:
        try:
            if filing.get("form") == "4/A":
                # A Form 4/A may restate an earlier transaction. Importing it
                # as a new sale/buy risks double-counting; silently omitting it
                # also falsely claims completeness. Persist as an OPEN audit
                # issue and do not advance the issuer checkpoint.
                raise ValueError(
                    "Form 4/A amendment: original filing reconciliation "
                    "is needed before including corrected lots"
                )
            root, url = ownership_doc(ticker, filing)
            raw_ps_candidates += sum(
                txt(node, "./transactionCoding/transactionCode").upper() in ("P", "S")
                for node in root.findall(".//nonDerivativeTransaction")
            )
            rows = parse_trades(ticker, filing, root, url)
            if last_trade_date is not None and any(
                r["transaction_date"] > last_trade_date for r in rows
            ):
                raise ValueError(
                    f"{ticker} predecessor issuer {cik} reports a P/S trade "
                    f"after {last_trade_date}: {filing['accession']}; "
                    "review before attributing to XOM"
                )
            successes.append((filing, rows))
        except UnrelatedIssuerForm4 as exc:
            # This is not a missing transaction or a download failure: it is a
            # valid SEC filing about another issuer. Save a durable receipt with
            # zero P/S rows. The actual issuer is not assigned this ticker.
            successes.append((filing, []))
            skipped_other_issuer += 1
            print(f"[SKIP OTHER ISSUER] {ticker} accession={filing['accession']}: {exc}", flush=True)
        except Exception as exc:
            failed.append((filing["accession"], f"{type(exc).__name__}: {exc}"))
            print(f"[FAILED] {ticker} accession={filing['accession']}: {exc}", flush=True)

    buy_count = sum(1 for _, trades in successes for row in trades if row["transaction_code"] == "P")
    sell_count = sum(1 for _, trades in successes for row in trades if row["transaction_code"] == "S")
    print(f"[DIRECTION AUDIT] {ticker} new_purchases={buy_count} new_sales={sell_count} "
          f"unresolved_filings={len(failed)}", flush=True)
    if fresh:
        print(f"[SOURCE COVERAGE] {ticker} raw_non_derivative_P_or_S="
              f"{raw_ps_candidates} accepted_public_common={buy_count + sell_count} "
              f"failed_filings={len(failed)} skipped_other_issuer={skipped_other_issuer}",
              flush=True)
    if dry_run:
        saved = 0
        # Always show purchases first for a positive-control ticker, even if the
        # SEC's chronology places the purchase in a later filing.
        purchases = [(filing, row) for filing, trades in successes for row in trades
                     if row["transaction_code"] == "P"]
        for filing, row in purchases[:5]:
            print(f"[PURCHASE SAMPLE] {ticker} {filing['accession']} "
                  f"{row['transaction_date']} {row['insider']} "
                  f"shares={row['shares']} price={row['price']}", flush=True)
        for filing, trades in successes[:3]:
            for row in trades[:2]:
                print(f"[SAMPLE] {ticker} {row['transaction_date']} {row['transaction_type']} "
                      f"{row['insider']} shares={row['shares']} price={row['price']}", flush=True)
    else:
        # If one previously saved legacy row contradicts an SEC filing,
        # isolate that accession. Do not roll back hundreds of other good SEC
        # filings just because one bad lot needs manual audit.
        try:
            saved = persist_ticker(state_ticker, cik, successes, resume_from=cutoff,
                                  last_success_at=scan_started_at if not failed else None,
                                  failures=failed)
        except ValueError as mismatch:
            if not successes:
                raise
            saved = 0
            reconciliation_failures = []
            def persist_parts(parts):
                nonlocal saved
                if not parts:
                    return
                try:
                    saved += persist_ticker(
                        state_ticker, cik, parts, resume_from=cutoff,
                        last_success_at=None, failures=[])
                except ValueError as exc:
                    if len(parts) == 1:
                        acc = parts[0][0]["accession"]
                        reconciliation_failures.append((acc, f"DB reconciliation: {exc}"))
                        print(f"[DB LOT AUDIT ISSUE] {ticker} accession={acc}: {exc}", flush=True)
                    else:
                        middle = len(parts) // 2
                        persist_parts(parts[:middle])
                        persist_parts(parts[middle:])
            persist_parts(successes)
            if reconciliation_failures:
                failed.extend(reconciliation_failures)
                persist_ticker(state_ticker, cik, [], resume_from=cutoff,
                               last_success_at=None, failures=reconciliation_failures)
            print(f"[DB RECONCILE] {ticker} isolated {len(reconciliation_failures)} "
                  f"discrepant SEC filings; successful filings committed independently.", flush=True)
            # no last_success checkpoint if any filing cannot be reconciled
            if not failed and successes:
                persist_ticker(state_ticker, cik, [], resume_from=cutoff,
                               last_success_at=scan_started_at, failures=[])
    return {
        "status": "partial_retry_next_run" if failed else ("dry_run" if dry_run else "done"),
        "mode": mode, "ticker": ticker, "state_ticker": state_ticker, "cutoff": str(cutoff),
        "new_filings": len(fresh), "inserted": saved,
        "trades": sum(len(data) for _, data in successes),
        "known": len(known), "failed": len(failed),
        "skipped_other_issuer": skipped_other_issuer,
        "raw_ps_candidates": raw_ps_candidates,
        "purchases": buy_count, "sales": sell_count,
    }


def main():
    start = time.monotonic()
    config = {
        "dry_run": env_bool("INSIDER_DRY_RUN", True),
        "overlap_days": env_int("INSIDER_OVERLAP_DAYS", 7, 1, 90),
        "first_lookback_days": env_int("INSIDER_FIRST_LOOKBACK_DAYS", 365, 1, 3650),
        "workers": env_int("INSIDER_MAX_WORKERS", 4, 1, 6),
        "ticker_limit": env_int("INSIDER_LIMIT", 0, 0, 100000),
        "reconcile_days": env_int("INSIDER_RECONCILE_DAYS", 0, 0, 3650),
        # Audit mode only: repeat SEC XML even for previously receipted filings.
        # Defaults OFF; leave OFF for ordinary daily imports.
        "force_recheck": (env_bool("INSIDER_FORCE_RECHECK", False)
                          or env_bool("INSIDER_VERIFY_EXISTING", False)
                          or env_int("INSIDER_RECONCILE_DAYS", 0, 0, 3650) > 0),
    }
    # Prevent a stale PowerShell 1825-day reconciliation setting from silently
    # restarting a five-year scan. Backfills need two explicit opt-ins.
    if config["reconcile_days"] and not env_bool("INSIDER_ENABLE_HISTORICAL_BACKFILL", False):
        raise ValueError(
            "Historical reconciliation is disabled for ordinary incremental runs. "
            "Set INSIDER_RECONCILE_DAYS=0 to resume from saved checkpoints; "
            "intentional backfills additionally require "
            "INSIDER_ENABLE_HISTORICAL_BACKFILL=1."
        )
    specific = [s.strip().upper() for s in os.environ.get("INSIDER_TICKERS", "").split(",") if s.strip()]
    print(f"[CONFIG] {config} tickers={specific or 'DB universe'}", flush=True)
    if config["reconcile_days"]:
        print(f"[HISTORICAL ONE-TIME] Intentional {config['reconcile_days']}-day reconciliation; "
              "reset INSIDER_RECONCILE_DAYS=0 afterward.", flush=True)
        print("[AUDIT REQUIRED] Re-reading ALL Form 4 XML including previous receipts "
              "in the reconciliation window; old checkpoints alone DO NOT prove completeness.",
              flush=True)
    else:
        print("[INCREMENTAL] Seven-day overlap for checkpointed issuers; "
              "no historical re-scan.", flush=True)
    if config["force_recheck"]:
        print("[FULL RECEIPT AUDIT] Revalidating previously processed SEC XML and DB lots, no trust shortcuts.", flush=True)
    else:
        print("[SEC] Previously processed receipts are trusted, NOT reaudited; use "
              "INSIDER_VERIFY_EXISTING=1 for the one-time correctness audit.", flush=True)
    ciks = ticker_to_cik()
    if env_bool("INSIDER_COVERAGE_ONLY", False):
        print_coverage_report(ciks)
        return
    checkpoints, legacy = load_states()
    config["unresolved_issuers"] = unresolved_issuer_ciks()
    if config["unresolved_issuers"]:
        print(f"[RETRY QUEUE] {len(config['unresolved_issuers'])} issuers have unresolved filings; "
              "their historical metadata will remain in scope until reviewed.", flush=True)
    tickers = list(dict.fromkeys(specific)) if specific else ticker_universe(config["ticker_limit"])

    # SEC company_tickers.json contains *all* listed securities for an issuer,
    # not just its common shares. Distinguish the user database's actual common
    # stock universe before declaring any multi-security CIK ambiguous.
    # Always use the FULL DB universe for this safety check (including when a
    # user supplies INSIDER_TICKERS or INSIDER_LIMIT for a smaller test).
    db_common = set(tickers) if not specific and not config["ticker_limit"] else set(ticker_universe(0))
    common_by_cik = {}
    for symbol in db_common:
        sec_cik = ciks.get(symbol) or ciks.get(symbol.replace(".", "-"))
        if sec_cik:
            common_by_cik.setdefault(cik_norm(sec_cik), set()).add(symbol)

    totals = {"inserted": 0, "trades": 0, "failed": 0, "new_filings": 0,
              "known": 0, "skipped_other_issuer": 0,
              "raw_ps_candidates": 0, "purchases": 0, "sales": 0}
    failures = 0
    # For known share-class pairs, a single issuer scan can discover BOTH
    # classes' trades. Avoid duplicate SEC requests and race-to-insert behavior.
    issuer_seen = set()
    # Other multi-symbol SEC registrants (e.g. additional A/B classes) require
    # an explicit mapping before their Form 4 trades can be assigned honestly.
    # Do not let "whichever ticker scanned first" dictate the economic security.
    symbols_by_cik = {}
    for symbol, sec_cik in ciks.items():
        symbols_by_cik.setdefault(cik_norm(sec_cik), set()).add(symbol)
    unconfigured_ciks = {}
    auto_common_candidates = 0
    for key, syms in symbols_by_cik.items():
        if len(syms) <= 1 or key in SHARE_CLASS_ALIASES or key in SHARE_CLASS_TICKERS:
            continue
        primary_common = COMMON_ONLY_MULTI_SECURITY_ISSUERS.get(key)
        if primary_common and primary_common in syms:
            # Scan the confirmed common ticker; per-transaction securityTitle
            # will enforce that only its common shares are attributed to it.
            continue
        # Important: SEC's symbol directory lists preferred shares, warrants,
        # notes and units alongside real common-stock classes. The existing
        # program incorrectly treated EVERY sibling ticker as another possible
        # class of common stock, skipping hundreds of ordinary companies.
        #
        # The stocks table is our scoped, classified investment universe:
        # ticker_universe() now excludes named debt and preferred securities,
        # and includes documented OTC/common share classes even without cap.
        # Exactly one eligible common symbol can authorize an issuer scan.
        # That is ONLY authorization to scan: each SEC Form 4 P/S transaction
        # must still pass strict common-stock securityTitle validation.
        db_classes = common_by_cik.get(key, set())
        if len(db_classes) == 1:
            common_ticker = next(iter(db_classes))
            COMMON_ONLY_MULTI_SECURITY_ISSUERS[key] = common_ticker
            auto_common_candidates += 1
            if env_bool("INSIDER_VERBOSE_CLASSIFICATIONS", False):
                print(f"[COMMON STOCK CANDIDATE] {common_ticker}: issuer {key} "
                      f"has {len(syms)} listed securities, one DB common ticker; "
                      "Form 4 security-title validation is mandatory.", flush=True)
            continue
        # Two or more eligible common tickers, or no trustworthy mapping:
        # keep ALL their Form 4 common-share transactions out until an
        # issuer-specific securityTitle -> ticker mapping is verified.
        unconfigured_ciks[key] = syms
    print(f"[CLASSIFICATION] {auto_common_candidates} single-common candidates; "
          f"{len(unconfigured_ciks)} unresolved SEC issuer share-class groups. "
          "Use INSIDER_VERBOSE_CLASSIFICATIONS=1 for a complete candidate list.", flush=True)
    skipped_shareclass_tickers = 0
    with ThreadPoolExecutor(max_workers=config["workers"]) as pool:
        jobs = {}
        for ticker in tickers:
            lookup = ciks.get(ticker) or ciks.get(ticker.replace(".", "-"))
            group = cik_norm(lookup) if lookup else None
            primary_common = COMMON_ONLY_MULTI_SECURITY_ISSUERS.get(group)
            if primary_common and ticker != primary_common:
                print(f"[SKIP NON-COMMON SYMBOL] {ticker}: issuer CIK {group} "
                      f"is covered for ordinary common-stock trading by {primary_common}", flush=True)
                continue
            if group in unconfigured_ciks:
                print(f"[NEEDS SHARE CLASS MAP] {ticker}: SEC issuer {group} also has "
                      f"symbols {sorted(unconfigured_ciks[group])}. "
                      "Skipping rather than risking an incorrect ticker attribution.", flush=True)
                failures += 1
                skipped_shareclass_tickers += 1
                continue
            if group in SHARE_CLASS_ALIASES and group in issuer_seen:
                print(f"[SAME ISSUER] {ticker}: covered by an earlier {group} issuer scan", flush=True)
                continue
            if group in SHARE_CLASS_ALIASES:
                issuer_seen.add(group)
            # A previous run might have checkpointed the sibling's symbol.
            # Use the most recent successful checkpoint from the pair.
            paired = SHARE_CLASS_ALIASES.get(group, (ticker,))
            good = [checkpoints.get(sym) for sym in paired
                    if checkpoints.get(sym) and checkpoints[sym].get("last_success_at")]
            checkpoint = max(good, key=lambda r: r["last_success_at"]) if good else checkpoints.get(ticker)
            legacy_date = max((legacy.get(sym) for sym in paired if legacy.get(sym)), default=None)
            job = pool.submit(process_ticker, ticker, lookup, checkpoint, legacy_date, config)
            jobs[job] = ticker
        # XOM has a legitimate PREDECESSOR issuer, CIK 0000034088, whose
        # historic Form 4s do not appear in the successor's submissions JSON.
        # Run it as a separate issuer with its own checkpoint/receipts; parsed
        # transactions are still attributed to the publicly traded XOM symbol.
        if "XOM" in tickers:
            predecessor_state = checkpoints.get(XOM_PREDECESSOR_CHECKPOINT)
            predecessor_job = pool.submit(
                process_ticker, "XOM", XOM_PREDECESSOR_CIK,
                predecessor_state, None, config,
                XOM_PREDECESSOR_CHECKPOINT, XOM_PREDECESSOR_LAST_TRADE_DATE,
            )
            jobs[predecessor_job] = XOM_PREDECESSOR_CHECKPOINT
        for index, job in enumerate(as_completed(jobs), 1):
            ticker = jobs[job]
            try:
                result = job.result()
                for k in totals:
                    totals[k] += result.get(k, 0)
                if result["status"] in ("partial_retry_next_run", "no_cik"):
                    failures += 1
                print(f"[{index}/{len(jobs)}] {ticker} {result['status']} "
                      f"mode={result.get('mode','?')} new_docs={result['new_filings']} "
                      f"known={result['known']} trades={result['trades']} "
                      f"inserted={result['inserted']} errors={result['failed']} "
                      f"skipped_other_issuer={result.get('skipped_other_issuer', 0)}", flush=True)
            except Exception as exc:
                failures += 1
                print(f"[{index}/{len(jobs)}] {ticker} ERROR {type(exc).__name__}: {exc}", flush=True)
    print(f"[SUMMARY] ticker_symbols_requested={len(tickers)} issuer_scans={len(jobs)} "
          f"shareclass_skipped_symbols={skipped_shareclass_tickers} "
          f"unresolved_shareclass_issuers={len(unconfigured_ciks)} "
          f"{totals} ticker_errors={failures} "
          f"http_requests={REQUEST_COUNT} elapsed={time.monotonic() - start:.1f}s", flush=True)
    if config["force_recheck"] and totals["new_filings"]:
        reviewed = totals["new_filings"]
        clean = max(0, reviewed - totals["failed"])
        print(f"[RECONCILIATION COVERAGE] {clean}/{reviewed} SEC filing accessions "
              f"had no reported parsing/reconciliation issue "
              f"({clean/reviewed:.2%}). This is NOT a measured transaction "
              "accuracy percentage: unresolved mappings, Form 4/A corrections, "
              "and independent spot-checking are separate requirements.", flush=True)
    if failures:
        print("[ATTENTION] Some tickers did not finish. Re-run normally; receipts prevent re-downloading successes.", flush=True)
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())