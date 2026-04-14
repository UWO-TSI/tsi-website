"use client";

import { useRef, useEffect, useCallback, useId } from "react";

interface LogoMarqueeProps {
  logos: React.ReactNode[];
  speed?: number;
  gap?: number;
  logoHeight?: number;
  dotSize?: number;
  className?: string;
}

/**
 * LogoMarquee — Continuous horizontal scroll of SVG logos.
 * Each logo has two layers: solid + dithered (dot-pattern masked).
 * As a logo moves from edge → center → edge, the blend shifts:
 *   far edge:  both layers transparent (dissolved)
 *   mid edge:  dithered layer visible, solid hidden
 *   center:    solid layer visible, dithered hidden
 */
export default function LogoMarquee({
  logos,
  speed = 35,
  gap = 80,
  logoHeight = 32,
  dotSize = 3,
  className = "",
}: LogoMarqueeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<number>(0);
  const offsetRef = useRef(0);
  const lastTimeRef = useRef(0);
  const logosRef = useRef<HTMLDivElement[]>([]);
  const uid = useId().replace(/:/g, "");

  const updateLogoEffects = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const containerW = rect.width;
    const center = containerW / 2;
    // Zone where dither is active (from edge inward)
    const edgeZone = containerW * 0.3;

    logosRef.current.forEach((el) => {
      if (!el) return;
      const logoRect = el.getBoundingClientRect();
      const logoCenter = logoRect.left + logoRect.width / 2 - rect.left;

      // Distance from center, normalized 0–1 (0 = center, 1 = edge)
      const distFromCenter = Math.abs(logoCenter - center) / center;

      // Solid opacity: 1 at center, fades to 0 in edge zone
      // Dither opacity: 0 at center, fades in at edges, then out at far edges
      let solidOpacity: number;
      let ditherOpacity: number;

      if (distFromCenter < 0.5) {
        // Inner zone: fully solid
        solidOpacity = 1;
        ditherOpacity = 0;
      } else if (distFromCenter < 0.75) {
        // Transition zone: solid fades, dither appears
        const t = (distFromCenter - 0.5) / 0.25;
        solidOpacity = 1 - t;
        ditherOpacity = t;
      } else {
        // Outer zone: dither fades out too
        const t = (distFromCenter - 0.75) / 0.25;
        solidOpacity = 0;
        ditherOpacity = Math.max(0, 1 - t * 1.5);
      }

      const solidEl = el.querySelector("[data-solid]") as HTMLElement;
      const ditherEl = el.querySelector("[data-dither]") as HTMLElement;
      if (solidEl) solidEl.style.opacity = String(solidOpacity);
      if (ditherEl) ditherEl.style.opacity = String(ditherOpacity);
    });
  }, []);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    lastTimeRef.current = performance.now();

    const animate = (now: number) => {
      const dt = (now - lastTimeRef.current) / 1000;
      lastTimeRef.current = now;
      offsetRef.current -= speed * dt;

      const halfWidth = track.scrollWidth / 2;
      if (Math.abs(offsetRef.current) >= halfWidth) {
        offsetRef.current += halfWidth;
      }

      track.style.transform = `translateX(${offsetRef.current}px)`;
      updateLogoEffects();
      animRef.current = requestAnimationFrame(animate);
    };

    animRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animRef.current);
  }, [speed, updateLogoEffects]);

  const renderLogo = (logo: React.ReactNode, i: number) => (
    <div
      key={i}
      ref={(el) => {
        if (el) logosRef.current[i] = el;
      }}
      className="flex-shrink-0 relative"
      style={{
        height: logoHeight,
        marginRight: gap,
      }}
    >
      {/* Solid layer */}
      <div
        data-solid
        className="flex items-center justify-center"
        style={{
          height: logoHeight,
          color: "rgba(255,255,255,0.55)",
          transition: "opacity 0.05s linear",
        }}
      >
        {logo}
      </div>

      {/* Dithered layer — same logo, masked with dot pattern */}
      <div
        data-dither
        className="absolute inset-0 flex items-center justify-center"
        style={{
          height: logoHeight,
          color: "rgba(255,255,255,0.55)",
          opacity: 0,
          maskImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='${dotSize * 2}' height='${dotSize * 2}'%3E%3Crect width='${dotSize}' height='${dotSize}' fill='white'/%3E%3Crect x='${dotSize}' y='${dotSize}' width='${dotSize}' height='${dotSize}' fill='white'/%3E%3C/svg%3E")`,
          WebkitMaskImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='${dotSize * 2}' height='${dotSize * 2}'%3E%3Crect width='${dotSize}' height='${dotSize}' fill='white'/%3E%3Crect x='${dotSize}' y='${dotSize}' width='${dotSize}' height='${dotSize}' fill='white'/%3E%3C/svg%3E")`,
          maskRepeat: "repeat",
          WebkitMaskRepeat: "repeat",
          maskSize: `${dotSize * 2}px ${dotSize * 2}px`,
          WebkitMaskSize: `${dotSize * 2}px ${dotSize * 2}px`,
          transition: "opacity 0.05s linear",
        }}
      >
        {logo}
      </div>
    </div>
  );

  // Build two copies for seamless loop
  const totalLogos = logos.length * 2;
  logosRef.current = new Array(totalLogos);

  return (
    <div ref={containerRef} className={`relative overflow-hidden ${className}`}>
      <div
        ref={trackRef}
        className="flex items-center will-change-transform"
      >
        {logos.map((logo, i) => renderLogo(logo, i))}
        {logos.map((logo, i) => renderLogo(logo, i + logos.length))}
      </div>
    </div>
  );
}
