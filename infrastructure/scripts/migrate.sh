#!/bin/sh
set -eu

# No migration occurs during API startup. This explicit one-off process owns DDL.
alembic -c alembic.ini upgrade head
python - <<'PY'
from sqlalchemy import text
from app.config import Settings
from app.database import create_db_engine

engine = create_db_engine(Settings())
try:
    with engine.begin() as connection:
        # Default grants also cover Alembic's newly created bookkeeping table.
        # Runtime may inspect its revision but must never change migration state.
        connection.execute(text('REVOKE ALL ON public.alembic_version FROM msv_runtime'))
        connection.execute(text('GRANT SELECT ON public.alembic_version TO msv_runtime'))
finally:
    engine.dispose()
PY
