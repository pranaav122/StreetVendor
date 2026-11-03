from datetime import datetime
from uuid import UUID

from pydantic import AwareDatetime, BaseModel, Field

from app.auth.schemas import WriteModel


class PointInput(WriteModel):
    latitude: float = Field(ge=-90, le=90, allow_inf_nan=False)
    longitude: float = Field(ge=-180, le=180, allow_inf_nan=False)


class LocationInput(PointInput):
    accuracy_m: float = Field(ge=0, le=100, allow_inf_nan=False)
    captured_at: AwareDatetime


class ValidatedFix(LocationInput):
    received_at: datetime


class SearchInput(PointInput):
    radius_m: int = Field(default=1500, ge=100, le=5000)
    limit: int = Field(default=20, ge=1, le=50)
    category_id: UUID | None = None
    cursor: str | None = Field(default=None, max_length=2048)


class ApproximateLocation(BaseModel):
    latitude: float
    longitude: float
    radius_m: int = 1000


class DistanceBand(BaseModel):
    min: int
    max: int


class NearbyItem(BaseModel):
    vendor_id: UUID
    display_name: str
    categories: list[dict]
    approximate_location: ApproximateLocation
    distance_band_m: DistanceBand
    location_updated_at: datetime


class VendorPage(BaseModel):
    items: list[NearbyItem]
    next_cursor: str | None
