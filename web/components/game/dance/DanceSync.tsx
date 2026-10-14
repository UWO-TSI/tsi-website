"use client";

/**
 * Group dance sync (specs/v1-drop.md §3): two or more dancers within about 6 steps snap to one shared beat on the
 * world clock, each keeping their own move; music notes rise off them and a soft beat plays near them.
 *
 * One frame loop at priority -2, after RemoteAvatars has driven the remotes (-3, lib/game/danceField.ts) and before
 * every Character steps its mixer (-1): it groups you and the remotes in view who are dancing (lib/game/danceSync.ts)
 * and gives each one in a group of two or more the world clock as `motion.beat`, which Character eases their loop onto.
 * Notes come from our particle pack's `note` row through the scene's shared movement pool (useMoveParticles: no draw
 * of their own), one per dancer every other beat, staggered, at most NOTES_PER_BEAT a beat. The soft beat is one loop
 * layer in the audio manager (mute-aware), faded by your distance to the nearest group; the campfire's drum song takes
 * over for the stomp ring. Nothing is allocated per frame.
 */
import { useEffect, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import type * as THREE from "three";
import { useMoveParticles } from "../movement/moveFx";
import { FACE, seedAt, type Recipe } from "@/lib/game/fx/particles";
import { BEAT_S, SOFT_BEAT, danceGroups, isDance } from "@/lib/game/danceSync";
import { FIELD_MAX, clearRemoteField, remoteField } from "@/lib/game/danceField";
import { worldTime } from "@/lib/game/worldClock";
import { AudioManager } from "@/lib/game/audio";
import { localAvatar } from "@/lib/net/localAvatar";
import { FX_BENCH, fxOn } from "@/lib/game/perf/fxBench";
import { CHARACTER_HEIGHT, type CharacterMotion } from "../character/Character";

/** A note off a dancer's head: rises and sways (the row's frames cycle), drifts with the wind a little. */
export const NOTE: Recipe = { sprite: "note", count: [1, 1], life: [1.5, 1.9], size: [0.4, 0.48], grow: 1.1, speed: [0.05, 0.16], spread: Math.PI,
  up: [0.55, 0.7], gravity: 0, drag: 0.7, wind: 0.25, lift: 0.5, fps: 7, alpha: 1, face: FACE.billboard, jitter: 0.12, rise: [0.25, 0.35], fadeIn: 6 };
/** The notes' colours, one per dancer in turn (warm cream, blush, mint, butter, sky). */
const NOTE_TINTS = [0xfff1c9, 0xffc4d6, 0xc9f2dc, 0xffe28a, 0xc7e3ff] as const;
/** At most this many notes leave a beat, however many dance. */
export const NOTES_PER_BEAT = 8;
/** Notes only within this far of you (u): the shared pool is for what you can see. */
const NOTE_RANGE = 32;
/** The soft beat: full within SOFT_NEAR of the nearest dancer in a group, gone by SOFT_FAR. */
const SOFT_NEAR = 4, SOFT_FAR = 18;

/** The frame's scratch: you first (when dancing), then the remotes dancing. */
const N = FIELD_MAX + 1;
const xs = new Float64Array(N), ys = new Float64Array(N), zs = new Float64Array(N), groups = new Int16Array(N), sizes = new Int16Array(N);
const motions = new Array<CharacterMotion | null>(N).fill(null), stompers = new Uint8Array(N);
const state = { beat: -1, mineBeat: false };

/** Module scope (the react compiler forbids writing through hook values). */
function syncDancers(you: THREE.Vector3, pool: ReturnType<typeof useMoveParticles>["pool"]) {
  const clock = worldTime(), me = localAvatar()?.motion.current ?? null;
  let n = 0;
  if (me && isDance(me.pose)) { xs[0] = you.x; ys[0] = you.y; zs[0] = you.z; motions[0] = me; stompers[0] = me.pose === "DanceStomp" ? 1 : 0; n = 1; }
  else if (me && state.mineBeat) { me.beat = null; state.mineBeat = false; }
  const f = remoteField, others = !FX_BENCH || fxOn("dance");
  for (let i = 0; i < f.n && n < N; i++) {
    const m = f.motion[i];
    if (!m) continue;
    if (!others || !isDance(m.pose)) { if (m.beat != null) m.beat = null; continue; }
    xs[n] = f.x[i]; ys[n] = f.y[i]; zs[n] = f.z[i]; motions[n] = m; stompers[n] = m.pose === "DanceStomp" ? 1 : 0; n++;
  }
  const g = danceGroups(xs, zs, n, groups);
  sizes.fill(0, 0, g);
  for (let i = 0; i < n; i++) sizes[groups[i]]++;
  let soft = Infinity;
  for (let i = 0; i < n; i++) {
    const together = sizes[groups[i]] >= 2, m = motions[i]!;
    m.beat = together ? clock : null;
    if (m === me) state.mineBeat = together;
    if (together && !stompers[i]) soft = Math.min(soft, Math.hypot(xs[i] - you.x, zs[i] - you.z));
  }
  // Notes on the beat: each dancer in a group every other beat (staggered), the nearest first in list order.
  const beat = Math.floor(clock / BEAT_S);
  if (beat !== state.beat) {
    state.beat = beat;
    let thrown = 0;
    for (let i = 0; i < n && thrown < NOTES_PER_BEAT; i++) {
      if (sizes[groups[i]] < 2 || (beat + i) % 2 !== 0 || Math.hypot(xs[i] - you.x, zs[i] - you.z) > NOTE_RANGE) continue;
      const y = ys[i] + CHARACTER_HEIGHT;
      pool.burst(NOTE, xs[i], y, zs[i], y - 2, 0, 0, 1, NOTE_TINTS[(beat + i) % NOTE_TINTS.length], seedAt(xs[i], zs[i], beat));
      thrown++;
    }
  }
  const k = soft === Infinity ? 0 : soft <= SOFT_NEAR ? 1 : soft >= SOFT_FAR ? 0 : (1 - (soft - SOFT_NEAR) / (SOFT_FAR - SOFT_NEAR)) ** 2;
  AudioManager.setLoop(SOFT_BEAT.src, SOFT_BEAT.gain * k);
}

export default function DanceSync({ player }: { player: RefObject<THREE.Vector3> }) {
  const particles = useMoveParticles();
  useFrame(() => syncDancers(player.current, particles.pool), -2);
  useEffect(() => () => { AudioManager.setLoop(SOFT_BEAT.src, 0); clearRemoteField(); }, []);
  return null;
}
