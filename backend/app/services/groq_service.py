from groq import Groq

from app.config import GROQ_API_KEY, GROQ_MODEL_FAST, GROQ_MODEL_STRONG

client = Groq(api_key=GROQ_API_KEY)


def ask_groq_fast(
    prompt: str,
    system_prompt: str = "You are a helpful AI assistant."
) -> dict:
    completion = client.chat.completions.create(
        model=GROQ_MODEL_FAST,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": prompt}
        ],
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
        }
    }


def ask_groq_strong(
    prompt: str,
    system_prompt: str = "You are a helpful AI assistant."
) -> dict:
    completion = client.chat.completions.create(
        model=GROQ_MODEL_STRONG,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": prompt}
        ],
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
        }
    }


def ask_groq_for_rag(question: str, retrieved_chunks: list[dict]) -> dict:
    context_parts = []
    for i, chunk in enumerate(retrieved_chunks):
        source = f"[Source: {chunk.get('file_name', 'unknown')}, page {chunk.get('page_start', '?')}]"
        context_parts.append(f"--- Chunk {i+1} {source} ---\n{chunk.get('text', '')}")

    context = "\n\n".join(context_parts)

    system_prompt = (
        "You are answering using only the provided document context.\n\n"
        "Rules:\n"
        "1. Use only the provided document chunks.\n"
        "2. Do not use outside knowledge.\n"
        "3. If the answer is not present in the chunks, say exactly:\n"
        '   "No related information was found in the uploaded document."\n'
        "4. Cite file name and page number.\n"
        "5. Do not guess.\n"
        "6. Keep the answer clear and professional."
    )

    user_prompt = f"Document context:\n{context}\n\nUser question:\n{question}"

    return ask_groq_strong(user_prompt, system_prompt)
