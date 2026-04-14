"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import LogoLoop from "@/components/ui/LogoLoop";
import { ALUMNI_LOGOS } from "@/components/ui/PartnerLogos";
import GradientText from "@/components/ui/GradientText";
import DecryptedText from "@/components/ui/DecryptedText";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

const TEAM_FACTS = [
  { value: "5", label: "Active chapters" },
  { value: "12", label: "Avg team size" },
  { value: "3", label: "Countries" },
];

export default function TeamSection() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const leftColRef = useRef<HTMLDivElement>(null);
  const rightColRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sectionRef.current) return;

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const ctx = gsap.context(() => {
      if (prefersReducedMotion) {
        gsap.set([headingRef.current, leftColRef.current, rightColRef.current], { opacity: 1 });
        return;
      }

      // Scroll-driven glow
      if (glowRef.current) {
        gsap.fromTo(
          glowRef.current,
          { opacity: 0.04 },
          {
            opacity: 0.14,
            ease: "none",
            scrollTrigger: {
              trigger: sectionRef.current,
              start: "top bottom",
              end: "center center",
              scrub: true,
            },
          }
        );
      }

      // Big heading: full-width dramatic entrance
      gsap.fromTo(
        headingRef.current,
        { opacity: 0, y: 80, scale: 0.9 },
        {
          opacity: 1,
          y: 0,
          scale: 1,
          duration: 1.2,
          ease: "power4.out",
          scrollTrigger: { trigger: sectionRef.current, start: "top 70%", once: true },
        }
      );

      // Left col slides in from left
      gsap.fromTo(
        leftColRef.current,
        { opacity: 0, x: -50 },
        {
          opacity: 1,
          x: 0,
          duration: 0.9,
          ease: "power3.out",
          scrollTrigger: { trigger: leftColRef.current, start: "top 80%", once: true },
        }
      );

      // Right col slides in from right
      gsap.fromTo(
        rightColRef.current,
        { opacity: 0, x: 50 },
        {
          opacity: 1,
          x: 0,
          duration: 0.9,
          ease: "power3.out",
          scrollTrigger: { trigger: rightColRef.current, start: "top 80%", once: true },
        }
      );

    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      id="team"
      ref={sectionRef}
      data-navbar-theme="dark"
      className="relative py-32 md:py-44 px-8 md:px-20 lg:px-28 overflow-hidden"
      style={{ background: "#0a0a0b" }}
    >
      {/* Gradient transition */}
      <div
        className="absolute top-0 left-0 right-0 pointer-events-none"
        style={{
          height: "200px",
          background: "linear-gradient(to bottom, #0F0F10, #0a0a0b)",
        }}
      />

      {/* Scroll-driven ambient glow */}
      <div
        ref={glowRef}
        className="absolute bottom-0 left-1/3 pointer-events-none"
        style={{
          width: "900px",
          height: "600px",
          background: "radial-gradient(ellipse, rgba(29,155,240,0.12) 0%, transparent 70%)",
          filter: "blur(40px)",
          transform: "translateY(30%)",
          opacity: 0.04,
        }}
      />

      <div className="relative max-w-[1400px] mx-auto">
        {/* BROKEN PATTERN: Full-width dramatic heading, centered */}
        <h2
          ref={headingRef}
          className="text-center mb-20 md:mb-28"
          style={{
            fontFamily: '"Test Sohne", sans-serif',
            fontSize: "clamp(40px, 6vw, 88px)",
            fontWeight: 500,
            color: "#F1FFFF",
            lineHeight: 1.05,
            letterSpacing: "-0.03em",
            opacity: 0,
          }}
        >
          Built by students
          <br />
          <GradientText colors={["#1d9bf0", "#60c5ff", "#1d9bf0"]} animationSpeed={6}>
            who ship.
          </GradientText>
        </h2>

        {/* Two-column layout: stats left, description + alumni right */}
        <div className="flex flex-col lg:flex-row gap-16 lg:gap-24">
          {/* Left: stats */}
          <div ref={leftColRef} className="lg:w-[35%] flex-shrink-0" style={{ opacity: 0 }}>
            <p
              className="text-xs tracking-widest uppercase mb-8"
              style={{ color: "rgba(29,155,240,0.7)", fontFamily: "var(--font-highlight)" }}
            >
              Our people
            </p>

            <div className="flex flex-col gap-10">
              {TEAM_FACTS.map((stat) => (
                <div key={stat.label}>
                  <p
                    className="text-5xl md:text-6xl font-semibold tracking-tight"
                    style={{ color: "#F1FFFF" }}
                  >
                    {stat.value}
                  </p>
                  <p
                    className="text-sm mt-2"
                    style={{ color: "rgba(255,255,255,0.3)", fontFamily: "var(--font-highlight)" }}
                  >
                    {stat.label}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Right: description + alumni */}
          <div ref={rightColRef} className="lg:flex-1" style={{ opacity: 0 }}>
            <p
              className="text-lg md:text-xl leading-relaxed mb-16"
              style={{
                color: "rgba(255,255,255,0.45)",
                fontFamily: '"Test Sohne", sans-serif',
                maxWidth: "540px",
              }}
            >
              Our members go on to build at the companies shaping the future.
              Tethos is where they learn to ship real products, lead teams,
              and deliver under pressure.
            </p>

            <p
              className="text-xs tracking-widest uppercase mb-6"
              style={{ color: "rgba(255,255,255,0.25)", fontFamily: "var(--font-highlight)" }}
            >
              Where our alumni work
            </p>
            <LogoLoop
              logos={ALUMNI_LOGOS}
              speed={50}
              gap={60}
              logoHeight={32}
              fadeOut
              fadeOutColor="#0a0a0b"
              pauseOnHover
            />
          </div>
        </div>
      </div>
    </section>
  );
}
