"""Smart unified search: fuzzy pg_trgm DB search + external registries."""
from __future__ import annotations

from typing import Optional
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, func, text

from ...core.database import get_db
from ...core.dependencies import get_current_user
from ...models.user import User
from ...models.construction_object import ConstructionObject
from ...models.company import Company
from ...schemas.objects import ConstructionObjectListSchema
from ...schemas.companies import CompanySchema
from ...services import edrpou as edrpou_svc
from ...services import osm as osm_svc

router = APIRouter(prefix="/smart-search", tags=["smart-search"])

SIMILARITY_THRESHOLD = 0.15  # pg_trgm threshold (0-1); lower = more permissive


# ── Helper: build fuzzy WHERE clause for a column ────────────────────────────

def _fuzzy_where(column, terms: list[str]):
    """Match column against multiple query terms using ILIKE + trigram similarity."""
    clauses = []
    for t in terms:
        like = f"%{t}%"
        clauses.append(column.ilike(like))
        # trigram similarity: requires pg_trgm extension (already enabled)
        clauses.append(func.similarity(func.lower(column), t.lower()) > SIMILARITY_THRESHOLD)
    return or_(*clauses)


# ── Objects ──────────────────────────────────────────────────────────────────

class ObjectResult(BaseModel):
    id: str
    name: str
    address: Optional[str] = None
    city: Optional[str] = None
    oblast: Optional[str] = None
    status: str
    category: Optional[str] = None
    source: str
    ai_score: Optional[float] = None
    score: float = 0.0  # relevance score

    model_config = {"from_attributes": True}


async def search_objects(db: AsyncSession, terms: list[str], limit: int = 12) -> list[ObjectResult]:
    q = select(
        ConstructionObject.id,
        ConstructionObject.name,
        ConstructionObject.address,
        ConstructionObject.city,
        ConstructionObject.oblast,
        ConstructionObject.status,
        ConstructionObject.category,
        ConstructionObject.source,
        ConstructionObject.ai_score,
        # best similarity across terms as score
        func.greatest(
            *[func.similarity(func.lower(ConstructionObject.name), t.lower()) for t in terms]
        ).label("score"),
    ).where(
        or_(
            _fuzzy_where(ConstructionObject.name, terms),
            _fuzzy_where(ConstructionObject.address, terms),
            _fuzzy_where(ConstructionObject.city, terms),
        )
    ).order_by(text("score DESC")).limit(limit)

    result = await db.execute(q)
    rows = result.mappings().all()
    return [ObjectResult(
        id=str(r["id"]),
        name=r["name"],
        address=r["address"],
        city=r["city"],
        oblast=r["oblast"],
        status=r["status"],
        category=r["category"],
        source=r["source"],
        ai_score=r["ai_score"],
        score=float(r["score"] or 0),
    ) for r in rows]


# ── Companies ────────────────────────────────────────────────────────────────

class CompanyResult(BaseModel):
    id: str
    name: str
    edrpou: Optional[str] = None
    type: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    objects_count: int = 0
    ai_score: Optional[float] = None
    score: float = 0.0

    model_config = {"from_attributes": True}


async def search_companies_db(db: AsyncSession, terms: list[str], limit: int = 10) -> list[CompanyResult]:
    q = select(
        Company.id,
        Company.name,
        Company.edrpou,
        Company.type,
        Company.address,
        Company.phone,
        Company.objects_count,
        Company.ai_score,
        func.greatest(
            *[func.similarity(func.lower(Company.name), t.lower()) for t in terms]
        ).label("score"),
    ).where(
        or_(
            _fuzzy_where(Company.name, terms),
            _fuzzy_where(Company.edrpou, terms),
            _fuzzy_where(Company.address, terms),
        )
    ).order_by(text("score DESC")).limit(limit)

    result = await db.execute(q)
    rows = result.mappings().all()
    return [CompanyResult(
        id=str(r["id"]),
        name=r["name"],
        edrpou=r["edrpou"],
        type=str(r["type"]) if r["type"] else None,
        address=r["address"],
        phone=r["phone"],
        objects_count=r["objects_count"] or 0,
        ai_score=r["ai_score"],
        score=float(r["score"] or 0),
    ) for r in rows]


# ── Response models ──────────────────────────────────────────────────────────

class ExternalCompany(BaseModel):
    name: str
    edrpou: str
    address: Optional[str] = None
    status: Optional[str] = None
    type: Optional[str] = None


class ExternalPlace(BaseModel):
    name: str
    address: str
    lat: Optional[float] = None
    lng: Optional[float] = None
    city: Optional[str] = None
    oblast: Optional[str] = None
    osm_id: Optional[str] = None


class SmartSearchResponse(BaseModel):
    query_used: str
    objects: list[ObjectResult]
    companies: list[CompanyResult]
    external_companies: list[ExternalCompany]
    external_places: list[ExternalPlace]


# ── Main endpoint ─────────────────────────────────────────────────────────────

@router.get("", response_model=SmartSearchResponse)
async def smart_search(
    q: str = Query(..., min_length=2, description="Пошуковий запит (будь-яка мова/розкладка)"),
    variants: list[str] = Query(default=[], description="Нормалізовані варіанти запиту"),
    include_external: bool = Query(True, description="Шукати в зовнішніх реєстрах (ЄДРПОУ, OSM)"),
    limit: int = Query(10, ge=1, le=30),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    # Build the full list of terms to search: original + normalised variants
    all_terms: list[str] = list({q.strip(), *(v.strip() for v in variants if v.strip())})
    # Use the first variant as the "displayed" query (normalised wins)
    query_used = variants[0] if variants else q

    # Parallel DB searches
    import asyncio
    objects, companies = await asyncio.gather(
        search_objects(db, all_terms, limit),
        search_companies_db(db, all_terms, limit),
    )

    # External searches (only if key configured + user requested)
    external_companies: list[ExternalCompany] = []
    external_places: list[ExternalPlace] = []

    if include_external:
        try:
            edrpou_results = await edrpou_svc.search_companies(query_used, limit=5)
            external_companies = [
                ExternalCompany(
                    name=r.get("name", ""),
                    edrpou=str(r.get("edrpou", "")),
                    address=r.get("address"),
                    status=r.get("status"),
                    type=r.get("type"),
                )
                for r in edrpou_results if r.get("name")
            ]
        except Exception:
            pass

        try:
            osm_results = await osm_svc.search_places(query_used, limit=5)
            external_places = [
                ExternalPlace(
                    name=r.get("name", r.get("display_name", "")),
                    address=r.get("display_name", ""),
                    lat=r.get("lat"),
                    lng=r.get("lng"),
                    city=r.get("city"),
                    oblast=r.get("oblast"),
                    osm_id=str(r.get("osm_id", "")),
                )
                for r in osm_results if r.get("display_name")
            ]
        except Exception:
            pass

    return SmartSearchResponse(
        query_used=query_used,
        objects=objects,
        companies=companies,
        external_companies=external_companies,
        external_places=external_places,
    )
