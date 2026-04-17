import type { ReactNode } from "react";
import DropdownNav from "@/components/layout/DropdownNav";
import CustomCursor from "@/components/ui/CustomCursor";
import Footer from "@/components/layout/Footer";
import NoiseOverlay from "@/components/ui/NoiseOverlay";

export default function GenesisLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <CustomCursor />
      <NoiseOverlay opacity={0.025} />
      <DropdownNav />
      <main>{children}</main>
      <Footer />
    </>
  );
}
