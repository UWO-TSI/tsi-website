/**
 * Movement juice on a remote player (specs/multiplayer.md §5.6; look spec §7.1: an action's effect belongs to the
 * avatar that acted). Each event their sim journaled, at the interpolated spot it fires at, throws the same painted
 * particles your own moves do (lib/game/movement/juice.ts) at 0.7 of yours: the take-off, the landing by its drop, the
 * dash's burst and streaks, the slide's spray, the leaf opening and folding, the splash, the hands on a ledge. Full
 * tier only (the driver checks), never a sound, a camera kick, a flash or slow motion. Module scope, no allocation.
 */
import type { ParticlePool } from "@/lib/game/fx/particles";
import { CHARACTER_SCALE } from "@/components/game/character/Character";
import { WORLD_SNOW } from "@/lib/game/modelMaterials";
import { dashBurst, glideFurl, glideOpen, glideSetDown, groundUnder, landKind, landing, mantleGrab, slideBurst, slidePop, splash, streak, takeoff, type GroundKind } from "@/lib/game/movement/juice";
import type { EvKind } from "@/lib/net/protocol";
import type { RemoteSample } from "@/lib/net/types";

/** How much of your own juice a remote's moves throw. */
export const REMOTE_JUICE = 0.7;
/** The leaf's grip above the feet while gliding (PlayerAvatar GRIP_Y: build_clips.py GLIDE_GRIP × the character's scale). */
const GRIP_Y = 0.58 * CHARACTER_SCALE;
/** A dash lasts this long (MOVE_TUNING.dashTime); streaks follow it this often (PlayerAvatar STREAK_EVERY). */
const DASH_S = 0.2, STREAK_EVERY = 0.05;
/** Below this drop a landing is too small to feel (PlayerAvatar). */
const MIN_DROP = 0.15;

/** The ground the scene's remotes walk on, for each effect's dust and tint: the drawn surface (none indoors) and the water. */
export interface FxGround { surface?: (x: number, z: number) => number; wet: (x: number, z: number) => boolean }

/** Per remote: the dash in progress (seconds left), the next streak, the streak slots used. */
export interface FxState { dashT: number; streakT: number; streakK: number }
export const createFxState = (): FxState => ({ dashT: 0, streakT: 0, streakK: 0 });

/** One-shot clips and the like travel among the movement events in a frame. */
const CLIP_KINDS: ReadonlySet<EvKind> = new Set<EvKind>(["play", "upper", "ghost", "stop"]);
/** The nearest movement event from slot `from` on (step -1: back, 1: on) among a frame's events, past any clips; or null. */
export function moveAt(s: RemoteSample, from: number, step: 1 | -1): EvKind | null {
  for (let k = from; k >= 0 && k < s.eventCount; k += step) if (!CLIP_KINDS.has(s.events[k].kind)) return s.events[k].kind;
  return null;
}

const groundAt = (w: FxGround, x: number, z: number): GroundKind => groundUnder(w.surface?.(x, z), WORLD_SNOW.value, w.wet, x, z);
const TAKEOFF: ReadonlySet<EvKind> = new Set<EvKind>(["jump", "hop", "long", "dashjump"]);
const ALOFT: ReadonlySet<string> = new Set(["Air", "Fall", "Glide"]);

/**
 * One event's juice. `prev` and `next` are the events either side of it in the same frame (a landing that launches a
 * hop leaves its thump to the hop; a landing out of a glide is the leaf's soft set-down; a furl right before a landing
 * leaves the leaf bits to it). `groundY` is the floor under them, `waterY` the water's surface when they splash.
 */
export function remoteJuice(pool: ParticlePool, w: FxGround, f: FxState, kind: EvKind, value: number, s: RemoteSample, groundY: number, waterY: number,
  prev: EvKind | null, next: EvKind | null, amount = REMOTE_JUICE): void {
  const { x, z, vx, vz } = s;
  switch (kind) {
    case "jump": case "long": case "dashjump":
      takeoff(pool, groundAt(w, x, z), x, groundY, z, vx, vz, amount); return;
    case "hop":
      takeoff(pool, groundAt(w, x, z), x, groundY, z, vx, vz, amount, true); return;
    case "slidejump":
      slidePop(pool, groundAt(w, x, z), x, groundY, z, vx, vz, amount); return;
    case "dashslide": case "landslide":
      slideBurst(pool, groundAt(w, x, z), x, groundY, z, vx, vz, amount * (kind === "landslide" ? 0.7 : 1)); return;
    case "land": {
      if (next && TAKEOFF.has(next)) return;
      if (prev === "furl") { glideSetDown(pool, groundAt(w, x, z), x, groundY, z, amount); return; }
      if (value < MIN_DROP) return;
      landing(pool, groundAt(w, x, z), landKind(value), x, groundY, z, vx, vz, amount);
      return;
    }
    case "dash": {
      const speed = Math.hypot(vx, vz), dx = speed > 0.5 ? vx / speed : Math.sin(s.yaw), dz = speed > 0.5 ? vz / speed : Math.cos(s.yaw);
      dashBurst(pool, groundAt(w, x, z), s.move !== null && ALOFT.has(s.move), x, s.y, z, groundY, dx, dz, amount);
      for (let k = 0; k < 2; k++) streak(pool, x, s.y, z, groundY, dx, dz, Math.max(speed, 12), f.streakK++, amount);
      f.dashT = DASH_S; f.streakT = STREAK_EVERY;
      return;
    }
    case "glide":
      glideOpen(pool, x, s.y + GRIP_Y + 0.95, z, groundY, amount); return;
    case "furl":
      if (next !== "land" && next !== "splash" && next !== "mantle") glideFurl(pool, x, s.y + GRIP_Y + 0.9, z, groundY, amount);
      return;
    case "splash":
      splash(pool, x, waterY + 0.02, z, amount, value); return;
    case "mantle": {
      // Hands on the lip: a step ahead of them, `value` (the rise) above where they started the climb.
      const fx = Math.sin(s.yaw), fz = Math.cos(s.yaw), hx = x + fx * 0.35, hz = z + fz * 0.35;
      mantleGrab(pool, groundAt(w, hx, hz), hx, s.y + value, hz, fx, fz, amount);
      return;
    }
  }
}

/** Streaks along a dash while it lasts (each frame, after the frame's events); a teleport ends it. */
export function remoteDashTrail(pool: ParticlePool, f: FxState, s: RemoteSample, groundY: number, dt: number, amount = REMOTE_JUICE): void {
  if (f.dashT <= 0) return;
  if (s.snapped) { f.dashT = 0; return; }
  f.dashT -= dt;
  f.streakT -= dt;
  const speed = Math.hypot(s.vx, s.vz);
  if (f.streakT > 0 || speed < 0.5) return;
  f.streakT = STREAK_EVERY;
  streak(pool, s.x, s.y, s.z, groundY, s.vx / speed, s.vz / speed, speed, f.streakK++, 0.85 * amount);
}
