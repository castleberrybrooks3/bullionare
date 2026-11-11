"""Audit actual SEC Form 4 non-derivative P/A and S/D lots vs Supabase.

Never inserts or deletes insider transaction rows. Results are stored only in
insider_form4_accuracy_audit after you run the migration SQL.

SEC metadata from actual filing XML: checks issuer CIK, non-derivative P/S
row counts, direction contradictions, filing-level Rule 10b5-1 and tax references.
The latter are textual FILING references, not established motives of each lot.

Usage in PowerShell (start with small live sample):
    $env:INSIDER_AUDIT_DRY_RUN="1"
    $env:INSIDER_AUDIT_TICKERS="GME,CRWD,DELL"
    $env:INSIDER_AUDIT_LIMIT="20"
    python insider_form4_accuracy_auditor.py
Then set DRY_RUN=0 to store results. A repeat skips MATCHED records.

Targeted review options:
  INSIDER_AUDIT_ACCESSIONS="0001193125-26-272862,0001193125-26-272808"
  INSIDER_AUDIT_RECHECK="1"  # also re-audit filings ALREADY marked MATCHED
  INSIDER_AUDIT_DRY_RUN="1"  # do not overwrite saved statuses

This audit compares SEC Form 4 XML lots with all stored transaction rows for
each accession, including other ticker classes. It does not delete trades.
"""
import os
import re
from collections import Counter
from decimal import Decimal, InvalidOperation
from datetime import datetime, timezone
from xml.etree import ElementTree as ET
from db import get_db_connection_dict

# Reuse the importer SEC rate limit, retries and XML parser. It is import-safe:
# importer.main() runs only when executed as a script.
from insider_transactions_incremental import fetch, parse_ownership_xml, txt, cik_norm, ticker_to_cik


def env_flag(name, default=False):
    return os.getenv(name, '1' if default else '0').lower().strip() in ('1', 'true', 'yes')


def get_batch(conn, tickers, limit, recheck, accessions=None):
    cur = conn.cursor()
    cur.execute('''
        SELECT t.accession_number, MAX(t.filing_url) AS filing_url,
               array_agg(DISTINCT upper(t.ticker)) AS tickers,
               COUNT(*) FILTER (WHERE t.transaction_code = 'P')::int AS db_buys,
               COUNT(*) FILTER (WHERE t.transaction_code = 'S')::int AS db_sells
        FROM public.insider_transactions t
        LEFT JOIN public.insider_form4_accuracy_audit a
          ON a.accession_number = t.accession_number
        WHERE t.accession_number IS NOT NULL AND t.filing_url IS NOT NULL
          AND t.transaction_code IN ('P','S')
          -- Select filings by the requested ticker, but audit ALL lots in
          -- the selected filing (including other share classes). Otherwise a
          -- jointly reported UAA/UA Form 4 appears falsely incomplete.
          AND (%s IS NULL OR EXISTS (
              SELECT 1 FROM public.insider_transactions x
              WHERE x.accession_number = t.accession_number
                AND upper(x.ticker) = ANY(%s)
          ))
          -- Explicit accession filter for targeted reviews.
          AND (%s IS NULL OR t.accession_number = ANY(%s))
          -- Recheck=True must include even PREVIOUSLY MATCHED accessions.
          AND (%s OR a.accession_number IS NULL)
        GROUP BY t.accession_number
        ORDER BY MAX(t.filing_date) DESC NULLS LAST, t.accession_number
        LIMIT %s
    ''', (tickers, tickers, accessions, accessions, recheck, limit))
    return cur.fetchall()


def lot_key(code, day, security_title, shares, price):
    def number(value):
        if value is None or str(value).strip() == '':
            return None
        try:
            # Decimal canonicalization ignores trailing zeros, not genuine cents.
            return Decimal(str(value).replace(',', '')).normalize()
        except InvalidOperation:
            return 'INVALID_NUMBER'
    clean_security = re.sub(r'\s+', ' ', str(security_title or '')).strip().casefold()
    return (code, str(day or '')[:10], clean_security, number(shares), number(price))


def get_db_lots(conn, accession):
    cur = conn.cursor()
    cur.execute('''
        SELECT transaction_code, transaction_date, security_title, shares, price
        FROM public.insider_transactions
        WHERE accession_number = %s AND transaction_code IN ('P','S')
    ''', (accession,))
    return Counter(lot_key(row['transaction_code'], row['transaction_date'],
                           row['security_title'], row['shares'], row['price'])
                   for row in cur.fetchall())


def summarize_xml(data):
    root = parse_ownership_xml(data)
    issuer = txt(root, './issuer/issuerCik')
    if not issuer:
        raise ValueError('Missing SEC issuerCik; audit not trustworthy')
    buys = sells = conflicts = 0
    source_lots = Counter()
    for tx in root.findall('.//nonDerivativeTransaction'):
        code = txt(tx, './transactionCoding/transactionCode').upper()
        if code not in ('P', 'S'):
            continue
        direction = txt(tx, './transactionAmounts/transactionAcquiredDisposedCode/value').upper()
        expected = 'A' if code == 'P' else 'D'
        if direction != expected:
            conflicts += 1
            continue
        source_lots[lot_key(code, txt(tx, './transactionDate/value'),
                            txt(tx, './securityTitle/value'),
                            txt(tx, './transactionAmounts/transactionShares/value'),
                            txt(tx, './transactionAmounts/transactionPricePerShare/value'))] += 1
        if code == 'P':
            buys += 1
        else:
            sells += 1
    # Important: these are DOCUMENT level references, not proof every transaction
    # in a filing was executed under a plan or made for tax withholding.
    footnote_text = ' '.join((e.text or '') for e in root.findall('.//footnotes/footnote'))
    remarks = txt(root, './remarks')
    notes = (footnote_text + ' ' + remarks).lower()
    checkbox = txt(root, './aff10b5One').strip().lower() in ('1','true','yes')
    plan_ref = bool(checkbox or re.search(r'(?:rule\s*)?10b5[-‐‑–]?1', notes))
    tax_ref = bool(re.search(r'(?:tax[- ]withhold|withhold.{0,55}tax|tax.{0,55}withhold|cover.{0,40}tax)', notes))
    return {'issuer_cik': cik_norm(issuer), 'buys': buys, 'sells': sells,
            'conflicts': conflicts, 'plan_ref': plan_ref, 'tax_ref': tax_ref,
            'source_lots': source_lots}


def audit_one(item, cik_map, stored_lots):
    url = str(item['filing_url'])
    if not url.startswith('https://www.sec.gov/Archives/edgar/data/'):
        raise ValueError('Untrusted or non-SEC filing_url; verify source before audit')
    res = fetch(url)
    res.raise_for_status()
    info = summarize_xml(res.content)
    saved_buys = int(item['db_buys'])
    saved_sells = int(item['db_sells'])
    expected_ciks = {cik_norm(found) for symbol in item['tickers']
                     for found in [cik_map.get(symbol) or cik_map.get(symbol.replace('.', '-'))]
                     if found}
    # SEC-confirmed XOM redomiciliation effective 2026-07-01. Historical
    # XOM Form 4s can correctly identify the original 34088 registrant,
    # while later filings use successor 2115436. Every other ticker stays
    # under its own issuer's exact current CIK.
    allowed_historical = {'XOM': {'34088', '2115436'}}
    ticker_symbols = {str(symbol).upper() for symbol in item['tickers']}
    if ticker_symbols == {'XOM'}:
        allowed_ciks = allowed_historical['XOM']
        issuer_disagrees = info['issuer_cik'] not in allowed_ciks
    else:
        issuer_disagrees = (not expected_ciks or expected_ciks != {info['issuer_cik']})
    lot_detail_match = info['source_lots'] == stored_lots
    status = ('REVIEW_CIK' if issuer_disagrees else
              'REVIEW_DIRECTION' if info['conflicts'] else
              'MATCHED' if info['buys'] == saved_buys and info['sells'] == saved_sells
                 and lot_detail_match else 'MISMATCH')
    return {**info, 'status': status, 'lot_detail_match': lot_detail_match,
            'saved_buys': saved_buys,
            'saved_sells': saved_sells, 'accession': item['accession_number'],
            'filing_url': url}


def persist(conn, result):
    cur = conn.cursor()
    cur.execute('''
        INSERT INTO public.insider_form4_accuracy_audit (
            accession_number, issuer_cik, filing_url, sec_purchase_lots,
            sec_sale_lots, sec_direction_conflicts, stored_purchase_lots,
            stored_sale_lots, audit_status, lot_detail_match, has_10b5_1_reference,
            has_tax_withholding_reference, audited_at
        ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,now())
        ON CONFLICT (accession_number) DO UPDATE SET
          issuer_cik = EXCLUDED.issuer_cik,
          filing_url = EXCLUDED.filing_url,
          sec_purchase_lots = EXCLUDED.sec_purchase_lots,
          sec_sale_lots = EXCLUDED.sec_sale_lots,
          sec_direction_conflicts = EXCLUDED.sec_direction_conflicts,
          stored_purchase_lots = EXCLUDED.stored_purchase_lots,
          stored_sale_lots = EXCLUDED.stored_sale_lots,
          audit_status = EXCLUDED.audit_status,
          lot_detail_match = EXCLUDED.lot_detail_match,
          has_10b5_1_reference = EXCLUDED.has_10b5_1_reference,
          has_tax_withholding_reference = EXCLUDED.has_tax_withholding_reference,
          audited_at = now()
    ''', (result['accession'], result['issuer_cik'], result['filing_url'],
          result['buys'], result['sells'], result['conflicts'],
          result['saved_buys'], result['saved_sells'], result['status'],
          result['lot_detail_match'], result['plan_ref'], result['tax_ref']))
    conn.commit()


def main():
    dry = env_flag('INSIDER_AUDIT_DRY_RUN', True)
    recheck = env_flag('INSIDER_AUDIT_RECHECK', False)
    limit = int(os.getenv('INSIDER_AUDIT_LIMIT', '25'))
    if not 1 <= limit <= 1000:
        raise ValueError('INSIDER_AUDIT_LIMIT must be 1–1000')
    tickers_str = os.getenv('INSIDER_AUDIT_TICKERS', '').strip()
    tickers = [v.strip().upper() for v in tickers_str.split(',') if v.strip()] or None
    accessions_str = os.getenv('INSIDER_AUDIT_ACCESSIONS', '').strip()
    accessions = [v.strip() for v in accessions_str.split(',') if v.strip()] or None
    if accessions and any(not re.fullmatch(r'\d{10}-\d{2}-\d{6}', value) for value in accessions):
        raise ValueError('INSIDER_AUDIT_ACCESSIONS must be a comma-separated list of SEC accession numbers')
    conn = get_db_connection_dict()
    totals = {'MATCHED': 0, 'MISMATCH': 0, 'REVIEW_DIRECTION': 0, 'REVIEW_CIK': 0, 'FAILED': 0}
    try:
        items = get_batch(conn, tickers, limit, recheck, accessions)
        cik_map = ticker_to_cik()
        print(f'[AUDIT CONFIG] dry_run={dry} tickers={tickers or "ALL"} '
              f'filings={len(items)} recheck={recheck} '
              f'target_accessions={len(accessions) if accessions else "ALL"}', flush=True)
        for index, item in enumerate(items, 1):
            try:
                r = audit_one(item, cik_map, get_db_lots(conn, item['accession_number']))
                totals[r['status']] += 1
                print(f'[{index}/{len(items)}] {r["status"]} '
                      f'acc={r["accession"]} SEC(P/S)={r["buys"]}/{r["sells"]} '
                      f'DB(P/S)={r["saved_buys"]}/{r["saved_sells"]} '
                      f'lot_details_match={r["lot_detail_match"]} '
                      f'direction_conflicts={r["conflicts"]} '
                      f'10b5_reference={r["plan_ref"]} tax_reference={r["tax_ref"]}', flush=True)
                if not dry:
                    persist(conn, r)
            except Exception as error:
                totals['FAILED'] += 1
                print(f'[{index}/{len(items)}] [AUDIT FAILED] {item["accession_number"]}: '
                      f'{type(error).__name__}: {error}', flush=True)
        print(f'[AUDIT SUMMARY] {totals} dry_run={dry}', flush=True)
    finally:
        conn.close()
    return 1 if totals['FAILED'] else 0


if __name__ == '__main__':
    raise SystemExit(main())