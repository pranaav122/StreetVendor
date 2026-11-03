"""Expo transport with bounded responses and no credential/body logging."""

import json
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

SEND_URL = "https://exp.host/--/api/v2/push/send"
RECEIPTS_URL = "https://exp.host/--/api/v2/push/getReceipts"


class ProviderError(Exception):
    def __init__(self, code, retryable=True):
        super().__init__(code)
        self.code, self.retryable = code, retryable


def post_json(url, payload, headers):
    request = Request(
        url,
        method="POST",
        headers=headers,
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
    )
    try:
        with urlopen(request, timeout=5) as response:
            raw = response.read(1024 * 1024 + 1)
    except HTTPError as error:
        raise ProviderError(
            f"HTTP_{error.code}", error.code == 429 or error.code >= 500
        ) from None
    except (URLError, TimeoutError, OSError):
        raise ProviderError("TRANSPORT_UNAVAILABLE") from None
    if len(raw) > 1024 * 1024:
        raise ProviderError("RESPONSE_TOO_LARGE")
    try:
        value = json.loads(raw)
    except (ValueError, UnicodeError):
        raise ProviderError("INVALID_RESPONSE") from None
    if not isinstance(value, dict) or "errors" in value:
        raise ProviderError("INVALID_RESPONSE")
    return value


class ExpoProvider:
    def __init__(self, settings, transport=post_json):
        self.settings, self.transport = settings, transport

    @property
    def enabled(self):
        return self.settings.expo_access_token is not None and bool(
            self.settings.expo_access_token.get_secret_value()
        )

    def _post(self, url, payload):
        if not self.enabled:
            raise ProviderError("PUSH_NOT_CONFIGURED", False)
        return self.transport(
            url,
            payload,
            {
                "Content-Type": "application/json",
                "Accept": "application/json",
                "Authorization": "Bearer "
                + self.settings.expo_access_token.get_secret_value(),
            },
        )

    def send(self, messages):
        if not 1 <= len(messages) <= 100:
            raise ProviderError("INVALID_BATCH", False)
        result = self._post(SEND_URL, messages).get("data")
        if isinstance(result, dict) and len(messages) == 1 and "status" in result:
            result = [result]
        if (
            not isinstance(result, list)
            or len(result) != len(messages)
            or any(not isinstance(item, dict) for item in result)
        ):
            raise ProviderError("INVALID_TICKETS")
        return result

    def receipts(self, ids):
        if not 1 <= len(ids) <= 1000:
            raise ProviderError("INVALID_RECEIPT_BATCH", False)
        result = self._post(RECEIPTS_URL, {"ids": ids}).get("data")
        if not isinstance(result, dict):
            raise ProviderError("INVALID_RECEIPTS")
        return result
