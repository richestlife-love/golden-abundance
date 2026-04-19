default: serve

# Serve the design prototype on http://localhost:{{port}}
serve port="8000":
    uv run --no-project python -m http.server {{port}} --directory claude-design-handoff/project
