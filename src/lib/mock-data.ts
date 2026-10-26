export type Role = "Admin" | "Knowledge Manager" | "Member";
export type DocStatus = "Pending" | "Processing" | "Indexed" | "Failed";

export interface Org {
  id: string;
  name: string;
  slug: string;
  role: Role;
  region: string;
}

export interface Chunk {
  id: string;
  docId: string;
  page: number;
  text: string;
  tokens: number;
}

export interface Doc {
  id: string;
  orgId: string;
  name: string;
  type: "PDF" | "TXT" | "MD";
  sizeKb: number;
  status: DocStatus;
  progress: number;
  uploadedBy: string;
  uploadedAt: string;
  error?: string;
}

export const ORGS: Org[] = [
  { id: "org_acme", name: "Acme Robotics", slug: "acme", role: "Admin", region: "eu-west-1" },
  { id: "org_north", name: "Northwind Health", slug: "northwind", role: "Knowledge Manager", region: "us-east-1" },
  { id: "org_lake", name: "Lakeside University", slug: "lakeside", role: "Member", region: "ap-south-1" },
];

export const countTokens = (t: string) => Math.ceil(t.split(/\s+/).filter(Boolean).length * 1.3);

const raw: Record<string, { page: number; text: string }[]> = {
  doc_1: [
    { page: 2, text: "Employees accrue 1.75 days of paid time off per month, capped at 30 days carried over into the next calendar year. Requests longer than five consecutive days need manager approval two weeks in advance." },
    { page: 3, text: "Remote work is permitted up to three days per week. Fully remote arrangements require VP approval and a signed equipment agreement." },
    { page: 5, text: "Parental leave provides 16 weeks at full pay for the primary caregiver and 8 weeks for the secondary caregiver, available within 12 months of birth or adoption." },
  ],
  doc_2: [
    { page: 1, text: "The R-200 robotic arm supports a maximum payload of 12 kg with a repeatability of ±0.02 mm. Operating temperature range is 5°C to 45°C." },
    { page: 4, text: "Firmware updates for the R-200 must be applied during scheduled maintenance windows. Rolling back firmware requires a factory technician." },
    { page: 7, text: "The standard warranty covers parts and labor for 24 months from installation. Extended warranty plans add up to 36 additional months." },
  ],
  doc_3: [
    { page: 1, text: "Incident severity SEV-1 means full customer-facing outage. On-call must acknowledge within 5 minutes and post a status update every 30 minutes." },
    { page: 2, text: "Post-incident reviews are blameless and must be published within 5 business days of resolution for SEV-1 and SEV-2 incidents." },
  ],
  doc_4: [
    { page: 1, text: "Customer data is encrypted at rest using AES-256 and in transit with TLS 1.3. Encryption keys are rotated every 90 days." },
    { page: 2, text: "Data retention for audit logs is 400 days. Customer documents are deleted within 30 days of workspace closure." },
  ],
  doc_5: [{ page: 1, text: "Discharge checklist: confirm medication reconciliation, schedule follow-up within 7 days, and provide written care instructions." }],
  doc_6: [{ page: 1, text: "Graduate students must complete 36 credit hours including a thesis of at least 6 credits. Maximum time to degree is 5 years." }],
};

export const CHUNKS: Chunk[] = Object.entries(raw).flatMap(([docId, list]) =>
  list.map((c, i) => ({ id: `${docId}_c${i + 1}`, docId, page: c.page, text: c.text, tokens: countTokens(c.text) })),
);

export const INITIAL_DOCS: Doc[] = [
  { id: "doc_1", orgId: "org_acme", name: "Employee Handbook 2026.pdf", type: "PDF", sizeKb: 2310, status: "Indexed", progress: 100, uploadedBy: "maya@acme.io", uploadedAt: "2026-10-12 09:14" },
  { id: "doc_2", orgId: "org_acme", name: "R-200 Technical Manual.pdf", type: "PDF", sizeKb: 8840, status: "Indexed", progress: 100, uploadedBy: "dev@acme.io", uploadedAt: "2026-10-18 15:02" },
  { id: "doc_3", orgId: "org_acme", name: "incident-runbook.md", type: "MD", sizeKb: 42, status: "Indexed", progress: 100, uploadedBy: "sre@acme.io", uploadedAt: "2026-10-20 11:40" },
  { id: "doc_4", orgId: "org_acme", name: "Security Whitepaper.pdf", type: "PDF", sizeKb: 1290, status: "Indexed", progress: 100, uploadedBy: "maya@acme.io", uploadedAt: "2026-10-22 08:31" },
  { id: "doc_7", orgId: "org_acme", name: "scanned-contract-2019.pdf", type: "PDF", sizeKb: 15400, status: "Failed", progress: 40, uploadedBy: "legal@acme.io", uploadedAt: "2026-10-25 17:55", error: "OCR failed: image-only pages without text layer" },
  { id: "doc_5", orgId: "org_north", name: "Discharge Protocols.pdf", type: "PDF", sizeKb: 640, status: "Indexed", progress: 100, uploadedBy: "rn.lee@northwind.org", uploadedAt: "2026-10-10 10:00" },
  { id: "doc_6", orgId: "org_lake", name: "Graduate Catalog.txt", type: "TXT", sizeKb: 210, status: "Indexed", progress: 100, uploadedBy: "registrar@lakeside.edu", uploadedAt: "2026-09-30 13:20" },
];

export interface SalesRow { id: number; region: string; product: string; quarter: string; units: number; revenue: number }
export const SALES: SalesRow[] = (() => {
  const regions = ["EMEA", "NA", "APAC", "LATAM"];
  const products = ["R-200", "R-350", "Vision Kit", "Gripper Pro"];
  const quarters = ["2026-Q1", "2026-Q2", "2026-Q3", "2026-Q4"];
  const rows: SalesRow[] = [];
  let id = 1;
  for (const q of quarters) for (const r of regions) for (const p of products) {
    const seed = (id * 9301 + 49297) % 233280;
    const units = 20 + (seed % 180);
    const price = p === "R-350" ? 42000 : p === "R-200" ? 28000 : p === "Vision Kit" ? 6500 : 3200;
    rows.push({ id: id++, region: r, product: p, quarter: q, units, revenue: units * price });
  }
  return rows;
})();

export interface InventoryRow { sku: string; product: string; warehouse: string; on_hand: number; reorder_point: number }
export const INVENTORY: InventoryRow[] = [
  { sku: "R200-A", product: "R-200", warehouse: "Rotterdam", on_hand: 42, reorder_point: 30 },
  { sku: "R200-B", product: "R-200", warehouse: "Austin", on_hand: 18, reorder_point: 25 },
  { sku: "R350-A", product: "R-350", warehouse: "Rotterdam", on_hand: 9, reorder_point: 12 },
  { sku: "VK-01", product: "Vision Kit", warehouse: "Singapore", on_hand: 210, reorder_point: 80 },
  { sku: "GP-02", product: "Gripper Pro", warehouse: "Austin", on_hand: 64, reorder_point: 50 },
  { sku: "GP-03", product: "Gripper Pro", warehouse: "Singapore", on_hand: 12, reorder_point: 40 },
];

export const TABLES: Record<string, Record<string, unknown>[]> = {
  sales: SALES as unknown as Record<string, unknown>[],
  inventory: INVENTORY as unknown as Record<string, unknown>[],
};

export const SCHEMA = {
  sales: ["id INT", "region TEXT", "product TEXT", "quarter TEXT", "units INT", "revenue INT"],
  inventory: ["sku TEXT", "product TEXT", "warehouse TEXT", "on_hand INT", "reorder_point INT"],
};

export interface AuditEntry { id: string; at: string; actor: string; action: string; target: string; orgId: string }
export const INITIAL_AUDIT: AuditEntry[] = [
  { id: "a1", at: "2026-10-26 08:02", actor: "maya@acme.io", action: "role.update", target: "dev@acme.io → Knowledge Manager", orgId: "org_acme" },
  { id: "a2", at: "2026-10-25 17:56", actor: "system", action: "ingest.failed", target: "scanned-contract-2019.pdf", orgId: "org_acme" },
  { id: "a3", at: "2026-10-25 14:11", actor: "sre@acme.io", action: "sql.blocked", target: "DELETE FROM sales", orgId: "org_acme" },
  { id: "a4", at: "2026-10-24 09:40", actor: "rn.lee@northwind.org", action: "doc.upload", target: "Discharge Protocols.pdf", orgId: "org_north" },
];

export const BENCHMARK = [
  { metric: "Faithfulness", naive: 0.71, agentic: 0.93, better: "higher" },
  { metric: "Answer Correctness", naive: 0.64, agentic: 0.86, better: "higher" },
  { metric: "Context Precision", naive: 0.58, agentic: 0.84, better: "higher" },
  { metric: "Hallucination Rate", naive: 0.19, agentic: 0.04, better: "lower" },
] as const;

export const COST_LATENCY = [
  { system: "Naive RAG", latency: 820, cost: 0.0021 },
  { system: "Agentic RAG", latency: 1940, cost: 0.0058 },
];
