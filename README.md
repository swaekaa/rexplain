# RExplain 🔍

> **AI-Powered GitHub Repository Analysis Platform**

**[🚀 Live Demo → rexplain.vercel.app](https://rexplain.vercel.app)**

RExplain automatically explains any GitHub repository using static analysis, architecture extraction, and Retrieval-Augmented Generation (RAG) — making it dramatically faster to understand large codebases without reading every file manually.

Simply paste a GitHub URL and get an instant, AI-powered breakdown of the codebase.

---

## ✨ What It Does

| Feature | Description |
|---|---|
| 🧠 **Framework Detection** | Detects FastAPI, Flask, Django, React, Vue, Angular, SQLAlchemy, PostgreSQL, MongoDB, and more |
| 🏗️ **Architecture Diagrams** | Generates dependency graphs and visual architecture diagrams |
| 📄 **README Extraction** | Fetches and renders the repository README with syntax-highlighted code blocks |
| 📊 **Commit Analytics** | Visualizes commit history, frequency, and contribution graphs |
| 🤖 **AI Chatbot (RAG)** | Ask natural-language questions about any repository |
| ⚡ **Instant Reloads** | PostgreSQL-backed cache skips re-analysis on unchanged repositories |

---

## 🧱 Tech Stack

### Backend
- **FastAPI** — REST API framework
- **PostgreSQL + SQLAlchemy** — persistent storage and ORM
- **SentenceTransformers** (`all-MiniLM-L6-v2`) — embedding generation
- **Groq API** — LLM inference
- **Graphviz** — architecture diagram rendering
- **GitHub REST API** — repository metadata and tree fetching
- **Docker** — containerized deployment

### Frontend
- **React + Vite** — fast frontend build
- **TailwindCSS** — utility-first styling
- **Framer Motion** — animations
- **React Markdown** — README rendering
- **Axios** — HTTP client

---

## 🚀 How It Works

```
GitHub URL
   ↓
Repository metadata extraction
   ↓
Selective file fetching (GitHub Tree API)
   ↓
Framework detection
   ↓
Architecture generation
   ↓
README + intelligence extraction
   ↓
RAG indexing
   ↓
Interactive AI chat
```

---

## 🔑 Key Engineering Decisions

### GitHub Tree API + Selective Fetching
Instead of cloning entire repositories (which causes bottlenecks for large repos, binaries, `node_modules`, and datasets), RExplain:

- Fetches the repository tree structure via the GitHub API
- Identifies and selectively retrieves only important files — `README`, `package.json`, `requirements.txt`, route files, configs, and manifests
- Falls back to a shallow clone (`depth=1`) only if the API is unavailable

**Result:** Fast analysis regardless of repository size, with no large clone delays.

### Persistent Embedding Cache
Embeddings and chunk metadata are stored in PostgreSQL so repeated loads are instant:

1. Fetch the latest commit SHA and compare with the cached SHA
2. If **unchanged** → restore embeddings and chunks, skip full analysis
3. If **changed** → run the full pipeline and persist the new state

### Startup Model Loading
The embedding model loads once at backend startup rather than per-request, eliminating timeout issues during AI chat.

---

## 🤖 AI Chatbot (RAG)

Users can ask natural-language questions about any analyzed repository:

- *"What frameworks are used?"*
- *"Where is the database set up?"*
- *"How does authentication work?"*
- *"What are the main API routes?"*

**How it works:**
1. Repository files are chunked and embedded using `all-MiniLM-L6-v2`
2. On each question, relevant chunks are retrieved via semantic similarity search
3. Retrieved context is passed to an LLM (Groq) for a grounded, repository-specific answer

---

## 🏗️ Architecture

```
┌─────────────────────────────────┐
│        React Frontend           │  ← Vercel
│  (Analysis Panel + AI Chat)     │
└────────────────┬────────────────┘
                 │ HTTPS
┌────────────────▼────────────────┐
│        FastAPI Backend          │  ← Render (Docker)
│  Analysis · RAG · Cache Layer   │
└──────┬──────────────────┬───────┘
       │                  │
┌──────▼──────┐   ┌───────▼──────┐
│  PostgreSQL  │   │  GitHub API  │
│  (Neon)    │   │  Groq API    │
└─────────────┘   └──────────────┘
```

---

## ☁️ Deployment

| Layer | Platform |
|---|---|
| Frontend | [Vercel](https://vercel.com) |
| Backend | [Render](https://render.com) (Docker) |
| Database | Neon PostgreSQL |

Docker is used for the backend because Graphviz requires system-level installation, which Render's standard Python runtime does not support natively.

---

## ⚠️ Known Limitations

- **GitHub API Timeouts** — Very large repositories may be slower to analyze; retry logic and graceful fallbacks are in place
- **Cold Starts** — Render's free tier sleeps inactive services; the first request after inactivity may take a few seconds longer

---

## 🗺️ Roadmap

- [ ] **Interactive Diagrams** — Replace Graphviz with React Flow for clickable, interactive dependency graphs
- [ ] **Advanced RAG** — Hybrid retrieval, AST-aware chunking, reranking, and source citations
- [ ] **Streaming Responses** — Real-time streaming AI chat
- [ ] **Multi-Repository Analysis** — Analyze microservice ecosystems and org-wide dependency relationships
- [ ] **Background Workers** — Celery + Redis for async job pipelines

---



<p align="center">
  <a href="https://rexplain.vercel.app">🚀 Try it live at rexplain.vercel.app</a>
</p>
