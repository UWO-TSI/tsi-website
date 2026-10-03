"use client";

import { use } from "react";
import { AdminGate, useContentRow } from "@/components/portal/ProgressionAdminShared";
import PaletteEditor from "@/components/portal/PaletteEditor";
import type { SeasonalPalette } from "@/lib/content/types";

export default function EditPalettePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { row, loading, error } = useContentRow<SeasonalPalette>("seasonal_palettes", id);
  return (
    <AdminGate>
      {loading ? <p className="text-center py-8 text-sm text-[var(--color-text-muted)] animate-pulse">Loading...</p> : null}
      {!loading && (error || !row) ? <p className="text-center py-8 text-sm text-[var(--gui-danger)]">{error ?? "Palette not found"}</p> : null}
      {row ? <PaletteEditor mode="edit" rowId={id} initial={row} /> : null}
    </AdminGate>
  );
}
