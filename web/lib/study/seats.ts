/**
 * Study seat layout (specs/study-world.md §1): where each backend table
 * (`study_tables.anchor`, see tables.ts) stands in the world, and its seats.
 *
 * This is the one file David's cafe interior design replaces: move a table's
 * `at`, turn it with `yaw`, or swap its `furniture`. Seat positions follow.
 * Cafe tables use cafe-room coordinates (walls x ±9, z ±6, door at z -6);
 * outdoor tables use village world coordinates. +x is screen left.
 *
 * `facing` is the direction a seated character looks: radians of atan2(dx, dz),
 * so 0 looks north (+z, away from the camera) and π looks at the camera.
 * `seatY` is the furniture's measured seat top above the floor (world units,
 * at the scale StudySeats places it); `tsi:sit` lifts the character onto it.
 */
export type SeatArea = "cafe" | "village";
export type Furniture = "window" | "two" | "four" | "couch" | "picnic" | "pier";
export interface TableLayout { anchor: string; area: SeatArea; at: [number, number]; yaw: number; furniture: Furniture }
/** `y` is the seat top in world y (floor height at the seat + the furniture's seatY). */
export interface WorldSeat { anchor: string; seat: number; x: number; z: number; facing: number; y: number }

const PI = Math.PI;
/** Seat tops measured from the GLBs: study-chair at 0.1, lounge-sofa cushions at 0.16, bench-wood slats at 1. */
const CHAIR = 0.52, SOFA = 0.78, BENCH = 0.5;
/** Seats, seat top and solid rects ([cx, cz, halfW, halfD]) relative to the table, before `yaw`. */
export const FURNITURE: Record<Furniture, { seats: [number, number, number][]; seatY: number; solid: [number, number, number, number][] }> = {
  window: { seats: [[0.45, -0.8, 0], [-0.45, -0.8, 0]], seatY: CHAIR, solid: [[0, 0, 0.5, 0.42]] },
  two: { seats: [[0.85, 0, -PI / 2], [-0.85, 0, PI / 2]], seatY: CHAIR, solid: [[0, 0, 0.5, 0.42]] },
  four: { seats: [[0.55, -0.9, 0], [-0.55, -0.9, 0], [0.55, 0.9, PI], [-0.55, 0.9, PI]], seatY: CHAIR, solid: [[0, 0, 1, 0.42]] },
  couch: { seats: [[0.9, -0.15, PI], [0, -0.15, PI], [-0.9, -0.15, PI]], seatY: SOFA, solid: [[0, 0.45, 1.45, 0.25], [0, -1.35, 0.9, 0.46]] },
  picnic: { seats: [[0.5, -0.8, 0], [-0.5, -0.8, 0], [0.5, 0.8, PI], [-0.5, 0.8, PI]], seatY: BENCH, solid: [[0, 0, 1, 0.42]] },
  pier: { seats: [[0.45, 0.8, PI], [-0.45, 0.8, PI]], seatY: BENCH, solid: [[0, 0, 0.5, 0.42]] },
};

export const STUDY_LAYOUT: TableLayout[] = [
  { anchor: "study:cafe-window-1", area: "cafe", at: [5.6, 5.1], yaw: 0, furniture: "window" },
  { anchor: "study:cafe-window-2", area: "cafe", at: [2.6, 5.1], yaw: 0, furniture: "window" },
  { anchor: "study:cafe-couch", area: "cafe", at: [-5, 5.1], yaw: 0, furniture: "couch" },
  { anchor: "study:cafe-four-1", area: "cafe", at: [3.8, 0.9], yaw: 0, furniture: "four" },
  { anchor: "study:cafe-four-2", area: "cafe", at: [-4.6, 0.9], yaw: 0, furniture: "four" },
  { anchor: "study:cafe-two-1", area: "cafe", at: [4.4, -3], yaw: 0, furniture: "two" },
  { anchor: "study:cafe-two-2", area: "cafe", at: [-6.2, -3.2], yaw: 0, furniture: "two" },
  { anchor: "study:plaza-picnic", area: "village", at: [2.4, 2.6], yaw: 0, furniture: "picnic" },
  { anchor: "study:pier-bench", area: "village", at: [4.6, -17.6], yaw: 0, furniture: "pier" },
];

/** Leaving your seat by more than this ends the session (row 80); inside it you can sit back down. */
export const WALK_AWAY_RADIUS = 1.6;
/** How close a free seat must be to offer "Sit". */
export const SIT_RANGE = 0.9;

const turn = (x: number, z: number, yaw: number): [number, number] => [x * Math.cos(yaw) + z * Math.sin(yaw), -x * Math.sin(yaw) + z * Math.cos(yaw)];

export const tableLayout = (anchor: string) => STUDY_LAYOUT.find(t => t.anchor === anchor) ?? null;

type Ground = (x: number, z: number) => number;
const flat: Ground = () => 0;

/** Seats of a table in world (or room) coordinates, numbered 1..n like the backend. */
export function seatsOf(anchor: string, ground: Ground = flat): WorldSeat[] {
  const t = tableLayout(anchor);
  if (!t) return [];
  const { seats, seatY } = FURNITURE[t.furniture];
  return seats.map(([x, z, facing], i) => {
    const [dx, dz] = turn(x, z, t.yaw);
    const wx = t.at[0] + dx, wz = t.at[1] + dz;
    return { anchor, seat: i + 1, x: wx, z: wz, facing: facing + t.yaw, y: ground(wx, wz) + seatY };
  });
}

export function seatAt(anchor: string, seat: number, ground: Ground = flat): WorldSeat | null {
  return seatsOf(anchor, ground)[seat - 1] ?? null;
}

/** Nearest seat in an area within SIT_RANGE; `skip(anchor, seat)` filters taken seats. */
export function nearestSeat(area: SeatArea, x: number, z: number, skip: (anchor: string, seat: number) => boolean = () => false, ground: Ground = flat): WorldSeat | null {
  let best: WorldSeat | null = null, d = SIT_RANGE;
  for (const t of STUDY_LAYOUT) {
    if (t.area !== area) continue;
    for (const s of seatsOf(t.anchor, ground)) {
      const ds = Math.hypot(s.x - x, s.z - z);
      if (ds < d && !skip(s.anchor, s.seat)) { best = s; d = ds; }
    }
  }
  return best;
}

export const walkedAway = (seat: Pick<WorldSeat, "x" | "z">, x: number, z: number) => Math.hypot(x - seat.x, z - seat.z) > WALK_AWAY_RADIUS;

/** True where study furniture blocks walking (tables, sofa backs), per area. */
export function studySolid(area: SeatArea, x: number, z: number, pad = 0): boolean {
  return STUDY_LAYOUT.some(t => t.area === area && FURNITURE[t.furniture].solid.some(([cx, cz, hw, hd]) => {
    const [lx, lz] = turn(x - t.at[0], z - t.at[1], -t.yaw);
    return Math.abs(lx - cx) < hw + pad && Math.abs(lz - cz) < hd + pad;
  }));
}
