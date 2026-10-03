"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, History, Pencil, Plus } from "lucide-react";
import { AdminGate, thCls } from "@/components/portal/ProgressionAdminShared";
import { createClient } from "@/lib/supabase/client";
import type { QuestChapter } from "@/lib/progression/types";

export default function AdminChaptersPage() {
  const [rows, setRows] = useState<QuestChapter[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await createClient().from("quest_chapters").select("*").order("position");
      if (cancelled) return;
      setRows((data ?? []) as QuestChapter[]);
      setError(error ? "quest_chapters is not available (migration 029 not applied?)" : null);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <AdminGate>
      <Link href="/student/dashboard/admin" className="inline-flex items-center gap-1 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] mb-2">
        <ArrowLeft size={12} /> Back to Admin
      </Link>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading font-bold text-[var(--color-text-primary)]">Main Quest</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">{rows?.length ?? 0} chapters · quest_chapters</p>
        </div>
        <Link href="/student/dashboard/admin/content/chapters/new" className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--color-accent-cyan)] text-[var(--color-bg)] text-xs uppercase tracking-wider rounded-md">
          <Plus size={14} /> New Chapter
        </Link>
      </div>
      {error ? <p className="mb-4 text-xs text-[var(--gui-danger)]">{error}</p> : null}
      {rows === null ? (
        <p className="text-center py-8 text-sm text-[var(--color-text-muted)] animate-pulse">Loading chapters...</p>
      ) : (
        <div className="bg-[var(--color-bg-alt)] border border-[var(--glass-border)] rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--glass-border)]">
                {["#", "Title", "Requirement", "Goal", "Opens", "Skip", "Active", ""].map((h) => <th key={h} className={thCls}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} className="border-b border-[var(--glass-border)]/40 last:border-b-0">
                  <td className="px-4 py-3 text-xs">{c.position}</td>
                  <td className="px-4 py-3 text-[var(--color-text-primary)]">{c.title}<div className="text-xs text-[var(--color-accent-cyan)]">{c.slug}</div></td>
                  <td className="px-4 py-3 text-xs text-[var(--color-text-muted)]">{c.requirement}</td>
                  <td className="px-4 py-3 text-xs text-[var(--color-text-muted)]">{c.goal_slug ?? "—"}</td>
                  <td className="px-4 py-3 text-xs text-[var(--color-text-muted)]">{(c.unlocks_regions ?? []).join(", ") || "—"}</td>
                  <td className="px-4 py-3 text-xs text-[var(--color-text-muted)]">{c.skippable_max_tier ? `T1–T${c.skippable_max_tier}` : "no"}</td>
                  <td className="px-4 py-3 text-xs">{c.active ? "active" : "inactive"}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <Link href={`/student/dashboard/admin/content/chapters/${c.id}/edit`} className="inline-flex items-center gap-1 text-xs text-[var(--color-accent-cyan)] hover:underline mr-3"><Pencil size={12} /> Edit</Link>
                    <Link href={`/student/dashboard/admin/content/chapters/${c.id}/history`} className="inline-flex items-center gap-1 text-xs text-[var(--color-text-muted)] hover:underline"><History size={12} /> History</Link>
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
