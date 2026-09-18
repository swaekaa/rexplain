"""
threads.py
----------
Thread and message management API.

All endpoints are authenticated (require Bearer token).
Thread ownership is enforced server-side on every operation.

Endpoints
---------
  GET    /threads                        — list user's threads (optionally filter by repo_url)
  POST   /threads                        — create a new thread
  GET    /threads/{thread_id}            — get a specific thread
  PATCH  /threads/{thread_id}            — rename a thread
  DELETE /threads/{thread_id}            — delete a thread + its messages

  GET    /threads/{thread_id}/messages   — get all messages (chronological)
  POST   /threads/{thread_id}/messages   — send a message + get AI response
"""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.routes.deps import get_current_user
from app.services import user_db

router = APIRouter(prefix="/threads", tags=["threads"])


# ── Pydantic schemas ──────────────────────────────────────────────────────────

class CreateThreadRequest(BaseModel):
    repo_url: str
    title: Optional[str] = None


class RenameThreadRequest(BaseModel):
    title: str


class SendMessageRequest(BaseModel):
    content: str


# ── Thread CRUD ───────────────────────────────────────────────────────────────

@router.get("")
def list_threads(
    repo_url: Optional[str] = Query(None, description="Filter by repository URL"),
    current_user: dict = Depends(get_current_user),
):
    """List the authenticated user's threads, optionally filtered by repo_url."""
    threads = user_db.get_threads_for_user(
        user_id=current_user["id"],
        repo_url=repo_url,
    )
    return threads


@router.post("")
def create_thread(
    body: CreateThreadRequest,
    current_user: dict = Depends(get_current_user),
):
    """Create a new conversation thread for a repository."""
    # Normalize repo_url
    repo_url = body.repo_url.strip().rstrip("/")
    if not repo_url:
        raise HTTPException(status_code=400, detail="repo_url is required.")

    title = (body.title or "New Conversation").strip() or "New Conversation"

    thread = user_db.create_thread(
        user_id=current_user["id"],
        repo_url=repo_url,
        title=title,
    )
    if not thread:
        raise HTTPException(status_code=500, detail="Failed to create thread.")
    return thread


@router.get("/{thread_id}")
def get_thread(
    thread_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Get a specific thread (ownership enforced)."""
    thread = user_db.get_thread(thread_id, current_user["id"])
    if not thread:
        raise HTTPException(status_code=404, detail="Thread not found.")
    return thread


@router.patch("/{thread_id}")
def rename_thread(
    thread_id: str,
    body: RenameThreadRequest,
    current_user: dict = Depends(get_current_user),
):
    """Rename a thread."""
    title = body.title.strip()
    if not title:
        raise HTTPException(status_code=400, detail="Title cannot be empty.")

    ok = user_db.rename_thread(thread_id, current_user["id"], title)
    if not ok:
        raise HTTPException(status_code=404, detail="Thread not found.")
    return {"message": "Thread renamed.", "title": title}


@router.delete("/{thread_id}")
def delete_thread(
    thread_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Delete a thread and all its messages (CASCADE)."""
    ok = user_db.delete_thread(thread_id, current_user["id"])
    if not ok:
        raise HTTPException(status_code=404, detail="Thread not found.")
    return {"message": "Thread deleted."}


# ── Messages ──────────────────────────────────────────────────────────────────

@router.get("/{thread_id}/messages")
def get_messages(
    thread_id: str,
    current_user: dict = Depends(get_current_user),
):
    """
    Get all messages for a thread in chronological order.
    Returns 404 if the thread doesn't exist or belongs to another user.
    """
    # Ownership check happens inside get_messages via get_thread
    thread = user_db.get_thread(thread_id, current_user["id"])
    if not thread:
        raise HTTPException(status_code=404, detail="Thread not found.")

    messages = user_db.get_messages(thread_id, current_user["id"])
    return messages


@router.post("/{thread_id}/messages")
def send_message(
    thread_id: str,
    body: SendMessageRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Send a user message to a thread and get an AI response.

    Steps:
    1. Verify thread ownership.
    2. Persist user message.
    3. Auto-title thread from first message (if title is still default).
    4. Retrieve RAG context for the repository.
    5. Get AI answer.
    6. Persist assistant message.
    7. Update thread updated_at.
    8. Return assistant message.
    """
    content = body.content.strip()
    if not content:
        raise HTTPException(status_code=400, detail="Message content cannot be empty.")

    # 1. Verify ownership + get repo_url
    thread = user_db.get_thread(thread_id, current_user["id"])
    if not thread:
        raise HTTPException(status_code=404, detail="Thread not found.")

    repo_url = thread["repo_url"]

    # 2. Persist user message
    user_db.add_message(thread_id=thread_id, role="user", content=content)

    # 3. Auto-title from first message
    existing = user_db.get_messages(thread_id, current_user["id"])
    user_messages = [m for m in existing if m["role"] == "user"]
    if len(user_messages) == 1 and thread["title"] in ("New Conversation", "Initial Analysis"):
        user_db.auto_title_thread(thread_id, current_user["id"], content)

    # 4. RAG context
    from app.services.retriever import get_store, query_store
    from app.services.embeddings import get_model
    import app.services.cache_db as cache_db

    store = get_store(repo_url)
    if store is None or store.size == 0:
        # Try DB restore
        if cache_db.is_available():
            cached = cache_db.get_cached_analysis(repo_url)
            if cached and cached.get("embeddings") is not None:
                from app.services.retriever import restore_store
                try:
                    store = restore_store(repo_url, cached["embeddings"], cached["chunks"])
                except Exception:
                    pass

    retrieved = []
    if store and store.size > 0:
        model = get_model()
        retrieved = query_store(store, content, model, top_k=8)

    # 5. AI answer (non-streaming for simplicity on thread endpoint)
    from app.services.rag_chat import answer_question
    result = answer_question(content, retrieved)
    answer_text = result.get("answer", "")

    # 6. Persist assistant message
    assistant_msg = user_db.add_message(
        thread_id=thread_id,
        role="assistant",
        content=answer_text,
    )

    # 7. Update thread timestamp
    user_db.touch_thread_timestamp(thread_id)

    # 8. Return
    return {
        "message":   assistant_msg,
        "sources":   result.get("sources", []),
        "confidence": result.get("confidence", "medium"),
    }
