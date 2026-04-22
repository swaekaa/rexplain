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

from fastapi import FastAPI
from app.routes.analyze import router as analyze_router
from app.routes.chat import router as chat_router
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="RExplain API")

app.include_router(analyze_router)
app.include_router(chat_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {"message": "RExplain API running"}