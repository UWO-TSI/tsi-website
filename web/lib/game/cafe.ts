/**
 * Café interior layout (specs/cafe-polish.md), shared by the room, its
 * prompts and the tests. Room space: walls at x ±halfW and z ±halfD, the door
 * in the near (−z) wall, +x on screen left. Seats live in lib/study/seats.ts.
 */
export const CAFE_ROOM = { halfW: 9, halfD: 6 };
export const CAFE_DOOR: [number, number] = [0, -5.4];
/** "Return to the island" shows inside this distance of the door. */
export const CAFE_EXIT_RANGE = 1.4;
/** Where you arrive: a step in from the door, outside its prompt. */
export const CAFE_SPAWN: [number, number] = [0, -3.7];

/**
 * The café owner (cafe-polish §6; row 122's `cafe_owner` post). Proposed for
 * David's OK in specs/cafe-polish-questions.md: the name and lines are the
 * defaults until a Residents-editor persona with the `cafe_owner` post exists
 * (its name and canned lines then win). The look is fixed: a cream collared
 * shirt under dark-wood bib overalls that read as a barista's apron, a top
 * bun, round glasses and loafers.
 */
export const CAFE_OWNER = {
  slug: "cafe-owner",
  name: "Rosa",
  look: {
    skin: 6, hair: 1, eyes: "F1.1", mouth: "M1.1", brows: "brow_soft", extras: [],
    bangs: "bangs_curtain", back: "back_bun", top: "top_collar_shirt", bottom: "bottom_overall_shorts", onepiece: null, shoes: "shoes_loafers",
    acc: { face: "acc_glasses_round" }, colors: { top_collar_shirt: 0, bottom_overall_shorts: 5, shoes_loafers: 14, acc_glasses_round: 5 },
  },
  lines: [
    "Welcome in! Take any seat. The window stools get the best light.",
    "Croissants just came out of the oven. Study hard, I'll keep the coffee coming.",
    "It took the whole club to get those boards off. I'm so glad you're here.",
  ],
};

export type OwnerClip = "Idle" | "Walk" | "Forage" | "Trace";
/** Where the owner works behind the bar, in walking order: x, z, the way she faces while there, how long she stays, and what she does. */
export interface OwnerStation { at: [number, number]; yaw: number; stay: number; clip: OwnerClip }
export const OWNER_STATIONS: OwnerStation[] = [
  { at: [8.45, -0.95], yaw: -Math.PI / 2, stay: 7, clip: "Idle" },   // the register
  { at: [8.45, 0.4], yaw: Math.PI / 2, stay: 5, clip: "Trace" },     // the espresso machine on the back counter
  { at: [8.45, -1.9], yaw: -Math.PI / 2, stay: 1.3, clip: "Forage" }, // a cup from under the counter
];
export const OWNER_WALK = 1.15;
/** Where the player stands to talk to her across the counter, and how close. */
export const OWNER_TALK: { at: [number, number]; range: number } = { at: [7, -0.95], range: 1.7 };

/** The owner's routine at `t` seconds of the shared world clock: a loop of stations joined by walks. */
export function ownerAt(t: number, stations: OwnerStation[] = OWNER_STATIONS) {
  const legs = stations.map((s, i) => {
    const next = stations[(i + 1) % stations.length];
    return { s, next, walk: Math.hypot(next.at[0] - s.at[0], next.at[1] - s.at[1]) / OWNER_WALK };
  });
  const loop = legs.reduce((n, l) => n + l.s.stay + l.walk, 0);
  let u = ((t % loop) + loop) % loop;
  for (const { s, next, walk } of legs) {
    if (u < s.stay) return { x: s.at[0], z: s.at[1], yaw: s.yaw, clip: s.clip, moving: false };
    u -= s.stay;
    if (u < walk) {
      const k = u / walk, dx = next.at[0] - s.at[0], dz = next.at[1] - s.at[1];
      return { x: s.at[0] + dx * k, z: s.at[1] + dz * k, yaw: Math.atan2(dx, dz), clip: "Walk" as OwnerClip, moving: true };
    }
    u -= walk;
  }
  const s = stations[0];
  return { x: s.at[0], z: s.at[1], yaw: s.yaw, clip: s.clip, moving: false };
}
