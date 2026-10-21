import os
import re
from collections.abc import Iterator
from dataclasses import dataclass
from pathlib import Path
from unittest.mock import Mock, create_autospec
from uuid import uuid4

import pytest
from alembic.config import Config
from fastapi import FastAPI
from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import Session

from app.config import Settings
from app.database import create_db_engine, get_db
from app.main import create_app


@pytest.fixture
def settings() -> Settings:
    return Settings(
        _env_file=None,
        postgres_db="unit_test",
        postgres_user="unit_test",
        postgres_password="unit-test-password",
        postgres_host="127.0.0.1",
        postgres_port=5432,
        db_connect_timeout_seconds=3,
    )


@pytest.fixture
def mock_session() -> Mock:
    return create_autospec(Session, instance=True)


@pytest.fixture
def health_app(settings: Settings, mock_session: Mock) -> Iterator[FastAPI]:
    application = create_app(settings)

    def override_get_db() -> Iterator[Mock]:
        yield mock_session

    application.dependency_overrides[get_db] = override_get_db
    yield application
    application.dependency_overrides.clear()


@dataclass(frozen=True)
class DatabaseSandbox:
    settings: Settings
    engine: Engine


@pytest.fixture
def database_sandbox() -> Iterator[DatabaseSandbox]:
    if os.environ.get("RUN_DB_TESTS") != "1":
        pytest.skip("Set RUN_DB_TESTS=1 to run isolated PostgreSQL/PostGIS tests.")

    development_settings = Settings()
    database_name = f"msv_test_{uuid4().hex}"
    assert re.fullmatch(r"msv_test_[0-9a-f]{32}", database_name)
    sandbox_settings = development_settings.model_copy(
        update={"postgres_db": database_name}
    )
    admin_engine = create_engine(
        development_settings.database_url.set(database="postgres"),
        isolation_level="AUTOCOMMIT",
        connect_args={
            "connect_timeout": development_settings.db_connect_timeout_seconds
        },
    )
    sandbox_engine = create_db_engine(sandbox_settings)
    database_created = False
    try:
        with admin_engine.connect() as connection:
            # Only a locally generated, validated identifier is interpolated here.
            connection.exec_driver_sql(
                f'CREATE DATABASE "{database_name}" TEMPLATE template0'
            )
            database_created = True
        yield DatabaseSandbox(sandbox_settings, sandbox_engine)
    finally:
        sandbox_engine.dispose()
        try:
            if database_created:
                assert re.fullmatch(r"msv_test_[0-9a-f]{32}", database_name)
                with admin_engine.connect() as connection:
                    connection.exec_driver_sql(f'DROP DATABASE "{database_name}"')
        finally:
            admin_engine.dispose()


@pytest.fixture
def alembic_config() -> Config:
    backend_directory = Path(__file__).resolve().parents[1]
    config = Config(str(backend_directory / "alembic.ini"))
    config.set_main_option("script_location", str(backend_directory / "migrations"))
    return config
