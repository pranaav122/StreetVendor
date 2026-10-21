import pytest
from alembic import command
from alembic.config import Config
from alembic.migration import MigrationContext
from alembic.script import ScriptDirectory
from fastapi.testclient import TestClient
from sqlalchemy import text

from app.main import create_app
from conftest import DatabaseSandbox

pytestmark = pytest.mark.integration


def test_clean_database_migrates_to_head_and_repeated_upgrade_is_safe(
    database_sandbox: DatabaseSandbox, alembic_config: Config
) -> None:
    with database_sandbox.engine.begin() as connection:
        assert connection.scalar(
            text("SELECT count(*) FROM pg_extension WHERE extname = 'postgis'")
        ) == 0
        alembic_config.attributes["connection"] = connection

        command.upgrade(alembic_config, "head")
        expected_head = ScriptDirectory.from_config(alembic_config).get_current_head()
        assert expected_head is not None
        assert MigrationContext.configure(connection).get_current_revision() == expected_head
        assert "POSTGIS" in connection.scalar(text("SELECT PostGIS_Full_Version()"))

        command.upgrade(alembic_config, "head")
        assert MigrationContext.configure(connection).get_current_revision() == expected_head


def test_postgis_uses_metres_and_health_queries_real_database(
    database_sandbox: DatabaseSandbox, alembic_config: Config
) -> None:
    with TestClient(create_app(database_sandbox.settings)) as client:
        response = client.get("/health")

    assert response.status_code == 503
    assert response.json() == {
        "status": "error",
        "database": "ok",
        "postgis": "unavailable",
    }

    with database_sandbox.engine.begin() as connection:
        alembic_config.attributes["connection"] = connection
        command.upgrade(alembic_config, "head")
        result = connection.execute(
            text(
                """
                WITH points AS (
                    SELECT ST_SetSRID(ST_MakePoint(80.2707, 13.0827), 4326)::geography AS a,
                           ST_SetSRID(ST_MakePoint(80.2717, 13.0827), 4326)::geography AS b
                )
                SELECT ST_Distance(a, b) AS distance_m,
                       ST_DWithin(a, b, 100) AS within_100_m,
                       ST_DWithin(a, b, 200) AS within_200_m
                FROM points
                """
            )
        ).one()

    assert 100 < result.distance_m < 120
    assert result.within_100_m is False
    assert result.within_200_m is True

    with TestClient(create_app(database_sandbox.settings)) as client:
        response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "database": "ok",
        "postgis": "ok",
    }


def test_baseline_downgrade_preserves_postgis_and_schema_check_is_clean(
    database_sandbox: DatabaseSandbox, alembic_config: Config
) -> None:
    with database_sandbox.engine.begin() as connection:
        alembic_config.attributes["connection"] = connection
        command.upgrade(alembic_config, "head")

        command.downgrade(alembic_config, "base")
        assert MigrationContext.configure(connection).get_current_revision() is None
        assert connection.scalar(
            text("SELECT count(*) FROM pg_extension WHERE extname = 'postgis'")
        ) == 1

        command.upgrade(alembic_config, "head")
        connection.execute(text("CREATE SCHEMA tiger"))
        connection.execute(text("CREATE TABLE tiger.migration_guard_probe (id integer)"))
        connection.execute(text("SET LOCAL search_path TO public, tiger"))
        command.check(alembic_config)
        assert connection.scalar(
            text("SELECT to_regclass('tiger.migration_guard_probe')")
        ) is not None
        expected_head = ScriptDirectory.from_config(alembic_config).get_current_head()
        assert MigrationContext.configure(connection).get_current_revision() == expected_head
