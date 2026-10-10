/**
 * Resident routines (specs/polish/living-village.md deliverable 1; rows 85, 122).
 *
 * A resident's day is world state: where they are is a function of the shared
 * world clock (worldClock.ts), the day's real sunrise and sunset, the village
 * map and their schedule, so every client sees the same resident at the same
 * spot. Each phase of the day is a list of stops (map anchors, a bench, their
 * home door); they walk between stops on a path round every solid at stride
 * speed, stop at each one for a while and idle there, and at night go home
 * through a door or sit on a bench under a lamp. Nothing here reads a player.
 *
 * The day runs 03:00 to 03:00 Toronto (the world clock's quiet hour), built
 * once per day and sun times as a list of legs (walks and stays); `poseAt`
 * reads it with a binary search and writes into a caller-owned pose, so the
 * frame loop allocates nothing.
 */
import { CLIFF_LEVELS, levelAt, rampRun, worldToCellX, worldToCellZ } from "./grid";
import { BENCH_SEAT_TOP, LANDMARK_INFO, benchSlotKey, benchSlotPoint, landmark, type LandmarkId, type VillageIsland } from "./defaultIsland";
import { objectById, objectsOf, villageSpawnPoint, type Village } from "./villageMap";
import { ISLAND_PHASES, type IslandPhase } from "./islandTime";
import { DAWN_HOURS, EVENING_HALF_HOURS, sunFor, torontoDate, type SunDay } from "./sunTimes";
import { hash01 } from "./worldFx";
import { torontoInstant } from "@/lib/time";

// ── Walking ─────────────────────────────────────────────────────────────
/** A resident's stroll (world units/s): an unhurried ACNH pace. */
export const RESIDENT_WALK = 0.95;
/** The Walk clip's own speed at tempo 1 (its stance foot sweeps 0.55 m/s on the 1.045 m body, × 1.3 scale): feet don't skate. */
export const RESIDENT_STRIDE = 0.71;
/** Seconds to get up to speed and to slow to a stop at either end of a walk. */
const RAMP = 0.35;
/** Grid step of the walking map (world units). */
const NAV_STEP = 0.5;
/** How far a resident keeps from anything solid, water or a cliff edge. */
const BODY = 0.3;
/** Bushes and flower clusters are walked round (this far from their middle), and through only when there's no other way. */
const PLANT_CLEAR = { bush: 0.85, flower: 0.85 } as const;
/** How much a step through a plant costs against one on open ground. */
const PLANT_COST = 8;

/** Where the inside point sits past the door, into the building (hidden there). */
const INSIDE_DEPTH = 0.9;
/** Where you stand before sitting: this far in front of the seat. */
const SEAT_APPROACH = 0.62;

// ── Stops ───────────────────────────────────────────────────────────────
export type IdleKind = "idle" | "look" | "stretch" | "gaze";
export type StopKind = "stand" | "sit" | "home";
/** A bench slot (the seat model players and bots share, defaultIsland BENCH_SLOTS): its claim key, the seat, the step in front of it. */
export interface SeatSlot { key: string; at: readonly [number, number]; door: readonly [number, number] }
export interface Stop {
  /** Stable per resident and place (hashing, chats). */
  id: string;
  kind: StopKind;
  /** Where they stand, sit, or (home) the hidden point just inside the door. */
  at: readonly [number, number];
  /** home: the door step outside; sit: the spot in front of the seat. Walks start and end here. */
  door?: readonly [number, number];
  /** Facing while there (radians, +z = 0). */
  yaw: number;
  /** sit: seat top above the ground at `at`. */
  seat?: number;
  /** sit: the bench slot's claim key (`bench:<id>#0|1`), and the bench's other slot, where they sit when a player holds theirs. */
  seatKey?: string;
  alt?: SeatSlot | null;
  /** Seconds there, drawn per visit from the range. */
  dwell: readonly [number, number];
  /** Which idles this place invites. */
  idles: readonly IdleKind[];
}

/** Special schedule keys besides the map's anchors: home (through the door), a bench (under a lamp when one is near). */
export const ROUTINE_SPECIAL = { home: { label: "Home (goes inside)" }, bench: { label: "Bench (under a lamp at night)" } } as const;
/** A resident's home building by post; a resident's own `home` in the schedule wins. */
export const POST_HOME: Record<string, LandmarkId> = {
  hq_lead: "hq", shopkeeper: "shop", cafe_owner: "cafe", museum_curator: "museum", wharf_keeper: "hq",
  oracle_keeper: "oracle", workshop_crafter: "hq", villager: "hq",
};
/** Landmarks a resident can live in (a door; the wharf: aboard a boat at the stub end, once one is docked there). */
export const HOME_LANDMARKS: readonly LandmarkId[] = ["hq", "shop", "cafe", "oracle", "museum", "wharf"];

/** What a resident's data says (npc_personas: slug, post, schedule). */
export interface ResidentSource { slug: string; post?: string | null; schedule?: Record<string, unknown> | null }
/** A phase's routine from the schedule: one key or a list. */
export function routineKeys(schedule: Record<string, unknown> | null | undefined, phase: IslandPhase): string[] {
  const s = schedule ?? {};
  const read = (v: unknown) => (typeof v === "string" ? [v] : Array.isArray(v) ? v.filter((k): k is string => typeof k === "string") : []);
  const own = read(s[phase]);
  if (own.length) return own;
  // No routine for this phase: dawn and evening keep the day's; night goes home.
  if (phase === "night") return ["home"];
  return read(s.day).length ? read(s.day) : ["plaza"];
}

const hashStr = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h | 0;
};

// ── The walking map ─────────────────────────────────────────────────────
/**
 * Free ground on a 0.5 grid for a resident's body (the walker's `standable` round a 0.3 body, off bushes and
 * flowers), and the walker's level rule between neighbours, both lazily cached. A* over it, then string-pulled.
 */
export class NavGrid {
  readonly x0: number; readonly z0: number; readonly w: number; readonly h: number;
  private readonly free: Int8Array;
  private readonly plants: { x: number; z: number; r: number }[];
  constructor(private readonly island: VillageIsland, v: Village) {
    const { map } = v;
    this.x0 = map.originX - 0.5; this.z0 = map.originZ - 0.5;
    this.w = Math.ceil(map.width / NAV_STEP); this.h = Math.ceil(map.depth / NAV_STEP);
    this.free = new Int8Array(this.w * this.h).fill(-1);
    this.plants = [...objectsOf("bush", v).map(o => ({ x: o.x, z: o.z, r: PLANT_CLEAR.bush })), ...objectsOf("flower", v).map(o => ({ x: o.x, z: o.z, r: PLANT_CLEAR.flower }))];
  }
  cx(x: number) { return Math.floor((x - this.x0) / NAV_STEP); }
  cz(z: number) { return Math.floor((z - this.z0) / NAV_STEP); }
  wx(c: number) { return this.x0 + (c + 0.5) * NAV_STEP; }
  wz(c: number) { return this.z0 + (c + 0.5) * NAV_STEP; }
  /** A point a resident's body fits on: free ground all round it (plants aside). */
  body(x: number, z: number): boolean {
    const s = this.island.standable;
    return s(x, z) && s(x + BODY, z) && s(x - BODY, z) && s(x, z + BODY) && s(x, z - BODY);
  }
  /** A plant underfoot (a bush or a flower cluster): walked round when there's a way, through only when there isn't. */
  plant(x: number, z: number): boolean {
    for (const p of this.plants) if (Math.abs(p.x - x) < p.r && Math.abs(p.z - z) < p.r && Math.hypot(p.x - x, p.z - z) < p.r) return true;
    return false;
  }
  /** Where a resident stops: the body fits and no plant is underfoot. */
  fits(x: number, z: number): boolean { return this.body(x, z) && !this.plant(x, z); }
  /** A cell's state: 0 solid or water, 1 free, 2 a plant (walkable at a cost). */
  cell(cx: number, cz: number): number {
    if (cx < 0 || cz < 0 || cx >= this.w || cz >= this.h) return 0;
    const i = cz * this.w + cx;
    if (this.free[i] < 0) { const x = this.wx(cx), z = this.wz(cz); this.free[i] = !this.body(x, z) ? 0 : this.plant(x, z) ? 2 : 1; }
    return this.free[i];
  }
  cellFree(cx: number, cz: number): boolean { return this.cell(cx, cz) === 1; }
  /** The walker's level rule (defaultIsland canStep): a ramp follows its slope, elsewhere under two levels. */
  step(x: number, z: number, nx: number, nz: number): boolean {
    const map = this.island.map, ground = this.island.ground;
    const a = worldToCellX(map, x), b = worldToCellZ(map, z), c = worldToCellX(map, nx), d = worldToCellZ(map, nz);
    if (a === c && b === d) return true;
    if (rampRun(map, a, b) || rampRun(map, c, d)) return Math.abs(ground(nx, nz) - ground(x, z)) < 0.5;
    return Math.abs(levelAt(map, c, d) - levelAt(map, a, b)) < CLIFF_LEVELS;
  }
  /** Whether a straight walk from a to b stays on free ground (sampled every 0.2). */
  clear(ax: number, az: number, bx: number, bz: number): boolean {
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 0.2));
    let px = ax, pz = az;
    for (let i = 1; i <= n; i++) {
      const x = ax + (bx - ax) * i / n, z = az + (bz - az) * i / n;
      if (!this.cellFree(this.cx(x), this.cz(z)) || !this.fits(x, z) || !this.step(px, pz, x, z)) return false;
      px = x; pz = z;
    }
    return true;
  }
  /** The free cell nearest a point (spiral out to 3 units), as world XZ; null when there is none. */
  snap(x: number, z: number): [number, number] | null {
    const cx = this.cx(x), cz = this.cz(z);
    let best: [number, number] | null = null, bestD = Infinity;
    for (let r = 0; r <= 6 && !best; r++) {
      for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r || !this.cellFree(cx + dx, cz + dz)) continue;
        const wx = this.wx(cx + dx), wz = this.wz(cz + dz), d = Math.hypot(wx - x, wz - z);
        if (d < bestD) { bestD = d; best = [wx, wz]; }
      }
    }
    return best;
  }
  /** A* (8-way, no corner cutting) from a to b, then string-pulled; null when unreachable. Points include both ends. */
  path(ax: number, az: number, bx: number, bz: number): [number, number][] | null {
    if (this.clear(ax, az, bx, bz)) return [[ax, az], [bx, bz]];
    const s = this.snap(ax, az), g = this.snap(bx, bz);
    if (!s || !g) return null;
    const start = this.cz(s[1]) * this.w + this.cx(s[0]), goal = this.cz(g[1]) * this.w + this.cx(g[0]);
    const came = new Map<number, number>(), cost = new Map<number, number>([[start, 0]]);
    const heap = new MinHeap();
    const hx = this.cx(g[0]), hz = this.cz(g[1]);
    const heur = (i: number) => { const dx = Math.abs(i % this.w - hx), dz = Math.abs(Math.floor(i / this.w) - hz); return (Math.max(dx, dz) + 0.4142 * Math.min(dx, dz)) * NAV_STEP; };
    heap.push(start, heur(start));
    let found = false, guard = 0;
    while (heap.size && guard++ < 60000) {
      const i = heap.pop();
      if (i === goal) { found = true; break; }
      const cx = i % this.w, cz = Math.floor(i / this.w), g0 = cost.get(i)!;
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dz) continue;
        const nx = cx + dx, nz = cz + dz;
        const c = this.cell(nx, nz);
        if (!c) continue;
        if (dx && dz && (!this.cell(cx + dx, cz) || !this.cell(cx, cz + dz))) continue;
        if (!this.step(this.wx(cx), this.wz(cz), this.wx(nx), this.wz(nz))) continue;
        const j = nz * this.w + nx, gj = g0 + (dx && dz ? 1.4142 : 1) * NAV_STEP * (c === 2 ? PLANT_COST : 1);
        if (gj < (cost.get(j) ?? Infinity)) { cost.set(j, gj); came.set(j, i); heap.push(j, gj + heur(j)); }
      }
    }
    if (!found) return null;
    const cells: [number, number][] = [];
    for (let i: number | undefined = goal; i !== undefined; i = came.get(i)) cells.push([this.wx(i % this.w), this.wz(Math.floor(i / this.w))]);
    cells.reverse();
    const raw: [number, number][] = [[ax, az], ...cells, [bx, bz]];
    // String-pull: from each kept point, jump to the farthest point it can see.
    const out: [number, number][] = [raw[0]];
    let k = 0;
    while (k < raw.length - 1) {
      let j = raw.length - 1;
      while (j > k + 1 && !this.clear(raw[k][0], raw[k][1], raw[j][0], raw[j][1])) j--;
      out.push(raw[j]);
      k = j;
    }
    return out;
  }
}

class MinHeap {
  private ids: number[] = []; private keys: number[] = [];
  get size() { return this.ids.length; }
  push(id: number, key: number) {
    const a = this.ids, k = this.keys;
    let i = a.length;
    a.push(id); k.push(key);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (k[p] <= k[i]) break;
      [a[p], a[i]] = [a[i], a[p]]; [k[p], k[i]] = [k[i], k[p]];
      i = p;
    }
  }
  pop(): number {
    const a = this.ids, k = this.keys, top = a[0], lastId = a.pop()!, lastKey = k.pop()!;
    if (a.length) {
      a[0] = lastId; k[0] = lastKey;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < a.length && k[l] < k[m]) m = l;
        if (r < a.length && k[r] < k[m]) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]]; [k[m], k[i]] = [k[i], k[m]];
        i = m;
      }
    }
    return top;
  }
}

const navs = new WeakMap<Village, NavGrid>();
export function navGrid(island: VillageIsland, v: Village): NavGrid {
  let n = navs.get(v);
  if (!n) navs.set(v, n = new NavGrid(island, v));
  return n;
}

// ── Resolving a schedule into stops ─────────────────────────────────────
/** Where each anchor looks: water at the pond, beach and wharf; out from the building at a door anchor. */
const ANCHOR_VIEW: Partial<Record<string, LandmarkId>> = { pond: "pond", beach: "beach", wharf: "wharf", plaza: "monument" };
const ANCHOR_BUILDING: Partial<Record<string, LandmarkId>> = { hq: "hq", shop: "shop", cafe: "cafe", oracle: "oracle", museum: "museum" };
const WATER_ANCHORS = new Set(["pond", "beach", "wharf"]);

/**
 * A resident's place round an anchor, so residents sharing a place stand apart and face in: the first ring, then wider
 * ones when it's full or in the water (ten residents can share one place).
 */
const RINGS = [{ r: 0.75, n: 6 }, { r: 1.5, n: 10 }, { r: 2.25, n: 14 }] as const;
/** Two residents' stops are never closer than this (world units), whatever the phase: nobody stands inside anybody. */
export const STOP_SPACING = 0.8;

/**
 * What the residents planned so far hold, so the next one plans round them (planResidents, in a fixed order, so every
 * client agrees): bench slots per phase, each one's spot at each anchor, and every spot anyone stops at.
 */
export interface Reservations {
  seats: Record<IslandPhase, Set<string>>;
  anchors: Map<string, readonly [number, number]>;
  spots: { x: number; z: number; slug: string }[];
}
export const newReservations = (): Reservations => ({
  seats: { dawn: new Set(), day: new Set(), evening: new Set(), night: new Set() }, anchors: new Map(), spots: [],
});
/** Nobody else stops within STOP_SPACING of (x, z). */
function spotFree(res: Reservations, slug: string, x: number, z: number): boolean {
  for (const s of res.spots) if (s.slug !== slug && Math.hypot(s.x - x, s.z - z) < STOP_SPACING) return false;
  return true;
}

export interface ResidentPlan {
  slug: string;
  seed: number;
  home: Stop | null;
  phases: Record<IslandPhase, Stop[]>;
}

const yawTo = (ax: number, az: number, bx: number, bz: number) => Math.atan2(bx - ax, bz - az);

/** A building's door step and the hidden point behind it, in world XZ. */
function homeStop(id: LandmarkId, v: Village, slug: string, nav: NavGrid): Stop | null {
  const l = landmark(id, v);
  if (!l) return null;
  const info = LANDMARK_INFO[id], yaw = l.yaw ?? 0;
  const turn = (dx: number, dz: number): [number, number] => yaw ? [l.x + dx * Math.cos(yaw) + dz * Math.sin(yaw), l.z - dx * Math.sin(yaw) + dz * Math.cos(yaw)] : [l.x + dx, l.z + dz];
  // The door (or prompt) point; a building without one is entered at the middle of its front (−z faces the camera).
  const doorLocal: [number, number] = info.door ?? [0, -((info.half?.[1] ?? 0) + 0.3)];
  const step = nav.snap(...turn(doorLocal[0], doorLocal[1]));
  if (!step) return null;
  // Inside: past the door into the footprint (the wharf: aboard at the stub end, past its door point).
  const inside = id === "wharf" ? turn(doorLocal[0], doorLocal[1] - INSIDE_DEPTH) : turn(doorLocal[0], doorLocal[1] + 0.3 + INSIDE_DEPTH);
  const facing = yawTo(step[0], step[1], inside[0], inside[1]);
  return { id: `home:${id}:${slug}`, kind: "home", at: inside, door: step, yaw: facing, dwell: [150, 320], idles: ["idle"] };
}

/**
 * A bench seat: one of the two slots players and bots sit in (defaultIsland BENCH_SLOTS), on a bench under a lamp first
 * in the evening and only there at night (`dark`), else the nearest to `near`; the slot nearer the way they come, unless another resident has it this phase
 * (`taken`, claim keys). Backless: they sit facing the side they came from, approaching from it.
 */
function benchStop(v: Village, nav: NavGrid, near: readonly [number, number], night: boolean, dark: boolean, taken: Set<string>): Stop | null {
  const benches = objectsOf("bench", v);
  if (!benches.length) return null;
  const lamps = objectsOf("lamp", v);
  const lit = (b: { x: number; z: number }) => lamps.some(l => Math.hypot(l.x - b.x, l.z - b.z) < 3.2);
  // After dark only a bench under a lamp will do (when the village has one): with those full, they skip the bench.
  const any = !dark || !lamps.length || !benches.some(lit);
  const ranked = [...benches].filter(b => any || lit(b)).sort((a, b) => (night ? Number(lit(b)) - Number(lit(a)) : 0) || Math.hypot(a.x - near[0], a.z - near[1]) - Math.hypot(b.x - near[0], b.z - near[1]));
  for (const b of ranked) {
    const yaw = b.yaw ?? 0;
    // The step in front of a slot on one side (local ±z), or null when that side is blocked.
    const front = (slot: 0 | 1, face: number): SeatSlot | null => {
      const at = benchSlotPoint(b, slot), f = nav.snap(at[0] + Math.sin(face) * SEAT_APPROACH, at[1] + Math.cos(face) * SEAT_APPROACH);
      return f && Math.hypot(f[0] - at[0], f[1] - at[1]) <= 1.2 ? { key: benchSlotKey(b.id, slot), at, door: f } : null;
    };
    let best: { slot: SeatSlot; face: number; other: 0 | 1 } | null = null, bestD = Infinity;
    for (const slot of [0, 1] as const) for (const face of [yaw, yaw + Math.PI]) {
      const s = front(slot, face);
      if (!s || taken.has(s.key)) continue;
      const d = Math.hypot(s.door[0] - near[0], s.door[1] - near[1]);
      if (d < bestD) { bestD = d; best = { slot: s, face, other: slot === 0 ? 1 : 0 }; }
    }
    if (!best) continue;
    taken.add(best.slot.key);
    return {
      id: best.slot.key, kind: "sit", at: best.slot.at, door: best.slot.door, yaw: best.face, seat: BENCH_SEAT_TOP,
      seatKey: best.slot.key, alt: front(best.other, best.face),
      dwell: night ? [420, 900] : [90, 220], idles: ["idle"],
    };
  }
  return null;
}

/**
 * Which seat a sitter takes (client-side: the routine stays shared): 0 their own slot; 1 the bench's other slot when
 * someone else holds theirs (a player's claim, a player or bot on it, another resident); 2 neither is free, so they
 * stand at their seat's front step. `held(key, x, z)`: someone else holds that slot. `prev`, their pick so far this
 * visit: once moved over to the other slot they stay there while it's free.
 */
export function seatChoice(stop: Stop, held: (key: string, x: number, z: number) => boolean, prev: 0 | 1 | 2 = 0): 0 | 1 | 2 {
  const alt = stop.alt;
  if (prev === 1 && alt && !held(alt.key, alt.at[0], alt.at[1])) return 1;
  if (!stop.seatKey || !held(stop.seatKey, stop.at[0], stop.at[1])) return 0;
  return alt && !held(alt.key, alt.at[0], alt.at[1]) ? 1 : 2;
}

/** A spot at an anchor for this resident: its ring slot (or the next free one), facing the place's point of interest. */
function anchorStop(key: string, v: Village, nav: NavGrid, slot: number, work: boolean, night: boolean, slug: string, res: Reservations): Stop | null {
  const a = objectById("anchor", key, v);
  const base: [number, number] | null = a ? [a.x, a.z] : key === "plaza" ? villageSpawnPoint(v) : null;
  if (!base) return null;
  // The same spot at a place all day: theirs once taken.
  const mine = `${slug}|${key}`;
  let at: readonly [number, number] | null = res.anchors.get(mine) ?? null;
  const turn = hash01(hashStr(key), 7) * Math.PI * 2;
  for (const ring of RINGS) {
    for (let k = 0; k < ring.n && !at; k++) {
      const ang = turn + ((slot + k) % ring.n) * (Math.PI * 2 / ring.n);
      const x = base[0] + Math.sin(ang) * ring.r, z = base[1] + Math.cos(ang) * ring.r;
      if (nav.fits(x, z) && nav.clear(base[0], base[1], x, z) && spotFree(res, slug, x, z)) at = [x, z];
    }
  }
  // Every ring full or in the water: the nearest free cell nobody else stands on.
  for (let r = 0; r <= 8 && !at; r++) {
    for (let dz = -r; dz <= r && !at; dz++) for (let dx = -r; dx <= r && !at; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
      const cx = nav.cx(base[0]) + dx, cz = nav.cz(base[1]) + dz, x = nav.wx(cx), z = nav.wz(cz);
      if (nav.cellFree(cx, cz) && nav.fits(x, z) && spotFree(res, slug, x, z)) at = [x, z];
    }
  }
  at ??= nav.snap(base[0], base[1]);
  if (!at) return null;
  if (!res.anchors.has(mine)) { res.anchors.set(mine, at); res.spots.push({ x: at[0], z: at[1], slug }); }
  const view = ANCHOR_VIEW[key] && landmark(ANCHOR_VIEW[key]!, v), building = ANCHOR_BUILDING[key] && landmark(ANCHOR_BUILDING[key]!, v);
  // Out from a building's front; toward the water or the monument; else toward the anchor's middle.
  const yaw = building ? yawTo(building.x, building.z, at[0], at[1])
    : view ? (key === "beach" || key === "wharf" ? yawTo(at[0], at[1], at[0], at[1] - 6) : yawTo(at[0], at[1], view.x, view.z))
    : yawTo(at[0], at[1], base[0], base[1]);
  const water = WATER_ANCHORS.has(key);
  return {
    id: `anchor:${key}`, kind: "stand", at, yaw,
    // A resident's own post (the shop for the shopkeeper) holds them longest; at night they linger under the lamps.
    dwell: work ? [140, 300] : night ? [600, 1500] : water ? [60, 140] : [40, 100],
    idles: water ? ["gaze", "look", "idle"] : ["idle", "look", "stretch"],
  };
}

/** Two more spots near a lone anchor, so a one-place schedule still mills about (walkable, a short reachable stroll away). */
function wanderStops(stop: Stop, nav: NavGrid, seed: number, slug: string, res: Reservations): Stop[] {
  const out: Stop[] = [];
  for (let k = 0; k < 8 && out.length < 2; k++) {
    const ang = hash01(seed, 40 + k) * Math.PI * 2, r = 1.6 + hash01(seed, 60 + k) * 1.4;
    const x = stop.at[0] + Math.sin(ang) * r, z = stop.at[1] + Math.cos(ang) * r;
    if (!nav.fits(x, z) || !nav.clear(stop.at[0], stop.at[1], x, z) || !spotFree(res, slug, x, z)) continue;
    res.spots.push({ x, z, slug });
    out.push({ ...stop, id: `${stop.id}~${k}`, at: [x, z], yaw: stop.yaw + (hash01(seed, 80 + k) - 0.5) * 1.6, dwell: [18, 45] });
  }
  return out;
}

/** The post's anchor (where they work), for the longer stay there. */
const POST_ANCHOR: Record<string, string> = { hq_lead: "hq", shopkeeper: "shop", cafe_owner: "cafe", museum_curator: "museum", wharf_keeper: "wharf", oracle_keeper: "oracle", workshop_crafter: "hq" };

/**
 * Resolve a resident's schedule into stops on this map. `slot` spreads residents round shared anchors; `res` is what
 * the residents planned before them hold (planResidents), so no two share a seat in a phase or stand in one spot.
 */
export function planResident(r: ResidentSource, slot: number, v: Village, island: VillageIsland, res: Reservations = newReservations()): ResidentPlan {
  const nav = navGrid(island, v), seed = hashStr(r.slug);
  const homeId = (typeof r.schedule?.home === "string" && (HOME_LANDMARKS as readonly string[]).includes(r.schedule.home) ? r.schedule.home : POST_HOME[r.post ?? "villager"] ?? "hq") as LandmarkId;
  const home = homeStop(homeId, v, r.slug, nav) ?? homeStop("hq", v, r.slug, nav);
  const work = r.post ? POST_ANCHOR[r.post] : undefined;
  const phases = {} as Record<IslandPhase, Stop[]>;
  for (const phase of ISLAND_PHASES) {
    const night = phase === "night" || phase === "evening";
    let last: readonly [number, number] = home?.door ?? villageSpawnPoint(v);
    // One seat a phase: a routine that comes back to the bench sits in the same one.
    let seat: Stop | null | undefined;
    const stops: Stop[] = [];
    for (const key of routineKeys(r.schedule, phase)) {
      if (key === "bench" && seat === undefined) {
        seat = benchStop(v, nav, last, night, phase === "night", res.seats[phase]);
        if (seat) res.spots.push({ x: seat.at[0], z: seat.at[1], slug: r.slug });
      }
      const s = key === "home" ? home : key === "bench" ? seat ?? null : anchorStop(key, v, nav, slot, key === work, phase === "night", r.slug, res);
      if (!s) continue;
      stops.push(s);
      last = s.door ?? s.at;
    }
    if (!stops.length && home) stops.push(home);
    // One place for the phase: mill about it (unless it's home or a seat).
    if (stops.length === 1 && stops[0].kind === "stand") stops.push(...wanderStops(stops[0], nav, seed + ISLAND_PHASES.indexOf(phase), r.slug, res));
    phases[phase] = stops;
  }
  return { slug: r.slug, seed, home, phases };
}

/** Every resident's plan, in the order given (sort them the same way on every client: by slug), round each other. */
export function planResidents(rs: readonly ResidentSource[], v: Village, island: VillageIsland): ResidentPlan[] {
  const res = newReservations();
  return rs.map((r, i) => planResident(r, i, v, island, res));
}

// ── The day as legs ─────────────────────────────────────────────────────
export interface Walk { pts: Float32Array; cum: Float32Array; len: number }
export interface Leg {
  /** Epoch seconds. */
  t0: number; t1: number;
  /** A walk toward `stop` (null: staying at it). */
  walk: Walk | null;
  /** Where a walk sets out from (null for a stay). */
  from: Stop | null;
  stop: Stop;
  /** Which visit this is (seeds the idles). */
  visit: number;
}

/** Where a phase starts and ends on a Toronto day (03:00 to 03:00), from that day's sun times. */
export interface DaySpan { key: string; t0: number; t1: number; phases: { phase: IslandPhase; t0: number; t1: number }[] }
/** The day (03:00 Toronto to 03:00 the next day) holding `epochMs`. */
export function daySpan(epochMs: number, days?: readonly SunDay[] | null): DaySpan {
  let key = torontoDate(new Date(epochMs - 3 * 3_600_000)).key;
  if (torontoInstant(key, 3).getTime() > epochMs) key = torontoDate(new Date(torontoInstant(key, 12).getTime() - 86_400_000)).key;
  const noon = torontoInstant(key, 12);
  const { sunrise, sunset } = sunFor(noon, days);
  const at = (h: number) => torontoInstant(key, h).getTime() / 1000;
  const t0 = at(3), t1 = torontoInstant(torontoDate(new Date(noon.getTime() + 86_400_000)).key, 3).getTime() / 1000;
  const marks: [IslandPhase, number][] = [["night", t0], ["dawn", at(sunrise - DAWN_HOURS)], ["day", at(sunrise)], ["evening", at(sunset - EVENING_HALF_HOURS)], ["night", at(sunset + EVENING_HALF_HOURS)]];
  return { key, t0, t1, phases: marks.map(([phase, s], i) => ({ phase, t0: s, t1: i + 1 < marks.length ? marks[i + 1][1] : t1 })) };
}

/** A path as a polyline with cumulative lengths. */
function walkOf(points: readonly (readonly [number, number])[]): Walk {
  const pts = new Float32Array(points.length * 2), cum = new Float32Array(points.length);
  let len = 0;
  points.forEach(([x, z], i) => {
    pts[i * 2] = x; pts[i * 2 + 1] = z;
    if (i) len += Math.hypot(x - points[i - 1][0], z - points[i - 1][1]);
    cum[i] = len;
  });
  return { pts, cum, len };
}
/** Seconds a walk of `len` takes: cruise plus the ramps' lost time. */
export const walkSeconds = (len: number) => len / RESIDENT_WALK + RAMP;

/**
 * The walk between two stops: out through a door or up from a seat, round the solids, in through the next door or
 * onto the next seat. Cached per pair on the plan's map (paths are pure functions of the map).
 */
const walkCache = new WeakMap<NavGrid, Map<string, Walk | null>>();
export function walkBetween(nav: NavGrid, a: Stop, b: Stop): Walk | null {
  let cache = walkCache.get(nav);
  if (!cache) walkCache.set(nav, cache = new Map());
  const key = `${a.at}|${a.door ?? ""}>${b.at}|${b.door ?? ""}`;
  if (cache.has(key)) return cache.get(key)!;
  const from = a.door ?? a.at, to = b.door ?? b.at;
  const mid = nav.path(from[0], from[1], to[0], to[1]);
  const walk = mid && mid.length > 1 ? walkOf([...(a.door ? [a.at] : []), ...mid, ...(b.door ? [b.at] : [])].filter((p, i, all) => !i || Math.hypot(p[0] - all[i - 1][0], p[1] - all[i - 1][1]) > 1e-4)) : null;
  const ok = walk && walk.len > 1e-3 ? walk : null;
  cache.set(key, ok);
  return ok;
}

/** The shortest stop: they always come to a halt at a stop before setting off again. */
export const MIN_STAY = 2.5;

/** The day's legs for a plan: from 03:00 at night's last stop, through each phase's stops in turn. */
export function buildDay(plan: ResidentPlan, span: DaySpan, nav: NavGrid): Leg[] {
  const legs: Leg[] = [];
  const nightStops = plan.phases.night;
  const terminal = (stops: Stop[]) => stops.length > 0 && stops[stops.length - 1].kind === "home";
  // 03:00: at night's last stop if night ends at home, else at its first. A map with no
  // homes (a terrain-only painter draft) starts at any phase's first stop; with no
  // stops anywhere the day has no legs and poseAt keeps them hidden.
  const start = terminal(nightStops) ? nightStops[nightStops.length - 1]
    : nightStops[0] ?? plan.home ?? ISLAND_PHASES.map(ph => plan.phases[ph][0]).find(Boolean) ?? null;
  if (!start) return legs;
  let at: Stop = start;
  let t = span.t0, visit = 0;
  const stay = (until: number) => { legs[legs.length - 1].t1 = Math.max(legs[legs.length - 1].t1, until); t = Math.max(t, until); };
  legs.push({ t0: t, t1: t, walk: null, from: null, stop: at, visit: visit++ });
  span.phases.forEach(({ phase, t1: end }, p) => {
    const stops = plan.phases[phase];
    if (!stops.length) return;
    const ends = terminal(stops);
    for (let k = 0, guard = 0; t < end; k++) {
      // Already home at the end of a routine that ends there, or nowhere else to go: stay till the phase ends.
      if ((ends && at === stops[stops.length - 1]) || (stops.length === 1 && at === stops[0]) || guard++ > 4 * stops.length + 8) { stay(end); break; }
      const i = ends ? Math.min(k, stops.length - 1) : k % stops.length, next = stops[i];
      // The new phase's routine starts where they already stand: carry on there for the new stop's stay.
      if (next !== at && next.at[0] === at.at[0] && next.at[1] === at.at[1]) {
        at = next;
        if (next.kind !== "home" || !ends) stay(Math.min(t + next.dwell[0] + (next.dwell[1] - next.dwell[0]) * hash01(plan.seed + p * 131, visit * 7 + 5), end));
        continue;
      }
      // Skip a stop now and then (not home, not with two or fewer), so loops don't run like clockwork.
      if (next === at || (stops.length > 2 && next.kind !== "home" && hash01(plan.seed + p * 977, k * 31 + visit) < 0.18)) continue;
      const walk = walkBetween(nav, at, next);
      if (!walk) continue;
      guard = 0;
      const dur = walkSeconds(walk.len);
      legs.push({ t0: t, t1: t + dur, walk, from: at, stop: next, visit });
      t += dur;
      const dwell = next.dwell[0] + (next.dwell[1] - next.dwell[0]) * hash01(plan.seed + p * 131, visit * 7 + 3);
      const leave = Math.max(t + MIN_STAY, next.kind === "home" && ends ? end : Math.min(t + dwell, end));
      legs.push({ t0: t, t1: leave, walk: null, from: null, stop: next, visit: visit++ });
      t = leave;
      at = next;
    }
  });
  // The last stay holds to the day's end.
  const last = legs[legs.length - 1];
  if (last.t1 < span.t1) last.t1 = span.t1;
  return legs;
}

// ── Reading the day ─────────────────────────────────────────────────────
export interface ResidentPose {
  x: number; z: number; yaw: number;
  /** Ground speed (world units/s) along the walk; 0 staying. */
  speed: number;
  moving: boolean;
  /** Indoors (hidden). */
  inside: boolean;
  /** Sitting: the seat top above the ground. */
  seat: number;
  stop: Stop | null;
  /** Seconds into the current stay (0 walking). */
  stayed: number;
  /** Seconds left of the current stay. */
  left: number;
  visit: number;
}
export const newPose = (): ResidentPose => ({ x: 0, z: 0, yaw: 0, speed: 0, moving: false, inside: false, seat: 0, stop: null, stayed: 0, left: 0, visit: 0 });

/** Distance along a walk after `u` seconds of a `dur`-second walk: ramps up, cruises, ramps down (trapezoid). */
export function walkDistance(len: number, dur: number, u: number): { s: number; v: number } {
  if (len <= 0 || dur <= 0) return { s: Math.max(0, len), v: 0 };
  const r = Math.min(RAMP, dur / 2), v = len / (dur - r);
  if (u <= 0) return { s: 0, v: 0 };
  if (u >= dur) return { s: len, v: 0 };
  if (u < r) return { s: v * u * u / (2 * r), v: v * u / r };
  if (u > dur - r) { const w = dur - u; return { s: len - v * w * w / (2 * r), v: v * w / r }; }
  return { s: v * r / 2 + v * (u - r), v };
}

function legAt(legs: readonly Leg[], t: number): number {
  let lo = 0, hi = legs.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (legs[mid].t0 <= t) lo = mid; else hi = mid - 1;
  }
  return lo;
}

/** Where the resident is at epoch second `t` (within the day's legs), written into `out`. */
export function poseAt(legs: readonly Leg[], t: number, out: ResidentPose): ResidentPose {
  if (!legs.length) {
    // A day with no legs (a map giving this resident nowhere to stand): hidden.
    out.stop = null; out.moving = false; out.inside = true;
    out.speed = 0; out.seat = 0; out.stayed = 0; out.left = 0; out.visit = 0;
    return out;
  }
  const leg = legs[legAt(legs, t)], stop = leg.stop;
  out.stop = stop; out.visit = leg.visit; out.seat = 0;
  if (leg.walk && t < leg.t1) {
    const w = leg.walk, { s, v } = walkDistance(w.len, leg.t1 - leg.t0, t - leg.t0);
    // The segment holding distance s.
    let i = 1;
    while (i < w.cum.length - 1 && w.cum[i] < s) i++;
    const a = w.cum[i - 1], b = w.cum[i], k = b > a ? Math.min(1, (s - a) / (b - a)) : 1;
    const x0 = w.pts[(i - 1) * 2], z0 = w.pts[(i - 1) * 2 + 1], x1 = w.pts[i * 2], z1 = w.pts[i * 2 + 1];
    out.x = x0 + (x1 - x0) * k; out.z = z0 + (z1 - z0) * k;
    out.yaw = Math.atan2(x1 - x0, z1 - z0);
    out.speed = v; out.moving = true; out.stayed = 0; out.left = 0;
    // Through a door: hidden from where the body meets the front wall, out of sight until it clears it coming out.
    out.inside = (stop.kind === "home" && w.len - s < INSIDE_DEPTH + 0.15) || (leg.from?.kind === "home" && s < INSIDE_DEPTH + 0.15);
    return out;
  }
  out.x = stop.at[0]; out.z = stop.at[1]; out.yaw = stop.yaw;
  out.speed = 0; out.moving = false;
  out.inside = stop.kind === "home";
  out.seat = stop.kind === "sit" ? stop.seat ?? 0 : 0;
  out.stayed = t - (leg.walk ? leg.t1 : leg.t0);
  out.left = leg.walk ? 0 : Math.max(0, leg.t1 - t);
  return out;
}

/**
 * The idle one-shot a stay asks for at `stayed` seconds (null: just breathe): a look round soon after arriving, a
 * stretch now and then on a long stay, gazing at the water at the pond, the beach and the wharf. Deterministic per
 * visit, so every client sees the same gesture.
 */
export type IdleClip = "LookAround" | "StretchUp" | null;
export function idleAt(stop: Stop, visit: number, seed: number, stayed: number, out: { clip: IdleClip; key: number } = { clip: null, key: -1 }): { clip: IdleClip; key: number } {
  out.clip = null; out.key = -1;
  if (stop.kind !== "stand") return out;
  // A gesture every 14-26 s, the first 2-5 s after arriving.
  const first = 2 + hash01(seed, visit * 5 + 1) * 3;
  if (stayed < first) return out;
  const n = Math.floor((stayed - first) / (14 + hash01(seed, visit) * 12));
  const pick = hash01(seed + n * 7919, visit * 11 + 2);
  const kinds = stop.idles;
  const kind = kinds[Math.floor(pick * kinds.length) % kinds.length];
  out.clip = kind === "look" || kind === "gaze" ? (pick < 0.75 ? "LookAround" : null) : kind === "stretch" ? "StretchUp" : null;
  out.key = n;
  return out;
}

/**
 * A resident's clock: the plan and the current day's legs, rebuilt when the day or the sun times change. `at`
 * reads the pose for an epoch second.
 */
export class ResidentDay {
  private legs: Leg[] = [];
  private span: DaySpan | null = null;
  private sunKey = "";
  constructor(readonly plan: ResidentPlan, private readonly nav: NavGrid) {}
  at(t: number, days: readonly SunDay[] | null, out: ResidentPose): ResidentPose {
    const sunKey = days ? days.map(d => `${d.date}${d.sunrise}${d.sunset}`).join() : "";
    if (!this.span || t < this.span.t0 || t >= this.span.t1 || sunKey !== this.sunKey) {
      // Legs before span and key: a throw mid-build must not leave the stale
      // markers set, or every later frame reads a day that was never built.
      const span = daySpan(t * 1000, days);
      this.legs = buildDay(this.plan, span, this.nav);
      this.span = span;
      this.sunKey = sunKey;
    }
    return poseAt(this.legs, t, out);
  }
  /** The day's legs (tests and the routine trace). */
  dayLegs(t: number, days: readonly SunDay[] | null = null): readonly Leg[] {
    this.at(t, days, newPose());
    return this.legs;
  }
}

/** The phase at an epoch second on a span (the routine's own phase, for a forced preview). */
export function phaseOn(span: DaySpan, t: number): IslandPhase {
  for (const p of span.phases) if (t >= p.t0 && t < p.t1) return p.phase;
  return "night";
}
