"use client";

import { use } from "react";
import { AdminGate, useContentRow, useGoalSlugs } from "@/components/portal/ProgressionAdminShared";
import QuestChapterEditor from "@/components/portal/QuestChapterEditor";
import { normalizeChapter } from "@/lib/progression/chapters";
import { ErrorNote, Loading } from "@/components/gui";

const PAGE = "mx-auto w-full max-w-6xl px-5 pt-6 pb-16 sm:px-8";

export default function EditChapterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { row, loading, error } = useContentRow<Record<string, unknown>>("quest_chapters", id);
  const goalSlugs = useGoalSlugs();
  return (
    <AdminGate>
      <div className={PAGE}>
        {loading ? <Loading label="Opening the chapter…" /> : null}
        {!loading && (error || !row) ? <ErrorNote>This chapter didn’t load ({error ?? "Chapter not found"}).</ErrorNote> : null}
        {row ? <QuestChapterEditor mode="edit" initial={normalizeChapter(row)} goalSlugs={goalSlugs} /> : null}
      </div>
    </AdminGate>
  );
}
