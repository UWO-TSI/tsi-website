import type { ReactNode } from "react";
import CompanyNavbar from "@/components/layout/CompanyNavbar";

export default function CompanyLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <CompanyNavbar />
      <main className="pt-[96px]">
        {children}
      </main>
    </>
  );
}