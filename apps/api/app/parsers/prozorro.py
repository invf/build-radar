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
        """Fetch construction tenders from Prozorro API."""
        # Fetch tenders page by page
        offset = None
        page_count = 0
        max_pages = 200  # Safety limit

        while page_count < max_pages:
            params = {"limit": self.page_size, "opt_fields": "status,procurementMethodType"}
            if offset:
                params["offset"] = offset

            try:
                data = await self.fetch(f"{self.base_url}/tenders", params=params)
            except Exception as e:
                logger.error(f"Prozorro API error: {e}")
                break

            tenders = data.get("data", [])
            if not tenders:
                break

            for tender_ref in tenders:
                tender_id = tender_ref.get("id")
                if not tender_id:
                    continue

                try:
                    obj = await self.parse_tender(tender_id)
                    if obj:
                        yield obj
                    await asyncio.sleep(0.1)  # Rate limiting
                except Exception as e:
                    logger.warning(f"Error parsing tender {tender_id}: {e}")

            offset = data.get("next_page", {}).get("offset")
            if not offset:
                break
            page_count += 1
            await asyncio.sleep(0.5)

    async def parse_tender(self, tender_id: str) -> ParsedObject | None:
        """Fetch and parse a single tender."""
        try:
            data = await self.fetch(f"{self.base_url}/tenders/{tender_id}")
            tender = data.get("data", {})
            return await self.parse_raw(tender)
        except Exception as e:
            logger.warning(f"Error fetching tender {tender_id}: {e}")
            return None

    async def parse_raw(self, raw: dict) -> ParsedObject | None:
        if not raw:
            return None

        # Check if it's construction-related
        items = raw.get("items", [])
        is_construction = False
        for item in items:
            for cpv in CONSTRUCTION_CPV_CODES:
                if str(item.get("classification", {}).get("id", "")).startswith(cpv):
                    is_construction = True
                    break

        if not is_construction and items:
            return None

        title = raw.get("title", "")
        procuring = raw.get("procuringEntity", {})
        entity_name = procuring.get("name", "")
        address = procuring.get("address", {})
        city = address.get("locality", "")
        region = address.get("region", "")

        # Build parsed object
        tender_id = raw.get("id", "")

        # Store tender in DB directly
        await self._save_tender(raw)

        return ParsedObject(
            name=title,
            source=self.source_name,
            source_id=tender_id,
            city=city or None,
            oblast=region or None,
            developer_name=entity_name or None,
            raw_data={
                "prozorro_id": tender_id,
                "status": raw.get("status"),
                "amount": raw.get("value", {}).get("amount"),
                "currency": raw.get("value", {}).get("currency", "UAH"),
            },
        )

    async def _save_tender(self, raw: dict):
        """Save tender directly to tenders table."""
        # This will be called from the background task with DB access
        pass

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
