import os
import uuid

from fastapi import APIRouter, Depends, File, Form, Header, HTTPException, UploadFile

from app.config import ALLOWED_EXTENSIONS, LOCAL_STORAGE_DIR, MAX_FILE_SIZE_MB
from app.mcp.filesystem_client import cleanup_temp_file, save_temp_file
from app.rag.ingest import ingest_document
from app.rag.retrieval import delete_file_chunks
from app.services.firebase_service import (
    db,
    delete_file,
    get_file,
    get_user_files,
    save_file_metadata,
    verify_token,
)

router = APIRouter()


async def get_current_user(authorization: str = Header(...)) -> dict:
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid authorization header")

    token = authorization.split(" ")[1]

    try:
        return verify_token(token)
    except Exception as exc:
        raise HTTPException(status_code=401, detail=f"Invalid token: {str(exc)}")


def save_file_to_local_storage(file_bytes: bytes, relative_path: str) -> str:
    """
    Saves uploaded file to backend/local_storage.
    This does NOT use Firebase Storage.
    """
    full_path = os.path.join(LOCAL_STORAGE_DIR, relative_path)

    os.makedirs(os.path.dirname(full_path), exist_ok=True)

    with open(full_path, "wb") as f:
        f.write(file_bytes)

    return full_path


@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    chat_id: str = Form(""),
    user: dict = Depends(get_current_user),
):
    uid = user["uid"]

    if not chat_id:
        raise HTTPException(
            status_code=400,
            detail="chat_id is required. Please create or select a chat before uploading.",
        )

    filename = file.filename or "uploaded_file"
    ext = os.path.splitext(filename)[1].lower()

    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"File type {ext} not allowed. Allowed: {', '.join(ALLOWED_EXTENSIONS)}",
        )

    file_bytes = await file.read()

    if not file_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    file_size_mb = len(file_bytes) / (1024 * 1024)

    if file_size_mb > MAX_FILE_SIZE_MB:
        raise HTTPException(
            status_code=400,
            detail=f"File too large. Max allowed size is {MAX_FILE_SIZE_MB}MB.",
        )

    safe_filename = f"{uuid.uuid4()}_{filename}"

    relative_path = os.path.join(
        "users",
        uid,
        "chats",
        chat_id,
        "files",
        safe_filename,
    )

    local_file_path = save_file_to_local_storage(file_bytes, relative_path)

    file_id = save_file_metadata(
        {
            "user_id": uid,
            "chat_id": chat_id,
            "source": "local_upload",
            "file_name": filename,
            "safe_file_name": safe_filename,
            "file_type": ext,
            "file_size": len(file_bytes),
            "local_storage_path": local_file_path,
            "local_storage_relative": relative_path,
            "indexed": False,
            "index_error": "",
            "pages": 0,
            "chunks": 0,
        }
    )

    tmp_path = None
    ingest_result = {
        "success": False,
        "pages": 0,
        "chunks": 0,
        "error": "",
    }

    try:
        tmp_path = save_temp_file(file_bytes, filename)

        ingest_result = ingest_document(
            file_path=tmp_path,
            file_name=filename,
            file_id=file_id,
            user_id=uid,
            chat_id=chat_id,
        )

        if ingest_result.get("success"):
            db.collection("files").document(file_id).update(
                {
                    "indexed": True,
                    "index_error": "",
                    "pages": ingest_result.get("pages", 0),
                    "chunks": ingest_result.get("chunks", 0),
                }
            )
        else:
            db.collection("files").document(file_id).update(
                {
                    "indexed": False,
                    "index_error": ingest_result.get(
                        "error", "File uploaded locally but indexing failed."
                    ),
                    "pages": ingest_result.get("pages", 0),
                    "chunks": ingest_result.get("chunks", 0),
                }
            )

    except Exception as exc:
        ingest_result = {
            "success": False,
            "pages": 0,
            "chunks": 0,
            "error": str(exc),
        }

        db.collection("files").document(file_id).update(
            {
                "indexed": False,
                "index_error": str(exc),
                "pages": 0,
                "chunks": 0,
            }
        )

    finally:
        if tmp_path:
            cleanup_temp_file(tmp_path)

    return {
        "file_id": file_id,
        "id": file_id,
        "file_name": filename,
        "file_type": ext,
        "file_size": len(file_bytes),
        "source": "local_upload",
        "local_storage_path": local_file_path,
        "local_storage_relative": relative_path,
        "indexed": ingest_result.get("success", False),
        "pages": ingest_result.get("pages", 0),
        "chunks": ingest_result.get("chunks", 0),
        "error": ingest_result.get("error", ""),
    }


@router.get("")
async def list_files(user: dict = Depends(get_current_user)):
    try:
        files = get_user_files(user["uid"])
        return {"files": files}
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to load local file metadata: {str(exc)}",
        )


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

    local_path = file_data.get("local_storage_path", "")

    if local_path and os.path.exists(local_path):
        try:
            os.remove(local_path)
        except Exception:
            pass

    success = delete_file(file_id, uid)

    if not success:
        raise HTTPException(status_code=500, detail="Failed to delete file metadata")

    return {"status": "deleted"}