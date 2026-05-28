import os
from fastapi import APIRouter, HTTPException, Depends, Header, Query
from pydantic import BaseModel

from app.services.firebase_service import (
    verify_token,
    save_file_metadata,
    save_local_file,
    db,
)
from app.services.google_drive_service import (
    get_auth_url,
    exchange_code,
    list_drive_files,
    download_drive_file,
    get_file_metadata,
)
from app.mcp.filesystem_client import save_temp_file, cleanup_temp_file
from app.rag.ingest import ingest_document

router = APIRouter()


async def get_current_user(authorization: str = Header(...)) -> dict:
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid authorization header")
    token = authorization.split(" ")[1]
    try:
        return verify_token(token)
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")


class ImportRequest(BaseModel):
    file_id: str
    chat_id: str = ""
    access_token: str


@router.get("/auth-url")
async def drive_auth_url():
    url = get_auth_url()
    return {"auth_url": url}


@router.get("/callback")
async def drive_callback(code: str = Query(...)):
    try:
        tokens = exchange_code(code)
        return {
            "access_token": tokens.get("access_token"),
            "refresh_token": tokens.get("refresh_token"),
            "expires_in": tokens.get("expires_in"),
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to exchange code: {str(e)}")


@router.get("/files")
async def list_drive_files_endpoint(
    access_token: str = Query(...),
    query: str = Query(""),
    user: dict = Depends(get_current_user),
):
    try:
        files = list_drive_files(access_token, query)
        return {"files": files}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to list files: {str(e)}")


@router.post("/import")
async def import_drive_file(
    request: ImportRequest,
    user: dict = Depends(get_current_user),
):
    uid = user["uid"]

    try:
        meta = get_file_metadata(request.access_token, request.file_id)
        file_name = meta.get("name", f"drive_{request.file_id}")
        mime_type = meta.get("mimeType", "application/octet-stream")

        file_bytes = download_drive_file(
            request.access_token, request.file_id, mime_type
        )

        ext_map = {
            "application/pdf": ".pdf",
            "application/vnd.google-apps.document": ".txt",
            "application/vnd.google-apps.spreadsheet": ".csv",
            "application/vnd.google-apps.presentation": ".txt",
            "text/plain": ".txt",
            "text/csv": ".csv",
        }
        ext = ext_map.get(mime_type, ".pdf")
        full_name = f"{file_name}{ext}" if not file_name.endswith(ext) else file_name

        relative_path = f"users/{uid}/drive/{request.file_id}/{full_name}"
        save_local_file(file_bytes, relative_path)

        local_storage_path = os.path.join(
            os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
            "local_storage",
            relative_path,
        )

        file_id = save_file_metadata({
            "user_id": uid,
            "chat_id": request.chat_id,
            "source": "google_drive",
            "file_name": full_name,
            "file_type": ext,
            "local_storage_path": local_storage_path,
            "local_storage_relative": relative_path,
            "google_drive_file_id": request.file_id,
            "indexed": False,
            "updated_at": None,
        })

        tmp_path = save_temp_file(file_bytes, full_name)

        ingest_result = ingest_document(
            file_path=tmp_path,
            file_name=full_name,
            file_id=file_id,
            user_id=uid,
            chat_id=request.chat_id,
        )

        if ingest_result.get("success"):
            db.collection("files").document(file_id).update({"indexed": True})
        else:
            cleanup_temp_file(tmp_path)

        return {
            "file_id": file_id,
            "file_name": full_name,
            "indexed": ingest_result.get("success", False),
            "pages": ingest_result.get("pages", 0),
            "chunks": ingest_result.get("chunks", 0),
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Import failed: {str(e)}")
