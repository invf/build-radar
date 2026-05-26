import uuid
from datetime import datetime
from pydantic import BaseModel, EmailStr
from typing import Optional
from ..models.user import UserRole


class UserSchema(BaseModel):
    id: uuid.UUID
    email: str
    full_name: Optional[str] = None
    role: UserRole
    is_active: bool
    invited_by: Optional[uuid.UUID] = None
    avatar_url: Optional[str] = None
    created_at: datetime
    last_login: Optional[datetime] = None

    model_config = {"from_attributes": True}


class UpdateMeSchema(BaseModel):
    full_name: Optional[str] = None


class InviteUserSchema(BaseModel):
    email: EmailStr
    role: UserRole = UserRole.viewer


class SetRoleSchema(BaseModel):
    role: UserRole


class SetActiveSchema(BaseModel):
    is_active: bool


class PaginatedUsersResponse(BaseModel):
    items: list[UserSchema]
    total: int
    page: int
    page_size: int
    pages: int
