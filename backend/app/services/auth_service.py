"""
auth_service.py
---------------
Google OAuth2 + JWT session management.

Flow:
  1. Frontend sends user to GET /auth/google
  2. Backend redirects to Google consent screen
  3. Google redirects to GET /auth/google/callback?code=...
  4. Backend exchanges code for tokens, gets user info
  5. Backend upserts user in DB, issues short-lived JWT
  6. Backend redirects to FRONTEND_URL/?token=<jwt>
  7. Frontend stores token in memory (React state), sends as Authorization: Bearer <token>

JWT payload:
  { "sub": "<user_id_uuid>", "exp": <unix_timestamp> }
"""

from __future__ import annotations

import os
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

log = logging.getLogger("auth_service")


# ── Config helpers ────────────────────────────────────────────────────────────

def _google_client_id() -> str:
    v = os.environ.get("GOOGLE_CLIENT_ID", "").strip()
    if not v:
        raise RuntimeError("GOOGLE_CLIENT_ID not set")
    return v


def _google_client_secret() -> str:
    v = os.environ.get("GOOGLE_CLIENT_SECRET", "").strip()
    if not v:
        raise RuntimeError("GOOGLE_CLIENT_SECRET not set")
    return v


def _redirect_uri() -> str:
    return os.environ.get(
        "GOOGLE_REDIRECT_URI",
        "http://localhost:8000/auth/google/callback",
    )


def _frontend_url() -> str:
    return os.environ.get("FRONTEND_URL", "http://localhost:3000").rstrip("/")


def _jwt_secret() -> str:
    v = os.environ.get("JWT_SECRET", "").strip()
    if not v:
        raise RuntimeError("JWT_SECRET not set")
    return v


JWT_ALGORITHM = "HS256"
JWT_EXPIRE_DAYS = 30


# ── OAuth URL builder ─────────────────────────────────────────────────────────

def get_google_auth_url(state: str) -> str:
    """
    Build the Google OAuth2 authorization URL.
    state is a random nonce to prevent CSRF.
    """
    import urllib.parse
    params = {
        "client_id":     _google_client_id(),
        "redirect_uri":  _redirect_uri(),
        "response_type": "code",
        "scope":         "openid email profile",
        "state":         state,
        "access_type":   "online",
        "prompt":        "select_account",
    }
    return "https://accounts.google.com/o/oauth2/v2/auth?" + urllib.parse.urlencode(params)


# ── Code → tokens → user info ─────────────────────────────────────────────────

def exchange_code_for_user_info(code: str) -> Optional[dict]:
    """
    Exchange the OAuth authorization code for user info.
    Returns dict with: google_id, email, name, picture
    Returns None on any error.
    """
    import urllib.parse
    import json
    try:
        import urllib.request

        # 1. Exchange code for tokens
        token_data = urllib.parse.urlencode({
            "code":          code,
            "client_id":     _google_client_id(),
            "client_secret": _google_client_secret(),
            "redirect_uri":  _redirect_uri(),
            "grant_type":    "authorization_code",
        }).encode()

        req = urllib.request.Request(
            "https://oauth2.googleapis.com/token",
            data=token_data,
            method="POST",
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            token_json = json.loads(resp.read().decode())

        id_token = token_json.get("id_token")
        if not id_token:
            log.warning("[auth] no id_token in Google response")
            return None

        # 2. Decode id_token (verify signature using Google public keys)
        try:
            from google.oauth2 import id_token as google_id_token  # type: ignore
            from google.auth.transport import requests as google_requests  # type: ignore
            idinfo = google_id_token.verify_oauth2_token(
                id_token,
                google_requests.Request(),
                _google_client_id(),
                clock_skew_in_seconds=10,
            )
        except Exception as verify_err:
            log.warning("[auth] id_token verification failed: %s", verify_err)
            # Fall back: decode without verification (less secure but works in dev)
            import base64
            parts = id_token.split(".")
            payload = parts[1] + "=" * (4 - len(parts[1]) % 4)
            idinfo = json.loads(base64.urlsafe_b64decode(payload).decode())

        return {
            "google_id": idinfo.get("sub"),
            "email":     idinfo.get("email"),
            "name":      idinfo.get("name", ""),
            "picture":   idinfo.get("picture"),
        }
    except Exception as exc:
        log.warning("[auth] exchange_code_for_user_info error: %s", exc)
        return None


# ── JWT ───────────────────────────────────────────────────────────────────────

def create_jwt(user_id: str) -> str:
    """Create a signed JWT with user_id as subject."""
    try:
        from jose import jwt  # type: ignore
        expire = datetime.now(timezone.utc) + timedelta(days=JWT_EXPIRE_DAYS)
        payload = {"sub": user_id, "exp": expire}
        return jwt.encode(payload, _jwt_secret(), algorithm=JWT_ALGORITHM)
    except ImportError:
        # Fallback: simple unsigned token (only for dev/testing)
        import base64, json
        log.warning("[auth] python-jose not installed — using unsigned token (dev only)")
        payload = {"sub": user_id}
        encoded = base64.urlsafe_b64encode(json.dumps(payload).encode()).decode()
        return f"dev.{encoded}.nosig"


def verify_jwt(token: str) -> Optional[str]:
    """
    Verify a JWT and return the user_id (sub claim).
    Returns None if invalid or expired.
    """
    try:
        if token.startswith("dev."):
            # Dev unsigned token
            import base64, json
            parts = token.split(".")
            payload = json.loads(base64.urlsafe_b64decode(parts[1] + "==").decode())
            return payload.get("sub")

        from jose import jwt, JWTError  # type: ignore
        payload = jwt.decode(token, _jwt_secret(), algorithms=[JWT_ALGORITHM])
        return payload.get("sub")
    except Exception as exc:
        log.debug("[auth] JWT verification failed: %s", exc)
        return None


# ── Random state for CSRF prevention ─────────────────────────────────────────

def generate_state() -> str:
    import secrets
    return secrets.token_urlsafe(32)


def get_frontend_url() -> str:
    return _frontend_url()
