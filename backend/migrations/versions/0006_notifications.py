"""Add session bound device ownership and durable notification delivery

Revision ID: 0006_notifications
Revises: 0005_visits_reports
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0006_notifications"
down_revision = "0005_visits_reports"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create device ownership before the composite outbox reference.
    op.create_table(
        "device_tokens",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("session_family_id", sa.Uuid(), nullable=False),
        sa.Column("installation_id", sa.Uuid(), nullable=False),
        sa.Column("app_kind", sa.String(length=16), nullable=False),
        sa.Column("platform", sa.String(length=16), nullable=False),
        sa.Column("project_id", sa.Uuid(), nullable=False),
        sa.Column("token", sa.String(length=256), nullable=False),
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
        sa.Column(
            "last_seen_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("disabled_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint("app_kind IN ('customer','vendor')", name="ck_device_app"),
        sa.CheckConstraint("platform IN ('android','ios')", name="ck_device_platform"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("id", "user_id", name="uq_device_owner"),
        sa.UniqueConstraint(
            "installation_id", "app_kind", name="uq_device_installation_app"
        ),
        sa.UniqueConstraint("token"),
    )
    op.create_index(
        "ix_device_family", "device_tokens", ["session_family_id"], unique=False
    )
    op.create_index("ix_device_user", "device_tokens", ["user_id"], unique=False)
    op.create_table(
        "notification_outbox",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("request_event_id", sa.Uuid(), nullable=False),
        sa.Column("recipient_user_id", sa.Uuid(), nullable=False),
        sa.Column("device_token_id", sa.Uuid(), nullable=False),
        sa.Column("channel", sa.String(length=16), nullable=False),
        sa.Column("payload", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("status", sa.String(length=24), nullable=False),
        sa.Column("attempts", sa.Integer(), nullable=False),
        sa.Column("receipt_attempts", sa.Integer(), nullable=False),
        sa.Column(
            "next_attempt_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("lease_until", sa.DateTime(timezone=True), nullable=True),
        sa.Column("lease_token", sa.Uuid(), nullable=True),
        sa.Column("provider_ticket_id", sa.String(length=128), nullable=True),
        sa.Column("last_error_code", sa.String(length=64), nullable=True),
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
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint("channel='expo'", name="ck_outbox_channel"),
        sa.CheckConstraint("jsonb_typeof(payload)='object'", name="ck_outbox_payload"),
        sa.CheckConstraint(
            "status IN ('PENDING','SENDING','AWAITING_RECEIPT','CHECKING_RECEIPT','RECEIPT_OK','FAILED','SUPPRESSED')",
            name="ck_outbox_status",
        ),
        sa.CheckConstraint(
            "attempts>=0 AND attempts<=5 AND receipt_attempts>=0",
            name="ck_outbox_attempts",
        ),
        sa.ForeignKeyConstraint(
            ["device_token_id", "recipient_user_id"],
            ["device_tokens.id", "device_tokens.user_id"],
            name="fk_outbox_current_device_owner",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["request_event_id"], ["request_events.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "request_event_id",
            "device_token_id",
            "channel",
            name="uq_outbox_event_device_channel",
        ),
    )
    op.create_index(
        "ix_outbox_device", "notification_outbox", ["device_token_id"], unique=False
    )
    op.create_index(
        "ix_outbox_due",
        "notification_outbox",
        ["status", "next_attempt_at"],
        unique=False,
    )


def downgrade() -> None:
    # Delivery rows must disappear before their ownership records.
    op.drop_index("ix_outbox_due", table_name="notification_outbox")
    op.drop_index("ix_outbox_device", table_name="notification_outbox")
    op.drop_table("notification_outbox")
    op.drop_index("ix_device_user", table_name="device_tokens")
    op.drop_index("ix_device_family", table_name="device_tokens")
    op.drop_table("device_tokens")
