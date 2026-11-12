
import os
import httpx
from dotenv import load_dotenv

load_dotenv()

API_KEY = os.getenv("GEMINI_API_KEY")

URL = (
    "https://generativelanguage.googleapis.com/"
    "v1beta/models/gemini-embedding-001:embedContent"
)

def test_embedding():
    if not API_KEY:
        raise RuntimeError("GEMINI_API_KEY is missing from .env")

    payload = {
        "model": "models/gemini-embedding-001",
        "content": {
            "parts": [
                {"text": "Recall is an Agentic RAG Knowledge Assistant."}
            ]
        },
        "outputDimensionality": 768
    }

    headers = {
        "x-goog-api-key": API_KEY,
        "Content-Type": "application/json"
    }

    response = httpx.post(
        URL,
        json=payload,
        headers=headers,
        timeout=60.0
    )

    response.raise_for_status()

    result = response.json()
    embedding = result["embedding"]["values"]

    print("Gemini embedding generated successfully!")
    print("Dimensions:", len(embedding))
    print("First 5 values:", embedding[:5])

    assert len(embedding) == 768, "Unexpected embedding dimensions"

if __name__ == "__main__":
    test_embedding()
