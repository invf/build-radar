"""Admin: parser logs and manual trigger."""
import asyncio
import logging
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from ...core.database import get_db, AsyncSessionLocal
from ...core.dependencies import require_admin
from ...models.user import User
from ...models.parser_log import ParserLog

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin/parsers", tags=["admin"])

PARSER_CLASSES = {
    "edesb": "app.parsers.edesb.EdesbParser",
    "prozorro": "app.parsers.prozorro.ProzorroParser",
    "data_gov": "app.parsers.data_gov.DataGovParser",
}


@router.get("/logs")
async def get_parser_logs(
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    result = await db.execute(
        select(ParserLog)
        .order_by(desc(ParserLog.started_at))
        .limit(limit)
    )
    logs = result.scalars().all()
    return {
        "items": [
            {
                "id": str(log.id),
                "source": log.source,
                "started_at": log.started_at.isoformat(),
                "completed_at": log.completed_at.isoformat() if log.completed_at else None,
                "objects_found": log.objects_found,
                "objects_updated": log.objects_updated,
                "objects_created": log.objects_created,
                "errors": log.errors,
                "status": log.status,
            }
            for log in logs
        ]
    }


async def _run_parser_inline(class_path: str) -> dict:
    """Run parser directly (no Celery needed)."""
    module_path, class_name = class_path.rsplit(".", 1)
    import importlib
    module = importlib.import_module(module_path)
    parser_class = getattr(module, class_name)

    async with AsyncSessionLocal() as db:
        parser = parser_class()
        result = await parser.run(db)
        return {
            "objects_created": result.objects_created,
            "objects_updated": result.objects_updated,
            "errors": len(result.errors),
        }


@router.post("/{source}/run", status_code=202)
async def trigger_parser(
    source: str,
    _: User = Depends(require_admin),
):
    from fastapi import HTTPException, BackgroundTasks
    class_path = PARSER_CLASSES.get(source)
    if not class_path:
        raise HTTPException(status_code=404, detail=f"Парсер '{source}' не знайдено")

    # Try Celery first; fall back to inline run if broker unavailable
    try:
        from ...tasks import parser_tasks as pt
        task_map = {"edesb": pt.run_edesb_parser, "prozorro": pt.run_prozorro_parser, "data_gov": pt.run_data_gov_parser}
        task = task_map[source].delay()
        return {"task_id": task.id, "source": source, "status": "queued", "mode": "celery"}
    except Exception as celery_err:
        logger.warning("Celery unavailable (%s), running parser inline", celery_err)

    asyncio.create_task(_run_parser_inline(class_path))
    return {"source": source, "status": "started", "mode": "inline"}
