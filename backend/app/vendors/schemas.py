from uuid import UUID

from pydantic import Field, model_validator

from app.auth.schemas import Label, WriteModel
from app.location.schemas import LocationInput


class VendorInput(WriteModel):
    display_name: Label = Field(min_length=1, max_length=100)
    description: Label = Field(default="", max_length=1000)
    category_ids: list[UUID] = Field(min_length=1, max_length=10)

    @model_validator(mode="after")
    def unique_categories(self):
        if len(set(self.category_ids)) != len(self.category_ids):
            raise ValueError("Choose each category once.")
        return self


class AvailabilityInput(WriteModel):
    is_available: bool
    location_sharing_enabled: bool
    location: LocationInput | None = None

    @model_validator(mode="after")
    def consent_and_first_fix(self):
        if self.is_available and (not self.location_sharing_enabled or self.location is None):
            raise ValueError("Going online requires consent and a first location fix.")
        if not self.is_available and (self.location_sharing_enabled or self.location is not None):
            raise ValueError("Going offline must stop sharing and omit location.")
        return self


class VerificationInput(WriteModel):
    evidence_note: Label = Field(min_length=10, max_length=1000)
