"use client";

import { AdminGate } from "@/components/portal/ProgressionAdminShared";
import PaletteEditor from "@/components/portal/PaletteEditor";

export default function NewPalettePage() {
  return (
    <AdminGate>
      <PaletteEditor mode="new" />
    </AdminGate>
  );
}
