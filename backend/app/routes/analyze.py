from fastapi import APIRouter
from pydantic import BaseModel

from app.services.repo_cloner import clone_repository, delete_repository
from app.services.repo_scanner import scan_repository
from app.services.dependency_parser import detect_frameworks
from app.services.architecture_builder import build_architecture
from app.services.diagram_generator import generate_architecture_diagram
from app.services.ai_explainer import generate_repo_explanation

router = APIRouter(prefix="/analyze", tags=["analysis"])


class RepoRequest(BaseModel):
    repo_url: str


@router.post("/")
def analyze_repo(request: RepoRequest):

    repo_url = request.repo_url
    clone_path = None

    try:
        clone_path = clone_repository(repo_url)

        scan_data = scan_repository(clone_path)

        framework_data = detect_frameworks(clone_path)

        architecture = build_architecture(framework_data)

        repo_name = repo_url.split("/")[-1]

        diagram = generate_architecture_diagram(architecture, repo_name)

        explanation = generate_repo_explanation(framework_data, scan_data)

        return {
            "repo_url": repo_url,
            "scan_results": scan_data,
            "framework_detection": framework_data,
            "architecture": architecture,
            "diagram": diagram,
            "ai_explanation": explanation
        }

    finally:
        # Guaranteed cleanup: always delete the cloned repo after analysis
        delete_repository(clone_path)