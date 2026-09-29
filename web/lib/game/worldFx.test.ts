import { describe, expect, it } from "vitest";
import {
  LEAF_SLOTS, MIST_BANKS, MIST_TILE, RAIN_TILE, hash01, leafAt, mistBank, rainStreak, sheddingTrees, viewFocus, windowFade, worldWind,
  type LeafPose, type Point3,
} from "./worldFx";

const RAIN = { fall: 21, sway: 0 }, SNOW = { fall: 2.1, sway: 0.6 };
const LEAVES = { fall: 0.7, flutter: 0.35, spin: 9 };
const flat = () => 0;
/** A 1.5u rise east of x = 4, like a cliff plateau. */
const rise = (x: number) => (x > 4 ? 1.5 : 0);
const T = 51_234.567; // an afternoon, in world seconds
const pt = (): Point3 => ({ x: 0, y: 0, z: 0 });
const pose = (): LeafPose => ({ x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0, scale: 0 });
const inWindow = (p: Point3, cx: number, cz: number, tile: number) => Math.abs(p.x - cx) < tile / 2 - 1e-9 && Math.abs(p.z - cz) < tile / 2 - 1e-9;

describe("world wind", () => {
  it("is one direction for every weather, strongest on a windy day", () => {
    const calm = worldWind("clear"), windy = worldWind("wind"), fog = worldWind("fog");
    expect(windy.speed).toBeGreaterThan(worldWind("rain").speed);
    expect(fog.speed).toBeLessThan(calm.speed);
    expect(calm.x / calm.speed).toBeCloseTo(windy.x / windy.speed, 12);
    expect(calm.z / calm.speed).toBeCloseTo(windy.z / windy.speed, 12);
  });
});

describe("rain and snow field", () => {
  it("is deterministic: same world time and window, same streaks", () => {
    const wind = worldWind("rain");
    for (let i = 0; i < 240; i++) expect(rainStreak(i, T, wind, RAIN, 3, -2, pt())).toEqual(rainStreak(i, T, wind, RAIN, 3, -2, pt()));
  });

  it("does not follow the view: streaks both windows hold are the same world streaks", () => {
    for (const [look, weather] of [[RAIN, "rain"], [SNOW, "snow"]] as const) {
      const wind = worldWind(weather);
      let shared = 0;
      for (let i = 0; i < 240; i++) {
        // Player at the spawn, then walked 7 units east and 4 north.
        const a = rainStreak(i, T, wind, look, 0, 0, pt()), b = rainStreak(i, T, wind, look, 7, 4, pt());
        expect(inWindow(a, 0, 0, RAIN_TILE) && inWindow(b, 7, 4, RAIN_TILE)).toBe(true);
        if (inWindow(a, 7, 4, RAIN_TILE)) { shared++; expect(b.x).toBeCloseTo(a.x, 9); expect(b.z).toBeCloseTo(a.z, 9); expect(b.y).toBe(a.y); }
      }
      expect(shared).toBeGreaterThan(120);
    }
  });

  it("repeats one world tile and slants with the world wind", () => {
    const wind = worldWind("rain");
    const a = rainStreak(5, T, wind, RAIN, 0, 0, pt()), b = rainStreak(5, T, wind, RAIN, RAIN_TILE * 3, -RAIN_TILE, pt());
    expect(b.x - a.x).toBeCloseTo(RAIN_TILE * 3, 6);
    expect(b.z - a.z).toBeCloseTo(-RAIN_TILE, 6);
    // Within one fall the drop moves by the wind: find two instants in the same fall.
    const p0 = rainStreak(5, T, wind, RAIN, 0, 0, pt()), p1 = rainStreak(5, T + 0.05, wind, RAIN, 0, 0, pt());
    if (p1.y < p0.y) {
      expect(p1.x - p0.x).toBeCloseTo(wind.x * 0.05, 6);
      expect(p1.z - p0.z).toBeCloseTo(wind.z * 0.05, 6);
    }
  });
});

describe("mist banks", () => {
  it("sit at world positions that drift with the wind, not with the view", () => {
    const wind = worldWind("fog");
    let shared = 0;
    for (let k = 0; k < MIST_BANKS; k++) {
      const out = { ...pt(), strength: 0 };
      const a = { ...mistBank(k, T, wind, 0, 0, flat, out) };
      const b = mistBank(k, T, wind, -6, 5, flat, { ...pt(), strength: 0 });
      if (inWindow(a, -6, 5, MIST_TILE)) { shared++; expect(b.x).toBeCloseTo(a.x, 9); expect(b.z).toBeCloseTo(a.z, 9); }
      const later = mistBank(k, T + 4, wind, a.x, a.z, flat, { ...pt(), strength: 0 });
      expect(later.x - a.x).toBeCloseTo(wind.x * 4, 6);
      expect(later.z - a.z).toBeCloseTo(wind.z * 4, 6);
    }
    expect(shared).toBeGreaterThan(0);
  });

  it("pools over low ground and thins over rises and at the window edge", () => {
    const wind = worldWind("fog");
    expect(mistBank(0, T, wind, 0, 0, () => 0, { ...pt(), strength: 0 }).strength).toBe(1);
    expect(mistBank(0, T, wind, 0, 0, () => 1.5, { ...pt(), strength: 0 }).strength).toBe(0);
    expect(windowFade(0, 0, MIST_TILE)).toBe(1);
    expect(windowFade(MIST_TILE / 2, 0, MIST_TILE)).toBe(0);
  });
});

describe("leaves and petals shed by the trees", () => {
  const spots = [
    { x: -6, y: 0, z: -12, model: "/assets/acnh/plants/tree-hardwood-a.glb", scale: 0.85 },
    { x: -15, y: 0, z: -9, model: "/assets/acnh/plants/tree-cedar.glb", scale: 1.09 },
    { x: 2, y: 0, z: 3, model: "/assets/acnh/plants/tree-blossom.glb", scale: 1.01 },
  ];

  it("only trees that shed this season shed, and nothing without trees", () => {
    expect(sheddingTrees(spots, "autumn").map(t => t.x)).toEqual([-6]);
    expect(sheddingTrees(spots, "spring").map(t => t.x)).toEqual([2]);
    expect(sheddingTrees(spots, "summer")).toEqual([]);
    expect(sheddingTrees([], "autumn")).toEqual([]);
  });

  it("is deterministic and depends only on the tree, the slot, world time and the wind", () => {
    const [tree] = sheddingTrees(spots, "autumn"), wind = worldWind("clear");
    for (let s = 0; s < LEAF_SLOTS; s++) expect(leafAt(tree, s, T, wind, LEAVES, flat, pose())).toEqual(leafAt(tree, s, T, wind, LEAVES, flat, pose()));
    // Another tree at another spot gets its own schedule.
    const [other] = sheddingTrees([{ ...spots[0], x: 9, z: 4 }], "autumn");
    const differs = Array.from({ length: LEAF_SLOTS }, (_, s) => leafAt(tree, s, T, wind, LEAVES, flat, pose()).x - tree.x !== leafAt(other, s, T, wind, LEAVES, flat, pose()).x - other.x);
    expect(differs.some(Boolean)).toBe(true);
  });

  it("falls from the crown, drifts downwind, lands on the ground and rests", () => {
    const [tree] = sheddingTrees(spots, "autumn"), wind = worldWind("wind");
    let falling = 0, resting = 0;
    for (let s = 0; s < LEAF_SLOTS; s++) {
      for (let t = T; t < T + 20; t += 0.25) {
        const p = leafAt(tree, s, t, wind, LEAVES, flat, pose());
        if (p.scale <= 0) continue;
        expect(p.y).toBeGreaterThanOrEqual(0.02 - 1e-9);
        expect(p.y).toBeLessThanOrEqual(tree.y + tree.top);
        if (p.rx === -Math.PI / 2) { resting++; expect(p.y).toBeCloseTo(0.02, 9); } else falling++;
        // Everything ends up downwind of the trunk (flutter is sideways, the crown is ~1u).
        expect((p.x - tree.x) * wind.x + (p.z - tree.z) * wind.z).toBeGreaterThan(-1.5 * wind.speed);
      }
    }
    expect(falling).toBeGreaterThan(0);
    expect(resting).toBeGreaterThan(0);
  });

  it("a leaf blown off a rise falls to the ground below it", () => {
    const [tree] = sheddingTrees([{ ...spots[0], x: 3.6, z: 0, y: 0 }], "autumn"), wind = worldWind("wind");
    for (let s = 0; s < LEAF_SLOTS; s++) {
      for (let t = T; t < T + 20; t += 0.5) {
        const p = leafAt(tree, s, t, wind, LEAVES, rise, pose());
        if (p.scale > 0 && p.rx === -Math.PI / 2) expect(p.y).toBeCloseTo(rise(p.x) + 0.02, 9);
      }
    }
  });
});

describe("view focus", () => {
  it("is where the camera looks at the ground, wherever the player is", () => {
    const f = viewFocus({ x: 4, y: 8.1, z: -9.3 }, { x: 0, y: -0.565, z: 0.825 }, { x: 0, z: 0 });
    expect(f.x).toBeCloseTo(4, 9);
    expect(f.z).toBeCloseTo(-9.3 + 0.825 * (8.1 / 0.565), 9);
  });
});

it("hash01 stays in [0, 1) for large cycle numbers", () => {
  for (let b = 1e5; b < 1e5 + 2000; b++) { const h = hash01(7, b); expect(h).toBeGreaterThanOrEqual(0); expect(h).toBeLessThan(1); }
});
