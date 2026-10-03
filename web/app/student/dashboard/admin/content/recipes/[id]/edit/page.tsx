"use client";

import { use } from "react";
import { AdminGate, useContentRow } from "@/components/portal/ProgressionAdminShared";
import RecipeEditor, { type RecipeRow } from "@/components/portal/RecipeEditor";
import { ErrorNote, Loading } from "@/components/gui";

const PAGE = "mx-auto w-full max-w-6xl px-5 pt-6 pb-16 sm:px-8";

export default function EditRecipePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { row, loading, error } = useContentRow<RecipeRow>("crafting_recipes", id);
  return (
    <AdminGate>
      <div className={PAGE}>
        {loading ? <Loading label="Opening the recipe…" /> : null}
        {!loading && (error || !row) ? <ErrorNote>This recipe didn’t load ({error ?? "Recipe not found"}).</ErrorNote> : null}
        {row ? <RecipeEditor mode="edit" initial={row} /> : null}
      </div>
    </AdminGate>
  );
}
