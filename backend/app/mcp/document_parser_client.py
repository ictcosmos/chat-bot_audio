import os
from app.rag.parser import parse_document


class DocumentParserClient:
    @staticmethod
    def parse(file_path: str, file_name: str, file_id: str) -> dict:
        return parse_document(file_path, file_name, file_id)
