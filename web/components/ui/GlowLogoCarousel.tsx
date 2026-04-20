"use client";

import React, { useRef, useEffect, useState, useId } from "react";
import { createPortal } from "react-dom";
import { type LogoItem } from "@/components/ui/LogoLoop";

export interface GlowLogoCarouselProps {
  logos: LogoItem[];
  /** Pixels per second at full speed. */
  speed?: number;
  gap?: number;
  logoHeight?: number;
  className?: string;
  pauseOnHover?: boolean;
  hoverGlow?: string;
  tooltipAccent?: string;
}

type HoverState = { title: string; x: number; y: number } | null;

export default function GlowLogoCarousel({
  logos,
  speed = 22,
  gap = 60,
  logoHeight = 21,
  className = "",
  pauseOnHover = true,
  hoverGlow = "rgba(91, 139, 232, 0.22)",
  tooltipAccent = "#8DA8CC",
}: GlowLogoCarouselProps) {
  const uid = useId().replace(/:/g, "");
  const rootRef = useRef<HTMLDivElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const seqRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<HoverState>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // rAF-driven marquee so speed can ease smoothly on hover.
  useEffect(() => {
    const row = rowRef.current;
    const seq = seqRef.current;
    const root = rootRef.current;
    if (!row || !seq || !root) return;

    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let position = 0;
    let seqWidth = seq.scrollWidth + gap;
    let currentSpeed = prefersReduced ? 0 : speed;
    let targetSpeed = prefersReduced ? 0 : speed;
    let lastTime = performance.now();
    let rafId = 0;

    const onEnter = () => {
      if (pauseOnHover && !prefersReduced) targetSpeed = 0;
    };
    const onLeave = () => {
      if (!prefersReduced) targetSpeed = speed;
    };
    root.addEventListener("mouseenter", onEnter);
    root.addEventListener("mouseleave", onLeave);

    const measure = () => {
      seqWidth = seq.scrollWidth + gap;
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(seq);

    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - lastTime) / 1000);
      lastTime = now;

      // Critically-damped ease toward targetSpeed. Higher easeRate = snappier.
      // 3.2/sec reaches ~90% in ~700ms; visually reads as "slow graceful stop".
      const easeRate = targetSpeed === 0 ? 3.2 : 4.5;
      currentSpeed += (targetSpeed - currentSpeed) * (1 - Math.exp(-easeRate * dt));

      if (Math.abs(currentSpeed) > 0.001) {
        position -= currentSpeed * dt;
        if (seqWidth > 0 && position <= -seqWidth) {
          position += seqWidth;
        }
      }
      row.style.transform = `translate3d(${position.toFixed(2)}px, 0, 0)`;
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
      root.removeEventListener("mouseenter", onEnter);
      root.removeEventListener("mouseleave", onLeave);
    };
  }, [speed, gap, logos, pauseOnHover]);

  // Rest = blue tint at 50% opacity. Hover = identity filter (original brand
  // colors) at 100% opacity. Each rest/hover pair shares the same filter
  // function structure so CSS can interpolate smoothly between them.
  const tintFilters = {
    solid: {
      rest:
        "brightness(0) invert(1) sepia(1) saturate(400%) hue-rotate(205deg) brightness(0.88)",
      hover:
        "brightness(1) invert(0) sepia(0) saturate(100%) hue-rotate(0deg) brightness(1)",
    },
    two: {
      rest:
        "grayscale(1) contrast(2.2) brightness(1.05) sepia(1) saturate(340%) hue-rotate(196deg)",
      hover:
        "grayscale(0) contrast(1) brightness(1) sepia(0) saturate(100%) hue-rotate(0deg)",
    },
    multi: {
      rest:
        "grayscale(1) contrast(1.15) brightness(1.05) sepia(1) saturate(360%) hue-rotate(200deg)",
      hover:
        "grayscale(0) contrast(1) brightness(1) sepia(0) saturate(100%) hue-rotate(0deg)",
    },
  } as const;

  const renderLogo = (item: LogoItem, i: number, copy: number) => {
    const cellHeight = logoHeight * 2.4;
    const glowSize = logoHeight * 3;

    return (
      <span
        key={`${copy}-${i}`}
        className={`cc-cell-${uid}`}
        style={{ marginRight: gap, height: cellHeight }}
        onMouseEnter={(e) => {
          const el = e.currentTarget as HTMLElement;
          const r = el.getBoundingClientRect();
          setHover({
            title: item.title || item.text,
            x: r.x + r.width / 2,
            y: r.y + r.height,
          });
        }}
        onMouseMove={(e) => {
          const el = e.currentTarget as HTMLElement;
          const r = el.getBoundingClientRect();
          setHover((prev) =>
            prev && prev.title === (item.title || item.text)
              ? { title: prev.title, x: r.x + r.width / 2, y: r.y + r.height }
              : prev
          );
        }}
        onMouseLeave={() => setHover(null)}
      >
        <span
          aria-hidden
          className={`cc-halo-${uid}`}
          style={{
            width: glowSize,
            height: glowSize,
            background: `radial-gradient(circle, ${hoverGlow} 0%, transparent 65%)`,
          }}
        />

        {item.icon ? (
          <img
            src={item.icon}
            alt={item.title || item.text}
            draggable={false}
            className={`cc-img-${uid}`}
            data-mode={item.colorMode ?? "solid"}
            style={{
              height: logoHeight * (item.scale ?? 1),
            }}
          />
        ) : (
          <span className={`cc-text-${uid}`}>{item.text}</span>
        )}
      </span>
    );
  };

  const fadeMask = `linear-gradient(to right,
    transparent 0%,
    black 22%,
    black 78%,
    transparent 100%)`;

  return (
    <div
      ref={rootRef}
      className={`cc-root-${uid} relative w-full ${className}`}
      aria-hidden="true"
    >
      <style>{`
        .cc-row-${uid} {
          display: flex;
          width: max-content;
          will-change: transform;
        }

        .cc-cell-${uid} {
          position: relative;
          flex: none;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: default;
        }

        .cc-halo-${uid} {
          position: absolute;
          border-radius: 50%;
          filter: blur(6px);
          pointer-events: none;
          opacity: 0;
          transition: opacity 320ms ease-out;
        }
        .cc-cell-${uid}:hover .cc-halo-${uid} { opacity: 1; }

        .cc-img-${uid} {
          position: relative;
          width: auto;
          display: block;
          user-select: none;
          pointer-events: none;
          opacity: 0.5;
          transition: opacity 320ms ease-out, filter 320ms ease-out, transform 320ms ease-out;
          image-rendering: -webkit-optimize-contrast;
          transform: translateY(0);
        }
        .cc-img-${uid}[data-mode="solid"] { filter: ${tintFilters.solid.rest}; }
        .cc-img-${uid}[data-mode="two"]   { filter: ${tintFilters.two.rest}; }
        .cc-img-${uid}[data-mode="multi"] { filter: ${tintFilters.multi.rest}; }

        .cc-cell-${uid}:hover .cc-img-${uid} {
          opacity: 1;
          transform: translateY(-1px);
        }
        .cc-cell-${uid}:hover .cc-img-${uid}[data-mode="solid"] { filter: ${tintFilters.solid.hover}; }
        .cc-cell-${uid}:hover .cc-img-${uid}[data-mode="two"]   { filter: ${tintFilters.two.hover}; }
        .cc-cell-${uid}:hover .cc-img-${uid}[data-mode="multi"] { filter: ${tintFilters.multi.hover}; }

        .cc-text-${uid} {
          position: relative;
          font-size: 12px;
          font-weight: 600;
          font-family: 'Test Sohne', -apple-system, sans-serif;
          color: rgba(183, 201, 226, 0.78);
          letter-spacing: 0.02em;
        }
      `}</style>

      <div
        style={{
          maskImage: fadeMask,
          WebkitMaskImage: fadeMask,
          height: logoHeight * 2.4,
          overflow: "hidden",
        }}
      >
        <div ref={rowRef} className={`cc-row-${uid}`}>
          <div ref={seqRef} className="flex items-center shrink-0">
            {logos.map((l, i) => renderLogo(l, i, 0))}
          </div>
          <div className="flex items-center shrink-0" aria-hidden>
            {logos.map((l, i) => renderLogo(l, i, 1))}
          </div>
        </div>
      </div>

      {mounted && hover
        ? createPortal(
            <span
              role="tooltip"
              style={{
                position: "fixed",
                top: hover.y + 12,
                left: hover.x,
                transform: "translateX(-50%)",
                fontSize: 10,
                fontWeight: 500,
                fontFamily:
                  "'IBM Plex Mono', ui-monospace, 'SF Mono', Menlo, Consolas, monospace",
                color: tooltipAccent,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                whiteSpace: "nowrap",
                opacity: 0.78,
                pointerEvents: "none",
                zIndex: 9999,
              }}
            >
              {hover.title}
            </span>,
            document.body
          )
        : null}
    </div>
  );
}
