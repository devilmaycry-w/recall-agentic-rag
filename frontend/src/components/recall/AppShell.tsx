import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { LayoutDashboard, Bot, Database, Search, GitBranch, Activity, Settings, Menu, X, Cpu } from "lucide-react";
import { cn } from "@/lib/utils";
import { useHealth, checkHealth } from "@/lib/health";
import { useSettings, APP_VERSION } from "@/lib/config";
import { Dot, connLabel, Tag } from "./kit";

const NAV = [
  { to: "/", label: "OVERVIEW", icon: LayoutDashboard },
  { to: "/assistant", label: "AI ASSISTANT", icon: Bot },
  { to: "/knowledge", label: "KNOWLEDGE BASE", icon: Database },
  { to: "/search", label: "DOCUMENT SEARCH", icon: Search },
  { to: "/trace", label: "AGENT TRACE", icon: GitBranch },
  { to: "/health", label: "SYSTEM HEALTH", icon: Activity },
  { to: "/settings", label: "SETTINGS", icon: Settings },
] as const;

function Clock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => { setNow(new Date()); const i = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(i); }, []);
  return <span className="font-mono text-[11px] text-muted-foreground tabular-nums">{now ? now.toISOString().replace("T", " ").slice(0, 19) + "Z" : "----"}</span>;
}

export function AppShell({ children }: { children: ReactNode }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const health = useHealth();
  const settings = useSettings();
  useEffect(() => { checkHealth(); }, [settings.apiBaseUrl]);
  useEffect(() => { setOpen(false); }, [path]);
  useEffect(() => { document.documentElement.dataset["accent"] = settings.accent; }, [settings.accent]);
  const current = NAV.find((n) => n.to === path) ?? NAV[0];

  return (
    <div className={cn("flex min-h-screen w-full bg-background", settings.scanlines && "scanlines")}>
      {open && <div className="fixed inset-0 z-30 bg-background/80 lg:hidden" onClick={() => setOpen(false)} />}
      <aside className={cn("fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-border bg-card transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0", open ? "translate-x-0" : "-translate-x-full")}>
        <div className="flex items-start justify-between border-b border-border p-4">
          <Link to="/" className="block">
            <div className="glitch font-display text-xl font-bold tracking-tight"><span className="text-primary">[ R ]</span> RECALL</div>
            <div className="label-mono mt-1">LOCAL AI KNOWLEDGE SYSTEM</div>
          </Link>
          <button className="lg:hidden" onClick={() => setOpen(false)} aria-label="Close menu"><X className="size-4" /></button>
        </div>
        <nav className="flex-1 overflow-y-auto p-2">
          <div className="label-mono px-2 py-2">// NAVIGATION</div>
          {NAV.map((n) => {
            const active = n.to === path;
            return (
              <Link key={n.to} to={n.to} className={cn("group mb-0.5 flex items-center gap-3 border-l-2 px-3 py-2 font-mono text-xs tracking-wider transition-colors",
                active ? "border-primary bg-primary/10 text-primary" : "border-transparent text-muted-foreground hover:border-border hover:bg-elevated hover:text-foreground")}>
                <n.icon className="size-4" /> {n.label}
                {active && <span className="ml-auto">◂</span>}
              </Link>
            );
          })}
        </nav>
        <div className="space-y-2 border-t border-border p-4 font-mono text-[11px]">
          <div className="flex items-center justify-between"><span className="text-muted-foreground">BACKEND</span><span className="flex items-center gap-2"><Dot s={health.backend} />{connLabel(health.backend)}</span></div>
          <div className="flex items-center justify-between"><span className="text-muted-foreground">DATABASE</span><span className="flex items-center gap-2"><Dot s={health.db} />{connLabel(health.db)}</span></div>
          <div className="flex items-center justify-between pt-2">
            <Tag tone={settings.mode === "demo" ? "warning" : "primary"}>{settings.mode === "demo" ? "DEMO MODE" : "LOCAL MODE"}</Tag>
            <span className="text-muted-foreground">{APP_VERSION}</span>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border bg-background/95 px-4 backdrop-blur">
          <button className="border border-border p-1.5 lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu"><Menu className="size-4" /></button>
          <div className="min-w-0">
            <div className="font-mono text-[10px] text-muted-foreground">recall <span className="text-primary">/</span> {current.label.toLowerCase().replace(" ", "-")}</div>
            <div className="truncate font-display text-sm font-semibold uppercase">{current.label}</div>
          </div>
          <div className="ml-auto flex items-center gap-4">
            <span className="hidden items-center gap-2 font-mono text-[11px] md:flex"><Cpu className="size-3.5 text-cyan" /> LOCAL</span>
            <Link to="/health" className="flex items-center gap-2 border border-border px-2 py-1 font-mono text-[11px] hover:border-primary">
              <Dot s={health.backend} /> API {connLabel(health.backend)}
            </Link>
            <span className="hidden sm:inline"><Clock /></span>
            <div className="grid size-8 place-items-center border border-primary font-mono text-xs text-primary">SYS</div>
          </div>
        </header>
        <main className="bg-grid flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
