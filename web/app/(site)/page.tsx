import SmoothScroll from "@/components/SmoothScroll";
import HomeHero from "@/components/sections/HomeHero";
import PathwayCards from "@/components/sections/PathwayCards";

export default function HomePage() {
  return (
    <SmoothScroll>
      <HomeHero />
      <PathwayCards />
    </SmoothScroll>
  );
}