"use client";

import { use } from "react";
import { AdminGate, useContentRow } from "@/components/portal/ProgressionAdminShared";
import ShopEditor from "@/components/portal/ShopEditor";
import type { ShopItem } from "@/lib/content/types";

export default function EditShopItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { row, loading, error } = useContentRow<ShopItem>("shop_items", id);
  return (
    <AdminGate>
      {loading ? <p className="text-center py-8 font-mono text-sm text-[var(--color-text-muted)] animate-pulse">Loading...</p> : null}
      {!loading && (error || !row) ? <p className="text-center py-8 font-mono text-sm text-red-400">{error ?? "Shop item not found"}</p> : null}
      {row ? <ShopEditor mode="edit" rowId={id} initial={row} /> : null}
    </AdminGate>
  );
}
