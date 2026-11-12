
from app.database import get_db_connection


def execute_safe_query(question: str) -> dict:
    if not question or not question.strip():
        raise ValueError("Question cannot be empty")

    normalized_question = question.lower().strip()
    connection = get_db_connection()

    try:
        with connection.cursor() as cursor:

            # Count all uploaded documents
            if (
                "how many documents" in normalized_question
                or "document count" in normalized_question
                or "total documents" in normalized_question
            ):
                cursor.execute(
                    "SELECT COUNT(*) FROM documents"
                )

                count = cursor.fetchone()[0]

                return {
                    "answer": f"There are {count} documents uploaded.",
                    "data": {"document_count": count}
                }

            # Count processed documents
            elif (
                "how many processed" in normalized_question
                or "processed documents" in normalized_question
            ):
                cursor.execute(
                    """
                    SELECT COUNT(*)
                    FROM documents
                    WHERE status = %s
                    """,
                    ("processed",)
                )

                count = cursor.fetchone()[0]

                return {
                    "answer": f"There are {count} processed documents.",
                    "data": {"processed_count": count}
                }

            # Count failed documents
            elif (
                "how many failed" in normalized_question
                or "failed documents" in normalized_question
            ):
                cursor.execute(
                    """
                    SELECT COUNT(*)
                    FROM documents
                    WHERE status = %s
                    """,
                    ("failed",)
                )

                count = cursor.fetchone()[0]

                return {
                    "answer": f"There are {count} failed documents.",
                    "data": {"failed_count": count}
                }

            # List uploaded document filenames
            elif (
                "list documents" in normalized_question
                or "document filenames" in normalized_question
                or "uploaded documents" in normalized_question
            ):
                cursor.execute(
                    """
                    SELECT filename, status, created_at
                    FROM documents
                    ORDER BY created_at DESC
                    """
                )

                rows = cursor.fetchall()

                documents = [
                    {
                        "filename": row[0],
                        "status": row[1],
                        "created_at": row[2].isoformat()
                        if row[2] else None
                    }
                    for row in rows
                ]

                return {
                    "answer": f"Found {len(documents)} uploaded documents.",
                    "data": {"documents": documents}
                }

            else:
                return {
                    "answer": (
                        "I can currently answer document count, "
                        "processed document count, failed document count, "
                        "and document listing questions."
                    ),
                    "data": {}
                }

    finally:
        connection.close()
