"""File upload endpoint — stores in Supabase Storage, returns public URL."""
import uuid
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from supabase import create_client
from ...core.dependencies import get_current_user
from ...models.user import User
from ...core.config import settings

router = APIRouter(prefix="/upload", tags=["upload"])

BUCKET = "uploads"
ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
MAX_SIZE = 5 * 1024 * 1024  # 5 MB

_supabase = None


def _get_client():
    global _supabase
    if _supabase is None:
        _supabase = create_client(settings.supabase_url, settings.supabase_service_role_key)
    return _supabase


def _ensure_bucket():
    client = _get_client()
    try:
        buckets = client.storage.list_buckets()
        names = [b.name for b in buckets]
        if BUCKET not in names:
            client.storage.create_bucket(BUCKET, options={"public": True})
    except Exception:
        pass  # bucket likely already exists


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

    try:
        _ensure_bucket()
        client = _get_client()
        client.storage.from_(BUCKET).upload(
            path=filename,
            file=content,
            file_options={"content-type": file.content_type or "image/jpeg"},
        )
        public_url = client.storage.from_(BUCKET).get_public_url(filename)
    except Exception as exc:
        raise HTTPException(500, f"Помилка збереження файлу: {exc}") from exc

    return {"url": public_url}
