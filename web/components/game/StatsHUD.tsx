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

import { useUser } from "@/components/portal/UserContext";
import { xpForLevel } from "@/lib/supabase/types";

export default function StatsHUD() {
  const { profile, loading } = useUser();
  if (loading || !profile) return null;

  const level = (profile.level as number | undefined) ?? 1;
  const xp = (profile.xp as number | undefined) ?? 0;
  const tc = (profile.tethos_coins as number | undefined) ?? 0;

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
        }}
      >
        {tc.toLocaleString()} TC
      </span>
    </div>
  );
}
