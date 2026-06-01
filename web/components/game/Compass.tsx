"use client";

/**
 * Compass HUD (P16) — top-center DOM widget showing camera facing.
 *
 * Reads the latest azimuth from a ref written by CompassFeed inside the
 * R3F Canvas. Polls at 12fps (every ~80ms) so the needle doesn't burn
 * cycles updating per render frame — the eye can't see the difference
 * but the React reconciler is cheaper. NESW labels rotate with the dial
 * so "N" always points north.
 */

import { useEffect, useState } from "react";

interface CompassProps {
  azimuthRef: React.MutableRefObject<number>;
  visible?: boolean;
}

const CARDINALS = [
  { label: "N", angle: 0 },
  { label: "E", angle: 90 },
  { label: "S", angle: 180 },
  { label: "W", angle: 270 },
];

export default function Compass({ azimuthRef, visible = true }: CompassProps) {
  const [deg, setDeg] = useState(0);

  useEffect(() => {
    if (!visible) return;
    let last = 0;
    let raf = 0;
    const tick = (t: number) => {
      raf = requestAnimationFrame(tick);
      if (t - last < 80) return;
      last = t;
      const radians = azimuthRef.current;
      const next = ((radians * 180) / Math.PI) % 360;
      setDeg(next);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [azimuthRef, visible]);

  if (!visible) return null;

  return (
    <div
      style={{
        position: "absolute",
        top: 12,
        left: "50%",
        transform: "translateX(-50%)",
        width: 116,
        height: 26,
        background: "rgba(15, 15, 16, 0.65)",
        border: "1px solid rgba(255,255,255,0.12)",
        borderRadius: 13,
        overflow: "hidden",
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: 12,
        color: "#f1ffff",
        pointerEvents: "none",
        userSelect: "none",
        zIndex: 30,
      }}
    >
      {/* Center tick — fixed facing marker */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: "50%",
          width: 1,
          height: "100%",
          background: "#FFD166",
          opacity: 0.85,
          transform: "translateX(-0.5px)",
        }}
      />
      {/* Sliding strip — each cardinal at its world angle, offset by -deg
          so the strip moves opposite to camera rotation. */}
      <div style={{ position: "absolute", inset: 0 }}>
        {CARDINALS.map((c) => {
          // Wrap delta into [-180, 180] so labels can slide off either side
          // without jumping when they cross the seam.
          let delta = c.angle - deg;
          if (delta > 180) delta -= 360;
          if (delta < -180) delta += 360;
          // 1 deg = ~0.55px on a 116px strip → ~1/3 visible at any time.
          const x = 58 + delta * 0.55;
          if (x < -8 || x > 124) return null;
          return (
            <div
              key={c.label}
              style={{
                position: "absolute",
                top: 0,
                left: x,
                transform: "translateX(-50%)",
                lineHeight: "26px",
                fontWeight: 700,
                color: c.label === "N" ? "#FFD166" : "#f1ffff",
              }}
            >
              {c.label}
            </div>
          );
        })}
      </div>
    </div>
  );
}
