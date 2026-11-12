import { useSyncExternalStore } from "react";
import { api, type HealthResult } from "./api";

export type Conn = "connected" | "disconnected" | "unknown";
interface H { backend: Conn; db: Conn; checking: boolean; backendRes?: HealthResult | undefined; dbRes?: HealthResult | undefined; checkedAt?: Date | undefined; }
let h: H = { backend: "unknown", db: "unknown", checking: false };
const ls = new Set<() => void>();
const set = (p: Partial<H>) => { h = { ...h, ...p }; ls.forEach((l) => l()); };
export async function checkHealth() {
  set({ checking: true });
  const [b, d] = await Promise.all([api.health(), api.dbHealth()]);
  set({ checking: false, backend: b.ok ? "connected" : "disconnected", db: d.ok ? "connected" : b.ok ? "disconnected" : "unknown", backendRes: b, dbRes: d, checkedAt: new Date() });
}
const init: H = { backend: "unknown", db: "unknown", checking: false };
export const useHealth = () => useSyncExternalStore((cb) => { ls.add(cb); return () => ls.delete(cb); }, () => h, () => init);
