from fastapi import APIRouter, Request, Response
from sqlalchemy import select, update

from app.auth.dependencies import CurrentUser, Db, require_recent_auth
from app.auth.schemas import (
    LoginInput,
    RefreshInput,
    RegisterInput,
    TokenResponse,
    UserResponse,
)
from app.auth.security import utcnow
from app.auth.service import (
    lock_user,
    password_login,
    rate_limit_auth,
    register_user,
    rotate_session,
)
from app.models.accounts import RefreshSession
from app.notifications.service import disable_devices
from app.models.vendors import VendorProfile
from app.vendors.service import hide_vendor

router = APIRouter(prefix="/api/v1/auth", tags=["authentication"])


def stop_vendor_sharing(session, user):
    if user.role != "vendor":
        return
    row = session.scalar(
        select(VendorProfile).where(VendorProfile.user_id == user.id).with_for_update()
    )
    if row:
        # Session revocation alone leaves a previously fresh point visible.
        # Erase it and disable sharing in the same account-locked transaction.
        hide_vendor(session, row)


@router.post("/register/customer", response_model=UserResponse, status_code=201)
def register_customer(payload: RegisterInput, request: Request, session: Db):
    rate_limit_auth(
        request,
        str(payload.email),
        "register",
        request.app.state.settings.auth_register_limit,
    )
    return register_user(session, payload, "customer")


@router.post("/register/vendor", response_model=UserResponse, status_code=201)
def register_vendor(payload: RegisterInput, request: Request, session: Db):
    rate_limit_auth(
        request,
        str(payload.email),
        "register",
        request.app.state.settings.auth_register_limit,
    )
    return register_user(session, payload, "vendor")


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginInput, request: Request, session: Db):
    rate_limit_auth(
        request,
        str(payload.email),
        "login",
        request.app.state.settings.auth_login_limit,
    )
    return password_login(
        session,
        str(payload.email),
        payload.password.get_secret_value(),
        payload.device_name,
        request.app.state.settings,
    )


@router.post("/refresh", response_model=TokenResponse)
def refresh(payload: RefreshInput, request: Request, session: Db):
    rate_limit_auth(request, "refresh", "refresh", 60)
    return rotate_session(
        session, payload.refresh_token.get_secret_value(), request.app.state.settings
    )


@router.post("/logout", status_code=204)
def logout(request: Request, session: Db, user: CurrentUser):
    lock_user(session, user.id)
    stop_vendor_sharing(session, user)
    disable_devices(session, user.id, family_id=request.state.auth.family_id)
    session.execute(
        update(RefreshSession)
        .where(
            RefreshSession.family_id == request.state.auth.family_id,
            RefreshSession.user_id == user.id,
        )
        .values(revoked_at=utcnow())
    )
    session.commit()
    return Response(status_code=204)


@router.post("/logout-all", status_code=204)
def logout_all(request: Request, session: Db, user: CurrentUser):
    require_recent_auth(request)
    lock_user(session, user.id)
    stop_vendor_sharing(session, user)
    disable_devices(session, user.id)
    session.execute(
        update(RefreshSession)
        .where(RefreshSession.user_id == user.id)
        .values(revoked_at=utcnow())
    )
    session.commit()
    return Response(status_code=204)
