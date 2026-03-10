from fastapi import FastAPI
from app.routes.analyze import router as analyze_router

app = FastAPI(title="RExplain API")

app.include_router(analyze_router)

@app.get("/")
def root():
    return {"message": "RExplain API running"}