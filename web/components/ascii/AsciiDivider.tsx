"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { EASE_CINEMATIC, DURATION_SECTION } from "@/lib/motion";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

interface AsciiDividerProps {
  /** Characters used for the pattern */
  charset?: string;
  /** Number of rows */
  rows?: number;
  /** Number of columns */
  cols?: number;
  /** Accent color */
  color?: string;
  /** Additional className */
  className?: string;
}

/**
 * CSS-based ASCII text divider.
 * Briefly appears when scrolled into view, then fades —
 * a "signature fingerprint", not wallpaper.
 */
export default function AsciiDivider({
  charset = "░▒▓█▓▒░·:;+=#-",
  rows = 3,
  cols = 80,
  color = "var(--color-text-muted)",
  className = "",
}: AsciiDividerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Generate a deterministic pseudo-random ASCII pattern
  const generateRow = (rowIdx: number) => {
    let line = "";
    for (let c = 0; c < cols; c++) {
      const seed = (rowIdx * 127 + c * 31) % charset.length;
      line += charset[seed];
    }
    return line;
  };

  const lines = Array.from({ length: rows }, (_, i) => generateRow(i));

  useEffect(() => {
    if (!containerRef.current) return;

    const rows = containerRef.current.querySelectorAll(".ascii-row");

    const ctx = gsap.context(() => {
      // Start invisible
      gsap.set(rows, { opacity: 0 });

      ScrollTrigger.create({
        trigger: containerRef.current,
        start: "top 85%",
        end: "bottom 15%",
        onEnter: () => {
          // Stagger reveal
          gsap.to(rows, {
            opacity: 0.4,
            duration: DURATION_SECTION * 0.5,
            stagger: 0.08,
            ease: EASE_CINEMATIC,
            onComplete: () => {
              // Then fade away
              gsap.to(rows, {
                opacity: 0,
                duration: DURATION_SECTION,
                stagger: 0.05,
                delay: 0.6,
                ease: EASE_CINEMATIC,
              });
            },
          });
        },
        once: true,
      });
    }, containerRef);

    return () => ctx.revert();
  }, []);

  return (
    <div
      ref={containerRef}
      className={`overflow-hidden select-none pointer-events-none py-4 ${className}`}
      aria-hidden="true"
    >
      {lines.map((line, i) => (
        <div
          key={i}
          className="ascii-row whitespace-nowrap text-center font-mono leading-tight"
          style={{
            fontSize: "10px",
            letterSpacing: "1px",
            color,
            opacity: 0,
          }}
        >
          {line}
        </div>
      ))}
    </div>
  );
}
