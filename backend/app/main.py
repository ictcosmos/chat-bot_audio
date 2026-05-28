from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os

from app.config import FRONTEND_ORIGIN, LOCAL_STORAGE_DIR
from app.routes.chat_routes import router as chat_router
from app.routes.file_routes import router as file_router
from app.routes.auth_routes import router as auth_router
from app.routes.voice_routes import router as voice_router
from app.routes.drive_routes import router as drive_router

app = FastAPI(title="ChatBot API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_ORIGIN, "http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

os.makedirs(LOCAL_STORAGE_DIR, exist_ok=True)
app.mount("/storage", StaticFiles(directory=LOCAL_STORAGE_DIR), name="storage")

app.include_router(auth_router, prefix="/auth", tags=["Auth"])
app.include_router(chat_router, prefix="", tags=["Chat"])
app.include_router(file_router, prefix="/files", tags=["Files"])
app.include_router(voice_router, prefix="/voice", tags=["Voice"])
app.include_router(drive_router, prefix="/drive", tags=["Drive"])


@app.get("/")
async def root():
    return {"status": "ok", "message": "ChatBot API is running"}


@app.get("/health")
async def health():
    return {"status": "healthy"}
