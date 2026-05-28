import firebase_admin
from firebase_admin import credentials, firestore, auth
from google.cloud.firestore import FieldFilter
import os
from datetime import datetime

from app.config import (
    FIREBASE_PROJECT_ID,
    FIREBASE_CLIENT_EMAIL,
    FIREBASE_PRIVATE_KEY,
    LOCAL_STORAGE_DIR,
)

if not firebase_admin._apps:
    cred = credentials.Certificate({
        "type": "service_account",
        "project_id": FIREBASE_PROJECT_ID,
        "private_key": FIREBASE_PRIVATE_KEY,
        "client_email": FIREBASE_CLIENT_EMAIL,
        "token_uri": "https://oauth2.googleapis.com/token",
    })
    firebase_admin.initialize_app(cred)

db = firestore.client()

os.makedirs(LOCAL_STORAGE_DIR, exist_ok=True)


def verify_token(id_token: str) -> dict:
    decoded = auth.verify_id_token(id_token)
    return decoded


def get_user(uid: str) -> dict | None:
    doc = db.collection("users").document(uid).get()
    return doc.to_dict() if doc.exists else None


def create_user(uid: str, data: dict):
    db.collection("users").document(uid).set(data)


def get_chats(uid: str) -> list[dict]:
    docs = (
        db.collection("chats")
        .where(filter=FieldFilter("user_id", "==", uid))
        .order_by("updated_at", direction=firestore.Query.DESCENDING)
        .stream()
    )
    return [{"id": d.id, **d.to_dict()} for d in docs]


def get_chat(chat_id: str, uid: str) -> dict | None:
    doc = db.collection("chats").document(chat_id).get()
    if not doc.exists:
        return None
    data = doc.to_dict()
    if data.get("user_id") != uid:
        return None
    return {"id": doc.id, **data}


def create_chat(uid: str, title: str = "New Chat", mode: str = "auto") -> dict:
    now = datetime.utcnow()
    data = {
        "user_id": uid,
        "title": title,
        "mode": mode,
        "created_at": now,
        "updated_at": now,
    }
    ref = db.collection("chats").document()
    ref.set(data)
    return {"id": ref.id, **data}


def update_chat(chat_id: str, uid: str, data: dict):
    ref = db.collection("chats").document(chat_id)
    doc = ref.get()
    if not doc.exists or doc.to_dict().get("user_id") != uid:
        return False
    data["updated_at"] = datetime.utcnow()
    ref.update(data)
    return True


def delete_chat(chat_id: str, uid: str) -> bool:
    ref = db.collection("chats").document(chat_id)
    doc = ref.get()
    if not doc.exists or doc.to_dict().get("user_id") != uid:
        return False

    messages = db.collection("chats").document(chat_id).collection("messages").stream()
    for m in messages:
        m.reference.delete()

    ref.delete()
    return True


def save_message(chat_id: str, data: dict):
    ref = db.collection("chats").document(chat_id).collection("messages").document()
    data["created_at"] = datetime.utcnow()
    ref.set(data)
    return ref.id


def get_messages(chat_id: str, uid: str) -> list[dict]:
    chat = get_chat(chat_id, uid)
    if not chat:
        return []
    docs = (
        db.collection("chats")
        .document(chat_id)
        .collection("messages")
        .order_by("created_at")
        .stream()
    )
    return [{"id": d.id, **d.to_dict()} for d in docs]


def save_file_metadata(data: dict) -> str:
    ref = db.collection("files").document()
    data["created_at"] = datetime.utcnow()
    ref.set(data)
    return ref.id


def get_user_files(uid: str) -> list[dict]:
    docs = (
        db.collection("files")
        .where(filter=FieldFilter("user_id", "==", uid))
        .order_by("created_at", direction=firestore.Query.DESCENDING)
        .stream()
    )
    return [{"id": d.id, **d.to_dict()} for d in docs]


def get_file(file_id: str, uid: str) -> dict | None:
    doc = db.collection("files").document(file_id).get()
    if not doc.exists:
        return None
    data = doc.to_dict()
    if data.get("user_id") != uid:
        return None
    return {"id": doc.id, **data}


def delete_file(file_id: str, uid: str) -> bool:
    ref = db.collection("files").document(file_id)
    doc = ref.get()
    if not doc.exists or doc.to_dict().get("user_id") != uid:
        return False
    data = doc.to_dict()
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
    return relative_path


def get_local_file_url(relative_path: str) -> str:
    return f"/storage/{relative_path}"


def search_chats(uid: str, query: str) -> list[dict]:
    chats = get_chats(uid)
    query_lower = query.lower()
    return [c for c in chats if query_lower in c.get("title", "").lower()]
