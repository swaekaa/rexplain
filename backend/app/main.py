import os
from pathlib import Path

# ── Load .env before anything else ───────────────────────────────────────────
# Resolves to <repo_root>/.env regardless of CWD
_env_path = Path(__file__).resolve().parents[2] / ".env"
try:
    from dotenv import load_dotenv
    load_dotenv(dotenv_path=_env_path, override=False)
    print(f"[env] loaded .env from {_env_path}")
except ImportError:
    print("[env] python-dotenv not installed — reading env vars from OS")

import threading
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from app.routes.analyze import router as analyze_router
from app.routes.chat import router as chat_router
from app.routes.files import router as files_router
from app.routes.auth import router as auth_router
from app.routes.threads import router as threads_router
from app.routes.repositories import router as repositories_router
from fastapi.middleware.cors import CORSMiddleware


def _background_init():
    """Load heavy models and init all DB tables in background so port binds immediately."""
    try:
        from app.services import cache_db
        cache_db.init_db()
        print("[startup] repo_cache DB init done")
    except Exception as exc:
        print(f"[cache] startup init skipped: {exc}")

    try:
        from app.services import user_db
        user_db.init_db()
        print("[startup] user_db tables init done")
    except Exception as exc:
        print(f"[user_db] startup init skipped: {exc}")

    try:
        from app.services.embeddings import preload_model
        preload_model()
    except Exception as exc:
        print(f"[startup] model preload failed: {exc}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Bind port immediately, load heavy models in background thread."""
    t = threading.Thread(target=_background_init, daemon=True)
    t.start()
    print("[startup] server ready — model loading in background")
    yield  # application runs here


app = FastAPI(title="RExplain API", lifespan=lifespan)

# ── Logging Middleware for Debugging ──────────────────────────────────────────
@app.middleware("http")
async def log_requests(request: Request, call_next):
    origin = request.headers.get("origin")
    print(f"[debug] incoming request from origin: {origin} to {request.url.path}")
    response = await call_next(request)
    return response


# ── CORS ─────────────────────────────────────────────────────────────────────
# Build allowed origins from environment for security.
# Never use allow_origins=["*"] with allow_credentials=True.
def _get_allowed_origins() -> list[str]:
    origins = []
    # Always allow localhost for development
    origins.append("http://localhost:3000")
    origins.append("http://localhost:3001")
    origins.append("http://127.0.0.1:3000")

    # Production frontend URL (set as env var on Render)
    frontend_url = os.environ.get("FRONTEND_URL", "").strip().rstrip("/")
    if frontend_url:
        origins.append(frontend_url)

    # Fallback: also accept CORS_ORIGIN if set separately
    cors_origin = os.environ.get("CORS_ORIGIN", "").strip().rstrip("/")
    if cors_origin:
        origins.append(cors_origin)

    # Always add the known Vercel production URL if set
    vercel_url = os.environ.get("VERCEL_URL", "").strip().rstrip("/")
    if vercel_url:
        if not vercel_url.startswith("http"):
            vercel_url = f"https://{vercel_url}"
        origins.append(vercel_url)

    return list(dict.fromkeys(origins))  # deduplicate, preserve order


app.add_middleware(
    CORSMiddleware,
    allow_origins=_get_allowed_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(auth_router)
app.include_router(analyze_router)
app.include_router(chat_router)
app.include_router(files_router)
app.include_router(threads_router)
app.include_router(repositories_router)


@app.get("/")
def root():
    return {"message": "RExplain API running"}


@app.get("/health")
def health():
    return {"status": "ok"}