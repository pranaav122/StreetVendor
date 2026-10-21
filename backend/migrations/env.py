"""Use the same settings as FastAPI, without storing credentials in alembic.ini."""

from logging.config import fileConfig

from alembic import context
from sqlalchemy import Connection

from app.config import Settings
from app.database import Base, create_db_engine

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name, disable_existing_loggers=False)


def include_object(object_, name, type_, reflected, compare_to) -> bool:
    # PostGIS owns this public table; application autogeneration must not remove it.
    return not (type_ == "table" and name == "spatial_ref_sys")


def run_migrations(connection: Connection) -> None:
    context.configure(
        connection=connection,
        target_metadata=Base.metadata,
        include_object=include_object,
    )
    with context.begin_transaction():
        # The image adds tiger to search_path; only public belongs to our app.
        connection.exec_driver_sql("SET LOCAL search_path TO public")
        context.run_migrations()


if context.is_offline_mode():
    context.configure(
        url=Settings().database_url,
        target_metadata=Base.metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()
elif config.attributes.get("connection") is not None:
    run_migrations(config.attributes["connection"])
else:
    engine = create_db_engine(Settings())
    try:
        with engine.connect() as connection:
            run_migrations(connection)
    finally:
        engine.dispose()
