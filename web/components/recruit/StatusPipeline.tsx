"use client";

import { motion } from "framer-motion";
import {
  STATUS_LABELS,
  STATUS_COLORS,
  PIPELINE_ORDER,
  type ApplicationStatus,
  isTerminalStatus,
  getStatusIndex,
} from "@/lib/recruitment";

interface StatusPipelineProps {
  currentStatus: ApplicationStatus;
}

// Linear stages — terminal states (accepted/waitlist/rejected) render as a
// badge below instead of an extra pipeline dot.
const PIPELINE_STAGES: ApplicationStatus[] = PIPELINE_ORDER;

const PAST_COLOR = "#1D9BF0";
const TRACK_COLOR = "rgba(255,255,255,0.08)";
// First dot center sits at 1/(2N) of width; last dot at 1 − 1/(2N).
// For N=5 → 10% and 90%. We use these so the connector line endpoints
// land exactly on the outer dot centers.
const N = PIPELINE_STAGES.length;
const FIRST_PCT = 100 / (2 * N);
const LAST_PCT = 100 - FIRST_PCT;
const TRAVEL_PCT = LAST_PCT - FIRST_PCT;

export default function StatusPipeline({ currentStatus }: StatusPipelineProps) {
  const isTerminal = isTerminalStatus(currentStatus);
  const currentIndex = isTerminal
    ? PIPELINE_STAGES.length
    : getStatusIndex(currentStatus);

  // Progress fill goes from the first dot to the current dot center.
  const segments = PIPELINE_STAGES.length - 1;
  const completedSegments = Math.min(currentIndex, segments);
  const progressWidthPct = (completedSegments / segments) * TRAVEL_PCT;

  return (
    <div>
      {/* Pipeline — grid keeps each dot+label centered in equal columns,
          so the row fills the card edge to edge instead of left-clumping. */}
      <div
        className="relative grid"
        style={{ gridTemplateColumns: `repeat(${N}, minmax(0, 1fr))` }}
      >
        {/* Track (background line) */}
        <div
          className="absolute h-px"
          style={{
            top: "5px",
            left: `${FIRST_PCT}%`,
            right: `${FIRST_PCT}%`,
            background: TRACK_COLOR,
          }}
        />
        {/* Active fill */}
        <motion.div
          className="absolute h-px"
          style={{
            top: "5px",
            left: `${FIRST_PCT}%`,
            background: PAST_COLOR,
          }}
          animate={{ width: `${progressWidthPct}%` }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        />

        {PIPELINE_STAGES.map((stage, i) => {
          const isPast = i < currentIndex;
          const isCurrent = i === currentIndex && !isTerminal;
          const color = isCurrent
            ? STATUS_COLORS[stage]
            : isPast
              ? PAST_COLOR
              : "rgba(255,255,255,0.18)";

          return (
            <div
              key={stage}
              className="relative flex flex-col items-center"
            >
              <motion.div
                className="w-3 h-3 rounded-full relative z-10"
                animate={{
                  backgroundColor: color,
                  scale: isCurrent ? 1.35 : 1,
                }}
                transition={{ type: "spring", stiffness: 300, damping: 25 }}
              >
                {isCurrent && (
                  <div
                    className="absolute inset-0 rounded-full animate-ping opacity-30"
                    style={{ backgroundColor: color }}
                  />
                )}
              </motion.div>
              <span
                className={`mt-3 whitespace-nowrap font-mono text-[9px] tracking-wider text-center ${
                  isCurrent
                    ? "text-[#F1FFFF]"
                    : isPast
                      ? "text-[#6B7280]"
                      : "text-[#3f3f46]"
                }`}
              >
                {STATUS_LABELS[stage]}
              </span>
            </div>
          );
        })}
      </div>

      {isTerminal && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-8 text-center"
        >
          <span
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium"
            style={{
              backgroundColor: `${STATUS_COLORS[currentStatus]}15`,
              border: `1px solid ${STATUS_COLORS[currentStatus]}40`,
              color: STATUS_COLORS[currentStatus],
            }}
          >
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: STATUS_COLORS[currentStatus] }}
            />
            {STATUS_LABELS[currentStatus]}
          </span>
        </motion.div>
      )}
    </div>
  );
}
