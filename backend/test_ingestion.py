from app.database import get_db_connection
from app.services.ingestion_service import process_document

connection = get_db_connection()

try:
    with connection.cursor() as cursor:
        cursor.execute("""
            SELECT id, filename
            FROM documents
            WHERE status IN ('uploaded', 'failed')
            ORDER BY created_at DESC
            LIMIT 1
        """)
        document = cursor.fetchone()
finally:
    connection.close()

if document is None:
    raise RuntimeError("No document available for ingestion")

document_id, filename = document

print(f"Processing document: {filename}")
print(f"Document ID: {document_id}")

result = process_document(str(document_id))

print("\nINGESTION RESULT")
print(result)