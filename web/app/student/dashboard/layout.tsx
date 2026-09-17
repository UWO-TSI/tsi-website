import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import MemberDashboardShell from "@/components/portal/MemberDashboardShell";
import { APPLICANT_PORTAL, memberWorldIsAvailable } from "@/lib/recruitment-access";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  if (!memberWorldIsAvailable()) redirect(APPLICANT_PORTAL);
  return <MemberDashboardShell>{children}</MemberDashboardShell>;
}
