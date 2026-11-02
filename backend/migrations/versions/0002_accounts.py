"""Add accounts and hashed, revocable authentication state."""

from alembic import op
import sqlalchemy as sa

revision = "0002_accounts"
down_revision = "0001_enable_postgis"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table("users",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("email", sa.String(320), unique=True),
        sa.Column("role", sa.String(16), nullable=False),
        sa.Column("status", sa.String(16), nullable=False),
        sa.Column("display_name", sa.String(100), nullable=False),
        sa.Column("preferred_language", sa.String(2), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True)),
        sa.Column("email_verified_at", sa.DateTime(timezone=True)),
        sa.CheckConstraint("role IN ('customer','vendor','admin')", name="ck_users_role"),
        sa.CheckConstraint("status IN ('ACTIVE','SUSPENDED','DELETED')", name="ck_users_status"),
        sa.CheckConstraint("preferred_language IN ('en','ta')", name="ck_users_language"))
    op.create_table("user_credentials",
        sa.Column("user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("password_hash", sa.String(512), nullable=False),
        sa.Column("password_changed_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False))
    op.create_table("refresh_sessions",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("family_id", sa.Uuid(), nullable=False),
        sa.Column("token_hash", sa.LargeBinary(32), unique=True, nullable=False),
        sa.Column("device_name", sa.String(100)),
        sa.Column("replaced_by_id", sa.Uuid(), sa.ForeignKey("refresh_sessions.id"), unique=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("authenticated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True)),
        sa.Column("last_used_at", sa.DateTime(timezone=True)),
        sa.CheckConstraint("octet_length(token_hash) = 32", name="ck_refresh_hash_length"))
    op.create_index("ix_refresh_family", "refresh_sessions", ["family_id"])
    op.create_index("ix_refresh_user", "refresh_sessions", ["user_id"])
    op.create_table("rate_limit_buckets",
        sa.Column("key", sa.String(96), primary_key=True),
        sa.Column("count", sa.Integer(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False))
    op.create_index("ix_rate_expiry", "rate_limit_buckets", ["expires_at"])


def downgrade() -> None:
    op.drop_table("rate_limit_buckets")
    op.drop_table("refresh_sessions")
    op.drop_table("user_credentials")
    op.drop_table("users")
