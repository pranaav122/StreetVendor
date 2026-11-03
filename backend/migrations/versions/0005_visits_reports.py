"""Add versioned visits events and participant reports

Revision ID: 0005_visits_reports
Revises: 0004_vendors_locations
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from geoalchemy2 import Geography

revision = "0005_visits_reports"
down_revision = "0004_vendors_locations"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Keep reviewed schema operations independent of later ORM changes.
    op.create_table(
        "visit_requests",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("customer_id", sa.Uuid(), nullable=False),
        sa.Column("vendor_id", sa.Uuid(), nullable=False),
        sa.Column(
            "meeting_point",
            Geography("POINT", srid=4326, spatial_index=False),
            nullable=True,
        ),
        sa.Column("meeting_label", sa.String(length=250), nullable=True),
        sa.Column("status", sa.String(length=16), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("idempotency_key", sa.Uuid(), nullable=False),
        sa.Column("payload_hash", sa.LargeBinary(length=32), nullable=False),
        sa.Column("reason", sa.String(length=500), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("closed_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(
            "(status IN ('PENDING','ACCEPTED','APPROACHING','ARRIVED') AND meeting_point IS NOT NULL AND closed_at IS NULL) OR (NOT (status IN ('PENDING','ACCEPTED','APPROACHING','ARRIVED')) AND closed_at IS NOT NULL)",
            name="ck_visit_closure",
        ),
        sa.CheckConstraint(
            "status IN ('PENDING','ACCEPTED','APPROACHING','ARRIVED','COMPLETED','DECLINED','CANCELLED','EXPIRED')",
            name="ck_visit_status",
        ),
        sa.CheckConstraint("expires_at > created_at", name="ck_visit_deadline"),
        sa.CheckConstraint(
            "octet_length(payload_hash)=32", name="ck_visit_payload_hash"
        ),
        sa.CheckConstraint("version >= 1", name="ck_visit_version"),
        sa.ForeignKeyConstraint(
            ["customer_id"],
            ["users.id"],
        ),
        sa.ForeignKeyConstraint(
            ["vendor_id"],
            ["vendor_profiles.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "customer_id", "idempotency_key", name="uq_visit_idempotency"
        ),
    )
    op.create_index(
        "ix_visit_active_expiry",
        "visit_requests",
        ["expires_at"],
        unique=False,
        postgresql_where=sa.text(
            "status IN ('PENDING','ACCEPTED','APPROACHING','ARRIVED')"
        ),
    )
    op.create_index(
        "ix_visit_customer_created",
        "visit_requests",
        ["customer_id", "created_at", "id"],
        unique=False,
    )
    op.create_index(
        "ix_visit_vendor_created",
        "visit_requests",
        ["vendor_id", "created_at", "id"],
        unique=False,
    )
    op.create_index(
        "uq_visit_active_pair",
        "visit_requests",
        ["customer_id", "vendor_id"],
        unique=True,
        postgresql_where=sa.text(
            "status IN ('PENDING','ACCEPTED','APPROACHING','ARRIVED')"
        ),
    )
    op.create_table(
        "request_events",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("request_id", sa.Uuid(), nullable=False),
        sa.Column("actor_user_id", sa.Uuid(), nullable=True),
        sa.Column("request_version", sa.Integer(), nullable=False),
        sa.Column("event_type", sa.String(length=40), nullable=False),
        sa.Column("from_status", sa.String(length=16), nullable=True),
        sa.Column("to_status", sa.String(length=16), nullable=False),
        sa.Column(
            "metadata",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'{}'::jsonb"),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint("jsonb_typeof(metadata)='object'", name="ck_event_metadata"),
        sa.CheckConstraint("request_version >= 1", name="ck_event_version"),
        sa.ForeignKeyConstraint(
            ["actor_user_id"],
            ["users.id"],
        ),
        sa.ForeignKeyConstraint(
            ["request_id"], ["visit_requests.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "request_id", "request_version", name="uq_event_request_version"
        ),
    )
    op.create_index(
        "ix_event_request_created",
        "request_events",
        ["request_id", "created_at", "id"],
        unique=False,
    )
    op.create_table(
        "visit_reports",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("request_id", sa.Uuid(), nullable=False),
        sa.Column("reporter_id", sa.Uuid(), nullable=False),
        sa.Column("category", sa.String(length=16), nullable=False),
        sa.Column("reason", sa.String(length=1000), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("resolved_by", sa.Uuid(), nullable=True),
        sa.Column("resolution_reason", sa.String(length=500), nullable=True),
        sa.CheckConstraint(
            "category IN ('SAFETY','NO_SHOW','OTHER')", name="ck_report_category"
        ),
        sa.CheckConstraint("status IN ('OPEN','RESOLVED')", name="ck_report_status"),
        sa.ForeignKeyConstraint(
            ["reporter_id"],
            ["users.id"],
        ),
        sa.ForeignKeyConstraint(
            ["request_id"], ["visit_requests.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["resolved_by"],
            ["users.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("request_id", "reporter_id", name="uq_report_participant"),
    )
    op.create_index("ix_report_status", "visit_reports", ["status", "id"], unique=False)


def downgrade() -> None:
    # Children precede parents; PostGIS remains installed for other spatial tables.
    op.drop_index("ix_report_status", table_name="visit_reports")
    op.drop_table("visit_reports")
    op.drop_index("ix_event_request_created", table_name="request_events")
    op.drop_table("request_events")
    op.drop_index(
        "uq_visit_active_pair",
        table_name="visit_requests",
        postgresql_where=sa.text(
            "status IN ('PENDING','ACCEPTED','APPROACHING','ARRIVED')"
        ),
    )
    op.drop_index("ix_visit_vendor_created", table_name="visit_requests")
    op.drop_index("ix_visit_customer_created", table_name="visit_requests")
    op.drop_index(
        "ix_visit_active_expiry",
        table_name="visit_requests",
        postgresql_where=sa.text(
            "status IN ('PENDING','ACCEPTED','APPROACHING','ARRIVED')"
        ),
    )
    op.drop_table("visit_requests")
