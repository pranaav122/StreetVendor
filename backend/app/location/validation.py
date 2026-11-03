"""Shared first-fix/update/meeting-point boundaries, with production fail-closed."""
from datetime import timedelta

from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.errors import problem
from app.location.schemas import ValidatedFix


def validate_service_area(session, point, settings):
    if settings.environment != "production":
        # This synthetic Chennai rectangle is a development fixture, not a launch boundary.
        inside = 13.00 <= point.latitude <= 13.20 and 80.15 <= point.longitude <= 80.35
    elif settings.service_area_geojson:
        try:
            result = session.execute(text("""
                WITH area AS (SELECT ST_SetSRID(ST_GeomFromGeoJSON(:area),4326) AS shape),
                checked AS (SELECT shape, ST_IsValid(shape) AND NOT ST_IsEmpty(shape)
                    AND ST_GeometryType(shape) IN ('ST_Polygon','ST_MultiPolygon') AS valid FROM area)
                SELECT valid, CASE WHEN valid THEN ST_Covers(shape,ST_SetSRID(ST_MakePoint(:lon,:lat),4326))
                    ELSE false END AS inside FROM checked
                """), {"area": settings.service_area_geojson, "lat": point.latitude, "lon": point.longitude}).one()
        except SQLAlchemyError:
            # Broken operator configuration is a service failure, never a customer's bad GPS.
            raise problem(503, "SERVICE_AREA_INVALID", "The configured service area needs operator attention.") from None
        if not result.valid:
            raise problem(503, "SERVICE_AREA_INVALID", "The configured service area needs operator attention.")
        inside = result.inside
    else:
        raise problem(503, "SERVICE_AREA_NOT_CONFIGURED", "The production service area is not configured.")
    if not inside:
        raise problem(422, "OUTSIDE_SERVICE_AREA", "Choose a point within the supported area.")


def validate_fix(payload, now) -> ValidatedFix:
    age = now - payload.captured_at
    if age > timedelta(seconds=90):
        raise problem(422, "LOCATION_STALE", "Take a new location reading.")
    if age < -timedelta(seconds=30):
        raise problem(422, "LOCATION_FUTURE", "Check the device clock.")
    return ValidatedFix(**payload.model_dump(), received_at=now)
