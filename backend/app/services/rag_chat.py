"""
rag_chat.py
-----------
Phase 11: Rule-based answer synthesis from retrieved chunks.

Strategy:
  1. Tokenise the user question (remove stopwords).
  2. Score each retrieved chunk by token overlap with the question.
  3. Extract the most relevant sentences from the top-scoring chunks.
  4. Assemble a clean, deduplicated answer.
  5. Return answer text + deduplicated source file list.

No LLM required — purely extractive QA from repository context.
"""

from __future__ import annotations

import re

# ── Stopwords (minimal English set) ─────────────────────────────────────────

_STOPWORDS = {
    "a", "an", "the", "is", "are", "was", "were",
    "in", "of", "to", "for", "on", "at", "by",
    "this", "that", "these", "those", "it", "its",
    "what", "where", "how", "which", "does", "do",
    "be", "been", "being", "have", "has", "had",
    "with", "from", "or", "and", "but", "not",
    "can", "will", "would", "should", "could",
    "me", "my", "i", "we", "our", "you", "your",
}


def _tokenise(text: str) -> set[str]:
    tokens = re.findall(r"\w+", text.lower())
    return {t for t in tokens if t not in _STOPWORDS and len(t) > 1}


def _score_chunk(chunk_text: str, q_tokens: set[str]) -> float:
    chunk_tokens = _tokenise(chunk_text)
    if not q_tokens:
        return 0.0
    hits = len(q_tokens & chunk_tokens)
    return hits / len(q_tokens)


def _best_sentences(text: str, q_tokens: set[str], max_sent: int = 3) -> list[str]:
    """Extract the most query-relevant sentences from a chunk."""
    # Split on sentence boundaries (. ! ?) or newlines
    raw_sents = re.split(r"(?<=[.!?])\s+|\n{1,2}", text)
    scored: list[tuple[float, str]] = []
    for s in raw_sents:
        s = s.strip()
        if len(s) < 20:
            continue
        score = _score_chunk(s, q_tokens)
        if score > 0:
            scored.append((score, s))

    scored.sort(key=lambda x: x[0], reverse=True)
    seen: set[str] = set()
    result: list[str] = []
    for _, s in scored[:max_sent * 2]:
        if s not in seen:
            seen.add(s)
            result.append(s)
        if len(result) >= max_sent:
            break
    return result


def answer_question(question: str, retrieved_chunks: list[dict]) -> dict:
    """
    Synthesise an answer from retrieved chunks.

    Returns:
        {
            "answer": str,
            "sources": list[str]   # deduplicated file paths
        }
    """
    if not retrieved_chunks:
        return {
            "answer": (
                "I couldn't find relevant information in this repository "
                "to answer that question. Try rephrasing or ask about a "
                "specific file, function, or feature."
            ),
            "sources": [],
        }

    q_tokens = _tokenise(question)
    sources = list(dict.fromkeys(c["path"] for c in retrieved_chunks))   # ordered dedup

    # ── Score chunks by keyword overlap ──────────────────────────────────────
    scored_chunks = sorted(
        retrieved_chunks,
        key=lambda c: _score_chunk(c["text"], q_tokens),
        reverse=True,
    )

    # ── Extract best sentences from top chunks ────────────────────────────────
    answer_sentences: list[str] = []
    seen: set[str] = set()

    for chunk in scored_chunks[:4]:
        sents = _best_sentences(chunk["text"], q_tokens, max_sent=3)
        for s in sents:
            if s not in seen and len(answer_sentences) < 6:
                seen.add(s)
                answer_sentences.append(s)

    # ── Assemble final answer ─────────────────────────────────────────────────
    if answer_sentences:
        answer = " ".join(answer_sentences)
        if len(answer) > 900:
            answer = answer[:900].rstrip() + "…"
    else:
        # Fallback: excerpt from the highest-scoring chunk
        top_text = scored_chunks[0]["text"].strip()
        answer = top_text[:600].rstrip()
        if len(top_text) > 600:
            answer += "…"
        answer = f"Based on the repository:\n\n{answer}"

    # Clean internal newlines for chat display
    answer = re.sub(r"\n{3,}", "\n\n", answer)

    return {
        "answer": answer,
        "sources": [s for s in sources if not s.startswith("_analysis/")][:5],
    }
