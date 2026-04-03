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



# ---------------------------------------------------------------------------
# Fast path: detect frameworks from in-memory file contents
# (used by the GitHub API fetcher — no filesystem walk required)
# ---------------------------------------------------------------------------

_PYTHON_MANIFESTS = {"requirements.txt", "setup.py", "pyproject.toml", "Pipfile"}
_JS_MANIFESTS = {"package.json"}

# Ordered list of (keyword, label) — first match wins per slot.
# Web frameworks checked before ML so FastAPI/Flask win over numpy.
_BACKEND_SIGNALS = [
    # Web / API
    ("fastapi",         "FastAPI"),
    ("flask",           "Flask"),
    ("django",          "Django"),
    ("tornado",         "Tornado"),
    ("aiohttp",         "aiohttp"),
    ("starlette",       "Starlette"),
    ("sanic",           "Sanic"),
    # ML / Deep Learning
    ("torch",           "PyTorch"),
    ("pytorch",         "PyTorch"),
    ("tensorflow",      "TensorFlow"),
    ("keras",           "TensorFlow/Keras"),
    ("jax",             "JAX"),
    ("paddle",          "PaddlePaddle"),
    # CV / Image processing
    ("opencv",          "OpenCV"),
    ("cv2",             "OpenCV"),
    ("pillow",          "PIL/Pillow"),
    ("detectron",       "Detectron2"),
    ("ultralytics",     "YOLO/Ultralytics"),
    # Data Science
    ("scikit-learn",    "scikit-learn"),
    ("sklearn",         "scikit-learn"),
    ("xgboost",         "XGBoost"),
    ("lightgbm",        "LightGBM"),
    ("catboost",        "CatBoost"),
    ("huggingface",     "HuggingFace"),
    ("transformers",    "HuggingFace Transformers"),
    ("diffusers",       "HuggingFace Diffusers"),
    # Data tooling
    ("pandas",          "Pandas"),
    ("numpy",           "NumPy"),
    ("scipy",           "SciPy"),
    ("matplotlib",      "Matplotlib"),
    ("seaborn",         "Seaborn"),
    ("plotly",          "Plotly"),
]

_FRONTEND_SIGNALS = [
    # JS frameworks
    ("\"react\"",       "React"),
    ("react-dom",       "React"),
    ("\"vue\"",         "Vue"),
    ("\"angular\"",     "Angular"),
    ("\"svelte\"",      "Svelte"),
    ("\"next\"",        "Next.js"),
    ("\"nuxt\"",        "Nuxt.js"),
    ("\"express\"",     "Express.js"),
    ("\"electron\"",    "Electron"),
]

_DATABASE_SIGNALS = [
    ("sqlalchemy",      "SQLAlchemy"),
    ("psycopg",         "PostgreSQL"),
    ("pymongo",         "MongoDB"),
    ("motor",           "MongoDB"),
    ("redis",           "Redis"),
    ("elasticsearch",   "Elasticsearch"),
    ("cassandra",       "Cassandra"),
    ("firebase",        "Firebase"),
    ("supabase",        "Supabase"),
    ("prisma",          "Prisma"),
    ("sequelize",       "Sequelize"),
    ("mongoose",        "MongoDB/Mongoose"),
]

# Extension → human-readable language name (used as last-resort fallback)
_EXT_TO_LANGUAGE = {
    ".py":   "Python",
    ".js":   "JavaScript",
    ".ts":   "TypeScript",
    ".jsx":  "React/JSX",
    ".tsx":  "TypeScript/React",
    ".java": "Java",
    ".go":   "Go",
    ".rs":   "Rust",
    ".rb":   "Ruby",
    ".php":  "PHP",
    ".cs":   "C#",
    ".cpp":  "C++",
    ".c":    "C",
    ".swift":"Swift",
    ".kt":   "Kotlin",
    ".r":    "R",
    ".m":    "MATLAB",
    ".ipynb":"Jupyter Notebook",
}


def detect_frameworks_from_content(file_contents: dict, scan_data: dict | None = None) -> dict:
    """
    Detect frameworks from a dict of {filename: text_content}.

    Accepts the output of github_fetcher.fetch_repo_fast().
    Returns the same shape as detect_frameworks() so the rest of the
    pipeline (architecture_builder, ai_explainer) is unaffected.

    If scan_data is provided, uses extension counts as a last-resort
    fallback when no explicit framework keyword is found — this ensures
    ML/research repos (e.g. VisionSat) always get a meaningful result.
    """
    detected = {
        "backend_framework": None,
        "frontend_framework": None,
        "database": None,
    }

    # ── Concatenate all Python manifest content ───────────────────────────
    python_content = ""
    for fname in _PYTHON_MANIFESTS:
        if fname in file_contents:
            python_content += "\n" + file_contents[fname].lower()[:MAX_READ_BYTES]

    # ── Backend / ML framework from Python manifests ──────────────────────
    if python_content and not detected["backend_framework"]:
        for keyword, label in _BACKEND_SIGNALS:
            if keyword in python_content:
                detected["backend_framework"] = label
                break

    # ── Database from Python manifests ────────────────────────────────────
    if python_content and not detected["database"]:
        for keyword, label in _DATABASE_SIGNALS:
            if keyword in python_content:
                detected["database"] = label
                break

    # ── Frontend framework from package.json ──────────────────────────────
    if "package.json" in file_contents and not detected["frontend_framework"]:
        js_content = file_contents["package.json"].lower()
        # Also check database signals in JS manifest
        if not detected["database"]:
            for keyword, label in _DATABASE_SIGNALS:
                if keyword in js_content:
                    detected["database"] = label
                    break
        for keyword, label in _FRONTEND_SIGNALS:
            if keyword in js_content:
                detected["frontend_framework"] = label
                break
        # JS-side backend (Node.js)
        if not detected["backend_framework"]:
            for keyword, label in _BACKEND_SIGNALS:
                if keyword in js_content:
                    detected["backend_framework"] = label
                    break

    # ── README as supplementary signal (lower priority) ───────────────────
    if "README.md" in file_contents:
        readme = file_contents["README.md"].lower()[:MAX_READ_BYTES]
        if not detected["backend_framework"]:
            for keyword, label in _BACKEND_SIGNALS:
                if keyword in readme:
                    detected["backend_framework"] = label
                    break
        if not detected["frontend_framework"]:
            for keyword, label in _FRONTEND_SIGNALS:
                if keyword in readme:
                    detected["frontend_framework"] = label
                    break

    # ── Extension-based fallback (last resort) ────────────────────────────
    # If we still have no backend framework, infer the primary language from
    # the most common file extension — this catches pure research / CV / ML
    # repos that have no web framework at all (e.g. VisionSat).
    if not detected["backend_framework"] and scan_data:
        languages = scan_data.get("languages", {})
        if languages:
            dominant_ext = max(languages, key=lambda e: languages[e])
            lang = _EXT_TO_LANGUAGE.get(dominant_ext)
            if lang:
                detected["backend_framework"] = f"{lang} Project"

    return detected