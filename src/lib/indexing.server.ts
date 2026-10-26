// Server-only helpers for the document ingestion pipeline: extract → chunk → embed.
import { extractText } from "unpdf";

export const countTokens = (t: string) => Math.ceil(t.split(/\s+/).filter(Boolean).length * 1.3);

export interface PageText { page: number; text: string }
export interface DocChunk { page: number; text: string; tokens: number }

/** Extract per-page text from a file buffer. PDFs keep real page numbers. */
export async function extractPages(type: "PDF" | "TXT" | "MD", buf: ArrayBuffer): Promise<PageText[]> {
  if (type === "PDF") {
    const { text } = await extractText(new Uint8Array(buf), { mergePages: false });
    const pages = (Array.isArray(text) ? text : [text]).map((t, i) => ({ page: i + 1, text: String(t).trim() })).filter((p) => p.text);
    if (!pages.length) throw new Error("PDF contains no extractable text (scanned/image-only pages need OCR).");
    return pages;
  }
  const text = new TextDecoder().decode(buf).trim();
  if (!text) throw new Error("File contains no extractable text.");
  return [{ page: 1, text }];
}

/** Split pages into ~180-token chunks, never crossing a page boundary. */
export function chunkPages(pages: PageText[]): DocChunk[] {
  const chunks: DocChunk[] = [];
  for (const { page, text } of pages) {
    const paras = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
    let cur = "";
    for (const p of paras) {
      if (cur && countTokens(cur + " " + p) > 180) {
        chunks.push({ page, text: cur, tokens: countTokens(cur) });
        cur = p;
      } else {
        cur = cur ? `${cur}\n\n${p}` : p;
      }
    }
    if (cur) chunks.push({ page, text: cur, tokens: countTokens(cur) });
  }
  if (!chunks.length) throw new Error("No text chunks could be produced from this file.");
  return chunks;
}

/**
 * Embed texts with the user's OpenRouter key when configured, otherwise the
 * built-in Lovable AI gateway. Both models produce 1536-dimension vectors.
 */
export async function embedChunks(texts: string[]): Promise<number[][]> {
  const openRouterKey = process.env["OPENROUTER_API_KEY"];
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const endpoint = openRouterKey
    ? { url: "https://openrouter.ai/api/v1/embeddings", key: openRouterKey, model: "openai/text-embedding-3-large" }
    : lovableKey
      ? { url: "https://ai.gateway.lovable.dev/v1/embeddings", key: lovableKey, model: "openai/text-embedding-3-small" }
      : null;
  if (!endpoint) throw new Error("No embedding provider configured. Add an OpenRouter API key in project secrets.");

  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += 20) {
    const batch = texts.slice(i, i + 20);
    const res = await fetch(endpoint.url, {
      method: "POST",
      headers: { Authorization: `Bearer ${endpoint.key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: endpoint.model, input: batch }),
    });
    if (!res.ok) throw new Error(`Embedding provider returned HTTP ${res.status}.`);
    const json = (await res.json()) as { data?: { embedding: number[] }[] };
    if (!json.data || json.data.length !== batch.length) throw new Error("Embedding provider returned an unexpected response.");
    for (const d of json.data) out.push(d.embedding);
  }
  return out;
}
