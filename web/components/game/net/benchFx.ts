/**
 * Development only: what the character-effect bench (lib/game/perf/fxBench.ts, specs/perf/fx-bench.mjs) does to the
 * other players. The driver (RemoteAvatars) calls these only while FX_BENCH is on; nothing here runs in production.
 *
 * - The formation: every remote stands in a block in front of you (rows of six, 1.5 u apart, from 3.5 u out), so 1, 12
 *   or 24 of them are in view and near whatever the bots are doing. Their own motion still plays on the spot.
 * - Forced effects, staggered by player so they never all fire on one frame: an afterimage every 0.4 s (`ghost`), an
 *   emote every 3 s (`emotes`), everyone dancing in one group (`dance`), the leaf open (`leaf`), a rod in hand with its rig idle (`rod`), the rod with a cast
 *   floating 4 u ahead (`fishing`) and a movement
 *   event every 0.5 s cycling through the take-off, landing, dash, slide, glide and splash (`juice`).
 */
import * as THREE from "three";
import type { ParticlePool } from "@/lib/game/fx/particles";
import { fxForced } from "@/lib/game/perf/fxBench";
import type { FishingState } from "@/lib/game/fishingRig";
import { EMOTE_CLIP_NAMES, type EvKind } from "@/lib/net/protocol";
import type { RemoteSample } from "@/lib/net/types";
import { DANCE_CLIPS, type ClipName } from "@/lib/game/character/clips";
import type { GroundWorld, RemoteRig } from "./drive";
import { remoteJuice, type FxGround } from "./fx";
import { FULL } from "./lod";
import { TOOLS } from "@/lib/game/tools";
import { WEAPONS } from "@/lib/game/combat/data";
import type { FxBenchState } from "@/lib/game/perf/fxBench";

const PER_ROW = 6, FIRST = 3.5, ROW = 2.2, COL = 1.5;
const fwd = new THREE.Vector3();

/** Where the block stands: fixed when the formation turns on (your spot and the camera's heading then). */
interface Block { x: number; z: number; fx: number; fz: number; ground: Map<number, number> }
let block: Block | null = null;
export function resetFormation() { block = null; }

/** Rewrite a remote's sampled position to its slot in the block (rank `i` in the registry), at the slot's ground. */
export function placeInFormation(s: RemoteSample, i: number, you: THREE.Vector3, camera: THREE.Camera, world: GroundWorld) {
  if (!block) {
    camera.getWorldDirection(fwd);
    const len = Math.hypot(fwd.x, fwd.z) || 1;
    block = { x: you.x, z: you.z, fx: fwd.x / len, fz: fwd.z / len, ground: new Map() };
  }
  const row = Math.floor(i / PER_ROW), col = (i % PER_ROW) - (PER_ROW - 1) / 2, d = FIRST + row * ROW;
  const x = block.x + block.fx * d - block.fz * col * COL, z = block.z + block.fz * d + block.fx * col * COL;
  let y = block.ground.get(i);
  if (y === undefined) block.ground.set(i, (y = world.top(x, z)));
  s.x = x; s.z = z; s.y = y; s.snapped = false;
}

/** The bench's forced one-shots and holds on a Full remote this frame (`t` room seconds, `i` its rank). */
/** The five emote clips every rig has today; the v1 wheel and dances append to EMOTE_CLIP_NAMES as their clips land. */
const BENCH_EMOTES = EMOTE_CLIP_NAMES.slice(0, 5) as readonly ClipName[];
/** The eight dances of the wheel (DANCE_CLIPS' first eight), one per player in turn. */
const BENCH_DANCES = DANCE_CLIPS.slice(0, 8);

export function forceMotion(r: RemoteRig, i: number, t: number, dt: number) {
  const m = r.motion, full = r.lod.tier === FULL, phase = (t + i * 0.137) % 1e6;
  if (fxForced("leaf")) m.leaf = 1;
  // A forced cast is the bench's to take back (remote casts aren't sent: nothing else clears it).
  if (!fxForced("fishing") && m.fishing && m.fishing === casts.get(r)) m.fishing = null;
  if (!full) return;
  if (fxForced("ghost") && crossed(phase, dt, 0.4)) m.ghost = true;
  if (fxForced("emotes") && crossed(phase, dt, 3)) m.play = BENCH_EMOTES[Math.floor(phase / 3) % BENCH_EMOTES.length];
  // Everyone dancing, each their own move, in one group (the block is well within 6 u): the beat sync and the notes.
  if (fxForced("dance")) { m.pose = BENCH_DANCES[i % BENCH_DANCES.length]; m.speed = 0; m.move = null; }
  if (fxForced("fishing")) m.fishing = castFor(r);
}

/** A movement event every half second on each Full remote, cycling the kinds, through the same juice as a real one. */
const JUICE: readonly [EvKind, number][] = [["jump", 0], ["land", 1], ["dash", 0], ["dashslide", 0], ["glide", 0], ["land", 2.2], ["hop", 0], ["splash", 1.5]];
const counters = new WeakMap<RemoteRig, number>();
export function forceJuice(pool: ParticlePool, ground: FxGround, r: RemoteRig, i: number, t: number, dt: number) {
  if (!fxForced("juice") || r.lod.tier !== FULL || !crossed(t + i * 0.137, dt, 0.5)) return;
  const k = counters.get(r) ?? 0, [kind, value] = JUICE[k % JUICE.length];
  counters.set(r, k + 1);
  remoteJuice(pool, ground, r.fx, kind, value, r.sample, r.groundY, r.groundY, null, null);
}

/** Whether a clock at `t` passed a multiple of `every` within the last `dt`. */
const crossed = (t: number, dt: number, every: number) => Math.floor(t / every) !== Math.floor((t - dt) / every);

const casts = new WeakMap<RemoteRig, FishingState>();
/** A cast floating 4 u ahead of the remote (re-aimed when it turns), with a nibble now and then (FishingRig's clock: performance.now). */
function castFor(r: RemoteRig): FishingState {
  let c = casts.get(r);
  const s = r.sample, dx = Math.sin(s.yaw), dz = Math.cos(s.yaw), ms = performance.now();
  if (!c) {
    c = { local: false, phase: "float", since: ms - 2000, power: 0.6, fromX: s.x, fromZ: s.z, spotX: s.x + dx * 4, spotZ: s.z + dz * 4, landX: s.x + dx * 4, landZ: s.z + dz * 4,
      waterY: r.groundY, dirX: dx, dirZ: dz, rate: 1, seed: r.sid, nibbleAt: -Infinity, pull: 0, tension: 0, reeling: false, reeled: 0, snapped: false,
      catchModel: null, catchRaw: false, catchCm: null, showOff: false };
    casts.set(r, c);
  }
  if (Math.abs(c.dirX - dx) + Math.abs(c.dirZ - dz) > 0.2 || Math.abs(c.fromX - s.x) + Math.abs(c.fromZ - s.z) > 0.5) {
    Object.assign(c, { fromX: s.x, fromZ: s.z, spotX: s.x + dx * 4, spotZ: s.z + dz * 4, landX: s.x + dx * 4, landZ: s.z + dz * 4, dirX: dx, dirZ: dz, waterY: r.groundY });
  }
  if (ms - c.nibbleAt > 2500) c.nibbleAt = ms;
  return c;
}

/** What a remote holds on the bench (`held` as the wire has it): a forced item, or theirs less what is switched off. */
const HAND_TOOLS = TOOLS.filter(t => t.kind !== "rod"), ROD = TOOLS.find(t => t.kind === "rod")!;
const ARMS = Object.keys(WEAPONS).filter(k => WEAPONS[k].model);
export function benchHeld(fx: FxBenchState, sid: number, held: string): string {
  if (fx.force.has("fishing") || fx.force.has("rod")) return `rod:${ROD.key}`;
  if (fx.force.has("weapon")) return `weapon:${ARMS[sid % ARMS.length]}`;
  if (fx.force.has("held")) { const t = HAND_TOOLS[sid % HAND_TOOLS.length]; return `${t.kind}:${t.key}`; }
  if (held.startsWith("weapon:")) return fx.off.has("weapon") ? "" : held;
  if (held.startsWith("rod:")) return fx.off.has("rod") || fx.off.has("held") ? "" : held;
  return fx.off.has("held") ? "" : held;
}
/** The weapon on the back, unless weapons are off. */
export const benchBack = (fx: FxBenchState, back: string): string => (fx.off.has("weapon") ? "" : back);
