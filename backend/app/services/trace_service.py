def build_groq_chat_trace(reason: str = "Default normal reasoning route") -> dict:
    return {
        "route": "groq_chat",
        "provider": "groq",
        "model": "llama-3.1-8b-instant",
        "reason": reason,
        "tools_used": ["groq_api"],
    }


def build_gemini_search_trace(reason: str = "Latest/current information detected") -> dict:
    return {
        "route": "gemini_search",
        "provider": "gemini",
        "model": "gemini-2.5-flash",
        "reason": reason,
        "tools_used": ["gemini_api", "google_search_grounding"],
    }


def build_document_rag_trace(
    retrieved_chunks: int,
    top_score: float,
    model: str = "llama-3.3-70b-versatile",
) -> dict:
    return {
        "route": "document_rag",
        "provider": "groq",
        "embedding_provider": "gemini",
        "vector_db": "chroma",
        "retrieved_chunks": retrieved_chunks,
        "top_similarity_score": round(top_score, 4),
        "model": model,
        "answer_source": "uploaded document",
        "tools_used": ["document_parser_mcp", "chroma_db", "groq_api"],
    }


def build_hybrid_trace(source: str, retrieved_chunks: int = 0) -> dict:
    return {
        "route": "hybrid",
        "provider": "mixed",
        "answer_source": source,
        "retrieved_chunks": retrieved_chunks,
        "tools_used": ["chroma_db", "groq_api", "gemini_api"],
    }


def build_voice_trace() -> dict:
    return {
        "route": "voice",
        "provider": "gemini",
        "model": "gemini-2.5-flash",
        "tools_used": ["gemini_voice_api"],
    }
