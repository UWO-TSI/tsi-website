"use client";

import { use } from "react";
import { AdminGate, useContentRow } from "@/components/portal/ProgressionAdminShared";
import ClubGoalEditor from "@/components/portal/ClubGoalEditor";
import { normalizeGoal } from "@/lib/progression/goals";

export default function EditSeasonalEventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { row, loading, error } = useContentRow<Record<string, unknown>>("club_goals", id);
  return (
    <AdminGate>
      {loading ? <p className="text-center py-8 text-sm text-[var(--color-text-muted)] animate-pulse">Loading...</p> : null}
      {!loading && (error || !row) ? <p className="text-center py-8 text-sm text-[var(--gui-danger)]">{error ?? "Event not found"}</p> : null}
      {row ? <ClubGoalEditor mode="edit" initial={normalizeGoal(row)} seasonal /> : null}
    </AdminGate>
  );
}
