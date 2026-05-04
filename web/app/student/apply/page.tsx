"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowRight, Check } from "lucide-react";
import { isPositionOpen } from "@/lib/recruitment";
import type { Position } from "@/lib/recruitment";
import { createClient } from "@/lib/supabase/client";
import DecryptedText from "@/components/ui/DecryptedText";
import GradientText from "@/components/ui/GradientText";
import Countdown from "@/components/recruit/Countdown";

const EASE_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1];

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
  const [appliedPositionIds, setAppliedPositionIds] = useState<Set<string>>(
    new Set()
  );

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

  // Look up which positions the signed-in user has already applied to so
  // we can mark those cards. RLS scopes the query to their own rows.
  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      const { data } = await supabase
        .from("applications")
        .select("position_id")
        .eq("user_id", user.id);
      if (!cancelled && data) {
        setAppliedPositionIds(new Set(data.map((a) => a.position_id)));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const now = new Date();
  const openPositions = positions.filter(isPositionOpen);
  const openCount = openPositions.length;

  // Compute the most informative countdown target.
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
      ? "#1D9BF0"
      : statusMode === "opens"
        ? "#FFD166"
        : "#6B7280";
  const statusSummary =
    statusMode === "closes"
      ? "Applications are open."
      : statusMode === "opens"
        ? "Applications open soon."
        : "This cycle is closed.";

  return (
    <div className="min-h-screen bg-[#0F0F10]">
      {/* Auth-error banner — surfaces /api/auth/callback failures */}
      {authError && (
        <div className="px-6 md:px-12 lg:px-20 pt-24 md:pt-32">
          <div
            className="max-w-[820px] mx-auto rounded-xl px-4 py-3 flex items-start gap-3"
            style={{
              background: "rgba(239,68,68,0.08)",
              border: "1px solid rgba(239,68,68,0.3)",
            }}
          >
            <span className="mt-0.5 w-5 h-5 rounded-md bg-[#EF4444]/20 flex items-center justify-center flex-shrink-0">
              <span className="text-xs text-[#EF4444]">!</span>
            </span>
            <div className="flex-1">
              <p className="text-sm text-[#F1FFFF]">
                Sign-in didn&apos;t complete
              </p>
              <p className="text-xs text-[#9CA3AF] mt-1">
                Try again or use a different sign-in method.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Hero ── */}
      <section
        className={`relative ${
          authError ? "pt-10" : "pt-28 md:pt-40"
        } pb-20 md:pb-28 px-6 md:px-12 lg:px-20`}
      >
        <div className="relative max-w-[820px] mx-auto">
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="text-xs tracking-[0.25em] uppercase mb-6"
            style={{ color: "#1D9BF0", fontFamily: "var(--font-highlight)" }}
          >
            <DecryptedText
              text="2026-27 Recruitment"
              speed={40}
              maxIterations={12}
              sequential
              characters="01!@#$%_-+=<>"
              className="text-[#1D9BF0]"
              encryptedClassName="text-[rgba(29,155,240,0.3)]"
              animateOn="view"
            />
          </motion.p>

          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1, ease: EASE_OUT }}
            className="mb-6"
            style={{
              fontFamily: '"Test Sohne", sans-serif',
              fontSize: "clamp(40px, 6vw, 72px)",
              fontWeight: 500,
              color: "#F1FFFF",
              lineHeight: 1.05,
              letterSpacing: "-0.035em",
            }}
          >
            Build what matters.
            <br />
            <GradientText
              colors={["#1D9BF0", "#5DB8F5", "#1D9BF0"]}
              animationSpeed={5}
            >
              Start here.
            </GradientText>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.25, ease: EASE_OUT }}
            className="text-base md:text-lg leading-relaxed mb-10 max-w-[36ch]"
            style={{ color: "rgba(255,255,255,0.55)" }}
          >
            Apply for a leadership role on the 2026-27 executive team.{" "}
            <span style={{ color: statusColor }}>{statusSummary}</span>
          </motion.p>

          {/* Status line — minimal, type-led */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4, ease: EASE_OUT }}
            className="mb-10 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs"
            style={{ fontFamily: "var(--font-highlight)" }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{
                background: statusColor,
                boxShadow: `0 0 8px ${statusColor}80`,
                animation:
                  statusMode === "closed"
                    ? "none"
                    : "applyPulse 2s ease-in-out infinite",
              }}
            />
            <span style={{ color: "rgba(255,255,255,0.5)" }}>
              {statusLabel}
            </span>
            {targetDate && (
              <span style={{ color: statusColor }}>
                <Countdown target={targetDate} />
              </span>
            )}
            <span aria-hidden style={{ color: "rgba(255,255,255,0.18)" }}>
              ·
            </span>
            <span style={{ color: "rgba(255,255,255,0.5)" }}>
              {openCount} {openCount === 1 ? "position" : "positions"} open
            </span>
          </motion.div>

          {/* CTAs — single visual primary, secondary tertiary */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5, ease: EASE_OUT }}
            className="flex flex-wrap items-center gap-5"
          >
            <a
              href="#positions"
              className="group inline-flex items-center gap-2 px-6 py-3 rounded-full text-sm font-semibold transition-all duration-300"
              style={{ background: "#1D9BF0", color: "#0F0F10" }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow =
                  "0 0 28px rgba(29,155,240,0.32)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              View positions
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
            </a>
            <Link
              href="/student/apply/dashboard"
              className="text-sm transition-colors duration-200"
              style={{ color: "rgba(255,255,255,0.5)" }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "#F1FFFF";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "rgba(255,255,255,0.5)";
              }}
            >
              My applications →
            </Link>
          </motion.div>
        </div>

        <style jsx>{`
          @keyframes applyPulse {
            0%, 100% { opacity: 1; }
            50%      { opacity: 0.45; }
          }
        `}</style>
      </section>

      {/* ── Positions ── */}
      <section
        id="positions"
        ref={positionsRef}
        className="px-6 md:px-12 lg:px-20 pb-24"
      >
        <div className="max-w-[820px] mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.7, ease: EASE_OUT }}
            className="mb-10 flex items-baseline justify-between gap-6"
          >
            <h2
              className="tracking-tight"
              style={{
                fontFamily: '"Test Sohne", sans-serif',
                fontSize: "clamp(22px, 2.4vw, 28px)",
                fontWeight: 500,
                color: "#F1FFFF",
                letterSpacing: "-0.02em",
              }}
            >
              Open positions
            </h2>
            <span
              className="text-xs"
              style={{
                color: "rgba(255,255,255,0.35)",
                fontFamily: "var(--font-highlight)",
              }}
            >
              {openCount} of {positions.length}
            </span>
          </motion.div>

          <AnimatePresence mode="wait">
            {loading ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="grid grid-cols-1 sm:grid-cols-2 gap-4"
              >
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="h-44 rounded-2xl bg-white/[0.02] border border-white/[0.04] animate-pulse"
                  />
                ))}
              </motion.div>
            ) : loadError ? (
              <motion.div
                key="error"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-center py-16 rounded-2xl border"
                style={{
                  borderColor: "rgba(239,68,68,0.3)",
                  background: "rgba(239,68,68,0.04)",
                }}
              >
                <p className="text-sm mb-2" style={{ color: "#F1FFFF" }}>
                  Couldn&apos;t load positions.
                </p>
                <p
                  className="text-xs mb-5"
                  style={{ color: "rgba(255,255,255,0.5)" }}
                >
                  Check your connection and try again.
                </p>
                <button
                  onClick={() => window.location.reload()}
                  className="text-xs px-4 py-2 rounded-full transition-all"
                  style={{
                    color: "#F1FFFF",
                    border: "1px solid rgba(255,255,255,0.15)",
                    fontFamily: "var(--font-highlight)",
                  }}
                >
                  Refresh
                </button>
              </motion.div>
            ) : positions.length === 0 ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-center py-16"
              >
                <p
                  className="text-sm"
                  style={{
                    color: "rgba(255,255,255,0.35)",
                    fontFamily: "var(--font-highlight)",
                  }}
                >
                  No positions yet.
                </p>
              </motion.div>
            ) : (
              <motion.div
                key="grid"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4, ease: EASE_OUT }}
                className="grid grid-cols-1 sm:grid-cols-2 gap-4"
              >
                {positions.map((position, i) => (
                  <PositionCard
                    key={position.slug}
                    position={position}
                    index={i}
                    hasApplied={appliedPositionIds.has(position.id)}
                  />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </section>

      {/* ── Footer — quiet, two simple links ── */}
      <section className="px-6 md:px-12 lg:px-20 pb-24">
        <div className="max-w-[820px] mx-auto pt-10 border-t border-white/[0.06]">
          <ul className="flex flex-col gap-4">
            <FooterLink
              href="/student/apply/internal"
              label="Past Tethos members"
              description="Apply for invite-only positions with an access code."
            />
            <FooterLink
              href="mailto:dliu468@uwo.ca,anguyen.hba2027@ivey.ca?subject=Tethos%20recruitment%20question"
              label="Not sure which role fits?"
              description="Email Tethos' incoming co-presidents — David Liu and Alice Nguyen."
              external
            />
          </ul>
        </div>
      </section>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Position card — flat, restrained, type-led.
   No spotlight effect, no border-left accent,
   no decorative chrome. Subtle lift on hover.
   ───────────────────────────────────────────── */
function PositionCard({
  position,
  index,
  hasApplied,
}: {
  position: Position;
  index: number;
  hasApplied: boolean;
}) {
  const isOpen = isPositionOpen(position);
  const opensAtMs = position.opens_at ? new Date(position.opens_at).getTime() : null;
  const closesAtMs = position.closes_at ? new Date(position.closes_at).getTime() : null;
  const nowMs = Date.now();
  const isUpcoming =
    !!position.is_active && !!opensAtMs && opensAtMs > nowMs;
  const isClosed = !isOpen && !isUpcoming;
  // Pin date strings to Toronto time so the visual matches the club's
  // announced schedule regardless of where the applicant lives. The
  // countdown (real-time delta to a UTC instant) handles their local
  // perspective.
  // For the close date, subtract 30 minutes so a deadline of "May 13
  // 00:10 EDT" reads as "Due May 12" (matches how David framed it and
  // how applicants think about end-of-day deadlines).
  const dueLabel = position.closes_at
    ? new Date(new Date(position.closes_at).getTime() - 30 * 60 * 1000)
        .toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          timeZone: "America/Toronto",
        })
    : null;
  const opensLabel = position.opens_at
    ? new Date(position.opens_at).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        timeZone: "America/Toronto",
      })
    : null;
  void closesAtMs;
  void isClosed;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.5, delay: index * 0.05, ease: EASE_OUT }}
    >
      <Link
        href={`/student/apply/${position.slug}`}
        className="group block rounded-2xl p-6 md:p-7 h-full transition-colors duration-300"
        style={{
          background: hasApplied
            ? "rgba(29,155,240,0.04)"
            : "rgba(255,255,255,0.025)",
          border: `1px solid ${
            hasApplied ? "rgba(29,155,240,0.2)" : "rgba(255,255,255,0.06)"
          }`,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = hasApplied
            ? "rgba(29,155,240,0.07)"
            : "rgba(255,255,255,0.04)";
          e.currentTarget.style.borderColor = hasApplied
            ? "rgba(29,155,240,0.32)"
            : "rgba(255,255,255,0.12)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = hasApplied
            ? "rgba(29,155,240,0.04)"
            : "rgba(255,255,255,0.025)";
          e.currentTarget.style.borderColor = hasApplied
            ? "rgba(29,155,240,0.2)"
            : "rgba(255,255,255,0.06)";
        }}
      >
        <div className="flex items-center justify-between mb-5">
          <span
            className="text-[10px] uppercase tracking-[0.2em]"
            style={{
              color: "rgba(255,255,255,0.3)",
              fontFamily: "var(--font-highlight)",
            }}
          >
            Phase {String(position.phase).padStart(2, "0")}
          </span>
          {hasApplied ? (
            <span
              className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.2em]"
              style={{
                color: "#1D9BF0",
                fontFamily: "var(--font-highlight)",
              }}
            >
              <Check className="w-3 h-3" />
              Applied
            </span>
          ) : isOpen ? (
            <span
              className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.2em]"
              style={{
                color: "#1D9BF0",
                fontFamily: "var(--font-highlight)",
              }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{
                  background: "#1D9BF0",
                  boxShadow: "0 0 6px rgba(29,155,240,0.5)",
                }}
              />
              Open
            </span>
          ) : isUpcoming ? (
            <span
              className="text-[10px] uppercase tracking-[0.2em]"
              style={{
                color: "#FFD166",
                fontFamily: "var(--font-highlight)",
              }}
            >
              {opensLabel ? `Opens ${opensLabel}` : "Upcoming"}
            </span>
          ) : (
            <span
              className="text-[10px] uppercase tracking-[0.2em]"
              style={{
                color: "rgba(255,255,255,0.3)",
                fontFamily: "var(--font-highlight)",
              }}
            >
              Closed
            </span>
          )}
        </div>

        <h3
          className="text-lg md:text-xl mb-2 transition-colors"
          style={{ color: "#F1FFFF", fontWeight: 500 }}
        >
          {position.title}
        </h3>
        <p
          className="text-sm leading-relaxed mb-5"
          style={{ color: "rgba(255,255,255,0.5)" }}
        >
          {position.description}
        </p>

        <div className="flex items-center justify-between">
          <span
            className="text-[10px] uppercase tracking-[0.2em]"
            style={{
              color: "rgba(255,255,255,0.25)",
              fontFamily: "var(--font-highlight)",
            }}
          >
            {dueLabel ? `Due ${dueLabel}` : "Date TBD"}
          </span>
          <span
            className="inline-flex items-center gap-1 text-xs transition-transform group-hover:translate-x-0.5"
            style={{
              color: hasApplied
                ? "#1D9BF0"
                : isOpen
                  ? "#F1FFFF"
                  : isUpcoming
                    ? "rgba(255,255,255,0.4)"
                    : "rgba(255,255,255,0.25)",
              fontFamily: "var(--font-highlight)",
            }}
          >
            {hasApplied
              ? "View"
              : isOpen
                ? "Apply"
                : isUpcoming
                  ? "Read more"
                  : ""}
            {(hasApplied || isOpen || isUpcoming) && (
              <ArrowRight className="w-3.5 h-3.5" />
            )}
          </span>
        </div>
      </Link>
    </motion.div>
  );
}

/* ─────────────────────────────────────────────
   Footer link — quiet, unboxed, scannable.
   ───────────────────────────────────────────── */
function FooterLink({
  href,
  label,
  description,
  external,
}: {
  href: string;
  label: string;
  description: string;
  external?: boolean;
}) {
  const Component: React.ElementType = external ? "a" : Link;
  const props = external
    ? { href, target: undefined, rel: undefined }
    : { href };
  return (
    <li>
      <Component
        {...props}
        className="group flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1 sm:gap-6 py-3 transition-colors"
      >
        <div>
          <p
            className="text-sm transition-colors"
            style={{ color: "#F1FFFF" }}
          >
            {label}
          </p>
          <p
            className="text-xs mt-1"
            style={{ color: "rgba(255,255,255,0.4)" }}
          >
            {description}
          </p>
        </div>
        <span
          className="inline-flex items-center gap-1 text-xs whitespace-nowrap transition-transform group-hover:translate-x-0.5"
          style={{
            color: "rgba(255,255,255,0.4)",
            fontFamily: "var(--font-highlight)",
          }}
        >
          {external ? "Email" : "Enter code"}
          <ArrowRight className="w-3 h-3" />
        </span>
      </Component>
    </li>
  );
}
