"use client";

import { motion } from "framer-motion";

interface FormProgressProps {
  currentStep: number;
  totalSteps: number;
  labels: string[];
}

export default function FormProgress({
  currentStep,
  totalSteps,
  labels,
}: FormProgressProps) {
  const progress = ((currentStep + 1) / totalSteps) * 100;

  // Grid keeps each label vertically aligned with its dot regardless of
  // label length. flex justify-between would space by container edges,
  // not centers, and break alignment when labels differ in width.
  const gridCols = `grid grid-cols-${labels.length}`;
  // Tailwind needs literal class names — explicit lookup keeps JIT happy.
  const colsByCount: Record<number, string> = {
    3: "grid-cols-3",
    4: "grid-cols-4",
    5: "grid-cols-5",
  };
  const colsClass = colsByCount[labels.length] ?? gridCols;

  return (
    <div className="mb-8">
      {/* Step labels */}
      <div className={`grid ${colsClass} mb-3`}>
        {labels.map((label, i) => (
          <span
            key={i}
            className={`
              font-mono text-[10px] tracking-wider uppercase text-center transition-colors duration-300
              ${i === currentStep
                ? "text-[#F1FFFF]"
                : i < currentStep
                  ? "text-[#002FA7]"
                  : "text-[#6B7280]"
              }
            `}
          >
            {label}
          </span>
        ))}
      </div>

      {/* Progress bar */}
      <div className="relative h-1 rounded-full bg-white/5 overflow-hidden">
        <motion.div
          className="absolute inset-y-0 left-0 rounded-full"
          animate={{ width: `${progress}%` }}
          transition={{ type: "spring", stiffness: 200, damping: 25 }}
          style={{
            background:
              "linear-gradient(90deg, #002FA7 0%, #22D3EE 100%)",
          }}
        />
        {/* Glow on active position */}
        <motion.div
          className="absolute inset-y-0 left-0 rounded-full blur-sm"
          animate={{ width: `${progress}%` }}
          transition={{ type: "spring", stiffness: 200, damping: 25 }}
          style={{
            background:
              "linear-gradient(90deg, rgba(0,47,167,0.5) 0%, rgba(34,211,238,0.5) 100%)",
          }}
        />
      </div>

      {/* Step dots — same grid so each dot lines up with its label */}
      <div className={`grid ${colsClass} mt-2`}>
        {labels.map((_, i) => (
          <div key={i} className="flex justify-center">
            <motion.div
              className="w-2 h-2 rounded-full"
              animate={{
                backgroundColor:
                  i <= currentStep
                    ? "#002FA7"
                    : "rgba(255,255,255,0.1)",
                scale: i === currentStep ? 1.3 : 1,
              }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
