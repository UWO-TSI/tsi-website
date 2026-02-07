import SmoothScroll from "@/components/SmoothScroll";
import NPOHero from "./sections/NPOHero";
import NPOAbout from "./sections/NPOAbout";
import NPOTimeline from "./sections/NPOTimeline";
import NPODeliverables from "./sections/NPODeliverables";
import Impact from "./impact/Impact";
import DocumentaryEmbed from "./sections/DocumentaryEmbed";
import Testimonial from "./testimonial/testimonial";
import NPOCTA from "./sections/NPOCTA";

export default function NonprofitPage() {
  return (
    <SmoothScroll>
      <main className="min-h-screen">
        <NPOHero />
        <NPOAbout />
        <NPOTimeline />
        <NPODeliverables />
        <Impact />
        <DocumentaryEmbed />
        <Testimonial />
        <NPOCTA />
      </main>
    </SmoothScroll>
  );
}
