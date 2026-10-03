"use client";

import { use } from "react";
import { AdminGate, useContentRow } from "@/components/portal/ProgressionAdminShared";
import ShopEditor from "@/components/portal/ShopEditor";
import type { ShopItem } from "@/lib/content/types";
import { ErrorNote, Loading } from "@/components/gui";

const PAGE = "mx-auto w-full max-w-6xl px-5 pt-6 pb-16 sm:px-8";

export default function EditShopItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { row, loading, error } = useContentRow<ShopItem>("shop_items", id);
  return (
    <AdminGate>
      <div className={PAGE}>
        {loading ? <Loading label="Opening the shop item…" /> : null}
        {!loading && (error || !row) ? <ErrorNote>This shop item didn’t load ({error ?? "Shop item not found"}).</ErrorNote> : null}
        {row ? <ShopEditor mode="edit" rowId={id} initial={row} /> : null}
      </div>
    </AdminGate>
  );
}
