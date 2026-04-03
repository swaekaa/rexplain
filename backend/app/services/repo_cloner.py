import os
import stat
import shutil
import git

BASE_REPO_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "../../../repos")
)


def _force_remove_readonly(func, path, exc_info):
    """
    onerror callback for shutil.rmtree on Windows.
    Git marks pack-files and object files as read-only.
    This handler removes the read-only bit and retries the delete.
    """
    os.chmod(path, stat.S_IWRITE)
    func(path)


def delete_repository(clone_path: str):
    """Remove a cloned repo from disk, force-removing read-only git objects."""
    if clone_path and os.path.exists(clone_path):
        shutil.rmtree(clone_path, onerror=_force_remove_readonly)


def clone_repository(repo_url: str) -> str:
    """
    Shallow-clone a GitHub repo (depth=1).
    Always deletes any existing clone at that path first to avoid
    'destination path already exists' errors on Windows.
    """
    repo_name = repo_url.rstrip("/").split("/")[-1].replace(".git", "")
    clone_path = os.path.join(BASE_REPO_DIR, repo_name)

    # Guaranteed clean slate — force-removes even read-only .git objects
    if os.path.exists(clone_path):
        delete_repository(clone_path)

    # Shallow clone: only the latest commit, no history
    git.Repo.clone_from(repo_url, clone_path, depth=1)

    return clone_path