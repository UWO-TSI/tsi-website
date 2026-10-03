"use client";

import { use } from "react";
import { AdminGate, useContentRow } from "@/components/portal/ProgressionAdminShared";
import NPCEditor from "@/components/portal/NPCEditor";
import type { NPCPersona } from "@/lib/content/types";

export default function EditNPCPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { row, loading, error } = useContentRow<NPCPersona>("npc_personas", id);
  return (
    <AdminGate>
      {loading ? <p className="text-center py-8 text-sm text-[var(--color-text-muted)] animate-pulse">Loading...</p> : null}
      {!loading && (error || !row) ? <p className="text-center py-8 text-sm text-[var(--gui-danger)]">{error ?? "NPC not found"}</p> : null}
      {row ? <NPCEditor mode="edit" rowId={id} initial={row} /> : null}
    </AdminGate>
  );
}
