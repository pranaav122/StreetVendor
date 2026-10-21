"""Establish the spatial prerequisite; business tables arrive in later phases."""

from alembic import op

revision = "0001_enable_postgis"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS postgis")


def downgrade() -> None:
    # The image or another schema may own PostGIS. Never drop shared spatial data.
    pass
