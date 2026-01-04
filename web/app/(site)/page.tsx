import SmoothScroll from "@/components/SmoothScroll";
import HomeHero from "@/components/sections/HomeHero";
import AboutUs from "@/components/sections/AboutUs";
import PathwayCards from "@/components/sections/PathwayCards";
import NPOHomePage from "@/components/sections/NPO/npo_homePage";
import NPOAboutProgram from "@/components/sections/NPO/npo_aboutProgram";
import NPOFormSubmission from "@/components/sections/NPO/npo_formSubmission";

export default function HomePage() {
  return (
    <SmoothScroll>
      <main className="min-h-screen">
        <HomeHero />
        <AboutUs />
        <PathwayCards />
      </main>
    </SmoothScroll>
  );
}