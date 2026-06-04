"""Prozorro OpenAPI parser for construction-related tenders."""
from __future__ import annotations
import asyncio
import logging
from datetime import datetime, timezone
from typing import AsyncGenerator

from .base import BaseParser, ParsedObject

logger = logging.getLogger(__name__)

CONSTRUCTION_CPV_CODES = [
    "45000000",  # Construction works
    "45100000",  # Site preparation work
    "45200000",  # Complete or part works for construction
    "45210000",  # Building construction work
    "45211000",  # Construction work for multi-dwelling buildings
    "45220000",  # Engineering works and construction works
    "45230000",  # Construction work for pipelines, lines
    "45300000",  # Building installation work
    "45310000",  # Electrical installation work
    "45320000",  # Insulation work
    "45330000",  # Plumbing and sanitary engineering work
    "45331000",  # Heating, ventilation and air conditioning
    "45400000",  # Building completion work
]


class ProzorroParser(BaseParser):
    source_name = "prozorro"
    base_url = "https://public.api.openprocurement.org/api/2.5"
    timeout = 60
    page_size = 100

    async def fetch_objects(self) -> AsyncGenerator[ParsedObject, None]:
        """Not used — Prozorro saves to tenders table, not construction_objects."""
        return
        yield  # make it an async generator

    async def parse_raw(self, raw: dict) -> ParsedObject | None:
        """Not used — override run() instead."""
        return None

    async def run(self, db) -> dict:
        """Fetch Prozorro construction tenders and save to tenders table."""
        from ..models.parser_log import ParserLog
        from sqlalchemy import select as sa_select

        started_at = datetime.now(timezone.utc)
        log = ParserLog(source=self.source_name, started_at=started_at, status="running")
        db.add(log)
        await db.commit()

        created = 0
        updated = 0
        errors = []
        offset = None
        page_count = 0
        max_pages = 200
        raw_tenders: list[dict] = []

        while page_count < max_pages:
            params = {
                "limit": self.page_size,
                "opt_fields": "title,status,value,procuringEntity,tenderPeriod,items",
            }
            if offset:
                params["offset"] = offset

            try:
                data = await self.fetch(f"{self.base_url}/tenders", params=params)
            except Exception as e:
                logger.error(f"Prozorro API error: {e}")
                errors.append(str(e))
                break

            tender_refs = data.get("data", [])
            if not tender_refs:
                break

            for ref in tender_refs:
                tender_id = ref.get("id")
                if not tender_id:
                    continue
                try:
                    detail = await self.fetch(f"{self.base_url}/tenders/{tender_id}")
                    raw = detail.get("data", {})
                    if not raw:
                        continue
                    # Only keep construction-related tenders
                    items = raw.get("items", [])
                    is_construction = any(
                        str(item.get("classification", {}).get("id", "")).startswith(cpv)
                        for item in items
                        for cpv in CONSTRUCTION_CPV_CODES
                    )
                    if is_construction or not items:
                        raw_tenders.append(raw)
                    await asyncio.sleep(0.1)
                except Exception as e:
                    errors.append(f"tender {tender_id}: {e}")

            offset = data.get("next_page", {}).get("offset")
            if not offset:
                break
            page_count += 1
            await asyncio.sleep(0.5)

        # Persist to tenders table (not construction_objects)
        created, updated = await self._persist(db, raw_tenders)

        log.completed_at = datetime.now(timezone.utc)
        log.objects_found = len(raw_tenders)
        log.objects_created = created
        log.objects_updated = updated
        log.errors = errors[:50]
        log.status = "completed" if not errors else "failed"
        await db.commit()

        return {"created": created, "updated": updated, "errors": len(errors)}

    async def _persist(self, db, raw_list: list[dict]) -> tuple[int, int]:
        """Save raw Prozorro tenders to the tenders table."""
        from sqlalchemy import select as sa_select
        from ..models.tender import Tender, TenderStatus

        status_map = {
            "active": TenderStatus.active,
            "complete": TenderStatus.complete,
            "cancelled": TenderStatus.cancelled,
            "unsuccessful": TenderStatus.unsuccessful,
        }
        created = updated = 0

        for raw in raw_list:
            tender_id = raw.get("id")
            if not tender_id:
                continue
            try:
                existing = await db.scalar(sa_select(Tender).where(Tender.prozorro_id == tender_id))
                status = status_map.get(raw.get("status", "active"), TenderStatus.active)
                amount = raw.get("value", {}).get("amount")
                currency = raw.get("value", {}).get("currency", "UAH")
                deadline_str = raw.get("tenderPeriod", {}).get("endDate")
                deadline = None
                if deadline_str:
                    try:
                        deadline = datetime.fromisoformat(deadline_str.replace("Z", "+00:00"))
                    except (ValueError, AttributeError):
                        pass
                procuring = raw.get("procuringEntity", {})

                if not existing:
                    db.add(Tender(
                        prozorro_id=tender_id,
                        title=raw.get("title", "Тендер"),
                        status=status, amount=amount, currency=currency,
                        deadline=deadline,
                        procuring_entity=procuring.get("name"),
                        procuring_entity_edrpou=procuring.get("identifier", {}).get("id"),
                    ))
                    created += 1
                else:
                    existing.status = status
                    existing.amount = amount
                    if deadline:
                        existing.deadline = deadline
                    updated += 1
            except Exception as e:
                logger.warning("Error persisting tender %s: %s", tender_id, e)

        await db.commit()
        return created, updated

    async def persist_tenders(self, db, tenders_data: list[dict]):
        """Persist tenders to DB - called with active session."""
        from sqlalchemy import select
        from ..models.tender import Tender, TenderStatus

        status_map = {
            "active": TenderStatus.active,
            "complete": TenderStatus.complete,
            "cancelled": TenderStatus.cancelled,
            "unsuccessful": TenderStatus.unsuccessful,
        }

        for raw in tenders_data:
            tender_id = raw.get("id")
            if not tender_id:
                continue

            existing = await db.scalar(
                select(Tender).where(Tender.prozorro_id == tender_id)
            )

            status = status_map.get(raw.get("status", "active"), TenderStatus.active)
            amount = raw.get("value", {}).get("amount")
            currency = raw.get("value", {}).get("currency", "UAH")
            deadline_str = raw.get("tenderPeriod", {}).get("endDate")
            deadline = None
            if deadline_str:
                try:
                    deadline = datetime.fromisoformat(deadline_str.replace("Z", "+00:00"))
                except (ValueError, AttributeError):
                    pass

            procuring = raw.get("procuringEntity", {})
            entity_name = procuring.get("name")
            entity_edrpou = procuring.get("identifier", {}).get("id")

            if not existing:
                tender = Tender(
                    prozorro_id=tender_id,
                    title=raw.get("title", "Тендер"),
                    status=status,
                    amount=amount,
                    currency=currency,
                    deadline=deadline,
                    procuring_entity=entity_name,
                    procuring_entity_edrpou=entity_edrpou,
                )
                db.add(tender)
            else:
                existing.status = status
                existing.amount = amount
                if deadline:
                    existing.deadline = deadline

        await db.commit()
