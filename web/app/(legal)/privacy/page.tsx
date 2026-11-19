import type { Metadata } from "next";
import LegalPage from "../LegalPage";

export const dynamic = "force-static";
export const metadata: Metadata = { title: "Privacy Policy", description: "What Tethos Island collects and how it is used." };

export default function PrivacyPage() {
  return <LegalPage page="privacy" />;
}
