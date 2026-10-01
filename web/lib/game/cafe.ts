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
