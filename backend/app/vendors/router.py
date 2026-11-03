from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Request
from sqlalchemy import select

from app.auth.dependencies import Db, require_role
from app.auth.service import consume_limit
from app.errors import problem
from app.models.accounts import User
from app.models.vendors import VendorProfile, VendorVerification
from app.vendors.schemas import AvailabilityInput, VendorInput, VerificationInput
from app.vendors.service import (
    category_list,
    lock_vendor,
    save_profile,
    set_availability,
    vendor_response,
)

router = APIRouter(prefix="/api/v1", tags=["vendors"])
Vendor = Annotated[User, Depends(require_role("vendor"))]
Member = Annotated[User, Depends(require_role("customer", "vendor", "admin"))]


@router.get("/categories")
def categories(session: Db, user: Member):
    return {"items": category_list(session), "next_cursor": None}


@router.put("/vendors/me/profile")
def update_profile(payload: VendorInput, session: Db, user: Vendor):
    return save_profile(session, user, payload)


@router.get("/vendors/me")
def own_profile(session: Db, user: Vendor):
    row = session.scalar(select(VendorProfile).where(VendorProfile.user_id == user.id))
    if row is None:
        raise problem(404, "VENDOR_NOT_FOUND", "Create your business profile first.")
    return vendor_response(session, row, private=True)


@router.patch("/vendors/me/availability")
def availability(
    payload: AvailabilityInput, request: Request, session: Db, user: Vendor
):
    consume_limit(request, str(user.id), "availability", 60)
    return set_availability(
        session,
        user,
        payload,
        request.app.state.settings,
        request.app.state.arrival_candidates,
    )


@router.post("/vendors/me/verifications", status_code=201)
def submit_verification(
    payload: VerificationInput, request: Request, session: Db, user: Vendor
):
    consume_limit(request, str(user.id), "verification-submit", 10)
    row = lock_vendor(session, user.id)
    if row.verification_status in ("VERIFIED", "SUSPENDED"):
        raise problem(
            409,
            "VERIFICATION_STATE_CONFLICT",
            "This profile cannot submit another review now.",
        )
    pending = session.scalar(
        select(VendorVerification.id).where(
            VendorVerification.vendor_id == row.id,
            VendorVerification.status == "PENDING",
        )
    )
    if pending:
        raise problem(409, "REVIEW_PENDING", "Staff already have a pending submission.")
    review = VendorVerification(vendor_id=row.id, evidence_note=payload.evidence_note)
    row.verification_status = "PENDING"
    session.add(review)
    session.commit()
    return {
        "id": review.id,
        "status": review.status,
        "submitted_at": review.submitted_at,
    }


@router.get("/vendors/{vendor_id}")
def public_profile(vendor_id: UUID, session: Db, user: Member):
    row = session.scalar(
        select(VendorProfile)
        .join(User, User.id == VendorProfile.user_id)
        .where(
            VendorProfile.id == vendor_id,
            User.status == "ACTIVE",
            VendorProfile.verification_status != "SUSPENDED",
        )
    )
    if row is None:
        raise problem(404, "VENDOR_NOT_FOUND", "Vendor not found.")
    return vendor_response(session, row)
