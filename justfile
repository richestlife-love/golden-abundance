mod backend
mod frontend

# Refresh the committed OpenAPI snapshot (frontend/openapi.json) and regenerate frontend/src/api/schema.d.ts from it.
# Commit the updated openapi.json; schema.d.ts is gitignored and regenerated from the snapshot at build time.
gen-types:
    uv run --project backend python -c 'import json; from backend.server import app; print(json.dumps(app.openapi(), indent=2))' > frontend/openapi.json
    pnpm -C frontend exec openapi-typescript openapi.json -o src/api/schema.d.ts
