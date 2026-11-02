"""Return useful error categories without exposing submitted secrets or SQL."""

from uuid import uuid4

from fastapi import HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse


def problem(status: int, code: str, message: str, headers: dict | None = None) -> HTTPException:
    return HTTPException(status_code=status, detail={"code": code, "message": message}, headers=headers)


async def http_error(request: Request, error: HTTPException) -> JSONResponse:
    detail = error.detail if isinstance(error.detail, dict) else {"code": "HTTP_ERROR", "message": str(error.detail)}
    return JSONResponse(status_code=error.status_code, headers=error.headers,
                        content={"error": {**detail, "request_id": str(uuid4())}})


async def validation_error(request: Request, error: RequestValidationError) -> JSONResponse:
    # Pydantic normally includes each rejected input; passwords must never echo back.
    fields = [{"path": list(item["loc"]), "message": item["msg"], "type": item["type"]}
              for item in error.errors()]
    return JSONResponse(status_code=422, content={"error": {
        "code": "VALIDATION_ERROR", "message": "Check the submitted fields.",
        "request_id": str(uuid4()), "fields": fields,
    }})
