"use client";

import { use } from "react";
import { AdminGate } from "@/components/portal/ProgressionAdminShared";
import VersionHistory from "@/components/portal/VersionHistory";

const PAGE = "mx-auto w-full max-w-6xl px-5 pt-6 pb-16 sm:px-8";

export default function TraditionHistoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <AdminGate>
      <div className={PAGE}>
        <VersionHistory tableName="traditions" rowId={id} displayName={id} />
      </div>
    </AdminGate>
  );
}
