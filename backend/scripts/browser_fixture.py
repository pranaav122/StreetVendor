"""Manage privileged fixtures only inside the guarded browser-test database.

The test runner captures operator credentials in memory. Rate-counter reset is
only for sequential, independent UI cases; never use either action on a real database.
"""

import argparse
import json
import os
from pathlib import Path
import re
import secrets
from uuid import uuid4

from sqlalchemy.orm import Session
from sqlalchemy import delete

from app.auth.schemas import RegisterInput
from app.auth.service import register_user
from app.config import Settings
from app.database import create_db_engine
from app.models.accounts import RateLimitBucket


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "operation",
        nargs="?",
        choices=["operator", "reset-rate-limits"],
        default="operator",
    )
    args = parser.parse_args()
    database = os.environ.get("BROWSER_FIXTURE_DB", "")
    if not re.fullmatch(r"msv_ui_[0-9a-f]{32}", database):
        raise RuntimeError(
            "Use scripts/Test-Applications.ps1 for privileged browser fixtures."
        )
    root = Path(__file__).resolve().parents[2]
    settings = Settings(_env_file=root / ".env").model_copy(
        update={"postgres_db": database}
    )
    engine = create_db_engine(settings)
    try:
        if args.operation == "reset-rate-limits":
            # Sequential UI cases are independent clients sharing one loopback IP.
            # Reset only this guarded disposable database, never application limits.
            with engine.begin() as connection:
                connection.execute(delete(RateLimitBucket))
            return
        email, password = (
            f"browser-operator-{uuid4().hex}@example.com",
            secrets.token_urlsafe(32),
        )
        with Session(engine) as session:
            register_user(
                session,
                RegisterInput(
                    email=email, password=password, display_name="Synthetic operator"
                ),
                "admin",
            )
        print(json.dumps({"email": email, "password": password}))
    finally:
        engine.dispose()


if __name__ == "__main__":
    main()
