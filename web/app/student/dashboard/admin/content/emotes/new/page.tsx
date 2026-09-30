"use client";

import { AdminGate } from "@/components/portal/ProgressionAdminShared";
import EmoteEditor from "@/components/portal/EmoteEditor";

export default function NewEmotePage() {
  return (
    <AdminGate>
      <EmoteEditor mode="new" />
    </AdminGate>
  );
}
