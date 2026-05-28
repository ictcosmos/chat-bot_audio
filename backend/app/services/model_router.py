LATEST_KEYWORDS = [
    "latest", "current", "today", "yesterday", "this week",
    "recent", "news", "update", "now", "2026",
    "newly released", "who won", "current status",
    "president", "election", "winner", "score", "match",
]


def is_latest_query(message: str) -> bool:
    text = message.lower()
    return any(keyword in text for keyword in LATEST_KEYWORDS)


def choose_route(
    message: str, mode: str = "auto", selected_file_ids: list[str] | None = None
) -> dict:
    selected = selected_file_ids or []

    if mode == "document":
        return {
            "route": "document_rag",
            "provider": "groq",
            "reason": "Document mode selected.",
        }

    if mode == "hybrid":
        return {
            "route": "hybrid",
            "provider": "mixed",
            "reason": "Hybrid mode selected.",
        }

    if mode == "gemini_search":
        return {
            "route": "gemini_search",
            "provider": "gemini",
            "reason": "Gemini search mode selected.",
        }

    if mode == "voice":
        return {
            "route": "voice",
            "provider": "gemini",
            "reason": "Voice mode selected.",
        }

    if mode == "groq_chat":
        if is_latest_query(message):
            return {
                "route": "gemini_search",
                "provider": "gemini",
                "reason": "Latest/current information detected.",
            }
        return {
            "route": "groq_chat",
            "provider": "groq",
            "reason": "Default normal reasoning route.",
        }

    # auto mode — detect from context
    if selected:
        return {
            "route": "hybrid",
            "provider": "mixed",
            "reason": "Documents selected — using hybrid mode.",
        }

    if is_latest_query(message):
        return {
            "route": "gemini_search",
            "provider": "gemini",
            "reason": "Latest/current information detected.",
        }

    return {
        "route": "groq_chat",
        "provider": "groq",
        "reason": "Default normal reasoning route.",
    }
