import os
import shutil
import git

BASE_REPO_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "../../../repos")
)


def clone_repository(repo_url: str):

    repo_name = repo_url.split("/")[-1].replace(".git", "")
    clone_path = os.path.join(BASE_REPO_DIR, repo_name)

    # If stale clone exists, remove it before re-cloning
    if os.path.exists(clone_path):
        shutil.rmtree(clone_path, ignore_errors=True)

    # Shallow clone: depth=1 fetches only the latest commit
    git.Repo.clone_from(repo_url, clone_path, depth=1)

    return clone_path


def delete_repository(clone_path: str):
    """Remove cloned repo from disk after analysis is complete."""
    if clone_path and os.path.exists(clone_path):
        shutil.rmtree(clone_path, ignore_errors=True)