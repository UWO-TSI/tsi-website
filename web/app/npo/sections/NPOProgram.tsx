"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import SpotlightCard from "@/components/ui/SpotlightCard";
import DecryptedText from "@/components/ui/DecryptedText";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

interface Phase {
  number: string;
  title: string;
  duration: string;
  weeks: number;
  description: string;
  motif: React.ReactNode;
}

/* Visual motifs for each phase -- monospace/terminal style */
const FormMotif = () => (
  <div className="space-y-2 mt-6" style={{ fontFamily: "var(--font-highlight)", fontSize: "10px", color: "rgba(255,255,255,0.15)" }}>
    <div className="flex items-center gap-2">
      <span style={{ color: "rgba(29,155,240,0.4)" }}>org_name</span>
      <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.06)" }} />
    </div>
    <div className="flex items-center gap-2">
      <span style={{ color: "rgba(29,155,240,0.4)" }}>problem_</span>
      <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.06)" }} />
    </div>
    <div className="flex items-center gap-2">
      <span style={{ color: "rgba(29,155,240,0.4)" }}>users___</span>
      <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.06)" }} />
    </div>
  </div>
);

const DiscoveryMotif = () => (
  <div className="flex gap-2 mt-6 flex-wrap" style={{ fontSize: "9px", fontFamily: "var(--font-highlight)" }}>
    {["workflows", "pain points", "users", "constraints", "goals"].map((t) => (
      <span
        key={t}
        className="px-2 py-1 rounded"
        style={{ background: "rgba(29,155,240,0.08)", color: "rgba(29,155,240,0.4)", border: "1px solid rgba(29,155,240,0.1)" }}
      >
        {t}
      </span>
    ))}
  </div>
);

const DesignMotif = () => (
  <div className="flex gap-3 mt-6 items-end">
    {["#1d9bf0", "#0F0F10", "#F1FFFF", "rgba(255,255,255,0.3)"].map((c, i) => (
      <div key={i} className="flex flex-col items-center gap-1">
        <div className="w-6 h-6 rounded-sm" style={{ background: c, border: "1px solid rgba(255,255,255,0.08)" }} />
        <span style={{ fontSize: "8px", fontFamily: "var(--font-highlight)", color: "rgba(255,255,255,0.12)" }}>
          {c.startsWith("#") ? c : "30%"}
        </span>
      </div>
    ))}
  </div>
);

const DevMotif = () => (
  <div className="mt-6" style={{ fontFamily: "var(--font-highlight)", fontSize: "10px", color: "rgba(255,255,255,0.15)" }}>
    <p><span style={{ color: "rgba(29,155,240,0.5)" }}>fn</span> deploy<span style={{ color: "rgba(255,255,255,0.08)" }}>()</span> {"{"}</p>
    <p className="pl-3"><span style={{ color: "rgba(29,155,240,0.3)" }}>test</span> → <span style={{ color: "rgba(100,200,100,0.4)" }}>pass</span></p>
    <p className="pl-3"><span style={{ color: "rgba(29,155,240,0.3)" }}>build</span> → <span style={{ color: "rgba(100,200,100,0.4)" }}>pass</span></p>
    <p className="pl-3"><span style={{ color: "rgba(29,155,240,0.3)" }}>ship</span> → <span style={{ color: "rgba(29,155,240,0.4)" }}>prod</span></p>
    <p>{"}"}</p>
  </div>
);

const HandoffMotif = () => (
  <div className="mt-6 space-y-1.5" style={{ fontFamily: "var(--font-highlight)", fontSize: "10px", color: "rgba(255,255,255,0.15)" }}>
    <p><span style={{ color: "rgba(29,155,240,0.5)" }}>✓</span> source code transferred</p>
    <p><span style={{ color: "rgba(29,155,240,0.5)" }}>✓</span> docs published</p>
    <p><span style={{ color: "rgba(29,155,240,0.5)" }}>✓</span> team trained</p>
    <p><span style={{ color: "rgba(29,155,240,0.5)" }}>✓</span> support window active</p>
  </div>
);

const PHASES: Phase[] = [
  {
    number: "01", title: "Application", duration: "2 weeks", weeks: 2,
    description: "Submit your org details, problem statement, and goals. We assess fit and scope to ensure meaningful impact.",
    motif: <FormMotif />,
  },
  {
    number: "02", title: "Discovery", duration: "4 weeks", weeks: 4,
    description: "Our team embeds with your staff to understand workflows, pain points, and users. We define requirements together.",
    motif: <DiscoveryMotif />,
  },
  {
    number: "03", title: "Design", duration: "4 weeks", weeks: 4,
    description: "Wireframes, prototypes, and user testing. You see the product before a single line of code is written.",
    motif: <DesignMotif />,
  },
  {
    number: "04", title: "Development", duration: "16 weeks", weeks: 16,
    description: "Bi-weekly demos, continuous feedback. Production-grade code with testing, CI/CD, and documentation. This is where the bulk of the work happens.",
    motif: <DevMotif />,
  },
  {
    number: "05", title: "Handoff", duration: "4 weeks", weeks: 4,
    description: "Training, onboarding, documentation, and a 30-day support window. You own everything.",
    motif: <HandoffMotif />,
  },
];

export default function NPOProgramSection() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sectionRef.current || !trackRef.current) return;

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (prefersReducedMotion) {
      gsap.set(headerRef.current, { opacity: 1 });
      return;
    }

    const ctx = gsap.context(() => {
      gsap.fromTo(
        headerRef.current,
        { opacity: 0, y: 40 },
        {
          opacity: 1, y: 0, duration: 0.8, ease: "power3.out",
          scrollTrigger: { trigger: sectionRef.current, start: "top 70%", once: true },
        }
      );

      const track = trackRef.current!;
      const scrollDistance = track.scrollWidth - window.innerWidth;

      gsap.to(track, {
        x: -scrollDistance,
        ease: "none",
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top top",
          end: () => `+=${scrollDistance}`,
          scrub: 1,
          pin: true,
          pinSpacing: true,
          anticipatePin: 1,
        },
      });

      gsap.fromTo(
        progressRef.current,
        { scaleX: 0 },
        {
          scaleX: 1,
          ease: "none",
          scrollTrigger: {
            trigger: sectionRef.current,
            start: "top top",
            end: () => `+=${scrollDistance}`,
            scrub: 1,
          },
        }
      );
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  // Card width scales with phase duration
  const getCardWidth = (weeks: number) => {
    if (weeks >= 12) return "clamp(420px, 35vw, 520px)";
    if (weeks >= 4) return "clamp(320px, 25vw, 380px)";
    return "clamp(280px, 22vw, 340px)";
  };

  return (
    <section
      id="npo-program"
      ref={sectionRef}
      data-navbar-theme="dark"
      className="relative overflow-hidden"
      style={{ background: "#0a0a0b" }}
    >
      <div
        className="absolute top-0 left-0 right-0 pointer-events-none"
        style={{ height: "200px", background: "linear-gradient(to bottom, #0F0F10, #0a0a0b)" }}
      />

      <div className="pt-32 pb-12 px-8 md:px-20 lg:px-28">
        <div ref={headerRef} className="max-w-[1400px] mx-auto" style={{ opacity: 0 }}>
          <p
            className="text-xs tracking-widest uppercase mb-4"
            style={{ color: "#1d9bf0", fontFamily: "var(--font-highlight)" }}
          >
            <DecryptedText
              text="How it works"
              speed={40}
              maxIterations={12}
              sequential
              characters="01!@#$%_-+=<>"
              className="text-[#1d9bf0]"
              encryptedClassName="text-[rgba(29,155,240,0.3)]"
              animateOn="view"
            />
          </p>
          <h2
            className="tracking-tight mb-4"
            style={{
              fontFamily: '"Test Sohne", sans-serif',
              fontSize: "clamp(28px, 4vw, 48px)",
              fontWeight: 500,
              color: "#F1FFFF",
              lineHeight: 1.1,
            }}
          >
            Five phases. Eight months.
          </h2>
          <p className="text-sm flex items-center gap-2" style={{ color: "rgba(255,255,255,0.3)", fontFamily: "var(--font-highlight)" }}>
            Scroll to explore the program timeline
            <span className="inline-block animate-[bounceX_1.5s_ease-in-out_infinite]">→</span>
          </p>
          <style jsx>{`
            @keyframes bounceX {
              0%, 100% { transform: translateX(0); }
              50% { transform: translateX(6px); }
            }
          `}</style>

          <div className="mt-8 relative" style={{ height: "2px", background: "rgba(255,255,255,0.04)" }}>
            <div
              ref={progressRef}
              className="absolute top-0 left-0 h-full origin-left"
              style={{
                width: "100%",
                background: "linear-gradient(90deg, #1d9bf0, rgba(29,155,240,0.3))",
                transform: "scaleX(0)",
              }}
            />
          </div>
        </div>
      </div>

      <div
        ref={trackRef}
        className="relative flex items-stretch gap-5 pl-8 md:pl-20 lg:pl-28 pb-32 pt-8"
        style={{ width: "fit-content" }}
      >
        {/* Connecting thread between cards */}
        <div
          className="absolute pointer-events-none"
          style={{
            top: "calc(2rem + 52px)",
            left: "0",
            right: "0",
            height: "1px",
            background: "linear-gradient(90deg, transparent 2%, rgba(29,155,240,0.12) 5%, rgba(29,155,240,0.12) 95%, transparent 98%)",
          }}
        />
        {PHASES.map((phase) => (
          <SpotlightCard
            key={phase.number}
            className="phase-card flex-shrink-0 rounded-2xl p-8 md:p-10 flex flex-col justify-between"
            spotlightColor="rgba(29, 155, 240, 0.10)"
            style={{
              width: getCardWidth(phase.weeks),
              minHeight: "380px",
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <div>
              <div className="flex items-center gap-4 mb-8">
                <span
                  className="text-3xl font-semibold"
                  style={{ color: "#1d9bf0", fontFamily: "var(--font-highlight)" }}
                >
                  {phase.number}
                </span>
                <div style={{ flex: 1, height: "1px", background: "linear-gradient(90deg, rgba(29,155,240,0.3), transparent)" }} />
              </div>

              <h3
                className="text-2xl md:text-3xl tracking-tight mb-3"
                style={{ color: "#F1FFFF", fontWeight: 500 }}
              >
                {phase.title}
              </h3>

              <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.4)", maxWidth: "360px" }}>
                {phase.description}
              </p>

              {/* Visual motif unique to each phase */}
              {phase.motif}
            </div>

            <div className="mt-8">
              <span
                className="text-xs px-3 py-1.5 rounded-full"
                style={{
                  background: "rgba(29,155,240,0.1)",
                  color: "rgba(29,155,240,0.8)",
                  border: "1px solid rgba(29,155,240,0.15)",
                  fontFamily: "var(--font-highlight)",
                }}
              >
                {phase.duration}
              </span>
            </div>
          </SpotlightCard>
        ))}

        <div className="flex-shrink-0" style={{ width: "20vw" }} />
      </div>
    </section>
  );
}
