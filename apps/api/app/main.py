"""BuildRadar FastAPI Application — Production Entry Point."""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from .core.config import settings
from .api.v1 import objects, notes, analytics, users, companies, permits, tenders, notifications, saved_searches, admin_parsers

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
    allow_origins=settings.cors_origins,
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
    if origin in settings.cors_origins:
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


@app.get("/health")
async def health_check():
    return {"status": "ok", "version": settings.app_version, "env": settings.environment}


@app.get("/api/v1")
async def api_root():
    return {
        "name": "BuildRadar API",
        "version": settings.app_version,
        "docs": "/docs",
    }
