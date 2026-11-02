"""Only the latest exact fix; never a route history."""
from datetime import datetime
from uuid import UUID

from geoalchemy2 import Geography, WKBElement
from sqlalchemy import CheckConstraint, DateTime, Float, ForeignKey, Index, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class VendorLocation(Base):
    __tablename__ = "vendor_locations"
    __table_args__ = (
        CheckConstraint("accuracy_m >= 0 AND accuracy_m <= 100", name="ck_location_accuracy"),
        Index("ix_vendor_position", "position", postgresql_using="gist"),
    )
    vendor_id: Mapped[UUID] = mapped_column(ForeignKey("vendor_profiles.id", ondelete="CASCADE"), primary_key=True)
    # Explicit index naming keeps model metadata and reviewed Alembic operations aligned.
    position: Mapped[WKBElement] = mapped_column(Geography("POINT", srid=4326, spatial_index=False))
    accuracy_m: Mapped[float] = mapped_column(Float)
    captured_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    received_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
