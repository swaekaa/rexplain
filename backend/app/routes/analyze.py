import time

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services.repo_cloner import clone_repository, delete_repository, CloneTimeoutError, CloneError
from app.services.repo_scanner import scan_repository
from app.services.dependency_parser import detect_frameworks, detect_frameworks_from_content
from app.services.github_fetcher import fetch_repo_fast
from app.services.architecture_builder import build_architecture
from app.services.diagram_generator import generate_architecture_diagram
from app.services.ai_explainer import generate_repo_explanation

router = APIRouter(prefix="/analyze", tags=["analysis"])


class RepoRequest(BaseModel):
    repo_url: str


@router.post("/")
def analyze_repo(request: RepoRequest):

    repo_url = request.repo_url
    clone_path = None

    try:
        t0 = time.perf_counter()

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

        # ── Shared path: architecture + diagram + explanation ─────────────
        architecture = build_architecture(framework_data)

        repo_name = repo_url.split("/")[-1]

        t3 = time.perf_counter()
        diagram = generate_architecture_diagram(architecture, repo_name)
        print(f"[timing] diagram done in {time.perf_counter() - t3:.2f}s")

        explanation = generate_repo_explanation(framework_data, scan_data)

        print(f"[timing] TOTAL pipeline: {time.perf_counter() - t0:.2f}s")

        return {
            "repo_url": repo_url,
            "scan_results": scan_data,
            "framework_detection": framework_data,
            "architecture": architecture,
            "diagram": diagram,
            "ai_explanation": explanation,
        }

    except CloneTimeoutError as e:
        raise HTTPException(status_code=408, detail=str(e))

    except CloneError as e:
        raise HTTPException(status_code=422, detail=f"Clone failed: {e}")

    finally:
        # Only runs if clone fallback was used
        delete_repository(clone_path)