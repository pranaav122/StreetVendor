from fastapi import APIRouter, Request
from sqlalchemy import delete, update

from app.auth.dependencies import CurrentUser, Db, require_recent_auth
from app.auth.schemas import UserResponse
from app.auth.security import utcnow
from app.auth.service import lock_user
from app.models.accounts import RefreshSession, UserCredential
from app.users.schemas import DeleteInput, ProfileInput

router = APIRouter(prefix="/api/v1/users", tags=["accounts"])


@router.get("/me", response_model=UserResponse)
def me(user: CurrentUser):
    return user


@router.patch("/me", response_model=UserResponse)
def update_me(payload: ProfileInput, user: CurrentUser, session: Db):
    user = lock_user(session, user.id)
    # Only explicitly allowlisted fields can reach the ORM; identity/role never comes from this body.
    for name, value in payload.model_dump(exclude_none=True).items():
        setattr(user, name, value)
    user.updated_at = utcnow()
    session.commit()
    session.refresh(user)
    return user


@router.delete("/me", status_code=202)
def delete_me(payload: DeleteInput, request: Request, user: CurrentUser, session: Db):
    require_recent_auth(request)
    user = lock_user(session, user.id)
    # Keep a nonidentifying row for future visit foreign keys, but revoke access immediately.
    user.status, user.email, user.display_name = "DELETED", None, "Deleted account"
    user.deleted_at = user.updated_at = utcnow()
    session.execute(delete(UserCredential).where(UserCredential.user_id == user.id))
    session.execute(update(RefreshSession).where(RefreshSession.user_id == user.id)
                    .values(revoked_at=utcnow()))
    session.commit()
    return {"status": "accepted"}
