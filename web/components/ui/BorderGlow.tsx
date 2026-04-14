"use client";

/**
 * Adapted from ReactBits BorderGlow
 * Simplified: glowing animated border on hover using CSS gradients.
 */

import { useRef, useState, type ReactNode } from "react";

interface BorderGlowProps {
  children?: ReactNode;
  className?: string;
  glowColor?: string;
  borderRadius?: number;
}

export default function BorderGlow({
  children,
  className = "",
  glowColor = "rgba(29,155,240,0.6)",
  borderRadius = 12,
}: BorderGlowProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [hovered, setHovered] = useState(false);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    setPosition({
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    });
  };

  return (
    <div
      ref={ref}
      className={`relative ${className}`}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ borderRadius }}
    >
      {/* Glow border layer */}
      <div
        className="absolute -inset-px rounded-[inherit] transition-opacity duration-500 pointer-events-none"
        style={{
          opacity: hovered ? 1 : 0,
          background: `radial-gradient(300px circle at ${position.x}% ${position.y}%, ${glowColor}, transparent 70%)`,
        }}
      />

      {/* Inner background (covers the glow except at edges = border effect) */}
      <div
        className="absolute inset-[1px] rounded-[inherit] pointer-events-none"
        style={{ background: "inherit" }}
      />

      {/* Content */}
      <div className="relative">{children}</div>
    </div>
  );
}
