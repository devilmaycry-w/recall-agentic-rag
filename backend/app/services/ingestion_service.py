
from app.database import get_db_connection
from app.services.pdf_service import extract_pdf_text
from app.services.chunking_service import chunk_pages
from app.services.embedding_service import generate_embedding


def process_document(document_id: str) -> dict:
    """
    Complete document ingestion:
    PDF extraction -> Chunking -> Embeddings -> PostgreSQL storage.
    """

    # 1. Fetch document information and update status
    connection = get_db_connection()

    try:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT filename, file_path
                FROM documents
                WHERE id = %s
                """,
                (document_id,)
            )

            document = cursor.fetchone()

            if document is None:
                raise ValueError("Document not found")

            filename, file_path = document

            cursor.execute(
                """
                UPDATE documents
                SET status = 'processing'
                WHERE id = %s
                """,
                (document_id,)
            )

        connection.commit()

    finally:
        connection.close()

    try:
        # 2. Extract text from PDF
        extraction = extract_pdf_text(file_path)

        pages = extraction["pages"]

        if not pages:
            raise ValueError("No readable text found in PDF")

        # 3. Split extracted text into chunks
        chunks = chunk_pages(
            pages,
            chunk_size=400,
            overlap=50
        )

        if not chunks:
            raise ValueError("No text chunks were generated")

        print(f"Extracted {len(pages)} pages")
        print(f"Generated {len(chunks)} chunks")

        # 4. Generate embeddings using Jina AI
        processed_chunks = []

        for index, chunk in enumerate(chunks, start=1):
            print(
                f"Generating embedding {index}/{len(chunks)}...",
                flush=True
            )

            embedding = generate_embedding(chunk["content"])

            processed_chunks.append({
                **chunk,
                "embedding": embedding
            })

        print("All embeddings generated successfully!")

        # 5. Store chunks and embeddings in PostgreSQL
        connection = get_db_connection()

        try:
            with connection.cursor() as cursor:

                # Remove previous chunks if reprocessing
                cursor.execute(
                    """
                    DELETE FROM document_chunks
                    WHERE document_id = %s
                    """,
                    (document_id,)
                )

                for chunk in processed_chunks:

                    # Convert embedding list to pgvector format
                    embedding_string = (
                        "[" +
                        ",".join(str(value) for value in chunk["embedding"]) +
                        "]"
                    )

                    cursor.execute(
                        """
                        INSERT INTO document_chunks
                        (
                            document_id,
                            chunk_index,
                            content,
                            page_number,
                            token_count,
                            embedding
                        )
                        VALUES (%s, %s, %s, %s, %s, %s::vector)
                        """,
                        (
                            document_id,
                            chunk["chunk_index"],
                            chunk["content"],
                            chunk["page_number"],
                            chunk["token_count"],
                            embedding_string
                        )
                    )

                # 6. Mark document as processed
                cursor.execute(
                    """
                    UPDATE documents
                    SET status = 'processed'
                    WHERE id = %s
                    """,
                    (document_id,)
                )

            connection.commit()

        finally:
            connection.close()

        return {
            "document_id": document_id,
            "filename": filename,
            "total_pages": extraction["total_pages"],
            "total_chunks": len(processed_chunks),
            "status": "processed"
        }

    except Exception:
        # Mark document as failed if any processing step fails
        connection = get_db_connection()

        try:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    UPDATE documents
                    SET status = 'failed'
                    WHERE id = %s
                    """,
                    (document_id,)
                )

            connection.commit()

        finally:
            connection.close()

        raise
