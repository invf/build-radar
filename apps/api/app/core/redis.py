from __future__ import annotations
import json
import logging
from typing import Any
import redis.asyncio as aioredis
from .config import settings

logger = logging.getLogger(__name__)

_redis_client: aioredis.Redis | None = None
_redis_available: bool = True


def get_redis() -> aioredis.Redis | None:
    global _redis_client, _redis_available
    if not _redis_available:
        return None
    if _redis_client is None:
        _redis_client = aioredis.from_url(
            settings.redis_url,
            encoding="utf-8",
            decode_responses=True,
            socket_connect_timeout=2,
        )
    return _redis_client


async def cache_get(key: str) -> Any | None:
    global _redis_available
    redis = get_redis()
    if redis is None:
        return None
    try:
        value = await redis.get(key)
        if value is None:
            return None
        return json.loads(value)
    except Exception:
        _redis_available = False
        logger.warning("Redis unavailable — caching disabled")
        return None


async def cache_set(key: str, value: Any, ttl: int = settings.redis_ttl_default) -> None:
    global _redis_available
    redis = get_redis()
    if redis is None:
        return
    try:
        await redis.setex(key, ttl, json.dumps(value, default=str))
    except Exception:
        _redis_available = False


async def cache_delete(key: str) -> None:
    redis = get_redis()
    if redis is None:
        return
    try:
        await redis.delete(key)
    except Exception:
        pass


async def cache_delete_pattern(pattern: str) -> None:
    redis = get_redis()
    if redis is None:
        return
    try:
        keys = await redis.keys(pattern)
        if keys:
            await redis.delete(*keys)
    except Exception:
        pass
