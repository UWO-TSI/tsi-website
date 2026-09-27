"use client";

import { AdminGate } from "@/components/portal/ProgressionAdminShared";
import RecipeEditor from "@/components/portal/RecipeEditor";

export default function NewRecipePage() {
  return (
    <AdminGate>
      <RecipeEditor mode="new" />
    </AdminGate>
  );
}
