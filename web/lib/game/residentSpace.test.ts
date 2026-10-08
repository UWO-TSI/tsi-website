import { describe, expect, it } from "vitest";
import { KEEP, inCorridor, roomFor } from "./residentSpace";

describe("residents keep their distance (item 14 of the world audit)", () => {
  const cam = { x: 0, z: -10 }, me = { x: 0, z: 0 };
  it("knows the corridor between the camera and you: in front of you toward the camera, not beside or behind", () => {
    expect(inCorridor(0, -1, cam.x, cam.z, me.x, me.z)).toBe(true);
    expect(inCorridor(0.4, -2.5, cam.x, cam.z, me.x, me.z)).toBe(true);
    expect(inCorridor(1.5, -1, cam.x, cam.z, me.x, me.z)).toBe(false);
    expect(inCorridor(0, 1, cam.x, cam.z, me.x, me.z)).toBe(false);
    expect(inCorridor(0, -8, cam.x, cam.z, me.x, me.z)).toBe(false);
  });
  it("finds the nearest free spot that keeps away from players and off the camera line", () => {
    const players = [me, { x: 3, z: 0 }];
    const crowded = (x: number, z: number) => players.some(p => Math.hypot(p.x - x, p.z - z) < KEEP) || inCorridor(x, z, cam.x, cam.z, me.x, me.z);
    const out: [number, number] = [0, 0];
    // Stopping half a step from you, in front of the camera: they take a spot a comfortable distance away, nearby.
    expect(roomFor(0, -0.5, () => true, crowded, out)).toBe(true);
    expect(crowded(out[0], out[1])).toBe(false);
    expect(Math.hypot(out[0], out[1] + 0.5)).toBeLessThanOrEqual(2);
    // Only where the body fits.
    expect(roomFor(0, -0.5, (x) => x < 0, crowded, out)).toBe(true);
    expect(out[0]).toBeLessThan(0);
    // Already comfortable: no move.
    expect(roomFor(-2, 1, () => true, crowded, out)).toBe(false);
  });
});
