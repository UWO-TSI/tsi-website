import "./globals.css";
import "../styles/tokens.css";
import type { ReactNode } from "react";
import Navbar from "@/components/layout/Navbar";
import CustomCursor from "@/components/ui/CustomCursor";
import LoadingScreenWrapper from "@/components/LoadingScreenWrapper";
import { Inter, Space_Grotesk } from "next/font/google";


const inter = Inter({
  subsets: ["latin"],
  variable: "--font-body",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-heading",
});

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${spaceGrotesk.variable}`}>
      <body className="bg-[#0F0F10] text-[#F1FFFF] font-body">
        <LoadingScreenWrapper>
          <CustomCursor />
          <Navbar />
          <main>{children}</main>
        </LoadingScreenWrapper>
      </body>
    </html>
  );
}
