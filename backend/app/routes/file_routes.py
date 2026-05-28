import os
import uuid
from fastapi import APIRouter, HTTPException, Depends, Header, UploadFile, File, Form

from app.config import ALLOWED_EXTENSIONS, MAX_FILE_SIZE_MB
from app.services.firebase_service import (
    verify_token,
    save_local_file,
    save_file_metadata,
    get_user_files,
    get_file,
    delete_file,
    db,
)
from app.mcp.filesystem_client import save_temp_file, cleanup_temp_file
from app.rag.ingest import ingest_document
from app.rag.retrieval import delete_file_chunks

router = APIRouter()


async def get_current_user(authorization: str = Header(...)) -> dict:
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid authorization header")
    token = authorization.split(" ")[1]
    try:
        return verify_token(token)
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")


@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    chat_id: str = Form(""),
    user: dict = Depends(get_current_user),
):
    uid = user["uid"]
    ext = os.path.splitext(file.filename or "")[1].lower()

    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"File type {ext} not allowed. Allowed: {', '.join(ALLOWED_EXTENSIONS)}",
        )

    file_bytes = await file.read()
    file_size_mb = len(file_bytes) / (1024 * 1024)
    if file_size_mb > MAX_FILE_SIZE_MB:
        raise HTTPException(
            status_code=400,
            detail=f"File too large. Max: {MAX_FILE_SIZE_MB}MB"
        )

    safe_name = f"{uuid.uuid4()}_{file.filename}"
    relative_path = f"users/{uid}/chats/{chat_id}/files/{safe_name}"

    save_local_file(file_bytes, relative_path)

    file_id = save_file_metadata({
        "user_id": uid,
        "chat_id": chat_id,
        "source": "upload",
        "file_name": file.filename,
        "file_type": ext,
        "local_storage_path": os.path.join(
            os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
            "local_storage",
            relative_path,
        ),
        "local_storage_relative": relative_path,
        "google_drive_file_id": "",
        "indexed": False,
        "updated_at": None,
    })

    tmp_path = save_temp_file(file_bytes, file.filename or "upload")

    ingest_result = ingest_document(
        file_path=tmp_path,
        file_name=file.filename or "upload",
        file_id=file_id,
        user_id=uid,
        chat_id=chat_id,
    )

    if ingest_result.get("success"):
        db.collection("files").document(file_id).update({"indexed": True})
    else:
        cleanup_temp_file(tmp_path)

    return {
        "file_id": file_id,
        "file_name": file.filename,
        "indexed": ingest_result.get("success", False),
        "pages": ingest_result.get("pages", 0),
        "chunks": ingest_result.get("chunks", 0),
    }


@router.get("")
async def list_files(user: dict = Depends(get_current_user)):
    files = get_user_files(user["uid"])
    return {"files": files}


@router.delete("/{file_id}")
async def delete_file_endpoint(
    file_id: str,
    user: dict = Depends(get_current_user),
):
    uid = user["uid"]
    file_data = get_file(file_id, uid)
    if not file_data:
        raise HTTPException(status_code=404, detail="File not found")

    delete_file_chunks(file_id, uid)
    success = delete_file(file_id, uid)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to delete file")

    return {"status": "deleted"}
