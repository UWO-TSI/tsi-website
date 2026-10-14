"use client";

import { AdminGate } from "@/components/portal/ProgressionAdminShared";
import TraditionEditor from "@/components/portal/TraditionEditor";

const PAGE = "mx-auto w-full max-w-6xl px-5 pt-6 pb-16 sm:px-8";

export default function NewTraditionPage() {
  return (
    <AdminGate>
      <div className={PAGE}>
        <TraditionEditor mode="new" />
      </div>
    </AdminGate>
  );
}
