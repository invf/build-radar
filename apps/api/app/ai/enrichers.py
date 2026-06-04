"""AI enrichment — fills form fields from open-source knowledge."""
from __future__ import annotations
import json
import logging
import re

from .client import get_ai_client
from .prompts import (
    COMPANY_ENRICH_PROMPT, OBJECT_ENRICH_PROMPT,
    WEB_ENRICH_COMPANY_PROMPT, WEB_ENRICH_OBJECT_PROMPT,
)
from ..services import web_search as web_search_svc
from ..services import web_scraper as web_scraper_svc

logger = logging.getLogger(__name__)


def _parse_json(text: str) -> dict:
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        m = re.search(r'\{.*\}', text, re.DOTALL)
        if m:
            return json.loads(m.group())
        raise ValueError(f"No JSON in AI response: {text[:200]}")


async def enrich_company(name: str, edrpou: str | None = None) -> dict:
    client = get_ai_client()
    edrpou_line = f"ЄДРПОУ: {edrpou}" if edrpou else ""
    prompt = COMPANY_ENRICH_PROMPT.format(name=name, edrpou_line=edrpou_line)
    try:
        response = await client.complete(prompt, max_tokens=600)
        data = _parse_json(response)
        # Strip None values so frontend can merge cleanly
        return {k: v for k, v in data.items() if v is not None}
    except Exception as e:
        logger.exception(f"Company enrich failed for '{name}': {e}")
        return {"confidence": "low", "note": "ШІ не зміг отримати дані"}


async def enrich_from_web(
    name: str,
    entity_type: str,  # "company" | "object"
    city: str | None = None,
    provided_url: str | None = None,
) -> dict:
    """Find the entity's website, scrape it, and extract structured data using AI."""

    # Step 1: Find website (skip if URL already provided)
    url = provided_url
    if not url:
        hint = "офіційний сайт" if entity_type == "company" else "офіційний сайт ЖК"
        url = await web_search_svc.find_website(name, city, hint)

    if not url:
        return {
            "confidence": "low",
            "note": "Сайт не знайдено. Спробуйте вказати URL вручну.",
        }

    # Step 2: Scrape the website
    page = await web_scraper_svc.scrape_page(url)

    if page.error and not page.text:
        return {
            "website": url,
            "confidence": "low",
            "note": f"Не вдалося відкрити сайт: {page.error}",
        }

    # Step 3: AI extraction
    client = get_ai_client()
    prompt_template = (
        WEB_ENRICH_COMPANY_PROMPT if entity_type == "company" else WEB_ENRICH_OBJECT_PROMPT
    )
    prompt = prompt_template.format(
        name=name,
        url=url,
        text=page.text or "(текст недоступний)",
        images=str(page.images[:15]) if page.images else "[]",
    )

    try:
        response = await client.complete(prompt, max_tokens=1400)
        data = _parse_json(response)
    except Exception as e:
        logger.exception(f"Web enrich AI failed for '{name}': {e}")
        data = {}

    # Merge scraped contacts (fallback if AI missed them)
    if not data.get("phone") and page.phone:
        data["phone"] = page.phone
    if not data.get("email") and page.email:
        data["email"] = page.email
    if not data.get("website"):
        data["website"] = url

    # Remove nulls
    return {k: v for k, v in data.items() if v is not None}


async def enrich_object(name: str, address: str | None = None, city: str | None = None) -> dict:
    client = get_ai_client()
    address_line = f"Адреса: {address}" if address else ""
    city_line = f"Місто: {city}" if city else ""
    prompt = OBJECT_ENRICH_PROMPT.format(name=name, address_line=address_line, city_line=city_line)
    try:
        response = await client.complete(prompt, max_tokens=800)
        data = _parse_json(response)
        return {k: v for k, v in data.items() if v is not None}
    except Exception as e:
        logger.exception(f"Object enrich failed for '{name}': {e}")
        return {"confidence": "low", "note": "ШІ не зміг отримати дані"}
