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
import FishReveal from "./FishReveal";
import { AudioManager } from "@/lib/game/audio";
import { collect } from "@/lib/game/collections";
import { punchZoom, setTensionZoom } from "@/lib/game/cameraJuice";
import { coastDist } from "@/lib/game/coast";
import {
  CAST,
  CELEBRATE,
  DAMPING,
  EDGE_BOUNCE,
  FILL_RATE,
  GRAVITY,
  HOLD_ACCEL,
  HOLO_GRADIENT,
  RARITY_META,
  START_PROGRESS,
  celebrate,
  rollFish,
  rollSize,
  type FishDef,
  iconFor,
} from "@/lib/game/fishing";

type Phase = "idle" | "charging" | "casting" | "waiting" | "bite" | "reeling" | "revealing" | "caught" | "missed";

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
  // Cast meter (David 2026-07-23): hold E → ping-pong power bar, release
  // at the tip = MAX CAST. Power scales luck AND bite timing.
  const powerRef = useRef(0);
  const [maxCast, setMaxCast] = useState(false);
  // Fishing spot from the world's E handler — the bobber lands relative to it.
  const spotRef = useRef<{ x: number; z: number } | null>(null);

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
    setMaxCast(false);
    powerRef.current = 0;
    setTensionZoom(0);
    window.dispatchEvent(new CustomEvent("tsi:fish-end"));
  };

  const beginWait = () => {
    setPhase("waiting");
    // Cast power shortens the wait (max cast halves it).
    const wait = (2000 + Math.random() * 4000) * (1 - CAST.waitScale * powerRef.current);
    // Fake nibbles (refinement 2026-07-23): 1-2 false-alarm tugs, never in
    // the last 1.2s before the real bite. Bobber dips + ripple + soft blip.
    if (wait > 2600) {
      const count = Math.random() < 0.7 ? 1 : 2;
      for (let i = 0; i < count; i++) {
        const at = wait * 0.25 + Math.random() * (wait - 1200 - wait * 0.25);
        timersRef.current.push(
          window.setTimeout(() => {
            window.dispatchEvent(new CustomEvent("tsi:fish-nibble"));
            document.querySelector("canvas")?.animate(
              [{ transform: "translate(0,0)" }, { transform: "translate(1.5px,1px)" }, { transform: "translate(0,0)" }],
              { duration: 90 }
            );
          }, at)
        );
      }
    }
    timersRef.current.push(
      window.setTimeout(() => {
        setPhase("bite");
        punchZoom(3); // micro-zoom: the strike
        window.dispatchEvent(new CustomEvent("tsi:fish-bite")); // bobber slam + "!"
        // G1 hit-confirmation: a 130ms screen nudge sells the bite. The
        // canvas transform is DOM-only — zero render cost.
        document.querySelector("canvas")?.animate(
          [
            { transform: "translate(0,0)" },
            { transform: "translate(5px,-3px)" },
            { transform: "translate(-5px,3px)" },
            { transform: "translate(3px,2px)" },
            { transform: "translate(0,0)" },
          ],
          { duration: 150 }
        );
        AudioManager.playSFX("confirm");
        // Cast power widens the hook window (max cast: 1.4s → 2.2s).
        const windowMs = BITE_WINDOW_MS + CAST.biteBonusMs * powerRef.current;
        biteDeadlineRef.current = performance.now() + windowMs;
        // Auto-miss if the window lapses.
        timersRef.current.push(
          window.setTimeout(() => {
            setPhase("missed");
            AudioManager.playSFX("exit");
            timersRef.current.push(window.setTimeout(cancel, 1800));
          }, windowMs)
        );
      }, wait)
    );
  };

  /** Meter released → actually cast, with power locked in. */
  const castNow = (power: number) => {
    clearTimers();
    setFish(null);
    setCaughtSize(null);
    setWasNew(false);
    powerRef.current = power;
    const isMax = power >= CAST.maxZone;
    setMaxCast(isMax);
    if (isMax) {
      punchZoom(2.5); // micro-zoom: nailed the tip
      AudioManager.playSFX("confirm");
    } else {
      AudioManager.playSFX("click");
    }
    setPhase("casting");
    const spot = spotRef.current ?? { x: 0, z: 0 };
    window.dispatchEvent(new CustomEvent("tsi:fish-cast", { detail: { x: spot.x, z: spot.z, power } }));
    timersRef.current.push(window.setTimeout(beginWait, 650));
  };

  /** Bite hooked (E or click) → roll the species, open the reel. */
  const hook = () => {
    if (phase !== "bite") return;
    if (performance.now() > biteDeadlineRef.current) return;
    clearTimers();
    const luck = powerRef.current + (powerRef.current >= CAST.maxZone ? CAST.maxBonus : 0);
    // Sea spots (deck + cove, out past the sand line) roll the SEA pool.
    const sp = spotRef.current;
    const zone: "river" | "sea" = sp && coastDist(sp.x, sp.z) > 47 ? "sea" : "river";
    setFish(rollFish(luck, zone));
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
        // Signals the "catch a fish" onboarding quest (auto-complete).
        window.dispatchEvent(new CustomEvent("tsi:fish-caught", { detail: { key: fish.key, model: fish.model, raw: fish.raw } }));
        collect(fish.key);
        if (isNew) {
          // Blind-box ceremony (David 2026-07-23): first catches get the
          // fullscreen staged reveal — it owns the celebration (confetti
          // fires at its flash) and dismisses back to idle.
          setPhase("revealing");
          AudioManager.playSFX("click");
        } else {
          // Repeats keep the quick card + tier confetti.
          setPhase("caught");
          AudioManager.playSFX("confirm");
          celebrate(fish.rarity, RARITY_META[fish.rarity].color);
          timersRef.current.push(window.setTimeout(cancel, CELEBRATE[fish.rarity].cardMs));
        }
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
    const onStart = (e: Event) => {
      const d = (e as CustomEvent<{ x: number; z: number }>).detail;
      if (d && typeof d.x === "number") spotRef.current = { x: d.x, z: d.z };
      // Ignore restart while a cast is live; a fresh start only from idle.
      // Charging first: the world E keydown opens the meter, keyup casts.
      setPhase((p) => (p === "idle" ? "charging" : p));
    };
    window.addEventListener("tsi:fish-start", onStart);
    return () => window.removeEventListener("tsi:fish-start", onStart);
  }, []);

  // Keyboard: E hooks during bite, ESC cancels (the reel and the reveal
  // each handle their own input). Capture so the world's E handler doesn't
  // also fire while fishing.
  useEffect(() => {
    if (phase === "idle" || phase === "reeling" || phase === "revealing") return;
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

  // First-catch blind-box ceremony — fullscreen, replaces the bottom card.
  if (phase === "revealing" && fish && caughtSize !== null) {
    return <FishReveal fish={fish} sizeCm={caughtSize} onDone={cancel} />;
  }

  const label =
    phase === "casting"
      ? maxCast
        ? "MAX CAST!!"
        : "Casting…"
      : phase === "waiting"
        ? "Waiting for a bite…"
        : phase === "bite"
          ? "!!  Hook it!"
          : phase === "caught"
            ? `You caught ${fish?.label ?? "a fish"}!`
            : "It got away…";
  const icon = phase === "caught" && fish ? iconFor(fish) : null;
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
      {phase === "charging" ? (
        <CastMeter onRelease={castNow} />
      ) : phase === "reeling" && fish ? (
        <ReelMinigame fish={fish} known={ownedRef.current.has(fish.key)} onDone={onReelDone} />
      ) : (
        <div
          style={{
            padding: "10px 20px",
            background: "#FFFDF5",
            color: accent,
            border: glow
              ? `2px solid ${rarity!.color}`
              : `2px solid ${phase === "bite" ? "#E5484D" : phase === "casting" && maxCast ? "#FFD166" : "#E8DFC8"}`,
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
                  ? fish?.rarity === "seaking"
                    ? "fish-card-pop 0.35s cubic-bezier(0.34, 1.56, 0.64, 1), tsi-holo-glow 2.4s linear infinite"
                    : "fish-card-pop 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)"
                  : phase === "missed"
                    ? "fish-escape-jolt 0.38s ease-out"
                    : undefined,
            position: "relative",
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
                borderRadius: 999,
                padding: "3px 8px",
                // Sea King is holographic (David 2026-07-23): animated
                // iridescent gradient + shine sweep instead of flat teal.
                ...(fish?.rarity === "seaking"
                  ? {
                      background: HOLO_GRADIENT,
                      backgroundSize: "300% 100%",
                      animation: "tsi-holo-shift 2.2s linear infinite",
                      textShadow: "0 1px 2px rgba(20, 40, 60, 0.45)",
                      boxShadow: "0 0 12px rgba(122, 231, 255, 0.75)",
                    }
                  : { background: rarity.color }),
              }}
            >
              {rarity.label}
            </span>
          )}
          {phase === "missed" && fish && (
            // The one that got away — silhouette leaps off the card and dives.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={iconFor(fish)}
              alt=""
              width={26}
              height={26}
              style={{
                position: "absolute",
                right: -6,
                top: -10,
                filter: "brightness(0) opacity(0.7)",
                animation: "fish-flee 0.8s ease-in forwards",
                pointerEvents: "none",
              }}
            />
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
      {phase === "charging" && (
        <div
          style={{
            fontFamily: "var(--font-highlight, sans-serif)",
            fontSize: 11,
            color: "rgba(255,255,255,0.7)",
            textShadow: "0 1px 3px rgba(0,0,0,0.5)",
          }}
        >
          release E at the tip for MAX CAST
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
        @keyframes fish-escape-jolt {
          0% { transform: translateX(0) rotate(0deg); }
          25% { transform: translateX(-7px) rotate(-2deg); }
          55% { transform: translateX(5px) rotate(1.5deg); }
          100% { transform: translateX(0) rotate(0deg); }
        }
        @keyframes fish-flee {
          0% { transform: translate(0, 0) rotate(0deg) scaleX(-1); opacity: 0.85; }
          45% { transform: translate(46px, -46px) rotate(28deg) scaleX(-1); opacity: 0.85; }
          100% { transform: translate(110px, 40px) rotate(80deg) scaleX(-1); opacity: 0; }
        }
        @keyframes tsi-holo-shift {
          0% { background-position: 0% 50%; }
          100% { background-position: 300% 50%; }
        }
        @keyframes tsi-holo-glow {
          0%, 100% { box-shadow: 0 4px 26px rgba(94, 231, 247, 0.65), 0 0 0 4px rgba(94, 231, 247, 0.28); }
          25% { box-shadow: 0 4px 26px rgba(181, 122, 255, 0.65), 0 0 0 4px rgba(181, 122, 255, 0.28); }
          50% { box-shadow: 0 4px 26px rgba(255, 122, 217, 0.65), 0 0 0 4px rgba(255, 122, 217, 0.28); }
          75% { box-shadow: 0 4px 26px rgba(125, 255, 196, 0.65), 0 0 0 4px rgba(125, 255, 196, 0.28); }
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
  const trackRef = useRef<HTMLDivElement>(null);
  const holdingRef = useRef(false);
  const doneRef = useRef(false);
  const lastThunkRef = useRef(0);

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
    let tension = 0; // micro-zoom creep while the fish sits in the bar
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
        if (Math.abs(vel) < 0.12) {
          vel = 0;
        } else {
          vel = -vel * EDGE_BOUNCE;
          // Feedback kit: soft thunk when the bar slams the left wall.
          if (now - lastThunkRef.current > 250) {
            lastThunkRef.current = now;
            AudioManager.playSFX("blip3");
            if (barRef.current) {
              barRef.current.animate(
                [{ boxShadow: "0 0 0 0 rgba(61,143,82,0)" }, { boxShadow: "0 0 10px 2px rgba(61,143,82,0.8)" }, { boxShadow: "0 0 0 0 rgba(61,143,82,0)" }],
                { duration: 200 }
              );
            }
          }
        }
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
        // Feedback kit: darting fish sprays droplets on the track.
        if (dart && trackRef.current) {
          for (let i = 0; i < 3; i++) {
            const drop = document.createElement("span");
            drop.style.cssText = `position:absolute;left:${fishPos * 100}%;top:50%;width:5px;height:5px;border-radius:50%;background:#EAF6FF;pointer-events:none;--dx:${(Math.random() * 2 - 1) * 26}px;animation:reel-droplet 0.45s ease-out forwards;animation-delay:${i * 40}ms;`;
            trackRef.current.appendChild(drop);
            window.setTimeout(() => drop.remove(), 600);
          }
        }
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

      // Mid-reel tension micro-zoom: creeps in while the fish is held,
      // releases fast when it escapes the bar.
      tension = inside ? Math.min(1, tension + dt / 1.2) : Math.max(0, tension - dt / 0.5);
      setTensionZoom(tension);

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
        // Feedback kit: heartbeat pulse as the catch gets close — faster
        // the closer you are.
        const beat = progress > 0.75 ? `reel-heartbeat ${(1.35 - progress).toFixed(2)}s ease-in-out infinite` : "";
        if (progRef.current.style.animation !== beat) progRef.current.style.animation = beat;
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
      setTensionZoom(0);
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
        animation: "reel-slap-in 0.22s cubic-bezier(0.34, 1.56, 0.64, 1)",
      }}
    >
      <style>{`
        @keyframes reel-slap-in {
          0% { transform: scale(0.7); opacity: 0; }
          70% { transform: scale(1.05); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes reel-droplet {
          0% { transform: translate(-50%, -50%); opacity: 0.95; }
          100% { transform: translate(calc(-50% + var(--dx)), -26px); opacity: 0; }
        }
        @keyframes reel-heartbeat {
          0%, 100% { box-shadow: 0 0 0 0 rgba(255, 209, 102, 0); }
          50% { box-shadow: 0 0 10px 2px rgba(255, 209, 102, 0.85); }
        }
      `}</style>
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
        ref={trackRef}
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
          src={iconFor(fish)}
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

// ─── Cast meter (David 2026-07-23) ──────────────────────────────────────────
//
// Hold E at a fishing spot → this vertical power bar ping-pongs bottom↔top
// (~1.15s cycle). Release E (or the pointer) to cast with the bar's power:
// release inside the gold tip zone = MAX CAST (luck bonus + faster bite +
// wider hook window — see CAST in lib/game/fishing.ts). rAF + refs, zero
// re-renders per frame; ESC cancels via the parent's key handler.

function CastMeter({ onRelease }: { onRelease: (power: number) => void }) {
  const fillRef = useRef<HTMLDivElement>(null);
  const readoutRef = useRef<HTMLDivElement>(null);
  const pRef = useRef(0);
  const releasedRef = useRef(false);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    // Escalating difficulty (refinement 2026-07-23): the first bounce is a
    // slow 1.4s, then each completed cycle speeds up 15% (cap ~2.2×) — an
    // easy first pass, greedy re-tries get punished.
    let vt = 0;
    let speedMul = 1;
    let lastCycle = 0;
    const step = (now: number) => {
      const dt = now - last;
      last = now;
      vt += dt * speedMul;
      const cycleIdx = Math.floor(vt / CAST.cycleMs);
      if (cycleIdx > lastCycle) {
        lastCycle = cycleIdx;
        speedMul = Math.min(2.2, speedMul * 1.15);
      }
      // Triangle wave 0→1→0 over CAST.cycleMs of virtual time.
      const cyc = (vt % CAST.cycleMs) / CAST.cycleMs; // 0..1
      const p = cyc < 0.5 ? cyc * 2 : (1 - cyc) * 2;
      pRef.current = p;
      const inTip = p >= CAST.maxZone;
      if (fillRef.current) {
        fillRef.current.style.height = `${p * 100}%`;
        fillRef.current.style.background = inTip
          ? "linear-gradient(180deg, #FFD166, #E8A93C)"
          : "linear-gradient(180deg, #7EC850, #3D8F52)";
        fillRef.current.style.boxShadow = inTip ? "0 0 12px rgba(255, 209, 102, 0.9)" : "none";
      }
      if (readoutRef.current) {
        readoutRef.current.textContent = inTip ? "MAX!" : `${Math.round(p * 100)}%`;
        readoutRef.current.style.color = inTip ? "#FFD166" : "#FFFDF5";
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);

    const release = () => {
      if (releasedRef.current) return;
      releasedRef.current = true;
      cancelAnimationFrame(raf);
      onRelease(pRef.current);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === "e" || e.key === "E") release();
    };
    const onPointerUp = () => release();
    window.addEventListener("keyup", onKeyUp, true);
    window.addEventListener("pointerup", onPointerUp, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keyup", onKeyUp, true);
      window.removeEventListener("pointerup", onPointerUp, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        gap: 10,
        padding: "12px 14px",
        background: "#FFFDF5",
        border: "2px solid #E8DFC8",
        borderRadius: 14,
        boxShadow: "0 4px 14px rgba(60, 45, 20, 0.2)",
        pointerEvents: "auto",
        userSelect: "none",
      }}
    >
      {/* Vertical track */}
      <div
        style={{
          position: "relative",
          width: 20,
          height: 170,
          borderRadius: 10,
          background: "linear-gradient(180deg, #E8DFC8 0%, #D8CFB8 100%)",
          boxShadow: "inset 0 2px 5px rgba(60, 45, 20, 0.25)",
          overflow: "hidden",
        }}
      >
        {/* Gold tip zone */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: `${(1 - CAST.maxZone) * 100}%`,
            background: "rgba(255, 209, 102, 0.55)",
            borderBottom: "2px solid #E8A93C",
          }}
        />
        {/* Fill (bottom-up) */}
        <div
          ref={fillRef}
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: "0%",
            borderRadius: "0 0 10px 10px",
          }}
        />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, paddingBottom: 4 }}>
        <div
          ref={readoutRef}
          style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 15,
            fontWeight: 800,
            color: "#FFFDF5",
            textShadow: "0 1px 3px rgba(60,45,20,0.5)",
            minWidth: 52,
          }}
        >
          0%
        </div>
        <div style={{ fontFamily: "var(--font-highlight, sans-serif)", fontSize: 11, color: "#8a7f6a", maxWidth: 120 }}>
          hold E — release at the gold tip
        </div>
      </div>
    </div>
  );
}
