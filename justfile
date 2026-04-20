mod backend
mod frontend

# Generate frontend OpenAPI types (writes frontend/src/api/schema.d.ts, gitignored; no running server or DB needed).
gen-types:
    uv run --project backend python -c 'import json; from backend.server import app; print(json.dumps(app.openapi()))' > /tmp/gal-openapi.json
    pnpm dlx openapi-typescript /tmp/gal-openapi.json -o frontend/src/api/schema.d.ts

# Generate frontend demo-account picker JSON from backend.seed.DEMO_USERS (writes frontend/src/dev/demo-accounts.json, checked in).
gen-demo-accounts:
    uv run --project backend python -m backend.scripts.dump_demo_accounts > frontend/src/dev/demo-accounts.json

# Boot backend and frontend dev servers in parallel (Ctrl-C kills both).
dev:
    just backend dev & \
    just frontend dev & \
    wait
