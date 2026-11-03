"""Versioned visit state and append-only business events; no sales data."""

from datetime import datetime
from uuid import UUID, uuid4

from geoalchemy2 import Geography, WKBElement
from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    LargeBinary,
    String,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base

ACTIVE_SQL = "status IN ('PENDING','ACCEPTED','APPROACHING','ARRIVED')"


class VisitRequest(Base):
    __tablename__ = "visit_requests"
    __table_args__ = (
        CheckConstraint(
            "status IN ('PENDING','ACCEPTED','APPROACHING','ARRIVED','COMPLETED','DECLINED','CANCELLED','EXPIRED')",
            name="ck_visit_status",
        ),
        CheckConstraint("version >= 1", name="ck_visit_version"),
        CheckConstraint("octet_length(payload_hash)=32", name="ck_visit_payload_hash"),
        CheckConstraint("expires_at > created_at", name="ck_visit_deadline"),
        CheckConstraint(
            f"({ACTIVE_SQL} AND meeting_point IS NOT NULL AND closed_at IS NULL) OR (NOT ({ACTIVE_SQL}) AND closed_at IS NOT NULL)",
            name="ck_visit_closure",
        ),
        UniqueConstraint("customer_id", "idempotency_key", name="uq_visit_idempotency"),
        Index(
            "uq_visit_active_pair",
            "customer_id",
            "vendor_id",
            unique=True,
            postgresql_where=text(ACTIVE_SQL),
        ),
        Index(
            "ix_visit_active_expiry", "expires_at", postgresql_where=text(ACTIVE_SQL)
        ),
        Index("ix_visit_customer_created", "customer_id", "created_at", "id"),
        Index("ix_visit_vendor_created", "vendor_id", "created_at", "id"),
    )
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    customer_id: Mapped[UUID] = mapped_column(ForeignKey("users.id"))
    vendor_id: Mapped[UUID] = mapped_column(ForeignKey("vendor_profiles.id"))
    meeting_point: Mapped[WKBElement | None] = mapped_column(
        Geography("POINT", srid=4326, spatial_index=False)
    )
    meeting_label: Mapped[str | None] = mapped_column(String(250))
    status: Mapped[str] = mapped_column(String(16), default="PENDING")
    version: Mapped[int] = mapped_column(Integer, default=1)
    idempotency_key: Mapped[UUID]
    payload_hash: Mapped[bytes] = mapped_column(LargeBinary(32))
    reason: Mapped[str | None] = mapped_column(String(500))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class RequestEvent(Base):
    __tablename__ = "request_events"
    __table_args__ = (
        UniqueConstraint(
            "request_id", "request_version", name="uq_event_request_version"
        ),
        CheckConstraint("request_version >= 1", name="ck_event_version"),
        CheckConstraint("jsonb_typeof(metadata)='object'", name="ck_event_metadata"),
        Index("ix_event_request_created", "request_id", "created_at", "id"),
    )
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    request_id: Mapped[UUID] = mapped_column(
        ForeignKey("visit_requests.id", ondelete="CASCADE")
    )
    actor_user_id: Mapped[UUID | None] = mapped_column(ForeignKey("users.id"))
    request_version: Mapped[int] = mapped_column(Integer)
    event_type: Mapped[str] = mapped_column(String(40))
    from_status: Mapped[str | None] = mapped_column(String(16))
    to_status: Mapped[str] = mapped_column(String(16))
    event_metadata: Mapped[dict] = mapped_column(
        "metadata", JSONB, default=dict, server_default=text("'{}'::jsonb")
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
