// DEMO DATA ONLY — used when Settings → Mode = DEMO. Never shown as backend data.
import type { AgentResult, SearchResult, DocumentRecord } from "./api";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const DEMO_DOCUMENTS: DocumentRecord[] = [
  { id: "demo-001", filename: "resume_2026.pdf", status: "PROCESSED", fileType: "application/pdf" },
  { id: "demo-002", filename: "mca_project_report.pdf", status: "PROCESSED", fileType: "application/pdf" },
  { id: "demo-003", filename: "rag_survey_paper.pdf", status: "PROCESSING", fileType: "application/pdf" },
  { id: "demo-004", filename: "scanned_notes.pdf", status: "FAILED", fileType: "application/pdf" },
];

export const DEMO_ACTIVITY = [
  { t: "00:00:01", level: "INFO", msg: "ingest  resume_2026.pdf → 14 chunks" },
  { t: "00:00:03", level: "INFO", msg: "embed   14 vectors written to pgvector" },
  { t: "00:00:09", level: "WARN", msg: "ingest  scanned_notes.pdf → no extractable text" },
  { t: "00:00:12", level: "INFO", msg: "router  intent=DOCUMENT_SEARCH conf=0.91" },
  { t: "00:00:14", level: "INFO", msg: "verify  verdict=SUPPORTED" },
  { t: "00:00:20", level: "INFO", msg: "router  intent=SQL_QUERY conf=0.88" },
];

export async function demoSearch(question: string, topK: number): Promise<SearchResult[]> {
  await wait(500);
  return [
    { filename: "resume_2026.pdf", page: 1, chunkIndex: 2, score: 0.182, scoreLabel: "distance", text: "Technical Skills: Python, FastAPI, PostgreSQL, pgvector, React, TypeScript, LangChain, Docker." },
    { filename: "resume_2026.pdf", page: 2, chunkIndex: 5, score: 0.241, scoreLabel: "distance", text: "Projects: RECALL — Agentic RAG assistant with self-correction loop and intent routing." },
    { filename: "mca_project_report.pdf", page: 7, chunkIndex: 31, score: 0.317, scoreLabel: "distance", text: `Context matched for query “${question.slice(0, 60)}”: chunking uses 800-token windows with 120 overlap.` },
  ].slice(0, topK);
}

export async function demoAgent(question: string, topK: number): Promise<AgentResult> {
  await wait(900);
  const q = question.toLowerCase();
  if (q.includes("how many") || q.includes("failed")) {
    return {
      answer: q.includes("failed") ? "1 document has failed processing: scanned_notes.pdf." : "There are 4 documents stored in the database.",
      route: "SQL_QUERY", verification: "NOT_EVALUATED", sources: [], latencyMs: 412,
      trace: [
        { name: "User Query Received", status: "done", durationMs: 1 },
        { name: "Intent Classification", status: "done", durationMs: 140, details: "intent=SQL_QUERY" },
        { name: "Route Selection", status: "done", durationMs: 2, details: "→ sql_agent" },
        { name: "SQL Execution", status: "done", durationMs: 38, details: "SELECT count(*) FROM documents" },
        { name: "Answer Generation", status: "done", durationMs: 220 },
        { name: "Self-Correction Evaluation", status: "skipped", details: "not applied to SQL route" },
        { name: "Final Response", status: "done", durationMs: 1 },
      ], raw: { demo: true },
    };
  }
  if (q.includes("clarif") || q.split(/\s+/).length < 3) {
    return {
      answer: "Could you specify which document or topic you're referring to?",
      route: "CLARIFICATION", verification: "NOT_EVALUATED", sources: [], latencyMs: 180,
      trace: [
        { name: "User Query Received", status: "done", durationMs: 1 },
        { name: "Intent Classification", status: "done", durationMs: 150, details: "intent=CLARIFICATION" },
        { name: "Route Selection", status: "done", durationMs: 1, details: "→ clarifier" },
        { name: "Final Response", status: "done", durationMs: 1 },
      ], raw: { demo: true },
    };
  }
  const sources = (await demoSearch(question, topK)).slice(0, 2);
  return {
    answer: "The resume lists Python, FastAPI, PostgreSQL with pgvector, React, TypeScript, LangChain and Docker as technical skills.",
    route: "DOCUMENT_SEARCH", verification: q.includes("summar") ? "CORRECTED" : "SUPPORTED", sources, latencyMs: 1380,
    trace: [
      { name: "User Query Received", status: "done", durationMs: 1 },
      { name: "Intent Classification", status: "done", durationMs: 132, details: "intent=DOCUMENT_SEARCH" },
      { name: "Route Selection", status: "done", durationMs: 1, details: "→ retriever" },
      { name: "Document Retrieval", status: "done", durationMs: 64, details: `top_k=${topK}` },
      { name: "Answer Generation", status: "done", durationMs: 910 },
      { name: "Self-Correction Evaluation", status: "done", durationMs: 270, details: "grounding check" },
      { name: "Final Response", status: "done", durationMs: 2 },
    ], raw: { demo: true },
  };
}
