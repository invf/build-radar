"""Provider registry — aggregates results from all international tender sources."""
from __future__ import annotations
import asyncio
import logging
from typing import Optional

from .base import UniversalTenderResult
from .providers.demo import DemoProvider
from .providers.world_bank import WorldBankProvider

logger = logging.getLogger(__name__)

# ── Registered providers ──────────────────────────────────────────────────────
# Add new providers here to make them discoverable.
_PROVIDERS = [
    DemoProvider(),
    WorldBankProvider(),
]

DONOR_LABELS: list[str] = [
    "NEFCO", "GIZ", "EBRD", "World Bank", "EIB", "KfW",
    "UNDP", "UNICEF", "UNOPS", "USAID", "AFD",
    "European Commission", "IFC",
]

COUNTRY_LABELS: list[str] = [
    "Ukraine", "Moldova", "Georgia", "Armenia", "Azerbaijan",
    "Kyrgyzstan", "Tajikistan", "Uzbekistan", "Belarus",
]

SECTOR_LABELS: list[str] = [
    "District Heating", "Heat Substations", "Water Supply",
    "Water & Sanitation", "Energy Efficiency", "Heating Equipment",
    "Water & Heating", "Energy Resilience", "Heat Exchange",
]


async def get_all_results(
    q: Optional[str],
    filters: dict,
    limit: int = 50,
) -> list[UniversalTenderResult]:
    """Query all providers in parallel, merge, filter, sort by priority."""
    per_provider = max(limit, 50)  # fetch more so cross-filter still returns enough

    tasks = [p.search(q, filters, per_provider) for p in _PROVIDERS]
    nested = await asyncio.gather(*tasks, return_exceptions=True)

    all_results: list[UniversalTenderResult] = []
    for res in nested:
        if isinstance(res, Exception):
            logger.warning("Provider error: %s", res)
            continue
        all_results.extend(res)

    # ── Cross-provider filters ────────────────────────────────────────────────
    country = (filters.get("country") or "").strip().lower()
    if country:
        all_results = [r for r in all_results if country in (r.country or "").lower()]

    donor = (filters.get("donor") or "").strip().lower()
    if donor:
        all_results = [r for r in all_results
                       if donor in (r.donor or "").lower() or donor in r.source.lower()]

    sector = (filters.get("sector") or "").strip().lower()
    if sector:
        all_results = [r for r in all_results if sector in (r.sector or "").lower()]

    if filters.get("relevant_only"):
        all_results = [r for r in all_results if r.supply_match != "none"]

    deadline_from = (filters.get("deadline_from") or "").strip()
    if deadline_from:
        all_results = [r for r in all_results
                       if r.deadline and r.deadline >= deadline_from]

    deadline_to = (filters.get("deadline_to") or "").strip()
    if deadline_to:
        all_results = [r for r in all_results
                       if r.deadline and r.deadline <= deadline_to]

    min_budget = filters.get("min_budget")
    if min_budget:
        try:
            all_results = [r for r in all_results if (r.amount or 0) >= float(min_budget)]
        except (TypeError, ValueError):
            pass

    max_budget = filters.get("max_budget")
    if max_budget:
        try:
            all_results = [r for r in all_results if (r.amount or 0) <= float(max_budget)]
        except (TypeError, ValueError):
            pass

    # ── Dedup by id ───────────────────────────────────────────────────────────
    seen: set[str] = set()
    unique: list[UniversalTenderResult] = []
    for r in all_results:
        if r.id not in seen:
            seen.add(r.id)
            unique.append(r)

    # ── Sort by priority then amount ──────────────────────────────────────────
    _order = {"high": 0, "medium": 1, "low": 2}
    unique.sort(key=lambda r: (_order.get(r.priority, 2), -(r.amount or 0)))

    return unique[:limit]
