"use client";

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import confetti from "canvas-confetti";
import { fadeUpVariants, STAGGER_NORMAL } from "@/lib/motion";
import Button from "@/components/ui/Button";
import { useRouter } from "next/navigation";

interface SuccessScreenProps {
  positionTitle: string;
}

export default function SuccessScreen({ positionTitle }: SuccessScreenProps) {
  const router = useRouter();
  const confettiFired = useRef(false);

  useEffect(() => {
    if (confettiFired.current) return;
    confettiFired.current = true;

    // Confetti burst
    const end = Date.now() + 1500;
    const colors = ["#002FA7", "#22D3EE", "#FFD166", "#F1FFFF"];

    (function frame() {
      confetti({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.7 },
        colors,
      });
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.7 },
        colors,
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    })();
  }, []);

  const nextSteps = [
    "Our team will review your application.",
    "Shortlisted candidates will receive an interview invite.",
    "Track your status on your dashboard anytime.",
  ];

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-6">
      <div className="max-w-md w-full text-center">
        {/* Animated checkmark */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.2 }}
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
          className="text-3xl font-semibold text-[#F1FFFF] mb-3"
        >
          Application Submitted
        </motion.h2>

        <motion.p
          variants={fadeUpVariants}
          initial="hidden"
          animate="visible"
          custom={1}
          className="text-[#9CA3AF] mb-8"
        >
          Your application for <span className="text-[#F1FFFF] font-medium">{positionTitle}</span> has
          been received. Check your email for a confirmation.
        </motion.p>

        {/* Next steps */}
        <motion.div
          variants={fadeUpVariants}
          initial="hidden"
          animate="visible"
          custom={2}
          className="glass-card p-6 text-left mb-8"
        >
          <h3 className="font-mono text-xs tracking-wider uppercase text-[#002FA7] mb-4">
            What happens next
          </h3>
          <ol className="space-y-3">
            {nextSteps.map((step, i) => (
              <motion.li
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.8 + i * STAGGER_NORMAL }}
                className="flex items-start gap-3"
              >
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#002FA7]/20 text-[#002FA7] text-[10px] font-mono flex items-center justify-center mt-0.5">
                  {i + 1}
                </span>
                <span className="text-sm text-[#E5E7EB]">{step}</span>
              </motion.li>
            ))}
          </ol>
        </motion.div>

        <motion.div
          variants={fadeUpVariants}
          initial="hidden"
          animate="visible"
          custom={3}
          className="flex justify-center gap-4"
        >
          <Button
            variant="primary"
            onClick={() => router.push("/student/apply/dashboard")}
          >
            Track Application
          </Button>
          <Button
            variant="secondary"
            onClick={() => router.push("/student/apply")}
          >
            View More Roles
          </Button>
        </motion.div>
      </div>
    </div>
  );
}
