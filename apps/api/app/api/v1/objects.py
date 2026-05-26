from __future__ import annotations
import csv
import io
import uuid
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, HTTPException, Body
from pydantic import BaseModel
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_, exists, text
from sqlalchemy.orm import selectinload
from geoalchemy2.functions import ST_AsText, ST_X, ST_Y

from ...core.database import get_db
from ...core.dependencies import get_current_user
from ...core.redis import cache_get, cache_set
from ...models.user import User
from ...models.construction_object import ConstructionObject, ObjectStatus, ObjectCategory
from ...models.company import ObjectCompany
from ...models.permit import Permit
from ...models.tender import Tender
from ...models.saved_search import FavoriteObject
from ...models.ai_analysis import AIAnalysis
from ...schemas.objects import (
    ConstructionObjectListSchema,
    ConstructionObjectDetailSchema,
    PaginatedObjectsResponse,
    AISearchResponse,
    MapPointSchema,
)
from ...schemas.notes import ObjectNoteSchema
from ...schemas.ai_analysis import AIAnalysisSchema

router = APIRouter(prefix="/objects", tags=["objects"])


def build_filter_query(query, params: dict):
    """Apply filters to a SQLAlchemy query."""
    if params.get("status"):
        query = query.where(ConstructionObject.status.in_(params["status"]))
    if params.get("category"):
        query = query.where(ConstructionObject.category.in_(params["category"]))
    if params.get("city"):
        query = query.where(ConstructionObject.city.in_(params["city"]))
    if params.get("oblast"):
        query = query.where(ConstructionObject.oblast.in_(params["oblast"]))
    if params.get("min_floors"):
        query = query.where(ConstructionObject.floors >= params["min_floors"])
    if params.get("max_floors"):
        query = query.where(ConstructionObject.floors <= params["max_floors"])
    if params.get("min_area"):
        query = query.where(ConstructionObject.building_area >= params["min_area"])
    if params.get("max_area"):
        query = query.where(ConstructionObject.building_area <= params["max_area"])
    if params.get("min_ai_score"):
        query = query.where(ConstructionObject.ai_score >= params["min_ai_score"])
    if params.get("search"):
        search_term = f"%{params['search']}%"
        query = query.where(
            or_(
                ConstructionObject.name.ilike(search_term),
                ConstructionObject.address.ilike(search_term),
                ConstructionObject.city.ilike(search_term),
                ConstructionObject.description.ilike(search_term),
            )
        )
    if params.get("has_tenders") is True:
        query = query.where(
            exists(select(Tender.id).where(Tender.object_id == ConstructionObject.id))
        )
    elif params.get("has_tenders") is False:
        query = query.where(
            ~exists(select(Tender.id).where(Tender.object_id == ConstructionObject.id))
        )
    if params.get("has_permits") is True:
        query = query.where(
            exists(select(Permit.id).where(Permit.object_id == ConstructionObject.id))
        )
    elif params.get("has_permits") is False:
        query = query.where(
            ~exists(select(Permit.id).where(Permit.object_id == ConstructionObject.id))
        )
    if params.get("date_from"):
        query = query.where(ConstructionObject.created_at >= params["date_from"])
    if params.get("date_to"):
        query = query.where(ConstructionObject.created_at <= params["date_to"])
    return query


@router.get("", response_model=PaginatedObjectsResponse)
async def list_objects(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    status: Optional[List[ObjectStatus]] = Query(None),
    category: Optional[List[ObjectCategory]] = Query(None),
    city: Optional[List[str]] = Query(None),
    oblast: Optional[List[str]] = Query(None),
    search: Optional[str] = Query(None),
    min_floors: Optional[int] = Query(None),
    max_floors: Optional[int] = Query(None),
    min_area: Optional[float] = Query(None),
    max_area: Optional[float] = Query(None),
    min_ai_score: Optional[float] = Query(None),
    has_tenders: Optional[bool] = Query(None),
    has_permits: Optional[bool] = Query(None),
    sort_by: str = Query("updated_at"),
    sort_order: str = Query("desc"),
    page: int = Query(1, ge=1),
    page_size: int = Query(24, ge=1, le=100),
):
    params = {
        "status": status, "category": category, "city": city, "oblast": oblast,
        "search": search, "min_floors": min_floors, "max_floors": max_floors,
        "min_area": min_area, "max_area": max_area, "min_ai_score": min_ai_score,
        "has_tenders": has_tenders, "has_permits": has_permits,
    }

    base_query = select(ConstructionObject)
    base_query = build_filter_query(base_query, params)

    # Count
    count_query = select(func.count()).select_from(base_query.subquery())
    total = await db.scalar(count_query)

    # Sort
    allowed_sort = {"updated_at", "created_at", "ai_score", "name", "city"}
    sort_column = getattr(ConstructionObject, sort_by if sort_by in allowed_sort else "updated_at")
    if sort_order == "asc":
        base_query = base_query.order_by(sort_column.asc())
    else:
        base_query = base_query.order_by(sort_column.desc().nullslast())

    # Paginate
    offset = (page - 1) * page_size
    base_query = base_query.offset(offset).limit(page_size)

    result = await db.execute(base_query)
    objects = result.scalars().all()

    return PaginatedObjectsResponse(
        items=[ConstructionObjectListSchema.model_validate(o) for o in objects],
        total=total or 0,
        page=page,
        page_size=page_size,
        pages=max(1, -(-total // page_size)) if total else 0,
    )


@router.get("/map-points", response_model=List[MapPointSchema])
async def get_map_points(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    status: Optional[List[ObjectStatus]] = Query(None),
    category: Optional[List[ObjectCategory]] = Query(None),
    oblast: Optional[List[str]] = Query(None),
):
    cache_key = f"map_points:{status}:{category}:{oblast}"
    cached = await cache_get(cache_key)
    if cached:
        return cached

    query = select(
        ConstructionObject.id,
        ConstructionObject.name,
        ConstructionObject.status,
        ST_Y(ConstructionObject.coordinates).label("lat"),
        ST_X(ConstructionObject.coordinates).label("lng"),
    ).where(ConstructionObject.coordinates.isnot(None))

    params = {"status": status, "category": category, "oblast": oblast}
    query = build_filter_query(query, params)
    query = query.limit(50000)

    result = await db.execute(query)
    rows = result.mappings().all()

    points = [
        {"id": str(r["id"]), "name": r["name"], "status": r["status"],
         "lat": float(r["lat"]), "lng": float(r["lng"])}
        for r in rows if r["lat"] and r["lng"]
    ]

    await cache_set(cache_key, points, ttl=300)
    return points


@router.get("/favorites", response_model=PaginatedObjectsResponse)
async def get_favorites(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    page: int = Query(1, ge=1),
    page_size: int = Query(24, ge=1, le=100),
):
    query = (
        select(ConstructionObject)
        .join(FavoriteObject, FavoriteObject.object_id == ConstructionObject.id)
        .where(FavoriteObject.user_id == current_user.id)
        .order_by(FavoriteObject.created_at.desc())
    )

    total = await db.scalar(select(func.count()).select_from(query.subquery()))
    result = await db.execute(query.offset((page - 1) * page_size).limit(page_size))
    objects = result.scalars().all()

    return PaginatedObjectsResponse(
        items=[ConstructionObjectListSchema.model_validate(o) for o in objects],
        total=total or 0, page=page, page_size=page_size,
        pages=max(1, -(-total // page_size)) if total else 0,
    )


@router.get("/search", response_model=PaginatedObjectsResponse)
async def search_objects(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    q: str = Query(..., min_length=2),
    page: int = Query(1, ge=1),
    page_size: int = Query(24, ge=1, le=100),
):
    search_term = f"%{q}%"
    query = select(ConstructionObject).where(
        or_(
            ConstructionObject.name.ilike(search_term),
            ConstructionObject.address.ilike(search_term),
            ConstructionObject.city.ilike(search_term),
            ConstructionObject.description.ilike(search_term),
        )
    ).order_by(ConstructionObject.updated_at.desc())

    total = await db.scalar(select(func.count()).select_from(query.subquery()))
    result = await db.execute(query.offset((page - 1) * page_size).limit(page_size))
    objects = result.scalars().all()

    return PaginatedObjectsResponse(
        items=[ConstructionObjectListSchema.model_validate(o) for o in objects],
        total=total or 0, page=page, page_size=page_size,
        pages=max(1, -(-total // page_size)) if total else 0,
    )


class AISearchRequest(BaseModel):
    query: str


@router.post("/ai-search", response_model=AISearchResponse)
async def ai_search_objects(
    body: AISearchRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    page: int = Query(1, ge=1),
    page_size: int = Query(24, ge=1, le=100),
):
    from ...ai.analyzers import parse_nl_search

    query_text = body.query.strip()
    if not query_text:
        return AISearchResponse(items=[], total=0, page=1, page_size=page_size, pages=0)

    filters = await parse_nl_search(query_text)
    intent_summary: str = filters.pop("intent_summary", query_text)

    base_query = select(ConstructionObject)
    base_query = build_filter_query(base_query, filters)

    total = await db.scalar(select(func.count()).select_from(base_query.subquery()))

    # Always rank by AI score for AI search
    base_query = base_query.order_by(ConstructionObject.ai_score.desc().nullslast())
    base_query = base_query.offset((page - 1) * page_size).limit(page_size)

    result = await db.execute(base_query)
    objects = result.scalars().all()

    return AISearchResponse(
        items=[ConstructionObjectListSchema.model_validate(o) for o in objects],
        total=total or 0,
        page=page,
        page_size=page_size,
        pages=max(1, -(-total // page_size)) if total else 0,
        intent_summary=intent_summary,
        parsed_filters=filters,
    )


@router.get("/export/csv")
async def export_objects_csv(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    status: Optional[List[ObjectStatus]] = Query(None),
    category: Optional[List[ObjectCategory]] = Query(None),
    city: Optional[List[str]] = Query(None),
    oblast: Optional[List[str]] = Query(None),
    search: Optional[str] = Query(None),
    min_floors: Optional[int] = Query(None),
    max_floors: Optional[int] = Query(None),
    min_ai_score: Optional[float] = Query(None),
    has_tenders: Optional[bool] = Query(None),
    has_permits: Optional[bool] = Query(None),
):
    params = {
        "status": status, "category": category, "city": city, "oblast": oblast,
        "search": search, "min_floors": min_floors, "max_floors": max_floors,
        "min_ai_score": min_ai_score, "has_tenders": has_tenders, "has_permits": has_permits,
    }

    query = select(ConstructionObject)
    query = build_filter_query(query, params)
    query = query.order_by(ConstructionObject.updated_at.desc()).limit(10000)

    result = await db.execute(query)
    objects = result.scalars().all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "id", "name", "address", "city", "oblast", "status", "category",
        "floors", "building_area", "ai_score", "source", "created_at", "updated_at",
    ])
    for o in objects:
        writer.writerow([
            str(o.id), o.name, o.address or "", o.city or "", o.oblast or "",
            o.status.value if o.status else "", o.category.value if o.category else "",
            o.floors or "", o.building_area or "", o.ai_score or "",
            o.source, o.created_at.isoformat(), o.updated_at.isoformat(),
        ])

    output.seek(0)
    filename = f"buildradar-{datetime.utcnow().strftime('%Y%m%d')}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.get("/{object_id}", response_model=ConstructionObjectDetailSchema)
async def get_object(
    object_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = (
        select(ConstructionObject)
        .options(
            selectinload(ConstructionObject.companies).selectinload(ObjectCompany.company),
            selectinload(ConstructionObject.permits),
            selectinload(ConstructionObject.tenders),
            selectinload(ConstructionObject.status_history),
            selectinload(ConstructionObject.ai_analyses),
            selectinload(ConstructionObject.notes),
            selectinload(ConstructionObject.favorites),
        )
        .where(ConstructionObject.id == object_id)
    )

    result = await db.execute(query)
    obj = result.scalar_one_or_none()

    if not obj:
        raise HTTPException(status_code=404, detail="Object not found")

    user_note_orm = next((n for n in obj.notes if str(n.user_id) == str(current_user.id)), None)
    is_favorite = any(str(f.user_id) == str(current_user.id) for f in obj.favorites)
    latest_ai_orm = obj.ai_analyses[-1] if obj.ai_analyses else None

    schema = ConstructionObjectDetailSchema.model_validate(obj)
    schema.user_note = ObjectNoteSchema.model_validate(user_note_orm) if user_note_orm else None
    schema.is_favorite = is_favorite
    schema.ai_analysis = AIAnalysisSchema.model_validate(latest_ai_orm) if latest_ai_orm else None

    return schema


@router.post("/{object_id}/favorite", status_code=204)
async def add_favorite(
    object_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    existing = await db.scalar(
        select(FavoriteObject).where(
            and_(FavoriteObject.user_id == current_user.id, FavoriteObject.object_id == object_id)
        )
    )
    if not existing:
        db.add(FavoriteObject(user_id=current_user.id, object_id=object_id))
        await db.commit()


@router.delete("/{object_id}/favorite", status_code=204)
async def remove_favorite(
    object_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    existing = await db.scalar(
        select(FavoriteObject).where(
            and_(FavoriteObject.user_id == current_user.id, FavoriteObject.object_id == object_id)
        )
    )
    if existing:
        await db.delete(existing)
        await db.commit()
