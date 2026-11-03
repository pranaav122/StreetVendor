"""Operational visit counts use the development pilot's explicit local day."""

from sqlalchemy import text

DAY_START = (
    "(date_trunc('day',now() AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata')"
)


def visit_counts(session, vendor_id=None):
    counts = (
        session.execute(
            text(f"""
        SELECT count(*) FILTER (WHERE status IN ('PENDING','ACCEPTED','APPROACHING','ARRIVED') AND expires_at>now()) AS active_visits,
            count(*) FILTER (WHERE status='PENDING' AND expires_at>now()) AS pending_visits,
            count(*) FILTER (WHERE status='COMPLETED' AND closed_at>={DAY_START}
                AND closed_at<{DAY_START}+interval '1 day') AS completed_visits_today
        FROM visit_requests WHERE CAST(:vendor_id AS uuid) IS NULL OR vendor_id=CAST(:vendor_id AS uuid)
        """),
            {"vendor_id": vendor_id},
        )
        .mappings()
        .one()
    )
    return dict(counts) | {"day_timezone": "Asia/Kolkata"}


def staff_summary(session):
    counts = (
        session.execute(
            text("""
        SELECT (SELECT count(*) FROM vendor_profiles v JOIN users u ON u.id=v.user_id
                WHERE v.verification_status='VERIFIED' AND u.status='ACTIVE') AS verified_vendors,
            (SELECT count(*) FROM vendor_verifications r JOIN vendor_profiles v ON v.id=r.vendor_id
                JOIN users u ON u.id=v.user_id WHERE r.status='PENDING'
                AND v.verification_status='PENDING' AND u.status='ACTIVE') AS pending_verifications,
            (SELECT count(*) FROM visit_reports WHERE status='OPEN') AS open_reports
        """)
        )
        .mappings()
        .one()
    )
    # These are changing operational counts, not financial or sales records.
    return dict(counts) | visit_counts(session)
