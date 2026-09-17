import type { ReactNode } from "react";
import RecruitmentAppearance from "@/components/recruit/RecruitmentAppearance";

export const metadata = {
  title: "Join Tech for Social Impact | 2026-27 Recruitment",
  description:
    "Explore director and developer roles at Tech for Social Impact. Meet the team, build software for nonprofits and follow your application.",
};

export default function ApplyLayout({ children }: { children: ReactNode }) {
  return <RecruitmentAppearance>{children}</RecruitmentAppearance>;
}
