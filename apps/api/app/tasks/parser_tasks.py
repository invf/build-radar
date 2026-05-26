"""Celery tasks for data source parsers."""
import asyncio
import logging
from datetime import datetime, timezone

from .celery_app import celery_app

logger = logging.getLogger(__name__)


def run_async(coro):
    """Run async coroutine in Celery sync task."""
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


async def _run_parser_async(parser_class):
    """Async wrapper for running a parser with DB session."""
    from ..core.database import AsyncSessionLocal
    from ..models.parser_log import ParserLog, ParserStatus

    log = ParserLog(source=parser_class.source_name if hasattr(parser_class, 'source_name') else 'unknown')

    async with AsyncSessionLocal() as db:
        db.add(log)
        await db.commit()
        await db.refresh(log)

        try:
            parser = parser_class()
            result = await parser.run(db)

            log.status = ParserStatus.completed if not result.errors else ParserStatus.failed
            log.objects_found = result.objects_found
            log.objects_created = result.objects_created
            log.objects_updated = result.objects_updated
            log.errors = result.errors or None
            log.completed_at = datetime.now(timezone.utc)

        except Exception as e:
            logger.exception(f"Parser {parser_class} failed: {e}")
            log.status = ParserStatus.failed
            log.errors = [str(e)]
            log.completed_at = datetime.now(timezone.utc)

        await db.commit()
        return log.objects_created + log.objects_updated


@celery_app.task(name="app.tasks.parser_tasks.run_edesb_parser", bind=True)
def run_edesb_parser(self):
    """Run ЄДЕССБ construction permits parser."""
    from ..parsers.edesb import EdesbParser
    logger.info("Starting ЄДЕССБ parser task")
    try:
        count = run_async(_run_parser_async(EdesbParser))
        logger.info(f"ЄДЕССБ parser done: {count} objects processed")
        return {"status": "ok", "count": count}
    except Exception as e:
        logger.exception(f"ЄДЕССБ parser task failed: {e}")
        raise self.retry(exc=e, countdown=60, max_retries=3)


@celery_app.task(name="app.tasks.parser_tasks.run_prozorro_parser", bind=True)
def run_prozorro_parser(self):
    """Run Prozorro tenders parser."""
    from ..parsers.prozorro import ProzorroParser
    logger.info("Starting Prozorro parser task")
    try:
        count = run_async(_run_parser_async(ProzorroParser))
        return {"status": "ok", "count": count}
    except Exception as e:
        raise self.retry(exc=e, countdown=120, max_retries=3)


@celery_app.task(name="app.tasks.parser_tasks.run_data_gov_parser", bind=True)
def run_data_gov_parser(self):
    """Run data.gov.ua datasets parser."""
    from ..parsers.data_gov import DataGovParser
    logger.info("Starting data.gov.ua parser task")
    try:
        count = run_async(_run_parser_async(DataGovParser))
        return {"status": "ok", "count": count}
    except Exception as e:
        raise self.retry(exc=e, countdown=300, max_retries=2)


@celery_app.task(name="app.tasks.parser_tasks.run_all_parsers")
def run_all_parsers():
    """Manual trigger to run all parsers."""
    run_edesb_parser.delay()
    run_prozorro_parser.delay()
    run_data_gov_parser.delay()
    return {"status": "triggered"}
