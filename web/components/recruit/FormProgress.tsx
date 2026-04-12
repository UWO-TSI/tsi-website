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

  return (
    <div className="mb-8">
      {/* Step labels */}
      <div className="flex justify-between mb-3">
        {labels.map((label, i) => (
          <button
            key={i}
            className={`
              font-mono text-[10px] tracking-wider uppercase transition-colors duration-300
              ${i === currentStep
                ? "text-[#F1FFFF]"
                : i < currentStep
                  ? "text-[#002FA7]"
                  : "text-[#6B7280]"
              }
            `}
            disabled
          >
            {label}
          </button>
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

      {/* Step dots */}
      <div className="flex justify-between mt-2">
        {labels.map((_, i) => (
          <motion.div
            key={i}
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
        ))}
      </div>
    </div>
  );
}
