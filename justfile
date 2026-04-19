default: serve

# Install frontend deps (idempotent; npm ci-style when lockfile present).
install:
    npm --prefix frontend install

# Run the Vite dev server on http://localhost:8000
serve: install
    npm --prefix frontend run dev

# Type-check and build the production bundle into frontend/dist
build: install
    npm --prefix frontend run build

# Format frontend sources with Prettier
fmt: install
    npm --prefix frontend run format

# Verify formatting (CI-ready; exits non-zero on drift)
fmt-check: install
    npm --prefix frontend run format:check

# Expose local port 8000 (https) via a reserved ngrok hostname
tunnel:
    ngrok http --url=subvitalized-occupative-katelyn.ngrok-free.dev --scheme=https 8000
