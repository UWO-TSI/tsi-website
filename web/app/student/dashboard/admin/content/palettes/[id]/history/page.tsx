"use client";

import { use } from "react";
import { AdminGate, useContentRow } from "@/components/portal/ProgressionAdminShared";
import VersionHistory from "@/components/portal/VersionHistory";

export default function PaletteHistoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { row, loading } = useContentRow<{ display_name?: string }>("seasonal_palettes", id);
  return (
    <AdminGate>
      {loading ? <p className="text-center py-8 text-sm text-[var(--color-text-muted)] animate-pulse">Loading...</p> : <VersionHistory tableName="seasonal_palettes" rowId={id} displayName={row?.display_name ?? "Palette"} />}
    </AdminGate>
  );
}
