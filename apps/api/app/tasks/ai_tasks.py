"""Celery tasks for AI analysis."""
import asyncio
import logging

from .celery_app import celery_app

logger = logging.getLogger(__name__)


def run_async(coro):
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


async def _batch_analyze_async(limit: int = 50):
    from ..core.database import AsyncSessionLocal
    from ..ai.analyzers import batch_analyze_objects

    async with AsyncSessionLocal() as db:
        return await batch_analyze_objects(db, limit=limit)


async def _analyze_single_async(object_id: str):
    from sqlalchemy import select
    from sqlalchemy.orm import selectinload
    from ..core.database import AsyncSessionLocal
    from ..models.construction_object import ConstructionObject
    from ..ai.analyzers import analyze_object
    import uuid

    async with AsyncSessionLocal() as db:
        obj = await db.scalar(
            select(ConstructionObject)
            .options(selectinload(ConstructionObject.companies))
            .where(ConstructionObject.id == uuid.UUID(object_id))
        )
        if obj:
            return await analyze_object(obj, db)


@celery_app.task(name="app.tasks.ai_tasks.run_batch_ai_analysis", bind=True)
def run_batch_ai_analysis(self, limit: int = 50):
    """Batch AI analysis for unanalyzed objects."""
    logger.info(f"Starting batch AI analysis (limit={limit})")
    try:
        count = run_async(_batch_analyze_async(limit))
        logger.info(f"Batch AI analysis complete: {count} objects")
        return {"status": "ok", "analyzed": count}
    except Exception as e:
        logger.exception(f"Batch AI analysis failed: {e}")
        raise self.retry(exc=e, countdown=300, max_retries=2)


@celery_app.task(name="app.tasks.ai_tasks.analyze_single_object")
def analyze_single_object(object_id: str):
    """Trigger AI analysis for a single object."""
    logger.info(f"Analyzing object {object_id}")
    result = run_async(_analyze_single_async(object_id))
    return {"status": "ok", "object_id": object_id, "analyzed": result is not None}
