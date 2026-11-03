FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app
COPY pyproject.toml requirements.lock ./
COPY app ./app
RUN pip install --no-cache-dir -c requirements.lock ".[test]" \
    && useradd --create-home appuser \
    && mkdir /app/.pytest_cache \
    && chown appuser:appuser /app/.pytest_cache

COPY alembic.ini ./
COPY migrations ./migrations
COPY tests ./tests
COPY scripts ./scripts

USER appuser
EXPOSE 8000
CMD ["uvicorn", "app.main:create_app", "--factory", "--host", "0.0.0.0", "--port", "8000"]
