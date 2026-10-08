import type { ReactNode } from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { absolute: "Final Round | Tech for Social Impact" },
  description: "Tech for Social Impact final round assessment.",
  openGraph: {
    title: "Final Round | Tech for Social Impact",
    description: "Final round assessment.",
  },
  twitter: {
    title: "Final Round | Tech for Social Impact",
    description: "Final round assessment.",
  },
  robots: { index: false, follow: false },
};

export default function FinalRoundLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
