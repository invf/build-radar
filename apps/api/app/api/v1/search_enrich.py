"""AI-powered search result enrichment.

Given a name + city (from OSM or ЄДРПОУ result), finds the official website,
scrapes it, and extracts structured info (developer, contacts, description).
"""
from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from ...core.dependencies import get_current_user
from ...models.user import User
from ...services import web_search as web_search_svc
from ...services import web_scraper as web_scraper_svc
from ...ai.client import get_ai_client

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/search", tags=["search"])


class EnrichRequest(BaseModel):
    name: str
    city: Optional[str] = None
    entity_type: str = "object"   # "object" | "company"
    website_url: Optional[str] = None   # skip web search if already known


class EnrichResult(BaseModel):
    name: str
    website: Optional[str] = None
    developer: Optional[str] = None
    developer_edrpou: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    description: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    category: Optional[str] = None
    floors: Optional[int] = None
    status: Optional[str] = None
    confidence: str = "low"
    note: Optional[str] = None
    source_url: Optional[str] = None


_EXTRACTION_PROMPT = """Ти аналізуєш текст офіційного сайту українського будівельного об'єкта або компанії.
Назва: {name}
URL: {url}

Текст сторінки:
---
{text}
---

Витягни та поверни JSON з полями (якщо є на сайті):
- developer: назва компанії-забудовника або власника
- developer_edrpou: ЄДРПОУ забудовника (8 цифр)
- phone: телефон (формат +380...)
- email: email
- description: короткий опис проекту/компанії (1-2 речення, українською)
- address: фізична адреса
- city: місто
- category: тип об'єкту (житловий комплекс / ТРЦ / офісний центр / виробничий / школа / тощо)
- floors: кількість поверхів (число)
- status: статус будівництва якщо згадується (планується / будується / завершено)

Якщо поле відсутнє — не включай його в JSON.
Відповідь тільки JSON, без пояснень.
"""


@router.post("/enrich-place", response_model=EnrichResult)
async def enrich_place(
    body: EnrichRequest,
    _: User = Depends(get_current_user),
) -> EnrichResult:
    """
    AI enrichment for a search result (OSM place or ЄДРПОУ company).

    1. If website_url not provided — searches the web for official site.
    2. Scrapes the page.
    3. Uses AI to extract structured fields.
    """
    name = body.name.strip()
    city = body.city

    # Step 1: find website
    url = body.website_url
    if not url:
        hint = "офіційний сайт ЖК" if body.entity_type == "object" else "офіційний сайт"
        url = await web_search_svc.find_website(name, city, hint)

    if not url:
        return EnrichResult(
            name=name,
            confidence="low",
            note="Сайт не знайдено. Уточніть назву або вкажіть URL вручну.",
        )

    # Step 2: scrape
    page = await web_scraper_svc.scrape_page(url)

    if not page.text and page.error:
        return EnrichResult(
            name=name,
            website=url,
            phone=page.phone,
            email=page.email,
            confidence="low",
            note=f"Не вдалося відкрити сайт: {page.error}",
            source_url=url,
        )

    # Step 3: AI extraction
    try:
        client = get_ai_client()
        prompt = _EXTRACTION_PROMPT.format(
            name=name,
            url=url,
            text=(page.text or "")[:4000],
        )
        raw = await client.complete(prompt, max_tokens=600)

        import json, re
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            m = re.search(r'\{.*\}', raw, re.DOTALL)
            data = json.loads(m.group()) if m else {}

        return EnrichResult(
            name=name,
            website=url,
            source_url=url,
            phone=data.get("phone") or page.phone,
            email=data.get("email") or page.email,
            developer=data.get("developer"),
            developer_edrpou=data.get("developer_edrpou"),
            description=data.get("description"),
            address=data.get("address"),
            city=data.get("city") or city,
            category=data.get("category"),
            floors=data.get("floors"),
            status=data.get("status"),
            confidence="high",
        )
    except Exception as exc:
        logger.exception("AI enrich failed for '%s': %s", name, exc)
        return EnrichResult(
            name=name,
            website=url,
            phone=page.phone,
            email=page.email,
            source_url=url,
            confidence="medium",
            note="ШІ не зміг розібрати дані, але сайт знайдено.",
        )
