import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { Activity, BarChart3, Database, FileText, LogOut, MessageSquare, Moon, ShieldCheck, Sun, Menu, X, Settings2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { can, useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { BackendStatus } from "@/components/backend-status";
import { Button } from "@/components/ui/button";

const NAV = [
  { to: "/assistant", label: "Assistant", icon: MessageSquare, gate: () => true },
  { to: "/documents", label: "Documents", icon: FileText, gate: () => true },
  { to: "/sql", label: "SQL Tool", icon: Database, gate: () => true },
  { to: "/analytics", label: "Analytics & Evals", icon: BarChart3, gate: can.viewAnalytics },
  { to: "/audit", label: "Audit Log", icon: Activity, gate: can.viewAudit },
  { to: "/settings", label: "Backend Settings", icon: Settings2, gate: () => true },
] as const;

function CreateWorkspace() {
  const { createOrg } = useStore();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      await createOrg(name.trim());
      toast.success(`Workspace "${name.trim()}" created — you're its Admin.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create the workspace.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid h-full place-items-center p-6">
      <form onSubmit={submit} className="w-full max-w-sm rounded-lg border border-border bg-card p-5">
        <ShieldCheck className="h-6 w-6 text-primary" />
        <h1 className="mt-3 text-lg font-semibold">Create your workspace</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your account isn't part of an organization yet. Create one to start uploading documents — or ask an Admin to add you to an existing workspace.
        </p>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Acme Robotics"
          className="mt-4 w-full rounded border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary/60"
        />
        <Button type="submit" className="mt-3 w-full" disabled={busy || name.trim().length < 2}>
          Create workspace
        </Button>
      </form>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { org, orgs, setOrgId, role, theme, toggleTheme, user, signOut, sessionReady } = useStore();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate({ to: "/auth", replace: true });
  };

  const sidebar = org && (
    <aside className="flex h-full w-64 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      <div className="flex items-center gap-2 px-4 py-4">
        <div className="grid h-8 w-8 place-items-center rounded bg-primary font-mono text-sm font-bold text-primary-foreground">≡R</div>
        <div>
          <div className="text-sm font-semibold leading-none">Recall</div>
          <div className="font-mono text-[10px] text-muted-foreground">agentic rag · v1.0</div>
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
          <ShieldCheck className="h-3 w-3" /> tenant: {org.slug} · isolated
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
        <Link to="/settings" onClick={() => setOpen(false)} className="mb-3 block rounded border border-border px-2 py-2"><BackendStatus /></Link>
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate font-mono text-[11px] text-muted-foreground">{user}</div>
            <div className="font-mono text-[10px] text-primary">{role}</div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button onClick={toggleTheme} aria-label="Toggle theme" className="rounded p-1.5 hover:bg-sidebar-accent">
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <button onClick={handleSignOut} aria-label="Sign out" className="rounded p-1.5 text-muted-foreground hover:bg-sidebar-accent hover:text-destructive">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <div className="hidden md:block">{sidebar}</div>
      {open && org && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-background/80" onClick={() => setOpen(false)} />
          <div className="relative h-full w-64">{sidebar}</div>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        {org && (
          <header className="flex items-center gap-3 border-b border-border px-4 py-2.5 md:hidden">
            <button onClick={() => setOpen(!open)} aria-label="Menu">{open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}</button>
            <span className="text-sm font-semibold">{org.name}</span>
            <span className="ml-auto font-mono text-[10px] text-muted-foreground">{role}</span>
          </header>
        )}
        <main className="min-h-0 flex-1 overflow-y-auto">
          {!sessionReady || (user && !org && orgs.length === 0 && !sessionReady) ? null : !org ? (
            sessionReady ? <CreateWorkspace /> : null
          ) : children}
        </main>
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
        <p className="mt-1 text-sm text-muted-foreground">This view requires the {need} role in the current workspace.</p>
      </div>
    </div>
  );
}
