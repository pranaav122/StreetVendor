from fastapi.testclient import TestClient

from app.main import create_app


def test_browser_app_can_preflight_authenticated_json_writes(settings):
    with TestClient(create_app(settings)) as client:
        response = client.options(
            "/api/v1/requests",
            headers={
                "Origin": "http://127.0.0.1:8081",
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "authorization,content-type,idempotency-key",
            },
        )
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://127.0.0.1:8081"
    assert "access-control-allow-credentials" not in response.headers


def test_unlisted_browser_origin_cannot_read_api_responses(settings):
    with TestClient(create_app(settings)) as client:
        response = client.options(
            "/api/v1/requests",
            headers={
                "Origin": "https://untrusted.example",
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "authorization",
            },
        )
    assert response.status_code == 400
    assert "access-control-allow-origin" not in response.headers
