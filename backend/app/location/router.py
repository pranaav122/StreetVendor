from typing import Annotated

from fastapi import APIRouter, Depends, Query, Request

from app.auth.dependencies import Db, require_role
from app.auth.service import consume_limit
from app.location.schemas import LocationInput, SearchInput, VendorPage
from app.location.service import nearby, record_fix
from app.models.accounts import User

router = APIRouter(prefix="/api/v1/vendors", tags=["location"])
Vendor = Annotated[User, Depends(require_role("vendor"))]
Customer = Annotated[User, Depends(require_role("customer"))]


@router.put("/me/location")
def location(payload: LocationInput, request: Request, session: Db, user: Vendor):
    consume_limit(request, str(user.id), "location-update", 120)
    return record_fix(session, user, payload, request.app.state.settings)


@router.get("/nearby", response_model=VendorPage)
def discovery(search: Annotated[SearchInput, Query()], request: Request, session: Db, user: Customer):
    return nearby(session, user, search, request)
