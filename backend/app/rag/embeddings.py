import numpy as np

from app.config import GEMINI_API_KEY

_gemini_available = bool(GEMINI_API_KEY)
_sentence_model = None


def get_sentence_model():
    global _sentence_model
    if _sentence_model is None:
        from sentence_transformers import SentenceTransformer
        _sentence_model = SentenceTransformer("all-MiniLM-L6-v2")
    return _sentence_model


def embed_texts(texts: list[str]) -> list[list[float]]:
    if _gemini_available:
        try:
            from app.services.gemini_service import embed_with_gemini
            embeddings = []
            for text in texts:
                emb = embed_with_gemini(text)
                if emb:
                    embeddings.append(emb)
                else:
                    raise ValueError("Empty embedding from Gemini")
            return embeddings
        except Exception:
            pass

    model = get_sentence_model()
    embeddings = model.encode(texts, show_progress_bar=False)
    return embeddings.tolist()


def embed_text(text: str) -> list[float]:
    return embed_texts([text])[0]
