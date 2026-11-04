"""Run inside the API image against a generated production-check database only."""

import importlib.util
import json
import os
import re
import secrets
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, urlopen

from app.auth.schemas import RegisterInput
from app.auth.service import register_user
from app.config import Settings
from app.database import create_db_engine
from app.vendors.service import seed_categories
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError
from sqlalchemy.orm import Session


def http(
    path, payload=None, *, headers=None, method=None, origin="http://127.0.0.1:8000"
):
    request = Request(
        origin + path,
        data=json.dumps(payload).encode() if payload is not None else None,
        headers={"Content-Type": "application/json", **(headers or {})},
        method=method,
    )
    try:
        response = urlopen(request, timeout=20)
    except HTTPError as error:
        response = error
    with response:
        raw = response.read()
        return response.status, json.loads(raw) if raw else None, response.headers


def main():
    # This probe creates synthetic users. Never run it against a pilot database.
    if os.environ.get("MSV_PRODUCTION_CHECK") != "1" or not re.fullmatch(
        r"msv_prod_check_[0-9a-f]{12}", os.environ.get("POSTGRES_DB", "")
    ):
        raise RuntimeError("Only a generated production-check database is allowed.")
    settings = Settings()
    assert settings.environment == "production"
    assert importlib.util.find_spec("pytest") is None
    assert importlib.util.find_spec("httpx2") is None
    engine = create_db_engine(settings)
    try:
        with engine.connect() as connection:
            assert connection.scalar(text("SELECT current_user")) == "msv_runtime"
            assert not connection.scalar(
                text("SELECT pg_has_role(current_user,'msv_migrator','MEMBER')")
            )
            assert "POSTGIS" in connection.scalar(text("SELECT PostGIS_Full_Version()"))
            revision = connection.scalar(
                text("SELECT version_num FROM alembic_version")
            )
        denied = [
            "CREATE TABLE public.must_be_denied (id integer)",
            "ALTER TABLE public.users ADD COLUMN must_be_denied integer",
            "CREATE ROLE must_be_denied",
            "CREATE TEMP TABLE must_be_denied (id integer)",
            "UPDATE public.spatial_ref_sys SET auth_name=auth_name WHERE false",
            "UPDATE public.alembic_version SET version_num=version_num WHERE false",
        ]
        for sql in denied:
            try:
                with engine.begin() as connection:
                    connection.execute(text(sql))
                    # Roll back even if a broken grant lets this probe succeed.
                    raise AssertionError(
                        "Restricted runtime unexpectedly permitted privileged SQL."
                    )
            except DBAPIError as error:
                assert error.orig.sqlstate == "42501"
        with Session(engine) as session:
            seed_categories(session)
            password = secrets.token_urlsafe(32)
            register_user(
                session,
                RegisterInput(
                    email="operator@example.com",
                    password=password,
                    display_name="Synthetic operator",
                ),
                "admin",
            )
        assert http("/health")[0] == 200
        assert http("/health?private_marker=must-not-be-logged")[0] == 200
        payload = {
            "email": "customer@example.com",
            "password": secrets.token_urlsafe(32),
            "display_name": "Synthetic customer",
        }
        assert http("/api/v1/auth/register/customer", payload)[0] == 201
        code, tokens, _ = http(
            "/api/v1/auth/login",
            {"email": payload["email"], "password": payload["password"]},
        )
        assert code == 200
        auth = {"Authorization": "Bearer " + tokens["access_token"]}
        code, user, _ = http("/api/v1/users/me", headers=auth)
        assert code == 200 and user["role"] == "customer"
        assert http("/api/v1/admin/summary", headers=auth)[0] == 403
        staff_origin = "https://admin.example.invalid"
        staff_login = {"email": "operator@example.com", "password": password}
        # Private protocol probes explicitly supply an ingress identity. Node is
        # unpublished; real requests receive this header only from Caddy.
        blocked_ip = "198.51.100.10"
        for attempt in range(31):
            code, _, _ = http(
                "/api/session",
                {"email": f"invalid-{attempt}@example.com", "password": "invalid"},
                origin="http://admin:3000",
                headers={"Origin": staff_origin, "X-Msv-Client-IP": blocked_ip},
            )
            assert code == (401 if attempt < 30 else 429), (attempt, code)
        assert http(
            "/api/session", staff_login, origin="http://admin:3000",
            headers={"Origin": staff_origin, "X-Msv-Client-IP": blocked_ip},
        )[0] == 429
        assert http(
            "/api/session", staff_login, origin="http://admin:3000",
            headers={"Origin": staff_origin, "X-Forwarded-For": "198.51.100.20"},
        )[0] == 503
        code, body, headers = http(
            "/api/session",
            staff_login,
            origin="http://admin:3000",
            headers={"Origin": staff_origin, "X-Msv-Client-IP": "198.51.100.20"},
        )
        assert code == 200 and body["user"]["role"] == "admin"
        # The actual Caddyfile must override both forged public identity headers.
        # If it accepted blocked_ip, this login would inherit its exhausted bucket.
        assert http("/health", origin="http://caddy", headers={"Host": "api.example.invalid"})[0] == 200
        assert http(
            "/api/session", staff_login, origin="http://caddy",
            headers={"Host": "admin.example.invalid", "Origin": staff_origin,
                     "X-Msv-Client-IP": blocked_ip, "X-Forwarded-For": blocked_ip},
        )[0] == 200
        cookie = headers["Set-Cookie"]
        for flag in (
            "__Host-msv_admin=",
            "HttpOnly",
            "Secure",
            "SameSite=Strict",
            "Path=/",
        ):
            assert flag in cookie
        assert "access_token" not in json.dumps(
            body
        ) and "refresh_token" not in json.dumps(body)
        assert (
            http(
                "/api/backend/admin/summary",
                origin="http://admin:3000",
                headers={"Cookie": cookie.split(";", 1)[0]},
            )[0]
            == 200
        )
        # Retain only this synthetic opaque cookie for the subsequent restart
        # check, in private ephemeral container storage; never print it.
        cookie_file = Path("/tmp/msv-check-cookie")
        cookie_file.touch(mode=0o600)
        cookie_file.write_text(cookie.split(";", 1)[0], encoding="utf-8")
        print(
            json.dumps(
                {
                    "health": "ok",
                    "revision": revision,
                    "denied_privileged_operations": len(denied),
                    "runtime_registration_login": "ok",
                    "standalone_admin_secure_session": "ok",
                    "admin_client_limit_isolation": "ok",
                    "caddy_identity_header_override": "ok",
                    "production_test_dependencies": "absent",
                }
            )
        )
    finally:
        engine.dispose()


if __name__ == "__main__":
    main()
