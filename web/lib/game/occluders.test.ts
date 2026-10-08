import { describe, expect, it } from "vitest";
import { boxOccluder, canopyAround, groundBlocks, lineBlocked, segmentHitsBox, treeOccluder } from "./occluders";
import { DEFAULT_PITCH, ORBIT_DISTANCE, PITCH_MIN, orbitOffset } from "./orbitCamera";

const v = (x: number, y: number, z: number) => ({ x, y, z });
/** The rig's eye for a player at (x, z) on flat ground, and their chest (the line of sight the cut follows). */
const sight = (x: number, z: number, yaw: number, pitch = DEFAULT_PITCH) => {
  const [ox, oy, oz] = orbitOffset(yaw, pitch, ORBIT_DISTANCE);
  return { eye: v(x + Math.sin(yaw) * 1.5 + ox, 0.7 + oy, z + Math.cos(yaw) * 1.5 + oz), chest: v(x, 1, z) };
};

describe("occluder selection", () => {
  const hq = boxOccluder(0, 9.35, 3.5, 2.65, 0, 5);
  it("a building between the camera and the player is in the way; beside or behind them it is not", () => {
    // Behind the clubhouse with the camera south of it (yaw 0 looks +z): in the way.
    let s = sight(0, 13.6, 0);
    expect(lineBlocked(s.eye, s.chest, [hq])).toBe(true);
    // In front of its door, the camera turned round to look back at it (yaw π): in the way.
    s = sight(0, 5.2, Math.PI);
    expect(lineBlocked(s.eye, s.chest, [hq])).toBe(true);
    // In front of its door with today's view: the clubhouse is behind them.
    s = sight(0, 5.2, 0);
    expect(lineBlocked(s.eye, s.chest, [hq])).toBe(false);
    // Off to the side.
    s = sight(8, 13.6, 0);
    expect(lineBlocked(s.eye, s.chest, [hq])).toBe(false);
  });
  it("a low line of sight passes under a canopy's crown only when the tree is not in front", () => {
    const tree = treeOccluder(0, 3, 0);
    let s = sight(0, 0, Math.PI, PITCH_MIN); // the tree between them and a camera to the north
    expect(lineBlocked(s.eye, s.chest, [tree])).toBe(true);
    s = sight(0, 0, 0, PITCH_MIN); // the tree ahead of them, the camera behind
    expect(lineBlocked(s.eye, s.chest, [tree])).toBe(false);
  });
  it("the slab test: through, short of, over, touching, and along an axis", () => {
    const box = { x: 0, z: 0, hx: 1, hz: 1, y0: 0, y1: 2 };
    expect(segmentHitsBox(v(-5, 1, 0), v(5, 1, 0), box)).toBe(true);
    expect(segmentHitsBox(v(-5, 1, 0), v(-2, 1, 0), box)).toBe(false);
    expect(segmentHitsBox(v(-5, 3, 0), v(5, 3, 0), box)).toBe(false);
    expect(segmentHitsBox(v(-5, 2, 0), v(5, 2, 0), box)).toBe(true);
    expect(segmentHitsBox(v(0, 5, 0), v(0, 1, 0), box)).toBe(true); // straight down into it
    expect(segmentHitsBox(v(3, 5, 0), v(3, 1, 0), box)).toBe(false);
    expect(segmentHitsBox(v(0, 1, 0), v(0, 1, 0), box)).toBe(true); // a point inside
  });
  it("picks the occluders on the line and only those", () => {
    const list = [hq, boxOccluder(10, -6, 3.25, 1.8, 0, 5), treeOccluder(0, 11.5, 0), treeOccluder(-12, 0, 0)];
    const s = sight(0, 14.5, 0);
    expect(list.flatMap((o, i) => (segmentHitsBox(s.eye, s.chest, o) ? [i] : []))).toEqual([0, 2]);
  });
});

describe("standing in a canopy (world audit item 9)", () => {
  const oak = treeOccluder(14, -12, 0), hq = boxOccluder(0, 9.35, 3.5, 2.65, 0, 5);
  it("a head inside a tree's crown is in it, on the camera's side of the trunk or not; a building never is", () => {
    // The audit's spot: a step west of the oak, the camera looking past them at it.
    expect(canopyAround(v(13.1, 1.3, -12), [hq, oak])).toBe(true);
    expect(canopyAround(v(14.9, 1.3, -12), [hq, oak])).toBe(true);
    expect(canopyAround(v(12.2, 1.3, -12), [hq, oak])).toBe(false); // clear of the crown
    expect(canopyAround(v(0, 1.3, 9.35), [hq])).toBe(false);
  });
  it("the line of sight to them counts as blocked from any side", () => {
    for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
      const s = sight(13.1, -12, yaw);
      expect(lineBlocked(s.eye, s.chest, [oak]), `yaw ${yaw}`).toBe(true);
    }
  });
});

describe("the ground in the way", () => {
  /** A canyon floor at 0 with walls 3 high beyond |x| > 6. */
  const canyon = (x: number) => (Math.abs(x) > 6 ? 3 : 0);
  it("a canyon wall between a low camera and the player blocks; looking along the canyon does not", () => {
    let s = sight(5, 0, -Math.PI / 2, PITCH_MIN); // the camera out over the east wall (+x), looking west at them
    expect(s.eye.x).toBeGreaterThan(6);
    expect(groundBlocks(s.eye, s.chest, canyon)).toBe(true);
    s = sight(5, 0, 0, PITCH_MIN); // along the canyon
    expect(groundBlocks(s.eye, s.chest, canyon)).toBe(false);
  });
  it("flat ground and the slope they stand on never block", () => {
    const s = sight(0, 0, 1.2, PITCH_MIN);
    expect(groundBlocks(s.eye, s.chest, () => 0)).toBe(false);
    expect(groundBlocks(s.eye, s.chest, (x, z) => (Math.hypot(x, z) < 0.9 ? 0.9 : 0))).toBe(false);
  });
});
