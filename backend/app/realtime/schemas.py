from typing import Literal
from uuid import UUID

from pydantic import Field, SecretStr, field_validator

from app.auth.schemas import WriteModel


class AuthenticateInput(WriteModel):
    type: Literal["AUTHENTICATE"]
    access_token: SecretStr = Field(min_length=1, max_length=2048)

    @field_validator("access_token")
    @classmethod
    def ascii_token(cls, value):
        if not value.get_secret_value().isascii():
            raise ValueError("Use an ASCII access token.")
        return value


class PingInput(WriteModel):
    type: Literal["PING"]
    id: UUID


class SubscriptionInput(WriteModel):
    type: Literal["SUBSCRIBE_REQUEST", "UNSUBSCRIBE_REQUEST"]
    request_id: UUID
