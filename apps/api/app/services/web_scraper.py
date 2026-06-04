"""Async website scraper: fetches page, extracts text and image URLs.
Uses httpx + BeautifulSoup4/lxml.
"""
from __future__ import annotations

import logging
import re
import urllib.parse
from dataclasses import dataclass, field

import httpx
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

_TIMEOUT = 15.0
_MAX_TEXT_CHARS = 5000
_MAX_IMAGES = 20
_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/120.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "uk-UA,uk;q=0.9,en;q=0.8",
}

# Image src patterns to skip (icons, tracking pixels, loaders, etc.)
_IMG_SKIP_RE = re.compile(
    r"(data:|\.svg|icon|logo[_-]sm|favicon|spinner|placeholder|blank|pixel|tracking|analytics)",
    re.IGNORECASE,
)
# Likely photo extensions
_PHOTO_EXT_RE = re.compile(r"\.(jpg|jpeg|png|webp|avif)(\?|$)", re.IGNORECASE)


@dataclass
class ScrapedPage:
    url: str
    title: str
    text: str                    # cleaned text, max _MAX_TEXT_CHARS chars
    images: list[str] = field(default_factory=list)   # absolute photo URLs
    phone: str | None = None
    email: str | None = None
    error: str | None = None


def _absolute_url(src: str, base: str) -> str:
    """Convert relative/protocol-relative URL to absolute."""
    if src.startswith("//"):
        parsed = urllib.parse.urlparse(base)
        return f"{parsed.scheme}:{src}"
    if src.startswith("http"):
        return src
    return urllib.parse.urljoin(base, src)


def _extract_contact(text: str) -> tuple[str | None, str | None]:
    """Quick regex extraction of phone and email from text."""
    phone = email = None

    phone_m = re.search(
        r"(?:\+38)?[\s\-\(]?0\d{2}[\s\-]?\d{3}[\s\-]?\d{2}[\s\-]?\d{2}"
        r"|(?:\+38)?[\s\-\(]?0\d{9,10}",
        text,
    )
    if phone_m:
        phone = re.sub(r"[\s\-\(\)]", "", phone_m.group())

    email_m = re.search(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}", text)
    if email_m:
        email = email_m.group()

    return phone, email


async def scrape_page(url: str) -> ScrapedPage:
    """Fetch the page and extract text, images, and contact info."""
    try:
        async with httpx.AsyncClient(
            timeout=_TIMEOUT,
            headers=_HEADERS,
            follow_redirects=True,
            verify=False,          # some UA sites have self-signed certs
        ) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            html = resp.text
            final_url = str(resp.url)
    except httpx.HTTPStatusError as e:
        return ScrapedPage(url=url, title="", text="", error=f"HTTP {e.response.status_code}")
    except Exception as e:
        return ScrapedPage(url=url, title="", text="", error=str(e)[:120])

    try:
        soup = BeautifulSoup(html, "lxml")

        # Title
        title = soup.title.get_text(strip=True) if soup.title else ""

        # Remove clutter
        for tag in soup(["script", "style", "nav", "footer", "header",
                         "aside", "noscript", "iframe", "svg"]):
            tag.decompose()

        # Text
        raw_text = soup.get_text(separator="\n", strip=True)
        # Collapse blank lines
        lines = [ln for ln in raw_text.splitlines() if ln.strip()]
        text = "\n".join(lines)[:_MAX_TEXT_CHARS]

        # Images
        images: list[str] = []
        for img in soup.find_all("img"):
            src = img.get("src") or img.get("data-src") or img.get("data-lazy-src") or ""
            if not src or _IMG_SKIP_RE.search(src):
                continue
            abs_src = _absolute_url(src, final_url)
            if _PHOTO_EXT_RE.search(abs_src) or abs_src.startswith("http"):
                images.append(abs_src)
            if len(images) >= _MAX_IMAGES:
                break

        phone, email = _extract_contact(text)

        return ScrapedPage(
            url=final_url,
            title=title,
            text=text,
            images=images,
            phone=phone,
            email=email,
        )
    except Exception as e:
        logger.exception(f"Scraping parse error for {url}: {e}")
        return ScrapedPage(url=url, title="", text="", error=f"Parse error: {str(e)[:80]}")
