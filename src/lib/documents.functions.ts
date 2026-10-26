import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { chunkPages, embedChunks, extractPages } from "./indexing.server";

type Ctx = { supabase: any; userId: string };

async function requireManager(ctx: Ctx, orgId: string) {
  const { data } = await ctx.supabase
    .from("user_roles")
    .select("role")
    .eq("org_id", orgId)
    .eq("user_id", ctx.userId)
    .maybeSingle();
  if (data?.role !== "admin" && data?.role !== "knowledge_manager") {
    throw new Error("Uploading and managing documents requires the Admin or Knowledge Manager role.");
  }
}

function docType(name: string): "PDF" | "TXT" | "MD" {
  const ext = name.split(".").pop()?.toLowerCase();
  return ext === "pdf" ? "PDF" : ext === "md" || ext === "markdown" ? "MD" : "TXT";
}

/** Shared pipeline: extract text from the stored file, chunk, embed, index. */
async function runIndexing(ctx: Ctx, docId: string, orgId: string, storagePath: string, type: "PDF" | "TXT" | "MD", name: string) {
  const { data: blob, error: dlError } = await ctx.supabase.storage.from("documents").download(storagePath);
  if (dlError || !blob) throw new Error("Could not read the uploaded file from storage.");
  const pages = await extractPages(type, await blob.arrayBuffer());
  const chunks = chunkPages(pages);
  await ctx.supabase.from("documents").update({ status: "processing", progress: 55 }).eq("id", docId);
  const embeddings = await embedChunks(chunks.map((c) => c.text));
  await ctx.supabase.from("document_chunks").delete().eq("document_id", docId);
  const { error: chunkError } = await ctx.supabase.from("document_chunks").insert(
    chunks.map((c, i) => ({
      document_id: docId,
      org_id: orgId,
      page: c.page,
      content: c.text,
      token_count: c.tokens,
      embedding: JSON.stringify(embeddings[i]),
    })),
  );
  if (chunkError) throw new Error(chunkError.message);
  await ctx.supabase.from("documents").update({ status: "indexed", progress: 100, error: null }).eq("id", docId);
  await ctx.supabase.from("audit_logs").insert({ org_id: orgId, actor_id: ctx.userId, action: "ingest.indexed", target: name });
}

export const uploadDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => {
    if (!(data instanceof FormData)) throw new Error("Expected form data with a file.");
    return data;
  })
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    const file = data.get("file");
    const orgId = String(data.get("orgId") ?? "");
    if (!(file instanceof File) || !orgId) throw new Error("Missing file or organization.");
    if (!/\.(pdf|txt|md|markdown)$/i.test(file.name)) throw new Error("Only PDF, TXT and Markdown files are supported.");
    await requireManager(ctx, orgId);

    const type = docType(file.name);
    const docId = crypto.randomUUID();
    const storagePath = `${orgId}/${docId}/${file.name}`;
    const { error: upError } = await ctx.supabase.storage
      .from("documents")
      .upload(storagePath, await file.arrayBuffer(), { contentType: file.type || "application/octet-stream" });
    if (upError) throw new Error(upError.message);

    const { error: rowError } = await ctx.supabase.from("documents").insert({
      id: docId,
      org_id: orgId,
      name: file.name,
      type,
      size_kb: Math.max(1, Math.round(file.size / 1024)),
      status: "processing",
      progress: 15,
      storage_path: storagePath,
      uploaded_by: ctx.userId,
    });
    if (rowError) throw new Error(rowError.message);
    await ctx.supabase.from("audit_logs").insert({ org_id: orgId, actor_id: ctx.userId, action: "doc.upload", target: file.name });

    try {
      await runIndexing(ctx, docId, orgId, storagePath, type, file.name);
      return { id: docId, status: "indexed" as const };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Indexing failed.";
      await ctx.supabase.from("documents").update({ status: "failed", progress: 0, error: message }).eq("id", docId);
      return { id: docId, status: "failed" as const, error: message };
    }
  });

export const retryDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ docId: z.string() }).parse(data))
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    const { data: doc, error } = await ctx.supabase.from("documents").select("*").eq("id", data.docId).single();
    if (error || !doc) throw new Error("Document not found.");
    await requireManager(ctx, doc.org_id);
    if (!doc.storage_path) throw new Error("This document has no stored file to reprocess.");
    try {
      await runIndexing(ctx, doc.id, doc.org_id, doc.storage_path, doc.type, doc.name);
      return { status: "indexed" as const };
    } catch (e) {
      const message = e instanceof Error ? e.message : "Indexing failed.";
      await ctx.supabase.from("documents").update({ status: "failed", progress: 0, error: message }).eq("id", doc.id);
      return { status: "failed" as const, error: message };
    }
  });

export const deleteDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ docId: z.string() }).parse(data))
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    const { data: doc, error } = await ctx.supabase.from("documents").select("*").eq("id", data.docId).single();
    if (error || !doc) throw new Error("Document not found.");
    await requireManager(ctx, doc.org_id);
    if (doc.storage_path) await ctx.supabase.storage.from("documents").remove([doc.storage_path]);
    await ctx.supabase.from("documents").delete().eq("id", doc.id);
    await ctx.supabase.from("audit_logs").insert({ org_id: doc.org_id, actor_id: ctx.userId, action: "doc.delete", target: doc.name });
    return { ok: true };
  });
