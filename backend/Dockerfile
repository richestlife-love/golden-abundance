# syntax=docker/dockerfile:1.7

FROM debian:trixie-slim AS build

COPY --from=ghcr.io/astral-sh/uv:0.11.7 /uv /uvx /usr/local/bin/

# LINK_MODE=copy is required with the cache mount below; hardlinks from the
# mount wouldn't survive into the image layer.
ARG UV_COMPILE_BYTECODE=1
ARG UV_LINK_MODE=copy

ENV UV_PYTHON_INSTALL_DIR=/opt/uv/python \
    UV_PYTHON_PREFERENCE=only-managed \
    PYTHONDONTWRITEBYTECODE=1

# ca-certificates is required for uv's TLS fetch of the Python build.
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Manifests first so a source-only change doesn't bust the deps layer.
COPY pyproject.toml uv.lock .python-version ./

RUN --mount=type=cache,id=uv,target=/root/.cache/uv \
    uv sync --frozen --no-dev --no-install-project

# --no-editable installs `backend` as a real wheel so the venv is
# self-contained and safe to copy into the runtime stage.
COPY src/ src/
RUN --mount=type=cache,id=uv,target=/root/.cache/uv \
    uv sync --frozen --no-dev --no-editable

COPY alembic/ alembic/
COPY alembic.ini ./

FROM debian:trixie-slim AS runtime

# psycopg's binary wheel bundles libpq, so the system lib is only a fallback
# for unexpected dlopen paths. Pin to match our Postgres 17 server so a
# future Debian upgrade can't silently drop a minor-version ABI.
RUN apt-get update \
    && apt-get install -y --no-install-recommends 'libpq5=17.*' \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

RUN useradd --create-home --uid 1000 app
USER app

# The venv's python shim symlinks into /opt/uv/python; both trees must ship.
COPY --from=build /opt/uv/python /opt/uv/python
COPY --from=build --chown=app:app /app/.venv /app/.venv
COPY --from=build --chown=app:app /app/alembic /app/alembic
COPY --from=build --chown=app:app /app/alembic.ini /app/alembic.ini

ENV PATH="/app/.venv/bin:${PATH}" \
    PYTHONUNBUFFERED=1 \
    PORT=8000

EXPOSE 8000

# Railway uses its own /readyz probes; this exists for docker-compose / docker run.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=3)" || exit 1

# If alembic fails the container exits non-zero and Railway keeps the
# previous deployment live. `exec` ensures SIGTERM reaches uvicorn for
# graceful shutdown rather than being swallowed by sh.
CMD ["sh", "-c", "alembic upgrade head && exec uvicorn backend.server:app --host 0.0.0.0 --port ${PORT}"]
