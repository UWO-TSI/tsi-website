/**
 * Study seat layout (specs/study-world.md §1, specs/cafe-polish.md item 7):
 * where each backend table (`study_tables.anchor`, see tables.ts) stands in
 * the world, and its seats.
 *
 * Move a table's `at`, turn it with `yaw`, or swap its `furniture`: seat
 * positions follow. Café tables use café-room coordinates (lib/game/cafe.ts:
 * walls x ±8.5, z ±6, door at z −6). Outdoor tables are `study` objects in the
 * village map file (id = anchor, model = furniture), placed in `/lab/map`.
 * +x is screen left. The café furniture models (art/cafe/build_cafe.py, one
 * GLB per kind) put their seats exactly where FURNITURE says.
 *
 * `facing` is the direction a seated character looks: radians of atan2(dx, dz),
 * so 0 looks west (+z, away from the camera) and π looks at the camera.
 * `seatY` is the furniture's measured seat top above the floor (world units,
 * at the scale StudySeats places it); `tsi:sit` lifts the character onto it.
 */
import { objectsOf, village, type Village } from "@/lib/game/villageMap";

export type SeatArea = "cafe" | "village";
/** Café: window bar stools, tables for two and four, the booth, the communal table. Outdoors: picnic table, pier bench. */
export type Furniture = "bar" | "two" | "four" | "booth" | "communal" | "picnic" | "pier";
export interface TableLayout { anchor: string; area: SeatArea; at: [number, number]; yaw: number; furniture: Furniture }
/** `y` is the seat top in world y (floor height at the seat + the furniture's seatY). */
export interface WorldSeat { anchor: string; seat: number; x: number; z: number; facing: number; y: number }

const PI = Math.PI;
/** Seat tops: café chairs, booth and banquette cushions 0.4, window stools 0.6 (each a Study-clip desk, 0.2, under its table or counter), bench-wood slats 0.5. */
const CHAIR = 0.4, STOOL = 0.6, BENCH = 0.5;
/** Seats, seat top and solid rects ([cx, cz, halfW, halfD]) relative to the table, before `yaw`. Chairs and stools are not solid. */
/** `top`: the table top a sitter works at; `reach`: how far in front of the seat their cup or laptop goes on it (café patrons). */
export const FURNITURE: Record<Furniture, { seats: [number, number, number][]; seatY: number; solid: [number, number, number, number][]; top?: number; reach?: number }> = {
  bar: { seats: [[0.45, -0.55, 0], [-0.45, -0.55, 0]], seatY: STOOL, solid: [[0, 0, 0.5, 0.28]], top: 0.8, reach: 0.45 },
  two: { seats: [[0.66, 0, -PI / 2], [-0.66, 0, PI / 2]], seatY: CHAIR, solid: [[0, 0, 0.36, 0.36]], top: 0.6, reach: 0.42 },
  four: { seats: [[0.42, -0.7, 0], [-0.42, -0.7, 0], [0.42, 0.7, PI], [-0.42, 0.7, PI]], seatY: CHAIR, solid: [[0, 0, 0.52, 0.34]], top: 0.6, reach: 0.45 },
  booth: { seats: [[0.42, -0.72, 0], [-0.42, -0.72, 0], [0.42, 0.72, PI], [-0.42, 0.72, PI]], seatY: CHAIR, solid: [[0, 0, 0.55, 0.3], [0, -0.99, 0.68, 0.06], [0, 0.99, 0.68, 0.06]], top: 0.6, reach: 0.5 },
  communal: { seats: [[0.55, -0.68, 0], [-0.55, -0.68, 0], [0.55, 0.68, PI], [-0.55, 0.68, PI]], seatY: CHAIR, solid: [[0, 0, 1.1, 0.33], [0, 0.95, 1.15, 0.06]], top: 0.6, reach: 0.42 },
  picnic: { seats: [[0.5, -0.8, 0], [-0.5, -0.8, 0], [0.5, 0.8, PI], [-0.5, 0.8, PI]], seatY: BENCH, solid: [[0, 0, 1, 0.42]] },
  pier: { seats: [[0.45, 0.8, PI], [-0.45, 0.8, PI]], seatY: BENCH, solid: [[0, 0, 0.5, 0.42]] },
};

/** The café (row 270): 20 seats — four window stools, two tables for two, a four-top, a four-seat booth and a small communal table. */
const CAFE_LAYOUT: TableLayout[] = [
  { anchor: "study:cafe-window-1", area: "cafe", at: [-8.22, -2.9], yaw: -PI / 2, furniture: "bar" },
  { anchor: "study:cafe-window-2", area: "cafe", at: [-8.22, -0.5], yaw: -PI / 2, furniture: "bar" },
  { anchor: "study:cafe-couch", area: "cafe", at: [-7.2, 5.05], yaw: PI / 2, furniture: "booth" },
  { anchor: "study:cafe-four-1", area: "cafe", at: [-3.6, -1.9], yaw: 0, furniture: "four" },
  { anchor: "study:cafe-four-2", area: "cafe", at: [-3.3, 4.95], yaw: 0, furniture: "communal" },
  { anchor: "study:cafe-two-1", area: "cafe", at: [3.0, 0.5], yaw: 0, furniture: "two" },
  { anchor: "study:cafe-two-2", area: "cafe", at: [5.6, -4.0], yaw: 0, furniture: "two" },
];

const layouts = new WeakMap<Village, TableLayout[]>();
/** Every table: the cafe room's and the village map's, built once per loaded map. */
export function studyLayout(v: Village = village()): TableLayout[] {
  let out = layouts.get(v);
  if (!out) layouts.set(v, out = [...CAFE_LAYOUT, ...objectsOf("study", v).flatMap((o): TableLayout[] =>
    o.model && o.model in FURNITURE ? [{ anchor: o.id, area: "village", at: [o.x, o.z], yaw: o.yaw ?? 0, furniture: o.model as Furniture }] : [])]);
  return out;
}

/** Leaving your seat by more than this ends the session (row 80); inside it you can sit back down. */
export const WALK_AWAY_RADIUS = 1.6;
/** How close a free seat must be to offer "Sit". */
export const SIT_RANGE = 0.9;

const turn = (x: number, z: number, yaw: number): [number, number] => [x * Math.cos(yaw) + z * Math.sin(yaw), -x * Math.sin(yaw) + z * Math.cos(yaw)];

export const tableLayout = (anchor: string, v: Village = village()) => studyLayout(v).find(t => t.anchor === anchor) ?? null;

type Ground = (x: number, z: number) => number;
const flat: Ground = () => 0;

/** Seats of a table in world (or room) coordinates, numbered 1..n like the backend. */
export function seatsOf(anchor: string, ground: Ground = flat, v: Village = village()): WorldSeat[] {
  const t = tableLayout(anchor, v);
  if (!t) return [];
  const { seats, seatY } = FURNITURE[t.furniture];
  return seats.map(([x, z, facing], i) => {
    const [dx, dz] = turn(x, z, t.yaw);
    const wx = t.at[0] + dx, wz = t.at[1] + dz;
    return { anchor, seat: i + 1, x: wx, z: wz, facing: facing + t.yaw, y: ground(wx, wz) + seatY };
  });
}

/**
 * A table's seats recentred on the origin (the table itself at `[0,0]`):
 * for the phone companion's isolated table scene (specs/companion.md
 * deliverable 2), which places one table alone instead of in the cafe room.
 */
export function localSeats(anchor: string): WorldSeat[] {
  const t = tableLayout(anchor);
  if (!t) return [];
  return seatsOf(anchor).map((seat) => ({ ...seat, x: seat.x - t.at[0], z: seat.z - t.at[1] }));
}

export function seatAt(anchor: string, seat: number, ground: Ground = flat): WorldSeat | null {
  return seatsOf(anchor, ground)[seat - 1] ?? null;
}

/** Nearest seat in an area within SIT_RANGE; `skip(anchor, seat)` filters taken seats. */
export function nearestSeat(area: SeatArea, x: number, z: number, skip: (anchor: string, seat: number) => boolean = () => false, ground: Ground = flat): WorldSeat | null {
  let best: WorldSeat | null = null, d = SIT_RANGE;
  for (const t of studyLayout()) {
    // Seats sit within ~1.1 of their table: skip tables out of reach before building their seats.
    if (t.area !== area || Math.hypot(t.at[0] - x, t.at[1] - z) > SIT_RANGE + 3) continue;
    for (const s of seatsOf(t.anchor, ground)) {
      const ds = Math.hypot(s.x - x, s.z - z);
      if (ds < d && !skip(s.anchor, s.seat)) { best = s; d = ds; }
    }
  }
  return best;
}

export const walkedAway = (seat: Pick<WorldSeat, "x" | "z">, x: number, z: number) => Math.hypot(x - seat.x, z - seat.z) > WALK_AWAY_RADIUS;

/** True where study furniture blocks walking (tables, sofa backs), per area. */
export function studySolid(area: SeatArea, x: number, z: number, pad = 0, v: Village = village()): boolean {
  return studyLayout(v).some(t => t.area === area && FURNITURE[t.furniture].solid.some(([cx, cz, hw, hd]) => {
    const [lx, lz] = turn(x - t.at[0], z - t.at[1], -t.yaw);
    return Math.abs(lx - cx) < hw + pad && Math.abs(lz - cz) < hd + pad;
  }));
}
