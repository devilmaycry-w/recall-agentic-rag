
import os
import httpx
from dotenv import load_dotenv

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

GEMINI_API_URL = (
    "https://generativelanguage.googleapis.com/"
    "v1beta/models/gemini-embedding-001:embedContent"
)

EMBEDDING_DIMENSIONS = 768


def generate_embedding(
    text: str,
    task_type: str = "RETRIEVAL_DOCUMENT"
) -> list[float]:

    if not text or not text.strip():
        raise ValueError("Text cannot be empty")

    if not GEMINI_API_KEY:
        raise RuntimeError("GEMINI_API_KEY is missing from .env")

    allowed_tasks = {
        "RETRIEVAL_DOCUMENT",
        "RETRIEVAL_QUERY"
    }

    if task_type not in allowed_tasks:
        raise ValueError("Invalid embedding task type")

    payload = {
        "model": "models/gemini-embedding-001",
        "content": {
            "parts": [{"text": text}]
        },
        "taskType": task_type,
        "outputDimensionality": EMBEDDING_DIMENSIONS
    }

    headers = {
        "x-goog-api-key": GEMINI_API_KEY,
        "Content-Type": "application/json"
    }

    try:
        response = httpx.post(
            GEMINI_API_URL,
            json=payload,
            headers=headers,
            timeout=60.0
        )

        response.raise_for_status()

        result = response.json()
        embedding = result["embedding"]["values"]

        if len(embedding) != EMBEDDING_DIMENSIONS:
            raise ValueError(
                f"Expected {EMBEDDING_DIMENSIONS} dimensions, "
                f"received {len(embedding)}"
            )

        return embedding

    except httpx.HTTPStatusError as error:
        raise RuntimeError(
            f"Gemini API error ({error.response.status_code}): "
            f"{error.response.text}"
        ) from error

    except (httpx.RequestError, KeyError, IndexError) as error:
        raise RuntimeError(
            f"Embedding generation failed: {error}"
        ) from error
