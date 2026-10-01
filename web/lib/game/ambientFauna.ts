/**
 * Ambient fauna (specs/polish/living-village.md deliverable 3; look spec §7):
 * butterflies working the flowers, dragonflies patrolling the water, crabs on
 * the beach and fish leaping out at sea. Not catchable (the catchable bugs are
 * VillageLife's nodes) and world state: who is out, where and when come from
 * the shared world clock, the map, the season, the hour and the weather, so
 * every client sees the same ones. The only local part is a crab scuttling
 * off from an avatar that comes too close.
 *
 * Every reader writes into a caller-owned object: the frame loop allocates
 * nothing.
 */
import { isWater, surfaceAt, worldToCellX, worldToCellZ, cellToWorldX, cellToWorldZ, inBounds, Surface, type IslandMap } from "./grid";
import type { WaterType } from "./fishingSpots";
import type { Season } from "./season";
import type { IslandWeather } from "./islandWeather";
import { hash01, type Point3 } from "./worldFx";

const TAU = Math.PI * 2;
const smooth = (x: number) => { const t = Math.min(1, Math.max(0, x)); return t * t * (3 - 2 * t); };

// ── Who is out ─────────────────────────────────────────────────────────
export type FlyerKind = "butterfly" | "dragonfly";
export interface FlyerSpecies {
  key: string; model: string; kind: FlyerKind; scale: number;
  seasons: readonly Season[];
  /** Toronto hours it's out, [from, to) (wrapping past midnight when from > to). */
  hours: readonly [number, number];
}
/** The ACNH critter models (Critters.SPECIES) as scenery: seasons and hours after ACNH's northern calendar; scales give every wingspan about half a unit. */
export const FLYERS: readonly FlyerSpecies[] = [
  { key: "common", model: "/assets/acnh/critters/common-butterfly.glb", kind: "butterfly", scale: 0.13, seasons: ["spring", "summer", "autumn"], hours: [7, 17.5] },
  { key: "tiger", model: "/assets/acnh/critters/tiger-butterfly.glb", kind: "butterfly", scale: 0.075, seasons: ["spring", "summer"], hours: [7.5, 17] },
  { key: "agrias", model: "/assets/acnh/critters/agrias-butterfly.glb", kind: "butterfly", scale: 0.075, seasons: ["summer"], hours: [8, 17] },
  { key: "monarch", model: "/assets/acnh/critters/monarch-butterfly.glb", kind: "butterfly", scale: 0.075, seasons: ["summer", "autumn"], hours: [8, 17] },
  { key: "peacock", model: "/assets/acnh/critters/peacock-butterfly.glb", kind: "butterfly", scale: 0.075, seasons: ["spring", "summer", "autumn"], hours: [5, 19] },
  { key: "emperor", model: "/assets/acnh/critters/emperor-butterfly.glb", kind: "butterfly", scale: 0.07, seasons: ["summer", "autumn"], hours: [17, 21] },
  { key: "darner", model: "/assets/acnh/critters/darner-dragonfly.glb", kind: "dragonfly", scale: 0.075, seasons: ["spring", "summer"], hours: [8, 17] },
  { key: "red", model: "/assets/acnh/critters/red-dragonfly.glb", kind: "dragonfly", scale: 0.1, seasons: ["summer", "autumn"], hours: [8, 18.5] },
];

/** Flyers hide from rain and snow, and from a gale. */
export const flyingWeather = (w: IslandWeather) => w === "clear" || w === "fog";

/** How far into its hours a flyer is (1 out, 0 away), easing over `ramp` hours at both ends (each critter its own few minutes off). */
export function outWeight(hour: number, hours: readonly [number, number], jitter: number, ramp = 0.25): number {
  const [a0, b0] = hours, a = a0 + jitter, b = b0 + jitter;
  const h = ((hour - a) % 24 + 24) % 24, len = ((b - a) % 24 + 24) % 24;
  if (h > len) return 0;
  return smooth(h / ramp) * smooth((len - h) / ramp);
}

// ── Where they live ────────────────────────────────────────────────────
export interface Flyer { species: FlyerSpecies; seed: number; jitter: number; patch: readonly (readonly [number, number])[] }
export interface Crab { model: string; seed: number; home: readonly [number, number]; sea: readonly [number, number] }
export interface FaunaSite {
  map: IslandMap;
  flowers: readonly (readonly [number, number])[];
  water: (x: number, z: number) => WaterType;
}

/** Land cells next to river or pond water: where dragonflies patrol. */
function waterEdges(site: FaunaSite): [number, number][] {
  const { map } = site, out: [number, number][] = [];
  for (let cz = 1; cz < map.depth - 1; cz++) for (let cx = 1; cx < map.width - 1; cx++) {
    if (isWater(surfaceAt(map, cx, cz))) continue;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      if (!isWater(surfaceAt(map, cx + dx, cz + dz))) continue;
      const wx = cellToWorldX(map, cx + dx), wz = cellToWorldZ(map, cz + dz), w = site.water(wx, wz);
      if (w === "sea") continue;
      // Over the water's edge, half a cell out.
      out.push([(cellToWorldX(map, cx) + wx) / 2, (cellToWorldZ(map, cz) + wz) / 2]);
      break;
    }
  }
  return out;
}

/** Sand cells on the sea's edge: the crabs' beach, each with the way to the water. */
function beachCells(site: FaunaSite): { at: [number, number]; sea: [number, number] }[] {
  const { map } = site, out: { at: [number, number]; sea: [number, number] }[] = [];
  for (let cz = 1; cz < map.depth - 1; cz++) for (let cx = 1; cx < map.width - 1; cx++) {
    if (surfaceAt(map, cx, cz) !== Surface.Sand) continue;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cx + dx, nz = cz + dz;
      if (!inBounds(map, nx, nz) || !isWater(surfaceAt(map, nx, nz))) continue;
      if (site.water(cellToWorldX(map, nx), cellToWorldZ(map, nz)) !== "sea") continue;
      out.push({ at: [cellToWorldX(map, cx) - dx * 0.2, cellToWorldZ(map, cz) - dz * 0.2], sea: [dx, dz] });
      break;
    }
  }
  return out;
}

/**
 * The island's flyers for a season: butterflies over the flower patches (two or three per patch of nearby flowers,
 * about one per three clusters), dragonflies along the river and pond edges. Deterministic per map and season.
 */
export function flyersFor(site: FaunaSite, season: Season, count = { butterflies: 10, dragonflies: 6 }): Flyer[] {
  const out: Flyer[] = [];
  const butterflies = FLYERS.filter(s => s.kind === "butterfly" && s.seasons.includes(season));
  const dragonflies = FLYERS.filter(s => s.kind === "dragonfly" && s.seasons.includes(season));
  const flowers = site.flowers;
  if (butterflies.length && flowers.length) {
    const n = Math.min(count.butterflies, Math.max(2, Math.round(flowers.length * 0.7)));
    for (let i = 0; i < n; i++) {
      const home = flowers[Math.floor(hash01(i, 11) * flowers.length)];
      // Its patch: the flowers within 7 units of home (at least home).
      const patch = flowers.filter(f => Math.hypot(f[0] - home[0], f[1] - home[1]) < 7);
      const sp = butterflies[Math.floor(hash01(i, 12) * butterflies.length)];
      out.push({ species: sp, seed: 1000 + i, jitter: (hash01(i, 13) - 0.5) * 0.8, patch: patch.length ? patch : [home] });
    }
  }
  const edges = dragonflies.length ? waterEdges(site) : [];
  if (edges.length) {
    for (let i = 0; i < count.dragonflies; i++) {
      const home = edges[Math.floor(hash01(i, 21) * edges.length)];
      const patch = edges.filter(e => Math.hypot(e[0] - home[0], e[1] - home[1]) < 5);
      out.push({ species: dragonflies[Math.floor(hash01(i, 22) * dragonflies.length)], seed: 2000 + i, jitter: (hash01(i, 23) - 0.5) * 0.8, patch });
    }
  }
  return out;
}

export const CRAB_MODELS = ["/assets/acnh/props/crab-gazami.glb", "/assets/acnh/props/crab-hermit.glb"];
/** Crabs along the beach, spread out (no two within 3 units). */
export function crabsFor(site: FaunaSite, count = 6): Crab[] {
  const cells = beachCells(site), out: Crab[] = [];
  for (let k = 0; k < cells.length * 4 && out.length < count; k++) {
    const c = cells[Math.floor(hash01(k, 31) * cells.length)];
    if (!c || out.some(o => Math.hypot(o.home[0] - c.at[0], o.home[1] - c.at[1]) < 3)) continue;
    out.push({ model: CRAB_MODELS[out.length % CRAB_MODELS.length], seed: 3000 + out.length, home: c.at, sea: c.sea });
  }
  return out;
}

// ── How they move ──────────────────────────────────────────────────────
export interface FlyerPose { x: number; y: number; z: number; yaw: number; flap: number; scale: number }
export const newFlyerPose = (): FlyerPose => ({ x: 0, y: 0, z: 0, yaw: 0, flap: 0, scale: 1 });

/** Seconds a butterfly spends per flower: a short flight there, then a long hover and settle. */
const VISIT = 9, FLIGHT = 2.6;

/**
 * A butterfly at world time `t` (seconds), out by `weight` (0 away, 1 here; it comes down from and leaves up into
 * the sky). It drifts from flower to flower in its patch on a seeded schedule, bobbing in flight, then settles over the
 * flower with slow wingbeats. `ground` gives the flower's height.
 */
export function butterflyAt(f: Flyer, t: number, weight: number, ground: (x: number, z: number) => number, out: FlyerPose): FlyerPose {
  const s = f.seed, k = t / VISIT + hash01(s, 1) * 50, n = Math.floor(k), u = (k - n) * VISIT;
  const pick = (m: number) => f.patch[Math.floor(hash01(s, m * 7 + 3) * f.patch.length)];
  const a = pick(n - 1), b = pick(n);
  // A point a little off each flower's centre (clusters are about a unit wide).
  const off = (m: number, c: number) => (hash01(s + c, m) - 0.5) * 0.9;
  const ax = a[0] + off(n - 1, 1), az = a[1] + off(n - 1, 2), bx = b[0] + off(n, 1), bz = b[1] + off(n, 2);
  const fly = Math.min(1, u / FLIGHT), e = smooth(fly);
  let x = ax + (bx - ax) * e, z = az + (bz - az) * e;
  // Flight: a lazy loop sideways and a bob; settled: a small hover.
  const dist = Math.hypot(bx - ax, bz - az), side = Math.sin(fly * Math.PI) * Math.min(0.8, dist * 0.25);
  const nx = dist > 1e-3 ? -(bz - az) / dist : 0, nz = dist > 1e-3 ? (bx - ax) / dist : 0;
  x += nx * side * (hash01(s, n) < 0.5 ? 1 : -1); z += nz * side * (hash01(s, n) < 0.5 ? 1 : -1);
  const settle = fly >= 1, arc = Math.sin(fly * Math.PI);
  // A slow drift and hover all the time (so landing and taking off never jump), a bob and a rise in flight.
  const hover = 0.08 * Math.sin(t * 1.7 + s) + arc * (0.25 + 0.06 * Math.sin(t * 9 + s));
  x += 0.12 * Math.sin(t * 0.7 + s); z += 0.1 * Math.cos(t * 0.6 + s);
  let y = ground(x, z) + 0.42 + hover + hash01(s, 5) * 0.2;
  // Away: lifted and blown off downwind.
  const away = 1 - smooth(weight);
  x += away * 4; z += away * 2; y += away * 6;
  out.x = x; out.y = y; out.z = z;
  out.yaw = settle ? Math.atan2(bx - ax, bz - az) + 0.6 * Math.sin(t * 0.3 + s) : Math.atan2(bx - ax, bz - az);
  // Wings: quick beats in flight, slow open-and-close settled (radians up from flat).
  out.flap = settle ? 0.55 + 0.45 * Math.sin(t * 2.2 + s) : 0.6 + 0.6 * Math.sin(t * 34 + s);
  out.scale = f.species.scale * Math.min(1, weight * 4);
  return out;
}

/** Dragonflies hover, then dart to the next spot along the water's edge. */
const HOVER = 1.6, DART = 0.35;
export function dragonflyAt(f: Flyer, t: number, weight: number, ground: (x: number, z: number) => number, out: FlyerPose): FlyerPose {
  const s = f.seed, period = HOVER + DART, k = t / period + hash01(s, 1) * 40, n = Math.floor(k), u = (k - n) * period;
  const pick = (m: number) => f.patch[Math.floor(hash01(s, m * 5 + 2) * f.patch.length)];
  const a = pick(n - 1), b = pick(n);
  const off = (m: number, c: number) => (hash01(s + c, m) - 0.5) * 1.6;
  const ax = a[0] + off(n - 1, 1), az = a[1] + off(n - 1, 2), bx = b[0] + off(n, 1), bz = b[1] + off(n, 2);
  // Hovering at a then darting to b in the last DART seconds.
  const d = smooth((u - HOVER) / DART);
  let x = ax + (bx - ax) * d, z = az + (bz - az) * d;
  x += 0.04 * Math.sin(t * 7 + s); z += 0.04 * Math.cos(t * 6 + s);
  let y = Math.max(ground(x, z), 0) + 0.55 + 0.12 * Math.sin(t * 1.3 + s) + (hash01(s, 6) - 0.5) * 0.2;
  const away = 1 - smooth(weight);
  x += away * 5; y += away * 6;
  out.x = x; out.y = y; out.z = z;
  // Facing where it's going; while hovering it turns slowly to the next spot.
  out.yaw = Math.atan2(bx - ax, bz - az);
  out.flap = 0.25 + 0.25 * Math.sin(t * 60 + s);
  out.scale = f.species.scale * Math.min(1, weight * 4);
  return out;
}

// ── Crabs ──────────────────────────────────────────────────────────────
export interface CrabState { x: number; z: number; yaw: number; sink: number; fleeX: number; fleeZ: number; fleeT: number; hiddenUntil: number; clearSince: number }
/** A crab faces the sea (its +z) and walks along its x: sideways, along the waterline. */
export const newCrabState = (c: Crab): CrabState => ({ x: c.home[0], z: c.home[1], yaw: Math.atan2(c.sea[0], c.sea[1]), sink: 0, fleeX: 0, fleeZ: 0, fleeT: -1, hiddenUntil: 0, clearSince: 0 });
/** An avatar this close sends a crab scuttling; it digs in after the dash and comes up once nobody is near for a while. */
export const CRAB_SCARE = 2.2, CRAB_CALM = 4, CRAB_HIDE_S = 6;
const SCUTTLE = { speed: 2.4, time: 0.9 };

/**
 * A crab at world time `t`: idle, it sidles back and forth along the waterline on a seeded beat; scared by the nearest
 * avatar (`ax, az`; NaN for none), it scuttles sideways away from it, digs into the sand and stays down until nobody is
 * near for CRAB_HIDE_S. `dt` advances the scare (the only local state).
 */
export function crabStep(c: Crab, s: CrabState, t: number, dt: number, ax: number, az: number, standable: (x: number, z: number) => boolean): CrabState {
  const d = Number.isNaN(ax) ? Infinity : Math.hypot(ax - s.x, az - s.z);
  if (d < CRAB_CALM) s.clearSince = t;
  if (s.fleeT < 0 && s.sink < 0.5 && d < CRAB_SCARE) {
    // Away from the avatar, along the crab's sideways line (crabs scuttle sideways).
    const ux = (s.x - ax) / (d || 1), uz = (s.z - az) / (d || 1);
    s.fleeX = ux; s.fleeZ = uz; s.fleeT = 0;
    // Its x along the way it runs (three's yaw turns local x to (cos, −sin)), facing either side.
    s.yaw = Math.atan2(-uz, ux) + (hash01(c.seed, Math.floor(t)) < 0.5 ? 0 : Math.PI);
  }
  if (s.fleeT >= 0) {
    s.fleeT += dt;
    const nx = s.x + s.fleeX * SCUTTLE.speed * dt, nz = s.z + s.fleeZ * SCUTTLE.speed * dt;
    if (standable(nx, nz)) { s.x = nx; s.z = nz; }
    if (s.fleeT > SCUTTLE.time) { s.fleeT = -1; s.hiddenUntil = t + CRAB_HIDE_S; }
    return s;
  }
  // Down in the sand until it's been quiet a while, then up again where it dug in.
  const hide = t < s.hiddenUntil || t - s.clearSince < CRAB_HIDE_S;
  s.sink += ((hide && s.hiddenUntil > 0 ? 1 : 0) - s.sink) * Math.min(1, dt * (hide ? 3 : 1.2));
  if (!hide && s.sink < 0.02) {
    s.hiddenUntil = 0;
    // Idle: a sidle a few tenths along the waterline, every few seconds, then back.
    const beat = 3.5 + hash01(c.seed, 1) * 2, k = t / beat, n = Math.floor(k), u = k - n;
    const along = (hash01(c.seed, n) - 0.5) * 0.7, prev = (hash01(c.seed, n - 1) - 0.5) * 0.7;
    const step = prev + (along - prev) * smooth(u / 0.25);
    const tx = -c.sea[1], tz = c.sea[0];
    // Drift home along the waterline (after a scare it walks back the slow way).
    const hx = c.home[0] + tx * step, hz = c.home[1] + tz * step;
    s.x += (hx - s.x) * Math.min(1, dt * 1.5); s.z += (hz - s.z) * Math.min(1, dt * 1.5);
    s.yaw = Math.atan2(c.sea[0], c.sea[1]);
  }
  return s;
}

// ── Gulls ──────────────────────────────────────────────────────────────
/**
 * Where the gulls circle: just off the island's side shores and twice off its far shore, where the follow camera
 * looks out over the sea, and over any `extra` spots. Never off the near shore (−z): flying that low there, a gull's
 * orbit runs through the camera.
 */
export function gullAnchors(b: { minX: number; maxX: number; minZ: number; maxZ: number; cx: number; cz: number }, extra: readonly (readonly [number, number])[] = []): [number, number][] {
  return [[b.maxX + 4, b.cz + 3], [b.minX - 4, b.cz - 2], [b.cx - 5, b.maxZ + 4], [b.cx + 8, b.maxZ + 3], ...extra.map(([x, z]): [number, number] => [x, z])];
}

// ── Fish jumping at sea ────────────────────────────────────────────────
/** Open sea at a point: the site calls it sea and it's water (off the map is open sea). */
export function seaAt(site: FaunaSite, x: number, z: number): boolean {
  const cx = worldToCellX(site.map, x), cz = worldToCellZ(site.map, z);
  return site.water(x, z) === "sea" && (!inBounds(site.map, cx, cz) || isWater(surfaceAt(site.map, cx, cz)));
}
/** A world grid of sea squares; each may have a fish leap in each slot, at a seeded moment and spot. */
const FISH_CELL = 10, FISH_SLOT = 11, FISH_CHANCE = 0.22, LEAP = 0.95;
export const FISH_MODELS = ["/assets/acnh/fish/horse-mackerel.glb", "/assets/acnh/fish/anchovy.glb", "/assets/acnh/fish/sea-bass.glb"];
export interface Leap { x: number; z: number; yaw: number; u: number; model: number; t0: number; id: number }

/**
 * The leaps under way at `t` round (cx, cz) (the view focus: which part of the sea is drawn, not where fish are),
 * in sea that is open (`isSea`). Writes up to `out.length` into `out` and returns how many.
 */
export function leapsAt(t: number, cx: number, cz: number, radius: number, isSea: (x: number, z: number) => boolean, out: Leap[]): number {
  let n = 0;
  const c0x = Math.floor((cx - radius) / FISH_CELL), c1x = Math.floor((cx + radius) / FISH_CELL);
  const c0z = Math.floor((cz - radius) / FISH_CELL), c1z = Math.floor((cz + radius) / FISH_CELL);
  for (let gz = c0z; gz <= c1z; gz++) for (let gx = c0x; gx <= c1x; gx++) {
    const cell = gx * 7919 + gz * 104729;
    // This slot and the one before (a leap that started near the end of the last slot is still in the air).
    for (let back = 0; back <= 1; back++) {
      const slot = Math.floor(t / FISH_SLOT) - back;
      if (hash01(cell, slot * 3) > FISH_CHANCE) continue;
      const t0 = slot * FISH_SLOT + hash01(cell, slot * 3 + 1) * (FISH_SLOT - LEAP), u = (t - t0) / LEAP;
      if (u < 0 || u > 1.6) continue;
      const x = (gx + hash01(cell, slot * 3 + 2)) * FISH_CELL, z = (gz + hash01(cell + 1, slot * 3 + 2)) * FISH_CELL;
      if (Math.hypot(x - cx, z - cz) > radius || !isSea(x, z)) continue;
      if (n >= out.length) return n;
      const o = out[n++];
      o.x = x; o.z = z; o.yaw = hash01(cell + 2, slot) * TAU; o.u = u; o.t0 = t0; o.model = Math.floor(hash01(cell + 3, slot) * FISH_MODELS.length); o.id = cell * 131 + slot;
    }
  }
  return n;
}

/** A leap's arc at `u` (0 leaving the water, 1 back in): along its heading 1.3 units, 0.75 up, nose up then down. */
export function leapPose(l: Leap, out: Point3 & { pitch: number }): void {
  const u = Math.min(1, l.u), along = (u - 0.5) * 1.3;
  out.x = l.x + Math.sin(l.yaw) * along; out.z = l.z + Math.cos(l.yaw) * along;
  out.y = 4 * u * (1 - u) * 0.75 - 0.12;
  out.pitch = (0.5 - u) * 1.9;
}
