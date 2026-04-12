"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { motion } from "framer-motion";
import {
  EASE_ENTER,
  DURATION_SECTION,
  STAGGER_NORMAL,
  fadeUpVariants,
} from "@/lib/motion";
import { RECRUITMENT_PHASES, type RecruitmentPhase } from "@/lib/recruitment";
import { Lock, CheckCircle2, Circle } from "lucide-react";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

function getPhaseStatus(phase: RecruitmentPhase): "active" | "upcoming" | "completed" {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  // Phase 1: May 2026
  if (phase.phase === 1) {
    if (year > 2026 || (year === 2026 && month > 5)) return "completed";
    if (year === 2026 && month === 5) return "active";
    if (year === 2026 && month >= 4) return "active"; // approaching
    return "upcoming";
  }
  // Phase 2: Sept 2026
  if (phase.phase === 2) {
    if (year > 2026 || (year === 2026 && month > 9)) return "completed";
    if (year === 2026 && month >= 9) return "active";
    return "upcoming";
  }
  return "upcoming";
}

function PhaseNode({
  phase,
  index,
}: {
  phase: RecruitmentPhase;
  index: number;
}) {
  const status = getPhaseStatus(phase);
  const isActive = status === "active";
  const isCompleted = status === "completed";

  return (
    <motion.div
      custom={index}
      variants={fadeUpVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-50px" }}
      className="relative flex items-start gap-6 md:gap-8"
    >
      {/* Node dot */}
      <div className="relative flex-shrink-0 flex flex-col items-center">
        <div
          className={`
            w-12 h-12 rounded-full flex items-center justify-center relative z-10
            border-2 transition-all duration-500
            ${isActive
              ? "border-[#002FA7] bg-[#002FA7]/20"
              : isCompleted
                ? "border-[#22C55E] bg-[#22C55E]/10"
                : "border-[#3f3f46] bg-[#18181b]"
            }
          `}
        >
          {isCompleted ? (
            <CheckCircle2 className="w-5 h-5 text-[#22C55E]" />
          ) : isActive ? (
            <Circle className="w-5 h-5 text-[#002FA7]" />
          ) : (
            <Lock className="w-4 h-4 text-[#6B7280]" />
          )}

          {/* Active pulse */}
          {isActive && (
            <div className="absolute inset-0 rounded-full border-2 border-[#002FA7] animate-ping opacity-30" />
          )}
        </div>
      </div>

      {/* Phase card */}
      <div
        className={`
          glass-card p-6 md:p-8 flex-1 transition-all duration-500
          ${isActive
            ? "border-[#002FA7]/40 shadow-[0_0_30px_rgba(0,47,167,0.15)]"
            : isCompleted
              ? "border-[#22C55E]/20"
              : "opacity-40"
          }
        `}
      >
        <div className="flex items-center gap-3 mb-2">
          <span
            className={`
              font-mono text-xs tracking-wider uppercase
              ${isActive ? "text-[#002FA7]" : isCompleted ? "text-[#22C55E]" : "text-[#6B7280]"}
            `}
          >
            Phase {String(phase.phase).padStart(2, "0")}
          </span>
          {isActive && (
            <span className="px-2 py-0.5 rounded-full bg-[#002FA7]/20 text-[#002FA7] text-[10px] font-mono uppercase tracking-widest">
              Now Open
            </span>
          )}
          {isCompleted && (
            <span className="px-2 py-0.5 rounded-full bg-[#22C55E]/20 text-[#22C55E] text-[10px] font-mono uppercase tracking-widest">
              Completed
            </span>
          )}
        </div>
        <h3
          className={`
            text-xl md:text-2xl font-semibold mb-2
            ${isActive ? "text-[#F1FFFF]" : "text-[#9CA3AF]"}
          `}
        >
          {phase.title}
        </h3>
        <p className="text-[#9CA3AF] text-sm mb-3">{phase.description}</p>
        <p
          className={`
            font-mono text-xs
            ${isActive ? "text-[#22D3EE]" : "text-[#6B7280]"}
          `}
        >
          {phase.dateLabel}
        </p>
        {isActive && (
          <div className="mt-4 flex flex-wrap gap-2">
            {phase.positions.map((slug) => (
              <span
                key={slug}
                className="px-3 py-1 rounded-full bg-[#002FA7]/10 border border-[#002FA7]/30 text-[#F1FFFF] text-xs font-mono"
              >
                {slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
              </span>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default function RecruitmentRoadmap() {
  const containerRef = useRef<HTMLDivElement>(null);
  const lineRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || !lineRef.current) return;

    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: containerRef.current,
        start: "top 80%",
        end: "bottom 60%",
        scrub: 1,
      },
    });

    tl.fromTo(
      lineRef.current,
      { scaleY: 0 },
      { scaleY: 1, ease: EASE_ENTER, duration: DURATION_SECTION }
    );

    return () => {
      tl.kill();
    };
  }, []);

  return (
    <section ref={containerRef} className="relative py-16 md:py-24">
      {/* Section header */}
      <motion.div
        variants={fadeUpVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        className="text-center mb-16"
      >
        <p className="font-mono text-xs tracking-[0.2em] uppercase text-[#002FA7] mb-3">
          Recruitment Timeline
        </p>
        <h2 className="text-3xl md:text-4xl font-semibold text-[#F1FFFF]">
          Your path to Tethos
        </h2>
      </motion.div>

      {/* Timeline */}
      <div className="relative max-w-2xl mx-auto">
        {/* Vertical connector line */}
        <div
          ref={lineRef}
          className="absolute left-6 top-0 bottom-0 w-px origin-top"
          style={{
            background:
              "linear-gradient(180deg, #002FA7 0%, rgba(0, 47, 167, 0.3) 60%, rgba(63, 63, 70, 0.3) 100%)",
          }}
        />

        {/* Phase nodes */}
        <div className="flex flex-col gap-12 md:gap-16">
          {RECRUITMENT_PHASES.map((phase, i) => (
            <PhaseNode key={phase.phase} phase={phase} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
