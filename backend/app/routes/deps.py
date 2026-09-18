"""
deps.py
-------
Reusable FastAPI dependencies.

get_current_user()
  Reads the Authorization: Bearer <token> header.
  Verifies the JWT and returns the user dict.
  Raises 401 if missing or invalid.

get_optional_user()
  Same as get_current_user but returns None instead of raising 401.
  Use on endpoints that work for both anonymous and authenticated users
  (e.g., /analyze — anonymous still works, authenticated get persistence).
"""

from typing import Optional
from fastapi import Header, HTTPException

from app.services import auth_service, user_db


def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    """
    Require an authenticated user.
    Raises 401 if token is missing or invalid.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authentication required.")

    token = authorization.removeprefix("Bearer ").strip()
    user_id = auth_service.verify_jwt(token)
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid or expired token.")

    user = user_db.get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=401, detail="User not found.")

    return user


def get_optional_user(authorization: Optional[str] = Header(None)) -> Optional[dict]:
    """
    Optionally authenticate a user.
    Returns None (instead of raising) if unauthenticated.
    """
    if not authorization or not authorization.startswith("Bearer "):
        return None
    try:
        token = authorization.removeprefix("Bearer ").strip()
        user_id = auth_service.verify_jwt(token)
        if not user_id:
            return None
        return user_db.get_user_by_id(user_id)
    except Exception:
        return None
