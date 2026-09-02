"use client";

import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import GradientText from "@/components/ui/GradientText";
import SpotlightCard from "@/components/ui/SpotlightCard";
import DecryptedText from "@/components/ui/DecryptedText";
import DotNav from "@/components/ui/DotNav";
import type { DotNavSection } from "@/components/ui/DotNav";
import LogoLoop from "@/components/ui/LogoLoop";
import { ALUMNI_LOGOS } from "@/components/ui/PartnerLogos";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

/* ═══════════════════════════════════════════
   DATA
   ═══════════════════════════════════════════ */

// Mirrors the public positions live at /student/apply for the fall 2026
// round (migration 027). Keep in sync when a round opens or closes.
const POSITIONS = [
  {
    role: "VP Marketing",
    team: "Leadership",
    status: "open",
    description:
      "Own TSI's creative vision. Posts that stop the scroll, videos that tell our story, mastery of one craft.",
  },
  {
    role: "Project Manager",
    team: "Projects",
    status: "open",
    description:
      "CEO of your own project. Lead a team of developers building real software for a nonprofit client, kickoff to GENESIS.",
  },
];

const STATS = [
  { value: "150+", label: "Alumni shipped", desc: "Students who've built real products" },
  { value: "20+", label: "Projects live", desc: "Production software running today" },
  { value: "$0", label: "Cost to join", desc: "Always free. You bring the talent." },
];

const CHAPTER_STEPS = [
  { cmd: "gather", desc: "Find 5-10 students at your school" },
  { cmd: "apply", desc: "Submit your team application" },
  { cmd: "onboard", desc: "Get approved + receive playbook" },
  { cmd: "build", desc: "Start building for nonprofits" },
];

const SECTIONS: DotNavSection[] = [
  { id: "student-hero", label: "Home" },
  { id: "student-positions", label: "Positions" },
  { id: "student-why", label: "Why Join" },
  { id: "student-chapter", label: "Chapters" },
];

/* ═══════════════════════════════════════════
   TERMINAL BOOT HERO
   ═══════════════════════════════════════════ */

const BOOT_LINES = [
  { text: "TETHOS SYSTEM v4.0.1", color: "rgba(255,255,255,0.2)", delay: 200 },
  { text: "Initializing student portal...", color: "rgba(255,255,255,0.15)", delay: 300 },
  { text: "Loading modules: [recruitment] [chapters] [portal]", color: "rgba(255,255,255,0.15)", delay: 200 },
  { text: "███████████████████████████████ 100%", color: "rgba(29,155,240,0.5)", delay: 400 },
  { text: "", color: "", delay: 100 },
  { text: "System ready. Select a command:", color: "rgba(255,255,255,0.4)", delay: 300 },
];

function TerminalBoot() {
  const [visibleLines, setVisibleLines] = useState(0);
  const [bootDone, setBootDone] = useState(false);

  useEffect(() => {
    if (visibleLines >= BOOT_LINES.length) {
      setTimeout(() => setBootDone(true), 200);
      return;
    }
    const delay = BOOT_LINES[visibleLines].delay;
    const timer = setTimeout(() => setVisibleLines((v) => v + 1), delay);
    return () => clearTimeout(timer);
  }, [visibleLines]);

  return (
    <div className="max-w-[600px] mx-auto">
      {/* Boot sequence */}
      <div
        className="rounded-xl overflow-hidden mb-10"
        style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}
      >
        <div className="px-4 py-2.5 flex items-center gap-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
          <div className="w-2 h-2 rounded-full" style={{ background: "rgba(255,255,255,0.08)" }} />
          <div className="w-2 h-2 rounded-full" style={{ background: "rgba(255,255,255,0.08)" }} />
          <div className="w-2 h-2 rounded-full" style={{ background: "rgba(255,255,255,0.08)" }} />
          <span className="ml-2 text-[10px]" style={{ color: "rgba(255,255,255,0.15)", fontFamily: "var(--font-highlight)" }}>
            tethos-student
          </span>
        </div>
        <div className="p-5 text-xs leading-loose" style={{ fontFamily: "var(--font-highlight)", minHeight: "160px" }}>
          {BOOT_LINES.slice(0, visibleLines).map((line, i) => (
            <p key={i} style={{ color: line.color }}>{line.text}</p>
          ))}
          {!bootDone && visibleLines < BOOT_LINES.length && (
            <span className="inline-block w-2 h-3.5 align-middle" style={{ background: "#1d9bf0", animation: "blink 1.2s step-end infinite" }} />
          )}
        </div>
      </div>

      {/* Command CTAs -- appear after boot */}
      <AnimatePresence>
        {bootDone && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="flex flex-col gap-3"
          >
            {[
              { cmd: "tethos apply", label: "Browse open positions", href: "/student/apply", accent: "#1D9BF0" },
              { cmd: "tethos login", label: "Sign in to portal", href: "/student/login", accent: "#1d9bf0" },
              { cmd: "tethos init-chapter", label: "Start a chapter", href: "#student-chapter", accent: "#c9a84c" },
            ].map((item, i) => (
              <motion.div
                key={item.cmd}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.12, duration: 0.4 }}
              >
                <Link
                  href={item.href}
                  className="group flex items-center gap-4 px-5 py-4 rounded-lg transition-all duration-300 cursor-pointer"
                  style={{
                    background: "rgba(255,255,255,0.02)",
                    border: "1px solid rgba(255,255,255,0.06)",
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = `${item.accent}40`; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.06)"; }}
                >
                  <span
                    className="text-xs font-medium shrink-0"
                    style={{ color: item.accent, fontFamily: "var(--font-highlight)" }}
                  >
                    $ {item.cmd}
                  </span>
                  <span className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>
                    {item.label}
                  </span>
                  <span
                    className="ml-auto text-xs group-hover:translate-x-1 transition-transform duration-200"
                    style={{ color: `${item.accent}80` }}
                  >
                    →
                  </span>
                </Link>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <style jsx>{`
        @keyframes blink {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}

/* ═══════════════════════════════════════════
   POSITION CARD
   ═══════════════════════════════════════════ */

function PositionCard({ position, index }: { position: typeof POSITIONS[0]; index: number }) {
  const isOpen = position.status === "open";

  return (
    <SpotlightCard
      className="position-card rounded-xl p-0 overflow-hidden cursor-pointer"
      spotlightColor={isOpen ? "rgba(29,155,240,0.08)" : "rgba(255,255,255,0.04)"}
      style={{
        background: "rgba(255,255,255,0.02)",
        border: `1px solid ${isOpen ? "rgba(29,155,240,0.15)" : "rgba(255,255,255,0.06)"}`,
        opacity: 0,
      }}
    >
      {/* Terminal-style header */}
      <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
        <span className="text-[10px] uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.2)", fontFamily: "var(--font-highlight)" }}>
          {position.team}
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{
              background: isOpen ? "#1D9BF0" : "rgba(255,255,255,0.15)",
              boxShadow: isOpen ? "0 0 6px rgba(29,155,240,0.5)" : "none",
              animation: isOpen ? "pulse 2s ease-in-out infinite" : "none",
            }}
          />
          <span className="text-[10px] uppercase tracking-widest" style={{ color: isOpen ? "#1D9BF0" : "rgba(255,255,255,0.25)", fontFamily: "var(--font-highlight)" }}>
            {isOpen ? "Open" : "Coming"}
          </span>
        </span>
      </div>

      {/* Content */}
      <div className="p-5">
        <h3 className="text-base font-medium tracking-tight mb-2" style={{ color: "#F1FFFF", fontWeight: 500 }}>
          {position.role}
        </h3>
        <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.4)" }}>
          {position.description}
        </p>
      </div>

      <style jsx>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </SpotlightCard>
  );
}

/* ═══════════════════════════════════════════
   CHAPTER TERMINAL (typewriter)
   ═══════════════════════════════════════════ */

function ChapterTerminal() {
  const [visibleSteps, setVisibleSteps] = useState(0);
  const [started, setStarted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting && !started) setStarted(true); },
      { threshold: 0.5 }
    );
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [started]);

  useEffect(() => {
    if (!started || visibleSteps >= CHAPTER_STEPS.length) return;
    const timer = setTimeout(() => setVisibleSteps((v) => v + 1), 400);
    return () => clearTimeout(timer);
  }, [started, visibleSteps]);

  return (
    <div ref={containerRef} className="p-5 text-xs" style={{ fontFamily: "var(--font-highlight)", minHeight: "140px" }}>
      {CHAPTER_STEPS.slice(0, visibleSteps).map((step, i) => (
        <div key={step.cmd} className="flex items-start gap-3 mb-4 last:mb-0">
          <span style={{ color: "rgba(201,168,76,0.6)" }}>0{i + 1}</span>
          <div>
            <p style={{ color: "rgba(201,168,76,0.8)" }}>
              <span style={{ color: "rgba(255,255,255,0.25)" }}>$</span> tethos chapter {step.cmd}
            </p>
            <p className="mt-0.5" style={{ color: "rgba(255,255,255,0.3)" }}># {step.desc}</p>
          </div>
        </div>
      ))}
      {started && visibleSteps < CHAPTER_STEPS.length && (
        <span className="inline-block w-2 h-3.5 align-middle" style={{ background: "rgba(201,168,76,0.6)", animation: "blink 1.2s step-end infinite" }} />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════
   PAGE
   ═══════════════════════════════════════════ */

export default function StudentPage() {
  const positionsRef = useRef<HTMLDivElement>(null);
  const whyRef = useRef<HTMLDivElement>(null);
  const chapterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const ctx = gsap.context(() => {
      if (prefersReducedMotion) {
        document.querySelectorAll(".position-card, .stat-card, .step-item, [data-reveal]").forEach((el) => {
          gsap.set(el, { opacity: 1 });
        });
        return;
      }

      // Position cards stagger
      const cards = positionsRef.current?.querySelectorAll(".position-card");
      if (cards) {
        gsap.fromTo(Array.from(cards), { opacity: 0, y: 30, scale: 0.95 }, {
          opacity: 1, y: 0, scale: 1, duration: 0.6, ease: "power3.out", stagger: 0.08,
          scrollTrigger: { trigger: positionsRef.current, start: "top 70%", once: true },
        });
      }

      // Stats slide in from left
      const stats = whyRef.current?.querySelectorAll(".stat-card");
      if (stats) {
        gsap.fromTo(Array.from(stats), { opacity: 0, x: -30 }, {
          opacity: 1, x: 0, duration: 0.6, ease: "power3.out", stagger: 0.12,
          scrollTrigger: { trigger: whyRef.current, start: "top 70%", once: true },
        });
      }

      // Chapter steps stagger
      const steps = chapterRef.current?.querySelectorAll(".step-item");
      if (steps) {
        gsap.fromTo(Array.from(steps), { opacity: 0, x: 20 }, {
          opacity: 1, x: 0, duration: 0.5, ease: "power3.out", stagger: 0.1,
          scrollTrigger: { trigger: chapterRef.current, start: "top 70%", once: true },
        });
      }
    });

    return () => ctx.revert();
  }, []);

  return (
    <main className="min-h-screen">
      <DotNav sections={SECTIONS} />

      {/* ── HERO: Terminal Boot ── */}
      <section
        id="student-hero"
        data-navbar-theme="dark"
        className="relative min-h-screen flex items-center justify-center px-8 md:px-20 lg:px-28 overflow-hidden"
        style={{ background: "#0F0F10" }}
      >
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none" style={{ width: "800px", height: "600px", background: "radial-gradient(ellipse, rgba(29,155,240,0.06) 0%, transparent 70%)", filter: "blur(40px)" }} />

        <div className="relative w-full py-32 text-center">
          <h1
            className="mb-4"
            style={{
              fontFamily: '"Test Sohne", sans-serif',
              fontSize: "clamp(36px, 5.5vw, 68px)",
              fontWeight: 500,
              color: "#F1FFFF",
              lineHeight: 1.08,
              letterSpacing: "-0.03em",
            }}
          >
            Build real things.
            <br />
            <GradientText colors={["#1D9BF0", "#5DB8F5", "#1D9BF0"]} animationSpeed={5}>
              Ship real code.
            </GradientText>
          </h1>
          <p className="text-base md:text-lg leading-relaxed mb-8 mx-auto" style={{ color: "rgba(255,255,255,0.4)", maxWidth: "480px" }}>
            Join 150+ students building production software for nonprofits.
          </p>

          <TerminalBoot />
        </div>
      </section>

      {/* ── POSITIONS ── */}
      <section
        id="student-positions"
        data-navbar-theme="dark"
        className="relative py-32 md:py-44 px-8 md:px-20 lg:px-28 overflow-hidden"
        style={{ background: "#0a0a0b" }}
      >
        <div className="absolute top-0 left-0 right-0 pointer-events-none" style={{ height: "200px", background: "linear-gradient(to bottom, #0F0F10, #0a0a0b)" }} />

        <div ref={positionsRef} className="relative max-w-[1200px] mx-auto">
          <p className="text-xs tracking-widest uppercase mb-4" style={{ color: "#1D9BF0", fontFamily: "var(--font-highlight)" }}>
            <DecryptedText text="Now recruiting" speed={40} maxIterations={12} sequential characters="01!@#$%_-+=<>" className="text-[#1D9BF0]" encryptedClassName="text-[rgba(29,155,240,0.3)]" animateOn="view" />
          </p>
          <h2 className="tracking-tight mb-4" style={{ fontFamily: '"Test Sohne", sans-serif', fontSize: "clamp(28px, 4vw, 48px)", fontWeight: 500, color: "#F1FFFF", lineHeight: 1.1 }}>
            Open positions.
          </h2>
          <p className="text-sm mb-12" style={{ color: "rgba(255,255,255,0.3)", fontFamily: "var(--font-highlight)" }}>
            2026-27 executive team, fall round. Applications open Sept 5 and close Sept 11
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {POSITIONS.map((pos, i) => (
              <Link key={pos.role} href="/student/apply">
                <PositionCard position={pos} index={i} />
              </Link>
            ))}
          </div>

          <div className="mt-8 text-center">
            <Link
              href="/student/apply"
              className="inline-flex items-center px-7 py-3.5 rounded-lg text-sm font-semibold transition-all duration-300"
              style={{ background: "#1D9BF0", color: "#0F0F10" }}
              onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "0 0 30px rgba(29,155,240,0.3)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "none"; }}
            >
              View all positions →
            </Link>
          </div>
        </div>
      </section>

      {/* ── WHY JOIN ── */}
      <section
        id="student-why"
        data-navbar-theme="dark"
        className="relative py-28 md:py-36 px-8 md:px-20 lg:px-28"
        style={{ background: "#0F0F10" }}
      >
        <div className="absolute top-0 left-0 right-0 pointer-events-none" style={{ height: "200px", background: "linear-gradient(to bottom, #0a0a0b, #0F0F10)" }} />

        <div ref={whyRef} className="relative max-w-[1200px] mx-auto">
          {/* ASCII art interactive element */}
          <div className="text-center mb-16">
            <pre
              className="inline-block text-[8px] md:text-[10px] leading-tight select-none"
              style={{ color: "rgba(29,155,240,0.2)", fontFamily: "var(--font-highlight)", letterSpacing: "2px" }}
            >
{`  ████████╗███████╗████████╗██╗  ██╗ ██████╗ ███████╗
  ╚══██╔══╝██╔════╝╚══██╔══╝██║  ██║██╔═══██╗██╔════╝
     ██║   █████╗     ██║   ███████║██║   ██║███████╗
     ██║   ██╔══╝     ██║   ██╔══██║██║   ██║╚════██║
     ██║   ███████╗   ██║   ██║  ██║╚██████╔╝███████║
     ╚═╝   ╚══════╝   ╚═╝   ╚═╝  ╚═╝ ╚═════╝ ╚══════╝`}
            </pre>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-14">
            {STATS.map((stat, i) => (
              <div
                key={stat.label}
                className="stat-card rounded-xl p-8"
                style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", opacity: 0 }}
              >
                <p className="text-4xl md:text-5xl font-medium tracking-tight mb-2 stat-number" style={{ fontWeight: 500 }} data-value={stat.value}>
                  <GradientText colors={["#1d9bf0", "#60c5ff", "#1d9bf0"]} animationSpeed={6}>
                    {stat.value}
                  </GradientText>
                </p>
                <p className="text-sm font-medium mb-1" style={{ color: "#F1FFFF", fontWeight: 500 }}>{stat.label}</p>
                <p className="text-xs" style={{ color: "rgba(255,255,255,0.35)", fontFamily: "var(--font-highlight)" }}>{stat.desc}</p>
              </div>
            ))}
          </div>

          {/* Alumni destinations */}
          <div>
            <p className="text-center text-xs tracking-widest uppercase mb-5" style={{ color: "rgba(255,255,255,0.2)", fontFamily: "var(--font-highlight)" }}>
              Where our alumni work
            </p>
            <LogoLoop
              logos={ALUMNI_LOGOS}
              speed={50}
              gap={60}
              fadeOut
              fadeOutColor="#0F0F10"
              pauseOnHover
            />
          </div>
        </div>
      </section>

      {/* ── START A CHAPTER ── */}
      <section
        id="student-chapter"
        data-navbar-theme="dark"
        className="relative py-32 md:py-44 px-8 md:px-20 lg:px-28 overflow-hidden"
        style={{ background: "#0a0a0b" }}
      >
        <div className="absolute top-0 left-0 right-0 pointer-events-none" style={{ height: "200px", background: "linear-gradient(to bottom, #0F0F10, #0a0a0b)" }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none" style={{ width: "700px", height: "400px", background: "radial-gradient(ellipse, rgba(201,168,76,0.06) 0%, transparent 70%)", filter: "blur(40px)" }} />

        <div ref={chapterRef} className="relative max-w-[800px] mx-auto">
          <div className="flex flex-col lg:flex-row gap-16">
            {/* Left: text */}
            <div className="lg:w-1/2">
              <p className="text-xs tracking-widest uppercase mb-4" style={{ color: "#c9a84c", fontFamily: "var(--font-highlight)" }}>
                <DecryptedText text="Expand the network" speed={40} maxIterations={12} sequential characters="01!@#$%_-+=<>" className="text-[#c9a84c]" encryptedClassName="text-[rgba(201,168,76,0.3)]" animateOn="view" />
              </p>
              <h2 className="tracking-tight mb-6" style={{ fontFamily: '"Test Sohne", sans-serif', fontSize: "clamp(28px, 4vw, 44px)", fontWeight: 500, color: "#F1FFFF", lineHeight: 1.1 }}>
                Start a chapter at{" "}
                <GradientText colors={["#c9a84c", "#e8d48b", "#c9a84c"]} animationSpeed={6}>
                  your school.
                </GradientText>
              </h2>
              <p className="text-sm leading-relaxed mb-8" style={{ color: "rgba(255,255,255,0.4)" }}>
                Bring Tethos to your campus. Lead a team of student developers building real software for nonprofits in your community.
              </p>
              <a
                href="mailto:team@tethos.ca?subject=Start%20a%20Chapter"
                className="inline-flex items-center px-7 py-3.5 rounded-lg text-sm font-semibold transition-all duration-300"
                style={{ background: "#c9a84c", color: "#0F0F10" }}
                onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "0 0 30px rgba(201,168,76,0.3)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "none"; }}
              >
                Get started
              </a>
            </div>

            {/* Right: terminal steps */}
            <div className="lg:w-1/2">
              <div
                className="rounded-xl overflow-hidden"
                style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}
              >
                <div className="px-4 py-2.5 flex items-center gap-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                  <div className="w-2 h-2 rounded-full" style={{ background: "rgba(255,255,255,0.08)" }} />
                  <div className="w-2 h-2 rounded-full" style={{ background: "rgba(255,255,255,0.08)" }} />
                  <div className="w-2 h-2 rounded-full" style={{ background: "rgba(255,255,255,0.08)" }} />
                  <span className="ml-2 text-[10px]" style={{ color: "rgba(255,255,255,0.15)", fontFamily: "var(--font-highlight)" }}>
                    chapter-setup.sh
                  </span>
                </div>
                <ChapterTerminal />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── SIGN IN (compact) ── */}
      <section
        data-navbar-theme="dark"
        className="py-20 px-8 md:px-20 lg:px-28"
        style={{ background: "#0F0F10" }}
      >
        <div className="absolute left-0 right-0 pointer-events-none" style={{ height: "1px", background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.06) 20%, rgba(255,255,255,0.06) 80%, transparent)" }} />
        <div className="max-w-[600px] mx-auto text-center">
          <p className="text-sm mb-4" style={{ color: "rgba(255,255,255,0.3)", fontFamily: "var(--font-highlight)" }}>
            Already a member?
          </p>
          <Link
            href="/student/login"
            className="inline-flex items-center px-6 py-3 rounded-lg text-sm font-medium transition-all duration-300"
            style={{ color: "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.1)" }}
          >
            <span style={{ color: "#1d9bf0", fontFamily: "var(--font-highlight)", marginRight: "8px" }}>$</span>
            Sign in to portal
          </Link>
        </div>
      </section>
    </main>
  );
}
