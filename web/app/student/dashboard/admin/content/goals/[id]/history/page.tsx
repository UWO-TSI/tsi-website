"use client";

import { use } from "react";
import { AdminGate, useContentRow } from "@/components/portal/ProgressionAdminShared";
import VersionHistory from "@/components/portal/VersionHistory";

const PAGE = "mx-auto w-full max-w-6xl px-5 pt-6 pb-16 sm:px-8";

export default function GoalHistoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { row } = useContentRow<{ title?: string }>("club_goals", id);
  return (
    <AdminGate>
      <div className={PAGE}>
        <VersionHistory tableName="club_goals" rowId={id} displayName={row?.title ?? "Goal"} />
      </div>
    </AdminGate>
  );
}
