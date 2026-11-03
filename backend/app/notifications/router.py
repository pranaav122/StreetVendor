from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy import select

from app.auth.dependencies import Db, require_role
from app.auth.service import consume_limit, lock_user
from app.errors import problem
from app.models.accounts import User
from app.models.notifications import DeviceToken
from app.notifications.schemas import DeviceInput
from app.notifications.service import disable_devices, upsert_device

router = APIRouter(prefix="/api/v1/devices", tags=["devices"])
Member = Annotated[User, Depends(require_role("customer", "vendor"))]


@router.put("/{installation_id}")
def register(
    installation_id: UUID,
    payload: DeviceInput,
    request: Request,
    session: Db,
    user: Member,
):
    consume_limit(request, str(user.id), "device-register", 30)
    row = upsert_device(
        session,
        user,
        request.state.auth.family_id,
        installation_id,
        payload,
        request.app.state.settings,
    )
    return {
        "id": row.id,
        "installation_id": row.installation_id,
        "app_kind": row.app_kind,
        "platform": row.platform,
        "disabled_at": row.disabled_at,
        "last_seen_at": row.last_seen_at,
        "delivery_enabled": request.app.state.push_provider.enabled,
    }


@router.delete("/{installation_id}", status_code=204)
def deactivate(installation_id: UUID, session: Db, user: Member):
    lock_user(session, user.id)
    if not disable_devices(session, user.id, installation=installation_id):
        raise problem(404, "DEVICE_NOT_FOUND", "Device registration not found.")
    session.commit()
    return Response(status_code=204)
