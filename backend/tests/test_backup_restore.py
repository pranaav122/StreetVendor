"""Guardrails for operator scripts; container checks use the local development DB."""

import os
import shutil
import subprocess
from pathlib import Path
from uuid import uuid4

import pytest

ROOT = Path(__file__).resolve().parents[2]
# These checks drive Windows operator scripts and the host Docker CLI. The API
# image deliberately contains neither PowerShell nor host infrastructure files.
pytestmark = pytest.mark.skipif(
    os.name != "nt", reason="Run Windows operator-script checks on the Windows host."
)


def test_restore_refuses_missing_backup_before_contacting_docker(tmp_path):
    result = subprocess.run(
        [
            shutil.which("pwsh") or "pwsh",
            "-NoProfile",
            "-File",
            str(ROOT / "infrastructure/scripts/Test-Restore.ps1"),
            "-BackupPath",
            str(tmp_path / "missing.dump"),
        ],
        capture_output=True,
        text=True,
        check=False,
        timeout=20,
    )
    assert result.returncode != 0
    assert "Backup file does not exist" in result.stdout + result.stderr


def container(*args, source=None):
    if os.environ.get("RUN_CONTAINER_TESTS") != "1":
        pytest.skip("Set RUN_CONTAINER_TESTS=1 for real backup guard checks.")
    docker = shutil.which("docker")
    assert docker, "Docker must be on PATH."
    result = subprocess.run(
        [
            docker,
            "compose",
            "--env-file",
            str(ROOT / ".env"),
            "-f",
            str(ROOT / "infrastructure/compose.yaml"),
            "exec",
            "-T",
            "db",
            *args,
        ],
        input=source.encode("utf-8") if source is not None else None,
        capture_output=True,
        check=False,
        timeout=30,
    )
    # Python text mode changes LF to CRLF on Windows; shell input must stay LF.
    return subprocess.CompletedProcess(
        result.args, result.returncode, result.stdout.decode(), result.stderr.decode()
    )


@pytest.mark.parametrize(
    "target",
    ["mystreetvendor", "postgres", "msv_restore_not_hex", "msv_restore_" + "a" * 31],
)
def test_restore_rejects_unsafe_target_before_database_commands(target):
    source = (ROOT / "infrastructure/scripts/restore-check.sh").read_text()
    result = container("sh", "-s", "--", target, "/tmp/absent.dump", source=source)
    assert result.returncode != 0
    assert "Unsafe restore target" in result.stderr


def test_invalid_dump_does_not_create_restore_database():
    source = (ROOT / "infrastructure/scripts/restore-check.sh").read_text()
    target = "msv_restore_" + uuid4().hex
    remote = "/tmp/" + target + ".dump"
    result = container(
        "sh", "-c", 'printf %s synthetic-invalid-dump > "$1"', "sh", remote
    )
    assert result.returncode == 0
    try:
        result = container("sh", "-s", "--", target, remote, source=source)
        assert result.returncode != 0
        probe = container(
            "sh",
            "-c",
            'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc "$1"',
            "sh",
            f"SELECT count(*) FROM pg_database WHERE datname='{target}'",
        )
        assert probe.returncode == 0 and probe.stdout.strip() == "0"
    finally:
        container("rm", "-f", "--", remote)


def test_failed_schema_validation_still_removes_isolated_restore():
    source = (ROOT / "infrastructure/scripts/restore-check.sh").read_text()
    target = "msv_restore_" + uuid4().hex
    remote = "/tmp/" + target + ".dump"
    # A real PostgreSQL dump without application tables restores successfully,
    # then must fail our schema query and clean up only its new target.
    dump = container(
        "sh",
        "-c",
        'pg_dump -U "$POSTGRES_USER" -d postgres -Fc --no-owner --no-acl -f "$1"',
        "sh",
        remote,
    )
    assert dump.returncode == 0
    try:
        result = container("sh", "-s", "--", target, remote, source=source)
        assert result.returncode != 0
        assert "alembic_version" in result.stderr
        probe = container(
            "sh",
            "-c",
            'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc "$1"',
            "sh",
            f"SELECT count(*) FROM pg_database WHERE datname='{target}'",
        )
        assert probe.returncode == 0 and probe.stdout.strip() == "0"
    finally:
        container("rm", "-f", "--", remote)
