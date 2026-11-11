"""Bullionaire Smart Money grouped Form 4 transaction-event feed.

Read-only: this route never changes insider_transactions or SEC ingestion receipts.
A reported event is one issuer/ticker + accession + reporting owner + trade day +
security class + P/S transaction code. This consolidates execution price lots within
one filing; it does NOT infer that different reporting-owner filings describe distinct
underlying economic sales. Beneficial-ownership overlap must be assessed separately.
"""

import re
from typing import Optional
from fastapi import APIRouter, HTTPException, Query
from db import get_db_connection_dict

router = APIRouter()
PAGE_SIZE = 50

# Conservative PUBLIC-FEED eligibility gate. Never deletes or modifies source rows.
# Keeps unverified/missing prices OUT of ranked P/S signals, rather than guessing.
# Valid high-price BRK.A shares receive a separate ceiling. Some genuine trades
# will be withheld for later SEC review; passing this gate is NOT SEC verification.
# Keep every insider feed (ticker, events, market leaders) on the SAME predicate.
INSIDER_PUBLIC_SIGNAL_WHERE = """
    t.transaction_code IN ('P', 'S')
    AND COALESCE(t.is_derivative, FALSE) = FALSE
    AND t.shares IS NOT NULL AND t.shares > 0
    AND t.price IS NOT NULL AND t.price > 0
    AND t.value IS NOT NULL AND t.value > 0
    AND (
        (UPPER(t.ticker) = 'BRK.A' AND t.price <= 1000000)
        OR (UPPER(t.ticker) <> 'BRK.A' AND t.price <= 10000)
    )
    -- The SEC audit uncovered mislabelled aggregate prices in these tickers.
    -- These conservative cutoffs block future unexplained regressions there.
    AND NOT (UPPER(t.ticker) IN ('IHT', 'SBLK', 'STNG', 'URBN') AND t.price > 1000)
    AND t.value <= 50000000000
    AND ABS(t.value - t.shares * t.price)
        <= GREATEST(0.05, ABS(t.shares * t.price) * 0.000001)
    AND t.accession_number ~ '^[0-9]{10}-[0-9]{2}-[0-9]{6}$'
    AND LOWER(COALESCE(t.filing_url, ''))
        LIKE 'https://www.sec.gov/archives/edgar/data/%%'
    -- Known false/replaced filings, even if a future raw import changes price.
    AND t.accession_number NOT IN (
        '0001104659-26-112844', -- SLBT related-party transfer
        '0002105585-26-000003', -- QUCY superseded by Form 4/A
        '0001140361-26-037010', -- FANG duplicate economic sale (retain 037009)
        '0001104659-26-023624'  -- NRG overlapping owner filing (retain 023625)
    )
    -- Overlapping beneficial-owner filings can describe the SAME economic lot.
    -- Keep all SEC records in the DB; publish just one representative filing
    -- for an unusually strong exact-match fingerprint (distinct accessions).
    -- Do not infer duplication if post-trade holdings or class are unavailable.
    AND NOT EXISTS (
        SELECT 1
        FROM public.insider_transactions AS peer
        WHERE peer.ticker = t.ticker
          AND peer.transaction_code = t.transaction_code
          AND peer.transaction_date = t.transaction_date
          AND peer.shares = t.shares
          AND peer.price = t.price
          AND t.shares_owned_following IS NOT NULL
          AND peer.shares_owned_following = t.shares_owned_following
          AND NULLIF(BTRIM(t.security_title), '') IS NOT NULL
          AND UPPER(BTRIM(peer.security_title)) = UPPER(BTRIM(t.security_title))
          AND peer.accession_number < t.accession_number
          AND peer.accession_number ~ '^[0-9]{10}-[0-9]{2}-[0-9]{6}$'
          AND peer.accession_number NOT IN (
              '0001104659-26-112844', '0002105585-26-000003',
              '0001140361-26-037010', '0001104659-26-023624'
          )
          AND COALESCE(peer.is_derivative, FALSE) = FALSE
          AND peer.value IS NOT NULL AND peer.value > 0
          AND peer.value <= 50000000000
          AND ABS(peer.value - peer.shares * peer.price)
              <= GREATEST(0.05, ABS(peer.shares * peer.price) * 0.000001)
          AND LOWER(COALESCE(peer.filing_url, ''))
              LIKE 'https://www.sec.gov/archives/edgar/data/%%'
    )
"""


@router.get("/smart-money/events/{ticker}")
def get_smart_money_events(
    ticker: str,
    mode: str = Query("recent"),
    signal: str = Query("all"),
    days: Optional[int] = Query(None, ge=1, le=3650),
    page: int = Query(1, ge=1, le=10000),
):
    """Rank *all* stored P/S events server-side, then return one page of 50.

    - recent: latest transaction dates first; optional days filter
    - largest: largest fully-disclosed aggregated event values first; optional days
    - days=None means no date cutoff (the entire stored transaction history)
    - returned value is NULL if any lot in an event has an undisclosed value

    Does not fetch from the SEC, alter checkpoints, or cap stored trade data.
    """
    mode = mode.strip().lower()
    signal = signal.strip().lower()
    if mode not in {"recent", "largest"} or signal not in {"all", "bullish", "bearish"}:
        raise HTTPException(status_code=400, detail="Invalid ranking mode or transaction direction")
    clean_ticker = ticker.strip().upper()
    if not re.fullmatch(r"[A-Z0-9][A-Z0-9.\-]{0,19}", clean_ticker):
        raise HTTPException(status_code=400, detail="Invalid ticker symbol")

    where_parts = [
        "t.ticker = %s",
        INSIDER_PUBLIC_SIGNAL_WHERE,
    ]
    params = [clean_ticker]
    if signal == "bullish":
        where_parts.append("transaction_code = 'P'")
    elif signal == "bearish":
        where_parts.append("transaction_code = 'S'")
    if days is not None:
        where_parts.append("transaction_date >= CURRENT_DATE - %s")
        params.append(days)

    # SQL sorts over the complete filtered history BEFORE limiting/paginating.
    # Preserve missing amounts as NULL rather than presenting partial sums as full trades.
    order_sql = (
        "event_value DESC NULLS LAST, event_date DESC NULLS LAST, filing_date DESC NULLS LAST, event_key"
        if mode == "largest"
        else "event_date DESC NULLS LAST, filing_date DESC NULLS LAST, event_value DESC NULLS LAST, event_key"
    )
    sql = f"""
      WITH relevant AS (
        SELECT
          id, ticker, company, insider, title, transaction_code,
          security_title, shares, price, value, transaction_date, filing_date,
          shares_owned_following, accession_number, filing_url,
          COALESCE(NULLIF(accession_number, ''), 'row-' || id::text) AS accession_key
        FROM public.insider_transactions AS t
        WHERE {' AND '.join(where_parts)}
      ),
      grouped AS (
        SELECT
          ticker,
          MAX(company) AS company,
          insider,
          MAX(title) AS title,
          transaction_code,
          security_title,
          accession_key AS event_key,
          MAX(accession_number) AS accession_number,
          MAX(filing_url) AS filing_url,
          transaction_date AS event_date,
          MAX(filing_date) AS filing_date,
          COUNT(*)::int AS reported_lots,
          COUNT(*) FILTER (WHERE shares IS NULL) AS missing_shares,
          COUNT(*) FILTER (WHERE value IS NULL) AS missing_values,
          CASE
            WHEN COUNT(*) FILTER (WHERE shares IS NULL) = 0
            THEN SUM(shares)
            ELSE NULL
          END AS event_shares,
          CASE
            WHEN COUNT(*) FILTER (WHERE value IS NULL) = 0
            THEN SUM(value)
            ELSE NULL
          END AS event_value,
          CASE
            WHEN COUNT(DISTINCT shares_owned_following) = 1
            THEN MAX(shares_owned_following)
            ELSE NULL
          END AS holdings_after
        FROM relevant
        GROUP BY ticker, insider, accession_key, transaction_date,
                 transaction_code, security_title
      ),
      ranked AS (
        SELECT *,
          COUNT(*) OVER () AS total_events
        FROM grouped
        {'WHERE event_value > 0' if mode == 'largest' else ''}
        ORDER BY {order_sql}
        LIMIT %s OFFSET %s
      )
      SELECT ranked.*,
             verified_role.title AS verified_prior_role,
             verified_role.filing_date AS role_filing_date,
             audit.audit_status AS sec_audit_status,
             audit.audited_at AS sec_audited_at,
             audit.has_10b5_1_reference AS has_plan_reference,
             audit.has_tax_withholding_reference AS has_tax_reference
      FROM ranked
      -- Roles must be sourced from this filing or an EARLIER same-person,
      -- same-issuer SEC filing. A future job title must not be backdated.
      LEFT JOIN LATERAL (
          SELECT past.title, past.filing_date
          FROM public.insider_transactions past
          WHERE past.ticker = ranked.ticker
            AND upper(btrim(past.insider)) = upper(btrim(ranked.insider))
            AND past.filing_date <= ranked.filing_date
            AND past.title IS NOT NULL AND btrim(past.title) <> ''
            AND lower(btrim(past.title)) NOT IN ('insider','unknown insider')
          ORDER BY past.filing_date DESC NULLS LAST, past.id DESC
          LIMIT 1
      ) verified_role ON TRUE
      LEFT JOIN public.insider_form4_accuracy_audit audit
        ON audit.accession_number = ranked.accession_number
      ORDER BY {order_sql}
    """
    params.extend([PAGE_SIZE, (page - 1) * PAGE_SIZE])
    conn = None
    try:
        conn = get_db_connection_dict()
        cur = conn.cursor()
        cur.execute(sql, params)
        rows = cur.fetchall()
    except Exception as exc:
        print(f"[SMART MONEY EVENTS ERROR] {clean_ticker} {type(exc).__name__}: {exc}", flush=True)
        # Do not return an empty feed on DB errors: that would look like no trades.
        raise HTTPException(status_code=500, detail="Could not load insider events") from exc
    finally:
        if conn is not None:
            conn.close()

    output = []
    for row in rows:
        shares = float(row["event_shares"]) if row.get("event_shares") is not None else None
        value = float(row["event_value"]) if row.get("event_value") is not None else None
        price = value / shares if value is not None and shares and shares > 0 else None
        code = row["transaction_code"]
        raw_role = str(row.get("title") or "").strip()
        disclosed_role = raw_role and raw_role.lower() not in ("insider", "unknown insider")
        preceding_role = str(row.get("verified_prior_role") or "").strip()
        if disclosed_role:
            display_role = raw_role
            role_origin = "this_filing"
        elif preceding_role:
            display_role = "Previously reported: " + preceding_role
            role_origin = "earlier_sec_filing"
        else:
            display_role = "Not disclosed in this filing"
            role_origin = "not_disclosed"
        output.append({
            "ticker": row["ticker"],
            "company": row.get("company"),
            "insider": row.get("insider"),
            "title": display_role,
            "roleSource": role_origin,
            "roleFilingDate": (
                row["role_filing_date"].isoformat()
                if role_origin == "earlier_sec_filing" and row.get("role_filing_date") else None
            ),
            "secAuditStatus": row.get("sec_audit_status"),
            "secAuditedAt": row["sec_audited_at"].isoformat() if row.get("sec_audited_at") else None,
            # Positive disclosure tags are from the whole Form 4. They do not
            # establish that THIS grouped event was done for that reason.
            "filingMentions10b5One": row.get("has_plan_reference"),
            "filingMentionsTaxWithholding": row.get("has_tax_reference"),
            "transactionType": "Buy" if code == "P" else "Sell",
            "transactionCode": code,
            "securityTitle": row.get("security_title"),
            "shares": shares,
            "price": price,                      # share-weighted execution price
            "value": value,
            "date": row["event_date"].isoformat() if row.get("event_date") else None,
            "filingDate": row["filing_date"].isoformat() if row.get("filing_date") else None,
            "sharesOwnedFollowing": (
                float(row["holdings_after"]) if row.get("holdings_after") is not None else None
            ),
            "signal": "Bullish" if code == "P" else "Bearish",
            "accessionNumber": row.get("accession_number"),
            "filingUrl": row.get("filing_url"),
            "reportedLots": int(row["reported_lots"]),
            "valueIncomplete": bool(row.get("missing_values")),
            "sharesIncomplete": bool(row.get("missing_shares")),
        })

    total = int(rows[0]["total_events"]) if rows else 0
    return {
        "ticker": clean_ticker,
        "source": "Supabase insider_transactions (grouped SEC Form 4 lots)",
        "mode": mode,
        "signal": signal,
        "days": days,
        "page": page,
        "pageSize": PAGE_SIZE,
        "totalEvents": total,
        "hasMore": page * PAGE_SIZE < total,
        "transactions": output,
        "count": len(output),
        "grouping": "filing + reporting owner + transaction date + security class + purchase/sale",
        "caution": "Conservative public-feed validation hides rows with missing, zero or implausible prices. SEC Form 4 P/S codes are reported directions, not independently verified open-market investor intent. Exact-match overlapping owner filings are represented once; distinct or uncertain disclosures remain available in the source DB.",
    }