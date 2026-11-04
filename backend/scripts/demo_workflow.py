"""Repeat the existing synthetic visit test without duplicating its business flow."""

import os
import subprocess
import sys
from pathlib import Path


def main():
    root = Path(__file__).resolve().parents[2]
    print(
        "Synthetic HTTP-handler workflow with real isolated PostgreSQL; push is simulated.",
        flush=True,
    )
    # Reuse the maintained assertions and guarded disposable-database fixture.
    # The demo never writes synthetic accounts into the development database.
    environment = dict(os.environ, RUN_DB_TESTS="1")
    return subprocess.run(
        [
            sys.executable,
            "-m",
            "pytest",
            "-c",
            "backend/pyproject.toml",
            "backend/tests/test_end_to_end.py::test_customer_partner_visit_with_isolation_and_notification",
            "-q",
        ],
        cwd=root,
        env=environment,
        check=False,
    ).returncode


if __name__ == "__main__":
    sys.exit(main())
