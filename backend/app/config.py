"""Read configuration from process variables or the root .env file."""

import json
from typing import Literal
from urllib.parse import urlsplit
from uuid import UUID

from pydantic import EmailStr, Field, SecretStr, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy.engine import URL


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", extra="ignore", hide_input_in_errors=True
    )

    postgres_db: str = Field(default="mystreetvendor", min_length=1)
    postgres_user: str = Field(default="mystreetvendor", min_length=1)
    postgres_password: SecretStr = Field(min_length=1)
    postgres_host: str = Field(default="127.0.0.1", min_length=1)
    postgres_port: int = Field(default=5432, ge=1, le=65535)
    db_connect_timeout_seconds: int = Field(default=3, ge=1, le=30)
    # DB/migration tools still work without an auth key; auth itself fails closed.
    jwt_secret: SecretStr | None = Field(default=None, min_length=32)
    jwt_issuer: str = "mystreetvendor"
    jwt_audience: str = "mystreetvendor-apps"
    auth_login_limit: int = Field(default=5, ge=1, le=100)
    auth_register_limit: int = Field(default=10, ge=1, le=100)
    auth_recent_seconds: int = Field(default=300, ge=1, le=600)
    vendor_active_request_limit: int = Field(default=100, ge=1, le=100)
    max_devices_per_user: int = Field(default=10, ge=1, le=20)
    expo_access_token: SecretStr | None = None
    expo_customer_project_id: UUID | None = None
    expo_vendor_project_id: UUID | None = None
    ws_auth_timeout_seconds: float = Field(default=5, ge=0.05, le=5)
    ws_idle_timeout_seconds: float = Field(default=60, ge=1, le=60)
    ws_max_connections: int = Field(default=100, ge=1, le=100)
    ws_max_per_ip: int = Field(default=10, ge=1, le=100)
    ws_max_per_user: int = Field(default=3, ge=1, le=5)
    allowed_origins: list[str] = Field(
        default_factory=lambda: [
            "http://127.0.0.1:8081",
            "http://localhost:8081",
            "http://127.0.0.1:8082",
            "http://localhost:8082",
            "http://127.0.0.1:3000",
            "http://localhost:3000",
        ]
    )
    environment: Literal["development", "test", "production"] = "development"
    api_workers: int = Field(default=1, ge=1)
    jobs_enabled: bool = False
    smtp_host: str | None = None
    smtp_port: int = Field(default=587, ge=1, le=65535)
    smtp_from: EmailStr | None = None
    smtp_username: str | None = None
    smtp_password: SecretStr | None = None
    smtp_ssl: bool = False
    smtp_starttls: bool = True
    public_customer_url: str = "http://127.0.0.1:8081"
    public_vendor_url: str = "http://127.0.0.1:8082"
    service_area_geojson: str | None = Field(default=None, max_length=65536)

    @field_validator(
        "expo_customer_project_id", "expo_vendor_project_id", mode="before"
    )
    @classmethod
    def optional_project_id(cls, value):
        # Compose passes an empty string for optional, unset provider settings.
        return None if value == "" else value

    @model_validator(mode="after")
    def production_configuration(self):
        if self.environment != "production":
            return self
        key = self.jwt_secret.get_secret_value() if self.jwt_secret else ""
        # Refuse obvious placeholders; operators must still generate random keys.
        if (
            len(key) < 64
            or len(set(key)) < 16
            or key == self.postgres_password.get_secret_value()
        ):
            raise ValueError(
                "Production requires an independent random signing key of at least 64 characters."
            )
        if self.api_workers != 1 or self.postgres_user != "msv_runtime":
            raise ValueError(
                "Production requires one API worker and the restricted msv_runtime database role."
            )
        if not self.service_area_geojson:
            raise ValueError("Production requires an approved service-area polygon.")
        if not self.allowed_origins:
            raise ValueError("Production requires explicit browser origins.")
        for value in [
            *self.allowed_origins,
            self.public_customer_url,
            self.public_vendor_url,
        ]:
            parsed = urlsplit(value)
            if (
                parsed.scheme != "https"
                or not parsed.hostname
                or parsed.username
                or parsed.password
                or parsed.query
                or parsed.fragment
                or parsed.path not in ("", "/")
            ):
                raise ValueError(
                    "Production public URLs and browser origins must be explicit HTTPS origins."
                )
        if (
            not self.smtp_host
            or not self.smtp_from
            or not (self.smtp_ssl or self.smtp_starttls)
            or bool(self.smtp_username) != bool(self.smtp_password)
        ):
            raise ValueError(
                "Production requires configured TLS mail transport with complete credentials."
            )
        return self

    @field_validator("service_area_geojson")
    @classmethod
    def polygon_configuration(cls, value):
        if value is None:
            return value
        try:
            data = json.loads(value)
            json.dumps(data, allow_nan=False)
            if (
                not isinstance(data, dict)
                or data.get("type") not in ("Polygon", "MultiPolygon")
                or not data.get("coordinates")
            ):
                raise ValueError("Expected polygon coordinates")
        except (ValueError, TypeError):
            raise ValueError(
                "Provide finite GeoJSON Polygon or MultiPolygon geometry."
            ) from None
        return value

    @property
    def database_url(self) -> URL:
        return URL.create(
            drivername="postgresql+psycopg",
            username=self.postgres_user,
            password=self.postgres_password.get_secret_value(),
            host=self.postgres_host,
            port=self.postgres_port,
            database=self.postgres_db,
        )
