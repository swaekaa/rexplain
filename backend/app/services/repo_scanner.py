import os
from collections import defaultdict

# Directories that bloat traversal with no useful source files
SKIP_DIRS = {
    ".git",
    "node_modules",
    "dist",
    "build",
    "__pycache__",
    "venv",
    ".venv",
    ".tox",
    ".mypy_cache",
    ".pytest_cache",
    "coverage",
    ".next",
    ".nuxt",
    "out",
}

IMPORTANT_NAMES = {
    "main.py",
    "app.py",
    "server.py",
    "index.js",
    "package.json",
    "requirements.txt",
}


def scan_repository(repo_path: str) -> dict:

    language_counts = defaultdict(int)
    key_files = []
    total_files = 0

    for root, dirs, files in os.walk(repo_path):

        # Prune heavy/irrelevant directories in-place before os.walk descends
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]

        for file in files:
            total_files += 1

            ext = os.path.splitext(file)[1]
            if ext:
                language_counts[ext] += 1

            if file in IMPORTANT_NAMES and len(key_files) < 10:
                key_files.append(os.path.join(root, file))

    return {
        "total_files": total_files,
        "languages": dict(language_counts),
        "key_files": key_files,
    }