/**
 * Classes v2: a kit's own basic attack and the counters its passives keep (design sheet, the LOCKED Ranger sections;
 * behind the classes_v2 flag). Left click fires the kit's FireSpec: its rate (a Focus passive ramps it while you keep
 * firing, a pause or a hit halves it), arrow drop, weak points, the buffs that bend a shot (homing, flame, swift, scope,
 * a surge's rate), a cylinder with its reload and active reload, special rounds loaded next (a spun, hammer-cocked
 * cylinder for an ult), and the Killstreak, Last Round and stealth bookkeeping. Damage over time and ground zones tick
 * here too. Pure over the runtime, like the rest of the encounter: the ruins scene and the balance bot drive it alike.
 */
import { FAMILY_STAT, type Effect, type Status } from "@/lib/combat/kits";
import type { RoundDef } from "@/lib/combat/classes";
import { buffSum, cue, floater, fx, strike } from "./abilities";
import type { CombatRuntime, Projectile, ShotHit } from "./runtime";
import type { Enemy, Vec } from "./sim";

export const FIRE = {
  /** A pause in fire this long halves Focus (once per pause); so does a hit taken. */
  focusDrop: 0.5,
  /** Shots leave from chest height: an arrow is spent when it has fallen this far. */
  launch: 0.9,
  /** Seconds after a reload that count as "just reloaded" (Quickdraw). */
  reloaded: 1.5,
  /** Homing turn rate (rad/s) and how far ahead it looks for a target. */
  homeTurn: 7, homeReach: 9,
  /** Killstreak: seconds without a kill before it's lost. */
  streakWindow: 8,
  /** Stealth: moving faster than this breaks it (a slow walk stays hidden); enemies this close still find you. */
  stealthWalk: 3.8, stealthNear: 1.5,
  /** A weak point is a head or a core: a fraction of the body's radius, never wider than this (a boss's head isn't its girth). */
  weakMax: 0.3,
  /** A ricochet's reach to its next enemy. */
  bounceReach: 6,
  /** Damage over time and zones tick this often. */
  tick: 0.5,
} as const;

interface Dot { enemy: Enemy; power: number; left: number; tick: number }
export interface Zone { id: number; x: number; z: number; radius: number; life: number; power: number; status?: Status; tick: number }
/** The kit's live counters (ClassState.live). */
export interface FireState {
  /** Focus 0..1 toward the passive's top rate; seconds since the last basic shot; seconds the weapon has been ready and not fired (a pause); already halved for it. */
  focus: number; since: number; idle: number; dropped: boolean;
  /** The cylinder: rounds left, the next chamber (0-based), the reload under way (s into it, null: none) and its length, the active reload tried. */
  ammo: number; chamber: number; reload: number | null; reloadLen: number; tried: boolean;
  /** Shots left with the active reload's bonus; seconds since the last reload ended. */
  bonus: number; sinceReload: number;
  /** Special rounds next up (keys of fire.rounds); a spun cylinder's hammer (s until cocked, s per cock) and its window. */
  loaded: string[]; cock: number; cockEvery: number; window: number;
  /** Killstreak stacks and the seconds left to add one; a surge's shots owed (fractions carry between frames). */
  streak: number; streakT: number; owed: number;
  dots: Dot[]; zones: Zone[];
}
export function createLive(size = 0): FireState {
  return { focus: 0, since: 99, idle: 99, dropped: true, ammo: size, chamber: 0, reload: null, reloadLen: 0, tried: false, bonus: 0, sinceReload: 99,
    loaded: [], cock: 0, cockEvery: 0, window: 0, streak: 0, streakT: 0, owed: 0, dots: [], zones: [] };
}

const v2 = (rt: CombatRuntime) => rt.v2!;
const passive = (rt: CombatRuntime) => rt.v2?.passive;
export const stealthed = (rt: CombatRuntime) => buffSum(rt, "stealth") > 0;
/** Stealth ends: on a shot, an ability, a hit taken or a quick step. Returns the first shot's bonus it carried. */
export function breakStealth(rt: CombatRuntime): number {
  const bonus = buffSum(rt, "stealth");
  if (bonus > 0) rt.buffs = rt.buffs.filter(b => b.stat !== "stealth");
  return bonus;
}

/** Shots a second now: a surge (the ult) sets it outright; otherwise the kit's rate ramped by Focus, times the attack-speed stat. */
export function fireRate(rt: CombatRuntime): number {
  const v = v2(rt), f = v.kit.fire!, surge = buffSum(rt, "surge"), pv = passive(rt);
  if (surge > 0) return surge;
  const top = pv?.kind === "focus" ? pv.value : f.rate;
  return (f.rate + (top - f.rate) * v.live.focus) * v.mods.attackSpeed;
}
export const reloading = (rt: CombatRuntime) => rt.v2?.live.reload !== null && rt.v2?.live.reload !== undefined;
export const justReloaded = (rt: CombatRuntime) => (rt.v2?.live.sinceReload ?? 99) <= FIRE.reloaded;

/** Start reloading (empty, or R with rounds spent); nothing while a spun cylinder is out. */
function startReload(rt: CombatRuntime) {
  const v = v2(rt), a = v.kit.fire?.ammo, live = v.live;
  if (!a || live.reload !== null || live.cockEvery > 0 || live.ammo >= a.size) return false;
  live.reload = 0; live.reloadLen = a.reload_s; live.tried = false; live.loaded = [];
  if (a.clip) rt.player.clip = { verb: a.clip, scale: v.mods.reload, upper: true };
  return true;
}
function finishReload(rt: CombatRuntime) {
  const v = v2(rt), live = v.live;
  live.ammo = v.kit.fire!.ammo!.size; live.chamber = 0; live.reload = null; live.sinceReload = 0;
}
/**
 * R for a kit with a cylinder (it replaces "previous weapon"): reload; a second press while reloading is the active
 * reload: inside the gold span it reloads at once and the next `size` shots deal `bonus` more, outside it jams for
 * `miss_s` more. Returns false for a kit without one (R swaps weapons as before).
 */
export function reloadKey(rt: CombatRuntime, me: Vec): boolean {
  const v = rt.v2, a = v?.kit.fire?.ammo;
  if (!v || !a) return false;
  const live = v.live;
  if (live.reload === null) { startReload(rt); return true; }
  if (live.tried) return true;
  live.tried = true;
  const at = live.reload / live.reloadLen;
  if (at >= a.gold[0] && at <= a.gold[1]) {
    finishReload(rt); live.bonus = a.size;
    floater(rt, me, 1.9, "Perfect reload", "info");
    fx(rt, "gunslinger.perfect", "cast", me, rt.player.aim, "ability");
  } else { live.reloadLen += a.miss_s; floater(rt, me, 1.9, "Jammed", "info"); }
  return true;
}

/** A shot from the kit's weapon toward the aim (left click). False when it can't fire now (reloading, uncocked). */
export function fireBasic(rt: CombatRuntime, me: Vec, auto = false): boolean {
  const v = v2(rt), f = v.kit.fire!, live = v.live, p = rt.player, a = f.ammo;
  if (!auto && buffSum(rt, "surge") > 0) return false; // a surge fires on its own (stepFire)
  if (a && live.ammo <= 0 && live.cockEvery <= 0) startReload(rt);
  if (a && (live.reload !== null || live.ammo <= 0)) return false;
  if (live.cockEvery > 0 && live.cock > 0) return false;
  const surge = buffSum(rt, "surge") > 0;
  const key = surge ? "surge" : live.loaded[0], round: RoundDef | undefined = key ? f.rounds?.[key] : undefined;
  if (key && !surge) live.loaded.shift();
  const last = !!a && passive(rt)?.kind === "last_round" && live.chamber === a.size - 1;
  const ambush = breakStealth(rt), bonus = a && live.bonus > 0 ? 1 + a.bonus : 1;
  if (a && live.bonus > 0) live.bonus--;
  // Focus climbs while the shots keep coming; the first shot after a pause starts from what's left.
  const pv = passive(rt);
  if (pv?.kind === "focus" && live.idle <= FIRE.focusDrop) live.focus = Math.min(1, live.focus + live.since / (pv.cap ?? 4));
  live.since = 0; live.idle = 0; live.dropped = false;
  p.attackCd = 1 / fireRate(rt);
  const swift = buffSum(rt, "swift") > 0, flame = buffSum(rt, "flame"), scope = buffSum(rt, "scope") > 0;
  const speed = f.speed * (swift ? 2 : 1), dir = { x: Math.sin(p.facing), z: Math.cos(p.facing) };
  const hit: ShotHit = {
    power: (round?.power ?? f.power) * bonus * (1 + ambush) * (last ? passive(rt)!.value : 1), stat: FAMILY_STAT[v.kit.family], hitIds: [], impact: round?.tier ?? "light", ult: round?.ult,
    fx: round?.vfx ?? f.vfx?.impact, travel: round?.travel ?? f.vfx?.travel, ramp: v.kit.look.ramp, splash: round?.splash, round: key,
    burst: round?.blast ? { power: round.power * bonus, radius: round.blast } : undefined,
    steady: f.steady, crit: round?.crit || last || undefined, weak: f.weak ? f.weak * (scope ? 1.5 : 1) : undefined, pierces: swift ? 1 : undefined,
    status: flame > 0 ? { dot: [flame, 3] } : undefined, zone: flame > 0 ? { radius: 1.1, life: 2, power: flame, fx: "marksman.burn" } : undefined,
  };
  const shot: Projectile = { id: rt.seq++, x: me.x + dir.x * 0.5, z: me.z + dir.z * 0.5, vx: dir.x * speed, vz: dir.z * speed, life: f.range / speed,
    from: "player", damage: 0, kind: f.look ?? "arrow", radius: 0.18, hit };
  if (f.drop && !swift) shot.fall = { y: 0, vy: 0, g: f.drop };
  if (buffSum(rt, "homing") > 0) shot.home = FIRE.homeTurn;
  rt.projectiles.push(shot);
  if (a) {
    live.ammo--; live.chamber = (live.chamber + 1) % a.size;
    if (live.cockEvery > 0) { live.cock = live.cockEvery; if (!live.loaded.length) endSpin(rt); }
    else if (live.ammo <= 0) startReload(rt);
  }
  cue(rt, "swing", me);
  fx(rt, round?.cast ?? f.vfx?.cast, "cast", me, p.aim, "light");
  if (f.clip) p.clip = { verb: f.clip.verb, scale: (f.clip.scale ?? 1) * Math.max(1, fireRate(rt) / f.rate / 2), upper: true };
  return true;
}

/** A spun cylinder's window is over (all fired, or time ran out): a fresh cylinder of plain rounds. */
function endSpin(rt: CombatRuntime) {
  const v = v2(rt), live = v.live;
  live.loaded = []; live.cock = 0; live.cockEvery = 0; live.window = 0;
  if (v.kit.fire?.ammo) finishReload(rt);
}
/** Effect "load": special rounds into the next chambers (a running reload is done); `shuffle` spins them, `cock` and `window` hold a spun cylinder's pace. */
export function loadRounds(rt: CombatRuntime, ef: Extract<Effect, { kind: "load" }>, random: () => number) {
  const v = rt.v2, a = v?.kit.fire?.ammo;
  if (!v || !a) return;
  const live = v.live, rounds = [...ef.rounds];
  if (ef.add) { if (live.cockEvery <= 0) { live.reload = null; live.ammo = Math.min(a.size, live.ammo + ef.add); } return; }
  if (ef.shuffle) for (let i = rounds.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [rounds[i], rounds[j]] = [rounds[j], rounds[i]]; }
  live.reload = null; live.loaded = rounds; live.ammo = Math.max(live.ammo, rounds.length); live.chamber = Math.max(0, a.size - live.ammo);
  if (ef.cock) { live.cockEvery = ef.cock; live.cock = 0; live.window = ef.window ?? 10; live.ammo = rounds.length; live.chamber = a.size - rounds.length; }
}

/** An ability that fires rounds from the cylinder: how many it takes (all: what's left), or why not. */
export function takeRounds(rt: CombatRuntime, want: number | "all"): { n: number; last: boolean } | null {
  const v = rt.v2, a = v?.kit.fire?.ammo;
  if (!v || !a) return { n: want === "all" ? 1 : want, last: false };
  const live = v.live;
  if (live.reload !== null || live.ammo <= 0 || live.cockEvery > 0) return null;
  const n = want === "all" ? live.ammo : Math.min(want, live.ammo), from = live.chamber;
  const last = passive(rt)?.kind === "last_round" && from + n - 1 >= a.size - 1;
  live.ammo -= n; live.chamber = (live.chamber + n) % a.size; live.loaded.splice(0, n);
  if (live.ammo <= 0) startReload(rt);
  return { n, last };
}

/** A hit taken: Focus halves, the Killstreak is lost, stealth breaks. */
export function onHurt(rt: CombatRuntime) {
  const v = rt.v2;
  if (!v) return;
  v.live.focus /= 2; v.live.streak = 0;
  breakStealth(rt);
}

/** Damage over time on an enemy: one per enemy, a new one keeps the stronger and the longer. */
export function addDot(rt: CombatRuntime, e: Enemy, [power, seconds]: [number, number]) {
  const v = rt.v2;
  if (!v) return;
  const d = v.live.dots.find(x => x.enemy === e);
  if (d) { d.power = Math.max(d.power, power); d.left = Math.max(d.left, seconds); }
  else v.live.dots.push({ enemy: e, power, left: seconds, tick: FIRE.tick });
}
/** A ground zone: one already burning at this spot (inside its radius) is refreshed instead of a second one. */
export function addZone(rt: CombatRuntime, at: Vec, z: { radius: number; life: number; power?: number; status?: Status; fx?: string }) {
  const v = rt.v2;
  if (!v) return;
  const old = v.live.zones.find(o => Math.hypot(o.x - at.x, o.z - at.z) < o.radius);
  if (old) { old.life = Math.max(old.life, z.life); old.power = Math.max(old.power, z.power ?? 0); return; }
  v.live.zones.push({ id: rt.seq++, x: at.x, z: at.z, radius: z.radius, life: z.life, power: z.power ?? 0, status: z.status, tick: 0 });
  if (v.live.zones.length > 12) v.live.zones.shift();
  fx(rt, z.fx, "zone", at, at, "ability", z.radius);
}

/**
 * Every frame (the encounter's clock): Focus decays in a pause, the reload runs (faster with the reload stat), a spun
 * cylinder's hammer cocks and its window closes, the Killstreak runs out, a quick step breaks stealth, a surge fires on
 * its own, and damage over time and zones tick.
 */
export function stepFire(rt: CombatRuntime, me: Vec, dt: number, random: () => number = Math.random) {
  const v = rt.v2;
  if (!v) return;
  const live = v.live, p = rt.player;
  live.since += dt; live.sinceReload += dt;
  if (p.attackCd <= 0) live.idle += dt; // ready and not fired: a pause in the fire
  if (live.idle > FIRE.focusDrop && !live.dropped) { live.focus /= 2; live.dropped = true; }
  if (live.reload !== null && (live.reload += dt * v.mods.reload) >= live.reloadLen) finishReload(rt);
  if (live.cockEvery > 0) { live.cock = Math.max(0, live.cock - dt); if ((live.window -= dt) <= 0) endSpin(rt); }
  if (live.streak && (live.streakT -= dt) <= 0) live.streak = 0;
  if (p.move.speed > FIRE.stealthWalk && stealthed(rt)) breakStealth(rt);
  const surge = v.kit.fire ? buffSum(rt, "surge") : 0;
  if (surge > 0 && p.alive && !p.dash) { // its own pace whatever the frame rate: shots owed this frame, carried over
    live.focus = 1;
    p.facing = Math.atan2(p.aim.x - me.x, p.aim.z - me.z);
    for (live.owed += dt * surge; live.owed >= 1; live.owed--) fireBasic(rt, me, true);
  } else live.owed = 0;
  for (let i = live.dots.length - 1; i >= 0; i--) {
    const d = live.dots[i];
    if (d.enemy.state === "dead" || (d.left -= dt) <= 0 || !rt.enemies.includes(d.enemy)) { live.dots.splice(i, 1); continue; } // gone with a reset too
    if ((d.tick -= dt) <= 0) { d.tick += FIRE.tick; strike(rt, d.enemy, { power: d.power * FIRE.tick, from: d.enemy, stat: FAMILY_STAT[v.kit.family], unit: true, knock: 0, steady: true }, random); }
  }
  for (let i = live.zones.length - 1; i >= 0; i--) {
    const z = live.zones[i];
    if ((z.life -= dt) <= 0) { live.zones.splice(i, 1); continue; }
    if ((z.tick -= dt) > 0) continue;
    z.tick += FIRE.tick;
    for (const e of rt.enemies) if (e.state !== "dead" && e.state !== "return" && Math.hypot(e.x - z.x, e.z - z.z) <= z.radius + e.type.radius)
      strike(rt, e, { power: z.power * FIRE.tick, from: z, stat: FAMILY_STAT[v.kit.family], unit: true, knock: 0, status: z.status, steady: true }, random);
  }
}

/** A v2 shot in flight, before it moves: homing turns it toward the nearest enemy ahead, an arrow drops. */
export function steerShot(rt: CombatRuntime, sh: Projectile, dt: number) {
  if (sh.home) {
    const sp = Math.hypot(sh.vx, sh.vz), head = Math.atan2(sh.vx, sh.vz);
    let best: Enemy | null = null, bd: number = FIRE.homeReach;
    for (const e of rt.enemies) {
      if (e.state === "dead" || e.state === "return" || sh.hit?.hitIds?.includes(e.id)) continue;
      const d = Math.hypot(e.x - sh.x, e.z - sh.z), off = Math.abs(Math.atan2(Math.sin(Math.atan2(e.x - sh.x, e.z - sh.z) - head), Math.cos(Math.atan2(e.x - sh.x, e.z - sh.z) - head)));
      if (d < bd && off < 1.4) { bd = d; best = e; }
    }
    if (best) {
      const want = Math.atan2(best.x - sh.x, best.z - sh.z), turn = Math.atan2(Math.sin(want - head), Math.cos(want - head));
      const a = head + Math.max(-sh.home * dt, Math.min(sh.home * dt, turn));
      sh.vx = Math.sin(a) * sp; sh.vz = Math.cos(a) * sp;
    }
  }
  if (sh.fall) { sh.fall.vy -= sh.fall.g * dt; sh.fall.y += sh.fall.vy * dt; }
}
/** An arrow that has dropped to the ground is spent. */
export const fallen = (sh: Projectile) => !!sh.fall && sh.fall.y <= -FIRE.launch;

/** A bomblet's, a splash's or a blast round's burst: everything within `radius` of `at` (but `skip`). A `big` round replays the ult's sequence there. */
export function burst(rt: CombatRuntime, at: Vec, power: number, radius: number, h: ShotHit, random: () => number, skip?: Enemy, emit = true) {
  let first = true;
  if (h.round && rt.v2?.kit.fire?.rounds?.[h.round]?.big) triggerSequence(rt, at, true);
  for (const e of rt.enemies) if (e !== skip && e.state !== "dead" && e.state !== "return" && Math.hypot(e.x - at.x, e.z - at.z) <= radius + e.type.radius) {
    strike(rt, e, { power, from: at, knock: 2, stat: h.stat, impact: h.impact ?? "ability", ult: h.ult, first }, random); first = false;
  }
  if (emit) fx(rt, h.fx, "impact", at, at, h.impact ?? "ability", radius);
}
/** A cluster round's bomblets: `count` small shots thrown out round the impact, each bursting where it lands. */
export function scatter(rt: CombatRuntime, at: Vec, c: NonNullable<ShotHit["cluster"]>, h: ShotHit, random: () => number, skip?: Enemy) {
  for (let k = 0; k < c.count; k++) {
    const a = (k / c.count) * Math.PI * 2 + random() * 0.6, sp = 5 + random() * 2;
    rt.projectiles.push({ id: rt.seq++, x: at.x, z: at.z, vx: Math.sin(a) * sp, vz: Math.cos(a) * sp, life: 0.32, from: "player", damage: 0, kind: "bullet", radius: 0.15,
      hit: { power: 0, stat: h.stat, impact: "ability", fx: "sniper.bomblet", ramp: h.ramp, hitIds: skip ? [skip.id] : [], burst: { power: c.power, radius: c.radius } } });
  }
}
/** A ricochet: the shot turns to the nearest enemy it hasn't hit within reach. False when there's none. */
export function ricochet(rt: CombatRuntime, sh: Projectile, from: Enemy): boolean {
  const h = sh.hit!;
  let best: Enemy | null = null, bd: number = FIRE.bounceReach;
  for (const e of rt.enemies) {
    if (e === from || e.state === "dead" || e.state === "return" || h.hitIds?.includes(e.id)) continue;
    const d = Math.hypot(e.x - from.x, e.z - from.z);
    if (d < bd) { bd = d; best = e; }
  }
  if (!best) return false;
  const sp = Math.hypot(sh.vx, sh.vz);
  sh.x = from.x; sh.z = from.z; sh.vx = ((best.x - from.x) / (bd || 1)) * sp; sh.vz = ((best.z - from.z) / (bd || 1)) * sp; sh.life = bd / sp + 0.2;
  h.bounce = (h.bounce ?? 1) - 1;
  fx(rt, h.fx, "impact", from, best, h.impact ?? "ability");
  return true;
}
/** A shot that ended without hitting an enemy: a bomblet bursts, a flame arrow leaves burning ground, a harpoon in terrain zips you there. */
export function shotSpent(rt: CombatRuntime, sh: Projectile, wall: boolean, random: () => number) {
  const h = sh.hit!, at = { x: sh.x, z: sh.z };
  if (h.burst) burst(rt, at, h.burst.power, h.burst.radius, h, random);
  if (h.zone) addZone(rt, at, h.zone);
  const p = rt.player, me = p.last;
  if (h.grapple && wall && me && p.alive) {
    const dx = sh.x - sh.vx * 0.02 - me.x, dz = sh.z - sh.vz * 0.02 - me.z, d = Math.hypot(dx, dz);
    if (d > 1) {
      p.dash = { x: dx / d, z: dz / d, speed: 22, left: (d - 0.6) / 22, iframes: false, then: null };
      p.kick = { dx: dx / d, dz: dz / d, speed: 4, up: 0, hang: false }; // the zip keeps its speed (row 292)
      fx(rt, "hunter.zip", "travel", me, at, "ability");
    }
  }
}

/**
 * Replay the ult's sequence (freeze, flash frame, lines, shake, slow motion) now, at `at`: an ult with `sequence:
 * "trigger"` waits for this (the Russian Roulette's warhead); `big` plays it larger. The caster is untouchable through it.
 */
export function triggerSequence(rt: CombatRuntime, at: Vec, big = false) {
  const v = rt.v2, c = v?.cast;
  if (!v || !c) return;
  c.shift = c.t - v.ult.anticipation_ms / 1000; c.big = big; c.aim = { x: at.x, z: at.z };
  rt.player.ultIframes = Math.max(rt.player.ultIframes, 0.12 + 0.2);
}
