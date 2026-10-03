import { describe, expect, it } from "vitest";
import { BUOYS, MOORED, SEA_Y, dockToWorld, floatBoat, floatBuoy, mooredPose, newBoatPose, newFloat, worldToDock, type Dock } from "./wharf";
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
    const calm = { ...SEA, waveHeight: 0 }, f = newFloat(), pose = mooredPose(newBoatPose());
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
    const calm = { ...SEA, waveHeight: 0 }, f = newFloat(), going = { ...mooredPose(newBoatPose()), speed: 7, throttle: 1 };
    let nose = 0;
    for (let t = 0; t < 3; t += 0.05) { floatBoat(VILLAGE, going, t, calm, f); nose += f.pitch; }
    expect(nose / 60).toBeLessThan(-0.02); // bow up is negative rotation.x
  });

  it("keeps its buoys on the water, out of the boat's way", () => {
    const f = newFloat();
    for (const [x, z] of BUOYS) {
      expect(Math.hypot(x - MOORED.x, z - MOORED.z)).toBeGreaterThan(3);
      floatBuoy(VILLAGE, x, z, 12, SEA, f);
      expect(Math.abs(f.y - SEA_Y)).toBeLessThanOrEqual(SEA.waveHeight + 1e-9);
      expect(Math.abs(f.pitch) + Math.abs(f.roll)).toBeLessThan(0.3);
    }
  });
});
