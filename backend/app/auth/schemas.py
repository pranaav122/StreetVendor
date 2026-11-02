from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID

from pydantic import AfterValidator, BaseModel, ConfigDict, EmailStr, Field, SecretStr, StringConstraints, field_validator

Label = Annotated[str, StringConstraints(strip_whitespace=True)]


def check_password_text(value: SecretStr) -> SecretStr:
    # Reject malformed Unicode before the native hasher can turn it into a server error.
    try:
        encoded = value.get_secret_value().encode("utf-8")
    except UnicodeEncodeError:
        raise ValueError("Use a valid UTF-8 password.") from None
    if len(encoded) > 512:
        raise ValueError("Password must fit within 512 UTF-8 bytes.")
    return value


Password = Annotated[SecretStr, AfterValidator(check_password_text)]


class WriteModel(BaseModel):
    # Rejecting extra fields closes accidental mass-assignment paths such as role=admin.
    # Normalize human labels explicitly; global stripping would change passwords.
    model_config = ConfigDict(extra="forbid")


class RegisterInput(WriteModel):
    email: EmailStr
    password: Password = Field(min_length=15, max_length=128)
    display_name: Label = Field(min_length=1, max_length=100)
    preferred_language: Literal["en", "ta"] = "en"

    @field_validator("email")
    @classmethod
    def normalized_email(cls, value: str) -> str:
        return value.casefold()


class LoginInput(WriteModel):
    email: EmailStr
    password: Password = Field(min_length=1, max_length=128)
    device_name: Label | None = Field(default=None, max_length=100)


class RefreshInput(WriteModel):
    refresh_token: SecretStr = Field(min_length=32, max_length=256)


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: Literal["bearer"] = "bearer"
    expires_in: int = 600


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    email: str | None
    role: Literal["customer", "vendor", "admin"]
    status: str
    display_name: str
    preferred_language: str
    created_at: datetime
    email_verified_at: datetime | None
