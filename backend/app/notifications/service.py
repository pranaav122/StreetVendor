"""Account -> device -> delivery is the lock order for ownership changes."""

from datetime import timedelta
from uuid import uuid4

from sqlalchemy import delete, func, select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.exc import IntegrityError

from app.auth.security import unauthorized, utcnow
from app.auth.service import lock_user
from app.errors import problem
from app.models.accounts import RefreshSession, User
from app.models.notifications import DeviceToken, NotificationOutbox
from app.models.vendors import VendorProfile
from app.models.visits import VisitRequest


def live_family(session, user_id, family_id, now):
    return (
        session.scalar(
            select(RefreshSession.id)
            .where(
                RefreshSession.user_id == user_id,
                RefreshSession.family_id == family_id,
                RefreshSession.revoked_at.is_(None),
                RefreshSession.expires_at > now,
            )
            .limit(1)
        )
        is not None
    )


def upsert_device(session, actor, family_id, installation, payload, settings):
    actor = lock_user(session, actor.id)
    if actor.role != payload.app_kind:
        raise problem(
            403, "DEVICE_APP_MISMATCH", "Use the application for your account type."
        )
    if not live_family(session, actor.id, family_id, utcnow()):
        raise unauthorized()
    expected = getattr(settings, f"expo_{payload.app_kind}_project_id")
    if settings.environment == "production" and expected is None:
        raise problem(
            503,
            "PUSH_PROJECT_NOT_CONFIGURED",
            "Notifications are not configured for this application.",
        )
    if expected is not None and expected != payload.project_id:
        raise problem(
            422,
            "PUSH_PROJECT_MISMATCH",
            "This build does not match the configured application project.",
        )
    token = payload.token.get_secret_value()
    row = session.scalar(
        select(DeviceToken)
        .where(
            DeviceToken.installation_id == installation,
            DeviceToken.app_kind == payload.app_kind,
        )
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    token_owner = session.scalar(
        select(DeviceToken.id).where(DeviceToken.token == token)
    )
    if token_owner is not None and (row is None or token_owner != row.id):
        raise problem(
            409,
            "DEVICE_TOKEN_IN_USE",
            "This address belongs to another installation. Refresh device registration.",
        )
    count = session.scalar(
        select(func.count())
        .select_from(DeviceToken)
        .where(DeviceToken.user_id == actor.id, DeviceToken.disabled_at.is_(None))
    )
    if (
        row is None or row.user_id != actor.id or row.disabled_at is not None
    ) and count >= settings.max_devices_per_user:
        raise problem(
            409,
            "DEVICE_LIMIT",
            "Sign out unused devices before registering another one.",
        )
    now = utcnow()
    if row is None:
        row = DeviceToken(
            user_id=actor.id,
            session_family_id=family_id,
            installation_id=installation,
            app_kind=payload.app_kind,
            platform=payload.platform,
            project_id=payload.project_id,
            token=token,
        )
        session.add(row)
    else:
        if (row.user_id, row.session_family_id, row.token, row.project_id) != (
            actor.id,
            family_id,
            token,
            payload.project_id,
        ):
            # Remove old-account jobs before changing the composite ownership key.
            session.execute(
                delete(NotificationOutbox).where(
                    NotificationOutbox.device_token_id == row.id
                )
            )
        row.user_id, row.session_family_id, row.token = actor.id, family_id, token
        row.platform, row.project_id = payload.platform, payload.project_id
    row.disabled_at = None
    row.last_seen_at = row.updated_at = now
    try:
        session.commit()
    except IntegrityError:
        session.rollback()
        raise problem(
            409, "DEVICE_CONFLICT", "Refresh the current device registration."
        ) from None
    return row


def disable_devices(session, user_id, family_id=None, installation=None):
    query = select(DeviceToken).where(DeviceToken.user_id == user_id)
    if family_id is not None:
        query = query.where(DeviceToken.session_family_id == family_id)
    if installation is not None:
        query = query.where(DeviceToken.installation_id == installation)
    devices = session.scalars(query.order_by(DeviceToken.id).with_for_update()).all()
    now = utcnow()
    for device in devices:
        device.disabled_at = device.updated_at = now
        session.execute(
            update(NotificationOutbox)
            .where(
                NotificationOutbox.device_token_id == device.id,
                NotificationOutbox.status.in_(
                    ("PENDING", "SENDING", "AWAITING_RECEIPT", "CHECKING_RECEIPT")
                ),
            )
            .values(
                status="SUPPRESSED",
                last_error_code="DEVICE_DISABLED",
                finished_at=now,
                updated_at=now,
                lease_until=None,
                lease_token=None,
            )
        )
    return len(devices)


def enqueue_for_event(session, event):
    row = session.get(VisitRequest, event.request_id)
    vendor = session.get(VendorProfile, row.vendor_id)
    if event.event_type == "REQUEST_CREATED":
        recipients = {vendor.user_id}
    elif event.event_type == "REQUEST_CANCELLED" and event.actor_user_id in (
        row.customer_id,
        vendor.user_id,
    ):
        recipients = {row.customer_id, vendor.user_id} - {event.actor_user_id}
    elif event.event_type in ("REQUEST_EXPIRED", "REQUEST_CANCELLED", "VENDOR_ARRIVED"):
        recipients = {row.customer_id, vendor.user_id}
    else:
        recipients = {row.customer_id}
    devices = session.scalars(
        select(DeviceToken)
        .join(User, User.id == DeviceToken.user_id)
        .where(
            DeviceToken.user_id.in_(recipients),
            DeviceToken.disabled_at.is_(None),
            User.status == "ACTIVE",
            User.role == DeviceToken.app_kind,
        )
        .order_by(DeviceToken.id)
        .with_for_update(read=True, key_share=True, of=DeviceToken)
    ).all()
    now = utcnow()
    for device in devices:
        if not live_family(session, device.user_id, device.session_family_id, now):
            continue
        identifier = uuid4()
        # A key-share keeps ownership stable without taking recipient account locks.
        statement = insert(NotificationOutbox).values(
            id=identifier,
            request_event_id=event.id,
            recipient_user_id=device.user_id,
            device_token_id=device.id,
            channel="expo",
            payload={
                "notification_id": str(identifier),
                "request_id": str(row.id),
                "event_type": event.event_type,
            },
            status="PENDING",
            attempts=0,
            receipt_attempts=0,
            next_attempt_at=now,
            created_at=now,
            updated_at=now,
        )
        session.execute(
            statement.on_conflict_do_nothing(
                constraint="uq_outbox_event_device_channel"
            )
        )
