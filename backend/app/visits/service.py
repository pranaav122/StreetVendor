"""Locks serialize decisions; state and its audit event commit together."""

import hashlib
import json
from datetime import timedelta

from geoalchemy2 import Geography, Geometry
from sqlalchemy import cast, func, select, tuple_
from sqlalchemy.exc import IntegrityError

from app.auth.security import utcnow
from app.auth.service import lock_user
from app.errors import problem
from app.location.validation import validate_service_area
from app.models.accounts import User
from app.models.locations import VendorLocation
from app.models.visits import RequestEvent, VisitRequest
from app.models.vendors import VendorProfile
from app.visits.state import ACTIVE, TERMINAL, VENDOR_TRANSITIONS, allowed_actions
from app.realtime.signals import notify_event


def missing():
    return problem(404, "REQUEST_NOT_FOUND", "Visit request not found.")


def conflict():
    return problem(
        409,
        "REQUEST_STATE_CONFLICT",
        "The request has changed. Refresh its current state.",
    )


def participant(session, actor, row):
    vendor = session.get(VendorProfile, row.vendor_id) if row else None
    if row is None or (
        actor.role != "admin"
        and row.customer_id != actor.id
        and vendor.user_id != actor.id
    ):
        raise missing()
    return vendor


def append_event(session, row, previous, actor_id=None):
    if row.status == "ARRIVED":
        name = "VENDOR_ARRIVED"
    elif previous is None:
        name = "REQUEST_CREATED"
    else:
        name = "REQUEST_" + row.status
    event = RequestEvent(
        request_id=row.id,
        actor_user_id=actor_id,
        request_version=row.version,
        event_type=name,
        from_status=previous,
        to_status=row.status,
        event_metadata={},
    )
    session.add(event)
    session.flush()
    notify_event(session, event)
    return event


def change_state(session, row, status, actor_id=None, reason=None, now=None):
    now = now or utcnow()
    previous = row.status
    row.status, row.version, row.updated_at = status, row.version + 1, now
    if status == "ACCEPTED":
        row.expires_at = now + timedelta(minutes=60)
    if status in TERMINAL:
        row.closed_at = now
    if reason is not None:
        row.reason = reason
    # Flush the new row version before its unique event; failure rolls everything back.
    session.flush()
    return append_event(session, row, previous, actor_id)


def expire_row(session, row, now=None):
    now = now or utcnow()
    if row.status in ACTIVE and row.expires_at <= now:
        change_state(session, row, "EXPIRED", now=now)
        return True
    return False


def available_location(session, vendor, now=None):
    now = now or utcnow()
    owner = session.get(User, vendor.user_id)
    if (
        owner.status != "ACTIVE"
        or owner.role != "vendor"
        or vendor.verification_status != "VERIFIED"
        or not vendor.is_available
        or not vendor.location_sharing_enabled
    ):
        raise problem(
            409, "VENDOR_UNAVAILABLE", "This vendor is currently unavailable."
        )
    location = session.get(VendorLocation, vendor.id)
    if (
        location is None
        or not now - timedelta(seconds=90)
        <= location.captured_at
        <= now + timedelta(seconds=30)
        or location.accuracy_m > 100
    ):
        raise problem(
            409, "VENDOR_UNAVAILABLE", "A fresh vendor location is unavailable."
        )
    return location


def lock_target_vendor(session, vendor):
    # Cancellation remains possible after the other party loses account access.
    # Lock the target for serialization without treating its status as the caller's credentials.
    session.scalar(
        select(User)
        .where(User.id == vendor.user_id)
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    return session.scalar(
        select(VendorProfile)
        .where(VendorProfile.id == vendor.id)
        .with_for_update()
        .execution_options(populate_existing=True)
    )


def visit_response(session, row, actor):
    vendor = participant(session, actor, row)
    customer = session.get(User, row.customer_id)
    point = None
    if row.meeting_point is not None:
        # Keep geometry conversion in PostGIS instead of rebinding Python WKB values.
        longitude, latitude = session.execute(
            select(
                func.ST_X(cast(VisitRequest.meeting_point, Geometry)),
                func.ST_Y(cast(VisitRequest.meeting_point, Geometry)),
            ).where(VisitRequest.id == row.id)
        ).one()
        point = {"latitude": latitude, "longitude": longitude}
    return {
        "id": row.id,
        "customer_id": row.customer_id,
        "vendor_id": row.vendor_id,
        "customer_name": customer.display_name,
        "vendor_name": vendor.display_name,
        "status": row.status,
        "version": row.version,
        "created_at": row.created_at,
        "updated_at": row.updated_at,
        "expires_at": row.expires_at,
        "closed_at": row.closed_at,
        "meeting_point": point,
        "meeting_label": row.meeting_label,
        "reason": row.reason,
        "allowed_actions": allowed_actions(
            row, customer=row.customer_id == actor.id, vendor=vendor.user_id == actor.id
        ),
    }


def create_visit(session, actor, payload, key, settings):
    lock_user(session, actor.id)
    digest = hashlib.sha256(
        json.dumps(
            payload.model_dump(mode="json"), sort_keys=True, separators=(",", ":")
        ).encode()
    ).digest()
    existing = session.scalar(
        select(VisitRequest)
        .where(
            VisitRequest.customer_id == actor.id, VisitRequest.idempotency_key == key
        )
        .with_for_update()
    )
    if existing:
        if existing.payload_hash != digest:
            raise problem(
                409,
                "IDEMPOTENCY_CONFLICT",
                "Use a new idempotency key for changed input.",
            )
        expire_row(session, existing)
        session.commit()
        return visit_response(session, existing, actor)
    vendor = session.get(VendorProfile, payload.vendor_id)
    if vendor is None or vendor.user_id == actor.id:
        raise problem(404, "VENDOR_NOT_FOUND", "Vendor not found.")
    vendor = lock_target_vendor(session, vendor)
    location = available_location(session, vendor)
    count = session.scalar(
        select(func.count())
        .select_from(VisitRequest)
        .where(
            VisitRequest.vendor_id == vendor.id,
            VisitRequest.status.in_(ACTIVE),
            VisitRequest.expires_at > utcnow(),
        )
    )
    # Keep per-fix arrival evaluation bounded under the same vendor lock as creation.
    if count >= settings.vendor_active_request_limit:
        raise problem(
            409,
            "VENDOR_CAPACITY_REACHED",
            "This vendor has reached the active visit limit. Try again later.",
        )
    validate_service_area(session, payload.meeting_point, settings)
    point = cast(
        func.ST_SetSRID(
            func.ST_MakePoint(
                payload.meeting_point.longitude, payload.meeting_point.latitude
            ),
            4326,
        ),
        Geography,
    )
    # Request eligibility uses the already-public coarse region, avoiding an exact-distance oracle.
    distance = session.scalar(
        select(
            func.ST_Distance(
                cast(
                    func.ST_SnapToGrid(cast(VendorLocation.position, Geometry), 0.01),
                    Geography,
                ),
                point,
            )
        ).where(VendorLocation.vendor_id == vendor.id)
    )
    if distance > 5000:
        raise problem(
            422,
            "MEETING_POINT_TOO_FAR",
            "Choose a meeting point closer to the vendor's region.",
        )
    active = session.scalar(
        select(VisitRequest)
        .where(
            VisitRequest.customer_id == actor.id,
            VisitRequest.vendor_id == vendor.id,
            VisitRequest.status.in_(ACTIVE),
        )
        .with_for_update()
    )
    if active:
        if not expire_row(session, active):
            raise problem(
                409,
                "ACTIVE_REQUEST_EXISTS",
                "You already have an active request with this vendor.",
            )
        session.flush()
    now = utcnow()
    row = VisitRequest(
        customer_id=actor.id,
        vendor_id=vendor.id,
        meeting_point=point,
        meeting_label=payload.meeting_label,
        payload_hash=digest,
        idempotency_key=key,
        status="PENDING",
        version=1,
        created_at=now,
        updated_at=now,
        expires_at=now + timedelta(minutes=5),
    )
    session.add(row)
    try:
        session.flush()
        append_event(session, row, None, actor.id)
        session.commit()
    except IntegrityError:
        session.rollback()
        raise problem(
            409,
            "REQUEST_CONFLICT",
            "An active request or retry already exists. Refresh your inbox.",
        ) from None
    return visit_response(session, row, actor)


def transition_visit(session, actor, request_id, action, expected_version, reason=None):
    row = session.get(VisitRequest, request_id)
    vendor = participant(session, actor, row)
    # Every participant transition follows the same vendor-account -> profile -> visit order.
    vendor = lock_target_vendor(session, vendor)
    row = session.scalar(
        select(VisitRequest)
        .where(VisitRequest.id == request_id)
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    if expire_row(session, row):
        # Persist expiry before returning a conflict; cleanup must not roll the event back.
        session.commit()
        raise conflict()
    if row.version != expected_version or row.status in TERMINAL:
        raise conflict()
    if action in ("cancel", "admin-cancel"):
        if action == "admin-cancel" and actor.role != "admin":
            raise problem(403, "FORBIDDEN", "Staff authorization is required.")
        if action == "cancel" and actor.id not in (row.customer_id, vendor.user_id):
            raise problem(403, "FORBIDDEN", "Only a participant can cancel this visit.")
        target = "CANCELLED"
    else:
        if actor.id != vendor.user_id:
            raise problem(
                403, "FORBIDDEN", "Only the target vendor can perform this action."
            )
        states, target = VENDOR_TRANSITIONS[action]
        if row.status not in states:
            raise conflict()
        if action in ("accept", "approach"):
            available_location(session, vendor)
        if action == "complete" and (
            vendor.verification_status != "VERIFIED"
            or session.get(User, vendor.user_id).status != "ACTIVE"
        ):
            raise problem(
                409,
                "VENDOR_UNAVAILABLE",
                "Staff review is required before completing this visit.",
            )
    change_state(session, row, target, actor.id, reason)
    if action == "admin-cancel":
        from app.admin.service import audit

        audit(session, actor, row.id, "REQUEST_CANCELLED", reason)
    session.commit()
    return visit_response(session, row, actor)


def get_visit(session, actor, request_id):
    row = session.scalar(
        select(VisitRequest).where(VisitRequest.id == request_id).with_for_update()
    )
    participant(session, actor, row)
    expire_row(session, row)
    if actor.role == "admin":
        from app.admin.service import audit

        audit(session, actor, row.id, "REQUEST_VIEWED", "Staff request inspection")
    session.commit()
    return visit_response(session, row, actor)


def list_visits(session, actor, status=None, limit=20, cursor=None):
    from app.jobs import expire_visits

    # Expiry locks visits only and never then locks accounts, so it cannot invert write lock order.
    expire_visits(session, utcnow())
    query = select(VisitRequest)
    if actor.role == "customer":
        query = query.where(VisitRequest.customer_id == actor.id)
    elif actor.role == "vendor":
        query = query.join(VendorProfile).where(VendorProfile.user_id == actor.id)
    else:
        raise problem(
            403, "FORBIDDEN", "Use staff request inspection for administrative access."
        )
    if status:
        query = query.where(VisitRequest.status == status)
    if cursor:
        anchor = session.scalar(query.where(VisitRequest.id == cursor))
        if anchor is None:
            raise problem(422, "INVALID_CURSOR", "Refresh your request history.")
        query = query.where(
            tuple_(VisitRequest.created_at, VisitRequest.id)
            < tuple_(anchor.created_at, anchor.id)
        )
    rows = list(
        session.scalars(
            query.order_by(
                VisitRequest.created_at.desc(), VisitRequest.id.desc()
            ).limit(limit + 1)
        )
    )
    return {
        "items": [visit_response(session, row, actor) for row in rows[:limit]],
        "next_cursor": str(rows[limit - 1].id) if len(rows) > limit else None,
    }
