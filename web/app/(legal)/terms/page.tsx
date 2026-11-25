import type { Metadata } from "next";
import LegalPage from "../LegalPage";

export const dynamic = "force-static";
export const metadata: Metadata = { title: "Terms of Service", description: "The terms for playing Tethos Island." };

export default function TermsPage() {
  return <LegalPage page="terms" />;
}
