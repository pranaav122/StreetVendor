"""Account identity, hashed credentials and revocable sessions."""

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, Integer, LargeBinary, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint("role IN ('customer','vendor','admin')", name="ck_users_role"),
        CheckConstraint("status IN ('ACTIVE','SUSPENDED','DELETED')", name="ck_users_status"),
        CheckConstraint("preferred_language IN ('en','ta')", name="ck_users_language"),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    email: Mapped[str | None] = mapped_column(String(320), unique=True)
    role: Mapped[str] = mapped_column(String(16))
    status: Mapped[str] = mapped_column(String(16), default="ACTIVE")
    display_name: Mapped[str] = mapped_column(String(100))
    preferred_language: Mapped[str] = mapped_column(String(2), default="en")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    email_verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class UserCredential(Base):
    __tablename__ = "user_credentials"

    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    password_hash: Mapped[str] = mapped_column(String(512))
    password_changed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class RefreshSession(Base):
    __tablename__ = "refresh_sessions"
    __table_args__ = (
        CheckConstraint("octet_length(token_hash) = 32", name="ck_refresh_hash_length"),
        Index("ix_refresh_family", "family_id"),
        Index("ix_refresh_user", "user_id"),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    family_id: Mapped[UUID]
    token_hash: Mapped[bytes] = mapped_column(LargeBinary(32), unique=True)
    device_name: Mapped[str | None] = mapped_column(String(100))
    replaced_by_id: Mapped[UUID | None] = mapped_column(ForeignKey("refresh_sessions.id"), unique=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    # Rotation must not turn an old login into a recent authentication.
    authenticated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class RateLimitBucket(Base):
    __tablename__ = "rate_limit_buckets"
    __table_args__ = (Index("ix_rate_expiry", "expires_at"),)

    key: Mapped[str] = mapped_column(String(96), primary_key=True)
    count: Mapped[int] = mapped_column(Integer)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
