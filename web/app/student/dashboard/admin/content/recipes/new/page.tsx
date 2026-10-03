"use client";

import { AdminGate } from "@/components/portal/ProgressionAdminShared";
import RecipeEditor from "@/components/portal/RecipeEditor";

const PAGE = "mx-auto w-full max-w-6xl px-5 pt-6 pb-16 sm:px-8";

export default function NewRecipePage() {
  return (
    <AdminGate>
      <div className={PAGE}>
        <RecipeEditor mode="new" />
      </div>
    </AdminGate>
  );
}
