import requests
from urllib.parse import urlencode

from app.config import GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI


def get_auth_url() -> str:
    params = {
        "client_id": GOOGLE_CLIENT_ID,
        "redirect_uri": GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": "https://www.googleapis.com/auth/drive.readonly",
        "access_type": "offline",
        "prompt": "consent",
    }
    return f"https://accounts.google.com/o/oauth2/v2/auth?{urlencode(params)}"


def exchange_code(code: str) -> dict:
    resp = requests.post(
        "https://oauth2.googleapis.com/token",
        data={
            "code": code,
            "client_id": GOOGLE_CLIENT_ID,
            "client_secret": GOOGLE_CLIENT_SECRET,
            "redirect_uri": GOOGLE_REDIRECT_URI,
            "grant_type": "authorization_code",
        },
    )
    resp.raise_for_status()
    return resp.json()


def refresh_access_token(refresh_token: str) -> dict:
    resp = requests.post(
        "https://oauth2.googleapis.com/token",
        data={
            "client_id": GOOGLE_CLIENT_ID,
            "client_secret": GOOGLE_CLIENT_SECRET,
            "refresh_token": refresh_token,
            "grant_type": "refresh_token",
        },
    )
    resp.raise_for_status()
    return resp.json()


def list_drive_files(access_token: str, query: str = "") -> list[dict]:
    params = {
        "pageSize": 50,
        "fields": "files(id, name, mimeType, size, modifiedTime)",
        "q": f"trashed=false and (mimeType contains 'pdf' or mimeType contains 'document' or mimeType contains 'spreadsheet' or mimeType contains 'text' or mimeType contains 'presentation')",
    }
    if query:
        params["q"] = f"name contains '{query}' and trashed=false"

    headers = {"Authorization": f"Bearer {access_token}"}
    resp = requests.get(
        "https://www.googleapis.com/drive/v3/files",
        params=params,
        headers=headers,
    )
    resp.raise_for_status()
    return resp.json().get("files", [])


def download_drive_file(access_token: str, file_id: str, mime_type: str) -> bytes:
    headers = {"Authorization": f"Bearer {access_token}"}

    export_mime = None
    if "spreadsheet" in mime_type:
        export_mime = "text/csv"
    elif "document" in mime_type and "pdf" not in mime_type:
        export_mime = "text/plain"
    elif "presentation" in mime_type:
        export_mime = "text/plain"

    if export_mime:
        url = f"https://www.googleapis.com/drive/v3/files/{file_id}/export"
        params = {"mimeType": export_mime}
    else:
        url = f"https://www.googleapis.com/drive/v3/files/{file_id}"
        params = {"alt": "media"}

    resp = requests.get(url, headers=headers, params=params)
    resp.raise_for_status()
    return resp.content


def get_file_metadata(access_token: str, file_id: str) -> dict:
    headers = {"Authorization": f"Bearer {access_token}"}
    resp = requests.get(
        f"https://www.googleapis.com/drive/v3/files/{file_id}",
        headers=headers,
        params={"fields": "id,name,mimeType,size,modifiedTime"},
    )
    resp.raise_for_status()
    return resp.json()
