"""Cryptographic operations stay small and independently inspectable."""

import hashlib
import secrets
from datetime import datetime, timezone
from uuid import UUID, uuid4

import jwt
from pwdlib import PasswordHash

from app.config import Settings
from app.errors import problem

password_hasher = PasswordHash.recommended()
# Verify one hash even for unknown users, reducing account-enumeration timing differences.
dummy_hash = password_hasher.hash(secrets.token_urlsafe(32))


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def signing_key(settings: Settings) -> str:
    # The public example value is not a secret, even though its length is sufficient.
    if settings.jwt_secret is None or settings.jwt_secret.get_secret_value().startswith("replace-"):
        raise problem(503, "AUTH_NOT_CONFIGURED", "Authentication is not configured.")
    return settings.jwt_secret.get_secret_value()


def token_digest(token: str) -> bytes:
    # Refresh tokens have high random entropy; hashing prevents a DB leak granting sessions.
    return hashlib.sha256(token.encode()).digest()


def create_access_token(user_id: UUID, family_id: UUID, authenticated_at: datetime,
                        settings: Settings) -> str:
    now = int(utcnow().timestamp())
    return jwt.encode({
        "sub": str(user_id), "sid": str(family_id), "jti": str(uuid4()),
        "iat": now, "exp": now + 600, "auth_time": int(authenticated_at.timestamp()),
        "iss": settings.jwt_issuer, "aud": settings.jwt_audience,
    }, signing_key(settings), algorithm="HS256")


def read_access_token(token: str, settings: Settings) -> dict:
    try:
        return jwt.decode(token, signing_key(settings), algorithms=["HS256"],
                          issuer=settings.jwt_issuer, audience=settings.jwt_audience,
                          options={"require": ["sub", "sid", "jti", "iat", "exp", "auth_time"]})
    except jwt.InvalidTokenError:
        raise unauthorized() from None


def unauthorized():
    return problem(401, "INVALID_CREDENTIALS", "Sign in again.", {"WWW-Authenticate": "Bearer"})
