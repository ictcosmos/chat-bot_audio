import re


def chunk_document(
    parsed: dict,
    chunk_size: int = 1000,
    chunk_overlap: int = 150,
) -> list[dict]:
    chunks = []
    file_id = parsed.get("file_id", "")
    file_name = parsed.get("file_name", "")
    pages = parsed.get("pages", [])

    for page in pages:
        page_num = page.get("page_number", 1)
        text = page.get("text", "")

        if not text.strip():
            continue

        sentences = split_into_sentences(text)
        current_chunk = []
        current_size = 0

        for sentence in sentences:
            sentence_len = len(sentence.split())

            if current_size + sentence_len > chunk_size and current_chunk:
                chunk_text = " ".join(current_chunk)
                sections = extract_sections(chunk_text)
                chunks.append({
                    "chunk_id": f"chunk_{len(chunks) + 1:04d}",
                    "file_id": file_id,
                    "file_name": file_name,
                    "page_start": page_num,
                    "page_end": page_num,
                    "section": sections,
                    "text": chunk_text,
                })
                overlap_sentences = current_chunk[-max(1, chunk_overlap // 10):]
                current_chunk = overlap_sentences
                current_size = sum(len(s.split()) for s in current_chunk)

            current_chunk.append(sentence)
            current_size += sentence_len

        if current_chunk:
            chunk_text = " ".join(current_chunk)
            sections = extract_sections(chunk_text)
            chunks.append({
                "chunk_id": f"chunk_{len(chunks) + 1:04d}",
                "file_id": file_id,
                "file_name": file_name,
                "page_start": page_num,
                "page_end": page_num,
                "section": sections,
                "text": chunk_text,
            })

    return chunks


def split_into_sentences(text: str) -> list[str]:
    text = re.sub(r"\s+", " ", text).strip()
    sentences = re.split(r"(?<=[.?!])\s+", text)
    return [s.strip() for s in sentences if s.strip()]


def extract_sections(text: str) -> str:
    lines = text.split("\n")
    for line in lines:
        stripped = line.strip()
        if stripped and (
            stripped.isupper()
            or re.match(r"^(#{1,3}\s|(Introduction|Methodology|Results|Discussion|Conclusion|Abstract|References|Appendix))", stripped, re.IGNORECASE)
        ):
            return stripped
    return ""
