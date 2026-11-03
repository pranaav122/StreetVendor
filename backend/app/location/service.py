"""Exact writes and deliberately coarse discovery are separate operations."""

import hashlib
import hmac
import json
import math
from datetime import timedelta

import jwt
from sqlalchemy import select, text
from sqlalchemy.dialects.postgresql import insert

from app.auth.security import signing_key, utcnow
from app.auth.service import consume_limit
from app.errors import problem
from app.location.validation import validate_fix, validate_service_area
from app.models.accounts import RateLimitBucket
from app.vendors.service import category_list, lock_vendor, write_location

# The first predicate uses GiST. Its padding exceeds the maximum point-to-grid
# displacement anywhere on Earth, so only the coarse predicate decides membership.
NEARBY_SQL = """
WITH origin AS (
    SELECT ST_SetSRID(ST_MakePoint(:longitude,:latitude),4326)::geography AS point
), candidates AS (
    SELECT v.id, v.display_name, l.captured_at,
           ST_SnapToGrid(l.position::geometry,0.01)::geography AS coarse
    FROM vendor_profiles v
    JOIN users u ON u.id=v.user_id
    JOIN vendor_locations l ON l.vendor_id=v.id
    CROSS JOIN origin o
    WHERE u.status='ACTIVE' AND u.role='vendor' AND v.verification_status='VERIFIED'
      AND v.is_available AND v.location_sharing_enabled
      AND l.captured_at >= :oldest AND l.captured_at <= :latest AND l.accuracy_m<=100
      AND ST_DWithin(l.position,o.point,:radius+1000)
      AND EXISTS (SELECT 1 FROM vendor_categories vc JOIN product_categories pc ON pc.id=vc.category_id
                  WHERE vc.vendor_id=v.id AND pc.is_active
                    AND (CAST(:category_id AS uuid) IS NULL OR pc.id=CAST(:category_id AS uuid)))
), matches AS (
    SELECT c.*, ST_Distance(c.coarse,o.point) AS distance
    FROM candidates c CROSS JOIN origin o WHERE ST_DWithin(c.coarse,o.point,:radius)
)
SELECT id,display_name,captured_at,distance,ST_Y(coarse::geometry) AS latitude,ST_X(coarse::geometry) AS longitude
FROM matches
WHERE CAST(:after_distance AS double precision) IS NULL
   OR (distance,id) > (CAST(:after_distance AS double precision),CAST(:after_id AS uuid))
ORDER BY distance,id LIMIT :limit
"""


def record_fix(session, actor, payload, settings, candidate_store=None):
    vendor = lock_vendor(session, actor.id)
    if vendor.verification_status != "VERIFIED":
        raise problem(
            403,
            "VENDOR_NOT_VERIFIED",
            "Staff approval is required before sharing location.",
        )
    if not vendor.is_available or not vendor.location_sharing_enabled:
        raise problem(
            409, "LOCATION_SHARING_DISABLED", "Go online before updating location."
        )
    fix = validate_fix(payload, utcnow())
    validate_service_area(session, fix, settings)
    write_location(session, vendor.id, fix)
    from app.visits.arrival import evaluate_arrival

    evaluate_arrival(
        session,
        vendor,
        fix,
        candidate_store if candidate_store is not None else {},
        utcnow(),
    )
    session.commit()
    return {"captured_at": fix.captured_at, "tracking_status": "SHARING"}


def grid_coordinate(value):
    return math.floor(value * 100 + 0.5) / 100


def cursor_binding(actor, search):
    data = search.model_dump(mode="json", exclude={"cursor"}) | {"actor": str(actor.id)}
    return hashlib.sha256(
        json.dumps(data, sort_keys=True, separators=(",", ":")).encode()
    ).hexdigest()


def read_cursor(raw, binding, settings):
    try:
        claims = jwt.decode(
            raw,
            signing_key(settings),
            algorithms=["HS256"],
            audience="nearby-cursor",
            issuer=settings.jwt_issuer,
            options={"require": ["exp", "binding", "distance", "id"]},
        )
        if claims["binding"] != binding:
            raise ValueError("Different search")
        return claims["distance"], claims["id"]
    except (jwt.InvalidTokenError, ValueError, TypeError):
        raise problem(
            422, "INVALID_CURSOR", "Refresh this search to continue."
        ) from None


def limit_search_origin(request, actor, latitude, longitude):
    settings = request.app.state.settings
    now = utcnow()
    period = int(now.timestamp()) // 900
    prefix = hmac.new(
        signing_key(settings).encode(),
        f"origin:{actor.id}:{period}".encode(),
        hashlib.sha256,
    ).hexdigest()[:32]
    suffix = hashlib.sha256(f"{latitude}:{longitude}".encode()).hexdigest()[:32]
    key = f"{prefix}:{suffix}"
    # A short advisory lock serializes distinct-origin counting across API requests.
    # Stored keys are keyed hashes, so abuse limits don't become a location history.
    with request.app.state.engine.begin() as connection:
        connection.execute(
            text("SELECT pg_advisory_xact_lock(hashtextextended(:prefix,0))"),
            {"prefix": prefix},
        )
        exists = connection.scalar(
            select(RateLimitBucket.key).where(RateLimitBucket.key == key)
        )
        if exists is None:
            count = connection.scalar(
                text("SELECT count(*) FROM rate_limit_buckets WHERE key LIKE :prefix"),
                {"prefix": prefix + ":%"},
            )
            if count >= 10:
                raise problem(
                    429,
                    "SEARCH_AREA_LIMIT",
                    "Wait before changing the search area again.",
                    {"Retry-After": "900"},
                )
            connection.execute(
                insert(RateLimitBucket).values(
                    key=key, count=1, expires_at=now + timedelta(minutes=15)
                )
            )


def nearby(session, actor, search, request):
    settings = request.app.state.settings
    validate_service_area(session, search, settings)
    consume_limit(request, str(actor.id), "discovery", 60)
    latitude, longitude = (
        grid_coordinate(search.latitude),
        grid_coordinate(search.longitude),
    )
    limit_search_origin(request, actor, latitude, longitude)
    binding = cursor_binding(actor, search)
    after_distance, after_id = (
        read_cursor(search.cursor, binding, settings) if search.cursor else (None, None)
    )
    now = utcnow()
    rows = (
        session.execute(
            text(NEARBY_SQL),
            {
                "latitude": latitude,
                "longitude": longitude,
                "radius": search.radius_m,
                "category_id": search.category_id,
                "oldest": now - timedelta(seconds=90),
                "latest": now + timedelta(seconds=30),
                "limit": search.limit + 1,
                "after_distance": after_distance,
                "after_id": after_id,
            },
        )
        .mappings()
        .all()
    )
    items = []
    for row in rows[: search.limit]:
        band = int(row["distance"] // 1000) * 1000
        # No exact column, exact distance or device accuracy enters this response.
        items.append(
            {
                "vendor_id": row["id"],
                "display_name": row["display_name"],
                "categories": category_list(session, row["id"]),
                "approximate_location": {
                    "latitude": row["latitude"],
                    "longitude": row["longitude"],
                    "radius_m": 1000,
                },
                "distance_band_m": {"min": band, "max": band + 1000},
                "location_updated_at": row["captured_at"],
            }
        )
    cursor = None
    if len(rows) > search.limit:
        last = rows[search.limit - 1]
        cursor = jwt.encode(
            {
                "binding": binding,
                "distance": last["distance"],
                "id": str(last["id"]),
                "exp": now + timedelta(minutes=5),
                "iss": settings.jwt_issuer,
                "aud": "nearby-cursor",
            },
            signing_key(settings),
            algorithm="HS256",
        )
    return {"items": items, "next_cursor": cursor}
