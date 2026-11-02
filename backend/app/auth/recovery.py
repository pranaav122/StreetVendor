"""Account-lock-first transactions make consumption and revocation indivisible."""

import secrets
from datetime import timedelta

from fastapi import APIRouter, BackgroundTasks, Request, Response
from pydantic import EmailStr, Field, SecretStr
from sqlalchemy import select, update

from app.auth.dependencies import CurrentUser, Db
from app.auth.mailer import send_safely
from app.auth.schemas import Password, WriteModel
from app.auth.security import password_hasher, token_digest, utcnow
from app.auth.service import lock_user, rate_limit_auth
from app.errors import problem
from app.models.accounts import RefreshSession, User, UserCredential
from app.models.mail_tokens import MailToken

router = APIRouter(prefix="/api/v1/auth", tags=["account recovery"])
ACCEPTED = {"message": "If the account is eligible, an email will be sent."}


class ResetRequest(WriteModel):
    email: EmailStr


class TokenInput(WriteModel):
    token: SecretStr = Field(min_length=32, max_length=256)


class ResetConfirm(TokenInput):
    password: Password = Field(min_length=15, max_length=128)


def mail_ready(request):
    if not request.app.state.mailer.enabled:
        raise problem(503, "MAIL_NOT_CONFIGURED", "Email delivery is not configured.")


def issue_mail(session, user, purpose, request, background):
    user = lock_user(session, user.id)
    now = utcnow()
    # Resending invalidates previous links; only the newest message can change the account.
    session.execute(update(MailToken).where(MailToken.user_id == user.id,
                    MailToken.purpose == purpose, MailToken.used_at.is_(None)).values(used_at=now))
    raw = secrets.token_urlsafe(48)
    minutes = 15 if purpose == "RESET_PASSWORD" else 60
    session.add(MailToken(user_id=user.id, purpose=purpose, token_hash=token_digest(raw),
                          expires_at=now + timedelta(minutes=minutes)))
    settings = request.app.state.settings
    base = settings.public_vendor_url if user.role == "vendor" else settings.public_customer_url
    path = "reset-password" if purpose == "RESET_PASSWORD" else "verify-email"
    # Fragments stay out of server access logs. The app submits the token in a POST body.
    body = f"Open {base.rstrip('/')}/{path}#token={raw}\nThis link expires in {minutes} minutes."
    recipient = user.email
    session.commit()
    # Slow SMTP must not reveal whether an anonymous recovery address exists.
    background.add_task(send_safely, request.app.state.mailer, recipient, "MyStreetVendor account", body)


def consume_mail(session, raw, purpose):
    token = session.scalar(select(MailToken).where(MailToken.token_hash == token_digest(raw)))
    if token is None:
        raise problem(400, "INVALID_TOKEN", "This link is invalid or expired.")
    user = lock_user(session, token.user_id)
    token = session.scalar(select(MailToken).where(MailToken.id == token.id).with_for_update()
                           .execution_options(populate_existing=True))
    if token.purpose != purpose or token.used_at is not None or token.expires_at <= utcnow():
        raise problem(400, "INVALID_TOKEN", "This link is invalid or expired.")
    token.used_at = utcnow()
    return user


@router.post("/password/reset/request", status_code=202)
def request_reset(payload: ResetRequest, request: Request, background: BackgroundTasks, session: Db):
    mail_ready(request)
    email = str(payload.email).casefold()
    rate_limit_auth(request, email, "recovery", 5)
    user = session.scalar(select(User).where(User.email == email, User.status == "ACTIVE"))
    if user:
        issue_mail(session, user, "RESET_PASSWORD", request, background)
    return ACCEPTED


@router.post("/password/reset/confirm", status_code=204)
def confirm_reset(payload: ResetConfirm, request: Request, session: Db):
    rate_limit_auth(request, "token", "reset-confirm", 30)
    user = consume_mail(session, payload.token.get_secret_value(), "RESET_PASSWORD")
    credential = session.get(UserCredential, user.id)
    credential.password_hash = password_hasher.hash(payload.password.get_secret_value())
    credential.password_changed_at = utcnow()
    session.execute(update(RefreshSession).where(RefreshSession.user_id == user.id).values(revoked_at=utcnow()))
    session.commit()
    return Response(status_code=204)


@router.post("/email/verification", status_code=202)
def request_verification(request: Request, background: BackgroundTasks, session: Db, user: CurrentUser):
    mail_ready(request)
    rate_limit_auth(request, str(user.id), "verification", 5)
    issue_mail(session, user, "VERIFY_EMAIL", request, background)
    return ACCEPTED


@router.post("/email/verify", status_code=204)
def verify_email(payload: TokenInput, request: Request, session: Db):
    rate_limit_auth(request, "token", "verify-confirm", 30)
    user = consume_mail(session, payload.token.get_secret_value(), "VERIFY_EMAIL")
    user.email_verified_at = utcnow()
    session.commit()
    return Response(status_code=204)
