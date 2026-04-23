"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useInView, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { POSITION_SEED_DATA, RECRUITMENT_PHASES } from "@/lib/recruitment";
import type { Position } from "@/lib/recruitment";
import DecryptedText from "@/components/ui/DecryptedText";
import GradientText from "@/components/ui/GradientText";
import SpotlightCard from "@/components/ui/SpotlightCard";
import Countdown from "@/components/recruit/Countdown";

const EASE_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1];

function getCurrentPhaseStatus(phase: number): "active" | "upcoming" | "completed" {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  if (phase === 1) {
    if (year > 2026 || (year === 2026 && month > 5)) return "completed";
    if (year === 2026 && month >= 4) return "active";
    return "upcoming";
  }
  if (phase === 2) {
    if (year > 2026 || (year === 2026 && month > 9)) return "completed";
    if (year === 2026 && month >= 9) return "active";
    return "upcoming";
  }
  return "upcoming";
}

export default function RecruitmentPage() {
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [activePhase, setActivePhase] = useState<number | null>(null);

  const positionsRef = useRef<HTMLDivElement>(null);
  const positionsInView = useInView(positionsRef, { once: true, margin: "-60px" });

  useEffect(() => {
    fetch("/api/positions")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setPositions(data);
        } else {
          setPositions(
            POSITION_SEED_DATA.filter((p) => p.visibility === "public").map((p, i) => ({
              ...p, id: `seed-${i}`, created_at: new Date().toISOString(),
            }))
          );
        }
      })
      .catch(() => {
        setPositions(
          POSITION_SEED_DATA.filter((p) => p.visibility === "public").map((p, i) => ({
            ...p, id: `seed-${i}`, created_at: new Date().toISOString(),
          }))
        );
      })
      .finally(() => setLoading(false));
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
      {/* ── Hero ── */}
      <section className="relative pt-28 pb-8 md:pt-36 md:pb-12 px-8 md:px-20 lg:px-28 overflow-hidden">
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

      {/* ── Timeline ── */}
      <section className="px-8 md:px-20 lg:px-28 pt-2 pb-4">
        <div className="max-w-[1100px] mx-auto">
          <div className="relative">
            <div className="absolute top-5 left-0 right-0 h-[1px] bg-white/[0.06]" />
            <div className="relative flex justify-between">
              {RECRUITMENT_PHASES.map((phase, i) => {
                const status = getCurrentPhaseStatus(phase.phase);
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
