# syntax=docker/dockerfile:1.7

# -------- build stage --------
FROM python:3.14-slim AS build

ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

RUN pip install --no-cache-dir uv==0.11.7

WORKDIR /app

# Copy manifests first for layer caching: a source-only change doesn't bust the deps layer.
COPY pyproject.toml uv.lock ./

RUN uv sync --frozen --no-dev --no-install-project

# Now copy the project + sync again to install the project itself.
COPY . .
RUN uv sync --frozen --no-dev

# -------- runtime stage --------
FROM python:3.14-slim AS runtime

# libpq for psycopg. The binary wheel bundles its own libpq at wheel-build
# time, so the system lib is only the safety net for any unexpected
# dlopen path. Pin to the major that matches our server (Postgres 17) so a
# future Debian upgrade can't silently drop a minor-version ABI.
RUN apt-get update \
    && apt-get install -y --no-install-recommends 'libpq5=17.*' \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Non-root user — Railway doesn't require it but it's cheap hygiene.
RUN useradd --create-home --uid 1000 app
USER app

COPY --from=build --chown=app:app /app /app

ENV PATH="/app/.venv/bin:${PATH}" \
    PYTHONPATH="/app/src" \
    PYTHONUNBUFFERED=1 \
    PORT=8000

EXPOSE 8000

# Local Docker healthcheck for `docker-compose` / `docker run`. Railway
# runs its own probes against /readyz so this is mostly defensive.
# Uses the bundled Python interpreter to avoid adding curl to the image.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=3)" || exit 1

# Alembic runs migrations idempotently on every container start. If the migration
# fails, the container exits non-zero → Railway keeps the previous deployment live.
# `exec` on the uvicorn step replaces the sh process so SIGTERM from Railway
# reaches uvicorn directly (rather than relying on dash's implicit-exec
# optimization for the last command), enabling graceful shutdown on deploys.
CMD ["sh", "-c", "alembic upgrade head && exec uvicorn backend.server:app --host 0.0.0.0 --port ${PORT}"]
