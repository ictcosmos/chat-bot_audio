from app.graph.state import ChatState
from app.services.model_router import choose_route
from app.services.groq_service import ask_groq_fast
from app.services.gemini_service import ask_gemini_search_grounded
from app.services.trace_service import (
    build_groq_chat_trace,
    build_gemini_search_trace,
    build_document_rag_trace,
    build_hybrid_trace,
    build_voice_trace,
)
from app.services.token_service import format_token_usage
from app.rag.retrieval import retrieve_chunks


def auth_check_node(state: ChatState) -> dict:
    return {}


def intent_router_node(state: ChatState) -> dict:
    route_info = choose_route(
        state.get("message", ""),
        state.get("mode", "groq_chat"),
        state.get("selected_file_ids"),
    )
    return {
        "route": route_info["route"],
        "provider": route_info["provider"],
        "reason": route_info.get("reason", ""),
    }


def groq_chat_node(state: ChatState) -> dict:
    result = ask_groq_fast(state.get("message", ""))
    trace = build_groq_chat_trace(state.get("reason", "Default normal reasoning route"))
    return {
        "answer": result["answer"],
        "token_usage": format_token_usage(result.get("token_usage")),
        "trace": trace,
        "model": result.get("token_usage", {}).get("model", "llama-3.1-8b-instant"),
        "provider": "groq",
    }


def gemini_search_node(state: ChatState) -> dict:
    result = ask_gemini_search_grounded(state.get("message", ""))
    trace = build_gemini_search_trace(state.get("reason", "Latest/current information detected"))
    return {
        "answer": result["answer"],
        "token_usage": format_token_usage(result.get("token_usage")),
        "trace": trace,
        "model": result.get("token_usage", {}).get("model", "gemini-2.5-flash"),
        "provider": "gemini",
    }


def document_retrieval_node(state: ChatState) -> dict:
    chunks, top_score = retrieve_chunks(
        question=state.get("message", ""),
        user_id=state.get("user_id", ""),
        chat_id=state.get("chat_id", ""),
        selected_file_ids=state.get("selected_file_ids"),
    )
    return {
        "retrieved_chunks": chunks,
        "top_score": top_score,
    }


def document_answer_node(state: ChatState) -> dict:
    chunks = state.get("retrieved_chunks", [])

    if not chunks:
        answer = "No related information was found in the uploaded document."
        sources = []
        trace = build_document_rag_trace(0, 0.0)
        token_info = format_token_usage(None)
        return {
            "answer": answer,
            "sources": sources,
            "trace": trace,
            "token_usage": token_info,
            "model": "llama-3.3-70b-versatile",
            "provider": "groq",
        }

    from app.services.groq_service import ask_groq_for_rag
    result = ask_groq_for_rag(state.get("message", ""), chunks)

    sources = [
        {
            "file_name": c.get("file_name", ""),
            "page_start": c.get("page_start", 1),
            "page_end": c.get("page_end", 1),
            "chunk_id": c.get("chunk_id", ""),
        }
        for c in chunks
    ]

    top_score = state.get("top_score", 0.0)
    trace = build_document_rag_trace(len(chunks), top_score)
    token_info = format_token_usage(result.get("token_usage"))

    return {
        "answer": result["answer"],
        "sources": sources,
        "trace": trace,
        "token_usage": token_info,
        "model": result.get("token_usage", {}).get("model", "llama-3.3-70b-versatile"),
        "provider": "groq",
    }


def hybrid_node(state: ChatState) -> dict:
    chunks, top_score = retrieve_chunks(
        question=state.get("message", ""),
        user_id=state.get("user_id", ""),
        chat_id=state.get("chat_id", ""),
        selected_file_ids=state.get("selected_file_ids"),
    )

    if chunks:
        from app.services.groq_service import ask_groq_for_rag
        result = ask_groq_for_rag(state.get("message", ""), chunks)
        sources = [
            {
                "file_name": c.get("file_name", ""),
                "page_start": c.get("page_start", 1),
                "page_end": c.get("page_end", 1),
                "chunk_id": c.get("chunk_id", ""),
            }
            for c in chunks
        ]
        trace = build_hybrid_trace("document", len(chunks))
        token_info = format_token_usage(result.get("token_usage"))
        return {
            "answer": result["answer"],
            "sources": sources,
            "trace": trace,
            "token_usage": token_info,
            "model": result.get("token_usage", {}).get("model", "llama-3.3-70b-versatile"),
            "provider": "groq",
        }

    header = "No related information was found in the uploaded document.\n\nGeneral answer:\n"

    from app.services.model_router import is_latest_query
    if is_latest_query(state.get("message", "")):
        result = ask_gemini_search_grounded(state.get("message", ""))
        trace = build_hybrid_trace("gemini_search_fallback", 0)
        trace["reason"] = "No document context found, fell back to Gemini Search"
        token_info = format_token_usage(result.get("token_usage"))
        return {
            "answer": header + result["answer"],
            "sources": [],
            "trace": trace,
            "token_usage": token_info,
            "model": result.get("token_usage", {}).get("model", "gemini-2.5-flash"),
            "provider": "gemini",
        }

    result = ask_groq_fast(state.get("message", ""))
    trace = build_hybrid_trace("groq_fallback", 0)
    trace["reason"] = "No document context found, fell back to Groq"
    token_info = format_token_usage(result.get("token_usage"))
    return {
        "answer": header + result["answer"],
        "sources": [],
        "trace": trace,
        "token_usage": token_info,
        "model": result.get("token_usage", {}).get("model", "llama-3.1-8b-instant"),
        "provider": "groq",
    }


def voice_node(state: ChatState) -> dict:
    trace = build_voice_trace()
    token_info = format_token_usage(None)
    return {
        "answer": state.get("message", ""),
        "trace": trace,
        "token_usage": token_info,
        "model": "gemini-2.5-flash",
        "provider": "gemini",
    }


def token_logger_node(state: ChatState) -> dict:
    return {}


def trace_logger_node(state: ChatState) -> dict:
    return {}


def save_chat_node(state: ChatState) -> dict:
    return {}
