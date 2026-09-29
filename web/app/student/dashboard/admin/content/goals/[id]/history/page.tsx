"use client";

import { use } from "react";
import { AdminGate, useContentRow } from "@/components/portal/ProgressionAdminShared";
import VersionHistory from "@/components/portal/VersionHistory";

export default function GoalHistoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { row } = useContentRow<{ title?: string }>("club_goals", id);
  return (
    <AdminGate>
      <VersionHistory tableName="club_goals" rowId={id} displayName={row?.title ?? "Goal"} />
    </AdminGate>
  );
}
