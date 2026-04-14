"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import GradientText from "@/components/ui/GradientText";
import SpotlightCard from "@/components/ui/SpotlightCard";

const TRACKS = [
  {
    title: "Commission a Project",
    description: "Scoped software, AI, or design work delivered by a dedicated student team. Fixed price or custom quote.",
    cta: "View packages",
    href: "#tracks",
    accent: "#1d9bf0",
  },
  {
    title: "Hire Talent",
    description: "Access top student developers and designers through our guided pipeline. Summer placements or contract-to-hire.",
    cta: "Learn more",
    href: "#tracks",
    accent: "#10b981",
  },
];

export default function CompanyHeroNew() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const descRef = useRef<HTMLParagraphElement>(null);
  const cardsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sectionRef.current) return;
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) {
      gsap.set([headingRef.current, descRef.current, cardsRef.current], { opacity: 1, y: 0 });
      return;
    }

    const tl = gsap.timeline({ delay: 0.3 });
    tl.fromTo(headingRef.current, { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.9, ease: "power4.out" })
      .fromTo(descRef.current, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.6, ease: "power3.out" }, "-=0.4")
      .fromTo(cardsRef.current, { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.7, ease: "power3.out" }, "-=0.3");
  }, []);

  const scrollTo = (id: string) => {
    document.querySelector(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section
      id="company-hero"
      ref={sectionRef}
      data-navbar-theme="dark"
      className="relative min-h-screen flex items-center justify-center px-8 md:px-20 lg:px-28 overflow-hidden"
      style={{ background: "#0F0F10" }}
    >
      {/* Ambient glow */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
        style={{
          width: "900px",
          height: "600px",
          background: "radial-gradient(ellipse, rgba(29,155,240,0.08) 0%, transparent 70%)",
          filter: "blur(40px)",
        }}
      />

      <div className="relative max-w-[900px] mx-auto w-full text-center py-32">
        {/* Heading */}
        <h1
          ref={headingRef}
          className="mb-6"
          style={{
            fontFamily: '"Test Sohne", sans-serif',
            fontSize: "clamp(40px, 6vw, 80px)",
            fontWeight: 500,
            color: "#F1FFFF",
            lineHeight: 1.05,
            letterSpacing: "-0.03em",
            opacity: 0,
          }}
        >
          Build with us.
          <br />
          <GradientText colors={["#1d9bf0", "#60c5ff", "#1d9bf0"]} animationSpeed={6}>
            Hire from us.
          </GradientText>
        </h1>

        {/* Description */}
        <p
          ref={descRef}
          className="text-base md:text-lg leading-relaxed mb-16 mx-auto"
          style={{
            color: "rgba(255,255,255,0.4)",
            fontFamily: '"Test Sohne", sans-serif',
            fontWeight: 400,
            maxWidth: "520px",
            opacity: 0,
          }}
        >
          Two ways to work with Tethos. Choose the track that fits your needs.
        </p>

        {/* Dual CTA cards */}
        <div
          ref={cardsRef}
          className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-[700px] mx-auto"
          style={{ opacity: 0 }}
        >
          {TRACKS.map((track) => (
            <SpotlightCard
              key={track.title}
              className="rounded-xl p-6 md:p-8 text-left cursor-pointer group"
              spotlightColor={`${track.accent}18`}
              style={{
                background: "rgba(255,255,255,0.02)",
                border: `1px solid rgba(255,255,255,0.06)`,
                borderLeft: `3px solid ${track.accent}40`,
                transition: "border-color 0.3s ease",
              }}
              onClick={() => scrollTo(track.href)}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = `${track.accent}40`;
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.06)";
              }}
            >
              <h3
                className="text-lg font-medium tracking-tight mb-3"
                style={{ color: "#F1FFFF", fontWeight: 500 }}
              >
                {track.title}
              </h3>
              <p className="text-sm leading-relaxed mb-6" style={{ color: "rgba(255,255,255,0.4)" }}>
                {track.description}
              </p>
              <span
                className="text-xs font-medium tracking-wide uppercase group-hover:translate-x-1 transition-transform duration-200 inline-block"
                style={{ color: track.accent, fontFamily: "var(--font-highlight)" }}
              >
                {track.cta} →
              </span>
            </SpotlightCard>
          ))}
        </div>

        {/* Terminal diff artifact */}
        <div
          className="mt-14 max-w-[420px] mx-auto rounded-lg overflow-hidden"
          style={{
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.05)",
            opacity: 0,
          }}
          ref={(el) => {
            if (el && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
              gsap.fromTo(el, { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.6, ease: "power3.out", delay: 1.2 });
            } else if (el) {
              el.style.opacity = "1";
            }
          }}
        >
          <div className="px-4 py-2.5 flex items-center gap-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
            <div className="w-2 h-2 rounded-full" style={{ background: "rgba(255,255,255,0.08)" }} />
            <div className="w-2 h-2 rounded-full" style={{ background: "rgba(255,255,255,0.08)" }} />
            <div className="w-2 h-2 rounded-full" style={{ background: "rgba(255,255,255,0.08)" }} />
            <span className="ml-2 text-[10px]" style={{ color: "rgba(255,255,255,0.15)", fontFamily: "var(--font-highlight)" }}>
              cost-comparison.diff
            </span>
          </div>
          <div className="px-4 py-3 text-xs leading-relaxed" style={{ fontFamily: "var(--font-highlight)" }}>
            <p style={{ color: "rgba(239,68,68,0.6)" }}>- Agency retainer &nbsp;&nbsp;&nbsp;&nbsp; $50,000 - $200,000</p>
            <p style={{ color: "rgba(239,68,68,0.6)" }}>- Freelancer risk &nbsp;&nbsp;&nbsp;&nbsp; variable quality</p>
            <p style={{ color: "rgba(239,68,68,0.6)" }}>- Offshore team &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;timezone + comms</p>
            <p className="mt-2" style={{ color: "rgba(16,185,129,0.7)" }}>+ Tethos project &nbsp;&nbsp;&nbsp;&nbsp; $5,000 - $12,000</p>
            <p style={{ color: "rgba(16,185,129,0.7)" }}>+ Mentored students &nbsp;&nbsp;production quality</p>
            <p style={{ color: "rgba(16,185,129,0.7)" }}>+ Full ownership &nbsp;&nbsp;&nbsp;&nbsp; code + design + docs</p>
          </div>
        </div>
      </div>
    </section>
  );
}
