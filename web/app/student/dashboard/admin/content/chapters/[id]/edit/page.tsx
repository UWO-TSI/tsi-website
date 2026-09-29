"use client";

import { use } from "react";
import { AdminGate, useContentRow, useGoalSlugs } from "@/components/portal/ProgressionAdminShared";
import QuestChapterEditor from "@/components/portal/QuestChapterEditor";
import { normalizeChapter } from "@/lib/progression/chapters";

export default function EditChapterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { row, loading, error } = useContentRow<Record<string, unknown>>("quest_chapters", id);
  const goalSlugs = useGoalSlugs();
  return (
    <AdminGate>
      {loading ? <p className="text-center py-8 font-mono text-sm text-[var(--color-text-muted)] animate-pulse">Loading...</p> : null}
      {!loading && (error || !row) ? <p className="text-center py-8 font-mono text-sm text-red-400">{error ?? "Chapter not found"}</p> : null}
      {row ? <QuestChapterEditor mode="edit" initial={normalizeChapter(row)} goalSlugs={goalSlugs} /> : null}
    </AdminGate>
  );
}
