"""Authentication writes own their commit so multi-row changes stay atomic."""

import hashlib
import hmac
import secrets
import time
from datetime import timedelta
from uuid import uuid4

from fastapi import Request
from sqlalchemy import select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth.schemas import RegisterInput, TokenResponse
from app.auth.security import create_access_token, dummy_hash, password_hasher, signing_key, token_digest, unauthorized, utcnow
from app.config import Settings
from app.errors import problem
from app.models.accounts import RateLimitBucket, RefreshSession, User, UserCredential


def lock_user(session: Session, user_id) -> User:
    # Always lock the account before its sessions. Otherwise logout can miss a
    # refresh child inserted while its UPDATE waits for the old session row.
    user = session.scalar(select(User).where(User.id == user_id).with_for_update()
                          .execution_options(populate_existing=True))
    if user is None or user.status != "ACTIVE":
        raise unauthorized()
    return user


def consume_limit(request: Request, identifier: str, action: str, limit: int) -> None:
    settings = request.app.state.settings
    key_material = f"{action}:{identifier}:{int(time.time()) // 900}"
    key = hmac.new(signing_key(settings).encode(), key_material.encode(), hashlib.sha256).hexdigest()
    expiry = utcnow() + timedelta(minutes=15)
    # A separate atomic transaction preserves the abuse counter even when login fails.
    with request.app.state.engine.begin() as connection:
        statement = insert(RateLimitBucket).values(key=key, count=1, expires_at=expiry)
        statement = statement.on_conflict_do_update(
            index_elements=[RateLimitBucket.key],
            set_={"count": RateLimitBucket.count + 1},
        ).returning(RateLimitBucket.count)
        count = connection.scalar(statement)
    if count > limit:
        raise problem(429, "RATE_LIMITED", "Please wait before trying again.", {"Retry-After": "900"})


def rate_limit_auth(request: Request, email: str, action: str, limit: int) -> None:
    # Do not trust arbitrary X-Forwarded-For headers; proxy trust is configured separately.
    ip = request.client.host if request.client else "unknown"
    consume_limit(request, ip, f"{action}-ip", max(30, limit * 5))
    consume_limit(request, f"{ip}:{email.casefold()}", action, limit)


def register_user(session: Session, payload: RegisterInput, role: str) -> User:
    user = User(email=str(payload.email).casefold(), display_name=payload.display_name,
                preferred_language=payload.preferred_language, role=role)
    session.add(user)
    try:
        session.flush()
        session.add(UserCredential(user_id=user.id,
                                   password_hash=password_hasher.hash(payload.password.get_secret_value())))
        session.commit()
    except IntegrityError:
        session.rollback()
        raise problem(409, "EMAIL_IN_USE", "An account with that email already exists.") from None
    session.refresh(user)
    return user


def issue_session(session: Session, user: User, device_name: str | None, settings: Settings,
                  *, family_id=None, expires_at=None, authenticated_at=None) -> TokenResponse:
    now = utcnow()
    authenticated_at = authenticated_at or now
    family_id = family_id or uuid4()
    raw_token = secrets.token_urlsafe(48)
    row = RefreshSession(user_id=user.id, family_id=family_id,
                         token_hash=token_digest(raw_token), device_name=device_name,
                         authenticated_at=authenticated_at, expires_at=expires_at or now + timedelta(days=30))
    session.add(row)
    session.flush()
    return TokenResponse(access_token=create_access_token(user.id, family_id, authenticated_at, settings),
                         refresh_token=raw_token)


def password_login(session: Session, email: str, password: str, device_name: str | None,
                    settings: Settings) -> TokenResponse:
    user = session.scalar(select(User).where(User.email == email.casefold()).with_for_update())
    credential = session.get(UserCredential, user.id) if user else None
    valid = password_hasher.verify(password, credential.password_hash if credential else dummy_hash)
    if not user or not credential or not valid or user.status != "ACTIVE":
        raise unauthorized()
    tokens = issue_session(session, user, device_name, settings)
    session.commit()
    return tokens


def rotate_session(session: Session, raw_token: str, settings: Settings) -> TokenResponse:
    row = session.scalar(select(RefreshSession).where(
        RefreshSession.token_hash == token_digest(raw_token)))
    if row is None:
        raise unauthorized()
    user = lock_user(session, row.user_id)
    # Re-read after waiting for the account lock: another request may have rotated it.
    row = session.scalar(select(RefreshSession).where(RefreshSession.id == row.id)
                         .with_for_update().execution_options(populate_existing=True))
    if row.revoked_at is not None or row.replaced_by_id is not None:
        # Commit revocation before returning 401; request cleanup would otherwise roll it back.
        session.execute(update(RefreshSession).where(RefreshSession.family_id == row.family_id)
                        .values(revoked_at=utcnow()))
        session.commit()
        raise unauthorized()
    if row.expires_at <= utcnow() or user is None or user.status != "ACTIVE":
        raise unauthorized()
    tokens = issue_session(session, user, row.device_name, settings, family_id=row.family_id,
                           expires_at=row.expires_at, authenticated_at=row.authenticated_at)
    child = session.scalar(select(RefreshSession).where(
        RefreshSession.token_hash == token_digest(tokens.refresh_token)))
    row.replaced_by_id = child.id
    row.revoked_at = row.last_used_at = utcnow()
    session.commit()
    return tokens
