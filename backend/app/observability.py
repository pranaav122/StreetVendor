"""Bounded request metadata; never log query strings, bodies or credentials."""

import json
import logging
import time
from datetime import datetime, timezone
from uuid import uuid4

from starlette.responses import JSONResponse

logger = logging.getLogger("app.requests")


class JsonFormatter(logging.Formatter):
    def format(self, record):
        data = {
            "time": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            # Third-party messages/tracebacks can embed SQL, URLs and secrets.
            "event": record.getMessage()
            if record.name == "app.requests"
            else "component_log",
        }
        for field in (
            "request_id",
            "route",
            "method",
            "status",
            "duration_ms",
            "error_type",
        ):
            if hasattr(record, field):
                data[field] = getattr(record, field)
        return json.dumps(data, separators=(",", ":"))


def configure_json_logging():
    handler = logging.StreamHandler()
    handler.setFormatter(JsonFormatter())
    root = logging.getLogger()
    root.handlers = [handler]
    root.setLevel(logging.INFO)
    for name in ("uvicorn", "uvicorn.error", "uvicorn.access"):
        component = logging.getLogger(name)
        component.handlers = []
        component.propagate = True
    logging.getLogger("uvicorn.access").disabled = True
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)


class RequestLogMiddleware:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        request_id = str(uuid4())
        scope.setdefault("state", {})["request_id"] = request_id
        started = time.monotonic()
        status = 500
        sent = False

        async def send_response(message):
            nonlocal status, sent
            if message["type"] == "http.response.start":
                sent = True
                status = message["status"]
                headers = [
                    (key, value)
                    for key, value in message.get("headers", [])
                    if key.lower() != b"x-request-id"
                ]
                message["headers"] = [
                    *headers,
                    (b"x-request-id", request_id.encode("ascii")),
                ]
            await send(message)

        try:
            await self.app(scope, receive, send_response)
        except Exception as error:
            logger.error(
                "request_failed",
                extra={"request_id": request_id, "error_type": type(error).__name__},
            )
            if sent:
                raise
            # Unknown failures must not return a debug traceback or submitted data.
            response = JSONResponse(
                status_code=500,
                content={
                    "error": {
                        "code": "INTERNAL_ERROR",
                        "message": "The request could not be completed.",
                        "request_id": request_id,
                    }
                },
            )
            await response(scope, receive, send_response)
        finally:
            route = scope.get("route")
            logger.info(
                "request_complete",
                extra={
                    "request_id": request_id,
                    "route": getattr(route, "path", "unmatched"),
                    "method": scope["method"],
                    "status": status,
                    "duration_ms": round((time.monotonic() - started) * 1000, 2),
                },
            )
