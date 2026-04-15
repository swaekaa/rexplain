"""
repo_intelligence.py
--------------------
Phase 10 intelligence layer.

Provides four new enrichment functions that run on already-fetched data
(file_contents dict from github_fetcher, or scan_data from repo_scanner):

  1. extract_readme(file_contents)          → str | None
  2. detect_important_files(paths)          → list[str]
  3. extract_api_routes(file_contents)      → list[str]
  4. explain_folders(paths)                 → dict[str, str]

These functions NEVER do network I/O and NEVER touch the filesystem.
They operate purely on data already in memory.
"""

from __future__ import annotations

import re
from typing import Optional


# ---------------------------------------------------------------------------
# 1. README Detection
# ---------------------------------------------------------------------------

# README filenames we consider, in priority order
_README_VARIANTS = [
    "README.md",
    "README.MD",
    "readme.md",
    "README.rst",
    "README.txt",
    "README",
]


def extract_readme(file_contents: dict) -> Optional[str]:
    """
    Return the README text if it was fetched, else None.

    file_contents is the {basename: text} dict from github_fetcher.
    We try several common README filenames in priority order so we don't
    miss repos that use uppercase or non-md extensions.
    """
    for name in _README_VARIANTS:
        content = file_contents.get(name)
        if content:
            # Trim very long READMEs to 50 000 chars to keep response lean
            return content[:50_000]
    return None


# ---------------------------------------------------------------------------
# 2. Important File Detection
# ---------------------------------------------------------------------------

# Files / patterns that are architecturally significant
_IMPORTANT_EXACT = {
    "Dockerfile",
    "docker-compose.yml",
    "docker-compose.yaml",
    ".env.example",
    ".env.sample",
    "requirements.txt",
    "pyproject.toml",
    "setup.py",
    "Pipfile",
    "package.json",
    "package-lock.json",
    "yarn.lock",
    "pnpm-lock.yaml",
    "go.mod",
    "Cargo.toml",
    "pom.xml",
    "build.gradle",
    "Makefile",
    "makefile",
    "CMakeLists.txt",
    ".gitignore",
    ".dockerignore",
    "README.md",
    "LICENSE",
    "LICENSE.md",
    "CONTRIBUTING.md",
    "CHANGELOG.md",
    "vercel.json",
    "netlify.toml",
    "render.yaml",
    "fly.toml",
    "heroku.yml",
    "app.yaml",        # GCP App Engine
    "serverless.yml",
    "terraform.tf",
    "ansible.cfg",
    "pytest.ini",
    "setup.cfg",
    "tox.ini",
    ".pre-commit-config.yaml",
    "babel.config.js",
    "webpack.config.js",
    "vite.config.ts",
    "vite.config.js",
    "next.config.js",
    "next.config.ts",
    "tsconfig.json",
    ".eslintrc.json",
    ".eslintrc.js",
    ".prettierrc",
}

# Path patterns (substring match)
_IMPORTANT_PATH_PATTERNS = [
    ".github/workflows",   # CI/CD workflow files
    ".github/CODEOWNERS",
    "k8s/",                # Kubernetes manifests
    "helm/",
    "charts/",
    "terraform/",
    "ansible/",
    "scripts/",
    "migrations/",
    "alembic/",
    "prisma/schema.prisma",
]


def detect_important_files(paths: list[str]) -> list[str]:
    """
    Given a list of repo file paths (from GitHub Trees API), return those
    that are architecturally significant.

    Returns a sorted, deduplicated list. Maximum 60 results to keep
    the response lean.
    """
    found: set[str] = set()

    for path in paths:
        basename = path.split("/")[-1]

        # Exact filename match
        if basename in _IMPORTANT_EXACT:
            found.add(path)
            continue

        # Path substring match (e.g. ".github/workflows/ci.yml")
        for pattern in _IMPORTANT_PATH_PATTERNS:
            if pattern in path:
                found.add(path)
                break

    # Sort — directories first, then alphabetically within each group
    result = sorted(found)
    return result[:60]


# ---------------------------------------------------------------------------
# 3. API Route Detection
# ---------------------------------------------------------------------------

# FastAPI / Starlette decorators
_FASTAPI_PATTERN = re.compile(
    r"""@(?:app|router|api)\.(get|post|put|patch|delete|head|options)\s*\(\s*["']([^"']+)["']""",
    re.IGNORECASE,
)

# Flask route decorator
_FLASK_PATTERN = re.compile(
    r"""@(?:app|blueprint|bp)\.(route)\s*\(\s*["']([^"']+)["'](?:[^)]*methods\s*=\s*\[([^\]]*)\])?""",
    re.IGNORECASE,
)

# Express.js  app.get('/', ...) / router.post('/login', ...)
_EXPRESS_PATTERN = re.compile(
    r"""(?:app|router)\.(get|post|put|patch|delete)\s*\(\s*["'`]([^"'`]+)["'`]""",
    re.IGNORECASE,
)

# Django URL patterns  path('api/users/', view)
_DJANGO_PATTERN = re.compile(
    r"""(?:path|re_path|url)\s*\(\s*["']([^"']+)["']""",
    re.IGNORECASE,
)

_METHOD_DISPLAY = {
    "get":     "GET",
    "post":    "POST",
    "put":     "PUT",
    "patch":   "PATCH",
    "delete":  "DELETE",
    "head":    "HEAD",
    "options": "OPTIONS",
    "route":   "ALL",   # Flask @app.route without methods → all
}


def _normalise_path(p: str) -> str:
    """Ensure route starts with /"""
    return p if p.startswith("/") else f"/{p}"


def extract_api_routes(file_contents: dict) -> list[str]:
    """
    Scan fetched file contents for HTTP route declarations.

    Supports:
      - FastAPI / Starlette (@router.get / @app.post)
      - Flask (@app.route, optionally with methods=[])
      - Express.js (app.get / router.post)
      - Django urls (path / re_path — method listed as ALL)

    Returns a deduplicated, sorted list of strings like:
      ["DELETE /items/{id}", "GET /users", "POST /login"]
    """
    routes: set[str] = set()

    for filename, content in file_contents.items():
        if content is None:
            continue

        # Python files — FastAPI + Flask + Django
        if filename.endswith(".py"):
            # FastAPI / Starlette
            for m in _FASTAPI_PATTERN.finditer(content):
                method = _METHOD_DISPLAY.get(m.group(1).lower(), m.group(1).upper())
                path = _normalise_path(m.group(2))
                routes.add(f"{method} {path}")

            # Flask @app.route
            for m in _FLASK_PATTERN.finditer(content):
                path = _normalise_path(m.group(2))
                if m.group(3):
                    # methods explicitly listed → emit one entry per method
                    raw_methods = re.findall(r"""["']([A-Za-z]+)["']""", m.group(3))
                    for mth in raw_methods:
                        routes.add(f"{mth.upper()} {path}")
                else:
                    routes.add(f"ALL {path}")

            # Django url patterns (annotated as ALL — method unknown from URL conf)
            for m in _DJANGO_PATTERN.finditer(content):
                raw_path = m.group(1)
                # Skip non-route strings (e.g. include('app.urls'))
                if "<" in raw_path or "/" in raw_path:
                    routes.add(f"ALL {_normalise_path(raw_path)}")

        # JavaScript / TypeScript files — Express
        elif filename.endswith((".js", ".ts", ".mjs")):
            for m in _EXPRESS_PATTERN.finditer(content):
                method = _METHOD_DISPLAY.get(m.group(1).lower(), m.group(1).upper())
                path = _normalise_path(m.group(2))
                routes.add(f"{method} {path}")

    # Sort: alphabetically by path, then method
    return sorted(routes, key=lambda r: (r.split(" ", 1)[-1], r.split(" ", 1)[0]))[:100]


# ---------------------------------------------------------------------------
# 4. Folder Purpose Explanation
# ---------------------------------------------------------------------------

# Known folder name → (short label, one-sentence explanation)
_FOLDER_KNOWLEDGE: dict[str, tuple[str, str]] = {
    # Backend / Python
    "routes":        ("API Endpoints",       "Defines HTTP route handlers that map URLs to logic."),
    "route":         ("API Endpoints",       "Defines HTTP route handlers that map URLs to logic."),
    "controllers":   ("Controllers",         "Handles request processing and delegates to services."),
    "services":      ("Business Logic",      "Contains core application logic, independent of HTTP."),
    "service":       ("Business Logic",      "Contains core application logic, independent of HTTP."),
    "models":        ("Data Models",         "Defines database schemas and ORM entity classes."),
    "model":         ("Data Models",         "Defines database schemas and ORM entity classes."),
    "schemas":       ("Validation Schemas",  "Pydantic / Marshmallow models for request/response validation."),
    "utils":         ("Utilities",           "Shared helper functions used across the codebase."),
    "helpers":       ("Helpers",             "Reusable utility functions and common abstractions."),
    "middleware":    ("Middleware",           "Request/response lifecycle hooks (auth, logging, CORS)."),
    "config":        ("Configuration",       "Application settings, environment variable bindings."),
    "migrations":    ("DB Migrations",       "Version-controlled database schema change scripts."),
    "alembic":       ("DB Migrations",       "Alembic migration scripts for SQLAlchemy schema changes."),
    "tests":         ("Test Suite",          "Automated tests (unit, integration, e2e)."),
    "test":          ("Test Suite",          "Automated tests (unit, integration, e2e)."),
    "__tests__":     ("Test Suite",          "Jest / Vitest test files."),
    "tasks":         ("Background Tasks",    "Async job definitions (Celery, RQ, etc.)."),
    "workers":       ("Workers",             "Background processing workers and queues."),
    "jobs":          ("Scheduled Jobs",      "Periodic / cron-style background jobs."),
    "core":          ("Core Module",         "Foundational logic shared across the entire application."),
    "api":           ("API Layer",           "API-specific code — versioned routers and serializers."),
    # Frontend
    "components":    ("UI Components",       "Reusable UI building blocks (buttons, cards, modals)."),
    "pages":         ("Pages",               "Top-level route views — one file per application screen."),
    "hooks":         ("Custom Hooks",        "React custom hooks for shared stateful logic."),
    "store":         ("State Store",         "Global state management (Redux, Zustand, Pinia, etc.)."),
    "context":       ("React Context",       "React context providers for shared component state."),
    "assets":        ("Static Assets",       "Images, fonts, icons, and other static media files."),
    "styles":        ("Stylesheets",         "CSS / SCSS / Tailwind stylesheets and design tokens."),
    "lib":           ("Libraries",           "Third-party wrappers and reusable library integrations."),
    "layouts":       ("Layouts",             "Shared page layout wrappers (header, sidebar, footer)."),
    # Infra / ops
    ".github":       ("GitHub Config",       "GitHub-specific config: CI/CD workflows, PR templates."),
    "workflows":     ("CI/CD Workflows",     "GitHub Actions (or similar) pipeline definitions."),
    "docker":        ("Docker",              "Docker build files and compose configurations."),
    "k8s":           ("Kubernetes",          "Kubernetes manifests for container orchestration."),
    "terraform":     ("Infrastructure",      "Terraform IaC definitions for cloud resource provisioning."),
    "ansible":       ("Automation",          "Ansible playbooks for server configuration automation."),
    "scripts":       ("Scripts",             "Miscellaneous automation and maintenance scripts."),
    "docs":          ("Documentation",       "Project documentation, guides, and API references."),
    "doc":           ("Documentation",       "Project documentation, guides, and API references."),
    "examples":      ("Examples",            "Sample code and usage demonstrations."),
    "notebooks":     ("Jupyter Notebooks",   "Exploratory data analysis and experiment notebooks."),
    "data":          ("Data",                "Datasets, fixtures, and static data files."),
    "fixtures":      ("Test Fixtures",       "Static data used to seed tests or local development."),
    "bin":           ("Executables",         "CLI entry-point scripts and binary wrappers."),
    "cmd":           ("CLI Commands",        "Command definitions for CLI applications (Go pattern)."),
    "pkg":           ("Packages",            "Internal reusable packages (Go / Rust pattern)."),
    "internal":      ("Internal Modules",    "Private application packages not exported externally."),
    "src":           ("Source Root",         "Primary source code directory."),
    "app":           ("Application Root",    "Main application package / module root."),
    "client":        ("Frontend Client",     "Client-side application code."),
    "server":        ("Backend Server",      "Server-side application code."),
    "shared":        ("Shared Code",         "Code shared between frontend and backend (monorepo)."),
    "common":        ("Common Utilities",    "Cross-cutting concerns shared across multiple modules."),
    "types":         ("Type Definitions",    "TypeScript type and interface declarations."),
    "constants":     ("Constants",           "Application-wide constant values and enumerations."),
    "validators":    ("Validators",          "Input validation logic separate from schema definitions."),
    "repositories":  ("Repositories",        "Data access layer — queries abstracted from business logic."),
    "repository":    ("Repository",          "Data access layer — queries abstracted from business logic."),
    "events":        ("Events",              "Event emitters, listeners, or pub-sub definitions."),
    "graphql":       ("GraphQL",             "GraphQL schema, resolvers, and query/mutation files."),
    "proto":         ("Protobuf",            "Protocol Buffer definitions for gRPC services."),
    "grpc":          ("gRPC",                "gRPC client and server implementation files."),
    "cache":         ("Cache Layer",         "Caching helpers, Redis/Memcached interaction wrappers."),
    "email":         ("Email",               "Email templates and mailer logic."),
    "templates":     ("Templates",           "Server-side rendering templates (Jinja2, Handlebars, etc.)."),
    "static":        ("Static Files",        "Static files served directly (CSS, JS, images)."),
    "public":        ("Public Assets",       "Publicly served static assets for the web app."),
    "build":         ("Build Output",        "Compiled/bundled output — not committed in most projects."),
    "dist":          ("Distribution",        "Final build artifacts ready for deployment."),
}


def explain_folders(paths: list[str]) -> dict[str, str]:
    """
    Given a list of repo file paths, identify top-level and second-level
    folders that have a known purpose and return a dict:

        { "folder_name": "Short label — one-sentence description." }

    We only surface folders that directly correspond to a recognised
    pattern in _FOLDER_KNOWLEDGE, keeping the output focused and useful.
    """
    seen_folders: set[str] = set()

    for path in paths:
        parts = path.split("/")
        # Examine top-level dir and second-level dir
        for depth in range(min(2, len(parts) - 1)):
            folder = parts[depth]
            if folder and not folder.startswith("."):
                seen_folders.add(folder)
            elif folder.startswith("."):
                # Include hidden dirs like .github
                seen_folders.add(folder)

    result: dict[str, str] = {}
    for folder in sorted(seen_folders):
        if folder.lower() in _FOLDER_KNOWLEDGE:
            label, desc = _FOLDER_KNOWLEDGE[folder.lower()]
            result[folder] = f"{label} — {desc}"

    return result
