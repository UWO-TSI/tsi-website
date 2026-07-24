"use client";

/**
 * LabPanel — control surface for /lab/world (2026-07-22).
 *
 * Live knobs (no reload): time-of-day scrub, palette override, pastel-grade
 * sliders — these flow through the devLab store into the running world.
 * Remount knobs (world remounts via key bump): weather + spawn, which the
 * game reads once at mount from URL params that already exist as QA hooks
 * (?sunny/?cloudy/?rain, ?beach).
 */

import { useState } from "react";
import {
  resetLab,
  setLabGrade,
  setLabHour,
  setLabPalette,
  useLabState,
  type LabPaletteColors,
} from "@/lib/game/devLab";
import { DEFAULT_PALETTES } from "@/data/content-defaults";
import { DEFAULT_GRADE, type Grade } from "@/lib/game/grading";
import { getTodayWeather } from "@/lib/game/weather";

const PALETTE_KEYS: (keyof LabPaletteColors)[] = [
  "sky",
  "grass",
  "accent",
  "fog",
  "water",
  "building_primary",
  "building_accent",
];

const WEATHERS = ["sunny", "cloudy", "rain"] as const;

const GRADE_SLIDERS: { key: keyof Grade; label: string; min: number; max: number; step: number }[] = [
  { key: "exposure", label: "exposure", min: 0.5, max: 1.6, step: 0.02 },
  { key: "contrast", label: "contrast", min: 0.8, max: 1.25, step: 0.01 },
  { key: "vibrance", label: "vibrance", min: -0.5, max: 0.5, step: 0.02 },
  { key: "desat", label: "pastel desat", min: 0, max: 0.5, step: 0.01 },
  { key: "warmth", label: "warmth", min: 0, max: 2.5, step: 0.05 },
  { key: "lift", label: "black lift", min: 0, max: 3, step: 0.05 },
  { key: "vignette", label: "vignette", min: 0, max: 0.8, step: 0.02 },
];

const gradeStorageKey = (w: string) => `tsi.lab.grade.${w}`;

function setSearchParams(params: Record<string, string | null>) {
  const url = new URL(window.location.href);
  for (const [k, v] of Object.entries(params)) {
    if (v === null) url.searchParams.delete(k);
    else url.searchParams.set(k, v);
  }
  window.history.replaceState(null, "", url.toString());
}

export default function LabPanel({ onRemount }: { onRemount: () => void }) {
  const lab = useLabState();
  const [collapsed, setCollapsed] = useState(false);

  const hourLabel =
    lab.hour === null
      ? "wall clock"
      : `${String(Math.floor(lab.hour)).padStart(2, "0")}:${String(Math.round((lab.hour % 1) * 60)).padStart(2, "0")}`;

  const pickWeather = (w: (typeof WEATHERS)[number]) => {
    setSearchParams({ sunny: null, cloudy: null, rain: null, [w]: "1" });
    onRemount();
  };

  const pickSpawn = (beach: boolean) => {
    setSearchParams({ beach: beach ? "1" : null });
    onRemount();
  };

  const copyValues = () => {
    void navigator.clipboard.writeText(
      JSON.stringify({ hour: lab.hour, palette: lab.palette, grade: lab.grade }, null, 2),
    );
  };

  return (
    <div
      style={{
        position: "absolute",
        top: 56,
        right: 16,
        zIndex: 120,
        width: collapsed ? "auto" : 280,
        background: "rgba(11, 14, 20, 0.94)",
        border: "1px solid rgba(255, 209, 102, 0.35)",
        borderRadius: 10,
        padding: collapsed ? "8px 12px" : "14px 16px",
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: 11,
        color: "#f1ffff",
        maxHeight: "calc(100vh - 72px)",
        overflowY: "auto",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: collapsed ? 0 : 12 }}>
        <span style={{ color: "#FFD166", letterSpacing: "0.1em" }}>EXPERIMENT</span>
        <button onClick={() => setCollapsed((c) => !c)} style={btn()}>
          {collapsed ? "Open" : "—"}
        </button>
      </div>

      {!collapsed && (
        <>
          {/* Time / sky */}
          <Section title={`Time — ${hourLabel}`}>
            <label style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 6 }}>
              <input
                type="checkbox"
                checked={lab.hour !== null}
                onChange={(e) => setLabHour(e.target.checked ? 12 : null)}
              />
              Override clock
            </label>
            {lab.hour !== null && (
              <input
                type="range"
                min={0}
                max={23.99}
                step={0.25}
                value={lab.hour}
                onChange={(e) => setLabHour(Number(e.target.value))}
                style={{ width: "100%" }}
              />
            )}
            <div style={{ display: "flex", gap: 4, marginTop: 6, flexWrap: "wrap" }}>
              {[
                ["Dawn", 5.5],
                ["Noon", 12],
                ["Dusk", 18.5],
                ["Night", 22],
              ].map(([label, h]) => (
                <button key={label as string} onClick={() => setLabHour(h as number)} style={btn()}>
                  {label}
                </button>
              ))}
            </div>
          </Section>

          {/* Weather (remounts) */}
          <Section title="Weather (remounts world)">
            <div style={{ display: "flex", gap: 4 }}>
              {WEATHERS.map((w) => (
                <button key={w} onClick={() => pickWeather(w)} style={btn()}>
                  {w}
                </button>
              ))}
            </div>
          </Section>

          {/* Spawn (remounts) */}
          <Section title="Spawn (remounts world)">
            <div style={{ display: "flex", gap: 4 }}>
              <button onClick={() => pickSpawn(false)} style={btn()}>village</button>
              <button onClick={() => pickSpawn(true)} style={btn()}>beach cove</button>
            </div>
          </Section>

          {/* Palette */}
          <Section title="Palette">
            <div style={{ display: "flex", gap: 4, marginBottom: 8, flexWrap: "wrap" }}>
              <button onClick={() => setLabPalette(null)} style={btn(lab.palette === null)}>
                live
              </button>
              {DEFAULT_PALETTES.map((p) => (
                <button key={p.slug} onClick={() => setLabPalette({ ...p.palette })} style={btn()}>
                  {p.slug}
                </button>
              ))}
            </div>
            {lab.palette && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
                {PALETTE_KEYS.map((k) => (
                  <label key={k} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10 }}>
                    <input
                      type="color"
                      value={lab.palette![k]}
                      onChange={(e) => setLabPalette({ ...lab.palette!, [k]: e.target.value })}
                      style={{ width: 24, height: 18, padding: 0, border: "none", background: "none" }}
                    />
                    {k.replace("building_", "b.")}
                  </label>
                ))}
              </div>
            )}
            <div style={{ fontSize: 9, color: "#8a939a", marginTop: 6 }}>
              Sky/fog apply at dawn/dusk blends; remount to see a cold load.
            </div>
          </Section>

          {/* Color grade — full slider rig, saved per weather (David 2026-07-23) */}
          <Section title={`Color grade — tuning for: ${getTodayWeather()}`}>
            <label style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 6 }}>
              <input
                type="checkbox"
                checked={lab.grade !== null}
                onChange={(e) => setLabGrade(e.target.checked ? { ...DEFAULT_GRADE } : null)}
              />
              Override grade
            </label>
            {lab.grade && (
              <>
                {GRADE_SLIDERS.map((sl) => (
                  <Slider
                    key={sl.key}
                    label={`${sl.label} ${lab.grade![sl.key].toFixed(2)} (ship ${DEFAULT_GRADE[sl.key]})`}
                    min={sl.min}
                    max={sl.max}
                    step={sl.step}
                    value={lab.grade![sl.key]}
                    onChange={(v) => setLabGrade({ ...lab.grade!, [sl.key]: v })}
                  />
                ))}
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 6 }}>
                  <button
                    onClick={() => {
                      try { localStorage.setItem(gradeStorageKey(getTodayWeather()), JSON.stringify(lab.grade)); } catch { /* ignore */ }
                    }}
                    style={btn(true)}
                  >
                    Save → {getTodayWeather()}
                  </button>
                  <button
                    onClick={() => {
                      try {
                        const raw = localStorage.getItem(gradeStorageKey(getTodayWeather()));
                        if (raw) setLabGrade(JSON.parse(raw) as Grade);
                      } catch { /* ignore */ }
                    }}
                    style={btn()}
                  >
                    Load {getTodayWeather()}
                  </button>
                  <button
                    onClick={() => {
                      const out: Record<string, Grade> = {};
                      for (const w of WEATHERS) {
                        try {
                          const raw = localStorage.getItem(gradeStorageKey(w));
                          out[w] = raw ? (JSON.parse(raw) as Grade) : { ...DEFAULT_GRADE };
                        } catch { out[w] = { ...DEFAULT_GRADE }; }
                      }
                      void navigator.clipboard.writeText(JSON.stringify(out, null, 2));
                    }}
                    style={btn()}
                  >
                    Export all → clipboard
                  </button>
                </div>
                <div style={{ fontSize: 9, color: "#8a939a", marginTop: 6 }}>
                  Tune per weather, Save each, Export all — the JSON gets baked
                  into WEATHER_GRADES in lib/game/grading.ts.
                </div>
              </>
            )}
          </Section>

          <div style={{ display: "flex", gap: 4, marginTop: 10 }}>
            <button onClick={copyValues} style={btn()}>Copy values</button>
            <button onClick={() => { resetLab(); setSearchParams({ sunny: null, cloudy: null, rain: null, beach: null }); }} style={btn()}>
              Reset all
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12, paddingBottom: 10, borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
      <div style={{ color: "#8a939a", marginBottom: 6, fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase" }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function Slider({
  label, min, max, step, value, onChange,
}: {
  label: string; min: number; max: number; step: number; value: number; onChange: (v: number) => void;
}) {
  return (
    <label style={{ display: "block", marginBottom: 6, fontSize: 10 }}>
      {label}
      <input
        type="range"
        min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: "100%" }}
      />
    </label>
  );
}

function btn(active = false): React.CSSProperties {
  return {
    padding: "3px 8px",
    fontSize: 10,
    fontFamily: "inherit",
    background: active ? "rgba(255,209,102,0.25)" : "rgba(255,255,255,0.08)",
    border: `1px solid ${active ? "rgba(255,209,102,0.5)" : "rgba(255,255,255,0.16)"}`,
    borderRadius: 5,
    color: "#f1ffff",
    cursor: "pointer",
  };
}
