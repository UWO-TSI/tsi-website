"use client";

import { AdminGate } from "@/components/portal/ProgressionAdminShared";
import MerchFulfilment from "@/components/economy/MerchFulfilment";

// /student/dashboard/admin/merch: T1/T2 hand over or cancel merch reservations.
export default function AdminMerchPage() {
  return (
    <AdminGate>
      <MerchFulfilment />
    </AdminGate>
  );
}
