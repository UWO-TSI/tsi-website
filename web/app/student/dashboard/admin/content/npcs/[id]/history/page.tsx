"use client";

import { use } from "react";
import { AdminGate, useContentRow } from "@/components/portal/ProgressionAdminShared";
import VersionHistory from "@/components/portal/VersionHistory";

export default function NPCHistoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { row, loading } = useContentRow<{ display_name?: string }>("npc_personas", id);
  return (
    <AdminGate>
      {loading ? <p className="text-center py-8 font-mono text-sm text-[var(--color-text-muted)] animate-pulse">Loading...</p> : <VersionHistory tableName="npc_personas" rowId={id} displayName={row?.display_name ?? "NPC"} />}
    </AdminGate>
  );
}
