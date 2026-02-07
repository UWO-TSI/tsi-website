import "./globals.css";
import "../styles/tokens.css";
import type { ReactNode } from "react";
import type { Metadata } from "next";
import { IBM_Plex_Mono, Space_Grotesk } from "next/font/google";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-body",
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-highlight",
});

export const metadata: Metadata = {
  title: {
    default: "Tethos — Technology That Moves People Forward",
    template: "%s | Tethos",
  },
  description:
    "Student-run tech collective building real software for nonprofits, companies, and communities. Powered by student developers. Designed for real-world impact.",
  openGraph: {
    title: "Tethos — Technology That Moves People Forward",
    description:
      "Student-run tech collective building real software for nonprofits, companies, and communities.",
    siteName: "Tethos",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Tethos — Technology That Moves People Forward",
    description:
      "Student-run tech collective building real software for nonprofits, companies, and communities.",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${ibmPlexMono.variable}`}
    >
      <body className="bg-[#0F0F10] text-[#F1FFFF] font-body">
        {children}
      </body>
    </html>
  );
}
