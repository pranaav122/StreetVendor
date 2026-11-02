from datetime import datetime

from pydantic import AwareDatetime, Field

from app.auth.schemas import WriteModel


class PointInput(WriteModel):
    latitude: float = Field(ge=-90, le=90, allow_inf_nan=False)
    longitude: float = Field(ge=-180, le=180, allow_inf_nan=False)


class LocationInput(PointInput):
    accuracy_m: float = Field(ge=0, le=100, allow_inf_nan=False)
    captured_at: AwareDatetime


class ValidatedFix(LocationInput):
    received_at: datetime
