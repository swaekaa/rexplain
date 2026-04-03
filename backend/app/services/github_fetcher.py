"""
github_fetcher.py
-----------------
Fast metadata-first GitHub repository analysis.

Strategy (same approach as Sourcegraph, Snyk, CodeClimate):
  1. Call GitHub Trees API  → get full file path list as JSON (no file content)
  2. Fetch priority manifest files in parallel via raw.githubusercontent.com
  3. Build scan_data + file_contents entirely in memory
  4. Never clone the repository

This replaces the clone + os.walk pipeline for analysis of public repos.
Falls back to None so the caller can trigger a clone-based fallback.
"""

import os
import time
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed

import requests

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

# Files we always want — fetched at root level first.
PRIORITY_FILES = [
    "requirements.txt",
    "package.json",
    "pyproject.toml",
    "Dockerfile",
    "setup.py",
    "pom.xml",
    "build.gradle",
    "go.mod",
    "Cargo.toml",
    "composer.json",
    "README.md",
    ".gitignore",
]

# These bare filenames carry dependency signals wherever they appear in the tree.
# We search the tree for them and fetch the first few found at any depth.
MANIFEST_NAMES = {
    "requirements.txt", "package.json", "pyproject.toml",
    "setup.py", "Pipfile", "go.mod", "Cargo.toml",
    "pom.xml", "build.gradle", "composer.json",
}

# Paths containing these segments carry no useful source signal.
SKIP_SEGMENTS = {
    ".git", "node_modules", "dist", "build",
    "venv", ".venv", "__pycache__", ".next",
    ".nuxt", "out", ".cache", ".tox",
}

# Files we surface as key entry-points in the response.
IMPORTANT_NAMES = {
    "main.py", "app.py", "server.py", "index.js",
    "package.json", "requirements.txt",
}

# Network timeouts
TREE_TIMEOUT = 8    # seconds — GitHub Trees API
FILE_TIMEOUT = 5    # seconds — per raw file fetch
MAX_FILE_WORKERS = 10  # parallel HTTP workers for priority files


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _parse_repo_url(repo_url: str) -> tuple[str, str]:
    """Extract (owner, repo_name) from a github.com URL."""
    parts = repo_url.rstrip("/").split("/")
    return parts[-2], parts[-1].replace(".git", "")


def _fetch_raw_file(owner: str, repo: str, path: str) -> tuple[str, str | None]:
    """
    Fetch a single file from raw.githubusercontent.com.
    Returns (path, content_or_None).
    HEAD ref works for both 'main' and 'master' branches.
    """
    url = f"https://raw.githubusercontent.com/{owner}/{repo}/HEAD/{path}"
    try:
        r = requests.get(url, timeout=FILE_TIMEOUT)
        if r.status_code == 200:
            return path, r.text
    except Exception:
        pass
    return path, None


def _fetch_file_tree(owner: str, repo: str) -> list[str] | None:
    """
    Call GitHub Trees API to get every file path in the repo as a list.
    Returns None on failure (rate limit, private repo, network error).

    Note: 'truncated' is True for repos with > 100,000 files.
    We still use the partial list, which covers 99%+ of real repos.
    """
    url = (
        f"https://api.github.com/repos/{owner}/{repo}"
        f"/git/trees/HEAD?recursive=1"
    )
    headers = {"Accept": "application/vnd.github.v3+json"}
    try:
        r = requests.get(url, timeout=TREE_TIMEOUT, headers=headers)
        if r.status_code == 200:
            data = r.json()
            return [
                item["path"]
                for item in data.get("tree", [])
                if item["type"] == "blob"
            ]
    except Exception:
        pass
    return None


def _build_scan_data(paths: list[str]) -> dict:
    """Convert a list of file paths (from Trees API) into the same dict
    shape that repo_scanner.scan_repository() produces."""
    ext_counts = defaultdict(int)
    key_files = []
    included = 0

    for path in paths:
        segments = path.split("/")
        # Skip paths that go through a heavy directory
        if any(seg in SKIP_SEGMENTS for seg in segments[:-1]):
            continue

        included += 1
        filename = segments[-1]
        ext = os.path.splitext(filename)[1]
        if ext:
            ext_counts[ext] += 1

        if filename in IMPORTANT_NAMES and len(key_files) < 10:
            key_files.append(path)

    return {
        "total_files": included,
        "languages": dict(ext_counts),
        "key_files": key_files,
    }


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def fetch_repo_fast(repo_url: str) -> tuple[dict, dict] | tuple[None, None]:
    """
    Attempt a fast, clone-free analysis of a public GitHub repository.

    Returns:
        (scan_data, file_contents)  — on success
        (None, None)                — on any failure (caller should clone instead)

    scan_data    matches the shape returned by repo_scanner.scan_repository()
    file_contents is a dict of {filename: text_content} for priority files found
    """
    try:
        owner, repo = _parse_repo_url(repo_url)
    except (IndexError, ValueError):
        return None, None

    # ── Step 1: File tree (gives us counts + language breakdown) ──────────
    t0 = time.perf_counter()
    paths = _fetch_file_tree(owner, repo)
    print(f"[timing] tree API done in {time.perf_counter() - t0:.2f}s "
          f"({'truncated' if paths and len(paths) >= 100000 else f'{len(paths)} files' if paths else 'failed'})")

    if paths is None:
        print("[info] tree API unavailable — falling back to clone")
        return None, None

    scan_data = _build_scan_data(paths)

    # ── Step 2: Build fetch list ───────────────────────────────────────────
    # Start with root-level priority files, then add the first occurrence of
    # each manifest type found anywhere in the tree (catches non-standard
    # repo layouts where requirements.txt lives in a subdirectory).
    fetch_paths = list(PRIORITY_FILES)  # root-level candidates

    seen_manifests: set[str] = set(PRIORITY_FILES)  # avoid duplicates
    extra_cap = 6  # max extra deep manifests to fetch

    for tree_path in paths:
        if extra_cap <= 0:
            break
        basename = os.path.basename(tree_path)
        # Only grab manifests we haven't already scheduled AND that are nested
        if basename in MANIFEST_NAMES and tree_path not in seen_manifests:
            segments = tree_path.split("/")
            # Skip paths that go through heavy dirs
            if not any(seg in SKIP_SEGMENTS for seg in segments[:-1]):
                fetch_paths.append(tree_path)
                seen_manifests.add(tree_path)
                extra_cap -= 1

    # ── Step 3: Parallel raw file fetches ────────────────────────────────
    t1 = time.perf_counter()
    file_contents: dict[str, str] = {}

    with ThreadPoolExecutor(max_workers=MAX_FILE_WORKERS) as pool:
        futures = {
            pool.submit(_fetch_raw_file, owner, repo, fpath): fpath
            for fpath in fetch_paths
        }
        for fut in as_completed(futures):
            path, content = fut.result()
            if content is not None:
                # Store under bare filename for consistent lookup by the detector.
                # If multiple subdirectory manifests share the same name we merge
                # their content so all dependencies are visible.
                key = os.path.basename(path)
                if key in file_contents:
                    file_contents[key] = file_contents[key] + "\n" + content
                else:
                    file_contents[key] = content

    found = sum(1 for p in fetch_paths if os.path.basename(p) in file_contents)
    print(f"[timing] file fetches done in {time.perf_counter() - t1:.2f}s "
          f"({found}/{len(fetch_paths)} found, {len(fetch_paths) - len(PRIORITY_FILES)} deep manifests)")

    return scan_data, file_contents
