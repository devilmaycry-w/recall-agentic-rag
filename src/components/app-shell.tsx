import { Link, useLocation } from "@tanstack/react-router";
import { Activity, BarChart3, Database, FileText, MessageSquare, Moon, ShieldCheck, Sun, Menu, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { can, useStore } from "@/lib/store";
import type { Role } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Assistant", icon: MessageSquare, gate: () => true },
  { to: "/documents", label: "Documents", icon: FileText, gate: () => true },
  { to: "/sql", label: "SQL Tool", icon: Database, gate: () => true },
  { to: "/analytics", label: "Analytics & Evals", icon: BarChart3, gate: can.viewAnalytics },
  { to: "/audit", label: "Audit Log", icon: Activity, gate: can.viewAudit },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { org, orgs, setOrgId, role, setRole, theme, toggleTheme, user } = useStore();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);

  const sidebar = (
    <aside className="flex h-full w-64 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      <div className="flex items-center gap-2 px-4 py-4">
        <div className="grid h-8 w-8 place-items-center rounded bg-primary font-mono text-sm font-bold text-primary-foreground">≡R</div>
        <div>
          <div className="text-sm font-semibold leading-none">Recall</div>
          <div className="font-mono text-[10px] text-muted-foreground">agentic rag · v0.9</div>
        </div>
      </div>
      <div className="px-3">
        <label className="mb-1 block font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Workspace</label>
        <select
          value={org.id}
          onChange={(e) => setOrgId(e.target.value)}
          className="w-full rounded border border-input bg-background px-2 py-1.5 text-sm"
        >
          {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
        <div className="mt-2 flex items-center gap-1.5 rounded border border-success/30 bg-success/10 px-2 py-1 font-mono text-[10px] text-success">
          <ShieldCheck className="h-3 w-3" /> tenant: {org.id} · {org.region}
        </div>
      </div>
      <nav className="mt-4 flex-1 space-y-0.5 px-2">
        {NAV.map((n) => {
          const allowed = n.gate(role);
          const active = pathname === n.to;
          return (
            <Link
              key={n.to}
              to={n.to}
              onClick={() => setOpen(false)}
              className={cn(
                "flex items-center gap-2.5 rounded px-2.5 py-2 text-sm transition-colors",
                active ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground" : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
                !allowed && "opacity-40",
              )}
            >
              <n.icon className="h-4 w-4" />
              {n.label}
              {!allowed && <span className="ml-auto font-mono text-[9px]">ADMIN</span>}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-sidebar-border p-3">
        <label className="mb-1 block font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Your role (preview)</label>
        <select value={role} onChange={(e) => setRole(e.target.value as Role)} className="w-full rounded border border-input bg-background px-2 py-1.5 text-sm">
          {(["Admin", "Knowledge Manager", "Member"] as Role[]).map((r) => <option key={r}>{r}</option>)}
        </select>
        <div className="mt-3 flex items-center justify-between">
          <span className="truncate font-mono text-[11px] text-muted-foreground">{user}</span>
          <button onClick={toggleTheme} aria-label="Toggle theme" className="rounded p-1.5 hover:bg-sidebar-accent">
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </aside>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <div className="hidden md:block">{sidebar}</div>
      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-background/80" onClick={() => setOpen(false)} />
          <div className="relative h-full w-64">{sidebar}</div>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-border px-4 py-2.5 md:hidden">
          <button onClick={() => setOpen(!open)} aria-label="Menu">{open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}</button>
          <span className="text-sm font-semibold">{org.name}</span>
          <span className="ml-auto font-mono text-[10px] text-muted-foreground">{role}</span>
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}

export function PageHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border px-6 py-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}

export function Locked({ need }: { need: string }) {
  return (
    <div className="grid h-full place-items-center p-10 text-center">
      <div>
        <ShieldCheck className="mx-auto h-8 w-8 text-muted-foreground" />
        <h2 className="mt-3 font-semibold">Restricted</h2>
        <p className="mt-1 text-sm text-muted-foreground">This view requires the {need} role. Switch roles in the sidebar to preview it.</p>
      </div>
    </div>
  );
}
