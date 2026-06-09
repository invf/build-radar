"""World Bank Projects API provider.

Public endpoint — no API key required.
https://search.worldbank.org/api/v2/projects
"""
from __future__ import annotations
import logging
from typing import Optional
import httpx

from ..base import TenderProvider, UniversalTenderResult
from ..scoring import score_tender, matches_query

logger = logging.getLogger(__name__)

_BASE = "https://search.worldbank.org/api/v2/projects"
_TIMEOUT = 15.0
_HEADERS = {
    "User-Agent": "BuildRadar/1.0 (construction intelligence platform)",
    "Accept": "application/json",
}

# Sector codes relevant to heating / water / energy infrastructure
_RELEVANT_SECTORS = "WZ,EY,YW,EP,TW"  # Water, Energy, Public admin, Transport, Urban


class WorldBankProvider(TenderProvider):
    id = "world_bank"
    label = "World Bank"

    async def search(
        self,
        q: Optional[str],
        filters: dict,
        limit: int,
    ) -> list[UniversalTenderResult]:
        params: dict = {
            "format": "json",
            "source": "IBRD,IDA,TRUST",
            "fl": (
                "id,project_name,totalamt,url,boardapprovaldate,"
                "closingdate,countryshortname,country_namecode,"
                "sector,borrower,status,regionname"
            ),
            "rows": min(limit, 50),
            "os": 0,
            "sectorcode": _RELEVANT_SECTORS,
        }
        if q:
            params["q"] = q

        try:
            async with httpx.AsyncClient(timeout=_TIMEOUT, headers=_HEADERS) as client:
                resp = await client.get(_BASE, params=params)
                resp.raise_for_status()
                data = resp.json()
        except (httpx.TimeoutException, httpx.HTTPError, Exception) as exc:
            logger.warning("WorldBank API error: %s", exc)
            return []

        projects = data.get("projects", {})
        results: list[UniversalTenderResult] = []

        for proj_id, proj in projects.items():
            if proj_id in ("total", "totalAmt"):
                continue
            if not isinstance(proj, dict):
                continue

            result = self._map(proj)
            if result is None:
                continue

            search_text = f"{result.title} {result.sector or ''} {result.country or ''}"
            if q and not matches_query(search_text, q):
                continue

            results.append(result)

        return results[:limit]

    def _map(self, proj: dict) -> Optional[UniversalTenderResult]:
        title = proj.get("project_name", "").strip()
        if not title:
            return None

        proj_id = proj.get("id", "")
        url = proj.get("url") or f"https://projects.worldbank.org/en/projects-operations/project-detail/{proj_id}"

        # Amount: stored in thousands USD in WB API
        raw_amt = proj.get("totalamt")
        try:
            amount = float(raw_amt) * 1000 if raw_amt else None
        except (TypeError, ValueError):
            amount = None

        country = _extract_country(proj.get("countryshortname") or proj.get("country_namecode", ""))
        region = proj.get("regionname", "")
        sector = _extract_sector(proj.get("sector", ""))
        borrower = proj.get("borrower", "")
        closing = proj.get("closingdate", "")[:10] if proj.get("closingdate") else None
        board_date = proj.get("boardapprovaldate", "")[:10] if proj.get("boardapprovaldate") else None
        status_raw = (proj.get("status") or "active").lower()
        status = "active" if "active" in status_raw else "complete"

        priority, supply_match = score_tender(
            title=title,
            amount=amount,
            currency="USD",
            country=country,
            sector=sector,
        )

        return UniversalTenderResult(
            id=f"wb-{proj_id}",
            source="World Bank",
            title=title,
            status=status,
            amount=amount,
            currency="USD",
            deadline=closing,
            published_at=board_date,
            procuring_entity=borrower or None,
            country=country or None,
            region=region or None,
            donor="World Bank",
            sector=sector or None,
            cpv_codes=[],
            source_url=url,
            priority=priority,
            supply_match=supply_match,
        )


def _extract_country(raw: str) -> str:
    """Normalise World Bank country field (may be CSV or code;name)."""
    if not raw:
        return ""
    # Remove codes like "UA;Ukraine" → "Ukraine"
    parts = raw.split(";")
    if len(parts) == 2 and len(parts[0]) <= 3:
        return parts[1].strip()
    return raw.split(",")[0].strip()


def _extract_sector(raw) -> str:
    """Flatten sector — WB returns either str or list."""
    if isinstance(raw, list):
        parts = []
        for item in raw:
            if isinstance(item, dict):
                parts.append(item.get("Name") or item.get("name") or "")
            else:
                parts.append(str(item))
        return ", ".join(p for p in parts if p)
    if isinstance(raw, dict):
        return raw.get("Name") or raw.get("name") or ""
    return str(raw or "")
