from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.auth.security import utcnow
from app.errors import problem
from app.models.reports import VisitReport
from app.models.visits import VisitRequest
from app.visits.service import missing, participant


def submit_report(session, actor, request_id, payload):
    row = session.get(VisitRequest, request_id)
    vendor = participant(session, actor, row)
    if actor.id not in (row.customer_id, vendor.user_id):
        raise missing()
    report = VisitReport(
        request_id=row.id,
        reporter_id=actor.id,
        category=payload.category,
        reason=payload.reason,
    )
    session.add(report)
    try:
        session.commit()
    except IntegrityError:
        session.rollback()
        raise problem(
            409, "REPORT_EXISTS", "You have already submitted a report for this visit."
        ) from None
    return {"id": report.id, "status": report.status, "created_at": report.created_at}


def list_reports(session, status, limit, cursor):
    query = select(VisitReport).where(VisitReport.status == status)
    if cursor:
        query = query.where(VisitReport.id > cursor)
    rows = list(session.scalars(query.order_by(VisitReport.id).limit(limit + 1)))
    return {
        "items": [
            {
                "id": row.id,
                "request_id": row.request_id,
                "reporter_id": row.reporter_id,
                "category": row.category,
                "reason": row.reason,
                "status": row.status,
                "created_at": row.created_at,
            }
            for row in rows[:limit]
        ],
        "next_cursor": str(rows[limit - 1].id) if len(rows) > limit else None,
    }


def resolve_report(session, actor, report_id, reason):
    from app.admin.service import audit

    report = session.scalar(
        select(VisitReport).where(VisitReport.id == report_id).with_for_update()
    )
    if report is None:
        raise problem(404, "REPORT_NOT_FOUND", "Report not found.")
    if report.status != "OPEN":
        raise problem(409, "REPORT_RESOLVED", "The report was already resolved.")
    report.status, report.resolved_at, report.resolved_by = (
        "RESOLVED",
        utcnow(),
        actor.id,
    )
    report.resolution_reason = reason
    audit(session, actor, report.id, "REPORT_RESOLVED", reason)
    session.commit()
    return {"id": report.id, "status": report.status, "resolved_at": report.resolved_at}
