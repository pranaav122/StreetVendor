from sqlalchemy import select, update

from app.auth.security import utcnow
from app.errors import problem
from app.models.accounts import RefreshSession, User
from app.models.vendors import AdminAuditRecord, VendorProfile, VendorVerification
from app.vendors.service import hide_vendor, vendor_response


def target_vendor(session, vendor_id):
    row = session.get(VendorProfile, vendor_id)
    if row is None:
        raise problem(404, "VENDOR_NOT_FOUND", "Vendor not found.")
    # Staff act on a target account; its suspension must not invalidate staff credentials.
    owner = session.scalar(
        select(User)
        .where(User.id == row.user_id)
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    if owner is None or owner.status == "DELETED":
        raise problem(404, "VENDOR_NOT_FOUND", "Vendor not found.")
    return session.scalar(
        select(VendorProfile)
        .where(VendorProfile.id == row.id)
        .with_for_update()
        .execution_options(populate_existing=True)
    )


def require_active_target(session, row):
    owner = session.get(User, row.user_id)
    if owner.status != "ACTIVE" or owner.role != "vendor":
        raise problem(
            409,
            "TARGET_ACCOUNT_INACTIVE",
            "Restore the target vendor account before reviewing this business.",
        )


def audit(session, actor, target_id, action, reason):
    # Audit rows participate in the business transaction; failure rolls both back.
    session.add(
        AdminAuditRecord(
            actor_user_id=actor.id, target_id=target_id, action=action, reason=reason
        )
    )


def review_vendor(session, actor, vendor_id, payload):
    row = target_vendor(session, vendor_id)
    if row.user_id == actor.id:
        raise problem(
            403, "SELF_REVIEW_FORBIDDEN", "Another operator must review this profile."
        )
    require_active_target(session, row)
    if row.verification_status == "SUSPENDED":
        raise problem(
            409,
            "VERIFICATION_STATE_CONFLICT",
            "Resolve the suspension before another review.",
        )
    review = session.scalar(
        select(VendorVerification)
        .where(
            VendorVerification.vendor_id == row.id,
            VendorVerification.status == "PENDING",
        )
        .with_for_update()
    )
    if review is None:
        raise problem(409, "NO_PENDING_REVIEW", "No pending submission exists.")
    review.status, review.decision_reason = payload.decision, payload.reason
    review.reviewed_by, review.reviewed_at = actor.id, utcnow()
    row.verification_status, row.updated_at = payload.decision, utcnow()
    if payload.decision != "VERIFIED":
        hide_vendor(session, row)
    audit(session, actor, row.id, f"VENDOR_{payload.decision}", payload.reason)
    session.commit()
    return vendor_response(session, row, private=True)


def suspend_vendor(session, actor, vendor_id, reason):
    row = target_vendor(session, vendor_id)
    hide_vendor(session, row)
    row.verification_status = "SUSPENDED"
    audit(session, actor, row.id, "VENDOR_SUSPENDED", reason)
    session.commit()
    return vendor_response(session, row, private=True)


def reinstate_vendor(session, actor, vendor_id, reason):
    row = target_vendor(session, vendor_id)
    require_active_target(session, row)
    if row.verification_status != "SUSPENDED":
        raise problem(
            409,
            "VERIFICATION_STATE_CONFLICT",
            "Only a suspended business can return to review.",
        )
    # Reinstatement restores review eligibility; staff must separately approve the business.
    hide_vendor(session, row)
    row.verification_status = "PENDING"
    audit(session, actor, row.id, "VENDOR_REINSTATED", reason)
    session.commit()
    return vendor_response(session, row, private=True)


def suspend_account(session, actor, user_id, payload):
    if actor.id == user_id:
        raise problem(
            403,
            "SELF_SUSPENSION_FORBIDDEN",
            "Another operator must change your account status.",
        )
    user = session.scalar(
        select(User)
        .where(User.id == user_id)
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    if user is None or user.status == "DELETED":
        raise problem(404, "USER_NOT_FOUND", "Account not found.")
    user.status, user.updated_at = (
        ("SUSPENDED" if payload.suspended else "ACTIVE"),
        utcnow(),
    )
    if payload.suspended:
        row = session.scalar(
            select(VendorProfile)
            .where(VendorProfile.user_id == user.id)
            .with_for_update()
        )
        if row:
            hide_vendor(session, row)
        session.execute(
            update(RefreshSession)
            .where(RefreshSession.user_id == user.id)
            .values(revoked_at=utcnow())
        )
    audit(
        session,
        actor,
        user.id,
        "USER_SUSPENDED" if payload.suspended else "USER_RESTORED",
        payload.reason,
    )
    session.commit()
    return {"id": user.id, "status": user.status}
