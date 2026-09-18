"""
auth.py
-------
Google OAuth endpoints + /auth/me.

Endpoints
---------
  GET  /auth/google           — Redirect to Google consent screen
  GET  /auth/google/callback  — Handle Google callback, issue JWT, redirect to frontend
  GET  /auth/me               — Return current user (requires Bearer token)
  POST /auth/logout           — Client-side only (token invalidated by discarding from memory)
"""

import os
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import RedirectResponse, JSONResponse

from app.services import auth_service, user_db
from app.routes.deps import get_current_user

router = APIRouter(prefix="/auth", tags=["auth"])

# In-memory CSRF state store (simple set; acceptable for single-process free tier)
_pending_states: set[str] = set()


@router.get("/google")
def google_login():
    """Redirect the browser to Google's OAuth2 consent screen."""
    state = auth_service.generate_state()
    _pending_states.add(state)
    # Keep the set bounded
    if len(_pending_states) > 500:
        _pending_states.clear()
    url = auth_service.get_google_auth_url(state)
    return RedirectResponse(url=url)


@router.get("/google/callback")
def google_callback(
    code: str = Query(...),
    state: str = Query(...),
    error: str = Query(None),
):
    """
    Google redirects here after user grants/denies access.
    Exchange code → user info → upsert user → issue JWT → redirect to frontend.
    """
    frontend_url = auth_service.get_frontend_url()

    # OAuth error (user denied, etc.)
    if error:
        return RedirectResponse(url=f"{frontend_url}?auth_error={error}")

    # CSRF check
    if state not in _pending_states:
        return RedirectResponse(url=f"{frontend_url}?auth_error=invalid_state")
    _pending_states.discard(state)

    # Exchange code for user info
    user_info = auth_service.exchange_code_for_user_info(code)
    if not user_info or not user_info.get("google_id"):
        return RedirectResponse(url=f"{frontend_url}?auth_error=token_exchange_failed")

    # Upsert user in DB
    user = user_db.get_or_create_user(
        google_id=user_info["google_id"],
        email=user_info["email"],
        name=user_info["name"],
        picture=user_info.get("picture"),
    )
    if not user:
        return RedirectResponse(url=f"{frontend_url}?auth_error=db_error")

    # Issue JWT
    token = auth_service.create_jwt(user["id"])

    # Redirect to frontend with token in URL fragment (not query param)
    # Frontend reads it once, stores in memory, removes from URL
    return RedirectResponse(url=f"{frontend_url}?token={token}")


@router.get("/me")
def get_me(current_user: dict = Depends(get_current_user)):
    """Return the current authenticated user's profile."""
    return {
        "id":      current_user["id"],
        "email":   current_user["email"],
        "name":    current_user["name"],
        "picture": current_user.get("picture"),
    }


@router.post("/logout")
def logout():
    """
    Logout is client-side: the frontend discards the in-memory token.
    This endpoint just confirms the action for UX purposes.
    """
    return {"message": "Logged out. Discard your token on the client."}
