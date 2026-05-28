import os
from datetime import datetime

import firebase_admin
from firebase_admin import auth, credentials, firestore

from app.config import (
    FIREBASE_CLIENT_EMAIL,
    FIREBASE_PRIVATE_KEY,
    FIREBASE_PROJECT_ID,
    LOCAL_STORAGE_DIR,
)

if not firebase_admin._apps:
    private_key = FIREBASE_PRIVATE_KEY

    if private_key:
        private_key = private_key.replace("\\n", "\n")

    cred = credentials.Certificate(
        {
            "type": "service_account",
            "project_id": FIREBASE_PROJECT_ID,
            "private_key": private_key,
            "client_email": FIREBASE_CLIENT_EMAIL,
            "token_uri": "https://oauth2.googleapis.com/token",
        }
    )

    firebase_admin.initialize_app(cred)

db = firestore.client()

os.makedirs(LOCAL_STORAGE_DIR, exist_ok=True)


def _serialize_firestore_value(value):
    if isinstance(value, datetime):
        return value.isoformat()

    return value


def _serialize_doc(data: dict) -> dict:
    if not data:
        return {}

    return {key: _serialize_firestore_value(value) for key, value in data.items()}


def make_chat_title_from_message(message: str) -> str:
    cleaned = " ".join((message or "").strip().split())

    if not cleaned:
        return "New Chat"

    if len(cleaned) <= 45:
        return cleaned

    return cleaned[:45].rstrip() + "..."


def verify_token(id_token: str) -> dict:
    return auth.verify_id_token(id_token)


def get_user(uid: str) -> dict | None:
    doc = db.collection("users").document(uid).get()

    if not doc.exists:
        return None

    return {"id": doc.id, **_serialize_doc(doc.to_dict())}


def create_user(uid: str, data: dict):
    db.collection("users").document(uid).set(data, merge=True)


def create_chat(uid: str, title: str = "New Chat", mode: str = "auto") -> dict:
    now = datetime.utcnow()

    data = {
        "user_id": uid,
        "title": title or "New Chat",
        "mode": mode or "auto",
        "created_at": now,
        "updated_at": now,
    }

    ref = db.collection("chats").document()
    ref.set(data)

    return {"id": ref.id, **_serialize_doc(data)}


def get_chat(chat_id: str, uid: str) -> dict | None:
    doc = db.collection("chats").document(chat_id).get()

    if not doc.exists:
        return None

    data = doc.to_dict() or {}

    if data.get("user_id") != uid:
        return None

    return {"id": doc.id, **_serialize_doc(data)}


def get_chats(uid: str) -> list[dict]:
    """
    Firestore stores all chats.
    We query by user_id only and sort in Python to avoid composite index errors.
    """
    docs = db.collection("chats").where("user_id", "==", uid).stream()

    chats = []

    for doc in docs:
        data = doc.to_dict() or {}
        chats.append({"id": doc.id, **_serialize_doc(data)})

    chats.sort(
        key=lambda item: item.get("updated_at") or item.get("created_at") or "",
        reverse=True,
    )

    return chats


def update_chat(chat_id: str, uid: str, data: dict) -> bool:
    ref = db.collection("chats").document(chat_id)
    doc = ref.get()

    if not doc.exists:
        return False

    current = doc.to_dict() or {}

    if current.get("user_id") != uid:
        return False

    data = data or {}
    data["updated_at"] = datetime.utcnow()

    ref.update(data)

    return True


def delete_chat(chat_id: str, uid: str) -> bool:
    ref = db.collection("chats").document(chat_id)
    doc = ref.get()

    if not doc.exists:
        return False

    data = doc.to_dict() or {}

    if data.get("user_id") != uid:
        return False

    messages = ref.collection("messages").stream()

    for message in messages:
        message.reference.delete()

    ref.delete()

    return True


def save_message(chat_id: str, data: dict) -> str:
    ref = db.collection("chats").document(chat_id).collection("messages").document()

    data = data or {}
    data["created_at"] = datetime.utcnow()

    ref.set(data)

    db.collection("chats").document(chat_id).update(
        {
            "updated_at": datetime.utcnow(),
        }
    )

    return ref.id


def get_messages(chat_id: str, uid: str) -> list[dict]:
    chat = get_chat(chat_id, uid)

    if not chat:
        return []

    docs = db.collection("chats").document(chat_id).collection("messages").stream()

    messages = []

    for doc in docs:
        data = doc.to_dict() or {}
        messages.append({"id": doc.id, **_serialize_doc(data)})

    messages.sort(key=lambda item: item.get("created_at") or "")

    return messages


def count_messages(chat_id: str, uid: str) -> int:
    chat = get_chat(chat_id, uid)

    if not chat:
        return 0

    docs = db.collection("chats").document(chat_id).collection("messages").stream()

    return sum(1 for _ in docs)


def maybe_update_chat_title_from_first_message(
    chat_id: str,
    uid: str,
    user_message: str,
) -> str:
    """
    If chat title is New Chat and this is the first user message,
    update title dynamically from the first text.
    """
    chat = get_chat(chat_id, uid)

    if not chat:
        return "New Chat"

    current_title = chat.get("title", "New Chat")

    if current_title and current_title != "New Chat":
        return current_title

    message_count = count_messages(chat_id, uid)

    if message_count > 0:
        return current_title

    new_title = make_chat_title_from_message(user_message)

    update_chat(chat_id, uid, {"title": new_title})

    return new_title


def search_chats(uid: str, query: str) -> list[dict]:
    chats = get_chats(uid)

    if not query:
        return chats

    q = query.lower().strip()

    return [
        chat
        for chat in chats
        if q in (chat.get("title", "") or "").lower()
    ]


def save_file_metadata(data: dict) -> str:
    ref = db.collection("files").document()

    now = datetime.utcnow()

    data = data or {}
    data["created_at"] = data.get("created_at") or now
    data["updated_at"] = data.get("updated_at") or now

    ref.set(data)

    return ref.id


def get_user_files(uid: str) -> list[dict]:
    docs = db.collection("files").where("user_id", "==", uid).stream()

    files = []

    for doc in docs:
        data = doc.to_dict() or {}
        files.append({"id": doc.id, "file_id": doc.id, **_serialize_doc(data)})

    files.sort(
        key=lambda item: item.get("created_at") or item.get("updated_at") or "",
        reverse=True,
    )

    return files


def get_file(file_id: str, uid: str) -> dict | None:
    doc = db.collection("files").document(file_id).get()

    if not doc.exists:
        return None

    data = doc.to_dict() or {}

    if data.get("user_id") != uid:
        return None

    return {"id": doc.id, "file_id": doc.id, **_serialize_doc(data)}


def delete_file(file_id: str, uid: str) -> bool:
    ref = db.collection("files").document(file_id)
    doc = ref.get()

    if not doc.exists:
        return False

    data = doc.to_dict() or {}

    if data.get("user_id") != uid:
        return False

    local_path = data.get("local_storage_path", "")

    if local_path and os.path.exists(local_path):
        try:
            os.remove(local_path)
        except Exception:
            pass

    ref.delete()

    return True


def save_local_file(file_bytes: bytes, relative_path: str) -> str:
    full_path = os.path.join(LOCAL_STORAGE_DIR, relative_path)

    os.makedirs(os.path.dirname(full_path), exist_ok=True)

    with open(full_path, "wb") as f:
        f.write(file_bytes)

    return full_path


def get_local_file_url(relative_path: str) -> str:
    return f"/storage/{relative_path}"