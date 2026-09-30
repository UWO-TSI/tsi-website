"use client";

import { AdminGate } from "@/components/portal/ProgressionAdminShared";
import ShopEditor from "@/components/portal/ShopEditor";

export default function NewShopItemPage() {
  return (
    <AdminGate>
      <ShopEditor mode="new" />
    </AdminGate>
  );
}
