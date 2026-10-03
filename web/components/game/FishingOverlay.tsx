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
 * On the member island the server rolls the fish when the line is cast
 * (species and size, lib/collections/service.ts) and records it when the reel
 * is won; signed out, and on the applicant island, it rolls here and stays in
 * this browser. The reel loop is a rAF writing styles through refs (zero
 * React re-renders per frame).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import FishReveal from "./FishReveal";
import { AudioManager } from "@/lib/game/audio";
import { castLine, collect, landCatch, localCollections, localRecord, mergeWithLocal, type CatchAnswer } from "@/lib/game/collections";
import { rodByTier, type RodTier } from "@/lib/game/rods";
import { oneLinerFor, rollFishFor } from "@/lib/game/peaceful";
import type { WaterType } from "@/lib/game/fishingSpots";
import { punchZoom, setTensionZoom } from "@/lib/game/cameraJuice";
import {
  CAST,
  CELEBRATE,
  FISH,
  HOLO_GRADIENT,
  RARITY_META,
  START_PROGRESS,
  celebrate,
  currentFishingContext,
  rollFish,
  rollSize,
  type FishDef,
  iconFor,
} from "@/lib/game/fishing";
import { weatherMods } from "@/lib/game/weatherPerks";
import { liveIslandWeather, reelWeather } from "@/lib/game/islandWeather";
import { advanceFishingReel, createFishingReel } from "@/lib/game/fishingReel";
import { FISHING_HINTS, bindFishingCastLifecycle, bindFishingInput, castDevice, trackCastDevice, type CastDevice, type FishingHeldInput } from "@/lib/game/fishingInput";
import { isGameControlTarget } from "@/lib/game/keyboardInput";

type Phase = "idle" | "charging" | "casting" | "waiting" | "bite" | "reeling" | "revealing" | "caught" | "missed";

const BITE_WINDOW_MS = 1400;
/** The wait starts when the bobber lands (tsi:fish-splash); this long after the cast it starts anyway (no bobber mounted). */
const LANDING_FALLBACK_MS = 1600;

/** `rod` (rods.ts) widens the hook window, slows the drain and adds rare luck; `tsi:fish-start` may carry `water` (fishingSpots.ts), and on the member island `site` and `from` (where the player stands) for the server roll. */
export default function FishingOverlay({ onActiveChange, collectionScope, zoneOverride, rod = rodByTier(1) }: { onActiveChange?: (active: boolean) => void; collectionScope?: string; zoneOverride?: "river" | "sea"; rod?: RodTier }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const phaseRef = useRef<Phase>("idle");
  const releaseRequestedRef = useRef(false);
  const reelInputRef = useRef<FishingHeldInput>({ keys: new Set(), pointers: new Set() });
  const changePhase = useCallback((next: Phase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);
  const active = phase !== "idle";
  useEffect(() => { onActiveChange?.(active); }, [active, onActiveChange]);
  const [fish, setFish] = useState<FishDef | null>(null);
  const [caughtSize, setCaughtSize] = useState<number | null>(null);
  const [wasNew, setWasNew] = useState(false);
  const [newRecord, setNewRecord] = useState(false);
  const [learned, setLearned] = useState<string | null>(null); // a recipe the landed catch taught
  const [missNote, setMissNote] = useState<string | null>(null);
  // The hints name the input that started the cast (E, the click or a tap): fishingInput.ts FISHING_HINTS.
  const [device, setDevice] = useState<CastDevice>("mouse");
  useEffect(() => trackCastDevice(), []);
  const waterRef = useRef<WaterType | null>(null);
  const castFromRef = useRef<{ site: "village" | "home"; from: [number, number] } | null>(null);
  // The server's roll for this cast (null: roll here), and once hooked, the roll to land.
  const rollRef = useRef<Promise<CatchAnswer | null> | null>(null);
  const landRef = useRef<{ roll: string; size: number | null } | null>(null);
  const hookedRef = useRef(false);
  useEffect(() => {
    const onStart = (e: Event) => {
      const d = (e as CustomEvent<{ water?: WaterType; site?: "village" | "home"; from?: [number, number] }>).detail;
      waterRef.current = d?.water ?? null;
      castFromRef.current = d?.site && d.from ? { site: d.site, from: d.from } : null;
    };
    window.addEventListener("tsi:fish-start", onStart, true);
    return () => window.removeEventListener("tsi:fish-start", onStart, true);
  }, []);
  const timersRef = useRef<number[]>([]);
  const biteDeadlineRef = useRef(0);
  // Discovery survives depleted stock and unavailable account sync.
  // Unknown species keep the ??? silhouette until their first catch.
  const ownedRef = useRef<Set<string>>(new Set());
  // Cast meter (David 2026-07-23): hold E → ping-pong power bar, release
  // at the tip = MAX CAST. Power scales luck AND bite timing.
  const powerRef = useRef(0);
  const [maxCast, setMaxCast] = useState(false);
  // Fishing spot from the world's E handler — the bobber lands relative to it.
  const spotRef = useRef<{ x: number; z: number } | null>(null);

  useEffect(() => {
    for (const key of Object.keys(localCollections(collectionScope))) ownedRef.current.add(key);
    if (collectionScope) return;
    fetch("/api/collections")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.collections) {
          const rows = d.collections as { item_key: string; count: number }[];
          const counts = mergeWithLocal(Object.fromEntries(rows.map((row) => [row.item_key, row.count])));
          for (const key of Object.keys(counts)) ownedRef.current.add(key);
        }
      })
      .catch(() => {});
  }, [collectionScope]);

  const clearTimers = () => {
    timersRef.current.forEach((t) => window.clearTimeout(t));
    timersRef.current = [];
  };

  const cancel = useCallback(() => {
    clearTimers();
    releaseRequestedRef.current = false;
    reelInputRef.current.keys.clear(); reelInputRef.current.pointers.clear();
    changePhase("idle");
    setFish(null);
    setCaughtSize(null);
    setWasNew(false);
    setNewRecord(false);
    setMissNote(null);
    setMaxCast(false);
    powerRef.current = 0;
    rollRef.current = null;
    landRef.current = null;
    hookedRef.current = false;
    setTensionZoom(0);
    window.dispatchEvent(new CustomEvent("tsi:fish-end"));
  }, [changePhase]);

  /** A full bag (specs/game-ui.md §5): the note over the water, besides the card's own words. */
  const bagFull = (answer: { code?: string }) => {
    if (answer.code === "bag_full") window.dispatchEvent(new CustomEvent("tsi:bag-full", { detail: { x: spotRef.current?.x, z: spotRef.current?.z } }));
  };
  const miss = (note: string | null = null) => {
    clearTimers();
    setMissNote(note);
    changePhase("missed");
    AudioManager.playSFX("exit");
    timersRef.current.push(window.setTimeout(cancel, 1800));
  };

  const beginWait = () => {
    if (phaseRef.current !== "casting") return;
    changePhase("waiting");
    // Cast power shortens the wait (max cast halves it); rain days shorten
    // it further (weather perk).
    const wait = (2000 + Math.random() * 4000) * (1 - CAST.waitScale * powerRef.current) * weatherMods(reelWeather(liveIslandWeather())).biteWaitMul;
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
        changePhase("bite");
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
        const windowMs = BITE_WINDOW_MS + CAST.biteBonusMs * powerRef.current + rod.biteWindowMs;
        biteDeadlineRef.current = performance.now() + windowMs;
        // Auto-miss if the window lapses.
        timersRef.current.push(
          window.setTimeout(() => {
            changePhase("missed");
            AudioManager.playSFX("exit");
            timersRef.current.push(window.setTimeout(cancel, 1800));
          }, windowMs)
        );
      }, wait)
    );
  };

  /** Meter released → actually cast, with power locked in. */
  const castNow = (power: number) => {
    if (phaseRef.current !== "charging") return;
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
    changePhase("casting");
    // Member island: the server rolls what will bite now; a refusal (too soon, no water here) ends the cast.
    const from = collectionScope ? null : castFromRef.current;
    rollRef.current = from && castLine(from.site, from.from, power, rod.key);
    void rollRef.current?.then(answer => {
      if (answer && !answer.ok && (phaseRef.current === "casting" || phaseRef.current === "waiting")) { bagFull(answer); miss(answer.error); }
    });
    hookedRef.current = false;
    landRef.current = null;
    const spot = spotRef.current ?? { x: 0, z: 0 };
    window.dispatchEvent(new CustomEvent("tsi:fish-cast", { detail: { x: spot.x, z: spot.z, power } }));
    timersRef.current.push(window.setTimeout(beginWait, LANDING_FALLBACK_MS));
  };

  // The wait starts as the bobber lands (FishingBobber's tsi:fish-splash), not on a guess at its flight.
  useEffect(() => {
    if (phase !== "casting") return;
    const onSplash = () => beginWait();
    window.addEventListener("tsi:fish-splash", onSplash);
    return () => window.removeEventListener("tsi:fish-splash", onSplash);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  /** Bite hooked (E or click) → the server's roll (or a local one), open the reel. */
  const hook = (input: KeyboardEvent | PointerEvent) => {
    if (phaseRef.current !== "bite" || hookedRef.current) return;
    if (performance.now() > biteDeadlineRef.current) return;
    hookedRef.current = true;
    clearTimers();
    reelInputRef.current.keys.clear(); reelInputRef.current.pointers.clear();
    if ("key" in input) reelInputRef.current.keys.add(input.key.toLowerCase());
    else reelInputRef.current.pointers.add(input.pointerId);
    const local = () => {
      const luck = powerRef.current + (powerRef.current >= CAST.maxZone ? CAST.maxBonus : 0);
      // Every world cast names its water (tsi:fish-start); the applicant's shore casts roll the sea.
      const zone: "river" | "sea" = zoneOverride ?? "river";
      // Spots that report their water type (pond/river/sea) use the rod-aware pool.
      return waterRef.current ? rollFishFor(waterRef.current, luck, rod, currentFishingContext()) : rollFish(luck + rod.rarityBonus, zone);
    };
    void (rollRef.current ?? Promise.resolve(null)).then(answer => {
      if (phaseRef.current !== "bite") return;
      if (answer && !answer.ok) { bagFull(answer); miss(answer.error); return; }
      const rolled = answer && FISH.find(f => f.key === answer.catch.item_key);
      landRef.current = rolled && answer.catch.roll ? { roll: answer.catch.roll, size: answer.catch.size_cm } : null;
      setFish(rolled || local());
      changePhase("reeling");
      AudioManager.playSFX("click");
    });
  };

  /** Reel finished. Success → collect + celebrate; fail → it got away. */
  const onReelDone = useCallback(
    (success: boolean) => {
      clearTimers();
      if (success && fish) {
        const isNew = !ownedRef.current.has(fish.key);
        ownedRef.current.add(fish.key);
        setWasNew(isNew);
        const landing = landRef.current;
        // A server roll shows the size it records (none off the roster); the local demo rolls its own.
        const size = landing ? landing.size : rollSize(fish.sizeCm);
        setCaughtSize(size);
        setNewRecord(false);
        setLearned(null);
        // Signals the "catch a fish" onboarding quest (auto-complete).
        // zone + spot coords ride along for world reactions (gull swoop).
        window.dispatchEvent(
          new CustomEvent("tsi:fish-caught", {
            detail: { key: fish.key, model: fish.model, raw: fish.raw, zone: fish.zone ?? "river", x: spotRef.current?.x, z: spotRef.current?.z },
          })
        );
        if (collectionScope) collect(fish.key, { scope: collectionScope });
        else if (landing) {
          void landCatch(landing.roll).then(answer => {
            // Refused (the hourly cap, the bag filled since the cast): the card stands, the catch isn't kept.
            if (answer && !answer.ok) { bagFull(answer); window.dispatchEvent(new CustomEvent("tsi:toast", { detail: { text: answer.error } })); return; }
            collect(fish.key);
            window.dispatchEvent(new CustomEvent("tsi:bag-got", { detail: { key: fish.key } }));
            setLearned(answer?.catch.recipe?.name ?? null);
            const beat = localRecord(fish.key, size);
            setNewRecord(!isNew && (answer ? answer.catch.new_record === true && answer.catch.total_collected !== 1 : beat));
          });
        } else {
          collect(fish.key);
          window.dispatchEvent(new CustomEvent("tsi:bag-got", { detail: { key: fish.key } }));
          setNewRecord(!isNew && localRecord(fish.key, size));
        }
        if (isNew) {
          // Blind-box ceremony (David 2026-07-23): first catches get the
          // fullscreen staged reveal — it owns the celebration (confetti
          // fires at its flash) and dismisses back to idle.
          changePhase("revealing");
          AudioManager.playSFX("click");
        } else {
          // Repeats keep the quick card + tier confetti.
          changePhase("caught");
          AudioManager.playSFX("confirm");
          celebrate(fish.rarity, RARITY_META[fish.rarity].color);
          timersRef.current.push(window.setTimeout(cancel, CELEBRATE[fish.rarity].cardMs));
        }
      } else {
        changePhase("missed");
        AudioManager.playSFX("exit");
        timersRef.current.push(window.setTimeout(cancel, 1800));
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fish, collectionScope]
  );

  useEffect(() => bindFishingCastLifecycle({
    getPhase: () => phaseRef.current,
    onStart: (spot) => {
      spotRef.current = spot;
      releaseRequestedRef.current = false;
      setDevice(castDevice());
      changePhase("charging");
    },
    onRelease: () => { releaseRequestedRef.current = true; },
    onCancel: cancel,
    heldInput: reelInputRef.current,
  }), [cancel, changePhase]);

  // Keyboard: E hooks during bite, ESC cancels (the reel and the reveal
  // each handle their own input). Capture so the world's E handler doesn't
  // also fire while fishing.
  useEffect(() => {
    if (phase === "idle" || phase === "reeling" || phase === "revealing") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey || isGameControlTarget(document.activeElement)) return;
      if (e.key === "e" || e.key === "E" || e.key === " ") {
        e.preventDefault();
        e.stopPropagation();
        hook(e);
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
      if (e.button !== 0 || isGameControlTarget(e.target as Element | null)) return;
      e.preventDefault();
      e.stopPropagation();
      hook(e);
    };
    window.addEventListener("pointerdown", onDown, true);
    return () => window.removeEventListener("pointerdown", onDown, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  useEffect(() => () => clearTimers(), []);

  if (phase === "idle") return null;

  // First-catch blind-box ceremony — fullscreen, replaces the bottom card.
  if (phase === "revealing" && fish) {
    return <FishReveal fish={fish} sizeCm={caughtSize} recipe={learned} onDone={cancel} />;
  }

  const label =
    phase === "casting"
      ? maxCast
        ? "MAX CAST!!"
        : "Casting…"
      : phase === "waiting"
        ? rod.tier > 1 ? `Waiting for a bite… · ${rod.name}` : "Waiting for a bite…"
        : phase === "bite"
          ? "!!  Hook it!"
          : phase === "caught"
            ? `You caught ${fish?.label ?? "a fish"}!`
            : missNote ?? "It got away…";
  const icon = phase === "caught" && fish ? iconFor(fish) : null;
  const rarity = fish ? RARITY_META[fish.rarity] : null;
  const glow = phase === "caught" && fish ? CELEBRATE[fish.rarity].glow : false;

  const accent = phase === "bite" ? "#E5484D" : phase === "caught" ? "#3D8F52" : "var(--app-ink, #4A4034)";

  return (
    <div
      data-fishing-overlay={phase}
      style={{
        position: "fixed",
        left: "50%",
        // The bottom stack's lane (the prompt steps aside while you fish), under the toasts; 120 where no stack is set.
        bottom: "var(--hud-lane-bottom, 120px)",
        transform: "translateX(-50%)",
        // The member world's text-size setting (styles/game-tokens.css sets --gui-overlay-zoom there); 1 on the applicant island.
        zoom: "var(--gui-overlay-zoom, 1)",
        zIndex: 60,
        pointerEvents: "none",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
      }}
    >
      {phase === "charging" ? (
        <CastMeter onRelease={castNow} releaseRequestedRef={releaseRequestedRef} hint={FISHING_HINTS[device].charge} />
      ) : phase === "reeling" && fish ? (
        <ReelMinigame fish={fish} known={ownedRef.current.has(fish.key)} onDone={onReelDone} initialInput={reelInputRef.current} tensionMul={rod.tensionMul} help={FISHING_HINTS[device].reel} />
      ) : (
        <div
          style={{
            padding: "10px 20px",
            background: "var(--app-surface, #FFFDF5)",
            color: accent,
            border: glow
              ? `2px solid ${rarity!.color}`
              : `2px solid ${phase === "bite" ? "#E5484D" : phase === "casting" && maxCast ? "#FFD166" : "var(--app-line, #E8DFC8)"}`,
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
            <span style={{ fontSize: 12, color: "var(--app-muted, #8a7f6a)", fontWeight: 600 }}>{caughtSize} cm</span>
          )}
          {phase === "caught" && rarity && (
            <span
              style={{
                fontSize: "max(10px, var(--gui-min-text, 0px))",
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
          {phase === "caught" && newRecord && (
            <span style={{ fontSize: "max(10px, var(--gui-min-text, 0px))", fontWeight: 700, letterSpacing: "0.06em", color: "#FFFDF5", background: "#C2410C", borderRadius: 999, padding: "3px 8px" }}>
              NEW RECORD
            </span>
          )}
          {phase === "caught" && wasNew && (
            <span
              style={{
                fontSize: "max(10px, var(--gui-min-text, 0px))",
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
      {phase === "caught" && fish && oneLinerFor(fish.key) && (
        <div style={{ fontFamily: "var(--font-highlight, sans-serif)", fontSize: 12, fontStyle: "italic", color: "#FFFDF5", textShadow: "0 1px 3px rgba(0,0,0,0.55)", maxWidth: 360, textAlign: "center" }} data-testid="catch-one-liner">
          “{oneLinerFor(fish.key)}”
        </div>
      )}
      {phase === "caught" && learned && (
        <div style={{ fontFamily: "var(--font-highlight, sans-serif)", fontSize: 13, fontWeight: 700, color: "#FFFDF5", textShadow: "0 1px 3px rgba(0,0,0,0.55)" }} data-testid="catch-recipe">
          You learned a recipe: {learned}
        </div>
      )}
      {phase === "charging" && (
        <div
          style={{
            fontFamily: "var(--font-highlight, sans-serif)",
            fontSize: "max(11px, var(--gui-min-text, 0px))",
            color: "rgba(255,255,255,0.7)",
            textShadow: "0 1px 3px rgba(0,0,0,0.5)",
          }}
        >
          {FISHING_HINTS[device].tip}
        </div>
      )}
      {(phase === "waiting" || phase === "bite" || phase === "casting") && (
        <div
          style={{
            fontFamily: "var(--font-highlight, sans-serif)",
            fontSize: "max(11px, var(--gui-min-text, 0px))",
            color: "rgba(255,255,255,0.7)",
            textShadow: "0 1px 3px rgba(0,0,0,0.5)",
          }}
        >
          {phase === "bite" ? FISHING_HINTS[device].hook : "Watch for the bite"}
        </div>
      )}
      {phase !== "reeling" && (
        <button type="button" onClick={cancel} style={{ pointerEvents: "auto", padding: "7px 12px", borderRadius: 8, border: "1px solid var(--app-line, #D8CFB8)", background: "var(--app-surface, #FFFDF5)", color: "var(--app-ink, #4A4034)", fontSize: 12 }}>
          {phase === "caught" || phase === "missed" ? "Close" : "Cancel cast (Esc)"}
        </button>
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
  initialInput,
  tensionMul = 1,
  help = FISHING_HINTS.mouse.reel,
}: {
  fish: FishDef;
  known: boolean;
  onDone: (success: boolean) => void;
  initialInput?: FishingHeldInput;
  tensionMul?: number;
  /** How to reel on the device that started the cast (FISHING_HINTS). */
  help?: string;
}) {
  const reelRef = useRef<HTMLDivElement>(null);
  const pausedLabelRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(false);
  const barRef = useRef<HTMLDivElement>(null);
  const fishRef = useRef<HTMLImageElement>(null);
  const progRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  /** The splash a dart throws on the track: three drops made once and replayed (nothing is created in the loop). */
  const dropRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const holdingRef = useRef(false);
  const doneRef = useRef(false);
  const lastThunkRef = useRef(0);

  const barW = RARITY_META[fish.rarity].barW;

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const reel = reelRef.current;
    reel?.focus({ preventScroll: true });
    const simulation = createFishingReel(fish);
    doneRef.current = false;
    holdingRef.current = false;

    const finish = (success: boolean) => {
      if (doneRef.current) return;
      doneRef.current = true;
      cancelAnimationFrame(raf);
      onDone(success);
    };

    const step = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      if (pausedRef.current) {
        raf = requestAnimationFrame(step);
        return;
      }
      const events = advanceFishingReel(simulation, dt, holdingRef.current, weatherMods(reelWeather(liveIslandWeather())).dartChanceMul, Math.random, tensionMul);
      const { position: pos, fishPosition: fishPos, inside, progress, tension } = simulation;
      if (simulation.result !== null) return finish(simulation.result);

      if (events.bounced && now - lastThunkRef.current > 250) {
        lastThunkRef.current = now;
        AudioManager.playSFX("blip3");
        barRef.current?.animate(
          [{ boxShadow: "0 0 0 0 rgba(61,143,82,0)" }, { boxShadow: "0 0 10px 2px rgba(61,143,82,0.8)" }, { boxShadow: "0 0 0 0 rgba(61,143,82,0)" }],
          { duration: 200 }
        );
      }
      if (events.darted) splashDrops(dropRefs.current, fishPos);
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
        progRef.current.setAttribute("aria-valuenow", String(Math.round(progress * 100)));
        progRef.current.style.background = progress < 0.25 ? "#E5484D" : "#FFD166";
        // Feedback kit: heartbeat pulse as the catch gets close — faster
        // the closer you are.
        const beat = progress > 0.75 ? `reel-heartbeat ${(1.35 - progress).toFixed(2)}s ease-in-out infinite` : "";
        if (progRef.current.style.animation !== beat) progRef.current.style.animation = beat;
      }

      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);

    const releaseInput = bindFishingInput({
      initialInput,
      onHold: (holding) => { holdingRef.current = holding; },
      onCancel: () => finish(false),
      onPointerFocus: () => reel?.focus({ preventScroll: true }),
      onPause: (paused) => {
        pausedRef.current = paused;
        last = performance.now();
        if (pausedLabelRef.current) pausedLabelRef.current.hidden = !paused;
        if (paused) setTensionZoom(0);
      },
    });

    return () => {
      cancelAnimationFrame(raf);
      setTensionZoom(0);
      releaseInput();
      if (document.activeElement === reel && previouslyFocused?.isConnected) previouslyFocused.focus({ preventScroll: true });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={reelRef}
      role="application"
      aria-label="Fishing reel"
      aria-describedby="fishing-reel-help"
      tabIndex={0}
      style={{
        width: "min(560px, 86vw)",
        padding: "12px 14px 10px",
        background: "var(--app-surface, #FFFDF5)",
        border: "2px solid var(--app-line, #E8DFC8)",
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
        @keyframes reel-heartbeat {
          0%, 100% { box-shadow: 0 0 0 0 rgba(255, 209, 102, 0); }
          50% { box-shadow: 0 0 10px 2px rgba(255, 209, 102, 0.85); }
        }
      `}</style>
      {/* Header: species (or ??? for unknowns — rarity is never shown here).
          Zone chip is always safe to show — you know where you cast. */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--app-ink, #4A4034)" }}>
          {known ? fish.name : "???"}
        </span>
        <span
          style={{
            fontSize: "max(9px, var(--gui-min-text, 0px))",
            fontWeight: 700,
            padding: "1px 7px",
            borderRadius: 999,
            background: (fish.zone ?? "river") === "sea" ? "#D2EDF5" : "#E3EFD9",
            color: (fish.zone ?? "river") === "sea" ? "#2A6B84" : "#4A7A44",
          }}
        >
          {(fish.zone ?? "river") === "sea" ? "sea" : "river"}
        </span>
        <span style={{ marginLeft: "auto", fontSize: "max(10px, var(--gui-min-text, 0px))", color: "var(--app-muted, #8a7f6a)" }}>
          keep the fish inside the green bar
        </span>
      </div>

      {/* Horizontal water track — the water reads as the zone you cast into:
          fresh river blue vs deeper sea teal. */}
      <div
        ref={trackRef}
        style={{
          position: "relative",
          height: 46,
          borderRadius: 10,
          background:
            (fish.zone ?? "river") === "sea"
              ? "linear-gradient(180deg, #A9DCE7 0%, #6FBBD6 60%, #4C9FC2 100%)"
              : "linear-gradient(180deg, #BFE9FA 0%, #9ED7F2 70%, #8ECBEC 100%)",
          boxShadow:
            (fish.zone ?? "river") === "sea"
              ? "inset 0 2px 7px rgba(16, 60, 95, 0.35)"
              : "inset 0 2px 6px rgba(30, 80, 120, 0.25)",
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
        {DROP_SPREAD.map((_, i) => <span key={i} ref={el => { dropRefs.current[i] = el; }} aria-hidden style={DROP_STYLE} />)}
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

      <div ref={pausedLabelRef} hidden style={{ marginTop: 8, fontSize: 12, color: "var(--app-ink, #4A4034)" }}>
        Paused · click the reel to resume
      </div>
      <div id="fishing-reel-help" style={{ marginTop: 8, fontSize: "max(11px, var(--gui-min-text, 0px))", color: "var(--app-muted, #635745)" }}>
        {help}
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
          role="progressbar"
          aria-label="Catch progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={START_PROGRESS * 100}
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

/** The dart's drops: each flies out its own way from the fish (px across) and fades. */
const DROP_SPREAD = [-22, 4, 24];
const DROP_STYLE: React.CSSProperties = { position: "absolute", left: 0, top: "50%", width: 5, height: 5, borderRadius: "50%", background: "#EAF6FF", pointerEvents: "none", opacity: 0 };
const DROP_FRAMES = DROP_SPREAD.map(dx => [{ transform: "translate(-50%, -50%)", opacity: 0.95 }, { transform: `translate(calc(-50% + ${dx}px), -26px)`, opacity: 0 }]);
const DROP_TIMING = DROP_SPREAD.map((_, i) => ({ duration: 450, delay: i * 40, easing: "ease-out", fill: "forwards" as const }));
/** Replay the three drops at the fish's place on the track. */
function splashDrops(drops: (HTMLSpanElement | null)[], at: number) {
  drops.forEach((drop, i) => {
    if (!drop) return;
    drop.style.left = `${at * 100}%`;
    drop.animate(DROP_FRAMES[i], DROP_TIMING[i]);
  });
}

// ─── Cast meter (David 2026-07-23) ──────────────────────────────────────────
//
// Hold E at a fishing spot → this vertical power bar ping-pongs bottom↔top
// (~1.15s cycle). Release E (or the pointer) to cast with the bar's power:
// release inside the gold tip zone = MAX CAST (luck bonus + faster bite +
// wider hook window — see CAST in lib/game/fishing.ts). rAF + refs, zero
// re-renders per frame; ESC cancels via the parent's key handler.

/** `hint`: how to cast on the device that started it (the applicant island casts with E; the member island with the held rod's click or a tap). */
function CastMeter({ onRelease, releaseRequestedRef, hint }: { onRelease: (power: number) => void; releaseRequestedRef: React.RefObject<boolean>; hint: string }) {
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
    // Weather perk: sunny days slow the meter (easier MAX CAST).
    const cycleMs = CAST.cycleMs * weatherMods(reelWeather(liveIslandWeather())).castCycleMul;
    releasedRef.current = false;
    const step = (now: number) => {
      if (releaseRequestedRef.current) {
        if (!releasedRef.current) {
          releasedRef.current = true;
          onRelease(pRef.current);
        }
        return;
      }
      const dt = Math.min(now - last, 100);
      last = now;
      vt += dt * speedMul;
      const cycleIdx = Math.floor(vt / cycleMs);
      if (cycleIdx > lastCycle) {
        lastCycle = cycleIdx;
        speedMul = Math.min(2.2, speedMul * 1.15);
      }
      // Triangle wave 0→1→0 over cycleMs of virtual time.
      const cyc = (vt % cycleMs) / cycleMs; // 0..1
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
        readoutRef.current.style.color = inTip ? "#9B6500" : "var(--app-ink, #4A4034)";
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);

    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        gap: 10,
        padding: "12px 14px",
        background: "var(--app-surface, #FFFDF5)",
        border: "2px solid var(--app-line, #E8DFC8)",
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
          background: "linear-gradient(180deg, var(--app-line, #E8DFC8) 0%, var(--app-line, #D8CFB8) 100%)",
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
            fontFamily: "var(--gui-mono, 'IBM Plex Mono', monospace)",
            fontSize: 15,
            fontWeight: 800,
            color: "var(--app-ink, #4A4034)",
            minWidth: 52,
          }}
        >
          0%
        </div>
        <div style={{ fontFamily: "var(--font-highlight, sans-serif)", fontSize: "max(11px, var(--gui-min-text, 0px))", color: "var(--app-muted, #8a7f6a)", maxWidth: 120 }}>
          {hint}
        </div>
      </div>
    </div>
  );
}
