"use client";

import { AdminGate } from "@/components/portal/ProgressionAdminShared";
import PaletteEditor from "@/components/portal/PaletteEditor";

const PAGE = "mx-auto w-full max-w-6xl px-5 pt-6 pb-16 sm:px-8";

export default function NewPalettePage() {
  return (
    <AdminGate>
      <div className={PAGE}>
        <PaletteEditor mode="new" />
      </div>
    </AdminGate>
  );
}
