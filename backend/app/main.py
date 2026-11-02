"""Construct the API without connecting to or migrating the database at import."""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi import HTTPException
from fastapi.exceptions import RequestValidationError
from sqlalchemy.orm import sessionmaker

from app.config import Settings
from app.database import create_db_engine
from app.health import router
from app.auth.router import router as auth_router
from app.users.router import router as users_router
from app.errors import http_error, validation_error
from app.auth.mailer import SMTPMailer
from app.auth.recovery import router as recovery_router


def create_app(settings: Settings | None = None) -> FastAPI:
    if settings is None:
        settings = Settings()
    engine = create_db_engine(settings)

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        try:
            yield
        finally:
            engine.dispose()

    app = FastAPI(title="MyStreetVendor API", version="0.1.0", lifespan=lifespan)
    app.state.engine = engine
    app.state.settings = settings
    app.state.mailer = SMTPMailer(settings)
    app.state.session_factory = sessionmaker(bind=engine, autoflush=False)
    app.include_router(router)
    app.include_router(auth_router)
    app.include_router(recovery_router)
    app.include_router(users_router)
    app.add_exception_handler(HTTPException, http_error)
    app.add_exception_handler(RequestValidationError, validation_error)
    return app
