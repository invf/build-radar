"""File upload endpoint — stores in Supabase Storage, returns public URL."""
import uuid
import httpx
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from ...core.dependencies import get_current_user
from ...models.user import User
from ...core.config import settings

router = APIRouter(prefix="/upload", tags=["upload"])

BUCKET = "uploads"
ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
MAX_SIZE = 5 * 1024 * 1024  # 5 MB


@router.post("")
async def upload_file(
    file: UploadFile = File(...),
    _: User = Depends(get_current_user),
):
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(400, "Дозволені лише зображення (JPEG, PNG, WEBP, GIF)")

    content = await file.read()
    if len(content) > MAX_SIZE:
        raise HTTPException(400, "Файл занадто великий (максимум 5 МБ)")

    ext = (file.filename or "file").rsplit(".", 1)[-1].lower()
    if ext not in ("jpg", "jpeg", "png", "webp", "gif"):
        ext = "jpg"

    filename = f"{uuid.uuid4().hex}.{ext}"
    content_type = file.content_type or "image/jpeg"

    storage_url = f"{settings.supabase_url}/storage/v1/object/{BUCKET}/{filename}"
    headers = {
        "Authorization": f"Bearer {settings.supabase_service_role_key}",
        "Content-Type": content_type,
        "x-upsert": "true",
    }

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(storage_url, content=content, headers=headers)

    if resp.status_code not in (200, 201):
        raise HTTPException(500, f"Помилка збереження файлу: {resp.text}")

    public_url = f"{settings.supabase_url}/storage/v1/object/public/{BUCKET}/{filename}"
    return {"url": public_url}
