"""Dependency readiness with safe failure responses."""

import logging
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Response, status
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.database import get_db

logger = logging.getLogger(__name__)
router = APIRouter()


class HealthResponse(BaseModel):
    status: Literal["ok", "error"]
    database: Literal["ok", "unavailable"]
    postgis: Literal["ok", "unavailable", "unknown"]


@router.get(
    "/health",
    response_model=HealthResponse,
    tags=["health"],
    responses={503: {"model": HealthResponse, "description": "Dependency unavailable"}},
)
def health(
    response: Response, session: Annotated[Session, Depends(get_db)]
) -> HealthResponse:
    try:
        session.execute(text("SELECT 1"))
    except SQLAlchemyError as error:
        logger.warning("Database health check failed (%s)", type(error).__name__)
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        return HealthResponse(status="error", database="unavailable", postgis="unknown")

    try:
        session.execute(text("SELECT PostGIS_Full_Version()"))
    except SQLAlchemyError as error:
        logger.warning("PostGIS health check failed (%s)", type(error).__name__)
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        return HealthResponse(status="error", database="ok", postgis="unavailable")

    return HealthResponse(status="ok", database="ok", postgis="ok")
