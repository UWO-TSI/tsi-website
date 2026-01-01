"use client";

import ScrollRevealTimeline from "@/components/sections/ScrollRevealTimeline";
import { CardFan } from "@/components/cards/CardFan";
import type { PathwayCard } from "@/components/cards/types";

const buildCards: PathwayCard[] = [
  {
    title: "Web Development",
    subtitle: "Modern full-stack apps built to scale",
    href: "/companies/web",
  },
  {
    title: "AI & Automation",
    subtitle: "Intelligent systems that save time",
    href: "/companies/ai",
  },
  {
    title: "Product Design",
    subtitle: "UX, UI, and systems thinking",
    href: "/companies/design",
  },
];

export default function CompaniesBuild() {
  return (
    <ScrollRevealTimeline
      start="top top"
      end="+=200%"
      onTimeline={(tl) => {
        tl.fromTo(
          ".build-title",
          { opacity: 0 },
          { opacity: 1, duration: 0.3 },
          0
        )
          .fromTo(
            ".build-subtitle",
            { opacity: 0 },
            { opacity: 1, duration: 0.25 },
            0.1
          )
          .fromTo(
            ".pathway-card",
            { opacity: 0 },
            { opacity: 1, stagger: 0.12, duration: 0.15 },
            0.25
          );
      }}
    >
      <div className="relative h-full flex flex-col px-6 pt-30">
        {/* Text */}
        <div className="flex flex-col items-center text-center">
          <h2 className="build-title font-heading text-5xl md:text-6xl font-semibold mb-4">
            Build with TETHOS
          </h2>

          <p className="build-subtitle text-zinc-400 text-lg max-w-xl">
            Custom Technology. Modern Design. Delivery with Clarity.
          </p>
        </div>

        {/* Cards */}
        <div className="relative flex-1 flex items-start justify-center pt-10">
          <div className="relative w-full max-w-7xl h-[520px] overflow-visible">
            {/* Card fan anchor */}
            <div className="absolute inset-x-0 top-25">
              <CardFan cards={buildCards} />
            </div>
          </div>
        </div>
      </div>
    </ScrollRevealTimeline>
  );
}