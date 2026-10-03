"use client";

import { AdminGate } from "@/components/portal/ProgressionAdminShared";
import ShopEditor from "@/components/portal/ShopEditor";

const PAGE = "mx-auto w-full max-w-6xl px-5 pt-6 pb-16 sm:px-8";

export default function NewShopItemPage() {
  return (
    <AdminGate>
      <div className={PAGE}>
        <ShopEditor mode="new" />
      </div>
    </AdminGate>
  );
}
