import type { ReactNode } from "react";
import CustomCursor from "@/components/ui/CustomCursor";
import GlassNavbar from "@/components/layout/GlassNavbar";

export default function SponsorLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <CustomCursor />
      <GlassNavbar />
      <main>{children}</main>
    </>
  );
}
