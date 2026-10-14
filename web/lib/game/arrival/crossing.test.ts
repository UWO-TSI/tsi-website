import { describe, expect, it } from "vitest";
import { CROSSING_FRAMES, crossingCamera, type CameraOut } from "./crossing";
import { CROSSING_SHOTS } from "./sequence";

const out = (): CameraOut => ({ pos: [0, 0, 0], look: [0, 0, 0], fov: 0 });
const pts = { island: { x: 0, z: 0 }, wharf: { x: 8, z: -23 } };

describe("the crossing's shots", () => {
  it("frames every shot, always above the water, looking somewhere else than where it stands", () => {
    for (const { id } of CROSSING_SHOTS) {
      expect(CROSSING_FRAMES[id]).toBeDefined();
      for (const k of [0, 0.5, 1]) for (const yaw of [0, 0.4, -2.8]) {
        const c = crossingCamera(id, k, { x: 20, y: -0.07, z: -60, yaw }, pts, out());
        expect([...c.pos, ...c.look, c.fov].every(Number.isFinite)).toBe(true);
        expect(c.pos[1]).toBeGreaterThan(0.2);
        expect(Math.hypot(c.pos[0] - c.look[0], c.pos[1] - c.look[1], c.pos[2] - c.look[2])).toBeGreaterThan(0.4);
        expect(c.fov).toBeGreaterThan(20);
        expect(c.fov).toBeLessThan(70);
      }
    }
  });
  it("turns with the boat: a boat-local framing rotates with its heading", () => {
    const a = crossingCamera("closeup", 0, { x: 0, y: 0, z: 0, yaw: 0 }, pts, out());
    const b = crossingCamera("closeup", 0, { x: 0, y: 0, z: 0, yaw: Math.PI / 2 }, pts, out());
    expect(a.pos[2]).toBeGreaterThan(1);          // ahead of the bench, facing back at you
    expect(b.pos[0]).toBeGreaterThan(1);          // the bow now points +x
    expect(Math.hypot(a.pos[0], a.pos[2])).toBeCloseTo(Math.hypot(b.pos[0], b.pos[2]));
  });
  it("looks at the island from the drone and at the wharf as it comes up", () => {
    const boat = { x: 20, y: 0, z: -60, yaw: 0 };
    const drone = crossingCamera("drone", 1, boat, pts, out());
    const toIsland = Math.hypot(drone.look[0] - pts.island.x, drone.look[2] - pts.island.z);
    expect(toIsland).toBeLessThan(Math.hypot(boat.x - pts.island.x, boat.z - pts.island.z));
    const near = { x: 10, y: 0, z: -28, yaw: 0 };
    const wharf = crossingCamera("wharf", 1, near, pts, out());
    expect(Math.hypot(wharf.look[0] - pts.wharf.x, wharf.look[2] - pts.wharf.z)).toBeLessThan(Math.hypot(near.x - pts.wharf.x, near.z - pts.wharf.z));
  });
  it("drops the aim with the curved world's bend, by the distance squared", () => {
    const boat = { x: 20, y: 0, z: -60, yaw: 0 };
    const flat = crossingCamera("drone", 0.5, boat, pts, out());
    const bent = crossingCamera("drone", 0.5, boat, pts, out(), 0.0032);
    const d2 = (flat.look[0] - flat.pos[0]) ** 2 + (flat.look[2] - flat.pos[2]) ** 2;
    expect(bent.look[1]).toBeCloseTo(flat.look[1] - d2 * 0.0032);
    expect(bent.pos).toEqual(flat.pos);
  });
});
