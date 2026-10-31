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

import { useRef } from "react";
import FishReveal from "./FishReveal";
import { useFishingSession } from "@/lib/game/useFishingSession";
import { rodByTier, type RodEffects, type RodTier } from "@/lib/game/rods";
import {
  CAST,
  RARITY_META,
  bossOf,
  START_PROGRESS,
  type FishDef,
  iconFor,
} from "@/lib/game/fishing";
import { BOSS, BOSS_CALL } from "@/lib/game/fishingReel";
import { FISHING_HINTS, type FishingHeldInput } from "@/lib/game/fishingInput";
import { useReelLoop } from "@/lib/game/useReelLoop";
import { useCastMeter } from "@/lib/game/useCastMeter";


/** The line under the card (a tip, "Watch for the bite"): a small cream pill, so it reads on sand, water and grass alike. */
const HINT_PILL: React.CSSProperties = {
  padding: "4px 12px",
  borderRadius: 999,
  background: "rgb(255 251 231 / 0.94)",
  color: "var(--gui-ink-strong, var(--app-ink, #4A4034))",
  boxShadow: "0 2px 6px rgba(60, 45, 20, 0.16)",
  fontFamily: "var(--font-highlight, sans-serif)",
  fontSize: "max(12px, var(--gui-min-text, 0px))",
  fontWeight: 700,
  whiteSpace: "nowrap",
};

/** `rod` (rods.ts) widens the hook window, slows the drain and adds rare luck; `tsi:fish-start` may carry `water` (fishingSpots.ts), and on the member island `site` and `from` (where the player stands) for the server roll. */
export default function FishingOverlay({ onActiveChange, collectionScope, zoneOverride, rod = rodByTier(1) }: { onActiveChange?: (active: boolean) => void; collectionScope?: string; zoneOverride?: "river" | "sea"; rod?: RodTier }) {
  const { phase, fish, caughtSize, wasNew, newRecord, learned, buddy, missNote, device, maxCast, bossMode, raidId, owned, reelInput, releaseRequestedRef, castNow, cancel, onReelDone, revealDelay } =
    useFishingSession({ onActiveChange, collectionScope, zoneOverride, rod });

  if (phase === "idle") return null;

  // The catch card, for every catch: it replaces the bottom card.
  if (phase === "revealing" && fish) {
    return <FishReveal fish={fish} sizeCm={caughtSize} recipe={learned} together={buddy} isNew={wasNew} newRecord={newRecord} delay={revealDelay} onDone={cancel} />;
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
          : phase === "surfacing"
            ? "Something huge is coming up…"
            : missNote ?? "It got away…";
  const accent = phase === "bite" ? "#E5484D" : "var(--app-ink, #4A4034)";

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
        <ReelMinigame fish={fish} known={owned.has(fish.key)} onDone={onReelDone} initialInput={reelInput} rig={rod} help={FISHING_HINTS[device].reel} boss={bossMode} raidId={raidId} />
      ) : (
        <div
          style={{
            padding: "10px 20px",
            background: "var(--app-surface, #FFFDF5)",
            color: accent,
            border: `2px solid ${phase === "bite" ? "#E5484D" : phase === "casting" && maxCast ? "#FFD166" : "var(--app-line, #E8DFC8)"}`,
            borderRadius: 14,
            fontFamily: "var(--font-highlight, sans-serif)",
            fontSize: 15,
            fontWeight: 600,
            whiteSpace: "nowrap",
            boxShadow: "0 4px 14px rgba(60, 45, 20, 0.2)",
            animation:
              phase === "bite"
                ? "fish-pulse 0.4s ease-in-out infinite"
                : phase === "missed"
                  ? "fish-escape-jolt 0.38s ease-out"
                  : undefined,
            position: "relative",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          {label}
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
        </div>
      )}
      {phase === "charging" && (
        <div style={HINT_PILL}>
          {FISHING_HINTS[device].tip}
        </div>
      )}
      {(phase === "waiting" || phase === "bite" || phase === "casting") && (
        <div style={HINT_PILL}>
          {phase === "bite" ? FISHING_HINTS[device].hook : "Watch for the bite"}
        </div>
      )}
      {phase !== "reeling" && (
        <button type="button" onClick={cancel} style={{ pointerEvents: "auto", padding: "7px 12px", borderRadius: 8, border: "1px solid var(--app-line, #D8CFB8)", background: "var(--app-surface, #FFFDF5)", color: "var(--app-ink, #4A4034)", fontSize: 12 }}>
          {phase === "missed" ? "Close" : "Cancel cast (Esc)"}
        </button>
      )}
      <style>{`
        @keyframes fish-pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.08); }
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
  rig,
  help = FISHING_HINTS.mouse.reel,
  boss: bossMode = bossOf(fish.rarity),
  raidId,
}: {
  fish: FishDef;
  known: boolean;
  onDone: (success: boolean) => void;
  initialInput?: FishingHeldInput;
  /** The rod in hand with its add-ons (rods.ts): the drain, the fill and the bar's width. */
  rig?: Pick<RodEffects, "tensionMul" | "fillMul" | "barMul">;
  /** How to reel on the device that started the cast (FISHING_HINTS). */
  help?: string;
  /** The fight it puts up (fishingReel.ts): defaults to the fish's; a divine with no raid to join fights solo. */
  boss?: "solo" | "shared" | null;
  /** A shared fight's raid (lib/net/raid.ts): the room keeps the stamina, this reel reports its wear. */
  raidId?: string;
}) {
  const reelRef = useRef<HTMLDivElement>(null);
  const pausedLabelRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const fishRef = useRef<HTMLImageElement>(null);
  const progRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  /** The splash a dart throws on the track: three drops made once and replayed (nothing is created in the loop). */
  const dropRefs = useRef<(HTMLSpanElement | null)[]>([]);
  /** A boss fight's stamina fill and its call (the move warned of, then under way). */
  const staminaRef = useRef<HTMLDivElement>(null);
  const fightLabelRef = useRef<HTMLSpanElement>(null);
  const callRef = useRef<HTMLDivElement>(null);

  const barMul = rig?.barMul ?? 1;
  // The boss reel narrows its bar by phase (fishingReel.ts BOSS); the bar's width is set from the simulation.
  const boss = bossMode !== null;
  const barW = Math.min(0.5, RARITY_META[fish.rarity].barW * barMul * (boss ? BOSS.barMul[0] : 1));

  useReelLoop({
    fish, boss: bossMode, raidId, rig, initialInput, focus: reelRef, onDone,
    onPause: (paused) => { if (pausedLabelRef.current) pausedLabelRef.current.hidden = !paused; },
    onFrame: ({ sim: simulation, events, now, raid }) => {
      const { position: pos, fishPosition: fishPos, inside, progress } = simulation;
      if (raid) {
        const who = `Raid: ${raid.helpers} reeling`;
        if (fightLabelRef.current && fightLabelRef.current.textContent !== who) fightLabelRef.current.textContent = who;
      }
      if (events.bounced) {
        barRef.current?.animate(
          [{ boxShadow: "0 0 0 0 rgba(61,143,82,0)" }, { boxShadow: "0 0 10px 2px rgba(61,143,82,0.8)" }, { boxShadow: "0 0 0 0 rgba(61,143,82,0)" }],
          { duration: 200 }
        );
      }
      if (events.darted) splashDrops(dropRefs.current, fishPos);
      const boss = simulation.boss;
      if (boss) {
        if (events.phased) staminaRef.current?.animate([{ filter: "brightness(2)" }, { filter: "brightness(1)" }], { duration: 500 });
        if (staminaRef.current) staminaRef.current.style.width = `${boss.stamina * 100}%`;
        const call = boss.move && boss.stage ? BOSS_CALL[boss.move][boss.stage] : null;
        if (callRef.current && callRef.current.dataset.call !== (call ?? "")) {
          callRef.current.dataset.call = call ?? "";
          callRef.current.textContent = call ?? "";
          callRef.current.style.visibility = call ? "visible" : "hidden";
          callRef.current.style.background = boss.stage === "warn" ? "#FFE8A3" : "#E5484D";
          callRef.current.style.color = boss.stage === "warn" ? "#6B4A00" : "#FFFDF5";
          if (call) callRef.current.animate([{ transform: "scale(1.3)" }, { transform: "scale(1)" }], { duration: 220, easing: "cubic-bezier(0.34, 1.56, 0.64, 1)" });
        }
        if (fishRef.current) fishRef.current.style.opacity = boss.stage === "live" && boss.move === "jump" ? "0.25" : "1";
      }

      // DOM writes
      if (barRef.current) {
        barRef.current.style.left = `${pos * 100}%`;
        barRef.current.style.width = `${simulation.barWidth * 100}%`;
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
        const beat = !simulation.boss && progress > 0.75 ? `reel-heartbeat ${(1.35 - progress).toFixed(2)}s ease-in-out infinite` : "";
        if (progRef.current.style.animation !== beat) progRef.current.style.animation = beat;
      }
    },
  });

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
      {/* A boss: its stamina (worn down while it's in the bar; the notches are its phases) and its call. */}
      {boss && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <span ref={fightLabelRef} style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.6, color: "#8A5A00", textTransform: "uppercase" }}>{raidId ? "Raid" : "It fights back"}</span>
            <div ref={callRef} aria-live="assertive" style={{ marginLeft: "auto", visibility: "hidden", padding: "2px 10px", borderRadius: 999, fontSize: 12, fontWeight: 800 }} />
          </div>
          <div aria-hidden style={{ position: "relative", height: 12, borderRadius: 999, background: "rgba(74, 64, 52, 0.18)", overflow: "hidden" }}>
            <div ref={staminaRef} style={{ height: "100%", width: "100%", borderRadius: 999, background: "linear-gradient(90deg, #E5484D, #F2B53A 60%, #FFE27A)" }} />
            {[1 / 3, 2 / 3].map((x) => <span key={x} style={{ position: "absolute", left: `${x * 100}%`, top: 0, bottom: 0, width: 2, background: "rgba(255, 253, 245, 0.85)" }} />)}
          </div>
        </div>
      )}
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
          {boss ? "keep it in the bar to tire it" : "keep the fish inside the green bar"}
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
          aria-label={boss ? "Line" : "Catch progress"}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={(boss ? BOSS.line : START_PROGRESS) * 100}
          style={{
            height: "100%",
            width: `${(boss ? BOSS.line : START_PROGRESS) * 100}%`,
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

  useCastMeter({ releaseRequestedRef, onRelease, onFrame: (p, inTip) => {
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
  } });

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
