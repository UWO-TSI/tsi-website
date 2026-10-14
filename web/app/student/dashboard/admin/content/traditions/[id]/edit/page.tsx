"use client";

import { use } from "react";
import { AdminGate, useContentRow } from "@/components/portal/ProgressionAdminShared";
import TraditionEditor, { type TraditionRow } from "@/components/portal/TraditionEditor";
import { ErrorNote, Loading } from "@/components/gui";

const PAGE = "mx-auto w-full max-w-6xl px-5 pt-6 pb-16 sm:px-8";

export default function EditTraditionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { row, loading, error } = useContentRow<TraditionRow>("traditions", id);
  return (
    <AdminGate>
      <div className={PAGE}>
        {loading ? <Loading label="Opening the tradition…" /> : null}
        {!loading && (error || !row) ? <ErrorNote>This tradition didn’t load ({error ?? "Tradition not found"}).</ErrorNote> : null}
        {row ? <TraditionEditor mode="edit" initial={row} /> : null}
      </div>
    </AdminGate>
  );
}
