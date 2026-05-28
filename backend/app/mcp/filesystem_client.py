import os
import tempfile


def save_temp_file(file_bytes: bytes, filename: str) -> str:
    tmp_dir = tempfile.gettempdir()
    safe_name = os.path.basename(filename)
    tmp_path = os.path.join(tmp_dir, f"chatbot_{safe_name}")
    with open(tmp_path, "wb") as f:
        f.write(file_bytes)
    return tmp_path


def cleanup_temp_file(file_path: str):
    try:
        if os.path.exists(file_path):
            os.remove(file_path)
    except Exception:
        pass
