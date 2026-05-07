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

from fastapi import FastAPI
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

app.include_router(analyze_router)
app.include_router(chat_router)
app.include_router(files_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # allow all for now
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {"message": "RExplain API running"}


@app.get("/health")
def health():
    """Lightweight health check Render pings — always responds fast."""
    from app.services.embeddings import _model
    model_status = "ready" if (_model and _model != "FAILED") else "loading"
    return JSONResponse({"status": "ok", "model": model_status})