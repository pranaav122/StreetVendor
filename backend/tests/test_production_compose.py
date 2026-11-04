"""Inspect Docker's resolved model without writing or printing test secrets."""

import json
import ipaddress
import os
import secrets
import shutil
import subprocess
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]


def compose(tmp_path, configured=True):
    if os.environ.get("RUN_CONTAINER_TESTS") != "1":
        pytest.skip("Set RUN_CONTAINER_TESTS=1 for real Docker configuration checks.")
    docker = shutil.which("docker")
    assert docker, "Docker CLI must be on PATH for container checks."
    empty = tmp_path / "empty.env"
    empty.write_text("", encoding="utf-8")
    variables = {
        "POSTGRES_DB": "mystreetvendor",
        "BOOTSTRAP_PASSWORD": secrets.token_urlsafe(48),
        "MIGRATION_PASSWORD": secrets.token_urlsafe(48),
        "RUNTIME_PASSWORD": secrets.token_urlsafe(48),
        "JWT_SECRET": secrets.token_urlsafe(64),
        "API_DOMAIN": "api.example.com",
        "ADMIN_DOMAIN": "admin.example.com",
        "PUBLIC_CUSTOMER_URL": "https://customer.example.com",
        "PUBLIC_VENDOR_URL": "https://partner.example.com",
        "SERVICE_AREA_GEOJSON": '{"type":"Polygon","coordinates":[[[80.15,13],[80.35,13],[80.35,13.2],[80.15,13.2],[80.15,13]]]}',
        "SMTP_HOST": "smtp.example.com",
        "SMTP_FROM": "noreply@example.com",
    }
    env = dict(os.environ)
    for key in variables:
        env.pop(key, None)
    if configured:
        env.update(variables)
    return subprocess.run(
        [
            docker,
            "compose",
            "--env-file",
            str(empty),
            "-f",
            str(ROOT / "infrastructure/compose.production.yaml"),
            "--profile",
            "tools",
            "config",
            "--format",
            "json",
        ],
        env=env,
        check=False,
        capture_output=True,
        text=True,
        timeout=30,
    )


def test_production_model_keeps_database_and_apps_private(tmp_path):
    result = compose(tmp_path)
    assert result.returncode == 0, (
        "Production Compose must resolve with complete test settings."
    )
    model = json.loads(result.stdout)
    services = model["services"]
    for name in ("db", "api", "admin", "migrate"):
        assert not services[name].get("ports"), f"{name} must have no host port."
    assert model["networks"]["database"]["internal"] is True
    assert services["api"]["environment"]["POSTGRES_USER"] == "msv_runtime"
    assert "BOOTSTRAP_PASSWORD" not in services["api"]["environment"]
    assert "MIGRATION_PASSWORD" not in services["api"]["environment"]
    command = services["api"]["command"]
    assert command[command.index("--workers") + 1] == "1"
    assert "--no-access-log" in command
    assert services["api"]["build"]["target"] == "production"
    assert {row["target"] for row in services["caddy"]["ports"]} == {80, 443}
    assert services["migrate"]["profiles"] == ["tools"]


def test_only_reserved_proxy_addresses_are_trusted_and_dynamic_ips_cannot_collide(tmp_path):
    result = compose(tmp_path)
    assert result.returncode == 0
    model = json.loads(result.stdout)
    services = model["services"]
    caddy = services["caddy"]["networks"]["edge"]["ipv4_address"]
    admin = (services["admin"]["networks"]["edge"] or {}).get("ipv4_address")
    assert admin is not None, "The admin proxy must have a reserved trusted address."
    assert caddy != admin
    command = services["api"]["command"]
    assert set(command[command.index("--forwarded-allow-ips") + 1].split(",")) == {caddy, admin}
    pool = ipaddress.ip_network(model["networks"]["edge"]["ipam"]["config"][0]["ip_range"])
    assert ipaddress.ip_address(caddy) not in pool
    assert ipaddress.ip_address(admin) not in pool


def test_production_model_refuses_missing_owner_settings(tmp_path):
    result = compose(tmp_path, configured=False)
    assert result.returncode != 0
    assert "required variable" in result.stderr.lower()
