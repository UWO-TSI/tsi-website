"use client";

import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import GlobeVisualizer from "@/components/ui/GlobeVisualizer";
import ScrollIndicator from "@/components/ui/ScrollIndicator";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

// ============================================
// HomeHero — heading → globe pin → text reveal
//
// Layout (no negative margins):
//   [absolute heading overlay — not in flow]
//   [65vh spacer — pushes globe to the fold]
//   [globe container — in flow, GSAP pins this]
// ============================================

export default function HomeHero() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLDivElement>(null);
  const globeWrapRef = useRef<HTMLDivElement>(null);
  const topLeftRef = useRef<HTMLDivElement>(null);
  const bottomRightRef = useRef<HTMLDivElement>(null);
  const scrollIndicatorRef = useRef<HTMLDivElement>(null);
  const [hasInteracted, setHasInteracted] = useState(false);

  useEffect(() => {
    if (
      !sectionRef.current ||
      !headingRef.current ||
      !globeWrapRef.current ||
      !topLeftRef.current ||
      !bottomRightRef.current
    )
      return;

    const ctx = gsap.context(() => {
      // ── Heading: slides down toward globe and fades, tucking behind it ──
      gsap.fromTo(
        headingRef.current,
        { y: 0, opacity: 1 },
        {
          y: "15vh",
          opacity: 0,
          ease: "none",
          scrollTrigger: {
            trigger: sectionRef.current,
            start: "top top",
            end: "top+=20% top",
            scrub: true,
          },
        }
      );

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

      // ── Globe pin + text reveal timeline ──
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: globeWrapRef.current,
          start: "center center",
          end: "+=100%",
          scrub: true,
          pin: true,
          pinSpacing: true,
          anticipatePin: 1,
        },
      });

      // First half: top-left text fades in
      tl.fromTo(
        topLeftRef.current,
        { opacity: 0, y: 40 },
        { opacity: 1, y: 0, duration: 0.5, ease: "power2.out" },
        0
      );

      // Second half: bottom-right text fades in
      tl.fromTo(
        bottomRightRef.current,
        { opacity: 0, y: 40 },
        { opacity: 1, y: 0, duration: 0.5, ease: "power2.out" },
        0.5
      );
    }, sectionRef);

    const refreshTimer = setTimeout(() => ScrollTrigger.refresh(), 150);

    return () => {
      ctx.revert();
      clearTimeout(refreshTimer);
    };
  }, []);

  return (
    <section ref={sectionRef} data-navbar-theme="dark" className="relative bg-[#0F0F10]">
      {/* ── Heading — fixed to viewport, NOT in flow ── */}
      <div
        ref={headingRef}
        className="fixed top-0 left-0 w-full h-screen z-0 flex items-center justify-center pointer-events-none"
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

      {/* ── Spacer — pushes globe down so top arc sits near the fold ── */}
      <div style={{ height: "65vh" }} aria-hidden="true" />

      {/* ── Globe container — in flow, pins at center.
           Height = 100vh so when pinned, it fills the viewport exactly. ── */}
      <div
        ref={globeWrapRef}
        className="relative z-10 mx-auto overflow-visible"
        style={{
          width: "min(106vw, 1156px)",
          height: "100vh",
        }}
      >
        {/* Globe canvas — full size, centered vertically in the viewport-height container */}
        <div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
          style={{
            width: "min(106vw, 1156px)",
            height: "min(106vw, 1156px)",
          }}
          onPointerDown={() => setHasInteracted(true)}
        >
          <GlobeVisualizer className="w-full h-full" />
        </div>

        {/* ── Top-left text overlay ── */}
        <div
          ref={topLeftRef}
          className="absolute z-20 pointer-events-none"
          style={{ top: "8%", left: "3%", maxWidth: "280px", opacity: 0 }}
        >
          <p className="text-xl md:text-2xl font-semibold leading-snug text-white">
            Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eius
          </p>
        </div>

        {/* ── Bottom-right text overlay ── */}
        <div
          ref={bottomRightRef}
          className="absolute z-20 pointer-events-none text-right"
          style={{ bottom: "8%", right: "3%", maxWidth: "280px", opacity: 0 }}
        >
          <p className="text-xl md:text-2xl font-semibold leading-snug text-white">
            Lorem ip dolor sit ame, consectetur adipi elit,sed do eiusm do
          </p>
        </div>

        {/* ── Rotate prompt — icon above text, centered, mimics ScrollIndicator ── */}
        <div
          className="absolute left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-2 pointer-events-none select-none transition-opacity duration-500"
          style={{ bottom: "12%", opacity: hasInteracted ? 0 : 1 }}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#555"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="animate-spin-slow"
          >
            <path d="M21 12a9 9 0 1 1-6.22-8.56" />
            <polyline points="21 3 21 9 15 9" />
          </svg>
          <span className="text-xs font-light text-[#3a3a3f]">
            Drag to rotate
          </span>
        </div>
      </div>

      {/* ── Scroll indicator — fixed bottom ── */}
      <div
        ref={scrollIndicatorRef}
        className="fixed bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 z-30"
      >
        <ScrollIndicator />
        <span className="text-xs font-light text-[#3a3a3f]">
          Scroll to explore
        </span>
      </div>
    </section>
  );
}
