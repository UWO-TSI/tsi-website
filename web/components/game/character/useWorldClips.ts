"use client";

import { useEffect, useRef, type RefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { CLIP_BY_NAME } from "@/lib/game/character/look";
import { getPeacefulTarget } from "@/lib/game/peacefulNear";
import { HOME_S, castBeat, live, newCast, throwCast, type FishingState } from "@/lib/game/fishingRig";
import { readHoldUpCatch } from "@/lib/game/fishingPrefs";
import type { CharacterMotion, ClipName } from "@/lib/game/character/clips";

/**
 * World interactions → player clips (row 111), shared by the outdoor and
 * interior controllers. The rod is held in the hand (specs/game-ui.md §2).
 *   fishing (specs/polish/fishing.md), this avatar's cast (motion.fishing, lib/game/fishingRig.ts) and its clips:
 *     tsi:fish-start {x, z, from} → wind up (CastWindup, posed by the meter's power) toward the spot
 *     tsi:fish-cast {power}       → CastSwing (a harder cast whips faster), then FishHold; the throw lands on the water
 *     tsi:fish-nibble, tsi:fish-bite → the bobber dips, is pulled under
 *     tsi:fish-hooked {model}     → HookYank, then Reel (cranking faster while the reel is held); the catch's model ready
 *     tsi:fish-caught {…}         → turn to the camera and hold it up (HoldUp) while its card is up, Cheer when it
 *                                   closes; with Hold up my catch off (fishingPrefs.ts) Cheer now, the fish over your head
 *     tsi:fish-escaped {hooked}   → Sad
 *     tsi:fish-end                → the bobber comes home and the cast is over
 *   tsi:peaceful-act → Net at a bug, Dig at a shovel find (buried clam, rock), otherwise Forage;
 *   tsi:flower-pick → Forage; tsi:critter-catch → Net
 *   tsi:emote {clip} → any catalogue clip as a one-shot (emote menu, study, admin tools)
 */
const ACT_CLIP = { bug: "Net", dig: "Dig", forage: "Forage" } as const;
/** The held poses a cast leaves you in; the cast's end lets them go. */
const FISHING_POSES = new Set<ClipName>(["CastWindup", "FishHold", "Reel", "HoldUp"]);
/** How long the turn to the camera takes when you show off a catch (s). */
const SHOW_TURN_S = 0.38;
export function useWorldClips(motion: RefObject<CharacterMotion>, face: (x: number, z: number) => void) {
  const camera = useThree(s => s.camera);
  /** The turn to the camera to show off a catch: from and to (yaw), and when it began (ms; -1 none). */
  const turn = useRef({ from: 0, to: 0, at: -1 });
  useEffect(() => {
    const set = (patch: Partial<CharacterMotion>) => Object.assign(motion.current, patch);
    const cast = () => motion.current.fishing ?? null;
    const on: Record<string, (e: Event) => void> = {
      "tsi:fish-start": e => {
        const d = (e as CustomEvent<{ x: number; z: number; from?: [number, number] }>).detail;
        if (!d) return;
        face(d.x, d.z);
        const [fx, fz] = d.from ?? [d.x, d.z - 1];
        live.power = 0;
        set({ fishing: newCast(true, fx, fz, d.x, d.z, performance.now()), pose: "CastWindup", scrub: 0 });
      },
      "tsi:fish-cast": e => {
        const d = (e as CustomEvent<{ x: number; z: number; power: number }>).detail, f = cast();
        if (d) face(d.x, d.z);
        if (f) throwCast(f, d?.power ?? 0, performance.now());
        set({ play: "CastSwing", playRate: f?.rate ?? 1, pose: "FishHold" });
      },
      "tsi:fish-nibble": () => { const f = cast(); if (f) f.nibbleAt = performance.now(); },
      "tsi:fish-bite": () => { const f = cast(); if (f) castBeat(f, "bite", performance.now()); },
      "tsi:fish-hooked": e => {
        const d = (e as CustomEvent<{ model?: string; raw?: boolean }>).detail, f = cast();
        if (f) { castBeat(f, "reel", performance.now()); f.catchModel = d?.model ?? null; f.catchRaw = !!d?.raw; }
        set({ play: "HookYank", pose: "Reel" });
      },
      "tsi:fish-caught": e => {
        const d = (e as CustomEvent<{ model?: string; raw?: boolean; sizeCm?: number | null }>).detail, f = cast();
        const showOff = readHoldUpCatch();
        if (f) {
          castBeat(f, "landed", performance.now());
          f.catchModel = d?.model ?? f.catchModel; f.catchRaw = d?.raw ?? f.catchRaw; f.catchCm = d?.sizeCm ?? null; f.showOff = showOff;
          // Animal Crossing's beat: turn to the camera to show it off (it comes out of the water into your hands).
          if (showOff) turn.current = { from: motion.current.yaw, to: Math.atan2(camera.position.x - f.fromX, camera.position.z - f.fromZ), at: performance.now() };
        }
        set(showOff ? { play: null, pose: "HoldUp" } : { play: "Cheer", pose: null });
      },
      "tsi:fish-escaped": e => {
        const f = cast();
        if (f) { castBeat(f, "escaped", performance.now()); f.snapped = !!(e as CustomEvent<{ hooked?: boolean }>).detail?.hooked; }
        set({ play: "Sad", pose: null });
      },
      "tsi:fish-end": () => {
        const f = cast();
        // A catch shown off: into the bag, and a cheer as its card closes.
        if (f?.phase === "landed" && f.showOff) set({ play: "Cheer" });
        if (f && f.phase !== "reelin") castBeat(f, "reelin", performance.now());
        if (motion.current.pose && FISHING_POSES.has(motion.current.pose)) set({ pose: null, poseRate: undefined });
      },
      "tsi:peaceful-act": () => {
        const t = getPeacefulTarget();
        if (t?.at) face(t.at[0], t.at[1]);
        set({ play: ACT_CLIP[t?.kind ?? "forage"] });
      },
      "tsi:flower-pick": () => set({ play: "Forage" }),
      "tsi:critter-catch": () => set({ play: "Net" }),
      "tsi:emote": e => { const clip = (e as CustomEvent<{ clip: ClipName }>).detail?.clip; if (clip && CLIP_BY_NAME.has(clip)) set({ play: clip }); },
    };
    for (const [name, fn] of Object.entries(on)) window.addEventListener(name, fn);
    return () => { for (const [name, fn] of Object.entries(on)) window.removeEventListener(name, fn); };
  }, [motion, face, camera]);
  // The local overlay's live inputs into this avatar's cast, before the character poses (-2): the wind-up follows the
  // meter, the reel cranks faster while held, the turn to show off a catch eases round; a cast that has come home is over.
  useFrame(() => {
    const now = performance.now(), f = motion.current?.fishing ?? null;
    followCast(motion.current, now);
    if (f) turnToShow(f, turn.current, now, face);
  }, -2);
}

/** Ease round to the camera to show off a catch (the yaw that faces it), a little each frame through `face`. */
function turnToShow(f: FishingState, t: { from: number; to: number; at: number }, now: number, face: (x: number, z: number) => void) {
  if (t.at < 0) return;
  const k = Math.min(1, (now - t.at) / (SHOW_TURN_S * 1000)), e = k * k * (3 - 2 * k);
  const d = Math.atan2(Math.sin(t.to - t.from), Math.cos(t.to - t.from)), a = t.from + d * e;
  face(f.fromX + Math.sin(a), f.fromZ + Math.cos(a));
  if (k >= 1) t.at = -1;
}

/** Module scope (the react compiler freezes values reached through hooks). */
function followCast(m: CharacterMotion | null, now: number) {
  const f = m?.fishing;
  if (!m || !f || !f.local) return;
  if (f.phase === "charging") { f.power = live.power; m.scrub = live.power; return; }
  if (f.phase === "reel") {
    f.pull = live.pull; f.tension = live.tension; f.reeling = live.reeling; f.reeled = live.reeled;
    m.poseRate = live.reeling ? 1.35 : 0.7;
    return;
  }
  if (m.poseRate !== undefined) m.poseRate = undefined;
  if (f.phase === "reelin" && now - f.since > HOME_S * 1000 + 50) m.fishing = null;
}
