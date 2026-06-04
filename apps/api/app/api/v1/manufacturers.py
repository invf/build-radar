from __future__ import annotations
import uuid
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, func

from ...core.database import get_db
from ...core.dependencies import get_current_user
from ...models.user import User
from ...models.manufacturer import Manufacturer
from ...schemas.manufacturers import ManufacturerCreate, ManufacturerUpdate, ManufacturerOut

router = APIRouter(prefix="/manufacturers", tags=["manufacturers"])


@router.get("", response_model=list[ManufacturerOut])
async def list_manufacturers(
    search: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = select(Manufacturer).order_by(Manufacturer.name)
    if search:
        term = f"%{search}%"
        q = q.where(or_(
            Manufacturer.name.ilike(term),
            Manufacturer.address.ilike(term),
        ))
    result = await db.execute(q)
    return result.scalars().all()


@router.post("", response_model=ManufacturerOut, status_code=status.HTTP_201_CREATED)
async def create_manufacturer(
    payload: ManufacturerCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    obj = Manufacturer(**payload.model_dump(), created_by=current_user.id)
    db.add(obj)
    await db.commit()
    await db.refresh(obj)
    return obj


@router.get("/{manufacturer_id}", response_model=ManufacturerOut)
async def get_manufacturer(
    manufacturer_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    result = await db.execute(select(Manufacturer).where(Manufacturer.id == manufacturer_id))
    obj = result.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail="Manufacturer not found")
    return obj


@router.patch("/{manufacturer_id}", response_model=ManufacturerOut)
async def update_manufacturer(
    manufacturer_id: uuid.UUID,
    payload: ManufacturerUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    result = await db.execute(select(Manufacturer).where(Manufacturer.id == manufacturer_id))
    obj = result.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail="Manufacturer not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(obj, field, value)
    await db.commit()
    await db.refresh(obj)
    return obj


@router.delete("/{manufacturer_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_manufacturer(
    manufacturer_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    result = await db.execute(select(Manufacturer).where(Manufacturer.id == manufacturer_id))
    obj = result.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail="Manufacturer not found")
    await db.delete(obj)
    await db.commit()
