import importlib.util
from pathlib import Path
from urllib.error import HTTPError
from urllib.parse import urlsplit

import pytest
from sqlalchemy import text

from test_auth import PASSWORD, api
from test_vendors import categories, operator, vendor
from test_locations import ready_vendor


@pytest.fixture
def simulator():
    spec = importlib.util.spec_from_file_location("gps_simulator", Path(__file__).parents[1]/"scripts"/"simulate_gps.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_simulator_rejects_a_route_that_outlives_its_access_token(simulator, monkeypatch):
    def unexpected_prompt(prompt):
        raise AssertionError("Overlong route reached authentication instead of argument validation")
    monkeypatch.setattr(simulator, "getpass", unexpected_prompt)
    with pytest.raises(SystemExit):
        simulator.main(["--email", "vendor@example.com", "--share", "--steps", "100", "--interval", "60"])


@pytest.mark.integration
@pytest.mark.parametrize("fail_update", [False, True])
def test_simulator_uses_protected_routes_and_stops_after_success_or_error(simulator, monkeypatch, api, ready_vendor, database_sandbox, fail_update):
    monkeypatch.setattr(simulator, "getpass", lambda prompt: PASSWORD)
    monkeypatch.setattr(simulator.time, "sleep", lambda seconds: None)

    class Reply:
        def __init__(self, payload): self.payload = payload
        def __enter__(self): return self
        def __exit__(self, *args): pass
        def read(self): return self.payload

    def transport(request, timeout):
        path = urlsplit(request.full_url).path
        if fail_update and request.method == "PUT":
            raise HTTPError(request.full_url, 503, "Synthetic external transport failure", {}, None)
        response = api.request(request.method, path, headers=dict(request.headers), content=request.data)
        if response.status_code >= 400:
            raise HTTPError(request.full_url, response.status_code, "API rejected synthetic fix", {}, None)
        return Reply(response.content)

    monkeypatch.setattr(simulator, "urlopen", transport)
    result = simulator.main(["--email", "vendor@example.com", "--share", "--steps", "2", "--interval", ".1"])
    assert result == (1 if fail_update else 0)
    with database_sandbox.engine.connect() as connection:
        assert connection.scalar(text("SELECT count(*) FROM vendor_locations")) == 0
        assert not connection.scalar(text("SELECT is_available FROM vendor_profiles"))
