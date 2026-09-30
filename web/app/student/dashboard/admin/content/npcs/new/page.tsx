"use client";

import { AdminGate } from "@/components/portal/ProgressionAdminShared";
import NPCEditor from "@/components/portal/NPCEditor";

export default function NewNPCPage() {
  return (
    <AdminGate>
      <NPCEditor mode="new" />
    </AdminGate>
  );
}
