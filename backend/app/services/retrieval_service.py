from app.database import get_db_connection
from app.services.embedding_service import generate_embedding


# Initial cutoff; we will calibrate this through testing.
DEFAULT_DISTANCE_THRESHOLD = 0.45


def retrieve_relevant_chunks(
    question: str,
    top_k: int = 5,
    distance_threshold: float = DEFAULT_DISTANCE_THRESHOLD
) -> list[dict]:

    if not question or not question.strip():
        raise ValueError("Question cannot be empty")

    if top_k < 1 or top_k > 20:
        raise ValueError("top_k must be between 1 and 20")

    if not 0 <= distance_threshold <= 2:
        raise ValueError("distance_threshold must be between 0 and 2")

    # Generate embedding for the user's question
    query_embedding = generate_embedding(
        question,
        task_type="RETRIEVAL_QUERY"
    )

    embedding_string = (
        "[" + ",".join(str(value) for value in query_embedding) + "]"
    )

    connection = get_db_connection()

    try:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT
                    d.filename,
                    c.content,
                    c.page_number,
                    c.chunk_index,
                    c.embedding <=> %s::vector AS distance
                FROM document_chunks c
                JOIN documents d ON d.id = c.document_id
                WHERE
                    d.status = 'processed'
                    AND c.embedding <=> %s::vector <= %s
                ORDER BY c.embedding <=> %s::vector
                LIMIT %s
                """,
                (
                    embedding_string,
                    embedding_string,
                    distance_threshold,
                    embedding_string,
                    top_k
                )
            )

            rows = cursor.fetchall()

            return [
                {
                    "filename": row[0],
                    "content": row[1],
                    "page_number": row[2],
                    "chunk_index": row[3],
                    "distance": float(row[4])
                }
                for row in rows
            ]

    finally:
        connection.close()