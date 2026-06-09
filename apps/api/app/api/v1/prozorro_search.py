"""Live Prozorro tender search — keyword + CPV/DK code filter.

Searches Prozorro public API without saving to DB.
Results can be selectively imported via POST /api/v1/tenders.
"""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone, date
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


# ── Priority / supply-match scoring ───────────────────────────────────────────

_PRODUCT_KEYWORDS = [
    "ітп", "тепловий пункт", "теплообмінник", "насосна станція",
    "насосне обладнання", "водопостачання", "водовідведення",
    "котельня", "тепломереж", "теплопостачання", "цтп", "енергоефективність",
]
_PRIORITY_REGIONS = ["київ", "дніпро", "львів"]


def _score_tender(
    amount: Optional[float], oblast: Optional[str], title: str
) -> tuple[str, str]:
    """Return (priority, supply_match) for a Prozorro tender."""
    title_lower = title.lower()
    matching = [kw for kw in _PRODUCT_KEYWORDS if kw in title_lower]

    if len(matching) >= 2:
        supply_match = "full"
    elif len(matching) == 1:
        supply_match = "partial"
    else:
        supply_match = "none"

    oblast_lower = (oblast or "").lower()
    is_priority_region = any(r in oblast_lower for r in _PRIORITY_REGIONS)
    amt = amount or 0

    if amt >= 5_000_000 and is_priority_region and matching:
        priority = "high"
    elif amt < 1_000_000 or not matching:
        priority = "low"
    else:
        priority = "medium"

    return priority, supply_match


# ── Result model ───────────────────────────────────────────────────────────────

class ProzorroTenderResult(BaseModel):
    prozorro_id: str
    title: str
    status: str
    amount: Optional[float] = None
    currency: str = "UAH"
    deadline: Optional[str] = None
    date_modified: Optional[str] = None
    procuring_entity: Optional[str] = None
    procuring_entity_edrpou: Optional[str] = None
    city: Optional[str] = None
    oblast: Optional[str] = None
    cpv_codes: list[str] = []
    prozorro_url: str
    priority: str = "low"        # high | medium | low
    supply_match: str = "none"   # full | partial | none


async def _fetch(client: httpx.AsyncClient, url: str, params: dict) -> dict:
    r = await client.get(url, params=params, headers=_HEADERS, timeout=_TIMEOUT)
    r.raise_for_status()
    return r.json()


def _parse_dt(dt_str: Optional[str]) -> Optional[datetime]:
    if not dt_str:
        return None
    try:
        return datetime.fromisoformat(dt_str.replace("Z", "+00:00"))
    except (ValueError, AttributeError):
        return None


def _normalize(raw: dict) -> ProzorroTenderResult:
    tender_id = raw.get("id", "")
    procuring = raw.get("procuringEntity", {})
    address = procuring.get("address", {})

    deadline_str = raw.get("tenderPeriod", {}).get("endDate") or raw.get("enquiryPeriod", {}).get("endDate")
    deadline_dt = _parse_dt(deadline_str)
    deadline = deadline_dt.isoformat() if deadline_dt else None

    date_modified_dt = _parse_dt(raw.get("dateModified"))
    date_modified = date_modified_dt.isoformat() if date_modified_dt else None

    cpv_codes = list({
        item.get("classification", {}).get("id", "")
        for item in raw.get("items", [])
        if item.get("classification", {}).get("id")
    })

    amount = raw.get("value", {}).get("amount")
    oblast = address.get("region")
    title = raw.get("title", "")
    priority, supply_match = _score_tender(amount, oblast, title)

    return ProzorroTenderResult(
        prozorro_id=tender_id,
        title=title,
        status=raw.get("status", "active"),
        amount=amount,
        currency=raw.get("value", {}).get("currency", "UAH"),
        deadline=deadline,
        date_modified=date_modified,
        procuring_entity=procuring.get("name"),
        procuring_entity_edrpou=procuring.get("identifier", {}).get("id"),
        city=address.get("locality"),
        oblast=oblast,
        cpv_codes=cpv_codes,
        prozorro_url=f"https://prozorro.gov.ua/tender/{tender_id}",
        priority=priority,
        supply_match=supply_match,
    )


def _matches_any_keyword(raw: dict, keywords: list[str]) -> bool:
    """Return True if the tender matches at least one of the keywords."""
    title = (raw.get("title") or "").lower()
    description = (raw.get("description") or "").lower()
    items = raw.get("items", [])
    item_desc = " ".join((it.get("description") or "") for it in items).lower()
    text = f"{title} {description} {item_desc}"
    return any(kw in text for kw in keywords)


def _matches_cpv(raw: dict, cpv_prefix: str) -> bool:
    for item in raw.get("items", []):
        code = item.get("classification", {}).get("id", "")
        if code.startswith(cpv_prefix):
            return True
    return False


def _deadline_in_range(
    raw: dict,
    deadline_from: Optional[date],
    deadline_to: Optional[date],
) -> bool:
    """Return False if tender deadline is outside the requested range."""
    if not deadline_from and not deadline_to:
        return True
    deadline_str = (
        raw.get("tenderPeriod", {}).get("endDate")
        or raw.get("enquiryPeriod", {}).get("endDate")
    )
    dt = _parse_dt(deadline_str)
    if dt is None:
        # No deadline info — include only when no lower bound is required
        return deadline_from is None
    d = dt.date()
    if deadline_from and d < deadline_from:
        return False
    if deadline_to and d > deadline_to:
        return False
    return True


@router.get("/search", response_model=list[ProzorroTenderResult])
async def search_prozorro(
    q: Optional[str] = Query(None, description="Ключові слова через кому (напр. 'ІТП,теплообмінник,насоси')"),
    cpv: Optional[str] = Query(None, description="CPV/DK021 код або префікс (напр. '44115', '39715')"),
    status: Optional[str] = Query("active", description="Статус: active | complete | cancelled | unsuccessful"),
    limit: int = Query(30, ge=1, le=100, description="Максимальна кількість результатів"),
    deadline_from: Optional[date] = Query(None, description="Дедлайн від (YYYY-MM-DD)"),
    deadline_to: Optional[date] = Query(None, description="Дедлайн до (YYYY-MM-DD)"),
    _: User = Depends(get_current_user),
):
    """
    Live search Prozorro tenders by keyword(s) and/or CPV code.

    Results are sorted newest-first (descending by dateModified).
    - `q` — comma-separated keywords; tender matches if ANY keyword found
      (e.g. 'ІТП,теплообмінник,насоси' — returns tenders with at least one term)
    - `cpv` — CPV code prefix (e.g. '44115' for heating equipment, '39715' for boilers)
    - `deadline_from` / `deadline_to` — filter by tender deadline date
    - At least one of `q` or `cpv` is required.
    """
    if not q and not cpv:
        raise HTTPException(status_code=400, detail="Вкажіть ключове слово (q) або CPV код (cpv)")

    # Split comma-separated terms, normalise to lowercase
    q_terms = [t.strip().lower() for t in (q or "").split(",") if t.strip()] if q else []

    results: list[ProzorroTenderResult] = []
    offset = None
    # 5 pages × 100 tenders = 500 scanned; keeps total time well under 30s
    max_fetch_pages = 5

    prozorro_reachable = False

    async with httpx.AsyncClient() as client:
        for page_num in range(max_fetch_pages):
            if len(results) >= limit:
                break

            params: dict = {
                "limit": 100,
                "descending": "1",  # newest tenders first
                "opt_fields": "title,status,value,procuringEntity,tenderPeriod,enquiryPeriod,items,description,dateModified",
            }
            if status and status != "all":
                params["status"] = status
            if offset:
                params["offset"] = offset

            try:
                data = await _fetch(client, f"{_BASE}/tenders", params)
                prozorro_reachable = True
            except httpx.TimeoutException:
                if not prozorro_reachable:
                    raise HTTPException(status_code=503, detail="Prozorro API не відповідає (timeout). Спробуйте пізніше.")
                break
            except httpx.HTTPStatusError as e:
                if not prozorro_reachable:
                    raise HTTPException(status_code=503, detail=f"Prozorro повернув помилку {e.response.status_code}. Спробуйте пізніше.")
                break
            except httpx.HTTPError:
                if not prozorro_reachable:
                    raise HTTPException(status_code=503, detail="Не вдалось підключитись до Prozorro. Спробуйте пізніше.")
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
                    if q_terms and not _matches_any_keyword(raw, q_terms):
                        continue
                    if cpv and not _matches_cpv(raw, cpv):
                        continue
                    if not _deadline_in_range(raw, deadline_from, deadline_to):
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
