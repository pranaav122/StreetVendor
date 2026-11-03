import pytest
from pydantic import SecretStr

from app.notifications.provider import (
    ExpoProvider,
    ProviderError,
    SEND_URL,
    RECEIPTS_URL,
)


def test_provider_is_disabled_without_credentials_and_never_calls_transport(settings):
    def unexpected_transport(*args):
        raise AssertionError("Disabled provider attempted external delivery")

    provider = ExpoProvider(settings, unexpected_transport)
    assert not provider.enabled
    with pytest.raises(ProviderError) as error:
        provider.send([{"to": "synthetic-address"}])
    assert error.value.code == "PUSH_NOT_CONFIGURED" and not error.value.retryable


def test_expo_adapter_validates_ticket_shape_and_keeps_credentials_in_headers(settings):
    calls = []

    def transport(url, body, headers):
        calls.append((url, body, headers))
        return (
            {"data": [{"status": "ok", "id": "synthetic-ticket"}]}
            if url == SEND_URL
            else {"data": {"synthetic-ticket": {"status": "ok"}}}
        )

    config = settings.model_copy(
        update={"expo_access_token": SecretStr("unit-test-provider-key")}
    )
    provider = ExpoProvider(config, transport)
    assert provider.send([{"to": "synthetic-address"}])[0]["id"] == "synthetic-ticket"
    assert provider.receipts(["synthetic-ticket"])["synthetic-ticket"]["status"] == "ok"
    assert calls[0][2]["Authorization"] == "Bearer unit-test-provider-key"
    assert "unit-test-provider-key" not in calls[0][
        0
    ] and "unit-test-provider-key" not in str(calls[0][1])
    broken = ExpoProvider(config, lambda *args: {"data": []})
    with pytest.raises(ProviderError):
        broken.send([{"to": "synthetic-address"}])
    with pytest.raises(ProviderError):
        broken.receipts(["synthetic-ticket"])
