"use client";

import { useRef, useState } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { useRouter } from "next/navigation";
import { ArrowRight, Lock, Clock } from "lucide-react";
import type { Position } from "@/lib/recruitment";
import {
  isPositionOpen,
  getPositionStatus,
  formatOpensAt,
} from "@/lib/recruitment";

const EASE_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1];

interface PositionCardProps {
  position: Position;
  index: number;
}

export default function PositionCard({ position, index }: PositionCardProps) {
  const router = useRouter();
  const cardRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);

  // Subtle mouse-follow glow
  const mouseX = useMotionValue(0.5);
  const mouseY = useMotionValue(0.5);
  const glowX = useSpring(useTransform(mouseX, [0, 1], [0, 100]), { stiffness: 200, damping: 30 });
  const glowY = useSpring(useTransform(mouseY, [0, 1], [0, 100]), { stiffness: 200, damping: 30 });

  const open = isPositionOpen(position);
  const status = getPositionStatus(position);
  const isInternal = position.visibility === "internal";

  const deadline = position.closes_at
    ? new Date(position.closes_at).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })
    : null;

  const handleClick = () => {
    if (!open) return;
    router.push(`/student/apply/${position.slug}`);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current || !open) return;
    const rect = cardRef.current.getBoundingClientRect();
    mouseX.set((e.clientX - rect.left) / rect.width);
    mouseY.set((e.clientY - rect.top) / rect.height);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        delay: 0.1 + index * 0.1,
        duration: 0.7,
        ease: EASE_OUT,
      }}
    >
      <motion.div
        ref={cardRef}
        onClick={handleClick}
        onMouseMove={handleMouseMove}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={`
          group relative rounded-2xl overflow-hidden h-full flex flex-col
          ${open ? "cursor-pointer" : "cursor-default"}
        `}
        style={{
          background: open
            ? "linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%)"
            : "rgba(255,255,255,0.015)",
          border: `1px solid rgba(255,255,255,${open ? 0.1 : 0.06})`,
        }}
        animate={{
          borderColor: isHovered && open
            ? "rgba(29,155,240,0.5)"
            : `rgba(255,255,255,${open ? 0.1 : 0.06})`,
          y: isHovered && open ? -4 : 0,
          boxShadow: isHovered && open
            ? "0 0 40px rgba(29,155,240,0.08), 0 12px 40px rgba(0,0,0,0.3)"
            : "0 0 0px rgba(29,155,240,0), 0 0px 0px rgba(0,0,0,0)",
        }}
        transition={{
          borderColor: { duration: 0.25 },
          y: { type: "spring", stiffness: 300, damping: 25 },
          boxShadow: { duration: 0.35 },
        }}
      >
        {/* Top accent line */}
        {open && (
          <motion.div
            className="h-[2px] w-full"
            style={{
              background:
                "linear-gradient(90deg, transparent 10%, rgba(29,155,240,0.8) 50%, transparent 90%)",
            }}
            animate={{ opacity: isHovered ? 1 : 0.4 }}
            transition={{ duration: 0.25 }}
          />
        )}

        {/* Mouse-tracking glow overlay */}
        {open && (
          <motion.div
            className="absolute inset-0 pointer-events-none rounded-2xl"
            style={{
              background: `radial-gradient(400px circle at ${glowX}% ${glowY}%, rgba(29,155,240,0.10) 0%, transparent 50%)`,
            }}
            animate={{ opacity: isHovered ? 1 : 0 }}
            transition={{ duration: 0.3 }}
          />
        )}

        <div className="p-6 md:p-7 flex flex-col flex-1 relative z-10">
          {/* Status + phase row */}
          <div className="flex items-center justify-between mb-5">
            <span className="font-mono text-[10px] tracking-[0.15em] uppercase text-[#6B7280]">
              Phase {String(position.phase).padStart(2, "0")}
            </span>

            <div className="flex items-center gap-2">
              {isInternal && (
                <span className="flex items-center gap-1 text-[#FFD166] text-[10px] font-mono uppercase">
                  <Lock className="w-3 h-3" />
                  Internal
                </span>
              )}
              {status === "open" ? (
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#1D9BF0]/10 text-[#1D9BF0] text-[10px] font-mono uppercase tracking-wide">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#1D9BF0] opacity-75" />
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#1D9BF0]" />
                  </span>
                  Open
                </span>
              ) : status === "upcoming" ? (
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#FFD166]/10 text-[#FFD166] text-[10px] font-mono uppercase tracking-wide">
                  <Clock className="w-3 h-3" />
                  {position.opens_at
                    ? formatOpensAt(position.opens_at)
                    : "Soon"}
                </span>
              ) : (
                <span className="px-2.5 py-1 rounded-full bg-white/5 text-[#6B7280] text-[10px] font-mono uppercase tracking-wide">
                  Closed
                </span>
              )}
            </div>
          </div>

          {/* Title */}
          <motion.h3
            className={`text-lg md:text-xl font-semibold mb-3 ${
              open ? "text-[#F1FFFF]" : "text-[#6B7280]"
            }`}
            animate={{
              color: isHovered && open ? "#FFFFFF" : open ? "#F1FFFF" : "#6B7280",
            }}
            transition={{ duration: 0.2 }}
          >
            {position.title}
          </motion.h3>

          {/* Description */}
          <p
            className={`text-[13px] leading-relaxed mb-6 flex-1 ${
              open ? "text-[#9CA3AF]" : "text-[#4B5563]"
            }`}
          >
            {position.description}
          </p>

          {/* Footer */}
          <div className="flex items-center justify-between pt-4 border-t border-white/[0.06]">
            {deadline && open ? (
              <span className="flex items-center gap-1.5 font-mono text-[11px] text-[#6B7280]">
                <Clock className="w-3 h-3" />
                Due {deadline}
              </span>
            ) : (
              <span />
            )}

            {open && (
              <motion.span
                className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#1D9BF0]/10 text-[#1D9BF0] text-sm font-medium"
                animate={{
                  backgroundColor: isHovered
                    ? "rgba(29,155,240,0.2)"
                    : "rgba(29,155,240,0.1)",
                  gap: isHovered ? "10px" : "8px",
                }}
                transition={{ duration: 0.2 }}
              >
                Apply
                <motion.span
                  animate={{ x: isHovered ? 2 : 0 }}
                  transition={{ type: "spring", stiffness: 400, damping: 20 }}
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                </motion.span>
              </motion.span>
            )}
          </div>
        </div>

        {/* Closed overlay */}
        {!open && (
          <div className="absolute inset-0 bg-[#0F0F10]/40 pointer-events-none" />
        )}
      </motion.div>
    </motion.div>
  );
}
