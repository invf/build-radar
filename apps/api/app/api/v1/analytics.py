from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, case, text
from datetime import datetime, timedelta, timezone

from ...core.database import get_db
from ...core.dependencies import get_current_user
from ...core.redis import cache_get, cache_set
from ...models.user import User
from ...models.construction_object import ConstructionObject, ObjectStatus
from ...models.company import Company, ObjectCompany, CompanyRole
from ...models.tender import Tender, TenderStatus
from ...models.permit import Permit
from ...models.ai_analysis import AIAnalysis

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/dashboard")
async def get_dashboard_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    cache_key = "dashboard_stats"
    cached = await cache_get(cache_key)
    if cached:
        return cached

    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_ago = now - timedelta(days=7)

    # Total objects
    total_objects = await db.scalar(select(func.count(ConstructionObject.id)))

    # New today
    new_today = await db.scalar(
        select(func.count(ConstructionObject.id))
        .where(ConstructionObject.created_at >= today_start)
    )

    # Under construction
    under_construction = await db.scalar(
        select(func.count(ConstructionObject.id))
        .where(ConstructionObject.status == ObjectStatus.under_construction)
    )

    # Active tenders
    active_tenders = await db.scalar(
        select(func.count(Tender.id))
        .where(Tender.status == TenderStatus.active)
    )

    # New permits this week
    new_permits_week = await db.scalar(
        select(func.count(Permit.id))
        .where(Permit.created_at >= week_ago)
    )

    # Objects by status
    status_result = await db.execute(
        select(ConstructionObject.status, func.count(ConstructionObject.id))
        .group_by(ConstructionObject.status)
    )
    objects_by_status = {row[0]: row[1] for row in status_result.all()}

    # Objects by category
    category_result = await db.execute(
        select(ConstructionObject.category, func.count(ConstructionObject.id))
        .where(ConstructionObject.category.isnot(None))
        .group_by(ConstructionObject.category)
    )
    objects_by_category = {row[0]: row[1] for row in category_result.all()}

    # Top cities
    city_result = await db.execute(
        select(ConstructionObject.city, func.count(ConstructionObject.id).label("count"))
        .where(ConstructionObject.city.isnot(None))
        .group_by(ConstructionObject.city)
        .order_by(func.count(ConstructionObject.id).desc())
        .limit(10)
    )
    top_cities = [{"city": row[0], "count": row[1]} for row in city_result.all()]

    # Top developers
    dev_result = await db.execute(
        select(Company, func.count(ObjectCompany.object_id).label("objects_count"))
        .join(ObjectCompany, ObjectCompany.company_id == Company.id)
        .where(ObjectCompany.role == CompanyRole.developer)
        .group_by(Company.id)
        .order_by(func.count(ObjectCompany.object_id).desc())
        .limit(5)
    )
    top_developers = [
        {
            "company": {
                "id": str(row[0].id), "name": row[0].name,
                "edrpou": row[0].edrpou, "type": row[0].type,
            },
            "objects_count": row[1]
        }
        for row in dev_result.all()
    ]

    # Recent objects
    recent_result = await db.execute(
        select(ConstructionObject)
        .order_by(ConstructionObject.created_at.desc())
        .limit(8)
    )
    from ...schemas.objects import ConstructionObjectListSchema
    recent_objects = [
        ConstructionObjectListSchema.model_validate(o).model_dump(mode="json")
        for o in recent_result.scalars().all()
    ]

    # AI opportunities count
    ai_opps = await db.scalar(
        select(func.count(AIAnalysis.id))
        .where(AIAnalysis.score >= 0.75)
    )

    stats = {
        "total_objects": total_objects or 0,
        "new_today": new_today or 0,
        "under_construction": under_construction or 0,
        "active_tenders": active_tenders or 0,
        "new_permits_week": new_permits_week or 0,
        "objects_by_status": {str(k): v for k, v in objects_by_status.items()},
        "objects_by_category": {str(k): v for k, v in objects_by_category.items()},
        "top_cities": top_cities,
        "top_developers": top_developers,
        "recent_objects": recent_objects,
        "ai_opportunities_count": ai_opps or 0,
    }

    await cache_set(cache_key, stats, ttl=300)
    return stats


@router.get("/regional")
async def get_regional_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    cache_key = "regional_stats"
    cached = await cache_get(cache_key)
    if cached:
        return cached

    result = await db.execute(
        select(
            ConstructionObject.oblast,
            func.count(ConstructionObject.id).label("total"),
            func.sum(case(
                (ConstructionObject.status == ObjectStatus.under_construction, 1), else_=0
            )).label("under_construction"),
            func.sum(case(
                (ConstructionObject.status == ObjectStatus.completed, 1), else_=0
            )).label("completed"),
            func.sum(case(
                (ConstructionObject.status == ObjectStatus.planned, 1), else_=0
            )).label("planned"),
        )
        .where(ConstructionObject.oblast.isnot(None))
        .group_by(ConstructionObject.oblast)
        .order_by(func.count(ConstructionObject.id).desc())
    )

    data = [
        {
            "oblast": row[0],
            "total": row[1] or 0,
            "under_construction": row[2] or 0,
            "completed": row[3] or 0,
            "planned": row[4] or 0,
        }
        for row in result.all()
    ]

    await cache_set(cache_key, data, ttl=600)
    return data
