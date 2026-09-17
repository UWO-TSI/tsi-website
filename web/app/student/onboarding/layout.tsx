import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { APPLICANT_PORTAL, memberWorldIsAvailable } from "@/lib/recruitment-access";

export default function OnboardingLayout({ children }: { children: ReactNode }) {
  if (!memberWorldIsAvailable()) redirect(APPLICANT_PORTAL);
  return <>{children}</>;
}
