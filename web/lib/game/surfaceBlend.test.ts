import { describe, expect, it } from "vitest";
import { createCenteredMap, Surface, setCell, cellToWorldX, cellToWorldZ, easedCellOutline, surfaceAt } from "./grid";
import { createSurfaceBlend } from "./surfaceBlend";

function path() {
  const map = createCenteredMap(9, 9);
  for (let z = 1; z < 8; z++) setCell(map, 4, z, 0, Surface.Soil);
  return map;
}

describe("natural surface blending", () => {
  it("fades at a grass edge while keeping the centre of a one-tile path opaque", () => {
    const map = path(), blend = createSurfaceBlend(map, Surface.Soil);
    const x = cellToWorldX(map, 4), z = cellToWorldZ(map, 4);
    expect(blend.sample(x - 0.5, z)).toBeCloseTo(0);
    expect(blend.sample(x - 0.35, z)).toBeCloseTo(0.5);
    expect(blend.sample(x, z)).toBe(1);
    expect(blend.sample(x, z + 0.5)).toBe(1);
  });
  it("does not expose a green rim beside water or a constructed path", () => {
    for (const neighbor of [Surface.River, Surface.Void, Surface.Wood, Surface.Stone]) {
      const map = createCenteredMap(9, 9);
      for (let z = 0; z < 9; z++) for (let x = 0; x < 9; x++) setCell(map, x, z, 0, x < 5 ? Surface.Sand : neighbor);
      const blend = createSurfaceBlend(map, Surface.Sand);
      expect(blend.sample(cellToWorldX(map, 4) + 0.5, cellToWorldZ(map, 4))).toBe(1);
    }
  });
  it("follows rounded corners instead of fading along an imaginary square", () => {
    const map = path();
    const blend = createSurfaceBlend(map, Surface.Soil);
    const outline = easedCellOutline((x, z) => surfaceAt(map, x, z) === Surface.Soil, 4, 1)!;
    const x = cellToWorldX(map, 4), z = cellToWorldZ(map, 1);
    // The first arc faces grass; each drawn boundary point should disappear into it.
    for (const [dx, dz] of outline.filter(([, dz]) => dz < -0.1)) expect(blend.sample(x + dx, z + dz)).toBeCloseTo(0, 6);
  });
  it("has no seam at cell/chunk joins and does not mutate authored cells", () => {
    const map = path(), before = JSON.stringify(map), blend = createSurfaceBlend(map, Surface.Soil);
    const x = cellToWorldX(map, 4) + 0.4, z = cellToWorldZ(map, 4) + 0.5;
    expect(blend.sample(x, z - 1e-6)).toBeCloseTo(blend.sample(x, z + 1e-6), 5);
    expect(JSON.stringify(map)).toBe(before);
  });
});
