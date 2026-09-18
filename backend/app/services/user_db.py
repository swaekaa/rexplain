"""
user_db.py
----------
Persistent user accounts, repository history, threads, and messages.

Follows the same SQLAlchemy Core pattern as cache_db.py.
All tables are created on startup via create_all (idempotent).

Tables
------
  users
  user_repositories  — which users have accessed which repo_cache entries
  threads            — user conversation threads per repository
  messages           — individual messages within a thread
"""

from __future__ import annotations

import logging
import os
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Optional

log = logging.getLogger("user_db")
log.setLevel(logging.INFO)

_engine = None
_metadata = None
_tables: dict = {}
_available = False


from app.services.cache_db import _get_engine

# ── Table definitions ─────────────────────────────────────────────────────────

def _build_tables():
    global _metadata, _tables

    from sqlalchemy import (  # type: ignore
        Column, Text, DateTime, ForeignKey, UniqueConstraint, Index, MetaData, Table, JSON
    )
    from sqlalchemy.dialects.postgresql import UUID  # type: ignore
    from sqlalchemy.sql import func

    _metadata = MetaData()

    users = Table(
        "users",
        _metadata,
        Column("id",          UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        Column("google_id",   Text, unique=True, nullable=False),
        Column("email",       Text, unique=True, nullable=False),
        Column("name",        Text, nullable=False, server_default=""),
        Column("picture",     Text, nullable=True),
        Column("created_at",  DateTime(timezone=True), server_default=func.now()),
        Column("updated_at",  DateTime(timezone=True), server_default=func.now(), onupdate=func.now()),
        Column("last_login",  DateTime(timezone=True), server_default=func.now()),
    )

    user_repositories = Table(
        "user_repositories",
        _metadata,
        Column("id",               UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        Column("user_id",          UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        Column("repo_cache_id",    Text, nullable=False),  # repo_url as stable key
        Column("repo_url",         Text, nullable=False),
        Column("created_at",       DateTime(timezone=True), server_default=func.now()),
        Column("last_accessed_at", DateTime(timezone=True), server_default=func.now()),
        UniqueConstraint("user_id", "repo_cache_id", name="uq_user_repo"),
        Index("ix_user_repositories_user_id", "user_id"),
        Index("ix_user_repositories_repo", "repo_cache_id"),
    )

    threads = Table(
        "threads",
        _metadata,
        Column("id",         UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        Column("user_id",    UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        Column("repo_url",   Text, nullable=False),
        Column("title",      Text, nullable=False, server_default="New Conversation"),
        Column("created_at", DateTime(timezone=True), server_default=func.now()),
        Column("updated_at", DateTime(timezone=True), server_default=func.now()),
        Index("ix_threads_user_id", "user_id"),
        Index("ix_threads_repo_url", "repo_url"),
        Index("ix_threads_updated_at", "updated_at"),
    )

    messages = Table(
        "messages",
        _metadata,
        Column("id",         UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        Column("thread_id",  UUID(as_uuid=True), ForeignKey("threads.id", ondelete="CASCADE"), nullable=False),
        Column("role",       Text, nullable=False),
        Column("content",    Text, nullable=False),
        Column("sources",    JSON, nullable=False, server_default='[]'),
        Column("confidence", Text, nullable=False, server_default="medium"),
        Column("created_at", DateTime(timezone=True), server_default=func.now()),
        Index("ix_messages_thread_id", "thread_id"),
        Index("ix_messages_created_at", "created_at"),
    )

    _tables = {
        "users": users,
        "user_repositories": user_repositories,
        "threads": threads,
        "messages": messages,
    }
    return _metadata, _tables


# ── Initialisation ─────────────────────────────────────────────────────────────

def init_db() -> bool:
    global _available
    try:
        engine = _get_engine()
        _build_tables()
        _metadata.create_all(engine)
        
        from sqlalchemy import text
        with engine.begin() as conn:
            try:
                conn.execute(text("ALTER TABLE messages ADD COLUMN sources JSON DEFAULT '[]'::json;"))
            except Exception:
                pass
            try:
                conn.execute(text("ALTER TABLE messages ADD COLUMN confidence TEXT DEFAULT 'medium';"))
            except Exception:
                pass
                
        _available = True
        log.info("[user_db] tables initialised")
        return True
    except Exception as exc:
        log.warning("[user_db] init failed — user features disabled: %s", exc)
        _available = False
        return False


def is_available() -> bool:
    return _available


@contextmanager
def _conn():
    engine = _get_engine()
    with engine.connect() as c:
        yield c


def _now():
    return datetime.now(timezone.utc)


def _str_uuid(val) -> str:
    return str(val) if val else None


# ── Users ─────────────────────────────────────────────────────────────────────

def get_or_create_user(google_id: str, email: str, name: str, picture: Optional[str]) -> Optional[dict]:
    """Upsert a user by google_id. Returns user dict or None on error."""
    if not _available:
        return None
    try:
        from sqlalchemy.dialects.postgresql import insert  # type: ignore
        users = _tables["users"]
        new_id = uuid.uuid4()
        stmt = (
            insert(users)
            .values(
                id=new_id,
                google_id=google_id,
                email=email,
                name=name,
                picture=picture,
                last_login=_now(),
            )
            .on_conflict_do_update(
                index_elements=["google_id"],
                set_={
                    "email":      email,
                    "name":       name,
                    "picture":    picture,
                    "last_login": _now(),
                    "updated_at": _now(),
                },
            )
            .returning(users.c.id, users.c.email, users.c.name, users.c.picture, users.c.created_at, users.c.last_login)
        )
        with _conn() as c:
            row = c.execute(stmt).fetchone()
            c.commit()
        if not row:
            return None
        return {
            "id":         _str_uuid(row.id),
            "google_id":  google_id,
            "email":      row.email,
            "name":       row.name,
            "picture":    row.picture,
            "created_at": row.created_at.isoformat() if row.created_at else None,
            "last_login": row.last_login.isoformat() if row.last_login else None,
        }
    except Exception as exc:
        log.warning("[user_db] get_or_create_user error: %s", exc)
        return None


def get_user_by_id(user_id: str) -> Optional[dict]:
    if not _available:
        return None
    try:
        from sqlalchemy import select  # type: ignore
        users = _tables["users"]
        with _conn() as c:
            row = c.execute(
                select(users).where(users.c.id == uuid.UUID(user_id))
            ).fetchone()
        if not row:
            return None
        return {
            "id":      _str_uuid(row.id),
            "email":   row.email,
            "name":    row.name,
            "picture": row.picture,
        }
    except Exception as exc:
        log.warning("[user_db] get_user_by_id error: %s", exc)
        return None


# ── User Repositories ─────────────────────────────────────────────────────────

def touch_user_repository(user_id: str, repo_url: str) -> bool:
    """Create or update user→repo relationship, updating last_accessed_at."""
    if not _available:
        return False
    try:
        from sqlalchemy.dialects.postgresql import insert  # type: ignore
        ur = _tables["user_repositories"]
        stmt = (
            insert(ur)
            .values(
                id=uuid.uuid4(),
                user_id=uuid.UUID(user_id),
                repo_cache_id=repo_url,
                repo_url=repo_url,
                last_accessed_at=_now(),
            )
            .on_conflict_do_update(
                constraint="uq_user_repo",
                set_={"last_accessed_at": _now()},
            )
        )
        with _conn() as c:
            c.execute(stmt)
            c.commit()
        return True
    except Exception as exc:
        log.warning("[user_db] touch_user_repository error: %s", exc)
        return False


def get_user_repositories(user_id: str) -> list[dict]:
    """Return all repositories for a user, most recently accessed first."""
    if not _available:
        return []
    try:
        from sqlalchemy import select  # type: ignore
        ur = _tables["user_repositories"]
        with _conn() as c:
            rows = c.execute(
                select(ur)
                .where(ur.c.user_id == uuid.UUID(user_id))
                .order_by(ur.c.last_accessed_at.desc())
            ).fetchall()
        return [
            {
                "id":               _str_uuid(r.id),
                "repo_url":         r.repo_url,
                "last_accessed_at": r.last_accessed_at.isoformat() if r.last_accessed_at else None,
                "created_at":       r.created_at.isoformat() if r.created_at else None,
            }
            for r in rows
        ]
    except Exception as exc:
        log.warning("[user_db] get_user_repositories error: %s", exc)
        return []


# ── Threads ───────────────────────────────────────────────────────────────────

def create_thread(user_id: str, repo_url: str, title: str = "New Conversation") -> Optional[dict]:
    if not _available:
        return None
    try:
        threads = _tables["threads"]
        new_id = uuid.uuid4()
        now = _now()
        with _conn() as c:
            c.execute(
                threads.insert().values(
                    id=new_id,
                    user_id=uuid.UUID(user_id),
                    repo_url=repo_url,
                    title=title,
                    created_at=now,
                    updated_at=now,
                )
            )
            c.commit()
        return {
            "id":         str(new_id),
            "user_id":    user_id,
            "repo_url":   repo_url,
            "title":      title,
            "created_at": now.isoformat(),
            "updated_at": now.isoformat(),
        }
    except Exception as exc:
        log.warning("[user_db] create_thread error: %s", exc)
        return None


def get_threads_for_user(user_id: str, repo_url: Optional[str] = None) -> list[dict]:
    if not _available:
        return []
    try:
        from sqlalchemy import select  # type: ignore
        threads = _tables["threads"]
        stmt = select(threads).where(threads.c.user_id == uuid.UUID(user_id))
        if repo_url:
            stmt = stmt.where(threads.c.repo_url == repo_url)
        stmt = stmt.order_by(threads.c.updated_at.desc())
        with _conn() as c:
            rows = c.execute(stmt).fetchall()
        return [
            {
                "id":         _str_uuid(r.id),
                "user_id":    _str_uuid(r.user_id),
                "repo_url":   r.repo_url,
                "title":      r.title,
                "created_at": r.created_at.isoformat() if r.created_at else None,
                "updated_at": r.updated_at.isoformat() if r.updated_at else None,
            }
            for r in rows
        ]
    except Exception as exc:
        log.warning("[user_db] get_threads_for_user error: %s", exc)
        return []


def get_thread(thread_id: str, user_id: str) -> Optional[dict]:
    """Fetch thread only if it belongs to user_id (ownership check)."""
    if not _available:
        return None
    try:
        from sqlalchemy import select  # type: ignore
        threads = _tables["threads"]
        with _conn() as c:
            row = c.execute(
                select(threads).where(
                    threads.c.id == uuid.UUID(thread_id),
                    threads.c.user_id == uuid.UUID(user_id),
                )
            ).fetchone()
        if not row:
            return None
        return {
            "id":         _str_uuid(row.id),
            "user_id":    _str_uuid(row.user_id),
            "repo_url":   row.repo_url,
            "title":      row.title,
            "created_at": row.created_at.isoformat() if row.created_at else None,
            "updated_at": row.updated_at.isoformat() if row.updated_at else None,
        }
    except Exception as exc:
        log.warning("[user_db] get_thread error: %s", exc)
        return None


def rename_thread(thread_id: str, user_id: str, title: str) -> bool:
    if not _available:
        return False
    try:
        threads = _tables["threads"]
        with _conn() as c:
            result = c.execute(
                threads.update()
                .where(
                    threads.c.id == uuid.UUID(thread_id),
                    threads.c.user_id == uuid.UUID(user_id),
                )
                .values(title=title, updated_at=_now())
            )
            c.commit()
            return result.rowcount > 0
    except Exception as exc:
        log.warning("[user_db] rename_thread error: %s", exc)
        return False


def delete_thread(thread_id: str, user_id: str) -> bool:
    if not _available:
        return False
    try:
        threads = _tables["threads"]
        with _conn() as c:
            result = c.execute(
                threads.delete().where(
                    threads.c.id == uuid.UUID(thread_id),
                    threads.c.user_id == uuid.UUID(user_id),
                )
            )
            c.commit()
            return result.rowcount > 0
    except Exception as exc:
        log.warning("[user_db] delete_thread error: %s", exc)
        return False


def touch_thread_timestamp(thread_id: str) -> bool:
    if not _available:
        return False
    try:
        threads = _tables["threads"]
        with _conn() as c:
            c.execute(
                threads.update()
                .where(threads.c.id == uuid.UUID(thread_id))
                .values(updated_at=_now())
            )
            c.commit()
        return True
    except Exception as exc:
        log.warning("[user_db] touch_thread_timestamp error: %s", exc)
        return False


def auto_title_thread(thread_id: str, user_id: str, first_message: str) -> bool:
    """Set thread title from first user message (truncated to 60 chars)."""
    title = first_message.strip()[:60]
    if len(first_message.strip()) > 60:
        title += "…"
    return rename_thread(thread_id, user_id, title)


# ── Messages ──────────────────────────────────────────────────────────────────

def add_message(thread_id: str, role: str, content: str, sources: list = None, confidence: str = "medium") -> Optional[dict]:
    if not _available:
        return None
    try:
        messages = _tables["messages"]
        new_id = uuid.uuid4()
        now = _now()
        with _conn() as c:
            c.execute(
                messages.insert().values(
                    id=new_id,
                    thread_id=uuid.UUID(thread_id),
                    role=role,
                    content=content,
                    sources=sources or [],
                    confidence=confidence,
                    created_at=now,
                )
            )
            c.commit()
        return {
            "id":         str(new_id),
            "thread_id":  thread_id,
            "role":       role,
            "content":    content,
            "sources":    sources or [],
            "confidence": confidence,
            "created_at": now.isoformat(),
        }
    except Exception as exc:
        log.warning("[user_db] add_message error: %s", exc)
        return None


def get_messages(thread_id: str, user_id: str) -> list[dict]:
    """Return thread messages in chronological order, verifying ownership."""
    if not _available:
        return []
    if get_thread(thread_id, user_id) is None:
        return []
    try:
        from sqlalchemy import select  # type: ignore
        messages = _tables["messages"]
        with _conn() as c:
            rows = c.execute(
                select(messages)
                .where(messages.c.thread_id == uuid.UUID(thread_id))
                .order_by(messages.c.created_at.asc())
            ).fetchall()
        return [
            {
                "id":         _str_uuid(r.id),
                "thread_id":  _str_uuid(r.thread_id),
                "role":       r.role,
                "content":    r.content,
                "sources":    r.sources if hasattr(r, 'sources') else [],
                "confidence": r.confidence if hasattr(r, 'confidence') else "medium",
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in rows
        ]
    except Exception as exc:
        log.warning("[user_db] get_messages error: %s", exc)
        return []
