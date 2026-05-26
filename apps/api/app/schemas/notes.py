import uuid
from datetime import datetime
from pydantic import BaseModel
from typing import Optional
from ..models.note import NoteStatus


class ObjectNoteSchema(BaseModel):
    id: uuid.UUID
    object_id: uuid.UUID
    user_id: uuid.UUID
    note_text: str
    status: Optional[NoteStatus] = None
    tags: Optional[list[str]] = None
    reminder_date: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class CreateNoteSchema(BaseModel):
    note_text: str
    status: Optional[NoteStatus] = None
    tags: Optional[list[str]] = None
    reminder_date: Optional[datetime] = None


class UpdateNoteSchema(BaseModel):
    note_text: Optional[str] = None
    status: Optional[NoteStatus] = None
    tags: Optional[list[str]] = None
    reminder_date: Optional[datetime] = None
