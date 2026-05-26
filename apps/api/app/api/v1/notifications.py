"""Notifications & notification settings endpoints."""
from uuid import UUID
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc

from ...core.database import get_db
from ...core.dependencies import get_current_user
from ...models.user import User
from ...models.notification import Notification, NotificationSettings

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("")
async def list_notifications(
    unread_only: bool = Query(False),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = select(Notification).where(Notification.user_id == current_user.id)
    if unread_only:
        stmt = stmt.where(Notification.is_read == False)  # noqa: E712

    total = (await db.execute(select(func.count()).select_from(stmt.subquery()))).scalar_one()
    unread_count = (await db.execute(
        select(func.count(Notification.id))
        .where(Notification.user_id == current_user.id, Notification.is_read == False)  # noqa: E712
    )).scalar_one()

    stmt = stmt.order_by(desc(Notification.created_at)).offset((page - 1) * page_size).limit(page_size)
    items = (await db.execute(stmt)).scalars().all()

    return {
        "items": [
            {
                "id": str(n.id),
                "user_id": str(n.user_id),
                "type": n.type,
                "title": n.title,
                "body": n.body,
                "is_read": n.is_read,
                "related_object_id": str(n.related_object_id) if n.related_object_id else None,
                "related_company_id": str(n.related_company_id) if n.related_company_id else None,
                "created_at": n.created_at.isoformat(),
            }
            for n in items
        ],
        "total": total,
        "unread_count": unread_count,
    }


@router.post("/{notification_id}/read", status_code=200)
async def mark_read(
    notification_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Notification).where(
            Notification.id == notification_id,
            Notification.user_id == current_user.id,
        )
    )
    notification = result.scalar_one_or_none()
    if notification:
        notification.is_read = True
        await db.commit()
    return {"ok": True}


@router.post("/read-all", status_code=200)
async def mark_all_read(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Notification).where(
            Notification.user_id == current_user.id,
            Notification.is_read == False,  # noqa: E712
        )
    )
    for n in result.scalars().all():
        n.is_read = True
    await db.commit()
    return {"ok": True}


@router.get("/settings")
async def get_notification_settings(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(NotificationSettings).where(NotificationSettings.user_id == current_user.id)
    )
    settings = result.scalar_one_or_none()
    if not settings:
        # Return defaults
        return {
            "email_enabled": True,
            "telegram_enabled": False,
            "push_enabled": True,
            "telegram_chat_id": None,
            "digest_frequency": "daily",
        }
    return {
        "email_enabled": settings.email_enabled,
        "telegram_enabled": settings.telegram_enabled,
        "push_enabled": settings.push_enabled,
        "telegram_chat_id": settings.telegram_chat_id,
        "digest_frequency": settings.digest_frequency,
    }


@router.patch("/settings")
async def update_notification_settings(
    payload: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(NotificationSettings).where(NotificationSettings.user_id == current_user.id)
    )
    settings = result.scalar_one_or_none()
    if not settings:
        settings = NotificationSettings(user_id=current_user.id)
        db.add(settings)

    for field in ["email_enabled", "telegram_enabled", "push_enabled", "telegram_chat_id", "digest_frequency"]:
        if field in payload:
            setattr(settings, field, payload[field])

    await db.commit()
    return {"ok": True}
