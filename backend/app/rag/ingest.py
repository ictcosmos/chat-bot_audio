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

        pages = parsed.get("pages", [])
        readable_pages = [
            page for page in pages if page.get("text", "").strip()
        ]

        if not pages:
            return {
                "success": False,
                "file_id": file_id,
                "file_name": file_name,
                "pages": 0,
                "chunks": 0,
                "error": "No pages were extracted from the document.",
            }

        if not readable_pages:
            return {
                "success": False,
                "file_id": file_id,
                "file_name": file_name,
                "pages": len(pages),
                "chunks": 0,
                "error": (
                    "No readable text was found. "
                    "This PDF may be scanned, image-based, blank, or protected."
                ),
            }

        chunks = chunk_document(parsed)

        if not chunks:
            return {
                "success": False,
                "file_id": file_id,
                "file_name": file_name,
                "pages": len(pages),
                "chunks": 0,
                "error": "Text was extracted, but no chunks were created.",
            }

        texts = [chunk["text"] for chunk in chunks if chunk.get("text", "").strip()]

        if not texts:
            return {
                "success": False,
                "file_id": file_id,
                "file_name": file_name,
                "pages": len(pages),
                "chunks": 0,
                "error": "All extracted chunks were empty.",
            }

        embeddings = embed_texts(texts)

        if not embeddings:
            return {
                "success": False,
                "file_id": file_id,
                "file_name": file_name,
                "pages": len(pages),
                "chunks": len(chunks),
                "error": "Embedding generation failed.",
            }

        num_added = add_chunks_with_metadata(
            chunks=chunks,
            embeddings=embeddings,
            user_id=user_id,
            chat_id=chat_id,
        )

        if num_added == 0:
            return {
                "success": False,
                "file_id": file_id,
                "file_name": file_name,
                "pages": len(pages),
                "chunks": len(chunks),
                "error": (
                    "Chunks were created but not added to vector database. "
                    "This may happen if chunk IDs already exist."
                ),
            }

        return {
            "success": True,
            "file_id": file_id,
            "file_name": file_name,
            "pages": len(readable_pages),
            "chunks": len(chunks),
            "chunks_added": num_added,
            "error": "",
        }

    except Exception as e:
        return {
            "success": False,
            "file_id": file_id,
            "file_name": file_name,
            "pages": 0,
            "chunks": 0,
            "error": str(e),
        }

    finally:
        if file_path and os.path.exists(file_path):
            cleanup_temp_file(file_path)