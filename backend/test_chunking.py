
from app.services.chunking_service import chunk_text, chunk_pages

# Test 1: Basic text chunking
sample_text = " ".join(
    [f"word{i}" for i in range(1000)]
)

chunks = chunk_text(sample_text)

print("TEST 1: Basic Chunking")
print("Total chunks:", len(chunks))

for index, chunk in enumerate(chunks):
    print(
        f"Chunk {index}: "
        f"{len(chunk.split())} words"
    )


# Test 2: PDF page chunking
sample_pages = [
    {
        "page_number": 1,
        "text": " ".join([f"page1word{i}" for i in range(500)])
    },
    {
        "page_number": 2,
        "text": " ".join([f"page2word{i}" for i in range(300)])
    }
]

page_chunks = chunk_pages(sample_pages)

print("\nTEST 2: PDF Page Chunking")
print("Total chunks:", len(page_chunks))

for chunk in page_chunks:
    print(
        f"Index: {chunk['chunk_index']} | "
        f"Page: {chunk['page_number']} | "
        f"Words: {chunk['token_count']}"
    )
