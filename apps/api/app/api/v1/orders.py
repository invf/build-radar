from __future__ import annotations
import uuid
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_

from ...core.database import get_db
from ...core.dependencies import get_current_user
from ...models.user import User
from ...models.order import Order, OrderStatus
from ...schemas.orders import OrderCreate, OrderUpdate, OrderOut

router = APIRouter(prefix="/orders", tags=["orders"])


@router.get("", response_model=list[OrderOut])
async def list_orders(
    status_filter: Optional[OrderStatus] = Query(None, alias="status"),
    search: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = select(Order).order_by(Order.created_at.desc())
    if status_filter:
        q = q.where(Order.status == status_filter)
    if search:
        term = f"%{search}%"
        q = q.where(or_(
            Order.customer.ilike(term),
            Order.object_name.ilike(term),
            Order.address.ilike(term),
            Order.manufacturer.ilike(term),
        ))
    result = await db.execute(q)
    return result.scalars().all()


@router.post("", response_model=OrderOut, status_code=status.HTTP_201_CREATED)
async def create_order(
    payload: OrderCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    obj = Order(**payload.model_dump(), created_by=current_user.id)
    db.add(obj)
    await db.commit()
    await db.refresh(obj)
    return obj


@router.get("/{order_id}", response_model=OrderOut)
async def get_order(
    order_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    result = await db.execute(select(Order).where(Order.id == order_id))
    obj = result.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail="Order not found")
    return obj


@router.patch("/{order_id}", response_model=OrderOut)
async def update_order(
    order_id: uuid.UUID,
    payload: OrderUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    result = await db.execute(select(Order).where(Order.id == order_id))
    obj = result.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail="Order not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(obj, field, value)
    await db.commit()
    await db.refresh(obj)
    return obj


@router.post("/{order_id}/complete", response_model=OrderOut)
async def complete_order(
    order_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    result = await db.execute(select(Order).where(Order.id == order_id))
    obj = result.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail="Order not found")
    obj.status = OrderStatus.completed
    await db.commit()
    await db.refresh(obj)
    return obj


@router.post("/{order_id}/restore", response_model=OrderOut)
async def restore_order(
    order_id: uuid.UUID,
    restore_status: OrderStatus = Query(OrderStatus.in_progress, alias="status"),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    result = await db.execute(select(Order).where(Order.id == order_id))
    obj = result.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail="Order not found")
    if restore_status == OrderStatus.completed:
        raise HTTPException(status_code=400, detail="Cannot restore to 'completed'")
    obj.status = restore_status
    await db.commit()
    await db.refresh(obj)
    return obj


@router.delete("/{order_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_order(
    order_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    result = await db.execute(select(Order).where(Order.id == order_id))
    obj = result.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail="Order not found")
    await db.delete(obj)
    await db.commit()
