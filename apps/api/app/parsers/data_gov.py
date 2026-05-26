"""data.gov.ua open datasets parser for construction data."""
from __future__ import annotations
import csv
import io
import logging
from typing import AsyncGenerator

from .base import BaseParser, ParsedObject

logger = logging.getLogger(__name__)

# Construction-related dataset IDs on data.gov.ua
DATASETS = {
    "construction_permits": "https://data.gov.ua/dataset/e0b9ada4-4b77-4680-9534-4bd048046cc8",
    "building_declarations": "https://data.gov.ua/dataset/21f37c3a-abf2-4789-9a74-9f61b97ffb98",
}

DATA_GOV_API = "https://data.gov.ua/api/3"


class DataGovParser(BaseParser):
    """
    Parser for data.gov.ua Ukrainian open data portal.
    Fetches construction datasets in CSV/JSON format.
    """
    source_name = "data_gov_ua"
    base_url = DATA_GOV_API
    timeout = 120

    async def fetch_objects(self) -> AsyncGenerator[ParsedObject, None]:
        """Fetch and parse construction datasets."""
        # Get list of construction datasets
        try:
            datasets = await self.fetch(
                f"{self.base_url}/action/package_search",
                params={"q": "будівництво дозвіл", "rows": 50},
            )
            results = datasets.get("result", {}).get("results", [])
        except Exception as e:
            logger.error(f"data.gov.ua search error: {e}")
            return

        for dataset in results:
            dataset_id = dataset.get("id")
            if not dataset_id:
                continue

            resources = dataset.get("resources", [])
            for resource in resources:
                resource_format = resource.get("format", "").upper()
                if resource_format not in ("CSV", "JSON", "XLSX"):
                    continue

                url = resource.get("url")
                if not url:
                    continue

                try:
                    if resource_format == "CSV":
                        async for obj in self._parse_csv_resource(url, dataset):
                            yield obj
                    elif resource_format == "JSON":
                        async for obj in self._parse_json_resource(url, dataset):
                            yield obj
                except Exception as e:
                    logger.warning(f"Error parsing resource {url}: {e}")

    async def _parse_csv_resource(self, url: str, dataset: dict) -> AsyncGenerator[ParsedObject, None]:
        """Parse CSV resource."""
        try:
            content = await self.fetch_text(url)
            reader = csv.DictReader(io.StringIO(content))
            for row in reader:
                parsed = await self.parse_raw({**row, "_dataset": dataset})
                if parsed:
                    yield parsed
        except Exception as e:
            logger.warning(f"CSV parse error for {url}: {e}")

    async def _parse_json_resource(self, url: str, dataset: dict) -> AsyncGenerator[ParsedObject, None]:
        """Parse JSON resource."""
        try:
            data = await self.fetch(url)
            items = data if isinstance(data, list) else data.get("data", [data])
            for item in items:
                parsed = await self.parse_raw({**item, "_dataset": dataset})
                if parsed:
                    yield parsed
        except Exception as e:
            logger.warning(f"JSON parse error for {url}: {e}")

    async def parse_raw(self, raw: dict) -> ParsedObject | None:
        # Try to extract key fields from various CSV column naming conventions
        def get_field(*keys: str) -> str | None:
            for k in keys:
                for key in raw.keys():
                    if key.lower().replace(" ", "_") == k.lower():
                        val = raw.get(key)
                        if val and str(val).strip() not in ("", "NULL", "None", "-"):
                            return str(val).strip()
            return None

        name = get_field("назва", "name", "object_name", "назва_обєкта", "title")
        if not name:
            return None

        source_id = get_field("id", "номер", "permit_number", "declaration_number")
        if not source_id:
            import hashlib
            source_id = hashlib.md5(str(raw).encode()).hexdigest()[:16]

        city = get_field("місто", "city", "населений_пункт", "locality")
        oblast = get_field("область", "oblast", "region")
        address = get_field("адреса", "address", "вулиця")

        lat_str = get_field("lat", "latitude", "широта")
        lng_str = get_field("lng", "lon", "longitude", "longitude", "довгота")
        lat = float(lat_str) if lat_str else None
        lng = float(lng_str) if lng_str else None

        return ParsedObject(
            name=name,
            source=self.source_name,
            source_id=source_id,
            address=address,
            city=city,
            oblast=oblast,
            latitude=lat,
            longitude=lng,
            status="approved",
            raw_data={k: v for k, v in raw.items() if k != "_dataset"},
        )
