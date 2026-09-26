"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, History, Pencil, Plus, RefreshCw } from "lucide-react";
import { AdminGate, Field, inputCls, primaryBtnCls, thCls } from "@/components/portal/ProgressionAdminShared";
import { newKey } from "@/lib/apiClient";
import type { GoalProgressView } from "@/lib/progression/types";
import { createClient } from "@/lib/supabase/client";

interface GoalRow {
  id: string;
  slug: string;
  title: string;
  goal_type: string;
  target_points: number;
  position: number;
  active: boolean;
}

export default function AdminGoalsPage() {
  const [rows, setRows] = useState<GoalRow[] | null>(null);
  const [progress, setProgress] = useState<Record<string, GoalProgressView>>({});
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [credit, setCredit] = useState({ goal: "", member: "", points: 500, note: "" });
  const [creditKey, setCreditKey] = useState<string | null>(null);

  const load = async () => {
    const { data, error } = await createClient().from("club_goals").select("id, slug, title, goal_type, target_points, position, active").order("position");
    setRows((data ?? []) as GoalRow[]);
    setError(error ? "club_goals is not available (migration 029 not applied?)" : null);
    const res = await fetch("/api/progression/goals").then((r) => r.json()).catch(() => null);
    if (res?.ok) setProgress(Object.fromEntries((res.goals as GoalProgressView[]).map((g) => [g.slug, g])));
  };
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async fetch, setState is after await
    void load();
  }, []);

  const sync = async () => {
    const res = await fetch("/api/progression/goals/sync", { method: "POST" }).then((r) => r.json()).catch(() => null);
    setMessage(res?.ok ? `Synced: ${res.credited} new credits, ${res.skipped} over cap.` : (res?.error ?? "Sync failed"));
    void load();
  };

  const logCredit = async () => {
    // One key per intended credit; kept on failure so a retry can't double-count.
    const key = creditKey ?? newKey();
    setCreditKey(key);
    const res = await fetch(`/api/progression/goals/${credit.goal}/credit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ member_id: credit.member.trim(), points: Number(credit.points), note: credit.note.trim() || undefined, idempotency_key: key }),
    }).then((r) => r.json()).catch(() => null);
    if (res?.ok) {
      setCreditKey(null);
      setMessage(res.credit.replayed ? "Already logged." : `Logged ${res.credit.credited_points} pts.`);
      void load();
    } else setMessage(res?.error ?? "Couldn't log that contribution.");
  };

  return (
    <AdminGate>
      <Link href="/student/dashboard/admin" className="inline-flex items-center gap-1 text-xs font-mono text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] mb-2">
        <ArrowLeft size={12} /> Back to Admin
      </Link>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading font-bold text-[var(--color-text-primary)]">Club Goals</h1>
          <p className="text-sm font-mono text-[var(--color-text-muted)] mt-1">Server-wide goals · club_goals · real activity credits automatically</p>
        </div>
        <div className="flex gap-2">
          <button onClick={sync} className="inline-flex items-center gap-2 px-4 py-2 border border-[var(--glass-border)] text-[var(--color-text-primary)] font-mono text-xs uppercase tracking-wider rounded-md"><RefreshCw size={14} /> Sync check-ins</button>
          <Link href="/student/dashboard/admin/content/goals/new" className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--color-accent-cyan)] text-[var(--color-bg)] font-mono text-xs uppercase tracking-wider rounded-md"><Plus size={14} /> New Goal</Link>
        </div>
      </div>
      {error ? <p className="mb-4 text-xs font-mono text-red-400">{error}</p> : null}
      {message ? <p className="mb-4 text-xs font-mono text-[var(--color-text-soft)]">{message}</p> : null}
      {rows === null ? (
        <p className="text-center py-8 font-mono text-sm text-[var(--color-text-muted)] animate-pulse">Loading goals...</p>
      ) : (
        <div className="bg-[var(--color-bg-alt)] border border-[var(--glass-border)] rounded-lg overflow-x-auto mb-8">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--glass-border)]">{["#", "Goal", "Type", "Progress", "Members", "Active", ""].map((h) => <th key={h} className={thCls}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((g) => {
                const p = progress[g.slug];
                return (
                  <tr key={g.id} className="border-b border-[var(--glass-border)]/40 last:border-b-0">
                    <td className="px-4 py-3 font-mono text-xs">{g.position}</td>
                    <td className="px-4 py-3 text-[var(--color-text-primary)]">{g.title}<div className="font-mono text-[0.65rem] text-[var(--color-accent-cyan)]">{g.slug}</div></td>
                    <td className="px-4 py-3 font-mono text-xs text-[var(--color-text-muted)]">{g.goal_type}</td>
                    <td className="px-4 py-3 font-mono text-xs">{p ? `${p.points.toLocaleString()} / ${g.target_points.toLocaleString()} (${p.percent}%)${p.completed ? " ✓" : p.locked_by ? " · up next" : ""}` : `— / ${g.target_points.toLocaleString()}`}</td>
                    <td className="px-4 py-3 font-mono text-xs">{p?.contributors ?? "—"}</td>
                    <td className="px-4 py-3 font-mono text-xs">{g.active ? "active" : "inactive"}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <Link href={`/student/dashboard/admin/content/goals/${g.id}/edit`} className="inline-flex items-center gap-1 text-xs font-mono text-[var(--color-accent-cyan)] hover:underline mr-3"><Pencil size={12} /> Edit</Link>
                      <Link href={`/student/dashboard/admin/content/goals/${g.id}/history`} className="inline-flex items-center gap-1 text-xs font-mono text-[var(--color-text-muted)] hover:underline"><History size={12} /> History</Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <div className="bg-[var(--color-bg-alt)] border border-[var(--glass-border)] rounded-lg p-6 space-y-4 max-w-xl">
        <h2 className="font-heading font-bold text-[var(--color-text-primary)]">Log a contribution</h2>
        <p className="text-xs font-mono text-[var(--color-text-muted)]">For real club work that is not a QR check-in or bounty. Weighted by the goal&apos;s admin weight; not capped.</p>
        <Field label="Goal">
          <select className={inputCls} value={credit.goal} onChange={(e) => { setCredit({ ...credit, goal: e.target.value }); setCreditKey(null); }}>
            <option value="">Pick a goal…</option>
            {(rows ?? []).map((g) => <option key={g.slug} value={g.slug}>{g.title}</option>)}
          </select>
        </Field>
        <Field label="Member ID" hint="Profile UUID (from the Members admin page)">
          <input className={inputCls} value={credit.member} onChange={(e) => { setCredit({ ...credit, member: e.target.value }); setCreditKey(null); }} spellCheck={false} />
        </Field>
        <Field label="Amount"><input className={inputCls} type="number" min={1} max={5000} value={credit.points} onChange={(e) => { setCredit({ ...credit, points: Number(e.target.value) }); setCreditKey(null); }} /></Field>
        <Field label="Note"><input className={inputCls} maxLength={200} value={credit.note} onChange={(e) => setCredit({ ...credit, note: e.target.value })} /></Field>
        <button className={primaryBtnCls} disabled={!credit.goal || !credit.member.trim() || !(credit.points > 0)} onClick={logCredit}>Log contribution</button>
      </div>
    </AdminGate>
  );
}
