"use client";

import { use } from "react";
import { AdminGate, useContentRow } from "@/components/portal/ProgressionAdminShared";
import EmoteEditor from "@/components/portal/EmoteEditor";
import type { EmoteType } from "@/lib/content/types";
import { ErrorNote, Loading } from "@/components/gui";

const PAGE = "mx-auto w-full max-w-6xl px-5 pt-6 pb-16 sm:px-8";

export default function EditEmotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { row, loading, error } = useContentRow<EmoteType>("emote_types", id);
  return (
    <AdminGate>
      <div className={PAGE}>
        {loading ? <Loading label="Opening the emote…" /> : null}
        {!loading && (error || !row) ? <ErrorNote>This emote didn’t load ({error ?? "Emote not found"}).</ErrorNote> : null}
        {row ? <EmoteEditor mode="edit" rowId={id} initial={row} /> : null}
      </div>
    </AdminGate>
  );
}
