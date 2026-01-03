"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

import { CardCarousel } from "@/components/cards/CardCarousel";
import { CarouselControls } from "@/components/cards/CarouselControls";
import type { PathwayCard } from "@/components/cards/types";

gsap.registerPlugin(ScrollTrigger);

const buildCards: PathwayCard[] = [
  {
    title: "Web Development",
    description: "Custom web applications built with modern frameworks and best practices",
  },
  {
    title: "Mobile Apps",
    description: "iOS and Android applications designed for performance and user experience",
  },
  {
    title: "Consulting",
    description: "Technical consulting and architecture guidance from experienced developers",
  },
  {
    title: "API",
    description: "Robust backend services and APIs to power your applications",
  },
  {
    title: "DevOps",
    description: "Infrastructure setup, CI/CD pipelines, and deployment automation",
  },
  {
    title: "UI/UX Design",
    description: "Beautiful, intuitive interfaces that users love to interact with",
  },
];

export default function BuildSection() {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      // Initial states (CRITICAL for scrubbed timelines)
      gsap.set(".build-carousel", { opacity: 0 });
      gsap.set(".pathway-card", { opacity: 0, y: 24 });

      // Sort cards by their visual position (left to right)
      const cards = gsap.utils.toArray<HTMLElement>(".pathway-card");
      const sortedCards = cards.sort((a, b) => {
        const orderA = parseInt(a.parentElement?.getAttribute("data-stagger-order") || "0");
        const orderB = parseInt(b.parentElement?.getAttribute("data-stagger-order") || "0");
        return orderA - orderB;
      });

      gsap
        .timeline({
          scrollTrigger: {
            trigger: sectionRef.current,
            start: "top top",
            end: "+=120%",
            scrub: 1,
            pin: true,
          },
        })

        // TITLE
        .from(".build-title", {
          opacity: 0,
          y: 20,
          duration: 0.3,
          ease: "power2.out",
        })

        // SUBTITLE
        .from(
          ".build-subtitle",
          {
            opacity: 0,
            y: 16,
            duration: 0.25,
            ease: "power2.out",
          },
          "-=0.15"
        )

        // CAROUSEL CONTAINER
        .to(".build-carousel", {
          opacity: 1,
          duration: 0.2,
          ease: "power2.out",
        })

        // CARDS (in correct left-to-right order)
        .to(
          sortedCards,
          {
            opacity: 1,
            y: 0,
            duration: 0.35,
            stagger: 0.1,
            ease: "power2.out",
          },
          "-=0.1"
        );
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      className="relative h-screen bg-[#0F0F10] overflow-hidden"
    >
      {/* TITLE */}
      <div className="pt-36 text-center">
        <h2 className="build-title font-heading text-6xl font-semibold mb-4">
          Build with TETHOS
        </h2>
        <p className="build-subtitle text-zinc-400 text-lg">
          Custom Technology. Modern Design. Delivery with Clarity.
        </p>
      </div>

      {/* CAROUSEL + CONTROLS */}
      <div className="absolute inset-x-0 top-[43%] -translate-y-1/2 flex justify-center">
        <div className="build-carousel relative w-[1500px] max-w-[90vw]">
          <CardCarousel
            cards={buildCards}
            renderControls={({ onPrev, onNext, isAnimating }) => (
              <CarouselControls
                onPrev={onPrev}
                onNext={onNext}
                disabled={isAnimating}
                className="absolute inset-x-0 top-[50%] translate-y-[250px] px-8"
              />
            )}
          />
        </div>
      </div>
    </section>
  );
}