import chromadb
from chromadb.config import Settings

from app.config import CHROMA_DIR

_client = None


def get_client():
    global _client

    if _client is None:
        _client = chromadb.PersistentClient(
            path=CHROMA_DIR,
            settings=Settings(anonymized_telemetry=False),
        )

    return _client


def get_or_create_collection(collection_name: str = "documents"):
    client = get_client()

    try:
        return client.get_collection(collection_name)
    except Exception:
        return client.create_collection(collection_name)


def _safe_metadata_value(value):
    if value is None:
        return ""

    if isinstance(value, (str, int, float, bool)):
        return value

    return str(value)


def _make_unique_chunk_id(chunk: dict, index: int) -> str:
    file_id = chunk.get("file_id", "file")
    chunk_id = chunk.get("chunk_id", f"chunk_{index + 1:04d}")
    return f"{file_id}_{chunk_id}"


def add_chunks(chunks: list[dict], embeddings: list[list[float]]):
    return add_chunks_with_metadata(
        chunks=chunks,
        embeddings=embeddings,
        user_id="",
        chat_id="",
    )


def add_chunks_with_metadata(
    chunks: list[dict],
    embeddings: list[list[float]],
    user_id: str,
    chat_id: str,
):
    collection = get_or_create_collection()

    if not chunks:
        return 0

    if not embeddings:
        return 0

    if len(chunks) != len(embeddings):
        raise ValueError(
            f"Chunks and embeddings length mismatch: {len(chunks)} chunks, "
            f"{len(embeddings)} embeddings"
        )

    ids = [_make_unique_chunk_id(chunk, index) for index, chunk in enumerate(chunks)]

    metadatas = [
        {
            "user_id": _safe_metadata_value(user_id),
            "chat_id": _safe_metadata_value(chat_id),
            "file_id": _safe_metadata_value(chunk.get("file_id", "")),
            "file_name": _safe_metadata_value(chunk.get("file_name", "")),
            "page_start": _safe_metadata_value(chunk.get("page_start", 1)),
            "page_end": _safe_metadata_value(chunk.get("page_end", 1)),
            "section": _safe_metadata_value(chunk.get("section", "")),
        }
        for chunk in chunks
    ]

    documents = [chunk.get("text", "") for chunk in chunks]

    existing_ids = set()

    try:
        existing = collection.get(ids=ids)
        if existing and existing.get("ids"):
            existing_ids = set(existing["ids"])
    except Exception:
        existing_ids = set()

    new_ids = []
    new_embeddings = []
    new_metadatas = []
    new_documents = []

    for index, chunk_id in enumerate(ids):
        if chunk_id in existing_ids:
            continue

        doc_text = documents[index]

        if not doc_text or not doc_text.strip():
            continue

        new_ids.append(chunk_id)
        new_embeddings.append(embeddings[index])
        new_metadatas.append(metadatas[index])
        new_documents.append(doc_text)

    if not new_ids:
        return 0

    collection.add(
        ids=new_ids,
        embeddings=new_embeddings,
        metadatas=new_metadatas,
        documents=new_documents,
    )

    return len(new_ids)


def delete_file_chunks(file_id: str, user_id: str):
    collection = get_or_create_collection()

    try:
        results = collection.get(
            where={
                "$and": [
                    {"file_id": {"$eq": file_id}},
                    {"user_id": {"$eq": user_id}},
                ]
            }
        )

        ids = results.get("ids", []) if results else []

        if ids:
            collection.delete(ids=ids)

        return len(ids)

    except Exception:
        return 0