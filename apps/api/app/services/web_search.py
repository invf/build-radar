"""Find official website URL for a company or object.
Strategy: try multiple approaches with fallback.
"""
from __future__ import annotations

import logging
import re
import urllib.parse

import httpx

logger = logging.getLogger(__name__)

_TIMEOUT = 8.0
_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "uk-UA,uk;q=0.9,ru;q=0.5,en-US;q=0.3",
    "Accept-Encoding": "gzip, deflate, br",
    "Connection": "keep-alive",
}

_GENERIC_PLACE_NAMES = {
    "житловий комплекс", "жк", "будинок", "многоквартирний будинок",
    "багатоквартирний будинок", "residential complex", "apartment complex",
}


def _is_generic_name(name: str) -> bool:
    return name.lower().strip() in _GENERIC_PLACE_NAMES


def _build_query(name: str, city: str | None, entity_hint: str, address: str | None) -> list[str]:
    """Return ordered list of queries to try, from most specific to broadest."""
    queries: list[str] = []

    if _is_generic_name(name) and address:
        # Address looks like "Житловий комплекс, вул. Романа Мстиславича, Воскресенка, Київ, ..."
        # Skip the first part (it's the generic name again), use street + district
        parts = [p.strip() for p in address.split(",") if p.strip()]
        # Drop parts that duplicate the generic name or are too short
        meaningful = [
            p for p in parts
            if len(p) > 4 and p.lower() != name.lower() and not p[:5].isdigit()
        ]
        if meaningful:
            # Primary: street + district/area + city + hint
            street_parts = meaningful[:3]
            if city and not any(city.lower() in p.lower() for p in street_parts):
                street_parts.append(city)
            queries.append(" ".join(street_parts) + f" {entity_hint}")
            # Secondary: just street + city + hint (broader)
            if len(meaningful) >= 2:
                queries.append(f"{meaningful[0]} {city or ''} {entity_hint}".strip())

    # Always include a fallback with the original name
    quoted = f'"{name}"'
    fallback = f"{quoted} {city} {entity_hint}" if city else f"{quoted} {entity_hint}"
    if fallback not in queries:
        queries.append(fallback)

    return queries


_SKIP_DOMAINS = {
    "facebook.com", "instagram.com", "youtube.com", "t.me",
    "twitter.com", "x.com", "linkedin.com", "tiktok.com", "ok.ru",
    "google.com", "google.com.ua", "bing.com", "yahoo.com",
    "wikipedia.org", "lun.ua", "dom.ria.com", "olx.ua", "prom.ua",
    "prozorro.gov.ua", "data.gov.ua", "opendatabot.ua",
    "youcontrol.com.ua", "clarity.fm",
}


def _is_useful_url(url: str) -> bool:
    try:
        parsed = urllib.parse.urlparse(url)
        domain = parsed.netloc.lower().removeprefix("www.")
        if not domain or parsed.scheme not in ("http", "https"):
            return False
        return not any(domain == s or domain.endswith("." + s) for s in _SKIP_DOMAINS)
    except Exception:
        return False


def _extract_first_href(html: str) -> list[str]:
    """Extract href URLs from raw HTML."""
    found: list[str] = []
    # Standard href pattern
    for m in re.finditer(r'href=["\']?(https?://[^\s"\'<>]+)', html):
        url = m.group(1).split("\"")[0].split("'")[0]
        found.append(url)
    return found


# ── DuckDuckGo lite (GET, no JS, less bot detection) ─────────────────────────

async def _search_ddg_lite(query: str) -> str | None:
    url = f"https://lite.duckduckgo.com/lite/?q={urllib.parse.quote(query)}&kl=ua-uk"
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT, headers=_HEADERS, follow_redirects=True) as client:
            resp = await client.get(url)
            if resp.status_code != 200:
                return None
            html = resp.text
            for href in _extract_first_href(html):
                if _is_useful_url(href):
                    return href
    except Exception as e:
        logger.debug(f"DDG lite failed: {e}")
    return None


# ── Google (parse first organic result) ──────────────────────────────────────

async def _search_google(query: str) -> str | None:
    url = (
        "https://www.google.com/search?"
        + urllib.parse.urlencode({"q": query, "hl": "uk", "gl": "ua", "num": "5"})
    )
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT, headers=_HEADERS, follow_redirects=True) as client:
            resp = await client.get(url)
            if resp.status_code != 200:
                return None
            html = resp.text
            # Google result links are wrapped in /url?q= redirects
            for m in re.finditer(r'/url\?q=(https?://[^&"]+)', html):
                href = urllib.parse.unquote(m.group(1))
                if _is_useful_url(href):
                    return href
            # Also try direct hrefs
            for href in _extract_first_href(html):
                if _is_useful_url(href):
                    return href
    except Exception as e:
        logger.debug(f"Google search failed: {e}")
    return None


# ── Bing ──────────────────────────────────────────────────────────────────────

async def _search_bing(query: str) -> str | None:
    url = (
        "https://www.bing.com/search?"
        + urllib.parse.urlencode({"q": query, "setmkt": "uk-UA", "count": "5"})
    )
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT, headers=_HEADERS, follow_redirects=True) as client:
            resp = await client.get(url)
            if resp.status_code != 200:
                return None
            html = resp.text
            for m in re.finditer(r'<cite[^>]*>(https?://[^<]+)</cite>', html):
                href = m.group(1).strip()
                if _is_useful_url(href):
                    return "https://" + href.split("//", 1)[-1] if "://" in href else "https://" + href
            for href in _extract_first_href(html):
                if _is_useful_url(href):
                    return href
    except Exception as e:
        logger.debug(f"Bing search failed: {e}")
    return None


# ── Public API ────────────────────────────────────────────────────────────────

async def find_website(
    name: str,
    city: str | None = None,
    entity_hint: str = "офіційний сайт",
    address: str | None = None,
) -> str | None:
    """Try multiple search engines and return the first plausible website URL."""
    queries = _build_query(name, city, entity_hint, address)

    for query in queries:
        logger.info(f"Searching website: {query}")
        for fn in (_search_ddg_lite, _search_google, _search_bing):
            result = await fn(query)
            if result:
                logger.info(f"Found via {fn.__name__} (query={query!r}): {result}")
                return result

    logger.info(f"No website found for '{name}'")
    return None
