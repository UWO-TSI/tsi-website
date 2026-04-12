"use client";

import { motion } from "framer-motion";
import {
  APPLICATION_STATUSES,
  STATUS_LABELS,
  STATUS_COLORS,
  type ApplicationStatus,
  isTerminalStatus,
  getStatusIndex,
} from "@/lib/recruitment";

interface StatusPipelineProps {
  currentStatus: ApplicationStatus;
}

// The pipeline shows the linear stages, terminal states shown as badges
const PIPELINE_STAGES: ApplicationStatus[] = [
  "submitted",
  "screening",
  "interview_invite",
  "interview",
  "final_review",
];

export default function StatusPipeline({ currentStatus }: StatusPipelineProps) {
  const isTerminal = isTerminalStatus(currentStatus);
  const currentIndex = isTerminal
    ? PIPELINE_STAGES.length // past all stages
    : getStatusIndex(currentStatus);

  return (
    <div>
      {/* Pipeline dots */}
      <div className="flex items-center gap-0">
        {PIPELINE_STAGES.map((stage, i) => {
          const isPast = i < currentIndex;
          const isCurrent = i === currentIndex && !isTerminal;
          const color = isCurrent
            ? STATUS_COLORS[stage]
            : isPast
              ? "#002FA7"
              : "rgba(255,255,255,0.1)";

          return (
            <div key={stage} className="flex items-center flex-1">
              {/* Dot */}
              <div className="relative flex flex-col items-center">
                <motion.div
                  className="w-3 h-3 rounded-full relative z-10"
                  animate={{
                    backgroundColor: color,
                    scale: isCurrent ? 1.4 : 1,
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
                  className={`
                    absolute top-5 whitespace-nowrap font-mono text-[9px] tracking-wider
                    ${isCurrent ? "text-[#F1FFFF]" : isPast ? "text-[#6B7280]" : "text-[#3f3f46]"}
                  `}
                >
                  {STATUS_LABELS[stage]}
                </span>
              </div>

              {/* Connector line */}
              {i < PIPELINE_STAGES.length - 1 && (
                <div className="flex-1 h-px mx-1">
                  <motion.div
                    className="h-full"
                    animate={{
                      backgroundColor: isPast
                        ? "#002FA7"
                        : "rgba(255,255,255,0.08)",
                    }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Terminal status */}
      {isTerminal && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-10 text-center"
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
