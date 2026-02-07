"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import ScrollIndicator from "@/components/ui/ScrollIndicator";
import {
  EASE_ENTER,
  EASE_CINEMATIC,
  DURATION_SECTION,
  DURATION_CINEMATIC,
} from "@/lib/motion";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

export default function NPOHero() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const scrollHintRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      // Entrance animation
      gsap.fromTo(
        contentRef.current,
        { opacity: 0, y: 20 },
        {
          opacity: 1,
          y: 0,
          duration: DURATION_SECTION,
          ease: EASE_ENTER,
          delay: 0.2,
        }
      );

      // Dark-to-light background transition on scroll
      ScrollTrigger.create({
        trigger: sectionRef.current,
        start: "top top",
        end: "+=80%",
        scrub: true,
        onUpdate: (self) => {
          if (!sectionRef.current) return;
          const progress = self.progress;
          // Interpolate from dark (#0F0F10) to white (#FFFFFF)
          const r = Math.round(15 + progress * (255 - 15));
          const g = Math.round(15 + progress * (255 - 15));
          const b = Math.round(16 + progress * (255 - 16));
          sectionRef.current.style.backgroundColor = `rgb(${r},${g},${b})`;

          // Text color from light to dark
          if (contentRef.current) {
            const tr = Math.round(241 - progress * (241 - 15));
            const tg = Math.round(255 - progress * (255 - 15));
            const tb = Math.round(255 - progress * (255 - 16));
            contentRef.current.style.color = `rgb(${tr},${tg},${tb})`;
          }
        },
      });

      // Fade out scroll hint
      ScrollTrigger.create({
        trigger: sectionRef.current,
        start: "top top",
        end: "top+=200 top",
        scrub: true,
        onUpdate: (self) => {
          gsap.set(scrollHintRef.current, {
            opacity: 1 - self.progress * 2,
          });
        },
      });

      // Pin and fade
      ScrollTrigger.create({
        trigger: sectionRef.current,
        start: "top top",
        end: "+=100%",
        scrub: true,
        pin: true,
        pinSpacing: true,
        anticipatePin: 1,
        onUpdate: (self) => {
          gsap.set(contentRef.current, {
            opacity: 1 - self.progress,
          });
        },
      });
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      className="h-screen flex items-center justify-center relative overflow-hidden"
      style={{ backgroundColor: "#0F0F10" }}
    >
      <div
        ref={contentRef}
        className="flex flex-col items-center justify-center px-6 text-center max-w-4xl"
      >
        <h1 className="font-heading text-5xl md:text-6xl lg:text-7xl font-semibold mb-6 leading-tight">
          Software That Empowers
          <br />
          Nonprofits.
        </h1>
        <p className="text-lg md:text-xl max-w-2xl opacity-70 mb-10 leading-relaxed">
          An 8-month pro-bono initiative supporting registered nonprofits with
          custom technical solutions — from discovery to handoff.
        </p>
        <div className="flex flex-col sm:flex-row gap-4">
          <button className="rounded-full bg-[#002FA7] px-6 py-3 text-sm font-medium text-[#F1FFFF] transition-all hover:bg-[#0039CC]">
            Apply for 2026 Cohort
          </button>
          <button className="rounded-full border border-current/20 px-6 py-3 text-sm font-medium transition-all hover:bg-white/10">
            Download Program Package
          </button>
        </div>
      </div>

      <div
        ref={scrollHintRef}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
      >
        <ScrollIndicator />
        <span className="text-xs font-light text-current opacity-50">
          Discover our process
        </span>
      </div>
    </section>
  );
}
