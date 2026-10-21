import pytest
from pydantic import ValidationError

from app.config import Settings


def test_database_url_handles_password_characters() -> None:
    password = "special@:/%$password"
    settings = Settings(
        _env_file=None,
        postgres_db="sample_db",
        postgres_user="sample_user",
        postgres_password=password,
        postgres_host="127.0.0.1",
        postgres_port=5432,
    )

    assert settings.database_url.drivername == "postgresql+psycopg"
    assert settings.database_url.password == password
    assert settings.database_url.database == "sample_db"
    assert password not in str(settings.database_url)
    assert password not in repr(settings)


def test_missing_password_fails_without_connecting(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("POSTGRES_PASSWORD", raising=False)

    with pytest.raises(ValidationError, match="postgres_password"):
        Settings(
            _env_file=None,
            postgres_db="sample_db",
            postgres_user="sample_user",
        )


def test_empty_password_is_rejected() -> None:
    with pytest.raises(ValidationError, match="postgres_password"):
        Settings(
            _env_file=None,
            postgres_db="sample_db",
            postgres_user="sample_user",
            postgres_password="",
        )


def test_settings_read_environment_variables(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("POSTGRES_DB", "environment_db")
    monkeypatch.setenv("POSTGRES_USER", "environment_user")
    monkeypatch.setenv("POSTGRES_PASSWORD", "environment-password")
    monkeypatch.setenv("POSTGRES_HOST", "db")
    monkeypatch.setenv("POSTGRES_PORT", "5439")
    monkeypatch.setenv("DB_CONNECT_TIMEOUT_SECONDS", "5")

    settings = Settings(_env_file=None)

    assert settings.database_url.host == "db"
    assert settings.database_url.port == 5439
    assert settings.database_url.username == "environment_user"
    assert settings.database_url.database == "environment_db"
    assert settings.postgres_password.get_secret_value() == "environment-password"
    assert settings.db_connect_timeout_seconds == 5
