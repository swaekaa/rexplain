"""
chat.py
-------
Phase 11: POST /chat/ — repository-aware RAG chatbot endpoint.

The vector store is built once during /analyze/ and reused here.
Requires the repo to have been analyzed first.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services.retriever import get_store, query_store
from app.services.embeddings import get_model
from app.services.rag_chat import answer_question

router = APIRouter(prefix="/chat", tags=["chat"])


class ChatRequest(BaseModel):
    repo_url: str
    question: str


@router.post("/")
def chat(request: ChatRequest):
    """
    Answer a question about the analyzed repository using RAG.

    Returns:
        { "answer": str, "sources": list[str] }

    Raises:
        404 — repository not yet analyzed
        400 — empty question
    """
    repo_url = request.repo_url.strip().rstrip("/")
    question = request.question.strip()

    if not question:
        raise HTTPException(status_code=400, detail="Question cannot be empty.")

    store = get_store(repo_url)
    if store is None or store.size == 0:
        raise HTTPException(
            status_code=404,
            detail=(
                "No analysis found for this repository. "
                "Please run an analysis first, then ask questions."
            ),
        )

    model = get_model()
    retrieved = query_store(store, question, model, top_k=5)
    result = answer_question(question, retrieved)

    return result
