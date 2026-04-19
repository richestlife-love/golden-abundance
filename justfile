default: serve

# Serve the design prototype on http://localhost:{{port}}
serve port="8000":
    uv run --no-project python -m http.server {{port}} --directory frontend

# Expose local port 8000 (https) via a reserved ngrok hostname
tunnel:
    ngrok http --url=subvitalized-occupative-katelyn.ngrok-free.dev --scheme=https 8000
