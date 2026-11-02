"""Add one-use mail tokens without changing the published accounts migration."""

from alembic import op
import sqlalchemy as sa

revision = "0003_mail_tokens"
down_revision = "0002_accounts"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "mail_tokens",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("purpose", sa.String(24), nullable=False),
        sa.Column("token_hash", sa.LargeBinary(32), nullable=False, unique=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True)),
        sa.CheckConstraint("purpose IN ('VERIFY_EMAIL','RESET_PASSWORD')", name="ck_mail_purpose"),
        sa.CheckConstraint("octet_length(token_hash) = 32", name="ck_mail_hash_length"),
    )
    op.create_index("ix_mail_user_purpose", "mail_tokens", ["user_id", "purpose"])


def downgrade():
    op.drop_table("mail_tokens")
