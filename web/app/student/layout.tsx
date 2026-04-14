import type { ReactNode } from "react";
import DropdownNav from "@/components/layout/DropdownNav";
import CustomCursor from "@/components/ui/CustomCursor";
import NoiseOverlay from "@/components/ui/NoiseOverlay";

export default function StudentLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <CustomCursor />
      <NoiseOverlay opacity={0.03} />
      <DropdownNav />
      <main>{children}</main>
    </>
  );
}
