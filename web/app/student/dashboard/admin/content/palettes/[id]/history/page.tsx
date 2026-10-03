"use client";

import { use } from "react";
import { AdminGate, useContentRow } from "@/components/portal/ProgressionAdminShared";
import VersionHistory from "@/components/portal/VersionHistory";
import { Loading } from "@/components/gui";

const PAGE = "mx-auto w-full max-w-6xl px-5 pt-6 pb-16 sm:px-8";

export default function PaletteHistoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { row, loading } = useContentRow<{ display_name?: string }>("seasonal_palettes", id);
  return (
    <AdminGate>
      <div className={PAGE}>
        {loading ? <Loading label="Opening the history…" /> : <VersionHistory tableName="seasonal_palettes" rowId={id} displayName={row?.display_name ?? "Palette"} />}
      </div>
    </AdminGate>
  );
}
