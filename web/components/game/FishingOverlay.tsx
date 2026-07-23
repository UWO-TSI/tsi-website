"use client";

/**
 * FishingOverlay (cozy marathon G5; reel minigame + rarity 2026-07-22).
 *
 * DOM overlay (outside the Canvas, alongside the emote menu). Listens for
 * `tsi:fish-start` from GameWorld's E handler when the player is at a
 * riverbank spot, then runs a self-contained state machine:
 *
 *   casting → waiting (2-6s) → bite (1.4s window) → REELING → result
 *
 * Hook the bite with E or left-click, then the Stardew-style reel minigame
 * runs: a HORIZONTAL water track, hold left-click (or E/Space) to push the
 * catch bar right, release and it falls back left. Keep the fish icon
 * inside the bar — progress fills while it's inside, drains while it's
 * out. Full bar = caught, empty = it escapes. ESC concedes the fish.
 *
 * Fish variety: 4 rarity tiers (weighted rolls, colored chips) + ACNH-style
 * availability windows — some species only bite at night / in daytime, the
 * catfish loves rain, and the Golden Koi's legendary odds double when it
 * rains. Rarity drives the minigame difficulty (fish speed, dart rate,
 * drain rate).
 *
 * A catch collects to member_collections — cosmetic only, no TC/XP
 * (principle #3). Kept entirely in the DOM: no R3F coupling; the reel loop
 * is a rAF writing styles through refs (zero React re-renders per frame).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { AudioManager } from "@/lib/game/audio";
import { getTodayWeather } from "@/lib/game/weather";
import { getLabHour } from "@/lib/game/devLab";

type Phase = "idle" | "casting" | "waiting" | "bite" | "reeling" | "caught" | "missed";

type Rarity = "common" | "uncommon" | "rare" | "legendary";

const RARITY_META: Record<Rarity, { label: string; color: string; weight: number }> = {
  common: { label: "Common", color: "#7C9A62", weight: 100 },
  uncommon: { label: "Uncommon", color: "#4A90D9", weight: 42 },
  rare: { label: "Rare", color: "#9B6DD6", weight: 15 },
  legendary: { label: "Legendary", color: "#E8A93C", weight: 5 },
};

interface FishDef {
  key: string;
  label: string; // "a Dace" — result copy
  name: string; // "Dace" — reel card
  model: string;
  rarity: Rarity;
  /** 0-1 → reel difficulty (fish speed, darts, drain). */
  diff: number;
  /** Availability gate; absent = always biting. Hour is 0-24 local. */
  when?: (hour: number, weather: string) => boolean;
}

// ACNH revamp 2026-07: species-true river catches (models shown in-world by
// FishCatchFX). Rarity + availability added with the reel minigame — new
// species are one row here + one in CollectionBook once their model/icon
// ships (the dump's Creatures/ set has more to extract).
const FISH: FishDef[] = [
  { key: "fish_dace", label: "a Dace", name: "Dace", model: "/assets/acnh/fish/dace.glb", rarity: "common", diff: 0.22 },
  { key: "fish_pale_chub", label: "a Pale Chub", name: "Pale Chub", model: "/assets/acnh/fish/pale-chub.glb", rarity: "common", diff: 0.25, when: (h) => h >= 6 && h < 18 },
  { key: "fish_pond_smelt", label: "a Pond Smelt", name: "Pond Smelt", model: "/assets/acnh/fish/pond-smelt.glb", rarity: "common", diff: 0.28 },
  { key: "fish_crucian_carp", label: "a Crucian Carp", name: "Crucian Carp", model: "/assets/acnh/fish/crucian-carp.glb", rarity: "common", diff: 0.3 },
  { key: "fish_bluegill", label: "a Bluegill", name: "Bluegill", model: "/assets/acnh/fish/bluegill.glb", rarity: "uncommon", diff: 0.38, when: (h) => h >= 9 && h < 16 },
  { key: "fish_goldfish", label: "a Goldfish", name: "Goldfish", model: "/assets/acnh/fish/goldfish.glb", rarity: "uncommon", diff: 0.42 },
  { key: "fish_carp", label: "a Carp", name: "Carp", model: "/assets/acnh/fish/carp.glb", rarity: "uncommon", diff: 0.45 },
  { key: "fish_black_bass", label: "a Black Bass", name: "Black Bass", model: "/assets/acnh/fish/black-bass.glb", rarity: "rare", diff: 0.58 },
  { key: "fish_catfish", label: "a Catfish", name: "Catfish", model: "/assets/acnh/fish/catfish.glb", rarity: "rare", diff: 0.62, when: (h, w) => h >= 20 || h < 4 || w === "rain" },
  { key: "fish_golden_koi", label: "a Golden Koi", name: "Golden Koi", model: "/assets/acnh/fish/koi.glb", rarity: "legendary", diff: 0.8 },
];

/** Weighted roll over the species available right now. */
function rollFish(): FishDef {
  const hour = getLabHour() ?? new Date().getHours() + new Date().getMinutes() / 60;
  const weather = getTodayWeather();
  const pool = FISH.filter((f) => !f.when || f.when(hour, weather));
  const weightOf = (f: FishDef) => {
    let w = RARITY_META[f.rarity].weight;
    if (f.key === "fish_golden_koi" && weather === "rain") w *= 2; // koi loves rain
    return w;
  };
  const total = pool.reduce((s, f) => s + weightOf(f), 0);
  let r = Math.random() * total;
  for (const f of pool) {
    r -= weightOf(f);
    if (r <= 0) return f;
  }
  return pool[pool.length - 1];
}

const BITE_WINDOW_MS = 1400;

// ─── Reel minigame tuning (track space is 0..1) ─────────────────────────────
const BAR_W = 0.25; // catch-bar width as a fraction of the track
const HOLD_ACCEL = 3.6; // hold LMB → push right
const GRAVITY = 3.1; // release → fall left
const DAMPING = 1.4; // exponential velocity damping /s
const EDGE_BOUNCE = 0.35; // left-edge elasticity (Stardew's bottom bounce)
const FILL_RATE = 0.26; // progress /s while the fish is inside the bar
const START_PROGRESS = 0.35;

export default function FishingOverlay() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [fish, setFish] = useState<FishDef | null>(null);
  const timersRef = useRef<number[]>([]);
  const biteDeadlineRef = useRef(0);

  const clearTimers = () => {
    timersRef.current.forEach((t) => window.clearTimeout(t));
    timersRef.current = [];
  };

  const cancel = () => {
    clearTimers();
    setPhase("idle");
    setFish(null);
  };

  const beginWait = () => {
    setPhase("waiting");
    const wait = 2000 + Math.random() * 4000;
    timersRef.current.push(
      window.setTimeout(() => {
        setPhase("bite");
        // G1 hit-confirmation: a 130ms screen nudge sells the bite. The
        // canvas transform is DOM-only — zero render cost.
        document.querySelector("canvas")?.animate(
          [
            { transform: "translate(0,0)" },
            { transform: "translate(3px,-2px)" },
            { transform: "translate(-3px,2px)" },
            { transform: "translate(2px,1px)" },
            { transform: "translate(0,0)" },
          ],
          { duration: 130 }
        );
        AudioManager.playSFX("confirm");
        biteDeadlineRef.current = performance.now() + BITE_WINDOW_MS;
        // Auto-miss if the window lapses.
        timersRef.current.push(
          window.setTimeout(() => {
            setPhase("missed");
            AudioManager.playSFX("exit");
            timersRef.current.push(window.setTimeout(cancel, 1800));
          }, BITE_WINDOW_MS)
        );
      }, wait)
    );
  };

  const start = () => {
    clearTimers();
    setFish(null);
    setPhase("casting");
    AudioManager.playSFX("click");
    timersRef.current.push(window.setTimeout(beginWait, 650));
  };

  /** Bite hooked (E or click) → roll the species, open the reel. */
  const hook = () => {
    if (phase !== "bite") return;
    if (performance.now() > biteDeadlineRef.current) return;
    clearTimers();
    setFish(rollFish());
    setPhase("reeling");
    AudioManager.playSFX("click");
  };

  /** Reel finished. Success → collect; fail → it got away. */
  const onReelDone = useCallback(
    (success: boolean) => {
      clearTimers();
      if (success && fish) {
        setPhase("caught");
        AudioManager.playSFX("confirm");
        // Signals the "catch a fish" onboarding quest (auto-complete).
        window.dispatchEvent(new CustomEvent("tsi:fish-caught", { detail: { key: fish.key, model: fish.model } }));
        fetch("/api/collections", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ item_key: fish.key }),
        }).catch(() => {});
        timersRef.current.push(window.setTimeout(cancel, 2600));
      } else {
        setPhase("missed");
        AudioManager.playSFX("exit");
        timersRef.current.push(window.setTimeout(cancel, 1800));
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fish]
  );

  // Start on the world event.
  useEffect(() => {
    const onStart = () => {
      // Ignore restart while a cast is live; a fresh start only from idle.
      setPhase((p) => (p === "idle" ? "casting" : p));
    };
    window.addEventListener("tsi:fish-start", onStart);
    return () => window.removeEventListener("tsi:fish-start", onStart);
  }, []);

  // When phase flips to "casting" via the event, run the cast sequence once.
  const startedRef = useRef(false);
  useEffect(() => {
    if (phase === "casting" && !startedRef.current) {
      startedRef.current = true;
      start();
    }
    if (phase === "idle") startedRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // Keyboard: E hooks during bite, ESC cancels (the reel handles its own
  // input + ESC-concede). Capture so the world's E handler doesn't also
  // fire while fishing.
  useEffect(() => {
    if (phase === "idle" || phase === "reeling") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "e" || e.key === "E") {
        e.preventDefault();
        e.stopPropagation();
        hook();
      } else if (e.key === "Escape") {
        cancel();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // Left-click also hooks the bite (mouse-first flow into the hold-to-reel).
  // Capture + stop so the ground click-to-move underneath never fires.
  useEffect(() => {
    if (phase !== "bite") return;
    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      hook();
    };
    window.addEventListener("pointerdown", onDown, true);
    return () => window.removeEventListener("pointerdown", onDown, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  useEffect(() => () => clearTimers(), []);

  if (phase === "idle") return null;

  const label =
    phase === "casting"
      ? "Casting…"
      : phase === "waiting"
        ? "Waiting for a bite…"
        : phase === "bite"
          ? "!!  Hook it!"
          : phase === "caught"
            ? `You caught ${fish?.label ?? "a fish"}!`
            : "It got away…";
  const icon = phase === "caught" && fish ? `/assets/acnh/icons/${fish.key}.png` : null;
  const rarity = fish ? RARITY_META[fish.rarity] : null;

  const accent = phase === "bite" ? "#E5484D" : phase === "caught" ? "#3D8F52" : "#4A4034";

  return (
    <div
      style={{
        position: "fixed",
        left: "50%",
        bottom: 120,
        transform: "translateX(-50%)",
        zIndex: 60,
        pointerEvents: "none",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
      }}
    >
      {phase === "reeling" && fish ? (
        <ReelMinigame fish={fish} onDone={onReelDone} />
      ) : (
        <div
          style={{
            padding: "10px 20px",
            background: "#FFFDF5",
            color: accent,
            border: `2px solid ${phase === "bite" ? "#E5484D" : "#E8DFC8"}`,
            borderRadius: 14,
            fontFamily: "var(--font-highlight, sans-serif)",
            fontSize: 15,
            fontWeight: 600,
            whiteSpace: "nowrap",
            boxShadow: "0 4px 14px rgba(60, 45, 20, 0.2)",
            animation: phase === "bite" ? "fish-pulse 0.4s ease-in-out infinite" : undefined,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          {icon && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={icon} alt="" width={26} height={26} style={{ margin: "-4px 0" }} />
          )}
          {label}
          {phase === "caught" && rarity && (
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: "#FFFDF5",
                background: rarity.color,
                borderRadius: 999,
                padding: "3px 8px",
              }}
            >
              {rarity.label}
            </span>
          )}
        </div>
      )}
      {(phase === "waiting" || phase === "bite" || phase === "casting") && (
        <div
          style={{
            fontFamily: "var(--font-highlight, sans-serif)",
            fontSize: 11,
            color: "rgba(255,255,255,0.7)",
            textShadow: "0 1px 3px rgba(0,0,0,0.5)",
          }}
        >
          ESC to reel in
        </div>
      )}
      <style>{`
        @keyframes fish-pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.08); }
        }
      `}</style>
    </div>
  );
}

// ─── The Stardew reel, horizontal (2026-07-22) ──────────────────────────────
//
// Physics + fish AI run in one rAF; every frame writes styles through refs
// (no React re-renders). Track space is 0..1 left→right.
//
//   bar:  hold → accelerate right; release → gravity pulls left; damped;
//         bounces softly off the left edge, clamps at the right.
//   fish: eases toward a target, retargets on a rarity-scaled timer, and
//         darts (far target, 2.4× speed) more often at higher difficulty.
//   progress: fills while the fish icon sits inside the bar, drains outside
//         (drain scales with difficulty). Full = caught, empty = escaped.

function ReelMinigame({ fish, onDone }: { fish: FishDef; onDone: (success: boolean) => void }) {
  const barRef = useRef<HTMLDivElement>(null);
  const fishRef = useRef<HTMLImageElement>(null);
  const progRef = useRef<HTMLDivElement>(null);
  const holdingRef = useRef(false);
  const doneRef = useRef(false);

  const rarity = RARITY_META[fish.rarity];

  // Difficulty-derived fish behavior.
  const fishSpeed = 0.16 + 0.42 * fish.diff; // track/s
  const retargetMs = 1700 - 1000 * fish.diff;
  const dartChance = 0.12 + 0.55 * fish.diff;
  const drainRate = 0.17 + 0.09 * fish.diff;

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let pos = 0; // bar left edge 0..1-BAR_W
    let vel = 0;
    // Fish spawns near the resting bar (Stardew spawns near the bottom) so
    // the opening moment is winnable, then wanders out.
    let fishPos = 0.15;
    let fishTarget = 0.4;
    let speedMul = 1;
    let retargetAt = last + 600;
    let progress = START_PROGRESS;

    const finish = (success: boolean) => {
      if (doneRef.current) return;
      doneRef.current = true;
      cancelAnimationFrame(raf);
      onDone(success);
    };

    const step = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;

      // Bar physics
      vel += (holdingRef.current ? HOLD_ACCEL : -GRAVITY) * dt;
      vel *= Math.exp(-DAMPING * dt);
      pos += vel * dt;
      if (pos < 0) {
        pos = 0;
        vel = Math.abs(vel) < 0.12 ? 0 : -vel * EDGE_BOUNCE;
      } else if (pos > 1 - BAR_W) {
        pos = 1 - BAR_W;
        vel = 0;
      }

      // Fish AI
      if (now >= retargetAt) {
        const dart = Math.random() < dartChance;
        fishTarget = Math.random();
        speedMul = dart ? 2.4 : 1;
        retargetAt = now + retargetMs * (0.6 + 0.8 * Math.random());
      }
      const delta = fishTarget - fishPos;
      const stepLen = fishSpeed * speedMul * dt;
      if (Math.abs(delta) <= stepLen) {
        fishPos = fishTarget;
        speedMul = 1;
      } else {
        fishPos += Math.sign(delta) * stepLen;
      }

      // Progress
      const inside = fishPos >= pos - 0.015 && fishPos <= pos + BAR_W + 0.015;
      progress += (inside ? FILL_RATE : -drainRate) * dt;
      if (progress >= 1) return finish(true);
      if (progress <= 0) return finish(false);

      // DOM writes
      if (barRef.current) {
        barRef.current.style.left = `${pos * 100}%`;
        barRef.current.style.background = inside ? "rgba(61, 143, 82, 0.55)" : "rgba(61, 143, 82, 0.3)";
      }
      if (fishRef.current) {
        const wobble = Math.sin(now / 130) * 3;
        fishRef.current.style.left = `${fishPos * 100}%`;
        fishRef.current.style.transform = `translate(-50%, calc(-50% + ${wobble}px))`;
      }
      if (progRef.current) {
        progRef.current.style.width = `${progress * 100}%`;
        progRef.current.style.background = progress < 0.25 ? "#E5484D" : "#FFD166";
      }

      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);

    // Input: hold LMB anywhere (capture: the world's click-to-move must not
    // fire), or hold E / Space. Touch works via Pointer Events (mobile-aware).
    const down = (e: PointerEvent) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      holdingRef.current = true;
    };
    const up = () => {
      holdingRef.current = false;
    };
    const keyDown = (e: KeyboardEvent) => {
      if (e.key === "e" || e.key === "E" || e.key === " ") {
        e.preventDefault();
        e.stopPropagation();
        holdingRef.current = true;
      } else if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        finish(false); // concede — it swims off
      }
    };
    const keyUp = (e: KeyboardEvent) => {
      if (e.key === "e" || e.key === "E" || e.key === " ") holdingRef.current = false;
    };
    window.addEventListener("pointerdown", down, true);
    window.addEventListener("pointerup", up, true);
    window.addEventListener("pointercancel", up, true);
    window.addEventListener("keydown", keyDown, true);
    window.addEventListener("keyup", keyUp, true);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointerdown", down, true);
      window.removeEventListener("pointerup", up, true);
      window.removeEventListener("pointercancel", up, true);
      window.removeEventListener("keydown", keyDown, true);
      window.removeEventListener("keyup", keyUp, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      style={{
        width: "min(560px, 86vw)",
        padding: "12px 14px 10px",
        background: "#FFFDF5",
        border: "2px solid #E8DFC8",
        borderRadius: 14,
        boxShadow: "0 4px 14px rgba(60, 45, 20, 0.2)",
        fontFamily: "var(--font-highlight, sans-serif)",
        pointerEvents: "auto",
        userSelect: "none",
        touchAction: "none",
      }}
    >
      {/* Header: species + rarity chip + hint */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: "#4A4034" }}>{fish.name}</span>
        <span
          style={{
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: "#FFFDF5",
            background: rarity.color,
            borderRadius: 999,
            padding: "2px 7px",
          }}
        >
          {rarity.label}
        </span>
        <span style={{ marginLeft: "auto", fontSize: 10, color: "#8a7f6a" }}>
          hold left-click to push the bar →
        </span>
      </div>

      {/* Horizontal water track */}
      <div
        style={{
          position: "relative",
          height: 46,
          borderRadius: 10,
          background: "linear-gradient(180deg, #BFE9FA 0%, #9ED7F2 70%, #8ECBEC 100%)",
          boxShadow: "inset 0 2px 6px rgba(30, 80, 120, 0.25)",
          overflow: "hidden",
        }}
      >
        {/* Catch bar */}
        <div
          ref={barRef}
          style={{
            position: "absolute",
            top: 3,
            bottom: 3,
            left: 0,
            width: `${BAR_W * 100}%`,
            borderRadius: 8,
            background: "rgba(61, 143, 82, 0.3)",
            border: "2px solid #3D8F52",
          }}
        />
        {/* Fish icon riding the track */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={fishRef}
          src={`/assets/acnh/icons/${fish.key}.png`}
          alt=""
          width={30}
          height={30}
          draggable={false}
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            filter: "drop-shadow(0 2px 3px rgba(20, 60, 90, 0.4))",
            pointerEvents: "none",
          }}
        />
      </div>

      {/* Progress */}
      <div
        style={{
          marginTop: 8,
          height: 8,
          borderRadius: 999,
          background: "rgba(74, 64, 52, 0.15)",
          overflow: "hidden",
        }}
      >
        <div
          ref={progRef}
          style={{
            height: "100%",
            width: `${START_PROGRESS * 100}%`,
            borderRadius: 999,
            background: "#FFD166",
            transition: "background 0.2s",
          }}
        />
      </div>
    </div>
  );
}
