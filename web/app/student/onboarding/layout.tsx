import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { memberWorldIsAvailable, OPENING_SOON } from "@/lib/recruitment-access";

export default function OnboardingLayout({ children }: { children: ReactNode }) {
  if (!memberWorldIsAvailable()) redirect(OPENING_SOON);
  return <>{children}</>;
}
