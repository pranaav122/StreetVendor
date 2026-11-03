from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class VisitReport(Base):
    __tablename__ = "visit_reports"
    __table_args__ = (
        UniqueConstraint("request_id", "reporter_id", name="uq_report_participant"),
        CheckConstraint("status IN ('OPEN','RESOLVED')", name="ck_report_status"),
        CheckConstraint(
            "category IN ('SAFETY','NO_SHOW','OTHER')", name="ck_report_category"
        ),
        Index("ix_report_status", "status", "id"),
    )
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    request_id: Mapped[UUID] = mapped_column(
        ForeignKey("visit_requests.id", ondelete="CASCADE")
    )
    reporter_id: Mapped[UUID] = mapped_column(ForeignKey("users.id"))
    category: Mapped[str] = mapped_column(String(16))
    reason: Mapped[str] = mapped_column(String(1000))
    status: Mapped[str] = mapped_column(String(16), default="OPEN")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    resolved_by: Mapped[UUID | None] = mapped_column(ForeignKey("users.id"))
    resolution_reason: Mapped[str | None] = mapped_column(String(500))
