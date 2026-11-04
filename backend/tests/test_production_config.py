import json
from uuid import UUID

import pytest
from app.config import Settings
from app.main import create_app
from fastapi.testclient import TestClient
from pydantic import ValidationError
from sqlalchemy.exc import OperationalError


def production(**changes):
    values = {
        "_env_file": None,
        "environment": "production",
        "postgres_user": "msv_runtime",
        "postgres_password": "isolated-runtime-password-for-unit-tests",
        "jwt_secret": "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_-",
        "service_area_geojson": '{"type":"Polygon","coordinates":[[[80.15,13],[80.35,13],[80.35,13.2],[80.15,13.2],[80.15,13]]]}',
        "allowed_origins": ["https://admin.example.com"],
        "public_customer_url": "https://customer.example.com",
        "public_vendor_url": "https://partner.example.com",
        "smtp_host": "smtp.example.com",
        "smtp_from": "noreply@example.com",
    }
    values.update(changes)
    return Settings(**values)


@pytest.mark.parametrize(
    "changes",
    [
        {"jwt_secret": None},
        {"jwt_secret": "short-but-thirty-two-characters!!"},
        {"jwt_secret": "x" * 64},
        {"service_area_geojson": None},
        {"allowed_origins": ["*"]},
        {"allowed_origins": ["http://admin.example.com"]},
        {"public_customer_url": "http://customer.example.com"},
        {"public_vendor_url": "https://partner.example.com/#secret"},
        {"smtp_host": None},
        {"smtp_ssl": False, "smtp_starttls": False},
        {"smtp_username": "operator", "smtp_password": None},
        {"api_workers": 2},
        {"postgres_user": "postgres"},
    ],
)
def test_production_refuses_incomplete_or_unsafe_configuration(changes):
    with pytest.raises(ValidationError):
        production(**changes)


def test_complete_production_configuration_can_be_constructed_without_network():
    assert production().environment == "production"


def test_request_id_is_server_generated_and_database_errors_are_safe(settings, caplog):
    caplog.set_level("INFO", logger="app.requests")
    app = create_app(settings)

    @app.get("/synthetic-database-failure")
    def failure():
        raise OperationalError("SELECT private_data", {}, Exception("private-password"))

    with TestClient(app) as client:
        response = client.get(
            "/synthetic-database-failure?token=private-token",
            headers={"X-Request-ID": "attacker-controlled"},
        )
    assert response.status_code == 503
    error = response.json()["error"]
    assert error["code"] == "DATABASE_UNAVAILABLE"
    assert str(UUID(error["request_id"])) == response.headers["X-Request-ID"]
    assert error["request_id"] != "attacker-controlled"
    assert "private-" not in response.text
    assert "private-" not in caplog.text
    records = [row for row in caplog.records if row.name == "app.requests"]
    assert records[-1].route == "/synthetic-database-failure"
    assert records[-1].status == 503


def test_json_logging_excludes_exception_text_and_query_values():
    import logging

    from app.observability import JsonFormatter

    record = logging.LogRecord(
        "app.requests", logging.INFO, __file__, 1, "request_complete", (), None
    )
    record.request_id = "synthetic-id"
    record.route = "/api/v1/vendors/nearby"
    record.status = 200
    result = json.loads(JsonFormatter().format(record))
    assert result["event"] == "request_complete"
    assert result["request_id"] == "synthetic-id"
    assert result["route"] == "/api/v1/vendors/nearby"
