# syntax=docker/dockerfile:1.7

FROM debian:trixie-slim AS build

COPY --from=ghcr.io/astral-sh/uv:0.11.7 /uv /uvx /usr/local/bin/

ENV UV_COMPILE_BYTECODE=1 \
    UV_PYTHON_INSTALL_DIR=/opt/uv/python \
    UV_PYTHON_PREFERENCE=only-managed \
    PYTHONDONTWRITEBYTECODE=1

# ca-certificates is required for uv's TLS fetch of the Python build.
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Manifests first so a source-only change doesn't bust the deps layer.
COPY pyproject.toml uv.lock .python-version ./

RUN uv sync --frozen --no-dev --no-install-project

# --no-editable installs `backend` as a real wheel so the venv is
# self-contained and safe to copy into the runtime stage.
COPY src/ src/
RUN uv sync --frozen --no-dev --no-editable

COPY alembic/ alembic/
COPY alembic.ini ./

FROM debian:trixie-slim AS runtime

# psycopg's binary wheel bundles libpq, so the system lib is only a fallback
# for unexpected dlopen paths. Pin to match our Postgres 17 server so a
# future Debian upgrade can't silently drop a minor-version ABI.
# ca-certificates is required for PyJWKClient to verify Supabase's JWKS URL
# (outbound HTTPS from the running app); without it, urllib fails every TLS
# handshake with CERTIFICATE_VERIFY_FAILED.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates \
        'libpq5=17.*' \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

RUN useradd --create-home --uid 1000 app
USER app

# The venv's python shim symlinks into /opt/uv/python; both trees must ship.
COPY --from=build /opt/uv/python /opt/uv/python
COPY --from=build --chown=app:app /app/.venv /app/.venv
COPY --from=build --chown=app:app /app/alembic /app/alembic
COPY --from=build --chown=app:app /app/alembic.ini /app/alembic.ini

ARG RAILWAY_GIT_COMMIT_SHA=""
ENV PATH="/app/.venv/bin:${PATH}" \
    PYTHONUNBUFFERED=1 \
    PORT=8000 \
    APP_RELEASE=$RAILWAY_GIT_COMMIT_SHA

EXPOSE 8000

# Migrations run in Railway's Pre-Deploy Command (`alembic upgrade head`),
# not here — a failed migration aborts the deploy before the app container
# starts, and parallel instances can't race each other on DDL.
CMD ["sh", "-c", "exec uvicorn backend.server:app --host 0.0.0.0 --port ${PORT}"]
