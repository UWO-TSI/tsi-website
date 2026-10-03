"use client";

import { AdminGate } from "@/components/portal/ProgressionAdminShared";
import ClubGoalEditor from "@/components/portal/ClubGoalEditor";

const PAGE = "mx-auto w-full max-w-6xl px-5 pt-6 pb-16 sm:px-8";

export default function NewSeasonalEventPage() {
  return (
    <AdminGate>
      <div className={PAGE}>
        <ClubGoalEditor mode="new" seasonal />
      </div>
    </AdminGate>
  );
}
