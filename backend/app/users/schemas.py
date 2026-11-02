from typing import Literal

from pydantic import Field

from app.auth.schemas import Label, WriteModel


class ProfileInput(WriteModel):
    display_name: Label | None = Field(default=None, min_length=1, max_length=100)
    preferred_language: Literal["en", "ta"] | None = None


class DeleteInput(WriteModel):
    confirmation: Literal["DELETE"]
