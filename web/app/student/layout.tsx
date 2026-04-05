import type { ReactNode } from "react";
import GlassNavbar from "@/components/layout/GlassNavbar";
import CustomCursor from "@/components/ui/CustomCursor";

export default function StudentLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <CustomCursor />
      <GlassNavbar />
      <main>{children}</main>
    </>
  );
}
