import base64

from app.services.gemini_service import ask_gemini_voice, detect_language


def process_voice_audio(audio_data: bytes, mime_type: str = "audio/webm") -> dict:
    audio_base64 = base64.b64encode(audio_data).decode("utf-8")
    result = ask_gemini_voice(audio_base64, mime_type)
    return {
        "transcript": "",
        "answer": result.get("answer", ""),
        "language": result.get("language", "en"),
    }
