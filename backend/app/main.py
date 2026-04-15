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