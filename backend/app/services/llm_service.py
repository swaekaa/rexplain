"""
llm_service.py
--------------
Phase 12: Groq LLM integration for production-grade RAG.

Sends retrieved repo chunks + user question to Groq LLM.
Returns structured JSON: { answer, sources, confidence }.

Rules enforced in prompt:
  - Answer ONLY from repository evidence.
  - No hallucination — if not found, say so.
  - Return valid JSON always.

Supports:
  - generate_answer()        → blocking structured response
  - stream_answer_tokens()   → SSE token generator (answer text only)
"""

from __future__ import annotations

import json
import os
import re
from collections.abc import Generator

from groq import Groq

# ── Groq client singleton ─────────────────────────────────────────────────────

_client: Groq | None = None


def _get_client() -> Groq:
    global _client
    if _client is None:
        api_key = os.environ.get("GROQ_API_KEY", "").strip()
        if not api_key:
            raise RuntimeError(
                "GROQ_API_KEY is not set. "
                "Add it to your .env file: GROQ_API_KEY=gsk_..."
            )
        _client = Groq(api_key=api_key)
    return _client


# ── Model config ──────────────────────────────────────────────────────────────

MODEL = "llama-3.3-70b-versatile"   # fast, capable, stable on Groq

# ── Prompt builder ─────────────────────────────────────────────────────────────


def _build_prompt(question: str, chunks: list[dict]) -> tuple[str, str]:
    """Build the system + user prompt from retrieved chunks."""
    context_blocks: list[str] = []
    for i, chunk in enumerate(chunks, 1):
        path = chunk.get("path", "unknown")
        text = chunk.get("text", "").strip()
        context_blocks.append(f"[Source {i}: {path}]\n{text}")

    context_str = "\n\n---\n\n".join(context_blocks)

    system_prompt = (
        "You are RExplain, an intelligent assistant that helps developers understand GitHub repositories. "
        "You have access to retrieved code and documentation excerpts from a specific repository.\n\n"
        "Rules you MUST follow:\n"
        "1. If the retrieved context contains relevant evidence, use it to give a precise, grounded answer. "
        "   Quote code, function names, and file paths where helpful.\n"
        "2. If the question is conversational (e.g. 'hello', 'thanks', 'how are you'), respond naturally and helpfully "
        "   as a friendly assistant — no need to reference the repository.\n"
        "3. If the context is not relevant to the question, answer from your general software engineering knowledge. "
        "   Briefly note that you couldn't find specific evidence in this repository.\n"
        "4. NEVER respond with 'Not enough repository evidence found.' — always provide value.\n"
        "5. Keep answers concise but complete (2-6 sentences typically).\n"
        "6. You MUST always respond with valid JSON in exactly this format (no markdown fences):\n"
        "{\n"
        '  "answer": "Your answer here.",\n'
        '  "sources": ["path/to/file1.py"],\n'
        '  "confidence": "high"\n'
        "}\n"
        "confidence must be one of: high, medium, low.\n"
        "sources must only list file paths that were actually useful from the provided context. "
        "Use an empty array if none were relevant."
    )

    user_prompt = (
        f"Repository context (retrieved chunks):\n\n"
        f"{context_str}\n\n"
        f"---\n\n"
        f"Question: {question}"
    )

    return system_prompt, user_prompt


# ── Response validator ─────────────────────────────────────────────────────────


def _parse_response(raw: str, chunks: list[dict]) -> dict:
    """
    Safely parse LLM JSON output.
    Falls back gracefully if output is malformed.
    """
    # Strip markdown fences if the model wrapped in ```json ... ```
    cleaned = re.sub(r"^```(?:json)?\s*", "", raw.strip(), flags=re.MULTILINE)
    cleaned = re.sub(r"```\s*$", "", cleaned.strip(), flags=re.MULTILINE)
    cleaned = cleaned.strip()

    try:
        parsed = json.loads(cleaned)
    except json.JSONDecodeError:
        # Attempt to extract JSON block from text
        match = re.search(r"\{[\s\S]*\}", cleaned)
        if match:
            try:
                parsed = json.loads(match.group())
            except json.JSONDecodeError:
                parsed = {}
        else:
            parsed = {}

    answer = parsed.get("answer", "").strip()
    # If LLM still returned the old refusal string, replace with a sensible default
    if not answer or "not enough repository evidence" in answer.lower():
        answer = (
            "I couldn't find specific evidence for this in the repository. "
            "Try asking about a specific file, function, framework, or API route "
            "that exists in this codebase."
        )

    sources = parsed.get("sources", [])
    if not isinstance(sources, list):
        sources = []
    # Deduplicate and validate sources exist in chunks
    valid_paths = {c.get("path", "") for c in chunks}
    sources = list(dict.fromkeys(
        s for s in sources
        if isinstance(s, str) and (s in valid_paths or "/" in s or "." in s)
    ))[:5]

    confidence = parsed.get("confidence", "medium").lower()
    if confidence not in {"high", "medium", "low"}:
        confidence = "medium"

    return {
        "answer": answer,
        "sources": sources,
        "confidence": confidence,
    }


# ── Main public function ───────────────────────────────────────────────────────


def generate_answer(question: str, chunks: list[dict]) -> dict:
    """
    Call Groq LLM with the retrieved chunks and user question.

    Returns:
        {
            "answer": str,
            "sources": list[str],
            "confidence": "high" | "medium" | "low"
        }
    """
    if not chunks:
        # No RAG context — fall back to a general LLM answer
        system_prompt = (
            "You are a knowledgeable software engineering assistant. "
            "The user is asking about a GitHub repository that could not be indexed. "
            "Answer the question as helpfully as possible using your general knowledge about "
            "software development, common frameworks, and coding patterns. "
            "Be honest that you are answering without direct access to the specific repository code. "
            "Respond with valid JSON in exactly this format (no markdown fences):\n"
            '{"answer": "...", "sources": [], "confidence": "low"}'
        )
        client = _get_client()
        completion = client.chat.completions.create(
            model=MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user",   "content": question},
            ],
            temperature=0.4,
            max_tokens=512,
            stream=False,
        )
        raw = completion.choices[0].message.content or ""
        return _parse_response(raw, [])

    system_prompt, user_prompt = _build_prompt(question, chunks)

    client = _get_client()
    completion = client.chat.completions.create(
        model=MODEL,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user",   "content": user_prompt},
        ],
        temperature=0.15,       # low temp for factual, grounded answers
        max_tokens=1024,
        stream=False,
    )

    raw = completion.choices[0].message.content or ""
    return _parse_response(raw, chunks)


# ── Streaming variant ──────────────────────────────────────────────────────────


def stream_answer_tokens(question: str, chunks: list[dict]) -> Generator[str, None, None]:
    """
    Stream the LLM answer token-by-token as Server-Sent Events (SSE) data.

    Yields SSE-formatted strings:
        data: <token_text>\\n\\n
        data: [DONE]\\n\\n        ← sentinel marking end of stream

    The final event also includes the structured metadata (sources, confidence)
    as a JSON payload:
        data: [META] {"sources": [...], "confidence": "high"}\\n\\n

    The caller (FastAPI StreamingResponse) must set:
        media_type="text/event-stream"
    """
    if not chunks:
        # No RAG context — fall back to a general LLM answer (streaming)
        system_prompt = (
            "You are a knowledgeable software engineering assistant. "
            "The user is asking about a GitHub repository that could not be indexed. "
            "Answer the question as helpfully as possible using your general knowledge about "
            "software development, common frameworks, and coding patterns. "
            "Be honest that you are answering without direct access to the specific repository code. "
            "Keep your answer concise (2-5 sentences)."
        )
        client = _get_client()
        stream = client.chat.completions.create(
            model=MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user",   "content": question},
            ],
            temperature=0.4,
            max_tokens=512,
            stream=True,
        )
        for chunk in stream:
            delta = chunk.choices[0].delta
            token = getattr(delta, "content", None) or ""
            if token:
                safe = token.replace("\n", "\\n")
                yield f"data: {safe}\n\n"
        yield 'data: [META] {"sources": [], "confidence": "low"}\n\n'
        yield "data: [DONE]\n\n"
        return

    system_prompt, user_prompt = _build_prompt(question, chunks)
    client = _get_client()

    # Collect full text for post-stream metadata extraction
    full_text: list[str] = []

    stream = client.chat.completions.create(
        model=MODEL,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user",   "content": user_prompt},
        ],
        temperature=0.15,
        max_tokens=1024,
        stream=True,
    )

    for chunk in stream:
        delta = chunk.choices[0].delta
        token = getattr(delta, "content", None) or ""
        if token:
            full_text.append(token)
            # Escape newlines for SSE protocol
            safe = token.replace("\n", "\\n")
            yield f"data: {safe}\n\n"

    # After streaming, parse metadata from the accumulated text
    raw = "".join(full_text)
    parsed = _parse_response(raw, chunks)
    meta = {
        "sources":    parsed["sources"],
        "confidence": parsed["confidence"],
    }
    yield f"data: [META] {json.dumps(meta)}\n\n"
    yield "data: [DONE]\n\n"
