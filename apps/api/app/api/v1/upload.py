"""File upload endpoint — saves to static/uploads/ and returns public URL."""
import uuid
import os
from pathlib import Path
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from ...core.dependencies import get_current_user
from ...models.user import User
from ...core.config import settings

router = APIRouter(prefix="/upload", tags=["upload"])

UPLOAD_DIR = Path(__file__).resolve().parents[3] / "static" / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

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
    dest = UPLOAD_DIR / filename
    dest.write_bytes(content)

    base_url = os.environ.get("API_BASE_URL", "http://localhost:8000").rstrip("/")
    return {"url": f"{base_url}/static/uploads/{filename}"}
