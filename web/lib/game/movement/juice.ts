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
import { puddleAt } from "@/lib/game/puddles";

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
const SALT = { step: 1, rain: 2, kick: 3, extra: 4, ring: 5, plume: 6, dash: 7, side: 8, air: 9, swirl: 10, streak: 11, trail: 12, settle: 13, wisp: 14, ready: 15, splash: 16, ripple: 17, leaf: 18, mantle: 19, scuff: 20, sit: 21,
  slide: 24, slideSpray: 25, slideScuff: 26, slideBurst: 27, slidePop: 28, print: 29, skid: 30, roll: 31 };

/**
 * A foot comes down: flecks and a mote on grass, a sand kick, a snow puff, a dust puff on soil; nothing on stone or
 * wood but the sound. On a rain day every step but the boards also leaves a ripple. Size follows speed; returns the sound.
 */
export function footstep(pool: ParticlePool, g: GroundKind, x: number, y: number, z: number, vx: number, vz: number, rain: boolean, amount = 1) {
  const fx = GROUND[g], speed = Math.hypot(vx, vz), scale = (0.8 + Math.min(speed, 14) * 0.035) * amount;
  // Into a rain puddle (lib/game/puddles.ts): a crown of droplets and a ring running out across it, whoever stepped.
  if (rain && amount > 0 && g !== "wood" && g !== "water" && puddleAt(x, z)) {
    pool.burst(PUDDLE_SPLASH, x, y + 0.02, z, y, -vx, -vz, scale, 0xd4ecf7, seedAt(x, z, SALT.splash));
    pool.burst(PUDDLE_RING, x, y + 0.03, z, y, 0, 0, amount, 0xe4f4fb, seedAt(x, z, SALT.ripple));
    return PUDDLE_SOUND;
  }
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

/** Splash sizes by the drop into the water (world units from the arc's top): a step in, a jump, a fall from a cliff. */
export const SPLASH = { small: 0.6, big: 1.8 };
const SPLASH_SMALL: Recipe = { ...SPLASH_DROPS, count: [4, 4], up: [1.6, 2.4], speed: [0.6, 1.1], size: [0.32, 0.4] };
/** A foot coming down in a rain puddle: a small crown of droplets kicked forward, and a ring running out across it. */
const PUDDLE_SPLASH: Recipe = { ...SPLASH_DROPS, count: [5, 6], up: [1.4, 2.2], speed: [0.5, 1.1], size: [0.3, 0.38], spread: 1.4 };
const PUDDLE_RING: Recipe = { ...SPLASH_RIPPLE, count: [1, 1], size: [0.9, 1.1], grow: 1.7, life: [0.65, 0.8], alpha: 0.7 };
/** Its sound: the step pitched up and brighter (a real splash is on the sound list). */
const PUDDLE_SOUND = { name: "footstep" as SFXName, rate: 1.35, gain: 1.1 };
const SPLASH_CROWN: Recipe = { ...SPLASH_DROPS, count: [10, 11], up: [3.6, 4.8], speed: [1.2, 2.2], size: [0.42, 0.55], life: [0.62, 0.8] };
const SPLASH_WIDE: Recipe = { ...SPLASH_RIPPLE, count: [1, 1], size: [2.2, 2.4], grow: 1.6, life: [1.2, 1.4], alpha: 0.55 };
const SPLASH_MIST: Recipe = { sprite: "dust", count: [3, 3], life: [0.5, 0.65], size: [0.6, 0.75], grow: 1.6, speed: [0.4, 0.8], spread: Math.PI, up: [0.5, 0.9], gravity: 0, drag: 3, wind: 0.6, lift: 0.3, alpha: 0.45, face: B, rise: [0.1, 0.2] };
/**
 * Into the water at `waterY`: by the drop (`drop`), a few drops and one ripple for a step in, droplets and two
 * ripples for a jump, a crown of droplets thrown high, a wide ring and a little mist for a fall from a height.
 */
export function splash(pool: ParticlePool, x: number, waterY: number, z: number, amount = 1, drop = 1) {
  if (amount <= 0) return;
  const big = drop >= SPLASH.big, small = drop < SPLASH.small;
  pool.burst(big ? SPLASH_CROWN : small ? SPLASH_SMALL : SPLASH_DROPS, x, waterY, z, waterY, 0, 0, amount, 0xd4ecf7, seedAt(x, z, SALT.splash));
  pool.burst(small ? { ...SPLASH_RIPPLE, count: [1, 1] } : SPLASH_RIPPLE, x, waterY + 0.01, z, waterY, 0, 0, amount, 0xe4f4fb, seedAt(x, z, SALT.ripple));
  if (big) {
    pool.burst(SPLASH_WIDE, x, waterY + 0.012, z, waterY, 0, 0, amount, 0xe4f4fb, seedAt(x, z, SALT.ripple + 40));
    pool.burst(SPLASH_MIST, x, waterY, z, waterY, 0, 0, amount, 0xeef7fb, seedAt(x, z, SALT.splash + 40));
  }
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

// ── The slide (specs/movement-slide.md) ──────────────────────────────
/** Low dust off the heels, trailing; the ground's own spray (flecks on grass, a sand spray, snow) thrown up and out from the lead heel; scuffs left on the ground. */
const SLIDE_DUST: Recipe = { sprite: "dustLow", count: [1, 1], life: [0.42, 0.55], size: [0.5, 0.62], grow: 1.6, speed: [0.3, 0.7], spread: 0.9, up: [0.05, 0.2], gravity: 0, drag: 4, wind: 0.5, lift: 0.08, alpha: 0.8, face: FACE.standing, jitter: 0.08 };
const SLIDE_FLECKS: Recipe = { ...STEP_FLECKS, count: [2, 2], speed: [1.2, 2], spread: 1.3, up: [1.5, 2.3], size: [0.42, 0.5] };
const SLIDE_SAND: Recipe = { ...STEP_SAND, count: [1, 2], size: [0.7, 0.85], speed: [1.2, 1.9], spread: 1.1, up: [0.9, 1.5] };
const SLIDE_SNOW: Recipe = { ...STEP_SNOW, count: [1, 2], speed: [1, 1.6], spread: 1.2, up: [0.6, 1] };
const SLIDE_SCUFF: Recipe = { ...SCUFF, life: [0.9, 1.1], size: [0.5, 0.6], alpha: 0.45 };
const SLIDE_BURST: Recipe = { ...DASH_KICK, count: [3, 4], speed: [2.4, 3.6], spread: 1.3, up: [0.25, 0.6], size: [0.38, 0.5], alpha: 0.7 };
const SLIDE_POP: Recipe = { ...RING, count: [7, 8], speed: [1.8, 2.6], size: [0.6, 0.72], life: [0.42, 0.52] };
const SLIDE_SPRAY: Partial<Record<GroundKind, Recipe>> = { grass: SLIDE_FLECKS, sand: SLIDE_SAND, wetSand: SLIDE_SAND, snow: SLIDE_SNOW };

/**
 * One beat of the slide's trail (the caller spaces them by speed): dust low off the heels at (x, z) blowing back,
 * the ground's spray up and out from the lead heel at (hx, hz), and every `scuff`th beat a scuff on the ground.
 * Nothing on stone, boards or water but a faint pale dust.
 */
export function slideTrail(pool: ParticlePool, g: GroundKind, x: number, y: number, z: number, hx: number, hz: number, vx: number, vz: number, scuffIt: boolean, amount = 1) {
  if (amount <= 0 || g === "water") return;
  const fx = GROUND[g], hard = HARD.has(g), speed = Math.hypot(vx, vz), k = amount * (0.75 + Math.min(speed, 18) * 0.02);
  pool.burst(SLIDE_DUST, x, y, z, y, -vx, -vz, k, fx.dust, seedAt(x, z, SALT.slide), hard ? 0.4 : 1);
  if (hard) return;
  const spray = SLIDE_SPRAY[g];
  if (spray) pool.burst(spray, hx, y, hz, y, vx, vz, k * 0.9, fx.extraTint, seedAt(hx, hz, SALT.slideSpray));
  if (scuffIt && fx.scuff) pool.burst(SLIDE_SCUFF, x, y + 0.01, z, y, vx, vz, amount, fx.scuff, seedAt(x, z, SALT.slideScuff));
}
/** Dropping into a slide out of a dash (or a landing): a spray of dust and the ground's grains thrown ahead and out. */
export function slideBurst(pool: ParticlePool, g: GroundKind, x: number, y: number, z: number, vx: number, vz: number, amount = 1) {
  if (amount <= 0 || g === "water") return;
  const fx = GROUND[g], soft = HARD.has(g) ? 0.45 : 1, l = Math.hypot(vx, vz) || 1;
  pool.burst(SLIDE_BURST, x, y, z, y, vx / l, vz / l, amount, fx.dust, seedAt(x, z, SALT.slideBurst), soft);
  if (fx.extra && !HARD.has(g)) pool.burst(fx.extra, x, y, z, y, vx, vz, amount, fx.extraTint, seedAt(x, z, SALT.extra));
}
/** The slide-jump: a pop of dust in a ring where it left the ground, carried a little along. */
export function slidePop(pool: ParticlePool, g: GroundKind, x: number, y: number, z: number, vx: number, vz: number, amount = 1) {
  if (amount <= 0 || g === "water") return;
  const n = pool.burst(SLIDE_POP, x, y, z, y, 0, 0, amount, GROUND[g].dust, seedAt(x, z, SALT.slidePop), HARD.has(g) ? 0.45 : 1);
  pool.carry(n, vx * 0.25, vz * 0.25);
}

// ── Footprints (specs/movement-feel.md, milestone 2) ─────────────────
/** A shoe's print in sand: pressed in at once, the edge crumbling in and the floor filling as it goes (the sprite's frames), then fading. */
const PRINT: Recipe = { sprite: "sandPrint", count: [1, 1], life: [7, 7], size: [0.44, 0.44], grow: 1, speed: [0, 0], spread: 0, up: [0, 0], gravity: 0, drag: 0, wind: 0, alpha: 0.85, face: FACE.ground, fadeIn: 2000 };
/**
 * Which grounds take a print, its tint (darker than the ground: the dent) and how long it lasts (seconds). Snow is the
 * living village's (WeatherGround: prints behind every walker whenever the ground is snowed over), so not here.
 */
const PRINTS: Partial<Record<GroundKind, { tint: number; life: number; alpha: number }>> = {
  sand: { tint: 0xb39563, life: 7, alpha: 0.85 },
  wetSand: { tint: 0x7d6847, life: 11, alpha: 0.92 },
};
export const takesPrints = (g: GroundKind) => !!PRINTS[g];
/**
 * A footprint on sand or wet sand where a foot came down at (x, z), its toe the way the body faces: crisp at first,
 * crumbling and filling in, gone after a few seconds (longer in wet sand). Into the scene's print pool (its own decal
 * layer); nothing on any other ground (snow prints are WeatherGround's).
 */
export function footprint(prints: ParticlePool, g: GroundKind, x: number, y: number, z: number, facing: number, amount = 1) {
  const p = PRINTS[g];
  if (!p || amount <= 0) return;
  const r: Recipe = PRINT_BY[g] ??= { ...PRINT, life: [p.life, p.life], alpha: p.alpha };
  prints.burst(r, x, y, z, y, Math.sin(facing), Math.cos(facing), 1, p.tint, seedAt(x, z, SALT.print), Math.min(1.5, amount));
}
const PRINT_BY: Partial<Record<GroundKind, Recipe>> = {};

// ── Skid, mantle, glide and roll (specs/movement-feel.md, milestone 2) ───
const SKID_KICK: Recipe = { ...DASH_KICK, count: [4, 5], speed: [1.6, 2.8], spread: 0.55, up: [0.15, 0.45], size: [0.45, 0.6] };
const SKID_PUSH: Recipe = { ...KICK, count: [3, 3], speed: [0.9, 1.5], spread: 0.6, size: [0.42, 0.52] };
/** Digging in to turn round: dust thrown on the way you were going from the braced feet, the ground's grains or flecks, and the first scuff. */
export function skidKick(pool: ParticlePool, g: GroundKind, x: number, y: number, z: number, vx: number, vz: number, amount = 1) {
  if (amount <= 0 || g === "water") return;
  const fx = GROUND[g], soft = HARD.has(g) ? 0.45 : 1;
  pool.burst(SKID_KICK, x, y, z, y, vx, vz, amount, fx.dust, seedAt(x, z, SALT.skid), soft);
  if (fx.extra && !HARD.has(g)) pool.burst(fx.extra, x, y, z, y, vx, vz, amount * 0.9, fx.extraTint, seedAt(x, z, SALT.extra + 50));
  scuff(pool, g, x, y, z, vx, vz, amount);
}
/** Out of the skid: the push-off, a puff kicked back against the new way (`dirX, dirZ`). */
export function skidPush(pool: ParticlePool, g: GroundKind, x: number, y: number, z: number, dirX: number, dirZ: number, amount = 1) {
  if (amount <= 0 || g === "water") return;
  pool.burst(SKID_PUSH, x, y, z, y, -dirX, -dirZ, amount, GROUND[g].dust, seedAt(x, z, SALT.skid + 1), HARD.has(g) ? 0.45 : 1);
}

const LIP_BITS: Recipe = { ...STEP_FLECKS, count: [3, 4], speed: [0.2, 0.5], spread: Math.PI, up: [0.2, 0.6], gravity: 7, size: [0.3, 0.38] };
const LIP_GRAINS: Recipe = { ...STEP_SAND, count: [2, 2], speed: [0.2, 0.4], spread: Math.PI, up: [0.1, 0.4], gravity: 6 };
/**
 * Hands on a ledge: a puff off the lip under each hand (either side of the way it climbs, `dirX, dirZ`), and a few
 * grains or flecks knocked off the edge, falling down its face.
 */
export function mantleGrab(pool: ParticlePool, g: GroundKind, x: number, y: number, z: number, dirX: number, dirZ: number, amount = 1) {
  if (amount <= 0) return;
  const l = Math.hypot(dirX, dirZ) || 1, sx = -dirZ / l * 0.17, sz = dirX / l * 0.17, soft = HARD.has(g) ? 0.5 : 1, fx = GROUND[g];
  for (const k of [1, -1]) pool.burst(HAND_PUFF, x + sx * k, y, z + sz * k, y, 0, 0, amount * 0.85, fx.dust, seedAt(x + sx * k, z, SALT.mantle), soft);
  const bits = g === "grass" ? LIP_BITS : g === "sand" || g === "wetSand" ? LIP_GRAINS : null;
  if (bits) pool.burst(bits, x - dirX / l * 0.1, y, z - dirZ / l * 0.1, y - 1.6, -dirX, -dirZ, amount, fx.extraTint, seedAt(x, z, SALT.mantle + 1));
}
/** Stepping up onto the top: a few motes at the feet. */
export function mantleStep(pool: ParticlePool, g: GroundKind, x: number, y: number, z: number, amount = 1) {
  if (amount > 0 && g !== "water") pool.burst(MOTES, x, y, z, y, 0, 0, amount * 0.8, GROUND[g].dust, seedAt(x, z, SALT.mantle + 2), HARD.has(g) ? 0.45 : 1);
}

const GLIDE_AIR: Recipe = { ...AIR_PUFF, count: [3, 3], spread: Math.PI, up: [-0.8, -0.4], speed: [0.9, 1.4], size: [0.36, 0.46], alpha: 0.28, jitter: 0.55 }; // round the leaf's rim, not over the head
const RIBBON: Recipe = { ...STREAK, life: [0.22, 0.28], size: [0.7, 0.9], aspect: 0.22, alpha: 0.4 };
const FEW_LEAVES: Recipe = { ...LEAF_BITS, count: [2, 3], speed: [0.3, 0.7], up: [0.1, 0.4] };
/** The leaf opens over the grip (`x, y, z`): leaf bits shaken loose and a puff of air pushed down under it. */
export function glideOpen(pool: ParticlePool, x: number, y: number, z: number, groundY: number, amount = 1) {
  if (amount <= 0) return;
  pool.burst(LEAF_BITS, x, y, z, groundY, 0, 0, amount, 0x9db86a, seedAt(x, z, SALT.leaf));
  pool.burst(GLIDE_AIR, x, y - 0.25, z, groundY, 0, 0, amount, AIR, seedAt(x, z, SALT.leaf + 1));
}
/**
 * Wind ribbons off the leaf's two tips at speed (`k` alternates the tip): thin pale streaks laid along the way it
 * flies (`dirX, dirZ`) that hang behind it.
 */
export function glideRibbon(pool: ParticlePool, x: number, y: number, z: number, groundY: number, dirX: number, dirZ: number, speed: number, k: number, amount = 1) {
  if (amount <= 0) return;
  const l = Math.hypot(dirX, dirZ) || 1, side = (k % 2 ? 0.55 : -0.55), ux = dirX / l, uz = dirZ / l;
  const n = pool.burst(RIBBON, x + uz * side - ux * 0.2, y, z - ux * side - uz * 0.2, groundY, ux, uz, 1, WIND, seedAt(x, z, SALT.leaf + 2 + k), amount);
  pool.carry(n, ux * speed * 0.2, uz * speed * 0.2);
}
/** The leaf folds in the air (let go): a couple of leaf bits. */
export function glideFurl(pool: ParticlePool, x: number, y: number, z: number, groundY: number, amount = 1) {
  if (amount > 0) pool.burst(FEW_LEAVES, x, y, z, groundY, 0, 0, amount, 0x9db86a, seedAt(x, z, SALT.leaf + 3));
}
/** The leaf sets you down: a soft ring of dust and a few leaf bits settling. */
export function glideSetDown(pool: ParticlePool, g: GroundKind, x: number, y: number, z: number, amount = 1) {
  if (amount <= 0) return;
  puffRing(pool, g, x, y, z, amount);
  pool.burst(FEW_LEAVES, x, y + 1.2, z, y, 0, 0, amount, 0x9db86a, seedAt(x, z, SALT.leaf + 4));
}

const TUMBLE: Recipe = { ...RING, count: [4, 5], speed: [0.9, 1.5], size: [0.5, 0.6], life: [0.42, 0.52] };
/** A landing roll's back meets the ground: a low ring of dust carried along the roll, and the ground's flecks or grains. */
export function rollTumble(pool: ParticlePool, g: GroundKind, x: number, y: number, z: number, vx: number, vz: number, amount = 1) {
  if (amount <= 0 || g === "water") return;
  const fx = GROUND[g], soft = HARD.has(g) ? 0.45 : 1;
  const n = pool.burst(TUMBLE, x, y, z, y, 0, 0, amount, fx.dust, seedAt(x, z, SALT.roll), soft);
  pool.carry(n, vx * 0.35, vz * 0.35);
  if (fx.extra && !HARD.has(g)) pool.burst(fx.extra, x, y, z, y, vx, vz, amount * 0.7, fx.extraTint, seedAt(x, z, SALT.roll + 1));
}

/** The longest piece a cosmetic spring is stepped in: one 0.1 s step (a 5 FPS frame) overshoots and flips sign every frame. */
const SPRING_STEP = 1 / 60;
const SPRING_OUT = { x: 0, v: 0 };
/**
 * A cosmetic spring (stiffness `k`, damping `c`) moved toward `target` over `dt` in pieces of at most 1/60 s, so it
 * settles the same at any frame rate (world audit item 23: the squash spring alternated upright and bowed below 6 FPS).
 * Returns a shared scratch { x, v }: read it before the next call.
 */
export function springStep(x: number, v: number, target: number, k: number, c: number, dt: number) {
  const n = Math.max(1, Math.ceil(dt / SPRING_STEP)), h = dt / n;
  for (let i = 0; i < n; i++) {
    v += ((target - x) * k - v * c) * h;
    x += v * h;
  }
  SPRING_OUT.x = x; SPRING_OUT.v = v;
  return SPRING_OUT;
}
