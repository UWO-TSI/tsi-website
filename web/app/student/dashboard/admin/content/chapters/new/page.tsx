"use client";

import { AdminGate, useGoalSlugs } from "@/components/portal/ProgressionAdminShared";
import QuestChapterEditor from "@/components/portal/QuestChapterEditor";

const PAGE = "mx-auto w-full max-w-6xl px-5 pt-6 pb-16 sm:px-8";

export default function NewChapterPage() {
  const goalSlugs = useGoalSlugs();
  return (
    <AdminGate>
      <div className={PAGE}>
        <QuestChapterEditor mode="new" goalSlugs={goalSlugs} />
      </div>
    </AdminGate>
  );
}
