"use client";

/**
 * FishingOverlay (cozy marathon G5; reel minigame + refinement round
 * 2026-07-22). Fish data / rarity rules / reel tuning live in
 * `lib/game/fishing.ts` — shared with the /lab/fishing bench.
 *
 * DOM overlay (outside the Canvas, alongside the emote menu). Listens for
 * `tsi:fish-start` from GameWorld's E handler when the player is at a
 * riverbank spot, then runs a self-contained state machine:
 *
 *   casting → waiting (2-6s) → bite (1.4s window) → REELING → result
 *
 * Hook the bite with E or left-click, then the Stardew-style reel runs: a
 * HORIZONTAL water track, hold left-click (or E/Space) to push the catch
 * bar right, release and it falls back left. Keep the fish icon inside the
 * bar — progress fills inside, drains outside. Full = caught, empty = it
 * escapes. ESC concedes.
 *
 * Rarity is never announced during the fight; first-time species show as
 * "???" with a blacked-out silhouette. The catch card does the reveal:
 * name + size + rarity chip + NEW! badge, with tier-scaled celebration.
 *
 * A catch collects to member_collections — cosmetic only, no TC/XP
 * (principle #3). The reel loop is a rAF writing styles through refs (zero
 * React re-renders per frame).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { AudioManager } from "@/lib/game/audio";
import {
  CELEBRATE,
  DAMPING,
  EDGE_BOUNCE,
  FILL_RATE,
  GRAVITY,
  HOLD_ACCEL,
  RARITY_META,
  START_PROGRESS,
  celebrate,
  rollFish,
  rollSize,
  type FishDef,
} from "@/lib/game/fishing";

type Phase = "idle" | "casting" | "waiting" | "bite" | "reeling" | "caught" | "missed";

const BITE_WINDOW_MS = 1400;

export default function FishingOverlay() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [fish, setFish] = useState<FishDef | null>(null);
  const [caughtSize, setCaughtSize] = useState<number | null>(null);
  const [wasNew, setWasNew] = useState(false);
  const timersRef = useRef<number[]>([]);
  const biteDeadlineRef = useRef(0);
  // Species the member already has — drives the ???-silhouette mystery.
  // Fails closed to "everything is new" (mystery is the better default).
  const ownedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    fetch("/api/collections")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.collections) {
          ownedRef.current = new Set(
            (d.collections as { item_key: string }[]).map((c) => c.item_key)
          );
        }
      })
      .catch(() => {});
  }, []);

  const clearTimers = () => {
    timersRef.current.forEach((t) => window.clearTimeout(t));
    timersRef.current = [];
  };

  const cancel = () => {
    clearTimers();
    setPhase("idle");
    setFish(null);
    setCaughtSize(null);
    setWasNew(false);
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
    setCaughtSize(null);
    setWasNew(false);
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

  /** Reel finished. Success → collect + celebrate; fail → it got away. */
  const onReelDone = useCallback(
    (success: boolean) => {
      clearTimers();
      if (success && fish) {
        const isNew = !ownedRef.current.has(fish.key);
        ownedRef.current.add(fish.key);
        setWasNew(isNew);
        setCaughtSize(rollSize(fish.sizeCm));
        setPhase("caught");
        AudioManager.playSFX("confirm");
        celebrate(fish.rarity, RARITY_META[fish.rarity].color);
        // Signals the "catch a fish" onboarding quest (auto-complete).
        window.dispatchEvent(new CustomEvent("tsi:fish-caught", { detail: { key: fish.key, model: fish.model } }));
        fetch("/api/collections", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ item_key: fish.key }),
        }).catch(() => {});
        timersRef.current.push(window.setTimeout(cancel, CELEBRATE[fish.rarity].cardMs));
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
  // Capture + stop so nothing underneath fires.
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
          ? "!!  Hook it!"
          : phase === "caught"
            ? `You caught ${fish?.label ?? "a fish"}!`
            : "It got away…";
  const icon = phase === "caught" && fish ? `/assets/acnh/icons/${fish.key}.png` : null;
  const rarity = fish ? RARITY_META[fish.rarity] : null;
  const glow = phase === "caught" && fish ? CELEBRATE[fish.rarity].glow : false;

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
        <ReelMinigame fish={fish} known={ownedRef.current.has(fish.key)} onDone={onReelDone} />
      ) : (
        <div
          style={{
            padding: "10px 20px",
            background: "#FFFDF5",
            color: accent,
            border: glow ? `2px solid ${rarity!.color}` : `2px solid ${phase === "bite" ? "#E5484D" : "#E8DFC8"}`,
            borderRadius: 14,
            fontFamily: "var(--font-highlight, sans-serif)",
            fontSize: 15,
            fontWeight: 600,
            whiteSpace: "nowrap",
            boxShadow: glow
              ? `0 4px 24px ${rarity!.color}88, 0 0 0 4px ${rarity!.color}33`
              : "0 4px 14px rgba(60, 45, 20, 0.2)",
            animation:
              phase === "bite"
                ? "fish-pulse 0.4s ease-in-out infinite"
                : phase === "caught"
                  ? "fish-card-pop 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)"
                  : undefined,
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
          {phase === "caught" && caughtSize !== null && (
            <span style={{ fontSize: 12, color: "#8a7f6a", fontWeight: 600 }}>{caughtSize} cm</span>
          )}
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
          {phase === "caught" && wasNew && (
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.06em",
                color: "#1A1410",
                background: "#FFD166",
                borderRadius: 999,
                padding: "3px 8px",
              }}
            >
              NEW!
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
        @keyframes fish-card-pop {
          0% { transform: scale(0.6); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

// ─── The Stardew reel, horizontal ───────────────────────────────────────────
//
// Exported for /lab/fishing (the bench mounts it directly against any
// species). Physics + fish AI run in one rAF; every frame writes styles
// through refs (no React re-renders). Track space is 0..1 left→right.
//
//   bar:  hold → accelerate right; release → gravity pulls left; damped;
//         bounces softly off the left edge, clamps at the right. Width comes
//         from the fish's rarity tier (commons are forgiving).
//   fish: velocity-seeks its target using the species' own move fields
//         (speed/accel/jitter/darts/retarget) — every fish fights its own way.
//   progress: fills while the fish sits inside the bar, drains outside;
//         full = caught, empty = escaped.
//
// Mystery: unknown species show "???" + a blacked-out silhouette; rarity is
// never shown during the fight (reveal happens on the catch card).

export function ReelMinigame({
  fish,
  known,
  onDone,
}: {
  fish: FishDef;
  known: boolean;
  onDone: (success: boolean) => void;
}) {
  const barRef = useRef<HTMLDivElement>(null);
  const fishRef = useRef<HTMLImageElement>(null);
  const progRef = useRef<HTMLDivElement>(null);
  const holdingRef = useRef(false);
  const doneRef = useRef(false);

  const barW = RARITY_META[fish.rarity].barW;
  const drainRate = 0.17 + 0.09 * (1 - barW / 0.3); // narrower bar ⇒ faster drain

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let pos = 0; // bar left edge 0..1-barW
    let vel = 0;
    // Fish spawns near the resting bar (Stardew's bottom spawn) so the
    // opening moment is winnable, then wanders out.
    let fishPos = 0.15;
    let fishVel = 0;
    let fishTarget = 0.4;
    let mul = 1;
    let retargetAt = last + 600;
    let progress = START_PROGRESS;
    const m = fish.move;

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
      } else if (pos > 1 - barW) {
        pos = 1 - barW;
        vel = 0;
      }

      // Fish AI — velocity-seek with per-species personality.
      if (now >= retargetAt) {
        const dart = Math.random() < m.dartChance;
        fishTarget = Math.random();
        mul = dart ? m.dartMul : 1;
        retargetAt = now + m.retargetMs * (0.6 + 0.8 * Math.random());
      }
      const delta = fishTarget - fishPos;
      const maxV = m.speed * mul;
      fishVel += Math.sign(delta) * m.accel * mul * dt;
      if (Math.abs(delta) < 0.04) fishVel *= Math.exp(-6 * dt); // arrive
      fishVel = Math.max(-maxV, Math.min(maxV, fishVel));
      fishPos += fishVel * dt + Math.sin(now / 90) * m.jitter;
      if (fishPos < 0) { fishPos = 0; fishVel = 0; }
      else if (fishPos > 1) { fishPos = 1; fishVel = 0; }

      // Progress
      const inside = fishPos >= pos - 0.015 && fishPos <= pos + barW + 0.015;
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

    // Input: hold LMB anywhere (capture: the world's handlers must not
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
      {/* Header: species (or ??? for unknowns — rarity is never shown here) */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: "#4A4034" }}>
          {known ? fish.name : "???"}
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
        {/* Catch bar — width from rarity tier */}
        <div
          ref={barRef}
          style={{
            position: "absolute",
            top: 3,
            bottom: 3,
            left: 0,
            width: `${barW * 100}%`,
            borderRadius: 8,
            background: "rgba(61, 143, 82, 0.3)",
            border: "2px solid #3D8F52",
          }}
        />
        {/* Fish icon riding the track — silhouetted until first caught */}
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
            filter: known
              ? "drop-shadow(0 2px 3px rgba(20, 60, 90, 0.4))"
              : "brightness(0) opacity(0.75) drop-shadow(0 2px 3px rgba(20, 60, 90, 0.4))",
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
