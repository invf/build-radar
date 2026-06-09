"""Shared tender scoring — reuses the same keyword logic as Prozorro scoring."""
from typing import Optional

# Domain-specific keywords (Ukrainian + English) for heating / water infra
_PRODUCT_KEYWORDS: list[str] = [
    # Ukrainian
    "тепловий пункт", "ітп", "котельня", "теплопостачання", "теплообмінник",
    "насосна станція", "насоси", "водопостачання", "водовідведення",
    "теплові мережі", "енергоефективність", "тепломережа", "реконструкція тепло",
    # English
    "heat exchanger", "district heating", "heat substation", "pumping station",
    "boiler", "thermal energy", "water supply", "water treatment",
    "heating system", "energy efficiency", "heat network", "itp",
    "heat point", "hvac", "heat pump", "piping rehabilitation",
    "infrastructure modernization", "utility modernization",
]

_PRIORITY_COUNTRIES: list[str] = [
    "ukraine", "moldova", "georgia", "armenia", "azerbaijan",
    "kyrgyzstan", "tajikistan", "uzbekistan",
]

# Approximate UAH exchange rates for priority budget normalisation
_CURRENCY_TO_UAH: dict[str, float] = {
    "UAH": 1.0,
    "USD": 40.0,
    "EUR": 44.0,
    "GBP": 50.0,
    "CHF": 45.0,
    "SEK": 3.8,
    "NOK": 3.7,
    "DKK": 5.9,
    "JPY": 0.27,
}


def score_tender(
    title: str,
    amount: Optional[float],
    currency: str,
    country: Optional[str],
    sector: Optional[str] = None,
) -> tuple[str, str]:
    """Return (priority, supply_match) for any universal tender."""
    text = f"{title} {sector or ''}".lower()
    matching = [kw for kw in _PRODUCT_KEYWORDS if kw in text]

    if len(matching) >= 2:
        supply_match = "full"
    elif len(matching) == 1:
        supply_match = "partial"
    else:
        supply_match = "none"

    country_lower = (country or "").lower()
    is_priority = any(c in country_lower for c in _PRIORITY_COUNTRIES)

    rate = _CURRENCY_TO_UAH.get((currency or "USD").upper(), 40.0)
    amt_uah = (amount or 0) * rate

    if amt_uah >= 5_000_000 and is_priority and matching:
        priority = "high"
    elif amt_uah < 1_000_000 or not matching:
        priority = "low"
    else:
        priority = "medium"

    return priority, supply_match


def matches_query(result_text: str, q: str) -> bool:
    """Simple substring match across title + entity + sector."""
    if not q:
        return True
    q_lower = q.lower()
    return any(term.strip() in result_text.lower() for term in q_lower.split(",") if term.strip())
