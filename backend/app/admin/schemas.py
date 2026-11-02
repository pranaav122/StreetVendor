from typing import Literal

from pydantic import Field

from app.auth.schemas import Label, WriteModel


class ReasonInput(WriteModel):
    reason: Label = Field(min_length=10, max_length=500)


class ReviewInput(ReasonInput):
    decision: Literal["VERIFIED", "REJECTED"]


class SuspensionInput(ReasonInput):
    suspended: bool
