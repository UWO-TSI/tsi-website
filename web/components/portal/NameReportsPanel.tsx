"use client";

/**
 * Name reports in the admin activity log (row 221): open reports about
 * world names, with T1/T2 actions (reset name, mute 7 days, dismiss).
 */
import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface ReportRow {
  id: string;
  target_id: string;
  reporter_id: string | null;
  reason: string | null;
  created_at: string;
}

export default function NameReportsPanel({ showEmpty = false }: { showEmpty?: boolean }) {
  const [rows, setRows] = useState<(ReportRow & { target: string; world: string | null; reporter: string })[] | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const load = useCallback(async () => {
    const db = createClient();
    const { data, error } = await db.from("identity_reports").select("id, target_id, reporter_id, reason, created_at").eq("status", "open").order("created_at", { ascending: false }).limit(50);
    if (error) {
      setRows([]); // 034 not applied yet
      return;
    }
    const list = (data ?? []) as ReportRow[];
    const ids = [...new Set(list.flatMap((r) => [r.target_id, r.reporter_id]).filter((x): x is string => !!x))];
    const [{ data: profiles }, { data: idents }] = await Promise.all([
      ids.length ? db.from("profiles").select("id, display_name").in("id", ids) : Promise.resolve({ data: [] }),
      ids.length ? db.from("member_identity").select("member_id, world_name").in("member_id", ids) : Promise.resolve({ data: [] }),
    ]);
    const name = new Map(((profiles ?? []) as { id: string; display_name: string }[]).map((p) => [p.id, p.display_name]));
    const world = new Map(((idents ?? []) as { member_id: string; world_name: string | null }[]).map((p) => [p.member_id, p.world_name]));
    setRows(list.map((r) => ({ ...r, target: name.get(r.target_id) ?? "Member", world: world.get(r.target_id) ?? null, reporter: r.reporter_id ? (name.get(r.reporter_id) ?? "Member") : "A former member" })));
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
      {msg ? <p className="text-xs font-mono text-[var(--color-text-soft)] mb-2">{msg}</p> : null}
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center gap-3 text-sm">
            <span className="font-mono text-[var(--color-accent-cyan)]">{r.world ?? "(no world name)"}</span>
            <span className="text-[var(--color-text-muted)] font-mono text-xs">{r.target} · reported by {r.reporter} · {new Date(r.created_at).toLocaleDateString()}{r.reason ? ` · “${r.reason}”` : ""}</span>
            <span className="ml-auto flex gap-2">
              <button onClick={() => act(r.target_id, "reset_name")} className="px-2 py-1 border border-red-500/40 text-red-400 font-mono text-xs rounded">Reset name</button>
              <button onClick={() => act(r.target_id, "mute")} className="px-2 py-1 border border-[var(--glass-border)] font-mono text-xs rounded text-[var(--color-text-primary)]">Mute 7d</button>
              <button onClick={() => act(r.target_id, "dismiss")} className="px-2 py-1 border border-[var(--glass-border)] font-mono text-xs rounded text-[var(--color-text-muted)]">Dismiss</button>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
