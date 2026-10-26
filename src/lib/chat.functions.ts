import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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
