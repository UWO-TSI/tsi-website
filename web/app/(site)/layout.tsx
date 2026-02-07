import type { ReactNode } from "react";
import GlassNavbar from "@/components/layout/GlassNavbar";
import CustomCursor from "@/components/ui/CustomCursor";
import LoadingScreenWrapper from "@/components/LoadingScreenWrapper";
import Footer from "@/components/layout/Footer";

export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <LoadingScreenWrapper>
      <CustomCursor />
      <GlassNavbar />
      <main>{children}</main>
      <Footer />
    </LoadingScreenWrapper>
  );
}
