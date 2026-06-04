"""ЄДРПОУ company registry lookup via opendatabot.ua.

Without OPENDATABOT_API_KEY the service still works but is rate-limited to
~10 req/day per IP.  Register at https://opendatabot.ua for a free key.
"""
import logging
from typing import Optional

import httpx

from ..core.config import settings

logger = logging.getLogger(__name__)

_BASE = "https://opendatabot.ua/api/v2"
_TIMEOUT = 10.0


def _headers() -> dict:
    h = {"Accept": "application/json", "User-Agent": "BuildRadar/1.0"}
    if settings.opendatabot_api_key:
        h["Authorization"] = f"Bearer {settings.opendatabot_api_key}"
    return h


def _token_param() -> dict:
    if settings.opendatabot_api_key:
        return {"token": settings.opendatabot_api_key}
    return {}


def _normalize(data: dict) -> dict:
    """Map opendatabot fields → our Company schema fields."""
    return {
        "edrpou": data.get("code") or data.get("edrpou") or "",
        "name": data.get("name") or data.get("short_name") or "",
        "full_name": data.get("full_name") or data.get("name") or "",
        "address": data.get("address") or "",
        "status": data.get("status") or "",
        "registration_date": data.get("registration_date") or "",
        "ceo": data.get("ceo") or data.get("boss") or "",
        "activity": data.get("activity") or data.get("kved") or "",
        "phone": data.get("phones") or data.get("phone") or "",
        "email": data.get("email") or "",
        "website": data.get("website") or "",
    }


async def get_by_edrpou(edrpou: str) -> Optional[dict]:
    """Fetch company by 8-digit ЄДРПОУ code. Returns None on miss."""
    edrpou = edrpou.strip()
    if not edrpou.isdigit():
        return None
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            r = await client.get(
                f"{_BASE}/company/{edrpou}",
                params=_token_param(),
                headers=_headers(),
            )
        if r.status_code == 404:
            return None
        r.raise_for_status()
        payload = r.json()
        data = payload.get("data") or payload
        if not data:
            return None
        return _normalize(data)
    except httpx.HTTPStatusError as exc:
        logger.warning("opendatabot GET company/%s → %s", edrpou, exc.response.status_code)
        return None
    except Exception as exc:
        logger.warning("opendatabot error: %s", exc)
        return None


async def search_companies(query: str, limit: int = 10) -> list[dict]:
    """Search companies by name or ЄДРПОУ code."""
    query = query.strip()
    if not query:
        return []

    # If looks like a code, do direct lookup
    if query.isdigit() and len(query) >= 6:
        result = await get_by_edrpou(query)
        return [result] if result else []

    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            r = await client.get(
                f"{_BASE}/search",
                params={**_token_param(), "text": query, "limit": limit},
                headers=_headers(),
            )
        if r.status_code in (401, 403):
            logger.warning("opendatabot: unauthorized — set OPENDATABOT_API_KEY")
            return []
        r.raise_for_status()
        payload = r.json()
        items = payload.get("data") or payload.get("items") or []
        if isinstance(items, dict):
            items = list(items.values())
        return [_normalize(item) for item in items[:limit]]
    except Exception as exc:
        logger.warning("opendatabot search error: %s", exc)
        return []
