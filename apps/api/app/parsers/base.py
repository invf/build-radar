"""Abstract base parser for all Ukrainian open-data sources."""
from __future__ import annotations
import asyncio
import logging
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from dataclasses import dataclass, field
from typing import AsyncGenerator

import aiohttp
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


@dataclass
class ParsedObject:
    """Normalized construction object from any data source."""
    name: str
    source: str
    source_id: str

    address: str | None = None
    city: str | None = None
    oblast: str | None = None
    district: str | None = None
    latitude: float | None = None
    longitude: float | None = None

    status: str | None = None
    category: str | None = None
    object_type: str | None = None

    floors: int | None = None
    building_area: float | None = None
    land_area: float | None = None
    description: str | None = None
    planned_completion: datetime | None = None

    developer_name: str | None = None
    developer_edrpou: str | None = None
    contractor_name: str | None = None
    contractor_edrpou: str | None = None

    permit_number: str | None = None
    permit_type: str | None = None
    permit_issued_date: datetime | None = None
    permit_url: str | None = None

    raw_data: dict = field(default_factory=dict)


@dataclass
class ParseResult:
    """Result of a parser run."""
    source: str
    objects_found: int = 0
    objects_created: int = 0
    objects_updated: int = 0
    errors: list[str] = field(default_factory=list)
    started_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    completed_at: datetime | None = None


class BaseParser(ABC):
    """Abstract base class for all data source parsers."""

    source_name: str
    base_url: str
    timeout: int = 30
    retry_attempts: int = 3
    retry_delay: float = 2.0

    def __init__(self):
        self._session: aiohttp.ClientSession | None = None
        self.logger = logging.getLogger(f"parsers.{self.source_name}")

    async def __aenter__(self):
        self._session = aiohttp.ClientSession(
            timeout=aiohttp.ClientTimeout(total=self.timeout),
            headers={"User-Agent": "BuildRadar/1.0 (+https://buildradar.ua)"},
        )
        return self

    async def __aexit__(self, *args):
        if self._session:
            await self._session.close()

    @property
    def session(self) -> aiohttp.ClientSession:
        if not self._session:
            raise RuntimeError("Parser not initialized. Use as async context manager.")
        return self._session

    async def fetch(self, url: str, params: dict | None = None, **kwargs) -> dict | list:
        """Fetch JSON from URL with retry logic."""
        for attempt in range(self.retry_attempts):
            try:
                async with self.session.get(url, params=params, **kwargs) as response:
                    response.raise_for_status()
                    return await response.json(content_type=None)
            except Exception as e:
                if attempt == self.retry_attempts - 1:
                    raise
                self.logger.warning(f"Attempt {attempt + 1} failed: {e}. Retrying...")
                await asyncio.sleep(self.retry_delay * (attempt + 1))

    async def fetch_text(self, url: str, **kwargs) -> str:
        """Fetch raw text/HTML from URL."""
        for attempt in range(self.retry_attempts):
            try:
                async with self.session.get(url, **kwargs) as response:
                    response.raise_for_status()
                    return await response.text()
            except Exception as e:
                if attempt == self.retry_attempts - 1:
                    raise
                await asyncio.sleep(self.retry_delay)

    @abstractmethod
    async def fetch_objects(self) -> AsyncGenerator[ParsedObject, None]:
        """Yield normalized construction objects from source."""
        ...

    @abstractmethod
    async def parse_raw(self, raw: dict) -> ParsedObject | None:
        """Parse raw API/scraping data into normalized ParsedObject."""
        ...

    async def run(self, db: AsyncSession) -> ParseResult:
        """Execute full parse cycle and persist to database."""
        result = ParseResult(source=self.source_name)
        self.logger.info(f"Starting {self.source_name} parser")

        try:
            async with self:
                async for parsed_obj in self.fetch_objects():
                    try:
                        created = await self._upsert_object(db, parsed_obj)
                        result.objects_found += 1
                        if created:
                            result.objects_created += 1
                        else:
                            result.objects_updated += 1
                    except Exception as e:
                        error_msg = f"Error persisting object {parsed_obj.source_id}: {e}"
                        self.logger.error(error_msg)
                        result.errors.append(error_msg)

        except Exception as e:
            error_msg = f"Parser error: {e}"
            self.logger.exception(error_msg)
            result.errors.append(error_msg)

        result.completed_at = datetime.now(timezone.utc)
        self.logger.info(
            f"{self.source_name} complete: "
            f"{result.objects_created} created, {result.objects_updated} updated, "
            f"{len(result.errors)} errors"
        )
        return result

    async def _upsert_object(self, db: AsyncSession, parsed: ParsedObject) -> bool:
        """Upsert parsed object into database. Returns True if created."""
        from sqlalchemy import select
        from ..models.construction_object import ConstructionObject, ObjectStatus, ObjectCategory
        from ..models.status_history import StatusHistory
        from geoalchemy2.elements import WKTElement

        existing = await db.scalar(
            select(ConstructionObject).where(
                ConstructionObject.source == parsed.source,
                ConstructionObject.source_id == parsed.source_id,
            )
        )

        # Map status string to enum
        status_map = {
            "planned": ObjectStatus.planned,
            "approved": ObjectStatus.approved,
            "under_construction": ObjectStatus.under_construction,
            "completed": ObjectStatus.completed,
            "suspended": ObjectStatus.suspended,
            "cancelled": ObjectStatus.cancelled,
        }
        status = status_map.get(parsed.status or "planned", ObjectStatus.planned)

        # Category map
        cat_map = {
            "residential": ObjectCategory.residential,
            "commercial": ObjectCategory.commercial,
            "industrial": ObjectCategory.industrial,
            "infrastructure": ObjectCategory.infrastructure,
            "social": ObjectCategory.social,
            "mixed": ObjectCategory.mixed,
        }
        category = cat_map.get(parsed.category or "", None)

        # Build geometry if coordinates available
        geom = None
        if parsed.latitude and parsed.longitude:
            geom = WKTElement(f"POINT({parsed.longitude} {parsed.latitude})", srid=4326)

        if not existing:
            obj = ConstructionObject(
                name=parsed.name,
                address=parsed.address,
                city=parsed.city,
                oblast=parsed.oblast,
                district=parsed.district,
                coordinates=geom,
                status=status,
                category=category,
                floors=parsed.floors,
                building_area=parsed.building_area,
                land_area=parsed.land_area,
                description=parsed.description,
                planned_completion=parsed.planned_completion,
                source=parsed.source,
                source_id=parsed.source_id,
                raw_data=parsed.raw_data,
            )
            db.add(obj)
            await db.flush()
            await self._create_companies(db, obj, parsed)
            await self._create_permit(db, obj, parsed)
            await db.commit()
            return True
        else:
            # Track status changes
            if existing.status != status:
                db.add(StatusHistory(
                    object_id=existing.id,
                    field_name="status",
                    old_value=str(existing.status),
                    new_value=str(status),
                    source=parsed.source,
                ))
                existing.status = status

            # Update fields
            if parsed.address:
                existing.address = parsed.address
            if geom:
                existing.coordinates = geom
            if parsed.description:
                existing.description = parsed.description
            if parsed.floors:
                existing.floors = parsed.floors
            existing.raw_data = parsed.raw_data

            await db.commit()
            return False

    async def _create_companies(self, db: AsyncSession, obj, parsed: ParsedObject):
        from sqlalchemy import select
        from ..models.company import Company, ObjectCompany, CompanyRole

        for company_info in [
            (parsed.developer_name, parsed.developer_edrpou, CompanyRole.developer),
            (parsed.contractor_name, parsed.contractor_edrpou, CompanyRole.general_contractor),
        ]:
            name, edrpou, role = company_info
            if not name:
                continue

            company = None
            if edrpou:
                company = await db.scalar(select(Company).where(Company.edrpou == edrpou))

            if not company:
                company = Company(name=name, edrpou=edrpou, type=role)
                db.add(company)
                await db.flush()

            link = ObjectCompany(
                object_id=obj.id, company_id=company.id, role=role,
                is_primary=(role == CompanyRole.developer)
            )
            db.add(link)

    async def _create_permit(self, db: AsyncSession, obj, parsed: ParsedObject):
        if not parsed.permit_number:
            return

        from ..models.permit import Permit, PermitType
        permit_type_map = {
            "construction_permit": PermitType.construction_permit,
            "readiness_declaration": PermitType.readiness_declaration,
        }
        p_type = permit_type_map.get(
            parsed.permit_type or "construction_permit", PermitType.construction_permit
        )

        permit = Permit(
            object_id=obj.id,
            permit_number=parsed.permit_number,
            permit_type=p_type,
            issued_date=parsed.permit_issued_date,
            document_url=parsed.permit_url,
        )
        db.add(permit)
