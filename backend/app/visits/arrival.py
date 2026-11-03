"""Transient debounce state is lost safely on restart: two new fixes are needed."""

from dataclasses import dataclass
from datetime import datetime, timedelta

from geoalchemy2 import Geography
from sqlalchemy import cast, func, select

from app.models.visits import VisitRequest
from app.visits.state import TRACKABLE


@dataclass(frozen=True)
class ArrivalCandidate:
    captured_at: datetime
    received_at: datetime
    sharing_epoch: datetime


def evaluate_arrival(session, vendor, fix, candidate_store, now):
    from app.visits.service import change_state, expire_row

    point = cast(
        func.ST_SetSRID(func.ST_MakePoint(fix.longitude, fix.latitude), 4326), Geography
    )
    rows = session.scalars(
        select(VisitRequest)
        .where(VisitRequest.vendor_id == vendor.id, VisitRequest.status.in_(TRACKABLE))
        .order_by(VisitRequest.id)
        .with_for_update()
    ).all()
    for row in rows:
        if expire_row(session, row, now):
            candidate_store.pop(row.id, None)
            continue
        if row.status == "ARRIVED":
            continue
        usable = fix.accuracy_m <= 30 and timedelta(
            0
        ) <= now - fix.captured_at <= timedelta(seconds=30)
        distance = (
            session.scalar(
                select(func.ST_Distance(VisitRequest.meeting_point, point)).where(
                    VisitRequest.id == row.id
                )
            )
            if usable
            else None
        )
        if usable and distance <= 500 and row.status == "ACCEPTED":
            change_state(session, row, "APPROACHING", now=now)
        if not usable or distance > 50:
            candidate_store.pop(row.id, None)
            continue
        previous = candidate_store.get(row.id)
        if (
            previous is None
            or previous.sharing_epoch != vendor.updated_at
            or now - previous.captured_at > timedelta(seconds=30)
        ):
            candidate_store[row.id] = ArrivalCandidate(
                fix.captured_at, fix.received_at, vendor.updated_at
            )
            continue
        # Device clocks alone cannot prove a dwell: elapsed server receipt time is required too.
        if fix.captured_at - previous.captured_at >= timedelta(
            seconds=5
        ) and fix.received_at - previous.received_at >= timedelta(seconds=5):
            change_state(session, row, "ARRIVED", now=now)
            candidate_store.pop(row.id, None)
