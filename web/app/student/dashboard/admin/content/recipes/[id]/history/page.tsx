"use client";

import { use } from "react";
import { AdminGate } from "@/components/portal/ProgressionAdminShared";
import VersionHistory from "@/components/portal/VersionHistory";

export default function RecipeHistoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <AdminGate>
      <VersionHistory tableName="crafting_recipes" rowId={id} displayName={id} />
    </AdminGate>
  );
}
