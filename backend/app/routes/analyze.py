"""
analyze.py  (Phase 14: PostgreSQL cache)
-----------------------------------------
Cache-first analysis endpoint.

Flow
----
1. Check DB for repo_url
2. Fetch latest commit SHA via GitHub API
3a. SHA matches → return cached analysis + restore RAG store → done (<1 s)
3b. SHA changed / not cached → run full pipeline → store result + RAG

Safety
------
* Every DB operation is wrapped in try/except; failures fall back gracefully.
* If DATABASE_URL is missing the route works exactly as before (no cache).

Logs
----
  [cache] hit      — returned from DB, no pipeline
  [cache] miss     — not in DB
  [cache] stale    — SHA changed, re-analysing
  [cache] updated  — new result written to DB
"""

import time
import logging

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services.repo_cloner import clone_repository, delete_repository, CloneTimeoutError, CloneError, RepoNotAccessibleError
from app.services.repo_scanner import scan_repository
from app.services.dependency_parser import detect_frameworks, detect_frameworks_from_content
from app.services.github_fetcher import fetch_repo_fast
from app.services.architecture_builder import build_architecture
from app.services.diagram_generator import generate_architecture_diagram
from app.services.ai_explainer import generate_repo_explanation
from app.services.repo_intelligence import (
    extract_readme,
    detect_important_files,
    extract_api_routes,
    explain_folders,
    detect_entry_points,
    detect_doc_links,
)
from app.services.repo_metadata import fetch_repo_metadata
import app.services.cache_db as cache_db
from app.services.graph_builder import build_interactive_graph

log = logging.getLogger("analyze")

router = APIRouter(prefix="/analyze", tags=["analysis"])


class RepoRequest(BaseModel):
    repo_url: str


# ── helpers ───────────────────────────────────────────────────────────────────

def _normalize_url(url: str) -> str:
    """Canonical form: lowercase, no trailing slash, no .git suffix."""
    url = url.strip().rstrip("/")
    if url.endswith(".git"):
        url = url[:-4]
    return url.lower()


def _try_restore_rag(repo_url: str, cached: dict) -> bool:
    """
    Attempt to restore the in-memory RAG store from cached embeddings + chunks.
    Returns True on success (chat will work immediately without re-embedding).
    """
    try:
        embeddings = cached.get("embeddings")
        chunks     = cached.get("chunks")
        if embeddings is not None and chunks:
            from app.services.retriever import restore_store
            restore_store(repo_url, embeddings, chunks)
            return True
    except Exception as exc:
        log.debug("[cache] RAG restore failed: %s", exc)
    return False


# ── route ─────────────────────────────────────────────────────────────────────

@router.post("/")
def analyze_repo(request: RepoRequest):

    repo_url   = _normalize_url(request.repo_url)
    clone_path = None

    try:
        t0 = time.perf_counter()

        # ── 1. Cache probe ────────────────────────────────────────────────────
        if cache_db.is_available():
            try:
                cached = cache_db.get_cached_analysis(repo_url)
                if cached is not None:
                    # Fetch latest SHA to validate freshness
                    latest_sha = cache_db.fetch_latest_commit_sha(repo_url)
                    if latest_sha is None or latest_sha == cached["sha"]:
                        # ── Cache HIT ─────────────────────────────────────────
                        log.info("[cache] hit  %s  (sha=%s)", repo_url, cached["sha"][:7])
                        rag_ready = _try_restore_rag(repo_url, cached)
                        result = dict(cached["analysis"])
                        result["rag_ready"]   = rag_ready
                        result["cache_hit"]   = True

                        # Rebuild interactive_graph if it's absent (cached before feature was added)
                        # or empty (graph builder previously returned no nodes).
                        graph = result.get("interactive_graph") or {}
                        if not graph.get("nodes"):
                            try:
                                tree = result.get("scan_results", {}).get("file_paths", [])
                                result["interactive_graph"] = build_interactive_graph(
                                    framework_data      = result.get("framework_detection", {}),
                                    scan_data           = result.get("scan_results", {}),
                                    api_routes          = result.get("api_routes", []),
                                    important_files     = result.get("important_files", []),
                                    folder_explanations = result.get("folder_explanations", {}),
                                    entry_points        = result.get("entry_points", []),
                                    file_tree_paths     = tree or None,
                                )
                                print("[graph] rebuilt for cached result")
                            except Exception as graph_err:
                                print(f"[graph] rebuild skipped: {graph_err}")
                                result["interactive_graph"] = {"nodes": [], "edges": []}

                        result["response_ms"] = int((time.perf_counter() - t0) * 1000)
                        print(f"[cache] hit — served in {result['response_ms']} ms")
                        return result
                    else:
                        log.info("[cache] stale %s  (stored=%s  latest=%s)",
                                 repo_url, cached["sha"][:7], latest_sha[:7])
                        print(f"[cache] stale — SHA changed, re-analysing")
                else:
                    log.info("[cache] miss %s", repo_url)
                    print("[cache] miss — running full pipeline")
            except Exception as exc:
                log.warning("[cache] probe error — continuing without cache: %s", exc)
        else:
            # Fetch SHA anyway — stored for later upsert
            pass

        # Fetch SHA for storage (if probe path skipped it)
        latest_sha = cache_db.fetch_latest_commit_sha(repo_url) or "unknown"

        # ── Phase 10 intelligence containers ──────────────────────────────────
        file_tree_paths: list[str] | None = None
        file_contents_map: dict | None = None

        # ── 2. Fast path: GitHub API ───────────────────────────────────────────
        scan_data, file_contents = fetch_repo_fast(repo_url)

        if scan_data is not None and file_contents is not None:
            print(f"[timing] fast fetch done in {time.perf_counter() - t0:.2f}s")

            t1 = time.perf_counter()
            framework_data = detect_frameworks_from_content(file_contents, scan_data)
            print(f"[timing] framework detection done in {time.perf_counter() - t1:.2f}s "
                  f"(detected={framework_data})")

            file_contents_map = file_contents
            file_tree_paths   = scan_data.get("file_paths", list(file_contents.keys()))

        else:
            # ── 3. Slow path: full clone fallback ──────────────────────────────
            print("[info] API path unavailable — falling back to clone")

            clone_path = clone_repository(repo_url)

            t1 = time.perf_counter()
            scan_data = scan_repository(clone_path)
            print(f"[timing] scan done in {time.perf_counter() - t1:.2f}s "
                  f"(total_files={scan_data['total_files']})")

            t2 = time.perf_counter()
            framework_data = detect_frameworks(clone_path)
            print(f"[timing] framework detection done in {time.perf_counter() - t2:.2f}s "
                  f"(detected={framework_data})")

            file_contents_map = {}
            file_tree_paths   = scan_data.get("key_files", [])

            import os
            for readme_name in ("README.md", "readme.md", "README.MD", "README.rst", "README.txt"):
                readme_path = os.path.join(clone_path, readme_name)
                if os.path.exists(readme_path):
                    try:
                        with open(readme_path, "r", encoding="utf-8", errors="ignore") as rf:
                            file_contents_map[readme_name] = rf.read()
                        break
                    except OSError:
                        pass

            for key_file in scan_data.get("key_files", []):
                full_path = os.path.join(clone_path, key_file)
                if os.path.exists(full_path):
                    try:
                        with open(full_path, "r", encoding="utf-8", errors="ignore") as kf:
                            file_contents_map[os.path.basename(key_file)] = kf.read(16_384)
                    except OSError:
                        pass

        # ── 4. Shared path: architecture + diagram + explanation ───────────────
        architecture = build_architecture(framework_data)

        repo_name = repo_url.rstrip("/").split("/")[-1].replace(".git", "")

        # ── 5. Phase 10: Intelligence enrichment ──────────────────────────────
        t_intel = time.perf_counter()

        readme_content = extract_readme(file_contents_map or {})

        tree_for_intel = (
            file_tree_paths
            if file_tree_paths
            else scan_data.get("key_files", [])
        )

        important_files     = detect_important_files(tree_for_intel)
        api_routes          = extract_api_routes(file_contents_map or {})
        folder_explanations = explain_folders(tree_for_intel)
        entry_points        = detect_entry_points(tree_for_intel)
        doc_links           = detect_doc_links(tree_for_intel)

        print(f"[timing] intelligence done in {time.perf_counter() - t_intel:.2f}s "
              f"(routes={len(api_routes)}, files={len(important_files)})")

        # ── 6. Diagram ────────────────────────────────────────────────────────
        t3 = time.perf_counter()
        diagram = generate_architecture_diagram(
            architecture,
            repo_name,
            file_tree_paths=tree_for_intel,
        )
        print(f"[timing] diagram done in {time.perf_counter() - t3:.2f}s")

        explanation = generate_repo_explanation(framework_data, scan_data)

        # ── 7. Metadata ───────────────────────────────────────────────────────
        metadata = fetch_repo_metadata(repo_url, clone_path)

        # ── 8. RAG embedding ──────────────────────────────────────────────────
        t_rag = time.perf_counter()
        rag_ready        = False
        rag_embeddings   = None
        rag_chunks_plain = None

        try:
            from app.services.embeddings import build_chunks, get_model
            from app.services.retriever import build_store as rag_build_store, serialize_store

            rag_chunks = build_chunks(
                file_contents_map or {},
                extra_context={
                    "ai_explanation":      explanation,
                    "folder_explanations": folder_explanations,
                    "api_routes":          api_routes,
                    "important_files":     important_files,
                },
            )
            rag_model = get_model()
            rag_store = rag_build_store(repo_url, rag_chunks, rag_model)
            rag_ready = True
            print(f"[timing] RAG index built in {time.perf_counter() - t_rag:.2f}s "
                  f"({len(rag_chunks)} chunks)")

            # Serialise for DB storage
            rag_embeddings, rag_chunks_plain = serialize_store(rag_store)

        except Exception as rag_err:
            print(f"[rag] index build skipped: {rag_err}")

        print(f"[timing] TOTAL pipeline: {time.perf_counter() - t0:.2f}s")

        # ── 9. Interactive graph ──────────────────────────────────────────────
        try:
            interactive_graph = build_interactive_graph(
                framework_data=framework_data,
                scan_data=scan_data,
                api_routes=api_routes,
                important_files=important_files,
                folder_explanations=folder_explanations,
                entry_points=entry_points,
                file_tree_paths=tree_for_intel,
            )
        except Exception as graph_err:
            print(f"[graph] build skipped: {graph_err}")
            interactive_graph = {"nodes": [], "edges": []}

        # ── 10. Compose response ──────────────────────────────────────────────
        result = {
            "repo_url":           repo_url,
            "scan_results":       scan_data,
            "framework_detection": framework_data,
            "architecture":       architecture,
            "diagram":            diagram,
            "ai_explanation":     explanation,
            "readme":             readme_content,
            "api_routes":         api_routes,
            "important_files":    important_files,
            "folder_explanations": folder_explanations,
            "entry_points":       entry_points,
            "doc_links":          doc_links,
            "metadata":           metadata,
            "rag_ready":          rag_ready,
            "cache_hit":          False,
            "interactive_graph":  interactive_graph,
        }

        # ── 10. Persist to cache ──────────────────────────────────────────────
        if cache_db.is_available():
            try:
                ok = cache_db.upsert_analysis(
                    repo_url   = repo_url,
                    commit_sha = latest_sha,
                    analysis   = result,
                    embeddings = rag_embeddings,
                    chunks     = rag_chunks_plain,
                )
                if ok:
                    log.info("[cache] updated %s  (sha=%s)", repo_url, latest_sha[:7])
                    print(f"[cache] updated — stored in DB")
            except Exception as exc:
                log.warning("[cache] upsert error (non-fatal): %s", exc)

        return result

    except RepoNotAccessibleError as e:
        raise HTTPException(status_code=403, detail=str(e))

    except CloneTimeoutError as e:
        raise HTTPException(status_code=408, detail=str(e))

    except CloneError as e:
        raise HTTPException(status_code=422, detail=f"Clone failed: {e}")

    finally:
        delete_repository(clone_path)