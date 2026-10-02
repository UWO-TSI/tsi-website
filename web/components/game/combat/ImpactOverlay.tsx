"use client";

/**
 * The overlay pass of the impact frames (design sheet §1.6, §1.7 "Screen overlays"): drawn in the UI layer after the
 * scene's pixel pass, so they stay crisp. The dim round the caster's 3 u circle through the anticipation, the flash
 * frame's colour (the canvas itself is cut to two tones by a CSS filter the ruins scene sets: ink silhouettes on the
 * ult's core colour), 32 radial speed lines on the impact point, and the ult-ready glow along the bottom edge (a soft
 * 300 ms glow, not a flash). The caster's own ult only. Reads impactView on its own animation frame (no React state).
 */
import { useEffect, useMemo, useRef } from "react";
import { impactView } from "@/lib/game/combat/impact";

const LINES = 32;
function rng(seed: number) { let s = seed | 0; return () => ((s = (Math.imul(s ^ (s >>> 15), 0x2c1b3c6d) + 0x6d2b79f5) | 0) >>> 0) / 4294967296; }

export default function ImpactOverlay() {
  const dim = useRef<HTMLDivElement>(null), tint = useRef<HTMLDivElement>(null), glow = useRef<HTMLDivElement>(null);
  const lines = useRef<SVGGElement>(null), svg = useRef<SVGSVGElement>(null);
  // Thick at the screen's edge, thin toward the centre, jittered once (a fixed fan reads as anime, a new one each ult would flicker).
  const fan = useMemo(() => {
    const r = rng(7);
    return Array.from({ length: LINES }, (_, i) => {
      const a = ((i + (r() - 0.5) * 0.7) / LINES) * Math.PI * 2, w = 0.012 + r() * 0.022, inner = 0.2 + r() * 0.14;
      const p = (rad: number, da: number) => `${(Math.cos(a + da) * rad).toFixed(4)},${(Math.sin(a + da) * rad).toFixed(4)}`;
      return `${p(inner, 0)} ${p(1.6, w)} ${p(1.6, -w)}`;
    });
  }, []);
  useEffect(() => {
    let raf = 0;
    const frame = () => {
      raf = requestAnimationFrame(frame);
      const v = impactView, b = v.beats, W = window.innerWidth, H = window.innerHeight;
      if (dim.current) {
        const on = b && b.dim > 0.005;
        dim.current.style.opacity = on ? "1" : "0";
        if (on) dim.current.style.background = `radial-gradient(circle at ${v.caster.x}px ${v.caster.y}px, rgba(0,0,0,0) ${v.caster.r}px, rgba(8,6,14,${b.dim}) ${v.caster.r * 1.35}px)`;
      }
      if (tint.current) {
        const full = b?.flash === "full" && v.flashOk;
        tint.current.style.opacity = full ? "1" : "0";
        tint.current.style.background = v.color;
      }
      if (lines.current && svg.current) {
        const on = b && b.lines !== null;
        svg.current.style.opacity = on ? String(b.linesAlpha) : "0";
        if (on) {
          const scale = Math.max(W, H) * (0.9 + 0.25 * b.lines!);
          lines.current.setAttribute("transform", `translate(${v.hit.x} ${v.hit.y}) scale(${scale})`);
          lines.current.setAttribute("stroke-width", v.reduceFlashing ? "0" : String(1.6 / scale));
        }
      }
      if (glow.current) {
        const t = (performance.now() / 1000 - v.readyAt) / 0.3;
        glow.current.style.opacity = t >= 0 && t < 1 ? String(Math.sin(t * Math.PI) * 0.8) : "0";
        glow.current.style.background = `linear-gradient(to top, ${v.color}cc, ${v.color}00)`;
      }
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);
  const layer: React.CSSProperties = { position: "fixed", inset: 0, pointerEvents: "none", opacity: 0 };
  return <div aria-hidden="true">
    <div ref={dim} style={{ ...layer, zIndex: 18 }} />
    {/* Over the two-tone canvas, the colour multiplies its light half into the ult's core colour; the ink half stays ink. */}
    <div ref={tint} style={{ ...layer, zIndex: 19, mixBlendMode: "multiply" }} />
    <svg ref={svg} width="100%" height="100%" style={{ ...layer, zIndex: 20 }}>
      <g ref={lines} fill="#1d1a24" stroke="#ffffff" strokeLinejoin="round">{fan.map((pts, i) => <polygon key={i} points={pts} />)}</g>
    </svg>
    <div ref={glow} style={{ ...layer, top: "auto", height: 90, zIndex: 18 }} />
  </div>;
}
