"""File upload endpoint — stores in Supabase Storage, returns public URL."""
import uuid
import httpx
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from ...core.dependencies import get_current_user
from ...models.user import User
from ...core.config import settings

router = APIRouter(prefix="/upload", tags=["upload"])

BUCKET = "uploads"
ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif", "image/heic", "image/heif"}
MAX_SIZE = 10 * 1024 * 1024  # 10 MB


async def _upload_to_storage(content: bytes, filename: str, content_type: str, token: str) -> tuple[bool, str]:
    """Try uploading with a given token. Returns True on success."""
    url = f"{settings.supabase_url}/storage/v1/object/{BUCKET}/{filename}"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": content_type,
        "x-upsert": "true",
    }
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(url, content=content, headers=headers)
    return resp.status_code in (200, 201), resp.text


@router.post("")
async def upload_file(
    file: UploadFile = File(...),
    _: User = Depends(get_current_user),
):
    content_type = file.content_type or "image/jpeg"
    if content_type not in ALLOWED_TYPES:
        raise HTTPException(400, "Дозволені лише зображення (JPEG, PNG, WEBP, GIF)")

    content = await file.read()
    if len(content) > MAX_SIZE:
        raise HTTPException(400, "Файл занадто великий (максимум 10 МБ)")

    ext = (file.filename or "file").rsplit(".", 1)[-1].lower()
    if ext not in ("jpg", "jpeg", "png", "webp", "gif", "heic", "heif"):
        ext = "jpg"

    filename = f"{uuid.uuid4().hex}.{ext}"

    # Try service_role key first, fall back to anon key
    for token in [settings.supabase_service_role_key, settings.supabase_anon_key]:
        if not token:
            continue
        ok, err_text = await _upload_to_storage(content, filename, content_type, token)
        if ok:
            public_url = f"{settings.supabase_url}/storage/v1/object/public/{BUCKET}/{filename}"
            return {"url": public_url}

    raise HTTPException(500, "Не вдалося завантажити файл. Перевірте налаштування Supabase Storage.")
