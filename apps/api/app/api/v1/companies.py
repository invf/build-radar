"""Companies API endpoints."""
from uuid import UUID
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Body
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_, desc, asc
from sqlalchemy.orm import selectinload
from sqlalchemy.orm.attributes import flag_modified

from ...core.database import get_db
from ...core.dependencies import get_current_user
from ...core.redis import cache_get, cache_set, cache_delete, cache_delete_pattern
from ...models.user import User
from ...models.company import Company, CompanyRole, ObjectCompany, RelationshipStatus
from ...models.construction_object import ConstructionObject
from ...models.permit import Permit
from ...models.tender import Tender
from ...models.saved_search import FavoriteCompany
from ...schemas.companies import (
    CompanySchema,
    CompanyDetailSchema,
    CompanyListResponse,
    CompanyCreateSchema,
    CompanyUpdateSchema,
)

router = APIRouter(prefix="/companies", tags=["companies"])

CACHE_TTL = 300  # 5 min


@router.post("", response_model=CompanySchema, status_code=201)
async def create_company(
    body: CompanyCreateSchema,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    company = Company(**body.model_dump())
    db.add(company)
    await db.commit()
    await db.refresh(company)
    await cache_delete_pattern("companies:list:*")
    schema = CompanySchema.model_validate(company)
    schema.objects_count = 0
    return schema


@router.get("", response_model=CompanyListResponse)
async def list_companies(
    search: Optional[str] = Query(None),
    type: Optional[CompanyRole] = Query(None),
    sort_by: str = Query("objects_count", pattern="^(name|objects_count|ai_score|created_at)$"),
    sort_order: str = Query("desc", pattern="^(asc|desc)$"),
    page: int = Query(1, ge=1),
    page_size: int = Query(24, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    cache_key = f"companies:list:{search}:{type}:{sort_by}:{sort_order}:{page}:{page_size}"
    if cached := await cache_get(cache_key):
        return cached

    # Count subquery: objects per company
    objects_count_sq = (
        select(
            ObjectCompany.company_id,
            func.count(ObjectCompany.id).label("cnt"),
        )
        .group_by(ObjectCompany.company_id)
        .subquery()
    )

    stmt = select(
        Company,
        func.coalesce(objects_count_sq.c.cnt, 0).label("objects_count"),
    ).outerjoin(objects_count_sq, Company.id == objects_count_sq.c.company_id)

    if search:
        stmt = stmt.where(
            or_(
                Company.name.ilike(f"%{search}%"),
                Company.edrpou.ilike(f"%{search}%"),
            )
        )
    if type:
        stmt = stmt.where(Company.type == type)

    total_stmt = select(func.count()).select_from(stmt.subquery())
    total = (await db.execute(total_stmt)).scalar_one()

    order_col = {
        "name": Company.name,
        "ai_score": Company.ai_score,
        "created_at": Company.created_at,
        "objects_count": objects_count_sq.c.cnt,
    }.get(sort_by, objects_count_sq.c.cnt)

    order = desc(order_col) if sort_order == "desc" else asc(order_col)
    stmt = stmt.order_by(order).offset((page - 1) * page_size).limit(page_size)

    rows = (await db.execute(stmt)).all()

    items = []
    for company, cnt in rows:
        schema = CompanySchema.model_validate(company)
        schema.objects_count = cnt
        items.append(schema)

    result = CompanyListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        pages=max(1, -(-total // page_size)),
    )
    await cache_set(cache_key, result.model_dump(mode="json"), ttl=CACHE_TTL)
    return result


@router.get("/{company_id}", response_model=CompanyDetailSchema)
async def get_company(
    company_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    cache_key = f"companies:{company_id}"
    if cached := await cache_get(cache_key):
        return cached

    result = await db.execute(
        select(Company).where(Company.id == company_id)
    )
    company = result.scalar_one_or_none()
    if not company:
        raise HTTPException(status_code=404, detail="Компанію не знайдено")

    # objects count
    cnt_result = await db.execute(
        select(func.count(ObjectCompany.id)).where(ObjectCompany.company_id == company_id)
    )
    objects_count = cnt_result.scalar_one()

    # recent objects (last 5)
    recent_result = await db.execute(
        select(ConstructionObject)
        .join(ObjectCompany, ObjectCompany.object_id == ConstructionObject.id)
        .where(ObjectCompany.company_id == company_id)
        .order_by(ConstructionObject.updated_at.desc())
        .limit(5)
    )
    recent_objects = recent_result.scalars().all()

    # is_favorite
    fav = await db.execute(
        select(FavoriteCompany).where(
            FavoriteCompany.user_id == current_user.id,
            FavoriteCompany.company_id == company_id,
        )
    )
    is_favorite = fav.scalar_one_or_none() is not None

    schema = CompanyDetailSchema.model_validate(company)
    schema.objects_count = objects_count
    schema.recent_objects = [
        {"id": str(o.id), "name": o.name, "city": o.city, "status": o.status.value}
        for o in recent_objects
    ]
    schema.is_favorite = is_favorite

    await cache_set(cache_key, schema.model_dump(mode="json"), ttl=CACHE_TTL)
    return schema


@router.patch("/{company_id}", response_model=CompanySchema)
async def update_company(
    company_id: UUID,
    body: CompanyUpdateSchema,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    result = await db.execute(select(Company).where(Company.id == company_id))
    company = result.scalar_one_or_none()
    if not company:
        raise HTTPException(status_code=404, detail="Компанію не знайдено")

    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(company, field, value)
        if field in ("contacts", "projects"):
            flag_modified(company, field)

    await db.commit()
    await db.refresh(company)
    await cache_delete(f"companies:{company_id}")
    await cache_delete_pattern("companies:list:*")
    schema = CompanySchema.model_validate(company)
    schema.objects_count = 0
    return schema


@router.delete("/{company_id}", status_code=204)
async def delete_company(
    company_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    result = await db.execute(select(Company).where(Company.id == company_id))
    company = result.scalar_one_or_none()
    if not company:
        raise HTTPException(status_code=404, detail="Компанію не знайдено")
    await db.delete(company)
    await db.commit()


@router.post("/{company_id}/favorite", status_code=201)
async def favorite_company(
    company_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    existing = await db.execute(
        select(FavoriteCompany).where(
            FavoriteCompany.user_id == current_user.id,
            FavoriteCompany.company_id == company_id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Вже в обраних")

    fav = FavoriteCompany(user_id=current_user.id, company_id=company_id)
    db.add(fav)
    await db.commit()
    return {"ok": True}


@router.delete("/{company_id}/favorite", status_code=204)
async def unfavorite_company(
    company_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(FavoriteCompany).where(
            FavoriteCompany.user_id == current_user.id,
            FavoriteCompany.company_id == company_id,
        )
    )
    fav = result.scalar_one_or_none()
    if not fav:
        raise HTTPException(status_code=404, detail="Не знайдено в обраних")

    await db.delete(fav)
    await db.commit()


@router.post("/{company_id}/link/{object_id}", status_code=201)
async def link_object_to_company(
    company_id: UUID,
    object_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    existing = await db.execute(
        select(ObjectCompany).where(
            ObjectCompany.company_id == company_id,
            ObjectCompany.object_id == object_id,
        )
    )
    if existing.scalar_one_or_none():
        return {"ok": True}
    oc = ObjectCompany(
        company_id=company_id,
        object_id=object_id,
        role=CompanyRole.general_contractor,
        is_primary=False,
    )
    db.add(oc)
    await db.commit()
    return {"ok": True}


class CompanyObjectItem(BaseModel):
    id: str
    name: str
    address: str
    city: str
    photos: list[str]
    status: str
    category: str
    object_type: str
    floors: int | None
    building_area: float | None
    description: str | None
    ai_score: float | None
    permits_count: int
    tenders_count: int
    relationship_status: str | None
    role: str | None

    model_config = {"from_attributes": True}


@router.get("/{company_id}/objects", response_model=list[CompanyObjectItem])
async def list_company_objects(
    company_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    permits_sq = (
        select(Permit.object_id, func.count(Permit.id).label("cnt"))
        .group_by(Permit.object_id)
        .subquery()
    )
    tenders_sq = (
        select(Tender.object_id, func.count(Tender.id).label("cnt"))
        .group_by(Tender.object_id)
        .subquery()
    )
    rows = await db.execute(
        select(
            ConstructionObject,
            ObjectCompany.relationship_status,
            ObjectCompany.role,
            func.coalesce(permits_sq.c.cnt, 0).label("permits_count"),
            func.coalesce(tenders_sq.c.cnt, 0).label("tenders_count"),
        )
        .join(ObjectCompany, ObjectCompany.object_id == ConstructionObject.id)
        .outerjoin(permits_sq, permits_sq.c.object_id == ConstructionObject.id)
        .outerjoin(tenders_sq, tenders_sq.c.object_id == ConstructionObject.id)
        .where(ObjectCompany.company_id == company_id)
        .order_by(ConstructionObject.updated_at.desc())
    )
    return [
        CompanyObjectItem(
            id=str(obj.id),
            name=obj.name,
            address=obj.address or "",
            city=obj.city or "",
            photos=obj.photos or [],
            status=obj.status.value if obj.status else "",
            category=obj.category.value if obj.category else "",
            object_type=obj.object_type.value if obj.object_type else "",
            floors=obj.floors,
            building_area=obj.building_area,
            description=obj.description,
            ai_score=obj.ai_score,
            permits_count=permits_count,
            tenders_count=tenders_count,
            relationship_status=rel_status.value if rel_status else None,
            role=role.value if role else None,
        )
        for obj, rel_status, role, permits_count, tenders_count in rows.all()
    ]


@router.delete("/{company_id}/objects/{object_id}", status_code=204)
async def unlink_object_from_company(
    company_id: UUID,
    object_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    result = await db.execute(
        select(ObjectCompany).where(
            ObjectCompany.company_id == company_id,
            ObjectCompany.object_id == object_id,
        )
    )
    oc = result.scalar_one_or_none()
    if oc:
        await db.delete(oc)
        await db.commit()


class RelationshipStatusUpdate(BaseModel):
    relationship_status: str | None


@router.patch("/{company_id}/objects/{object_id}/relationship", status_code=200)
async def update_object_relationship(
    company_id: UUID,
    object_id: UUID,
    body: RelationshipStatusUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    result = await db.execute(
        select(ObjectCompany).where(
            ObjectCompany.company_id == company_id,
            ObjectCompany.object_id == object_id,
        )
    )
    oc = result.scalar_one_or_none()
    if not oc:
        raise HTTPException(status_code=404, detail="Зв'язок не знайдено")

    status_val = None
    if body.relationship_status:
        try:
            status_val = RelationshipStatus(body.relationship_status)
        except ValueError:
            raise HTTPException(status_code=422, detail="Невірний статус")

    oc.relationship_status = status_val
    await db.commit()
    return {"ok": True}
