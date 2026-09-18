"""
repositories.py
---------------
User repository history API.

Endpoints
---------
  GET  /repositories         — list repos the authenticated user has analyzed
"""

from fastapi import APIRouter, Depends, HTTPException

from app.routes.deps import get_current_user
from app.services import user_db
import app.services.cache_db as cache_db

router = APIRouter(prefix="/repositories", tags=["repositories"])


@router.get("")
def list_repositories(current_user: dict = Depends(get_current_user)):
    """
    Return all repositories the authenticated user has analyzed,
    most recently accessed first.

    Also enriches each entry with thread_count from the threads table.
    """
    repos = user_db.get_user_repositories(user_id=current_user["id"])

    # Enrich with thread count per repo
    enriched = []
    for repo in repos:
        threads = user_db.get_threads_for_user(
            user_id=current_user["id"],
            repo_url=repo["repo_url"],
        )
        repo["thread_count"] = len(threads)

        # Optionally add repo_name (last part of URL)
        url = repo["repo_url"]
        parts = url.rstrip("/").split("/")
        repo["repo_name"] = parts[-1] if parts else url
        repo["repo_owner"] = parts[-2] if len(parts) >= 2 else ""

        enriched.append(repo)

    return enriched
