from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, Header, Query, Request

from app.auth.dependencies import Db, require_role
from app.auth.service import consume_limit
from app.models.accounts import User
from app.visits.reports import submit_report
from app.visits.schemas import (
    CancelInput,
    CreateVisitInput,
    DeclineInput,
    ReportInput,
    VersionInput,
)
from app.visits.service import create_visit, get_visit, list_visits, transition_visit
from app.visits.tracking import vendor_location

router = APIRouter(prefix="/api/v1/requests", tags=["visits"])
Member = Annotated[User, Depends(require_role("customer", "vendor", "admin"))]
Customer = Annotated[User, Depends(require_role("customer"))]
Status = Literal[
    "PENDING",
    "ACCEPTED",
    "APPROACHING",
    "ARRIVED",
    "COMPLETED",
    "DECLINED",
    "CANCELLED",
    "EXPIRED",
]


@router.post("", status_code=201)
def create(
    payload: CreateVisitInput,
    request: Request,
    session: Db,
    user: Customer,
    idempotency_key: Annotated[UUID, Header(alias="Idempotency-Key")],
):
    consume_limit(request, str(user.id), "request-create", 10)
    return create_visit(
        session, user, payload, idempotency_key, request.app.state.settings
    )


@router.get("")
def inbox(
    session: Db,
    user: Member,
    status: Status | None = None,
    limit: int = Query(default=20, ge=1, le=100),
    cursor: UUID | None = None,
):
    return list_visits(session, user, status, limit, cursor)


@router.get("/{request_id}")
def detail(request_id: UUID, session: Db, user: Member):
    return get_visit(session, user, request_id)


@router.get("/{request_id}/vendor-location")
def tracking(request_id: UUID, session: Db, user: Member):
    return vendor_location(session, user, request_id)


@router.post("/{request_id}/accept")
def accept(request_id: UUID, payload: VersionInput, session: Db, user: Member):
    return transition_visit(
        session, user, request_id, "accept", payload.expected_version
    )


@router.post("/{request_id}/decline")
def decline(request_id: UUID, payload: DeclineInput, session: Db, user: Member):
    return transition_visit(
        session, user, request_id, "decline", payload.expected_version, payload.reason
    )


@router.post("/{request_id}/approach")
def approach(request_id: UUID, payload: VersionInput, session: Db, user: Member):
    return transition_visit(
        session, user, request_id, "approach", payload.expected_version
    )


@router.post("/{request_id}/complete")
def complete(request_id: UUID, payload: VersionInput, session: Db, user: Member):
    return transition_visit(
        session, user, request_id, "complete", payload.expected_version
    )


@router.post("/{request_id}/cancel")
def cancel(request_id: UUID, payload: CancelInput, session: Db, user: Member):
    return transition_visit(
        session, user, request_id, "cancel", payload.expected_version, payload.reason
    )


@router.post("/{request_id}/reports", status_code=201)
def report(
    request_id: UUID, payload: ReportInput, request: Request, session: Db, user: Member
):
    consume_limit(request, str(user.id), "visit-report", 10)
    return submit_report(session, user, request_id, payload)
