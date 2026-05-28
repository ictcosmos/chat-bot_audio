from app.services.google_drive_service import (
    download_drive_file,
    get_file_metadata,
    list_drive_files,
)


class GoogleDriveClient:
    @staticmethod
    def list_files(access_token: str, query: str = "") -> list[dict]:
        return list_drive_files(access_token, query)

    @staticmethod
    def download_file(access_token: str, file_id: str, mime_type: str) -> bytes:
        return download_drive_file(access_token, file_id, mime_type)

    @staticmethod
    def get_metadata(access_token: str, file_id: str) -> dict:
        return get_file_metadata(access_token, file_id)
