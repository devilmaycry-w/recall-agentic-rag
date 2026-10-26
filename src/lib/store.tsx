import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { CHUNKS, INITIAL_AUDIT, INITIAL_DOCS, ORGS, countTokens, type AuditEntry, type Doc, type Org, type Role } from "./mock-data";
import type { AgentAnswer } from "./agent";

export interface QueryLog { orgId: string; route: AgentAnswer["route"]; latencyMs: number; verification: AgentAnswer["verification"]["kind"]; retries: number }

interface Store {
  org: Org;
  orgs: Org[];
  setOrgId: (id: string) => void;
  role: Role;
  setRole: (r: Role) => void;
  docs: Doc[];
  uploadFiles: (files: File[]) => void;
  retryDoc: (id: string) => void;
  deleteDoc: (id: string) => void;
  audit: AuditEntry[];
  log: (action: string, target: string) => void;
  queries: QueryLog[];
  recordQuery: (q: QueryLog) => void;
  theme: "dark" | "light";
  toggleTheme: () => void;
  user: string;
}

const Ctx = createContext<Store | null>(null);

// Seed some historical queries so analytics are populated
const seedQueries: QueryLog[] = Array.from({ length: 240 }, (_, i) => {
  const k = (i * 7919) % 100;
  const route = k < 62 ? "Document Retrieval" : k < 88 ? "Read-Only SQL" : "Clarification";
  const v = k % 11 === 0 ? "Abstained" : k % 4 === 0 ? "Corrected" : "Grounded";
  return { orgId: ORGS[i % 3]!.id, route, verification: v, retries: v === "Corrected" ? (k % 3 === 0 ? 2 : 1) : v === "Abstained" ? 2 : 0, latencyMs: 900 + ((k * 37) % 1800) } as QueryLog;
});

export function StoreProvider({ children }: { children: ReactNode }) {
  const [orgId, setOrgIdRaw] = useState(ORGS[0]!.id);
  const [roleOverride, setRoleOverride] = useState<Record<string, Role>>({});
  const [docs, setDocs] = useState<Doc[]>(INITIAL_DOCS);
  const [audit, setAudit] = useState<AuditEntry[]>(INITIAL_AUDIT);
  const [queries, setQueries] = useState<QueryLog[]>(seedQueries);
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  const baseOrg = ORGS.find((o) => o.id === orgId)!;
  const role = roleOverride[orgId] ?? baseOrg.role;
  const org = { ...baseOrg, role };
  const user = `you@${baseOrg.slug}.io`;

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  const log = useCallback((action: string, target: string) => {
    const at = new Date().toISOString().slice(0, 16).replace("T", " ");
    setAudit((a) => [{ id: crypto.randomUUID(), at, actor: user, action, target, orgId }, ...a]);
  }, [user, orgId]);

  const simulate = useCallback((id: string, fail: boolean) => {
    const steps = [15, 35, 55, 75, 90, 100];
    setDocs((d) => d.map((x) => (x.id === id ? { ...x, status: "Pending", progress: 0, error: undefined } : x)));
    steps.forEach((p, i) => {
      setTimeout(() => {
        setDocs((d) => d.map((x) => {
          if (x.id !== id) return x;
          if (fail && p >= 55) return { ...x, status: "Failed", progress: 55, error: "Parser error: file contains no extractable text" };
          if (x.status === "Failed") return x;
          return { ...x, status: p === 100 ? "Indexed" : "Processing", progress: p };
        }));
      }, 700 * (i + 1));
    });
  }, []);

  const uploadFiles = useCallback((files: File[]) => {
    files.forEach(async (f) => {
      const ext = f.name.split(".").pop()?.toLowerCase();
      const type = ext === "pdf" ? "PDF" : ext === "md" || ext === "markdown" ? "MD" : "TXT";
      const id = `doc_${crypto.randomUUID().slice(0, 8)}`;
      const doc: Doc = { id, orgId, name: f.name, type, sizeKb: Math.max(1, Math.round(f.size / 1024)), status: "Pending", progress: 0, uploadedBy: user, uploadedAt: new Date().toISOString().slice(0, 16).replace("T", " ") };
      setDocs((d) => [doc, ...d]);
      // Chunk text files for real so the inspector shows true content
      if (type !== "PDF") {
        const text = await f.text();
        const paras = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
        const chunks: string[] = [];
        let cur = "";
        for (const p of paras) {
          if (countTokens(cur + " " + p) > 180 && cur) { chunks.push(cur); cur = p; } else cur = cur ? `${cur}\n\n${p}` : p;
        }
        if (cur) chunks.push(cur);
        chunks.forEach((c, i) => CHUNKS.push({ id: `${id}_c${i + 1}`, docId: id, page: i + 1, text: c, tokens: countTokens(c) }));
      } else {
        CHUNKS.push({ id: `${id}_c1`, docId: id, page: 1, text: `Extracted text from ${f.name} (PDF parsing simulated in prototype).`, tokens: 12 });
      }
      log("doc.upload", f.name);
      simulate(id, f.size === 0);
    });
  }, [orgId, user, log, simulate]);

  const value = useMemo<Store>(() => ({
    org, orgs: ORGS.map((o) => ({ ...o, role: roleOverride[o.id] ?? o.role })),
    setOrgId: (id) => { setOrgIdRaw(id); },
    role, setRole: (r) => { setRoleOverride((m) => ({ ...m, [orgId]: r })); log("role.switch", `Preview as ${r}`); },
    docs: docs.filter((d) => d.orgId === orgId),
    uploadFiles,
    retryDoc: (id) => { log("ingest.retry", docs.find((d) => d.id === id)?.name ?? id); simulate(id, false); },
    deleteDoc: (id) => { log("doc.delete", docs.find((d) => d.id === id)?.name ?? id); setDocs((d) => d.filter((x) => x.id !== id)); },
    audit: audit.filter((a) => a.orgId === orgId),
    log,
    queries: queries.filter((q) => q.orgId === orgId),
    recordQuery: (q) => setQueries((x) => [...x, q]),
    theme, toggleTheme: () => setTheme((t) => (t === "dark" ? "light" : "dark")),
    user,
  }), [org.id, role, docs, audit, queries, theme, uploadFiles, log, simulate, orgId, roleOverride, user]); // eslint-disable-line react-hooks/exhaustive-deps

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
