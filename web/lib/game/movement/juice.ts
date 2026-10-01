/**
 * Movement juice rules (specs/movement-feel.md deliverables 3 and 4): the
 * ground under the feet, and what each move throws from our particle pack
 * and how it sounds there. Pure: PlayerAvatar calls these from each sim
 * event and foot contact, on the avatar that moved, with a seed from the
 * event's spot, so any client replays the same burst (look spec §7.1).
 */
import type { SFXName } from "@/lib/game/audio";
import { FACE, seedAt, type ParticlePool, type Recipe } from "@/lib/game/fx/particles";
import { Surface } from "@/lib/game/grid";

// ── The ground under the feet ────────────────────────────────────────
export type GroundKind = "grass" | "sand" | "wetSand" | "soil" | "stone" | "wood" | "snow" | "water";

/** How far round a sand point to look for the waterline: the drawn wet band (grid WET) is dark to 0.35 cells and dry by 1.2. */
const WET_REACH = 0.8;
const WET_PROBES = Array.from({ length: 8 }, (_, k) => [Math.sin((k * Math.PI) / 4) * WET_REACH, Math.cos((k * Math.PI) / 4) * WET_REACH] as const);

/**
 * One lookup for every move: the cell's surface (grid `Surface`), the season's snow cover (0..1, WORLD_SNOW), and the
 * walker's `wet` for the waterline. Ramps wear the grass they join; snow covers all but the boards (bridges, decks).
 * Scenes pass the drawn surface (grid `drawnSurfaceAt`), so the effect matches the ground you see.
 */
export function groundUnder(surface: number | undefined, snow: number, wet: (x: number, z: number) => boolean, x: number, z: number): GroundKind {
  // Over water but not in it: a deck (the wharf). With no surface at all (an interior) it's a plain floor's dust.
  if (surface === Surface.River || surface === Surface.Void) return wet(x, z) ? "water" : "wood";
  if (surface === undefined) return snow >= 0.5 ? "snow" : "soil";
  if (surface === Surface.Wood) return "wood";
  if (snow >= 0.5) return "snow";
  if (surface === Surface.Stone || surface === Surface.Brick) return "stone";
  if (surface === Surface.Soil) return "soil";
  if (surface === Surface.Sand) {
    for (const [dx, dz] of WET_PROBES) if (wet(x + dx, z + dz)) return "wetSand";
    return "sand";
  }
  return "grass";
}

/** Per ground: the dust tint (sRGB), what a footstep throws, what a landing adds to the ring, a skid's scuff (0: none) and the step sound. */
interface GroundFx { dust: number; step: readonly Recipe[]; stepTint: number; extra: Recipe | null; extraTint: number; scuff: number; sound: { name: SFXName; rate: number; gain: number } }

// ── Recipes: sizes in world units (a character stands 1.36), speeds u/s ──
const B = FACE.billboard;
const STEP_PUFF: Recipe = { sprite: "dust", count: [1, 1], life: [0.42, 0.55], size: [0.42, 0.5], grow: 1.5, speed: [0.25, 0.5], spread: 0.6, up: [0.25, 0.45], gravity: 0, drag: 4, wind: 0.6, lift: 0.15, alpha: 0.85, face: B, rise: [0.14, 0.2] };
const STEP_MOTE: Recipe = { ...STEP_PUFF, size: [0.34, 0.4], life: [0.34, 0.44], alpha: 0.75, rise: [0.12, 0.16] };
const STEP_FLECKS: Recipe = { sprite: "grass", count: [3, 3], life: [0.4, 0.52], size: [0.5, 0.58], grow: 1, speed: [0.6, 1.2], spread: 1.1, up: [1.6, 2.3], gravity: 9, drag: 1.5, wind: 0.3, spin: 4, fps: 16, alpha: 1, face: B, rise: [0.05, 0.1] };
const STEP_SAND: Recipe = { sprite: "sand", count: [1, 1], life: [0.44, 0.52], size: [0.9, 1.0], grow: 1.2, speed: [0.5, 0.8], spread: 0.5, up: [0.5, 0.8], gravity: 2.5, drag: 3, wind: 0.3, alpha: 1, face: B, rise: [0.16, 0.2] };
const STEP_WET_SAND: Recipe = { ...STEP_SAND, size: [0.6, 0.68], up: [0.6, 0.9], gravity: 6, alpha: 0.85, wind: 0 };
const STEP_SNOW: Recipe = { sprite: "snow", count: [1, 2], life: [0.45, 0.6], size: [0.42, 0.5], grow: 1.4, speed: [0.3, 0.6], spread: 0.8, up: [0.3, 0.6], gravity: 0.6, drag: 3.5, wind: 0.5, alpha: 0.95, face: B, rise: [0.14, 0.18] };
const RAIN_RIPPLE: Recipe = { sprite: "ripple", count: [1, 1], life: [0.55, 0.7], size: [0.55, 0.65], grow: 1.5, speed: [0, 0], spread: 0, up: [0, 0], gravity: 0, drag: 0, wind: 0, alpha: 0.6, face: FACE.ground };
const RAIN_DROPS: Recipe = { sprite: "droplets", count: [1, 1], life: [0.3, 0.38], size: [0.3, 0.36], grow: 1, speed: [0.3, 0.6], spread: 1.2, up: [1.2, 1.8], gravity: 9, drag: 1, wind: 0.1, alpha: 0.85, face: B };

/** Take-off: dust kicked back from the feet. */
export const KICK: Recipe = { sprite: "dust", count: [3, 4], life: [0.45, 0.6], size: [0.5, 0.65], grow: 1.7, speed: [0.8, 1.5], spread: 0.75, up: [0.2, 0.55], gravity: 0, drag: 4.5, wind: 0.6, lift: 0.2, alpha: 0.9, face: B, jitter: 0.12, rise: [0.14, 0.22] };
/** Landing: a low ring of dust spreading along the ground; heavier drops a bigger one. */
export const RING: Recipe = { sprite: "dustLow", count: [6, 7], life: [0.5, 0.62], size: [0.6, 0.75], grow: 1.45, speed: [1.5, 2.1], spread: 0, up: [0, 0.08], gravity: 0, drag: 5, wind: 0.5, lift: 0.05, alpha: 0.9, face: FACE.standing, jitter: 0.1 };
const RING_HEAVY: Recipe = { ...RING, count: [10, 12], size: [0.75, 0.95], speed: [2.3, 3.2], life: [0.6, 0.75] };
const MOTES: Recipe = { sprite: "dust", count: [2, 3], life: [0.3, 0.4], size: [0.28, 0.34], grow: 1.4, speed: [0.4, 0.8], spread: Math.PI, up: [0.2, 0.4], gravity: 0, drag: 4, wind: 0.6, lift: 0.1, alpha: 0.6, face: B, rise: [0.1, 0.14] };
const PLUME: Recipe = { sprite: "dust", count: [3, 3], life: [0.6, 0.75], size: [0.75, 0.9], grow: 1.6, speed: [0.3, 0.6], spread: Math.PI, up: [0.6, 0.9], gravity: 0, drag: 3, wind: 0.6, lift: 0.4, alpha: 0.85, face: B, rise: [0.2, 0.3] };
const FLECKS: Recipe = { ...STEP_FLECKS, count: [4, 5], speed: [1.2, 2], up: [2, 3] };
const SAND_BURST: Recipe = { ...STEP_SAND, count: [2, 3], size: [0.7, 0.8], speed: [1, 1.8], up: [0.8, 1.4], spread: Math.PI };
const SNOW_BURST: Recipe = { ...STEP_SNOW, count: [3, 4], speed: [0.8, 1.4], spread: Math.PI };

const GROUND: Record<GroundKind, GroundFx> = {
  grass: { dust: 0xd8cfa8, step: [STEP_FLECKS, STEP_MOTE], stepTint: 0xdbe6a2, extra: FLECKS, extraTint: 0xdbe6a2, scuff: 0x8fa16c, sound: { name: "footstep", rate: 1, gain: 1 } },
  soil: { dust: 0xd6bd94, step: [STEP_PUFF], stepTint: 0xd6bd94, extra: null, extraTint: 0, scuff: 0xba9664, sound: { name: "footstep", rate: 0.92, gain: 1 } },
  sand: { dust: 0xe9d3a0, step: [STEP_SAND, STEP_MOTE], stepTint: 0xd8bd85, extra: SAND_BURST, extraTint: 0xd8bd85, scuff: 0xe2cb93, sound: { name: "footstep", rate: 0.8, gain: 0.85 } },
  wetSand: { dust: 0xc9b282, step: [STEP_WET_SAND], stepTint: 0xb49c6c, extra: SAND_BURST, extraTint: 0xb49c6c, scuff: 0xb49c6c, sound: { name: "footstep", rate: 0.72, gain: 0.9 } },
  snow: { dust: 0xf4f8fc, step: [STEP_SNOW], stepTint: 0xf4f8fc, extra: SNOW_BURST, extraTint: 0xf4f8fc, scuff: 0, sound: { name: "footstep", rate: 0.66, gain: 0.85 } },
  // Built ground: a footstep is only its sound; a landing raises a little pale dust.
  stone: { dust: 0xdcd7cf, step: [], stepTint: 0, extra: null, extraTint: 0, scuff: 0, sound: { name: "blip3", rate: 1, gain: 0.7 } },
  wood: { dust: 0xd8c3a0, step: [], stepTint: 0, extra: null, extraTint: 0, scuff: 0, sound: { name: "blip4", rate: 1, gain: 0.7 } },
  water: { dust: 0xd4ecf7, step: [RAIN_DROPS], stepTint: 0xd4ecf7, extra: null, extraTint: 0, scuff: 0, sound: { name: "blip5", rate: 1, gain: 0.8 } },
};
const HARD = new Set<GroundKind>(["stone", "wood"]);

export const stepSound = (g: GroundKind) => GROUND[g].sound;

/** Salts keep two bursts of one event apart. */
const SALT = { step: 1, rain: 2, kick: 3, extra: 4, ring: 5, plume: 6, dash: 7, side: 8, air: 9, swirl: 10, streak: 11, trail: 12, settle: 13, wisp: 14, ready: 15, splash: 16, ripple: 17, leaf: 18, mantle: 19, scuff: 20, sit: 21 };

/**
 * A foot comes down: flecks and a mote on grass, a sand kick, a snow puff, a dust puff on soil; nothing on stone or
 * wood but the sound. On a rain day every step but the boards also leaves a ripple. Size follows speed; returns the sound.
 */
export function footstep(pool: ParticlePool, g: GroundKind, x: number, y: number, z: number, vx: number, vz: number, rain: boolean, amount = 1) {
  const fx = GROUND[g], speed = Math.hypot(vx, vz), scale = (0.8 + Math.min(speed, 14) * 0.035) * amount;
  if (amount > 0) {
    for (let k = 0; k < fx.step.length; k++) pool.burst(fx.step[k], x, y, z, y, -vx, -vz, scale, fx.stepTint, seedAt(x, z, SALT.step + k * 31));
    if (rain && g !== "wood") {
      pool.burst(RAIN_RIPPLE, x, y + 0.02, z, y, 0, 0, amount, 0xe4f4fb, seedAt(x, z, SALT.rain));
      pool.burst(RAIN_DROPS, x, y, z, y, -vx, -vz, amount, 0xd4ecf7, seedAt(x, z, SALT.rain + 1));
    }
  }
  return fx.sound;
}

/** Take-off: dust kicked back from the feet (a ring of motes from a standing jump); the ground's flecks or grains with it. */
export function takeoff(pool: ParticlePool, g: GroundKind, x: number, y: number, z: number, vx: number, vz: number, amount = 1, hop = false) {
  if (amount <= 0) return;
  const fx = GROUND[g], speed = Math.hypot(vx, vz), soft = HARD.has(g) ? 0.45 : 1, scale = (hop ? 0.75 : 1) * amount;
  if (speed < 1) pool.burst(MOTES, x, y, z, y, 0, 0, scale, fx.dust, seedAt(x, z, SALT.kick), soft);
  else pool.burst(KICK, x, y, z, y, -vx, -vz, scale * (0.85 + Math.min(speed, 15) * 0.02), fx.dust, seedAt(x, z, SALT.kick), soft);
  if (fx.extra && !hop) pool.burst(fx.extra, x, y, z, y, -vx, -vz, scale * 0.8, fx.extraTint, seedAt(x, z, SALT.extra));
}

// ── Landing, by drop height ──────────────────────────────────────────
/** Drop heights (world units, the sim's `drop`): under `tap` a few motes; from `heavy` the big burst, the camera dip and the long pose. */
export const LAND = { tap: 0.45, heavy: 1.8 };
export type LandKind = "tap" | "normal" | "heavy";
export const landKind = (drop: number): LandKind => (drop >= LAND.heavy ? "heavy" : drop >= LAND.tap ? "normal" : "tap");

/** A landing: motes for a tap, a low ring of dust for a normal one, a bigger ring and a rising plume for a heavy one; dust carries some of the speed. */
export function landing(pool: ParticlePool, g: GroundKind, kind: LandKind, x: number, y: number, z: number, vx: number, vz: number, amount = 1) {
  if (amount <= 0) return;
  const fx = GROUND[g], soft = HARD.has(g) ? 0.45 : 1;
  if (kind === "tap") { pool.burst(MOTES, x, y, z, y, 0, 0, amount, fx.dust, seedAt(x, z, SALT.ring), soft); return; }
  const heavy = kind === "heavy";
  const n = pool.burst(heavy ? RING_HEAVY : RING, x, y, z, y, 0, 0, amount, fx.dust, seedAt(x, z, SALT.ring), soft);
  pool.carry(n, vx * 0.3, vz * 0.3);
  if (heavy) pool.burst(PLUME, x, y, z, y, 0, 0, amount, fx.dust, seedAt(x, z, SALT.plume), soft);
  if (fx.extra) pool.burst(fx.extra, x, y, z, y, vx, vz, amount * (heavy ? 1.3 : 1), fx.extraTint, seedAt(x, z, SALT.extra));
}

// ── The dash ─────────────────────────────────────────────────────────
const DASH_KICK: Recipe = { sprite: "dust", count: [5, 6], life: [0.42, 0.58], size: [0.55, 0.72], grow: 1.8, speed: [2, 3.4], spread: 0.55, up: [0.15, 0.5], gravity: 0, drag: 5.5, wind: 0.6, lift: 0.15, alpha: 0.92, face: B, jitter: 0.1, rise: [0.14, 0.24] };
const DASH_SIDE: Recipe = { ...RING, count: [3, 3], size: [0.5, 0.58], speed: [1.1, 1.5], life: [0.4, 0.5] };
const AIR_PUFF: Recipe = { sprite: "dust", count: [3, 3], life: [0.36, 0.46], size: [0.5, 0.62], grow: 1.7, speed: [1.2, 2], spread: 0.5, up: [-0.2, 0.2], gravity: 0, drag: 4, wind: 0.4, lift: 0.1, alpha: 0.5, face: B, jitter: 0.08 };
const AIR_SWIRL: Recipe = { sprite: "swirl", count: [1, 1], life: [0.3, 0.34], size: [1.1, 1.2], grow: 1.3, speed: [0.6, 0.6], spread: 0, up: [0, 0], gravity: 0, drag: 3, wind: 0.3, alpha: 0.8, face: B };
/** A soft tapered streak through the dash, stretched along it. */
export const STREAK: Recipe = { sprite: "streak", count: [1, 1], life: [0.16, 0.22], size: [0.6, 0.85], grow: 1.1, aspect: 0.3, speed: [0, 0], spread: 0, up: [0, 0], gravity: 0, drag: 0, wind: 0, alpha: 0.55, face: FACE.streak };
const TRAIL: Recipe = { ...STEP_PUFF, size: [0.34, 0.42], life: [0.32, 0.42], alpha: 0.6, speed: [0.1, 0.3] };
const SETTLE: Recipe = { ...RING, count: [2, 2], size: [0.48, 0.55], speed: [0.6, 0.9], life: [0.4, 0.5], alpha: 0.75 };
const AIR = 0xf2f5f7, WIND = 0xf6fbff, GLINT = 0xfff6dc;

/** The dash's start: a directional burst of dust on the ground (and the ground's flecks), a puff of air and a swirl in the air. */
export function dashBurst(pool: ParticlePool, g: GroundKind, aloft: boolean, x: number, y: number, z: number, groundY: number, dx: number, dz: number, amount = 1) {
  if (amount <= 0) return;
  if (aloft) {
    pool.burst(AIR_PUFF, x, y + 0.55, z, groundY, -dx, -dz, amount, AIR, seedAt(x, z, SALT.air));
    pool.burst(AIR_SWIRL, x - dx * 0.35, y + 0.6, z - dz * 0.35, groundY, -dx, -dz, amount, WIND, seedAt(x, z, SALT.swirl));
    return;
  }
  const fx = GROUND[g], soft = HARD.has(g) ? 0.5 : 1;
  pool.burst(DASH_KICK, x, y, z, y, -dx, -dz, amount, fx.dust, seedAt(x, z, SALT.dash), soft);
  pool.burst(DASH_SIDE, x, y, z, y, 0, 0, amount, fx.dust, seedAt(x, z, SALT.side), soft);
  if (fx.extra) pool.burst(fx.extra, x, y, z, y, -dx, -dz, amount * 0.8, fx.extraTint, seedAt(x, z, SALT.extra));
}

/**
 * Streaks round the body along the way it goes: `k` picks the slot (left/right, high/low), so a dash lays a few
 * apart. They move on at a fraction of the body's speed, so they trail it.
 */
export function streak(pool: ParticlePool, x: number, y: number, z: number, groundY: number, dx: number, dz: number, speed: number, k: number, alpha = 1) {
  if (alpha <= 0) return;
  const side = (k % 2 ? 1 : -1) * (0.28 + 0.12 * ((k >> 1) % 2)), h = 0.3 + 0.28 * (k % 4);
  const n = pool.burst(STREAK, x + dz * side, y + h, z - dx * side, groundY, dx, dz, 1, 0xffffff, seedAt(x, z, SALT.streak + k), alpha);
  pool.carry(n, dx * speed * 0.35, dz * speed * 0.35);
}

/** Dust left along the ground by a dash, a roll or a skid. */
export function trail(pool: ParticlePool, g: GroundKind, x: number, y: number, z: number, vx: number, vz: number, amount = 1) {
  if (amount <= 0 || HARD.has(g) || g === "water") return;
  pool.burst(TRAIL, x, y, z, y, -vx, -vz, amount, GROUND[g].dust, seedAt(x, z, SALT.trail));
}

/** The dash ends on the ground: a little settle puff at the feet. */
export function settle(pool: ParticlePool, g: GroundKind, x: number, y: number, z: number, amount = 1) {
  if (amount <= 0 || g === "water") return;
  pool.burst(SETTLE, x, y, z, y, 0, 0, amount, GROUND[g].dust, seedAt(x, z, SALT.settle), HARD.has(g) ? 0.45 : 1);
}

// ── The dash cooldown, as wind at the heels ─────────────────────────
const WISP: Recipe = { sprite: "swirl", count: [1, 1], life: [0.2, 0.24], size: [0.5, 0.56], grow: 1.2, speed: [0, 0], spread: 0, up: [0.1, 0.2], gravity: 0, drag: 0, wind: 0, alpha: 0.55, face: B };
const READY_SWIRL: Recipe = { sprite: "swirl", count: [2, 2], life: [0.3, 0.36], size: [0.6, 0.7], grow: 1.3, speed: [0.3, 0.5], spread: 0, up: [0.4, 0.6], gravity: 0, drag: 2, wind: 0, alpha: 0.7, face: B };
const READY_GLINT: Recipe = { sprite: "sparkle", count: [1, 1], life: [0.3, 0.34], size: [0.4, 0.45], grow: 1.1, speed: [0, 0], spread: 0, up: [0.5, 0.5], gravity: 0, drag: 2, wind: 0, alpha: 1, face: B };

/**
 * While the dash recharges a wisp of wind circles the ankles, gathering as it fills (`fill` 0..1, `t` seconds into
 * the cooldown, which also turns it round); the caller spawns one every 0.06 s.
 */
export function cooldownWisp(pool: ParticlePool, x: number, y: number, z: number, fill: number, t: number, amount = 1) {
  if (amount <= 0) return;
  const a = t * 9, r = 0.3;
  pool.burst(WISP, x + Math.sin(a) * r, y + 0.12, z + Math.cos(a) * r, y, 0, 0, (0.7 + 0.3 * fill) * amount, WIND, seedAt(x, z, SALT.wisp), 0.35 + 0.65 * fill);
}
/** The dash is back: the wind at the heels lifts away in two curls with a glint. */
export function dashReady(pool: ParticlePool, x: number, y: number, z: number, amount = 1) {
  if (amount <= 0) return;
  pool.burst(READY_SWIRL, x, y + 0.15, z, y, 0, 0, amount, WIND, seedAt(x, z, SALT.ready));
  pool.burst(READY_GLINT, x, y + 0.25, z, y, 0, 0, amount, GLINT, seedAt(x, z, SALT.ready + 1));
}

// ── The rest of the kit (milestone 2 polishes these; the pack already draws them) ──
const SPLASH_DROPS: Recipe = { sprite: "droplets", count: [6, 7], life: [0.5, 0.65], size: [0.4, 0.5], grow: 1, speed: [0.8, 1.6], spread: Math.PI, up: [2.4, 3.6], gravity: 9.8, drag: 0.8, wind: 0.1, alpha: 0.95, face: B };
const SPLASH_RIPPLE: Recipe = { sprite: "ripple", count: [2, 2], life: [0.8, 1.0], size: [1.2, 1.6], grow: 1.8, speed: [0, 0.1], spread: Math.PI, up: [0, 0], gravity: 0, drag: 0, wind: 0, alpha: 0.75, face: FACE.ground };
const LEAF_BITS: Recipe = { sprite: "leaf", count: [5, 5], life: [0.8, 1.1], size: [0.18, 0.24], grow: 1, speed: [0.6, 1.2], spread: Math.PI, up: [0.4, 1], gravity: 1.2, drag: 2, wind: 0.9, spin: 3, fps: 12, alpha: 1, face: B };
const HAND_PUFF: Recipe = { ...STEP_PUFF, count: [2, 2], spread: Math.PI, size: [0.36, 0.42], alpha: 0.75 };
const SCUFF: Recipe = { sprite: "scuff", count: [1, 1], life: [1.1, 1.3], size: [0.6, 0.7], grow: 1, aspect: 0.5, speed: [0, 0], spread: 0, up: [0, 0], gravity: 0, drag: 0, wind: 0, alpha: 0.55, face: FACE.ground };
const SIT: Recipe = { ...RING, count: [4, 4], size: [0.45, 0.52], speed: [0.7, 1], life: [0.4, 0.5], alpha: 0.7 };
const DEFEAT: Recipe = { ...PLUME, count: [4, 5], size: [0.7, 0.9], speed: [0.6, 1.2], up: [0.4, 0.8] };

/** Into the water: droplets thrown up and two ripples on the surface at `waterY`. */
export function splash(pool: ParticlePool, x: number, waterY: number, z: number, amount = 1) {
  if (amount <= 0) return;
  pool.burst(SPLASH_DROPS, x, waterY, z, waterY, 0, 0, amount, 0xd4ecf7, seedAt(x, z, SALT.splash));
  pool.burst(SPLASH_RIPPLE, x, waterY + 0.01, z, waterY, 0, 0, amount, 0xe4f4fb, seedAt(x, z, SALT.ripple));
}
/** A soft ring of dust where you appear, sit or set down. */
export function puffRing(pool: ParticlePool, g: GroundKind, x: number, y: number, z: number, amount = 1) {
  if (amount <= 0) return;
  pool.burst(SIT, x, y, z, y, 0, 0, amount, GROUND[g].dust, seedAt(x, z, SALT.sit), HARD.has(g) ? 0.5 : 1);
}
/** The leaf glider opens: a few leaf bits shaken loose round the grip. */
export function leafBits(pool: ParticlePool, x: number, y: number, z: number, groundY: number, amount = 1) {
  if (amount > 0) pool.burst(LEAF_BITS, x, y, z, groundY, 0, 0, amount, 0x9db86a, seedAt(x, z, SALT.leaf));
}
/** Hands on a ledge: a little dust off the lip. */
export function handPuff(pool: ParticlePool, g: GroundKind, x: number, y: number, z: number, amount = 1) {
  if (amount > 0) pool.burst(HAND_PUFF, x, y, z, y, 0, 0, amount, GROUND[g].dust, seedAt(x, z, SALT.mantle), HARD.has(g) ? 0.5 : 1);
}
/** A skid's scuff on the ground, turned along the slide (not on boards or stone). */
export function scuff(pool: ParticlePool, g: GroundKind, x: number, y: number, z: number, vx: number, vz: number, amount = 1) {
  const tint = GROUND[g].scuff;
  if (amount > 0 && tint) pool.burst(SCUFF, x, y, z, y, vx, vz, amount, tint, seedAt(x, z, SALT.scuff));
}
/** An enemy falls in the ruins: a puff of dust rising and a ring along the ground (`big` scales it for the guardian). */
export function defeatPuff(pool: ParticlePool, x: number, y: number, z: number, big = 1) {
  pool.burst(DEFEAT, x, y, z, y, 0, 0, big, 0xe2d6c0, seedAt(x, z, 22));
  pool.burst(RING, x, y, z, y, 0, 0, big, 0xe2d6c0, seedAt(x, z, 23), 0.8);
}
