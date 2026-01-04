"use client";

import { useRef, useState } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";

interface Interactive3DCardProps {
  title: string;
  description: string;
  tags?: string[];
  width?: number;
  height?: number;
  className?: string;
  onClick?: () => void;
  children?: React.ReactNode;
}

export default function Interactive3DCard({
  title,
  description,
  tags,
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

  // Calculate responsive image height based on card height
  const imageHeight = height <= 400 ? '40%' : '45%';

  return (
    <motion.div
      ref={cardRef}
      className={`pathway-card ${className}`}
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
        className="glass-card w-full h-full p-6 rounded-2xl flex flex-col relative"
        style={{
          rotateX: isHovered ? rotateX : 0,
          rotateY: isHovered ? rotateY : 0,
        }}
      >
        {/* Mouse tracking overlay */}
        <div
          className="absolute inset-0 cursor-pointer"
          style={{ borderRadius: 22 }}
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
          <div className="relative z-10 pointer-events-none flex flex-col h-full">
            {/* Image block */}
            <div 
              className="w-full rounded-lg mb-4 bg-zinc-800 overflow-hidden flex-shrink-0"
              style={{ height: imageHeight }}
            >
              <div className="w-full h-full bg-gradient-to-br from-blue-500/25 to-purple-500/25" />
            </div>

            {/* Text content */}
            <div className="flex-1 flex flex-col min-h-0">
              <h3 className="text-lg font-semibold text-white mb-2">
                {title}
              </h3>

              <p className="text-zinc-400 text-sm leading-relaxed mb-3 line-clamp-3 flex-shrink-0">
                {description}
              </p>

              {/* Tags */}
              {tags && tags.length > 0 && (
                <div className="mt-auto flex flex-wrap gap-1.5">
                  {tags.slice(0, 3).map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-1 text-xs rounded-full
                                 bg-white/10 text-zinc-200
                                 border border-white/10"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
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