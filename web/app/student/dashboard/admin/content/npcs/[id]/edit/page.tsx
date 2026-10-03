"use client";

import { use } from "react";
import { AdminGate, useContentRow } from "@/components/portal/ProgressionAdminShared";
import NPCEditor from "@/components/portal/NPCEditor";
import type { NPCPersona } from "@/lib/content/types";
import { ErrorNote, Loading } from "@/components/gui";

const PAGE = "mx-auto w-full max-w-6xl px-5 pt-6 pb-16 sm:px-8";

export default function EditNPCPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { row, loading, error } = useContentRow<NPCPersona>("npc_personas", id);
  return (
    <AdminGate>
      <div className={PAGE}>
        {loading ? <Loading label="Opening the resident…" /> : null}
        {!loading && (error || !row) ? <ErrorNote>This resident didn’t load ({error ?? "Resident not found"}).</ErrorNote> : null}
        {row ? <NPCEditor mode="edit" rowId={id} initial={row} /> : null}
      </div>
    </AdminGate>
  );
}
