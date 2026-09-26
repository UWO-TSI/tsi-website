"use client";

import { use } from "react";
import { AdminGate, useContentRow } from "@/components/portal/ProgressionAdminShared";
import VersionHistory from "@/components/portal/VersionHistory";

export default function ChapterHistoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { row } = useContentRow<{ title?: string }>("quest_chapters", id);
  return (
    <AdminGate>
      <VersionHistory tableName="quest_chapters" rowId={id} displayName={row?.title ?? "Chapter"} />
    </AdminGate>
  );
}
