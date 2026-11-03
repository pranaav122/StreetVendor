"""Import model modules here so Alembic sees the complete application metadata."""

from app.models.accounts import RateLimitBucket, RefreshSession, User, UserCredential
from app.models.mail_tokens import MailToken
from app.models.vendors import (
    AdminAuditRecord,
    ProductCategory,
    VendorCategory,
    VendorProfile,
    VendorVerification,
)
from app.models.locations import VendorLocation
from app.models.visits import RequestEvent, VisitRequest
from app.models.reports import VisitReport
from app.models.notifications import DeviceToken, NotificationOutbox

__all__ = ["RateLimitBucket", "RefreshSession", "User", "UserCredential", "MailToken"]
