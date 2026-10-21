from unittest.mock import Mock

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy.exc import OperationalError, ProgrammingError


def test_health_reports_database_and_postgis_ready(
    health_app: FastAPI, mock_session: Mock
) -> None:
    with TestClient(health_app) as client:
        response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "database": "ok",
        "postgis": "ok",
    }
    assert mock_session.execute.call_count == 2


def test_health_reports_database_failure_without_leaking_details(
    health_app: FastAPI,
    mock_session: Mock,
    caplog: pytest.LogCaptureFixture,
) -> None:
    private_detail = "private-password-and-connection-details"
    mock_session.execute.side_effect = OperationalError(
        "SELECT 1", {}, Exception(private_detail)
    )

    with TestClient(health_app) as client:
        response = client.get("/health")

    assert response.status_code == 503
    assert response.json() == {
        "status": "error",
        "database": "unavailable",
        "postgis": "unknown",
    }
    assert mock_session.execute.call_count == 1
    assert private_detail not in response.text
    assert private_detail not in caplog.text


def test_health_distinguishes_missing_postgis_without_leaking_details(
    health_app: FastAPI,
    mock_session: Mock,
    caplog: pytest.LogCaptureFixture,
) -> None:
    private_detail = "private-postgis-query-details"
    mock_session.execute.side_effect = [
        Mock(),
        ProgrammingError("SELECT PostGIS_Full_Version()", {}, Exception(private_detail)),
    ]

    with TestClient(health_app) as client:
        response = client.get("/health")

    assert response.status_code == 503
    assert response.json() == {
        "status": "error",
        "database": "ok",
        "postgis": "unavailable",
    }
    assert private_detail not in response.text
    assert private_detail not in caplog.text
