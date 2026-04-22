"""
embeddings.py
-------------
Phase 11 → 12 upgrade: Higher-fidelity chunking with overlap.

Chunking strategy:
  - Python  → split by def / async def / class, with 3-line look-ahead overlap
              + inject module-level docstring as separate chunk
  - JS/TS   → split by function / class / export definitions
  - Markdown → split by ALL heading levels (h1–h4) + paragraph fallback
               README files get extra fine-grained paragraph splitting
  - JSON/YAML → fixed 600-char windows with 150-char overlap
  - Generic   → 700-char windows with 200-char overlap

Key improvements over v12:
  - README paragraph cap tightened to 250 chars so single-line technical
    facts (accuracy, model name, param counts) are their own chunks
  - Technical-keyword short-circuit: paragraphs containing domain terms
    (accuracy / model / parameter / dataset / …) are always emitted alone

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

MAX_FILE_CHARS = 60_000   # raised from 40k so large READMEs aren't truncated

# README file names (case-insensitive)
_README_NAMES = {"readme.md", "readme.rst", "readme.txt", "readme"}


def _is_readme(path: str) -> bool:
    return path.replace("\\", "/").split("/")[-1].lower() in _README_NAMES


# ── Overlap helper ────────────────────────────────────────────────────────────

def _add_overlap(chunks: list[dict], overlap_chars: int = 150) -> list[dict]:
    """
    Append a tail snippet from chunk[i] to the start of chunk[i+1].
    This prevents technical keywords from being cut at a boundary.
    """
    if len(chunks) < 2:
        return chunks
    result = [chunks[0]]
    for i in range(1, len(chunks)):
        prev_tail = chunks[i - 1]["text"][-overlap_chars:].strip()
        merged_text = prev_tail + "\n" + chunks[i]["text"]
        result.append({**chunks[i], "text": merged_text[:3_500]})
    return result


# ── Per-language chunkers ─────────────────────────────────────────────────────

def _chunk_python(content: str, path: str) -> list[dict]:
    """
    Split Python source at top-level and class-method boundaries.

    Improvements:
    - Module-level docstring / constants emitted as own chunk
    - 3-line look-behind overlap added between adjacent blocks
    - Chunks capped at 2500 chars to keep them focused
    """
    lines = content.split("\n")
    block_start_re = re.compile(
        r"^(\s*)(async\s+def\s+\w|def\s+\w|class\s+\w)"
    )

    starts: list[int] = []
    for i, line in enumerate(lines):
        if block_start_re.match(line):
            starts.append(i)

    if not starts:
        return _chunk_generic(content, path)

    chunks: list[dict] = []

    # Module-level preamble (imports, constants, docstrings before first def)
    if starts[0] > 0:
        preamble = "\n".join(lines[: starts[0]]).strip()
        if len(preamble) > 30:
            chunks.append({"path": path, "text": preamble[:2_500], "type": "module"})

    for idx, start in enumerate(starts):
        # 3-line overlap from previous block
        overlap_start = max(0, start - 3)
        end = starts[idx + 1] if idx + 1 < len(starts) else len(lines)
        text = "\n".join(lines[overlap_start:end]).strip()
        if len(text) > 30:
            chunks.append({"path": path, "text": text[:2_500], "type": "function"})

    return chunks or [{"path": path, "text": content[:2_000], "type": "file"}]


def _chunk_js(content: str, path: str) -> list[dict]:
    """Split JS/TS by function / class / export definitions with overlap."""
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
            chunks.append({"path": path, "text": text[:2_500], "type": "function"})

    return _add_overlap(chunks, 120) or [{"path": path, "text": content[:2_000], "type": "file"}]


def _chunk_markdown(content: str, path: str, fine_grained: bool = False) -> list[dict]:
    """
    Split Markdown by ALL heading levels (h1–h4).

    For README files (fine_grained=True):
    - Split long sections into paragraph-level sub-chunks.
    - Technical paragraphs (those containing domain keywords such as
      accuracy, model, parameter, dataset, loss …) are always emitted
      as their own chunk, regardless of length, so they remain independently
      retrievable.
    - The accumulation cap is 250 chars (down from 600) so single-line
      technical facts never get buried inside a multi-line blob.
    """
    # Keywords whose presence forces an immediate paragraph flush
    _TECH_KEYWORDS = {
        "accuracy", "model", "parameter", "dataset", "loss", "epoch",
        "f1", "backbone", "checkpoint", "pretrained", "benchmark",
        "inference", "latency", "precision", "recall", "metric",
        "train", "test", "val", "score", "top-1", "top-5", "map",
        "weight", "layer", "architecture", "resnet", "vgg", "bert",
        "transformer", "encoder", "decoder", "optimizer", "lr", "batch",
    }

    def _is_technical(text: str) -> bool:
        """True if the text contains at least one technical domain keyword."""
        words = set(re.findall(r"[a-z0-9_-]+", text.lower()))
        return bool(words & _TECH_KEYWORDS)

    # Split on any heading level 1-4
    sections = re.split(r"\n(?=#{1,4}\s)", content)

    chunks: list[dict] = []
    for section in sections:
        text = section.strip()
        if len(text) < 15:
            continue

        if fine_grained:
            # For README: further split on blank-line paragraph boundaries
            paragraphs = re.split(r"\n{2,}", text)
            para_buf = ""
            for para in paragraphs:
                para = para.strip()
                if not para:
                    continue
                # Force-flush current buffer before a technical paragraph
                if _is_technical(para):
                    if para_buf:
                        chunks.append({"path": path, "text": para_buf, "type": "section"})
                        para_buf = ""
                    # Emit the technical paragraph as its own dedicated chunk
                    chunks.append({"path": path, "text": para, "type": "section"})
                # Accumulate non-technical paragraphs up to 250 chars
                elif len(para_buf) + len(para) + 2 < 250:
                    para_buf = (para_buf + "\n\n" + para).strip()
                else:
                    if para_buf:
                        chunks.append({"path": path, "text": para_buf, "type": "section"})
                    para_buf = para
            if para_buf:
                chunks.append({"path": path, "text": para_buf, "type": "section"})
        else:
            # Standard mode: keep sections together, sub-split only if very large
            if len(text) > 1_800:
                for i in range(0, len(text), 1_500):
                    sub = text[i: i + 1_800].strip()
                    if sub:
                        chunks.append({"path": path, "text": sub, "type": "section"})
            else:
                chunks.append({"path": path, "text": text, "type": "section"})

    return _add_overlap(chunks, 100) or [{"path": path, "text": content[:2_000], "type": "file"}]


def _chunk_generic(content: str, path: str) -> list[dict]:
    """700-char sliding window with 200-char overlap (improved from 800/700)."""
    window, step = 700, 500   # step=500 → 200-char overlap
    chunks = []
    for i in range(0, len(content), step):
        text = content[i: i + window].strip()
        if len(text) > 30:
            chunks.append({"path": path, "text": text, "type": "chunk"})
    return chunks or [{"path": path, "text": content[:700], "type": "file"}]


def chunk_file(path: str, content: str) -> list[dict]:
    """Route to the appropriate chunker based on file extension."""
    content = content[:MAX_FILE_CHARS]
    ext = ("." + path.rsplit(".", 1)[-1].lower()) if "." in path else ""

    if ext == ".py":
        return _chunk_python(content, path)
    if ext in {".js", ".ts", ".tsx", ".jsx"}:
        return _chunk_js(content, path)
    if ext == ".md":
        return _chunk_markdown(content, path, fine_grained=_is_readme(path))
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

    README files are tagged with is_readme=True so the retriever can
    apply a small score boost.
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

        is_readme = _is_readme(path)

        try:
            file_chunks = chunk_file(path, content)
            # Tag README chunks for retriever boosting
            if is_readme:
                for c in file_chunks:
                    c["is_readme"] = True
            all_chunks.extend(file_chunks)
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
