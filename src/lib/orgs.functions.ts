import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Create a workspace and make the caller its Admin. Inserts go through the
 * privileged client because new organizations have no members yet, so the
 * member-scoped RLS policies cannot grant the first write.
 */
export const createOrganization = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ name: z.string().trim().min(2).max(80) }).parse(data))
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as { userId: string };
    const slug = data.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "workspace";
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: org, error: orgError } = await supabaseAdmin
      .from("organizations")
      .insert({ name: data.name, slug: `${slug}-${crypto.randomUUID().slice(0, 6)}` })
      .select("id, name, slug")
      .single();
    if (orgError || !org) throw new Error(orgError?.message ?? "Could not create the workspace.");

    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: ctx.userId, org_id: org.id, role: "admin" });
    if (roleError) throw new Error(roleError.message);

    await supabaseAdmin.from("audit_logs").insert({ org_id: org.id, actor_id: ctx.userId, action: "org.create", target: org.name });
    return org;
  });
