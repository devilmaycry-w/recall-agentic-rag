import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { AI_PROVIDERS, type AiProviderId } from "./ai-providers";

type AuthedContext = { supabase: any; userId: string };

async function requireOrgAdmin({ supabase, userId }: AuthedContext, orgId: string) {
  const { data: membership } = await supabase
    .from("user_roles")
    .select("role")
    .eq("org_id", orgId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!membership) throw new Error("You are not a member of this workspace.");
  if (membership.role !== "admin") throw new Error("Only workspace admins can manage AI provider keys.");
}

const providerEnum = z.enum(["openrouter", "openai", "groq", "anthropic", "gemini"]);

/** Admin-only: which provider is configured for this workspace (never the key). */
export const getOrgAiSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ orgId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await requireOrgAdmin(context, data.orgId);
    const { data: row } = await context.supabase
      .from("org_ai_settings")
      .select("provider, fast_model, answer_model, updated_at")
      .eq("org_id", data.orgId)
      .maybeSingle();
    if (!row) return null;
    return { provider: row.provider as AiProviderId, fastModel: row.fast_model, answerModel: row.answer_model, updatedAt: row.updated_at };
  });

/** Admin-only: store or replace the workspace's own AI provider key. */
export const saveOrgAiSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        orgId: z.string().uuid(),
        provider: providerEnum,
        apiKey: z.string().trim().min(8).max(256),
        fastModel: z.string().trim().max(120).optional(),
        answerModel: z.string().trim().max(120).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await requireOrgAdmin(context, data.orgId);
    const { error } = await context.supabase.from("org_ai_settings").upsert({
      org_id: data.orgId,
      provider: data.provider,
      api_key: data.apiKey,
      fast_model: data.fastModel || null,
      answer_model: data.answerModel || null,
      updated_by: context.userId,
      updated_at: new Date().toISOString(),
    });
    if (error) throw new Error(`Could not save AI settings: ${error.message}`);
    await context.supabase.from("audit_logs").insert({
      org_id: data.orgId,
      actor_id: context.userId,
      action: "settings.ai_provider",
      target: `provider set to ${AI_PROVIDERS[data.provider].label}`,
    });
    return { ok: true as const };
  });

/** Admin-only: remove the workspace key — the assistant falls back to the project default. */
export const clearOrgAiSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ orgId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await requireOrgAdmin(context, data.orgId);
    const { error } = await context.supabase.from("org_ai_settings").delete().eq("org_id", data.orgId);
    if (error) throw new Error(`Could not remove AI settings: ${error.message}`);
    await context.supabase.from("audit_logs").insert({
      org_id: data.orgId,
      actor_id: context.userId,
      action: "settings.ai_provider",
      target: "provider key removed",
    });
    return { ok: true as const };
  });

export const askAssistant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        orgId: z.string().uuid(),
        query: z.string().min(1).max(4000),
        sessionId: z.string().max(64).optional(),
        history: z
          .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(2000) }))
          .max(8)
          .optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // Membership check through the caller's own RLS-scoped client.
    const { data: membership } = await supabase
      .from("user_roles")
      .select("role")
      .eq("org_id", data.orgId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!membership) throw new Error("You are not a member of this workspace.");

    const { runRag } = await import("./rag.server");
    const answer = await runRag(supabase, data.orgId, data.query, data.history ?? []);

    const ROUTE_ENUM = { "Document Retrieval": "doc_retrieval", "Read-Only SQL": "sql_query", Clarification: "clarify" } as const;
    const verification = answer.verification.kind.toLowerCase() as "grounded" | "corrected" | "abstained";
    const retries = answer.verification.kind === "Corrected" ? answer.verification.retry : answer.verification.kind === "Abstained" ? 2 : 0;
    await supabase.from("queries").insert({
      org_id: data.orgId,
      user_id: userId,
      question: data.query,
      route: ROUTE_ENUM[answer.route] ?? "doc_retrieval",
      latency_ms: answer.latencyMs,
      verification,
      retries,
    });
    await supabase.from("audit_logs").insert({
      org_id: data.orgId,
      actor_id: userId,
      action: "assistant.query",
      target: `${answer.route} · ${verification}`,
    });

    // Plain serializable DTO (AgentAnswer's optional sql field is not RPC-safe).
    return {
      route: answer.route,
      content: answer.content,
      citations: answer.citations,
      verification: answer.verification,
      trace: answer.trace,
      latencyMs: answer.latencyMs,
    };
  });
