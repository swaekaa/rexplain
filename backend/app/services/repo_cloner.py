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


class CloneTimeoutError(Exception):
    """Raised when git clone does not complete within CLONE_TIMEOUT_SECONDS."""


class CloneError(Exception):
    """Raised when git clone exits with a non-zero status code."""


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


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def clone_repository(repo_url: str) -> str:
    """
    Clone a GitHub repository using subprocess + system git.

    Why subprocess instead of GitPython:
      subprocess.Popen gives us direct control over the OS process,
      letting us terminate the entire process tree on timeout via taskkill.
      GitPython + ThreadPoolExecutor only stops waiting — the git.exe process
      keeps running and holds file handles, causing WinError 32 on cleanup.

    Clone flags:
      --depth 1       — shallow clone, latest commit only
      --single-branch — fetch only the default branch ref
      (no --filter: blobless clones negotiate slowly on large repos)

    Raises:
        CloneTimeoutError  — clone exceeded CLONE_TIMEOUT_SECONDS
        CloneError         — git exited non-zero (bad URL, private repo, etc.)
    """
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
        stdout=subprocess.DEVNULL,   # we don't need git's stdout
        stderr=subprocess.PIPE,       # capture stderr for error messages
        text=True,
    )

    try:
        _, stderr = proc.communicate(timeout=CLONE_TIMEOUT_SECONDS)

    except subprocess.TimeoutExpired:
        # Kill entire process tree (parent + git-remote-https.exe etc.)
        _kill_process_tree(proc.pid)
        proc.communicate()  # drain pipes — fast, process is now dead

        elapsed = time.perf_counter() - t0
        print(f"[error] clone timeout after {elapsed:.1f}s  →  {repo_url}")
        delete_repository(clone_path)
        raise CloneTimeoutError(
            "Repository clone timed out (repo too large or slow network)"
        )

    elapsed = time.perf_counter() - t0

    if proc.returncode != 0:
        stderr_msg = (stderr or "").strip() or "unknown git error"
        print(f"[error] clone failed  →  {stderr_msg}")
        delete_repository(clone_path)
        raise CloneError(stderr_msg)

    print(f"[timing] clone finished in {elapsed:.2f}s")
    return clone_path