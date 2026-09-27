import { describe, expect, it } from "vitest";
import { Vector3 } from "three";
import { glintDirection } from "@/lib/game/waterShader";
import { ISLAND_LIGHTING } from "@/lib/game/islandLighting";
import { createDefaultIsland } from "@/lib/game/defaultIsland";
import { WATER_DROP, isRiver, surfaceAt, worldToCellX, worldToCellZ } from "@/lib/game/grid";
import { glintPoints } from "./GridOcean";

const deg = (r: number) => r * 180 / Math.PI;
const FORWARD = new Vector3(0, -0.56, 0.83); // the follow camera: looking +z, 34° down

describe("water glint path (row 237)", () => {
  it("keeps the sun's elevation and lands in front of the camera, on the sun's side, inside the frame", () => {
    for (const phase of ["dawn", "day", "evening", "night"] as const) {
      const sun = new Vector3(...ISLAND_LIGHTING[phase].sunPosition), g = glintDirection(sun, FORWARD);
      expect(g.length()).toBeCloseTo(1);
      expect(g.y, phase).toBeCloseTo(sun.clone().normalize().y);
      expect(g.z, phase).toBeGreaterThan(0);
      expect(Math.sign(g.x), phase).toBe(Math.sign(sun.x));
      expect(deg(Math.atan2(Math.abs(g.x), g.z)), phase).toBeLessThan(35); // the horizontal half-FOV is 38° at 16:9
    }
  });
  it("is left by day and right at golden hour (screen-left is +x)", () => {
    expect(glintDirection(new Vector3(...ISLAND_LIGHTING.day.sunPosition), FORWARD).x).toBeGreaterThan(0);
    expect(glintDirection(new Vector3(...ISLAND_LIGHTING.evening.sunPosition), FORWARD).x).toBeLessThan(0);
  });
  it("follows any camera heading, and leaves a sun dead ahead where it is", () => {
    const turned = glintDirection(new Vector3(0, 1, -1), new Vector3(1, 0, 0));
    expect(turned.x).toBeGreaterThan(0);
    const straight = glintDirection(new Vector3(0, 1, 2), new Vector3(0, -0.5, 1));
    expect(straight.x).toBeCloseTo(0);
    expect(straight.z).toBeGreaterThan(0);
  });
});

describe("glint sprites (row 237)", () => {
  const { map } = createDefaultIsland();
  const pts = glintPoints(map), n = pts.length / 4;
  const onWater = (i: number) => {
    const x = pts[i * 4], z = pts[i * 4 + 2], cx = worldToCellX(map, x), cz = worldToCellZ(map, z);
    const inside = cx >= 0 && cz >= 0 && cx < map.width && cz < map.depth;
    return inside ? isRiver(surfaceAt(map, cx, cz)) : pts[i * 4 + 1] === Math.fround(-WATER_DROP);
  };
  it("sit only on water, seeded", () => {
    expect(n).toBeGreaterThan(5000);
    for (let i = 0; i < n; i++) expect(onWater(i), `point ${i}`).toBe(true);
    expect(glintPoints(map)).toEqual(pts);
  });
  it("leave the water under a deck clear", () => {
    const deck = (x: number, z: number) => x > 7 && x < 9 && z > -23 && z < -17;
    const kept = glintPoints(map, deck);
    expect(kept.length).toBeLessThan(pts.length);
    for (let i = 0; i < kept.length; i += 4) expect(deck(kept[i], kept[i + 2])).toBe(false);
  });
  it("spread evenly through any prefix, so the Light tier's half covers the river and the sea", () => {
    let near = 0;
    for (let i = 0; i < n / 2; i++) if (Math.abs(pts[i * 4]) < 32 && Math.abs(pts[i * 4 + 2]) < 32) near++;
    expect(near / (n / 2)).toBeGreaterThan(0.15);
    expect(near / (n / 2)).toBeLessThan(0.6);
  });
});
