"""
cache_db.py
-----------
Production-ready PostgreSQL caching layer for RExplain.

Design goals:
  - Survives server restarts (no ephemeral in-memory or local-file state)
  - Compatible with Render / Railway / AWS / any DATABASE_URL deployment
  - Connection pooling via SQLAlchemy (thread-safe, reusable)
  - Graceful fallback: if the DB is unavailable the caller proceeds normally
  - Stores full analysis JSON + serialised RAG embeddings (numpy arrays)
    so repeated analysis of the same commit returns in < 1 second

Schema (table: repo_cache)
  id              SERIAL PRIMARY KEY
  repo_url        TEXT   UNIQUE NOT NULL
  last_commit_sha TEXT   NOT NULL
  analysis_json   JSONB  NOT NULL   -- full pipeline output
  embeddings_blob BYTEA             -- serialised numpy array (optional)
  chunks_json     JSONB             -- list of chunk dicts for the RAG store
  created_at      TIMESTAMPTZ DEFAULT now()
  updated_at      TIMESTAMPTZ DEFAULT now()
"""

from __future__ import annotations

import base64
import io
import json
import logging
import os
from contextlib import contextmanager
from typing import Any, Optional

import numpy as np

log = logging.getLogger("cache_db")
log.setLevel(logging.INFO)

# ── SQLAlchemy (imported lazily so the module can be imported without it) ─────

_engine = None
_table = None          # SQLAlchemy Table object
_metadata = None       # SQLAlchemy MetaData object
_available = False     # set to True once DB is initialised


# ── Initialisation ────────────────────────────────────────────────────────────

def _get_engine():
    """
    Build (or return cached) SQLAlchemy engine from DATABASE_URL.

    Uses connection pooling appropriate for production:
      pool_size=5, max_overflow=10, pool_recycle=300s
    """
    global _engine
    if _engine is not None:
        return _engine

    db_url = os.environ.get("DATABASE_URL", "")
    if not db_url:
        raise RuntimeError("DATABASE_URL environment variable is not set")

    # Render / Railway export postgres:// — SQLAlchemy 1.4+ needs postgresql://
    if db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql://", 1)

    from sqlalchemy import create_engine  # type: ignore
    _engine = create_engine(
        db_url,
        pool_size=5,
        max_overflow=10,
        pool_pre_ping=True,      # drops stale connections before use
        pool_recycle=300,        # recycle connections every 5 min
        echo=False,
    )
    return _engine


def _get_table():
    """Return (or build) the repo_cache Table object and MetaData."""
    global _table, _metadata
    if _table is not None:
        return _table

    from sqlalchemy import (  # type: ignore
        Column, Integer, MetaData, Table, Text,
        DateTime, LargeBinary,
    )
    from sqlalchemy.dialects.postgresql import JSONB  # type: ignore
    from sqlalchemy.sql import func

    _metadata = MetaData()
    _table = Table(
        "repo_cache",
        _metadata,
        Column("id",              Integer, primary_key=True, autoincrement=True),
        Column("repo_url",        Text,    unique=True, nullable=False),
        Column("last_commit_sha", Text,    nullable=False),
        Column("analysis_json",   JSONB,   nullable=False),
        Column("embeddings_blob", LargeBinary, nullable=True),   # serialised np array
        Column("chunks_json",     JSONB,   nullable=True),       # list[dict] chunks
        Column("created_at",      DateTime(timezone=True), server_default=func.now()),
        Column("updated_at",      DateTime(timezone=True), server_default=func.now(),
               onupdate=func.now()),
    )
    return _table


def init_db() -> bool:
    """
    Create the repo_cache table if it does not exist.
    Returns True on success, False if the DB is unavailable.

    Call this once at application startup (from main.py lifespan / startup
    event).  Safe to call multiple times (CREATE TABLE IF NOT EXISTS).
    """
    global _available
    try:
        engine = _get_engine()
        table = _get_table()
        _metadata.create_all(engine)          # idempotent
        _available = True
        log.info("[cache] PostgreSQL cache initialised")
        return True
    except Exception as exc:
        log.warning("[cache] DB init failed — caching disabled: %s", exc)
        _available = False
        return False


@contextmanager
def _connection():
    """Yield a raw DBAPI connection from the pool, auto-committing on exit."""
    engine = _get_engine()
    with engine.connect() as conn:
        yield conn


# ── GitHub API: latest commit SHA ─────────────────────────────────────────────

def fetch_latest_commit_sha(repo_url: str) -> Optional[str]:
    """
    Fetch the HEAD commit SHA for a GitHub repository via the GitHub API.
    Returns None on any error (network, auth, rate-limit, non-GitHub URL).
    """
    import requests  # already in requirements

    try:
        # Extract owner/repo from https://github.com/owner/repo[.git][/]
        parts = repo_url.rstrip("/").split("/")
        if "github.com" not in repo_url or len(parts) < 5:
            return None
        owner = parts[-2]
        repo  = parts[-1].replace(".git", "")

        headers = {"Accept": "application/vnd.github.v3+json"}
        github_token = os.environ.get("GITHUB_TOKEN", "")
        if github_token:
            headers["Authorization"] = f"Bearer {github_token}"

        url = f"https://api.github.com/repos/{owner}/{repo}/commits/HEAD"
        r = requests.get(url, headers=headers, timeout=6)
        if r.status_code == 200:
            return r.json().get("sha")
    except Exception as exc:
        log.debug("[cache] SHA fetch error: %s", exc)
    return None


# ── Serialisation helpers ─────────────────────────────────────────────────────

def _serialize_embeddings(embeddings: np.ndarray) -> bytes:
    """Serialise a numpy float32 array to raw bytes (npy format in memory)."""
    buf = io.BytesIO()
    np.save(buf, embeddings.astype(np.float32))
    return buf.getvalue()


def _deserialize_embeddings(data: bytes) -> np.ndarray:
    """Deserialise bytes produced by _serialize_embeddings."""
    buf = io.BytesIO(data)
    return np.load(buf)


# ── Public cache API ──────────────────────────────────────────────────────────

def get_cached_analysis(repo_url: str) -> Optional[dict]:
    """
    Check the cache for repo_url.

    Returns a dict with keys:
        "analysis"   – the stored analysis_json
        "sha"        – last_commit_sha stored
        "embeddings" – np.ndarray or None
        "chunks"     – list[dict] or None

    Returns None if not found or DB unavailable.
    """
    if not _available:
        return None
    try:
        table = _get_table()
        with _connection() as conn:
            from sqlalchemy import select  # type: ignore
            stmt = select(
                table.c.last_commit_sha,
                table.c.analysis_json,
                table.c.embeddings_blob,
                table.c.chunks_json,
            ).where(table.c.repo_url == repo_url)
            row = conn.execute(stmt).fetchone()

        if row is None:
            return None

        embeddings = None
        if row.embeddings_blob:
            try:
                embeddings = _deserialize_embeddings(row.embeddings_blob)
            except Exception as exc:
                log.debug("[cache] embeddings deserialise error: %s", exc)

        return {
            "sha":        row.last_commit_sha,
            "analysis":   row.analysis_json,
            "embeddings": embeddings,
            "chunks":     row.chunks_json,
        }
    except Exception as exc:
        log.warning("[cache] get error: %s", exc)
        return None


def upsert_analysis(
    repo_url: str,
    commit_sha: str,
    analysis: dict,
    embeddings: Optional[np.ndarray] = None,
    chunks: Optional[list] = None,
) -> bool:
    """
    Insert or update a cache entry.

    Parameters
    ----------
    repo_url    : canonical repository URL (used as cache key)
    commit_sha  : HEAD commit SHA at time of analysis
    analysis    : full pipeline output dict (must be JSON-serialisable)
    embeddings  : numpy float32 array of shape (N, dim), optional
    chunks      : list of chunk dicts for the RAG store, optional

    Returns True on success, False on any DB error.
    """
    if not _available:
        return False
    try:
        table = _get_table()
        emb_bytes = _serialize_embeddings(embeddings) if embeddings is not None else None

        values: dict[str, Any] = {
            "repo_url":        repo_url,
            "last_commit_sha": commit_sha,
            "analysis_json":   analysis,
            "embeddings_blob": emb_bytes,
            "chunks_json":     chunks,
        }

        with _connection() as conn:
            from sqlalchemy import select  # type: ignore
            from sqlalchemy.dialects.postgresql import insert  # type: ignore

            stmt = insert(table).values(**values).on_conflict_do_update(
                index_elements=["repo_url"],
                set_={
                    "last_commit_sha": commit_sha,
                    "analysis_json":   analysis,
                    "embeddings_blob": emb_bytes,
                    "chunks_json":     chunks,
                    "updated_at":      __import__("sqlalchemy").func.now(),
                },
            )
            conn.execute(stmt)
            conn.commit()
        return True
    except Exception as exc:
        log.warning("[cache] upsert error: %s", exc)
        return False


def is_available() -> bool:
    """Return True if the DB was successfully initialised."""
    return _available
