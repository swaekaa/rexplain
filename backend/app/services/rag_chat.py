"""
rag_chat.py
-----------
Phase 12: LLM-powered RAG answer orchestrator.

Flow:
  1. Receive retrieved chunks from vector store.
  2. Forward to Groq LLM via llm_service.
  3. Return structured response: { answer, sources, confidence }.

Fallback strategy (if LLM call fails):
  - Return a safe error message with empty sources.
"""

from __future__ import annotations

from app.services.llm_service import generate_answer


def answer_question(question: str, retrieved_chunks: list[dict]) -> dict:
    """
    Generate a grounded LLM answer from retrieved repository chunks.

    Args:
        question:          The user's question string.
        retrieved_chunks:  List of chunk dicts with keys: text, path, score.

    Returns:
        {
            "answer":     str,
            "sources":    list[str],   # deduplicated file paths
            "confidence": "high" | "medium" | "low"
        }
    """
    if not retrieved_chunks:
        return {
            "answer": (
                "Not enough repository evidence found. "
                "Try rephrasing your question or ask about a specific file, "
                "function, or feature in this repository."
            ),
            "sources": [],
            "confidence": "low",
        }

    try:
        return generate_answer(question, retrieved_chunks)
    except Exception as exc:
        print(f"[rag_chat] LLM call failed: {exc}")
        return {
            "answer": (
                "The AI assistant encountered an error while generating your answer. "
                "Please check your GROQ_API_KEY in the .env file and try again."
            ),
            "sources": [],
            "confidence": "low",
        }
