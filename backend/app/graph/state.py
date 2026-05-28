from typing import TypedDict, List, Dict, Any, Optional


class ChatState(TypedDict):
    user_id: str
    chat_id: str
    message: str
    mode: str
    selected_file_ids: List[str]

    route: str
    provider: str
    model: str

    retrieved_chunks: List[Dict[str, Any]]
    top_score: Optional[float]

    answer: str
    sources: List[Dict[str, Any]]
    trace: Dict[str, Any]
    token_usage: Dict[str, Any]
