from app.rag.embeddings import embed_text
from app.rag.vector_store import get_or_create_collection


def retrieve_chunks(
    question: str,
    user_id: str,
    chat_id: str,
    selected_file_ids: list[str] | None = None,
    top_k: int = 5,
    similarity_threshold: float = 0.70,
) -> tuple[list[dict], float]:
    collection = get_or_create_collection()

    query_embedding = embed_text(question)

    where_filter = {"user_id": user_id, "chat_id": chat_id}
    if selected_file_ids:
        where_filter["file_id"] = {"$in": selected_file_ids}

    results = collection.query(
        query_embeddings=[query_embedding],
        n_results=top_k * 2,
        where=where_filter,
    )

    chunks = []
    top_score = 0.0

    if not results or not results.get("ids") or not results["ids"][0]:
        return [], 0.0

    for i in range(len(results["ids"][0])):
        distance = results["distances"][0][i] if results.get("distances") else 0
        similarity = 1.0 - distance

        if similarity >= similarity_threshold:
            meta = results["metadatas"][0][i] if results.get("metadatas") else {}
            chunks.append({
                "chunk_id": results["ids"][0][i],
                "file_id": meta.get("file_id", ""),
                "file_name": meta.get("file_name", ""),
                "page_start": meta.get("page_start", 1),
                "page_end": meta.get("page_end", 1),
                "section": meta.get("section", ""),
                "text": results["documents"][0][i] if results.get("documents") else "",
                "similarity_score": round(similarity, 4),
            })
            top_score = max(top_score, similarity)

    chunks = sorted(chunks, key=lambda x: x["similarity_score"], reverse=True)[:top_k]

    return chunks, top_score


def delete_file_chunks(file_id: str, user_id: str):
    collection = get_or_create_collection()
    where_filter = {"file_id": file_id, "user_id": user_id}
    try:
        results = collection.get(where=where_filter)
        if results and results.get("ids"):
            collection.delete(ids=results["ids"])
    except Exception:
        pass
