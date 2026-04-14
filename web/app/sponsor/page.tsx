"use client";

import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import GradientText from "@/components/ui/GradientText";
import SpotlightCard from "@/components/ui/SpotlightCard";
import DecryptedText from "@/components/ui/DecryptedText";
import DotNav from "@/components/ui/DotNav";
import type { DotNavSection } from "@/components/ui/DotNav";
import BorderGlow from "@/components/ui/BorderGlow";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

/* ── Data ── */

const TIERS = [
  {
    name: "Catalyst",
    label: "Partnership tier",
    color: "#1d9bf0",
    perks: ["Everything in Platinum", "Named partnership", "Quarterly leadership review", "Featured in all materials"],
    featured: true,
  },
  {
    name: "Platinum",
    label: "Leadership tier",
    color: "#d4d4d8",
    perks: ["Everything in Gold", "Talent pipeline access", "Branded workshop or panel", "Event access for 6 reps"],
  },
  {
    name: "Gold",
    label: "Growth tier",
    color: "#c9a84c",
    perks: ["Everything in Silver", "Speaking slot at Genesis", "Quarterly impact report", "Event access for 4 reps"],
  },
  {
    name: "Silver",
    label: "Community tier",
    color: "#8a8a8a",
    perks: ["Logo on website & materials", "Social media shoutout", "Event access for 2 reps", "Program booklet mention"],
  },
];

const ENABLES = [
  { marker: "→", title: "Brand Visibility", stat: "3,000+", desc: "Students & partners reached through your logo across platform, events, and materials." },
  { marker: "◆", title: "Talent Pipeline", stat: "150+", desc: "Pre-vetted developers available for internships, co-ops, and full-time hiring." },
  { marker: "//", title: "Impact Reports", stat: "20+", desc: "Projects tracked with quarterly reports on how your funding drives outcomes." },
  { marker: "▸", title: "Event Access", stat: "500+", desc: "Attendees at Genesis events where you can speak, workshop, and network." },
];

const CURRENT_SPONSORS = ["Morrissette Entrepreneurship", "Ivey Business School", "Western Engineering"];

const SECTIONS: DotNavSection[] = [
  { id: "sponsor-hero", label: "Overview" },
  { id: "sponsor-tiers", label: "Tiers" },
  { id: "sponsor-enables", label: "Benefits" },
  { id: "sponsor-cta", label: "Contact" },
];

/* ── Impact Calculator with typewriter ── */

const CALC_LINES = [
  { text: "# Your sponsorship in action", color: "rgba(201,168,76,0.7)", delay: 400 },
  { text: "$1 → 2 hours of student development", color: "rgba(255,255,255,0.35)", gold: "$1", delay: 300 },
  { text: "$500 → 1 nonprofit project sprint", color: "rgba(255,255,255,0.35)", gold: "$500", delay: 250 },
  { text: "$5,000 → full 8-month cohort funded", color: "rgba(255,255,255,0.35)", gold: "$5,000", delay: 250 },
  { text: "100% goes to program operations", color: "rgba(29,155,240,0.5)", delay: 400 },
];

function ImpactCalculator() {
  const [visibleLines, setVisibleLines] = useState(0);
  const [started, setStarted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Start when scrolled into view
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
    if (!started || visibleLines >= CALC_LINES.length) return;
    const delay = CALC_LINES[visibleLines].delay;
    const timer = setTimeout(() => setVisibleLines((v) => v + 1), delay);
    return () => clearTimeout(timer);
  }, [started, visibleLines]);

  return (
    <div
      ref={containerRef}
      className="mt-14 max-w-[380px] mx-auto rounded-lg overflow-hidden"
      style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}
    >
      <div className="px-4 py-2.5 flex items-center gap-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
        <div className="w-2 h-2 rounded-full" style={{ background: "rgba(255,255,255,0.08)" }} />
        <div className="w-2 h-2 rounded-full" style={{ background: "rgba(255,255,255,0.08)" }} />
        <div className="w-2 h-2 rounded-full" style={{ background: "rgba(255,255,255,0.08)" }} />
        <span className="ml-2 text-[10px]" style={{ color: "rgba(255,255,255,0.15)", fontFamily: "var(--font-highlight)" }}>impact-calculator.sh</span>
      </div>
      <div className="px-4 py-3 text-xs leading-loose" style={{ fontFamily: "var(--font-highlight)", minHeight: "120px" }}>
        {CALC_LINES.slice(0, visibleLines).map((line, i) => (
          <p key={i} className={i === CALC_LINES.length - 1 ? "mt-1" : ""} style={{ color: line.color }}>
            {line.gold ? (
              <>
                <span style={{ color: "rgba(201,168,76,0.6)" }}>{line.gold}</span>
                {line.text.slice(line.gold.length)}
              </>
            ) : (
              line.text
            )}
          </p>
        ))}
        {visibleLines < CALC_LINES.length && started && (
          <span className="inline-block w-2 h-3.5 align-middle" style={{ background: "rgba(201,168,76,0.6)", animation: "blink 1.2s step-end infinite" }} />
        )}
      </div>
      <style jsx>{`
        @keyframes blink {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}

/* ── Page ── */

export default function SponsorPage() {
  const heroRef = useRef<HTMLDivElement>(null);
  const tiersRef = useRef<HTMLDivElement>(null);
  const enablesRef = useRef<HTMLDivElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);
  const lineRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const ctx = gsap.context(() => {
      if (prefersReducedMotion) {
        gsap.set([enablesRef.current, ctaRef.current], { opacity: 1 });
        document.querySelectorAll(".tier-card").forEach((el) => gsap.set(el, { opacity: 1 }));
        document.querySelectorAll("[data-reveal]").forEach((el) => gsap.set(el, { opacity: 1 }));
        if (lineRef.current) lineRef.current.style.transform = "scaleX(1)";
        return;
      }

      // Hero entrance
      const heroEls = heroRef.current?.querySelectorAll("[data-reveal]");
      if (heroEls) {
        gsap.fromTo(Array.from(heroEls), { opacity: 0, y: 25 }, { opacity: 1, y: 0, duration: 0.7, ease: "power3.out", stagger: 0.12, delay: 0.3 });
      }

      // Tier cards stagger with clip-path reveal
      const cards = document.querySelectorAll(".tier-card");
      gsap.fromTo(
        Array.from(cards),
        { opacity: 0, x: -30, clipPath: "inset(0 100% 0 0)" },
        {
          opacity: 1, x: 0, clipPath: "inset(0 0% 0 0)",
          duration: 0.8, ease: "power3.out", stagger: 0.15,
          scrollTrigger: { trigger: tiersRef.current, start: "top 70%", once: true },
        }
      );

      // Enables
      const enableCards = enablesRef.current?.querySelectorAll(".enable-card");
      if (enableCards) {
        gsap.fromTo(Array.from(enableCards), { opacity: 0, y: 20 }, {
          opacity: 1, y: 0, duration: 0.6, ease: "power3.out", stagger: 0.1,
          scrollTrigger: { trigger: enablesRef.current, start: "top 75%", once: true },
        });
      }

      // CTA
      if (lineRef.current) {
        gsap.fromTo(lineRef.current, { scaleX: 0 }, { scaleX: 1, duration: 1.2, ease: "power3.inOut", scrollTrigger: { trigger: ctaRef.current, start: "top 75%", once: true } });
      }
      gsap.fromTo(ctaRef.current, { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.9, ease: "power3.out", scrollTrigger: { trigger: ctaRef.current, start: "top 70%", once: true }, delay: 0.2 });
    });

    return () => ctx.revert();
  }, []);

  return (
    <main className="min-h-screen">
      <DotNav sections={SECTIONS} />

      {/* ── HERO ── */}
      <section id="sponsor-hero" data-navbar-theme="dark" className="relative min-h-screen flex items-center justify-center px-8 md:px-20 lg:px-28 overflow-hidden" style={{ background: "#0F0F10" }}>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none" style={{ width: "800px", height: "500px", background: "radial-gradient(ellipse, rgba(29,155,240,0.08) 0%, transparent 70%)", filter: "blur(40px)" }} />
        <div ref={heroRef} className="relative max-w-[800px] mx-auto text-center py-32">
          <p data-reveal className="text-xs tracking-widest uppercase mb-6" style={{ color: "#1d9bf0", fontFamily: "var(--font-highlight)", opacity: 0 }}>
            <DecryptedText text="Sponsor Tethos" speed={40} maxIterations={12} sequential characters="01$%+=<>" className="text-[#1d9bf0]" encryptedClassName="text-[rgba(29,155,240,0.3)]" animateOn="view" />
          </p>
          <h1 data-reveal className="mb-6" style={{ fontFamily: '"Test Sohne", sans-serif', fontSize: "clamp(40px, 6vw, 76px)", fontWeight: 500, color: "#F1FFFF", lineHeight: 1.05, letterSpacing: "-0.03em", opacity: 0 }}>
            Fund technology<br />that{" "}
            <GradientText colors={["#1d9bf0", "#60c5ff", "#1d9bf0"]} animationSpeed={6}>matters.</GradientText>
          </h1>
          <p data-reveal className="text-base md:text-lg leading-relaxed mb-12 mx-auto" style={{ color: "rgba(255,255,255,0.4)", maxWidth: "480px", opacity: 0 }}>
            Support student developers building production software for nonprofits. Your investment creates measurable social impact.
          </p>
          <div data-reveal className="flex flex-wrap justify-center gap-4" style={{ opacity: 0 }}>
            <a href="mailto:sponsor@tethos.ca" className="inline-flex items-center px-7 py-3.5 rounded-lg text-sm font-semibold transition-all duration-300" style={{ background: "#1d9bf0", color: "#fff" }} onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "0 0 30px rgba(29,155,240,0.3)"; }} onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "none"; }}>
              Become a Sponsor
            </a>
            <a href="/genesis-2026-sponsorship-package.pdf" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-7 py-3.5 rounded-lg text-sm font-medium transition-all duration-300" style={{ color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.1)" }}>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              Download Package
            </a>
          </div>

          {/* Impact calculator artifact -- typewriter */}
          <ImpactCalculator />
        </div>
      </section>

      {/* ── TIERS ── */}
      <section id="sponsor-tiers" data-navbar-theme="dark" className="relative py-32 md:py-44 px-8 md:px-20 lg:px-28 overflow-hidden" style={{ background: "#0a0a0b" }}>
        <div className="absolute top-0 left-0 right-0 pointer-events-none" style={{ height: "200px", background: "linear-gradient(to bottom, #0F0F10, #0a0a0b)" }} />
        <div ref={tiersRef} className="relative max-w-[1200px] mx-auto">
          {/* Terminal transition */}
          <p className="text-xs mb-8" style={{ color: "rgba(255,255,255,0.15)", fontFamily: "var(--font-highlight)" }}>
            <span style={{ color: "rgba(201,168,76,0.5)" }}>$</span> cat genesis-2026-tiers.md
          </p>
          <p className="text-xs tracking-widest uppercase mb-4" style={{ color: "#c9a84c", fontFamily: "var(--font-highlight)" }}>
            <DecryptedText text="Genesis 2026" speed={40} maxIterations={12} sequential characters="01$%+=<>" className="text-[#c9a84c]" encryptedClassName="text-[rgba(201,168,76,0.3)]" animateOn="view" />
          </p>
          <h2 className="tracking-tight mb-4" style={{ fontFamily: '"Test Sohne", sans-serif', fontSize: "clamp(28px, 4vw, 48px)", fontWeight: 500, color: "#F1FFFF", lineHeight: 1.1 }}>
            Sponsorship tiers.
          </h2>
          <p className="text-sm mb-14" style={{ color: "rgba(255,255,255,0.3)", fontFamily: "var(--font-highlight)" }}>
            Each tier builds on the previous · Catalyst is our named partnership
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {TIERS.map((tier, i) => (
              <SpotlightCard
                key={tier.name}
                className="tier-card rounded-xl p-7 flex flex-col"
                spotlightColor={`${tier.color}18`}
                style={{
                  background: tier.featured ? `${tier.color}08` : "rgba(255,255,255,0.02)",
                  border: `1px solid ${tier.featured ? `${tier.color}30` : "rgba(255,255,255,0.06)"}`,
                  borderLeft: `3px solid ${tier.color}`,
                  opacity: 0,
                }}
              >
                <div className="flex items-center justify-between mb-6">
                  <span className="text-xs font-medium uppercase tracking-widest" style={{ color: tier.color, fontFamily: "var(--font-highlight)" }}>
                    {tier.name}
                  </span>
                  {tier.featured && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: `${tier.color}15`, color: tier.color, border: `1px solid ${tier.color}25` }}>
                      Featured
                    </span>
                  )}
                </div>
                <p className="text-lg font-medium tracking-tight mb-6" style={{ color: "rgba(255,255,255,0.6)", fontWeight: 400, fontFamily: "var(--font-highlight)" }}>{tier.label}</p>
                <ul className="flex flex-col gap-2.5 mt-auto">
                  {tier.perks.map((perk) => (
                    <li key={perk} className="flex items-start gap-2.5 text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>
                      <span style={{ color: `${tier.color}90`, fontFamily: "var(--font-highlight)", marginTop: "1px" }}>+</span>
                      {perk}
                    </li>
                  ))}
                </ul>
              </SpotlightCard>
            ))}
          </div>
        </div>
      </section>

      {/* ── WHAT YOU ENABLE ── */}
      <section id="sponsor-enables" data-navbar-theme="dark" className="relative py-28 md:py-36 px-8 md:px-20 lg:px-28" style={{ background: "#0F0F10" }}>
        <div className="absolute top-0 left-0 right-0 pointer-events-none" style={{ height: "200px", background: "linear-gradient(to bottom, #0a0a0b, #0F0F10)" }} />
        <div ref={enablesRef} className="relative max-w-[1200px] mx-auto">
          <p className="text-xs tracking-widest uppercase mb-4" style={{ color: "#1d9bf0", fontFamily: "var(--font-highlight)" }}>What you enable</p>
          <h2 className="tracking-tight mb-12" style={{ fontFamily: '"Test Sohne", sans-serif', fontSize: "clamp(24px, 3.5vw, 40px)", fontWeight: 500, color: "#F1FFFF", lineHeight: 1.15 }}>
            Where your sponsorship goes.
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {ENABLES.map((item) => (
              <div key={item.title} className="enable-card rounded-xl p-6" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", opacity: 0 }}>
                <span className="text-base mb-3 block" style={{ color: "rgba(29,155,240,0.6)", fontFamily: "var(--font-highlight)" }}>{item.marker}</span>
                <p className="text-2xl font-medium tracking-tight mb-1" style={{ color: "#F1FFFF", fontWeight: 500 }}>{item.stat}</p>
                <p className="text-sm font-medium mb-2" style={{ color: "rgba(255,255,255,0.6)", fontWeight: 500 }}>{item.title}</p>
                <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.35)" }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section id="sponsor-cta" data-navbar-theme="dark" className="relative py-32 md:py-44 px-8 md:px-20 lg:px-28 overflow-hidden" style={{ background: "#0a0a0b" }}>
        <div className="absolute top-0 left-0 right-0 pointer-events-none" style={{ height: "200px", background: "linear-gradient(to bottom, #0F0F10, #0a0a0b)" }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none" style={{ width: "700px", height: "400px", background: "radial-gradient(ellipse, rgba(201,168,76,0.08) 0%, transparent 70%)", filter: "blur(40px)" }} />

        <div className="relative max-w-[600px] mx-auto text-center">
          <div className="flex justify-center mb-16">
            <div ref={lineRef} className="origin-center" style={{ width: "120px", height: "1px", background: "linear-gradient(90deg, transparent, rgba(201,168,76,0.4), transparent)", transform: "scaleX(0)" }} />
          </div>

          <div ref={ctaRef} style={{ opacity: 0 }}>
            <h2 className="tracking-tight mb-6" style={{ fontFamily: '"Test Sohne", sans-serif', fontSize: "clamp(36px, 5vw, 60px)", fontWeight: 500, color: "#F1FFFF", lineHeight: 1.08, letterSpacing: "-0.02em" }}>
              Let&apos;s build{" "}
              <GradientText colors={["#c9a84c", "#e8d48b", "#c9a84c"]} animationSpeed={6}>together.</GradientText>
            </h2>
            <p className="text-base leading-relaxed mb-6 mx-auto" style={{ color: "rgba(255,255,255,0.4)", maxWidth: "420px" }}>
              Join organizations investing in student-built technology for social good.
            </p>
            <p className="text-xs mb-10" style={{ color: "rgba(255,255,255,0.2)", fontFamily: "var(--font-highlight)" }}>
              Currently sponsored by: {CURRENT_SPONSORS.join(" · ")}
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <a href="mailto:sponsor@tethos.ca" className="inline-flex items-center px-8 py-4 rounded-lg text-sm font-semibold transition-all duration-300" style={{ background: "#1d9bf0", color: "#fff" }} onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "0 0 30px rgba(29,155,240,0.3)"; }} onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "none"; }}>
                Get in touch
              </a>
              <a href="/genesis-2026-sponsorship-package.pdf" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-8 py-4 rounded-lg text-sm font-medium transition-all duration-300" style={{ color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.1)" }}>
                Download Package
              </a>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
