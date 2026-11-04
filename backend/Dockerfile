FROM python:3.13-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app
COPY pyproject.toml requirements.lock ./
COPY app ./app
RUN pip install --no-cache-dir -c requirements.lock . \
    && useradd --create-home appuser

COPY alembic.ini ./
COPY migrations ./migrations
USER appuser
EXPOSE 8000
CMD ["uvicorn", "app.main:create_app", "--factory", "--host", "0.0.0.0", "--port", "8000", "--workers", "1", "--ws-max-size", "8192", "--ws-max-queue", "8"]

FROM base AS production

# The final/default target preserves the existing local test workflow. Production
# explicitly selects the previous target and never installs pytest/httpx2.
FROM base AS development
USER root
RUN pip install --no-cache-dir -c requirements.lock ".[test]" \
    && mkdir /app/.pytest_cache \
    && chown appuser:appuser /app/.pytest_cache
COPY tests ./tests
COPY scripts ./scripts
USER appuser
