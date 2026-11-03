"""Deleting an account ends active visits before erasing their required points."""

from sqlalchemy import or_, select, update

from app.models.visits import VisitRequest
from app.visits.service import change_state
from app.visits.state import ACTIVE


def erase_account_visits(session, user, vendor=None):
    scope = VisitRequest.customer_id == user.id
    if vendor is not None:
        scope = or_(scope, VisitRequest.vendor_id == vendor.id)
    # These writes lock visits only; they never acquire another account afterward.
    rows = session.scalars(
        select(VisitRequest)
        .where(scope, VisitRequest.status.in_(ACTIVE))
        .order_by(VisitRequest.id)
        .with_for_update()
    ).all()
    for row in rows:
        change_state(session, row, "CANCELLED", user.id)
    session.execute(
        update(VisitRequest)
        .where(scope)
        .values(meeting_point=None, meeting_label=None, reason=None)
    )
    return [row.id for row in rows]
