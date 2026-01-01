import type { ReactNode } from "react";
import CompanyNavbar from "@/components/layout/CompanyNavbar";
import CustomCursor from "@/components/ui/CustomCursor";
import LoadingScreenWrapper from "@/components/LoadingScreenWrapper";

export default function CompanyLayout({ children }: { children: ReactNode }) {
  return (
    <LoadingScreenWrapper>
      <CustomCursor />
      <CompanyNavbar />
      <main className="pt-[96px]">
        {children}
      </main>
    </LoadingScreenWrapper>
  );
}