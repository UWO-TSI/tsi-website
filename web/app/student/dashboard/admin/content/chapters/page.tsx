"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, BookOpen, History, Pencil, Plus } from "lucide-react";
import { AdminGate, buttonLinkCls } from "@/components/portal/ProgressionAdminShared";
import { Badge, Card, Empty, ErrorNote, Loading } from "@/components/gui";
import { createClient } from "@/lib/supabase/client";
import type { QuestChapter } from "@/lib/progression/types";

const PAGE = "mx-auto w-full max-w-6xl px-5 pt-6 pb-16 sm:px-8";
const BACK = "mb-2 inline-flex items-center gap-1.5 text-sm font-bold text-[var(--gui-ink-2)] hover:text-[var(--gui-ink-strong)]";
/** A link in the kit's small sage button. */
const BUTTON_LINK = buttonLinkCls;
const TH = "px-4 py-3 text-left text-xs font-extrabold whitespace-nowrap text-[var(--gui-ink-2)]";

export default function AdminChaptersPage() {
  const [rows, setRows] = useState<QuestChapter[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await createClient().from("quest_chapters").select("*").order("position");
      if (cancelled) return;
      setRows((data ?? []) as QuestChapter[]);
      setError(error ? "The chapters table isn’t there yet (is migration 029 applied?)." : null);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <AdminGate>
      <div className={PAGE}>
        <Link href="/student/dashboard/admin" className={BACK}>
          <ArrowLeft size={16} aria-hidden /> Back to admin
        </Link>
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-[var(--gui-ink-strong)]">Main quest</h1>
            <p className="mt-1 text-sm text-[var(--gui-muted)]">{rows?.length ?? 0} chapters, in the order members play them</p>
          </div>
          <Link href="/student/dashboard/admin/content/chapters/new" className={BUTTON_LINK} data-size="sm">
            <Plus size={16} aria-hidden /> New chapter
          </Link>
        </div>
        {error ? <ErrorNote className="mb-4">{error}</ErrorNote> : null}
        {rows === null ? (
          <Loading label="Getting the chapters…" />
        ) : rows.length === 0 ? (
          error ? null : (
            <Empty icon={<BookOpen size={32} />} title="No chapters yet">
              Add the first one to start the main quest.
            </Empty>
          )
        ) : (
          <Card style={{ padding: 0 }} className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[var(--gui-paper-warm)]">
                  {["#", "Title", "Requirement", "Goal", "Opens", "Can skip", "Status"].map((h) => <th key={h} className={TH}>{h}</th>)}
                  <th className={TH}><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id} className="border-t-2 border-dashed border-[var(--gui-paper-edge)]">
                    <td className="px-4 py-3 text-[var(--gui-ink-2)]">{c.position}</td>
                    <td className="px-4 py-3">
                      <span className="font-extrabold text-[var(--gui-ink-strong)]">{c.title}</span>
                      <div className="text-xs text-[var(--gui-muted)]">{c.slug}</div>
                    </td>
                    <td className="px-4 py-3 text-[var(--gui-ink-2)]">{c.requirement}</td>
                    <td className="px-4 py-3 text-[var(--gui-ink-2)]">{c.goal_slug ?? "—"}</td>
                    <td className="px-4 py-3 text-[var(--gui-ink-2)]">{(c.unlocks_regions ?? []).join(", ") || "—"}</td>
                    <td className="px-4 py-3 text-[var(--gui-ink-2)]">{c.skippable_max_tier ? `T1 to T${c.skippable_max_tier}` : "No"}</td>
                    <td className="px-4 py-3">{c.active ? <Badge tone="success">Active</Badge> : <Badge>Inactive</Badge>}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <Link href={`/student/dashboard/admin/content/chapters/${c.id}/edit`} className="mr-3 inline-flex items-center gap-1 font-bold text-[var(--gui-sage)] hover:underline"><Pencil size={14} aria-hidden /> Edit</Link>
                      <Link href={`/student/dashboard/admin/content/chapters/${c.id}/history`} className="inline-flex items-center gap-1 font-bold text-[var(--gui-ink-2)] hover:underline"><History size={14} aria-hidden /> History</Link>
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
