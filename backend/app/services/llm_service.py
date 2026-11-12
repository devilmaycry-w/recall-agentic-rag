
import os
import httpx
from dotenv import load_dotenv

load_dotenv()

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
LLM_MODEL = os.getenv(
    "LLM_MODEL",
    "nvidia/nemotron-3.5-super-vl:free"
)

OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions"


def generate_answer(prompt: str) -> str:

    if not prompt or not prompt.strip():
        raise ValueError("Prompt cannot be empty")

    if not OPENROUTER_API_KEY:
        raise RuntimeError("OPENROUTER_API_KEY is missing from .env")

    payload = {
        "model": LLM_MODEL,
        "messages": [
            {
                "role": "user",
                "content": prompt
            }
        ],
        "temperature": 0.2,
        "max_tokens": 1024
    }

    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json"
    }

    try:
        response = httpx.post(
            OPENROUTER_API_URL,
            json=payload,
            headers=headers,
            timeout=60.0
        )

        response.raise_for_status()

        result = response.json()
        answer = result["choices"][0]["message"]["content"]

        if not answer:
            raise ValueError("The model returned an empty answer")

        return answer

    except httpx.HTTPStatusError as error:
        raise RuntimeError(
            f"OpenRouter API error ({error.response.status_code}): "
            f"{error.response.text}"
        ) from error

    except (httpx.RequestError, KeyError, IndexError, TypeError) as error:
        raise RuntimeError(
            f"LLM generation failed: {error}"
        ) from error
