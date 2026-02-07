"use client";

import SmoothScroll from "@/components/SmoothScroll";
import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import AsciiReveal from "@/components/ascii/AsciiReveal";
import AsciiDivider from "@/components/ascii/AsciiDivider";
import {
  EASE_ENTER,
  EASE_CINEMATIC,
  EASE_SMOOTH,
  DURATION_SECTION,
  DURATION_CINEMATIC,
  STAGGER_NORMAL,
  STAGGER_SLOW,
} from "@/lib/motion";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

// ============================================
// Data
// ============================================

const benefits = [
  {
    icon: "01",
    title: "Real Experience",
    description:
      "Work on actual projects for real clients. Build your portfolio with meaningful work that matters — not toy apps.",
  },
  {
    icon: "02",
    title: "Leadership",
    description:
      "Manage teams, own deliverables, and navigate client relationships. Skills you can't learn in a lecture hall.",
  },
  {
    icon: "03",
    title: "Impact",
    description:
      "Your code ships to nonprofits that need it. Every line you write has a measurable real-world consequence.",
  },
  {
    icon: "04",
    title: "Network",
    description:
      "Connect with industry professionals, sponsors, and a growing community of student developers nationwide.",
  },
  {
    icon: "05",
    title: "Career Launch",
    description:
      "Our alumni land at Google, Stripe, Microsoft, and more. Tethos is the best line on your resume.",
  },
  {
    icon: "06",
    title: "Community",
    description:
      "Join a culture that values craft, curiosity, and impact. This isn't a club — it's a collective.",
  },
];

const timelineSteps = [
  {
    phase: "01",
    title: "Gather Your Team",
    description: "Recruit 5-10 committed students passionate about tech and social impact.",
  },
  {
    phase: "02",
    title: "Submit Application",
    description: "Fill out our chapter application with team details and university info.",
  },
  {
    phase: "03",
    title: "Get Approved",
    description: "Our team reviews your application and provides onboarding support.",
  },
  {
    phase: "04",
    title: "Start Building",
    description: "Connect with local nonprofits, receive projects, and begin making an impact.",
  },
];

const projectTypes = [
  "Web Applications",
  "Mobile Apps",
  "Design Systems",
  "API Integrations",
  "Data Dashboards",
  "Internal Tools",
];

export default function StudentPage() {
  const heroRef = useRef<HTMLDivElement>(null);
  const benefitsRef = useRef<HTMLDivElement>(null);
  const projectsRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);
  const benefitCardsRef = useRef<(HTMLDivElement | null)[]>([]);
  const timelineItemsRef = useRef<(HTMLDivElement | null)[]>([]);
  const lineRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      // Hero entrance — bold, energetic
      if (heroRef.current) {
        const children = heroRef.current.querySelectorAll("[data-reveal]");
        gsap.fromTo(
          children,
          { opacity: 0, y: 30, scale: 0.98 },
          {
            opacity: 1,
            y: 0,
            scale: 1,
            duration: DURATION_SECTION,
            stagger: 0.1,
            ease: EASE_ENTER,
            delay: 0.15,
          }
        );
      }

      // Benefit cards — staggered reveal with slight rotation
      benefitCardsRef.current.forEach((el, i) => {
        if (!el) return;
        gsap.fromTo(
          el,
          { opacity: 0, y: 40, rotateY: -8 },
          {
            opacity: 1,
            y: 0,
            rotateY: 0,
            duration: DURATION_SECTION,
            ease: EASE_ENTER,
            scrollTrigger: {
              trigger: el,
              start: "top 85%",
              toggleActions: "play none none none",
            },
            delay: i * 0.08,
          }
        );
      });

      // Projects section
      if (projectsRef.current) {
        gsap.fromTo(
          projectsRef.current,
          { opacity: 0, y: 30 },
          {
            opacity: 1,
            y: 0,
            duration: DURATION_SECTION,
            ease: EASE_ENTER,
            scrollTrigger: {
              trigger: projectsRef.current,
              start: "top 80%",
              toggleActions: "play none none none",
            },
          }
        );
      }

      // Timeline line growth
      if (lineRef.current) {
        gsap.fromTo(
          lineRef.current,
          { scaleY: 0 },
          {
            scaleY: 1,
            ease: "none",
            scrollTrigger: {
              trigger: timelineRef.current,
              start: "top 60%",
              end: "bottom 40%",
              scrub: 1,
            },
          }
        );
      }

      // Timeline items
      timelineItemsRef.current.forEach((el, i) => {
        if (!el) return;
        gsap.fromTo(
          el,
          { opacity: 0, x: -30 },
          {
            opacity: 1,
            x: 0,
            duration: DURATION_SECTION,
            ease: EASE_ENTER,
            scrollTrigger: {
              trigger: el,
              start: "top 82%",
              toggleActions: "play none none none",
            },
            delay: i * 0.06,
          }
        );
      });

      // CTA section
      if (ctaRef.current) {
        gsap.fromTo(
          ctaRef.current,
          { opacity: 0, y: 30 },
          {
            opacity: 1,
            y: 0,
            duration: DURATION_SECTION,
            ease: EASE_ENTER,
            scrollTrigger: {
              trigger: ctaRef.current,
              start: "top 80%",
              toggleActions: "play none none none",
            },
          }
        );
      }
    });

    return () => ctx.revert();
  }, []);

  return (
    <SmoothScroll>
      <main className="min-h-screen" style={{ background: "var(--color-bg-main)" }}>

        {/* ============================================ */}
        {/* HERO — bold, experimental */}
        {/* ============================================ */}
        <section className="min-h-screen flex items-center justify-center px-6 pt-32 pb-20 relative overflow-hidden">
          {/* Subtle background ASCII texture */}
          <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] pointer-events-none select-none">
            <pre className="font-mono text-[8px] leading-[10px] text-white whitespace-pre" style={{ letterSpacing: "2px" }}>
              {Array.from({ length: 30 }, (_, r) =>
                Array.from({ length: 80 }, (_, c) =>
                  "░▒▓█·:;+=#"[(r * 127 + c * 31 + r * c) % 10]
                ).join("")
              ).join("\n")}
            </pre>
          </div>

          <div ref={heroRef} className="max-w-5xl mx-auto text-center relative z-10">
            <p
              data-reveal
              className="text-xs font-mono uppercase tracking-[0.3em] mb-6"
              style={{ color: "var(--color-accent-cyan)" }}
            >
              For Students
            </p>
            <div data-reveal>
              <AsciiReveal
                className="font-heading text-5xl md:text-6xl lg:text-7xl font-bold leading-tight mb-6"
                scrambleDuration={1.0}
                triggerOnScroll={false}
              >
                Build Real Things. Ship Real Code. Make Real Impact.
              </AsciiReveal>
            </div>
            <p
              data-reveal
              className="text-lg md:text-xl max-w-2xl mx-auto mb-12 leading-relaxed"
              style={{ color: "var(--color-text-soft)" }}
            >
              Join a nationwide collective of student developers building
              production software for nonprofits. This isn&apos;t a hackathon — this
              is your career starting now.
            </p>
            <div data-reveal className="flex flex-col sm:flex-row gap-4 justify-center">
              <button className="rounded-full bg-[#002FA7] px-8 py-4 text-sm font-medium text-[#F1FFFF] transition-all hover:bg-[#0039CC]">
                Start a Chapter
              </button>
              <button className="rounded-full border border-zinc-700 px-8 py-4 text-sm font-medium text-zinc-300 transition-all hover:border-zinc-500 hover:text-white">
                Find Existing Chapter
              </button>
            </div>
          </div>
        </section>

        <AsciiDivider rows={3} cols={70} color="var(--color-accent-cyan)" />

        {/* ============================================ */}
        {/* WHY JOIN — benefit cards */}
        {/* ============================================ */}
        <section className="py-32 px-6" style={{ background: "var(--color-bg-alt)" }}>
          <div ref={benefitsRef} className="max-w-5xl mx-auto">
            <h2 className="font-heading text-3xl md:text-4xl font-semibold text-center mb-16">
              Why Join Tethos
            </h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {benefits.map((b, i) => (
                <div
                  key={b.title}
                  ref={(el) => { benefitCardsRef.current[i] = el; }}
                  className="rounded-2xl border p-6 transition-all duration-300 hover:border-[var(--color-accent-cyan)]/30 hover:shadow-[0_0_30px_rgba(34,211,238,0.05)]"
                  style={{
                    background: "var(--color-surface)",
                    borderColor: "var(--glass-border-soft)",
                    opacity: 0,
                    transformStyle: "preserve-3d",
                  }}
                >
                  <span
                    className="font-mono text-xs font-bold mb-4 block"
                    style={{ color: "var(--color-accent-cyan)" }}
                  >
                    {b.icon}
                  </span>
                  <h3 className="font-heading text-lg font-semibold mb-2">
                    {b.title}
                  </h3>
                  <p
                    className="text-sm leading-relaxed"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    {b.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ============================================ */}
        {/* WHAT YOU'LL WORK ON */}
        {/* ============================================ */}
        <section className="py-24 px-6" style={{ background: "var(--color-bg-main)" }}>
          <div ref={projectsRef} className="max-w-4xl mx-auto text-center" style={{ opacity: 0 }}>
            <h2 className="font-heading text-3xl md:text-4xl font-semibold mb-12">
              What You&apos;ll Build
            </h2>
            <div className="flex flex-wrap justify-center gap-3">
              {projectTypes.map((type) => (
                <span
                  key={type}
                  className="rounded-full border px-5 py-2.5 text-sm font-medium transition-colors duration-300 hover:border-[var(--color-accent-cyan)]/50 hover:text-[var(--color-accent-cyan)]"
                  style={{
                    borderColor: "var(--glass-border-soft)",
                    color: "var(--color-text-soft)",
                  }}
                >
                  {type}
                </span>
              ))}
            </div>
          </div>
        </section>

        <AsciiDivider rows={2} cols={50} color="var(--color-accent-purple)" />

        {/* ============================================ */}
        {/* VERTICAL ANIMATED TIMELINE */}
        {/* ============================================ */}
        <section
          ref={timelineRef}
          className="py-32 px-6"
          style={{ background: "var(--color-bg-alt)" }}
        >
          <div className="max-w-3xl mx-auto">
            <h2 className="font-heading text-3xl md:text-4xl font-semibold text-center mb-20">
              How to Start a Chapter
            </h2>

            <div className="relative pl-12 md:pl-16">
              {/* Vertical line */}
              <div
                ref={lineRef}
                className="absolute left-4 md:left-6 top-0 bottom-0 w-px origin-top"
                style={{ background: "var(--color-accent-cyan)", opacity: 0.4 }}
              />

              <div className="space-y-14">
                {timelineSteps.map((step, i) => (
                  <div
                    key={step.phase}
                    ref={(el) => { timelineItemsRef.current[i] = el; }}
                    className="relative"
                    style={{ opacity: 0 }}
                  >
                    {/* Dot */}
                    <div
                      className="absolute w-3 h-3 rounded-full -left-[calc(2rem+6px)] md:-left-[calc(2.5rem+6px)] top-1"
                      style={{ background: "var(--color-accent-cyan)" }}
                    />
                    <span
                      className="font-mono text-xs font-bold block mb-1"
                      style={{ color: "var(--color-accent-cyan)" }}
                    >
                      {step.phase}
                    </span>
                    <h3 className="font-heading text-xl font-semibold mb-2">
                      {step.title}
                    </h3>
                    <p
                      className="text-sm leading-relaxed"
                      style={{ color: "var(--color-text-muted)" }}
                    >
                      {step.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ============================================ */}
        {/* CTA */}
        {/* ============================================ */}
        <section className="py-32 px-6" style={{ background: "var(--color-bg-main)" }}>
          <div ref={ctaRef} className="max-w-3xl mx-auto text-center" style={{ opacity: 0 }}>
            <h2 className="font-heading text-4xl md:text-5xl font-semibold mb-6">
              Ready to Start?
            </h2>
            <p
              className="text-lg mb-10 max-w-xl mx-auto"
              style={{ color: "var(--color-text-muted)" }}
            >
              Join hundreds of students building the future of technology for
              social good. Your chapter starts here.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button className="rounded-full bg-[#002FA7] px-8 py-4 text-sm font-medium text-[#F1FFFF] transition-all hover:bg-[#0039CC]">
                Apply to Start a Chapter
              </button>
              <button className="rounded-full border border-zinc-700 px-8 py-4 text-sm font-medium text-zinc-300 transition-all hover:border-zinc-500 hover:text-white">
                Sign In
              </button>
            </div>
          </div>
        </section>
      </main>
    </SmoothScroll>
  );
}
