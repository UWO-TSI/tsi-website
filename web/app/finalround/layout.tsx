import type { ReactNode } from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Final Round",
  description: "Tethos final round competence assessment.",
  robots: { index: false, follow: false },
};

export default function FinalRoundLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
