"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import confetti from "canvas-confetti";
import { fadeUpVariants, STAGGER_NORMAL } from "@/lib/motion";
import Button from "@/components/ui/Button";
import { useRouter } from "next/navigation";
import { Share2, Check } from "lucide-react";
import type { Position } from "@/lib/recruitment";

interface SuccessScreenProps {
  positionTitle: string;
  applicantName?: string;
  position?: Position;
  positionSlug?: string;
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric" });
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export default function SuccessScreen({
  positionTitle,
  applicantName,
  position,
  positionSlug,
}: SuccessScreenProps) {
  const router = useRouter();
  const confettiFired = useRef(false);
  const [shared, setShared] = useState(false);

  useEffect(() => {
    if (confettiFired.current) return;
    confettiFired.current = true;
    if (prefersReducedMotion()) return;

    const end = Date.now() + 1500;
    const colors = ["#002FA7", "#FFD166", "#F1FFFF"];

    (function frame() {
      confetti({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.7 },
        colors,
        shapes: ["square"],
      });
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.7 },
        colors,
        shapes: ["square"],
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    })();
  }, []);

  const firstName = applicantName?.split(" ")[0] ?? null;

  // Build timeline expectations. If position has closes_at, use offsets from it.
  const closesAt = position?.closes_at ? new Date(position.closes_at) : null;
  const now = new Date();
  const reviewStart = closesAt && closesAt > now ? closesAt : now;
  const reviewEnd = new Date(reviewStart.getTime() + 7 * 24 * 60 * 60 * 1000);
  const finalDecision = new Date(
    reviewEnd.getTime() + 7 * 24 * 60 * 60 * 1000
  );

  const timeline = [
    {
      label: "Submitted",
      date: formatDate(now),
      status: "current" as const,
    },
    {
      label: "Review",
      date: `${formatDate(reviewStart)} – ${formatDate(reviewEnd)}`,
      status: "upcoming" as const,
    },
    {
      label: "Decisions",
      date: `by ${formatDate(finalDecision)}`,
      status: "upcoming" as const,
    },
  ];

  const handleShare = async () => {
    const shareUrl =
      typeof window !== "undefined" && positionSlug
        ? `${window.location.origin}/student/apply/${positionSlug}`
        : typeof window !== "undefined"
          ? window.location.origin
          : "";
    const shareText = `I just applied for ${positionTitle} at Tethos — they're hiring.`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: "Tethos recruitment",
          text: shareText,
          url: shareUrl,
        });
        setShared(true);
      } catch {
        // User cancelled, ignore
      }
    } else if (navigator.clipboard) {
      await navigator.clipboard.writeText(`${shareText} ${shareUrl}`);
      setShared(true);
      setTimeout(() => setShared(false), 2500);
    }
  };

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-6 py-16">
      <div className="max-w-lg w-full">
        {/* Animated checkmark */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{
            type: "spring",
            stiffness: 200,
            damping: 15,
            delay: 0.2,
          }}
          className="mx-auto mb-8 w-20 h-20 rounded-full bg-[#002FA7]/20 border-2 border-[#002FA7] flex items-center justify-center"
        >
          <motion.svg
            viewBox="0 0 24 24"
            className="w-10 h-10"
            initial="hidden"
            animate="visible"
          >
            <motion.path
              d="M5 13l4 4L19 7"
              fill="none"
              stroke="#002FA7"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.6, delay: 0.5, ease: "easeOut" }}
            />
          </motion.svg>
        </motion.div>

        <motion.h2
          variants={fadeUpVariants}
          initial="hidden"
          animate="visible"
          custom={0}
          className="text-3xl md:text-4xl font-semibold text-[#F1FFFF] mb-3 text-center"
        >
          {firstName ? `Thanks, ${firstName}.` : "Your application is in."}
        </motion.h2>

        <motion.p
          variants={fadeUpVariants}
          initial="hidden"
          animate="visible"
          custom={1}
          className="text-[#9CA3AF] mb-10 text-center leading-relaxed"
        >
          Your application for{" "}
          <span className="text-[#F1FFFF] font-medium">{positionTitle}</span>{" "}
          is in. We sent a confirmation to your email.
        </motion.p>

        {/* Timeline */}
        <motion.div
          variants={fadeUpVariants}
          initial="hidden"
          animate="visible"
          custom={2}
          className="mb-10"
        >
          <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-[#6B7280] mb-5">
            What to expect
          </p>
          <div className="space-y-4">
            {timeline.map((item, i) => (
              <motion.div
                key={item.label}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.8 + i * STAGGER_NORMAL }}
                className="flex items-center gap-4"
              >
                <span
                  className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                    item.status === "current"
                      ? "bg-[#002FA7] text-[#F1FFFF]"
                      : "bg-white/5 text-[#6B7280] border border-white/10"
                  }`}
                >
                  {item.status === "current" ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <span className="font-mono text-[10px]">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                  )}
                </span>
                <div className="flex-1 flex items-baseline justify-between gap-3">
                  <span
                    className={`text-sm ${
                      item.status === "current"
                        ? "text-[#F1FFFF] font-medium"
                        : "text-[#9CA3AF]"
                    }`}
                  >
                    {item.label}
                  </span>
                  <span className="font-mono text-[10px] text-[#6B7280]">
                    {item.date}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Next steps — flat list, no card chrome */}
        <motion.div
          variants={fadeUpVariants}
          initial="hidden"
          animate="visible"
          custom={3}
          className="text-left mb-10"
        >
          <h3 className="font-mono text-[10px] tracking-[0.2em] uppercase text-[#6B7280] mb-4">
            While you wait
          </h3>
          <ul className="space-y-3">
            <li className="text-sm text-[#E5E7EB] flex items-start gap-3 leading-relaxed">
              <span className="mt-2 inline-block w-1 h-1 rounded-full bg-[#002FA7] flex-shrink-0" />
              <span>
                Follow{" "}
                <a
                  href="https://linkedin.com/company/tethos"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#F1FFFF] underline underline-offset-2 hover:text-[#002FA7] transition"
                >
                  @tethos on LinkedIn
                </a>{" "}
                for updates on the cohort.
              </span>
            </li>
            <li className="text-sm text-[#E5E7EB] flex items-start gap-3 leading-relaxed">
              <span className="mt-2 inline-block w-1 h-1 rounded-full bg-[#002FA7] flex-shrink-0" />
              <span>
                Check your dashboard anytime — we release status changes the
                moment they&apos;re final.
              </span>
            </li>
            <li className="text-sm text-[#E5E7EB] flex items-start gap-3 leading-relaxed">
              <span className="mt-2 inline-block w-1 h-1 rounded-full bg-[#002FA7] flex-shrink-0" />
              <span>Know someone who&apos;d be a fit? Share the role.</span>
            </li>
          </ul>
        </motion.div>

        <motion.div
          variants={fadeUpVariants}
          initial="hidden"
          animate="visible"
          custom={4}
          className="flex flex-col sm:flex-row justify-center gap-3"
        >
          <Button
            variant="primary"
            onClick={() => router.push("/student/apply/dashboard")}
          >
            Track application
          </Button>
          <Button
            variant="secondary"
            onClick={() => router.push("/student/apply")}
          >
            More roles
          </Button>
          {positionSlug && (
            <button
              onClick={handleShare}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full border border-white/10 text-sm text-[#9CA3AF] hover:text-[#F1FFFF] hover:border-white/20 transition-all"
            >
              {shared ? (
                <>
                  <Check className="w-4 h-4 text-[#1D9BF0]" />
                  Copied
                </>
              ) : (
                <>
                  <Share2 className="w-4 h-4" />
                  Share role
                </>
              )}
            </button>
          )}
        </motion.div>
      </div>
    </div>
  );
}
