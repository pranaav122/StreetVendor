"""PostgreSQL delivers these ID-only hints after commit and discards rollback hints."""

from sqlalchemy import text

CHANNEL = "mystreetvendor_live"


def notify_event(session, event):
    session.execute(
        text("SELECT pg_notify(:channel,:payload)"),
        {"channel": CHANNEL, "payload": f"event:{event.id}"},
    )


def notify_vendor(session, vendor_id):
    session.execute(
        text("SELECT pg_notify(:channel,:payload)"),
        {"channel": CHANNEL, "payload": f"vendor:{vendor_id}"},
    )
