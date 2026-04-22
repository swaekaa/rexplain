"""
repo_metadata.py
----------------
Extracts metadata from local Git and GitHub API.
Provides metadata-aware answering layer before standard RAG.
"""

import os
import re
import subprocess
import requests
import urllib.parse

# Cache for metadata per repo URL
_metadata_cache: dict[str, dict] = {}

def _normalize_key(repo_url: str) -> str:
    return repo_url.rstrip("/").lower()

def _parse_github_url(repo_url: str) -> tuple[str, str]:
    parts = repo_url.rstrip("/").split("/")
    return parts[-2], parts[-1].replace(".git", "")

def get_local_git_metadata(clone_path: str) -> dict:
    """Extract metadata using local git commands."""
    metadata = {}
    if not clone_path or not os.path.exists(clone_path):
        return metadata

    try:
        # Total commits
        commits_out = subprocess.check_output(
            ["git", "rev-list", "--count", "HEAD"], 
            cwd=clone_path, text=True, stderr=subprocess.DEVNULL
        )
        metadata["total_commits"] = int(commits_out.strip())

        # Latest commit message
        msg_out = subprocess.check_output(
            ["git", "log", "-1", "--pretty=format:%B"], 
            cwd=clone_path, text=True, stderr=subprocess.DEVNULL
        )
        metadata["latest_commit_message"] = msg_out.strip()

        # Branch name
        branch_out = subprocess.check_output(
            ["git", "rev-parse", "--abbrev-ref", "HEAD"], 
            cwd=clone_path, text=True, stderr=subprocess.DEVNULL
        )
        metadata["default_branch"] = branch_out.strip()

        # Contributors (top 5)
        contrib_out = subprocess.check_output(
            ["git", "shortlog", "-sn", "HEAD"], 
            cwd=clone_path, text=True, stderr=subprocess.DEVNULL
        )
        contributors = []
        for line in contrib_out.strip().split("\n")[:5]:
            if line:
                parts = line.split("\t")
                if len(parts) == 2:
                    contributors.append(parts[1].strip())
        metadata["contributors"] = contributors

    except Exception as e:
        print(f"[metadata] Git extract error: {e}")
    
    return metadata

def get_github_metadata(repo_url: str) -> dict:
    """Extract metadata from GitHub API if it's a GitHub repo."""
    metadata = {}
    if "github.com" not in repo_url.lower():
        return metadata

    try:
        owner, repo = _parse_github_url(repo_url)
        url = f"https://api.github.com/repos/{owner}/{repo}"
        headers = {"Accept": "application/vnd.github.v3+json"}
        r = requests.get(url, headers=headers, timeout=5)
        if r.status_code == 200:
            data = r.json()
            metadata["stars"] = data.get("stargazers_count", 0)
            metadata["forks"] = data.get("forks_count", 0)
            metadata["open_issues"] = data.get("open_issues_count", 0)
            license_data = data.get("license")
            if license_data:
                metadata["license"] = license_data.get("name", "Unknown")
            metadata["description"] = data.get("description", "")
            metadata["default_branch"] = data.get("default_branch", "main")
    except Exception as e:
        print(f"[metadata] GitHub API error: {e}")

    return metadata

def fetch_repo_metadata(repo_url: str, clone_path: str = None) -> dict:
    """Combine Git and GitHub metadata and store in cache."""
    metadata = {}
    
    # Try GitHub API first
    gh_metadata = get_github_metadata(repo_url)
    metadata.update(gh_metadata)

    # If we have a local clone, get git metadata
    if clone_path:
        git_metadata = get_local_git_metadata(clone_path)
        # Don't overwrite default_branch if already present from GH API unless git has it
        for k, v in git_metadata.items():
            if v:
                metadata[k] = v

    key = _normalize_key(repo_url)
    _metadata_cache[key] = metadata
    print(f"[metadata] Cached metadata for {key}: {list(metadata.keys())}")
    return metadata

def get_cached_metadata(repo_url: str) -> dict | None:
    return _metadata_cache.get(_normalize_key(repo_url))

# --- Chat Routing & Answering ---

_METADATA_KEYWORDS = {
    "commit", "commits", "latest commit", "branch", "branches",
    "star", "stars", "fork", "forks", "issue", "issues",
    "license", "contributor", "contributors", "author", "authors"
}

def is_metadata_question(question: str) -> bool:
    """Check if a question is primarily about repo metadata."""
    q_lower = question.lower()
    for kw in _METADATA_KEYWORDS:
        # Match whole words to avoid false positives like "issue" in "what's the issue with..."
        # But allow simple matches for now.
        if re.search(rf"\b{kw}\b", q_lower):
            # Special case: ignore "what is the issue" -> mostly they ask "how many issues"
            if kw == "issue" and "how many" not in q_lower and "open" not in q_lower:
                continue
            return True
    return False

def answer_metadata_question(question: str, metadata: dict) -> dict:
    """
    Format metadata into an answer matching the RAG output format.
    Uses LLM for natural phrasing, but grounded entirely on metadata dict.
    """
    # Since we need to return the exact backend patch and use LLM for natural language,
    # let's import the llm_service here.
    from app.services.llm_service import _get_client, MODEL, _parse_response
    
    if not metadata:
        return {
            "answer": "No metadata available for this repository.",
            "sources": ["Repository Metadata"],
            "confidence": "low"
        }

    meta_str = "\n".join(f"- {k.replace('_', ' ').title()}: {v}" for k, v in metadata.items())

    system_prompt = (
        "You are a repository assistant answering questions about repository metadata.\n"
        "Use ONLY the following metadata to answer the user's question:\n\n"
        f"{meta_str}\n\n"
        "Rules:\n"
        "1. Do not hallucinate. If the answer is not in the metadata, say 'I don't have that metadata.'\n"
        "2. Keep it concise (1-3 sentences).\n"
        "3. You MUST always respond with valid JSON in exactly this format:\n"
        "{\n"
        '  "answer": "Your answer here.",\n'
        '  "sources": ["Repository Metadata"],\n'
        '  "confidence": "high"\n'
        "}\n"
        "Do NOT wrap the JSON in markdown fences."
    )

    try:
        client = _get_client()
        completion = client.chat.completions.create(
            model=MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": question},
            ],
            temperature=0.1,
            max_tokens=256,
            stream=False,
        )
        raw = completion.choices[0].message.content or ""
        # _parse_response expects chunks, we can pass a dummy chunk
        return _parse_response(raw, [{"path": "Repository Metadata"}])
    except Exception as e:
        print(f"[metadata] LLM error: {e}")
        return {
            "answer": f"The repository has {metadata.get('total_commits', 'unknown')} commits.",
            "sources": ["Repository Metadata"],
            "confidence": "medium"
        }

def stream_metadata_answer(question: str, metadata: dict):
    """Streaming variant for metadata answers."""
    from app.services.llm_service import _get_client, MODEL, _parse_response
    import json
    
    if not metadata:
        yield 'data: No metadata available for this repository.\n\n'
        yield 'data: [META] {"sources": ["Repository Metadata"], "confidence": "low"}\n\n'
        yield 'data: [DONE]\n\n'
        return

    meta_str = "\n".join(f"- {k.replace('_', ' ').title()}: {v}" for k, v in metadata.items())
    
    system_prompt = (
        "You are a repository assistant answering questions about repository metadata.\n"
        "Use ONLY the following metadata to answer the user's question:\n\n"
        f"{meta_str}\n\n"
        "Rules:\n"
        "1. Do not hallucinate. If the answer is not in the metadata, say 'I don't have that metadata.'\n"
        "2. Keep it concise (1-3 sentences).\n"
        "3. You MUST always respond with valid JSON in exactly this format:\n"
        "{\n"
        '  "answer": "Your answer here.",\n'
        '  "sources": ["Repository Metadata"],\n'
        '  "confidence": "high"\n'
        "}\n"
    )

    client = _get_client()
    full_text = []

    try:
        stream = client.chat.completions.create(
            model=MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": question},
            ],
            temperature=0.1,
            max_tokens=256,
            stream=True,
        )

        for chunk in stream:
            delta = chunk.choices[0].delta
            token = getattr(delta, "content", None) or ""
            if token:
                full_text.append(token)
                safe = token.replace("\n", "\\n")
                yield f"data: {safe}\n\n"

        raw = "".join(full_text)
        parsed = _parse_response(raw, [{"path": "Repository Metadata"}])
        meta = {
            "sources": parsed["sources"],
            "confidence": parsed["confidence"],
        }
        yield f"data: [META] {json.dumps(meta)}\n\n"
        yield "data: [DONE]\n\n"
    except Exception as e:
        print(f"[stream_metadata] error: {e}")
        yield f"data: ⚠️ Error: {str(e)}\n\n"
        yield 'data: [META] {"sources": ["Repository Metadata"], "confidence": "low"}\n\n'
        yield "data: [DONE]\n\n"
