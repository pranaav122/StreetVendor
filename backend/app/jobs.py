"""Bounded database maintenance; a single API process owns the periodic runner."""

import asyncio
import logging
from datetime import timedelta

from sqlalchemy import delete, select, update
from sqlalchemy.exc import SQLAlchemyError

from app.auth.security import utcnow
from app.models.accounts import RateLimitBucket
from app.models.mail_tokens import MailToken
from app.models.visits import VisitRequest
from app.visits.state import ACTIVE, TERMINAL

logger = logging.getLogger(__name__)


def expire_visits(session, now, limit=100):
    from app.visits.service import change_state

    rows = session.scalars(
        select(VisitRequest)
        .where(VisitRequest.status.in_(ACTIVE), VisitRequest.expires_at <= now)
        .order_by(VisitRequest.id)
        .limit(limit)
        .with_for_update(skip_locked=True)
    ).all()
    for row in rows:
        change_state(session, row, "EXPIRED", now=now)
    session.commit()
    return len(rows)


def retain_data(session, now, limit=100):
    # Coordinate redaction has a shorter deadline than minimal workflow history.
    redact = list(
        session.scalars(
            select(VisitRequest.id)
            .where(
                VisitRequest.status.in_(TERMINAL),
                VisitRequest.closed_at <= now - timedelta(hours=24),
                VisitRequest.meeting_point.is_not(None),
            )
            .order_by(VisitRequest.id)
            .limit(limit)
            .with_for_update(skip_locked=True)
        )
    )
    if redact:
        session.execute(
            update(VisitRequest)
            .where(VisitRequest.id.in_(redact))
            .values(meeting_point=None, meeting_label=None, reason=None)
        )
    purge = list(
        session.scalars(
            select(VisitRequest.id)
            .where(
                VisitRequest.status.in_(TERMINAL),
                VisitRequest.closed_at <= now - timedelta(days=90),
            )
            .order_by(VisitRequest.id)
            .limit(limit)
            .with_for_update(skip_locked=True)
        )
    )
    if purge:
        session.execute(delete(VisitRequest).where(VisitRequest.id.in_(purge)))
    expired_limits = (
        select(RateLimitBucket.key)
        .where(RateLimitBucket.expires_at <= now)
        .limit(limit)
    )
    session.execute(
        delete(RateLimitBucket).where(RateLimitBucket.key.in_(expired_limits))
    )
    expired_mail = (
        select(MailToken.id)
        .where(MailToken.expires_at <= now - timedelta(days=1))
        .limit(limit)
    )
    session.execute(delete(MailToken).where(MailToken.id.in_(expired_mail)))
    session.commit()
    return {"redacted": len(redact), "purged": len(purge)}


def maintenance(app):
    with app.state.session_factory() as session:
        now = utcnow()
        expire_visits(session, now)
        retain_data(session, now)
    # Terminal or long-idle candidates contain only times and can be discarded safely.
    for request_id, candidate in list(app.state.arrival_candidates.items()):
        if now - candidate.received_at > timedelta(seconds=30):
            app.state.arrival_candidates.pop(request_id, None)


async def run_jobs(app):
    while not app.state.jobs_stop.is_set():
        try:
            await asyncio.to_thread(maintenance, app)
        except SQLAlchemyError as error:
            logger.warning("Maintenance failed: %s", type(error).__name__)
        try:
            await asyncio.wait_for(app.state.jobs_stop.wait(), timeout=1)
        except TimeoutError:
            pass
