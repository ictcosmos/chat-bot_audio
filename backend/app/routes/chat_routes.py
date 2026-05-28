from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field

from app.graph.state import ChatState
from app.graph.workflow import chat_workflow
from app.services.firebase_service import (
    create_chat,
    delete_chat,
    get_chat,
    get_chats,
    get_messages,
    make_chat_title_from_message,
    maybe_update_chat_title_from_first_message,
    save_message,
    search_chats,
    update_chat,
    verify_token,
)

router = APIRouter()


class ChatRequest(BaseModel):
    chat_id: Optional[str] = None
    message: str
    mode: str = "auto"
    selected_file_ids: List[str] = Field(default_factory=list)


class CreateChatRequest(BaseModel):
    title: str = "New Chat"
    mode: str = "auto"


class UpdateChatRequest(BaseModel):
    title: Optional[str] = None
    mode: Optional[str] = None


async def get_current_user(authorization: str = Header(...)) -> dict:
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid authorization header")

    token = authorization.split(" ")[1]

    try:
        return verify_token(token)
    except Exception as exc:
        raise HTTPException(status_code=401, detail=f"Invalid token: {str(exc)}")


def clean_history_for_model(messages: list[dict], max_messages: int = 12) -> list[dict]:
    """
    Only pass useful user/assistant messages from the current chat.
    This lets follow-up questions like:
    'who was the man of the match?'
    understand the previous answer in the same chat.
    """
    cleaned = []

    for message in messages or []:
        role = message.get("role")
        content = (message.get("content") or "").strip()

        if role not in {"user", "assistant"}:
            continue

        if not content:
            continue

        cleaned.append(
            {
                "role": role,
                "content": content,
            }
        )

    return cleaned[-max_messages:]


@router.post("/chat")
async def chat_endpoint(
    request: ChatRequest,
    user: dict = Depends(get_current_user),
):
    uid = user["uid"]

    try:
        user_message = (request.message or "").strip()

        if not user_message:
            raise HTTPException(status_code=400, detail="Message cannot be empty.")

        chat_id = request.chat_id

        if chat_id:
            chat = get_chat(chat_id, uid)
        else:
            chat = None

        if not chat:
            initial_title = make_chat_title_from_message(user_message)
            chat = create_chat(uid, initial_title, request.mode)
            chat_id = chat["id"]
        else:
            maybe_update_chat_title_from_first_message(
                chat_id=chat_id,
                uid=uid,
                user_message=user_message,
            )

        clean_selected_file_ids = [
            file_id
            for file_id in (request.selected_file_ids or [])
            if file_id and isinstance(file_id, str)
        ]

        # Firestore history from this same chat only.
        previous_messages = get_messages(chat_id, uid)
        model_history = clean_history_for_model(previous_messages, max_messages=12)

        initial_state: ChatState = {
            "user_id": uid,
            "chat_id": chat_id,
            "message": user_message,
            "mode": request.mode,
            "selected_file_ids": clean_selected_file_ids,

            # Important: passed into graph nodes so Groq/Gemini/RAG can resolve follow-ups.
            "history": model_history,

            "route": "",
            "provider": "",
            "model": "",
            "retrieved_chunks": [],
            "top_score": None,
            "answer": "",
            "sources": [],
            "trace": {},
            "token_usage": {},
        }

        result = await chat_workflow.ainvoke(initial_state)

        save_message(
            chat_id,
            {
                "role": "user",
                "content": user_message,
                "provider": "",
                "model": "",
            },
        )

        save_message(
            chat_id,
            {
                "role": "assistant",
                "content": result.get("answer", ""),
                "provider": result.get("provider", ""),
                "model": result.get("model", ""),
                "input_tokens": result.get("token_usage", {}).get("input_tokens", 0),
                "output_tokens": result.get("token_usage", {}).get("output_tokens", 0),
                "total_tokens": result.get("token_usage", {}).get("total_tokens", 0),
                "trace": result.get("trace", {}),
                "sources": result.get("sources", []),
            },
        )

        update_chat(chat_id, uid, {"updated_at": datetime.utcnow()})

        updated_chat = get_chat(chat_id, uid)

        return {
            "answer": result.get("answer", ""),
            "sources": result.get("sources", []),
            "trace": result.get("trace", {}),
            "token_usage": result.get("token_usage", {}),
            "chat_id": chat_id,
            "chat": updated_chat,
        }

    except HTTPException:
        raise

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Chat processing failed: {str(exc)}",
        )


@router.get("/chats")
async def list_chats(user: dict = Depends(get_current_user)):
    chats = get_chats(user["uid"])
    return {"chats": chats}


@router.get("/chats/search")
async def search_chats_endpoint(
    q: str = "",
    user: dict = Depends(get_current_user),
):
    chats = search_chats(user["uid"], q)
    return {"chats": chats}


@router.get("/chats/{chat_id}")
async def get_chat_endpoint(
    chat_id: str,
    user: dict = Depends(get_current_user),
):
    chat = get_chat(chat_id, user["uid"])

    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")

    messages = get_messages(chat_id, user["uid"])

    return {
        "chat": chat,
        "messages": messages,
    }


@router.post("/chats")
async def create_chat_endpoint(
    request: CreateChatRequest,
    user: dict = Depends(get_current_user),
):
    chat = create_chat(user["uid"], request.title, request.mode)
    return {"chat": chat}


@router.patch("/chats/{chat_id}")
async def update_chat_endpoint(
    chat_id: str,
    request: UpdateChatRequest,
    user: dict = Depends(get_current_user),
):
    data = {}

    if request.title is not None:
        data["title"] = request.title

    if request.mode is not None:
        data["mode"] = request.mode

    if not data:
        chat = get_chat(chat_id, user["uid"])

        if not chat:
            raise HTTPException(status_code=404, detail="Chat not found")

        return {
            "status": "unchanged",
            "chat": chat,
        }

    success = update_chat(chat_id, user["uid"], data)

    if not success:
        raise HTTPException(status_code=404, detail="Chat not found")

    chat = get_chat(chat_id, user["uid"])

    return {
        "status": "updated",
        "chat": chat,
    }


@router.delete("/chats/{chat_id}")
async def delete_chat_endpoint(
    chat_id: str,
    user: dict = Depends(get_current_user),
):
    success = delete_chat(chat_id, user["uid"])

    if not success:
        raise HTTPException(status_code=404, detail="Chat not found")

    return {"status": "deleted"}