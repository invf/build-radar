"""Live Prozorro tender search — keyword + CPV/DK code filter.

Searches Prozorro public API without saving to DB.
Results can be selectively imported via POST /api/v1/tenders.
"""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from ...core.dependencies import get_current_user
from ...models.user import User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/prozorro", tags=["prozorro"])

_BASE = "https://public.api.openprocurement.org/api/2.5"
_TIMEOUT = 20.0
_HEADERS = {"User-Agent": "BuildRadar/1.0 (buildradar.ua)"}

# Common DK021 CPV codes for HVAC / heating / pumps — user can override
DEFAULT_CONSTRUCTION_CPV = "45"  # all construction works


class ProzorroTenderResult(BaseModel):
    prozorro_id: str
    title: str
    status: str
    amount: Optional[float] = None
    currency: str = "UAH"
    deadline: Optional[str] = None
    procuring_entity: Optional[str] = None
    procuring_entity_edrpou: Optional[str] = None
    city: Optional[str] = None
    oblast: Optional[str] = None
    cpv_codes: list[str] = []
    prozorro_url: str


async def _fetch(client: httpx.AsyncClient, url: str, params: dict) -> dict:
    r = await client.get(url, params=params, headers=_HEADERS, timeout=_TIMEOUT)
    r.raise_for_status()
    return r.json()


def _normalize(raw: dict) -> ProzorroTenderResult:
    tender_id = raw.get("id", "")
    procuring = raw.get("procuringEntity", {})
    address = procuring.get("address", {})

    deadline_str = raw.get("tenderPeriod", {}).get("endDate") or raw.get("enquiryPeriod", {}).get("endDate")
    deadline = None
    if deadline_str:
        try:
            dt = datetime.fromisoformat(deadline_str.replace("Z", "+00:00"))
            deadline = dt.isoformat()
        except (ValueError, AttributeError):
            deadline = deadline_str

    cpv_codes = list({
        item.get("classification", {}).get("id", "")
        for item in raw.get("items", [])
        if item.get("classification", {}).get("id")
    })

    return ProzorroTenderResult(
        prozorro_id=tender_id,
        title=raw.get("title", ""),
        status=raw.get("status", "active"),
        amount=raw.get("value", {}).get("amount"),
        currency=raw.get("value", {}).get("currency", "UAH"),
        deadline=deadline,
        procuring_entity=procuring.get("name"),
        procuring_entity_edrpou=procuring.get("identifier", {}).get("id"),
        city=address.get("locality"),
        oblast=address.get("region"),
        cpv_codes=cpv_codes,
        prozorro_url=f"https://prozorro.gov.ua/tender/{tender_id}",
    )


def _matches_keyword(raw: dict, keyword: str) -> bool:
    kw = keyword.lower()
    title = (raw.get("title") or "").lower()
    description = (raw.get("description") or "").lower()
    items = raw.get("items", [])
    item_desc = " ".join((it.get("description") or "") for it in items).lower()
    return kw in title or kw in description or kw in item_desc


def _matches_cpv(raw: dict, cpv_prefix: str) -> bool:
    for item in raw.get("items", []):
        code = item.get("classification", {}).get("id", "")
        if code.startswith(cpv_prefix):
            return True
    return False


@router.get("/search", response_model=list[ProzorroTenderResult])
async def search_prozorro(
    q: Optional[str] = Query(None, description="Ключове слово (у назві або описі тендеру)"),
    cpv: Optional[str] = Query(None, description="CPV/DK021 код або префікс (напр. '44115', '39715')"),
    status: Optional[str] = Query("active", description="Статус: active | complete | cancelled | unsuccessful"),
    limit: int = Query(30, ge=1, le=100, description="Максимальна кількість результатів"),
    _: User = Depends(get_current_user),
):
    """
    Live search Prozorro tenders by keyword and/or CPV code.

    - `q` — text in title/description (e.g. 'теплообмінник', 'насоси')
    - `cpv` — CPV code prefix (e.g. '44115' for heating equipment, '39715' for boilers)
    - At least one of `q` or `cpv` is required.
    """
    if not q and not cpv:
        raise HTTPException(status_code=400, detail="Вкажіть ключове слово (q) або CPV код (cpv)")

    results: list[ProzorroTenderResult] = []
    offset = None
    # Fetch enough pages to collect `limit` matching results
    max_fetch_pages = 20  # safety cap — each page = 100 tenders

    async with httpx.AsyncClient() as client:
        for page_num in range(max_fetch_pages):
            if len(results) >= limit:
                break

            params: dict = {
                "limit": 100,
                "opt_fields": "title,status,value,procuringEntity,tenderPeriod,enquiryPeriod,items,description",
            }
            if status and status != "all":
                params["status"] = status
            if offset:
                params["offset"] = offset

            try:
                data = await _fetch(client, f"{_BASE}/tenders", params)
            except httpx.HTTPError as e:
                logger.warning("Prozorro API error on page %d: %s", page_num, e)
                break

            tenders_refs = data.get("data", [])
            if not tenders_refs:
                break

            # Fetch each tender detail concurrently in batches of 10
            batch_size = 10
            for i in range(0, len(tenders_refs), batch_size):
                if len(results) >= limit:
                    break
                batch = tenders_refs[i: i + batch_size]
                tasks = [
                    _fetch(client, f"{_BASE}/tenders/{ref['id']}", {})
                    for ref in batch if ref.get("id")
                ]
                try:
                    responses = await asyncio.gather(*tasks, return_exceptions=True)
                except Exception:
                    continue

                for resp in responses:
                    if isinstance(resp, Exception):
                        continue
                    raw = resp.get("data", {})
                    if not raw:
                        continue

                    # Apply filters
                    if q and not _matches_keyword(raw, q):
                        continue
                    if cpv and not _matches_cpv(raw, cpv):
                        continue

                    results.append(_normalize(raw))
                    if len(results) >= limit:
                        break

                await asyncio.sleep(0.1)

            next_page = data.get("next_page", {})
            offset = next_page.get("offset") if next_page else None
            if not offset:
                break

            await asyncio.sleep(0.3)

    return results[:limit]
