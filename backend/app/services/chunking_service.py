
def chunk_text(
    text: str,
    chunk_size: int = 400,
    overlap: int = 50
) -> list[str]:
    """
    Split text into overlapping word-based chunks.
    """

    if not text or not text.strip():
        return []

    if chunk_size <= 0:
        raise ValueError("chunk_size must be greater than zero")

    if overlap < 0 or overlap >= chunk_size:
        raise ValueError("overlap must be between 0 and chunk_size")

    words = text.split()
    chunks = []

    start = 0

    while start < len(words):
        end = start + chunk_size

        chunk_words = words[start:end]
        chunks.append(" ".join(chunk_words))

        if end >= len(words):
            break

        start = end - overlap

    return chunks


def chunk_pages(
    pages: list[dict],
    chunk_size: int = 400,
    overlap: int = 50
) -> list[dict]:
    """
    Split PDF pages into chunks while preserving page numbers.
    """

    all_chunks = []
    chunk_index = 0

    for page in pages:
        page_number = page["page_number"]
        text = page["text"]

        page_chunks = chunk_text(
            text,
            chunk_size=chunk_size,
            overlap=overlap
        )

        for chunk in page_chunks:
            all_chunks.append({
                "chunk_index": chunk_index,
                "page_number": page_number,
                "content": chunk,
                "token_count": len(chunk.split())
            })

            chunk_index += 1

    return all_chunks
