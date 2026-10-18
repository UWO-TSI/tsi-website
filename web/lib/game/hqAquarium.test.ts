import { describe, expect, it } from "vitest";
import { HQ } from "./hqLayout";
import { ORANGE, SILVER, fishAt, swimBox, tankFish } from "./hqAquarium";

describe("HQ's aquarium fish", () => {
  const fish = tankFish();

  it("keeps every fish in the water the whole time: off the glass, the back, the sand and the surface", () => {
    const box = swimBox(), a = HQ.aquarium;
    expect(box.x0).toBeGreaterThan(a.x0);
    expect(box.x1).toBeLessThan(a.x1);
    expect(box.y0).toBeGreaterThan(a.y0);
    expect(box.y1).toBeLessThan(a.y1);
    for (const f of fish) for (let t = 0; t < 240; t += 0.83) {
      const p = fishAt(f, t);
      expect(p.x).toBeGreaterThanOrEqual(box.x0 - 1e-9);
      expect(p.x).toBeLessThanOrEqual(box.x1 + 1e-9);
      expect(p.y).toBeGreaterThanOrEqual(box.y0 - 1e-9);
      expect(p.y).toBeLessThanOrEqual(box.y1 + 1e-9);
      expect(p.z).toBeGreaterThanOrEqual(box.z0 - 1e-9);
      expect(p.z).toBeLessThanOrEqual(box.z1 + 1e-9);
    }
  });

  it("has schools of silver through both storeys and orange fish low by the reef (the two references)", () => {
    const silver = fish.filter(f => (SILVER as readonly string[]).includes(f.color)), orange = fish.filter(f => (ORANGE as readonly string[]).includes(f.color));
    expect(silver.length).toBeGreaterThanOrEqual(40);
    expect(orange.length).toBeGreaterThanOrEqual(10);
    expect(Math.max(...silver.map(f => f.y0))).toBeGreaterThan(HQ.aquarium.y1 / 2 + 1);   // seen from the mezzanine
    expect(Math.min(...silver.map(f => f.y0))).toBeLessThan(2.5);                          // and from the ground lounge
    expect(Math.max(...orange.map(f => f.y0))).toBeLessThan(3);
    // a school is fish sharing one path
    expect(new Set(silver.map(f => `${f.zc}:${f.za}:${f.w}`)).size).toBeLessThanOrEqual(4);
  });

  it("faces the way it swims", () => {
    const f = fish[0], t = 3, p = fishAt(f, t), q = fishAt(f, t + 0.01);
    const yaw = Math.atan2(q.x - p.x, q.z - p.z);
    expect(Math.abs(Math.atan2(Math.sin(yaw - p.yaw), Math.cos(yaw - p.yaw)))).toBeLessThan(0.05);
  });

  it("is the same tank every visit", () => {
    expect(tankFish()).toEqual(fish);
  });
});
