from typing import Any, Dict, List, Optional, TypedDict


class ChatState(TypedDict, total=False):
    user_id: str
    chat_id: str
    message: str
    mode: str
    selected_file_ids: List[str]

    # Current chat history from Firestore.
    # Only messages from the same chat_id should be passed here.
    history: List[Dict[str, Any]]

    route: str
    provider: str
    reason: str
    model: str

    retrieved_chunks: List[Dict[str, Any]]
    top_score: Optional[float]

    answer: str
    sources: List[Dict[str, Any]]
    trace: Dict[str, Any]
    token_usage: Dict[str, Any]