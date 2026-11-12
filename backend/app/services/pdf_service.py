
from pathlib import Path
from pypdf import PdfReader


def extract_pdf_text(file_path: str) -> dict:
    """
    Extract text from a PDF file.
    Returns extracted text and page count.
    """

    path = Path(file_path)

    if not path.exists():
        raise FileNotFoundError("PDF file not found")

    reader = PdfReader(str(path))

    pages = []

    for page_number, page in enumerate(reader.pages, start=1):
        text = page.extract_text() or ""

        if text.strip():
            pages.append({
                "page_number": page_number,
                "text": text.strip()
            })

    return {
        "total_pages": len(reader.pages),
        "extracted_pages": len(pages),
        "pages": pages
    }
