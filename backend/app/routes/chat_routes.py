from fastapi import APIRouter, HTTPException, Depends, Header
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

from app.services.firebase_service import (
    verify_token,
    get_chats,
    get_chat,
    create_chat,
    update_chat,
    delete_chat,
    save_message,
    get_messages,
    search_chats,
)
from app.graph.workflow import chat_workflow
from app.graph.state import ChatState

router = APIRouter()


class ChatRequest(BaseModel):
    chat_id: str
    message: str
    mode: str = "groq_chat"
    selected_file_ids: List[str] = []


class CreateChatRequest(BaseModel):
    title: str = "New Chat"
    mode: str = "groq_chat"


class UpdateChatRequest(BaseModel):
    title: Optional[str] = None
    mode: Optional[str] = None


async def get_current_user(authorization: str = Header(...)) -> dict:
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid authorization header")
    token = authorization.split(" ")[1]
    try:
        return verify_token(token)
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")


@router.post("/chat")
async def chat_endpoint(
    request: ChatRequest,
    user: dict = Depends(get_current_user),
):
    uid = user["uid"]

    chat = get_chat(request.chat_id, uid)
    if not chat:
        chat = create_chat(uid, "New Chat", request.mode)
        request.chat_id = chat["id"]

    initial_state: ChatState = {
        "user_id": uid,
        "chat_id": request.chat_id,
        "message": request.message,
        "mode": request.mode,
        "selected_file_ids": request.selected_file_ids,
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

    save_message(request.chat_id, {
        "role": "user",
        "content": request.message,
        "provider": "",
        "model": "",
    })
    save_message(request.chat_id, {
        "role": "assistant",
        "content": result.get("answer", ""),
        "provider": result.get("provider", ""),
        "model": result.get("model", ""),
        "input_tokens": result.get("token_usage", {}).get("input_tokens"),
        "output_tokens": result.get("token_usage", {}).get("output_tokens"),
        "total_tokens": result.get("token_usage", {}).get("total_tokens"),
        "trace": result.get("trace", {}),
        "sources": result.get("sources", []),
    })

    update_chat(request.chat_id, uid, {"updated_at": datetime.utcnow()})

    return {
        "answer": result.get("answer", ""),
        "sources": result.get("sources", []),
        "trace": result.get("trace", {}),
        "token_usage": result.get("token_usage", {}),
    }


@router.get("/chats")
async def list_chats(user: dict = Depends(get_current_user)):
    chats = get_chats(user["uid"])
    return {"chats": chats}


@router.get("/chats/search")
async def search_chats_endpoint(
    q: str = "",
    user: dict = Depends(get_current_user),
):
    if not q:
        chats = get_chats(user["uid"])
    else:
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
    return {"chat": chat, "messages": messages}


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

    success = update_chat(chat_id, user["uid"], data)
    if not success:
        raise HTTPException(status_code=404, detail="Chat not found")
    return {"status": "updated"}


@router.delete("/chats/{chat_id}")
async def delete_chat_endpoint(
    chat_id: str,
    user: dict = Depends(get_current_user),
):
    success = delete_chat(chat_id, user["uid"])
    if not success:
        raise HTTPException(status_code=404, detail="Chat not found")
    return {"status": "deleted"}
