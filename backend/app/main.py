import asyncio
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import FRONTEND_ORIGIN, LOCAL_STORAGE_DIR
from app.routes.auth_routes import router as auth_router
from app.routes.chat_routes import router as chat_router
from app.routes.drive_routes import router as drive_router
from app.routes.file_routes import router as file_router
from app.routes.voice_routes import router as voice_router

app = FastAPI(title="ChatBot API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        FRONTEND_ORIGIN,
        "http://localhost:5173",
        "http://localhost:3000",
    ],
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


@app.on_event("startup")
async def startup_preload_voice_models():
    """
    Start loading voice models automatically when backend starts.

    This runs in the background so uvicorn does not freeze at startup.
    The frontend can still call /voice/status to see loading/loaded state.
    """

    async def _background_load():
        try:
            from app.services.voice_service import preload_voice_models

            print("[Startup] Background voice model preload started...")
            await asyncio.to_thread(preload_voice_models)
            print("[Startup] Background voice model preload finished.")
        except Exception as exc:
            print(f"[Startup] Voice model preload failed/skipped: {exc}")

    asyncio.create_task(_background_load())


@app.get("/")
async def root():
    return {"status": "ok", "message": "ChatBot API is running"}


@app.get("/health")
async def health():
    return {"status": "healthy"}