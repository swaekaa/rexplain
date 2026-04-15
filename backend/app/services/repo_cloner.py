import os
import stat
import shutil
import subprocess
import time

BASE_REPO_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "../../../repos")
)

# Hard ceiling: if git clone takes longer than this, abort.
CLONE_TIMEOUT_SECONDS = 30

# Fast pre-check: ls-remote must finish within this to prove repo is reachable.
LS_REMOTE_TIMEOUT = 8


class CloneTimeoutError(Exception):
    """Raised when git clone does not complete within CLONE_TIMEOUT_SECONDS."""


class CloneError(Exception):
    """Raised when git clone exits with a non-zero status code."""


class RepoNotAccessibleError(Exception):
    """Raised when the repository is private, non-existent, or unreachable."""


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _force_remove_readonly(func, path, exc_info):
    """
    onerror callback for shutil.rmtree on Windows.
    Git marks pack-files and index files as read-only.
    Removes the read-only bit and retries the delete.
    """
    try:
        os.chmod(path, stat.S_IWRITE)
        func(path)
    except Exception:
        pass  # best-effort


def delete_repository(clone_path: str):
    """Remove a cloned repo from disk; Windows-safe, handles read-only git objects."""
    if clone_path and os.path.exists(clone_path):
        shutil.rmtree(clone_path, onerror=_force_remove_readonly)


def _kill_process_tree(pid: int):
    """
    Kill a process and ALL its descendants on Windows.

    Why: git spawns child processes (git-remote-https.exe, ssh.exe).
    proc.kill() only terminates the parent — children keep running and
    hold file handles, causing PermissionError [WinError 32] on cleanup.

    taskkill /F /T /PID kills the entire job tree atomically.
    """
    subprocess.run(
        ["taskkill", "/F", "/T", "/PID", str(pid)],
        capture_output=True,   # silence taskkill output
    )


def _check_repo_accessible(repo_url: str) -> None:
    """
    Run `git ls-remote --exit-code <url>` with a short timeout.

    This is a fast (~1–3 s) handshake that:
      - Returns exit 0   → repo is public and reachable  ✓
      - Returns exit 2   → repo exists but is empty       ✓ (allow clone attempt)
      - Returns exit 128 → repo is private/404/bad URL    → raise RepoNotAccessibleError
      - Times out        → network issue                  → raise RepoNotAccessibleError

    Prevents wasting 30 seconds on a doomed clone.
    """
    t0 = time.perf_counter()
    try:
        proc = subprocess.Popen(
            ["git", "ls-remote", "--exit-code", "--heads", repo_url],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.PIPE,
            text=True,
            env={**os.environ, "GIT_TERMINAL_PROMPT": "0"},  # never prompt for password
        )
        _, stderr = proc.communicate(timeout=LS_REMOTE_TIMEOUT)
        elapsed = time.perf_counter() - t0

        # exit 2 = repo exists but has no heads (empty) — still cloneable
        if proc.returncode in (0, 2):
            print(f"[info] repo accessible (ls-remote {elapsed:.1f}s)")
            return

        # exit 128 = fatal: repository not found / auth required
        stderr_clean = (stderr or "").strip()
        print(f"[error] ls-remote failed (exit {proc.returncode}) → {stderr_clean}")
        raise RepoNotAccessibleError(
            "Repository is private or does not exist. "
            "Only public repositories are supported."
        )

    except subprocess.TimeoutExpired:
        _kill_process_tree(proc.pid)
        proc.communicate()
        print(f"[error] ls-remote timed out after {LS_REMOTE_TIMEOUT}s → {repo_url}")
        raise RepoNotAccessibleError(
            "Could not reach the repository. "
            "Check the URL or your network connection."
        )


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def clone_repository(repo_url: str) -> str:
    """
    Clone a GitHub repository using subprocess + system git.

    Pre-check:
      Runs git ls-remote first (8 s timeout) to detect private / missing repos
      before committing to a full 30-second clone attempt.

    Clone flags:
      --depth 1       — shallow clone, latest commit only
      --single-branch — fetch only the default branch ref

    Raises:
        RepoNotAccessibleError — repo is private, missing, or unreachable
        CloneTimeoutError      — clone exceeded CLONE_TIMEOUT_SECONDS
        CloneError             — git exited non-zero
    """
    # ── Fast accessibility check ──────────────────────────────────────────
    _check_repo_accessible(repo_url)

    repo_name = repo_url.rstrip("/").split("/")[-1].replace(".git", "")
    clone_path = os.path.join(BASE_REPO_DIR, repo_name)

    # Guaranteed clean slate
    if os.path.exists(clone_path):
        delete_repository(clone_path)

    cmd = [
        "git", "clone",
        "--depth", "1",
        "--single-branch",
        repo_url,
        clone_path,
    ]

    print(f"[timing] clone started  →  {repo_url}")
    t0 = time.perf_counter()

    proc = subprocess.Popen(
        cmd,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.PIPE,
        text=True,
        env={**os.environ, "GIT_TERMINAL_PROMPT": "0"},  # never prompt for password
    )

    try:
        _, stderr = proc.communicate(timeout=CLONE_TIMEOUT_SECONDS)

    except subprocess.TimeoutExpired:
        _kill_process_tree(proc.pid)
        proc.communicate()

        elapsed = time.perf_counter() - t0
        print(f"[error] clone timeout after {elapsed:.1f}s  →  {repo_url}")
        delete_repository(clone_path)
        raise CloneTimeoutError(
            "Repository clone timed out — the repo may be too large."
        )

    elapsed = time.perf_counter() - t0

    if proc.returncode != 0:
        stderr_msg = (stderr or "").strip() or "unknown git error"
        print(f"[error] clone failed  →  {stderr_msg}")
        delete_repository(clone_path)
        raise CloneError(stderr_msg)

    print(f"[timing] clone finished in {elapsed:.2f}s")
    return clone_path