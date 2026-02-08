"use client";

import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import GlobeVisualizer from "@/components/ui/GlobeVisualizer";
import ScrollIndicator from "@/components/ui/ScrollIndicator";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

// Globe size matches the CSS below: min(99vw, 1080px)
function getGlobeSize() {
  if (typeof window === "undefined") return 1080;
  return Math.min(window.innerWidth * 1.06, 1156);
}

// ============================================
// HomeHero — heading + globe scroll-reveal
// ============================================

export default function HomeHero() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLDivElement>(null);
  const scrollIndicatorRef = useRef<HTMLDivElement>(null);
  const [sectionHeight, setSectionHeight] = useState("200vh");

  // Calculate section height so it ends exactly at the globe bottom
  useEffect(() => {
    function updateHeight() {
      const globeSize = getGlobeSize();
      const vh = window.innerHeight;
      // Globe top is at 50vh from section top.
      // Section should end at globe bottom: 0.5 * vh + globeSize
      // Add one viewport height so the globe can scroll fully into view.
      const totalHeight = 0.5 * vh + globeSize;
      setSectionHeight(`${totalHeight}px`);

      // Refresh ScrollTrigger after height change
      setTimeout(() => ScrollTrigger.refresh(), 50);
    }

    updateHeight();
    window.addEventListener("resize", updateHeight);
    return () => window.removeEventListener("resize", updateHeight);
  }, []);

  useEffect(() => {
    if (!sectionRef.current || !headingRef.current) return;

    const ctx = gsap.context(() => {
      // ── Text: slides down toward the globe and fades, tucking behind it ──
      gsap.to(headingRef.current, {
        y: "15vh",
        opacity: 0,
        ease: "none",
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top top",
          end: "top+=20% top",
          scrub: true,
        },
      });

      // ── Fade out scroll indicator ──
      ScrollTrigger.create({
        trigger: sectionRef.current,
        start: "top top",
        end: "top+=300 top",
        scrub: true,
        onUpdate: (self) => {
          const opacity = Math.max(0, 1 - self.progress * 2);
          gsap.set(scrollIndicatorRef.current, { opacity });
        },
      });
    }, sectionRef);

    const refreshTimer = setTimeout(() => ScrollTrigger.refresh(), 100);

    return () => {
      ctx.revert();
      clearTimeout(refreshTimer);
    };
  }, [sectionHeight]);

  return (
    <section
      ref={sectionRef}
      className="relative bg-[#0F0F10]"
      style={{ height: sectionHeight }}
    >
      {/* ── Heading — behind the globe, slides down into globe and fades ── */}
      <div
        ref={headingRef}
        className="sticky top-0 z-0 flex items-center justify-center h-screen pointer-events-none"
      >
        <div className="flex flex-col items-center justify-center px-6 text-center w-full max-w-5xl">
          <h1 className="font-heading mb-6 text-5xl md:text-6xl lg:text-7xl font-semibold leading-tight tracking-tight">
            Technology That Moves
            <br />
            People Forwards.
          </h1>

          <p className="max-w-2xl text-base md:text-lg text-zinc-400 mb-0">
            We build modern software for nonprofits, companies, and communities.
            <br className="hidden md:block" />
            Powered by student developers. Designed for real-world impact.
          </p>
        </div>
      </div>

      {/* ── Globe — positioned so top half visible initially, sits ABOVE heading ── */}
      <div
        className="absolute left-1/2 -translate-x-1/2 z-10"
        style={{
          top: "50vh",
          width: "min(106vw, 1156px)",
          height: "min(106vw, 1156px)",
        }}
      >
        <GlobeVisualizer className="w-full h-full" />
      </div>

      {/* ── Scroll indicator — bottom of first viewport ── */}
      <div
        ref={scrollIndicatorRef}
        className="fixed bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 z-30"
      >
        <ScrollIndicator />
        <span className="text-xs font-light text-[#A1A1AA]">
          Scroll to explore
        </span>
      </div>
    </section>
  );
}
