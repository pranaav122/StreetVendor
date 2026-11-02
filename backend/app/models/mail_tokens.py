"""Single-use recovery secrets; the original secret never enters the database."""

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, LargeBinary, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class MailToken(Base):
    __tablename__ = "mail_tokens"
    __table_args__ = (
        CheckConstraint("purpose IN ('VERIFY_EMAIL','RESET_PASSWORD')", name="ck_mail_purpose"),
        CheckConstraint("octet_length(token_hash) = 32", name="ck_mail_hash_length"),
        Index("ix_mail_user_purpose", "user_id", "purpose"),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    purpose: Mapped[str] = mapped_column(String(24))
    token_hash: Mapped[bytes] = mapped_column(LargeBinary(32), unique=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
