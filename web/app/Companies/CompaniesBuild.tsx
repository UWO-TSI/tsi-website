"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

import { CardFan } from "@/components/cards/CardFan";
import type { PathwayCard } from "@/components/cards/types";

const CARD_BOTTOM_OFFSET = 96;

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
  const sectionRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const subtitleRef = useRef<HTMLParagraphElement>(null);
  const cardsContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top top",
          end: "+=120%",
          scrub: 1,
          pin: true,
          pinReparent: true,
          anticipatePin: 1,
        },
      });

      tl.fromTo(titleRef.current, { opacity: 0 }, { opacity: 1, duration: 0.3 }, 0);
      tl.fromTo(
        subtitleRef.current,
        { opacity: 0 },
        { opacity: 1, duration: 0.25 },
        0.1
      );

      cardsContainerRef.current
        ?.querySelectorAll(".pathway-card")
        .forEach((card, i) => {
          tl.fromTo(
            card,
            { opacity: 0 },
            { opacity: 1, duration: 0.15 },
            0.25 + i * 0.12
          );
        });
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      className="relative bg-[#0F0F10] h-screen overflow-hidden"
    >
      <div className="pt-32 flex flex-col items-center px-6">
        <h2
          ref={titleRef}
          className="font-heading text-5xl md:text-6xl font-semibold mb-4 text-center opacity-0"
        >
          Build with TETHOS
        </h2>

        <p
          ref={subtitleRef}
          className="text-zinc-400 text-lg max-w-xl text-center opacity-0"
        >
          Custom Technology. Modern Design. Delivery with Clarity.
        </p>
      </div>

      <div
        ref={cardsContainerRef}
        style={{ bottom: `${CARD_BOTTOM_OFFSET}px` }}
        className="absolute left-1/2 -translate-x-1/2 w-full max-w-7xl h-[520px]"
      >
        <CardFan cards={buildCards} />
      </div>
    </section>
  );
}