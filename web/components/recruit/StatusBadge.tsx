"use client";

import { motion } from "framer-motion";
import { STATUS_LABELS, STATUS_COLORS, type ApplicationStatus } from "@/lib/recruitment";

interface StatusBadgeProps {
  status: ApplicationStatus;
  isDraft?: boolean;
}

export default function StatusBadge({ status, isDraft = false }: StatusBadgeProps) {
  const color = STATUS_COLORS[status];
  const label = STATUS_LABELS[status];

  return (
    <motion.span
      layout
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono uppercase tracking-wider"
      style={{
        backgroundColor: `${color}15`,
        border: `1px solid ${color}40`,
        color,
      }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{ backgroundColor: color }}
      />
      {label}
      {isDraft && (
        <span className="text-[9px] text-[#FFD166] ml-1">(draft)</span>
      )}
    </motion.span>
  );
}
