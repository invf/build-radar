from __future__ import annotations
from datetime import datetime, timedelta, timezone
from typing import Any
import httpx
from functools import lru_cache
from jose import jwk, jwt
from jose.exceptions import JWTError
from passlib.context import CryptContext
from .config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(subject: str | Any, expires_delta: timedelta | None = None) -> str:
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.jwt_access_token_expire_minutes)
    )
    payload = {"sub": str(subject), "exp": expire, "type": "access"}
    return jwt.encode(payload, settings.jwt_secret_key, algorithm="HS256")


def create_refresh_token(subject: str | Any) -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=settings.jwt_refresh_token_expire_days)
    payload = {"sub": str(subject), "exp": expire, "type": "refresh"}
    return jwt.encode(payload, settings.jwt_secret_key, algorithm="HS256")


_jwks_cache: list = []
_jwks_fetched_at: float = 0.0

def _get_supabase_jwks() -> list:
    """Fetch Supabase public JWKS keys, cached for 1 hour."""
    import time
    global _jwks_cache, _jwks_fetched_at
    if _jwks_cache and (time.time() - _jwks_fetched_at) < 3600:
        return _jwks_cache
    url = f"{settings.supabase_url}/auth/v1/.well-known/jwks.json"
    with httpx.Client(timeout=5) as client:
        _jwks_cache = client.get(url).json().get("keys", [])
        _jwks_fetched_at = time.time()
    return _jwks_cache


def decode_token(token: str) -> dict:
    """Verify a Supabase JWT using JWKS (RS256) or legacy HS256 secret."""
    import logging
    log = logging.getLogger(__name__)

    try:
        header = jwt.get_unverified_header(token)
    except JWTError as e:
        log.error(f"Cannot parse JWT header: {e}")
        raise

    alg = header.get("alg", "HS256")
    kid = header.get("kid")
    log.debug(f"JWT alg={alg} kid={kid}")

    if alg != "HS256":
        # Asymmetric key — verify using Supabase JWKS
        try:
            keys = _get_supabase_jwks()
        except Exception as e:
            log.error(f"Failed to fetch JWKS: {e}")
            raise JWTError(f"Could not fetch JWKS: {e}")

        for key_data in keys:
            if kid is None or key_data.get("kid") == kid:
                try:
                    public_key = jwk.construct(key_data)
                    return jwt.decode(
                        token,
                        public_key,
                        algorithms=[alg],
                        options={"verify_aud": False},
                    )
                except JWTError as e:
                    log.error(f"RS256 decode failed: {e}")
                    raise

        raise JWTError(f"No matching JWKS key found for kid={kid}")

    # Legacy HS256 path
    return jwt.decode(
        token,
        settings.jwt_secret_key,
        algorithms=["HS256"],
        options={"verify_aud": False},
    )
