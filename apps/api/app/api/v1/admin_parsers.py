"""Admin: parser logs and manual trigger."""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from ...core.database import get_db
from ...core.dependencies import require_admin
from ...models.user import User
from ...models.parser_log import ParserLog
from ...tasks.parser_tasks import run_edesb_parser, run_prozorro_parser, run_data_gov_parser

router = APIRouter(prefix="/admin/parsers", tags=["admin"])

PARSER_TASKS = {
    "edesb": run_edesb_parser,
    "prozorro": run_prozorro_parser,
    "data_gov": run_data_gov_parser,
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


@router.post("/{source}/run", status_code=202)
async def trigger_parser(
    source: str,
    _: User = Depends(require_admin),
):
    task_fn = PARSER_TASKS.get(source)
    if not task_fn:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail=f"Парсер '{source}' не знайдено")

    task = task_fn.delay()
    return {"task_id": task.id, "source": source, "status": "queued"}
