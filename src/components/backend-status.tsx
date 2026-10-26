import { Cable } from "lucide-react";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

export function BackendStatus() {
  const { backend } = useStore();
  const live = backend.settings.mode === "custom";
  return <span className="flex items-center gap-1.5 font-mono text-[10px]">
    <Cable className={cn("h-3 w-3 shrink-0", !live ? "text-muted-foreground" : backend.connection.kind === "connected" ? "text-success" : "text-warning")} />
    {live ? "Live Local Backend" : "Simulated"}
    {live && <span className="text-muted-foreground">· {backend.connection.kind}</span>}
  </span>;
}