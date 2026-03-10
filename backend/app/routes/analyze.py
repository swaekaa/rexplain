from fastapi import APIRouter

router = APIRouter(prefix="/analyze", tags=["analysis"])

@router.post("/")
def analyze_repo(repo_url: str):
    return {
        "repo_url": repo_url,
        "status": "analysis pipeline will start here"
    }