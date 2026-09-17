"use client";

import { useCallback, useEffect, useState } from "react";

type SyncStatus = { pending: number | null; configured: boolean; setup_ready: boolean; connection: "missing" | "connected" | "reconnect" | "unavailable"; connection_message: string | null; url: string | null; last_synced_at: string | null; last_error: string | null; error?: string; busy?: boolean };

export default function SheetsSync() {
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [message, setMessage] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [checking, setChecking] = useState(true);
  const [checkError, setCheckError] = useState("");
  const refresh = useCallback(async () => {
    setChecking(true);
    try {
      const res = await fetch("/api/sheets-sync", { cache: "no-store" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not check spreadsheet delivery");
      setStatus(body);
      setCheckError("");
    } catch (error) { setCheckError(error instanceof Error ? error.message : "Could not check spreadsheet delivery"); }
    finally { setChecking(false); }
  }, []);
  useEffect(() => { void refresh(); const timer = setInterval(refresh, 30_000); return () => clearInterval(timer); }, [refresh]);
  async function sync() {
    setSyncing(true); setMessage("");
    try {
      const res = await fetch("/api/sheets-sync", { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Sync failed");
      setStatus(body);
      setMessage(body.busy ? "A sync is already running or waiting to retry." : body.connection === "connected" ? `${body.synced} records synced. ${body.pending} waiting.` : body.connection_message);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Sync failed. Applications remain saved."); }
    finally { setSyncing(false); }
  }
  const ready = status?.setup_ready && status.connection === "connected" && !checkError;
  return <section className="mb-5 flex flex-wrap items-center gap-3 border-y border-white/10 py-3 text-sm" aria-label="Google Sheets delivery">
    <span className="text-white/70">Google Sheets</span>
    <span className="text-white/50">{checkError ? "Connection check failed" : !status ? "Checking connection…" : !status.setup_ready ? "Delivery setup required" : status.connection === "reconnect" ? "Google reconnection needed" : status.connection !== "connected" ? "Google connection unavailable" : `${status.pending} waiting to sync`}</span>
    {status?.url && <a className="min-h-11 inline-flex items-center text-[#1D9BF0] underline" href={status.url} target="_blank" rel="noopener noreferrer">Open spreadsheet</a>}
    <button className="min-h-11 px-3 border border-white/20 rounded-md disabled:opacity-50" onClick={sync} disabled={syncing || checking || !ready}>{syncing ? "Syncing…" : status?.url ? "Sync pending" : "Create spreadsheet"}</button>
    <button className="min-h-11 px-3 underline disabled:opacity-50" onClick={refresh} disabled={checking || syncing}>{checking ? "Checking…" : "Check connection"}</button>
    {status && !status.setup_ready && <p className="basis-full text-xs text-amber-300">Spreadsheet delivery needs its database migration before syncing can start.</p>}
    <p className="basis-full text-xs text-white/60" role="status">{checkError || status?.connection_message || message || status?.last_error || (status?.last_synced_at ? `Last synced ${new Date(status.last_synced_at).toLocaleString()}. The spreadsheet is a copy; review and edit applicants here.` : "Applications are saved in the database first. Spreadsheet delivery retries separately.")}</p>
  </section>;
}
