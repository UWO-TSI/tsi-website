"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import ApplicationForm from "@/components/recruit/ApplicationForm";
import AuthModal from "@/components/recruit/AuthModal";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Lock,
  Clock,
  ArrowRight,
  Check,
  FileText,
  Upload,
  MessageSquare,
  Eye,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getPositionStatus } from "@/lib/recruitment";
import type { Position } from "@/lib/recruitment";
import { getRoleContent } from "@/lib/recruitment-content";
import type { User } from "@supabase/supabase-js";

const EASE_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1];

const ACK_KEY = (slug: string) => `tethos:ack:${slug}`;

function estimateMinutes(position: Position): number {
  const essayMinutes = (position.essay_questions ?? []).reduce(
    (sum, q) => sum + Math.ceil(q.max_words / 60),
    0
  );
  // +3 for personal info, +2 for resume, +2 for review
  return Math.max(5, essayMinutes + 7);
}

export default function RoleApplicationPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params["role-slug"] as string;

  const [position, setPosition] = useState<Position | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [phase, setPhase] = useState<"read" | "apply">("read");
  const [acknowledged, setAcknowledged] = useState(false);
  const [scrolledToEnd, setScrolledToEnd] = useState(false);

  const endSentinelRef = useRef<HTMLDivElement>(null);

  const supabase = createClient();

  useEffect(() => {
    let cancelled = false;
    async function init() {
      // Fetch position and user in parallel
      const [userRes, positionsRes] = await Promise.allSettled([
        supabase.auth.getUser(),
        fetch(`/api/positions`).then((r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.json() as Promise<Position[]>;
        }),
      ]);

      if (cancelled) return;

      if (userRes.status === "fulfilled") {
        setUser(userRes.value.data.user);
      }

      if (positionsRes.status === "fulfilled") {
        const found = positionsRes.value.find((p) => p.slug === slug);
        setPosition(found ?? null);
        setLoadError(false);
      } else {
        setLoadError(true);
      }

      setLoading(false);
    }

    init();
    return () => {
      cancelled = true;
    };
  }, [slug, supabase]);

  // Restore acknowledgement across auth redirect
  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = sessionStorage.getItem(ACK_KEY(slug));
    if (saved === "1") {
      setAcknowledged(true);
      setScrolledToEnd(true);
    }
  }, [slug]);

  // Persist acknowledgement for auth round-trip
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (acknowledged) {
      sessionStorage.setItem(ACK_KEY(slug), "1");
    }
  }, [acknowledged, slug]);

  // Scroll-depth sentinel
  useEffect(() => {
    if (!endSentinelRef.current) return;
    if (scrolledToEnd) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setScrolledToEnd(true);
          observer.disconnect();
        }
      },
      { threshold: 0.5 }
    );
    observer.observe(endSentinelRef.current);
    return () => observer.disconnect();
  }, [position, scrolledToEnd]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0F0F10] flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <div className="w-8 h-8 rounded-full border-2 border-[#002FA7] border-t-transparent animate-spin" />
          <p className="font-mono text-xs text-[#6B7280] tracking-wider">
            Loading position...
          </p>
        </motion.div>
      </div>
    );
  }

  if (!position) {
    return (
      <div className="min-h-screen bg-[#0F0F10] flex flex-col items-center justify-center gap-6 px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE_OUT }}
          className="text-center"
        >
          <p className="text-[#6B7280] font-mono text-sm mb-2">
            {loadError ? "Couldn't load" : "404"}
          </p>
          <p className="text-[#F1FFFF] text-lg font-medium mb-2">
            {loadError ? "Couldn't reach the server" : "Position not found"}
          </p>
          <p className="text-[#9CA3AF] text-sm mb-6 max-w-sm">
            {loadError
              ? "Check your connection and try again."
              : "This role may have been removed or never existed."}
          </p>
          <div className="flex items-center justify-center gap-3">
            {loadError && (
              <button
                onClick={() => window.location.reload()}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#002FA7] text-[#F1FFFF] text-sm font-medium transition-all hover:bg-[#0039CC]"
              >
                Refresh
              </button>
            )}
            <button
              onClick={() => router.push("/student/apply")}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full border border-white/10 text-sm text-[#9CA3AF] hover:text-[#F1FFFF] hover:border-white/20 transition-all"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Positions
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  const status = getPositionStatus(position);
  const deadline = position.closes_at
    ? new Date(position.closes_at).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : null;
  const estMinutes = estimateMinutes(position);
  const essayCount = position.essay_questions?.length ?? 0;
  const totalWords =
    position.essay_questions?.reduce((s, q) => s + q.max_words, 0) ?? 0;
  const roleContent = getRoleContent(slug);

  const canStart = acknowledged && scrolledToEnd && !!user;
  const isClosed = status === "closed";
  const isUpcoming = status === "upcoming";

  return (
    <div className="min-h-screen bg-[#0F0F10]">
      <AnimatePresence mode="wait">
        {phase === "read" ? (
          <motion.div
            key="read"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: EASE_OUT }}
          >
            {/* Back link */}
            <div className="pt-8 md:pt-12 px-6 md:px-16">
              <div className="max-w-3xl mx-auto">
                <motion.button
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5, ease: EASE_OUT }}
                  onClick={() => router.push("/student/apply")}
                  className="group flex items-center gap-2 text-sm text-[#6B7280] hover:text-[#F1FFFF] transition-colors mb-10"
                >
                  <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
                  All Positions
                </motion.button>

                {/* Position header */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.7, delay: 0.1, ease: EASE_OUT }}
                  className="mb-8"
                >
                  <div className="flex items-center gap-3 mb-4 flex-wrap">
                    <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-[#002FA7]">
                      Phase {String(position.phase).padStart(2, "0")}
                    </span>
                    {status === "open" && (
                      <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#22C55E]/10 text-[#22C55E] text-[10px] font-mono uppercase tracking-wide">
                        <span className="relative flex h-1.5 w-1.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#22C55E] opacity-75" />
                          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#22C55E]" />
                        </span>
                        Open
                      </span>
                    )}
                    {isClosed && (
                      <span className="px-2.5 py-1 rounded-full bg-[#EF4444]/10 text-[#EF4444] text-[10px] font-mono uppercase tracking-wide">
                        Closed
                      </span>
                    )}
                    {isUpcoming && (
                      <span className="px-2.5 py-1 rounded-full bg-[#FFD166]/10 text-[#FFD166] text-[10px] font-mono uppercase tracking-wide">
                        Upcoming
                      </span>
                    )}
                    {roleContent?.positionsCount && (
                      <span className="px-2.5 py-1 rounded-full bg-white/5 text-[#9CA3AF] text-[10px] font-mono uppercase tracking-wide">
                        {roleContent.positionsCount}{" "}
                        {roleContent.positionsCount === "1"
                          ? "Position"
                          : "Positions"}
                      </span>
                    )}
                  </div>

                  <h1 className="text-4xl md:text-5xl font-semibold text-[#F1FFFF] tracking-tight mb-4">
                    {position.title}
                  </h1>
                  <p className="text-lg text-[#9CA3AF] leading-relaxed max-w-2xl">
                    {roleContent?.tagline ?? position.description}
                  </p>

                  {deadline && (
                    <div className="flex items-center gap-2 mt-5 font-mono text-xs text-[#6B7280]">
                      <Clock className="w-3.5 h-3.5" />
                      Applications close {deadline}
                    </div>
                  )}
                </motion.div>

                {/* Role meta strip */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.7, delay: 0.2, ease: EASE_OUT }}
                  className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-16"
                >
                  <MetaCard label="Time to apply" value={`~${estMinutes} min`} />
                  <MetaCard
                    label="Essay questions"
                    value={essayCount === 0 ? "None" : String(essayCount)}
                  />
                  <MetaCard
                    label="Total word limit"
                    value={totalWords === 0 ? "—" : totalWords.toLocaleString()}
                  />
                  <MetaCard
                    label="Phase"
                    value={String(position.phase).padStart(2, "0")}
                  />
                </motion.div>
              </div>
            </div>

            {/* Long-form content — driven by lib/recruitment-content.ts when
                we have a role-specific entry; falls back to a generic block. */}
            <div className="px-6 md:px-16">
              <div className="max-w-3xl mx-auto space-y-14 pb-10">
                {roleContent?.preApplyNote && (
                  <PreApplyNote text={roleContent.preApplyNote} delay={0.22} />
                )}

                <Section
                  eyebrow="01 — What you'll do"
                  title="Responsibilities"
                  delay={0.25}
                >
                  {roleContent ? (
                    <ul className="space-y-3 list-none pl-0">
                      {roleContent.whatYoullDo.map((item, i) => (
                        <Bullet key={i}>{item}</Bullet>
                      ))}
                    </ul>
                  ) : (
                    <p>
                      As {position.title}, you&apos;ll own a core area of
                      Tethos. This isn&apos;t a resume-filler role — you&apos;ll
                      be expected to make decisions, run meetings, and ship
                      work that the rest of the team depends on.
                    </p>
                  )}
                </Section>

                <Section
                  eyebrow="02 — Who you are"
                  title="The kind of person who fits"
                  delay={0.3}
                >
                  {roleContent ? (
                    <ul className="space-y-3 list-none pl-0">
                      {roleContent.whoYouAre.map((item, i) => (
                        <Bullet key={i}>{item}</Bullet>
                      ))}
                    </ul>
                  ) : (
                    <p>
                      We hire for judgment and ownership over credentials. The
                      best Tethos members are people who would have done this
                      work anyway, club or no club.
                    </p>
                  )}
                </Section>

                {roleContent?.about && (
                  <AboutBlock about={roleContent.about} delay={0.35} />
                )}

                <Section
                  eyebrow={roleContent?.about ? "04 — Before you apply" : "03 — Before you apply"}
                  title="What the application looks like"
                  delay={0.4}
                >
                  <p className="mb-6">
                    Four short steps, about {estMinutes} minutes if you come
                    prepared. You can save your draft and return anytime —
                    we&apos;ll restore it automatically.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                    <StepPreview
                      n={1}
                      icon={<FileText className="w-3.5 h-3.5" />}
                      label="Personal info"
                    />
                    <StepPreview
                      n={2}
                      icon={<Upload className="w-3.5 h-3.5" />}
                      label="Resume (PDF)"
                    />
                    <StepPreview
                      n={3}
                      icon={<MessageSquare className="w-3.5 h-3.5" />}
                      label={
                        essayCount === 0
                          ? "No essays"
                          : `${essayCount} essay${essayCount > 1 ? "s" : ""}`
                      }
                    />
                    <StepPreview
                      n={4}
                      icon={<Eye className="w-3.5 h-3.5" />}
                      label="Review & submit"
                    />
                  </div>

                  {roleContent?.applyInstructions && (
                    <div
                      className="mt-6 rounded-xl px-5 py-4"
                      style={{
                        background: "rgba(255,209,102,0.06)",
                        border: "1px solid rgba(255,209,102,0.25)",
                      }}
                    >
                      <p className="text-xs font-mono uppercase tracking-[0.2em] text-[#FFD166] mb-2">
                        How to apply
                      </p>
                      <p className="text-sm text-[#E5E7EB] leading-relaxed">
                        {roleContent.applyInstructions}
                      </p>
                    </div>
                  )}
                </Section>

                {/* End-of-content sentinel for scroll tracking */}
                <div ref={endSentinelRef} aria-hidden />
              </div>
            </div>

            {/* Apply gate */}
            <div className="px-6 md:px-16 pb-24">
              <div className="max-w-3xl mx-auto">
                <motion.div
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.7, delay: 0.45, ease: EASE_OUT }}
                  className="rounded-2xl p-8 md:p-10"
                  style={{
                    background:
                      "linear-gradient(135deg, rgba(0,47,167,0.08) 0%, rgba(255,255,255,0.02) 100%)",
                    border: "1px solid rgba(0,47,167,0.25)",
                  }}
                >
                  {isClosed ? (
                    <ClosedCTA positionTitle={position.title} />
                  ) : isUpcoming ? (
                    <UpcomingCTA
                      positionTitle={position.title}
                      opensAt={position.opens_at}
                    />
                  ) : !user ? (
                    <SignInCTA
                      positionTitle={position.title}
                      onSignIn={() => setShowAuth(true)}
                    />
                  ) : (
                    <ReadyToApply
                      acknowledged={acknowledged}
                      scrolledToEnd={scrolledToEnd}
                      canStart={canStart}
                      onToggleAck={() => setAcknowledged((v) => !v)}
                      onStart={() => {
                        setPhase("apply");
                        // Scroll to form top
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                      estMinutes={estMinutes}
                    />
                  )}
                </motion.div>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="apply"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.5, ease: EASE_OUT }}
            className="pt-8 md:pt-12 px-6 md:px-16 pb-24"
          >
            <div className="max-w-2xl mx-auto">
              <button
                onClick={() => setPhase("read")}
                className="group flex items-center gap-2 text-sm text-[#6B7280] hover:text-[#F1FFFF] transition-colors mb-8"
              >
                <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
                Back to role
              </button>

              <div className="mb-8">
                <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-[#002FA7] mb-2">
                  Applying for
                </p>
                <h1 className="text-2xl md:text-3xl font-semibold text-[#F1FFFF]">
                  {position.title}
                </h1>
              </div>

              {user && (
                <ApplicationForm position={position} userId={user.id} />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AuthModal
        isOpen={showAuth}
        onClose={() => setShowAuth(false)}
        redirectTo={`/student/apply/${slug}`}
      />
    </div>
  );
}

function MetaCard({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="rounded-xl px-4 py-4"
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-[#6B7280] mb-2">
        {label}
      </p>
      <p className="text-[#F1FFFF] text-base font-medium">{value}</p>
    </div>
  );
}

function PreApplyNote({ text, delay }: { text: string; delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.6, delay, ease: EASE_OUT }}
      className="rounded-2xl p-6"
      style={{
        background: "rgba(0,47,167,0.08)",
        border: "1px solid rgba(0,47,167,0.25)",
      }}
    >
      <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-[#002FA7] mb-3">
        A note before you apply
      </p>
      <p className="text-sm md:text-base text-[#E5E7EB] leading-relaxed">
        {text}
      </p>
    </motion.div>
  );
}

function AboutBlock({
  about,
  delay,
}: {
  about: { title: string; body: string; subtitle?: string; stats?: string[] };
  delay: number;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.7, delay, ease: EASE_OUT }}
    >
      <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-[#6B7280] mb-3">
        03 — About the work
      </p>
      <h2 className="text-2xl md:text-3xl font-semibold text-[#F1FFFF] tracking-tight mb-5">
        {about.title}
      </h2>
      <div className="text-[#9CA3AF] leading-relaxed max-w-2xl">
        <p>{about.body}</p>
        {about.subtitle && about.stats && about.stats.length > 0 && (
          <div className="mt-6 rounded-xl p-5"
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-[#002FA7] mb-3">
              {about.subtitle}
            </p>
            <ul className="space-y-2 list-none pl-0">
              {about.stats.map((stat, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-[#E5E7EB]">
                  <span className="mt-2 inline-block w-1 h-1 rounded-full bg-[#002FA7] flex-shrink-0" />
                  <span>{stat}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </motion.section>
  );
}

function Section({
  eyebrow,
  title,
  children,
  delay,
}: {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
  delay: number;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.7, delay, ease: EASE_OUT }}
    >
      <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-[#6B7280] mb-3">
        {eyebrow}
      </p>
      <h2 className="text-2xl md:text-3xl font-semibold text-[#F1FFFF] tracking-tight mb-5">
        {title}
      </h2>
      <div className="text-[#9CA3AF] leading-relaxed space-y-4 max-w-2xl">
        {children}
      </div>
    </motion.section>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="mt-2 inline-block w-1 h-1 rounded-full bg-[#002FA7] flex-shrink-0" />
      <span>{children}</span>
    </li>
  );
}

function StepPreview({
  n,
  icon,
  label,
}: {
  n: number;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <div
      className="rounded-xl p-4"
      style={{
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="font-mono text-[10px] text-[#6B7280]">
          {String(n).padStart(2, "0")}
        </span>
        <span className="text-[#002FA7]">{icon}</span>
      </div>
      <p className="text-sm text-[#F1FFFF]">{label}</p>
    </div>
  );
}

function SignInCTA({
  positionTitle,
  onSignIn,
}: {
  positionTitle: string;
  onSignIn: () => void;
}) {
  return (
    <div className="text-center">
      <div className="w-12 h-12 rounded-full bg-[#002FA7]/15 flex items-center justify-center mx-auto mb-5">
        <Lock className="w-5 h-5 text-[#002FA7]" />
      </div>
      <h3 className="text-xl font-semibold text-[#F1FFFF] mb-2">
        Sign in to apply
      </h3>
      <p className="text-sm text-[#6B7280] mb-8 max-w-sm mx-auto">
        Create an account or sign in to submit your application for{" "}
        <span className="text-[#9CA3AF]">{positionTitle}</span>.
      </p>
      <motion.button
        onClick={onSignIn}
        className="group inline-flex items-center gap-2 px-8 py-3.5 rounded-full bg-[#002FA7] text-[#F1FFFF] text-sm font-medium transition-all hover:bg-[#0039CC] hover:shadow-[0_0_30px_rgba(0,47,167,0.25)]"
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        Sign In / Sign Up
        <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
      </motion.button>
      <p className="text-[10px] text-[#4B5563] mt-6 font-mono">
        Google OAuth or email/password
      </p>
    </div>
  );
}

function ClosedCTA({ positionTitle }: { positionTitle: string }) {
  return (
    <div className="text-center">
      <h3 className="text-xl font-semibold text-[#F1FFFF] mb-2">
        Applications closed
      </h3>
      <p className="text-sm text-[#6B7280] mb-6 max-w-sm mx-auto">
        {positionTitle} is no longer accepting applications for this cycle.
      </p>
      <a
        href="/student/apply"
        className="inline-flex items-center gap-2 px-6 py-3 rounded-full border border-white/10 text-sm text-[#9CA3AF] hover:text-[#F1FFFF] hover:border-white/20 transition-all"
      >
        See other open roles
        <ArrowRight className="w-4 h-4" />
      </a>
    </div>
  );
}

function UpcomingCTA({
  positionTitle,
  opensAt,
}: {
  positionTitle: string;
  opensAt: string | null;
}) {
  const label = opensAt
    ? new Date(opensAt).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
      })
    : "soon";
  return (
    <div className="text-center">
      <h3 className="text-xl font-semibold text-[#F1FFFF] mb-2">
        Opens {label}
      </h3>
      <p className="text-sm text-[#6B7280] mb-6 max-w-sm mx-auto">
        {positionTitle} isn&apos;t open yet. Come back when applications go
        live.
      </p>
      <a
        href="/student/apply"
        className="inline-flex items-center gap-2 px-6 py-3 rounded-full border border-white/10 text-sm text-[#9CA3AF] hover:text-[#F1FFFF] hover:border-white/20 transition-all"
      >
        See other roles
        <ArrowRight className="w-4 h-4" />
      </a>
    </div>
  );
}

function ReadyToApply({
  acknowledged,
  scrolledToEnd,
  canStart,
  onToggleAck,
  onStart,
  estMinutes,
}: {
  acknowledged: boolean;
  scrolledToEnd: boolean;
  canStart: boolean;
  onToggleAck: () => void;
  onStart: () => void;
  estMinutes: number;
}) {
  return (
    <div>
      <h3 className="text-xl font-semibold text-[#F1FFFF] mb-2">
        Ready to apply?
      </h3>
      <p className="text-sm text-[#9CA3AF] mb-6 leading-relaxed">
        Applications are reviewed by the founding team. Take your time — the
        essays are short but we read every word.
      </p>

      <AnimatePresence>
        {scrolledToEnd && (
          <motion.button
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: EASE_OUT }}
            onClick={onToggleAck}
            className="w-full flex items-start gap-3 p-4 rounded-xl mb-6 text-left transition-colors"
            style={{
              background: acknowledged
                ? "rgba(0,47,167,0.12)"
                : "rgba(255,255,255,0.03)",
              border: `1px solid ${
                acknowledged
                  ? "rgba(0,47,167,0.4)"
                  : "rgba(255,255,255,0.08)"
              }`,
            }}
          >
            <span
              className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded-md flex items-center justify-center transition-colors ${
                acknowledged
                  ? "bg-[#002FA7] border-[#002FA7]"
                  : "border border-white/20"
              }`}
            >
              {acknowledged && <Check className="w-3 h-3 text-[#F1FFFF]" />}
            </span>
            <span className="text-sm text-[#F1FFFF] leading-relaxed">
              I&apos;ve read the full role description and I&apos;m ready to
              apply.
            </span>
          </motion.button>
        )}
      </AnimatePresence>

      {!scrolledToEnd && (
        <div className="flex items-center gap-2 text-xs text-[#6B7280] font-mono mb-6">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#FFD166] animate-pulse" />
          Scroll through the full role description to continue
        </div>
      )}

      <motion.button
        onClick={onStart}
        disabled={!canStart}
        whileHover={canStart ? { scale: 1.01 } : {}}
        whileTap={canStart ? { scale: 0.99 } : {}}
        className={`w-full inline-flex items-center justify-center gap-2 px-6 py-4 rounded-full text-sm font-medium transition-all ${
          canStart
            ? "bg-[#002FA7] text-[#F1FFFF] hover:bg-[#0039CC] hover:shadow-[0_0_30px_rgba(0,47,167,0.25)] cursor-pointer"
            : "bg-white/5 text-[#6B7280] cursor-not-allowed"
        }`}
      >
        Start application
        <span className="font-mono text-xs opacity-70">
          ~{estMinutes} min
        </span>
        <ArrowRight className="w-4 h-4" />
      </motion.button>

      {!canStart && scrolledToEnd && (
        <p className="text-center text-xs text-[#6B7280] mt-3">
          Confirm you&apos;ve read the role to continue
        </p>
      )}
    </div>
  );
}
