import CompanyHeroNew from "./sections/CompanyHeroNew";
import CompanyTracks from "./sections/CompanyTracks";
import CompanyFAQ from "./sections/CompanyFAQ";
import CompanyCTA from "./sections/CompanyCTA";
import DotNav from "@/components/ui/DotNav";
import type { DotNavSection } from "@/components/ui/DotNav";

const SECTIONS: DotNavSection[] = [
  { id: "company-hero", label: "Overview" },
  { id: "tracks", label: "Services" },
  { id: "company-faq", label: "FAQ" },
  { id: "company-cta", label: "Contact" },
];

export default function CompanyPage() {
  return (
    <main className="min-h-screen">
      <DotNav sections={SECTIONS} />
      <CompanyHeroNew />
      <CompanyTracks />
      <CompanyFAQ />
      <CompanyCTA />
    </main>
  );
}
