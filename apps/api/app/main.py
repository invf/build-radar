"""BuildRadar FastAPI Application — Production Entry Point."""
import logging
from contextlib import asynccontextmanager

from pathlib import Path
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from .core.config import settings
from . import models  # noqa: F401 — registers all ORM mappers before first query
from .api.v1 import objects, notes, analytics, users, companies, permits, tenders, notifications, saved_searches, admin_parsers, ai_enrich, upload, search, smart_search, manufacturers, orders, prozorro_search, search_enrich

# Configure logging
logging.basicConfig(
    level=logging.DEBUG if settings.debug else logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
logger = logging.getLogger(__name__)

# Rate limiter
limiter = Limiter(key_func=get_remote_address)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown."""
    logger.info(f"Starting BuildRadar API v{settings.app_version}")

    # Initialize Sentry if configured
    if settings.sentry_dsn:
        import sentry_sdk
        from sentry_sdk.integrations.fastapi import FastApiIntegration
        sentry_sdk.init(
            dsn=settings.sentry_dsn,
            integrations=[FastApiIntegration()],
            environment=settings.environment,
        )
        logger.info("Sentry initialized")

    yield

    logger.info("BuildRadar API shutting down")


# Create FastAPI app
app = FastAPI(
    title="BuildRadar API",
    description="Ukrainian Construction Intelligence Platform API",
    version=settings.app_version,
    docs_url="/docs" if settings.debug else None,
    redoc_url="/redoc" if settings.debug else None,
    lifespan=lifespan,
)

# Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.get_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(GZipMiddleware, minimum_size=1000)

# Rate limiting
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled exception: %s", exc)
    origin = request.headers.get("origin", "")
    headers = {}
    if origin in settings.get_cors_origins():
        headers["Access-Control-Allow-Origin"] = origin
        headers["Access-Control-Allow-Credentials"] = "true"
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
        headers=headers,
    )

# Include routers
app.include_router(objects.router, prefix="/api/v1")
app.include_router(notes.router, prefix="/api/v1")
app.include_router(analytics.router, prefix="/api/v1")
app.include_router(users.router, prefix="/api/v1")
app.include_router(users.admin_router, prefix="/api/v1")
app.include_router(companies.router, prefix="/api/v1")
app.include_router(permits.router, prefix="/api/v1")
app.include_router(tenders.router, prefix="/api/v1")
app.include_router(notifications.router, prefix="/api/v1")
app.include_router(saved_searches.router, prefix="/api/v1")
app.include_router(admin_parsers.router, prefix="/api/v1")
app.include_router(ai_enrich.router, prefix="/api/v1")
app.include_router(upload.router, prefix="/api/v1")
app.include_router(search.router, prefix="/api/v1")
app.include_router(smart_search.router, prefix="/api/v1")
app.include_router(manufacturers.router, prefix="/api/v1")
app.include_router(orders.router, prefix="/api/v1")
app.include_router(prozorro_search.router, prefix="/api/v1")
app.include_router(search_enrich.router, prefix="/api/v1")

# Static files (uploaded images)
_uploads_dir = Path(__file__).resolve().parent.parent / "static" / "uploads"
_uploads_dir.mkdir(parents=True, exist_ok=True)
app.mount("/static", StaticFiles(directory=str(_uploads_dir.parent)), name="static")


@app.get("/health")
async def health_check():
    return {"status": "ok", "version": settings.app_version, "env": settings.environment}


@app.get("/debug/cors")
async def debug_cors():
    return {"allowed_origins": settings.get_cors_origins(), "raw": settings.cors_origins}


@app.get("/debug/db")
async def debug_db():
    from .core.database import engine
    from sqlalchemy import text
    try:
        async with engine.connect() as conn:
            result = await conn.execute(text("SELECT 1"))
            row = result.fetchone()
        return {"db": "ok", "result": row[0]}
    except Exception as exc:
        return {"db": "error", "detail": str(exc)}


@app.get("/api/v1")
async def api_root():
    return {
        "name": "BuildRadar API",
        "version": settings.app_version,
        "docs": "/docs",
    }
