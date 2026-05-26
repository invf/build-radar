import uuid
import logging
from datetime import datetime, timezone
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from jose import JWTError
from .database import get_db
from .security import decode_token
from ..models.user import User, UserRole

logger = logging.getLogger(__name__)
bearer_scheme = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_token(credentials.credentials)
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    try:
        result = await db.execute(select(User).where(User.id == uuid.UUID(user_id)))
        user = result.scalar_one_or_none()
    except Exception as exc:
        logger.exception("DB error in get_current_user: %s", exc)
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Database error")

    if user is None:
        # First login — auto-provision row from Supabase JWT payload
        email: str = payload.get("email", "")
        if not email:
            raise credentials_exception
        user_metadata = payload.get("user_metadata") or {}
        user = User(
            id=uuid.UUID(user_id),
            email=email,
            full_name=user_metadata.get("full_name") or user_metadata.get("name"),
            avatar_url=user_metadata.get("avatar_url"),
            role=UserRole.viewer,
            is_active=True,
            created_at=datetime.now(timezone.utc),
        )
        db.add(user)
        try:
            await db.commit()
            await db.refresh(user)
            logger.info("Auto-provisioned user %s (%s)", user_id, email)
        except Exception as exc:
            await db.rollback()
            logger.exception("Failed to auto-provision user: %s", exc)
            raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Database error")

    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User account is disabled")

    return user


async def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role not in (UserRole.admin,):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return current_user


async def require_manager(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role not in (UserRole.admin, UserRole.manager):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Manager access required",
        )
    return current_user
