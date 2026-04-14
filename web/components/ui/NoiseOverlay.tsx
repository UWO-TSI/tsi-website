"use client";

/**
 * Noise grain overlay using a CSS background pattern.
 * Uses a base64-encoded tiny noise tile instead of SVG feTurbulence
 * for dramatically better scroll/render performance.
 */

interface NoiseOverlayProps {
  opacity?: number;
  className?: string;
}

// 100x100 noise tile as base64 data URI -- generated once, tiled via CSS
const NOISE_URI = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)'/%3E%3C/svg%3E")`;

export default function NoiseOverlay({
  opacity = 0.03,
  className = "",
}: NoiseOverlayProps) {
  return (
    <div
      className={`fixed inset-0 pointer-events-none z-[9999] ${className}`}
      style={{
        opacity,
        backgroundImage: NOISE_URI,
        backgroundRepeat: "repeat",
        backgroundSize: "200px 200px",
        mixBlendMode: "overlay",
        willChange: "auto",
      }}
    />
  );
}
