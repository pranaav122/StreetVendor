from unittest.mock import Mock

import pytest
from fastapi.testclient import TestClient

import app.main
from app.database import create_db_engine


def test_failed_background_worker_cannot_skip_pool_disposal(settings, monkeypatch):
    engine = create_db_engine(settings)
    dispose = Mock(wraps=engine.dispose)
    monkeypatch.setattr(engine, "dispose", dispose)
    monkeypatch.setattr(app.main, "create_db_engine", lambda settings: engine)

    async def failed_worker(application):
        raise RuntimeError("Synthetic maintenance failure")

    monkeypatch.setattr(app.main, "run_jobs", failed_worker)
    with pytest.raises(RuntimeError, match="Synthetic maintenance failure"):
        with TestClient(
            app.main.create_app(settings.model_copy(update={"jobs_enabled": True}))
        ):
            pass
    dispose.assert_called_once()
