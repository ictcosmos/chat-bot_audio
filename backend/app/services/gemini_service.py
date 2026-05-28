import google.genai as genai
from google.genai import types

from app.config import (
    GEMINI_API_KEY,
    GEMINI_EMBEDDING_MODEL,
    GEMINI_SEARCH_MODEL,
    GEMINI_VOICE_MODEL,
)

client = genai.Client(api_key=GEMINI_API_KEY)


def _format_history_for_prompt(history: list[dict] | None, max_messages: int = 12) -> str:
    lines = []

    for item in (history or [])[-max_messages:]:
        role = item.get("role", "")
        content = str(item.get("content", "")).strip()

        if role not in {"user", "assistant"}:
            continue

        if not content:
            continue

        speaker = "User" if role == "user" else "Assistant"
        lines.append(f"{speaker}: {content}")

    return "\n".join(lines)


def ask_gemini_search_grounded(
    message: str,
    history: list[dict] | None = None,
) -> dict:
    history_text = _format_history_for_prompt(history)

    if history_text:
        prompt = f"""
You are a helpful assistant with Google Search grounding.

Use ONLY the current chat history below to understand follow-up references.
For example, if the user asks "who was the man of the match?", resolve which match from this same chat history.

Current chat history:
{history_text}

Current user question:
{message}

Instructions:
- If the current question needs latest/current information, use Google Search grounding.
- If the current question is a follow-up, use the chat history to identify the topic.
- Do not use history from other chats.
- Answer directly and clearly.
"""
    else:
        prompt = message

    response = client.models.generate_content(
        model=GEMINI_SEARCH_MODEL,
        contents=prompt,
        config=types.GenerateContentConfig(
            tools=[types.Tool(google_search=types.GoogleSearch())],
            temperature=0.3,
        ),
    )

    text = response.text if response.text else ""
    usage = response.usage_metadata if hasattr(response, "usage_metadata") else None

    return {
        "answer": text,
        "token_usage": {
            "input_tokens": usage.prompt_token_count if usage else 0,
            "output_tokens": usage.candidates_token_count if usage else 0,
            "total_tokens": (
                usage.prompt_token_count + usage.candidates_token_count
            )
            if usage
            else 0,
            "model": GEMINI_SEARCH_MODEL,
            "provider": "gemini",
        },
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
                    types.Part(
                        text="Please respond to this audio. Detect the language and reply in the same language."
                    ),
                ],
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