"use client";

import { useRef, useState } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { useRouter } from "next/navigation";
import { ArrowRight, Lock, Clock } from "lucide-react";
import type { Position } from "@/lib/recruitment";
import { isPositionOpen, getPositionStatus, formatOpensAt } from "@/lib/recruitment";

interface PositionCardProps {
  position: Position;
  index: number;
}

export default function PositionCard({ position, index }: PositionCardProps) {
  const router = useRouter();
  const cardRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);

  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const rotateX = useSpring(useTransform(mouseY, [-0.5, 0.5], [12, -12]), {
    stiffness: 150,
    damping: 20,
  });
  const rotateY = useSpring(useTransform(mouseX, [-0.5, 0.5], [-12, 12]), {
    stiffness: 150,
    damping: 20,
  });

  const shineX = useTransform(mouseX, [-0.5, 0.5], [0, 100]);
  const shineY = useTransform(mouseY, [-0.5, 0.5], [0, 100]);

  const open = isPositionOpen(position);
  const status = getPositionStatus(position);
  const isInternal = position.visibility === "internal";

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    mouseX.set((e.clientX - rect.left - rect.width / 2) / rect.width);
    mouseY.set((e.clientY - rect.top - rect.height / 2) / rect.height);
  };

  const handleClick = () => {
    if (!open) return;
    router.push(`/student/apply/${position.slug}`);
  };

  // Deadline formatting
  const deadline = position.closes_at
    ? new Date(position.closes_at).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-30px" }}
      transition={{
        delay: index * 0.1,
        duration: 0.9,
        ease: [0.16, 1, 0.3, 1],
      }}
    >
      <motion.div
        ref={cardRef}
        className={`relative ${open ? "cursor-pointer" : "cursor-default"}`}
        animate={{
          scale: isHovered && open ? 1.03 : 1,
          y: isHovered && open ? -8 : 0,
        }}
        transition={{
          scale: { type: "spring", stiffness: 300, damping: 25 },
        }}
        style={{
          transformStyle: "preserve-3d",
          perspective: 1000,
        }}
      >
        <motion.div
          className="glass-card p-6 md:p-8 h-full flex flex-col relative overflow-hidden"
          style={{
            rotateX: isHovered && open ? rotateX : 0,
            rotateY: isHovered && open ? rotateY : 0,
          }}
        >
          {/* Mouse tracking overlay */}
          <div
            className="absolute inset-0 z-20"
            style={{ borderRadius: 22, pointerEvents: "auto" }}
            onMouseMove={handleMouseMove}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onClick={handleClick}
          />

          {/* Shine effect */}
          <motion.div
            className="absolute inset-0 rounded-[22px] pointer-events-none z-10"
            style={{
              background: `radial-gradient(circle at ${shineX}% ${shineY}%, rgba(255,255,255,0.15) 0%, transparent 60%)`,
            }}
            animate={{ opacity: isHovered && open ? 0.6 : 0 }}
            transition={{ duration: 0.3 }}
          />

          {/* Content */}
          <div className="relative z-10 pointer-events-none flex flex-col flex-1">
            {/* Tags row */}
            <div className="flex items-center gap-2 mb-4">
              <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-[#002FA7]">
                Phase {String(position.phase).padStart(2, "0")}
              </span>
              {isInternal && (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#FFD166]/10 border border-[#FFD166]/30 text-[#FFD166] text-[10px] font-mono uppercase">
                  <Lock className="w-3 h-3" />
                  Internal
                </span>
              )}
              {status === "open" ? (
                <span className="px-2 py-0.5 rounded-full bg-[#22C55E]/10 border border-[#22C55E]/30 text-[#22C55E] text-[10px] font-mono uppercase">
                  Open
                </span>
              ) : status === "upcoming" ? (
                <span className="px-2 py-0.5 rounded-full bg-[#FFD166]/10 border border-[#FFD166]/30 text-[#FFD166] text-[10px] font-mono uppercase">
                  {position.opens_at ? formatOpensAt(position.opens_at) : "Coming Soon"}
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full bg-[#6B7280]/10 border border-[#6B7280]/30 text-[#6B7280] text-[10px] font-mono uppercase">
                  Closed
                </span>
              )}
            </div>

            {/* Title */}
            <h3 className="text-xl md:text-2xl font-semibold text-[#F1FFFF] mb-3">
              {position.title}
            </h3>

            {/* Description */}
            <p className="text-[#9CA3AF] text-sm leading-relaxed mb-6 flex-1">
              {position.description}
            </p>

            {/* Footer */}
            <div className="flex items-center justify-between">
              {deadline && (
                <span className="flex items-center gap-1.5 font-mono text-xs text-[#6B7280]">
                  <Clock className="w-3.5 h-3.5" />
                  Due {deadline}
                </span>
              )}
              {open && (
                <motion.span
                  className="flex items-center gap-1 text-[#002FA7] text-sm font-medium"
                  animate={{ x: isHovered ? 4 : 0 }}
                  transition={{ type: "spring", stiffness: 300, damping: 25 }}
                >
                  Apply Now
                  <ArrowRight className="w-4 h-4" />
                </motion.span>
              )}
            </div>
          </div>

          {/* Active blue glow */}
          <motion.div
            className="absolute -inset-2 rounded-[24px] blur-xl pointer-events-none -z-10"
            style={{
              background:
                "radial-gradient(circle, rgba(0,47,167,0.35) 0%, transparent 70%)",
            }}
            animate={{ opacity: isHovered && open ? 1 : 0 }}
            transition={{ duration: 0.3 }}
          />

          {/* Closed overlay */}
          {!open && (
            <div className="absolute inset-0 rounded-[22px] bg-[#0F0F10]/50 pointer-events-none z-10" />
          )}
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
