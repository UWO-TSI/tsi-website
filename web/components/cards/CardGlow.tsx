"use client";

import { motion } from "framer-motion";

interface CardGlowProps {
  active: boolean;
  color?: string;
  intensity?: number;
}

export default function CardGlow({
  active,
  color = "0,47,167",
  intensity = 0.4,
}: CardGlowProps) {
  return (
    <motion.div
      className="absolute -inset-2 rounded-[24px] blur-xl pointer-events-none -z-10"
      style={{
        background: `radial-gradient(circle, rgba(${color},${intensity}) 0%, transparent 70%)`,
      }}
      animate={{
        opacity: active ? 1 : 0,
      }}
      transition={{ duration: 0.3 }}
    />
  );
}