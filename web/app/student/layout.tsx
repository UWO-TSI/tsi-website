"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import DropdownNav from "@/components/layout/DropdownNav";
import CustomCursor from "@/components/ui/CustomCursor";
import NoiseOverlay from "@/components/ui/NoiseOverlay";

export default function StudentLayout({ children }: { children: ReactNode }) {
  const recruitment = usePathname().startsWith("/student/apply");
  return (
    <>
      {!recruitment && <><CustomCursor /><NoiseOverlay opacity={0.03} /></>}
      {!recruitment && <DropdownNav />}
      <div>{children}</div>
    </>
  );
}
