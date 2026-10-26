import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { INITIAL_AUDIT, type AuditEntry, type Role } from "./mock-data";
import type { AgentAnswer } from "./agent";
import { useBackendSettings } from "@/hooks/use-backend-settings";
import { deleteDocument, retryDocument, uploadDocument } from "./documents.functions";
import { createOrganization } from "./orgs.functions";

export interface QueryLog { orgId: string; route: AgentAnswer["route"]; latencyMs: number; verification: AgentAnswer["verification"]["kind"]; retries: number }

export interface Org { id: string; name: string; slug: string; role: Role }
export interface Doc {
  id: string;
  orgId: string;
  name: string;
  type: "PDF" | "TXT" | "MD";
  sizeKb: number;
  status: "Pending" | "Processing" | "Indexed" | "Failed";
  progress: number;
  uploadedBy: string;
  uploadedAt: string;
  error?: string | undefined;
}

const ROLE_LABEL: Record<string, Role> = { admin: "Admin", knowledge_manager: "Knowledge Manager", member: "Member" };
const STATUS_LABEL: Record<string, Doc["status"]> = { pending: "Pending", processing: "Processing", indexed: "Indexed", failed: "Failed" };

interface Store {
  backend: ReturnType<typeof useBackendSettings>;
  sessionReady: boolean;
  userId: string | null;
  user: string;
  orgs: Org[];
  org: Org | null;
  setOrgId: (id: string) => void;
  role: Role;
  createOrg: (name: string) => Promise<void>;
  signOut: () => Promise<void>;
  docs: Doc[];
  refreshDocs: () => Promise<void>;
  uploadFiles: (files: File[]) => Promise<void>;
  retryDoc: (id: string) => Promise<void>;
  deleteDoc: (id: string) => Promise<void>;
  audit: AuditEntry[];
  log: (action: string, target: string) => void;
  queries: QueryLog[];
  recordQuery: (q: QueryLog) => void;
  theme: "dark" | "light";
  toggleTheme: () => void;
}

// Keep one context instance across hot reloads; a re-created context makes
// consumers lose the provider that was mounted with the old one.
const g = globalThis as unknown as { __recallStoreCtx?: React.Context<Store | null> };
const Ctx = (g.__recallStoreCtx ??= createContext<Store | null>(null));

// Analytics still runs on seeded demo data (client-side prototype).
const seedQueries: QueryLog[] = Array.from({ length: 240 }, (_, i) => {
  const k = (i * 7919) % 100;
  const route = k < 62 ? "Document Retrieval" : k < 88 ? "Read-Only SQL" : "Clarification";
  const v = k % 11 === 0 ? "Abstained" : k % 4 === 0 ? "Corrected" : "Grounded";
  return { orgId: "demo", route, verification: v, retries: v === "Corrected" ? (k % 3 === 0 ? 2 : 1) : v === "Abstained" ? 2 : 0, latencyMs: 900 + ((k * 37) % 1800) } as QueryLog;
});

function mapDoc(row: any, email: string): Doc {
  return {
    id: row.id,
    orgId: row.org_id,
    name: row.name,
    type: row.type,
    sizeKb: row.size_kb,
    status: STATUS_LABEL[row.status] ?? "Pending",
    progress: row.progress,
    uploadedBy: row.uploaded_by === null ? "unknown" : email,
    uploadedAt: String(row.uploaded_at).slice(0, 16).replace("T", " "),
    error: row.error ?? undefined,
  };
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [sessionReady, setSessionReady] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [orgId, setOrgId] = useState<string>("");
  const [docs, setDocs] = useState<Doc[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>(INITIAL_AUDIT);
  const [queries, setQueries] = useState<QueryLog[]>(seedQueries);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const backend = useBackendSettings(orgId || "none");

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  const loadOrgs = useCallback(async () => {
    const { data } = await supabase
      .from("user_roles")
      .select("org_id, role, organizations(id, name, slug)");
    const list: Org[] = (data ?? [])
      .map((r: any) => ({ id: r.organizations?.id, name: r.organizations?.name, slug: r.organizations?.slug, role: ROLE_LABEL[r.role] ?? "Member" }))
      .filter((o: Org) => o.id);
    setOrgs(list);
    setOrgId((cur) => (list.some((o) => o.id === cur) ? cur : (list[0]?.id ?? "")));
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null);
      setEmail(data.user?.email ?? "");
      setSessionReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      setUserId(session?.user?.id ?? null);
      setEmail(session?.user?.email ?? "");
      setSessionReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (userId) void loadOrgs();
    else { setOrgs([]); setOrgId(""); setDocs([]); }
  }, [userId, loadOrgs]);

  const refreshDocs = useCallback(async () => {
    if (!orgId) { setDocs([]); return; }
    const { data } = await supabase
      .from("documents")
      .select("*")
      .eq("org_id", orgId)
      .order("uploaded_at", { ascending: false });
    setDocs((data ?? []).map((r: any) => mapDoc(r, email)));
  }, [orgId, email]);

  useEffect(() => { void refreshDocs(); }, [refreshDocs]);

  // Live status updates while documents are being processed.
  useEffect(() => {
    if (!orgId) return;
    const channel = supabase
      .channel(`documents-${orgId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "documents", filter: `org_id=eq.${orgId}` }, () => { void refreshDocs(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [orgId, refreshDocs]);

  const org = orgs.find((o) => o.id === orgId) ?? null;
  const role = org?.role ?? "Member";

  const log = useCallback((action: string, target: string) => {
    const at = new Date().toISOString().slice(0, 16).replace("T", " ");
    setAudit((a) => [{ id: crypto.randomUUID(), at, actor: email, action, target, orgId }, ...a]);
  }, [email, orgId]);

  const uploadFiles = useCallback(async (files: File[]) => {
    if (!orgId) return;
    for (const f of files) {
      const form = new FormData();
      form.append("orgId", orgId);
      form.append("file", f);
      try {
        const result = await uploadDocument({ data: form });
        if (result.status === "failed") toast.error(`${f.name}: ${result.error ?? "indexing failed"}`);
        else toast.success(`${f.name} indexed`);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : `Upload failed for ${f.name}`);
      }
    }
    await refreshDocs();
  }, [orgId, refreshDocs]);

  const retryDoc = useCallback(async (id: string) => {
    try {
      const result = await retryDocument({ data: { docId: id } });
      if (result.status === "failed") toast.error(result.error ?? "Indexing failed again");
      else toast.success("Document indexed");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Retry failed");
    }
    await refreshDocs();
  }, [refreshDocs]);

  const deleteDoc = useCallback(async (id: string) => {
    try {
      await deleteDocument({ data: { docId: id } });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Delete failed");
    }
    await refreshDocs();
  }, [refreshDocs]);

  const createOrg = useCallback(async (name: string) => {
    const org = await createOrganization({ data: { name } });
    await loadOrgs();
    setOrgId(org.id);
  }, [loadOrgs]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const value = useMemo<Store>(() => ({
    backend,
    sessionReady,
    userId,
    user: email,
    orgs,
    org,
    setOrgId,
    role,
    createOrg,
    signOut,
    docs,
    refreshDocs,
    uploadFiles,
    retryDoc,
    deleteDoc,
    audit,
    log,
    queries,
    recordQuery: (q) => setQueries((x) => [...x, q]),
    theme,
    toggleTheme: () => setTheme((t) => (t === "dark" ? "light" : "dark")),
  }), [backend, sessionReady, userId, email, orgs, org, role, createOrg, signOut, docs, refreshDocs, uploadFiles, retryDoc, deleteDoc, audit, log, queries, theme]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const s = useContext(Ctx);
  if (!s) throw new Error("useStore outside provider");
  return s;
}

export const can = {
  upload: (r: Role) => r !== "Member",
  viewAnalytics: (r: Role) => r === "Admin",
  viewAudit: (r: Role) => r === "Admin",
};
