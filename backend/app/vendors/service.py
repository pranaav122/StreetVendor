"""Account -> vendor -> location is the lock order for every sharing write."""

from geoalchemy2 import Geography
from sqlalchemy import cast, delete, func, select
from sqlalchemy.dialects.postgresql import insert

from app.auth.security import utcnow
from app.auth.service import lock_user
from app.errors import problem
from app.location.validation import validate_fix, validate_service_area
from app.models.locations import VendorLocation
from app.models.vendors import ProductCategory, VendorCategory, VendorProfile
from app.realtime.signals import notify_vendor

CATALOGUE = [
    ("vegetables", "Vegetables", "காய்கறிகள்"),
    ("fruits", "Fruits", "பழங்கள்"),
    ("flowers", "Flowers", "பூக்கள்"),
    ("snacks", "Snacks", "சிற்றுண்டிகள்"),
]


def seed_categories(session) -> None:
    for slug, english, tamil in CATALOGUE:
        statement = insert(ProductCategory).values(
            slug=slug, name_en=english, name_ta=tamil, is_active=True
        )
        # Re-running bootstrap must not reactivate a category deliberately retired by staff.
        session.execute(
            statement.on_conflict_do_nothing(index_elements=[ProductCategory.slug])
        )
    session.commit()


def lock_vendor(session, user_id) -> VendorProfile:
    lock_user(session, user_id)
    row = session.scalar(
        select(VendorProfile)
        .where(VendorProfile.user_id == user_id)
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    if row is None:
        raise problem(404, "VENDOR_NOT_FOUND", "Create your business profile first.")
    return row


def category_list(session, vendor_id=None):
    query = select(ProductCategory).where(ProductCategory.is_active.is_(True))
    if vendor_id is not None:
        query = query.join(
            VendorCategory, VendorCategory.category_id == ProductCategory.id
        ).where(VendorCategory.vendor_id == vendor_id)
    return [
        {"id": row.id, "slug": row.slug, "name_en": row.name_en, "name_ta": row.name_ta}
        for row in session.scalars(query.order_by(ProductCategory.slug).limit(100))
    ]


def vendor_response(session, row, *, private=False):
    result = {
        "id": row.id,
        "display_name": row.display_name,
        "description": row.description,
        "verification_status": row.verification_status,
        "is_available": row.is_available,
        "categories": category_list(session, row.id),
    }
    if private:
        result.update(
            user_id=row.user_id,
            location_sharing_enabled=row.location_sharing_enabled,
            created_at=row.created_at,
            updated_at=row.updated_at,
        )
    return result


def save_profile(session, actor, payload):
    lock_user(session, actor.id)
    row = session.scalar(
        select(VendorProfile).where(VendorProfile.user_id == actor.id).with_for_update()
    )
    categories = list(
        session.scalars(
            select(ProductCategory.id).where(
                ProductCategory.id.in_(payload.category_ids),
                ProductCategory.is_active.is_(True),
            )
        )
    )
    if len(categories) != len(payload.category_ids):
        raise problem(
            422, "INVALID_CATEGORY", "Choose active categories from the catalogue."
        )
    if row is None:
        row = VendorProfile(user_id=actor.id, display_name=payload.display_name)
        session.add(row)
        session.flush()
    row.display_name, row.description, row.updated_at = (
        payload.display_name,
        payload.description,
        utcnow(),
    )
    session.execute(delete(VendorCategory).where(VendorCategory.vendor_id == row.id))
    session.add_all(
        VendorCategory(vendor_id=row.id, category_id=category_id)
        for category_id in categories
    )
    session.commit()
    return vendor_response(session, row, private=True)


def hide_vendor(session, row, *, anonymize=False):
    # Consent and exact-point erasure share the caller's transaction and vendor lock.
    row.is_available = row.location_sharing_enabled = False
    row.updated_at = utcnow()
    if anonymize:
        row.display_name, row.description = "Deleted vendor", ""
    session.execute(delete(VendorLocation).where(VendorLocation.vendor_id == row.id))
    notify_vendor(session, row.id)


def write_location(session, vendor_id, fix):
    # PostGIS constructors take longitude first; geography distances are metres.
    point = cast(
        func.ST_SetSRID(func.ST_MakePoint(fix.longitude, fix.latitude), 4326), Geography
    )
    statement = insert(VendorLocation).values(
        vendor_id=vendor_id,
        position=point,
        accuracy_m=fix.accuracy_m,
        captured_at=fix.captured_at,
        received_at=fix.received_at,
    )
    statement = statement.on_conflict_do_update(
        index_elements=[VendorLocation.vendor_id],
        set_={
            "position": statement.excluded.position,
            "accuracy_m": statement.excluded.accuracy_m,
            "captured_at": statement.excluded.captured_at,
            "received_at": statement.excluded.received_at,
        },
        where=VendorLocation.captured_at < statement.excluded.captured_at,
    ).returning(VendorLocation.vendor_id)
    if session.scalar(statement) is None:
        raise problem(
            409, "LOCATION_OUT_OF_ORDER", "A newer reading has already been accepted."
        )
    notify_vendor(session, vendor_id)


def set_availability(session, actor, payload, settings, candidate_store=None):
    row = lock_vendor(session, actor.id)
    if payload.is_available:
        if row.verification_status != "VERIFIED":
            raise problem(
                403,
                "VENDOR_NOT_VERIFIED",
                "Staff approval is required before going online.",
            )
        fix = validate_fix(payload.location, utcnow())
        validate_service_area(session, fix, settings)
        write_location(session, row.id, fix)
        row.is_available = row.location_sharing_enabled = True
        row.updated_at = utcnow()
        from app.visits.arrival import evaluate_arrival

        # A resumed sharing period starts a new debounce epoch, including its first fix.
        evaluate_arrival(
            session,
            row,
            fix,
            candidate_store if candidate_store is not None else {},
            utcnow(),
        )
    else:
        hide_vendor(session, row)
    session.commit()
    return vendor_response(session, row, private=True)
