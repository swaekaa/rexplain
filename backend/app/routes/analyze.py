from fastapi import APIRouter
from app.services.repo_cloner import clone_repository
from app.services.repo_scanner import scan_repository

router = APIRouter(prefix="/analyze", tags=["analysis"])


@router.post("/")
def analyze_repo(repo_url: str):

    clone_path = clone_repository(repo_url)

    scan_data = scan_repository(clone_path)

    return {
        "repo_url": repo_url,
        "scan_results": scan_data
    }