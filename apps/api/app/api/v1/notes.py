import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from ...core.database import get_db
from ...core.dependencies import get_current_user
from ...models.user import User
from ...models.note import ObjectNote
from ...schemas.notes import ObjectNoteSchema, CreateNoteSchema, UpdateNoteSchema

router = APIRouter(prefix="/notes", tags=["notes"])


@router.get("/object/{object_id}", response_model=ObjectNoteSchema)
async def get_note_for_object(
    object_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    note = await db.scalar(
        select(ObjectNote).where(
            and_(ObjectNote.object_id == object_id, ObjectNote.user_id == current_user.id)
        )
    )
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    return ObjectNoteSchema.model_validate(note)


@router.post("/object/{object_id}", response_model=ObjectNoteSchema)
async def create_note(
    object_id: uuid.UUID,
    payload: CreateNoteSchema,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Check if note already exists
    existing = await db.scalar(
        select(ObjectNote).where(
            and_(ObjectNote.object_id == object_id, ObjectNote.user_id == current_user.id)
        )
    )
    if existing:
        # Update existing note
        for key, value in payload.model_dump(exclude_none=True).items():
            setattr(existing, key, value)
        await db.commit()
        await db.refresh(existing)
        return ObjectNoteSchema.model_validate(existing)

    note = ObjectNote(
        object_id=object_id,
        user_id=current_user.id,
        **payload.model_dump(exclude_none=True)
    )
    db.add(note)
    await db.commit()
    await db.refresh(note)
    return ObjectNoteSchema.model_validate(note)


@router.patch("/{note_id}", response_model=ObjectNoteSchema)
async def update_note(
    note_id: uuid.UUID,
    payload: UpdateNoteSchema,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    note = await db.scalar(
        select(ObjectNote).where(
            and_(ObjectNote.id == note_id, ObjectNote.user_id == current_user.id)
        )
    )
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")

    for key, value in payload.model_dump(exclude_none=True).items():
        setattr(note, key, value)

    await db.commit()
    await db.refresh(note)
    return ObjectNoteSchema.model_validate(note)


@router.delete("/{note_id}", status_code=204)
async def delete_note(
    note_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    note = await db.scalar(
        select(ObjectNote).where(
            and_(ObjectNote.id == note_id, ObjectNote.user_id == current_user.id)
        )
    )
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    await db.delete(note)
    await db.commit()


@router.get("/my", response_model=list[ObjectNoteSchema])
async def get_my_notes(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(ObjectNote)
        .where(ObjectNote.user_id == current_user.id)
        .order_by(ObjectNote.updated_at.desc())
        .limit(100)
    )
    return [ObjectNoteSchema.model_validate(n) for n in result.scalars().all()]
