"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, History, Pencil, Plus } from "lucide-react";
import { AdminGate, thCls } from "@/components/portal/ProgressionAdminShared";
import { RESIDENT_ANCHORS, type ResidentAnchor } from "@/lib/content/residents";
import { ISLAND_PHASES } from "@/lib/game/islandTime";
import type { NPCPersona } from "@/lib/content/types";
import { createClient } from "@/lib/supabase/client";

// Residents roster (rows 122, 217, 218): every npc_personas row, inactive ones too.
export default function AdminResidentsPage() {
  const [rows, setRows] = useState<NPCPersona[] | null>(null);
  useEffect(() => {
    void createClient().from("npc_personas").select("*").order("slug").then(({ data }) => setRows((data ?? []) as NPCPersona[]));
  }, []);

  return (
    <AdminGate>
      <Link href="/student/dashboard/admin" className="inline-flex items-center gap-1 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] mb-2">
        <ArrowLeft size={12} /> Back to Admin
      </Link>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading font-bold text-[var(--color-text-primary)]">Residents</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">{rows?.length ?? 0} on the roster · post, tone, dialogue and where they stand through the day</p>
        </div>
        <Link href="/student/dashboard/admin/content/npcs/new" className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--color-accent-cyan)] text-[var(--color-bg)] text-xs uppercase tracking-wider rounded-md">
          <Plus size={14} /> New resident
        </Link>
      </div>
      {rows === null ? (
        <p className="text-center py-8 text-sm text-[var(--color-text-muted)] animate-pulse">Loading residents...</p>
      ) : (
        <div className="bg-[var(--color-bg-alt)] border border-[var(--glass-border)] rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--glass-border)]">{["Resident", "Post", "Tone", "Schedule", "Lines", "Active", ""].map((h) => <th key={h} className={thCls}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-[var(--glass-border)]/40 last:border-b-0">
                  <td className="px-4 py-3 text-[var(--color-text-primary)]">{r.display_name}<div className="text-xs text-[var(--color-accent-cyan)]">{r.slug}</div></td>
                  <td className="px-4 py-3 text-xs text-[var(--color-text-muted)]">{r.post?.replace("_", " ") ?? "—"}</td>
                  <td className="px-4 py-3 text-xs text-[var(--color-text-muted)]">{r.tone ?? "—"}</td>
                  <td className="px-4 py-3 text-xs text-[var(--color-text-muted)]">
                    {ISLAND_PHASES.filter((p) => r.schedule?.[p]).map((p) => `${p} · ${RESIDENT_ANCHORS[r.schedule![p] as ResidentAnchor]?.label ?? r.schedule![p]}`).join(", ") || "plaza"}
                  </td>
                  <td className="px-4 py-3 text-xs">{r.canned_dialogue?.length ?? 0}</td>
                  <td className="px-4 py-3 text-xs">{r.active ? "active" : "inactive"}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <Link href={`/student/dashboard/admin/content/npcs/${r.id}/edit`} className="inline-flex items-center gap-1 text-xs text-[var(--color-accent-cyan)] hover:underline mr-3"><Pencil size={12} /> Edit</Link>
                    <Link href={`/student/dashboard/admin/content/npcs/${r.id}/history`} className="inline-flex items-center gap-1 text-xs text-[var(--color-text-muted)] hover:underline"><History size={12} /> History</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminGate>
  );
}
