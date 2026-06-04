"""AI enrichment endpoints — fill form fields from open-source knowledge."""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from ...core.dependencies import get_current_user
from ...models.user import User
from ...ai.enrichers import enrich_company, enrich_object, enrich_from_web

router = APIRouter(prefix="/ai", tags=["ai"])


class CompanyEnrichRequest(BaseModel):
    name: str
    edrpou: Optional[str] = None


class ObjectEnrichRequest(BaseModel):
    name: str
    address: Optional[str] = None
    city: Optional[str] = None


@router.post("/enrich/company")
async def ai_enrich_company(
    body: CompanyEnrichRequest,
    _: User = Depends(get_current_user),
):
    if not body.name.strip():
        raise HTTPException(status_code=400, detail="Назва компанії не може бути порожньою")
    return await enrich_company(body.name.strip(), body.edrpou)


@router.post("/enrich/object")
async def ai_enrich_object(
    body: ObjectEnrichRequest,
    _: User = Depends(get_current_user),
):
    if not body.name.strip():
        raise HTTPException(status_code=400, detail="Назва об'єкту не може бути порожньою")
    return await enrich_object(body.name.strip(), body.address, body.city)


class WebEnrichRequest(BaseModel):
    name: str
    entity_type: str = "object"   # "object" | "company"
    city: Optional[str] = None
    url: Optional[str] = None     # if user already knows the website


@router.post("/enrich/web")
async def ai_enrich_web(
    body: WebEnrichRequest,
    _: User = Depends(get_current_user),
):
    """Find entity's website, scrape it, and extract all available data using AI."""
    if not body.name.strip():
        raise HTTPException(status_code=400, detail="Назва не може бути порожньою")
    if body.entity_type not in ("object", "company"):
        raise HTTPException(status_code=400, detail="entity_type must be 'object' or 'company'")
    return await enrich_from_web(
        name=body.name.strip(),
        entity_type=body.entity_type,
        city=body.city,
        provided_url=body.url,
    )
