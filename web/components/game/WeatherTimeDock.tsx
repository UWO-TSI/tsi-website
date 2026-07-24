"use client";

/**
 * WeatherTimeDock (David ask 2026-07-24) — two circular HUD chips under
 * the top-right minimap: the time-of-day (sun/moon) and today's weather.
 * Hovering (or tapping) the weather chip lists its REAL gameplay perks
 * from WEATHER_PERKS — every line is wired into fishing.ts/FishingOverlay,
 * nothing aspirational. Replaces the old TodBadge pill.
 */

import { useState } from "react";
import { Sun, Moon, Sunrise, Sunset, Cloud, CloudRain } from "lucide-react";
import type { Weather } from "@/lib/game/weather";
import { WEATHER_PERKS } from "@/lib/game/weatherPerks";

type Phase = "day" | "night" | "dawn" | "dusk";

const PHASE_META: Record<Phase, { label: string; bg: string; fg: string; Icon: typeof Sun }> = {
  dawn: { label: "Dawn", bg: "#FFB68C", fg: "#5A3A26", Icon: Sunrise },
  day: { label: "Day", bg: "#FFE6A6", fg: "#5A4A2A", Icon: Sun },
  dusk: { label: "Dusk", bg: "#C29ACB", fg: "#3A2A4A", Icon: Sunset },
  night: { label: "Night", bg: "#2D3360", fg: "#E6E6FF", Icon: Moon },
};

const WEATHER_META: Record<Weather, { bg: string; fg: string; Icon: typeof Sun }> = {
  sunny: { bg: "#AED9F5", fg: "#2A5A7A", Icon: Sun },
  cloudy: { bg: "#C9D2DA", fg: "#4A5560", Icon: Cloud },
  rain: { bg: "#6E87B8", fg: "#EAF1FF", Icon: CloudRain },
};

const CIRCLE: React.CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.3)",
  boxShadow: "0 2px 8px rgba(0,0,0,0.28)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "default",
  userSelect: "none",
};

export default function WeatherTimeDock({
  phase,
  weather,
  belowMap,
}: {
  phase: Phase;
  weather: Weather;
  belowMap: boolean;
}) {
  const [open, setOpen] = useState<"time" | "weather" | null>(null);
  const pm = PHASE_META[phase];
  const wm = WEATHER_META[weather];
  const perks = WEATHER_PERKS[weather];

  return (
    <div
      style={{
        position: "absolute",
        // Tuck under the minimap (top 60 + 170 tall + 10 gap) when it's
        // shown; take over its corner slot when it's hidden.
        top: belowMap ? 240 : 60,
        right: 16,
        zIndex: 50,
        display: "flex",
        gap: 8,
        justifyContent: "flex-end",
        transition: "top 0.25s ease",
      }}
    >
      <div
        role="button"
        tabIndex={0}
        aria-label={`Time of day: ${pm.label}`}
        style={{ ...CIRCLE, background: pm.bg, color: pm.fg }}
        onMouseEnter={() => setOpen("time")}
        onMouseLeave={() => setOpen((o) => (o === "time" ? null : o))}
        onFocus={() => setOpen("time")}
        onBlur={() => setOpen((o) => (o === "time" ? null : o))}
        onClick={() => setOpen((o) => (o === "time" ? null : "time"))}
      >
        <pm.Icon size={19} strokeWidth={2.4} />
      </div>
      <div
        role="button"
        tabIndex={0}
        aria-label={`Weather: ${perks.title}`}
        style={{ ...CIRCLE, background: wm.bg, color: wm.fg }}
        onMouseEnter={() => setOpen("weather")}
        onMouseLeave={() => setOpen((o) => (o === "weather" ? null : o))}
        onFocus={() => setOpen("weather")}
        onBlur={() => setOpen((o) => (o === "weather" ? null : o))}
        onClick={() => setOpen((o) => (o === "weather" ? null : "weather"))}
      >
        <wm.Icon size={19} strokeWidth={2.4} />
      </div>

      {open && (
        <div
          style={{
            position: "absolute",
            top: 44,
            right: 0,
            width: 228,
            padding: "10px 12px",
            background: "rgba(13, 27, 42, 0.94)",
            border: "1px solid rgba(110, 168, 255, 0.35)",
            borderRadius: 10,
            boxShadow: "0 6px 18px rgba(0,0,0,0.4)",
            color: "#FFFDF5",
            fontSize: 11.5,
            lineHeight: 1.45,
            pointerEvents: "none",
            animation: "tsi-wdock-in 0.16s ease-out",
          }}
        >
          {open === "time" ? (
            <>
              <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 4, color: pm.bg }}>
                {pm.label}
              </div>
              <div style={{ opacity: 0.85 }}>
                The island clock follows your real time. Some fish only bite at
                certain hours.
              </div>
            </>
          ) : (
            <>
              <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 5, color: wm.bg }}>
                {perks.title} today
              </div>
              <ul style={{ margin: 0, paddingLeft: 15, display: "grid", gap: 3 }}>
                {perks.perks.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
              <div style={{ marginTop: 6, opacity: 0.55, fontSize: 10.5 }}>
                Weather changes daily — each kind has its own perks.
              </div>
            </>
          )}
        </div>
      )}
      <style>{`
        @keyframes tsi-wdock-in { from { opacity: 0; transform: translateY(-3px); } to { opacity: 1; transform: none; } }
      `}</style>
    </div>
  );
}
