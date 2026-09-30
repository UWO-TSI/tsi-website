"use client";

import { use } from "react";
import { AdminGate, useContentRow } from "@/components/portal/ProgressionAdminShared";
import VersionHistory from "@/components/portal/VersionHistory";

export default function ShopItemHistoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { row, loading } = useContentRow<{ display_name?: string }>("shop_items", id);
  return (
    <AdminGate>
      {loading ? <p className="text-center py-8 font-mono text-sm text-[var(--color-text-muted)] animate-pulse">Loading...</p> : <VersionHistory tableName="shop_items" rowId={id} displayName={row?.display_name ?? "Shop Item"} />}
    </AdminGate>
  );
}
