import os

# Same skip set as repo_scanner — avoids traversing irrelevant heavy dirs
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

# Only read the first 8 KB of any .py file — enough to find imports
# without loading large generated/vendored files into memory
MAX_READ_BYTES = 8192


def detect_frameworks(repo_path: str) -> dict:

    detected = {
        "backend_framework": None,
        "frontend_framework": None,
        "database": None,
    }

    for root, dirs, files in os.walk(repo_path):

        # Prune heavy directories before descending
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]

        for file in files:

            # Early exit: all three slots filled, no need to keep scanning
            if all(detected.values()):
                return detected

            path = os.path.join(root, file)

            # ── Python framework detection (.py files only) ──
            if file.endswith(".py"):
                try:
                    with open(path, "r", encoding="utf-8", errors="ignore") as f:
                        # Read only the first 8 KB — imports appear at the top
                        content = f.read(MAX_READ_BYTES).lower()

                    if not detected["backend_framework"]:
                        if "fastapi" in content:
                            detected["backend_framework"] = "FastAPI"
                        elif "flask" in content:
                            detected["backend_framework"] = "Flask"
                        elif "django" in content:
                            detected["backend_framework"] = "Django"

                    if not detected["database"] and "sqlalchemy" in content:
                        detected["database"] = "SQLAlchemy"

                except OSError:
                    pass

            # ── Frontend framework detection (package.json only) ──
            elif file == "package.json" and not detected["frontend_framework"]:
                try:
                    with open(path, "r", encoding="utf-8") as f:
                        content = f.read().lower()

                    if "react" in content:
                        detected["frontend_framework"] = "React"
                    elif "vue" in content:
                        detected["frontend_framework"] = "Vue"
                    elif "angular" in content:
                        detected["frontend_framework"] = "Angular"

                except OSError:
                    pass

    return detected