"use client";

import { use } from "react";
import { AdminGate, useContentRow } from "@/components/portal/ProgressionAdminShared";
import EmoteEditor from "@/components/portal/EmoteEditor";
import type { EmoteType } from "@/lib/content/types";

export default function EditEmotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { row, loading, error } = useContentRow<EmoteType>("emote_types", id);
  return (
    <AdminGate>
      {loading ? <p className="text-center py-8 font-mono text-sm text-[var(--color-text-muted)] animate-pulse">Loading...</p> : null}
      {!loading && (error || !row) ? <p className="text-center py-8 font-mono text-sm text-red-400">{error ?? "Emote not found"}</p> : null}
      {row ? <EmoteEditor mode="edit" rowId={id} initial={row} /> : null}
    </AdminGate>
  );
}
