"""Local operator commands; administrator creation is never a public endpoint."""

import argparse
from getpass import getpass

from fastapi import HTTPException
from pydantic import ValidationError
from sqlalchemy.orm import Session

from app.auth.schemas import RegisterInput
from app.auth.service import register_user
from app.config import Settings
from app.database import create_db_engine


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    admin = commands.add_parser("create-admin")
    admin.add_argument("--email", required=True)
    admin.add_argument("--name", default="Operator")
    commands.add_parser("seed-categories")
    args = parser.parse_args(argv)
    engine = create_db_engine(Settings())
    try:
        if args.command == "seed-categories":
            from app.vendors.service import seed_categories
            with Session(engine) as session:
                seed_categories(session)
            print("Category seed complete")
            return 0
        # Read interactively so the secret is absent from process lists and shell history.
        payload = RegisterInput(email=args.email, display_name=args.name, password=getpass("Admin password: "))
        with Session(engine) as session:
            user = register_user(session, payload, "admin")
            print(f"Created administrator {user.id}")
        return 0
    except (ValidationError, HTTPException):
        print("Account creation failed. Check the email, password policy, and existing accounts.")
        return 1
    finally:
        engine.dispose()


if __name__ == "__main__":
    raise SystemExit(main())
