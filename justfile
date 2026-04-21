mod backend
mod frontend

# Generate frontend OpenAPI types (writes frontend/src/api/schema.d.ts, gitignored; no running server or DB needed).
gen-types:
    uv run --project backend python -c 'import json; from backend.server import app; print(json.dumps(app.openapi()))' > /tmp/ga-openapi.json
    pnpm dlx openapi-typescript /tmp/ga-openapi.json -o frontend/src/api/schema.d.ts
