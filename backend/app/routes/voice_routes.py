from fastapi import APIRouter, HTTPException, Depends, Header, UploadFile, File

from app.services.firebase_service import verify_token
from app.services.voice_service import process_voice_audio
from app.services.trace_service import build_voice_trace
from app.services.token_service import format_token_usage

router = APIRouter()


async def get_current_user(authorization: str = Header(...)) -> dict:
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid authorization header")
    token = authorization.split(" ")[1]
    try:
        return verify_token(token)
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")


@router.post("/transcribe")
async def transcribe_audio(
    audio: UploadFile = File(...),
    user: dict = Depends(get_current_user),
):
    audio_bytes = await audio.read()
    mime_type = audio.content_type or "audio/webm"
    result = process_voice_audio(audio_bytes, mime_type)

    answer_text = result.get("answer", "")
    detected_lang = result.get("language", "en")

    return {
        "transcript": "",
        "answer": answer_text,
        "language": detected_lang,
        "audio_url": None,
        "trace": build_voice_trace(),
        "token_usage": format_token_usage(None),
    }
