"""Device ownership and durable, leased delivery records; never GPS payloads."""

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    Integer,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class DeviceToken(Base):
    __tablename__ = "device_tokens"
    __table_args__ = (
        UniqueConstraint(
            "installation_id", "app_kind", name="uq_device_installation_app"
        ),
        UniqueConstraint("id", "user_id", name="uq_device_owner"),
        CheckConstraint("app_kind IN ('customer','vendor')", name="ck_device_app"),
        CheckConstraint("platform IN ('android','ios')", name="ck_device_platform"),
        Index("ix_device_user", "user_id"),
        Index("ix_device_family", "session_family_id"),
    )
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    session_family_id: Mapped[UUID]
    installation_id: Mapped[UUID]
    app_kind: Mapped[str] = mapped_column(String(16))
    platform: Mapped[str] = mapped_column(String(16))
    project_id: Mapped[UUID]
    token: Mapped[str] = mapped_column(String(256), unique=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    last_seen_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    disabled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class NotificationOutbox(Base):
    __tablename__ = "notification_outbox"
    __table_args__ = (
        # Ownership is validated through the device's user FK. An extra users FK
        # would invert account/visit lock order during concurrent account deletion.
        ForeignKeyConstraint(
            ["device_token_id", "recipient_user_id"],
            ["device_tokens.id", "device_tokens.user_id"],
            name="fk_outbox_current_device_owner",
            ondelete="CASCADE",
        ),
        UniqueConstraint(
            "request_event_id",
            "device_token_id",
            "channel",
            name="uq_outbox_event_device_channel",
        ),
        CheckConstraint("channel='expo'", name="ck_outbox_channel"),
        CheckConstraint(
            "status IN ('PENDING','SENDING','AWAITING_RECEIPT','CHECKING_RECEIPT','RECEIPT_OK','FAILED','SUPPRESSED')",
            name="ck_outbox_status",
        ),
        CheckConstraint(
            "attempts>=0 AND attempts<=5 AND receipt_attempts>=0",
            name="ck_outbox_attempts",
        ),
        CheckConstraint("jsonb_typeof(payload)='object'", name="ck_outbox_payload"),
        Index("ix_outbox_due", "status", "next_attempt_at"),
        Index("ix_outbox_device", "device_token_id"),
    )
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    request_event_id: Mapped[UUID] = mapped_column(
        ForeignKey("request_events.id", ondelete="CASCADE")
    )
    recipient_user_id: Mapped[UUID]
    device_token_id: Mapped[UUID]
    channel: Mapped[str] = mapped_column(String(16), default="expo")
    payload: Mapped[dict] = mapped_column(JSONB)
    status: Mapped[str] = mapped_column(String(24), default="PENDING")
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    receipt_attempts: Mapped[int] = mapped_column(Integer, default=0)
    next_attempt_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    lease_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    lease_token: Mapped[UUID | None]
    provider_ticket_id: Mapped[str | None] = mapped_column(String(128))
    last_error_code: Mapped[str | None] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
