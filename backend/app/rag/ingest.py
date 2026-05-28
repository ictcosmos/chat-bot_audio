import os
from app.mcp.document_parser_client import DocumentParserClient
from app.mcp.filesystem_client import cleanup_temp_file
from app.rag.chunker import chunk_document
from app.rag.embeddings import embed_texts
from app.rag.vector_store import add_chunks_with_metadata


def ingest_document(
    file_path: str,
    file_name: str,
    file_id: str,
    user_id: str,
    chat_id: str,
) -> dict:
    try:
        parsed = DocumentParserClient.parse(file_path, file_name, file_id)
        chunks = chunk_document(parsed)
        texts = [c["text"] for c in chunks]
        embeddings = embed_texts(texts)
        num_added = add_chunks_with_metadata(
            chunks, embeddings, user_id, chat_id
        )
        return {
            "success": True,
            "file_id": file_id,
            "file_name": file_name,
            "pages": len(parsed.get("pages", [])),
            "chunks": len(chunks),
            "chunks_added": num_added,
        }
    except Exception as e:
        return {
            "success": False,
            "file_id": file_id,
            "file_name": file_name,
            "error": str(e),
        }
    finally:
        if file_path and os.path.exists(file_path):
            cleanup_temp_file(file_path)
