"use client";

/**
 * Adapted from ReactBits ShinyText
 * Text with a sweeping shine/glint effect
 */

import { useRef } from "react";
import { motion, useMotionValue, useAnimationFrame, useTransform } from "framer-motion";

interface ShinyTextProps {
  text: string;
  className?: string;
  color?: string;
  shineColor?: string;
  speed?: number;
  spread?: number;
}

export default function ShinyText({
  text,
  className = "",
  color = "rgba(255,255,255,0.4)",
  shineColor = "rgba(255,255,255,0.8)",
  speed = 3,
  spread = 120,
}: ShinyTextProps) {
  const progress = useMotionValue(0);
  const elapsedRef = useRef(0);
  const lastTimeRef = useRef<number | null>(null);
  const duration = speed * 1000;

  useAnimationFrame((time) => {
    if (lastTimeRef.current === null) {
      lastTimeRef.current = time;
      return;
    }
    const dt = time - lastTimeRef.current;
    lastTimeRef.current = time;
    elapsedRef.current += dt;

    const fullCycle = duration * 2;
    const cycleTime = elapsedRef.current % fullCycle;
    if (cycleTime < duration) {
      progress.set((cycleTime / duration) * 100);
    } else {
      progress.set(100 - ((cycleTime - duration) / duration) * 100);
    }
  });

  const backgroundPosition = useTransform(progress, (p) => `${150 - p * 2}% center`);

  return (
    <motion.span
      className={`inline-block ${className}`}
      style={{
        backgroundImage: `linear-gradient(${spread}deg, ${color} 0%, ${color} 35%, ${shineColor} 50%, ${color} 65%, ${color} 100%)`,
        backgroundSize: "200% auto",
        WebkitBackgroundClip: "text",
        backgroundClip: "text",
        WebkitTextFillColor: "transparent",
        backgroundPosition,
      }}
    >
      {text}
    </motion.span>
  );
}
