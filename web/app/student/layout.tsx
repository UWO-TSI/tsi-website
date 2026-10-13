"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import DropdownNav from "@/components/layout/DropdownNav";
import CustomCursor from "@/components/ui/CustomCursor";
import NoiseOverlay from "@/components/ui/NoiseOverlay";

export default function StudentLayout({ children }: { children: ReactNode }) {
  const path = usePathname();
  // Recruitment and the portal's title screen (/student, or `/` on play.tethos.ca) bring their own frame.
  const bare = path.startsWith("/student/apply") || path === "/student" || path === "/";
  return (
    <>
      {!bare && <><CustomCursor /><NoiseOverlay opacity={0.03} /></>}
      {!bare && <DropdownNav />}
      <div>{children}</div>
    </>
  );
}
