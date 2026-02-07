import SmoothScroll from "@/components/SmoothScroll";
import HomeHero from "@/components/sections/HomeHero";
import AboutUs from "@/components/sections/AboutUs";
import ImpactStats from "@/components/sections/ImpactStats";
import SponsorStrip from "@/components/sections/SponsorStrip";
import PathwayCards from "@/components/sections/PathwayCards";

export default function HomePage() {
  return (
    <SmoothScroll>
      <main className="min-h-screen">
        <HomeHero />
        <AboutUs />
        <ImpactStats />
        <SponsorStrip />
        <PathwayCards />
      </main>
    </SmoothScroll>
  );
}
