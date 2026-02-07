import type { ReactNode } from "react";
import CustomCursor from "@/components/ui/CustomCursor";
import LoadingScreenWrapper from "@/components/LoadingScreenWrapper";
import SponsorNavbar from "./SponsorNavbar";

export default function SponsorLayout({ children }: { children: ReactNode }) {
  return (
    <LoadingScreenWrapper>
      <CustomCursor />
      <SponsorNavbar />
      <main className="pt-[96px]">{children}</main>
    </LoadingScreenWrapper>
  );
}
