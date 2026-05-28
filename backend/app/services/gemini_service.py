import google.genai as genai
from google.genai import types

from app.config import GEMINI_API_KEY, GEMINI_SEARCH_MODEL, GEMINI_VOICE_MODEL, GEMINI_EMBEDDING_MODEL

client = genai.Client(api_key=GEMINI_API_KEY)


def ask_gemini_search_grounded(message: str) -> dict:
    model = client.models.generate_content(
        model=GEMINI_SEARCH_MODEL,
        contents=message,
        config=types.GenerateContentConfig(
            tools=[types.Tool(google_search=types.GoogleSearch())],
            temperature=0.3,
        ),
    )
    text = model.text if model.text else ""
    usage = model.usage_metadata if hasattr(model, "usage_metadata") else None
    return {
        "answer": text,
        "token_usage": {
            "input_tokens": usage.prompt_token_count if usage else 0,
            "output_tokens": usage.candidates_token_count if usage else 0,
            "total_tokens": (usage.prompt_token_count + usage.candidates_token_count) if usage else 0,
            "model": GEMINI_SEARCH_MODEL,
            "provider": "gemini",
        }
    }


def ask_gemini_voice(audio_base64: str, mime_type: str = "audio/webm") -> dict:
    response = client.models.generate_content(
        model=GEMINI_VOICE_MODEL,
        contents=[
            types.Content(
                role="user",
                parts=[
                    types.Part(
                        inline_data=types.Blob(
                            mime_type=mime_type,
                            data=audio_base64,
                        )
                    ),
                    types.Part(text="Please respond to this audio. Detect the language and reply in the same language."),
                ]
            )
        ],
    )
    text = response.text if response.text else ""
    return {
        "answer": text,
        "language": detect_language(text),
    }


def detect_language(text: str) -> str:
    nepali_chars = set("नपरलगमवकतसयफबहजडदटठणधछशषािीुूेैोौंः")
    nepali_count = sum(1 for c in text if c in nepali_chars)
    return "ne" if nepali_count > 3 else "en"


def embed_with_gemini(text: str) -> list[float]:
    result = client.models.embed_content(
        model=GEMINI_EMBEDDING_MODEL,
        contents=text,
    )
    return result.embeddings[0].values if result.embeddings else []


def gemini_tts_or_voice_response(text: str) -> str | None:
    return None
