"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { motion } from "framer-motion";
import Link from "next/link";
import GradientText from "@/components/ui/GradientText";
import DecryptedText from "@/components/ui/DecryptedText";
import ProjectBooks from "@/components/ui/ProjectBooks";
import type { Project } from "@/components/ui/ProjectBooks";
import LogoLoop from "@/components/ui/LogoLoop";
import { SPONSOR_LOGOS } from "@/components/ui/PartnerLogos";
import DotNav from "@/components/ui/DotNav";
import type { DotNavSection } from "@/components/ui/DotNav";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

/* ═══════════════════════════════════════════
   DATA
   ═══════════════════════════════════════════ */

const PROJECTS: Project[] = [
  {
    org: "World Vision",
    title: "Multi-agent research platform",
    description: "Internal multi-agent platform and reusable workflows to speed up research, segmentation, and proposal/project discovery.",
    tags: ["AI", "Multi-Agent", "Python"],
    color: "#f59e0b",
    stats: [{ label: "Reach", value: "80+ countries" }],
  },
  {
    org: "IRC",
    title: "LLM data pipeline",
    description: "LLM-assisted pipeline that converts inconsistent CSV/Excel provider data into a standardized schema for reliable database ingestion.",
    tags: ["LLM", "Python", "ETL"],
    color: "#1d9bf0",
    stats: [{ label: "Data sources", value: "50+" }],
  },
  {
    org: "Museum",
    title: "Astronaut spacewalk exhibit",
    description: "Hardware astronaut 'spacewalk repair' exhibit using a sensor glove + joystick to control a virtual hand and complete tasks.",
    tags: ["Hardware", "IoT", "Unity"],
    color: "#ec4899",
    stats: [{ label: "Type", value: "Hardware" }],
  },
  {
    org: "Childcan",
    title: "Website redesign & migration",
    description: "Redesigning and migrating their website to improve accessibility, navigation, and donation/resource flows.",
    tags: ["Next.js", "CMS", "A11y"],
    color: "#22c55e",
    stats: [{ label: "Users", value: "5K+" }],
  },
  {
    org: "Plan Int'l",
    title: "FRF reconciliation app",
    description: "Replacing legacy FRF reconciliation tool with a modern web app that automates monthly expense ingestion, calculations, and reporting.",
    tags: ["React", "Node.js", "Finance"],
    color: "#8b5cf6",
    stats: [{ label: "Process", value: "Automated" }],
  },
  {
    org: "Catalyst",
    title: "ML forecasting dashboard",
    description: "Cloud pipeline and ML forecasting system for public development indicators, delivered through an interactive map-based dashboard.",
    tags: ["ML", "D3.js", "AWS"],
    color: "#ef4444",
    stats: [{ label: "Indicators", value: "200+" }],
  },
  {
    org: "Red Cross",
    title: "SharePoint enhancement",
    description: "Enhancing SharePoint with tagging, stronger search, and automated reminders so teams can find accurate internal resources faster.",
    tags: ["SharePoint", "Power Automate"],
    color: "#f97316",
    stats: [{ label: "Teams", value: "15+" }],
  },
];

const EVENT_STATS = [
  { value: "150+", label: "Attendees" },
  { value: "7", label: "Projects" },
  { value: "60", label: "Developers" },
  { value: "20", label: "Executives" },
];

const SECTIONS: DotNavSection[] = [
  { id: "genesis-hero", label: "Genesis" },
  { id: "genesis-projects", label: "Projects" },
  { id: "genesis-recap", label: "Recap" },
  { id: "genesis-next", label: "2027" },
];

const EASE_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1];

/* ═══════════════════════════════════════════
   PAGE
   ═══════════════════════════════════════════ */

export default function GenesisPage() {
  const projectsRef = useRef<HTMLDivElement>(null);
  const recapRef = useRef<HTMLDivElement>(null);
  const nextRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) return;

    const ctx = gsap.context(() => {
      // Projects section
      gsap.fromTo(projectsRef.current, { opacity: 0, y: 40 }, {
        opacity: 1, y: 0, duration: 0.9, ease: "power3.out",
        scrollTrigger: { trigger: projectsRef.current, start: "top 70%", once: true },
      });

      // Recap
      const recapEls = recapRef.current?.querySelectorAll("[data-reveal]");
      if (recapEls) {
        gsap.fromTo(Array.from(recapEls), { opacity: 0, y: 30 }, {
          opacity: 1, y: 0, duration: 0.7, ease: "power3.out", stagger: 0.1,
          scrollTrigger: { trigger: recapRef.current, start: "top 70%", once: true },
        });
      }

      // Next section
      gsap.fromTo(nextRef.current, { opacity: 0, y: 30 }, {
        opacity: 1, y: 0, duration: 0.8, ease: "power3.out",
        scrollTrigger: { trigger: nextRef.current, start: "top 75%", once: true },
      });
    });

    return () => ctx.revert();
  }, []);

  return (
    <main className="min-h-screen">
      <DotNav sections={SECTIONS} />

      {/* ═══ HERO ═══ */}
      <section
        id="genesis-hero"
        data-navbar-theme="dark"
        className="relative min-h-screen flex items-center justify-center px-8 md:px-20 lg:px-28 overflow-hidden"
        style={{ background: "#0F0F10" }}
      >
        {/* Warm cinematic glow -- not cold blue like other pages */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none" style={{ width: "1000px", height: "600px", background: "radial-gradient(ellipse, rgba(245,158,11,0.06) 0%, rgba(29,155,240,0.03) 40%, transparent 70%)", filter: "blur(40px)" }} />

        <div className="relative max-w-[900px] mx-auto text-center py-32">
          {/* Mono label */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-xs tracking-widest uppercase mb-8"
            style={{ color: "rgba(245,158,11,0.7)", fontFamily: "var(--font-highlight)" }}
          >
            <DecryptedText text="Tethos Flagship Event" speed={40} maxIterations={12} sequential characters="01!@#$%_-+=<>" className="text-[rgba(245,158,11,0.7)]" encryptedClassName="text-[rgba(245,158,11,0.3)]" animateOn="view" />
          </motion.p>

          {/* Large title */}
          <motion.h1
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.3, ease: EASE_OUT }}
            className="mb-10"
            style={{
              fontFamily: '"Test Sohne", sans-serif',
              fontSize: "clamp(48px, 8vw, 120px)",
              fontWeight: 500,
              color: "#F1FFFF",
              lineHeight: 0.95,
              letterSpacing: "-0.04em",
            }}
          >
            <GradientText colors={["#f59e0b", "#fbbf24", "#f59e0b"]} animationSpeed={8}>
              GENESIS
            </GradientText>
          </motion.h1>

          {/* Dictionary card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.5, ease: EASE_OUT }}
            className="max-w-[520px] mx-auto mb-14 rounded-xl p-6 text-left"
            style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}
          >
            <div className="flex items-baseline gap-3 mb-3">
              <span style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: "18px", fontWeight: 700, color: "#F1FFFF" }}>
                gen·e·sis
              </span>
              <span style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: "14px", fontStyle: "italic", color: "rgba(255,255,255,0.35)" }}>
                /ˈjenəsəs/
              </span>
            </div>
            <p className="text-xs mb-1" style={{ color: "rgba(255,255,255,0.25)", fontFamily: "var(--font-highlight)" }}>noun</p>
            <ol className="text-sm leading-relaxed space-y-2" style={{ color: "rgba(255,255,255,0.5)" }}>
              <li><span style={{ color: "rgba(255,255,255,0.25)", marginRight: "6px" }}>1.</span> the origin or beginning of something.</li>
              <li><span style={{ color: "rgba(255,255,255,0.25)", marginRight: "6px" }}>2.</span> the moment a creation is set into motion to fulfill its purpose.</li>
            </ol>
            <p className="mt-4 text-xs leading-relaxed" style={{ color: "rgba(245,158,11,0.6)", fontStyle: "italic" }}>
              &ldquo;GENESIS marks the moment student-built projects are handed off to nonprofit partners, becoming real tools for real impact.&rdquo;
            </p>
          </motion.div>

          {/* Event stats */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.65, ease: EASE_OUT }}
            className="flex flex-wrap justify-center gap-8 md:gap-12 mb-12"
          >
            {EVENT_STATS.map((stat) => (
              <div key={stat.label} className="text-center">
                <p className="text-2xl md:text-3xl font-medium tracking-tight" style={{ color: "#F1FFFF", fontWeight: 500 }}>{stat.value}</p>
                <p className="text-[10px] uppercase tracking-widest mt-1" style={{ color: "rgba(255,255,255,0.3)", fontFamily: "var(--font-highlight)" }}>{stat.label}</p>
              </div>
            ))}
          </motion.div>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.8, ease: EASE_OUT }}
            className="flex flex-wrap justify-center gap-4"
          >
            <a
              href="#genesis-recap"
              className="inline-flex items-center px-7 py-3.5 rounded-lg text-sm font-semibold transition-all duration-300"
              style={{ background: "#f59e0b", color: "#0F0F10" }}
              onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "0 0 30px rgba(245,158,11,0.3)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "none"; }}
            >
              Watch Recap
            </a>
            <Link
              href="/sponsor"
              className="inline-flex items-center px-7 py-3.5 rounded-lg text-sm font-medium transition-all duration-300"
              style={{ color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.1)" }}
            >
              Sponsor 2027
            </Link>
          </motion.div>
        </div>
      </section>

      {/* ═══ PROJECT SHOWCASE ═══ */}
      <section
        id="genesis-projects"
        data-navbar-theme="dark"
        className="relative py-32 md:py-44 px-8 md:px-20 lg:px-28 overflow-hidden"
        style={{ background: "#0a0a0b" }}
      >
        <div className="absolute top-0 left-0 right-0 pointer-events-none" style={{ height: "200px", background: "linear-gradient(to bottom, #0F0F10, #0a0a0b)" }} />

        <div ref={projectsRef} className="relative max-w-[1400px] mx-auto" style={{ opacity: 0 }}>
          <p className="text-xs tracking-widest uppercase mb-4" style={{ color: "rgba(245,158,11,0.7)", fontFamily: "var(--font-highlight)" }}>
            <DecryptedText text="2025-26 Projects" speed={40} maxIterations={12} sequential characters="01!@#$%_-+=<>" className="text-[rgba(245,158,11,0.7)]" encryptedClassName="text-[rgba(245,158,11,0.3)]" animateOn="view" />
          </p>
          <h2 className="tracking-tight mb-4" style={{ fontFamily: '"Test Sohne", sans-serif', fontSize: "clamp(28px, 4vw, 48px)", fontWeight: 500, color: "#F1FFFF", lineHeight: 1.1 }}>
            7 projects. 7 nonprofits.{" "}
            <GradientText colors={["#f59e0b", "#fbbf24", "#f59e0b"]} animationSpeed={6}>
              Delivered.
            </GradientText>
          </h2>
          <p className="text-sm mb-14" style={{ color: "rgba(255,255,255,0.3)", fontFamily: "var(--font-highlight)" }}>
            Hover to explore each project
          </p>

          <ProjectBooks projects={PROJECTS} />
        </div>
      </section>

      {/* ═══ RECAP / GALLERY ═══ */}
      <section
        id="genesis-recap"
        data-navbar-theme="dark"
        className="relative py-32 md:py-44 px-8 md:px-20 lg:px-28 overflow-hidden"
        style={{ background: "#0F0F10" }}
      >
        <div className="absolute top-0 left-0 right-0 pointer-events-none" style={{ height: "200px", background: "linear-gradient(to bottom, #0a0a0b, #0F0F10)" }} />

        <div ref={recapRef} className="relative max-w-[1100px] mx-auto">
          <p data-reveal className="text-xs tracking-widest uppercase mb-4" style={{ color: "rgba(245,158,11,0.7)", fontFamily: "var(--font-highlight)", opacity: 0 }}>
            Genesis 2026
          </p>
          <h2 data-reveal className="tracking-tight mb-12" style={{ fontFamily: '"Test Sohne", sans-serif', fontSize: "clamp(28px, 4vw, 48px)", fontWeight: 500, color: "#F1FFFF", lineHeight: 1.1, opacity: 0 }}>
            The showcase.
          </h2>

          {/* Video embed placeholder */}
          <div
            data-reveal
            className="rounded-xl overflow-hidden mb-12"
            style={{
              aspectRatio: "16/9",
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.06)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              opacity: 0,
            }}
          >
            {/* Replace this div with: <iframe src="YOUR_VIDEO_URL" ... /> */}
            <div className="text-center">
              <p className="text-sm mb-2" style={{ color: "rgba(255,255,255,0.3)", fontFamily: "var(--font-highlight)" }}>
                Documentary coming soon
              </p>
              <p className="text-xs" style={{ color: "rgba(255,255,255,0.15)", fontFamily: "var(--font-highlight)" }}>
                Video embed will be placed here
              </p>
            </div>
          </div>

          {/* Photo grid placeholder */}
          <div data-reveal className="grid grid-cols-2 md:grid-cols-4 gap-3" style={{ opacity: 0 }}>
            {["Demo booths", "Stage", "Crowd", "Team"].map((label, i) => (
              <div
                key={label}
                className="rounded-xl overflow-hidden flex items-center justify-center"
                style={{
                  height: i === 0 ? "clamp(200px, 25vh, 300px)" : "clamp(160px, 20vh, 240px)",
                  gridColumn: i === 0 ? "span 2" : "span 1",
                  background: "rgba(255,255,255,0.02)",
                  border: "1px solid rgba(255,255,255,0.04)",
                }}
              >
                {/* Replace with: <Image src="/images/genesis/photo-{i}.jpg" ... /> */}
                <span className="text-[10px] uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.15)", fontFamily: "var(--font-highlight)" }}>
                  {label} photo
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ FLOOR PLAN (placeholder) ═══ */}
      {/* Interactive 3D floor plan will be built separately */}

      {/* ═══ GENESIS 2027 TEASER ═══ */}
      <section
        id="genesis-next"
        data-navbar-theme="dark"
        className="relative py-32 md:py-44 px-8 md:px-20 lg:px-28 overflow-hidden"
        style={{ background: "#0a0a0b" }}
      >
        <div className="absolute top-0 left-0 right-0 pointer-events-none" style={{ height: "200px", background: "linear-gradient(to bottom, #0F0F10, #0a0a0b)" }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none" style={{ width: "700px", height: "400px", background: "radial-gradient(ellipse, rgba(245,158,11,0.06) 0%, transparent 70%)", filter: "blur(40px)" }} />

        <div ref={nextRef} className="relative max-w-[700px] mx-auto text-center" style={{ opacity: 0 }}>
          {/* Divider */}
          <div className="flex justify-center mb-16">
            <div style={{ width: "120px", height: "1px", background: "linear-gradient(90deg, transparent, rgba(245,158,11,0.4), transparent)" }} />
          </div>

          <p className="text-xs tracking-widest uppercase mb-6" style={{ color: "rgba(245,158,11,0.7)", fontFamily: "var(--font-highlight)" }}>
            Coming 2027
          </p>
          <h2 className="tracking-tight mb-6" style={{ fontFamily: '"Test Sohne", sans-serif', fontSize: "clamp(36px, 5vw, 64px)", fontWeight: 500, color: "#F1FFFF", lineHeight: 1.08, letterSpacing: "-0.02em" }}>
            The next{" "}
            <GradientText colors={["#f59e0b", "#fbbf24", "#f59e0b"]} animationSpeed={6}>
              chapter.
            </GradientText>
          </h2>
          <p className="text-base leading-relaxed mb-10 mx-auto" style={{ color: "rgba(255,255,255,0.4)", maxWidth: "480px" }}>
            Genesis 2027 is in planning. Stay connected for announcements on date, venue, and how to get involved.
          </p>

          <div className="flex flex-wrap justify-center gap-4 mb-16">
            <Link
              href="/sponsor"
              className="inline-flex items-center px-7 py-3.5 rounded-lg text-sm font-semibold transition-all duration-300"
              style={{ background: "#f59e0b", color: "#0F0F10" }}
              onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "0 0 30px rgba(245,158,11,0.3)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "none"; }}
            >
              Sponsor Genesis 2027
            </Link>
            <a
              href="mailto:team@tethos.ca?subject=Genesis%202027"
              className="inline-flex items-center px-7 py-3.5 rounded-lg text-sm font-medium transition-all duration-300"
              style={{ color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.1)" }}
            >
              Get notified
            </a>
          </div>

          {/* Sponsor trust strip */}
          <p className="text-xs tracking-widest uppercase mb-5" style={{ color: "rgba(255,255,255,0.2)", fontFamily: "var(--font-highlight)" }}>
            Powered by
          </p>
          <LogoLoop
            logos={SPONSOR_LOGOS}
            speed={40}
            gap={80}
            fadeOut
            fadeOutColor="#0a0a0b"
            pauseOnHover
          />
        </div>
      </section>
    </main>
  );
}
