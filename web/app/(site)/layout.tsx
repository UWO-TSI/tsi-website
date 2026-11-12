import "./site.css";
import type { ReactNode } from "react";
import type { Metadata } from "next";
import { Geist_Mono, Inter_Tight } from "next/font/google";
import SiteNav from "@/components/site/SiteNav";
import SiteFooter from "@/components/site/SiteFooter";
import SiteScroll from "@/components/site/SiteScroll";
import PersonCursor from "@/components/site/PersonCursor";
import AsciiGrain from "@/components/site/AsciiGrain";
import { TETHOS } from "@/lib/site/config";
import { loadSeasonCta } from "@/lib/site/season-server";

// Fill-ins for the characters the Söhne trial cuts don't have ($ + ? ' : # @ and the rest).
const fillSans = Inter_Tight({ subsets: ["latin"], variable: "--font-fill-sans", preload: false, display: "swap" });
const fillMono = Geist_Mono({ subsets: ["latin"], variable: "--font-fill-mono", preload: false, display: "swap" });

// The nav's call to action follows open hiring rounds; pages rebuild every 5 minutes.
export const revalidate = 300;

const DESCRIPTION = "Most tech is built to make money. We build it for purpose. Tethos is a student-run nonprofit building pro bono technology for nonprofits and the communities they serve.";

export const metadata: Metadata = {
  title: { default: "Tethos", template: "%s | Tethos" },
  description: DESCRIPTION,
  openGraph: { title: "Tethos", description: DESCRIPTION, siteName: "Tethos", type: "website" },
  twitter: { card: "summary_large_image", title: "Tethos", description: DESCRIPTION },
};

export default async function SiteLayout({ children }: { children: ReactNode }) {
  // One site today. Branch sites will pick their config by host (lib/site/config.ts `siteFor`).
  const site = TETHOS;
  const cta = await loadSeasonCta();
  return (
    <div className={`ts ${fillSans.variable} ${fillMono.variable}`}>
      <SiteScroll />
      <PersonCursor />
      <AsciiGrain />
      <SiteNav cta={cta} />
      <main>{children}</main>
      <SiteFooter site={site} />
    </div>
  );
}
