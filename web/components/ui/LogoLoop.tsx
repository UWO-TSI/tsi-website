"use client";

import React, { useRef, useEffect, useState } from "react";

export interface LogoItem {
  text: string;
  href?: string;
  title?: string;
  icon?: string;
  /** Visual size multiplier. Some logos look larger/smaller than others at the same px height
   *  because of bounding-box density. Use 0.85-1.25 to normalize perceived size. */
  scale?: number;
  /** Color treatment:
   *   "solid" → one main blue (for single-color source or enforced uniform).
   *   "two"   → main blue (dark parts) + very light blue (light parts).
   *   "multi" → 4-shade ramp from very light to dark blue (source has multiple colors).
   *  Default: "solid". */
  colorMode?: "solid" | "two" | "multi";
}

export interface LogoLoopProps {
  logos: LogoItem[];
  speed?: number;
  direction?: "left" | "right";
  gap?: number;
  pauseOnHover?: boolean;
  fadeOut?: boolean;
  fadeOutColor?: string;
  className?: string;
}

export default function LogoLoop({
  logos,
  speed = 40,
  direction = "left",
  gap = 48,
  pauseOnHover = true,
  fadeOut = true,
  fadeOutColor = "#0F0F10",
  className = "",
}: LogoLoopProps) {
  const seqRef = useRef<HTMLDivElement>(null);
  const [duration, setDuration] = useState(20);

  useEffect(() => {
    if (!seqRef.current) return;
    const measure = () => {
      const w = seqRef.current?.scrollWidth ?? 0;
      if (w > 0) setDuration(w / speed);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(seqRef.current);
    return () => observer.disconnect();
  }, [logos, speed]);

  const animStyle: React.CSSProperties = {
    display: "flex",
    width: "max-content",
    willChange: "transform",
    animation: `marquee ${duration}s linear infinite ${direction === "left" ? "normal" : "reverse"}`,
  };

  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={{
        ...(pauseOnHover ? { ["--hover-state" as string]: "running" } : undefined),
        ...(fadeOut
          ? {
              maskImage:
                "linear-gradient(to right, transparent, black clamp(24px, 8%, 100px), black calc(100% - clamp(24px, 8%, 100px)), transparent)",
              WebkitMaskImage:
                "linear-gradient(to right, transparent, black clamp(24px, 8%, 100px), black calc(100% - clamp(24px, 8%, 100px)), transparent)",
            }
          : undefined),
      }}
    >

      <div
        style={animStyle}
        onMouseEnter={pauseOnHover ? (e) => (e.currentTarget.style.animationPlayState = "paused") : undefined}
        onMouseLeave={pauseOnHover ? (e) => (e.currentTarget.style.animationPlayState = "running") : undefined}
      >
        {/* First copy */}
        <div ref={seqRef} className="flex items-center shrink-0">
          {logos.map((item, i) => (
            <span
              key={i}
              className="flex-none whitespace-nowrap flex items-center"
              style={{ marginRight: gap }}
            >
              {item.icon ? (
                <img
                  src={item.icon}
                  alt={item.title || item.text}
                  style={{
                    height: 18,
                    width: "auto",
                    opacity: 0.45,
                    filter: "brightness(0) invert(1)",
                  }}
                  draggable={false}
                />
              ) : (
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    fontFamily: "'Test Sohne', -apple-system, sans-serif",
                    color: "rgba(255,255,255,0.45)",
                    letterSpacing: "0.02em",
                  }}
                >
                  {item.text}
                </span>
              )}
            </span>
          ))}
        </div>
        {/* Second copy for seamless loop */}
        <div className="flex items-center shrink-0" aria-hidden>
          {logos.map((item, i) => (
            <span
              key={i}
              className="flex-none whitespace-nowrap flex items-center"
              style={{ marginRight: gap }}
            >
              {item.icon ? (
                <img
                  src={item.icon}
                  alt={item.title || item.text}
                  style={{
                    height: 18,
                    width: "auto",
                    opacity: 0.45,
                    filter: "brightness(0) invert(1)",
                  }}
                  draggable={false}
                />
              ) : (
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    fontFamily: "'Test Sohne', -apple-system, sans-serif",
                    color: "rgba(255,255,255,0.45)",
                    letterSpacing: "0.02em",
                  }}
                >
                  {item.text}
                </span>
              )}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
