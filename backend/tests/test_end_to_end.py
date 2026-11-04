"""A complete synthetic visit through HTTP handlers and a disposable real database."""

import json
import os
import shutil
import subprocess
from datetime import timedelta
from pathlib import Path

import pytest
from app.auth.security import utcnow
from test_arrival import send_fix
from test_auth import api, bearer, login, register
from test_devices import register_device
from test_locations import ready_vendor
from test_outbox import RecordingProvider, dispatch
from test_vendors import categories, customer_headers, operator, vendor
from test_visits import action, create_request

pytestmark = pytest.mark.integration


def test_customer_partner_visit_with_isolation_and_notification(
    api, vendor, ready_vendor, monkeypatch
):
    # Fixtures register both roles, create the catalogue and approve the vendor
    # through the real staff HTTP endpoint before sharing the first usable fix.
    customer = customer_headers(api)
    register(api, email="outsider@example.com")
    outsider = bearer(login(api, "outsider@example.com").json())
    assert register_device(api, vendor, kind="vendor")[0].status_code == 200

    discovery = api.get(
        "/api/v1/vendors/nearby",
        headers=customer,
        params={"latitude": 13.0827, "longitude": 80.2707, "radius_m": 1500},
    )
    assert discovery.status_code == 200
    found = discovery.json()["items"][0]
    assert found["vendor_id"] == ready_vendor[0]["id"]
    assert "accuracy_m" not in found

    created = create_request(api, customer, found["vendor_id"])
    assert created.status_code == 201
    visit = created.json()
    path = f"/api/v1/requests/{visit['id']}"
    assert api.get(path, headers=outsider).status_code == 404

    assert api.get(path + "/vendor-location", headers=customer).status_code == 409
    provider = RecordingProvider()
    assert dispatch(api, provider).accepted == 1
    assert set(provider.messages[0]["data"]) == {
        "notification_id",
        "request_id",
        "event_type",
    }

    accepted = action(api, visit, vendor, "accept")
    assert accepted.status_code == 200
    assert api.get(path + "/vendor-location", headers=customer).status_code == 200
    assert api.get(path + "/vendor-location", headers=outsider).status_code == 404

    # Advance both capture and server clocks rather than sleeping or pretending
    # two back-to-back uploads prove five seconds of presence at the meeting point.
    clock = utcnow()
    assert send_fix(api, vendor, clock, monkeypatch).status_code == 200
    assert (
        send_fix(api, vendor, clock + timedelta(seconds=6), monkeypatch).status_code
        == 200
    )
    arrived = api.get(path, headers=customer).json()
    assert arrived["status"] == "ARRIVED"
    completed = action(api, arrived, vendor, "complete")
    assert completed.status_code == 200
    assert completed.json()["status"] == "COMPLETED"
    assert api.get(path + "/vendor-location", headers=customer).status_code == 409
    assert api.get(path, headers=outsider).status_code == 404


def test_binary_backup_restores_real_business_and_visit_rows(
    api, ready_vendor, database_sandbox, tmp_path
):
    if os.name != "nt" or os.environ.get("RUN_CONTAINER_TESTS") != "1":
        pytest.skip(
            "Set RUN_CONTAINER_TESTS=1 on Windows for PowerShell binary backup/restore."
        )
    customer = customer_headers(api)
    assert create_request(api, customer, ready_vendor[0]["id"]).status_code == 201
    root = Path(__file__).resolve().parents[2]
    scripts = root / "infrastructure/scripts"
    backup = subprocess.run(
        [
            shutil.which("pwsh"),
            "-NoProfile",
            "-File",
            str(scripts / "Backup-Database.ps1"),
            "-DatabaseName",
            database_sandbox.settings.postgres_db,
            "-OutputDirectory",
            str(tmp_path),
            "-AsJson",
        ],
        capture_output=True,
        text=True,
        check=False,
        timeout=90,
    )
    assert backup.returncode == 0, backup.stderr
    saved = json.loads(backup.stdout)
    assert Path(saved["Path"]).read_bytes()[:5] == b"PGDMP"
    restored = subprocess.run(
        [
            shutil.which("pwsh"),
            "-NoProfile",
            "-File",
            str(scripts / "Test-Restore.ps1"),
            "-BackupPath",
            saved["Path"],
            "-AsJson",
        ],
        capture_output=True,
        text=True,
        check=False,
        timeout=90,
    )
    assert restored.returncode == 0, restored.stderr
    row = json.loads(restored.stdout)
    assert row["postgis"] == "ok" and row["revision"] == "0006_notifications"
    assert (
        row["users"] >= 3
        and row["vendors"] == 1
        and row["visits"] == 1
        and row["categories"] == 4
    )
    from sqlalchemy import text

    with database_sandbox.engine.connect() as connection:
        assert (
            connection.scalar(
                text("SELECT count(*) FROM pg_database WHERE datname=:target"),
                {"target": row["isolated_target_removed"]},
            )
            == 0
        )
