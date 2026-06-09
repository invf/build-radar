"""Abstract tender provider and shared result model."""
from __future__ import annotations
from abc import ABC, abstractmethod
from typing import Optional
from pydantic import BaseModel


class UniversalTenderResult(BaseModel):
    """Unified tender result — works for Prozorro and all international sources."""
    id: str
    source: str                          # 'prozorro' | 'nefco' | 'ebrd' | ...
    title: str
    status: str = "active"
    amount: Optional[float] = None
    currency: str = "USD"
    deadline: Optional[str] = None
    published_at: Optional[str] = None
    procuring_entity: Optional[str] = None
    # Location
    city: Optional[str] = None
    country: Optional[str] = None
    region: Optional[str] = None
    # Classification
    donor: Optional[str] = None          # sponsoring organisation
    sector: Optional[str] = None
    cpv_codes: list[str] = []
    # Link
    source_url: str
    # Scoring
    priority: str = "low"               # high | medium | low
    supply_match: str = "none"          # full | partial | none


class TenderProvider(ABC):
    """Abstract base for every tender data source."""

    id: str    # machine identifier, e.g. 'world_bank'
    label: str  # human label, e.g. 'World Bank'

    @abstractmethod
    async def search(
        self,
        q: Optional[str],
        filters: dict,
        limit: int,
    ) -> list[UniversalTenderResult]:
        """Return up to `limit` tenders matching the query and filters."""
        ...
