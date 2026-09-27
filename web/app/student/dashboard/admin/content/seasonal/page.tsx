"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, History, Pencil, Plus } from "lucide-react";
import { AdminGate, thCls } from "@/components/portal/ProgressionAdminShared";
import { SEASONAL } from "@/components/portal/ClubGoalEditor";
import { goalCycle, normalizeGoal } from "@/lib/progression/goals";
import type { ClubGoal } from "@/lib/progression/types";
import { createClient } from "@/lib/supabase/client";

const day = (d: Date | null) => (d ? d.toLocaleDateString("en-CA", { month: "short", day: "numeric", timeZone: "America/Toronto" }) : "—");

// Seasonal events (row 212): seasonal club goals that repeat yearly on their window.
export default function AdminSeasonalPage() {
  const [rows, setRows] = useState<ClubGoal[] | null>(null);
  useEffect(() => {
    void createClient().from("club_goals").select("*").eq("goal_type", "seasonal").order("window_start").then(({ data }) => setRows(((data ?? []) as Record<string, unknown>[]).map(normalizeGoal)));
  }, []);
  const now = new Date();

  return (
    <AdminGate>
      <Link href="/student/dashboard/admin" className="inline-flex items-center gap-1 text-xs font-mono text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] mb-2">
        <ArrowLeft size={12} /> Back to Admin
      </Link>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading font-bold text-[var(--color-text-primary)]">Seasonal Events</h1>
          <p className="text-sm font-mono text-[var(--color-text-muted)] mt-1">Club goals that come back every year on the same dates · target, weights, letter, what they unlock</p>
        </div>
        <Link href={`${SEASONAL}/new`} className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--color-accent-cyan)] text-[var(--color-bg)] font-mono text-xs uppercase tracking-wider rounded-md">
          <Plus size={14} /> New event
        </Link>
      </div>
      {rows === null ? (
        <p className="text-center py-8 font-mono text-sm text-[var(--color-text-muted)] animate-pulse">Loading events...</p>
      ) : rows.length === 0 ? (
        <p className="text-center py-8 font-mono text-sm text-[var(--color-text-muted)]">No seasonal events yet.</p>
      ) : (
        <div className="bg-[var(--color-bg-alt)] border border-[var(--glass-border)] rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--glass-border)]">{["Event", "This year", "Status", "Target", "Unlocks", ""].map((h) => <th key={h} className={thCls}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((g) => {
                const c = goalCycle(g, now);
                return (
                  <tr key={g.id} className="border-b border-[var(--glass-border)]/40 last:border-b-0">
                    <td className="px-4 py-3 text-[var(--color-text-primary)]">{g.title}<div className="font-mono text-[0.65rem] text-[var(--color-accent-cyan)]">{g.slug}</div></td>
                    <td className="px-4 py-3 font-mono text-xs">{day(c.start)} – {day(c.end)}</td>
                    <td className="px-4 py-3 font-mono text-xs">{!g.active ? "inactive" : c.open ? "running now" : now < (c.start ?? now) ? "upcoming" : "ended"}</td>
                    <td className="px-4 py-3 font-mono text-xs">{g.target_points.toLocaleString()} pts</td>
                    <td className="px-4 py-3 font-mono text-xs text-[var(--color-text-muted)]">{g.unlocks.join(", ") || "—"}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <Link href={`${SEASONAL}/${g.id}/edit`} className="inline-flex items-center gap-1 text-xs font-mono text-[var(--color-accent-cyan)] hover:underline mr-3"><Pencil size={12} /> Edit</Link>
                      <Link href={`/student/dashboard/admin/content/goals/${g.id}/history`} className="inline-flex items-center gap-1 text-xs font-mono text-[var(--color-text-muted)] hover:underline"><History size={12} /> History</Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </AdminGate>
  );
}
