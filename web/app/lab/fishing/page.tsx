"use client";

/**
 * /lab/fishing — isolated fishing test bench (David ask, 2026-07-22).
 *
 * Pick any species and fight exactly that reel (no cast/wait/bite RNG),
 * force mystery vs known, preview each tier's catch celebration, and
 * sanity-check the rarity economy with a 1000-roll simulator under any
 * hour/weather. Uses the same FISH table + ReelMinigame as the game
 * (lib/game/fishing.ts) — zero drift.
 */

import { useMemo, useState } from "react";
import { ReelMinigame } from "@/components/game/FishingOverlay";
import FishReveal from "@/components/game/FishReveal";
import FishPreview from "@/components/lab/FishPreview";
import {
  CELEBRATE,
  FISH,
  HOLO_GRADIENT,
  RARITY_META,
  celebrate,
  currentFishingContext,
  fishWeight,
  rollFish,
  rollSize,
  type FishDef,
  iconFor,
} from "@/lib/game/fishing";
import { setLabHour, useLabState } from "@/lib/game/devLab";

const WEATHERS = ["sunny", "cloudy", "rain"] as const;

// Sea King renders holographic (David 2026-07-23) — pairs with the
// tsi-holo-shift keyframes in this page's <style> block.
const HOLO_TEXT: React.CSSProperties = {
  backgroundImage: HOLO_GRADIENT,
  backgroundSize: "300% 100%",
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  WebkitTextFillColor: "transparent",
  animation: "tsi-holo-shift 2.2s linear infinite",
};
const HOLO_BG: React.CSSProperties = {
  background: HOLO_GRADIENT,
  backgroundSize: "300% 100%",
  animation: "tsi-holo-shift 2.2s linear infinite",
  boxShadow: "0 0 12px rgba(122, 231, 255, 0.75)",
};

function setWeatherParam(w: (typeof WEATHERS)[number]) {
  const url = new URL(window.location.href);
  WEATHERS.forEach((k) => url.searchParams.delete(k));
  url.searchParams.set(w, "1");
  window.history.replaceState(null, "", url.toString());
}

export default function FishingBench() {
  const lab = useLabState();
  const [selected, setSelected] = useState<FishDef>(FISH[0]);
  const [mystery, setMystery] = useState(true);
  const [reelKey, setReelKey] = useState(0); // remount per run
  const [reelOpen, setReelOpen] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);
  const [revealOpen, setRevealOpen] = useState(false);
  const [simRows, setSimRows] = useState<{ key: string; name: string; n: number; rarity: string }[] | null>(null);
  // Bumped by weather clicks so availability/sim recompute (weather lives in
  // the URL, which React can't see change).
  const [envTick, setEnvTick] = useState(0);

  const ctx = useMemo(() => currentFishingContext(), [lab.hour, envTick]); // eslint-disable-line react-hooks/exhaustive-deps
  const pool = FISH.filter((f) => !f.when || f.when(ctx.hour, ctx.weather));
  const totalW = pool.reduce((s, f) => s + fishWeight(f, ctx.weather), 0);

  const playReel = () => {
    setLastResult(null);
    setReelKey((k) => k + 1);
    setReelOpen(true);
  };

  const onReelDone = (success: boolean) => {
    setReelOpen(false);
    if (success) {
      const size = rollSize(selected.sizeCm);
      celebrate(selected.rarity, RARITY_META[selected.rarity].color);
      setLastResult(`CAUGHT — ${selected.name}, ${size} cm`);
    } else {
      setLastResult("ESCAPED — it swam off");
    }
  };

  const simulate = () => {
    const counts = new Map<string, number>();
    for (let i = 0; i < 1000; i++) {
      const f = rollFish();
      counts.set(f.key, (counts.get(f.key) ?? 0) + 1);
    }
    setSimRows(
      FISH.map((f) => ({
        key: f.key,
        name: f.name,
        rarity: f.rarity,
        n: counts.get(f.key) ?? 0,
      })).sort((a, b) => b.n - a.n)
    );
  };

  return (
    <div style={{ maxWidth: 980, margin: "0 auto", padding: "24px 20px 60px", fontFamily: "'IBM Plex Mono', monospace", fontSize: 12 }}>
      <style>{`
        @keyframes tsi-holo-shift {
          0% { background-position: 0% 50%; }
          100% { background-position: 300% 50%; }
        }
      `}</style>
      <h1 style={{ fontSize: 18, marginBottom: 4 }}>Fishing bench</h1>
      <p style={{ color: "#8a939a", fontSize: 11, marginBottom: 16 }}>
        Fight any species directly, preview celebrations, and check the rarity economy. Same data
        + reel component as the game.
      </p>

      {/* Environment row */}
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 18, flexWrap: "wrap" }}>
        <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
          hour
          <input
            type="number"
            min={0}
            max={23}
            value={lab.hour ?? new Date().getHours()}
            onChange={(e) => setLabHour(Number(e.target.value))}
            style={{ width: 56, padding: "3px 6px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 5, color: "#f1ffff", fontFamily: "inherit" }}
          />
          {lab.hour !== null && (
            <button onClick={() => setLabHour(null)} style={btn()}>wall clock</button>
          )}
        </label>
        <span style={{ color: "#8a939a" }}>weather:</span>
        {WEATHERS.map((w) => (
          <button
            key={w}
            onClick={() => { setWeatherParam(w); setEnvTick((t) => t + 1); }}
            style={btn(ctx.weather === w)}
          >
            {w}
          </button>
        ))}
        <span style={{ marginLeft: "auto", color: "#8a939a" }}>
          {pool.length}/{FISH.length} species biting now
        </span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 18 }}>
        {/* Species list */}
        <div>
          {FISH.map((f) => {
            const meta = RARITY_META[f.rarity];
            const available = !f.when || f.when(ctx.hour, ctx.weather);
            const pct = available ? ((fishWeight(f, ctx.weather) / totalW) * 100).toFixed(1) : null;
            return (
              <button
                key={f.key}
                onClick={() => { setSelected(f); setReelOpen(false); setLastResult(null); }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  width: "100%",
                  padding: "7px 10px",
                  marginBottom: 4,
                  background: selected.key === f.key ? "rgba(255,209,102,0.14)" : "rgba(255,255,255,0.04)",
                  border: `1px solid ${selected.key === f.key ? "rgba(255,209,102,0.5)" : "rgba(255,255,255,0.1)"}`,
                  borderRadius: 8,
                  color: "#f1ffff",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  fontSize: 11,
                  opacity: available ? 1 : 0.45,
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={iconFor(f)} alt="" width={22} height={22} />
                <span style={{ flex: 1, textAlign: "left" }}>{f.name}</span>
                <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", ...(f.rarity === "seaking" ? HOLO_TEXT : { color: meta.color }) }}>{meta.label}</span>
                <span style={{ fontSize: 9, color: "#8a939a", width: 42, textAlign: "right" }}>
                  {pct ? `${pct}%` : "off"}
                </span>
              </button>
            );
          })}
          <button onClick={simulate} style={{ ...btn(), width: "100%", marginTop: 8, padding: "7px" }}>
            Simulate 1000 casts (current hour/weather)
          </button>
          {simRows && (
            <div style={{ marginTop: 8, padding: 10, background: "rgba(255,255,255,0.04)", borderRadius: 8, fontSize: 10 }}>
              {simRows.map((r) => (
                <div key={r.key} style={{ display: "flex", justifyContent: "space-between", padding: "2px 0" }}>
                  <span>{r.name}</span>
                  <span style={r.rarity === "seaking" ? HOLO_TEXT : { color: RARITY_META[r.rarity as keyof typeof RARITY_META].color }}>
                    {r.n === 0 ? "—" : `${(r.n / 10).toFixed(1)}%`}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Selected fish: stats + reel stage */}
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={iconFor(selected)} alt="" width={34} height={34} />
            <span style={{ fontSize: 15, fontWeight: 700 }}>{selected.name}</span>
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                textTransform: "uppercase",
                borderRadius: 999,
                padding: "2px 8px",
                ...(selected.rarity === "seaking"
                  ? { ...HOLO_BG, color: "#FFFDF5", textShadow: "0 1px 2px rgba(20,40,60,0.45)" }
                  : { color: "#0b0e14", background: RARITY_META[selected.rarity].color }),
              }}
            >
              {RARITY_META[selected.rarity].label}
            </span>
            {selected.whenLabel && <span style={{ fontSize: 10, color: "#8a939a" }}>bites: {selected.whenLabel}</span>}
          </div>

          {/* Big model view — click any species on the left to swap it in */}
          <FishPreview model={selected.model} raw={selected.raw} />

          {/* Stats grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, marginBottom: 14, fontSize: 10 }}>
            <Stat label="bar width" value={`${(RARITY_META[selected.rarity].barW * 100).toFixed(0)}%`} />
            <Stat label="size" value={`${selected.sizeCm[0]}-${selected.sizeCm[1]} cm`} />
            <Stat label="speed" value={selected.move.speed.toFixed(2)} />
            <Stat label="accel" value={selected.move.accel.toFixed(1)} />
            <Stat label="jitter" value={selected.move.jitter.toFixed(3)} />
            <Stat label="dart %" value={`${Math.round(selected.move.dartChance * 100)}%`} />
            <Stat label="dart ×" value={selected.move.dartMul.toFixed(1)} />
            <Stat label="retarget" value={`${selected.move.retargetMs}ms`} />
          </div>

          {/* Actions */}
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 16, flexWrap: "wrap" }}>
            <button onClick={playReel} style={{ ...btn(true), padding: "8px 14px", fontSize: 12 }}>
              ▶ Fight this fish
            </button>
            <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 11 }}>
              <input type="checkbox" checked={mystery} onChange={(e) => setMystery(e.target.checked)} />
              mystery (??? + silhouette)
            </label>
            <button onClick={() => setRevealOpen(true)} style={btn()}>
              Preview first-catch reveal
            </button>
            <button
              onClick={() => celebrate(selected.rarity, RARITY_META[selected.rarity].color)}
              style={btn()}
            >
              Repeat-catch confetti ({CELEBRATE[selected.rarity].bursts} bursts)
            </button>
          </div>

          {/* Reel stage */}
          <div style={{ minHeight: 150, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "rgba(255,255,255,0.03)", border: "1px dashed rgba(255,255,255,0.12)", borderRadius: 12, padding: 16 }}>
            {reelOpen ? (
              <ReelMinigame key={reelKey} fish={selected} known={!mystery} onDone={onReelDone} />
            ) : lastResult ? (
              <div style={{ fontSize: 14, fontWeight: 700, color: lastResult.startsWith("CAUGHT") ? "#7C9A62" : "#E5484D" }}>
                {lastResult}
                <div style={{ marginTop: 8, textAlign: "center" }}>
                  <button onClick={playReel} style={btn()}>again</button>
                </div>
              </div>
            ) : (
              <span style={{ color: "#8a939a", fontSize: 11 }}>press ▶ to fight — hold LMB / E / Space to push the bar</span>
            )}
          </div>
        </div>
      </div>
      {revealOpen && (
        <FishReveal fish={selected} sizeCm={rollSize(selected.sizeCm)} onDone={() => setRevealOpen(false)} />
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ padding: "6px 8px", background: "rgba(255,255,255,0.04)", borderRadius: 6 }}>
      <div style={{ color: "#8a939a", fontSize: 9 }}>{label}</div>
      <div style={{ fontWeight: 700 }}>{value}</div>
    </div>
  );
}

function btn(active = false): React.CSSProperties {
  return {
    padding: "4px 10px",
    fontSize: 10,
    fontFamily: "'IBM Plex Mono', monospace",
    background: active ? "rgba(255,209,102,0.25)" : "rgba(255,255,255,0.08)",
    border: `1px solid ${active ? "rgba(255,209,102,0.5)" : "rgba(255,255,255,0.16)"}`,
    borderRadius: 6,
    color: "#f1ffff",
    cursor: "pointer",
  };
}
