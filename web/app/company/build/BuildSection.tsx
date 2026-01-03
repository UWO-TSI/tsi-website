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
    description: "Custom web applications built with modern frameworks and best practices"
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
  }
];

export default function BuildSection() {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
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
        .from(".build-title", {
          opacity: 0,
          y: 20,
          duration: 0.3,
        })
        .from(
          ".build-subtitle",
          {
            opacity: 0,
            y: 16,
            duration: 0.25,
          },
          "-=0.15"
        )
        .from(
          ".pathway-card",
          {
            opacity: 0,
            stagger: 0.12,
            duration: 0.2,
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
      {/* Title */}
      <div className="pt-35 text-center">
        <h2 className="build-title font-heading text-6xl font-semibold mb-4">
          Build with TETHOS
        </h2>
        <p className="build-subtitle text-zinc-400 text-lg">
          Custom Technology. Modern Design. Delivery with Clarity.
        </p>
      </div>

      {/* Carousel + controls */}
      <div className="absolute inset-x-0 top-[43%] flex justify-center -translate-y-1/2">
        <div className="relative w-[1500px] max-w-[90vw]">
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