from groq import Groq

from app.config import GROQ_API_KEY, GROQ_MODEL_FAST, GROQ_MODEL_STRONG

client = Groq(api_key=GROQ_API_KEY)


def _clean_history(history: list[dict] | None, max_messages: int = 12) -> list[dict]:
    cleaned = []

    for item in history or []:
        role = item.get("role")
        content = item.get("content", "")

        if role not in {"user", "assistant"}:
            continue

        if not content or not str(content).strip():
            continue

        cleaned.append(
            {
                "role": role,
                "content": str(content).strip(),
            }
        )

    return cleaned[-max_messages:]


def ask_groq_fast(
    prompt: str,
    system_prompt: str = "You are a helpful AI assistant.",
    history: list[dict] | None = None,
) -> dict:
    messages = [
        {
            "role": "system",
            "content": (
                system_prompt
                + "\n\nUse the current chat history to understand follow-up questions. "
                "If the user says things like 'that match', 'he', 'it', 'who was the man of the match', "
                "resolve the reference from the previous messages in this same chat only."
            ),
        }
    ]

    messages.extend(_clean_history(history))
    messages.append({"role": "user", "content": prompt})

    completion = client.chat.completions.create(
        model=GROQ_MODEL_FAST,
        messages=messages,
        temperature=0.7,
        max_tokens=2048,
    )

    choice = completion.choices[0]
    usage = completion.usage

    return {
        "answer": choice.message.content or "",
        "token_usage": {
            "input_tokens": usage.prompt_tokens if usage else 0,
            "output_tokens": usage.completion_tokens if usage else 0,
            "total_tokens": usage.total_tokens if usage else 0,
            "model": GROQ_MODEL_FAST,
            "provider": "groq",
        },
    }


def ask_groq_strong(
    prompt: str,
    system_prompt: str = "You are a helpful AI assistant.",
    history: list[dict] | None = None,
) -> dict:
    messages = [
        {
            "role": "system",
            "content": (
                system_prompt
                + "\n\nUse the current chat history to understand follow-up questions. "
                "Only use messages from this same chat."
            ),
        }
    ]

    messages.extend(_clean_history(history))
    messages.append({"role": "user", "content": prompt})

    completion = client.chat.completions.create(
        model=GROQ_MODEL_STRONG,
        messages=messages,
        temperature=0.7,
        max_tokens=4096,
    )

    choice = completion.choices[0]
    usage = completion.usage

    return {
        "answer": choice.message.content or "",
        "token_usage": {
            "input_tokens": usage.prompt_tokens if usage else 0,
            "output_tokens": usage.completion_tokens if usage else 0,
            "total_tokens": usage.total_tokens if usage else 0,
            "model": GROQ_MODEL_STRONG,
            "provider": "groq",
        },
    }


def ask_groq_for_rag(
    question: str,
    retrieved_chunks: list[dict],
    history: list[dict] | None = None,
) -> dict:
    context_parts = []

    for i, chunk in enumerate(retrieved_chunks):
        source = (
            f"[Source: {chunk.get('file_name', 'unknown')}, "
            f"page {chunk.get('page_start', '?')}]"
        )

        context_parts.append(
            f"--- Chunk {i + 1} {source} ---\n{chunk.get('text', '')}"
        )

    context = "\n\n".join(context_parts)

    system_prompt = (
        "You are answering using the provided document context.\n\n"
        "Rules:\n"
        "1. Use the current chat history only to understand follow-up references.\n"
        "2. Use the document chunks as the factual source for document questions.\n"
        "3. Do not invent document facts.\n"
        "4. If the answer is not present in the chunks, say exactly:\n"
        '   "No related information was found in the uploaded document."\n'
        "5. Cite file name and page number when using document chunks.\n"
        "6. Keep the answer clear and professional."
    )

    user_prompt = f"""
Document context:
{context}

Current user question:
{question}
"""

    return ask_groq_strong(user_prompt, system_prompt, history=history)