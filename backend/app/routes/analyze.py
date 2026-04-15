import time

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
)

router = APIRouter(prefix="/analyze", tags=["analysis"])


class RepoRequest(BaseModel):
    repo_url: str


@router.post("/")
def analyze_repo(request: RepoRequest):

    repo_url = request.repo_url
    clone_path = None

    try:
        t0 = time.perf_counter()

        # ── Phase 10 intelligence containers (populated per path) ─────────
        file_tree_paths: list[str] | None = None
        file_contents_map: dict | None = None

        # ── Fast path: GitHub API (no clone, no disk I/O) ─────────────────
        # Tries GitHub Trees API + parallel raw file fetches.
        # Completes in ~2–5 seconds for public repos.
        # Returns (None, None) for private repos or rate-limited requests.

        scan_data, file_contents = fetch_repo_fast(repo_url)

        if scan_data is not None and file_contents is not None:
            # API path succeeded — detect frameworks from in-memory content
            print(f"[timing] fast fetch done in {time.perf_counter() - t0:.2f}s")

            t1 = time.perf_counter()
            framework_data = detect_frameworks_from_content(file_contents, scan_data)
            print(f"[timing] framework detection done in {time.perf_counter() - t1:.2f}s "
                  f"(detected={framework_data})")

            # Phase 10: use full file path list now embedded in scan_data
            file_contents_map = file_contents
            file_tree_paths = scan_data.get("file_paths", list(file_contents.keys()))

        else:
            # ── Slow path: full clone fallback ─────────────────────────────
            # Used when the repo is private or the GitHub API is unavailable.
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

            # Build a minimal file_contents for intelligence (read key files)
            file_contents_map = {}
            file_tree_paths = scan_data.get("key_files", [])

            # Attempt to read README from cloned path
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

            # Read key Python/JS files for route detection
            for key_file in scan_data.get("key_files", []):
                full_path = os.path.join(clone_path, key_file)
                if os.path.exists(full_path):
                    try:
                        with open(full_path, "r", encoding="utf-8", errors="ignore") as kf:
                            file_contents_map[os.path.basename(key_file)] = kf.read(16_384)
                    except OSError:
                        pass

        # ── Shared path: architecture + diagram + explanation ─────────────
        architecture = build_architecture(framework_data)

        repo_name = repo_url.rstrip("/").split("/")[-1].replace(".git", "")

        # ── Phase 10: Intelligence enrichment ────────────────────────────────
        t_intel = time.perf_counter()

        readme_content = extract_readme(file_contents_map or {})

        # For important_files and folder_explanations we need the full tree.
        # Use key_files from scan_data as best approximation when tree unavailable.
        tree_for_intel = (
            file_tree_paths
            if file_tree_paths
            else scan_data.get("key_files", [])
        )

        important_files    = detect_important_files(tree_for_intel)
        api_routes         = extract_api_routes(file_contents_map or {})
        folder_explanations = explain_folders(tree_for_intel)

        print(f"[timing] intelligence done in {time.perf_counter() - t_intel:.2f}s "
              f"(routes={len(api_routes)}, files={len(important_files)})")

        # ── Diagram (pass tree paths for richer clusters) ─────────────────
        t3 = time.perf_counter()
        diagram = generate_architecture_diagram(
            architecture,
            repo_name,
            file_tree_paths=tree_for_intel,
        )
        print(f"[timing] diagram done in {time.perf_counter() - t3:.2f}s")

        explanation = generate_repo_explanation(framework_data, scan_data)

        # ── Phase 11: Build RAG vector store (non-blocking, non-fatal) ────────
        t_rag = time.perf_counter()
        rag_ready = False
        try:
            from app.services.embeddings import build_chunks, get_model
            from app.services.retriever import build_store as rag_build_store

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
            rag_build_store(repo_url, rag_chunks, rag_model)
            rag_ready = True
            print(f"[timing] RAG index built in {time.perf_counter() - t_rag:.2f}s "
                  f"({len(rag_chunks)} chunks)")
        except Exception as rag_err:
            print(f"[rag] index build skipped: {rag_err}")

        print(f"[timing] TOTAL pipeline: {time.perf_counter() - t0:.2f}s")

        return {
            "repo_url": repo_url,
            "scan_results": scan_data,
            "framework_detection": framework_data,
            "architecture": architecture,
            "diagram": diagram,
            "ai_explanation": explanation,
            # ── Phase 10 additions ────────────────────────────────────────
            "readme": readme_content,
            "api_routes": api_routes,
            "important_files": important_files,
            "folder_explanations": folder_explanations,
            # ── Phase 11: chat readiness flag ─────────────────────────────
            "rag_ready": rag_ready,
        }

    except RepoNotAccessibleError as e:
        raise HTTPException(status_code=403, detail=str(e))

    except CloneTimeoutError as e:
        raise HTTPException(status_code=408, detail=str(e))

    except CloneError as e:
        raise HTTPException(status_code=422, detail=f"Clone failed: {e}")

    finally:
        # Only runs if clone fallback was used
        delete_repository(clone_path)