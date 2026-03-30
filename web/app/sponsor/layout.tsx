import type { ReactNode } from "react";
import CustomCursor from "@/components/ui/CustomCursor";
import LoadingScreenWrapper from "@/components/LoadingScreenWrapper";
import GlassNavbar from "@/components/layout/GlassNavbar";

export default function SponsorLayout({ children }: { children: ReactNode }) {
  return (
    <LoadingScreenWrapper>
      <CustomCursor />
      <GlassNavbar />
      <main>{children}</main>
    </LoadingScreenWrapper>
  );
}
