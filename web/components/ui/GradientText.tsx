"use client";

/**
 * GradientText - Animated gradient text with glow.
 * Pure CSS animation - no JS animation loops.
 */

interface GradientTextProps {
  children: React.ReactNode;
  className?: string;
  colors?: string[];
  animationSpeed?: number;
}

export default function GradientText({
  children,
  className = "",
  colors = ["#1d9bf0", "#60c5ff", "#1d9bf0"],
  animationSpeed = 6,
}: GradientTextProps) {
  const gradientColors = [...colors, colors[0]].join(", ");

  return (
    <>
      <style jsx>{`
        @keyframes gradientShift {
          0% { background-position: 0% 50%; }
          100% { background-position: 100% 50%; }
        }
      `}</style>
      <span
        className={`inline-block text-transparent bg-clip-text ${className}`}
        style={{
          backgroundImage: `linear-gradient(to right, ${gradientColors})`,
          backgroundSize: "300% 100%",
          WebkitBackgroundClip: "text",
          animation: `gradientShift ${animationSpeed}s ease-in-out infinite alternate`,
          filter: "drop-shadow(0 0 12px rgba(29,155,240,0.3))",
        }}
      >
        {children}
      </span>
    </>
  );
}
