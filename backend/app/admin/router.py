from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select

from app.admin.schemas import ReasonInput, ReviewInput, SuspensionInput
from app.admin.service import (
    reinstate_vendor,
    review_vendor,
    suspend_account,
    suspend_vendor,
)
from app.admin.summary import staff_summary
from app.auth.dependencies import Db, require_role
from app.models.accounts import User
from app.models.vendors import VendorProfile, VendorVerification
from app.visits.reports import list_reports, resolve_report
from app.visits.schemas import CancelInput
from app.visits.service import transition_visit

router = APIRouter(prefix="/api/v1/admin", tags=["administration"])
Admin = Annotated[User, Depends(require_role("admin"))]


@router.get("/verifications")
def verifications(
    session: Db,
    user: Admin,
    status: Literal["PENDING", "VERIFIED", "REJECTED"] = "PENDING",
    limit: int = Query(default=20, ge=1, le=100),
    cursor: UUID | None = None,
):
    query = (
        select(VendorVerification, VendorProfile.display_name)
        .join(VendorProfile)
        .join(User, User.id == VendorProfile.user_id)
        .where(VendorVerification.status == status, User.status != "DELETED")
    )
    if status == "PENDING":
        query = query.where(
            VendorProfile.verification_status == "PENDING", User.status == "ACTIVE"
        )
    if cursor:
        query = query.where(VendorVerification.id > cursor)
    rows = session.execute(query.order_by(VendorVerification.id).limit(limit + 1)).all()
    return {
        "items": [
            {
                "id": row.id,
                "vendor_id": row.vendor_id,
                "display_name": name,
                "status": row.status,
                "evidence_note": row.evidence_note,
                "submitted_at": row.submitted_at,
            }
            for row, name in rows[:limit]
        ],
        "next_cursor": str(rows[limit - 1][0].id) if len(rows) > limit else None,
    }


@router.post("/vendors/{vendor_id}/verification")
def verification(vendor_id: UUID, payload: ReviewInput, session: Db, user: Admin):
    return review_vendor(session, user, vendor_id, payload)


@router.post("/vendors/{vendor_id}/suspension")
def vendor_suspension(vendor_id: UUID, payload: ReasonInput, session: Db, user: Admin):
    return suspend_vendor(session, user, vendor_id, payload.reason)


@router.post("/vendors/{vendor_id}/reinstatement")
def vendor_reinstatement(
    vendor_id: UUID, payload: ReasonInput, session: Db, user: Admin
):
    return reinstate_vendor(session, user, vendor_id, payload.reason)


@router.get("/summary")
def summary(session: Db, user: Admin):
    return staff_summary(session)


@router.post("/users/{user_id}/suspension")
def user_suspension(user_id: UUID, payload: SuspensionInput, session: Db, user: Admin):
    return suspend_account(session, user, user_id, payload)


@router.get("/reports")
def reports(
    session: Db,
    user: Admin,
    status: Literal["OPEN", "RESOLVED"] = "OPEN",
    limit: int = Query(default=20, ge=1, le=100),
    cursor: UUID | None = None,
):
    return list_reports(session, status, limit, cursor)


@router.post("/reports/{report_id}/resolution")
def resolution(report_id: UUID, payload: ReasonInput, session: Db, user: Admin):
    return resolve_report(session, user, report_id, payload.reason)


@router.post("/requests/{request_id}/cancel")
def staff_cancel(request_id: UUID, payload: CancelInput, session: Db, user: Admin):
    return transition_visit(
        session,
        user,
        request_id,
        "admin-cancel",
        payload.expected_version,
        payload.reason,
    )
