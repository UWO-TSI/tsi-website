"use client";

import { useRef, useState } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";

interface Interactive3DCardProps {
  title: string;
  description: string;
  width?: number;
  height?: number;
  className?: string;
  onClick?: () => void;
  children?: React.ReactNode;
}

export default function Interactive3DCard({
  title,
  description,
  width = 330,
  height = 570,
  className = "",
  onClick,
  children,
}: Interactive3DCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);

  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const rotateX = useSpring(useTransform(mouseY, [-0.5, 0.5], [15, -15]), {
    stiffness: 150,
    damping: 20,
  });
  const rotateY = useSpring(useTransform(mouseX, [-0.5, 0.5], [-15, 15]), {
    stiffness: 150,
    damping: 20,
  });

  const shineX = useTransform(mouseX, [-0.5, 0.5], [0, 100]);
  const shineY = useTransform(mouseY, [-0.5, 0.5], [0, 100]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;

    const rect = cardRef.current.getBoundingClientRect();
    mouseX.set((e.clientX - rect.left - rect.width / 2) / rect.width);
    mouseY.set((e.clientY - rect.top - rect.height / 2) / rect.height);
  };

  return (
    <motion.div
      ref={cardRef}
      className={className}
      animate={{
        scale: isHovered ? 1.15 : 1,
        y: isHovered ? -50 : 0,

      }}
      transition={{
        scale: { type: "spring", stiffness: 300, damping: 25 },
      }}
      style={{
        width,
        height,
        transformStyle: "preserve-3d",
        perspective: 1000,
      }}
    >
      <motion.div
        className="glass-card w-full h-full p-8 rounded-2xl flex flex-col justify-center relative"
        style={{
          rotateX: isHovered ? rotateX : 0,
          rotateY: isHovered ? rotateY : 0,
        }}
      >
        {/* Interactive overlay for mouse tracking */}
        <div
          className="absolute inset-0 cursor-pointer"
          style={{ borderRadius: 22, pointerEvents: "auto" }}
          onMouseMove={handleMouseMove}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          onClick={onClick}
        />

        {/* Shine effect */}
        <motion.div
          className="absolute inset-0 rounded-[22px] pointer-events-none"
          style={{
            background: `radial-gradient(circle at ${shineX}% ${shineY}%, rgba(255,255,255,0.2) 0%, transparent 60%)`,
          }}
          animate={{ opacity: isHovered ? 0.6 : 0 }}
          transition={{ duration: 0.3 }}
        />

        {/* Card content */}
        {children || (
          <div className="relative z-10 pointer-events-none">
            <h3 className="text-2xl font-semibold mb-3">{title}</h3>
            <p className="text-zinc-400 text-sm">{description}</p>
          </div>
        )}

        {/* Blue glow */}
        <motion.div
          className="absolute -inset-2 rounded-[24px] blur-xl pointer-events-none -z-10"
          style={{
            background:
              "radial-gradient(circle, rgba(0,47,167,0.45) 0%, transparent 70%)",
          }}
          animate={{ opacity: isHovered ? 1 : 0 }}
          transition={{ duration: 0.3 }}
        />
      </motion.div>
    </motion.div>
  );
}