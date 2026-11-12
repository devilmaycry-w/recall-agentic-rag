import type React from "react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { Route, Verification, DocStatus } from "@/lib/api";
import type { Conn } from "@/lib/health";

export function Panel({ title, tag, right, children, className, bodyClass }: { title?: string | undefined; tag?: string | undefined; right?: ReactNode; children: ReactNode; className?: string | undefined; bodyClass?: string | undefined }) {
  return (
    <section className={cn("border border-border bg-card", className)}>
      {title && (
        <header className="flex items-center justify-between gap-2 border-b border-border bg-elevated px-3 py-2">
          <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em]">
            <span className="text-primary">{">_"}</span>
            <span className="text-foreground">{title}</span>
            {tag && <span className="border border-warning/60 px-1 text-[9px] text-warning">{tag}</span>}
          </div>
          {right}
        </header>
      )}
      <div className={cn("p-3", bodyClass)}>{children}</div>
    </section>
  );
}

export function PageHeader({ title, subtitle, right }: { title: string; subtitle?: string | undefined; right?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3 border-b border-border pb-4">
      <div>
        <h1 className="font-display text-2xl font-bold uppercase tracking-tight md:text-3xl">{title}</h1>
        {subtitle && <p className="label-mono mt-1 !text-primary">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}

type Tone = "primary" | "cyan" | "warning" | "error" | "muted";
const tones: Record<Tone, string> = {
  primary: "border-primary/70 text-primary bg-primary/10",
  cyan: "border-cyan/70 text-cyan bg-cyan/10",
  warning: "border-warning/70 text-warning bg-warning/10",
  error: "border-error/60 text-error bg-error/10",
  muted: "border-border text-muted-foreground bg-elevated",
};
export function Tag({ tone = "muted", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return <span className={cn("inline-flex items-center gap-1 border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider", tones[tone], className)}>{children}</span>;
}

const routeMeta: Record<Route, [string, Tone]> = {
  DOCUMENT_SEARCH: ["DOCUMENT SEARCH", "cyan"], SQL_QUERY: ["SQL QUERY", "primary"],
  CLARIFICATION: ["CLARIFICATION", "warning"], GENERAL: ["GENERAL", "muted"], UNKNOWN: ["ROUTE N/A", "muted"],
};
export const RouteBadge = ({ route }: { route: Route }) => <Tag tone={routeMeta[route][1]}>⇢ {routeMeta[route][0]}</Tag>;

const verMeta: Record<Verification, [string, Tone]> = {
  SUPPORTED: ["✓ SUPPORTED", "primary"], CORRECTED: ["↻ CORRECTED", "warning"], ABSTAINED: ["⊘ ABSTAINED", "error"], NOT_EVALUATED: ["— NOT EVALUATED", "muted"],
};
export const VerifyBadge = ({ v }: { v: Verification }) => <Tag tone={verMeta[v][1]}>{verMeta[v][0]}</Tag>;

const docMeta: Record<DocStatus, Tone> = { UPLOADED: "cyan", PROCESSING: "warning", PROCESSED: "primary", FAILED: "error" };
export const DocBadge = ({ s }: { s: DocStatus }) => <Tag tone={docMeta[s]}>{s}</Tag>;

export function Dot({ s }: { s: Conn }) {
  return <span className={cn("inline-block size-2", s === "connected" ? "bg-primary glow-line" : s === "disconnected" ? "bg-error" : "bg-muted-foreground")} />;
}
export const connLabel = (s: Conn) => s.toUpperCase();

export function Btn({ variant = "primary", className, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "danger" }) {
  const v = {
    primary: "border-primary bg-primary text-primary-foreground hover:shadow-brutal hover:-translate-x-0.5 hover:-translate-y-0.5",
    ghost: "border-border bg-elevated text-foreground hover:border-primary hover:text-primary",
    danger: "border-error/70 bg-error/10 text-error hover:bg-error/20",
  }[variant];
  return <button {...p} className={cn("inline-flex items-center justify-center gap-2 border px-3 py-2 font-mono text-[11px] font-bold uppercase tracking-wider transition-all disabled:pointer-events-none disabled:opacity-40", v, className)} />;
}

export function TopK({ value, onChange }: { value: number; onChange: (v: 3 | 5 | 10) => void }) {
  return (
    <div className="flex items-center border border-border font-mono text-[11px]">
      <span className="px-2 text-muted-foreground">TOP_K</span>
      {([3, 5, 10] as const).map((k) => (
        <button key={k} type="button" onClick={() => onChange(k)} className={cn("border-l border-border px-2.5 py-1.5", value === k ? "bg-primary text-primary-foreground" : "hover:text-primary")}>{k}</button>
      ))}
    </div>
  );
}

export function Empty({ title, hint }: { title: string; hint?: string | undefined }) {
  return (
    <div className="border border-dashed border-border p-8 text-center font-mono">
      <div className="text-sm text-muted-foreground">{"// "}{title}</div>
      {hint && <div className="mt-2 text-[11px] text-muted-foreground/70">{hint}</div>}
    </div>
  );
}
