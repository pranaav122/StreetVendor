"""Read configuration from process variables or the root .env file."""

from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy.engine import URL
from typing import Literal


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
    environment: Literal["development", "test", "production"] = "development"
    jobs_enabled: bool = False

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
