"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { RECRUITMENT_PHASES, isPositionOpen } from "@/lib/recruitment";
import type { Position } from "@/lib/recruitment";
import DecryptedText from "@/components/ui/DecryptedText";
import GradientText from "@/components/ui/GradientText";
import SpotlightCard from "@/components/ui/SpotlightCard";
import Countdown from "@/components/recruit/Countdown";

const EASE_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1];

function derivePhaseStatus(
  positions: Position[],
  phase: number
): "active" | "upcoming" | "completed" {
  const inPhase = positions.filter((p) => p.phase === phase);
  if (inPhase.length === 0) return "upcoming";
  const now = Date.now();
  if (inPhase.some((p) => isPositionOpen(p))) return "active";
  const allClosed = inPhase.every(
    (p) => p.closes_at && new Date(p.closes_at).getTime() < now
  );
  if (allClosed) return "completed";
  return "upcoming";
}

export default function RecruitmentPage() {
  return (
    <Suspense fallback={null}>
      <RecruitmentPageInner />
    </Suspense>
  );
}

function RecruitmentPageInner() {
  const searchParams = useSearchParams();
  const authError = searchParams.get("error") === "auth";

  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [activePhase, setActivePhase] = useState<number | null>(null);

  const positionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/positions")
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        if (Array.isArray(data)) {
          setPositions(data);
          setLoadError(false);
        } else {
          setLoadError(true);
        }
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const phases = [...new Set(positions.map((p) => p.phase))].sort();
  const filtered = activePhase ? positions.filter((p) => p.phase === activePhase) : positions;
  const phaseLabels: Record<number, string> = { 1: "Executive", 2: "PM & Directors" };

  const now = new Date();
  const openPositions = positions.filter((p) => {
    if (!p.is_active) return false;
    if (p.opens_at && new Date(p.opens_at) > now) return false;
    if (p.closes_at && new Date(p.closes_at) < now) return false;
    return true;
  });
  const openCount = openPositions.length;

  // Find the next meaningful date: nearest upcoming opens_at if nothing open yet,
  // else the nearest closes_at among open positions.
  const upcomingOpens = positions
    .filter((p) => p.is_active && p.opens_at && new Date(p.opens_at) > now)
    .map((p) => new Date(p.opens_at!).getTime())
    .sort((a, b) => a - b);
  const openClosingSoon = openPositions
    .filter((p) => p.closes_at)
    .map((p) => new Date(p.closes_at!).getTime())
    .sort((a, b) => a - b);

  let statusMode: "opens" | "closes" | "closed" = "closed";
  let targetDate: Date | null = null;
  if (openCount > 0 && openClosingSoon.length > 0) {
    statusMode = "closes";
    targetDate = new Date(openClosingSoon[0]);
  } else if (upcomingOpens.length > 0) {
    statusMode = "opens";
    targetDate = new Date(upcomingOpens[0]);
  }

  const statusLabel =
    statusMode === "closes"
      ? "Applications close in"
      : statusMode === "opens"
        ? "Applications open in"
        : "Applications closed";
  const statusColor =
    statusMode === "closes"
      ? "#22c55e"
      : statusMode === "opens"
        ? "#FFD166"
        : "#6B7280";

  return (
    <div className="min-h-screen bg-[#0F0F10]">
      {/* Auth-error banner — surfaces /api/auth/callback failures */}
      {authError && (
        <div className="px-8 md:px-20 lg:px-28 pt-24 md:pt-32">
          <div
            className="max-w-[900px] mx-auto rounded-xl px-4 py-3 flex items-start gap-3"
            style={{
              background: "rgba(239,68,68,0.08)",
              border: "1px solid rgba(239,68,68,0.3)",
            }}
          >
            <span className="mt-0.5 w-5 h-5 rounded-md bg-[#EF4444]/20 flex items-center justify-center flex-shrink-0">
              <span className="text-xs text-[#EF4444]">!</span>
            </span>
            <div className="flex-1">
              <p className="text-sm text-[#F1FFFF]">Sign-in didn&apos;t complete</p>
              <p className="text-xs text-[#9CA3AF] mt-1">
                Try again or use a different sign-in method.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Hero ── */}
      <section className={`relative ${authError ? "pt-8" : "pt-28 md:pt-36"} pb-8 md:pb-12 px-8 md:px-20 lg:px-28 overflow-hidden`}>
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] pointer-events-none" style={{ background: "radial-gradient(ellipse, rgba(34,197,94,0.06) 0%, transparent 65%)" }} />

        <div className="relative max-w-[900px] mx-auto">
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="text-xs tracking-widest uppercase mb-5"
            style={{ color: "#22c55e", fontFamily: "var(--font-highlight)" }}
          >
            <DecryptedText text="2026-27 Recruitment" speed={40} maxIterations={12} sequential characters="01!@#$%_-+=<>" className="text-[#22c55e]" encryptedClassName="text-[rgba(34,197,94,0.3)]" animateOn="view" />
          </motion.p>

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1, ease: EASE_OUT }}
            className="mb-6"
            style={{ fontFamily: '"Test Sohne", sans-serif', fontSize: "clamp(36px, 5.5vw, 68px)", fontWeight: 500, color: "#F1FFFF", lineHeight: 1.08, letterSpacing: "-0.03em" }}
          >
            Build what matters.
            <br />
            <GradientText colors={["#22c55e", "#4ade80", "#22c55e"]} animationSpeed={5}>
              Start here.
            </GradientText>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.3, ease: EASE_OUT }}
            className="text-base leading-relaxed mb-8 max-w-xl"
            style={{ color: "rgba(255,255,255,0.4)" }}
          >
            Apply for a leadership role on the 2026-27 executive team.{" "}
            <span style={{ color: statusColor }}>
              {statusMode === "closes"
                ? "Applications are open."
                : statusMode === "opens"
                  ? "Applications open soon."
                  : "This cycle is closed."}
            </span>
          </motion.p>

          {/* Terminal status bar */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.45, ease: EASE_OUT }}
            className="mb-10 px-4 py-3 rounded-lg inline-flex flex-wrap items-center gap-x-4 gap-y-2"
            style={{
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.05)",
              fontFamily: "var(--font-highlight)",
            }}
          >
            <span className="flex items-center gap-2">
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{
                  background: statusColor,
                  boxShadow: `0 0 6px ${statusColor}80`,
                  animation:
                    statusMode === "closed"
                      ? "none"
                      : "pulse 2s ease-in-out infinite",
                }}
              />
              <span
                className="text-xs"
                style={{ color: "rgba(255,255,255,0.3)" }}
              >
                {statusLabel}
              </span>
              {targetDate && (
                <span
                  className="text-xs"
                  style={{ color: statusColor }}
                >
                  <Countdown target={targetDate} />
                </span>
              )}
            </span>
            <span
              className="text-xs"
              style={{ color: "rgba(255,255,255,0.15)" }}
            >
              ·
            </span>
            <span
              className="text-xs"
              style={{ color: "rgba(255,255,255,0.3)" }}
            >
              {openCount} position{openCount === 1 ? "" : "s"} open
            </span>
          </motion.div>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.55, ease: EASE_OUT }}
            className="flex flex-wrap gap-4"
          >
            <a
              href="#positions"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-semibold transition-all duration-300"
              style={{ background: "#22c55e", color: "#0F0F10" }}
              onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "0 0 30px rgba(34,197,94,0.3)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "none"; }}
            >
              View Positions →
            </a>
            <Link
              href="/student/apply/dashboard"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-medium transition-all duration-300"
              style={{ color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.1)" }}
            >
              My Applications ↗
            </Link>
          </motion.div>
        </div>

        <style jsx>{`
          @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        `}</style>
      </section>

      {/* ── Credibility strip ── */}
      <section className="px-8 md:px-20 lg:px-28 pt-6 pb-10">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.7, ease: EASE_OUT }}
          className="max-w-[1100px] mx-auto grid grid-cols-3 gap-4 md:gap-8"
        >
          {[
            { value: "12", label: "projects shipped" },
            { value: "6", label: "nonprofit partners" },
            { value: "40+", label: "alumni in tech" },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-lg px-4 py-5"
              style={{
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.05)",
              }}
            >
              <p
                className="text-2xl md:text-3xl mb-1"
                style={{ color: "#F1FFFF", fontWeight: 500 }}
              >
                {s.value}
              </p>
              <p
                className="text-[10px] md:text-xs tracking-widest uppercase"
                style={{
                  color: "rgba(255,255,255,0.55)",
                  fontFamily: "var(--font-highlight)",
                }}
              >
                {s.label}
              </p>
            </div>
          ))}
        </motion.div>
      </section>

      {/* ── Timeline ── */}
      <section className="px-8 md:px-20 lg:px-28 pt-2 pb-4">
        <div className="max-w-[1100px] mx-auto">
          <div className="relative">
            <div className="absolute top-5 left-0 right-0 h-[1px] bg-white/[0.06]" />
            <div className="relative flex justify-between">
              {RECRUITMENT_PHASES.map((phase, i) => {
                const status = derivePhaseStatus(positions, phase.phase);
                const isActive = status === "active";
                return (
                  <div key={phase.phase} className={`flex flex-col ${i === 0 ? "items-start text-left" : "items-end text-right"}`} style={{ width: `${100 / RECRUITMENT_PHASES.length}%` }}>
                    <div className="relative mb-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-medium transition-all duration-300`}
                        style={{
                          background: isActive ? "rgba(29,155,240,0.15)" : "rgba(255,255,255,0.03)",
                          border: `1px solid ${isActive ? "rgba(29,155,240,0.3)" : "rgba(255,255,255,0.06)"}`,
                          color: isActive ? "#1d9bf0" : "rgba(255,255,255,0.3)",
                          fontFamily: "var(--font-highlight)",
                        }}
                      >
                        {String(phase.phase).padStart(2, "0")}
                      </div>
                      {isActive && <div className="absolute inset-0 rounded-lg border border-[#1d9bf0] animate-ping opacity-15" />}
                    </div>
                    <p className="text-sm mb-0.5" style={{ color: isActive ? "#F1FFFF" : "rgba(255,255,255,0.35)", fontWeight: 500 }}>{phase.title}</p>
                    <p className="text-[10px] tracking-wider uppercase" style={{ color: isActive ? "#1d9bf0" : "rgba(255,255,255,0.2)", fontFamily: "var(--font-highlight)" }}>{phase.dateLabel}</p>
                    {isActive && (
                      <span className="mt-2 px-2 py-0.5 rounded text-[9px] uppercase tracking-widest" style={{ background: "rgba(34,197,94,0.12)", color: "#22c55e", fontFamily: "var(--font-highlight)" }}>
                        Now Open
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ── Positions ── */}
      <section id="positions" ref={positionsRef} className="px-8 md:px-20 lg:px-28 pt-2 pb-16">
        <div className="max-w-[1100px] mx-auto">
          {/* Inline filter pills -- no redundant header */}
          <div className="flex items-center gap-2 mb-5">
            <span className="text-[10px] uppercase tracking-widest mr-2" style={{ color: "rgba(255,255,255,0.2)", fontFamily: "var(--font-highlight)" }}>Filter:</span>
            {[null, ...phases].map((phase) => (
              <button
                key={phase ?? "all"}
                onClick={() => setActivePhase(phase)}
                className="px-3 py-1.5 rounded-md text-xs transition-all duration-200"
                style={{
                  fontFamily: "var(--font-highlight)",
                  background: activePhase === phase ? "rgba(255,255,255,0.08)" : "transparent",
                  color: activePhase === phase ? "#F1FFFF" : "rgba(255,255,255,0.3)",
                  border: `1px solid ${activePhase === phase ? "rgba(255,255,255,0.12)" : "transparent"}`,
                }}
              >
                {phase === null ? "All" : `Phase ${String(phase).padStart(2, "0")} ${phaseLabels[phase] || ""}`}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            {loading ? (
              <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[0, 1, 2].map((i) => <div key={i} className="h-56 rounded-xl bg-white/[0.02] border border-white/[0.04] animate-pulse" />)}
              </motion.div>
            ) : loadError ? (
              <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center py-16 rounded-xl border" style={{ borderColor: "rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.04)" }}>
                <p className="text-sm mb-3" style={{ color: "#F1FFFF" }}>Couldn&apos;t load positions.</p>
                <p className="text-xs mb-5" style={{ color: "rgba(255,255,255,0.5)" }}>Check your connection and try again.</p>
                <button
                  onClick={() => window.location.reload()}
                  className="text-xs px-4 py-2 rounded-md transition-all"
                  style={{ color: "#F1FFFF", border: "1px solid rgba(255,255,255,0.15)", fontFamily: "var(--font-highlight)" }}
                >
                  Refresh
                </button>
              </motion.div>
            ) : filtered.length === 0 ? (
              <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center py-20 rounded-xl border border-white/[0.06] bg-white/[0.02]">
                <p className="text-sm" style={{ color: "rgba(255,255,255,0.3)", fontFamily: "var(--font-highlight)" }}>No positions in this phase.</p>
              </motion.div>
            ) : (
              <motion.div key={`grid-${activePhase ?? "all"}`} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.3, ease: EASE_OUT }} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filtered.map((position) => {
                  const isOpen = position.is_active;
                  return (
                    <Link key={position.slug} href={`/student/apply/${position.slug}`}>
                      <SpotlightCard
                        className="rounded-xl p-0 overflow-hidden cursor-pointer h-full transition-transform duration-300 hover:-translate-y-1"
                        spotlightColor={isOpen ? "rgba(34,197,94,0.06)" : "rgba(255,255,255,0.03)"}
                        style={{
                          background: "rgba(255,255,255,0.02)",
                          border: `1px solid ${isOpen ? "rgba(34,197,94,0.12)" : "rgba(255,255,255,0.06)"}`,
                          borderLeft: isOpen ? "3px solid rgba(34,197,94,0.4)" : "3px solid rgba(255,255,255,0.06)",
                          transition: "border-color 0.3s ease, transform 0.3s ease",
                        }}
                      >
                        {/* Header */}
                        <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                          <span className="text-[10px] uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.2)", fontFamily: "var(--font-highlight)" }}>
                            Phase {String(position.phase).padStart(2, "0")}
                          </span>
                          <span className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full" style={{ background: isOpen ? "#22c55e" : "rgba(255,255,255,0.15)", boxShadow: isOpen ? "0 0 6px rgba(34,197,94,0.5)" : "none" }} />
                            <span className="text-[10px] uppercase tracking-widest" style={{ color: isOpen ? "#22c55e" : "rgba(255,255,255,0.2)", fontFamily: "var(--font-highlight)" }}>
                              {isOpen ? "Open" : "Closed"}
                            </span>
                          </span>
                        </div>
                        {/* Body */}
                        <div className="p-5">
                          <h3 className="text-base mb-2" style={{ color: "#F1FFFF", fontWeight: 500 }}>{position.title}</h3>
                          <p className="text-xs leading-relaxed mb-4" style={{ color: "rgba(255,255,255,0.4)" }}>{position.description}</p>
                          <div className="flex items-center justify-between">
                            <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.2)", fontFamily: "var(--font-highlight)" }}>
                              Due {position.closes_at ? new Date(position.closes_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "TBD"}
                            </span>
                            {isOpen && <span className="text-xs" style={{ color: "#22c55e", fontFamily: "var(--font-highlight)" }}>Apply →</span>}
                          </div>
                        </div>
                      </SpotlightCard>
                    </Link>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </section>

      {/* ── Footer CTAs (terminal-style) ── */}
      <section className="px-8 md:px-20 lg:px-28 pb-16">
        <div className="max-w-[1100px] mx-auto">
          {[
            { cmd: "tethos apply --code", desc: "Internal and invite-only positions", href: "/student/apply/internal", label: "Enter Code →", color: "#c9a84c" },
            { cmd: "tethos help", desc: "Not sure which role fits?", href: "mailto:team@tethos.ca", label: "Get in Touch ↗", color: "rgba(255,255,255,0.4)" },
          ].map((item, i) => (
            <div key={item.cmd} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 py-6" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
              <div className="flex items-center gap-3">
                <span className="text-xs" style={{ color: item.color, fontFamily: "var(--font-highlight)" }}>$ {item.cmd}</span>
                <span className="text-sm" style={{ color: "rgba(255,255,255,0.35)" }}>{item.desc}</span>
              </div>
              {item.href.startsWith("mailto") ? (
                <a href={item.href} className="text-xs px-4 py-2 rounded-md transition-all duration-200" style={{ color: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.08)", fontFamily: "var(--font-highlight)" }}>
                  {item.label}
                </a>
              ) : (
                <Link href={item.href} className="text-xs px-4 py-2 rounded-md transition-all duration-200" style={{ color: item.color, border: `1px solid ${item.color}30`, fontFamily: "var(--font-highlight)" }}>
                  {item.label}
                </Link>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
