"use client";

import { use } from "react";
import { AdminGate, useContentRow } from "@/components/portal/ProgressionAdminShared";
import VersionHistory from "@/components/portal/VersionHistory";
import { Loading } from "@/components/gui";

const PAGE = "mx-auto w-full max-w-6xl px-5 pt-6 pb-16 sm:px-8";

export default function NPCHistoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { row, loading } = useContentRow<{ display_name?: string }>("npc_personas", id);
  return (
    <AdminGate>
      <div className={PAGE}>
        {loading ? <Loading label="Opening the history…" /> : <VersionHistory tableName="npc_personas" rowId={id} displayName={row?.display_name ?? "Resident"} />}
      </div>
    </AdminGate>
  );
}
