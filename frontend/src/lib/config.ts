import { useSyncExternalStore } from "react";

export type AppMode = "demo" | "backend";
export interface Settings {
  apiBaseUrl: string;
  timeoutMs: number;
  topK: 3 | 5 | 10;
  mode: AppMode;
  scanlines: boolean;
  accent: "acid" | "cyan";
}

export const DEFAULT_API_BASE_URL = "http://localhost:8000";
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
export const APP_VERSION = "v1.0.0";

export const ENDPOINTS = {
  health: "/health",
  dbHealth: "/db-health",
  upload: "/documents/upload",
  search: "/documents/search",
  ask: "/documents/ask",
  route: "/documents/route",
  agent: "/documents/agent",
} as const;

export const DEFAULT_SETTINGS: Settings = {
  apiBaseUrl: DEFAULT_API_BASE_URL,
  timeoutMs: 60000,
  topK: 5,
  mode: "demo",
  scanlines: true,
  accent: "acid",
};

const KEY = "recall.settings.v1";
let current: Settings = DEFAULT_SETTINGS;
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) current = { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch { /* ignore */ }
}

export function getSettings(): Settings { load(); return current; }
export function updateSettings(patch: Partial<Settings>) {
  load();
  current = { ...current, ...patch };
  try { localStorage.setItem(KEY, JSON.stringify(current)); } catch { /* ignore */ }
  listeners.forEach((l) => l());
}
export function resetSettings() { updateSettings(DEFAULT_SETTINGS); }

export function useSettings(): Settings {
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
    getSettings,
    () => DEFAULT_SETTINGS,
  );
}
