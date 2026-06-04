"""External search endpoints: ЄДРПОУ company registry + OpenStreetMap."""
from fastapi import APIRouter, Query

from ...services import edrpou as edrpou_svc
from ...services import osm as osm_svc

router = APIRouter(prefix="/search", tags=["search"])


@router.get("/companies")
async def search_companies(
    q: str = Query(..., min_length=2, description="Назва компанії або ЄДРПОУ код"),
    limit: int = Query(10, ge=1, le=20),
):
    """Search Ukrainian company registry (ЄДРПОУ) via opendatabot.ua.

    Returns list of company candidates to pre-fill the company form.
    """
    results = await edrpou_svc.search_companies(q, limit=limit)
    return {"items": results, "total": len(results), "source": "opendatabot"}


@router.get("/company/{edrpou}")
async def get_company_by_edrpou(edrpou: str):
    """Get full company details by 8-digit ЄДРПОУ code."""
    result = await edrpou_svc.get_by_edrpou(edrpou)
    if result is None:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Компанію не знайдено в реєстрі ЄДРПОУ")
    return result


@router.get("/places")
async def search_places(
    q: str = Query(..., min_length=3, description="Адреса або назва об'єкту"),
    limit: int = Query(10, ge=1, le=20),
):
    """Search Ukrainian addresses and buildings via OpenStreetMap Nominatim.

    Returns place candidates to pre-fill address + coordinates in the object form.
    """
    results = await osm_svc.search_places(q, limit=limit)
    return {"items": results, "total": len(results), "source": "nominatim"}


@router.get("/buildings/nearby")
async def search_buildings_nearby(
    lat: float = Query(..., description="Широта"),
    lng: float = Query(..., description="Довгота"),
    radius: int = Query(300, ge=50, le=2000, description="Радіус пошуку в метрах"),
):
    """Find buildings near a point using OpenStreetMap Overpass API."""
    results = await osm_svc.search_buildings_nearby(lat, lng, radius_m=radius)
    return {"items": results, "total": len(results), "source": "overpass"}


@router.get("/reverse")
async def reverse_geocode(
    lat: float = Query(...),
    lng: float = Query(...),
):
    """Reverse-geocode coordinates to address details."""
    result = await osm_svc.reverse_geocode(lat, lng)
    if result is None:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Адресу не знайдено")
    return result
