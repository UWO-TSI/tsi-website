/**
 * An avatar's fishing as its own state (specs/polish/fishing.md; look spec §7.1). The cast, the bobber, the line and
 * the catch are drawn from it on the avatar that owns it (CharacterMotion.fishing; components/game/fishing/FishingRig),
 * never from "the" player, so a remote angler shows the same once its state arrives. The local player's state follows
 * the overlay's events (useWorldClips) and its live inputs (`live`: the wind-up's depth, the reel), which only the
 * local overlay writes. The pure helpers say where the bobber is at a moment of the cast, so every client agrees.
 * Times are this client's performance.now() in ms; nothing here allocates on the frame path.
 */
import { CLIP_BY_NAME } from "./character/look";
import { castLanding, thrash } from "./fishingCast";
import { seedAt } from "./fx/particles";

/**
 * The cast's beats: charging (the wind-up), swing (the rod whips; the bobber leaves its tip at the release, flies,
 * lands), float (waiting; nibbles dip it), bite (pulled under, thrashing), reel (the fight), landed (the catch comes
 * out of the water), escaped (it got away: the line goes slack, the bobber bobs back up), reelin (the bobber comes home).
 */
export type CastPhase = "charging" | "swing" | "float" | "bite" | "reel" | "landed" | "escaped" | "reelin";

export interface FishingState {
  /** This client's own player: its landing starts the overlay's wait, its bite shakes this camera. */
  local: boolean;
  phase: CastPhase;
  /** When this phase began (ms). */
  since: number;
  /** The wind-up's depth while charging, then the cast's power (0..1). */
  power: number;
  /** Where the avatar stood and the water spot it aimed at. */
  fromX: number; fromZ: number; spotX: number; spotZ: number;
  /** Where the bobber lands (on water, short of the far bank), the water's height there, and the throw's direction. */
  landX: number; landZ: number; waterY: number; dirX: number; dirZ: number;
  /** The swing's playback rate: a harder cast whips faster. */
  rate: number;
  /** The cast's seed, from its landing spot: its thrash and its splashes are the same on every client. */
  seed: number;
  /** The last nibble (ms; -Infinity: none yet). */
  nibbleAt: number;
  /** While reeling: where the fish pulls across the throw (-1..1), the line's tension (0..1), the reel held, how far in (0..1). */
  pull: number; tension: number; reeling: boolean; reeled: number;
  /** An escape after the hook (the line snaps), or a missed bite (the bobber just bobs back up). */
  snapped: boolean;
  /** The catch shown once landed (the species' model; `raw` dump exports take the game calibration) and its size. */
  catchModel: string | null; catchRaw: boolean; catchCm: number | null;
  /** Shown off in both hands while its card is up (the angler's Hold up my catch, fishingPrefs.ts), or over the head. */
  showOff: boolean;
}

/** The water the scene fishes in (PeacefulLayer sets its island's): where a throw may land, the surface's height there. */
export const sceneWater: { isWater: (x: number, z: number) => boolean; height: (x: number, z: number) => number } = { isWater: () => true, height: () => 0 };
export function setSceneWater(isWater: (x: number, z: number) => boolean, height: (x: number, z: number) => number) {
  sceneWater.isWater = isWater;
  sceneWater.height = height;
}

/** The local overlay's live numbers (its loops write them; the local avatar's state reads them each frame). */
export const live = { power: 0, pull: 0, tension: 0, reeling: false, reeled: 0 };

/** A cast starting: the avatar at (fromX, fromZ) winds up toward the water spot. */
export function newCast(local: boolean, fromX: number, fromZ: number, spotX: number, spotZ: number, now: number): FishingState {
  return {
    local, phase: "charging", since: now, power: 0, fromX, fromZ, spotX, spotZ,
    landX: spotX, landZ: spotZ, waterY: 0, dirX: 0, dirZ: 1, rate: 1, seed: 0, nibbleAt: Number.NEGATIVE_INFINITY,
    pull: 0, tension: 0, reeling: false, reeled: 0, snapped: false, catchModel: null, catchRaw: false, catchCm: null, showOff: true,
  };
}

const landing = { x: 0, z: 0 };
/** The release: where the throw lands on the scene's water (lib/game/fishingCast.ts), how hard it whips, its seed. */
export function throwCast(f: FishingState, power: number, now: number, water = sceneWater): FishingState {
  castLanding(water.isWater, f.fromX, f.fromZ, f.spotX, f.spotZ, power, landing);
  const dx = f.spotX - f.fromX, dz = f.spotZ - f.fromZ, l = Math.hypot(dx, dz);
  f.phase = "swing"; f.since = now; f.power = Math.min(1, Math.max(0, power));
  f.landX = landing.x; f.landZ = landing.z; f.waterY = water.height(landing.x, landing.z);
  f.dirX = l > 1e-6 ? dx / l : 0; f.dirZ = l > 1e-6 ? dz / l : 1;
  f.rate = 0.9 + 0.3 * f.power;
  f.seed = seedAt(landing.x, landing.z, 61);
  return f;
}

/** Move to a beat now (the overlay's events, or a remote angler's). */
export function castBeat(f: FishingState, phase: CastPhase, now: number): FishingState {
  f.phase = phase;
  f.since = now;
  return f;
}

const SWING = CLIP_BY_NAME.get("CastSwing");
/** Seconds from the cast to the bobber leaving the rod's tip: CastSwing's release key at the cast's rate. */
export const releaseAfter = (rate: number) => ((SWING?.release ?? 0.32) * (SWING?.length ?? 0.8)) / rate;
/** The bobber's flight from the tip to the water (s): a longer throw hangs a little longer. */
export const flightTime = (distance: number) => Math.min(0.75, 0.36 + 0.055 * distance);
/** How high the throw arcs over the straight line (u). */
export const arcHeight = (distance: number, power: number) => 0.45 + 0.45 * power + 0.08 * distance;
/** How long the bobber takes to come home to the rod's tip when a cast ends (s); then the cast is over. */
export const HOME_S = 0.35;
/** How far the bobber rides above the water while it floats (its belly is under). */
export const FLOAT = 0.035;

export interface BobberPose { x: number; y: number; z: number; /** How far under it is pulled: 0 floating, 1 under. */ under: number }

/** The bobber in flight, `k` (0..1) of the way from the release point to its landing, along an arc that lands on the water. */
export function flightAt(f: FishingState, x0: number, y0: number, z0: number, k: number, out: BobberPose): BobberPose {
  const u = Math.min(1, Math.max(0, k)), y1 = f.waterY + FLOAT;
  const d = Math.hypot(f.landX - x0, f.landZ - z0);
  out.x = x0 + (f.landX - x0) * u;
  out.z = z0 + (f.landZ - z0) * u;
  out.y = y0 + (y1 - y0) * u + Math.sin(u * Math.PI) * arcHeight(d, f.power);
  out.under = 0;
  return out;
}

const shake = { x: 0, y: 0, z: 0 };
/**
 * The bobber on the water `t` seconds into the beat: floating with a slow bob (a nibble dips it), pulled under and
 * thrashing on the bite, dragged with the fish while reeling (across the throw as it pulls, in toward the bank as it
 * is reeled); `now` is for the nibble's dip.
 */
export function bobberOnWater(f: FishingState, t: number, now: number, out: BobberPose): BobberPose {
  out.x = f.landX; out.z = f.landZ; out.under = 0;
  if (f.phase === "bite" || f.phase === "reel" || f.phase === "landed") {
    thrash(t, f.seed, shake);
    const reel = f.phase !== "bite";
    // Across the throw as the fish pulls, toward the spot (the bank side) as it is reeled in.
    const across = reel ? f.pull * 0.8 : 0, home = reel ? f.reeled * 0.85 : 0;
    out.x += -f.dirZ * across + (f.spotX - f.landX) * home + shake.x * (reel ? 0.6 : 1);
    out.z += f.dirX * across + (f.spotZ - f.landZ) * home + shake.z * (reel ? 0.6 : 1);
    out.y = f.waterY + shake.y * (reel ? 0.8 : 1);
    out.under = 1;
    return out;
  }
  const since = (now - f.nibbleAt) / 1000;
  // A nibble: a quick tug under, then it pops back with a small overshoot.
  const dip = since >= 0 && since < 0.42 ? -0.07 * Math.sin((since / 0.42) * Math.PI) * (1 - since / 0.84) : 0;
  out.y = f.waterY + FLOAT + 0.012 * Math.sin(t * 2.6) + dip;
  out.under = dip < -0.03 ? 0.5 : 0;
  return out;
}
