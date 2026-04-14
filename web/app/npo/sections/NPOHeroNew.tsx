"use client";

import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import Link from "next/link";
import DecryptedText from "@/components/ui/DecryptedText";
import GradientText from "@/components/ui/GradientText";

const TERMINAL_LINES = [
  { type: "cmd", text: "$ tethos init --nonprofit" },
  { type: "info", text: "Initializing project scaffold...", delay: 400 },
  { type: "check", text: "Team assigned", meta: "(6 developers, 2 designers)", delay: 600 },
  { type: "check", text: "Discovery phase scheduled", delay: 200 },
  { type: "check", text: "Figma workspace created", delay: 200 },
  { type: "check", text: "GitHub repo provisioned", delay: 200 },
  { type: "check", text: "CI/CD pipeline configured", delay: 200 },
  { type: "meta", text: "info Estimated delivery: 8 months", delay: 400 },
  { type: "meta", text: "info Cost: $0.00", delay: 150 },
  { type: "cursor", text: "$", delay: 300 },
];

function TerminalTypewriter() {
  const [visibleLines, setVisibleLines] = useState(0);
  const [started, setStarted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Start after a delay to let the entrance animation finish
    const startTimer = setTimeout(() => setStarted(true), 1200);
    return () => clearTimeout(startTimer);
  }, []);

  useEffect(() => {
    if (!started || visibleLines >= TERMINAL_LINES.length) return;

    const nextDelay = (TERMINAL_LINES[visibleLines] as { delay?: number }).delay || 150;
    const timer = setTimeout(() => {
      setVisibleLines((v) => v + 1);
    }, nextDelay);

    return () => clearTimeout(timer);
  }, [started, visibleLines]);

  return (
    <div
      ref={containerRef}
      className="rounded-xl overflow-hidden"
      style={{
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      {/* Title bar */}
      <div
        className="flex items-center gap-2 px-4 py-3"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
      >
        <div className="w-2.5 h-2.5 rounded-full" style={{ background: "rgba(255,255,255,0.08)" }} />
        <div className="w-2.5 h-2.5 rounded-full" style={{ background: "rgba(255,255,255,0.08)" }} />
        <div className="w-2.5 h-2.5 rounded-full" style={{ background: "rgba(255,255,255,0.08)" }} />
        <span className="ml-3 text-xs" style={{ color: "rgba(255,255,255,0.2)", fontFamily: "var(--font-highlight)" }}>
          tethos-cli
        </span>
      </div>

      {/* Content */}
      <div className="p-5 text-xs leading-relaxed" style={{ fontFamily: "var(--font-highlight)", minHeight: "240px" }}>
        {TERMINAL_LINES.slice(0, visibleLines).map((line, i) => {
          if (line.type === "cmd") {
            return (
              <p key={i} style={{ color: "rgba(255,255,255,0.35)" }}>
                <span style={{ color: "#1d9bf0" }}>$</span> {line.text.slice(2)}
              </p>
            );
          }
          if (line.type === "info") {
            return (
              <p key={i} className="mt-2" style={{ color: "rgba(255,255,255,0.2)" }}>
                {line.text}
              </p>
            );
          }
          if (line.type === "check") {
            return (
              <p key={i} className={i === 2 ? "mt-3" : "mt-1"} style={{ color: "rgba(255,255,255,0.35)" }}>
                <span style={{ color: "#1d9bf0" }}>&#x2713;</span> {line.text}
                {(line as { meta?: string }).meta && (
                  <span style={{ color: "rgba(255,255,255,0.15)" }}> {(line as { meta?: string }).meta}</span>
                )}
              </p>
            );
          }
          if (line.type === "meta") {
            return (
              <p key={i} className={line.text.includes("Estimated") ? "mt-3" : "mt-1"} style={{ color: "rgba(255,255,255,0.2)" }}>
                <span style={{ color: "rgba(29,155,240,0.6)" }}>{line.text.split(" ")[0]}</span> {line.text.split(" ").slice(1).join(" ")}
              </p>
            );
          }
          if (line.type === "cursor") {
            return (
              <p key={i} className="mt-3" style={{ color: "rgba(255,255,255,0.35)" }}>
                <span style={{ color: "#1d9bf0" }}>$</span>{" "}
                <span
                  className="inline-block w-2 h-4 ml-0.5 align-middle"
                  style={{ background: "#1d9bf0", animation: "blink 1.2s infinite step-end" }}
                />
              </p>
            );
          }
          return null;
        })}
      </div>
    </div>
  );
}

export default function NPOHeroSection() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const lineRef = useRef<HTMLDivElement>(null);
  const tagRef = useRef<HTMLParagraphElement>(null);
  const h1Ref = useRef<HTMLHeadingElement>(null);
  const descRef = useRef<HTMLParagraphElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sectionRef.current) return;

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (prefersReducedMotion) {
      gsap.set([lineRef.current, tagRef.current, h1Ref.current, descRef.current, ctaRef.current, terminalRef.current], { opacity: 1, y: 0 });
      if (lineRef.current) lineRef.current.style.transform = "scaleX(1)";
      return;
    }

    const tl = gsap.timeline({ delay: 0.3 });

    tl.fromTo(
      tagRef.current,
      { opacity: 0, y: 12 },
      { opacity: 1, y: 0, duration: 0.5, ease: "power3.out" }
    )
      .fromTo(
        lineRef.current,
        { scaleX: 0 },
        { scaleX: 1, duration: 0.8, ease: "power3.inOut" },
        "-=0.2"
      )
      .fromTo(
        h1Ref.current,
        { opacity: 0, y: 30 },
        { opacity: 1, y: 0, duration: 0.8, ease: "power4.out" },
        "-=0.4"
      )
      .fromTo(
        descRef.current,
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 0.6, ease: "power3.out" },
        "-=0.3"
      )
      .fromTo(
        ctaRef.current,
        { opacity: 0, y: 16 },
        { opacity: 1, y: 0, duration: 0.5, ease: "power3.out" },
        "-=0.2"
      )
      .fromTo(
        terminalRef.current,
        { opacity: 0, y: 20, scale: 0.96 },
        { opacity: 1, y: 0, scale: 1, duration: 0.7, ease: "power3.out" },
        "-=0.3"
      );
  }, []);

  return (
    <section
      id="npo-hero"
      ref={sectionRef}
      data-navbar-theme="dark"
      className="relative min-h-screen flex items-center px-8 md:px-20 lg:px-28 overflow-hidden"
      style={{ background: "#0F0F10" }}
    >
      {/* Ambient glow - boosted */}
      <div
        className="absolute top-1/3 right-1/4 pointer-events-none"
        style={{
          width: "700px",
          height: "700px",
          background: "radial-gradient(circle, rgba(29,155,240,0.12) 0%, transparent 70%)",
          filter: "blur(100px)",
        }}
      />

      <div className="relative max-w-[1400px] mx-auto w-full py-32 flex flex-col lg:flex-row items-start gap-16 lg:gap-14">
        {/* Left: text content */}
        <div className="lg:w-[55%] flex-shrink-0">
          <p
            ref={tagRef}
            className="text-xs tracking-widest uppercase mb-6"
            style={{ color: "#1d9bf0", fontFamily: "var(--font-highlight)", opacity: 0 }}
          >
            <DecryptedText
              text="For Nonprofits"
              speed={40}
              maxIterations={12}
              sequential
              characters="01!@#$%_-+=<>"
              className="text-[#1d9bf0]"
              encryptedClassName="text-[rgba(29,155,240,0.3)]"
              animateOn="view"
            />
          </p>

          <div
            ref={lineRef}
            className="mb-10 origin-left"
            style={{
              width: "80px",
              height: "2px",
              background: "linear-gradient(90deg, #1d9bf0, transparent)",
              transform: "scaleX(0)",
            }}
          />

          <h1
            ref={h1Ref}
            className="mb-8"
            style={{
              fontFamily: '"Test Sohne", sans-serif',
              fontSize: "clamp(36px, 5.5vw, 72px)",
              fontWeight: 500,
              color: "#F1FFFF",
              lineHeight: 1.08,
              letterSpacing: "-0.03em",
              opacity: 0,
            }}
          >
            8 months.<br />
            One product.<br />
            <GradientText colors={["#1d9bf0", "#60c5ff", "#1d9bf0"]} animationSpeed={6}>
              Real impact.
            </GradientText>
          </h1>

          <p
            ref={descRef}
            className="text-base md:text-lg leading-relaxed mb-12"
            style={{
              color: "rgba(255,255,255,0.4)",
              fontFamily: '"Test Sohne", sans-serif',
              fontWeight: 400,
              maxWidth: "540px",
              opacity: 0,
            }}
          >
            We pair your nonprofit with a dedicated student team to design, build,
            and ship production-grade software. No cost. Full ownership.
          </p>

          <div ref={ctaRef} className="flex flex-wrap gap-4" style={{ opacity: 0 }}>
            <a
              href="mailto:team@tethos.ca?subject=NPO%20Application%20-%202026%20Cohort"
              className="inline-flex items-center px-7 py-3.5 rounded-lg text-sm font-semibold transition-all duration-300"
              style={{ background: "#1d9bf0", color: "#fff", fontFamily: '"Test Sohne", sans-serif' }}
              onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "0 0 30px rgba(29,155,240,0.3)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "none"; }}
            >
              Apply for 2026 Cohort
            </a>
            <Link
              href="/#work"
              className="inline-flex items-center px-7 py-3.5 rounded-lg text-sm font-semibold transition-all duration-300"
              style={{
                background: "transparent",
                color: "rgba(255,255,255,0.5)",
                border: "1px solid rgba(255,255,255,0.1)",
                fontFamily: '"Test Sohne", sans-serif',
              }}
            >
              See past work
            </Link>
          </div>
        </div>

        {/* Right: terminal artifact with typewriter */}
        <div
          ref={terminalRef}
          className="lg:flex-1 w-full hidden lg:block"
          style={{ opacity: 0 }}
        >
          <TerminalTypewriter />
        </div>
      </div>

      {/* Blink animation for cursor */}
      <style jsx>{`
        @keyframes blink {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0; }
        }
      `}</style>
    </section>
  );
}
