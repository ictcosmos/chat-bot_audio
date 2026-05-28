import os
import fitz
import pypdf
import docx
import pandas as pd
from pathlib import Path


def parse_pdf_pymupdf(file_path: str) -> list[dict]:
    pages = []
    doc = fitz.open(file_path)
    for page_num in range(len(doc)):
        page = doc[page_num]
        text = page.get_text()
        pages.append({
            "page_number": page_num + 1,
            "text": text.strip(),
            "tables": [],
            "headings": [],
        })
    doc.close()
    return pages


def parse_pdf_pypdf(file_path: str) -> list[dict]:
    pages = []
    reader = pypdf.PdfReader(file_path)
    for page_num in range(len(reader.pages)):
        page = reader.pages[page_num]
        text = page.extract_text()
        pages.append({
            "page_number": page_num + 1,
            "text": text.strip(),
            "tables": [],
            "headings": [],
        })
    return pages


def parse_docx(file_path: str) -> list[dict]:
    pages = []
    doc = docx.Document(file_path)
    full_text = []
    for para in doc.paragraphs:
        full_text.append(para.text)
    text = "\n".join(full_text)

    page_size = 2000
    for i in range(0, len(text), page_size):
        chunk = text[i:i + page_size]
        pages.append({
            "page_number": (i // page_size) + 1,
            "text": chunk.strip(),
            "tables": [],
            "headings": [],
        })
    if not pages:
        pages.append({
            "page_number": 1,
            "text": "",
            "tables": [],
            "headings": [],
        })
    return pages


def parse_txt(file_path: str) -> list[dict]:
    with open(file_path, "r", encoding="utf-8", errors="replace") as f:
        text = f.read()
    page_size = 2000
    pages = []
    for i in range(0, len(text), page_size):
        chunk = text[i:i + page_size]
        pages.append({
            "page_number": (i // page_size) + 1,
            "text": chunk.strip(),
            "tables": [],
            "headings": [],
        })
    if not pages:
        pages.append({
            "page_number": 1,
            "text": "",
            "tables": [],
            "headings": [],
        })
    return pages


def parse_csv(file_path: str) -> list[dict]:
    df = pd.read_csv(file_path)
    text = df.to_string()
    return [{
        "page_number": 1,
        "text": text,
        "tables": [],
        "headings": list(df.columns),
    }]


def parse_xlsx(file_path: str) -> list[dict]:
    df = pd.read_excel(file_path, sheet_name=None)
    pages = []
    for sheet_name, sheet_df in df.items():
        text = sheet_df.to_string()
        pages.append({
            "page_number": len(pages) + 1,
            "text": text,
            "tables": [],
            "headings": [sheet_name],
        })
    return pages


def parse_document(file_path: str, file_name: str, file_id: str) -> dict:
    ext = Path(file_name).suffix.lower()

    if ext == ".pdf":
        try:
            pages = parse_pdf_pymupdf(file_path)
        except Exception:
            pages = parse_pdf_pypdf(file_path)
    elif ext == ".docx":
        pages = parse_docx(file_path)
    elif ext in (".txt", ".md"):
        pages = parse_txt(file_path)
    elif ext == ".csv":
        pages = parse_csv(file_path)
    elif ext == ".xlsx":
        pages = parse_xlsx(file_path)
    else:
        raise ValueError(f"Unsupported file type: {ext}")

    return {
        "file_id": file_id,
        "file_name": file_name,
        "pages": pages,
    }
