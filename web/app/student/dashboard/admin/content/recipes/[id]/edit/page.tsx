"use client";

import { use } from "react";
import { AdminGate, useContentRow } from "@/components/portal/ProgressionAdminShared";
import RecipeEditor, { type RecipeRow } from "@/components/portal/RecipeEditor";

export default function EditRecipePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { row, loading, error } = useContentRow<RecipeRow>("crafting_recipes", id);
  return (
    <AdminGate>
      {loading ? <p className="text-center py-8 text-sm text-[var(--color-text-muted)] animate-pulse">Loading...</p> : null}
      {!loading && (error || !row) ? <p className="text-center py-8 text-sm text-[var(--gui-danger)]">{error ?? "Recipe not found"}</p> : null}
      {row ? <RecipeEditor mode="edit" initial={row} /> : null}
    </AdminGate>
  );
}
