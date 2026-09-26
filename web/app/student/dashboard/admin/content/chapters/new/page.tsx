"use client";

import { AdminGate, useGoalSlugs } from "@/components/portal/ProgressionAdminShared";
import QuestChapterEditor from "@/components/portal/QuestChapterEditor";

export default function NewChapterPage() {
  const goalSlugs = useGoalSlugs();
  return (
    <AdminGate>
      <QuestChapterEditor mode="new" goalSlugs={goalSlugs} />
    </AdminGate>
  );
}
