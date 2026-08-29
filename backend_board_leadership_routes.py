from __future__ import annotations

from typing import Any, Dict

from fastapi import APIRouter, HTTPException

from db import get_db_connection_dict


router = APIRouter(prefix="/api/smart-money", tags=["Smart Money"])


def row_to_payload(row: Dict[str, Any]) -> Dict[str, Any]:
    if not row:
        raise HTTPException(
            status_code=404,
            detail="Leadership profile row was empty.",
        )

    members = row.get("members")
    if not isinstance(members, list):
        members = []

    board_member_count = sum(
        1
        for member in members
        if member.get("isDirector") is True
        or member.get("seatType") == "Board Director"
    )
    executive_count = sum(
        1 for member in members if member.get("seatType") == "Executive"
    )

    return {
        "ticker": row.get("ticker"),
        "cik": row.get("cik"),
        "company": row.get("company"),
        "governanceSummary": row.get("governance_summary"),
        "dataStatus": row.get("data_status"),
        "dataQualityScore": row.get("data_quality_score"),
        "memberCount": len(members),
        "boardMemberCount": board_member_count,
        "executiveCount": executive_count,
        "sourceForm": row.get("source_form"),
        "sourceFilingDate": (
            row["source_filing_date"].isoformat()
            if row.get("source_filing_date")
            else None
        ),
        "sourceAccession": row.get("source_accession"),
        "sourceUrl": row.get("source_url"),
        "secCompanyUrl": row.get("sec_company_url"),
        "members": members,
        "rawNotes": row.get("raw_notes") or {},
        "updatedAt": (
            row["updated_at"].isoformat() if row.get("updated_at") else None
        ),
    }


@router.get("/leadership/{ticker_or_company}")
def get_board_leadership(ticker_or_company: str):
    query = (ticker_or_company or "").strip()
    if not query:
        raise HTTPException(
            status_code=400,
            detail="Ticker or company is required.",
        )

    with get_db_connection_dict() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                  ticker,
                  cik,
                  company,
                  governance_summary,
                  data_status,
                  data_quality_score,
                  member_count,
                  board_member_count,
                  executive_count,
                  source_form,
                  source_filing_date,
                  source_accession,
                  source_url,
                  sec_company_url,
                  members,
                  raw_notes,
                  updated_at
                FROM public.board_leadership_profiles
                WHERE upper(ticker) = upper(%s)
                   OR company ILIKE %s
                ORDER BY
                  CASE WHEN upper(ticker) = upper(%s) THEN 0 ELSE 1 END,
                  data_quality_score DESC,
                  updated_at DESC
                LIMIT 1
                """,
                (query, f"%{query}%", query),
            )
            row = cur.fetchone()

    if not row:
        raise HTTPException(
            status_code=404,
            detail=(
                "No board and leadership profile found yet. "
                "Run update_board_leadership.py for this ticker first."
            ),
        )

    return row_to_payload(row)