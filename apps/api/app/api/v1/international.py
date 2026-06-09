"""International tenders search endpoint."""
from typing import Optional
from fastapi import APIRouter, Depends, Query

from ...core.dependencies import get_current_user
from ...models.user import User
from ...services.international.base import UniversalTenderResult
from ...services.international.registry import (
    get_all_results,
    DONOR_LABELS,
    COUNTRY_LABELS,
    SECTOR_LABELS,
)

router = APIRouter(prefix="/international", tags=["international"])


@router.get("/search", response_model=list[UniversalTenderResult])
async def search_international(
    q: str = Query(""),
    limit: int = Query(50, ge=1, le=200),
    country: str = Query(""),
    donor: str = Query(""),
    sector: str = Query(""),
    relevant_only: bool = Query(False),
    deadline_from: str = Query(""),
    deadline_to: str = Query(""),
    min_budget: Optional[float] = Query(None),
    max_budget: Optional[float] = Query(None),
    _: User = Depends(get_current_user),
):
    filters = {
        "country": country,
        "donor": donor,
        "sector": sector,
        "relevant_only": relevant_only,
        "deadline_from": deadline_from,
        "deadline_to": deadline_to,
        "min_budget": min_budget,
        "max_budget": max_budget,
    }
    return await get_all_results(q or None, filters, limit)


@router.get("/meta")
async def international_meta(_: User = Depends(get_current_user)):
    """Return available filter options for the UI."""
    return {
        "donors": DONOR_LABELS,
        "countries": COUNTRY_LABELS,
        "sectors": SECTOR_LABELS,
    }


@router.get("/stats")
async def international_stats(_: User = Depends(get_current_user)):
    """Summary statistics for dashboard."""
    results = await get_all_results(None, {}, 500)
    high = sum(1 for r in results if r.priority == "high")
    medium = sum(1 for r in results if r.priority == "medium")
    low = sum(1 for r in results if r.priority == "low")
    total_budget = sum(r.amount or 0 for r in results)
    return {
        "total": len(results),
        "high_priority": high,
        "medium_priority": medium,
        "low_priority": low,
        "total_budget_usd": round(total_budget),
        "donors": sorted({r.source for r in results if r.source}),
        "countries": sorted({r.country for r in results if r.country}),
    }
