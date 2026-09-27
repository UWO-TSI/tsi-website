import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import MemberDashboardShell from "@/components/portal/MemberDashboardShell";
import { memberWorldIsAvailable, OPENING_SOON } from "@/lib/recruitment-access";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  if (!memberWorldIsAvailable()) redirect(OPENING_SOON);
  return <MemberDashboardShell>{children}</MemberDashboardShell>;
}
