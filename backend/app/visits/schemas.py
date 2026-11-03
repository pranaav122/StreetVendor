from typing import Literal
from uuid import UUID

from pydantic import Field

from app.auth.schemas import Label, WriteModel
from app.location.schemas import PointInput


class CreateVisitInput(WriteModel):
    vendor_id: UUID
    meeting_point: PointInput
    meeting_label: Label | None = Field(default=None, max_length=250)


class VersionInput(WriteModel):
    expected_version: int = Field(ge=1)


class DeclineInput(VersionInput):
    reason: Label | None = Field(default=None, max_length=500)


class CancelInput(VersionInput):
    reason: Label = Field(min_length=1, max_length=500)


class ReportInput(WriteModel):
    category: Literal["SAFETY", "NO_SHOW", "OTHER"]
    reason: Label = Field(min_length=10, max_length=1000)
