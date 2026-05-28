from langgraph.graph import StateGraph, END
from app.graph.state import ChatState
from app.graph.nodes import (
    auth_check_node,
    intent_router_node,
    groq_chat_node,
    gemini_search_node,
    document_retrieval_node,
    document_answer_node,
    hybrid_node,
    voice_node,
    token_logger_node,
    trace_logger_node,
    save_chat_node,
)


def build_chat_workflow() -> StateGraph:
    workflow = StateGraph(ChatState)

    workflow.add_node("auth_check_node", auth_check_node)
    workflow.add_node("intent_router_node", intent_router_node)
    workflow.add_node("groq_chat_node", groq_chat_node)
    workflow.add_node("gemini_search_node", gemini_search_node)
    workflow.add_node("document_retrieval_node", document_retrieval_node)
    workflow.add_node("document_answer_node", document_answer_node)
    workflow.add_node("hybrid_node", hybrid_node)
    workflow.add_node("voice_node", voice_node)
    workflow.add_node("token_logger_node", token_logger_node)
    workflow.add_node("trace_logger_node", trace_logger_node)
    workflow.add_node("save_chat_node", save_chat_node)

    workflow.set_entry_point("auth_check_node")

    workflow.add_edge("auth_check_node", "intent_router_node")

    workflow.add_conditional_edges(
        "intent_router_node",
        lambda state: state.get("route", "groq_chat"),
        {
            "groq_chat": "groq_chat_node",
            "gemini_search": "gemini_search_node",
            "document_rag": "document_retrieval_node",
            "hybrid": "hybrid_node",
            "voice": "voice_node",
        },
    )

    workflow.add_edge("groq_chat_node", "token_logger_node")
    workflow.add_edge("gemini_search_node", "token_logger_node")
    workflow.add_edge("document_retrieval_node", "document_answer_node")
    workflow.add_edge("document_answer_node", "token_logger_node")
    workflow.add_edge("hybrid_node", "token_logger_node")
    workflow.add_edge("voice_node", "token_logger_node")

    workflow.add_edge("token_logger_node", "trace_logger_node")
    workflow.add_edge("trace_logger_node", "save_chat_node")
    workflow.add_edge("save_chat_node", END)

    return workflow.compile()


chat_workflow = build_chat_workflow()
