"use client";

import { use } from "react";
import { AdminGate, useContentRow } from "@/components/portal/ProgressionAdminShared";
import PaletteEditor from "@/components/portal/PaletteEditor";
import type { SeasonalPalette } from "@/lib/content/types";
import { ErrorNote, Loading } from "@/components/gui";

const PAGE = "mx-auto w-full max-w-6xl px-5 pt-6 pb-16 sm:px-8";

export default function EditPalettePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { row, loading, error } = useContentRow<SeasonalPalette>("seasonal_palettes", id);
  return (
    <AdminGate>
      <div className={PAGE}>
        {loading ? <Loading label="Opening the palette…" /> : null}
        {!loading && (error || !row) ? <ErrorNote>This palette didn’t load ({error ?? "Palette not found"}).</ErrorNote> : null}
        {row ? <PaletteEditor mode="edit" rowId={id} initial={row} /> : null}
      </div>
    </AdminGate>
  );
}
