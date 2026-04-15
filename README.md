# RExplain

> Unfold the complexity of any GitHub repository with clarity and intent.

RExplain is a full-stack GitHub repository analysis platform. Paste any public repo URL and get an instant breakdown of its architecture, tech stack, API surface, key files, and README — rendered in a minimal glassmorphism interface.

---

## Live Demo

| Service | URL |
|---|---|
| Frontend | http://localhost:3000 |
| Backend API | http://127.0.0.1:8000 |
| API Docs | http://127.0.0.1:8000/docs |

---

## Features

### Phase 10 — Intelligent Repository Understanding
- **README Detection** — extracts and renders README in clean markdown
- **API Route Extraction** — regex-based detection for FastAPI, Flask, Express.js, Django
- **Important File Detection** — identifies Dockerfiles, CI workflows, lock files, IaC configs
- **Folder Purpose Explanation** — maps 80+ folder names to human-readable descriptions
- **Clustered Architecture Diagram** — Graphviz subgraph clusters (Frontend / Backend / Database / Infra) populated from real folder names
- **Fast-fail for Private Repos** — `git ls-remote` pre-check returns HTTP 403 in ~2s instead of a 30s timeout
- **Minimalist Glass UI** — full redesign matching Stitch design system (Manrope + Inter, glassmorphism, Tailwind)

### Core Features (Phases 1–9)
- GitHub Trees API fast path (~2–5s for public repos, no clone needed)
- Shallow clone fallback for edge cases
- Framework detection: React, Next.js, Vue, Angular, FastAPI, Flask, Django, Express, SQLAlchemy, Prisma, MongoDB, and more
- AI-generated repository explanation
- Graphviz architecture diagram (base64 PNG)
- Language breakdown + file stats

---

## Tech Stack

### Backend
| Package | Version | Purpose |
|---|---|---|
| FastAPI | 0.135.3 | API framework |
| Uvicorn | 0.42.0 | ASGI server |
| Graphviz | 0.21 | Architecture diagram generation |
| Requests | 2.33.1 | GitHub Trees API + raw file fetches |
| GitPython | 3.1.46 | Clone fallback |
| Pydantic | 2.12.5 | Request/response validation |

### Frontend
| Package | Purpose |
|---|---|
| React 18 | UI framework |
| Axios | API calls |
| react-markdown | README rendering |
| Tailwind CSS (CDN) | Utility-first styling |
| Manrope + Inter | Typography |
| Material Symbols Outlined | Icons |

---

## Project Structure

```
rexplain/
├── backend/
│   ├── app/
│   │   ├── routes/
│   │   │   └── analyze.py          # Main analysis pipeline
│   │   ├── services/
│   │   │   ├── github_fetcher.py   # GitHub Trees API fast path
│   │   │   ├── repo_cloner.py      # Clone fallback + private repo detection
│   │   │   ├── repo_scanner.py     # Local file tree scanner
│   │   │   ├── dependency_parser.py # Framework detection
│   │   │   ├── architecture_builder.py # Architecture graph builder
│   │   │   ├── diagram_generator.py    # Graphviz clustered diagram
│   │   │   ├── ai_explainer.py         # AI explanation engine
│   │   │   └── repo_intelligence.py    # Phase 10: README, routes, files, folders
│   │   └── main.py
│   ├── requirements.txt
│   └── repos/              # Temp clone storage (git-ignored)
└── frontend/
    ├── public/
│   │   └── index.html      # Tailwind CDN + fonts + CSS tokens
    └── src/
        ├── App.js          # Landing / Loading / Analysis views
        ├── index.css       # Minimal reset + readme-prose styles
        └── App.css         # (unused)
```

---

## Setup & Running

### Backend

```bash
cd backend
python -m venv venv
venv/Scripts/python -m pip install -r requirements.txt
venv/Scripts/python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm start
```

Open **http://localhost:3000** — paste any public GitHub URL and click **Analyze**.

---

## API

### `POST /analyze/`

**Request:**
```json
{ "repo_url": "https://github.com/owner/repo" }
```

**Response:**
```json
{
  "repo_url": "...",
  "scan_results": {
    "total_files": 95,
    "languages": { ".py": 42, ".js": 18 },
    "key_files": ["requirements.txt", "package.json"],
    "file_paths": ["src/App.js", "backend/main.py"]
  },
  "framework_detection": {
    "backend_framework": "FastAPI",
    "frontend_framework": "React",
    "database": null
  },
  "architecture": {
    "nodes": ["React", "FastAPI"],
    "edges": [["React", "FastAPI"]],
    "fe_fw_name": "React",
    "be_fw_name": "FastAPI",
    "db_fw_name": null
  },
  "diagram": "data:image/png;base64,...",
  "ai_explanation": "...",
  "readme": "# Project Title\n...",
  "api_routes": ["GET /users", "POST /login"],
  "important_files": ["Dockerfile", ".github/workflows/ci.yml"],
  "folder_explanations": {
    "routes": "API Endpoints — Defines HTTP route handlers.",
    "services": "Business Logic — Core application logic."
  }
}
```

**Error Responses:**
| Status | Meaning |
|---|---|
| 403 | Repository is private or does not exist |
| 408 | Clone timed out (repo too large) |
| 422 | Git clone failed |

---

## Phases

| Phase | Description | Status |
|---|---|---|
| 1 | Backend foundation (FastAPI boilerplate) | ✅ |
| 2 | Repository cloning (GitPython + subprocess) | ✅ |
| 3 | Repository scanner | ✅ |
| 4 | Framework detection | ✅ |
| 5 | Architecture builder | ✅ |
| 6 | Graphviz diagram generation | ✅ |
| 7 | AI explanation engine | ✅ |
| 8 | Frontend UI (React + Axios) | ✅ |
| 9 | Production cleanup + clone optimization (GitHub Trees API fast path) | ✅ |
| 10 | Intelligent repo understanding + Stitch UI redesign | ✅ |

---

## Notes

- Only **public** repositories are supported. Private repos return HTTP 403 immediately.
- The GitHub Trees API fast path avoids cloning entirely for public repos (~2–5s).
- Large repos (>1000 files) may be slower on the clone fallback path.
- The Graphviz diagram requires `graphviz` system binaries to be installed and on `PATH`.

---

*Built for clarity.*
