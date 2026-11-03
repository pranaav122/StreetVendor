"""Run real browser/API checks in a disposable PostgreSQL database."""

import os
from pathlib import Path
import re
import secrets
import shutil
import socket
import subprocess
import sys
import time
from urllib.error import URLError
from urllib.request import urlopen
from uuid import uuid4

from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.config import Settings
from app.database import create_db_engine
from app.vendors.service import seed_categories

ROOT = Path(__file__).resolve().parents[2]


def main():
    settings = Settings(_env_file=ROOT / ".env")
    name = "msv_ui_" + uuid4().hex
    sandbox = settings.model_copy(update={"postgres_db": name})
    admin = create_engine(
        settings.database_url.set(database="postgres"),
        isolation_level="AUTOCOMMIT",
        hide_parameters=True,
    )
    engine = create_db_engine(sandbox)
    workspace = ROOT / ".superpowers" / "sdd" / "2026-11-02-applications"
    workspace.mkdir(parents=True, exist_ok=True)
    server = None
    created = False
    # Refuse a busy port instead of accidentally testing an unrelated server.
    with socket.socket() as probe:
        probe.bind(("127.0.0.1", 8001))
    try:
        with admin.connect() as connection:
            connection.exec_driver_sql(f'CREATE DATABASE "{name}" TEMPLATE template0')
            created = True
        config = Config(str(ROOT / "backend" / "alembic.ini"))
        with engine.begin() as connection:
            config.attributes["connection"] = connection
            command.upgrade(config, "head")
        with Session(engine) as session:
            seed_categories(session)
        engine.dispose()
        api_env = dict(os.environ)
        api_env.update(
            POSTGRES_DB=name,
            POSTGRES_USER=settings.postgres_user,
            POSTGRES_PASSWORD=settings.postgres_password.get_secret_value(),
            POSTGRES_HOST=settings.postgres_host,
            POSTGRES_PORT=str(settings.postgres_port),
            JWT_SECRET=secrets.token_urlsafe(64),
            JOBS_ENABLED="true",
            ENVIRONMENT="development",
            EXPO_ACCESS_TOKEN="",
            SMTP_HOST="127.0.0.1",
            SMTP_PORT="1025",
            SMTP_FROM="noreply@example.com",
            SMTP_STARTTLS="false",
            SMTP_SSL="false",
            PUBLIC_CUSTOMER_URL="http://127.0.0.1:8081",
            PUBLIC_VENDOR_URL="http://127.0.0.1:8082",
        )
        api_env.pop("SMTP_USERNAME", None)
        api_env.pop("SMTP_PASSWORD", None)
        with (workspace / "browser-api.log").open("w", encoding="utf-8") as log:
            server = subprocess.Popen(
                [
                    sys.executable,
                    "-m",
                    "uvicorn",
                    "app.main:create_app",
                    "--factory",
                    "--host",
                    "127.0.0.1",
                    "--port",
                    "8001",
                    "--workers",
                    "1",
                ],
                cwd=ROOT / "backend",
                env=api_env,
                stdout=log,
                stderr=log,
            )
            for _ in range(100):
                if server.poll() is not None:
                    raise RuntimeError(
                        "Test API stopped. Inspect the ignored browser-api.log."
                    )
                try:
                    with urlopen("http://127.0.0.1:8001/health", timeout=1) as response:
                        if response.status == 200:
                            break
                except (URLError, TimeoutError, OSError):
                    pass
                time.sleep(0.1)
            else:
                raise RuntimeError("Test API did not become ready.")
            test_env = dict(os.environ)
            # Frontend tools receive the database name, never the API's generated
            # signing secret or an extra copy of database credentials.
            test_env.update(
                TEST_API_URL="http://127.0.0.1:8001",
                BROWSER_FIXTURE_DB=name,
                BROWSER_PYTHON=sys.executable,
            )
            if os.name == "nt":
                runner = [
                    shutil.which("pwsh"),
                    "-NoProfile",
                    "-File",
                    str(ROOT / "scripts" / "Invoke-UiChecks.ps1"),
                    *sys.argv[1:],
                ]
            else:
                runner = [shutil.which("npm"), "run", "test:ui", "--", *sys.argv[1:]]
            print(
                "Running browser checks against an isolated local API/database.",
                flush=True,
            )
            return subprocess.run(
                runner, cwd=ROOT, env=test_env, check=False
            ).returncode
    finally:
        if server:
            server.terminate()
            try:
                server.wait(timeout=5)
            except subprocess.TimeoutExpired:
                server.kill()
                server.wait(timeout=5)
        engine.dispose()
        try:
            if created:
                # Only the generated database from this run may be terminated/dropped.
                assert re.fullmatch(r"msv_ui_[0-9a-f]{32}", name)
                with admin.connect() as connection:
                    connection.exec_driver_sql(
                        "SELECT pg_terminate_backend(pid) FROM pg_stat_activity "
                        "WHERE datname=%s AND pid<>pg_backend_pid()",
                        (name,),
                    )
                    connection.exec_driver_sql(f'DROP DATABASE "{name}"')
                print("Isolated browser database removed.", flush=True)
        finally:
            admin.dispose()


if __name__ == "__main__":
    sys.exit(main())
