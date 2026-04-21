"""Authentication helpers: Supabase JWKS-based JWT verification.

Real OAuth flow is owned by the frontend's Supabase SDK; the backend
only verifies incoming ``Authorization: Bearer`` tokens against
Supabase's published JWKS.
"""
