"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Flag, History, Pencil, Plus, RefreshCw } from "lucide-react";
import { AdminGate, buttonLinkCls } from "@/components/portal/ProgressionAdminShared";
import { Badge, Button, Card, Empty, ErrorNote, Field, Loading, Progress, Select } from "@/components/gui";
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

const PAGE = "mx-auto w-full max-w-6xl px-5 pt-6 pb-16 sm:px-8";
const BACK = "mb-2 inline-flex items-center gap-1.5 text-sm font-bold text-[var(--gui-ink-2)] hover:text-[var(--gui-ink-strong)]";
/** A link in the kit's small sage button. */
const BUTTON_LINK = buttonLinkCls;
const TH = "px-4 py-3 text-left text-xs font-extrabold whitespace-nowrap text-[var(--gui-ink-2)]";

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
    setError(error ? "The club goals table isn’t there yet (is migration 029 applied?)." : null);
    const res = await fetch("/api/progression/goals").then((r) => r.json()).catch(() => null);
    if (res?.ok) setProgress(Object.fromEntries((res.goals as GoalProgressView[]).map((g) => [g.slug, g])));
  };
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async fetch, setState is after await
    void load();
  }, []);

  const sync = async () => {
    const res = await fetch("/api/progression/goals/sync", { method: "POST" }).then((r) => r.json()).catch(() => null);
    setMessage(res?.ok ? `Synced: ${res.credited} new credits, ${res.skipped} over the cap.` : (res?.error ?? "The sync didn’t go through."));
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
      setMessage(res.credit.replayed ? "Already logged." : `Logged ${res.credit.credited_points} points.`);
      void load();
    } else setMessage(res?.error ?? "Couldn’t log that contribution.");
  };

  return (
    <AdminGate>
      <div className={PAGE}>
        <Link href="/student/dashboard/admin" className={BACK}>
          <ArrowLeft size={16} aria-hidden /> Back to admin
        </Link>
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-[var(--gui-ink-strong)]">Club goals</h1>
            <p className="mt-1 text-sm text-[var(--gui-muted)]">Goals the whole club works toward. Real activity counts toward them on its own.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="quiet" onClick={sync}><RefreshCw size={16} aria-hidden /> Sync check-ins</Button>
            <Link href="/student/dashboard/admin/content/goals/new" className={BUTTON_LINK} data-size="sm"><Plus size={16} aria-hidden /> New goal</Link>
          </div>
        </div>
        {error ? <ErrorNote className="mb-4">{error}</ErrorNote> : null}
        {message ? <p role="status" className="mb-4 rounded-2xl bg-[var(--gui-paper-warm)] px-4 py-2.5 text-sm font-bold text-[var(--gui-ink)]">{message}</p> : null}
        {rows === null ? (
          <Loading label="Getting the goals…" />
        ) : rows.length === 0 ? (
          error ? null : (
            <Empty icon={<Flag size={32} />} title="No club goals yet" className="mb-8">
              Add one and the whole club can work toward it.
            </Empty>
          )
        ) : (
          <Card style={{ padding: 0 }} className="mb-8 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[var(--gui-paper-warm)]">
                  {["#", "Goal", "Type", "Progress", "Members", "Status"].map((h) => <th key={h} className={TH}>{h}</th>)}
                  <th className={TH}><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((g) => {
                  const p = progress[g.slug];
                  return (
                    <tr key={g.id} className="border-t-2 border-dashed border-[var(--gui-paper-edge)]">
                      <td className="px-4 py-3 text-[var(--gui-ink-2)]">{g.position}</td>
                      <td className="px-4 py-3">
                        <span className="font-extrabold text-[var(--gui-ink-strong)]">{g.title}</span>
                        <div className="text-xs text-[var(--gui-muted)]">{g.slug}</div>
                      </td>
                      <td className="px-4 py-3 text-[var(--gui-ink-2)]">{g.goal_type}</td>
                      <td className="min-w-[13rem] px-4 py-3">
                        {p ? (
                          <div className="grid gap-1.5">
                            <div className="flex flex-wrap items-center gap-2 text-[var(--gui-ink)]">
                              <span>{p.points.toLocaleString()} of {g.target_points.toLocaleString()} ({p.percent}%)</span>
                              {p.completed ? <Badge tone="success">Done</Badge> : p.locked_by ? <Badge tone="info">Up next</Badge> : null}
                            </div>
                            <Progress value={p.points} max={g.target_points} label={`${g.title} progress`} />
                          </div>
                        ) : (
                          <span className="text-[var(--gui-ink-2)]">Target {g.target_points.toLocaleString()}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[var(--gui-ink-2)]">{p?.contributors ?? "—"}</td>
                      <td className="px-4 py-3">{g.active ? <Badge tone="success">Active</Badge> : <Badge>Inactive</Badge>}</td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <Link href={`/student/dashboard/admin/content/goals/${g.id}/edit`} className="mr-3 inline-flex items-center gap-1 font-bold text-[var(--gui-sage)] hover:underline"><Pencil size={14} aria-hidden /> Edit</Link>
                        <Link href={`/student/dashboard/admin/content/goals/${g.id}/history`} className="inline-flex items-center gap-1 font-bold text-[var(--gui-ink-2)] hover:underline"><History size={14} aria-hidden /> History</Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        )}
        <Card as="section" className="max-w-xl space-y-4" aria-labelledby="log-contribution">
          <h2 id="log-contribution" className="text-base font-extrabold text-[var(--gui-ink-strong)]">Log a contribution</h2>
          <p className="text-sm text-[var(--gui-ink-2)]">For real club work that isn’t a QR check-in or a bounty. It’s weighted by the goal’s admin weight and isn’t capped.</p>
          <label className="grid gap-2 text-base font-bold text-[var(--gui-ink)]">
            Goal
            <Select className="w-full" value={credit.goal} onChange={(e) => { setCredit({ ...credit, goal: e.target.value }); setCreditKey(null); }}>
              <option value="">Pick a goal…</option>
              {(rows ?? []).map((g) => <option key={g.slug} value={g.slug}>{g.title}</option>)}
            </Select>
          </label>
          <Field label="Member ID" hint="Their profile ID, from the Members page." value={credit.member} onChange={(e) => { setCredit({ ...credit, member: e.target.value }); setCreditKey(null); }} spellCheck={false} />
          <Field label="Points" type="number" min={1} max={5000} value={credit.points} onChange={(e) => { setCredit({ ...credit, points: Number(e.target.value) }); setCreditKey(null); }} />
          <Field label="Note" hint="Optional" maxLength={200} value={credit.note} onChange={(e) => setCredit({ ...credit, note: e.target.value })} />
          <Button size="sm" disabled={!credit.goal || !credit.member.trim() || !(credit.points > 0)} onClick={logCredit}>Log contribution</Button>
        </Card>
      </div>
    </AdminGate>
  );
}
