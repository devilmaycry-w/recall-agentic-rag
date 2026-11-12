# Recall Knowledge Console

# RECALL AI KNOWLEDGE ASSISTANT

## 1. Project Overview

Build a complete, polished, frontend-only web application named **RECALL**.

RECALL is an Agentic RAG (Retrieval-Augmented Generation) Knowledge Assistant with Self-Correction. It allows users to upload PDF documents, retrieve relevant information, ask questions, inspect agent routing decisions, and view answer verification results.

This is an academic MCA project focused on demonstrating a locally implemented AI backend architecture.

The frontend must be designed to connect to an already-developed FastAPI backend. Do not rebuild the backend or introduce a new backend architecture.

## 2. Visual Design Direction

Use a carefully blended design system combining:

- Terminal Brutalism
- Developer Brutalism
- Retro CLI / Hacker Aesthetic
- SaaS Cyberpunk
- Neo-Brutalism (Digital Wireframe)

The interface should look like a sophisticated AI developer console, not a generic chatbot or conventional SaaS dashboard.

### Visual characteristics

- Dark charcoal / almost-black background
- Acid green as the primary accent
- Electric cyan as a secondary accent
- Occasional amber and red for warnings and errors
- Sharp rectangular panels
- Hard borders
- Minimal rounded corners
- High contrast typography
- Monospaced typography for technical content
- Subtle grid backgrounds
- Terminal-inspired section headers
- Small uppercase labels
- Technical metadata
- Thin wireframe borders
- Brutalist buttons
- Subtle scanline effects
- Minimal glitch effects, used sparingly
- Compact but readable information density

### Color palette

Use CSS variables:

- Background: #080B0A
- Surface: #101513
- Elevated Surface: #171D19
- Primary Acid Green: #B6FF00
- Secondary Neon Green: #39FF14
- Electric Cyan: #00E5FF
- Text Primary: #E8F0E8
- Text Secondary: #8B998E
- Border: #2C3930
- Warning: #FFB000
- Error: #FF4D4D

### Typography

Use:
- Space Grotesk for prominent headings
- JetBrains Mono for terminal text, metadata, labels, logs, and code
- Inter for body text where needed

Use uppercase labels and restrained letter spacing.

### UI reference keywords

Developer workstation, terminal dashboard, hacker console, AI agent operations interface, cyberpunk SaaS, brutalist web design, retro command-line environment, technical wireframe dashboard.

Avoid excessive visual noise. The application must remain readable and functional.

## 3. Application Architecture

Frontend:
- React
- TypeScript
- Vite
- Tailwind CSS
- shadcn/ui only where useful
- Lucide icons

Create a modular, maintainable frontend with reusable components.

Backend integration will be configured later.

Use a centralized API client file:

`src/lib/api.ts`

Create a centralized API configuration:

`src/lib/config.ts`

Default API base URL:

`http://localhost:8000`

IMPORTANT:
- Do not create a Supabase backend.
- Do not create Firebase integration.
- Do not introduce Prisma.
- Do not introduce a new database.
- Do not create cloud authentication.
- Do not use Lovable Cloud for backend functionality.
- Do not create mock backend APIs.
- Do not change or recreate the existing Python backend.
- Do not use OpenAI API directly from the frontend.
- Do not expose API keys or secrets in frontend code.

For the initial UI, use clearly isolated mock data only for presentation and development. Make it easy to switch to the real FastAPI backend by changing the centralized API client.

## 4. Existing FastAPI Backend

The application will eventually connect to these existing endpoints:

### Health
GET `/health`

Example:
{
  "status": "healthy",
  "service": "Recall Backend"
}

### Database Health
GET `/db-health`

Example:
{
  "status": "connected",
  "database": "recall_local"
}

### Upload PDF
POST `/documents/upload`

Multipart form-data:
- file: PDF file

### Search Documents
POST `/documents/search`

JSON:
{
  "question": "What skills are mentioned in the resume?",
  "top_k": 5
}

### RAG Question Answering
POST `/documents/ask`

JSON:
{
  "question": "What skills are mentioned in the resume?",
  "top_k": 5
}

### Intent Routing
POST `/documents/route`

JSON:
{
  "question": "How many documents are stored?"
}

### Full Agent Orchestration
POST `/documents/agent`

JSON:
{
  "question": "What skills are mentioned in the resume?",
  "top_k": 5
}

Use `/documents/agent` as the primary assistant endpoint.

The frontend should be architected to support these exact endpoint paths and request fields.

Do not assume response structures that have not yet been verified. Keep response mapping isolated in the API client.

## 5. Main Application Layout

Create a persistent dark sidebar and a main content area.

### Sidebar

Logo:

`[ R ] RECALL`

Subtitle:

`LOCAL AI KNOWLEDGE SYSTEM`

Navigation:

- OVERVIEW
- AI ASSISTANT
- KNOWLEDGE BASE
- DOCUMENT SEARCH
- AGENT TRACE
- SYSTEM HEALTH
- SETTINGS

Sidebar bottom:

- Backend status indicator
- Database status indicator
- `LOCAL MODE`
- Version: `v1.0.0`

Use technical icons and clear active navigation indicators.

### Top Header

Show:
- Current page title
- Breadcrumbs
- Local system status
- Backend connection status
- Current date/time display
- Compact user avatar placeholder or system icon

Do not add unnecessary authentication or account features.

## 6. Dashboard — Overview

Create an impressive technical dashboard.

Header:

`SYSTEM OVERVIEW`

Subtitle:

`RECALL // AGENTIC KNOWLEDGE INTELLIGENCE`

Display KPI panels:

- Total Documents
- Processed Documents
- Failed Documents
- Vector Database Status
- Backend Status
- Last Query Latency

Use brutalist bordered cards.

Add a system architecture visualization:

PDF INGESTION
→ TEXT EXTRACTION
→ CHUNKING
→ EMBEDDING GENERATION
→ PGVECTOR STORAGE
→ AGENT ROUTER
→ RETRIEVAL / SQL / CLARIFICATION
→ LLM RESPONSE
→ SELF-CORRECTION

Use a wireframe-style diagram with neon lines.

Add a recent activity terminal panel with sample events, clearly labeled as demo data until connected.

## 7. AI Assistant Page

This is the primary feature.

Create a modern AI chat interface inspired by developer terminals and cyberpunk command consoles.

### Layout

- Conversation area
- Input composer at bottom
- Optional collapsible agent trace panel
- Source citation panel
- Route indicator
- Answer verification indicator

### Chat composer

Placeholder:

`Enter a query into the Recall knowledge system...`

Include:
- Multiline input
- Send button
- Stop generation button when loading
- Enter to send
- Shift + Enter for newline
- Clear conversation
- Top-K selector with values 3, 5, 10
- Query examples

Example queries:

- What skills are listed in my resume?
- Summarize the uploaded document.
- How many documents are stored in the database?
- Which documents have failed processing?
- I need more context. Can you clarify?

### Assistant response

Each response should include:

- Answer content
- Route classification
- Latency metadata
- Verification status
- Source documents
- Page numbers
- Expandable agent execution trace

Route badges:

- DOCUMENT SEARCH
- SQL QUERY
- CLARIFICATION
- GENERAL

Verification badges:

- SUPPORTED
- CORRECTED
- ABSTAINED
- NOT EVALUATED

Use acid green for supported responses, amber for corrected responses, and muted red for abstained responses.

Do not fabricate citations or claim that a response is grounded when the backend does not provide verification data.

## 8. Knowledge Base Page

Create a document management interface.

### PDF Upload Panel

- Drag-and-drop upload area
- Select PDF button
- File size display
- Upload progress bar
- Upload success and error feedback
- Support PDF files only
- Maximum upload size: 20 MB

Display:

`DROP DOCUMENTS INTO THE KNOWLEDGE CORE`

### Document Table

Columns:

- Filename
- Document ID
- Processing Status
- File Type
- Actions

Statuses:
- UPLOADED
- PROCESSING
- PROCESSED
- FAILED

Provide:
- Search documents
- Filter by status
- Refresh
- Empty state
- Error state

Do not pretend to list database documents if the current backend has no list-documents endpoint. Clearly indicate that this data source is not connected.

## 9. Document Search Page

Create a dedicated semantic retrieval interface.

Input:

`Search the vector knowledge base...`

Controls:
- Top-K selector
- Search button

Display retrieved chunks in technical cards.

Each result card should contain:
- Filename
- Page number
- Chunk index
- Similarity or distance score, only if returned by the backend
- Retrieved text snippet

Include a terminal-like retrieval summary.

## 10. Agent Trace Page

Create a technical execution monitoring page.

Show an execution timeline:

1. User Query Received
2. Intent Classification
3. Route Selection
4. Document Retrieval or SQL Execution
5. Answer Generation
6. Self-Correction Evaluation
7. Final Response

Each step should show:
- Status
- Duration, if provided
- Technical details
- Expandable metadata

Routes:
- DOCUMENT_SEARCH
- SQL_QUERY
- CLARIFICATION
- GENERAL

Use a wireframe flow diagram.

Important:
Only show real backend trace data when available. Clearly label sample traces as demo data.

## 11. System Health Page

Create a local system diagnostic dashboard.

Show:
- FastAPI backend connection
- PostgreSQL connection
- pgvector availability
- API response latency
- Local API base URL

Use:
- Connected
- Disconnected
- Unknown

Allow manual refresh.

Use the existing `/health` and `/db-health` endpoints.

Do not claim that pgvector or the embedding service is healthy unless verified through a backend response.

## 12. Settings Page

Create a technical configuration screen.

Settings:
- API Base URL: `http://localhost:8000`
- Connection test
- API request timeout
- Top-K default
- Demo mode / Backend mode toggle
- UI theme configuration

Use local browser storage for UI preferences only.

Do not store API secrets.

## 13. UX and Interaction Requirements

Every visible interactive element must function.

Implement:
- Sidebar navigation
- Responsive layout
- Working chat composer
- Loading states
- Empty states
- Error states
- Toast notifications
- File drag-and-drop
- Search and filters
- Collapsible trace sections
- Status indicators
- Connection testing
- Settings persistence

Avoid buttons that do nothing.

Do not create fake real-time system activity. Demo activity must be clearly labeled.

## 14. Responsive Design

Desktop:
- Persistent sidebar
- Wide technical dashboard
- Multi-column panels

Tablet:
- Collapsible sidebar
- Responsive grid

Mobile:
- Compact navigation
- Single-column panels
- Mobile-friendly chat composer

Keep the dark terminal aesthetic consistent across all screen sizes.

## 15. Quality Requirements

The final result should look like a high-end developer tool built by a professional product design team.

Avoid:
- Generic AI SaaS design
- Excessive rounded cards
- White backgrounds
- Purple gradient backgrounds
- Huge empty hero sections
- Excessive glowing effects
- Excessive animation
- Unnecessary authentication
- Fake backend integrations
- Fake source citations
- Placeholder buttons without functionality

Prioritize:
- Strong visual hierarchy
- Functional UI
- Technical credibility
- Clean component architecture
- Readability
- Accurate API integration structure

## 16. Final Goal

Generate a complete frontend for RECALL that visually represents a locally implemented Agentic RAG Knowledge Assistant.

The interface must be ready for integration with the existing FastAPI backend at:

`http://localhost:8000`

The backend is already implemented. The task is frontend development only.

Make the application visually distinctive using Terminal Brutalism, Developer Brutalism, Retro CLI, SaaS Cyberpunk, and Neo-Brutalist wireframe design.

Build the application now.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/48319374-f340-4ab4-bf2d-2d475d6c0611).

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
