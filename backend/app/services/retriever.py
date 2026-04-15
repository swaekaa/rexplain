"""
retriever.py
------------
Phase 11: In-memory vector store using numpy cosine similarity.

Stores one VectorStore per analyzed repo (keyed by repo_url).
No FAISS binary dependency — pure numpy gives equivalent quality
for the chunk counts involved (<2000 chunks per repo).
"""

from __future__ import annotations

import numpy as np

# ── In-memory store registry ─────────────────────────────────────────────────

_active_stores: dict[str, "VectorStore"] = {}


def _normalize_key(repo_url: str) -> str:
    return repo_url.rstrip("/").lower()


# ── Vector store ──────────────────────────────────────────────────────────────

class VectorStore:
    """Cosine-similarity in-memory vector store."""

    def __init__(self) -> None:
        self.embeddings: np.ndarray | None = None   # shape (N, dim)
        self.chunks: list[dict] = []

    def add(self, embeddings: np.ndarray, chunks: list[dict]) -> None:
        self.embeddings = embeddings.astype(np.float32)
        self.chunks = chunks

    def search(self, query_vec: np.ndarray, top_k: int = 5) -> list[dict]:
        if self.embeddings is None or not self.chunks:
            return []

        # L2-normalise corpus
        norms = np.linalg.norm(self.embeddings, axis=1, keepdims=True)
        normed = self.embeddings / (norms + 1e-8)

        # L2-normalise query
        q = query_vec.astype(np.float32)
        q = q / (np.linalg.norm(q) + 1e-8)

        scores = normed @ q                         # (N,)
        top_idx = np.argsort(scores)[::-1][:top_k]

        results = []
        for idx in top_idx:
            score = float(scores[idx])
            if score > 0.15:                        # relevance gate
                results.append({
                    "text":  self.chunks[idx]["text"],
                    "path":  self.chunks[idx]["path"],
                    "score": score,
                })
        return results

    @property
    def size(self) -> int:
        return len(self.chunks)


# ── Public API ────────────────────────────────────────────────────────────────

def build_store(repo_url: str, chunks: list[dict], model) -> VectorStore:
    """
    Encode all chunks and cache the vector store for this repo_url.
    Safe to call multiple times — overwrites the previous store.
    """
    key = _normalize_key(repo_url)
    store = VectorStore()

    if not chunks:
        _active_stores[key] = store
        return store

    texts = [c["text"] for c in chunks]
    embeddings = model.encode(
        texts,
        batch_size=64,
        show_progress_bar=False,
        convert_to_numpy=True,
    )
    store.add(np.array(embeddings, dtype=np.float32), chunks)
    _active_stores[key] = store

    print(f"[rag] stored {store.size} chunks for {key}")
    return store


def get_store(repo_url: str) -> VectorStore | None:
    """Return the cached store for this repo, or None if not yet analyzed."""
    return _active_stores.get(_normalize_key(repo_url))


def query_store(store: VectorStore, question: str, model, top_k: int = 5) -> list[dict]:
    """Embed question and retrieve top-k relevant chunks."""
    q_vec = model.encode([question], convert_to_numpy=True)[0]
    return store.search(np.array(q_vec, dtype=np.float32), top_k=top_k)
