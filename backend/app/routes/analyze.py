from fastapi import APIRouter
from app.services.repo_cloner import clone_repository

router = APIRouter(prefix="/analyze", tags=["analysis"])


@router.post("/")
def analyze_repo(repo_url: str):

    clone_path = clone_repository(repo_url)

    return {
        "repo_url": repo_url,
        "clone_location": clone_path,
        "status": "repository cloned successfully"
    }