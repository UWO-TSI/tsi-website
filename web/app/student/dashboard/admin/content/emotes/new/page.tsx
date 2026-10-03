"use client";

import { AdminGate } from "@/components/portal/ProgressionAdminShared";
import EmoteEditor from "@/components/portal/EmoteEditor";

const PAGE = "mx-auto w-full max-w-6xl px-5 pt-6 pb-16 sm:px-8";

export default function NewEmotePage() {
  return (
    <AdminGate>
      <div className={PAGE}>
        <EmoteEditor mode="new" />
      </div>
    </AdminGate>
  );
}
