"use client";

/**
 * Name reports in the admin activity log (row 221): open reports about
 * world names, with T1/T2 actions (reset name, mute 7 days, dismiss).
 */
import { useCallback, useEffect, useState } from "react";

type Who = { id: string; name: string; world_name: string | null } | null;
interface NameReport { id: string; reason: string | null; created_at: string; target: Who; reporter: Who }

export default function NameReportsPanel({ showEmpty = false }: { showEmpty?: boolean }) {
  const [rows, setRows] = useState<NameReport[] | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  // The queue's GET joins the names on the server (app/api/admin/moderation).
  const load = useCallback(async () => {
    const body = await fetch("/api/admin/moderation").then((r) => r.json()).catch(() => null);
    setRows(body?.ok ? (body.names as NameReport[]) : []);
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async fetch, setState is after await
    void load();
  }, [load]);
  const act = async (target: string, action: "reset_name" | "mute" | "dismiss") => {
    const res = await fetch("/api/identity/moderate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ member_id: target, action }) });
    const body = await res.json().catch(() => ({}));
    setMsg(res.ok && body.ok ? `Done: ${action.replace("_", " ")}.` : (body.error ?? "Action failed."));
    await load();
  };
  if (!rows || (rows.length === 0 && !showEmpty)) return null;
  return (
    <div className="bg-[var(--color-bg-alt)] border border-[var(--glass-border)] rounded-lg p-4 mb-4">
      <h2 className="font-heading font-bold text-[var(--color-text-primary)] mb-2">Name reports ({rows.length} open)</h2>
      {msg ? <p className="text-xs text-[var(--color-text-soft)] mb-2">{msg}</p> : null}
      <ul className="space-y-2">
        {rows.map((r) => (
          r.target && <li key={r.id} className="flex flex-wrap items-center gap-3 text-sm">
            <span className="text-[var(--color-accent-cyan)]">{r.target.world_name ?? "(no world name)"}</span>
            <span className="text-[var(--color-text-muted)] text-xs">{r.target.name} · reported by {r.reporter?.name ?? "A former member"} · {new Date(r.created_at).toLocaleDateString()}{r.reason ? ` · “${r.reason}”` : ""}</span>
            <span className="ml-auto flex gap-2">
              <button onClick={() => act(r.target!.id, "reset_name")} className="px-2 py-1 border border-[var(--gui-danger)]/30 text-[var(--gui-danger)] text-xs rounded">Reset name</button>
              <button onClick={() => act(r.target!.id, "mute")} className="px-2 py-1 border border-[var(--glass-border)] text-xs rounded text-[var(--color-text-primary)]">Mute 7d</button>
              <button onClick={() => act(r.target!.id, "dismiss")} className="px-2 py-1 border border-[var(--glass-border)] text-xs rounded text-[var(--color-text-muted)]">Dismiss</button>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
