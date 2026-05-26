"""Celery tasks for notifications."""
import asyncio
import logging
from datetime import datetime, timezone

from .celery_app import celery_app

logger = logging.getLogger(__name__)


def run_async(coro):
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


async def _check_saved_searches_async():
    """Check all saved searches and notify users of new matching objects."""
    from sqlalchemy import select
    from sqlalchemy.orm import selectinload
    from ..core.database import AsyncSessionLocal
    from ..models.saved_search import SavedSearch
    from ..models.construction_object import ConstructionObject
    from ..models.notification import Notification, NotificationType

    async with AsyncSessionLocal() as db:
        searches = await db.scalars(
            select(SavedSearch)
            .options(selectinload(SavedSearch.user))
            .where(SavedSearch.notify_enabled == True)
        )

        notifications_created = 0
        for search in searches.all():
            try:
                # Find new objects matching saved search filters since last check
                last_check = search.last_checked or datetime(2020, 1, 1, tzinfo=timezone.utc)
                filters = search.filters or {}

                query = select(ConstructionObject).where(
                    ConstructionObject.created_at > last_check
                )

                if filters.get("status"):
                    query = query.where(ConstructionObject.status.in_(filters["status"]))
                if filters.get("city"):
                    query = query.where(ConstructionObject.city.in_(filters["city"]))
                if filters.get("oblast"):
                    query = query.where(ConstructionObject.oblast.in_(filters["oblast"]))

                result = await db.execute(query.limit(10))
                new_objects = result.scalars().all()

                if new_objects:
                    notification = Notification(
                        user_id=search.user_id,
                        type=NotificationType.new_object,
                        title=f"Нові об'єкти за запитом «{search.name}»",
                        body=f"Знайдено {len(new_objects)} нових об'єктів, що відповідають вашому пошуку.",
                        related_object_id=new_objects[0].id if new_objects else None,
                    )
                    db.add(notification)
                    notifications_created += 1

                # Update last checked timestamp
                search.last_checked = datetime.now(timezone.utc)

            except Exception as e:
                logger.warning(f"Error checking saved search {search.id}: {e}")

        await db.commit()
        return notifications_created


async def _send_reminders_async():
    """Send reminder notifications for object notes with reminder dates."""
    from sqlalchemy import select, and_
    from sqlalchemy.orm import selectinload
    from ..core.database import AsyncSessionLocal
    from ..models.note import ObjectNote
    from ..models.notification import Notification, NotificationType
    from ..models.construction_object import ConstructionObject

    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = now.replace(hour=23, minute=59, second=59, microsecond=999999)

    async with AsyncSessionLocal() as db:
        notes = await db.scalars(
            select(ObjectNote)
            .options(selectinload(ObjectNote.construction_object))
            .where(
                and_(
                    ObjectNote.reminder_date >= today_start,
                    ObjectNote.reminder_date <= today_end,
                )
            )
        )

        sent = 0
        for note in notes.all():
            obj_name = note.construction_object.name if note.construction_object else "Об'єкт"
            notification = Notification(
                user_id=note.user_id,
                type=NotificationType.reminder,
                title=f"Нагадування: {obj_name}",
                body=f"Ви встановили нагадування для цього об'єкту.\n{note.note_text[:200]}",
                related_object_id=note.object_id,
            )
            db.add(notification)
            sent += 1

        await db.commit()
        return sent


@celery_app.task(name="app.tasks.notification_tasks.check_saved_search_alerts")
def check_saved_search_alerts():
    count = run_async(_check_saved_searches_async())
    logger.info(f"Created {count} saved search notifications")
    return {"notifications_created": count}


@celery_app.task(name="app.tasks.notification_tasks.send_reminder_notifications")
def send_reminder_notifications():
    count = run_async(_send_reminders_async())
    logger.info(f"Sent {count} reminder notifications")
    return {"reminders_sent": count}
