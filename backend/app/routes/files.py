from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import requests
import base64
from app.services.github_fetcher import github_session

router = APIRouter(prefix="/files", tags=["files"])

class FileRequest(BaseModel):
    repo_url: str
    file_path: str

@router.post("/content")
def get_file_content(request: FileRequest):
    """Fetch file content from GitHub API directly."""
    repo_url = request.repo_url.rstrip("/")
    if "github.com" not in repo_url.lower():
        raise HTTPException(status_code=400, detail="Only GitHub URLs are supported for live file preview.")
    
    parts = repo_url.split("/")
    owner, repo = parts[-2], parts[-1].replace(".git", "")
    
    url = f"https://api.github.com/repos/{owner}/{repo}/contents/{request.file_path}"
    headers = {"Accept": "application/vnd.github.v3+json"}
    
    import os
    token = os.environ.get("GITHUB_TOKEN", "")
    if token:
        headers["Authorization"] = f"Bearer {token}"
        
    try:
        r = github_session.get(url, headers=headers, timeout=(10, 30))
        
        if r.status_code == 200:
            data = r.json()
            if data.get("encoding") == "base64":
                content = base64.b64decode(data["content"]).decode("utf-8", errors="ignore")
                return {"content": content}
            else:
                raise HTTPException(status_code=400, detail="File encoding not supported.")
        else:
            raise HTTPException(status_code=r.status_code, detail="File not found or not accessible.")
    except requests.exceptions.Timeout:
        print("[github] fetch timeout")
        return {"content": "", "error": "GitHub fetch timeout"}
    except Exception as e:
        print(f"[github] file fetch error: {e}")
        return {"content": "", "error": "GitHub fetch failed"}
