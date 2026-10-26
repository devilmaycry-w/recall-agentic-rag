import { useEffect, useRef, useState } from "react";
import { checkBackend, DEFAULT_SETTINGS, restoreSettings, SETTINGS_KEY, type BackendSettings } from "@/lib/backend";

export type Connection = { kind: "unchecked" | "checking" | "connected" | "unreachable"; latencyMs?: number; error?: string };

export function useBackendSettings(orgId: string) {
  const [settings, setSettings] = useState<BackendSettings>(DEFAULT_SETTINGS);
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState(false);
  const [connection, setConnection] = useState<Connection>({ kind: "unchecked" });
  const requestRef = useRef<AbortController | null>(null);
  useEffect(() => {
    try { setSettings(restoreSettings(localStorage.getItem(SETTINGS_KEY))); } catch { setStorageError(true); }
    setReady(true);
    return () => requestRef.current?.abort();
  }, []);
  useEffect(() => {
    if (!ready) return;
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); setStorageError(false); } catch { setStorageError(true); }
  }, [settings, ready]);
  useEffect(() => {
    requestRef.current?.abort();
    requestRef.current = null;
    setConnection({ kind: "unchecked" });
  }, [settings, orgId]);
  const healthCheck = async () => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    const timeout = setTimeout(() => controller.abort(), 5000);
    setConnection({ kind: "checking" });
    try {
      const latencyMs = await checkBackend(settings, orgId, controller.signal);
      if (requestRef.current === controller) setConnection({ kind: "connected", latencyMs });
    } catch (error) {
      if (requestRef.current === controller) setConnection({ kind: "unreachable", error: error instanceof Error ? error.message : "Connection failed" });
    } finally { clearTimeout(timeout); }
  };
  return { settings, setSettings, ready, storageError, connection, healthCheck };
}