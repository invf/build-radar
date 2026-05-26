"""Saved searches CRUD."""
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from ...core.database import get_db
from ...core.dependencies import get_current_user
from ...models.user import User
from ...models.saved_search import SavedSearch

router = APIRouter(prefix="/saved-searches", tags=["saved-searches"])


@router.get("")
async def list_saved_searches(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(SavedSearch)
        .where(SavedSearch.user_id == current_user.id)
        .order_by(SavedSearch.created_at.desc())
    )
    searches = result.scalars().all()
    return [
        {
            "id": str(s.id),
            "user_id": str(s.user_id),
            "name": s.name,
            "filters": s.filters,
            "notify_enabled": s.notify_enabled,
            "last_checked": s.last_checked.isoformat() if s.last_checked else None,
            "created_at": s.created_at.isoformat(),
        }
        for s in searches
    ]


@router.post("", status_code=201)
async def create_saved_search(
    payload: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    search = SavedSearch(
        user_id=current_user.id,
        name=payload.get("name", "Без назви"),
        filters=payload.get("filters", {}),
        notify_enabled=payload.get("notify_enabled", False),
    )
    db.add(search)
    await db.commit()
    await db.refresh(search)
    return {"id": str(search.id), "name": search.name}


@router.patch("/{search_id}")
async def update_saved_search(
    search_id: UUID,
    payload: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(SavedSearch).where(
            SavedSearch.id == search_id,
            SavedSearch.user_id == current_user.id,
        )
    )
    search = result.scalar_one_or_none()
    if not search:
        raise HTTPException(status_code=404, detail="Пошук не знайдено")

    for field in ["name", "filters", "notify_enabled"]:
        if field in payload:
            setattr(search, field, payload[field])
    await db.commit()
    return {"ok": True}


@router.delete("/{search_id}", status_code=204)
async def delete_saved_search(
    search_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(SavedSearch).where(
            SavedSearch.id == search_id,
            SavedSearch.user_id == current_user.id,
        )
    )
    search = result.scalar_one_or_none()
    if not search:
        raise HTTPException(status_code=404, detail="Пошук не знайдено")
    await db.delete(search)
    await db.commit()
