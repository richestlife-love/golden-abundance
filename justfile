# Generate frontend OpenAPI schema types from the FastAPI app (no running server, no DB).
# Output: frontend/src/api/schema.d.ts (gitignored).
gen-types:
    uv run --project backend python -c 'import json; from backend.server import app; print(json.dumps(app.openapi()))' > /tmp/gal-openapi.json
    cd frontend && pnpm dlx openapi-typescript /tmp/gal-openapi.json -o src/api/schema.d.ts

# Generate frontend demo-account picker JSON from backend.seed.DEMO_USERS.
# Output: frontend/src/dev/demo-accounts.json (checked in).
gen-demo-accounts:
    uv run --project backend python -m backend.scripts.dump_demo_accounts > frontend/src/dev/demo-accounts.json

# Boot backend and frontend dev servers in parallel (Ctrl-C kills both).
dev:
    just -f backend/justfile dev & \
    pnpm -C frontend dev & \
    wait
