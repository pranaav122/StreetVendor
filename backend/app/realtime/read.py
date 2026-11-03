"""Short database sessions resolve live permissions; queues never contain points."""

from datetime import timedelta
from uuid import UUID, uuid4

from geoalchemy2 import Geometry
from sqlalchemy import cast, func, select

from app.auth.dependencies import authenticate_access
from app.auth.security import utcnow
from app.errors import problem
from app.models.locations import VendorLocation
from app.models.vendors import VendorProfile
from app.models.visits import RequestEvent, VisitRequest
from app.visits.state import TERMINAL, TRACKABLE
from app.visits.tracking import vendor_location


def authenticate(session, token, settings):
    context = authenticate_access(session, token, settings)
    if context.user.role not in ("customer", "vendor"):
        raise problem(
            403, "FORBIDDEN", "Realtime is available to customer and vendor accounts."
        )
    if settings.environment == "production" and context.user.email_verified_at is None:
        raise problem(403, "EMAIL_VERIFICATION_REQUIRED", "Confirm your email first.")
    return context


def audience(session, row):
    vendor = session.get(VendorProfile, row.vendor_id)
    return {row.customer_id, vendor.user_id}


def subscribe(session, actor, request_id):
    row = session.get(VisitRequest, request_id)
    if row is None or actor.id not in audience(session, row):
        raise problem(404, "REQUEST_NOT_FOUND", "Request not found.")
    if row.status not in TRACKABLE or row.expires_at <= utcnow():
        raise problem(
            409, "TRACKING_UNAVAILABLE", "Tracking is unavailable for this visit."
        )
    return row.vendor_id, row.version


def describe(session, payload):
    try:
        kind, identifier = payload.split(":", 1)
        identifier = UUID(identifier)
    except (ValueError, AttributeError):
        return None
    if kind == "event":
        event = session.get(RequestEvent, identifier)
        row = session.get(VisitRequest, event.request_id) if event else None
        if row:
            return {"kind": "EVENT", "id": event.id, "audience": audience(session, row)}
    if kind == "vendor":
        vendor = session.get(VendorProfile, identifier)
        if vendor:
            customers = set(
                session.scalars(
                    select(VisitRequest.customer_id).where(
                        VisitRequest.vendor_id == vendor.id,
                        VisitRequest.status.in_(TRACKABLE),
                        VisitRequest.expires_at > utcnow(),
                    )
                )
            )
            return {
                "kind": "VENDOR",
                "id": vendor.id,
                "owner": vendor.user_id,
                "audience": customers | {vendor.user_id},
            }
    return None


def event_message(session, actor, event_id):
    event = session.get(RequestEvent, event_id)
    row = session.get(VisitRequest, event.request_id) if event else None
    if (
        row is None
        or actor.id not in audience(session, row)
        or event.request_version < row.version
    ):
        return None, None
    message = {
        "event_id": event.id,
        "type": event.event_type,
        "occurred_at": event.created_at,
        "request_id": row.id,
        "request_version": event.request_version,
        "data": {"status": event.to_status},
    }
    return message, row.id if row.status in TERMINAL else None


def vendor_state(session, actor, vendor_id):
    vendor = session.get(VendorProfile, vendor_id)
    if vendor is None:
        return None
    participant = (
        actor.id == vendor.user_id
        or session.scalar(
            select(VisitRequest.id)
            .where(
                VisitRequest.vendor_id == vendor_id,
                VisitRequest.customer_id == actor.id,
                VisitRequest.status.in_(TRACKABLE),
                VisitRequest.expires_at > utcnow(),
            )
            .limit(1)
        )
        is not None
    )
    if not participant:
        return None
    return {
        "vendor_id": vendor.id,
        "is_available": vendor.is_available,
        "location_sharing_enabled": vendor.location_sharing_enabled,
    }


def own_location(session, actor, vendor_id):
    now = utcnow()
    row = (
        session.execute(
            select(
                func.ST_X(cast(VendorLocation.position, Geometry)).label("longitude"),
                func.ST_Y(cast(VendorLocation.position, Geometry)).label("latitude"),
                VendorLocation.accuracy_m,
                VendorLocation.captured_at,
            )
            .join(VendorProfile, VendorProfile.id == VendorLocation.vendor_id)
            .where(
                VendorProfile.id == vendor_id,
                VendorProfile.user_id == actor.id,
                VendorProfile.verification_status == "VERIFIED",
                VendorProfile.is_available.is_(True),
                VendorProfile.location_sharing_enabled.is_(True),
                VendorLocation.captured_at >= now - timedelta(seconds=90),
                VendorLocation.captured_at <= now + timedelta(seconds=30),
            )
        )
        .mappings()
        .first()
    )
    return dict(row) if row else None


def resolve(session, actor, command):
    kind = command["kind"]
    if kind == "EVENT":
        return event_message(session, actor, command["id"])
    if kind == "STATE":
        return vendor_state(session, actor, command["id"]), None
    if kind == "LOCATION":
        point = vendor_location(session, actor, command["request_id"])
        version = session.scalar(
            select(VisitRequest.version).where(VisitRequest.id == command["request_id"])
        )
        return {
            "event_id": uuid4(),
            "type": "VENDOR_LOCATION_UPDATED",
            "occurred_at": utcnow(),
            "request_id": command["request_id"],
            "request_version": version,
            "data": point,
        }, None
    if kind == "OWN_LOCATION":
        point = own_location(session, actor, command["id"])
        if point:
            return {
                "event_id": uuid4(),
                "type": "VENDOR_LOCATION_UPDATED",
                "occurred_at": utcnow(),
                "request_id": None,
                "vendor_id": command["id"],
                "data": point,
            }, None
    return None, None
