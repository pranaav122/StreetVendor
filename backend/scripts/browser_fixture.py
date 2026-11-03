"""Create an operator only inside the guarded browser-test database.

The test runner captures stdout in memory; never run this to obtain a real operator.
"""

import json
import os
from pathlib import Path
import re
import secrets
from uuid import uuid4

from sqlalchemy.orm import Session

from app.auth.schemas import RegisterInput
from app.auth.service import register_user
from app.config import Settings
from app.database import create_db_engine


def main():
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
    email, password = (
        f"browser-operator-{uuid4().hex}@example.com",
        secrets.token_urlsafe(32),
    )
    try:
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
