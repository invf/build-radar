"""OpenStreetMap helpers: Nominatim (address/place search) + Overpass (spatial queries).

Both APIs are free and require no registration.
Rate-limit policy: ≤ 1 req/sec to Nominatim; Overpass is more forgiving.
"""
import logging
import re
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

_NOMINATIM = "https://nominatim.openstreetmap.org"
_OVERPASS = "https://overpass-api.de/api/interpreter"
_TIMEOUT = 15.0
_HEADERS = {"User-Agent": "BuildRadar/1.0 (buildradar.ua)"}

# oblast name → short form used in Nominatim state field
_OBLAST_MAP = {
    "Вінницька область": "Вінницька",
    "Волинська область": "Волинська",
    "Дніпропетровська область": "Дніпропетровська",
    "Донецька область": "Донецька",
    "Житомирська область": "Житомирська",
    "Закарпатська область": "Закарпатська",
    "Запорізька область": "Запорізька",
    "Івано-Франківська область": "Івано-Франківська",
    "Київська область": "Київська",
    "Кіровоградська область": "Кіровоградська",
    "Луганська область": "Луганська",
    "Львівська область": "Львівська",
    "Миколаївська область": "Миколаївська",
    "Одеська область": "Одеська",
    "Полтавська область": "Полтавська",
    "Рівненська область": "Рівненська",
    "Сумська область": "Сумська",
    "Тернопільська область": "Тернопільська",
    "Харківська область": "Харківська",
    "Херсонська область": "Херсонська",
    "Хмельницька область": "Хмельницька",
    "Черкаська область": "Черкаська",
    "Чернівецька область": "Чернівецька",
    "Чернігівська область": "Чернігівська",
    "місто Київ": "м. Київ",
    "Київ": "м. Київ",
}


def _parse_oblast(state: str) -> str:
    for full, short in _OBLAST_MAP.items():
        if full.lower() in state.lower() or short.lower() in state.lower():
            return short
    return state


def _normalize_nominatim(item: dict) -> dict:
    addr = item.get("address", {})
    city = (
        addr.get("city")
        or addr.get("town")
        or addr.get("village")
        or addr.get("municipality")
        or ""
    )
    state_raw = addr.get("state") or addr.get("county") or ""
    oblast = _parse_oblast(state_raw)

    road = addr.get("road") or addr.get("pedestrian") or addr.get("footway") or ""
    house = addr.get("house_number") or ""
    short_addr = f"{road}, {house}".strip(", ") if road else ""

    return {
        "osm_id": str(item.get("osm_id", "")),
        "osm_type": item.get("osm_type", ""),
        "display_name": item.get("display_name", ""),
        "name": item.get("namedetails", {}).get("name") or item.get("name") or short_addr or city,
        "address": short_addr,
        "city": city,
        "oblast": oblast,
        "lat": float(item["lat"]),
        "lng": float(item["lon"]),
        "type": item.get("type", ""),
        "category": item.get("class", ""),
        "floors": _parse_floors(item.get("extratags", {})),
        "building_type": (item.get("extratags") or {}).get("building") or "",
    }


def _parse_floors(tags: Optional[dict]) -> Optional[int]:
    if not tags:
        return None
    v = tags.get("building:levels") or tags.get("levels")
    if v:
        try:
            return int(re.sub(r"\D", "", str(v)))
        except ValueError:
            pass
    return None


async def search_places(query: str, limit: int = 10) -> list[dict]:
    """Search Ukrainian addresses and POIs using Nominatim."""
    query = query.strip()
    if not query:
        return []
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT, headers=_HEADERS) as client:
            r = await client.get(
                f"{_NOMINATIM}/search",
                params={
                    "q": query,
                    "countrycodes": "ua",
                    "format": "json",
                    "limit": limit,
                    "addressdetails": 1,
                    "namedetails": 1,
                    "extratags": 1,
                },
            )
        r.raise_for_status()
        return [_normalize_nominatim(item) for item in r.json()]
    except Exception as exc:
        logger.warning("Nominatim search error: %s", exc)
        return []


async def reverse_geocode(lat: float, lng: float) -> Optional[dict]:
    """Reverse-geocode coordinates → address details."""
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT, headers=_HEADERS) as client:
            r = await client.get(
                f"{_NOMINATIM}/reverse",
                params={
                    "lat": lat,
                    "lon": lng,
                    "format": "json",
                    "addressdetails": 1,
                    "extratags": 1,
                },
            )
        r.raise_for_status()
        data = r.json()
        if "error" in data:
            return None
        return _normalize_nominatim(data)
    except Exception as exc:
        logger.warning("Nominatim reverse error: %s", exc)
        return None


async def search_buildings_nearby(lat: float, lng: float, radius_m: int = 300) -> list[dict]:
    """Query Overpass for buildings within radius_m metres of a point."""
    overpass_query = f"""
[out:json][timeout:20];
(
  way["building"](around:{radius_m},{lat},{lng});
  relation["building"](around:{radius_m},{lat},{lng});
);
out center tags;
"""
    try:
        async with httpx.AsyncClient(timeout=25.0, headers=_HEADERS) as client:
            r = await client.post(_OVERPASS, data=overpass_query)
        r.raise_for_status()
        elements = r.json().get("elements", [])
        results = []
        for el in elements:
            tags = el.get("tags", {})
            center = el.get("center", {})
            if not center:
                continue
            name = tags.get("name") or tags.get("addr:street", "") + " " + tags.get("addr:housenumber", "")
            results.append({
                "osm_id": str(el.get("id", "")),
                "osm_type": el.get("type", ""),
                "name": name.strip(),
                "address": (
                    (tags.get("addr:street") or "")
                    + (" " + tags.get("addr:housenumber", "")).rstrip()
                ).strip(),
                "city": tags.get("addr:city") or tags.get("addr:place") or "",
                "lat": center.get("lat"),
                "lng": center.get("lon"),
                "floors": _parse_floors(tags),
                "building_type": tags.get("building") or "",
                "display_name": name.strip(),
            })
        return results
    except Exception as exc:
        logger.warning("Overpass nearby error: %s", exc)
        return []
