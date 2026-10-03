"use client";

import { AdminGate } from "@/components/portal/ProgressionAdminShared";
import MerchFulfilment from "@/components/economy/MerchFulfilment";

const PAGE = "mx-auto w-full max-w-6xl px-5 pt-6 pb-16 sm:px-8";

// /student/dashboard/admin/merch: T1/T2 hand over or cancel merch reservations.
export default function AdminMerchPage() {
  return (
    <AdminGate>
      <div className={PAGE}>
        <MerchFulfilment />
      </div>
    </AdminGate>
  );
}
