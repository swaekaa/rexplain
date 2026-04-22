"""
retriever.py
------------
Phase 12 → 13 upgrade: Precision-recall improvements for technical queries.

Architecture (unchanged):
  - One VectorStore per repo URL, cached in-memory
  - Pure-numpy cosine similarity (no FAISS binary dep)

New in this version:
  1. Query expansion    — technical synonyms prepended before embedding
  2. Hybrid scoring     — cosine_sim * 0.70 + keyword_overlap * 0.30
  3. README boost       — chunks tagged is_readme get +0.06 on final score
  4. Exact-match boost  — +0.12 when ANY original query token appears
                          literally in chunk text (catches accuracy/model/params)
  5. Lower gate         — relevance threshold dropped to 0.05
                          (short technical chunks score lower than prose;
                          trust keyword + exact match to rank them correctly)
  6. Relaxed diversity  — README / analysis chunks allowed up to 3 per file;
                          generic files capped at 2
  7. Larger pool        — top_k * 4 candidates before diversity filter
  8. Multi-pass         — if first pass yields < 2 results, re-run with
                          gate=0.0 to guarantee at least some evidence
"""

from __future__ import annotations

import re
import math
from collections import Counter

import numpy as np

# ── In-memory store registry ─────────────────────────────────────────────────

_active_stores: dict[str, "VectorStore"] = {}


def _normalize_key(repo_url: str) -> str:
    return repo_url.rstrip("/").lower()


# ── Query expansion table ─────────────────────────────────────────────────────
# Maps trigger words to expansion terms that improve semantic recall.
# Keys are lowercase substrings; values are appended to the query string.

_EXPANSION_TABLE: list[tuple[str, str]] = [
    # Model / architecture
    ("model",        "architecture backbone neural network classifier weights checkpoint"),
    ("architecture", "model backbone layers encoder decoder transformer resnet"),
    ("backbone",     "model architecture neural network pretrained"),
    ("network",      "model neural architecture layers"),
    ("classifier",   "model classification head output layer"),

    # Performance metrics
    ("accuracy",     "performance metric top-1 top-5 evaluation benchmark score result"),
    ("performance",  "accuracy metric benchmark evaluation result score"),
    ("benchmark",    "accuracy performance result evaluation score dataset"),
    ("result",       "accuracy performance metric evaluation score"),
    ("score",        "accuracy performance metric result evaluation"),
    ("metric",       "accuracy performance evaluation result score"),
    ("f1",           "precision recall metric performance evaluation"),
    ("mAP",          "mean average precision metric detection accuracy"),
    ("loss",         "training loss validation metric performance convergence"),

    # Parameters / size
    ("parameter",    "parameters weights size million billion model count"),
    ("parameters",   "parameters weights size million billion model count"),
    ("param",        "parameters weights size million billion count"),
    ("size",         "parameters count million billion model architecture"),
    ("million",      "parameters size count model weights"),
    ("billion",      "parameters size count model weights"),

    # Dataset / training
    ("dataset",      "data training set ImageNet COCO benchmark split"),
    ("training",     "dataset epochs batch learning rate optimizer train"),
    ("data",         "dataset training split samples"),
    ("epoch",        "training epochs iterations batch learning schedule"),
    ("pretrained",   "weights checkpoint fine-tuned transfer learning model"),

    # Frameworks
    ("pytorch",      "torch framework deep learning neural network"),
    ("tensorflow",   "tf keras framework deep learning"),
    ("keras",        "tensorflow deep learning framework neural network"),
    ("jax",          "framework accelerated linear algebra deep learning"),

    # General technical
    ("hyperparameter", "learning rate batch size scheduler optimizer config"),
    ("learning rate",  "optimizer hyperparameter training schedule"),
    ("optimizer",      "adam sgd learning rate training hyperparameter"),
    ("inference",      "prediction speed latency throughput FPS model"),
    ("latency",        "inference speed throughput FPS performance"),
    ("requirement",    "dependency install package library version"),
    ("install",        "requirements dependency pip conda setup"),
    ("usage",          "how to run example command line interface"),
    ("how to",         "usage example guide tutorial command run"),
    ("what",           "description purpose overview explanation"),
    ("which",          "used framework model library tool version"),
]


def _expand_query(question: str) -> str:
    """
    Expand the user question with domain-specific synonyms.

    Strategy:
    - Match trigger words (case-insensitive substring match)
    - Append unique expansion terms (deduplicated across all matches)
    - Prepend expansions so original question tokens retain full weight
    """
    q_lower = question.lower()
    extra_terms: list[str] = []
    seen: set[str] = set()

    for trigger, expansion in _EXPANSION_TABLE:
        if trigger in q_lower:
            for term in expansion.split():
                if term not in seen:
                    extra_terms.append(term)
                    seen.add(term)

    if extra_terms:
        # Prefix with original query so embedding reflects both
        return question + " " + " ".join(extra_terms)
    return question


# ── Keyword overlap scorer ────────────────────────────────────────────────────

def _tokenize(text: str) -> Counter:
    """Lowercase word tokens, strip punctuation, min length 3."""
    tokens = re.findall(r"[a-zA-Z0-9_]{3,}", text.lower())
    return Counter(tokens)


def _keyword_score(query_tokens: Counter, chunk_text: str) -> float:
    """
    Normalised keyword overlap ∈ [0, 1].

    = |query_tokens ∩ chunk_tokens| / |query_tokens|
    """
    if not query_tokens:
        return 0.0
    chunk_tokens = _tokenize(chunk_text)
    overlap = sum(min(query_tokens[t], chunk_tokens[t]) for t in query_tokens)
    return overlap / sum(query_tokens.values())


# ── Vector store ──────────────────────────────────────────────────────────────

class VectorStore:
    """
    Hybrid cosine + keyword in-memory vector store.

    Scoring formula per chunk:
        final = cosine * 0.70 + keyword * 0.30
                + readme_boost  (0.06 if chunk tagged is_readme)
                + exact_boost   (0.12 if any query token literally in chunk)
    """

    # Weights
    W_COSINE  = 0.70
    W_KEYWORD = 0.30
    README_BOOST   = 0.06   # boosted from 0.04
    EXACT_BOOST    = 0.12   # applied when any query token matches literally
    RELEVANCE_GATE = 0.05   # lowered from 0.10 — trust keyword/exact to rank

    def __init__(self) -> None:
        self.embeddings: np.ndarray | None = None   # shape (N, dim)
        self.chunks: list[dict] = []

    def add(self, embeddings: np.ndarray, chunks: list[dict]) -> None:
        self.embeddings = embeddings.astype(np.float32)
        self.chunks = chunks

    def _exact_match_boost(self, query_tokens: Counter, chunk_text: str) -> float:
        """
        Return EXACT_BOOST if ANY original query token appears as a
        case-insensitive substring of the chunk text.

        This ensures short but precise queries like "accuracy", "parameter
        count", or "model" always surface chunks that literally mention them,
        even when cosine similarity is low due to chunk brevity.
        """
        text_lower = chunk_text.lower()
        for token in query_tokens:
            if len(token) >= 4 and token in text_lower:
                return self.EXACT_BOOST
        return 0.0

    def search(
        self,
        query_vec: np.ndarray,
        query_tokens: Counter,
        top_k: int = 6,
        max_per_file: int = 2,
        _gate_override: float | None = None,
    ) -> list[dict]:
        if self.embeddings is None or not self.chunks:
            return []

        gate = _gate_override if _gate_override is not None else self.RELEVANCE_GATE

        # ── Cosine similarity ──────────────────────────────────────────────
        norms = np.linalg.norm(self.embeddings, axis=1, keepdims=True)
        normed = self.embeddings / (norms + 1e-8)

        q = query_vec.astype(np.float32)
        q = q / (np.linalg.norm(q) + 1e-8)
        cosine_scores = normed @ q    # (N,)

        # ── Hybrid scoring (vectorised cosine + per-chunk keyword + exact) ──
        final_scores = np.empty(len(self.chunks), dtype=np.float32)
        for i, chunk in enumerate(self.chunks):
            kw = _keyword_score(query_tokens, chunk["text"])
            is_readme    = chunk.get("is_readme", False)
            is_analysis  = chunk.get("path", "").startswith("_analysis/")
            readme_boost = self.README_BOOST if is_readme else 0.0
            exact_boost  = self._exact_match_boost(query_tokens, chunk["text"])
            final_scores[i] = (
                float(cosine_scores[i]) * self.W_COSINE
                + kw * self.W_KEYWORD
                + readme_boost
                + exact_boost
            )

        # ── Select top candidates (4× top_k before diversity filter) ───────
        candidate_idx = np.argsort(final_scores)[::-1][: top_k * 4]

        results: list[dict] = []
        file_counts: dict[str, int] = {}

        for idx in candidate_idx:
            score = float(final_scores[idx])
            if score < gate:
                break

            chunk = self.chunks[idx]
            fp = chunk.get("path", "")
            is_readme   = chunk.get("is_readme", False)
            is_analysis = fp.startswith("_analysis/")

            # README and analysis chunks get a higher per-file cap (3 vs 2)
            file_cap = 3 if (is_readme or is_analysis) else max_per_file
            if file_counts.get(fp, 0) >= file_cap:
                continue

            file_counts[fp] = file_counts.get(fp, 0) + 1
            results.append({
                "text":  chunk["text"],
                "path":  fp,
                "score": round(score, 4),
            })

            if len(results) >= top_k:
                break

        # ── Multi-pass fallback: if < 2 results, re-run with gate=0.0 ───────
        if len(results) < 2 and _gate_override is None:
            print("[rag] low-yield first pass — retrying with gate=0.0")
            return self.search(
                query_vec, query_tokens,
                top_k=top_k, max_per_file=max_per_file,
                _gate_override=0.0,
            )

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


def query_store(
    store: VectorStore,
    question: str,
    model,
    top_k: int = 6,
) -> list[dict]:
    """
    Expand query, embed it, run hybrid retrieval, return top-k chunks.

    Steps:
    1. Expand question with domain synonyms
    2. Embed expanded query
    3. Hybrid search (cosine + keyword + README boost)
    """
    expanded = _expand_query(question)
    if expanded != question:
        print(f"[rag] query expanded: '{question}' → '{expanded[:80]}...'")

    q_vec = model.encode([expanded], convert_to_numpy=True)[0]
    query_tokens = _tokenize(question)   # keyword score uses ORIGINAL tokens

    return store.search(
        np.array(q_vec, dtype=np.float32),
        query_tokens,
        top_k=top_k,
    )
