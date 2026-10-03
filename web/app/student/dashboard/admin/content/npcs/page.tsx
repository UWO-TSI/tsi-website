"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, History, Pencil, Plus, UserRound } from "lucide-react";
import { AdminGate, buttonLinkCls } from "@/components/portal/ProgressionAdminShared";
import { Badge, Card, Empty, Loading } from "@/components/gui";
import { RESIDENT_ANCHORS, type ResidentAnchor } from "@/lib/content/residents";
import { ISLAND_PHASES } from "@/lib/game/islandTime";
import type { NPCPersona } from "@/lib/content/types";
import { createClient } from "@/lib/supabase/client";

const PAGE = "mx-auto w-full max-w-6xl px-5 pt-6 pb-16 sm:px-8";
const BACK = "mb-2 inline-flex items-center gap-1.5 text-sm font-bold text-[var(--gui-ink-2)] hover:text-[var(--gui-ink-strong)]";
/** A link in the kit's small sage button. */
const BUTTON_LINK = buttonLinkCls;
const TH = "px-4 py-3 text-left text-xs font-extrabold whitespace-nowrap text-[var(--gui-ink-2)]";

// Residents roster (rows 122, 217, 218): every npc_personas row, inactive ones too.
export default function AdminResidentsPage() {
  const [rows, setRows] = useState<NPCPersona[] | null>(null);
  useEffect(() => {
    void createClient().from("npc_personas").select("*").order("slug").then(({ data }) => setRows((data ?? []) as NPCPersona[]));
  }, []);

  return (
    <AdminGate>
      <div className={PAGE}>
        <Link href="/student/dashboard/admin" className={BACK}>
          <ArrowLeft size={16} aria-hidden /> Back to admin
        </Link>
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-[var(--gui-ink-strong)]">Residents</h1>
            <p className="mt-1 text-sm text-[var(--gui-muted)]">{rows?.length ?? 0} on the roster · post, tone, dialogue and where they stand through the day</p>
          </div>
          <Link href="/student/dashboard/admin/content/npcs/new" className={BUTTON_LINK} data-size="sm">
            <Plus size={16} aria-hidden /> New resident
          </Link>
        </div>
        {rows === null ? (
          <Loading label="Getting the residents…" />
        ) : rows.length === 0 ? (
          <Empty icon={<UserRound size={32} />} title="No residents yet">
            Add the first one and they turn up on the island.
          </Empty>
        ) : (
          <Card style={{ padding: 0 }} className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[var(--gui-paper-warm)]">
                  {["Resident", "Post", "Tone", "Schedule", "Lines", "Status"].map((h) => <th key={h} className={TH}>{h}</th>)}
                  <th className={TH}><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t-2 border-dashed border-[var(--gui-paper-edge)]">
                    <td className="px-4 py-3">
                      <span className="font-extrabold text-[var(--gui-ink-strong)]">{r.display_name}</span>
                      <div className="text-xs text-[var(--gui-muted)]">{r.slug}</div>
                    </td>
                    <td className="px-4 py-3 text-[var(--gui-ink-2)]">{r.post?.replace("_", " ") ?? "—"}</td>
                    <td className="px-4 py-3 text-[var(--gui-ink-2)]">{r.tone ?? "—"}</td>
                    <td className="px-4 py-3 text-[var(--gui-ink-2)]">
                      {ISLAND_PHASES.filter((p) => r.schedule?.[p]).map((p) => `${p} · ${RESIDENT_ANCHORS[r.schedule![p] as ResidentAnchor]?.label ?? r.schedule![p]}`).join(", ") || "plaza"}
                    </td>
                    <td className="px-4 py-3 text-[var(--gui-ink-2)]">{r.canned_dialogue?.length ?? 0}</td>
                    <td className="px-4 py-3">{r.active ? <Badge tone="success">Active</Badge> : <Badge>Inactive</Badge>}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <Link href={`/student/dashboard/admin/content/npcs/${r.id}/edit`} className="mr-3 inline-flex items-center gap-1 font-bold text-[var(--gui-sage)] hover:underline"><Pencil size={14} aria-hidden /> Edit</Link>
                      <Link href={`/student/dashboard/admin/content/npcs/${r.id}/history`} className="inline-flex items-center gap-1 font-bold text-[var(--gui-ink-2)] hover:underline"><History size={14} aria-hidden /> History</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </div>
    </AdminGate>
  );
}
