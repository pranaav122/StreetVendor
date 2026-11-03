"""Bounded database maintenance; a single API process owns the periodic runner."""

import asyncio
import logging
from datetime import timedelta

from sqlalchemy import and_, delete, or_, select, update
from sqlalchemy.exc import SQLAlchemyError

from app.auth.security import utcnow
from app.models.accounts import RateLimitBucket
from app.models.mail_tokens import MailToken
from app.models.visits import VisitRequest
from app.visits.state import ACTIVE, TERMINAL
from app.models.notifications import DeviceToken, NotificationOutbox
from app.notifications.dispatcher import dispatch_batch

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
    # Expire alerts even when provider credentials are absent or delivery is paused.
    obsolete_jobs = (
        select(NotificationOutbox.id)
        .where(
            NotificationOutbox.created_at <= now - timedelta(minutes=5),
            or_(
                NotificationOutbox.status == "PENDING",
                and_(
                    NotificationOutbox.status == "SENDING",
                    NotificationOutbox.lease_until <= now,
                ),
            ),
        )
        .limit(limit)
        .with_for_update(skip_locked=True)
    )
    session.execute(
        update(NotificationOutbox)
        .where(NotificationOutbox.id.in_(obsolete_jobs))
        .values(
            status="SUPPRESSED",
            last_error_code="OBSOLETE_EVENT",
            finished_at=now,
            updated_at=now,
            lease_until=None,
            lease_token=None,
        )
    )
    overdue_receipts = (
        select(NotificationOutbox.id)
        .where(
            NotificationOutbox.created_at <= now - timedelta(hours=24),
            or_(
                NotificationOutbox.status == "AWAITING_RECEIPT",
                and_(
                    NotificationOutbox.status == "CHECKING_RECEIPT",
                    NotificationOutbox.lease_until <= now,
                ),
            ),
        )
        .limit(limit)
        .with_for_update(skip_locked=True)
    )
    session.execute(
        update(NotificationOutbox)
        .where(NotificationOutbox.id.in_(overdue_receipts))
        .values(
            status="FAILED",
            last_error_code="RECEIPT_TIMEOUT",
            finished_at=now,
            updated_at=now,
            lease_until=None,
            lease_token=None,
        )
    )
    finished_jobs = (
        select(NotificationOutbox.id)
        .where(
            NotificationOutbox.finished_at <= now - timedelta(days=7),
            NotificationOutbox.payload != {},
        )
        .limit(limit)
    )
    session.execute(
        update(NotificationOutbox)
        .where(NotificationOutbox.id.in_(finished_jobs))
        .values(payload={})
    )
    session.commit()
    # Release visit/outbox locks before deleting devices: registration locks the
    # device first, then its jobs. Independent cleanup avoids reversing that order.
    old_devices = (
        select(DeviceToken.id)
        .where(
            or_(
                DeviceToken.disabled_at <= now - timedelta(days=30),
                DeviceToken.last_seen_at <= now - timedelta(days=30),
            )
        )
        .limit(limit)
    )
    session.execute(delete(DeviceToken).where(DeviceToken.id.in_(old_devices)))
    session.commit()
    return {"redacted": len(redact), "purged": len(purge)}


def maintenance(app):
    with app.state.session_factory() as session:
        now = utcnow()
        expire_visits(session, now)
        retain_data(session, now)
    dispatch_batch(app.state.session_factory, app.state.push_provider, now)
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
