"use client";

import { AdminGate } from "@/components/portal/ProgressionAdminShared";
import ClubGoalEditor from "@/components/portal/ClubGoalEditor";

export default function NewGoalPage() {
  return (
    <AdminGate>
      <ClubGoalEditor mode="new" />
    </AdminGate>
  );
}
