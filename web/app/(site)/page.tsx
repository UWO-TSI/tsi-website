import SmoothScroll from "@/components/SmoothScroll";
import HomeHero from "@/components/sections/HomeHero";
import TextRevealSection from "@/components/sections/TextRevealSection";
import CaseStudies from "@/components/sections/CaseStudies";
import ImpactStats from "@/components/sections/ImpactStats";
import TeamSection from "@/components/sections/TeamSection";
import PathwayCards from "@/components/sections/PathwayCards";
import DotNav from "@/components/ui/DotNav";
import type { DotNavSection } from "@/components/ui/DotNav";

const SECTIONS: DotNavSection[] = [
  { id: "hero", label: "Home" },
  { id: "about", label: "Mission" },
  { id: "work", label: "Work" },
  { id: "impact", label: "Impact" },
  { id: "team", label: "Team" },
  { id: "pathways", label: "Get Started" },
];

export default function HomePage() {
  return (
    <SmoothScroll>
      <main className="min-h-screen">
        <DotNav sections={SECTIONS} />
        <HomeHero />
        <TextRevealSection />
        <CaseStudies />
        <ImpactStats />
        <TeamSection />
        <PathwayCards />
      </main>
    </SmoothScroll>
  );
}
