import type { ReactNode } from "react";
import Navbar from "@/components/layout/Navbar";
import CustomCursor from "@/components/ui/CustomCursor";
import LoadingScreenWrapper from "@/components/LoadingScreenWrapper";

export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <LoadingScreenWrapper>
      <CustomCursor />
      <Navbar />
      <main>
        {children}
      </main>
    </LoadingScreenWrapper>
  );
}