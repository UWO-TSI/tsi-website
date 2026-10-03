"use client";

/**
 * Name reports in the admin activity log (row 221): open reports about
 * world names, with T1/T2 actions (reset name, mute 7 days, dismiss).
 */
import { useCallback, useEffect, useState } from "react";
import { Button, Card } from "@/components/gui";

type Who = { id: string; name: string; world_name: string | null } | null;
interface NameReport { id: string; reason: string | null; created_at: string; target: Who; reporter: Who }

const reportedOn = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric", timeZone: "America/Toronto" });

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
    <Card className="mb-4" style={{ padding: 20 }}>
      <h2 className="text-lg font-extrabold text-[var(--gui-ink-strong)] mb-2">Name reports ({rows.length} open)</h2>
      {msg ? <p role="status" className="text-sm font-bold text-[var(--gui-ink-2)] mb-2">{msg}</p> : null}
      {rows.length === 0 ? <p className="text-[13px] text-[var(--gui-muted)]">No world names reported right now.</p> : null}
      <ul className="divide-y-2 divide-dashed divide-[var(--gui-paper-edge)]">
        {rows.map((r) => (
          r.target && <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3 text-sm">
            <span className="font-extrabold text-[var(--gui-ink-strong)]">{r.target.world_name ?? "(no world name)"}</span>
            <span className="text-[13px] text-[var(--gui-ink-2)]">{r.target.name} · reported by {r.reporter?.name ?? "A former member"} · {reportedOn(r.created_at)}{r.reason ? ` · “${r.reason}”` : ""}</span>
            <span className="ml-auto flex flex-wrap gap-2">
              <Button size="sm" variant="danger" onClick={() => act(r.target!.id, "reset_name")}>Reset name</Button>
              <Button size="sm" variant="quiet" onClick={() => act(r.target!.id, "mute")}>Mute 7 days</Button>
              <Button size="sm" variant="quiet" onClick={() => act(r.target!.id, "dismiss")}>Dismiss</Button>
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
