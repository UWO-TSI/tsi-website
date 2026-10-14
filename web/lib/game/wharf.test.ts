import { describe, expect, it } from "vitest";
import { BUOYS, FINGER, MOORED, ROWBOAT, ROWBOATS, SEA_Y, dockToWorld, floatBoat, floatBuoy, floatRowboat, mooredPose, newBoatPose, newFloat, worldToDock, type Dock } from "./wharf";
import { waterSwellAt } from "./waterShader";
import { TUNING_DEFAULTS } from "./tuning";

const SEA = TUNING_DEFAULTS.water;
const VILLAGE: Dock = { x: 8, z: -19.5, yaw: 0 }, TURNED: Dock = { x: -3, z: 4, yaw: 0.8 };

describe("the wharf's boat and buoys float on the shared swell", () => {
  it("maps between a dock's frame and the world both ways", () => {
    const w = { x: 0, z: 0 }, l = { x: 0, z: 0 };
    for (const d of [VILLAGE, TURNED]) {
      dockToWorld(d, 1.3, -2.2, w);
      worldToDock(d, w.x, w.z, l);
      expect(l.x).toBeCloseTo(1.3, 9);
      expect(l.z).toBeCloseTo(-2.2, 9);
    }
    // A turned dock carries its +z (inland along the pier) round with it.
    dockToWorld(TURNED, 0, 1, w);
    expect([w.x - TURNED.x, w.z - TURNED.z].map(v => +v.toFixed(6))).toEqual([+Math.sin(0.8).toFixed(6), +Math.cos(0.8).toFixed(6)]);
  });

  it("rises and falls with the water under the hull and leans with its slope, a hand's breadth at most", () => {
    const pose = mooredPose(newBoatPose()), f = newFloat(), at = { x: 0, z: 0 };
    let lowest = Infinity, highest = -Infinity, steepest = 0;
    for (let t = 0; t < 30; t += 0.25) {
      floatBoat(VILLAGE, pose, t, SEA, f);
      dockToWorld(VILLAGE, MOORED.x, MOORED.z + 0.4, at);
      // It sits within the swell's range of where the water stands under its middle.
      expect(Math.abs(f.y - (SEA_Y + waterSwellAt(at.x, at.z, t, SEA)))).toBeLessThan(SEA.waveHeight * 1.2);
      lowest = Math.min(lowest, f.y); highest = Math.max(highest, f.y);
      steepest = Math.max(steepest, Math.abs(f.pitch), Math.abs(f.roll));
    }
    expect(highest - lowest).toBeGreaterThan(SEA.waveHeight);
    expect(steepest).toBeGreaterThan(0.002);
    expect(steepest).toBeLessThan(0.06);
  });

  it("dips toward the pier as someone steps aboard and rocks back, and rolls off the fenders when it comes alongside", () => {
    const calm = { ...SEA, waveHeight: 0, swellHeight: 0 }, f = newFloat(), pose = mooredPose(newBoatPose());
    floatBoat(VILLAGE, pose, 0, calm, f);
    const still = f.y;
    expect([f.pitch, f.roll, f.sway]).toEqual([0, 0, 0]);
    floatBoat(VILLAGE, { ...pose, dip: 0.08 }, 0, calm, f);
    expect(f.y).toBeLessThan(still - 0.02);
    expect(f.roll).toBeLessThan(0); // starboard, the pier's side, goes down
    floatBoat(VILLAGE, { ...pose, dip: 4 }, 0, calm, f);
    expect(Math.abs(f.y - still)).toBeLessThan(0.002);
    floatBoat(VILLAGE, { ...pose, bump: 0.2 }, 0, calm, f);
    expect(f.sway).toBeGreaterThan(0); // pushed off the pier, toward +x
  });

  it("noses up and skips over the chop when it is going", () => {
    const calm = { ...SEA, waveHeight: 0, swellHeight: 0 }, f = newFloat(), going = { ...mooredPose(newBoatPose()), speed: 7, throttle: 1 };
    let nose = 0;
    for (let t = 0; t < 3; t += 0.05) { floatBoat(VILLAGE, going, t, calm, f); nose += f.pitch; }
    expect(nose / 60).toBeLessThan(-0.02); // bow up is negative rotation.x
  });

  it("keeps its buoys on the water, out of the boat's way", () => {
    const f = newFloat();
    for (const [x, z] of BUOYS) {
      expect(Math.hypot(x - MOORED.x, z - MOORED.z)).toBeGreaterThan(3);
      floatBuoy(VILLAGE, x, z, 12, SEA, f);
      expect(Math.abs(f.y - SEA_Y)).toBeLessThanOrEqual(SEA.waveHeight + SEA.swellHeight + 1e-9);
      expect(Math.abs(f.pitch) + Math.abs(f.roll)).toBeLessThan(0.3);
    }
  });
});

// v1 water item 7: the wharf in the reference's style (art/wharf/build_wharf.py): a finger pier off the tip you can
// walk out on, lantern poles, rowboats moored along it. Its landmark door and arrival point stay where they were.
describe("the village wharf's finger pier and rowboats", () => {
  it("walks from the jetty's tip out along the finger, and not off its far end", async () => {
    const { islandOf, LANDMARK_INFO } = await import("./defaultIsland");
    const { village } = await import("./villageMap");
    const v = village(), w = v.objects.find(o => o.kind === "landmark" && o.id === "wharf")!, island = islandOf(v);
    const d: Dock = { x: w.x, z: w.z, yaw: w.yaw ?? 0 }, from = { x: 0, z: 0 }, to = { x: 0, z: 0 };
    dockToWorld(d, 0, -2.9, from);
    dockToWorld(d, -4.4, -2.9, to);
    const [x, z] = island.move(from.x, from.z, to.x, to.z);
    expect(Math.hypot(x - to.x, z - to.z)).toBeLessThan(0.05);
    const off = { x: 0, z: 0 };
    dockToWorld(d, -5.6, -2.9, off);
    const [ox, oz] = island.move(to.x, to.z, off.x, off.z);
    expect(Math.hypot(ox - to.x, oz - to.z)).toBeLessThan(0.4);
    expect(LANDMARK_INFO.wharf.door).toEqual([0, -2.5]);
    expect(LANDMARK_INFO.wharf.exit).toEqual([0, 1.1]);
  });
  it("moors the rowboats clear of the finger, the boat's berth and its lane", () => {
    for (const rb of ROWBOATS) {
      const halfLen = ROWBOAT.length / 2, halfBeam = ROWBOAT.beam / 2;
      // Lying along the finger (bow along ±x), beside it, not on it.
      expect(Math.abs(Math.sin(rb.yaw))).toBeGreaterThan(0.95);
      expect(rb.z + halfBeam < FINGER.z0 || rb.z - halfBeam > FINGER.z1).toBe(true);
      expect(rb.x + halfLen).toBeLessThan(FINGER.x1);
      expect(Math.hypot(rb.x - MOORED.x, rb.z - MOORED.z)).toBeGreaterThan(4);
      for (const [bx, bz] of BUOYS) expect(Math.hypot(rb.x - bx, rb.z - bz)).toBeGreaterThan(4);
      // Its line to a post on the finger that stands on its side.
      expect(FINGER.postX).toContain(rb.post[0]);
    }
  });
  it("floats the rowboats on the same swell as everything else, gently", () => {
    const f = newFloat();
    for (const rb of ROWBOATS) for (let t = 0; t < 30; t += 0.5) {
      floatRowboat(VILLAGE, rb, t, SEA, f);
      expect(Math.abs(f.y - SEA_Y)).toBeLessThanOrEqual(SEA.waveHeight + SEA.swellHeight + 1e-9);
      expect(Math.abs(f.pitch) + Math.abs(f.roll)).toBeLessThan(0.15);
    }
  });
});
