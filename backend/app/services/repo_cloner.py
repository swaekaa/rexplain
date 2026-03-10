import os
import git

BASE_REPO_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "../../../repos")
)

def clone_repository(repo_url: str):

    repo_name = repo_url.split("/")[-1].replace(".git", "")
    clone_path = os.path.join(BASE_REPO_DIR, repo_name)

    if os.path.exists(clone_path):
        return clone_path

    git.Repo.clone_from(repo_url, clone_path)

    return clone_path