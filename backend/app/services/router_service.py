
import json
from app.services.llm_service import generate_answer


VALID_ROUTES = {
    "DOCUMENT_SEARCH",
    "SQL_QUERY",
    "CLARIFICATION",
    "GENERAL"
}


def route_question(question: str) -> dict:
    if not question or not question.strip():
        raise ValueError("Question cannot be empty")

    prompt = f"""
You are the query router for Recall, an Agentic RAG Knowledge Assistant.

Classify the user's question into exactly one category:

DOCUMENT_SEARCH:
Questions that need information from uploaded documents.

SQL_QUERY:
Questions that require structured database records, filtering,
aggregation, counts, or database operations.

CLARIFICATION:
Questions that are ambiguous or lack necessary details.

GENERAL:
Simple greetings or general conversational questions that do not
require uploaded documents or database records.

Return ONLY valid JSON in this format:
{{
    "route": "DOCUMENT_SEARCH",
    "reason": "The question asks about uploaded document content."
}}

Allowed route values:
DOCUMENT_SEARCH, SQL_QUERY, CLARIFICATION, GENERAL

User question:
{question}
"""

    response = generate_answer(prompt)

    try:
        # Extract JSON in case the model adds surrounding text
        start = response.find("{")
        end = response.rfind("}") + 1

        if start == -1 or end == 0:
            raise ValueError("No JSON object found")

        result = json.loads(response[start:end])

        route = result.get("route", "").upper()
        reason = result.get("reason", "")

        if route not in VALID_ROUTES:
            raise ValueError("Invalid route returned by model")

        return {
            "route": route,
            "reason": reason
        }

    except (json.JSONDecodeError, ValueError, TypeError):
        return {
            "route": "DOCUMENT_SEARCH",
            "reason": "Fallback routing due to invalid classifier output."
        }
