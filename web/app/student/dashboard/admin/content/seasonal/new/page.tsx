"use client";

import { AdminGate } from "@/components/portal/ProgressionAdminShared";
import ClubGoalEditor from "@/components/portal/ClubGoalEditor";

export default function NewSeasonalEventPage() {
  return (
    <AdminGate>
      <ClubGoalEditor mode="new" seasonal />
    </AdminGate>
  );
}
