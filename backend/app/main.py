"""Construct the API without connecting to or migrating the database at import."""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from sqlalchemy.orm import sessionmaker

from app.config import Settings
from app.database import create_db_engine
from app.health import router


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
    app.state.session_factory = sessionmaker(bind=engine, autoflush=False)
    app.include_router(router)
    return app
