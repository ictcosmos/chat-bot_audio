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
    except ValueError:
        return client.create_collection(collection_name)


def add_chunks(chunks: list[dict], embeddings: list[list[float]]):
    collection = get_or_create_collection()

    ids = [c["chunk_id"] for c in chunks]
    metadatas = [
        {
            "user_id": "",
            "chat_id": "",
            "file_id": c["file_id"],
            "file_name": c["file_name"],
            "page_start": c["page_start"],
            "page_end": c["page_end"],
            "section": c.get("section", ""),
        }
        for c in chunks
    ]
    texts = [c["text"] for c in chunks]

    collection.add(
        ids=ids,
        embeddings=embeddings,
        metadatas=metadatas,
        documents=texts,
    )


def add_chunks_with_metadata(chunks: list[dict], embeddings: list[list[float]], user_id: str, chat_id: str):
    collection = get_or_create_collection()

    ids = [c["chunk_id"] for c in chunks]
    metadatas = [
        {
            "user_id": user_id,
            "chat_id": chat_id,
            "file_id": c["file_id"],
            "file_name": c["file_name"],
            "page_start": c["page_start"],
            "page_end": c["page_end"],
            "section": c.get("section", ""),
        }
        for c in chunks
    ]
    texts = [c["text"] for c in chunks]

    existing_ids = set()
    try:
        existing = collection.get(ids=ids)
        if existing and existing.get("ids"):
            existing_ids = set(existing["ids"])
    except Exception:
        pass

    new_ids = []
    new_embeddings = []
    new_metadatas = []
    new_documents = []

    for i, cid in enumerate(ids):
        if cid not in existing_ids:
            new_ids.append(cid)
            new_embeddings.append(embeddings[i])
            new_metadatas.append(metadatas[i])
            new_documents.append(texts[i])

    if new_ids:
        collection.add(
            ids=new_ids,
            embeddings=new_embeddings,
            metadatas=new_metadatas,
            documents=new_documents,
        )
        return len(new_ids)
    return 0
