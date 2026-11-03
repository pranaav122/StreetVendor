from datetime import timedelta

from geoalchemy2 import Geometry
from sqlalchemy import cast, func, select

from app.auth.security import utcnow
from app.errors import problem
from app.models.accounts import User
from app.models.locations import VendorLocation
from app.models.visits import VisitRequest
from app.models.vendors import VendorProfile
from app.visits.service import expire_row, missing
from app.visits.state import TRACKABLE


def vendor_location(session, actor, request_id):
    row = session.scalar(
        select(VisitRequest).where(VisitRequest.id == request_id).with_for_update()
    )
    if row is None or actor.role != "customer" or row.customer_id != actor.id:
        raise missing()
    if expire_row(session, row):
        session.commit()
        raise problem(409, "TRACKING_UNAVAILABLE", "The visit has expired.")
    # Read live joined eligibility on every call. Cached ORM identity state is insufficient.
    eligible = session.execute(
        select(VendorLocation, VendorProfile, User)
        .join(VendorProfile, VendorProfile.id == VendorLocation.vendor_id)
        .join(User, User.id == VendorProfile.user_id)
        .where(
            VendorProfile.id == row.vendor_id,
            User.status == "ACTIVE",
            User.role == "vendor",
            VendorProfile.verification_status == "VERIFIED",
            VendorProfile.is_available.is_(True),
            VendorProfile.location_sharing_enabled.is_(True),
            VendorLocation.captured_at >= utcnow() - timedelta(seconds=90),
            VendorLocation.captured_at <= utcnow() + timedelta(seconds=30),
            VendorLocation.accuracy_m <= 100,
        )
    ).first()
    if row.status not in TRACKABLE or row.expires_at <= utcnow() or eligible is None:
        raise problem(
            409,
            "TRACKING_UNAVAILABLE",
            "A fresh authorized vendor location is unavailable.",
        )
    location = eligible[0]
    longitude, latitude = session.execute(
        select(
            func.ST_X(cast(VendorLocation.position, Geometry)),
            func.ST_Y(cast(VendorLocation.position, Geometry)),
        ).where(VendorLocation.vendor_id == row.vendor_id)
    ).one()
    return {
        "latitude": latitude,
        "longitude": longitude,
        "accuracy_m": location.accuracy_m,
        "captured_at": location.captured_at,
    }
