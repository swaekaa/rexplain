from fastapi import APIRouter
from app.services.repo_cloner import clone_repository
from app.services.repo_scanner import scan_repository
from app.services.dependency_parser import detect_frameworks
from app.services.architecture_builder import build_architecture

router = APIRouter(prefix="/analyze", tags=["analysis"])


@router.post("/")
def analyze_repo(repo_url: str):

    clone_path = clone_repository(repo_url)

    scan_data = scan_repository(clone_path)

    framework_data = detect_frameworks(clone_path)

    architecture = build_architecture(framework_data)

    return {
        "repo_url": repo_url,
        "scan_results": scan_data,
        "framework_detection": framework_data,
        "architecture": architecture
    }