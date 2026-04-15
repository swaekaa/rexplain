"""
embeddings.py
-------------
Phase 11: Smart file chunking + SentenceTransformer model singleton.

Chunking strategy:
  - Python  → split by def / async def / class blocks
  - JS/TS   → split by function / class / export blocks
  - Markdown → split by ## section headers
  - JSON/YAML/other → fixed 800-char windows

Model: all-MiniLM-L6-v2 (local, ~90 MB, fast)
Loaded once and reused across all requests.
"""

from __future__ import annotations

import re
from typing import Optional

# ── Model singleton ───────────────────────────────────────────────────────────

_model = None
_MODEL_NAME = "all-MiniLM-L6-v2"


def get_model():
    """Lazy-load the SentenceTransformer model (once per process)."""
    global _model
    if _model is None:
        print(f"[rag] loading embedding model: {_MODEL_NAME}")
        try:
            from sentence_transformers import SentenceTransformer
            _model = SentenceTransformer(_MODEL_NAME)
            print(f"[rag] model loaded OK")
        except ImportError:
            raise RuntimeError(
                "sentence-transformers is not installed. "
                "Run: pip install sentence-transformers"
            )
    return _model


# ── Extension / directory filters ────────────────────────────────────────────

INCLUDE_EXTS = {
    ".py", ".js", ".ts", ".tsx", ".jsx",
    ".md", ".json", ".yaml", ".yml",
    ".toml", ".cfg", ".sh", ".txt",
}

SKIP_DIRS = {
    "node_modules", ".git", "dist", "build", "venv",
    "__pycache__", ".next", "coverage", ".dist",
    "static", "assets", ".mypy_cache",
}

MAX_FILE_CHARS = 40_000   # cap per file before chunking


# ── Per-language chunkers ─────────────────────────────────────────────────────

def _chunk_python(content: str, path: str) -> list[dict]:
    """Split Python source by function / class definitions."""
    lines = content.split("\n")
    block_start_re = re.compile(
        r"^(\s*)(async\s+def\s+\w|def\s+\w|class\s+\w)"
    )

    blocks: list[tuple[int, int]] = []   # (start_line, end_line)
    starts: list[int] = []

    for i, line in enumerate(lines):
        if block_start_re.match(line):
            starts.append(i)

    if not starts:
        return _chunk_generic(content, path)

    for idx, start in enumerate(starts):
        end = starts[idx + 1] if idx + 1 < len(starts) else len(lines)
        blocks.append((start, end))

    chunks = []
    for start, end in blocks:
        text = "\n".join(lines[start:end]).strip()
        if len(text) > 30:
            chunks.append({"path": path, "text": text[:3_000], "type": "function"})

    return chunks or [{"path": path, "text": content[:2_000], "type": "file"}]


def _chunk_js(content: str, path: str) -> list[dict]:
    """Split JS/TS by function / class / export definitions."""
    split_re = re.compile(
        r"(?=\n(?:"
        r"export\s+(?:default\s+)?(?:async\s+)?(?:function|class)\s+"
        r"|(?:async\s+)?function\s+\w"
        r"|const\s+\w+\s*=\s*(?:async\s+)?\("
        r"|class\s+\w"
        r"))"
    )
    parts = split_re.split(content)
    chunks = []
    for part in parts:
        text = part.strip()
        if len(text) > 30:
            chunks.append({"path": path, "text": text[:3_000], "type": "function"})
    return chunks or [{"path": path, "text": content[:2_000], "type": "file"}]


def _chunk_markdown(content: str, path: str) -> list[dict]:
    """Split Markdown by section headers (# / ## / ###)."""
    sections = re.split(r"\n(?=#{1,3}\s)", content)
    chunks = []
    for section in sections:
        text = section.strip()
        if len(text) < 20:
            continue
        if len(text) > 2_000:
            for i in range(0, len(text), 1_800):
                sub = text[i : i + 2_000].strip()
                if sub:
                    chunks.append({"path": path, "text": sub, "type": "section"})
        else:
            chunks.append({"path": path, "text": text, "type": "section"})
    return chunks or [{"path": path, "text": content[:2_000], "type": "file"}]


def _chunk_generic(content: str, path: str) -> list[dict]:
    """Fixed 800-char sliding window with 100-char overlap."""
    window, step = 800, 700
    chunks = []
    for i in range(0, len(content), step):
        text = content[i : i + window].strip()
        if len(text) > 30:
            chunks.append({"path": path, "text": text, "type": "chunk"})
    return chunks or [{"path": path, "text": content[:800], "type": "file"}]


def chunk_file(path: str, content: str) -> list[dict]:
    """Route to the appropriate chunker based on file extension."""
    content = content[:MAX_FILE_CHARS]
    ext = ("." + path.rsplit(".", 1)[-1].lower()) if "." in path else ""

    if ext == ".py":
        return _chunk_python(content, path)
    if ext in {".js", ".ts", ".tsx", ".jsx"}:
        return _chunk_js(content, path)
    if ext == ".md":
        return _chunk_markdown(content, path)
    return _chunk_generic(content, path)


# ── Top-level builder ─────────────────────────────────────────────────────────

def build_chunks(
    file_contents_map: dict,
    extra_context: Optional[dict] = None,
) -> list[dict]:
    """
    Build all chunks from the in-memory file contents map.

    Also injects structured intelligence data (AI explanation, folder map,
    detected API routes) as additional searchable chunks.
    """
    all_chunks: list[dict] = []

    for path, content in file_contents_map.items():
        # Skip unwanted directories
        parts = path.replace("\\", "/").split("/")
        if any(part in SKIP_DIRS for part in parts[:-1]):
            continue

        ext = ("." + path.rsplit(".", 1)[-1].lower()) if "." in path else ""
        if ext not in INCLUDE_EXTS:
            continue

        if not content or not content.strip():
            continue

        try:
            all_chunks.extend(chunk_file(path, content))
        except Exception as exc:
            print(f"[rag] chunk error for {path}: {exc}")

    # ── Structured intelligence blobs ────────────────────────────────────────
    if extra_context:
        if extra_context.get("ai_explanation"):
            all_chunks.append({
                "path": "_analysis/overview.md",
                "text": f"Repository Overview:\n{extra_context['ai_explanation']}",
                "type": "analysis",
            })

        if extra_context.get("folder_explanations"):
            folder_lines = "\n".join(
                f"/{k}: {v}"
                for k, v in extra_context["folder_explanations"].items()
            )
            all_chunks.append({
                "path": "_analysis/structure.md",
                "text": f"Project Folder Structure:\n{folder_lines}",
                "type": "analysis",
            })

        if extra_context.get("api_routes"):
            routes_text = "Detected API Routes:\n" + "\n".join(
                extra_context["api_routes"]
            )
            all_chunks.append({
                "path": "_analysis/api_routes.md",
                "text": routes_text,
                "type": "analysis",
            })

        if extra_context.get("important_files"):
            files_text = "Important Files:\n" + "\n".join(
                extra_context["important_files"]
            )
            all_chunks.append({
                "path": "_analysis/key_files.md",
                "text": files_text,
                "type": "analysis",
            })

    print(f"[rag] total chunks built: {len(all_chunks)}")
    return all_chunks
