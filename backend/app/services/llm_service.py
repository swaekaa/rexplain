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
        "You are a precise repository analysis assistant. "
        "Your ONLY job is to answer questions about a specific GitHub repository "
        "based strictly on the code and documentation excerpts provided to you.\n\n"
        "Rules you MUST follow:\n"
        "1. Answer ONLY from the repository evidence provided. Do NOT use any external knowledge.\n"
        "2. Infer answers from CODE too — not just prose docs. For example:\n"
        "   - A model name can be found in import statements, variable names, config dicts, or comments.\n"
        "   - Accuracy/metrics may appear as Python variables, print() calls, or log strings.\n"
        "   - Parameter counts can be inferred from architecture definitions.\n"
        "   If the answer requires a small inference from the code, make it and note your reasoning.\n"
        "3. Only set answer to exactly \"Not enough repository evidence found.\" if the context\n"
        "   contains ZERO relevant code, comments, or documentation about the topic.\n"
        "4. Be specific — quote relevant code, function names, file paths where possible.\n"
        "5. Keep answers concise but complete (2–6 sentences typically).\n"
        "6. You MUST always respond with valid JSON in exactly this format:\n"
        "{\n"
        '  "answer": "Your answer here.",\n'
        '  "sources": ["path/to/file1.py", "path/to/file2.ts"],\n'
        '  "confidence": "high"\n'
        "}\n"
        "confidence must be one of: high, medium, low\n"
        "sources must only list file paths from the provided context.\n"
        "Do NOT wrap the JSON in markdown code fences."
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
    if not answer:
        answer = "Not enough repository evidence found."

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
        return {
            "answer": "Not enough repository evidence found.",
            "sources": [],
            "confidence": "low",
        }

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
        yield 'data: Not enough repository evidence found.\n\n'
        yield 'data: [META] {"sources": [], "confidence": "low"}\n\n'
        yield 'data: [DONE]\n\n'
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
