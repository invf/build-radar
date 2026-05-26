"""ЄДЕССБ (Єдина державна електронна система у сфері будівництва) parser."""
from __future__ import annotations
import logging
from datetime import datetime
from typing import AsyncGenerator

from .base import BaseParser, ParsedObject

logger = logging.getLogger(__name__)

EDESB_API_BASE = "https://e-construction.gov.ua/api"


class EdesbParser(BaseParser):
    """
    Parser for ЄДЕССБ - Ukraine's unified state electronic construction system.
    Source: e-construction.gov.ua

    Fetches:
    - Construction permits (дозволи на будівництво)
    - Readiness declarations (декларації про готовність)
    - Urban planning conditions (містобудівні умови)
    """
    source_name = "edesb"
    base_url = EDESB_API_BASE
    timeout = 45
    page_size = 50

    # Oblast codes for Ukrainian regions
    OBLAST_CODES = {
        "01": "vinnytsia", "02": "volyn", "03": "dnipropetrovsk",
        "04": "donetsk", "05": "zhytomyr", "06": "zakarpattia",
        "07": "zaporizhzhia", "08": "ivano_frankivsk", "09": "kyiv_oblast",
        "10": "kirovohrad", "11": "luhansk", "12": "lviv",
        "13": "mykolaiv", "14": "odesa", "15": "poltava",
        "16": "rivne", "17": "sumy", "18": "ternopil",
        "19": "kharkiv", "20": "kherson", "21": "khmelnytskyi",
        "22": "cherkasy", "23": "chernivtsi", "24": "chernihiv",
        "80": "kyiv_city",
    }

    async def live_search(
        self,
        city: str | None = None,
        status: str | None = None,
        limit: int = 50,
    ) -> list[ParsedObject]:
        """Fetch a page of objects filtered by city/status for hybrid AI search."""
        params: dict = {"per_page": min(limit, self.page_size), "status": status or "issued"}
        if city:
            params["city"] = city
        try:
            data = await self.fetch(f"{self.base_url}/permits", params=params)
            items = data.get("data", data if isinstance(data, list) else [])
            results: list[ParsedObject] = []
            for item in items[:limit]:
                parsed = await self.parse_raw(item)
                if parsed:
                    results.append(parsed)
            return results
        except Exception as e:
            self.logger.warning("ЄДЕССБ live search failed: %s", e)
            return []

    async def fetch_objects(self) -> AsyncGenerator[ParsedObject, None]:
        """Fetch construction permits from ЄДЕССБ."""
        page = 1
        while True:
            try:
                data = await self.fetch(
                    f"{self.base_url}/permits",
                    params={
                        "page": page,
                        "per_page": self.page_size,
                        "status": "issued",
                    }
                )
            except Exception as e:
                logger.error(f"ЄДЕССБ API error on page {page}: {e}")
                break

            items = data.get("data", data if isinstance(data, list) else [])
            if not items:
                break

            for item in items:
                parsed = await self.parse_raw(item)
                if parsed:
                    yield parsed

            # Check if there are more pages
            meta = data.get("meta", {})
            total_pages = meta.get("total_pages", 1)
            if page >= total_pages:
                break
            page += 1

    async def parse_raw(self, raw: dict) -> ParsedObject | None:
        if not raw:
            return None

        permit_id = raw.get("id") or raw.get("permit_id") or raw.get("number")
        if not permit_id:
            return None

        # Parse dates
        issued_date = None
        date_str = raw.get("issued_date") or raw.get("date")
        if date_str:
            try:
                issued_date = datetime.fromisoformat(str(date_str).replace("Z", "+00:00"))
            except (ValueError, TypeError):
                pass

        # Parse location
        address_data = raw.get("address", {}) or {}
        city = (
            address_data.get("city") or
            address_data.get("locality") or
            raw.get("city")
        )
        oblast_code = address_data.get("oblast_code") or raw.get("oblast_code", "")
        oblast = self.OBLAST_CODES.get(str(oblast_code), raw.get("oblast"))
        address = (
            address_data.get("street") or
            address_data.get("address") or
            raw.get("address", "")
        )

        # Parse object info
        object_data = raw.get("object", {}) or {}
        obj_name = (
            object_data.get("name") or
            raw.get("object_name") or
            raw.get("name") or
            f"Будівельний об'єкт {permit_id}"
        )

        floors = None
        floors_val = object_data.get("floors") or raw.get("floors_count")
        if floors_val:
            try:
                floors = int(floors_val)
            except (ValueError, TypeError):
                pass

        area = None
        area_val = object_data.get("area") or raw.get("total_area")
        if area_val:
            try:
                area = float(area_val)
            except (ValueError, TypeError):
                pass

        # Parse coordinates
        lat, lng = None, None
        coords = raw.get("coordinates") or raw.get("location", {})
        if isinstance(coords, dict):
            lat = coords.get("lat") or coords.get("latitude")
            lng = coords.get("lng") or coords.get("lon") or coords.get("longitude")
        elif isinstance(coords, (list, tuple)) and len(coords) >= 2:
            lat, lng = coords[0], coords[1]

        # Parse developer info
        customer = raw.get("customer", {}) or {}
        developer_name = customer.get("name") or raw.get("customer_name")
        developer_edrpou = customer.get("edrpou") or raw.get("customer_edrpou")

        # Determine category from permit type
        permit_type_raw = raw.get("permit_type", "").lower()
        category = "residential"
        if any(k in permit_type_raw for k in ["промислов", "вироб", "завод"]):
            category = "industrial"
        elif any(k in permit_type_raw for k in ["торгов", "офіс", "комерц"]):
            category = "commercial"
        elif any(k in permit_type_raw for k in ["дорог", "міст", "мереж", "інфра"]):
            category = "infrastructure"
        elif any(k in permit_type_raw for k in ["школ", "лікарн", "дит"]):
            category = "social"

        return ParsedObject(
            name=obj_name,
            source=self.source_name,
            source_id=str(permit_id),
            address=address or None,
            city=city or None,
            oblast=oblast or None,
            latitude=float(lat) if lat else None,
            longitude=float(lng) if lng else None,
            status="approved",
            category=category,
            floors=floors,
            building_area=area,
            developer_name=developer_name,
            developer_edrpou=developer_edrpou,
            permit_number=str(permit_id),
            permit_type="construction_permit",
            permit_issued_date=issued_date,
            permit_url=raw.get("document_url") or raw.get("url"),
            raw_data=raw,
        )
