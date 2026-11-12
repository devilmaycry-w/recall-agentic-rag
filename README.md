# RECALL — Agentic RAG Knowledge Assistant

RECALL is a locally implemented **Agentic Retrieval-Augmented Generation (RAG)** knowledge assistant with dynamic intent routing, self-correcting answer verification, and real-time execution observability.

It is built with a **FastAPI + PostgreSQL (`pgvector`)** backend and a terminal-inspired **React + TypeScript** developer console.

---

## Table of Contents

- [Key Features](#key-features)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [API Endpoints](#api-endpoints)

---

## Key Features

- **Agentic Intent Routing** — Classifies each incoming query as `DOCUMENT_SEARCH`, `SQL_QUERY`, `CLARIFICATION`, or `GENERAL` before selecting an execution path.
- **Automated PDF Ingestion Pipeline** — Uploads PDFs, extracts page-level text, splits it into overlapping chunks, generates vector embeddings, and indexes them in PostgreSQL + `pgvector`.
- **Self-Correction & Grounding Evaluation** — Evaluates every generated response against the retrieved source chunks (`SUPPORTED`, `CORRECTED`, or `ABSTAINED`) and performs a grounded retry when unsupported claims are detected.
- **Safe SQL Execution** — Translates database-level questions (e.g., document counts, processing status checks) into read-only SQL queries against PostgreSQL.
- **Real-Time Execution Observability** — Tracks step-by-step latency (ms), routing decisions, source citations, and raw JSON payloads in a live Agent Trace monitor.

---

## Architecture

```text
PDF INGESTION ──▶ TEXT EXTRACTION ──▶ CHUNKING ──▶ EMBEDDINGS ──▶ PGVECTOR STORAGE
                                                                         │
USER QUERY ──▶ AGENT ROUTER ──┬── DOCUMENT_SEARCH ──▶ RETRIEVAL + LLM ───┤
                              ├── SQL_QUERY ────────▶ READ-ONLY SQL ─────┼──▶ SELF-CORRECTION ──▶ RESPONSE + TRACE
                              ├── CLARIFICATION ────▶ FOLLOW-UP PROMPT ──┤
                              └── GENERAL ──────────▶ CONVERSATIONAL LLM ┘
```

### Routing Paths

| Route | Behavior |
| --- | --- |
| `DOCUMENT_SEARCH` | Retrieves relevant chunks via vector similarity, then generates a grounded answer with the LLM. |
| `SQL_QUERY` | Generates and executes a read-only SQL query for database-level questions. |
| `CLARIFICATION` | Returns a follow-up prompt when the query is ambiguous. |
| `GENERAL` | Handles conversational queries directly with the LLM. |

---

## Tech Stack

| Layer | Technologies |
| --- | --- |
| **Backend** | Python, FastAPI, PostgreSQL, `pgvector`, `psycopg` |
| **Frontend** | React, TypeScript, Vite, Tailwind CSS, TanStack Router |
| **UI Aesthetic** | Terminal Brutalism / Developer Operations Console |

---

## Project Structure

```text
├── backend/
│   ├── app/
│   │   ├── main.py                  # FastAPI routes (/health, /db-health, /documents/*)
│   │   ├── database.py              # PostgreSQL connection management
│   │   └── services/
│   │       ├── agent_service.py     # Multi-route orchestrator & latency tracer
│   │       ├── router_service.py    # Query intent classifier
│   │       ├── qa_service.py        # Grounded RAG & self-correction evaluator
│   │       ├── sql_service.py       # Read-only SQL query generator & executor
│   │       ├── ingestion_service.py # End-to-end PDF ingestion pipeline
│   │       ├── retrieval_service.py # pgvector similarity search
│   │       ├── chunking_service.py  # Text chunking logic
│   │       ├── embedding_service.py # Vector embedding generation
│   │       ├── pdf_service.py       # PDF text extraction
│   │       └── llm_service.py       # LLM inference client
│   └── uploads/                     # Local PDF storage (gitignored)
└── frontend/
    └── src/
        ├── lib/
        │   ├── api.ts               # Centralized FastAPI client & response normalizer
        │   ├── config.ts            # Endpoint configuration & local settings
        │   └── health.ts            # Live backend & database health polling
        └── routes/
            ├── index.tsx            # System overview & live KPI metrics
            ├── assistant.tsx        # AI assistant chat console with citations & trace
            ├── knowledge.tsx        # PDF upload & PostgreSQL document index
            ├── search.tsx           # Direct semantic vector search
            ├── trace.tsx            # Route flow diagram & step-by-step execution timeline
            ├── health.tsx           # System & database diagnostics
            └── settings.tsx         # API URL, timeout, Top-K, and mode settings
```

---

## Getting Started

### Prerequisites

- Python 3.10+
- Node.js 18+ (or Bun)
- PostgreSQL with the `pgvector` extension enabled

### 1. Start the Backend (`http://localhost:8000`)

```bash
cd backend
python -m venv .venv

# Windows (PowerShell)
.\.venv\Scripts\Activate.ps1

# macOS / Linux
# source .venv/bin/activate

pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Configure your environment variables in `backend/.env` (database credentials and LLM/embedding API keys).

### 2. Start the Frontend (`http://localhost:8080`)

```bash
cd frontend
npm install
npm run dev
```

Open <http://localhost:8080> in your browser and verify that both **BACKEND CONNECTED** and **DATABASE CONNECTED** appear in the sidebar.

---

## API Endpoints

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/health` | Check FastAPI service health |
| `GET` | `/db-health` | Verify PostgreSQL & `pgvector` connection |
| `GET` | `/documents` | List all uploaded/processed documents |
| `POST` | `/documents/upload` | Upload a PDF and trigger ingestion + embedding |
| `POST` | `/documents/search` | Run semantic vector similarity search (`top_k`) |
| `POST` | `/documents/ask` | Run grounded RAG Q&A with self-correction |
| `POST` | `/documents/route` | Classify query intent (`DOCUMENT_SEARCH`, `SQL_QUERY`, etc.) |
| `POST` | `/documents/agent` | Full agent orchestration with trace & verification |