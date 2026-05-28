from datetime import datetime

from fastapi import APIRouter, Depends, File, Form, Header, HTTPException, UploadFile

from app.services.firebase_service import (
    create_chat,
    get_chat,
    save_message,
    update_chat,
    verify_token,
)
from app.services.voice_service import (
    get_voice_model_status,
    preload_voice_models,
    process_voice_audio,
)

router = APIRouter()


async def get_current_user(authorization: str = Header(...)) -> dict:
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid authorization header")

    token = authorization.split(" ")[1]

    try:
        return verify_token(token)
    except Exception as exc:
        raise HTTPException(status_code=401, detail=f"Invalid token: {str(exc)}")


def build_voice_trace(result: dict | None = None) -> dict:
    result = result or {}

    return {
        "route": result.get("route", "voice"),
        "stt_provider": "faster-whisper",
        "vad_provider": "silero",
        "input_language": result.get("input_language", ""),
        "output_language": result.get("language", ""),
        "reasoning_provider": result.get("provider", ""),
        "tts_provider": result.get("tts_provider", ""),
        "tts_nepali": "gtts",
        "tts_english": "kokoro",
    }


@router.get("/status")
async def voice_status(user: dict = Depends(get_current_user)):
    return get_voice_model_status()


@router.post("/preload")
async def voice_preload(user: dict = Depends(get_current_user)):
    try:
        return preload_voice_models()
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Voice model preload failed: {str(exc)}",
        )


@router.post("/transcribe")
async def transcribe_audio(
    audio: UploadFile = File(...),
    chat_id: str = Form(""),
    user: dict = Depends(get_current_user),
):
    uid = user["uid"]

    audio_bytes = await audio.read()

    if not audio_bytes:
        raise HTTPException(status_code=400, detail="No audio data received.")

    mime_type = audio.content_type or "audio/webm"

    try:
        result = process_voice_audio(audio_bytes, mime_type)
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Voice processing failed: {str(exc)}",
        )

    transcript = result.get("transcript", "")
    answer_text = result.get("answer", "")
    detected_lang = result.get("language", "en")
    input_lang = result.get("input_language", detected_lang)
    token_usage = result.get("token_usage", {})

    if not chat_id:
        chat = create_chat(uid, "Voice Chat", "voice")
        chat_id = chat["id"]
    else:
        chat = get_chat(chat_id, uid)
        if not chat:
            chat = create_chat(uid, "Voice Chat", "voice")
            chat_id = chat["id"]

    if transcript:
        save_message(
            chat_id,
            {
                "role": "user",
                "content": transcript,
                "provider": result.get("stt_provider", "faster-whisper"),
                "model": result.get("stt_model", ""),
                "input_language": input_lang,
                "vad": result.get("vad", {}),
            },
        )

    if answer_text:
        save_message(
            chat_id,
            {
                "role": "assistant",
                "content": answer_text,
                "provider": result.get("provider", ""),
                "model": result.get("model", ""),
                "input_tokens": token_usage.get("input_tokens", 0),
                "output_tokens": token_usage.get("output_tokens", 0),
                "total_tokens": token_usage.get("total_tokens", 0),
                "trace": build_voice_trace(result),
                "sources": [],
                "output_language": detected_lang,
                "tts_provider": result.get("tts_provider", ""),
            },
        )

    update_chat(chat_id, uid, {"updated_at": datetime.utcnow()})

    return {
        "chat_id": chat_id,
        "transcript": transcript,
        "answer": answer_text,
        "language": detected_lang,
        "input_language": input_lang,
        "provider": result.get("provider", ""),
        "route": result.get("route", ""),
        "stt_provider": result.get("stt_provider", "faster-whisper"),
        "stt_model": result.get("stt_model", ""),
        "detected_language_raw": result.get("detected_language_raw", ""),
        "model": result.get("model", ""),
        "tts_provider": result.get("tts_provider", ""),
        "audio_base64": result.get("audio_base64", ""),
        "audio_mime_type": result.get("audio_mime_type", ""),
        "trace": build_voice_trace(result),
        "token_usage": token_usage,
        "no_speech": result.get("no_speech", False),
        "vad": result.get("vad", {}),
    }


@router.post("/respond")
async def respond_audio(
    audio: UploadFile = File(...),
    chat_id: str = Form(""),
    user: dict = Depends(get_current_user),
):
    return await transcribe_audio(audio=audio, chat_id=chat_id, user=user)