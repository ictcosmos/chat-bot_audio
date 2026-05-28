from app.rag.embeddings import embed_text
from app.rag.vector_store import get_or_create_collection


def _build_where_filter(
    user_id: str,
    chat_id: str,
    selected_file_ids: list[str] | None = None,
) -> dict:
    conditions = [
        {"user_id": {"$eq": user_id}},
        {"chat_id": {"$eq": chat_id}},
    ]

    if selected_file_ids:
        clean_file_ids = [
            file_id for file_id in selected_file_ids
            if file_id and isinstance(file_id, str)
        ]

        if clean_file_ids:
            conditions.append({"file_id": {"$in": clean_file_ids}})

    if len(conditions) == 1:
        return conditions[0]

    return {"$and": conditions}


def retrieve_chunks(
    question: str,
    user_id: str,
    chat_id: str,
    selected_file_ids: list[str] | None = None,
    top_k: int = 5,
    similarity_threshold: float = 0.0,
) -> tuple[list[dict], float]:
    collection = get_or_create_collection()

    if not question or not question.strip():
        return [], 0.0

    query_embedding = embed_text(question)

    if not query_embedding:
        return [], 0.0

    where_filter = _build_where_filter(
        user_id=user_id,
        chat_id=chat_id,
        selected_file_ids=selected_file_ids,
    )

    try:
        results = collection.query(
            query_embeddings=[query_embedding],
            n_results=top_k,
            where=where_filter,
        )
    except Exception as exc:
        raise RuntimeError(
            f"Vector retrieval failed. where_filter={where_filter}. Error: {str(exc)}"
        )

    chunks = []
    top_score = 0.0

    if not results or not results.get("ids") or not results["ids"][0]:
        return [], 0.0

    ids = results.get("ids", [[]])[0]
    distances = results.get("distances", [[]])[0]
    metadatas = results.get("metadatas", [[]])[0]
    documents = results.get("documents", [[]])[0]

    for i, chunk_id in enumerate(ids):
        distance = distances[i] if i < len(distances) else 1.0
        similarity = 1.0 - distance

        top_score = max(top_score, similarity)

        if similarity < similarity_threshold:
            continue

        meta = metadatas[i] if i < len(metadatas) else {}
        text = documents[i] if i < len(documents) else ""

        chunks.append(
            {
                "chunk_id": chunk_id,
                "file_id": meta.get("file_id", ""),
                "file_name": meta.get("file_name", ""),
                "page_start": meta.get("page_start", 1),
                "page_end": meta.get("page_end", 1),
                "section": meta.get("section", ""),
                "text": text,
                "similarity_score": round(similarity, 4),
            }
        )

    chunks = sorted(
        chunks,
        key=lambda x: x.get("similarity_score", 0.0),
        reverse=True,
    )[:top_k]

    return chunks, top_score


def delete_file_chunks(file_id: str, user_id: str):
    collection = get_or_create_collection()

    where_filter = {
        "$and": [
            {"file_id": {"$eq": file_id}},
            {"user_id": {"$eq": user_id}},
        ]
    }

    try:
        results = collection.get(where=where_filter)

        if results and results.get("ids"):
            collection.delete(ids=results["ids"])

        return len(results.get("ids", [])) if results else 0

    except Exception:
        return 0