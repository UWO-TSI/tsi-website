"use client";

import { use } from "react";
import { AdminGate, useContentRow } from "@/components/portal/ProgressionAdminShared";
import ClubGoalEditor from "@/components/portal/ClubGoalEditor";
import { normalizeGoal } from "@/lib/progression/goals";
import { ErrorNote, Loading } from "@/components/gui";

const PAGE = "mx-auto w-full max-w-6xl px-5 pt-6 pb-16 sm:px-8";

export default function EditSeasonalEventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { row, loading, error } = useContentRow<Record<string, unknown>>("club_goals", id);
  return (
    <AdminGate>
      <div className={PAGE}>
        {loading ? <Loading label="Opening the event…" /> : null}
        {!loading && (error || !row) ? <ErrorNote>This event didn’t load ({error ?? "Event not found"}).</ErrorNote> : null}
        {row ? <ClubGoalEditor mode="edit" initial={normalizeGoal(row)} seasonal /> : null}
      </div>
    </AdminGate>
  );
}
