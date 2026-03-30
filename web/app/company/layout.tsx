import type { ReactNode } from "react";
import GlassNavbar from "@/components/layout/GlassNavbar";
import CustomCursor from "@/components/ui/CustomCursor";
import LoadingScreenWrapper from "@/components/LoadingScreenWrapper";

export default function CompanyLayout({ children }: { children: ReactNode }) {
  return (
    <LoadingScreenWrapper>
      <CustomCursor />
      <GlassNavbar />
      <main>{children}</main>
    </LoadingScreenWrapper>
  );
}