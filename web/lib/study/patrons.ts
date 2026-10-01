/**
 * Ambient café patrons (row 271, cafe-polish §7; design principle 2: the world
 * never feels empty). Background characters who walk in from the door, sit at
 * a free café seat with a laptop, a book or a cup, and leave again.
 *
 * - Deterministic from the shared world clock: every seat has its own schedule
 *   of visits (who, when they arrive and leave), so everyone sees the same café.
 * - First come, first served: at most `target` patrons at once, the earliest
 *   arrivals kept. `target` falls as real members fill the café.
 * - They always yield: a seat a member sits in (here or on another device), or
 *   walks up to, sends its patron back out the door. So does thinning.
 * - Client-side only: never members, never on a board, never in a table count.
 *
 * Pure: the scene keeps the yields (`yielded`, visit id → when) and which
 * visits it has shown, and calls `cafePatrons` each frame.
 */
import { CAFE_ROOM, cafeWalkable } from "@/lib/game/cafe";
import { hashSeed } from "@/lib/game/character/look";
import { seatsOf, studyLayout, tableLayout, FURNITURE, type WorldSeat } from "./seats";

/** Walking pace (world units/s), the time to sit down or stand up, and how many patrons an empty café holds. */
export const PATRON_SPEED = 1.25, PATRON_SIT_S = 0.6, PATRON_MAX = 7;
/** A member this close to a patron's seat gets it: the patron stands and leaves. */
export const PATRON_YIELD_RANGE = 1.5;
/** Patrons come in from just outside the doorway. */
const OUTSIDE: [number, number] = [0, -6.7];
const INSIDE: [number, number] = [0, -5.4];

export type PatronActivity = "laptop" | "book" | "cup";
export interface PatronVisit {
  id: string; key: string; seat: WorldSeat;
  /** Starts walking in, sits, gets up, is out of the door. */
  enter: number; arrive: number; leave: number; exit: number;
  seed: number; activity: PatronActivity;
}
export interface PatronView {
  visit: PatronVisit; x: number; z: number; yaw: number;
  /** Seated: 0 standing … 1 fully down (sitting down and getting up ease it). */
  sit: number; walking: boolean;
}

export const seatKey = (s: Pick<WorldSeat, "anchor" | "seat">) => `${s.anchor}#${s.seat}`;
const rand = (n: number) => { let a = n >>> 0; a = (a + 0x6d2b79f5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

// ── Paths: A* on a 0.25 grid from the doorway to each seat, then pulled straight where the way is clear ──────────
const CELL = 0.25;
interface Path { pts: [number, number][]; cum: number[]; length: number }
const paths = new Map<string, Path>();

function walkTo(seat: WorldSeat): [number, number][] {
  const { halfW, halfD } = CAFE_ROOM;
  const nx = Math.round((2 * halfW) / CELL), nz = Math.round((2 * halfD) / CELL);
  const cx = (x: number) => Math.round((x + halfW) / CELL), cz = (z: number) => Math.round((z + halfD) / CELL);
  const wx = (i: number) => i * CELL - halfW, wz = (j: number) => j * CELL - halfD;
  // Clear of furniture by a body's width, except right at the seat (between a bench back and its table).
  const ok = (x: number, z: number) => cafeWalkable(x, z, Math.hypot(x - seat.x, z - seat.z) < 1.25 ? 0.02 : 0.2);
  const start = [cx(INSIDE[0]), cz(INSIDE[1])], goal = [cx(seat.x), cz(seat.z)];
  const id = (i: number, j: number) => j * (nx + 1) + i;
  const g = new Map<number, number>([[id(start[0], start[1]), 0]]), from = new Map<number, number>();
  const open: [number, number, number][] = [[Math.hypot(goal[0] - start[0], goal[1] - start[1]), start[0], start[1]]];
  const done = new Set<number>();
  while (open.length) {
    let bi = 0;
    for (let k = 1; k < open.length; k++) if (open[k][0] < open[bi][0]) bi = k;
    const [, i, j] = open.splice(bi, 1)[0];
    const here = id(i, j);
    if (done.has(here)) continue;
    done.add(here);
    if (i === goal[0] && j === goal[1]) break;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const a = i + di, b = j + dj;
      if (a < 0 || b < 0 || a > nx || b > nz || done.has(id(a, b))) continue;
      if (!(a === goal[0] && b === goal[1]) && !ok(wx(a), wz(b))) continue;
      // No cutting a table's corner on a diagonal.
      if (di && dj && (!ok(wx(i + di), wz(j)) || !ok(wx(i), wz(j + dj)))) continue;
      const cost = g.get(here)! + Math.hypot(di, dj);
      if (cost < (g.get(id(a, b)) ?? Infinity)) {
        g.set(id(a, b), cost);
        from.set(id(a, b), here);
        open.push([cost + Math.hypot(goal[0] - a, goal[1] - b), a, b]);
      }
    }
  }
  const cells: [number, number][] = [];
  for (let k: number | undefined = id(goal[0], goal[1]); k !== undefined; k = from.get(k)) cells.unshift([wx(k % (nx + 1)), wz(Math.floor(k / (nx + 1)))]);
  if (cells.length < 2 && Math.hypot(cells[0]?.[0] - INSIDE[0], cells[0]?.[1] - INSIDE[1]) > CELL) throw new Error(`no path to ${seatKey(seat)}`);
  const raw: [number, number][] = [OUTSIDE, INSIDE, ...cells.slice(1, -1), [seat.x, seat.z]];
  // Pull the string: skip every corner a straight walk clears.
  const clear = (a: [number, number], b: [number, number]) => {
    const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.08);
    for (let k = 1; k < n; k++) { const t = k / n; if (!ok(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)) return false; }
    return true;
  };
  const out: [number, number][] = [raw[0], raw[1]];
  let k = 1;
  while (k < raw.length - 1) {
    let far = k + 1;
    for (let m = raw.length - 1; m > k + 1; m--) if (clear(raw[k], raw[m])) { far = m; break; }
    out.push(raw[far]);
    k = far;
  }
  return out;
}

export function patronPath(seat: WorldSeat): Path {
  const key = seatKey(seat);
  let p = paths.get(key);
  if (!p) {
    const pts = walkTo(seat), cum = [0];
    for (let k = 1; k < pts.length; k++) cum.push(cum[k - 1] + Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]));
    paths.set(key, p = { pts, cum, length: cum[cum.length - 1] });
  }
  return p;
}

function along(p: Path, s: number): { x: number; z: number; yaw: number } {
  const d = Math.max(0, Math.min(p.length, s));
  let k = 1;
  while (k < p.pts.length - 1 && p.cum[k] < d) k++;
  const [a, b] = [p.pts[k - 1], p.pts[k]], seg = p.cum[k] - p.cum[k - 1] || 1, t = (d - p.cum[k - 1]) / seg;
  return { x: a[0] + (b[0] - a[0]) * t, z: a[1] + (b[1] - a[1]) * t, yaw: Math.atan2(b[0] - a[0], b[1] - a[1]) };
}

// ── Schedules: each seat its own run of visits ───────────────────────────────────────────────────────────────────
let cafeSeats: WorldSeat[] | null = null;
export const patronSeats = () => (cafeSeats ??= studyLayout().filter(l => l.area === "cafe").flatMap(l => seatsOf(l.anchor)));

/** The visit at this seat around world time t (seconds), whether or not it is under way. */
function visitNear(seat: WorldSeat, t: number): PatronVisit[] {
  const key = seatKey(seat), h = hashSeed(key);
  const period = 1500 + (h % 1200), offset = (h >>> 3) % period;
  const walk = patronPath(seat).length / PATRON_SPEED;
  const k0 = Math.floor((t + offset) / period);
  const out: PatronVisit[] = [];
  for (const k of [k0 - 1, k0]) {
    const r = (n: number) => rand(h ^ Math.imul(k + 0x9e37, 2654435761) ^ n);
    if (r(1) > 0.55) continue;
    const start = k * period - offset;
    const arrive = start + period * (0.02 + 0.2 * r(2)), leave = start + period * (0.55 + 0.35 * r(3));
    const seed = (h ^ Math.imul(k, 40503)) >>> 0;
    out.push({ id: `${key}@${k}`, key, seat, enter: arrive - walk, arrive, leave, exit: leave + PATRON_SIT_S + walk, seed,
      activity: (["laptop", "book", "cup", "laptop"] as const)[Math.floor(r(4) * 4)] });
  }
  return out;
}

/** Where a visit is at t: its distance along the door → seat path, sitting blend and heading. */
function viewOf(v: PatronVisit, t: number, yieldAt: number | undefined): PatronView | null {
  const p = patronPath(v.seat), L = p.length;
  const sched = (u: number) => (u < v.arrive ? (u - v.enter) * PATRON_SPEED : u < v.leave + PATRON_SIT_S ? L : L - (u - v.leave - PATRON_SIT_S) * PATRON_SPEED);
  let s = sched(t), standAt = v.leave;
  if (yieldAt !== undefined && t >= yieldAt) {
    standAt = Math.min(standAt, yieldAt);
    const s0 = sched(yieldAt), seatedThen = s0 >= L - 1e-6;
    // Seated: stand up first, then walk out. Walking in: turn around.
    const back = seatedThen ? Math.max(0, t - yieldAt - PATRON_SIT_S) : t - yieldAt;
    s = Math.min(s, s0 - back * PATRON_SPEED);
  }
  if (s <= 0 && t > v.enter) return null;
  s = Math.max(0, Math.min(L, s));
  const atSeat = s >= L - 1e-6;
  const sitIn = Math.min(1, Math.max(0, (t - v.arrive) / PATRON_SIT_S));
  const sitOut = Math.min(1, Math.max(0, 1 - (t - standAt) / PATRON_SIT_S));
  const sit = atSeat ? Math.min(sitIn, t >= standAt ? sitOut : 1) : 0;
  const pos = along(p, s);
  const leaving = t >= standAt;
  return { visit: v, x: pos.x, z: pos.z, yaw: atSeat ? v.seat.facing : leaving ? pos.yaw + Math.PI : pos.yaw, sit, walking: !atSeat };
}

/**
 * The patrons in the café at world time t (seconds). `taken`: seat keys real members hold (server tables and your
 * own seat). `player`: where you stand (a patron's seat you walk up to is yours). `target`: how many may be in at
 * once. `shown`: visits the scene drew last frame, and `yielded`: visit id → when it was asked to leave; both are
 * updated here (the scene owns them, so a reload simply starts fresh). `since`: when the scene opened (patrons already
 * inside then are simply there; later ones are seen walking in or not at all).
 */
export function cafePatrons(t: number, o: { taken: ReadonlySet<string>; player?: [number, number] | null; target?: number; shown: Set<string>; yielded: Map<string, number>; since?: number }): PatronView[] {
  const target = o.target ?? PATRON_MAX;
  const live = patronSeats().flatMap(seat => visitNear(seat, t)).filter(v => v.enter <= t && t < v.exit + 30);
  // First come, first served.
  live.sort((a, b) => a.enter - b.enter || (a.id < b.id ? -1 : 1));
  let kept = 0;
  const out: PatronView[] = [];
  for (const v of live) {
    const wasShown = o.shown.has(v.id);
    const near = !!o.player && Math.hypot(o.player[0] - v.seat.x, o.player[1] - v.seat.z) < PATRON_YIELD_RANGE;
    const unwanted = o.taken.has(v.key) || near || kept >= target;
    // Someone who should have been seen walking in, but wasn't, never pops in halfway (`since`: when the scene opened).
    if (!wasShown && v.enter >= (o.since ?? Infinity) && t - v.enter > 1) continue;
    if (unwanted && !o.yielded.has(v.id)) {
      if (!wasShown) continue;      // never came in: a member already has the seat, or the café is full
      o.yielded.set(v.id, t);
    }
    if (!o.yielded.has(v.id)) kept++;
    const view = viewOf(v, t, o.yielded.get(v.id));
    if (view) out.push(view);
  }
  o.shown.clear();
  for (const view of out) o.shown.add(view.visit.id);
  return out;
}

/** How many patrons a café holds with this many members in it: fewer as members arrive, none once it is busy. */
export const patronTarget = (members: number) => Math.max(0, PATRON_MAX - members);

/** Where a patron's prop (laptop, book, cup) sits: on the table in front of them. */
export function propSpot(seat: WorldSeat): { x: number; y: number; z: number; yaw: number } {
  const layout = tableLayout(seat.anchor);
  const f = layout ? FURNITURE[layout.furniture] : null;
  const reach = f?.reach ?? 0.45;
  return { x: seat.x + Math.sin(seat.facing) * reach, y: f?.top ?? 0.74, z: seat.z + Math.cos(seat.facing) * reach, yaw: seat.facing };
}
