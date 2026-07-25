"use client";

/**
 * StatsHUD (P33) — top-left HUD pill showing the player's level + XP
 * progress + TC balance. Sits just to the right of the hamburger menu
 * so the eye lands on identity (who am I, how am I doing) before
 * navigation.
 *
 * Pulls from useUser() — silent while loading or when offline (the
 * existing dashboard already handles the unauthenticated case via
 * middleware).
 */

import { useEffect, useRef, useState } from "react";
import { useUser } from "@/components/portal/UserContext";
import { xpForLevel } from "@/lib/supabase/types";

/**
 * Loop iter 18 (2026-07-24): the TC number counts toward its new value
 * (ease-out over ~0.7s) with a gold flash on gains, instead of snapping.
 */
function useTickUp(target: number): { value: number; flashing: boolean } {
  const [value, setValue] = useState(target);
  const [flashing, setFlashing] = useState(false);
  const fromRef = useRef(target);
  useEffect(() => {
    const from = fromRef.current;
    if (from === target) return;
    fromRef.current = target;
    const gained = target > from;
    const t0 = performance.now();
    const dur = 700;
    let raf = 0;
    let flashed = false;
    let flashOff = 0;
    const step = (now: number) => {
      // Flash kicks in on the first frame (not synchronously in the
      // effect body — react-compiler cascading-render rule).
      if (gained && !flashed) {
        flashed = true;
        setFlashing(true);
        flashOff = window.setTimeout(() => setFlashing(false), 900);
      }
      const k = Math.min(1, (now - t0) / dur);
      const eased = 1 - Math.pow(1 - k, 3);
      setValue(Math.round(from + (target - from) * eased));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(raf);
      if (flashOff) window.clearTimeout(flashOff);
    };
  }, [target]);
  return { value, flashing };
}

export default function StatsHUD() {
  const { profile, loading } = useUser();
  const tcTarget = ((profile?.tethos_coins as number | undefined) ?? 0);
  const { value: tcShown, flashing } = useTickUp(tcTarget);
  // Loop iter 21 (2026-07-24): XP bar rolls to its new fill with a gold
  // glow on gains — same useTickUp as the coin count.
  const xpTarget = ((profile?.xp as number | undefined) ?? 0);
  const { value: xpShown, flashing: xpFlash } = useTickUp(xpTarget);
  if (loading || !profile) return null;

  const level = (profile.level as number | undefined) ?? 1;
  const xp = xpShown;
  const tc = tcShown;

  // XP progress toward next level. xpForLevel returns total XP needed to
  // *reach* that level; we want how far the player is between the
  // current and next thresholds.
  const xpAtCurrent = xpForLevel(level);
  const xpAtNext = xpForLevel(level + 1);
  const span = Math.max(1, xpAtNext - xpAtCurrent);
  const progress = Math.min(1, Math.max(0, (xp - xpAtCurrent) / span));

  return (
    <div
      style={{
        position: "absolute",
        top: 12,
        left: 60,
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 12px",
        background: "rgba(15, 15, 16, 0.7)",
        border: "1px solid rgba(255, 255, 255, 0.12)",
        borderRadius: 999,
        color: "#f1ffff",
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: 12,
        boxShadow: "0 2px 6px rgba(0,0,0,0.25)",
        zIndex: 30,
        pointerEvents: "none",
        userSelect: "none",
      }}
    >
      <span style={{ fontWeight: 700, color: "#FFD166" }}>Lv.{level}</span>
      <div
        style={{
          width: 80,
          height: 6,
          background: "rgba(255,255,255,0.12)",
          borderRadius: 999,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${Math.round(progress * 100)}%`,
            height: "100%",
            background: "linear-gradient(90deg, #FFD166, #FFB36A)",
            transition: "width 0.4s ease",
            boxShadow: xpFlash ? "0 0 8px 1px rgba(255, 209, 102, 0.9)" : "none",
          }}
        />
      </div>
      <span style={{ color: "#8a939a", fontSize: 11 }}>
        {Math.max(0, xp - xpAtCurrent)} / {span}
      </span>
      <span
        style={{
          marginLeft: 6,
          paddingLeft: 10,
          borderLeft: "1px solid rgba(255,255,255,0.12)",
          color: "#FFD166",
          fontWeight: 700,
          textShadow: flashing ? "0 0 10px rgba(255, 209, 102, 0.95)" : "none",
          transition: "text-shadow 0.35s ease-out",
        }}
      >
        {tc.toLocaleString()} 💎
      </span>
    </div>
  );
}
