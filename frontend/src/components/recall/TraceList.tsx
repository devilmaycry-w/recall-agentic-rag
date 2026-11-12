import { useState } from "react";
import { ChevronRight } from "lucide-react";
import type { TraceStep } from "@/lib/api";
import { cn } from "@/lib/utils";

const color = { done: "border-primary text-primary", error: "border-error text-error", skipped: "border-border text-muted-foreground", unknown: "border-cyan text-cyan" };

export function TraceList({ steps }: { steps: TraceStep[] }) {
  const [open, setOpen] = useState<number | null>(null);
  if (!steps.length) return <div className="font-mono text-[11px] text-muted-foreground">// backend returned no trace data</div>;
  return (
    <ol className="relative space-y-1 font-mono text-xs">
      {steps.map((s, i) => (
        <li key={i} className="relative pl-6">
          {i < steps.length - 1 && <span className="absolute left-[7px] top-4 h-full w-px bg-border" />}
          <span className={cn("absolute left-0 top-1.5 grid size-[15px] place-items-center border bg-background text-[8px]", color[s.status])}>{i + 1}</span>
          <button onClick={() => setOpen(open === i ? null : i)} className="flex w-full items-center gap-2 py-1 text-left hover:text-primary">
            <ChevronRight className={cn("size-3 transition-transform", open === i && "rotate-90")} />
            <span className="flex-1">{s.name}</span>
            <span className={cn("text-[10px] uppercase", color[s.status].split(" ")[1])}>{s.status}</span>
            <span className="w-16 text-right text-[10px] text-muted-foreground">{s.durationMs !== undefined ? `${s.durationMs}ms` : "—"}</span>
          </button>
          {open === i && (
            <pre className="mb-2 ml-5 overflow-x-auto border border-border bg-background p-2 text-[10px] text-muted-foreground">{s.details ? `details: ${s.details}\n` : ""}{s.meta ? JSON.stringify(s.meta, null, 2) : s.details ? "" : "no metadata"}</pre>
          )}
        </li>
      ))}
    </ol>
  );
}
