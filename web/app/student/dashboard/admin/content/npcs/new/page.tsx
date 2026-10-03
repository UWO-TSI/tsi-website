"use client";

import { AdminGate } from "@/components/portal/ProgressionAdminShared";
import NPCEditor from "@/components/portal/NPCEditor";

const PAGE = "mx-auto w-full max-w-6xl px-5 pt-6 pb-16 sm:px-8";

export default function NewNPCPage() {
  return (
    <AdminGate>
      <div className={PAGE}>
        <NPCEditor mode="new" />
      </div>
    </AdminGate>
  );
}
