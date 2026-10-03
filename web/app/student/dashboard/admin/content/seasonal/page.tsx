"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CalendarHeart, History, Pencil, Plus } from "lucide-react";
import { AdminGate, buttonLinkCls } from "@/components/portal/ProgressionAdminShared";
import { SEASONAL } from "@/components/portal/ClubGoalEditor";
import { goalCycle, normalizeGoal } from "@/lib/progression/goals";
import { DECOR_SETS } from "@/lib/progression/seasonal";
import { rewardName } from "@/components/progression/GoalCard";
import type { ClubGoal } from "@/lib/progression/types";
import { createClient } from "@/lib/supabase/client";
import { Badge, Card, Empty, Loading } from "@/components/gui";

const day = (d: Date | null) => (d ? d.toLocaleDateString("en-CA", { month: "short", day: "numeric", timeZone: "America/Toronto" }) : "—");

const PAGE = "mx-auto w-full max-w-6xl px-5 pt-6 pb-16 sm:px-8";
const BACK = "mb-2 inline-flex items-center gap-1.5 text-sm font-bold text-[var(--gui-ink-2)] hover:text-[var(--gui-ink-strong)]";
/** A link in the kit's small sage button. */
const BUTTON_LINK = buttonLinkCls;
const TH = "px-4 py-3 text-left text-xs font-extrabold whitespace-nowrap text-[var(--gui-ink-2)]";

// Seasonal events (row 212): seasonal club goals that repeat yearly on their window.
export default function AdminSeasonalPage() {
  const [rows, setRows] = useState<ClubGoal[] | null>(null);
  useEffect(() => {
    void createClient().from("club_goals").select("*").eq("goal_type", "seasonal").order("window_start").then(({ data }) => setRows(((data ?? []) as Record<string, unknown>[]).map(normalizeGoal)));
  }, []);
  const now = new Date();

  return (
    <AdminGate>
      <div className={PAGE}>
        <Link href="/student/dashboard/admin" className={BACK}>
          <ArrowLeft size={16} aria-hidden /> Back to admin
        </Link>
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-[var(--gui-ink-strong)]">Seasonal events</h1>
            <p className="mt-1 text-sm text-[var(--gui-muted)]">Club goals that come back every year on the same dates · target, weights, letter, what they unlock</p>
          </div>
          <Link href={`${SEASONAL}/new`} className={BUTTON_LINK} data-size="sm">
            <Plus size={16} aria-hidden /> New event
          </Link>
        </div>
        {rows === null ? (
          <Loading label="Getting the seasonal events…" />
        ) : rows.length === 0 ? (
          <Empty icon={<CalendarHeart size={32} />} title="No seasonal events yet">
            Add one and it comes back every year on its dates.
          </Empty>
        ) : (
          <Card style={{ padding: 0 }} className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[var(--gui-paper-warm)]">
                  {["Event", "Window (yearly)", "Status", "Target", "Brings"].map((h) => <th key={h} className={TH}>{h}</th>)}
                  <th className={TH}><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((g) => {
                  const c = goalCycle(g, now);
                  // The last cycle ended: the next one opens a year after it.
                  const next = c.start && c.start <= now ? new Date(new Date(c.start).setUTCFullYear(c.start.getUTCFullYear() + 1)) : c.start;
                  return (
                    <tr key={g.id} className="border-t-2 border-dashed border-[var(--gui-paper-edge)]">
                      <td className="px-4 py-3">
                        <span className="font-extrabold text-[var(--gui-ink-strong)]">{g.title}</span>
                        <div className="text-xs text-[var(--gui-muted)]">{g.slug}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-[var(--gui-ink)]">{day(c.start)} – {day(c.end)}</td>
                      <td className="px-4 py-3">
                        {!g.active ? <Badge>Inactive</Badge> : c.open ? <Badge tone="success">On until {day(c.end)}</Badge> : <Badge tone="info">Opens {day(next)}</Badge>}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-[var(--gui-ink)]">{g.target_points.toLocaleString()} points</td>
                      <td className="px-4 py-3 text-[var(--gui-ink-2)]">
                        {[g.event.decor && DECOR_SETS[g.event.decor], g.event.tourney && "fishing tourney", g.event.catches.length && `${g.event.catches.length} limited-time catches`, ...g.unlocks].filter(Boolean).join(" · ") || "—"}
                        {g.event.rewards.length ? <div className="mt-0.5 text-[var(--gui-ink)]"><b className="font-extrabold">Rewards:</b> {g.event.rewards.map(rewardName).join(", ")}</div> : null}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <Link href={`${SEASONAL}/${g.id}/edit`} className="mr-3 inline-flex items-center gap-1 font-bold text-[var(--gui-sage)] hover:underline"><Pencil size={14} aria-hidden /> Edit</Link>
                        <Link href={`/student/dashboard/admin/content/goals/${g.id}/history`} className="inline-flex items-center gap-1 font-bold text-[var(--gui-ink-2)] hover:underline"><History size={14} aria-hidden /> History</Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        )}
      </div>
    </AdminGate>
  );
}
