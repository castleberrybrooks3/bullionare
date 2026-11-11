from collections import defaultdict, Counter
import csv, html, os, re
import requests
import insider_transactions_incremental as m

URL = 'https://www.sec.gov/Archives/edgar/cik-lookup-data.txt'

def norm(value):
    x = html.unescape(str(value or '')).upper().replace('&', ' AND ')
    x = re.sub(r'\s+(?:(?:CLASS|SERIES)\s+[A-Z0-9]+\s+)?(?:COMMON STOCK|ORDINARY SHARES?|COMMON SHARES?)\s*$', '', x)
    for a, b in [('INCORPORATED', 'INC'), ('CORPORATION', 'CORP'), ('LIMITED', 'LTD'), ('COMPANY', 'CO')]:
        x = re.sub(r'\b' + a + r'\b', b, x)
    return ' '.join(re.findall(r'[A-Z0-9]+', x))

current = m.ticker_to_cik()
eligible = set(m.ticker_universe(0))
conn = m.get_db_connection_dict()
try:
    cur = conn.cursor()
    cur.execute('SELECT upper(trim("Ticker")) AS ticker, "Company Name" AS name, "Market Cap" AS cap FROM public.stocks ORDER BY "Market Cap" DESC NULLS LAST')
    stocks = cur.fetchall()
finally:
    conn.close()
missing = []
seen = set()
for r in stocks:
    t = r['ticker']
    if t in eligible and t not in seen and not (current.get(t) or current.get(t.replace('.', '-'))):
        seen.add(t)
        missing.append(r)
print(f'[DISCOVERY] Loading SEC historical filer-name index for {len(missing)} unmapped tickers...', flush=True)
resp = requests.get(URL, headers=m.HEADERS, timeout=120)
resp.raise_for_status()
by_name = defaultdict(set)
by_compact = defaultdict(set)
for line in resp.content.decode('latin-1').splitlines():
    parts = line.rstrip(':').rsplit(':', 1)
    if len(parts) != 2 or not parts[1].strip().isdigit():
        continue
    k = norm(parts[0])
    if k:
        c = str(int(parts[1])).zfill(10)
        by_name[k].add(c)
        by_compact[k.replace(' ', '')].add(c)

output = []
for r in missing:
    key = norm(r['name'])
    hits = by_name.get(key, set())
    rule = 'EXACT_NORMALIZED_NAME'
    if not hits:
        hits = by_compact.get(key.replace(' ', ''), set())
        rule = 'SPACE_ONLY_MATCH' if hits else 'NO_MATCH'
    status = ('CANDIDATE_REQUIRES_REVIEW' if len(hits) == 1
              else 'AMBIGUOUS' if hits else 'UNRESOLVED')
    output.append({'ticker': r['ticker'], 'company_name': r['name'],
                   'market_cap': r['cap'], 'status': status,
                   'matching_rule': rule, 'candidate_ciks': ';'.join(sorted(hits))})

path = os.path.abspath('insider_cik_recovery_candidates.csv')
with open(path, 'w', newline='', encoding='utf-8-sig') as f:
    writer = csv.DictWriter(f, fieldnames=list(output[0]) if output else ['ticker','company_name','market_cap','status','matching_rule','candidate_ciks'])
    writer.writeheader()
    writer.writerows(output)
counts = Counter(r['status'] for r in output)
print(f'[CIK DISCOVERY SUMMARY] missing={len(missing)} unique_candidates={counts["CANDIDATE_REQUIRES_REVIEW"]} ambiguous={counts["AMBIGUOUS"]} unresolved={counts["UNRESOLVED"]}')
for r in [r for r in output if r['status'] == 'CANDIDATE_REQUIRES_REVIEW'][:25]:
    print(f'[CANDIDATE] {r["ticker"]} -> {r["candidate_ciks"]} ({r["matching_rule"]})')
print('[CSV SAVED]', path)
print('No changes were made to Supabase or insider transaction tables.')