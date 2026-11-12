import uuid
from pathlib import Path

from fastapi import UploadFile, File, HTTPException
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import get_db_connection
from pydantic import BaseModel, Field
from app.services.retrieval_service import retrieve_relevant_chunks
from app.services.qa_service import ask_question
from pydantic import BaseModel, Field
from app.services.router_service import route_question
from app.services.agent_service import process_query
from app.services.ingestion_service import process_document

app = FastAPI(
    title="Recall API",
    description="Local backend for Recall Agentic RAG",
    version="1.0.0"
)

# Allow requests from the existing React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8080",
        "http://localhost:5173",
        "http://127.0.0.1:8080",
        "http://127.0.0.1:5173",
    ],

    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def home():
    return {
        "message": "Welcome to Recall API",
        "status": "running"
    }


@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "Recall Backend"
    }

@app.get("/db-health")
def database_health():
    try:
        connection = get_db_connection()

        cursor = connection.cursor()
        cursor.execute("SELECT current_database();")

        database_name = cursor.fetchone()[0]

        cursor.close()
        connection.close()

        return {
            "status": "connected",
            "database": database_name
        }

    except Exception as error:
        return {
            "status": "error",
            "message": str(error)
        }


# Local directory for uploaded documents
UPLOAD_DIR = Path(__file__).resolve().parents[1] / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

MAX_FILE_SIZE = 20 * 1024 * 1024  # 20 MB


@app.post("/documents/upload")
def upload_document(file: UploadFile = File(...)):

    if not file.filename:
        raise HTTPException(
            status_code=400,
            detail="Filename is required"
        )

    if Path(file.filename).suffix.lower() != ".pdf":
        raise HTTPException(
            status_code=400,
            detail="Only PDF files are supported"
        )

    document_id = uuid.uuid4()
    safe_filename = f"{document_id}.pdf"
    file_path = UPLOAD_DIR / safe_filename

    file_size = 0

    try:
        with open(file_path, "wb") as uploaded_file:
            while True:
                chunk = file.file.read(1024 * 1024)
                if not chunk:
                    break
                file_size += len(chunk)
                if file_size > MAX_FILE_SIZE:
                    raise HTTPException(
                        status_code=413,
                        detail="File size exceeds 20 MB"
                    )
                uploaded_file.write(chunk)

        connection = get_db_connection()
        try:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    INSERT INTO documents
                    (id, filename, file_path, status)
                    VALUES (%s, %s, %s, %s)
                    """,
                    (
                        document_id,
                        file.filename,
                        str(file_path),
                        "uploaded"
                    )
                )
            connection.commit()
        finally:
            connection.close()

        # Automatically run text extraction, chunking, and pgvector embedding
        ingestion_result = process_document(str(document_id))

        return {
            "message": "Document uploaded and processed successfully",
            "document_id": str(document_id),
            "filename": file.filename,
            "status": "processed",
            "ingestion": ingestion_result,
        }

    except HTTPException:
        file_path.unlink(missing_ok=True)
        raise

    except Exception as error:
        file_path.unlink(missing_ok=True)
        raise HTTPException(
            status_code=500,
            detail=f"Document upload/ingestion failed: {str(error)}"
        )

class SearchRequest(BaseModel):
    question: str = Field(min_length=1)
    top_k: int = Field(default=5, ge=1, le=20)


@app.post("/documents/search")
def search_documents(request: SearchRequest):

    results = retrieve_relevant_chunks(
        question=request.question,
        top_k=request.top_k
    )

    return {
        "question": request.question,
        "total_results": len(results),
        "results": results
    }

class AskRequest(BaseModel):
    question: str = Field(..., min_length=1)
    top_k: int = Field(default=5, ge=1, le=20)

@app.post("/documents/ask")
def ask_documents(request: AskRequest):
    result = ask_question(
        question=request.question,
        top_k=request.top_k
    )

    return result


class RouteRequest(BaseModel):
    question: str = Field(..., min_length=1)

@app.post("/documents/route")
def route_documents(request: RouteRequest):
    result = route_question(request.question)
    return result


class AgentRequest(BaseModel):
    question: str = Field(..., min_length=1)
    top_k: int = Field(default=5, ge=1, le=20)


@app.post("/documents/agent")
def agent_query(request: AgentRequest):
    result = process_query(
        question=request.question,
        top_k=request.top_k
    )

    return result


@app.get("/documents")
def list_documents():
    try:
        connection = get_db_connection()
        try:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT id, filename, status
                    FROM documents
                    ORDER BY id DESC
                    """
                )
                rows = cursor.fetchall()
        finally:
            connection.close()

        documents = [
            {
                "id": str(row[0]),
                "filename": row[1],
                "status": str(row[2]).upper(),
                "file_type": Path(row[1]).suffix.lstrip(".").upper() or "PDF",
            }
            for row in rows
        ]

        return {
            "total": len(documents),
            "documents": documents,
        }
    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to list documents: {str(error)}"
        )