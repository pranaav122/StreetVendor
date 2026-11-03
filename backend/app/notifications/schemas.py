import re
from typing import Literal
from uuid import UUID

from pydantic import Field, SecretStr, field_validator

from app.auth.schemas import WriteModel


class DeviceInput(WriteModel):
    app_kind: Literal["customer", "vendor"]
    platform: Literal["android", "ios"]
    project_id: UUID
    token: SecretStr = Field(min_length=20, max_length=256)

    @field_validator("token")
    @classmethod
    def expo_address(cls, value):
        if not re.fullmatch(
            r"(?:ExpoPushToken|ExponentPushToken)\[[A-Za-z0-9_-]{20,100}\]",
            value.get_secret_value(),
        ):
            raise ValueError("Use a valid Expo push token.")
        return value
