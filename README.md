# Lantern Knowledge Compass

Build a multi-tenant B2B SaaS platform for an Agentic RAG Knowledge Assistant with Self-Correction.

Key Features & Views:
1. Multi-Tenant Workspace & Role-Based Access:
   - Organization switcher with roles (Admin, Knowledge Manager, Member).
   - Tenant isolation indicators and audit logging.

2. Document Management & Ingestion:
   - Document upload (PDF, TXT, Markdown) with drag-and-drop.
   - Parsing, chunking, and embedding status tracker (Pending, Processing, Indexed, Failed).
   - Document chunk inspector showing token counts and chunk preview.

3. Agentic RAG Chat Interface:
   - Interactive conversational assistant querying organizational knowledge.
   - Routing indicator tag (Document Retrieval vs Read-Only SQL vs Clarification).
   - Source citations with interactive expandable drawers (document name, page number, confidence, exact text snippet).
   - Self-Correction & Verification status badges for each message (e.g., 'Grounded', 'Corrected (Retry 1/2)', 'Abstained - Insufficient Evidence').
   - Reasoning trace viewer showing agent steps: Query Routing -> Document Retrieval -> Relevance Grading -> Answer Generation -> Groundedness Check.
   - Thumbs up/down feedback and comment collection.

4. Read-Only Structured SQL Query Tool Simulation:
   - Sample tabular schema (e.g., sales, inventory, or student records) queryable by the agent with strict safety guardrails.

5. Admin Analytics & RAG Evaluation Dashboard:
   - Real-time analytics: Total queries, average latency (ms), tool routing breakdown, abstention rate, retry distribution.
   - Benchmark evaluation suite comparing Naive RAG vs Agentic RAG metrics (Faithfulness, Answer Correctness, Context Precision, Hallucination Rate, Cost & Latency).

Ensure a modern, polished enterprise UI with dark/light mode, clear typography, and responsive layouts.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/edb7b233-4530-48e6-adc3-ff1f0299d544).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
