"""Business identity, bilingual catalogue and minimal staff review history."""
from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, Index, String, func, text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class VendorProfile(Base):
    __tablename__ = "vendor_profiles"
    __table_args__ = (
        CheckConstraint("verification_status IN ('PENDING','VERIFIED','REJECTED','SUSPENDED')", name="ck_vendor_verification"),
        CheckConstraint("NOT is_available OR (verification_status='VERIFIED' AND location_sharing_enabled)", name="ck_vendor_online_consent"),
    )
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), unique=True)
    display_name: Mapped[str] = mapped_column(String(100))
    description: Mapped[str] = mapped_column(String(1000), default="")
    verification_status: Mapped[str] = mapped_column(String(16), default="PENDING")
    is_available: Mapped[bool] = mapped_column(Boolean, default=False)
    location_sharing_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ProductCategory(Base):
    __tablename__ = "product_categories"
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    slug: Mapped[str] = mapped_column(String(64), unique=True)
    name_en: Mapped[str] = mapped_column(String(100))
    name_ta: Mapped[str] = mapped_column(String(100))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class VendorCategory(Base):
    __tablename__ = "vendor_categories"
    vendor_id: Mapped[UUID] = mapped_column(ForeignKey("vendor_profiles.id", ondelete="CASCADE"), primary_key=True)
    category_id: Mapped[UUID] = mapped_column(ForeignKey("product_categories.id"), primary_key=True)


class VendorVerification(Base):
    __tablename__ = "vendor_verifications"
    __table_args__ = (
        CheckConstraint("status IN ('PENDING','VERIFIED','REJECTED')", name="ck_review_status"),
        Index("ix_review_status", "status", "submitted_at"),
        Index("uq_pending_review", "vendor_id", unique=True, postgresql_where=text("status='PENDING'")),
    )
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    vendor_id: Mapped[UUID] = mapped_column(ForeignKey("vendor_profiles.id", ondelete="CASCADE"))
    status: Mapped[str] = mapped_column(String(16), default="PENDING")
    evidence_note: Mapped[str] = mapped_column(String(1000))
    decision_reason: Mapped[str | None] = mapped_column(String(500))
    reviewed_by: Mapped[UUID | None] = mapped_column(ForeignKey("users.id"))
    submitted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class AdminAuditRecord(Base):
    __tablename__ = "admin_audit_records"
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    actor_user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id"))
    target_id: Mapped[UUID]
    action: Mapped[str] = mapped_column(String(64))
    reason: Mapped[str] = mapped_column(String(500))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
