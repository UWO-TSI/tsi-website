"use client";

/**
 * LogoLoop - Infinite scrolling logo carousel.
 * Uses pure CSS animation instead of requestAnimationFrame for performance.
 */

import React, { useRef, useEffect, useState } from "react";

export interface LogoItem {
  node: React.ReactNode;
  href?: string;
  title?: string;
}

export interface LogoLoopProps {
  logos: LogoItem[];
  speed?: number;
  direction?: "left" | "right";
  logoHeight?: number;
  gap?: number;
  pauseOnHover?: boolean;
  fadeOut?: boolean;
  fadeOutColor?: string;
  className?: string;
}

export default function LogoLoop({
  logos,
  speed = 80,
  direction = "left",
  logoHeight = 28,
  gap = 48,
  pauseOnHover = true,
  fadeOut = true,
  fadeOutColor = "#0F0F10",
  className = "",
}: LogoLoopProps) {
  const seqRef = useRef<HTMLUListElement>(null);
  const [seqWidth, setSeqWidth] = useState(0);

  useEffect(() => {
    if (!seqRef.current) return;
    const measure = () => setSeqWidth(seqRef.current?.scrollWidth ?? 0);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(seqRef.current);
    return () => observer.disconnect();
  }, [logos]);

  // Duration = distance / speed
  const duration = seqWidth > 0 ? seqWidth / speed : 20;
  const directionValue = direction === "left" ? "normal" : "reverse";

  return (
    <div
      className={`relative overflow-hidden group ${className}`}
      style={{ ["--pause" as string]: pauseOnHover ? "paused" : "running" }}
    >
      {fadeOut && (
        <>
          <div
            className="pointer-events-none absolute inset-y-0 left-0 z-10"
            style={{ width: "clamp(24px, 8%, 100px)", background: `linear-gradient(to right, ${fadeOutColor}, transparent)` }}
          />
          <div
            className="pointer-events-none absolute inset-y-0 right-0 z-10"
            style={{ width: "clamp(24px, 8%, 100px)", background: `linear-gradient(to left, ${fadeOutColor}, transparent)` }}
          />
        </>
      )}

      <style jsx>{`
        @keyframes logoScroll {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        .logo-track {
          animation: logoScroll ${duration}s linear infinite;
          animation-direction: ${directionValue};
        }
        .group:hover .logo-track {
          animation-play-state: var(--pause);
        }
      `}</style>

      <div className="logo-track flex will-change-transform" style={{ width: "max-content" }}>
        {/* Two copies for seamless loop */}
        <ul ref={seqRef} className="flex items-center shrink-0" role="list">
          {logos.map((item, i) => (
            <li key={i} className="flex-none" style={{ marginRight: gap, fontSize: logoHeight, lineHeight: 1 }}>
              <span className="inline-flex items-center" style={{ color: "rgba(255,255,255,0.5)" }}>
                {item.node}
              </span>
            </li>
          ))}
        </ul>
        <ul className="flex items-center shrink-0" aria-hidden role="list">
          {logos.map((item, i) => (
            <li key={i} className="flex-none" style={{ marginRight: gap, fontSize: logoHeight, lineHeight: 1 }}>
              <span className="inline-flex items-center" style={{ color: "rgba(255,255,255,0.5)" }}>
                {item.node}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
