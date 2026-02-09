import SmoothScroll from "@/components/SmoothScroll";
import HomeHero from "@/components/sections/HomeHero";
import TextRevealSection from "@/components/sections/TextRevealSection";
import ImpactStats from "@/components/sections/ImpactStats";
import SponsorStrip from "@/components/sections/SponsorStrip";
import PathwayCards from "@/components/sections/PathwayCards";

export default function HomePage() {
  return (
    <SmoothScroll>
      <main className="min-h-screen">
        <HomeHero />
        <TextRevealSection />
        <ImpactStats />
        <SponsorStrip />
        <PathwayCards />
      </main>
    </SmoothScroll>
  );
}
