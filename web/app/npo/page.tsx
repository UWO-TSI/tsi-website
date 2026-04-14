import NPOHeroSection from "./sections/NPOHeroNew";
import NPOProgramSection from "./sections/NPOProgram";
import NPODetailsSection from "./sections/NPODetails";
import NPOApplySection from "./sections/NPOApply";
import DotNav from "@/components/ui/DotNav";
import type { DotNavSection } from "@/components/ui/DotNav";

const SECTIONS: DotNavSection[] = [
  { id: "npo-hero", label: "Overview" },
  { id: "npo-program", label: "Program" },
  { id: "npo-details", label: "Details" },
  { id: "npo-apply", label: "Apply" },
];

export default function NonprofitPage() {
  return (
    <main className="min-h-screen">
      <DotNav sections={SECTIONS} />
      <NPOHeroSection />
      <NPOProgramSection />
      <NPODetailsSection />
      <NPOApplySection />
    </main>
  );
}
