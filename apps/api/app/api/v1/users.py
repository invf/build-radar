from __future__ import annotations
import uuid
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from ...core.database import get_db
from ...core.dependencies import get_current_user, require_admin
from ...models.user import User, Invitation, UserRole
from ...schemas.users import (
    UserSchema,
    UpdateMeSchema,
    InviteUserSchema,
    SetRoleSchema,
    SetActiveSchema,
    PaginatedUsersResponse,
)

router = APIRouter(prefix="/users", tags=["users"])
admin_router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/me", response_model=UserSchema)
async def get_me(current_user: User = Depends(get_current_user)):
    return UserSchema.model_validate(current_user)


@router.patch("/me", response_model=UserSchema)
async def update_me(
    payload: UpdateMeSchema,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    for key, value in payload.model_dump(exclude_none=True).items():
        setattr(current_user, key, value)
    await db.commit()
    await db.refresh(current_user)
    return UserSchema.model_validate(current_user)


@admin_router.get("/users", response_model=PaginatedUsersResponse)
async def list_users(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
    page: int = 1,
    page_size: int = 50,
    search: Optional[str] = None,
):
    query = select(User).order_by(User.created_at.desc())
    if search:
        query = query.where(
            User.email.ilike(f"%{search}%") | User.full_name.ilike(f"%{search}%")
        )

    total = await db.scalar(select(func.count()).select_from(query.subquery()))
    result = await db.execute(query.offset((page - 1) * page_size).limit(page_size))
    users = result.scalars().all()

    return PaginatedUsersResponse(
        items=[UserSchema.model_validate(u) for u in users],
        total=total or 0, page=page, page_size=page_size,
        pages=max(1, -(-total // page_size)) if total else 0,
    )


@admin_router.post("/users/invite", response_model=dict)
async def invite_user(
    payload: InviteUserSchema,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    existing = await db.scalar(select(User).where(User.email == payload.email))
    if existing:
        raise HTTPException(status_code=400, detail="User with this email already exists")

    token = secrets.token_urlsafe(32)
    invitation = Invitation(
        email=payload.email,
        token=token,
        role=payload.role,
        invited_by=admin.id,
        expires_at=datetime.now(timezone.utc) + timedelta(hours=48),
    )
    db.add(invitation)
    await db.commit()

    # TODO: send invitation email
    return {"message": "Invitation sent", "token": token}


@admin_router.patch("/users/{user_id}/role", response_model=UserSchema)
async def set_user_role(
    user_id: uuid.UUID,
    payload: SetRoleSchema,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    user = await db.scalar(select(User).where(User.id == user_id))
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if str(user.id) == str(admin.id):
        raise HTTPException(status_code=400, detail="Cannot change your own role")

    user.role = payload.role
    await db.commit()
    return UserSchema.model_validate(user)


@admin_router.patch("/users/{user_id}/active", response_model=UserSchema)
async def set_user_active(
    user_id: uuid.UUID,
    payload: SetActiveSchema,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    user = await db.scalar(select(User).where(User.id == user_id))
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if str(user.id) == str(admin.id):
        raise HTTPException(status_code=400, detail="Cannot deactivate yourself")

    user.is_active = payload.is_active
    await db.commit()
    return UserSchema.model_validate(user)
