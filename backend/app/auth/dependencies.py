from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Annotated
from uuid import UUID

from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth.security import read_access_token, unauthorized, utcnow
from app.database import get_db
from app.errors import problem
from app.models.accounts import RefreshSession, User

Db = Annotated[Session, Depends(get_db)]
bearer_scheme = HTTPBearer(auto_error=False)


@dataclass(frozen=True)
class AuthContext:
    user: User
    family_id: UUID
    authenticated_at: datetime


def authenticate_access(session: Session, token: str, settings) -> AuthContext:
    claims = read_access_token(token, settings)
    try:
        user_id, family_id = UUID(claims["sub"]), UUID(claims["sid"])
        authenticated_at = datetime.fromtimestamp(claims["auth_time"], timezone.utc)
    except (ValueError, TypeError, OverflowError):
        raise unauthorized() from None
    user = session.get(User, user_id)
    active = session.scalar(select(RefreshSession.id).where(
        RefreshSession.user_id == user_id, RefreshSession.family_id == family_id,
        RefreshSession.revoked_at.is_(None), RefreshSession.expires_at > utcnow()).limit(1))
    # Database status is checked on every access, so logout/suspension beats JWT expiry.
    if user is None or user.status != "ACTIVE" or active is None:
        raise unauthorized()
    return AuthContext(user=user, family_id=family_id, authenticated_at=authenticated_at)


def get_current_user(request: Request, session: Db,
                     credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)]) -> User:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise unauthorized()
    context = authenticate_access(session, credentials.credentials, request.app.state.settings)
    request.state.auth = context
    return context.user


CurrentUser = Annotated[User, Depends(get_current_user)]


def require_role(*roles):
    def authorized(request: Request, user: CurrentUser) -> User:
        if user.role not in roles:
            raise problem(403, "FORBIDDEN", "This action is not available to your account.")
        # Local onboarding is usable with Mailpit; public customer/vendor operations
        # require proven email ownership. Operators are bootstrapped locally by CLI.
        if request.app.state.settings.environment == "production" and user.role != "admin" and user.email_verified_at is None:
            raise problem(403, "EMAIL_VERIFICATION_REQUIRED", "Confirm your email before using this feature.")
        return user
    return authorized


def require_recent_auth(request: Request) -> None:
    elapsed = (utcnow() - request.state.auth.authenticated_at).total_seconds()
    if elapsed > request.app.state.settings.auth_recent_seconds:
        raise problem(403, "RECENT_LOGIN_REQUIRED", "Sign in again before this action.")
