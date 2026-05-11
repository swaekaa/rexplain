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
from fastapi.middleware.cors import CORSMiddleware

def _background_init():
    """Load heavy models in background so port binds immediately."""
    try:
        from app.services import cache_db
        cache_db.init_db()
        print("[startup] DB init done")
    except Exception as exc:
        print(f"[cache] startup init skipped: {exc}")

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

# ── CORS must be added before routers so it wraps all routes ────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://YOUR_VERCEL_DOMAIN.vercel.app",  # Add your specific Vercel URL here
        "*"  # temporarily allow all for debugging cross-device setup
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(analyze_router)
app.include_router(chat_router)
app.include_router(files_router)


@app.get("/")
def root():
    return {"message": "RExplain API running"}


@app.get("/health")
def health():
    return {"status": "ok"}